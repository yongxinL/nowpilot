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
| **Quick run command** | `pnpm lint && pnpm test -- tests/core/storage tests/core/security tests/core/utils tests/core/workspace` |
| **Full suite command** | `pnpm run verify:phase-2` (`tsc --noEmit && vitest run tests/core/storage tests/core/security tests/core/utils tests/core/workspace`) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm lint && pnpm test -- tests/core/storage tests/core/security tests/core/utils tests/core/workspace`
- **After every plan wave:** Run `pnpm run verify:phase-2`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | REQ-R07 | — | Harness: idb@^8 + fake-indexeddb@^6 installed (VAI-04); tests/setup.ts gains `import 'fake-indexeddb/auto'`, `__resetIndexedDB()`, Map-backed chrome.storage.session mock; tests/core/security/ + tests/core/utils/ dirs created | env/unit | `pnpm lint && pnpm list idb fake-indexeddb 2>&1 \| grep -E "idb@8\|fake-indexeddb@6"` | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | REQ-R07 | — | Harness smoke: IDB round-trip via openDB, session-mock round-trip, `__resetIndexedDB()` isolation; Phase-1 166-test suite stays green (zero regression) | unit | `vitest run tests/core/storage/harness-smoke.test.ts && pnpm run verify:phase-1` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | REQ-R07 | — | EncryptedStorage AES-GCM round-trip: encrypt → chrome.storage.local → decrypt; wrong-key/tamper rejection; once-only 32-byte install secret; fresh salt+IV per encryption | unit | `vitest run tests/core/storage/EncryptedStorage.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 1 | REQ-R07 | — | np_store → np_providers one-time migration (async boot step): encrypted np_providers written first, plaintext stripped second; idempotent + crash-safe; decrypt-on-read hydrate (read-only); inspection gate: no raw secret substring in persisted blobs | unit | `vitest run tests/core/security/secrets-inspection.test.ts tests/core/storage/EncryptedStorage.test.ts` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 1 | REQ-R07 | — | Options provider modal: masked `••••••••••••••••` placeholder for saved keys, stored key never echoed into value/aria/hint; Save Provider / Check Connection CTA renames; no false-success toast on persist failure | UI grep | `grep -n "Save Provider" src/components/options/OptionsPage.tsx && grep -n "Check Connection" src/components/options/OptionsPage.tsx` | ✅ | ⬜ pending |
| 02-03-01 | 03 | 1 | REQ-R07 | — | RateLimiter token-bucket per-instance; acquire() → true/false (never throws); elapsed-time refill with fractional-token precision (no rounding drift) | unit | `vitest run tests/core/utils/RateLimiter.test.ts tests/core/utils/Requester.test.ts` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 1 | REQ-R07 | — | Requester UI-side fetch wrapper: AbortController, 25s default timeout, optional injected limiter (no default); TIMEOUT/NETWORK/RATE_LIMITED canonical codes only (no invented codes) | unit | `vitest run tests/core/utils/RateLimiter.test.ts tests/core/utils/Requester.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | REQ-R06 | — | IndexedDBMigrator framework + WriteJournalEntry types; v1→v2 fixture (backward-compatible, idempotent, fresh-open-at-v2); all 5 DBs bootstrapped at v1 with §15.1 store lists | unit | `vitest run tests/core/storage/IndexedDBMigrator.test.ts` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 2 | REQ-R06 | — | unlimitedStorage in wxt.config permissions (set exactly sidePanel, storage, tabs, unlimitedStorage; session 10MB cap NOT lifted) | config grep | `grep 'unlimitedStorage' wxt.config.ts` | ✅ | ⬜ pending |
| 02-04-03 | 04 | 2 | REQ-R07 | — | ErrorStore (idb FIFO-100 debug sink): evicts oldest past 100, redacts sensitive context at write boundary, never rethrows (debugLog fallback) | unit | `vitest run tests/core/storage/ErrorStore.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 3 | REQ-R03 | — | WriteJournal runJournaled/recoverJournal per O.11; simulated SW kill mid-write → replay restores state (criterion 1); idempotent replay; reverse rollback + WRITE_JOURNAL_FAILED; unsupported-op skip | unit | `vitest run tests/core/storage/WriteJournal.test.ts` | ❌ W0 | ⬜ pending |
| 02-05-02 | 05 | 3 | REQ-R03 | — | journalingAdapter: primary path (immediate entry put → debounced write + WORKSPACE_UPDATED → completed); secondary mirror-skip (D-27); legacy np_workspace_store one-time lift; passthrough | unit | `vitest run tests/core/workspace/journalingAdapter.test.ts` | ❌ W0 | ⬜ pending |
| 02-06-01 | 06 | 2 | REQ-R03 | — | WorkspaceElection: CAS on np_workspace_primary, 3s heartbeat, 2-miss re-election, Standalone tie-break, solo; isPrimaryWriter() pure read; single 3s timer owner; session-only records | unit | `vitest run tests/core/workspace/WorkspaceElection.test.ts` | ❌ W0 | ⬜ pending |
| 02-06-02 | 06 | 2 | REQ-R07 | — | chromeStorageAdapter surfaces exactly STORAGE_QUOTA / STORAGE_RATE_LIMIT / fallback (STORAGE_DEBOUNCE_FLUSH_FAILED) via classifyStorageError + reporter hook — never swallowed; exactly one ErrorStore record per failure via registered reporter (D-39) | unit | `vitest run tests/core/storage/chromeStorageAdapter.test.ts` (Task 2 also modifies package.json: verify:phase-2 workspace path → `tests/core/workspace`) | ✅ | ⬜ pending |
| 02-07-01 | 07 | 4 | REQ-R03 | — | WorkspaceStore: isPrimaryWriter pure read (Phase-1 stub gone), journaled np_workspace persist; reload + cross-surface handoff with no message loss (criterion 5) | unit | `vitest run tests/core/workspace/WorkspacePersistence.test.ts` | ❌ W0 | ⬜ pending |
| 02-07-02 | 07 | 4 | REQ-R03 | — | Boot wiring: recoverJournal → migrator bootstrap → election (sidepanel/standalone); migrateProviderSecrets + hydrateProviderSecrets decrypt-on-read (options); adapter reporter registration; MirrorBanner election-secondary trigger | source grep | `pnpm lint` + `grep -n "hydrateProviderSecrets" entrypoints/options/main.tsx` | ✅ | ⬜ pending |
| 02-07-03 | 07 | 4 | REQ-R03 | — | WorkspacePersistence expansion: journal recovery on boot; write-rate budget ≤30/min (heartbeat 20/min + journal immediate + debounced coalesced); election-gated mirror skip | unit | `pnpm run verify:phase-2` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/core/storage/WriteJournal.test.ts`, `EncryptedStorage.test.ts`, `IndexedDBMigrator.test.ts` — required by spec §18 Phase 2; plus plan-authored `ErrorStore.test.ts`, `harness-smoke.test.ts`
- [ ] `tests/core/utils/RateLimiter.test.ts` — required by spec §18 Phase 2; plus plan-authored `Requester.test.ts`
- [ ] `tests/core/workspace/WorkspacePersistence.test.ts` — required by spec §18 Phase 2; plus plan-authored `WorkspaceElection.test.ts`, `journalingAdapter.test.ts`
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