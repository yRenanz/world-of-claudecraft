// i18n source catalog - the public Guide (docs/wiki) surface at /guide. A curated,
// branded front-of-house that explains the game, teaches the basics, and showcases
// classes, the bestiary, quests, and group content, separate from the community
// MediaWiki at /wiki. English values only; the 13 locale translations live in
// src/ui/i18n.locales/<lang>.ts (the runtime-authoritative overlays), filled by the
// maintainer at release.
//
// Assembled into `en` by ./index.ts under the `guide` namespace. Like hud_chrome.ts
// this module carries NO per-locale blocks (no `as const`), so a new Guide string is
// an English-only add that compiles; the translations live solely in the overlays.

export const guideStrings = {
  // Brand + shared chrome.
  brand: "World of ClaudeCraft",
  brandShort: "ClaudeCraft",
  tagline: "A classic-style MMO you play free in your browser.",
  skipToContent: "Skip to main content",
  loading: "Loading...",
  // Browser tab title: "{page} - {brand}". Hyphen separator (not an en dash).
  docTitle: "{page} - {brand}",
  // Label for the cross-link block at the foot of a page.
  related: "Related",

  // Top navigation + sidebar controls.
  nav: {
    overview: "Overview",
    howToPlay: "How to Play",
    classes: "Classes",
    bestiary: "Bestiary",
    world: "World",
    quests: "Quests",
    dungeons: "Dungeons & Raids",
    reference: "Reference",
    controls: "Controls",
    combat: "Combat",
    talents: "Talents",
    arena: "Arena & PvP",
    glossary: "Glossary",
    wishIKnew: "Things I Wish I Knew",
    faq: "FAQ",
    playNow: "Play Now",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    primary: "Guide sections",
    topics: "Topics",
    onThisPage: "On this page",
    backToGame: "Back to the game",
  },

  // Sidebar section groupings.
  groups: {
    start: "Get Started",
    compendium: "Compendium",
    reference: "Reference",
  },

  // Breadcrumb trail, previous/next page sequence, and the on-this-page contents.
  breadcrumb: {
    label: "Breadcrumb",
    home: "Guide",
  },
  seq: {
    label: "Page navigation",
    prev: "Previous",
    next: "Next",
  },
  toc: {
    heading: "On this page",
  },

  // Footer.
  footer: {
    blurb: "An open-source, classic-style micro-MMO. Quest, group up, and explore a hand-built world, right in your browser.",
    playNow: "Play Now",
    github: "Source on GitHub",
    discord: "Join the Discord",
    communityWiki: "Community Wiki",
    rights: "World of ClaudeCraft",
  },

  // Language picker.
  language: {
    label: "Language",
    select: "Choose a language",
  },

  // Site search (header combobox).
  search: {
    label: "Search",
    placeholder: "Search the guide",
    noResults: "No matches",
    typePage: "Page",
    typeClass: "Class",
    typeZone: "Zone",
    typeCreature: "Creatures",
    typeDungeon: "Dungeon",
    typeTerm: "Term",
  },

  // Home / overview landing.
  home: {
    eyebrow: "Classic-style browser MMO",
    title: "World of ClaudeCraft",
    subtitle: "Quest, group up, and explore a hand-built world, free in your browser.",
    ctaPlay: "Play Now",
    ctaLearn: "How to Play",

    // "What is it" benefit trio.
    what: {
      heading: "A classic MMO, made to be picked up",
      pillarPlayTitle: "Play in your browser",
      pillarPlayBody: "No download, no launcher. Make a character and you are in the world in seconds, on desktop or phone.",
      pillarClassesTitle: "Nine classes, three roles",
      pillarClassesBody: "Tank, heal, or deal the damage. Every class plays the way its archetype should, with talents to make it yours.",
      pillarOpenTitle: "Free and open source",
      pillarOpenBody: "Free to play to the level cap, with the whole game open source. No pay to win, ever.",
    },

    // Class chooser teaser.
    classes: {
      heading: "Choose your class",
      sub: "Nine classic archetypes, each with its own feel and party role.",
      cta: "Explore the classes",
    },

    // World teaser.
    world: {
      heading: "Explore the world",
      sub: "One continuous land, three zones, from quiet valleys to frozen peaks.",
      levels: "Levels {min} to {max}",
      cta: "See the world",
      valeName: "Eastbrook Vale",
      valeBlurb: "Green hills and old woods where every adventure begins.",
      marshName: "Mirefen Marsh",
      marshBlurb: "Sunken fens and tide-worn ruins, home to murlocs and worse.",
      peaksName: "Thornpeak Heights",
      peaksBlurb: "Wind-scoured ridges climbing toward the realm's coldest dangers.",
    },

    // Group content teaser.
    group: {
      heading: "Group up for the hard parts",
      sub: "The world is soloable, but the best loot waits behind a good party.",
      dungeonsTitle: "Dungeons",
      dungeonsBody: "Instanced dives for a party of five, scaling with the zones around them.",
      raidTitle: "The raid",
      raidBody: "A ten-player capstone for those who reach the top of the world.",
      arenaTitle: "The arena",
      arenaBody: "Step into the Ashen Coliseum and prove yourself against other players.",
      cta: "Dungeons and Raids",
    },

    // Short FAQ.
    faq: {
      heading: "Good to know",
      q1: "Is it free to play?",
      a1: "Yes. The whole game is free to the level cap, and it is open source on GitHub.",
      q2: "Do I need a crypto wallet?",
      a2: "No. The game is fully playable without one. The optional community token only unlocks cosmetic flair and never affects power.",
      q3: "Can I play offline?",
      a3: "Yes. There is an instant single-player mode in your browser, plus the shared online realm.",
      q4: "How long to reach max level?",
      a4: "The cap is level {cap}, reached across three zones of quests, dungeons, and exploration.",
    },

    // Community call to action.
    community: {
      heading: "Join the realm",
      body: "Jump in now, or come say hello. The world is better with company.",
      play: "Play Now",
      discord: "Join the Discord",
      github: "Star on GitHub",
    },
  },

  // How to Play / Basics (the newcomer tutorial page).
  howToPlay: {
    intro: "New to this kind of game? You will be questing in minutes. Here is the short version, one step at a time.",
    firstHeading: "Your first 15 minutes",
    step1Title: "Make a character",
    step1Body: "Pick a class and a look, give your hero a name, and enter the world. You can make more characters later.",
    step2Title: "Find your first quest",
    step2Body: "Marshal Redbrook is waiting in the starting town. Talk to him and accept Wolves at the Door.",
    step3Title: "Move and look around",
    step3Body: "Move with W, A, S, D. Hold the right mouse button and drag to look around. That is most of it.",
    step4Title: "Fight something",
    step4Body: "Press Tab to target the nearest enemy, then press your abilities on the bar (keys 1 through 0) to attack.",
    step5Title: "Turn it in",
    step5Body: "Finish the objective, return to the quest giver (look for the marker on your map), and collect your reward.",
    step6Title: "Keep going",
    step6Body: "You just hit level 2. Follow the quest trail out of town and the world opens up from there.",
    basicsHeading: "The basics",
    resourcesTitle: "Resources",
    resourcesBody: "Spells and abilities cost a resource. Warriors build Rage by fighting, rogues spend Energy that refills on its own, and everyone else casts from a pool of Mana.",
    targetingTitle: "Targeting and your bar",
    targetingBody: "Tab cycles enemies, F interacts and loots, and your action bar holds the abilities you have learned. Drag spells onto it from your spellbook.",
    questsTitle: "Quests",
    questsBody: "Accept quests from people with a marker over their head, complete the objective, and turn them in for experience, coin, and gear. The tracker on screen keeps your goals in view.",
    deathTitle: "Death is not the end",
    deathBody: "If you fall, you release your spirit at the nearest graveyard and run back to your body. No experience is lost.",
    groupingTitle: "Playing together",
    groupingBody: "Invite others to a party to share quest credit and take on dungeons. Most of the world is soloable, so grouping is a choice, not a chore.",
    onlineTitle: "Online or offline",
    onlineBody: "Play the shared online realm with everyone else, or start an instant offline world in your browser to learn the ropes.",
    reassure: "Talents unlock at level 10 and can be reset at any time, so your early choices are never permanent. Experiment freely.",
    controlsLink: "See the full controls reference",
  },

  // Controls reference (most action labels reuse the shared controls.* catalog).
  controls: {
    intro: "Default keys for desktop. Every binding can be changed in the game's options.",
    keyHeader: "Key",
    actionHeader: "Action",
    groupMovement: "Movement",
    groupCombat: "Targeting and combat",
    groupInterface: "Windows",
    groupCamera: "Camera",
    talents: "Talents",
    arena: "Arena",
    leaderboard: "Leaderboard",
    abilities: "Use abilities",
    mobileHeading: "On mobile",
    mobileBody: "Touch controls appear automatically on phones and tablets: a movement stick on the left, drag anywhere on the right to look, and on-screen buttons for your abilities and menus.",
  },

  // Combat overview. Deliberately high level: concepts, not formulas or numbers, so
  // there is nothing here to min-max or exploit.
  combat: {
    intro: "Combat follows familiar classic-MMO rules. You never need to study any of it to play well, this is just the shape of how fights work.",
    hitTitle: "Not every blow lands",
    hitBody: "Attacks can miss or be dodged, parried, and blocked, and so can the enemy's. Fighting near your own level and keeping your gear current is what makes your hits connect.",
    mitigationTitle: "Armor and gear keep you standing",
    mitigationBody: "Armor softens physical hits and the right gear blunts magic, so upgrades are your main source of staying power. Heavier armor classes shrug off more, but nothing makes you untouchable.",
    resourcesTitle: "Every class has its own rhythm",
    resourcesBody: "Warriors build Rage in the thick of a fight, rogues spend Energy that steadily returns, and casters manage a pool of Mana. Learning your resource is half of playing your class well.",
    growTitle: "You grow stronger every level",
    growBody: "Each level makes you tougher and unlocks new abilities, all the way to the cap of level {cap}. Questing is the fastest way up; dungeons and exploration round it out.",
  },

  // Glossary.
  glossary: {
    intro: "A quick reference for the terms used across this guide and in chat.",
    aggroTerm: "Aggro",
    aggroDef: "An enemy's attention. The player generating the most threat holds aggro and gets attacked.",
    threatTerm: "Threat",
    threatDef: "How much an enemy wants to attack you. The tank's job is to hold more threat than everyone else.",
    gcdTerm: "Global cooldown",
    gcdDef: "The short, shared pause after using most abilities, so you cannot fire everything at once.",
    dpsTerm: "DPS",
    dpsDef: "Damage per second, a rough measure of how fast something deals damage.",
    buffTerm: "Buff",
    buffDef: "A helpful effect on you or an ally, like a blessing that raises a stat for a while.",
    debuffTerm: "Debuff",
    debuffDef: "A harmful effect on a target, like a slow, a bleed, or weakened armor.",
    dotTerm: "DoT and HoT",
    dotDef: "Damage over time and healing over time: effects that tick in steady pulses instead of all at once.",
    ccTerm: "Crowd control",
    ccDef: "Abilities that stun, root, or otherwise take an enemy out of the fight for a moment.",
    procTerm: "Proc",
    procDef: "A chance-based effect that fires off something else, like a bonus that sometimes triggers when you attack.",
    eliteTerm: "Elite",
    eliteDef: "A tougher-than-normal enemy, usually meant for a group. Dungeon and rare enemies are often elite.",
    rareTerm: "Rare",
    rareDef: "An uncommon named enemy that wanders a zone and drops better loot.",
    mobTerm: "Mob",
    mobDef: "Any computer-controlled creature in the world, friendly or hostile. Short for mobile.",
    tankTerm: "Tank",
    tankDef: "The party member who holds enemy aggro and absorbs the damage so others can fight safely.",
    healerTerm: "Healer",
    healerDef: "The party member who keeps everyone alive with healing spells.",
    specTerm: "Spec",
    specDef: "A specialization: the path you lean your class toward, like healing or damage, as you spend talents.",
    pullTerm: "Pull",
    pullDef: "To draw an enemy or group into a fight, usually deliberately and one batch at a time.",
    instanceTerm: "Instance",
    instanceDef: "A private copy of a dungeon or raid made just for your party.",
  },

  // FAQ page (fuller than the home teaser).
  faqPage: {
    intro: "The questions new players ask most often.",
    q1: "Is it really free?",
    a1: "Yes. The whole game is free to play to the level cap, and the source code is open on GitHub.",
    q2: "Do I need a crypto wallet or any tokens?",
    a2: "No. The game is fully playable without one. The optional community token only unlocks cosmetic flair and never affects power or progression.",
    q3: "Can I play on my phone?",
    a3: "Yes. The game runs in a mobile browser with touch controls, and there is a desktop launcher as well.",
    q4: "Can I play offline or solo?",
    a4: "Yes. There is an instant single-player offline mode, and the online world is fully soloable apart from dungeons and the raid.",
    q5: "How many classes are there?",
    a5: "Nine, covering the classic tank, healer, and damage roles, each with its own resource and signature abilities.",
    q6: "What is the level cap?",
    a6: "Level {cap}, reached across three connected zones of quests, dungeons, and exploration.",
    q7: "Will my character be saved?",
    a7: "Online characters are saved on the server automatically. Offline characters live in your browser for quick sessions and testing.",
    q8: "Can I host my own copy?",
    a8: "Yes. The project is open source, so you can run your own server. See the GitHub repository.",
    q9: "Is there PvP?",
    a9: "Yes. Duel anyone for fun, or step into the Ashen Coliseum to fight other players. PvP is opt in, so you are never forced into it.",
    q10: "What is there to do at max level?",
    a10: "The cap is level {cap}. From there you run the five-player dungeons and the ten-player raid, chase better gear, and test yourself in the arena.",
    q11: "How do I find a group?",
    a11: "Invite anyone you meet to a party, ask in chat, or team up at a dungeon. Most of the world is soloable, so grouping is a choice, not a requirement.",
  },

  // Classes index + per-class pages.
  classList: {
    heading: "The nine classes",
    sub: "Tank, heal, or deal the damage. Pick the fantasy that calls to you, then make it your own with talents.",
  },
  role: {
    tank: "Tank",
    healer: "Healer",
    damage: "Damage",
  },
  resourceName: {
    rage: "Rage",
    mana: "Mana",
    energy: "Energy",
  },
  classPage: {
    back: "All classes",
    roleLabel: "Plays as",
    resourceLabel: "Resource",
    specsHeading: "Specializations",
    abilitiesHeading: "Signature abilities",
    abilitiesNote: "A taste of the kit. You learn more as you level, and talents reshape how it all plays.",
    masteryLabel: "Mastery",
    fullKitHeading: "The full kit",
    fullKitNote: "Every ability this class can learn, in the order it comes online. Talents decide which ones carry your build.",
    petsHeading: "Demons",
    petsNote: "Warlocks summon demons to fight beside them, each suited to a different job.",
  },
  // Deprecated: short fantasy hooks. The class index and class page now use the canonical
  // character-creation description (classDetails.lore.*) so there is a single source of
  // truth for each class. Kept only so existing locale overlays stay valid; not rendered.
  classHook: {
    warrior: "A relentless front-line fighter who turns every blow taken into fuel for the next.",
    paladin: "A holy warrior who can shield allies, mend their wounds, or bring the hammer down.",
    hunter: "A ranged marksman with a loyal beast at their side and a trick for every foe.",
    rogue: "A master of stealth and poisons who strikes from the shadows and never fights fair.",
    priest: "A devoted healer whose light keeps the party standing, or whose shadow unmakes the enemy.",
    shaman: "A spirit-caller who bends storm, fire, and water, and mends allies between the lightning.",
    mage: "A spellweaver of fire, frost, and arcane who controls the battlefield from afar.",
    warlock: "A dark conjurer who commands demons and curses, trading life for devastating power.",
    druid: "A shapeshifter who tanks as a bear, savages foes as a cat, or heals in the thick of it.",
  },

  // Qualitative "feel" tags for the class chooser and class headers. Relative labels, never
  // numbers (see src/guide/class_meta.ts for the per-class values).
  tag: {
    melee: "Melee",
    ranged: "Ranged",
    both: "Melee or ranged",
    solo: "Solo friendly",
    group: "Group oriented",
    flexible: "Flexible",
    simple: "Simple",
    moderate: "Moderate",
    complex: "Complex",
    goodFirst: "Great first class",
  },

  // The class chooser on the Classes index: filter the nine by how you want to play.
  chooser: {
    heading: "Find your class",
    intro: "Filter by how you like to play. Every class is viable, so this only narrows the field, it does not rank them.",
    role: "Role",
    style: "Style",
    resource: "Resource",
    complexity: "Complexity",
    goodFirst: "Good for beginners",
    clear: "Clear",
    results: "Showing {count} of {total}",
    none: "No class matches every filter. Clear one to see more.",
  },

  // One spoiler-safe, number-free line per signature ability (what it is for, when you
  // press it). Keyed by the sim ability id.
  abilityHook: {
    heroic_strike: "Queues a heavier swing that spends rage on your next hit.",
    battle_shout: "A rallying cry that raises attack power for the party.",
    commanding_shout: "Bolsters stamina so everyone has more staying power in a fight.",
    charge: "Rushes a distant enemy to open the fight with a brief stun.",
    rend: "Opens a bleed that wears the target down over time.",
    thunder_clap: "Hits everything around you and slows their attacks.",
    seal_of_righteousness: "Imbues your swings with Holy damage, then spend it with Judgement.",
    holy_light: "A steady, sizable heal for topping off an ally or yourself.",
    devotion_aura: "A lasting self-buff that raises armor so hits land softer.",
    judgement: "Spends your active Seal to strike an enemy from short range.",
    blessing_of_might: "Raises a friendly target's attack power, good to cast before a pull.",
    divine_protection: "A quick holy shield to soak damage when things get rough.",
    raptor_strike: "A hard melee swing for when something closes the gap on you.",
    aspect_of_the_hawk: "A stance you keep up to sharpen your ranged attack power.",
    serpent_sting: "Lands a venom that bleeds nature damage over time.",
    arcane_shot: "An instant shot from range for quick extra damage.",
    concussive_shot: "Dazes the target and slows it so it cannot reach you.",
    mongoose_bite: "A counterstrike that opens up right after the enemy dodges.",
    sinister_strike: "Your reliable strike that builds combo points to spend later.",
    eviscerate: "Spends your combo points to finish a target with a burst.",
    garrote: "Open from stealth with a wire that bleeds the target over time.",
    backstab: "Slip behind a target with a dagger for a hard-hitting builder.",
    gouge: "Incapacitates the target briefly so you can reposition or peel.",
    cheap_shot: "Open from stealth with a stun and a head start on combo points.",
    smite: "A holy bolt for chipping down a target from range.",
    lesser_heal: "A steady cast to top up an ally when there is time to stand still.",
    power_word_fortitude: "Raises an ally's health pool, so cast it before the pull and keep it up.",
    shadow_word_pain: "Sticks a shadow rot on a foe, then you move on while it ticks.",
    power_word_shield: "Wraps an ally in a shield that soaks hits before they land.",
    renew: "A heal that ticks over time, good to cast and keep moving.",
    lightning_bolt: "A ranged cast of Nature damage, your go-to from afar.",
    rockbiter_weapon: "Imbues your weapon so each swing lands harder in melee.",
    healing_wave: "Your main heal, a direct mend for yourself or an ally.",
    earth_shock: "An instant shock for quick Nature damage when you need it now.",
    lightning_shield: "Charges you so attackers take Nature damage when they hit you.",
    flame_shock: "An instant burn that hits up front and keeps searing over time.",
    fireball: "Your main fire nuke, lands a hit and leaves the target burning.",
    frost_armor: "A lasting self-buff that hardens your armor before a fight.",
    arcane_intellect: "Raises Intellect to deepen an ally's mana pool, cast it before the pull.",
    frostbolt: "Strikes from range and slows the target so it cannot close on you.",
    conjure_water: "Conjures drinks that restore mana, so you can refill between pulls.",
    conjure_food: "Conjures food that restores health when you sit down to eat.",
    shadow_bolt: "A bolt of shadow you cast at a target, your go-to nuke.",
    summon_imp: "Calls up an imp that flings firebolts at enemies from range.",
    demon_skin: "A lasting self-buff that toughens your skin and adds armor.",
    immolate: "Sets a target alight for an opening hit and a burn that lingers.",
    corruption: "Rots a target with shadow that ticks while you do other things.",
    life_tap: "Trades some of your own health back into mana when you run dry.",
    wrath: "A nature bolt thrown at a target from range, your go-to nuke.",
    healing_touch: "A big single-target heal with a long cast, for topping someone off.",
    mark_of_the_wild: "A lasting blessing you put on yourself or an ally before a fight.",
    moonfire: "Hits instantly and leaves the target burning, good while moving.",
    rejuvenation: "Casts instantly and heals an ally over time, so you can keep acting.",
    thorns: "Wards an ally so melee attackers hurt themselves for striking.",
  },

  // Warlock demon roster flavor, keyed by pet id.
  petHook: {
    imp: "A ranged firebolt demon that chips at enemies from a safe distance.",
    voidwalker: "A sturdy demon that taunts and soaks hits so you can cast in peace.",
    succubus: "A fast melee demon that hits hard but folds under pressure.",
    felhunter: "A shadow skirmisher that hounds enemy casters.",
    felguard: "A durable melee bruiser, the all-rounder once you can summon it.",
    infernal: "A hulking juggernaut with crushing melee, summoned for raw power.",
    doomguard: "An elite caster that rains heavy shadow from afar.",
  },

  // Bestiary.
  bestiary: {
    heading: "Bestiary",
    intro: "The creatures of the world, grouped by family. These are the foes you meet out in the open. The deadliest things wait, unlisted, behind dungeon doors.",
    rare: "Rare",
    levels: "Levels {min} to {max}",
    levelsSame: "Level {min}",
  },
  family: {
    beast: { name: "Beasts", desc: "Wild animals of forest and field, from wolves and boars to the things that prey on them. Hunters can tame many of them." },
    spider: { name: "Spiders", desc: "Web-spinners and venomous lurkers that nest in dark, tangled places." },
    murloc: { name: "Murlocs", desc: "Amphibious marsh-dwellers that swarm the shallows in noisy, territorial packs." },
    kobold: { name: "Kobolds", desc: "Candle-headed diggers that infest mines and burrows, fiercely guarding their ore." },
    humanoid: { name: "Humanoids", desc: "Bandits, cultists, and others who took up the wrong trade. They fight with tactics, not just teeth." },
    troll: { name: "Trolls", desc: "Hulking, fast-healing brutes that lair in the marsh and the high country." },
    ogre: { name: "Ogres", desc: "Enormous, slow-witted, and dangerous. They camp the high passes and hit like a landslide." },
    undead: { name: "Undead", desc: "The restless dead, raised by darker hands. They do not tire and they do not flee." },
    elemental: { name: "Elementals", desc: "Living storm and stone, bound to the wild places where the elements run strong." },
  },

  // World / zones.
  worldPage: {
    heading: "The world",
    intro: "World of ClaudeCraft is one continuous land you cross on foot, three zones laid south to north. There is no fast travel, so the journey is part of the adventure.",
    hub: "Home base",
    mapHeading: "The road north",
    mapSub: "Three zones, south to north, each a step higher in level. Follow the quest trail and the land carries you from the valley to the peaks.",
    places: "Notable places",
    residents: "Who you will meet",
    valeBlurb: "The green starting valley, where new heroes cut their teeth on wolves and bandits around the town of Eastbrook.",
    marshBlurb: "A drowned country of fog and ruins. Murlocs swarm the shallows and something older stirs beneath the water, watched from the bridge-town of Fenbridge.",
    peaksBlurb: "Wind-scoured ridges and old mine-works climbing to the realm's coldest, highest dangers, held by the outpost of Highwatch.",
  },

  // Quests.
  questsPage: {
    heading: "Quests",
    intro: "Quests are the heart of the world and the fastest way to level. Here is how they work.",
    acceptTitle: "Finding and accepting",
    acceptBody: "People with a marker over their head have work for you. Talk to them to accept a quest. Your very first is Wolves at the Door, from Marshal Redbrook in Eastbrook.",
    objectivesTitle: "Objectives",
    objectivesBody: "Slay certain enemies, gather items, or interact with something in the world. The on-screen tracker counts your progress as you go.",
    turninTitle: "Turning in",
    turninBody: "Return to the quest giver, the map shows you where, for experience, coin, and often a piece of gear chosen to suit your class.",
    partyTitle: "Questing in a group",
    partyBody: "Party members nearby share kill and objective credit, so questing together is faster, never slower.",
    storyTitle: "A thread runs through it all",
    storyBody: "From your first errands in Eastbrook, something is wrong with the dead. A cult is at work, and the trail leads north through every zone. Follow it to learn who stands behind it.",
    soloNote: "The main story is fully soloable; only its final chapters call for a group.",
  },

  // Dungeons and Raids.
  dungeonsPage: {
    heading: "Dungeons and Raids",
    intro: "When the open world is not enough, gather a party and step into an instance: a private copy of a dungeon made just for your group.",
    party: "Dungeons are built for a party of five. The endgame raid is for ten.",
    soloLead: "Every dungeon opens with a soloable lead-in quest, so you always know why you are going in.",
    levelAround: "Around level {n}",
    levelExact: "Level {n}",
    levelBand: "Levels {min} to {max}",
    partySize: "{n} players",
    raidSize: "Ten players, level {n}",
    hollowName: "The Hollow Crypt",
    hollowBody: "A grave-robbed chapel crypt where the newly dead refuse to rest. The first real test of a new party.",
    bastionName: "The Sunken Bastion",
    bastionBody: "A flooded fortress lost to the marsh, held by drowned defenders and the rising tide itself.",
    templeName: "The Drowned Temple",
    templeBody: "A sunken shrine off the marsh road, a side-path for the curious and the well-prepared.",
    sanctumName: "Gravewyrm Sanctum",
    sanctumBody: "The dark heart of Thornpeak, where the cult's long work reaches its terrible peak.",
    raidName: "The endgame raid",
    raidBody: "Beyond a sealed royal door waits a ten-player trial: a multi-phase fight and a deathless power the whole raid must shut down together. Earn your way in, then bring nine friends.",
  },

  // Talents and Specializations reference.
  talentsPage: {
    heading: "Talents and specializations",
    intro: "Talents are how you make a class your own. They are optional, forgiving, and easy to change, so you can experiment without fear.",
    whatHeading: "What talents do",
    whatBody: "As you level, you earn talent points to spend on small, permanent upgrades to your abilities and stats. They shape how a class feels, leaning it toward more damage, sturdier defense, or stronger healing.",
    howHeading: "How they work",
    howBody: "Talents open up at level 10, and you keep earning points as you climb to the cap. You spend them in your class's talent panel, and you can save more than one layout to swap between builds.",
    resetTitle: "Nothing is permanent",
    resetNote: "You can reset your talents at any time, so an early pick is never a trap. Try things, see what you like, and change your mind freely.",
    specsHeading: "Specializations by class",
    specsBody: "Every class has a handful of specializations, each with its own role and a signature focus. Here is the shape of all of them. Open a class for its full kit.",
  },

  // Arena and PvP.
  arenaPage: {
    heading: "Arena and PvP",
    intro: "Want to test yourself against other players? Player versus player is built in, and it is always something you choose, never something forced on you.",
    duelsHeading: "Duels",
    duelsBody: "Challenge any player you meet to a friendly duel. Nothing is on the line but pride, so it is the easiest way to learn a matchup or settle a friendly argument.",
    coliseumHeading: "The Ashen Coliseum",
    coliseumBody: "The Coliseum is the realm's arena, where you face other players in ranked matches. Win and your standing climbs, and the strongest fighters rise up the leaderboard for everyone to see.",
    fiestaHeading: "Two versus two Fiesta",
    fiestaBody: "Fiesta is a fast, two-on-two mode played in short rounds. Between rounds you draft augments, quick boosts that reshape your kit on the fly, so no two matches play quite the same.",
    augmentsNote: "Augments and power-ups last only for the match. They are about playful, on-the-spot builds, not lasting power, so nobody buys their way to a win.",
    ladderHeading: "Climbing the ladder",
    ladderBody: "Ranked play tracks your standing over time. Check the leaderboard to see where you sit and who holds the top of the realm.",
  },

  // "Things I Wish I Knew" beginner page.
  wishPage: {
    heading: "Things I wish I knew",
    intro: "A few honest truths that save new players a lot of second-guessing. None of it is required reading, but all of it helps.",
    i1Title: "You cannot pick a wrong class",
    i1Body: "Every class can hold its own and reach the cap. Choose the fantasy you like, not the one someone else calls best.",
    i2Title: "Dying barely costs you",
    i2Body: "When you fall, you release at a graveyard and run back to your body. No experience is lost, so it is safe to take risks and learn.",
    i3Title: "Talents are not a trap",
    i3Body: "They unlock at level 10 and reset whenever you want, so your early choices are never permanent.",
    i4Title: "Follow the quest trail",
    i4Body: "Quests are the fastest way to level and they lead you across the world. When you are unsure where to go, find the next marker.",
    i5Title: "Keep your gear current",
    i5Body: "A fresh upgrade does more for you than perfect play in old gear. Take the quest rewards that suit your class.",
    i6Title: "Grouping is a choice, not a chore",
    i6Body: "Most of the world is soloable. Team up for dungeons and the raid, or just when you want some company.",
    i7Title: "Learn your resource",
    i7Body: "Rage, mana, or energy, managing it well is half of playing your class. Watch that bar, not only your cooldowns.",
    i8Title: "Rest between fights",
    i8Body: "Eat and drink to recover quickly, especially as a caster. A few seconds now saves a death later.",
  },

  // Generic placeholder for sections still being written (build scaffolding).
  placeholder: {
    note: "This part of the guide is on its way.",
  },

  // 404 / unknown route.
  notFound: {
    title: "We could not find that page",
    body: "The page you were looking for does not exist or may have moved.",
    home: "Back to the overview",
  },
};
