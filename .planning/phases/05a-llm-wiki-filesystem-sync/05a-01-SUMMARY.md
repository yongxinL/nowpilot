---
phase: 05a-llm-wiki-filesystem-sync
plan: 01
subsystem: notes/ai
tags: [llm, enrichment, notetagger, llmservice, eventbus, indexeddb, zod, yaml]

# Dependency graph
requires:
  - phase: 05-knowledge-base
    provides: NotesDB (v4 CRUD + note:saved), NoteSchema, MigrationRunner v4, MiniSearchNoteIndex, EventBus, WriteJournal
  - phase: 03-ai-core-pipeline
    provides: ProviderAdapter, TierResolver (resolveTierModel), StructuredOutput (generateWithRepair/repairJSON), PipelineError
  - phase: 05-knowledge-base
    provides: MemoryEngine + MemoryRecord CONFIDENCE_MAP (confidence derived from source, D-07)
provides:
  - LlmService shared structured-LLM facade (D-08) wrapping generateWithRepair
  - NoteTagger enrichment + memory extraction service (single haiku call, enrichment + memoryFacts partitions per D-01)
  - note:saved → NoteTagger handler wiring with D-06 toggle gate, D-07 version staleness, D-04 confidence filter/cap, D-05 note:enriched in-memory emission
  - NotesDB v5 with backup_config store (D-09) + getByLastSyncedAt/updateLastSyncedAt (D-11)
  - NoteSchema Phase 5a fields (summary, lastSyncedAt, summaryGeneratedAt, tagsGeneratedAt) + NoteTaggerResultSchema/NoteQAResultSchema/NoteDraftSchema
affects: [05a-02, 05a-03, 05b, 07-notes-ui]

# Tech tracking
tech-stack:
  added: [yaml 2.9.0, @types/wicg-file-system-access 2023.10.7]
  patterns:
    - "Module-level singleton + reset (getLlmService/resetLlmService, getNoteTagger/resetNoteTagger)"
    - "EventBus subscription with module-level idempotency guard (unsub) and fire-and-forget handler"
    - "Zod schema at module boundaries (NoteTaggerResultSchema partitions per D-01)"
    - "Structured LLM call via LlmService.generate({adapter, tier, systemPrompt, userPrompt, schema, abortSignal})"

key-files:
  created: [src/core/ai/LlmService.ts, src/core/notes/NoteTagger.ts, tests/core/notes/NoteTagger.test.ts]
  modified: [src/core/notes/NoteSchema.ts, src/core/storage/MigrationRunner.ts, src/core/notes/NotesDB.ts, src/core/notes/MiniSearchNoteIndex.ts, tests/core/notes/NotesDB.test.ts, package.json, package-lock.json]

key-decisions:
  - "LlmService delegates to generateWithRepair — PipelineError re-thrown, AbortError → ABORTED, unknown → UNKNOWN (error semantics inherited from StructuredOutput)"
  - "NoteTagger.analyze() returns null on LLM error (silently discard) instead of throwing — fire-and-forget contract honored at both analyze() and the EventBus handler"
  - "note:saved payload carries version (D-07) so the handler skips the pre-call DB read; handler falls back to DB version when absent"
  - "MiniSearchNoteIndex.openDb() bumped to NotesDB v5 — opening at v4 threw VersionError once the DB migrated to v5"
  - "resetNoteTagger() unsubscribes the EventBus handler before nulling the instance — prevents stale-handler leak across tests"
  - "@types/wicg-file-system-access placed in devDependencies (dev-only types, per RESEARCH)"
  - "@testing-library/dom@^10 restored to devDependencies — the initial npm install pruned it from the (already drifted) lockfile"

requirements-completed: [NOTE-02, NOTE-03]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "LlmService shared facade — generate() joins system+user prompts and returns Zod-validated structured output via generateWithRepair"
    requirement: NOTE-02
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteTagger.test.ts#calls LlmService.generate with FAST tier and NoteTaggerResultSchema"
        status: pass
    human_judgment: false
  - id: D2
    description: "End-to-end tracer: note save → EventBus note:saved → NoteTagger handler → LlmService.generate (FAST) → NoteTaggerResult with enrichment + memoryFacts partitions → note:enriched event"
    requirement: NOTE-02
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteTagger.test.ts#emits note:enriched with both partitions when a note is saved"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-04 confidence filtering (drop < 0.3, cap 3), D-06 toggle gate (all-off skips LLM, memory-off discards facts), D-07 version staleness discard, silent PipelineError handling"
    requirement: NOTE-02
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteTagger.test.ts#enrichment behaviors (D-04 / D-06 / D-03 / error handling)"
        status: pass
    human_judgment: false
  - id: D4
    description: "NotesDB v5 migration: backup_config store (keyPath id) survives upgrade from v4 without data loss; getByLastSyncedAt/updateLastSyncedAt query methods"
    requirement: NOTE-03
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteTagger.test.ts#migration v5 creates the backup_config store with keyPath id"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-03 confidence mapping — toMemoryFactInput maps accepted facts to source 'inferred' (store derives confidence 0.5 via CONFIDENCE_MAP); LLM self-score stays display-only"
    requirement: NOTE-02
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteTagger.test.ts#maps accepted memory facts to inferred confidence 0.5 via toMemoryFactInput (D-03)"
        status: pass
    human_judgment: false
  - id: D6
    description: "NoteSchema Phase 5a fields (summary/lastSyncedAt/summaryGeneratedAt/tagsGeneratedAt, all optional) plus NoteTaggerResultSchema/NoteQAResultSchema/NoteDraftSchema — existing Phase 5 tests unchanged"
    requirement: NOTE-02
    verification:
      - kind: unit
        ref: "npx vitest run tests/core/notes/ --no-coverage (60/60 pass)"
        status: pass
    human_judgment: false

# Metrics
duration: 13min
completed: 2026-08-02
status: complete
---

# Phase 05a Plan 01: LlmService + NoteTagger Enrichment Pipeline Summary

**End-to-end LLM enrichment tracer: shared LlmService facade (generateWithRepair wrapper), NoteTagger with single haiku call returning enrichment + memoryFacts partitions (D-01), wired to EventBus note:saved with D-06 toggles, D-07 version staleness, D-04 confidence filtering, and NotesDB v5 migration with backup_config store**

## Performance

- **Duration:** 13 min
- **Started:** 2026-08-02T03:27:13Z
- **Completed:** 2026-08-02T03:40:42Z
- **Tasks:** 2 (1 tracer + 1 auto)
- **Files modified:** 11

## Accomplishments

- **LlmService (D-08):** shared structured-LLM facade — `generate({ adapter, tier, systemPrompt, userPrompt, schema, abortSignal })` joins prompts and delegates to `generateWithRepair`, inheriting the single JSON-repair pipeline (fence stripping, trailing commas, brace balancing, Zod validation) and PipelineError semantics (re-throw / ABORTED / UNKNOWN).
- **NoteTagger (D-01, D-02, D-03, D-04, D-05, D-06, D-07, D-17):** module singleton subscribed to `note:saved` (idempotent). Handler flow: toggle gate → DB read → single FAST-tier LLM call → version staleness check (re-read) → confidence filter (< 0.3 dropped, max 3) → `note:enriched` in-memory emission. `toMemoryFactInput()` maps accepted facts to `source: 'inferred'` (confidence 0.5 via CONFIDENCE_MAP) — LLM self-confidence never becomes the system tier.
- **NotesDB v5 (D-09, D-11):** MigrationRunner v5 creates the `backup_config` store (keyPath `id`) for the persisted `FileSystemDirectoryHandle`; NotesDB opens at v5 and adds `getByLastSyncedAt()` / `updateLastSyncedAt()`; `note:saved` payload now carries `version` for D-07.
- **NoteSchema Phase 5a:** optional `summary`, `lastSyncedAt`, `summaryGeneratedAt`, `tagsGeneratedAt` fields (existing Phase 5 notes/tests unaffected) + `NoteTaggerResultSchema` (enrichment + memoryFacts partitions), `NoteQAResultSchema`, `NoteDraftSchema` for the remaining Phase 5a services.
- **Tracer test suite (18 tests):** save → handler → LLM → NoteTaggerResult with both partitions; stale-version discard; FAST-tier/schema assertions; v5 migration + query methods; behavior suite for D-03/D-04/D-06/error handling.
- **Dependencies:** `yaml@2.9.0` (runtime) and `@types/wicg-file-system-access@2023.10.7` (dev) — both pre-verified in RESEARCH Package Legitimacy Audit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install deps + NoteSchema extension + MigrationRunner v5 + LlmService + NoteTagger (end-to-end tracer)** - `4582c51` (feat)
2. **Task 2: NoteTagger enrichment behaviors + confidence filtering + toggle logic + test suite completion** - `8c7641a` (feat)

**Plan metadata:** pending (docs commit follows)

## Files Created/Modified

- `src/core/ai/LlmService.ts` (new) - Shared structured-LLM facade wrapping generateWithRepair (D-08)
- `src/core/notes/NoteTagger.ts` (new) - Enrichment + memory extraction service with EventBus subscription, toggle gate, staleness check, confidence filter, note:enriched emission, toMemoryFactInput
- `tests/core/notes/NoteTagger.test.ts` (new) - 18 tests: tracer + behaviors + v5 migration/query coverage
- `src/core/notes/NoteSchema.ts` - Phase 5a optional fields + NoteTaggerResultSchema/NoteQAResultSchema/NoteDraftSchema
- `src/core/storage/MigrationRunner.ts` - migrateV5: backup_config store with keyPath id (D-09)
- `src/core/notes/NotesDB.ts` - openNotesDb bumped to v5; getByLastSyncedAt/updateLastSyncedAt; note:saved payload version
- `src/core/notes/MiniSearchNoteIndex.ts` - openDb bumped to v5 (VersionError fix)
- `tests/core/notes/NotesDB.test.ts` - note:saved payload assertion includes version
- `package.json` / `package-lock.json` - yaml 2.9.0, @types/wicg-file-system-access 2023.10.7, @testing-library/dom@^10 restored
- `.planning/phases/05a-llm-wiki-filesystem-sync/deferred-items.md` (new) - pre-existing failure ledger

## Decisions Made

- **LlmService error semantics inherited from generateWithRepair** — no duplicate error mapping; PipelineError re-thrown, AbortError → ABORTED, unknown → UNKNOWN.
- **analyze() returns null on LLM error** — "silently discard" honored at both the analyze() boundary and the EventBus handler (no throw, no unhandled rejection, no UX noise).
- **note:saved payload carries version** (plan Task 2) — handler uses payload version, falling back to the DB-read version when absent (defensive for other emitters).
- **MiniSearchNoteIndex v5 bump** — required consequence of the NotesDB version bump; opening at v4 threw VersionError in the journal update-index step.
- **resetNoteTagger() unsubscribes** — module-level `unsub` cleared so tests and restarts never fire a stale handler on a discarded instance.
- **Types package in devDependencies** — @types/wicg-file-system-access is dev-only per RESEARCH; kept out of the production bundle.
- **@testing-library/dom restored** — the initial npm install pruned it from the drifted lockfile, breaking 3 component test suites.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] MiniSearchNoteIndex opened NotesDB at v4 → VersionError after v5 bump**
- **Found during:** Task 1 (tracer test run)
- **Issue:** `openDB('NotesDB', 4)` inside MiniSearchNoteIndex.openDb() threw `VersionError: attempt to open a database using a lower version than the existing version` once NotesDB migrated to v5 — the journal `update-index` step failed, so every note save returned JOURNAL_ERROR.
- **Fix:** Bumped `migrationRunner.migrate('NotesDB', 5)` + `openDB('NotesDB', 5)` in MiniSearchNoteIndex.openDb().
- **Files modified:** src/core/notes/MiniSearchNoteIndex.ts
- **Verification:** full notes/storage suite green; tracer save → note:enriched passes
- **Committed in:** 4582c51 (Task 1 commit)

**2. [Rule 1 - Bug] npm install pruned @testing-library/dom from the lockfile**
- **Found during:** full-suite run after Task 1
- **Issue:** the initial `npm install yaml@^2 @types/wicg-file-system-access@2023.10` rewrote the (already drifted) lockfile and dropped `@testing-library/dom` — 3 component suites failed with `Cannot find module '@testing-library/dom'`. Baseline lockfile was already out of sync with package.json (root zod 3.25.76 vs declared ^4.4.3).
- **Fix:** `npm install -D @testing-library/dom@^10 --legacy-peer-deps` (10.4.1); component suites green again.
- **Files modified:** package.json, package-lock.json
- **Verification:** CommandPalette/ThemeToggle/ThemeSync suites pass (11 tests)
- **Committed in:** 8c7641a (Task 2 commit)

**3. [Rule 2 - Missing Critical] resetNoteTagger() leaked the EventBus subscription**
- **Found during:** Task 1 (test isolation design)
- **Issue:** module-level `unsub` survived `resetNoteTagger()` — a reset kept the old handler subscribed, calling a discarded instance and making the idempotency guard permanently armed (double-subscription risk across tests/restarts).
- **Fix:** resetNoteTagger() now calls `unsub()` and clears it before nulling the instance.
- **Files modified:** src/core/notes/NoteTagger.ts
- **Verification:** idempotency test asserts exactly one generate call per save across resets
- **Committed in:** 4582c51 (Task 1 commit)

**4. [Rule 2 - Correctness] @types/wicg-file-system-access landed in dependencies**
- **Found during:** Task 1 (post-install review)
- **Issue:** dev-only type definitions installed into `dependencies` (would ship in the production dep tree).
- **Fix:** moved to devDependencies (with --legacy-peer-deps due to the pre-existing ollama-ai-provider zod peer quirk).
- **Files modified:** package.json, package-lock.json
- **Verification:** `npm ls` shows 2023.10.7 under devDependencies
- **Committed in:** 4582c51 (Task 1 commit)

**5. [Plan-mandated test update] note:saved payload now includes version**
- **Found during:** Task 2 (D-07 payload version directive)
- **Issue:** existing NotesDB.test.ts asserted `toHaveBeenCalledWith({ noteId })` — the added `version` field broke the strict assertion.
- **Fix:** assertion updated to `{ noteId, version: 1 }`.
- **Files modified:** tests/core/notes/NotesDB.test.ts
- **Verification:** NotesDB suite green
- **Committed in:** 8c7641a (Task 2 commit)

---

**Total deviations:** 5 auto-fixed (3 bugs, 2 correctness/mandated)
**Impact on plan:** All fixes required for correctness and green suites; no scope creep. The MiniSearchNoteIndex v5 bump was a forced consequence of the plan's own NotesDB v5 directive.

## Issues Encountered

- **Pre-existing repository drift (not caused by this plan):** the committed `package-lock.json` did not match `package.json` (root zod 3.25.76 vs declared ^4.4.3; `@testing-library/dom` absent; SDKs hoisted differently). The plan's required `npm install` normalized the lockfile, which surfaced latent failures in `tests/core/ai/StreamAdapter.test.ts` (2) and `tests/core/ai/providers/ProviderAdapter.test.ts` (4) — reproduced identically at the pre-05a baseline commit with a fresh install (both plain and `--legacy-peer-deps`). Out of scope; logged to `.planning/phases/05a-llm-wiki-filesystem-sync/deferred-items.md`.
- **npm ERESOLVE on devDep move:** re-resolving with `-D` hit the pre-existing ollama-ai-provider zod peer conflict; worked around with `--legacy-peer-deps` (tree contents unchanged).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Proven architecture slice for Plans 05a-02 (NoteQA + NoteChatConverter) and 05a-03 (NoteFileSync + NoteMaintenance): LlmService is the shared LLM path, NoteTaggerResultSchema/NoteQAResultSchema/NoteDraftSchema are the contracts, NoteSchema v5 fields are in place, backup_config store exists for the FileSystemDirectoryHandle.
- NotesDB v5 migration means any consumer touching NotesDB must open at v5 (MiniSearchNoteIndex precedent).
- Note: 05a-01 covers NOTE-02's NoteTagger slice and NOTE-03's storage foundation; full NOTE-03 (filesystem sync) lands in Plan 05a-03.

---
*Phase: 05a-llm-wiki-filesystem-sync*
*Completed: 2026-08-02*
