---
phase: 05-knowledge-base-memory-minisearch-notes
plan: 07
subsystem: ui
tags: [wikilinks, backlinks, autocomplete, minisearch, antd, react, notes-workspace]

# Dependency graph
requires:
  - phase: 05-05
    provides: LinkParser (parseLinks/resolveLinks/promoteUnresolvedLinks), NoteGraph (backlinkIndex/resolveDanglingOnDelete), MiniSearchIndex (buildNotesIndex/searchNotes/addToNotesIndex/removeFromNotesIndex)
  - phase: 05-01
    provides: STR.notes.* canonical copy keys, EventBus 'note:saved' event vocabulary
  - phase: 04a
    provides: PageContentService → PageContext (currentPageContext, D-05-13 / SC#5)
provides:
  - PortableMarkdown optional `wikilinks` prop (Open Q4) — safe post-sanitize wikilink substitution
  - BacklinksPanel — derived in-links via NoteGraph.backlinkIndex (D-05-17)
  - WikilinkAutocomplete — anchored combobox with binding a11y contract (Open Q5)
  - NotesPage — the real Standalone Notes workspace (list + editor + search + D-05-15 save pipeline + star + delete + dirty guard + new-note-from-page)
  - WorkspaceStore.toggleSelectedNote — D-18 selectedNotes activated as the favorites set
affects: [05-08 (NoteGraphView wires into NotesPage Graph view + records the dropdown max-height verify outcome), 05a (Inspector/backlinks relocation, LLM-Wiki), Phase 8 (search-notes tool consumers)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Safe post-sanitize DOM-walk substitution: [[Title]] spans tokenized into PUA placeholder tokens BEFORE DOMPurify.sanitize; after XMarkdown renders (escapeRawHtml on), a programmatic DOM walk maps tokens to elements built with createElement/setAttribute/textContent only — never dangerouslySetInnerHTML, never raw HTML passthrough (T-05-24)"
    - "Controlled combobox with imperative keydown handle: the page owns trigger/caret state; the component is a pure listbox+anchor renderer exposing handleKeyDown (forwardRef + useImperativeHandle) and buildAnchorA11y for the real input"
    - "Never-throw write verification via post-condition re-read: NotesDB functions swallow failures (Golden Rule 9), so save/delete failures are detected by re-reading the row (putNote→getNote, deleteNote→getNote) to surface STR.notes.saveFailed/deleteFailed"
    - "Fire-and-forget reconciliation reading fresh DB state: WIKI-ID-03 promotion queries listNotes inside the task, never the closure's allNotes (stale-closure race)"

key-files:
  created:
    - src/components/notes/BacklinksPanel.tsx
    - src/components/notes/WikilinkAutocomplete.tsx
    - tests/components/notes/BacklinksPanel.test.tsx
    - tests/components/notes/WikilinkAutocomplete.test.tsx
    - tests/components/pages/NotesPage.test.tsx
  modified:
    - src/core/components/PortableMarkdown.tsx
    - src/components/pages/NotesPage.tsx
    - src/core/workspace/WorkspaceStore.ts

key-decisions:
  - "Wikilink substitution is a post-sanitize programmatic DOM walk (tokenize → sanitize → render → walk), keeping DOMPurify.sanitize unconditional + escapeRawHtml on (R-10/T-1-07, Open Q4)"
  - "WikilinkAutocomplete is a custom anchored popover (Open Q5): the page owns trigger/caret state and forwards TextArea keydowns via an imperative handle; dropdown max-height 320px + internal scroll (planner assumption — 05-08 gate records the verify outcome)"
  - "toggleSelectedNote routes through the store's update() journaled path instead of the plan's literal raw set() — the raw set would bypass version bump + np_workspace persistence (star would not persist across surfaces)"
  - "Write-path failures detected by post-condition re-read since NotesDB never throws"
  - "WIKI-ID-03 save-time reconciliation reads candidates fresh from the DB (stale-closure fix)"
  - "Plan-literal spec-named copy used where no canonical STR key exists: 'Edit'/'Preview' Segmented labels (UI-SPEC L185), 'Untitled' title fallback (UI-SPEC L239), antd default OK/Cancel Popconfirm buttons"

patterns-established:
  - "Markdown renderer extension via optional prop + inert token placeholder (default undefined → byte-identical consumers)"
  - "Combobox a11y contract via exported anchor-attr builder + stable listbox id the real input references"
  - "Component tests drive the real NotesDB (fake-indexeddb fresh factory) + real EventBus singleton with in-test subscriber"

requirements-completed: [KNW-01, KNW-02, KNW-03]

coverage:
  - id: D1
    description: "PortableMarkdown optional wikilinks prop (Open Q4): resolved [[Title]] renders as colorPrimary link, unresolved muted/dashed + 'Create note' affordance; DOMPurify sanitization stays unconditional"
    requirement: KNW-02
    verification:
      - kind: unit
        ref: "tests/components/notes/BacklinksPanel.test.tsx#PortableMarkdown — wikilinks prop"
        status: pass
      - kind: unit
        ref: "tests/components/PortableMarkdown.test.tsx#sanitizes raw HTML"
        status: pass
    human_judgment: false
  - id: D2
    description: "BacklinksPanel: derived in-links via NoteGraph.backlinkIndex, collapsible section, empty/count states, row click → onOpenNote"
    requirement: KNW-02
    verification:
      - kind: unit
        ref: "tests/components/notes/BacklinksPanel.test.tsx#BacklinksPanel — derived in-links"
        status: pass
    human_judgment: false
  - id: D3
    description: "WikilinkAutocomplete anchored combobox (Open Q5): listbox/option rendering, keyboard wrap/insert/close via handle, silent close on empty matches, binding a11y anchor attributes"
    requirement: KNW-01
    verification:
      - kind: unit
        ref: "tests/components/notes/WikilinkAutocomplete.test.tsx#WikilinkAutocomplete"
        status: pass
    human_judgment: false
  - id: D4
    description: "NotesPage workspace behaviors: D-05-15 save pipeline (parse→resolve→put→note:saved→index add), unresolved + WIKI-ID-03 promotion, delete + WIKI-ID-04 reconciliation + failure toast, star persistence (D-18), dirty guard, MiniSearch search filter, new-note-from-page (D-05-13/SC#5)"
    requirement: KNW-03
    verification:
      - kind: unit
        ref: "tests/components/pages/NotesPage.test.tsx#NotesPage — real Notes workspace"
        status: pass
    human_judgment: false
  - id: D5
    description: "NotesPage visual/UX adequacy — list/editor two-pane layout, dropdown anchoring below the TextArea, Popconfirm interactions, card styling per UI-SPEC Visual Hierarchy"
    requirement: KNW-03
    verification: []
    human_judgment: true
    rationale: "jsdom cannot assert visual layout, positioning, or styling; the UI-SPEC rows need human sign-off at verify time (05-08 gate also confirms the autocomplete max-height assumption)"

# Metrics
duration: 37min
completed: 2026-08-14
status: complete
---

# Phase 5 Plan 7: Notes Workspace Summary

**The E5 placeholder becomes the real Standalone Notes workspace: PortableMarkdown wikilink extension (Open Q4), BacklinksPanel + WikilinkAutocomplete (Open Q5) with the binding a11y combobox contract, and the full NotesPage (list + editor + MiniSearch search + D-05-15 save pipeline + star via WorkspaceStore.selectedNotes + delete with WIKI-ID-04 reconciliation + dirty guard + new-note-from-page) — all copy via STR.notes.*, all 3 component test files green and the full suite at 101 files / 909 tests.**

## Performance

- **Duration:** 37 min
- **Started:** 2026-08-14T01:40:01Z
- **Completed:** 2026-08-14T02:17:24Z
- **Tasks:** 3
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments

- PortableMarkdown gains the optional `wikilinks?: { resolve, onOpen, onCreate }` prop (default undefined → byte-identical for existing consumers): `[[Title]]` spans are tokenized into inert PUA placeholder tokens before DOMPurify.sanitize, and after XMarkdown renders (escapeRawHtml on), a programmatic DOM walk substitutes safe elements — resolved = `data-np-wikilink` colorPrimary link (href `#note-{id}`, click → onOpen), unresolved = `data-np-wikilink-unresolved` muted/dashed with the STR.notes.createNote affordance (click → onCreate, WIKI-ID-03). Sanitization is proven unconditional (script-injection test passes with and without the prop).
- BacklinksPanel ships (D-05-17): in-links derived on demand via `NoteGraph.backlinkIndex`, collapsible section (STR.notes.backlinks + accent Badge count), rows = title 14/600 + 2-line-clamp snippet, row click → onOpenNote, empty → STR.notes.backlinksEmpty.
- WikilinkAutocomplete ships (Open Q5): custom anchored popover (antd AutoComplete's text-input coupling fights caret insertion), controlled listbox+anchor renderer with the page owning trigger/caret state; keyboard ↑/↓ wrap + Enter/Tab insert + Esc close via an imperative handle the page forwards TextArea keydowns to; `buildAnchorA11y` exported so the TextArea announces aria-haspopup/expanded/controls/activedescendant (the binding contract); silent close on zero matches; MAX_DROPDOWN_HEIGHT 320px + internal scroll (planner assumption — 05-08 gate confirms).
- NotesPage is the real workspace (D-05-16/17): header search (allowClear) + Notes|Graph Segmented + New-note-from-page ghost (gated on currentPageContext) + New note; list column (~300px, cards sorted updated desc with title/star/snippet/tags/relative time, empty/loading/error/searchEmpty/results-count); editor column (title 20/600 borderless + star + Edit|Preview + dirty caption + Save Note + delete Popconfirm + tag chips; TextArea with '[[ ' autocomplete / PortableMarkdown preview; BacklinksPanel below). Save pipeline runs D-05-15 verbatim: parseLinks → resolveLinks → putNote → `note:saved` → incremental index add; failures surface as STR.notes.saveFailed inline Retry (draft retained) via post-condition re-read (never-throw contract); WIKI-ID-03 save-time reconciliation promotes matching unresolvedLinks (fire-and-forget, DB-fresh candidate set). Delete runs WIKI-ID-04 dangling-edge reconciliation + index rebuild; failure → STR.notes.deleteFailed toast. Star persists via WorkspaceStore.toggleSelectedNote (D-18 selectedNotes activation). Dirty guard Popconfirms on selection/graph switches; Cmd/Ctrl+S saves; New note = clean empty draft (Save disabled until typed); new-note-from-page pre-fills title/markdown with source.kind 'page-export' (D-05-13 / SC#5 end-to-end Page → PageContentService → Note → MiniSearch).

## Task Commits

Each task was committed atomically:

1. **Task 1: PortableMarkdown wikilinks (Open Q4) + BacklinksPanel** — `62e3c98` (feat)
2. **Task 2: WikilinkAutocomplete — anchored combobox (Open Q5)** — `c9c28e9` (feat)
3. **Task 3: NotesPage — real workspace (list + editor + search + save pipeline + star + delete)** — `193697b` (feat)
4. **Follow-up: autocomplete listId prop for the TextArea anchor wiring + prettier normalization** — `2fc324e` (feat)

## Files Created/Modified

- `src/core/components/PortableMarkdown.tsx` - `wikilinks?` optional prop + PUA-token pre-processing + post-sanitize programmatic DOM-walk substitution (DOMPurify + escapeRawHtml unchanged)
- `src/components/notes/BacklinksPanel.tsx` - derived in-links panel (backlinkIndex, collapsible, empty/count, onOpenNote rows)
- `src/components/notes/WikilinkAutocomplete.tsx` - controlled anchored combobox (role=listbox/option, buildAnchorA11y, imperative keydown handle, MAX_DROPDOWN_HEIGHT 320)
- `src/components/pages/NotesPage.tsx` - E5 placeholder replaced by the full workspace (header/list/editor/save/delete/star/dirty/search/autocomplete/backlinks)
- `src/core/workspace/WorkspaceStore.ts` - `toggleSelectedNote(noteId)` action (D-18 selectedNotes activation via the journaled update path)
- `tests/components/notes/BacklinksPanel.test.tsx` - backlinks rows/empty/click + PortableMarkdown wikilink resolved/unresolved/byte-identical/sanitize tests
- `tests/components/notes/WikilinkAutocomplete.test.tsx` - listbox/option + activedescendant, keyboard wrap/insert/close, silent close, click insert, anchor a11y
- `tests/components/pages/NotesPage.test.tsx` - 9 scenarios over real fake-indexeddb NotesDB + real EventBus

## Decisions Made

- Wikilink substitution mechanism: tokenize → sanitize → render → programmatic DOM walk (never dangerouslySetInnerHTML), keeping sanitization unconditional (Open Q4 / T-05-24).
- Autocomplete widget: custom anchored popover with an imperative keydown handle + exported anchor-a11y builder (Open Q5); the page spreads the a11y contract onto the TextArea with a stable shared listbox id.
- `toggleSelectedNote` routes through `update()` (version bump + journaled np_workspace write + WORKSPACE_UPDATED) — the plan's raw `set()` sketch would have bypassed persistence (star not durable).
- Never-throw write surfaces: save/delete failures detected by post-condition re-reads and surfaced via STR.notes.saveFailed inline Retry / STR.notes.deleteFailed toast.
- Graph view placeholder for 05-07: the Segmented Graph pane renders STR.notes.graphEmpty (canonical copy) — NoteGraphView (d3-force) lands in 05-08 and replaces it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] toggleSelectedNote routed through update() instead of the plan's raw set()**
- **Found during:** Task 3 (WorkspaceStore action)
- **Issue:** The plan's literal `set((s) => ({ workspace: {...} }))` bypasses the store's D-06 mutation contract — no version bump, no np_workspace journaled write, no WORKSPACE_UPDATED broadcast → the star would NOT persist, violating the "star toggles persist" truth.
- **Fix:** Implemented via `get().update((draft) => ...)` (immer + version bump + journaled write), matching every other workspace mutation.
- **Files modified:** src/core/workspace/WorkspaceStore.ts
- **Verification:** Star test asserts `useWorkspaceStore.getState().workspace.selectedNotes` membership both ways; WorkspaceStore suite + full suite green.
- **Committed in:** 193697b

**2. [Rule 1 - Bug] WIKI-ID-03 reconciliation read stale allNotes from the closure**
- **Found during:** Task 3 (reconcile test)
- **Issue:** `reconcileAfterSave` filtered the render-closure `allNotes`, which can predate the note:saved refresh of the just-saved note (the reconciliation of a freshly created note never found its referrers) — proven by the unresolved→promote test failing with links[] not updated.
- **Fix:** Candidate set read fresh via `listNotes(db)` inside the reconciliation task (bounded — exact candidate set).
- **Files modified:** src/components/pages/NotesPage.tsx
- **Verification:** Reconcile test passes (earlier note's links[] gains the new id, unresolvedLinks emptied); full suite green.
- **Committed in:** 193697b

**3. [Rule 1 - Type-correctness] BacklinksPanel props widened to include 'links'**
- **Found during:** Task 1
- **Issue:** The plan's literal `Pick<Note, 'id' | 'title' | 'content'>` omits the `links` field `NoteGraph.backlinkIndex` requires → tsc error.
- **Fix:** Props typed `Pick<Note, 'id' | 'title' | 'content' | 'links'>` (Note always carries links; no behavior change).
- **Files modified:** src/components/notes/BacklinksPanel.tsx
- **Verification:** tsc --noEmit green.
- **Committed in:** 62e3c98

**4. [Rule 2 - Missing Critical] Never-throw write failures surfaced via post-condition re-read**
- **Found during:** Task 3 (save/delete pipelines)
- **Issue:** NotesDB putNote/deleteNote never throw (Golden Rule 9) — the plan requires visible STR.notes.saveFailed/deleteFailed failure paths, but nothing propagates an error to detect.
- **Fix:** After putNote → re-read getNote (absent → saveFailed + draft retained); after deleteNote → re-read getNote (present → deleteFailed toast). Delete-failure test spies deleteNote as a no-op and asserts the toast.
- **Files modified:** src/components/pages/NotesPage.tsx
- **Verification:** Save/delete failure paths covered in NotesPage.test.tsx; full suite green.
- **Committed in:** 193697b

**5. [Rule 1 - Deviation] Delete affordance is a direct icon button + Popconfirm, not the '⋯ More' Dropdown**
- **Found during:** Task 3 (editor header)
- **Issue:** The UI-SPEC '⋯ More → Delete' overflow menu needs a 'Delete' menu-item label, but no canonical STR.notes key exists for it (Golden Rule 2 forbids inventing inline copy).
- **Fix:** Direct DeleteOutlined icon Button + Popconfirm in the editor header (icon-only control with aria-label + Tooltip per the UI-SPEC icon-only accessibility rule; STR.notes.deleteConfirm is the only canonical delete string). The Delete Popconfirm OK uses antd default labels (see #7).
- **Files modified:** src/components/pages/NotesPage.tsx
- **Verification:** Delete tests (success + failure toast) pass.
- **Committed in:** 193697b

**6. [Rule 3 - Command-line] Plan verify paths for PortableMarkdown tests point at a nonexistent directory**
- **Found during:** Task 1 verify
- **Issue:** Plan verification runs `tests/components/core/PortableMarkdown.test.tsx` — the canonical test home is `tests/components/PortableMarkdown.test.tsx` (Phase-1 documented path); `tests/components/core/` does not exist.
- **Fix:** Ran the real path; the wikilink-prop tests live in `tests/components/notes/BacklinksPanel.test.tsx` per the plan's Task-1 action. Command-line only, no source impact.
- **Verification:** Both files green (10 tests).
- **Committed in:** 62e3c98

**7. [Spec-STR gap - documented] Spec-named copy without canonical STR keys used verbatim**
- **Found during:** Task 3
- **Issue:** UI-SPEC names 'Edit'/'Preview' Segmented labels (L185), the 'Untitled' title fallback (L239), and Popconfirm buttons 'Discard (danger)/Keep editing' (L141) + 'Delete' — none exist in the 05-01 STR.notes key set, and the UI-SPEC Copywriting Contract (the canonical key source) does not list them.
- **Fix:** Used the spec-verbatim literals ('Edit', 'Preview', 'Untitled') and antd default OK/Cancel Popconfirm buttons — no invented copy, no new STR keys (which would violate the '05-01 keys verbatim' constraint). Flagged for the 05-08 gate / spec reconciliation.
- **Files modified:** src/components/pages/NotesPage.tsx
- **Verification:** All copy greps + tests green.
- **Committed in:** 193697b

**8. [Path reconciliation - documented] PortableMarkdown modified at its canonical home**
- **Found during:** Task 1
- **Issue:** Plan's files_modified lists `src/components/core/PortableMarkdown.tsx`; the real file (Phase-1 documented decision) is `src/core/components/PortableMarkdown.tsx`.
- **Fix:** Modified the real file; acceptance greps (wikilinks?, DOMPurify.sanitize, escapeRawHtml) verified there.
- **Committed in:** 62e3c98

---

**Total deviations:** 8 (5 auto-fixed Rule 1/2 items, 1 command-line Rule 3, 2 documented spec/path gaps)
**Impact on plan:** All auto-fixes were necessary for correctness (persistence, reconciliation race, type-correctness, visible failure paths). The spec-STR gap (Edit/Preview/Untitled/button labels) and the ⋯ More → Delete affordance substitution are flagged for the 05-08 gate — no scope creep, no new storage keys, no banned surfaces.

## Issues Encountered

- antd Badge/Popconfirm/Segmented require ResizeObserver/IntersectionObserver, absent in jsdom — stubbed per test following the ChatPage.test.tsx precedent.
- Controlled combobox stale-closure: the test for keyboard navigation must drive the real controlled cycle (re-render with the new `highlighted` prop) — the page pattern, not a bare ref call.
- MiniSearch prefix search: the test query 'zzz-no-match' tokenizes to 'no', which prefix-matches 'note' → list not empty; retargeted to 'xyzzy' (documented in-test).
- Async delete-handler tail state updates raced the next test action — synchronized the test on the selectNote UI state before proceeding.

## Known Stubs

- **Graph view placeholder** (`src/components/pages/NotesPage.tsx`, view === 'graph' branch): renders STR.notes.graphEmpty centered — intentional; NoteGraphView (d3-force) wires into this pane in 05-08 (plan split: 05-07 owns the Segmented + onOpenNote navigation; 05-08 replaces the placeholder).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-08 (NoteGraphView) can wire the Graph pane directly: NotesPage owns the Segmented Notes|Graph state + `handleOpenNote` (select + switch to Notes view) — the single navigation contract NoteGraphView consumes.
- 05-08 gate records the autocomplete dropdown max-height assumption outcome (implemented at 320px as planned).
- Spec reconciliation flagged: 'Edit'/'Preview'/'Untitled' literals and the ⋯ More → Delete affordance need canonical STR keys (or explicit UI-SPEC carve-out) before the phase gate's copy audit.
- KNW-01/02/03 surfaces shipped; KNW-04/05 remain core-only (no UI per D-05-18).

---
*Phase: 05-knowledge-base-memory-minisearch-notes*
*Completed: 2026-08-14*

## Self-Check: PASSED

- All 8 plan output files exist on disk (verified `[ -f ]`).
- All 4 task commits exist in git history: `62e3c98`, `c9c28e9`, `193697b`, `2fc324e`.
- Full suite green: 101 files / 909 tests (`pnpm vitest run`).
- `pnpm exec tsc --noEmit` exit 0.
- eslint exit 0 on all touched files; prettier --check clean after normalization.
