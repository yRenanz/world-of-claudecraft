// Visual + behavioural verification for the Protect Yumi maze mode. Offline
// single-player world plus five sim-added fighters (no server needed): queues
// six players into a yumi3 match, then asserts the maze interior built, the
// walls block real keyboard movement, the match HUD strip is up with both cat
// bars, the simultaneous teleport relocates both cats onto maze points, and
// killing the enemy cat ends the bout with the victory banner. Screenshots
// land in tmp/. Needs: npm run dev (:5173).

import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { BROWSER_PATH } from './browser_path.mjs';

const URL = process.env.GAME_URL ?? 'http://localhost:5173';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync('tmp', { recursive: true });

let pass = 0,
  fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) {
    pass++;
    console.log(`OK   ${name}`);
  } else {
    fail++;
    console.log(`FAIL ${name}${extra ? ` ${extra}` : ''}`);
  }
};

const errors = [];
const browser = await puppeteer.launch({
  executablePath: BROWSER_PATH,
  headless: 'new',
  protocolTimeout: 60000,
  // Anti-throttle so the offline rAF loop keeps ticking (memory: __game work
  // stalls without these).
  args: [
    '--window-size=1280,820',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
  defaultViewport: { width: 1280, height: 820 },
});
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push(`PAGEERROR: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`CONSOLE: ${m.text()}`);
});

await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
await sleep(800);

// Offline quick-start as priest (a healer, so the own-cat heal check is real).
await page.evaluate(() => {
  document.querySelector('#btn-offline')?.click();
});
await sleep(400);
await page.evaluate(() => {
  document.querySelector('#offline-select .mini-class[data-class="priest"]')?.click();
  const name = document.querySelector('#char-name');
  if (name) name.value = 'Yumitester';
  document.querySelector('#btn-start-offline')?.click();
});
await page.waitForFunction(() => window.__game?.sim?.player, { timeout: 60000, polling: 300 });
check('entered offline world', true);

// Seat a 3v3: the local player + five sim-added fighters, all solo-queued.
const seated = await page.evaluate(() => {
  const sim = window.__game.sim;
  sim.setPlayerLevel(20);
  const classes = ['warrior', 'mage', 'rogue', 'hunter', 'druid'];
  const pids = [sim.playerId, ...classes.map((c, i) => sim.addPlayer(c, `Bot${i}`))];
  for (const pid of pids) sim.arenaQueueJoin(pid, 'yumi3');
  return { pids };
});
await page.waitForFunction(
  () => {
    const sim = window.__game.sim;
    const m = sim.arenaMatchFor(sim.playerId);
    return !!m && m.state === 'active';
  },
  { timeout: 30000, polling: 300 },
);
const start = await page.evaluate(() => {
  const sim = window.__game.sim;
  const m = sim.arenaMatchFor(sim.playerId);
  const y = m.yumi;
  const catA = sim.entities.get(y.yumiA);
  const catB = sim.entities.get(y.yumiB);
  return {
    format: m.format,
    slot: m.slot,
    px: Math.round(sim.player.pos.x),
    pz: Math.round(sim.player.pos.z),
    catA: { hp: catA?.hp, x: catA?.pos.x, z: catA?.pos.z },
    catB: { hp: catB?.hp, x: catB?.pos.x, z: catB?.pos.z },
  };
});
check('yumi3 match active', start.format === 'yumi3', JSON.stringify(start));
check('player teleported into the maze band', start.px >= 8000, `px=${start.px}`);
check('both cats at 5000 hp', start.catA.hp === 5000 && start.catB.hp === 5000);
check('seated ' + JSON.stringify(seated.pids ? seated.pids.length : 0) + ' fighters', true);

// Let the renderer build the maze interior + the HUD strip paint.
await sleep(2500);
const hud = await page.evaluate(() => {
  const el = document.getElementById('yumi-hud');
  const fills = el ? el.querySelectorAll('.yh-fill').length : 0;
  return {
    present: !!el,
    display: el ? getComputedStyle(el).display : 'none',
    fills,
    title: el?.querySelector('.yh-title')?.textContent ?? '',
    sub: el?.querySelector('.yh-sub')?.textContent ?? '',
  };
});
check('yumi HUD strip visible with both bars', hud.display === 'flex' && hud.fills === 2, JSON.stringify(hud));
check('HUD title localized', hud.title.length > 0, hud.title);
await page.screenshot({ path: 'tmp/yumi_match_start.png' });

// Walls block REAL keyboard movement: hold W (north, +z is south so pick the
// direction toward the nearest wall) for 2.5s and confirm the player never
// escapes the maze footprint.
await page.bringToFront();
await page.keyboard.down('w');
await sleep(2500);
await page.keyboard.up('w');
const contained = await page.evaluate(() => {
  const sim = window.__game.sim;
  const m = sim.arenaMatchFor(sim.playerId);
  // maze origin: slot along z at x 8400; footprint half extent 30.25
  const ox = 8400;
  const oz = -1250 + m.slot * 200;
  const lx = sim.player.pos.x - ox;
  const lz = sim.player.pos.z - oz;
  return { lx: Math.round(lx * 10) / 10, lz: Math.round(lz * 10) / 10, inside: Math.abs(lx) < 30.5 && Math.abs(lz) < 30.5 };
});
check('walls contain real movement', contained.inside, JSON.stringify(contained));

// Heal the own cat as the priest (friendly-target rule end to end).
const healed = await page.evaluate(() => {
  const sim = window.__game.sim;
  const m = sim.arenaMatchFor(sim.playerId);
  const y = m.yumi;
  const myTeam = m.teamA.includes(sim.playerId) ? 'A' : 'B';
  const myCat = sim.entities.get(myTeam === 'A' ? y.yumiA : y.yumiB);
  const enemyCat = sim.entities.get(myTeam === 'A' ? y.yumiB : y.yumiA);
  myCat.hp = 4000;
  sim.applyHeal(sim.player, myCat, 300, 'Heal');
  return {
    healedUp: myCat.hp > 4000,
    friendlyOwn: sim.isFriendlyTo(sim.player, myCat),
    friendlyEnemy: sim.isFriendlyTo(sim.player, enemyCat),
    hostileEnemy: sim.isHostileTo(sim.player, enemyCat),
  };
});
check(
  'own cat healable, enemy cat hostile',
  healed.healedUp && healed.friendlyOwn && !healed.friendlyEnemy && healed.hostileEnemy,
  JSON.stringify(healed),
);

// Force the 60s teleport: jump the match clock to just before the boundary.
const beforeTp = await page.evaluate(() => {
  const sim = window.__game.sim;
  const m = sim.arenaMatchFor(sim.playerId);
  const y = m.yumi;
  m.timer = 59.4;
  y.nextTeleportAt = 60;
  const a = sim.entities.get(y.yumiA);
  const b = sim.entities.get(y.yumiB);
  return { ax: a.pos.x, az: a.pos.z, bx: b.pos.x, bz: b.pos.z };
});
await sleep(1500);
const afterTp = await page.evaluate(() => {
  const sim = window.__game.sim;
  const m = sim.arenaMatchFor(sim.playerId);
  const y = m.yumi;
  const a = sim.entities.get(y.yumiA);
  const b = sim.entities.get(y.yumiB);
  return { ax: a.pos.x, az: a.pos.z, bx: b.pos.x, bz: b.pos.z };
});
const movedA = beforeTp.ax !== afterTp.ax || beforeTp.az !== afterTp.az;
const movedB = beforeTp.bx !== afterTp.bx || beforeTp.bz !== afterTp.bz;
const sep = Math.hypot(afterTp.ax - afterTp.bx, afterTp.az - afterTp.bz);
check('both cats teleported', movedA && movedB, JSON.stringify({ beforeTp, afterTp }));
check('teleport separation >= 5yd', sep >= 5, `sep=${sep.toFixed(1)}`);
await page.screenshot({ path: 'tmp/yumi_after_teleport.png' });

// Kill the enemy cat through the real damage hub: the match must end won.
const won = await page.evaluate(() => {
  const sim = window.__game.sim;
  const m = sim.arenaMatchFor(sim.playerId);
  const y = m.yumi;
  const myTeam = m.teamA.includes(sim.playerId) ? 'A' : 'B';
  const enemyCat = sim.entities.get(myTeam === 'A' ? y.yumiB : y.yumiA);
  sim.dealDamage(sim.player, enemyCat, 999999, false, 'physical', null, 'hit');
  return { enemyDead: enemyCat.dead, state: m.state };
});
check('enemy cat killed ends the match', won.enemyDead && won.state === 'over', JSON.stringify(won));
await sleep(800);
const banner = await page.evaluate(() => {
  const b = document.querySelector('#banner, .banner, #big-banner');
  return b ? b.textContent.trim() : '';
});
check('victory banner shown', /victory/i.test(banner), banner);
await page.screenshot({ path: 'tmp/yumi_victory.png' });

// Aftermath: everyone returns, cats despawn, the slot frees.
await sleep(6500);
const torn = await page.evaluate(() => {
  const sim = window.__game.sim;
  return {
    match: sim.arenaMatchFor(sim.playerId) === null,
    px: Math.round(sim.player.pos.x),
  };
});
check('match torn down and player returned home', torn.match && torn.px < 8000, JSON.stringify(torn));

// Offline runs have no API server behind the vite proxy: the homepage stats
// fetch 502s are environmental noise, not a game error.
const realErrors = errors.filter((e) => !/502|Failed to fetch project stats/.test(e));
check('no page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
