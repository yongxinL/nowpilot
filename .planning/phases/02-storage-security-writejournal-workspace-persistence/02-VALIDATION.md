---
phase: 2
slug: storage-security-writejournal-workspace-persistence
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-23
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (jsdom, globals) |
| **Config file** | `vitest.config.ts` (setup `tests/setup.ts`) |
| **Quick run command** | `pnpm lint && pnpm test -- tests/core/storage tests/core/security tests/core/utils tests/core/workspace/WorkspacePersistence.test.ts` |
| **Full suite command** | `pnpm run verify:phase-2` (`tsc --noEmit && vitest run tests/core/storage tests/core/security tests/core/utils tests/core/workspace/WorkspacePersistence.test.ts`) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm lint && pnpm test -- tests/core/storage tests/core/security tests/core/utils tests/core/workspace/WorkspacePersistence.test.ts`
- **After every plan wave:** Run `pnpm run verify:phase-2`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | REQ-R07 | — | EncryptedStorage AES-GCM round-trip: encrypt → chrome.storage.local → decrypt | unit | `vitest run tests/core/storage/EncryptedStorage.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | REQ-R07 | — | KeyVault installSecret (np_install_secret) + PBKDF2 derivation per §15.2; no plaintext in chrome.storage.local | unit | `vitest run tests/core/storage/EncryptedStorage.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | REQ-R07 | — | np_store → np_providers one-time migration (async boot step): encrypted np_providers written first, plaintext stripped second | unit | `vitest run tests/core/storage/EncryptedStorage.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | REQ-R07 | — | No message body or raw secret in chrome.storage.local (inspection gate) | unit | grep / inspection test | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | REQ-R03 | — | WriteJournal runJournaled/recoverJournal per O.11; WriteJournalDB idb store; simulated SW kill mid-write → replay restores state | unit | `vitest run tests/core/storage/WriteJournal.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | REQ-R03 | — | update-workspace journaled path: pending → write np_workspace (debounced) → WORKSPACE_UPDATED → completed | unit | `vitest run tests/core/workspace/WorkspacePersistence.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | REQ-R06 | — | IndexedDBMigrator framework + all 5 DBs bootstrapped at v1; v1→v2 fixture idempotent + backward-compatible | unit | `vitest run tests/core/storage/IndexedDBMigrator.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | REQ-R06 | — | unlimitedStorage in wxt.config permissions (set = sidePanel, storage, tabs, unlimitedStorage) | config grep | `grep 'unlimitedStorage' wxt.config.ts` | ✅ | ⬜ pending |
| 02-04-01 | 04 | 2 | REQ-R07 | — | Storage adapter surfaces STORAGE_QUOTA/STORAGE_RATE_LIMIT (never swallow); ErrorStore (idb FIFO 100) records | unit | `vitest run tests/core/storage/chromeStorageAdapter.test.ts` | ✅ | ⬜ pending |
| 02-04-02 | 04 | 2 | REQ-R07 | — | Error registry gains exactly STORAGE_QUOTA + STORAGE_RATE_LIMIT (no invented codes) | unit/grep | `vitest run tests/core/storage` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 2 | REQ-R03 | — | WorkspaceElection: CAS on np_workspace_primary, 3s heartbeat, 2-miss re-election, Standalone tie-break; isPrimaryWriter() pure read; gates np_workspace persist | unit | `vitest run tests/core/workspace/WorkspacePersistence.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-02 | 05 | 2 | REQ-R03 | — | Workspace persists across reload + cross-surface handoff (no message loss); D-22 debounce interplay verified | unit | `vitest run tests/core/workspace/WorkspacePersistence.test.ts` | ❌ W0 | ⬜ pending |
| 02-06-01 | 06 | 3 | REQ-R07 | — | RateLimiter token-bucket per-instance; acquire() → boolean/RATE_LIMITED | unit | `vitest run tests/core/utils/RateLimiter.test.ts` | ❌ W0 | ⬜ pending |
| 02-06-02 | 06 | 3 | REQ-R07 | — | Requester UI-side fetch wrapper (AbortController, 25s timeout, optional injected limiter, no default) | unit | `vitest run tests/core/utils/RateLimiter.test.ts` | ❌ W0 | ⬜ pending |
| 02-07-01 | 07 | 3 | — | — | redactSensitive + Setting.ts + ErrorStore debug-only wiring | unit | `vitest run tests/core/storage tests/core/security` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/storage/WriteJournal.test.ts`, `EncryptedStorage.test.ts`, `IndexedDBMigrator.test.ts` — required by spec §18 Phase 2
- [ ] `tests/core/utils/RateLimiter.test.ts` — required by spec §18 Phase 2
- [ ] `tests/core/workspace/WorkspacePersistence.test.ts` — required by spec §18 Phase 2
- [ ] `tests/core/security/` directory (EncryptedStorage/KeyVault fixtures) — verify:phase-2 runs this dir
- [ ] `fake-indexeddb` dev dep + IndexedDB mock in `tests/setup.ts` (research: indexedDB undefined in current jsdom env)
- [ ] `chrome.storage.session` mock in `tests/setup.ts` (research: not mocked today; needed for np_workspace_primary election CAS)
- [ ] `idb@^8` install (spec-pinned, RESEARCH.md verified 8.0.3)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| API-key masked placeholder on provider modal reload | D-28/D-30 | Visual DOM/security state; the backstop (never-echo) is a held-out test | Open Options → provider modal for a provider with a saved key; confirm `••••••••••••••••` placeholder renders and the decrypted key never appears in input value/aria/hint |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending