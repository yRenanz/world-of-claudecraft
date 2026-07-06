// Common-tier crafting resolution (issue #1127). Behind the SimContext seam:
// checks a player has every reagent a recipe requires, consumes them (denying
// and consuming NOTHING if any reagent is short), rolls the output's quality
// via the shared material-rarity ladder (rollMaterialRarity, keyed on the
// player's craft skill for this recipe's craft rather than gathering
// proficiency: same ladder, different "power" input, exactly the reuse the
// gathering.ts comment on that function invites), grants the resulting item,
// and grants a flat point of craft skill (see wheel.ts: additive-only,
// free-floor).
//
// Scope: COMMON TIER ONLY (skillReq 0 on every recipe in content/recipes.ts).
// Higher-tier gating, the wheel, and archetype-exclusive combos are later
// issues; this module resolves exactly the common-tier path end to end.
//
// Specialization material discount (#1134): once a player is specialized in a
// recipe's craft (wheel.ts `isSpecialized`, gated on `PERK_THRESHOLDS`
// content), every reagent's required quantity is discounted via
// `materialCostMultiplier`, floored, with a minimum of 1 (a discount can never
// make a recipe free of an ingredient it needs at least one of). This is
// applied identically to the availability check and the actual consumption,
// so a specialized crafter is never asked for more than they are charged.
//
// This module is `src/sim`-pure (see src/sim/CLAUDE.md): no DOM/render/ui/
// game/net imports, no Math.random/Date.now, host-agnostic so it runs
// offline, on the server, and in the headless RL env unchanged.

import { recipeById } from '../content/recipes';
import type { SimContext } from '../sim_context';
import { type MaterialRarity, rollMaterialRarity } from './gathering';
import type { ProfessionRecipeRecord } from './types';
import {
  type CraftSkillState,
  gainCraftSkill,
  materialCostMultiplier,
  tierCapability,
  tierForSkill,
  tierProgressMultiplier,
} from './wheel';

// One flat craft-skill point per successful common-tier craft (the free-floor
// rule: common-tier crafting itself never costs anything, but skill still
// accrues so later tiers have something to build a gate against).
const CRAFT_SKILL_GAIN = 1;

export interface CraftResult {
  ok: boolean;
  recipeId: string;
  // Present only when ok: the granted item id/count and the rolled quality.
  itemId?: string;
  count?: number;
  quality?: MaterialRarity;
  // Present only when !ok: a stable reason code, not player-facing prose (the
  // caller renders/localizes the denial).
  reason?: 'unknown_recipe' | 'insufficient_materials';
}

/**
 * The quantity of one reagent actually required after the crafter's
 * specialization discount (#1134): `count` multiplied by
 * `materialCostMultiplier` for `professionId`, floored, with a minimum of 1.
 * A non-specialized crafter (multiplier 1) always gets back the listed
 * `count` unchanged.
 */
export function discountedReagentCount(
  count: number,
  craftSkills: CraftSkillState,
  professionId: string,
): number {
  const multiplier = materialCostMultiplier(craftSkills, professionId);
  return Math.max(1, Math.floor(count * multiplier));
}

/** Whether the given player currently holds every reagent a recipe requires,
 *  in the required quantities, after that player's specialization discount
 *  (#1134). Read-only: never mutates inventory. */
export function hasRecipeMaterials(
  ctx: SimContext,
  recipe: ProfessionRecipeRecord,
  pid: number,
): boolean {
  const meta = ctx.players.get(pid);
  const craftSkills = meta ? meta.craftSkills : {};
  return recipe.reagents.every(
    (r) =>
      ctx.countItem(r.itemId, pid) >=
      discountedReagentCount(r.count, craftSkills, recipe.professionId),
  );
}

/** Pure resolution of one craft attempt against an already-resolved recipe
 *  record and player entity id (issue #1128 tiered mastery gating): denies
 *  (no side effect at all) if any reagent is short, partial consumption never
 *  happens. On success, consumes every reagent (each discounted per the
 *  crafter's specialization, #1134), rolls the output's quality off the
 *  player's current skill in the recipe's craft, grants the output item, and
 *  grants craft skill scaled by tier mastery: full at or above the player's
 *  tier capability (including always-full for the common tier, regardless of
 *  capability), reduced one tier below, zero two or more tiers below.
 *  Exported separately from `resolveCraft` so tests can exercise the tier
 *  curve against a synthetic recipe without needing higher-tier content in
 *  `content/recipes.ts`. */
export function resolveCraftForRecipe(
  ctx: SimContext,
  pid: number,
  recipe: ProfessionRecipeRecord,
): CraftResult {
  if (!hasRecipeMaterials(ctx, recipe, pid)) {
    return { ok: false, recipeId: recipe.id, reason: 'insufficient_materials' };
  }
  const meta = ctx.players.get(pid);
  const craftSkills = meta ? meta.craftSkills : {};
  for (const reagent of recipe.reagents) {
    const qty = discountedReagentCount(reagent.count, craftSkills, recipe.professionId);
    ctx.removeItem(reagent.itemId, qty, pid);
  }
  const skill = meta ? (meta.craftSkills[recipe.professionId] ?? 0) : 0;
  const quality = rollMaterialRarity(skill, ctx.rng);
  ctx.addItem(recipe.resultItemId, recipe.resultCount, pid);
  if (meta) {
    const capabilityTier = tierCapability(meta.craftSkills, recipe.professionId);
    const recipeTier = tierForSkill(recipe.skillReq);
    const multiplier = tierProgressMultiplier(capabilityTier, recipeTier);
    gainCraftSkill(meta.craftSkills, recipe.professionId, CRAFT_SKILL_GAIN * multiplier);
  }
  return {
    ok: true,
    recipeId: recipe.id,
    itemId: recipe.resultItemId,
    count: recipe.resultCount,
    quality,
  };
}

/** Pure resolution of one craft attempt against one recipe id, given an
 *  already-resolved player entity id: denies with `unknown_recipe` if the id
 *  does not resolve, otherwise delegates to `resolveCraftForRecipe`. */
export function resolveCraft(ctx: SimContext, pid: number, recipeId: string): CraftResult {
  const recipe = recipeById(recipeId);
  if (!recipe) return { ok: false, recipeId, reason: 'unknown_recipe' };
  return resolveCraftForRecipe(ctx, pid, recipe);
}

// Command entry point (behind the SimContext seam): resolves one player's
// craft attempt, resolving the caller's own player entity the same way every
// other immediate-interaction command does (ctx.resolve). A denial is
// surfaced solely through the returned CraftResult's `reason`, which the
// caller mirrors as a `craftResult` event and renders via the localized
// hudChrome.crafting.* catalog keys; this must not also emit a ctx.error
// toast, or a denied craft prints twice and the second copy is unlocalized.
// Runs on the deterministic tick the wire command arrives on, never off-tick.
export function craftItem(ctx: SimContext, recipeId: string, pid?: number): CraftResult {
  const r = ctx.resolve(pid);
  if (!r) return { ok: false, recipeId, reason: 'unknown_recipe' };
  return resolveCraft(ctx, r.meta.entityId, recipeId);
}
