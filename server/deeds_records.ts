// Deeds records: an OBSERVER of the sim's deedUnlocked events, never an
// authority. The sim alone decides unlocks (src/sim/deeds.ts grantDeed) and
// persists them inside the characters.state blob; this module only mirrors
// each unlock into the queryable character_deeds index. It copies the
// bank_ledger runtime shape minus the diffing (deeds are event-driven, so
// there is no before/after snapshot to compare): each insert chains onto a
// per-process FIFO promise tail the game loop NEVER awaits, a rejected insert
// logs and never blocks or reorders anything, and the whole body is guarded
// so the observer can never throw into the caller. Idempotence lives in the
// SQL (ON CONFLICT DO NOTHING over UNIQUE (character_id, deed_id)), so the
// initial retro backfill and crash-replays of unpersisted state are free.
// The guarantee's edge: a deed already persisted in the state blob never
// re-emits on a later login (grantDeed no-ops on the earned set), so a
// TRANSIENT insert failure would leave this index one row short. The
// login-time reconcile (reconcileCharacterDeeds, wired at join in
// server/game.ts) closes that drift: it replays the loaded earned set into
// character_deeds idempotently on every join, so a dropped row is re-created
// the next time the character logs in. The one gap this cannot heal is a
// rollback that strips the deeds fields FROM the blob itself: with the blob no
// longer carrying those ids, there is nothing left to replay from.

import { DEEDS } from '../src/sim/content/deeds';
import type { DeedDef } from '../src/sim/types';
import type { DeedsRarity } from '../src/world_api';
import { insertCharacterDeed, insertCharacterDeeds } from './deeds_db';
import { REALM } from './realm';
// Imported from the mirror module DIRECTLY (not the ./steam barrel): this
// module rides in game.ts's graph, and the barrel would drag routes.ts (and
// its load-time requireAccount over the db module) into every test that
// partial-mocks the db, the known overlay-mock breakage class.
import { onDeedRecorded } from './steam/mirror';

// Per-process FIFO tail. A character lives on one realm process, so chaining
// preserves that character's unlock order; a rejection is caught (logged) and
// the chain continues.
let tail: Promise<void> = Promise.resolve();

/** The marquee bar for the guild/friend broadcast: notable-or-better Renown,
 *  or any cosmetic reward. Pure so the gate is unit-testable. */
export function isMarqueeDeed(def: DeedDef): boolean {
  return def.renown >= 25 || def.reward !== undefined;
}

/** Hidden deeds are invisible until earned, EXISTENCE included (the DeedDef
 *  contract), so anonymous and third-party surfaces must omit them; only the
 *  earner's own Book shows their copy. A drifted id (content removed) reads
 *  as not hidden: it can no longer spoil anything. */
export function isHiddenDeedId(deedId: string): boolean {
  return DEEDS[deedId]?.hidden === true;
}

/** The public form of the rarity aggregate: strip hidden deeds so an
 *  anonymous caller cannot enumerate their ids the moment one player earns
 *  one. Pure; the main.ts cache applies it once per refresh. */
export function publicRarityPayload(payload: DeedsRarity): DeedsRarity {
  const earned: Record<string, number> = {};
  for (const id in payload.earned) {
    if (!isHiddenDeedId(id)) earned[id] = payload.earned[id];
  }
  return { totalEligible: payload.totalEligible, earned };
}

/** Mirror one sim-decided unlock into character_deeds, fire-and-forget.
 *  Returns void immediately (never a promise, never awaited by the game
 *  loop); gameplay never depends on the write landing. */
export function recordDeedUnlock(
  who: { characterId: number; accountId: number },
  deedId: string,
): void {
  try {
    tail = tail
      .then(() =>
        insertCharacterDeed({
          realm: REALM,
          characterId: who.characterId,
          accountId: who.accountId,
          deedId,
        }),
      )
      .then(() => {
        // The Steam mirror observes THIS observer: it hooks in only after the
        // character_deeds upsert resolves, is synchronous + swallow-all
        // (server/steam/mirror.ts), and stays a per-process no-op unless
        // STEAM_ENABLED=1, the deed is mapped, and the account is linked.
        onDeedRecorded(who.accountId, deedId);
      })
      .catch((err) => {
        console.error('character_deeds write failed:', err);
      });
  } catch (err) {
    // The observer must never fault the event-routing path.
    console.error('deeds recordDeedUnlock failed:', err);
  }
}

/** Login-time reconcile: replay a character's whole earned-deed set (from the
 *  authoritative state blob) into character_deeds in ONE idempotent batch,
 *  chained onto the SAME FIFO tail as live unlocks so it never races them. It
 *  heals a row that a transient per-unlock insert failure dropped and that
 *  grantDeed never re-emits (the deed is already in the earned set). Fire-and-
 *  forget: returns void immediately, is fully guarded so it can never throw
 *  into the join path, and a rejected batch logs and continues the chain. An
 *  empty set is a no-op that never touches the tail.
 *
 *  Deliberately does NOT call the Steam onDeedRecorded hook per row. Pushing an
 *  account's entire deed history to the mirror on every login would churn the
 *  push queue for no gain (each already-set achievement is idempotent Steam-
 *  side), and the mirror owns its own reconcileLink path for Steam catch-up.
 *  The character_deeds write is the whole job here. */
export function reconcileCharacterDeeds(
  who: { characterId: number; accountId: number },
  deedIds: readonly string[],
): void {
  if (deedIds.length === 0) return;
  try {
    tail = tail
      .then(() =>
        insertCharacterDeeds(
          { realm: REALM, characterId: who.characterId, accountId: who.accountId },
          deedIds,
        ),
      )
      .catch((err) => {
        console.error('character_deeds reconcile failed:', err);
      });
  } catch (err) {
    // The reconcile must never fault the join path.
    console.error('deeds reconcileCharacterDeeds failed:', err);
  }
}

/** The current FIFO tail, for tests to await the queue draining deterministically. */
export function deedRecordsIdle(): Promise<void> {
  return tail;
}
