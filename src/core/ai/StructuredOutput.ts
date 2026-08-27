import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ProviderId } from './types';
import { PROMPTS } from '../prompts';
import { ProviderError } from './providers/base';

/**
 * Structured output repair loop — Appendix L verbatim
 * (PRODUCT_SPEC_v0_1.md 5830-5904).
 *
 * requestJson converts the Zod schema to JSON Schema, calls the provider in
 * JSON mode, and repairs malformed JSON EXACTLY once using
 * PROMPTS.repairJson.system; a second failure throws the terminal
 * `STRUCTURED_OUTPUT_FAILED` error with `retryable: false`.
 *
 * Implementer note: v0.1 uses zod-to-json-schema 3.25.2 exactly as shown —
 * do NOT substitute Zod 4 native `z.toJSONSchema()` (deferred v0.2 cleanup).
 * The `z.ZodSchema<T>` type name in the appendix is zod v3; zod v4 names the
 * same concept `z.ZodType<T>`.
 */

export const STRUCTURED_OUTPUT_FAILED = 'STRUCTURED_OUTPUT_FAILED' as const;

/** Terminal error thrown when the one-shot repair also fails (Appendix L). */
export class StructuredOutputError extends Error {
  readonly code = STRUCTURED_OUTPUT_FAILED;
  readonly retryable = false;
  readonly raw: { first: string; second: string };

  constructor(first: string, second: string) {
    super(STRUCTURED_OUTPUT_FAILED);
    this.name = 'StructuredOutputError';
    this.raw = { first, second };
  }
}

export interface StructuredOutputContext {
  operationId: string;
  providerId: ProviderId;
  model: string;
  timeoutMs: number;
  callProviderJsonMode: (prompt: string, jsonSchema: unknown, signal: AbortSignal) => Promise<string>;
  abortSignal: AbortSignal;
}

export async function requestJson<T>(
  schema: z.ZodType<T>,
  prompt: string,
  ctx: StructuredOutputContext,
): Promise<T> {
  // zod-to-json-schema@3.25.2 declares its parameter as zod v3's ZodSchema;
  // the runtime accepts v4 schemas (peerDeps `zod ^3.25.28 || ^4`). Bridge
  // through the declared parameter type — strict-clean, no suppression marker.
  const jsonSchema = zodToJsonSchema(schema as unknown as Parameters<typeof zodToJsonSchema>[0]);
  const attempt = async (p: string): Promise<string> => {
    const ac = new AbortController();
    let timedOut = false;
    const onAbort = () => ac.abort();
    ctx.abortSignal.addEventListener('abort', onAbort);
    const to = setTimeout(() => {
      timedOut = true;
      ac.abort();
    }, ctx.timeoutMs);
    try {
      return await ctx.callProviderJsonMode(p, jsonSchema, ac.signal);
    } catch (err) {
      // WR-02: the internal §1.2 timeout is NOT a caller abort. The provider
      // converts the internal ac.abort() into an AbortError; rethrow it as a
      // TIMEOUT-coded ProviderError so the caller surfaces a timeout instead
      // of silently treating the dropped turn as a user stop.
      if (timedOut) {
        throw new ProviderError('TIMEOUT', `planner timed out after ${ctx.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(to);
      ctx.abortSignal.removeEventListener('abort', onAbort);
    }
  };
  const first = await attempt(prompt);
  const parsedFirst = safeParse(schema, first);
  if (parsedFirst.ok) return parsedFirst.data;
  const repairPrompt = `${PROMPTS.repairJson.system}
Schema: ${JSON.stringify(jsonSchema)}
Broken: ${first}`;
  const second = await attempt(repairPrompt);
  const parsedSecond = safeParse(schema, second);
  if (parsedSecond.ok) return parsedSecond.data;
  throw new StructuredOutputError(first, second);
}

function safeParse<T>(schema: z.ZodType<T>, raw: string):
  | { ok: true; data: T }
  | { ok: false; error: unknown }
{
  try {
    const cleaned = raw.trim()
      .replace(/^```(?:json)?/i, '')
      .replace(/```$/, '')
      .trim();
    const parsed = JSON.parse(cleaned);
    const res = schema.safeParse(parsed);
    return res.success ? { ok: true, data: res.data } : { ok: false, error: res.error };
  } catch (e) {
    return { ok: false, error: e };
  }
}