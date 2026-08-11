---
phase: 03a-agent-reliability-and-evidence
plan: 04
type: execute
wave: 3
depends_on: ["03a-03"]
files_modified:
- src/components/pages/useStreamingLLM.ts
- tests/components/pages/useStreamingLLM.test.tsx
- tests/core/ai/AgentOrchestrator.test.ts
- tests/core/ai/AgentOrchestrator.budget.test.ts
autonomous: true
requirements: [AGT-03]

<!-- 03a-04 (2026-08-11): the enumerated consumer migration (O3) + the honest partial mapping
     (D-3a-19). AgentTurnOutput→AgentTurnOutcome shape flip in the hook and the two existing
     orchestrator suites; the D-20 fence test INVERTED; reasonCode→status semantics in the
     budget suite. Never blanket rewrites — enumerated deltas only. -->

must_haves:
truths:
- "src/components/pages/useStreamingLLM.ts consumes `runAgentTurn`'s new `AgentTurnOutcome` (D-3a-18): it reads `result.status` instead of `result.reasonCode`-as-terminal. The honest partial mapping (D-3a-19): `completed → { state:'completed' }`; `partial → { state:'failed' }` (partial text retained + Retry); `failed → { state:'failed' }`; `aborted → { state:'idle' }`. `provider_unconfigured` stays a failed terminal (unchanged UX)."
- "The D-20 fence test (tests/core/ai/AgentOrchestrator.test.ts L358-362, `expect(src).not.toMatch(/CompletionEvidence|OutcomeVerifier|trajectory/)`) is INVERTED: it now asserts the orchestrator source DOES reference the reliability machinery (the fence 3a inverts) — or is replaced by the new behavior tests. It must NOT silently rot (Pitfall 1)."
- "tests/core/ai/AgentOrchestrator.test.ts shape assertions migrate from `AgentTurnOutput` to `AgentTurnOutcome`: `output.streamedText` reads removed (text arrives via onStreamDelta), `output.toolResults` removed from the output struct, `output.reasonCode` assertions replaced by `output.status` (+ reasonCode where meaningful). Enumerated deltas only — no blanket rewrite (O3)."
- "tests/core/ai/AgentOrchestrator.budget.test.ts reasonCode assertions migrate to status semantics: `{ reasonCode: 'success' }` → `{ status: 'completed' }` (the CR-01 regression the suite guards stays — a legitimate medium-tier 2-tool turn completes with an answer, renderer runs, retry budget intact)."
- "tests/components/pages/useStreamingLLM.test.tsx covers D-3a-19 explicitly: a cap-exhausted turn (partial) surfaces as 'failed' (partial text retained) — never 'completed'; an aborted turn surfaces as 'idle'; a completed turn surfaces as 'completed'."
artifacts:
- src/components/pages/useStreamingLLM.ts
- tests/components/pages/useStreamingLLM.test.tsx
- tests/core/ai/AgentOrchestrator.test.ts
- tests/core/ai/AgentOrchestrator.budget.test.ts
key_links:
- "useStreamingLLM.ts L152-192 currently maps result.reasonCode → ChatStreamState; the rewire reads result.status (D-3a-19). ChatStreamState (idle/streaming/completed/failed/offline, L55-60) is unchanged — only the mapping source changes."
- "AgentOrchestrator.test.ts asserts AgentTurnOutput at L127-132/245-250 (shape) + L358-362 (D-20 fence); budget.test.ts asserts reasonCode at L139-145/168-173/207-210 — these are the enumerated deltas."
- "The D-17 provider-error classification path (budget suite) is untouched by 3a — only the outcome-shape assertions change."
flagged_assumptions:
- "AGT-03 [boundary — manual review]: the hook surfaces 'partial' as failed (honest non-completion, partial text + Retry) — no new UI surface in 3a (RICH stage indicators are Phase 7); the mapping is wired now, the rich presentation later."
- "A1 [research]: verification_failed → status 'failed' + reasonCode 'verification_failed' — the hook treats it as failed (covered by the 'failed' branch of D-3a-19)."
- "O3 [research]: the three existing test files are migrated as ENUMERATED deltas (shape flip, fence inversion, status semantics) — never blanket-rewritten; every other assertion in those files is preserved."
- "Pitfall 3 [research]: the budget suite's cap assertions flip from reasonCode 'planner_cap_reached'/'tool_cap_reached' to status 'partial' + 'cap_exhausted' where the suite exercises cap exhaustion."
prohibitions:
- "No new UI surface / no stage indicators (RICH is Phase 7 — the mapping is status→state only, D-3a-19)."
- "No blanket rewrite of the three test files (O3 — only the enumerated shape/fence/status assertions change)."
- "No silent removal of the D-20 fence test (Pitfall 1 — it must be inverted or replaced, never left asserting the old contract)."
- "No 'completed' surfacing for a partial turn (AGT-03 honesty — partial must map to failed)."
- "No free-form error strings (GR-9) — the hook's debugLog uses classifyProviderError codes as today."
- "No streamedText re-added to any output struct (D-3a-18 — text travels via onStreamDelta)."

Purpose: 03a-03 changed the contract; this plan fixes every consumer with enumerated deltas so the phase stays honest end-to-end. The hook's D-3a-19 mapping is the user-visible half of AGT-03 (partial is surfaced as failed, never completed). The D-20 fence inversion and the AgentTurnOutput→AgentTurnOutcome shape flips keep the two existing orchestrator suites meaningful — they are migrated, not discarded (O3, Pitfall 1).
Output: useStreamingLLM.ts reads AgentTurnOutcome.status; the three existing test files migrated to the new contract with the D-20 fence inverted and the honest partial mapping tested; full tests/core/ai/** + tests/components/** green again.
<execution_context>
@/home/yongxin.Li/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/yongxin.Li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

### Tasks (ordered — do not reorder; each maps to a truth/artifact)
1. **Update src/components/pages/useStreamingLLM.ts to read AgentTurnOutcome.status.** Read src/components/pages/useStreamingLLM.ts (L152-192) + src/core/ai/AgentOrchestrator.ts (03a-03 output shape). Replace the terminal mapping: after `const result = await runAgentTurn({...})`, map `result.status` per D-3a-19 — 'completed' → `{ state:'completed', operationId }`; 'partial' → `{ state:'failed', operationId }`; 'failed' → `{ state:'failed', operationId }`; 'aborted' → `{ state:'idle' }`. Keep the `provider_unconfigured` guard as a failed terminal (reasonCode check retained). Remove any streamedText/toolResults reads from the result.
2. **Invert the D-20 fence test.** Read tests/core/ai/AgentOrchestrator.test.ts L358-362. Change the assertion to assert the orchestrator source DOES reference the reliability machinery (e.g. `expect(src).toMatch(/AgentTurnOutcome|OutcomeVerifier|trajectory/)`) — OR remove this describe block in favor of the new behavior tests (03a-03). Do not leave it asserting the old contract.
3. **Migrate AgentOrchestrator.test.ts shape assertions (enumerated).** Read the full file. For each `runAgentTurn` result assertion: replace `output.streamedText` reads (deltas now flow via onStreamDelta), remove `output.toolResults` from output-struct assertions, flip `output.reasonCode === 'planner_cap_reached'/'tool_cap_reached'` to `output.status === 'partial'` (+ reasonCode 'cap_exhausted'), flip `output.reasonCode === 'planner_failed'` to `output.status === 'failed'` (+ reasonCode), flip `'provider_unconfigured'` to status 'failed' + reasonCode 'provider_unconfigured' (keep the guard semantic). Preserve ALL other assertions (cost-of-2-calls, onStreamDelta ordering, AbortError propagation, resolver-failure paths).
4. **Migrate AgentOrchestrator.budget.test.ts status semantics (enumerated).** Read tests/core/ai/AgentOrchestrator.budget.test.ts L139-145/168-173/207-210. Flip `{ reasonCode: 'success' }` expectations to `{ status: 'completed' }`. Preserve the CR-01 regression intent (renderer runs, streamText called once, generateObject counts, router retryCount 0/1) — only the outcome-shape assertions change.
5. **Extend tests/components/pages/useStreamingLLM.test.tsx with D-3a-19 mapping tests.** Read the existing hook test. Add: a cap-exhausted fixture turn (status 'partial') surfaces as `{ state:'failed' }` with partial text retained; an aborted turn surfaces as `{ state:'idle' }`; a completed turn surfaces as `{ state:'completed' }`; a 'failed' turn surfaces as failed.
6. **Verify green.** Run `npx vitest run tests/core/ai tests/components/pages/useStreamingLLM.test.tsx` + `npx tsc --noEmit`. Grep-assert useStreamingLLM.ts contains `result.status` (not a reasonCode-only terminal); grep-assert the D-20 fence test is gone or inverted (no `not.toMatch(/CompletionEvidence|OutcomeVerifier|trajectory/)`); assert the budget suite still asserts the renderer-ran/retry-budget invariants. Full tests/core/ai/** + tests/components/** green (the 03a-03 breakage is resolved here).

### Edge Coverage Assumptions (specless probe fallback — 6 edges, ALL unresolved, surfaced not dropped)

This plan owns the AGT-03 hook-mapping edge: partial surfaces as failed (never completed), aborted as idle. The boundary/precision probe items for AGT-03 are proven by the new hook tests + the migrated budget suite. The other edges remain owned by 03a-02/03. None are silently dropped.

### Artifacts This Phase Produces
- src/components/pages/useStreamingLLM.ts: status-based terminal mapping (D-3a-19).
- tests/core/ai/AgentOrchestrator.test.ts: D-20 fence inverted; AgentTurnOutput→AgentTurnOutcome shape flips; cap reasonCodes → partial status.
- tests/core/ai/AgentOrchestrator.budget.test.ts: reasonCode 'success' → status 'completed' (CR-01 regression preserved).
- tests/components/pages/useStreamingLLM.test.tsx: partial/failed/aborted/completed mapping tests.
<threat_model>

### Trust Boundaries

| Boundary | Description |
|----------|-------------|
| AgentTurnOutcome.status → ChatStreamState | The hook maps the honest terminal status to the UI state machine; 'partial' must never surface as completed (AGT-03, D-3a-19) |
| Test assertions → contract truth | The migrated suites must keep asserting the REAL invariants (cost, ordering, retry budget) — only the outcome-shape assertions change (O3) |

### STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-03a-04-01 | Spoofing | Hook status mapping | high | mitigate | D-3a-19 exhaustive mapping (partial/failed → failed, aborted → idle, completed → completed) tested; provider_unconfigured stays failed |
| T-03a-04-02 | Tampering | D-20 fence test | medium | mitigate | Inverted or replaced — never left asserting the old contract (Pitfall 1); verify greps assert the inversion |
| T-03a-04-03 | Tampering | Migrated test fidelity | medium | mitigate | Enumerated deltas only (O3); the CR-01 regression intent (renderer runs, retry budget intact) is preserved and re-asserted |
</threat_model>
<success_criteria>
- tsc --noEmit green; tests/core/ai/** + tests/components/** green (03a-03 breakage resolved).
- useStreamingLLM.ts maps status per D-3a-19: partial/failed → failed, aborted → idle, completed → completed; provider_unconfigured stays failed.
- D-20 fence test inverted or removed (no stale `not.toMatch(/CompletionEvidence|OutcomeVerifier|trajectory/)`).
- Budget suite asserts { status:'completed' } and still proves the CR-01 regression (renderer ran, streamText ×1, retryCount 0/1).
- New hook tests prove partial→failed (text retained), aborted→idle, completed→completed.
</success_criteria>
