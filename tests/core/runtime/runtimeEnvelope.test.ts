import { describe, expect, it } from 'vitest';
import { createOperationId } from '@/core/runtime/OperationId';
import { parseRuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';

function validEnvelope() {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'standalone.open',
    source: 'sidepanel',
    target: 'background',
    timestamp: 1,
    payload: { destination: 'chat' },
  };
}

describe('RuntimeEnvelope', () => {
  it('parses a valid envelope', () => {
    const result = parseRuntimeEnvelope(validEnvelope());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.type).toBe('standalone.open');
  });

  it('fails closed on an unknown message type', () => {
    const result = parseRuntimeEnvelope({ ...validEnvelope(), type: 'workspace.unknown' });
    expect(result.success).toBe(false);
  });

  it('fails closed when the payload does not match the type', () => {
    const result = parseRuntimeEnvelope({
      ...validEnvelope(),
      payload: { destination: 'not-a-route' },
    });
    expect(result.success).toBe(false);
  });

  it('fails closed on an invalid target surface', () => {
    expect(parseRuntimeEnvelope({ ...validEnvelope(), target: 'content' }).success).toBe(false);
  });

  it('rejects unknown envelope versions', () => {
    expect(parseRuntimeEnvelope({ ...validEnvelope(), envelopeVersion: 2 }).success).toBe(false);
  });
});
