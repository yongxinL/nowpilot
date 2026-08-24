---
phase: 02-storage-security-writejournal-workspace-persistence
reviewed: 2026-08-24T00:00:00Z
depth: standard
files_reviewed: 40
files_reviewed_list:
  - entrypoints/sidepanel/main.tsx
  - entrypoints/standalone/main.tsx
  - package.json
  - src/components/chat/SidepanelChat.tsx
  - src/components/options/OptionsPage.tsx
  - src/core/http/Requester.ts
  - src/core/security/KeyVault.ts
  - src/core/security/redactSensitive.ts
  - src/core/storage/ChatHistoryDB.ts
  - src/core/storage/EncryptedStorage.ts
  - src/core/storage/ErrorStore.ts
  - src/core/storage/IndexedDBMigrator.ts
  - src/core/storage/MemoryDB.ts
  - src/core/storage/NotesDB.ts
  - src/core/storage/Setting.ts
  - src/core/storage/WriteJournal.ts
  - src/core/storage/WriteJournalDB.ts
  - src/core/theme/chromeStorageAdapter.ts
  - src/core/utils/RateLimiter.ts
  - src/core/workspace/journalingAdapter.ts
  - src/core/workspace/WorkspaceElection.ts
  - src/core/workspace/WorkspaceStore.ts
  - src/core/workspace/WorkspaceSync.ts
  - src/store/useExtensionStore.ts
  - src/types/storage.ts
  - tests/core/security/secrets-inspection.test.ts
  - tests/core/storage/chromeStorageAdapter.test.ts
  - tests/core/storage/EncryptedStorage.test.ts
  - tests/core/storage/ErrorStore.test.ts
  - tests/core/storage/harness-smoke.test.ts
  - tests/core/storage/IndexedDBMigrator.test.ts
  - tests/core/storage/WriteJournal.test.ts
  - tests/core/utils/RateLimiter.test.ts
  - tests/core/utils/Requester.test.ts
  - tests/core/workspace/journalingAdapter.test.ts
  - tests/core/workspace/WorkspaceElection.test.ts
  - tests/core/workspace/WorkspacePersistence.test.ts
  - tests/core/workspace/WorkspaceStore.test.ts
  - tests/setup.ts
  - wxt.config.ts
findings:
  critical: 2
  warning: 3
  info: 3
  total: 8
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-08-24T00:00:00Z
**Depth:** standard
**Files Reviewed:** 40
**Status:** issues_found

## Summary

This phase delivers the encrypt-at-rest layer (KeyVault + EncryptedStorage), the IndexedDB foundation, WriteJournal + journalingAdapter, WorkspaceElection, and the chromeStorageAdapter error-classification + WorkspaceStore persistence integration. The crypto primitives, IDB schemas, redaction logic, RateLimiter, and debounced adapter are well-structured, defensive, and well-tested.

Two **CRITICAL** correctness defects were found in the workspace layer, both of which pass the existing test suite because the tests bypass the exact production wiring that is broken:

1. **Journal recovery writes an empty workspaceId** — the boot `recoverJournal` replay reconstructs the `np_workspace` value from `entry.workspaceId`, but journal entries are metadata-only (D-33) and never persist `workspaceId`/`conversationId`. On any crash with a pending/applying entry, recovery **overwrites** `np_workspace` with `{"workspaceId":"","conversationId":null}` — a data-loss bug in the exact crash-recovery path this phase exists to provide.
2. **The election heartbeat is never published** — `runHeartbeatTick` writes the session record but never calls `notifyWorkspaceHeartbeat`, so `WORKSPACE_HEARTBEAT` is never broadcast. `notifyWorkspaceHeartbeat` is defined in `WorkspaceSync` but has zero call sites. This makes the lone-surface trap always transition `primary → solo` and, critically, breaks the standalone-tie-break demotion rule: a Standalone surface that starts after an established Sidepanel primary will lose the election (become secondary) instead of winning per spec §20.11.

Plus WARNINGs around a test-seam used in production UI, a `console.error` that violates the `debugLog` convention, and the install-secret-at-rest design weakness.

## Critical Issues

### CR-01: Journal recovery overwrites `np_workspace` with an empty workspaceId (data loss on crash recovery)

**File:** `entrypoints/sidepanel/main.tsx:75-78` (and identical `entrypoints/standalone/main.tsx:75-78`)

**Issue:** The boot `recoverJournal` replay reconstructs the persisted value from the journal entry:
```ts
const builder = stepFactory('np_workspace', JSON.stringify({
  workspaceId: (entry as { workspaceId?: string }).workspaceId ?? '',
  conversationId: (entry as { conversationId?: string | null }).conversationId ?? null,
}));
```
The `write-np-workspace.apply` step of `createWorkspaceWriteSteps` calls `deps.write(name, value)` with that value, so recovery writes `{"workspaceId":"","conversationId":null}` to `np_workspace`.

However, `WriteJournalEntry` (`src/types/storage.ts:63-70`) carries only `{id, operation, status, attempts, steps, createdAt}` — no `workspaceId`/`conversationId`. `journalingAdapter.setItem` (`journalingAdapter.ts:158-165`) builds entries without these fields (metadata-only by D-33). Therefore `entry.workspaceId` is **always `undefined`** at recovery time, and the `?? ''` fallback fires.

The result: whenever the SW is killed leaving a `pending`/`applying` update-workspace entry, the very next boot replays it and **overwrites the real `np_workspace` with an empty workspaceId**, corrupting the last workspace state — the exact opposite of what recovery is supposed to do (the `WriteJournal.ts` docstring and `WorkspacePersistence.test.ts` Test 5 both state recovery should *restore* the value). The test passes only because Test 5 hardcodes `'recovered-ws'` in the step's `apply` (`WorkspacePersistence.test.ts:338-343`) rather than exercising the real boot wiring.

**Fix:** Recovery must not reconstruct the payload from the (metadata-only) entry. Either (a) persist the full value (or `workspaceId`+`conversationId`) on the entry when `journalingAdapter.setItem` creates it and read it back here, or (b) have the replay `apply` re-read the *current* `np_workspace` from storage and re-apply that value rather than an empty reconstruction:
```ts
// Option (b): write the CURRENT canonical value, not an empty placeholder.
const write = async (name: string) => {
  const existing = await chromeStorageAdapter.getItem(name);
  if (existing !== null) await chromeStorageAdapter.setItem(name, existing);
};
```
Whatever is chosen, add an integration test that drives the real boot recovery path (an entry whose only persisted fields are `id`/`operation`/`status`) and asserts `np_workspace` retains its original value.

### CR-02: Election heartbeat is never published — demotion and lone-surface detection are dead code

**File:** `src/core/workspace/WorkspaceElection.ts:246-284` (`runHeartbeatTick`), `src/core/workspace/WorkspaceSync.ts:44`

**Issue:** `runHeartbeatTick`'s doc comment states it "Publishes a `WORKSPACE_HEARTBEAT` on the existing `np_workspace` BroadcastChannel" — but the function body only calls `writeRecord(...)`; it never calls `notifyWorkspaceHeartbeat`. `notifyWorkspaceHeartbeat` (`WorkspaceSync.ts:44`) has **zero call sites** in `src/` (confirmed by grep). Since `BroadcastBus.publish` is the only way `onWorkspaceSync` receives a `WORKSPACE_HEARTBEAT`, `foreignSurfacesEverSeen` stays `false` forever in production.

Consequences:
- **Lone-surface trap always fires:** every `primary` transitions to `solo` on the first heartbeat tick (`runHeartbeatTick:280-282`), even when a real secondary exists. `isPrimaryWriter()` still returns true for `solo`, so writes continue, but the election state is wrong and secondary surfaces are never acknowledged.
- **Standalone tie-break demotion is dead:** the inbound handler's demotion rule (`WorkspaceElection.ts:348-363`, "if a higher-priority foreign surface appears, demote to secondary") never runs because no foreign heartbeat arrives. When the user opens the Standalone view *after* the Side Panel has already become `primary`, the Standalone's `runStartupCAS` reads a fresh Sidepanel record; since the start is outside the 3 s `sameWindow`, the Standalone becomes **secondary** — losing the spec §20.11 "Standalone always wins" guarantee. The election permanently locks the Sidepanel as primary until its session record goes stale.

**Fix:** Publish the heartbeat in `runHeartbeatTick` for primary/solo surfaces (mirroring the documented intent), e.g.:
```ts
if (cur.state === 'primary' || cur.state === 'solo') {
  notifyWorkspaceHeartbeat(surface, /* workspaceId */);
}
```
and verify with a two-surface test (Sidepanel primary → Standalone starts later → Standalone wins) that does not manually inject the heartbeat via `publish(...)` the way `WorkspaceElection.test.ts:186-191` currently does.

## Warnings

### WR-01: Production UI reaches into the `__test__` seam to refocus the election

**File:** `src/components/chat/SidepanelChat.tsx:369-377`

**Issue:** The `MirrorBanner` `onRefocus` handler imports `WorkspaceElection`'s `__test__` object and calls `electionTest.getActiveInstance()` — a test-only seam — from production UI code. Every other module in the codebase explicitly documents that `__test__` "MUST NOT be touched" by production code (e.g. `KeyVault.ts:100`, `chromeStorageAdapter.ts:310-312`). Relying on the module-level singleton + test seam in production makes the refocus path brittle and couples UI to test internals. It also bypasses the `startElection` double-start guard semantics by manually disposing before re-electing.

**Fix:** Expose a public, non-test API on `WorkspaceElection` for this (e.g. `requestElection(surface)` that disposes the current instance and starts a fresh election), and call that from the UI instead of `__test__`.

### WR-02: `console.error` in production Options page violates the `debugLog` convention

**File:** `src/components/options/OptionsPage.tsx:264`

**Issue:** `handleSaveProviderModal`'s catch block calls `console.error('Provider save failed:', ...)`. CLAUDE.md and the module docs require `debugLog(code, ...)` for all diagnostics and forbid raw `console.log`. The same catch block intentionally does not surface the error to the user (UI-SPEC E1), so the error is only observable via the console — which means the required ErrorStore/debugLog diagnostic is not actually emitted, making the failure effectively invisible to the diagnostics surface.

**Fix:** Replace `console.error` with `debugLog('PROVIDER_SAVE_FAILED', err.message)` (or route through the registered storage error reporter), so the failure is captured by the Phase-6 diagnostics path.

### WR-03: Install secret stored in `chrome.storage.local` alongside the ciphertext it protects

**File:** `src/core/security/KeyVault.ts:46-71` (`ensureInstallSecret`)

**Issue:** `np_install_secret` (the AES key-derivation root) is persisted in `chrome.storage.local` — the same storage area that holds `np_providers` (the ciphertext it protects, via `useExtensionStore`). An actor who can read `chrome.storage.local` gets both the random secret and the ciphertext and can trivially re-derive the key and decrypt every API key. The "encrypt-at-rest" guarantee therefore does not protect against local-storage compromise — only against accidental plaintext exposure in logs/backups. This is a deliberate, documented trade-off (D-29), but it materially weakens the feature's headline security property and is worth an explicit residual-risk note. Additionally, `ensureInstallSecret` regenerates a new secret whenever the stored value's length is not exactly `SECRET_BYTES` (`KeyVault.ts:50-52`); a transient/corrupt partial read would orphan all previously-persisted ciphertext (unrecoverable data loss for every saved provider key).

**Fix:** Document the residual risk explicitly in the ADR/spec (the current code comments frame it as fully accepted without calling out that storage compromise defeats the encryption). For the regeneration-on-mismatch path, prefer to fail/surface an error rather than silently rotating the root secret when the stored value merely fails the length check.

## Info

### IN-01: `getNoteByTitle` is ambiguous for duplicate titles

**File:** `src/core/storage/NotesDB.ts:88-94`

**Issue:** `getNoteByTitle` uses `getFromIndex('notes', 'byTitle', title)`, which returns only the first record matching the index key. The `byTitle` index is declared non-unique (`NotesDB.ts:69`), so two notes sharing a title silently return an arbitrary/first match.

**Fix:** If uniqueness is expected, declare the index `unique: true`; otherwise document the first-match semantics or use `getAllFromIndex` + disambiguation.

### IN-02: `ErrorStore` FIFO eviction deletes one entry per write

**File:** `src/core/storage/ErrorStore.ts:80-85`

**Issue:** After `count > MAX_ERROR_ENTRIES`, the eviction deletes exactly one oldest entry via cursor. Since each `record` adds one and evicts one, steady-state stays at 100 — correct. This is only a note that a burst of concurrent writes could transiently exceed the ceiling before the next write self-corrects; not a defect.

### IN-03: `deriveKey` fallback extension-id sentinel

**File:** `src/core/security/KeyVault.ts:36`

**Issue:** `getExtensionId()` returns the constant `'nowpilot-test-extension-id'` outside real extension contexts. In production `chrome.runtime.id` is present, so this only affects tests — but if this module were ever run in a non-extension context with the fallback, key derivation would be identical across all users (mitigated only by the per-install random secret). Low risk; worth a one-line comment that the sentinel must never be a deployed value.

---

_Reviewed: 2026-08-24T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_

## Self-Check

- [x] Read every listed source file at standard depth (both entrypoints, all `src/core/` workspace/security/storage/theme/http/util modules, `useExtensionStore`, `types/storage.ts`, config, and the test suite).
- [x] CR-01 verified by tracing `WriteJournalEntry` shape (`types/storage.ts`) → `journalingAdapter` entry construction (no workspaceId persisted) → boot replay reconstruction (`?? ''` fallback). The test gap is confirmed: `WorkspacePersistence.test.ts` Test 5 hardcodes the value and does not exercise the real boot wiring.
- [x] CR-02 verified by grep: `notifyWorkspaceHeartbeat` has no call sites in `src/`; `runHeartbeatTick` body contains no publish; the lone-surface trap and demotion rule both depend on inbound heartbeats that are never sent.
- [x] WR-01/WR-02/WR-03 grounded in file+line citations.
- [x] No source files modified; only `02-REVIEW.md` created.
