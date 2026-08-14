// src/core/memory/MemoryExtractor.ts — D-05-10: the haiku-tier LLM stage that
// turns conversation turns into durable §3.4 user memory facts. EVERY AI call
// routes through PersonaInjector.inject('memoryExtractor', …) (GR-3/D-11 — the
// Phase-3 seeded stage) and requestJson (GR-4/Appendix L — Zod + exactly ONE
// repair, then STRUCTURED_OUTPUT_FAILED; never hand-parsed JSON, never a repair
// loop, R-2). PROMPTS.memoryExtractor.system forbids secrets/raw customer data
// (R-10) and the failure log carries only operationId — never the raw model
// output. Non-blocking contract (§22.1): extractMemory NEVER throws — any
// provider/structure failure logs MEMORY_EXTRACT_FAILED and returns null so the
// caller's save path is never blocked.
//
// This schema + prompt + PersonaInjector stage are the Phase-5a NoteTagger/
// NoteQA memory-upsert seam (§3.4 note — the ONLY notes→memory direction,
// D-05). The result maps to UserMemoryFact rows the caller (5a) persists via
// MemoryEngine.addFacts (single-writer preserved).
import { z } from 'zod';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { estimateTokens } from '@/core/context/TokenBudget';
import { PersonaInjector } from '@/core/ai/persona/PersonaInjector';
import type { PersonaProfile } from '@/core/ai/persona/PersonaProfile';
import { PROMPTS } from '@/core/prompts';
import {
  isStructuredOutputFailed,
  requestJson,
  type StructuredOutputContext,
} from '@/core/ai/StructuredOutput';
import type { PromptSection, ProviderId } from '@/core/ai/types';
import type { UserMemoryFact, UserPreferences } from './types';

/** GR-4 (zod 3): the bounded extraction contract — max 10 memories per call (R-2). */
export const MemoryExtractorResultSchema = z.object({
  memories: z
    .array(
      z.object({
        content: z.string().min(1),
        type: z.enum(['fact', 'preference', 'pattern']),
        tags: z.array(z.string()).default([]),
        confidence: z.number().min(0).max(1).default(0.5),
        source: z.enum(['explicit', 'inferred', 'system']).default('inferred'),
      }),
    )
    .max(10),
});
export type MemoryExtractorResult = z.infer<typeof MemoryExtractorResultSchema>;

/** extractMemory() caller options — providerId/model/timeout have documented haiku-tier defaults. */
export interface ExtractMemoryOptions {
  operationId: string;
  persona?: PersonaProfile;
  prefs?: UserPreferences;
  nowMs?: number;
  /** Default: 'anthropic' — the canonical haiku pairing (PROMPTS.memoryExtractor.tier). */
  providerId?: ProviderId;
  /** Default: 'claude-haiku-4-latest' — the canonical haiku model (D-04-06 map key). */
  model?: string;
  /** Default: 30s — the per-attempt cap (Appendix L). */
  timeoutMs?: number;
  abortSignal?: AbortSignal;
}

/**
 * D-05-10: extract durable memory facts from conversation turns. Returns
 * UserMemoryFact[] on success (mapped with created/updated = nowMs, usage
 * metadata zeroed), or null on ANY failure — never throws, never blocks the
 * caller's save path (§22.1). The provider is injected as
 * callProviderJsonMode (StructuredOutputContext seam) so tests stub the LLM
 * and the production Router supplies it.
 */
export async function extractMemory(
  turns: readonly { role: 'user' | 'assistant' | 'tool'; content: string }[],
  opts: ExtractMemoryOptions,
  callProviderJsonMode: StructuredOutputContext['callProviderJsonMode'],
): Promise<UserMemoryFact[] | null> {
  const nowMs = opts.nowMs ?? Date.now();

  // GR-3/D-11: EVERY AI call routes through PersonaInjector — the persona block
  // is prepended here, never inlined by the caller (prompt-cache byte-stability).
  const system = PersonaInjector.inject('memoryExtractor', PROMPTS.memoryExtractor.system, {
    persona: opts.persona,
    prefs: opts.prefs,
  });

  // F-4 sections-in: system stays cache-stable; the turns ride a per-call
  // user_input section (stable: false) — the repair never rebuilds the prefix.
  const turnsText = JSON.stringify(turns.map((t) => ({ role: t.role, content: t.content })));
  const sections: PromptSection[] = [
    {
      kind: 'system',
      text: system,
      tokens: estimateTokens(system),
      stable: true,
      sourceId: 'memory-extractor',
    },
    {
      kind: 'user_input',
      text: turnsText,
      tokens: estimateTokens(turnsText),
      stable: false,
      sourceId: 'memory-extractor-input',
    },
  ];

  try {
    const result = await requestJson(MemoryExtractorResultSchema, sections, {
      operationId: opts.operationId,
      providerId: opts.providerId ?? 'anthropic',
      model: opts.model ?? 'claude-haiku-4-latest',
      timeoutMs: opts.timeoutMs ?? 30_000,
      callProviderJsonMode,
      abortSignal: opts.abortSignal ?? new AbortController().signal,
    });
    return result.memories.map((m) => ({
      id: crypto.randomUUID(),
      content: m.content,
      type: m.type,
      // zod .default() values are applied at parse time; the ?? fallbacks keep
      // the boundary cast honest for the 3.25 inferred `| undefined` types.
      tags: m.tags ?? [],
      confidence: m.confidence ?? 0.5,
      source: m.source ?? 'inferred',
      createdAt: nowMs,
      updatedAt: nowMs,
      lastUsedAt: undefined,
      useCount: 0,
    }));
  } catch (err) {
    // T-05-17/T-05-18: log code + operationId ONLY — never the raw model output
    // (R-10); both structured-output failures and provider errors degrade to
    // null, never a crash (T-05-18 — bounded, one repair, no loop).
    debugLog(
      ERROR_CODES.MEMORY_EXTRACT_FAILED,
      isStructuredOutputFailed(err)
        ? 'memory extraction failed after one repair'
        : 'memory extraction failed',
      { module: 'MemoryExtractor', extra: { operationId: opts.operationId } },
    );
    return null;
  }
}
