// Board integrity: every player-derived public board delists banned and
// currently-suspended accounts, and a moderation action busts the board
// caches so delisting is immediate.
//
// The exclusion lives in SQL (one shared fragment, db.ts ELIGIBLE_ACCOUNT_SQL,
// embedded VERBATIM by every ranked board query), so this file pins the
// MECHANISM: the fragment literal itself (banned ABSENT via banned_at IS
// NULL; clean PRESENT via the NULL arms; an EXPIRED suspension PRESENT via
// suspended_until <= now()), and then, per board and per arm, that the query
// text a read hands to pool.query embeds that exact literal with the right
// account join. Postgres enforces the row-level semantics; the recommended
// db-backed manual check (seed, ban via the admin route, curl the board)
// drives it live. The JS-observable arms are driven behaviorally below: the
// moderateAccount bust hook (success fires, failure does not) and the
// main.ts wiring that nulls every cached board scope. The deeds aggregation
// itself is behaviorally covered in tests/server/deeds_board.test.ts.
//
// The developer board (github_contributors.ts topContributors) is DELIBERATELY
// exempt: it ranks GitHub identities with no game-account linkage.
process.env.DATABASE_URL ||= 'postgres://test:test@127.0.0.1:5433/wocc_board_moderation';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { PoolClient, QueryResult } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PgDailyRewardDb } from '../../server/daily_rewards_db';
import {
  deedsBoardRows,
  ELIGIBLE_ACCOUNT_SQL,
  lifetimeXpRankForCharacter,
  lifetimeXpStanding,
  pool,
  topArenaRatings,
  topGuilds,
  topLifetimeXp,
} from '../../server/db';
import { moderateAccount, setOnAccountModerated } from '../../server/moderation_db';

// The one eligibility predicate, pinned as a LITERAL (never the exported
// constant compared to itself): a banned account (banned_at set) fails the
// first arm; a currently-suspended one fails the second; a clean account and
// one whose suspension has EXPIRED (suspended_until <= now()) pass.
const ELIGIBLE_LITERAL =
  'a.banned_at IS NULL AND (a.suspended_until IS NULL OR a.suspended_until <= now())';

function emptyResult(): QueryResult {
  return { command: '', rowCount: 0, oid: 0, fields: [], rows: [] };
}

/** Spy pool.query, run the read, and return every captured SQL text. */
async function capturedSql(run: () => Promise<unknown>): Promise<string[]> {
  const spy = vi
    .spyOn(pool, 'query')
    .mockImplementation(() => Promise.resolve(emptyResult()) as never);
  try {
    await run();
    return spy.mock.calls.map((call) => String(call[0]));
  } finally {
    spy.mockRestore();
  }
}

/** Assert exactly one query was captured and it embeds the fragment + join. */
async function expectExcludes(run: () => Promise<unknown>, joinText: string): Promise<void> {
  const sql = await capturedSql(run);
  expect(sql).toHaveLength(1);
  expect(sql[0]).toContain(ELIGIBLE_LITERAL);
  expect(sql[0]).toContain(joinText);
}

afterEach(() => {
  setOnAccountModerated(null);
  vi.restoreAllMocks();
});

describe('the shared eligibility fragment', () => {
  it('is exactly the pinned literal', () => {
    expect(ELIGIBLE_ACCOUNT_SQL).toBe(ELIGIBLE_LITERAL);
  });
});

describe('every ranked board query embeds the fragment', () => {
  it('players, realm arm', async () => {
    await expectExcludes(() => topLifetimeXp(10), 'a.id = characters.account_id');
  });

  it('players, global arm', async () => {
    await expectExcludes(() => topLifetimeXp(10, { global: true }), 'a.id = characters.account_id');
  });

  it('arena', async () => {
    await expectExcludes(() => topArenaRatings(10), 'a.id = characters.account_id');
  });

  it('guilds, realm arm (member-level: a banned member stops inflating the sum)', async () => {
    await expectExcludes(() => topGuilds(10), 'a.id = c.account_id');
  });

  it('guilds, global arm', async () => {
    await expectExcludes(() => topGuilds(10, { global: true }), 'a.id = c.account_id');
  });

  it('deeds (the Renown roll-up row read)', async () => {
    const sql = await capturedSql(() => deedsBoardRows());
    expect(sql).toHaveLength(1);
    expect(sql[0]).toContain(ELIGIBLE_LITERAL);
    expect(sql[0]).toContain('a.id = cd.account_id');
    // The roll-up reads only rows whose character still exists (belt over the
    // ON DELETE CASCADE braces).
    expect(sql[0]).toContain('JOIN characters c ON c.id = cd.character_id');
  });

  it('realm-rank reads (player card + public profile) gate BOTH count arms', async () => {
    // lifetimeXpStanding (owned, the card's "Top N%") and
    // lifetimeXpRankForCharacter (the public profile) each count `ahead` and
    // `total` over the realm; both counts must exclude banned/suspended
    // accounts or a delisted higher-XP account still inflates rank and total
    // though it appears on no board. The fragment therefore lands TWICE per
    // query, once per count arm; the `own`/ownership subquery stays ungated.
    const occurrences = (haystack: string, needle: string): number =>
      haystack.split(needle).length - 1;
    for (const run of [() => lifetimeXpStanding(1, 42), () => lifetimeXpRankForCharacter(42)]) {
      const sql = await capturedSql(run);
      expect(sql).toHaveLength(1);
      expect(occurrences(sql[0], ELIGIBLE_LITERAL)).toBe(2);
      expect(occurrences(sql[0], 'a.id = characters.account_id')).toBe(2);
    }
  });

  it('daily rewards: all five ranked reads agree on one population', async () => {
    const db = new PgDailyRewardDb();
    const day = '2026-07-08';
    for (const read of [
      () => db.leaderboard(day, 1, 10),
      () => db.leaderboardRowForAccount(day, 1),
      () => db.leaderboardTotal(day),
      () => db.rankForAccount(day, 1),
    ]) {
      const sql = await capturedSql(read);
      expect(sql).toHaveLength(1);
      expect(sql[0]).toContain(ELIGIBLE_LITERAL);
      expect(sql[0]).toContain('a.id = s.account_id');
    }
    // leaderboardPage issues the total read then the page read; both embed it.
    const pageSql = await capturedSql(() => db.leaderboardPage(day, 0, 10));
    expect(pageSql).toHaveLength(2);
    for (const text of pageSql) {
      expect(text).toContain(ELIGIBLE_LITERAL);
      expect(text).toContain('a.id = s.account_id');
    }
  });
});

// ---------------------------------------------------------------------------
// The cache-bust hook: moderateAccount fires it after a successful commit of
// ANY action kind and never on failure, so a ban delists (and an unban
// relists) without waiting out a board TTL.
// ---------------------------------------------------------------------------

function clientStub(overrides?: { failOn?: RegExp; unsuspendRowCount?: number }): PoolClient {
  const query = vi.fn((text: string) => {
    if (overrides?.failOn?.test(text)) return Promise.reject(new Error('boom'));
    const rowCount = /suspended_until > now\(\)/.test(text)
      ? (overrides?.unsuspendRowCount ?? 1)
      : 1;
    return Promise.resolve({ command: '', rowCount, oid: 0, fields: [], rows: [] });
  });
  return { query, release: vi.fn() } as unknown as PoolClient;
}

const FUTURE = new Date(Date.now() + 60 * 60 * 1000).toISOString();

describe('the moderation bust hook', () => {
  it('fires exactly once per successful action, for every action kind', async () => {
    const hook = vi.fn();
    setOnAccountModerated(hook);
    vi.spyOn(pool, 'connect').mockImplementation(() => Promise.resolve(clientStub()) as never);
    const base = { accountId: 7, adminAccountId: 1, reason: 'test' };
    // Asserted after EACH action, so a kind that never fires and a kind that
    // double-fires both redden (a running 4-total could mask one with the other).
    await moderateAccount({ ...base, action: 'ban' });
    expect(hook).toHaveBeenCalledTimes(1);
    await moderateAccount({ ...base, action: 'unban' });
    expect(hook).toHaveBeenCalledTimes(2);
    await moderateAccount({ ...base, action: 'suspend', expiresAt: FUTURE });
    expect(hook).toHaveBeenCalledTimes(3);
    await moderateAccount({ ...base, action: 'unsuspend' });
    expect(hook).toHaveBeenCalledTimes(4);
  });

  it('does not fire when unsuspend finds no standing suspension', async () => {
    const hook = vi.fn();
    setOnAccountModerated(hook);
    vi.spyOn(pool, 'connect').mockImplementation(
      () => Promise.resolve(clientStub({ unsuspendRowCount: 0 })) as never,
    );
    await expect(
      moderateAccount({ accountId: 7, adminAccountId: 1, action: 'unsuspend', reason: 'test' }),
    ).rejects.toThrow(/not suspended/);
    expect(hook).not.toHaveBeenCalled();
  });

  it('does not fire when the transaction fails', async () => {
    const hook = vi.fn();
    setOnAccountModerated(hook);
    vi.spyOn(pool, 'connect').mockImplementation(
      () => Promise.resolve(clientStub({ failOn: /UPDATE accounts/ })) as never,
    );
    await expect(
      moderateAccount({ accountId: 7, adminAccountId: 1, action: 'ban', reason: 'test' }),
    ).rejects.toThrow('boom');
    expect(hook).not.toHaveBeenCalled();
  });

  it('does not fire when validation rejects before any write', async () => {
    const hook = vi.fn();
    setOnAccountModerated(hook);
    const connect = vi.spyOn(pool, 'connect');
    await expect(
      moderateAccount({ accountId: 7, adminAccountId: 1, action: 'ban', reason: '' }),
    ).rejects.toThrow(/reason/);
    expect(hook).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it('a throwing hook never turns a committed action into an error', async () => {
    setOnAccountModerated(() => {
      throw new Error('hook exploded');
    });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(pool, 'connect').mockImplementation(() => Promise.resolve(clientStub()) as never);
    await expect(
      moderateAccount({ accountId: 7, adminAccountId: 1, action: 'ban', reason: 'test' }),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe('main.ts wiring', () => {
  it('injects the bust hook and nulls every cached board scope', () => {
    const src = readFileSync(resolve(__dirname, '../../server/main.ts'), 'utf8');
    expect(src).toContain('setOnAccountModerated(bustBoardCaches)');
    const start = src.indexOf('function bustBoardCaches');
    expect(start).toBeGreaterThan(-1);
    const body = src.slice(start, src.indexOf('}', start));
    // Players realm + global, guilds realm + global, and the deeds board:
    // every cached scope. Arena is served uncached and the daily-rewards
    // board reads per request, so neither appears here by design.
    expect(body).toContain('leaderboardCache.realm = null');
    expect(body).toContain('leaderboardCache.global = null');
    expect(body).toContain('guildLeaderboardCache.realm = null');
    expect(body).toContain('guildLeaderboardCache.global = null');
    expect(body).toContain('deedsBoardCache = null');
  });
});
