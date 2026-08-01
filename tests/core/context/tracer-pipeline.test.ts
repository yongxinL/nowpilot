import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  ContextItemSchema,
  SensitivitySchema,
  unwrapToPromptSections,
} from '../../../src/core/context/ContextItem';
import type { ContextItem } from '../../../src/core/context/ContextItem';
import { ContextTrustPolicy, contextTrustPolicy } from '../../../src/core/context/ContextTrustPolicy';
import { contextOptimizer } from '../../../src/core/context/ContextOptimizer';
import { tokenBudget } from '../../../src/core/context/TokenBudget';
import type { ContextOptimizerInput, PromptSection } from '../../../src/core/ai/types';

vi.mock('ai', () => {
  return {
    generateText: vi.fn(),
    streamText: vi.fn(),
    Output: {
      object: vi.fn(),
    },
    isStepCount: vi.fn(() => vi.fn()),
  };
});

vi.mock('../../../src/core/ai/ProviderRouter', () => {
  return {
    providerRouter: {
      selectProvider: vi.fn().mockResolvedValue({
        adapter: {
          providerId: 'openai' as const,
          createLanguageModel: vi.fn(),
          validateConnection: vi.fn().mockResolvedValue({ ok: true, models: ['gpt-4o-mini'] }),
          supportsStructuredOutput: true,
          getDefaultModelForTier: vi.fn().mockReturnValue('gpt-4o-mini'),
          getCacheStrategy: vi.fn().mockReturnValue('prefix-only' as const),
          getTelemetryMetadata: vi.fn().mockReturnValue({ provider: 'openai' }),
        },
        providerId: 'openai',
      }),
      // No AI summarization in unit tests: getCompressionModel returns null,
      // so overflow falls through to CONTEXT_TOO_LARGE (D-06, D-08).
      getCompressionModel: vi.fn().mockResolvedValue(null),
    },
  };
});

function buildOptimizerInput(overrides?: Partial<ContextOptimizerInput>): ContextOptimizerInput {
  return {
    operationId: 'op-tracer-1',
    model: 'gpt-4o-mini',
    modelContextWindow: 128000,
    userInput: 'Hello world',
    conversationId: 'conv-tracer-1',
    workspaceId: 'ws-tracer-1',
    activeSurface: 'sidepanel',
    selectedToolSchemas: [],
    memoryHints: [],
    preferences: {},
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 1 — ContextItem + ContextReceiptEntry contract (D-01, D-03, D-09)
// ─────────────────────────────────────────────────────────────────────────────

const VALID_ITEM: ContextItem = {
  kind: 'context',
  text: 'NowPilot is a privacy-first Chrome extension AI assistant.',
  tokens: 13,
  stable: false,
  sourceId: 'context.page.current-url',
  relevance: 0.8,
  freshness: 0.9,
  trust: 0.5,
  sensitivity: 'private',
  instructionAuthority: 'data',
};

describe('ContextItem contract (Task 1)', () => {
  it('ContextItemSchema accepts a well-formed item with all PromptSection + metadata fields', () => {
    const result = ContextItemSchema.safeParse(VALID_ITEM);
    expect(result.success).toBe(true);
    if (!result.success) return;
    // PromptSection fields
    expect(result.data.kind).toBe('context');
    expect(result.data.text).toBe(VALID_ITEM.text);
    expect(result.data.tokens).toBe(13);
    expect(result.data.stable).toBe(false);
    expect(result.data.sourceId).toBe('context.page.current-url');
    // Metadata fields
    expect(result.data.relevance).toBe(0.8);
    expect(result.data.freshness).toBe(0.9);
    expect(result.data.trust).toBe(0.5);
    expect(result.data.sensitivity).toBe('private');
    expect(result.data.instructionAuthority).toBe('data');
  });

  it('ContextItemSchema rejects trust out of the [0, 1] range', () => {
    const result = ContextItemSchema.safeParse({ ...VALID_ITEM, trust: 1.5 });
    expect(result.success).toBe(false);
  });

  it('ContextItemSchema rejects sensitivity:secret items (D-09 gate)', () => {
    const result = ContextItemSchema.safeParse({ ...VALID_ITEM, sensitivity: 'secret' });
    expect(result.success).toBe(false);
    if (result.success) return;
    const messages = result.error.issues.map((i) => i.message);
    expect(messages.some((m) => m.toLowerCase().includes('secret'))).toBe(true);
  });

  it('unwrapToPromptSections() strips metadata — only PromptSection fields survive', () => {
    const second: ContextItem = {
      ...VALID_ITEM,
      kind: 'memory',
      text: 'User prefers concise answers',
      tokens: 6,
      sourceId: 'memory.user.facts',
      trust: 0.8,
      instructionAuthority: 'data',
    };
    const sections = unwrapToPromptSections([VALID_ITEM, second]);

    expect(sections).toHaveLength(2);
    const keys = Object.keys(sections[0]).sort();
    expect(keys).toEqual(['kind', 'sourceId', 'stable', 'text', 'tokens']);
    expect(sections[0]).toEqual({
      kind: 'context',
      text: VALID_ITEM.text,
      tokens: 13,
      stable: false,
      sourceId: 'context.page.current-url',
    });
    expect(sections[1].kind).toBe('memory');
    expect(sections[1].sourceId).toBe('memory.user.facts');
    // The returned type is the plain PromptSection contract (D-01)
    expectTypeOf(sections).toMatchTypeOf<PromptSection[]>();
  });

  it('ContextItem type is assignable with all fields (compile-time check)', () => {
    const typed: ContextItem = VALID_ITEM;
    expect(typed.sensitivity).toBe('private');
    expect(typed.instructionAuthority).toBe('data');
    // Schema-inferred enums agree with the canonical unions
    expectTypeOf(SensitivitySchema.options).toMatchTypeOf<
      Array<'public' | 'private' | 'confidential' | 'secret'>
    >();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 2 — ContextTrustPolicy singleton (D-06, D-07, D-09)
// ─────────────────────────────────────────────────────────────────────────────

describe('ContextTrustPolicy (Task 2)', () => {
  it('assesses system instructions with trust 1.0 / public / system authority', () => {
    expect(contextTrustPolicy.assess('core.instructions.system', 'system')).toEqual({
      trust: 1.0,
      sensitivity: 'public',
      instructionAuthority: 'system',
    });
  });

  it('assesses page context with trust 0.5 / private / data authority', () => {
    expect(contextTrustPolicy.assess('context.page.current-url', 'context')).toEqual({
      trust: 0.5,
      sensitivity: 'private',
      instructionAuthority: 'data',
    });
  });

  it('assesses user input with trust 0.9 / private / user authority', () => {
    expect(contextTrustPolicy.assess('interaction.user.current-turn', 'user_input')).toEqual({
      trust: 0.9,
      sensitivity: 'private',
      instructionAuthority: 'user',
    });
  });

  it('validate() rejects items whose trust metadata is self-assigned (D-06)', () => {
    const policy = contextTrustPolicy.assess('core.instructions.system', 'system');
    expect(policy.trust).toBe(1.0);
    const selfAssigned: ContextItem = {
      kind: 'system',
      text: 'You are a helpful assistant.',
      tokens: 6,
      stable: true,
      sourceId: 'core.instructions.system',
      relevance: 1,
      freshness: 1,
      trust: 0.5, // adapter self-assigned — must be rejected
      sensitivity: 'public',
      instructionAuthority: 'system',
    };
    expect(contextTrustPolicy.validate(selfAssigned, policy)).toBe(false);
  });

  it('validate() accepts items that match the policy exactly', () => {
    const policy = contextTrustPolicy.assess('context.page.current-url', 'context');
    const matching: ContextItem = {
      kind: 'context',
      text: 'Page content.',
      tokens: 3,
      stable: false,
      sourceId: 'context.page.current-url',
      relevance: 0.7,
      freshness: 0.8,
      trust: 0.5,
      sensitivity: 'private',
      instructionAuthority: 'data',
    };
    expect(contextTrustPolicy.validate(matching, policy)).toBe(true);
  });

  it('upgrade() returns the most restrictive sensitivity (D-09)', () => {
    expect(ContextTrustPolicy.upgrade('public', 'secret')).toBe('secret');
    expect(ContextTrustPolicy.upgrade('private', 'public')).toBe('private');
    expect(ContextTrustPolicy.upgrade('confidential', 'secret')).toBe('secret');
    expect(ContextTrustPolicy.upgrade('secret', 'private')).toBe('secret');
  });

  it('assess() is deterministic — identical (sourceId, kind) inputs give identical results', () => {
    const a = contextTrustPolicy.assess('context.page.current-url', 'context');
    const b = contextTrustPolicy.assess('context.page.current-url', 'context');
    expect(a).toEqual(b);
  });

  it('covers memory and unknown sources per the D-07 table', () => {
    expect(contextTrustPolicy.assess('memory.user.facts', 'memory')).toEqual({
      trust: 0.8,
      sensitivity: 'private',
      instructionAuthority: 'data',
    });
    expect(contextTrustPolicy.assess('tools.search.notes', 'context')).toEqual({
      trust: 0.9,
      sensitivity: 'private',
      instructionAuthority: 'data',
    });
    expect(contextTrustPolicy.assess('unknown.source.xyz', 'context')).toEqual({
      trust: 0.3,
      sensitivity: 'private',
      instructionAuthority: 'data',
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Task 3 — optimizeFromItems(): trust gating, delimiter wrapping, receipts,
// tracer end-to-end test (D-01, D-02, D-03, D-06)
// ─────────────────────────────────────────────────────────────────────────────

const SYSTEM_TEXT = 'You are a helpful AI assistant. You have access to tools and context to help the user.';
const PAGE_TEXT = '这是页面内容。NowPilot 是一个本地优先的 AI 助手。';

const SYSTEM_ITEM: ContextItem = {
  kind: 'system',
  text: SYSTEM_TEXT,
  tokens: tokenBudget.estimateTokens(SYSTEM_TEXT),
  stable: true,
  sourceId: 'core.instructions.system',
  relevance: 1,
  freshness: 1,
  trust: 1.0,
  sensitivity: 'public',
  instructionAuthority: 'system',
};

const DATA_ITEM: ContextItem = {
  kind: 'context',
  text: PAGE_TEXT,
  tokens: tokenBudget.estimateTokens(PAGE_TEXT),
  stable: false,
  sourceId: 'context.page.current-url',
  relevance: 0.8,
  freshness: 0.9,
  trust: 0.5,
  sensitivity: 'private',
  instructionAuthority: 'data',
};

const EXPECTED_WRAPPED = `<data-source id="context.page.current-url.0" kind="context">\n${PAGE_TEXT}\n</data-source>`;

describe('optimizeFromItems() pipeline (Task 3)', () => {
  it('tracer: system ContextItem flows through and yields a full receipt entry', async () => {
    const result = await contextOptimizer.optimizeFromItems([SYSTEM_ITEM], buildOptimizerInput());

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]).toEqual({
      kind: 'system',
      text: SYSTEM_TEXT,
      tokens: SYSTEM_ITEM.tokens,
      stable: true,
      sourceId: 'core.instructions.system',
    });

    const receipt = result.provenance.sections[0];
    expect(receipt.sourceId).toBe('core.instructions.system');
    expect(receipt.originalTokens).toBe(SYSTEM_ITEM.tokens);
    expect(receipt.finalTokens).toBe(SYSTEM_ITEM.tokens);
    expect(receipt.included).toBe(true);
    expect(receipt.cacheEligible).toBe(true);
  });

  it('rejects ContextItems with self-assigned trust metadata (D-06) with SCHEMA_INVALID', async () => {
    const bad = { ...SYSTEM_ITEM, trust: 0.5 }; // policy says 1.0
    await expect(
      contextOptimizer.optimizeFromItems([bad], buildOptimizerInput()),
    ).rejects.toMatchObject({ code: 'SCHEMA_INVALID' });
  });

  it('wraps data ContextItems in <data-source> delimiters and re-estimates tokens (CJK-aware)', async () => {
    const result = await contextOptimizer.optimizeFromItems([DATA_ITEM], buildOptimizerInput());

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0].text).toBe(EXPECTED_WRAPPED);
    expect(result.sections[0].stable).toBe(false);
    expect(result.sections[0].kind).toBe('context');

    const receipt = result.provenance.sections[0];
    expect(receipt.originalTokens).toBe(DATA_ITEM.tokens);
    expect(receipt.finalTokens).toBe(tokenBudget.estimateTokens(EXPECTED_WRAPPED));
    // CJK-aware estimateTokens — NOT byte length
    expect(receipt.finalTokens).not.toBe(EXPECTED_WRAPPED.length);
    expect(receipt.cacheEligible).toBe(false);
  });

  it('orders sections system → user → data — data never precedes system (D-02)', async () => {
    const result = await contextOptimizer.optimizeFromItems(
      [DATA_ITEM, SYSTEM_ITEM],
      buildOptimizerInput(),
    );

    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].sourceId).toBe('core.instructions.system');
    expect(result.sections[1].sourceId).toBe('context.page.current-url');

    const firstSystem = result.sections.findIndex((s) => s.kind === 'system');
    const firstData = result.sections.findIndex((s) => s.text.includes('<data-source'));
    expect(firstSystem).toBe(0);
    expect(firstData).toBeGreaterThan(firstSystem);
  });

  it('manifest sections carry ContextReceiptEntry fields — not bare ContextProvenanceEntry', async () => {
    const result = await contextOptimizer.optimizeFromItems(
      [SYSTEM_ITEM, DATA_ITEM],
      buildOptimizerInput(),
    );

    expect(result.provenance.sections).toHaveLength(2);
    for (const entry of result.provenance.sections) {
      expect(entry).toHaveProperty('originalTokens');
      expect(entry).toHaveProperty('finalTokens');
      expect(entry).toHaveProperty('included');
      expect(entry).toHaveProperty('cacheEligible');
    }
  });

  it('rejects sensitivity:secret items at the schema gate and in optimizer input (D-09)', async () => {
    const secretItem = { ...SYSTEM_ITEM, sensitivity: 'secret' as const };
    const parseResult = ContextItemSchema.safeParse(secretItem);
    expect(parseResult.success).toBe(false);

    await expect(
      contextOptimizer.optimizeFromItems([secretItem], buildOptimizerInput()),
    ).rejects.toMatchObject({ code: 'SCHEMA_INVALID' });
  });

  it('tracer end-to-end: system instruction + data section flow through the full pipeline', async () => {
    const result = await contextOptimizer.optimizeFromItems(
      [SYSTEM_ITEM, DATA_ITEM],
      buildOptimizerInput(),
    );

    // sections[0] = unwrapped system prompt
    expect(result.sections[0].kind).toBe('system');
    expect(result.sections[0].sourceId).toBe('core.instructions.system');
    expect(result.sections[0].text).toBe(SYSTEM_TEXT);
    // sections[1] = data section wrapped in delimiters
    expect(result.sections[1].text).toBe(EXPECTED_WRAPPED);
    expect(result.sections[1].stable).toBe(false);

    // receipt entries populated for both sections
    const sysReceipt = result.provenance.sections.find(
      (s) => s.sourceId === 'core.instructions.system',
    );
    const dataReceipt = result.provenance.sections.find(
      (s) => s.sourceId === 'context.page.current-url',
    );
    expect(sysReceipt).toMatchObject({
      originalTokens: SYSTEM_ITEM.tokens,
      finalTokens: SYSTEM_ITEM.tokens,
      included: true,
      cacheEligible: true,
    });
    expect(dataReceipt).toMatchObject({
      originalTokens: DATA_ITEM.tokens,
      included: true,
      cacheEligible: false,
    });
    expect(dataReceipt!.finalTokens).toBe(tokenBudget.estimateTokens(EXPECTED_WRAPPED));

    // valid OptimizedContext contract
    expect(result.tier).toBeDefined();
    expect(result.inputBudget).toBeGreaterThan(0);
    expect(result.cacheMetadata).toBeDefined();
  });

  it('empty ContextItem[] produces an empty OptimizedContext — no crash, no null', async () => {
    const result = await contextOptimizer.optimizeFromItems([], buildOptimizerInput());

    expect(result.sections).toHaveLength(0);
    expect(result.provenance.sections).toHaveLength(0);
    expect(result.provenance.totalTokens).toBe(0);
    expect(result.cacheMetadata).toBeDefined();
  });

  it('equal-trust data sections order deterministically — sourceId alphabetical within kind groups', async () => {
    const itemOther: ContextItem = { ...DATA_ITEM, sourceId: 'context.page.other-url' };
    const itemAlpha: ContextItem = { ...DATA_ITEM, sourceId: 'context.page.alpha-url' };

    // Input order is the reverse of the deterministic output order.
    const result = await contextOptimizer.optimizeFromItems(
      [itemOther, itemAlpha],
      buildOptimizerInput(),
    );

    expect(result.sections[0].sourceId).toBe('context.page.alpha-url');
    expect(result.sections[1].sourceId).toBe('context.page.other-url');
  });
});
