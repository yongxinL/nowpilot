---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 07
subsystem: storage
tags: [indexeddb, idb, chat-history, notes, memory, fake-indexeddb, storage-01]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: 02-01 storage foundation — idb@8 + fake-indexeddb harness, WriteJournal types, canonical STORE_READ/STORE_WRITE codes, per-domain types precedent
provides:
  - ChatHistoryDB (src/core/storage/ChatHistoryDB.ts): ChatSession/ChatMessage verbatim §21.1, sessions + messages stores keyed by 'id' with by-session/by-timestamp indexes, putSession/getSession/listSessions/putMessage/getMessagesForSession/deleteSession (session + orphaned messages in one readwrite tx)
  - NotesDB (src/core/storage/NotesDB.ts): Note verbatim §21.2 (incl. LLM-Wiki optional fields) + Concept, notes (by-updated/by-tags multiEntry indexes) + concepts (slug keyPath) stores, putNote/getNote/listNotes/deleteNote/getNoteByTitle/putConcept/getConcept/listConcepts
  - MemoryDB (src/core/storage/MemoryDB.ts): MemoryMessage verbatim §21.3 with composite keyPath [conversationId, seq] + by-conversation index, Fact verbatim §21.4 + ConversationSummary, putMemoryMessage/getMessagesForConversation/putFact/getFact/listFacts/putConversationSummary/getConversationSummary
  - 11 new unit tests (ChatHistoryDB 4 + NotesDB 4 + MemoryDB 3) via fake-indexeddb with fresh IDBFactory per test — all §21-verbatim shape + index-isolation + orphan-cleanup contracts proven
  - Message bodies now have their ONLY permitted persistence home (IndexedDB, §0.2/Pitfall 4) — read-ready for Phase 3 (chat/memory) and Phase 5 (notes) consumers
affects: [02-08 redaction hooks, 02-09 import/export (chat-history/notes/memory groups), 02-11 verification, Phase 3 chat/memory, Phase 5 notes/knowledge, phase-11 privacy gate (body-never-in-local grep)]

# Tech tracking
tech-stack:
  added: [] # no new dependencies — idb@8 + fake-indexeddb from 02-01
  patterns:
    - "idb openDB with strict DBSchema typing + NON-throwing upgrade (RESEARCH Pattern 1) — the migrator happy path; future schema changes register a DBVersionMigration with 02-06"
    - "Store data models co-located with their store files, VERBATIM §21.x, with header comments citing spec line ranges"
    - "Typed CRUD functions take the opened IDBPDatabase handle as first arg; every catch → debugLog(STORE_READ/STORE_WRITE) (Golden Rule 9); write paths never throw"
    - "Composite keyPath ['conversationId','seq'] + by-conversation index = the §20.2 idempotency key; index isolation proven by an interleaving test"
    - "fake-indexeddb per-test isolation via indexedDB = new IDBFactory() in beforeEach (RESEARCH Pattern 8 documented reset)"

key-files:
  created:
    - src/core/storage/ChatHistoryDB.ts
    - src/core/storage/NotesDB.ts
    - src/core/storage/MemoryDB.ts
    - tests/core/storage/ChatHistoryDB.test.ts
    - tests/core/storage/NotesDB.test.ts
    - tests/core/storage/MemoryDB.test.ts
  modified: []

key-decisions:
  - "deleteSession removes session AND messages in ONE readwrite transaction via the by-session index cursor (T-2-07-03) — bodies would be orphaned otherwise; a sibling session's messages are untouched (asserted)"
  - "getMessagesForSession orders by timestamp after the by-session index fetch — the index groups by sessionId; the §21.1 sequence requires the timestamp sort"
  - "getNoteByTitle implemented as an in-memory scan over the notes store (the plan's sanctioned option) — §15.1 has no title index, so no extra index is invented"
  - "by-tags index uses multiEntry: true — tags is string[]; single-key indexing would store the whole array as one key and make tag lookups impossible"
  - "MemoryMessage.role inlined as 'system'|'user'|'assistant'|'tool' — verbatim §21.3's LLMMessage['role'] (Appendix C line 4265) with LLMMessage itself arriving Phase 3; avoids importing a not-yet-existing type"

patterns-established:
  - "Pattern 1: store file anatomy — spec-verbatim interfaces (line-cited header) + DBSchema + DB_VERSION const + open<Name>DB() with non-throwing upgrade + db-handle-first typed CRUD + debugLog on every catch"
  - "Pattern 2: fake-indexeddb test anatomy — indexedDB = new IDBFactory() in beforeEach, db.close() in afterEach, plain idb openDB upgrades (no throwing migrations — RESEARCH Pitfall 1)"

requirements-completed: [STORAGE-01]

coverage:
  - id: D1
    description: "ChatHistoryDB — sessions + messages IndexedDB store with §21.1-verbatim ChatSession/ChatMessage, by-session/by-timestamp indexes, typed CRUD incl. deleteSession removing session + orphaned messages"
    requirement: STORAGE-01
    verification:
      - kind: unit
        ref: "tests/core/storage/ChatHistoryDB.test.ts#round-trips putSession + putMessage through getSession and getMessagesForSession"
        status: pass
      - kind: unit
        ref: "tests/core/storage/ChatHistoryDB.test.ts#getMessagesForSession returns only that session's messages ordered by timestamp"
        status: pass
      - kind: unit
        ref: "tests/core/storage/ChatHistoryDB.test.ts#deleteSession removes the session AND its orphaned messages via index iteration"
        status: pass
    human_judgment: false
  - id: D2
    description: "NotesDB — notes + concepts IndexedDB store with §21.2-verbatim Note (incl. LLM-Wiki optional fields) + Concept, by-updated/by-tags indexes, typed CRUD incl. the §15.1 getNoteByTitle exact-title lookup"
    requirement: STORAGE-01
    verification:
      - kind: unit
        ref: "tests/core/storage/NotesDB.test.ts#round-trips putNote/getNote/listNotes with the full §21.2 Note shape"
        status: pass
      - kind: unit
        ref: "tests/core/storage/NotesDB.test.ts#getNoteByTitle finds by exact title"
        status: pass
      - kind: unit
        ref: "tests/core/storage/NotesDB.test.ts#round-trips putConcept/getConcept/listConcepts keyed by slug"
        status: pass
    human_judgment: false
  - id: D3
    description: "MemoryDB — composite-keyed messages store (keyPath [conversationId, seq]) + userFacts + conversationSummaries with §21.3/§21.4-verbatim models, typed CRUD, cross-conversation isolation"
    requirement: STORAGE-01
    verification:
      - kind: unit
        ref: "tests/core/storage/MemoryDB.test.ts#isolates conversations under the composite key [conversationId, seq] and orders by seq"
        status: pass
      - kind: unit
        ref: "tests/core/storage/MemoryDB.test.ts#round-trips putFact/getFact/listFacts with the §21.4 verbatim shape"
        status: pass
      - kind: unit
        ref: "tests/core/storage/MemoryDB.test.ts#round-trips putConversationSummary/getConversationSummary keyed by conversationId"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-08-09
status: complete
---

# Phase 2 Plan 7: The Three Message-Body IndexedDB Stores Summary

**ChatHistoryDB, NotesDB, and MemoryDB shipped via idb with strict DBSchema typing — §21-verbatim data models, per-§15.1 keyPaths/indexes, typed CRUD with debugLog-on-every-catch (Golden Rule 9), and 11 fake-indexeddb unit tests proving round-trips, index isolation, exact-title lookup, composite-key isolation, and orphan cleanup — giving conversation bodies, note content, and memory bodies their only permitted persistence home in IndexedDB (never chrome.storage.local)**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-09T04:30:06Z
- **Completed:** 2026-08-09T04:40:42Z
- **Tasks:** 3 (each TDD: RED + GREEN = 6 commits)
- **Files modified:** 6 created

## Accomplishments

- **ChatHistoryDB** (`src/core/storage/ChatHistoryDB.ts`) — sessions + messages stores per §15.1 (lines 1950-1953), ChatSession/ChatMessage verbatim §21.1 (lines 3329-3353). `openChatHistoryDB()` via idb `openDB` with a non-throwing upgrade (the migrator happy path — no migration history yet), by-session + by-timestamp indexes. Typed CRUD: putSession/getSession/listSessions/putMessage/getMessagesForSession (timestamp-ordered via the by-session index)/deleteSession — which removes the session AND its orphaned messages through one readwrite transaction iterating the index (T-2-07-03).
- **NotesDB** (`src/core/storage/NotesDB.ts`) — notes + concepts stores per §15.1 (lines 1954-1958), Note verbatim §21.2 (lines 3357-3384, including the LLM-Wiki optional fields summary/categoryPath/summaryGeneratedAt/tagsGeneratedAt and the aiMeta block) + Concept. by-updated + by-tags (multiEntry) indexes on notes, slug keyPath on concepts. Typed CRUD incl. the §15.1 `getNoteByTitle()` exact-title lookup (in-memory scan — the plan's sanctioned option).
- **MemoryDB** (`src/core/storage/MemoryDB.ts`) — messages (keyPath `['conversationId','seq']`, by-conversation index) + userFacts + conversationSummaries per §15.1 (lines 1959-1962), MemoryMessage verbatim §21.3 (lines 3391-3407) + Fact verbatim §21.4 (lines 3413-3419) + ConversationSummary. Typed CRUD: putMemoryMessage/getMessagesForConversation (seq-ordered via the index — the composite key IS the §20.2 idempotency key, T-2-07-02)/putFact/getFact/listFacts/putConversationSummary/getConversationSummary.
- **11 new unit tests** (ChatHistoryDB 4, NotesDB 4, MemoryDB 3) using the fake-indexeddb harness with `indexedDB = new IDBFactory()` per test (RESEARCH Pattern 8 documented reset) — proving round-trips, per-session/per-conversation isolation with interleaved data, timestamp/seq ordering, exact-title lookup, deleteNote/deleteSession removal, and orphan-message cleanup.
- **Full suite green:** `pnpm vitest run` 212/212 tests across 34 files; `pnpm typecheck` clean; eslint + prettier clean on all touched files.

## Task Commits

Each task was committed atomically (TDD RED + GREEN per task):

1. **Task 1: ChatHistoryDB.ts — sessions + messages stores** - `9e02bc3` (test) + `75c588a` (feat)
2. **Task 2: NotesDB.ts — notes + concepts stores, getNoteByTitle()** - `17e5208` (test) + `1352ad9` (feat)
3. **Task 3: MemoryDB.ts — [conversationId, seq] messages + userFacts + summaries** - `5a26b00` (test) + `72ea457` (feat)

**Plan metadata:** pending (docs: complete plan) — this SUMMARY.md commit.

## Files Created/Modified

- `src/core/storage/ChatHistoryDB.ts` - Created. Sessions + messages stores, §21.1-verbatim models, typed CRUD, deleteSession orphan cleanup
- `src/core/storage/NotesDB.ts` - Created. Notes + concepts stores, §21.2-verbatim models (incl. LLM-Wiki fields), getNoteByTitle
- `src/core/storage/MemoryDB.ts` - Created. Composite-keyed messages + userFacts + conversationSummaries, §21.3/§21.4-verbatim models
- `tests/core/storage/ChatHistoryDB.test.ts` - Created. 4 tests: round-trip, per-session isolation + timestamp order, session listing, orphan cleanup
- `tests/core/storage/NotesDB.test.ts` - Created. 4 tests: round-trip with full Note shape, exact-title lookup, deleteNote, concepts round-trip
- `tests/core/storage/MemoryDB.test.ts` - Created. 3 tests: composite-key isolation + seq order, facts round-trip, summaries round-trip

## Decisions Made

- **deleteSession = single atomic transaction** (T-2-07-03): session row + every message via the by-session index cursor in one readwrite tx — no orphaned bodies, sibling sessions untouched (asserted in test).
- **getMessagesForSession sorts by timestamp post-fetch** — the by-session index groups but does not order by timestamp; the §21.1 sequence needs the explicit sort.
- **getNoteByTitle = in-memory scan** — §15.1 has no title index, so no extra index invented (plan-sanctioned option).
- **by-tags uses multiEntry: true** — tags is `string[]`; without multiEntry the whole array would be a single unusable index key.
- **MemoryMessage.role inlined** as `'system'|'user'|'assistant'|'tool'` — that IS `LLMMessage['role']` (Appendix C line 4265); LLMMessage itself is a Phase-3 type not yet in src, so importing it would break typecheck.
- **Typed CRUD takes the db handle as first arg** — the caller opens once via `open<Name>DB()` and passes the handle; consistent across all three stores.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test over-asserted listConcepts insertion order**
- **Found during:** Task 2 (NotesDB GREEN run)
- **Issue:** The concepts test asserted `listConcepts` returns `['mysql', 'llm']` (insertion order), but IndexedDB `getAll` returns records in **key (slug) order** — `['llm', 'mysql']`. Ordering is not part of the §15.1/§21.2 contract.
- **Fix:** Relaxed the assertion to membership (`sort()` before compare) with a comment noting key order is the IndexedDB behavior, not a store contract.
- **Files modified:** tests/core/storage/NotesDB.test.ts
- **Verification:** `pnpm vitest run tests/core/storage/NotesDB.test.ts` 4/4 pass
- **Committed in:** `1352ad9` (Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minimal — the test now asserts the actual contract (membership) rather than an implementation artifact of IndexedDB's key-order getAll.

## Issues Encountered

- **LSP stale-module noise:** The language server reported `Cannot find module '@/core/storage/...'` errors for the newly-created store files during the session; these were stale LSP state — the project's real `pnpm typecheck` (tsc --noEmit) exits 0 with zero errors on every gate. Non-blocking.
- **Pre-existing EncryptedStorage.test.ts LSP warnings** (`Uint8Array<ArrayBufferLike>` vs `Uint8Array<ArrayBuffer>`) in a file from plan 02-03 — absent from `pnpm typecheck` output (project tsc is clean); out of scope for this plan (scope boundary: pre-existing, unrelated to these tasks).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **STORAGE-01 progress:** three of four IDB stores ship here (ErrorStore arrives with 02-06's migrator); all open via idb with strict DBSchema typing, §21-verbatim models, and debugLog-every-catch.
- **Read-ready for consumers:** Phase 3 (chat/memory) can call `openChatHistoryDB()`/`openMemoryDB()`; Phase 5 (notes) calls `openNotesDB()` + `getNoteByTitle()`. Bodies live exclusively in IndexedDB (A-15: nothing in this plan's code touches chrome.storage for bodies).
- **Migrator hook-up point:** these stores declare `DB_VERSION = 1` and open via plain non-throwing `openDB` — 02-06's IndexedDBMigrator registers future DBVersionMigrations against them; migration failures flow to degraded mode (D-12).
- **No blockers** — full suite 212/212 green; typecheck clean; next up: 02-08 redaction hooks.

---
*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-09*
