// i18n source catalog - the map editor surface at /editor. English values only;
// the locale translations live in src/ui/i18n.locales/<lang>.ts (the
// runtime-authoritative overlays), filled by the maintainer at release (the five
// non-Latin locales are filled in the same change per the M16 gate).
//
// Assembled into `en` by ./index.ts under the `editor` namespace. Like guide.ts
// and hud_chrome.ts this module carries NO per-locale blocks (no `as const`), so
// a new editor string is an English-only add that compiles; the translations
// live solely in the overlays.

export const editorStrings = {
  appTitle: 'Map Editor',
  // Browser tab title. Hyphen separator (not a dash character).
  docTitle: 'Map Editor - World of ClaudeCraft',
  untitledMap: 'Untitled Map',
  // The offline character name a playtest boots with.
  playtestPlayerName: 'Mapmaker',

  topbar: {
    label: 'Editor actions',
    mapNameLabel: 'Map name',
    dirty: 'Unsaved changes',
    dirtyDot: 'This map has unsaved changes',
    clean: 'All changes saved',
    savedLocal: 'Saved in this browser',
    savedServer: 'Saved to server (v{version})',
    saving: 'Saving...',
    neverSaved: 'Not saved yet',
    new: 'New',
    newTitle: 'Start a new map from the built-in world',
    open: 'Open',
    openTitle: 'Open a saved map (browser or server)',
    save: 'Save',
    saveTitle: 'Save to this browser, and to the server when signed in (Ctrl+S)',
    saveAs: 'Save As',
    saveAsTitle: 'Save a copy under a new name',
    fork: 'Fork',
    forkTitle: 'Create your own server-side copy of this map',
    forkDisabledTitle: 'Open a server map first to fork it',
    import: 'Import',
    importTitle: 'Import a map from a JSON file',
    export: 'Export',
    exportTitle: 'Download this map as a JSON file',
    uploadAsset: 'Upload Asset',
    uploadAssetTitle: 'Upload a GLB model (up to 8 MiB) to place in your maps',
    uploadAssetDisabledTitle: 'Sign in from the game to upload assets',
    playtest: 'Playtest',
    playtestTitle: 'Boot the game on this map (offline, current edits included)',
    viewLabel: 'View mode',
    view3d: '3D',
    view3dTitle: 'Edit in the rendered world',
    view2d: '2D',
    view2dTitle: 'Edit on the symbolic overhead map',
    undoCount: 'Undo: {count}',
    undoCountTitle: '{count} undoable steps (Ctrl+Z to undo, Ctrl+Y to redo)',
    offline: 'Offline',
    offlineTitle:
      'Not signed in: maps save to this browser only. Sign in from the game to save online.',
    signIn: 'Sign in',
    signInTitle: 'Open the game login screen in a new tab',
  },

  tool: {
    listLabel: 'Editor tools',
    keyHint: '{name} ({key})',
    select: 'Select',
    raise: 'Raise',
    lower: 'Lower',
    smooth: 'Smooth',
    flatten: 'Flatten',
    paint: 'Paint Biome',
    water: 'Water',
    place: 'Place Asset',
    camp: 'Camp',
    spawn: 'Spawn Point',
    region: 'Region',
    erase: 'Erase',
  },

  inspector: {
    label: 'Tool options',
  },

  brush: {
    title: 'Brush',
    size: 'Brush size',
    strength: 'Strength',
    sizeHint: 'Keys: [ and ] resize the brush; Shift+[ and Shift+] change strength.',
  },

  biome: {
    title: 'Biome',
    paletteLabel: 'Biome to paint',
    vale: 'Vale',
    marsh: 'Marsh',
    peaks: 'Peaks',
    beach: 'Beach',
    desert: 'Desert',
    volcano: 'Volcano',
    cave: 'Cave',
    erase: 'Erase paint',
    hint: 'Painted cells override the zone biome for terrain shape and color.',
    clear: 'Clear all biome paint',
    clearConfirm: 'Remove every painted biome cell from this map?',
  },

  flatten: {
    hint: 'Flatten levels the ground to the height under the cursor when the drag starts.',
    hardEdge: 'Hard edge',
  },

  water: {
    title: 'Water Level',
    level: 'Water level',
    hint: 'Sets the map-wide water surface height, from {min} to {max} yards.',
    reset: 'Reset to the built-in level',
  },

  place: {
    title: 'Place Asset',
    scale: 'Scale',
    collide: 'Blocks movement',
    collideHint: 'A blocking asset gets a collision footprint players cannot walk through.',
    randomRotation: 'Random rotation',
    chosen: 'Placing: {name}',
    none: 'Pick an asset from the browser below, then click the ground to place it.',
  },

  camp: {
    title: 'Mob Camp',
    mob: 'Mob',
    count: 'Count',
    radius: 'Radius',
    delete: 'Delete camp',
    hint: 'Click open ground to add a camp, or click an existing camp to edit it.',
    playtestNote: 'Mobs spawn only in playtest, never in the editor view.',
    selected: 'Camp: {mob}',
    none: 'No camp selected.',
  },

  spawn: {
    title: 'Spawn Point',
    hint: 'Click the ground to set where playtest drops the player.',
    position: 'Spawn: {x}, {z}',
    unset: 'Using the built-in start position.',
    clear: 'Clear spawn point',
  },

  region: {
    title: 'Region',
    hint: 'Drag a box to select placements and terrain edits. Copy, then click to paste.',
    hint3d: 'Region boxes draw in the 2D view; copy and paste work in both views.',
    copy: 'Copy region',
    pasteBeside: 'Paste beside',
    copied: 'Copied {assets} assets and {edits} terrain edits.',
    pasted: 'Pasted {count} items.',
    needBox: 'Draw a region box first.',
    needClipboard: 'Copy a region first.',
  },

  eraseTool: {
    title: 'Erase',
    hint: 'Click a placed asset to remove it, or click sculpted ground to remove the newest stamp under the cursor.',
  },

  selection: {
    title: 'Selection',
    none: 'Nothing selected. Use Select and click a placed asset.',
    asset: 'Asset: {name}',
    x: 'X',
    z: 'Z',
    rotation: 'Rotation',
    scale: 'Scale',
    collide: 'Blocks movement',
    footprints: 'Show collision footprints',
    duplicate: 'Duplicate',
    delete: 'Delete',
    deleteHint: 'Delete removes the selection; Ctrl+Z restores it.',
  },

  marker: {
    title: 'Marker',
    reset: 'Reset position',
    moved: '{count} markers moved from the built-in layout.',
  },

  layers: {
    title: 'Layers',
    hub: 'Hubs',
    graveyard: 'Graveyards',
    lake: 'Lakes',
    poi: 'Points of interest',
    camp: 'Camps',
    npc: 'NPCs',
    object: 'Objects',
  },

  frame: {
    title: 'Frame',
    all: 'All',
  },

  procgen: {
    title: 'Procedural',
    count: 'Count',
    scatter: 'Scatter category assets',
    hills: 'Generate rolling hills',
    scattered: 'Scattered {count} assets from {category}.',
    hillsAdded: 'Added {count} hills.',
    noAssets: 'No assets in that category.',
  },

  assets: {
    title: 'Asset Browser',
    label: 'Asset browser',
    search: 'Search assets',
    searchPlaceholder: 'Search assets...',
    empty: 'No matching assets.',
    uploadedTab: 'Uploaded',
    uploadedEmpty: 'No uploaded assets yet. Use Upload Asset to add a GLB model (up to 8 MiB).',
    uploadedSignIn: 'Sign in from the game to upload and place your own GLB models.',
    uploadedLoadFailed: 'Could not load your uploaded assets.',
    deleteAsset: 'Delete uploaded asset',
    deleteAssetConfirm: 'Delete the uploaded asset "{name}"? Maps that use it lose the model.',
    pick: 'Place {name}',
    categoryTab: '{category} ({count})',
    category: {
      biome: 'Biome',
      chars: 'Characters',
      creatures: 'Creatures',
      dungeon: 'Dungeon',
      foliage: 'Foliage',
      props: 'Props',
      quest: 'Quest',
      resources: 'Resources',
      tools: 'Tools',
      weapons: 'Weapons',
    },
  },

  upload: {
    notGlb: 'Pick a .glb file.',
    tooLarge: 'That file is over the 8 MiB limit.',
    uploading: 'Uploading asset...',
    uploaded: 'Asset uploaded: {name}',
    uploadedExisting: 'That model was already on the server; reusing it.',
    deleted: 'Uploaded asset deleted.',
  },

  openDrawer: {
    title: 'Open Map',
    close: 'Close',
    tabLocal: 'This Browser',
    tabMine: 'My Server Maps',
    tabPublic: 'Public Maps',
    colName: 'Name',
    colUpdated: 'Updated',
    colStatus: 'Status',
    statusPublic: 'Public',
    statusPrivate: 'Private',
    open: 'Open',
    fork: 'Fork',
    publish: 'Publish',
    unpublish: 'Unpublish',
    delete: 'Delete',
    draft: 'Autosaved draft',
    emptyLocal: 'No maps saved in this browser yet. Save one and it appears here.',
    emptyMine: 'No maps on the server yet. Save while signed in to create one.',
    emptyPublic: 'No public maps yet.',
    loading: 'Loading maps...',
    loadFailed: 'Could not load maps from the server.',
    signInHint: 'Sign in from the game to browse, save, and fork server maps.',
    deleteLocalConfirm: 'Delete the local map "{name}"?',
    deleteServerConfirm: 'Delete the server map "{name}"? This cannot be undone.',
    prev: 'Previous page',
    next: 'Next page',
    page: 'Page {page}',
  },

  status: {
    savedLocal: 'Saved "{name}" to this browser.',
    savedServer: 'Saved "{name}" to the server (v{version}).',
    savedLocalOnly: 'Saved "{name}" to this browser. Sign in to save online.',
    saveFailedLocal: 'Local save failed (storage blocked).',
    opened: 'Opened "{name}".',
    imported: 'Imported "{name}".',
    importFailed: 'Import cancelled, or the file is not a valid map.',
    exported: 'Downloaded "{name}".',
    newMap: 'New map started from the built-in world.',
    forked: 'Forked to "{name}". You are editing your own copy now.',
    published: 'Map published. Anyone can now find and fork it.',
    unpublished: 'Map unpublished.',
    deleted: 'Map deleted.',
    assetPlacedFirst: 'Pick an asset in the browser first.',
    playtestLaunch: 'Launching playtest...',
    playtestFailed: 'Could not start the playtest (storage blocked).',
    draftSaved: 'Draft autosaved.',
    draftRestored: 'Restored the autosaved draft.',
  },

  confirm: {
    ok: 'OK',
    cancel: 'Cancel',
    discardTitle: 'Discard changes?',
    discardBody: 'You have unsaved changes on "{name}". Discard them?',
    discard: 'Discard',
    conflictTitle: 'Save conflict',
    conflictBody:
      'This map changed on the server since you opened it (now v{version}). Save your version as a new copy?',
    conflictSaveCopy: 'Save As Copy',
  },

  prompt: {
    saveAsTitle: 'Save As',
    nameLabel: 'New map name',
  },

  // Server error codes ({error: 'snake_case'}) mapped client-side to these keys.
  serverError: {
    invalid_map_name:
      'That map name is not allowed. Use letters, numbers, spaces, apostrophes, or hyphens.',
    map_name_not_allowed: 'That map name is not allowed.',
    invalid_map_doc: 'The server rejected the map document.',
    invalid_version: 'The save request was malformed. Reload and try again.',
    map_limit_reached: 'You have reached the server map limit. Delete a map to save more.',
    map_not_found: 'That map no longer exists on the server.',
    version_conflict: 'The map changed on the server since you opened it.',
    slug_unavailable: 'The server could not make a link for that name. Try a different name.',
    map_too_large: 'The map document is too large to save on the server.',
    invalid_glb: 'That file is not a valid GLB model.',
    asset_blocked: 'That asset has been blocked by moderation.',
    asset_limit_reached: 'You have reached the uploaded asset limit. Delete one to upload more.',
    asset_storage_limit_reached: 'You are out of asset storage space. Delete an asset first.',
    asset_too_large: 'That model is over the upload size limit.',
    asset_not_found: 'That asset no longer exists on the server.',
    rate_limited: 'Slow down a little and try again.',
    unauthorized: 'Your session has expired. Sign in from the game again.',
    network: 'Could not reach the server. Check your connection and try again.',
    unknown: 'Something went wrong talking to the server.',
  },

  hints: {
    nav3d: 'Drag to orbit, scroll to zoom. While dragging, WASD flies and Q/E changes height.',
    nav2d: 'Drag to pan, scroll to zoom.',
  },

  a11y: {
    stage: 'Map viewport',
    toasts: 'Editor notifications',
    dialog: 'Editor dialog',
  },
};
