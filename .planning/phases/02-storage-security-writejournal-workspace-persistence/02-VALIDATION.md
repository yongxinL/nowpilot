---
phase: "2"
slug: "storage-security-writejournal-workspace-persistence"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6).
# Observed state at 02-13 (2026-09-24): the map was green at 02-13 execution time, but
# the `verify:phase-1` row was later observed red on re-run — the over-broad Phase-1
# substring gate counted the doc comment at src/core/security/KeyVault.ts:33 as a call
# site (02-VERIFICATION.md gap 1). `nyquist_compliant` is therefore honestly `false`
# until plan 02-14 Task 3 re-runs both phase gates from one code state and restores it
# to `true`. `status` stays `draft` because the declared lifecycle reserves `validated`
# for validate-phase §6; the Manual-Only 400 px backstop row remains outstanding
# (routed to the Phase 15 consolidated Real-Chrome cycle), and no window changes status.
status: draft
nyquist_compliant: false
wave_0_complete: true
created: "2026-09-23"
executed: "2026-09-24"
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> **Phase close (plan 02-13 Task 2, 2026-09-24):** `pnpm run build:ext` then `pnpm run verify:phase-2` is green (25 files / 441 tests) and `pnpm run verify:phase-1` is green in the same run (55 files / 835 tests); the preflight was observed red on a misspelled suite path and green after restore; the Manual-Only 400 px backstop row stays outstanding with the Phase 15 cycle. **(superseded 2026-09-24 — see the correction below)**
> **Correction (plan 02-14, 2026-09-24):** that cross-phase green claim was superseded — the Phase-1 case was a comment-blind substring scan and a later documentation-only review-fix commit (`18d206c6`, IN-05/IN-06) added a doc comment at `src/core/security/KeyVault.ts:33` that merely names `CredentialStorePort`, so `verify:phase-1` was observed red on re-run (`02-VERIFICATION.md` gap 1). Plan 02-14 replaced the over-broad rule with the credential-boundary gate (`tests/isolation/credential-boundary.test.ts`) and re-ran both phase gates from one code state; the fresh observations are in `02-14-SUMMARY.md`.

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
| 02-02 T2 | 02-02 | 2 | CORE-02 / SC-1 | T-02-05…08 | WriteJournal: operation creation, stage progression, idempotent replay, interrupted-operation recovery, duplicate handling, rollback, redaction, no body/secret persistence, bounded compaction | unit + integration | `npx vitest run tests/core/storage/WriteJournal.test.ts` | ✅ | ✅ green — 11 passed (observed 2026-09-24) |
| 02-03 T1, 02-03 T2, 02-03 T3 | 02-03 | 2 | CORE-02 / SC-2 | T-02-09…18 | AES-GCM round trip; envelope version metadata; unique IV; identical plaintext ⇒ different envelopes; malformed/tampered ciphertext/IV/tag/version/AAD/wrong-key fail closed; replace makes old value inaccessible; delete idempotent | unit | `npx vitest run tests/core/security/KeyVault.test.ts tests/core/security/EncryptedStorage.test.ts` | ✅ | ✅ green — KeyVault 16 passed, EncryptedStorage 12 passed (observed 2026-09-24) |
| 02-02 T1, 02-08 T1 | 02-02 / 02-08 | 2 / 4 | CORE-02 / SC-2 | T-02-19 | No message body (or body-derived `preview`) in `chrome.storage.local`; no plaintext in logs/journal/ErrorStore/WorkspaceState | unit (absence assertions + source-level scan) | `npx vitest run tests/core/store/useExtensionStore.test.ts tests/core/storage/legacyChatMigration.test.ts` | ✅ | ✅ green — 2 files / 54 passed (useExtensionStore 24 + legacyChatMigration 30; observed 2026-09-24) |
| 02-04 T1 | 02-04 | 3 | CORE-02 / SC-2 | T-02-18…20 | CredentialStorePort: store/replace/retrieve-for-authorised-consumer/presence/delete/version-inspect/typed redacted failures; presentation components cannot import KeyVault | unit + source-level isolation scan | `npx vitest run tests/core/security/credentialStorePort.test.ts` | ✅ | ✅ green — 27 passed (observed 2026-09-24) |
| 02-02 T3 | 02-02 | 2 | CORE-02 / SC-3 | T-02-21…23 | Migrator: fresh create; stores exist; Memory/Notes stores do NOT exist; indexes match; integer ordered versions; repeated open is a no-op; blocked upgrade safe; versionchange close/recover; aborted upgrade; failed index creation; partial transformation failure; deterministic retry; **test-only v1→v2 future-store fixture** | unit + integration | `npx vitest run tests/core/storage/IndexedDBMigrator.test.ts tests/core/storage/NowPilotDB.test.ts` | ✅ | ✅ green — 2 files / 13 passed (observed 2026-09-24) |
| 02-02 T1, 02-02 T3 | 02-02 | 2 | CORE-02 / SC-3 | T-02-24 | ChatHistoryDB: empty/one/many hydration; ordering; single-transaction conversation+message write; authoritative read-back; restart recovery; no legacy-body fallback | unit + integration | `npx vitest run tests/core/storage/ChatHistoryDB.test.ts` | ✅ | ✅ green — 5 passed (observed 2026-09-24) |
| 02-05 T2, 02-05 T3 | 02-05 | 3 | CORE-02 / SC-3 | T-02-25…28 | Legacy migration: no history; 1×1; 1×many; many; empty conversation; duplicate run; interrupted destination write; transaction failure; read-back failure; sanitisation failure; restart between **every** stage; already-migrated destination; partially migrated install; malformed conversation; malformed message; unsupported schema; timestamp/ordering preservation; stable ids; no duplicates; schema bump; completion marker; redacted errors/logs | integration (table-driven over the 7 stages) | `npx vitest run tests/core/storage/legacyChatMigration.test.ts` | ✅ | ✅ green — 30 passed (observed 2026-09-24) |
| 02-05 T1 | 02-05 | 3 | CORE-02 / SC-3 | T-02-29 | ErrorStore: migration-failure recording; degraded-mode recording; redaction before write; safe resolution; retention/cleanup; malformed-record rejection | unit | `npx vitest run tests/core/storage/ErrorStore.test.ts` | ✅ | ✅ green — 11 passed (observed 2026-09-24) |
| 02-06 T1 | 02-06 | 3 | CORE-02 / SC-4 | T-02-31…34 | Workspace persistence: `np_workspace` round trip, reload survival, version monotonicity, last-write-wins by version, cross-surface handoff persistence | unit + integration | `npx vitest run tests/core/workspace/WorkspacePersistence.test.ts` | ✅ | ✅ green — 16 passed (observed 2026-09-24) |
| 02-06 T2 | 02-06 | 3 | CORE-02 / SC-4 | T-02-35…37 | Writer election: initial assignment; epoch generation; CAS success; CAS conflict; stale-writer rejection; heartbeat renewal; heartbeat expiry; one-surface closure; failed handoff retains the writer; successful handoff changes authority only after persistence+ack; mirror-state activation | unit + integration | `npx vitest run tests/core/workspace/WriterElection.test.ts` | ✅ | ✅ green — 22 passed (observed 2026-09-24) |
| 02-11 T1, 02-11 T2 | 02-11 | 6 | CORE-02 / D2-31 | T-02-57…62 | Suite A — WINDOWS #5 handoff contract: 22 named clauses over the shared harness | integration | `npx vitest run tests/integration/workspaceHandoff.integration.test.ts` | ✅ | ✅ green — 23 passed (22 clause cases + the D2-33 chat-identity case; observed 2026-09-24) |
| 02-12 T1 | 02-12 | 7 | CORE-02 / D2-32 | T-02-63…67 | Suite B — WINDOWS #8 onboarding contract: 22 named clauses incl. all secret-absence assertions | integration | `npx vitest run tests/integration/onboardingTwoSurface.integration.test.ts` | ✅ | ✅ green — 24 passed (22 clause cases + traceability + the D2-33 vault-boundary case; observed 2026-09-24) |
| 02-13 T1, 02-13 T2 | 02-13 | 8 | CORE-02 / D2-28 | T-02-68…70 | Gate composition + self-derived path preflight; manifest carries `unlimitedStorage`; no Phase-1 gate regression | gate | `pnpm run verify:phase-2` | ✅ | ❌ superseded — observed green at 02-13 execution (2026-09-24T03:08Z): 22 declared paths resolve, 25 files / 441 tests after `pnpm run build:ext`, `verify:phase-1` 55 files / 835 tests in the same run, preflight teeth observed (misspelled path → exit 1 naming it, restore → green); the row's "no Phase-1 gate regression" clause was later observed FALSE on re-run (`verify:phase-1` exit 1 — `02-VERIFICATION.md` gap 1). Resolution: plan 02-14 replaced the over-broad Phase-1 substring rule with the credential-boundary gate; the fresh re-run lives in `02-14-SUMMARY.md` |
| 02-01 T3 | 02-01 | 1 | CORE-02 / §16.4 | T-02-01…04 | Manifest: exactly the authorised permission set including `unlimitedStorage`; CSP unchanged; no `content_scripts` key | build-inspection | `npx vitest run tests/isolation/generated-manifest.test.ts` (after `pnpm run build:ext`) | ✅ | ✅ green — 10 passed (observed 2026-09-24) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

**Not in the map (deliberately):** `tests/core/utils/RateLimiter.test.ts` — deferred to Phase 3 (D2-26/D2-28). No placeholder, no dummy test.

---

## Wave 0 Requirements

Test infrastructure that must exist **before** any implementation task can be verified:

- [x] `package.json` — add `idb@^8` (dependency) and `fake-indexeddb@^6` (devDependency) — present (`idb@^8.0.3`, `fake-indexeddb@^6.2.5`), landed by 02-01 T1
- [x] `tests/setup.ts` — `import 'fake-indexeddb/auto'`, a `__resetIndexedDB()` helper backed by `new IDBFactory()`, a Map-backed `chrome.storage.session` mock, and a shared `chrome.storage.onChanged` dispatcher (both surfaces subscribe to the same emitter) — landed by 02-01 T2; the dispatcher is write-triggered (02-01 decision)
- [x] `tests/harness/twoSurface.ts` — the D2-30 shared harness: two simulated surface runtimes, independent stores, stable identities, a deterministic loopback transport, a deterministic clock/heartbeat seam, deterministic tab/focus/reload adapters, restart/crash simulation, Phase 2 DB adapters, synthetic-only CredentialStorePort support. Not a test file; imported by both integration suites. — landed by 02-11 T1; consumed by Suite A and Suite B
- [x] `tests/core/security/` — new directory (currently absent): `KeyVault.test.ts`, `EncryptedStorage.test.ts`, `credentialStorePort.test.ts`, `redactSensitive.test.ts` — all four exist (4 files / 70 passed, observed 2026-09-24)
- [x] `tests/core/storage/` — add `NowPilotDB.test.ts`, `IndexedDBMigrator.test.ts`, `ChatHistoryDB.test.ts`, `WriteJournal.test.ts`, `ErrorStore.test.ts`, `legacyChatMigration.test.ts` — all six exist and are green
- [x] `tests/core/workspace/` — add `WorkspacePersistence.test.ts` (referenced by the stale gate but missing) and `WriterElection.test.ts` — both exist and are green (02-06)
- [x] `tests/integration/` — new directory: `workspaceHandoff.integration.test.ts`, `onboardingTwoSurface.integration.test.ts` — both exist; 2 files / 47 passed (observed 2026-09-24)
- [x] `package.json` `verify:phase-2` — rewrite with an explicit path list **plus** the self-derived preflight copied from `verify:phase-1` (`node -e` path-resolution check over the script's own declared paths, exiting 1 with the missing paths named) — landed by 02-13 T1 (commit `417454fe`): 22 declared paths resolve, the stale `tests/core/utils` token is gone, and the misspelling observation exited 1 naming the path (2026-09-24)
- [x] `tests/isolation/generated-manifest.test.ts` — update `AUTHORISED_PERMISSIONS` to include `unlimitedStorage` in the same change as `wxt.config.ts` — landed by 02-01 T3 (10 passed, observed 2026-09-24)
- [x] `tests/core/store/useExtensionStore.test.ts` — extend for the v3 projection (`sessions`/`activeSessionId` gone, `preview` gone, bodies absent) and the async-hydration contract — landed by 02-08

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| MirrorBanner / capability notice / notification rendering at 400 px (overflow + wrapping) | CORE-02 / 02-UI-SPEC.md § UI Considerations (2 backstop rows) | jsdom cannot observe layout; Phase 2 evidence is deterministic-only (D2-20) | Deferred to the Phase 15 consolidated Real-Chrome acceptance cycle — screenshot + written observed-result record |

All other phase behaviors have automated verification.

---

## Traceability (D2-35)

**Recorded 2026-09-24 by plan 02-12.** Both windows stay `open` in `.planning/WINDOWS.md` (that file is unmodified by this record): **Phase 2 automated contract coverage = PASS**, **Phase 15 Real-Chrome acceptance = still deferred**, and the **Phase 19 release gate must fail while the human observation remains open**. The two suites prove in-process contract behaviour only — they close no window and claim no observed UI behaviour.

### WINDOW #5 — cross-surface handoff → suite A (`tests/integration/workspaceHandoff.integration.test.ts`, 23 cases)

Evidence for every row: `02-11-SUMMARY.md` coverage D2 — `npx vitest run tests/integration/workspaceHandoff.integration.test.ts` → 23 passed (observed 2026-09-24).

| WINDOW #5 clause | Integration test (suite A) | Production contract (module · symbol) | Requirement | Evidence |
|---|---|---|---|---|
| cold Standalone target initialisation | `D2-31.1 cold Standalone target initialisation — the document comes up from the validated URL bootstrap and announces readiness` | `src/core/workspace/handoff/protocol.ts` · `createHandoffTarget` / `parseHandoffUrl` | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| target-ready notification before transfer | `D2-31.2 target-ready notification before transfer — no transfer is published before the correlated ready arrives` | `src/core/workspace/handoff/protocol.ts` · `createHandoffInitiator` ready gate / `validateHandoffEnvelope` | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| ready/transfer/acknowledgement ordering | `D2-31.3 ready/transfer/acknowledgement ordering — the three correlated envelopes cross in that order, each schema-valid` | `src/core/workspace/handoff/protocol.ts` · `createHandoffInitiator` / `createHandoffTarget` | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| acknowledgement required before reporting success | `D2-31.4 acknowledgement required before reporting success — success is withheld until the validated ack lands` | `src/core/workspace/handoff/protocol.ts` · `createHandoffInitiator` acknowledgement gate | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| reuse and focus of an existing Standalone target | `D2-31.5 reuse and focus of an existing Standalone target — the warm path focuses and re-points the same tab` | `src/core/workspace/WorkspaceRouter.ts` · `openStandalone` / `planStandaloneTarget` | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| duplicate-tab prevention | `D2-31.6 duplicate-tab prevention — repeated and concurrent opens never create a second Standalone tab` | `src/core/workspace/WorkspaceRouter.ts` · `planStandaloneTarget` single-tab rule | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| stable workspace and request identifiers | `D2-31.7 stable workspace and request identifiers — one request id per attempt, stable across retries and surfaces` | `src/core/workspace/handoff/protocol.ts` · `createHandoffRequestId` / `buildHandoffUrl` | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| idempotent duplicate requests | `D2-31.8 idempotent duplicate requests — a repeated transfer is acknowledged again and applied exactly once` | `src/core/workspace/handoff/protocol.ts` · `createHandoffTarget` applied-request set | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| safe handoff projection | `D2-31.9 safe handoff projection — exactly the allowlist crosses and an over-wide request leaks nothing` | `src/core/workspace/handoff/protocol.ts` · `phase1HandoffProjectionSchema` (strict allowlist) | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| composer-draft transfer | `D2-31.10 composer-draft transfer — the draft rides the projection, lands consume-once and never the URL` | `src/core/workspace/handoff/composerDraft.ts` · `useHandoffComposerDraftStore` consume-once slot | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| no complete WorkspaceState broadcast | `D2-31.11 no complete WorkspaceState broadcast — no envelope carries a state object and the real validator rejects one` | `src/core/workspace/handoff/protocol.ts` · `validateHandoffEnvelope` strict projection | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| no credential or secret in URL, envelope, message, journal or log | `D2-31.12 no credential or secret in URL, envelope, message, journal or log — the sentinel never crosses` | `src/core/workspace/handoff/protocol.ts` validators + `src/core/storage/WriteJournal.ts` + `src/core/storage/ErrorStore.ts` redaction | CORE-02 | `02-11-SUMMARY.md` D3 — suite A green (23 passed, 2026-09-24) |
| timeout behaviour | `D2-31.13 timeout behaviour — a silent target fails on the harness clock and never claims success` | `src/core/workspace/handoff/protocol.ts` · `HANDOFF_TIMEOUT_MS` | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| bounded retry | `D2-31.14 bounded retry — the attempt count is bounded and a late acknowledgement cannot resurrect success` | `src/core/workspace/handoff/protocol.ts` · `HANDOFF_MAX_RETRIES` | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| rejection of an invalid source or target | `D2-31.15 rejection of an invalid source or target — forged surfaces fail the real URL and envelope validators` | `src/core/workspace/handoff/protocol.ts` · `parseHandoffUrl` / `validateHandoffEnvelope` | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| rejection of an unsupported schema version | `D2-31.16 rejection of an unsupported schema version — a future version is refused by both validators` | `src/core/workspace/handoff/protocol.ts` · `HANDOFF_SCHEMA_VERSION` checks | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| persistence and authoritative read-back where required | `D2-31.17 persistence and authoritative read-back — the transferred state persists journaled and reads back` | `src/core/workspace/WorkspacePersistence.ts` · `writeWorkspaceState` / `readWorkspaceState` + `WriteJournal` | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| crash between handoff stages | `D2-31.18 crash between handoff stages — a lost acknowledgement leaves durable state consistent and the retry completes` | `src/core/workspace/handoff/protocol.ts` · initiator/target retry contract | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| reload and recovery | `D2-31.19 reload and recovery — a reloaded document rebuilds from durable storage and the next handoff still completes` | `src/core/workspace/WorkspacePersistence.ts` · `readWorkspaceState` + `src/core/workspace/handoff/protocol.ts` · `createHandoffTarget` | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| failure preserving the original writer | `D2-31.20 failure preserving the original writer — a failed handoff leaves authority with the original writer` | `src/core/workspace/WriterElection.ts` · `createWriterElection` / `assertStillPrimary` | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| stale-writer rejection after the election becomes authoritative | `D2-31.21 stale-writer rejection after the election becomes authoritative — the superseded surface cannot write` | `src/core/workspace/WriterElection.ts` · `isStale` / `PRIMARY_RECORD_KEY` epoch CAS | CORE-02 | `02-11-SUMMARY.md` D2 — suite A green (23 passed, 2026-09-24) |
| traceability: one named case per clause | `D2-31.22 traceability — the suite declares exactly one named case per D2-31 clause` | the suite itself (reads its own source; no production symbol) | CORE-02 | `02-11-SUMMARY.md` D4 — suite A green (23 passed, 2026-09-24) |

The D2-33 chat-identity case (`chat identity — minimal synthetic records persist across a restart, resolve by reference and never ride the handoff envelope`, evidence `02-11-SUMMARY.md` coverage D5) is the suite's own ChatHistoryDB boundary case and is not a WINDOW #5 clause row.

### WINDOW #8 — two-live-surface onboarding → suite B (`tests/integration/onboardingTwoSurface.integration.test.ts`, 24 cases)

Evidence for every row: `02-12-SUMMARY.md` coverage D2 — `npx vitest run tests/integration/onboardingTwoSurface.integration.test.ts` → 24 passed (observed 2026-09-24).

| WINDOW #8 clause | Integration test (suite B) | Production contract (module · symbol) | Requirement | Evidence |
|---|---|---|---|---|
| Standalone-first onboarding state | `D2-32.1 Standalone-first onboarding state — the Standalone opened first is the surface that presents the flow` | `src/core/onboarding/onboardingStateStore.ts` · `readOnboardingState` + `src/core/onboarding/useOnboardingGate.ts` · `useOnboardingGate` | CORE-02 | `02-12-SUMMARY.md` D2 — suite B green (24 passed, 2026-09-24) |
| Side Panel joining while onboarding is active | `D2-32.2 the Side Panel joining while onboarding is active — the joining surface renders the mirrored state and starts no competing flow` | `src/core/onboarding/onboardingStateStore.ts` · `shouldPresentOnboardingForWriter` | CORE-02 | `02-12-SUMMARY.md` D2 — suite B green (24 passed, 2026-09-24) |
| exactly one authoritative onboarding attempt | `D2-32.3 exactly one authoritative onboarding attempt — presentations counted across both surfaces total exactly one` | `src/core/onboarding/onboardingStateStore.ts` · `shouldPresentOnboardingForWriter` (presentations counted per surface) | CORE-02 | `02-12-SUMMARY.md` D2 — suite B green (24 passed, 2026-09-24) |
| no competing flow controller | `D2-32.4 no competing flow controller — a mirror claims nothing and concurrent presentations never exceed one` | `src/core/onboarding/useOnboardingGate.ts` · `useOnboardingGate` (a non-writer resolves `hidden` before the read) | CORE-02 | `02-12-SUMMARY.md` D2 — suite B green (24 passed, 2026-09-24) |
| non-secret completion-state persistence | `D2-32.5 non-secret completion-state persistence — the completion write stores the canonical record and no credential field` | `src/core/onboarding/onboardingStateStore.ts` · `writeOnboardingState` (`ONBOARDING_STORAGE_KEY`, six non-secret fields) | CORE-02 | `02-12-SUMMARY.md` D2 — suite B green (24 passed, 2026-09-24) |
| completion in one surface updating the other | `D2-32.6 completion in one surface updating the other — the joining surface flips through the change event and stays hidden as the next writer` | `src/core/onboarding/onboardingStateStore.ts` · `subscribeToOnboardingState` | CORE-02 | `02-12-SUMMARY.md` D2 — suite B green (24 passed, 2026-09-24) |
| update without a page reload | `D2-32.7 update without a page reload — the update arrives through chrome.storage.onChanged with both documents untouched` | `src/core/onboarding/onboardingStateStore.ts` · `subscribeToOnboardingState` over `chrome.storage.onChanged` | CORE-02 | `02-12-SUMMARY.md` D2 — suite B green (24 passed, 2026-09-24) |
| duplicate completion idempotency | `D2-32.8 duplicate completion idempotency — a repeated completion stores the same record and produces no second state` | `src/core/onboarding/onboardingStateStore.ts` · `writeOnboardingState` re-migrate + merge | CORE-02 | `02-12-SUMMARY.md` D2 — suite B green (24 passed, 2026-09-24) |
| cancellation | `D2-32.9 cancellation — an explicit incomplete state re-presents the flow on the next open` | `src/components/onboarding/OnboardingFlow.tsx` · `onSkip` → `writeOnboardingState({ uiComplete: false })` | CORE-02 | `02-12-SUMMARY.md` D2 — suite B green (24 passed, 2026-09-24) |
| recovery after one surface closes | `D2-32.10 recovery after one surface closes — a completion survives the closing document and reads back after a restart` | `src/core/onboarding/onboardingStateStore.ts` · `readOnboardingState` (durable record) | CORE-02 | `02-12-SUMMARY.md` D2 — suite B green (24 passed, 2026-09-24) |
| schema-version handling | `D2-32.11 schema-version handling — an unsupported version presents the flow rather than being accepted or discarded` | `src/core/onboarding/onboardingStateStore.ts` · `migrateOnboardingState` (v1 upgraded; other versions → `unknown`) | CORE-02 | `02-12-SUMMARY.md` D2 — suite B green (24 passed, 2026-09-24) |
| no false provider-ready state | `D2-32.12 no false provider-ready state — the fixture-backed completion claims no readiness anywhere it is recorded` | `src/components/onboarding/OnboardingFlow.tsx` fixture disclosure + `OnboardingState.validationBacking` | CORE-02 | `02-12-SUMMARY.md` D2 — suite B green (24 passed, 2026-09-24) |
| no real provider call | `D2-32.13 no real provider call — the fixture port performs no request and the validation is deterministic` | `src/services/fixtures/providerValidationFixtures.ts` · `createFixtureValidationPort` | CORE-02 | `02-12-SUMMARY.md` D2 — suite B green (24 passed, 2026-09-24) |
| fixture validation remains separate from credential-storage status | `D2-32.14 fixture validation remains separate from credential-storage status — validation success stores no credential` | `src/services/ports/providerValidationPort.ts` · `ProviderValidationPort` (no credential operation) | CORE-02 | `02-12-SUMMARY.md` D2 — suite B green (24 passed, 2026-09-24) |
| API-key input remains local to the originating presentation controller | `D2-32.15 API-key input remains local to the originating presentation controller — the sentinel stays in the field and crosses no boundary` | `src/components/onboarding/OnboardingFlow.tsx` · credential component state (D-08) | CORE-02 | `02-12-SUMMARY.md` D2/D3 — suite B green (24 passed, 2026-09-24) |
| no API key in workspace state | `D2-32.16 no API key in workspace state — both surface projections and the persisted workspace stay clean` | `src/core/workspace/WorkspaceState.ts` · `WorkspaceState` (no credential field) | CORE-02 | `02-12-SUMMARY.md` D3 — suite B green (24 passed, 2026-09-24) |
| no API key in BroadcastBus or RuntimeEnvelope | `D2-32.17 no API key in the broadcast bus or a runtime envelope — the flow publishes nothing and the strict envelope schema refuses the key` | `src/core/runtime/RuntimeEnvelopeValidation.ts` · `validateEnvelope` strict payload schemas | CORE-02 | `02-12-SUMMARY.md` D3 — suite B green (24 passed, 2026-09-24) |
| no API key in WriteJournal | `D2-32.18 no API key in the WriteJournal — the onboarding path journals nothing and every entry stays clean` | `src/core/storage/WriteJournal.ts` · no entry on the onboarding path | CORE-02 | `02-12-SUMMARY.md` D3 — suite B green (24 passed, 2026-09-24) |
| no API key in general chrome.storage data | `D2-32.19 no API key in general chrome.storage data — every stored key and value stays clean` | `src/core/onboarding/onboardingStateStore.ts` · `writeOnboardingState` (one key) | CORE-02 | `02-12-SUMMARY.md` D3 — suite B green (24 passed, 2026-09-24) |
| no API key in logs, diagnostics, errors, snapshots or evidence | `D2-32.20 no API key in logs, diagnostics, errors, snapshots or evidence — the ring buffer and a real redacted error record stay clean` | `src/core/log/debugLog.ts` · `debugLog` ring buffer + `src/core/storage/ErrorStore.ts` · `recordError` redaction | CORE-02 | `02-12-SUMMARY.md` D3 — suite B green (24 passed, 2026-09-24) |
| synthetic credentials reach CredentialStorePort only in tests that explicitly exercise the vault contract | `D2-32.21 synthetic credentials reach the credential port only in vault-contract tests — the onboarding flow is fixture-backed and stores no credential` | `src/services/ports/credentialStorePort.ts` · `createCredentialStorePort` + `src/core/security/KeyVault.ts` · `createKeyVault` (direct authorised adapter only) | CORE-02 | `02-12-SUMMARY.md` D4 — suite B green (24 passed, 2026-09-24) |
| onboarding UI completion remains distinct from credential stored / credential validated / provider ready | `D2-32.22 onboarding UI completion remains distinct from credential stored, credential validated and provider ready — the four facts are separate and only the first is true` | `src/core/onboarding/onboardingStateStore.ts` · `OnboardingState` (the four D-06 facts) | CORE-02 | `02-12-SUMMARY.md` D2 — suite B green (24 passed, 2026-09-24) |

The suite's traceability case (`D2-32.23 traceability — the suite declares exactly one named case per D2-32 clause`, evidence `02-12-SUMMARY.md` coverage D2) proves every clause row above cites a case name that literally exists in the file, and the D2-33 vault-boundary case (`credential boundary — a synthetic credential round-trips through the real port over a KeyVault-backed adapter and nowhere else`, evidence `02-12-SUMMARY.md` coverage D4) is the suite's own credential boundary case, not a WINDOW #8 clause row.

### Outcome (D2-35)

- **Phase 2 automated contract coverage = PASS** — suite A (23 passed) and suite B (24 passed), both runnable alone and together (`npx vitest run tests/integration` → 2 files / 47 passed, observed 2026-09-24).
- **Phase 15 Real-Chrome acceptance = still deferred** — neither suite observes a real Chrome session; the deferred final observations for #5 and #8 remain with the Phase 15 consolidated cycle (and #7 with it).
- **Phase 19 release gate must fail while the human observation remains open** — WINDOWS #5 and #8 stay `open` in `.planning/WINDOWS.md`; nothing in this record marks either window fixed or waived.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [ ] `nyquist_compliant` set `false` in frontmatter pending plan 02-14 Task 3's fresh re-runs; restored to `true` by that task (see the frontmatter comment)

**Approval:** Phase close observed 2026-09-24 (plan 02-13) — `pnpm run build:ext` then `pnpm run verify:phase-2` green (25 files / 441 tests), `pnpm run verify:phase-1` green (55 files / 835 tests), `scripts/verify-no-tailwind.sh` clean and the built manifest carrying exactly the four authorised permissions with `connect-src 'none'`. **Correction (plan 02-14, 2026-09-24):** the `verify:phase-1` green claim was valid at 02-13 execution but was observed stale on re-run — the Phase-1 case was a comment-blind substring scan and the review-fix doc comment at `src/core/security/KeyVault.ts:33` counted as a call site (`02-VERIFICATION.md` gap 1); it is replaced by the fresh observations in `02-14-SUMMARY.md`. The Manual-Only 400 px backstop row stays outstanding (Phase 15 cycle); `status: validated` remains with `/gsd-validate-phase` per the declared lifecycle; WINDOWS #5, #7 and #8 stay `open`.
