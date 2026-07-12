---
phase: 02
slug: storage-security-writejournal-workspace-persistence
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-12
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.0 |
| **Config file** | `vitest.config.ts` (exists from Phase 1) |
| **Quick run command** | `npx vitest run tests/core/storage/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15s (storage tests), ~30s (full suite) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/storage/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | STOR-01, STOR-05 | T-02-01 | IndexedDB opens with all stores, correct schema | unit | `npx vitest run tests/core/storage/IndexedDBManager.test.ts` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | STOR-04 | T-02-02 | Migrations run idempotently, oldVersion checks correct | unit | `npx vitest run tests/core/storage/IndexedDBMigrator.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | STOR-02 | T-02-03 | Encrypted round-trip passes; unique salt/IV per value | unit | `npx vitest run tests/core/storage/EncryptedStorage.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | STOR-03 | T-02-04 | WriteJournal recovery replays correctly, idempotent | unit | `npx vitest run tests/core/storage/WriteJournal.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | STOR-06 | — | RateLimiter token bucket correct, refill works | unit | `npx vitest run tests/core/storage/RateLimiter.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 2 | WRKSP-05, STOR-07 | T-02-05 | Workspace persists across reload, no body in storage | unit | `npx vitest run tests/core/storage/workspaceStore.test.ts` | ✅ exists | ⬜ pending |
| 02-05-02 | 05 | 2 | WRKSP-05 | T-02-06 | BroadcastBus syncs workspace across surfaces | unit | `npx vitest run tests/core/storage/broadcastBus.test.ts` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/storage/IndexedDBMigrator.test.ts` — stubs for STOR-04
- [ ] `tests/core/storage/EncryptedStorage.test.ts` — stubs for STOR-02
- [ ] `tests/core/storage/WriteJournal.test.ts` — stubs for STOR-03
- [ ] `tests/core/storage/RateLimiter.test.ts` — stubs for STOR-06
- [ ] `tests/core/storage/IndexedDBManager.test.ts` — stubs for STOR-01, STOR-05
- [ ] `npm install idb@^8.0.3` — install IndexedDB wrapper

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Workspace state persists across browser restart | WRKSP-05 | chrome.storage.session clears on browser close — requires full browser restart to verify | Open Side Panel, note workspaceId, close browser, reopen, verify workspaceId restored |
| Cross-surface workspace handoff (Side Panel → Full App) | WRKSP-05 | Requires two extension surfaces active simultaneously | Open Side Panel, click "Open Full App", verify workspace state matches in Full App |
| API key encryption at rest in chrome.storage | STOR-02, STOR-07 | Visual inspection of chrome.storage.local in DevTools | Open DevTools → Application → Storage → chrome.storage.local, verify no raw API keys visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
