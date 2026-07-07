// Mobile HUD overlap audit for World of ClaudeCraft.
//
// PURPOSE
//   Sibling gate to mobile_cluster_layout_check.mjs. The cluster check gates the
//   thumb-control clusters in isolation; this audit gates the FULL populated HUD:
//   the unit frames, buff/debuff bars, minimap, quest tracker, meters, and the
//   pop-up windows, all with real state (a 4-member party, a forced target, a
//   populated buff bar). It measures REAL getBoundingClientRect geometry (never
//   CSS text) with the shared gap math in ./lib/overlap_geometry.mjs.
//
// TWO PASSES
//   A) Persistent-chrome pass (STRICT, the repeatable pre-release gate): per
//      device profile it builds a party, forces a target (so #party-frames gains
//      the .below-target offset), populates the buff bar, then pairwise-checks
//      the always-on chrome (#target-frame, #party-frames, #buff-bar, #debuff-bar,
//      #minimap-wrap, #quest-tracker, #player-frame, #meters-window) against each
//      other and against the thumb controls. Chrome-vs-chrome readability pairs
//      need gap >= 0; any pair where one element is interactive needs gap >= 4.
//      Violations exit 1 by default (like the cluster check).
//   B) Window-open matrix (AUDIT mode by default: report + screenshots, exit 0;
//      pass --gate to make its violations exit 1 too). For each HUD window toggle
//      it opens the window, asserts the box is fully on-screen and its close
//      control is >= 40px and on-screen, then closeAll() and asserts the
//      body.mobile-window-open class clears. The vendor+bags co-open pair is a
//      special case (windows legitimately cover chrome otherwise, so window-over-
//      chrome overlap is NOT flagged here except that pair).
//
// USAGE
//   Needs a dev server. URL overrides the target (default http://localhost:5173/):
//     URL=http://localhost:5174/ node scripts/mobile_hud_overlap_audit.mjs
//     URL=http://localhost:5174/ node scripts/mobile_hud_overlap_audit.mjs --gate
//   Pass A runs the full six-profile sweep; pass B runs the window matrix at
//   844x390 (every window) plus 932x430 and 1280x720 spot-checks, to keep runtime
//   sane. Screenshots land in tmp/mobile-hud-audit/ under the worktree (git-ignored).
import { mkdirSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';
import { enterOfflineGame } from './enter_offline_game.mjs';
import { controlGap, PROFILES } from './lib/overlap_geometry.mjs';

const URL = process.env.URL || 'http://localhost:5173/';
const GATE = process.argv.includes('--gate');
// Opt-in full sweep (env MATRIX_ALL=1): Pass B runs EVERY window toggle (and the
// vendor+bags co-open) at EVERY profile in PROFILES, instead of each window's own
// short `widths` list. Default (unset) keeps the exact per-window widths below.
const MATRIX_ALL = process.env.MATRIX_ALL === '1';
const SHOT_DIR = 'tmp/mobile-hud-audit';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IGNORED_CONSOLE = /502|Bad Gateway|fetch project stats/i;

// The thumb controls (measured as neighbours of the chrome in pass A). Same set
// the cluster check measures; here they are the interactive neighbours the
// always-on chrome must not crowd.
const CONTROL_IDS = [
  'mobile-action-attack',
  'mobile-target-cycle',
  'mobile-action-page-toggle',
  'mobile-autorun',
  'mobile-interact',
  'mobile-jump',
  'mobile-chat',
  'mobile-social',
  'mobile-more',
  'mobile-consumables-toggle',
];

// Always-on chrome measured in pass A. Frames/bars are readability surfaces;
// #minimap-wrap hosts the interactive zoom buttons so it counts as interactive.
const CHROME_IDS = [
  'target-frame',
  'party-frames',
  'buff-bar',
  'debuff-bar',
  'minimap-wrap',
  'quest-tracker',
  'player-frame',
  'meters-window',
];

// Interactive classification for the >= 4px vs >= 0px rule. The thumb ring
// controls plus minimap-zoom / minimap-wrap are things a finger taps; frames and
// bars are read, not tapped, so two of them only need to not visually collide.
const INTERACTIVE_IDS = new Set([...CONTROL_IDS, 'minimap-wrap']);
// Toggled overlay PANELS (class="panel", not always-on chrome): the player opens
// #meters-window deliberately and it has its own close button, so like a Pass-B
// window it may legitimately sit over the passive readability frames/bars when the
// short-landscape viewport has no other room. It is therefore NOT hard-failed for
// overlapping a readability surface (that pair is NOTED), but it still MUST stay
// clear of the interactive thumb controls and the minimap (an overlay must never
// cover a tap target) and stay on-screen: those pairs keep the normal >= 4px rule.
const OVERLAY_CHROME_IDS = new Set(['meters-window']);
// The ring controls are true circles (border-radius: 50% clips the hit-test too),
// so their mis-tap distance is centre-to-centre minus radii, not box separation.
const CIRCLE_IDS = new Set([
  'mobile-action-attack',
  'mobile-target-cycle',
  'mobile-interact',
  'mobile-action-page-toggle',
  'mobile-autorun',
  'mobile-jump',
]);

const TOUCH_FLOOR = 40;
const MIN_GAP_INTERACTIVE = 4; // px between any pair where one element is interactive
const MIN_GAP_CHROME = 0; // chrome-vs-chrome only needs to not visually overlap

// The window toggles to sweep in pass B, each with the window id it opens and the
// viewport widths to test it at. Every window runs at 844x390; a couple of the
// larger windows also spot-check 932x430 and 1280x720.
const SPOT = [844, 932, 1280];
const WINDOW_MATRIX = [
  { toggle: 'toggleQuestLog', id: 'quest-log-window', widths: SPOT },
  { toggle: 'toggleBags', id: 'bags', widths: SPOT },
  { toggle: 'toggleCrafting', id: 'crafting-window', widths: [844] },
  { toggle: 'toggleCalendar', id: 'calendar-window', widths: [844] },
  { toggle: 'toggleArena', id: 'arena-window', widths: [844] },
  { toggle: 'toggleValeCup', id: 'valecup-window', widths: [844] },
  { toggle: 'toggleLeaderboard', id: 'leaderboard-window', widths: [844] },
  { toggle: 'toggleSocial', id: 'social-window', widths: SPOT },
  { toggle: 'toggleMap', id: 'map-window', widths: [844] },
  { toggle: 'toggleTalents', id: 'talents-window', widths: [844] },
  { toggle: 'toggleChar', id: 'char-window', widths: [844] },
  { toggle: 'toggleSpellbook', id: 'spellbook', widths: [844] },
  { toggle: 'toggleMeters', id: 'meters-window', widths: [844] },
];

const failures = [];
const notes = [];
const fail = (msg) => {
  failures.push(msg);
  console.error(`FAIL ${msg}`);
};
const note = (msg) => {
  notes.push(msg);
  console.log(`NOTE ${msg}`);
};

// In-page rect grab: null for missing / zero-size / display:none / hidden.
function collectRects(page, ids) {
  return page.evaluate((elIds) => {
    const grab = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return null;
      return {
        left: r.left,
        top: r.top,
        right: r.right,
        bottom: r.bottom,
        w: r.width,
        h: r.height,
      };
    };
    const out = { rects: {}, vw: window.innerWidth, vh: window.innerHeight };
    for (const id of elIds) out.rects[id] = grab(document.getElementById(id));
    out.belowTarget = !!document.getElementById('party-frames')?.classList.contains('below-target');
    out.windowOpenClass = document.body.classList.contains('mobile-window-open');
    // Diagnostics for the quest tracker, which the landscape media block hides by
    // design: report whether its STATE populated (rows built) and its display, so a
    // "not measurable" note can say "populated but display:none in landscape" (a real
    // skip) versus "empty" (a broken injection).
    const qt = document.getElementById('quest-tracker');
    out.questTracker = {
      display: qt ? getComputedStyle(qt).display : 'missing',
      rows: document.querySelectorAll('#quest-tracker .qt-title').length,
      htmlLen: qt ? qt.innerHTML.length : -1,
    };
    return out;
  }, ids);
}

// Deterministic mobile viewport flip: raw CDP device metrics (puppeteer omits
// screenWidth/Height and headless then fit-scales a narrower viewport), then wait
// until the tier class and a laid-out control are both real before measuring.
async function flipViewport(page, media, w, h, dsf, expectedTier) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await media.send('Emulation.setDeviceMetricsOverride', {
      width: w,
      height: h,
      deviceScaleFactor: dsf,
      mobile: true,
      screenWidth: w,
      screenHeight: h,
      positionX: 0,
      positionY: 0,
    });
    await media.send('Emulation.resetPageScaleFactor').catch(() => {});
    await sleep(150);
    const inner = await page.evaluate(() => [window.innerWidth, window.innerHeight]);
    if (Math.abs(inner[0] - w) <= 2 && Math.abs(inner[1] - h) <= 2) break;
    if (attempt === 3) fail(`flipViewport(${w}x${h}): page reports ${inner[0]}x${inner[1]}`);
  }
  await page.evaluate(() => {
    document.body.classList.add('mobile-touch', 'game-active');
    window.dispatchEvent(new Event('resize'));
  });
  await sleep(400);
  await page.evaluate(() => document.body.classList.add('mobile-touch', 'game-active'));
  if (expectedTier) {
    const settled = await page
      .waitForFunction(
        (tier) => {
          if (!document.body.classList.contains(tier)) return false;
          const attack = document.getElementById('mobile-action-attack');
          return !!attack && attack.getBoundingClientRect().width > 0;
        },
        { timeout: 12000 },
        expectedTier,
      )
      .then(
        () => true,
        () => false,
      );
    if (!settled) fail(`flipViewport: tier/${expectedTier} or controls never settled`);
  }
  await sleep(250);
}

// Deterministically wait for the party/target HUD to SETTLE before measuring,
// instead of a fixed sleep (a fixed sleep raced the HUD's own repaint cadence and
// flaked with spurious target / below-target violations on iphone-13-landscape).
// Settled means: while #target-frame is visible, #party-frames carries the
// .below-target offset class, AND two consecutive rect samples of #target-frame and
// #party-frames are byte-identical (the frames have stopped moving). If a target is
// not expected (no hostile mob), we only require two stable #party-frames samples.
// Returns { settled, note }; a bounded timeout resolves settled:false with a note.
async function settleFrames(page, { expectTarget }) {
  const DEADLINE = 4000;
  const INTERVAL = 120;
  const start = Date.now();
  let prev = null;
  const sampleOf = () =>
    page.evaluate(() => {
      const grab = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
      };
      const pf = document.getElementById('party-frames');
      return {
        target: grab('target-frame'),
        party: grab('party-frames'),
        belowTarget: !!pf?.classList.contains('below-target'),
      };
    });
  while (Date.now() - start < DEADLINE) {
    const s = await sampleOf();
    const targetReady = expectTarget ? !!s.target && s.belowTarget : true;
    // `same` compares this sample to the PREVIOUS one, so it is true only when two
    // consecutive samples are byte-identical (the frames have stopped moving). With
    // targetReady also satisfied, the HUD has settled: measure now.
    const same = prev !== null && JSON.stringify(prev) === JSON.stringify(s);
    if (same && targetReady) return { settled: true, note: null };
    prev = s;
    await sleep(INTERVAL);
  }
  const last = await sampleOf();
  return {
    settled: false,
    note:
      `SETTLE-TIMEOUT after ${DEADLINE}ms (expectTarget=${expectTarget}, ` +
      `target=${last.target ? 'shown' : 'absent'}, belowTarget=${last.belowTarget})`,
  };
}

// Build a real 4-member party alongside the local player. On this branch
// (release/v0.23.0, post-SimContext) the raw sim.parties / sim.partyByPid Maps
// the raid_to_party_shot recipe hand-assembled no longer exist; party state now
// lives behind the party subsystem. The real invite/accept API is the supported
// path and builds a clean 5-member (leader + 4) non-raid party with no stale
// invite cards: addPlayer, then partyInvite + partyAccept each bot.
async function buildParty(page) {
  return page.evaluate(() => {
    const sim = window.__game.sim;
    const p = sim.player;
    const roster = [
      ['Brightoak', 'druid'],
      ['Stormcaller', 'shaman'],
      ['Nightblade', 'rogue'],
      ['Emberlyn', 'mage'],
    ];
    const pids = roster.map(([name, cls], i) => {
      const pid = sim.addPlayer(cls, name);
      const e = sim.entities.get(pid);
      if (e) {
        e.pos = { x: p.pos.x + (i % 4) * 2 - 3, y: p.pos.y, z: p.pos.z + 2 };
        e.prevPos = { ...e.pos };
      }
      return pid;
    });
    let err = null;
    try {
      for (const pid of pids) {
        sim.partyInvite(pid);
        sim.partyAccept(pid);
      }
    } catch (e) {
      err = String(e).slice(0, 150);
    }
    const info = sim.partyInfo;
    return { members: info?.members?.length ?? 0, raid: info?.raid ?? null, err };
  });
}

// Force a target: find a nearby hostile mob (kind 'mob', hostile, not dead) and
// call sim.targetEntity(id). Returns the id or null.
async function forceTarget(page) {
  return page.evaluate(() => {
    const sim = window.__game.sim;
    const p = sim.player;
    let best = null;
    let bestD = Infinity;
    for (const [id, e] of sim.entities.entries()) {
      if (e.kind !== 'mob' || !e.hostile || e.dead) continue;
      const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z);
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    if (best !== null) sim.targetEntity(best);
    return best;
  });
}

// Populate the buff bar best-effort: push a synthetic aura onto player.auras (the
// same array the buff-bar painter reads). Returns true if the bar has children.
async function populateBuffBar(page) {
  return page.evaluate(() => {
    const sim = window.__game.sim;
    const p = sim.player;
    if (!Array.isArray(p.auras)) return false;
    if (!p.auras.some((a) => a.id === 'audit-buff')) {
      // Idempotent, matching the debuff helper: re-calling per profile must not
      // stack duplicate buff-bar entries (which would grow the bar's width).
      p.auras.push({
        id: 'audit-buff',
        name: 'Audit Vigor',
        kind: 'buff_ap',
        remaining: 300,
        duration: 300,
        value: 15,
        sourceId: sim.primaryId,
        school: 'physical',
      });
    }
    // Honest result, mirroring the debuff helper: true only if the marker aura
    // actually sits on the player (a skipped push must not read as populated).
    return p.auras.some((a) => a.id === 'audit-buff');
  });
}

// Accept a quest so #quest-tracker renders. sim.acceptQuest requires the player to
// stand next to the quest's giver NPC, which we cannot arrange blind; the tracker
// reads world.questLog directly, so inject a single active entry into that Map (the
// same deterministic bypass scripts/quest_collapse_verify_shot.mjs uses). q_wolves
// is a single-objective zone1 quest, so counts is a one-element array. Returns the
// active-quest count on the world after injection.
async function acceptQuest(page) {
  try {
    return await page.evaluate(() => {
      const ql = window.__game?.world?.questLog; // === sim.questLog offline
      // Guarded like the other state helpers: a missing or non-Map questLog must
      // fail this step cleanly, never throw and abort the whole audit run.
      if (!ql || typeof ql.set !== 'function' || typeof ql.get !== 'function') return 0;
      ql.set('q_wolves', { questId: 'q_wolves', counts: [0], state: 'active' });
      // Meaningful success check: the entry must be retained and active, not
      // merely have been passed to set().
      const entry = ql.get('q_wolves');
      return entry && entry.state === 'active' ? ql.size : 0;
    });
  } catch {
    return 0;
  }
}

// Populate the debuff bar: push a synthetic harmful aura onto player.auras. The
// buff/debuff split (src/ui/auras_view.ts isAuraDebuff) keys on aura.kind, not a
// harmful flag; 'sunder' is in DEBUFF_AURA_KINDS and, unlike 'dot', does not tick,
// so it stays an inert render-only marker for the audit. Well-formed against the
// Aura interface (src/sim/types.ts). Returns true if the aura array now holds it.
async function populateDebuffBar(page) {
  return page.evaluate(() => {
    const sim = window.__game.sim;
    const p = sim.player;
    if (Array.isArray(p.auras)) {
      // Idempotent: only push if the marker aura is not already present, so
      // re-calling per profile never stacks duplicate debuff-bar entries.
      if (!p.auras.some((a) => a.id === 'audit-debuff')) {
        p.auras.push({
          id: 'audit-debuff',
          name: 'Audit Sunder',
          kind: 'sunder',
          remaining: 300,
          duration: 300,
          value: 10,
          sourceId: sim.primaryId,
          school: 'physical',
        });
      }
      return p.auras.some((a) => a.id === 'audit-debuff');
    }
    return false;
  });
}

// Open the meters window (#meters-window) so it is a laid-out, measurable chrome
// neighbour during pass A. It is persistent-chrome-adjacent by design (docks near
// the bottom-right joystick), so it must not crowd the thumb controls either.
// Returns true if hud.toggleMeters exists and the window is now display:block.
async function openMeters(page) {
  return page.evaluate(() => {
    const hud = window.__game.hud;
    if (typeof hud?.toggleMeters !== 'function') return false;
    const el = document.getElementById('meters-window');
    // toggleMeters flips display; only open it if it is not already open.
    if (!el || getComputedStyle(el).display !== 'block') hud.toggleMeters();
    const now = document.getElementById('meters-window');
    return !!now && getComputedStyle(now).display === 'block';
  });
}

// Find any npc entity id (for the vendor co-open pair). Returns id or null.
async function findNpc(page) {
  return page.evaluate(() => {
    const sim = window.__game.sim;
    for (const [id, e] of sim.entities.entries()) {
      if (e.kind === 'npc') return id;
    }
    return null;
  });
}

const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});
try {
  mkdirSync(SHOT_DIR, { recursive: true });
  const page = await browser.newPage();
  page.on('pageerror', (err) => fail(`pageerror: ${String(err).slice(0, 200)}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !IGNORED_CONSOLE.test(msg.text())) {
      fail(`console error: ${msg.text().slice(0, 200)}`);
    }
  });
  await page.setViewport({ width: 1280, height: 900 });
  await page.evaluate(() => {}).catch(() => {});
  await page.goto(URL, { waitUntil: 'networkidle2' });
  // Suppress the tutorial before entry so its cards do not overlay the chrome.
  await page.evaluate(() => localStorage.setItem('woc.tutorial.v1', 'done')).catch(() => {});
  await enterOfflineGame(page, { charClass: 'warrior', charName: 'Auditor', settleMs: 1500 });

  const media = await page.createCDPSession();
  await media.send('Emulation.setEmulatedMedia', {
    features: [
      { name: 'pointer', value: 'coarse' },
      { name: 'hover', value: 'none' },
    ],
  });
  await media.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });

  // Keep the character alive: the blind state setup should never let camp wolves
  // kill it mid-audit (death clears frames and would read as a bogus miss).
  await page.evaluate(() => {
    const p = window.__game.sim.player;
    p.maxHp = 99999;
    p.hp = 99999;
  });
  await page.evaluate(() => document.querySelector('.tut-skip')?.click());

  // ---- PASS A: persistent-chrome sweep across all six profiles. ----
  console.log('\n=== PASS A: persistent-chrome overlap sweep (STRICT) ===');
  const partyBuilt = await buildParty(page);
  console.log(`party built: ${JSON.stringify(partyBuilt)}`);
  if (partyBuilt.members !== 5) {
    fail(`pass A setup: party has ${partyBuilt.members} members (expected 5: leader + 4)`);
  }
  // Forming a party as leader pops a one-off Loot Settings dialog; close it so it
  // does not sit over the persistent chrome under measurement (it is not in the
  // measured id set, but closing it keeps the state clean and the shots readable).
  await page.evaluate(() => window.__game.hud.closeAll?.());

  // Populate the three previously-skipped chrome surfaces ONCE (all persist across
  // viewport flips, like the party): accept a quest so #quest-tracker renders,
  // apply a debuff so #debuff-bar renders, and open the meters window so
  // #meters-window is a measured neighbour. Done AFTER closeAll (which would have
  // closed the meters window). Each is measured for real in every profile below.
  const questAccepted = await acceptQuest(page);
  const debuffOk = await populateDebuffBar(page);
  const metersOpen = await openMeters(page);
  console.log(
    `state extras: questLog size=${questAccepted}, debuffApplied=${debuffOk}, ` +
      `metersOpen=${metersOpen}`,
  );
  if (!questAccepted) fail('pass A setup: quest injection left an empty questLog');
  if (!debuffOk) fail('pass A setup: debuff aura was not applied to the player');
  if (!metersOpen) fail('pass A setup: #meters-window did not open (hud.toggleMeters)');

  for (const prof of PROFILES) {
    await flipViewport(page, media, prof.w, prof.h, prof.dsf, prof.tier);
    const targetId = await forceTarget(page);
    if (targetId === null) {
      note(`${prof.name}: no hostile mob found to target; #target-frame will be absent`);
    }
    const buffOk = await populateBuffBar(page);
    // Re-assert the debuff + open meters window each profile: the aura array and
    // the quest log survive a viewport flip, but re-pushing the debuff if a tick
    // consumed it and re-opening meters if a resize repaint closed it keeps every
    // profile measuring the full populated chrome set.
    await populateDebuffBar(page);
    await openMeters(page);
    // Nudge the HUD to repaint the frames/bars/target after the state change.
    await page.evaluate(() => {
      window.__game.hud?.update?.(0.05);
      window.dispatchEvent(new Event('resize'));
    });
    // Deterministic settle instead of a fixed sleep: wait for the party/target
    // frames to stop moving and #party-frames to gain .below-target (bounded).
    const settle = await settleFrames(page, { expectTarget: targetId !== null });
    if (!settle.settled) note(`${prof.name}: ${settle.note}`);

    const allIds = [...CHROME_IDS, ...CONTROL_IDS];
    const g = await collectRects(page, allIds);
    if (process.env.DEBUG_RECTS) {
      console.log(`${prof.name} rects: ${JSON.stringify(g.rects)}`);
    }

    // Assert #party-frames carries .below-target while the target frame shows.
    const targetShown = !!g.rects['target-frame'];
    if (targetShown && !g.belowTarget) {
      fail(`${prof.name}: #party-frames lacks .below-target while #target-frame is visible`);
    }
    if (!targetShown) {
      note(`${prof.name}: #target-frame not visible (skipping below-target assertion)`);
    }

    // Note any chrome that is display:none in this state (not measured). The quest
    // tracker gets a precise reason: the landscape media block hides it by design
    // (short landscape phones show quests via the map badges instead), so it is a
    // deliberate skip on every (all-landscape) audit profile, NOT a broken state.
    // We still assert its STATE populated (rows built from the injected questLog),
    // so a genuinely empty tracker would fail rather than pass as a silent skip.
    for (const id of CHROME_IDS) {
      if (g.rects[id]) continue;
      if (id === 'quest-tracker') {
        const qt = g.questTracker;
        if (qt.rows < 1 || qt.htmlLen < 1) {
          fail(
            `${prof.name}: #quest-tracker has no content despite the injected quest ` +
              `(rows=${qt.rows}, htmlLen=${qt.htmlLen}); the questLog injection is broken`,
          );
        } else {
          note(
            `${prof.name}: #quest-tracker populated (rows=${qt.rows}) but display:${qt.display} ` +
              `-- hidden by the landscape media block by design; SKIPPED (not measurable in landscape)`,
          );
        }
        continue;
      }
      note(`${prof.name}: #${id} not measurable (display:none / empty)`);
    }
    if (!g.rects['buff-bar']) {
      note(`${prof.name}: #buff-bar empty despite populate attempt (buffOk=${buffOk}); SKIPPED`);
    }
    if (!g.rects['debuff-bar']) {
      note(`${prof.name}: #debuff-bar empty despite debuff apply (debuffOk=${debuffOk}); SKIPPED`);
    }

    // Pairwise gap check across every visible chrome + control rect.
    const entries = allIds.map((id) => [id, g.rects[id]]).filter(([, r]) => r);
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [idA, a] = entries[i];
        const [idB, b] = entries[j];
        const interactive = INTERACTIVE_IDS.has(idA) || INTERACTIVE_IDS.has(idB);
        const gap = controlGap(idA, a, idB, b, CIRCLE_IDS);
        // A toggled overlay panel (meters) over a passive readability surface is
        // allowed (NOTE, like a Pass-B window over chrome); its interactive-control
        // and minimap pairs still enforce the normal gap.
        const overlayVsReadable =
          (OVERLAY_CHROME_IDS.has(idA) || OVERLAY_CHROME_IDS.has(idB)) && !interactive;
        if (overlayVsReadable) {
          if (gap < MIN_GAP_CHROME) {
            note(
              `${prof.name}: #${idA} vs #${idB} overlap ${(-gap).toFixed(1)}px ` +
                `(toggled overlay over readability surface; allowed)`,
            );
          }
          continue;
        }
        const req = interactive ? MIN_GAP_INTERACTIVE : MIN_GAP_CHROME;
        if (gap < req) {
          fail(
            `${prof.name}: #${idA} vs #${idB} gap ${gap.toFixed(1)}px < ${req}px ` +
              `(${interactive ? 'interactive' : 'chrome'} pair)`,
          );
        }
      }
    }

    // Touch floor for the interactive chrome (minimap-wrap hosts zoom buttons).
    for (const id of CHROME_IDS) {
      const r = g.rects[id];
      if (r && INTERACTIVE_IDS.has(id) && (r.w < TOUCH_FLOOR - 0.5 || r.h < TOUCH_FLOOR - 0.5)) {
        fail(`${prof.name}: #${id} below the ${TOUCH_FLOOR}px touch floor (${r.w}x${r.h})`);
      }
    }

    // A toggled overlay panel is not gated against the frames, but it must still
    // sit fully on-screen (a half-off overlay is a real bug on any viewport).
    for (const id of OVERLAY_CHROME_IDS) {
      const r = g.rects[id];
      if (r && (r.left < -0.5 || r.top < -0.5 || r.right > g.vw + 0.5 || r.bottom > g.vh + 0.5)) {
        fail(
          `${prof.name}: overlay #${id} leaves the viewport ` +
            `(l=${r.left.toFixed(1)} t=${r.top.toFixed(1)} r=${r.right.toFixed(1)} ` +
            `b=${r.bottom.toFixed(1)} vs ${g.vw}x${g.vh})`,
        );
      }
    }

    await page.screenshot({ path: `${SHOT_DIR}/passA_${prof.name}.png` });
    console.log(`checked ${prof.name} (${prof.w}x${prof.h}, target=${targetId})`);
  }

  // Close the meters overlay before Pass B: it is a toggled panel (not a .window),
  // so Pass B's closeAll() would leave it open and its own toggleMeters check would
  // then TOGGLE it shut and mis-read as "did not open". Close it here explicitly.
  await page.evaluate(() => {
    const el = document.getElementById('meters-window');
    if (el && getComputedStyle(el).display === 'block') window.__game.hud.toggleMeters?.();
  });

  // ---- PASS B: window-open matrix (AUDIT by default; --gate to enforce). ----
  console.log(`\n=== PASS B: window-open matrix (${GATE ? 'GATE' : 'AUDIT'} mode) ===`);
  // In gate mode a pass-B miss is a hard failure; in audit mode it is reported
  // and screenshotted but never flips the exit code.
  const bViolation = (msg) => {
    if (GATE) {
      fail(msg);
    } else {
      console.error(`AUDIT ${msg}`);
      notes.push(`AUDIT ${msg}`);
    }
  };

  for (const w of WINDOW_MATRIX) {
    const exists = await page.evaluate(
      (t) => typeof window.__game?.hud?.[t] === 'function',
      w.toggle,
    );
    if (!exists) {
      note(`window ${w.toggle}: method missing on hud; NOT COVERED`);
      continue;
    }
    // Default: the window's own short `widths` list (each resolved to a profile by
    // width). MATRIX_ALL: sweep the window across every profile in PROFILES, so a
    // window is opened at all six/seven device landscapes, not just its spot widths.
    const bProfiles = MATRIX_ALL
      ? PROFILES
      : w.widths.map((width) => PROFILES.find((p) => p.w === width) || PROFILES[0]);
    for (const prof of bProfiles) {
      const width = prof.w;
      await flipViewport(page, media, width, prof.h, prof.dsf, prof.tier);
      // Open the window through the real hud path.
      const opened = await page.evaluate(
        (t, id) => {
          window.__game.hud.closeAll?.();
          window.__game.hud[t]();
          const el = document.getElementById(id);
          if (!el) return { open: false };
          const style = getComputedStyle(el);
          return { open: style.display !== 'none' && style.visibility !== 'hidden' };
        },
        w.toggle,
        w.id,
      );
      await sleep(300);
      if (!opened.open) {
        note(`window ${w.toggle} @${width}: #${w.id} did not open; NOT COVERED`);
        await page.evaluate(() => window.__game.hud.closeAll?.());
        continue;
      }

      const box = await page.evaluate((id) => {
        const el = document.getElementById(id);
        const r = el.getBoundingClientRect();
        const close = el.querySelector('[data-close], .x-btn');
        const cr = close?.getBoundingClientRect() ?? null;
        return {
          win: {
            left: r.left,
            top: r.top,
            right: r.right,
            bottom: r.bottom,
            w: r.width,
            h: r.height,
          },
          close: cr
            ? {
                left: cr.left,
                top: cr.top,
                right: cr.right,
                bottom: cr.bottom,
                w: cr.width,
                h: cr.height,
              }
            : null,
          vw: window.innerWidth,
          vh: window.innerHeight,
        };
      }, w.id);

      // (1) window fully within the viewport.
      const win = box.win;
      if (
        win.left < -0.5 ||
        win.top < -0.5 ||
        win.right > box.vw + 0.5 ||
        win.bottom > box.vh + 0.5
      ) {
        bViolation(
          `window ${w.toggle} @${width}: #${w.id} leaves viewport ` +
            `(l=${win.left.toFixed(1)} t=${win.top.toFixed(1)} r=${win.right.toFixed(1)} ` +
            `b=${win.bottom.toFixed(1)} vs ${box.vw}x${box.vh})`,
        );
      }
      // (2) close control on-screen and >= 40px.
      if (!box.close) {
        bViolation(
          `window ${w.toggle} @${width}: #${w.id} has no [data-close]/.x-btn close control`,
        );
      } else {
        const c = box.close;
        if (c.left < -0.5 || c.top < -0.5 || c.right > box.vw + 0.5 || c.bottom > box.vh + 0.5) {
          bViolation(`window ${w.toggle} @${width}: close control off-screen`);
        }
        if (c.w < TOUCH_FLOOR - 0.5 || c.h < TOUCH_FLOOR - 0.5) {
          bViolation(
            `window ${w.toggle} @${width}: close control below ${TOUCH_FLOOR}px ` +
              `(${c.w.toFixed(1)}x${c.h.toFixed(1)})`,
          );
        }
      }

      await page.screenshot({ path: `${SHOT_DIR}/passB_${w.toggle}_${width}.png` });

      // (3) closeAll clears mobile-window-open.
      const cleared = await page.evaluate(() => {
        window.__game.hud.closeAll();
        return !document.body.classList.contains('mobile-window-open');
      });
      if (!cleared) {
        bViolation(
          `window ${w.toggle} @${width}: body.mobile-window-open not cleared after closeAll()`,
        );
      }
      console.log(`window ${w.toggle} @${width}: ok (open + close-control + closeAll checked)`);
    }
  }

  // Special case: vendor + bags co-open (the one window-over-chrome overlap pair
  // we DO care about). Needs an npc entity to open the vendor offline. NOTE: even
  // when openVendor runs cleanly on a valid npc offline, the #vendor-window and
  // #bags panels render with ZERO geometry (no real width/height), so there is
  // nothing to measure. We require real, laid-out geometry on BOTH panels before
  // claiming coverage; otherwise this is honestly NOT COVERED offline.
  // Default: one flip to 844x390. MATRIX_ALL: the co-open pair at every profile.
  const vendorProfiles = MATRIX_ALL
    ? PROFILES
    : [{ name: 'iphone-13-landscape', w: 844, h: 390, dsf: 3, tier: 'hud-mobile-compact' }];
  for (const vprof of vendorProfiles) {
    await flipViewport(page, media, vprof.w, vprof.h, vprof.dsf, vprof.tier);
    const npcId = await findNpc(page);
    if (npcId === null) {
      note(`vendor+bags @${vprof.w}: no npc entity reachable offline; NOT COVERED`);
      continue;
    }
    const vendorState = await page.evaluate((id) => {
      window.__game.hud.closeAll?.();
      let openErr = null;
      try {
        window.__game.hud.openVendor(id);
      } catch (e) {
        openErr = String(e).slice(0, 150);
      }
      const box = (elId) => {
        const el = document.getElementById(elId);
        if (!el) return null;
        const s = getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return null;
        const r = el.getBoundingClientRect();
        return {
          left: r.left,
          top: r.top,
          right: r.right,
          bottom: r.bottom,
          w: r.width,
          h: r.height,
        };
      };
      return {
        openErr,
        vendorOpenClass: document.body.classList.contains('vendor-open'),
        vendor: box('vendor-window'),
        bags: box('bags'),
      };
    }, npcId);
    const v = vendorState.vendor;
    const b = vendorState.bags;
    if (process.env.DEBUG_RECTS)
      console.log(`vendor state @${vprof.w}: ${JSON.stringify(vendorState)}`);
    // Both panels must be real, laid-out, AND actually overlapping the game area
    // (not a zero-origin degenerate box). Offline, openVendor engages the class but
    // the panels do not paint, so guard on a non-trivial box that starts on-screen.
    const laidOut = (r) => r && r.w >= 80 && r.h >= 80 && r.right > 0 && r.bottom > 0;
    if (!vendorState.vendorOpenClass || vendorState.openErr) {
      note(
        `vendor+bags @${vprof.w}: openVendor did not engage ` +
          `${JSON.stringify(vendorState)}; NOT COVERED`,
      );
    } else if (!laidOut(v) || !laidOut(b)) {
      note(
        `vendor+bags @${vprof.w}: panels have no real geometry offline ` +
          `(vendor=${v ? `${v.w.toFixed(0)}x${v.h.toFixed(0)}` : 'null'}, ` +
          `bags=${b ? `${b.w.toFixed(0)}x${b.h.toFixed(0)}` : 'null'}); NOT COVERED offline`,
      );
    } else {
      const gap = controlGap('vendor-window', v, 'bags', b, CIRCLE_IDS);
      if (gap < 0) {
        bViolation(
          `vendor+bags @${vprof.w}: #vendor-window overlaps #bags by ${(-gap).toFixed(1)}px`,
        );
      } else {
        console.log(`vendor+bags @${vprof.w}: co-open clear (gap ${gap.toFixed(1)}px)`);
      }
      await page.screenshot({ path: `${SHOT_DIR}/passB_vendor_bags_${vprof.w}.png` });
    }
    await page.evaluate(() => window.__game.hud.closeAll?.());
  }

  // ---- Verdict. ----
  console.log(`\n=== AUDIT SUMMARY ===`);
  console.log(`${notes.length} note(s), ${failures.length} strict violation(s).`);
  if (notes.length) console.log(`Notes:\n${notes.map((n) => `  - ${n}`).join('\n')}`);
  if (failures.length) {
    console.error(`\n${failures.length} violation(s).`);
    process.exit(1);
  }
  console.log('\nAll mobile HUD overlap checks passed.');
} finally {
  await browser.close();
}
