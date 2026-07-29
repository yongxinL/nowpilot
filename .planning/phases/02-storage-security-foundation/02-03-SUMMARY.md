---
phase: 02-storage-security-foundation
plan: 03
subsystem: storage
tags: chrome-storage, session-storage, zustand, persist, storage-adapter, session-store, workspace-store

requires:
  - phase: 02-storage-security-foundation
    plan: 01
    provides: CryptoService, WriteJournal, MigrationRunner
  - phase: 02-storage-security-foundation
    plan: 02
    provides: ApiKeyStore, MessageStore, NotesStore, DiagnosticsStore skeletons, chrome.storage.session mock
  - phase: 01-project-scaffold-runtime-foundation
    provides: WorkspaceStore, ThemeStore, chromeStorageAdapter, tests/setup.ts, BroadcastChannel mock

provides:
  - chromeStorageAdapter relocated to src/core/storage/ (canonical location for all future stores)
  - sessionStorageAdapter with chrome.storage.session + sessionStorage fallback
  - SessionStore for session tokens in chrome.storage.session only
  - WorkspaceStore migrated from localStorage to chrome.storage.local via chromeStorageAdapter
  - STORAGE-02 topology verified: session tokens in session, workspace in local

affects:
  - 02-storage-security-foundation (Plan 04 — remaining stores verify topology)
  - 03-ai-pipeline-foundation (Session tokens, workspace state consumers)
  - All future plans importing chromeStorageAdapter from canonical path

tech-stack:
  added: []
  patterns:
    - "Zustand persist with custom StateStorage adapter (chrome.storage.local / chrome.storage.session)"
    - "Domain-specific stores with partialize for serializable state only"
    - "Session vs. local storage isolation per STORAGE-02"

key-files:
  created:
    - src/core/storage/chromeStorageAdapter.ts (relocated)
    - src/core/storage/sessionStorageAdapter.ts
    - src/core/storage/SessionStore.ts
    - tests/core/storage/SessionStore.test.ts
    - tests/core/workspace/WorkspacePersistence.test.ts
  modified:
    - src/core/theme/ThemeStore.ts
    - tests/core/theme/ThemeStore.test.ts
    - src/core/workspace/WorkspaceStore.ts
    - tests/core/workspace/WorkspaceStore.test.ts
    - src/core/storage/ApiKeyStore.ts
    - src/store/useExtensionStore.ts

key-decisions:
  - "sessionStorageAdapter uses sessionStorage (not localStorage) as fallback for non-Chrome environments per D-04"
  - "SessionStore partialize only persists tokens — action methods excluded from serialized state"
  - "WorkspaceStore migration adds storage adapter with no behavioral changes to actions or state shape"

requirements-completed:
  - STORAGE-02

coverage:
  - id: D1
    description: "chromeStorageAdapter relocated from src/core/theme/ to src/core/storage/ with no code changes"
    requirement: STORAGE-02
    verification:
      - kind: unit
        ref: tests/core/theme/ThemeStore.test.ts#chromeStorageAdapter column
        status: pass
    human_judgment: false
  - id: D2
    description: "sessionStorageAdapter created with chrome.storage.session + sessionStorage fallback"
    requirement: STORAGE-02
    verification:
      - kind: unit
        ref: tests/core/storage/SessionStore.test.ts#setToken column
        status: pass
    human_judgment: false
  - id: D3
    description: "SessionStore persists tokens to chrome.storage.session only (verified by mock inspection)"
    requirement: STORAGE-02
    verification:
      - kind: unit
        ref: tests/core/storage/SessionStore.test.ts#storage isolation
        status: pass
    human_judgment: false
  - id: D4
    description: "WorkspaceStore migrated from default localStorage to chrome.storage.local via chromeStorageAdapter"
    requirement: STORAGE-02
    verification:
      - kind: unit
        ref: tests/core/workspace/WorkspaceStore.test.ts#persistence via chromeStorageAdapter
        status: pass
    human_judgment: false
  - id: D5
    description: "WorkspaceStore state survives simulated page reload (persistence + rehydration)"
    requirement: STORAGE-02
    verification:
      - kind: unit
        ref: tests/core/workspace/WorkspacePersistence.test.ts
        status: pass
    human_judgment: false

duration: 2 min
completed: 2026-07-29
status: complete
---

# Phase 02 Plan 03: Storage Adapters & SessionStore Summary

**Relocated chromeStorageAdapter, created sessionStorageAdapter for chrome.storage.session, implemented SessionStore, and migrated WorkspaceStore from localStorage to chrome.storage.local — STORAGE-02 topology verified**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-29T22:22:39+10:00
- **Completed:** 2026-07-29T22:24:35+10:00
- **Tasks:** 2 (with TDD: RED + GREEN + REFACTOR)
- **Files modified:** 12

## Accomplishments

- Relocated chromeStorageAdapter from `src/core/theme/` to `src/core/storage/` with no code changes — canonical location for all future stores
- Created sessionStorageAdapter with `chrome.storage.session` + `sessionStorage` fallback (never localStorage)
- Implemented SessionStore (Zustand + persist + immer) persisting tokens to `chrome.storage.session` only via `np_session` key
- Migrated WorkspaceStore from default localStorage to `chrome.storage.local` via chromeStorageAdapter — no behavioral changes to store API
- Added STORAGE-02 topology verification: session tokens ONLY in `chrome.storage.session`, workspace state in `chrome.storage.local`
- Added cross-reload workspace persistence test (simulated page reload via rehydration)
- Fixed stale chromeStorageAdapter import paths in ApiKeyStore and useExtensionStore

## Task Commits

Each task was committed atomically:

1. **Task 1: Relocate chromeStorageAdapter, create sessionStorageAdapter, update ThemeStore import** — `e620f8a` (feat)
2. **Task 2 RED: Add failing test for SessionStore and WorkspaceStore migration** — `3d4bfe1` (test)
3. **Task 2 GREEN: Implement SessionStore and migrate WorkspaceStore** — `77d88ac` (feat)
4. **Task 2 REFACTOR: Update useExtensionStore import path** — `3ff63a7` (fix)

## Files Created/Modified

- `src/core/storage/chromeStorageAdapter.ts` — Relocated unchanged from `src/core/theme/`
- `src/core/storage/sessionStorageAdapter.ts` — New chrome.storage.session adapter with sessionStorage fallback
- `src/core/storage/SessionStore.ts` — New Zustand store for session tokens (chrome.storage.session only)
- `src/core/theme/ThemeStore.ts` — Import path updated to `../storage/chromeStorageAdapter`
- `src/core/workspace/WorkspaceStore.ts` — Added createJSONStorage import, chromeStorageAdapter for chrome.storage.local persistence
- `src/core/storage/ApiKeyStore.ts` — Import path fixed from `'../theme/chromeStorageAdapter'` to `'./chromeStorageAdapter'`
- `src/store/useExtensionStore.ts` — Import path fixed from `'../core/theme/chromeStorageAdapter'` to `'../core/storage/chromeStorageAdapter'`
- `tests/core/theme/ThemeStore.test.ts` — Import path updated
- `tests/core/storage/SessionStore.test.ts` — New: session lifecycle, storage isolation tests
- `tests/core/workspace/WorkspaceStore.test.ts` — Added persistence via chromeStorageAdapter assertions
- `tests/core/workspace/WorkspacePersistence.test.ts` — New: cross-reload workspace state verification

## Decisions Made

- **sessionStorageAdapter fallback:** Uses `sessionStorage` (not `localStorage`) as fallback for non-Chrome environments — consistent with D-04's requirement that session data is never persisted to disk
- **SessionStore partialize:** Only `tokens` are persisted; action methods (`setToken`, `getToken`, `clearTokens`) are excluded from serialized state
- **WorkspaceStore migration:** Added `storage:` option to persist config with no other changes — preserves backward compatibility with existing consumers

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed stale ApiKeyStore chromeStorageAdapter import path**
- **Found during:** Task 2 GREEN (after checking for stale imports)
- **Issue:** ApiKeyStore imported chromeStorageAdapter from `'../theme/chromeStorageAdapter'` — broken after relocation to `src/core/storage/`
- **Fix:** Changed import to `'./chromeStorageAdapter'`
- **Files modified:** `src/core/storage/ApiKeyStore.ts`
- **Verification:** All 5 ApiKeyStore tests pass
- **Committed in:** `77d88ac` (Task 2 GREEN commit)

**2. [Rule 3 - Blocking] Fixed stale useExtensionStore chromeStorageAdapter import path**
- **Found during:** REFACTOR phase (grep sweep for stale imports)
- **Issue:** `src/store/useExtensionStore.ts` imported chromeStorageAdapter from `'../core/theme/chromeStorageAdapter'` — broken after relocation
- **Fix:** Changed import to `'../core/storage/chromeStorageAdapter'`
- **Files modified:** `src/store/useExtensionStore.ts`
- **Verification:** All 40 related tests pass
- **Committed in:** `3ff63a7` (Task 2 REFACTOR commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 3 — blocking)
**Impact on plan:** Both fixes were necessary to resolve import paths broken by the chromeStorageAdapter relocation. No scope creep.

## Issues Encountered

None — all tests pass after auto-fixes.

## Known Stubs

None — SessionStore and WorkspacePersistence are fully wired with functional tests.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Storage adapter layer complete:** chromeStorageAdapter in canonical path, sessionStorageAdapter ready for session tokens
- **SessionStore complete:** Ready for Phase 3 session token management
- **WorkspaceStore migrated:** Ready for cross-surface workspace sync in downstream phases
- **STORAGE-02 satisfied:** Session tokens in chrome.storage.session, workspace in chrome.storage.local
- **Ready for Plan 04:** Persistent storage stores (remaining domain stores)

---
## TDD Gate Compliance

| Gate | Commit | Status |
|------|--------|--------|
| RED (test) | `3d4bfe1` — add failing test for SessionStore and WorkspaceStore migration | ✅ PASS |
| GREEN (feat) | `77d88ac` — implement SessionStore and migrate WorkspaceStore to chrome.storage.local | ✅ PASS |
| REFACTOR (fix) | `3ff63a7` — update useExtensionStore import path after chromeStorageAdapter relocation | ✅ PASS |

**Sequencing:** RED → GREEN → REFACTOR in correct order. All gates compliant.

## Self-Check: PASSED

- ✅ All 9 source/test files exist on disk
- ✅ chromeStorageAdapter properly deleted from old location
- ✅ All 4 plan commits found in git history
- ✅ All 40 tests pass (5 test files)
- ✅ No untracked source files (git status clean for `src/` and `tests/`)

---
*Phase: 02-storage-security-foundation*
*Completed: 2026-07-29*
