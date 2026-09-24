---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 05
subsystem: database
tags: [indexeddb, idb, fake-indexeddb, error-store, legacy-migration, chrome-storage, zod, redaction, write-journal, wave-3]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-02's `np_db` spine — the `errors`/`entries` stores, the strict-schema and typed-result conventions, `ChatHistoryDB`'s single-transaction write plus authoritative read-back, and `WriteJournal` with the seven `MIGRATION_STAGE_NAMES` and the additive `'migrate-legacy-conversations'` operation"
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-03's `redactSensitive` choke point (the ErrorStore context boundary)"
provides:
  - "src/core/storage/ErrorStore.ts — `ERROR_STORE_MAX_RECORDS` (100), `ERROR_STORE_RESOLVED_RETENTION_MS`, `ERROR_RESOLUTIONS`, `ErrorRecord`, `errorRecordSchema`, `RecordErrorInput`, `recordError()`, `listErrors()`, `resolveError()`, `cleanupErrors()`, the four typed result unions and `ErrorStoreFailureCode`"
  - "src/core/storage/legacyChatMigration.ts — `LEGACY_CHAT_SOURCE_KEY`, `CONVERSATION_META_STORAGE_KEY`, `MIGRATION_ENTRY_ID`, `MIGRATION_OPERATION`, `MIGRATION_STAGE_NAMES` (re-exported from `WriteJournal`), `NP_STORE_V3_SCHEMA_VERSION`, `NP_STORE_V3_FIELDS`, `projectNpStoreV3()`, `ConversationMeta`, `LegacyChatHistoryPort`, `LegacyChatMigrationDeps`, `LegacyChatMigrationFailureCode`, `runLegacyChatMigration()`"
  - "tests/core/storage/ErrorStore.test.ts (11 cases) and tests/core/storage/legacyChatMigration.test.ts (30 cases) — the D2-15 case table including the seven-stage restart loop"
affects: [02-06, 02-08, 02-09, 02-10, 02-13, phase-08-memory, phase-11-observability]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 25121
  tasks: 3
  commits: 4
plan_head_before: 005bf17ac437b386d4baf02c79c7d93e993443f1

tech-stack:
  added: []
  patterns:
    - "The bound is part of the write: `recordError` evicts the oldest records beyond the cap with a `by-occurred` cursor inside the same `readwrite` transaction as the insert, never in a later sweep"
    - "Two-stage redaction at one boundary: `redactSensitive` (sensitive field NAMES) then a recursive strip of the `message`/`stack` keys a caught exception's payload always arrives under, so \"no raw exception payload\" is structural rather than a caller convention"
    - "A forward-only migration: `runJournaled`'s terminal `rolled-back` is deliberately overridden to `applying` so the entry stays resumable, and every step's `rollback()` is a no-op because a partial destination is repaired by replaying idempotent upserts over deterministic keys, never by deleting destination records"
    - "Quarantine blocks sanitisation: a malformed or unsupported legacy record still lets the recoverable conversations migrate, but the run fails at `source-sanitised` with `destination-verified` retained and the source byte-identical — the D2-13 operator checkpoint is not taken"
    - "Allow-list sanitisation that never reads the dropped value: `projectNpStoreV3` rebuilds from `NP_STORE_V3_FIELDS`, so a body, a nested message structure and the body-derived `preview` are dropped without their values being read"
    - "Restart simulation by durable state, not module state: the seven-stage loop drives a crash from the journal persist that follows a named stage, then constructs a fresh run against the same stores"

key-files:
  created:
    - src/core/storage/ErrorStore.ts
    - src/core/storage/legacyChatMigration.ts
    - tests/core/storage/ErrorStore.test.ts
    - tests/core/storage/legacyChatMigration.test.ts
  modified:
    - src/core/storage/NowPilotDB.ts

key-decisions:
  - "`ErrorStore` owns the canonical `ErrorRecord` shape and `NowPilotDB` imports it type-only (the `ChatSessionRecord`/`MessageRecord` precedent), so the `errors` store's declared value type and the record schema cannot drift. The store keeps its `keyPath: 'id'` and `by-occurred` index unchanged."
  - "The FIFO cap is enforced inside the insert transaction rather than by a periodic sweep, and `cleanupErrors({ now })` takes an injectable clock so the retention window is deterministic without fake timers."
  - "`resolveError` is success-shaped and write-free for an absent or already-resolved record; the suite proves it by resolving twice with different classifications and asserting the first classification survives with one record."
  - "The migration is forward-only and resumable (see patterns): a failure leaves `status: 'applying'` with the failing stage marked `failed`, one redacted `IDB_MIGRATION_FAILED` is recorded in the ErrorStore under the deterministic id `legacy-chat-migration:<stage>` (so retries update one record instead of growing the store), and no discard path exists."
  - "A quarantine is a *sanitisation* failure, not a validation abort: valid conversations still reach the destination, `destination-verified` is retained, and the source stays byte-identical — so a body that did not reach a verified destination can never be deleted (T-02-26)."
  - "`projectNpStoreV3` + `NP_STORE_V3_FIELDS` are the single declaration of the surviving `np_store` field set (`config`, `prompts`, `writeHistory`, `notes`); 02-08's `npStoreMigrate` imports them. `notes`/`writeHistory` are left in place and Phase 9 owns their move — never silently dropped (RESEARCH Pattern 7)."
  - "The conversation index is written to `np_conversation_meta` as canonical `ConversationMeta` records with `status: 'active'` and integer `created`/`lastAccessed`/`messageCount`, merged by id so an already-sanitised re-run cannot wipe it; the LRU caps and `evict-conversation` stay Phase 8's (OQ-5)."
  - "`IDB_MIGRATION_FAILED` is the ErrorStore code for every migration failure (§20.4's first real consumer) while the caller receives the specific `LEGACY_CHAT_MIGRATION_*` code in the typed result; the stage and specific code travel in the redacted context."

patterns-established:
  - "An absent source is a no-op that still completes: no destination write, no source write, no index write — and the journal entry is recorded `completed` with all seven stages (D2-15 empty contract)."
  - "An already-sanitised source (`version === 3`) short-circuits the whole run when the entry is already `completed`, and skips only the destination comparison when it is not — because a v3 source can only exist after a verified destination."
  - "Deterministic ids everywhere: session id or `mig:session:<index>`, `seq` from the array index, message id or `mig:<conversationId>:<seq>` — which is what makes a replay an upsert rather than a duplicate."
  - "The suite drives the real `ChatHistoryDB` over `fake-indexeddb` as the destination and Maps as the durable `chrome.storage`-shaped stores, so a \"restart\" is a fresh `runLegacyChatMigration` call against the same stores."

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "ErrorStore: bounded at 100 with oldest-first eviction, redacted before persistence, strict-schema rejection at the boundary, idempotent resolution, retention cleanup, and a typed `ERROR_STORE_UNAVAILABLE` (never a throw, never a doomed write) when the database cannot open"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/storage/ErrorStore.test.ts (11 passed)"
        status: pass
      - kind: integration
        ref: "npx vitest run tests/core/storage (9 files / 112 tests, after __resetIndexedDB per test)"
        status: pass
    human_judgment: false
  - id: D2
    description: "legacyChatMigration: the seven D2-09 stages as `steps[].name` on one deterministic entry, the D2-10 per-conversation procedure with an in-memory destination read-back before any source rewrite, allow-list sanitisation that drops bodies and the body-derived excerpt without reading them, and the D2-12 failure semantics (non-terminal entry, stages intact, source intact, one redacted record)"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/storage/legacyChatMigration.test.ts (30 passed)"
        status: pass
      - kind: integration
        ref: "the production-seams case: chrome.storage.local + np_conversation_meta + the np_db `entries` store, no injected storage"
        status: pass
    human_judgment: false
  - id: D3
    description: "The D2-15 case table: every named case including the restart loop parameterised by stage name (all seven stages), already-migrated destination, partially migrated installation, malformed conversation and message, unsupported schema version, ordering/timestamp preservation, stable ids, the schema bump, the completion marker, and the sentinel-absence assertions over the source, the journal entries, the failure records and the log ring buffer"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/storage/legacyChatMigration.test.ts — 'restart between every journal stage' (7 cases) and 'after-success invariants'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Plan verification gate: both suites green together and in the full storage-directory run, `tsc --noEmit` clean, and no wave regression (the Phase 2 wave slice grows by exactly this plan's two suites)"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "npx tsc --noEmit (clean) && npx vitest run tests/core/storage (9 files / 112 tests) && npx vitest run tests/core/storage tests/core/security tests/core/workspace tests/core/store tests/isolation (22 files / 357 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cross-plan contract: 02-08's `npStoreMigrate` imports `projectNpStoreV3` (this module is the single owner of the surviving field set) and `hydrateChatHistory()` calls `runLegacyChatMigration` — a structural match this plan's own suite cannot assert"
    requirement: "CORE-02"
    verification: []
    human_judgment: true
    rationale: "A cross-plan import contract cannot be asserted from this plan's suites; 02-08's Task 1 performs the substitution and its own suite proves the cutover. A verifier should confirm `npStoreMigrate` restates no copy of the field list and that `hydrateChatHistory()` calls this module rather than re-implementing the migration."

duration: 14 min
completed: 2026-09-24
status: complete
---

# Phase 2 Plan 05: ErrorStore and the Legacy Chat Migration Summary

**The phase's one-way data migration landed: `ErrorStore` (FIFO-bounded at 100, redacted by two boundaries, idempotently resolvable, typed-unavailable) and `legacyChatMigration` (the seven D2-09 stages over deterministic ids, an in-memory destination read-back before any source rewrite, an allow-list sanitisation that drops bodies without reading them, and a quarantine path that blocks sanitisation rather than discarding data) — proved by 41 cases including a restart between every one of the seven stages.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-09-23T23:54:34Z
- **Completed:** 2026-09-24T00:09:00Z
- **Tasks:** 3
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- **The body leaves `chrome.storage` only after the destination is proved.** Every legacy conversation is validated, given a deterministic id, written through 02-02's single-transaction ChatHistoryDB path, read back and compared **in memory** (id, count, ordering by `seq`, message ids, role, timestamp and body equality — never logged), and only then is the source rewritten from an allow-list at v3. The suite asserts the sentinel body's absence from the source, every journal entry, the failure records and the `debugLog` ring buffer in the same cases that assert its presence in ChatHistoryDB.
- **Sanitisation cannot read what it deletes.** `projectNpStoreV3` rebuilds from `NP_STORE_V3_FIELDS`, so `sessions`, `activeSessionId`, the nested message structures and the body-derived `preview` are dropped without their values ever being read — the `legacyCredentialCleanup` discipline applied to bodies. The read-back then confirms the stored blob is at v3 with a key set inside the allow-list.
- **Restart safety is proved, not asserted.** The restart loop is parameterised by stage name and covers all seven: a crash is injected at the journal persist that follows the named stage, and each case then constructs a **fresh** run against the same durable stores — the destination ends at exactly 3 conversations / 3 messages with no duplicates, the source is sanitised, and the entry is `completed`. The `completed`-stage case is exactly D2-14's "sanitisation completes but the completion marker is delayed".
- **A failure never becomes a data loss.** Every failure path leaves the entry `applying` with its stages intact (`destination-verified` retained where it was reached) and the source byte-identical; a quarantined record still lets the recoverable conversations migrate while blocking sanitisation, and the failure is recorded once per stage as a redacted `IDB_MIGRATION_FAILED` with safe ids only.
- **`ErrorStore` is §20.4's first real consumer and it is bounded.** The cap is enforced inside the insert transaction, resolution is a write-free no-op on the second call, the context is redacted and then stripped of `message`/`stack`, and a database that cannot open yields `ERROR_STORE_UNAVAILABLE` instead of a doomed write — the §19.10 degraded path (log plus the caller's notice) rather than a write that cannot land.
- **No regression.** `tsc --noEmit` clean; the storage directory at 9 files / 112 tests; the Phase 2 wave slice (`tests/core/storage`, `tests/core/security`, `tests/core/workspace`, `tests/core/store`, `tests/isolation`) green at 22 files / 357 tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: `ErrorStore.ts` — bounded, redacted, idempotently resolvable failure records** — `35d25458` (feat)
2. **Task 2: `legacyChatMigration.ts` — seven stages, deterministic ids, source sanitisation** — `917973b2` (feat)
3. **Task 3: the D2-15 migration case table — 29 named cases** — `3fd0a44c` (test)
4. **Task 3 (follow-up): the migration's production seams end to end** — `605b60ce` (test)

**Plan metadata:** see the final `docs(02-05)` commit below

## Files Created/Modified

- `src/core/storage/ErrorStore.ts` — `ERROR_STORE_MAX_RECORDS`/`ERROR_STORE_RESOLVED_RETENTION_MS`/`ERROR_RESOLUTIONS`, the strict `errorRecordSchema`, `recordError()` (redact → strip → validate → insert + bound in one transaction), `listErrors()` (newest-first, re-validated), `resolveError()` (idempotent), `cleanupErrors({ now })`, the `unavailable()` typed failure, and the payload-stripping walk.
- `src/core/storage/legacyChatMigration.ts` — `projectNpStoreV3`/`NP_STORE_V3_FIELDS`, the recognised legacy envelope/session/message schemas, `discoverLegacySource()`/`validateLegacyState()`, the seven `buildSteps()` closures with no-op rollbacks, `isSanitisedSource()`, `destinationMatches()`, `LegacyChatMigrationStepError`, the injected `LegacyChatMigrationDeps` with per-call production defaults, and `runLegacyChatMigration()` with the non-terminal failure override and the redacted ErrorStore record.
- `src/core/storage/NowPilotDB.ts` — the `errors` store's value type now comes from `ErrorStore.ts` as a type-only import (`export type { ErrorRecord }`) instead of a locally declared interface (see Deviations).
- `tests/core/storage/ErrorStore.test.ts` — 11 cases: migration-failure and degraded-mode records, redaction before persistence, payload stripping, malformed rejection, idempotent resolution, the FIFO bound, retention cleanup, bound re-enforcement by cleanup, the unavailable path, and a non-vacuity case that plants a sentinel and expects the scan to find it.
- `tests/core/storage/legacyChatMigration.test.ts` — 30 cases: the declared surface, the D2-15 table, the seven-stage restart loop, the production-seams case and the after-success invariants.

## Decisions Made

- **`ErrorStore` owns the record shape, `NowPilotDB` imports it.** The `errors` store's declared value type was a 02-02 placeholder (`{ id, code, message, occurredAt, context? }`) whose comment deferred the repository to this plan; the canonical shape replaces it. `keyPath: 'id'` and the `by-occurred` index are unchanged, so no schema version moves.
- **The bound lives in the write, and cleanup takes a clock.** `recordError` evicts via the `by-occurred` cursor in the same transaction; `cleanupErrors({ now })` keeps the retention window deterministic without fake timers.
- **Forward-only, resumable, never rolling back a destination.** `runJournaled`'s terminal `rolled-back` is overridden to `applying` on failure, and every migration step's `rollback()` is a deliberate no-op — a partial destination is repaired by replaying idempotent upserts, never by deleting records. This is the one place the plan's "use `runJournaled`" instruction needed a stated divergence.
- **A quarantine fails the *sanitisation*, not the migration's useful work.** Valid conversations still reach the destination; the run fails at `source-sanitised` with `destination-verified` retained and the source byte-identical, because a body that did not reach a verified destination must never be deleted, and D2-13's discard checkpoint is explicitly not taken.
- **`IDB_MIGRATION_FAILED` for the record, `LEGACY_CHAT_MIGRATION_*` for the caller.** §20.4 names the ErrorStore code; the typed result carries the specific code and stage, and the record's context carries both plus the quarantined safe ids (capped at 20).
- **The conversation index is merged, not overwritten.** `writeConversationIndex` merges by id so a re-run against an already-sanitised source cannot wipe the index; `ConversationMeta` is §21.3 verbatim with `status: 'active'`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `NowPilotDB.ts`'s placeholder `ErrorRecord` contradicted the plan-mandated record shape**
- **Found during:** Task 1 (the ErrorStore write boundary)
- **Issue:** `NowPilotDB.ts` declared the `errors` store's value type as `{ id, code, message, occurredAt, context? }` — a 02-02 placeholder whose own comment says the repository belongs to this plan — while Task 1 mandates `{ id, code, occurredAt, attempts, resolved, resolution, context? }` with no `message`. `db.put('errors', record)` is type-checked against the store's declared value, so the two could not coexist; the file is outside this plan's `files_modified`, so the conflict had to be resolved rather than worked around.
- **Fix:** `NowPilotDB.ts` now imports `type { ErrorRecord } from './ErrorStore'` and re-exports it (`export type { ErrorRecord }`), exactly the precedent it already sets for `ChatSessionRecord`/`MessageRecord` from `ChatHistoryDB`. The store's `keyPath: 'id'` and `by-occurred` index are untouched, so no version bump or migration is involved.
- **Files modified:** `src/core/storage/NowPilotDB.ts` (7 insertions, 9 deletions)
- **Verification:** `npx tsc --noEmit` clean; `npx vitest run tests/core/storage` → 9 files / 112 tests green, including 02-02's `NowPilotDB.test.ts` schema assertions.
- **Committed in:** `35d25458` (part of Task 1's commit)

**2. [Rule 2 - Missing Critical] A fourth commit added production-seam coverage after Task 3's commit**
- **Found during:** the post-commit stub/coverage scan for this SUMMARY
- **Issue:** Task 3's suite injects every storage seam (as the plan requires, "so the suite can drive it without real storage"), which left `defaultReadSource`, `defaultWriteSource`, `defaultWriteConversationIndex` and `defaultJournalStore` — the production wiring 02-08 will call — with no coverage at all. The plan's `<verification>` asks for the migration's behaviour, not just the injected one.
- **Fix:** one case with **no** injected storage, index or journal: it seeds `chrome.storage.local`, runs `runLegacyChatMigration()` with only the real defaults, and asserts the v3 rewrite in place, the merged body-free index under `np_conversation_meta`, the `completed` entry in the real `np_db` `entries` store, and the destination as the normal read path. Task 3's commit had already landed, so this is a follow-up commit rather than an amendment — hence 4 commits for 3 tasks.
- **Files modified:** `tests/core/storage/legacyChatMigration.test.ts`
- **Verification:** `npx vitest run tests/core/storage/legacyChatMigration.test.ts` → 30 passed; `tsc --noEmit` clean.
- **Committed in:** `605b60ce`

---

**Total deviations:** 2 auto-fixed (1 blocking type conflict, 1 missing critical coverage)
**Impact on plan:** The first is what makes the plan's `ErrorRecord` shape actually storable; without it the module could not compile against the store it owns. The second closes a real gap in the plan's own verification intent. No scope creep: the only file touched outside `files_modified` is the one the type conflict forced.

## Issues Encountered

- **The restart loop's own assertions had to distinguish pre- and post-sanitisation stages.** A crash at the `source-sanitised` (or `completed`) stage happens *after* the source rewrite, so asserting "the source still holds the bodies" is only true up to `destination-verified`. The case now asserts the stage-appropriate invariant: bodies present and v2 before sanitisation, bodies absent and v3 after it. The migration itself was correct; the first version of the assertion was not.
- **The migration uses `runJournaled` while deliberately overriding its terminal failure status.** `runJournaled` lands a failed entry as `rolled-back` (terminal, and therefore never replayed by `recoverJournal`), which contradicts D2-12/D2-14's resumability. The override to `applying` plus no-op rollbacks is the smallest shape that keeps 02-02's journal contract intact and the migration resumable; it is recorded in the module comment and in the decisions above.
- Pre-existing untracked planning artifacts (`.gsd/`, `.planning/milestone.lock`) were left untouched — outside this plan's scope.

## Known Stubs

None. Every module this plan created is exercised by its own suite, and the production defaults are exercised end to end by the production-seams case. No placeholder values, no TODO/FIXME markers, no empty-collection defaults flowing anywhere, and no test skipped.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: storage-write | `src/core/storage/legacyChatMigration.ts` | The migration writes `np_conversation_meta` (`chrome.storage.local`) — the D2-08-mandated conversation index. It carries `ConversationMeta` (id, title, status, integer timestamps, `messageCount`) only: titles are metadata, never bodies, and the suite asserts the sentinel's absence from the index. No other `chrome.storage` key is created by this plan (the completion marker is the journal entry's terminal status plus the source schema bump). |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **02-08** can `import { projectNpStoreV3, NP_STORE_V3_SCHEMA_VERSION, runLegacyChatMigration }` exactly as its plan names; `npStoreMigrate` should replace its `PERSISTED_BLOB_FIELDS` top-level pick with `projectNpStoreV3` and keep its existing nested config/provider/model `pickFields` treatment. `hydrateChatHistory()` gets a throw-free typed result and an entry that is already resumable on the next call.
- **02-10 / 02-11** have `ErrorStore.recordError` for `IDB_MIGRATION_FAILED`-class records; the module returns typed results rather than throwing, so a caller can render a notice without a try/catch.
- **02-13**'s corrected `verify:phase-2` already enumerates both suites created here (`tests/core/storage/ErrorStore.test.ts`, `tests/core/storage/legacyChatMigration.test.ts`), so the path preflight resolves them.
- **Phase 8** inherits the conversation index with its caps unenforced by design (OQ-5): `np_conversation_meta` is written here with `status: 'active'`, and the 10/100 LRU eviction plus `evict-conversation` journaling are that phase's.
- **Phase 9** inherits `np_store`'s `notes`/`writeHistory` payloads untouched — this migration deliberately left them in place rather than silently dropping user data.
- **Open item recorded for the phase (not a blocker):** the migration's production call site and the two surfaces' kickoff order (D2-17 step 2) are 02-08/02-10's; nothing in this plan wires an entrypoint, so a Real-Chrome observation of the one-time migration remains part of the Phase 15 consolidated cycle.

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 4 created files exist on disk: `ErrorStore.ts`, `legacyChatMigration.ts` and their two suites (`NowPilotDB.ts` is the one modified file).
- All 4 plan commits exist in history: `35d25458` (Task 1), `917973b2` (Task 2), `3fd0a44c` (Task 3), `605b60ce` (Task 3 follow-up coverage).
- Measured commit count at SUMMARY write time (`git rev-list --count 005bf17a..HEAD`): 4 task commits, base recorded as `plan_head_before`.
