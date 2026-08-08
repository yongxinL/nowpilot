// tests/core/runtime/RuntimeEnvelope.test.ts — §0.3 Zod fixture test
// @vitest-environment node — pure TS/Zod logic, no DOM needed; node env avoids
// the jsdom 30 realm TextEncoder vs esbuild Uint8Array invariant break (01-01 Rule 3).
// Enforces RuntimeEnvelope/ResponseEnvelope shape at the public messaging
// boundary (Appendix C verbatim). A spoofed or malformed envelope must fail
// parse BEFORE dispatch (T-1-04 mitigation).
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { MessageTypeValues, type MessageTypeValue } from '@/core/runtime/MessageType';
import type { RuntimeEnvelope, ResponseEnvelope } from '@/core/runtime/RuntimeEnvelope';

const sourceSchema = z.enum(['sidepanel', 'background', 'content', 'addon', 'standalone']);
const messageTypeSchema = z.enum(MessageTypeValues as [MessageTypeValue, ...MessageTypeValue[]]);

// Zod schema mirroring Appendix C RuntimeEnvelope<T> (payload typed loosely as unknown
// at the boundary; the fixture exercises the structural fields).
const runtimeEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: messageTypeSchema,
  createdAt: z.number(),
  source: sourceSchema,
  target: sourceSchema.optional(),
  payload: z.unknown(),
});

const responseEnvelopeSchema = z.discriminatedUnion('ok', [
  z.object({ id: z.string().min(1), ok: z.literal(true), data: z.unknown() }),
  z.object({
    id: z.string().min(1),
    ok: z.literal(false),
    error: z.object({
      code: z.string().min(1),
      message: z.string(),
      retryable: z.boolean(),
    }),
  }),
]);

describe('RuntimeEnvelope (Appendix C fixture)', () => {
  it('parses a valid request envelope', () => {
    const fixture: RuntimeEnvelope<{ url: string }> = {
      id: 'op-1',
      type: 'PROXY_FETCH',
      createdAt: 1710000000000,
      source: 'sidepanel',
      target: 'background',
      payload: { url: 'https://example.com' },
    };
    const parsed = runtimeEnvelopeSchema.parse(fixture);
    expect(parsed.type).toBe('PROXY_FETCH');
    expect(parsed.payload).toEqual({ url: 'https://example.com' });
  });

  it('parses a PONG-style response envelope', () => {
    const fixture: ResponseEnvelope<{ pong: true }> = {
      id: 'op-1',
      ok: true,
      data: { pong: true },
    };
    const parsed = responseEnvelopeSchema.parse(fixture);
    expect(parsed).toMatchObject({ id: 'op-1', ok: true, data: { pong: true } });
  });

  it('parses a failing response envelope with retryable error shape', () => {
    const fixture: ResponseEnvelope = {
      id: 'op-2',
      ok: false,
      error: { code: 'PROVIDER_FETCH_FAILED', message: 'boom', retryable: true },
    };
    const parsed = responseEnvelopeSchema.parse(fixture);
    expect(parsed.ok).toBe(false);
    if (parsed.ok === false) {
      expect(parsed.error.retryable).toBe(true);
    }
  });

  it('rejects an envelope with a non-canonical message type', () => {
    const spoofed = {
      id: 'op-3',
      type: 'NOT_A_CANONICAL_TYPE',
      createdAt: 1710000000000,
      source: 'content',
      payload: {},
    };
    expect(() => runtimeEnvelopeSchema.parse(spoofed)).toThrow();
  });

  it('rejects an envelope missing the id field', () => {
    const malformed = {
      type: 'PING',
      createdAt: 1710000000000,
      source: 'content',
      payload: {},
    };
    expect(() => runtimeEnvelopeSchema.parse(malformed)).toThrow();
  });

  it('rejects a response envelope with mismatched ok/error fields', () => {
    const malformed = {
      id: 'op-4',
      ok: false,
      data: { pong: true }, // ok:false must carry error, not data
    };
    expect(() => responseEnvelopeSchema.parse(malformed)).toThrow();
  });
});
