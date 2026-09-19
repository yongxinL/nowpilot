import { describe, expect, it } from 'vitest';
import { createOperationId } from '@/core/runtime/OperationId';
import {
  MESSAGE_TYPE_ALLOWED_SOURCES,
  MESSAGE_TYPES,
  type MessageType,
} from '@/core/runtime/MessageType';
import type { RuntimeSurface } from '@/core/runtime/RuntimeSurface';
import {
  getAllowedSources,
  isTrustedExtensionSender,
  validateInboundEnvelope,
} from '@/core/runtime/RuntimeEnvelope';

const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';

const ALL_SURFACES: readonly RuntimeSurface[] = ['background', 'sidepanel', 'standalone'];

function payloadFor(type: MessageType): unknown {
  const payloads: Record<MessageType, unknown> = {
    'workspace.mutation': {
      mutationId: '00000000-0000-4000-8000-000000000000',
      writerInstanceId: 'writer',
      epoch: 0,
      baseVersion: 0,
      resultingVersion: 1,
      kind: 'workspace.metadata.set',
      payload: { schemaVersion: 1, committedVersion: 1, updatedAt: 1 },
    },
    'workspace.handoff.prepare': { toInstanceId: 'target', epoch: 0, baseVersion: 0 },
    'workspace.handoff.ack': { toInstanceId: 'target', epoch: 0, committedVersion: 0 },
    'workspace.handoff.commit': { toInstanceId: 'target', epoch: 0, committedVersion: 0 },
    'workspace.relinquish': { epoch: 0, committedVersion: 0 },
    'workspace.rehydrate.request': {
      sinceVersion: 0,
      instanceId: 'target',
      writerType: 'standalone',
    },
    'workspace.rehydrate.response': {
      committedVersion: 0,
      epoch: 0,
      metadata: { schemaVersion: 1, committedVersion: 0, updatedAt: 1 },
    },
    'standalone.open': { destination: 'chat' },
    'standalone.focus': { destination: 'chat' },
    'standalone.closed': {},
    'runtime.error': { code: 'RUNTIME_ENVELOPE_INVALID' },
    'workspace.election.request': {
      requestId: createOperationId(),
      operation: 'claim',
      requesterInstanceId: 'sidepanel-instance',
      requesterWriterType: 'sidepanel',
      committedVersion: 0,
    },
    'workspace.election.response': {
      requestId: createOperationId(),
      accepted: false,
      code: 'WORKSPACE_ELECTION_REJECTED',
    },
  };
  return payloads[type];
}

function envelopeForType(type: MessageType, source: RuntimeSurface) {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type,
    source,
    target: 'background',
    timestamp: 1,
    payload: payloadFor(type),
  };
}

function envelope(overrides: Record<string, unknown> = {}) {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'standalone.open',
    source: 'sidepanel',
    target: 'background',
    timestamp: 1,
    payload: { destination: 'chat' },
    ...overrides,
  };
}

const TRUSTED_SENDER = {
  id: EXTENSION_ID,
  url: `chrome-extension://${EXTENSION_ID}/sidepanel.html`,
};

describe('boundary validation', () => {
  it('accepts a valid envelope from a trusted extension sender', () => {
    const result = validateInboundEnvelope(envelope(), TRUSTED_SENDER, EXTENSION_ID);
    expect(result.ok).toBe(true);
  });

  it('rejects an invalid envelope with RUNTIME_ENVELOPE_INVALID', () => {
    const result = validateInboundEnvelope({ nope: true }, TRUSTED_SENDER, EXTENSION_ID);
    expect(result).toEqual({ ok: false, code: 'RUNTIME_ENVELOPE_INVALID' });
  });

  it('rejects a foreign sender with RUNTIME_SENDER_REJECTED', () => {
    const result = validateInboundEnvelope(
      envelope(),
      { id: 'someoneelse', url: 'chrome-extension://someoneelse/sidepanel.html' },
      EXTENSION_ID,
    );
    expect(result).toEqual({ ok: false, code: 'RUNTIME_SENDER_REJECTED' });
  });

  it('rejects a sender without an id', () => {
    expect(
      validateInboundEnvelope(envelope(), { url: 'https://example.com' }, EXTENSION_ID),
    ).toEqual({ ok: false, code: 'RUNTIME_SENDER_REJECTED' });
  });

  it('rejects a non-extension sender url', () => {
    expect(
      isTrustedExtensionSender({ id: EXTENSION_ID, url: 'https://example.com/x' }, EXTENSION_ID),
    ).toBe(false);
  });

  it('rejects a message whose source is not allowed for its type', () => {
    const result = validateInboundEnvelope(
      envelope({ type: 'standalone.closed', payload: {} }),
      TRUSTED_SENDER,
      EXTENSION_ID,
    );
    expect(result).toEqual({ ok: false, code: 'RUNTIME_SENDER_REJECTED' });
  });

  it('accepts the background as a source for standalone.focus', () => {
    const result = validateInboundEnvelope(
      envelope({
        type: 'standalone.focus',
        source: 'background',
        payload: { destination: 'chat' },
      }),
      { id: EXTENSION_ID, url: `chrome-extension://${EXTENSION_ID}/background.js` },
      EXTENSION_ID,
    );
    expect(result.ok).toBe(true);
  });

  it('registers the thirteen-type registry with the election source matrix', () => {
    expect([...MESSAGE_TYPES]).toHaveLength(13);
    expect(MESSAGE_TYPE_ALLOWED_SOURCES['workspace.election.request']).toEqual([
      'sidepanel',
      'standalone',
    ]);
    expect(MESSAGE_TYPE_ALLOWED_SOURCES['workspace.election.response']).toEqual(['background']);
  });

  it('rejects a background-originated election request', () => {
    const result = validateInboundEnvelope(
      envelope({
        type: 'workspace.election.request',
        source: 'background',
        payload: payloadFor('workspace.election.request'),
      }),
      { id: EXTENSION_ID, url: `chrome-extension://${EXTENSION_ID}/background.js` },
      EXTENSION_ID,
    );
    expect(result).toEqual({ ok: false, code: 'RUNTIME_SENDER_REJECTED' });
  });

  it('declares exactly one explicit non-empty allowed-source list per message type', () => {
    for (const type of MESSAGE_TYPES) {
      const allowed = MESSAGE_TYPE_ALLOWED_SOURCES[type];
      expect(Array.isArray(allowed), type).toBe(true);
      expect(allowed.length, type).toBeGreaterThan(0);
      for (const source of allowed) {
        expect(ALL_SURFACES, `${type}:${source}`).toContain(source);
      }
      expect(getAllowedSources(type)).toEqual(allowed);
    }
    expect(Object.keys(MESSAGE_TYPE_ALLOWED_SOURCES).sort()).toEqual([...MESSAGE_TYPES].sort());
  });

  it('never falls back to a wildcard or permissive default', () => {
    for (const type of MESSAGE_TYPES) {
      expect(getAllowedSources(type).length).toBeLessThan(ALL_SURFACES.length + 1);
      expect(getAllowedSources(type)).not.toContain('*' as unknown as RuntimeSurface);
    }
  });

  it('accepts every message type from each of its allowed sources', () => {
    for (const type of MESSAGE_TYPES) {
      for (const source of MESSAGE_TYPE_ALLOWED_SOURCES[type]) {
        const result = validateInboundEnvelope(
          envelopeForType(type, source),
          { id: EXTENSION_ID, url: `chrome-extension://${EXTENSION_ID}/${source}` },
          EXTENSION_ID,
        );
        expect(result.ok, `${type} from ${source}`).toBe(true);
      }
    }
  });

  it('rejects a representative disallowed source for every message type that has one', () => {
    for (const type of MESSAGE_TYPES) {
      const disallowed = ALL_SURFACES.find(
        (source) => !MESSAGE_TYPE_ALLOWED_SOURCES[type].includes(source),
      );
      if (!disallowed) continue;
      const result = validateInboundEnvelope(
        envelopeForType(type, disallowed),
        { id: EXTENSION_ID, url: `chrome-extension://${EXTENSION_ID}/${disallowed}` },
        EXTENSION_ID,
      );
      expect(result, `${type} from ${disallowed}`).toEqual({
        ok: false,
        code: 'RUNTIME_SENDER_REJECTED',
      });
    }
  });
});
