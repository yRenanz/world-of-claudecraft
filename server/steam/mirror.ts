// The Steam achievement mirror: an OBSERVER, never an authority. The sim
// decides unlocks, server/deeds_records.ts persists them into character_deeds,
// and this module copies a linked account's unlocks outward to Steam via the
// publisher Web API. Nothing here can grant, deny, or reorder a deed, and the
// 50 ms world loop never awaits any of it: onDeedRecorded returns
// synchronously and all IO happens on a detached in-process FIFO.
//
// Delivery model: at-least-once with in-flight dedupe. Steam's
// SetUserStatsForGame is idempotent for an already-set achievement, so a
// redelivery (crash replay, retro re-emit, reconcile overlap) is harmless. A
// push that still fails after the capped retries is DROPPED with one warn
// line: the in-memory queue holds nothing afterward, so a durable REPLAY heals
// the gap. character_deeds is that durable outbox (the server store is
// canonical and Steam is a mirrored subset), and TWO reconcile paths replay
// from it: reconcile-on-link (the moment an account first links) and
// reconcile-on-login (every join, per-account throttled), so a linked account
// that never re-links still catches up. No periodic sweep in v1 (the Cogmind
// pattern); the login reconcile is the steady-state heal.
//
// Secrets: the publisher key is read inside web_api.ts request builders only;
// no log line here carries a URL, a body, or anything upstream echoed.

import { earnedDeedIdsForAccount } from '../deeds_db';
import { ACHIEVEMENT_MAP } from './achievement_map';
import { steamAppId, steamEnabled, steamWebApiKey } from './config';
import { steamLinkForAccount } from './steam_db';
import { pushAchievementUnlock } from './web_api';

/** Push attempts per unlock before dropping (capped exponential backoff). */
export const MAX_PUSH_ATTEMPTS = 4;
/** Base backoff between attempts; doubles each retry (1s, 2s, 4s). */
export const PUSH_BACKOFF_BASE_MS = 1000;
/** How long a link lookup is trusted before re-reading steam_links. */
export const LINK_CACHE_TTL_MS = 60_000;
/** How long after a login reconcile before the same account reconciles again.
 *  Login churn (reconnects, alt hops) must not re-push an account's whole
 *  earned-and-mapped history every join, so the login heal is throttled to at
 *  most once per this window per account. Long relative to the link cache TTL:
 *  a dropped push is a rare tail event, and the next reconnect after the window
 *  still heals it. */
export const LOGIN_RECONCILE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface MirrorDeps {
  linkForAccount(accountId: number): Promise<{ steamId: string } | null>;
  earnedDeedIds(accountId: number): Promise<string[]>;
  pushUnlock(opts: {
    key: string;
    appId: number;
    steamId: string;
    achName: string;
  }): Promise<boolean>;
  delay(ms: number): Promise<void>;
  now(): number;
}

// Every real dep is a call-time arrow, never a load-time export binding: this
// module rides in game.ts's graph via deeds_records, so a load-time access of
// a db-boundary export would throw inside every test that partial-mocks that
// module with a fixed export list (the known overlay-mock breakage class).
const REAL_DEPS: MirrorDeps = {
  linkForAccount: (accountId) => steamLinkForAccount(accountId),
  earnedDeedIds: (accountId) => earnedDeedIdsForAccount(accountId),
  pushUnlock: (opts) => pushAchievementUnlock(opts),
  delay: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => Date.now(),
};

let deps: MirrorDeps = REAL_DEPS;

/** Override mirror IO with fakes (test-only; merges over the real deps). */
export function setSteamMirrorDepsForTests(overrides: Partial<MirrorDeps>): void {
  deps = { ...REAL_DEPS, ...overrides };
}

// ---------------------------------------------------------------------------
// Link cache. Per-process, short TTL, promise-valued so a retro burst of
// unlocks for one account does exactly one steam_links read on the lookup
// path. The link and unlink routes overwrite entries via onLinkChanged, but
// that is only a latency courtesy: an in-flight lookup or reconcile closure
// has already captured the old id, and PEER realm processes never see the
// flip at all. The actual revocation barrier is the fresh steam_links read
// attemptPush does before every push.
// ---------------------------------------------------------------------------

interface LinkCacheEntry {
  steamId: Promise<string | null>;
  expiresAt: number;
}

const linkCache = new Map<number, LinkCacheEntry>();

function cachedSteamId(accountId: number): Promise<string | null> {
  const now = deps.now();
  const hit = linkCache.get(accountId);
  if (hit && hit.expiresAt > now) return hit.steamId;
  const steamId = deps
    .linkForAccount(accountId)
    .then((row) => row?.steamId ?? null)
    .catch(() => {
      // A failed read is not proof of no link; forget it so the next unlock
      // retries instead of caching "unlinked" for the TTL.
      linkCache.delete(accountId);
      return null;
    });
  linkCache.set(accountId, { steamId, expiresAt: now + LINK_CACHE_TTL_MS });
  return steamId;
}

/** The link and unlink routes call this the moment steam_links changes, so
 *  the mirror's view flips in the same request, not a TTL later. */
export function onLinkChanged(accountId: number, steamId: string | null): void {
  linkCache.set(accountId, {
    steamId: Promise.resolve(steamId),
    expiresAt: deps.now() + LINK_CACHE_TTL_MS,
  });
}

// ---------------------------------------------------------------------------
// The push queue: a plain FIFO drained by one detached worker, with a pending
// set (queued or in flight) so a duplicate delivery of the same
// (account, steamId, achievement) triple collapses while one is already on
// its way. The account id is part of the key: when a Steam account moves
// between WoCC accounts, the old account's in-flight item must not swallow
// the new account's reconcile item (revalidation drops the old one, and
// nothing but reconcile-on-link would ever redeliver the new one).
// ---------------------------------------------------------------------------

interface PushItem {
  accountId: number;
  steamId: string;
  achName: string;
}

const queue: PushItem[] = [];
const pending = new Set<string>();
let draining = false;
let drain: Promise<void> = Promise.resolve();

function pushKey(item: PushItem): string {
  return `${item.accountId}:${item.steamId}:${item.achName}`;
}

function enqueue(item: PushItem): void {
  const key = pushKey(item);
  if (pending.has(key)) return;
  pending.add(key);
  queue.push(item);
  if (draining) return;
  draining = true;
  drain = (async () => {
    try {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) break;
        try {
          await attemptPush(next);
        } catch {
          // attemptPush handles its known failure modes itself; this backstop
          // exists so one unexpectedly-throwing item can never turn the drain
          // promise into an unhandled rejection (process-fatal under Node
          // defaults) and wedge every queued push behind it. Same contract as
          // any other drop: one fixed line, reconcile-on-link heals the gap.
          console.warn(
            `steam mirror: dropping unlock ${next.achName}, push attempt threw unexpectedly`,
          );
        } finally {
          pending.delete(pushKey(next));
        }
      }
    } finally {
      draining = false;
    }
  })();
}

async function attemptPush(item: PushItem): Promise<void> {
  const appId = steamAppId();
  const key = steamWebApiKey();
  if (appId === null || key === null) {
    console.warn('steam mirror: enabled without STEAM_APP_ID/STEAM_WEB_API_KEY, dropping unlock');
    return;
  }
  // Push-time revalidation, the revocation barrier: a fresh steam_links read
  // (deliberately not the TTL cache, which a peer realm process cannot see
  // invalidated) must still name this exact Steam id, or the item was queued
  // by a read that lost a race with an unlink and is dropped. Comparing ids
  // rather than row existence keeps queued pushes flowing after a relink. A
  // REJECTED read proves nothing about the link, so it is retried once (one
  // transient DB blip must not eat a push), and a second rejection drops WITH
  // a warn line so operators can see the loss instead of a silent gap; a
  // reconcile (on link or on login) heals it either way.
  //
  // Revalidated INSIDE the retry loop, before EVERY attempt, not once before
  // it: the backoff ladder can span seconds, and an unlink or relink landing
  // between attempts must stop the very next push, never let attempts 2..N keep
  // pushing to an id the account no longer controls.
  for (let attempt = 1; attempt <= MAX_PUSH_ATTEMPTS; attempt++) {
    let row: { steamId: string } | null;
    try {
      row = await deps.linkForAccount(item.accountId);
    } catch {
      try {
        row = await deps.linkForAccount(item.accountId);
      } catch {
        console.warn(
          `steam mirror: dropping unlock ${item.achName}, link revalidation read failed twice`,
        );
        return;
      }
    }
    if (row?.steamId !== item.steamId) return;
    const ok = await deps.pushUnlock({ key, appId, steamId: item.steamId, achName: item.achName });
    if (ok) return;
    if (attempt < MAX_PUSH_ATTEMPTS) {
      await deps.delay(PUSH_BACKOFF_BASE_MS * 2 ** (attempt - 1));
    }
  }
  // One fixed line, no URL, no body, no key: a reconcile heals the gap.
  console.warn(`steam mirror: dropping unlock ${item.achName} after ${MAX_PUSH_ATTEMPTS} attempts`);
}

// ---------------------------------------------------------------------------
// Entry points.
// ---------------------------------------------------------------------------

// Per-account throttle for the login reconcile: the last time (deps.now) an
// account ran reconcileOnLogin, so login churn cannot re-push whole histories
// every join. Bounded by LOGIN_RECONCILE_TTL_MS.
const lastReconciledAt = new Map<number, number>();
// A stamp older than the TTL no longer throttles anything, so once the map
// outgrows this bound the expired entries are swept before the next stamp:
// a long-lived process holds O(accounts active per TTL window) entries
// instead of one per distinct account since boot.
export const RECONCILE_STAMP_SWEEP_SIZE = 8192;

/**
 * Mirror one recorded unlock. Called by server/deeds_records.ts AFTER the
 * character_deeds upsert for the event resolves (the observer's observer);
 * synchronous and swallow-all so the recorder's FIFO can never be faulted or
 * slowed from here. No-ops unless the flag is on, the deed is in the map, and
 * the account has a link.
 */
export function onDeedRecorded(accountId: number, deedId: string): void {
  try {
    if (!steamEnabled()) return;
    const achName = ACHIEVEMENT_MAP[deedId];
    if (achName === undefined) return;
    void cachedSteamId(accountId)
      .then((steamId) => {
        if (steamId !== null) enqueue({ accountId, steamId, achName });
      })
      .catch(() => {});
  } catch (err) {
    console.error('steam mirror: onDeedRecorded failed:', err);
  }
}

/**
 * Reconcile-on-link: push everything the account already earned, intersected
 * with the map, to the freshly linked Steam id. Fire-and-forget; the link
 * response never waits on it. The server store is canonical and Steam is a
 * mirrored subset, so this one push is the entire sync.
 */
export function reconcileLink(accountId: number, steamId: string): void {
  try {
    if (!steamEnabled()) return;
    onLinkChanged(accountId, steamId);
    void deps
      .earnedDeedIds(accountId)
      .then((deedIds) => {
        for (const deedId of deedIds) {
          const achName = ACHIEVEMENT_MAP[deedId];
          if (achName !== undefined) enqueue({ accountId, steamId, achName });
        }
      })
      .catch((err) => {
        console.error('steam mirror: reconcile read failed:', err);
      });
  } catch (err) {
    console.error('steam mirror: reconcileLink failed:', err);
  }
}

/**
 * Reconcile-on-login: the steady-state durable heal. A live unlock's push can
 * exhaust its retry ladder and DROP (delivery is at-least-once and the queue is
 * in-memory only), and grantDeed never re-emits a deed already in the earned
 * set, so nothing replays it on its own. reconcile-on-link only fires when an
 * account FIRST links (an already-linked account never re-links: the route 409s
 * it), so without this a linked account's dropped push would never heal.
 * character_deeds IS the durable outbox: on join, re-push the account's
 * earned-and-mapped set to its currently linked Steam id, idempotent Steam-side.
 *
 * Called fire-and-forget from the join path (server/game.ts) beside the
 * character_deeds reconcile: returns void immediately, is fully guarded so it
 * can never throw into join, and no-ops unless the flag is on and the account
 * has a link. Throttled per account (LOGIN_RECONCILE_TTL_MS) so reconnect churn
 * stays bounded; the throttle stamp is taken even for an unlinked account so a
 * relink-then-reconnect burst cannot hammer the reads either.
 */
export function reconcileOnLogin(accountId: number): void {
  try {
    if (!steamEnabled()) return;
    const now = deps.now();
    const last = lastReconciledAt.get(accountId);
    if (last !== undefined && now - last < LOGIN_RECONCILE_TTL_MS) return;
    if (lastReconciledAt.size >= RECONCILE_STAMP_SWEEP_SIZE) {
      for (const [acct, at] of lastReconciledAt) {
        if (now - at >= LOGIN_RECONCILE_TTL_MS) lastReconciledAt.delete(acct);
      }
    }
    lastReconciledAt.set(accountId, now);
    void cachedSteamId(accountId)
      .then((steamId) => {
        if (steamId === null) return;
        return deps.earnedDeedIds(accountId).then((deedIds) => {
          for (const deedId of deedIds) {
            const achName = ACHIEVEMENT_MAP[deedId];
            if (achName !== undefined) enqueue({ accountId, steamId, achName });
          }
        });
      })
      .catch((err) => {
        console.error('steam mirror: login reconcile failed:', err);
      });
  } catch (err) {
    console.error('steam mirror: reconcileOnLogin failed:', err);
  }
}

/** The current drain tail, for tests to await deterministic queue settling. */
export function steamMirrorIdle(): Promise<void> {
  return drain;
}

/** The live reconcile-stamp count, for the sweep-bound test only. */
export function reconcileStampCountForTests(): number {
  return lastReconciledAt.size;
}

/** Clear queue, dedupe, and cache state (test-only). */
export function resetSteamMirrorForTests(): void {
  queue.length = 0;
  pending.clear();
  linkCache.clear();
  lastReconciledAt.clear();
  draining = false;
  drain = Promise.resolve();
  deps = REAL_DEPS;
}
