---
phase: 02-storage-security-writejournal-workspace-persistence
fixed_at: 2026-08-09T08:50:00Z
review_path: .planning/phases/02-storage-security-writejournal-workspace-persistence/02-REVIEW.md
iteration: 1
findings_in_scope: 14
fixed: 14
skipped: 0
status: all_fixed
---

# Phase 2: Code Review Fix Report

**Fixed at:** 2026-08-09T08:50:00Z
**Source review:** `.planning/phases/02-storage-security-writejournal-workspace-persistence/02-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 14 (2 CRITICAL + 10 WARNING + 2 trivially-cheap INFOS: IN-03, IN-04)
- Fixed: 14
- Skipped: 0

**Verification:** `pnpm run verify:phase-2` exits 0 — eslint, prettier --check, `tsc --noEmit`, `wxt build`, `vitest run` (42 files / 280 tests green), and the content-bundle isolation check all pass. No INFO findings beyond IN-03/IN-04 were touched (IN-01/02/05/06/07 are not trivially cheap and were left for the phase owner).

## Fixed Issues

### CR-01: Journal replay fabricates workspace content — crash recovery loses the intended write

**Files modified:** `src/types/storage.ts`, `src/core/workspace/WorkspaceStore.ts`, `tests/fixtures/index.ts`, `tests/core/workspace/WorkspacePersistence.test.ts`
**Commit:** `4ad6e41`
**Applied fix:** The `update-workspace` journal entry now persists the D-18 active-field snapshot (`pickActive(ws)`) in a new optional `payload` field on `WriteJournalEntry`; `recoverWorkspaceJournal` replays by applying the entry's OWN snapshot, shape-checked through `sanitizeStored` (legacy payload-less entries fall back to version-bump convergence). The shared fixture's crash entries now carry a DIFFERENT `conversationId`/`activeSurface` than the pre-crash local state, and the integration test asserts the replay restores THAT content to both the store and `np_workspace` — the buggy version-only convergence is no longer encoded as passing behavior.

### CR-02: Vault envelope not storage-serializable; `decryptSecret` derives the key outside the typed-error path

**Files modified:** `src/core/storage/EncryptedStorage.ts`, `src/core/security/KeyVault.ts`, `tests/core/storage/EncryptedStorage.test.ts`, `tests/core/security/KeyVault.test.ts`
**Commits:** `3ab5dfa`, `53ad398`
**Applied fix:** Added the JSON-safe base64 wire form — `serializeEnvelope`/`deserializeEnvelope`/`encodeBase64Bytes`/`decodeBase64Bytes`/`isSerializedVaultEnvelope` — so persisted envelopes survive chrome.storage's JSON round-trip losslessly. `decryptSecret` now wraps the ENTIRE derive+decrypt sequence in the typed-error path: any failure (including a raw TypeError from a JSON-mangled salt) converges on `VAULT_DECRYPT_FAILED` + `PROVIDER_KEY_UNREADABLE` + debugLog. New tests: a chrome.storage round-trip (serialize → set → get → deserialize → decrypt) and a JSON-degraded-raw-envelope convergence test.

### WR-01: KeyVault state machine can never return to OK

**Files modified:** `src/core/security/KeyVault.ts`, `tests/core/security/KeyVault.test.ts`
**Commit:** `d62129b`
**Applied fix:** Added public `markProviderKeyOk(reason?)` which resets `providerKeyState`/`unreadableReason` to OK/null and notifies listeners (no-op when already OK) — the D-04 re-entry recovery path is now live for Phase 3's key-re-entry write.

### WR-02: Full-vault restore crash recovery is not replayable — the payload is never retained

**Files modified:** `src/core/storage/ImportExport.ts`, `src/core/workspace/WorkspaceStore.ts`, `tests/core/storage/ImportExport.test.ts`
**Commit:** `9259cf4` (also carries IN-03)
**Applied fix:** `restoreFullVault` now persists the parsed groups on the entry (`payload: { groups }`, redacted at the persist boundary by the existing D-16 hook). Exported the production replay handler `replayRestoreEntry(entry, opts)` (per-group merges from the entry's OWN payload, additive + idempotent) and wired it into `recoverWorkspaceJournal` for `restore-notes-batch` entries (previously skipped as "unknown operation"). Tests: the hand-written harness was replaced with the production handler via `recoverJournal`, plus an end-to-end test driving the real `recoverWorkspaceJournal` dispatch through a store `init()`; the completed-restore test now asserts payload retention.

### WR-03: `persistJournalEntry` swallows persist failures — journal atomicity silently voids

**Files modified:** `src/core/storage/WriteJournal.ts`, `tests/core/storage/WriteJournal.test.ts`
**Commit:** `3489c18`
**Applied fix:** `persistJournalEntry` rethrows after logging, so `runJournaled` aborts at the 'applying' boundary (nothing runs when the journal cannot be written) and rolls back on mid-flight persist failures. A failure to persist the 'rolled-back' marker is logged-and-swallowed inside `runJournaled` so it never masks the original error. New tests cover abort-on-unpersistable-journal and the non-masking rolled-back-persist failure.

### WR-04: redactSensitive drops only exact normalized names; non-`sk-` apiKeys pass

**Files modified:** `src/core/security/redactSensitive.ts`, `src/core/security/TraceRedactor.ts`, `tests/core/security/redactSensitive.test.ts`
**Commit:** `1f1b24b`
**Applied fix:** DROP decisions now use exported `isSensitiveFieldKey` — suffix matching on `token`/`secret`/`password`/`authorization` plus a secret-root + `key` compound rule (`secret_key` → `secretkey`) — catching `access_token`/`auth_token`/`refresh_token`/`client_secret`/`secret_key`/camelCase/uppercase variants while leaving `apiKey` inline-redacted (not dropped). `TraceRedactor` gained broader API-key patterns (`AIza[0-9A-Za-z_-]{20,}`, `api[_-]?key=…`) so Google-style and `api_key=` values no longer survive verbatim.

### WR-05: `debugLog` renders `options.extra` unredacted

**Files modified:** `src/core/error/debugLog.ts`, `tests/core/error/debugLog.test.ts`
**Commit:** `2658039`
**Applied fix:** `options.extra` is routed through `redactSensitive` (values redacted/dropped, keys kept) before the console call — R-10/O.13 now holds for the console sink.

### WR-06: `settingReadSync` never consults the local shadow when the sync read throws

**Files modified:** `src/core/storage/Setting.ts`, `tests/core/storage/Setting.test.ts`
**Commit:** `1e48355`
**Applied fix:** The sync read is wrapped in its own catch that logs `STORE_READ` and falls through to the local-shadow read (itself wrapped); `fallback` is only returned when both the sync read and any shadow are exhausted. New tests: sync-read rejection + shadow present → shadow wins; sync-read rejection + no shadow → fallback.

### WR-07: IndexedDBMigrator runs only the exact fromVersion migration

**Files modified:** `src/core/storage/IndexedDBMigrator.ts`, `tests/core/storage/IndexedDBMigrator.test.ts`
**Commit:** `44740dc`
**Applied fix:** `onupgradeneeded` now dispatches the FULL chain — every migration whose `fromVersion ∈ [oldVersion, newVersion)`, sorted by `fromVersion` — so chained upgrades (1→2→3) and fresh installs (0→N, incl. a `fromVersion: 0` initial-schema step) run every step. Also fixed the latent `result !== null` guard (true for `undefined` returns) that made any sync migration without a promise return throw `undefined.catch` inside the upgrade. New tests: chained 1→2→3 (both steps + data carried) and fresh-install 0→2.

### WR-08: `mergeGroup` performs no record-level shape validation

**Files modified:** `src/core/storage/ImportExport.ts`, `tests/core/storage/ImportExport.test.ts`
**Commit:** `a73c130`
**Applied fix:** Per-store type guards (`isChatSession`/`isChatMessage`/`isNote`/`isConcept`/`isMemoryMessage`/`isFact`/`isConversationSummary`) validate every incoming record before `put`; malformed records (e.g. `{ id: 's-9' }` with no fields) are skipped-and-logged (`STORE_WRITE`), mirroring the `sanitizeStored` inbound-gate pattern, so hostile/corrupted exports can no longer persist rows later consumers crash on.

### WR-09: `collectGroup` can silently ship an incomplete export

**Files modified:** `src/core/storage/ImportExport.ts`, `tests/core/storage/ImportExport.test.ts`
**Commits:** `6506e7a`, `7dcd276`
**Applied fix:** `collectGroup` reads each group via direct `db.getAll` calls inside its own try/catch (the swallowing `listSessions`/`listNotes`/`listConcepts`/`listFacts` helpers are no longer used) — a failed store read now surfaces as a rejected export instead of an empty group. Test forces a `sessions` read failure via `IDBObjectStore.prototype.getAll` spy and asserts `exportJson` rejects.

### WR-10: `np_providers` storage contract inconsistent across registry, Setting gate, and KeyVault

**Files modified:** `src/core/storage/Setting.ts`, `src/core/storage/ImportExport.ts`, `tests/core/storage/Setting.test.ts`, `.planning/PRODUCT_SPEC_v0_1.md`
**Commit:** `b4332cb`
**Applied fix:** Picked ONE model — per-provider envelope keys. Exported `resolveKeyPermission` maps `np_providers` and every `np_providers.<id>` to `{ area: 'local', encrypted: true }`; all four Setting read/write paths and ImportExport's merge gate use it, so a `ProviderConfig[]` array is refused (not an envelope) and per-provider envelopes pass — matching the KeyVault/tests usage. Spec §15.1's data-model note updated to `np_providers.<providerId> VaultEnvelope`.

### IN-03: `restoreFullVault` entry id can collide

**Files modified:** `src/core/storage/ImportExport.ts` (folded into WR-02 commit `9259cf4`)
**Applied fix:** `id: 'restore-' + Date.now()` → `id: crypto.randomUUID()`.

### IN-04: TraceRedactor `/key-…/g` over-redacts words containing "key-"

**Files modified:** `src/core/security/TraceRedactor.ts`, `tests/core/security/redactSensitive.test.ts`
**Commit:** `f1e038f`
**Applied fix:** `key-` pattern now carries a `(?:\b|_|-|/)` prefix guard — real key starts (`api key=…`, `…/key-…`, `…_key-…`) still redact while `monkey-bars` passes through untouched.

## Skipped Issues

None — all 14 in-scope findings were fixed.

---

_Fixed: 2026-08-09T08:50:00Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
