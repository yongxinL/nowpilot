// src/core/ai/StructuredOutput.ts — Source: PRODUCT_SPEC Appendix L "Structured
// Output Repair Loop" (lines 5827-5923) VERBATIM, with the F-4 signature:
// requestJson / callProviderJsonMode take PromptSection[] — NOT a pre-joined
// string — so the cached [SYSTEM] stays byte-stable across the ONE repair
// (prompt-cache stability, §1.3) and the fragile `prompt.split('\n\n')[0]`
// recovery is gone (F-4, 03-04). Golden Rule 4 / D-19: exactly ONE repair, then
// STRUCTURED_OUTPUT_FAILED — never a third attempt, never hand-parsed JSON,
// never a joined-string rebuild.
//
// P-3: PromptSection is imported from '@/core/ai/types' (D-07 canonical home) —
// no second declaration (R-1), no import from '../context/ContextOptimizer'.
//
// Threat register (03-04, mitigate):
//   T-03-04-01 — one Zod-validated decision, exactly one repair, then
//     STRUCTURED_OUTPUT_FAILED (test-asserted call count = 2 max).
//   T-03-04-02 — the repair APPENDS a task-kind (user_input) section; the
//     cached-section text is byte-identical across attempt 1 and the repair
//     (hash-equality test) — a joined-string rebuild would silently drift the
//     cached prefix and kill the provider prompt cache.
//   T-03-04-04 — per-attempt AbortController with ctx.timeoutMs; the outer
//     abortSignal propagates (Appendix L). WR-03 (03-11): the per-attempt
//     timeout sets a timedOut flag BEFORE ac.abort() and the catch rethrows a
//     typed TimeoutError (shared carrier from @/core/error/TimeoutError) for
//     timeout-origin failures — classified TIMEOUT/retryable upstream; user
//     aborts still propagate as AbortError (never conflated, T-03-11-01).
//   T-03-04-05 — the terminal failure is logged via debugLog with the canonical
//     STRUCTURED_OUTPUT_FAILED code + module only — NEVER raw model output
//     bodies (R-10; debugLog auto-routes through TraceRedactor).
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { timeoutError } from '@/core/error/TimeoutError';
import { PROMPTS } from '@/core/prompts';
import type { ProviderId, PromptSection } from '@/core/ai/types';

// F-4: cached kinds → provider `system` (byte-stable, prompt-cached §1.3); task
// kinds → `prompt`. The Router-supplied callback performs this mapping;
// requestJson only threads sections through (never string-splits). 03a-01:
// 'tool_result' (D-3a-11 F-4 replan feedback) maps to the prompt side — it is
// NEVER part of the cached set (Pitfall 2/7 — both TASK_KINDS copies must list
// it or joinSections/filter silently drops the section).
const TASK_KINDS: ReadonlyArray<PromptSection['kind']> = [
  'context',
  'task',
  'user_input',
  'tool_result',
];

export interface StructuredOutputContext {
  operationId: string;
  providerId: ProviderId;
  model: string;
  timeoutMs: number;
  // F-4: receives PromptSection[] rather than a joined string — removes the
  // fragile `prompt.split('\n\n')[0]` [SYSTEM] recovery that mis-slices when a
  // cached section (multi-line persona block, tool schemas) contains a blank line.
  callProviderJsonMode: (
    sections: PromptSection[],
    jsonSchema: unknown,
    signal: AbortSignal,
  ) => Promise<string>;
  abortSignal: AbortSignal;
}

/**
 * Typed STRUCTURED_OUTPUT_FAILED carrier (Appendix L): the single canonical
 * structured-output failure, distinguishable by isStructuredOutputFailed().
 * `raw` holds both raw model outputs for diagnosis (never logged, R-10).
 */
export interface StructuredOutputFailedError extends Error {
  code: 'STRUCTURED_OUTPUT_FAILED';
  retryable: false;
  raw: { first: string; second: string };
}

/** Guard: distinguishes the canonical structured-output failure from other errors. */
export function isStructuredOutputFailed(err: unknown): err is StructuredOutputFailedError {
  return (
    err instanceof Error && (err as StructuredOutputFailedError).code === 'STRUCTURED_OUTPUT_FAILED'
  );
}

export async function requestJson<T>(
  schema: z.ZodSchema<T>,
  sections: PromptSection[],
  ctx: StructuredOutputContext,
): Promise<T> {
  const jsonSchema = zodToJsonSchema(schema);
  // T-03-04-04 (Appendix L): per-attempt AbortController with ctx.timeoutMs; the
  // outer abortSignal propagates into the attempt and is cleaned up in finally.
  // WR-03 (03-11): the timedOut flag is set by the setTimeout callback BEFORE
  // ac.abort() fires, so a timeout-origin rejection is distinguishable from a
  // user abort — the catch rethrows the typed TimeoutError carrier for
  // timeout-origin failures, never a bare AbortError (T-03-11-01).
  // WR-03A (03-16): the timeout-origin abort carries the typed carrier as the
  // abort reason (it rides ac.signal.reason), so the router closure can recover
  // it inside its retry decision point (WR-03A — the D-17 retry on TIMEOUT).
  const attempt = async (secs: PromptSection[]): Promise<string> => {
    const ac = new AbortController();
    const onAbort = () => ac.abort();
    ctx.abortSignal.addEventListener('abort', onAbort);
    let timedOut = false;
    const to = setTimeout(() => {
      timedOut = true;
      // WR-03A: abort WITH the typed carrier as the reason — the SDK drops it
      // and rejects bare AbortError, but the closure recovers the carrier from
      // ac.signal.reason inside its retry decision point.
      ac.abort(timeoutError(ctx.timeoutMs));
    }, ctx.timeoutMs);
    try {
      return await ctx.callProviderJsonMode(secs, jsonSchema, ac.signal);
    } catch (e) {
      if (timedOut) throw timeoutError(ctx.timeoutMs);
      throw e;
    } finally {
      clearTimeout(to);
      ctx.abortSignal.removeEventListener('abort', onAbort);
    }
  };
  const first = await attempt(sections);
  const parsedFirst = safeParse(schema, first);
  if (parsedFirst.ok) return parsedFirst.data;
  // F-4: keep the cached [SYSTEM] sections byte-stable across the repair
  // (prompt-cache stability); append the repair instruction as a single task
  // section instead of rebuilding a joined string. `repairText` is Appendix A
  // PROMPTS.repairJson.system + the VERBATIM Appendix L F-4 suffix — never a
  // paraphrase, never a dropped newline.
  const repairText = `${PROMPTS.repairJson.system}
Schema: ${JSON.stringify(jsonSchema)}
Broken: ${first}`;
  const cached = sections.filter((sec) => !TASK_KINDS.includes(sec.kind));
  const repairSection: PromptSection = {
    kind: 'user_input',
    text: repairText,
    tokens: Math.ceil(repairText.length / 4),
    stable: false,
    sourceId: 'structured-output-repair',
  };
  const second = await attempt([...cached, repairSection]);
  const parsedSecond = safeParse(schema, second);
  if (parsedSecond.ok) return parsedSecond.data;
  // T-03-04-01 / T-03-04-05: exactly one repair, then the canonical failure —
  // logged with code + module only (never the raw bodies, R-10).
  debugLog(ERROR_CODES.STRUCTURED_OUTPUT_FAILED, 'structured output failed after one repair', {
    module: 'StructuredOutput',
    extra: { operationId: ctx.operationId, providerId: ctx.providerId, model: ctx.model },
  });
  const err = new Error('STRUCTURED_OUTPUT_FAILED') as StructuredOutputFailedError;
  err.code = 'STRUCTURED_OUTPUT_FAILED';
  err.retryable = false;
  err.raw = { first, second };
  throw err;
}

// Appendix L safeParse: fence-strip (optional) then JSON.parse, then Zod
// safeParse — NEVER regex JSON surgery beyond the fence strip, never hand-parse.
function safeParse<T>(
  schema: z.ZodSchema<T>,
  raw: string,
): { ok: true; data: T } | { ok: false; error: unknown } {
  try {
    const cleaned = raw
      .trim()
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
