---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 02
subsystem: database
tags: [indexeddb, idb, fake-indexeddb, write-journal, migrations, zod, chrome-storage, tracer, wave-2]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: idb ^8 + fake-indexeddb ^6 installed, tests/setup.ts Wave 0 seams (__resetIndexedDB, Map-backed session area, shared onChanged dispatcher), unlimitedStorage in the built manifest
provides:
  - "src/core/storage/NowPilotDB.ts — DB_NAME 'np_db', DB_VERSION 1, the NowPilotDB DBSchema (sessions/messages/entries/errors + canonical indexes), the lazy single getDb() handle, closeDb(), onBlockedOpen(), NowPilotDbOpenError, __test__ (reset, migration-failure injection, openWithVersion, getObservability)"
  - "src/core/storage/IndexedDBMigrator.ts — §20.4 IndexedDBMigration, v1InitialPhase2Stores, MIGRATIONS (one entry), runMigrations() with a redacted result recorded before the deliberate abort, classifyOpenError(), getLastMigrationResult()"
  - "src/core/storage/ChatHistoryDB.ts — ChatSessionRecord, MessageRecord, chatSessionRecordSchema, messageRecordSchema, writeConversationWithMessages(), readConversation(), readAllConversations()"
  - "src/core/storage/WriteJournal.ts — WriteJournalOperation (with the additive 'migrate-legacy-conversations'), writeJournalEntrySchema, MIGRATION_STAGE_NAMES, JournalStep, createJournalEntry(), runJournaled(), recoverJournal(), compactJournal()"
affects: [02-05, 02-06, 02-08, 02-10, 02-11, 02-13, phase-08-memory, phase-09-notes]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 21345
  tasks: 3
  commits: 3
plan_head_before: 59474ebd1729b080f7b98ff134e2ce0e9b40b3d0

tech-stack:
  added: []
  patterns:
    - "One physical database, named object stores, one integer version axis (D2-24): later phases append to MIGRATIONS, never edit v1"
    - "Deliberate-abort upgrade: the upgrade listener is synchronous, handles runMigrations' promise, marks tx.done handled, then tx.abort() — the only shape that yields one AbortError and no unhandled rejection"
    - "Existence checks before every createObjectStore/createIndex, so a re-run is idempotent"
    - "Validate before the transaction opens; one readwrite transaction per conversation; authoritative readonly read-back before any success"
    - "Journal stages pre-seeded as pending at creation (divergence from O.11) so a restart distinguishes not-reached from reached"
    - "Redacted reason strings read the error NAME structurally (DOMException is not instanceof Error here) — never the message"

key-files:
  created:
    - src/core/storage/NowPilotDB.ts
    - src/core/storage/IndexedDBMigrator.ts
    - src/core/storage/ChatHistoryDB.ts
    - src/core/storage/WriteJournal.ts
    - tests/core/storage/ChatHistoryDB.test.ts
    - tests/core/storage/WriteJournal.test.ts
    - tests/core/storage/IndexedDBMigrator.test.ts
    - tests/core/storage/NowPilotDB.test.ts
  modified: []

key-decisions:
  - "Topology locked (D2-24/OQ-1): ONE physical database `np_db` at DB_VERSION 1 holding `sessions`, `messages`, `entries`, `errors`; v2/v3 reserved for Phase 8 Memory and v4 for §20.4's notes_backup_config (Phase 9). The weaker failure isolation (a failed open also loses ErrorStore) is accepted and mitigated by debugLog + the caller's notice + in-memory operation (§19.10), never by an ErrorStore write that cannot land."
  - "`np_db` and the four store names are locked here because PRODUCT_SPEC names no database anywhere; the naming is recorded as a documentation follow-up inside NowPilotDB.ts (D2-29 pattern) and the spec is not edited during Phase 2."
  - "The migration failure path is a deliberate abort, not a throw from `upgrade`: `runMigrations` records the redacted result and rethrows; the upgrade listener is synchronous, marks `tx.done` handled and calls `tx.abort()`. Probed: an async upgrade rejection is NOT awaited by idb (the open would succeed over a half-applied schema), and both a bare throw and a bare tx.abort() emit a second, unhandled rejection."
  - "`WriteJournalOperation` gains 'migrate-legacy-conversations' additively (OQ-2), recorded as a spec follow-up in the module comment; the seven D2-09 stage names are declared once in MIGRATION_STAGE_NAMES for 02-05 to re-export."
  - "Journal stages are pre-seeded as `pending` at creation and flipped to `completed` per step — the divergence from Appendix O.11 that D2-09's restart-safety and D2-12's retained destination-verified stage require."
  - "`compactJournal` is a pure function returning `{ keep, removed }`: the caller deletes the removed ids. The production call site is not owned by any Phase 2 plan and is recorded in the broken-windows ledger."

patterns-established:
  - "A migration step receives the §20.4 bare `IDBPDatabase`/`IDBPTransaction`; the schema-erased boundary is crossed once, inside runMigrations, so no caller casts."
  - "Blocked-open observability is two-shaped on purpose: `onBlockedOpen()` is the live signal a notice consumer subscribes to, and the last signal is retained for direct assertion."
  - "Absence assertions are paired with a non-vacuity case that plants the sentinel and expects the assertion to fire."

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "np_db topology and schema: one database at DB_VERSION 1 with exactly sessions/messages/entries/errors, the canonical key paths and indexes, no Memory or Notes store, integer ordered contiguous versions, and a repeated open that recreates and corrupts nothing"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/storage/NowPilotDB.test.ts (6 passed)"
        status: pass
      - kind: integration
        ref: "npx vitest run tests/core/storage (6 files / 51 tests, after __resetIndexedDB per test)"
        status: pass
    human_judgment: false
  - id: D2
    description: "IndexedDBMigrator framework: ordered integer-version upgrade applied exactly once, no-op reopen, below-current open typed as IDB_UNSUPPORTED_VERSION and never retried, injected step failure recorded as IDB_MIGRATION_FAILED with a deliberate abort and no unhandled rejection, deterministic retry, blocked/blocking observed on both sides, and the test-only v1→v2 future-store fixture"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/storage/IndexedDBMigrator.test.ts (7 passed)"
        status: pass
      - kind: integration
        ref: "npx vitest run tests/core/storage/IndexedDBMigrator.test.ts tests/core/storage/NowPilotDB.test.ts (13 passed, no unhandled-rejection line)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ChatHistoryDB: conversation and messages committed in one readwrite transaction, authoritative readonly read-back before any success, integer [sessionId, seq] ordering, strict Zod validation at both boundaries, and the proof that the body exists only inside np_db (absent from both chrome.storage maps and from the journal entry)"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/storage/ChatHistoryDB.test.ts (5 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "WriteJournal contract: seven pre-seeded D2-09 stages, persistence after every transition, idempotent replay of an interrupted applying entry and of a pending entry, reverse-order rollback with a non-masking rollback-failure log, duplicate handling by idempotency key, bounded compaction that never removes a non-terminal entry, attempt increments, strict-schema rejection, and no sentinel body in the serialised entry, the log ring buffer or either storage map"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/storage/WriteJournal.test.ts (11 passed)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The topology decision and the np_db/store-name lock are recorded as a documentation follow-up inside NowPilotDB.ts (D2-24: researched and locked before implementation, spec not edited)"
    requirement: "CORE-02"
    verification: []
    human_judgment: true
    rationale: "No test can assert that a follow-up is recorded in the right place for the right owner; a verifier should confirm the module comment carries the D2-29-style follow-up and that no PRODUCT_SPEC edit was made."

duration: 10 min
completed: 2026-09-24
status: complete
---

# Phase 2 Plan 02: Storage Spine — `np_db`, Migrator, ChatHistoryDB, WriteJournal Summary

**One physical `np_db` at `DB_VERSION = 1` with the four canonical stores, an ordered-integer-version migrator that aborts deliberately and never retries a below-current open, a single-transaction ChatHistoryDB write with an authoritative read-back, and a restart-safe WriteJournal — proved end to end by 29 cases across four suites, with the message body asserted absent from `chrome.storage`.**

## Performance

- **Duration:** 10 min
- **Started:** 2026-09-23T23:00:02Z
- **Completed:** 2026-09-23T23:10:00Z
- **Tasks:** 3
- **Files modified:** 8 (all created)

## Accomplishments

- **The tracer path is real, not a prototype.** One conversation written through `runJournaled` into the `sessions`/`messages` stores of `np_db`, read back authoritatively, marked `completed` in the journal, and proved absent from both `chrome.storage` maps — the single test that would have caught an architectural dead end before five more plans build on it.
- **The topology decision is locked in code** (D2-24/OQ-1): `DB_NAME = 'np_db'`, `DB_VERSION = 1`, stores `sessions`, `messages`, `entries`, `errors` with the canonical key paths and indexes; `messages` keyed `['sessionId','seq']` so ordering is integer, never a string sort. The production `MIGRATIONS` table holds exactly one entry.
- **The failure paths are the interesting part, and they are proved.** A `VersionError` maps to a typed unsupported-version result that is cached and never retried; an injected step failure records `IDB_MIGRATION_FAILED` and aborts the versionchange transaction with **no unhandled rejection**; a blocked open records its typed signal while an older connection holds the database and completes once the holder closes; the holder closes itself through `blocking` so a newer version can proceed.
- **The v1→v2 fixture proves later phases can extend the schema without editing Phase 2's migration** — `future_probe` appears at v2 while every v1 store survives with its data, the production table is untouched, and a second open at v2 runs nothing. It is test-only; no Memory or Notes store exists anywhere in `src/`.
- **No Phase 1 regression:** the full repository suite is green at 45 files / 598 tests, and the wave slice (`tests/core/storage`, `tests/core/workspace`, `tests/isolation`, `tests/core/store`) at 15 files / 226 tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end — one conversation journaled into `np_db` and read back, with no body in chrome.storage** — `1d6a3550` (feat)
2. **Task 2: WriteJournal contract — stage progression, replay, rollback, bounds, redaction** — `e0855981` (test)
3. **Task 3: Migrator and database contract — upgrade, blocked/blocking, abort, v1→v2 future-store fixture** — `321289ed` (test)

**Plan metadata:** see the final `docs(02-02)` commit below

## Files Created/Modified

- `src/core/storage/NowPilotDB.ts` — the topology lock, the `NowPilotDB` DBSchema, the lazy single handle, the four `openDB` callbacks, `NowPilotDbOpenError`, `onBlockedOpen()` and the `__test__` seams (handle reset, migration-failure injection, `openWithVersion`, observability).
- `src/core/storage/IndexedDBMigrator.ts` — the verbatim §20.4 `IndexedDBMigration`, `v1InitialPhase2Stores` with existence-checked store/index creation, `runMigrations()` (redacted result before the deliberate rethrow), `classifyOpenError()`, `getLastMigrationResult()`.
- `src/core/storage/ChatHistoryDB.ts` — `ChatSessionRecord`/`MessageRecord` with strict schemas (no `preview` — it is a body excerpt), `writeConversationWithMessages()` (validate → one `readwrite` transaction → `readonly` read-back → success only on match), `readConversation()`, `readAllConversations()` (newest-first through `by-updated`).
- `src/core/storage/WriteJournal.ts` — the Appendix C entry schema, the additive `'migrate-legacy-conversations'` operation, `MIGRATION_STAGE_NAMES` (the single declaration of the seven D2-09 names), `createJournalEntry()` with idempotency-key lookup, `runJournaled()`, `recoverJournal()`, `compactJournal()`.
- `tests/core/storage/ChatHistoryDB.test.ts` — the tracer case plus integer-ordering, strict-rejection, newest-first and the non-vacuity case for the absence assertion.
- `tests/core/storage/WriteJournal.test.ts` — eleven named contract cases.
- `tests/core/storage/IndexedDBMigrator.test.ts` — seven named cases including the blocked/blocking pair and the v1→v2 fixture.
- `tests/core/storage/NowPilotDB.test.ts` — six schema/version cases.

## Decisions Made

- **One database, and the cost is named.** `np_db` at `DB_VERSION = 1`; v2/v3 reserved for Phase 8's Memory stores and v4 for §20.4's `notes_backup_config` + Note-field migration (Phase 9). The weaker failure isolation of a single database (a failed open also loses the ErrorStore) is accepted explicitly and mitigated by `debugLog` + the caller's notice + in-memory operation (§19.10) — never by an ErrorStore write that cannot land. Recorded in the module comment as a documentation follow-up, in the D2-29 pattern; `PRODUCT_SPEC.md` is not edited.
- **The migration failure path is a deliberate abort.** `runMigrations` records a redacted result and rethrows; the upgrade listener is synchronous, marks `tx.done` handled and calls `tx.abort()`. Three probe results forced this shape: an async `upgrade` rejection is **not** awaited by `idb` (the open would succeed over a half-applied schema), a bare throw emits an unhandled rejection beside `openDB`'s `AbortError`, and a bare `tx.abort()` does too unless `tx.done` is marked handled.
- **`'migrate-legacy-conversations'` is added additively** to the closed §20.3 union (OQ-2), recorded as a spec follow-up; `MIGRATION_STAGE_NAMES` is the one declaration 02-05 re-exports.
- **Stages are pre-seeded as `pending`** rather than pushed as `completed` (the deliberate O.11 divergence) — D2-09's restart-safety and D2-12's retained destination-verified stage both need "not reached" to be distinguishable from "reached".
- **`compactJournal` is pure** (`{ keep, removed }`), leaving the delete to the caller. No Phase 2 plan currently owns that call site; recorded in the broken-windows ledger rather than invented here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The typed open-failure mapping silently degraded to `IDB_OPEN_FAILED`**
- **Found during:** Task 3 (the migrator and database contract)
- **Issue:** `classifyOpenError` and the module-local `errorName` helpers used `error instanceof Error ? error.name : typeof error`. IndexedDB rejects with a `DOMException`, which is **not** `instanceof Error` in this environment, so every classification produced `'object'` — a below-current open and an aborted upgrade both surfaced as the generic `IDB_OPEN_FAILED` instead of `IDB_UNSUPPORTED_VERSION` / `IDB_MIGRATION_FAILED`. The plan's must-have ("Opening below the current version fails closed to a typed unsupported-version error") was therefore not actually met by the first implementation, and the failure was invisible until Task 3's cases asserted the codes.
- **Fix:** all four modules now read the error **name** structurally (a non-empty string `name` on a non-null object), falling back to `typeof`. The message is still never read, so nothing value-bearing can enter a log.
- **Files modified:** `src/core/storage/IndexedDBMigrator.ts`, `src/core/storage/NowPilotDB.ts`, `src/core/storage/ChatHistoryDB.ts`, `src/core/storage/WriteJournal.ts`
- **Verification:** `npx vitest run tests/core/storage` → 51 passed; the three cases that previously failed on the wrong code now pass; `tsc --noEmit` clean.
- **Committed in:** `321289ed` (part of Task 3's commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** The fix is what makes the plan's typed-failure must-haves true; without it the "never retried" and "typed blocked signal" claims were unproven. No scope creep: the change is confined to the redacted-reason helper in the four modules this plan creates.

## Issues Encountered

- **The journal module landed complete in Task 1's commit.** Task 1's action already required the entry schema, `runJournaled` and `recoverJournal` (the tracer needs them), so the whole `WriteJournal.ts` shipped with `1d6a3550`; Task 2's commit carries the eleven-case contract suite that proves it, with no implementation change needed. The task split is therefore 1 feat commit + 2 test commits rather than the plan's implied shape.
- **Two probe findings reshaped the upgrade wiring** (both verified against `idb@8.0.3` + `fake-indexeddb@6.2.5` in this repo before writing the code): `idb` does not await the `upgrade` callback's return value, and `tx.done` must be marked handled before a deliberate abort. Both are recorded in the module comment so a later phase does not "simplify" them back into a silent failure.
- **`blocked` does not fire when the holder closes synchronously**, so the blocked case uses a raw older connection (no `versionchange` handler) to observe the requester's signal, and a second case observes the holder's `blocking` close. Both sides of T-02-09 are asserted, in two cases rather than one.
- Pre-existing untracked planning artifacts (`.gsd/`, `.planning/milestone.lock`) were left untouched — outside this plan's scope.

## Known Stubs

None. Every module this plan created is wired into the path its suite exercises; no placeholder values, no TODO/FIXME markers, and no empty-collection defaults flow anywhere.

## Threat Flags

None. Every surface this plan introduced was already in the plan's `<threat_model>` (T-02-06 body disclosure, T-02-07 migrator tampering, T-02-08 replay duplication, T-02-09 blocked-upgrade DoS, T-02-10 crash-state repudiation) and each has a passing assertion. No new network endpoint, auth path, file access pattern or trust-boundary schema change was added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **02-05** can re-export `MIGRATION_STAGE_NAMES` and consume `runJournaled` with the additive `'migrate-legacy-conversations'` operation; the `entries` store and its `by-status` index already exist at v1.
- **02-06** gets the topology it needs for `update-workspace`: the `entries` store is available inside the same database as every other Phase 2 store, and `getDb()` is the single handle.
- **02-08** can hydrate through `readAllConversations()`/`readConversation()` and map `NowPilotDbOpenError.code` onto the hydration states; `CHAT_HISTORY_NOT_FOUND` is deliberately distinct from an error so "empty" can never be reached from a failure.
- **02-10** can subscribe to `onBlockedOpen()` for the degraded-mode notice (the in-memory degrade and the `storage.degraded` copy are that plan's, not this one's).
- **Open item recorded for the phase (not a blocker):** `recoverJournal()` and `compactJournal()` are implemented and unit-proved here, but no Phase 2 plan names their production call site — 02-08 hydrates and "resumes the legacy migration" without naming a recovery call, and nothing calls compaction. Logged in `.planning/WINDOWS.md` so it is visible at ship time.
- No Phase 2 successor plan needs to invent a database name, a store name, a key path, an index or a journal shape.

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 8 created files exist on disk: the four storage modules and their four suites.
- All 4 plan commits exist in history: `1d6a3550` (Task 1), `e0855981` (Task 2), `321289ed` (Task 3), `bc3b11ff` (plan metadata).
- Measured commit count at SUMMARY write time (`git rev-list --count 59474ebd..HEAD`): 3 task commits, base recorded as `plan_head_before`.
