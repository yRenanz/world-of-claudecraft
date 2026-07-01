// The editor top bar: app title, inline-editable map name, dirty dot + save
// state, undo depth, the primary actions, the 3D/2D toggle, and the offline
// badge with a sign-in deep link. Pure chrome: every mutation flows through the
// injected callbacks; the app pushes state back via the set* methods.

import { t } from '../ui/i18n';
import { button, el } from './dom';

export interface TopbarDeps {
  onNameChange(name: string): void;
  onNew(): void;
  onOpen(): void;
  onSave(): void;
  onSaveAs(): void;
  onFork(): void;
  onImport(): void;
  onExport(): void;
  onUploadAsset(): void;
  onPlaytest(): void;
  onViewMode(mode: '3d' | '2d'): void;
}

export class Topbar {
  readonly root: HTMLElement;
  private readonly nameInput: HTMLInputElement;
  private readonly dirtyDot: HTMLElement;
  private readonly saveState: HTMLElement;
  private readonly undoBadge: HTMLElement;
  private readonly offlineBadge: HTMLElement;
  private readonly forkBtn: HTMLButtonElement;
  private readonly uploadBtn: HTMLButtonElement;
  private readonly saveBtn: HTMLButtonElement;
  private readonly viewButtons = new Map<'3d' | '2d', HTMLButtonElement>();

  constructor(parent: HTMLElement, deps: TopbarDeps) {
    this.root = el('header', 'ed-topbar');
    this.root.setAttribute('aria-label', t('editor.topbar.label'));

    const brand = el('div', 'ed-brand', t('editor.appTitle'));
    this.root.appendChild(brand);

    // Inline-editable map name + dirty dot + save state.
    const nameWrap = el('div', 'ed-name-wrap');
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.className = 'ed-name';
    this.nameInput.maxLength = 60;
    this.nameInput.setAttribute('aria-label', t('editor.topbar.mapNameLabel'));
    this.nameInput.addEventListener('change', () => {
      const v = this.nameInput.value.trim() || t('editor.untitledMap');
      this.nameInput.value = v;
      deps.onNameChange(v);
    });
    this.nameInput.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') this.nameInput.blur();
      ev.stopPropagation(); // typing a tool key in the name must not switch tools
    });
    this.dirtyDot = el('span', 'ed-dirty-dot');
    this.dirtyDot.title = t('editor.topbar.dirtyDot');
    this.dirtyDot.style.display = 'none';
    this.saveState = el('span', 'ed-save-state', t('editor.topbar.neverSaved'));
    nameWrap.append(this.nameInput, this.dirtyDot, this.saveState);
    this.root.appendChild(nameWrap);

    this.undoBadge = el('span', 'ed-undo-badge');
    this.undoBadge.style.display = 'none';
    this.root.appendChild(this.undoBadge);

    const spacer = el('div', 'ed-topbar-spacer');
    this.root.appendChild(spacer);

    this.offlineBadge = el('span', 'ed-offline');
    this.offlineBadge.style.display = 'none';
    const offLabel = el('span', undefined, t('editor.topbar.offline'));
    offLabel.title = t('editor.topbar.offlineTitle');
    const signIn = document.createElement('a');
    signIn.href = '/index.html';
    signIn.target = '_blank';
    signIn.rel = 'noopener';
    signIn.textContent = t('editor.topbar.signIn');
    signIn.title = t('editor.topbar.signInTitle');
    this.offlineBadge.append(offLabel, signIn);
    this.root.appendChild(this.offlineBadge);

    const actions = el('div', 'ed-actions');
    actions.appendChild(
      button(t('editor.topbar.new'), deps.onNew, undefined, t('editor.topbar.newTitle')),
    );
    actions.appendChild(
      button(t('editor.topbar.open'), deps.onOpen, undefined, t('editor.topbar.openTitle')),
    );
    this.saveBtn = button(
      t('editor.topbar.save'),
      deps.onSave,
      undefined,
      t('editor.topbar.saveTitle'),
    );
    actions.appendChild(this.saveBtn);
    actions.appendChild(
      button(t('editor.topbar.saveAs'), deps.onSaveAs, undefined, t('editor.topbar.saveAsTitle')),
    );
    this.forkBtn = button(
      t('editor.topbar.fork'),
      deps.onFork,
      undefined,
      t('editor.topbar.forkTitle'),
    );
    actions.appendChild(this.forkBtn);
    actions.appendChild(
      button(t('editor.topbar.import'), deps.onImport, undefined, t('editor.topbar.importTitle')),
    );
    actions.appendChild(
      button(t('editor.topbar.export'), deps.onExport, undefined, t('editor.topbar.exportTitle')),
    );
    this.uploadBtn = button(
      t('editor.topbar.uploadAsset'),
      deps.onUploadAsset,
      undefined,
      t('editor.topbar.uploadAssetTitle'),
    );
    actions.appendChild(this.uploadBtn);
    this.root.appendChild(actions);

    // 3D / 2D segmented toggle.
    const viewWrap = el('div', 'ed-view-toggle');
    viewWrap.setAttribute('role', 'group');
    viewWrap.setAttribute('aria-label', t('editor.topbar.viewLabel'));
    for (const mode of ['3d', '2d'] as const) {
      const b = button(
        mode === '3d' ? t('editor.topbar.view3d') : t('editor.topbar.view2d'),
        () => deps.onViewMode(mode),
        undefined,
        mode === '3d' ? t('editor.topbar.view3dTitle') : t('editor.topbar.view2dTitle'),
      );
      this.viewButtons.set(mode, b);
      viewWrap.appendChild(b);
    }
    this.root.appendChild(viewWrap);

    const play = button(
      t('editor.topbar.playtest'),
      deps.onPlaytest,
      'primary ed-playtest',
      t('editor.topbar.playtestTitle'),
    );
    this.root.appendChild(play);

    parent.appendChild(this.root);
  }

  setMapName(name: string): void {
    this.nameInput.value = name;
  }

  setDirty(dirty: boolean): void {
    this.dirtyDot.style.display = dirty ? '' : 'none';
  }

  setSaveState(text: string): void {
    this.saveState.textContent = text;
  }

  setSaving(saving: boolean): void {
    this.saveBtn.disabled = saving;
    if (saving) this.saveState.textContent = t('editor.topbar.saving');
  }

  setUndoDepth(depth: number): void {
    this.undoBadge.style.display = depth > 0 ? '' : 'none';
    this.undoBadge.textContent = t('editor.topbar.undoCount', { count: depth });
    this.undoBadge.title = t('editor.topbar.undoCountTitle', { count: depth });
  }

  setViewMode(mode: '3d' | '2d'): void {
    for (const [m, b] of this.viewButtons) b.classList.toggle('active', m === mode);
  }

  setOffline(offline: boolean): void {
    this.offlineBadge.style.display = offline ? '' : 'none';
    this.uploadBtn.disabled = offline;
    this.uploadBtn.title = offline
      ? t('editor.topbar.uploadAssetDisabledTitle')
      : t('editor.topbar.uploadAssetTitle');
  }

  setForkEnabled(enabled: boolean): void {
    this.forkBtn.disabled = !enabled;
    this.forkBtn.title = enabled
      ? t('editor.topbar.forkTitle')
      : t('editor.topbar.forkDisabledTitle');
  }
}
