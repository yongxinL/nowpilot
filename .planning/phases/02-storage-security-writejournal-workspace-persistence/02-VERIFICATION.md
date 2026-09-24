---
phase: 02-storage-security-writejournal-workspace-persistence
verified: 2026-09-24T11:52:00Z
status: passed
score: 119/122 must-haves verified
covered_files:
  - ".planning/STATE.md"
  - ".planning/WINDOWS.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-01-PLAN.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-01-SUMMARY.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-02-PLAN.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-02-SUMMARY.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-03-PLAN.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-03-SUMMARY.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-04-PLAN.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-04-SUMMARY.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-05-PLAN.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-05-SUMMARY.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-06-PLAN.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-06-SUMMARY.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-07-PLAN.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-07-SUMMARY.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-08-PLAN.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-08-SUMMARY.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-09-PLAN.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-09-SUMMARY.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-10-PLAN.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-10-SUMMARY.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-11-PLAN.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-11-SUMMARY.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-12-PLAN.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-12-SUMMARY.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-13-PLAN.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-13-SUMMARY.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-14-PLAN.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-14-SUMMARY.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-UAT.md"
  - ".planning/phases/02-storage-security-writejournal-workspace-persistence/02-VALIDATION.md"
  - "package.json"
  - "pnpm-lock.yaml"
  - "src/components/common/MirrorBanner.tsx"
  - "src/components/common/Phase2Notices.tsx"
  - "src/components/onboarding/OnboardingFlow.tsx"
  - "src/components/sidepanel/SidePanelShell.tsx"
  - "src/components/standalone/StandaloneShell.tsx"
  - "src/core/i18n/strings.ts"
  - "src/core/onboarding/onboardingStateStore.ts"
  - "src/core/onboarding/useOnboardingGate.ts"
  - "src/core/security/EncryptedStorage.ts"
  - "src/core/security/KeyVault.ts"
  - "src/core/security/redactSensitive.ts"
  - "src/core/storage/ChatHistoryDB.ts"
  - "src/core/storage/ErrorStore.ts"
  - "src/core/storage/IndexedDBMigrator.ts"
  - "src/core/storage/NowPilotDB.ts"
  - "src/core/storage/Setting.ts"
  - "src/core/storage/WriteJournal.ts"
  - "src/core/storage/legacyChatMigration.ts"
  - "src/core/storage/npStoreWriteGuard.ts"
  - "src/core/theme/chromeStorageAdapter.ts"
  - "src/core/workspace/WorkspacePersistence.ts"
  - "src/core/workspace/WorkspaceStore.ts"
  - "src/core/workspace/WriterElection.ts"
  - "src/core/workspace/workspaceRuntime.ts"
  - "src/entrypoints/background.ts"
  - "src/entrypoints/sidepanel/main.tsx"
  - "src/entrypoints/standalone/main.tsx"
  - "src/services/ports/credentialStorePort.ts"
  - "src/store/useExtensionStore.ts"
  - "tests/components/MirrorBanner.test.tsx"
  - "tests/components/OnboardingFlow.test.tsx"
  - "tests/components/Phase2Notices.test.tsx"
  - "tests/components/SidePanelShell.test.tsx"
  - "tests/components/StandaloneShell.test.tsx"
  - "tests/core/i18n/strings.test.ts"
  - "tests/core/onboarding/onboardingStateStore.test.ts"
  - "tests/core/security/EncryptedStorage.test.ts"
  - "tests/core/security/KeyVault.test.ts"
  - "tests/core/security/credentialStorePort.test.ts"
  - "tests/core/security/redactSensitive.test.ts"
  - "tests/core/storage/ChatHistoryDB.test.ts"
  - "tests/core/storage/ErrorStore.test.ts"
  - "tests/core/storage/IndexedDBMigrator.test.ts"
  - "tests/core/storage/NowPilotDB.test.ts"
  - "tests/core/storage/Setting.test.ts"
  - "tests/core/storage/WriteJournal.test.ts"
  - "tests/core/storage/chromeStorageAdapter.test.ts"
  - "tests/core/storage/legacyChatMigration.test.ts"
  - "tests/core/storage/npStoreWriteGuard.test.ts"
  - "tests/core/store/useExtensionStore.test.ts"
  - "tests/core/theme/ThemeSync.test.tsx"
  - "tests/core/workspace/WorkspacePersistence.test.ts"
  - "tests/core/workspace/WorkspaceRouter.test.ts"
  - "tests/core/workspace/WorkspaceStore.test.ts"
  - "tests/core/workspace/WriterElection.test.ts"
  - "tests/core/workspace/workspaceRuntime.test.ts"
  - "tests/harness/twoSurface.ts"
  - "tests/integration/onboardingTwoSurface.integration.test.ts"
  - "tests/integration/workspaceHandoff.integration.test.ts"
  - "tests/isolation/background-no-indexeddb.test.ts"
  - "tests/isolation/credential-boundary.test.ts"
  - "tests/isolation/generated-manifest.test.ts"
  - "tests/setup.ts"
  - "wxt.config.ts"
covered_digest: "v1:sha256:73d9ba7eeef7e5c48008484dabc1789575c1e5bebc8e129616401f6a10cceb34"
behavior_unverified: 2
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 119/122
  gaps_closed: []
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "Journal entries are bounded: every non-terminal entry is retained, terminal entries are compacted to a bounded newest set, and the attempt counter increments per attempt (02-02, still partial in production)."
    addressed_in: "Phase 19 release gate (re-check point) — implementation owner: the future journal-retention plan (WINDOWS #25)"
    evidence: "WINDOWS #25 stays `open` with the eight-field retention contract (enriched by 02-14): status implemented-but-unwired; `compactJournal()` (`src/core/storage/WriteJournal.ts:380`, `JOURNAL_TERMINAL_ENTRY_LIMIT = 50`) is unit-proved but has no production caller; field 8: 'the row stays open and must be re-checked at the Phase 19 release gate, and it must never be marked production-active, fixed or waived until those tests exist and pass'. Formerly gap 2 of the pre-02-14 report — NOT fixed, NOT waived, NOT closed. Excluded from the verified score."
  - truth: "At a 400 px Side Panel width the MirrorBanner bar grows rather than clipping, the caption wraps to at most two lines then ellipsizes, and the action never wraps or clips (02-09 backstop)."
    addressed_in: "Phase 15 consolidated Real-Chrome acceptance cycle (WINDOWS #27)"
    evidence: "Operator disposition 2026-09-24 recorded in `02-UAT.md` test 1 as `result: skipped` with reason: deferred to Phase 15 — WINDOWS #27; closure = Real-Chrome observation at 400 px; expiry = before the Phase 19 release gate. WINDOWS.md id 27 stays `open` with owner, closure condition and evidence requirement; STATE.md § Verification Deferrals § WINDOWS #27. Never observed, never `fixed`, never waived."
  - truth: "At 400 px the capability Alert body and the storage notifications wrap with no horizontal scroll and no mid-glyph clipping (02-10 backstop)."
    addressed_in: "Phase 15 consolidated Real-Chrome acceptance cycle (WINDOWS #27)"
    evidence: "Operator disposition 2026-09-24 recorded in `02-UAT.md` test 2 as `result: skipped` with reason: deferred to Phase 15 — WINDOWS #27; closure = Real-Chrome observation at 400 px; expiry = before the Phase 19 release gate. WINDOWS.md id 27 stays `open`; STATE.md § Verification Deferrals § WINDOWS #27. Never observed, never `fixed`, never waived."
advisory: []
behavior_unverified_items:
  - truth: "At a 400 px Side Panel width the MirrorBanner bar grows rather than clipping, the caption wraps to at most two lines then ellipsizes, and the action never wraps or clips (02-09 backstop)."
    test: "Open the Side Panel at 400 px with the writer state `mirror`."
    expected: "The bar grows (min-height 32 px, no fixed height), the caption wraps to at most two lines then ellipsizes, and the action neither wraps nor clips."
    why_human: "jsdom cannot observe layout. The mechanism is asserted (`bar.style.minHeight === '32px'`, `bar.style.height === ''`, action nowrap, caption clamp) but the rendered behaviour at 400 px has no explicit evidence; the verifier abstains (`insufficient_spec`). Operator disposition 2026-09-24 (`02-UAT.md` test 1, `result: skipped` with reason) turns this from an unresolved human item into a recorded deferral: WINDOWS #27, owner Phase 15 consolidated Real-Chrome cycle, closure = Real-Chrome observation at 400 px with screenshot + observed-result record, expiry before the Phase 19 release gate. Not a Phase-2 blocker; never a silent pass."
  - truth: "At 400 px the capability Alert body and the storage notifications wrap with no horizontal scroll and no mid-glyph clipping (02-10 backstop)."
    test: "At 400 px, render the onboarding credential-step capability Alert and trigger a storage/election notice."
    expected: "Body text and notification wrap with no horizontal scroll and no mid-glyph clipping."
    why_human: "Same jsdom limitation; the verifier abstains (`insufficient_spec`). Operator disposition 2026-09-24 (`02-UAT.md` test 2, `result: skipped` with reason) records it as a deferral: WINDOWS #27, owner Phase 15 consolidated Real-Chrome cycle, closure = Real-Chrome observation at 400 px, expiry before the Phase 19 release gate. Not a Phase-2 blocker; must not be treated as closed."
---

# Phase 2: Storage, Security, WriteJournal, Workspace Persistence Verification Report

**Phase Goal:** Durable, encrypted, crash-safe storage foundation — keys encrypted, message bodies only in IndexedDB, migrations idempotent, writes journaled, workspace persistent across reloads and surfaces.
**Verified:** 2026-09-24T11:52:00Z
**Status:** passed
**Re-verification:** Yes — final re-verification after the operator UAT disposition (2026-09-24). No production or test code changed since the previous verification (`76038e4d`).

## What changed since the last verification (2026-09-24T11:18:03Z)

- **No `src/` or `tests/` change.** `git diff --name-only 76038e4d..HEAD -- src/ tests/` is empty (HEAD `775631aa`). The only changes in the range are planning records: `.planning/STATE.md` (§ Verification Deferrals § WINDOWS #27), `.planning/WINDOWS.md` (id 27 appended `open`; counters open 20 / waived 0 / fixed 7 / total 27), the new `.planning/.../02-UAT.md` (recorded disposition) and the previous `02-VERIFICATION.md` itself (commits `590b386e`, `775631aa`).
- **The covered-input fingerprint was stale and is now fresh.** Recomputing the previous report's own declared covered-input set against current bytes yields `v1:sha256:078453ae76db87e7bca9bc8f0e4c9808debfd446ffc0b63736166f1acc663d4b` ≠ its declared `v1:sha256:7db5b89b…`, so the phase read `stale`. This report recomputes the fingerprint over the same covered inputs **plus the new `02-UAT.md`** (the disposition is now a covered input): current digest `v1:sha256:73d9ba7eeef7e5c48008484dabc1789575c1e5bebc8e129616401f6a10cceb34`, verified resolvable at write time.
- **Status transition: `human_needed` → `passed`, by the recorded zero-issue UAT disposition — not by waiving anything.** `02-UAT.md` is `status: complete` with `passed: 0 · issues: 0 · pending: 0 · skipped: 2 · blocked: 0`; both 400 px items are `result: skipped` **with reasons** (operator decision 2026-09-24: deferred to the Phase 15 consolidated Real-Chrome cycle as WINDOWS #27, recorded in `STATE.md` § Verification Deferrals and `WINDOWS.md` id 27). The two backstop truths therefore become recorded deferrals with a named owner (they were never resolved as human items and are not silently passed) and are carried below in `deferred:` **and** `behavior_unverified_items:`. This is the UAT disposition the verify-work path consumes.
- **WINDOWS #5/#7/#8/#25/#26/#27 all remain `open`** and no document claims otherwise (check re-run this pass — every ledger row unstructured and structured is `open`/`resolved_at: null`; counters 20/0/7/27). WINDOWS #25 (`compactJournal` unwired), #26 (CR-01 follow-up) and #27 (400 px backstops) remain open deferrals; CR-02 remains operator-accepted under D2-34. Nothing was waived, nothing was marked fixed.

## Post-UAT operator disposition (2026-09-24)

| Item | Recorded result | Owner / contract | Closure condition | Expiry |
|------|-----------------|------------------|-------------------|--------|
| 02-09 MirrorBanner 400 px backstop | `skipped` with reason (`02-UAT.md` test 1) | Phase 15 consolidated Real-Chrome cycle — WINDOWS #27 (`open`) | Real-Chrome observation at a 400 px Side Panel width: bar grows from `min-height: 32px`, caption wraps to ≤2 lines then ellipsizes, action never wraps/clips — screenshot + written observed-result | Before the Phase 19 release gate |
| 02-10 capability Alert + storage notifications 400 px backstop | `skipped` with reason (`02-UAT.md` test 2) | Phase 15 consolidated Real-Chrome cycle — WINDOWS #27 (`open`) | Real-Chrome observation at 400 px: body text and notifications wrap with no horizontal scroll and no mid-glyph clipping — screenshot + written observed-result | Before the Phase 19 release gate |
| CR-01 (metadata-hold trade) | Acknowledged and scheduled — `02-14-SUMMARY.md` § Operator acknowledgement | WINDOWS #26 (`open`); owner = earliest approved gap-closure/storage-hardening plan that may modify the store write guard (default Phase 19) | The ten acceptance criteria recorded verbatim in `02-14-SUMMARY.md` | Before v0.2 release acceptance |
| CR-02 (mirror-persists-on-promotion reading) | Accepted as designed under D2-34 (status accepted; severity low; no follow-up; not waived, not a defect) | Operator decision 2026-09-24 | n/a — accepted, not a gap | n/a |

The two skipped items stay in `deferred:` and in `behavior_unverified_items:`; the abstention is explicit and the phase status is `passed` because the deferred items do not affect status determination (Step 9b) and no unresolved human item remains after the disposition.

## Fresh gate runs (this verification, HEAD `775631aa`, clean tracked tree)

| # | Command | Observed | Exit |
|---|---------|----------|------|
| 1 | `pnpm run build:ext` | manifest emitted (882 ms; `manifest.json` 796 B); total bundle 1.99 MB | **0** |
| 2 | `pnpm run verify:phase-2` | `verify:phase-2: 24 declared path(s) resolve` · Test Files **29 passed (29)** · Tests **490 passed (490)** · `credential-boundary.test.ts (18 tests)` collected | **0** |
| 3 | `pnpm run verify:phase-1` | `verify:phase-1: 15 declared path(s) resolve` · Test Files **59 passed (59)** · Tests **886 passed (886)** · `credential-boundary.test.ts (18 tests)` + `providerValidationFixtures.test.ts (18 tests)` collected · `verify-no-tailwind: 0 Tailwind utility strings in src` | **0** |

No source or test edit occurred between the runs; the counts match the previous verification exactly (both suites unchanged). The only input changes since are the planning records listed above.

## Goal Achievement

### ROADMAP Success Criteria (the phase contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | WriteJournal recovery test passes — an interrupted write recovers to a consistent state | ✓ VERIFIED | `tests/core/storage/WriteJournal.test.ts` green in this pass's gate: *"replays an interrupted applying entry idempotently, leaving exactly one destination record"* (line 150), *"replays a pending entry on the next start"* (line 197), *"rolls back the applied steps in reverse order and lands as rolled-back"* (line 225). Production call site confirmed unchanged: `defaultRecoverJournal()` → `recoverJournal()` (`src/store/useExtensionStore.ts:208-209, 232`), reached by both surface roots via `hydrateChatHistory()` (line 406). |
| SC2 | API key encryption round-trip passes (AES-GCM per §15.2); no message body appears in `chrome.storage.local` | ✓ VERIFIED | `EncryptedStorage.test.ts`, `KeyVault.test.ts`, `ChatHistoryDB.test.ts` and `npStoreWriteGuard.test.ts` all green in this pass's gate. §15.2 derivation constants present: `PBKDF2 → SHA-256`, 100000 iterations, AES-GCM-256 (`src/core/security/EncryptedStorage.ts:14-15, 55, 61, 65, 71, 81-82`). Body-absence assertions with a non-vacuity self-test (`ChatHistoryDB.test.ts:147-160`: sentinel absent from `serialiseStorage(localMap())` and `sessionMap()`, then planted and found). `PERSISTED_BLOB_FIELDS = NP_STORE_V3_FIELDS = ['config','prompts','writeHistory','notes']` (`src/store/useExtensionStore.ts:940`, `src/core/storage/legacyChatMigration.ts:97`) — no conversation collection, no `activeSessionId`, no excerpt. |
| SC3 | Migration v1→v2 fixture passes; IndexedDB writes use single transactions for consistent stores | ✓ VERIFIED | `IndexedDBMigrator.test.ts` green in this pass's gate: *"the test-only v1→v2 fixture adds a store without editing the Phase 2 migration"* (line 158); production table is exactly `MIGRATIONS = [v1InitialPhase2Stores]` (`src/core/storage/IndexedDBMigrator.ts:158, 183`). Single transaction + authoritative `readonly` read-back in `ChatHistoryDB.writeConversationWithMessages` (line 195) unchanged. |
| SC4 | Workspace state persists across page reload and cross-surface handoff; `pnpm run verify:phase-2` passes | ✓ VERIFIED | `WorkspacePersistence.test.ts`, `workspaceRuntime.test.ts`, `WriterElection.test.ts`, `workspaceHandoff.integration.test.ts` all green in this pass's gate; both roots call `startWorkspaceRuntime()` (`sidepanel/main.tsx:135`, `standalone/main.tsx:131`). Gate: **24 paths resolve · 29 files / 490 tests passed, exit 0** (re-run this pass). |

**Score: 4/4 ROADMAP success criteria verified.**

### PLAN must-haves rollup (122 truths across 14 plans)

| Plan | Truths | Verified | Failed | Partial/Uncertain | Behavior-unverified | Key evidence |
|------|--------|----------|--------|-------------------|---------------------|--------------|
| 02-01 | 5 | 5 | 0 | 0 | 0 | `tests/setup.ts` `fake-indexeddb/auto`, `__resetIndexedDB()`, session area + shared `onChanged`; `idb`/`fake-indexeddb` in `package.json`; `wxt.config.ts` `unlimitedStorage`; `generated-manifest.test.ts` `AUTHORISED_PERMISSIONS` in the same change |
| 02-02 | 10 | 9 | 0 | 1 | 0 | `np_db` v1 + 4 stores; no-op re-open; typed unsupported-version; single-tx + read-back; integer `[sessionId, seq]` ordering; journal replay idempotent; strict Zod. **Partial:** journal bounding has no production call site (WINDOWS #25, deferred) |
| 02-03 | 10 | 10 | 0 | 0 | 0 | PBKDF2 100000/SHA-256 → AES-GCM-256, non-extractable; golden derivation-input test; fresh 16-byte salt + 12-byte IV per op; versioned strict envelope bound into AAD; one indistinguishable fail-closed code; single frozen redaction list |
| 02-04 | 7 | 7 | 0 | 0 | 0 | Port ops exactly store/replace/retrieve/isConfigured/delete/inspectEnvelopeVersion; no `src/components/**` import of `KeyVault`/`EncryptedStorage`/port; blank input rejected typed; `readInstallSecret()` read-back-verified; fail-closed on malformed secret |
| 02-05 | 9 | 9 | 0 | 0 | 0 | 7 stages in fixed order; sanitisation removes bodies; restart-safe replay; deterministic ids; quarantine by safe id; `ErrorStore` cap 100 + redaction + idempotent resolve |
| 02-06 | 11 | 11 | 0 | 0 | 0 | `np_workspace` via debounced adapter; strictly-greater version + tie by stored version; §20.3 order (journal → key → narrow signal → completed); signal carries only `{workspaceId, conversationId}`; election record direct to `chrome.storage.session` with read-back; stale-writer rejection; Standalone tie-break; canonical 5-state projection |
| 02-07 | 8 | 8 | 0 | 0 | 0 | Election-backed writer state; frozen mirror vocabulary; `MirrorBanner` renders only on `mirror`; canonical caption + `Refocus here` + a11y name; `role="status"`/`aria-live="polite"`; single onboarding controller; 9 string keys present |
| 02-08 | 9 | 9 | 0 | 0 | 0 | `NP_STORE_SCHEMA_VERSION = 3`; `projectNpStoreV3` allow-list; hydration status ids exactly `idle|hydrating|ready|empty|failed|recovery required`; `empty` only from a successful empty read; no legacy fallback; partial migration |
| 02-09 | 8 | 7 | 0 | 0 | 1 | Hydration-driven region (`Skeleton`, not `Spin`); no `data-np-backing`; banner once above the region; non-optimistic `requestRefocus()`; full caption as text content. **Backstop:** 400 px visual observation → recorded deferral WINDOWS #27 (Phase 15) |
| 02-10 | 11 | 10 | 0 | 0 | 1 | Startup sequence in both roots; `ANT_MESSAGE_CONFIG = { maxCount: 3, duration: 5 }`; `Phase2Notices` with 3 persistent keyed notices; capability `Alert` verbatim; Options disabled; stable keys. **Backstop:** 400 px wrapping → recorded deferral WINDOWS #27 (Phase 15) |
| 02-11 | 8 | 8 | 0 | 0 | 0 | `tests/harness/twoSurface.ts` real implementations + injected loopback transport; Suite A maps D2-31.1–22 one test per clause; sentinel absence across URL/envelopes/journal/error store/log; restart/crash simulation |
| 02-12 | 10 | 10 | 0 | 0 | 0 | Suite B maps D2-32.1–23; exactly one presentation; idempotent completion; cancellation/recovery; schema-version honesty; no false readiness; no provider call; API-key locality across 6 surfaces; D2-35 traceability; WINDOWS #5/#8 stay `open` |
| 02-13 | 8 | 8 | 0 | 0 | 0 | **Gap 1 resolved (02-14):** `verify:phase-2` names every live suite + self-derived preflight; `verify:phase-1` exits 0 (59 files / 886 tests) with the corrected gate collected; stale claims corrected, history preserved; windows stay open; D2-29 owner recorded |
| 02-14 | 8 | 8 | 0 | 0 | 0 | Scope-aware credential-boundary gate (8 negative + 5 positive controls + 5 real-tree assertions, all green); Phase-1 case restated scope-aware/comment-stripped; both gates re-observed exit 0 (this pass: gate collected by both); records honest; WINDOWS #25 open with the retention contract; CR-01/CR-02 operator disposition recorded, nothing waived |
| **Total** | **122** | **119** | **0** | **1** | **2** | |

**Score: 119/122 must-haves verified** (0 failed · 1 partial/WARNING · 2 present, behavior-unverified). The partial (02-02 journal bounding) and the two behavior-unverified backstops are excluded from the verified count; the first is the open WINDOWS #25 deferral and the latter two are the recorded WINDOWS #27 deferrals.

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases (informational; do not require closure plans).

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | 02-02 journal bounding in production — `compactJournal()` unwired (WINDOWS #25, `open`) | Phase 19 release gate (re-check); implementation owner: the future journal-retention plan | WINDOWS #25 field 8: *"the row stays open and must be re-checked at the Phase 19 release gate, and it must never be marked production-active, fixed or waived until those tests exist and pass"*; 02-14 explicitly does not wire it. **Formerly gap 2 — NOT fixed, NOT waived, NOT closed.** |
| 2 | 02-09 MirrorBanner 400 px backstop (human observation) | Phase 15 consolidated Real-Chrome cycle — WINDOWS #27 | `02-UAT.md` test 1 `result: skipped` with reason (operator decision 2026-09-24); WINDOWS.md id 27; STATE.md § Verification Deferrals § WINDOWS #27 |
| 3 | 02-10 capability Alert + notices 400 px backstop (human observation) | Phase 15 consolidated Real-Chrome cycle — WINDOWS #27 | `02-UAT.md` test 2 `result: skipped` with reason (operator decision 2026-09-24); WINDOWS.md id 27; STATE.md § Verification Deferrals § WINDOWS #27 |

### Advisory (New Scope, Unevidenced)

None — this re-verification raised no new-scope finding without deterministic evidence.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/storage/NowPilotDB.ts` | `DB_NAME`/`DB_VERSION`/`getDb`/`closeDb` | ✓ VERIFIED | `runMigrations` inside `openDB`'s `versionchange` tx, abort on failure |
| `src/core/storage/IndexedDBMigrator.ts` | migrations + result | ✓ VERIFIED | `MIGRATIONS = [v1InitialPhase2Stores]` only (line 183) |
| `src/core/storage/ChatHistoryDB.ts` | journaled write/read-back | ✓ VERIFIED | one `readwrite` tx + `readonly` read-back |
| `src/core/storage/WriteJournal.ts` | schema/`runJournaled`/`recoverJournal`/`compactJournal` | ✓ VERIFIED (1 warning) | `recoverJournal` wired via `defaultRecoverJournal`; `compactJournal` exported + unit-proved but **no production caller** — WINDOWS #25 open (deferred, not fixed) |
| `src/core/storage/ErrorStore.ts` | bounded redacted store | ✓ VERIFIED | cap 100, same-tx eviction |
| `src/core/storage/legacyChatMigration.ts` | 7-stage migration | ✓ VERIFIED | `projectNpStoreV3` single owner |
| `src/core/storage/Setting.ts` | install-secret lifecycle | ✓ VERIFIED | `SettingResult` union matches `KeyVault` injection exactly |
| `src/core/storage/npStoreWriteGuard.ts` | pre-v3 write hold | ✓ VERIFIED | CR-01 regression suite in the gate |
| `src/core/security/EncryptedStorage.ts` | envelope codec | ✓ VERIFIED | codec green in the gate; §15.2 constants present |
| `src/core/security/KeyVault.ts` | create/replace/retrieve/… | ✓ VERIFIED | doc comment intact (IN-05 pin, `grep -c 'CredentialStorePort'` = 1) and correctly not a violation |
| `src/core/security/redactSensitive.ts` | single choke point | ✓ VERIFIED | imported by `KeyVault`, `Setting`, `ErrorStore` |
| `src/services/ports/credentialStorePort.ts` | port contract | ✓ VERIFIED | no `src/components/**` import |
| `src/core/workspace/{WorkspacePersistence,WriterElection,workspaceRuntime,WorkspaceStore}.ts` | journaled version-ordered writes, CAS/heartbeat, composition | ✓ VERIFIED | all green in the gate; wired in both entrypoints |
| `src/components/{common/MirrorBanner,common/Phase2Notices,onboarding/OnboardingFlow,sidepanel/SidePanelShell,standalone/StandaloneShell}.tsx` | canonical UI surfaces | ✓ VERIFIED | green in the gate |
| `src/store/useExtensionStore.ts` | v3 projection + hydration | ✓ VERIFIED | green in the gate |
| `src/core/i18n/strings.ts`, `src/core/onboarding/{useOnboardingGate,onboardingStateStore}.ts` | keys + writer-gated flow | ✓ VERIFIED | 9 Phase-2 keys present verbatim |
| `tests/isolation/credential-boundary.test.ts` (new, 02-14) | the corrected cross-phase credential-boundary gate | ✓ VERIFIED | 18 tests collected by **both** gates this pass; 8 negative controls + 5 positive controls + 5 real-tree assertions; no debt markers |
| `tests/services/providerValidationFixtures.test.ts` (restated, 02-14) | the Phase-1-surface case, scope-aware + comment-stripped + non-vacuity | ✓ VERIFIED | 18/18 pass; collected by `verify:phase-1`; asserts canonical-module existence and zero imports/mentions across the four Phase-1 surfaces |
| `02-UAT.md` (new, this pass) | the recorded operator disposition of the two 400 px backstop items | ✓ VERIFIED | `status: complete`; both items `result: skipped` **with reason** (Phase 15 / WINDOWS #27); `issues: 0`; `## Gaps: None` |
| `package.json` | corrected `verify:phase-2` | ✓ VERIFIED | 24 paths, preflight has teeth; path list carries `tests/isolation` |
| `.planning/{STATE,WINDOWS}.md`, `02-VALIDATION.md`, `02-13-SUMMARY.md` | phase record | ✓ VERIFIED | fresh claims match this re-run; WINDOWS #5/#7/#8/#25/#26/#27 all `open`; no document claims them closed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `credential-boundary.test.ts` | `verify:phase-1` + `verify:phase-2` | `tests/isolation` directory token in both scripts | ✓ WIRED | observed in both runs this pass (`credential-boundary.test.ts (18 tests)` in each) |
| `NowPilotDB.getDb` | `IndexedDBMigrator.runMigrations` | `openDB` versionchange `tx` | ✓ WIRED | failure aborts |
| `ChatHistoryDB` write | `readonly` read-back | only-then success | ✓ WIRED | unchanged |
| `WriteJournal.persist` | `entries` store of the same handle | `runJournaled` | ✓ WIRED | `WorkspacePersistence` uses the real `np_db` journal store |
| `useExtensionStore.npStoreMigrate` | `projectNpStoreV3` (02-05) | import, not restatement | ✓ WIRED | unchanged |
| `useExtensionStore` `np_store` adapter | `npStoreWriteGuard` | `npStoreStorage` | ✓ WIRED | unchanged |
| `KeyVault.readInstallSecret` | `Setting.readInstallSecret()` | structural union, no adapter | ✓ WIRED | unchanged |
| `WorkspacePersistence` | `chromeStorageAdapter` | debounced (correct here) | ✓ WIRED | `flushPendingWrite` lands the key before the signal |
| `WriterElection` | `chrome.storage.session` | direct, not debounced | ✓ WIRED | unchanged |
| `WorkspaceStore` | `ElectionOutcome` (02-06) | store consumes the outcome | ✓ WIRED | no plan re-derives writer state |
| `workspaceRuntime` | both surface roots | `startWorkspaceRuntime()` | ✓ WIRED | `sidepanel/main.tsx:135`, `standalone/main.tsx:131` |
| `Phase2Notices` | `subscribeToElectionFailure` (02-09) | notice source | ✓ WIRED | unchanged |
| `SidePanelShell` | `useWorkspaceStore.writerState` | banner gating | ✓ WIRED | renders only on `mirror` |
| `hydrateChatHistory` | `defaultRecoverJournal` → `recoverJournal` | startup order | ✓ WIRED | `useExtensionStore.ts:208, 232, 406` |
| `redactSensitive` | `KeyVault` / `Setting` / `ErrorStore` | single choke point | ✓ WIRED | three import sites |
| `KeyVault.ts` doc comment | `CredentialStorePort` name | **not** a link (prose) | ✓ WIRED (correctly ignored) | comment-stripped; IN-05 regression pin asserts the comment stays and is not a violation |
| `02-UAT.md` | WINDOWS #27 + STATE.md § Verification Deferrals | recorded disposition | ✓ WIRED | the skipped-with-reason items carry owner, closure condition and expiry in all three records |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SidePanelShell` conversation region | `hydrationStatus` + hydrated projection | `hydrateChatHistory()` → `runLegacyChatMigration` → `ChatHistoryDB` reads | Yes (real IndexedDB reads; no static fallback) | ✓ FLOWING |
| `MirrorBanner` visibility | `writerState` | `WriterElection` → `WorkspaceStore` | Yes (election record read-back) | ✓ FLOWING |
| `Phase2Notices` | store error state + `subscribeToElectionFailure` | typed failure codes / election channel | Yes | ✓ FLOWING |
| `workspaceRuntime` persistence | `snapshot()` | `useWorkspaceStore` state | Yes (journaled write + read-back) | ✓ FLOWING |
| `useExtensionStore` `np_store` | `PERSISTED_BLOB_FIELDS` | allow-listed projection | Yes (bodies by construction excluded) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase gate end to end | `pnpm run build:ext && pnpm run verify:phase-2` | exit 0 · manifest emitted (882 ms, 796 B) · 24 paths resolve · 29 files / 490 tests passed | ✓ PASS |
| Cross-phase gate | `pnpm run verify:phase-1` | exit 0 · 15 paths resolve · 59 files / 886 tests passed · tailwind clean | ✓ PASS |
| Corrected boundary gate in both gates | log grep `credential-boundary.test.ts` | `(18 tests)` collected and green in both phase gates | ✓ PASS |
| Restated Phase-1 case | log grep `providerValidationFixtures.test.ts` | `(18 tests)` green in `verify:phase-1` | ✓ PASS |
| Built manifest least privilege | read `.output/chrome-mv3/manifest.json` | `permissions ["sidePanel","storage","tabs","unlimitedStorage"]`, `connect-src 'none'`, no `content_scripts` | ✓ PASS |
| IN-05 comment not trimmed | `grep -c 'CredentialStorePort' src/core/security/KeyVault.ts` | `1` (comment intact; pinned by the gate) | ✓ PASS |
| No production change in gap range | `git diff --name-only 76038e4d..HEAD -- src/ tests/` | empty (0 files) | ✓ PASS |
| No presentation-side vault reach | `grep -rn "KeyVault\|EncryptedStorage\|credentialStorePort" src/components/` | 0 matches | ✓ PASS |
| No `Requester`/`RateLimiter` in production | `grep -rn "Requester\|RateLimiter" src/` | comments only (Phase-3 ownership notes) | ✓ PASS |
| No MemoryDB/NotesDB in production | `grep -rn -i "MemoryDB\|NotesDB" src/` | no matches | ✓ PASS |
| No forbidden success strings | `grep -rn -iE "credentialStored\|providerConnected\|providerValidated\|providerReady\|migrationComplete" src/` | no matches | ✓ PASS |
| Debt markers (`TBD`/`FIXME`/`XXX`) in covered `src/` files | grep over the covered src file list | no matches | ✓ PASS |
| WINDOWS #5/#7/#8/#25/#26/#27 open | ledger rows (table + JSON) + counters | all `open`, `resolved_at: null`; counters 20 open / 0 waived / 7 fixed / 27 total; no closure claim in any document | ✓ PASS |
| PRODUCT_SPEC untouched in range | `git diff --name-only 6629ef65..HEAD -- PRODUCT_SPEC.md` | empty | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| (none declared) | `find scripts -path '*/tests/probe-*.sh'` + PLAN/SUMMARY probe grep | 0 probes — no probe contract in any Phase 2 PLAN/SUMMARY | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CORE-02 | All 14 plans declare `requirements: [CORE-02]` (14/14, including the 02-14 gap-closure plan) | Storage/security foundation — encrypted keys, IndexedDB stores, WriteJournal, idempotent migrations, workspace persistence — §15, §16, §20; §18 Phase 2 DONE-when | ✓ SATISFIED | All four ROADMAP success criteria verified above; both phase gates green from one code state (`775631aa`, no code change since `76038e4d`); `REQUIREMENTS.md` row `| CORE-02 | Phase 2 | Complete |` |

**Orphaned requirements:** none — `REQUIREMENTS.md` maps only CORE-02 to Phase 2 and every plan claims it.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/core/storage/WriteJournal.ts` | 380 | `compactJournal` exported + unit-proved but never called in production (tracked as WINDOWS #25) | ⚠️ Warning | Terminal journal entries accumulate in production; 02-14 deliberately does not wire it — recorded open window, deferred with a Phase 19 release-gate re-check (never to be marked fixed/waived until the required tests exist and pass) |
| `src/entrypoints/background.ts` | 33 | `later-phase TODOs:` comment listing deliberately deferred registrations, each naming its owning phase | ℹ️ Info | Documentation of intentional deferral, not unresolved debt |
| `src/components/standalone/StandaloneShell.tsx` | 329 | Pre-existing AntD v5 `message` prop on `Alert` (recorded in `deferred-items.md` #1) | ℹ️ Info | Deprecation warning only; not introduced by Phase 2 |

No `TBD`/`FIXME`/`XXX` marker exists in any file covered by this verification. No blocking anti-pattern.

### Human Verification — Dispositioned (no unresolved items)

The previous report carried two human verification items (the two 400 px UI backstops). They were presented to the operator and are now **recorded deferrals**, not unresolved human items:

1. **MirrorBanner at 400 px (02-09 backstop)** — `02-UAT.md` test 1: `result: skipped`, reason recorded (deferred to Phase 15 — WINDOWS #27; closure = Real-Chrome observation at 400 px; expiry = before the Phase 19 release gate).
2. **Capability Alert + storage notifications at 400 px (02-10 backstop)** — `02-UAT.md` test 2: `result: skipped`, reason recorded (Phase 15 — WINDOWS #27, same closure and expiry).

Both remain listed in `behavior_unverified_items:` (the verifier abstains on the rendered behaviour — `insufficient_spec`, jsdom cannot observe layout) and in `deferred:` with the named owner. They must not be treated as closed, and the Phase 19 release gate must fail while WINDOWS #27 remains open.

**Residual dispositions (previously human items 3 and 4 — now closed as human items):**

- **CR-02 (mirror-persists-on-promotion reading)** — accepted as designed under D2-34 by the operator on 2026-09-24 (status: accepted; severity: low; no follow-up; not waived and not a defect). Evidence: `02-14-SUMMARY.md` § Operator acknowledgement; `STATE.md` decision bullet.
- **CR-01 (metadata-hold trade)** — acknowledged and scheduled as **WINDOWS #26** (`open`; severity: Medium; owner: the earliest approved gap-closure/storage-hardening plan that may modify the store write guard, defaulting to the Phase 19 release-hardening plan; expiry before v0.2 release acceptance; Phase 19 release gate must fail while unimplemented). **Not fixed, not waived** — a recorded deferral.

### Gaps Summary

**No blocking gaps. No unresolved human verification items. No regressions.**

- **What this pass changed:** recomputed the covered-input fingerprint (the previous one no longer matched its own declared inputs — it read `v1:sha256:078453ae…` ≠ declared `v1:sha256:7db5b89b…`, hence `stale`) and recorded the operator UAT disposition. `covered_files` now also covers `02-UAT.md`; both phase gates were re-run from one code state at HEAD `775631aa` with **no `src/`/`tests/` change since `76038e4d`**.
- **Premise re-checked, not assumed:** the four ROADMAP success criteria were re-verified against the code (not the SUMMARYs) — recovery tests and call site, §15.2 crypto constants, body-absence assertions and allow-list field set, migration table + v1→v2 fixture + single-tx read-back, workspace runtime wiring in both roots — and both gates pass this pass.
- **Nothing was waived or silently passed.** The 02-02 journal-bounding truth remains partial (WINDOWS #25, excluded from the score); the two 400 px backstop truths remain abstained/behavior-unverified and are recorded deferrals (WINDOWS #27, owner Phase 15); CR-01 is open (WINDOWS #26); CR-02 is operator-accepted under D2-34. WINDOWS #5/#7/#8/#25/#26/#27 all remain `open` with `resolved_at: null` and no document claims them closed.
- **Status rationale:** with the gaps list empty, the two former human items dispositioned by the operator as skipped-with-reason deferrals (owner, closure condition and expiry recorded), and every other truth verified, the decision tree yields `passed` (deferred items do not affect status determination; `verify-work`'s zero-issue path canonicalizes `human_needed` → `passed`).

---

_Verified: 2026-09-24T11:52:00Z_
_Verifier: the agent (gsd-verifier)_
