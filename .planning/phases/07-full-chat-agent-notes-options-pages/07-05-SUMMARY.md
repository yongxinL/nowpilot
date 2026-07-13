---
phase: 07-full-chat-agent-notes-options-pages
plan: 05
subsystem: notes
tags: [wikilinks, minisearch, d3-force, graph-visualization, backlinks, markdown]
requires:
  - phase: 07-01
    provides: d3-force@3.0.0, NotesDB, MiniSearchIndex patterns
provides:
  - LinkParser with wikilink parsing, 4-stage resolution pipeline, backlink computation, MiniSearch integration
  - NoteGraph data model + NoteGraphView d3-force interactive canvas component
  - NotesPage with 3-panel layout: NoteList (searchable), NoteEditor (split-pane), BacklinksPanel
  - NotePreview with resolved wikilink rendering
  - WikilinkAutocomplete with MiniSearch-ranked dropdown and "Create note" option
  - SaveToNoteDialog with create-or-append flow
  - SkillMessageRenderer and SourceCard for cross-cutting pattern reuse
  - Auto-versioning with Undo (np_note_versions key)
affects:
  - 07-03 (save-to-note integration in ChatPage)
  - 07-04 (SourceCard in Agent ThoughtChain)
tech-stack:
  added: []
  patterns:
    - MiniSearch class+singleton integration for note full-text search
    - d3-force with canvas ref for graph visualization
    - Auto-versioning via chrome.storage.local with np_note_versions key
    - Wikilink resolution: exact → case-insensitive → fuzzy → ambiguous → create-or-link
key-files:
  created:
    - src/core/notes/LinkParser.ts
    - src/core/notes/NoteGraph.ts
    - src/components/notes/NoteGraphView.tsx
    - src/core/pages/NotesPage.tsx
    - src/components/notes/NoteList.tsx
    - src/components/notes/NoteEditor.tsx
    - src/components/notes/NotePreview.tsx
    - src/components/notes/BacklinksPanel.tsx
    - src/components/notes/WikilinkAutocomplete.tsx
    - src/components/notes/SaveToNoteDialog.tsx
    - src/components/patterns/SkillMessageRenderer.tsx
    - src/components/patterns/SourceCard.tsx
    - tests/core/notes/LinkParser.test.ts
    - tests/core/notes/NoteGraph.test.ts
    - tests/components/NotesPage.test.tsx
  modified:
    - src/core/pages/NotesPage.tsx (replaced stub)
key-decisions:
  - "NoteGraph accepts notes with content and internally parses wikilinks — no extra parsing step needed by consumers"
  - "NoteGraphView uses raw d3-force with canvas rendering (not react-force-graph-2d) — keeps dependency footprint minimal. Drag, zoom, double-click navigation implemented directly."
  - "Auto-versioning uses chrome.storage.local np_note_versions key — simple stack with 10-version limit"
  - "WikilinkAutocomplete is a controlled component — parent manages visibility and cursor position for flexible integration"
  - "NotePreview renders resolved wikilinks as AntD Button links (unresolved shown with create? prompt)"
requirements-completed:
  - NOTE-01
  - NOTE-02
  - NOTE-03
  - NOTE-04
  - NOTE-05
  - NOTE-06
  - NOTE-07
coverage:
  - id: D1
    description: "LinkParser with wikilink regex parsing and resolution pipeline"
    requirement: NOTE-02
    verification:
      - kind: unit
        ref: "tests/core/notes/LinkParser.test.ts#parseLinks"
        status: pass
      - kind: unit
        ref: "tests/core/notes/LinkParser.test.ts#resolve"
        status: pass
    human_judgment: false
  - id: D2
    description: "NoteGraph d3-force data model with self-link and unresolved-link filtering"
    requirement: NOTE-04
    verification:
      - kind: unit
        ref: "tests/core/notes/NoteGraph.test.ts#buildGraphData"
        status: pass
    human_judgment: false
  - id: D3
    description: "NotesPage full UI: NoteList, NoteEditor, NotePreview, BacklinksPanel, NoteGraphView"
    requirement: NOTE-01
    verification:
      - kind: unit
        ref: "tests/components/NotesPage.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "MiniSearch full-text search with debounced 150ms queries (via LinkParser.search)"
    requirement: NOTE-05
    verification:
      - kind: unit
        ref: "tests/core/notes/LinkParser.test.ts#rebuildIndex and search"
        status: pass
    human_judgment: false
  - id: D5
    description: "BacklinksPanel showing referencing notes with context snippets"
    requirement: NOTE-03
    verification:
      - kind: unit
        ref: "tests/core/notes/LinkParser.test.ts#buildBacklinks"
        status: pass
    human_judgment: false
  - id: D6
    description: "SaveToNoteDialog with create-or-append flow"
    requirement: NOTE-06
    verification:
      - kind: other
        ref: "src/components/notes/SaveToNoteDialog.tsx contains Modal + createNote + append"
        status: pass
    human_judgment: false
  - id: D7
    description: "Auto-versioning with Undo via np_note_versions key"
    requirement: NOTE-07
    verification:
      - kind: other
        ref: "src/components/notes/NoteEditor.tsx contains np_note_versions"
        status: pass
    human_judgment: false
  - id: D8
    description: "WikilinkAutocomplete with MiniSearch-ranked dropdown"
    requirement: NOTE-02
    verification:
      - kind: other
        ref: "src/components/notes/WikilinkAutocomplete.tsx contains linkParser.search"
        status: pass
    human_judgment: false
  - id: D9
    description: "SkillMessageRenderer and SourceCard cross-cutting components"
    verification: []
    human_judgment: true
    rationale: "Visual verification required — these are UI pattern components whose correctness depends on rendered appearance"
duration: 5 min
completed: 2026-07-13
status: complete
---

# Phase 7 Plan 5: Full Notes Feature — LinkParser, NoteGraph, NotesPage, Auto-Versioning, Graph Visualization

**Complete Notes feature for Full App: wikilink parsing with MiniSearch resolution, d3-force graph visualization, split-pane editor with preview, backlinks panel, full-text search, auto-versioning with Undo, and supporting cross-cutting pattern components**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-13T11:41:01Z
- **Completed:** 2026-07-13T11:46:46Z
- **Tasks:** 4
- **Files modified:** 16 (12 created, 1 modified, 3 test files)

## Accomplishments

- **Task 1 (TDD):** LinkParser core service — wikilink regex parsing, 4-stage resolution pipeline (exact → case-insensitive → fuzzy → ambiguous → create-or-link), backlink computation with context snippets, MiniSearch full-text search with rebuild/add/remove, class + singleton export. 13 tests.
- **Task 2 (TDD):** NoteGraph data model (buildGraphData from notes with internal wikilink parsing) + NoteGraphView d3-force canvas component with drag, zoom, double-click navigation, 3-note minimum placeholder. 5 tests.
- **Task 3:** NotesPage (replaces stub) with 3-panel layout (240px NoteList | flex editor | 260px BacklinksPanel), NoteList with debounced MiniSearch search, NoteEditor with split-pane textarea + preview, auto-versioning with Undo via np_note_versions, NotePreview with resolved wikilink rendering. 3 tests.
- **Task 4:** WikilinkAutocomplete ([[ triggered, MiniSearch-ranked dropdown, keyboard navigation, "Create note" option), SaveToNoteDialog (create new or append to existing), SkillMessageRenderer (badged output with skill/macro tags), SourceCard (title + URL + snippet card). 21 total tests across all test files.

## Task Commits

Each task was committed atomically:

1. **Task 1 (TDD RED): LinkParser failing test** - `71f805c` (test)
2. **Task 1 (TDD GREEN): LinkParser implementation** - `dc8bb00` (feat)
3. **Task 2 (TDD RED): NoteGraph failing test** - `44d992c` (test)
4. **Task 2 (TDD GREEN): NoteGraph + NoteGraphView** - `ebb96d5` (feat)
5. **Task 3: NotesPage + NoteList + NoteEditor + NotePreview + BacklinksPanel** - `d7c65f1` (feat)
6. **Task 4: WikilinkAutocomplete + SaveToNoteDialog + SkillMessageRenderer + SourceCard** - `83bf79b` (feat)

## Files Created/Modified

### Created (12 source files + 3 test files)

- `src/core/notes/LinkParser.ts` — ParsedLink/ResolutionResult/BacklinkEntry/SearchResult types, LinkParser class with parseLinks, resolve, buildBacklinks, rebuildIndex, search, addToIndex, removeFromIndex. Singleton export.
- `src/core/notes/NoteGraph.ts` — NoteGraphNode/NoteGraphLink/GraphData types, NoteGraph class with buildGraphData (internal wikilink parsing, self-link + unresolved filtering). Singleton export.
- `src/components/notes/NoteGraphView.tsx` — d3-force force-directed graph with canvas rendering, drag, zoom, double-click navigation, ResizeObserver for container sizing. Placeholder for <3 notes.
- `src/core/pages/NotesPage.tsx` — 3-panel layout: NoteList (240px) | Editor/Graph | BacklinksPanel (260px). Async notes loading, index rebuild, backlink computation, graph view toggle.
- `src/components/notes/NoteList.tsx` — Searchable flat note list with 150ms debounced MiniSearch, sort by updated/created/title, +New Note button, Popconfirm delete.
- `src/components/notes/NoteEditor.tsx` — Split-pane: left Input.TextArea with monospace font, right NotePreview. Title input, Save/Undo toolbar. Auto-versioning (2s debounced) + NoteVersioner helper. Auto-save with version stack.
- `src/components/notes/NotePreview.tsx` — Content renderer with resolved/unresolved wikilink display via regex splitting.
- `src/components/notes/BacklinksPanel.tsx` — Collapsible panel listing backlinks with context snippet. Empty state: "No notes link here."
- `src/components/notes/WikilinkAutocomplete.tsx` — [[ triggered dropdown with MiniSearch ranking, arrow key navigation, Enter/Tab selection, "Create note" option.
- `src/components/notes/SaveToNoteDialog.tsx` — Modal dialog with create/append mode toggle, title input, note selector, content preview.
- `src/components/patterns/SkillMessageRenderer.tsx` — Badged output renderer for skill/macro execution results.
- `src/components/patterns/SourceCard.tsx` — Source reference card with clickable title, URL, snippet.
- `tests/core/notes/LinkParser.test.ts` — 13 tests: parseLinks (5), resolve (4), buildBacklinks (2), rebuildIndex/search (2).
- `tests/core/notes/NoteGraph.test.ts` — 5 tests: buildGraphData with wikilinks, empty, no links, self-link filter, unresolved filter.
- `tests/components/NotesPage.test.tsx` — 3 tests: render without crash, New Note button, empty state.

### Modified (1 file)

- `src/core/pages/NotesPage.tsx` — Replaced "Coming soon" stub with full Notes UI. Registered on ['standalone'] only.

## Decisions Made

- **NoteGraph accepts notes with content** and internally parses wikilinks — no separate parsing step needed by consumers. Self-links and unresolved links filtered out.
- **NoteGraphView uses raw d3-force with canvas rendering** (not react-force-graph-2d) — keeps dependency footprint minimal. Drag, zoom via canvas transform, double-click navigation implemented directly.
- **Auto-versioning uses chrome.storage.local np_note_versions key** — simple stack with 10-version limit. Undo saves current content as version before restoring previous.
- **WikilinkAutocomplete is a controlled component** — parent manages visibility and cursor position for flexible integration with textarea.
- **NotePreview uses regex-based wikilink splitting** rather than full XMarkdown rendering — keeps it dependency-light and focused on wikilink resolution.
- **NoteGraphView shows descriptive placeholder** when <3 notes exist (separate messages for 0 vs 1-2 notes).

## Deviations from Plan

None - plan executed exactly as written. All tests pass with 0 deviations.

## TDD Gate Compliance

- **Task 1 (LinkParser):** RED commit `71f805c`, GREEN commit `dc8bb00` — 13 tests passing
- **Task 2 (NoteGraph):** RED commit `44d992c`, GREEN commit `ebb96d5` — 5 tests passing
- **Status:** All gates PASS

## Issues Encountered

- **AntD 6.x deprecation warnings:** AntD Space `direction` prop and List component are deprecated in v6.5. Warning appears in tests but does not affect functionality. No fix needed — these are pre-existing third-party deprecations.
- **NotesPage tests required `getAllByText` instead of `findByText`** for "New Note" text because AntD renders it in multiple DOM locations (button text + potential text node). Switched to `getAllByText()` with `length > 0` assertion.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Notes feature is complete for Full App (standalone surface only)
- Ready for downstream integration: SaveToNoteDialog import in ChatPage (07-03), SourceCard in Agent ThoughtChain (07-04)
- Next plan: 07-06 (Options sections)
- All 7 Note requirements (NOTE-01 through NOTE-07) satisfied

## Self-Check: PASSED

- [x] All 12 source files exist on disk
- [x] All 3 test files exist on disk
- [x] All 6 commits verified in git log
- [x] 21 tests pass (13 + 5 + 3)
- [x] NotesPage no longer has "Coming soon" text
- [x] LinkParser exports class + singleton with WIKILINK_REGEX, MiniSearch, buildBacklinks
- [x] NoteGraph exports buildGraphData, NoteGraphView uses d3-force + canvas
- [x] NoteEditor contains np_note_versions auto-versioning
- [x] WikilinkAutocomplete uses linkParser.search
- [x] SaveToNoteDialog uses Modal + createNote/updateNote

---

*Phase: 07-full-chat-agent-notes-options-pages*
*Completed: 2026-07-13*
