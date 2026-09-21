import { describe, it, expect } from 'vitest';
import {
  createEnvelope,
  MessageType,
  MessageTypeValues,
  ScaffoldMessageType,
  ScaffoldMessageTypeValues,
} from '../../../src/core/runtime/RuntimeEnvelope';
import {
  isEnvelope,
  validateEnvelope,
} from '../../../src/core/runtime/RuntimeEnvelopeValidation';

type CanonicalType = (typeof MessageType)[keyof typeof MessageType];
type ScaffoldType = (typeof ScaffoldMessageType)[keyof typeof ScaffoldMessageType];

/**
 * One valid payload per canonical (Appendix E) message type. A new canonical
 * type added without a payload fixture fails the coverage case below.
 */
const VALID_PAYLOADS: Record<CanonicalType, unknown> = {
  PROXY_FETCH: {
    addonId: 'addon-1',
    url: 'https://example.com/api',
    method: 'GET',
  },
  EXTRACT_PAGE_CONTENT: { url: 'https://example.com', tabId: 1 },
  OPEN_SIDE_PANEL: { workspaceId: 'w1' },
  OPEN_STANDALONE: { workspaceId: 'w1', conversationId: 'c1' },
  SESSION_TOKEN_UPDATE: { token: 'opaque-token' },
  BACKGROUND_STATE: { state: 'ready' },
  KEEPALIVE_PING: {},
  PORT_STREAM_START: { operationId: 'op-1', kind: 'session-tokens' },
  PORT_STREAM_CHUNK: { operationId: 'op-1', data: { delta: 'x' } },
  PORT_STREAM_END: { operationId: 'op-1', ok: true },
  PORT_STREAM_ABORT: { operationId: 'op-1' },
  ADDON_EVENT: { addonId: 'addon-1', event: 'registered' },
  WORKSPACE_HANDOFF: { workspaceId: 'w1' },
  WORKSPACE_UPDATED: { workspaceId: 'w1' },
  WORKSPACE_HEARTBEAT: { workspaceId: 'w1' },
};

describe('RuntimeEnvelope', () => {
  it('creates a valid envelope', () => {
    const envelope = createEnvelope('OPEN_STANDALONE', { workspaceId: 'w1' }, 'background');
    expect(envelope.type).toBe('OPEN_STANDALONE');
    expect(envelope.source).toBe('background');
    expect(envelope.payload).toEqual({ workspaceId: 'w1' });
    expect(envelope.operationId).toBeTruthy();
    expect(typeof envelope.operationId).toBe('string');
    expect(envelope.timestamp).toBeGreaterThan(0);
  });

  it('isEnvelope returns true for valid envelopes', () => {
    const envelope = createEnvelope('WORKSPACE_UPDATED', { workspaceId: 'w1' }, 'sidepanel');
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
      const envelope = createEnvelope(type, VALID_PAYLOADS[type], 'sidepanel');
      expect(isEnvelope(envelope)).toBe(true);
    });
  });

  it('createEnvelope returns the given type/source with a generated operationId and numeric timestamp', () => {
    const envelope = createEnvelope('OPEN_STANDALONE', { workspaceId: 'w1' }, 'sidepanel');
    expect(envelope.type).toBe('OPEN_STANDALONE');
    expect(envelope.source).toBe('sidepanel');
    expect(envelope.operationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(typeof envelope.timestamp).toBe('number');
    expect(Number.isFinite(envelope.timestamp)).toBe(true);
  });

  it('generates a distinct operationId per envelope', () => {
    const first = createEnvelope('KEEPALIVE_PING', {}, 'background');
    const second = createEnvelope('KEEPALIVE_PING', {}, 'background');
    expect(first.operationId).not.toBe(second.operationId);
  });

  it('isEnvelope accepts a valid envelope of each canonical type', () => {
    (Object.keys(VALID_PAYLOADS) as CanonicalType[]).forEach((type) => {
      const envelope = createEnvelope(type, VALID_PAYLOADS[type], 'sidepanel');
      expect(isEnvelope(envelope)).toBe(true);
      expect(validateEnvelope(envelope).ok).toBe(true);
    });
  });

  it('rejects an envelope missing operationId', () => {
    expect(isEnvelope({ type: 'OPEN_STANDALONE' })).toBe(false);
  });

  it('rejects an envelope missing a payload', () => {
    expect(
      isEnvelope({
        type: 'OPEN_STANDALONE',
        operationId: 'x',
        timestamp: 1,
        source: 'sidepanel',
      }),
    ).toBe(false);
  });

  it('rejects an envelope with an unknown message type', () => {
    expect(
      isEnvelope({ type: 'NOT_A_TYPE', operationId: 'x', timestamp: 1, source: 'sidepanel' }),
    ).toBe(false);
  });

  it('rejects an envelope with an unknown extra structural field', () => {
    expect(
      isEnvelope({
        type: 'OPEN_STANDALONE',
        operationId: 'x',
        timestamp: 1,
        source: 'sidepanel',
        payload: { workspaceId: 'w1' },
        injected: true,
      }),
    ).toBe(false);
  });

  it('rejects a payload that does not satisfy the type schema', () => {
    const wrongShape = {
      type: 'OPEN_STANDALONE',
      operationId: 'x',
      timestamp: 1,
      source: 'sidepanel',
      payload: { workspaceId: 42 },
    };
    expect(isEnvelope(wrongShape)).toBe(false);
  });

  it('rejects an unknown extra payload field because payload schemas are strict', () => {
    const extraField = {
      type: 'OPEN_STANDALONE',
      operationId: 'x',
      timestamp: 1,
      source: 'sidepanel',
      payload: { workspaceId: 'w1', notInSchema: true },
    };
    expect(isEnvelope(extraField)).toBe(false);
  });

  it('rejects an oversized payload string rather than accepting it truncated', () => {
    // One character over the §26.6 PAGE_HTML_MAX_BYTES (2 MB) cap.
    const oversized = 'x'.repeat(2_000_001);
    const envelope = {
      type: 'PAGE_HTML_PAYLOAD',
      operationId: 'x',
      timestamp: 1,
      source: 'content',
      payload: { html: oversized, baseUrl: 'https://example.com', truncated: true },
    };
    expect(isEnvelope(envelope)).toBe(false);
  });

  it('exposes the canonical OPEN_SIDE_PANEL and OPEN_STANDALONE literals', () => {
    expect(MessageType.OPEN_STANDALONE).toBe('OPEN_STANDALONE');
    expect(MessageType.OPEN_SIDE_PANEL).toBe('OPEN_SIDE_PANEL');
  });

  it('MessageTypeValues carries no prototype literal spelling', () => {
    expect(MessageTypeValues).not.toContain('STANDALONE_OPEN');
    expect(MessageTypeValues).not.toContain('SIDE_PANEL_OPEN');
    expect(MessageTypeValues).toContain('OPEN_STANDALONE');
    expect(MessageTypeValues).toContain('OPEN_SIDE_PANEL');
  });

  it('derives MessageTypeValues from MessageType (one source, no parallel list)', () => {
    expect(MessageTypeValues).toEqual(Object.values(MessageType));
  });

  it('exposes ScaffoldMessageType separately and MessageType carries none of its literals', () => {
    expect(Object.values(ScaffoldMessageType).sort()).toEqual(
      [
        'CONTENT_SCRIPT_READY',
        'PAGE_EXTRACTION_REQUESTED',
        'PAGE_HTML_PAYLOAD',
        'PAGE_LIVE_CONTEXT',
        'SPA_NAVIGATION',
      ].sort(),
    );
    Object.values(ScaffoldMessageType).forEach((literal) => {
      expect(MessageTypeValues).not.toContain(literal);
    });
  });

  it('validateEnvelope returns a typed failure for a malformed envelope', () => {
    const result = validateEnvelope({ type: 'OPEN_STANDALONE' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    }
  });

  it('validateEnvelope returns the envelope for a valid one', () => {
    const envelope = createEnvelope('OPEN_SIDE_PANEL', { workspaceId: 'w1' }, 'standalone');
    const result = validateEnvelope(envelope);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.envelope).toBe(envelope);
    }
  });
});

describe('RuntimeEnvelope frozen extraction types (D-15, REQ-R04)', () => {
  // Type-only declarations — no runtime handler is registered for any of
  // these in Phase 1. Phase 6 wires the actual extraction pipeline
  // (Defuddle/Readability) against these shapes.

  const RESERVED_TYPES: ScaffoldType[] = [
    'PAGE_LIVE_CONTEXT',
    'PAGE_EXTRACTION_REQUESTED',
    'PAGE_HTML_PAYLOAD',
  ];

  it('declares the three reserved extraction types in ScaffoldMessageType', () => {
    RESERVED_TYPES.forEach((type) => {
      expect(ScaffoldMessageTypeValues).toContain(type);
    });
  });

  it('declares each reserved type exactly once (no duplicates)', () => {
    RESERVED_TYPES.forEach((type) => {
      const occurrences = ScaffoldMessageTypeValues.filter((t) => t === type);
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
