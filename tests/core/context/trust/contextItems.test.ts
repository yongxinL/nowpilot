import { describe, it, expect } from 'vitest';
import { buildContextItems } from '@/core/context/trust/contextItems';
import type { ContextOptimizerInput } from '@/core/context/ContextOptimizer';
import type { PageContext } from '@/core/context/types';

/**
 * contextItems contract tests (plan 07-01, Task 1) — §18-required
 * tests/core/context/trust/contextItems.test.ts. Pure unit, no chrome mocks:
 * the D-94 per-source trust/authority map, the sourceId mapping mirroring
 * ContextOptimizer.sourceIdFor, and the deterministic relevance/freshness/
 * sensitivity metadata — all five C.1 fields present per item (CTX-01).
 */

const defaultPageContext: PageContext = {
  url: 'https://example.com',
  origin: 'https://example.com',
  hostname: 'example.com',
  title: 'Example',
  markdown: 'body text',
  meta: {},
  extractedAt: 0,
};

/** Input-builder mirroring ContextOptimizer.test.ts:32-51 — REQUIRED defaults, overrides merge. */
function makeInput(overrides: Partial<ContextOptimizerInput> = {}): ContextOptimizerInput {
  return {
    operationId: 'op-test',
    model: 'fixture-model',
    modelContextWindow: 16384,
    userInput: 'Summarize the current incident',
    conversationId: 'conv-1',
    workspaceId: 'ws-1',
    activeSurface: 'sidepanel',
    pageContext: defaultPageContext,
    selectedToolSchemas: [
      { name: 'toolA', description: 'a', jsonSchema: {}, dangerous: false, source: 'builtin' },
    ],
    memoryHints: [
      { id: 'm1', content: 'user prefers concise', type: 'preference', tags: [], score: 0.9 },
    ],
    preferences: {
      responseStyle: 'mixed',
      preferredLanguage: 'en',
      preferStructuredOutput: true,
      allowCloudFallbackFromLocal: false,
      toolAutonomy: 'ask',
      defaultSurface: 'sidepanel',
    },
    ...overrides,
  };
}

describe('buildContextItems — D-94 per-source trust map (CTX-01)', () => {
  it('full input → 5 items with the locked trust/authority per source', () => {
    const items = buildContextItems(makeInput());
    expect(items).toHaveLength(5);

    const byKind = new Map(items.map((it) => [it.kind, it]));
    expect(byKind.get('TOOL SCHEMAS')).toMatchObject({ trust: 'system', instructionAuthority: true });
    expect(byKind.get('USER PREFERENCES')).toMatchObject({ trust: 'user', instructionAuthority: true });
    expect(byKind.get('USER INPUT')).toMatchObject({ trust: 'user', instructionAuthority: true });
    expect(byKind.get('MEMORY')).toMatchObject({ trust: 'retrieved', instructionAuthority: false });
    expect(byKind.get('CONTEXT')).toMatchObject({ trust: 'untrusted', instructionAuthority: false });
  });

  it('sourceId mapping mirrors sourceIdFor: CONTEXT = pageContext.url, MEMORY = ids joined ",", TOOL SCHEMAS = names joined ","', () => {
    const items = buildContextItems(
      makeInput({
        pageContext: { ...defaultPageContext, url: 'https://sn.example/ticket/1' },
        memoryHints: [
          { id: 'm1', content: 'a', type: 'fact', tags: [], score: 0.5 },
          { id: 'm2', content: 'b', type: 'pattern', tags: [], score: 0.5 },
        ],
        selectedToolSchemas: [
          { name: 'zeta', description: 'z', jsonSchema: {}, dangerous: false, source: 'builtin' },
          { name: 'alpha', description: 'a', jsonSchema: {}, dangerous: false, source: 'builtin' },
        ],
      }),
    );

    const byKind = new Map(items.map((it) => [it.kind, it]));
    expect(byKind.get('CONTEXT')?.sourceId).toBe('https://sn.example/ticket/1');
    expect(byKind.get('MEMORY')?.sourceId).toBe('m1,m2');
    // Name-sorted join (buildToolSchemasText sort), not insertion order.
    expect(byKind.get('TOOL SCHEMAS')?.sourceId).toBe('alpha,zeta');
    expect(byKind.get('USER PREFERENCES')?.sourceId).toBe('preferences');
    expect(byKind.get('USER INPUT')?.sourceId).toBe('user_input');
  });

  it('every item carries all five C.1 metadata fields with the documented deterministic values', () => {
    const items = buildContextItems(makeInput());
    for (const it of items) {
      expect(typeof it.id).toBe('string');
      expect(typeof it.kind).toBe('string');
      expect(typeof it.text).toBe('string');
      expect(typeof it.tokens).toBe('number');
      expect(typeof it.trust).toBe('string');
      expect(typeof it.instructionAuthority).toBe('boolean');
      expect(typeof it.relevance).toBe('number');
      expect(typeof it.freshness).toBe('number');
      expect(typeof it.sensitivity).toBe('string');
      expect(['none', 'low', 'high']).toContain(it.sensitivity);
      expect(typeof it.sourceId).toBe('string');
    }

    const byKind = new Map(items.map((it) => [it.kind, it]));
    expect(byKind.get('CONTEXT')?.sensitivity).toBe('high');
    expect(byKind.get('MEMORY')?.sensitivity).toBe('high');
    expect(byKind.get('USER INPUT')?.sensitivity).toBe('low');
    expect(byKind.get('USER PREFERENCES')?.sensitivity).toBe('none');
    expect(byKind.get('TOOL SCHEMAS')?.sensitivity).toBe('none');
    expect(byKind.get('CONTEXT')?.freshness).toBe(1);
    expect(byKind.get('MEMORY')?.freshness).toBe(0.5);
  });

  it('MEMORY relevance is the mean of hint.score rounded to 2dp', () => {
    const items = buildContextItems(
      makeInput({
        memoryHints: [
          { id: 'm1', content: 'a', type: 'fact', tags: [], score: 0.9 },
          { id: 'm2', content: 'b', type: 'pattern', tags: [], score: 0.5 },
        ],
      }),
    );
    const memory = items.find((it) => it.kind === 'MEMORY');
    expect(memory?.relevance).toBe(0.7); // (0.9 + 0.5) / 2, 2dp
  });

  it('item text/tokens match the per-source section text the assemble pipeline builds', () => {
    const items = buildContextItems(makeInput());
    const byKind = new Map(items.map((it) => [it.kind, it]));

    expect(byKind.get('TOOL SCHEMAS')?.text).toBe('toolA\ta');
    expect(byKind.get('USER PREFERENCES')?.text).toBe('Default persona; no user preferences set.');
    expect(byKind.get('MEMORY')?.text).toBe('m1\tuser prefers concise');
    expect(byKind.get('CONTEXT')?.text).toBe('URL: https://example.com\nTITLE: Example\nbody text');
    expect(byKind.get('USER INPUT')?.text).toBe('Summarize the current incident');
  });

  it('empty pageContext → CONTEXT item still emitted with the sourceId fallback "context"', () => {
    const items = buildContextItems(makeInput({ pageContext: undefined }));
    const context = items.find((it) => it.kind === 'CONTEXT');
    expect(context).toBeDefined();
    expect(context?.sourceId).toBe('context');
    expect(context?.trust).toBe('untrusted');
  });

  it('emits no SYSTEM/TASK items — those kinds have no §2.3 input source (Q3)', () => {
    const items = buildContextItems(makeInput());
    expect(items.some((it) => it.kind === 'SYSTEM')).toBe(false);
    expect(items.some((it) => it.kind === 'TASK')).toBe(false);
  });
});