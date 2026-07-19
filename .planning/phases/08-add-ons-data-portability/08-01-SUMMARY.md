---
phase: 08-add-ons-data-portability
plan: 01
subsystem: core-registry
tags: [addon-registry, typescript, chrome-storage, tdd]

# Dependency graph
requires:
  - phase: 03-03
    provides: ToolRegistry class+singleton pattern (Map-based, JS private #fields)
  - phase: 07-01
    provides: SlashCommandRegistry persistence pattern (chrome.storage.local)
provides:
  - AddonRegistry class+singleton with three typed registrations (skills, pages, settings schemas)
  - Enable/disable state persisted to chrome.storage.local under np_addon_enabled
  - Enable-gated query methods (getEnabledSkills, getEnabledPages)
affects:
  - 08-02 (ServiceNow add-on registers via AddonRegistry)
  - 08-03 (Write add-on registers via AddonRegistry)
  - 08-04 (TeamGQM add-on registers via AddonRegistry)
  - 08-05 (Global add-ons register via AddonRegistry)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Map-based registry with JS private #fields (skills, pages, settingsSchemas, enabled)
    - chrome.storage.local persistence with np_ key prefix pattern
    - Constructor-init load with fire-and-forget .catch(() => {})
    - Enable-gated query methods filtering disabled addon capabilities

key-files:
  created:
    - src/core/registries/AddonRegistry.ts
    - tests/core/addons/AddonRegistry.test.ts
    - tests/core/addons/AddonRegistry.types.ts
  modified: []

key-decisions:
  - "AddonPage interface includes addonId field for enable-gated getEnabledPages filtering"
  - "AddonRegistry follows ToolRegistry class+singleton pattern with JS private #fields Maps"
  - "Persistence follows SlashCommandRegistry pattern: load-on-construct, persist-on-mutate with try/catch + debugLog"
  - "getEnabledSkills filters by skill.addonId; getEnabledPages filters by page.addonId"

patterns-established:
  - "Pattern: AddonRegistry follows ToolRegistry Map-based pattern with composite keys (addonId:name) for skills and pages"

requirements-completed:
  - ADDON-01

# Coverage metadata
coverage:
  - id: D1
    description: "AddonRegistry with registerSkill/getSkill/hasSkill/listSkills/unregisterSkill — duplicate throws, missing returns undefined"
    requirement: ADDON-01
    verification:
      - kind: unit
        ref: "tests/core/addons/AddonRegistry.test.ts#registerSkill adds skill; getSkill retrieves; hasSkill returns true; listSkills includes it"
        status: pass
      - kind: unit
        ref: "tests/core/addons/AddonRegistry.test.ts#registerSkill with duplicate addonId:name throws"
        status: pass
      - kind: unit
        ref: "tests/core/addons/AddonRegistry.test.ts#unregisterSkill removes skill; hasSkill returns false after"
        status: pass
    human_judgment: false
  - id: D2
    description: "AddonRegistry with registerPage/getPage/listPages — AddonPage type with addonId for enable gating"
    requirement: ADDON-01
    verification:
      - kind: unit
        ref: "tests/core/addons/AddonRegistry.test.ts#registerPage / getPage / listPages work for AddonPage type"
        status: pass
    human_judgment: false
  - id: D3
    description: "AddonRegistry with registerSettingsSchema/getSettingsSchema — typed settings schemas with addonId key"
    requirement: ADDON-01
    verification:
      - kind: unit
        ref: "tests/core/addons/AddonRegistry.test.ts#registerSettingsSchema / getSettingsSchema work for settings schemas"
        status: pass
    human_judgment: false
  - id: D4
    description: "enable/disable with isEnabled — state persisted to chrome.storage.local under np_addon_enabled"
    requirement: ADDON-01
    verification:
      - kind: unit
        ref: "tests/core/addons/AddonRegistry.test.ts#enable persists to chrome.storage.local; isEnabled returns true"
        status: pass
      - kind: unit
        ref: "tests/core/addons/AddonRegistry.test.ts#disable persists to chrome.storage.local; isEnabled returns false"
        status: pass
      - kind: unit
        ref: "tests/core/addons/AddonRegistry.test.ts#listEnabled returns only enabled addon IDs"
        status: pass
    human_judgment: false
  - id: D5
    description: "Constructor loads persisted enable state from chrome.storage.local on instantiation"
    requirement: ADDON-01
    verification:
      - kind: unit
        ref: "tests/core/addons/AddonRegistry.test.ts#constructor loads persisted enable state from chrome.storage.local"
        status: pass
    human_judgment: false
  - id: D6
    description: "getEnabledSkills and getEnabledPages return capabilities only from enabled addons"
    requirement: ADDON-01
    verification:
      - kind: unit
        ref: "tests/core/addons/AddonRegistry.test.ts#getEnabledSkills returns skills only from enabled addons"
        status: pass
      - kind: unit
        ref: "tests/core/addons/AddonRegistry.test.ts#getEnabledPages returns pages only from enabled addons"
        status: pass
    human_judgment: false

# Metrics
duration: 2 min
completed: 2026-07-19
status: complete
---

# Phase 08 Plan 01: AddonRegistry — Add-on Registration System Summary

**AddonRegistry class+singleton with three typed registrations (skills, pages, settings schemas), enable/disable persistence to chrome.storage.local under np_addon_enabled, and enable-gated query methods — all built TDD-style with 11 passing tests**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-19T21:57:31Z
- **Completed:** 2026-07-19T22:00:47Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- **RED gate:** 11 unit tests written and confirmed failing (module not found) before implementation
- **GREEN gate:** AddonRegistry class+singleton implemented, all 11 tests passing
- **Typed registrations:** AddonSkill, AddonPage, AddonSettingsSchema interfaces exported from the module
- **Three private Maps:** `#skills` (keyed by `${addonId}:${name}`), `#pages` (keyed by `${addonId}:${page.id}`), `#settingsSchemas` (keyed by addonId)
- **Enable/disable lifecycle:** `enable()`/`disable()`/`isEnabled()`/`listEnabled()` with async persistence to `chrome.storage.local` under `np_addon_enabled`
- **Enable-gated queries:** `getEnabledSkills()` returns skills only from enabled addons; `getEnabledPages()` returns pages only from enabled addons
- **Persistence pattern:** Constructor calls `#loadEnabled()` with fire-and-forget `.catch(() => {})`; mutations call `#persistEnabled()` with try/catch + `debugLog`
- **Singleton export:** `addonRegistry` exported per project convention
- **All 110 related tests pass** (15 test files across registries, permissions, storage, tools)

## Task Commits

Each task was committed atomically following TDD cycle:

1. **Task 1 (TDD RED): Create AddonRegistry test file and types** - `c4baf52` (test)
2. **Task 2 (TDD GREEN): Implement AddonRegistry class+singleton** - `a5cdeca` (feat)

**Plan metadata:** (committed after SUMMARY)

## Files Created/Modified

### Created (3 files)

- `src/core/registries/AddonRegistry.ts` (168 lines) — AddonRegistry class with 3 typed registration Maps, enable/disable persistence, enable-gated query methods, singleton export
- `tests/core/addons/AddonRegistry.test.ts` (163 lines) — 11 unit tests covering registration, enable/disable persistence, and enable-gated queries
- `tests/core/addons/AddonRegistry.types.ts` (20 lines) — Test stub types (AddonSkill, AddonPage, AddonSettingsSchema)

## Decisions Made

- **AddonPage includes addonId:** The `AddonPage` interface includes an `addonId` field so `getEnabledPages()` can correctly filter pages by their parent addon's enable state. The plan's interface omitted this field but it's required for enable gating to work.
- **Composite keys for skills and pages:** Skills keyed by `${addonId}:${name}`, pages keyed by `${addonId}:${page.id}` — prevents collision between different addons registering same-named skills/pages.
- **Settings schemas keyed by addonId only:** One settings schema per addon, keyed directly by addonId (simpler than composite key since each addon has at most one settings schema).
- **Persistence pattern follows SlashCommandRegistry:** `#loadEnabled` in constructor (fire-and-forget with `.catch(() => {})`), `#persistEnabled` called after every mutation with try/catch + debugLog error logging.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added addonId field to AddonPage interface**

- **Found during:** Task 2 verification (test 11 failed)
- **Issue:** `getEnabledPages()` couldn't determine which addon a page belongs to because the `AddonPage` interface didn't include an `addonId` field. The plan's interface omitted it, but enable-gated filtering requires knowing the parent addon for each page.
- **Fix:** Added `addonId: string` to the `AddonPage` interface and updated `getEnabledPages()` to filter by `p.addonId` instead of `p.id`
- **Files modified:** `src/core/registries/AddonRegistry.ts`, `tests/core/addons/AddonRegistry.types.ts`, `tests/core/addons/AddonRegistry.test.ts`
- **Verification:** All 11 tests pass including getEnabledPages test
- **Committed in:** a5cdeca (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Fix enables correct enable-gated page filtering. No scope creep.

## TDD Gate Compliance

- **RED Gate:** Present — `test(08-01)` commit: c4baf52
- **GREEN Gate:** Present — `feat(08-01)` commit: a5cdeca
- **REFACTOR:** Not needed — implementation is clean and minimal
- **Status:** All gates PASS

## Issues Encountered

- **Missing addonId on AddonPage:** The plan's `AddonPage` interface omitted `addonId`, but `getEnabledPages()` needs it for enable-state gating. Added the field (Rule 2 deviation, documented above).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- AddonRegistry class+singleton with all three typed registrations operational
- Downstream add-ons (ServiceNow, Write, TeamGQM, Global) can call `addonRegistry.registerSkill()`, `addonRegistry.registerPage()`, and `addonRegistry.registerSettingsSchema()` in their registration functions
- Enable/disable state persists across extension restarts via `np_addon_enabled` in `chrome.storage.local`
- Ready for Plan 08-02 (ServiceNow add-on foundation: CookieSessionStore, ServiceNowSessionAdapter, Table API client)
- 110 related tests pass across 15 test files

## Self-Check: PASSED

- [x] `src/core/registries/AddonRegistry.ts` exists (168 lines)
- [x] `tests/core/addons/AddonRegistry.test.ts` exists (163 lines, 11 tests)
- [x] `tests/core/addons/AddonRegistry.types.ts` exists (20 lines)
- [x] Both commits verified in git log (test + feat)
- [x] All 11 AddonRegistry tests pass
- [x] All 110 related tests pass (15 test files: registries, permissions, storage, tools)
- [x] Exports match must_haves: AddonRegistry, addonRegistry, AddonSkill, AddonPage, AddonSettingsSchema

---

*Phase: 08-add-ons-data-portability*
*Completed: 2026-07-19*
