---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 06
subsystem: storage
tags: [indexeddb, migrations, idb, degraded-mode, errorstore, fifo, redaction, fake-indexeddb]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: 02-01 harness (fake-indexeddb, idb, error codes, migration fixture builder) + 02-02 redactSensitive/redaction hook
provides:
  - IndexedDBMigrator (raw indexedDB.open + sync-dispatch + wrap() runner) with verbatim §20.4 IndexedDBMigration interface — the fake-indexeddb double-settle landmine fix
  - D-12 degraded mode: getDegradedDbs()/isDbDegraded()/assertWritable() typed write-block gate + IDB_MIGRATION_FAILED → ErrorStore recording; in-memory fallback explicitly rejected
  - D-14 per-DB migration registry (DBVersionMigration) — real stores extend the registry for future schema changes (e.g. Phase 5a v4 notes_backup_config)
  - ErrorStore: §15.1 debug-only FIFO-max-100 IndexedDB store, redaction-before-write (R-10/D-16), IDB_MIGRATION_FAILED sink
  - D-13 synthetic v1→v2 fixture proof: add-store + add-index + data-carry + idempotency + throws→degraded (STORAGE-01 DONE-when)
affects: [02-07 Setting/migrate-on-read, Phase 7 degraded-banner component, Phase 5a notes_backup_config migration, Phase 7 Diagnostics ErrorStore surface]

# Tech tracking
tech-stack:
  added: [] # no new dependencies — idb + fake-indexeddb from 02-01
  patterns:
    - "Raw-open migrator (RESEARCH Pattern 2): indexedDB.open + sync dispatch inside onupgradeneeded + wrap() on success — NEVER idb openDB for version-change opens (fake-indexeddb double-settle → vitest exit 1)"
    - "Pitfall 3 capture: original migration error captured in a closure (try/catch for sync throws, .catch for async rejections) BEFORE the abort swallows it — onMigrationFailed receives the real cause, not AbortError"
    - "idb wrap() done-promise consumption: wrap(tx) registers an abort listener whose rejection must be consumed (tx.done.catch) or the abort path leaks an unhandled rejection"
    - "Lexicographic FIFO ids (`<ts>.<seq>` zero-padded): primary-key order == insertion order — deterministic oldest-first trimming without a ts index"

key-files:
  created:
    - src/core/storage/IndexedDBMigrator.ts
    - src/core/storage/ErrorStore.ts
    - tests/core/storage/IndexedDBMigrator.test.ts
    - tests/core/storage/ErrorStore.test.ts
  modified: []

key-decisions:
  - "Sync-throw is the migration failure mechanism (RESEARCH Pattern 2 verified): a throwing migrate aborts the upgrade transaction atomically → AbortError → atomic rollback (version stays v(n-1), data intact). Async-rejection failures are captured + degraded but NEVER abort the wrapped tx — aborting a wrapped transaction leaks the same fake-indexeddb double-settle (empirically probed)"
  - "Commit order follows the module dependency (ErrorStore before IndexedDBMigrator) so every atomic commit passes pnpm typecheck — the migrator imports recordMigrationFailure from ErrorStore (Rule 3 sequencing fix)"
  - "ErrorStore FIFO uses id-ordering (`<ts>.<seq>` ids) instead of a by-ts index — sanctioned agent discretion (plan: 'a count+getAll-keyed-by-id ordering')"
  - "The runner consumes idb's tx.done rejection on the abort path — request.onerror owns the failure handling (Rule 1 fix, T-2-06-01)"

patterns-established:
  - "Pattern 1: version-change opens always go through raw indexedDB.open + sync dispatch + wrap(); idb openDB reserved for happy-path initial creates (no migration history)"
  - "Pattern 2: migration data-carry via request/promise-chaining on the upgrade tx — never await inside the upgrade callback (Pitfall 2); the runner attaches a .catch to the migrate result"
  - "Pattern 3: degraded DB state is module-level ({ db, reason }[]) + typed write-block gate; reads never blocked, writes typed-error-gated (D-12)"

requirements-completed: [STORAGE-01]

coverage:
  - id: D1
    description: "IndexedDBMigrator framework — raw indexedDB.open + sync dispatch + wrap() runner (RESEARCH Pattern 2), verbatim §20.4 IndexedDBMigration interface, D-14 DBVersionMigration registry, D-12 degraded mode (getDegradedDbs/isDbDegraded/assertWritable typed gate) with IDB_MIGRATION_FAILED recording via the injectable failure callback"
    requirement: STORAGE-01
    verification:
      - kind: unit
        ref: "tests/core/storage/IndexedDBMigrator.test.ts#migrates v1 → v2: adds a store, adds an index, and carries the fixture rows"
        status: pass
      - kind: unit
        ref: "tests/core/storage/IndexedDBMigrator.test.ts#is idempotent: re-running the runner at the target version is a no-op"
        status: pass
      - kind: unit
        ref: "tests/core/storage/IndexedDBMigrator.test.ts#rejects with an AbortError, keeps the DB read-only at v(n-1), data intact, writes blocked"
        status: pass
      - kind: unit
        ref: "tests/core/storage/IndexedDBMigrator.test.ts#the default failure handler records IDB_MIGRATION_FAILED in ErrorStore (D-12 sink)"
        status: pass
      - kind: other
        ref: "pnpm vitest run --reporter=dot — full suite 245/245, exit 0 (the landmine exit-0 regression guard, T-2-06-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ErrorStore — §15.1 debug-only FIFO-max-100 IndexedDB store with redaction-before-write (R-10/D-16, [REDACTED] token, raw secrets never persisted), newest-first getErrors, and the recordMigrationFailure IDB_MIGRATION_FAILED sink with console-sink fallback"
    requirement: STORAGE-01
    verification:
      - kind: unit
        ref: "tests/core/storage/ErrorStore.test.ts#keeps at most 100 entries and drops the oldest beyond the cap"
        status: pass
      - kind: unit
        ref: "tests/core/storage/ErrorStore.test.ts#persists the [REDACTED] token, never the raw secret (fixture message)"
        status: pass
      - kind: unit
        ref: "tests/core/storage/ErrorStore.test.ts#writes a code IDB_MIGRATION_FAILED entry whose cause is redacted"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-13 synthetic v1→v2 migration proof via the shared buildMigrationFixture builder (D-20/21) — add-store + add-index + data-carry, idempotent re-run, throws→degraded with original-error capture (Pitfall 3) and atomic rollback"
    requirement: STORAGE-01
    verification:
      - kind: unit
        ref: "tests/core/storage/IndexedDBMigrator.test.ts#passes the ORIGINAL migration error — not the swallowed AbortError — to the callback (Pitfall 3)"
        status: pass
      - kind: unit
        ref: "tests/core/storage/IndexedDBMigrator.test.ts#migrates v1 → v2: adds a store, adds an index, and carries the fixture rows"
        status: pass
    human_judgment: false

# Metrics
duration: 23min
completed: 2026-08-09
status: complete
---

# Phase 2 Plan 6: IndexedDB Migration Framework + ErrorStore Summary

**The IndexedDB migration framework on the raw-open + wrap() pattern (the fake-indexeddb double-settle landmine fix): verbatim §20.4 IndexedDBMigration interface, D-12 degraded mode with a typed write-block gate and IDB_MIGRATION_FAILED ErrorStore recording, the D-13 synthetic v1→v2 fixture proof (add-store + add-index + data-carry + idempotency + throws→degraded), and the FIFO-100 redacted ErrorStore debug sink — 9 new tests green, full suite 245/245 with exit 0**

## Performance

- **Duration:** 23 min
- **Started:** 2026-08-09T05:53:00Z
- **Completed:** 2026-08-09T06:15:04Z
- **Tasks:** 3 (4 commits)
- **Files modified:** 4 created

## Accomplishments

- **IndexedDBMigrator (D-14):** `runMigrations(spec, onMigrationFailed?)` opens via RAW `indexedDB.open` + SYNCHRONOUS dispatch of matching migrations inside `onupgradeneeded` + `wrap()` on success — never idb `openDB` for version-change opens (RESEARCH Pattern 2, the phase landmine fix: idb openDB with a throwing upgrade leaks fake-indexeddb's double-settle and fails `vitest run`). The `IndexedDBMigration` interface is verbatim §20.4. Migrations are dispatched WITHOUT await (Pitfall 2 — data-carry via chaining keeps the upgrade tx alive).
- **D-12 degraded mode:** a migration failure (sync throw → AbortError, atomic rollback, version stays v(n-1), data intact) runs the injected failure callback — default `handleMigrationFailed` records IDB_MIGRATION_FAILED in ErrorStore (redacted cause), debugLogs, and marks the DB degraded. `getDegradedDbs()` / `isDbDegraded()` feed the Phase-7 banner; `assertWritable(dbName)` throws the typed `DegradedDBError` write-block gate. In-memory fallback explicitly rejected (split-brain hazard).
- **Pitfall 3:** the ORIGINAL migration error is captured in a closure (try/catch for sync throws + `.catch` for async rejections) before the abort swallows it — verified by the callback test asserting `'boom'`, not the generic AbortError.
- **ErrorStore (§15.1):** debug-only, FIFO max 100, redaction-before-write via `redactSensitive` (raw sk-…/Bearer… never lands in the store — T-2-06-02), newest-first `getErrors(limit?)`, and the `recordMigrationFailure` IDB_MIGRATION_FAILED sink with a redacted console-sink fallback when ErrorStore itself cannot open (RESEARCH Q4).
- **D-13 fixture proof:** the v1→v2 migration (adds `notes_v2` store + `by_title` index + carries the fixture rows) passes end-to-end; re-running the runner at v2 is a no-op; throws→degraded asserts AbortError, degraded state, data intact, writes blocked — STORAGE-01's migration DONE-when satisfied.
- **Landmine regression guard green:** the raw-open failure paths leak no unhandled rejection — the two test files pass with exit 0, and the FULL suite (245 tests across 40 files) exits 0.

## Task Commits

Each task was committed atomically (Task 2's commit precedes Task 1's — see Deviation 1):

1. **Task 1: IndexedDBMigrator.ts — raw-open + wrap, verbatim §20.4 interface, degraded mode** - `e6b0594` (feat)
2. **Task 2: ErrorStore.ts — FIFO max 100 IndexedDB store with redaction-before-write** - `f934bc0` (feat)
3. **Task 3: IndexedDBMigrator.test.ts + ErrorStore.test.ts — v1→v2 fixture, degraded, FIFO, redaction** - `f6a7d38` (test)

**Plan metadata:** `815ca84` (fix: consume idb wrap() tx.done rejection on the upgrade-abort path)

## Files Created/Modified

- `src/core/storage/IndexedDBMigrator.ts` - Created. `IndexedDBMigration` (verbatim §20.4), `DBVersionMigration` registry, `runMigrations` raw-open runner, `getDegradedDbs`/`isDbDegraded`/`assertWritable` + `DegradedDBError`, default `handleMigrationFailed` → ErrorStore sink
- `src/core/storage/ErrorStore.ts` - Created. `ErrorEntry`/`ErrorStoreSchema`, `openErrorStore`, `writeError` (redact-before-put + FIFO trim), `getErrors(limit?)`, `recordMigrationFailure` sink
- `tests/core/storage/IndexedDBMigrator.test.ts` - Created. 5 tests: v1→v2 happy path, idempotency, throws→degraded, Pitfall-3 callback, ErrorStore sink — built on `buildMigrationFixture` (D-21)
- `tests/core/storage/ErrorStore.test.ts` - Created. 4 tests: FIFO 100 cap, newest-first + limit, redaction `[REDACTED]`, `recordMigrationFailure` redacted cause — built on `buildRedactionFixture` (D-21)

## Decisions Made

- **Sync-throw is the failure mechanism:** a throwing migration aborts the upgrade transaction atomically (verified clean, exit 0). Async-rejection failures are captured + degraded but never abort the wrapped tx — empirically probed that aborting an idb-wrapped transaction leaks the same fake-indexeddb double-settle (probe D/E: "Errors 1 error"). The runner consumes the migrate result's rejection so it is never unhandled.
- **Commit order follows the module dependency:** ErrorStore committed first because IndexedDBMigrator imports `recordMigrationFailure` — Task 1's commit would otherwise fail `pnpm typecheck` (Rule 3).
- **FIFO by id-ordering, not a ts index:** lexicographic `<ts>.<seq>` (zero-padded seq) ids make primary-key order == insertion order even for same-millisecond writes; trim deletes the oldest beyond 100 (plan-sanctioned agent discretion).
- **tx.done consumed on the abort path:** idb's `wrap(tx)` registers a done-promise abort listener (wrap-idb-value `cacheDonePromiseForTransaction`); unconsumed it rejected unhandled under fake-indexeddb and failed the suite — `request.onerror` owns the failure path, `tx.done.catch()` just consumes the signal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task commit order swapped to match the module dependency**
- **Found during:** Task 1 (IndexedDBMigrator implementation)
- **Issue:** Task 1's migrator imports `recordMigrationFailure` from ErrorStore (Task 2's file). Committing Task 1 first would fail its own `pnpm typecheck` acceptance criterion.
- **Fix:** Committed ErrorStore (Task 2, `f934bc0`) before IndexedDBMigrator (Task 1, `e6b0594`); every atomic commit is typecheck-green.
- **Files modified:** (commit ordering only — no code change)
- **Verification:** `pnpm typecheck` green at every commit.
- **Committed in:** `f934bc0` / `e6b0594`

**2. [Rule 1 - Bug] idb wrap() tx.done rejection leaked on the upgrade-abort path**
- **Found during:** Task 3 test run (migrator failure-path tests)
- **Issue:** `wrap(request.transaction!)` registers a done-promise abort/error listener (idb `cacheDonePromiseForTransaction`); when a throwing migration aborts the upgrade, that promise rejected — an unhandled rejection under fake-indexeddb ("Errors 1 error", suite exit 1). Empirically probed that `tx.abort()` on the wrapped tx leaks the same way.
- **Fix:** Consume `void tx.done.catch(...)` in `onupgradeneeded` (request.onerror owns the real failure handling); async-rejection path never aborts the wrapped tx.
- **Files modified:** src/core/storage/IndexedDBMigrator.ts
- **Verification:** migrator suite 5/5 green, exit 0; full suite 245/245 exit 0.
- **Committed in:** `815ca84`

**3. [Rule 1 - Bug] FIFO test captured "oldest" entries from the post-trim snapshot**
- **Found during:** Task 3 (ErrorStore FIFO test)
- **Issue:** The test read the store AFTER trimming (100 entries), so `all.slice(0, 5)` selected five survivors, not the five actually dropped — the dropped-assertion failed.
- **Fix:** Capture the first-written entries' ids DURING the write loop (each write makes itself the newest, so `getErrors(1)[0].id` is that write's id); assert those ids are absent from the final 100.
- **Files modified:** tests/core/storage/ErrorStore.test.ts
- **Verification:** ErrorStore suite 4/4 green.
- **Committed in:** `f6a7d38`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All fixes necessary for a green, honest suite — no scope creep. Deviation 2 (tx.done consumption) is the same family as the plan's own landmine mitigation (T-2-06-01) and directly keeps `vitest run` exit 0.

## Issues Encountered

- **Empirical probe findings (pre-implementation de-risking):** the wrapped promise-chain data-carry (probe A) and raw request-chaining (probe B) both keep the upgrade tx alive in fake-indexeddb; sync-throw → AbortError + atomic rollback is clean (probe C); aborting an idb-wrapped transaction (probe D) or even the raw transaction after wrap() touched it (probe E) leaks an unhandled rejection. These probes shaped the runner design (sync-throw primary, capture-only for async).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **STORAGE-01's migration layer + ErrorStore ship:** the synthetic v1→v2 migration passes (DONE-when satisfied); future real-store migrations (Phase 5a v4 notes_backup_config) extend the `DBVersionMigration` registry via `runMigrations` — never hand-patch stores again.
- **Degraded mode ready for Phase 7:** `getDegradedDbs()`/`isDbDegraded()` expose the `{ db, reason }` state the persistent banner renders; `assertWritable()` gives stores a typed write-block gate; ErrorStore's newest-first `getErrors()` is the Diagnostics surface's read path.
- **No blockers.** Full suite 245/245 green; typecheck/eslint/prettier clean on all touched files; the raw-open pattern keeps `vitest run` exit 0 (the phase's biggest landmine, now guarded by a permanent regression test).

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-09*

## Self-Check: PASSED

- Created files verified on disk: `src/core/storage/IndexedDBMigrator.ts`, `src/core/storage/ErrorStore.ts`, `tests/core/storage/IndexedDBMigrator.test.ts`, `tests/core/storage/ErrorStore.test.ts`, `02-06-SUMMARY.md`
- Commits verified in git log: `f934bc0` (Task 2), `e6b0594` (Task 1), `f6a7d38` (Task 3), `815ca84` (fix)
- Full verification: `pnpm typecheck` clean; eslint clean; prettier clean; plan verification command 9/9 green exit 0; full suite 245/245 (40 files) exit 0 — the fake-indexeddb landmine regression guard holds across ALL files
