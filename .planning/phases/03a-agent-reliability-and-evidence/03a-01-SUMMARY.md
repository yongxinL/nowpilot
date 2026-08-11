---
phase: 03a-agent-reliability-and-evidence
plan: 01
subsystem: ai
tags: [agent-reliability, trajectory, harness, zod, evidence, prompt-sections]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: PromptSection canonical home (src/core/ai/types.ts), errorCodes.ts Phase-3 block, ProviderRouter/StructuredOutput TASK_KINDS copies
provides:
  - src/types/harness.ts C.1 agent-reliability types (AgentTrajectoryPhase, AgentTrajectoryState, AgentTurnOutcome) verbatim + LEGAL_TRANSITIONS table + transitionPhase + co-located Zod boundary schemas
  - src/core/error/errorCodes.ts harness block (AGENT_STATE_INVALID, TOOL_POSTCONDITION_FAILED, COMPLETION_EVIDENCE_MISSING)
  - PromptSection['kind'] += 'tool_result' wired into TASK_KINDS in BOTH ProviderRouter.ts and StructuredOutput.ts (never CACHED_KINDS)
  - tests/fixtures/trajectory.ts deterministic fixture module + tests/core/ai/trajectory/transition.test.ts
affects: [03a-02 OutcomeVerifier, 03a-03 AgentOrchestrator rewire, 03a-04 hook mapping, 03a-05, Phase 8 TOL-02/03 permission gating]

# Tech tracking
tech-stack:
  added: []  # zero new dependencies — zod 3.25.76 already pinned
  patterns:
    - "Co-located Zod boundary schemas with C.1 types in harness.ts (GR-4, D-3a-20) — mirrors ProviderConfigSchema precedent"
    - "Canonical error-code block extended IN PLACE in errorCodes.ts (GR-9)"
    - "F-4 kind mapping: 'tool_result' → TASK_KINDS (prompt side) in both copies, never CACHED_KINDS (Pitfall 2/7)"

key-files:
  created:
    - tests/fixtures/trajectory.ts
    - tests/core/ai/trajectory/transition.test.ts
  modified:
    - src/types/harness.ts
    - src/core/error/errorCodes.ts
    - src/core/ai/types.ts
    - src/core/context/ContextProvenanceManifest.ts
    - src/core/ai/ProviderRouter.ts
    - src/core/ai/StructuredOutput.ts

key-decisions:
  - "C.1 AgentTrajectoryPhase kept verbatim (10 states, R-1): 'partial' is an OUTCOME STATUS on AgentTurnOutcome, never a trajectory phase — LEGAL_TRANSITIONS terminal states are completed/failed/aborted (plan literal fixed; both readings allowed by RESEARCH C5 note)"
  - "Zod boundary schemas co-located inline in harness.ts (D-3a-20, GR-4), zod 3 API only (z.enum/z.object/z.array/.safeParse)"
  - "'tool_result' maps to TASK_KINDS (provider prompt side) in BOTH ProviderRouter.ts and StructuredOutput.ts and never enters CACHED_KINDS (cache-stability, Pitfall 2/7)"
  - "ContextProvenanceManifest.sections[].kind mirrors PromptSection['kind'] — extended in lockstep to keep the manifest a faithful provenance record (Rule 3)"

patterns-established:
  - "C5 transition table: single Record<AgentTrajectoryPhase, readonly AgentTrajectoryPhase[]> in harness.ts; transitionPhase throws the canonical AGENT_STATE_INVALID on illegal edges (GR-9)"
  - "Deterministic reliability fixtures (O1): fixed constants only, syntheticEvidence() carries fixed verifiedAt — never crypto/Date.now"

requirements-completed: [AGT-01, AGT-02, AGT-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "C.1 agent-reliability types + 10-state legal-transition table + transitionPhase + co-located Zod boundary schemas in src/types/harness.ts (AGT-01 foundation)"
    requirement: AGT-01
    verification:
      - kind: unit
        ref: "tests/core/ai/trajectory/transition.test.ts#LEGAL_TRANSITIONS + boundary-schema suites (15 tests)"
        status: pass
      - kind: other
        ref: "grep: exactly one 'export type AgentTrajectoryPhase' in repo (src/types/harness.ts)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Harness error-code block (AGENT_STATE_INVALID, TOOL_POSTCONDITION_FAILED, COMPLETION_EVIDENCE_MISSING) added IN PLACE to errorCodes.ts — canonical mirror of spec Appendix C.2 L5051-5053 (GR-9)"
    requirement: AGT-02
    verification:
      - kind: other
        ref: "grep: three harness codes present in src/core/error/errorCodes.ts, no duplicate keys"
        status: pass
    human_judgment: false
  - id: D3
    description: "PromptSection['kind'] union extended with 'tool_result' (D-3a-11 F-4 replan-feedback kind); wired into TASK_KINDS in BOTH ProviderRouter.ts and StructuredOutput.ts, absent from CACHED_KINDS"
    requirement: AGT-04
    verification:
      - kind: other
        ref: "grep: 'tool_result' in both TASK_KINDS arrays; 0 matches inside CACHED_KINDS block"
        status: pass
    human_judgment: false
  - id: D4
    description: "Deterministic trajectory/evidence fixture module (MOCK_DANGEROUS_TOOL, verifier fixture, syntheticEvidence, transitionAssert) + transition/boundary-schema tests proving every legal edge, AGENT_STATE_INVALID on illegal edges, and 4-value status union enforcement"
    requirement: AGT-03
    verification:
      - kind: unit
        ref: "tests/core/ai/trajectory/transition.test.ts (15 tests pass; fixtures suite 8 tests pass)"
        status: pass
    human_judgment: false

# Metrics
duration: 11min
completed: 2026-08-11
status: complete
---

# Phase 03a Plan 01: Harness Foundation Summary

**C.1 agent-reliability type foundation: 10-state trajectory machine + legal-transition table + co-located Zod boundary schemas in harness.ts, the 3-code harness error block (IN PLACE), and the F-4 `tool_result` prompt-section kind wired into both TASK_KINDS copies.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-11T21:23:29Z
- **Completed:** 2026-08-11T21:34:46Z
- **Tasks:** 7
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments
- `src/types/harness.ts` extended with the three C.1 agent-reliability types verbatim (AgentTrajectoryPhase 10-state enum, AgentTrajectoryState, AgentTurnOutcome — R-1 single home), the `LEGAL_TRANSITIONS` 10-state table + `transitionPhase` (throws the canonical `AGENT_STATE_INVALID` on illegal edges, C5), and co-located Zod boundary schemas (AgentTrajectoryPhaseSchema, AgentTrajectoryStateSchema, CompletionEvidenceSchema, AgentTurnOutcomeSchema — GR-4, D-3a-20). CompletionEvidence unchanged.
- `src/core/error/errorCodes.ts` gained the harness block IN PLACE: `AGENT_STATE_INVALID`, `TOOL_POSTCONDITION_FAILED`, `COMPLETION_EVIDENCE_MISSING` — canonical mirror of spec Appendix C.2 L5051-5053 (GR-9), no duplicates.
- `PromptSection['kind']` extended with `'tool_result'` (D-3a-11 F-4 replan-feedback kind); `TASK_KINDS` in BOTH `ProviderRouter.ts` and `StructuredOutput.ts` now list it (Pitfall 2 — the section survives joinSections/filter and reaches the model on the `prompt` side); `CACHED_KINDS` untouched (Pitfall 7 — cache-stability).
- `tests/fixtures/trajectory.ts` (new, deterministic — no crypto/Date.now): `MOCK_DANGEROUS_TOOL`, `MOCK_DANGEROUS_VERIFIER` (`postconditionId: 'mock-dangerous.verified'`), `syntheticEvidence(overrides)`, `transitionAssert`.
- `tests/core/ai/trajectory/transition.test.ts` (new): 15 tests proving every legal edge passes, every illegal edge throws `AGENT_STATE_INVALID` (full non-table sweep), terminal states have no outgoing edges, and the Zod schemas round-trip valid fixtures / reject malformed shapes — including `status: 'verification_failed'` (4-value C.1 union preserved, AGT-03).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend harness.ts with C.1 types + transition table + Zod schemas** - `d757e1d` (feat)
2. **Task 2: Extend errorCodes.ts IN PLACE with harness codes** - `40aee4b` (feat)
3. **Task 3: Extend PromptSection kind union with 'tool_result'** - `f4e6629` (feat)
4. **Task 4: Add 'tool_result' to TASK_KINDS in both files** - `d3915c8` (feat)
5. **Task 5: Create tests/fixtures/trajectory.ts** - `a721560` (test)
6. **Task 6: Create transition.test.ts** - `7f880a9` (test)
7. **Task 7: Verify green** — no separate commit (grep assertions + regression runs within the task commits)

**Plan metadata:** pending (docs: complete plan — final commit)

## Files Created/Modified
- `src/types/harness.ts` - C.1 types verbatim + LEGAL_TRANSITIONS + transitionPhase + 4 co-located Zod schemas (CompletionEvidence untouched)
- `src/core/error/errorCodes.ts` - harness block: AGENT_STATE_INVALID / TOOL_POSTCONDITION_FAILED / COMPLETION_EVIDENCE_MISSING
- `src/core/ai/types.ts` - PromptSection['kind'] union += 'tool_result' + doc note
- `src/core/context/ContextProvenanceManifest.ts` - sections[].kind union mirrors PromptSection extension (Rule 3 fix)
- `src/core/ai/ProviderRouter.ts` - TASK_KINDS += 'tool_result' (CACHED_KINDS untouched)
- `src/core/ai/StructuredOutput.ts` - TASK_KINDS += 'tool_result' (repair-section cached filter now passes tool_result through)
- `tests/fixtures/trajectory.ts` (new) - MOCK_DANGEROUS_TOOL, verifier fixture, syntheticEvidence, transitionAssert
- `tests/core/ai/trajectory/transition.test.ts` (new) - transition-table + boundary-schema tests

## Decisions Made
- **'partial' is an outcome status, never a trajectory phase** — C.1's `AgentTrajectoryPhase` enum has exactly 10 states (R-1 verbatim); `LEGAL_TRANSITIONS` terminal states are `completed`/`failed`/`aborted` with empty arrays. A turn reaching `rendering` produces the `partial` status on `AgentTurnOutcome`. RESEARCH C5 note explicitly allows both readings; the plan's literal (`rendering→[...,partial,...]`) cannot compile under the mandated C.1 enum.
- **Zod schemas co-located inline in harness.ts** (D-3a-20, GR-4) — mirrors the ProviderConfigSchema precedent in ai/types.ts; zod 3 API only (research A5: project pins 3.25.76).
- **'tool_result' lives on the provider `prompt` side** — added to TASK_KINDS in both copies; never CACHED_KINDS (per-turn, stable:false; cache-stability invariant F-4).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] LEGAL_TRANSITIONS 'partial' member is impossible under the C.1 enum**
- **Found during:** Task 1 (harness.ts transition table)
- **Issue:** The plan's must_haves literal lists `rendering→[completed,failed,partial,aborted]` and 'partial' as a table key, but C.1 `AgentTrajectoryPhase` (which the plan mandates VERBATIM, R-1) has no 'partial' member — 'partial' is an outcome status on `AgentTurnOutcome`. A `Record<AgentTrajectoryPhase, readonly AgentTrajectoryPhase[]>` containing 'partial' fails `tsc --noEmit` (a hard success criterion).
- **Fix:** Table implemented with the 10 real phases: `rendering→[completed,failed,aborted]`; terminal = completed/failed/aborted (empty arrays). Documented in a harness.ts comment. RESEARCH C5 note ("both readings are consistent with C.1; pick one and assert it") endorses this resolution; the 4-value status union keeps 'partial'.
- **Files modified:** src/types/harness.ts
- **Verification:** tsc green; transition.test.ts full non-table sweep (every pair not in the table throws AGENT_STATE_INVALID)
- **Committed in:** d757e1d (Task 1 commit)

**2. [Rule 3 - Blocking] ContextProvenanceManifest.sections[].kind mirrors the PromptSection union and broke on the 'tool_result' extension**
- **Found during:** Task 3 (PromptSection kind union extension)
- **Issue:** `src/core/context/ContextProvenanceManifest.ts` declares a `kind` union identical to the pre-3a `PromptSection['kind']`; extending PromptSection made `contextHelper.ts` and `tests/fixtures/optimizedContext.ts` fail tsc (TS2322 — 'tool_result' not assignable to the narrower manifest union).
- **Fix:** Extended the manifest's `kind` union with `'tool_result'` IN PLACE so the provenance record stays faithful for every emitted section kind (including replan feedback).
- **Files modified:** src/core/context/ContextProvenanceManifest.ts
- **Verification:** tsc green; full tests/core/ai regression (16 files, 183 tests) + fixtures suite green
- **Committed in:** f4e6629 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 blocking type-correctness fixes caused directly by this plan's mandated changes)
**Impact on plan:** Both fixes are necessary for the plan's own hard success criteria (tsc green, R-1 verbatim enum). No scope creep — the manifest fix is a mechanical mirror extension; the table fix resolves the C5 ambiguity the plan's own RESEARCH flagged as planner-discretion.

## Issues Encountered
- None beyond the two auto-fixed deviations above. The `head -10` pipeline masking tsc's exit code was a shell-usage artifact during verification, not a project issue.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready for **03a-02** (OutcomeVerifier + evidence/verifier fixtures + AGT-02/AGT-03 behavior tests) — the C.1 types, evidence schemas, and error codes it imports now exist.
- Ready for **03a-03** (AgentOrchestrator rewire) — `transitionPhase`/`LEGAL_TRANSITIONS` are the tested transition authority; the `tool_result` section kind survives prompt assembly on both the Router and StructuredOutput paths.
- The 03a-01 flagged assumptions (AGT-01/02/03 behavioral proofs land in 03a-02/03; AGT-03 precision — verification_failed maps to status 'failed') remain open by design and are re-asserted in the orchestrator plan.

---
*Phase: 03a-agent-reliability-and-evidence*
*Completed: 2026-08-11*

## Self-Check: PASSED

- Created files verified on disk: tests/fixtures/trajectory.ts, tests/core/ai/trajectory/transition.test.ts, 03a-01-SUMMARY.md
- Commits verified in git log: d757e1d, 40aee4b, f4e6629, d3915c8, a721560, 7f880a9
- tsc --noEmit green; transition.test.ts 15/15 pass; tests/core/ai regression 183/183 pass; fixtures suite 8/8 pass

