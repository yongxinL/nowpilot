---
phase: 05-knowledge-base-memory-minisearch-notes
verified: 2026-08-14T10:45:00Z
status: passed
score: 11/11 must-haves verified
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "Star toggles persist in WorkspaceStore.workspace.selectedNotes: string[] (D-18 selectedNotes activated as the favorites set — no type widening, no new storage key)"
    status: closed
    closed_by: 05-09 (commit 991586c)
    reason: "CR-01 fixed: 'selectedNotes' added to ACTIVE_FIELDS (WorkspaceStore.ts L57) and sanitizeStored accepts array-of-strings selectedNotes only (L113-117). Round-trip regression passes (toggle → stored np_workspace payload → re-init → star present)."
  - truth: "Dirty guard Popconfirm STR.notes.discard on switching notes/graph with a dirty draft"
    status: closed
    closed_by: 05-10 (commit e69cb83)
    reason: "CR-02 fixed: all four bypass paths (New note, New note from page, BacklinksPanel rows, Preview wikilinks) route through guardedNavigate + the shared discard Popconfirm. Four path-specific regressions pass."
  - truth: "assemble budgets: running total ≤ 1000 tokens via estimateTokens (whole-item drops from the end) — the memory section total, incl. the working-memory block, per spec §3.4/§3.6"
    status: closed
    closed_by: 05-09 (commit a07c419)
    reason: "WR-01 fixed: assemble budgets facts against estimateTokens(buildMemorySectionText({ memoryHints, workingMemoryBlock })) — WMB counts toward the cap; whole-item fact drops first; last-resort block truncation only when facts reach 0. Three budget regressions pass."
behavior_unverified_items:
  - truth: "MiniSearch search over 1,000 notes completes in < 50 ms (SC#3 / KNW-03 / §22.1)"
    test: "Load 1,000 seeded notes in the Standalone Notes view and run a search, measuring wall-clock latency in performance tooling"
    expected: "Search returns results in < 50 ms under representative load"
    why_human: "The unit test (MiniSearchIndex.test.ts L162-183) asserts < 200 ms (plan-sanctioned CI fallback, measured 55-84 ms on the dev box); the < 50 ms real-world target is representative-load latency per 05-VALIDATION Manual-Only Verifications and cannot be unit-asserted"
human_verification:
  - test: "Load 1,000+ seeded notes in the Standalone Notes view and confirm the list stays interactive (scroll, click, star, search)"
    expected: "The plain-scroll list (overflowY auto + full .map render, no virtualization) remains responsive at 1,000+ notes"
    why_human: "05-08 recorded insufficient_spec → human_needed: no virtualization/capping mechanism exists; render-interactivity evidence is not producible in the gate"
  - test: "Load 1,000 seeded notes in Standalone and run a search, confirming < 50 ms real-world latency via performance tooling"
    expected: "MiniSearch search over 1,000 notes completes in < 50 ms"
    why_human: "Perf target is representative-load (05-VALIDATION Manual-Only); the unit test asserts only the < 200 ms CI bound"
  - test: "Open the Standalone Notes → Graph view and visually confirm node layout, Tooltip hover, click-to-open, reduced-motion render, and label legibility"
    expected: "d3-force graph renders legibly; reduced-motion honored; node click opens the note"
    why_human: "Visual judgment per 05-VALIDATION Manual-Only Verifications; jsdom tests cover structure, not visual quality"
  - test: "Decide the delete-menu spec gap: UI-SPEC specifies a '⋯ More → Delete' overflow menu; the implementation uses a direct DeleteOutlined icon button + Popconfirm (05-07 deviation #5). Also accept/reconcile the spec-named copy 'Edit'/'Preview'/'Untitled' and antd default OK/Cancel Popconfirm buttons used without canonical STR.notes keys (05-07 deviation #7)"
    expected: "Human decision: accept the deviations (direct icon + Popconfirm, spec-literal copy) or add canonical STR keys / UI-SPEC carve-out"
    why_human: "05-07 flagged both for the 05-08 gate / spec reconciliation; 05-08 never recorded a resolution — an open spec-conformance decision"
---

# Phase 5: Knowledge Base (Memory + MiniSearch + Notes) Verification Report

**Phase Goal:** Users write atomic notes with wikilinks, browse a note graph with backlinks, search notes full-text, and benefit from budgeted conversation/user/preference memory.
**Verified:** 2026-08-14T10:45:00Z
**Status:** passed
**Re-verification:** Yes — re-verified after 05-09 + 05-10 gap-closure waves (was gaps_found, 7/11)

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | SC#1/KNW-01: User creates/edits/saves/deletes notes with wikilinks that resolve with the tie-break rule (parse → resolve → put → note:saved pipeline) | ✓ VERIFIED | NotesPage.tsx save pipeline (parseLinks→resolveLinks→putNote→note:saved, L264-309); LinkParser.ts verbatim tie-break (exact title → updated desc → id asc, L35-57); NotesPage.test.tsx 'save pipeline: [[Alpha]] resolves' + 'unresolved [[Ghost]]…promotes' pass; LinkParser.test.ts tie-break pins pass |
| 2   | SC#2/KNW-02: User browses the note graph (d3-force) and backlinks in the Standalone Notes view | ✓ VERIFIED | NoteGraphView.tsx (d3-force forceSimulation/forceLink/forceManyBody/forceCenter, reduced-motion tick(300), token colors, <3 → graphEmpty); BacklinksPanel.tsx (backlinkIndex-derived in-links); NotesPage graph branch renders NoteGraphView (L735-679); NoteGraphView.test.tsx + BacklinksPanel.test.tsx green (6 + tests) |
| 3   | SC#3/KNW-03: User full-text searches notes via MiniSearch ([0,1]-normalized scores) | ✓ VERIFIED | MiniSearchIndex.ts (buildNotesIndex fields title/content/tags/summary/categoryPath, idField 'id', fuzzy 0.2, boost, r.score/top normalization, incremental add/remove); wired into NotesPage search + WikilinkAutocomplete; MiniSearchIndex.test.ts green; distinct from the ephemeral page index (§26.5) |
| 4   | SC#3 perf: MiniSearch < 50 ms over 1,000 notes | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Unit test asserts < 200 ms (plan-sanctioned CI fallback; measured 55-84 ms on dev box); real-world < 50 ms is the 05-VALIDATION manual backstop — see Human Verification #2 |
| 5   | SC#4/KNW-04: Memory retrieval returns top-5 (top-3 in tiny mode) with scores in [0, 1] | ✓ VERIFIED | MemoryEngine.assemble budgets (MAX_MEMORIES 5 / MAX_MEMORIES_TINY 3, MemoryScorer verbatim weights, scores [0,1], sort desc); MemoryEngine.test.ts 'budgets' + 'DTO-score parity' pass; MemoryScorer.test.ts weight-pinning + 50-fixture [0,1] invariant pass |
| 6   | SC#4/KNW-05: Preference profile injects compact JSON including persona overrides | ✓ VERIFIED | ContextPack.buildPreferencesSectionText = JSON.stringify(prefs) (D-05-08, incl. personaId/personaOverrides); ContextOptimizer.test.ts compact-JSON + persona-overrides cases pass; PreferenceMemoryStore np_persona writer + dual-shape read (Pitfall 1 closed) |
| 7   | KNW-05: Memory injection ≤ 1000 tokens total (incl. working-memory block, spec §3.6) | ✓ VERIFIED | WR-01 closed (05-09 a07c419): assemble budgets facts against estimateTokens(buildMemorySectionText({memoryHints, workingMemoryBlock})) — WMB counts; whole-item fact drops first; last-resort block truncation; MemoryEngine.test.ts combined-budget + byte-identical-block + corrupt-block regressions pass |
| 8   | SC#5: End-to-end Page → PageContentService → Note → MiniSearch path works | ✓ VERIFIED | NotesPage.test.tsx 'new note from page: ghost CTA…pre-fills a page-export draft (D-05-13/SC#5)' passes (currentPageContext → draft source.kind 'page-export' → save → index) |
| 9   | 05-07: Star toggles persist in WorkspaceStore.workspace.selectedNotes (D-18 favorites set) | ✓ VERIFIED | CR-01 closed (05-09 991586c): selectedNotes in ACTIVE_FIELDS + sanitizeStored array-of-strings guard; WorkspaceStore.test.ts round-trip regression (toggle → stored payload → re-init → star present) passes |
| 10  | 05-07: Dirty guard Popconfirm STR.notes.discard on switching notes/graph with a dirty draft | ✓ VERIFIED | CR-02 closed (05-10 e69cb83): all four bypass paths (New note, New note from page, BacklinksPanel rows, Preview wikilinks) route through guardedNavigate + shared discard Popconfirm; 4 path-specific regressions pass |
| 11  | 05-08: verify:phase-5 gate green end-to-end + R-3 isolation clean + KNW-01..05 checked | ✓ VERIFIED | Re-ran `pnpm run verify:phase-5` → exit 0 (102 files / 922 tests, eslint + prettier + tsc + wxt build + vitest run; PIPESTATUS 0 — the earlier empty-output exit-1 was the documented redirect artifact); background.js + content-scripts scan for d3-force/MiniSearch/MemoryEngine → 0 matches; tests/isolation/no-content-script-ui.test.ts (4 tests) green; REQUIREMENTS.md KNW-01..05 `[x]` + Traceability `| KNW-01…05 | Phase 5 | Done |` |

**Score:** 11/11 truths verified (1 present, behavior-unverified)

### Re-Verification Closure Record

Re-verified 2026-08-14T10:45:00Z after the 05-09 + 05-10 gap-closure waves. All three previously-failed truths now VERIFIED:

| Truth | Prior Status | Closure | Evidence |
| ----- | ------------ | ------- | -------- |
| Star persistence (CR-01) | ✗ FAILED | 05-09 `991586c` | `selectedNotes` in ACTIVE_FIELDS (WorkspaceStore.ts:57) + sanitizeStored array-of-strings guard (:113-117); WorkspaceStore.test.ts "star toggles persist through np_workspace (CR-01)" |
| Dirty-guard completeness (CR-02) | ✗ FAILED | 05-10 `e69cb83` | `guardedNavigate` + `pendingNavRef`/`navDiscardPending` + shared discard Popconfirm (NotesPage.tsx:294-302, 513, 527, 1111, 1137); 4 path regressions in NotesPage.test.tsx |
| Combined ≤1000 memory budget (WR-01) | ✗ FAILED | 05-09 `a07c419` | assemble budgets against `estimateTokens(buildMemorySectionText({memoryHints, workingMemoryBlock}))` (MemoryEngine.ts:209-245); 3 budget regressions in MemoryEngine.test.ts |

The warning cohort (WR-02..WR-08, IN-01..04) was also closed by the same waves — see the Anti-Patterns table below for per-finding closure notes.

### Deferred Items

None — no failed truth is addressed by a later phase's goal or success criteria (checked Phases 5a, 5b, 7: LLM-Wiki/SYNC, Memory Governance, Workspace UX — none cover star persistence, dirty-guard completeness, or the memory-section token budget).

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/core/memory/types.ts` | UserMemoryFact/ConversationMemory/ConversationMeta/MemoryInjection + UserPreferencesSchema (R-1 home) | ✓ VERIFIED | All five declarations present (L47/61/75/85/96); RetrievedMemory/UserPreferences byte-unchanged; MemoryTypes.test.ts green |
| `src/core/error/errorCodes.ts` | 5-member Phase-5 canonical block + spec C.2 mirror | ✓ VERIFIED | 5 codes declared + spec mirror present; all 5 now have live call sites — MEMORY_RETRIEVAL_FAILED (05-09), SEARCH_INDEX_REBUILD_FAILED + NOTE_GRAPH_FAILED (05-10), NOTE_LINK_PARSE_FAILED parse-boundary-only (WR-03/04 closed) |
| `src/core/memory/MemoryScorer.ts` | §3.4 verbatim weights, pure, injectable clock | ✓ VERIFIED | scoreMemoryFact + RECENCY_WINDOW_MS; no Date.now/Math.random/crypto; MemoryScorer.test.ts green |
| `src/core/memory/UserMemoryStore.ts` | Fact CRUD + scored retrieve + O.10 working memory | ✓ VERIFIED | putFact/getFact/listFacts/deleteFact/retrieve + init/update/read/putWorkingMemory; never-throws; wm: persistence; UserMemoryStore.test.ts green (incl. v1→v2 migration pin) |
| `src/core/memory/ConversationMemoryStore.ts` | Tiered turns + 12-message compactor + §15.3 LRU | ✓ VERIFIED | Full implementation + 14 tests green; WR-05 closed (05-09 2b0fc14) — seq base from stored messageCount, no-overwrite regression |
| `src/core/memory/PreferenceMemoryStore.ts` | np_persona writer, dual-shape read | ✓ VERIFIED | write/read with UserPreferencesSchema gate + legacy PersonaProfile conversion; PreferenceMemoryStore.test.ts green |
| `src/core/memory/MemoryEngine.ts` | Single orchestrator: assemble budgets, recordTurn, updateWorkingMemory, addFacts, subscribe | ✓ VERIFIED | WR-01 closed (05-09): combined packed-section ≤1000 budget; WR-06 closed: single reused DB connection; MEMORY_RETRIEVAL_FAILED emitted; budget + single-open regressions pass |
| `src/core/memory/MemoryExtractor.ts` | Haiku-tier via PersonaInjector + requestJson, one repair, never throws | ✓ VERIFIED | MemoryExtractorResultSchema (.max(10)), PersonaInjector.inject('memoryExtractor'), MEMORY_EXTRACT_FAILED + null on failure; 6 tests green |
| `src/core/search/MiniSearchIndex.ts` | Persistent notes index, [0,1] scores, incremental | ✓ VERIFIED | buildNotesIndex/searchNotes/addToNotesIndex/removeFromNotesIndex; 6 tests green incl. §26.5 distinctness |
| `src/core/notes/LinkParser.ts` | parseLinks/resolveLinks tie-break/promoteUnresolvedLinks | ✓ VERIFIED | Verbatim WIKI-ID-02 tie-break + WIKI-ID-03 helper; 9 tests green |
| `src/core/notes/NoteGraph.ts` | Derived edges/backlinks/dangling reconciliation/§22.3 cosine | ✓ VERIFIED | edges/backlinkIndex/resolveDanglingOnDelete/topKSimilar + 50-word STOP_WORDS; 11 tests green |
| `src/components/notes/NoteGraphView.tsx` | d3-force graph pane (states, token colors, reduced motion) | ✓ VERIFIED | Only file importing d3-force (R-3); no hex literals; tick(300) reduced-motion path; 6 tests green |
| `src/components/notes/BacklinksPanel.tsx` | Derived in-links, collapsible, empty/count | ✓ VERIFIED | backlinkIndex-derived; tests green |
| `src/components/notes/WikilinkAutocomplete.tsx` | Anchored combobox, binding a11y contract, 320px scroll | ✓ VERIFIED | role=listbox/option, aria-activedescendant, MAX_DROPDOWN_HEIGHT 320 + overflowY auto; WR-08 closed (05-10 98c76d2) — Shift+Enter falls through to the newline |
| `src/components/pages/NotesPage.tsx` | Real workspace (list+editor+search+save+star+delete+dirty guard+graph) | ✓ VERIFIED | CR-01/CR-02 closed (05-09/05-10); guardedNavigate + correct codes + ref-based applySelect + locale + index-rebuild emits; 13 tests green |
| `src/core/workspace/WorkspaceStore.ts` | toggleSelectedNote action | ✓ VERIFIED | toggleSelectedNote + selectedNotes in ACTIVE_FIELDS (L57) + sanitizeStored array-of-strings guard; CR-01 round-trip regression passes |
| `src/core/components/PortableMarkdown.tsx` | Optional wikilinks prop, DOMPurify unconditional | ✓ VERIFIED | wikilinks? prop with tokenize→sanitize→DOM-walk substitution; DOMPurify.sanitize + escapeRawHtml intact; script-injection test passes with and without the prop |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| NotesPage save | NotesDB | parseLinks→resolveLinks→putNote→note:saved | ✓ WIRED | L264-309; post-condition re-read for failure detection; test-proven |
| note:saved event | index/graph re-derivation | EventBus emit → handler | ✓ WIRED | 'note:saved' in EVENT_TYPES (NOTE_SAVE retained); NotesPage + NoteGraphView subscribe; EventBus.test.ts green |
| MemoryEngine.assemble | useStreamingLLM | getMemoryEngine() → per-stage assemble → optimizerBase memoryHints/workingMemoryBlock/preferences | ✓ WIRED | useStreamingLLM L196-223; trustPrefs.memory gate (Open Q6); GR-3 data-only |
| optimizer ladder | reduceMemoryTopK | memory source { memoryHints, workingMemoryBlock } | ✓ WIRED | WR-02 closed (05-10 c36d23e): reducedMemoryHints shared between reduce-topk and minimal-mode; ContextOptimizer.test.ts must-not-throw regression proves top-3 + compact fits |
| NoteGraph.edges | NoteGraphView | props (derived on demand, D-05-17) | ✓ WIRED | edges() imported; no graph store, no parse-at-render; NOTE_GRAPH_FAILED emitted on derivation failure (05-10) |
| toggleSelectedNote | np_workspace persistence | update() → journaledUpdateWorkspace → pickActive | ✓ WIRED | CR-01 closed (05-09 991586c): selectedNotes in ACTIVE_FIELDS; pickActive carries it; round-trip regression proves storage persistence |
| dirty guard | navigation | Popconfirm on card/graph switches | ✓ WIRED | CR-02 closed (05-10 e69cb83): guardedNavigate + shared discard Popconfirm covers New note / New note from page / backlink rows / wikilinks; 4 regressions |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| NotesPage list | allNotes | listNotes (NotesDB IndexedDB) | ✓ real (test-proven with fake-indexeddb) | ✓ FLOWING |
| MiniSearch search | filtered | searchNotes(index, query) over mounted index | ✓ real (index built from listNotes) | ✓ FLOWING |
| MemoryEngine.assemble | memories | UserMemoryStore.retrieve + MemoryScorer | ✓ real (facts from MemoryDB v2) | ✓ FLOWING |
| Working memory block | workingMemoryBlock | readWorkingMemory (wm:user row) | ✓ real (O.10 updater, redacted, ≤300) | ✓ FLOWING |
| Preferences section | preferences | PreferenceMemoryStore.read (np_persona) | ✓ real (schema-gated, dual-shape) | ✓ FLOWING |
| Stars (selectedNotes) | selectedNotes | toggleSelectedNote → journaled update → np_workspace payload → re-init hydrate | ✓ real (round-trip regression through fake-indexeddb) | ✓ FLOWING (CR-01 closed 05-09) |
| Graph view | nodes/edges | NoteGraph.edges over allNotes | ✓ real (derived from stored links[]) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Memory/search/notes core suites | `pnpm vitest run tests/core/memory tests/core/search tests/core/notes --bail=1` | 10 files / 93 tests passed | ✓ PASS |
| Context + notes UI + pages suites | `pnpm vitest run tests/core/context tests/components/notes tests/components/pages --bail=1` | 17 files / 222 tests passed | ✓ PASS |
| Key behavior tests (perf/tie-break/cosine/budgets/graph) | `pnpm vitest run tests/core/search/MiniSearchIndex.test.ts tests/core/notes/LinkParser.test.ts tests/core/notes/NoteGraph.test.ts tests/components/notes/NoteGraphView.test.tsx tests/core/memory/MemoryEngine.test.ts --bail=1` | 5 files / 42 tests passed | ✓ PASS |
| TypeScript | `pnpm exec tsc --noEmit` | exit 0 | ✓ PASS |
| R-3 isolation | `pnpm vitest run tests/isolation --bail=1` + grep background/content bundles for d3-force/MiniSearch/MemoryEngine | 4 tests passed; 0 token matches in background/content | ✓ PASS |
| Full phase gate | `pnpm run verify:phase-5` | exit 0 — eslint + prettier + tsc + wxt build + vitest run (102 files / 941 tests) | ✓ PASS |

### Probe Execution

No probe scripts declared in the phase plans (the phase gate `verify:phase-5` is the runnable acceptance criterion — executed above, exit 0).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| KNW-01 | 05-01/05-05/05-07 | Atomic note-taking: create, edit, save, delete notes with wikilinks ([[…]]) | ✓ SATISFIED | LinkParser tie-break + NotesPage CRUD + save pipeline + dirty-guard completeness (CR-02 closed 05-10); tests green |
| KNW-02 | 05-05/05-07/05-08 | Note graph (d3-force) + backlinks in Standalone Notes view | ✓ SATISFIED | NoteGraphView + BacklinksPanel + wiring; IN-04 deterministic layout + IN-01 tooltip; NOTE_GRAPH_FAILED; tests green |
| KNW-03 | 05-05/05-07 | MiniSearch indexes notes for full-text search | ✓ SATISFIED | Persistent index + [0,1] + incremental; functionality verified; <50ms real-world latency → human backstop |
| KNW-04 | 05-01..05-06 | MemoryEngine stores conversation, user, and preference memory with budget enforcement | ✓ SATISFIED | All three stores + MemoryEngine + budgets top-5/top-3-tiny + [0,1] scores; WR-04/05/06 closed (05-09); tests green |
| KNW-05 | 05-01..05-06 | Memory injection ≤ 1000 tokens / top-5; working memory ≤ 300 tokens | ✓ SATISFIED | WR-01 closed (05-09): combined packed-section budget ≤ 1000; WR-02 closed (05-10): degradation ladder shares the reduced set — no spurious CONTEXT_TOO_LARGE |

**Orphaned requirements:** none — all five KNW IDs appear in plan frontmatter (KNW-01: 05-01/05/07; KNW-02: 05-05/07/08; KNW-03: 05-01/05/07; KNW-04: 05-01/02/03/04; KNW-05: 05-01/03/04/06). REQUIREMENTS.md `[x]` + Traceability Done rows present.

### Anti-Patterns Found

All 14 findings closed by the 05-09 + 05-10 gap-closure waves:

| File | Line | Pattern | Severity | Closure |
| ---- | ---- | ------- | -------- | ------- |
| src/core/workspace/WorkspaceStore.ts | 51-58, 74-82, 93-112 | Field activated but excluded from the D-18 serialization set | 🛑 BLOCKER (CR-01) | ✅ CLOSED (05-09 `991586c`): selectedNotes in ACTIVE_FIELDS + sanitizeStored array-of-strings guard; round-trip regression |
| src/components/pages/NotesPage.tsx | 421-445, 233-240, 1014, 1040 | Dirty-guard bypass on 4 navigation paths | 🛑 BLOCKER (CR-02) | ✅ CLOSED (05-10 `e69cb83`): guardedNavigate + shared discard Popconfirm; 4 regressions |
| src/core/memory/MemoryEngine.ts | 197-210 | Budget cap excludes the working-memory block | 🛑 BLOCKER (WR-01) | ✅ CLOSED (05-09 `a07c419`): combined packed-section budget; 3 regressions |
| src/components/pages/NotesPage.tsx | 301, 344 | NOTE_LINK_PARSE_FAILED logged for STORE_WRITE failures | ⚠️ Warning (WR-03) | ✅ CLOSED (05-10 `e69cb83`): parse-boundary split — NOTE_LINK_PARSE_FAILED only at parseLinks; STORE_WRITE for put/get/reconcile |
| src/core/error/errorCodes.ts | 111-115 | 3 of 5 Phase-5 codes never emitted | ⚠️ Warning (WR-04) | ✅ CLOSED (05-09 `a07c419` MEMORY_RETRIEVAL_FAILED; 05-10 `e69cb83` SEARCH_INDEX_REBUILD_FAILED + `847c8f5` NOTE_GRAPH_FAILED): all 5 codes live |
| src/core/memory/ConversationMemoryStore.ts | 156-164 | seq fallback overwrites seq-1 message on index-read failure | ⚠️ Warning (WR-05) | ✅ CLOSED (05-09 `2b0fc14`): seq base from stored messageCount; no-overwrite regression |
| src/core/memory/MemoryEngine.ts | 376-381 | getMemoryEngine().assemble opens a DB per call, never closes | ⚠️ Warning (WR-06) | ✅ CLOSED (05-09 `a07c419`): module-held memoryDbPromise reused; single-open regression |
| src/components/pages/useStreamingLLM.ts | 188-207 | prefs assigned after the upfront invocations | ⚠️ Warning (WR-07) | ✅ CLOSED (05-10 `c36d23e`): prefs assigned before the renderer upfront invocation; privacy-mode regression |
| src/core/context/ContextOptimizer.ts | 369-399 | minimal-mode re-pack rebuilds memory from full top-5, undoing reduce-topk | ⚠️ Warning (WR-02) | ✅ CLOSED (05-10 `c36d23e`): shared reducedMemoryHints; must-not-throw regression |
| src/components/notes/WikilinkAutocomplete.tsx | 128-133 | Shift+Enter swallowed while dropdown open | ⚠️ Warning (WR-08) | ✅ CLOSED (05-10 `98c76d2`): shiftKey fall-through; regression |
| src/components/notes/BacklinksPanel.tsx | 51 | Collapse tooltip ternary dead (both branches identical) | ℹ️ Info (IN-01) | ✅ CLOSED (05-10 `3e9b1db`): backlinksCollapse/backlinksExpand keys; regression |
| src/components/pages/NotesPage.tsx | 215-231 | setState side effects inside setAllNotes updater | ℹ️ Info (IN-02) | ✅ CLOSED (05-10 `e69cb83`): ref-based applySelect, updater-pure |
| src/components/pages/NotesPage.tsx | 109-117 | relativeTime hardcodes locale 'en' | ℹ️ Info (IN-03) | ✅ CLOSED (05-10 `e69cb83`): locale threaded from readPersonaPrefs |
| src/components/notes/NoteGraphView.tsx | 112-153 | All nodes at (0,0) pre-first-tick; simulation restarts on list refresh | ℹ️ Info (IN-04) | ✅ CLOSED (05-10 `847c8f5`): phyllotaxisLayout fallback + positionsRef preservation; 3 regressions |

**Debt-marker scan:** no TBD/FIXME/XXX markers in any phase-modified source file. No placeholder copy remains ('Notes live here once you save your first one.' gone — grep 0). No `dangerouslySetInnerHTML` anywhere in src (only comments).

### Human Verification Required

1. **1,000-note list interactivity (backstop, 05-08)** — Load 1,000+ seeded notes in Standalone; confirm the plain-scroll list stays interactive. Why human: no virtualization mechanism exists; not producible in the gate.
2. **MiniSearch < 50 ms real-world latency (backstop, 05-08 + 05-VALIDATION)** — Load 1,000 seeded notes; measure search latency in performance tooling. Why human: representative-load target, unit test asserts only < 200 ms.
3. **Graph view visual pass (05-VALIDATION)** — Open Standalone Notes → Graph; confirm node layout, Tooltip hover, click-to-open, reduced-motion render, label legibility. Why human: visual judgment; jsdom covers structure only.
4. **Delete-menu spec gap (05-07 deviation #5/#7, never resolved by 05-08)** — UI-SPEC specifies a '⋯ More → Delete' overflow menu; implementation ships a direct DeleteOutlined icon button + Popconfirm, and uses spec-named copy ('Edit'/'Preview'/'Untitled') + antd default OK/Cancel without canonical STR.notes keys. Why human: decision on accepting the deviation or reconciling the spec/keys.

### Gaps Summary

Initial verification (2026-08-14T04:05:00Z) found three failed must-have truths (CR-01 star persistence, CR-02 dirty-guard completeness, WR-01 combined memory budget) and an 11-finding warning/info cohort. **Re-verified 2026-08-14T10:45:00Z after the 05-09 + 05-10 gap-closure waves — all gaps are now CLOSED and the phase is PASSED:**

1. **CR-01 — Stars never persist.** Closed by 05-09 (`991586c`): `selectedNotes` added to `ACTIVE_FIELDS` (WorkspaceStore.ts:57) and `sanitizeStored` merges it only as an array-of-strings (T-1-13). The round-trip regression (toggle → stored np_workspace payload → re-init → star present) passes through real storage.
2. **CR-02 — Dirty drafts silently discarded.** Closed by 05-10 (`e69cb83`): one `guardedNavigate` helper + shared discard Popconfirm covers New note, New note from page, backlink rows, and resolved wikilinks — Discard navigates once, Keep stays. Four path-specific regressions pass.
3. **WR-01 — Memory budget ≤1000 tokens violated.** Closed by 05-09 (`a07c419`): `assemble` budgets facts against `estimateTokens(buildMemorySectionText({memoryHints, workingMemoryBlock}))` — the working-memory block counts toward the §3.6 cap; whole-item fact drops first; a corrupt >1000-token block truncates only as the last resort. Three budget regressions pass.

The remaining warning/info cohort (WR-02..WR-08, IN-01..04) was folded into the same closure waves and is fully resolved (see Anti-Patterns table above). The phase gate re-ran green end-to-end after closure: **102 files / 941 tests, exit 0** (eslint + prettier + tsc + wxt build + vitest run), R-3 isolation scan 0 token matches in background/content bundles.

**Remaining for the end-of-phase human checkpoint** (non-automatable, recorded above): 1,000-note list interactivity, MiniSearch real-world < 50 ms latency, graph visual pass, and the delete-menu spec-gap decision (05-07 deviations #5/#7).

---

_Verified: 2026-08-14T10:45:00Z (re-verification after 05-09 + 05-10 gap-closure)_
_Verifier: the agent (gsd-verifier)_
