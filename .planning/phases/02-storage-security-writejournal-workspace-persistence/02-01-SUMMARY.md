---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 01
subsystem: testing
tags: [indexeddb, idb, fake-indexeddb, chrome-storage, manifest, mv3, wxt, vitest, wave-0]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: chrome.storage local/sync Map-backed mocks, the fail-never-skip manifest gate, the verify:phase-1 self-derived path preflight, the 300 ms-debounced chromeStorageAdapter
provides:
  - idb ^8.0.3 (dependency) and fake-indexeddb ^6.2.5 (devDependency) installed, resolvable, gate-scanned
  - tests/setup.ts Wave 0 seams — fake-indexeddb/auto registration + __resetIndexedDB(), Map-backed chrome.storage.session + __chromeStorageSessionMap, and one shared chrome.storage.onChanged dispatcher (local/session set/remove/clear emit { oldValue, newValue })
  - wxt.config.ts declares unlimitedStorage (the single authorised Phase 2 permission) with its gate constant moved in the same change
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07, 02-08, 02-09, 02-10, 02-11, 02-12, 02-13, phase-08-memory, phase-09-notes]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 3905
  tasks: 3
  commits: 3
plan_head_before: 4d238b2c568bdd4ec768368fd14a7935125d80a2

tech-stack:
  added:
    - "idb ^8.0.3 (spec-pinned §7.5; typed openDB/IDBPDatabase/IDBPTransaction)"
    - "fake-indexeddb ^6.2.5 (devDependency; deterministic in-memory IndexedDB double)"
  patterns:
    - "Map-backed chrome.storage area with a matching __chromeStorage*Map seam, now including session"
    - "One shared chrome.storage.onChanged dispatcher: areas emit after the map update, synchronously and fail-safe"
    - "Fresh IDBFactory per test via __resetIndexedDB() — the double keeps state per instance (RESEARCH Pitfall 8)"
    - "Manifest permission and its gate constant move in one change, with a re-build before the gate (RESEARCH Pitfall 9)"

key-files:
  created: []
  modified:
    - package.json
    - pnpm-lock.yaml
    - tests/setup.ts
    - wxt.config.ts
    - tests/isolation/generated-manifest.test.ts
    - tests/core/theme/ThemeSync.test.tsx
    - tests/core/onboarding/onboardingStateStore.test.ts

key-decisions:
  - "The shared onChanged emitter is write-triggered: local/session set/remove/clear emit { oldValue, newValue } (clear emits one change per removed key) after the map update; the emitter is synchronous and a throwing listener never stops the rest (T-02-05)."
  - "The two Phase 1 suites that synthesise change events (ThemeSync, onboardingStateStore) install their own dispatcher explicitly rather than being silently shadowed by the new global one — otherwise 5 theme tests fail and 2 onboarding propagation assertions become vacuous (see Deviations)."
  - "unlimitedStorage is the ONE permission Phase 2 adds (§16.4 / ADR-STACK-02); the D-19a prohibition comment now names it while keeping the 'no other permission before its owning phase' rule; CSP is untouched (connect-src 'none', D2-26)."
  - "The behavioural seam proof (three areas, areaName tagging, clear-per-key emission, throwing-listener isolation, fresh IDBFactory) was an executed throwaway probe deleted after the run, per the RESEARCH probe convention; the committed evidence is the four-suite regression and the Phase 2 integration suites that consume the dispatcher."

patterns-established:
  - "Wave 0 test infrastructure is additive: every new global seam gets a __-prefixed helper, and every existing stub keeps its exact shape."
  - "Cross-surface storage propagation in one process is observable through one dispatcher object that both simulated surfaces subscribe to."

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "idb ^8 and fake-indexeddb ^6 are declared, installed, resolvable from node_modules, and re-scanned by the banned-imports gate"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "node -e dependency assertion (idb=^8.0.3 fake-indexeddb=^6.2.5 resolved=true)"
        status: pass
      - kind: unit
        ref: "tests/isolation/banned-imports.test.ts (4 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Wave 0 test seams in tests/setup.ts: IndexedDB double + reset, session storage area, one shared onChanged dispatcher; all Phase 1 suites stay green"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "npx vitest run tests/core/theme tests/core/onboarding tests/core/storage tests/core/store (109 passed)"
        status: pass
      - kind: integration
        ref: "npx vitest run tests/core tests/background tests/components tests/services (493 passed)"
        status: pass
      - kind: other
        ref: "throwaway probe tests/__probe__/seams.probe.test.ts (5 passed, deleted after the run): three areas, local/session areaName, clear-per-key, throwing-listener isolation, fresh IDBFactory"
        status: pass
    human_judgment: true
    rationale: "The seam's behavioural proof was a throwaway probe deleted by convention; the committed evidence is regression coverage only. Cross-surface propagation through the shared dispatcher is proven by the Phase 2 integration suites (02-11/02-12), so a verifier may re-derive it with a one-off probe."
  - id: D3
    description: "Built manifest declares exactly the authorised Phase 2 permission set including unlimitedStorage, CSP byte-identical, gate asserts the set, verify:phase-1 green"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "npx vitest run tests/isolation/generated-manifest.test.ts (10 passed, after pnpm run build:ext)"
        status: pass
      - kind: integration
        ref: "pnpm run verify:phase-1 (41 files / 569 tests + tailwind gate)"
        status: pass
      - kind: other
        ref: "node -e built-manifest assertion: permissions [sidePanel,storage,tabs,unlimitedStorage], connect-src only 'none', no content_scripts"
        status: pass
    human_judgment: false

duration: 7 min
completed: 2026-09-24
status: complete
---

# Phase 2 Plan 01: Storage/Security Wave 0 Foundation Summary

**idb ^8 + fake-indexeddb ^6 installed, the four Wave 0 test seams (IndexedDB double with per-test reset, session storage area, one shared `chrome.storage.onChanged` dispatcher) live in `tests/setup.ts`, and the built manifest now declares `unlimitedStorage` with its gate constant moved in the same change — `verify:phase-1` still green at 41 files / 569 tests.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-09-23T22:41:11Z
- **Completed:** 2026-09-23T22:48:08Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- `idb ^8.0.3` (dependency) and `fake-indexeddb ^6.2.5` (devDependency) installed; both resolve from `node_modules`; the banned-imports gate (which scans `package.json`) still passes and no other dependency moved.
- `tests/setup.ts` carries the four Wave 0 seams every Phase 2 implementation task depends on: `fake-indexeddb/auto` registration plus `__resetIndexedDB()` (fresh `IDBFactory` per test), a Map-backed `chrome.storage.session` area exposed as `__chromeStorageSessionMap`, its assembly as the third storage area, and one shared `chrome.storage.onChanged` dispatcher whose local/session `set`/`remove`/`clear` emit `{ oldValue, newValue }` after the map update.
- The built manifest declares exactly `["sidePanel","storage","tabs","unlimitedStorage"]`, the CSP stays byte-identical at `connect-src 'none'`, `content_scripts`/`options_ui`/`options_page` remain absent, and the Phase 1 gate constant moved with the config so `verify:phase-1` does not break (RESEARCH Pitfall 9).
- No Phase 1 regression: `verify:phase-1` = 41 files / 569 tests + the tailwind gate, and the four declared regression suites plus `tests/core`/`background`/`components`/`services` all pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Install the pinned IndexedDB stack** — `6a34ab8f` (chore)
2. **Task 2: Add the Wave 0 test seams to `tests/setup.ts`** — `cd223d83` (test)
3. **Task 3: Move `unlimitedStorage` into the manifest and its gate in one change** — `d825e8e6` (feat)

**Plan metadata:** see the final `docs(02-01)` commit below

## Files Created/Modified

- `package.json` — `dependencies.idb` (`^8.0.3`), `devDependencies["fake-indexeddb"]` (`^6.2.5`); every other block byte-unchanged
- `pnpm-lock.yaml` — the two packages' lock entries (+17 lines)
- `tests/setup.ts` — the four Wave 0 seams (+124 lines): `fake-indexeddb/auto` + `__resetIndexedDB()`; `chrome.storage.session` + `__chromeStorageSessionMap`; shared `chrome.storage.onChanged` registry with `fireStorageChanged()`; emission added inside the local stub's `set`/`remove`/`clear`
- `wxt.config.ts` — `'unlimitedStorage'` after `'tabs'`; the D-19a prohibition comment rewritten to name it as the authorised Phase 2 addition and keep the no-other-permission rule true
- `tests/isolation/generated-manifest.test.ts` — `AUTHORISED_PERMISSIONS` gains `'unlimitedStorage'`; docstring and constant comments made truthful (Phase 1 set + Phase 2 addition)
- `tests/core/theme/ThemeSync.test.tsx` — installs its synthetic-event dispatcher explicitly (deviation 1)
- `tests/core/onboarding/onboardingStateStore.test.ts` — installs its synthetic-event dispatcher explicitly (deviation 1)

## Decisions Made

- **Write-triggered emission, fail-safe dispatch.** Local and session `set`/`remove` emit `{ [key]: { oldValue, newValue } }` after the map update and `clear` emits one change per removed key, with `areaName` `'local'` / `'session'`; the emitter iterates a copy and swallows listener throws so one bad listener cannot stop the rest (T-02-05 mitigation). Sync stays non-emitting (Phase 1 behaviour, and the theme path only reads sync).
- **`__resetIndexedDB()` is the per-test contract.** A fresh `IDBFactory` per test, called from `beforeEach` alongside the storage-map clear; suites close their handles in `afterEach`. This is what stops test-order dependence (RESEARCH Pitfall 8) and is now documented in the file header.
- **Manifest change is atomic with its gate.** Config, gate constant and the prohibition comment moved in one commit, with `pnpm run build:ext` re-run before the gate (the gate fails, never skips, without the artifact).
- **No placeholder for the deferred surfaces.** Nothing was added for Requester/RateLimiter or the later-phase permissions (D2-26, D-19a).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The new global `chrome.storage.onChanged` shadowed two Phase 1 suites' private dispatchers**
- **Found during:** Task 2 (Wave 0 seams) — the first run of the declared regression command failed 5 `tests/core/theme/ThemeSync.test.tsx` tests, and the onboarding suite's two propagation assertions silently became vacuous (its `emitStorageChange` helper reached nothing, while the test passed via the new auto-emission instead).
- **Issue:** both suites install their ad-hoc dispatcher only `if (!chrome.storage.onChanged)`; a globally installed dispatcher makes that guard false, so their synthetic `emitChange`/`emitStorageChange` events never reached the handlers under test. An over-broad global stub masking a real failure is exactly threat T-02-05.
- **Fix:** both suites now assign their dispatcher unconditionally (a 2-line change each, with a comment naming the shared dispatcher in `tests/setup.ts`), preserving their exact emit path and Phase 1 semantics; the new shared emitter is unchanged.
- **Files modified:** `tests/core/theme/ThemeSync.test.tsx`, `tests/core/onboarding/onboardingStateStore.test.ts`
- **Verification:** `npx vitest run tests/core/theme tests/core/onboarding tests/core/storage tests/core/store` → 109 passed; `npx vitest run tests/core tests/background tests/components tests/services` → 493 passed; `verify:phase-1` → 569 passed.
- **Committed in:** `cd223d83` (part of Task 2's commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug)
**Impact on plan:** The fix keeps the declared regression suites green and their assertions meaningful; it is the minimum change that satisfies both the "shared dispatcher" seam and the "Phase 1 suites keep passing" must-have. No production code touched.

## Issues Encountered

- The onboarding propagation suite now depends on which dispatcher it installs; the deviation above restores its explicit emit path. Phase 2's Suite B (02-12) is the committed consumer that proves the shared dispatcher's cross-surface propagation.
- Pre-existing untracked planning artifacts (`02-PATTERNS.md`, `COVERAGE.md`, `.planning/milestone.lock`, `.gsd/`) were left untouched — outside this plan's scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Every Phase 2 implementation task now has IndexedDB in the test environment, a session storage area for the election, and a manifest whose permission set is declared, built and gate-asserted.
- `02-02` (topology, migrator, ChatHistoryDB, WriteJournal) can proceed: `idb`/`fake-indexeddb` resolve, `__resetIndexedDB()` is the per-test contract, and `chrome.storage.session` exists for the later election work.
- Wave 0 items 1, 2 and the manifest item of `02-VALIDATION.md` § Wave 0 Requirements are complete; the remaining Wave 0 items (harness, new suites, `verify:phase-2` rewrite) belong to plans 02-11/02-13.

---
*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 7 modified files exist on disk: `package.json`, `pnpm-lock.yaml`, `tests/setup.ts`, `wxt.config.ts`, `tests/isolation/generated-manifest.test.ts`, `tests/core/theme/ThemeSync.test.tsx`, `tests/core/onboarding/onboardingStateStore.test.ts`.
- All 4 plan commits exist in history: `6a34ab8f` (Task 1), `cd223d83` (Task 2), `d825e8e6` (Task 3), `3d1545e9` (plan metadata).
- Measured commit count at SUMMARY write time (`git rev-list --count 4d238b2c..HEAD`): 3 task commits, base recorded as `plan_head_before`.
