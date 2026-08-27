---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 05
subsystem: ai-runtime
tags: [provider-registry, tier-resolver, provider-router, circuit-breaker, fallback, np_endpoint_overrides]

# Dependency graph
requires:
  - phase: 03
    plan: 01
    provides: ILLMProvider interface, ProviderId/ModelTier/RouterAttemptState/StreamEvent types, StreamErrorCode closed set
  - phase: 03
    plan: 02
    provides: UserPreferences (fastModel/balancedModel via np_preferences) — TierResolver's persisted-preference read target (A1)
  - phase: 03
    plan: 03
    provides: the five ILLMProvider adapters whose singletons this registry registers declaratively (D-51)
  - phase: 02
    provides: chromeStorageAdapter read path (np_providers + np_endpoint_overrides), NP-STRICT ceiling 0, EncryptedStorage EncryptedBlob (opaque passthrough)
provides:
  - ProviderRegistry — D-49 normalize-in-memory (disk Phase-2 object stays untouched; 'claude'→'anthropic' at this boundary only), D-50 np_endpoint_overrides merged over §10.6 ENDPOINTS (zod-validated http(s), T-3-16), D-51 sync reads (getEnabled/getById/getAll) + declarative registration, D-52 live-model discovery + session cache (getCachedModels)
  - TierResolver — Appendix D mechanism verbatim with D-53 capability-tiers-only TIER_TO_MODEL_CANDIDATES (zero vendor slugs, no OpenAICompat default D-56) and the D-54/D-54a null contract (null until persisted prefs validated against the D-52 cache)
  - ProviderRouter — §1.5/§20.10 locked retry/fallback + circuit breaker (3 votes/60s → open 5 min; AUTH opens immediately; never switch after first token; allowCloudFallbackFromLocal rule), D-54a no-model-guessing guard, attempt recording via debugLog only
  - Both surface boots hydrate the registry before UI renders (D-51 hydration-once-at-boot)
affects: [03-06 AgentOrchestrator (consumes route/resolveTier/getEnabled — the DONE-when 2 fallback gate), 03-07 Options/chat wiring (D-50 endpoint override fields write np_endpoint_overrides), Phase 8 memory (UserPreferences supersession), Phase 11 AITransactionLog (replaces debugLog attempt recording)]

actuals:
  tokens: 19513     # chars/4 over the realized diff (78,050 chars, git diff 5d03dc1^ b4ce7bc)
  tasks: 3          # tasks completed
  commits: 3        # commits made (1 per task)

# Tech tracking
tech-stack:
  added: []         # no new dependencies — zod, chromeStorageAdapter, existing singletons
  patterns:
    - "D-49 normalize-in-memory: disk Phase-2 object shape stays byte-identical; 'claude'→'anthropic' mapping lives at the registry boundary ONLY"
    - "D-50 endpoint override merge validated at read (T-3-16): zod http(s)-only refine over §10.6 defaults; localhost:12380 never canonical"
    - "Module-level circuit-breaker state across operations (§20.10) with injectable time seams via __test__"
    - "Lazy first-token consumption: the router pulls events until STREAM_START/DELTA (locked) or a pre-token failure (fallback/retry) — no premature commit, no post-token switch"

key-files:
  created:
    - src/core/ai/ProviderRegistry.ts
    - src/core/ai/TierResolver.ts
    - src/core/ai/ProviderRouter.ts
    - tests/core/ai/ProviderRouter.test.ts
    - tests/core/ai/ProviderRegistry.test.ts     # additive (acceptance-proof, 03-02 precedent)
    - tests/core/ai/TierResolver.test.ts         # additive (acceptance-proof)
  modified:
    - src/services/aiProvider.ts                 # one-line additive export of fetchModelsOrError (D-52 reuse)
    - tests/core/ai/fixtures/FixtureProvider.ts  # streamScript + providerId options (router test fixtures)
    - entrypoints/sidepanel/main.tsx             # + await ProviderRegistry.hydrate() at boot
    - entrypoints/standalone/main.tsx            # + await ProviderRegistry.hydrate() at boot

key-decisions:
  - "route() input carries a modelForProvider(providerId) callback instead of a single model — the router stays tier-agnostic (flagged assumption), candidates stay ILLMProvider[] straight from getEnabled (per plan), and D-54a is structural: a candidate with no resolved model is skipped as PROVIDER_MODEL_UNKNOWN, never guessed"
  - "Retry-once applies ONLY in the single-provider case (§1.5 verbatim); with multiple candidates the fallback to the next enabled provider IS the retry mechanism"
  - "STREAM_START counts as the first-token lock point — StreamAdapter emits it only in the same batch as the first delta, so it is equivalent to the first token for the never-switch rule"
  - "The breaker vote list resets when the breaker trips — the 5-minute open window starts a fresh vote window (test (c) asserts this)"
  - "OpenAICompat registers at hydrate when the operator assigned an endpoint (D-56): the 03-03 module has no singleton and requires baseUrl, so endpoint-assignment is its registration trigger"
  - "RouterErrorCode = StreamErrorCode | 'HOST_NOT_PERMITTED' — the §20.10 table is keyed verbatim; HOST_NOT_PERMITTED is a canonical §21.6 code (CORSProxy, Phase 17), no invented codes (D-38)"

patterns-established:
  - "Registry normalize-in-memory: disk storage shape is never rewritten for runtime needs (D-49) — the migration is normalization, not a disk write"
  - "Endpoint override merge validated at the storage boundary (T-3-16) — invalid overrides fall back to §10.6 defaults, never reach the fetch layer"
  - "Router consumes the canonical StreamEvent union and StreamErrorCode set — no invented codes anywhere in the routing stack (D-38)"
  - "Test seams via __test__ export (resetBreaker/isOpen/voteCount, registry reset/seedCachedModels) matching the chromeStorageAdapter convention"

requirements-completed: [RICH-R-09]

coverage:
  - id: D1
    description: "ProviderRegistry — hydrate() normalizes the Phase-2 np_providers object in memory (disk 'claude'→runtime 'anthropic', disk shape byte-unchanged), merges np_endpoint_overrides over §10.6 ENDPOINTS (zod-validated http(s)), exposes synchronous getEnabled/getById/getAll + declarative registerProvider (D-51), caches live-discovered models per provider for the session (D-52), and both surface boots await hydrate() before UI renders"
    requirement: "RICH-R-09"
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRegistry.test.ts#maps disk claude to runtime anthropic; disk np_providers object is byte-unchanged"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ProviderRegistry.test.ts#returns §10.6 defaults when no overrides exist"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ProviderRegistry.test.ts#merges np_endpoint_overrides over the defaults at load (D-50)"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ProviderRegistry.test.ts#rejects non-http(s) override values at hydrate — falls back to the default (T-3-16)"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ProviderRegistry.test.ts#getEnabled returns only registered + enabled providers (synchronously)"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ProviderRegistry.test.ts#refreshModels fetches via the merged endpoint and caches the list in memory"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ProviderRegistry.test.ts#both surface boots call await ProviderRegistry.hydrate()"
        status: pass
    human_judgment: false
  - id: D2
    description: "TierResolver — TIER_TO_MODEL_CANDIDATES ships capability tiers only (fast/balanced, low-cost vs higher-capability descriptors, zero vendor slugs, no OpenAICompat default D-56); resolveTier returns (providerId, model) only from persisted UserPreferences.fastModel/balancedModel validated against the D-52 discovered-model cache, and returns null for unpersisted/empty/stale assignments (D-54a — never invents a model name); Appendix D privacyMode handling verbatim"
    requirement: "RICH-R-09"
    verification:
      - kind: unit
        ref: "tests/core/ai/TierResolver.test.ts#contains exactly the keys fast and balanced"
        status: pass
      - kind: unit
        ref: "tests/core/ai/TierResolver.test.ts#contains ZERO vendor model slugs — capability descriptors only"
        status: pass
      - kind: unit
        ref: "tests/core/ai/TierResolver.test.ts#returns null when the tier preference is not persisted (no inference, no guessing)"
        status: pass
      - kind: unit
        ref: "tests/core/ai/TierResolver.test.ts#returns null when the persisted model is not in any candidate discovered set"
        status: pass
      - kind: unit
        ref: "tests/core/ai/TierResolver.test.ts#resolves a persisted openai model to (openai, model)"
        status: pass
      - kind: unit
        ref: "tests/core/ai/TierResolver.test.ts#local-only restricts candidates to ollama"
        status: pass
    human_judgment: false
  - id: D3
    description: "ProviderRouter — §20.10 locked table verbatim (TIMEOUT/PROVIDER_5XX/NETWORK retryable vote 1; RATE_LIMITED retryable-with-jitter vote 0; AUTH vote 3 opens immediately; MODEL_UNKNOWN/SCHEMA_INVALID/HOST_NOT_PERMITTED non-retryable vote 0; 3 votes/60s → open 5 min, skipped while open), §1.5 fallback (one provider down → next enabled tried — DONE-when 2; single-provider retry-once; never switch after first token; allowCloudFallbackFromLocal blocks local→cloud), D-54a no-model-guessing, attempts via debugLog only"
    requirement: "RICH-R-09"
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#(a) a NETWORK-failing provider falls through to a succeeding provider (DONE-when 2)"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#(b) PROVIDER_AUTH failure opens the provider — subsequent routes skip it"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#(c) 3 NETWORK votes within the window open the provider; the next route skips it"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#(d) a stream that fails AFTER streaming a token is NOT re-routed"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#(e) blocks the local→cloud fallback when the flag is false"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#(f) every code carries the locked retryable + CB vote"
        status: pass
      - kind: unit
        ref: "tests/core/ai/ProviderRouter.test.ts#(g) a candidate without a resolved model is skipped as PROVIDER_MODEL_UNKNOWN"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-28
status: complete
---

# Phase 3 Plan 5: Provider Routing Stack — Registry, TierResolver, ProviderRouter Summary

**Tier-resolved routing made real: ProviderRegistry normalizes the Phase-2 np_providers object in memory (D-49) with endpoint-override merge (D-50), sync reads (D-51) and live-model session cache (D-52); TierResolver resolves fast/balanced from persisted prefs validated against discovered models with the D-54a null contract; ProviderRouter implements the locked §20.10 retry/fallback + circuit-breaker table with the DONE-when-2 fallback gate proven**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-28T07:44:00Z (local +10:00)
- **Completed:** 2026-08-28T07:48:43Z (local +10:00)
- **Tasks:** 3
- **Files modified:** 10 (6 created, 4 modified)

## Accomplishments

- **ProviderRegistry (D-49/D-50/D-51/D-52):** `hydrate()` reads the Phase-2 disk shape (`{ providers, openAiKey, geminiKey }`) via the same `chromeStorageAdapter.getItem('np_providers')` path useExtensionStore uses — NO new crypto (V6): EncryptedBlob apiKeys pass through opaque. Disk 'claude' maps to runtime 'anthropic' at this boundary ONLY; the disk object stays byte-identical (read-only — a test asserts the storage snapshot is unchanged). `np_endpoint_overrides` merge over the §10.6 ENDPOINTS defaults with zod http(s)-only validation (T-3-16 — `ftp://` overrides fall back to the default, never reaching the fetch layer); `localhost:12380` never appears. `getEnabled()/getById()/getAll()` are synchronous (D-51); the four plan-03-03 singletons register at module load; OpenAICompat registers at hydrate when the operator assigned an endpoint (D-56). `refreshModels()` reuses `fetchModelsOrError` with the merged endpoint and caches per-provider in memory for the session (D-52).
- **TierResolver (Appendix D + D-53/D-54/D-54a):** `TIER_TO_MODEL_CANDIDATES` ships capability tiers ONLY — `fast`/`balanced` keys, `low-cost`/`higher-capability` descriptors, zero vendor slugs (grep-asserted, comment-filtered), no OpenAICompat default (D-56). `resolveTier` reads `fastModel`/`balancedModel` from `np_preferences` (03-02 store), applies Appendix D privacyMode handling verbatim (`local-only` → ollama only; `prefer-local` → ollama reordered first), and returns `(providerId, model)` only when the persisted model appears in an enabled candidate's discovered-model cache. The D-54a null contract is structural: unpersisted, empty-string, or stale-assignment models all resolve to null — no inference, no substitution, no guessing.
- **ProviderRouter (§1.5/§20.10):** the locked table is implemented verbatim as an exported `RETRY_TABLE` (test-asserted field-for-field): TIMEOUT/PROVIDER_5XX/NETWORK retryable + vote 1, RATE_LIMITED retryable-with-jitter + vote 0, AUTH vote 3 (opens immediately), MODEL_UNKNOWN/SCHEMA_INVALID/HOST_NOT_PERMITTED non-retryable + vote 0. Module-level breaker state: 3 votes within 60 s → provider open for 5 min, skipped while open. §1.5 rules: single-provider retry-once for retryable pre-first-token failures; never switch after the first token (a stream that dies mid-stream surfaces its error to the caller — test (d) proves no re-route); `allowCloudFallbackFromLocal=false` blocks local→cloud while permitting cloud→local. The router never invents a model — a candidate without a resolved model is skipped as PROVIDER_MODEL_UNKNOWN (D-54a).
- **DONE-when 2 gate green:** test (a) proves one provider down (NETWORK fixture) → the next enabled provider is tried and succeeds. 14 ProviderRouter tests across 7 case groups (a–g); the phase suite grew 115 → 129 tests, all green under `pnpm run verify:phase-3` (tsc strict-clean, NP-STRICT ceiling 0 held).

## Task Commits

Each task was committed atomically:

1. **Task 1: ProviderRegistry — D-49 normalize, D-50 endpoint overrides, D-51 sync reads, D-52 model cache + boot hydration** - `5d03dc1` (feat)
2. **Task 2: TierResolver — Appendix D mechanism + capability tiers + D-54a null contract** - `bdf31c5` (feat)
3. **Task 3: ProviderRouter — §1.5/§20.10 retry/fallback + circuit breaker + fallback tests** - `b4ce7bc` (feat)

**Plan metadata:** `pending` (committed with this SUMMARY)

## Files Created/Modified

- `src/core/ai/ProviderRegistry.ts` - D-49/D-50/D-51/D-52: hydrate (np_providers normalize + np_endpoint_overrides merge), registerProvider (declarative, 4 singletons at module load + OpenAICompat on endpoint assignment), sync getEnabled/getById/getAll, getEndpointFor (merged §10.6 + overrides), refreshModels/getCachedModels (D-52 discovery + session cache); `__test__` seams
- `src/core/ai/TierResolver.ts` - Appendix D mechanism + D-53 capability-tiers-only table + D-54/D-54a null contract; resolveTier(tier, { privacyMode }) → { providerId, model } | null
- `src/core/ai/ProviderRouter.ts` - §1.5/§20.10: route(input) with lazy first-token consumption, RETRY_TABLE verbatim, module-level circuit breaker (CIRCUIT_BREAKER_VOTES=3, CIRCUIT_BREAKER_WINDOW_MS=60000, CIRCUIT_OPEN_MS=300000), RouterError, allowCloudFallbackFromLocal rule, D-54a no-model skip, RATE_LIMITED jitter, debugLog attempt recording; `__test__` seams
- `tests/core/ai/ProviderRouter.test.ts` - 14 tests, 7 case groups (a: fallback DONE-when 2, b: AUTH opens breaker, c: 3-vote open + skip, d: no post-token switch, e: local→cloud rule, f: locked table verbatim, g: no-model skip)
- `tests/core/ai/ProviderRegistry.test.ts` (additive) - 11 tests proving every Task 1 acceptance criterion
- `tests/core/ai/TierResolver.test.ts` (additive) - 11 tests proving every Task 2 acceptance criterion
- `src/services/aiProvider.ts` (modified) - one-line additive `export` on `fetchModelsOrError` (D-52 reuse with the merged endpoint as proxyUrl)
- `tests/core/ai/fixtures/FixtureProvider.ts` (modified) - additive `streamScript` + `providerId` options and a `streamCalls` counter; existing requestJson path unchanged
- `entrypoints/sidepanel/main.tsx`, `entrypoints/standalone/main.tsx` (modified) - `await ProviderRegistry.hydrate()` added to the boot sequence before UI renders (D-51)

## Decisions Made

- **`modelForProvider` callback on route() input** — the router stays tier-agnostic and persona-agnostic (flagged assumption) while candidates remain `ILLMProvider[]` straight from `getEnabled()` (per plan); D-54a becomes structural (a candidate with no resolved model is skipped as PROVIDER_MODEL_UNKNOWN, never guessed).
- **Retry-once only in the single-provider case (§1.5 verbatim)** — with multiple candidates, the fallback to the next enabled provider IS the retry mechanism; the locked table's "retryable" verdict still gates the single-provider retry path.
- **STREAM_START is the first-token lock point** — StreamAdapter emits it only in the same batch as the first delta, so it is equivalent to the first token for the never-switch rule.
- **Breaker vote list resets on trip** — the 5-minute open window starts a fresh vote window; test (c) asserts the open state (not a 3-vote count after tripping).
- **OpenAICompat registers at hydrate on endpoint assignment (D-56)** — the 03-03 module has no singleton and requires baseUrl; endpoint assignment is its registration trigger (documented in code).
- **`RouterErrorCode = StreamErrorCode | 'HOST_NOT_PERMITTED'`** — the §20.10 table keys verbatim; HOST_NOT_PERMITTED is a canonical §21.6 code (CORSProxy, Phase 17), so no invented codes (D-38).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Additive acceptance-proof test files for Tasks 1 and 2**
- **Found during:** Tasks 1 and 2 (post-implementation HARD GATE review)
- **Issue:** The plan's `<files>` inventory lists only `ProviderRouter.test.ts` for the whole plan, but Task 1 and Task 2 acceptance criteria are behavioral (claude→anthropic mapping with disk unchanged, endpoint merge, T-3-16 validation, sync reads, D-54a null contract, zero-slug table) — only tests prove them repeatably. 03-02 set this exact precedent (additive UserPreferences.test.ts).
- **Fix:** Added `tests/core/ai/ProviderRegistry.test.ts` (11 tests) and `tests/core/ai/TierResolver.test.ts` (11 tests) under the already-gated `tests/core/ai` path. No source scope change.
- **Files modified:** tests/core/ai/ProviderRegistry.test.ts, tests/core/ai/TierResolver.test.ts
- **Verification:** each acceptance criterion has a direct passing test under `pnpm run verify:phase-3`
- **Committed in:** 5d03dc1 (Task 1), bdf31c5 (Task 2)

**2. [Inventory note - not a code deviation] One-line additive export of `fetchModelsOrError`**
- **Found during:** Task 1 (D-52 live-model discovery)
- **Issue:** The plan says to "reuse fetchModelsOrError" from `src/services/aiProvider.ts` (lines 38-149) but it is a private function; the plan's file inventory does not include that file.
- **Fix:** Added the `export` keyword + a doc comment (one line of behavior-neutral change). The registry passes its MERGED endpoint as `proxyUrl` so D-50 overrides apply to discovery; ollama gets the root URL (its `/api/tags` lives at the root, not under `/v1`).
- **Files modified:** src/services/aiProvider.ts
- **Verification:** `pnpm run verify:phase-3` green; D-52 refreshModels test asserts the merged endpoint reaches the fetch call
- **Committed in:** 5d03dc1 (Task 1)

**3. [Inventory note - not a code deviation] FixtureProvider extended for router tests**
- **Found during:** Task 3 (router test fixtures)
- **Issue:** FixtureProvider's `stream()` threw "not implemented" and `providerId` was hardcoded 'openai' — the plan's test list requires streaming fixtures (fail-with-code, stream-then-fail, local vs cloud ids).
- **Fix:** Additive `streamScript` + `providerId` constructor options + a `streamCalls` counter; the existing `requestJson` path is untouched. Matches D-48 fixture conventions (scripted providers, no mocked parser).
- **Files modified:** tests/core/ai/fixtures/FixtureProvider.ts
- **Verification:** all 14 router tests + all pre-existing fixture-consuming tests green
- **Committed in:** 5d03dc1 (Task 1 commit — the options were needed by the Task 1 registry test too)

**4. [Rule 3 - Blocking] Test (c) vote-count assertion vs. breaker-trip reset**
- **Found during:** Task 3 (first verify run)
- **Issue:** The test asserted `voteCount === i+1` after every route; the 3rd vote TRIPS the breaker, which (by design) resets the vote list to start a fresh window — the assertion failed with `expected 3, received 0`.
- **Fix:** Corrected the test to assert vote accumulation on the first two routes and the open state after the third (the code behaved per the §20.10 design; no source change).
- **Files modified:** tests/core/ai/ProviderRouter.test.ts
- **Verification:** all 129 tests green
- **Committed in:** b4ce7bc (Task 3)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking-test), 2 inventory notes
**Impact on plan:** All auto-fixes were required for acceptance-proof completeness (additive tests) or test correctness (breaker-trip assertion). The shipped deliverable set matches the plan's artifact inventory exactly plus the two additive test files; the fixture/export changes are additive and behavior-neutral.

## Issues Encountered

- Test (c) initially asserted the wrong post-trip vote count (see deviation 4) — resolved in-task by asserting the open state instead.
- The legacy `fetchModelsOrError` ollama branch appends `/api/tags` to the passed URL; the registry normalizes the ollama discovery URL to the root (`/v1` stripped) so D-50-merged ollama endpoints discover correctly. Handled in code (refreshModels).

## User Setup Required

None - no external service configuration required. Live provider discovery/streaming with real keys is deferred to UAT per plan; the deterministic test path is the fixture-driven route matrix + mocked-fetch discovery test.

## Next Phase Readiness

- **Ready for 03-06 (AgentOrchestrator):** `ProviderRegistry.getEnabled()` + `TierResolver.resolveTier(tier, { privacyMode })` + `ProviderRouter.route(input)` are the three consumers it wires together — the DONE-when 2 fallback gate and the D-54a configuration-required surface are already proven here. The registry constructs per-route provider instances from `getEndpointFor()` + normalized apiKey when 03-06 needs override-merged configs.
- **Ready for 03-07 (Options/chat wiring):** Options writes `np_endpoint_overrides` (D-50) and `np_preferences.fastModel/balancedModel` (D-54); the registry re-hydrates overrides at boot and TierResolver picks them up without a code change.
- **Watch items (carried):** `pnpm run verify:phase-3` covers `tests/core/ai` + `tests/core/ai/persona` — new test dirs must stay within those paths. Gemini wire shape (A2) remains flagged ASSUMED for UAT.

---

*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-28*

## Self-Check: PASSED

- All 10 files exist on disk (6 created + 4 modified, verified via `[ -f ]`)
- All 3 task commits found in git log: 5d03dc1 (Task 1), bdf31c5 (Task 2), b4ce7bc (Task 3)
- `pnpm run verify:phase-3` green after every task commit: tsc strict-clean + 129 tests across 15 files
- Grep guard: comment-filtered vendor-slug scan of the routing stack (TierResolver/ProviderRouter/ProviderRegistry) reports clean; both boots call `await ProviderRegistry.hydrate()` (grep == 1 each)
- Zero `@ts-expect-error NP-STRICT` markers in new code (NP-STRICT ceiling 0 held)