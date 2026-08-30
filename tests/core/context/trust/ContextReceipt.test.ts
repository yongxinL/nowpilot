import { describe, it, expect } from 'vitest';
import { deriveContextReceipt, type ContextReceiptSurface } from '@/core/context/trust/ContextReceipt';
import type { ContextProvenanceManifest } from '@/core/context/ContextProvenanceManifest';
import type { PromptSection } from '@/core/ai/types';
import type { ContextItem } from '@/types/harness';

/**
 * ContextReceipt derivation-rule tests (plan 07-01, Task 2) — §18-required
 * tests/core/context/trust/ContextReceipt.test.ts. Pure unit, no chrome mocks:
 * the UI-SPEC Contract C rules — included/omitReason (system/task
 * 'no-input-source', dropped debug/notes), original→final tokens (D-96),
 * compression mapping, cacheEligible from the A8 stable flag, and the L6
 * untrustedDataPresent signal (Contract A).
 */

const pageUrl = 'https://example.com/incident';

/** Hand-built manifest (the receipt derives from it; the schema is verbatim —
 * this shape mirrors buildManifest output for the unit test). */
function makeManifest(overrides: Partial<ContextProvenanceManifest> = {}): ContextProvenanceManifest {
  return {
    sections: [
      { kind: 'tool_schemas', sourceId: 'toolA', tokens: 8, truncated: false },
      { kind: 'preferences', sourceId: 'preferences', tokens: 10, truncated: false },
      { kind: 'memory', sourceId: 'm1', tokens: 6, truncated: false },
      { kind: 'context', sourceId: pageUrl, tokens: 50, truncated: false },
      { kind: 'user_input', sourceId: 'user_input', tokens: 8, truncated: false },
      { kind: 'system', sourceId: 'system', tokens: 0, truncated: true },
      { kind: 'task', sourceId: 'task', tokens: 0, truncated: true },
    ],
    totalTokens: 82,
    minimalMode: false,
    workspaceId: 'ws-1',
    activeSurface: 'sidepanel',
    ...overrides,
  };
}

function makeSections(): PromptSection[] {
  return [
    { kind: 'TOOL SCHEMAS', text: 'toolA\ta', stable: true, tokens: 8 },
    { kind: 'USER PREFERENCES', text: 'Default persona; no user preferences set.', stable: false, tokens: 10 },
    { kind: 'MEMORY', text: 'm1\tuser prefers concise', stable: false, tokens: 6 },
    { kind: 'CONTEXT', text: 'URL: https://example.com/incident\nTITLE: Incident\nbody', stable: false, tokens: 50 },
    { kind: 'USER INPUT', text: 'Summarize the current incident', stable: false, tokens: 8 },
  ];
}

/** makeItem — valid ContextItem defaults, overrides merge. */
function makeItem(overrides: Partial<ContextItem> = {}): ContextItem {
  return {
    id: 'CONTEXT:https://example.com/incident',
    kind: 'CONTEXT',
    text: 'URL: https://example.com/incident\nTITLE: Incident\nbody',
    tokens: 50,
    trust: 'untrusted',
    instructionAuthority: false,
    relevance: 1,
    freshness: 1,
    sensitivity: 'high',
    sourceId: pageUrl,
    ...overrides,
  };
}

describe('deriveContextReceipt — UI-SPEC Contract C derivation rules (D-95)', () => {
  it('shipped CONTEXT entry → included:true, sourceId = pageContext.url, cacheEligible:false (stable:false)', () => {
    const surface: ContextReceiptSurface = deriveContextReceipt(
      makeManifest(),
      { [pageUrl]: 50 },
      makeSections(),
      [makeItem()],
    );

    const contextEntry = surface.entries.find((e) => e.sourceId === pageUrl);
    expect(contextEntry?.included).toBe(true);
    expect(contextEntry?.sourceId).toBe(pageUrl);
    expect(contextEntry?.cacheEligible).toBe(false);
    expect(contextEntry?.omitReason).toBeUndefined();
  });

  it('TOOL SCHEMAS entry → cacheEligible:true (the A8 stable flag)', () => {
    const surface = deriveContextReceipt(makeManifest(), {}, makeSections(), [makeItem()]);

    const toolEntry = surface.entries.find((e) => e.sourceId === 'toolA');
    expect(toolEntry?.included).toBe(true);
    expect(toolEntry?.cacheEligible).toBe(true);
  });

  it('system/task omission records → included:false, omitReason "no-input-source", finalTokens 0, originalTokens from the map', () => {
    const surface = deriveContextReceipt(
      makeManifest(),
      { system: 100, task: 42 },
      makeSections(),
      [makeItem()],
    );

    const systemEntry = surface.entries.find((e) => e.sourceId === 'system');
    const taskEntry = surface.entries.find((e) => e.sourceId === 'task');
    expect(systemEntry?.included).toBe(false);
    expect(systemEntry?.omitReason).toBe('no-input-source');
    expect(systemEntry?.finalTokens).toBe(0);
    expect(systemEntry?.originalTokens).toBe(100); // from the D-96 map
    expect(taskEntry?.included).toBe(false);
    expect(taskEntry?.omitReason).toBe('no-input-source');
    expect(taskEntry?.originalTokens).toBe(42);
  });

  it('compressed shipped section → compression "structural", included STILL true (truncation ≠ omission)', () => {
    const manifest = makeManifest({
      sections: [
        { kind: 'tool_schemas', sourceId: 'toolA', tokens: 8, truncated: false },
        { kind: 'preferences', sourceId: 'preferences', tokens: 10, truncated: false },
        { kind: 'memory', sourceId: 'm1', tokens: 6, truncated: false },
        {
          kind: 'context',
          sourceId: pageUrl,
          tokens: 20,
          truncated: true,
          compressionApplied: 'structural',
        },
        { kind: 'user_input', sourceId: 'user_input', tokens: 8, truncated: false },
        { kind: 'system', sourceId: 'system', tokens: 0, truncated: true },
        { kind: 'task', sourceId: 'task', tokens: 0, truncated: true },
      ],
    });
    const surface = deriveContextReceipt(manifest, { [pageUrl]: 50 }, makeSections(), [makeItem()]);

    const contextEntry = surface.entries.find((e) => e.sourceId === pageUrl);
    expect(contextEntry?.compression).toBe('structural');
    expect(contextEntry?.included).toBe(true);
    expect(contextEntry?.originalTokens).toBe(50);
    expect(contextEntry?.finalTokens).toBe(20);
    expect(contextEntry?.omitReason).toBeUndefined();
  });

  it('dropped debug/notes entries (rungs 1-2 fired) → included:false, omitReason "debug-only"/"secondary-notes"', () => {
    const manifest = makeManifest({
      sections: [
        { kind: 'tool_schemas', sourceId: 'toolA', tokens: 8, truncated: false },
        { kind: 'preferences', sourceId: 'preferences', tokens: 10, truncated: false },
        { kind: 'memory', sourceId: 'm1', tokens: 6, truncated: false },
        { kind: 'context', sourceId: pageUrl, tokens: 50, truncated: false },
        { kind: 'user_input', sourceId: 'user_input', tokens: 8, truncated: false },
        { kind: 'context', sourceId: 'debug', tokens: 0, truncated: true },
        { kind: 'context', sourceId: 'notes', tokens: 0, truncated: true },
        { kind: 'system', sourceId: 'system', tokens: 0, truncated: true },
        { kind: 'task', sourceId: 'task', tokens: 0, truncated: true },
      ],
    });
    const surface = deriveContextReceipt(
      manifest,
      { [pageUrl]: 50, debug: 500, notes: 300 },
      makeSections(),
      [makeItem()],
    );

    const debugEntry = surface.entries.find((e) => e.sourceId === 'debug');
    const notesEntry = surface.entries.find((e) => e.sourceId === 'notes');
    expect(debugEntry?.included).toBe(false);
    expect(debugEntry?.omitReason).toBe('debug-only');
    expect(debugEntry?.originalTokens).toBe(500);
    expect(debugEntry?.finalTokens).toBe(0);
    expect(notesEntry?.included).toBe(false);
    expect(notesEntry?.omitReason).toBe('secondary-notes');
    expect(notesEntry?.originalTokens).toBe(300);
    expect(notesEntry?.finalTokens).toBe(0);
  });

  it('untrustedDataPresent true when any item is untrusted/retrieved, false when all system/user', () => {
    const sections = makeSections();
    const withUntrusted = deriveContextReceipt(makeManifest(), {}, sections, [makeItem()]);
    expect(withUntrusted.untrustedDataPresent).toBe(true);

    const withRetrieved = deriveContextReceipt(makeManifest(), {}, sections, [
      makeItem({ trust: 'retrieved' }),
    ]);
    expect(withRetrieved.untrustedDataPresent).toBe(true);

    const allTrusted = deriveContextReceipt(makeManifest(), {}, sections, [
      makeItem({ trust: 'system' }),
      makeItem({ trust: 'user', kind: 'USER INPUT', sourceId: 'user_input' }),
    ]);
    expect(allTrusted.untrustedDataPresent).toBe(false);
  });
});