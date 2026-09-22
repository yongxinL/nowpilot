---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
verified: 2026-09-22T21:43:48Z
status: passed
score: 17/18 must-haves verified (1 operator-accepted override → 18/18 effective)
human_validated: "2026-09-22T22:51:18Z"
human_validated_by: "operator"
overrides:
  - must_have: "Every user-visible string reachable in Phase 1 resolves through t('key') from src/core/i18n/strings.ts; no Phase-1 component carries an inline literal"
    reason: "The canonical map, its copy-exactness gate and format() are complete and green; the residual literals are prototype copy on D-16 fixture-preview pages whose content Phase 15 (Options/Notes) and Phase 17 (Write) own, and are recorded as IN-05 in 01-REVIEW.md outside the operator's critical_warning fix scope."
    accepted_by: "operator"
    accepted_at: "2026-09-22T22:51:18Z"
covered_files:
  - ".gitignore"
  - ".planning/REQUIREMENTS.md"
  - ".planning/ROADMAP.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-01-PLAN.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-01-SUMMARY.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-02-PLAN.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-02-SUMMARY.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-03-PLAN.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-03-SUMMARY.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-04-PLAN.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-04-SUMMARY.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-05-PLAN.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-05-SUMMARY.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-06-PLAN.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-06-SUMMARY.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-07-PLAN.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-07-SUMMARY.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-08-PLAN.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-08-SUMMARY.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-09-PLAN.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-09-SUMMARY.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-10-PLAN.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-10-SUMMARY.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-11-PLAN.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-11-SUMMARY.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-12-PLAN.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-12-SUMMARY.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-13-PLAN.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-13-SUMMARY.md"
  - ".planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-VALIDATION.md"
  - "package.json"
  - "scripts/verify-no-tailwind.sh"
  - "src/components/common/CommandPalette.tsx"
  - "src/components/common/DeferredNotice.tsx"
  - "src/components/common/LegacyCredentialCleanupNotice.tsx"
  - "src/components/common/ThemeToggle.tsx"
  - "src/components/history/ChatHistoryModal.tsx"
  - "src/components/notes/NotesWorkspace.tsx"
  - "src/components/onboarding/OnboardingFlow.tsx"
  - "src/components/options/OptionsPage.tsx"
  - "src/components/options/PromptIcon.tsx"
  - "src/components/options/PromptsOptionsTab.tsx"
  - "src/components/pages/AgentPage.tsx"
  - "src/components/pages/ChatPage.tsx"
  - "src/components/sidepanel/SidePanelRouter.tsx"
  - "src/components/sidepanel/SidePanelShell.tsx"
  - "src/components/standalone/StandaloneRouter.tsx"
  - "src/components/standalone/StandaloneShell.tsx"
  - "src/components/standalone/StandaloneWritePage.tsx"
  - "src/components/standalone/ToolsGridPanel.tsx"
  - "src/components/standalone/WriteHistoryDrawer.tsx"
  - "src/components/standalone/WriteInputPanel.tsx"
  - "src/components/standalone/WriteOutputPanel.tsx"
  - "src/core/commands/CommandRegistry.ts"
  - "src/core/commands/registerWorkspaceCommands.ts"
  - "src/core/components/ErrorBoundary.tsx"
  - "src/core/i18n/strings.ts"
  - "src/core/input/KeymapRegistry.ts"
  - "src/core/messaging/BackgroundRouter.ts"
  - "src/core/messaging/MessageBus.ts"
  - "src/core/onboarding/onboardingStateStore.ts"
  - "src/core/onboarding/useOnboardingGate.ts"
  - "src/core/runtime/BroadcastBus.ts"
  - "src/core/runtime/OperationId.ts"
  - "src/core/runtime/RuntimeEnvelope.ts"
  - "src/core/runtime/RuntimeEnvelopeValidation.ts"
  - "src/core/storage/legacyCredentialCleanup.ts"
  - "src/core/theme/ThemeConfig.ts"
  - "src/core/theme/ThemeStore.ts"
  - "src/core/theme/ThemeSync.ts"
  - "src/core/theme/antdConfig.ts"
  - "src/core/workspace/WorkspaceRouter.ts"
  - "src/core/workspace/WorkspaceState.ts"
  - "src/core/workspace/WorkspaceStore.ts"
  - "src/core/workspace/handoff/composerDraft.ts"
  - "src/core/workspace/handoff/protocol.ts"
  - "src/core/workspace/handoff/useWorkspaceHandoff.ts"
  - "src/core/workspace/legacyWorkspaceBlob.ts"
  - "src/entrypoints/background.ts"
  - "src/entrypoints/content/core.content.ts"
  - "src/entrypoints/sidepanel/index.html"
  - "src/entrypoints/sidepanel/main.tsx"
  - "src/entrypoints/standalone/index.html"
  - "src/entrypoints/standalone/main.tsx"
  - "src/services/fixtures/providerValidationFixtures.ts"
  - "src/services/ports/credentialStorePort.ts"
  - "src/services/ports/providerValidationPort.ts"
  - "src/store/useExtensionStore.ts"
  - "src/types/index.ts"
  - "tests/background/background-router.test.ts"
  - "tests/background/legacy-credential-cleanup-wiring.test.ts"
  - "tests/background/message-bus-cold-start.test.ts"
  - "tests/components/CommandPalette.test.tsx"
  - "tests/components/DeferredNotice.test.tsx"
  - "tests/components/LegacyCredentialCleanupNotice.test.tsx"
  - "tests/components/OnboardingFlow.test.tsx"
  - "tests/components/SidePanelShell.test.tsx"
  - "tests/components/StandaloneShell.test.tsx"
  - "tests/components/pages/agent-page.test.tsx"
  - "tests/components/pages/chat-page.test.tsx"
  - "tests/components/pages/history-modal.test.tsx"
  - "tests/components/pages/notes-page.test.tsx"
  - "tests/components/pages/options-page.test.tsx"
  - "tests/components/pages/tools-page.test.tsx"
  - "tests/components/pages/write-page.test.tsx"
  - "tests/core/commands/CommandRegistry.test.ts"
  - "tests/core/commands/registerWorkspaceCommands.test.ts"
  - "tests/core/i18n/strings.test.ts"
  - "tests/core/input/KeymapRegistry.test.ts"
  - "tests/core/onboarding/onboardingStateStore.test.ts"
  - "tests/core/runtime/RuntimeEnvelope.test.ts"
  - "tests/core/storage/legacyCredentialCleanup.test.ts"
  - "tests/core/store/useExtensionStore.test.ts"
  - "tests/core/strict/np-strict-ceiling.test.ts"
  - "tests/core/theme/ThemeStore.test.ts"
  - "tests/core/theme/ThemeSync.test.tsx"
  - "tests/core/theme/antdConfig.test.ts"
  - "tests/core/workspace/WorkspaceHandoff.test.ts"
  - "tests/core/workspace/WorkspaceRouter.test.ts"
  - "tests/core/workspace/WorkspaceState.test.ts"
  - "tests/core/workspace/WorkspaceStore.test.ts"
  - "tests/isolation/banned-imports.test.ts"
  - "tests/isolation/cross-entrypoint-imports.test.ts"
  - "tests/isolation/generated-manifest.test.ts"
  - "tests/isolation/no-tailwind-gate.test.ts"
  - "tests/services/providerValidationFixtures.test.ts"
  - "tsconfig.json"
  - "vitest.config.ts"
  - "wxt.config.ts"
covered_digest: "v1:sha256:f7c19539032cdc0beb4c76f7eb7f65f2e0f7a9ad7d2ec5a8aa81017d03910825"
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "Preserved-page user-visible copy resolves through t() (01-04 truth 1, reachable-surface clause)"
    addressed_in: "Phase 15"
    evidence: "Phase 15 goal: 'Full surfaces, Options, Notes workspace, workflow routing and RICH waves on the design system.' The StandaloneWritePage copy belongs to Phase 17 (Write is a first-party add-on). Recorded as a human decision item below — if the operator rules the preserved-page literals acceptable, this deferred entry is its disposition."
  - truth: "Live fixture validation failure states (invalid credential / provider unavailable / network unavailable / cancelled) exercised end-to-end in the browser"
    addressed_in: "Phase 3"
    evidence: "Phase 3 goal: 'The Planner → Executor → Renderer pipeline runs on the four providers...'. Owner recorded in 01-VALIDATION.md § Environment-scoped open gaps item 1 (plan 01-09 / Phase 3): the shipped roots wire createFixtureValidationPort('success'); the five non-success selectors exist and are unit-covered, and the live failure path arrives with the real provider port."
human_verification:
  - test: "Rule on the 01-04 i18n residual: accept the recorded exception for preserved-page copy, or reopen a copy sweep"
    expected: "Either (a) accept — add an `overrides:` entry for 'no Phase-1 component carries an inline literal' (template supplied in the Gaps/Human sections below) and re-verify to reach `passed`; or (b) reopen — move the reachable strings into src/core/i18n/strings.ts (or record the exception explicitly per the IN-05 suggested fix)."
    why_human: "Verified programmatically and NOT met under the strict reading: src/components/notes/NotesWorkspace.tsx carries 35 visible-text literals ('Directory', 'Notes', 'Inspector', 'All Notes', …), src/components/options/OptionsPage.tsx 26, src/components/history/ChatHistoryModal.tsx 2, and StandaloneWritePage.tsx:90 defaults its input to 'This is wrong page'. All four pages are reachable in Phase 1 (Notes and Options from the Sider/command, history from the Chat header, Write from the Sider). 01-04's own plan text scopes the prototype components out ('the prototype keys still consumed by … options/** and standalone/** must remain resolvable') and 01-REVIEW.md records this as IN-05 Info, outside the operator's `critical_warning` fix scope — so the two readings diverge and only the operator can rule."
  - test: "Re-observe the 01-VALIDATION.md manual set against the REBUILT post-fix extension"
    expected: "Side Panel opens with onboarding on a fresh profile; Cmd+K palette on both surfaces, chord closes it; Open Standalone view opens once and re-running focuses the existing tab with no duplicate; the composer draft typed in the Side Panel arrives in the Standalone Write composer and does NOT reappear after leaving the Write route and returning; Open Options focuses the existing Options tab instead of creating a duplicate; theme toggle updates both surfaces with no reload; legacy-credential notice shows once and is dismissible; every deferred/fixture page shows its panel and no perpetual skeleton."
    why_human: "The 2026-09-22 operator acceptance was performed on a `.output/chrome-mv3` that PREDATES the review fixes (artifact mtime 2026-09-22 21:54 vs fix commits 34df48a8…3ef63cc6). CR-02 specifically broke the D-13 handoff in a real browser, WR-06 rewrote the openOptions dedupe, WR-07/WR-09 changed the draft path, and WR-05 changed rendered UI. 01-REVIEW-FIX.md and 01-REVIEW.md both flag manual re-observation rows for the CR-02 handoff and the WR-09 draft non-resurrection. This verifier rebuilt `.output/chrome-mv3` from current source (manifest byte-identical to the pre-fix artifact), but jsdom cannot open a Side Panel or exercise `chrome.storage.onChanged` across two real surfaces."
  - test: "Observe the Windows/Linux control chord in a real Chrome on Windows or Linux"
    expected: "Ctrl+K opens the palette on both surfaces and the chord closes it; the production build carries no Reload extension command."
    why_human: "01-VALIDATION.md § Environment-scoped open gaps item 2 (owner Phase 15 / 01-08 follow-up): observed on macOS only. The Windows/Linux branch is unit-covered (tests/core/input/KeymapRegistry.test.ts 'fires the same Cmd+K registration when the platform reports the control key') but OS-level chord handling cannot be observed on this macOS host."
  - test: "Abstained non-inferable (backstop) truth — 01-12: 'a page marked fixture-backed that is later reached by a real async Phase-1 operation shows its loading state rather than its deferred marker'"
    expected: "If/when a real async Phase-1 operation reaches a marked page, that page must render its loading state, not its deferred marker."
    why_human: "insufficient_spec — no test exercises this property and Phase 1 ships no real async page-level operation to observe (the only async path, onboarding validation, is a modal). Recorded rather than silently absorbed; Phase 1 has no case in which it is falsifiable."
---

# Phase 1: MV3/WXT Runtime + AntD Shells + Workspace — Verification Report

**Phase Goal:** The extension boots on MV3/WXT with both surfaces (Chat-only Side Panel; Standalone workspace), the shared workspace handoff, theme store, messaging/eventing and shell contracts in place.
**Verified:** 2026-09-22T21:43:48Z
**Status:** human_needed
**Re-verification:** No — initial verification (no prior `*-VERIFICATION.md` existed in the phase directory)

**Evidence base:** every claim below was re-derived from the working tree at `9f3842ac` — source read directly, the phase gate re-run by this verifier, a fresh `pnpm run build` executed twice, the generated manifest inspected, and the built bundles searched. No SUMMARY.md statement was accepted as evidence, and 01-REVIEW.md / 01-REVIEW-FIX.md status lines were treated as claims about the source, not as proof. The REVIEW.md narrative itself was falsified in one respect: it states the phase suite is "41 files / 560 tests" and its `status: issues_found` reflects the loop cap, not the source — the current tree is **41 files / 569 tests, exit 0** (WR-10's fixes added the nine cases after that review).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | **SC1** — Side panel opens; onboarding appears on fresh install; the Cmd+K palette opens with the Flow 10 command set on both surfaces | ✓ VERIFIED | `.output/chrome-mv3/manifest.json` → `side_panel.default_path: "sidepanel.html"` and one `XProvider` in `src/entrypoints/sidepanel/main.tsx`; `useOnboardingGate` + `OnboardingFlow` mounted in both surface roots; `CommandRegistry` populated by `registerSidepanelCommands`/`registerStandaloneCommands` and rendered by `CommandPalette`; `KeymapRegistry.matchesKeymap` compares the resolved primary against `e.metaKey \|\| e.ctrlKey`. Suites green in the gate: SidePanelShell (14), OnboardingFlow (21), CommandPalette (14), KeymapRegistry (15), registerWorkspaceCommands (21). Operator real-Chrome observation 2026-09-22 covers the macOS chord; the Windows/Linux OS chord is a human item |
| 2 | **SC2** — Standalone view opens from the Side Panel with correct workspace handoff, and re-opening focuses the existing tab (no duplicates) | ✓ VERIFIED | `planStandaloneTarget` queries `standalone.html*` and reuses `tabs[0]` (focus + re-point) before ever calling `tabs.create`; `createHandoffInitiator` subscribes before opening, publishes only after a correlated `HANDOFF_READY`, and resolves success only on a validated `HANDOFF_ACK`; `createHandoffTarget` applies at most once per request id. Behavior-dependent invariant exercised by a passing test: `WorkspaceHandoff.test.ts` case "completes ready → transfer → acknowledgement through the real bus, with no transport field reaching validation" (1 passed / 30 skipped when run by name); 31 cases total, plus WorkspaceRouter (23) |
| 3 | **SC3** — A theme change (single `np_theme` source) applies to both surfaces immediately without reload; density is fixed per surface | ✓ VERIFIED | `ThemeStore` is the single writer of `np_theme` (`partialize` = mode/colorTheme/pack, `version: 1`, throw-free `themeMigrate`); `ThemeSync.startThemeOnChangedSync` reads the sync area's `chrome.storage.onChanged` only, with a same-value no-op; `useThemeSync` is called once per surface root; `compact: true` in the Side Panel root, `compact: false` in Standalone. Tests: ThemeStore (28), ThemeSync (14, incl. "a mode written by surface A reaches surface B with no reload and no per-surface copy"), antdConfig (14) |
| 4 | **SC4** — Background router registers listeners synchronously; RuntimeEnvelope fixtures parse; EventBus/WorkspaceStore/WorkspaceRouter/ThemeStore suites pass | ✓ VERIFIED | `src/entrypoints/background.ts` calls `BackgroundRouter.register()` before any `await` on every wake; `MessageBus.init()` is idempotent and attaches exactly one `chrome.runtime.onMessage` listener. Named suites green in the re-run gate: RuntimeEnvelope (27), EventBus (5), WorkspaceStore / WorkspaceRouter / ThemeStore; cold-start sync attachment asserted by `message-bus-cold-start` (17 cases) |
| 5 | **SC5** — `pnpm run verify:phase-1` passes and banned-import greps are zero | ✓ VERIFIED | Re-run by this verifier: **exit 0** — `tsc --noEmit` clean, 15 declared paths resolve, **41 files / 569 tests passed**, `✓ verify-no-tailwind: 0 Tailwind utility strings in src`. `tests/isolation/banned-imports.test.ts` covers all three groups (innerHTML/dangerouslySetInnerHTML; tailwind/shadcn/@radix-ui incl. `package.json`; framer-motion incl. `package.json`) plus a non-match case for the approved `motion` v12, each asserting a non-zero scanned-item count |
| 6 | **01-02** — The extension boots end-to-end through WXT on one path; exactly one provider root per surface; `@` resolves consistently; `.wxt/**` untracked | ✓ VERIFIED | `pnpm run build` exits 0; `.output/chrome-mv3/` holds `background.js`, `sidepanel.html`, `standalone.html`, no `options.html`; exactly one `createRoot` call and one `<XProvider>` per entrypoint and none in `src/components`/`src/core`; `git check-ignore .wxt` → `.gitignore:194` and `git ls-files .wxt` empty; `tsc --noEmit` (shared `@/` paths) and the full suite resolve the same root |
| 7 | **01-02/01-03** — Build relocation is idempotent; the generated manifest is asserted by an automated test, not by eye | ✓ VERIFIED | `pnpm run build` run twice in this verification: `manifest.json` sha256 `5937a663…12b55` identical before and after, and identical to the pre-existing artifact. `tests/isolation/generated-manifest.test.ts` (10 cases) asserts the exact permission array, `side_panel.default_path`, both options keys absent, the Phase-1 CSP by string equality, the authorised host set, and `content_scripts` absence; it throws (never skips) when the artifact is missing |
| 8 | **01-04** — Canonical Phase-1 string map + total `format()`; copy-exactness pinned; no credential-shaped value | ⚠️ UNCERTAIN | The map, `format()`, and the 16-case gate are real and green (`tests/core/i18n/strings.test.ts`), including the credential-shape absence case — but the truth's clause "no Phase-1 component carries an inline literal" is **observably false for reachable surfaces** (NotesWorkspace 35 visible-text literals, OptionsPage 26, ChatHistoryModal 2, StandaloneWritePage:90 `'This is wrong page'`). See Human Verification item 1 — a human decision, not a code-fix cycle, because 01-04's own action text scopes the prototype components out and 01-REVIEW.md records it as IN-05 |
| 9 | **01-05** — Single `np_theme` source, one writer, `onChanged` propagation, density fixed per surface, packs unreachable from the UI | ✓ VERIFIED | `src/core/theme/ThemeStore.ts` is the only writer; no component calls `setPack`, and no `liquid-glass`/`claude-warm`/pack selector appears under `src/components` or `src/entrypoints`; `applyThemeDom` is the only `.dark`-class writer; idempotency pinned by "writing the same mode twice produces one `np_theme` write and no second propagation" |
| 10 | **01-06** — Validated `RuntimeEnvelope` at every boundary; sender guard; synchronous registration; handler isolation; malformed envelope never half-applied | ✓ VERIFIED | `RuntimeEnvelopeValidation.validateEnvelope` rejects unknown structural fields, unknown types (`hasOwn`, CR-01), invalid operation id/timestamp/source and schema-failing payloads; `MessageBus.init` rejects any `sender.id` that is absent or ≠ `chrome.runtime.id` before validating; `dispatchEnvelope` isolates synchronous throws via try→`Promise.reject` + `allSettled`. Behavior exercised by `message-bus-cold-start.test.ts` including "two concurrent dispatches do not interleave into a partially-applied envelope" and the three sender-rejection cases |
| 11 | **01-07** — Frozen `WorkspaceState`; never persisted; READY→TRANSFER→ACK with ack-gated success; validated URL bootstrap; no duplicate tabs | ✓ VERIFIED | `workspaceStateSchema` is `.strict()` with bounded fields, credential-shaped-value guards and inert later-phase fields; `WorkspaceStore` exposes only the five authorised setters and no `setActiveProvider`/`setSelectedModel` exists anywhere; `np_workspace` appears only as the `BroadcastBus` channel name and `np_workspace_store` only in the delete-only legacy module; `parseHandoffUrl` normalises then validates with six typed codes; `buildHandoffUrl` sets each parameter explicitly. 31 handoff cases + 23 router cases + 16 state cases |
| 12 | **01-08** — Cmd+K on macOS and Ctrl+K elsewhere; one global listener; `preventDefault` first; `KEYMAP_CONFLICT`; the Phase-1 command set; dev-only reload excluded from production | ✓ VERIFIED | `matchesKeymap` uses `PRIMARY_TOKENS` vs `e.metaKey \|\| e.ctrlKey`; `preventDefault()` precedes the handler; duplicate id throws `KeymapConflictError`; `KeymapRegistry` attaches/detaches the single document listener on map emptiness. The production bundles contain **zero** occurrences of the `reload-extension` id while carrying the other four command ids — `import.meta.env.DEV` folded the branch out |
| 13 | **01-09** — Complete onboarding interaction shell; fixture-backed typed port; no network/SDK; canonical codes; key memory-only; one shared flow; no auto-open on install; one typed completion record | ✓ VERIFIED | `OnboardingFlow` renders four steps with `closable={false}`, `keyboard={false}`, `mask={{closable:false}}`; `clearCredential` runs on complete, skip, edit and closure; `createFixtureValidationPort` maps six selectors onto `success`/`PROVIDER_AUTH`/`PROVIDER_5XX`/`NETWORK`/`PROVIDER_CHECK_FAILED` and imports no SDK; `background.ts` opens no surface. 21 onboarding cases incl. sentinel-absence, "never calls fetch", "does not dismiss on Escape", "never advances on a timer" |
| 14 | **01-10** — Idempotent, redacted, throw-free legacy credential cleanup; metadata preserved; no relocation; one neutral dismissible notice | ✓ VERIFIED | `legacyCredentialCleanup.ts` removes only recognised field names, stamps `CLEANUP_SCHEMA_VERSION`, logs field names only, and is wired into both `onStartup` and `onInstalled` inside the existing registration contract. 15 unit cases + 4 wiring cases incl. idempotence, byte-for-byte preservation, totality for null/array/cyclic input, and "destroys the credential in place and relocates it nowhere" |
| 15 | **01-11** — Credential-free persisted schemas; no raw model selector writing a provider/model; prototype hosts and dev shell removed; WXT the single runtime | ✓ VERIFIED | `PersistedProviderConfig` has no credential-bearing field; every prototype removal target is absent (`OnboardingModal.tsx`, the chat host/streaming/composer modules, `tailwindEquivalents.ts`, `src/main.tsx`, `index.html`, `vite.config.ts`, the two prototype tests, `TeamsPanel.tsx`, `WorkspaceSidebar.tsx`, both route stubs); `PromptIcon.tsx` now imports the approved `@ant-design/icons` set; `package.json` has no banned icon package; all dev/build/zip scripts resolve to WXT; `index.html` and `vite.config.ts` absent |
| 16 | **01-12** — One `DeferredNotice`/`Phase1Backing` convention; every non-Phase-1 page carries one D-16 disposition; no perpetual skeleton; no fabricated signal | ✓ VERIFIED | `Phase1Backing = 'fixture' \| 'deferred'` with no third value; 32 `deferred` + 11 `fixture` literal attribute sites and no variable-valued marker; `tests/components/pages/chat-page.test.tsx` audits the whole-repo marker set (all-literals case, every-preserved-page case, removed-file case, literal-vs-variable case); `StandaloneShell` (18) / `SidePanelShell` (14) / `DeferredNotice` (12) tests assert presence on marked regions **and** absence on live regions, with positive controls |
| 17 | **01-13** — Repo-level banned-import gate with teeth; `verify:phase-1` composition; suite growth over baseline | ✓ VERIFIED | `tests/isolation/banned-imports.test.ts` has one case per pattern group, a dependency-manifest half, an approved-library non-match and per-case non-zero scan counts; per-group scratch-file teeth were observed and recorded in commit `3b3841e7` before the commit; `package.json` `verify:phase-1` names `tests/core/{runtime,events,workspace,theme,commands,input,onboarding,storage,strict}`, `tests/core`, `tests/background`, `tests/components`, `tests/isolation`, `tests/services`, `scripts/verify-no-tailwind.sh`, plus a path-resolution preflight; 569 tests > the 166-test pre-phase baseline; `NP_STRICT_CEILING` is `0` |
| 18 | **01-01** — The D-04 migration inventory is frozen and non-ambiguous; D-16 dispositions assigned; research hand-off questions resolved | ✓ VERIFIED | `01-MIGRATION-INVENTORY.md` carries the D-04 conversion map with all 13 plan ids referenced (69/12/4/48/34/42/31/49/18/104/100/17 occurrences), a 25-row D-16 disposition table using only `fixture-preview` (16) / `deferred-shell` (6) / `remove` (3), the `Resolved hand-off decisions` table with H-1…H-9 + OQ1…OQ7 each naming a deciding plan and owner, three change-control records and the D-01-10-1 operator decision record. Document-inspection verification (no test exists for internal consistency); the eight research questions are each answered |

**Score:** 17/18 truths verified (0 present, behavior-unverified)

### Deferred Items

Items not met in Phase 1 but explicitly owned by a later milestone phase. Informational — not actionable gaps.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Preserved-page user-visible copy resolves through `t()` | Phase 15 (Options / Notes workspace) and Phase 17 (Write) | Phase 15 goal: "Full surfaces, Options, Notes workspace, workflow routing and RICH waves on the design system"; D-16 dispositions mark `NotesWorkspace` → Phase 8, `OptionsPage`/`ChatHistoryModal` → Phase 15, `StandaloneWritePage` → Phase 17. Subordinate to Human Verification item 1 |
| 2 | Live fixture validation failure states exercised in the browser | Phase 3 | Phase 3 goal: "The Planner → Executor → Renderer pipeline runs on the four providers…". Recorded with owner 01-09 / Phase 3 in `01-VALIDATION.md` § Environment-scoped open gaps item 1 |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/entrypoints/{sidepanel,standalone}/main.tsx` | One provider chain per surface, one `createRoot` | ✓ VERIFIED | 1 `createRoot` call + 1 `<XProvider>` each; no provider in `src/components`/`src/core` |
| `src/entrypoints/background.ts` | Synchronous router registration + install/startup migrations | ✓ VERIFIED | `BackgroundRouter.register()` before any `await`; cleanup + onboarding migration in both handlers; no surface opened |
| `src/core/runtime/RuntimeEnvelopeValidation.ts` | Strict per-type payload schemas, own-property type lookup | ✓ VERIFIED | 15 canonical + 5 scaffold schemas, `.strict()`, `hasOwn` (CR-01), bounded strings |
| `src/core/messaging/{MessageBus,BackgroundRouter}.ts` | Sender-guarded listener, payload-validated dispatch | ✓ VERIFIED | `sender.id !== chrome.runtime.id` → no response; `dispatch` validates before dispatch |
| `src/core/workspace/handoff/protocol.ts` | Three-message correlated protocol + URL allowlist | ✓ VERIFIED | 3 strict schemas; `buildHandoffUrl` allowlist-only; `parseHandoffUrl` normalise-then-validate, 6 typed codes |
| `src/core/workspace/WorkspaceRouter.ts` | Dedupe/focus, ack-gated success, validated hydrate | ✓ VERIFIED | `tabs.query` reuse-then-create; `hydrateFromURL` validates first; WR-06 route comparison in the callback |
| `src/core/workspace/WorkspaceState.ts` | Frozen §8.4 shape, strict schema, total migration | ✓ VERIFIED | `.strict()`, 13 fields, safe defaults, clock-free deterministic migration |
| `src/core/theme/{ThemeStore,ThemeSync,antdConfig}.ts` | Single writer, onChanged propagation, deterministic config | ✓ VERIFIED | `np_theme` one writer; `startThemeOnChangedSync` the only propagation path; `getAntdConfig` deterministic |
| `src/core/input/KeymapRegistry.ts` | Primary-modifier matcher, single listener, typed conflict | ✓ VERIFIED | `PRIMARY_TOKENS`; `preventDefault` before handler; `KeymapConflictError` code `KEYMAP_CONFLICT` |
| `src/components/common/CommandPalette.tsx` | Token-derived, registry-driven palette, 12 px floor | ✓ VERIFIED | Renders `CommandRegistry` contents; `LABEL_FLOOR_PX = 12`; destructive confirm gate; query never persisted |
| `src/components/onboarding/OnboardingFlow.tsx` | Four-step shared flow, memory-only credential | ✓ VERIFIED | 4 steps; Escape-proof; `clearCredential` on every terminal boundary; abortable |
| `src/services/fixtures/providerValidationFixtures.ts` | Six-selector fixture adapter, no network/SDK | ✓ VERIFIED | Passed through the typed port; no runtime HTTP path |
| `src/core/storage/legacyCredentialCleanup.ts` | Idempotent redacted cleanup, field names only | ✓ VERIFIED | Version-stamped, throw-free, removes recognised names only |
| `src/components/common/DeferredNotice.tsx` | `Phase1Backing` + one marker component | ✓ VERIFIED | Two literals, no third; inline tag / block alert; full-sentence `aria-label` |
| `01-MIGRATION-INVENTORY.md` | Frozen conversion map, D-16 rows, resolved decisions | ✓ VERIFIED | See truth 18 |
| `package.json` | Realigned `verify:phase-1`, `NP_STRICT_CEILING: 0` | ✓ VERIFIED | 15 declared paths + preflight + no-tailwind gate; ceiling 0 |
| `tests/isolation/{banned-imports,generated-manifest,no-tailwind-gate,cross-entrypoint-imports}.test.ts` | Four isolation gates, none vacuous | ✓ VERIFIED | Non-zero scan counts, missing-root refusal, 40-case tailwind self-test, teeth cases |
| `.output/chrome-mv3/` | Least-privilege MV3 build | ✓ VERIFIED | 3 permissions, ServiceNow hosts only, `connect-src 'none'`, no `content_scripts`/`options_ui`/`options_page`; rebuilt from current source |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `KeymapRegistry` matcher | `document` keydown → `preventDefault` → palette toggle | `KeymapRegistry.register({ keys: 'Cmd+K' })` in both entrypoints | WIRED | One document listener; the entrypoints register no listener of their own (source scan asserted by a test) |
| `CommandRegistry` contents | palette rows | `CommandPalette commands={CommandRegistry.getAll()}` | WIRED | Registry is the single place a command is added |
| `Toggle theme` command | `cycleThemeMode()` → `np_theme` | `registerWorkspaceCommands` → `ThemeStore.setMode` + `persistThemeNow` | WIRED | One write path; no palette-owned copy |
| `parseHandoffUrl` | `hydrateFromURL` → tabs create/focus → `useWorkspaceHandoff` | `StandaloneShell` effect calls `hydrateFromURL(window.location.search)` | WIRED | Validated before use; disposer unsubscribes on unmount |
| `HANDOFF_READY` → `WORKSPACE_HANDOFF` → `HANDOFF_ACK` | success claim | correlation on `requestId`, idempotent target apply | WIRED | Behavior proven by the cross-instance real-bus test |
| `BroadcastBus.publish` transport `_sender` | strict handoff schemas | `withoutTransportMetadata` strips before listeners (CR-02) | WIRED | Regression case asserts no transport field reaches validation |
| `ProviderValidationPort` | fixture adapter (Phase 1) | `createFixtureValidationPort('success')` in both roots | WIRED | Phase 3 swaps one argument |
| `OnboardingState` record | both surfaces' render gates | `useOnboardingGate` → `readOnboardingState` | WIRED | One key `np_onboarding`, one typed record, v1 migrated |
| `Phase1Backing` literal | `data-np-backing` → presence/absence assertions | literal attributes on region roots | WIRED | Repo-wide scan asserted by `chat-page.test.tsx` |
| `sanitizeLegacyProviderConfig` | `chrome.storage.local` write-back | `runLegacyCredentialCleanup` on install + startup | WIRED | Write-back only when a removal occurred |
| `verify:phase-1` path list | every phase suite | explicit path list + resolution preflight | WIRED | 15 declared paths resolve; `tests/services` and `tests/isolation` included |
| `wxt.config.ts` manifest block | `.output/chrome-mv3/manifest.json` | generated-manifest test | WIRED | Asserted by equality, not observation |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `CommandPalette` | `commands` prop | `CommandRegistry.getAll()`, populated by surface registration at mount | Yes — the four/five Phase-1 commands with live actions | ✓ FLOWING |
| `OnboardingFlow` | validation result | `ProviderValidationPort` → `createFixtureValidationPort('success')` | Deterministic fixture (declared Phase-1 backing, disclosed by the marked notice) — not a stub | ✓ FLOWING (fixture, disclosed) |
| Surface roots | `mode`/`pack` → `getAntdConfig` | `useThemeStore` (hydrated from `chrome.storage.sync.np_theme`) + `chrome.storage.onChanged` | Yes — the persisted mode; `np_theme` is the only source | ✓ FLOWING |
| `StandaloneWritePage` | `handoffDraft` | `useHandoffComposerDraftStore` ← `Projection.composerDraft` ← Side Panel `composerDraftRef` ← textarea `onChange` | Yes — live user input, ephemeral memory only; consumed once (WR-09) | ✓ FLOWING |
| `hydrateFromURL` | `workspaceId`/`conversationId` | `window.location.search` validated by `parseHandoffUrl` | Yes — the validated bootstrap | ✓ FLOWING |
| `LegacyCredentialCleanupNotice` | shown-state | `OnboardingState.legacyCleanupNoticeShown` | Yes — the single non-secret record field | ✓ FLOWING |
| `StandaloneShell` Sider | `registeredAddons` | `AddonRegistry.getAll()` | Yes — empty in Phase 1, so the Add-ons group is correctly absent (positive control in the suite) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase gate passes end to end | `pnpm run verify:phase-1` | exit 0 — 15 declared paths resolve, 41 files / 569 tests passed, `✓ verify-no-tailwind: 0 Tailwind utility strings in src` | ✓ PASS |
| §24 minimum path set (quick run) | `npx vitest run tests/core/runtime tests/core/events tests/core/workspace tests/core/theme` | 10 files / 178 tests passed (VALIDATION.md recorded 172) | ✓ PASS |
| Build is reproducible and idempotent | `pnpm run build` ×2 + `shasum -a 256 manifest.json` | both runs exit 0; manifest sha256 `5937a663…12b55`, byte-identical and identical to the pre-existing artifact | ✓ PASS |
| Generated manifest is the authorised shape | `python3 -c "json.load(open('.output/chrome-mv3/manifest.json'))"` | keys = action, background, content_security_policy, description, host_permissions, icons, manifest_version, name, permissions, side_panel, version; `permissions == [sidePanel, storage, tabs]`; no `content_scripts`/`options_ui`/`options_page`; CSP `connect-src 'none'` | ✓ PASS |
| Handoff reaches ACK through the real bus (behavior-dependent truth) | `npx vitest run tests/core/workspace/WorkspaceHandoff.test.ts -t "completes ready"` | 1 passed / 30 skipped — the single named test that exercises the ready→transfer→ack transition | ✓ PASS |
| Global keyboard path has no leaks | `npx vitest run tests/core/input/KeymapRegistry.test.ts` | 15 passed, incl. the macOS meta-key case, the Windows/Linux control-key case and the repeated register/unregister listener count | ✓ PASS |
| Destructive command absent from production build | `python3` scan of `.output/chrome-mv3/**/*.js` | `reload-extension` count 0 across all bundles; the other four command ids present | ✓ PASS |
| Tailwind gate has teeth | `npx vitest list tests/isolation/no-tailwind-gate.test.ts \| wc -l` + gate run | 40 self-cases; `bash scripts/verify-no-tailwind.sh` on `src` → exit 0; the script refuses a missing scan root | ✓ PASS |
| No disabled/skipped tests anywhere | `grep -rnE "it\.skip\|describe\.skip\|xit\(\|it\.only\|\.todo" tests/` | zero matches | ✓ PASS |

### Probe Execution

| Probe | Command | Result | Status |
| ----- | ------- | ------ | ------ |
| — | — | No probe scripts exist: `find scripts -path '*/tests/probe-*.sh'` returned nothing, and no PLAN.md declares a probe path (the word "probe" appears only in inline shell/`node -e` verify blocks). Step 7c is therefore **N/A** for this phase; the phase's executable acceptance instrument is `pnpm run verify:phase-1`, which was executed above. | N/A |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| CORE-01 | 01-01…01-13 | MV3/WXT runtime + two surfaces + shared handoff + theme store + RuntimeEnvelope/EventBus/registries/shells | ✓ SATISFIED | Truths 1–7, 9–11, 15–18; gate exit 0 |
| SP-02 | 01-07 | Open Standalone view action with workspace handoff | ✓ SATISFIED | Truth 2; `openStandalone` + `registerSidepanelCommands` |
| SP-08 | 01-05 | Theme toggle light/dark/auto via `chrome.storage.sync.np_theme` | ✓ SATISFIED | Truth 3; `cycleThemeMode` wired to the palette command in both surfaces |
| SP-09 | 01-08 | Cmd+K palette, includes "Open Standalone view" | ✓ SATISFIED | Truth 12; command set registered and rendered |
| SA-08 | 01-09, 01-10, 01-11 | First-run onboarding entry point when no provider is configured | ✓ SATISFIED | Truth 13; `useOnboardingGate` + typed completion record |
| SA-09 | 01-08 | Cmd+K palette, same command set plus Standalone-only commands | ✓ SATISFIED | Truth 12; `registerStandaloneCommands` adds `focus-side-panel` |
| SA-10 | 01-08 | "Focus Side Panel" opens the Side Panel for the current tab | ✓ SATISFIED | `openSidePanelForCurrentTab` issues `sidePanel.open` inside the tab-query callback with no intervening `await`; 3 typed failure codes; unit-covered + browser-observed (VALIDATION item 4) |
| APPR-03 | 01-05 | Single source of truth `np_theme`; no `themeMode` on `UserPreferences`; `onChanged` propagates | ✓ SATISFIED | Truth 3/9; `useExtensionStore` carries no theme mode; `ThemeSync` is the only propagation path |
| APPR-04 | 01-05 | Each surface re-derives `getAntdConfig({mode, pack, compact})`; no remount | ✓ SATISFIED | Truth 3/9; `getAntdConfig` deterministic case + the no-second-re-derive case |
| APPR-05 | 01-05 | Density not user-configurable; Side Panel compact, Standalone default | ✓ SATISFIED | `compact: true` / `compact: false` at the two roots; no density control anywhere |
| FLOW-8 | 01-08 | Keyboard shortcut — registry global keydown → handler → preventDefault | ✓ SATISFIED | Truth 12 |
| FLOW-9 | 01-09 | First-run onboarding persona → provider → key → validate | ✓ SATISFIED | Truth 13; four-step flow + fixture validation |
| FLOW-10 | 01-08, 01-12 | Cmd+K command palette — filtered command list | ✓ SATISFIED | Truth 12/16; `CommandPalette` filters the registry contents |
| FLOW-11 | 01-07 | Open Standalone view — dedupe → hydrate → WORKSPACE_HANDOFF | ✓ SATISFIED | Truth 2/11 |

**Orphaned requirements:** none. Every Phase-1 id in `REQUIREMENTS.md` (`CORE-01, SP-02, SP-08, SP-09, SA-08, SA-09, SA-10, APPR-03, APPR-04, APPR-05, FLOW-8, FLOW-9, FLOW-10, FLOW-11`) is declared in at least one PLAN's `requirements:` field, and the union of declared ids contains no id outside that set. `APPR-06` (theme pack selector) is correctly scoped to Phase 15 and is not claimed here.

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts — `{ total: 16, honored: 16, not_honored: [] }` (non-blocking warning gate; `workflow.context_coverage_gate` enabled).

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| `tests/core/workspace/WorkspaceHandoff.test.ts` | SP-02, FLOW-11 | 31 | 0 | No (real modules + real bus; fixture is test-supplied input, not system-generated expectations) | Behavioral | ✓ STRONG |
| `tests/core/workspace/WorkspaceRouter.test.ts` | SP-02, FLOW-11 | 23 | 0 | No | Behavioral | ✓ STRONG |
| `tests/core/workspace/WorkspaceState.test.ts` | D-11, D-14 | 16 | 0 | No | Value | ✓ STRONG |
| `tests/core/input/KeymapRegistry.test.ts` | FLOW-8, SP-09, SA-09 | 15 | 0 | No | Behavioral (+ scan-teeth) | ✓ STRONG |
| `tests/core/theme/{ThemeStore,ThemeSync,antdConfig}` | SP-08, APPR-03/04/05 | 56 | 0 | No | Behavioral | ✓ STRONG |
| `tests/core/runtime/RuntimeEnvelope.test.ts` | CORE-01 | 27 | 0 | No | Value | ✓ STRONG |
| `tests/background/message-bus-cold-start.test.ts` | CORE-01 | 17 | 0 | No | Behavioral | ✓ STRONG |
| `tests/components/OnboardingFlow.test.tsx` | SA-08, FLOW-9 | 21 | 0 | No | Behavioral (sentinel absence, no-fetch spy) | ✓ STRONG |
| `tests/components/CommandPalette.test.tsx` | SP-09, SA-09, FLOW-10 | 14 | 0 | No | Behavioral | ✓ STRONG |
| `tests/core/storage/legacyCredentialCleanup.test.ts` (+ wiring) | SA-08, CORE-01 | 19 | 0 | No | Value | ✓ STRONG |
| `tests/isolation/*` | CORE-01, SC5 | 4 files | 0 | No | Scan + self-test teeth | ✓ STRONG |
| `tests/components/pages/*`, `SidePanelShell`, `StandaloneShell`, `DeferredNotice` | D-16, CORE-01 | 97 | 0 | No | Behavioral (presence **and** absence) | ✓ STRONG |

**Disabled tests on requirements:** 0 → no blocker. **Circular patterns detected:** 0 → no blocker (scan found no script that both imports the system under test and writes expected values). **Insufficient assertions:** 0 at WARNING level in the requirement-linked suites — every requirement-linked suite reaches value or behavioral level, and the isolation suites assert non-vacuous scan counts.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `src/entrypoints/background.ts` | 12 | Production `console.log` (IN-01) | ℹ️ Info | Bypasses `debugLog`; ships in the bundle. Carried over, outside the operator's `critical_warning` fix scope |
| `src/components/options/OptionsPage.tsx` | 368, 1103 | Fabricated success toast on a fixture-backed page (`'Help Center opened'`, `'Opened browser settings'`) (IN-02) | ⚠️ Warning | Violates the 01-12 marking convention hard rule 3 ("no fabricated signal"); the controls are inert |
| `src/components/standalone/StandaloneWritePage.tsx` | 476 | Fabricated success toast (`'Feedback support channel opened'`) (IN-02) | ⚠️ Warning | Same convention violation, same residual |
| `src/components/history/ChatHistoryModal.tsx` | 84 | Fabricated timestamp `'11:20 AM'` presented as user data (IN-04) | ⚠️ Warning | Violates "no fixture value presented as user data"; a fixture-backed overlay |
| `src/components/options/OptionsPage.tsx` | 107 | Unused store bindings (`prompts`, `deletePrompt`) + whole-store destructure (IN-03) | ℹ️ Info | Dead names and over-broad re-render subscription |
| `src/components/standalone/WriteHistoryDrawer.tsx` | 356 | `toLocaleDateString` carrying ignored hour/minute options (IN-04) | ℹ️ Info | Cosmetic; the time options never render |
| `src/components/notes/NotesWorkspace.tsx`, `src/components/options/OptionsPage.tsx`, `src/components/history/ChatHistoryModal.tsx`, `src/components/standalone/StandaloneWritePage.tsx:90` | — | Reachable user-visible literals bypassing `t()` (IN-05) | ⚠️ Warning | The evidence behind the single UNCERTAIN truth (row 8); counts: 35 / 26 / 2 literals + `'This is wrong page'` |
| `src/core/theme/ThemeStore.ts` | 13–18, 35, 152–156 (`ThemeSync.ts:14,65,101–107`) | `pack` persisted in **both** `np_theme.state.pack` and `np_theme_pack` | ℹ️ Info | Two representations of `pack`, both read and reconciled by `ThemeSync`; the mode (`APPR-03`'s subject) has one representation. `APPR-06` owns the pack key in Phase 15 |
| `.output/chrome-mv3/` | — | Build artifact predated the review fixes at verification start | ℹ️ Info | Rebuilt by this verifier from current source; manifest byte-identical, bundle now current. The operator's manual acceptance still predates the fixes → Human Verification item 2 |

**Debt-marker gate:** clean — no `TBD`/`FIXME`/`XXX` in any file touched by this phase (`src/`, `tests/`, `scripts/`, configs). The three `grep` hits in `src/assets/icons/avatarData.ts` are inside base64 image payloads, not markers. One `TODO`-shaped comment exists at `src/entrypoints/background.ts:33` but it is a labelled list of later-phase registrations (owned by Phases 2/17), not an unreferenced debt marker.

### Human Verification Required

#### 1. Rule on the 01-04 i18n residual (blocks nothing automatic; needs a decision)

**Test:** Decide whether the preserved-page / reachable-surface copy exception is acceptable.
**Expected:** One of —
- **(a) Accept.** Add to this file's frontmatter and re-verify:

  ```yaml
  overrides:
    - must_have: "Every user-visible string reachable in Phase 1 resolves through t('key') from src/core/i18n/strings.ts; no Phase-1 component carries an inline literal"
      reason: "The canonical map, its copy-exactness gate and format() are complete and green; the residual literals are prototype copy on D-16 fixture-preview pages whose content Phase 15 (Options/Notes) and Phase 17 (Write) own, and are recorded as IN-05 in 01-REVIEW.md outside the operator's critical_warning fix scope."
      accepted_by: "{your name}"
      accepted_at: "{ISO timestamp}"
  ```

- **(b) Reopen.** Move the strings the reachable pages render into `src/core/i18n/strings.ts` (or record the exception explicitly, per IN-05's suggested fix) and re-verify.

**Why human:** Verified programmatically and **not met under the strict reading** — `NotesWorkspace.tsx` (35 visible-text literals: 'Directory', 'Notes', 'Inspector', 'All Notes', 'Recently Updated', 'Favorites', …), `OptionsPage.tsx` (26), `ChatHistoryModal.tsx` (2), `StandaloneWritePage.tsx:90` (`'This is wrong page'`). All four are reachable in Phase 1. Against that, 01-04's own plan text scopes the prototype components out, 01-04-SUMMARY records the literals honestly, and 01-REVIEW.md classified them Info. Two defensible readings — only you can pick.

#### 2. Re-run the 01-VALIDATION manual set against the REBUILT post-fix extension

**Test:** Load `.output/chrome-mv3` unpacked in real Chrome (fresh profile) and repeat the six `01-VALIDATION.md` manual rows.
**Expected:** Side Panel + first-run onboarding; ⌘K palette on both surfaces (and the chord closes it); Open Standalone view opens once and re-running focuses the existing tab with **no duplicate**; the composer draft arrives in the Standalone composer and **does not reappear** after leaving the Write route and returning; Open Options **focuses** an existing Options tab; theme toggle updates both surfaces with no reload; the legacy-credential notice appears once and is dismissible; every deferred/fixture page shows its panel with no perpetual skeleton.
**Why human:** the operator's 2026-09-22 acceptance ran against an artifact that predates the fix commits `34df48a8`…`3ef63cc6`. CR-02 broke the handoff in a real browser; WR-06 rewrote the `openOptions` dedupe; WR-07/WR-09 changed the draft path; WR-05 changed rendered UI. jsdom cannot open a Side Panel or exercise `chrome.storage.onChanged` across two real surfaces. Both 01-REVIEW.md and 01-REVIEW-FIX.md flag these as manual re-observation rows.

#### 3. Observe the Windows/Linux control chord in real Chrome

**Test:** On Windows or Linux, press `Ctrl+K` on both surfaces.
**Expected:** The palette opens and the chord closes it; the production build has no Reload extension command.
**Why human:** `KeymapRegistry.test.ts` asserts the control-key branch, but OS-level chord handling is not observable on this macOS host. Recorded as environment-scoped open gap item 2 in `01-VALIDATION.md` (owner Phase 15 / 01-08 follow-up).

#### 4. Abstained non-inferable (backstop) truth — `insufficient_spec`

**Test:** When a real async Phase-1 operation first reaches a `data-np-backing`-marked page, confirm the page shows its **loading** state rather than its deferred marker.
**Expected:** loading state wins; the marker never masks an in-flight state.
**Why human:** no test exercises it and Phase 1 ships no real async page-level operation to observe (the only async path, onboarding validation, is a modal). Recorded rather than silently absorbed, per the backstop-abstention contract.

#### Operator Ruling (2026-09-22T22:51:18Z)

- **Item 1 — ACCEPTED.** Frontmatter `overrides:` entry added for the 01-04 inline-literal clause. The residual prototype copy on the reachable fixture-preview surfaces is owned by Phase 15 (Options/Notes) and Phase 17 (Write) via IN-05; no Phase-1 action.
- **Item 2 — OPERATOR VALIDATED.** The operator ruled the rebuilt post-fix `.output/chrome-mv3` manual set (handoff open-once/focus-existing, draft arrival and non-resurrection, Options dedupe, Back-chevron marking, theme propagation, credential notice, deferred/fixture panels) as passing on 2026-09-22. Recorded as an operator attestation; no per-item observation log was captured in this session.
- **Item 3 — DEFERRED (environment-scoped).** Windows/Linux control chord not observable on the macOS host; owner Phase 15 / 01-08 follow-up.
- **Item 4 — DEFERRED (insufficient_spec).** Unfalsifiable in Phase 1 (no real async page-level operation ships); revisit with the first async page operation.

#### Digest reconciliation (2026-09-23)

`covered_digest` was refreshed after the phase-completion transition updated `.planning/ROADMAP.md` — the only covered input that changed (the phase checkbox/progress write performed by `phase.complete`). No source, test, plan or summary input changed after verification; the drift was a false-positive `stale` produced by the completion flow itself. The refresh keeps the #4155 fingerprint truthful for the current covered inputs.

### Gaps Summary

**No blocking gaps.** Every roadmap success criterion as written is met with codebase evidence, and the phase gate is green on the current tree with a rebuilt, byte-stable artifact.

What the phase actually delivers, verified from source rather than from SUMMARY prose: the extension boots from WXT with exactly one provider chain and one React root per surface; the MV3 manifest is least-privilege with `connect-src 'none'` and no content script (operator Option C, pinned by a build-inspection test that fails rather than skips); the message boundary is envelope-validated with an own-property type lookup and a fail-closed sender guard; the handoff is a genuinely correlated three-message protocol whose success claim depends on an acknowledgement — the cross-instance real-bus test proves the ready→transfer→ack transition and the CR-02 transport-metadata regression; `WorkspaceState` is server-of-record-free in Phase 1 (no `np_workspace` write anywhere) and the stale prototype blob is delete-only; the theme has one writer and one propagation path with per-surface density fixed at the roots; the keyboard path has one listener, resolves the platform's primary modifier and is conflict-guarded; onboarding is a complete, Escape-proof, memory-only-credential flow backed by a typed fixture port; the legacy plaintext credential is destroyed in place with a version-stamped, throw-free, field-names-only report; and the D-16 fixture/deferred marking is enforced in both directions by a repo-wide scan. 569 tests pass in the phase gate, up from a 166-test pre-phase baseline, with no skipped or disabled cases.

One must-have truth is unresolved and is escalated rather than judged: **01-04's clause that no Phase-1 component carries an inline literal is observably false on four reachable surfaces** (63 visible-text literals between Notes/Options/History plus the Write page's `'This is wrong page'` default). The canonical string map, `format()` and copy-exactness gate are complete and green, the plan's own text scopes the prototype components out, and the phase's final review recorded the same facts as Info — so the miss is real but its disposition is a policy call. It is reported with an override template (Human Verification item 1) so you can accept the documented deviation in one step, or reopened if you would rather sweep the copy.

Residual non-blocking findings carried into Phase 15/17 planning: three fabricated-signal anti-patterns (two success toasts, one fabricated timestamp) on fixture-backed pages, a production `console.log` in the background entrypoint, unused store bindings, and the `pack` value living under two sync keys (`np_theme.state.pack` + `np_theme_pack`) — both read and reconciled, and `APPR-06` owns the pack key in Phase 15.

---

_Verified: 2026-09-22T21:43:48Z_
_Verifier: the agent (gsd-verifier)_
