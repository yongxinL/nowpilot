// tests/core/context/trust/stablePrefix.test.ts — Phase 4b CTX-04 stable-prefix
// snapshots (D-4b-12, 04b-04 Task 3; tests/core/context/trust/ per §18 L2746).
// Contract under test (RESEARCH Pattern 3 — Anthropic exact-prefix cache rule,
// F-5):
//   1. Snapshot (equivalent turns): optimize(baseInput(...)) twice with
//      identical inputs → the [SYSTEM] section texts are byte-identical
//      (deep-equal, ContextOptimizer.test.ts drop-in identity precedent).
//   2. Snapshot (with vs without page): the [SYSTEM] section text with a
//      pageContext feed EQUALS the no-page baseline — the persona block is
//      immune to the trust feed (RESEARCH Pitfall 1 guard, T-4b-05).
//   3. Negative snapshot: the system section text does NOT contain the
//      `<untrusted_data` wrap marker in EITHER case — the wrap is confined to
//      the per-turn context section (TASK_KINDS, never CACHED_KINDS, F-5).
//   4. Positive: when pageContext is present the context section EXISTS,
//      contains the wrap, and is stable:false (per-turn, TASK_KINDS).
//
// Determinism rule (fixtures precedent): no Date.now, no crypto, no
// Math.random — fixed inputs, pinned expected values.
import { describe, expect, it } from 'vitest';

import { optimize } from '@/core/context/ContextOptimizer';
import type { ContextOptimizerInput, OptimizedContext, PromptSection } from '@/core/ai/types';
import { GET_PROVIDER_INFO_TOOL } from '@/core/ai/toolSchemas';
import type { PageContext } from '@/core/content/PageContext';
import {
  FIXED_CONVERSATION_ID,
  FIXED_MODEL,
  FIXED_OPERATION_ID,
  FIXED_PERSONA_BLOCK,
  FIXED_PREFERENCES,
  FIXED_WORKSPACE_ID,
} from '../../../fixtures/optimizedContext';
import { FIXED_TIMESTAMP, FIXED_TITLE, FIXED_URL } from '../../../fixtures/pageContent';

/** The O.3 wrap marker — the negative-snapshot token (must never enter [SYSTEM]). */
const WRAP_MARKER = '<untrusted_data';

/** Fixed page feed fixture (deterministic — FIXED_TIMESTAMP, no Date.now). */
function fixedPage(): PageContext {
  return {
    url: FIXED_URL,
    origin: 'https://docs.example.com',
    hostname: 'docs.example.com',
    title: FIXED_TITLE,
    markdown: `# ${FIXED_TITLE}

The extraction pipeline runs entirely inside the side panel. Layered strategies keep the content script dependency-free.`,
    meta: {},
    extractedAt: FIXED_TIMESTAMP,
  };
}

/** Fixed base optimizer input — the CTX-04 snapshot template (ContextOptimizer.test.ts L52-69 analog). */
function baseInput(overrides: Partial<ContextOptimizerInput> = {}): ContextOptimizerInput {
  return {
    operationId: FIXED_OPERATION_ID,
    model: FIXED_MODEL,
    modelContextWindow: 200_000,
    userInput: 'Summarize the current page.',
    conversationId: FIXED_CONVERSATION_ID,
    workspaceId: FIXED_WORKSPACE_ID,
    activeSurface: 'sidepanel',
    pageContext: undefined,
    selectedToolSchemas: [GET_PROVIDER_INFO_TOOL],
    memoryHints: [],
    preferences: FIXED_PREFERENCES,
    personaBlock: FIXED_PERSONA_BLOCK,
    stage: 'planner',
    ...overrides,
  };
}

/** Extract the [SYSTEM] section — the byte-stable persona block. */
function systemSection(out: OptimizedContext): PromptSection {
  const system = out.sections.find((s) => s.kind === 'system');
  if (!system) throw new Error('optimize() must always emit a system section');
  return system;
}

describe('CTX-04 stable-prefix — [SYSTEM] byte-identity across equivalent turns (D-4b-12)', () => {
  it('identical inputs → byte-identical system section text (equivalent turns)', () => {
    const first = systemSection(optimize(baseInput()));
    const second = systemSection(optimize(baseInput()));
    expect(first.text).toBe(second.text);
    // hardcoded snapshot: the persona block flows through verbatim (byte-stable)
    expect(first.text).toBe(FIXED_PERSONA_BLOCK);
  });

  it('with pageContext → system section still equals the no-page baseline (Pitfall 1 guard)', () => {
    const withPage = systemSection(optimize(baseInput({ pageContext: fixedPage() })));
    const withoutPage = systemSection(optimize(baseInput()));
    expect(withPage.text).toBe(withoutPage.text);
    expect(withPage.text).toBe(FIXED_PERSONA_BLOCK);
  });
});

describe('CTX-04 negative snapshot — the wrap never enters the cached [SYSTEM] (F-5)', () => {
  it('system section lacks the <untrusted_data marker with AND without a page feed', () => {
    const noPage = systemSection(optimize(baseInput()));
    const withPage = systemSection(optimize(baseInput({ pageContext: fixedPage() })));
    expect(noPage.text).not.toContain(WRAP_MARKER);
    expect(withPage.text).not.toContain(WRAP_MARKER);
  });
});

describe('CTX-04 positive snapshot — the wrapped context section (TASK_KINDS)', () => {
  it('page feed emits a context section that contains the wrap and is stable:false', () => {
    const out = optimize(baseInput({ pageContext: fixedPage() }));
    const context = out.sections.find((s) => s.kind === 'context');
    expect(context).toBeDefined();
    expect(context!.text).toContain(WRAP_MARKER);
    expect(context!.text).toContain(`source="${FIXED_URL}"`);
    expect(context!.stable).toBe(false); // per-turn, never CACHED_KINDS (F-5)
    expect(context!.sourceId).toBe('context');
  });

  it('no page feed → no context section at all (D-4a-06 unplugged path)', () => {
    const out = optimize(baseInput());
    expect(out.sections.find((s) => s.kind === 'context')).toBeUndefined();
  });
});
