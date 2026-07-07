import { describe, expect, it } from 'vitest';
import type { LootRollGroupStatus } from '../src/sim/types';
import {
  computeLootRollStatusRows,
  lootRollStatusFingerprint,
} from '../src/ui/loot_roll_status_view';

// Unit tests for the pure loot-roll vote-strip core: prompt/watch row split,
// self marking, and the render-on-change fingerprint. No DOM; the hud is a
// thin consumer (pure-core + thin-consumer, like loot_roll_reconcile.ts).

const status = (over: Partial<LootRollGroupStatus> = {}): LootRollGroupStatus => ({
  rollId: 7,
  itemId: 'greyjaw_hide_boots',
  itemName: 'Greyjaw Hide Boots',
  quality: 'uncommon',
  expiresAt: 120,
  entries: [
    { pid: 1, name: 'Aaa', choice: 'need' },
    { pid: 2, name: 'Bbb', choice: null },
    { pid: 3, name: 'Ccc', choice: 'pass' },
  ],
  ...over,
});

describe('computeLootRollStatusRows', () => {
  it('marks rows with a live local prompt and flags the local player in the strip', () => {
    const rows = computeLootRollStatusRows([status(), status({ rollId: 8 })], [8], 2);
    expect(rows.map((r) => [r.rollId, r.hasPrompt])).toEqual([
      [7, false],
      [8, true],
    ]);
    expect(rows[0].entries.map((e) => e.self)).toEqual([false, true, false]);
    expect(rows[0].entries.map((e) => e.choice)).toEqual(['need', null, 'pass']);
  });

  it('carries the item identity for the watch row rendering', () => {
    const [row] = computeLootRollStatusRows([status()], [], 1);
    expect(row).toMatchObject({
      itemId: 'greyjaw_hide_boots',
      itemName: 'Greyjaw Hide Boots',
      quality: 'uncommon',
      expiresAt: 120,
    });
  });
});

describe('lootRollStatusFingerprint', () => {
  it('is stable for unchanged input and moves on any vote, membership, or mode change', () => {
    const base = () => computeLootRollStatusRows([status()], [7], 2);
    const fp = lootRollStatusFingerprint(base());
    expect(lootRollStatusFingerprint(base())).toBe(fp);

    const voted = computeLootRollStatusRows(
      [
        status({
          entries: status().entries.map((e) => (e.pid === 2 ? { ...e, choice: 'greed' } : e)),
        }),
      ],
      [7],
      2,
    );
    expect(lootRollStatusFingerprint(voted)).not.toBe(fp);

    const watch = computeLootRollStatusRows([status()], [], 2); // prompt answered
    expect(lootRollStatusFingerprint(watch)).not.toBe(fp);

    const gone = computeLootRollStatusRows([], [], 2); // roll resolved
    expect(lootRollStatusFingerprint(gone)).toBe('');
  });
});
