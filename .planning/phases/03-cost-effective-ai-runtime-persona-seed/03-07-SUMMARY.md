---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 07
subsystem: ai-runtime
tags: [persona, persona-injector, context-helper, byte-stability, prompt-cache, np_persona, d-09, golden-rule-3, typescript]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: 03-01 canonical type homes (PromptSection/OptimizedContext at src/core/ai/types.ts, the 13-code Phase-3 C.2 block incl. PERSONA_LOAD_FAILED), 03-03 PromptCacheAdapter hashStableSections (FNV-1a byte-stability, §19.13), 03-05 buildStageMessages F-5 messages[]+providerOptions (the byte-stable [SYSTEM] persona block is what the anthropic cacheControl breakpoint caches)
provides:
  - src/core/ai/persona/PersonaProfile.ts — Appendix N.1 VERBATIM: PersonaProfileSchema (the single validation gate every np_persona read passes), PersonaProfile type, DEFAULT_PERSONA (RICH-R-01, do-not-paraphrase)
  - src/core/ai/persona/personaConfig.ts — D-09 np_persona Setting-backed accessor (+1 documented to §18 by 03-09): readPersona()/readPersonaPrefs(); empty/invalid key → PERSONA_LOAD_FAILED → DEFAULT_PERSONA (never crash, never a blocked Sender); read-only this phase (D-10); NO Setting.ts change (np_persona already registered area:'local')
  - src/core/ai/persona/PersonaInjector.ts — Appendix N.2 VERBATIM: PipelineStage (planner/executor/renderer/memoryExtractor — D-11 accepted + unit-tested, call site Phase 5), resolvePersona (deterministic personaOverrides merge), buildPersonaBlock (fixed N.2 template, ordered '\n' joins → byte-stable per persona, §1.3/RICH-R-02), PersonaInjector.inject (persona-first prepend INSIDE the cached [SYSTEM]); accessor injected as a config provider, never imported (D-10)
  - src/core/ai/contextHelper.ts — D-02 §2.3 OptimizedContext builder (+1 documented to §18, Phase-4 DELETION TARGET): buildOptimizedContext() emits PromptSection[] per '@/core/ai/types' (P-3) — persona block = stable:true system-kind (cache-eligible), user input = stable:false user_input-kind; Golden Rule 3: the ONLY prompt builder on the UI path
  - tests/core/ai/persona/{PersonaProfile,PersonaInjector}.test.ts — 30 new tests (145 test:ai / 425 full-suite green): schema validation, DEFAULT_PERSONA fallback, byte-stability hash-equality across stages + turns, all-4-stage coverage, personaOverrides-without-code-change, adversarial injection boundary (T-03-07-01), §2.3 shape determinism
affects: [03-08 useStreamingLLM hook (imports contextHelper, never PROMPTS; readPersonaPrefs → resolvePersona → buildPersonaBlock → buildOptimizedContext), 03-09 wiring (§18 addendum documents contextHelper + personaConfig as +1 files and the D-02 Phase-4 deletion target; AI-05 checkbox), Phase 5 (PreferenceMemoryStore writer swaps only the injected config provider), Phase 4 (ContextOptimizer replaces contextHelper; TokenBudget replaces estimateTokens)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Byte-stable persona block as a cache contract: resolvePersona/buildPersonaBlock are pure — same (base, prefs) ALWAYS produce the same block (FNV-1a hash-equality asserted across stages and turns); drift would kill the provider prompt caches (Pitfall 5, RICH-R-02, T-03-07-02)"
    - "D-09/T-1-13 inbound gate for user config: np_persona reads go through Setting.ts settingRead (permission table + STORE_READ handling) + PersonaProfileSchema validation — invalid/empty degrades silently to DEFAULT_PERSONA with a canonical PERSONA_LOAD_FAILED debugLog, never a throw"
    - "D-10 config-provider seam: personaConfig is INJECTED via opts.prefs (personaOverrides name/tone/brevity), never imported — Phase 5's PreferenceMemoryStore writer swaps only the injected provider (R-7: persona = np_persona, never the fact store)"

key-files:
  created:
    - src/core/ai/persona/PersonaProfile.ts
    - src/core/ai/persona/personaConfig.ts
    - src/core/ai/persona/PersonaInjector.ts
    - src/core/ai/contextHelper.ts
    - tests/core/ai/persona/PersonaProfile.test.ts
    - tests/core/ai/persona/PersonaInjector.test.ts
  modified: []

key-decisions:
  - "readPersonaPrefs() returns a FULL UserPreferences with Phase-3 base defaults for the non-persona fields (responseStyle/toolAutonomy/... — the interface requires them) and maps the stored persona's name/tone/brevity onto personaOverrides; an empty/invalid key yields the base prefs with NO overrides (base persona stands) — the persona accessor owns only the persona slice, Phase 5's writer owns the rest"
  - "contextHelper emits exactly THREE sections for the Phase-3 seed — system (persona block, stable:true) / tool_schemas (stable:true, omitted when zero refs) / user_input (stable:false); preferences/memory/context/task sections are Phase 4 (ContextOptimizer) — the plan's input list (operationId, tier, budgets, userInput, persona block, tool schema refs) is honored exactly"
  - "ContextHelperInput carries workspaceId + activeSurface (+ optional minimalMode, default false) beyond the plan's stated input list — the §2.3 ContextProvenanceManifest/OptimizedContext types REQUIRE them (v0.1 fields); operationId rides in per the plan's input list and is threaded by the hook into runAgentTurn"
  - "estimateTokens = ceil(chars/4) — a pure deterministic Phase-3 seed estimator; the seed keeps sections ≤ inputBudget BY CONSTRUCTION (small fixed sections); real budgeting/truncation/degradation is Phase 4 (§2.4 TokenBudget)"
  - "AI-05 checkbox NOT marked complete — the requirement's full text ('all AI calls consume an OptimizedContext') is only realized when the hook/UI path is wired (03-08/03-09 also claim AI-05); the requirements-completed frontmatter records this plan's stated linkage only (03-01 mark-complete mistake precedent)"

patterns-established:
  - "Single loadPersona() read path: one chrome.storage.local read, one schema validation, one fallback — readPersona()/readPersonaPrefs() share it so the validation gate can never diverge"
  - "Adversarial fixture as a pipeline boundary test: user-input injection text is asserted to (a) leave the system section byte-identical, (b) leave hashStableSections unchanged (cache keeps hitting), and (c) never appear in ANY stable section — the T-03-07-01 proof lives at the contextHelper boundary, not just the injector"

requirements-completed: [AI-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "PersonaProfileSchema + DEFAULT_PERSONA (Appendix N.1 verbatim) — the schema gate every np_persona read passes; canonical default is schema-valid"
    requirement: AI-05
    verification:
      - kind: unit
        ref: "tests/core/ai/persona/PersonaProfile.test.ts#6 schema cases (canonical valid, custom valid, missing id, bad tone enum, over-length name, empty personalityCore)"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-09 np_persona accessor — readPersona()/readPersonaPrefs() via Setting.ts settingRead (np_persona registered area:'local', NO Setting.ts change); empty/invalid → PERSONA_LOAD_FAILED → DEFAULT_PERSONA, never throws; prefs map name/tone/brevity onto personaOverrides (D-10 config-provider seam)"
    requirement: AI-05
    verification:
      - kind: unit
        ref: "tests/core/ai/persona/PersonaProfile.test.ts#readPersona 3 cases + readPersonaPrefs 3 cases (fallback, PERSONA_LOAD_FAILED logged, stored profile mapped)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PersonaInjector byte-stable pipeline (Appendix N.2 verbatim) — resolvePersona deterministic merge, buildPersonaBlock fixed-template ordered joins, inject() accepts all 4 stages (D-11) and prepends the byte-identical persona prefix INSIDE the cached [SYSTEM]; hash-equality across stages AND turns"
    requirement: AI-05
    verification:
      - kind: unit
        ref: "tests/core/ai/persona/PersonaInjector.test.ts#resolvePersona (4) + buildPersonaBlock (3) + inject all-4-stage/byte-stability (5)"
        status: pass
    human_judgment: false
  - id: D4
    description: "contextHelper buildOptimizedContext — §2.3 shape deterministically (PromptSection[] per '@/core/ai/types'): persona block stable:true system-kind, user input stable:false user_input-kind, tool_schemas stable:true; identical input → deep-equal output; provenance totals match sections; Golden Rule 3 holds on the UI path"
    requirement: AI-05
    verification:
      - kind: unit
        ref: "tests/core/ai/persona/PersonaInjector.test.ts#contextHelper describe (4 tests: kinds/stability, determinism, tool_schemas omission, provenance)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Adversarial injection boundary (T-03-07-01) — a persona-injection attempt threaded through contextHelper changes ONLY the user_input section; the cached [SYSTEM] prefix is byte-identical, hashStableSections unchanged, and the injection text never appears in any stable section"
    requirement: AI-05
    verification:
      - kind: unit
        ref: "tests/core/ai/persona/PersonaInjector.test.ts#adversarial describe (2 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-10
status: complete
---

# Phase 3 Plan 7: PersonaInjector + contextHelper Summary

**The Appendix N.1/N.2 persona pipeline — PersonaProfileSchema + DEFAULT_PERSONA (verbatim), the D-09 np_persona Setting-backed accessor (empty/invalid → PERSONA_LOAD_FAILED → DEFAULT_PERSONA, never a crash), the byte-stable PersonaInjector (resolvePersona deterministic override merge + buildPersonaBlock fixed-template ordered joins + inject() across all 4 stages, hash-equality proven), and the D-02 contextHelper that emits the §2.3 OptimizedContext with the persona block as the stable:true system-kind section inside the cached [SYSTEM] — all 30 new tests green (145 test:ai / 425 full suite), Golden Rule 3 enforced on the UI path, injection-boundary (T-03-07-01) proven at the pipeline boundary.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-10T20:30:35Z
- **Completed:** 2026-08-10T20:42:10Z
- **Tasks:** 7 (4 source tasks, 2 test tasks, 1 verify)
- **Files modified:** 6 (all created)

## Accomplishments

- `src/core/ai/persona/PersonaProfile.ts` — **Appendix N.1 VERBATIM** (RICH-R-01). `PersonaProfileSchema` (id/identity/personalityCore/behavioralDrivers/languageStyle/emotionalRepertoire), `PersonaProfile = z.infer`, and the canonical `DEFAULT_PERSONA` (do-not-paraphrase). The schema is the single validation gate every np_persona read passes — test-proven schema-valid for the canonical default and rejecting missing-id/bad-tone/over-length-name/empty-core.
- `src/core/ai/persona/personaConfig.ts` — **D-09 accessor** (+1 documented to §18 by 03-09). `readPersona()`/`readPersonaPrefs()` share one `loadPersona()` read path through Setting.ts `settingRead` (permission table + STORE_READ handling; `np_persona` ALREADY registered area:'local' — **zero Setting.ts modification**). `PersonaProfileSchema.safeParse` is the T-1-13 inbound gate; an empty or invalid key logs the canonical `PERSONA_LOAD_FAILED` and falls back to `DEFAULT_PERSONA` — never throws, never blocks the Sender (AI-05 empty). **Read-only this phase (D-10)** — the grep gate proves zero persona writes in src. `readPersonaPrefs()` maps the stored persona's name/tone/brevity onto `personaOverrides` so PersonaInjector merges them — changing np_persona changes behavior **by data, not code** (R-2/R-7, §18 DONE-when).
- `src/core/ai/persona/PersonaInjector.ts` — **Appendix N.2 VERBATIM** (RICH-R-02). `PipelineStage` covers all 4 stages (planner/executor/renderer/**memoryExtractor** — D-11 accepted and unit-tested; the call site ships Phase 5). `resolvePersona` merges `prefs.personaOverrides` deterministically (name/tone/brevity only, everything else untouched). `buildPersonaBlock` uses the fixed N.2 template with ordered `'\n'` joins — **byte-stable per persona** (AI-05 encoding/ordering/idempotency): hash-equality asserted across all 4 stages AND across turns, so the provider prompt cache stays alive (T-03-07-02). `inject(stage, baseSystem, opts)` prepends the block INSIDE the cached [SYSTEM] (persona first, then the canonical stage system string). The accessor is injected via `opts.prefs` (config provider, D-10), never imported.
- `src/core/ai/contextHelper.ts` — **D-02 §2.3 builder** (+1 documented to §18; **Phase-4 deletion target** — ContextOptimizer replaces it). `buildOptimizedContext()` emits `PromptSection[]` per `@/core/ai/types` (P-3 canonical home) in §1.3 order: the **persona block as the stable:true system-kind section** (cache-eligible — this is exactly what 03-05's F-5 messages[]+providerOptions path caches on anthropic), tool_schemas (stable:true, omitted when zero refs), and **user input as the stable:false user_input-kind section**. Pure + deterministic (identical input → deep-equal output). **Golden Rule 3:** this is the ONLY prompt builder on the UI path — the 03-08 hook imports contextHelper, never PROMPTS. `estimateTokens = ceil(chars/4)` is a pure Phase-3 seed estimator; the seed keeps sections ≤ inputBudget by construction. Provenance manifest mirrors the sections (truncated: false everywhere).
- Test suites (30 new): PersonaProfile (12 — 6 schema cases, 3 readPersona fallback cases incl. PERSONA_LOAD_FAILED logging, 3 readPersonaPrefs cases) and PersonaInjector (18 — deterministic merge incl. partial overrides, idempotency + fixed template order, all-4-stage coverage with byte-identical prefix + per-stage hash equality, turn-stability, overrides-without-code-change, explicit persona base, §2.3 shape kinds/stability, determinism, tool_schemas omission, provenance totals, and the **adversarial T-03-07-01 pair**: an injection attempt leaves the cached [SYSTEM] byte-identical with an unchanged `hashStableSections` and the injection text absent from every stable section). `test:ai` 145/145 (12 files), full suite 425/425 (54 files).

## Task Commits

Each task was committed atomically:

1. **Task 1: PersonaProfile.ts (Appendix N.1)** - `0e0134e` (feat)
2. **Task 2: personaConfig.ts (D-09 accessor)** - `0c75c42` (feat)
3. **Task 3: PersonaInjector.ts (Appendix N.2)** - `abea168` (feat)
4. **Task 4: contextHelper.ts (D-02 §2.3 builder)** - `97df55c` (feat)
5. **Task 5: PersonaProfile.test.ts (12 tests)** - `f8d614a` (test)
6. **Task 6: PersonaInjector.test.ts (18 tests)** - `9714f68` (test)
7. **Task 7: Verify** - no commit (verification only)

Style/verify-gate commits (prettier --check + the plan's grep gate, folded into history):

- `3e1a733` (style): prettier formatting of persona modules
- `4eeec2d` (style): contextHelper — alias import for PromptSection per verify grep gate
- `110c093` (style): prettier formatting + drop unused schema import in test suites

**Plan metadata:** docs commit follows this SUMMARY.

## Files Created/Modified

- `src/core/ai/persona/PersonaProfile.ts` - Appendix N.1 verbatim: PersonaProfileSchema, PersonaProfile, DEFAULT_PERSONA
- `src/core/ai/persona/personaConfig.ts` - D-09 accessor: readPersona()/readPersonaPrefs() (Setting-backed, schema-validated, DEFAULT_PERSONA fallback)
- `src/core/ai/persona/PersonaInjector.ts` - Appendix N.2 verbatim: PipelineStage, resolvePersona, buildPersonaBlock, PersonaInjector.inject
- `src/core/ai/contextHelper.ts` - D-02: buildOptimizedContext() §2.3 builder (PromptSection[] per '@/core/ai/types'), estimateTokens
- `tests/core/ai/persona/PersonaProfile.test.ts` - 12 contract tests (schema, fallback, prefs mapping)
- `tests/core/ai/persona/PersonaInjector.test.ts` - 18 contract tests (byte-stability, 4-stage, adversarial, §2.3 shape)

## Decisions Made

- **readPersonaPrefs returns a full UserPreferences** with Phase-3 base defaults for the non-persona fields — the interface requires them (responseStyle/toolAutonomy/etc.), and the persona accessor owns only the persona slice (personaId + personaOverrides); Phase 5's PreferenceMemoryStore writer supplies the full surface. Empty/invalid key → base prefs with NO overrides (base persona stands).
- **contextHelper emits exactly three sections for the Phase-3 seed** (system/tool_schemas/user_input) — the plan's input list is honored exactly; preferences/memory/context/task sections are Phase 4 (ContextOptimizer) when those stores exist.
- **ContextHelperInput carries workspaceId + activeSurface (+ optional minimalMode, default false)** beyond the plan's stated input list — the §2.3 `ContextProvenanceManifest`/`OptimizedContext` types (v0.1) require them; `operationId` rides in per the plan's input list and is threaded by the hook into `runAgentTurn`.
- **estimateTokens = ceil(chars/4)** — a pure, deterministic Phase-3 seed estimator (no crypto/Date.now); Phase 4's TokenBudget replaces it. Byte-stability is UTF-16 JS string equality (AI-05 encoding), asserted via FNV-1a `hashStableSections`.
- **AI-05 checkbox NOT marked complete** — the requirement's full text ("PersonaInjector and prompt pipeline ensure **all AI calls** consume an OptimizedContext") is only realized when the hook/UI path is wired; 03-08 and 03-09 also claim AI-05, so marking complete now would repeat the documented 03-01 mark-complete mistake (03-02/03-03/03-04/03-05/03-06 precedent: primitive-shipping plans record requirements-completed linkage only, checkboxes stay `[ ]`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test bug] Byte-stability hash assertion compared joined vs single prefixes**
- **Found during:** Task 6 (PersonaInjector suite — "byte-identical across all 4 stages")
- **Issue:** The hash-equality assertion hashed all 4 prefixes JOINED with `\u0000` (hashStableSections semantics) against a SINGLE prefix — a genuinely different string, so the assertion failed despite the prefixes being byte-identical (already proven by `new Set(prefixes).size === 1`).
- **Fix:** Asserted per-prefix hash equality (`prefixes.map(hashStableSections)` — one hash per prefix, all identical), which is the meaningful T-03-07-02 cache-key claim.
- **Files modified:** tests/core/ai/persona/PersonaInjector.test.ts
- **Verification:** suite re-green (30/30); the byte-identity assertion still holds
- **Committed in:** 9714f68 (Task 6 commit)

**2. [Rule 3 - Verify gate] contextHelper imported PromptSection via relative './types'**
- **Found during:** Task 7 (verify grep gate "PromptSection import = '@/core/ai/types'")
- **Issue:** The relative path resolves to the same canonical home (src/core/ai/types.ts), but the plan's verification names the alias form explicitly; the repo's own convention is split (8 files use the alias, 4 use relative).
- **Fix:** Switched contextHelper to `import type { OptimizedContext, PromptSection } from '@/core/ai/types'` — unambiguous against the plan's grep.
- **Files modified:** src/core/ai/contextHelper.ts
- **Verification:** grep gate now matches verbatim; suite re-green
- **Committed in:** 4eeec2d

**3. [Rule 3 - Verify gate] Prettier formatting of the new files**
- **Found during:** Tasks 1-6 (prettier --check is part of the phase verify gates)
- **Issue:** Prettier reflowed 3 source files (line-wrapped inject signature, debugLog call, DEFAULT_PERSONA array) and 2 test files; the unused `PersonaProfileSchema` import in PersonaInjector.test.ts also tripped eslint.
- **Fix:** `prettier --write` + removed the unused import; folded as style commits (3e1a733, 110c093) instead of amending the per-task commits, preserving atomic task history.
- **Files modified:** src/core/ai/persona/{PersonaProfile,personaConfig,PersonaInjector}.ts, tests/core/ai/persona/*.test.ts
- **Verification:** prettier --check . clean, eslint . clean
- **Committed in:** 3e1a733, 110c093

---

**Total deviations:** 3 auto-fixed (1 Rule 1, 2 Rule 3)
**Impact on plan:** All three are correctness/verify-gate alignments with zero behavior change — the pipeline's contract, byte-stability, and fallback semantics are exactly as planned. No scope creep.

## Issues Encountered

- **AI-05 mark-complete deliberately NOT run** — the requirement's full text names the end-to-end "all AI calls consume an OptimizedContext" path that 03-08 (hook) and 03-09 (wiring) complete; this plan ships the persona pipeline + accessor + contextHelper primitives. requirements-completed frontmatter records the plan's stated linkage only (established precedent since 03-01).
- README.md carries the same pre-existing uncommitted documentation edit noted in 03-01/03-03/03-04/03-05/03-06 — left untouched (out of this plan's scope).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **03-08 (useStreamingLLM + ChatPage):** the hook imports `contextHelper` (never PROMPTS, Golden Rule 3) — `readPersonaPrefs()` (or `readPersona()` + `resolvePersona`/`buildPersonaBlock`) → `buildOptimizedContext({ operationId, tier, inputBudget, outputBudget, userInput, personaBlock, toolSchemaRefs, workspaceId, activeSurface })` → `createStageInvocation` (03-05) → `runAgentTurn` (03-06, the persona block now flows as the stable:true system section through the renderer's F-5 messages[] shape — the anthropic cacheControl breakpoint engages on the byte-stable [SYSTEM]).
- **03-09 (wiring + §18 addendum):** the addendum records contextHelper + personaConfig as the two +1 documented files, the D-02 Phase-4 deletion target, and the AI-05 completion (this plan + 03-08 + 03-09 jointly prove "all AI calls consume an OptimizedContext").
- **Phase 5 (PreferenceMemoryStore):** the writer swaps only the injected config provider behind `readPersonaPrefs` — zero changes to PersonaInjector/contextHelper (D-10 seam).
- **Phase 4 (ContextOptimizer):** replaces `contextHelper` (D-02 deletion target) and `estimateTokens` (TokenBudget) in place; the section kinds/stable flags this plan established are the contract it must preserve.
- **Threat model honored:** T-03-07-01 (injection → only [USER INPUT], proven at the pipeline boundary), T-03-07-02 (byte-stability → cache-key stability, hash-equality proven), T-03-07-03 (np_persona non-secret local config — accepted, read-only), T-03-07-SC (zero new packages — the approved stack is untouched).

---
*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-10*

## Self-Check: PASSED

- All 6 created files + SUMMARY exist on disk (verified via `[ -f ]`)
- All 6 task commits present in git log: 0e0134e, 0c75c42, abea168, 97df55c, f8d614a, 9714f68 (+ style commits 3e1a733, 4eeec2d, 110c093)
- tsc --noEmit exit 0 · eslint . clean · prettier --check . clean · test:ai 145/145 (12 files) · full suite 425/425 (54 files) — +30 new tests
- Grep gates: no `settingWrite`/`np_persona` writes anywhere in src/ (persona read-only, D-10); `PromptSection` import in contextHelper is `@/core/ai/types` verbatim (P-3 canonical home)
- Byte-stability proven: resolvePersona/buildPersonaBlock pure — same (base, prefs) → identical block; hash-equality across all 4 stages AND turns (per-prefix FNV-1a via hashStableSections); different personas → different blocks
- D-11 proven: inject() accepts planner/executor/renderer/memoryExtractor (byte-identical prefix, persona first, then the canonical stage system string)
- §18 DONE-when proven: personaOverrides apply without a code change (FIXED_PREFERENCES → 'You are Fixture Persona —' with zero code edits)
- D-09 fallback proven: empty np_persona → DEFAULT_PERSONA (never throws); invalid → DEFAULT_PERSONA + PERSONA_LOAD_FAILED console log; stored valid profile → returned unchanged; readPersonaPrefs maps name/tone/brevity
- T-03-07-01 proven: injection attempt changes ONLY [USER INPUT]; system section byte-identical; hashStableSections unchanged; injection text absent from every stable section
- §2.3 determinism proven: buildOptimizedContext identical input → deep-equal output; kinds ['system','tool_schemas','user_input'] with stable true/true/false; provenance totalTokens = sum of section tokens, truncated false everywhere
