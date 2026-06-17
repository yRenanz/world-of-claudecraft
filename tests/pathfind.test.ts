import { describe, expect, it } from 'vitest';
import { isBlocked, resolveMovement, resolvePosition } from '../src/sim/colliders';
import { Sim } from '../src/sim/sim';
import { findPlayerPath, resolvePlayerDestination } from '../src/sim/pathfind';
import { groundHeight } from '../src/sim/world';
import { PROPS } from '../src/sim/data';

describe('player pathfinding', () => {
  it('routes around static blockers instead of walking straight through them', () => {
    const seed = 20061;
    const from = { x: -4, z: 2 };
    const to = { x: 4, z: 2 };
    const path = findPlayerPath(seed, from, to);

    expect(isBlocked(seed, 0, 2)).toBe(true);
    expect(path.length).toBeGreaterThan(1);
    expect(path.some((p) => Math.abs(p.z - 2) > 0.5)).toBe(true);
    expect(path[path.length - 1]).toEqual(to);
  });

  it('resolves click destinations inside buildings to the nearest walkable outside point', () => {
    const seed = 20061;
    const target = resolvePlayerDestination(seed, { x: 10, z: 12 });

    expect(isBlocked(seed, 10, 12)).toBe(true);
    expect(isBlocked(seed, target.x, target.z)).toBe(false);
    expect(Math.hypot(target.x - 10, target.z - 12)).toBeGreaterThan(0.5);
    expect(Math.hypot(target.x - 10, target.z - 12)).toBeLessThan(6);
  });

  it('treats fence runs as movement blockers', () => {
    const seed = 20061;
    expect(isBlocked(seed, 19, 10)).toBe(true);

    const from = { x: 13, z: 7 };
    const to = { x: 25, z: 13 };
    const path = findPlayerPath(seed, from, to);

    expect(path.length).toBeGreaterThan(1);
    expect(path[path.length - 1]).toEqual(to);
  });

  it('blocks normal player movement through fences', () => {
    const sim = new Sim({ seed: 20061, playerClass: 'warrior' });
    const p = sim.player;
    const fence = { x1: 16, z1: 16, x2: 22, z2: 4 };
    const mx = (fence.x1 + fence.x2) / 2;
    const mz = (fence.z1 + fence.z2) / 2;
    const dx = fence.x2 - fence.x1;
    const dz = fence.z2 - fence.z1;
    const len = Math.hypot(dx, dz);
    const nx = -dz / len;
    const nz = dx / len;

    p.pos.x = mx - nx * 3;
    p.pos.z = mz - nz * 3;
    p.pos.y = groundHeight(p.pos.x, p.pos.z, sim.cfg.seed);
    p.prevPos = { ...p.pos };
    p.facing = Math.atan2(nx, nz);
    sim.moveInput.forward = true;

    for (let i = 0; i < 40; i++) sim.tick();

    const side = (p.pos.x - mx) * nx + (p.pos.z - mz) * nz;
    expect(side).toBeLessThan(-0.5);
  });

  it('sweeps movement segments so a long step cannot tunnel through a fence', () => {
    const seed = 20061;
    const fence = { x1: 16, z1: 16, x2: 22, z2: 4 };
    const mx = (fence.x1 + fence.x2) / 2;
    const mz = (fence.z1 + fence.z2) / 2;
    const dx = fence.x2 - fence.x1;
    const dz = fence.z2 - fence.z1;
    const len = Math.hypot(dx, dz);
    const nx = -dz / len;
    const nz = dx / len;
    const from = { x: mx - nx * 3, z: mz - nz * 3 };
    const to = { x: mx + nx * 3, z: mz + nz * 3 };

    const resolved = resolveMovement(seed, from.x, from.z, to.x, to.z, 0.5);
    const side = (resolved.x - mx) * nx + (resolved.z - mz) * nz;
    expect(side).toBeLessThan(-0.5);
  });

  it('lets the player stand close to the fence face without crossing it', () => {
    const seed = 20061;
    const fence = { x1: 16, z1: 16, x2: 22, z2: 4 };
    const mx = (fence.x1 + fence.x2) / 2;
    const mz = (fence.z1 + fence.z2) / 2;
    const dx = fence.x2 - fence.x1;
    const dz = fence.z2 - fence.z1;
    const len = Math.hypot(dx, dz);
    const nx = -dz / len;
    const nz = dx / len;
    const nearFence = { x: mx - nx * 0.95, z: mz - nz * 0.95 };

    const resolved = resolvePosition(seed, nearFence.x, nearFence.z, 0.5);
    const side = (resolved.x - mx) * nx + (resolved.z - mz) * nz;
    expect(side).toBeGreaterThan(-1.05);
    expect(side).toBeLessThan(-0.7);
  });

  it('blocks crossing every authored fence run', () => {
    const seed = 20061;
    for (const fence of PROPS.fences) {
      const mx = (fence.x1 + fence.x2) / 2;
      const mz = (fence.z1 + fence.z2) / 2;
      const dx = fence.x2 - fence.x1;
      const dz = fence.z2 - fence.z1;
      const len = Math.hypot(dx, dz);
      const nx = -dz / len;
      const nz = dx / len;
      const from = { x: mx - nx * 3, z: mz - nz * 3 };
      const to = { x: mx + nx * 3, z: mz + nz * 3 };

      const resolved = resolveMovement(seed, from.x, from.z, to.x, to.z, 0.5);
      const side = (resolved.x - mx) * nx + (resolved.z - mz) * nz;
      expect(side, `fence ${fence.x1},${fence.z1} -> ${fence.x2},${fence.z2}`).toBeLessThan(-0.5);
    }
  });
});
