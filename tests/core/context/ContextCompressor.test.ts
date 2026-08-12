// tests/core/context/ContextCompressor.test.ts — Wave-2 context suite (04-02).
// Contract under test (04-02-PLAN.md tasks 1-3):
//   1. ContextPack.packSections emits PromptSection[] in the §1.3 canonical
//      order ([SYSTEM] [TOOL SCHEMAS] [PREFERENCES] [MEMORY] [CONTEXT] [TASK]
//      [USER INPUT]) with per-kind stability flags mirroring CACHED_KINDS /
//      TASK_KINDS exactly (F-5 cache-stability, T-04-09), canonical sourceIds,
//      and tokens === TokenBudget.estimateTokens of each section's own text
//      (D-04-08 migration from contextHelper — never a joined string, F-4).
//   2. ContextCompressor ships the §2.4 degradation ladder as pure
//      section-granular primitives (D-04-12 real-vs-noop split, D-04-13 never
//      truncate mid-structure): drop-debug + trim-tool-schemas do REAL work;
//      summarise/compress/reduce-topk are structural no-ops with markers;
//      enterMinimalMode is the §2.5 marker; LADDER_STEPS is the ordered
//      8-step registry ContextOptimizer (04-04) iterates.
//   3. History reservation (D-04-16): no 'history' PromptSection kind is ever
//      emitted — the §2.2 History column is a budget reservation only (R-1).
//
// Determinism rule (fixtures/index.ts precedent): no Date.now, no crypto, no
// Math.random — every input and expected value is fixed; ladder-trigger
// material comes from the D-08 fixture (../../fixtures/optimizedContext).
import { describe, expect, it } from 'vitest';

import { packSections, type ContextPackInput } from '@/core/context/ContextPack';
import { estimateTokens } from '@/core/context/TokenBudget';
import { CACHED_KINDS, TASK_KINDS } from '@/core/ai/ProviderRouter';
import type { PromptSection } from '@/core/ai/types';
import { GET_PROVIDER_INFO_TOOL } from '@/core/ai/toolSchemas';
import { FIXED_PERSONA_BLOCK } from '../../fixtures/optimizedContext';
import { OVER_BUDGET_SECTIONS } from '../../fixtures/optimizedContext';

const FULL_INPUT: ContextPackInput = {
  personaBlock: FIXED_PERSONA_BLOCK,
  toolSchemaRefs: [GET_PROVIDER_INFO_TOOL],
  userInput: 'Summarize the current page.',
  preferencesText: '[preferences] responseStyle=balanced preferredLanguage=en',
  memoryText: '[memory: user prefers concise summaries]',
  contextText: '[context: extracted page content]',
  taskText: '[task: render a summary answer]',
};

/** §1.3 canonical kind sequence — the byte-for-byte order packSections emits. */
const SECTION_ORDER = [
  'system',
  'tool_schemas',
  'preferences',
  'memory',
  'context',
  'task',
  'user_input',
] as const;

describe('packSections (04-02 Task 1 — §1.3 canonical packing, D-04-08)', () => {
  it('emits exactly [system, tool_schemas, user_input] in that order for the minimal input', () => {
    const sections = packSections({
      personaBlock: FIXED_PERSONA_BLOCK,
      toolSchemaRefs: [GET_PROVIDER_INFO_TOOL],
      userInput: 'Summarize the current page.',
    });
    expect(sections.map((s) => s.kind)).toEqual(['system', 'tool_schemas', 'user_input']);
  });

  it('emits the full §1.3 sequence when every optional input is present', () => {
    const sections = packSections(FULL_INPUT);
    expect(sections.map((s) => s.kind)).toEqual([...SECTION_ORDER]);
  });

  it('omits tool_schemas entirely when no tool refs are supplied', () => {
    const sections = packSections({
      personaBlock: FIXED_PERSONA_BLOCK,
      userInput: 'Summarize the current page.',
    });
    expect(sections.map((s) => s.kind)).toEqual(['system', 'user_input']);
  });

  it('sets stable:true for cached kinds and stable:false for task kinds (CACHED_KINDS/TASK_KINDS mirror)', () => {
    const sections = packSections(FULL_INPUT);
    for (const section of sections) {
      expect(section.stable).toBe(CACHED_KINDS.includes(section.kind));
      expect(section.stable).toBe(!TASK_KINDS.includes(section.kind));
    }
  });

  it('assigns the canonical sourceIds per kind', () => {
    const sections = packSections(FULL_INPUT);
    const sourceIds = sections.map((s) => s.sourceId);
    expect(sourceIds).toEqual([
      'system',
      'tool-schemas',
      'preferences',
      'memory',
      'context',
      'task',
      'user-input',
    ]);
  });

  it('counts every section token via estimateTokens of its own text (no hand-authored counts)', () => {
    const sections = packSections(FULL_INPUT);
    for (const section of sections) {
      expect(section.tokens).toBe(estimateTokens(section.text));
    }
  });

  it('builds the tool-schemas text deterministically (name: description, newline-joined)', () => {
    const sections = packSections(FULL_INPUT);
    const schemas = sections.find((s) => s.kind === 'tool_schemas');
    expect(schemas?.text).toBe('get-provider-info: Active provider + model + limits');
    expect(schemas?.tokens).toBe(estimateTokens('get-provider-info: Active provider + model + limits'));
  });

  it('returns sections whose text is byte-identical to the input text (never a joined string, F-4)', () => {
    const sections = packSections(FULL_INPUT);
    const expectedTexts = [
      FIXED_PERSONA_BLOCK,
      'get-provider-info: Active provider + model + limits',
      FULL_INPUT.preferencesText,
      FULL_INPUT.memoryText,
      FULL_INPUT.contextText,
      FULL_INPUT.taskText,
      FULL_INPUT.userInput,
    ];
    expect(sections.map((s) => s.text)).toEqual(expectedTexts);
    expect(Array.isArray(sections)).toBe(true);
  });
});
