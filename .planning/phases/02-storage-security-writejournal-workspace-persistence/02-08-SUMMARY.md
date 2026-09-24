---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 08
subsystem: store
tags: [zustand, persist, np-store, schema-v3, hydration, d2-17, d2-18, d2-20, chat-history-db, partial-failure, redaction, wave-4]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-05's `projectNpStoreV3` / `NP_STORE_V3_FIELDS` / `NP_STORE_V3_SCHEMA_VERSION` — the single owner of the surviving `np_store` field set — and `runLegacyChatMigration` with its resumable, non-terminal failure contract"
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-02's `np_db` spine: `ChatHistoryDB.readConversation()`/`readAllConversations()` with strict boundary validation, `NowPilotDB.getDb()`/`NowPilotDbOpenError`, and `WriteJournal.recoverJournal()`"
provides:
  - "src/store/useExtensionStore.ts — `NP_STORE_SCHEMA_VERSION = 3`, `PERSISTED_BLOB_FIELDS` (the imported v3 allow-list), the `projectNpStoreV3`-delegated `npStoreMigrate` and `partialize`, a conversation-refusing `merge`, `HydrationStatus`, `HydrationError`, `ChatHydrationDeps`, `hydrationStatus`, `hydrationError`, `hydrateChatHistory()`, `retryHydration()`"
  - "src/core/storage/ChatHistoryDB.ts — `readAllConversations()` now resolves `{ ok: true; sessions; invalidIds }`, applying D2-20's partial-failure policy to the list read"
  - "tests/core/store/useExtensionStore.test.ts — 24 cases: the v2 credential/theme assertions, the v3 body-free projection, the six hydration states, the no-fallback rule, a partial installation, a malformed record, the retry path, fixture separation and the rehydrate-failure net"
affects: [02-09, 02-10, 02-13, phase-03-provider, phase-08-memory, phase-15]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 12711
  tasks: 2
  commits: 3
plan_head_before: 0121d9bef11382b4605dea43912be5164c73fe4f

tech-stack:
  added: []
  patterns:
    - "The store is a rendering projection with an injected read port: `ChatHydrationDeps` carries the production defaults and tests inject the explicit adapter D2-20 sanctions, so the store opens no store of its own and constructs no transaction"
    - "One hydration per document: a module-level in-flight promise makes a double-invoked mount effect join the running read path instead of starting a second one"
    - "`empty` is published only by a successful read that found nothing; every failure resolves a typed redacted code, and `failed` vs `recovery required` is decided by whether resumable journal state remains"
    - "The persisted projection is the source allow-list: `partialize` and `npStoreMigrate` both delegate to `projectNpStoreV3`, so the store can never persist a field the migration would drop — and `merge` refuses the persisted conversation collection outright"
    - "A malformed record is excluded, not fatal: the list read reports safe ids and a per-conversation read failure skips that conversation while the rest hydrate (D2-20's partial-failure policy)"
    - "Redaction by structure: every failure code is read from the error's `code` property, never its message, and a skipped record is logged by safe id only"

key-files:
  created: []
  modified:
    - src/store/useExtensionStore.ts
    - src/core/storage/ChatHistoryDB.ts
    - tests/core/store/useExtensionStore.test.ts

key-decisions:
  - "`PERSISTED_BLOB_FIELDS` is the imported `NP_STORE_V3_FIELDS` alias rather than a second declaration: the plan's key_link forbids restating the surviving field set, so the source projection and the store projection cannot drift. The suite asserts the list is exactly `['config','prompts','writeHistory','notes']`."
  - "`partialize` is the v3 allow-list (`projectNpStoreV3(state)`), not 'state minus three transient fields'. That is what makes a hydrated conversation unable to be written back to `chrome.storage`, and it drops the hydration status and every other transient field by construction."
  - "`merge` refuses the persisted conversation collection and the persisted active-conversation id (D2-17 step 7): the in-memory collection is preserved as-is, and the blob's values are ignored. A corrupt v3 blob carrying bodies can therefore never become the runtime projection."
  - "`hydrateChatHistory(deps?)` returns the terminal `HydrationStatus` and takes the injectable seams; `retryHydration()` takes none and re-runs the production path. Both share the module-level in-flight guard."
  - "`recoverJournal` is called from the hydration entry point with the migration as its replay: this is the production call site WINDOWS #23 recorded as missing, and 02-10's startup sequence expects it. `compactJournal` still has no caller."
  - "`failed` vs `recovery required`: a database open/list/read failure is `failed` (no journal state is known to remain); a migration failure is `recovery required`, because 02-05's failure contract always leaves the entry non-terminal and resumable; an unreadable journal is also `recovery required`."
  - "The projection never derives `preview`: it is a body excerpt (D2-08) with no canonical home (§21.3's `ConversationMeta` has no preview), so the field is projected empty and is not persisted. `group` is derived from the record's integer `updated` because `ChatHistoryModal` groups by it."
  - "A `'tool'` message role projects as `'system'`: `MessageRecord` models four roles, the component-facing `Message` union three, and widening the component contract is not this plan's to make."
  - "`readAllConversations()` gained `invalidIds` instead of a new function: the plan's must-have ('the remaining conversations still hydrate') is unreachable through a strict whole-read abort, and the existing name is what 02-02's handoff note names."

patterns-established:
  - "`empty` is a success state only: the state machine has no path from an error to `empty`, and the suite asserts it explicitly for a database error, a list-read error and a malformed record."
  - "The persisted blob is a projection of the allow-list on both the write path (`partialize`) and the read path (`npStoreMigrate`), so a legacy blob at any version is rebuilt rather than filtered."
  - "Absence assertions carry a non-vacuity control: the suite asserts the sentinel body is present in the legacy input before asserting it is absent from the migrated blob, the storage map, the store's projection and the log ring buffer."

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "`np_store` v3: `NP_STORE_SCHEMA_VERSION = 3`, a body-free `PERSISTED_BLOB_FIELDS`, `npStoreMigrate`/`partialize` delegating to `projectNpStoreV3`, and a `merge` that refuses the persisted conversation collection while keeping the collection/identifier normalisation and the `NP_STORE_REHYDRATE_FAILED` net"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/store/useExtensionStore.test.ts — 'migrate(v2Blob, 2) keeps the surviving fields only: no conversations, no active id, no excerpt', 'a synthetic body in the stored v2 blob does not survive the v3 migration', 'migrate is total…', 'a rehydrate failure still records NP_STORE_REHYDRATE_FAILED'"
        status: pass
    human_judgment: false
  - id: D2
    description: "The asynchronous hydration contract: `hydrationStatus` starting at `idle`, `hydrationError`, `hydrateChatHistory()` running the D2-17 order (initialise → recover → migrate → read → validate → project → publish) and `retryHydration()` re-driving a failure through the production path"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/store/useExtensionStore.test.ts — 'runs the D2-17 order and publishes idle → hydrating → ready', 'resolves empty only from a successful read that found nothing', 'retryHydration re-drives a failed hydration to ready'"
        status: pass
    human_judgment: false
  - id: D3
    description: "The no-silent-empty and no-legacy-fallback rules: a database error and a list-read error resolve `failed` with the typed code and never `empty`; with the database unavailable and a legacy body in `chrome.storage.local`, no body substring reaches the session collection, the persisted projection or the log ring buffer"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/store/useExtensionStore.test.ts — 'a database failure resolves failed with the typed code and never empty', 'a conversation-list read failure resolves a typed failure and never empty', 'no legacy fallback: an unavailable database leaves the legacy body out of the session collection'"
        status: pass
    human_judgment: false
  - id: D4
    description: "The partial-failure policy: a partially migrated installation hydrates the verified conversations while the status stays a non-empty error state; one malformed conversation is excluded by safe id only, the rest still hydrate, and nothing logs body text; fixtures never write to the database, never mark hydration successful and never override a persisted conversation"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/store/useExtensionStore.test.ts — 'a partially migrated installation hydrates the verified conversations and reports the error state', 'one malformed conversation is excluded by safe id and the rest still hydrate', 'fixture chat states stay separated from production hydration'"
        status: pass
      - kind: integration
        ref: "npx vitest run tests/core/storage (9 files / 113 tests) — 02-02's `readAllConversations` contract survives the additive `invalidIds`"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cross-plan contract: `npStoreMigrate` imports `projectNpStoreV3` rather than restating the field list, and `hydrateChatHistory()` calls `runLegacyChatMigration` and `recoverJournal` rather than re-implementing them"
    requirement: "CORE-02"
    verification: []
    human_judgment: true
    rationale: "A cross-plan import contract is asserted structurally by the suite (the exported `PERSISTED_BLOB_FIELDS` identity and the injected-seam defaults), but whether the delegation is the right shape for 02-05's ownership is a reading judgement; a verifier should confirm the store restates no copy of the surviving field set and that the read path calls the migration module."

duration: 24 min
completed: 2026-09-24
status: complete
---

# Phase 2 Plan 08: `np_store` v3 Cutover and Asynchronous Hydration Summary

**The chat store stopped persisting conversations: `np_store` is at v3 with a body-free allow-list rebuilt by 02-05's `projectNpStoreV3`, and the store now exposes D2-18's six frozen hydration states over an injected D2-17 read path — proved by 24 cases including a real unavailable-database run that leaves a legacy body in `chrome.storage.local` and out of the session collection.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-24T00:53:00Z
- **Completed:** 2026-09-24T01:17:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- **The body has nowhere left to live in `chrome.storage`.** `NP_STORE_SCHEMA_VERSION` is 3, and both halves of the projection delegate to `projectNpStoreV3` — `partialize` on the write path and `npStoreMigrate` on the read path — so the surviving set is exactly `config`, `prompts`, `writeHistory`, `notes`. The suite reads the *storage map*, not the store's memory: a seeded v2 blob with a sentinel body and a 50-char `preview` produces a stored blob at version 3 with no body substring (full value, excerpt prefix and fragments) and no `sessions`/`activeSessionId`/`preview` key.
- **`merge` no longer trusts the blob for conversations.** D2-17 step 7 says the legacy `np_store` bodies must never be a runtime fallback, and a *corrupt v3* blob carrying `sessions` would have been adopted by the old spread. The in-memory collection is now preserved as-is, the persisted `activeSessionId` is ignored, and the hydration status is forced back to the runtime value — so a blob can neither seed conversations nor publish a status.
- **D2-18's states exist as behaviour, not as a type.** `idle → hydrating → ready` is observed *from inside every seam* (proving the status is published before the work), `empty` is reached only by a successful read that found nothing, and the failure cases resolve `failed` with the typed redacted code. `failed` and `recovery required` are separated by the real contract: a migration failure always leaves 02-05's journal entry non-terminal and resumable, so it is `recovery required`; a database open/list/read failure is `failed`.
- **The no-fallback rule is proved on a real path.** The case injects a failure through the migrator's own seam, seeds a legacy v2 blob into the storage map, and runs the *production* read path: the status is `failed` with `IDB_MIGRATION_FAILED`, the session collection is empty, and no body fragment appears in the store's persisted projection or the log ring buffer. The retry case then re-drives the same store through the production path against a real `np_db` conversation and reaches `ready`.
- **A malformed record is excluded, never fatal and never logged with content.** `readAllConversations` now returns `{ ok: true, sessions, invalidIds }`: a malformed session record is skipped and reported by safe id, and a malformed message record fails only its own conversation. The suite asserts the remaining conversations hydrate, both safe ids are named in the log, and no body fragment is.
- **Fixtures are separated by construction.** The store has no fixture input at all: the case drives an explicit test adapter whose `fixtures` field the read path never consults, and asserts an empty database with a fixture present resolves `empty` (never `ready`), the fixture is absent from `np_db`, and a persisted conversation is never overridden.
- **No regression.** `tsc --noEmit` clean; the repository suite green at 54 files / 802 tests; the storage directory at 9 files / 113 tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: `np_store` v3 cutover and the asynchronous hydration contract** — `7d9a57d7` (feat)
2. **Task 1 (follow-up): a database that cannot open publishes a typed `IDB_OPEN_FAILED` code** — `3a1b1ac9` (fix)
3. **Task 2: the v3 projection, the six hydration states and the no-fallback rule** — `8dd19580` (test)

**Plan metadata:** see the final `docs(02-08)` commit below

## Files Created/Modified

- `src/store/useExtensionStore.ts` — `HydrationStatus`/`HydrationError`/`ChatHydrationDeps`, `DEFAULT_HYDRATION_DEPS` (`getDb`, `recoverJournal`, `runLegacyChatMigration`, `readAllConversations`, `readConversation`), `defaultRecoverJournal()` (the journal-recovery production call site), `errorCode()`/`historyGroup()`/`toChatSession()` projections, the `runHydration` state machine with the in-flight guard, `NP_STORE_SCHEMA_VERSION = 3`, `PERSISTED_BLOB_FIELDS = NP_STORE_V3_FIELDS`, the `projectNpStoreV3`-delegated `partialize`/`npStoreMigrate`, and the conversation-refusing `merge`.
- `src/core/storage/ChatHistoryDB.ts` — `ReadAllConversationsResult` gained `invalidIds`; the list read excludes a malformed record, logs it by safe id and keeps the rest; the module comment records the partial-failure policy.
- `tests/core/store/useExtensionStore.test.ts` — 24 cases across five describes: the v2 credential/theme/version assertions (updated for v3), the v3 projection and stored-blob body absence, the rehydrate-failure net, the D2-17 order and the six states, and the partial/retry/fixture cases.

## Decisions Made

- **`PERSISTED_BLOB_FIELDS` is an alias, not a second list.** `export const PERSISTED_BLOB_FIELDS = NP_STORE_V3_FIELDS` — the plan's key_link forbids restating the surviving field set, and the suite asserts the exported list is exactly the four surviving fields. `npStoreMigrate`'s deny-list-free rebuild is unchanged in shape; only its source of truth moved.
- **`partialize` projects through the allow-list.** The old "state minus three transient fields" would have persisted the hydrated `sessions` right back into `np_store` the moment hydration applied them. Projecting is the smallest change that makes the D2-08 prohibition structural, and it drops `hydrationStatus`/`hydrationError` for free.
- **`merge` refuses conversations and statuses.** `merged.sessions = current.sessions`, `merged.activeSessionId` from `current` only, and `hydrationStatus`/`hydrationError` from `current` — a blob cannot seed a conversation list or publish a hydration result.
- **`recoverJournal` now has a production call site.** The hydration entry point replays `pending`/`applying` entries with the migration as the replay callback, which is what 02-10's startup sequence expects and what WINDOWS #23 recorded as missing. `compactJournal` remains uncalled (still open in the ledger).
- **`failed` vs `recovery required` follows the journal contract.** A migration failure is `recovery required` because 02-05 guarantees the entry stays resumable; an unreadable journal is also `recovery required`; an open/list/read failure is `failed`.
- **`preview` is projected empty and never persisted.** It is a body excerpt with no canonical home, so the projection cannot derive one; `group` *is* derived (from the integer `updated`) because `ChatHistoryModal` groups by it, and a `'tool'` role projects as `'system'` rather than widening the component contract.
- **The malformed-record policy lives in the repository read.** Skipping in the store would have meant the store enumerating records itself — forbidden by D2-20 — so the list read reports safe ids and the store only decides the status.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `readAllConversations()` extended with the partial-failure policy (file outside `files_modified`)**
- **Found during:** Task 1 (the read path) / Task 2 (the malformed case)
- **Issue:** The plan's must-have — "One malformed conversation … the remaining conversations still hydrate" — is unreachable through 02-02's list read: `readAllConversations()` returned `{ ok: false, code: 'CHAT_HISTORY_INVALID_RECORD' }` on the first malformed *session* record, aborting the whole list with no safe id. The store may not enumerate records itself (D2-20 forbids it opening a store or constructing a transaction), so the policy had to live in the repository read.
- **Fix:** `ReadAllConversationsResult` gained `invalidIds: string[]`; the read skips a malformed record, logs it by safe id only (never a title, never a body) and returns the validated remainder. The change is additive — 02-02's and 02-05's existing assertions (`all.ok`, `all.sessions`) are untouched and their suites still pass.
- **Files modified:** `src/core/storage/ChatHistoryDB.ts` (48 insertions, 6 deletions)
- **Verification:** `npx vitest run tests/core/storage` → 9 files / 113 tests green; the store suite's malformed case asserts `s-good` hydrates while `s-bad`/`s-broken` are named in the log.
- **Committed in:** `7d9a57d7` (part of Task 1's commit)

**2. [Rule 1 - Bug] The database-open failure fell through to the generic catch**
- **Found during:** Task 2 (the failure cases)
- **Issue:** `ensureDatabase()` was awaited inside the outer try/catch, so a `NowPilotDbOpenError` resolved `CHAT_HYDRATION_FAILED` for any seam that threw a plain error, and the log line read "Chat hydration threw" for an expected, typed open failure. 02-02's handoff note explicitly asks for `NowPilotDbOpenError.code` to be mapped onto the hydration states.
- **Fix:** step 1 is its own typed branch: the open failure's redacted `code` (defaulting to `IDB_OPEN_FAILED`) is published as `failed` with a dedicated log line.
- **Files modified:** `src/store/useExtensionStore.ts` (11 insertions, 2 deletions)
- **Verification:** the real-path no-fallback case resolves `IDB_MIGRATION_FAILED`; the stub case resolves `IDB_OPEN_FAILED`; the full suite green.
- **Committed in:** `3a1b1ac9` (separate follow-up commit — Task 1's commit had already landed)

### Task-boundary note (not a scope change)

**3. Task 1 updated three existing assertions in Task 2's file.** Task 1's `<verify>` runs the store suite, and the schema bump invalidated three v2 assertions (`result.sessions`/`r.sessions` presence, and the A5 source-scan's "no import from a path containing `db`" guard, which the D2-17 read-path imports legitimately trip). Those minimal updates landed in Task 1's commit so its verify could be green; Task 2 then added all new coverage. The A5 guard was narrowed to what it exists for — the `DB_VERSION` constant itself — rather than dropped.

---

**Total deviations:** 2 auto-fixed (1 blocking repository contract, 1 bug) plus 1 task-boundary note
**Impact on plan:** The first is what makes the plan's partial-failure must-have true at all; without it the malformed case could only have been written against a stub. The second restores the typed open-failure mapping 02-02 named. No scope creep: the only file touched outside `files_modified` is the one the read path forced.

## Issues Encountered

- **The store's own persist writes make the storage map a moving target.** Every `set` during hydration schedules a debounced `np_store` write, so the body-absence cases flush pending writes before seeding and read the map immediately after a flush. The seeded-blob case asserts the stored blob *after* the flush, which is the only way the assertion observes what actually landed.
- **A stub `readConversation` cannot prove the partial policy.** The malformed case therefore uses a stub for the *list* (to place two records and one invalid id deterministically) but real records for the surviving conversation, and the retry case drops to the production path entirely against a real `np_db` conversation.
- **`preview: ''` looks like a stub and is not one.** The field is a body excerpt by construction (the prototype derived it with `msg.content.slice(0, 50)`); D2-08 forbids body-derived values and §21.3 gives `preview` no canonical home, so an empty projection is the only compliant value and no consumer renders it in Phase 2. Recorded here so a later reader does not mistake it for an omission.
- Pre-existing untracked planning artifacts (`.gsd/`, `.planning/milestone.lock`) were left untouched — outside this plan's scope.

## Known Stubs

None. Every state the plan names is reachable and asserted; the projection carries no placeholder values (the one empty field, `preview`, is documented above as a forbidden-by-contract value, not an unimplemented one), and no test is skipped.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: storage-read | `src/store/useExtensionStore.ts` | The store now imports the storage layer (`NowPilotDB.getDb`, `ChatHistoryDB`, `WriteJournal`) and reads IndexedDB inside the hydration entry point — the D2-20 sanctioned boundary ("never calls IndexedDB directly *outside* the hydration function"). Every read is a repository call or the journal `entries` store; no transaction is constructed in the store, no legacy key is read, and the read path is exercised by the plan's threat cases (T-02-41…T-02-45). |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **02-09** reads `hydrationStatus`/`hydrationError`/`retryHydration()` from the store exactly as its plan names: `idle` and `hydrating` render no empty copy, `empty` renders the approved empty presentation, and `failed`/`recovery required` render the inline `storage.hydrationFailed` + `common.retry` block. `retryHydration()` takes no arguments.
- **02-10** calls `useExtensionStore.getState().hydrateChatHistory()` once per surface: the entry point initialises `np_db`, recovers the journal, runs or resumes the migration and hydrates, and a double-invoked effect joins the in-flight run.
- **02-13**'s gate already lists this suite; the plan's two verify commands are green (`npx tsc --noEmit`, `npx vitest run tests/core/store/useExtensionStore.test.ts tests/core/onboarding/onboardingStateStore.test.ts`).
- **Phase 3** writes conversations through ChatHistoryDB and re-runs hydration (or applies its own projection); the store's `sessions` mutators are unchanged, so the component-facing API it will extend is intact.
- **WINDOWS #23 is half-closed:** `recoverJournal` now has a production call site (this plan's hydration entry point); `compactJournal` still has none.
- **Phase 15** owns the conversation renderer — the projection carries `title`, `group`, timestamps, star and messages, and no `preview`.

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 3 changed source/test files exist on disk, and the SUMMARY exists at its plan path.
- All 3 plan commits exist in history: `7d9a57d7` (Task 1), `3a1b1ac9` (Task 1 follow-up fix), `8dd19580` (Task 2).
- Measured commit count at SUMMARY write time (`git rev-list --count 0121d9be..HEAD`): 3 task commits, base recorded as `plan_head_before`.
- `npx tsc --noEmit` clean; `npx vitest run` green at 54 files / 802 tests.
