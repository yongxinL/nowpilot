---
phase: 08-add-ons-data-portability
plan: 02
subsystem: addons
tags: [write-addon, prompt-templates, sidepanel, quick-actions, prompt-manager]

requires:
  - phase: 08-01
    provides: AddonRegistry, SidepanelPageRegistry pattern
  - phase: 07-01
    provides: PromptManager class+singleton, PromptTemplate type
  - phase: 07.1-01
    provides: builtinTemplates pattern, PromptManager.createTemplate()

provides:
  - Write add-on with 6 skill prompt templates registered in PromptManager (category: 'Writing')
  - WritePage Side Panel component with 6 quick-action buttons
  - registerWriteAddon() registration function called at startup
  - sidepanelPageRegistry entry for 'write' page at order 10 with WriteIcon

affects:
  - 08-03+ (TeamGQM, ServiceNow add-ons follow same registration pattern)
  - Sidepanel main.tsx (import registerWriteAddon at startup)
  - ChatPage (Sender reads 'write' draft from workspaceStore)

tech-stack:
  added: []
  patterns:
    - PromptTemplate configs with displayCategory 'Writing', isBuiltin: false, scopes: ['writing']
    - Button-per-skill Card layout in Side Panel (D-07/D-09)
    - Draft population via workspaceStore.setDraft('write', template) for Sender integration
    - Registration function called at startup (registerNowPilotCorePages blueprint)
    - TDD: RED→GREEN cycle for writeSkills module

key-files:
  created:
    - src/addons/write/skills/writeSkills.ts (6 PromptTemplate configs + registerWriteTemplates)
    - src/addons/write/components/WritePage.tsx (Side Panel page with 6 action buttons)
    - src/addons/write/registerWriteAddon.ts (registration function for page + templates)
    - tests/addons/write/writeSkills.test.ts (6 tests covering templates + registration)
  modified: []

key-decisions:
  - "6 Write skills registered as PromptManager templates with displayCategory: 'Writing', not as Agent tools (D-07)"
  - "WritePage uses vertical Card layout with block buttons — compact for Side Panel per D-09"
  - "Clicking a skill populates Sender via workspaceStore.setDraft('write', template) — no Full App page per D-09"
  - "registerWriteTemplates wraps createTemplate in try/catch for idempotent re-registration"
  - "WriteIcon from existing sider icons.tsx reused as nav icon"

patterns-established:
  - "Pattern: Add-on skills register as PromptTemplate configs with scopes: ['writing'], isBuiltin: false, and idempotent registration via try/catch"
  - "Pattern: Add-on Side Panel page renders quick-action buttons that populate the Sender via workspaceStore draft"

requirements-completed:
  - ADDON-06
  - ADDON-07

coverage:
  - id: D1
    description: "6 Write skill prompt templates (Rewrite, Summarize, Draft Customer Update, Draft Internal Note, Explain, Action Plan) registered in PromptManager with category 'Writing'"
    requirement: ADDON-06
    verification:
      - kind: unit
        ref: "tests/addons/write/writeSkills.test.ts#writeSkillTemplates array has exactly 6 entries"
        status: pass
      - kind: unit
        ref: "tests/addons/write/writeSkills.test.ts#all templates have category: Writing"
        status: pass
      - kind: unit
        ref: "tests/addons/write/writeSkills.test.ts#each template has required fields"
        status: pass
    human_judgment: false
  - id: D2
    description: "registerWriteTemplates() calls promptManager.createTemplate() for each skill (6 calls)"
    requirement: ADDON-06
    verification:
      - kind: unit
        ref: "tests/addons/write/writeSkills.test.ts#registerWriteTemplates calls createTemplate for each skill"
        status: pass
    human_judgment: false
  - id: D3
    description: "WritePage renders 6 quick-action buttons in a vertical Card layout in Side Panel"
    requirement: ADDON-07
    verification:
      - kind: unit
        ref: "src/addons/write/components/WritePage.tsx renders 6 buttons from writeSkillTemplates"
        status: pass
    human_judgment: false
  - id: D4
    description: "registerWriteAddon registers WritePage with sidepanelPageRegistry (order 10) and prompt templates"
    requirement: ADDON-07
    verification:
      - kind: unit
        ref: "src/addons/write/registerWriteAddon.ts registers page + templates"
        status: pass
    human_judgment: false
  - id: D5
    description: "Clicking a skill button populates the Sender with the corresponding prompt template text via workspaceStore.setDraft"
    requirement: ADDON-07
    verification:
      - kind: unit
        ref: "src/addons/write/components/WritePage.tsx handleSkillClick calls setDraft('write', template)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Write add-on is Side Panel only — no Full App page (D-09)"
    requirement: ADDON-07
    verification:
      - kind: unit
        ref: "src/addons/write/registerWriteAddon.ts uses sidepanelPageRegistry only, not standalonePageRegistry"
        status: pass
    human_judgment: false

duration: 1 min
completed: 2026-07-19
status: complete
---

# Phase 8 Plan 2: Write Add-on — Skills + Side Panel Page Summary

**6 Write skill prompt templates (PromptManager category 'Writing') with Side Panel page of quick-action buttons, registered via registerWriteAddon at startup — Side Panel only per D-09**

## Performance

- **Duration:** 1 min
- **Started:** 2026-07-19T12:02:58Z
- **Completed:** 2026-07-19T12:04:12Z
- **Tasks:** 2 (1 TDD with RED→GREEN cycle)
- **Files modified:** 4

## Accomplishments

- **6 Write skill prompt templates** created in `writeSkills.ts`: Rewrite, Summarize, Draft Customer Update, Draft Internal Note, Explain, Action Plan — each with `category: 'Writing'`, `isBuiltin: false`, `scopes: ['writing']`, and structured template text with variable placeholders
- **registerWriteTemplates()** iterates 6 templates, calls `promptManager.createTemplate()` with try/catch for idempotent re-registration
- **WritePage component** renders 6 action buttons in a vertical Card layout — clicking populates the Sender via `workspaceStore.setDraft('write', template)`
- **registerWriteAddon()** registers the WritePage with `sidepanelPageRegistry` at order 10 using the existing WriteIcon — Side Panel only per D-09, no Full App page
- **TDD compliance:** Task 1 followed RED→GREEN cycle with 6 passing tests

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): Write skill templates failing test** - `8efbcd6` (test)
2. **Task 1 (TDD GREEN): Write skill templates implementation** - `afe5a39` (feat)
3. **Task 2: WritePage Side Panel component + registration** - `a6dabd4` (feat)

**Plan metadata:** (committed after SUMMARY)

## Files Created

- `src/addons/write/skills/writeSkills.ts` (81 lines) — 6 PromptTemplate configs + registerWriteTemplates()
- `src/addons/write/components/WritePage.tsx` (38 lines) — Side Panel page with 6 quick-action buttons
- `src/addons/write/registerWriteAddon.ts` (22 lines) — Registration function for page + templates
- `tests/addons/write/writeSkills.test.ts` (74 lines, 6 tests) — Verifies templates shape and registration

## Decisions Made

- **6 Write skills as PromptManager templates, not Agent tools** (D-07): Keeps architecture lightweight — no ToolRegistry registration needed for prompt-transformation workflows
- **Card with block buttons layout** (D-09): Compact vertical stack fits Side Panel; follows ImportExportSection Card-based layout pattern
- **Draft-based Sender population**: `setDraft('write', template)` writes to workspaceStore; the ChatPage's Sender reads the draft — clean separation between WritePage and ChatPage
- **Idempotent registration**: try/catch on `createTemplate()` prevents errors on re-registration (e.g., during module hot-reload)
- **WriteIcon from existing icons.tsx**: Reuses the `write: WriteIcon` mapping already exported by `siderIcons`

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- **RED Gate:** Present — `test(08-02)` commit: 8efbcd6
- **GREEN Gate:** Present — `feat(08-02)` commits: afe5a39, a6dabd4
- **REFACTOR:** Not needed — implementation clean and minimal
- **Status:** All gates PASS

## Issues Encountered

None - both tasks executed cleanly with first-pass GREEN phase success. All 6 tests pass.

## User Setup Required

None - no external service configuration required. The registration function must be imported and called from `src/entrypoints/sidepanel/main.tsx` (and `src/entrypoints/standalone/main.tsx` if Full App support is added later).

## Next Phase Readiness

- Write add-on foundation complete: 6 prompt templates + Side Panel page + registration function
- Ready for integration: `registerWriteAddon()` needs to be imported in `sidepanel/main.tsx` after other add-on registrations
- WritePage Sender integration depends on ChatPage reading the `'write'` draft key from workspaceStore
- Next plan: 08-03 (TeamGQM add-on or ServiceNow add-on)

---

*Phase: 08-add-ons-data-portability*
*Completed: 2026-07-19*
