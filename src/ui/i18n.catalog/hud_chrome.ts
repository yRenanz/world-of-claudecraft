// i18n source catalog - in-game HUD chrome strings that were previously hard-coded
// at their call sites (emote wheel/editor, swing timer, rest indicator, mobile
// controls, minimap/compass/clock widgets, DPS/HPS meters formatting). English
// values only; the 13 locale translations live in src/ui/i18n.locales/<lang>.ts
// (the runtime-authoritative overlays), filled by the maintainer at release.
//
// Assembled into `en` by ./index.ts under the `hudChrome` namespace. Kept as its
// own module (no per-locale blocks) so new chrome keys are an English-only add.

export const hudChromeStrings = {
  // Overhead emote display names (wheel tooltips/labels, editor items, overhead
  // bubble text). Source ids/order mirror OVERHEAD_EMOTES in world_api.ts.
  emotes: {
    wave: "Wave",
    laugh: "LOL",
    question: "Bro?",
    cheer: "Cheer",
    dance: "Dance",
    point: "Point",
    flex: "Flex",
    salute: "Salute",
    cry: "Cry",
    bow: "Bow",
    clap: "Clap",
    roar: "Roar",
    kneel: "Kneel",
  },
  emoteWheel: {
    edit: "Edit",
    label: "Emotes",
  },
  emoteEditor: {
    title: "Emotes",
    done: "Done",
  },
  chatTimestamps: {
    show: "Show Chat Timestamps",
    format: "Timestamp Format",
    clock12h: "12-hour",
    clock24h: "24-hour",
    note: "Prefixes each new chat line with the time it arrived, e.g. [14:32]. Only affects messages received while the option is on.",
  },
  swing: {
    ready: "Swing",
    seconds: "{seconds}s",
  },
  rest: {
    resting: "Resting",
  },
  // On-screen / mobile control labels and their accessible names. char/bags/music
  // reuse existing keys (hud.keybinds.actions.*, hud.options.music) at the call site.
  mobile: {
    autorun: "Autorun",
    jump: "Jump",
    leaderboard: "Ranks",
    nameplates: "Names",
    haptics: "Haptics",
    hapticsOff: "Haptics Off",
    toggleHaptics: "Toggle haptics",
  },
  // Minimap / compass / clock / coordinate widget tooltips and accessible names.
  widgets: {
    clockTitle: "Local time - click to toggle 12/24-hour",
    worldCoordinates: "World coordinates",
    coordinates: "Coordinates",
    heading: "Heading",
    minimapZoom: "Minimap zoom",
  },
  // Eight-point compass abbreviations as drawn on the heading strip. Each locale
  // overrides with its own established compass abbreviations (e.g. West = "O" in
  // Spanish, "O" in French/Italian/Portuguese, "З" in Russian).
  compass: {
    N: "N",
    NE: "NE",
    E: "E",
    SE: "SE",
    S: "S",
    SW: "SW",
    W: "W",
    NW: "NW",
  },
  // DPS/HPS/threat meter number + unit formatting (the digits themselves go
  // through formatNumber; these carry the localizable unit/parenthesization).
  meters: {
    perSecond: "{value}/s",
    perSecondRow: "{total} ({rate})",
    minutesSeconds: "{m}m {s}s",
    seconds: "{s}s",
  },
};
