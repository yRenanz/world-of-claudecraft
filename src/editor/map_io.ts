// Map save/load orchestration: the local MapStore (explicit saves), the
// autosave draft slot (separate key), and the client-side link between a local
// document (meta.id) and its server row (id + optimistic version). The app
// composes this with net.ts; no DOM here beyond localStorage.

import type { MapDoc } from '../sim/map_doc';
import type { CustomMap } from './custom_map';
import * as net from './net';
import { MapStore, parseMap, serializeMap } from './persist';

const LINKS_KEY = 'woc_editor_server_links';
const DRAFT_KEY = 'woc_editor_draft';

export interface ServerLink {
  serverId: number;
  version: number;
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export class MapIO {
  readonly store = new MapStore();

  // ---- local <-> server linkage --------------------------------------------

  private readLinks(): Record<string, ServerLink> {
    const s = safeStorage();
    if (!s) return {};
    try {
      const raw = s.getItem(LINKS_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === 'object' ? (obj as Record<string, ServerLink>) : {};
    } catch {
      return {};
    }
  }

  private writeLinks(links: Record<string, ServerLink>): void {
    try {
      safeStorage()?.setItem(LINKS_KEY, JSON.stringify(links));
    } catch {
      // Storage blocked: links stay session-only.
    }
  }

  linkFor(metaId: string): ServerLink | null {
    const link = this.readLinks()[metaId];
    return link && typeof link.serverId === 'number' && typeof link.version === 'number'
      ? link
      : null;
  }

  setLink(metaId: string, link: ServerLink | null): void {
    const links = this.readLinks();
    if (link) links[metaId] = link;
    else delete links[metaId];
    this.writeLinks(links);
  }

  // ---- saves ----------------------------------------------------------------

  saveLocal(map: CustomMap): boolean {
    return this.store.save(map);
  }

  /**
   * Save to the server: create when unlinked, else optimistic-version update.
   * Returns the refreshed link. Throws EditorApiError (including the 409
   * version_conflict the app resolves via Save As Copy).
   */
  async saveServer(map: CustomMap): Promise<ServerLink> {
    const doc = map as unknown as MapDoc;
    const link = this.linkFor(map.meta.id);
    if (!link) {
      const created = await net.createMap(map.meta.name, doc);
      const next = { serverId: created.id, version: created.version };
      this.setLink(map.meta.id, next);
      return next;
    }
    const updated = await net.updateMap(link.serverId, doc, link.version, map.meta.name);
    const next = { serverId: updated.id, version: updated.version };
    this.setLink(map.meta.id, next);
    return next;
  }

  /** Create a NEW server map from this document (Save As Copy after a 409). */
  async saveServerAsCopy(map: CustomMap): Promise<ServerLink> {
    const created = await net.createMap(map.meta.name, map as unknown as MapDoc);
    const next = { serverId: created.id, version: created.version };
    this.setLink(map.meta.id, next);
    return next;
  }

  // ---- autosave draft ---------------------------------------------------------

  draftSave(map: CustomMap): boolean {
    try {
      safeStorage()?.setItem(DRAFT_KEY, serializeMap(map));
      return true;
    } catch {
      return false;
    }
  }

  draftLoad(): CustomMap | null {
    const s = safeStorage();
    if (!s) return null;
    try {
      const raw = s.getItem(DRAFT_KEY);
      return raw ? parseMap(raw) : null;
    } catch {
      return null;
    }
  }

  draftClear(): void {
    try {
      safeStorage()?.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
  }
}
