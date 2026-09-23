---
phase: "2"
slug: "storage-security-writejournal-workspace-persistence"
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-23"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.7 + jsdom 25.0.1, `globals: true`, `@testing-library/react` 16 for components |
| **Config file** | `vitest.config.ts` (environment `jsdom`, `setupFiles: ['./tests/setup.ts']`, alias `@` → `src`) |
| **Quick run command** | `npx vitest run tests/core/security tests/core/storage tests/core/workspace/WorkspacePersistence.test.ts tests/core/workspace/WriterElection.test.ts` |
| **Full suite command** | `pnpm run verify:phase-2` (after the D2-28 correction) |
| **Estimated runtime** | ~60–90 seconds for the full Phase 2 surface (quick run under ~30 s) |

No coverage provider is installed; no snapshot tests exist; no jest-dom matchers (use native assertions). Type checking is part of every gate (`tsc --noEmit` runs first).

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the suites the task touched
- **After every plan wave:** Run `npx vitest run tests/core/security tests/core/storage tests/core/workspace tests/integration tests/isolation tests/core/store`
- **Before `/gsd-verify-work`:** `pnpm run verify:phase-2` must be green (after `pnpm run build:ext` — the manifest gate fails, never skips, when `.output/chrome-mv3/manifest.json` is absent)
- **Max feedback latency:** ~30 seconds per task

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (planner fills) | — | — | CORE-02 / SC-1 | — | WriteJournal: operation creation, stage progression, idempotent replay, interrupted-operation recovery, duplicate handling, rollback, redaction, no body/secret persistence, bounded compaction | unit + integration | `npx vitest run tests/core/storage/WriteJournal.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | CORE-02 / SC-2 | — | AES-GCM round trip; envelope version metadata; unique IV; identical plaintext ⇒ different envelopes; malformed/tampered ciphertext/IV/tag/version/AAD/wrong-key fail closed; replace makes old value inaccessible; delete idempotent | unit | `npx vitest run tests/core/security/KeyVault.test.ts tests/core/storage/EncryptedStorage.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | CORE-02 / SC-2 | — | No message body (or body-derived `preview`) in `chrome.storage.local`; no plaintext in logs/journal/ErrorStore/WorkspaceState | unit (absence assertions + source-level scan) | `npx vitest run tests/core/store/useExtensionStore.test.ts tests/core/storage/legacyChatMigration.test.ts` | ⚠️ extend existing | ⬜ pending |
| TBD | — | — | CORE-02 / SC-2 | — | CredentialStorePort: store/replace/retrieve-for-authorised-consumer/presence/delete/version-inspect/typed redacted failures; presentation components cannot import KeyVault | unit + source-level isolation scan | `npx vitest run tests/core/security/credentialStorePort.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | CORE-02 / SC-3 | — | Migrator: fresh create; stores exist; Memory/Notes stores do NOT exist; indexes match; integer ordered versions; repeated open is a no-op; blocked upgrade safe; versionchange close/recover; aborted upgrade; failed index creation; partial transformation failure; deterministic retry; **test-only v1→v2 future-store fixture** | unit + integration | `npx vitest run tests/core/storage/IndexedDBMigrator.test.ts tests/core/storage/NowPilotDB.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | CORE-02 / SC-3 | — | ChatHistoryDB: empty/one/many hydration; ordering; single-transaction conversation+message write; authoritative read-back; restart recovery; no legacy-body fallback | unit + integration | `npx vitest run tests/core/storage/ChatHistoryDB.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | CORE-02 / SC-3 | — | Legacy migration: no history; 1×1; 1×many; many; empty conversation; duplicate run; interrupted destination write; transaction failure; read-back failure; sanitisation failure; restart between **every** stage; already-migrated destination; partially migrated install; malformed conversation; malformed message; unsupported schema; timestamp/ordering preservation; stable ids; no duplicates; schema bump; completion marker; redacted errors/logs | integration (table-driven over the 7 stages) | `npx vitest run tests/core/storage/legacyChatMigration.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | CORE-02 / SC-3 | — | ErrorStore: migration-failure recording; degraded-mode recording; redaction before write; safe resolution; retention/cleanup; malformed-record rejection | unit | `npx vitest run tests/core/storage/ErrorStore.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | CORE-02 / SC-4 | — | Workspace persistence: `np_workspace` round trip, reload survival, version monotonicity, last-write-wins by version, cross-surface handoff persistence | unit + integration | `npx vitest run tests/core/workspace/WorkspacePersistence.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | CORE-02 / SC-4 | — | Writer election: initial assignment; epoch generation; CAS success; CAS conflict; stale-writer rejection; heartbeat renewal; heartbeat expiry; one-surface closure; failed handoff retains the writer; successful handoff changes authority only after persistence+ack; mirror-state activation | unit + integration | `npx vitest run tests/core/workspace/WriterElection.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | CORE-02 / D2-31 | — | Suite A — WINDOWS #5 handoff contract: 22 named clauses over the shared harness | integration | `npx vitest run tests/integration/workspaceHandoff.integration.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | CORE-02 / D2-32 | — | Suite B — WINDOWS #8 onboarding contract: 22 named clauses incl. all secret-absence assertions | integration | `npx vitest run tests/integration/onboardingTwoSurface.integration.test.ts` | ❌ W0 | ⬜ pending |
| TBD | — | — | CORE-02 / D2-28 | — | Gate composition + self-derived path preflight; manifest carries `unlimitedStorage`; no Phase-1 gate regression | gate | `pnpm run verify:phase-2` | ⚠️ rewrite existing script | ⬜ pending |
| TBD | — | — | CORE-02 / §16.4 | — | Manifest: exactly the authorised permission set including `unlimitedStorage`; CSP unchanged; no `content_scripts` key | build-inspection | `npx vitest run tests/isolation/generated-manifest.test.ts` (after `pnpm run build:ext`) | ⚠️ update constant | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Not in the map (deliberately):** `tests/core/utils/RateLimiter.test.ts` — deferred to Phase 3 (D2-26/D2-28). No placeholder, no dummy test.

---

## Wave 0 Requirements

Test infrastructure that must exist **before** any implementation task can be verified:

- [ ] `package.json` — add `idb@^8` (dependency) and `fake-indexeddb@^6` (devDependency)
- [ ] `tests/setup.ts` — `import 'fake-indexeddb/auto'`, a `__resetIndexedDB()` helper backed by `new IDBFactory()`, a Map-backed `chrome.storage.session` mock, and a shared `chrome.storage.onChanged` dispatcher (both surfaces subscribe to the same emitter)
- [ ] `tests/harness/twoSurface.ts` — the D2-30 shared harness: two simulated surface runtimes, independent stores, stable identities, a deterministic loopback transport, a deterministic clock/heartbeat seam, deterministic tab/focus/reload adapters, restart/crash simulation, Phase 2 DB adapters, synthetic-only CredentialStorePort support. Not a test file; imported by both integration suites.
- [ ] `tests/core/security/` — new directory (currently absent): `KeyVault.test.ts`, `EncryptedStorage.test.ts`, `credentialStorePort.test.ts`, `redactSensitive.test.ts`
- [ ] `tests/core/storage/` — add `NowPilotDB.test.ts`, `IndexedDBMigrator.test.ts`, `ChatHistoryDB.test.ts`, `WriteJournal.test.ts`, `ErrorStore.test.ts`, `legacyChatMigration.test.ts`
- [ ] `tests/core/workspace/` — add `WorkspacePersistence.test.ts` (referenced by the stale gate but missing) and `WriterElection.test.ts`
- [ ] `tests/integration/` — new directory: `workspaceHandoff.integration.test.ts`, `onboardingTwoSurface.integration.test.ts`
- [ ] `package.json` `verify:phase-2` — rewrite with an explicit path list **plus** the self-derived preflight copied from `verify:phase-1` (`node -e` path-resolution check over the script's own declared paths, exiting 1 with the missing paths named)
- [ ] `tests/isolation/generated-manifest.test.ts` — update `AUTHORISED_PERMISSIONS` to include `unlimitedStorage` in the same change as `wxt.config.ts`
- [ ] `tests/core/store/useExtensionStore.test.ts` — extend for the v3 projection (`sessions`/`activeSessionId` gone, `preview` gone, bodies absent) and the async-hydration contract

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MirrorBanner / capability notice / notification rendering at 400 px (overflow + wrapping) | CORE-02 / 02-UI-SPEC.md § UI Considerations (2 backstop rows) | jsdom cannot observe layout; Phase 2 evidence is deterministic-only (D2-20) | Deferred to the Phase 15 consolidated Real-Chrome acceptance cycle — screenshot + written observed-result record |

All other phase behaviors have automated verification.

---

## Traceability (D2-35)

- WINDOW #5 clause → handoff integration test name → production contract → Phase 2 requirement → evidence
- WINDOW #8 clause → onboarding integration test name → production contract → Phase 2 requirement → evidence
- WINDOWS #5 and #8 stay `open` after the automated suites pass: record "Phase 2 automated contract coverage = PASS", "Phase 15 Real-Chrome acceptance = deferred", "Phase 19 release gate must fail while open"

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
