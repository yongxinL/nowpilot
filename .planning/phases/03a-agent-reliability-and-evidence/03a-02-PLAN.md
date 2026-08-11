---
phase: 03a-agent-reliability-and-evidence
plan: 02
type: execute
wave: 2
depends_on: ["03a-01"]
files_modified:
  - src/core/ai/OutcomeVerifier.ts
  - src/core/ai/CheckpointRecorder.ts
  - tests/core/ai/OutcomeVerifier.test.ts
  - tests/core/ai/trajectory/CheckpointRecorder.test.ts
autonomous: true
requirements: [AGT-02, AGT-03]
must_haves:
  truths:
    - "src/core/ai/OutcomeVerifier.ts ships the O.2 VERBATIM Verifier interface + buildOutcome (spec Appendix O.2 L6362-6393): `Verifier { postconditionId: string; verify(result: ToolExecutionResult<unknown>): Promise<{ ok: boolean; detail?: string }> }` and `buildOutcome(operationId, results, verifiers, caps) → Promise<AgentTurnOutcome>` — copy, do not re-derive (D-3a-03, R-1 imports CompletionEvidence/AgentTurnOutcome from '@/types/harness')."
    - "buildOutcome is deterministic — zero model calls, no verifier PipelineStage, no extra tier cap, no persona injection (D-3a-03): read-only tools (no verifier registered) are SKIPPED (`if (!v) continue`), so a pure-answer turn is `completed` with `evidence: []` (D-3a-04)."
    - "Cap exhaustion maps to `status 'partial'` + `reasonCode 'cap_exhausted'` — never `completed` (D-3a-07, AGT-03, O.2 L6387-6391: `caps.capHit ? 'partial' : sideEffectFailed ? 'failed' : 'completed'`). Any `!ok` evidence maps to `status 'failed'` + `reasonCode 'postcondition_failed'` (fail-closed, D-3a-06)."
    - "Evidence entries record `{ toolName, operationId, postconditionId: v.postconditionId, ok: outcome.ok, verifiedAt, detail }` — `verifiedAt` uses an injectable clock (`now: () => number = Date.now`) so tests stay deterministic (Pitfall 6, fixtures/index.ts determinism rule); the production default is Date.now."
    - "src/core/ai/CheckpointRecorder.ts ships an opId-keyed pre-tool loop-state store (D-3a-08): `capture(operationId, state)` / `restore(operationId)` over a Map, copying the captured LoopState (no shared references). LoopState = { toolResults, plannerCalls, toolCalls, phase } (D-3a-09). Rollback = restore that state + the orchestrator discards the failed tool's result — NO side-effect compensation/inverse (Phase 8 TOL-05, explicitly out of scope)."
    - "tests/core/ai/OutcomeVerifier.test.ts proves: (a) pure-answer turn (no tools) → status 'completed', evidence []; (b) side-effecting tool with matching ok:true evidence → 'completed'; (c) absent/!ok evidence for a side-effecting tool → 'failed' + reasonCode 'postcondition_failed'; (d) caps.capHit true → 'partial' + 'cap_exhausted' (never 'completed'); (e) read-only tool with no verifier registered → skipped, no evidence; (f) deterministic clock injection."
    - "tests/core/ai/trajectory/CheckpointRecorder.test.ts proves: capture/restore round-trip preserves the full LoopState (deep-copied — mutating the returned restore does not mutate the stored state); restore of a never-captured opId returns undefined; capture is keyed by operationId (two opIds do not collide)."
  artifacts:
    - "src/core/ai/OutcomeVerifier.ts"
    - "src/core/ai/CheckpointRecorder.ts"
    - "tests/core/ai/OutcomeVerifier.test.ts"
    - "tests/core/ai/trajectory/CheckpointRecorder.test.ts"
  key_links:
    - "OutcomeVerifier imports CompletionEvidence + AgentTurnOutcome from '@/types/harness' (R-1 — never re-declares; O.2 L6364)."
    - "buildOutcome's Verifier is keyed by toolName (O.2 L6380) — the same boundary the ExecutorService's ToolExecutionResult.toolName feeds (src/core/ai/types.ts L118-125); the mock dangerous tool's verifier fixture comes from tests/fixtures/trajectory.ts (03a-01)."
    - "CheckpointRecorder composes ProviderRouter's lazy Map pattern (L361/L769-786) + WriteJournal rollback machinery (WriteJournal.ts L28-33/L62-79) — opId-keyed, in-memory per-turn (C4, §17.7.7)."
    - "The orchestrator (03a-03) is the only runtime caller: capture before ExecutorService.execute, restore on retryable tool failure."
  flagged_assumptions:
    - "AGT-02 [unclassified — manual review]: the evidence gate applies to tool-turns only; this plan proves it via the buildOutcome 'read-only tools skipped' path and the empty-evidence pure-answer turn."
    - "AGT-03 [boundary — manual review]: status union is the 4-value C.1 enum; 'verification_failed' is NOT a status member — orchestrator maps it to status:'failed' + reasonCode (D-3a-05, Open Q1; proven at the orchestrator in 03a-03)."
    - "A1 [research]: verification_failed → status 'failed' + reasonCode 'verification_failed' (kept C.1 verbatim)."
    - "Open Q1 [spec gap]: the O.2 buildOutcome reference returns 'postcondition_failed' as reasonCode for !ok evidence — this is kept verbatim; the D-3a-06 vocabulary names it 'verification_failed' in prose; the reasonCode string in the OUTCOME is the O.2 value 'postcondition_failed'."
    - "Pitfall 6 [determinism]: the injectable `now` clock is the only deviation from O.2's verbatim body (default Date.now preserves production behavior)."
  prohibitions:
    - "No model calls / no verifier PipelineStage / no extra tier cap / no persona injection inside OutcomeVerifier (D-3a-03 — the 2-call/healthy-turn cost truth)."
    - "No cap-exhaustion → 'completed' mapping (D-3a-07, AGT-03 — must be 'partial')."
    - "No evidence for pure-answer turns (D-3a-04 — evidence only for turns that ran tools)."
    - "No side-effect compensation/inverse in CheckpointRecorder (D-3a-09 — Phase 8 TOL-05; rollback is loop-state rewind only)."
    - "No durable/session checkpoint persistence (C4, §17.7.7 — in-memory per-turn only)."
    - "No free-form error strings (GR-9): verifier failures surface via buildOutcome's structured verdict; the orchestrator (03a-03) logs the canonical codes."
    - "No real Date.now in test fixtures (Pitfall 6, fixtures determinism rule)."
---

<!-- 03a-02 (2026-08-11): OutcomeVerifier (O.2 verbatim buildOutcome) + CheckpointRecorder
     (D-3a-08/09). Deterministic verifier — zero model calls (D-3a-03); evidence gates
     tool-turns only (D-3a-04); cap exhaustion = partial, never completed (D-3a-07, AGT-03).
     CheckpointRecorder: opId-keyed pre-tool loop-state capture/restore, loop-state rewind only,
     no side-effect compensation (Phase 8 TOL-05). -->

Purpose: AGT-02/AGT-03 are realized here as the deterministic evidence machinery. buildOutcome is the single, spec-verbatim place where a turn's tool results become CompletionEvidence and a terminal status — keeping cap exhaustion honest ('partial' never 'completed') and side-effecting success evidence-gated (fail-closed). CheckpointRecorder delivers the one-step rollback capability (D-3a-09) the orchestrator rewires around in 03a-03.
Output: OutcomeVerifier.ts (O.2 verbatim buildOutcome + injectable clock), CheckpointRecorder.ts (opId-keyed LoopState capture/restore), and their unit tests green — proving the evidence/partial/cap/fail-closed behavior and the rollback round-trip independently of the orchestrator.
<execution_context>
@/home/yongxin.Li/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/yongxin.Li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

### Tasks (ordered — do not reorder; each maps to a truth/artifact)
1. **Create src/core/ai/OutcomeVerifier.ts (new).** Read PRODUCT_SPEC_v0_1.md Appendix O.2 (L6358-6393) + src/core/ai/types.ts ToolExecutionResult (L118-125) + src/types/harness.ts (03a-01). Implement the O.2 `Verifier` interface + `buildOutcome(operationId, results, verifiers, caps, now = Date.now)` verbatim. `now` defaults to `Date.now` and is used for `verifiedAt`. Import CompletionEvidence/AgentTurnOutcome from '@/types/harness' (R-1); import ToolExecutionResult from './types'.
2. **Create src/core/ai/CheckpointRecorder.ts (new).** Read ProviderRouter.ts Map lazy-init (L361, L769-786) + WriteJournal.ts rollback machinery (L28-33, L62-79) + src/core/ai/AgentOrchestrator.ts (current loop shape L88-155, pre-rewire — the LoopState fields are toolResults/plannerCalls/toolCalls/phase). Implement `export interface LoopState { toolResults: ToolExecutionResult<unknown>[]; plannerCalls: number; toolCalls: number; phase: string }` + `export class CheckpointRecorder { private readonly state = new Map<string, LoopState>(); capture(operationId, state): void; restore(operationId): LoopState | undefined }` — restore returns a deep-copied snapshot so callers never mutate stored state.
3. **Create tests/core/ai/OutcomeVerifier.test.ts (new).** Use tests/fixtures/trajectory.ts (03a-01) fixtures. Cover: pure-answer turn (no toolResults) → { status:'completed', evidence: [], reasonCode:'ok' }; side-effecting tool with ok:true verifier → 'completed' with evidence entry (postconditionId, ok:true, verifiedAt from injected clock); tool with !ok verdict → 'failed' + 'postcondition_failed'; caps.capHit:true → 'partial' + 'cap_exhausted' regardless of sideEffectFailed; read-only tool (no verifier keyed) → skipped (no evidence entry); inject a fixed `now` and assert verifiedAt equals it.
4. **Create tests/core/ai/trajectory/CheckpointRecorder.test.ts (new).** Prove capture/restore round-trip preserves toolResults/plannerCalls/toolCalls/phase; restore returns a copy (mutating it does not change the stored state); restore of an uncaptured opId → undefined; opId key isolation (capturing op-A does not affect op-B).
5. **Verify green.** Run `npx vitest run tests/core/ai/OutcomeVerifier.test.ts tests/core/ai/trajectory/CheckpointRecorder.test.ts` + `npx tsc --noEmit`; grep-assert OutcomeVerifier.ts contains `buildOutcome` and no `streamText`/`generateText`/`model` tokens (deterministic — zero model calls, D-3a-03); grep-assert CheckpointRecorder.ts contains `capture(` and `restore(`; no existing-suite regression.

**Decision-coverage citations (tasks above implement):** D-3a-04 (pure-answer turn → completed + evidence:[]; evidence gates tool-turns only), D-3a-05 (verifier = verdict only; orchestrator = sole terminal authority), D-3a-06 (fail-closed: verifier throw/absent evidence → verification_failed), D-3a-07 (capHit → partial/cap_exhausted, never completed), D-3a-08 (CheckpointRecorder own module at src/core/ai/CheckpointRecorder.ts), D-3a-09 (loop-state rewind capture/restore, no compensation — Phase 8 TOL-05).

### Edge Coverage Assumptions (specless probe fallback — 6 edges, ALL unresolved, surfaced not dropped)

This plan owns the AGT-02 (evidence-gated completion) and AGT-03 (partial-on-cap, precision) edges: the boundary probe items are proven by OutcomeVerifier.test.ts — absent/!ok evidence → failed, cap hit → partial (never completed), pure-answer → completed with empty evidence. The AGT-01/04/05 behavior edges (trajectory transitions, replan boundedness, commit-confirm seam) are owned by 03a-03 (orchestrator rewire). AGT-03's hook mapping edge is owned by 03a-04. None are silently dropped.

### Artifacts This Phase Produces
- src/core/ai/OutcomeVerifier.ts (new): `Verifier` interface, `buildOutcome()` (O.2 verbatim + injectable `now`).
- src/core/ai/CheckpointRecorder.ts (new): `LoopState` interface, `CheckpointRecorder` class (capture/restore over an opId Map).
- tests/core/ai/OutcomeVerifier.test.ts (new): evidence/partial/cap/fail-closed + clock determinism tests.
- tests/core/ai/trajectory/CheckpointRecorder.test.ts (new): round-trip/copy/key-isolation tests.
<threat_model>

### Trust Boundaries

| Boundary | Description |
|----------|-------------|
| ExecutorService result → buildOutcome | Tool execution results enter the verifier; only verified `ok:true` evidence authorizes a side-effecting 'completed' (R-8). Fail-closed: absent/!ok evidence ⇒ 'failed' (D-3a-06) |
| buildOutcome → AgentTurnOutcome | The terminal status/reasonCode is computed once here; the orchestrator (03a-03) is the sole consumer — no renderer/hook double-verification (D-3a-05) |

### STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-03a-02-01 | Spoofing | OutcomeVerifier.buildOutcome | high | mitigate | Deterministic postcondition code (zero model calls, no prompt to trick); read-only tools skipped; cap ⇒ 'partial' verbatim (D-3a-07); fail-closed on !ok (D-3a-06) |
| T-03a-02-02 | Tampering | verifiedAt clock | low | mitigate | Injectability only for tests; production default is Date.now; evidence is in-memory per-turn (C4) — no persistence to spoof |
| T-03a-02-03 | Tampering | CheckpointRecorder state | medium | mitigate | Deep-copied restore (callers cannot mutate stored snapshots); opId-keyed isolation; rollback is loop-state rewind only — no compensated side effects (D-3a-09, Phase 8 TOL-05) |
| T-03a-02-04 | Information Disclosure | evidence.detail | medium | mitigate | Evidence is never persisted; TraceRedactor applies on any debugLog path (R-10); no raw tool bodies logged (03a-03 owns the debugLog sites) |
</threat_model>
<success_criteria>
- tsc --noEmit green; OutcomeVerifier.test.ts + CheckpointRecorder.test.ts green; no existing-suite regression.
- buildOutcome is O.2 verbatim (grep-assert buildOutcome + no model-call tokens in OutcomeVerifier.ts).
- Cap exhaustion ⇒ { status:'partial', reasonCode:'cap_exhausted' } — proven by test (d).
- Side-effecting !ok/absent evidence ⇒ 'failed' — proven by test (c); read-only tool skipped, pure-answer ⇒ 'completed' + evidence:[] — proven by tests (a)/(e).
- CheckpointRecorder round-trip preserves LoopState, deep-copies on restore, isolates by opId, and returns undefined for uncaptured opIds.
</success_criteria>
