---
phase: "1"
slug: "mv3-wxt-runtime-antd-shells-workspace"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-09-21"
validated: "2026-09-22"
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from `01-RESEARCH.md` § Validation Architecture. Task IDs are finalized when plans land; rows below are the requirement-level seed.
> **Phase close (plan 01-13 Task 3, 2026-09-22):** the Wave 0 list is complete, every suite below runs inside `verify:phase-1`, the manual criteria carry observed real-Chrome results, and the phase's five success criteria are mapped to evidence in § Success Criteria Evidence.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.7 (jsdom 25.0.1, `globals: true`) |
| **Config file** | `vitest.config.ts` — `environment: 'jsdom'`, `setupFiles: ['./tests/setup.ts']` |
| **Quick run command** | `npx vitest run tests/core/runtime tests/core/events tests/core/workspace tests/core/theme` (the §24 Phase-1 minimum) — measured 2026-09-22: **10 files / 172 tests, 9 s including `npx tsc --noEmit`** |
| **Full suite command** | `npx vitest run` — pre-phase baseline **18 files / 166 tests**; phase close **40 files / 513 tests / ~22 s, all green** (2026-09-22) |
| **Phase gate** | `pnpm run verify:phase-1` — realigned by 01-13 to an explicit path list (15 declared paths, self-derived resolution preflight) + `scripts/verify-no-tailwind.sh`; **exit 0, 40 files / 513 tests, 2026-09-22** |
| **Typecheck** | `npx tsc --noEmit` — exit 0 (in the gate and in the quick run) |
| **Build inspection** | `tests/isolation/generated-manifest.test.ts` reads `.output/chrome-mv3/manifest.json` read-only (no rebuild in the gate); fails rather than skips when the artifact is absent (T-1-14) |
| **Estimated runtime** | ~22 s full suite; 9 s quick run + typecheck |

**Baseline floor, not target:** 166 tests passed pre-phase. At phase close the gate runs 513 tests across 40 files — every Wave 0 suite below is inside the gate path list, so a suite that stops being executed is a red gate, not a silent omission.

---

## Sampling Rate

- **After every task commit:** the narrowest suite the task touches, plus `npx tsc --noEmit`. For the `srcDir` move plan specifically: `npx tsc --noEmit && npx vitest run && bash scripts/verify-no-tailwind.sh`.
- **After every plan wave:** `npx vitest run` (full suite) + `pnpm run build:ext` + manifest inspection.
- **Before `/gsd-verify-work`:** Full suite must be green, `pnpm run verify:phase-1` green, and the freshly built extension loaded unpacked in real Chrome for the manual criteria.
- **Max feedback latency:** ~10 seconds (quick run + typecheck) — measured 9 s at phase close (2026-09-22).

---

## Per-Task Verification Map

> Task IDs are assigned when PLAN.md files land. `W0` = Wave 0 suite to create; `ext` = extend an existing suite.
> Statuses re-verified at phase close (2026-09-22): every automated command below is covered by a `verify:phase-1` path and the gate is green.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| W0 | — | 0 | CORE-01 | — | Both surfaces render through WXT with exactly one provider each | component | `npx vitest run tests/components/SidePanelShell.test.tsx tests/components/StandaloneShell.test.tsx` | ✅ | ✅ green |
| W0 | — | 0 | CORE-01 | T-01-manifest | Generated manifest is the authorised shape (least-privilege permissions, `side_panel`, no `options_ui`) | build-inspection | `pnpm run build:ext && npx vitest run tests/isolation/generated-manifest.test.ts` | ✅ | ✅ green |
| ext | — | 1 | CORE-01 | — | Background listeners attach synchronously on a cold SW | integration | `npx vitest run tests/background` | ✅ (extended) | ✅ green |
| ext | — | 1 | SP-02 | — | Standalone opens, focuses existing tab, never duplicates | integration | `npx vitest run tests/core/workspace/WorkspaceRouter.test.ts` | ✅ (extended) | ✅ green |
| W0 | — | 0 | SP-02 / FLOW-11 | T-01-handoff | READY precedes transfer; ACK gates success; draft never in URL | unit | `npx vitest run tests/core/workspace/WorkspaceHandoff.test.ts` | ✅ | ✅ green |
| ext | — | 1 | SP-08 / APPR-03 | — | `np_theme` written by exactly one writer, read by both surfaces | unit + integration | `npx vitest run tests/core/theme` | ✅ (extended) | ✅ green |
| ext | — | 1 | SP-08 | — | `Toggle theme` cycles Auto→Light→Dark and writes `np_theme` | unit | `npx vitest run tests/core/commands/registerWorkspaceCommands.test.ts` | ✅ (extended) | ✅ green |
| W0 | — | 0 | SP-09 / SA-09 / FLOW-8 | — | `Cmd+K` opens the palette on macOS **and** Windows/Linux; `KEYMAP_CONFLICT` throws | unit | `npx vitest run tests/core/input/KeymapRegistry.test.ts` | ✅ | ✅ green |
| W0 | — | 0 | SP-09 / SA-09 | — | Palette renders exactly the Phase-1 command set; `reload-extension` absent in production builds | component | `npx vitest run tests/components/CommandPalette.test.tsx` | ✅ | ✅ green |
| W0 | — | 0 | SA-08 / FLOW-9 | T-01-secret | Onboarding appears when completion state is false/unknown/missing/schema-incompatible; 4 steps render | component | `npx vitest run tests/components/OnboardingFlow.test.tsx` | ✅ | ✅ green |
| W0 | — | 0 | SA-08 | T-01-secret | Fixture adapter conforms to `ProviderValidationPort`; no network; no SDK | unit | `npx vitest run tests/services/providerValidationFixtures.test.ts` (+ `vi.spyOn(globalThis,'fetch')`) | ✅ | ✅ green |
| manual | — | 3 | SA-10 | T-01-gesture | `Focus Side Panel` calls `sidePanel.open()` inside the gesture stack | unit (mock) + **manual** | unit: `npx vitest run tests/core/commands`; manual: real Chrome evidence (observed 2026-09-22 — see below) | ✅ | ✅ unit green + browser-observed |
| ext | — | 1 | APPR-03 | — | No `themeMode` on the persisted preference blob | unit | `npx vitest run tests/core/store/useExtensionStore.test.ts` | ✅ (extended) | ✅ green |
| ext | — | 1 | APPR-03 | — | Legacy raw-string `np_theme` migrates to the single representation | unit | `npx vitest run tests/core/theme/ThemeStore.test.ts` | ✅ (extended) | ✅ green |
| W0 | — | 0 | APPR-04 / APPR-05 | — | `getAntdConfig({mode,pack,compact})` never `undefined`; compact/default algorithm split | unit | `npx vitest run tests/core/theme/antdConfig.test.ts` | ✅ | ✅ green |
| W0 | — | 0 | APPR-04 | — | Mode change updates the provider theme without remount | component | `tests/core/theme/ThemeSync.test.tsx` (remount-spy assertion) | ✅ | ✅ green |
| W0 | — | 0 | FLOW-8 | — | Global keydown → handler → `preventDefault`; no ad-hoc listeners remain | unit + source-grep | `npx vitest run tests/core/input` + grep over `src/entrypoints` | ✅ | ✅ green |
| W0 | — | 0 | FLOW-10 | — | Palette filters, keyboard-navigates, zero-results state holds height | component | `npx vitest run tests/components/CommandPalette.test.tsx` | ✅ | ✅ green |
| W0 | — | 0 | D-07 | T-01-secret | Legacy plaintext cleanup: idempotent, redacted, metadata preserved | unit | `npx vitest run tests/core/storage/legacyCredentialCleanup.test.ts` | ✅ | ✅ green |
| W0 | — | 0 | D-07 / D-08 | T-01-secret | Sentinel secret absent from storage / serialised state / messages / logs / DOM | unit + component | `npx vitest run tests/core/storage tests/components/OnboardingFlow.test.tsx` | ✅ | ✅ green |
| W0 | — | 0 | D-11 | — | `WorkspaceState` shape, safe defaults, producer allowlist, unknown-field rejection | unit | `npx vitest run tests/core/workspace/WorkspaceState.test.ts` | ✅ | ✅ green |
| ext | — | 1 | D-14 | — | No Phase-1 code writes `np_workspace` / `np_workspace_store` | unit (source-scan + store assertion) | `npx vitest run tests/core/workspace` | ✅ (extended) | ✅ green |
| W0 | — | 0 | D-16 | — | Every non-Phase-1 page carries `data-np-backing` `fixture` or `deferred`; no perpetual skeleton | component + DOM | `npx vitest run tests/components/pages tests/components/DeferredNotice.test.tsx` | ✅ | ✅ green |
| ext | — | 1 | §24 | — | Banned imports zero: `innerHTML`/`dangerouslySetInnerHTML`, `tailwind`/`shadcn`/`@radix-ui`, `framer-motion` | source-grep + manifest gate | `bash scripts/verify-no-tailwind.sh` + `npx vitest run tests/isolation/banned-imports.test.ts` (three groups + approved-library non-match) | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All Wave 0 suites exist and run inside `verify:phase-1` (verified 2026-09-22):

- [x] `tests/core/input/KeymapRegistry.test.ts` — FLOW-8/SP-09/SA-09; macOS `Cmd+K` meta-key case, the Windows/Linux control-key case and the `KEYMAP_CONFLICT` path.
- [x] `tests/core/theme/antdConfig.test.ts` — APPR-04/APPR-05: "never returns `undefined`" and the compact/default algorithm split.
- [x] `tests/core/workspace/WorkspaceHandoff.test.ts` — D-13 protocol: cold ready-before-transfer, warm path, duplicate request id, timeout, retry, ack gate, malformed URL params, unsupported schema version, invalid source/target, draft never in URL, secret never in the broadcast.
- [x] `tests/core/workspace/WorkspaceState.test.ts` — D-11 shape, safe defaults, producer allowlist, inert later-phase fields, unknown-field rejection, no `np_workspace` write (D-14).
- [x] `tests/core/storage/legacyCredentialCleanup.test.ts` — D-07 idempotence, redaction, metadata preservation, no relocation, sentinel absence.
- [x] `tests/components/OnboardingFlow.test.tsx` — D-05/D-06/D-08 across both surface presentations.
- [x] `tests/components/CommandPalette.test.tsx` — pinned Phase-1 command set, zero-results, dev-only `reload-extension`, 12 px floor, token-derived selected-row background.
- [x] `tests/components/DeferredNotice.test.tsx` + `tests/components/pages/*.test.tsx` — D-16 presence/absence of `data-np-backing` and the no-perpetual-skeleton rule.
- [x] `tests/isolation/generated-manifest.test.ts` — reads `.output/chrome-mv3/manifest.json`; the single highest-value gap (CONCERNS named it as the reason two defects shipped).
- [x] Repo-level banned-import gate `tests/isolation/banned-imports.test.ts` — `innerHTML`/`dangerouslySetInnerHTML`, the banned styling/primitive packages (source + `package.json`) and `framer-motion`, each its own proven-teeth case (plan 01-13 Task 1).
- [x] `tests/isolation/cross-entrypoint-imports.test.ts` and `tests/core/strict/np-strict-ceiling.test.ts` updated for the `src/entrypoints` paths; the isolation self-test cannot pass vacuously.
- [x] `package.json` `verify:phase-1` includes every new suite (`tests/core` named paths, `tests/background`, `tests/components`, `tests/isolation`, `tests/services`) while keeping the §24 minimum and the existing `tests/background tests/components tests/isolation` sets (plan 01-13 Task 2).

*No framework install needed — Vitest + jsdom + testing-library already present.*

---

## Manual-Only Verifications

> **Observed 2026-09-22** by the operator in real Chrome **on macOS**, with the extension loaded unpacked from `.output/chrome-mv3` (WXT build), using the procedure supplied at the 01-13 Task 3 checkpoint: a fresh Chrome profile at `/tmp/nowpilot-uat-01-13`, and — for the credential row — a seeding script that wrote a legacy plaintext `apiKey` into `np_store` in `chrome.storage.local` before the extension was reloaded. The entries below are the operator's observed results; no screenshot substitutes for them (`nowpilot-phase-verification`).

| Behavior | Requirement | Why Manual | Observed result (2026-09-22) |
|----------|-------------|------------|------------------------------|
| Side Panel opens and onboarding appears on a fresh install | CORE-01 / SA-08 | Requires a real Chrome MV3 runtime and a clean profile; jsdom cannot open the Side Panel | Clicking the extension action in the fresh profile opened the Side Panel, and the first-run onboarding presented inside the panel — no tab and no panel opened automatically during install. All four steps rendered, the key field masked its value, and the fixture-backed validation ran and reached its success state with the fixture backing disclosed by the marked notice. |
| `Cmd+K` opens the palette on both surfaces (macOS and Windows/Linux chords) | SP-09 / SA-09 / FLOW-8 | OS-level chord handling cannot be fully simulated in jsdom | On macOS, pressing ⌘K opened the palette on both surfaces with the Phase-1 command set; the dev-only reload command was absent from the production build, and pressing the chord again closed the palette. The Windows/Linux control-chord half was **not** exercisable on this macOS host — recorded below as an environment-scoped open gap. |
| Standalone handoff: opens once, focuses existing on re-open, theme applies to both surfaces with no reload | SP-02 / SP-08 / FLOW-11 | Requires two real extension surfaces + `chrome.storage.onChanged` across contexts | From the Side Panel, `Open Standalone view` opened Standalone; running it again focused the existing tab and created no second one. The composer draft typed in the panel arrived in Standalone, a theme toggle from the palette updated both surfaces with no reload, and the Side Panel stayed writable with no read-only banner. |
| `Focus Side Panel` opens the panel inside the user-gesture stack | SA-10 | `chrome.sidePanel.open()` gesture semantics are runtime-only | From Standalone, running `Focus Side Panel` from the palette opened the Side Panel on the current tab; no error surfaced and no failure toast was shown. (Resolves WINDOWS id 13.) |
| Legacy plaintext credential cleanup notice shows once and is dismissible; no value is revealed | D-07 | Needs real `chrome.storage.local` seeded with a legacy record | With a legacy plaintext `apiKey` seeded into `np_store`, the reloaded extension showed the neutral notice once and it was dismissible; the stored field was gone, no part of the value was displayed anywhere, and a second reload showed no notice and no re-appearance of the field. (Resolves WINDOWS id 15.) |
| Deferred/fixture page marking and geometry parity | D-16 / APPR-04 | Layout, contrast, focus rings, container queries and scroll behaviour are not observable in jsdom | Each Standalone page showed a deferred or preview panel naming its owning phase — no perpetual skeleton and no enabled control that would need a later-phase service — and the rendered shells matched the UI-SPEC surface-contract geometry (panel/top-bar/sider metrics). (Resolves WINDOWS id 9.) |

*A screenshot without an observed-result record is not evidence (nowpilot-phase-verification skill).*

### Environment-scoped open gaps (recorded, not claimed)

1. **Item 1 — fixture failure-state flip.** The shipped `.output/chrome-mv3` wires the fixture adapter's `success` selector only (`createFixtureValidationPort('success')` in both surface roots), so the non-success validation states were not exercised in the browser this session. The five failure/cancel selectors exist and are unit-covered (`tests/services/providerValidationFixtures.test.ts`); the live failure path arrives with the real provider port. **Owner: plan 01-09 / Phase 3.**
2. **Item 2 — Windows/Linux control chord.** Observed on macOS only. The Windows/Linux code path is unit-covered (`tests/core/input/KeymapRegistry.test.ts`, control-key case) but not browser-observed. **Owner: Phase 15 / 01-08 follow-up.**

---

## Success Criteria Evidence

Phase 1's five success criteria (`.planning/ROADMAP.md`), each with the evidence that supports it:

| # | Success criterion | Status | Evidence |
|---|-------------------|--------|----------|
| 1 | Side panel opens; onboarding appears on fresh install; the `Cmd+K` palette opens with the Flow 10 command set on both surfaces | **Met** | Manual items 1 and 2 observed in real Chrome (2026-09-22): panel + onboarding, and ⌘K palette on both surfaces. Automated: `tests/components/OnboardingFlow.test.tsx`, `tests/components/CommandPalette.test.tsx`, `tests/core/input/KeymapRegistry.test.ts`, `tests/components/SidePanelShell.test.tsx`, `tests/core/commands/registerWorkspaceCommands.test.ts` — all green inside `verify:phase-1`. *Open sub-check:* the Windows/Linux OS chord (owner Phase 15 / 01-08 follow-up). |
| 2 | Standalone view opens from the Side Panel with correct workspace handoff, and re-opening focuses the existing tab (no duplicates) | **Met** | Manual item 3 observed: Standalone opened, re-running focused the existing tab with no duplicate. Automated: `tests/core/workspace/WorkspaceHandoff.test.ts`, `tests/core/workspace/WorkspaceRouter.test.ts`, `tests/components/StandaloneShell.test.tsx` — green in the gate. |
| 3 | A theme change (single `np_theme` source) applies to both surfaces immediately without reload; density is fixed per surface (Side Panel compact, Standalone default) | **Met** | Manual item 3 observed: theme toggle from the palette updated both surfaces with no reload. Automated: `tests/core/theme/ThemeStore.test.ts` (single writer), `tests/core/theme/ThemeSync.test.tsx`, `tests/core/theme/antdConfig.test.ts` (compact/default split) — green in the gate. Per-surface density is fixed at the roots (`compact: true` in `src/entrypoints/sidepanel/main.tsx`, `compact: false` in `src/entrypoints/standalone/main.tsx`) and was part of the manual geometry-parity observation (item 6). |
| 4 | Background router registers listeners synchronously; RuntimeEnvelope fixtures parse; EventBus/WorkspaceStore/WorkspaceRouter/ThemeStore suites pass | **Met** | `tests/background/message-bus-cold-start.test.ts` (synchronous cold-SW attachment), `tests/core/runtime/RuntimeEnvelope.test.ts`, `tests/core/events/EventBus.test.ts`, `tests/core/workspace/WorkspaceStore.test.ts`, `tests/core/workspace/WorkspaceRouter.test.ts`, `tests/core/theme/ThemeStore.test.ts` — all green in the 2026-09-22 gate run. |
| 5 | `pnpm run verify:phase-1` passes and banned-import greps are zero (`innerHTML`/`dangerouslySetInnerHTML`; `tailwind`/`shadcn`/`@radix-ui`; `framer-motion`) | **Met** | `pnpm run verify:phase-1` exit 0 on 2026-09-22: `tsc --noEmit` clean, 15 declared paths resolve, **40 files / 513 tests passed**, `verify-no-tailwind` reports 0 Tailwind className strings. `tests/isolation/banned-imports.test.ts` cases 1–3 (the three groups, source + `package.json`) and case 4 (approved motion library never matched) are green; per-group teeth evidence is recorded in commit `3b3841e7` and the gate's path-resolution preflight in WINDOWS id 21. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — 01-13 Tasks 1–2 carry automated verify; Task 3 is the phase's single `checkpoint:human-verify` (browser-chrome behaviour, section above), with every Wave 0 dependency satisfied.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify — the only manual task in the phase is 01-13 Task 3, the phase-acceptance checkpoint.
- [x] Wave 0 covers all MISSING references — all twelve Wave 0 entries exist and run inside `verify:phase-1` (checklist above, verified 2026-09-22).
- [x] No watch-mode flags — the gate and sampling commands use `vitest run` and `tsc --noEmit`.
- [x] Feedback latency < 10s — measured 9 s for the §24 quick run + typecheck on 2026-09-22.
- [x] `nyquist_compliant: true` set in frontmatter — every Wave 0 suite from the gap list exists and runs inside the phase gate.

**Approval:** approved — operator real-Chrome observation recorded 2026-09-22 (six items, two environment-scoped sub-checks carried as open gaps with owners); phase gate green on the same date.

## Validation Audit 2026-09-23

| Metric | Count |
|--------|-------|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |

State A audit at phase close: all twelve Wave 0 entries exist and run inside `verify:phase-1` (41 files / 569 tests + `verify-no-tailwind`, exit 0); the verifier's Requirements Coverage marks every Phase-1 requirement SATISFIED. No MISSING or PARTIAL entries; `nyquist_compliant: true` confirmed.

---

## Deferred Two-Surface Observations — Phase 15 Run Sheets (WINDOWS #5, #8)

> **Status: DEFERRED (operator decision, 2026-09-23) — not observed, not passed, not fixed, not waived.** Phase 2 is NOT blocked by these observations; Phase 2 plans must carry automated contract/integration coverage (#5 handoff contract, #8 onboarding contract/security), and Phase 15 runs the complete Real-Chrome scenarios below against the integrated frontend. #13 was resolved 2026-09-23 from the SA-10 row above (`windows fixed 13`). #7 remains deferred to Phase 15 — see `.planning/STATE.md` § Verification Deferrals (stays `open` in the ledger).
>
> **Rationale:** the Phase-1 frontend is fixture-backed, deferred and incomplete; detailed frontend acceptance now would produce temporary evidence that storage, workspace, provider, Notes and Options work will obsolete. The consolidated Real-Chrome review runs after the backend/integration phases (Phase 15), and Phase 19 must fail while #5/#7/#8 remain open.

**Artifact at deferral time:** `.output/chrome-mv3` (built 2026-09-23 07:36, after the last `src/` commit `f620285d`). Phase 15 must rebuild from the then-current HEAD.
**Profile:** a **fresh** profile directory — #8 requires first-run onboarding, so `/tmp/nowpilot-uat-01-13` must not be reused.
**Recording rule:** screenshot plus a written observed-result record per item; a screenshot alone is not evidence (`nowpilot-phase-verification`).

### WINDOWS #5 — Cross-surface handoff (cold Standalone, ready-before-publish)

1. Fresh profile; load unpacked; complete or Skip onboarding so both surfaces are usable.
2. Open Standalone first and leave it cold on screen — from `chrome://extensions`, copy the extension id and open `chrome-extension://<id>/standalone.html` in a tab (do not open the Side Panel first).
3. From the Side Panel, run `Open Standalone view` (header button or ⌘K palette).
4. Expected: a pending toast appears (shipped copy is the inline literal `Opening standalone view…` — `src/entrypoints/sidepanel/main.tsx:74`; the pinned `workspace.handoffPending`/`workspace.handoffComplete` keys render nowhere — known advisory finding `01-UI-REVIEW.md` WARNING 1, owner Phase 15 — **record the copy actually shown**); the existing Standalone tab is focused, no second tab; the toast clears on success; no error toast; no `MirrorBanner`/read-only banner in either surface; the Side Panel stays writable. A cold-tab ready-before-publish failure would instead surface the pinned `Failed to open Standalone view` copy (clicking the toast re-attempts; the visible `Retry` label is a known Phase-15 gap — record what is actually shown).
5. Optional failure path: re-run the open and close the new tab before the acknowledgement — expect the pinned failure copy.

| Check | Observed result |
|-------|-----------------|
| Pending toast appears, then clears on success (record exact copy) | |
| Existing tab focused, no duplicate tab | |
| No failure toast, no MirrorBanner/read-only banner, Side Panel writable | |

### WINDOWS #8 — Two-live-surface onboarding (Standalone first)

1. Fresh profile; load unpacked; do **not** open the Side Panel yet.
2. Open Standalone first via `chrome-extension://<id>/standalone.html`. Expected: the onboarding flow presents in Standalone; no redirection to the Side Panel; Standalone stays the active surface.
3. Open the Side Panel while Standalone's flow is still open. Expected: no competing onboarding flow starts in the panel; the first surface remains active.
4. Complete (or Skip) onboarding in one surface. Expected: the other surface's flow closes without a reload (propagates through `chrome.storage.onChanged`); a Skip leaves the explicit incomplete state and the flow re-presents on the next open.

| Check | Observed result |
|-------|-----------------|
| Standalone presents the flow when opened first; no redirection to the Side Panel | |
| Second surface starts no competing flow; first surface stays active | |
| Completion in one surface closes the other's flow without reload (Skip → explicit incomplete) | |

**On completion (Phase 15):** record the observed results above (operator name + date), then `gsd-tools windows fixed 5` and `gsd-tools windows fixed 8`. Phase 19's release gate must fail while any of WINDOWS #5/#7/#8 remains open.
