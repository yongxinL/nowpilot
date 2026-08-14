---
phase: 05-knowledge-base-memory-minisearch-notes
reviewed: 2026-08-14T06:30:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - src/components/notes/BacklinksPanel.tsx
  - src/components/notes/NoteGraphView.tsx
  - src/components/notes/WikilinkAutocomplete.tsx
  - src/components/notes/d3-force.d.ts
  - src/components/pages/NotesPage.tsx
  - src/components/pages/useStreamingLLM.ts
  - src/core/ai/types.ts
  - src/core/components/PortableMarkdown.tsx
  - src/core/context/ContextCompressor.ts
  - src/core/context/ContextOptimizer.ts
  - src/core/context/ContextPack.ts
  - src/core/memory/ConversationMemoryStore.ts
  - src/core/memory/MemoryEngine.ts
  - src/core/memory/MemoryExtractor.ts
  - src/core/notes/LinkParser.ts
  - src/core/notes/NoteGraph.ts
  - src/core/search/MiniSearchIndex.ts
  - src/core/workspace/WorkspaceStore.ts
  - tests/components/notes/BacklinksPanel.test.tsx
  - tests/components/notes/NoteGraphView.test.tsx
  - tests/components/notes/WikilinkAutocomplete.test.tsx
  - tests/components/pages/NotesPage.test.tsx
  - tests/components/pages/useStreamingLLM.test.tsx
  - tests/core/ai/persona/PersonaInjector.test.ts
  - tests/core/context/ContextOptimizer.test.ts
  - tests/core/memory/MemoryEngine.test.ts
  - tests/core/memory/MemoryExtractor.test.ts
  - tests/core/notes/LinkParser.test.ts
  - tests/core/notes/NoteGraph.test.ts
  - tests/core/search/MiniSearchIndex.test.ts
  - tests/isolation/no-content-script-ui.test.ts
findings:
  critical: 2
  warning: 8
  info: 4
  total: 14
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-08-14T06:30:00Z
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Reviewed all Phase-5 source and test files (memory stores, MemoryEngine/MemoryExtractor, ContextPack/ContextOptimizer/ContextCompressor memory+preferences wiring, LinkParser/NoteGraph/MiniSearchIndex, the Notes workspace UI, d3-force graph view, and the R-3 isolation suite) against the claims in the 05-01..08 summaries and the authoritative spec (§2.4/§3.4/§3.6/§15.3/§21.2, Appendix C.2).

The core modules (LinkParser, NoteGraph, MiniSearchIndex, MemoryScorer wiring) are clean, deterministic, and well-tested. However, the review found **2 blocker-level defects**: (1) the star toggle (`toggleSelectedNote`) routes through the journaled `update()` path but `selectedNotes` is excluded from `ACTIVE_FIELDS`/`pickActive`/`sanitizeStored`, so stars are silently lost on reload — the very persistence the 05-07 deviation claimed to secure; and (2) the dirty-guard contract is only applied to note-card and graph-node navigation — "New note", "New note from page", backlink rows, and resolved wikilinks silently discard an unsaved draft (data loss). Also flagged: a §3.4 memory-budget violation (working-memory block not counted against the ≤1000-token total), a degradation-ladder interplay bug in the optimizer (minimal-mode re-pack undoes the reduce-topk reduction), misattributed/wrong canonical error codes, an IDB connection leak in the `getMemoryEngine()` surface, and several smaller correctness/quality issues.

## Critical Issues

### CR-01: Star toggle never persists — `selectedNotes` excluded from the np_workspace serialization set

**File:** `src/core/workspace/WorkspaceStore.ts:51-58` (ACTIVE_FIELDS), `74-82` (pickActive), `93-112` (sanitizeStored), `356-364` (toggleSelectedNote)
**Issue:** `toggleSelectedNote` was deliberately routed through `update()` → `journaledUpdateWorkspace` because, per the 05-07 deviation log, "the raw set() sketch would bypass version bump + np_workspace persistence (star would not persist across surfaces)". But `ACTIVE_FIELDS` (the D-18 serialization set) contains only `workspaceId / conversationId / activeSurface / openedStandaloneTabId / version / updatedAt` — `selectedNotes` is not in it. `pickActive(ws)` therefore drops `selectedNotes` from the `chrome.storage.local` payload, and `sanitizeStored` drops it on the read side too. Every star toggle bumps the version and writes np_workspace, but the stars themselves never reach storage: after a reload (or any storage-driven surface init), `defaultState()` resets `selectedNotes: []`. The 05-07 summary's claim "Star persists via WorkspaceStore.toggleSelectedNote (D-18 selectedNotes activation… np_workspace persistence covers it)" and "star toggles persist across surfaces like any other workspace field" is false. The NotesPage test only asserts in-memory `useWorkspaceStore.getState().workspace.selectedNotes` membership, so the gap is untested. User stars are silently lost — data loss.
**Fix:** Add `'selectedNotes'` to `ACTIVE_FIELDS` and to `sanitizeStored`'s accepted output (validated as an array of strings):
```ts
const ACTIVE_FIELDS = [
  'workspaceId', 'conversationId', 'activeSurface', 'openedStandaloneTabId',
  'selectedNotes', 'version', 'updatedAt',
] as const;
// sanitizeStored:
if (Array.isArray(v.selectedNotes) && v.selectedNotes.every((id) => typeof id === 'string')) {
  out.selectedNotes = v.selectedNotes;
}
```
Add a persistence regression test (toggle star → re-init store from storage → star present).

### CR-02: Dirty draft silently discarded by unguarded navigation paths (data loss)

**File:** `src/components/pages/NotesPage.tsx:233-240` (handleOpenNote), `421-429` (handleNewNote), `431-445` (handleNewNoteFromPage), `1014` (wikilinks `onOpen`), `1040` (BacklinksPanel `onOpenNote`)
**Issue:** The dirty-guard Popconfirm only wraps note-card clicks (`renderCard`, L637-648) and graph switches (Segmented L653-669, graph-pane L746-775). Four navigation paths bypass it entirely and call `applySelect`/`setDraft` unconditionally, discarding unsaved edits without confirmation:
1. **New note** button (`handleNewNote`) — always enabled, even with a dirty draft.
2. **New note from page** (`handleNewNoteFromPage`) — drafts over the current dirty draft.
3. **BacklinksPanel row click** → `onOpenNote={handleOpenNote}` — `handleOpenNote` calls `applySelect` with no dirty check.
4. **Resolved wikilink click in Preview** → `onOpen: handleOpenNote` — same.

The 05-07/08 summaries claim "Dirty guard Popconfirms on selection/graph switches" — the guard is incomplete, and a user who typed an unsaved edit then clicks a backlink row, a wikilink, or "New note" loses the draft silently.
**Fix:** Route all four paths through a single guarded navigation helper, e.g.:
```ts
const guardedOpen = useCallback((noteId: string) => {
  if (dirty) { pendingGraphOpenRef.current = noteId; setGraphDiscardPending(true); return; }
  handleOpenNote(noteId);
}, [dirty, handleOpenNote]);
// use guardedOpen for BacklinksPanel onOpenNote + wikilinks onOpen,
// and gate handleNewNote/handleNewNoteFromPage on the same Popconfirm (Discard / Keep editing).
```

## Warnings

### WR-01: §3.4 memory budget violated — working-memory block not counted against the ≤1000-token total

**File:** `src/core/memory/MemoryEngine.ts:192-210`, `src/core/context/ContextPack.ts:56-63`
**Issue:** Spec §3.4 states "total memory injection ≤ 1000 tokens" and §3.6 (L679) states the working-memory block "is injected as part of the memory section and counts against the memory budget (§3.4: ≤ 1000 tokens total…); if over budget, truncate the block **before** dropping retrieved facts". `assemble` enforces `MAX_MEMORY_TOKENS` only against fact memories (L199-210); the ≤300-token WMB rides separately, so the packed memory section (`buildMemorySectionText` joins WMB + fact lines) can reach ~1300 tokens. The mandated degradation order (truncate the block first) is not implemented anywhere — `reduceMemoryTopK` only trims facts to top-3. Golden Rule 6 ("Respect budgets… ≤ 1000 tokens") is a hard project contract; the 05-06 summary's claim "memory ≤1000 tokens … lands in a real stable:true memory section (working memory first)" does not hold for the combined section.
**Fix:** Account for the WMB when applying the cap in `assemble` (e.g., budget facts against `MAX_MEMORY_TOKENS − estimateTokens(workingMemoryBlock)`), or truncate the WMB to fit the combined budget before dropping facts, per §3.6.

### WR-02: reduce-topk reduction undone by the minimal-mode re-pack — spurious CONTEXT_TOO_LARGE

**File:** `src/core/context/ContextOptimizer.ts:369-399`
**Issue:** The ladder order is `reduce-topk` (L369) → `minimal-mode` (L387). When both fire in one turn, `minimal-mode` re-packs via `buildPackInput(input, true, …)`, which rebuilds `memoryText` from the **full** `input.memoryHints` (top-5), discarding the top-3 reduction applied by `reduceMemoryTopK`. A turn where the compact system prompt + top-3 memory would fit the window, but top-5 memory would not, therefore reaches `too-large` and throws `CONTEXT_TOO_LARGE` instead of degrading to the top-3 memory. The two ladder steps work from inconsistent memory sizes.
**Fix:** After minimal-mode re-packs, re-apply the reduce-topk step (or have `buildPackInput`/`reduceMemoryTopK` consume a shared reduced-hints source so both steps see the same memory set). Add a regression test: over-budget input where top-3 memory + compact system fits → must NOT throw.

### WR-03: Wrong canonical error code on save/reconcile failures

**File:** `src/components/pages/NotesPage.tsx:300-305` and `343-347`
**Issue:** The `handleSave` catch (a `putNote`/`getNote` store failure) and the `reconcileAfterSave` catch log `ERROR_CODES.NOTE_LINK_PARSE_FAILED` — a parse-specific code per spec Appendix C.2 (the code is only correct for `parseLinks`/`resolveLinks` failures). The failures being logged are IndexedDB write/read failures, which the Phase-5 code vocabulary (Open Q7, 05-01 summary) reserves for the Phase-2 `STORE_WRITE`/`STORE_READ` codes. Misattributed codes break monitoring/attribution (Golden Rule 9 — canonical codes).
**Fix:** Use `ERROR_CODES.STORE_WRITE` in both catches (or `STORE_READ` for the post-condition read), and reserve `NOTE_LINK_PARSE_FAILED` for actual parse failures.

### WR-04: Three of five Phase-5 canonical error codes are never emitted

**File:** `src/core/error/errorCodes.ts:111-115`
**Issue:** `MEMORY_RETRIEVAL_FAILED`, `NOTE_GRAPH_FAILED`, and `SEARCH_INDEX_REBUILD_FAILED` are declared (and mirrored into spec Appendix C.2 by 05-01) but have **zero call sites** in `src/` (verified by grep). `MemoryEngine` correctly reuses `STORE_READ` for retrieval per Q7 — but `NOTE_GRAPH_FAILED` has no emitter at all (NoteGraphView surfaces errors via props and logs nothing), and `SEARCH_INDEX_REBUILD_FAILED` has no emitter (the `buildNotesIndex`/`buildTitleIndex` calls in NotesPage are unguarded sync calls with no error path). The W-1 spec mirror over-claims five canonical codes for two that can ever fire.
**Fix:** Either emit the codes where the failures occur (wrap index rebuilds and graph derivation in try/catch with `debugLog(SEARCH_INDEX_REBUILD_FAILED / NOTE_GRAPH_FAILED, …)`), or remove the dead codes from errorCodes.ts + spec C.2 — do not ship declared-but-unreachable canonical codes.

### WR-05: `appendTurn` seq fallback overwrites the conversation's first message on index-read failure

**File:** `src/core/memory/ConversationMemoryStore.ts:156-164`
**Issue:** `getMessagesForConversation` swallows read failures and returns `[]` (MemoryDB.ts L182-196). On that failure path `appendTurn` computes `lastSeq = 0`, so the new message is written with `seq: 1` — `putMemoryMessage` uses the composite key `[conversationId, seq]`, so the new turn **overwrites** the conversation's existing seq-1 message. The code comment acknowledges the `messageCount` fallback ("so the compactor trigger never silently resets") but not the seq overwrite; the data-loss mode is real (e.g., a transient IDB error while appending a turn destroys the oldest message).
**Fix:** Fall back to `(existing?.messageCount ?? 0)` as the seq base when the index read fails, and write `seq: (existing?.messageCount ?? 0) + 1`; or skip the write entirely when the read fails (log + return).

### WR-06: `getMemoryEngine().assemble` leaks an IndexedDB connection per call

**File:** `src/core/memory/MemoryEngine.ts:376-381`
**Issue:** `assemble` in the production surface calls `openMemoryDB()` on every invocation and never closes the connection. `useStreamingLLM.send()` calls it twice per turn (planner + renderer tiers), so each chat turn opens two new MemoryDB connections that are never closed — unbounded connection accumulation over a session (browsers cap open IDB connections and this can eventually throw `QuotaExceededError`/`InvalidStateError` at `openDB`).
**Fix:** Open the DB once in the lazy factory and reuse the handle across `assemble` calls (the factory already owns a module-level singleton — hold the `db` promise there), or close the connection after each `assemble` completes.

### WR-07: `useStreamingLLM` assigns `prefs` after the upfront stage invocations — closure contract violated

**File:** `src/components/pages/useStreamingLLM.ts:172-189`, `207`
**Issue:** `prefs` is assigned at L207 (`prefs = plannerInjection.preferences`), but `invocation('planner')` and `invocation('renderer')` are called at L188-189 — before the assignment. The comment (L166-167) claims "privacyModeFromPrefs(prefs) reads it at closure call time, so runAgentTurn's invocations see the store value" — true for the runAgentTurn invocations, **false for the two upfront calls**, which read `privacyModeFromPrefs(undefined)` → `'prefer-local'`. Today `resolveTier` only filters on `'local-only'` (never produced), so the resolved windows are identical and there is no observable bug — but the optimizer's per-stage budgets are derived from the upfront windows, and any future use of privacyMode in tier resolution would silently desync the budgets from the actual invocations. Fragile late-binding ordering.
**Fix:** Assign `prefs` before the upfront `invocation('planner'/'renderer')` calls (e.g., derive the planner injection first, assign `prefs`, then resolve both stages), or pass the privacy mode explicitly after the injection resolves.

### WR-08: WikilinkAutocomplete swallows Shift+Enter — no newline while the dropdown is open

**File:** `src/components/notes/WikilinkAutocomplete.tsx:128-133`
**Issue:** The imperative `handleKeyDown` inserts on any `Enter` key regardless of modifiers; the page forwards every TextArea keydown while `effectiveWikiOpen`. In the 8-row body TextArea, Shift+Enter (the universal newline shortcut) therefore inserts `[[Title]]` instead of a newline whenever the autocomplete is open. The handler's `{ key, preventDefault }` contract doesn't even receive `shiftKey`.
**Fix:** Accept the full keydown event (or add `shiftKey`), and let `Shift+Enter` fall through to the TextArea default (insert newline) instead of calling `onInsert`.

## Info

### IN-01: BacklinksPanel collapse tooltip ternary is dead — both branches identical

**File:** `src/components/notes/BacklinksPanel.tsx:51`
**Issue:** `title={expanded ? STR.notes.backlinks : STR.notes.backlinks}` — both branches are the same string, so the collapse/expand affordance tooltip never distinguishes state.
**Fix:** Use distinct copy for expanded vs collapsed (or drop the ternary and use the plain key).

### IN-02: `applySelect` performs setState side effects inside the `setAllNotes` updater

**File:** `src/components/pages/NotesPage.tsx:215-231`
**Issue:** `setSelectedId`/`setDraft`/`setDirty`/`setMode` are invoked inside the `setAllNotes` updater function. React requires updater functions to be pure; they run twice under StrictMode dev and may run out of order under concurrent scheduling. Harmless today (idempotent), but it's an anti-pattern that risks subtle bugs (and the selection silently no-ops when the note is not in `allNotes`).
**Fix:** Read the current list from a ref or `getAllNotes`-style accessor, or restructure so `applySelect` resolves the note first and then dispatches the state updates directly.

### IN-03: `relativeTime` hardcodes locale `'en'`

**File:** `src/components/pages/NotesPage.tsx:109-117`
**Issue:** `new Intl.RelativeTimeFormat('en', …)` ignores the user's `preferredLanguage` preference (the project has a `STR.*` i18n layer and a `preferredLanguage` preference field). Note timestamps render in English for all users.
**Fix:** Thread the locale from the preference store (or the i18n layer) instead of the literal `'en'`.

### IN-04: NoteGraphView renders all nodes at (0,0) before the first tick; layout restarts on every list refresh

**File:** `src/components/notes/NoteGraphView.tsx:112-153`
**Issue:** `positions` starts `null`; the SVG renders one frame with every node/edge at origin (0,0) before the first simulation tick (non-reduced-motion path) or the synchronous `tick(300)` (reduced-motion path). Additionally, the effect deps `[nodes, edgeList, …]` restart the simulation from scratch (fresh random initial layout) on every `note:saved` list refresh while the user is in Graph view — the graph visibly re-randomizes on each save.
**Fix:** Initialize node positions before first render (e.g., deterministic phyllotaxis fallback when `positions` is null) and/or preserve existing positions across restarts (seed the new simulation with the previous coordinates).

---

_Reviewed: 2026-08-14T06:30:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
