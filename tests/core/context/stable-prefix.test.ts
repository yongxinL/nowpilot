import { describe, it, expect, vi } from 'vitest';
import type { ContextItem, ContextOptimizerInput, PromptSection } from '../../../src/core/ai/types';

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
      selectProvider: vi.fn(),
      // No AI summarization in unit tests: getCompressionModel returns null,
      // so overflow falls through to CONTEXT_TOO_LARGE (D-06, D-08).
      getCompressionModel: vi.fn().mockResolvedValue(null),
    },
  };
});

import { ContextOptimizer } from '../../../src/core/context/ContextOptimizer';

// ─────────────────────────────────────────────────────────────────────────────
// Stable-prefix contract (CTX-T04, D-04): deterministic FNV-1a hash of all
// stable sections + per-section diagnostic hashes. Volatile sections are
// excluded. Snapshot tests guard against unexpected drift.
// ─────────────────────────────────────────────────────────────────────────────

function buildSection(overrides: Partial<PromptSection> = {}): PromptSection {
  return {
    kind: 'system',
    text: '',
    tokens: 0,
    stable: true,
    sourceId: 'test.source',
    ...overrides,
  };
}

/** Two stable sections: persona + system rules (deterministic config). */
function stableConfig(): PromptSection[] {
  return [
    buildSection({
      kind: 'system',
      text: 'You are NowPilot, a privacy-first AI assistant.',
      tokens: 10,
      stable: true,
      sourceId: 'persona.runtime.active',
    }),
    buildSection({
      kind: 'system',
      text: 'Respond concisely. Never claim an action succeeded without evidence.',
      tokens: 12,
      stable: true,
      sourceId: 'core.instructions.system',
    }),
  ];
}

/** Volatile sections that must NEVER influence the stable-prefix hash. */
function volatileSections(): PromptSection[] {
  return [
    buildSection({
      kind: 'user_input',
      text: 'Summarize this page for me',
      tokens: 6,
      stable: false,
      sourceId: 'interaction.user.current-turn',
    }),
    buildSection({
      kind: 'memory',
      text: 'User prefers terse answers',
      tokens: 5,
      stable: false,
      sourceId: 'memory.user.facts',
    }),
    buildSection({
      kind: 'context',
      text: 'page content goes here',
      tokens: 8,
      stable: false,
      sourceId: 'context.page.current',
    }),
    buildSection({
      kind: 'task',
      text: '',
      tokens: 0,
      stable: false,
      sourceId: 'core.task.placeholder',
    }),
  ];
}

describe('computeStablePrefix() — stable-prefix contract (CTX-T04, D-04)', () => {
  it('Test 1: 2 stable sections with same text produce identical combinedHash on two calls (deterministic)', () => {
    const optimizer = new ContextOptimizer();
    const first = optimizer.computeStablePrefix(stableConfig());
    const second = optimizer.computeStablePrefix(stableConfig());
    expect(first.combinedHash).toBe(second.combinedHash);
    expect(first.combinedHash).toMatch(/^[0-9a-f]{8}$/);
  });

  it('Test 2: 2 stable + 4 volatile sections → stableSectionCount: 2 — only stable sections counted', () => {
    const optimizer = new ContextOptimizer();
    const result = optimizer.computeStablePrefix([...stableConfig(), ...volatileSections()]);
    expect(result.stableSectionCount).toBe(2);
  });

  it('Test 3: changing stable section text produces a different combinedHash', () => {
    const optimizer = new ContextOptimizer();
    const baseline = optimizer.computeStablePrefix(stableConfig());
    const changed = optimizer.computeStablePrefix([
      ...stableConfig().slice(0, 1),
      buildSection({
        kind: 'system',
        text: 'Respond verbosely. Different text entirely.',
        tokens: 12,
        stable: true,
        sourceId: 'core.instructions.system',
      }),
    ]);
    expect(changed.combinedHash).not.toBe(baseline.combinedHash);
  });

  it('Test 4: changing whitespace in stable section text produces a different combinedHash (FNV-1a is byte-level)', () => {
    const optimizer = new ContextOptimizer();
    const baseline = optimizer.computeStablePrefix(stableConfig());
    const whitespaceChanged = optimizer.computeStablePrefix([
      ...stableConfig().slice(0, 1),
      buildSection({
        kind: 'system',
        text: 'Respond concisely.  Never claim an action succeeded without evidence.',
        tokens: 12,
        stable: true,
        sourceId: 'core.instructions.system',
      }),
    ]);
    expect(whitespaceChanged.combinedHash).not.toBe(baseline.combinedHash);
  });

  it('Test 5: reordering stable sections produces a different combinedHash (order affects concatenation)', () => {
    const optimizer = new ContextOptimizer();
    const ordered = optimizer.computeStablePrefix(stableConfig());
    const reordered = optimizer.computeStablePrefix([...stableConfig()].reverse());
    expect(reordered.combinedHash).not.toBe(ordered.combinedHash);
  });

  it('Test 6: perSectionHashes length === stable section count; each entry has sourceId and hash', () => {
    const optimizer = new ContextOptimizer();
    const result = optimizer.computeStablePrefix([...stableConfig(), ...volatileSections()]);
    expect(result.perSectionHashes).toHaveLength(2);
    for (const entry of result.perSectionHashes) {
      expect(entry.sourceId).toMatch(/^[a-z0-9]+(\.[a-z0-9_\-]+)+$/);
      expect(entry.hash).toMatch(/^[0-9a-f]{8}$/);
    }
    expect(result.perSectionHashes.map((e) => e.sourceId)).toEqual(
      stableConfig().map((s) => s.sourceId),
    );
  });

  it('Test 7: SNAPSHOT — combinedHash guards against accidental drift', () => {
    const optimizer = new ContextOptimizer();
    const result = optimizer.computeStablePrefix(stableConfig());
    expect(result.combinedHash).toMatchSnapshot();
  });

  it('Test 8: SNAPSHOT — perSectionHashes provide diagnostic per-section hashes', () => {
    const optimizer = new ContextOptimizer();
    const result = optimizer.computeStablePrefix(stableConfig());
    expect(result.perSectionHashes).toMatchSnapshot();
  });

  it('Test 9: persona + system instructions produce byte-identical hashes for identical config', () => {
    const optimizer = new ContextOptimizer();
    const configA = stableConfig();
    const configB = stableConfig();
    const a = optimizer.computeStablePrefix(configA);
    const b = optimizer.computeStablePrefix(configB);
    expect(a.combinedHash).toBe(b.combinedHash);
    expect(a.perSectionHashes).toEqual(b.perSectionHashes);
  });

  it('Test 10: adding volatile data (user input, memory, page, task) does NOT change combinedHash', () => {
    const optimizer = new ContextOptimizer();
    const withoutVolatile = optimizer.computeStablePrefix(stableConfig());
    const withVolatile = optimizer.computeStablePrefix([...stableConfig(), ...volatileSections()]);
    expect(withVolatile.combinedHash).toBe(withoutVolatile.combinedHash);
    expect(withVolatile.perSectionHashes).toEqual(withoutVolatile.perSectionHashes);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// optimizeFromItems() integration — cacheMetadata carries perSectionHashes
// ─────────────────────────────────────────────────────────────────────────────

function buildOptimizerInput(overrides?: Partial<ContextOptimizerInput>): ContextOptimizerInput {
  return {
    operationId: 'op-stable-prefix-1',
    model: 'gpt-4o-mini',
    modelContextWindow: 128000,
    userInput: 'What can you do?',
    conversationId: 'conv-stable-prefix-1',
    workspaceId: 'ws-stable-prefix-1',
    activeSurface: 'sidepanel',
    selectedToolSchemas: [],
    memoryHints: [],
    preferences: {},
    ...overrides,
  };
}

function buildContextItem(overrides: Partial<ContextItem>): ContextItem {
  return {
    kind: 'system',
    text: 'You are NowPilot.',
    tokens: 4,
    stable: true,
    sourceId: 'core.instructions.system',
    relevance: 1,
    freshness: 1,
    trust: 1,
    sensitivity: 'public',
    instructionAuthority: 'system',
    ...overrides,
  };
}

describe('optimizeFromItems() — cacheMetadata.perSectionHashes (CTX-T04)', () => {
  it('populates perSectionHashes for each stable section in the final return', async () => {
    const optimizer = new ContextOptimizer();
    const items: ContextItem[] = [
      buildContextItem({
        kind: 'system',
        text: 'You are NowPilot, a privacy-first AI assistant.',
        tokens: 10,
        sourceId: 'persona.runtime.active',
      }),
      buildContextItem({
        kind: 'system',
        text: 'Respond concisely.',
        tokens: 5,
        sourceId: 'core.instructions.system',
      }),
      buildContextItem({
        kind: 'user_input',
        text: 'What can you do?',
        tokens: 5,
        stable: false,
        sourceId: 'interaction.user.current-turn',
        trust: 0.9,
        sensitivity: 'private',
        instructionAuthority: 'user',
      }),
    ];
    const result = await optimizer.optimizeFromItems(items, buildOptimizerInput());

    expect(result.cacheMetadata?.perSectionHashes).toHaveLength(2);
    // D-02 deterministic ordering: system group, then sourceId alphabetically.
    expect(result.cacheMetadata?.perSectionHashes?.map((e) => e.sourceId)).toEqual([
      'core.instructions.system',
      'persona.runtime.active',
    ]);
    // combinedHash === cacheKeyHash — same FNV-1a over the same stable text.
    expect(result.cacheMetadata?.cacheKeyHash).toBeDefined();
    expect(result.cacheMetadata?.cacheKeyHash).toMatch(/^[0-9a-f]{8}$/);
  });
});
