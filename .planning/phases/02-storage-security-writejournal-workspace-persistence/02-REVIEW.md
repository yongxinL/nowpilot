---
phase: 02-storage-security-writejournal-workspace-persistence
reviewed: 2026-09-24T03:21:18Z
depth: standard
files_reviewed: 26
files_reviewed_list:
  - src/core/security/EncryptedStorage.ts
  - src/core/security/KeyVault.ts
  - src/core/security/redactSensitive.ts
  - src/core/storage/NowPilotDB.ts
  - src/core/storage/IndexedDBMigrator.ts
  - src/core/storage/ChatHistoryDB.ts
  - src/core/storage/WriteJournal.ts
  - src/core/storage/ErrorStore.ts
  - src/core/storage/legacyChatMigration.ts
  - src/core/storage/Setting.ts
  - src/core/workspace/WorkspacePersistence.ts
  - src/core/workspace/WriterElection.ts
  - src/core/workspace/WorkspaceStore.ts
  - src/services/ports/credentialStorePort.ts
  - src/store/useExtensionStore.ts
  - src/components/common/MirrorBanner.tsx
  - src/components/common/Phase2Notices.tsx
  - src/components/onboarding/OnboardingFlow.tsx
  - src/components/sidepanel/SidePanelShell.tsx
  - src/components/standalone/StandaloneShell.tsx
  - src/core/i18n/strings.ts
  - src/core/onboarding/onboardingStateStore.ts
  - src/core/onboarding/useOnboardingGate.ts
  - src/entrypoints/background.ts
  - src/entrypoints/sidepanel/main.tsx
  - src/entrypoints/standalone/main.tsx
findings:
  critical: 2
  warning: 3
  info: 6
  total: 11
status: fixed
fixed_at: 2026-09-24T13:50:00Z
fix_report: .planning/phases/02-storage-security-writejournal-workspace-persistence/02-REVIEW-FIX.md
---

# Phase 2: Code Review Report

**Reviewed:** 2026-09-24T03:21:18Z
**Depth:** standard
**Files Reviewed:** 26
**Status:** findings

## Summary

The security core holds up under adversarial reading. `EncryptedStorage` pins the §15.2 parameters correctly (per-operation 16-byte salt / 12-byte IV from `crypto.getRandomValues`, 100 000 PBKDF2-SHA256 iterations, non-extractable AES-GCM-256, empty-string KDF separator explicitly pinned), authenticates the envelope metadata as AAD, fails closed to a single indistinguishable `CREDENTIAL_DECRYPT_FAILED`, and has no path that can return a credential except `KeyVault.retrieve`. `KeyVault` never builds a key from arbitrary input, rejects a foreign-provider envelope under the wrong key, and redacts every logged context. `redactSensitive` is total and throw-free; the journal/ErrorStore/migration record safe identifiers only — no body, preview, attachment or secret reaches a log, journal, error record or the sanitised source. The v3 cutover removes `sessions`/`activeSessionId`/`preview` from the persisted projection; the capability notice is verbatim and carries no false claim; `MirrorBanner` renders only on authoritative `mirror` state with no optimistic path; the background SW's import graph reaches no IndexedDB. Passwords/keys, injected IDs, CAS/read-back ordering and the migration stage machine all behave as documented.

Two defects are severe enough to block shipping, and both are about the phase's central promise:

1. **The `np_store` write path can destroy un-migrated legacy message bodies before the migration ever reads them** — the store's `persist` write-back and the legacy migration target the same key with no ordering guarantee, and the write-back is body-free by construction. The losing ordering is silent: the migration then reads a v3 blob, marks itself `completed` with zero conversations, and the surface publishes `empty`. This contradicts D2-07/D2-12 and is unrecoverable.
2. **`WorkspacePersistence` has no production call site.** Nothing writes or reads `np_workspace`; every document load mints a fresh `workspaceId` and the store's `version` counter never leaves memory, so the phase's DONE-when criterion 4 ("workspace state persists across page reload") is true only inside the suites, and `WorkspaceStore`'s own doc comment is false.

Three warnings cover the un-replayed non-migration journal entries, the election `stop()` release race, and a hard rule (§0.2) whose claimed isolation gate does not exist. Six info items record contract deviations and known-deferred consequences; the deferrals already recorded elsewhere (`compactJournal` — WINDOWS #25; the 400 px backstops — Phase 15; the Phase-1 `<Alert message>` deprecation in `StandaloneShell.tsx:329`) are not re-counted here beyond the notes in IN-01/IN-02.

## Critical Issues

### CR-01: The `np_store` v3 write-back can destroy un-migrated legacy message bodies before the migration reads them

**File:** `src/store/useExtensionStore.ts:840-861` (persist config), `:842-852` (`partialize`), `:983-1010` (`npStoreMigrate`); `src/core/theme/chromeStorageAdapter.ts:14`, `:141-158`; `src/core/storage/legacyChatMigration.ts:258`, `:640-641`, `:674`, `:707`

**Issue:** Two writers own `np_store` with no ordering contract between them:

- The zustand `persist` config stores under `name: 'np_store'` with `version: NP_STORE_SCHEMA_VERSION` (3) and `migrate: npStoreMigrate`. For a legacy blob (`version: 1|2`) zustand v5 takes the migrate branch and then **writes the migrated state back** (`node_modules/zustand/esm/middleware.mjs:411-424`: `const [migrated, migratedState] = migrationResult; … if (migrated) return setItem();`). `setItem` serialises `partialize(get())`, and `partialize` is `projectNpStoreV3(state)` whose allow-list is `['config','prompts','writeHistory','notes']` — message bodies, `sessions` and `activeSessionId` are dropped by construction.
- The storage adapter debounces that write by 300 ms (`STORAGE_DEBOUNCE_MS`, `chromeStorageAdapter.ts:14`), and every later store `set` schedules another body-free write for the same key (`chromeStorageAdapter.ts:146`).

The legacy migration, however, reads its only source there: `runLegacyChatMigration` → `discovered` → `readSource()` → `chrome.storage.local.get('np_store')`. That read happens only after (a) the surface module imports and mounts, (b) `getDb()` opens/creates `np_db`, and (c) `recoverJournal()` reads `entries` (`useExtensionStore.ts:374-399`). If the store's debounced write lands first, `parseLegacyEnvelope` sees `version === 3`, sets `alreadySanitised: true` (`legacyChatMigration.ts:258`), and stages `destination-written` (`:640`), `destination-verified` (`:674`) and `source-sanitised` (`:707`) all return early — the entry is marked `completed` with `conversations: 0`, `runHydration` sees `migration.ok` and an empty session list, and publishes `empty`. Message bodies are then gone from `chrome.storage.local` and were never written to ChatHistoryDB: no failure, no `IDB_MIGRATION_FAILED` notice, no journal stage left to resume, no error record. This is precisely what D2-07 ("Do not retain message bodies in np_store **after their migration has been durably verified**"), D2-12 ("do not delete the affected source body before destination verification") and D2-14 (idempotency across "the extension reloads mid-migration") prohibit. It is also not a one-shot window: any store `set` before the migration's `discovered` stage produces the same body-free write, so a slow first IndexedDB open, a busy main thread, a user action that calls `flushPendingWrites()` (theme toggle via `persistThemeNow`, `ThemeStore.ts:205`, and the `beforeunload`/`visibilitychange` hooks in `chromeStorageAdapter.ts:114-124`) all widen it. `tests/core/store/useExtensionStore.test.ts` asserts the store-side write-back ("a seeded v2 blob with a sentinel body … produces a stored blob at version 3 with no body substring", 02-08-SUMMARY.md:123) but never runs the migration in that scenario, so the loss path is currently green.

**Fix:** Make the migration's source read strictly precede any `np_store` write, or make the store's `np_store` write non-destructive while the migration is incomplete. Recommended: stop the store from replacing the blob until the migration owns the cutover — e.g. have the `np_store` write path merge `projectNpStoreV3(state)` over the *stored* blob while the `migrate-legacy-conversations` journal entry is not `completed`, preserving `state.sessions`/`state.activeSessionId` and the legacy `version` untouched (the migration's `source-sanitised` stage is already the sole writer of the verified v3 blob, `legacyChatMigration.ts:726-732`). A cheaper alternative is to capture the legacy source once at module evaluation (before the persist hydration can flush) and have the first `runLegacyChatMigration()` read that snapshot. Either way, add a regression test that seeds a v1/v2 blob with a synthetic body, drives the *real* startup order (`useExtensionStore` hydration **then** `hydrateChatHistory()`), and asserts the migration reports `conversations > 0` with the body present in ChatHistoryDB and absent from `np_store`.

### CR-02: `WorkspacePersistence` has no production call site — workspace state is never persisted or hydrated, and every page load mints a new `workspaceId`

**File:** `src/core/workspace/WorkspacePersistence.ts:238-403` (exports), `src/core/workspace/WorkspaceStore.ts:164-186`, `src/core/workspace/WorkspaceState.ts:173-190`, `src/core/workspace/WorkspaceRouter.ts:155-193`

**Issue:** A repo-wide search finds no consumer of `readWorkspaceState`, `writeWorkspaceState` or `subscribeToWorkspaceChanges` outside their own module (the harness and suites are the only callers: `tests/harness/twoSurface.ts:35`, `tests/core/workspace/WorkspacePersistence.test.ts`, `tests/integration/workspaceHandoff.integration.test.ts:22`), and `WORKSPACE_STORAGE_KEY` is written nowhere in `src/`. Consequences in the shipped build:

- `np_workspace` is never written, so nothing survives a reload. `createInitialWorkspaceState()` mints `workspaceId: crypto.randomUUID()` (`WorkspaceState.ts:176`) at module evaluation, so **each document load produces a different workspace identity**; a reloaded Side Panel and a live Standalone can disagree about the workspace, and the `version` write counter starts at 0 per document, so the last-write-wins-by-version rule (`WorkspacePersistence.ts:282-289`) has no shared basis the moment the two surfaces do start writing.
- The handoff path (`openStandalone` → `createWorkspaceHandoffSource`) carries the identity through the URL and the in-memory store only; it never persists or reads back, so D2-31's clause 17 ("persistence and authoritative read-back where required") is exercised only by the harness.
- This was a recorded cross-plan hand-off that was dropped: 02-06-SUMMARY.md states "**02-08 / 02-10** hydrate and persist through `readWorkspaceState()` / `writeWorkspaceState()`", and 02-10-SUMMARY.md's D6 records only the journal/election wiring. Meanwhile `WorkspaceStore.ts:165-166` documents the opposite of the shipped behaviour ("the workspace key is written by `WorkspacePersistence` (02-06) under the journal"). ROADMAP Phase-2 DONE-when criterion 4 ("Workspace state persists across page reload and cross-surface handoff") is therefore not met by the shipped artifact — only by the in-process suites.

**Fix:** Wire the read/write path in the surface startup sequence (02-10's `usePhase2Startup`, both entrypoints): hydrate `readWorkspaceState()` into `useWorkspaceStore` before the first election, and persist on the authorised mutations (`WorkspaceRouter.ts:291-293`, `:299-301`) through `writeWorkspaceState` — after hydrating the `version` counter from the persisted state so the monotonic rule does not reject the opposite surface's writes, and behind `assertStillPrimary()` as the module docs state. If the operator intends the wiring for a later phase instead, correct ROADMAP criterion 4, the `WorkspaceStore` doc comment and 02-06-SUMMARY's readiness note, and record the deferral (this is currently an unreported gap, not a recorded one).

## Warnings

### WR-01: Startup recovery silently ignores every non-migration journal entry, leaving the failed `update-workspace` entry permanently non-terminal

**File:** `src/store/useExtensionStore.ts:196-208` (line 203: `if (entry.operation !== MIGRATION_OPERATION) return;`), `src/core/storage/WriteJournal.ts:329-360`, `src/core/workspace/WorkspacePersistence.ts:333-355`

**Issue:** `defaultRecoverJournal`'s replay callback returns immediately for any operation that is not `migrate-legacy-conversations`, and `recoverJournal` counts a non-throwing replay as `replayed` (`WriteJournal.ts:347-348`). `WriteJournal`'s documented contract is that "on startup every `pending` / `applying` entry is replayed (idempotently) or rolled back" (`WriteJournal.ts:8-11`). A workspace write that failed at `emit-workspace-updated` is left `applying` by design (`WorkspacePersistence.ts:341`), and nothing ever re-runs its idempotent steps: the key was written but the other surface is never signalled, the entry never reaches a terminal state, and because a non-terminal entry is never removed by compaction it is pinned in `entries` forever. The same path also swallows genuinely stuck entries, so the "resumable record rather than an invisible half-write" claim in `WorkspacePersistence.ts:38-40` is only half true.

**Fix:** Give `update-workspace` a replay branch — re-run the journaled steps (they are idempotent: `setItem` of the same state, publish the two-identifier signal) and, where the stored value already shows the write landed, mark the entry terminal with a redacted result. Return a typed outcome so `recoverJournal`'s `replayed`/`failed` counts mean what they say.

### WR-02: `WriterElection.stop()` can delete another surface's freshly won record

**File:** `src/core/workspace/WriterElection.ts:352-366` (called from `:384-392`)

**Issue:** `removeIfOwned()` is read-then-remove with no ownership re-check: it reads the record, sees `isSelf`, then `await area.remove(PRIMARY_RECORD_KEY)`. If the other surface wins an election in the window between the read and the remove, its record is deleted. That surface's own `elect()` read-back then finds `null` and the code falls through both CAS branches to `fail('ELECTION_TIMEOUT', …)` (`:346-349`), so it reports the typed error state for up to a full heartbeat (3 s) and — if a `requestRefocus()` lands in that window — the user sees the persistent `workspace.electionFailed` notice ("Could not coordinate between surfaces. Reload to retry.") with nothing actually failing. The same deletion drops the winner's authority until its next heartbeat.

**Fix:** Prefer releasing primacy implicitly: let `stop()` only clear the heartbeat and let the record go stale after `STALE_AFTER_MS` (which is the documented release mechanism, `:32-35`). If an explicit release is kept, re-verify after the removal (read back; if the removed value was not this writer's, re-elect) instead of trusting the pre-read.

### WR-03: The background-SW "no IndexedDB" hard rule is claimed to be gated, but no gate exists

**File:** `src/core/storage/NowPilotDB.ts:42-44` ("The import boundary is asserted by the phase's isolation gate."), `tests/isolation/` (`banned-imports`, `cross-entrypoint-imports`, `generated-manifest`, `no-tailwind-gate` — none inspects the background graph for `src/core/storage/**`, `idb` or `IndexedDB`), `package.json:18` (`verify:phase-2` runs `tests/isolation`)

**Issue:** The runtime is currently correct — `src/entrypoints/background.ts`'s import graph (`BackgroundRouter` → `MessageBus`/`RuntimeEnvelope*`, `legacyWorkspaceBlob`, `onboardingStateStore` → `debugLog`/`types`, `legacyCredentialCleanup`) reaches no IndexedDB module — but the claim of enforcement is false, and §0.2 is a project hard rule. A future edit that imports `NowPilotDB` or the store from the background would compile, keep every phase suite green, and only surface as a runtime MV3 failure.

**Fix:** Add `tests/isolation/background-no-indexeddb.test.ts` mirroring the existing bundle-grep pattern (`tests/isolation/no-content-script-ui.test.ts`): resolve `src/entrypoints/background.ts`'s import graph (or grep the built background chunk) and assert no `src/core/storage/**`, `idb` or `IndexedDB` reference, with a non-vacuous positive control. Then either keep the module comment's claim or drop the sentence.

## Info

### IN-01: `compactJournal()` still has no production call site, so the journal grows one entry per workspace version forever

**File:** `src/core/storage/WriteJournal.ts:369-390`, `src/core/workspace/WorkspacePersistence.ts:291-306`

Recorded as WINDOWS #25 (open), so not a new defect — but the consequence is worth stating precisely: every successful `update-workspace` write creates a permanent `entries` row (the idempotency key is `workspaceId:version`, and `version` increments on every store mutation), and the only bounded-cleanup path is never invoked (`rg compactJournal src/` → declaration only). Non-terminal entries are also never removed by design, so WR-01's stuck entries compound. Fix: call `compactJournal` from a startup/periodic service path and delete the returned ids; until then keep the ledger row visible at ship time.

### IN-02: `MirrorBanner`'s pinned 400 px behaviour is not implemented, and the caption overrides the pinned line height

**File:** `src/components/common/MirrorBanner.tsx:62-95`

The UI-SPEC pins the caption as 12px on the body/label line-height role (1.5) and the overflow backstop as "the caption wraps to at most 2 lines then ellipsizes; the action never wraps or clips" (`02-UI-SPEC.md` § Typography, § UI Considerations). The implementation sets `lineHeight: '32px'` on both the caption (`:66`) and the action (`:89`) — a value outside the pinned role — and gives the action (`Typography.Link`, `:71-95`) no `flexShrink: 0` / `whiteSpace: 'nowrap'`, so with `justifyContent: 'space-between'` the flex algorithm may shrink and wrap "Refocus here" at 400 px; no clamp or ellipsis exists for a two-line caption either. Fix: drop the literal line height (use the 12px/1.5 role), add `flexShrink: 0` + `whiteSpace: 'nowrap'` to the action and the two-line clamp to the caption. Phase 15 owns the observation, but the mechanism should already enforce it.

### IN-03: `toChatSession` projects a `tool` record as a `system` message

**File:** `src/store/useExtensionStore.ts:259-266`

`MessageRecord.role === 'tool'` collapses to `'system'` because the component-facing `Message` union lacks `'tool'`. It cannot leak anything (the DB owns role/type, D2-08), but the projection silently loses the tool/system distinction the contract preserves. Record it for the Phase 15 Chat integration, or extend the component union when the renderer lands.

### IN-04: A single malformed conversation forces the whole hydration status to `failed` / `recovery required`

**File:** `src/store/useExtensionStore.ts:415-453`; rendered at `src/components/sidepanel/SidePanelShell.tsx:82-93`

The valid records do hydrate into `state.sessions`, but the published status is `failed` (or `recovery required`) whenever any record is invalid, so the conversation region shows "Failed to load history" + Retry in place of the hydrated data and `retryHydration()` re-runs against the same immutable malformed record — a permanently non-ready state with no exit. This is deliberate (asserted in `tests/core/store/useExtensionStore.test.ts:684-703`) and does not violate D2-18's "never treat a database error as empty history", but it diverges from the 02-UI-SPEC `partial` row ("the remaining conversations still hydrate") and leaves the approved Retry action a dead end. Decide explicitly: add a partial presentation/status, or record the deviation against the UI-SPEC row and make the Retry outcome honest.

### IN-05: `runJournaled` does not roll back the failing step

**File:** `src/core/storage/WriteJournal.ts:295-312`

Only the previously *applied* steps are rolled back (`for (const step of [...applied].reverse())`); the step that threw may have partially applied and its `rollback()` is never called. Harmless today (every current step is a single idempotent upsert and every rollback is a no-op), but the journal is the general write contract for later phases. Either document the "`apply` must be atomic or idempotent" invariant as the reason, or roll the failing step back as well.

### IN-06: `KeyVault.store`'s create-only guarantee is a best-effort read-then-write

**File:** `src/core/security/KeyVault.ts:267-289`

`store` reads the key, rejects when present, then encrypts and writes — with no CAS (chrome.storage offers none). Two concurrent `store` calls for the same provider can both observe "absent" and both return `{ ok: true }`, with the later envelope silently superseding the earlier one instead of the documented `KEY_VAULT_ALREADY_CONFIGURED`. Only `CredentialStorePort` (Phase 3) is expected to call it, so the practical risk is low, but the module's documented semantics should say "best-effort, not atomic", or the write should be serialised through `Setting.writeSettingSerialized`-style ordering.

---

_Fixed: 2026-09-24 — all 5 Critical/Warning findings plus IN-02/IN-05/IN-06 fixed in 7 atomic `fix(02)…` commits (`76d7bd7f`, `ed773d05`, `0f4e1f6e`, `8fa6fe28`, `b8d9a4f4`, `c43c07aa`, `18d206c6`); IN-01/IN-03/IN-04 recorded open with reasons. Full evidence in `02-REVIEW-FIX.md`._

_Reviewed: 2026-09-24T03:21:18Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
