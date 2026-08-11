// tests/fixtures/trajectory.ts — O1 (03a-01): deterministic trajectory/evidence
// fixture builders for the Phase-3a reliability layer. Rules (fixtures/index.ts
// determinism header): fixed constants ONLY — never crypto.* or Date.now.
// Builder pattern mirrors tests/fixtures/optimizedContext.ts. This is a TEST
// fixture, never imported from src (D-08/D-21 direction).
//
// NOTE (03a-01 task 5): unlike the other fixtures, this module VALUE-imports
// from src (@/types/harness LEGAL_TRANSITIONS/transitionPhase) — transitionAssert
// is mandated by the plan to assert recorded transition sequences against the
// canonical table itself (C5, R-1). The D-21 "type-only imports from src" default
// yields here by plan instruction; the module stays test-only (never imported
// from src/).
import { expect } from 'vitest';
import { z } from 'zod';

import type { BuiltinTool } from '@/core/ai/types';
import type { ToolExecutionResult } from '@/core/ai/types';
import {
  LEGAL_TRANSITIONS,
  transitionPhase,
} from '@/types/harness';
import type { AgentTrajectoryPhase, CompletionEvidence } from '@/types/harness';

// ---------------------------------------------------------------------------
// Fixed constants (deterministic — no real randomness anywhere in this module)
// ---------------------------------------------------------------------------

export const FIXED_TRAJECTORY_OPERATION_ID = 'op-trajectory-fixture';
/** Fixed evidence timestamp — the O.2 Date.now() call is replaced in fixtures. */
export const FIXED_VERIFIED_AT = 1000;
/** The verifier id the mock dangerous tool's evidence always carries (O.2/TOL-03). */
export const MOCK_DANGEROUS_POSTCONDITION_ID = 'mock-dangerous.verified';

// ---------------------------------------------------------------------------
// 1. mock dangerous side-effecting tool (O1) — BuiltinTool-compatible (§21.4).
// Phase 3a has ZERO real dangerous tools (CONTEXT boundary note); the mock
// exercises the evidence-gating machinery generically (AGT-02).
// ---------------------------------------------------------------------------

export const MOCK_DANGEROUS_TOOL: BuiltinTool = {
  name: 'mock-dangerous-write',
  description:
    'Fixture-only dangerous side-effecting tool — writing is irreversible, so ' +
    'success requires matching CompletionEvidence (R-8, AGT-02). Never registered ' +
    'in the runtime tool set (3a has no dangerous tools).',
  inputSchema: z.object({ path: z.string().min(1) }),
  outputSchema: z.object({ written: z.boolean() }),
  dangerous: true,
};

// ---------------------------------------------------------------------------
// 2. buildOutcome verifier fixture (O1) — O.2 Verifier shape. The OutcomeVerifier
// module itself lands in 03a-02; this fixture declares the structural shape so
// 03a-01 tests can exercise evidence production without the module.
// ---------------------------------------------------------------------------

export interface MockDangerousVerifier {
  postconditionId: string;
  verify(result: ToolExecutionResult<unknown>): Promise<{ ok: boolean; detail?: string }>;
}

/** Deterministic pass-through verifier: ok mirrors the result's ok flag. */
export const MOCK_DANGEROUS_VERIFIER: MockDangerousVerifier = {
  postconditionId: MOCK_DANGEROUS_POSTCONDITION_ID,
  async verify(result: ToolExecutionResult<unknown>): Promise<{ ok: boolean; detail?: string }> {
    if (!result.ok) return { ok: false, detail: result.error?.message ?? 'tool failed' };
    return { ok: true, detail: 'mock dangerous tool verified (fixture)' };
  },
};

// ---------------------------------------------------------------------------
// 3. syntheticEvidence builder (O1) — CompletionEvidence with fixed defaults.
// ---------------------------------------------------------------------------

export interface SyntheticEvidenceOverrides extends Partial<CompletionEvidence> {}

export function syntheticEvidence(
  overrides: SyntheticEvidenceOverrides = {},
): CompletionEvidence {
  return {
    toolName: MOCK_DANGEROUS_TOOL.name,
    operationId: FIXED_TRAJECTORY_OPERATION_ID,
    postconditionId: MOCK_DANGEROUS_POSTCONDITION_ID,
    ok: true,
    verifiedAt: FIXED_VERIFIED_AT,
    detail: 'synthetic evidence (fixture)',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 4. transitionAssert (O1, C5) — asserts a recorded transition sequence against
// LEGAL_TRANSITIONS: every [from, to] pair must be a legal edge in the canonical
// table AND transitionPhase must accept it at runtime. Deterministic, pure.
// ---------------------------------------------------------------------------

export function transitionAssert(transitions: AgentTrajectoryPhase[][]): void {
  for (const [from, to] of transitions) {
    expect(LEGAL_TRANSITIONS[from]).toContain(to);
    expect(() => transitionPhase(from, to)).not.toThrow();
  }
}
