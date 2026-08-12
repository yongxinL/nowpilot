---
phase: 03a-agent-reliability-and-evidence
verified: 2026-08-12T00:45:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Phase 3a: Agent Reliability and Evidence Verification Report

**Phase Goal:** Agent runs are reliable and evidenced — budgeted, rollback-capable, evidence-gated side effects, bounded replanning, and user confirmation before irreversible actions.
**Verified:** 2026-08-12T00:45:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A single agent run is bounded by the agent-level token budget (trajectory states transition correctly) — AGT-01 | ✓ VERIFIED | `src/types/harness.ts` declares the 10-state `AgentTrajectoryPhase` (single declaration, R-1), `LEGAL_TRANSITIONS` once, `transitionPhase` throwing `AGENT_STATE_INVALID`; `AgentOrchestrator.ts` emits transitions at every stage boundary via `emit()`/`transitionPhase` and enforces `trajectoryCapFor(tier) = plannerCap + toolCap + 1` (L69-71, L193-195). Behavioral: `tests/core/ai/trajectory/AgentOrchestrator.trajectory.test.ts` (a) asserts the exact healthy-turn sequence `assembling→planning→rendering→completed` and (b) the trajectory-cap force-termination `partial`/`trajectory_cap_exceeded`; `transition.test.ts` proves every legal edge + illegal-edge throw (15 tests, all green). |
| 2 | A failed run can roll back one step via CheckpointRecorder — AGT-02 | ✓ VERIFIED | `src/core/ai/CheckpointRecorder.ts` — opId-keyed `capture`/`restore` over a Map, `structuredClone` on both paths, undefined for uncaptured opIds; `AgentOrchestrator.ts` captures pre-execute (L231-236) and restores on retryable tool failure, discarding the failed result (L256-262). Behavioral: `CheckpointRecorder.test.ts` (9 tests: round-trip, deep-copy isolation, opId isolation) + `AgentOrchestrator.replan.test.ts` (a) proves the restore→replan→successful-rerun path yields `completed`. |
| 3 | Side-effecting tools marked done only with matching CompletionEvidence; cap exhaustion = `partial`, never `completed` — AGT-03 | ✓ VERIFIED | `src/core/ai/OutcomeVerifier.ts` — O.2-verbatim `buildOutcome`: `caps.capHit ? 'partial' : sideEffectFailed ? 'failed' : 'completed'` with `cap_exhausted`/`postcondition_failed`/`ok` reasonCodes; read-only tools skipped (`if (!v) continue`). Renderer guard (`evidenceDoneTools`, done/not-confirmed narration) + hook D-3a-19 mapping (partial|failed→failed, never completed). Behavioral: `OutcomeVerifier.test.ts` (12 tests incl. cap=partial-with-side-effect-failure, fail-closed `postcondition_failed`, read-only skip, clock determinism), `RendererService.evidence.test.ts` (5 tests: no `done` without ok:true evidence), `useStreamingLLM.test.tsx` D-3a-19 suite (partial→failed text-retained, failed, aborted→idle, completed). |
| 4 | Replanning bounded by tier caps and never nested; abort works cleanly — AGT-04 | ✓ VERIFIED | `AgentOrchestrator.ts`: per-tool `replannedTools: Set<string>` (one replan per failed tool, D-3a-12), `plannerCalls++` per replan (D-3a-13), plannerCap + trajectory-cap bounds, planner-failure `planner_failed` fallback with no re-invocation (R-2), F-4 `tool_result` PromptSection feedback (never joined-string), loop-top abort check + `isAbortError` propagation mid-replan/mid-verify. Behavioral: `AgentOrchestrator.replan.test.ts` (a) exactly-one replan with `tool_result` section, (b) repeated-identical terminal `failed`/`replan_identical_failure`, (c) `plannerCalls ≤ plannerCap`, (d) no replan on planner failure, (e) abort mid-replan → AbortError. |
| 5 | Evidence/false-completion tests pass (commit-confirm barrier UI deferred to Phase 8 — D-3a-01) — AGT-05 | ✓ VERIFIED | `RendererService.evidence.test.ts` (5 tests) proves the false-completion guard. Full suite run by verifier: **65 test files / 527 tests passed** (`npx vitest run`). ROADMAP criterion #5 in the reduced D-3a-01 form (L186); REQUIREMENTS.md AGT-05 row carries the Phase-8 TOL-03 re-map note; the AGT-05 core seam (`waiting-for-permission` + `onInputRequired` pause, abort wins) is behaviorally proven in `AgentOrchestrator.trajectory.test.ts` (d). |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ---------| ------ | ------- |
| `src/types/harness.ts` | C.1 types + LEGAL_TRANSITIONS + transitionPhase + Zod schemas | ✓ VERIFIED | 10-state enum, 4-value outcome union, single declarations, Zod schemas co-located (zod 3 API), error message carries canonical `AGENT_STATE_INVALID` |
| `src/core/error/errorCodes.ts` | Harness block IN PLACE | ✓ VERIFIED | `AGENT_STATE_INVALID`, `TOOL_POSTCONDITION_FAILED`, `COMPLETION_EVIDENCE_MISSING` at L73-75, no duplicates |
| `src/core/ai/types.ts` | PromptSection kind += 'tool_result' | ✓ VERIFIED | L143 union member + doc note; ContextProvenanceManifest mirrored in lockstep |
| `src/core/ai/ProviderRouter.ts` / `StructuredOutput.ts` | 'tool_result' in both TASK_KINDS, never CACHED_KINDS | ✓ VERIFIED | Both TASK_KINDS arrays list it; CACHED_KINDS untouched (cache-stability) |
| `src/core/ai/OutcomeVerifier.ts` | O.2 verbatim Verifier + buildOutcome | ✓ VERIFIED | Deterministic (zero LLM-call tokens), injectable `now` clock, cap=partial ternary, imports from `@/types/harness` (R-1) |
| `src/core/ai/CheckpointRecorder.ts` | opId-keyed LoopState capture/restore | ✓ VERIFIED | Map-backed, structuredClone capture AND restore, in-memory per-turn (no durable persistence, no compensation) |
| `src/core/ai/AgentOrchestrator.ts` | Rewired runAgentTurn → AgentTurnOutcome | ✓ VERIFIED | trajectory transitions + cap, checkpoint seam, replan policy, pause seam, buildOutcome terminal, D-20 fence inverted (header), AbortError propagation |
| `src/core/ai/RendererService.ts` | RenderInput verdict + evidence; evidence guard | ✓ VERIFIED | `evidenceDoneTools`/`hasUnverifiedSideEffects`; done/not-confirmed narration; display-only (never re-verifies) |
| `src/components/pages/useStreamingLLM.ts` | D-3a-19 status mapping | ✓ VERIFIED | `result.status` branches: completed→completed, aborted→idle, partial|failed→failed; `provider_unconfigured` guard retained |
| `tests/fixtures/trajectory.ts` | Deterministic fixtures | ✓ VERIFIED | `MOCK_DANGEROUS_TOOL`, `MOCK_DANGEROUS_VERIFIER`, `syntheticEvidence`, `transitionAssert`; no crypto/Date.now/Math.random |
| Test suites (6 new files) | Trajectory/replan/evidence/verifier/checkpoint/transition tests | ✓ VERIFIED | All present; 59/59 in the focused run + 34/34 in the consumer run, all green |
| `package.json` | `verify:phase-3a` script | ✓ VERIFIED | L22: full §24 chain (eslint + prettier --check + tsc --noEmit + wxt build + vitest run + isolation check) |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| AgentOrchestrator.ts | `@/types/harness` | imports `transitionPhase`, `AgentTurnOutcome`, `AgentTrajectoryState` | ✓ WIRED | L34-35 — R-1 canonical home, no re-declaration |
| AgentOrchestrator.ts | OutcomeVerifier.ts | `buildOutcome` in `finish()` (L308) | ✓ WIRED | Sole terminal authority; `verification_failed` mapping + fail-closed `!ok` override (L324-332) |
| AgentOrchestrator.ts | CheckpointRecorder.ts | `capture` before execute (L231), `restore` on retryable failure (L256) | ✓ WIRED | Loop-state rewind, failed result discarded, no compensation |
| AgentOrchestrator.ts | RendererService.ts | `verdict` + `evidence` threaded at finish (L342-343) | ✓ WIRED | Display-only renderer; guard activates when fields present |
| PlannerService input | F-4 tool_result section | `replanSections` appended via `{...input.context.sections, ...replanSections}` (L386-389) | ✓ WIRED | `kind:'tool_result'`, `stable:false`, `sourceId:'replan-feedback'` — survives TASK_KINDS filter (03a-01) |
| AgentTurnOutcome.status | ChatStreamState | `useStreamingLLM.ts` L176-185 | ✓ WIRED | D-3a-19 exhaustive mapping; partial never surfaces as completed |
| D-20 fence test | New contract | `AgentOrchestrator.test.ts` L399: `toMatch(/AgentTurnOutcome|OutcomeVerifier|trajectory/)` | ✓ WIRED | Inverted, not silently removed (Pitfall 1); 0 stale `not.toMatch(...)` in tests/ |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| AgentOrchestrator `finish()` | `toolResults` | ExecutorService.execute results accumulated in-loop; buildOutcome evidence entries | Yes (executor results flow into evidence + render) | ✓ FLOWING |
| RendererService render | `toolResults`/`evidence` | Orchestrator-supplied verdict + buildOutcome evidence | Yes — real per-tool done/not-confirmed status derived from actual evidence | ✓ FLOWING |
| useStreamingLLM | `result.status` | `runAgentTurn` AgentTurnOutcome | Yes — real status values, not hardcoded (mock-driven tests exercise all 4) | ✓ FLOWING |
| Replan feedback | `replanSections` | Real tool-failure `{toolName, error.code}` from executor result | Yes — typed error code, not static text | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| New phase suites (trajectory, replan, evidence, verifier, checkpoint, transition, fixtures) | `npx vitest run tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts tests/core/ai/RendererService.evidence.test.ts tests/fixtures` | 7 files / 59 tests passed | ✓ PASS |
| Migrated consumer suites (hook + orchestrator + budget) | `npx vitest run tests/components/pages/useStreamingLLM.test.tsx tests/core/ai/AgentOrchestrator.test.ts tests/core/ai/AgentOrchestrator.budget.test.ts` | 3 files / 34 tests passed | ✓ PASS |
| Full suite (65 files / 527 tests claim) | `npx vitest run` | 65 files / 527 tests passed | ✓ PASS |
| R-3 isolation (no AI/vault tokens in background/content bundles) | `node tests/isolation/check-content-bundle.mjs` | "1 content bundle(s) + 1 background SW bundle(s) clean", exit 0 | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| verify:phase-3a script exists | `grep verify:phase-3a package.json` | L22 present, full §24 chain | ✓ PASS |
| §18 canonical phase order | `grep "Execution Order" .planning/ROADMAP.md` | L439 untouched: `1 → 2 → 3 → 3a → 4 → ...` | ✓ PASS |
| Requirement traceability | `grep AGT .planning/REQUIREMENTS.md` | AGT-01..05 rows + re-map notes + "AGT-01…05 | Phase 3a | Done" (L193) | ✓ PASS |
| Phase commits | `git log --since 2026-08-11` | All summary-documented commits present (d757e1d … e6f528c) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
| ----------- | ------------ | ----------- | ------ | -------- |
| AGT-01 | 03a-01, 03a-03, 03a-05 | Agent-level token budget bounds a single agent run | ✓ SATISFIED | 10-state trajectory machine + transition table (harness.ts), trajectory cap (AgentOrchestrator L69-71), behavioral tests green |
| AGT-02 | 03a-01, 03a-02, 03a-03, 03a-05 | CheckpointRecorder enables one-step rollback on failure | ✓ SATISFIED | CheckpointRecorder capture/restore + orchestrator seam + 9 unit tests + replan-path behavioral proof |
| AGT-03 | 03a-01..05 | Side-effecting tools require CompletionEvidence; cap exhaustion = `partial`, never `completed` | ✓ SATISFIED | buildOutcome ternary + renderer evidence guard + hook D-3a-19 mapping + 4-value status schema enforcement |
| AGT-04 | 03a-03, 03a-05 | Replan path is bounded by tier caps and never nested | ✓ SATISFIED | Per-tool replan Set, plannerCap bound, trajectory cap, planner-failure no-replan, 5 replan tests |
| AGT-05 | 03a-03, 03a-05 | Commit-confirm barrier requires user confirmation before irreversible actions | ✓ SATISFIED (core seam; UI deferred per D-3a-01) | `waiting-for-permission` phase + `onInputRequired` pause seam + abort-wins test; Phase-8 TOL-03 re-map note in REQUIREMENTS.md |

**Orphaned requirements:** None. All five AGT IDs claimed by plans exist in REQUIREMENTS.md and map to Phase 3a with evidence. No REQUIREMENTS.md ID is unclaimed by any plan.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None found | — | — |

No TBD/FIXME/XXX/HACK/PLACEHOLDER markers in any phase-modified source or test file. No stub patterns (`return null`, `not implemented`, hardcoded-empty returns) in the orchestrator/verifier/checkpoint/renderer/harness. No 'tool_result' in CACHED_KINDS. No second declaration of the C.1 types.

### Human Verification Required

None. All five success criteria are behavior-dependent and every transition/invariant is exercised by a passing behavioral test in the verifier's own runs:
- Trajectory transitions + cap: `AgentOrchestrator.trajectory.test.ts` (a)/(b) — exact phase sequence asserted.
- Rollback: `CheckpointRecorder.test.ts` + `AgentOrchestrator.replan.test.ts` (a) — restore→replan→rerun path asserted.
- Evidence gate / partial semantics: `OutcomeVerifier.test.ts` + `RendererService.evidence.test.ts` + hook D-3a-19 tests.
- Replan boundedness / never-nested / abort: `AgentOrchestrator.replan.test.ts` (b)-(e).
- False-completion guard: `RendererService.evidence.test.ts` + full 527-test suite green.

### Gaps Summary

No gaps found. The phase goal is achieved:
1. **Budgeted** — trajectory cap `plannerCap + toolCap + 1` force-terminates pathological loops as `partial`/`trajectory_cap_exceeded`; transitions validated against the canonical table (behaviorally proven).
2. **Rollback-capable** — CheckpointRecorder opId-keyed loop-state capture/restore wired into the orchestrator around every tool execution (behaviorally proven).
3. **Evidence-gated** — buildOutcome is the sole terminal authority; a side-effecting tool is never `done`/`completed` without matching ok:true evidence; cap exhaustion is `partial`, never `completed`; the renderer guard closes the false-completion hole (behaviorally proven).
4. **Bounded replanning** — one replan per failed tool, plannerCalls bounded by plannerCap, trajectory cap ceiling, no nested replans, planner failure never re-invokes; abort wins mid-wait/mid-replan (behaviorally proven).
5. **User-confirmation seam** — `waiting-for-permission` + pause seam shipped; commit-confirm UI correctly deferred to Phase 8 per D-3a-01 with REQUIREMENTS.md re-map recorded.

---

_Verified: 2026-08-12T00:45:00Z_
_Verifier: the agent (gsd-verifier)_
