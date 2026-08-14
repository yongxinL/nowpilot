---
phase: 05-knowledge-base-memory-minisearch-notes
verified: 2026-08-14T04:05:00Z
status: gaps_found
score: 7/11 must-haves verified
behavior_unverified: 1
overrides_applied: 0
gaps:
  - truth: "Star toggles persist in WorkspaceStore.workspace.selectedNotes: string[] (D-18 selectedNotes activated as the favorites set — no type widening, no new storage key)"
    status: failed
    reason: "CR-01 (05-REVIEW.md): selectedNotes is NOT in ACTIVE_FIELDS (WorkspaceStore.ts L51-58), pickActive drops it from the np_workspace payload, and sanitizeStored drops it on read. The journaled update() path bumps version + writes storage, but the stars themselves never reach storage — after reload defaultState() resets selectedNotes to []. The 05-07 summary's claims ('np_workspace persistence covers it', 'star toggles persist across surfaces like any other workspace field') are false. The NotesPage star test only asserts in-memory store membership — the gap is untested."
    artifacts:
      - path: "src/core/workspace/WorkspaceStore.ts"
        issue: "ACTIVE_FIELDS (L51-58) omits 'selectedNotes'; pickActive (L74-82) and sanitizeStored (L93-112) both drop it — stars silently lost on reload"
    missing:
      - "Add 'selectedNotes' to ACTIVE_FIELDS and accept an array-of-strings selectedNotes in sanitizeStored"
      - "Add a persistence regression test: toggle star → re-init store from storage → star present"
  - truth: "Dirty guard Popconfirm STR.notes.discard on switching notes/graph with a dirty draft"
    status: failed
    reason: "CR-02 (05-REVIEW.md): the dirty-guard Popconfirm only wraps note-card clicks (NotesPage.tsx L637-648) and graph switches (Segmented L659-669, graph pane L746-775). Four navigation paths bypass it entirely: New note (handleNewNote L421-429), New note from page (handleNewNoteFromPage L431-445), BacklinksPanel row click (onOpenNote=handleOpenNote L1040), and resolved wikilink click in Preview (onOpen: handleOpenNote L1014). All call applySelect/setDraft unconditionally — an unsaved draft is silently discarded (data loss)."
    artifacts:
      - path: "src/components/pages/NotesPage.tsx"
        issue: "handleNewNote (L421-429), handleNewNoteFromPage (L431-445), handleOpenNote (L233-240) bypass the dirty guard; BacklinksPanel onOpenNote (L1040) and wikilinks onOpen (L1014) route through the unguarded handleOpenNote"
    missing:
      - "Route all four paths through a single guarded navigation helper (dirty → STR.notes.discard Popconfirm; discard → navigate; keep → stay)"
  - truth: "assemble budgets: running total ≤ 1000 tokens via estimateTokens (whole-item drops from the end) — the memory section total, incl. the working-memory block, per spec §3.4/§3.6"
    status: failed
    reason: "WR-01 (05-REVIEW.md): MemoryEngine.assemble enforces MAX_MEMORY_TOKENS only against fact memories (MemoryEngine.ts L197-210); the ≤300-token working-memory block rides separately. buildMemorySectionText joins WMB + fact lines (ContextPack.ts), so the packed memory section can reach ~1300 tokens. Spec §3.6 mandates the WMB 'counts against the memory budget (§3.4: ≤ 1000 tokens total)' and requires truncating the block BEFORE dropping retrieved facts — neither is implemented. Golden Rule 6 (≤1000 tokens) is a hard project contract; the 05-06 summary's 'memory ≤1000 tokens … lands in a real stable:true memory section' claim does not hold for the combined section."
    artifacts:
      - path: "src/core/memory/MemoryEngine.ts"
        issue: "assemble (L197-210) caps facts at MAX_MEMORY_TOKENS but does not account for the working-memory block in the total; no WMB-first truncation per §3.6"
      - path: "src/core/context/ContextPack.ts"
        issue: "buildMemorySectionText joins workingMemoryBlock + fact lines without a combined budget"
    missing:
      - "Account for estimateTokens(workingMemoryBlock) in the ≤1000-token cap, or truncate the WMB to fit the combined budget before dropping facts (spec §3.6 degradation order)"
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
**Verified:** 2026-08-14T04:05:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

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
| 7   | KNW-05: Memory injection ≤ 1000 tokens total (incl. working-memory block, spec §3.6) | ✗ FAILED | WR-01: WMB rides outside the ≤1000 cap; combined memory section can reach ~1300 tokens; §3.6 truncate-block-first degradation absent — see Gaps |
| 8   | SC#5: End-to-end Page → PageContentService → Note → MiniSearch path works | ✓ VERIFIED | NotesPage.test.tsx 'new note from page: ghost CTA…pre-fills a page-export draft (D-05-13/SC#5)' passes (currentPageContext → draft source.kind 'page-export' → save → index) |
| 9   | 05-07: Star toggles persist in WorkspaceStore.workspace.selectedNotes (D-18 favorites set) | ✗ FAILED | CR-01: selectedNotes excluded from ACTIVE_FIELDS/pickActive/sanitizeStored — stars lost on reload; test only asserts in-memory membership — see Gaps |
| 10  | 05-07: Dirty guard Popconfirm STR.notes.discard on switching notes/graph with a dirty draft | ✗ FAILED | CR-02: 4 navigation paths (New note, New note from page, backlink rows, resolved wikilinks) bypass the guard — silent draft loss — see Gaps |
| 11  | 05-08: verify:phase-5 gate green end-to-end + R-3 isolation clean + KNW-01..05 checked | ✓ VERIFIED | Re-ran `pnpm run verify:phase-5` → exit 0 (102 files / 922 tests, eslint + prettier + tsc + wxt build + vitest run; PIPESTATUS 0 — the earlier empty-output exit-1 was the documented redirect artifact); background.js + content-scripts scan for d3-force/MiniSearch/MemoryEngine → 0 matches; tests/isolation/no-content-script-ui.test.ts (4 tests) green; REQUIREMENTS.md KNW-01..05 `[x]` + Traceability `| KNW-01…05 | Phase 5 | Done |` |

**Score:** 7/11 truths verified (1 present, behavior-unverified)

### Deferred Items

None — no failed truth is addressed by a later phase's goal or success criteria (checked Phases 5a, 5b, 7: LLM-Wiki/SYNC, Memory Governance, Workspace UX — none cover star persistence, dirty-guard completeness, or the memory-section token budget).

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/core/memory/types.ts` | UserMemoryFact/ConversationMemory/ConversationMeta/MemoryInjection + UserPreferencesSchema (R-1 home) | ✓ VERIFIED | All five declarations present (L47/61/75/85/96); RetrievedMemory/UserPreferences byte-unchanged; MemoryTypes.test.ts green |
| `src/core/error/errorCodes.ts` | 5-member Phase-5 canonical block + spec C.2 mirror | ⚠️ WARNING | 5 codes declared + spec mirror present (05-01) — but 3 of 5 (MEMORY_RETRIEVAL_FAILED, NOTE_GRAPH_FAILED, SEARCH_INDEX_REBUILD_FAILED) have ZERO call sites (WR-04); NOTE_LINK_PARSE_FAILED misused for STORE_WRITE failures (WR-03) |
| `src/core/memory/MemoryScorer.ts` | §3.4 verbatim weights, pure, injectable clock | ✓ VERIFIED | scoreMemoryFact + RECENCY_WINDOW_MS; no Date.now/Math.random/crypto; MemoryScorer.test.ts green |
| `src/core/memory/UserMemoryStore.ts` | Fact CRUD + scored retrieve + O.10 working memory | ✓ VERIFIED | putFact/getFact/listFacts/deleteFact/retrieve + init/update/read/putWorkingMemory; never-throws; wm: persistence; UserMemoryStore.test.ts green (incl. v1→v2 migration pin) |
| `src/core/memory/ConversationMemoryStore.ts` | Tiered turns + 12-message compactor + §15.3 LRU | ⚠️ WARNING | Full implementation + 13 tests green — but appendTurn seq fallback can overwrite the seq-1 message on index-read failure (WR-05) |
| `src/core/memory/PreferenceMemoryStore.ts` | np_persona writer, dual-shape read | ✓ VERIFIED | write/read with UserPreferencesSchema gate + legacy PersonaProfile conversion; PreferenceMemoryStore.test.ts green |
| `src/core/memory/MemoryEngine.ts` | Single orchestrator: assemble budgets, recordTurn, updateWorkingMemory, addFacts, subscribe | ⚠️ WARNING | Single-orchestrator contract + top-5/top-3 + [0,1] + never-throws verified — but WMB not counted in the ≤1000 cap (WR-01) and getMemoryEngine() leaks an IDB connection per assemble call (WR-06) |
| `src/core/memory/MemoryExtractor.ts` | Haiku-tier via PersonaInjector + requestJson, one repair, never throws | ✓ VERIFIED | MemoryExtractorResultSchema (.max(10)), PersonaInjector.inject('memoryExtractor'), MEMORY_EXTRACT_FAILED + null on failure; 6 tests green |
| `src/core/search/MiniSearchIndex.ts` | Persistent notes index, [0,1] scores, incremental | ✓ VERIFIED | buildNotesIndex/searchNotes/addToNotesIndex/removeFromNotesIndex; 6 tests green incl. §26.5 distinctness |
| `src/core/notes/LinkParser.ts` | parseLinks/resolveLinks tie-break/promoteUnresolvedLinks | ✓ VERIFIED | Verbatim WIKI-ID-02 tie-break + WIKI-ID-03 helper; 9 tests green |
| `src/core/notes/NoteGraph.ts` | Derived edges/backlinks/dangling reconciliation/§22.3 cosine | ✓ VERIFIED | edges/backlinkIndex/resolveDanglingOnDelete/topKSimilar + 50-word STOP_WORDS; 11 tests green |
| `src/components/notes/NoteGraphView.tsx` | d3-force graph pane (states, token colors, reduced motion) | ✓ VERIFIED | Only file importing d3-force (R-3); no hex literals; tick(300) reduced-motion path; 6 tests green |
| `src/components/notes/BacklinksPanel.tsx` | Derived in-links, collapsible, empty/count | ✓ VERIFIED | backlinkIndex-derived; tests green |
| `src/components/notes/WikilinkAutocomplete.tsx` | Anchored combobox, binding a11y contract, 320px scroll | ✓ VERIFIED | role=listbox/option, aria-activedescendant, MAX_DROPDOWN_HEIGHT 320 + overflowY auto; ⚠ WR-08: Shift+Enter swallowed while dropdown open (Enter inserts regardless of modifiers) |
| `src/components/pages/NotesPage.tsx` | Real workspace (list+editor+search+save+star+delete+dirty guard+graph) | ⚠️ WARNING | Full workspace + save pipeline + graph wiring present; 9 tests green — but CR-02 (dirty guard bypass) and CR-01 (star persistence) defects live here |
| `src/core/workspace/WorkspaceStore.ts` | toggleSelectedNote action | ⚠️ WARNING | toggleSelectedNote exists (L356) — but selectedNotes missing from ACTIVE_FIELDS/pickActive/sanitizeStored (CR-01) |
| `src/core/components/PortableMarkdown.tsx` | Optional wikilinks prop, DOMPurify unconditional | ✓ VERIFIED | wikilinks? prop with tokenize→sanitize→DOM-walk substitution; DOMPurify.sanitize + escapeRawHtml intact; script-injection test passes with and without the prop |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| NotesPage save | NotesDB | parseLinks→resolveLinks→putNote→note:saved | ✓ WIRED | L264-309; post-condition re-read for failure detection; test-proven |
| note:saved event | index/graph re-derivation | EventBus emit → handler | ✓ WIRED | 'note:saved' in EVENT_TYPES (NOTE_SAVE retained); NotesPage + NoteGraphView subscribe; EventBus.test.ts green |
| MemoryEngine.assemble | useStreamingLLM | getMemoryEngine() → per-stage assemble → optimizerBase memoryHints/workingMemoryBlock/preferences | ✓ WIRED | useStreamingLLM L196-223; trustPrefs.memory gate (Open Q6); GR-3 data-only |
| optimizer ladder | reduceMemoryTopK | memory source { memoryHints, workingMemoryBlock } | ⚠️ PARTIAL | reduce-topk fires (L369-382) — but minimal-mode re-pack rebuilds memory from full top-5 hints, undoing the top-3 reduction (WR-02); can throw spurious CONTEXT_TOO_LARGE |
| NoteGraph.edges | NoteGraphView | props (derived on demand, D-05-17) | ✓ WIRED | edges() imported; no graph store, no parse-at-render |
| toggleSelectedNote | np_workspace persistence | update() → journaledUpdateWorkspace → pickActive | ✗ NOT_WIRED | update() runs, but pickActive strips selectedNotes — the star never reaches storage (CR-01) |
| dirty guard | navigation | Popconfirm on card/graph switches | ⚠️ PARTIAL | Card + graph-switch + graph-node paths guarded; New note / New note from page / backlink rows / wikilinks unguarded (CR-02) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| NotesPage list | allNotes | listNotes (NotesDB IndexedDB) | ✓ real (test-proven with fake-indexeddb) | ✓ FLOWING |
| MiniSearch search | filtered | searchNotes(index, query) over mounted index | ✓ real (index built from listNotes) | ✓ FLOWING |
| MemoryEngine.assemble | memories | UserMemoryStore.retrieve + MemoryScorer | ✓ real (facts from MemoryDB v2) | ✓ FLOWING |
| Working memory block | workingMemoryBlock | readWorkingMemory (wm:user row) | ✓ real (O.10 updater, redacted, ≤300) | ✓ FLOWING |
| Preferences section | preferences | PreferenceMemoryStore.read (np_persona) | ✓ real (schema-gated, dual-shape) | ✓ FLOWING |
| Stars (selectedNotes) | selectedNotes | toggleSelectedNote in-memory only | ✗ DISCONNECTED — never serialized (CR-01) | ✗ HOLLOW |
| Graph view | nodes/edges | NoteGraph.edges over allNotes | ✓ real (derived from stored links[]) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Memory/search/notes core suites | `pnpm vitest run tests/core/memory tests/core/search tests/core/notes --bail=1` | 10 files / 93 tests passed | ✓ PASS |
| Context + notes UI + pages suites | `pnpm vitest run tests/core/context tests/components/notes tests/components/pages --bail=1` | 17 files / 222 tests passed | ✓ PASS |
| Key behavior tests (perf/tie-break/cosine/budgets/graph) | `pnpm vitest run tests/core/search/MiniSearchIndex.test.ts tests/core/notes/LinkParser.test.ts tests/core/notes/NoteGraph.test.ts tests/components/notes/NoteGraphView.test.tsx tests/core/memory/MemoryEngine.test.ts --bail=1` | 5 files / 42 tests passed | ✓ PASS |
| TypeScript | `pnpm exec tsc --noEmit` | exit 0 | ✓ PASS |
| R-3 isolation | `pnpm vitest run tests/isolation --bail=1` + grep background/content bundles for d3-force/MiniSearch/MemoryEngine | 4 tests passed; 0 token matches in background/content | ✓ PASS |
| Full phase gate | `pnpm run verify:phase-5` | exit 0 — eslint + prettier + tsc + wxt build + vitest run (102 files / 922 tests) | ✓ PASS |

### Probe Execution

No probe scripts declared in the phase plans (the phase gate `verify:phase-5` is the runnable acceptance criterion — executed above, exit 0).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| KNW-01 | 05-01/05-05/05-07 | Atomic note-taking: create, edit, save, delete notes with wikilinks ([[…]]) | ✓ SATISFIED | LinkParser tie-break + NotesPage CRUD + save pipeline; tests green (CR-02 dirty-guard gap recorded under gaps — core CRUD works, draft-preservation incomplete) |
| KNW-02 | 05-05/05-07/05-08 | Note graph (d3-force) + backlinks in Standalone Notes view | ✓ SATISFIED | NoteGraphView + BacklinksPanel + wiring; tests green |
| KNW-03 | 05-05/05-07 | MiniSearch indexes notes for full-text search | ✓ SATISFIED | Persistent index + [0,1] + incremental; functionality verified; <50ms real-world latency → human backstop |
| KNW-04 | 05-01..05-06 | MemoryEngine stores conversation, user, and preference memory with budget enforcement | ✓ SATISFIED | All three stores + MemoryEngine + budgets top-5/top-3-tiny + [0,1] scores; tests green |
| KNW-05 | 05-01..05-06 | Memory injection ≤ 1000 tokens / top-5; working memory ≤ 300 tokens | ✗ BLOCKED | Top-5/top-3 + WMB ≤300 verified — but the combined memory section can exceed 1000 tokens (WR-01, spec §3.6); see gaps |

**Orphaned requirements:** none — all five KNW IDs appear in plan frontmatter (KNW-01: 05-01/05/07; KNW-02: 05-05/07/08; KNW-03: 05-01/05/07; KNW-04: 05-01/02/03/04; KNW-05: 05-01/03/04/06). REQUIREMENTS.md `[x]` + Traceability Done rows present.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| src/core/workspace/WorkspaceStore.ts | 51-58, 74-82, 93-112 | Field activated but excluded from the D-18 serialization set | 🛑 BLOCKER (CR-01) | Stars silently lost on reload — data loss, contradicts the 05-07 must-have and summary claims |
| src/components/pages/NotesPage.tsx | 421-445, 233-240, 1014, 1040 | Dirty-guard bypass on 4 navigation paths | 🛑 BLOCKER (CR-02) | Unsaved drafts silently discarded — data loss |
| src/core/memory/MemoryEngine.ts | 197-210 | Budget cap excludes the working-memory block | 🛑 BLOCKER (WR-01) | Memory section can reach ~1300 tokens — violates spec §3.4/§3.6 + Golden Rule 6 |
| src/components/pages/NotesPage.tsx | 301, 344 | NOTE_LINK_PARSE_FAILED logged for STORE_WRITE failures | ⚠️ Warning (WR-03) | Wrong canonical code breaks monitoring/attribution (GR-9) |
| src/core/error/errorCodes.ts | 111-115 | 3 of 5 Phase-5 codes never emitted | ⚠️ Warning (WR-04) | Declared-but-unreachable canonical codes |
| src/core/memory/ConversationMemoryStore.ts | 156-164 | seq fallback overwrites seq-1 message on index-read failure | ⚠️ Warning (WR-05) | Data-loss mode on transient IDB error |
| src/core/memory/MemoryEngine.ts | 376-381 | getMemoryEngine().assemble opens a DB per call, never closes | ⚠️ Warning (WR-06) | Unbounded IDB connection accumulation over a session |
| src/components/pages/useStreamingLLM.ts | 188-207 | prefs assigned after the upfront invocations | ⚠️ Warning (WR-07) | privacyModeFromPrefs(undefined) → 'prefer-local' for upfront calls; latent tier desync |
| src/core/context/ContextOptimizer.ts | 369-399 | minimal-mode re-pack rebuilds memory from full top-5, undoing reduce-topk | ⚠️ Warning (WR-02) | Spurious CONTEXT_TOO_LARGE when top-3 + compact system would fit |
| src/components/notes/WikilinkAutocomplete.tsx | 128-133 | Shift+Enter swallowed while dropdown open | ⚠️ Warning (WR-08) | No newline insertion in the body while autocomplete is active |
| src/components/notes/BacklinksPanel.tsx | 51 | Collapse tooltip ternary dead (both branches identical) | ℹ️ Info (IN-01) | Affordance never distinguishes state |
| src/components/pages/NotesPage.tsx | 215-231 | setState side effects inside setAllNotes updater | ℹ️ Info (IN-02) | Anti-pattern; idempotent today |
| src/components/pages/NotesPage.tsx | 109-117 | relativeTime hardcodes locale 'en' | ℹ️ Info (IN-03) | Ignores preferredLanguage |
| src/components/notes/NoteGraphView.tsx | 112-153 | All nodes at (0,0) pre-first-tick; simulation restarts on list refresh | ℹ️ Info (IN-04) | One-frame origin flash; graph re-randomizes on save |

**Debt-marker scan:** no TBD/FIXME/XXX markers in any phase-modified source file. No placeholder copy remains ('Notes live here once you save your first one.' gone — grep 0). No `dangerouslySetInnerHTML` anywhere in src (only comments).

### Human Verification Required

1. **1,000-note list interactivity (backstop, 05-08)** — Load 1,000+ seeded notes in Standalone; confirm the plain-scroll list stays interactive. Why human: no virtualization mechanism exists; not producible in the gate.
2. **MiniSearch < 50 ms real-world latency (backstop, 05-08 + 05-VALIDATION)** — Load 1,000 seeded notes; measure search latency in performance tooling. Why human: representative-load target, unit test asserts only < 200 ms.
3. **Graph view visual pass (05-VALIDATION)** — Open Standalone Notes → Graph; confirm node layout, Tooltip hover, click-to-open, reduced-motion render, label legibility. Why human: visual judgment; jsdom covers structure only.
4. **Delete-menu spec gap (05-07 deviation #5/#7, never resolved by 05-08)** — UI-SPEC specifies a '⋯ More → Delete' overflow menu; implementation ships a direct DeleteOutlined icon button + Popconfirm, and uses spec-named copy ('Edit'/'Preview'/'Untitled') + antd default OK/Cancel without canonical STR.notes keys. Why human: decision on accepting the deviation or reconciling the spec/keys.

### Gaps Summary

The phase goal is **largely implemented and the phase gate is genuinely green** (re-ran end-to-end: 102 files / 922 tests, exit 0), but three must-have truths fail — two of them data-loss defects confirmed by the code review and by direct code inspection:

1. **CR-01 — Stars never persist.** `toggleSelectedNote` routes through the journaled `update()` path (version bump + np_workspace write), but `selectedNotes` is absent from `ACTIVE_FIELDS`/`pickActive`/`sanitizeStored`, so the star set never reaches storage and resets on reload. The 05-07 summary's persistence claims are false; the star test asserts only in-memory membership.
2. **CR-02 — Dirty drafts silently discarded.** The dirty-guard Popconfirm covers note cards and graph switches only; New note, New note from page, backlink rows, and resolved wikilinks all call `applySelect`/`setDraft` unconditionally, discarding unsaved edits without confirmation.
3. **WR-01 — Memory budget ≤1000 tokens violated for the combined section.** The working-memory block (≤300) rides outside the fact cap, so the packed memory section can reach ~1300 tokens; the spec §3.6 mandated degradation order (truncate the block before dropping facts) is not implemented.

Both critical review findings are confirmed in the codebase and directly falsify 05-07 must-have truths (star persistence; dirty-guard completeness). KNW-05 is blocked at the budget level. Because these are failed must-haves with user-visible data loss, the phase must not be declared complete until a gap-closure plan addresses CR-01, CR-02, and WR-01. The remaining review warnings (WR-02..WR-08, IN-01..04) are quality issues to fold into the same closure work. Human backstops (1,000-note list, MiniSearch real-world latency, graph visual pass, delete-menu decision) are recorded for the end-of-phase human checkpoint.

---

_Verified: 2026-08-14T04:05:00Z_
_Verifier: the agent (gsd-verifier)_
