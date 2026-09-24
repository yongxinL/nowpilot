---
phase: 02-storage-security-writejournal-workspace-persistence
fixed_at: 2026-09-24T14:25:27Z
review_path: .planning/phases/02-storage-security-writejournal-workspace-persistence/02-REVIEW.md
iteration: 2
findings_in_scope: 3
fixed: 3
skipped: 0
info_fixed: 2
status: all_fixed
---

# Phase 2: Code Review Fix Report (iteration 2)

**Fixed at:** 2026-09-24T14:25:27Z
**Source review:** `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-REVIEW.md` (iteration 2, `status: findings`)
**Iteration:** 2
**Branch:** `aurora` (5 atomic `fix(02)…` commits)
**Isolation:** `workflow.use_worktrees` is `false` in `.planning/config.json`, so the fixes were applied and committed **in the main checkout** (no worktree was created, per the flag). All verification below ran in the main checkout.
**Iteration-1 record:** this file now reports iteration 2; the iteration-1 fix report is preserved in commit `38cd8a10` and its resolutions are verified in `02-REVIEW.md`'s "Resolved findings" section.

**Summary:**

- In-scope findings (WR-04, WR-05, WR-06): **3 fixed, 0 skipped**
- Trivial Info findings also fixed: **2** (IN-07, IN-08)
- Gate: `pnpm run verify:phase-2` → **PASS** — `tsc --noEmit` + path preflight (24 declared paths) + **28 test files / 472 tests** (was 26 / 455; the two previously-uncounted regression suites are now in the gate, plus 4 new tests from this pass)

## Fixed Issues

### WR-04: The cross-surface update signal was published before its debounced key write landed

**Files modified:** `src/core/theme/chromeStorageAdapter.ts` (new `flushPendingWrite`), `src/core/workspace/WorkspacePersistence.ts` (step 1 lands the key before step 2 signals), `tests/core/storage/chromeStorageAdapter.test.ts`, `tests/core/workspace/WorkspacePersistence.test.ts`
**Commit:** `71b78c89`
**Commit status:** `fixed`
**Applied fix:** The §20.3 write step now **lands** the key before it completes: after `storage.setItem`, it awaits a new targeted adapter hook `flushPendingWrite(WORKSPACE_STORAGE_KEY)`, which writes that one key immediately instead of leaving it in the debounce map. The update signal (step 2) therefore follows a durable key write, and a receiving surface's immediate re-read sees the new version instead of the previous one. Only the named key is landed — every other pending write keeps its debounce window — and the pending entry is removed synchronously, so a later flush cannot land a stale duplicate. The signal payload is unchanged: `{workspaceId, conversationId}` exactly (D2-31), and the strict-schema / exact-key-set tests still pass. The module doc now states the landing rule and why it costs nothing the debounce protected (the runtime microtask-coalesces to one write per mutation burst).

**Evidence:**
- New regression *"lands the key before the signal, so a receiver without the sender pending map adopts the write (WR-04)"*: the writer uses the real debounced adapter (`writeWorkspaceState` with default deps, **no manual flush**), and the subscriber reads a raw view of `chrome.storage.local` — the receiver's true view, which excludes the sender's in-memory pending map. It asserts the receiver adopts version 5 and `conv-debounce`.
- **Red before the fix / green after:** with the flush line temporarily removed, the test failed with `AssertionError: expected [] to deeply equal [ 5 ]` — the exact drop described in the finding. Restored, it passes.
- The round-trip test was updated to the landed semantics: after `writeWorkspaceState` resolves, `getPendingSize() === 0` and the key is present in the storage map, then the reload still reads it back.
- Adapter unit coverage for the new hook: `flushPendingWrite` lands only the named key (the other key stays pending and lands once through the normal flush) and is a no-op for a key with nothing pending.

### WR-05: The two new regression suites were not part of `verify:phase-2`

**Files modified:** `package.json`
**Commit:** `074c062e`
**Commit status:** `fixed`
**Applied fix:** Added `tests/core/storage/npStoreWriteGuard.test.ts` and `tests/core/workspace/workspaceRuntime.test.ts` to the `verify:phase-2` suite list. No existing declared suite was removed; the self-derived path-resolution preflight still scans the script string and fails on a missing/misspelled path; the corrected gate still declares no `tests/core/utils` (the stale Phase-2 expectation D2-28 removed).

**Evidence:**
- Preflight run standalone: `verify:phase-2: 24 declared path(s) resolve` (was 22), including both new paths.
- Both suites pass standalone: 2 files / 13 tests (the CR-01 guard suite + the CR-02 runtime suite).
- Full gate re-run: **28 test files / 472 tests passed** — the two suites are now inside the acceptance artifact, so a future regression of CR-01/CR-02 fails `verify:phase-2` instead of staying green.

### WR-06: `writeWorkspaceState` could reject on a journal/IndexedDB failure from fire-and-forget call sites

**Files modified:** `src/core/workspace/WorkspacePersistence.ts` (wrap `createJournalEntry`), `src/core/workspace/workspaceRuntime.ts` (defence `.catch` at both fire-and-forget sites), `tests/core/workspace/WorkspacePersistence.test.ts`, `tests/core/workspace/workspaceRuntime.test.ts`
**Commit:** `dd8208b2`
**Commit status:** `fixed`
**Applied fix:** `createJournalEntry` is now wrapped in the same try/catch shape as `runJournaled` and resolves the typed `WORKSPACE_JOURNAL_FAILED` — the write path is total for the §19.10 IndexedDB-blocked/degraded state (the store's `getDb()` rejection no longer escapes). As defence, both fire-and-forget call sites (`void persistCurrentState()` in the persist microtask and `void establishWorkspaceIdentity()` on promotion) gained a `.catch` that logs `WORKSPACE_WRITE_FAILED` with a redacted reason, so an unexpected rejection can never surface as an unhandled one. Module docs in both files now state the total failure path.

**Evidence:**
- New persistence case *"resolves a typed failure when the journal store rejects — the IndexedDB-blocked path (WR-06)"*: a rejecting `JournalEntryStore` (what `defaultJournalStore.load` does when `getDb()` rejects) resolves `{ok: false, code: 'WORKSPACE_JOURNAL_FAILED'}`, writes nothing to the key, and logs the typed code.
- New runtime case *"degrades without an unhandled rejection when IndexedDB cannot open, then recovers (WR-06, §19.10)"*: drives the real path — a fresh IndexedDB factory plus the migrator's `setMigrationFailure` seam makes `getDb()` reject `IDB_MIGRATION_FAILED` — then asserts the typed `WORKSPACE_JOURNAL_FAILED` log appears, the durable copy is unchanged (the mutation stays in memory), `establishWorkspaceIdentity()` **resolves** rather than rejecting, and after the database opens again the next mutation persists (`waitForDurable`).
- **Red before the fix / green after:** with the wrap temporarily changed to rethrow, the persistence case failed with `AssertionError: promise rejected "NowPilotDbOpenError …" instead of resolving`, and the runtime case never saw the typed code (the defensive catch logged `WORKSPACE_WRITE_FAILED` instead — which is exactly the pre-fix loss the finding describes). Restored, both pass.

## Trivial Info fixes (optional scope)

### IN-07: The isolation gate did not resolve `@/` / `~/` alias specifiers

**Files modified:** `tests/isolation/background-no-indexeddb.test.ts`
**Commit:** `3a8fc1c2`
**Commit status:** `fixed`
**Applied fix:** `resolveSpecifier` now resolves `@/` and `~/` into `src/` (matching tsconfig `paths` and the vitest alias) instead of returning `null`, and an unresolved alias specifier is reported as a blind spot like an unresolved relative one. A future background edit written as `import { getDb } from '@/core/storage/NowPilotDB'` now fails the gate.
**Evidence:** new self-test proves both aliases resolve and that an aliased storage import is flagged (two storage violations + the `idb` import); the unresolved-specifier self-test now covers an alias (`@/missing/alias`); the real graph still reports 0 violations and 0 unresolved specifiers (no `src/` file uses the aliases today).

### IN-08: Un-awaited assertion in the runtime suite

**Files modified:** `tests/core/workspace/workspaceRuntime.test.ts`
**Commit:** `e26637cf`
**Commit status:** `fixed`
**Applied fix:** `expect(...).resolves.toHaveLength(1)` → `await expect(...).resolves.toHaveLength(1)`.
**Evidence:** the runtime suite passes (9 tests) with no Vitest hanging-assertion warning.

## Skipped / Open Issues

None. Every in-scope finding and both optional Info items were fixed. The iteration-2 Info items already recorded as open by the review (IN-01 `compactJournal` call site, IN-03 `tool` → `system` projection, IN-04 malformed-conversation hydration) were **not** in this fix scope and remain open as recorded.

## Verification

- **Per-fix targeted suites:** `tests/core/storage/chromeStorageAdapter.test.ts` + `tests/core/workspace/WorkspacePersistence.test.ts` (31 tests) after WR-04; the two gate-added suites (13 tests) after WR-05; `tests/core/workspace/*` (32 tests) after WR-06; `tests/isolation/background-no-indexeddb.test.ts` (7 tests) after IN-07; the runtime suite after IN-08.
- **Type check:** `npx tsc --noEmit` clean after each source-touching fix.
- **Phase gate:** `pnpm run verify:phase-2` → `tsc --noEmit` + preflight (24 declared paths) + **28 test files / 472 tests passed**.
- **Where:** main checkout (`workflow.use_worktrees=false`), branch `aurora`.
- **Not re-verified here:** Phase 15 Real-Chrome observations (WINDOWS #5/#8 stay open, unchanged); the two residuals flagged for human verification in iteration 1 (CR-01's metadata-hold trade, CR-02's mirror-persists-on-promotion reading) are unchanged by this pass.

---

_Fixed: 2026-09-24T14:25:27Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 2_
