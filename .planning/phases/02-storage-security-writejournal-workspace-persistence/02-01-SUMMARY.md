---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 01
subsystem: testing
tags: [vitest, fake-indexeddb, idb, chrome.storage.session, test-harness, fake-indexeddb-harness]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace-handoff
    provides: "tests/setup.ts chrome.storage.local + sync mocks, vitest jsdom config, 166-test verify:phase-1 baseline"
provides:
  - "Phase-2 test harness: global indexedDB (fake-indexeddb/auto) with __resetIndexedDB() per-test factory swap"
  - "Phase-2 test harness: chrome.storage.session mock (Map-backed, __chromeStorageSession + __chromeSessionMap)"
  - "Smoke test (3 cases) locking in the harness shape so future regressions surface at the smoke boundary"
affects:
  - 02-02 (EncryptedStorage tests in tests/core/security/)
  - 02-03 (WriteJournal tests in tests/core/utils/)
  - 02-04 (WriteJournalDB / IndexedDBMigrator tests in tests/core/storage/)
  - 02-05 (ErrorStore / journaled-adapter tests in tests/core/storage/)
  - 02-06 (WorkspaceElection CAS/heartbeat tests in tests/core/workspace/)
  - 02-07 (WorkspacePersistence persist config + boot wiring in tests/core/workspace/)

# Actuals (#2632)
actuals:
  tokens: 2900       # ~11.6k chars / 4 across setup.ts delta (2184) + smoke test (3139) + package.json/pnpm-lock deltas (~500) + SUMMARY (~3500)
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added:
    - idb@^8.0.3 (production dep — IndexedDB wrapper, used by WriteJournalDB / ErrorStore / IndexedDBMigrator)
    - fake-indexeddb@^6.2.5 (devDep — jsdom-compatible IDB factory + IDBFactory reset helper)
  patterns:
    - "fake-indexeddb/auto import at top of tests/setup.ts installs a global indexedDB without per-file boilerplate"
    - "__resetIndexedDB() helper swaps in `new IDBFactory()` between tests so DBs do not leak across cases"
    - "Session mock mirrors the existing local/sync mock shape (Map-backed vi.fn get/set/remove/clear) but uses an independent sessionMap"
    - "Session mock is wired into chrome.storage alongside the existing local/sync entries; the local/sync map semantics are byte-for-byte unchanged (append-only extension per plan prohibition)"

key-files:
  created:
    - tests/core/storage/harness-smoke.test.ts — 3-case smoke test (IDB round-trip, session round-trip, factory reset isolation)
  modified:
    - package.json — +idb@^8.0.3 (dependencies), +fake-indexeddb@^6.2.5 (devDependencies)
    - pnpm-lock.yaml — locked the two new packages
    - tests/setup.ts — +fake-indexeddb/auto + IDBFactory import, +__resetIndexedDB helper, +chromeStorageSession mock with sessionMap, session wired into chrome.storage

key-decisions:
  - "Session mock uses an independent sessionMap (not the shared chromeStorage Map the local/sync mocks both reuse) — matches production semantics where session is a separate quota area from local/sync."
  - "Smoke test asserts __resetIndexedDB replaces the factory by reference inequality, not deep-equality, so a future regression that swaps to the same instance fails the test immediately."
  - "tests/core/security/ and tests/core/utils/ already existed on disk (created by Phase-1); no mkdir required."

patterns-established:
  - "Per-test IndexedDB isolation: tests that touch idb call `(globalThis as any).__resetIndexedDB()` in beforeEach so prior cases' DBs do not persist."
  - "Session-area introspection: tests can inspect the raw session map via `(globalThis as any).__chromeSessionMap` (Map<string, string>) for fast reset/clear without going through the vi.fn wrapper."

requirements-completed: [REQ-R03, REQ-R07]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Phase-2 packages installed (idb@^8 production, fake-indexeddb@^6 devDep) at versions matching STATE.md VAI-04"
    requirement: REQ-R03
    verification:
      - kind: automated_ui
        ref: "pnpm list idb fake-indexeddb -> idb@8.0.3, fake-indexeddb@6.2.5"
        status: pass
      - kind: automated_ui
        ref: "pnpm lint (tsc --noEmit) -> exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "tests/setup.ts provides global indexedDB with per-test reset (__resetIndexedDB) and a Map-backed chrome.storage.session mock (__chromeStorageSession, __chromeSessionMap)"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: "tests/core/storage/harness-smoke.test.ts > exposes a working global indexedDB (fake-indexeddb) with idb round-trip"
        status: pass
      - kind: unit
        ref: "tests/core/storage/harness-smoke.test.ts > round-trips values through chrome.storage.session and tracks them in __chromeSessionMap"
        status: pass
      - kind: unit
        ref: "tests/core/storage/harness-smoke.test.ts > __resetIndexedDB replaces the global factory with a fresh instance"
        status: pass
    human_judgment: false
  - id: D3
    description: "Phase-1 166-test baseline regression-free after the harness additions"
    requirement: REQ-R07
    verification:
      - kind: integration
        ref: "pnpm run verify:phase-1 -> 169/169 pass (166 pre-existing + 3 new smoke), tsc --noEmit clean, verify-no-tailwind.sh clean"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-08-24
status: complete
---

# Phase 2 Plan 1: Wave-0 test harness (fake-indexeddb + session mock) Summary

**Phase-2 test-harness bootstrap: idb + fake-indexeddb packages installed, tests/setup.ts extended with global `indexedDB` + `chrome.storage.session` mock, 3-case smoke test proves the harness end-to-end with zero Phase-1 regression.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-08-24T02:49:58Z
- **Completed:** 2026-08-24T02:53:16Z
- **Tasks:** 2
- **Files modified:** 3 (`package.json`, `pnpm-lock.yaml`, `tests/setup.ts`); created 1 (`tests/core/storage/harness-smoke.test.ts`)

## Accomplishments

- Installed `idb@^8.0.3` (production dependency) and `fake-indexeddb@^6.2.5` (devDependency) at the versions RESEARCH.md verified against npm registry 2026-08-23 (STATE.md watch item VAI-04).
- `tests/setup.ts` now imports `fake-indexeddb/auto` so every test file has a global `indexedDB` from first import; the existing local/sync/BroadcastChannel mocks are byte-for-byte unchanged (plan prohibition honored).
- Exposed `(globalThis as any).__resetIndexedDB()` — swaps in `new IDBFactory()` so tests get a fresh factory per case (DBs do not leak across tests).
- Added a Map-backed `chrome.storage.session` mock mirroring the `chromeStorageLocal` shape, with an independent `sessionMap` backing; exposed `__chromeStorageSession` + `__chromeSessionMap` for test inspection; wired into the existing `chrome.storage` assignment alongside the unchanged `local` and `sync` entries.
- Created `tests/core/storage/harness-smoke.test.ts` with three cases: (1) `indexedDB` is defined and `openDB`/`put`/`get` round-trips, (2) `chrome.storage.session.set`/`get` round-trips and `__chromeSessionMap` tracks the key, (3) `__resetIndexedDB` produces a non-reference-equal factory.
- `pnpm run verify:phase-1` stays green: 169/169 tests pass (166 pre-existing Phase-1 tests + 3 new smoke tests), `tsc --noEmit` clean, `verify-no-tailwind.sh` clean. The pre-existing jsdom `getComputedStyle` warnings from antd's `useScrollLocker` in the OnboardingModal tests are unchanged (Phase-1 baseline noise; out of scope per Rule 1).

## Task Commits

Each task was committed atomically:

1. **Task 1: Install Phase-2 packages and extend tests/setup.ts with IndexedDB + chrome.storage.session harness** - `657388c` (chore)
2. **Task 2: Prove the harness end-to-end with a smoke test and run the Phase-1 regression gate** - `ea0be19` (test)

## Files Created/Modified

- `package.json` — Added `idb@^8.0.3` to dependencies, `fake-indexeddb@^6.2.5` to devDependencies
- `pnpm-lock.yaml` — Locked the two new packages (idb 8.0.3, fake-indexeddb 6.2.5)
- `tests/setup.ts` — Top-of-file `import 'fake-indexeddb/auto';` + `import { IDBFactory } from 'fake-indexeddb';`; `__resetIndexedDB()` global helper; `sessionMap` + `chromeStorageSession` mock mirroring the local mock; `__chromeStorageSession` + `__chromeSessionMap` exposed; `session` wired into the existing `chrome.storage` assignment
- `tests/core/storage/harness-smoke.test.ts` — 3-case smoke test locking in the harness shape

## Decisions Made

- **Independent sessionMap for the session mock.** The existing local/sync mocks reuse a single `chromeStorage` Map (both write to the same backing store); the new session mock gets its own `sessionMap` because session is a distinct quota area in production (chrome.storage.session is cleared on tab close + browser restart, with its own ~10 MB cap). Sharing a map would let a test that clears local storage also wipe session state, hiding bugs.
- **Smoke test asserts reference inequality on `__resetIndexedDB()`.** Using `not.toBe(before)` rather than `not.toEqual(before)` catches the most likely regression (helper accidentally returns the same factory instance) with the cheapest possible assertion.
- **No mkdir needed.** `tests/core/security/` and `tests/core/utils/` already exist (created during Phase-1 scaffold work). Plan step 4 was a no-op.

## Deviations from Plan

None — plan executed exactly as written. All five Task-1 acceptance criteria pass on the first run; all two Task-2 acceptance criteria pass on the first run.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- The Phase-2 test harness is locked in. Subsequent Phase-2 plans (02-02 through 02-07) can rely on global `indexedDB` (via `import { openDB } from 'idb'`), `chrome.storage.session`, and the `__resetIndexedDB()` + `__chromeSessionMap` helpers without any further harness work.
- The smoke test (`harness-smoke.test.ts`) acts as a regression sentinel: any future change that breaks the harness fails fast with a clear three-case diagnostic before cascading into the plan-specific tests.
- Plan 02-02 (EncryptedStorage) is the next unblocked plan in the wave and can proceed immediately.

## Self-Check: PASSED

All SUMMARY.md claims verified against disk:

- `tests/setup.ts` — present; contains `import 'fake-indexeddb/auto'` (line 2), `__resetIndexedDB` helper (lines 9-11), `__chromeStorageSession` (line 194), `__chromeSessionMap` (line 195), `session: chromeStorageSession` wired into chrome.storage (line 203).
- `tests/core/storage/harness-smoke.test.ts` — present; 3 cases pass.
- `tests/core/security/` and `tests/core/utils/` — both directories present.
- `package.json` — has `idb@^8.0.3` (dependencies) and `fake-indexeddb@^6.2.5` (devDependencies).
- `pnpm list idb fake-indexeddb` shows idb@8.0.3, fake-indexeddb@6.2.5.
- `pnpm lint` exits 0.
- `pnpm run verify:phase-1` — 169/169 tests pass (166 pre-existing + 3 new smoke), tsc clean, tailwind gate clean.
- Commits `657388c` (Task 1, chore) and `ea0be19` (Task 2, test) both present in `git log`.

---
*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-24*
