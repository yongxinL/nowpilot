---
phase: 03a-agent-reliability-and-evidence
plan: 03
type: execute
wave: 3
depends_on: ["03a-01", "03a-02"]
files_modified:
  - src/core/ai/AgentOrchestrator.ts
  - src/core/ai/RendererService.ts
  - tests/core/ai/trajectory/AgentOrchestrator.trajectory.test.ts
  - tests/core/ai/trajectory/AgentOrchestrator.replan.test.ts
  - tests/core/ai/RendererService.evidence.test.ts
autonomous: true
requirements: [AGT-01, AGT-02, AGT-03, AGT-04, AGT-05]
must_haves:
  truths:
    - "src/core/ai/AgentOrchestrator.ts: `runAgentTurn` returns `AgentTurnOutcome` (C.1) — NOT the Phase-3 `AgentTurnOutput`. The D-20 fence comment inverts: the orchestrator now owns the reliability machinery (trajectory transitions + OutcomeVerifier + CheckpointRecorder). `streamedText` is no longer in the output struct — it travels via `onStreamDelta` (D-3a-18)."
    - "Trajectory transitions (AGT-01): the loop emits a transition at each stage boundary via the LEGAL_TRANSITIONS/transitionPhase table from harness.ts (03a-01); an illegal transition throws AGENT_STATE_INVALID (C5). The trajectory recorder is an optional `onTransition?: (state: AgentTrajectoryState) => void` input-only callback on AgentTurnInput (D-3a-16 precedent mirrors onStreamDelta) — direct calls, not an event bus (L1)."
    - "Trajectory cap (D-3a-10): a hard ceiling `trajectoryCapFor(tier) = plannerCap + toolCap + 1` (research A3 slack) force-terminates with status 'partial' + reasonCode 'trajectory_cap_exceeded' on exceed — guards pathological loops; deterministic and tested."
    - "Replan-on-tool-failure (D-3a-11, AGT-04): when `result.ok === false && result.error?.retryable === true`, the loop re-invokes the planner ONCE with failure feedback appended as an F-4 sections-in `tool_result` PromptSection (`{ kind:'tool_result', stable:false }`) — NEVER a joined-string rebuild (Pitfall 7). Planner-side failures keep the existing planner_failed fallback (no re-invocation). Replan is retry layer 2 of exactly three, never nested (R-2, L3)."
    - "Repeated-identical terminal (D-3a-12): identical failure = same toolName + same error code (D-3a-12). After one replan, an identical failure is terminal ⇒ status 'failed' + reasonCode 'replan_identical_failure' (or 'partial' under cap) — never a silent success. The replan guard is keyed per toolName (a `Set<string>` — 'one replan per failed tool', not a turn-level boolean). Each replan consumes `plannerCalls++` bounded by `input.tier.plannerCap` (D-3a-13)."
    - "Checkpoint seam (D-3a-09): before each ExecutorService.execute, `checkpoint.capture(opId, { toolResults, plannerCalls, toolCalls, phase })`; on a retryable tool failure the loop restores the captured state (discarding the failed result) before replanning. Loop-state rewind only — no side-effect compensation (Phase 8 TOL-05)."
    - "Pause seam (D-3a-15/16, AGT-05 core seam): AgentTurnInput gains optional `onInputRequired?: (q: { roleId; question; options?; reason: 'clarification' | 'permission' }) => void`. A stage emitting 'input-required' surfaces the trajectory phase 'waiting-for-permission' and pauses the turn WITHOUT terminating; abort cancels the wait (abort wins mid-wait). No UI, no gated tools (zero dangerous tools in 3a) — Phase 8 ships PermissionDialog + ToolCapabilityManifest (TOL-02/03)."
    - "Terminal authority (D-3a-05): the ORCHESTRATOR computes the terminal status via buildOutcome (03a-02) + the replan/trajectory/pause policy. OutcomeVerifier returns verdicts only ({ok, detail}); the renderer never independently re-verifies. verification_failed → status 'failed' + reasonCode 'verification_failed' (Open Q1 mapping, keeps C.1 4-value union). abort → AbortError propagates (O4, abort wins mid-verify/mid-replan)."
    - "Cap exhaustion (D-3a-07, AGT-03): caps.capHit ⇒ status 'partial' + reasonCode 'cap_exhausted' via buildOutcome — never 'completed'."
    - "Renderer evidence guard (D-3a-17): `RenderInput` gains `verdict` (the terminal status) + `evidence: CompletionEvidence[]`; RendererService never claims a side-effecting tool is 'done' without a matching ok:true evidence entry in the received set. Renderer is display-only — it never re-verifies or changes status."
    - "New test suites (required by §18): tests/core/ai/trajectory/AgentOrchestrator.trajectory.test.ts (healthy-turn transitions assembling→planning→rendering→completed + trajectory cap + illegal-transition + pause seam) and tests/core/ai/trajectory/AgentOrchestrator.replan.test.ts (replan fires once on retryable failure, repeated-identical terminal, plannerCap bound, never nested, abort mid-replan wins) + tests/core/ai/RendererService.evidence.test.ts (renderer never narrates done without ok:true evidence)."
  artifacts:
    - "src/core/ai/AgentOrchestrator.ts"
    - "src/core/ai/RendererService.ts"
    - "tests/core/ai/trajectory/AgentOrchestrator.trajectory.test.ts"
    - "tests/core/ai/trajectory/AgentOrchestrator.replan.test.ts"
    - "tests/core/ai/RendererService.evidence.test.ts"
  key_links:
    - "AgentOrchestrator imports AgentTurnOutcome/AgentTrajectoryState from '@/types/harness' (R-1), buildOutcome/Verifier from './OutcomeVerifier', CheckpointRecorder from './CheckpointRecorder', LEGAL_TRANSITIONS/transitionPhase from '@/types/harness'."
    - "runAgentTurn call sites migrate in 03a-04: useStreamingLLM.ts (hook) + tests/core/ai/AgentOrchestrator.test.ts + .budget.test.ts (O3 enumerated, NOT blanket rewrites). This plan changes the contract; 03a-04 fixes the consumers."
    - "The F-4 tool_result section is built via the contextHelper section-builder pattern (contextHelper.ts L60-85) or an orchestrator-local section — stable:false, sourceId e.g. 'replan-feedback'. It must survive ProviderRouter.joinSections (TASK_KINDS includes 'tool_result', 03a-01)."
    - "onStreamDelta + invocation remain the Phase-3 seams; onInputRequired + onTransition are the two new input-only seams (mirrors D-20 deviation precedent)."
  flagged_assumptions:
    - "AGT-01 [unclassified — manual review]: the healthy-turn transition sequence is assembled→planning→rendering→completed (2 model calls); the trajectory phase is carried to a terminal phase (completed/failed/partial/aborted) at finish — asserted by the trajectory test."
    - "AGT-02 [unclassified — manual review]: the evidence gate lives in the terminal buildOutcome path; a turn that executed a side-effecting tool WITHOUT evidence reaches verification_failed→'failed' (D-3a-06) — proven via a mock dangerous tool with no verifier registered in the replan/trajectory suite."
    - "AGT-04 [unclassified — manual review]: 'repeated identical failure' is identified by (toolName, error.code) tuple equality across the pre/post-replan executions (D-3a-12); 'never nested' is enforced by the per-tool replan Set guard + plannerCap bound."
    - "AGT-05 [unclassified — manual review]: the pause seam is a core seam only — the 'waiting-for-permission' trajectory phase is reachable via onInputRequired and the turn stays open; Phase 8 wires the UI dialog (D-3a-15/16)."
    - "A1 [research]: verification_failed → status 'failed' + reasonCode 'verification_failed' (C.1 union kept verbatim)."
    - "A2 [research]: the F-4 tool_result section lands in TASK_KINDS (both ProviderRouter + StructuredOutput) — proven green in 03a-01."
    - "A3 [research]: trajectory cap = plannerCap + toolCap + 1."
    - "Open Q3 [research]: RenderInput gains verdict + evidence (renderer stays a pure consumer)."
    - "Open Q4 [research]: trajectory observability = the onTransition input-only callback (mirrors onStreamDelta)."
  prohibitions:
    - "No AgentTurnOutput in the return type (D-3a-18 — AgentTurnOutcome only; streamedText via onStreamDelta)."
    - "No event bus / emitter for trajectory transitions (L1 — direct calls only; StageEvent is a TYPE)."
    - "No nested replan (R-2/L3): no replan on planner failure; at most one replan per failed tool; replan consumes plannerCalls++ under plannerCap."
    - "No joined-string replan feedback (Pitfall 7 — F-4 tool_result PromptSection, stable:false)."
    - "No side-effect compensation in rollback (D-3a-09 — Phase 8 TOL-05)."
    - "No renderer double-verification (D-3a-05/17 — display-only; never changes status)."
    - "No durable checkpoint/trajectory persistence (§17.7.7 — in-memory per-turn)."
    - "No free-form error strings (GR-9) — every catch logs via debugLog with a canonical code (AGENT_STATE_INVALID / TOOL_POSTCONDITION_FAILED / COMPLETION_EVIDENCE_MISSING / PLANNER_FAILED / STREAM_FAILED)."
    - "No gated tools / permission UI in 3a (zero dangerous tools — Phase 8 TOL-02/03)."
---

<!-- 03a-03 (2026-08-11): THE REWIRE. runAgentTurn returns AgentTurnOutcome (D-3a-18, D-20
     fence inversion), embeds trajectory transitions (AGT-01), the checkpoint seam (D-3a-09),
     replan-on-tool-failure with an F-4 tool_result section (D-3a-11/12/13, AGT-04), the pause
     seam (D-3a-15/16, AGT-05), and the buildOutcome terminal (D-3a-05/06/07). Renderer gains
     the evidence-aware guard (D-3a-17). Enumerated test migration is in 03a-04 (O3). -->

Purpose: This is the §18 'AgentOrchestrator integration' + 'Renderer completion guard' deliverable. It rewires the Phase-3 Appendix-I loop (D-20 fence inversion) so every agent run is budgeted (trajectory cap), rollback-capable (CheckpointRecorder), evidence-gated (buildOutcome terminal), and bounded-replanning (AGT-04) — while preserving the 2-call/healthy-turn cost truth (verifier is deterministic, replan only on tool failure). The pause seam is the core of the AGT-05 commit-confirm barrier; the renderer guard closes the false-completion hole (R-8).
Output: Rewired runAgentTurn (AgentTurnOutcome return, trajectory transitions, checkpoint seam, replan policy, pause seam, buildOutcome terminal), evidence-aware RendererService, and the three new test suites green. The existing consumer tests break by design here — their enumerated migration is 03a-04 (O3).
<execution_context>
@/home/yongxin.Li/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/yongxin.Li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

### Tasks (ordered — do not reorder; each maps to a truth/artifact)
1. **Swap the return type to AgentTurnOutcome + invert the D-20 fence.** Read src/core/ai/AgentOrchestrator.ts (current, L1-211) + PRODUCT_SPEC_v0_1.md C.1 AgentTurnOutcome (L4830-4837) + 03-CONTEXT.md D-20 (spec addendum ~L2657). Replace `AgentTurnOutput` with `AgentTurnOutcome` in the interface + return type; delete the `streamedText` field from the output path (deltas flow through onStreamDelta only). Update the file-header D-20 comment to the inverted fence (orchestrator OWNS the reliability machinery now). Import AgentTurnOutcome/AgentTrajectoryState from '@/types/harness'.
2. **Add the trajectory recorder seam + transitions.** Add `onTransition?: (state: AgentTrajectoryState) => void` to AgentTurnInput. At each stage boundary (assembling-context → planning → executing → verifying → rendering → terminal) emit `transitionPhase(prev, next)` + `input.onTransition?.({ operationId, phase: next, plannerCalls, toolCalls, updatedAt: Date.now() })`. Keep an in-loop `phase` variable. An illegal transition throws AGENT_STATE_INVALID (C5).
3. **Add the trajectory cap.** Implement `export function trajectoryCapFor(tier: TurnCaps): number { return tier.plannerCap + tier.toolCap + 1 }` in AgentOrchestrator.ts (D-3a-10, A3). At loop top, if `plannerCalls + toolCalls >= trajectoryCapFor(input.tier)` force-terminate with status 'partial' + reasonCode 'trajectory_cap_exceeded' (after rendering once with accumulated toolResults).
4. **Add the checkpoint seam + replan-on-tool-failure.** Import CheckpointRecorder. Before each ExecutorService.execute: `checkpoint.capture(input.operationId, { toolResults: [...toolResults], plannerCalls, toolCalls, phase })`. Track replans per tool in a `const replannedTools = new Set<string>()` keyed by toolName (D-3a-12 tuple identity — "at most one replan per failed tool", not a turn-level boolean). On `result.ok === false && result.error?.retryable === true && !replannedTools.has(result.toolName)`: restore the captured state (discard the failed result), append an F-4 `tool_result` PromptSection (`{ kind: 'tool_result', text: '<toolName> failed: <error.code>', tokens, stable: false, sourceId: 'replan-feedback' }`) to the planner input sections, `replannedTools.add(result.toolName)`, plannerCalls++, and re-invoke planOnce. On an identical failure (same toolName + same error.code) after that tool's replan → terminal status 'failed' + reasonCode 'replan_identical_failure'. Planner-side failures keep the existing planner_failed fallback — no replan (D-3a-11, R-2).
5. **Add the pause seam (AGT-05 core).** Add `onInputRequired?: (q: { roleId: string; question: string; options?: string[]; reason: 'clarification' | 'permission' }) => void` to AgentTurnInput. When a planner decision is `ask_clarification` OR a stage emits an input-required event, transition phase to 'waiting-for-permission', call `input.onInputRequired?.({ roleId: 'user', question, options, reason: 'clarification' })`, and WAIT (the turn stays open) — abort cancels the wait (abort wins mid-wait, O4). Do NOT terminate the turn on pause.
6. **Terminal via buildOutcome + the orchestrator decision authority.** At finish(): build the `caps` object `{ plannerCalls, toolCalls, capHit: <planner/tool/trajectory cap hit> }`, call `buildOutcome(input.operationId, toolResults, verifiers, caps, now)` (03a-02; verifiers keyed by toolName — the mock dangerous tool's verifier from tests/fixtures/trajectory.ts in tests, empty in production since 3a has zero dangerous tools), and map: buildOutcome status 'partial' → partial; 'failed' → if reasonCode 'postcondition_failed' then status 'failed' + reasonCode 'verification_failed' (Open Q1 mapping); else status 'failed' + the O.2 reasonCode. Replan-identical and trajectory-cap overrides as defined above. Return the AgentTurnOutcome. AbortError propagates from any stage (abort wins mid-verify/mid-replan).
7. **Extend RendererService with the evidence guard.** Read src/core/ai/RendererService.ts RenderInput (L40-54) + render() (L95-160). Add `verdict: string` + `evidence: CompletionEvidence[]` to RenderInput (Open Q3). Pass them into render(); assert in the render path that the renderer never narrates a side-effecting tool as 'done' without a matching `ok:true` evidence entry in the received set (display-only — it never re-verifies or changes status, D-3a-17). Thread verdict + evidence from the orchestrator's finish() call site.
8. **Create tests/core/ai/trajectory/AgentOrchestrator.trajectory.test.ts.** Mock PlannerService/ExecutorService/RendererService (the existing test pattern, AgentOrchestrator.test.ts L39-41). Prove: (a) a healthy turn (plan→answer) records the transition sequence assembling→planning→rendering→completed via onTransition and returns AgentTurnOutcome { status:'completed', evidence:[] }; (b) the trajectory cap force-terminates as 'partial' + 'trajectory_cap_exceeded' when the loop exceeds plannerCap+toolCap+1; (c) an illegal transition attempt surfaces AGENT_STATE_INVALID (or is prevented by the guarded loop); (d) the pause seam: an ask_clarification decision transitions to 'waiting-for-permission', calls onInputRequired, and the turn stays open until resumed/aborted (abort wins).
9. **Create tests/core/ai/trajectory/AgentOrchestrator.replan.test.ts.** Prove: (a) a retryable tool failure fires exactly ONE replan (planner invoked again with a tool_result section in the input), then a successful re-run completes; (b) a repeated-identical failure (same toolName + same error.code) after the replan is terminal → 'failed' + 'replan_identical_failure' — never a silent success; (c) plannerCalls never exceeds input.tier.plannerCap; (d) a planner-side failure (planOnce throws) keeps the planner_failed fallback — no replan; (e) abort mid-replan/mid-verify propagates AbortError.
10. **Create tests/core/ai/RendererService.evidence.test.ts.** Prove: (a) render with a verified ok:true evidence entry may describe the tool as done; (b) render with an empty/matching-less evidence set for a side-effecting tool does NOT narrate it as done (the guard fires / the output omits the done claim); (c) the renderer never changes the verdict or re-verifies (display-only, D-3a-17).
11. **Verify green.** Run `npx vitest run tests/core/ai/trajectory tests/core/ai/RendererService.evidence.test.ts` + `npx tsc --noEmit`. Grep-assert AgentOrchestrator.ts contains `AgentTurnOutcome`, `transitionPhase` (or LEGAL_TRANSITIONS usage), `trajectoryCapFor`, `CheckpointRecorder`, `buildOutcome`, `onInputRequired`; grep-assert RendererService.ts contains `evidence` in RenderInput. NOTE: the existing AgentOrchestrator.test.ts + budget.test.ts will FAIL here — that is EXPECTED (contract change); their migration is 03a-04 (O3, enumerated).

**Decision-coverage citations (tasks above implement):** D-3a-05 (orchestrator sole terminal authority — verdict/status/reasonCode mapping in finish()), D-3a-09 (checkpoint capture/restore around each tool execution), D-3a-13 (replan consumes plannerCalls++, bounded by plannerCap), D-3a-14 (render once at end via finish(); replan iterations are loop iterations), D-3a-15 (core seam only — waiting-for-permission state + pause seam, no UI/gated tools), D-3a-16 (input-only onInputRequired callback mirroring onStreamDelta; turn stays open; abort wins), D-3a-18 (runAgentTurn returns AgentTurnOutcome; streamedText via onStreamDelta).

### Edge Coverage Assumptions (specless probe fallback — 6 edges, ALL unresolved, surfaced not dropped)

This plan owns the AGT-01 (trajectory transitions, cap), AGT-02 (evidence-gated completion in the loop), AGT-04 (replan boundedness + abort), and AGT-05 (pause seam) edges. Every unresolved probe item is surfaced as a flagged_assumption above and proven by the three new test suites. The AGT-03 hook-mapping edge is owned by 03a-04. None are silently dropped.

### Artifacts This Phase Produces
- src/core/ai/AgentOrchestrator.ts: `trajectoryCapFor()` export, AgentTurnInput gains `onTransition?` + `onInputRequired?`, `runAgentTurn` → AgentTurnOutcome, in-loop trajectory transitions, checkpoint seam, replan-on-tool-failure (F-4 tool_result section), pause seam, buildOutcome terminal mapping, D-20 fence inverted.
- src/core/ai/RendererService.ts: RenderInput gains `verdict` + `evidence`, evidence-aware done-narration guard.
- tests/core/ai/trajectory/AgentOrchestrator.trajectory.test.ts (new): transitions/cap/illegal/pause.
- tests/core/ai/trajectory/AgentOrchestrator.replan.test.ts (new): replan policy + abort.
- tests/core/ai/RendererService.evidence.test.ts (new): evidence-aware renderer guard.
<threat_model>

### Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Planner decision → Executor → verifier → terminal | Only the orchestrator computes the terminal status; verifier returns verdicts, renderer displays — no double-verification (D-3a-05/17) |
| Replan feedback → planner input | Failure feedback is an F-4 sections-in tool_result section (never raw tool text as instructions — trust-tagging is Phase 4b); content is the typed error code/message, minimal |
| Pause seam → user | waiting-for-permission surfaces input-required without terminating; abort cancels the wait (O4) |

### STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-03a-03-01 | Spoofing | Terminal status computation | high | mitigate | Orchestrator sole authority (D-3a-05); buildOutcome fail-closed (D-3a-06); cap ⇒ 'partial' verbatim (AGT-03); repeated-identical failure terminal (D-3a-12) |
| T-03a-03-02 | DoS | Replan / trajectory explosion | high | mitigate | At most one replan per tool; plannerCalls bounded by plannerCap; trajectory cap force-terminates (D-3a-10/13); L3 never-nested (R-2) |
| T-03a-03-03 | Tampering | Replan feedback prompt section | medium | mitigate | F-4 tool_result section is stable:false + in TASK_KINDS (never CACHED_KINDS — cache-stability); content = typed error code/message, not raw tool output (minimal surface); full trust-tagging deferred to Phase 4b (TRUST-01) |
| T-03a-03-04 | Spoofing | Renderer done-narration | high | mitigate | Evidence-aware guard: no 'done' claim without matching ok:true evidence (D-3a-17, R-8); renderer display-only |
| T-03a-03-05 | Information Disclosure | debugLog of evidence/replan feedback | medium | mitigate | TraceRedactor on any debugLog path (R-10); evidence in-memory per-turn, never persisted (C4) |
</threat_model>
<success_criteria>
- tsc --noEmit green; the three new suites green.
- runAgentTurn returns AgentTurnOutcome (not AgentTurnOutput); D-20 fence comment inverted.
- Healthy turn: transition sequence assembling→planning→rendering→completed + exactly 2 model calls (verified by trajectory test (a) and the 03a-04 migrated cost test).
- Cap exhaustion ⇒ 'partial'/'cap_exhausted' (never 'completed'); trajectory cap ⇒ 'partial'/'trajectory_cap_exceeded'.
- Replan fires once on retryable tool failure with an F-4 tool_result section; repeated-identical failure is terminal 'failed'/'replan_identical_failure'; plannerCalls ≤ plannerCap; planner failure keeps planner_failed (no replan).
- Pause seam reaches 'waiting-for-permission', turn stays open, abort wins.
- Renderer never narrates a side-effecting tool as done without matching ok:true evidence.
</success_criteria>
