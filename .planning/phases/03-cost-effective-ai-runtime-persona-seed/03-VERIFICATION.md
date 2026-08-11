---
phase: 03-cost-effective-ai-runtime-persona-seed
verified: 2026-08-11T09:33:00Z
status: passed
score: 5/5 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "CR-01 — R-2 budget starves the renderer on legitimate tool-loop turns (retryCount-scoped budget + permanent orchestrator regression, closed by 03-10; re-verified green)"
    - "WR-01 — hasActiveProvider() last-registration gate (any-usable entry-based gate + gate tests, closed by 03-13; re-verified green)"
    - "WR-04 — Retry targets the newest message regardless of clicked bubble (latest-bubble footer gate + 3 regression tests, closed by 03-14; re-verified green)"
    - "WR-02 / WR-02A — streaming-path breaker inert (BREAKER_VOTES.STREAM_FAILED = 1 + classifier-mapped catch voting + real-Router streamBreakdown regression, closed by 03-15)"
    - "WR-03 / WR-03A — D-17 timeout retry never fires on the production path (carrier rides signal.reason via ac.abort(timeoutError(...)); closure recovers via isTimeoutError(signal.reason), records TIMEOUT + votes before rethrow, per-attempt fresh derived controller; reframed unit test + end-to-end timeoutRetry regression, closed by 03-16)"
  gaps_remaining: []
  regressions: []
behavior_unverified_items: []
human_verification: []
---

# Phase 3: Cost-Effective AI Runtime (+ Persona seed) Verification Report — RE-VERIFICATION after 03-15/03-16 gap closure

**Phase Goal:** Four-provider AI runtime with Planner→Executor→Renderer, streaming, cost guardrails, persona from day one.
**Verified:** 2026-08-11T09:33:00Z
**Status:** passed
**Re-verification:** Yes — after gap-closure execution (plans 03-10 .. 03-16), prior status gaps_found (3/5), remaining gaps WR-02A/WR-03A now closed by 03-15/03-16.

## Goal Achievement

### Observable Truths (the 5 must-haves from the prior gap cycle — all now closed)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | CR-01 — SC3 cap exhaustion terminates with `planner_cap_reached` / `tool_cap_reached` (R-2 budget no longer starves the renderer) | ✓ VERIFIED (closed by 03-10, no regression) | `RouterAttemptState.retryCount` + both budget gates read `retryCount`; `recordAttempt(..., isRetry)` increments ONLY the D-17 retried call; `attemptCount` removed. Re-verified: `AgentOrchestrator.budget.test.ts` 3/3 PASS in this run (real Router + real budget + real stages; 2-tool turn resolves `success`, retryCount 0; D-17 retry turn retryCount 1). |
| 2   | WR-02 — circuit breaker + stream-freeze guard protect the streaming path (§1.5 / D-14: never switch after the first token; mid-stream failures vote the breaker) | ✓ VERIFIED (closed by 03-15) | `BREAKER_VOTES` (ProviderRouter.ts L199-209) now carries `STREAM_FAILED: 1` (L203); `voteBreaker` computes 1 vote and can no longer early-return 0. Mid-stream catch (RendererService.ts L132-134) classifies via `getProviderRouter().classifyProviderError(err)` and votes `cls.code` (03-12 intent: never a hardcoded double-count); non-stop branch (L148) keeps `STREAM_FAILED` — now a real vote. Freeze half intact (`firstTokenMarked` + `markStreamedFirstToken` once per render; user aborts excluded via name-match isAbortError guard). Real-Router regression `RendererService.streamBreakdown.test.ts` (4 tests) asserts breaker STATE: 3 non-stop finishes → `isBreakerOpen === true` (a single one does not — threshold), 3 mid-stream `APICallError(500)` → open via the real classifier's mapped code, 3 user aborts → never open, clean stop → never votes. Suite 4/4 PASS in this run. |
| 3   | WR-03 — ProviderRouter is the first retry layer (D-17): retryable pre-first-token codes (TIMEOUT, PROVIDER_5XX, NETWORK, RATE_LIMITED) get exactly ONE router retry per provider step | ✓ VERIFIED (closed by 03-16) | Timeout-origin carrier rides the abort reason: `ac.abort(timeoutError(ctx.timeoutMs))` (StructuredOutput.ts L102) → `signal.reason` IS the carrier; the closure's `attempt()` catch checks `isTimeoutError(signal.reason)` FIRST (ProviderRouter.ts L672 — single environment-independent guard, no instanceof conjunct on the SDK rejection) and INSIDE the guard records the failed attempt + votes `TIMEOUT` before rethrowing (L677-686), so the ledger's `attempts[0]` carries `errorCode: 'TIMEOUT'` and the outer classification maps TIMEOUT/retryable → the D-17 retry fires exactly once. Each attempt derives a fresh controller (L639-641, cleanup L699-701) so the retry runs on a non-aborted signal — never futile. End-to-end regression `StructuredOutput.timeoutRetry.test.ts` (real requestJson + REAL Router closure, 25 ms timeout, production arrival pattern): 2 SDK calls, `retryCount === 1`, ledger `attempts[0] = { outcome: 'failed', errorCode: 'TIMEOUT' }`, retry signal non-aborted; retry-also-fails → TimeoutError carrier (planner_failed source intact); healthy call never retries. Suite 3/3 PASS in this run. Reframed unit test (ProviderRouter.test.ts L354-399) now drives the production arrival pattern (abort with carrier reason → SDK rejects bare AbortError) and asserts retryCount 1 + non-aborted retry signal. |
| 4   | WR-01 — the D-07/D-21 provider gate is 'any usable provider configured' | ✓ VERIFIED (closed by 03-13, no regression) | `hasActiveProvider()` (ProviderRegistry.ts L189-194) iterates ALL entries, true on first `enabled && !keyUnreadable`; JSDoc states any-usable semantics. Gate tests green in the full AI suite. |
| 5   | WR-04 — Retry re-sends the last user input with a NEW operationId (failed bubble's partial text replaced) | ✓ VERIFIED (closed by 03-14, no regression) | ChatPage.tsx L137-139 footer gate: `m.id === messages[messages.length - 1]?.id && (m.status === 'failed' || m.status === 'offline')` — Retry renders ONLY on the latest assistant bubble; `handleRetry` last-message targeting sound. 3 regression tests green in the full suite. |

**Score:** 5/5 must-haves verified — all prior gaps closed with verified code + passing behavioral regressions.

### Roadmap Success Criteria (regression check — all pass, SC3's two defects now closed)

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1   | SC1 — User configures any provider and converses with it | ✓ VERIFIED | Four adapters (OpenAI/Anthropic/Gemini/Ollama) + OpenAICompat factory, vault→registry wiring, any-usable `hasActiveProvider` gate; provider suites green in the 168-test AI run |
| 2   | SC2 — User sees responses stream incrementally (SSE + ChunkBuffer) | ✓ VERIFIED | RendererService.streamText → onDelta → ChunkBuffer → Bubble text; streaming suites green; WR-02 freeze guard reachable |
| 3   | SC3 — usage bounded by tier caps + cheapest-capable routing, fallback + circuit breaker | ✓ VERIFIED | CR-01 closed (retry-scoped budget; `*_cap_reached` terminals reachable; 2-tool turns complete); WR-02A closed (streaming breaker live — 3 mid-stream failures open it); WR-03A closed (D-17 TIMEOUT retry real on the production path — 2 calls, retryCount 1, ledger TIMEOUT). All three permanent regressions pass in this run. |
| 4   | SC4 — Planner/Executor/Renderer schema discipline | ✓ VERIFIED | Closed discriminated union, TOOL_REJECTED gate, RENDERER_MAX_TOKENS 512, one-repair-then-fail; suites green |
| 5   | SC5 — persona overrides apply without a code change | ✓ VERIFIED | np_persona → resolvePersona → buildPersonaBlock → contextHelper [SYSTEM]; persona suites green |

**Score:** 5/5 roadmap truths verified (SC3 now fully verified — no residual defects).

### Required Artifacts — gap-closure deltas (03-15 / 03-16)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/core/ai/ProviderRouter.ts` | STREAM_FAILED breaker vote (WR-02A); timeout-reason recovery + fresh-signal retry (WR-03A) | ✓ VERIFIED | `BREAKER_VOTES.STREAM_FAILED: 1` (L203, table otherwise untouched); `isTimeoutError(signal.reason)` recovery (L672) with record+vote+rethrow ordering (L677-686); per-attempt derived `new AbortController()` (L639-641) + finally listener cleanup (L699-701); D-17 retry on fresh signal (L703-716). |
| `src/core/ai/RendererService.ts` | classifier-mapped catch voting (WR-02A) | ✓ VERIFIED | Catch (L132-134): `isAbortError` guard → `classifyProviderError(err)` → `recordFailure(providerId, cls.code, err)`; non-stop branch (L148) keeps `ERROR_CODES.STREAM_FAILED` (now a 1-vote); freeze marking unchanged. |
| `src/core/ai/StructuredOutput.ts` | carrier rides the abort reason (WR-03A) | ✓ VERIFIED | Timeout callback (L97-103): `timedOut = true` then `ac.abort(timeoutError(ctx.timeoutMs))` — `signal.reason` IS the carrier; catch's timedOut rethrow unchanged. |
| `tests/core/ai/RendererService.streamBreakdown.test.ts` | NEW permanent real-Router breaker-STATE regression (WR-02A) | ✓ VERIFIED | Only ai-sdk `streamText` stubbed; FRESH real `ProviderRouter` injected per test via hoisted holder; asserts `isBreakerOpen` STATE (4 tests): 3 non-stop → open + single does not (threshold), 3 mid-stream 5XX → open, aborts never open, clean stop never votes. 4/4 PASS in this run. |
| `tests/core/ai/StructuredOutput.timeoutRetry.test.ts` | NEW permanent end-to-end D-17 timeout-retry regression (WR-03A) | ✓ VERIFIED | Real requestJson + REAL Router + REAL resolveTier, 25 ms timeout, production arrival pattern (SDK rejects bare AbortError on signal abort): 2 SDK calls / retryCount 1 / ledger TIMEOUT / fresh retry signal; retry-also-fails → carrier; healthy → no retry. 3/3 PASS in this run. |
| `tests/core/ai/ProviderRouter.test.ts` | WR-03 unit test reframed to the production arrival pattern | ✓ VERIFIED | L354-399: `setTimeout(() => ac.abort(timeoutError(3_000)), 0)` + SDK mock rejects `DOMException('AbortError')` on signal abort; asserts 2 calls, retryCount 1, ledger `attempts[0].errorCode === 'TIMEOUT'`, retry signal non-aborted. |

### Key Link Verification (post-fix wiring)

| From | To | Via | Status | Details |
| ---- | -- | -- | ------ | ------- |
| RendererService catch | Router vote | `classifyProviderError` → `recordFailure(cls.code)` | ✓ WIRED (live) | Mapped code (PROVIDER_5XX/NETWORK/TIMEOUT → 1 vote); UNKNOWN-classifiable → 0 by design; `BREAKER_VOTES.STREAM_FAILED: 1` covers the no-error non-stop branch |
| RendererService non-stop branch | Router vote | `recordFailure(STREAM_FAILED)` | ✓ WIRED (live) | voteBreaker now accrues 1 vote per non-'stop' finish; 3 within 60 s open the 5-min window |
| RendererService delta loop | freeze mark | `markStreamedFirstToken` | ✓ WIRED | exactly once per render; `stream_frozen` guard reachable |
| StructuredOutput timeout | Router closure | `ac.abort(timeoutError(...))` → `signal.reason` | ✓ WIRED | carrier rides the abort reason; SDK drops it (bare AbortError), closure recovers via `isTimeoutError(signal.reason)` |
| Closure recovery | D-17 retry | record+vote+rethrow → outer classify TIMEOUT/retryable → `attempt(true)` | ✓ WIRED | retry runs on a fresh derived non-aborted controller; ledger `attempts[0]` = failed/TIMEOUT; exactly one retry (never 3+) |
| Retry failure | planner_failed fallback | carrier rethrown → planOnce | ✓ WIRED | `requestJson` rejects with the TimeoutError carrier → visible `planner_failed` answer (AgentOrchestrator L200) — never a silent idle, never a re-invocation (R-2) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| streamBreakdown regression | breaker STATE | real `new ProviderRouter()` per test (hoisted holder) | Yes — asserts `isBreakerOpen` on the same instance the renderer voted on | ✓ FLOWING |
| timeoutRetry regression | ledger + retry count | real `requestJson` → real Router closure → real `resolveTier` | Yes — `generateObject` call count, `retryCount`, `attempts[0]`, retry signal state asserted | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full AI test suite | `./node_modules/.bin/vitest run tests/core/ai` | 15 files / **168 tests passed** (7.84 s) | ✓ PASS |
| WR-02A real-Router breaker suite | `./node_modules/.bin/vitest run tests/core/ai/RendererService.streamBreakdown.test.ts` | 4/4 passed — 3 non-stop → open, single doesn't, 3 mid-stream 5XX → open, aborts never, clean stop never | ✓ PASS |
| WR-03A end-to-end timeout-retry suite | `./node_modules/.bin/vitest run tests/core/ai/StructuredOutput.timeoutRetry.test.ts` | 3/3 passed — 2 calls / retryCount 1 / ledger TIMEOUT / fresh signal; retry-also-fails → carrier; healthy → no retry | ✓ PASS |
| CR-01 orchestrator budget regression | `./node_modules/.bin/vitest run tests/core/ai/AgentOrchestrator.budget.test.ts` | 3/3 passed — 2-tool turn answers, retryCount 0; repair; D-17 retry turn | ✓ PASS |
| Typecheck | `./node_modules/.bin/tsc --noEmit` | exit 0 | ✓ PASS |
| Lint on the 5 modified files | `./node_modules/.bin/eslint` on ProviderRouter/RendererService/StructuredOutput + 2 new regression files | exit 0 | ✓ PASS |
| Debt markers | `grep TBD/FIXME/XXX` in the 5 gap-closure-modified files | 0 matches | ✓ PASS |
| Grep proofs | `STREAM_FAILED: 1` / `isTimeoutError(signal.reason)` | exactly 1 each in ProviderRouter.ts | ✓ PASS |
| Commits present | `git log` | `70e75d1` `80b64a7` `0e54f71` (03-15) + `d03dacd` `d1a3490` `2023a7b` (03-16) all on the branch | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| (no phase-declared probe scripts) | — | verify:phase-3 gate is the phase's acceptance mechanism; its components (vitest AI suite, tsc, eslint) re-run green in this verification | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| AI-01 | 03-01/02/05/09/13 | Four providers + custom baseURL | ✓ SATISFIED | Adapters + OpenAICompat factory; any-usable gate (WR-01) closed; gate suites green |
| AI-02 | 03-03/04/06/10 | Planner→Executor→Renderer loop | ✓ SATISFIED | CR-01 closed — allowed tool-loop turns complete with answers (budget regression re-run green); loop + schema suites green |
| AI-03 | 03-03/06/08/09/12/14 | Streaming end-to-end | ✓ SATISFIED | RendererService + ChunkBuffer + ChatPage; WR-04 retry fix; WR-02 streaming breaker now live (03-15); suites green |
| AI-04 | 03-05/06/09/10/11/12/15/16 | Tier caps + monthly budget (cheapest-capable) | ✓ SATISFIED | Tier caps + retry-bounded R-2 + breaker (WR-02A closed) + D-17 TIMEOUT retry (WR-03A closed); monthly aggregate deferred to Phase 6 (D-16, documented) |
| AI-05 | 03-03/07/09/14 | PersonaInjector + OptimizedContext pipeline | ✓ SATISFIED | Persona pipeline; no React-side prompt assembly |
| AI-06 | 03-08/09/14 | RICH chat surfaces render streamed AI output | ✓ SATISFIED (Phase-3 scope) | Bubble/Sender streaming surface; RICH extras fenced to Phase 7 (D-03); WR-04 regression green |
| AI-07 | 03-01 (re-mapped) | MCP client + NowPilotMainServer + MCPRegistry | ✓ ACCOUNTED (deferred) | Re-mapped to Phase 8 (D-06) in REQUIREMENTS.md L44/ROADMAP/§18 — NOT a Phase-3 deliverable |

All 7 requirement IDs (AI-01…AI-07) are accounted for — 6 satisfied, 1 accounted-deferred. No orphaned requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| src/core/ai/ProviderRouter.ts | 837-839 | `isAbortError` still uses the `instanceof Error &&` name-match form (post-gap-closure REVIEW WR-01 — 03-16's self-check grep was vacuously satisfied) | ⚠️ Warning (carry-forward, non-blocking) | Verification-integrity + maintainability defect, NOT a live behavior bug: abort → UNKNOWN either way in both realms (Chrome DOMException IS instanceof Error; jsdom falls through to the same UNKNOWN fallthrough). The WR-03A recovery guard (L672) is correctly environment-independent. Align with the canonical name-match (RendererService.ts L85-89) in a future pass. |
| src/core/ai/ProviderRouter.ts | 557-559 | `recordFailure` is vote-only — no `operationId`, pushes no `ProviderAttempt` into the D-14 ledger (post-gap-closure REVIEW WR-02) | ⚠️ Warning (carry-forward, non-blocking) | Fallback-chain blindness + D-13 gate gap on the streaming path are latent today (the orchestrator calls render once per terminal finish and propagates failure); the breaker itself works (WR-02A closed). Extending recordFailure to accept operationId is a future-pass improvement. |
| src/core/ai/ProviderRouter.ts | 672-686 | post-timeout retry failures are recovered as TIMEOUT (a genuine 5XX on the retry records as TIMEOUT) | ℹ️ Info (accepted T-03-16-02) | Ledger error-code accuracy for post-timeout retry failures; bounded to one call, same 1-vote weight — no behavioral drift; deterministically preserves the planner_failed contract (test b pins it) |
| src/core/ai/ProviderRouter.ts | 639-651 | D-17 retry runs with no armed timeout / no abort propagation (parent already aborted) | ℹ️ Info (accepted T-03-16-02) | A hung retry is unbounded but isolated to a single call, mirroring the pre-existing 5XX-retry semantics; per-attempt timeout governance for the retry is a Phase-6+ consideration |
| — | — | TBD/FIXME/XXX/placeholder/console.log/debugger in the 5 gap-closure-modified files | ℹ️ None | 0 matches across ProviderRouter/RendererService/StructuredOutput + the 2 new regression files |
| — | — | New dependencies | ℹ️ None | `tech-stack added: []` in both 03-15 and 03-16 summaries; package.json untouched |

### Human Verification (informational UAT carry-forwards — NOT blockers; unchanged from prior verification, applicable to any live-provider UI phase)

1. **Live streaming chat with a real provider** — configure a provider in Settings, open the Side Panel chat, send a message. Expected: incremental caret stream, correct bubble styling, plain-text completion. Why human: real-time streaming feel, visual appearance, and scroll behavior are not observable in jsdom.
2. **Live mid-stream provider failure** — induce a provider-side streaming failure. Expected (post-fix): 3 provider-originated streaming failures within 60 s now open the provider's breaker (WR-02A closed) — subsequent turns route elsewhere. Why human: requires a real provider mid-stream failure.
3. **Planner timeout with a slow provider** — confirm the visible `planner_failed` fallback answer surfaces AND, post-fix (WR-03A closed), that the D-17 retry fires exactly once on the timeout before the fallback. Why human: requires a real slow provider.
4. **Multi-provider gate** — configure openai (healthy) + ollama (disabled/unreadable envelope) and verify the chat remains usable (WR-01 live-check). Why human: only a real multi-provider configuration exercises it.

### Gaps Summary

**Re-verification result: ALL prior gaps are closed.** The two empirically-confirmed residuals from the last verification — WR-02A (inert streaming breaker) and WR-03A (D-17 timeout retry never firing on the production path) — are both fixed, wired, and pinned by permanent behavioral regressions that I re-ran in this verification:

- **WR-02A → closed by 03-15.** `BREAKER_VOTES.STREAM_FAILED: 1` (ProviderRouter.ts L203) makes the no-error non-stop branch's vote real, and the mid-stream catch now classifies the underlying provider error and votes its mapped code (RendererService.ts L132-134). `RendererService.streamBreakdown.test.ts` drives a FRESH real ProviderRouter through the full render flow and asserts breaker STATE: 3 non-stop finishes open the breaker, a single one does not (threshold), 3 mid-stream `APICallError(500)` failures open via the real classifier, user aborts never open, a clean stop never votes. A regression back to a 0-vote table fails this suite immediately. **4/4 PASS in this run.**
- **WR-03A → closed by 03-16.** The timeout-origin abort carries the typed carrier as `signal.reason` (`ac.abort(timeoutError(ctx.timeoutMs))`, StructuredOutput.ts L102); the router closure recovers it with the single environment-independent guard `isTimeoutError(signal.reason)` (ProviderRouter.ts L672), records the failed TIMEOUT attempt + votes the breaker BEFORE rethrowing (L677-686), and each attempt derives a fresh controller so the D-17 retry runs on a non-aborted signal. `StructuredOutput.timeoutRetry.test.ts` proves the retry END-TO-END through real `requestJson` + a REAL Router: 2 SDK calls, `retryCount === 1`, ledger `attempts[0].errorCode === 'TIMEOUT'`, retry signal non-aborted; retry-also-fails rejects with the carrier (planner_failed source intact); a healthy call never retries. The reframed unit test (ProviderRouter.test.ts L354-399) pins the production arrival pattern. **3/3 PASS in this run.**

**Independent confirmation (this run):** `vitest run tests/core/ai` — 15 files / 168 tests passed; `tsc --noEmit` exit 0; eslint exit 0 on the 5 modified files; the CR-01/WR-01/WR-04 regressions remain green (budget 3/3); 0 debt markers; both 03-15 and 03-16 commit sets present in `git log`.

**Deferral check (Step 9b):** No gaps remain to defer. The post-gap-closure REVIEW's two warnings (isAbortError `instanceof` form at ProviderRouter L837-839 — verification-integrity only, behavior correct; `recordFailure` vote-only ledger gap on the streaming path — latent, breaker works) and two info items (post-timeout retry masking; retry without armed timeout) are carried forward as non-blocking review findings, not phase gaps.

**Net:** the phase goal — four-provider AI runtime with Planner→Executor→Renderer orchestration, streaming, cost guardrails (tier caps + breaker + D-17 retry), and persona from day one — is achieved. All 5 must-haves and all 5 roadmap success criteria verify; status **passed** (score 5/5).

---

_Verified: 2026-08-11T09:33:00Z_
_Verifier: the agent (gsd-verifier, re-verification)_
