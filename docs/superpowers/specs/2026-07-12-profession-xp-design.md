# Profession XP (gathering + crafting grant character XP)

## Problem

Gathering (mining/logging/herbalism nodes) and crafting (recipes) only grant
profession proficiency today; they give zero character XP. Leveling is
combat-only, which makes professions irrelevant to progression and removes a
lower-intensity leveling path. This adds character XP to both actions,
tier-scaled and level-gated the same way kill XP already is (`mobXpValue` in
`src/sim/types.ts`), so a max-level character farming trivial nodes/recipes
doesn't get free levels, and a fresh character gets meaningful XP from either
gathering or crafting.

## Non-goals

- No speedrun categories, no enforced restricted game modes, no leaderboard
  changes. XP-only.
- No rebalancing of existing kill XP, quest XP, or profession proficiency
  gain rates.
- No new UI. Existing XP bar / level-up FCT / toast already fire off
  `grantXp`; this reuses that path unchanged.

## Data changes

### `GatherNodeDef` (`src/sim/types.ts`)

Add `level: number`. Populate all 15 records in
`src/sim/content/gather_nodes.ts` using the node's zone `levelRange`
midpoint, rounded (e.g. a zone `levelRange: [1, 7]` node gets `level: 4`).
This is a one-time snapshot into the record, not a live lookup, matching the
user's choice to add an explicit field rather than derive it from zone data
at runtime.

### `ProfessionRecipeRecord` (`src/sim/professions/types.ts`)

Add `level: number`. Populate all 15 records in `src/sim/content/recipes.ts`
using the recipe's existing `itemLevelBudget` as the starting value (already
on the same numeric scale as character level), adjusted by hand where a
recipe's `skillReq` tier clearly implies a different intended character
level (e.g. a 0-skillReq starter recipe should read as low level even if its
`itemLevelBudget` is larger for gold-sink reasons).

Both additions are plain data fields on existing declarative tables — no
migration, not persisted, not on the wire (nodes/recipes are static content,
not per-player state).

## New module: `src/sim/professions/profession_xp.ts`

Pure, zero-DOM, no randomness (matches `tests/architecture.test.ts`
constraints already enforced on `src/sim/`). Two exported functions, one per
profession family, each following the same classic green/gray shape as
`mobXpValue` (reusing `zeroDiff` from `src/sim/types.ts` for the falloff
band) but with independently tuned base constants:

```ts
export function gatherActionXp(nodeLevel: number, playerLevel: number): number
export function craftActionXp(recipeLevel: number, playerLevel: number): number
```

- `gatherActionXp`: lower base (e.g. `base = 10 + 2 * nodeLevel`) — gathering
  is fast, repeatable, and already grants a tradeable material.
- `craftActionXp`: higher base (e.g. `base = 20 + 4 * recipeLevel`) —
  crafting consumes reagents (a sunk cost) and is gated by profession skill
  requirement.
- Both scale down to 0 past the zero-difference gray band exactly like
  `mobXpValue`, and scale up modestly (capped) for content above the
  player's level, mirroring the existing kill-XP shape for consistency.

Exact constants are a first-pass tuning value, not a balance claim pulled
from a classic-era formula reference (unlike combat math elsewhere in this
repo) — flagged in a code comment as adjustable, since no equivalent
real-MMO gathering/crafting XP table exists to match against.

## Call sites

### `harvestNode` (`src/sim/professions/gathering.ts`)

After the existing `ctx.addItem(result.itemId!, 1, meta.entityId)` grant (and
before/independent of the quest-item bonus grant, which stays XP-free), add:

```ts
ctx.grantXp(gatherActionXp(node.level, p.level), meta);
```

### `resolveCraft` (`src/sim/professions/crafting.ts`)

On the success path (after reagents are consumed and the crafted item is
granted), add:

```ts
ctx.grantXp(craftActionXp(recipe.level, p.level), meta);
```

Both reuse the existing `grantXp(amount, meta, opts?)` seam on `SimContext`
(`src/sim/sim_context.ts`) already used for kill XP — no new seam, no
`fromKill` flag (defaults to falsy, correctly excluding these from any
kill-specific bonus logic like rested XP multipliers if those are
kill-gated; verify this during implementation and note it in the PR if
`grantXp` treats non-kill XP differently in any surprising way).

## i18n / UX

No new player-visible strings: XP gain reuses the existing level-up /
XP-bar / FCT pipeline verbatim, which already renders through `t()`. No
new toast or message is introduced for "you gained profession XP" (kill XP
doesn't get one either; consistent).

## Testing

`sim/` behavior change, so per the repo's default workflow this always gets
tests:

- Unit tests for `gatherActionXp`/`craftActionXp` pinning: base value at
  same-level content, zero at gray (>= zeroDiff levels below player), capped
  scale-up above player level, and that the two curves are NOT identical
  (guards against the two base constants silently collapsing to one).
- Integration test: `harvestNode` on a fresh player grants both proficiency
  AND character XP in one call (extend the existing gathering test file
  rather than adding a new one, per the module-first rule: this is a call
  site addition to an existing tested function, not a new system).
- Integration test: `resolveCraft`/`craftItem` success path grants character
  XP alongside the existing proficiency skill-up.
- A regression check that a max-level (or far-above-node-level) character
  harvesting/crafting trivial content gets 0 character XP (the gray-band
  case), since this is the main anti-exploit property of the whole feature.

## Out of scope follow-ups (not filed as issues here, just noted)

- Tuning constants once real playtesting data exists.
- Whether rested-XP bonus (if any) should apply to profession XP the same
  way it applies to kill XP.
