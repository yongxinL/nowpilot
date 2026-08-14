---
phase: 05-knowledge-base-memory-minisearch-notes
plan: 03
subsystem: memory
tags: [memory, conversation-memory, preferences, persona, indexeddb, chrome-storage, lru, compactor, zod]

# Dependency graph
requires:
  - phase: 05-knowledge-base-memory-minisearch-notes
    provides: UserMemoryFact/ConversationMemory/ConversationMeta/UserPreferencesSchema in src/core/memory/types.ts (05-01, R-1 home), np_conversation_meta registered in Setting.ts (05-01, Pitfall 4 closed)
  - phase: 05-knowledge-base-memory-minisearch-notes
    provides: MemoryDB v2 (messages/conversationSummaries via openMemoryDB runMigrations), UserMemoryStore conventions (05-02)
  - phase: 02-foundation
    provides: MemoryDB messages + conversationSummaries stores, WriteJournal persistJournalEntry/loadPendingEntries, Setting settingRead/settingWrite promise-chain mutex
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: personaConfig np_persona accessor (D-09), PersonaProfileSchema + DEFAULT_PERSONA (N.1), PersonaInjector resolvePersona (N.2)
provides:
  - ConversationMemoryStore (src/core/memory/ConversationMemoryStore.ts): appendTurn, getRecentTurns (2/4/6 per tier), summariseIfNeeded (12-message compactor + injectable seam), archiveIdleConversations, enforceLimits (§15.3 LRU 10/100 + evict-conversation WriteJournal op); meta in chrome.storage.local via Setting (Open Q8), bodies in MemoryDB (D-05-03)
  - PreferenceMemoryStore (src/core/memory/PreferenceMemoryStore.ts): np_persona WRITER (D-05-18, R-7) — UserPreferencesSchema-gated write, dual-shape read (Open Q1, Pitfall 1)
  - personaConfig dual-shape read: UserPreferencesSchema first path + legacy PersonaProfileSchema fallback — Phase-3 pipeline byte-identical for legacy values
affects: [05-04 MemoryEngine (assembles conversation memory + preferences via these stores), 05-06 hook wiring (PreferenceMemoryStore.read() replaces readPersonaPrefs for the full prefs surface), verify-work phase 5]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-shape storage read shim: one chrome.storage key accepts two schema generations — try the NEW schema first (pass-through), fall back to the legacy schema (convert), else log + defaults; the legacy pipeline output stays byte-identical (Pitfall 1)"
    - "Metadata local / bodies IDB split (§23 ADR, Open Q8): conversation meta is a Record<conversationId, ConversationMeta> under ONE chrome.storage.local key via settingRead/settingWrite (permission table + mutex); message bodies + summaries stay in MemoryDB IndexedDB"
    - "Compactor seam: summariseIfNeeded accepts an injectable summarise(middle) — default deterministic structural placeholder '[N messages compacted]', the LLM summarizer stage is the documented 5a seam; the core stays LLM-free, tests deterministic"

key-files:
  created: [src/core/memory/ConversationMemoryStore.ts, src/core/memory/PreferenceMemoryStore.ts, tests/core/memory/ConversationMemoryStore.test.ts, tests/core/memory/PreferenceMemoryStore.test.ts]
  modified: [src/core/ai/persona/personaConfig.ts]

key-decisions:
  - "Open Q8 executed: np_conversation_meta is a Record<conversationId, ConversationMeta> under ONE chrome.storage.local key (the §15.1 key is single), round-tripped through settingRead/settingWrite only — never direct chrome.storage (Pitfall 4 pin test included)"
  - "Legacy PersonaProfile → UserPreferences conversion keeps the legacy profile's OWN id as personaId (the merged resolvePersona profile's id is the base default) — the plan's 'personaId = merged.id' literal would produce 'nowpilot-default'; the test contract ('derived from the legacy id') wins; overrides still derive through resolvePersona"
  - "UserPreferencesSchema (shipped 05-01, pinned by MemoryTypes.test.ts) types defaultProviderId as `string` while the UserPreferences interface narrows it to ProviderId — documented boundary casts in PreferenceMemoryStore.read() and personaConfig.loadPersona (schema never changed)"
  - "appendTurn reactivates an archived conversation (status: 'active' on every turn — §15.3 status flip on fresh activity) and derives seq from the by-conversation index read, falling back to meta.messageCount when the read fails"

patterns-established:
  - "Store convention: write paths never signal failure; every catch calls debugLog with STORE_READ/STORE_WRITE + module name; debugLog extra carries ids/counts only, never message content (T-05-10); no direct chrome.storage anywhere in the store (meta via Setting imports)"
  - "LRU enforcement: archiveIdleConversations takes injectable nowMs (deterministic tests); eviction removes the meta entry AND journals a WriteJournal entry with operation 'evict-conversation' + targetIds.conversationId (audit/replay trail)"

requirements-completed: [KNW-04, KNW-05]

coverage:
  - id: D1
    description: "ConversationMemoryStore — per-tier recent turns (2 tiny / 4 small / 6 medium|large, system rows filtered), 12-message compactor with injectable summarise seam + head/tail retention, §15.3 LRU (10 active / 100 archived, 30-min idle archive, evict-conversation WriteJournal op) over np_conversation_meta via the Setting layer"
    requirement: KNW-04
    verification:
      - kind: unit
        ref: "tests/core/memory/ConversationMemoryStore.test.ts#keeps the last 2/4/6 turns per tier and filters system rows from lastMessages"
        status: pass
      - kind: unit
        ref: "tests/core/memory/ConversationMemoryStore.test.ts#triggers at messageCount 24: persists the structural summary + head/tail rule"
        status: pass
      - kind: unit
        ref: "tests/core/memory/ConversationMemoryStore.test.ts#evicts the OLDEST archived conversation above 100 and journals the evict-conversation op"
        status: pass
      - kind: unit
        ref: "tests/core/memory/ConversationMemoryStore.test.ts#round-trips np_conversation_meta through settingWrite/settingRead (Pitfall 4 pin)"
        status: pass
    human_judgment: false
  - id: D2
    description: "PreferenceMemoryStore — np_persona WRITER: UserPreferencesSchema-gated write (invalid shapes never persist, PERSONA_LOAD_FAILED), dual-shape read (UserPreferences pass-through + legacy PersonaProfile conversion), never throws"
    requirement: KNW-04
    verification:
      - kind: unit
        ref: "tests/core/memory/PreferenceMemoryStore.test.ts#persists a full UserPreferences through the schema gate byte-equal"
        status: pass
      - kind: unit
        ref: "tests/core/memory/PreferenceMemoryStore.test.ts#converts a legacy PersonaProfile to UserPreferences with derived overrides"
        status: pass
      - kind: unit
        ref: "tests/core/memory/PreferenceMemoryStore.test.ts#rejects an out-of-union responseStyle WITHOUT persisting, logging PERSONA_LOAD_FAILED"
        status: pass
    human_judgment: false
  - id: D3
    description: "personaConfig dual-shape read (D-05-18, Pitfall 1 closed) — UserPreferencesSchema first path with resolvePersona derivation, PersonaProfileSchema legacy fallback byte-identical; Phase-3 persona pipeline no-regression"
    requirement: KNW-05
    verification:
      - kind: unit
        ref: "tests/core/memory/PreferenceMemoryStore.test.ts#personaConfig.readPersona() still returns the legacy profile unchanged"
        status: pass
      - kind: unit
        ref: "tests/core/memory/PreferenceMemoryStore.test.ts#readPersonaPrefs() maps the legacy profile byte-identical to pre-migration"
        status: pass
      - kind: unit
        ref: "tests/core/ai/persona/PersonaProfile.test.ts#maps the stored persona name/tone/brevity onto personaOverrides"
        status: pass
    human_judgment: false

# Metrics
duration: 11min
completed: 2026-08-14
status: complete
---

# Phase 05 Plan 03: Conversation + Preference Memory Stores Summary

**ConversationMemoryStore with per-tier recent turns, the 12-message compactor (injectable summarise seam), and the §15.3 LRU (10/100 + evict-conversation WriteJournal op) over np_conversation_meta; PreferenceMemoryStore as the np_persona writer with the dual-shape read; personaConfig gains the Pitfall-1 dual-shape guard so the Phase-3 pipeline cannot regress**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-14T00:00:40Z
- **Completed:** 2026-08-14T00:11:24Z
- **Tasks:** 2
- **Files modified:** 5 (2 source created, 1 source modified, 2 test files created)

## Accomplishments

- **ConversationMemoryStore** (D-05-03, Open Q8 executed): `appendTurn` writes the message body to MemoryDB (conversationId+seq composite key — bodies stay in IndexedDB, never chrome.storage) and updates `np_conversation_meta` via `settingWrite`/`settingRead` (registered area:'local' in Setting.ts — Pitfall 4 pin); `getRecentTurns` keeps the last 2 (tiny) / 4 (small) / 6 (medium|large) turns via the by-conversation index with system rows filtered from lastMessages and the summary attached from conversationSummaries or meta.summary; `summariseIfNeeded` fires at `messageCount % 12 === 0`, splitting head (system + first 2) / tail (last 4) / middle with an injectable `summarise` seam — the deterministic structural default `'[N messages compacted]'` keeps the core LLM-free (the LLM summarizer stage is the documented 5a seam), and raw bodies are retained in MemoryDB (the compactor summarizes, never deletes); §15.3 LRU: 10 active / 100 archived / 30-min idle archive (`archiveIdleConversations` with injectable nowMs) / eviction journaled via `persistJournalEntry({ operation: 'evict-conversation', targetIds: { conversationId } })`. 13 tests.
- **PreferenceMemoryStore** (D-05-18, R-7/R2 — persona is user config, never a fact): the np_persona WRITER with `UserPreferencesSchema` gate (GR-4) — an invalid shape logs PERSONA_LOAD_FAILED and never persists; `read()` is the Open Q1 dual-shape read: UserPreferencesSchema first (byte-equal pass-through), PersonaProfileSchema legacy fallback converted via `resolvePersona` (legacy id/name/tone/brevity preserved), neither → DEFAULT_USER_PREFERENCES, never throws. `DEFAULT_USER_PREFERENCES` is byte-identical to the personaConfig base surface (equality pinned by test). 9 tests.
- **personaConfig dual-shape read** (Pitfall 1 closed): `loadPersona` tries `UserPreferencesSchema.safeParse(stored)` FIRST (a UserPreferences value resolves via `resolvePersona(DEFAULT_PERSONA, prefs)` — it can never PERSONA_LOAD_FAILED-reset the persona), then falls back to the legacy `PersonaProfileSchema` path byte-identical; `readPersona`/`readPersonaPrefs` signatures and downstream shapes unchanged — the Phase-3 persona pipeline (PersonaInjector, useStreamingLLM) keeps passing untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: ConversationMemoryStore — turns + summary + §15.3 LRU + compactor** - `2b6bfa0` (feat)
2. **Task 2: PreferenceMemoryStore — np_persona writer + dual-shape read (Open Q1)** - `81815dd` (feat)

## Files Created/Modified

- `src/core/memory/ConversationMemoryStore.ts` - ACTIVE_CONVERSATION_LIMIT (10), ARCHIVED_CONVERSATION_LIMIT (100), ARCHIVE_IDLE_MS (30 min), COMPACTOR_INTERVAL (12), NP_CONVERSATION_META_KEY; appendTurn, getRecentTurns, summariseIfNeeded, archiveIdleConversations, enforceLimits; meta Record round-trips through Setting (Open Q8)
- `src/core/memory/PreferenceMemoryStore.ts` - PREFERENCE_MEMORY_RESOURCE_ID, DEFAULT_USER_PREFERENCES, write (schema-gated), read (dual-shape)
- `src/core/ai/persona/personaConfig.ts` - loadPersona dual-shape first path (UserPreferencesSchema → resolvePersona), legacy PersonaProfileSchema fallback unchanged
- `tests/core/memory/ConversationMemoryStore.test.ts` - 13 tests (required §18)
- `tests/core/memory/PreferenceMemoryStore.test.ts` - 9 tests (required §18)

## Decisions Made

- **Open Q8 executed** — np_conversation_meta is a `Record<conversationId, ConversationMeta>` under ONE chrome.storage.local key (spec §15.1 names a single key), round-tripped exclusively through settingRead/settingWrite (permission table + §13 mutex; never direct chrome.storage). Bodies + summaries stay in MemoryDB (§23 ADR metadata-local / bodies-IDB split).
- **Legacy conversion keeps the legacy persona id** — the plan action text says "personaId = merged.id", but `resolvePersona(DEFAULT_PERSONA, …)` keeps the base id ('nowpilot-default'); the test contract ("personaId derived from the legacy id") pins the honest source, so `personaId = legacy.id` with overrides derived through the merged profile.
- **Schema/interface boundary cast** — `UserPreferencesSchema.defaultProviderId` is `z.string().optional()` (shipped 05-01, pinned by MemoryTypes.test.ts) while `UserPreferences.defaultProviderId?: ProviderId`; the read paths use documented `as UserPreferences` casts (validation bypassed never — the schema validates shape, ProviderId is a string-literal narrowing).
- **appendTurn reactivates** — every turn forces `status: 'active'` (§15.3 status flip on fresh activity); seq derives from the by-conversation index read with a meta.messageCount fallback when the read fails.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/Contract] Legacy conversion personaId: plan literal vs test contract conflict**
- **Found during:** Task 2 (PreferenceMemoryStore read)
- **Issue:** The plan's action text prescribes "personaId = merged.id" after `resolvePersona(DEFAULT_PERSONA, prefs)` — but resolvePersona spreads the base persona and never changes the id, so merged.id is always 'nowpilot-default', contradicting the plan's own test contract ("read() returns UserPreferences with personaId … derived from the legacy id").
- **Fix:** `personaId = legacy.id` (the legacy profile's own id); personaOverrides still derive through the merged resolvePersona profile (identical to the legacy values). The executable test contract wins; both plan sentences are honored in spirit.
- **Files modified:** src/core/memory/PreferenceMemoryStore.ts
- **Verification:** legacy conversion test asserts personaId 'custom-support-lead' + overrides {Aria, friendly, balanced}
- **Committed in:** 81815dd

**2. [Rule 3 - Blocking] UserPreferencesSchema/interface defaultProviderId type mismatch**
- **Found during:** Task 2 (tsc gate)
- **Issue:** `UserPreferencesSchema` (05-01) types `defaultProviderId` as `z.string().optional()`; the `UserPreferences` interface narrows it to `ProviderId`. Passing `parsed.data` into resolvePersona / returning it from read() failed tsc. Changing the schema would break the 05-01 pin (MemoryTypes.test.ts).
- **Fix:** Documented boundary casts (`as UserPreferences`) at the two read seams — PreferenceMemoryStore.read() and personaConfig.loadPersona. The schema still validates the full shape; the cast only aligns the ProviderId narrowing (stored values are written by the interface-typed store).
- **Files modified:** src/core/memory/PreferenceMemoryStore.ts, src/core/ai/persona/personaConfig.ts
- **Verification:** tsc --noEmit green; schema-gate tests still reject invalid shapes
- **Committed in:** 81815dd

---

**Total deviations:** 2 auto-fixed (1 bug/contract, 1 blocking)
**Impact on plan:** Both fixes keep the shipped contracts honest — the test-defined conversion semantics and the tsc-green dual-shape read. No scope creep; all must_haves (tier counts, compactor seam, LRU ops, write-never-throws, dual-shape, no-regression) hold.

## Issues Encountered

- **`db` param unused in enforceLimits/archiveIdleConversations** — meta lives in chrome.storage (Open Q8), so the MemoryDB handle is part of the store surface for uniform MemoryEngine dispatch but unused; eslint's `^_` args rule required `_db` param naming (eslint clean, acceptance grep for `export async function enforceLimits(` unaffected).
- None other — both tasks executed as planned.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **05-04 (MemoryEngine)** can dispatch: conversation memory via `getRecentTurns` (tiered, budgeted) + the compactor seam, preferences via `PreferenceMemoryStore.read()` (compact-JSON source, D-05-08), and the LRU via `enforceLimits`/`archiveIdleConversations`; all store writes never throw so orchestration failures degrade silently (GR-9).
- **05-06 (hook wiring)** can swap `readPersonaPrefs()` for `PreferenceMemoryStore.read()` (full UserPreferences surface incl. provider/persona fields) — personaConfig keeps the Phase-3 seam for the pipeline.
- The `evict-conversation` WriteJournal op is now a real consumer of the 11-op vocabulary (D-05 in storage.ts — declared-but-unwired list shrinks).

## Self-Check: PASSED

- All 5 plan files exist on disk (2 source created, 1 modified, 2 tests created) — verified with `[ -f ]`
- Both task commits present in git log: `2b6bfa0` (ConversationMemoryStore), `81815dd` (PreferenceMemoryStore + personaConfig)
- Full vitest suite green: 93 files / 848 tests (was 91/825 before this plan; +22 new tests = 13 Conversation + 9 Preference)
- `pnpm exec tsc --noEmit` green (exit 0)
- Acceptance greps verified: `ACTIVE_CONVERSATION_LIMIT = 10` / `COMPACTOR_INTERVAL = 12` / `getRecentTurns(` / `summariseIfNeeded(` / `enforceLimits(` literals present; zero `throw` statements and zero `chrome.storage` accesses in ConversationMemoryStore.ts; `'evict-conversation'` op literal present; both `UserPreferencesSchema.safeParse(stored)` and `PersonaProfileSchema.safeParse(stored)` present in personaConfig.ts; `export async function write(`/`read(` + `UserPreferencesSchema.safeParse` + no throw in PreferenceMemoryStore.ts

---

*Phase: 05-knowledge-base-memory-minisearch-notes*
*Completed: 2026-08-14*
