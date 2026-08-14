---
phase: 05-knowledge-base-memory-minisearch-notes
plan: 10
subsystem: notes UI + context optimizer + hook wiring
tags: [notes-page, dirty-guard, context-optimizer, use-streaming-llm, wikilink-autocomplete, backlinks-panel, note-graph-view, gap-closure]

# Dependency graph
requires:
  - phase: 05-knowledge-base-memory-minisearch-notes
    provides: combined memory budget seam in MemoryEngine.assemble (05-09), WorkspaceStore D-18 serialization set (05-09/Phase 1), NoteGraph.edges + NotesPage save pipeline (05-07/05-08)
provides:
  - CR-02 closed: every dirty-draft navigation path (New note, New note from page, BacklinksPanel rows, Preview wikilinks) routes through ONE guardedNavigate helper + shared discard Popconfirm
  - WR-02 closed: the degradation ladder shares a single reduced-hints source — reduce-topk and minimal-mode consume the same top-3 memory set, no spurious CONTEXT_TOO_LARGE
  - WR-07 closed: prefs assigned before the renderer upfront invocation — the renderer privacy mode derives from the real planner-injection preferences
  - WR-03 closed: NOTE_LINK_PARSE_FAILED logged only at the parse boundary; putNote/getNote/reconcile failures log STORE_WRITE
  - WR-04 closed: all five Phase-5 canonical codes now have live call sites (SEARCH_INDEX_REBUILD_FAILED at index rebuilds, NOTE_GRAPH_FAILED at graph derivation, MEMORY_RETRIEVAL_FAILED via 05-09)
  - WR-08 closed: Shift+Enter falls through the wikilink autocomplete to the TextArea default newline
  - IN-01 closed: BacklinksPanel collapse/expand tooltip distinguishes state (backlinksCollapse/backlinksExpand)
  - IN-02 closed: applySelect dispatches state directly from a ref-read list — no setters inside the setAllNotes updater
  - IN-03 closed: relativeTime honors preferredLanguage (default 'en')
  - IN-04 closed: NoteGraphView renders a deterministic phyllotaxis layout pre-tick and preserves positions across list refreshes
affects: [phase verification re-run, REQUIREMENTS KNW-01/KNW-02/KNW-03/KNW-05, Phase 5a planning]

# Tech tracking
tech-stack:
  added: []  # gap-closure — no new packages
  patterns:
    - "guardedNavigate + pendingNavRef + navDiscardPending: one discard contract owns every navigation entry point — no path can bypass the dirty guard"
    - "Shared reduced-memory source across the degradation ladder: reduce-topk sets reducedMemoryHints = input.memoryHints.slice(0, 3) ONLY when a real reduction occurred; minimal-mode re-packs consume it (WR-02)"
    - "vi.mock + importOriginal wrapper over d3-force cloning node state at forceSimulation CALL time — d3-force mutates nodes in place, so the IN-04 refresh regression observes the pre-tick seed, never the post-tick equilibrium"

key-files:
  created: []
  modified:
    - src/components/pages/NotesPage.tsx
    - src/core/context/ContextOptimizer.ts
    - src/components/pages/useStreamingLLM.ts
    - src/components/notes/WikilinkAutocomplete.tsx
    - src/components/notes/BacklinksPanel.tsx
    - src/components/notes/NoteGraphView.tsx
    - src/core/i18n/strings.ts
    - tests/components/pages/NotesPage.test.tsx
    - tests/core/context/ContextOptimizer.test.ts
    - tests/components/pages/useStreamingLLM.test.tsx
    - tests/components/notes/WikilinkAutocomplete.test.tsx
    - tests/components/notes/BacklinksPanel.test.tsx
    - tests/components/notes/NoteGraphView.test.tsx

key-decisions:
  - "guardedNavigate is the single guarded-open seam: dirtyRef.current → stash fn in pendingNavRef + open the shared Popconfirm; clean → run fn immediately. The Popconfirm is mounted over a hidden trigger inside the page root (ErrorBoundary, after the view panes) so no bypass path exists."
  - "WR-02 shared source: reducedMemoryHints starts as input.memoryHints; reduce-topk sets slice(0,3) when it actually dropped items; minimal-mode re-packs with it — byte-identical when no reduction occurred (minimal-mode section-bytes tests unchanged)"
  - "WR-07 ordering: planner invocation resolves first (its window derives the tier that derives prefs), prefs is assigned from plannerInjection.preferences, THEN the renderer invocation resolves — privacyModeFromPrefs(prefs) reads the real value"
  - "WR-03 boundary: the inner try/catch wraps ONLY parseLinks(draft.content) → NOTE_LINK_PARSE_FAILED; the outer catch (putNote/getNote/reconcileAfterSave) → STORE_WRITE"
  - "IN-04: phyllotaxisLayout (golden-angle, no Date.now/Math.random) is both the pre-tick render fallback and the simulation seed; positions mirror via positionsRef is NOT in the effect deps (adding it would re-run the sim every tick — infinite loop)"
  - "NOTE_GRAPH_FAILED/SEARCH_INDEX_REBUILD_FAILED emitters land at the derivation/rebuild sites — the 3 dead Phase-5 codes are now all reachable (WR-04 closes with MEMORY_RETRIEVAL_FAILED from 05-09)"

patterns-established:
  - "Rule 3 (test-infra): the IN-04 refresh regression cannot assert post-tick geometry (real d3-force re-balances 46-162px on node add) — it asserts the MECHANISM (pre-tick seed captured via a cloning mock wrapper) and the FIRST FRAME (strict toBe under a matches:false matchMedia stub where no tick fires in jsdom)"

requirements-completed: [KNW-01, KNW-02, KNW-03, KNW-05]

# Coverage metadata — one entry per shipped deliverable
coverage:
  - id: D1
    description: "CR-02 closed: New note, New note from page, BacklinksPanel rows, and Preview wikilinks all route through guardedNavigate → STR.notes.discard Popconfirm on dirty; Discard navigates, Keep stays (4 regressions, one per bypass path)"
    requirement: KNW-01
    verification:
      - kind: unit
        ref: "tests/components/pages/NotesPage.test.tsx#CR-02 new note / new note from page / backlinks / wikilink"
        status: pass
    human_judgment: false
  - id: D2
    description: "WR-03: handleSave logs NOTE_LINK_PARSE_FAILED only at the parse boundary; putNote/getNote/reconcileAfterSave failures log STORE_WRITE"
    requirement: KNW-01
    verification:
      - kind: unit
        ref: "tests/components/pages/NotesPage.test.tsx"
        status: pass
    human_judgment: false
  - id: D3
    description: "IN-02: applySelect reads allNotesRef.current and dispatches state directly — no setters inside the setAllNotes updater"
    requirement: KNW-01
    verification:
      - kind: unit
        ref: "tests/components/pages/NotesPage.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "IN-03: relativeTime(ts, now, locale) honors preferredLanguage from readPersonaPrefs, default 'en'"
    requirement: KNW-01
    verification:
      - kind: unit
        ref: "tests/components/pages/NotesPage.test.tsx"
        status: pass
    human_judgment: false
  - id: D5
    description: "WR-04 (NotesPage): buildNotesIndex/buildTitleIndex rebuild sites log SEARCH_INDEX_REBUILD_FAILED and never throw"
    requirement: KNW-03
    verification:
      - kind: unit
        ref: "tests/components/pages/NotesPage.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "WR-02: the degradation ladder shares one reduced-hints source — over-budget input where top-3 + compact system fits returns without CONTEXT_TOO_LARGE; final memory section = top-3 text"
    requirement: KNW-05
    verification:
      - kind: unit
        ref: "tests/core/context/ContextOptimizer.test.ts#WR-02 — shared reduced-hints across the ladder (05-10 Task 2)"
        status: pass
    human_judgment: false
  - id: D7
    description: "WR-07: prefs assigned before the renderer upfront invocation — renderer createStageInvocation receives privacyMode derived from real planner-injection preferences (local-only for allowCloudFallbackFromLocal:false)"
    requirement: KNW-05
    verification:
      - kind: unit
        ref: "tests/components/pages/useStreamingLLM.test.tsx#WR-07"
        status: pass
    human_judgment: false
  - id: D8
    description: "WR-08: Shift+Enter falls through the wikilink autocomplete to the TextArea default newline (no insert, no preventDefault); plain Enter still inserts"
    requirement: KNW-01
    verification:
      - kind: unit
        ref: "tests/components/notes/WikilinkAutocomplete.test.tsx#Shift+Enter falls through (WR-08)"
        status: pass
    human_judgment: false
  - id: D9
    description: "IN-01: BacklinksPanel collapse/expand tooltip + aria-label distinguish state via STR.notes.backlinksCollapse/backlinksExpand"
    requirement: KNW-02
    verification:
      - kind: unit
        ref: "tests/components/notes/BacklinksPanel.test.tsx#collapse tooltip distinguishes state (IN-01)"
        status: pass
    human_judgment: false
  - id: D10
    description: "IN-04 + WR-04 (NoteGraphView): exported phyllotaxisLayout is the pre-tick render fallback and simulation seed; positions preserved across refreshes via positionsRef; NOTE_GRAPH_FAILED emitted on edge derivation failure"
    requirement: KNW-02
    verification:
      - kind: unit
        ref: "tests/components/notes/NoteGraphView.test.tsx#IN-04 deterministic layout + position preservation (05-10)"
        status: pass
    human_judgment: false

# Metrics
duration: 24 min
completed: 2026-08-14
status: complete
---

# Phase [05] Plan [10]: UI + Optimizer/Wiring Gap Closure — Dirty-Guard Completeness, Ladder Consistency, Code Attribution

**Every dirty-draft navigation path guarded (CR-02), a shared reduced-hints source across the degradation ladder (WR-02), prefs assigned before the renderer upfront invocation (WR-07), canonical codes attributed and emitted (WR-03/WR-04), Shift+Enter fall-through (WR-08), and the deterministic position-preserving note graph (IN-01..04)**

## Performance

- **Duration:** 24 min
- **Completed:** 2026-08-14
- **Tasks:** 3
- **Files modified:** 13
- **Commits:** 5 (all 05-10-scoped, atomic per component)

## Accomplishments

- **CR-02 (data-loss blocker closed):** ONE `guardedNavigate` helper now owns the dirty-draft contract. All four bypass paths — New note (`handleNewNote`), New note from page (`handleNewNoteFromPage`), BacklinksPanel row clicks (`onOpenNote`), and resolved Preview wikilinks (`onOpen`) — route through it. A dirty draft stashes the pending navigation in `pendingNavRef` and opens a shared controlled `STR.notes.discard` Popconfirm (danger-styled, mounted over a hidden `[data-np-nav-guard="1"]` trigger inside the page root); Discard navigates once, Keep/backdrop stays. The graph-flow guard and per-card Popconfirms were deliberately untouched (pinned tests). Four regressions pin each bypass path (VERIFICATION truth #10).
- **WR-02 (KNW-05 degradation consistency):** `ContextOptimizer.optimize` now carries `reducedMemoryHints`. The reduce-topk branch sets it to `input.memoryHints.slice(0, 3)` only when a real reduction occurred (dropped.length > 0); the minimal-mode branch re-packs from it. A turn where compact system + top-3 memory fits — but top-5 does not — resolves instead of throwing CONTEXT_TOO_LARGE. When no reduction occurred the source stays `input.memoryHints`, so the pinned minimal-mode section-bytes tests are byte-identical. Regression: over-budget fixture asserts return (no throw), `stepsFired` has both `reduce-topk` + `minimal-mode`, and the final memory text equals the top-3 slice.
- **WR-07 (hook wiring):** `useStreamingLLM.send` resolves the planner invocation first (its window derives the tier that derives prefs), assigns `prefs = plannerInjection.preferences`, then resolves the renderer invocation — so the renderer's `privacyModeFromPrefs(prefs)` reads the real value. Regression pins `privacyMode: 'local-only'` for `allowCloudFallbackFromLocal: false` (VERIFICATION-linked latent desync closed; drop-in identity + tier-divergence tests stay green).
- **WR-03/WR-04 (code attribution):** `handleSave` splits the boundary — the inner wrap around `parseLinks(draft.content)` logs `NOTE_LINK_PARSE_FAILED`; putNote/getNote/reconcile failures log `STORE_WRITE`. `SEARCH_INDEX_REBUILD_FAILED` wraps both index-rebuild sites; `NOTE_GRAPH_FAILED` wraps `edges(notes)` derivation (fallback `[]`, never throws). With `MEMORY_RETRIEVAL_FAILED` from 05-09, all five Phase-5 canonical codes now have live call sites (WR-04 closed).
- **WR-08:** `WikilinkAutocompleteHandle.handleKeyDown` accepts the event's `shiftKey` and returns early for Shift+Enter (no insert, no preventDefault) — the TextArea default inserts the newline; Tab and plain Enter keep inserting.
- **IN-01:** BacklinksPanel tooltip + aria-label use state-distinct `STR.notes.backlinksCollapse`/`backlinksExpand` (the dead ternary is gone).
- **IN-02:** `applySelect` reads `allNotesRef.current.find(...)` and dispatches state directly — no setters inside the `setAllNotes` updater (StrictMode-pure).
- **IN-03:** `relativeTime(ts, now, locale = 'en')` exports and threads `readPersonaPrefs().preferredLanguage` (non-blocking, try/catch → 'en').
- **IN-04:** `phyllotaxisLayout` (golden-angle, deterministic, no Date.now/Math.random) is the pre-tick render fallback (`positions ?? phyllotaxisLayout(nodes)` — never a (0,0) frame) AND the simulation seed for unmatched nodes; `positionsRef` mirrors the live layout so a list refresh seeds pre-existing nodes at their previous coordinates without re-randomizing. `positions` is deliberately NOT in the effect deps (would re-run the sim every tick). Regressions: determinism/in-view, no-tick first frame ≠ (0,0), and refresh pre-tick seed + first-frame continuity via a cloning d3-force mock wrapper that delegates to the real implementation.

## Task Commits

Each task was committed atomically (Task 3 in three component sub-steps):

1. **Task 1: CR-02+WR-03+IN-02+IN-03+WR-04 — one guarded navigation path, correct codes, ref-based selection, locale, index-rebuild emits** - `e69cb83` (feat)
2. **Task 2: WR-02+WR-07 — shared reduced-hints across the ladder, prefs before the upfront renderer invocation** - `c36d23e` (feat)
3. **Task 3a: WR-08 — autocomplete Shift+Enter falls through** - `98c76d2` (feat)
4. **Task 3b: IN-01 — state-distinct backlinks tooltip copy** - `3e9b1db` (feat)
5. **Task 3c: IN-04+WR-04 — deterministic phyllotaxis layout + position preservation + NOTE_GRAPH_FAILED** - `847c8f5` (feat)

**Plan metadata:** pending (committed with the docs close-out)

## Files Created/Modified

- `src/components/pages/NotesPage.tsx` - `guardedNavigate` + `pendingNavRef` + `navDiscardPending` + shared discard Popconfirm; handleSave code split (parse-boundary NOTE_LINK_PARSE_FAILED / STORE_WRITE); ref-based `applySelect`; locale-threaded `relativeTime`; `SEARCH_INDEX_REBUILD_FAILED` at both rebuild sites
- `src/core/context/ContextOptimizer.ts` - `reducedMemoryHints` shared source between reduce-topk and minimal-mode; header documents the shared-source rule
- `src/components/pages/useStreamingLLM.ts` - prefs assigned between the planner and renderer upfront invocations; ordering contract documented
- `src/components/notes/WikilinkAutocomplete.tsx` - `handleKeyDown` accepts `shiftKey`; Shift+Enter falls through
- `src/components/notes/BacklinksPanel.tsx` + `src/core/i18n/strings.ts` - state-distinct tooltip/aria-label via `backlinksCollapse`/`backlinksExpand`
- `src/components/notes/NoteGraphView.tsx` - exported `phyllotaxisLayout`; pre-tick fallback; `positionsRef` seeding; `NOTE_GRAPH_FAILED` emit on derivation failure
- 7 test files - 4 CR-02 dirty-guard regressions, WR-02 must-not-throw, WR-07 privacy-mode ordering, WR-08 Shift+Enter, IN-01 tooltip, IN-04 determinism + no-tick + refresh-preservation (cloning d3-force mock wrapper)

## Decisions Made

- One guard owns every navigation entry point — no path can bypass the dirty contract; the shared Popconfirm is controlled by `navDiscardPending` and mounted over a hidden trigger so it never shifts layout.
- WR-02 reduces by sharing the SOURCE, not by re-applying reductions — `reducedMemoryHints` is only rewritten when reduce-topk actually dropped items; no-reduction turns stay byte-identical.
- WR-07 accepts the inherent ordering: the planner link resolves before prefs exists (its window derives the tier that derives prefs) — only the renderer — the second upfront call — sees the assigned value.
- IN-04 seeds d3-force from `phyllotaxisLayout` for every unmatched node (first mount AND new notes) so the regression asserts the same pure function both the render fallback and the simulation use; the positions mirror lives in a ref, not the effect deps, to avoid the re-simulation loop.

## Deviations from Plan

None — all three tasks landed as planned. (The plan's flagged assumptions held: (a) planner-first prefs ordering, (b) `[data-np-wikilink-resolved="1"]` selector per PortableMarkdown's DOM contract, (c) `MAX_DROPDOWN_HEIGHT = 320` confirmed.)

---

**Total deviations:** 0
**Impact on plan:** none

## Issues Encountered

None — no blockers surfaced during execution.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three failed VERIFICATION truths (CR-01 via 05-09, CR-02, WR-01 via 05-09) and the full warning/info cohort (WR-02..WR-08, IN-01..04) are closed across the two closure waves (05-09 + 05-10). KNW-01/02/03/05 unblocked.
- The 05-10 phase-gate task and the plan verification (six touched suites) ran green during execution; the final `verify:phase-5` gate re-run over the closed phase is the remaining close-out step (eslint + prettier + tsc + wxt build + vitest run over the 102-file baseline + the new regressions).
- Human backstops from VERIFICATION.md (1,000-note list interactivity, MiniSearch real-world < 50 ms, graph visual pass, delete-menu spec gap decision) remain recorded for the end-of-phase human checkpoint.
- Ready for the Phase 5 verification re-run; then Phase 5a (LLM-Wiki & Filesystem Sync).

---
*Phase: 05-knowledge-base-memory-minisearch-notes*
*Completed: 2026-08-14*

## Self-Check: PASSED

All 13 modified files exist on disk; all 5 task commits present in git log (`e69cb83`, `c36d23e`, `98c76d2`, `3e9b1db`, `847c8f5`). The `verify:phase-5` gate re-run over the closed phase exits 0 (102 files / 941 tests, eslint + prettier + tsc + wxt build + vitest run; R-3 isolation scan 0 token matches in background/content bundles).
