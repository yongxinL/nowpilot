---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 09
subsystem: ai-runtime-wiring
tags: [surface-wiring, vault-decrypt, provider-registry, router-configure, privacy-mode, r-3-isolation, verify-phase-3, content-bundle, spec-addendum, typescript]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: 03-01 canonical types (ProviderConfig, ProviderId, PromptSection, ProviderConfigSchema), 03-02 ProviderRegistry (registerProvider/markProviderKeyUnreadable/getProviderInfos, D-21), 03-05 ProviderRouter configure()/createStageInvocation (baseline fallback seam), 03-07 personaConfig readPersonaPrefs (D-09) + TierResolver privacyModeFromPrefs (D-13), 03-08 the streaming hook consuming the configured runtime, KeyVault decryptSecret (Phase 2) + EncryptedStorage serialize/deserializeEnvelope + Setting settingRead (Phase 2)
provides:
  - src/entrypoints/sidepanel/main.tsx (modified): runAIRuntimeInit() — np_providers.<id> envelope read (Setting.read) → deserialize → KeyVault.decryptSecret → ProviderConfigSchema Zod gate → registerProvider / markProviderKeyUnreadable (enabled:false, NO auto-wipe D-04); np_persona via readPersonaPrefs; getProviderRouter().configure({ configuredProviders, privacyMode: privacyModeFromPrefs(prefs) }) BEFORE any send (D-13); every step wrapped (debugLog + fall-through, Golden Rule 9, T-03-09-03); chained AFTER runStorageBootstrap so decrypt has an installSecret
  - src/entrypoints/standalone/main.tsx (modified): the SAME runAIRuntimeInit() + module-scope wiring (mirrored surface init)
  - src/core/ai/ProviderRouter.ts (modified): configure() baseline (budgetGuard D-16 + configuredProviders + privacyMode D-13) with per-call fallback in createStageInvocation (hook 03-08 values still win when supplied)
  - src/core/ai/types.ts (modified): ProviderConfigSchema + ProviderConfigInput (T-03-09-04 V5 Input Validation — the vault→registry Zod boundary gate)
  - tests/isolation/check-content-bundle.mjs (modified): FORBIDDEN_TOKENS extended to the AI runtime/@ai-sdk (ProviderRouter/PlannerService/ExecutorService/RendererService/AgentOrchestrator/streamText/generateText/generateObject, Pitfall 6) + a background-SW scan using the narrower R-3 AI/vault token set (wxt's shared react/antd chunk artifact is excluded — build-system, not a source import)
  - package.json (modified): verify:phase-3 = eslint + prettier --check + tsc --noEmit + wxt build + vitest run + isolation check — FULL tests/core/ai/** + tests/components/** suite, NO exact-count-of-8 assertion (P-5)
  - .planning/PRODUCT_SPEC_v0_1.md (modified): §18 Phase-3 addendum recording (a) the two Appendix-I input-only deviations (onStreamDelta + invocation) + contextHelper as Phase-4 deletion target; (b) +1 files (contextHelper, personaConfig, useStreamingLLM) + the D-08 fixture; (c) P-3 PromptSection home move; (d) F-4 sections-in signature + F-5 application owner; (e) P-5 count reconciliation; (f) P-3b canonical type-home seeds
  - .planning/phases/03-cost-effective-ai-runtime-persona-seed/03-09-SUMMARY.md (new)
affects: [Phase 3a (runAgentTurn rewiring — the D-20 verbatim output struct is consumed by the surface), Phase 4 (ContextOptimizer replaces contextHelper — deletion target recorded), Phase 5 (PreferenceMemoryStore writer swaps the personaConfig accessor provider; memory/types.ts canonical home extended in place), Phase 7 (promotes useStreamingLLM to src/hooks/, provider settings UI writes np_providers.<id> envelopes), R-3 isolation (background SW stays AI/vault-free — machine-checked)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "R-3 surface wiring seam (03-09): the ONLY place the AI runtime + vault decrypt run on a surface — np_providers.<id> envelope (Setting.read) → deserializeEnvelope → decryptSecret → ProviderConfigSchema.safeParse → registerProvider, with decrypt failure converging on the single PROVIDER_KEY_UNREADABLE state (markProviderKeyUnreadable, enabled:false, no wipe/regenerate D-04)"
    - "Router baseline before any send: getProviderRouter().configure({ configuredProviders, privacyMode }) at mount — createStageInvocation falls back to the baseline when a caller omits per-call values (D-13: privacyModeFromPrefs(false) → 'prefer-local', true → 'cloud-ok'; 'local-only' reserved)"
    - "Machine-checked R-3 isolation: the content-bundle checker now scans BOTH content-scripts AND the background SW with the AI/vault token set (Pitfall 6); the background stays PROXY_FETCH/alarms/context-menus/CORS only"
    - "Verify script as a spec-mandated artifact: verify:phase-3 runs the FULL suite and deliberately avoids an exact test-count assertion (P-5 — '8 §18 test files' is a documentation subset marker)"

key-files:
  created:
    - .planning/phases/03-cost-effective-ai-runtime-persona-seed/03-09-SUMMARY.md
  modified:
    - src/entrypoints/sidepanel/main.tsx
    - src/entrypoints/standalone/main.tsx
    - src/core/ai/ProviderRouter.ts
    - src/core/ai/types.ts
    - tests/isolation/check-content-bundle.mjs
    - package.json
    - .planning/PRODUCT_SPEC_v0_1.md

key-decisions:
  - "The AI runtime init chains AFTER runStorageBootstrap (module scope) so KeyVault's installSecret first-run precedes any decryptSecret call — ordering is a correctness requirement, not just a convention"
  - "runAIRuntimeInit enumerates the four canonical provider ids (AI_PROVIDER_IDS const matching §0.2) — no dynamic key discovery; missing np_providers.<id> = unconfigured (skip); a malformed envelope (not a serialized §15.2 wire form) or a ProviderConfigSchema-invalid plaintext = markProviderKeyUnreadable (never a raw register)"
  - "API keys exist only inside runAIRuntimeInit's function scope (T-03-09-01); the registry stores apiKey-stripped snapshots (R-10); decrypt failures are debugLogged with the canonical PROVIDER_KEY_UNREADABLE code (Golden Rule 9)"
  - "The background-SW isolation scan uses a NARROWER token set than the content bundle: wxt's shared _virtual_wxt-plugins chunk legitimately pulls the react/antd chunk into background.js (a build artifact, not a source import), so only the R-3 AI/vault tokens are asserted for the background"
  - "verify:phase-3 mirrors the Phase-1/2 gate template (eslint + prettier + tsc + wxt build + vitest run + isolation check) and explicitly does NOT assert a test-file count of 8 (P-5)"
  - "AI-01 checkbox marked complete (provider config presence + unreadable state flow through the registry boundary as typed data); AI-03/AI-04/AI-05/AI-06 completion per the 03-01 precedent — the end-to-end loop and RICH surface complete in later phases"

patterns-established:
  - "Entrypoint wiring as a wrapped, non-blocking fire-and-forget chain (Golden Rule 9): each decrypt/register/configure step is individually try/caught with a canonical §C.2 debugLog and fall-through — a vault/router/persona failure never blocks the mount (T-03-09-03)"
  - "Zod boundary at every untrusted boundary: ProviderConfigSchema (V5 Input Validation) validates decrypted vault plaintext before registerProvider — same pattern as PlannerDecisionSchema/PersonaProfileSchema"

requirements-completed: [AI-01, AI-03, AI-04, AI-05, AI-06]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Both surfaces (sidepanel + standalone) fire runAIRuntimeInit at mount — np_providers.<id> vault envelopes decrypt via KeyVault, configured providers register, np_persona loads, Router.configure() establishes the baseline (configuredProviders + D-13 privacyMode) before any send"
    requirement: AI-01
    verification:
      - kind: unit
        ref: "tests/entrypoints/sidepanel.test.tsx#mounts the tree without throwing"
        status: pass
      - kind: unit
        ref: "tests/entrypoints/standalone.test.tsx#mounts the tree without throwing"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit exit 0 after the wiring (entrypoints compile with the AI runtime imports)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ProviderConfigSchema Zod gate (T-03-09-04) + ProviderRouter.configure baseline — decrypted envelopes are schema-validated before registerProvider; createStageInvocation falls back to the wiring baseline when per-call values are omitted"
    verification:
      - kind: unit
        ref: "src/core/ai/types.ts#ProviderConfigSchema (z.object boundary gate, R-1 co-located with ProviderConfig)"
        status: pass
      - kind: other
        ref: "npx vitest run tests/core/ai (ProviderRouter suite green after configure() baseline)"
        status: pass
    human_judgment: false
  - id: D3
    description: "R-3 isolation machine-check — the content bundle excludes the AI/@ai-sdk symbols (Pitfall 6) and the background SW contains zero AI/vault tokens; verify:phase-3 gate script runs the FULL suite with no exact-count-of-8 assertion (P-5)"
    verification:
      - kind: other
        ref: "node tests/isolation/check-content-bundle.mjs → 1 content bundle(s) + 1 background SW bundle(s) clean"
        status: pass
      - kind: other
        ref: "package.json verify:phase-3 script (eslint + prettier + tsc + wxt build + vitest run + isolation check)"
        status: pass
    human_judgment: false
  - id: D4
    description: "§18 Phase-3 addendum in PRODUCT_SPEC_v0_1.md — records the Appendix-I input-only deviations, contextHelper as Phase-4 deletion target, +1 files + D-08 fixture, P-3 PromptSection home move, F-4/F-5 seam corrections, P-5 count reconciliation, P-3b canonical type-home seeds"
    verification: []
    human_judgment: true
    rationale: "The addendum's completeness (every deviation/extra/correction enumerated for the next planner) is a documentation-fidelity judgment — a human should confirm all six required sub-items (a-f) are recorded before the phase is trusted as closed."

# Metrics
duration: 15min
completed: 2026-08-10
status: complete
---

# Phase 3 Plan 9: Surface Wiring + verify:phase-3 + §18 Addendum Summary

**Both surfaces (Side Panel + Standalone) wire the AI runtime at mount — vault provider envelopes decrypt → registry → Router.configure baseline (D-13 privacyMode) — with the full verify:phase-3 gate (R-3 isolation machine-checked) and the §18 Phase-3 addendum recording every deviation/extra/correction for the next phase**

## Performance

- **Duration:** 15 min
- **Started:** 2026-08-10T22:26:08Z
- **Completed:** 2026-08-10T22:40:42Z
- **Tasks:** 8
- **Files modified:** 7

## Accomplishments
- `runAIRuntimeInit()` in both entrypoints: np_providers.<id> envelope decrypt → ProviderConfigSchema gate → registerProvider / markProviderKeyUnreadable (single PROVIDER_KEY_UNREADABLE state, no auto-wipe); np_persona via the D-09 accessor; `Router.configure({ configuredProviders, privacyMode: privacyModeFromPrefs(prefs) })` before any send
- Content-bundle isolation extended (Pitfall 6): content-scripts now also forbid the AI/@ai-sdk symbols, and the background SW is scanned with the R-3 AI/vault token set — the background stays PROXY_FETCH/alarms/context-menus/CORS only
- `verify:phase-3` gate script (eslint + prettier + tsc + wxt build + vitest run + isolation check) — runs the FULL tests/core/ai/** + tests/components/** suite with NO exact-count-of-8 assertion (P-5)
- §18 Phase-3 addendum in PRODUCT_SPEC_v0_1.md — the authoritative record of the Appendix-I input-only seams, the D-02 Phase-4 deletion target, +N files/fixture, and the P-3/P-3b/F-4/F-5/P-5 corrections

## Task Commits

Each task was committed atomically:

1. **Task 1-3: runAIRuntimeInit() + Router.configure (sidepanel + standalone)** - `cf4000c` (feat)
2. **Task 4: content-bundle isolation extension + Task 5: verify:phase-3 script** - `6979835` (test)
3. **Task 6: §18 Phase-3 addendum** - `c98b1a7` (docs)
4. **Task 7: 03-09-SUMMARY.md** - (metadata commit, next)

**Plan metadata:** `docs(03-09): complete surface wiring + verify:phase-3 plan` (metadata commit)

## Files Created/Modified
- `src/entrypoints/sidepanel/main.tsx` - runAIRuntimeInit() + module-scope wiring (envelope decrypt → registry → router.configure)
- `src/entrypoints/standalone/main.tsx` - the same runAIRuntimeInit() + module-scope wiring
- `src/core/ai/ProviderRouter.ts` - configure() baseline (budgetGuard/configuredProviders/privacyMode) + createStageInvocation per-call fallback
- `src/core/ai/types.ts` - ProviderConfigSchema + ProviderConfigInput (V5 Input Validation boundary gate)
- `tests/isolation/check-content-bundle.mjs` - AI/@ai-sdk forbidden tokens + background-SW R-3 scan
- `package.json` - verify:phase-3 script
- `.planning/PRODUCT_SPEC_v0_1.md` - §18 Phase-3 addendum

## Decisions Made
- AI init chains AFTER runStorageBootstrap (installSecret first-run precedes decrypt)
- Four canonical provider ids enumerated (no dynamic key discovery); malformed envelope / schema-invalid plaintext → markProviderKeyUnreadable
- Background isolation scan uses a narrower token set than content-scripts (wxt shared react chunk is a build artifact)
- verify:phase-3 mirrors the Phase-1/2 gate template; no test-count assertion (P-5)
- AI-01 marked complete; AI-03/04/05/06 completion per the 03-01 precedent (end-to-end loop + RICH surface land later)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Correctness] Background SW isolation scan scope narrowed**
- **Found during:** Task 4 (check-content-bundle.mjs)
- **Issue:** Scanning background.js with the FULL FORBIDDEN_TOKENS set flagged `react` — wxt's shared `_virtual_wxt-plugins` chunk legitimately pulls the react/antd chunk into the background entry (a build-system artifact, not a source import). The plan's requirement is "background entrypoint grep asserts zero ai imports" (R-3) — not zero UI tokens.
- **Fix:** Added a dedicated `BACKGROUND_FORBIDDEN_TOKENS` set containing only the R-3 AI/vault tokens (ProviderRouter/PlannerService/ExecutorService/RendererService/AgentOrchestrator/streamText/generateText/generateObject/KeyVault/EncryptedStorage/idb/fflate), documented in the header.
- **Files modified:** tests/isolation/check-content-bundle.mjs
- **Verification:** `node tests/isolation/check-content-bundle.mjs` → "1 content bundle(s) + 1 background SW bundle(s) clean" exit 0
- **Committed in:** 6979835

**2. [Rule 3 - Verify gate alignment] Background.js `react` hit was a false positive, not a regression**
- **Found during:** Task 4 (isolation run)
- **Issue:** The first isolation run failed on `chrome-mv3/background.js (background SW) contains forbidden token: react`. Investigation (grep on the bundle + the `_virtual_wxt-plugins` chunk) proved the react reference is a wxt build artifact (the virtual plugins module re-exports the shared react chunk), NOT a background source import — the Phase-2 background.ts and its managers import only core messaging/error modules.
- **Fix:** Covered by the scoped BACKGROUND_FORBIDDEN_TOKENS fix above (this was the same root cause — the over-broad token set).
- **Files modified:** none (resolution via fix #1)
- **Verification:** Isolation check passes clean
- **Committed in:** 6979835

---

**Total deviations:** 2 auto-fixed (1 correctness scope, 1 verify-gate alignment — one root cause)
**Impact on plan:** Both fixes keep the R-3 machine-check meaningful (the background's AI/vault-free guarantee is what the gate enforces) without false-failing on wxt's UI chunk sharing. No scope creep.

## Issues Encountered
- Two earlier subagent dispatches for this plan returned empty bodies (transient `unknown-failure`) and were routed to inline execution per the orchestrator's failure handler — no functional impact, the plan was completed inline with all gates verified.
- The pre-existing uncommitted `README.md` edit was left untouched (documented in 03-01/03-03/03-04/03-05).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both surfaces wire the AI runtime at mount — provider config + persona + privacyMode live from first send; the D-21 gate reflects PROVIDER_KEY_UNREADABLE-disabled providers as unconfigured.
- The §18 addendum is the single record Phase 3a/4/5/7 planners must read (R-1): Appendix-I input-only seams, the D-02 contextHelper deletion target, +N files/fixture, P-3/P-3b type homes, F-4/F-5 seam notes, P-5 count semantics.
- verify:phase-3 exits 0 running the full suite — Phase 3 ends green (Golden Rule 10).

---
*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-10*
