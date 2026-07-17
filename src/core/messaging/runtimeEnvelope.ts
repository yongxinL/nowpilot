import { z } from 'zod';
import { debugLog } from '../utils/debugLog';

export type MessageSource = 'background' | 'sidepanel' | 'standalone' | 'popup' | 'content-script';

export interface Envelope<T = unknown> {
  type: string;
  source: MessageSource;
  payload: T;
  timestamp?: number;
}

const envelopeSchema = z.object({
  type: z.string(),
  source: z.enum(['background', 'sidepanel', 'standalone', 'popup', 'content-script']),
  payload: z.unknown(),
  timestamp: z.number().optional(),
});

export function validateEnvelope<T>(message: unknown): Envelope<T> {
  const result = envelopeSchema.safeParse(message);
  if (!result.success) {
    debugLog('warn', 'Invalid message envelope', { errors: result.error.flatten() });
    throw new Error('Invalid message envelope');
  }
  return result.data as Envelope<T>;
}
