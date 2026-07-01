import { describe, expect, it } from 'vitest';
import { COMMON_RECIPES, recipeById } from '../src/sim/content/recipes';
import { hasRecipeMaterials, resolveCraft } from '../src/sim/professions/crafting';
import { Sim } from '../src/sim/sim';

function makeSim(seed = 42) {
  return new Sim({ seed, playerClass: 'warrior', autoEquip: false });
}

function grantItem(sim: Sim, itemId: string, count: number, pid: number) {
  for (let i = 0; i < count; i++) sim.addItem(itemId, 1, pid);
}

describe('recipe content (#1127)', () => {
  it('defines at least one recipe per craft on the ring, all common tier', () => {
    expect(COMMON_RECIPES.length).toBeGreaterThanOrEqual(5);
    for (const recipe of COMMON_RECIPES) {
      expect(recipe.skillReq).toBe(0); // free-floor: common tier costs zero skill
      expect(recipe.reagents.length).toBeGreaterThan(0);
      expect(recipe.resultCount).toBeGreaterThan(0);
    }
  });

  it('recipeById resolves a known id and returns undefined for an unknown one', () => {
    expect(recipeById(COMMON_RECIPES[0].id)?.id).toBe(COMMON_RECIPES[0].id);
    expect(recipeById('not_a_real_recipe')).toBeUndefined();
  });
});

describe('resolveCraft (#1127)', () => {
  it('consumes exactly the required materials and produces the correct output', () => {
    const sim = makeSim();
    const pid = sim.playerId;
    const recipe = recipeById('recipe_tough_jerky')!;
    grantItem(sim, 'spider_leg', 1, pid);

    const result = resolveCraft((sim as any).ctx, pid, recipe.id);

    expect(result.ok).toBe(true);
    expect(result.itemId).toBe('tough_jerky');
    expect(result.count).toBe(1);
    expect(sim.countItem('spider_leg', pid)).toBe(0);
    expect(sim.countItem('tough_jerky', pid)).toBe(1);
  });

  it('consumes multi-reagent recipes down to exactly zero, never over- or under-consuming', () => {
    const sim = makeSim();
    const pid = sim.playerId;
    const recipe = recipeById('recipe_eastbrook_arming_sword')!;
    grantItem(sim, 'bone_fragments', 2, pid);
    grantItem(sim, 'linen_scrap', 1, pid);

    const result = resolveCraft((sim as any).ctx, pid, recipe.id);

    expect(result.ok).toBe(true);
    expect(sim.countItem('bone_fragments', pid)).toBe(0);
    expect(sim.countItem('linen_scrap', pid)).toBe(0);
    expect(sim.countItem('eastbrook_arming_sword', pid)).toBe(1);
  });

  it('denies and consumes NOTHING when any single reagent is short', () => {
    const sim = makeSim();
    const pid = sim.playerId;
    const recipe = recipeById('recipe_eastbrook_arming_sword')!;
    // One bone_fragments short of the required 2.
    grantItem(sim, 'bone_fragments', 1, pid);
    grantItem(sim, 'linen_scrap', 1, pid);

    const result = resolveCraft((sim as any).ctx, pid, recipe.id);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient_materials');
    // Partial consumption never happens: both reagents untouched.
    expect(sim.countItem('bone_fragments', pid)).toBe(1);
    expect(sim.countItem('linen_scrap', pid)).toBe(1);
    expect(sim.countItem('eastbrook_arming_sword', pid)).toBe(0);
  });

  it('denies an unknown recipe id with no side effects', () => {
    const sim = makeSim();
    const pid = sim.playerId;
    const result = resolveCraft((sim as any).ctx, pid, 'not_a_real_recipe');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('unknown_recipe');
  });

  it('hasRecipeMaterials matches resolveCraft admission without mutating state', () => {
    const sim = makeSim();
    const pid = sim.playerId;
    const recipe = recipeById('recipe_tough_jerky')!;
    expect(hasRecipeMaterials((sim as any).ctx, recipe, pid)).toBe(false);
    grantItem(sim, 'spider_leg', 1, pid);
    expect(hasRecipeMaterials((sim as any).ctx, recipe, pid)).toBe(true);
    // Read-only: no reagent was consumed by the check itself.
    expect(sim.countItem('spider_leg', pid)).toBe(1);
  });

  it('grants a flat point of craft skill for the crafted recipe only', () => {
    const sim = makeSim();
    const pid = sim.playerId;
    const recipe = recipeById('recipe_tough_jerky')!;
    grantItem(sim, 'spider_leg', 2, pid);
    const meta = (sim as any).players.get(pid);

    resolveCraft((sim as any).ctx, pid, recipe.id);
    expect(meta.craftSkills.cooking).toBe(1);
    expect(meta.craftSkills.weaponcrafting).toBe(0);

    resolveCraft((sim as any).ctx, pid, recipe.id);
    expect(meta.craftSkills.cooking).toBe(2);
  });

  it('the quality roll is deterministic under a fixed seed and consumes exactly one rng draw', () => {
    const runOnce = () => {
      const sim = makeSim(7);
      const pid = sim.playerId;
      grantItem(sim, 'spider_leg', 1, pid);
      const recipe = recipeById('recipe_tough_jerky')!;
      const drawsBefore = (sim as any).rng.draws ?? 0;
      const result = resolveCraft((sim as any).ctx, pid, recipe.id);
      return { result, drawsBefore };
    };
    const a = runOnce();
    const b = runOnce();
    expect(a.result.quality).toBe(b.result.quality);
    expect(typeof a.result.quality).toBe('string');
  });
});

describe('craftItem command (#1127)', () => {
  it('resolves server-side via Sim.craftItem, stashing the result on lastCraftResult', () => {
    const sim = makeSim();
    const pid = sim.playerId;
    grantItem(sim, 'spider_leg', 1, pid);
    sim.craftItem('recipe_tough_jerky', pid);
    expect(sim.lastCraftResult?.ok).toBe(true);
    expect(sim.lastCraftResult?.itemId).toBe('tough_jerky');
    expect(sim.countItem('tough_jerky', pid)).toBe(1);
  });

  it('the IWorld recipeList read surface exposes the common-tier recipe content', () => {
    const sim = makeSim();
    expect(sim.recipeList.length).toBe(COMMON_RECIPES.length);
    expect(sim.recipeList.map((r) => r.id).sort()).toEqual(COMMON_RECIPES.map((r) => r.id).sort());
  });

  it('denies a craft with an error event and leaves lastCraftResult reflecting the denial', () => {
    const sim = makeSim();
    const pid = sim.playerId;
    sim.craftItem('recipe_tough_jerky', pid);
    expect(sim.lastCraftResult?.ok).toBe(false);
    expect(sim.lastCraftResult?.reason).toBe('insufficient_materials');
  });
});

// #1145: signed materials + the self-gathered crafting bonus. The chosen bonus
// (see professions/crafting.ts) is a reduced required quantity: one fewer unit
// of a reagent the crafter holds a self-signed instance of.
describe('self-gathered crafting bonus (#1145)', () => {
  it('a self-signed instance reduces that reagent requirement by one and is consumed', () => {
    const sim = makeSim();
    const pid = sim.playerId;
    const meta = (sim as any).players.get(pid);
    const recipe = recipeById('recipe_eastbrook_arming_sword')!; // needs bone_fragments x2, linen_scrap x1
    // One self-signed bone_fragments (stamped with this player's own name) plus
    // one plain bone_fragments: normally 2 would be required, the bonus drops it to 1.
    sim.addItemInstance('bone_fragments', { signer: meta.name }, pid);
    grantItem(sim, 'linen_scrap', 1, pid);

    expect(hasRecipeMaterials((sim as any).ctx, recipe, pid)).toBe(true);
    const result = resolveCraft((sim as any).ctx, pid, recipe.id);

    expect(result.ok).toBe(true);
    expect(result.selfSignedBonusApplied).toBe(true);
    // The single signed copy (the only bone_fragments held) was consumed as
    // part of satisfying the reduced (1-unit) requirement.
    expect(sim.countItem('bone_fragments', pid)).toBe(0);
    expect(sim.countItem('linen_scrap', pid)).toBe(0);
    expect(sim.countItem('eastbrook_arming_sword', pid)).toBe(1);
  });

  it('a material signed by a DIFFERENT player grants no bonus (same as unsigned)', () => {
    const sim = makeSim();
    const pid = sim.playerId;
    const recipe = recipeById('recipe_eastbrook_arming_sword')!;
    // Signed by someone else: does not count toward the crafter's own bonus.
    sim.addItemInstance('bone_fragments', { signer: 'SomeoneElse' }, pid);
    grantItem(sim, 'linen_scrap', 1, pid);

    // Still short: only 1 of the required 2 bone_fragments (no bonus reduction).
    expect(hasRecipeMaterials((sim as any).ctx, recipe, pid)).toBe(false);
    const result = resolveCraft((sim as any).ctx, pid, recipe.id);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('insufficient_materials');
    expect(result.selfSignedBonusApplied).toBeUndefined();
  });

  it('an unsigned (plain fungible) material grants no bonus', () => {
    const sim = makeSim();
    const pid = sim.playerId;
    const recipe = recipeById('recipe_eastbrook_arming_sword')!;
    grantItem(sim, 'bone_fragments', 2, pid);
    grantItem(sim, 'linen_scrap', 1, pid);

    const result = resolveCraft((sim as any).ctx, pid, recipe.id);
    expect(result.ok).toBe(true);
    expect(result.selfSignedBonusApplied).toBe(false);
    expect(sim.countItem('bone_fragments', pid)).toBe(0);
  });
});
