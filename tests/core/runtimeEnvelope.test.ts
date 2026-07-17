import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateEnvelope } from '../../src/core/messaging/runtimeEnvelope';

describe('RuntimeEnvelope', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('accepts a valid message and returns parsed envelope', () => {
    const msg = { type: 'test', source: 'background' as const, payload: { data: 1 } };
    const result = validateEnvelope(msg);
    expect(result.type).toBe('test');
    expect(result.source).toBe('background');
    expect(result.payload).toEqual({ data: 1 });
  });

  it('accepts messages from all valid sources', () => {
    const sources = ['background', 'sidepanel', 'standalone', 'popup'] as const;
    for (const source of sources) {
      const result = validateEnvelope({ type: 't', source, payload: null });
      expect(result.source).toBe(source);
    }
  });

  it('rejects legacy "fullapp" source', () => {
    expect(() =>
      validateEnvelope({ type: 'test', source: 'fullapp', payload: null }),
    ).toThrow('Invalid message envelope');
  });

  it('rejects a message with missing fields', () => {
    expect(() => validateEnvelope({ type: 'test' })).toThrow('Invalid message envelope');
    expect(() => validateEnvelope({ source: 'background' })).toThrow('Invalid message envelope');
    expect(() => validateEnvelope({})).toThrow('Invalid message envelope');
  });

  it('rejects a message with invalid source (spoofed sender)', () => {
    expect(() =>
      validateEnvelope({ type: 'test', source: 'malicious-spoof', payload: null }),
    ).toThrow('Invalid message envelope');
  });

  it('accepts content-script as a valid MessageSource', () => {
    const result = validateEnvelope({ type: 'test', source: 'content-script', payload: null });
    expect(result.source).toBe('content-script');
  });

  it('accepts optional timestamp field', () => {
    const ts = Date.now();
    const result = validateEnvelope({ type: 't', source: 'background', payload: null, timestamp: ts });
    expect(result.timestamp).toBe(ts);
  });
});
