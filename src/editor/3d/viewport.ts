// The 3D in-world editor viewport. Reuses the real game Renderer over a frozen Sim
// built from the editor's CustomMap, drives a free editor camera, and applies edits
// through the Renderer's live editing APIs: chunk-local terrain rebuilds during a
// brush stroke (rebuildTerrain(region)) with a macro-normal rebake at stroke end,
// the shader brush ring (setEditorBrush/clearEditorBrush), live water re-seating
// (rebuildWater), and the PlacedAssetsView instancer for placements
// (add/update/remove/select/footprints/reSeat). This is the DEFAULT editor mode.
// Editor-only (dev tooling); imports the heavy Renderer.
//
// Ownership: the APP owns the document and the ACTIVE WorldContent
// (setActiveWorldContent); this viewport only reads terrain via the active
// content and pushes render updates.

import * as THREE from 'three';
import { assetsReady } from '../../render/assets/preload';
import { Renderer } from '../../render/renderer';
import { Sim } from '../../sim/sim';
import type { WorldContent } from '../../sim/types';
import { DT } from '../../sim/types';
import { terrainHeight } from '../../sim/world';
import { type CustomMap, customMapToWorldContent, placementsToRenderAssets } from '../custom_map';
import { EditorCamera } from './editor_camera';

export interface EditRegion {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}

export interface Editor3DHooks {
  // The active tool wants left-click/drag for editing (so the viewport must not
  // orbit on the left button). Right-drag always orbits; middle/shift-drag pans.
  toolActive(): boolean;
  // Pointer began/continued/ended an edit over the terrain surface (world x/z).
  onEditStart(world: { x: number; z: number }, ev: PointerEvent): void;
  onEditMove(world: { x: number; z: number }, ev: PointerEvent): void;
  onEditEnd(ev: PointerEvent): void;
  // The cursor moved over the surface (for the brush gizmo); null when off-terrain.
  onHover(world: { x: number; z: number } | null): void;
  // A left-click that did not turn into a drag while no edit tool was active
  // (Select mode picking). Client coords + the terrain point under the cursor.
  onTap(clientX: number, clientY: number, world: { x: number; z: number } | null): void;
}

const SPAWN_RING_COLOR = 0x3fd0ff;
const SPAWN_RING_SEGMENTS = 40;
const TAP_SLOP_PX = 5;

export class Editor3DViewport {
  private canvas!: HTMLCanvasElement;
  private nameplates!: HTMLDivElement;
  private readonly cam = new EditorCamera();
  private sim: Sim | null = null;
  private renderer: Renderer | null = null;
  private raf = 0;
  private lastT = 0;
  private disposed = false;
  private seed = 20061;
  private map: CustomMap;

  private spawnRing: THREE.Mesh | null = null;
  private spawnPoint: { x: number; z: number } | null = null;
  private readonly spawnMat = new THREE.MeshBasicMaterial({
    color: SPAWN_RING_COLOR,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  private readonly picker = new THREE.Raycaster();

  // Interaction state.
  private dragMode: 'none' | 'orbit' | 'pan' | 'edit' = 'none';
  private lastPointer = { x: 0, y: 0 };
  private downPointer = { x: 0, y: 0 };
  private dragDist = 0;
  private readonly keys = new Set<string>();

  constructor(
    private readonly parent: HTMLElement,
    map: CustomMap,
    private readonly hooks: Editor3DHooks,
  ) {
    this.map = map;
    this.createSurfaces();
  }

  private createSurfaces(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'editor-3d-canvas';
    this.nameplates = document.createElement('div');
    this.nameplates.className = 'editor-3d-nameplates';
    this.parent.append(this.canvas, this.nameplates);
  }

  /**
   * Boot the engine over the ACTIVE world content (the app has already called
   * setActiveWorldContent with a content built from this.map).
   */
  async start(): Promise<void> {
    if (!this.canvas.isConnected) this.createSurfaces();
    this.seed = this.map.meta.seed;
    const world = customMapToWorldContent(this.map);
    await assetsReady();
    if (this.disposed) return;
    // The live PlacedAssetsView owns placements, so strip them from the Sim's
    // world or the Renderer ctor would build a second, frozen copy.
    this.sim = new Sim({
      seed: this.seed,
      playerClass: 'warrior',
      world: { ...world, placements: undefined },
    });
    this.renderer = new Renderer(this.sim, this.canvas, this.nameplates);
    this.renderer.placedAssets.rebuildAll(placementsToRenderAssets(this.map.placements), true);
    this.setSpawnMarker(this.map.playerStart ?? null);
    // Frame the world hub to start.
    const hub = this.map.content.zones[0]?.hub ?? { x: 0, z: 0 };
    this.cam.target.set(hub.x, terrainHeight(hub.x, hub.z, this.seed), hub.z);
    this.attachEvents();
    this.lastT = performance.now();
    this.loop();
  }

  get ready(): boolean {
    return this.renderer !== null;
  }

  // The renderer's surface raycast for the current cursor (client coords).
  // surfacePoint expects canvas-origin coordinates (the game canvas fills the
  // window; the editor canvas is offset by the top bar + tool rail), so convert.
  surfaceAt(clientX: number, clientY: number): { x: number; z: number } | null {
    if (!this.renderer) return null;
    const r = this.canvas.getBoundingClientRect();
    const p = this.renderer.surfacePoint(clientX - r.left, clientY - r.top);
    return p ? { x: p.x, z: p.z } : null;
  }

  /** True while a pointer drag is navigating (fly keys are live), so the app
   *  suppresses single-key tool shortcuts. */
  isNavigating(): boolean {
    return this.dragMode === 'orbit' || this.dragMode === 'pan';
  }

  // ---- live edit application -----------------------------------------------

  /** Chunk-local terrain re-mesh over the edited region (cheap; per drag sample). */
  rebuildTerrainRegion(region: EditRegion): void {
    this.renderer?.rebuildTerrain(region);
  }

  /** Stroke-end work: macro-normal rebake + re-seat placements and the spawn ring. */
  finishTerrainStroke(region: EditRegion): void {
    if (!this.renderer) return;
    this.renderer.rebakeTerrainNormals(region);
    this.renderer.placedAssets.reSeat();
    this.refreshSpawnRing();
  }

  /** Full terrain rebuild (map load / clear-all / undo of a large batch). */
  rebuildTerrainFull(): void {
    if (!this.renderer) return;
    this.renderer.rebuildTerrain();
    this.renderer.rebuildWater();
    this.renderer.placedAssets.reSeat();
    this.refreshSpawnRing();
  }

  /** Re-seat the water surface at the ACTIVE waterLevel(). */
  rebuildWater(): void {
    this.renderer?.rebuildWater();
  }

  /** Project the brush ring at world (x, z); pass per pointer-move. */
  setBrush(x: number, z: number, radius: number, color?: number): void {
    this.renderer?.setEditorBrush(x, z, radius, color);
  }

  clearBrush(): void {
    this.renderer?.clearEditorBrush();
  }

  // Placement passthroughs, keyed by the document index (the app keeps document
  // order and view slots in lockstep; structural changes use rebuildPlacements).
  placementAdded(index: number): void {
    const assets = placementsToRenderAssets([this.map.placements[index]]);
    if (assets.length === 1) this.renderer?.placedAssets.addPlacement(index, assets[0]);
  }

  placementUpdated(
    index: number,
    change: { x?: number; z?: number; rotY?: number; scale?: number },
  ): void {
    this.renderer?.placedAssets.updatePlacement(index, change);
  }

  /** Full re-instance (removal / mid-list insert / paste / undo). */
  rebuildPlacements(): void {
    this.renderer?.placedAssets.rebuildAll(placementsToRenderAssets(this.map.placements));
  }

  setSelectedPlacement(index: number | null): void {
    this.renderer?.placedAssets.setSelected(index);
  }

  showFootprints(on: boolean): void {
    this.renderer?.placedAssets.showFootprints(on);
  }

  /**
   * Which placement a click lands on: raycast the placed-assets group and take
   * the nearest placement anchor to the hit; fall back to the terrain point.
   * Returns the DOCUMENT index or null.
   */
  pickPlacement(clientX: number, clientY: number): number | null {
    if (!this.renderer) return null;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
      -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1,
    );
    this.picker.setFromCamera(ndc, this.renderer.camera);
    const hits = this.picker.intersectObjects(this.renderer.placedAssets.group.children, true);
    let probe: { x: number; z: number } | null = null;
    let slack = 1.5;
    if (hits.length > 0 && hits[0].point) {
      probe = { x: hits[0].point.x, z: hits[0].point.z };
      slack = 4;
    } else {
      probe = this.surfaceAt(clientX, clientY);
    }
    if (!probe) return null;
    let best = -1;
    let bestD2 = Number.POSITIVE_INFINITY;
    for (let i = 0; i < this.map.placements.length; i++) {
      const p = this.map.placements[i];
      const dx = probe.x - p.x;
      const dz = probe.z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < bestD2) {
        bestD2 = d2;
        best = i;
      }
    }
    if (best < 0) return null;
    const maxD = Math.max(slack, (this.map.placements[best].scale || 1) * 2);
    return bestD2 <= maxD * maxD ? best : null;
  }

  // ---- spawn marker ----------------------------------------------------------

  setSpawnMarker(point: { x: number; z: number } | null): void {
    this.spawnPoint = point ? { x: point.x, z: point.z } : null;
    this.refreshSpawnRing();
  }

  private refreshSpawnRing(): void {
    if (!this.renderer) return;
    if (this.spawnRing) {
      this.renderer.scene.remove(this.spawnRing);
      this.spawnRing.geometry.dispose();
      this.spawnRing = null;
    }
    if (!this.spawnPoint) return;
    const { x, z } = this.spawnPoint;
    const radius = 1.6;
    const geo = new THREE.RingGeometry(radius - 0.22, radius, SPAWN_RING_SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, terrainHeight(x + pos.getX(i), z + pos.getZ(i), this.seed) + 0.1);
    }
    geo.computeBoundingSphere();
    this.spawnRing = new THREE.Mesh(geo, this.spawnMat);
    this.spawnRing.position.set(x, 0, z);
    this.spawnRing.renderOrder = 2;
    this.renderer.scene.add(this.spawnRing);
  }

  // Swap to a different document (load/new/import) without leaking: rebuild the
  // Sim+Renderer since spawns come from the map (and the GL context is replaced).
  async reload(map: CustomMap): Promise<void> {
    this.map = map;
    this.detachEvents();
    this.teardownEngine();
    await this.start();
  }

  setVisible(v: boolean): void {
    this.parent.style.display = v ? '' : 'none';
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.detachEvents();
    this.teardownEngine();
  }

  // Free the GL context and remove the surfaces. A fresh canvas is needed for a
  // later start() because forceContextLoss() permanently kills this context.
  private teardownEngine(): void {
    cancelAnimationFrame(this.raf);
    if (this.renderer) {
      try {
        this.renderer.editorCam = null;
        this.renderer.webgl.setAnimationLoop(null);
        this.renderer.webgl.dispose();
        this.renderer.webgl.forceContextLoss();
      } catch {
        // GL teardown is best-effort.
      }
    }
    this.renderer = null;
    this.sim = null;
    this.spawnRing = null;
    this.canvas?.remove();
    this.nameplates?.remove();
  }

  // ---- loop ---------------------------------------------------------------

  private loop = (): void => {
    if (this.disposed || !this.renderer || !this.sim) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastT) / 1000);
    this.lastT = now;

    this.applyKeys(dt);
    // Keep the look target grounded on the (possibly sculpted) terrain.
    this.cam.target.y = terrainHeight(this.cam.target.x, this.cam.target.z, this.seed);
    // Teleport the frozen player to the camera target so foliage/critter LOD stays
    // populated under the cursor (the renderer re-centers dressing on the player).
    const player = this.sim.player;
    if (player) {
      player.pos.x = this.cam.target.x;
      player.pos.z = this.cam.target.z;
      player.pos.y = this.cam.target.y;
    }
    this.renderer.editorCam = this.cam.pose();
    this.renderer.sync(1, DT, null);
    this.raf = requestAnimationFrame(this.loop);
  };

  private applyKeys(dt: number): void {
    // Fly only while a navigation drag is held: the single-key tool shortcuts
    // (W water, S spawn, E erase, ...) own these keys when the pointer is up.
    if (!this.isNavigating()) return;
    const f = (this.keys.has('w') ? 1 : 0) - (this.keys.has('s') ? 1 : 0);
    const r = (this.keys.has('d') ? 1 : 0) - (this.keys.has('a') ? 1 : 0);
    const u = (this.keys.has('e') ? 1 : 0) - (this.keys.has('q') ? 1 : 0);
    if (f || r || u) this.cam.fly(f, r, u, dt);
  }

  // ---- input --------------------------------------------------------------

  private attachEvents(): void {
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
    window.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('contextmenu', this.onContext);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  private detachEvents(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('contextmenu', this.onContext);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  private onContext = (e: Event): void => e.preventDefault();

  private onPointerDown = (ev: PointerEvent): void => {
    this.lastPointer = { x: ev.clientX, y: ev.clientY };
    this.downPointer = { x: ev.clientX, y: ev.clientY };
    this.dragDist = 0;
    const wantsEdit = ev.button === 0 && this.hooks.toolActive();
    if (wantsEdit) {
      const w = this.surfaceAt(ev.clientX, ev.clientY);
      if (w) {
        this.dragMode = 'edit';
        this.hooks.onEditStart(w, ev);
        this.canvas.setPointerCapture(ev.pointerId);
        return;
      }
    }
    // Middle or shift+drag pans; otherwise orbit (left-drag in Select, right-drag always).
    this.dragMode = ev.button === 1 || ev.shiftKey ? 'pan' : 'orbit';
    this.canvas.setPointerCapture(ev.pointerId);
  };

  private onPointerMove = (ev: PointerEvent): void => {
    const dx = ev.clientX - this.lastPointer.x;
    const dy = ev.clientY - this.lastPointer.y;
    this.lastPointer = { x: ev.clientX, y: ev.clientY };
    this.dragDist += Math.abs(dx) + Math.abs(dy);
    if (this.dragMode === 'orbit') this.cam.orbit(dx, dy);
    else if (this.dragMode === 'pan') this.cam.pan(dx, dy);
    else if (this.dragMode === 'edit') {
      const w = this.surfaceAt(ev.clientX, ev.clientY);
      if (w) this.hooks.onEditMove(w, ev);
    } else {
      this.hooks.onHover(this.surfaceAt(ev.clientX, ev.clientY));
    }
  };

  private onPointerLeave = (): void => {
    if (this.dragMode === 'none') this.hooks.onHover(null);
  };

  private onPointerUp = (ev: PointerEvent): void => {
    if (this.dragMode === 'edit') {
      this.hooks.onEditEnd(ev);
    } else if (this.dragMode === 'orbit' && ev.button === 0 && this.dragDist <= TAP_SLOP_PX) {
      // A left tap with no edit tool armed: a Select-mode pick.
      this.hooks.onTap(ev.clientX, ev.clientY, this.surfaceAt(ev.clientX, ev.clientY));
    }
    this.dragMode = 'none';
  };

  private onWheel = (ev: WheelEvent): void => {
    ev.preventDefault();
    this.cam.zoom(ev.deltaY);
  };

  private onKeyDown = (ev: KeyboardEvent): void => {
    const k = ev.key.toLowerCase();
    if ('wasdqe'.includes(k)) this.keys.add(k);
  };

  private onKeyUp = (ev: KeyboardEvent): void => {
    this.keys.delete(ev.key.toLowerCase());
  };
}
