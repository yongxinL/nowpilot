// tests/core/memory/MemoryExtractor.test.ts — D-05-10 KNW-05 (required by
// §18): the haiku-tier LLM stage routing EVERY call through
// PersonaInjector('memoryExtractor') + requestJson (GR-3/GR-4 — Zod, exactly
// ONE repair, then STRUCTURED_OUTPUT_FAILED; never throws; R-10 log hygiene).
// The LLM is stubbed via the injected callProviderJsonMode seam — the Router
// supplies it in production (PlannerService.test.ts stub precedent). Cases:
//   1. Valid extraction: a schema-valid JSON payload → UserMemoryFact[] with
//      the mapped fields (created/updated = injected nowMs, useCount 0) and
//      the zod defaults applied (tags [] / confidence 0.5 / source 'inferred').
//   2. GR-4 one repair: INVALID JSON on attempt 1 + VALID on attempt 2 → the
//      call succeeds and the stub saw exactly 2 attempts (the repair section
//      is appended per the StructuredOutput repair contract).
//   3. STRUCTURED_OUTPUT_FAILED: invalid JSON twice → null (never throws) and
//      debugLog fired with MEMORY_EXTRACT_FAILED.
//   4. Provider failure: the stub rejects with a generic Error → null +
//      MEMORY_EXTRACT_FAILED, no crash.
//   5. PersonaInjector route pin (GR-3/D-11): inject called with stage
//      'memoryExtractor' + PROMPTS.memoryExtractor.system + the persona/prefs
//      opts threaded; the system section rides stable:true + the turns ride a
//      stable:false user_input section.
//   6. Schema boundary (R-2): 12 memories (over .max(10)) → the payload is
//      rejected (repair/STRUCTURED_OUTPUT_FAILED path) → null.
// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  extractMemory,
  MemoryExtractorResultSchema,
} from '@/core/memory/MemoryExtractor';
import { PersonaInjector } from '@/core/ai/persona/PersonaInjector';
import { PROMPTS } from '@/core/prompts';
import { DEFAULT_PERSONA } from '@/core/ai/persona/PersonaProfile';
import type { StructuredOutputContext } from '@/core/ai/StructuredOutput';
import type { PromptSection } from '@/core/ai/types';
import type { UserPreferences } from '@/core/memory/types';

const NOW_MS = 1_752_000_000_000; // fixed literal — deterministic

const TURNS = [
  { role: 'user' as const, content: 'I prefer concise answers' },
  { role: 'assistant' as const, content: 'Got it — concise it is.' },
];

const PREFS: UserPreferences = {
  responseStyle: 'concise',
  preferredLanguage: 'en',
  preferStructuredOutput: true,
  allowCloudFallbackFromLocal: false,
  toolAutonomy: 'ask_every_time',
  defaultSurface: 'sidepanel',
};

/** Closure-based stub (PlannerService.test.ts precedent) — records every call. */
function makeStub(...responses: Array<string | Error>): {
  stub: StructuredOutputContext['callProviderJsonMode'];
  calls: unknown[][];
} {
  const queue = [...responses];
  const calls: unknown[][] = [];
  const stub = async (
    sections: PromptSection[],
    jsonSchema: unknown,
    signal: AbortSignal,
  ): Promise<string> => {
    calls.push([sections, jsonSchema, signal]);
    const next = queue.shift();
    if (next instanceof Error) throw next;
    return next ?? '';
  };
  return { stub, calls };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('MemoryExtractor — valid extraction with zod defaults', () => {
  it('maps a schema-valid payload to UserMemoryFact[] (nowMs clock, defaults applied)', async () => {
    const { stub, calls } = makeStub(
      JSON.stringify({
        memories: [
          { content: 'prefers concise answers', type: 'preference' }, // tags/confidence/source default
          {
            content: 'works on servicenow',
            type: 'fact',
            tags: ['work'],
            confidence: 0.9,
            source: 'explicit',
          },
        ],
      }),
    );

    const facts = await extractMemory(TURNS, { operationId: 'op-1', nowMs: NOW_MS }, stub);

    expect(facts).toHaveLength(2);
    expect(facts![0]).toMatchObject({
      content: 'prefers concise answers',
      type: 'preference',
      tags: [],
      confidence: 0.5,
      source: 'inferred',
      createdAt: NOW_MS,
      updatedAt: NOW_MS,
      useCount: 0,
      lastUsedAt: undefined,
    });
    expect(facts![1]).toMatchObject({
      content: 'works on servicenow',
      type: 'fact',
      tags: ['work'],
      confidence: 0.9,
      source: 'explicit',
      createdAt: NOW_MS,
      updatedAt: NOW_MS,
      useCount: 0,
    });
    expect(typeof facts![0].id).toBe('string');
    expect(facts![0].id).toHaveLength(36); // crypto.randomUUID shape
    expect(calls).toHaveLength(1); // valid first attempt — no repair
  });
});

describe('MemoryExtractor — GR-4 exactly one repair', () => {
  it('recovers from invalid JSON on attempt 1 with a valid repair attempt 2', async () => {
    const { stub, calls } = makeStub(
      'this is not json {',
      JSON.stringify({ memories: [{ content: 'likes morning standups', type: 'pattern' }] }),
    );

    const facts = await extractMemory(TURNS, { operationId: 'op-2', nowMs: NOW_MS }, stub);

    expect(facts).toHaveLength(1);
    expect(facts![0].content).toBe('likes morning standups');
    expect(calls).toHaveLength(2); // first + ONE repair — never a third
  });
});

describe('MemoryExtractor — STRUCTURED_OUTPUT_FAILED never throws (R-10 log)', () => {
  it('returns null + MEMORY_EXTRACT_FAILED after two invalid payloads', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { stub, calls } = makeStub('nope {', 'also nope [');

    const facts = await extractMemory(TURNS, { operationId: 'op-3', nowMs: NOW_MS }, stub);

    expect(facts).toBeNull();
    expect(calls).toHaveLength(2); // first + one repair, then the canonical failure
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('MEMORY_EXTRACT_FAILED'),
      expect.anything(),
      expect.anything(),
    );
  });

  it('returns null + MEMORY_EXTRACT_FAILED when the provider rejects (no crash)', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { stub } = makeStub(new Error('network down'));

    await expect(
      extractMemory(TURNS, { operationId: 'op-4', nowMs: NOW_MS }, stub),
    ).resolves.toBeNull();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('MEMORY_EXTRACT_FAILED'),
      expect.anything(),
      expect.anything(),
    );
  });
});

describe('MemoryExtractor — PersonaInjector route pin (GR-3/D-11)', () => {
  it('injects stage memoryExtractor with the canonical system prompt + persona/prefs', async () => {
    const injectSpy = vi.spyOn(PersonaInjector, 'inject');
    const { stub, calls } = makeStub(JSON.stringify({ memories: [] }));

    const facts = await extractMemory(
      TURNS,
      { operationId: 'op-5', persona: DEFAULT_PERSONA, prefs: PREFS, nowMs: NOW_MS },
      stub,
    );

    expect(facts).toEqual([]);
    expect(injectSpy).toHaveBeenCalledWith('memoryExtractor', PROMPTS.memoryExtractor.system, {
      persona: DEFAULT_PERSONA,
      prefs: PREFS,
    });
    // F-4 sections: cache-stable system prefix + per-call user_input turns.
    const firstSections = calls[0][0] as PromptSection[];
    expect(firstSections).toHaveLength(2);
    expect(firstSections[0]).toMatchObject({
      kind: 'system',
      stable: true,
      sourceId: 'memory-extractor',
    });
    expect(firstSections[0].text).toContain('NowPilot'); // persona block prepended
    expect(firstSections[1]).toMatchObject({
      kind: 'user_input',
      stable: false,
      sourceId: 'memory-extractor-input',
    });
    expect(firstSections[1].text).toContain('I prefer concise answers');
  });
});

describe('MemoryExtractor — schema boundary caps the call (R-2)', () => {
  it('rejects 12 memories (over .max(10)) → repair path → null', async () => {
    const logSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const payload = JSON.stringify({
      memories: Array.from({ length: 12 }, (_, i) => ({ content: `fact ${i}`, type: 'fact' })),
      extraField: 'ignored',
    });
    const { stub, calls } = makeStub(payload, payload);

    const facts = await extractMemory(TURNS, { operationId: 'op-6', nowMs: NOW_MS }, stub);

    expect(facts).toBeNull();
    expect(calls).toHaveLength(2); // both attempts reject — one repair, then null
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('MEMORY_EXTRACT_FAILED'),
      expect.anything(),
      expect.anything(),
    );
    // the schema contract itself caps at 10
    expect(MemoryExtractorResultSchema.shape.memories._def.maxLength?.value).toBe(10);
  });
});
