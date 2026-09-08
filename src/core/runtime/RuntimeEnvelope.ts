import { z } from 'zod';
import { MessageTypeValues, type MessageTypeValue } from './MessageType';

export type RuntimeSource = 'sidepanel' | 'background' | 'content' | 'addon' | 'standalone';

export interface RuntimeEnvelope<T = unknown> {
  id: string;
  type: MessageTypeValue;
  createdAt: number;
  source: RuntimeSource;
  target?: RuntimeSource;
  payload: T;
}

export type ResponseEnvelope<T = unknown> =
  | { id: string; ok: true; data: T }
  | { id: string; ok: false; error: { code: string; message: string; retryable: boolean } };

export const RuntimeEnvelopeSchema = z.object({
  id: z.string(),
  type: z.enum(MessageTypeValues as [MessageTypeValue, ...MessageTypeValue[]]),
  createdAt: z.number(),
  source: z.enum(['sidepanel', 'background', 'content', 'addon', 'standalone']),
  target: z.enum(['sidepanel', 'background', 'content', 'addon', 'standalone']).optional(),
  payload: z.unknown(),
});

export const ResponseEnvelopeSchema = z.discriminatedUnion('ok', [
  z.object({ id: z.string(), ok: z.literal(true), data: z.unknown() }),
  z.object({
    id: z.string(),
    ok: z.literal(false),
    error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }),
  }),
]);
