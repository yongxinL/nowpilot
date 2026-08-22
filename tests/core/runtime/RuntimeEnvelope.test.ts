import { describe, it, expect } from 'vitest';
import {
  createEnvelope,
  isEnvelope,
  MessageTypeValues,
  MessageType,
} from '../../../src/core/runtime/RuntimeEnvelope';

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

describe('RuntimeEnvelope frozen extraction types (D-15, REQ-R04)', () => {
  // Type-only declarations — no runtime handler is registered for any of
  // these in Phase 1. Phase 6 wires the actual extraction pipeline
  // (Defuddle/Readability) against these shapes.

  const RESERVED_TYPES: MessageType[] = [
    'PAGE_LIVE_CONTEXT',
    'PAGE_EXTRACTION_REQUESTED',
    'PAGE_HTML_PAYLOAD',
  ];

  it('declares the three reserved extraction MessageType values', () => {
    RESERVED_TYPES.forEach((type) => {
      expect(MessageTypeValues).toContain(type);
    });
  });

  it('declares each reserved type exactly once (no duplicates)', () => {
    RESERVED_TYPES.forEach((type) => {
      const occurrences = MessageTypeValues.filter((t) => t === type);
      expect(occurrences).toHaveLength(1);
    });
  });

  it('createEnvelope accepts a structurally valid PAGE_HTML_PAYLOAD', () => {
    const envelope = createEnvelope(
      'PAGE_HTML_PAYLOAD',
      { html: '<html>...</html>', baseUrl: 'https://example.com', truncated: false },
      'content',
    );
    expect(envelope.type).toBe('PAGE_HTML_PAYLOAD');
    expect(envelope.source).toBe('content');
    expect(isEnvelope(envelope)).toBe(true);
  });

  it('PAGE_HTML_PAYLOAD envelope with empty html is structurally valid', () => {
    // Edge case from the plan: truncated/empty payload is legal. No
    // runtime handler exists in Phase 1 that would need non-empty content
    // to function — Phase 6 will enforce non-empty-html if/when needed.
    const envelope = createEnvelope(
      'PAGE_HTML_PAYLOAD',
      { html: '', baseUrl: '', truncated: true },
      'content',
    );
    expect(isEnvelope(envelope)).toBe(true);
    expect(envelope.payload).toEqual({ html: '', baseUrl: '', truncated: true });
  });

  it('createEnvelope accepts PAGE_LIVE_CONTEXT with minimal payload', () => {
    const envelope = createEnvelope(
      'PAGE_LIVE_CONTEXT',
      { url: 'https://example.com/path' },
      'content',
    );
    expect(envelope.type).toBe('PAGE_LIVE_CONTEXT');
    expect(isEnvelope(envelope)).toBe(true);
  });

  it('createEnvelope accepts PAGE_EXTRACTION_REQUESTED with minimal payload', () => {
    const envelope = createEnvelope(
      'PAGE_EXTRACTION_REQUESTED',
      { tabId: 1, url: 'https://example.com' },
      'content',
    );
    expect(envelope.type).toBe('PAGE_EXTRACTION_REQUESTED');
    expect(isEnvelope(envelope)).toBe(true);
  });
});

