// Unit tests for the deed name/desc/title resolver (src/ui/deed_i18n.ts):
// English resolution from the live catalog, the unknown-id fallbacks, the
// ''-for-non-title gate (load-bearing: the hud inspect/nameplate surfaces
// hide entirely on ''), and the release-fill manifest shape.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  deedBroadcastLine,
  deedDesc,
  deedName,
  deedTitleText,
  deedTranslationManifest,
} from '../src/ui/deed_i18n';

describe('deed_i18n English resolution', () => {
  it('resolves name and desc from the catalog def', () => {
    expect(deedName('prog_first_steps')).toBe('First Steps');
    expect(deedDesc('prog_first_steps')).toBe(
      'Reach level 2 and take your first step on a long road.',
    );
  });

  it('falls back for catalog-unknown ids (content drift)', () => {
    expect(deedName('removed_deed')).toBe('removed_deed');
    expect(deedDesc('removed_deed')).toBe('');
    expect(deedTitleText('removed_deed')).toBe('');
  });

  it("returns title text only for title-reward deeds, '' otherwise (the hide gate)", () => {
    expect(deedTitleText('prog_veteran')).toBe('Veteran');
    expect(deedTitleText('hid_saul_footnote')).toBe('the Footnote');
    // No reward at all, and a border (non-title) reward: both hide.
    expect(deedTitleText('prog_first_steps')).toBe('');
    expect(deedTitleText('prog_prestige_10')).toBe('');
    expect(deedTitleText('dgn_deepward')).toBe('');
  });

  it('manifests one row per name and desc plus one per title reward', () => {
    const manifest = deedTranslationManifest();
    // 186 deeds x (name + desc) + the 19 shipped title rewards.
    expect(manifest.length).toBe(186 * 2 + 19);
    expect(manifest.filter((row) => row.field === 'title').length).toBe(19);
    expect(manifest).toContainEqual({
      id: 'prog_veteran',
      field: 'title',
      source: 'Veteran',
    });
    for (const row of manifest) expect(row.source.length).toBeGreaterThan(0);
  });
});

describe('deedBroadcastLine (the guild-chat news line)', () => {
  it('composes the chrome key with the earner name and the localized deed name', () => {
    expect(deedBroadcastLine('Hilda', 'prog_veteran')).toBe(
      'Hilda has accomplished a deed: Veteran',
    );
  });

  it('a catalog-unknown id degrades to the raw id, never a crash or empty line', () => {
    expect(deedBroadcastLine('Hilda', 'removed_deed')).toBe(
      'Hilda has accomplished a deed: removed_deed',
    );
  });

  it('the HUD switch arm stays wired to this composer with the guild-chat green', () => {
    // hud.ts cannot be unit-driven (DOM monolith); the live wiring was
    // verified end to end against a real server, and this source pin keeps
    // the arm from being dropped or detached from the pinned composer.
    const hudSrc = readFileSync(new URL('../src/ui/hud.ts', import.meta.url), 'utf8');
    const arm = hudSrc.slice(hudSrc.indexOf("case 'deedBroadcast'"));
    expect(arm.length).toBeGreaterThan(0);
    expect(arm.slice(0, 600)).toContain(
      "this.log(deedBroadcastLine(ev.characterName, ev.deedId), '#40d264');",
    );
  });
});
