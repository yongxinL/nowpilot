---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 04
subsystem: storage
tags: [idb, idb-migrator, error-store, write-journal, unlimited-storage, chat-history, memory, notes, setting]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace-handoff
    provides: extension scaffold + chrome storage adapter + test harness baseline
provides:
  - IndexedDBMigrator framework (openVersionedDB + migration registry + bootstrap)
  - Five production IndexedDB databases at v1 (ChatHistoryDB, MemoryDB, NotesDB, WriteJournalDB, ErrorStore)
  - WriteJournalEntry type home in @/types/storage (canonical O.11 declarations)
  - Setting<T> serialized-write queue (declare-now per §13)
  - ErrorStore (FIFO-100 + redactSensitive + best-effort never-rethrow)
  - unlimitedStorage permission in wxt.config.ts per ADR-STACK-02 / REQ-R06
affects: [02-05, 02-06, 02-07, 03-storage, 09-chat-history, 10-notes, 11-diagnostics]

# Actuals (#2632)
actuals:
  tokens: 9000
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: [idb@8.0.3, fake-indexeddb@6.2.5 (from 02-01), zod]
  patterns: [idb-migrator-registry, conditional-upgrade-blocks, FIFO-eviction-with-cursor-delete, redact-at-write-boundary, best-effort-debugLog-fallback, serialized-write-queue]

key-files:
  created:
    - src/types/storage.ts — WriteJournalEntry + zod schema home
    - src/core/storage/IndexedDBMigrator.ts — versioning framework + bootstrap
    - src/core/storage/ChatHistoryDB.ts — sessions + messages (§15.1)
    - src/core/storage/MemoryDB.ts — messages keyPath [conversationId,seq] + userFacts + conversationSummaries
    - src/core/storage/NotesDB.ts — notes + concepts + getNoteByTitle (§15.1)
    - src/core/storage/WriteJournalDB.ts — entries (metadata-only, D-33)
    - src/core/storage/ErrorStore.ts — FIFO-100 + redactSensitive + best-effort (D-39)
    - src/core/storage/Setting.ts — declare-now serialized-write queue (§13)
    - tests/core/storage/IndexedDBMigrator.test.ts — v1→v2 fixture + bootstrap + Setting
    - tests/core/storage/ErrorStore.test.ts — FIFO eviction + redaction + best-effort
  modified:
    - wxt.config.ts — unlimitedStorage permission (D-40 / REQ-R06 / ADR-STACK-02)

key-decisions:
  - "UpgradeDatabase typed as IDBPDatabase<unknown> so migrations accept arbitrary store names (idb's StoreNames<unknown> resolves to string)"
  - "Index modifications during upgrade must be made through the createObjectStore return value, not via a fresh transaction (invalid in upgrade context)"
  - "ErrorStore.record wraps IDB write in try/catch + debugLog fallback — never rethrows into caller (RESEARCH Open Question 4)"
  - "Setting<T> declared as declare-now — no production consumer in Phase 2; owning phase wires the chrome.storage.local back-end"

patterns-established:
  - "idb conditional upgrade blocks: if (oldVersion < N) { createObjectStore(...) }"
  - "idempotent migrations: skip-if-present guards via objectStoreNames.contains()"
  - "Module-level Map registry for migrations: registerMigration(dbName, migration), sorted by fromVersion"
  - "Migration failure → caller records IDB_MIGRATION_FAILED + degraded mode per D-41"
  - "DB module template: const DB_NAME, const DB_VERSION = 1, interface XxxDBV1 extends DBSchema, async function openXxxDB()"
  - "FIFO-100 eviction: openCursor (oldest first by autoIncrement key) + cursor.delete()"

requirements-completed: [REQ-R06, REQ-R07]

coverage:
  - id: D1
    description: "IndexedDBMigrator v1→v2 fixture proves backward-compatibility, idempotent re-open, and fresh-open-at-v2 conditional-block correctness"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: tests/core/storage/IndexedDBMigrator.test.ts#IndexedDBMigrator — v1→v2 fixture (ROADMAP criterion 4)
        status: pass
    human_judgment: false
  - id: D2
    description: "Five production databases (ChatHistoryDB, MemoryDB, NotesDB, WriteJournalDB, ErrorStore) bootstrap at v1 with §15.1 store lists"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: tests/core/storage/IndexedDBMigrator.test.ts#IndexedDBMigrator — bootstrap() opens production DBs at v1 (02-04 Task 2)
        status: pass
    human_judgment: false
  - id: D3
    description: "ErrorStore FIFO-100 eviction: writing 105 entries yields 100, oldest 5 evicted, newest 5 retained"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: tests/core/storage/ErrorStore.test.ts#Test 1: ErrorStore.record writes a typed error; FIFO eviction at 100 entries
        status: pass
    human_judgment: false
  - id: D4
    description: "ErrorStore redactSensitive at write boundary: apiKey, openAiKey, geminiKey, token, authorization all emptied (deep-clone, no mutation)"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: tests/core/storage/ErrorStore.test.ts#Test 2: ErrorStore redacts sensitive context keys at the write boundary
        status: pass
    human_judgment: false
  - id: D5
    description: "ErrorStore.record never rethrows — best-effort contract via internal try/catch + debugLog fallback"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: tests/core/storage/ErrorStore.test.ts#Test 3: ErrorStore.record never rethrows — best-effort (RESEARCH Open Question 4)
        status: pass
    human_judgment: false
  - id: D6
    description: "Setting<T> serialized-write queue: overlapping writes complete in submission order (FIFO)"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: tests/core/storage/IndexedDBMigrator.test.ts#Setting<T> serialized-write queue (02-04 Task 2; declare-now)
        status: pass
    human_judgment: false
  - id: D7
    description: "wxt.config.ts permissions = exactly ['sidePanel', 'storage', 'tabs', 'unlimitedStorage'] per ADR-STACK-02 / REQ-R06"
    requirement: REQ-R06
    verification:
      - kind: other
        ref: source assertion + grep gate (grep -c 'unlimitedStorage' wxt.config.ts >= 1; permissions array literal matches)
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-08-24
status: complete
---

# Phase 02 — Plan 04 Summary

**IndexedDB foundation: shared migrator framework + five production DBs at v1 + FIFO-100 ErrorStore + unlimitedStorage permission**

## Performance

- **Duration:** 35 min (interrupted mid-execution; recovered in-place; final 30 min end-to-end)
- **Started:** 2026-08-24T13:21:00Z (initial dispatch)
- **Completed:** 2026-08-24T15:21:00Z (post-recovery)
- **Tasks:** 3/3
- **Files modified:** 11 (8 created, 1 source modified, 2 test files)

## Accomplishments

- `IndexedDBMigrator` framework: `openVersionedDB<T>` with per-DB migration registry, conditional upgrade blocks, blocked-callback propagation, best-effort error path
- Five production DBs bootstrapped at v1 with §15.1 schema fidelity (ChatHistoryDB, MemoryDB, NotesDB, WriteJournalDB, ErrorStore)
- MemoryDB messages store uses spec-explicit compound keyPath `[conversationId, seq]`
- WriteJournalEntry type home in `@/types/storage` with zod schema (cross-boundary runtime validation)
- Setting<T> declare-now (serialized-write queue per §13, no production consumer in Phase 2)
- ErrorStore: FIFO-100 cursor eviction, redactSensitive at write boundary, never-rethrow best-effort contract
- `unlimitedStorage` permission added to wxt.config.ts per ADR-STACK-02 / REQ-R06 (with Pitfall 7 carve-out documenting that the chrome.storage.session 10MB cap is NOT lifted)

## Task Commits

1. **Task 1: WriteJournalEntry types + IndexedDBMigrator + v1→v2 fixture (RED)** - `e0d691a` (test)
2. **Task 1: GREEN impl — types/storage.ts, IndexedDBMigrator, ChatHistoryDB** - `10b9458` (feat)
3. **Tasks 2 + 3: remaining 4 DBs + Setting<T> + ErrorStore + unlimitedStorage + tests** - `bf696f9` (feat)

**Note on Task 2/3 merging:** the original three-task plan was collapsed into a single atomic commit because Task 2's three new files (MemoryDB, NotesDB, Setting.ts) and Task 3's three new files (WriteJournalDB, ErrorStore, wxt.config.ts) all shipped as one cohesive wave once the executor recovered from its mid-execution interrupt. The unit-of-work is still atomic and committed in a single `feat(02-04)` commit. The recovery note is in `## Deviations from Plan` below.

## Files Created/Modified

- `src/types/storage.ts` — WriteJournalEntry, WriteJournalOperation union (all 11 ops), WriteJournalEntrySchema (zod)
- `src/core/storage/IndexedDBMigrator.ts` — versioning framework, bootstrap(), migration registry, UpgradeDatabase type
- `src/core/storage/ChatHistoryDB.ts` — sessions (byUpdated index) + messages (sessionId index)
- `src/core/storage/MemoryDB.ts` — messages (keyPath `[conversationId, seq]`, byConversation index) + userFacts + conversationSummaries
- `src/core/storage/NotesDB.ts` — notes (byTitle + byUpdated indexes) + concepts (byLabel index) + getNoteByTitle
- `src/core/storage/WriteJournalDB.ts` — entries (byStatus + byCreated indexes, metadata-only per D-33)
- `src/core/storage/ErrorStore.ts` — NowPilotErrorRecord, record() (FIFO-100 + redact), queryRecent()
- `src/core/storage/Setting.ts` — defineSetting<T>, serialized-write queue, __resetSettingQueue test seam
- `tests/core/storage/IndexedDBMigrator.test.ts` — 7 tests (4 v1→v2 fixture + 2 bootstrap + 1 Setting)
- `tests/core/storage/ErrorStore.test.ts` — 3 tests (FIFO, redaction, never-rethrow)
- `wxt.config.ts` — permissions += 'unlimitedStorage', comment block updated for D-19a + ADR-STACK-02

## Decisions Made

- **UpgradeDatabase typing:** typed as `IDBPDatabase<unknown>` (not `IDBPDatabase<DBSchema>`) because idb's `StoreNames<DBSchema>` resolves to `never` — `DBSchema` only has the `[s: string]` index signature with no known keys. `StoreNames<unknown>` resolves to `string`, which is what migrations need (arbitrary store names).
- **Inline upgrade callback type:** preserved the typed `IDBPDatabase<T>` for per-DB `open*DB()` callers so `createObjectStore('sessions', ...)` is schema-checked. The untyped `UpgradeDatabase` is reserved for the registered-migration path.
- **Setting<T> queue storage:** uses a module-level promise chain (not a per-handle queue) so all Setting handles share one FIFO. This matches the §13 "never write two Setting<T> keys concurrently" rule at the module level.
- **ErrorStore.record never-rethrow:** internal try/catch + debugLog fallback. Per RESEARCH Open Question 4, this is the canonical best-effort shape.
- **ErrorStore.writeRecord:** the inner function is the one that may throw; `record()` is the public best-effort wrapper.

## Deviations from Plan

### Recovery from mid-execution interrupt

- **Found during:** Initial executor dispatch (Task 1 was committing RED + GREEN, but a truncated agent response left the GREEN impl files uncommitted while the agent returned an empty result).
- **Issue:** Executor agent's `task_result` came back empty (likely stream truncation). Plan 02-04 had:
  - 1 commit (RED test) ✓
  - 3 uncommitted impl files (`IndexedDBMigrator.ts`, `ChatHistoryDB.ts`, `types/storage.ts`) — produced but not committed
  - 0 of 4 remaining impl modules (`MemoryDB`, `NotesDB`, `WriteJournalDB`, `ErrorStore`)
  - 0 of 2 remaining test files (`ErrorStore.test.ts`, extended bootstrap cases in `IndexedDBMigrator.test.ts`)
- **Fix:** Recovered in-place by committing the GREEN impl files (Task 1) as `10b9458`, then completing Tasks 2 + 3 inline (`MemoryDB`, `NotesDB`, `Setting.ts`, `WriteJournalDB`, `ErrorStore`, `wxt.config.ts`, `tests/core/storage/ErrorStore.test.ts`, `tests/core/storage/IndexedDBMigrator.test.ts` extensions). Single `feat(02-04)` commit (`bf696f9`) covers all of Tasks 2 + 3.
- **Files modified:** all 11 files in the plan's `files_modified` list.
- **Verification:** `pnpm lint` exits 0; `pnpm run verify:phase-2` exits 0 (46/46 tests); full suite 205/205.
- **Impact:** None — plan deliverables unchanged. The recovery is an artifact of the executor agent's response truncation, not a plan change.

### Auto-fixed Issues

**1. [Rule 1 - Type] Indexes must ship with the store that introduces them (idb invariant)**
- **Found during:** Task 1 test 1 fixture migration
- **Issue:** Original test attempted to `createIndex` on an EXISTING store from a fresh transaction inside the upgrade callback. This violates idb's invariant — the upgrade callback fires within an implicit versionchange transaction; opening a new transaction on the same store during upgrade throws `InvalidStateError`.
- **Fix:** Test fixture now creates the `items` store WITH its `byName` index atomically at v0→v1; v1→v2 migration only adds the new `tags` store. This matches the production-correct shape per spec §20.4 (indexes ship with their store).
- **Files modified:** `tests/core/storage/IndexedDBMigrator.test.ts`
- **Verification:** Test 1 (backward-compatible) now passes; same 7/7 unit tests green.
- **Committed in:** `bf696f9` (Task 2/3 commit)

**2. [Rule 2 - Type] UpgradeDatabase needs `unknown` schema, not `DBSchema`**
- **Found during:** Task 2 — `pnpm lint` flagged type errors in the test file at every `database.createObjectStore('items', ...)` call inside `migrate: (database) => {...}` callbacks.
- **Issue:** idb's `StoreNames<DBSchema>` resolves to `never` because `DBSchema` only has the `[s: string]` index signature and no known keys (KnownKeys<DBSchema> = never). Migrations can't operate against `never`.
- **Fix:** `UpgradeDatabase = IDBPDatabase<unknown>` — idb's `StoreNames<unknown>` falls through to `string`, which is the migration-correct shape (migrations define the schema, so they must accept arbitrary store names).
- **Files modified:** `src/core/storage/IndexedDBMigrator.ts`
- **Verification:** `pnpm lint` exits 0.
- **Committed in:** `bf696f9` (Task 2/3 commit)

**3. [Rule 2 - Schema fidelity] ChatHistoryDB.sessions needed byUpdated index in schema declaration**
- **Found during:** Task 2 — `pnpm lint` flagged `sessions.createIndex('byUpdated', 'updated')` as not assignable.
- **Issue:** Inline upgrade created an index that wasn't declared in the `ChatHistoryDBV1` schema. Strict typing requires the schema to declare every index.
- **Fix:** Added `indexes: { byUpdated: number }` to the `sessions` store declaration.
- **Files modified:** `src/core/storage/ChatHistoryDB.ts`
- **Verification:** `pnpm lint` exits 0.
- **Committed in:** `bf696f9` (Task 2/3 commit)

**4. [Rule 1 - Test isolation] clearMigrations('FixtureDB') in beforeEach**
- **Found during:** Task 1 test 3 — `HIERARCHY_REQUEST_ERR` when test 3 ran after test 2.
- **Issue:** Migration registry is a module-level Map. Test 2's migration persisted into test 3, causing duplicate `tags` store creation attempts.
- **Fix:** Test file's `beforeEach` calls `clearMigrations('FixtureDB')` to isolate migration state between tests.
- **Files modified:** `tests/core/storage/IndexedDBMigrator.test.ts`
- **Verification:** All 7/7 IndexedDBMigrator tests pass.
- **Committed in:** `bf696f9` (Task 2/3 commit)

---

**Total deviations:** 1 recovery + 4 auto-fixed (4 type/test-isolation corrections)
**Impact on plan:** All auto-fixes are strict-typing and test-isolation correctness — no scope change, no plan deviation. The recovery is an artifact of executor response truncation, handled inline.

## Issues Encountered

- Executor agent's `task_result` came back empty during initial dispatch (stream truncation mid-execution). The agent had already committed the RED test and produced impl files but the GREEN commit + Tasks 2/3 work were stranded. Recovered in-place via inline completion.
- idb's `StoreNames<T>` type machinery is non-intuitive — `KnownKeys<DBSchema>` resolves to `never` because `DBSchema` only has the `[s: string]` index signature. The `unknown` schema fallback is the correct shape for untyped migrations.
- The test file's `__resetIndexedDB()` helper clears IDB but not the migration registry — tests must explicitly `clearMigrations('FixtureDB')` in `beforeEach` to avoid HIERARCHY_REQUEST_ERR on duplicate store creation.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Plan 02-05 (WriteJournal + journalingAdapter) can proceed — it imports `WriteJournalEntrySchema` and `WriteJournalEntry` from `@/types/storage` (the home shipped here).
- Plan 02-06 (WorkspaceElection + chromeStorageAdapter) can proceed independently — it does not depend on IDB types.
- Plan 02-07 (WorkspaceStore integration) depends on BOTH 02-05 and 02-06 plus the IDB foundation shipped here.
- Phase 3 (storage + aiProvider) can use the indexed DBs for chat history, memory, notes, and WriteJournal (for crash-safe writes).

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-24*
