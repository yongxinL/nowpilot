import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debugLog } from '../../../src/core/utils/debugLog';

describe('debugLog auto-redaction', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redacts API keys from object data', () => {
    debugLog('info', 'test', { key: 'sk-abc123' });
    expect(console.info).toHaveBeenCalledWith(
      expect.stringContaining('[NowPilot'),
      { key: '[REDACTED:API_KEY]' },
    );
  });

  it('redacts Bearer tokens from string data', () => {
    debugLog('error', 'test', 'Bearer token123');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('[NowPilot'),
      '[REDACTED:BEARER_TOKEN]',
    );
  });

  it('does not throw when data is undefined', () => {
    expect(() => debugLog('debug', 'test')).not.toThrow();
  });

  it('passes through primitive data unchanged', () => {
    debugLog('warn', 'test', 'simple string');
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('[NowPilot'),
      'simple string',
    );
  });
});
