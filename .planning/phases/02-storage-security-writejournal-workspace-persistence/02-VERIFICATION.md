---
phase: 02-storage-security-writejournal-workspace-persistence
verified: 2026-08-09T09:00:00Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0 # Every behavior-dependent DONE-when criterion is exercised by a passing behavioral test (see Behavioral Spot-Checks)
overrides_applied: 0
gaps: []
deferred: []
---

# Phase 2: Storage, Security, WriteJournal, Workspace Persistence — Verification Report

**Phase Goal:** Durable, crash-safe, encrypted persistence — secrets never leak to chrome.storage, writes survive crashes via WriteJournal, and workspace state persists across reloads and surfaces.
**Verified:** 2026-08-09T09:00:00Z
**Status:** passed
**Re-verification:** No — initial verification (no prior 02-VERIFICATION.md existed)

## Goal Achievement

### Observable Truths (merged roadmap success criteria + plan must-haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | API key encryption round-trip passes (AES-GCM-256, §15.2 derivation) | ✓ VERIFIED | `tests/core/storage/EncryptedStorage.test.ts` — 3 tests: §15.2 key derivation round-trip, wrong-key rejected with typed `VAULT_DECRYPT_FAILED` (fail closed), tampered ciphertext → same typed code; `tests/core/security/KeyVault.test.ts` (9 tests: installSecret read-then-write-if-absent, three-roads convergence, no-wipe, no-auto-regenerate) — all pass in `verify:phase-2` run (280/280) |
| 2 | No message body and no plaintext secret ever appear in chrome.storage.local | ✓ VERIFIED | `tests/core/storage/no-secrets-in-storage.test.ts` — 4 privacy-gate cases writing through the REAL vault/store/journal paths then dumping storage areas: case 1 plaintext apiKey absent from local; case 2 installSecret/secret never reach sync; case 3 chat+memory bodies in IndexedDB only, no np_* key holds a body; case 4 journal step errors scrubbed to `[REDACTED]` before put — all pass |
| 3 | Workspace state persists across page reload and cross-surface handoff | ✓ VERIFIED | `tests/core/workspace/WorkspacePersistence.test.ts` — 'hydrates np_workspace seeded through the store's own journaled path (reload)' + 'persists across cross-surface handoff — start(sidepanel) then start(standalone) hydrate on fresh init' — pass |
| 4 | Mid-write crash recovers cleanly via WriteJournal replay (recovery test passes) | ✓ VERIFIED | `tests/core/workspace/WorkspacePersistence.test.ts` 'recovers a crash-mid-write: replay restores the ENTRY payload (CR-01) and skips foreign/unknown-op entries'; `tests/core/storage/WriteJournal.test.ts` (11 tests: pending→applying→completed transitions, reverse-rollback, rollback-failure non-masking, replay-once, unknown-op skip, workspace scope, WR-03 persist-abort, D-16 redaction) — pass |
| 5 | Migration from v1 → v2 fixture passes without data loss (idempotent) | ✓ VERIFIED | `tests/core/storage/IndexedDBMigrator.test.ts` — 'migrates v1 → v2: adds a store, adds an index, and carries the fixture rows', 'is idempotent', chained 1→2→3 (WR-07), fresh-install 0→N, throws→degraded (D-12), ErrorStore sink — pass |
| 6 | Import/export sanitized JSON/ZIP and backup/restore function (journaled restore) | ✓ VERIFIED | `tests/core/storage/ImportExport.test.ts` (11 tests): JSON round-trip, ZIP via fflate round-trip, no-secrets export (D-01), merge semantics + overwrite toggle (D-18), record-level validation (WR-08), journaled restore happy + failed-group-step + production-handler replay (WR-02) — pass |
| 7 | `verify:phase-2` exits 0 (eslint + prettier + tsc --noEmit + wxt build + vitest run + isolation check) | ✓ VERIFIED | Ran `pnpm run verify:phase-2` in this verification: exit 0 — prettier clean, tsc clean, wxt build succeeded, **42 test files / 280 tests passed**, `check-content-bundle: 1 content bundle(s) clean` |
| 8 | Code review clean — CR-01 journal payload replay + CR-02 base64 envelope wire form resolved (2 critical + 10 warning + 2 info) | ✓ VERIFIED | `02-REVIEW.md` status: clean; all 14 findings fixed with commits (`4ad6e41` CR-01, `3ab5dfa`/`53ad398` CR-02, WR-01..WR-10, IN-03, IN-04); fixes present in code: `WriteJournalEntry.payload` retained in entries (src/types/storage.ts), `serializeEnvelope`/`deserializeEnvelope` base64 wire form (EncryptedStorage.ts), `markProviderKeyOk` (KeyVault.ts), `replayRestoreEntry` (ImportExport.ts + WorkspaceStore recovery dispatch) |
| 9 | Storage-layer bootstrap wired at both entrypoints (KeyVault first-run → migrate-on-read → IDB migrator + warm-open, non-blocking) | ✓ VERIFIED | `src/entrypoints/sidepanel/main.tsx` + `src/entrypoints/standalone/main.tsx` — `runStorageBootstrap()`: `getKeyVault().getInstallSecret()` (D-02), `Setting.runMigrateOnRead(DEFAULT_MIGRATE_SANITIZERS)` (D-10), ErrorStore open + `Migrator.runMigrations` over ChatHistoryDB/NotesDB/MemoryDB/WriteJournalDB specs with warm-open; every step wrapped with canonical-code debugLog (Golden Rule 9) |
| 10 | R-3 isolation: vault/IndexedDB/fflate stay out of content bundles | ✓ VERIFIED | `tests/isolation/check-content-bundle.mjs` FORBIDDEN_TOKENS extended with `idb`/`fflate`/`KeyVault`/`EncryptedStorage`/`fake-indexeddb` (lines 40–44); isolation check ran clean in `verify:phase-2` |

**Score:** 10/10 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/types/storage.ts` | WriteJournalEntry + locked 11-op WriteJournalOperation union, importable via `@/types/storage` | ✓ VERIFIED | 11-op union verbatim §20.3; entry carries `payload` (CR-01); header cites O.11 source lines |
| `src/core/error/errorCodes.ts` | Six Phase-2 canonical codes | ✓ VERIFIED | `VAULT_DECRYPT_FAILED`, `PROVIDER_KEY_UNREADABLE`, `IDB_MIGRATION_FAILED`, `SYNC_QUOTA_EXCEEDED`, `WRITE_JOURNAL_FAILED`, `WRITE_JOURNAL_ROLLBACK_FAILED` (lines 57–62); codes also in spec C.2 (02-01 key-link) |
| `src/core/security/TraceRedactor.ts` | Real body — six O.13 patterns → `[REDACTED]` | ✓ VERIFIED | REDACTION_PATTERNS + WR-04 AIza/api_key shapes + IN-04 word-boundary guard; signature `redact(s: string): string` stable |
| `src/core/security/redactSensitive.ts` | Field-level redaction, password-DROP, vault-envelope passthrough | ✓ VERIFIED | Recursive scrub + SENSITIVE_FIELD_KEYS drop + `isVaultEnvelope` guard; wired at every write boundary (journal, ErrorStore, export) |
| `src/core/storage/EncryptedStorage.ts` | AES-GCM-256 primitive + VaultEnvelope + CR-02 base64 wire form | ✓ VERIFIED | PBKDF2_ITERATIONS=100_000, deriveKey/encrypt/decrypt, typed `VAULT_DECRYPT_FAILED` + `isVaultDecryptFailed` + `createVaultDecryptFailedError`, serialize/deserializeEnvelope |
| `src/core/security/KeyVault.ts` | installSecret lifecycle + PROVIDER_KEY_UNREADABLE state machine | ✓ VERIFIED | Read-then-write-if-absent, non-generating read, three-roads convergence, `markProviderKeyOk` (WR-01), user-initiated wipe only |
| `src/core/storage/WriteJournal.ts` | runJournaled/recoverJournal (O.11) + WriteJournalDB + D-16 persist | ✓ VERIFIED | Persist-at-every-boundary, reverse-rollback with per-step wrap, redactSensitive-before-put, WR-03 rethrow-on-persist-failure |
| `src/core/workspace/WorkspaceStore.ts` | D-06 rewire: np_workspace writes ONLY via journal; recoverWorkspaceJournal (D-07) | ✓ VERIFIED | journaledUpdateWorkspace (update-workspace op, §20.3 order, CR-01 payload), workspace-scope gate + unknown-op skip, replay after listener wired in init() |
| `src/core/storage/Setting.ts` | Per-key permission table, serialized writes, migrate-on-read, D-15 sync-shadow, D-11 declared-only | ✓ VERIFIED | 16-key STORAGE_KEY_REGISTRY, promise-chain mutex, np_schema_version + DEFAULT_MIGRATE_SANITIZERS, settingWriteSync/settingReadSync shadow machinery, 100ms cosmetic debounce, encrypted-only np_providers gate |
| `src/core/storage/IndexedDBMigrator.ts` | Raw-open migrator (RESEARCH Pattern 2), §20.4 interface, D-12 degraded mode, D-14 registry | ✓ VERIFIED | Raw indexedDB.open + sync dispatch + wrap(), DegradedDBError + assertWritable gate, getDegradedDbs, full-chain dispatch (WR-07) |
| `src/core/storage/ErrorStore.ts` | §15.1 FIFO-max-100 IDB store, redaction-before-write, IDB_MIGRATION_FAILED sink | ✓ VERIFIED | Lexicographic FIFO ids, trimToMax, recordMigrationFailure |
| `src/core/storage/ChatHistoryDB.ts` / `NotesDB.ts` / `MemoryDB.ts` | §21-verbatim typed stores, message bodies in IndexedDB ONLY | ✓ VERIFIED | Strict DBSchema typing, composite keyPath [conversationId, seq] (MemoryDB), getNoteByTitle (NotesDB), orphan-cleanup deleteSession |
| `src/core/storage/ImportExport.ts` | JSON canonical + ZIP via fflate, EXCLUDED_KEYS, manifest, MERGE/upsert, journaled restore | ✓ VERIFIED | EXPORT_GROUPS, sanitizeGroup + assertNoSecrets, restoreFullVault under 'restore-notes-batch', replayRestoreEntry (WR-02), settings merge gate against permission table |
| `src/core/utils/RateLimiter.ts` / `src/core/http/Requester.ts` | Dependency-free primitives (token bucket / PROXY_FETCH wrapper) | ✓ VERIFIED | Per-addonId buckets, 25s timeout, retrySafe-bounded retry, never throws, canonical-code debugLog |
| `tests/isolation/check-content-bundle.mjs` | Extended FORBIDDEN_TOKENS (R-3) | ✓ VERIFIED | Tokens present; ran clean |
| `src/entrypoints/sidepanel/main.tsx` + `standalone/main.tsx` | Storage bootstrap at mount | ✓ VERIFIED | runStorageBootstrap wired in both (see Truth 9) |
| `tests/core/storage/no-secrets-in-storage.test.ts` | Automated privacy gate | ✓ VERIFIED | 4 cases, real write paths, storage dump assertions |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | -- | ------ | ------- |
| WorkspaceStore.update()/start() | runJournaled (WriteJournal.ts) | `journaledUpdateWorkspace` — the ONLY np_workspace write path (D-06) | ✓ WIRED | update()/start() → journaledUpdateWorkspace → runJournaled → persistJournalEntry |
| journal persist | WriteJournalDB (idb entries store) | `persistJournalEntry` → `openWriteJournalDB().put` | ✓ WIRED | §15.1 keyPath 'id'; redactSensitive BEFORE put (D-16) |
| journal persist | redactSensitive (02-02) | Write-boundary hook | ✓ WIRED | `redactSensitive(e) as WriteJournalEntry` before db.put (WriteJournal.ts:140) |
| replay | M.3 workspaceId scope gate + version-LWW | recoverWorkspaceJournal | ✓ WIRED | scope gate + unknown-op skip + idempotent versioned upsert; same gate as onChanged handler |
| WorkspaceStore recovery | ImportExport.replayRestoreEntry | restore-notes-batch dispatch (WR-02) | ✓ WIRED | recoverWorkspaceJournal routes restore-notes-batch entries to the production handler |
| KeyVault ↔ EncryptedStorage | derived key handoff | getDerivedKey → deriveKey(secret, chrome.runtime.id, salt) | ✓ WIRED | KeyVault owns salt generation + state machine |
| EncryptedStorage envelope ↔ redactSensitive | never re-redact ciphertext | isVaultEnvelope guard | ✓ WIRED | structural passthrough tested (redactSensitive.test.ts) |
| IndexedDBMigrator ↔ ErrorStore | IDB_MIGRATION_FAILED sink + degraded | recordMigrationFailure + handleMigrationFailed | ✓ WIRED | default failure handler records + degrades |
| ImportExport ↔ four IDB stores + Setting | group data sources | collectGroup per group | ✓ WIRED | direct db.getAll reads (WR-09 — failures surface); settings routing derived from STORAGE_KEY_REGISTRY |
| ThemeStore | Setting.ts sync-first | settingReadSync/settingWriteSync | ✓ WIRED | np_theme/np_theme_pack through sync-shadow path (D-15 live consumer) |
| Entrypoints | KeyVault + Setting + Migrator | runStorageBootstrap at both mounts | ✓ WIRED | sidepanel + standalone |
| Requester | PROXY_FETCH (background SW) | chrome.runtime.sendMessage with ProxyFetchRequest/Response shapes | ✓ WIRED | src/types/messages.ts canonical shapes; 25s timeout |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| WorkspaceStore (np_workspace) | pickActive(ws) snapshot | journaledUpdateWorkspace → chrome.storage.local.set; hydrated via sanitizeStored in init() | ✓ — real store path; privacy test dumps storage and confirms the value flows | ✓ FLOWING |
| ImportExport collectGroup | sessions/messages/notes/concepts/facts | direct db.getAll over real idb stores (WR-09) | ✓ — reads real stores, not fixtures; incomplete export surfaces | ✓ FLOWING |
| KeyVault encryptSecret | VaultEnvelope | crypto.subtle AES-GCM from installSecret + runtime.id | ✓ — real WebCrypto; no-secrets test decrypts round-trip through storage | ✓ FLOWING |
| WriteJournal replay | entry.payload | CR-01 snapshot persisted in entry; replay applies it | ✓ — crash-mid-write test proves payload restored, not fabricated | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full release gate | `pnpm run verify:phase-2` | exit 0 — eslint ✓ prettier ✓ tsc ✓ wxt build ✓ **280/280 tests (42 files)** ✓ isolation ✓ | ✓ PASS |
| Crash-mid-write recovery (state transition: applying → replayed → completed) | `vitest` run of WorkspacePersistence 'recovers a crash-mid-write…' (part of full run) | pass — replay restores ENTRY payload, skips foreign/unknown-op | ✓ PASS |
| Journal state machine (pending → applying → completed / rolled-back) | WriteJournal.test.ts runJournaled/recoverJournal suites (part of full run) | 11 tests pass — transitions, rollback, replay-once, WR-03 abort | ✓ PASS |
| AES-GCM round-trip + fail-closed decrypt | EncryptedStorage.test.ts (part of full run) | 5 tests pass — round-trip, wrong-key, tamper, CR-02 wire form | ✓ PASS |
| v1→v2 migration data-carry + idempotency | IndexedDBMigrator.test.ts (part of full run) | 8 tests pass — data carried, idempotent, chained, degraded | ✓ PASS |
| Privacy gate (no secret/body in chrome.storage.local) | no-secrets-in-storage.test.ts (part of full run) | 4 tests pass — real vault/store/journal paths, storage dumps clean | ✓ PASS |
| Import/export round-trips + journaled restore | ImportExport.test.ts (part of full run) | 11 tests pass — JSON/ZIP round-trip, no-secrets, merge, crash + replay | ✓ PASS |

### Probe Execution

No probe scripts are declared by the phase plans (`grep -R probe- … 02-0*-PLAN.md` → none). The §18 release gate is `verify:phase-2`, executed in full above. N/A.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| STORAGE-01 | 02-01, 02-02, 02-06, 02-07, 02-11 | IndexedDB stores (ChatHistoryDB, NotesDB, MemoryDB, ErrorStore) work via idb with strict typing | ✓ SATISFIED | 4 typed stores with DBSchema, DB_VERSION, typed CRUD, §21-verbatim models; 3+4+3 store tests + ErrorStore/IndexedDBMigrator tests pass |
| STORAGE-02 | 02-01, 02-05, 02-08, 02-11 | StorageLayer, StorageSession, and per-key permissions implemented | ✓ SATISFIED (ratified interpretation, CONTEXT D-09) | §18 create-list is authoritative: no StorageLayer.ts/StorageSession.ts (verified absent); layer concepts folded into Setting.ts — per-key permission table (16 keys), serialized writes, migrate-on-read, D-15 sync-shadow; 15 Setting tests pass |
| STORAGE-03 | 02-01, 02-02, 02-03, 02-11 | Encrypted vault (AES-GCM crypto.subtle) protects secrets/sensitive values | ✓ SATISFIED | EncryptedStorage + KeyVault + redaction; 5+9+10 security tests pass |
| STORAGE-04 | 02-01, 02-04, 02-11 | WriteJournal + WriteTransaction enable crash-safe, conflict-safe writes | ✓ SATISFIED (ratified interpretation, CONTEXT D-05) | D-05 ratifies journal-framework scope: runJournaled/recoverJournal deliver the transactional semantics (steps + rollback + replay); update-workspace sole wired consumer; 11 journal + 4 persistence tests pass |
| STORAGE-05 | 02-01, 02-09, 02-11 | Import/export (sanitized JSON/ZIP) and backup/restore function | ✓ SATISFIED (core; UI deferred per D-19) | ImportExport core: JSON + ZIP, EXCLUDED_KEYS, manifest, MERGE/upsert, journaled restore; 11 tests pass; Options UI is a Phase 7 deliverable (D-19 ratified) |

**Orphaned requirements:** none — all five STORAGE-N IDs are claimed by plans 02-01..02-11 and satisfied. Plan 02-10 claims `[§18]` (RateLimiter/Requester infrastructure, intentionally not a STORAGE-N requirement) — consistent with the create-list.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/core/storage/IndexedDBMigrator.ts` | 194, 216 | `// TEMP DEBUG` leftover comments from the WR-07 fix cycle | ℹ️ Info | Comment-only debris; the code beneath is complete and behaviorally tested (chained + fresh-install migration tests pass). Cleanup recommended, not a blocker. |

No `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` markers in any phase-2 source file. All `return []`/`return null` instances are documented error-path fallbacks (debugLog + never-throw contract, Golden Rule 9) — verified not stubs.

### Human Verification Required

None for the phase contract. All five §18 DONE-when behaviors are exercised by passing behavioral tests; the phase ships core-only with no UI (D-19), so visual/UX items do not apply.

**Real-browser release checks (recommended at ship time, not blockers on this core verification):** the test suite simulates chrome.storage and IndexedDB with deterministic harnesses (fake-indexeddb, fakeBrowser). At the Phase 7 UI release, a human should smoke-test in a real Chrome: (1) kill the extension process mid-workspace-write and confirm recovery on reopen; (2) exceed chrome.storage.sync quota and confirm the local shadow + reconciliation behave; (3) confirm the degraded-mode banner renders when a migration is forced to fail.

### Gaps Summary

No gaps. All 10 must-have truths verified, all 5 requirement IDs satisfied, review clean, release gate green.

---

_Verified: 2026-08-09T09:00:00Z_
_Verifier: the agent (gsd-verifier)_
