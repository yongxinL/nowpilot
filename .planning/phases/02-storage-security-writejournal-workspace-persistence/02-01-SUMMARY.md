---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 01
subsystem: storage
tags: [indexeddb, idb, fflate, fake-indexeddb, types, error-codes, fixtures, i18n]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: errorCodes.ts registry shape, i18n strings.ts STR object, per-domain types precedent (src/types/workspace.ts), jsdom-align vitest env + threads pool, verify:phase-1 template
provides:
  - WriteJournalOperation 11-op union + WriteJournalEntry interface (src/types/storage.ts, importable via '@/types/storage' — the spec O.11 path)
  - Six Phase-2 canonical error codes in errorCodes.ts AND spec Appendix C.2 (VAULT_DECRYPT_FAILED, PROVIDER_KEY_UNREADABLE, IDB_MIGRATION_FAILED, SYNC_QUOTA_EXCEEDED, WRITE_JOURNAL_FAILED, WRITE_JOURNAL_ROLLBACK_FAILED)
  - STR.storage.degradedBanner + STR.storage.providerKeyRequired canonical strings
  - Six deterministic typed fixture builders under tests/fixtures/ (vault-roundtrip, cross-install, journal-recovery, migration, quota-shadow, redaction) proven deterministic by a real test
  - fake-indexeddb harness registered in tests/setup.ts (real IndexedDB in jsdom-align, zero extra polyfills)
  - idb@8.0.3 + fflate@0.8.3 (deps) + fake-indexeddb@6.2.5 (devDep) installed
  - verify:phase-2 script in package.json (eslint + prettier + tsc + wxt build + vitest run + isolation check)
affects: [02-02 vault/encrypted-storage, 02-03 write-journal, 02-04 stores, 02-05 keyvault, 02-06 migrator, 02-07 setting, 02-08 redaction, 02-09 import-export, 02-10 sync-shadow, 02-11 verification]

# Tech tracking
tech-stack:
  added: [idb ^8.0.3, fflate ^0.8.3, fake-indexeddb ^6.2.5 (devDep)]
  patterns:
    - "Per-domain types file precedent (R-1): src/types/storage.ts mirrors src/types/workspace.ts, spec-verbatim types"
    - "fake-indexeddb/auto registration in tests/setup.ts — global IDB for every test (RESEARCH Pattern 1)"
    - "Canonical error codes added IN PLACE in errorCodes.ts AND canonicalized into spec C.2 in the same task (CONTEXT line 84)"
    - "Deterministic fixture builders: fixed constants only, parameterized on edges, edge variants first-class (D-20/D-21)"

key-files:
  created:
    - src/types/storage.ts
    - tests/fixtures/index.ts
    - tests/fixtures/fixtures.test.ts
  modified:
    - package.json
    - pnpm-lock.yaml
    - tests/setup.ts
    - src/core/error/errorCodes.ts
    - src/core/i18n/strings.ts
    - .planning/PRODUCT_SPEC_v0_1.md

key-decisions:
  - "WriteJournalOperation typed as the locked 11-op union verbatim from §20.3 — declared-but-unwired ops ship by type presence only (D-05, Golden Rule 2)"
  - "Six Phase-2 codes canonicalized in BOTH errorCodes.ts and spec C.2 in the same task — a code in one file only is a canonicalization failure (T-2-01-02)"
  - "Fixtures import src/ types only via type-only imports — never value imports; src/ never imports tests/fixtures (D-21 direction)"
  - "installSecret fixture pins a fixed 32-byte base64 pattern (0x33×32) — deterministic AES-GCM roundtrip posture (A-01/A-04)"

patterns-established:
  - "Pattern 1: per-domain types file with spec-verbatim declarations + header comment citing spec sections"
  - "Pattern 2: block-comment grouped error-code registry extension IN PLACE (never re-export)"
  - "Pattern 3: deterministic fixture builders — two calls with identical args deep-equal; edge variants (crash-before-completed, different-workspaceId, unknown-op, cross-install no-wipe) first-class"

requirements-completed: [STORAGE-02, STORAGE-03, STORAGE-04, STORAGE-05]

coverage:
  - id: D1
    description: "Storage stack installed (idb+fflate deps, fake-indexeddb devDep) with fake-indexeddb harness registered in tests/setup.ts and verify:phase-2 script added"
    requirement: STORAGE-02
    verification:
      - kind: other
        ref: "pnpm ls idb fflate fake-indexeddb — all three listed, fake-indexeddb under devDependencies"
        status: pass
      - kind: other
        ref: "grep -c 'fake-indexeddb/auto' tests/setup.ts == 1"
        status: pass
      - kind: other
        ref: "pnpm vitest run tests/core/theme tests/core/workspace — 39 tests pass (existing suite unaffected)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Canonical storage types (WriteJournalOperation 11-op union + WriteJournalEntry), six Phase-2 error codes in errorCodes.ts + spec C.2, Phase-2 i18n banner strings"
    requirement: STORAGE-04
    verification:
      - kind: other
        ref: "pnpm typecheck — clean (src/types/storage.ts compiles via @/types/storage)"
        status: pass
      - kind: other
        ref: "grep six codes in src/core/error/errorCodes.ts == 6 distinct"
        status: pass
      - kind: other
        ref: "grep each of six codes in .planning/PRODUCT_SPEC_v0_1.md >= 1"
        status: pass
      - kind: other
        ref: "grep -c degradedBanner / providerKeyRequired in src/core/i18n/strings.ts == 1 each"
        status: pass
    human_judgment: false
  - id: D3
    description: "Six deterministic typed fixture builders (vault-roundtrip, cross-install, journal-recovery, migration, quota-shadow, redaction) with determinism smoke test; fixtures never imported from src/"
    requirement: STORAGE-03
    verification:
      - kind: unit
        ref: "tests/fixtures/fixtures.test.ts — 8 tests pass (determinism + well-formedness per builder)"
        status: pass
      - kind: other
        ref: "grep -rn 'tests/fixtures' src/ == 0 (D-21 dependency direction enforced)"
        status: pass
    human_judgment: false

# Metrics
duration: 11min
completed: 2026-08-09
status: complete
---

# Phase 2 Plan 1: Wave-0 Storage Foundation Summary

**idb+fflate+fake-indexeddb storage stack installed, fake-indexeddb IndexedDB harness registered, canonical WriteJournal types + six Phase-2 error codes + banner strings shipped, and six deterministic typed fixture builders proven by a determinism smoke test — the shared substrate every later Phase-2 plan imports**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-09T03:11:31Z
- **Completed:** 2026-08-09T03:22:00Z
- **Tasks:** 3
- **Files modified:** 9 (6 modified, 3 created)

## Accomplishments

- Installed `idb@8.0.3` + `fflate@0.8.3` (dependencies, approved stack §7) and `fake-indexeddb@6.2.5` (devDep, test-only) — verified by `pnpm ls`, no postinstall scripts, legitimacy audited in RESEARCH
- Registered `import 'fake-indexeddb/auto'` in `tests/setup.ts` so every test has real IndexedDB globals — crypto.subtle + structuredClone already present in jsdom-align, zero extra polyfills (RESEARCH Pattern 1); full suite still green (178 tests)
- Created `src/types/storage.ts` with the locked 11-op `WriteJournalOperation` union (§20.3 verbatim) and `WriteJournalEntry` (Appendix C verbatim), importable via `@/types/storage` (the spec O.11 path, R-1)
- Extended `errorCodes.ts` IN PLACE with the six Phase-2 codes AND canonicalized the same six into spec Appendix C.2 in the same task (CONTEXT line 84 — a code in one file only is a canonicalization failure)
- Added `STR.storage.degradedBanner` + `STR.storage.providerKeyRequired` verbatim from CONTEXT D-12/D-04 wording
- Built six deterministic typed fixture builders (D-20/D-21) under `tests/fixtures/` — fixed constants only (no getRandomValues/Date.now), parameterized on edges, edge variants first-class — proven deterministic by an 8-test smoke suite
- Added `verify:phase-2` script (eslint + prettier + tsc --noEmit + wxt build + vitest run + isolation check), the Phase-1 extended template

## Task Commits

Each task was committed atomically:

1. **Task 1: Install storage deps, register fake-indexeddb harness, add verify:phase-2 script** - `70c68ac` (chore)
2. **Task 2: Create src/types/storage.ts + extend errorCodes.ts + spec C.2 + Phase-2 i18n strings** - `5c47411` (feat)
3. **Task 3: Build the six deterministic fixture builders + determinism smoke test** - `21ff759` (feat)

## Files Created/Modified

- `src/types/storage.ts` - Created. `WriteJournalOperation` 11-op union (§20.3 verbatim) + `WriteJournalEntry` (Appendix C verbatim), canonical `@/types/storage` home
- `tests/fixtures/index.ts` - Created. Six named typed deterministic builders (D-20/D-21) with fixed constants and edge variants
- `tests/fixtures/fixtures.test.ts` - Created. Determinism + well-formedness smoke test (8 tests, Nyquist)
- `tests/setup.ts` - Modified. Added `import 'fake-indexeddb/auto'` + header note (RESEARCH Pattern 1); beforeEach/afterEach untouched
- `src/core/error/errorCodes.ts` - Modified. Added `--- Storage / vault / journal (Phase 2) ---` block with six codes, existing style
- `src/core/i18n/strings.ts` - Modified. Added `storage:` group with degradedBanner + providerKeyRequired
- `.planning/PRODUCT_SPEC_v0_1.md` - Modified. Appended "Phase 2 — storage/vault/journal" block to Appendix C.2 registry
- `package.json` - Modified. Added `verify:phase-2` script
- `pnpm-lock.yaml` - Modified. idb 8.0.3, fflate 0.8.3, fake-indexeddb 6.2.5

## Decisions Made

- **Fixture type-only imports:** fixtures may `import type` from `@/types/storage` but never value-import src/ — D-21's tests → fixtures → src/types direction (verified: `grep -rn "tests/fixtures" src/` == 0)
- **Spec C.2 scoped edit:** only appended the Phase-2 block at the C.2 section end — never rewrote the 6718-line spec file
- **verify:phase-2 = Phase-1 template:** the spec §24 minimum (`tsc --noEmit && vitest run tests/core/storage ...`) is satisfied by the full-suite run inside the extended chain
- **Deterministic secrets:** fixture installSecret constants pin fixed 32-byte base64 patterns (0x33×32 / 0x55×32) so later vault/cross-install tests derive keys deterministically

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Determinism smoke test looped over the cross-workspace edge variant**
- **Found during:** Task 3 (fixture determinism test)
- **Issue:** My initial test loop asserted every journal-recovery entry carries the fixture workspaceId, but the different-workspaceId edge variant (WR-10 scoping proof) intentionally carries `'ws-other'` — the test failed on the very variant it was designed to prove
- **Fix:** Added a `continue` guard for the `'ws-other'` entry in both loops; the variant is still asserted to exist separately
- **Files modified:** tests/fixtures/fixtures.test.ts
- **Verification:** `pnpm vitest run tests/fixtures/fixtures.test.ts` → 8/8 pass; full suite 178/178 pass
- **Committed in:** `21ff759` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** No scope creep; the fix made the test correctly distinguish the workspace-scoped entries from the intentional cross-workspace variant.

## Issues Encountered

- **Scratch-file write failed** (`/tmp/opencode/plan-start-time.txt`): tmpfs disk-quota exceeded on the shared /tmp tmpfs — non-blocking; the start timestamp was captured in the session instead. Working-tree and /home disk (95G free) unaffected.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 02-02 onwards:** every later plan can `import { WriteJournalEntry } from '@/types/storage'`, reference the six canonical codes, use the fake-indexeddb harness, and import the six fixture builders without re-deriving them
- **verify:phase-2** gate script exists; the full chain runs at 02-11
- **No blockers** — all success criteria met: later plans import types/codes/fixtures/harness; the test harness opens real IndexedDB with zero extra polyfills; no production code imports tests/fixtures

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-09*

## Self-Check: PASSED

- Created files verified on disk: `src/types/storage.ts`, `tests/fixtures/index.ts`, `tests/fixtures/fixtures.test.ts`, `02-01-SUMMARY.md`
- Commits verified in git log: `70c68ac` (Task 1), `5c47411` (Task 2), `21ff759` (Task 3), `58aed13` (docs)
- Full verification: `pnpm typecheck` clean, eslint clean, prettier clean, full vitest suite 178/178 green, fixtures determinism 8/8 green

