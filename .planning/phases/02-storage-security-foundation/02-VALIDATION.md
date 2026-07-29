---
phase: 02
slug: storage-security-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-29
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.0.0 |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/core/storage tests/core/security tests/core/workspace/WorkspacePersistence.test.ts` |
| **Full suite command** | `pnpm run verify:phase-2` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/core/storage --reporter=verbose`
- **After every plan wave:** Run `pnpm run verify:phase-2`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | STORAGE-01 | T-2-01 | AES-GCM encrypt/decrypt round-trip with correct key derivation | unit | `npx vitest run tests/core/storage/CryptoService.test.ts -t "round-trip"` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | STORAGE-01 | T-2-02 | No plaintext keys in chrome.storage.local | unit | `npx vitest run tests/core/storage/ApiKeyStore.test.ts -t "no plaintext"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | STORAGE-01 | T-2-03 | WriteJournal replays incomplete transactions on startup | integration | `npx vitest run tests/core/storage/WriteJournal.test.ts -t "replay"` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | STORAGE-01 | T-2-04 | WriteJournal lazy repair validates on record access | integration | `npx vitest run tests/core/storage/WriteJournal.test.ts -t "lazy repair"` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | STORAGE-01 | T-2-05 | idb v1→v4 migration runs idempotently (run twice) | integration | `npx vitest run tests/core/storage/MigrationRunner.test.ts -t "idempotent"` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 3 | STORAGE-02 | — | SessionStore persists only to chrome.storage.session | unit | `npx vitest run tests/core/storage/SessionStore.test.ts -t "session"` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 3 | STORAGE-02 | — | WorkspaceStore persists via chrome.storage.local adapter | integration | `npx vitest run tests/core/workspace/WorkspaceStore.test.ts -t "persist"` | ✅ P1 | ⬜ pending |
| 02-04-03 | 04 | 3 | STORAGE-02 | — | Workspace state survives page reload | integration | `npx vitest run tests/core/workspace/WorkspacePersistence.test.ts -t "reload"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/storage/CryptoService.test.ts` — AES-GCM round-trip, PBKDF2 derivation, error handling, key caching
- [ ] `tests/core/storage/WriteJournal.test.ts` — startup replay, lazy repair, crash recovery, multi-step atomicity
- [ ] `tests/core/storage/MigrationRunner.test.ts` — v1→v4 migration, idempotency (run twice), fixture database setup
- [ ] `tests/core/storage/ApiKeyStore.test.ts` — encrypted store integration, decrypt-on-read, no plaintext
- [ ] `tests/core/storage/SessionStore.test.ts` — session storage lifecycle (get/set/remove/clear on session end)
- [ ] `tests/core/workspace/WorkspacePersistence.test.ts` — cross-reload state, chrome.storage.local adapter persistence
- [ ] `tests/core/security/redactSensitive.test.ts` — TraceRedactor secret redaction patterns
- [ ] `tests/core/storage/chromeStorageAdapter.test.ts` — adapter getItem/setItem/removeItem with localStorage fallback
- [ ] `tests/setup.ts` — add `chrome.storage.session` mock, register `fake-indexeddb/auto`
- [ ] Framework install: `npm install --save-dev fake-indexeddb@^6.2.5`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CSP does not block extension loading | SEC (implied) | CSP is enforced at Chrome install time; cannot be tested in Vitest jsdom | `wxt build && load unpacked in chrome://extensions` — verify no CSP errors in console |
| chrome.storage.session clears on browser restart | STORAGE-02 | Requires actual browser session lifecycle | Configure session token, close browser, reopen — verify tokens are gone |
| chrome.runtime.id stability across dev reloads | STORAGE-01 (D-02) | Depends on WXT manifest key handling in dev mode | `wxt build` → load unpacked → reload → verify `chrome.runtime.id` is stable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
