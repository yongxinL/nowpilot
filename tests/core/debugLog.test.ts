import { describe, it, expect, vi, beforeEach } from 'vitest';
import { debugLog } from '../../src/core/utils/debugLog';

describe('debugLog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls console.error with timestamp-prefixed message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    debugLog('error', 'test', { detail: 'x' });
    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/^\[NowPilot .*\] test/),
      { detail: 'x' },
    );
  });

  it('routes to correct console methods for all four log levels', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    debugLog('error', 'e');
    debugLog('warn', 'w');
    debugLog('info', 'i');
    debugLog('debug', 'd');
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/ e$/), '');
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/ w$/), '');
    expect(console.info).toHaveBeenCalledWith(expect.stringMatching(/ i$/), '');
    expect(console.debug).toHaveBeenCalledWith(expect.stringMatching(/ d$/), '');
  });

  it('accepts all LogLevel values without throwing', () => {
    expect(() => debugLog('debug', 'test')).not.toThrow();
    expect(() => debugLog('info', 'test')).not.toThrow();
    expect(() => debugLog('warn', 'test')).not.toThrow();
    expect(() => debugLog('error', 'test')).not.toThrow();
  });
});
