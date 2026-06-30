// Self-tests for the pure server config loader. loadConfig takes env as a
// parameter, so these run in plain Node with no real process.env and no DB.
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../server/http/config';

// The one required field; every other field exercises a default unless overridden.
const MIN_ENV: NodeJS.ProcessEnv = { DATABASE_URL: 'postgres://x' };

describe('loadConfig', () => {
  it('throws fast when DATABASE_URL is missing or empty', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
    expect(() => loadConfig({ DATABASE_URL: '' })).toThrow(/DATABASE_URL/);
  });

  it('never leaks a database url in the thrown message', () => {
    // There is no value to leak in the missing case, but the message must never
    // template the env in, so a future partial value can't surface in logs.
    expect(() => loadConfig({ DATABASE_URL: '' })).toThrow();
    try {
      loadConfig({ DATABASE_URL: '' });
    } catch (e) {
      expect(String((e as Error).message)).not.toMatch(/postgres:|:\/\//);
    }
  });

  it('applies every default given only DATABASE_URL', () => {
    const cfg = loadConfig({ ...MIN_ENV });
    expect(cfg.databaseUrl).toBe('postgres://x');
    expect(cfg.dispatch).toBe('legacy');
    expect(cfg.port).toBe(8787);
    expect(cfg.allowDevCommands).toBe(false);
    expect(cfg.turnstileSecret).toBe('');
    expect(cfg.maxWsPerIpHard).toBe(20);
    expect(cfg.githubRepo).toBe('levy-street/world-of-claudecraft');
    expect(cfg.githubToken).toBe('');
    expect(cfg.chatLogRetentionDays).toBe(90);
    expect(cfg.perfReportRetentionDays).toBe(14);
  });

  it('parses API_DISPATCH=new to dispatch "new"', () => {
    expect(loadConfig({ ...MIN_ENV, API_DISPATCH: 'new' }).dispatch).toBe('new');
    expect(loadConfig({ ...MIN_ENV, API_DISPATCH: 'legacy' }).dispatch).toBe('legacy');
  });

  it('falls back to "legacy" for an invalid or empty API_DISPATCH', () => {
    expect(loadConfig({ ...MIN_ENV, API_DISPATCH: 'bogus' }).dispatch).toBe('legacy');
    expect(loadConfig({ ...MIN_ENV, API_DISPATCH: 'NEW' }).dispatch).toBe('legacy');
    expect(loadConfig({ ...MIN_ENV, API_DISPATCH: '' }).dispatch).toBe('legacy');
  });

  it('parses ALLOW_DEV_COMMANDS=1 as true and anything else as false', () => {
    expect(loadConfig({ ...MIN_ENV, ALLOW_DEV_COMMANDS: '1' }).allowDevCommands).toBe(true);
    expect(loadConfig({ ...MIN_ENV, ALLOW_DEV_COMMANDS: 'true' }).allowDevCommands).toBe(false);
    expect(loadConfig({ ...MIN_ENV, ALLOW_DEV_COMMANDS: '0' }).allowDevCommands).toBe(false);
  });

  it('reads the numeric and string overrides', () => {
    const cfg = loadConfig({
      ...MIN_ENV,
      PORT: '9000',
      MAX_WS_PER_IP_HARD: '5',
      TURNSTILE_SECRET: 'sekret',
      GITHUB_REPO: 'me/fork',
      GITHUB_TOKEN: 'ghtok',
      CHAT_LOG_RETENTION_DAYS: '7',
      PERF_REPORT_RETENTION_DAYS: '3',
    });
    expect(cfg.port).toBe(9000);
    expect(cfg.maxWsPerIpHard).toBe(5);
    expect(cfg.turnstileSecret).toBe('sekret');
    expect(cfg.githubRepo).toBe('me/fork');
    expect(cfg.githubToken).toBe('ghtok');
    expect(cfg.chatLogRetentionDays).toBe(7);
    expect(cfg.perfReportRetentionDays).toBe(3);
  });

  it('falls back to defaults for a non-numeric or empty numeric env', () => {
    const cfg = loadConfig({ ...MIN_ENV, PORT: 'abc', MAX_WS_PER_IP_HARD: '' });
    expect(cfg.port).toBe(8787);
    expect(cfg.maxWsPerIpHard).toBe(20);
  });

  it('returns a frozen Config whose fields cannot be mutated', () => {
    const cfg = loadConfig({ ...MIN_ENV });
    expect(Object.isFrozen(cfg)).toBe(true);
    // Strict mode (ESM) makes an assignment to a frozen property throw, and the
    // value is unchanged regardless.
    expect(() => {
      (cfg as { port: number }).port = 1;
    }).toThrow();
    expect(cfg.port).toBe(8787);
  });
});
