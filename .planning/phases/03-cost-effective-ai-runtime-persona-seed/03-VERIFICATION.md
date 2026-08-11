---
phase: 03-cost-effective-ai-runtime-persona-seed
verified: 2026-08-11T03:10:00Z
status: gaps_found
score: 3/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "CR-01 — R-2 budget starves the renderer on legitimate tool-loop turns (retryCount-scoped budget + permanent orchestrator regression)"
    - "WR-01 — hasActiveProvider() last-registration gate (any-usable entry-based gate + 5 gate tests)"
    - "WR-04 — Retry targets the newest message regardless of clicked bubble (latest-bubble footer gate + 3 regression tests)"
  gaps_remaining:
    - "WR-02 breaker half — recordFailure(STREAM_FAILED) votes 0 (BREAKER_VOTES has no STREAM_FAILED entry; voteBreaker early-returns) — the streaming-path breaker is still inert (WR-02A, empirically confirmed)"
    - "WR-03 D-17-retry half — a production timeout yields a bare AbortError inside the router closure (classified UNKNOWN, not retryable) before the TimeoutError carrier is born — the D-17 retry on TIMEOUT still never fires on the production path (WR-03A, empirically confirmed)"
  regressions: []
gaps:
  - truth: "Circuit breaker + stream-freeze guard protect the streaming path (§1.5 / D-14: never switch provider after the first token; mid-stream failures vote the breaker)"
    status: partial
    reason: "WR-02 half-closed: the stream-freeze guard is correctly wired (markStreamedFirstToken after the first delta, firstTokenMarked-once, stream_frozen reachable in createStageInvocation) and the catch/non-stop branches now call recordFailure with isAbortError protection — BUT the vote is inert: BREAKER_VOTES (ProviderRouter.ts L186-195) has NO STREAM_FAILED entry, so voteBreaker computes BREAKER_VOTES[code] ?? 0 = 0 and early-returns. A provider failing mid-stream still accrues zero breaker votes and is retried every turn — the pre-fix observable consequence is unchanged. Empirically confirmed: 3 x recordFailure('openai','STREAM_FAILED') leaves isBreakerOpen('openai') === false (contrast: 3 x PROVIDER_5XX opens it). The 03-12 plan's stated accounting intent ('the STREAM_FAILED code votes per the classifier's mapped code, never a hardcoded double-count') was not implemented — RendererService.ts L128-132/L146 hardcode ERROR_CODES.STREAM_FAILED. The WR-02 regression tests mock the Router singleton (getProviderRouter: () => routerMock) and assert only that recordFailure was INVOKED, never that a vote accrued or the breaker opened — they cannot detect a 0-vote."
    artifacts:
      - path: "src/core/ai/ProviderRouter.ts"
        issue: "BREAKER_VOTES (L186-195) lacks STREAM_FAILED; voteBreaker (L760-762) early-returns on 0 votes"
      - path: "src/core/ai/RendererService.ts"
        issue: "catch (L128-132) and non-stop finish (L146) hardcode ERROR_CODES.STREAM_FAILED instead of classifying the underlying provider error to a voting code"
      - path: "tests/core/ai/RendererService.test.ts"
        issue: "WR-02 tests stub getProviderRouter with routerMock and assert recordFailure invocation only — no real-router breaker-state assertion"
    missing:
      - "Add STREAM_FAILED: 1 to BREAKER_VOTES, OR classify the underlying error in the catch branch and pass its mapped code (NETWORK/PROVIDER_5XX → vote 1) while keeping STREAM_FAILED for the no-error non-stop branch; extend RendererService.test.ts with a real-Router test: 3 STREAM_FAILED failures → isBreakerOpen(providerId) === true"
  - truth: "ProviderRouter is the first retry layer (D-17): retryable pre-first-token codes (TIMEOUT, PROVIDER_5XX, NETWORK, RATE_LIMITED) get exactly ONE router retry per provider step"
    status: partial
    reason: "WR-03 half-closed: the timeout-origin carrier is correctly produced (timedOut flag set before ac.abort()), classifyProviderError checks isTimeoutError FIRST and maps the carrier to TIMEOUT/retryable, user cancels stay AbortError/UNKNOWN, and a planner timeout now surfaces a visible planner_failed fallback answer (never the silent idle) — BUT the D-17 retry on TIMEOUT never fires on the production path: the per-attempt timeout aborts the same signal the SDK call consumes, so the SDK rejects with a bare AbortError INSIDE the router closure; classifyProviderError maps AbortError → UNKNOWN (not retryable) BEFORE the retry decision, and the TimeoutError carrier is created only in StructuredOutput.attempt's catch AFTER the closure has returned. Empirically confirmed through the real path (StructuredOutput.requestJson + real Router closure, 25 ms timeout, SDK mocked to reject AbortError on aborted signal): requestJson rejects with the TimeoutError carrier, but generateObject was called exactly ONCE, retryCount stayed 0, and the ledger records errorCode 'UNKNOWN' (not TIMEOUT). The unit test 'retries EXACTLY once on a TimeoutError carrier' (ProviderRouter.test.ts L354-373) injects timeoutError(3_000) as the generateObject mock rejection — an arrival pattern production never produces; additionally, even a carrier reaching the closure would retry with the same already-aborted per-attempt signal (a futile retry by construction). BREAKER_VOTES.TIMEOUT = 1 is equally unreachable on the timeout path."
    artifacts:
      - path: "src/core/ai/StructuredOutput.ts"
        issue: "the timeout abort (L94-97) aborts the per-attempt ac.signal that is threaded into the router closure (L99) — the SDK rejects with AbortError before the carrier is thrown (L101)"
      - path: "tests/core/ai/ProviderRouter.test.ts"
        issue: "L354-373 retry-on-TimeoutError test feeds the carrier at the SDK boundary — not reachable from the production timeout flow"
    missing:
      - "Either (a) accept the fallback-answer semantics and correct the test/summary framing to document that the carrier's production path bypasses the router retry, or (b) make the router closure timeout-aware: wrap the incoming signal so a timeout-origin rejection surfaces as the carrier INSIDE the retry decision point, give the retried call a fresh non-aborted signal, and assert the retry end-to-end through StructuredOutput.attempt + a real Router"
human_verification: []
behavior_unverified_items: []
---

# Phase 3: Cost-Effective AI Runtime (+ Persona seed) Verification Report — RE-VERIFICATION after gap closure

**Phase Goal:** Users can chat with any of four providers through Planner→Executor→Renderer orchestration with streaming, cost guardrails, and persona-aware prompting from day one.
**Verified:** 2026-08-11T03:10:00Z
**Status:** gaps_found
**Re-verification:** Yes — after gap-closure execution (plans 03-10 .. 03-14), prior status gaps_found (4/5)

## Goal Achievement

### Re-verified Gap Truths (from prior VERIFICATION.md gaps)

| #   | Prior Gap Truth | Status | Evidence |
| --- | --------------- | ------ | -------- |
| 1   | CR-01 — SC3 cap exhaustion terminates with planner_cap_reached / tool_cap_reached (R-2 budget starves the renderer) | ✓ VERIFIED (closed) | `RouterAttemptState.retryCount` (ProviderRouter.ts L127-134) + both budget gates read `this.retryCount(...)` (L401, L612); `recordAttempt(..., isRetry)` increments retryCount ONLY for the D-17 retried call (L749); first call per stage/repair passes `attempt(false)` (L649), retry passes `attempt(true)` (L658); `attemptCount` removed (0 stale refs). Permanent regression `AgentOrchestrator.budget.test.ts` runs a REAL Router + REAL budget + REAL stage services (only ai-sdk call sites stubbed): medium-tier 2-tool turn resolves `reasonCode: 'success'`, renderer ran (`streamText` × 1), `retryCount === 0`; the repair turn and the D-17-retry turn both answer (retryCount 0 / 1). Suite green in the full gate. |
| 2   | WR-02 — circuit breaker + stream-freeze guard protect the streaming path (never switch after first token; mid-stream failures vote the breaker) | ✗ FAILED (partial) | Freeze half WIRED ✓ (RendererService.ts L108-118: `firstTokenMarked` + `markStreamedFirstToken` after the first delta; `stream_frozen` reachable in createStageInvocation L392-400; user aborts excluded via isAbortError L127). Breaker half INERT ✗ — WR-02A independently confirmed: `BREAKER_VOTES` (L186-195) has no `STREAM_FAILED`; `voteBreaker` (L760-762) early-returns on 0; both renderer call sites hardcode `STREAM_FAILED` (L128-132, L146). Empirical probe (real Router, temp test, removed after run): 3×`recordFailure('openai','STREAM_FAILED')` → `isBreakerOpen === false` (contrast: 3×`PROVIDER_5XX` → open). Regression tests mock the Router singleton and assert invocation only — they cannot see a 0-vote. |
| 3   | WR-03 — retryable pre-first-token codes (TIMEOUT, PROVIDER_5XX, NETWORK, RATE_LIMITED) get exactly ONE router retry per provider step | ✗ FAILED (partial) | Carrier + classification WIRED ✓ (TimeoutError.ts leaf module; StructuredOutput.ts L93-102 timedOut-flag + rethrow; classifyProviderError L503-507 isTimeoutError → TIMEOUT/retryable BEFORE the abort branch; user cancels stay AbortError/UNKNOWN; planner timeout now surfaces a visible `planner_failed` fallback answer — AgentOrchestrator planOnce L188-201 — never the silent idle). D-17 retry on TIMEOUT NOT REALIZED on the production path ✗ — WR-03A independently confirmed: the per-attempt abort (L94-97) aborts the signal threaded into the router closure, so the SDK rejects with a bare AbortError INSIDE the closure → classified UNKNOWN (not retryable) → no retry; the carrier is born only in `attempt`'s catch after the closure returned. Empirical probe (real requestJson + real Router closure, 25 ms timeout): rejects with `TimeoutError`, but `generateObject` called exactly ONCE, `retryCount === 0`, ledger records `'UNKNOWN'`. Unit test L354-373 injects the carrier as the mock rejection — an arrival pattern production never produces. |
| 4   | WR-01 — the D-07/D-21 provider gate is 'any usable provider configured' | ✓ VERIFIED (closed) | `hasActiveProvider()` (ProviderRegistry.ts L182-189) iterates ALL entries, true on first `enabled && !keyUnreadable`; JSDoc states any-usable semantics; `getActiveProvider()` unchanged. 5 gate tests pin: earlier-usable keeps the gate open when LAST registered is disabled / keyUnreadable, all-disabled → false, legacy `registerActiveProvider` without an entry no longer opens the gate (documented behavior change). Suite green. |
| 5   | WR-04 — Retry re-sends the last user input with a NEW operationId (failed bubble's partial text replaced) | ✓ VERIFIED (closed) | ChatPage.tsx L137-149 footer gate: `m.id === messages[messages.length - 1]?.id && (failed || offline)` — Retry renders ONLY on the latest assistant bubble; `handleRetry`'s last-message targeting is now sound (comment documents the invariant). 3 regression tests: stale bubble inert after a newer completed send, latest-bubble Retry still works, replace-only-latest. Suite green. |

**Score:** 3/5 gap truths verified (2 remain partially closed with empirically confirmed residual defects)

### Observable Truths (roadmap Success Criteria — regression check on passed items)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | SC1 — User configures any provider and converses with it | ✓ VERIFIED (no regression) | Four adapters + OpenAICompat factory, vault→registry wiring, `hasActiveProvider` gate now any-usable (WR-01 closed); shell-gate fixtures converted to real `registerProvider` entries — 25/25 shell tests pass |
| 2   | SC2 — User sees responses stream incrementally (SSE + ChunkBuffer) | ✓ VERIFIED (no regression) | RendererService.streamText → onDelta → ChunkBuffer → Bubble text; all streaming suites green in the 465-test gate |
| 3   | SC3 — usage bounded by tier caps + cheapest-capable routing, fallback + circuit breaker | ✗ FAILED (partial) | CR-01 closed (retry-scoped budget; `*_cap_reached` terminals reachable; 2-tool turns complete) BUT the circuit-breaker half of the cost-governor remains degraded on the streaming path (WR-02A: STREAM_FAILED votes 0) and the D-17 TIMEOUT retry never fires on the production path (WR-03A) |
| 4   | SC4 — Planner/Executor/Renderer schema discipline | ✓ VERIFIED (no regression) | Closed discriminated union, TOOL_REJECTED gate, RENDERER_MAX_TOKENS 512, one-repair-then-fail; suites green |
| 5   | SC5 — persona overrides apply without a code change | ✓ VERIFIED (no regression) | np_persona → resolvePersona → buildPersonaBlock → contextHelper [SYSTEM]; persona suites green |

**Score:** 4/5 roadmap truths verified (SC3 partial — see gaps)

### Required Artifacts — gap-closure deltas

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/core/ai/ProviderRouter.ts` | retryCount-scoped R-2 budget (CR-01); TIMEOUT classification (WR-03) | ✓ VERIFIED (with residual) | RouterAttemptState.retryCount, gates L401/L612, attempt(isRetry)/recordAttempt(isRetry), attemptCount removed; isTimeoutError checked first in classifyProviderError. ❌ BREAKER_VOTES lacks STREAM_FAILED (WR-02A) |
| `src/core/error/TimeoutError.ts` | shared typed timeout carrier, leaf module | ✓ VERIFIED | interface + isTimeoutError name-match guard + timeoutError(timeoutMs) factory; zero runtime imports; R-10 (carries only timeoutMs) |
| `src/core/ai/StructuredOutput.ts` | timeout origin separated from user abort | ✓ VERIFIED (with residual) | timedOut flag set BEFORE ac.abort(); catch rethrows TimeoutError for timeout-origin, rethrows original otherwise; outer-abort re-parenting intact. ❌ the abort still hits the router closure's signal — carrier born after the retry decision (WR-03A) |
| `src/core/ai/RendererService.ts` | recordFailure + markStreamedFirstToken wired | ✓ VERIFIED (with residual) | firstTokenMarked-once freeze; catch + non-stop branches vote; isAbortError guard (name-match, prototype-chain agnostic). ❌ votes use STREAM_FAILED → 0 (WR-02A) |
| `src/core/ai/ProviderRegistry.ts` | any-usable hasActiveProvider | ✓ VERIFIED | entry iteration over providers.values(); getActiveProvider unchanged |
| `src/components/pages/ChatPage.tsx` | Retry gated to latest assistant bubble | ✓ VERIFIED | footer gate + handleRetry comment |
| `tests/core/ai/AgentOrchestrator.budget.test.ts` | permanent CR-01 regression | ✓ VERIFIED | real Router + real budget + real stages; 2-tool / repair / D-17-retry turns all answer; retryCount assertions |

### Key Link Verification (gap-closure wiring)

| From | To | Via | Status | Details |
| ---- | -- | -- | ------ | ------- |
| RendererService catch/non-stop | getProviderRouter().recordFailure | singleton import L30 | ✓ WIRED (inert vote) | Called with STREAM_FAILED; voteBreaker early-returns (WR-02A) |
| RendererService delta loop | getProviderRouter().markStreamedFirstToken | singleton import L30 | ✓ WIRED | exactly once per render (firstTokenMarked); stream_frozen guard reachable |
| StructuredOutput timeout | TimeoutError carrier | timeoutError() import L34 | ✓ WIRED | timedOut → throw carrier; propagates to planOnce → planner_failed fallback |
| TimeoutError carrier | classifyProviderError TIMEOUT | isTimeoutError import L40 | ✓ WIRED | checked before the abort branch; user cancels stay UNKNOWN |
| Router closure retry decision | D-17 retry | attempt(isRetry) | ⚠️ PARTIAL | retries 5XX/NETWORK/RATE_LIMITED exactly once; TIMEOUT never reaches the closure on the production path (WR-03A) |
| ChatPage footer | useStreamingLLM.retry | handleRetry | ✓ WIRED | latest-bubble-only gate; NEW operationId per retry |
| hasActiveProvider | registerProvider / markProviderKeyUnreadable | entry iteration | ✓ WIRED | any-usable gate survives disabled/unreadable last provider |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| verify:phase-3 full gate (eslint + prettier + tsc + wxt build + vitest + isolation) | `pnpm run verify:phase-3` | visible pipeline completes: build 19.1 s; **57 files / 465 tests passed**; `check-content-bundle: 1 content bundle(s) + 1 background SW bundle(s) clean`; all 6 steps exit 0 individually in a stable shell state | ✓ PASS |
| CR-01 regression suite | `pnpm vitest run tests/core/ai/AgentOrchestrator.budget.test.ts` | 3/3 pass — 2-tool turn answers, renderer ran, retryCount 0; repair turn; D-17 retry turn (retryCount 1) | ✓ PASS |
| WR-02A breaker-vote probe (temp, real Router) | 3×recordFailure('openai','STREAM_FAILED') → isBreakerOpen? | `isBreakerOpen === false` (contrast 3×PROVIDER_5XX → true) — **defect confirmed** | ✗ CONFIRMED |
| WR-03A timeout-retry probe (temp, real requestJson + real Router closure, 25 ms timeout) | generateObject call count / retryCount / ledger code | rejects `TimeoutError` but generateObject called **1×**, retryCount **0**, ledger `'UNKNOWN'` — **D-17 retry never fires on the production timeout path** | ✗ CONFIRMED |
| zz-verify-cr01.test.ts housekeeping | file presence | ABSENT; no stale references (only a comment in AgentOrchestrator.budget.test.ts) | ✓ PASS |
| Debt markers in 6 modified files | grep TBD/FIXME/XXX/console.log/debugger | 0 matches | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| (no phase-declared probe scripts) | — | verify:phase-3 gate is the phase's acceptance mechanism; green | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| AI-01 | 03-01/02/05/09/13 | Four providers + custom baseURL | ✓ SATISFIED | Adapters + factory; WR-01 any-usable gate closed; gate suites green |
| AI-02 | 03-03/04/06/10 | Planner→Executor→Renderer loop | ✓ SATISFIED | CR-01 closed — allowed tool-loop turns complete with answers (budget regression); loop + schema suites green |
| AI-03 | 03-03/06/08/09/12/14 | Streaming end-to-end | ✓ SATISFIED | RendererService + ChunkBuffer + ChatPage; WR-04 retry fix; suites green |
| AI-04 | 03-05/06/09/10/11/12 | Tier caps + monthly budget (cheapest-capable) | ✓ SATISFIED (per recorded scope, with caveats) | Tier caps + retry-bounded R-2 + no-op budgetGuard ship; monthly aggregate deferred to Phase 6 (D-16, documented). ⚠️ WR-02A (streaming breaker inert) + WR-03A (timeout D-17 retry unrealized) still degrade the cost-governor integration — see gaps |
| AI-05 | 03-03/07/09/14 | PersonaInjector + OptimizedContext pipeline | ✓ SATISFIED | Persona pipeline; no React-side prompt assembly |
| AI-06 | 03-08/09/14 | RICH chat surfaces render streamed AI output | ✓ SATISFIED (Phase-3 scope) | Bubble/Sender streaming surface; RICH extras fenced to Phase 7 (D-03); WR-04 regression green |
| AI-07 | 03-01 (re-mapped) | MCP client + NowPilotMainServer + MCPRegistry | ✓ ACCOUNTED (deferred) | Re-mapped to Phase 8 (D-06) in REQUIREMENTS.md/ROADMAP/§18 — NOT a Phase-3 deliverable |

All 7 requirement IDs from the phase requirement list (AI-01…AI-07) are accounted for — 6 satisfied (AI-04 with documented caveats), 1 accounted-deferred. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| src/core/ai/ProviderRouter.ts | 186-195, 760-762 | STREAM_FAILED absent from BREAKER_VOTES; voteBreaker early-returns on 0 (WR-02A) | ⚠️ Warning | Streaming-path circuit breaker remains inert — mid-stream-failing providers are retried every turn |
| src/core/ai/StructuredOutput.ts | 94-99 + ProviderRouter closure | timeout abort hits the closure's signal; carrier born after the retry decision (WR-03A) | ⚠️ Warning | D-17 retry on TIMEOUT unrealized on the production path; TIMEOUT breaker vote (BREAKER_VOTES.TIMEOUT=1) unreachable from timeouts |
| src/core/ai/ProviderRouter.ts | 782-784 | isAbortError still `instanceof Error &&` name-match (IN-06, carry-forward) | ℹ️ Info | jsdom DOMException falls through to UNKNOWN — branch untested-as-written in the test realm; production correct |
| — | — | TBD/FIXME/XXX/placeholder/console.log/debugger in gap-closure-modified files | ℹ️ None | 0 matches across ProviderRouter/StructuredOutput/RendererService/ProviderRegistry/ChatPage/TimeoutError |
| — | — | New dependencies | ℹ️ None | `tech-stack added: []` in all five gap-closure summaries; package.json untouched |

### Human Verification Required (carried forward from prior verification — still relevant)

1. **Live streaming chat with a real provider** — configure a provider in Settings, open the Side Panel chat, send a message. Expected: incremental caret stream, correct bubble styling, plain-text completion. Why human: real-time streaming feel, visual appearance, and scroll behavior are not observable in jsdom.
2. **Live mid-stream provider failure** — induce a provider-side streaming failure and observe the UI across subsequent turns. Expected: per WR-02A the breaker does NOT open from STREAM_FAILED (0 votes) — the provider is retried every turn; confirm whether this matches the intended failure surface.
3. **Planner timeout with a slow provider** — confirm the visible `planner_failed` fallback answer surfaces (the prior silent-idle is fixed) and observe that no retry is attempted (WR-03A). Why human: requires a real slow provider.
4. **Multi-provider gate** — configure openai (healthy) + ollama (disabled/unreadable envelope) and verify the chat remains usable (WR-01 fix live-check). Why human: latent in unit tests; only a real multi-provider configuration exercises it.

### Gaps Summary

**Re-verification result:** Three of the five prior gaps are **fully closed with verified code + passing regression tests**: CR-01 (retry-scoped R-2 budget — the permanent orchestrator regression proves a medium-tier 2-tool turn now answers with the renderer running and retryCount 0), WR-01 (any-usable D-07 gate), and WR-04 (latest-bubble Retry gate). The verify:phase-3 gate is green (57 files / 465 tests, isolation clean), no new dependencies, no debt markers, and the throwaway temp reproduction file was removed.

**Two gaps remain partially closed**, and the post-execution review's two new warnings (WR-02A, WR-03A) are **both real** — independently confirmed by code measurement AND empirical probes against the real Router (not inherited from the review):

- **WR-02A** — the streaming-path breaker vote is inert: `BREAKER_VOTES` has no `STREAM_FAILED` entry, `voteBreaker` early-returns on 0, and both RendererService call sites hardcode `STREAM_FAILED` instead of the plan's stated "classifier's mapped code". 3 mid-stream failures never open the breaker (probe: `isBreakerOpen === false`). The original WR-02 observable consequence — "a provider failing mid-stream accrues no breaker votes and is retried every turn" — is unchanged. The WR-02 regression tests mock the Router and cannot detect a 0-vote.
- **WR-03A** — the D-17 retry on TIMEOUT never fires on the production path: the per-attempt timeout abort produces a bare AbortError inside the router closure (classified UNKNOWN, not retryable) before the TimeoutError carrier is born. The primary user-visible WR-03 symptom (silent idle) IS fixed — a timeout now surfaces a visible `planner_failed` fallback answer — but the "TIMEOUT gets exactly ONE router retry" claim is satisfied only by test injection (the unit test feeds the carrier as the SDK mock rejection, an arrival pattern production never produces).

**Deferral check (Step 9b):** Neither residual is addressed by any later phase — Phase 3a is trajectory/evidence machinery (AGT-01…05), Phase 6 is transaction logging/diagnostics. Both remain actionable gaps for Phase 3.

**Net:** the phase goal is substantively closer — the flagship CR-01 blocker is closed and the chat surface is functional — but the phase is NOT complete: the SC3 cost-governor claim still carries two empirically-confirmed defects (streaming breaker inert; TIMEOUT retry unrealized), so status remains **gaps_found** (2 structured gaps).

---

_Verified: 2026-08-11T03:10:00Z_
_Verifier: the agent (gsd-verifier, re-verification)_
