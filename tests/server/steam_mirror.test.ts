// The Steam achievement mirror (server/steam/mirror.ts): observer-only
// no-op guards, the hot-path never-awaits contract, in-flight dedupe, the
// capped retry ladder, the link cache (TTL + synchronous invalidation on
// link change), reconcile-on-link pushing exactly the mapped subset, and the
// push-time link revalidation that makes an unlink a revocation barrier.
process.env.DATABASE_URL ||= 'postgres://test:test@127.0.0.1:5433/wocc_steam_mirror_units';

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ACHIEVEMENT_MAP } from '../../server/steam/achievement_map';
import {
  LINK_CACHE_TTL_MS,
  LOGIN_RECONCILE_TTL_MS,
  MAX_PUSH_ATTEMPTS,
  onDeedRecorded,
  onLinkChanged,
  PUSH_BACKOFF_BASE_MS,
  RECONCILE_STAMP_SWEEP_SIZE,
  reconcileLink,
  reconcileOnLogin,
  reconcileStampCountForTests,
  resetSteamMirrorForTests,
  setSteamMirrorDepsForTests,
  steamMirrorIdle,
} from '../../server/steam/mirror';

const ACCOUNT_ID = 7;
const STEAM_ID = '76561198000000001';
const OLD_STEAM_ID = '76561198000000002';

// Real mapped ids straight from the shipped map (the map suite pins the map
// itself; this suite only needs members and a guaranteed non-member).
const mappedEntries = Object.entries(ACHIEVEMENT_MAP);
const [MAPPED_DEED, MAPPED_ACH] = mappedEntries[0];
const [MAPPED_DEED_2, MAPPED_ACH_2] = mappedEntries[1];
const UNMAPPED_DEED = 'not_a_real_deed_id';

const savedEnv: Record<string, string | undefined> = {};
const STEAM_ENV_KEYS = ['STEAM_ENABLED', 'STEAM_APP_ID', 'STEAM_WEB_API_KEY'] as const;

function enableSteam(): void {
  process.env.STEAM_ENABLED = '1';
  process.env.STEAM_APP_ID = '480';
  process.env.STEAM_WEB_API_KEY = 'raw-test-publisher-value';
}

let pushMock: ReturnType<typeof vi.fn>;
let linkMock: ReturnType<typeof vi.fn>;
let earnedMock: ReturnType<typeof vi.fn>;
let delayMock: ReturnType<typeof vi.fn>;
let clock: number;

/** Give every queued microtask chain (cache lookup -> enqueue -> drain) room
 *  to settle; the injected delay resolves instantly so this is bounded. */
async function settle(): Promise<void> {
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await steamMirrorIdle();
  for (let i = 0; i < 10; i++) await Promise.resolve();
  await steamMirrorIdle();
}

beforeEach(() => {
  for (const key of STEAM_ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  clock = 1_000_000;
  pushMock = vi.fn(async () => true);
  linkMock = vi.fn(async () => ({ steamId: STEAM_ID }));
  earnedMock = vi.fn(async () => [] as string[]);
  delayMock = vi.fn(async () => {});
  setSteamMirrorDepsForTests({
    pushUnlock: pushMock as never,
    linkForAccount: linkMock as never,
    earnedDeedIds: earnedMock as never,
    delay: delayMock as never,
    now: () => clock,
  });
});

afterEach(() => {
  resetSteamMirrorForTests();
  for (const key of STEAM_ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.restoreAllMocks();
});

describe('observer no-op guards', () => {
  it('does nothing when the flag is off: no link read, no push', async () => {
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    expect(linkMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('does nothing for an unmapped deed, without even a link read', async () => {
    enableSteam();
    onDeedRecorded(ACCOUNT_ID, UNMAPPED_DEED);
    await settle();
    expect(linkMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('does nothing for an unlinked account', async () => {
    enableSteam();
    linkMock.mockResolvedValue(null);
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    expect(linkMock).toHaveBeenCalledTimes(1);
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('enabled but unprovisioned (no app id or key) drops with one warn and never pushes', async () => {
    // A misconfigured host: STEAM_ENABLED=1 with STEAM_APP_ID/STEAM_WEB_API_KEY
    // unset. The drain must drop the unlock (one fixed warn line, no secrets to
    // leak because there are none) rather than crash or push garbage, and the
    // queue must keep draining afterwards.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.STEAM_ENABLED = '1';
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    expect(pushMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'steam mirror: enabled without STEAM_APP_ID/STEAM_WEB_API_KEY, dropping unlock',
    );
    // The drop did not wedge the worker: a later provisioned unlock pushes.
    enableSteam();
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED_2);
    await settle();
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith(
      expect.objectContaining({ steamId: STEAM_ID, achName: MAPPED_ACH_2 }),
    );
  });

  it('swallows a failing link read and does not cache the failure', async () => {
    enableSteam();
    linkMock.mockRejectedValueOnce(new Error('db down'));
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    expect(pushMock).not.toHaveBeenCalled();
    // The failed lookup was evicted: the next unlock re-reads and delivers
    // (two lookup reads plus the delivered push's revalidation read).
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    expect(linkMock).toHaveBeenCalledTimes(3);
    expect(pushMock).toHaveBeenCalledTimes(1);
  });
});

describe('the hot path never awaits', () => {
  it('onDeedRecorded returns synchronously (void) and nothing downstream runs until the IO resolves', async () => {
    enableSteam();
    // The link read is held open: if the hot path awaited anything, control
    // would never come back while this promise is pending.
    let release: (row: { steamId: string } | null) => void = () => {};
    linkMock.mockImplementationOnce(
      () => new Promise<{ steamId: string } | null>((resolve) => (release = resolve)),
    );
    const returned = onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    // Synchronous contract: undefined return with the lookup still pending,
    // and no push has happened (the game loop moved on already).
    expect(returned).toBeUndefined();
    expect(pushMock).not.toHaveBeenCalled();
    release({ steamId: STEAM_ID });
    await settle();
    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it('reconcileLink returns synchronously (void) too', () => {
    enableSteam();
    const returned = reconcileLink(ACCOUNT_ID, STEAM_ID);
    expect(returned).toBeUndefined();
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe('delivery, dedupe, and the retry ladder', () => {
  it('pushes a mapped unlock for a linked account with the provisioned key + app id', async () => {
    enableSteam();
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith({
      key: 'raw-test-publisher-value',
      appId: 480,
      steamId: STEAM_ID,
      achName: MAPPED_ACH,
    });
  });

  it('dedupes an in-flight (account, steamId, achievement) triple to one push', async () => {
    enableSteam();
    let release: (ok: boolean) => void = () => {};
    pushMock.mockImplementationOnce(() => new Promise<boolean>((resolve) => (release = resolve)));
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    // Duplicate delivery while the first is in flight (retro re-emit shape).
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    release(true);
    await settle();
    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it('retries with capped exponential backoff then drops with one warn line', async () => {
    enableSteam();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    pushMock.mockResolvedValue(false);
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    expect(pushMock).toHaveBeenCalledTimes(MAX_PUSH_ATTEMPTS);
    // The ladder shape below is a self-comparison against the constant, so pin
    // the base magnitude to a literal: changing 1000 to 1 or 600000 (a broken
    // backoff) would otherwise keep the ladder assertion green.
    expect(PUSH_BACKOFF_BASE_MS).toBe(1000);
    expect(delayMock.mock.calls.map((c) => c[0])).toEqual([
      PUSH_BACKOFF_BASE_MS,
      PUSH_BACKOFF_BASE_MS * 2,
      PUSH_BACKOFF_BASE_MS * 4,
    ]);
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain(MAPPED_ACH);
    // The drop line never leaks the key or an upstream URL/body.
    expect(line).not.toContain('raw-test-publisher-value');
    expect(line).not.toContain('http');
  });

  it('a mid-ladder success stops the retries and drops nothing', async () => {
    enableSteam();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    pushMock.mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValue(true);
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    expect(pushMock).toHaveBeenCalledTimes(3);
    expect(warn).not.toHaveBeenCalled();
  });

  it('a failed pair may redeliver later (dedupe clears after the attempt settles)', async () => {
    enableSteam();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    pushMock.mockResolvedValue(false);
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    pushMock.mockResolvedValue(true);
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    expect(pushMock).toHaveBeenCalledTimes(MAX_PUSH_ATTEMPTS + 1);
  });
});

describe('the link cache', () => {
  it('a burst for one account does exactly one lookup read inside the TTL', async () => {
    enableSteam();
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED_2);
    await settle();
    // One cached lookup read for the whole burst; each delivered push then
    // adds its own revalidation read, so three reads for two pushes.
    expect(linkMock).toHaveBeenCalledTimes(3);
    expect(pushMock).toHaveBeenCalledTimes(2);
  });

  it('re-reads after the TTL expires', async () => {
    enableSteam();
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    clock += LINK_CACHE_TTL_MS + 1;
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED_2);
    await settle();
    // Two lookup reads (the TTL expired between the unlocks) plus one
    // revalidation read per delivered push.
    expect(linkMock).toHaveBeenCalledTimes(4);
  });
});

describe('reconcile-on-link', () => {
  it('pushes exactly the earned-and-mapped intersection to the new steam id', async () => {
    enableSteam();
    earnedMock.mockResolvedValue([MAPPED_DEED, UNMAPPED_DEED, MAPPED_DEED_2]);
    reconcileLink(ACCOUNT_ID, STEAM_ID);
    await settle();
    expect(earnedMock).toHaveBeenCalledWith(ACCOUNT_ID);
    expect(pushMock).toHaveBeenCalledTimes(2);
    const pushed = pushMock.mock.calls.map((c) => c[0]);
    expect(pushed).toEqual([
      expect.objectContaining({ steamId: STEAM_ID, achName: MAPPED_ACH }),
      expect.objectContaining({ steamId: STEAM_ID, achName: MAPPED_ACH_2 }),
    ]);
  });

  it('is inert while the flag is off (a stray call cannot leak)', async () => {
    reconcileLink(ACCOUNT_ID, STEAM_ID);
    await settle();
    expect(earnedMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('after unlink + relink, unlocks flow to the NEW id and never the old one', async () => {
    enableSteam();
    // Seed the cache with the OLD link (an unlock while it was live).
    linkMock.mockResolvedValue({ steamId: OLD_STEAM_ID });
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    expect(pushMock).toHaveBeenLastCalledWith(expect.objectContaining({ steamId: OLD_STEAM_ID }));

    // Unlink: the route deletes the row, then calls onLinkChanged(account,
    // null) in-request, so the stale cached id is dead immediately, not a
    // TTL later.
    linkMock.mockResolvedValue(null);
    onLinkChanged(ACCOUNT_ID, null);
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED_2);
    await settle();
    expect(pushMock).toHaveBeenCalledTimes(1);

    // Relink to the NEW id (the route inserts the row before reconciling):
    // reconcile re-pushes history there, and fresh unlocks follow, all
    // without ever touching the old id again. This also pins that the
    // push-time revalidation compares Steam ids rather than mere row
    // existence: queued pushes for the NEW id must keep flowing.
    linkMock.mockResolvedValue({ steamId: STEAM_ID });
    earnedMock.mockResolvedValue([MAPPED_DEED]);
    reconcileLink(ACCOUNT_ID, STEAM_ID);
    await settle();
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED_2);
    await settle();
    const pushedAfterRelink = pushMock.mock.calls.slice(1).map((c) => c[0].steamId);
    expect(pushedAfterRelink).toEqual([STEAM_ID, STEAM_ID]);
  });
});

describe('unlink is a revocation barrier', () => {
  it('drops a reconcile push when the account unlinks while the earned read is in flight', async () => {
    enableSteam();
    let releaseEarned: (deedIds: string[]) => void = () => {};
    earnedMock.mockImplementationOnce(
      () => new Promise<string[]>((resolve) => (releaseEarned = resolve)),
    );
    reconcileLink(ACCOUNT_ID, STEAM_ID);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    // The unlink lands while the earned read is pending: row deleted, cache
    // flipped, but the reconcile closure already captured the steam id.
    linkMock.mockResolvedValue(null);
    onLinkChanged(ACCOUNT_ID, null);
    releaseEarned([MAPPED_DEED]);
    await settle();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('drops an unlock when the account unlinks while the link lookup is in flight', async () => {
    enableSteam();
    let releaseLookup: (row: { steamId: string } | null) => void = () => {};
    linkMock.mockImplementationOnce(
      () => new Promise<{ steamId: string } | null>((resolve) => (releaseLookup = resolve)),
    );
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    // The unlink lands mid-lookup; every later read sees no row, but the
    // pending lookup promise still resolves to the old link.
    linkMock.mockResolvedValue(null);
    onLinkChanged(ACCOUNT_ID, null);
    releaseLookup({ steamId: OLD_STEAM_ID });
    await settle();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('a warm cache from before a peer-process unlink cannot push past the DB row', async () => {
    enableSteam();
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    expect(pushMock).toHaveBeenCalledTimes(1);
    // The unlink lands on ANOTHER realm process: the DB row is gone, but
    // onLinkChanged never fires here, so this process's cache entry stays
    // positive for the TTL tail.
    linkMock.mockResolvedValue(null);
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED_2);
    await settle();
    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it("a reconcile for the NEW account is not swallowed by the OLD account's in-flight push", async () => {
    enableSteam();
    const ACCOUNT_B = ACCOUNT_ID + 1;
    // Hold account A's push open so its pending entry is still live when the
    // Steam account moves: the dedupe key must not collide across accounts,
    // or B's reconcile item is silently discarded and nothing ever heals it
    // (reconcile runs only at link time).
    let releasePush: (ok: boolean) => void = () => {};
    pushMock.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (releasePush = resolve)),
    );
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(pushMock).toHaveBeenCalledTimes(1);
    // The Steam account moves from A to B: A's row is gone, B's row names S.
    linkMock.mockImplementation(async (accountId: number) =>
      accountId === ACCOUNT_B ? { steamId: STEAM_ID } : null,
    );
    earnedMock.mockResolvedValue([MAPPED_DEED]);
    reconcileLink(ACCOUNT_B, STEAM_ID);
    for (let i = 0; i < 10; i++) await Promise.resolve();
    releasePush(true);
    await settle();
    expect(pushMock).toHaveBeenCalledTimes(2);
    expect(pushMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ steamId: STEAM_ID, achName: MAPPED_ACH }),
    );
  });

  it('a warm cache from before a peer-process RELINK cannot push to the old id', async () => {
    enableSteam();
    // Seed this process's cache with the OLD link.
    linkMock.mockResolvedValue({ steamId: OLD_STEAM_ID });
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    expect(pushMock).toHaveBeenLastCalledWith(expect.objectContaining({ steamId: OLD_STEAM_ID }));
    // The relink lands on ANOTHER realm process: the DB row now names a
    // DIFFERENT steam id, while this process's warm cache still answers the
    // old one. The push-time revalidation must compare ids, not row
    // existence, so the stale-id push is dropped.
    linkMock.mockResolvedValue({ steamId: STEAM_ID });
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED_2);
    await settle();
    const pushedIds = pushMock.mock.calls.map((c) => c[0].steamId);
    expect(pushedIds).toEqual([OLD_STEAM_ID]);
  });
});

describe('push-time revalidation read resilience', () => {
  it('retries a rejected revalidation read once and still delivers the push', async () => {
    enableSteam();
    linkMock
      .mockResolvedValueOnce({ steamId: STEAM_ID }) // the lookup-path (cache) read
      .mockRejectedValueOnce(new Error('transient blip')) // revalidation, first try
      .mockResolvedValueOnce({ steamId: STEAM_ID }); // revalidation retry
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({ achName: MAPPED_ACH }));
    expect(linkMock).toHaveBeenCalledTimes(3);
  });

  it('a push attempt that THROWS drops that item with one warn and never wedges the drain', async () => {
    // pushUnlock's contract is resolve-boolean, but the drain must survive a
    // contract breach: without the backstop the rejection becomes an unhandled
    // rejection (process-fatal under Node defaults) and every queued item
    // behind it stalls until some future enqueue restarts the worker.
    enableSteam();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    pushMock.mockRejectedValueOnce(new Error('contract breach'));
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED_2);
    await settle();
    // The first item dropped with the backstop line; the second still delivered.
    expect(pushMock).toHaveBeenCalledTimes(2);
    expect(pushMock).toHaveBeenLastCalledWith(expect.objectContaining({ achName: MAPPED_ACH_2 }));
    const backstopLines = warn.mock.calls
      .map((call) => String(call[0]))
      .filter((line) => line.includes('push attempt threw unexpectedly'));
    expect(backstopLines).toEqual([
      `steam mirror: dropping unlock ${MAPPED_ACH}, push attempt threw unexpectedly`,
    ]);
  });

  it('drops with one warn line, never silently, when the revalidation read fails twice', async () => {
    enableSteam();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    linkMock
      .mockResolvedValueOnce({ steamId: STEAM_ID })
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('still down'));
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    expect(pushMock).not.toHaveBeenCalled();
    const dropLines = warn.mock.calls
      .map((call) => String(call[0]))
      .filter((line) => line.includes('link revalidation read failed twice'));
    expect(dropLines).toHaveLength(1);
    // One fixed line, no URL, no body, no key (the module's log contract).
    expect(dropLines[0]).toBe(
      `steam mirror: dropping unlock ${MAPPED_ACH}, link revalidation read failed twice`,
    );
  });
});

describe('per-attempt revalidation is a mid-ladder revocation barrier', () => {
  it('an unlink BETWEEN retry attempts stops the ladder: no push to the revoked id', async () => {
    enableSteam();
    linkMock.mockResolvedValue({ steamId: STEAM_ID });
    // Attempt 1 pushes (fails); the unlink lands before attempt 2 can
    // revalidate. A once-before-the-loop read would have kept pushing to the
    // dead id for all MAX_PUSH_ATTEMPTS attempts.
    pushMock.mockImplementationOnce(async () => {
      linkMock.mockResolvedValue(null);
      return false;
    });
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    // Exactly one push: attempt 2's fresh revalidation saw the revoked link and
    // dropped the item before pushing again.
    expect(pushMock).toHaveBeenCalledTimes(1);
  });

  it('a RELINK to a new id between attempts drops the in-flight item, never pushing the old item to the new id', async () => {
    enableSteam();
    linkMock.mockResolvedValue({ steamId: OLD_STEAM_ID });
    // Attempt 1 targets the old id (fails); a relink to a NEW id lands before
    // attempt 2 revalidates.
    pushMock.mockImplementationOnce(async () => {
      linkMock.mockResolvedValue({ steamId: STEAM_ID });
      return false;
    });
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    expect(pushMock).toHaveBeenCalledTimes(1);
    // The single push named the OLD id; nothing was ever pushed to the new id
    // under this (old-id) item.
    expect(pushMock).toHaveBeenCalledWith(expect.objectContaining({ steamId: OLD_STEAM_ID }));
    const pushedIds = pushMock.mock.calls.map((c) => c[0].steamId);
    expect(pushedIds).not.toContain(STEAM_ID);
  });
});

describe('reconcile-on-login: the durable heal for a dropped push', () => {
  it('re-pushes an unlock that the retry ladder dropped (character_deeds is the outbox)', async () => {
    enableSteam();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // A live unlock whose push exhausts the ladder and drops: the in-memory
    // queue holds nothing afterward and grantDeed never re-emits it.
    pushMock.mockResolvedValue(false);
    onDeedRecorded(ACCOUNT_ID, MAPPED_DEED);
    await settle();
    expect(pushMock).toHaveBeenCalledTimes(MAX_PUSH_ATTEMPTS);
    expect(warn).toHaveBeenCalledTimes(1);
    // The next login reconciles from the durable earned set with delivery now
    // healthy: the dropped unlock is re-pushed to the linked Steam id.
    pushMock.mockClear();
    pushMock.mockResolvedValue(true);
    earnedMock.mockResolvedValue([MAPPED_DEED]);
    reconcileOnLogin(ACCOUNT_ID);
    await settle();
    expect(earnedMock).toHaveBeenCalledWith(ACCOUNT_ID);
    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith(
      expect.objectContaining({ steamId: STEAM_ID, achName: MAPPED_ACH }),
    );
  });

  it('throttles repeated logins: two calls inside the TTL do exactly one earned read', async () => {
    enableSteam();
    earnedMock.mockResolvedValue([MAPPED_DEED]);
    reconcileOnLogin(ACCOUNT_ID);
    await settle();
    reconcileOnLogin(ACCOUNT_ID);
    await settle();
    expect(earnedMock).toHaveBeenCalledTimes(1);
    // Past the TTL the same account reconciles again.
    clock += LOGIN_RECONCILE_TTL_MS + 1;
    reconcileOnLogin(ACCOUNT_ID);
    await settle();
    expect(earnedMock).toHaveBeenCalledTimes(2);
  });

  it('is inert while the flag is off (no read, no push)', async () => {
    reconcileOnLogin(ACCOUNT_ID);
    await settle();
    expect(linkMock).not.toHaveBeenCalled();
    expect(earnedMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('does nothing for an unlinked account: resolves the link, reads no earned set, pushes nothing', async () => {
    enableSteam();
    linkMock.mockResolvedValue(null);
    reconcileOnLogin(ACCOUNT_ID);
    await settle();
    expect(earnedMock).not.toHaveBeenCalled();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('sweeps expired throttle stamps once the map outgrows the bound', async () => {
    enableSteam();
    linkMock.mockResolvedValue(null);
    // Unlinked accounts still take a stamp (by design), which makes filling
    // the map cheap here.
    for (let acct = 1; acct <= RECONCILE_STAMP_SWEEP_SIZE; acct++) reconcileOnLogin(acct);
    await settle();
    expect(reconcileStampCountForTests()).toBe(RECONCILE_STAMP_SWEEP_SIZE);
    // Inside the TTL nothing has expired: the bound triggers a sweep that
    // removes nothing and the map grows past it (a sweep trigger, not a cap).
    reconcileOnLogin(RECONCILE_STAMP_SWEEP_SIZE + 1);
    await settle();
    expect(reconcileStampCountForTests()).toBe(RECONCILE_STAMP_SWEEP_SIZE + 1);
    // Past the TTL every old stamp is dead weight: the next stamp sweeps them
    // all, leaving only itself.
    clock += LOGIN_RECONCILE_TTL_MS + 1;
    reconcileOnLogin(RECONCILE_STAMP_SWEEP_SIZE + 2);
    await settle();
    expect(reconcileStampCountForTests()).toBe(1);
  });
});

describe('server/main.ts shutdown drains the mirror queue', () => {
  // Source scan (main.ts builds a pg pool at load, so it is never imported):
  // an unlock still queued in the mirror's in-memory FIFO at shutdown would be
  // lost on pool.end(), so the drain must await steamMirrorIdle() alongside the
  // other FIFO drains, right after the deeds-records drain and before the lease
  // sweep that lets a replacement process reload the same characters.
  const src = readFileSync(new URL('../../server/main.ts', import.meta.url), 'utf8');

  it('awaits steamMirrorIdle after deedRecordsIdle and before the lease sweep', () => {
    expect(src).toContain('await steamMirrorIdle();');
    const deedIdle = src.indexOf('await deedRecordsIdle();');
    const steamIdle = src.indexOf('await steamMirrorIdle();');
    const leaseSweep = src.indexOf('releaseAllCharacterLeases(');
    expect(deedIdle).toBeGreaterThan(-1);
    expect(steamIdle).toBeGreaterThan(deedIdle);
    expect(leaseSweep).toBeGreaterThan(steamIdle);
  });
});
