---
phase: 08-add-ons-data-portability
plan: 07
subsystem: addons
tags: [teamgqm, gqm, tree, ant-design-tree, side-panel, standalone-page, addon-registration]

requires:
  - phase: 08-05
    provides: GQMDataService with CRUD API for Goal/Question/Metric entities

provides:
  - TeamGQMSidepanelPage — read-only GQM hierarchy tree in Side Panel (expand/collapse only)
  - TeamGQMStandalonePage — editable GQM tree with inline editing and Add Goal/Question/Metric in Full App
  - registerTeamGQMAddon — registration function for TeamGQM add-on (both surfaces + settings schema)

affects:
  - Phase 08-08 (AddonSettingsSection, main.tsx wiring)

tech-stack:
  added: []
  patterns:
    - Ant Design Tree with inline editing via title as render function (no titleRender prop — antd 6)
    - Context menu on Tree nodes for child creation (Add Question on Goal, Add Metric on Question)
    - Registration function following registerNowPilotCorePages.ts blueprint pattern

key-files:
  created:
    - src/addons/teamgqm/components/TeamGQMSidepanelPage.tsx
    - src/addons/teamgqm/components/TeamGQMStandalonePage.tsx
    - src/addons/teamgqm/registerTeamGQMAddon.ts

key-decisions:
  - "antd 6 Tree does not have a titleRender prop — used title as render function pattern instead (buildRenderTree helper converts DataNode titles to rendered ReactNode)"
  - "Context menu (Dropdown with trigger:contextMenu) wraps the title render function for Add Question/Add Metric actions"
  - "Three state pattern per page: loading (centered Spin), empty (Empty component with description), data (Tree with defaultExpandAll)"
  - "Registration at order 12, after ServiceNow (11), following the established page ordering convention"

requirements-completed:
  - ADDON-08

coverage:
  - id: D1
    description: "TeamGQMSidepanelPage renders read-only condensed GQM tree (expand/collapse) in Side Panel"
    requirement: ADDON-08
    verification:
      - kind: manual_procedural
        ref: "src/addons/teamgqm/components/TeamGQMSidepanelPage.tsx — renders Tree with showLine, blockNode, defaultExpandAll, selectable=false"
        status: pass
    human_judgment: true
    rationale: "Visual verification needed to confirm Tree renders correctly with GQM hierarchy and three states"
  - id: D2
    description: "TeamGQMStandalonePage renders editable GQM tree with inline editing via double-click and Add Goal/Question/Metric"
    requirement: ADDON-08
    verification:
      - kind: manual_procedural
        ref: "src/addons/teamgqm/components/TeamGQMStandalonePage.tsx — renders Tree with inline editing, Add Goal button, context menus"
        status: pass
    human_judgment: true
    rationale: "Interactive verification needed to confirm inline editing and context menu behavior"
  - id: D3
    description: "registerTeamGQMAddon registers both side panel and standalone pages with registries and AddonRegistry settings schema"
    requirement: ADDON-08
    verification:
      - kind: other
        ref: "src/addons/teamgqm/registerTeamGQMAddon.ts — calls sidepanelPageRegistry.register, standalonePageRegistry.register, addonRegistry.registerSettingsSchema"
        status: pass
    human_judgment: false

duration: 3 min
completed: 2026-07-19
status: complete
---

# Phase 8 Plan 7: TeamGQM UI Pages Summary

**Read-only condensed GQM tree for Side Panel and editable GQM tree workspace for Full App with inline editing, plus registration function for both surfaces**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-19T12:35:04Z
- **Completed:** 2026-07-19T12:38:33Z
- **Tasks:** 2
- **Files modified:** 3 (all created)

## Accomplishments

- **TeamGQMSidepanelPage** (81 lines) — Read-only Side Panel page showing GQM hierarchy as an Ant Design Tree with `defaultExpandAll`, `selectable={false}`, `blockNode`, and `showLine`. Three states handled: loading (centered `<Spin>`), empty (`<Empty>` with "No goals defined yet" description), and data (expanded tree). Metric labels include `currentValue` and `unit` when available. Heading: "Goals & Metrics" per UI-SPEC copywriting contract.
- **TeamGQMStandalonePage** (247 lines) — Full App page showing editable GQM tree with double-click inline editing via Input component. "Add Goal" button creates root-level Goal nodes. Context menu on Goal nodes provides "Add Question", on Question nodes provides "Add Metric". All writes route through `gqmDataService.createQuestion()` / `createMetric()`. Heading: "GQM Workspace" per UI-SPEC.
- **registerTeamGQMAddon** (29 lines) — Registration function registering both surfaces with the page registries at order 12 (after ServiceNow at 11). Side panel: `id: 'teamgqm'`, label "Goals & Metrics", icon `ApartmentOutlined`. Standalone: `id: 'teamgqm'`, label "GQM Workspace". Registers an empty settings schema with AddonRegistry.
- **Ant Design Tree compatibility** — Worked around antd 6's absence of `titleRender` prop by using the `title` field as a render function pattern via a `buildRenderTree` helper, which recursively converts DataNode titles from strings to rendered ReactNode elements wrapping inline editing and context menus.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create TeamGQMSidepanelPage (read-only tree)** - `c1248af` (feat)
2. **Task 2: Create TeamGQMStandalonePage (editable tree) + registerTeamGQMAddon** - `2ab2db4` (feat)

**Plan metadata:** (committed after SUMMARY)

## Files Created/Modified

### Created (3 files)

- `src/addons/teamgqm/components/TeamGQMSidepanelPage.tsx` (81 lines) — Read-only GQM tree for Side Panel with loading/empty/data states
- `src/addons/teamgqm/components/TeamGQMStandalonePage.tsx` (247 lines) — Editable GQM tree for Full App with inline editing and context menu child creation
- `src/addons/teamgqm/registerTeamGQMAddon.ts` (29 lines) — Registration function for both surfaces + settings schema

## Decisions Made

- **antd 6 title handling:** antd 6 Tree does not have a `titleRender` prop. Instead, the `title` field in `DataNode` can be set to a rendered ReactNode. A `buildRenderTree` helper function converts static title strings into rendered ReactNode elements wrapping inline editing (`<Input>` on double-click) and context menu (`<Dropdown>` with `trigger: contextMenu`). This keeps the treeData construction separate from rendering logic.
- **Context menu for child creation:** Used Ant Design `<Dropdown>` with `trigger={['contextMenu']}` wrapping the title render function. Right-click on a Goal node shows "Add Question", on a Question node shows "Add Metric". This avoids adding permanent inline buttons which would clutter the tree.
- **Registration order 12:** TeamGQM pages register at order 12 (after ServiceNow add-on at 11), following the existing page ordering convention where core pages use 1-4 and add-ons start at 10+.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- **antd 6 `titleRender` prop missing:** The plan specified using `titleRender` on the Tree component (from RESEARCH.md code example referencing antd 5). antd 6 uses a different API where the `title` field of each `DataNode` can be a render function. Fixed by using a `buildRenderTree` helper that converts DataNode titles to rendered ReactNode elements. This approach actually provides better separation of concerns — tree data construction stays clean, and rendering logic is applied in a single helper pass.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TeamGQM UI pages ready for wiring into the extension entry points (main.tsx for both sidepanel and standalone surfaces)
- Registration function `registerTeamGQMAddon` ready to be called during startup (Phase 08-08)
- Pages depend on GQMDataService from Plan 05 already being operational with IndexedDB backing
- Next plan: 08-08

---

*Phase: 08-add-ons-data-portability*
*Completed: 2026-07-19*
