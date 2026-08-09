---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 08
subsystem: storage
tags: [chrome-storage, sync-quota, local-shadow, debounce, theme-store, d-15, appr-03]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: 02-05 Setting.ts permission table (sync-area keys + serialized write mutex); 02-01 SYNC_QUOTA_EXCEEDED canonical code + quota-shadow fixture builder
provides:
  - Setting.ts D-15 sync-shadow machinery: settingWriteSync (sync-first + same-key local shadow fallback under SYNC_QUOTA_EXCEEDED, shadow deleted on sync success), settingReadSync (sync-first then local; shadow wins reads and re-attempts sync), per-key 100ms cosmetic debounce
  - COSMETIC_SYNC_KEYS + SYNC_KEYS_WITH_SHADOW (derived from the permission table)
  - ThemeStore rewire: np_theme/np_theme_pack persist through Setting.ts sync-first (spec §15.1 honored); onChanged propagates both sync and local areas
  - APPR-03 spec touch: sync is the CANONICAL/preferred store; local is a transient fallback shadow
affects: [02-11 verification wiring, phase verification, future sync-key consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Sync-first write with same-key local shadow fallback (D-15): try chrome.storage.sync.set → on ANY rejection (size or rate) debugLog SYNC_QUOTA_EXCEEDED + chrome.storage.local.set same key; sync success removes the shadow (never diverge)"
    - "Sync-first read with promote-and-delete: read sync, else local; a shadow wins the read AND re-attempts sync fire-and-forget; a successful sync write deletes the shadow (reconciliation loop closes)"
    - "Per-key trailing debounce (100ms, last value wins) for cosmetic sync writes — keeps bursts under the documented 120 writes/min sync cap; superseded calls settle immediately (dropped)"
    - "Derived sync-key set (SYNC_KEYS_WITH_SHADOW) from the permission table — new sync keys get the shadow treatment automatically"

key-files:
  created: []
  modified:
    - src/core/storage/Setting.ts
    - src/core/theme/ThemeStore.ts
    - tests/core/storage/Setting.test.ts
    - tests/core/theme/ThemeStore.test.ts
    - .planning/PRODUCT_SPEC_v0_1.md

key-decisions:
  - "Sync-shadow machinery ships as settingWriteSync/settingReadSync wrappers (delegating non-sync keys to the generic settingWrite/settingRead) rather than changing the generic paths — preserves 02-05 behavior/tests and keeps the debounce out of non-cosmetic writes"
  - "Shadow delete on sync success is an unconditional chrome.storage.local.remove (idempotent no-op when absent) — simplest guarantee that sync/local never diverge"
  - "Read-triggered re-attempt reuses settingWriteSync (debounced for cosmetic keys) so promote-and-delete shares one code path; an unreadable shadow (sanitize → null) is NOT promoted to sync (no garbage propagation)"
  - "ThemeStore onChanged gate flipped from local-only to a positive sync-or-local gate — the spec's 'area !== local' substring is gone and sync-area theme changes propagate"

requirements-completed: [STORAGE-02]

coverage:
  - id: D1
    description: "Setting.ts sync-shadow write path — a failed chrome.storage.sync write (quota OR rate, both mocked as rejections per A-17) falls back to a same-key chrome.storage.local shadow and logs SYNC_QUOTA_EXCEEDED; the write never throws"
    requirement: STORAGE-02
    verification:
      - kind: unit
        ref: "tests/core/storage/Setting.test.ts#sync write failure falls back to a same-key local shadow and logs SYNC_QUOTA_EXCEEDED"
        status: pass
    human_judgment: false
  - id: D2
    description: "Setting.ts sync-first read with reconciliation — reads check sync first then local; a local shadow wins the read and triggers a re-attempt to write sync; a successful sync write deletes the shadow so sync/local never silently diverge"
    requirement: STORAGE-02
    verification:
      - kind: unit
        ref: "tests/core/storage/Setting.test.ts#a local shadow wins the read and triggers a re-attempt to write sync"
        status: pass
      - kind: unit
        ref: "tests/core/storage/Setting.test.ts#a successful sync write deletes any local shadow (reconciliation)"
        status: pass
      - kind: unit
        ref: "tests/core/storage/Setting.test.ts#a successful sync write never creates a local shadow (happy path)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cosmetic write debounce — rapid theme/pack/language toggles coalesce into a single trailing sync write (last value wins) so bursts stay under the 120 writes/min sync cap"
    requirement: STORAGE-02
    verification:
      - kind: unit
        ref: "tests/core/storage/Setting.test.ts#debounces cosmetic writes — a rapid burst lands only the last value in sync"
        status: pass
    human_judgment: false
  - id: D4
    description: "ThemeStore rewire — np_theme/np_theme_pack persist through Setting.ts sync-first (spec §15.1); init hydrates via settingReadSync keeping the isValidMode/isThemePackId read-validate idiom; setMode/setPack write via settingWriteSync; onChanged propagates both sync and local areas; no direct chrome.storage.local.set remains"
    requirement: STORAGE-02
    verification:
      - kind: unit
        ref: "tests/core/theme/ThemeStore.test.ts#setMode(light) writes sync np_theme via Setting (D-15) and updates state"
        status: pass
      - kind: unit
        ref: "tests/core/theme/ThemeStore.test.ts#setPack(liquid-glass) writes sync np_theme_pack via Setting (D-15) and updates state"
        status: pass
      - kind: unit
        ref: "tests/core/theme/ThemeStore.test.ts#init with np_theme=dark resolves dark"
        status: pass
      - kind: unit
        ref: "tests/core/theme/ThemeStore.test.ts#chrome.storage.onChanged foreign write updates state"
        status: pass
    human_judgment: false
  - id: D5
    description: "APPR-03 spec touch — §17.1a single-source invariant reworded from 'sync is the ONLY store' to 'sync is the CANONICAL/preferred store; local is a transient fallback shadow reconciled back to sync when possible'"
    verification:
      - kind: other
        ref: "grep -c \"CANONICAL/preferred\" .planning/PRODUCT_SPEC_v0_1.md → 1"
        status: pass
    human_judgment: false

# Metrics
duration: 14min
completed: 2026-08-09
status: complete
---

# Phase 2 Plan 8: Sync-Shadow Fallback + ThemeStore Rewire Summary

**chrome.storage.sync quota/rate fallback (D-15) wired into Setting.ts — sync-first writes with a same-key local shadow under SYNC_QUOTA_EXCEEDED, shadow-wins reads with promote-and-delete reconciliation, per-key cosmetic debounce — and ThemeStore rewired to persist np_theme/np_theme_pack through Setting.ts so spec §15.1's sync placement is honored by a live consumer**

## Performance

- **Duration:** 14 min
- **Started:** 2026-08-09T06:26:30Z
- **Completed:** 2026-08-09T06:40:20Z
- **Tasks:** 3 (Task 1 TDD: RED + GREEN)
- **Files modified:** 5 (0 created)

## Accomplishments

- **Setting.ts sync-shadow machinery (D-15, T-2-08-01/02/03):** `settingWriteSync` attempts chrome.storage.sync first; ANY rejection (size or rate — both surface as rejected promises per RESEARCH Pattern 5) is caught under the single SYNC_QUOTA_EXCEEDED code and the SAME key is written to chrome.storage.local as a transient shadow; a successful sync write removes the shadow. `settingReadSync` reads sync first, then local; a shadow wins the read and re-attempts sync fire-and-forget; the promote-and-delete loop closes so sync/local never silently diverge. Non-sync keys delegate to the generic permission-checked paths (02-05 behavior unchanged).
- **`COSMETIC_SYNC_KEYS` + `SYNC_KEYS_WITH_SHADOW`:** the shadow set is DERIVED from the permission table (any key with area 'sync') — future sync-area keys inherit the machinery automatically.
- **Per-key cosmetic debounce (100ms, last value wins):** rapid theme toggles coalesce into a single trailing sync write (test-proven: a light→dark burst lands exactly one write), keeping bursts under the documented 120 writes/min sync cap (RESEARCH A1 — local rate undocumented, 100ms is agent discretion).
- **ThemeStore rewire (D-15 live consumer, RESEARCH Pattern 5 landmine closed):** init hydrates np_theme/np_theme_pack via `settingReadSync` keeping the isValidMode/isThemePackId read-validate idiom (T-1-10); setMode/setPack write via `settingWriteSync` with the write still never throwing to the UI (try/catch + THEME_WRITE shape); the onChanged handler now propagates changes from BOTH areas (sync = canonical, local = shadow) with the same validation — the old local-only `area !== 'local'` gate is gone (0 direct `chrome.storage.local.set` remains in the file).
- **APPR-03 spec touch:** the §17.1a single-source invariant now reads "sync is the CANONICAL/preferred store; local is a transient fallback shadow reconciled back to sync when possible" — one-line scoped edit, no other line touched.
- **TDD discipline:** RED test commit (5 quota-shadow cases, all failing on missing exports) → GREEN implementation commit (machinery, 12/12 Setting tests green).

## Task Commits

Each task was committed atomically:

1. **Task 1: Setting.ts sync-shadow machinery (D-15)** - `cc360e7` (test, RED gate) + `4a8d8a8` (feat, GREEN gate)
2. **Task 2: Rewire ThemeStore persistence through Setting.ts** - `abda013` (feat)
3. **Task 3: quota-shadow tests + APPR-03 spec touch** - `0bb347b` (docs)

_Note: Task 1 is TDD (test commit → feat commit). Task 3's four required quota-shadow cases were authored in Task 1's RED phase (they are the behavior contract the machinery implements) and re-verified in Task 3 alongside the spec touch._

## Files Created/Modified

- `src/core/storage/Setting.ts` - Modified. Added COSMETIC_SYNC_KEYS, SYNC_KEYS_WITH_SHADOW (derived), settingWriteSync/settingReadSync (D-15 machinery), writeSyncWithShadow, per-key 100ms trailing debounce, D-15 header note
- `src/core/theme/ThemeStore.ts` - Modified. Rewired init/setMode/setPack through settingReadSync/settingWriteSync; onChanged propagates sync + local areas; removed the local-only gate and direct chrome.storage writes; D-15 rewire header note
- `tests/core/storage/Setting.test.ts` - Modified. Added the quota-shadow describe block (5 cases: fail→shadow+SYNC_QUOTA_EXCEEDED, shadow-wins read + re-attempt, reconciliation, happy path, debounce last-value-wins) driven by fake timers
- `tests/core/theme/ThemeStore.test.ts` - Modified. Tests 3/4 updated to the sync contract (assert sync storage + no local shadow); fake timers drive the Setting debounce and prevent cross-test timer leakage
- `.planning/PRODUCT_SPEC_v0_1.md` - Modified. APPR-03 (line ~2120) reworded to sync-canonical + local-shadow semantics

## Decisions Made

- **Wrappers over mutation:** the shadow machinery lives in `settingWriteSync`/`settingReadSync` (delegating non-sync keys to the generic paths) rather than altering `settingWrite`/`settingRead` — the generic paths keep their 02-05 contract and no debounce is imposed on non-cosmetic writes.
- **Unconditional shadow delete on sync success:** `chrome.storage.local.remove(key)` runs after every successful sync write — idempotent no-op when no shadow exists, simplest mechanical guarantee of the "never diverge" invariant.
- **Shared promote path:** the read-triggered re-attempt reuses `settingWriteSync` (debounced for cosmetic keys) so reconciliation flows through one code path; a shadow whose value fails the sanitizer is never promoted (garbage cannot propagate to sync).
- **Positive onChanged gate:** `if (area === 'sync' || area === 'local')` replaces the old `area !== 'local'` early return — satisfies the acceptance grep and makes sync-area theme changes propagate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ThemeStore.test.ts asserted the pre-rewire local-storage write contract**
- **Found during:** Task 2 (ThemeStore rewire)
- **Issue:** The plan's Task 2 rewires setMode/setPack to write through Setting.ts sync-first, and its verification requires `tests/core/theme/ThemeStore.test.ts` green — but two existing tests asserted the OLD contract: `setMode(light) writes chrome.storage.local.np_theme` and `setPack(liquid-glass) writes np_theme_pack`. After the rewire these writes land in chrome.storage.sync (local only as a shadow on failure), so the assertions could not pass. Additionally, the Setting.ts cosmetic debounce (100ms) made write-path tests timing-dependent and risked cross-test timer leakage.
- **Fix:** Updated the two tests to the D-15 contract: assert `chrome.storage.sync` holds the value and that NO local shadow exists on the happy path. Added `vi.useFakeTimers()`/`vi.useRealTimers()` around every ThemeStore test so the debounce fires deterministically (`advanceTimersByTimeAsync`) and pending timers are discarded between tests.
- **Files modified:** tests/core/theme/ThemeStore.test.ts
- **Verification:** `pnpm vitest run tests/core/theme/ThemeStore.test.ts` 6/6 green; full suite 250/250 green; typecheck clean; eslint/prettier clean
- **Committed in:** `abda013` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Enabling change required by the plan's own verification — the rewire intentionally changes the write destination, so the tests describing the destination must follow. No scope creep, no behavior beyond D-15.

## Issues Encountered

- **fakeBrowser does not enforce sync quotas (A-17, confirmed):** `@webext-core/fake-browser`'s sync area carries the constants (QUOTA_BYTES_PER_ITEM: 8192, MAX_WRITE_OPERATIONS_PER_MINUTE: 120) but never rejects — all quota/rate rejections in tests are mocked per the fixture, exactly as the plan flagged.
- **Cross-test timer leakage risk:** the module-level debounce could fire a write into a later test. Solved with fake timers in both test files (Setting.test.ts uses fake timers only in the quota-shadow block; ThemeStore.test.ts uses them for the whole file).
- **`SYNC_KEYS_WITH_SHADOW` placement:** originally written before the registry declaration (TS block-scoped error) — moved after STORAGE_KEY_REGISTRY; no behavior impact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **D-15 fully satisfied:** sync-first cosmetic writes with local shadow fallback and reconciliation, no silent divergence, debounce respected (T-2-08-01/02/03 mitigated, T-2-08-04 accepted as planned).
- **ThemeStore is the live D-15 consumer** — spec §15.1's sync placement of theme keys is now honored; the RESEARCH Pattern 5 landmine (Phase-1 ThemeStore writing local) is closed.
- **No regression** in ThemeStore's read-validate + onChanged behavior (existing tests updated to the new contract, full suite 250/250 green).
- **Ready for 02-09/02-10/02-11** (import/export, verification wiring) — `settingWriteSync`/`settingReadSync` are exported and the entrypoint init path can adopt sync-first reads for cosmetic keys.

---
*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-09*

## Self-Check: PASSED

- Created file verified on disk: `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-08-SUMMARY.md`
- Commits verified in git log: `cc360e7` (Task 1 RED test), `4a8d8a8` (Task 1 GREEN feat), `abda013` (Task 2 feat), `0bb347b` (Task 3 docs) — TDD gate order test→feat confirmed
- Plan verification: `pnpm vitest run tests/core/storage/Setting.test.ts tests/core/theme/ThemeStore.test.ts` 18/18 green; full suite 250/250 green (40 files); `pnpm typecheck` clean; eslint clean; prettier clean
- Acceptance criteria: Task 1 greps pass (COSMETIC_SYNC_KEYS=2, SYNC_QUOTA_EXCEEDED=4, shadow=28); Task 2 greps pass (settingReadSync|settingWriteSync=6, isValidMode=3, chrome.storage.local.set=0, area !== 'local'=0); Task 3 greps pass (SYNC_QUOTA_EXCEEDED in test=2, CANONICAL/preferred in spec=1)
- Threat surface: no new endpoints/auth paths/file access beyond the plan's threat model — the shadow boundary and read re-attempt are exactly the planned T-2-08 boundaries; no Threat Flags section needed
