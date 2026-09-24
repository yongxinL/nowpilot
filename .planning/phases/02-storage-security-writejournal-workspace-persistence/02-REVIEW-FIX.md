---
phase: 02-storage-security-writejournal-workspace-persistence
fixed_at: 2026-09-24T13:55:00Z
review_path: .planning/phases/02-storage-security-writejournal-workspace-persistence/02-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
info_fixed: 3
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-09-24T13:55:00Z
**Source review:** `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-REVIEW.md`
**Iteration:** 1
**Branch:** `aurora` (7 atomic `fix(02)…` commits)
**Isolation:** `workflow.use_worktrees` is `false` in `.planning/config.json`, so the fixes were applied and committed **in the main checkout** (no worktree was created, per the flag). All verification below ran in the main checkout.

**Summary:**

- In-scope findings (CR-01, CR-02, WR-01…WR-03): **5 fixed, 0 skipped**
- Trivial Info findings also fixed: **3** (IN-02, IN-05, IN-06)
- Info findings deliberately left open: **3** (IN-01, IN-03, IN-04 — reasons below)
- Gate: `pnpm run verify:phase-2` → **PASS** — `tsc --noEmit` + path preflight + **26 test files / 455 tests**, including every suite the fix scope named (store + migration + workspace persistence + writer election + isolation).

## Fixed Issues

### CR-01: The `np_store` v3 write-back can destroy un-migrated legacy message bodies before the migration reads them

**Files modified:** `src/core/storage/npStoreWriteGuard.ts` (new), `src/store/useExtensionStore.ts`, `tests/core/storage/npStoreWriteGuard.test.ts` (new), `tests/core/store/useExtensionStore.test.ts`
**Commit:** `76d7bd7f`
**Commit status:** `fixed: requires human verification` (state-ordering logic — see the note)
**Applied fix:** The store's persist config now writes through a dedicated guarded `StateStorage` (`npStoreStorage`) instead of the raw debounced adapter. Before every `setItem`, the guard re-reads the **raw stored blob** and, while that blob is a pre-v3 legacy envelope (or an unreadable one), **refuses the write**: `source-sanitised` in the migration remains the sole writer of the verified v3 blob. Once the stored blob is absent or at `NP_STORE_V3_SCHEMA_VERSION`, writes pass through unchanged. The guard is stateless and re-evaluated per write, so the hydration write-back, the 300 ms debounce, `flushPendingWrites()` and any later store `set` are all covered — and a suppressed write is never queued, so nothing can land after sanitisation. D2-07/D2-12/D2-14 are strengthened, not weakened: nothing is deleted before destination verification, and no preserved body can be resurrected into a sanitised blob.

**Evidence:**
- New unit suite `tests/core/storage/npStoreWriteGuard.test.ts`: predicate matrix (v1/v2/unversioned/unparseable → held; absent/v3 → transparent) and the held-write behaviour with the real adapter (`getPendingSize() === 0`, byte-identical stored blob after a flush); positive controls for both pass-through directions.
- Rewritten store test *"the v3 projection is never written over an un-migrated legacy source (CR-01)"*: asserts the migrate branch ran and the in-memory projection is body-free **while the stored source stays byte-identical** (this is the assertion that fails pre-fix).
- New regression test *"the real startup order migrates the legacy body into ChatHistoryDB before np_store is sanitised"*: seeds a v2 blob with a synthetic body, drives `useExtensionStore.persist.rehydrate()` → `hydrateChatHistory()` (the real seams), and asserts `ready`, the body present in ChatHistoryDB (`readConversation`), and only then absent from `np_store` at v3.

**Human-verification note:** the fix changes a data-lifecycle ordering; the automated suites cover the ordering and both regression paths, but a reviewer should confirm the deliberate trade: while a migration is unfinished (e.g. a quarantined record blocks sanitisation, D2-13), non-chat metadata edits from that document are **not persisted across a reload** — a recoverable cost against an unrecoverable body loss. Documented in the guard's module note.

### CR-02: `WorkspacePersistence` has no production call site

**Files modified:** `src/core/workspace/workspaceRuntime.ts` (new), `src/core/workspace/WriterElection.ts` (registry gate), `src/core/workspace/WorkspaceStore.ts` (doc reconciliation), `src/entrypoints/sidepanel/main.tsx`, `src/entrypoints/standalone/main.tsx`, `tests/core/workspace/workspaceRuntime.test.ts` (new)
**Commit:** `ed773d05`
**Commit status:** `fixed: requires human verification` (new runtime composition)
**Applied fix:** New `workspaceRuntime` module owns the production call sites of the repository and both entrypoints run it in `usePhase2Startup`, before the first election:
1. **Hydrate** — `readWorkspaceState()` is read and installed into `useWorkspaceStore` (via `setState`, no counter bump) before the surface elects; a durable copy is only installed when it is **newer** than the projection, so a URL bootstrap a handoff target already applied is never rolled back.
2. **Persist** — a store subscription writes every authorised mutation through `writeWorkspaceState` (journal entry → key → narrow `{workspaceId, conversationId}` signal → completed, §20.3 unchanged), microtask-coalesced.
3. **Gate** — every write passes `assertActiveWriterStillPrimary()` (new registry helper, same path as `requestRefocus`): a superseded/mirroring surface cannot overwrite the durable copy.
4. **Adopt** — `subscribeToWorkspaceChanges` installs an opposite-surface update only when it is strictly newer; on a monotonic rejection the stored copy is adopted.
5. **Establish on authority** — the transition to `primary` (first election **and** any later promotion/handoff) writes the current projection when the stored copy is behind it and installs the persisted counter, so a handoff target's applied projection survives its own reload (D2-34's ordering).
`WorkspaceStore.ts`'s doc comment now names the runtime that writes the key through `WorkspacePersistence`, so code and comment agree.

**Evidence:**
- New suite `tests/core/workspace/workspaceRuntime.test.ts` (8 cases): durable hydrate-before-election incl. idempotent start; no rollback of a newer bootstrap; establishment on promotion with the completed §20.3 entry and no-op afterwards; held establishment with no registered election; a persisted mutation with a strictly greater counter and its journaled entry; held mutation while secondary; newer cross-surface install (and no write-back); stale-signal rejection.
- `tests/integration/workspaceHandoff.integration.test.ts` (D2-31.17 persistence/read-back, D2-31.19 reload, D2-31.21 stale-writer) and `tests/core/workspace/WorkspacePersistence.test.ts` still pass unchanged — the narrow broadcast and the journaled order are intact.
- `tests/core/workspace/WorkspaceStore.test.ts`'s source scan ("no module names a workspace storage key for writing") passes: the runtime refers to the constant, never an ad-hoc literal.

**Human-verification note:** confirm the intended reading of the gate — a mirror's bootstrap mutations are persisted on promotion (by the establish step), not while it mirrors. That preserves D2-34's single-writer rule; the alternative (persisting from a mirror) would contradict `assertStillPrimary()`.

### WR-01: Startup recovery silently ignored non-migration journal entries

**Files modified:** `src/core/workspace/WorkspacePersistence.ts`, `src/store/useExtensionStore.ts`, `tests/core/workspace/WorkspacePersistence.test.ts`, `tests/core/store/useExtensionStore.test.ts`
**Commit:** `0f4e1f6e`
**Commit status:** `fixed`
**Applied fix:** `writeWorkspaceState` now records `version` in `targetIds` (safe identifier only, D2-21). New `replayUpdateWorkspace(entry)` re-reads the durable copy and finishes the interrupted write: when the key write landed (same workspace, stored version ≥ the entry's) it emits the owed narrow signal and marks the entry terminal `completed`; when it never landed it marks the entry terminal `failed` with a redacted step error and returns a typed failure. `defaultRecoverJournal` now branches on `update-workspace` (throwing on the typed failure so `recoverJournal`'s `failed` count is truthful) and treats any unknown operation as a typed failure instead of a no-op.

**Evidence:**
- 5 new cases in `WorkspacePersistence.test.ts`: landed → signal emitted exactly once with the two identifiers and the stored value untouched; superseded → completed with the newer signal; unlanded → terminal `failed` with `WORKSPACE_WRITE_FAILED` on the failing step and **no** signal (throwing publisher as positive control); older stored version → failed; `recoverJournal` counts `{replayed: 1, failed: 1}`.
- Store-level integration test: a seeded `applying` entry is replayed by the real `hydrateChatHistory()` and reaches `completed`.

### WR-02: `WriterElection.stop()` could delete another surface's freshly won record

**Files modified:** `src/core/workspace/WriterElection.ts`, `tests/core/workspace/WriterElection.test.ts`
**Commit:** `8fa6fe28`
**Commit status:** `fixed`
**Applied fix:** Removed the read-then-remove release (`removeIfOwned`) entirely — `chrome.storage` has no compare-and-remove, so it could always delete a concurrent winner's record. `stop()` now only clears the heartbeat; release is the documented **implicit staleness** mechanism (`STALE_AFTER_MS` = two missed intervals), so the option is now unreachable. The unused `remove?` member left the injected storage-area contract and the module/surface docs state the single release mechanism.

**Evidence:** the two lifecycle cases were updated to the pinned semantics: a closed surface's record is asserted **untouched** and still fresh (`survivor.elect()` → `secondary`), then the survivor takes authority exactly past two intervals (`epoch = T0 + STALE_AFTER_MS + 1`); the successful-handoff case asserts authority does not move while the record is fresh and moves only after staleness. All 22 WriterElection cases and both integration suites pass.

### WR-03: The background-SW "no IndexedDB" hard rule had no gate

**Files modified:** `src/core/storage/NowPilotDB.ts` (claim corrected to name the real gate), `tests/isolation/background-no-indexeddb.test.ts` (new)
**Commit:** `b8d9a4f4`
**Commit status:** `fixed`
**Applied fix:** New isolation suite resolves `src/entrypoints/background.ts`'s **transitive relative import graph** (static, re-export, side-effect and dynamic specifiers) and fails on: any `src/core/storage/**` module (outside one documented, per-module exception), the `idb` package, or an IndexedDB global in any reachable file. Unresolved relative specifiers are reported and asserted empty for the real graph, so a new import form cannot silently escape. `verify:phase-2` runs `tests/isolation`, and the suite asserts that wiring.

**Evidence:** 4 in-memory self-tests prove the resolver and predicate are non-vacuous (transitive walk; a synthetic storage import + `idb` fail; a synthetic `indexedDB.open` fails while a clean graph passes; an unresolvable specifier is reported); the real-graph case asserts non-vacuity (entry + `debugLog` reached, > 3 files) and zero violations. Only `legacyCredentialCleanup.ts` is allow-listed and it is still covered by the capability scan.

### IN-02: `MirrorBanner`'s pinned 400 px behaviour was not implemented

**Files modified:** `src/components/common/MirrorBanner.tsx`, `tests/components/MirrorBanner.test.tsx`
**Commit:** `c43c07aa`
**Commit status:** `fixed`
**Applied fix:** the literal `lineHeight: '32px'` on the caption and the action is replaced by the pinned 12 px/1.5 body/label role; the action gains `flexShrink: 0` + `whiteSpace: 'nowrap'` (it never wraps or clips); the caption gains the two-line clamp/ellipsis backstop. New test pins the mechanism (jsdom cannot represent `-webkit-line-clamp`, so the declaration is additionally pinned at the source).

### IN-05: `runJournaled` does not roll back the failing step

**Files modified:** `src/core/storage/WriteJournal.ts`
**Commit:** `18d206c6`
**Commit status:** `fixed`
**Applied fix:** documented (not code-changed) — the `JournalStep` contract now states both invariants `runJournaled` relies on: `apply` MUST be idempotent, and MUST be atomic/idempotent enough that a partial application needs no rollback, because only steps whose `apply` **returned** are rolled back (the failing step's own rollback cannot know how far it got). Every current step is a single idempotent upsert.

### IN-06: `KeyVault.store`'s create-only guarantee is best-effort

**Files modified:** `src/core/security/KeyVault.ts`
**Commit:** `18d206c6`
**Commit status:** `fixed`
**Applied fix:** documented — the module semantics now say "best-effort, not atomic" (no CAS in `chrome.storage`; two concurrent `store` calls can both observe absent and both succeed), with the serialise-your-own-calls guidance, and the `store` implementation carries the same note.

## Skipped / Open Issues

### IN-01: `compactJournal()` has no production call site

**File:** `src/core/storage/WriteJournal.ts:369-390`
**Reason:** not trivial/safe — wiring bounded cleanup is a retention decision already recorded as WINDOWS #25 (open). Changed by this pass only in the sense that WR-01 now stops non-terminal workspace entries from accumulating forever; the terminal-entry bound is still the ledger item.
**Original issue:** the journal grows one terminal entry per workspace version and nothing invokes compaction.

### IN-03: `toChatSession` projects a `tool` record as a `system` message

**File:** `src/store/useExtensionStore.ts:259-266`
**Reason:** a Phase 15 renderer-contract decision (extend the component `Message` union), already recorded by the in-code comment; no mechanical fix belongs in Phase 2.
**Original issue:** the projection loses the tool/system distinction the contract preserves.

### IN-04: A single malformed conversation forces hydration to `failed` / `recovery required`

**File:** `src/store/useExtensionStore.ts:415-453`
**Reason:** the review asks for an explicit product decision (add a partial presentation/status vs. record the deviation against the 02-UI-SPEC `partial` row and make Retry honest). That is a UI-SPEC/behaviour decision, not a trivial safe fix — left for the operator/Phase 15; the current behaviour is deliberate and asserted.
**Original issue:** the conversation region shows "Failed to load history" even though the valid records did hydrate.

## Verification

- **Commands:** `pnpm run verify:phase-2` (tsc --noEmit + path-resolution preflight + the explicit Phase 2 suite list + `tests/isolation`) → **26 files / 455 tests passed**; plus targeted runs after each fix (`tests/core/store/useExtensionStore.test.ts`, `tests/core/storage/legacyChatMigration.test.ts`, `tests/core/storage/npStoreWriteGuard.test.ts`, `tests/core/workspace/*`, `tests/integration/*`, `tests/isolation`, `tests/components/MirrorBanner.test.tsx`).
- **Where:** main checkout (`workflow.use_worktrees=false`), branch `aurora`.
- **Not re-verified here:** Phase 15 Real-Chrome observations (WINDOWS #5/#8 stay open, unchanged) and IN-01/IN-03/IN-04's product decisions.

---

_Fixed: 2026-09-24T13:55:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
