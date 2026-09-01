import { describe, it, expect } from 'vitest';
import { assemble, type ContextOptimizerInput } from '@/core/context/ContextOptimizer';
import { pack } from '@/core/context/ContextPack';
import { hashStableSections } from '@/core/ai/PromptCacheAdapter';

/**
 * Stable-prefix golden snapshot suite (plan 07-02, Task 2) — §18-required
 * tests/core/context/trust/stable-prefix.snapshot.test.ts (CTX-04, D-100).
 *
 * The COMMITTED golden fixture (./fixtures/stable-prefix.golden.txt) is the
 * release-block artifact: any system-prompt change (tool-schema rendering,
 * prefsCompact, separators, ordering) diffs it → this test fails → the
 * verify:phase-7 gate (re-pointed in 07-03 per D-103) blocks release. This repo
 * has no CI — the gate IS the release block.
 *
 * CANONICAL fixture input (LOCKED — changing it invalidates the golden):
 *   - modelContextWindow 131072 → medium tier (mid-range, no degradation)
 *   - 3 name-sorted tool schemas with fixed names/descriptions
 *   - 2 fixed memory hints
 *   - preferences with both model fields + personaOverrides (name/tone/brevity)
 *     so prefsCompact output is deterministic
 *   - NO debugSections/secondaryNotes (D-97 caller-supplied — would churn the
 *     golden), NO fabricated-authority items (the canonical fixture is
 *     pipeline-correct; the wrap would alter section text).
 *
 * USER PREFERENCES reconciliation (RESEARCH reconciliation 3 / Pitfall 5): the
 * packed golden INCLUDES the USER PREFERENCES text because prefsCompact renders
 * deterministically for a fixed input — NOT because USER PREFERENCES is
 * cache-stable (it stays stable:false; only TOOL SCHEMAS is stable:true in the
 * shipped code). The FNV-1a cross-check (hashStableSections) hashes ONLY the
 * stable sections, so it independently pins the cache contract (spec 5747+).
 *
 * Golden regeneration path (INTENTIONAL prompt change → deliberate fixture
 * update, never silent auto-refresh): delete
 * ./fixtures/stable-prefix.golden.txt, re-run this file (vitest rewrites the
 * golden from the new deterministic output), REVIEW the diff, recompute the
 * stable-section FNV-1a hash (run the second test's failure output), and commit
 * both. A non-intentional diff (a regression) fails the test instead.
 */

/** Canonical fixture — deterministic, mid-tier, pipeline-correct (header above). */
const canonicalFixtureInput: ContextOptimizerInput = {
  operationId: 'op-snapshot',
  model: 'fixture-model',
  modelContextWindow: 131072, // medium tier — mid-range, no degradation
  userInput: 'Summarize the current incident',
  conversationId: 'conv-snapshot',
  workspaceId: 'ws-snapshot',
  activeSurface: 'sidepanel',
  pageContext: {
    url: 'https://support.servicenow.com/incident/INC0012345',
    origin: 'https://support.servicenow.com',
    hostname: 'support.servicenow.com',
    title: 'INC0012345 — Sev-2 Database Outage',
    markdown: 'Database cluster is unresponsive after the 03:00 UTC maintenance window.',
    meta: {},
    extractedAt: 0,
  },
  selectedToolSchemas: [
    { name: 'getIncident', description: 'Fetch an incident by number', jsonSchema: {}, dangerous: false, source: 'builtin' },
    { name: 'postNote', description: 'Append a work note to an incident', jsonSchema: {}, dangerous: false, source: 'builtin' },
    { name: 'searchKnowledge', description: 'Search the knowledge base', jsonSchema: {}, dangerous: false, source: 'builtin' },
  ],
  memoryHints: [
    { id: 'mem-1', content: 'user prefers concise replies', type: 'preference', tags: [], score: 0.9 },
    { id: 'mem-2', content: 'Sev-2 escalation path is the on-call DB team', type: 'fact', tags: [], score: 0.7 },
  ],
  preferences: {
    responseStyle: 'mixed',
    preferredLanguage: 'en',
    preferStructuredOutput: true,
    allowCloudFallbackFromLocal: false,
    toolAutonomy: 'ask',
    defaultSurface: 'sidepanel',
    fastModel: 'fast-fixture',
    balancedModel: 'balanced-fixture',
    personaOverrides: { name: 'NowPilot', tone: 'professional-warm', brevity: 'balanced' },
  },
};

/** The canonical fixture assembled once — both tests share the same input. */
function assembleCanonical(): ReturnType<typeof assemble> {
  return assemble(canonicalFixtureInput);
}

describe('stable-prefix golden snapshot — CTX-04/D-100', () => {
  it('packed stable prefix is byte-identical to the committed golden (CTX-04)', async () => {
    const result = assembleCanonical();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // toMatchFileSnapshot is ASYNC — must be awaited (vitest file-snapshot
    // semantics; first run WRITES the golden, subsequent runs diff against it).
    await expect(pack(result.context.sections).prompt).toMatchFileSnapshot(
      './fixtures/stable-prefix.golden.txt',
    );
  });

  it('stable-section FNV-1a hash matches the golden (cross-check, spec 5747+)', () => {
    const result = assembleCanonical();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // hashStableSections hashes ONLY stable sections (Appendix K) — in the
    // shipped emission that is exactly the [TOOL SCHEMAS] text. A stable-prefix
    // diff changes this hash and fails the cross-check independently of the
    // byte-identity assertion above.
    expect(hashStableSections(result.context.sections)).toBe('6832adbf');
  });
});