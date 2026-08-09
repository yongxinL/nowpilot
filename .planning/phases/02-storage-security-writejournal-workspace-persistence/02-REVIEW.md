---
phase: 02-storage-security-writejournal-workspace-persistence
reviewed: 2026-08-09T08:30:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - src/core/storage/Setting.ts
  - src/core/storage/EncryptedStorage.ts
  - src/core/storage/WriteJournal.ts
  - src/core/storage/IndexedDBMigrator.ts
  - src/core/storage/ChatHistoryDB.ts
  - src/core/storage/NotesDB.ts
  - src/core/storage/MemoryDB.ts
  - src/core/storage/ErrorStore.ts
  - src/core/storage/ImportExport.ts
  - src/core/security/KeyVault.ts
  - src/core/security/redactSensitive.ts
  - src/core/security/TraceRedactor.ts
  - src/core/utils/RateLimiter.ts
  - src/core/http/Requester.ts
  - src/core/workspace/WorkspaceStore.ts
  - src/core/theme/ThemeStore.ts
  - src/core/error/errorCodes.ts
  - src/core/error/debugLog.ts
  - src/core/i18n/strings.ts
  - src/types/storage.ts
  - src/types/messages.ts
  - src/entrypoints/sidepanel/main.tsx
  - src/entrypoints/standalone/main.tsx
  - tests/core/workspace/WorkspacePersistence.test.ts
  - tests/core/storage/ImportExport.test.ts
  - tests/core/security/KeyVault.test.ts
  - tests/fixtures/index.ts
findings:
  critical: 2
  warning: 10
  info: 7
  total: 19
status: clean
---

# Phase 2: Code Review Report

**Reviewed:** 2026-08-09T08:30:00Z
**Depth:** standard
**Files Reviewed:** 21 source + 4 test/fixture files
**Status:** issues_found

## Summary

Phase 2 delivers the storage/security core: AES-GCM vault (KeyVault + EncryptedStorage), four IndexedDB stores, the IndexedDBMigrator, per-key permissioned Setting wrapper with D-15 sync-shadow, the WriteJournal with the update-workspace rewire, redaction (redactSensitive + TraceRedactor), ImportExport core, plus RateLimiter/Requester primitives and the storage bootstrap in both entrypoints.

Overall the phase is well-structured: golden-rule logging is consistently applied, error codes are canonical, D-04's "no auto-wipe / no auto-regenerate" posture is correctly implemented, and redaction is wired at the persist boundaries (ErrorStore, journal, export). The two CRITICAL findings are: (1) the journal crash-recovery path replays a **version bump with fabricated content** — the workspace payload is never persisted in the entry, so a mid-write crash loses the intended change and actively misleads other surfaces via version-LWW; (2) the vault envelope has **no storage-serializable wire format** — typed arrays/ArrayBuffer degrade under chrome.storage JSON serialization (proven by the project's own fakeBrowser mock, which JSON-round-trips every write), and `decryptSecret` derives the key outside the typed-error path so a mangled envelope throws a raw error instead of the D-03 contract (`VAULT_DECRYPT_FAILED` → `PROVIDER_KEY_UNREADABLE`).

The test suite is extensive but encodes both critical bugs as passing behavior (replay tests assert version-only convergence; the restore-recovery test injects the payload from test scope), so the failures are masked.

## Critical Issues

### CR-01: Journal replay fabricates workspace content — crash recovery loses the intended write and misleads other surfaces

**File:** `src/core/workspace/WorkspaceStore.ts:333-380` (replay), `:122-131` (entry construction)

**Issue:** An `update-workspace` journal entry persists only `targetIds: { workspaceId, version }` — the workspace payload (conversationId, activeSurface, openedStandaloneTabId) is captured only in the `journaledUpdateWorkspace` closure and never written to the journal. On crash recovery, `recoverWorkspaceJournal` rebuilds the workspace from **local state**: `converged = { ...local, version: targetVersion, updatedAt: Date.now() }`. Consider the exact scenario the journal exists to prevent — crash between `persist('applying')` and `chrome.storage.local.set(np_workspace)`:

- The crashed context intended, e.g., a conversation switch (`conversationId: 'conv-X'`).
- A fresh context inits, hydrates the **old** stored value (version 4, `conv-old`).
- Replay writes `{ ...conv-old-state, version: 5 }` to np_workspace.
- The intended change is **permanently lost**, the version counter is burned, and — worse — every other surface LWW-adopts the stale content at version 5 (`onChanged` handler line 249: `incoming.version > local.version → adopt`). Recovery actively *propagates* stale state instead of recovering the write.

The test (`tests/core/workspace/WorkspacePersistence.test.ts:102-142`) asserts only that the version converges to 5 and the fixture's `conversationId` happens to match the local state, so it passes — encoding the buggy behavior.

**Fix:** Persist the payload in the entry — e.g. serialize `pickActive(ws)` into the entry (as `targetIds: { workspaceId, version, ...pickActive(ws) }` with string-encoded values, or a dedicated JSON payload field on `WriteJournalEntry`), and have the replay apply the **entry's** snapshot (shape-checked through `sanitizeStored`) rather than `{ ...local, version }`. Add a fixture variant whose crash entry carries a *different* conversationId/activeSurface and assert the replay restores **that** content.

### CR-02: Vault envelope is not storage-serializable, and `decryptSecret` derives the key outside the typed-error path

**File:** `src/core/security/KeyVault.ts:140-171`, `src/core/storage/EncryptedStorage.ts:26-30`

**Issue:** `VaultEnvelope` is raw bytes (`salt`/`iv` as `Uint8Array`, `ciphertext` as `ArrayBuffer`) with **no encode/decode layer**. chrome.storage serializes values (its quota is computed on `JSON.stringify(value)` — official docs), and the project's own test harness proves the degradation: wxt's fakeBrowser mock performs `JSON.parse(JSON.stringify(items))` on every `storage.set`. Under that round-trip, `Uint8Array` becomes an index-keyed plain object and `ArrayBuffer` (no enumerable own properties) becomes `{}`. A persisted envelope read back is therefore `{ salt: {0:…}, iv: {0:…}, ciphertext: {} }`.

Consequences:
1. **Phase 3 wiring will break the vault in production**: any provider ciphertext persisted via `chrome.storage.local` (as the KeyVault tests already do at `KeyVault.test.ts:55`) cannot be decrypted on read-back.
2. **D-03 contract violation on the failure path**: in `decryptSecret`, `await this.getDerivedKey(secret, envelope.salt)` (line 155) sits **outside** the `try/catch` — a malformed/JSON-mangled salt makes `crypto.subtle.deriveKey` throw a raw `TypeError`, which propagates to the caller **without** `VAULT_DECRYPT_FAILED`, **without** `setProviderKeyUnreadable(...)`, and **without** a debugLog. The one shared unreadable state (D-04) is bypassed.
3. **Tests cannot catch this**: every vault test decrypts the *in-memory* envelope, never a storage-round-tripped one.

**Fix:** Define a JSON-safe envelope representation (e.g. base64 strings) with explicit `serializeEnvelope`/`deserializeEnvelope` in `EncryptedStorage.ts`, and make `decryptSecret` wrap the **entire** derive+decrypt sequence in the try/catch that converts any failure to the typed `VAULT_DECRYPT_FAILED` + `PROVIDER_KEY_UNREADABLE` state. Add a round-trip test that writes an envelope through `chrome.storage.local` and decrypts the read-back value.

## Warnings

### WR-01: KeyVault state machine can never return to OK — the D-04 re-entry recovery path is dead

**File:** `src/core/security/KeyVault.ts:195-199`

**Issue:** `setProviderKeyUnreadable()` is the only state setter; there is no `resetProviderKeyState()`/OK-transition anywhere (verified by grep). D-04's recovery path — "provider surfaces as 'Key required — re-enter' … re-entry overwrites stale ciphertext" — implies the state returns to OK after re-entry, but once `PROVIDER_KEY_UNREADABLE` is set, the provider stays disabled for the lifetime of the singleton. The recovery UX cannot complete.

**Fix:** Add a public `markProviderKeyOk(reason?)` that resets `providerKeyState`/`unreadableReason` and notifies listeners; call it from the provider layer's key-re-entry write path (Phase 3).

### WR-02: Full-vault restore crash recovery is not actually replayable — the payload is never retained

**File:** `src/core/storage/ImportExport.ts:584-623`; `src/core/workspace/WorkspaceStore.ts:352-358`

**Issue:** `restoreFullVault` builds a `restore-notes-batch` entry whose `targetIds` is `{ scope: 'full-vault' }` — the parsed groups live only in the function closure. The header claims "recovery re-runs the merges with the retained payload", but (a) no payload is persisted, and (b) the only production replay consumer, `recoverWorkspaceJournal`, skips every operation except `'update-workspace'` with "unknown operation" — so a mid-restore crash leaves an 'applying' entry that is **never** replayed and groups that were not yet merged are silently lost. The test `ImportExport.test.ts:366-406` masks this by injecting the payload from test scope into a hand-written replay harness that does not exist in production.

**Fix:** Persist the payload with the entry (e.g. a `payload` field or a per-group step payload in `steps`), and register a restore-notes-batch replay handler in the recovery path (mirroring `recoverWorkspaceJournal`), or explicitly downgrade the D-18 guarantee to "additive partial restore on crash" in docs and tests.

### WR-03: `persistJournalEntry` swallows persist failures — journal atomicity silently voids

**File:** `src/core/storage/WriteJournal.ts:122-133`

**Issue:** `persistJournalEntry` catches all errors, logs, and resolves — so `runJournaled` (O.11) proceeds through every boundary (applying → per-step → completed) even when **no journal entry was ever written**. A crash during a journaled write whose entry failed to persist leaves no trace to replay: the crash-before-apply case loses the write silently — precisely what the journal exists to prevent. Golden Rule 9 requires debugLog in catches, not that `persist` never throw; O.11's atomicity depends on durable persist.

**Fix:** Have `persistJournalEntry` rethrow after logging, so `runJournaled` aborts and rolls back when the journal itself cannot be written (a failure to persist 'rolled-back' can stay logged-and-swallowed, or roll back without the final persist).

### WR-04: redactSensitive drops only exact normalized key names — composite sensitive keys survive, and non-`sk-` apiKeys pass unredacted

**File:** `src/core/security/redactSensitive.ts:20-25, 64-77`

**Issue:** `normalizeKey('access_token')` → `'accesstoken'`, which is not in `SENSITIVE_FIELD_KEYS` — so `access_token`, `auth_token`, `refresh_token`, `client_secret`, `secret_key` values are NOT dropped (only their strings get pattern-scrubbed). The header claims "password-like fields are DROPPED"; that holds only for the four exact normalized names. Separately, the comment states "apiKey values are redacted inline (value scrubbed to [REDACTED])" — but the implementation only scrubs strings matching the O.13 patterns, so a Gemini-style key (`AIzaSy...`) or any non-`sk-`/`key-`-prefixed key survives redaction verbatim.

**Fix:** Match on *suffix* rather than exact name (`normalizeKey(key).endsWith('token') || ...endsWith('secret') || ...endsWith('password') || ...endsWith('authorization')`), or add the composite variants to the set; extend `TraceRedactor`/assertNoSecrets with a broader key-shape pattern (e.g. `AIza[0-9A-Za-z_-]{20,}`) if API-key coverage is intended.

### WR-05: `debugLog` renders `options.extra` unredacted to the console

**File:** `src/core/error/debugLog.ts:34`

**Issue:** The message/context/module/error fields are redacted, but `options.extra ?? {}` is passed to `console.error` raw. R-10/O.13 requires redaction before *every* sink including console ("Redaction runs before every sink (persist, UI, console, export)"). Any secret placed in `extra` by a future caller lands in the devtools console verbatim. Today's callers pass benign values (`keyId`, `dbName`, `group`), but the contract is unenforced and latent.

**Fix:** Route `extra` through `redactSensitive` before the console call (values only — keys can be kept), or document and enforce that `extra` must be pre-redacted.

### WR-06: `settingReadSync` never consults the local shadow when the sync *read* throws

**File:** `src/core/storage/Setting.ts:313-341`

**Issue:** The D-15 contract is "Reads check sync-first, then local; a shadow wins reads." But if `chrome.storage.sync.get(key)` rejects (the entire try block throws), the catch returns `fallback` without ever checking `chrome.storage.local` — the durable shadow value becomes invisible to the UI even though it exists. Sync *write* failures are handled; sync *read* failures are not.

**Fix:** Move the local-shadow lookup into a `finally`-style fallback: on sync-read rejection, proceed to the local shadow read (wrapped in its own catch) before returning `fallback`.

### WR-07: IndexedDBMigrator runs only the migration matching the exact fromVersion — chained and fresh-install upgrades silently skip steps

**File:** `src/core/storage/IndexedDBMigrator.ts:155-175`

**Issue:** `runMigrations` dispatches only migrations where `fromVersion === oldVersion && toVersion === newVersion`. (a) A chained migration (1→2 then 2→3) opening at `dbVersion: 3` runs only the 1→2 step — the 2→3 step is skipped yet the DB is left at version 3 without its stores/indexes. (b) A fresh install (oldVersion 0 → N) runs no migration at all — the upgrade creates a version-N DB with **zero object stores**. The entrypoints currently dodge (b) only by warm-opening each store via its own `openDB` first (`main.tsx:121-132`) — an order-dependent, easily-broken coupling the framework should own (e.g., dispatch the chain 0→1→…→N and treat the 0→N step as "create initial schema").

**Fix:** In `onupgradeneeded`, iterate the migration chain from `oldVersion` to `newVersion` (run every migration whose `fromVersion` is in `[oldVersion, newVersion)`), and make the fresh-install case explicit (a migration `fromVersion: 0` creating the initial stores, or document that warm-open is mandatory).

### WR-08: `mergeGroup` performs no record-level shape validation — malformed records with valid ids are persisted

**File:** `src/core/storage/ImportExport.ts:375-411, 414-448, 450-498`

**Issue:** Only the top-level group shape is coerced (`data.sessions ?? []`); individual records are trusted. A hostile or corrupted export containing `{ id: 's-9' }` (no title/created), `{ id: 123 }`, or records with attacker-controlled content is written to the DB as-is. The header claims "a malformed incoming record throws (the hostile-payload path surfaces to the journaled restore as a failed step)" — false; only non-iterable top shapes throw. Later consumers (`getMessagesForSession` sorting, chat rendering, MiniSearch indexing) can crash or misbehave on such records.

**Fix:** Validate each incoming record against its store's shape (id/required-field types) before `put`, skipping-and-logging (or failing the step) on mismatch — mirroring the `sanitizeStored` inbound-gate pattern used elsewhere.

### WR-09: `collectGroup` can silently ship an incomplete export

**File:** `src/core/storage/ImportExport.ts:153-214`

**Issue:** The header states "an incomplete export must surface, never ship silently", but `listSessions`/`listNotes`/`listFacts` swallow read failures and resolve `[]` — so a failed read serializes as an empty group with no error. Only `openDB` failures reach the collectGroup catch. A user's backup can silently lack all sessions/notes/facts.

**Fix:** Have `collectGroup` read directly (e.g., `db.getAll`) within its own try/catch instead of relying on the swallowing list helpers, or detect the swallowed failures and rethrow.

### WR-10: `np_providers` storage contract is inconsistent across registry, Setting gate, and KeyVault

**File:** `src/core/storage/Setting.ts:60-80, 93-97`; `tests/core/security/KeyVault.test.ts:49`

**Issue:** §15.1 defines `np_providers` as `ProviderConfig[]` (array, encrypted apiKey *fields*); the Setting registry marks it `{ encrypted: true }`, and the gate `isVaultEnvelopeShape` accepts only a single top-level `{salt, iv, ciphertext}` object — so `settingWrite('np_providers', configArray)` is refused and only a single envelope passes. KeyVault/its tests instead use **per-provider keys** (`np_providers.provider-anthropic`), which are not in the registry at all and would be refused by `settingWrite` as unknown keys. The Phase 3 provider layer will hit this tri-state mismatch whichever way it writes.

**Fix:** Pick one model now: either registry entries per provider key (`np_providers.<id>` with `encrypted: true`) with a matching gate, or `np_providers` as an envelope-shaped map with the gate checking byte-array-like fields (as `redactSensitive.isVaultEnvelope` does) — and align the §15.1 data-model note.

## Info

### IN-01: Storage bootstrap duplicated verbatim across both entrypoints

**File:** `src/entrypoints/sidepanel/main.tsx:74-153`, `src/entrypoints/standalone/main.tsx:69-148`

`runStorageBootstrap` + `warmOpenIdbStore` are byte-for-byte duplicated. Extract to `src/core/storage/bootstrap.ts` (R-3-safe: only ever called from the two panel surfaces). Minor: standalone's `createStandaloneApp()` is exported but unused (`main.tsx:249` renders `<StandaloneRoot/>` directly), unlike sidepanel's `createSidePanelApp()`.

### IN-02: ErrorStore FIFO ordering breaks after 10 000 same-ms writes in one session

**File:** `src/core/storage/ErrorStore.ts:76`

`<ts>.${String(sequence++).padStart(4, '0')}` — the 10 000th write yields `<ts>.10000`, which sorts lexicographically *before* `<ts>.9999`, so `trimToMax` can delete newer entries. Use `Date.now()`-millisecond suffixed by an always-growing sequence (e.g. base-36), or reset ts on rollover.

### IN-03: `restoreFullVault` entry id can collide

**File:** `src/core/storage/ImportExport.ts:590`

`id: 'restore-' + Date.now()` — two restores in the same millisecond overwrite each other's journal entry. Use a UUID (as `journaledUpdateWorkspace` does).

### IN-04: TraceRedactor `/key-[A-Za-z0-9_-]+/g` over-redacts words containing "key-"

**File:** `src/core/security/TraceRedactor.ts:11`

`"monkey-bars"` → `"mon[REDACTED]"` (the `key-` substring matches inside `monkey-`). Harmless for logs but noisy; consider a word-boundary/prefix guard (e.g. `(?:\b|_|-|/)key-`).

### IN-05: `collectGroup('settings')` reads the sync area without the D-15 shadow fallback

**File:** `src/core/storage/ImportExport.ts:192-198`

A local shadow value (sync write failed → shadow in local) is missed in exports because only `chrome.storage.sync.get(syncKeys)` is consulted. Use `settingReadSync` semantics for the cosmetic keys.

### IN-06: `np_providers` migrate-on-read sanitizer is a passthrough

**File:** `src/core/storage/Setting.ts:364`

`(v) => (isVaultEnvelopeShape(v) ? v : v)` always returns `v` unchanged — a legacy plaintext providers value (hypothetical old shape) is neither normalized nor refused. Intentional per A-12 ("never destructive"), but the D-10 "normalize old shapes to current" claim is unmet for this key; add a defensive log or a Phase-3 TODO with an explicit shape upgrade.

### IN-07: `mergeSettings` bypasses Setting's serialization mutex and D-15 shadow machinery

**File:** `src/core/storage/ImportExport.ts:551-558`

Direct `area.set` per key — concurrent with in-flight `settingWrite` calls and without the sync-quota → local-shadow fallback (a quota-exceeded sync key is silently dropped on import). Route through `settingWriteSync`/`settingWrite` where possible.

## Resolved

All 2 CRITICAL + 10 WARNING findings fixed, plus the trivially-cheap INFOS (IN-03, IN-04). `pnpm run verify:phase-2` exits 0 (280 tests green, eslint, prettier, tsc --noEmit, wxt build, isolation). Fixes verified in a dedicated worktree on branch `gsd-reviewfix/02-663283` (fast-forwarded into `otter`).

| Finding | Title | Fix commit |
|---|---|---|
| CR-01 | Journal replay fabricates workspace content | `4ad6e41` — persist `pickActive(ws)` payload in the entry; replay applies the entry's snapshot (shape-checked via sanitizeStored); fixture crash entry carries a DIFFERENT conversationId/activeSurface and the replay test asserts that content is restored |
| CR-02 | Vault envelope not storage-serializable + derive outside typed-error path | `3ab5dfa`, `53ad398` — base64 `serializeEnvelope`/`deserializeEnvelope` wire form; `decryptSecret` wraps the ENTIRE derive+decrypt in the typed `VAULT_DECRYPT_FAILED` + `PROVIDER_KEY_UNREADABLE` path; chrome.storage round-trip test |
| WR-01 | No way back to OK state (D-04 recovery dead) | `d62129b` — public `markProviderKeyOk(reason?)` resets state and notifies |
| WR-02 | Full-vault restore not replayable (payload never retained) | `9259cf4` — restore entry persists `payload: { groups }`; production `replayRestoreEntry` handler wired into `recoverWorkspaceJournal`; tests use the production handler (IN-03: UUID entry id, same commit) |
| WR-03 | persistJournalEntry swallows persist failures | `3489c18` — rethrow after logging; `runJournaled` aborts; rolled-back persist failure logged, never masks |
| WR-04 | redactSensitive exact-name-only drops + non-`sk-` apiKeys pass | `1f1b24b` — suffix matching (`token`/`secret`/`password`/`authorization` + secret-key compound) + `AIza…` / `api_key=` patterns |
| WR-05 | debugLog renders options.extra unredacted | `2658039` — `extra` routed through `redactSensitive` before the console call (values only) |
| WR-06 | settingReadSync never consults local shadow on sync-read throw | `1e48355` — sync-read rejection falls through to the local shadow read (own catch) |
| WR-07 | IndexedDBMigrator exact-transition-only dispatch | `44740dc` — full chain `[oldVersion, newVersion)` sorted by fromVersion incl. fresh install (0→N); latent `undefined.catch` guard fixed |
| WR-08 | mergeGroup no record-level shape validation | `a73c130` — per-record type guards (skip-and-log, mirroring sanitizeStored inbound gate) |
| WR-09 | collectGroup can silently ship incomplete export | `6506e7a`, `7dcd276` — direct `db.getAll` reads inside collectGroup's own try/catch; store list helpers no longer swallow |
| WR-10 | np_providers storage contract tri-state mismatch | `b4332cb` — ONE model: `np_providers.<id>` per-provider envelope keys (`resolveKeyPermission`, encrypted gate); spec §15.1 data-model note aligned |
| IN-03 | restoreFullVault entry id collision | `9259cf4` (folded into WR-02) — `crypto.randomUUID()` |
| IN-04 | TraceRedactor `key-` over-redaction | `f1e038f` — `(?:\b|_|-|/)key-…` prefix guard |

---

_Reviewed: 2026-08-09T08:30:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
_Fixed: 2026-08-09 — all findings resolved; status: clean_
