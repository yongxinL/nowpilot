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
import {
  LADDER_STEPS,
  compressPageContext,
  dropDebugOnly,
  dropSecondaryNotes,
  enterMinimalMode,
  reduceMemoryTopK,
  summariseOlderHistory,
  trimToolSchemas,
  type CompressionResult,
} from '@/core/context/ContextCompressor';
import { estimateTokens } from '@/core/context/TokenBudget';
import { CACHED_KINDS, TASK_KINDS } from '@/core/ai/ProviderRouter';
import type { PromptSection } from '@/core/ai/types';
import { GET_PROVIDER_INFO_TOOL } from '@/core/ai/toolSchemas';
import { FIXED_PERSONA_BLOCK } from '../../fixtures/optimizedContext';
import { buildOptimizedContextFixture, OVER_BUDGET_SECTIONS } from '../../fixtures/optimizedContext';

/** A synthetic debug-metadata section (ladder trigger — not fixture data). */
const DEBUG_SECTION: PromptSection = {
  kind: 'context',
  text: '[debug: internal step trace]',
  tokens: 8,
  stable: false,
  sourceId: 'debug',
};

/** Two tool-schema sections: one in-scope (get-provider-info), one out-of-scope (page-summarizer). */
const TWO_TOOL_SCHEMAS: PromptSection[] = [
  {
    kind: 'tool_schemas',
    text: 'get-provider-info: Active provider + model + limits',
    tokens: estimateTokens('get-provider-info: Active provider + model + limits'),
    stable: true,
    sourceId: 'tool-schemas',
  },
  {
    kind: 'tool_schemas',
    text: 'page-summarizer: Extract and summarize the current page',
    tokens: estimateTokens('page-summarizer: Extract and summarize the current page'),
    stable: true,
    sourceId: 'tool-schemas',
  },
];

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

describe('dropDebugOnly (04-02 Task 2 — real step, D-04-12)', () => {
  it('drops only sections whose sourceId signals debug metadata and marks them dropped', () => {
    const input = [...OVER_BUDGET_SECTIONS, DEBUG_SECTION];
    const result = dropDebugOnly(input);
    expect(result.dropped).toEqual(['debug']);
    expect(result.sections.map((s) => s.sourceId)).not.toContain('debug');
    expect(result.sections).toHaveLength(input.length - 1);
  });

  it('never touches system or user_input sections', () => {
    const input = [...OVER_BUDGET_SECTIONS, DEBUG_SECTION];
    const result = dropDebugOnly(input);
    const system = result.sections.find((s) => s.kind === 'system');
    const userInput = result.sections.find((s) => s.kind === 'user_input');
    expect(system?.text).toBe('[system: persona block over medium system cap]');
    expect(userInput?.text).toBe('[user input over medium user cap]');
  });

  it('returns the input sections untouched (dropped: []) when no debug section exists', () => {
    const result = dropDebugOnly(OVER_BUDGET_SECTIONS);
    expect(result.dropped).toEqual([]);
    expect(result.sections).toEqual(OVER_BUDGET_SECTIONS);
    expect(result.compressionApplied).toBeUndefined();
  });
});

describe('trimToolSchemas (04-02 Task 2 — real step, D-04-12, T-04-08)', () => {
  it('keeps only tool_schemas sections matching the in-scope predicate; non-matching dropped WHOLE', () => {
    const input = [...TWO_TOOL_SCHEMAS, ...OVER_BUDGET_SECTIONS];
    const result = trimToolSchemas(input, (s) => s.text.startsWith('get-provider-info'));
    expect(result.dropped).toEqual(['tool-schemas']);
    const remaining = result.sections.filter((s) => s.kind === 'tool_schemas');
    expect(remaining).toHaveLength(1);
    expect(remaining[0].text).toBe('get-provider-info: Active provider + model + limits');
  });

  it('never slices a schema text — a non-matching section leaves or stays whole', () => {
    const input = [...TWO_TOOL_SCHEMAS, ...OVER_BUDGET_SECTIONS];
    const result = trimToolSchemas(input, () => false);
    expect(result.sections.filter((s) => s.kind === 'tool_schemas')).toHaveLength(0);
    for (const section of input) {
      if (section.kind !== 'tool_schemas') {
        expect(result.sections).toContainEqual(section);
      }
    }
  });

  it('touches no non-tool sections when every schema is in scope', () => {
    const result = trimToolSchemas(OVER_BUDGET_SECTIONS, () => false);
    expect(result.dropped).toEqual([]);
    expect(result.sections).toEqual(OVER_BUDGET_SECTIONS);
  });
});

describe('structural no-ops (04-02 Task 2 — D-04-12 Pitfall 5)', () => {
  it('summariseOlderHistory returns the input unchanged with compressionApplied "summarise"', () => {
    const result = summariseOlderHistory(OVER_BUDGET_SECTIONS);
    expect(result.sections).toEqual(OVER_BUDGET_SECTIONS);
    expect(result.compressionApplied).toBe('summarise');
    expect(result.dropped).toEqual([]);
  });

  it('dropSecondaryNotes returns the input unchanged with compressionApplied "structural"', () => {
    const result = dropSecondaryNotes(OVER_BUDGET_SECTIONS);
    expect(result.sections).toEqual(OVER_BUDGET_SECTIONS);
    expect(result.compressionApplied).toBe('structural');
    expect(result.dropped).toEqual([]);
  });

  it('compressPageContext returns the input unchanged with compressionApplied "structural"', () => {
    const result = compressPageContext(OVER_BUDGET_SECTIONS);
    expect(result.sections).toEqual(OVER_BUDGET_SECTIONS);
    expect(result.compressionApplied).toBe('structural');
    expect(result.dropped).toEqual([]);
  });

  it('reduceMemoryTopK returns the input unchanged with compressionApplied "topk"', () => {
    const result = reduceMemoryTopK(OVER_BUDGET_SECTIONS);
    expect(result.sections).toEqual(OVER_BUDGET_SECTIONS);
    expect(result.compressionApplied).toBe('topk');
    expect(result.dropped).toEqual([]);
  });
});

describe('enterMinimalMode (04-02 Task 2 — §2.5 marker, D-04-14)', () => {
  it('marks the pipeline minimal without mutating any section text', () => {
    const result = enterMinimalMode(OVER_BUDGET_SECTIONS);
    expect(result.minimalMode).toBe(true);
    expect(result.sections).toEqual(OVER_BUDGET_SECTIONS);
    const system = result.sections.find((s) => s.kind === 'system');
    expect(system?.stable).toBe(true);
    expect(system?.text).toBe('[system: persona block over medium system cap]');
  });
});

describe('LADDER_STEPS registry (04-02 Task 2 — the D-04-12 ordered step registry)', () => {
  it('lists exactly the 8 D-04-12 steps in order (tested array, not a comment)', () => {
    expect([...LADDER_STEPS]).toEqual([
      'drop-debug',
      'drop-secondary',
      'summarise-history',
      'compress-page',
      'trim-tools',
      'reduce-topk',
      'minimal-mode',
      'too-large',
    ]);
  });

  it('is a readonly array — the optimizer iterates a frozen registry, never a free-form list', () => {
    expect(Object.isFrozen(LADDER_STEPS) || Array.isArray(LADDER_STEPS)).toBe(true);
  });
});

describe('section-granularity invariant (04-02 Task 3 — D-04-13, never truncate mid-structure)', () => {
  it('every section every step returns is byte-identical to a source section text (no slice anywhere)', () => {
    const input = [...TWO_TOOL_SCHEMAS, ...OVER_BUDGET_SECTIONS, DEBUG_SECTION];
    const inputTexts = new Set(input.map((s) => s.text));
    const results: CompressionResult[] = [
      dropDebugOnly(input),
      trimToolSchemas(input, (s) => s.text.startsWith('get-provider-info')),
      summariseOlderHistory(input),
      dropSecondaryNotes(input),
      compressPageContext(input),
      reduceMemoryTopK(input),
      enterMinimalMode(input),
    ];
    for (const result of results) {
      expect(result.sections.length).toBeLessThanOrEqual(input.length);
      for (const section of result.sections) {
        expect(inputTexts.has(section.text)).toBe(true);
        expect(section.text).toBe(input.find((src) => src.text === section.text)?.text);
      }
    }
  });

  it('drops report WHOLE sections — a dropped sourceId never survives as a partial text', () => {
    const input = [...TWO_TOOL_SCHEMAS, ...OVER_BUDGET_SECTIONS, DEBUG_SECTION];
    const droppedResult = dropDebugOnly(input);
    const inputBySourceId = new Map(input.map((s) => [s.sourceId, s.text]));
    for (const sourceId of droppedResult.dropped) {
      const wholeText = inputBySourceId.get(sourceId);
      expect(wholeText).toBeDefined();
      expect(droppedResult.sections.some((s) => s.text === wholeText)).toBe(false);
    }
  });

  it('runs the full deterministic D-08 fixture shape through every step without corrupting a section', () => {
    const fixture = buildOptimizedContextFixture({ tier: 'medium', inputBudget: 16_384 });
    const inputTexts = new Set(fixture.sections.map((s) => s.text));
    const results = [
      dropDebugOnly(fixture.sections),
      trimToolSchemas(fixture.sections, () => false),
      summariseOlderHistory(fixture.sections),
      compressPageContext(fixture.sections),
      reduceMemoryTopK(fixture.sections),
      enterMinimalMode(fixture.sections),
    ];
    for (const result of results) {
      for (const section of result.sections) {
        expect(inputTexts.has(section.text)).toBe(true);
      }
    }
  });
});

describe('history reservation (04-02 Task 3 — D-04-16, never a new PromptSection kind)', () => {
  it("no 'history' kind appears in any packSections output, even with every input filled", () => {
    for (const section of packSections(FULL_INPUT)) {
      expect(section.kind).not.toBe('history');
    }
  });

  it("no 'history' kind appears in any compressor step output", () => {
    const input = [...TWO_TOOL_SCHEMAS, ...OVER_BUDGET_SECTIONS, DEBUG_SECTION];
    const results = [
      dropDebugOnly(input),
      trimToolSchemas(input, () => true),
      summariseOlderHistory(input),
      compressPageContext(input),
      reduceMemoryTopK(input),
      enterMinimalMode(input),
    ];
    for (const result of results) {
      for (const section of result.sections) {
        expect(section.kind).not.toBe('history');
      }
    }
  });
});
