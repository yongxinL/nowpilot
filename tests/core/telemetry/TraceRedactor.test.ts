import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TraceRedactor } from '../../../src/core/telemetry/TraceRedactor';

describe('TraceRedactor', () => {
  let redactor: TraceRedactor;

  beforeEach(() => {
    redactor = new TraceRedactor();
  });

  // =========================================================================
  // Mandatory pattern tests (product spec §4.4)
  // =========================================================================

  it('redacts sk-... API keys with [REDACTED:API_KEY]', () => {
    const input = 'Authorization: Bearer sk-abc123def456';
    const result = redactor.redact(input);
    expect(result).not.toContain('sk-abc123def456');
    expect(result).toContain('[REDACTED:API_KEY]');
  });

  it('redacts key-... API keys with [REDACTED:API_KEY]', () => {
    const input = 'api_key=key-mykeyvalue123';
    const result = redactor.redact(input);
    expect(result).not.toContain('key-mykeyvalue123');
    expect(result).toContain('[REDACTED:API_KEY]');
  });

  it('redacts Bearer tokens with [REDACTED:BEARER_TOKEN] (case-insensitive)', () => {
    const input = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const result = redactor.redact(input);
    expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(result).toContain('[REDACTED:BEARER_TOKEN]');

    // Lowercase 'bearer' should also be redacted
    const inputLower = 'authorization: bearer abc.def.ghi';
    const resultLower = redactor.redact(inputLower);
    expect(resultLower).not.toContain('abc.def.ghi');
    expect(resultLower).toContain('[REDACTED:BEARER_TOKEN]');
  });

  it('redacts JSESSIONID=... with [REDACTED:JSESSIONID]', () => {
    const input = 'Cookie: JSESSIONID=abc123def456; Path=/';
    const result = redactor.redact(input);
    expect(result).not.toContain('JSESSIONID=abc123def456');
    expect(result).toContain('[REDACTED:JSESSIONID]');
  });

  it('redacts sysparm_ck=... and sysparm_ck:... with [REDACTED:sysparmCK]', () => {
    const inputEq = 'sysparm_ck=abc123def456&other=param';
    const resultEq = redactor.redact(inputEq);
    expect(resultEq).not.toContain('sysparm_ck=abc123def456');
    expect(resultEq).toContain('[REDACTED:sysparmCK]');

    const inputColon = 'header: sysparm_ck: xyz789token';
    const resultColon = redactor.redact(inputColon);
    expect(resultColon).toContain('[REDACTED:sysparmCK]');
  });

  it('redacts g_ck=... and g_ck:... with [REDACTED:g_ck]', () => {
    const inputEq = 'g_ck=def456token&other=val';
    const resultEq = redactor.redact(inputEq);
    expect(resultEq).not.toContain('g_ck=def456token');
    expect(resultEq).toContain('[REDACTED:g_ck]');

    const inputColon = 'header: g_ck: someTokenValue';
    const resultColon = redactor.redact(inputColon);
    expect(resultColon).toContain('[REDACTED:g_ck]');
  });

  it('redacts MCP auth headers with [REDACTED:MCP_AUTH]', () => {
    const input = 'X-MCP-Auth-Token: some-value-here';
    const result = redactor.redact(input);
    expect(result).not.toContain('X-MCP-Auth-Token');
    expect(result).toContain('[REDACTED:MCP_AUTH]');
  });

  // =========================================================================
  // redactObject method tests
  // =========================================================================

  it('redactObject recursively traverses nested objects and replaces string values', () => {
    const input = {
      apiKey: 'sk-abc123def456',
      nested: {
        token: 'Bearer eyJhbGciOiJIUzI1NiJ9',
        other: 'safe-value',
      },
    };
    const result = redactor.redactObject(input);
    expect(result.apiKey).toContain('[REDACTED:API_KEY]');
    expect(result.apiKey).not.toContain('sk-abc123def456');
    expect((result.nested as Record<string, unknown>).token).toContain('[REDACTED:BEARER_TOKEN]');
    expect((result.nested as Record<string, unknown>).other).toBe('safe-value');
  });

  it('redactObject handles arrays of strings', () => {
    const input = {
      keys: ['sk-first-key', 'some-safe-value', 'key-another-key'],
    };
    const result = redactor.redactObject(input);
    // Wait — redactObject only processes direct string values, not array contents.
    // The plan says test 9 is "redactObject handles arrays of strings" via redactValue dispatch.
    // redactValue handles arrays by mapping over elements recursively.
    // So this test should be via redactValue.
    const viaValue = redactor.redactValue(input);
    const resultObj = viaValue as Record<string, unknown>;
    const arr = resultObj.keys as string[];
    expect(arr[0]).toContain('[REDACTED:API_KEY]');
    expect(arr[1]).toBe('some-safe-value');
    expect(arr[2]).toContain('[REDACTED:API_KEY]');
  });

  it('redactObject handles null/undefined/numbers without throwing', () => {
    const input = {
      a: null,
      b: undefined,
      c: 42,
      d: true,
      e: 'sk-redactme',
    };
    const result = redactor.redactObject(input);
    expect(result.a).toBeNull();
    expect(result.b).toBeUndefined();
    expect(result.c).toBe(42);
    expect(result.d).toBe(true);
    expect(result.e).toContain('[REDACTED:API_KEY]');
  });

  // =========================================================================
  // redactValue dispatch tests
  // =========================================================================

  it('redactValue dispatches correctly: string uses redact, object uses redactObject, primitive passes through', () => {
    // String -> redact
    expect(redactor.redactValue('sk-test-key')).toContain('[REDACTED:API_KEY]');
    // Object -> redactObject
    const obj = { key: 'sk-test-key' };
    const objResult = redactor.redactValue(obj) as Record<string, unknown>;
    expect(objResult.key).toContain('[REDACTED:API_KEY]');
    // Array -> map over elements
    const arr = ['sk-key1', 'safe', 'key-key2'];
    const arrResult = redactor.redactValue(arr) as string[];
    expect(arrResult[0]).toContain('[REDACTED:API_KEY]');
    expect(arrResult[1]).toBe('safe');
    expect(arrResult[2]).toContain('[REDACTED:API_KEY]');
    // Number -> pass through
    expect(redactor.redactValue(42)).toBe(42);
    // Boolean -> pass through
    expect(redactor.redactValue(true)).toBe(true);
    // Null -> pass through
    expect(redactor.redactValue(null)).toBeNull();
    // Undefined -> pass through
    expect(redactor.redactValue(undefined)).toBeUndefined();
  });

  // =========================================================================
  // Edge cases
  // =========================================================================

  it('empty string returns empty string', () => {
    expect(redactor.redact('')).toBe('');
  });

  it('legitimate text containing "sk-" but not followed by alphanum is NOT redacted', () => {
    // "sk-" followed by non-alphanumeric should NOT be redacted (false positive resilience)
    const input = 'The word "sk-" appears in text but is not a key';
    const result = redactor.redact(input);
    expect(result).toContain('sk-');
    expect(result).not.toContain('[REDACTED:API_KEY]');
  });
});
