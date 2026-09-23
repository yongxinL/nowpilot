import { describe, it, expect } from 'vitest';
import {
  CIRCULAR_PLACEHOLDER,
  REDACTED_PLACEHOLDER,
  SENSITIVE_FIELD_NAMES,
  UNSERIALISABLE_PLACEHOLDER,
  isSensitiveFieldName,
  redactErrorContext,
  redactSensitive,
} from '../../../src/core/security/redactSensitive';

/**
 * redactSensitive suite (plan `02-03`, Task 3 — §16.5, D2-21).
 *
 * The credential is the repository's synthetic sentinel — never a real key.
 * The assertion style is absence-by-exact-output: the redacted result is
 * pinned as an exact value, so a length, prefix, suffix, mask or digest that
 * ever crept into the output would fail the equality rather than hide behind a
 * negative assertion.
 */

const SENTINEL = 'sk-secret-DO-NOT-LEAK-XYZ123';

describe('redactSensitive — the single sensitive-name list', () => {
  it('exports exactly one frozen list', () => {
    expect(Object.isFrozen(SENSITIVE_FIELD_NAMES)).toBe(true);
    expect(SENSITIVE_FIELD_NAMES.length).toBeGreaterThan(0);
    expect(SENSITIVE_FIELD_NAMES.every((name) => name === name.toLowerCase())).toBe(true);
  });

  it('redacts every recognised pattern through the field-name matcher', () => {
    for (const pattern of SENSITIVE_FIELD_NAMES) {
      expect(isSensitiveFieldName(pattern)).toBe(true);
      // A case- and separator-insensitive spelling of the same name matches too.
      expect(isSensitiveFieldName(pattern.toUpperCase())).toBe(true);
    }
    expect(isSensitiveFieldName('apiKey')).toBe(true);
    expect(isSensitiveFieldName('api_key')).toBe(true);
    expect(isSensitiveFieldName('API-KEY')).toBe(true);
    expect(isSensitiveFieldName('X-Authorization')).toBe(true);
    expect(isSensitiveFieldName('userPassword')).toBe(true);
    expect(isSensitiveFieldName('JSESSIONID')).toBe(true);
  });

  it('leaves non-secret field names alone', () => {
    for (const key of ['providerId', 'messageCount', 'notes', 'provider', 'author', 'keyboard']) {
      expect(isSensitiveFieldName(key)).toBe(false);
    }
  });
});

describe('redactSensitive — the walk', () => {
  it('redacts a recognised key at every depth, nested three levels deep', () => {
    const input = {
      providerId: 'openai',
      apiKey: SENTINEL,
      nested: {
        deep: {
          accessToken: SENTINEL,
          safe: 'kept',
        },
        clientSecret: SENTINEL,
      },
    };

    const output = redactSensitive(input);

    expect(output).toEqual({
      providerId: 'openai',
      apiKey: REDACTED_PLACEHOLDER,
      nested: {
        deep: { accessToken: REDACTED_PLACEHOLDER, safe: 'kept' },
        clientSecret: REDACTED_PLACEHOLDER,
      },
    });
  });

  it('never lets the sentinel, a fragment or its length survive — pinned by exact output', () => {
    const output = redactSensitive({ apiKey: SENTINEL, nested: { credential: SENTINEL } });
    const serialised = JSON.stringify(output);

    expect(serialised).toBe('{"apiKey":"[REDACTED]","nested":{"credential":"[REDACTED]"}}');
    expect(serialised).not.toContain(SENTINEL);
    expect(serialised).not.toContain(SENTINEL.slice(0, 10));
    expect(serialised).not.toContain(SENTINEL.slice(-6));
    expect(serialised).not.toContain(String(SENTINEL.length));
    expect(serialised).not.toMatch(/\d/);
  });

  it('handles arrays of records, redacting at every level inside them', () => {
    const output = redactSensitive({
      providers: [
        { id: 'openai', apiKey: SENTINEL },
        { id: 'gemini', token: SENTINEL, meta: { secret: SENTINEL } },
      ],
    });

    expect(output).toEqual({
      providers: [
        { id: 'openai', apiKey: REDACTED_PLACEHOLDER },
        { id: 'gemini', token: REDACTED_PLACEHOLDER, meta: { secret: REDACTED_PLACEHOLDER } },
      ],
    });
    expect(JSON.stringify(output)).not.toContain(SENTINEL);
  });

  it('is cycle-safe — a cyclic structure terminates with a serialisable result', () => {
    const cyclic: Record<string, unknown> = { id: 'provider', apiKey: SENTINEL };
    cyclic.self = cyclic;

    let output: unknown;
    expect(() => {
      output = redactSensitive(cyclic);
    }).not.toThrow();

    expect(output).toEqual({
      id: 'provider',
      apiKey: REDACTED_PLACEHOLDER,
      self: CIRCULAR_PLACEHOLDER,
    });
    expect(() => JSON.stringify(output)).not.toThrow();
    expect(JSON.stringify(output)).not.toContain(SENTINEL);
  });

  it('passes primitives, null, undefined and a Date through the total path', () => {
    const date = new Date('2026-09-24T00:00:00.000Z');

    expect(redactSensitive('text')).toBe('text');
    expect(redactSensitive(42)).toBe(42);
    expect(redactSensitive(0)).toBe(0);
    expect(redactSensitive(true)).toBe(true);
    expect(redactSensitive(null)).toBeNull();
    expect(redactSensitive(undefined)).toBeUndefined();
    expect(redactSensitive(date)).toBe(date);
    expect(redactSensitive(date)).toEqual(new Date('2026-09-24T00:00:00.000Z'));
  });

  it('resolves a function and a symbol to a serialisable placeholder', () => {
    const output = redactSensitive({
      callback: () => undefined,
      marker: Symbol('x'),
      label: 'kept',
    });

    expect(output).toEqual({
      callback: UNSERIALISABLE_PLACEHOLDER,
      marker: UNSERIALISABLE_PLACEHOLDER,
      label: 'kept',
    });
    expect(() => JSON.stringify(output)).not.toThrow();
  });

  it('is deterministic — the same input produces a deep-equal, identically serialised output', () => {
    const records = [{ token: SENTINEL }];
    const input = {
      apiKey: SENTINEL,
      nested: [...records, 'kept'],
      at: new Date('2026-09-24T00:00:00.000Z'),
    };

    const first = redactSensitive(input);
    const second = redactSensitive(input);

    expect(first).toEqual(second);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    // The input itself is never mutated.
    expect(input.apiKey).toBe(SENTINEL);
    expect(records[0].token).toBe(SENTINEL);
  });

  it('is total for an empty record, an array and a non-plain object', () => {
    expect(redactSensitive({})).toEqual({});
    expect(redactSensitive([])).toEqual([]);
    const map = new Map([['apiKey', SENTINEL]]);
    expect(redactSensitive(map)).toBe(map);
  });
});

describe('redactErrorContext', () => {
  it('reports an error name only — never a message, a stack or a value', () => {
    const error = new Error(`request failed with ${SENTINEL}`);

    const context = redactErrorContext(error);

    expect(context).toEqual({ reason: 'Error' });
    expect(Object.keys(context)).toEqual(['reason']);
    expect(JSON.stringify(context)).not.toContain(SENTINEL);
    expect(JSON.stringify(context)).not.toContain('request failed');
    expect(JSON.stringify(context)).not.toContain('stack');
  });

  it('reads a DOMException-shaped name structurally (it is not an Error instance)', () => {
    expect(redactErrorContext({ name: 'OperationError' })).toEqual({ reason: 'OperationError' });
  });

  it('refuses a secret smuggled through the name field', () => {
    const context = redactErrorContext({ name: SENTINEL });

    expect(context).toEqual({ reason: 'object' });
    expect(JSON.stringify(context)).not.toContain(SENTINEL);
  });

  it('is total for non-error values', () => {
    expect(redactErrorContext('boom')).toEqual({ reason: 'string' });
    expect(redactErrorContext(undefined)).toEqual({ reason: 'undefined' });
    expect(redactErrorContext(null)).toEqual({ reason: 'object' });
    expect(redactErrorContext(42)).toEqual({ reason: 'number' });
  });
});
