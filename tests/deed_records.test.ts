import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Postgres is mocked (hoisted above the server/game import) so GameServer runs
// with no live DB; the deeds SQL boundary is mocked separately so the
// fire-and-forget observer writer is a spy we can assert against.
vi.mock('../server/db', () => ({
  pool: { query: vi.fn(async () => ({ rows: [] })) },
  saveCharacterState: vi.fn(async () => {}),
  saveCharacterAndMarketState: vi.fn(async () => {}),
  saveMarketState: vi.fn(async () => {}),
  saveMailState: vi.fn(async () => {}),
  loadMarketState: vi.fn(async () => null),
  loadMailState: vi.fn(async () => null),
  openPlaySession: vi.fn(async () => 1),
  touchCharacterLogin: vi.fn(async () => {}),
  closePlaySession: vi.fn(async () => {}),
  insertChatLogs: vi.fn(async () => {}),
  insertBankLedgerRow: vi.fn(async () => {}),
  walletForAccount: vi.fn(async () => null),
  markAccountQuestComplete: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  grantAccountMechChroma: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  revokeAccountMechChroma: vi.fn(async () => ({ completedQuestIds: [], mechChromaIds: [] })),
  acquireCharacterLease: vi.fn(async () => true),
  releaseCharacterLease: vi.fn(async () => {}),
  heartbeatCharacterLeases: vi.fn(async () => {}),
  releaseAllCharacterLeases: vi.fn(async () => {}),
}));

vi.mock('../server/deeds_db', () => ({
  insertCharacterDeed: vi.fn(async () => {}),
  getDeedBroadcasts: vi.fn(async () => true),
}));

import { getDeedBroadcasts, insertCharacterDeed } from '../server/deeds_db';
import {
  deedRecordsIdle,
  isHiddenDeedId,
  isMarqueeDeed,
  publicRarityPayload,
  recordDeedUnlock,
} from '../server/deeds_records';
import { GameServer } from '../server/game';
import { DEEDS } from '../src/sim/content/deeds';
import type { DeedDef } from '../src/sim/types';

const insertMock = vi.mocked(insertCharacterDeed);
const broadcastsFlagMock = vi.mocked(getDeedBroadcasts);

// Let the fire-and-forget promise chains (FIFO tail + the broadcast gate)
// settle deterministically before asserting.
async function settle(): Promise<void> {
  await deedRecordsIdle();
  await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(async () => {
  // Drain any prior test's tail before clearing, so a straggler insert from an
  // earlier case can never land inside this test's assertions.
  await deedRecordsIdle();
  insertMock.mockClear();
  insertMock.mockImplementation(async () => {});
  broadcastsFlagMock.mockClear();
  broadcastsFlagMock.mockResolvedValue(true);
});

afterEach(async () => {
  await settle();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// isMarqueeDeed (pure): the broadcast bar.
// ---------------------------------------------------------------------------

describe('isMarqueeDeed', () => {
  const base: DeedDef = {
    id: 'x',
    name: 'X',
    desc: 'x',
    category: 'progression',
    renown: 10,
    trigger: { kind: 'level', level: 2 },
  };

  it('notable-or-better Renown clears the bar; routine Renown does not', () => {
    expect(isMarqueeDeed({ ...base, renown: 25 })).toBe(true);
    expect(isMarqueeDeed({ ...base, renown: 50 })).toBe(true);
    expect(isMarqueeDeed({ ...base, renown: 10 })).toBe(false);
    expect(isMarqueeDeed({ ...base, renown: 5 })).toBe(false);
    // The exact boundary: 24 (below any real rung, but the decisive mutant
    // killer for the >= 25 threshold that governs guild-chat volume).
    expect(isMarqueeDeed({ ...base, renown: 24 as DeedDef['renown'] })).toBe(false);
  });

  it('any cosmetic reward clears the bar regardless of Renown', () => {
    expect(isMarqueeDeed({ ...base, renown: 10, reward: { kind: 'title', text: 'X' } })).toBe(true);
    expect(isMarqueeDeed({ ...base, renown: 0, reward: { kind: 'border', slug: 'x' } })).toBe(true);
    expect(isMarqueeDeed({ ...base, renown: 0, feat: true })).toBe(false);
  });

  it('agrees with the real catalog on the two exemplars', () => {
    expect(isMarqueeDeed(DEEDS.prog_veteran)).toBe(true); // title reward at renown 10
    expect(isMarqueeDeed(DEEDS.prog_first_steps)).toBe(false); // renown 5, rewardless
  });
});

// ---------------------------------------------------------------------------
// The hidden-deed strip for public surfaces (pure): existence is part of the
// hidden contract, so the anonymous rarity payload must never carry a hidden
// deed's id.
// ---------------------------------------------------------------------------

describe('publicRarityPayload', () => {
  it('strips hidden deeds from the earned map and keeps everything else intact', () => {
    // Fixture guard: the exemplar must actually be hidden in the catalog.
    expect(DEEDS.hid_saul_footnote.hidden).toBe(true);
    expect(DEEDS.prog_veteran.hidden).not.toBe(true);
    const out = publicRarityPayload({
      totalEligible: 120,
      earned: { prog_veteran: 30, hid_saul_footnote: 4 },
    });
    expect(out).toEqual({ totalEligible: 120, earned: { prog_veteran: 30 } });
    expect(isHiddenDeedId('hid_saul_footnote')).toBe(true);
    expect(isHiddenDeedId('prog_veteran')).toBe(false);
  });

  it('a drifted id (content removed) passes through: nothing left to spoil', () => {
    const out = publicRarityPayload({ totalEligible: 10, earned: { gone_deed: 1 } });
    expect(out.earned).toEqual({ gone_deed: 1 });
  });
});

// ---------------------------------------------------------------------------
// recordDeedUnlock: the fire-and-forget FIFO observer.
// ---------------------------------------------------------------------------

describe('recordDeedUnlock', () => {
  it('writes one row per unlock with the exact field mapping', async () => {
    // Distinct account/character ids so a swapped-field bug cannot pass.
    recordDeedUnlock({ characterId: 42, accountId: 7 }, 'prog_first_steps');
    await deedRecordsIdle();
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith({
      realm: 'Claudemoon',
      characterId: 42,
      accountId: 7,
      deedId: 'prog_first_steps',
    });
  });

  it('preserves FIFO order: the second insert starts only after the first resolves', async () => {
    const order: string[] = [];
    let releaseFirst: () => void = () => {};
    insertMock.mockImplementationOnce(async (row) => {
      order.push(`start:${row.deedId}`);
      await new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      order.push(`end:${row.deedId}`);
    });
    insertMock.mockImplementationOnce(async (row) => {
      order.push(`start:${row.deedId}`);
      order.push(`end:${row.deedId}`);
    });
    recordDeedUnlock({ characterId: 1, accountId: 1 }, 'a');
    recordDeedUnlock({ characterId: 1, accountId: 1 }, 'b');
    // Give the chain a chance to (wrongly) start the second insert early.
    await new Promise((resolve) => setImmediate(resolve));
    expect(order).toEqual(['start:a']);
    releaseFirst();
    await deedRecordsIdle();
    expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b']);
  });

  it('a replay of the same (character, deed) pair leaves ONE row via the conflict-faking store', async () => {
    // Emulate the UNIQUE (character_id, deed_id) ON CONFLICT DO NOTHING
    // backbone: same pair collapses, a different deed lands its own row.
    const store = new Map<string, { characterId: number; accountId: number; deedId: string }>();
    insertMock.mockImplementation(async (row) => {
      const key = `${row.characterId}:${row.deedId}`;
      if (!store.has(key)) store.set(key, row);
    });
    recordDeedUnlock({ characterId: 42, accountId: 7 }, 'prog_veteran');
    recordDeedUnlock({ characterId: 42, accountId: 7 }, 'prog_veteran'); // retro replay
    recordDeedUnlock({ characterId: 42, accountId: 7 }, 'prog_first_steps');
    await deedRecordsIdle();
    expect(insertMock).toHaveBeenCalledTimes(3); // the SQL is what dedupes
    expect(store.size).toBe(2);
    expect([...store.keys()].sort()).toEqual(['42:prog_first_steps', '42:prog_veteran']);
  });

  it('a rejected insert logs, never throws into the caller, and never stalls the chain', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    insertMock.mockRejectedValueOnce(new Error('db down'));
    expect(() => recordDeedUnlock({ characterId: 1, accountId: 1 }, 'a')).not.toThrow();
    recordDeedUnlock({ characterId: 1, accountId: 1 }, 'b');
    await deedRecordsIdle();
    expect(errorSpy).toHaveBeenCalledWith('character_deeds write failed:', expect.any(Error));
    // The rejection did not break FIFO: the second insert still landed.
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(insertMock.mock.calls[1][0].deedId).toBe('b');
  });

  it('deedRecordsIdle resolves only after a pending insert completes (the test drain hook)', async () => {
    let release: () => void = () => {};
    let finished = false;
    insertMock.mockImplementationOnce(async () => {
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      finished = true;
    });
    recordDeedUnlock({ characterId: 1, accountId: 1 }, 'a');
    const idle = deedRecordsIdle().then(() => {
      expect(finished).toBe(true);
    });
    await new Promise((resolve) => setImmediate(resolve));
    release();
    await idle;
  });
});

// ---------------------------------------------------------------------------
// detectActivity wiring: the sim's deedUnlocked events (and nothing else)
// reach the observer, with the marquee/retro/opt-out gates on the broadcast.
// ---------------------------------------------------------------------------

describe('deedUnlocked through GameServer.detectActivity', () => {
  let server: GameServer;

  function fakeWs() {
    const fc = {
      sent: [] as unknown[],
      ws: { readyState: 1, send: (p: string) => fc.sent.push(JSON.parse(p)) },
    };
    return fc;
  }

  beforeEach(() => {
    server = new GameServer();
  });

  // Run one authoritative tick and hand its events to the observer exactly
  // like the world loop does (routeEvents ordering is irrelevant here).
  function tickAndDetect(): void {
    const events = server.sim.tick();
    (server as unknown as { detectActivity(events: unknown[]): void }).detectActivity(events);
  }

  it('a live unlock inserts one row per deed with the session ids; a marquee unlock broadcasts', async () => {
    const fc = fakeWs();
    const session = server.join(fc.ws as never, 7, 42, 'Hilda', 'warrior', null);
    if ('error' in session) throw new Error(session.error);
    const broadcastSpy = vi
      .spyOn(server.social, 'broadcastDeedUnlock')
      .mockResolvedValue(undefined);
    tickAndDetect(); // settle the fresh join (level 1: nothing earned)
    await settle();
    insertMock.mockClear();

    // 250k lifetime XP crosses prog_veteran (marquee: title reward) plus the
    // low level rungs (non-marquee) in one tick, all non-retro.
    server.sim.grantXp(250_000, server.sim.meta(session.pid) ?? undefined);
    tickAndDetect();
    await settle();

    const rows = insertMock.mock.calls.map((c) => c[0]);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.realm).toBe('Claudemoon');
      expect(row.characterId).toBe(42);
      expect(row.accountId).toBe(7);
    }
    expect(rows.some((r) => r.deedId === 'prog_veteran')).toBe(true);
    expect(rows.some((r) => r.deedId === 'prog_first_steps')).toBe(true);
    // Exactly the marquee subset of this tick's unlocks broadcast (with the
    // session actor), and the opt-out flag was consulted by account id.
    expect(broadcastSpy).toHaveBeenCalledWith({ characterId: 42, name: 'Hilda' }, 'prog_veteran');
    const broadcastIds = broadcastSpy.mock.calls.map((c) => c[1]);
    const expectedMarquee = rows.map((r) => r.deedId).filter((id) => isMarqueeDeed(DEEDS[id]));
    expect(broadcastIds.sort()).toEqual(expectedMarquee.sort());
    expect(broadcastIds).not.toContain('prog_first_steps');
    expect(broadcastsFlagMock).toHaveBeenCalledWith(7);
  });

  it('the account opt-out suppresses the broadcast but never the record', async () => {
    const fc = fakeWs();
    const session = server.join(fc.ws as never, 7, 42, 'Hilda', 'warrior', null);
    if ('error' in session) throw new Error(session.error);
    const broadcastSpy = vi
      .spyOn(server.social, 'broadcastDeedUnlock')
      .mockResolvedValue(undefined);
    tickAndDetect();
    await settle();
    insertMock.mockClear();
    broadcastsFlagMock.mockResolvedValue(false);

    server.sim.grantXp(250_000, server.sim.meta(session.pid) ?? undefined);
    tickAndDetect();
    await settle();

    expect(insertMock.mock.calls.some((c) => c[0].deedId === 'prog_veteran')).toBe(true);
    expect(broadcastsFlagMock).toHaveBeenCalled();
    expect(broadcastSpy).not.toHaveBeenCalled();
  });

  it('retro unlocks on join insert rows but NEVER broadcast or read the opt-out', async () => {
    // A pre-deeds save: high lifetime XP but no earned map, so the join pass
    // back-credits prog_veteran (marquee) with retro: true.
    const state = {
      level: 12,
      xp: 0,
      lifetimeXp: 260_000,
      copper: 0,
      hp: 100,
      resource: 0,
      pos: { x: 2, z: -2 },
      facing: 0,
      equipment: {},
      inventory: [],
      questLog: [],
      questsDone: [],
    };
    const fc = fakeWs();
    const session = server.join(fc.ws as never, 7, 42, 'Returning', 'warrior', state as never);
    if ('error' in session) throw new Error(session.error);
    const broadcastSpy = vi
      .spyOn(server.social, 'broadcastDeedUnlock')
      .mockResolvedValue(undefined);
    tickAndDetect(); // the join's retro grants drain with this tick
    await settle();

    const rows = insertMock.mock.calls.map((c) => c[0]);
    expect(rows.some((r) => r.deedId === 'prog_veteran')).toBe(true);
    expect(rows.every((r) => r.characterId === 42 && r.accountId === 7)).toBe(true);
    expect(broadcastSpy).not.toHaveBeenCalled();
    expect(broadcastsFlagMock).not.toHaveBeenCalled();
  });

  it('a drifted deed id (content removed) still records but never reaches the broadcast gate', async () => {
    const fc = fakeWs();
    const session = server.join(fc.ws as never, 7, 42, 'Hilda', 'warrior', null);
    if ('error' in session) throw new Error(session.error);
    const broadcastSpy = vi
      .spyOn(server.social, 'broadcastDeedUnlock')
      .mockResolvedValue(undefined);
    tickAndDetect();
    await settle();
    insertMock.mockClear();

    // A synthetic event whose id has left the catalog: the observer mirrors
    // the sim's decision regardless (the index answers "what was earned",
    // not "what still exists"), while the broadcast gate drops it before
    // ever reading the opt-out flag.
    (server as unknown as { detectActivity(events: unknown[]): void }).detectActivity([
      { type: 'deedUnlocked', pid: session.pid, deedId: 'gone_deed' },
    ]);
    await settle();
    expect(insertMock.mock.calls.map((c) => c[0].deedId)).toEqual(['gone_deed']);
    expect(broadcastsFlagMock).not.toHaveBeenCalled();
    expect(broadcastSpy).not.toHaveBeenCalled();
  });

  it('a non-marquee live unlock records without ever reading the opt-out flag', async () => {
    const fc = fakeWs();
    const session = server.join(fc.ws as never, 7, 42, 'Hilda', 'warrior', null);
    if ('error' in session) throw new Error(session.error);
    const broadcastSpy = vi
      .spyOn(server.social, 'broadcastDeedUnlock')
      .mockResolvedValue(undefined);
    tickAndDetect();
    await settle();
    insertMock.mockClear();

    // Level 2 earns only the rewardless renown-5 first rung.
    server.sim.setPlayerLevel(2, session.pid);
    server.sim.ctx.markDeedsDirty(session.pid);
    tickAndDetect();
    await settle();

    expect(insertMock.mock.calls.map((c) => c[0].deedId)).toContain('prog_first_steps');
    expect(broadcastsFlagMock).not.toHaveBeenCalled();
    expect(broadcastSpy).not.toHaveBeenCalled();
  });
});
