# Phase 3a: Agent Reliability and Evidence - Context

**Gathered:** 2026-08-11
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes agent runs reliable and evidenced. It rewires the Phase-3 `runAgentTurn` (Appendix I verbatim, 03-CONTEXT D-20 fence) with the reliability machinery: in-memory **trajectory states** (AGT-01), a **deterministic OutcomeVerifier** producing **CompletionEvidence** for side-effecting tools (AGT-02), a structured **AgentTurnOutcome** where cap exhaustion is `partial` never `completed` (AGT-03), and a **bounded replan/terminal policy** (AGT-04). It also ships a minimal **CheckpointRecorder** (one-step loop-state rollback, folded into AGT-02) and the **core seam** for a commit-confirm barrier (trajectory `waiting-for-permission` state + within-turn pause seam) — the full confirmation UI defers to Phase 8 (TOL-02/03).

**Scope authority (G0):** Spec-authoritative. Phase 3a = the **four §28.2 AGT items** (AGT-01..04). REQUIREMENTS.md/ROADMAP list five (adding CheckpointRecorder as AGT-02 and commit-confirm as AGT-05) — this discussion reconciles them: **CheckpointRecorder folds into AGT-02** (rollback machinery), **AGT-05 commit-confirm barrier re-maps to Phase 8** (TOL-03 permission prompts / PermissionDialog, AI-07 precedent). REQUIREMENTS.md gets an AI-07-style re-map note. ROADMAP criterion #5 reduces to evidence/false-completion tests (which stay in 3a).

**Boundary notes:**
- **No side-effecting tools exist in 3a** — the only tool is read-only `get-provider-info`. Evidence/checkpoint/commit-confirm machinery is built generically and proven with test fixtures (mock dangerous tool + synthetic evidence).
- **No durable cross-session suspend/resume/rewind in v0.1** (§17.7.7): trajectory, evidence, and checkpoints are within-turn, in-memory only.
- **Cost truth preserved:** a healthy turn stays at 2 model calls (planner + renderer). The verifier is deterministic — zero model calls.
- **R-3:** AI runtime lives in Side Panel/Standalone only; nothing here touches the background SW.
</domain>

<decisions>
## Implementation Decisions

### Scope / Requirement Reconciliation (G0)
- **D-3a-01 [spec-authoritative 4-item scope]:** Phase 3a implements spec §28.2 AGT-01..04 only. REQUIREMENTS.md is updated with an AI-07-style note: CheckpointRecorder folds into AGT-02; AGT-05 commit-confirm re-maps to Phase 8 (TOL-03). ROADMAP criterion #5 reduces to evidence/false-completion tests (which stay in 3a).
- **D-3a-02 [CHECKPOINT_RECORDER under AGT-02]:** CheckpointRecorder is delivered as part of AGT-02 (rollback machinery), not as a separate numbered requirement. No new AGT id invented.

### Verifier & Evidence (AGT-02 / AGT-03 / D1 / D2 / D3 / D4)
- **D-3a-03 [deterministic verifier]:** `OutcomeVerifier.verify` is a pure postcondition check over `ToolExecutionResult` — Appendix O.2 verbatim. No model calls, no verifier PipelineStage, no extra tier cap, no persona injection. Healthy turn stays at 2 model calls (planner + renderer).
- **D-3a-04 [evidence gates tool-turns only]:** A pure-answer turn (no tools executed) is `completed` with `evidence: []`. Evidence is required only for turns that executed side-effecting tools. Matches O.2 `buildOutcome` (verifiers run only over `results`).
- **D-3a-05 [completion-gate layering]:** Verifier = verdict only (`{ok, detail}`). Orchestrator = sole terminal decision authority (`completed` | `verification_failed` | `waiting_for_permission` | `partial` | `aborted`). Renderer = display only — never independently re-verifies. One verdict, one authority, no double-verification, no renderer override.
- **D-3a-06 [fail-closed]:** Verifier throw, malformed evidence, or absent evidence for a side-effecting tool ⇒ `verification_failed` — never a silent `completed`. Safety invariant (R-8). Canonical codes: `TOOL_POSTCONDITION_FAILED`, `COMPLETION_EVIDENCE_MISSING`, `AGENT_STATE_INVALID`.
- **D-3a-07 [cap exhaustion = partial]:** `caps.capHit ⇒ status 'partial', reasonCode 'cap_exhausted'` — never `completed` (O.2 verbatim, AGT-03).

### CheckpointRecorder (AGT-02 / C2 / O2)
- **D-3a-08 [own module]:** `src/core/ai/CheckpointRecorder.ts` — co-located with the orchestrator, one file per responsibility (Phase-3 pattern).
- **D-3a-09 [loop-state rewind]:** Checkpoint captures the pre-tool loop state (toolResults list, plannerCalls, toolCalls, trajectory phase) keyed by `operationId`. Rollback = restore that state + discard the failed tool's result, then the failed tool is re-run once (AGT-04 interplay). **No side-effect compensation/inverse** — that is Phase 8 idempotency (TOL-05), explicitly out of scope for v0.1.
- **D-3a-10 [tier-derived trajectory cap]:** A hard trajectory-length ceiling derived from the tier caps (plannerCap + toolCap + slack, §1.4) force-terminates with a terminal reasonCode on exceed. Guards against pathological loops; deterministic and testable.

### Replan Policy (AGT-04)
- **D-3a-11 [replan on failed tool only]:** A replan fires when a tool **execution** fails (`result.ok === false` with a retryable error). The loop re-invokes the planner **once** with the failure feedback appended — as an **F-4 sections-in `tool_result` section**, never a joined-string rebuild. Planner-side failures keep the existing `planner_failed` fallback (§1.2, no re-invocation). Replan is retry layer 2 of exactly three — never nested (R-2).
- **D-3a-12 [repeated-identical identity]:** "Repeated identical failure" = same `toolName` + same error `code` (e.g. `TOOL_REJECTED` twice, or same `{code, retryable}` tuple). After one replan, an identical failure is terminal ⇒ `verification_failed`/`partial`, never a silent success.
- **D-3a-13 [replan counts vs plannerCap]:** Each replan consumes one `plannerCalls++` slot; the tier's `plannerCap` (§1.4: tiny 1, small 2, medium 3, large 5) is the hard bound. At most one replan per failed tool; never nested.
- **D-3a-14 [render once at end]:** After a successful replan the loop continues and the final answer renders **once** at `finish()` — accumulated `toolResults` (including failure feedback) drive the renderer. Replan iterations are loop iterations, not concurrency (abort wins mid-verify/replan).

### Commit-Confirm Barrier (AGT-05 → Phase 8, core seam only)
- **D-3a-15 [core seam only]:** 3a ships the trajectory `waiting-for-permission` state (already in the AGT-01 enum) + a **within-turn pause seam** in AgentOrchestrator (a stage may emit `input-required` → the turn pauses, surfaced as `waiting-for-permission` per §1.6.1-L2). **No UI, no gated tools** (3a has zero dangerous tools). Phase 8 ships the full barrier: PermissionDialog + ToolCapabilityManifest risk gating (TOL-02/03).
- **D-3a-16 [input-only seam]:** The pause seam is an optional input-only callback/signal on `runAgentTurn` (mirroring the `onStreamDelta` precedent) the hook can surface; the turn stays open, abort cancels it (abort wins mid-wait). Phase 8 wires the UI dialog to it. Deterministic, testable via fixture.
- **D-3a-17 [evidence-aware renderer guard]:** Renderer receives the terminal verdict + verified evidence set; it renders honestly and never narrates a side-effecting tool as "done" without matching evidence. Orchestrator owns the terminal decision; renderer is display-only (D3).

### Output Migration & Hook (C6)
- **D-3a-18 [return AgentTurnOutcome]:** `runAgentTurn` returns the C.1 `AgentTurnOutcome` (`{operationId, status, reasonCode, evidence, plannerCalls, toolCalls}`) — replacing the Phase-3 `AgentTurnOutput`. `streamedText` is already delivered via `onStreamDelta` → ChunkBuffer, so the output struct no longer carries it. **Documented D-20 fence inversion** (the Phase-3 addendum note at spec ~2657 is inverted by 3a).
- **D-3a-19 [honest partial mapping]:** The hook maps `AgentTurnOutcome.status` → `ChatStreamState`: `completed → completed`; `partial/failed → failed` (partial text retained + Retry); `aborted → idle`. No new UI surface in 3a (RICH stage indicators are Phase 7) — but the honest "partial = not completed" mapping is wired now.
- **D-3a-20 [types in harness.ts + Zod]:** `AgentTrajectoryState`, `AgentTurnOutcome`, and the extended `CompletionEvidence` live in `src/types/harness.ts` (extend lines 1-13 — the file header already declares 3a as the extension point; R-1). Zod-validated at the public boundary per GR-4 (fixtures exercise the schemas).

### the agent's Discretion
- Exact F-4 `tool_result` section shape for the replan feedback (researcher/planner picks the section kind/ordering consistent with 03-07's sections-in pattern).
- Trajectory transition events: whether the recorder emits via a callback/simple observer or is read after the turn — either is fine as long as transitions are observable to tests (C5: illegal transition throws `AGENT_STATE_INVALID`).
- Exact tier-derived trajectory-cap formula (plannerCap + toolCap + slack constant — pick a small deterministic slack).
- `verify:phase-3a` script shape — follow the §24 pattern (eslint + prettier + tsc + wxt build + vitest run + isolation check), targeting `tests/core/ai/trajectory/**` + `tests/core/ai/OutcomeVerifier.test.ts`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product spec (authoritative)
- `.planning/PRODUCT_SPEC_v0_1.md` §18 "Master Implementation Phases" — Phase 3a block (lines ~2666–2674): create/modify list (AgentTrajectoryState, OutcomeVerifier, CompletionEvidence, AgentTurnOutcome, AgentOrchestrator integration, Renderer completion guard), required tests, DONE-when (transitions, evidence, partial/cap behaviour, abort, false-completion tests pass). **Phase-3 addendum at ~2657 records the D-20 fence that 3a inverts** (D-3a-18).
- `.planning/PRODUCT_SPEC_v0_1.md` §28.2 "Agent reliability requirements" (lines ~3924–3929) — AGT-01..04 canonical text: trajectory states, evidence-required success, structured outcome with partial-on-cap, deterministic replan/terminal policy.
- `.planning/PRODUCT_SPEC_v0_1.md` §1.6.1 "Stage events, human-in-the-loop, and retry bounds" (lines ~398–409) — L1 typed StageEvent union, L2 within-turn input-required → `waiting-for-permission`/`ask_clarification`, L3 three non-multiplying retry layers (AGT-04 replan is layer 2).
- `.planning/PRODUCT_SPEC_v0_1.md` §1.4 "tier caps" (~Chapter 1) — planner/tool caps table (tiny 1/1, small 2/1, medium 3/2, large 5/3) that bounds replan (D-3a-13) and the trajectory cap (D-3a-10).
- `.planning/PRODUCT_SPEC_v0_1.md` §1.2 "Planner/Executor/Renderer rules" (lines ~289–315) — ExecutorService determinism; Renderer "do not invent missing tool results"; the 2-call/turn cost truth (D-3a-03).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.1 "canonical types" — `AgentTrajectoryState` / `AgentTrajectoryPhase` (lines ~4809–4821), `CompletionEvidence` (lines ~4822–4829), `AgentTurnOutcome` (lines ~4830–4837); type home `@/types/harness` (line ~4798). `StageEvent` `input-required` union (lines ~4995–5007).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.2 "Error Code Registry" (lines ~5032–5060) — harness block: `AGENT_STATE_INVALID`, `TOOL_POSTCONDITION_FAILED`, `COMPLETION_EVIDENCE_MISSING` are already canonical; mirror into `src/core/error/errorCodes.ts` IN PLACE (GR-9).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix O.2 "OutcomeVerifier + CompletionEvidence (Phase 3a)" (lines ~6358–6393) — **the worked reference implementation** for `buildOutcome`; D-3a-03/05/06/07 are this code verbatim.
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix O intro phase→example map (lines ~6226–6244) — Phase 3a → O.2.
- `.planning/PRODUCT_SPEC_v0_1.md` §0.5 Golden Rules + §0.2 (lines ~65–226) — GR-4 (Zod + one repair), GR-9 (canonical error codes), R-2 (no nested retries), R-8 (no success without evidence).
- `.planning/PRODUCT_SPEC_v0_1.md` §17.7.7 — durable cross-session suspend/resume/rewind explicitly out of scope for v0.1 (trajectory/checkpoint in-memory only).

### Project planning artifacts
- `.planning/ROADMAP.md` — Phase 3a goal + success criteria (lines ~175–189); canonical phase order §18 (line ~418).
- `.planning/REQUIREMENTS.md` — AGT-01..05 (lines ~49–54). **3a updates this row per D-3a-01** (CheckpointRecorder → AGT-02; AGT-05 → Phase 8 re-map note, AI-07 precedent).
- `.planning/PROJECT.md` — core value, constraints, key decisions (Planner→Executor→Renderer, human-verified evolution, no banned packages).
- `.planning/phases/03-cost-effective-ai-runtime-persona-seed/03-CONTEXT.md` — **D-20** (verbatim Appendix I, 3a owns the rewire), **D-17** (retry layering), **D-02/D-08** (contextHelper + fixtures), **D-05** (closed-enum tool gate), **D-21** (error-emission half of PROVIDER_KEY_UNREADABLE). The Phase-3 §18 addendum (spec ~2657) is the source the 3a planner reads for the fence inversion.
- `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-CONTEXT.md` — WriteJournal/WriteTransaction precedent (crash-safe writes; rollback machinery analog), TraceRedactor (R-10).
- `AGENTS.md` — 10 golden rules, risk register (R-1..R-10), approved stack, architecture rules.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/ai/AgentOrchestrator.ts` — the Appendix-I bounded loop `runAgentTurn`; Phase 3a rewires its `finish()`/loop to return `AgentTurnOutcome`, insert trajectory transitions, replan-on-tool-failure, and the checkpoint seam. `capsForTier` / `TIER_CAPS` (§1.4) already exist here — the replan budget (D-3a-13) and trajectory cap (D-3a-10) read them.
- `src/core/ai/ExecutorService.ts` — deterministic accept/reject boundary; returns `ToolExecutionResult` with `{ok, error:{code, retryable}}`. The replan trigger (D-3a-11) keys off `ok === false` + retryable; the failed-tool identity (D-3a-12) reads `error.code`.
- `src/core/ai/RendererService.ts` — `render()` display-only; consumes `toolResults` + terminal verdict for the evidence-aware guard (D-3a-17). `RENDERER_MAX_TOKENS` already exported.
- `src/core/ai/StructuredOutput.ts` + `requestJson` (Appendix L) — the O.2 verifier's postcondition check can reuse structured-output patterns if a verifier needs parsing (keep deterministic).
- `src/core/ai/types.ts` — `ToolExecutionResult` (evidence field already typed per §C.1) and `PromptSection`; the F-4 sections-in replan feedback (D-3a-11) appends a section here, never a string join.
- `src/core/error/errorCodes.ts` + `debugLog.ts` — canonical registry; 3a extends IN PLACE with the harness block (`AGENT_STATE_INVALID`, `TOOL_POSTCONDITION_FAILED`, `COMPLETION_EVIDENCE_MISSING`).
- `src/types/harness.ts` — currently ships the minimal `CompletionEvidence` (lines 1-13) with an explicit header note that Phase 3a extends it (AgentTrajectoryState, AgentTurnOutcome). This is the R-1 home.
- `src/components/pages/useStreamingLLM.ts` — consumes `runAgentTurn`; 3a updates it to read `AgentTurnOutcome.status` (D-3a-19) and surfaces the honest partial mapping. `ChatStreamState` discriminated union already models idle/streaming/completed/failed/offline.
- `src/core/ai/contextHelper.ts` — Phase-4 deletion target; still the F-4 sections-in prompt builder for the replan feedback.

### Established Patterns
- **Appendix I verbatim + documented input-only seams** (D-20): `onStreamDelta` / `invocation` are the precedent for the pause seam (D-3a-16) and trajectory observability.
- **F-4 sections-in:** prompt assembly is PromptSection[] end-to-end — replan feedback must append a section, never rebuild a joined string (cache-stability).
- **Golden Rule 9:** every catch logs via `debugLog` with a canonical §C.2 code; new codes canonicalized into spec Appendix C.2 before shipping.
- **GR-4 / Zod fixtures:** every public boundary has a Zod fixture test (`tests/fixtures/optimizedContext.ts` precedent); 3a adds trajectory/evidence fixtures there (O1: shared mock dangerous tool + synthetic evidence + transition-assertion helper centralized in `tests/fixtures/`).
- **Determinism / no event bus:** StageEvent is a TYPE only (§1.6.1) — trajectory transitions are direct calls, not a runtime event system.
- **R-10:** evidence/details may carry sensitive values — TraceRedactor on any debugLog path; never log raw tool bodies.

### Integration Points
- `runAgentTurn` call sites: `useStreamingLLM.ts` (the hook) + `tests/core/ai/AgentOrchestrator.test.ts` + `tests/core/ai/AgentOrchestrator.budget.test.ts` — **03-06 test-migration delta must be enumerated, not blanket-rewritten** (O3): the `AgentTurnOutput` shape assertions flip to `AgentTurnOutcome`; the D-20 fence comment inverts.
- `src/core/ai/types.ts` → `src/types/harness.ts`: `ToolExecutionResult.evidence` and the new verdict types share the C.1 home (R-1); ai/types.ts imports, never re-declares.
- Tests: new `tests/core/ai/trajectory/**` + `tests/core/ai/OutcomeVerifier.test.ts` (required by §18); fixtures in `tests/fixtures/` (O1). Existing env: vitest + jsdom-align + threads pool; AI-layer tests use vi.mock stubs — no real provider calls.
- `verify:phase-3a` script in package.json (§24 pattern) gating the phase.

</code_context>

<specifics>
## Specific Ideas

- **Through-line (user):** keep the verifier deterministic (D1) and evidence-gating tool-turns only (D2) so Phase 3a preserves the **"2 model calls / healthy turn" cost truth** and stays a narrow safety guard, not a whole-turn tax.
- **C3 (streaming-honesty × evidence precedence):** verification is the OUTER gate — a render that stops but leaves a side-effecting tool unverified is `verification_failed` (not `completed`, and not the Pitfall-5 STREAM_FAILED error path — different concerns).
- **C5 (trajectory state machine):** concrete `AgentTrajectoryPhase` enum + legal transitions defined once in `harness.ts` (R-1); an illegal transition throws `AGENT_STATE_INVALID`.
- **C4 (evidence redaction/lifetime):** evidence is in-memory per-turn; TraceRedactor (R-10) applied if ever logged; NOT persisted (Phase 6 owns the durable trace via AITransactionLog).
- **C1 (postcondition source):** define the postcondition-ref shape on `ToolSchemaRef`/`harness.ts` now (verifierId placeholder); real per-tool postconditions arrive with the tool suite (TOL, Phase 8).
- **O4:** replan/verify are loop iterations, not concurrency; recorder keyed by operationId; abort wins mid-verify/replan.
- **O5:** reliability telemetry is debugLog-only in 3a — no counter store (Phase 6 owns counters, parallel to the AI-04 budget deferral).

</specifics>

<deferred>
## Deferred Ideas

- **AGT-05 commit-confirm barrier UI + permission gating** — Phase 8 (TOL-02/03, PermissionDialog, ToolCapabilityManifest risk). 3a ships only the `waiting-for-permission` trajectory state + input-only pause seam (D-3a-15/16).
- **Side-effect compensation / rollback idempotency** — Phase 8 (TOL-05 idempotency keys; O.5 worked example). 3a rollback is loop-state rewind only (D-3a-09).
- **Reliability telemetry counters / durable trace** — Phase 6 (AITransactionLog + DiagnosticsPanel; parallel to the AI-04 monthly-budget deferral D-16).
- **Trajectory/checkpoint persistence + cross-session suspend/resume** — v0.2+ (explicitly out of scope for v0.1, §17.7.7).
- **RICH stage indicators / trajectory UI** — Phase 7 (RICH-03); 3a surfaces only the honest partial mapping in the hook (D-3a-19).

None — discussion stayed within phase scope; all deferred items tracked above.

</deferred>

---

*Phase: 3a-Agent Reliability and Evidence*
*Context gathered: 2026-08-11*
