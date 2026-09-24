---
phase: 02-storage-security-writejournal-workspace-persistence
verified: 2026-09-24T11:18:03Z
status: human_needed
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
covered_digest: "v1:sha256:7db5b89ba788442802d38c65fd9579bb8e110500e4935ab32d5f156eafe89b5d"
behavior_unverified: 2
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 110/114
  gaps_closed:
    - "The phase gate is green end to end after the build, and `pnpm run verify:phase-1` still passes, so no completed phase regressed (02-13 must-have; repeated in 02-VALIDATION.md sign-off and STATE.md `stopped_at`)."
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "Journal entries are bounded: every non-terminal entry is retained, terminal entries are compacted to a bounded newest set, and the attempt counter increments per attempt (02-02, still partial in production)."
    addressed_in: "Phase 19 release gate (re-check point) — implementation owner: the future journal-retention plan"
    evidence: "WINDOWS #25 stays `open` with the eight-field retention contract (enriched by 02-14): status implemented-but-unwired; `compactJournal()` (`src/core/storage/WriteJournal.ts:380`, `JOURNAL_TERMINAL_ENTRY_LIMIT = 50`) is unit-proved but has no production caller; field 8: 'the row stays open and must be re-checked at the Phase 19 release gate, and it must never be marked production-active, fixed or waived until those tests exist and pass'. Formerly gap 2 of the previous report — NOT fixed, NOT waived, NOT closed."
  - truth: "At a 400 px Side Panel width the MirrorBanner bar grows rather than clipping, the caption wraps to at most two lines then ellipsizes, and the action never wraps or clips (02-09 backstop)."
    addressed_in: "Phase 15 consolidated Real-Chrome cycle"
    evidence: "02-VALIDATION.md Manual-Only row; WINDOWS #7/#22 (Phase 15 owns the 400 px observation); operator disposition 2026-09-24 (02-14) keeps it deferred; ROADMAP Phase 15 'Workspace Experience (UI/UX) + RICH'."
  - truth: "At 400 px the capability Alert body and the storage notifications wrap with no horizontal scroll and no mid-glyph clipping (02-10 backstop)."
    addressed_in: "Phase 15 consolidated Real-Chrome cycle"
    evidence: "02-VALIDATION.md Manual-Only row; operator disposition 2026-09-24 (02-14): 'remain deferred to the Phase 15 consolidated Real-Chrome cycle'."
advisory: []
behavior_unverified_items:
  - truth: "At a 400 px Side Panel width the MirrorBanner bar grows rather than clipping, the caption wraps to at most two lines then ellipsizes, and the action never wraps or clips (02-09 backstop)."
    test: "Open the Side Panel at 400 px with the writer state `mirror`."
    expected: "The bar grows (min-height 32 px, no fixed height), the caption wraps to at most two lines then ellipsizes, and the action neither wraps nor clips."
    why_human: "jsdom cannot observe layout. The mechanism is asserted (`bar.style.minHeight === '32px'`, `bar.style.height === ''`, action nowrap, caption clamp) but the rendered behaviour at 400 px has no explicit evidence; `02-VALIDATION.md` records it as Manual-Only and routes it to the Phase 15 consolidated Real-Chrome cycle. `insufficient_spec` — never a silent pass."
  - truth: "At 400 px the capability Alert body and the storage notifications wrap with no horizontal scroll and no mid-glyph clipping (02-10 backstop)."
    test: "At 400 px, render the onboarding credential-step capability Alert and trigger a storage/election notice."
    expected: "Body text and notification wrap with no horizontal scroll and no mid-glyph clipping."
    why_human: "Same jsdom limitation; recorded as a Manual-Only row in 02-VALIDATION.md and deferred to Phase 15. No explicit evidence exists, so the backstop truth is `insufficient_spec` and must not be treated as closed."
human_verification:
  - test: "Open the Side Panel at a 400 px width with a surface in the `mirror` writer state."
    expected: "The banner bar grows (min-height 32 px, no fixed height), the canonical caption wraps to at most two lines then ellipsizes, and the action neither wraps nor clips."
    why_human: "jsdom cannot observe layout; Phase-15-deferred (backstop/insufficient_spec, NOT a Phase-2 blocker). Recorded in 02-VALIDATION.md § Manual-Only."
  - test: "At 400 px, render the onboarding credential-step capability `Alert` and trigger a storage/election notice."
    expected: "Body text and notification wrap with no horizontal scroll and no mid-glyph clipping."
    why_human: "Same jsdom limitation; Phase-15-deferred (backstop/insufficient_spec, NOT a Phase-2 blocker). Recorded in 02-VALIDATION.md § Manual-Only."
---

# Phase 2: Storage, Security, WriteJournal, Workspace Persistence Verification Report

**Phase Goal:** Durable, encrypted, crash-safe storage foundation — keys encrypted, message bodies only in IndexedDB, migrations idempotent, writes journaled, workspace persistent across reloads and surfaces.
**Verified:** 2026-09-24T11:18:03Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plan 02-14, commits `e94a0508`…`76038e4d`)

## What changed since the previous verification (2026-09-24T14:40Z)

- **No production source change in the gap range.** `git diff --name-only 435d5f91..HEAD -- src/` is empty — and `git diff --name-only 6629ef65..HEAD -- src/` is empty too, so the entire `src/` tree is byte-identical to the state the previous report verified. The gap range changes: `tests/isolation/credential-boundary.test.ts` (new), `tests/services/providerValidationFixtures.test.ts` (restated), and seven planning/ledger records (`.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/WINDOWS.md`, `02-13-SUMMARY.md`, `02-14-SUMMARY.md`, `02-VALIDATION.md`).
- **Gap 1 (BLOCKER) closed.** The over-broad Phase-1 substring scan is replaced by the scope-aware, comment-stripped, import/usage-based credential-boundary gate (`tests/isolation/credential-boundary.test.ts`), and the superseded Phase-1 case was restated to the post-Phase-2 invariant (not silenced — the `KeyVault.ts:33` doc comment is still present, pinned by the gate's IN-05 regression pin). Stale claims in `02-13-SUMMARY.md`, `02-VALIDATION.md` and `STATE.md` are marked superseded with the history preserved.
- **Residuals dispositioned by the operator** (2026-09-24, option `schedule-cr01-followup`, recorded verbatim in `02-14-SUMMARY.md` § Operator acknowledgement): CR-02 accepted as designed under D2-34 (not waived, not a defect, no follow-up); CR-01 acknowledged and scheduled as WINDOWS **#26** (open; owner: the earliest approved gap-closure/storage-hardening plan that may modify the store write guard, defaulting to Phase 19 release-hardening; expiry before v0.2 release acceptance; NOT fixed, NOT waived). WINDOWS #25 stays `open` with its eight-field retention contract.
- **The two 400 px UI backstops remain deferred to Phase 15** and are carried below as human-verification items (`insufficient_spec`) — never a silent pass.

## Fresh gate runs (this verification, HEAD `76038e4d`, clean working tree)

| # | Command | Observed | Exit |
|---|---------|----------|------|
| 1 | `pnpm run build:ext` | manifest emitted (875 ms; `manifest.json` 796 B); total bundle 1.99 MB | **0** |
| 2 | `pnpm run verify:phase-2` | `verify:phase-2: 24 declared path(s) resolve` · Test Files **29 passed (29)** · Tests **490 passed (490)** | **0** |
| 3 | `pnpm run verify:phase-1` | `verify:phase-1: 15 declared path(s) resolve` · Test Files **59 passed (59)** · Tests **886 passed (886)** · `verify-no-tailwind: 0 Tailwind utility strings in src` | **0** |

The previous report's red observation (`verify:phase-1` exit 1 · 1 failed | 867 passed) is not reproducible: the restated case passes and both gates collect the new boundary gate. The counts reconcile exactly with the previous state + the new file: phase-2 28→29 files and 472→490 tests (+18 = the boundary gate); phase-1 58→59 files and 868→886 tests (+18, with the formerly failing case now green). No source or test edit occurred between the runs in this verification.

## Goal Achievement

### ROADMAP Success Criteria (the phase contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC1 | WriteJournal recovery test passes — an interrupted write recovers to a consistent state | ✓ VERIFIED | `tests/core/storage/WriteJournal.test.ts` green in the phase gate: *"replays an interrupted applying entry idempotently, leaving exactly one destination record"*, *"replays a pending entry on the next start"*, *"rolls back the applied steps in reverse order and lands as rolled-back"*. Production call site confirmed unchanged: `useExtensionStore.defaultRecoverJournal()` → `recoverJournal()` (`src/store/useExtensionStore.ts:208-209, 232`), reached by both surface roots via `hydrateChatHistory()`. |
| SC2 | API key encryption round-trip passes (AES-GCM per §15.2); no message body appears in `chrome.storage.local` | ✓ VERIFIED | `tests/core/security/EncryptedStorage.test.ts`, `tests/core/security/KeyVault.test.ts`, `tests/core/storage/ChatHistoryDB.test.ts` and `tests/core/storage/npStoreWriteGuard.test.ts` all green in the gate; body-absence assertions (`serialiseStorage(localMap())`, `sessionMap()`, journal entry, with a non-vacuity self-test) unchanged. `src/store/useExtensionStore.ts:940` `PERSISTED_BLOB_FIELDS = NP_STORE_V3_FIELDS = ['config','prompts','writeHistory','notes']` — no conversation collection, no `activeSessionId`, no excerpt. |
| SC3 | Migration v1→v2 fixture passes; IndexedDB writes use single transactions for consistent stores | ✓ VERIFIED | `tests/core/storage/IndexedDBMigrator.test.ts` green in the gate (*"the test-only v1→v2 fixture adds a store without editing the Phase 2 migration"*, reusing `v1InitialPhase2Stores` verbatim; production table is exactly `[v1InitialPhase2Stores]`). Single transaction + authoritative `readonly` read-back in `ChatHistoryDB.writeConversationWithMessages` unchanged. |
| SC4 | Workspace state persists across page reload and cross-surface handoff; `pnpm run verify:phase-2` passes | ✓ VERIFIED | `WorkspacePersistence.test.ts`, `workspaceRuntime.test.ts`, `WriterElection.test.ts`, `workspaceHandoff.integration.test.ts` all green in the gate; both roots call `startWorkspaceRuntime()` and register the election. Gate: **24 paths resolve · 29 files / 490 tests passed, exit 0** (re-run this verification). |

**Score: 4/4 ROADMAP success criteria verified.**

### Gap-closure plan 02-14 must-haves (8 truths, all verified this pass)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A scope-aware credential-boundary gate replaces the repository-wide substring rule and enforces the real invariant | ✓ VERIFIED | `tests/isolation/credential-boundary.test.ts` (721 lines): `credentialBoundaryViolations({ files })` is a total predicate over in-memory `{path, source}` entries; `collectBoundaryModules` computes a transitive taint set to a fixpoint over re-exports; `resolveSpecifier` resolves `./`, `@/`, `~/` specifiers; `stripComments` before every scan. Real-tree assertion `produces no violation over the real tree` green. |
| 2 | The gate fails on each prohibited shape — proven by permanent self-tests over the same predicate | ✓ VERIFIED | 8 negative controls, all green: (a) presentation → port import → `PORT_IMPORT_OUTSIDE_DECLARATION`; (b) presentation → `KeyVault` → `BOUNDARY_MODULE_IMPORT`; (c) onboarding `writeWorkspaceState(state, apiKey)` → `CREDENTIAL_INTO_PERSISTENCE`; (d) `WorkspaceState.apiKey` → `CREDENTIAL_FIELD_IN_PERSISTED_SHAPE`; (e) unapproved application module → `KeyVault` → `BOUNDARY_MODULE_IMPORT`; (f) missing canonical module → `GATE_TARGET_MISSING`; (g) barrel re-export evasion → caught via the taint set; (h) unresolved project specifier in a prohibited scope → `UNRESOLVED_PROJECT_SPECIFIER`. Each control asserts its named code with `toContain`. |
| 3 | The gate passes on the allowed cases (canonical module, the live approved edge, docs naming the interface) | ✓ VERIFIED | 5 positive controls green, including *"(e) a doc comment naming CredentialStorePort is not a call site (comment stripping)"* — the exact IN-05 shape. Non-vacuity guarded by `EMPTY_SCAN` + target-exists checks and the real-tree non-vacuity case (every prohibited scope has >0 files scanned; no `tests/` path scanned). |
| 4 | `verify:phase-1` and `verify:phase-2` both exit 0 from the same code state, both collecting the corrected gate | ✓ VERIFIED | Re-observed this pass at HEAD `76038e4d` with no edits between: phase-2 exit 0 (the script's path list carries `tests/isolation`; log shows `credential-boundary.test.ts (18 tests)`), phase-1 exit 0 (`credential-boundary.test.ts (18 tests)` collected). |
| 5 | No planning document still claims the pre-correction `verify:phase-1` green result is current; history preserved, not erased | ✓ VERIFIED | `02-13-SUMMARY.md` `coverage.D2` is `status: fail` with the FALSIFIED-AFTER-THE-FACT description and a dated correction block; `02-VALIDATION.md` carries the superseded marker on the 02-13 row, the correction blockquote, the corrected Approval line and `nyquist_compliant: true` with the fresh observation; `STATE.md` `stopped_at` (frontmatter + body) carries the fresh numbers. No line claims the stale result is current. |
| 6 | WINDOWS #25 stays `open` with the eight required fields; never production-active, fixed or waived | ✓ VERIFIED | Ledger row 25 `open`, all eight field markers present (implemented-but-unwired; owning plan; activation condition; retention threshold 50; crash-safety; replay-safety; tests required before activation; Phase 19 release-gate treatment), `resolved_at: null`. Counters: open 19 / waived 0 / fixed 7 / total 26. |
| 7 | The two 400 px backstops stay deferred and the CR-01/CR-02 residuals are acknowledged only by explicit operator review | ✓ VERIFIED | `02-14-SUMMARY.md` § Operator acknowledgement records the verbatim answer (option `schedule-cr01-followup`): CR-02 accepted under D2-34; CR-01 scheduled as WINDOWS #26 (`open`, owner + expiry + release-blocking treatment); CR-01 **not fixed and not waived**; no automatic waiver wording; the 400 px backstops stay Phase-15-deferred. |
| 8 | No production credential boundary was weakened — vault/codec/port/schemas/migration/product authorities byte-unchanged | ✓ VERIFIED | `git diff --name-only 435d5f91..HEAD -- src/` empty; PRODUCT_SPEC untouched in the range; `grep -c 'CredentialStorePort' src/core/security/KeyVault.ts` = **1** (the IN-05 comment is intact — the fix did not trim prose to satisfy a gate); the gate's approved-edge pin asserts `APPROVED_VAULT_EDGES` is exactly the live `KeyVault → EncryptedStorage` pair. |

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
| 02-09 | 8 | 7 | 0 | 0 | 1 | Hydration-driven region (`Skeleton`, not `Spin`); no `data-np-backing`; banner once above the region; non-optimistic `requestRefocus()`; full caption as text content. **Backstop:** 400 px visual observation → human (Phase 15) |
| 02-10 | 11 | 10 | 0 | 0 | 1 | Startup sequence in both roots; `ANT_MESSAGE_CONFIG = { maxCount: 3, duration: 5 }`; `Phase2Notices` with 3 persistent keyed notices; capability `Alert` verbatim; Options disabled; stable keys. **Backstop:** 400 px wrapping → human (Phase 15) |
| 02-11 | 8 | 8 | 0 | 0 | 0 | `tests/harness/twoSurface.ts` real implementations + injected loopback transport; Suite A maps D2-31.1–22 one test per clause; sentinel absence across URL/envelopes/journal/error store/log; restart/crash simulation |
| 02-12 | 10 | 10 | 0 | 0 | 0 | Suite B maps D2-32.1–23; exactly one presentation; idempotent completion; cancellation/recovery; schema-version honesty; no false readiness; no provider call; API-key locality across 6 surfaces; D2-35 traceability; WINDOWS #5/#8 stay `open` |
| 02-13 | 8 | **8** | 0 | 0 | 0 | **Gap 1 resolved:** `verify:phase-2` names every live suite + self-derived preflight; `verify:phase-1` now exits 0 (59 files / 886 tests) with the corrected gate collected; stale claims corrected, history preserved; windows stay open; D2-29 owner recorded |
| 02-14 | 8 | 8 | 0 | 0 | 0 | Scope-aware credential-boundary gate (8 negative + 5 positive controls + 5 real-tree assertions, all green); Phase-1 case restated scope-aware/comment-stripped; both gates re-observed exit 0; records honest; WINDOWS #25 open with the retention contract; CR-01/CR-02 operator disposition recorded, nothing waived |
| **Total** | **122** | **119** | **0** | **1** | **2** | |

**Score: 119/122 must-haves verified** (0 failed · 1 partial/WARNING · 2 present, behavior-unverified). The denominator grew from the previous report's 114 by 02-14's 8 must-haves; the previous verified count rises 110 → 111 on the 13 phase plans (the former 02-13 failure is the closure) plus 02-14's 8 = 119.

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases (informational; do not require closure plans).

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | 02-02 journal bounding in production — `compactJournal()` unwired (WINDOWS #25, `open`) | Phase 19 release gate (re-check); implementation owner: the future journal-retention plan | WINDOWS #25 field 8: *"the row stays open and must be re-checked at the Phase 19 release gate, and it must never be marked production-active, fixed or waived until those tests exist and pass"*; 02-14 explicitly does not wire it. **Formerly gap 2 — NOT fixed, NOT waived, NOT closed.** |
| 2 | 02-09 MirrorBanner 400 px backstop (human) | Phase 15 consolidated Real-Chrome cycle | 02-VALIDATION.md Manual-Only row; WINDOWS #7/#22 |
| 3 | 02-10 capability Alert + notices 400 px backstop (human) | Phase 15 consolidated Real-Chrome cycle | 02-VALIDATION.md Manual-Only row; 02-14 operator disposition |

### Advisory (New Scope, Unevidenced)

None — this re-verification raised no new-scope finding without deterministic evidence.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/core/storage/NowPilotDB.ts` | `DB_NAME`/`DB_VERSION`/`getDb`/`closeDb` | ✓ VERIFIED | `runMigrations` inside `openDB`'s `versionchange` tx, abort on failure |
| `src/core/storage/IndexedDBMigrator.ts` | migrations + result | ✓ VERIFIED | `MIGRATIONS = [v1InitialPhase2Stores]` only |
| `src/core/storage/ChatHistoryDB.ts` | journaled write/read-back | ✓ VERIFIED | one `readwrite` tx + `readonly` read-back |
| `src/core/storage/WriteJournal.ts` | schema/`runJournaled`/`recoverJournal`/`compactJournal` | ✓ VERIFIED (1 warning) | `recoverJournal` wired via `defaultRecoverJournal`; `compactJournal` exported + unit-proved but **no production caller** — WINDOWS #25 open (deferred, not fixed) |
| `src/core/storage/ErrorStore.ts` | bounded redacted store | ✓ VERIFIED | cap 100, same-tx eviction |
| `src/core/storage/legacyChatMigration.ts` | 7-stage migration | ✓ VERIFIED | `projectNpStoreV3` single owner |
| `src/core/storage/Setting.ts` | install-secret lifecycle | ✓ VERIFIED | `SettingResult` union matches `KeyVault` injection exactly |
| `src/core/storage/npStoreWriteGuard.ts` | pre-v3 write hold | ✓ VERIFIED | CR-01 regression suite in the gate |
| `src/core/security/EncryptedStorage.ts` | envelope codec | ✓ VERIFIED | codec green in the gate |
| `src/core/security/KeyVault.ts` | create/replace/retrieve/… | ✓ VERIFIED | doc comment intact (IN-05 pin) and now correctly not a violation |
| `src/core/security/redactSensitive.ts` | single choke point | ✓ VERIFIED | imported by `KeyVault`, `Setting`, `ErrorStore` |
| `src/services/ports/credentialStorePort.ts` | port contract | ✓ VERIFIED | no `src/components/**` import |
| `src/core/workspace/{WorkspacePersistence,WriterElection,workspaceRuntime,WorkspaceStore}.ts` | journaled version-ordered writes, CAS/heartbeat, composition | ✓ VERIFIED | all green in the gate; wired in both entrypoints |
| `src/components/{common/MirrorBanner,common/Phase2Notices,onboarding/OnboardingFlow,sidepanel/SidePanelShell,standalone/StandaloneShell}.tsx` | canonical UI surfaces | ✓ VERIFIED | green in the gate |
| `src/store/useExtensionStore.ts` | v3 projection + hydration | ✓ VERIFIED | green in the gate |
| `src/core/i18n/strings.ts`, `src/core/onboarding/{useOnboardingGate,onboardingStateStore}.ts` | keys + writer-gated flow | ✓ VERIFIED | 9 Phase-2 keys present verbatim |
| `tests/isolation/credential-boundary.test.ts` **(new, 02-14)** | the corrected cross-phase credential-boundary gate | ✓ VERIFIED | 18 tests: 8 negative controls + 5 positive controls + 5 real-tree assertions; collected by both gates; no debt markers |
| `tests/services/providerValidationFixtures.test.ts` **(restated, 02-14)** | the Phase-1-surface case, scope-aware + comment-stripped + non-vacuity | ✓ VERIFIED | 18/18 pass; asserts canonical-module existence and zero imports/mentions across the four Phase-1 surfaces |
| `package.json` | corrected `verify:phase-2` | ✓ VERIFIED | 24 paths, preflight has teeth; path list carries `tests/isolation` |
| `.planning/{STATE,ROADMAP,WINDOWS}.md`, `02-VALIDATION.md`, `02-13-SUMMARY.md` | phase record | ✓ VERIFIED | stale claims superseded (not erased); fresh claims match this re-run; WINDOWS #5/#7/#8/#25/#26 all `open`; no document claims them closed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `credential-boundary.test.ts` | `verify:phase-1` + `verify:phase-2` | `tests/isolation` directory token in both scripts | ✓ WIRED | observed in both runs (`credential-boundary.test.ts (18 tests)`) |
| `NowPilotDB.getDb` | `IndexedDBMigrator.runMigrations` | `openDB` versionchange `tx` | ✓ WIRED | failure aborts |
| `ChatHistoryDB` write | `readonly` read-back | only-then success | ✓ WIRED | unchanged |
| `WriteJournal.persist` | `entries` store of the same handle | `runJournaled` | ✓ WIRED | `WorkspacePersistence` uses the real `np_db` journal store |
| `useExtensionStore.npStoreMigrate` | `projectNpStoreV3` (02-05) | import, not restatement | ✓ WIRED | unchanged |
| `useExtensionStore` `np_store` adapter | `npStoreWriteGuard` | `npStoreStorage` | ✓ WIRED | unchanged |
| `KeyVault.readInstallSecret` | `Setting.readInstallSecret()` | structural union, no adapter | ✓ WIRED | unchanged |
| `WorkspacePersistence` | `chromeStorageAdapter` | debounced (correct here) | ✓ WIRED | `flushPendingWrite` lands the key before the signal |
| `WriterElection` | `chrome.storage.session` | direct, not debounced | ✓ WIRED | unchanged |
| `WorkspaceStore` | `ElectionOutcome` (02-06) | store consumes the outcome | ✓ WIRED | no plan re-derives writer state |
| `workspaceRuntime` | both surface roots | `startWorkspaceRuntime()` | ✓ WIRED | `sidepanel/main.tsx`, `standalone/main.tsx` |
| `Phase2Notices` | `subscribeToElectionFailure` (02-09) | notice source | ✓ WIRED | unchanged |
| `SidePanelShell` | `useWorkspaceStore.writerState` | banner gating | ✓ WIRED | renders only on `mirror` |
| `hydrateChatHistory` | `defaultRecoverJournal` → `recoverJournal` | startup order | ✓ WIRED | `useExtensionStore.ts:208` |
| `redactSensitive` | `KeyVault` / `Setting` / `ErrorStore` | single choke point | ✓ WIRED | three import sites |
| `KeyVault.ts` doc comment | `CredentialStorePort` name | **not** a link (prose) | ✓ WIRED (correctly ignored) | comment-stripped; IN-05 regression pin asserts the comment stays and is not a violation |

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
| Phase gate end to end | `pnpm run build:ext && pnpm run verify:phase-2` | exit 0 · manifest emitted (875 ms, 796 B) · 24 paths resolve · 29 files / 490 tests passed | ✓ PASS |
| Cross-phase gate | `pnpm run verify:phase-1` | exit 0 · 15 paths resolve · 59 files / 886 tests passed · tailwind clean | ✓ PASS (was ✗ FAIL — gap 1 closed) |
| Previously failing case | `npx vitest run tests/services/providerValidationFixtures.test.ts` | exit 0 · 18 passed (18) | ✓ PASS |
| Corrected boundary gate | `npx vitest run tests/isolation/credential-boundary.test.ts` | exit 0 · 18 passed (18) | ✓ PASS |
| Gate control groups (teeth) | `-t 'negative controls'` · `-t 'positive controls'` · `-t 'real src/ tree'` | 8 passed · 5 passed · 5 passed | ✓ PASS |
| IN-05 comment not trimmed | `grep -c 'CredentialStorePort' src/core/security/KeyVault.ts` | `1` (comment intact; pinned by the gate) | ✓ PASS |
| No production change in gap range | `git diff --name-only 435d5f91..HEAD -- src/` | empty | ✓ PASS |
| Built manifest least privilege | `node -e` read `.output/chrome-mv3/manifest.json` | `["sidePanel","storage","tabs","unlimitedStorage"]`, `connect-src 'none'`, no `content_scripts` | ✓ PASS |
| No presentation-side vault reach | `grep -rn "KeyVault\|EncryptedStorage\|credentialStorePort" src/components/` | no matches | ✓ PASS |
| No `Requester`/`RateLimiter` in production | `grep -rn "Requester\|RateLimiter" src/` | comments only (Phase-3 ownership notes) | ✓ PASS |
| No MemoryDB/NotesDB in production | `grep -rn -i "MemoryDB\|NotesDB" src/` | no matches | ✓ PASS |
| No forbidden success strings | `grep -rn -iE "credentialStored\|providerConnected\|providerValidated\|providerReady\|migrationComplete" src/` | no matches | ✓ PASS |
| Debt markers in 02-14-touched files | `grep -nE "TBD\|FIXME\|XXX"` over the two changed test files | no matches | ✓ PASS |
| WINDOWS #5/#7/#8/#25/#26 open | ledger rows + counters | all `open`; counters 19 open / 0 waived / 7 fixed / 26 total | ✓ PASS |
| PRODUCT_SPEC untouched in range | `git diff --name-only 6629ef65..HEAD -- PRODUCT_SPEC.md` | empty | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
|-------|---------|--------|--------|
| (none declared) | `find scripts -path '*/tests/probe-*.sh'` | 0 probes — no probe contract in any Phase 2 PLAN/SUMMARY | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CORE-02 | All 14 plans declare `requirements: [CORE-02]` (14/14, including the 02-14 gap-closure plan) | Storage/security foundation — encrypted keys, IndexedDB stores, WriteJournal, idempotent migrations, workspace persistence — §15, §16, §20; §18 Phase 2 DONE-when | ✓ SATISFIED | All four ROADMAP success criteria verified above; both phase gates green from one code state (`76038e4d`); `REQUIREMENTS.md` row `| CORE-02 | Phase 2 | Complete |` |

**Orphaned requirements:** none — `REQUIREMENTS.md` maps only CORE-02 to Phase 2 and every plan claims it.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/core/storage/WriteJournal.ts` | 380 | `compactJournal` exported + unit-proved but never called in production (tracked as WINDOWS #25) | ⚠️ Warning | Terminal journal entries accumulate in production; 02-14 deliberately does not wire it — recorded open window, deferred with a Phase 19 release-gate re-check (never to be marked fixed/waived until the required tests exist and pass) |
| `src/entrypoints/background.ts` | 33 | `later-phase TODOs:` comment listing deliberately deferred registrations, each naming its owning phase | ℹ️ Info | Documentation of intentional deferral, not unresolved debt |
| `src/components/standalone/StandaloneShell.tsx` | 329 | Pre-existing AntD v5 `message` prop on `Alert` (recorded in `deferred-items.md` #1) | ℹ️ Info | Deprecation warning only; not introduced by Phase 2 |

**Resolved since the previous report:** `src/core/security/KeyVault.ts:33` (doc comment tripping the Phase-1 substring scan) is **no longer a finding** — the replacement gate strips comments and its IN-05 regression pin asserts the comment stays present and is not a violation. No `TBD`/`FIXME`/`XXX` marker exists in any file touched by this phase.

### Human Verification Required

#### 1. MirrorBanner at 400 px (02-09 backstop truth — `insufficient_spec`, Phase-15-deferred)

**Test:** Open the Side Panel at a 400 px width with a surface in the `mirror` writer state.
**Expected:** The banner bar grows (min-height 32 px, no fixed height), the canonical caption wraps to at most two lines then ellipsizes, and the action neither wraps nor clips.
**Why human:** jsdom cannot observe layout. The mechanism is asserted (`bar.style.minHeight === '32px'`, `bar.style.height === ''`, action `nowrap`, caption clamp), but the rendered behaviour at 400 px has no explicit evidence. Recorded as a Manual-Only row in `02-VALIDATION.md` and routed to the Phase 15 consolidated Real-Chrome cycle — **not a Phase-2 blocker**.

#### 2. Capability Alert + storage notifications at 400 px (02-10 backstop truth — `insufficient_spec`, Phase-15-deferred)

**Test:** At 400 px, render the onboarding credential-step capability `Alert` and trigger a storage/election notice.
**Expected:** Body text and notification wrap with no horizontal scroll and no mid-glyph clipping.
**Why human:** Same jsdom limitation; explicitly recorded as a Manual-Only row and deferred to Phase 15 — **not a Phase-2 blocker**.

**Residual dispositions (previously human items 3 and 4 — now closed as human items):**

- **CR-02 (mirror-persists-on-promotion reading)** — accepted as designed under D2-34 by the operator on 2026-09-24 (status: accepted; severity: low; no follow-up; not waived and not a defect). Evidence: `02-14-SUMMARY.md` § Operator acknowledgement; `STATE.md` decision bullet.
- **CR-01 (metadata-hold trade)** — acknowledged and scheduled as **WINDOWS #26** (`open`; severity: Medium; owner: the earliest approved gap-closure/storage-hardening plan that may modify the store write guard, defaulting to the Phase 19 release-hardening plan; expiry before v0.2 release acceptance; Phase 19 release gate must fail while unimplemented). **Not fixed, not waived** — a recorded deferral, not a Phase-2 gap.

### Gaps Summary

**No blocking gaps remain. Gap 1 is closed; gap 2 was not fixed (by design) and is now a recorded, dispositioned open window.**

- **Gap 1 (previously BLOCKER — closed).** `pnpm run verify:phase-1` was red because the Phase-1 case was a comment-blind substring scan over `src/**` and the IN-05 doc comment at `src/core/security/KeyVault.ts:33` counted as a call site. Plan 02-14 replaced the rule with the scope-aware credential-boundary gate (comment-stripped, import-resolution based, transitive re-export taint, 8 negative + 5 positive controls + 5 real-tree assertions), restated the superseded Phase-1 case honestly, and corrected the stale claims without erasing the history. **Re-verified this pass at HEAD `76038e4d`: `verify:phase-1` exit 0 (15 paths · 59 files / 886 tests), `verify:phase-2` exit 0 (24 paths · 29 files / 490 tests), and the previously failing case passes.** The `KeyVault` comment is intact (`grep -c` = 1) — the fix was not a comment-trim.
- **Gap 2 (previously WARNING — carried as a deferred open window).** `compactJournal()` remains implemented and unit-proved but unwired in production; the 02-02 truth *"Journal entries are bounded…"* therefore remains **partial** and is excluded from the verified score. Plan 02-14 explicitly did not wire it (no Phase-2 acceptance criterion requires production compaction), enriched WINDOWS #25 with the eight-field retention contract, and pinned its release treatment: the row **stays `open`**, must be re-checked at the Phase 19 release gate, and must never be marked production-active, fixed or waived until the required tests exist and pass. This is not a Phase-2 blocker and not a closure plan — it is a tracked, deferred item.
- **Everything else verified.** No new gap was introduced by 02-14 (no `src/` change in `435d5f91..HEAD`); the four ROADMAP success criteria remain verified in code; WINDOWS #5/#7/#8/#25/#26 all remain `open` and no document claims any of them closed; the two 400 px backstops remain Phase-15-deferred human items (`insufficient_spec`, never a silent pass); the CR-01/CR-02 residuals are operator-dispositioned; no debt markers, no fabricated success claims, no Notes/Memory store, no production network, and no `PRODUCT_SPEC` edit.

---

_Verified: 2026-09-24T11:18:03Z_
_Verifier: the agent (gsd-verifier)_
