// tests/core/security/redactSensitive.test.ts — redaction contract tests
// (D-16 / R-10 / Appendix O.13). Uses the buildRedactionFixture builder from
// 02-01 (D-20/21: the SAME deterministic builder the integration paths use).
// Cases: the six O.13 patterns scrub strings (T-2-02-01), password-like fields
// are DROPPED never masked (T-2-02-02 / A-05), the vault ciphertext envelope
// passes through structurally unchanged (T-2-02-03 / RESEARCH Pattern 6), and
// the string form ErrorStore/journal persist will run is redacted. Runs in the
// default jsdom-align environment (no IDB, no chrome.* needed).
import { describe, expect, it } from 'vitest';
import { buildRedactionFixture } from '../../fixtures/index';
import { redact } from '@/core/security/TraceRedactor';
import {
  isVaultEnvelope,
  redactSensitive,
  SENSITIVE_FIELD_KEYS,
} from '@/core/security/redactSensitive';

describe('redactSensitive — O.13 pattern scrubbing (T-2-02-01)', () => {
  it('redacts every message the shared fixture carries, never leaving the original substring', () => {
    const { messages } = buildRedactionFixture();
    expect(messages.length).toBeGreaterThan(0);
    for (const message of messages) {
      const out = redactSensitive(message);
      expect(typeof out).toBe('string');
      expect(out).toContain('[REDACTED]');
      // the original secret substring must never survive
      for (const re of [
        /sk-[A-Za-z0-9_-]+/,
        /key-[A-Za-z0-9_-]+/,
        /Bearer\s+[A-Za-z0-9._-]+/i,
        /JSESSIONID=[^;\s]+/i,
        /sysparm_ck[=:]\s*[^&\s]+/i,
        /g_ck[=:]\s*[^&\s]+/i,
      ]) {
        const match = message.match(re);
        if (match) expect(out).not.toContain(match[0]);
      }
    }
  });

  it('covers the key-… pattern too — all six O.13 patterns scrub to [REDACTED]', () => {
    const out = redactSensitive('api key=key-abc123def456ghi789 in trace body');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('key-abc123def456ghi789');
  });

  it('scrubs broader API-key shapes — non-sk-/key- prefixed keys like AIza… (WR-04)', () => {
    const googleKey = 'AIzaSyA1234567890abcdefghijklmnopqrstuvwxyz';
    const out = redactSensitive(
      `google maps key ${googleKey} and api_key=ABCDEFGHIJKLMNOPQRST123456 inline`,
    );
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain(googleKey);
    expect(out).not.toContain('ABCDEFGHIJKLMNOPQRST123456');
  });

  it('does NOT over-redact words merely containing "key-" — monkey-bars survives (IN-04)', () => {
    expect(redact('monkey-bars are fun')).toBe('monkey-bars are fun');
    // a REAL key start after a '-'-suffixed word still redacts (prefix guard)
    expect(redact('monkey-key-abc123 chain')).toContain('[REDACTED]');
    expect(redact('path/to/key-xyz789 end')).toContain('[REDACTED]');
    // a real key start still redacts (boundary / prefix guard anchors the match)
    expect(redact('api key=key-abc123def456ghi789 in trace body')).toContain('[REDACTED]');
  });
});

describe('redactSensitive — field-level DROP contract (T-2-02-02 / A-05)', () => {
  it('drops the password-like key (absent, never masked) and redacts sibling fields inline', () => {
    const { structured, passwordKey } = buildRedactionFixture();
    const out = redactSensitive(structured) as Record<string, unknown>;

    // DROP contract: the password-like key is ABSENT from the result — not
    // present as [REDACTED], not present as the raw value (A-05, T-2-02-02)
    expect(out).not.toHaveProperty(passwordKey);
    expect(SENSITIVE_FIELD_KEYS.has(passwordKey)).toBe(true);

    // non-dropped secret-shaped fields are scrubbed inline to the literal token
    expect(out.apiKey).toBe('[REDACTED]');

    // never the original secret value anywhere in the serialized result
    const serialized = JSON.stringify(out);
    expect(serialized).not.toContain('sk-live-secret-987654321');
    expect(serialized).not.toContain('sup3r-secret-password');
  });

  it('recurses into nested objects and arrays', () => {
    const input = {
      meta: { provider: 'anthropic', trace: 'Bearer nested.token.value' },
      list: ['sk-nested-key', 'plain'],
      password: 'hunter2',
    };
    const out = redactSensitive(input) as Record<string, unknown>;
    expect((out.meta as Record<string, unknown>).trace).toBe('[REDACTED]');
    expect(out.list).toEqual(['[REDACTED]', 'plain']);
    expect(out).not.toHaveProperty('password');
  });

  it('drops COMPOSITE sensitive keys by suffix — access_token, auth_token, refresh_token, client_secret, secret_key (WR-04)', () => {
    const out = redactSensitive({
      access_token: 'at-live-1',
      auth_token: 'auth-live-2',
      refresh_token: 'rt-live-3',
      client_secret: 'cs-live-4',
      secret_key: 'sk-live-5',
      accessToken: 'at-camel-6',
      API_SECRET: 'up-secret-7',
      // sibling non-sensitive keys survive untouched
      sessionId: 's-1',
      status: 'ok',
      apiKey: 'sk-inline-8', // NOT dropped — scrubbed inline to [REDACTED]
    }) as Record<string, unknown>;

    for (const key of [
      'access_token',
      'auth_token',
      'refresh_token',
      'client_secret',
      'secret_key',
      'accessToken',
      'API_SECRET',
    ]) {
      expect(out).not.toHaveProperty(key); // DROPPED, never masked
    }
    expect(out.sessionId).toBe('s-1');
    expect(out.status).toBe('ok');
    expect(out.apiKey).toBe('[REDACTED]'); // inline-scrubbed, not dropped
  });
});

describe('redactSensitive — vault envelope passthrough (T-2-02-03 / RESEARCH Pattern 6)', () => {
  it('returns the {salt, iv, ciphertext} envelope structurally unchanged', () => {
    const envelope = {
      salt: new Uint8Array(16).fill(0x11),
      iv: new Uint8Array(12).fill(0x22),
      ciphertext: new Uint8Array(48).fill(0x33),
    };
    expect(isVaultEnvelope(envelope)).toBe(true);
    const out = redactSensitive(envelope);
    expect(out).toEqual(envelope);
    // byte-identical — already-encrypted data is never touched
    expect([...(out as typeof envelope).ciphertext]).toEqual([...envelope.ciphertext]);
  });

  it('isVaultEnvelope is false for non-envelope shapes', () => {
    // strings instead of byte arrays
    expect(isVaultEnvelope({ salt: 'x', iv: 'y', ciphertext: 'z' })).toBe(false);
    // missing a key
    expect(isVaultEnvelope({ salt: new Uint8Array(16), iv: new Uint8Array(12) })).toBe(false);
    // non-objects
    expect(isVaultEnvelope(null)).toBe(false);
    expect(isVaultEnvelope('sk-not-an-envelope')).toBe(false);
  });
});

describe('redactSensitive — error-message routing precedent (string form)', () => {
  it('redacts a message string with an embedded secret — the ErrorStore/journal string form', () => {
    const out = redactSensitive('Error persisting journal: write failed for key-abc123def456');
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('key-abc123def456');
  });
});
