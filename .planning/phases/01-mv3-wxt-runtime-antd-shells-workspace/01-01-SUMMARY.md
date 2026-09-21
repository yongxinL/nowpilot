---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 01
subsystem: planning
tags: [migration-inventory, d-04, prototype-conversion, wxt, mv3, conversion-map]

requires: []

provides:
  - "01-MIGRATION-INVENTORY.md — the frozen D-04 conversion map: 140 rows, 15 columns, covering every tracked prototype file"
  - "Per-row KEEP / ADAPT / REPLACE / REMOVE classification with the target canonical path and the owning Phase 1 plan id"
  - "D-16 disposition for all ten non-Phase-1 pages (fixture-preview / deferred-shell / remove)"
  - "Resolved hand-off decisions ledger: the eight Planner Handoff Checklist items plus OQ1-OQ7, each with decision, rationale, owner and deciding plan"
  - "Temporary-adapters ledger (none) and the D-04 six-field change-control rule"

affects:
  - "01-02 … 01-13 — every plan cites inventory rows by Current path instead of duplicating the table"
  - "phase-1-verification — the D-04 verifier checklist is measured against this artifact"

actuals:
  tokens: 23365
  tasks: 3
  commits: 4
  plan_head_before: 51e0ef9a7f930458ce0d1051e75f3107abb87c29

tech-stack:
  added: []
  patterns:
    - "D-04 conversion-map conventions: 15 fixed columns, `—` for no-value cells, no TBD/TBC/none/? tokens anywhere"
    - "Audit-universe enumeration with `git ls-files` (never a working-tree scan) plus an explicit generated-mirror exclusion list"
    - "Every non-KEEP row names exactly one owning plan; every KEEP row's target is byte-identical to its current path"

key-files:
  created:
    - .planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-MIGRATION-INVENTORY.md
  modified: []

key-decisions:
  - "Content-script path resolves to src/entrypoints/content/index.ts (matches WXT's content/index.[jt]s?(x) glob and preserves §5.1's directory intent); operator checkpoint in 01-03"
  - "`.dark`-class rule scoped to AntD; src/index.css keeps the class for its hand-written selectors (OQ2)"
  - "WorkspaceState carries all three of schemaVersion (shape), version (Phase-2 write counter) and updatedAt (staleness) (OQ3)"
  - "AntD/X packages stay exactly pinned with no bump in Phase 1; CSP narrows to connect-src 'none'; permissions stay ['sidePanel','storage','tabs'] (OQ4/OQ5/A4)"
  - "Ready/transfer/ack handoff messages ride a separate HandoffEnvelope union on BroadcastBus, not MessageType (OQ6)"
  - "Runtime-envelope literals realign to OPEN_SIDE_PANEL / OPEN_STANDALONE with the five scaffold-local literals separated (OQ7)"
  - "The copy-exact prototype hosts are REPLACE (OnboardingModal, aiProvider, useExtensionStore, types) and the unreachable prototype hosts are REMOVE, while presentation-only chat atoms are KEEP as unmounted components"
  - "TeamsPanel is REMOVE (TeamGQM is a flag-gated add-on outside the canonical Main set); the preserved Notes/Options/Write/Tools/History pages are fixture-preview under 01-12"

patterns-established:
  - "Inventory rows are the single conversion authority: plans reference rows by Current path, and any post-freeze classification change carries all six change-control fields"
  - "Fixture-preview pages render deterministic local fixtures and may never simulate a successful provider, persistent or destructive operation"
  - "Deferred page shells name their owning roadmap phase and never render a perpetual skeleton"

requirements-completed: [CORE-01]

coverage:
  - id: D1
    description: "Frozen D-04 conversion map exists at the required path, git-tracked, with all fifteen column names and one row per tracked prototype file"
    requirement: CORE-01
    verification:
      - kind: other
        ref: "test -f .planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-MIGRATION-INVENTORY.md && grep -c '^|' = 178"
        status: pass
      - kind: other
        ref: "coverage check: git ls-files src entrypoints tests scripts (114 paths) all present as Current path rows; nine root config files present; public icons named in their grouped row"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every ADAPT/REPLACE/REMOVE row names exactly one owning plan id (all twelve used); every KEEP row's target equals its current path; every REMOVE row's removal timing names its plan"
    requirement: CORE-01
    verification:
      - kind: other
        ref: "grep -Eo '\\| 01-(0[2-9]|1[0-3]) ' | sort -u | wc -l = 12; grep -cE '\\| *(TBD|TBC|none|\\?) *\\|' = 0"
        status: pass
      - kind: other
        ref: "freeze checks: assignment problems [], duplication groups [], target-discipline problems []"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-16 page disposition table (10 pages, one disposition each), eight resolved hand-off checklist items plus OQ1-OQ7, and the Temporary adapters section"
    requirement: CORE-01
    verification:
      - kind: other
        ref: "section presence probes: 'Non-Phase-1 page disposition', 'fixture-preview', 'deferred-shell', 'Resolved hand-off decisions', 'Temporary adapters', 'data-np-backing' all found; 10 D-16 rows and 16 hand-off rows parsed"
        status: pass
    human_judgment: false
  - id: D4
    description: "Classification and plan-assignment correctness — each prototype module's KEEP/ADAPT/REPLACE/REMOVE decision and owning plan match the canonical contract and the downstream plans"
    requirement: CORE-01
    verification: []
    human_judgment: true
    rationale: "The mechanical probes prove the table is complete, well-formed and internally consistent; they cannot prove each conversion decision is the right one. That is a planning judgment the phase verifier must sample against the repository (and plans 01-02…01-13 must honour)."

duration: 10min
completed: 2026-09-21
status: complete
---

# Phase 1 Plan 01: MV3/WXT Runtime + AntD Shells + Workspace — Migration Inventory Summary

**Frozen D-04 conversion map: 140 prototype files classified KEEP/ADAPT/REPLACE/REMOVE, each assigned to one of plans 01-02…01-13, with ten page dispositions and all eight hand-off decisions resolved**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-09-21T11:30:02Z
- **Completed:** 2026-09-21T11:40:01Z
- **Tasks:** 3
- **Files modified:** 1 (created)

## Accomplishments

- `01-MIGRATION-INVENTORY.md` exists at the D-04 path, is git-tracked, and is committed on its own so the gate is independently revertible (`aa6dcd9`).
- The fifteen-column conversion map classifies **140 rows** — KEEP 47 · ADAPT 69 · REPLACE 5 · REMOVE 19 — covering all 114 paths from `git ls-files src entrypoints tests scripts`, the nine named root config files, and the eight `public/` icons (grouped into one row that names every file).
- Every `ADAPT`/`REPLACE`/`REMOVE` row names exactly one owning plan, all twelve ids `01-02`…`01-13` are referenced, every `KEEP` row's target is its current path, and every `REMOVE` row's removal timing names its plan.
- The D-16 table disposes all ten non-Phase-1 pages: two deferred shells (Chat, Agent — owning roadmap phase 15), five fixture previews (Notes 8, Options 15, History 15, Write 17, Tools 18), and three removals (the two duplicate page stubs and the Teams panel).
- All eight research hand-off checklist items plus research Open Questions 1-7 are resolved with decision, rationale, owner marker and deciding plan; the temporary-adapters ledger records that no compatibility shim survives the phase.
- The freeze block records the four D-04 verifier checks (coverage, assignment, duplication, target-path discipline) and their observed results, and the change-control section freezes classifications behind a six-field record and operator review for material architecture changes.

## Task Commits

Each task was committed atomically:

1. **Task 1: Enumerate and classify every relevant prototype file** — `54ce815` (docs) — 140-row table, empty assignment column, statuses `pending`
2. **Task 2: Assign every row to a plan, assign D-16 dispositions, resolve the eight hand-off decisions** — `2f02610` (docs)
3. **Task 3: Freeze-validate the inventory against the plan set and commit it as the D-04 gate** — `aa6dcd9` (docs), plus the in-scope tightening commit `8c7b727` (docs: restrict `## Explicitly excluded` to the four permitted generated-mirror entries)

**Plan metadata:** `_pending_` (docs: complete plan)

## Files Created/Modified

- `.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-MIGRATION-INVENTORY.md` — the frozen D-04 conversion map: header and classification rule, `## Freeze status`, the 140-row fifteen-column table, `## Explicitly excluded`, `## Non-Phase-1 page disposition (D-16)`, `## Resolved hand-off decisions`, `## Temporary adapters`, `## Change control`.

## Decisions Made

- **Classification policy applied:** a module is KEEP only when its path, responsibility and dependencies already satisfy the canonical contract and no plan needs to touch it; the four provider-prototype files are REPLACE→`01-09` (T-1-03); the unreachable prototype hosts (`SidepanelChat`, `useChatStreaming`, `ChatComposer`, `OnboardingModal`, `ThemeProvider`, `WorkflowSelector`, `PromptManagerModal`, `ModelSelector`, `tailwindEquivalents`, the Vite shell) are REMOVE.
- **Presentation-only chat atoms are KEEP (unmounted):** `AttachmentBar`, `ChatExportBar`, `ChatHeader`, `ChatMessageItem`, `ChatMessageList`, `FollowupSuggestions`, `PinnedTabsBar`, `SlashCommandModal`, `StructuredErrorCard`, `TabContextSelector`, `ThoughtProcessBlock` carry no provider, credential or model-selector coupling, and D-03 forbids deleting reusable components — matching the phase's treatment of `MirrorBanner` and `ThemeToggle`.
- **Rows not named in any plan's `files_modified` were assigned to the plan whose scope legally covers them:** `metadata.json`/`PromptManagerModal`/`WorkflowSelector` → `01-11` (prototype-host retirement); `ModelSelector`/`WriteInputPanel`/`WriteHistoryDrawer`/`PromptsOptionsTab` → `01-12` (the fixture pass that must replace their prohibited or store-backed behaviour); all removals name their removal timing so the executor honours them.
- **NEW-file rows:** 14 new canonical `src/**` files and 2 new `tests/**` files are enumerated with `—` as their current path, which is what gives `01-03`, `01-10` and `01-13` their cited rows.
- **`metadata.json` classified REMOVE** as an incompatible AI-Studio applet assumption (D-01 REMOVE criterion); `pnpm-lock.yaml`, `README.md`, `LICENSE` and the planning trees are recorded as outside the audit universe rather than as exclusions.

## Deviations from Plan

None — the plan executed exactly as written. Two in-scope self-corrections during Task 1/Task 3 were caught by the plan's own acceptance probes and fixed before the relevant commit landed:

- The `Assigned Phase 1 plan` column initially carried `—` on KEEP rows during Task 1; the plan requires every cell to be **empty** until Task 2, so the column was cleared before the Task 1 commit.
- `## Explicitly excluded` initially listed `pnpm-lock.yaml`, `README.md`, `LICENSE` and the planning trees; Task 3 permits only the generated-mirror entries, so they were moved to an out-of-universe note (`8c7b727`).

## Issues Encountered

- The public-icon row originally embedded the eight enumerated paths in its `Current path` cell, which broke the KEEP target-equals-current invariant; the enumeration now lives in the responsibility cell so the path cell is exactly `public/assets/icons/*.png`.
- Generic responsibility wording initially repeated across several KEEP rows; each was rewritten to name its distinct capability so the freeze duplication check is meaningful rather than vacuous.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The D-04 gate is closed: plans `01-02` … `01-13` are unblocked and each references inventory rows by `Current path` rather than duplicating the table.
- Downstream obligations recorded in the artifact: `01-02` owns the `srcDir` relocation and all four KEEP/ADAPT/REMOVE page rows it re-points; `01-03` owns the content-script operator checkpoint (H-1) and the manifest gate; `01-05` updates the `ThemeProvider`/`ThemeToggle` rows; `01-11`, `01-12` and `01-13` update `Implementation status`/`Verification status` as their work lands, and any classification change must carry all six change-control fields.
- The inventory must not be treated as evidence that the conversion is done — it is the map; the phase verifier checks the repository against it at `01-13`.

---

*Phase: 01-mv3-wxt-runtime-antd-shells-workspace*
*Completed: 2026-09-21*

## Self-Check: PASSED

- Created file exists: `.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-MIGRATION-INVENTORY.md` — FOUND
- Commits exist: `54ce815`, `2f02610`, `aa6dcd9`, `8c7b727` — FOUND
- All plan `<verify>` probes (Tasks 1-3) — GREEN (178 `^|` rows; no MISSING columns; artifact tracked; 12 unique plan ids; 0 placeholder tokens; all six section strings present; latest commit for the artifact contains `01-01` and `migration inventory`)
- Freeze counts consistent: KEEP 47 + ADAPT 69 + REPLACE 5 + REMOVE 19 = Rows 140
