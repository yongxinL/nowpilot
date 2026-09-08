import { describe, expect, it } from 'vitest';
import { MessageType, MessageTypeValues } from '@/core/runtime/MessageType';
import {
  ResponseEnvelopeSchema,
  RuntimeEnvelopeSchema,
  type RuntimeEnvelope,
} from '@/core/runtime/RuntimeEnvelope';

describe('RuntimeEnvelope', () => {
  it('parses a valid envelope fixture', () => {
    const env: RuntimeEnvelope<{ foo: string }> = {
      id: 'op-1',
      type: MessageType.OPEN_STANDALONE,
      createdAt: 123,
      source: 'sidepanel',
      payload: { foo: 'bar' },
    };
    const parsed = RuntimeEnvelopeSchema.parse(env);
    expect(parsed.type).toBe(MessageType.OPEN_STANDALONE);
    expect(parsed.source).toBe('sidepanel');
    expect(parsed.payload).toEqual({ foo: 'bar' });
  });

  it('rejects an unknown message type value', () => {
    const bad = {
      id: 'op-2',
      type: 'NOT_A_MESSAGE_TYPE',
      createdAt: 1,
      source: 'sidepanel',
      payload: {},
    };
    expect(() => RuntimeEnvelopeSchema.parse(bad)).toThrow();
  });

  it('exposes every declared message type in MessageTypeValues', () => {
    for (const value of Object.values(MessageType)) {
      expect(MessageTypeValues).toContain(value);
    }
  });
});

describe('ResponseEnvelope', () => {
  it('parses a success envelope', () => {
    const parsed = ResponseEnvelopeSchema.parse({ id: 'r1', ok: true, data: { x: 1 } });
    expect(parsed.ok).toBe(true);
  });

  it('parses an error envelope', () => {
    const parsed = ResponseEnvelopeSchema.parse({
      id: 'r2',
      ok: false,
      error: { code: 'PROVIDER_CHECK_FAILED', message: 'failed', retryable: true },
    });
    expect(parsed.ok).toBe(false);
  });
});
