import { describe, it, expect } from 'vitest';
import { createEnvelope, isEnvelope, MessageTypeValues } from '../../../src/core/runtime/RuntimeEnvelope';

describe('RuntimeEnvelope', () => {
  it('creates a valid envelope', () => {
    const envelope = createEnvelope('GET_ACTIVE_TAB_CONTEXT', { tabId: 1 }, 'background');
    expect(envelope.type).toBe('GET_ACTIVE_TAB_CONTEXT');
    expect(envelope.source).toBe('background');
    expect(envelope.payload).toEqual({ tabId: 1 });
    expect(envelope.operationId).toBeTruthy();
    expect(typeof envelope.operationId).toBe('string');
    expect(envelope.timestamp).toBeGreaterThan(0);
  });

  it('isEnvelope returns true for valid envelopes', () => {
    const envelope = createEnvelope('WORKSPACE_UPDATED', null, 'sidepanel');
    expect(isEnvelope(envelope)).toBe(true);
  });

  it('isEnvelope returns false for invalid objects', () => {
    expect(isEnvelope(null)).toBe(false);
    expect(isEnvelope(undefined)).toBe(false);
    expect(isEnvelope({})).toBe(false);
    expect(isEnvelope({ type: 'INVALID' })).toBe(false);
  });

  it('all message types are valid', () => {
    expect(MessageTypeValues.length).toBeGreaterThan(0);
    MessageTypeValues.forEach((type) => {
      const envelope = createEnvelope(type, {}, 'sidepanel');
      expect(isEnvelope(envelope)).toBe(true);
    });
  });
});
