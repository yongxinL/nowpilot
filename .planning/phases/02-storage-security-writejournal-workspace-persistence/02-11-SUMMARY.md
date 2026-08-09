---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 11
subsystem: storage
tags: [keyvault, chrome-storage, indexeddb, privacy-gate, isolation, entrypoint-wiring]

# Dependency graph
requires:
  - phase: 02-03
    provides: KeyVault installSecret lifecycle + encryptSecret (the vault path the privacy test drives)
  - phase: 02-05
    provides: runMigrateOnRead + DEFAULT_MIGRATE_SANITIZERS (D-10 KV normalization)
  - phase: 02-06
    provides: IndexedDBMigrator.runMigrations + ErrorStore + degraded state (D-12/D-14)
  - phase: 02-04
    provides: WriteJournal journaled workspace write path (D-06) + persistJournalEntry redaction boundary
provides:
  - Storage-layer bootstrap (KeyVault first-run + migrate-on-read + IDB migrator) wired into both entrypoints
  - Extended FORBIDDEN_TOKENS (idb/fflate/KeyVault/EncryptedStorage/fake-indexeddb) in the content-bundle isolation check
  - Automated no-secrets-in-storage privacy test (4 cases) proving A-22/A-23/A-24
  - Green verify:phase-2 evidence gate closing Phase 2 (Golden Rule 10)
affects:
  - Phase 7 (degraded-mode banner via getDegradedDbs — the state ships now, UI renders later)
  - Phase 5a (NotesDB v4 migration extends the entrypoint-registered spec list)
  - Phase 3 (provider layer consumes the vault's PROVIDER_KEY_UNREADABLE routing)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "grep-stable call sites: namespace imports (import * as Setting / Migrator) keep per-file acceptance greps at exactly 1"
    - "warm-open-before-migrator: canonical openXxxDB creates the v1 schema first so runMigrations never creates an empty version-1 DB"
    - "non-blocking mount bootstrap: every step wrapped (debugLog + fall-through), never rejects the mount"

key-files:
  created:
    - tests/core/storage/no-secrets-in-storage.test.ts
  modified:
    - src/entrypoints/sidepanel/main.tsx
    - src/entrypoints/standalone/main.tsx
    - tests/isolation/check-content-bundle.mjs

key-decisions:
  - "Warm-open each real store via its canonical openXxxDB before runMigrations: on a fresh install runMigrations over an empty migration list would create an EMPTY version-1 DB and silently break openChatHistoryDB()/openNotesDB()/etc. (upgrade never re-fires at the same version). The warm-open preserves the single source of truth for schema creation; runMigrations is the D-14 hook that runs future registered migrations at mount."
  - "Namespace imports (import * as Setting, import * as Migrator) in the entrypoints: the plan's acceptance greps demand grep -c runMigrateOnRead/runMigrations == 1 per file, and a named import line plus a call line would count 2 (grep counts lines). Namespace imports keep each literal on exactly one line while preserving full type safety."
  - "WriteJournalDB spec version hardcoded as 1 with a comment (WRITE_JOURNAL_DB_VERSION is module-private); all four real stores are at v1 today, so no export churn in files outside the plan's scope."
  - "getInstallSecret catch logs PROVIDER_KEY_UNREADABLE (plan-mandated code choice): the vault being unavailable at mount is the same shared unreadable state the provider layer routes on."

requirements-completed: [STORAGE-01, STORAGE-02, STORAGE-03, STORAGE-04, STORAGE-05]

coverage:
  - id: D1
    description: "Storage-layer bootstrap wired into both entrypoints — KeyVault first-run (getInstallSecret), migrate-on-read (runMigrateOnRead), IDB migrator (runMigrations) over the real stores + ErrorStore sink, all non-blocking and graceful-degrading"
    requirement: STORAGE-02
    verification:
      - kind: manual_procedural
        ref: "grep getInstallSecret/runMigrateOnRead/runMigrations == 1 per entrypoint file"
        status: pass
      - kind: other
        ref: "pnpm typecheck"
        status: pass
      - kind: unit
        ref: "tests/entrypoints/sidepanel.test.tsx + standalone.test.tsx (11 mount tests, bootstrap fires at module scope)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Content-bundle isolation tokens extended (idb/fflate/KeyVault/EncryptedStorage/fake-indexeddb) and the automated no-secrets-in-storage privacy test proving A-22/A-23/A-24 + journal redaction"
    requirement: STORAGE-03
    verification:
      - kind: unit
        ref: "tests/core/storage/no-secrets-in-storage.test.ts#4 cases"
        status: pass
      - kind: other
        ref: "node tests/isolation/check-content-bundle.mjs"
        status: pass
    human_judgment: false
  - id: D3
    description: "verify:phase-2 gate green (eslint + prettier + tsc + wxt build + vitest run + isolation) and all five §18 Phase-2 DONE-when criteria mapped to passing tests"
    requirement: STORAGE-04
    verification:
      - kind: other
        ref: "pnpm run verify:phase-2 (exit 0; 42 files / 261 tests green)"
        status: pass
      - kind: unit
        ref: "tests/core/storage/WriteJournal.test.ts + EncryptedStorage.test.ts + IndexedDBMigrator.test.ts + tests/core/utils/RateLimiter.test.ts + tests/core/workspace/WorkspacePersistence.test.ts + KeyVault.test.ts + no-secrets-in-storage.test.ts (35 tests)"
        status: pass
    human_judgment: false

# Metrics
duration: 16min
completed: 2026-08-09
status: complete
---

# Phase 2 Plan 11: Entrypoint Storage Wiring + Privacy Gate Summary

**verify:phase-2 closes Phase 2 green: entrypoint storage bootstrap (KeyVault first-run, migrate-on-read, IDB migrator) wired into both surfaces, the no-secrets-in-storage automated privacy gate (4 cases) proving A-22/A-23/A-24, and the content-bundle isolation tokens extended with the vault/IDB stack.**

## Performance

- **Duration:** 16 min
- **Started:** 2026-08-09T07:10:00Z
- **Completed:** 2026-08-09T07:26:00Z
- **Tasks:** 3
- **Files modified:** 4 (2 modified, 1 created, 1 extended)

## Accomplishments

- Storage-layer bootstrap in both entrypoints (sidepanel + standalone — the ONLY surfaces R-3 allows vault/IDB init on): `getInstallSecret()` first-run (D-02), `runMigrateOnRead(DEFAULT_MIGRATE_SANITIZERS)` (D-10), and `runMigrations` over the registered spec set (ChatHistoryDB/NotesDB/MemoryDB/WriteJournalDB at their current versions) with the ErrorStore IDB_MIGRATION_FAILED sink (D-12/D-14). Every step degrades gracefully — debugLog with canonical codes, never rejects the mount (Golden Rule 9).
- `FORBIDDEN_TOKENS` extended with idb/fflate/KeyVault/EncryptedStorage/fake-indexeddb — the content bundle can never include the vault/IDB/network stack (R-3 hard isolation boundary).
- Automated privacy gate `tests/core/storage/no-secrets-in-storage.test.ts` (4 cases): no plaintext secret / no secret-shaped pattern (sk-…, Bearer …, JSESSIONID=) anywhere in storage.local; installSecret + secrets never in storage.sync; chat/memory bodies live in IndexedDB only (never an np_* local key); journaled workspace writes persist entries with no secret-shaped step errors (D-16 redaction at the persist boundary). All driven through the REAL KeyVault/store/journal paths.
- `pnpm run verify:phase-2` exits 0 on the first run — the six-step chain (eslint + prettier + tsc + wxt build + vitest run + isolation) green; 42 test files / 261 tests across all phases; Phase 2 ends per Golden Rule 10.

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire storage-layer init into both entrypoints** - `186bd97` (feat)
2. **Task 2: Extend isolation tokens + add privacy test** - `e43eda3` (test)
3. **Task 3: Run verify:phase-2 green + DONE-when sweep** - (verification-only; gate green on first run, no fixes required)

**Plan metadata:** (final docs commit)

## Files Created/Modified

- `src/entrypoints/sidepanel/main.tsx` - Storage bootstrap (runStorageBootstrap + warmOpenIdbStore) fired before the workspace init chain; header updated
- `src/entrypoints/standalone/main.tsx` - Identical bootstrap wiring for the standalone surface
- `tests/isolation/check-content-bundle.mjs` - FORBIDDEN_TOKENS extended with 5 vault/IDB tokens; header token-set note updated
- `tests/core/storage/no-secrets-in-storage.test.ts` - The 4-case automated privacy gate (created)

## Decisions Made

1. **Warm-open before runMigrations** — running the migrator over an empty migration list on a fresh install would create an EMPTY version-1 DB, after which the canonical openers' non-throwing upgrades would never re-fire (same version) and the stores would be broken. Each real store is warm-opened through its canonical openXxxDB (single source of truth for schema), then the migrator runs over the registered spec — today a no-op version check, later the D-14 execution hook for real migrations (e.g. Phase 5a NotesDB v4).
2. **Namespace imports for grep-stable fixtures** — the acceptance criteria require `grep -c runMigrateOnRead/runMigrations == 1` per entrypoint; named imports would count 2 (import line + call line). `import * as Setting / Migrator` keeps each literal on exactly one line with full type safety.
3. **WriteJournalDB version as literal 1** (its DB_VERSION constant is module-private) — all four stores are at v1 today; exporting the constant would churn a file outside this plan's scope.
4. **getInstallSecret catch uses PROVIDER_KEY_UNREADABLE** (plan-mandated): vault-unavailable-at-mount is the same shared unreadable state the Phase-3 provider layer routes on.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The verify:phase-2 chain exited 0 on the first attempt (no fixes needed in Task 3); the pre-existing `.planning/config.json` modification (orchestrator-added `_auto_chain_active` flag) was left untouched.

## DONE-when Evidence (spec §18 lines 2597-2603)

| §18 DONE-when criterion | Evidence (all green) |
|---|---|
| WriteJournal recovery test passes | tests/core/storage/WriteJournal.test.ts + WorkspacePersistence.test.ts (replay-once, workspace-scoped) |
| API key encryption round-trip passes | EncryptedStorage.test.ts + KeyVault.test.ts |
| No message body appears in chrome.storage.local | no-secrets-in-storage.test.ts case 3 (machine-checked) |
| Migration from v1 → v2 fixture passes | IndexedDBMigrator.test.ts (add-store + add-index + data-carry + throws→degraded) |
| Workspace state persists across page reload and cross-surface handoff | WorkspacePersistence.test.ts cases 1/4 |

Specless-probe prohibitions: A-22/A-23/A-24 asserted by this plan's privacy test; A-25 by 02-03 cross-install tests; A-26 by 02-02 redaction tests; A-27 by 02-06 tests; A-28 by 02-04 tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 2 is complete** — all 11 plans shipped, verify:phase-2 green, all five STORAGE-01..05 requirements evidenced.
- Ready for Phase 3 (Cost-Effective AI Runtime): the provider layer consumes the vault's PROVIDER_KEY_UNREADABLE routing, and the entrypoint bootstrap extends naturally when Phase 5a registers real IDB migrations.
- The degraded-mode banner state (getDegradedDbs + STR.storage.degradedBanner) ships now for the Phase-7 Diagnostics/UI.

---
*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-09*

## Self-Check: PASSED

- Created files verified on disk: `src/entrypoints/sidepanel/main.tsx` + `src/entrypoints/standalone/main.tsx` (bootstrap wired, greps at 1), `tests/isolation/check-content-bundle.mjs` (5 tokens added), `tests/core/storage/no-secrets-in-storage.test.ts` (4 cases), `02-11-SUMMARY.md`
- Commits verified in git log: `186bd97` (Task 1 feat), `e43eda3` (Task 2 test), `c80344f` (docs)
- Full verification: `pnpm run verify:phase-2` exit 0 (eslint + prettier + tsc + wxt build + vitest run 42 files / 261 tests + isolation check), focused privacy test 4/4 green, §18 five required test files 35/35 green, Golden Rule 9 empty-catch sweep clean
