---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 05
subsystem: ai-runtime
tags: [provider-router, retry, circuit-breaker, privacy-gate, f-4, f-5, prompt-cache, maxretries, typescript]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: 03-01 canonical type homes (PromptSection/ProviderId at src/core/ai/types.ts, 13-code Phase-3 C.2 block incl. PROVIDER_AUTH/PROVIDER_MODEL_UNKNOWN), 03-02 ProviderRegistry + getAISDKModel (Seam 1) + resolveTier (Appendix D, D-13 privacyMode), 03-03 applyCacheHints + PromptCacheManager (F-5 strategy owner, §19.13 cascade)
provides:
  - src/core/ai/ProviderRouter.ts — the Router owns every cost multiplier (Pitfall 1: maxRetries: 0 + explicit maxTokens on EVERY constructed SDK call), exactly ONE router retry per retryable pre-first-token code (D-17), the §1.5 circuit breaker (3 failure-votes within 60 s → open 5 min, D-14), the R-2 non-multiplying attempt budget (≤3), and the D-13 privacy gate (prefer-local: a dead local provider NEVER hops to cloud — enforced during fallback-chain traversal, never a resolveTier filter)
  - F-4 sections-in closure: callProviderJsonMode(sections, jsonSchema, signal) resolves jsonMode per provider (ollama → 'prompt', clouds → 'native') and maps cached kinds (system/tool_schemas/preferences/memory) → provider `system` and task kinds (context/task/user_input) → `prompt` via the pure joinSections helper — NO prompt.split
  - F-5 cache-hint APPLICATION: every constructed call uses the messages[] form with a CoreSystemMessage carrying providerOptions.anthropic.cacheControl sourced from applyCacheHints (03-03) — NEVER system:string
  - createStageInvocation() → resolveTier + getAISDKModel → { providerId, model, jsonMode, callProviderJsonMode } bundle — the seam 03-06/03-08 consume
  - D-16 budgetGuard no-op hook (Phase 6 wires the monthly ledger pre-flight without a rebuild)
  - Typed ProviderUnavailableError with terminal reasonCode markers (provider_unconfigured/privacy_blocked/no_candidate/budget_blocked/stream_frozen) + isProviderUnconfiguredError guard
  - tests/core/ai/ProviderRouter.test.ts — 29 new cases (89 test:ai total)
affects: [03-06 RendererService (consumes the StageInvocation messages[]+providerOptions shape — F-5 thread-through), 03-08 AgentOrchestrator (createStageInvocation → runAgentTurn stage invocations), 03-09 wiring (getProviderRouter().configure before any send), Phase 6 (budgetGuard ledger pre-flight), Phase 4 (ContextOptimizer must keep the sections-in contract)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "F-5 application boundary: the Router (createStageInvocation/buildStageMessages) is the ONLY owner that applies applyCacheHints' providerOptions onto a CoreSystemMessage inside messages[] — StreamAdapter/RendererService (03-06) thread the shape, they never compute strategy (03-03 owns strategy, 03-05 owns application)"
    - "Non-multiplying retry layering (R-2): maxRetries: 0 on every constructed call (Pitfall 1) + exactly ONE router retry per retryable step (D-17) + the ≤3 attempt budget — three bounds land here, no nesting, all under tier caps"
    - "D-13 privacy gate during fallback-chain traversal: refusedByPrivacyGate(privacyMode, from, to) is a pure predicate consulted inside createStageInvocation, never a resolveTier filter"

key-files:
  created:
    - src/core/ai/ProviderRouter.ts
    - tests/core/ai/ProviderRouter.test.ts
  modified: []

key-decisions:
  - "The D-13 privacy gate fires on RE-RESOLUTION, not inside the closure: the first createStageInvocation returns the local provider; after the local attempt fails and records in RouterAttemptState, the next createStageInvocation skips the dead local, sees the cloud candidate, and refuses with privacy_blocked (HOST_NOT_PERMITTED debugLog, redacted) — the eval fixture asserts exactly this traversal (T-03-05-01)"
  - "joinSections is the ONLY section→string mapping site: a multi-line cached section (the persona block, tool schemas) maps WHOLE to `system` — no prompt.split recovery (T-03-05-03). The F-5 fixture asserts the byte-stable [SYSTEM] text reaches the CoreSystemMessage untouched"
  - "provider_unconfigured stays a typed reasonCode marker on ProviderUnavailableError, NOT an error-code constant (Golden Rule 9); the debugLog vocabulary remains the closed 13-code Phase-3 block — no new C.2 code invented"
  - "Breaker votes (BREAKER_VOTES): RATE_LIMITED votes 0 (retryable with jitter — never opens), PROVIDER_AUTH votes 3 (opens immediately), MODEL_UNKNOWN/SCHEMA_INVALID/HOST_NOT_PERMITTED vote 0 — §20.10 verbatim"
  - "AI-01 / AI-04 checkboxes stay PENDING in REQUIREMENTS.md — this plan ships the Router but AI-01 names the full provider set + wiring (03-09) and AI-04 names the end-to-end tier-cap/monthly-budget enforcement (03-08 orchestrator + Phase 6 ledger); marking complete now would repeat the 03-01 mark-complete mistake"

patterns-established:
  - "Injected clock for deterministic breaker timing: `new ProviderRouter({ now })` — 3 votes within 60 s → open 5 min is asserted without fake timers (PromptCacheManager precedent)"
  - "resolved via injected getModel/getSDKConfig seams: CreateStageInvocationInput.getModel defaults to the real Seam-1 getAISDKModel but tests inject a stub LanguageModel — the Router never touches the vault (Pitfall 4)"

requirements-completed: [AI-01, AI-04]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "ProviderRouter cost discipline — maxRetries: 0 + explicit maxTokens on every constructed SDK call, exactly ONE router retry per retryable pre-first-token code (D-17), never retries non-retryable codes (PROVIDER_AUTH/MODEL_UNKNOWN/SCHEMA_INVALID), ≤3 attempt budget (R-2, no_candidate on exhaustion)"
    requirement: AI-04
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#maxRetries/maxTokens assertion + retry-exactly-once + non-retryable-never-retries + budget-exhaustion (4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Circuit breaker (§1.5/D-14) — 3 failure-votes within 60 s open the provider for 5 minutes; a success clears votes; an open breaker is skipped in the fallback chain"
    requirement: AI-04
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#breaker open 5 min + vote accumulation + open provider skipped (3 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-13 privacy boundary — prefer-local: a dead local provider terminates in privacy_blocked (no cloud fetch, generateObject never called); cloud-ok permits the logged hop; gate fires during fallback-chain traversal, never a resolveTier filter"
    requirement: AI-04
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#prefer-local privacy_blocked + cloud-ok legitimate hop (2 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "F-4 sections-in closure — callProviderJsonMode(sections, jsonSchema, signal); joinSections maps a multi-line cached section WHOLE to `system` (never split) and task kinds to `prompt`; pure/deterministic"
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#joinSections whole-section mapping (4 tests) + closure healthy path"
        status: pass
    human_judgment: false
  - id: D5
    description: "F-5 cache-hint application — constructed anthropic call uses messages[] with providerOptions.anthropic.cacheControl (never system:string); no providerOptions when no stable section exists; the byte-stable [SYSTEM] persona block reaches the CoreSystemMessage untouched"
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#messages[]+providerOptions shape + persona byte-stability + no-stable-section (3 tests)"
        status: pass
      - kind: other
        ref: "grep: no `prompt.split(` and no `system:` string-literal on constructed calls (src/core/ai/ProviderRouter.ts code lines, comments stripped)"
        status: pass
    human_judgment: false
  - id: D6
    description: "R-10 TraceRedactor boundary — an api key embedded in a provider error never appears in captured logs; the privacy-hop refusal log carries no prompt/key bodies (canonical HOST_NOT_PERMITTED code only)"
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#api key redaction + privacy refusal log cleanliness (2 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "D-16 budgetGuard hook — default no-op pass-through; a refusing guard terminates with budget_blocked before any SDK call (Phase 6 wires the ledger pre-flight)"
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#budgetGuard pass-through + budget_blocked (2 tests)"
        status: pass
    human_judgment: false
  - id: D8
    description: "classifyProviderError canonical mapping (D-17) — retryable pre-first-token codes (TIMEOUT/PROVIDER_5XX/NETWORK/RATE_LIMITED) vs non-retryable (PROVIDER_AUTH/PROVIDER_MODEL_UNKNOWN/SCHEMA_INVALID)"
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#classifyProviderError retryable + non-retryable (2 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 88min
completed: 2026-08-10
status: complete
---

# Phase 3 Plan 5: ProviderRouter — Cost, Privacy, and F-4/F-5 Call-Shape Ownership Summary

**The ProviderRouter that owns every cost multiplier (maxRetries: 0 + explicit maxTokens on all constructed calls, exactly one router retry per retryable code, the §1.5 circuit breaker, and the R-2 attempt budget), enforces the D-13 privacy boundary during fallback-chain traversal (prefer-local: a dead local provider never hops to cloud), and is the F-4 mapping + F-5 cache-hint application owner (sections → system/prompt via pure joinSections; messages[] + providerOptions.anthropic.cacheControl, never system:string) — the StageInvocation seam 03-06/03-08 consume, all 29 new tests green.**

## Performance

- **Duration:** 88 min (includes 2 failed subagent dispatches before inline fallback)
- **Started:** 2026-08-10T10:39:49Z (first dispatch) / resumed inline 11:59Z
- **Completed:** 2026-08-10T12:19:00Z
- **Tasks:** 10 (8 implementation + 1 test suite + 1 verify)
- **Files modified:** 2 (1 source created, 1 test file created)

## Accomplishments

- `src/core/ai/ProviderRouter.ts` — the Router is the D-17 retry layer (retryable pre-first-token codes TIMEOUT/PROVIDER_5XX/NETWORK/RATE_LIMITED get exactly ONE router retry per provider step; non-retryable PROVIDER_AUTH/PROVIDER_MODEL_UNKNOWN/SCHEMA_INVALID/HOST_NOT_PERMITTED never retry), the §1.5/D-14 circuit breaker (3 failure-votes within 60 s open a provider for 5 minutes, BREAKER_VOTES per §20.10), and the R-2 non-multiplying budget (≤3 attempts per operation → `no_candidate`). Every constructed SDK call passes `maxRetries: 0` (Pitfall 1 — ai@4 defaults to 2) and an explicit `maxTokens` (planner/repair 256, renderer 512 via input).
- **F-4 sections-in closure** — `callProviderJsonMode(sections: PromptSection[], jsonSchema, signal)` resolves jsonMode per provider (ollama → 'prompt' model-dependent, openai/anthropic/gemini → 'native') and maps cached kinds (system/tool_schemas/preferences/memory) → provider `system`, task kinds (context/task/user_input) → `prompt`, via the **pure `joinSections` helper** (the ONLY section→string mapping site; NO `prompt.split`). After a failover only the Router knows the new (providerId, model, jsonMode) triple, so only the Router hands out the matching closure.
- **F-5 cache-hint application (P-4)** — every constructed generateObject/generateText call uses the `messages[]` form with a `CoreSystemMessage` carrying `providerOptions.anthropic.cacheControl` sourced from `applyCacheHints` (03-03) when the §19.13 cascade hasn't paused hints — NEVER `system: string` (ai@4 drops the breakpoint on the string form). Byte-stability of the cached [SYSTEM] is asserted in the fixture (multi-line persona block maps whole, never split).
- **D-13 privacy gate** — `refusedByPrivacyGate` is consulted during fallback-chain traversal in `createStageInvocation`, never as a resolveTier filter: under 'prefer-local' a failing local provider terminates in a visible `privacy_blocked` state (HOST_NOT_PERMITTED debugLog, redacted) with NO cloud fetch; 'cloud-ok' permits a logged hop.
- `createStageInvocation()` — resolveTier (cheapest-capable) + getAISDKModel → returns `{ providerId, model: LanguageModel, jsonMode, callProviderJsonMode }`, the seam 03-06/03-08 consume. D-16 budgetGuard hook exists as a no-op pass-through (Phase 6 wires the monthly ledger). `markStreamedFirstToken` implements the §1.5 mid-stream freeze (never switch after the first token).
- Test suite (29 new cases): joinSections F-4 whole-section mapping, healthy-path single-call, D-13 privacy gate (both modes), breaker timing (injected clock), maxRetries: 0 + maxTokens assertion, retry-exactly-once, non-retryable-never-retries, budget exhaustion, classifyProviderError mapping, budgetGuard, F-5 messages[]+providerOptions shape, R-10 redaction fixtures, singleton + guards, source invariants (grep). `test:ai` 89/89 (8 files), full suite 340/340 (49 files) unchanged.

## Task Commits

Each task was committed atomically:

1. **Tasks 1-8: ProviderRouter.ts (scaffolding + joinSections + closure + F-5 builder + retry/breaker + privacy + budgetGuard + createStageInvocation)** - `799d512` (feat)
2. **Task 9: ProviderRouter.test.ts (29 tests)** - `c4c34c1` (test)
3. **Task 10: Verify** - no commit (verification only)

**Plan metadata:** docs commit follows this SUMMARY.

## Files Created/Modified

- `src/core/ai/ProviderRouter.ts` - retry/breaker/privacy layer + F-4 sections-in closure + F-5 messages[] builder + createStageInvocation + budgetGuard + singleton + guards
- `tests/core/ai/ProviderRouter.test.ts` - 29 contract tests (privacy, breaker, maxRetries, F-4/F-5, redaction)

## Decisions Made

- **D-13 gate fires on re-resolution:** the first `createStageInvocation` returns the local provider; after the local attempt fails (recorded in RouterAttemptState), the next re-resolution skips the dead local, encounters the cloud candidate, and refuses with `privacy_blocked`. The test fixture drives the full traversal. This is why the gate lives in `createStageInvocation`, not in a resolveTier filter (the plan's T-03-05-01 threat).
- **F-4 mapping lives ONLY in the Router:** PlannerService/RendererService stay pure (D-18/D-19) — they consume the closure, never join or split strings. `joinSections` maps whole cached sections (multi-line persona block intact) so the provider prompt cache byte-stability is preserved.
- **F-5 application owned by the Router:** `buildStageMessages` builds the `messages[]` shape with `providerOptions.anthropic.cacheControl` (anthropic only, when hints enabled) — the 03-06 renderer and 03-08 orchestrator thread this shape, they never compute cache strategy.
- **provider_unconfigured is a typed marker, not a code:** `ProviderUnavailableError.reason = 'provider_unconfigured'` stays a terminal reasonCode string (03-05 typed marker); the debugLog vocabulary remains the closed 13-code Phase-3 block (Golden Rule 9).
- **AI-01 / AI-04 stay PENDING** in REQUIREMENTS.md (see Issues Encountered).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Subagent dispatch produced empty/uncommitted results; fell back to inline execution**
- **Found during:** Tasks 1-10 (orchestrator wave dispatch for 03-05)
- **Issue:** Two `gsd-executor` subagent dispatches returned without commits: the first wrote ProviderRouter.ts (uncommitted, no tests/SUMMARY), the second produced zero changes across 22 loop steps. Log analysis showed the executor agent definition (~805 lines) is not reliably sustained to a committing end-state by the inherited `deepseek-v4-flash` model; permission config was verified NOT the blocker.
- **Fix:** Orchestrator executed the plan inline: verified the orphaned source against the plan, wrote the missing test suite, committed both atomically, and produced this SUMMARY.
- **Files modified:** src/core/ai/ProviderRouter.ts (kept), tests/core/ai/ProviderRouter.test.ts (new)
- **Verification:** tsc exit 0, eslint clean, prettier clean, 29/29 tests pass
- **Committed in:** 799d512, c4c34c1

---

**Total deviations:** 1 auto-fixed (1 Rule 1)
**Impact on plan:** Execution-path deviation only (subagent → inline). Deliverables, tests, and invariants are unchanged from the plan's contract.

## Issues Encountered

- **AI-01 / AI-04 mark-complete deliberately NOT run.** The plan frontmatter lists `requirements: [AI-01, AI-04]`, but AI-01 names the full provider set + wiring (the registry/router/tier support is real, but 03-09 wires the vault → registry → configure path) and AI-04 names end-to-end tier caps + monthly budget (03-08 orchestrator + Phase 6 ledger). Marking either complete now would repeat the documented 03-01 mark-complete mistake (03-02/03-03/03-04 precedent: primitive-shipping plans leave checkboxes `[ ]`; requirements-completed frontmatter records the plan's stated linkage only).
- **Subagent reliability on this runtime:** `gsd-executor` dispatches return empty `<task_result>` and incomplete work (2 consecutive failures on 03-05). Root cause investigated: permission config is not the blocker (write/bash allowed; only todowrite/task denied); log shows clean streams with no errors/quota signals. The 43KB executor definition plus plan context appears to exceed what the inherited model reliably completes. Mitigation for the remaining phase: inline execution by the orchestrator.
- README.md carries the same pre-existing uncommitted documentation edit noted in 03-01/03-03/03-04 — left untouched (out of this plan's scope).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **03-06 (RendererService + AgentOrchestrator):** `createStageInvocation()` returns the StageInvocation bundle — RendererService builds its streamText from the invocation's `messages[]`+`providerOptions` shape (F-5 thread-through, never system:string); AgentOrchestrator resolves per-stage invocations via `input.invocation` (StageResolver) and consumes PlannerService/ExecutorService from 03-04. `markStreamedFirstToken` implements the §1.5 mid-stream freeze the renderer-stage path calls.
- **03-08 (hook/orchestrator):** `getProviderRouter().configure()` (D-16 budgetGuard seam) is called by the 03-09 wiring before any send; the hook consumes the StageInvocation → `runAgentTurn`.
- **03-09 (wiring):** `getProviderRouter().configure({ configuredProviders, privacyMode: privacyModeFromPrefs(prefs) })` before first send; the vault-safe provider path flows registry → configure → createStageInvocation.
- Cost discipline is proven at the Router layer: maxRetries: 0, exactly-one-retry, breaker, ≤3 attempts — the AI-SPEC "Cost discipline" eval dimension (Critical) is covered by this plan's tests. Privacy boundary honesty (Critical) covered by the D-13 fixtures.

---
*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-10*

## Self-Check: PASSED

- All 2 created files exist on disk (verified via `[ -f ]`)
- All 2 execution commits present in git log: 799d512, c4c34c1
- tsc --noEmit exit 0 · eslint clean on both files · prettier --check clean · test:ai 89/89 (8 files) · ProviderRouter suite 29/29
- F-4 proven: callProviderJsonMode has 3 params (sections, jsonSchema, signal); joinSections maps a multi-line cached section WHOLE to `system` (byte-identical, never split) — 4 joinSections tests + closure healthy-path test
- F-5 proven: constructed anthropic call uses messages[] with providerOptions.anthropic.cacheControl (asserted on the mock args, `'system' in args` is false) — never system:string; no providerOptions when no stable section
- Cost discipline proven: maxRetries: 0 + maxTokens on the constructed call args; exactly 2 calls on retryable 5xx (one retry); 1 call on non-retryable 401; ≤2 calls + no_candidate on budget exhaustion
- Privacy proven: prefer-local + dead local → privacy_blocked, generateObject never called; cloud-ok → legitimate hop to openai
- R-10 proven: api key literal absent from captured console.error; privacy refusal log carries HOST_NOT_PERMITTED and no persona/key bodies
- Grep gates: no `prompt.split(` code path (comments stripped); no `system:` string literal on constructed calls; PromptSection imported from '@/core/ai/types'
