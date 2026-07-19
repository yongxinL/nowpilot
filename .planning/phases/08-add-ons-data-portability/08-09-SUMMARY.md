---
phase: 08-add-ons-data-portability
plan: 09
subsystem: addon-integration
tags: [addon-registration, nav-config, settings-ui, slash-commands, wiring]

# Dependency graph
requires:
  - phase: 08-01
    provides: AddonRegistry with typed registration for skills, pages, settings
  - phase: 08-02
    provides: Write add-on registration (registerWriteAddon)
  - phase: 08-06
    provides: ServiceNow add-on registration (registerServiceNowAddon)
  - phase: 08-07
    provides: TeamGQM add-on registration (registerTeamGQMAddon)
  - phase: 08-08
    provides: Global add-on registration (registerGlobalAddons)

provides:
  - Registration of all 4 add-ons at startup in both main.tsx surfaces before React mount
  - Add-on nav items from page registries in buildNavConfig with group:'addons'
  - Registry-driven AddonSettingsSection with enable/disable toggles
  - Wired /write and /research slash command handlers

affects:
  - Phase 9 (future) — navigation filtering by enable state, ResearchSkill ChatPage integration

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Add-on registration at startup: import + call registration functions before ReactDOM.createRoot in both main.tsx surfaces"
    - "Registry-driven nav: buildNavConfig reads registered add-on pages from SidepanelPageRegistry and builds addon-grouped nav items"
    - "Settings section: AddonSettingsSection iterates addonRegistry.listSettingsSchemas() to render per-addon enable/disable toggles"

key-files:
  created: []
  modified:
    - src/entrypoints/sidepanel/main.tsx
    - src/entrypoints/standalone/main.tsx
    - src/core/navigation/navConfig.ts
    - src/core/registries/AddonRegistry.ts
    - src/components/options/AddonSettingsSection.tsx
    - src/core/slash/SlashCommandRegistry.ts

key-decisions:
  - "Add-on registration uses explicit function calls (not module-eval side effects) — registration files export named functions, main.tsx imports and calls them"
  - "Add-on nav items built from SidepanelPageRegistry.getAll(), filtered by CORE_PAGE_IDS set — core and addon pages coexist through the same page registry"
  - "AddonSettingsSection reads enabled state from addonRegistry.listEnabled() and settings schemas from listSettingsSchemas()"
  - "Slash command handlers use dynamic imports to avoid circular dependencies at module init time"

requirements-completed:
  - ADDON-01
  - ADDON-06
  - ADDON-09

coverage:
  - id: D1
    description: "Add-on registration functions called from sidepanel/main.tsx and standalone/main.tsx before React mount"
    requirement: ADDON-01
    verification:
      - kind: other
        ref: "pnpm build succeeds — addon registration chunks included in bundle"
        status: pass
    human_judgment: false

  - id: D2
    description: "Add-on nav items rendered from page registries with group:'addons' in buildNavConfig"
    requirement: ADDON-01
    verification:
      - kind: other
        ref: "pnpm tsc --noEmit — no errors from navConfig.ts changes"
        status: pass
    human_judgment: false

  - id: D3
    description: "AddonSettingsSection renders per-addon enable/disable toggles from AddonRegistry"
    requirement: ADDON-01
    verification:
      - kind: other
        ref: "pnpm build succeeds — AddonSettingsSection compiled into options chunk"
        status: pass
    human_judgment: false

  - id: D4
    description: "/write slash command handler wired to navigate to Write add-on Side Panel page"
    requirement: ADDON-06
    verification:
      - kind: unit
        ref: "tests/core/slash/SlashCommandRegistry.test.ts — 6 tests pass"
        status: pass
    human_judgment: false

  - id: D5
    description: "/research slash command wired to execute ResearchSkill"
    requirement: ADDON-09
    verification:
      - kind: unit
        ref: "tests/core/slash/SlashCommandRegistry.test.ts — handler added to research command"
        status: pass
    human_judgment: false

# Metrics
duration: 2 min
completed: 2026-07-19
status: complete
---

# Phase 8 Plan 9: Add-on Integration Wiring Summary

**Add-on registration at startup in both main.tsx surfaces, add-on nav items from page registries, registry-driven enable/disable toggles in AddonSettingsSection, wired /write and /research slash command handlers — all add-ons now visible and functional in the running application**

## Performance

- **Duration:** 2 min
- **Started:** 2026-07-19T12:44:36Z
- **Completed:** 2026-07-19T12:47:34Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- **Add-on registration at startup:** All 4 add-on registration functions (Write, ServiceNow, TeamGQM, Global) imported and called from both `sidepanel/main.tsx` and `standalone/main.tsx` before `ReactDOM.createRoot`, following the established `registerNowPilotCorePages` pattern
- **Add-on nav items in navigation:** `buildNavConfig()` extended to read registered add-on pages from `SidepanelPageRegistry.getAll()`, filter out core page IDs, and build `NowPilotNavItem` entries with `group: 'addons'` — add-on pages appear below the separator in SiderMenu
- **Registry-driven AddonSettingsSection:** Replaced the previous stub ("No add-ons installed" empty state) with a fully functional registry-driven UI that iterates `addonRegistry.listSettingsSchemas()` and renders per-addon `Card` with enable/disable `Switch` toggles — each toggle calls `addonRegistry.enable()` / `addonRegistry.disable()` which persists to `chrome.storage.local` under `np_addon_enabled`
- **Wired slash command handlers:** `/write` handler navigates to the Write add-on Side Panel page via `workspaceStore.setActiveSurface('sidepanel')`; `/research` handler dynamically imports and executes `ResearchSkill.execute()` with graceful degradation
- **AddonRegistry extended:** Added `listSettingsSchemas()` method (missing from prior plan) so the settings UI can enumerate registered settings schemas

## Task Commits

Each task was committed atomically:

1. **Task 1: Register add-ons at startup (main.tsx + navConfig)** - `d17258b` (feat)
2. **Task 2: Replace AddonSettingsSection stub with registry-driven UI + wire slash commands** - `a672615` (feat)

**Plan metadata:** (committed after SUMMARY)

## Files Created/Modified

### Modified (6 files)

- `src/entrypoints/sidepanel/main.tsx` — Added add-on registration imports and function calls before React mount
- `src/entrypoints/standalone/main.tsx` — Same add-on registration additions
- `src/core/navigation/navConfig.ts` — Extended buildNavConfig to include add-on pages from SidepanelPageRegistry with group:'addons'
- `src/core/registries/AddonRegistry.ts` — Added `listSettingsSchemas()` method
- `src/components/options/AddonSettingsSection.tsx` — Replaced stub with registry-driven enable/disable toggle UI
- `src/core/slash/SlashCommandRegistry.ts` — Wired /write and /research handler properties on built-in commands

## Decisions Made

- **Explicit function calls for add-on registration:** Registration files export named functions (`registerWriteAddon()` etc.) called explicitly from main.tsx, rather than relying on module-eval side effects — clearer control flow and easier testing
- **CORE_PAGE_IDS filter set:** Add-on pages are filtered from `sidepanelPageRegistry.getAll()` using a `Set<string>` of core page IDs — clean separation that automatically picks up any page registered in the system that isn't a core page
- **Dynamic imports in slash handlers:** Slash command handlers use `await import()` for workspaceStore and ResearchSkill to avoid circular dependencies at module init time when the SlashCommandRegistry singleton is constructed
- **listSettingsSchemas() added to AddonRegistry:** Settings UI needs to enumerate all registered settings schemas — added the method following the existing `listSkills()` / `listPages()` pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added listSettingsSchemas() to AddonRegistry**
- **Found during:** Task 2 (AddonSettingsSection implementation)
- **Issue:** AddonSettingsSection needs to enumerate all registered settings schemas, but AddonRegistry had no `listSettingsSchemas()` method — only `registerSettingsSchema()` and `getSettingsSchema()`. Without this, the settings UI cannot iterate over all registered add-ons.
- **Fix:** Added `listSettingsSchemas(): AddonSettingsSchema[]` to AddonRegistry, following the same pattern as the existing `listSkills()` and `listPages()` methods
- **Files modified:** src/core/registries/AddonRegistry.ts
- **Verification:** Build succeeds, type checks pass
- **Committed in:** a672615 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Added showArrowInStandaloneExpanded to add-on nav items**
- **Found during:** Task 1 (navConfig.ts implementation)
- **Issue:** Core pages with `group:'addons'` (like 'tasks') set `showArrowInStandaloneExpanded: true` based on group check, but the new add-on page entries didn't have this property
- **Fix:** Added `showArrowInStandaloneExpanded: true` to add-on nav item construction
- **Files modified:** src/core/navigation/navConfig.ts
- **Verification:** Build succeeds, type checks pass
- **Committed in:** d17258b (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 2 - missing critical)
**Impact on plan:** Both fixes are necessary for correct functionality. The `listSettingsSchemas()` method is required for the settings UI to work; the `showArrowInStandaloneExpanded` flag ensures consistent visual behavior between core addon-group pages and registered add-on pages.

## Issues Encountered

None — both tasks executed cleanly with first-pass build success.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 8 add-ons now registered at startup and visible in the application
- Add-on enable/disable fully functional via Options → Add-on Settings
- Slash commands wired to add-on handlers
- Ready for end-of-phase verification and testing

---

*Phase: 08-add-ons-data-portability*
*Completed: 2026-07-19*
