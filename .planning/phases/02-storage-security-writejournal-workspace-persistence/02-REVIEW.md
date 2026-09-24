---
phase: 02-storage-security-writejournal-workspace-persistence
reviewed: 2026-09-24T14:30:00Z
depth: standard
review_iteration: 2
files_reviewed: 25
files_reviewed_list:
  - package.json
  - src/components/common/MirrorBanner.tsx
  - src/core/security/KeyVault.ts
  - src/core/storage/WriteJournal.ts
  - src/core/storage/NowPilotDB.ts
  - src/core/storage/legacyChatMigration.ts
  - src/core/storage/legacyCredentialCleanup.ts
  - src/core/storage/npStoreWriteGuard.ts
  - src/core/theme/chromeStorageAdapter.ts
  - src/core/workspace/WorkspacePersistence.ts
  - src/core/workspace/WorkspaceRouter.ts
  - src/core/workspace/WorkspaceStore.ts
  - src/core/workspace/WriterElection.ts
  - src/core/workspace/workspaceRuntime.ts
  - src/entrypoints/sidepanel/main.tsx
  - src/entrypoints/standalone/main.tsx
  - src/store/useExtensionStore.ts
  - tests/core/storage/npStoreWriteGuard.test.ts
  - tests/core/store/useExtensionStore.test.ts
  - tests/core/workspace/WorkspacePersistence.test.ts
  - tests/core/workspace/WriterElection.test.ts
  - tests/core/workspace/workspaceRuntime.test.ts
  - tests/harness/twoSurface.ts
  - tests/integration/workspaceHandoff.integration.test.ts
  - tests/isolation/background-no-indexeddb.test.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
resolved:
  critical: 2
  warning: 3
  info: 3
status: fixed
fixed_at: 2026-09-24T14:25:27Z
fix_report: .planning/phases/02-storage-security-writejournal-workspace-persistence/02-REVIEW-FIX.md
---

> **Post-fix status (iteration 2 fix pass):** all three Warnings (WR-04, WR-05, WR-06) and both
> optional Info items (IN-07, IN-08) were fixed and verified — see `02-REVIEW-FIX.md`
> (iteration 2) for the per-finding evidence and commit hashes. The body below is preserved as
> written at review time; the frontmatter `findings` counts are the pre-fix state.

# Phase 2: Code Review Report (iteration 2 — `--fix --auto` re-review)

**Reviewed:** 2026-09-24T14:30:00Z
**Depth:** standard
**Files Reviewed:** 25 (the fix sites, their suites, and the call chains they changed; the iteration-1 scope was re-checked where the fixes touched it)
**Status:** findings — all 5 iteration-1 Critical/Warning findings are **verified resolved against the real source**, with 3 new Warnings and 2 new Info items introduced or exposed by the fix pass.

## Summary

The fix pass is real, not cosmetic. I re-derived every claim in `02-REVIEW-FIX.md` from the current source rather than trusting the report:

- **CR-01 is genuinely fixed.** The store's persist config now writes through `npStoreStorage` (`useExtensionStore.ts:866`), which re-reads the raw `np_store` value before every write and refuses to replace a pre-v3 or unreadable blob (`npStoreWriteGuard.ts:89-117`). The guard is stateless, so the hydration write-back, the 300 ms debounce, `flushPendingWrites()` and any later `set` are all covered; a held write is never queued, so nothing can land after sanitisation. The migration's `source-sanitised` stage is still the sole writer of the verified v3 blob (it writes through `chrome.storage.local.set` directly, `legacyChatMigration.ts:503-506`, `:703-761`), so the legitimate cutover is not blocked. The real-order regression drives the production seams (`persist.rehydrate()` → `hydrateChatHistory()`, `useExtensionStore.test.ts:720-780`) and asserts the body reaches ChatHistoryDB before leaving `np_store`. The only other `np_store` writer (`legacyCredentialCleanup`) preserves the blob body (`legacyCredentialCleanup.ts:130-202`), so no unguarded body-loss path remains.
- **CR-02 is genuinely fixed.** Both entrypoints run `startWorkspaceRuntime()` after hydration and before the first election (`sidepanel/main.tsx:135`, `standalone/main.tsx:131`). The runtime hydrates the durable identity and the persisted `version` counter before election, persists every authorised mutation through the journaled §20.3 path behind `assertActiveWriterStillPrimary()`, adopts strictly-newer cross-surface updates, and establishes the projection on every transition to primary. The gate fails closed with no registered election and rejects a superseded/foreign record (`WriterElection.ts:392-414`, `:530-536`). `WorkspaceStore.ts:164-167` now names the runtime, so the comment matches the code.
- **WR-01/02/03 are genuinely fixed** and no new failure mode was introduced by the election `stop()` change or the recovery branch (details below). IN-02/IN-05/IN-06 are fixed as described.
- **The phase gate is green:** `pnpm run verify:phase-2` → `tsc --noEmit` clean + **26 files / 455 tests passed** (re-run in this pass). The two new fix suites pass separately (**13 tests**).

Three issues remain. They are new or newly reachable through this fix pass: the workspace update signal is published **before** its debounced key write lands, so the first cross-surface update after a mutation is read back stale and dropped until the next mutation (**WR-04**); the two new regression suites are **not wired into `verify:phase-2`**, so the fix record's gate claim overstates coverage (**WR-05**); and `writeWorkspaceState` can reject on a journal/IndexedDB failure while the runtime calls it fire-and-forget, producing an unhandled rejection and a silently dropped write in the IDB-unavailable state the product anticipates (**WR-06**).

The two residuals the fix record flagged for human verification are assessed at the end: **CR-01's metadata-hold trade is acceptable** (a recoverable cost against unrecoverable body loss) and **CR-02's mirror-persists-on-promotion reading is acceptable** (it is the only reading consistent with D2-34's single-writer rule), but both should stay visible to the operator.

## Verification of the iteration-1 fixes

### CR-01 — `np_store` write-back could destroy un-migrated legacy bodies — **RESOLVED**

Verified in source:

- The guard predicate treats `null`/`''`/v3 as writable and every legacy shape (v1/v2/unversioned/unparseable/non-envelope) as owned by the migration (`npStoreWriteGuard.ts:60-81`). The unreadable-source path holds the write (`:94-103`), which is fail-closed.
- A held write returns **before** `chromeStorageAdapter.setItem`, so nothing is queued and no flush can land it (`:105-111`). The test asserts `getPendingSize() === 0` and a byte-identical blob after a flush (`npStoreWriteGuard.test.ts:77-107`).
- The store's only persist storage is the guard (`useExtensionStore.ts:866`); `npStoreMigrate`'s zustand write-back, the 300 ms debounce and `flushPendingWrites()` all route through it.
- The migration still sanitises: `source-sanitised` writes the v3 blob through `chrome.storage.local.set` (`legacyChatMigration.ts:730-732` → `:503-506`), bypassing the guard, and the read-back confirms it (`:741-758`). No path writes a v3 blob except the migration and the post-v3 guard pass-through.
- Real-order regression: `useExtensionStore.test.ts:720-780` seeds a v2 blob with a synthetic body, runs `persist.rehydrate()` then `hydrateChatHistory()` (real seams), asserts `ready`, the body in ChatHistoryDB via `readConversation`, and only then the body-free v3 source.

### CR-02 — workspace state never persisted or hydrated — **RESOLVED**

Verified in source:

- **Hydrate before election:** `workspaceRuntime.ts:204-213` reads `readWorkspaceState()` and installs it only when strictly newer (`:116-130`), so a fresh document keeps its minted identity until it is established. The persisted `version` counter is installed with the state (`:104-113`), so subsequent writes are strictly greater and the monotonic rule cannot reject them. Test: `workspaceRuntime.test.ts:139-179`.
- **Persist:** the store subscriber (`:215-225`) coalesces mutations and writes through `attemptWrite` → `writeWorkspaceState` (journal entry → key → narrow `{workspaceId, conversationId}` signal → completed). Test: `:221-247`.
- **Gate:** `attemptWrite` calls `assertActiveWriterStillPrimary()` before every write (`:139-146`); no registered instance → typed rejection (`WriterElection.ts:530-536`); a foreign identity or a newer epoch of self → rejection (`:392-414`). A superseded surface cannot overwrite the durable copy. Tests: `:208-218`, `:249-268`.
- **Establish on authority:** the `writerState` → `primary` transition writes the current projection when the durable copy is behind (`:178-187`, `:222-224`), which is what makes a handoff target's projection durable. Test: `:183-206`.
- Both entrypoints wire it (`sidepanel/main.tsx:127-151`, `standalone/main.tsx:123-147`); `WorkspaceStore.ts:164-167`'s doc now names the runtime.
- `tests/integration/workspaceHandoff.integration.test.ts` and `WorkspacePersistence.test.ts` still pass unchanged; the D2-31.17 persistence/read-back case still exercises the real repository (`:660-695`).

### WR-01 — non-migration journal entries were silently ignored — **RESOLVED**

`defaultRecoverJournal` now branches on `update-workspace` (`useExtensionStore.ts:208-228`); `replayUpdateWorkspace` re-reads the durable copy and finishes the interrupted write — signal + terminal `completed` when the key write landed, terminal `failed` with `WORKSPACE_WRITE_FAILED` when it did not (`WorkspacePersistence.ts:386-436`); unknown operations throw so `recoverJournal`'s `failed` count is truthful (`:225`). `targetIds.version` is recorded for new entries (`:298`), and the id-suffix fallback handles pre-fix entries (`:439-447`). Tests cover landed/superseded/unlanded/older-stored/recoverJournal-counts (`WorkspacePersistence.test.ts:444-593`) and the store-level replay through the real `hydrateChatHistory()` (`useExtensionStore.test.ts:785+`). No new failure mode: the unlanded branch publishes nothing (asserted with a throwing publisher as positive control).

### WR-02 — `stop()` could delete another surface's freshly won record — **RESOLVED**

`removeIfOwned` is gone; the `remove?` member left the injected area contract (`WriterElection.ts:120-123`), and `stop()` only clears the heartbeat (`:377-390`). Release is now the documented implicit-staleness mechanism. Tests assert the closed surface's record is untouched and still fresh, then that the survivor takes authority exactly past `STALE_AFTER_MS` (`WriterElection.test.ts`, lifecycle describe). No new failure mode found: a record left behind is re-adopted by the same `{tabId, surface}` identity on its next election, and a new surface promotes after staleness (≤ two heartbeat intervals) — the pinned §13 mechanism. `assertStillPrimary` is unchanged.

### WR-03 — background no-IndexedDB hard rule had no gate — **RESOLVED**

`tests/isolation/background-no-indexeddb.test.ts` resolves the SW's transitive relative import graph (static, re-export, side-effect, dynamic) and fails on any `src/core/storage/**` module (one documented per-module exception), the `idb` package, or an IndexedDB global; unresolved relative specifiers are reported and asserted empty for the real graph. Four in-memory self-tests keep the resolver/predicate non-vacuous; the real-graph case asserts non-vacuity (entry + `debugLog` reached, > 3 files) and zero violations. The suite asserts `verify:phase-2` includes `tests/isolation`. `NowPilotDB.ts:41-48` now names the real gate.

### IN-02 / IN-05 / IN-06 — **RESOLVED**

IN-02: `MirrorBanner.tsx` drops the literal `lineHeight: '32px'` for the 12 px/1.5 role, adds `flexShrink: 0` + `whiteSpace: 'nowrap'` to the action and the two-line clamp to the caption. IN-05: the `JournalStep` contract documents the idempotent/atomic apply invariant `runJournaled` relies on. IN-06: `KeyVault.store` is documented as best-effort, not atomic. All three are as claimed.

## Warnings

### WR-04: The cross-surface update signal is published before its debounced key write lands, so the first update after a mutation is read back stale and dropped — **RESOLVED** (`71b78c89`)

**File:** `src/core/workspace/WorkspacePersistence.ts:321-333` (step 1 awaits a debounced `setItem`; step 2 publishes immediately), `src/core/theme/chromeStorageAdapter.ts:141-158` (the write is queued and returns; the flush is 300 ms later), `src/core/workspace/WorkspacePersistence.ts:468-490` (subscriber re-reads immediately), `src/core/workspace/workspaceRuntime.ts:210-213` (listener ignores a non-newer state)

**Issue:** `writeWorkspaceState`'s first step `await`s `chromeStorageAdapter.setItem`, which only queues the value in the sender document's `pendingWrites` map and returns; the second step publishes the `{workspaceId, conversationId}` signal immediately after. The receiving surface's `subscribeToWorkspaceChanges` re-reads `chrome.storage.local` at that instant — the sender's pending write is per-document state, invisible to the receiver — so it reads the **previous** version, delivers it once (recording it as `lastDeliveredVersion`), and the runtime's listener drops it as not-newer. No further signal exists for that write, so a lone cross-surface update is not adopted until the **next** mutation (the next signal's re-read then sees the landed value). The durable copy is always correct, so a reload recovers; the in-memory mirror projection lags.

The ordering itself is 02-06's, but this fix pass is what makes it production-reachable (`workspaceRuntime` is the first production subscriber), and no test covers it: the runtime test flushes before broadcasting (`workspaceRuntime.test.ts:284`), and the persistence suite injects a synchronous Map-backed area (`WorkspacePersistence.test.ts:71-91`).

**Fix:** make the signal follow a landed write — e.g. write `np_workspace` directly (bypassing the debounce; the key is written once per mutation, so the rate-limit rationale does not apply), or `await flushPendingWrites()` before step 2 — and add a regression that uses the real adapter, writes through `writeWorkspaceState`, broadcasts the signal without a manual flush, and asserts the receiver adopts the new version.

### WR-05: The two new regression suites are not part of `verify:phase-2`, so the CR-01/CR-02 fixes are outside the phase gate — **RESOLVED** (`074c062e`)

**File:** `package.json:18` (`verify:phase-2`), `tests/core/storage/npStoreWriteGuard.test.ts`, `tests/core/workspace/workspaceRuntime.test.ts`

**Issue:** The fix pass added two suites that are the only automated proof of the two Critical fixes, but did not add them to the phase gate. The gate's explicit file list contains 21 files plus `tests/isolation` (5 files) = **26 files / 455 tests** — I re-ran it and confirmed exactly that; neither `npStoreWriteGuard.test.ts` nor `workspaceRuntime.test.ts` is in it (both pass separately: 2 files / 13 tests). `02-REVIEW-FIX.md:26` claims the gate ran "every suite the fix scope named"; it did not run the fix pass's own new suites. Per D2-28/D2-35 the gate is the phase's acceptance artifact and its preflight exists so a missing suite fails loudly — as it stands, a future regression of CR-01 or CR-02 would keep `verify:phase-2` green.

**Fix:** add both paths to `verify:phase-2` (the self-derived preflight then requires them to keep resolving).

### WR-06: `writeWorkspaceState` can reject on a journal/IndexedDB failure, and the runtime calls it fire-and-forget — unhandled rejection plus a silently dropped write — **RESOLVED** (`dd8208b2`)

**File:** `src/core/workspace/WorkspacePersistence.ts:291-303` (unwrapped `createJournalEntry`), `src/core/storage/WriteJournal.ts:203-217` (`store.load` / `store.persist` are not caught), `src/core/storage/NowPilotDB.ts:217-222` (`getDb()` rejects with `NowPilotDbOpenError`), `src/core/workspace/workspaceRuntime.ts:189-195` (`void persistCurrentState()`), `:222-224` (`void establishWorkspaceIdentity()`)

**Issue:** `writeWorkspaceState`'s doc says it "never throws for an expected runtime failure", but only `runJournaled` is wrapped; `createJournalEntry` is not, and its `defaultJournalStore` reaches `getDb()`, which **rejects** when IndexedDB cannot open. In the §19.10 anticipated "IndexedDB blocked → in-memory degrade" state, every workspace mutation therefore rejects out of `writeWorkspaceState`; the new runtime calls it from a microtask (`void persistCurrentState()`) and from the subscriber (`void establishWorkspaceIdentity()`), so the rejection is unhandled and the mutation is dropped with no typed code. (The `replayUpdateWorkspace` path is fine — its caller catches.)

**Fix:** wrap the `createJournalEntry` call in the same try/catch shape as `runJournaled` and return `WORKSPACE_JOURNAL_FAILED`; as defence, give the runtime's fire-and-forget call sites a `.catch` that logs the typed code rather than leaking a rejection.

## Info

### IN-01: `compactJournal()` still has no production call site — open (unchanged)

**File:** `src/core/storage/WriteJournal.ts:380-401`

Recorded as WINDOWS #25. Unchanged by this pass; WR-01 now bounds the non-terminal growth (interrupted workspace entries reach a terminal state), but terminal entries still accumulate one per workspace version.

### IN-03: `toChatSession` projects a `tool` record as a `system` message — open (unchanged)

**File:** `src/store/useExtensionStore.ts:259-266`

Phase 15 renderer-contract decision; in-code comment already records it.

### IN-04: A single malformed conversation forces hydration to `failed` / `recovery required` — open (unchanged)

**File:** `src/store/useExtensionStore.ts:415-453`

Deliberate and asserted; needs an explicit product decision (partial status vs. recorded UI-SPEC deviation and an honest Retry).

### IN-07: The new background isolation gate does not resolve `@/` / `~/` alias specifiers — **RESOLVED** (`3a8fc1c2`)

**File:** `tests/isolation/background-no-indexeddb.test.ts:95-101`, `:152-158`; `tsconfig.json:22-25`; `vitest.config.ts:11-14`

`resolveSpecifier` returns `null` for anything not starting with `.`, and a bare specifier is only failed when it is exactly `idb`. A future background edit written as `import { getDb } from '@/core/storage/NowPilotDB'` would compile, resolve under the project aliases, and evade the gate. No `src/` file uses the aliases today (0 usages), so this is latent, not live. Fix: treat `@/` and `~/` as relative-to-`src` in the resolver (or fail any bare specifier that resolves under the alias roots).

### IN-08: Un-awaited assertion in the new runtime suite — **RESOLVED** (`e26637cf`)

**File:** `tests/core/workspace/workspaceRuntime.test.ts:205`

`expect((await getDb()).getAll('entries')).resolves.toHaveLength(1)` is not awaited; Vitest auto-awaits hanging assertions today and warns it will fail in Vitest 3. Fix: `await expect(...).resolves.toHaveLength(1)`.

## Resolved findings (iteration 1 — verified fixed)

- **CR-01** — `np_store` v3 write-back could destroy un-migrated bodies → guard + real-order regression (`76d7bd7f`). Verified resolved.
- **CR-02** — `WorkspacePersistence` had no production call site → runtime wired into both entrypoints (`ed773d05`). Verified resolved.
- **WR-01** — non-migration journal entries ignored → `replayUpdateWorkspace` + unknown-op failure (`0f4e1f6e`). Verified resolved.
- **WR-02** — `stop()` could delete a concurrent winner's record → implicit staleness release (`8fa6fe28`). Verified resolved.
- **WR-03** — unenforced background no-IndexedDB rule → import-graph gate (`b8d9a4f4`). Verified resolved (residual alias gap: IN-07).
- **IN-02 / IN-05 / IN-06** — MirrorBanner backstop, journal step invariant, vault best-effort semantics (`c43c07aa`, `18d206c6`). Verified resolved.

## Residual risk and human verification

- **CR-01's metadata-hold trade — acceptable; keep visible.** While a legacy source is un-migrated, the store's writes are held (not queued), so metadata edited in that window is not persisted until a later mutation re-snapshots the whole state; if a quarantined record blocks sanitisation (D2-13), that window never closes on that install and no `np_store` metadata persists at all. That is the correct direction (a recoverable metadata edit against unrecoverable body loss), and the migration's failure is already surfaced as `IDB_MIGRATION_FAILED`/degraded mode. Recommended operator acknowledgement, plus an optional follow-up: re-persist the current projection once `source-sanitised` completes.
- **CR-02's mirror-persists-on-promotion reading — acceptable.** A mirror's mutations are held while it mirrors and become durable when it promotes (`establishWorkspaceIdentity` sees the local counter ahead of the durable one). The alternative — persisting from a mirror — contradicts `assertStillPrimary()` and D2-34's single-writer rule. One nuance to keep in mind: the hydration rule installs any durable copy that is *newer than the local counter*, and a handoff target's locally-bumped counter starts from 0, so the durable copy normally wins over the URL/transfer values; that is correct when the source's write has landed, and it converges otherwise — but it is exactly the path WR-04 can delay.
- **Deferred verification unchanged:** WINDOWS #5/#8 Real-Chrome closure remains Phase 15's; this review does not alter the deferral ledger.
- **Gate status:** green as run (`verify:phase-2`: 26 files / 455 tests + `tsc --noEmit`); the new fix suites are green but out of the gate (WR-05).

---

_Re-reviewed: 2026-09-24T14:30:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
_Iteration 1 report: `02-REVIEW-FIX.md` records the fixes; this iteration verifies them and reports the remaining items._
