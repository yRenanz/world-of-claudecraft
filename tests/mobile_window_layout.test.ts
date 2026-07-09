import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const mobileCss = readFileSync(
  new URL('../src/styles/hud.mobile.css', import.meta.url),
  'utf8',
).replace(/\r\n/g, '\n');

describe('mobile window layout CSS', () => {
  it('clamps generic mobile windows to the app viewport and reserves bottom padding', () => {
    const start = mobileCss.indexOf('body.mobile-touch .window {');
    expect(start).toBeGreaterThan(0);
    const block = mobileCss.slice(start, mobileCss.indexOf('}', start));
    expect(block).toContain(
      'max-width: calc(var(--app-vw, 100vw) / var(--window-scale, 1) - 20px);',
    );
    expect(block).toContain(
      'padding-bottom: max(var(--window-pad), calc(18px + env(safe-area-inset-bottom)));',
    );
  });

  it('does not keep the old portrait-hostile 100vw minus 170px window width', () => {
    expect(mobileCss).not.toContain('calc(100vw - 170px)');
    expect(mobileCss).toContain(
      'width: min(430px, calc(var(--app-vw) / var(--ui-scale, 1) - 20px));',
    );
    expect(mobileCss).toContain(
      'width: min(560px, calc(var(--app-vw) / var(--ui-scale, 1) - 20px));',
    );
  });

  it('keeps mobile tab and filter rows scrollable instead of clipping labels', () => {
    expect(mobileCss).toMatch(
      /body\.mobile-touch \.bag-chips \{[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto;/,
    );
    expect(mobileCss).toMatch(
      /body\.mobile-touch #social-window \.soc-tabs \{[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto;/,
    );
  });

  it('stacks vendor and bank companion windows vertically in portrait', () => {
    const portraitAt = mobileCss.indexOf('@media (orientation: portrait)');
    expect(portraitAt).toBeGreaterThan(0);
    const portraitCss = mobileCss.slice(portraitAt);
    expect(portraitCss).toContain('--mobile-window-stack-pane-height');
    expect(portraitCss).toContain('body.mobile-touch.vendor-open #vendor-window');
    expect(portraitCss).toContain('body.mobile-touch.bank-open #bank-window');
    expect(portraitCss).toContain('body.mobile-touch.vendor-open #bags');
    expect(portraitCss).toContain('body.mobile-touch.bank-open #bags');
  });

  it('sizes the portrait map from the app viewport so zoom controls do not dominate it', () => {
    const start = mobileCss.indexOf('body.mobile-touch #map-window {');
    expect(start).toBeGreaterThan(0);
    const block = mobileCss.slice(start, mobileCss.indexOf('}', start));
    expect(block).toContain('width: min(330px, calc(var(--app-vw) / var(--ui-scale, 1) - 32px));');
    expect(block).toContain('max-width: calc(var(--app-vw) / var(--ui-scale, 1) - 32px);');
  });
});
