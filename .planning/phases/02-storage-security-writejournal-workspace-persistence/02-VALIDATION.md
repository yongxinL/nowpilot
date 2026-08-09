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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | STORAGE-03 | T-2-01 / — | installSecret generated once, immutable, never in sync/exports | unit | `vitest run tests/core/storage/EncryptedStorage.test.ts` | ⬜ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | STORAGE-03 | T-2-01 | AES-GCM encrypt→decrypt round-trip; cross-install → PROVIDER_KEY_UNREADABLE (no wipe) | unit | `vitest run tests/core/storage/EncryptedStorage.test.ts` | ⬜ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | STORAGE-03 | T-2-01 | redaction before ErrorStore/journal persist; password DROPPED | unit | `vitest run tests/core/storage/EncryptedStorage.test.ts` | ⬜ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | STORAGE-04 | T-2-02 | runJournaled/recoverJournal; replay-once idempotent; workspace-scoped; unknown-op skip-and-log | unit | `vitest run tests/core/storage/WriteJournal.test.ts` | ⬜ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | STORAGE-04 | T-2-02 | WorkspaceStore.update routed through journal (update-workspace op) | unit+integration | `vitest run tests/core/workspace/WorkspacePersistence.test.ts` | ⬜ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | STORAGE-01 | T-2-03 | IDB stores (ChatHistoryDB, NotesDB, MemoryDB, ErrorStore) via idb, strict typing | unit | `vitest run tests/core/storage/WriteJournal.test.ts` | ⬜ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | STORAGE-02 | T-2-03 | Setting.ts per-key permissions + serialized writes; migrate-on-read np_schema_version | unit | `vitest run tests/core/storage/EncryptedStorage.test.ts` | ⬜ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | STORAGE-01 | T-2-04 | synthetic v1→v2 migration: add-store + add-index + data-carry + idempotency | unit | `vitest run tests/core/storage/IndexedDBMigrator.test.ts` | ⬜ W0 | ⬜ pending |
| 02-04-02 | 04 | 2 | STORAGE-01 | T-2-04 | migration throws → IDB_MIGRATION_FAILED → degraded (read-only) mode | unit | `vitest run tests/core/storage/IndexedDBMigrator.test.ts` | ⬜ W0 | ⬜ pending |
| 02-05-01 | 05 | 2 | STORAGE-05 | T-2-05 | import/export core: JSON+ZIP (fflate), scoped groups, manifest, sanitized | unit | `vitest run tests/core/storage/WriteJournal.test.ts` | ⬜ W0 | ⬜ pending |
| 02-05-02 | 05 | 2 | STORAGE-05 | T-2-05 | restore = merge/upsert journaled; sync-quota fallback shadow promote/clear | unit | `vitest run tests/core/utils/RateLimiter.test.ts` | ⬜ W0 | ⬜ pending |
| 02-06-01 | 06 | 3 | STORAGE-02 | T-2-06 | RateLimiter per-instance per-addon; Requester functional primitive | unit | `vitest run tests/core/utils/RateLimiter.test.ts` | ⬜ W0 | ⬜ pending |
| 02-07-01 | 07 | 3 | — | — | verify:phase-2 gate green (eslint+prettier+tsc+wxt build+vitest+isolation) | gate | `pnpm run verify:phase-2` | ⬜ W0 | ⬜ pending |

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
