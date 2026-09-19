import { describe, expect, it, vi } from 'vitest';
import {
  createDiagnosticRecord,
  createErrorRecord,
  debugLog,
  redactContext,
} from '@/core/error/debugLog';

describe('debugLog', () => {
  it('redacts sensitive context keys', () => {
    const redacted = redactContext({
      apiKey: 'sk-secret',
      password: 'hunter2',
      token: 'abc',
      route: 'chat',
      count: 2,
    });
    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.route).toBe('chat');
    expect(redacted.count).toBe(2);
  });

  it('replaces nested objects with a redaction marker', () => {
    const redacted = redactContext({ nested: { a: 1 }, list: [1, 2] });
    expect(redacted.nested).toBe('[REDACTED]');
    expect(redacted.list).toBe('[REDACTED]');
  });

  it('emits an operational error record with the canonical code', () => {
    const sink = { debug: vi.fn() };
    debugLog(createErrorRecord('RUNTIME_ENVELOPE_INVALID', { apiKey: 'sk-secret' }), sink);
    expect(sink.debug).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(sink.debug.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(payload.level).toBe('error');
    expect(payload.code).toBe('RUNTIME_ENVELOPE_INVALID');
    expect((payload.context as Record<string, unknown>).apiKey).toBe('[REDACTED]');
  });

  it('emits a diagnostic record without an error level', () => {
    const sink = { debug: vi.fn() };
    debugLog(createDiagnosticRecord('STANDALONE_ROUTE_FALLBACK', { route: 'unknown' }), sink);
    const payload = JSON.parse(sink.debug.mock.calls[0]![0] as string) as Record<string, unknown>;
    expect(payload.level).toBe('debug');
    expect(payload.event).toBe('STANDALONE_ROUTE_FALLBACK');
    expect(payload.code).toBeUndefined();
  });
});
