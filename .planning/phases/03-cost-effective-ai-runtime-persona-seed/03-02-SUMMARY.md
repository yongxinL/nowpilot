---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 02
subsystem: ai-runtime
tags: [ai-sdk, provider-adapters, tier-resolver, provider-registry, typescript]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: 03-01 canonical type homes — ProviderId/LLMMessage/LLMOptions/LLMStreamChunk/ModelInfo/ProviderConfig at src/core/ai/types.ts, UserPreferences at src/core/memory/types.ts, 13-code Phase-3 C.2 error block
provides:
  - src/core/ai/ILLMProvider.ts — §10.1 contract + getAISDKModel single factory switch (Seam 1, the ONLY @ai-sdk/* import site, cfg.fetch test seam A6)
  - src/core/ai/providers/{OpenAI,Anthropic,Gemini,Ollama,OpenAICompat}Provider.ts — the four §10.2 adapters (F-1 'compatible' everywhere) + the D-12 OpenAICompat factory (id stays 'openai')
  - src/core/ai/TierResolver.ts — Appendix D verbatim (ModelTier/TierCandidate/TIER_TO_MODEL_CANDIDATES/resolveTier) + PrivacyMode + privacyModeFromPrefs (D-13)
  - src/core/ai/ProviderRegistry.ts — extended in place (D-21): registerProvider/markProviderKeyUnreadable/getProviderInfo, gate closes for keyUnreadable/disabled
  - tests/core/ai/ProviderRegistry.test.ts — 10 cases: gate, four-ID rule, apiKey strip + resolvedBaseURL, unreadable-disabled no-wipe, marker-entry, D-04 re-registration, backward-compat, dependency-free
affects: [03-03 StreamAdapter (consumes getAISDKModel, Seam 3 boundary), 03-04 ExecutorService get-provider-info (reads registry), 03-05 ProviderRouter createStageInvocation (resolveTier + getAISDKModel), 03-09 wiring (registerProvider/markProviderKeyUnreadable), phase 4, phase 4b]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Seam 1 factory switch: every @ai-sdk/* package import lives in ILLMProvider.ts's getAISDKModel; adapters bind config (apiKey/baseURL/fetch) and delegate — grep-enforced"
    - "D-21 single unreadable state: markProviderKeyUnreadable is the ONE transition (decrypt-fail/cleared-secret/tampered-ciphertext) → enabled:false, never auto-wiped/regenerated; the typed PROVIDER_KEY_UNREADABLE code crosses the wiring boundary"
    - "Adapter factories return full ILLMProvider objects; chat/getModels are @implementation-tier stubs (Golden Rule 10) — streamText ownership is StreamAdapter's (Seam 3)"

key-files:
  created:
    - src/core/ai/ILLMProvider.ts
    - src/core/ai/providers/OpenAIProvider.ts
    - src/core/ai/providers/AnthropicProvider.ts
    - src/core/ai/providers/GeminiProvider.ts
    - src/core/ai/providers/OllamaProvider.ts
    - src/core/ai/providers/OpenAICompatProvider.ts
    - src/core/ai/TierResolver.ts
    - tests/core/ai/ProviderRegistry.test.ts
  modified:
    - src/core/ai/ProviderRegistry.ts

key-decisions:
  - "Adapter factories keep @ai-sdk/* imports OUT: each create*Provider({apiKey,baseURL,fetch}) binds its config into the shared getAISDKModel seam (Seam 1 holds, A6 fetch forwarded) — the plan's 'createOpenAIProvider(config) via createOpenAI' semantics live in the switch, not per-adapter imports"
  - "ILLMProvider.chat/getModels ship as throwing @implementation-tier stubs (Golden Rule 10): streamText consumption is owned by StreamAdapter (03-03, Seam 3) and getModels has no Phase-3 consumer; the factories' real deliverable is getAISDKModel + structural validateConfig"
  - "Registry snapshots (RegistryProviderInfo) strip apiKey (R-10) and compute resolvedBaseURL = customBaseURL ?? baseURL once at registration (§10.2)"
  - "AI-01 checkbox stays PENDING in REQUIREMENTS.md — the requirement also names ProviderRouter (03-05); marking it complete now would repeat the 03-01 mark-complete mistake (03-01-SUMMARY Issues Encountered)"

patterns-established:
  - "Verbatim spec code lands prettier-formatted: the repo gate is prettier --check, so Appendix D's unformatted code block is normalized (arrow parens/line-wrap) — semantics and 'as const' preserved (semantic diff vs the spec PASSes)"
  - "eslint require-yield forces non-generator throwing stubs: chat(): AsyncIterable<LLMStreamChunk> as a plain method that throws (never async * — lint-clean, tsc-clean)"

requirements-completed: [AI-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "ILLMProvider §10.1 contract + getAISDKModel single factory switch (Seam 1) — the ONLY import site of @ai-sdk/* packages; optional cfg.fetch test seam (A6); ProviderId imported from ./types (R-1, never re-declared)"
    requirement: AI-01
    verification:
      - kind: other
        ref: "grep: zero @ai-sdk/* imports outside src/core/ai/ILLMProvider.ts (PASS)"
        status: pass
      - kind: unit
        ref: "tsc --noEmit exit 0 (whole-repo)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Four §10.2 provider adapters (createOpenAIProvider/createAnthropicProvider/createGeminiProvider/createOllamaProvider) with compatibility 'compatible' everywhere (F-1), Ollama via createOpenAI localhost:11434/v1 (§10.2, no @ai-sdk/ollama), plus the D-12 createOpenAICompatProvider factory (id stays 'openai' with custom baseURL)"
    requirement: AI-01
    verification:
      - kind: other
        ref: "grep: zero `compatibility: 'strict'` in src/ + tests/ (PASS); 4× 'compatible'"
        status: pass
      - kind: unit
        ref: "tsc --noEmit + eslint + prettier --check all clean"
        status: pass
    human_judgment: false
  - id: D3
    description: "TierResolver — Appendix D verbatim resolveTier (cheapest-capable, null when none, never invents model names, 'local-only' branch reserved) + privacyModeFromPrefs D-13 mapping (false→'prefer-local', true→'cloud-ok', no prefs→'prefer-local')"
    requirement: AI-01
    verification:
      - kind: other
        ref: "semantic diff vs spec Appendix D: TIER_TO_MODEL_CANDIDATES table identical; resolveTier differs only by prettier arrow-parens/line-wrap (PASS)"
        status: pass
      - kind: unit
        ref: "privacyModeFromPrefs mapping inspected against D-13 (Q5): all three cases implemented"
        status: pass
    human_judgment: false
  - id: D4
    description: "ProviderRegistry extended in place (D-21): registerProvider (vault-safe snapshot, four-ID guard), markProviderKeyUnreadable (enabled:false, no auto-wipe/regenerate, PROVIDER_KEY_UNREADABLE emission, marker entry when decrypt precedes registration), getProviderInfo/getProviderInfos, hasActiveProvider closes for keyUnreadable/disabled (T-03-02-03)"
    requirement: AI-01
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRegistry.test.ts — 10/10 pass (gate, four-ID, apiKey strip, resolvedBaseURL, unreadable no-wipe, marker, D-04 reset, backward-compat, dependency-free)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Registry stays dependency-free (Pitfall 4) — imports only core/error + type-only types; no zustand/react"
    verification:
      - kind: unit
        ref: "tests/core/ai/ProviderRegistry.test.ts 'imports only core/error + type-only types' (source grep, PASS)"
        status: pass
      - kind: other
        ref: "grep zustand|react imports in src/core/ai/ProviderRegistry.ts (0 matches)"
        status: pass
    human_judgment: false

# Metrics
duration: 17min
completed: 2026-08-10
status: complete
---

# Phase 3 Plan 2: Provider Adapters + Tier Resolver + Registry Gate Summary

**Four provider adapters (openai/anthropic/gemini/ollama + the D-12 OpenAICompat factory) behind the single getAISDKModel factory switch (Seam 1), the Appendix-D-verbatim TierResolver with the D-13 privacyModeFromPrefs mapping, and the ProviderRegistry's PROVIDER_KEY_UNREADABLE gate — the provider layer of AI-01, proven by 10 unit tests plus import-boundary/'strict'-free greps.**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-10T06:48:00Z
- **Completed:** 2026-08-10T07:05:17Z
- **Tasks:** 10 (9 code tasks + verify)
- **Files modified:** 9 (8 created, 1 modified)

## Accomplishments

- `src/core/ai/ILLMProvider.ts` — §10.1 contract + `getAISDKModel()` single factory switch (Seam 1): the ONLY place `@ai-sdk/*` packages are imported (grep-verified); `ProviderId` imported from `./types` (R-1, never re-declared); F-1 `compatibility: 'compatible'` on both openai-id endpoints; Ollama via `createOpenAI({ apiKey: 'ollama', baseURL: localhost:11434/v1 })` (§10.2, no `@ai-sdk/ollama` — npm 404); optional `cfg.fetch` test seam (A6) forwarded to every SDK factory
- The four §10.2 adapters (`providers/OpenAI|Anthropic|Gemini|OllamaProvider.ts`) + the D-12 factory (`providers/OpenAICompatProvider.ts`): each `create*Provider(config)` returns a full ILLMProvider whose `getAISDKModel` binds apiKey/baseURL/fetch into the seam; `id` stays `'openai'` on the compat variant (never a 5th ProviderId); structural-only `validateConfig` (never network/vault, Pitfall 4)
- `src/core/ai/TierResolver.ts` — Appendix D verbatim (`ModelTier`, `TierCandidate`, `TIER_TO_MODEL_CANDIDATES` with `as const`, `resolveTier` cheapest-capable with `null` on no match, `'local-only'` branch reserved per D-13) + `PrivacyMode` + `privacyModeFromPrefs` (false→`'prefer-local'`, true→`'cloud-ok'`, no prefs→`'prefer-local'`)
- `src/core/ai/ProviderRegistry.ts` extended in place (B3/R-1, D-21): `registerProvider` (apiKey stripped — R-10, `resolvedBaseURL = customBaseURL ?? baseURL` once per §10.2, four-ID guard), `markProviderKeyUnreadable` (the single decrypt-fail/cleared-secret/tampered-ciphertext transition → `enabled:false` + `keyUnreadable:true`, no auto-wipe/regenerate per D-04, PROVIDER_KEY_UNREADABLE emission), `getProviderInfo`/`getProviderInfos` (feed get-provider-info in 03-04 + wiring in 03-09), `hasActiveProvider()` closes the gate for keyUnreadable/user-disabled providers (T-03-02-03)
- `tests/core/ai/ProviderRegistry.test.ts` — 10 cases: D-07 gate flip, four-ID rejection, apiKey strip + resolvedBaseURL, unreadable-disabled WITHOUT wipe, marker entry when decrypt precedes registration, D-04 user-driven re-registration reset, Phase-1 `registerActiveProvider` backward compat, dependency-free source grep
- All verify gates green: `pnpm test:ai` 10/10, full suite 290/290 (43 files, no Phase-1/2 regressions), `tsc --noEmit` 0, `eslint .` 0, `prettier --check .` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: ILLMProvider contract + getAISDKModel seam** - `0de86e5` (feat)
2. **Tasks 2-5: four §10.2 provider adapters** - `bdc0ad5` (feat; batched — one truth: the §10.2 four-provider table)
3. **Task 6: OpenAICompatProvider factory (D-12)** - `53fc852` (feat)
4. **Task 7: TierResolver + privacyModeFromPrefs (D-13)** - `ec30222` (feat)
5. **Task 8: ProviderRegistry extension (D-21)** - `247ecfe` (feat)
6. **Task 9: ProviderRegistry tests** - `d519a8c` (test)
7. **Rule 1 fix: eslint require-yield on chat() stubs** - `1af734a` (fix)
8. **Task 10: Verify** - no commit (verification task, no code change)

**Plan metadata:** `(docs commit follows this SUMMARY)`

## Files Created/Modified

- `src/core/ai/ILLMProvider.ts` - §10.1 contract + getAISDKModel single factory switch (Seam 1, A6 fetch seam)
- `src/core/ai/providers/OpenAIProvider.ts` - createOpenAIProvider; 'compatible' (F-1)
- `src/core/ai/providers/AnthropicProvider.ts` - createAnthropicProvider (apiKey required)
- `src/core/ai/providers/GeminiProvider.ts` - createGeminiProvider (apiKey required)
- `src/core/ai/providers/OllamaProvider.ts` - createOllamaProvider; apiKey 'ollama' + localhost:11434/v1 (§10.2)
- `src/core/ai/providers/OpenAICompatProvider.ts` - createOpenAICompatProvider; id 'openai' + custom baseURL (D-12)
- `src/core/ai/TierResolver.ts` - Appendix D verbatim + PrivacyMode + privacyModeFromPrefs (D-13)
- `src/core/ai/ProviderRegistry.ts` - extended: registerProvider / markProviderKeyUnreadable / getProviderInfo / gate semantics (D-21)
- `tests/core/ai/ProviderRegistry.test.ts` - 10 registry contract tests

## Decisions Made

- Adapter factories do NOT import `@ai-sdk/*` (Seam 1 holds): each `create*Provider(config)` binds config into the shared `getAISDKModel` switch — the plan's "via createOpenAI" semantics live in the seam, and the import-boundary grep stays green
- `chat()`/`getModels()` ship as throwing `@implementation-tier` stubs (Golden Rule 10): streamText ownership is StreamAdapter's (03-03, Seam 3 — the 03-03 truth "StreamAdapter is the ONLY consumer of streamText besides getAISDKModel/ProviderRouter" forbids adapter-level streamText); `getModels` has no Phase-3 consumer
- Registry snapshots never retain apiKey (R-10/T-03-02-01) and compute `resolvedBaseURL` once (§10.2)
- AI-01 remains PENDING in REQUIREMENTS.md: the requirement names ProviderRouter (03-05) too — `requirements mark-complete AI-01` was deliberately NOT run (mirrors the documented 03-01 mistake/revert)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] eslint require-yield rejected the async-generator chat() stubs**
- **Found during:** Task 10 (Verify — `eslint .` gate)
- **Issue:** The `async *chat()` stub methods in all five adapters contain no `yield`, violating the repo's `require-yield` eslint rule (the plan's Verify step runs eslint; 5 errors).
- **Fix:** Converted to non-async throwing methods `chat(): AsyncIterable<LLMStreamChunk>` — same @implementation-tier stub semantics (the throw satisfies the return type as `never`), lint-clean and tsc-clean.
- **Files modified:** src/core/ai/providers/{OpenAI,Anthropic,Gemini,Ollama,OpenAICompat}Provider.ts
- **Verification:** `eslint .` exit 0; `tsc --noEmit` exit 0; `prettier --check` clean; 10/10 registry tests + 290/290 full suite pass
- **Committed in:** 1af734a

---

**Total deviations:** 1 auto-fixed (1 Rule 1)
**Impact on plan:** Necessary to pass the repo's eslint gate. No scope creep; stub semantics unchanged.

## Known Stubs

- `ILLMProvider.chat()` on all five adapters throws `'ILLMProvider.chat is wired by StreamAdapter (03-03, Seam 3)'` — intentional @implementation-tier stub (Golden Rule 10). No Phase-3 consumer exists (StreamAdapter 03-03 owns streamText; the Router uses `getAISDKModel` directly). Resolved by 03-03's StreamAdapter wiring the streaming path.
- `ILLMProvider.getModels()` on all five adapters throws `'ILLMProvider.getModels is not wired in Phase 3'` — intentional @implementation-tier stub. No Phase-3 consumer; model-list calls land with a later wiring phase.

## Issues Encountered

- `privacyModeFromPrefs` semantics probe: the RESEARCH note said UserPreferences was seeded in `src/core/ai/types.ts`, but 03-01 landed it at its canonical home `src/core/memory/types.ts` (ai/types.ts imports, never re-declares) — TierResolver imports `UserPreferences` from `../memory/types` (its canonical home, R-1), which is exactly the P-3b design.
- No auth gates, no blocking issues.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 03-03 (StreamAdapter/PromptCacheAdapter) can build on `getAISDKModel` from `@/core/ai/ILLMProvider` — the Seam 3 boundary ("StreamAdapter is the ONLY consumer of streamText besides getAISDKModel/ProviderRouter") is unchanged and now importable
- 03-04 (ExecutorService) reads `ProviderRegistry.getProviderInfo/getProviderInfos` for the get-provider-info tool
- 03-05 (ProviderRouter) consumes `resolveTier` + `privacyModeFromPrefs` (D-13) and `getAISDKModel` for `createStageInvocation`; the registry's `hasActiveProvider()` gate + unreadable semantics (D-21) block broken-provider calls
- 03-09 (surface wiring) calls `registerProvider` / `markProviderKeyUnreadable` per the vault decrypt path
- AI-01 completes when 03-05's ProviderRouter lands — the REQUIREMENTS.md checkbox stays pending until then

---
*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-10*

## Self-Check: PASSED

- All 8 created files + 1 modified file exist on disk (verified via `[ -f ]`)
- All 7 execution commits present in git log: 0de86e5, bdc0ad5, 53fc852, ec30222, 247ecfe, d519a8c, 1af734a
- tsc --noEmit exit 0 · eslint . exit 0 · prettier --check . clean · pnpm test 290/290 · test:ai 10/10
- Import-boundary grep: 0 @ai-sdk/* matches outside src/core/ai/ILLMProvider.ts
- `compatibility: 'strict'` grep: 0 matches; `compatibility: 'compatible'`: 4 (openai + ollama seams + doc comments)
- Appendix D semantic diff: TIER_TO_MODEL_CANDIDATES identical; resolveTier differs only by prettier cosmetics
