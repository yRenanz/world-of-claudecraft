import type { PlayerClass, SkinRank } from '../types';

// ---------------------------------------------------------------------------
// Cosmetic skin-select event — shared, host-agnostic data.
//
// Used by BOTH the authoritative Sim (rank roll + claim validation) and the
// client HUD (overlay gating). It lives in sim/ so it carries no DOM/render
// imports and runs unchanged on the server, offline, and headless.
//
// DEV PLACEHOLDER: until real event skins ship, each tier offers exactly one of
// the per-class alternate skins we already have (index into SKINS[player_<cls>]
// in the renderer; 0 = the class default, which the event does not grant).
// ---------------------------------------------------------------------------

/** The item that opens the skin-select overlay when used. Dev-grantable via
 *  `/dev give event_skin_token` (ALLOW_DEV_COMMANDS only). */
export const EVENT_SKIN_TOKEN_ID = 'event_skin_token';

/** Ranks ordered low → high. A rolled rank unlocks its tier and all below it. */
export const SKIN_RANKS: readonly SkinRank[] = ['uncommon', 'rare', 'epic'] as const;

/** One selectable skin per tier (placeholder mapping onto existing alt skins). */
export interface SkinTier {
  rank: SkinRank;
  /** Index into the renderer's SKINS[player_<cls>] list. */
  skin: number;
}

export const EVENT_SKIN_TIERS: readonly SkinTier[] = [
  { rank: 'uncommon', skin: 1 },
  { rank: 'rare', skin: 2 },
  { rank: 'epic', skin: 3 },
] as const;

/** Ordinal of a rank (0 = lowest). Higher unlocks everything at or below it. */
export function skinRankOrder(rank: SkinRank): number {
  return SKIN_RANKS.indexOf(rank);
}

/** The tier a given skin index belongs to, or null if it maps to no event tier
 *  (e.g. the class default, skin 0). */
export function skinTierFor(skin: number): SkinTier | null {
  return EVENT_SKIN_TIERS.find((tt) => tt.skin === skin) ?? null;
}

/** Server-authoritative gate: may a player holding `granted` rank lock in `skin`?
 *  True only when the skin maps to a tier at or below the granted rank. */
export function rankAllowsSkin(granted: SkinRank, skin: number): boolean {
  const tier = skinTierFor(skin);
  if (!tier) return false;
  return skinRankOrder(tier.rank) <= skinRankOrder(granted);
}

// Per-class count of available skins INCLUDING the default (index 0), mirroring
// the renderer's SKINS map (src/render/characters/manifest.ts). Kept here so the
// host-agnostic sim can validate a chosen skin index without importing render/.
// tests/skin_event.test.ts asserts this stays in lockstep with SKINS.
export const SKIN_COUNTS: Record<PlayerClass, number> = {
  warrior: 4, paladin: 2, hunter: 4, rogue: 4, priest: 4,
  mage: 4, warlock: 4, shaman: 4, druid: 4,
};

/** Whether `skin` is a valid appearance index for `cls` (0 = default). */
export function classHasSkin(cls: PlayerClass, skin: number): boolean {
  return Number.isInteger(skin) && skin >= 0 && skin < SKIN_COUNTS[cls];
}
