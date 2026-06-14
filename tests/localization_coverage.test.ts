import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  en,
  es,
  es_ES,
  fr_FR,
  fr_CA,
  en_CA,
  it_IT,
  de_DE,
  zh_CN,
  zh_TW,
  ko_KR,
  ja_JP,
  pt_BR,
  ru_RU,
  formatDateTime,
  formatNumber,
  isSupportedLanguage,
  languageTag,
  setLanguage,
  supportedLanguages,
  t,
  type TranslationKey,
} from "../src/ui/i18n";

const locales: Record<string, typeof en> = {
  es,
  es_ES,
  fr_FR,
  fr_CA,
  en_CA,
  it_IT,
  de_DE,
  zh_CN,
  zh_TW,
  ko_KR,
  ja_JP,
  pt_BR,
  ru_RU,
};

describe("i18n Localization Key Coverage", () => {
  const placeholderPattern = /\b(TODO|TBD|FIXME|PLACEHOLDER|TRANSLATE|LOREM)\b/i;
  const phaseOneShellKeys: TranslationKey[] = [
    "seo.title",
    "seo.description",
    "a11y.goHome",
    "loading.worldProgress",
    "errors.characterNameInvalid",
    "realm.onlineNow",
    "character.levelClass",
    "deleteCharacter.body",
    "classDetails.sections.startingStats",
    "mobilePreflight.title",
    "serverUnavailable.heading",
  ];
  const phaseTwoHudKeys: TranslationKey[] = [
    "hud.core.chatPlaceholder",
    "hud.core.xpGain",
    "hud.options.gameMenu",
    "hud.options.keybindHelp",
    "hud.options.unbound",
    "hud.keybinds.categories.movement",
    "hud.keybinds.actions.forward",
    "hud.meters.noCombat",
    "hud.chat.templates.guild",
    "hud.chat.context.trade",
    "hud.report.reasons.offensiveNameOrChat",
    "hud.prompts.duelRequest",
    "hud.combat.damageDoneCrit",
    "hud.system.arenaVictoryLog",
    "hud.errors.chatCooldown",
    "hud.logs.lootReceiveItem",
  ];
  const phaseThreeAbilityKeys: TranslationKey[] = [
    "abilityUi.actionBar.attackName",
    "abilityUi.actionBar.attackTooltip",
    "abilityUi.actionBar.emptySlot",
    "abilityUi.spellbook.title",
    "abilityUi.spellbook.classSubtitle",
    "abilityUi.spellbook.trainableAtLevel",
    "abilityUi.spellbook.learnAtLevel",
    "abilityUi.tooltip.rank",
    "abilityUi.tooltip.cost",
    "abilityUi.tooltip.rangeWithMin",
    "abilityUi.tooltip.channeledSeconds",
    "abilityUi.tooltip.cooldownSeconds",
    "abilityUi.tooltip.requiresForm",
    "abilityUi.tooltip.requiresCombo",
    "abilityUi.tooltip.finisherDamage",
    "abilityUi.resources.mana",
  ];
  const interpolationValues: Record<string, string | number> = {
    ability: "Fireball",
    action: "Open Chat",
    amount: 42,
    base: 14,
    className: "Mage",
    command: "/dance",
    cost: 30,
    current: 120,
    delta: "+13",
    duration: "15s",
    form: "Bear",
    guild: "Night Watch",
    index: 2,
    item: "Rough Bracers",
    key: "K",
    label: "Wolf",
    level: 10,
    loser: "Mira",
    max: 25,
    message: "Meet at the inn",
    min: 16,
    money: "12 copper",
    name: "Aki",
    needed: 400,
    perCombo: 7,
    percent: 30,
    position: 3,
    rating: 1513,
    range: 30,
    rank: 2,
    resource: "Mana",
    seconds: 7,
    slot: 5,
    source: "Wolf",
    summary: "30 Mana / Instant",
    tab: "Damage",
    target: "Wolf",
    view: "Current",
    winner: "Rook",
    zone: "Northshire",
  };

  function verifyKeys(base: Record<string, unknown>, target: Record<string, unknown>, path = "") {
    for (const key in base) {
      const currentPath = path ? `${path}.${key}` : key;
      expect(target).toHaveProperty(key);
      const baseValue = base[key];
      const targetValue = target[key];
      if (typeof baseValue === "object" && baseValue !== null) {
        expect(typeof target[key]).toBe("object");
        verifyKeys(baseValue as Record<string, unknown>, targetValue as Record<string, unknown>, currentPath);
      } else {
        expect(typeof targetValue).toBe("string");
        const text = targetValue as string;
        expect(text.trim().length, `${currentPath} should not be empty`).toBeGreaterThan(0);
        expect(text, `${currentPath} should not contain placeholder markers`).not.toMatch(placeholderPattern);
      }
    }
  }

  function nestedString(target: Record<string, unknown>, key: string): string {
    let node: unknown = target;
    for (const segment of key.split(".")) {
      if (typeof node !== "object" || node === null || !(segment in node)) return "";
      node = (node as Record<string, unknown>)[segment];
    }
    return typeof node === "string" ? node : "";
  }

  function flattenStrings(base: Record<string, unknown>, path = ""): { key: TranslationKey; value: string }[] {
    const entries: { key: TranslationKey; value: string }[] = [];
    for (const [key, value] of Object.entries(base)) {
      const currentPath = path ? `${path}.${key}` : key;
      if (typeof value === "string") {
        entries.push({ key: currentPath as TranslationKey, value });
      } else if (typeof value === "object" && value !== null) {
        entries.push(...flattenStrings(value as Record<string, unknown>, currentPath));
      }
    }
    return entries;
  }

  function placeholders(value: string): string[] {
    return [...value.matchAll(/\{([A-Za-z][A-Za-z0-9]*)\}/g)].map((match) => match[1]).sort();
  }

  for (const [code, locale] of Object.entries(locales)) {
    it(`should have 100% key match and non-empty translations for locale: ${code}`, () => {
      verifyKeys(en, locale);
    });
  }

  it("should resolve nested keys accurately using t() helper", () => {
    setLanguage("en");
    expect(t("nav.home")).toBe("Home");
    expect(t("auth.usernamePlaceholder")).toBe("Enter username");
    expect(t("loading.worldProgress", { done: 3, total: 9 })).toBe("Loading world... 3/9");

    setLanguage("es");
    expect(t("nav.home")).toBe("Inicio");
    expect(t("auth.usernamePlaceholder")).toBe("Introduce tu usuario");
    expect(t("character.levelClass", { level: 7, className: "Maga" })).toBe("Nivel 7 Maga");

    setLanguage("en");
  });

  it("should expose typed locale utilities for shell metadata and formatting", () => {
    expect(supportedLanguages).toEqual([
      "en",
      "es",
      "es_ES",
      "fr_FR",
      "fr_CA",
      "en_CA",
      "it_IT",
      "de_DE",
      "zh_CN",
      "zh_TW",
      "ko_KR",
      "ja_JP",
      "pt_BR",
      "ru_RU",
    ]);
    expect(isSupportedLanguage("de_DE")).toBe(true);
    expect(isSupportedLanguage("de-DE")).toBe(false);
    expect(languageTag("fr_CA")).toBe("fr-CA");
    expect(formatNumber(1234.5, { maximumFractionDigits: 1 }, "de_DE")).toBe("1.234,5");
    expect(formatDateTime(new Date(Date.UTC(2026, 5, 14, 12)), { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "UTC" }, "en")).toBe("06/14/2026");
  });

  it("should keep technical transport errors out of localized user-facing dictionaries", () => {
    for (const locale of [en, ...Object.values(locales)]) {
      expect(locale.errors.api).not.toHaveProperty("requestFailed");
    }
  });

  it("should include current phase public shell keys in every locale", () => {
    for (const key of phaseOneShellKeys) {
      for (const lang of supportedLanguages) {
        setLanguage(lang);
        expect(t(key), `${lang}.${key}`).not.toBe(key);
        expect(t(key).trim().length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
    setLanguage("en");
  });

  it("should include current phase HUD, chat, and combat keys in every locale", () => {
    for (const key of phaseTwoHudKeys) {
      for (const lang of supportedLanguages) {
        setLanguage(lang);
        expect(t(key), `${lang}.${key}`).not.toBe(key);
        expect(t(key).trim().length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
    setLanguage("en");
  });

  it("should include current phase action bar, spellbook, and ability tooltip keys in every locale", () => {
    for (const key of phaseThreeAbilityKeys) {
      for (const lang of supportedLanguages) {
        setLanguage(lang);
        expect(t(key), `${lang}.${key}`).not.toBe(key);
        expect(t(key).trim().length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
    setLanguage("en");
  });

  it("should preserve and render every Phase 2 HUD interpolation placeholder in every locale", () => {
    const phaseTwoDynamicKeys = flattenStrings(en.hud, "hud")
      .map(({ key, value }) => ({ key, expected: placeholders(value) }))
      .filter(({ expected }) => expected.length > 0);
    const allLocales: Record<string, typeof en> = { en, ...locales };

    for (const { key, expected } of phaseTwoDynamicKeys) {
      for (const [lang, locale] of Object.entries(allLocales)) {
        const template = nestedString(locale, key);
        expect(placeholders(template), `${lang}.${key} placeholders`).toEqual(expected);
        expect(isSupportedLanguage(lang)).toBe(true);
        if (!isSupportedLanguage(lang)) continue;
        setLanguage(lang);
        const rendered = t(key, interpolationValues);
        expect(rendered, `${lang}.${key} should not leave placeholders unresolved`).not.toMatch(/\{[A-Za-z][A-Za-z0-9]*\}/);
        for (const placeholder of expected) {
          expect(rendered, `${lang}.${key} should include ${placeholder}`).toContain(String(interpolationValues[placeholder]));
        }
      }
    }

    setLanguage("en");
  });

  it("should preserve and render every Phase 3 ability UI interpolation placeholder in every locale", () => {
    const phaseThreeDynamicKeys = flattenStrings(en.abilityUi, "abilityUi")
      .map(({ key, value }) => ({ key, expected: placeholders(value) }))
      .filter(({ expected }) => expected.length > 0);
    const allLocales: Record<string, typeof en> = { en, ...locales };

    for (const { key, expected } of phaseThreeDynamicKeys) {
      for (const [lang, locale] of Object.entries(allLocales)) {
        const template = nestedString(locale, key);
        expect(placeholders(template), `${lang}.${key} placeholders`).toEqual(expected);
        expect(isSupportedLanguage(lang)).toBe(true);
        if (!isSupportedLanguage(lang)) continue;
        setLanguage(lang);
        const rendered = t(key, interpolationValues);
        expect(rendered, `${lang}.${key} should not leave placeholders unresolved`).not.toMatch(/\{[A-Za-z][A-Za-z0-9]*\}/);
        for (const placeholder of expected) {
          expect(rendered, `${lang}.${key} should include ${placeholder}`).toContain(String(interpolationValues[placeholder]));
        }
      }
    }

    setLanguage("en");
  });

  it("should interpolate Phase 2 combat, chat, and log templates without dropping values", () => {
    setLanguage("de_DE");
    expect(t("hud.combat.damageDoneCrit", { ability: "Feuerball", target: "Wolf", amount: 42 })).toContain("42");
    expect(t("hud.errors.chatCooldown", { seconds: 7 })).toContain("7");

    setLanguage("ja_JP");
    const guildChat = t("hud.chat.templates.guild", { name: "Aki", message: "集合" });
    expect(guildChat).toContain("Aki");
    expect(guildChat).toContain("集合");

    setLanguage("zh_CN");
    expect(t("hud.logs.lootReceiveItem", { item: "粗糙护腕" })).toContain("粗糙护腕");

    setLanguage("en");
  });

  it("should format Phase 3 ability tooltip templates without dropping dynamic values", () => {
    setLanguage("de_DE");
    expect(t("abilityUi.tooltip.cooldownSeconds", { seconds: 8 })).toContain("8");
    expect(t("abilityUi.spellbook.trainableAtLevel", { level: 10 })).toContain("10");

    setLanguage("ko_KR");
    const knownAbility = t("abilityUi.spellbook.knownAbilityAria", {
      name: "Fireball",
      rank: 2,
      summary: "30 Mana / Instant",
    });
    expect(knownAbility).toContain("Fireball");
    expect(knownAbility).toContain("2");

    setLanguage("ja_JP");
    const finisher = t("abilityUi.tooltip.finisherDamage", { base: 14, perCombo: 7 });
    expect(finisher).toContain("14");
    expect(finisher).toContain("7");

    setLanguage("en");
  });

  it("should expose all supported hreflang alternates in index.html", () => {
    const html = fs.readFileSync(path.resolve(process.cwd(), "index.html"), "utf8");
    const expectedHreflang = [
      "en",
      "es",
      "es-ES",
      "fr-FR",
      "fr-CA",
      "en-CA",
      "it-IT",
      "de-DE",
      "zh-CN",
      "zh-TW",
      "ko-KR",
      "ja-JP",
      "pt-BR",
      "ru-RU",
      "x-default",
    ];
    for (const hreflang of expectedHreflang) {
      expect(html, `missing hreflang ${hreflang}`).toContain(`hreflang="${hreflang}"`);
    }
    expect(html).toContain('data-i18n-content="seo.description"');
    expect(html).toContain('data-i18n-placeholder="hud.core.chatPlaceholder"');
    expect(html).toContain('data-i18n="hud.core.chatTab"');
    expect(html).toContain('id="structured-data"');
  });
});
