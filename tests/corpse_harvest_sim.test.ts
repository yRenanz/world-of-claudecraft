import { describe, expect, it } from 'vitest';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import type { PlayerMeta } from '../src/sim/sim';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';

// End-to-end: a slain mob's corpse can be harvested for profession components
// exactly once, first-come. This is the deliberate OPPOSITE of a world gathering
// node (per-player, everyone gets their own harvest); here two players racing the
// same corpse must resolve to exactly one success, deterministically, even when
// both commands land in the SAME 20 Hz tick (server.game.ts processes a tick's
// command batch synchronously, one command at a time, so there is no interleaving
// to race).

type SimInternals = {
  entities: Map<number, Entity>;
  players: Map<number, PlayerMeta>;
};

function setup(seed = 11) {
  const sim = new Sim({ seed, playerClass: 'warrior', noPlayer: true });
  const internals = sim as unknown as SimInternals;
  const a = sim.addPlayer('warrior', 'Alpha');
  const b = sim.addPlayer('warrior', 'Bravo');
  sim.tick();

  for (const pid of [a, b]) {
    const e = internals.entities.get(pid)!;
    e.pos = { x: 0, y: 0, z: 0 };
    e.prevPos = { x: 0, y: 0, z: 0 };
  }

  // A dead wolf corpse with profession component tags (hide, fang; see #1140).
  const template = MOBS.forest_wolf;
  const mob = createMob(9999, template, template.maxLevel, { x: 0, y: 0, z: 0 });
  mob.dead = true;
  mob.aiState = 'dead';
  mob.corpseTimer = 9999;
  mob.respawnTimer = 9999;
  internals.entities.set(mob.id, mob);

  return { sim, internals, a, b, mob };
}

describe('corpse harvest: single-use, first-come (#1141)', () => {
  it('is unclaimed on a fresh corpse', () => {
    const { mob } = setup();
    expect(mob.harvestClaimedBy).toBeNull();
  });

  it('the first attempt succeeds and claims the corpse', () => {
    const { sim, mob, a } = setup();
    sim.harvestCorpse(mob.id, a);
    expect(mob.harvestClaimedBy).toBe(a);
  });

  it('a later solo attempt against an already-claimed corpse is denied', () => {
    const { sim, mob, a, b } = setup();
    sim.harvestCorpse(mob.id, a);
    expect(mob.harvestClaimedBy).toBe(a);
    // Bravo tries a full second later; still denied, still claimed by Alpha.
    for (let i = 0; i < 20; i++) sim.tick();
    sim.harvestCorpse(mob.id, b);
    expect(mob.harvestClaimedBy).toBe(a);
  });

  it('exactly one of two attempts in the SAME tick succeeds, deterministically', () => {
    // Simulate both players' commands landing in the same 20 Hz tick: the
    // server dispatches a tick's command batch synchronously, one at a time, so
    // this back-to-back call pair on one tick is the faithful reproduction.
    const { sim, mob, a, b } = setup();
    sim.harvestCorpse(mob.id, a);
    sim.harvestCorpse(mob.id, b);
    expect(mob.harvestClaimedBy).toBe(a);
  });

  it('is order-independent: whichever command is processed first wins, never both', () => {
    const run1 = setup();
    run1.sim.harvestCorpse(run1.mob.id, run1.a);
    run1.sim.harvestCorpse(run1.mob.id, run1.b);

    const run2 = setup();
    run2.sim.harvestCorpse(run2.mob.id, run2.b);
    run2.sim.harvestCorpse(run2.mob.id, run2.a);

    // Whichever pid is processed first claims the corpse; the second is always denied.
    expect(run1.mob.harvestClaimedBy).toBe(run1.a);
    expect(run2.mob.harvestClaimedBy).toBe(run2.b);
  });

  it('grants the mapped component item only to the winner', () => {
    const { sim, mob, a, b } = setup();
    sim.harvestCorpse(mob.id, a);
    sim.harvestCorpse(mob.id, b);
    // forest_wolf's componentTags (#1140) include 'hide', mapped to boar_hide.
    expect(sim.countItem('boar_hide', a)).toBe(1);
    expect(sim.countItem('boar_hide', b)).toBe(0);
  });

  it('denies harvest against a mob with no profession component tags', () => {
    const { sim, internals, a } = setup();
    // warlock_imp carries no componentTags (#1140 only tagged a subset of mobs).
    expect(MOBS.warlock_imp.componentTags).toBeUndefined();
    const noTagTemplate = MOBS.warlock_imp;
    const noTagMob = createMob(8888, noTagTemplate, noTagTemplate.maxLevel, {
      x: 0,
      y: 0,
      z: 0,
    });
    noTagMob.dead = true;
    noTagMob.corpseTimer = 9999;
    noTagMob.respawnTimer = 9999;
    internals.entities.set(noTagMob.id, noTagMob);
    sim.harvestCorpse(noTagMob.id, a);
    expect(noTagMob.harvestClaimedBy).toBeNull();
  });

  it('denies harvest on a live (non-dead) mob', () => {
    const { sim, mob, a } = setup();
    mob.dead = false;
    sim.harvestCorpse(mob.id, a);
    expect(mob.harvestClaimedBy).toBeNull();
  });
});

// #1145: a rare-or-better corpse-harvested monster material is stamped with the
// harvester's own name; below that rarity floor the grant stays a plain
// fungible stack, same behavior as before this issue. Seeds below are
// pre-verified against this exact setup() shape (two players, seeded before
// the harvest's one rng draw) to land on each side of the rarity floor.
describe('signed materials (#1145)', () => {
  it('a rare-or-better harvest stamps the item with the harvester name (seed 6)', () => {
    const { sim, internals, a, mob } = setup(6);
    sim.harvestCorpse(mob.id, a);
    const meta = internals.players.get(a)!;
    const slot = meta.inventory.find((s) => s.itemId === 'boar_hide');
    expect(slot).toBeDefined();
    expect(slot?.instance?.signer).toBe('Alpha');
    // Still exactly one copy granted, same as an unsigned harvest.
    expect(sim.countItem('boar_hide', a)).toBe(1);
  });

  it('a below-rare harvest grants a plain, unsigned fungible item (seed 1)', () => {
    const { sim, internals, a, mob } = setup(1);
    sim.harvestCorpse(mob.id, a);
    const meta = internals.players.get(a)!;
    const slot = meta.inventory.find((s) => s.itemId === 'boar_hide');
    expect(slot).toBeDefined();
    expect(slot?.instance).toBeUndefined();
    expect(sim.countItem('boar_hide', a)).toBe(1);
  });
});
