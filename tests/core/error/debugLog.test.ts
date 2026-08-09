// tests/core/error/debugLog.test.ts — Golden Rule 9 / R-10 contract tests.
// @vitest-environment node — pure logic, no DOM needed (01-01 Rule 3 env note).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { debugLog } from '@/core/error/debugLog';
import * as TraceRedactor from '@/core/security/TraceRedactor';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('debugLog', () => {
  it('routes the message string through TraceRedactor.redact (R-10)', () => {
    const redactSpy = vi.spyOn(TraceRedactor, 'redact');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    debugLog('STORE_READ', 'read failed for key np_workspace');
    expect(redactSpy).toHaveBeenCalledWith('read failed for key np_workspace');
    consoleSpy.mockRestore();
  });

  it('routes context, module and error message through redact', () => {
    const redactSpy = vi.spyOn(TraceRedactor, 'redact');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    debugLog('EVT_HANDLER', 'handler error', {
      context: 'EventBus.emit',
      module: 'EventBus',
      error: new Error('boom'),
    });
    expect(redactSpy).toHaveBeenCalledWith('EventBus.emit');
    expect(redactSpy).toHaveBeenCalledWith('EventBus');
    expect(redactSpy).toHaveBeenCalledWith('boom');
    consoleSpy.mockRestore();
  });

  it('writes a line containing the canonical code and message to console.error', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    debugLog('WORKSPACE_INIT', 'hydrate failed');
    const written = consoleSpy.mock.calls.map((args) => String(args[0])).join('\n');
    expect(written).toContain('[WORKSPACE_INIT]');
    expect(written).toContain('hydrate failed');
    consoleSpy.mockRestore();
  });

  it('respects the silent flag and emits nothing', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    debugLog('THEME_WRITE', 'sensitive write', { silent: true });
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('never throws, even with odd inputs', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => debugLog('UNKNOWN', '')).not.toThrow();
    expect(() => debugLog('PROMISE_REJECT', 'x', { extra: { nested: { a: 1 } } })).not.toThrow();
    consoleSpy.mockRestore();
  });

  it('routes options.extra through redactSensitive — secrets in extra never reach the console verbatim (WR-05)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    debugLog('STORE_WRITE', 'write failed', {
      extra: {
        keyId: 'np_theme', // benign key stays
        password: 'hunter2', // DROPPED by redactSensitive (A-05)
        apiKey: 'sk-live-secret-987654321', // inline-scrubbed to [REDACTED]
        nested: { access_token: 'at-supersecret' }, // DROPPED by suffix rule (WR-04)
      },
    });

    const written = consoleSpy.mock.calls[0];
    // third arg is the extra object — secret values must not survive
    const serialized = JSON.stringify(written[2]);
    expect(serialized).toContain('np_theme');
    expect(serialized).not.toContain('hunter2');
    expect(serialized).not.toContain('sk-live-secret-987654321');
    expect(serialized).not.toContain('at-supersecret');
    expect(serialized).toContain('[REDACTED]');
    consoleSpy.mockRestore();
  });
});
