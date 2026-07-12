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
| 02-01-01 | 02-01 | 0 | STOR-05 | — | idb v8.0.3 installed, vitest + chrome mocks ready | unit | `npx tsc --noEmit && npx vitest run tests/core/storage/` | ❌ W0 | ⬜ pending |
| 02-01-02 | 02-01 | 0 | STOR-05 | T-02-00 | Smoke test: IndexedDB + chrome.storage mock verification | unit | `npx vitest run tests/core/storage/02-smoke-test.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02-02 | 1 | STOR-01, STOR-05 | T-02-01 | IndexedDBManager.getDB() opens `nowpilot` DB with all stores | unit | `npx vitest run tests/core/storage/IndexedDBManager.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02-02 | 1 | STOR-01, STOR-05 | T-02-01 | NowPilotDB DBSchema typed, 13 object stores, blocking/terminated handled | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 02-03-01 | 02-03 | 1 | STOR-02 | T-02-03 | EncryptedStorage encrypt/decrypt round-trip preserves original | unit | `npx vitest run tests/core/storage/EncryptedStorage.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-02 | 02-03 | 1 | STOR-02 | T-02-03 | Unique salt/IV per encryption, no key reuse | unit | `npx vitest run tests/core/storage/EncryptedStorage.test.ts` | ❌ W0 | ⬜ pending |
| 02-06-01 | 02-06 | 1 | STOR-06 | — | RateLimiter.tryAcquire() returns correct token bucket state | unit | `npx vitest run tests/core/storage/RateLimiter.test.ts` | ❌ W0 | ⬜ pending |
| 02-06-02 | 02-06 | 1 | STOR-06 | — | Token bucket refills over time, burst capped at capacity | unit | `npx vitest run tests/core/storage/RateLimiter.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 02-04 | 2 | STOR-04, STOR-05 | T-02-05 | IndexedDBMigrator.register/getMigrationsBetween/getAllMigrations | unit | `npx vitest run tests/core/storage/IndexedDBMigrator.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-02 | 02-04 | 2 | STOR-04, STOR-05 | T-02-05 | v1-initial-schema migration creates 13 object stores with guard | unit | `npx tsc --noEmit && grep -c 'createObjectStore' src/core/storage/migrations/v1-initial-schema.ts | xargs -I{} sh -c '[ {} -ge 13 ]'` | ❌ W0 | ⬜ pending |
| 02-04-03 | 02-04 | 2 | STOR-04 | T-02-06 | Migration idempotency — re-running same migration safe | unit | `npx vitest run tests/core/storage/IndexedDBMigrator.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-01 | 02-05 | 2 | STOR-03 | T-02-04 | WriteJournalEntry lifecycle: pending→applying→completed/failed | unit | `npx vitest run tests/core/storage/WriteJournal.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-02 | 02-05 | 2 | STOR-03, STOR-07 | T-02-04 | WriteJournal recovery replays pending/applying entries idempotently | unit | `npx vitest run tests/core/storage/WriteJournal.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-03 | 02-05 | 2 | STOR-03 | T-02-04 | Completed entries pruned after retention window | unit | `npx vitest run tests/core/storage/WriteJournal.test.ts` | ❌ W0 | ⬜ pending |
| 02-07-01 | 02-07 | 3 | STOR-05, STOR-07 | — | ChatHistoryDB opens with sessions + messages stores | unit | `npx vitest run tests/core/storage/ChatHistoryDB.test.ts` | ❌ W0 | ⬜ pending |
| 02-07-02 | 02-07 | 3 | STOR-05 | — | NotesDB, MemoryDB, ErrorStore all open with correct schema versions | unit | `npx tsc --noEmit` | ❌ W0 | ⬜ pending |
| 02-07-03 | 02-07 | 3 | STOR-05 | — | AITransactionLogDB opens with transaction/tool/provider trace stores | unit | `npx vitest run tests/core/storage/AITransactionLogDB.test.ts` | ❌ W0 | ⬜ pending |
| 02-08-01 | 02-08 | 3 | WRKSP-05 | T-02-07 | WorkspaceStore persists via chrome.storage.local + WriteJournal routing | unit | `npx vitest run tests/core/storage/workspaceStore.test.ts` | ✅ exists | ⬜ pending |
| 02-08-02 | 02-08 | 3 | STOR-02 | T-05-KEY | ProviderStore uses EncryptedStorage instead of in-memory placeholder | unit | `npx vitest run tests/core/storage/EncryptedStorage.test.ts` | ❌ W0 | ⬜ pending |
| 02-08-03 | 02-08 | 3 | WRKSP-05 | T-02-07 | BroadcastBus listens for chrome.storage.local changes, emits WORKSPACE_UPDATED | unit | `npx vitest run tests/core/storage/broadcastBus.test.ts` | ✅ exists | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/storage/02-smoke-test.test.ts` — smoke tests for mock infrastructure
- [ ] `tests/core/storage/IndexedDBManager.test.ts` — stubs for STOR-01, STOR-05
- [ ] `tests/core/storage/IndexedDBMigrator.test.ts` — stubs for STOR-04
- [ ] `tests/core/storage/EncryptedStorage.test.ts` — stubs for STOR-02
- [ ] `tests/core/storage/WriteJournal.test.ts` — stubs for STOR-03
- [ ] `tests/core/storage/RateLimiter.test.ts` — stubs for STOR-06
- [ ] `tests/core/storage/ChatHistoryDB.test.ts` — stubs for STOR-05
- [ ] `tests/core/storage/AITransactionLogDB.test.ts` — stubs for STOR-05
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
