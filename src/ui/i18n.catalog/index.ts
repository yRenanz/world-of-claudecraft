// i18n source catalog barrel. Assembles the authoritative English `en` object from
// the per-domain modules and exports the catalog public surface + the key-shape types
// (Leaves, EnTranslations, TranslationKey, ...). This file was src/ui/i18n.en.ts before
// the i18n.catalog domain split; importers resolve './i18n.catalog' to this index.

import { worldEntityText as worldNames } from '../world_entity_i18n';
import { shellStrings } from './shell';
import { hudStrings } from './hud';
import { abilityStrings, classAbilityNames } from './abilities';
import { questStrings } from './quests';
import { itemStrings, itemNames } from './items';
import { mergeStrings, mergeEntities, mergeExtra } from './merge';
import { gameStrings } from './game';

// Re-export the catalog public surface (every name the old i18n.en.ts exported).
export { shellStrings } from './shell';
export { hudStrings } from './hud';
export { abilityStrings, classAbilityNames } from './abilities';
export { questStrings } from './quests';
export { itemStrings, itemNames } from './items';
export { mergeStrings, mergeEntities, mergeExtra } from './merge';
export {
  gameStrings, gameStringsEnCA, gameStringsEs, gameStringsEsES, gameStringsFrFR,
  gameStringsFrCA, gameStringsItIT, gameStringsDeDE, gameStringsZhCN, gameStringsZhTW,
  gameStringsKoKR, gameStringsJaJP, gameStringsPtBR, gameStringsRuRU,
} from './game';

type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
type Join<K, P> = K extends string | number
  ? P extends string | number
    ? `${K}${"" extends P ? "" : "."}${P}`
    : never
  : never;

export type Leaves<T, D extends number = 5> = [D] extends [never]
  ? never
  : T extends object
  ? { [K in keyof T]-?: Join<K, Leaves<T[K], Prev[D]>> }[keyof T]
  : "";

export const en = {
  meta: { builtOn: "Built {date}" },
  realmTypes: { normal: "Normal", pvp: "PvP", rp: "RP", rpPvp: "RP-PvP" },
  game: gameStrings,
  nav: {
    home: "Home",
    play: "Play",
    stats: "Statistics",
    about: "About",
    highscores: "High Scores",
    wiki: "Wiki",
    news: "News",
    download: "Download",
    loginRegister: "Login/Register",
    donate: "Donate",
  },
  stats: {
    title: "Realm Status",
    accountsCreated: "Players",
    playersOnline: "Players Online",
    realmName: "Realm Name",
  },
  footer: {
    copyright: "2026 World of ClaudeCraft",
    githubLink: "https://github.com/levy-street/world-of-claudecraft",
    githubLabel: "Open Source Project",
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    discordLabel: "Join the Discord",
  },
  settings: {
    languageLoading: "Loading language...",
    languageLoadFailed: "Could not load that language. Keeping your current language.",
    languageLoadUnavailable: "That language is not available.",
  },
  highscores: {
    title: "High Scores Leaderboard",
    desc: "Track the realm's greatest champions and compare your progress.",
  },
  wiki: {
    title: "Game Wiki & Guide",
    desc: "Discover the secrets of the realm, class guides, and strategies.",
    cta: "Browse the Wiki",
  },
  news: {
    title: "News & Updates",
    desc: "Read the latest patch notes, events, and community updates.",
    loading: "Loading the latest updates…",
    error: "Couldn't load updates. Please try again later.",
    empty: "No updates yet — check back soon.",
    prerelease: "Pre-release",
    viewOnGithub: "View on GitHub",
  },
  download: {
    title: "Download Desktop Launcher",
    desc: "Get the standalone launcher for optimized performance and full-screen play.",
  },
  comingSoon: {
    placeholder: "Coming Soon...",
    featureComingSoon: "This feature is coming soon to the realm.",
  },
  mode: {
    onlineTitle: "Play Online",
    onlineDesc: "Log in to the realm. Your characters live on the server and you share the world with everyone else who's on.",
    onlineAria: "Play Online: log in to the persistent shared realm",
    offlineTitle: "Play Offline",
    offlineDesc: "Instant single-player world in your browser. Nothing is saved: perfect for a quick brawl or testing.",
    offlineAria: "Play Offline: start an instant local single-player session",
    tipTitle: "TIP:",
    tipText: "For the smoothest experience, turn off ad blocker extensions on this site. Community reports found some blockers can cause lag.",
    serverOnline: "Online",
    serverOffline: "Offline",
    play: "Play",
    playAria: "Play World of ClaudeCraft",
    serverLabel: "Choose your realm",
    serverAria: "Select realm: Online or Offline",
    serverOfflineSub: "Instant local world",
    caLabel: "$WOC Contract Address",
    caCopyAria: "Copy contract address",
    caNote: "WOC is our community token. It is not needed to play. Join Discord to discuss the WOC utility and flywheel.",
  },
  auth: {
    enterRealm: "Enter the Realm",
    username: "Username",
    usernameError: "Please enter your username.",
    usernamePlaceholder: "Enter username",
    password: "Password",
    passwordError: "Please enter your password.",
    passwordPlaceholder: "Enter password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    logIn: "Log In",
    createAccount: "Create Account",
    back: "Back",
    realmList: "Realm List",
    loadingRealms: "Loading realms...",
    changeRealm: "Change Realm",
    realm: "Realm",
    newCharacter: "New Character",
    appearance: "Appearance",
    class: "Class",
    name: "Name",
    chromaOption: "Chroma {n}",
    noAccountPrompt: "New to the realm?",
    haveAccountPrompt: "Already have an account?",
    characters: "Characters:",
    createCharacter: "Create Character",
    characterName: "Character Name",
    characterNamePlaceholder: "Character name",
    enterWorld: "Enter World",
    offlineCharacter: "Offline Character",
    create: "Create",
  },
  classes: {
    warrior: "Warrior",
    paladin: "Paladin",
    hunter: "Hunter",
    rogue: "Rogue",
    priest: "Priest",
    shaman: "Shaman",
    mage: "Mage",
    warlock: "Warlock",
    druid: "Druid",
    warriorAria: "Warrior class",
    paladinAria: "Paladin class",
    hunterAria: "Hunter class",
    rogueAria: "Rogue class",
    priestAria: "Priest class",
    shamanAria: "Shaman class",
    mageAria: "Mage class",
    warlockAria: "Warlock class",
    druidAria: "Druid class",
  },
  controls: {
    title: "Controls Guide",
    movement: "Movement",
    moveTurn: "Move / Turn",
    strafe: "Strafe Left/Right",
    jump: "Jump",
    autorun: "Toggle Autorun",
    combat: "Combat & Interaction",
    target: "Target Enemy",
    spells: "Cast Spells",
    interact: "Interact / Loot",
    nameplates: "Toggle Nameplates",
    camera: "Camera & Mouse",
    rightDrag: "Right-Drag",
    leftDrag: "Left-Drag",
    mouseWheel: "Mouse Wheel",
    mouselook: "Mouselook",
    orbit: "Orbit Camera",
    zoom: "Zoom",
    interfaces: "Interfaces",
    charPane: "Character Pane",
    spellbook: "Spellbook",
    questLog: "Quest Log",
    worldMap: "World Map",
    bags: "Bags Inventory",
    emoteWheel: "Hold Emote Wheel",
    friends: "Friends & Guild",
    chat: "Open Chat",
  },
  ...shellStrings.en,
  ...hudStrings.en,
  ...abilityStrings.en,
  ...questStrings.en,
  ...itemStrings.en,
  ...classAbilityNames.en,
  ...itemNames.en,
  ...worldNames.en,
  ...mergeStrings.en,
  entities: {
    ...itemNames.en.entities,
    ...worldNames.en.entities,
    abilities: { ...itemNames.en.entities.abilities, ...mergeExtra.en.abilities },
    items: {
      ...itemNames.en.entities.items,
      ...mergeEntities.en.items,
      ...mergeExtra.en.items,
      the_codfather: { name: "The Codfather" },
      runed_bone_shard: { name: "Runed Bone Shard" },
      grave_sir_aldren: { name: "Grave of Captain Aldren" },
      grave_high_priest_malric: { name: "Grave of High Priest Malric" },
      grave_captain_voss: { name: "Grave of Royal Assassin Voss" },
      ancient_crypt_door: { name: "Ancient Crypt Door" },
      captains_crest: { name: "Crypt Keystone Upper" },
      priests_sigil: { name: "Crypt Keystone Lower" },
      royal_seal: { name: "Ancient Diary" },
      crypt_keystone: { name: "Crypt Keystone" },
      crypt_ritual_circle: { name: "Ritual Circle" },
      kings_signet: { name: "King's Signet" },
    },
    mobs: { ...worldNames.en.entities.mobs, ...mergeEntities.en.mobs, ...mergeExtra.en.mobs },
    npcs: { ...worldNames.en.entities.npcs, ...mergeExtra.en.npcs },
    quests: { ...worldNames.en.entities.quests, ...mergeEntities.en.quests, ...mergeExtra.en.quests },
    dungeons: { ...worldNames.en.entities.dungeons, ...mergeExtra.en.dungeons },
  },
};

// The authoritative en shape. The generated dense table
// (the per-locale slices under src/ui/i18n.resolved.generated/) types every locale
// ": EnTranslations" so tsc still red-fails any missing or renamed key.
export type EnTranslations = typeof en;

// Depth 6 so the deepest real leaves (entities.quests.<id>.objectives.<n>.label,
// entities.zones.<id>.pois.<n>.label) are members. The sparse overlays are typed
// `Partial<Record<TranslationKey, string>>`, so TranslationKey must reach
// every overlay key; depth 5 stopped one segment short. (Measured: no tsc cost.)
export type TranslationKey = Leaves<typeof en, 6>;
export type InterpolationValue = string | number;
export type InterpolationValues = Record<string, InterpolationValue>;

// Deep-partial of the authoritative en shape. Non-English locales are dense
// ": typeof en" objects today; they are later relaxed to DeepPartial overlays.
export type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;
