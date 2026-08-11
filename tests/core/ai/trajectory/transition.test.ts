// tests/core/ai/trajectory/transition.test.ts — 03a-01 task 6 (C5, T-03a-01-SC):
// proves the legal-transition table end-to-end (every legal edge passes, every
// illegal edge throws the canonical AGENT_STATE_INVALID) and that the co-located
// Zod boundary schemas (GR-4, D-3a-20) round-trip valid fixtures and reject
// malformed shapes — including a 'verification_failed' status value, which the
// 4-value C.1 AgentTurnOutcome status union must reject (AGT-03 precision).
//
// Determinism (fixtures/index.ts): all fixtures are fixed constants —
// syntheticEvidence() carries a fixed verifiedAt; no Date.now/crypto anywhere.
import { describe, expect, it } from 'vitest';

import {
  LEGAL_TRANSITIONS,
  transitionPhase,
  AgentTrajectoryPhaseSchema,
  AgentTrajectoryStateSchema,
  AgentTurnOutcomeSchema,
  CompletionEvidenceSchema,
} from '@/types/harness';
import type {
  AgentTrajectoryPhase,
  AgentTrajectoryState,
  AgentTurnOutcome,
  CompletionEvidence,
} from '@/types/harness';
import {
  FIXED_TRAJECTORY_OPERATION_ID,
  FIXED_VERIFIED_AT,
  MOCK_DANGEROUS_TOOL,
  syntheticEvidence,
} from '../../../fixtures/trajectory';

const PHASES: AgentTrajectoryPhase[] = [
  'assembling-context',
  'planning',
  'waiting-for-permission',
  'executing',
  'verifying',
  'replanning',
  'rendering',
  'completed',
  'failed',
  'aborted',
];

// ---------------------------------------------------------------------------
// Legal-transition table (C5)
// ---------------------------------------------------------------------------

describe('LEGAL_TRANSITIONS (C5, AGT-01)', () => {
  it('declares exactly the 10 C.1 phases, each with valid phase targets', () => {
    const keys = Object.keys(LEGAL_TRANSITIONS) as AgentTrajectoryPhase[];
    expect(keys).toHaveLength(10);
    expect(new Set(keys)).toEqual(new Set(PHASES));
    for (const from of PHASES) {
      for (const to of LEGAL_TRANSITIONS[from]) {
        expect(PHASES).toContain(to);
      }
    }
  });

  it('every legal edge in the table passes transitionPhase without throwing', () => {
    for (const from of PHASES) {
      for (const to of LEGAL_TRANSITIONS[from]) {
        expect(() => transitionPhase(from, to)).not.toThrow();
      }
    }
  });

  it('transitionPhase is a no-op (returns undefined) on legal transitions', () => {
    expect(transitionPhase('assembling-context', 'planning')).toBeUndefined();
    expect(transitionPhase('rendering', 'completed')).toBeUndefined();
  });

  it('an illegal edge throws an Error whose message contains AGENT_STATE_INVALID', () => {
    expect(() => transitionPhase('planning', 'completed')).toThrow(/AGENT_STATE_INVALID/);
    expect(() => transitionPhase('planning', 'completed')).toThrow(
      /AGENT_STATE_INVALID: planning -> completed/,
    );
    expect(() => transitionPhase('completed', 'planning')).toThrow(/AGENT_STATE_INVALID/);
    expect(() => transitionPhase('rendering', 'planning')).toThrow(/AGENT_STATE_INVALID/);
  });

  it('every non-table edge (from → not-in-table) throws AGENT_STATE_INVALID', () => {
    for (const from of PHASES) {
      for (const to of PHASES) {
        if (LEGAL_TRANSITIONS[from].includes(to)) continue; // legal — covered above
        expect(() => transitionPhase(from, to)).toThrow(/AGENT_STATE_INVALID/);
      }
    }
  });

  it('terminal states (completed/failed/aborted) have no outgoing edges', () => {
    expect(LEGAL_TRANSITIONS.completed).toEqual([]);
    expect(LEGAL_TRANSITIONS.failed).toEqual([]);
    expect(LEGAL_TRANSITIONS.aborted).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Zod boundary schemas (GR-4, D-3a-20)
// ---------------------------------------------------------------------------

describe('trajectory/evidence boundary schemas', () => {
  const stateFixture: AgentTrajectoryState = {
    operationId: FIXED_TRAJECTORY_OPERATION_ID,
    phase: 'executing',
    plannerCalls: 1,
    toolCalls: 2,
    updatedAt: 1000,
  };

  const outcomeFixture: AgentTurnOutcome = {
    operationId: FIXED_TRAJECTORY_OPERATION_ID,
    status: 'completed',
    reasonCode: 'ok',
    evidence: [syntheticEvidence({ ok: true })],
    plannerCalls: 1,
    toolCalls: 1,
  };

  it('AgentTrajectoryPhaseSchema round-trips every legal phase value', () => {
    for (const phase of PHASES) {
      const res = AgentTrajectoryPhaseSchema.safeParse(phase);
      expect(res.success).toBe(true);
      if (res.success) expect(res.data).toBe(phase);
    }
  });

  it('AgentTrajectoryPhaseSchema rejects an invented phase value', () => {
    const res = AgentTrajectoryPhaseSchema.safeParse('paused');
    expect(res.success).toBe(false);
  });

  it('AgentTrajectoryStateSchema round-trips a valid state and rejects malformed shapes', () => {
    const ok = AgentTrajectoryStateSchema.safeParse(stateFixture);
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toEqual(stateFixture);

    // unknown phase
    expect(
      AgentTrajectoryStateSchema.safeParse({ ...stateFixture, phase: 'paused' }).success,
    ).toBe(false);
    // negative counters
    expect(
      AgentTrajectoryStateSchema.safeParse({ ...stateFixture, plannerCalls: -1 }).success,
    ).toBe(false);
    // missing updatedAt
    expect(
      AgentTrajectoryStateSchema.safeParse({ ...stateFixture, updatedAt: undefined }).success,
    ).toBe(false);
  });

  it('CompletionEvidenceSchema round-trips the synthetic fixture and rejects malformed shapes', () => {
    const evidence = syntheticEvidence();
    const ok = CompletionEvidenceSchema.safeParse(evidence);
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toEqual(evidence);

    // ok must be boolean
    expect(
      CompletionEvidenceSchema.safeParse({ ...evidence, ok: 'yes' }).success,
    ).toBe(false);
    // missing postconditionId
    expect(
      CompletionEvidenceSchema.safeParse({ ...evidence, postconditionId: undefined }).success,
    ).toBe(false);
  });

  it('AgentTurnOutcomeSchema round-trips a valid outcome', () => {
    const ok = AgentTurnOutcomeSchema.safeParse(outcomeFixture);
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toEqual(outcomeFixture);
  });

  it("AgentTurnOutcomeSchema rejects status 'verification_failed' (4-value C.1 union, AGT-03)", () => {
    // The C.1 status union has NO 'verification_failed' member — Open Q1 resolved:
    // verification_failed → status 'failed' + reasonCode 'verification_failed'.
    const res = AgentTurnOutcomeSchema.safeParse({
      ...outcomeFixture,
      status: 'verification_failed',
    });
    expect(res.success).toBe(false);
  });

  it('AgentTurnOutcomeSchema rejects malformed shapes (bad status, negative calls, missing evidence)', () => {
    expect(
      AgentTurnOutcomeSchema.safeParse({ ...outcomeFixture, status: 'done' }).success,
    ).toBe(false);
    expect(
      AgentTurnOutcomeSchema.safeParse({ ...outcomeFixture, toolCalls: -1 }).success,
    ).toBe(false);
    // evidence must be an array (syntheticEvidence list); a plain object fails
    expect(
      AgentTurnOutcomeSchema.safeParse({ ...outcomeFixture, evidence: undefined }).success,
    ).toBe(false);
  });

  it('cap-exhausted partial outcome is a VALID boundary shape (AGT-03: partial, never completed)', () => {
    const partial: AgentTurnOutcome = {
      operationId: FIXED_TRAJECTORY_OPERATION_ID,
      status: 'partial',
      reasonCode: 'cap_exhausted',
      evidence: [],
      plannerCalls: 2,
      toolCalls: 1,
    };
    const ok = AgentTurnOutcomeSchema.safeParse(partial);
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data).toEqual(partial);
  });

  it('the fixture mock dangerous tool is deterministic and side-effecting', () => {
    expect(MOCK_DANGEROUS_TOOL.name).toBe('mock-dangerous-write');
    expect(MOCK_DANGEROUS_TOOL.dangerous).toBe(true);
    // determinism: two syntheticEvidence calls deep-equal (fixed verifiedAt)
    expect(syntheticEvidence()).toEqual(syntheticEvidence());
    expect(syntheticEvidence().verifiedAt).toBe(FIXED_VERIFIED_AT);
  });
});
