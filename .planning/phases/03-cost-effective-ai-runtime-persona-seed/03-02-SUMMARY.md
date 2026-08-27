---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 02
subsystem: ai-runtime
tags: [persona, zod, zustand, chrome-storage, prompt-cache, persona-injector]

# Dependency graph
requires:
  - phase: 03
    plan: 01
    provides: A8 PromptSection shape, ProviderId/Tier types, canonical Appendix A PROMPTS (persona-free stage constants)
  - phase: 02
    provides: chromeStorageAdapter + debounced persist pattern (np_preferences persistence)
provides:
  - PersonaProfileSchema + PersonaProfile type + DEFAULT_PERSONA (Appendix N.1 verbatim, RICH-R-01)
  - PersonaInjector (PipelineStage, resolvePersona data-merge, buildPersonaBlock byte-stable, inject persona-first) — RICH-R-02/D-58/D-59
  - Minimal UserPreferences (fastModel/balancedModel/personaOverrides) + np_preferences persistence via chromeStorageAdapter(local), version 1
  - The persona-first byte-stable inject contract that plan 03-04's PromptCacheManager consumes as its single choke-point (D-59)
affects: [03-04 PromptCacheManager, 03-06 AgentOrchestrator, 03-07 chat wiring, Phase 8 memory (UserPreferences supersession), Phase 15 persona editor]

actuals:
  tokens: 4858     # chars/4 over the 6 files created (19,432 chars)
  tasks: 3         # tasks completed
  commits: 4       # commits made (3 task + 1 docs)

# Tech tracking
tech-stack:
  added: []          # no new dependencies — zod ^4.4.3, zustand ^5.0.0, immer (all installed)
  patterns: [spec-Appendix verbatim constants ("do not paraphrase"), data-merge with ?? precedence, byte-stable prompt block for cache preservation, zustand persist + chromeStorageAdapter(local) + partialize + version]

key-files:
  created:
    - src/core/ai/persona/PersonaProfile.ts
    - src/core/ai/persona/PersonaInjector.ts
    - src/core/ai/UserPreferences.ts
    - tests/core/ai/persona/PersonaProfile.test.ts
    - tests/core/ai/persona/PersonaInjector.test.ts
    - tests/core/ai/UserPreferences.test.ts
  modified: []

key-decisions:
  - "UserPreferences lives in its own file src/core/ai/UserPreferences.ts (RESEARCH Open Q2) so plans 01/02 stay parallel-safe on src/core/ai/types.ts — Appendix N.2's @/core/memory/types import target is supplied here (flagged assumption A1)"
  - "Override strings are z.string().min(1).optional() — empty-string overrides are rejected at the schema boundary so the data-merge `??` (which treats '' as a value) can never clobber a seeded persona field (flagged assumption)"
  - "Store hydrate() uses the persist middleware's `api.persist.rehydrate()` via the initializer's third parameter — avoids a module-level self-reference that breaks TypeScript inference; async-wrapped because persist's rehydrate is typed Promise<void> | void"
  - "No profile persistence (np_persona is Phase 8 RICH-R-05) — only personaOverrides/fastModel/balancedModel persist under np_preferences"

patterns-established:
  - "Spec-Appendix verbatim constants: DEFAULT_PERSONA is byte-copied from Appendix N.1 including tagline/behavioralDrivers (D-57's CONTEXT paraphrase is NOT authoritative)"
  - "Byte-stable persona block: buildPersonaBlock output is identical per resolved persona — the prompt-cache preservation invariant (§1.3) that plan 03-04 keys its [SYSTEM] cache on"
  - "Zustand persist store pattern: create + persist + immer + createJSONStorage(chromeStorageAdapter) + partialize + version 1 (mirrors WorkspaceStore/ThemeStore, D-22 version axis)"

requirements-completed: [RICH-R-01, RICH-R-02, RICH-R-10]

coverage:
  - id: D1
    description: "DEFAULT_PERSONA ships Appendix N.1 verbatim (id nowpilot-default, tagline 'Your ServiceNow support co-pilot', personalityCore ['privacy-first','helpful','precise','humble'], behavioralDrivers ['prefers asking clarifying questions over guessing','cites sources when available'], tone professional-warm, brevity brief) with the schema locking §21.6 tone/brevity enums"
    requirement: "RICH-R-01"
    verification:
      - kind: unit
        ref: "tests/core/ai/persona/PersonaProfile.test.ts#DEFAULT_PERSONA matches Appendix N.1 field-for-field"
        status: pass
      - kind: unit
        ref: "tests/core/ai/persona/PersonaProfile.test.ts#schema rejects an invalid tone"
        status: pass
      - kind: unit
        ref: "tests/core/ai/persona/PersonaProfile.test.ts#schema rejects an invalid brevity"
        status: pass
      - kind: unit
        ref: "tests/core/ai/persona/PersonaProfile.test.ts#missing required field fails parse"
        status: pass
    human_judgment: false
  - id: D2
    description: "PersonaInjector implements the Appendix N.2 contract: resolvePersona data-merges name/tone/brevity with ?? precedence (partial overrides leave seeded fields, base never mutated), buildPersonaBlock is byte-stable per persona, inject prepends the persona block FIRST inside the cached [SYSTEM] for all four PipelineStage values"
    requirement: "RICH-R-02"
    verification:
      - kind: unit
        ref: "tests/core/ai/persona/PersonaInjector.test.ts#(a) no prefs → base block + baseSystem unchanged"
        status: pass
      - kind: unit
        ref: "tests/core/ai/persona/PersonaInjector.test.ts#(c) partial overrides leave unset fields from the seed"
        status: pass
      - kind: unit
        ref: "tests/core/ai/persona/PersonaInjector.test.ts#(d) byte-stability — identical inputs → identical strings; different overrides → different blocks"
        status: pass
      - kind: unit
        ref: "tests/core/ai/persona/PersonaInjector.test.ts#(e) persona-first ordering — the block is the string PREFIX"
        status: pass
    human_judgment: false
  - id: D3
    description: "Per-stage persona consistency — inject accepts planner/executor/renderer/memoryExtractor (RICH-R-10) with the same byte-stable persona-first contract"
    requirement: "RICH-R-10"
    verification:
      - kind: unit
        ref: "tests/core/ai/persona/PersonaInjector.test.ts#(f) per-stage — inject works for all four PipelineStage values"
        status: pass
    human_judgment: false
  - id: D4
    description: "Minimal UserPreferences shape + np_preferences persistence — schema parses the three fields, rejects empty-string overrides (seed stays authoritative), store persists under np_preferences via chromeStorageAdapter(local) with zustand-persist version 1, overrides apply without a code change (DONE-when 5)"
    verification:
      - kind: unit
        ref: "tests/core/ai/UserPreferences.test.ts#schema parses a full preferences object"
        status: pass
      - kind: unit
        ref: "tests/core/ai/UserPreferences.test.ts#schema REJECTS an empty-string override"
        status: pass
      - kind: unit
        ref: "tests/core/ai/UserPreferences.test.ts#store persists under np_preferences via chromeStorageAdapter(local), version 1"
        status: pass
      - kind: unit
        ref: "tests/core/ai/UserPreferences.test.ts#hydrate() re-reads np_preferences from chrome.storage.local"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-08-27
status: complete
---

# Phase 3 Plan 2: Persona Seed — PersonaProfile, PersonaInjector, UserPreferences Summary

**Spec-verbatim Appendix N.1 persona seed (DEFAULT_PERSONA field-for-field, RICH-R-01) with the Appendix N.2 data-merge PersonaInjector (byte-stable persona-first prepend, RICH-R-02/D-58/D-59/RICH-R-10) and the minimal UserPreferences shape + np_preferences persistence that makes overrides apply without a code change (DONE-when 5)**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-27T20:54:12Z
- **Completed:** 2026-08-27T20:59:22Z
- **Tasks:** 3
- **Files modified:** 6 (all created — no existing files touched)

## Accomplishments
- **DEFAULT_PERSONA ships verbatim from Appendix N.1** (id `nowpilot-default`, tagline `Your ServiceNow support co-pilot`, `['privacy-first','helpful','precise','humble']`, `['prefers asking clarifying questions over guessing','cites sources when available']`, tone `professional-warm`, brevity `brief`) — test-asserted field-for-field with the "do not paraphrase" discipline. D-57's CONTEXT paraphrase was deliberately NOT used; the spec block is authoritative.
- **PersonaInjector implements the Appendix N.2 contract exactly**: `resolvePersona` is a pure data-merge (`o.name ?? base.identity.name`, tone/brevity `??`) that never mutates the base profile and leaves partial overrides' unset fields from the seed; `buildPersonaBlock` emits byte-identical output per resolved persona (the §1.3 prompt-cache preservation invariant); `inject` prepends the persona block FIRST inside the cached `[SYSTEM]` for every `PipelineStage` value (`planner`/`executor`/`renderer`/`memoryExtractor` — the latter reserved, never integrated in Phase 3, D-59). This is the exact contract plan 03-04's PromptCacheManager consumes as its single choke-point.
- **Minimal UserPreferences + np_preferences persistence**: `UserPreferencesSchema` (fastModel/balancedModel/personaOverrides) rejects empty-string overrides via `z.string().min(1)` so the `??` merge can never clobber a seeded field; `useUserPreferencesStore` (zustand + persist + chromeStorageAdapter(local) + partialize + version 1) persists under `np_preferences` and exposes setFastModel/setBalancedModel/setPersonaOverrides/hydrate — overrides apply without a code change (DONE-when 5). The Phase-8/10 supersession point is marked in a code comment.
- **No persona text leaked into stage constants** — `src/core/prompts/index.ts` untouched (grep guard: 0 `NowPilot` hits), so Appendix A stays persona-free and byte-stable (spec 4153 note).
- **20 new tests** (40 total in the phase gate): 6 PersonaProfile + 7 PersonaInjector (6 required case groups + custom-persona opts) + 7 UserPreferences, all green under `pnpm run verify:phase-3` (tsc strict-clean, NP-STRICT ceiling 0 held).

## Task Commits

Each task was committed atomically:

1. **Task 1: PersonaProfile — Appendix N.1 verbatim + schema test** - `aef3c72` (feat)
2. **Task 2: Minimal UserPreferences + np_preferences persistence** - `a5670d5` (feat)
3. **Task 3: PersonaInjector — data-merge + byte-stable persona-first prepend** - `70e1898` (feat)

**Plan metadata:** `pending` (committed with this SUMMARY)

## Files Created/Modified
- `src/core/ai/persona/PersonaProfile.ts` - Appendix N.1 verbatim: `PersonaProfileSchema` (locked §21.6 tone/brevity enums, min/max field bounds), `PersonaProfile` inferred type, `DEFAULT_PERSONA` canonical constant
- `src/core/ai/persona/PersonaInjector.ts` - Appendix N.2 verbatim: `PipelineStage` union, `resolvePersona` data-merge, `buildPersonaBlock` byte-stable serializer, `PersonaInjector.inject` persona-first prepend (imports `UserPreferences` from `../UserPreferences` — A1 supply point)
- `src/core/ai/UserPreferences.ts` - `UserPreferencesSchema` (fastModel/balancedModel/personaOverrides with min(1) overrides), `PERSONA_TONE_ENUM`/`PERSONA_BREVITY_ENUM`, `useUserPreferencesStore` under `np_preferences` (version 1, partialize, hydrate at boot); Phase-8/10 supersession comment
- `tests/core/ai/persona/PersonaProfile.test.ts` - 6 tests: field-for-field equality, schema round-trip, invalid tone/brevity rejection, missing-field failure, empty id rejection
- `tests/core/ai/persona/PersonaInjector.test.ts` - 7 tests: no-prefs unchanged, full overrides reflected, partial overrides preserve seed, byte-stability (identical→identical, different→different), persona-first prefix, all four stages, custom opts.persona
- `tests/core/ai/UserPreferences.test.ts` - 7 tests: schema parse (full/minimal), empty-string override rejection, invalid enum rejection, np_preferences persistence with version 1, hydrate re-read, enum constants

## Decisions Made
- **UserPreferences in its own file** (RESEARCH Open Q2): separate `src/core/ai/UserPreferences.ts` keeps plans 01/02 parallel-safe on `types.ts`; it is the Phase-3 supply point for Appendix N.2's non-existent `@/core/memory/types` import (flagged assumption A1).
- **Empty-string overrides rejected at the schema boundary** (`z.string().min(1).optional()`): the data-merge `??` treats `''` as a value, so validation must keep empty strings from ever reaching the merge — seeded persona fields stay authoritative (flagged assumption).
- **`hydrate()` via the persist middleware's `api` parameter**: referencing the module-level store const inside its own initializer breaks TypeScript inference (circular reference); the initializer's third parameter carries `api.persist.rehydrate()` — async-wrapped because zustand v5 types it `Promise<void> | void`.
- **No profile persistence**: only overrides/preferences persist (`np_persona` is Phase 8, RICH-R-05); the profile is a seeded constant — per the plan prohibition.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Zustand store self-reference broke type inference**
- **Found during:** Task 2 (UserPreferences store)
- **Issue:** `hydrate: () => useUserPreferencesStore.persist.rehydrate()` inside the store's own initializer created a circular reference — TS inferred `any` for the store and the action return type, failing strict mode (ceiling 0).
- **Fix:** Used the initializer's third parameter (`api` — the store api with the persist extension): `hydrate: async () => { await api.persist.rehydrate(); }`. The async wrapper also normalizes zustand v5's `Promise<void> | void` rehydrate return to `Promise<void>`.
- **Files modified:** src/core/ai/UserPreferences.ts
- **Verification:** tsc strict-clean; all 40 tests pass
- **Committed in:** a5670d5 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added UserPreferences.test.ts to prove Task 2 acceptance criteria**
- **Found during:** Task 2 (UserPreferences)
- **Issue:** The plan's Task 2 `<files>` lists only the source, but the acceptance criteria are behavioral (schema parse/reject, `np_preferences` persistence, version 1) — the HARD GATE requires executing proof for each criterion, which only a test can provide repeatably.
- **Fix:** Added `tests/core/ai/UserPreferences.test.ts` (7 tests) under the already-gated `tests/core/ai` path — no source scope change.
- **Files modified:** tests/core/ai/UserPreferences.test.ts
- **Verification:** 7/7 pass in `pnpm run verify:phase-3`; each acceptance criterion has a direct test
- **Committed in:** a5670d5 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both were required for strict-mode correctness and acceptance-proof completeness. No scope creep — all six shipped files match the plan's file inventory plus one additive test file.

## Issues Encountered
- None beyond the two auto-fixes above. The vitest run and tsc gate stayed green throughout; no environment issues (node_modules and zod were already present from plan 03-01).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Ready for 03-04 (PromptCacheManager/PromptCacheAdapter):** the D-59 single choke-point exists — `PersonaInjector.inject` returns a byte-stable persona-first block that `PromptCacheManager.buildSystemPrompt` will consume; the `[SYSTEM]` cache hash keys on `buildPersonaBlock` output (profile-version-keyed re-derivation when overrides change).
- **Ready for 03-06 (AgentOrchestrator) / 03-07 (chat wiring):** Planner/Executor/Renderer stages get the persona automatically through the shared prompt builder — no per-caller persona code.
- **Ready for Phase 8:** the minimal `UserPreferences` is the marked supersession point for the full memory-phase shape; `np_preferences` key + version 1 persist contract is already in place.
- **Watch item (carried from 03-01):** `pnpm run verify:phase-3` covers `tests/core/ai` + `tests/core/ai/persona` — new test dirs must stay within those paths.

---

*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-27*

## Self-Check: PASSED

- All 6 files exist on disk (3 source + 3 test, verified via `git status` clean + `wc -c`)
- All 3 task commits found in git log: aef3c72, a5670d5, 70e1898
- `pnpm run verify:phase-3` green: tsc strict-clean + 40 tests across 6 files
- Grep guard: `grep -c 'NowPilot' src/core/prompts/index.ts` = 0 (stage constants stay persona-free)
- No `@ts-expect-error NP-STRICT` markers in new code (NP-STRICT ceiling 0 held)