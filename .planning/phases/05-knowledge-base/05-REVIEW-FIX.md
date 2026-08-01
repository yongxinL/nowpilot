---
phase: 05-knowledge-base
fixed_at: 2026-08-02T09:25:00Z
review_path: .planning/phases/05-knowledge-base/05-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-08-02T09:25:00Z
**Source review:** `.planning/phases/05-knowledge-base/05-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (CR-01, WR-01..WR-09 — Info findings untouched per scope)
- Fixed: 10
- Skipped: 0

## Fixed Issues

### CR-01: LRU re-activation leaves a conversation in BOTH active and archived — active conversations can be evicted (data loss)

**Files modified:** `src/core/memory/MemoryEngine.ts`, `tests/core/memory/MemoryEngine.test.ts`
**Commit:** `1a8ceae`
**Applied fix:** `trackConversationActivity()` promotion (step 2) now removes the conversation id from `archived` before pushing to `active`, so a conversation is never in both sets. Step 1 and step 3 archive pushes are deduped with `includes` guards. Eviction (step 4) can therefore never delete data of a currently-active conversation. Test 12's expectation corrected from the double-counted `{ active: 1, archived: 3, total: 4 }` to the distinct-membership `{ active: 1, archived: 2, total: 3 }` (3 distinct conversations: conv-a active, conv-b + conv-c archived).

### WR-01: MiniSearch index is never persisted or loaded — search is empty after every extension restart

**Files modified:** `src/core/notes/NotesDB.ts`, `src/core/knowledgeBaseBootstrap.ts` (new), `src/main.tsx`, `src/components/sidepanel/SidePanelShell.tsx`, `src/components/app/AppShell.tsx`, `tests/core/notes/NotesDB.test.ts`
**Commit:** `26ab6c2`
**Applied fix:** `NotesDB.save()`'s `update-index` journal step now calls `noteSearchIndex.persist()` after each mutation, and `NotesDB.remove()` persists the removal — the persisted `index` record stays current. New `initializeKnowledgeBase(surfaceId)` startup bootstrap calls `noteSearchIndex.load()` before any search; wired into every production entrypoint (web preview `main.tsx`, `SidePanelShell`, `AppShell`). Two new tests prove a fresh index instance restores a saved note and no longer finds a deleted note after `load()`.

### WR-02: NotesStore mirror diverges from persisted note after save

**Files modified:** `src/core/storage/NotesStore.ts`, `tests/core/storage/NotesStore.test.ts`
**Commit:** `7e45b2e`
**Applied fix:** `saveNote()` now re-fetches the persisted note via `notesDb.get(result.noteId)` after a successful save and mirrors the *derived* record (resolved `links[]`, bumped `version`, fresh `updatedAt`) instead of the raw input; falls back to the input only if the re-fetch fails. Tests updated to assert the mirror holds the persisted note and replaced existing entries; a fallback-path test added.

### WR-03: MemoryEngine.write() can never persist working/episodic/preference records — the D-05 AI-write path is dead code

**Files modified:** `src/core/memory/MemoryEngine.ts`, `tests/core/memory/MemoryEngine.test.ts`
**Commit:** `4e0df20`
**Applied fix:** `MemoryWriteInput` extended with optional `conversationId`/`role` (required for working/episodic); new exported `persistMemoryRecord()` routes by `memoryType` — semantic/procedural → `UserMemoryStore.upsert`, preference → `PreferenceMemoryStore.set` (content convention `JSON.stringify({ key, value })`), working/episodic → `ConversationMemoryStore.appendMessage`. The `write-memory-record` journal executor uses it; `incrementUseCount` now runs only for semantic facts (preferences/messages no longer inflate the D-08 counter). Tests added: preference write lands in `PreferenceMemoryStore` (and not the semantic set), AI-pipeline working write appends a conversation message, missing `conversationId`/`role` is rejected.

### WR-04: MEM-02 single-writer election is never invoked and cannot propagate across surfaces

**Files modified:** `src/core/runtime/BroadcastBus.ts`, `tests/core/runtime/BroadcastBus.test.ts` (new), `src/core/knowledgeBaseBootstrap.ts`, `src/main.tsx`, `src/components/sidepanel/SidePanelShell.tsx`, `src/components/app/AppShell.tsx`
**Commits:** `91f4ad1` (mechanism + tests), `26ab6c2` (production call path via bootstrap/entrypoints)
**Applied fix:** `setPrimarySurfaceId()` now broadcasts a `PRIMARY_SURFACE_ELECTED` message on the existing BroadcastChannel and every context lazily subscribes, applying remote elections — all surface contexts converge on the same primary (previously module-local per context, so the gate was a no-op across surfaces). New `BroadcastBus.test.ts` covers election semantics, the broadcast, and remote-election application. Production callers added: `initializeKnowledgeBase(surfaceId)` (called by `main.tsx`, `SidePanelShell`, `AppShell`) sets `globalThis.__NOWPILOT_SURFACE_ID__` and elects the surface as primary at startup — the MEM-02 gate is now effective (secondary contexts become read-only; last election wins across contexts).

### WR-05: WriteJournal replay is never wired — phase-5 journal steps have no registered executors

**Files modified:** `src/core/storage/WriteJournal.ts`, `src/core/notes/NotesDB.ts`, `src/core/memory/MemoryEngine.ts`, `src/core/knowledgeBaseBootstrap.ts`, `tests/core/integration/phase05.test.ts`
**Commit:** `af14554`
**Applied fix:** WriteJournal gains an executor registry (`registerStepExecutor`) and optional `payload` on entries — `createEntry` now accepts a payload, and `NotesDB.save()` persists the derived `finalNote` while `MemoryEngine.write()` persists the `record`, making interrupted steps genuinely recoverable. `replayJournal()`/`repairEntry()` fall back to the registry when no map is passed and hand the entry (payload/targetIds) to executors. The bootstrap registers executors for `write-note` (restore payload via new `NotesDB.restore()`, or verify store presence and fail honestly), `update-index` (idempotent rebuild + persist), `write-memory-record` (re-route via `persistMemoryRecord`; entries without payload fail honestly), and `broadcast-workspace-update`; `initializeKnowledgeBase()` invokes `replayJournal()` at startup. New integration test simulates a crash between `write-note` and `update-index` (entry stuck `applying`, stale index) and verifies replay completes the entry and rebuilds + persists the index.

### WR-06: Summarization prompt delimiter can be broken by message content — indirect prompt-injection vector

**Files modified:** `src/core/memory/ConversationMemoryStore.ts`, `tests/core/memory/ConversationMemoryStore.test.ts`
**Commit:** `060912b`
**Applied fix:** New `sanitizeExcerpt()` strips `<data-source>`/`</data-source>` sequences and redacts standalone `Summary:` lines from message content before interpolation, making the delimiter collision-proof. An invariant assertion after assembly refuses to call the model (new `DELIMITER_ERROR` result code) if the prompt ever contains other than exactly one delimiter pair. Test: message content containing `</data-source>` + a bare `Summary:` line is neutralized — the assembled prompt has exactly one pair, no injected breakout.

### WR-07: Search snippets embed raw note content as HTML — stored-XSS risk at render time

**Files modified:** `src/core/notes/MiniSearchNoteIndex.ts`, `tests/core/notes/MiniSearchNoteIndex.test.ts`
**Commit:** `b7ce116`
**Applied fix:** `buildSnippet()` wraps matched terms with private-use placeholder tokens, HTML-escapes the entire excerpt (`&`/`<`/`>` → entities), then restores only the tokens to `<mark>` tags — `<mark>` is the only markup a snippet can ever contain; content-originated `<img>`/`<script>` etc. render as inert text. Test asserts payload markup is escaped while the query-term highlight survives.

### WR-08: loadPersonaFromMemory casts stored JSON to PersonaProfile without validation

**Files modified:** `src/core/ai/persona/PersonaInjector.ts`, `tests/core/integration/phase05.test.ts`
**Commit:** `1810f4e`
**Applied fix:** `loadPersonaFromMemory()` validates the stored `np_persona` with the existing `PersonaProfileSchema`; any malformed value (bad tone, non-array `coreValues`, missing fields) falls back to `DEFAULT_PERSONA` instead of crashing `buildPersonaBlock()` (`coreValues.sort()` TypeError) or injecting `undefined`. New integration test stores a malformed persona and asserts the fallback + healthy render path. **Note:** the pre-existing persona-integration test stored `tone: 'formal'`, which is outside the schema enum — the validation fix correctly rejects it, so the test data was corrected to a valid enum value (`'professional'`).

### WR-09: appendMessage seq assignment races — concurrent appends silently overwrite each other

**Files modified:** `src/core/memory/ConversationMemoryStore.ts`, `tests/core/memory/ConversationMemoryStore.test.ts`
**Commit:** `e64f35e`
**Applied fix:** `appendMessage()` now derives `seq` with a key cursor over `[conversationId, *]` and puts the message inside ONE readwrite transaction — the count+put are atomic, so concurrent appends (rapid turns, or appends racing eviction) can no longer compute the same `seq` and overwrite each other. New test races 10 appends from two connections (module + a second raw connection, mirroring the per-surface module-instance topology) and asserts all 10 messages survive with distinct seqs. **Implementation note:** the test pre-opens the module connection before launching concurrent transactions — fake-indexeddb under jsdom wedges when a lazy `openDB`/migrate interleaves another connection's in-flight transactions (reproduced in isolation; real IndexedDB serializes correctly).

---

_Fixed: 2026-08-02T09:25:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
