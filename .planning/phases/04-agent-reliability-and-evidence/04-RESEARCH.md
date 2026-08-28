# Phase 4: Agent Reliability and Evidence - Research

**Researched:** 2026-08-29
**Domain:** Agent harness reliability — trajectory state machine, CompletionEvidence, structured AgentTurnOutcome, deterministic replan/terminal policy (spec §28.2 AGT-01…04)
**Confidence:** HIGH (in-repo contract fully verified against spec Appendices C.1/O.2/I and Phase-3 code; design decisions flagged per provenance)

## Summary

Phase 4 makes the Phase-3 bounded loop (Planner → Executor → Renderer in `AgentOrchestrator.runAgentTurn`) **reliable and honest**: every turn emits a structured `AgentTurnOutcome`, a closed trajectory state machine tracks the turn, side-effecting success requires `CompletionEvidence`, and replanning follows a deterministic retry/terminal policy that never silently claims success. The entire contract is defined **in-repo**: canonical types live verbatim in `@/types/harness` (spec Appendix C.1), the OutcomeVerifier framework is the verbatim Appendix O.2 reference, and the loop is the existing Appendix I implementation in `src/core/ai/AgentOrchestrator.ts`. No new external packages are required.

**Key verified finding — two CONTEXT.md claims are inaccurate against the current tree and must be corrected by the planner:** (1) `ToolExecutionResult` does **NOT** already carry an `evidence` seam — `src/core/ai/types.ts:122-133` has no `evidence` field (grep for `CompletionEvidence` across `src/` returns zero hits); Phase 4 must add `evidence?: import('@/types/harness').CompletionEvidence` (the spec's canonical shape at spec 4334-4341 declares it). (2) The Phase-3 `AgentTurnOutput` (AgentOrchestrator.ts:90-101) also **dropped the `operationId` field** present in the spec's Appendix I shape (spec 5561-5566) — D-61's additive evolution re-adds it. **The current `verify:phase-4` gate is RED** (points at `tests/core/context`, which does not exist — vitest exits 1, verified by run); D-68 re-pointing is a hard prerequisite.

**Key design tension to resolve in planning:** AGT-04's "repeated identical failure is terminal" changes the semantics of existing test (b) (`planner_cap_reached`) — a `run_tool` mock that repeats the *same* tool name will now terminate with `failed` (repeated identity) before the planner cap is ever reached. The cap test must be re-scripted with *distinct* tool names per iteration. Abort handling also needs a decision: the phase's DONE-when ("abort produces `aborted`") implies `runAgentTurn` returns an `aborted` outcome instead of throwing `AbortError` — which changes the `useChatStreaming` consumer path and tests (e).

**Primary recommendation:** Follow the spec verbatim — C.1 types in `src/types/harness.ts` untouched, O.2 `buildOutcome` implemented as written, `ToolExecutionResult.evidence` added additively (spec 4339), trajectory tracker as a transition-table validator (C.1's flat snapshot shape makes type-level encoding awkward), and the replan/terminal policy encoded inside the existing loop with per-failed-tool replan budget + repeated-identity map keyed on `toolName` + stable error signal.

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-60 (`@/types/harness` canonical home):** Create `src/types/harness.ts` (or matching alias target) holding `AgentTrajectoryState`, `CompletionEvidence`, `AgentTurnOutcome` **verbatim from Appendix C.1** — the spec's single source of truth for these types. `ToolExecutionResult.evidence` (already declared as `import('@/types/harness').CompletionEvidence` in `src/core/ai/types`/toolSchemas) resolves against it. No parallel copy in `src/core/ai`. — **Reversibility:** `reversible` — rationale: a new module; moving types later is an import-path edit.
- **D-61 (Evolve `AgentTurnOutput` → `AgentTurnOutcome`, additive):** Phase 3's `AgentTurnOutput` (`streamedText` + `toolResults` + `reasonCode` in `AgentOrchestrator.ts`) is superseded by the Appendix C.1 `AgentTurnOutcome` (adds `operationId`, `status: 'completed'|'partial'|'failed'|'aborted'`, `evidence: CompletionEvidence[]`, `plannerCalls`, `toolCalls`). The existing fields are retained additively — `AgentTurnOutcome` gains the streamed answer as the turn's rendered output (or is composed with the existing return shape). Chat consumers (`useChatStreaming`) keep reading `streamedText`/`reasonCode`; no consumer breakage. — **Reversibility:** `costly` — rationale: changes the pipeline's public return contract consumed by both chat hooks; re-shaping later is a re-wire.
- **D-62 (Explicit trajectory tracker with closed transitions):** A dedicated `trajectory` module (mirroring the `tests/core/ai/trajectory/**` test dir) owns `AgentTrajectoryState` transitions per turn: `assembling-context → planning → waiting-for-permission → executing → verifying → replanning → rendering → completed|failed|aborted`. Transitions are asserted against the **closed state machine** (§28.2 AGT-01) — the tracker either validates a step against a transition table or records steps in a type-safe way that makes illegal transitions unrepresentable. It coexists with `ActiveStreamState` (§20.6, stream-level UI state) — the trajectory is turn-level agent evidence, the stream state is surface-level streaming UI; do NOT conflate them. — **Reversibility:** `reversible` — rationale: additive module; later phases surface it in diagnostics.
- **D-63 (Per-turn trajectory recorded, not persisted):** Each `runAgentTurn` builds its own `AgentTrajectoryState` record (operationId from the turn's OperationId, phase, `plannerCalls`, `toolCalls`, `updatedAt`) and it surfaces on/with the `AgentTurnOutcome`. No persistence to storage in Phase 4 (AITransactionLog is Phase 11) — trajectory is in-memory per turn, testable via the outcome's counters. — **Reversibility:** `reversible` — rationale: in-memory record; persistence later is additive.
- **D-64 (OutcomeVerifier ships the Appendix O.2 framework, zero registered verifiers):** `OutcomeVerifier.ts` implements the O.2 contract — `Verifier` interface (`postconditionId`, `verify(result)`) + `buildOutcome(operationId, results, verifiers, caps)` returning the `AgentTurnOutcome`. Phase 4 registers ZERO verifiers (matching D-46 zero tools; real tools + their postcondition verifiers land with owning phases / Phase 18). The framework is exercised by fixtures that inject `ToolExecutionResult`s with/without side effects. — **Reversibility:** `reversible` — rationale: additive framework; verifier registration later is a table entry.
- **D-65 (Renderer completion guard — no "Done" without evidence):** The Renderer path MUST NOT emit a completion/"Done" claim for any side-effecting tool result lacking matching `CompletionEvidence` (AGT-02 / risk R-8). Concretely: when assembling the final answer, if `toolResults` contains a side-effecting tool whose `ok` is true but `evidence` is absent, the renderer output is suppressed or flagged (`status: partial`/a guard reason), never a clean success. The guard is testable with an injected fake side-effecting result. — **Reversibility:** `costly` — rationale: sits inside the renderer completion path; relaxing later is a one-line change but the AGT-02 contract is the point of the phase.
- **D-66 (AGT-04 in the AgentOrchestrator loop, capped by tier caps):** Replanning follows the deterministic policy verbatim: at most **one replan per failed tool** within the tier's planner cap (§1.4); a **repeated identical failure** (same tool, same error identity), a **cap breach**, or an **abort** is terminal → `AgentTurnOutcome: partial` (cap exhaustion) or `failed` (repeated failure) or `aborted` (abort). Never a silent success. The loop's existing `plannerCalls`/`toolCalls` counters (already tracked in `runAgentTurn`) feed the cap checks; the policy keys repeated-failure identity off the tool name + a stable error signal. Retry layering stays bounded (§1.6.1: ProviderRouter §1.5 + AGT-04 replan + one per-stage retry, all under tier caps). — **Reversibility:** `costly` — rationale: modifies the core bounded loop; reverting to the Phase-3 single-pass loop later is a behavioral change.
- **D-67 (Replan exercises the framework, not real tools):** With zero registered tools (D-46), the replan path is exercised via injected `ToolExecutionResult`s in tests (a failing injected tool triggers one replan then terminal), exactly as the ExecutorService zero-tool contract is tested today. No fake tools are registered. — **Reversibility:** `reversible` — rationale: test-only exercise path; real replans arrive with real tools.
- **D-68 (Re-point `verify:phase-4` at the phase's own tests):** The package.json `verify:phase-4` script currently targets `tests/core/context` (Phase 5 territory, dir does not exist yet). Phase 4 re-points it to the §18 required tests — `tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts` (plus existing `tests/core/ai` if the AgentOrchestrator changes need the whole AI suite; keep the trajectory/OutcomeVerifier dirs mandatory). — **Reversibility:** `reversible` — rationale: package.json script edit.

### the agent's Discretion
- Exact `AgentTrajectoryState` tracking mechanism (transition-table validator vs type-level encoding) — either is fine as long as AGT-01 is asserted.
- How `streamedText` composes with the Appendix C.1 `AgentTurnOutcome` (field addition vs composed wrapper) — must keep `useChatStreaming` consumers working.
- `AgentTurnOutcome.status` mapping for the existing `configuration_required` / `ask_clarification` terminal reasons (they are legitimate terminal outcomes, not failures — planner's call to map them onto the closed status set without inventing new statuses).
- Whether the trajectory module lives in `src/core/ai/trajectory.ts` or a `src/core/ai/trajectory/` directory (mirror the test dir).
- Where `@/types/harness` physically lands (`src/types/harness.ts` vs `src/types/harness/index.ts`) — resolve against the existing `src/types/` layout.

### Deferred Ideas (OUT OF SCOPE)
- **ToolCapabilityManifest + registered postcondition verifiers** — Phase 18 (§28.5 / TOL-01, risk matrix, idempotency); Phase 4 ships the framework + evidence shape, zero registrations (D-64).
- **AITransactionLog + trajectory persistence** — Phase 11; Phase 4 keeps trajectory in-memory per turn (D-63).
- **Diagnostics panel surfacing trajectory / evidence** — Phase 11; the types are the future substrate.
- **ContextOptimizer / OptimizedContext / TokenBudget** — Phase 5 (which owns `tests/core/context` — do not mis-place Phase-4 tests there).
- **Trust-aware context + receipts** — Phase 7.
- **Real tools with verifier-able side effects** — owning phases; Phase 4 replan is framework-exercised via injection only (D-67).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGT-01 (P0) | Add explicit trajectory states: assembling-context, planning, waiting-for-permission, executing, verifying, replanning, rendering, completed, failed, aborted. | C.1 `AgentTrajectoryPhase` (10-value closed union, spec 4849-4852) + `AgentTrajectoryState` (spec 4854-4860) — verbatim quote in Code Examples. Loop integration points mapped (planner call → `planning`; run_tool → `executing`; failure → `replanning`; finish → `verifying`→`rendering`; terminal → `completed`/`failed`/`aborted`). Recommended transition table in Architecture Patterns. Tracker tests in `tests/core/ai/trajectory/**` per §18. |
| AGT-02 (P0) | Side-effecting success requires `CompletionEvidence`. Renderer must not claim execution without matching evidence. | Spec golden rule 8 (spec 214) + risk R-8 (spec 229). `CompletionEvidence` shape (spec 4861-4868). O.2 `Verifier`/`buildOutcome` (spec 6330-6361) verbatim. `ToolExecutionResult.evidence` canonical seam (spec 4339) — must be ADDED to `src/core/ai/types.ts` (verified absent). Renderer completion guard (D-65) — outcome-level status downgrade, testable with injected fake side-effecting result. |
| AGT-03 (P0) | Every turn produces a structured `AgentTurnOutcome`; cap exhaustion is partial, not successful. | C.1 `AgentTurnOutcome` (spec 4869-4876) verbatim; O.2 status rule `caps.capHit ? 'partial' : ...` (spec 6355-6356); §1.4 caps table (spec 354-359); C.1 comment "cap exhaustion => 'partial', never 'completed'". Abort must also yield an outcome (`aborted`) per DONE-when — consumer/test impact documented in Open Questions. |
| AGT-04 (P0) | Replanning follows a deterministic retry/terminal policy: at most one replan per failed tool within the tier's planner cap; a repeated identical failure, a cap breach, or an abort is terminal and yields a `partial` or `failed` `AgentTurnOutcome` — never a silent success. | AGT-04 verbatim (spec 3945). Retry-layering bound §1.6.1 (spec 414-419: exactly three layers, never nest). Loop counters `plannerCalls`/`toolCalls` already in `runAgentTurn` (AgentOrchestrator.ts:123-124). **Breaks existing test (b)** — repeated same-tool failure now terminates `failed` before planner cap (see Common Pitfalls P7). |

## Project Constraints (from CLAUDE.md)

No `AGENTS.md` exists in the repo (verified — `ls` negative). Project instructions come from `CLAUDE.md` (loaded). Actionable directives relevant to Phase 4:

- **Phase gates are binding:** a phase is DONE when `pnpm verify:phase-N` passes; Phase 4 must re-point its own gate (D-68) and never reorder phases (spec §18 order 1→19).
- **Strict mode ON with NP-STRICT ceiling 0:** new Phase-4 code must be strict-clean — zero `@ts-expect-error NP-STRICT` markers (enforced by `tests/core/strict/np-strict-ceiling.test.ts`, reads `package.json.NP_STRICT_CEILING` = 0). Never use bare `@ts-ignore`.
- **Zod for cross-boundary data:** message envelopes, storage shapes, API responses use Zod schemas. Harness types are TS interfaces in the spec (no Zod mandated); follow O.2 verbatim.
- **debugLog, not console.log:** use `debugLog(code, data)` (e.g. `ORCHESTRATOR_PLAN`, `ORCHESTRATOR_TOOL` patterns exist); TraceRedactor redacts secrets.
- **Fixture-driven tests:** extend `tests/core/ai/fixtures/` style; stage services stay REAL, providers are fixtures (D-48); planner scripted with `vi.spyOn` only where the zero-tool schema cannot emit `run_tool`.
- **MV3:** AI runs in UI contexts only — Phase 4 touches no background SW.
- **Path alias `@/*` → project root** (tsconfig.json:22-25, vitest.config.ts:11-13) — `@/types/harness` resolves to `src/types/harness.ts`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Trajectory state machine (AGT-01) | API/Backend (AI core loop) | — | Turn-level agent evidence produced inside `runAgentTurn`; owns no UI state (distinct from `ActiveStreamState` which is surface-level UI). |
| CompletionEvidence + OutcomeVerifier (AGT-02) | API/Backend (AI core) | — | Postcondition verification of tool results before they reach any renderer/UI (TOL-03); zero registered verifiers in Phase 4 (D-64). |
| Structured AgentTurnOutcome (AGT-03) | API/Backend (AI core) | Frontend Server / client hooks | The orchestrator's return contract; `useChatStreaming` consumes `streamedText`/`reasonCode` unchanged (D-61 additive). |
| Replan/terminal policy (AGT-04) | API/Backend (AI core loop) | — | Encoded inside the single bounded loop; the ONLY module allowed to enforce §1.4 caps (Appendix I rule). |
| Renderer completion guard (D-65) | API/Backend (AI core) | — | Outcome status downgrade before the answer is presented; no UI-layer enforcement (UI is Phase 15). |
| Stream-level UI state | Browser/Client | — | `ActiveStreamState` (§20.6) stays surface-level streaming UI — explicitly NOT the trajectory (D-62). |

## Standard Stack

Phase 4 adds **zero new dependencies** — the entire contract is in-repo (spec + Phase-3 code). Existing pinned stack, verified installed (`node -e` version probe, 2026-08-29):

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 5.8.3 (installed; `~5.8.2` in package.json) | Types + strict mode | Harness types, transition table, outcome unions — strict-clean required (ceiling 0). |
| Zod | 4.4.3 (installed; `^4.4.3`) | Runtime validation of cross-boundary shapes | Existing convention for closed enums (`PlannerDecisionSchema`, `StreamEventSchema`); `AgentTurnOutcome.status` is a closed union the same way. |
| Vitest | 3.2.7 (installed; `^3.0.0`) | Test runner | jsdom + chrome-mocks setup exists (`tests/setup.ts`); trajectory + OutcomeVerifier tests use the same infra. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new) | — | — | — |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-written transition-table validator | XState / dedicated FSM lib | Spec §1.6.1: "deliberately does not ship an event bus/emitter"; a dependency is banned-package risk (R-9) and overkill for a 10-state flat machine. |

**Installation:** none — `pnpm install` not required for this phase.

**Version verification:** `node -e "console.log(require('.../node_modules/{ts,vitest,zod}/package.json').version)"` → ts 5.8.3, vitest 3.2.7, zod 4.4.3 (2026-08-29, verified).

## Package Legitimacy Audit

**No external packages are installed by this phase** (pure in-repo TS changes + tests — D-60…D-68 introduce no dependencies). The Package Legitimacy Gate protocol is therefore not applicable:

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | No packages to audit |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────── runAgentTurn (AgentOrchestrator.ts, Appendix I loop) ──────────────────────────────┐
│                                                                                                                  │
│  input: {userInput, sessionId, operationId, tier(§1.4 caps), abortSignal, providerSecrets, persistTurn,           │
│          verifiers? (D-64 injection seam)}                                                                        │
│                                                                                                                  │
│  TrajectoryTracker (D-62/63)  ── enter() asserts closed transitions (AGT-01) ──► final AgentTrajectoryState       │
│       │                                                                                                           │
│  loop {                                                                                                           │
│    abort check ────────────► terminal: outcome status 'aborted' (DONE-when)                                       │
│    plannerCap check ───────► finish(capHit=true) ──► status 'partial' (AGT-03)                                    │
│    PlannerService.plan ────► 'answer'|'ask_clarification' ──► finish(reasonCode)                                  │
│    toolCap check ──────────► finish(capHit=true) ──► status 'partial'                                             │
│    ExecutorService.execute ─► ToolExecutionResult {ok, code, evidence?} ─┐                                        │
│         │ ok=true  ────────────────────────────────────────────────────────────┐                                  │
│         │ ok=false ─► failure policy (AGT-04):                                 │                                  │
│         │              • first failure  → record identity, enter 'replanning' → loop (one replan per tool)        │
│         │              • repeated identity (same toolName + same stable signal) → terminal 'failed'               │
│         │              • replan already consumed → terminal 'failed'                                              │
│  }                                                                                                                │
│       │                                                                                                           │
│  finish(reasonCode):  enter 'verifying' → OutcomeVerifier.buildOutcome (O.2, zero verifiers ⇒ evidence [])         │
│       │               → CompletionGuard (D-65): ok side-effecting result w/o result.evidence ⇒ status 'partial'    │
│       │               → enter 'rendering' → RendererService.render (fast tier, 512-token cap)                     │
│       │               → terminal 'completed'|'failed'|'aborted' → persistTurn once (D-45, never on abort)         │
│       ▼                                                                                                           │
│  return AgentTurnOutcome (C.1: operationId, status, reasonCode, evidence, plannerCalls, toolCalls                 │
│                          + additive D-61: streamedText, toolResults, trajectory)                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
  useChatStreaming (unchanged reads: output.reasonCode / output.streamedText — D-61 additive)
```

### Recommended Project Structure

```
src/
├── types/
│   └── harness.ts              # D-60: C.1 types verbatim (AgentTrajectoryState, CompletionEvidence, AgentTurnOutcome,
│                               #       future groups land here per the C.1 canonical-home table — do NOT split)
├── core/ai/
│   ├── OutcomeVerifier.ts      # D-64: O.2 verbatim (Verifier, buildOutcome) + VerifierRegistry (declare-now, empty)
│   ├── trajectory.ts           # D-62/63: TrajectoryTracker + TRAJECTORY_TRANSITIONS table (or trajectory/ dir)
│   ├── AgentOrchestrator.ts    # D-61/66: evolved return contract + failure/replan policy + guard + trajectory hooks
│   └── types.ts                # ADD evidence?: CompletionEvidence (+ keep existing fields) — spec 4339 seam
tests/
└── core/ai/
    ├── trajectory/             # §18 required: AGT-01 closed-machine transition tests
    ├── OutcomeVerifier.test.ts # §18 required: O.2 buildOutcome + guard tests
    └── AgentOrchestrator.test.ts  # extend cases (b)/(e); add replan/abort-outcome cases
```

### Pattern 1: Canonical types in `@/types/harness` (D-60)
**What:** `src/types/harness.ts` holds `AgentTrajectoryState`, `CompletionEvidence`, `AgentTurnOutcome` **verbatim** from Appendix C.1 — never a parallel copy in `src/core/ai`. The spec's canonical-home rule is mandatory (spec 4833: "Do not invent `@/types/collaboration`…") — the table (spec 4837) maps Reliability types to `@/types/harness`, `ToolExecutionResult` stays in `@/core/ai/types`.
**When to use:** For every type group in C.1's table across all future phases — Phase 4 claims the Reliability row only.
**Example:** verbatim quote in Code Examples (C.1, spec 4849-4876).

### Pattern 2: Closed trajectory state machine (D-62, AGT-01)
**What:** A `TrajectoryTracker` per turn that (a) asserts every `enter(phase)` against a transition table and (b) emits the final `AgentTrajectoryState` snapshot (operationId, phase, plannerCalls, toolCalls, updatedAt — D-63). **Recommended mechanism: transition-table validator** (data-driven `Record<AgentTrajectoryPhase, AgentTrajectoryPhase[]>` + runtime throw on illegal transition). The C.1 `AgentTrajectoryState` is a flat snapshot interface (single `phase` field, not a per-state discriminated union), so the type-level/type-state encoding would require restructuring the locked canonical type — the transition table fits the verbatim shape and is directly testable ([CITED: oneuptime.com/blog/post/2026-01-30…, dev.to/gabrielanhaia… — the table-data pattern is standard; type-level needs per-state union shapes]). The phase's discretion allows either; the table is the pragmatic fit.
**When to use:** In `runAgentTurn` — enter `planning` before each planner call, `executing` before `execute`, `replanning` on non-terminal tool failure, `verifying` at finish before buildOutcome, `rendering` during render, terminal on outcome. `assembling-context` is entered at turn start (no context assembly exists until Phase 5 — the state is recorded, not acted on). `waiting-for-permission` has no trigger in Phase 4 (permission gate is Phase 17) but must exist in the table (closed set).
**Example:** transition table in Code Examples.

### Pattern 3: OutcomeVerifier — Appendix O.2 verbatim (D-64)
**What:** `Verifier { postconditionId, verify(result) }` + `buildOutcome(operationId, results, verifiers, caps)` → `AgentTurnOutcome`. Status rule: `caps.capHit ? 'partial' : sideEffectFailed ? 'failed' : 'completed'`; reasonCodes `cap_exhausted`/`postcondition_failed`/`ok` (O.2 verbatim). Phase 4 registers ZERO verifiers — production `buildOutcome` returns `completed` (no cap hit) with `evidence: []`. A `VerifierRegistry` (register/unregister/getAll — mirror `ToolRegistry` in toolSchemas.ts) gives Phase 18 its registration point; `runAgentTurn` accepts an optional `verifiers?: Record<string, Verifier>` input override for test injection (mirrors the `providerSecrets` input pattern).
**When to use:** Called from `finish()` with the turn's accumulated `toolResults`, the registry/input verifiers, and `{ plannerCalls, toolCalls, capHit }`.
**Example:** verbatim quote in Code Examples (O.2, spec 6330-6361).

### Pattern 4: Renderer completion guard (D-65, AGT-02/R-8)
**What:** A deterministic outcome-level check at finish: for every result where `r.ok === true`, a verifier exists for `r.toolName` (verifier presence = side-effecting per TOL-03), AND `r.evidence === undefined` → the executor skipped the postcondition verifier (R-8) → the outcome is **never** `completed`; downgrade to `partial` with a guard reasonCode (e.g. `missing_evidence` — a reasonCode literal, not a §21.6 error code; O.2's reasonCodes are the precedent). Ordering recommendation: guard evaluates before/overrides buildOutcome's status so "never a clean success" holds unconditionally.
**When to use:** In `finish()` before the outcome is returned. With zero registered verifiers + zero tools the guard is vacuous in production — the DONE-when requires a test with an injected fake side-effecting result (`ok: true`, verifier registered via `input.verifiers`, `evidence` absent → status `partial`).
**Key prerequisite (verified discrepancy):** `ToolExecutionResult` must gain `evidence?: import('@/types/harness').CompletionEvidence` (spec 4339) — it does NOT exist in `src/core/ai/types.ts:122-133` today. The injected fake result carries no evidence; the guard reads it.
**Example:** guard sketch in Code Examples.

### Pattern 5: Deterministic replan/terminal policy (D-66/67, AGT-04)
**What:** Inside the existing loop, after `ExecutorService.execute` returns `ok: false`:
1. Compute a **stable failure identity** = `toolName` + stable error signal (`code` when present — e.g. `TOOL_REJECTED` — else a normalized error string). Do NOT key on the raw error message alone (unstable across provider versions).
2. If `failureIdentities[toolName]` already equals this identity → **repeated identical failure → terminal** `failed`.
3. Else if `replannedTools[toolName]` already set → **replan budget consumed → terminal** `failed`.
4. Else record identity, set `replannedTools[toolName]`, enter `replanning`, continue the loop (the next planner call IS the single replan).
Cap breach and abort remain terminal as today (`partial` / `aborted`). Total planner/tool calls stay under §1.4 caps — the three retry layers never nest (§1.6.1, spec 414-419).
**When to use:** D-67 — with zero registered tools, exercised ONLY via tests mocking `ExecutorService.execute` (vi.spyOn) to return injected `ToolExecutionResult`s; production planner can never emit `run_tool` (zero-tool `z.never()` schema).
**Example:** policy sketch in Code Examples.

### Anti-Patterns to Avoid
- **Type-level state encoding for the trajectory:** the C.1 `AgentTrajectoryState` is a flat snapshot — restructuring it into per-state discriminated unions to make illegal transitions compile-time errors violates "verbatim from Appendix C.1" (D-60) and complicates the D-63 record. Use the transition-table validator.
- **Reusing `ActiveStreamState` as the trajectory:** §20.6 stream state is surface-level streaming UI (workerState.ts:22-42); the trajectory is turn-level agent evidence — conflating them breaks D-62's explicit separation.
- **Inventing statuses or error codes:** `AgentTurnOutcome.status` is closed to the 4 C.1 values; §21.6 codes stay closed (D-38). reasonCodes are descriptive literals (O.2 precedent) — do not export them as error-code constants.
- **Registering fake tools to exercise replan:** D-67 explicitly forbids fake tool registration — inject results via executor mocks instead.
- **Persisting trajectory:** D-63 — in-memory only; AITransactionLog is Phase 11.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Closed trajectory state machine | Ad-hoc `phase` string mutations in the loop | Transition-table validator in `src/core/ai/trajectory.ts` | AGT-01 requires illegal transitions to be unrepresentable/rejected; a table + `enter()` assertion is testable and matches the verbatim C.1 snapshot shape. |
| Postcondition verification framework | A bespoke evidence-checking pipeline per tool | Appendix O.2 `Verifier` + `buildOutcome` verbatim | O.2 is the spec's worked reference — deviating risks R-8 ("skips verifier, marks write done") and diverges from Phase 18's registration point. |
| Status/evidence computation | Status logic spread across loop exits | Single `buildOutcome` + guard at `finish()` | One choke point for "never silently claims success" (golden rule 8, spec 214) — testable per turn. |
| Retry multiplication | Nested per-stage/planner/provider retries | The three bounded layers (§1.6.1) — ProviderRouter, AGT-04 replan (≤1 per failed tool), one per-stage retry | R-2 (N×N×N cost blow-up); total calls must stay under §1.4 caps. |
| Outcome status union | A `string` status field | Closed 4-value union `'completed'|'partial'|'failed'|'aborted'` (C.1 verbatim) | "Make illegal states unrepresentable" — an open string invites silent-success bugs; consumers get exhaustiveness. |

**Key insight:** the phase's spine is a **determinism contract** — every branch of the loop maps to exactly one closed status, and evidence is the only thing that may produce a success claim. Custom per-tool logic would reintroduce the very silent-success holes AGT-02/04 close.

## Runtime State Inventory

> Included because this phase evolves an existing public return contract (`AgentTurnOutput` → `AgentTurnOutcome`, D-61) — verification that no runtime state changes are needed.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — trajectory is explicitly in-memory per turn (D-63); no chrome.storage/IndexedDB keys touched. | None |
| Live service config | None — no external services or UI-stored config reference the changed types. | None |
| OS-registered state | None — no OS registrations involved. | None |
| Secrets/env vars | None — `providerSecrets` input shape unchanged; no secret keys renamed. | None |
| Build artifacts | None — no renames of files/modules (types are additive). | None |

**Nothing found in any category** — verified by reading the full Phase-4 file inventory (spec §18: AgentTrajectoryState, OutcomeVerifier, CompletionEvidence, AgentTurnOutcome, AgentOrchestrator integration, Renderer completion guard, types.ts evidence seam) and confirming none touch storage/OS/secrets.

## Common Pitfalls

### Pitfall 1: `verify:phase-4` gate stays red (D-68)
**What goes wrong:** The gate currently runs `vitest run tests/core/context` — that dir does not exist (verified: vitest exits `No test files found, exiting with code 1`; `tests/core/` has no `context/`). Phase 5 owns `tests/core/context`; writing Phase-4 tests there steals Phase-5 territory.
**Why it happens:** The script was forward-written for Phase 5's dir.
**How to avoid:** Re-point `verify:phase-4` to `tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts` (D-68), plus the existing AI suite (`tests/core/ai`) since AgentOrchestrator changes ripple through `AgentOrchestrator.test.ts`.
**Warning signs:** `pnpm run verify:phase-4` exits 1 with "No test files found".

### Pitfall 2: AGT-04 breaks existing test (b) — repeated same-tool failure now terminal `failed`
**What goes wrong:** Test (b) (`AgentOrchestrator.test.ts:169-193`) mocks `PlannerService.plan` to ALWAYS return `run_tool 'any_tool'` and expects `planner_cap_reached` with 2 `TOOL_REJECTED` results. Under AGT-04, the second `any_tool` execution is a **repeated identical failure** (`TOOL_REJECTED` + same toolName) → terminal `failed` before the planner cap is reached.
**Why it happens:** The new deterministic policy is stricter than the old loop.
**How to avoid:** Re-script the cap test with **distinct tool names per iteration** (e.g. `search_kb` then `write_note` — each is a fresh tool with its own replan budget), so the loop legitimately exhausts `plannerCap`. Add new cases asserting repeated-identity → `failed` and one-replan-then-terminal.
**Warning signs:** Existing (b) failing with status `failed` instead of `planner_cap_reached`.

### Pitfall 3: Abort handling — throw vs returned `aborted` outcome
**What goes wrong:** Today `runAgentTurn` throws `DOMException('aborted','AbortError')` at loop-top and mid-stream (AgentOrchestrator.ts:300, 256, 215); `useChatStreaming` catches it (useChatStreaming.ts:258) and drops the partial. The DONE-when "abort produces `aborted`" implies an outcome is returned — but the throw contract is what the consumer and tests (e) rely on.
**Why it happens:** AGT-03 "every turn produces a structured AgentTurnOutcome" + the closed status set includes `aborted`.
**How to avoid:** Convert abort to a returned `aborted` outcome at the `runAgentTurn` boundary (catch the caller-signal AbortError centrally, return `{status:'aborted', streamedText:'', …}`, never invoke persistTurn), and update `useChatStreaming` to branch on `output.status === 'aborted'` (the stopped note is already appended by `handleStopGenerating`) and tests (e). See Open Questions Q1 — this is the phase's most invasive behavioral change.
**Warning signs:** Abort rethrows leaking past a status-`aborted` contract, or persistTurn firing on abort.

### Pitfall 4: The completion guard is vacuous in production
**What goes wrong:** With zero verifiers + zero tools, `buildOutcome` returns `completed` and the guard never fires — a phase could "pass" by shipping only the framework.
**Why it happens:** D-64 zero registrations is intentional; the guard has no production trigger.
**How to avoid:** The DONE-when requires a **false-completion test**: inject a fake side-effecting result (`ok: true`, verifier registered via `input.verifiers`, `evidence` absent) and assert the outcome is `partial`/guard-flagged, never `completed`. This is the AGT-02 proof.
**Warning signs:** No test asserts a non-`completed` outcome for an ok-result-without-evidence.

### Pitfall 5: `ToolExecutionResult.evidence` seam assumed to exist
**What goes wrong:** CONTEXT.md (D-60 note, code_context) claims the seam is "already declared" — it is NOT (verified: `src/core/ai/types.ts:122-133` has no `evidence`; grep for `CompletionEvidence` in `src/` = 0 hits). The guard and O.1-style evidence collection (spec 6282-6283) depend on it.
**Why it happens:** The spec's canonical `ToolExecutionResult` (spec 4334-4341) declares the seam; the Phase-3 implementation deviated (uses `data`/`error: string|null`/`code?` vs spec `output?`/`error?:{code,message,retryable}`).
**How to avoid:** Add `evidence?: import('@/types/harness').CompletionEvidence` additively to the Phase-3 shape (do NOT rework `data`/`error` — that breaks ExecutorService and its tests). The spec's other fields stay a Phase-18/none concern.
**Warning signs:** Type errors resolving `r.evidence` in the guard, or `import('@/types/harness')` failing before `harness.ts` exists.

### Pitfall 6: NP-STRICT ceiling violation in new code
**What goes wrong:** New modules (harness.ts, OutcomeVerifier.ts, trajectory.ts, orchestrator edits) that need `@ts-expect-error` or casts fail `tests/core/strict/np-strict-ceiling.test.ts` (ceiling 0, reads `package.json.NP_STRICT_CEILING`).
**How to avoid:** Write strict-clean from the start; the C.1/O.2 shapes type-check cleanly against `ToolExecutionResult<unknown>` without casts (the O.2 `(r as any)` cast in spec O.1 at 6283 is the Phase-14 coordinator, not Phase 4).
**Warning signs:** The strict ceiling test fails in `verify:phase-4`.

### Pitfall 7: Unstable failure identity for AGT-04
**What goes wrong:** Keying repeated-failure identity on the raw `error` message string makes "identical" fragile (provider messages vary) — either false terminals or missed repeats.
**Why it happens:** `ToolExecutionResult.error` is a free string.
**How to avoid:** Identity = `toolName + ':' + (code ?? 'ERROR')` — the `code` field (e.g. `TOOL_REJECTED`) is the stable §21.6 signal; fall back to the error string only when `code` is absent (ok=false without code, e.g. injected test results).
**Warning signs:** A replan test asserting one replan then terminal flakes across provider error wording.

### Pitfall 8: Trajectory/outcome `operationId` mismatch
**What goes wrong:** The trajectory's `operationId` must come from the turn's `OperationId` (D-63) — a fresh UUID per turn would break counters/evidence correlation.
**Why it happens:** `generateOperationId()` (src/core/runtime/OperationId.ts) is called once by the caller (`useChatStreaming.ts:170`) and threaded via `input.operationId`; the C.1 `AgentTurnOutcome.operationId` must be THAT value.
**How to avoid:** Thread `input.operationId` through tracker + buildOutcome unchanged (already the loop's pattern). Note the Phase-3 implementation dropped `operationId` from `AgentTurnOutput` (verified AgentOrchestrator.ts:90-101 vs spec 5561-5566) — D-61 re-adds it.
**Warning signs:** Tests asserting `outcome.operationId === input.operationId` fail.

## Code Examples

Verified patterns from authoritative sources:

### Canonical types — Appendix C.1 verbatim (Phase-4 subset)
```typescript
// Source: .planning/PRODUCT_SPEC_v0_1.md:4849-4876 (Appendix C.1, verbatim)
export type AgentTrajectoryPhase =
  | 'assembling-context' | 'planning' | 'waiting-for-permission'
  | 'executing' | 'verifying' | 'replanning' | 'rendering'
  | 'completed' | 'failed' | 'aborted';

export interface AgentTrajectoryState {
  operationId: string;
  phase: AgentTrajectoryPhase;
  plannerCalls: number;
  toolCalls: number;
  updatedAt: number;
}
export interface CompletionEvidence {
  toolName: string;
  operationId: string;
  postconditionId: string;   // verifier that produced this evidence (TOL-03)
  ok: boolean;
  verifiedAt: number;
  detail?: string;
}
export interface AgentTurnOutcome {
  operationId: string;
  status: 'completed' | 'partial' | 'failed' | 'aborted';
  reasonCode: string;        // cap exhaustion => 'partial', never 'completed'
  evidence: CompletionEvidence[];
  plannerCalls: number;
  toolCalls: number;
}
```
All values above appear verbatim in the C.1 quote — [VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:4849-4876]. These go into `src/types/harness.ts` untouched (D-60); `@/*` → project root makes `@/types/harness` resolve (tsconfig.json:22-25).

### Spec-canonical ToolExecutionResult (the seam Phase 4 must add)
```typescript
// Source: .planning/PRODUCT_SPEC_v0_1.md:4334-4341 (verbatim)
export interface ToolExecutionResult<T = unknown> {
  toolName: string;                 // used by OutcomeVerifier to pick a postcondition verifier
  ok: boolean;
  output?: T;
  error?: { code: string; message: string; retryable: boolean };
  evidence?: import('@/types/harness').CompletionEvidence; // set for side-effecting tools (§28.2)
  durationMs: number;
}
```
Phase-4 action: add the `evidence?` line to the Phase-3 shape — [VERIFIED: src/core/ai/types.ts:122-133] currently reads `toolName / ok / data: T | null / error: string | null / code?: string / durationMs: number` (no evidence, no spec's `output`/`error` object — keep Phase-3 fields intact, additive only).

### OutcomeVerifier — Appendix O.2 verbatim
```typescript
// Source: .planning/PRODUCT_SPEC_v0_1.md:6330-6361 (Appendix O.2, verbatim)
// src/core/ai/OutcomeVerifier.ts
import type { CompletionEvidence, AgentTurnOutcome } from '@/types/harness';
import type { ToolExecutionResult } from './types';

export interface Verifier {
  postconditionId: string;
  verify(result: ToolExecutionResult<unknown>): Promise<{ ok: boolean; detail?: string }>;
}

export async function buildOutcome(
  operationId: string,
  results: ToolExecutionResult<unknown>[],
  verifiers: Record<string, Verifier>,   // keyed by toolName
  caps: { plannerCalls: number; toolCalls: number; capHit: boolean },
): Promise<AgentTurnOutcome> {
  const evidence: CompletionEvidence[] = [];
  for (const r of results) {
    const v = verifiers[r.toolName];
    if (!v) continue;                     // read-only tool: no postcondition required
    const outcome = await v.verify(r);
    evidence.push({ toolName: r.toolName, operationId, postconditionId: v.postconditionId,
      ok: outcome.ok, verifiedAt: Date.now(), detail: outcome.detail });
  }
  const sideEffectFailed = evidence.some(e => !e.ok);
  const status: AgentTurnOutcome['status'] =
    caps.capHit ? 'partial' : sideEffectFailed ? 'failed' : 'completed'; // AGT-03: cap = partial
  return { operationId, status,
    reasonCode: caps.capHit ? 'cap_exhausted' : sideEffectFailed ? 'postcondition_failed' : 'ok',
    evidence, plannerCalls: caps.plannerCalls, toolCalls: caps.toolCalls };
}
```
[VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:6330-6361]. Note the canonical O.1 coordinator collects result-attached evidence the same way: `evidence.push(...turn.toolResults.map(r => (r as any).evidence).filter(Boolean) ...)` (spec 6282-6283) — both evidence paths (verifier-generated via buildOutcome, executor-attached via `result.evidence`) ride the same `CompletionEvidence` shape.

### Trajectory transition table (recommended tracker core — planner's discretion)
```typescript
// src/core/ai/trajectory.ts — recommended shape (transition-table validator, D-62)
import type { AgentTrajectoryPhase, AgentTrajectoryState } from '@/types/harness';

export const TRAJECTORY_TRANSITIONS: Record<AgentTrajectoryPhase, readonly AgentTrajectoryPhase[]> = {
  'assembling-context': ['planning'],
  'planning': ['executing', 'waiting-for-permission', 'rendering', 'replanning', 'failed', 'aborted'],
  'waiting-for-permission': ['executing', 'replanning', 'failed', 'aborted'],
  'executing': ['verifying', 'replanning', 'failed', 'aborted'],
  'verifying': ['rendering', 'failed', 'aborted'],
  'replanning': ['planning', 'failed', 'aborted'],
  'rendering': ['completed', 'failed', 'aborted'],
  'completed': [],
  'failed': [],
  'aborted': [],
};

export class TrajectoryTracker {
  private state: AgentTrajectoryState;
  constructor(operationId: string) {
    this.state = { operationId, phase: 'assembling-context', plannerCalls: 0, toolCalls: 0, updatedAt: Date.now() };
  }
  enter(next: AgentTrajectoryPhase): void {
    if (!TRAJECTORY_TRANSITIONS[this.state.phase].includes(next)) {
      throw new Error(`illegal trajectory transition: ${this.state.phase} -> ${next}`); // AGT-01
    }
    this.state = { ...this.state, phase: next, updatedAt: Date.now() };
  }
  snapshot(plannerCalls: number, toolCalls: number): AgentTrajectoryState {
    return { ...this.state, plannerCalls, toolCalls, updatedAt: Date.now() };
  }
}
```
This table's states are exactly the C.1 verbatim union values; the transition set is derived from the Appendix I loop structure (planner → executor → (failure → replan) → renderer → terminal). The `waiting-for-permission` row has no Phase-4 trigger (permission gate = Phase 17) but is required by the closed machine (AGT-01). [ASSUMED] — mechanism and table are the researcher's recommendation under D-62's discretion; the phase values themselves are [VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:4849-4852].

### Renderer completion guard (D-65 sketch)
```typescript
// finish() integration sketch — guard MUST run before the outcome is returned
// Side-effecting = a verifier is registered for the tool (TOL-03 marker).
function guardMissingEvidence(
  results: ToolExecutionResult<unknown>[],
  verifiers: Record<string, Verifier>,
): boolean {
  return results.some((r) =>
    r.ok === true && verifiers[r.toolName] !== undefined && r.evidence === undefined,
  );
}
// In finish(): if (guardMissingEvidence(toolResults, verifiers)) {
//   status = 'partial'; reasonCode = 'missing_evidence';   // never 'completed' (AGT-02, R-8)
// }
```
[ASSUMED] — the guard's exact placement/naming is D-65's planner call; the condition (ok + verifier-present + evidence-absent) follows from AGT-02/R-8 and the spec's `evidence?` comment "set for side-effecting tools (§28.2)" [VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:4339].

### Replan/terminal policy (D-66 sketch, inside the existing loop)
```typescript
// Inside the while loop, after `toolResults.push(result)` (AgentOrchestrator.ts:348):
const identity = result.code ?? (result.error ?? 'ERROR'); // stable signal: §21.6 code first
if (!result.ok) {
  if (failureIdentities.get(result.toolName) === identity) {
    return finishTerminal('failed');                        // repeated identical failure (AGT-04)
  }
  if (replannedTools.has(result.toolName)) {
    return finishTerminal('failed');                        // replan budget consumed (≤1 per tool)
  }
  failureIdentities.set(result.toolName, identity);
  replannedTools.add(result.toolName);
  trajectory.enter('replanning');                           // next planner call = the single replan
  continue;
}
```
[ASSUMED] — exact structure is the planner's encoding of AGT-04 [VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:3945]; counters `plannerCalls`/`toolCalls` already exist at AgentOrchestrator.ts:123-124 [VERIFIED].

### Status mapping for existing terminal reasons (discretion — recommended)
| Existing reasonCode | Recommended status | Notes |
|---|---|---|
| planner answer reasonCode (e.g. `direct_answer`) | `completed` | Normal answer path |
| `ask_clarification` | `completed` | Legitimate terminal outcome — the question IS the renderer output (RICH-C-01 substrate); reasonCode carries the semantics |
| `planner_cap_reached` / `tool_cap_reached` | `partial` | Cap exhaustion → O.2 reasonCode `cap_exhausted` (CONTEXT Specifics: "cap → partial with reasonCode: 'cap_exhausted'"); existing literals may be kept as the reasonCode — planner's call, tests (b) updated either way |
| `configuration_required` (D-54a) | `failed` (recommended) | No provider request started, no output — `failed` is honest; consumers branch on the reasonCode (useChatStreaming.ts:223) so the status is safe to change |
| repeated identical failure | `failed` | AGT-04 |
| guard (missing evidence) | `partial` | D-65 |
| abort | `aborted` | C.1 status set / DONE-when |

Status values are the closed C.1 union [VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:4871]; the mapping rows are [ASSUMED] recommendations for the planner's discretion.

## State of the Art

| Old Approach (Phase 3) | Current Approach (Phase 4) | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Loose `AgentTurnOutput` (streamedText/toolResults/reasonCode, no operationId) | Structured `AgentTurnOutcome` (C.1: operationId/status/evidence/counters) + additive streamed fields | Phase 4 (D-61) | Every turn is honest about its outcome; `status` is the single success oracle |
| Ad-hoc loop counters with no phase record | Closed trajectory state machine + per-turn `AgentTrajectoryState` | Phase 4 (D-62/63) | AGT-01 testable; substrate for Phase 11 diagnostics/log and Phase 12 EVAL trajectory rubric |
| Zero evidence semantics | `CompletionEvidence` seam on `ToolExecutionResult` + O.2 verifier framework (zero registered) | Phase 4 (D-60/64) | AGT-02/R-8 closed at the outcome layer; Phase 18 registers real verifiers |
| Planner-retries-until-cap loop | Deterministic replan/terminal policy (≤1 replan per failed tool, repeated-identity terminal) | Phase 4 (D-66) | AGT-04; no silent retry loops; bounds honored (§1.6.1) |

**Deprecated/outdated:**
- `AgentTurnOutput` (Phase-3 orchestrator contract): superseded additively by `AgentTurnOutcome` (D-61) — the name/interface may be removed or kept as an alias; consumers must not break.
- `reasonCode: 'planner_cap_reached'`/`'tool_cap_reached'` as the *only* cap signal: status now carries the semantic (`partial`), reasonCode becomes descriptive (O.2 `cap_exhausted` preferred per CONTEXT Specifics).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Trajectory tracker mechanism = transition-table validator (vs type-level) | Architecture Patterns / Code Examples | Wrong mechanism choice is reversible (D-62 discretion); the transition table fits the verbatim C.1 flat snapshot — type-level would require restructuring the locked type |
| A2 | Recommended transition table (which phases may follow which) | Code Examples | The phase union is verified; the edge set is derived from the loop — an illegal-in-reality edge would be caught by AGT-01 tests |
| A3 | Status mapping: `configuration_required` → `failed`, `ask_clarification` → `completed` | Code Examples | Mis-mapping would mislabel honest terminal outcomes; consumers branch on reasonCode so impact is low; planner may choose differently (explicit discretion) |
| A4 | Abort → returned `aborted` outcome (not throw) | Open Questions Q1 / Pitfall 3 | Changes consumer + tests (e) — the most invasive call; keeping the throw contradicts DONE-when "abort produces aborted" |
| A5 | Guard condition = ok + verifier-present + evidence-absent; reasonCode `missing_evidence` | Code Examples | O.2's buildOutcome generates evidence for registered verifiers, so guard ordering (guard before/overriding buildOutcome status) matters — planner's call |
| A6 | `VerifierRegistry` + `input.verifiers` override as the injection seam | Architecture Patterns | Alternative: registry-only or input-only; testability of D-65/D-67 requires one of them |
| A7 | Trajectory module as `src/core/ai/trajectory.ts` single file | Project Structure | CONTEXT discretion allows a directory; test dir is `tests/core/ai/trajectory/**` either way |
| A8 | `cap_exhausted` replaces `planner_cap_reached`/`tool_cap_reached` as reasonCode | Code Examples | O.2 verbatim uses `cap_exhausted`; existing test (b) matches the old literals — tests updated either way (Pitfall 2) |

## Open Questions (RESOLVED)

1. **Abort: returned `aborted` outcome vs keep-throw?**
   - What we know: DONE-when says "abort produces `aborted`" (AGT-04); C.1 status set includes `aborted`; the current loop throws `DOMException('aborted','AbortError')` (AgentOrchestrator.ts:300, 215, 256); `useChatStreaming.ts:258` catches it and drops the partial; tests (e) assert the throw.
   - What's unclear: whether to convert abort to a returned outcome (central catch at the `runAgentTurn` boundary, `streamedText: ''`, no persistTurn, consumer branches on `output.status === 'aborted'`) or keep the throw (then `aborted` never surfaces as an outcome, contradicting the DONE-when).
   - Recommendation: convert to the returned `aborted` outcome (DONE-when-consistent), update `useChatStreaming` + tests (e); the partial is still dropped and persistTurn never fires. Planner must scope the consumer edit (D-61's "costly" reversibility).
   - **RESOLVED (D-66 + plan 04-04, A4):** convert to the returned `aborted` outcome — 04-04 Task 1 implements the boundary conversion (status 'aborted', reasonCode 'aborted', streamedText '', no persistTurn); 04-04 Task 2 branches `useChatStreaming` on `output.status === 'aborted'` and reworks case (e) from throw-assertion to resolve-assertion.

2. **How does the completion guard interact with O.2's verifier-generated evidence?**
   - What we know: buildOutcome generates evidence for any result with a registered verifier; the guard (D-65) needs evidence-ABSENT detection on ok side-effecting results.
   - What's unclear: exact ordering (guard first, or guard overrides buildOutcome's status) and whether `VerifierRegistry` or `input.verifiers` is the orchestrator's source.
   - Recommendation: guard evaluates first (or overrides after) so "never a clean success" is unconditional; support both registry (empty in prod) and an `input.verifiers` test override. Confirm in planning.
   - **RESOLVED (D-65 + plan 04-02, A5/A6):** guard OVERRIDES buildOutcome's status unconditionally in finish() — ok + verifier-present + evidence-absent → status 'partial' + reasonCode 'missing_evidence'; effective set = `{ ...VerifierRegistry.getAll(), ...input.verifiers }` (registry empty in prod, input override for the false-completion test).

3. **`configuration_required` / `ask_clarification` status mapping**
   - What we know: both are legitimate Phase-3 terminal outcomes (D-54a); status set is closed to 4 values; consumers branch on reasonCode.
   - What's unclear: whether `configuration_required` maps to `failed` (recommended — no output produced) and `ask_clarification` to `completed` (recommended — question is the output) or to `partial`.
   - Recommendation: adopt the recommended mapping (A3); user confirmation via discuss if the planner prefers otherwise.
   - **RESOLVED (A3, adopted in plan 04-01 Task 1):** `configuration_required` → status 'failed' (no output produced), `ask_clarification` → status 'completed' (the question IS the output); consumers keep branching on reasonCode.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Test/typecheck toolchain | ✓ | v24.19.0 | — |
| pnpm | Script execution (`verify:phase-4`) | ✓ | 11.22.0 | — |
| TypeScript | `tsc --noEmit` (strict, ceiling 0) | ✓ | 5.8.3 installed (pkg `~5.8.2`) | — |
| Vitest | Test runner (jsdom + chrome mocks) | ✓ | 3.2.7 installed (pkg `^3.0.0`) | — |
| Zod | Runtime validation convention | ✓ | 4.4.3 installed (pkg `^4.4.3`) | — |
| Chrome extension env | `chrome.storage.*` mocks in `tests/setup.ts` | ✓ | in-repo mock | — |

**Missing dependencies with no fallback:** none — Phase 4 is code/config-only with no external services or CLIs.

**Note:** installed versions were probed from `node_modules` (2026-08-29). `STATE.md` VAI-04 lists newer nominal versions (TS 7.0.2, Vitest 4.1.11) — the installed tree is authoritative for this phase; no upgrades required.

## Validation Architecture

> `workflow.nyquist_validation` = true in `.planning/config.json` — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.7 (jsdom, globals; `tests/setup.ts` chrome/storage/BroadcastChannel mocks) |
| Config file | `vitest.config.ts` (alias `@` → project root) |
| Quick run command | `npx vitest run tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts` |
| Full suite command | `pnpm run verify:phase-4` (after D-68 re-point) / `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGT-01 | Trajectory transitions asserted against the closed machine; illegal transitions rejected; per-turn snapshot on the outcome | unit | `npx vitest run tests/core/ai/trajectory` | ❌ Wave 0 (new dir per §18) |
| AGT-02 | buildOutcome evidence semantics (O.2); guard: ok side-effecting result w/o evidence → `partial`, never `completed` (injected fake result) | unit | `npx vitest run tests/core/ai/OutcomeVerifier.test.ts` + orchestrator guard case | ❌ Wave 0 (new file per §18) |
| AGT-03 | Every turn returns `AgentTurnOutcome`; cap exhaustion → `partial` (never `completed`); abort → `aborted` | unit | orchestrator cases (b)/(e) updated + new status assertions in `tests/core/ai/AgentOrchestrator.test.ts` | ✅ exists (must extend) |
| AGT-04 | One replan per failed tool; repeated identical failure → terminal `failed`; injected executor results (D-67) | unit | new cases in `tests/core/ai/AgentOrchestrator.test.ts` (mock `ExecutorService.execute`) | ✅ exists (must extend) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/ai/trajectory tests/core/ai/OutcomeVerifier.test.ts tests/core/ai/AgentOrchestrator.test.ts`
- **Per wave merge:** `pnpm run verify:phase-4` (D-68 re-pointed) + `pnpm run lint` (tsc --noEmit, strict ceiling)
- **Phase gate:** `pnpm run verify:phase-4` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/ai/trajectory/` — new dir; AGT-01 closed-machine tests (legal transitions pass, illegal throw, snapshot counters, per-turn record)
- [ ] `tests/core/ai/OutcomeVerifier.test.ts` — new file; O.2 buildOutcome (cap→partial/`cap_exhausted`, side-effect fail→failed/`postcondition_failed`, else completed/ok; zero-verifier vacuity) + guard (false-completion)
- [ ] `tests/core/ai/AgentOrchestrator.test.ts` — extend: status assertions on existing cases, re-script (b) with distinct tool names, abort→`aborted` outcome (Q1), replan/terminal via `ExecutorService.execute` mocks
- [ ] `package.json` — re-point `verify:phase-4` (D-68) — currently RED (verified: `No test files found, exiting with code 1`)

*(Existing infra — fixtures/FixtureProvider, planSpy pattern, storage mocks — covers all new tests; no new framework pieces needed.)*

## Security Domain

> `workflow.security_enforcement` = true — section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth in this phase (AI runs in UI contexts, user-configured providers) |
| V3 Session Management | no | No sessions introduced |
| V4 Access Control | no | Permission gate is Phase 17; zero tools registered |
| V5 Input Validation | yes | Closed unions + existing Zod conventions for cross-boundary shapes; `AgentTurnOutcome.status` is a closed 4-value union (C.1) — never an open string; `ToolExecutionResult.evidence` typed against `@/types/harness` |
| V6 Cryptography | no | No crypto added (secrets handling unchanged) |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| False completion — a side-effecting write is marked "done" without verification (R-8) | Spoofing / Tampering | Completion guard (D-65): ok side-effecting result without `CompletionEvidence` → outcome `partial`, never `completed`; O.2 verifier framework + evidence seam |
| Silent success on cap exhaustion (AGT-03 violation) | Spoofing | `buildOutcome` status rule: `capHit → 'partial'` (O.2 verbatim); closed status union makes `completed` impossible on cap hit |
| Illegal trajectory transitions masking failures | Tampering | Closed transition table + runtime rejection (AGT-01); asserted in tests |
| Unbounded retry amplification (R-2, N×N×N) | Denial of Service | §1.6.1 three-layer bound; ≤1 replan per failed tool; all under §1.4 caps |
| Injected tool output redefining policy | Elevation of Privilege | Out of scope (Phase 7 CTX-02) — note only; Phase 4's evidence/status layer does not trust tool content for control flow |

## Sources

### Primary (HIGH confidence — read verbatim this session)
- [VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:4829-4978] — Appendix C.1 canonical types + canonical-home rule (Reliability row 4837; `AgentTrajectoryState`/`CompletionEvidence`/`AgentTurnOutcome` verbatim 4849-4876; `ToolExecutionResult` stays in `@/core/ai/types` 4844)
- [VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:6326-6361] — Appendix O.2 OutcomeVerifier + buildOutcome (verbatim)
- [VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:4331-4341] — canonical `ToolExecutionResult` with `evidence?` seam
- [VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:5561-5615] — Appendix I bounded loop + `AgentTurnOutput` (with `operationId`)
- [VERIFIED: .planning/PRODUCT_SPEC_v0_1.md:3940-3945, 214, 229, 354-359, 414-419, 3422-3449, 2570-2578] — AGT-01…04; golden rule 8; risk R-8; §1.4 caps; §1.6.1 retry layering; §21.6 closed codes; §18 Phase 4 block
- [VERIFIED: src/core/ai/AgentOrchestrator.ts:45-52, 61-87, 89-101, 121-124, 231-297, 299-354] — tier caps, input contract, `AgentTurnOutput`, counters, finish/configurationRequired, loop
- [VERIFIED: src/core/ai/types.ts:17-64, 122-133] — ProviderId/ModelTier/PlannerDecision/StreamErrorCode/StreamEvent + `ToolExecutionResult` (NO evidence — discrepancy confirmed)
- [VERIFIED: src/components/chat/useChatStreaming.ts:49-52, 111-278] — consumer contract (reasonCode/streamedText reads, abort catch, persist seam)
- [VERIFIED: src/core/runtime/workerState.ts:22-42] — `ActiveStreamState` (§20.6, distinct from trajectory)
- [VERIFIED: package.json:7,21] — `NP_STRICT_CEILING: 0`; `verify:phase-4` mis-point at `tests/core/context` (gate currently RED — verified by run)
- [VERIFIED: tests/core/ai/AgentOrchestrator.test.ts:156-390, tests/core/ai/ExecutorService.test.ts:40-101, tests/core/ai/fixtures/FixtureProvider.ts:21-110, tests/setup.ts:55-204] — test patterns (cases a–i, planSpy, fixture provider, chrome mocks)
- [VERIFIED: tests/core/strict/np-strict-ceiling.test.ts:35-103, tsconfig.json:22-25, vitest.config.ts:11-13] — strict ceiling enforcement, path alias
- [VERIFIED: bash probes 2026-08-29] — node v24.19.0, pnpm 11.22.0, vitest 3.2.7, ts 5.8.3, zod 4.4.3; `verify:phase-4` exits 1 ("No test files found"); no `AGENTS.md`/skills dirs

### Secondary (MEDIUM confidence)
- [CITED: oneuptime.com/blog/post/2026-01-30-typescript-type-safe-state-machines; dev.to/gabrielanhaia/state-machines-in-typescript] — standard TS state-machine patterns (transition-table vs type-level); used only to justify the recommended mechanism under D-62's discretion

### Tertiary (LOW confidence)
- None — no external contract is at play in this phase; every normative claim traces to the spec or the verified tree

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; versions probed from installed tree
- Architecture: HIGH for spec-mandated shapes (C.1/O.2 verbatim, loop integration); MEDIUM for the discretionary mechanisms (transition table edges, guard ordering, registry-vs-input injection — Assumptions A1/A5/A6)
- Pitfalls: HIGH — verified against the actual tree (gate RED, missing evidence seam, test (b) conflict, abort contract)

**Research date:** 2026-08-29
**Valid until:** 2026-09-28 (stable in-repo contract; no external drift)