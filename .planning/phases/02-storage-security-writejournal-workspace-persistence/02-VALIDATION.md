---
phase: 2
slug: storage-security-writejournal-workspace-persistence
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-09
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.10 + @testing-library/react + jsdom-align custom env + threads pool |
| **Config file** | vitest.config.ts (Phase 1 established) |
| **Quick run command** | `pnpm run typecheck && vitest run tests/core/storage tests/core/workspace tests/core/utils` |
| **Full suite command** | `pnpm run verify:phase-2` (eslint + prettier + tsc --noEmit + wxt build + vitest run + isolation check) |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm run typecheck && vitest run tests/core/storage tests/core/workspace tests/core/utils`
- **After every plan wave:** Run `pnpm run verify:phase-2`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

> Regenerated 2026-08-09 (revision pass) to match the ACTUAL 11-plan structure (02-01..02-11) and each plan's real task IDs + `<automated>` commands.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | STORAGE-02..05 (foundation) | T-2-01-01/04 | storage deps installed; fake-indexeddb harness registered; verify:phase-2 gate chain scripted | infra | `pnpm ls idb fflate fake-indexeddb && grep -c "fake-indexeddb/auto" tests/setup.ts && grep -c '"verify:phase-2"' package.json && pnpm vitest run tests/core/theme tests/core/workspace --reporter=dot` | ⬜ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | STORAGE-03/04 | T-2-01-02 | WriteJournal types/11-op union canonical in `@/types/storage` + spec C.2; six Phase-2 codes in errorCodes.ts AND spec C.2 | type/infra | `pnpm typecheck && grep -c "WRITE_JOURNAL_ROLLBACK_FAILED" src/core/error/errorCodes.ts && grep -c "restore-notes-batch" src/types/storage.ts && grep -c "degradedBanner" src/core/i18n/strings.ts` | ⬜ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | STORAGE-02..05 (D-20/21) | T-2-01-03 | six deterministic typed fixture builders; never imported by src/ | unit | `pnpm typecheck && pnpm vitest run tests/fixtures/fixtures.test.ts --reporter=dot` | ⬜ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | STORAGE-01/03 | T-2-02-01 | TraceRedactor O.13 patterns → [REDACTED]; signature stable (zero caller churn) | unit | `pnpm typecheck && grep -c "REDACTION_PATTERNS" src/core/security/TraceRedactor.ts` | ⬜ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | STORAGE-01/03 | T-2-02-02/03 | redactSensitive field-level redaction; password DROP; vault envelope passthrough | unit | `pnpm typecheck && grep -c "redactSensitive" src/core/security/redactSensitive.ts` | ⬜ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | STORAGE-01/03 | T-2-02-01/02 | patterns scrub + DROP + envelope passthrough proven via redaction fixture | unit | `pnpm vitest run tests/core/security/redactSensitive.test.ts --reporter=dot` | ⬜ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | STORAGE-03 | T-2-03-01 | AES-GCM-256 per §15.2; PBKDF2-100k pinned; typed VAULT_DECRYPT_FAILED | unit | `pnpm typecheck && grep -c "VAULT_DECRYPT_FAILED" src/core/storage/EncryptedStorage.ts` | ⬜ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | STORAGE-03 | T-2-03-02/03 | installSecret once + immutable; three roads → ONE PROVIDER_KEY_UNREADABLE state; no auto-wipe/regenerate | unit | `pnpm typecheck && grep -c "PROVIDER_KEY_UNREADABLE" src/core/security/KeyVault.ts && grep -c "wipeProviderKey" src/core/security/KeyVault.ts` | ⬜ W0 | ⬜ pending |
| 02-03-03 | 03 | 2 | STORAGE-03 | T-2-03-02/03/04 | vault roundtrip; cross-install no-wipe; three-roads convergence | unit | `pnpm vitest run tests/core/storage/EncryptedStorage.test.ts tests/core/security/KeyVault.test.ts --reporter=dot` | ⬜ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | STORAGE-04 | T-2-04-01/03/04/05 | runJournaled/recoverJournal O.11; entries store; redactSensitive at persist boundary (D-16) | unit | `pnpm typecheck && grep -c "runJournaled" src/core/storage/WriteJournal.ts && grep -c "WriteJournalDB" src/core/storage/WriteJournal.ts && grep -c "redactSensitive" src/core/storage/WriteJournal.ts` | ⬜ W0 | ⬜ pending |
| 02-04-02 | 04 | 2 | STORAGE-04 | T-2-04-01 | WorkspaceStore.update()/start() journaled (update-workspace op, D-06); workspace-scoped replay; unknown-op skip | unit+integration | `pnpm typecheck && grep -c "journaledUpdateWorkspace" src/core/workspace/WorkspaceStore.ts && grep -c "update-workspace" src/core/workspace/WorkspaceStore.ts` | ⬜ W0 | ⬜ pending |
| 02-04-03 | 04 | 2 | STORAGE-04 | T-2-04-01/02 | crash-mid-write recovery; replay-once idempotency; workspace scope; unknown-op skip | unit+integration | `pnpm vitest run tests/core/storage/WriteJournal.test.ts tests/core/workspace/WorkspacePersistence.test.ts --reporter=dot` | ⬜ W0 | ⬜ pending |
| 02-05-01 | 05 | 2 | STORAGE-02 | T-2-05-01/02/03/04 | per-key permission table; serialized writes; np_schema_version migrate-on-read; session keys declared-only | unit | `pnpm typecheck && grep -c "STORAGE_KEY_REGISTRY" src/core/storage/Setting.ts && grep -c "CURRENT_SCHEMA_VERSION" src/core/storage/Setting.ts` | ⬜ W0 | ⬜ pending |
| 02-05-02 | 05 | 2 | STORAGE-02 | T-2-05-01/02/04 | permission enforcement, serialization, ciphertext-only contract, migrate-on-read proven | unit | `pnpm vitest run tests/core/storage/Setting.test.ts --reporter=dot` | ⬜ W0 | ⬜ pending |
| 02-06-01 | 06 | 3 | STORAGE-01 | T-2-06-01/03/04/05 | raw indexedDB.open migrator; §20.4 verbatim; degraded read-only; IDB_MIGRATION_FAILED | unit | `pnpm typecheck && grep -c "indexedDB.open" src/core/storage/IndexedDBMigrator.ts && grep -c "IDB_MIGRATION_FAILED" src/core/storage/IndexedDBMigrator.ts` | ⬜ W0 | ⬜ pending |
| 02-06-02 | 06 | 3 | STORAGE-01 | T-2-06-02 | ErrorStore FIFO max 100; redactSensitive before write; IDB_MIGRATION_FAILED sink | unit | `pnpm typecheck && grep -c "recordMigrationFailure" src/core/storage/ErrorStore.ts && grep -c "redactSensitive" src/core/storage/ErrorStore.ts` | ⬜ W0 | ⬜ pending |
| 02-06-03 | 06 | 3 | STORAGE-01 | T-2-06-01/02/03 | synthetic v1→v2 fixture (add-store/index/data-carry/idempotency); throws→degraded; FIFO; redaction; exit-0 | unit | `pnpm vitest run tests/core/storage/IndexedDBMigrator.test.ts tests/core/storage/ErrorStore.test.ts --reporter=dot` | ⬜ W0 | ⬜ pending |
| 02-07-01 | 07 | 3 | STORAGE-01 | T-2-07-01/03 | ChatHistoryDB sessions/messages via idb strict typing; deleteSession removes orphaned bodies; bodies IDB-only | unit | `pnpm typecheck && grep -c "'by-session'" src/core/storage/ChatHistoryDB.ts && pnpm vitest run tests/core/storage/ChatHistoryDB.test.ts --reporter=dot` | ⬜ W0 | ⬜ pending |
| 02-07-02 | 07 | 3 | STORAGE-01 | T-2-07-01 | NotesDB notes/concepts; getNoteByTitle lookup | unit | `pnpm typecheck && grep -c "getNoteByTitle" src/core/storage/NotesDB.ts && pnpm vitest run tests/core/storage/NotesDB.test.ts --reporter=dot` | ⬜ W0 | ⬜ pending |
| 02-07-03 | 07 | 3 | STORAGE-01 | T-2-07-02 | MemoryDB composite keyPath [conversationId, seq]; facts/summaries; index isolation | unit | `pnpm typecheck && grep -c "conversationSummaries" src/core/storage/MemoryDB.ts && pnpm vitest run tests/core/storage/MemoryDB.test.ts --reporter=dot` | ⬜ W0 | ⬜ pending |
| 02-08-01 | 08 | 4 | STORAGE-02 | T-2-08-01/03 | sync-quota/rate → local shadow (SYNC_QUOTA_EXCEEDED); sync-first reads; debounce | unit | `pnpm typecheck && grep -c "SYNC_QUOTA_EXCEEDED" src/core/storage/Setting.ts` | ⬜ W0 | ⬜ pending |
| 02-08-02 | 08 | 4 | STORAGE-02 | T-2-08-01 | ThemeStore rewired through Setting.ts sync-first; no direct chrome.storage.local.set remains | unit | `pnpm typecheck && grep -c "settingReadSync" src/core/theme/ThemeStore.ts` | ⬜ W0 | ⬜ pending |
| 02-08-03 | 08 | 4 | STORAGE-02 | T-2-08-02 | quota-shadow fail→shadow, shadow-wins read, promote-and-delete; APPR-03 spec touch | unit | `pnpm vitest run tests/core/storage/Setting.test.ts --reporter=dot && grep -c "CANONICAL/preferred" .planning/PRODUCT_SPEC_v0_1.md` | ⬜ W0 | ⬜ pending |
| 02-09-01 | 09 | 4 | STORAGE-05 | T-2-09-01/02/03 | sanitized scoped groups + manifest; JSON+ZIP (fflate); per-group merge/upsert; journaled full-vault restore; secrets excluded | unit | `pnpm typecheck && grep -c "zipSync" src/core/storage/ImportExport.ts && grep -c "restore-notes-batch" src/core/storage/ImportExport.ts` | ⬜ W0 | ⬜ pending |
| 02-09-02 | 09 | 4 | STORAGE-05 | T-2-09-01/02/03 | JSON+ZIP round-trip; no-secrets export; existing-wins merge; journaled restore crash/replay | unit | `pnpm vitest run tests/core/storage/ImportExport.test.ts --reporter=dot` | ⬜ W0 | ⬜ pending |
| 02-10-01 | 10 | 4 | §18 (create-list infra) | T-2-10-04 | RateLimiter per-addonId token bucket; sync/async acquire; dependency-free | unit | `pnpm typecheck && grep -c "waitForToken" src/core/utils/RateLimiter.ts` | ⬜ W0 | ⬜ pending |
| 02-10-02 | 10 | 4 | §18 (create-list infra) | T-2-10-01/02/03 | Requester PROXY_FETCH wrapper; 25s timeout; opt-in retrySafe; never throws | unit | `pnpm typecheck && grep -c "DEFAULT_TIMEOUT_MS" src/core/http/Requester.ts && grep -c "retrySafe" src/core/http/Requester.ts` | ⬜ W0 | ⬜ pending |
| 02-10-03 | 10 | 4 | §18 (create-list infra) | T-2-10-01/02/04 | token-bucket capacity/isolation/timeout; PROXY_FETCH success/timeout/rejection/validation | unit | `pnpm vitest run tests/core/utils/RateLimiter.test.ts tests/core/http/Requester.test.ts --reporter=dot` | ⬜ W0 | ⬜ pending |
| 02-11-01 | 11 | 5 | STORAGE-01..05 | T-2-11-04 | entrypoint storage bootstrap: KeyVault first-run + migrate-on-read + IDB migrator at mount (both surfaces) | integration | `pnpm typecheck && grep -c "runMigrateOnRead" src/entrypoints/sidepanel/main.tsx && grep -c "runMigrateOnRead" src/entrypoints/standalone/main.tsx && grep -c "runMigrations" src/entrypoints/sidepanel/main.tsx && grep -c "runMigrations" src/entrypoints/standalone/main.tsx` | ⬜ W0 | ⬜ pending |
| 02-11-02 | 11 | 5 | STORAGE-01..05 | T-2-11-01/02/03 | no plaintext secrets / no bodies in chrome.storage; IDB+vault tokens forbidden in content bundles | unit+gate | `pnpm vitest run tests/core/storage/no-secrets-in-storage.test.ts --reporter=dot && node tests/isolation/check-content-bundle.mjs` | ⬜ W0 | ⬜ pending |
| 02-11-03 | 11 | 5 | STORAGE-01..05 | T-2-11-01/05 | full phase gate green (eslint+prettier+tsc+wxt build+vitest+isolation); §18 DONE-when sweep | gate | `pnpm run verify:phase-2` | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/setup.ts` — add `import 'fake-indexeddb/auto'` (idb/vitest harness; verified compatible with jsdom-align env + threads pool)
- [ ] `tests/fixtures/index.ts` — typed deterministic builders: vault-roundtrip, cross-install, journal-recovery, migration, quota-shadow, redaction (D-20/21)
- [ ] `fake-indexeddb` dev dependency install (§7 approved-stack-adjacent, needed for IndexedDB tests)

*Existing vitest/jsdom infrastructure covers all other phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Workspace persists across real page reload + side-panel↔standalone handoff in a built extension | STORAGE-01/04 | Requires a real browser extension session | Build + load unpacked, mutate workspace (theme/addon state), reload side panel, hand off to standalone, confirm state survives |
| sync-quota fallback with real chrome.storage.sync rate limits | STORAGE-02 | Rate limits are environment-dependent | Rapidly toggle theme in a built extension; confirm no visible failure, value persists |
| Degraded-mode banner renders on real IDB migration failure | STORAGE-01 | UI component is Phase 7; banner state + string ship in Phase 2 | Simulate migration failure; confirm banner state + canonical string present (UI rendering verified in Phase 7) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
