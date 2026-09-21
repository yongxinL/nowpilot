---
schema_version: 1
open_count: 16
waived_count: 0
fixed_count: 4
total_count: 20
last_updated: 2026-09-21T23:08:31.024Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | src/entrypoints/content/index.ts |  | The generated manifest now carries content_scripts (matches <all_urls>, world ISOLATED) because the content script is at a WXT-discoverable path; the threat model (T-1-10) assumed the key stayed absent until 01-03. Injection scope is decided and asserted by plan 01-03 Task 2 (H-1, operator-gated). | fixed |  | 2026-09-21T12:13:21.694Z | 2026-09-21T20:48:47.055Z |
| 2 | 01 | stub | src/components/sidepanel/SidePanelShell.tsx |  | Both Phase-1 shells resolve every user-visible string through t() for keys that plan 01-04 lands (chat.emptyBody, chat.noProvider, chat.composerPlaceholder, shell.errorTitle/Body/Reload, a11y.*, standalone.minWidth). Until 01-04 lands, t() falls back to the key text. Intentional hand-off: 01-04 owns src/core/i18n/strings.ts and this plan was forbidden from editing it. | fixed |  | 2026-09-21T12:13:21.841Z | 2026-09-21T12:22:54.120Z |
| 3 | 01 | deviation | src/core/runtime/RuntimeEnvelope.ts |  | Verification-instrument deviation: the plan's grep for SIDE_PANEL_OPEN\|STANDALONE_OPEN across src/ and tests/ cannot return zero — the canonical §21.6 STANDALONE_OPEN_FAILED code in src/entrypoints/sidepanel/main.tsx contains the substring, 01-07's BroadcastBus union member 'STANDALONE_OPEN' lives in src/core/workspace/{WorkspaceSync,WorkspaceRouter}.ts, and the plan's own behavior case requires the suite to name both prototype spellings as negative assertions. 01-06 applies the production-scoped instrument (src/core/runtime + src/core/messaging) which returns 0. The phase verifier must use the scoped gate; replacing 01-07's transient BroadcastBus union member with the HandoffEnvelope protocol is the clean end state. | open |  | 2026-09-21T13:08:52.926Z |  |
| 4 | 01 | deviation | src/core/runtime/RuntimeEnvelope.ts |  | Spec-conformance question for phase acceptance: RuntimeEnvelope keeps operationId/timestamp (the plan requires the constructor and its assertions verbatim) while PRODUCT_SPEC Appendix C declares id/createdAt and an addon source variant. The divergence is one interface wide; decide whether to realign it before the envelope shape is consumed by later phases. | open |  | 2026-09-21T13:08:58.822Z |  |
| 5 | 01 | unrun-verify | src/components/standalone/StandaloneShell.tsx |  | Cross-surface handoff acceptance check not yet run: the suite proves the ready/transfer/ack contracts, store effects and published envelopes in one realm, but the real observation — a cold Standalone tab announcing readiness before the Side Panel publishes, the pinned pending/complete/failed copy, and no MirrorBanner after a successful open — needs two live Chrome surfaces and the UI wiring owned by 01-08/01-12. Run as a manual browser check at phase acceptance (01-07 coverage D8). | open |  | 2026-09-21T13:41:19.237Z |  |
| 6 | 01 | deviation | src/core/workspace/handoff/protocol.ts |  | Literal overlap for the acceptance review: the handoff transfer member uses WORKSPACE_HANDOFF, which 01-06 already declared as an Appendix E MessageType literal for the cross-context runtime envelope (payload {workspaceId}). The two are different domains (BroadcastBus channel payload vs chrome.runtime envelope) and this plan adds nothing to MessageType, but decide at acceptance whether the registry literal should be renamed before later phases consume it (01-07 summary, Deviations 7). | open |  | 2026-09-21T13:41:19.383Z |  |
| 7 | 01 | unrun-verify | src/components/onboarding/OnboardingFlow.tsx |  | 400 px modal-copy backstop not yet run: the must-have requires the onboarding modal content and step copy to hold at 400 px with no horizontal scroll, the body scrolling inside the modal and no mid-glyph clipping, and the step copy to wrap without clipping or horizontal scrolling across all four steps. The suite asserts the structure and the antd v6 modal max-width rule (calc(100vw - 16px) below the SM breakpoint) but the visual check needs a browser (01-09 must-have backstops). | open |  | 2026-09-21T14:29:50.042Z |  |
| 8 | 01 | unrun-verify | src/entrypoints/standalone/main.tsx |  | Two-live-surface onboarding check not yet run: the store suite proves the completion write propagates through chrome.storage.onChanged without a reload and the flow suite proves the sentinel key stays in component memory, but the real observation — Standalone presenting the same flow when it is opened first, no redirection to the Side Panel, the first surface staying active while the second starts no competing flow, and completion in one surface closing the other's flow — needs two live Chrome surfaces at phase acceptance (01-09 Task 3). | open |  | 2026-09-21T14:29:50.187Z |  |
| 9 | 01 | unrun-verify | src/components/standalone/StandaloneWritePage.tsx |  | Fixture/deferred page visual parity not yet browser-observed: the D-03 step-4 parity record compares the rendered shells against the UI-SPEC surface-contract metrics, but jsdom cannot observe layout, contrast, focus rings, container queries, scroll behaviour or the annotated references under .planning/design/references/. Plan 01-13 item 6 (real Chrome) is the browser-observed owner of every not-observable row. | open |  | 2026-09-21T15:05:48.830Z |  |
| 10 | 01 | deviation | src/components/standalone/WorkspaceSidebar.tsx |  | Inventory change-control C-01-12-A: WorkspaceSidebar.tsx changed ADAPT -> REMOVE. Plan 01-02 had already shipped the canonical Sider inside StandaloneShell.tsx, so the file had zero importers and remounting it would have created the parallel implementation D-02 forbids. Recorded with all six change-control fields in 01-MIGRATION-INVENTORY.md; the phase acceptance review should confirm the deletion rather than a remount. | open |  | 2026-09-21T15:05:54.819Z |  |
| 11 | 01 | deviation | src/components/common/ModelSelector.tsx |  | Inventory change-control C-01-12-B: ModelSelector removal timing corrected. The Write-page import site is replaced (read-only Auto workflow display) but the file itself cannot be deleted in 01-12 - its last importer is src/components/chat/ChatComposer.tsx, a 01-11 REMOVE row, so the deletion must land with that file's removal or the typecheck breaks. 01-11's teardown must take grep -rn 'ModelSelector' src/ to zero. | fixed |  | 2026-09-21T15:06:01.545Z | 2026-09-21T23:08:30.875Z |
| 12 | 01 | deviation | src/components/options/OptionsPage.tsx |  | Declared hand-off for phase acceptance: 01-12 removed the connection test and its provider-service import and disabled every store-writing control (Save, provider Switch), but the preserved Options page still reads useExtensionStore for its non-secret display state and still renders credential input fields. Plan 01-11 Task 1 owns the credential-field strip, the store REPLACE and the model paths on this file; the verifier must confirm that an unreachable disabled control, not a live path, is what remains. | fixed |  | 2026-09-21T15:06:14.006Z | 2026-09-21T23:08:31.024Z |
| 13 | 01 | unrun-verify | src/entrypoints/standalone/main.tsx |  | SA-10 real Chrome gesture evidence not yet run: the suite proves the open call is issued synchronously from the chrome.tabs.query callback with no awaited boundary before it, but chrome.sidePanel.open's gesture semantics are runtime-only (jsdom mocks the API). In a real Chrome MV3 build, open Standalone and run Focus Side Panel from the palette, then record the observed result; owned by the phase acceptance plan (01-VALIDATION manual row for SA-10). | open |  | 2026-09-21T21:18:51.278Z |  |
| 14 | 01 | deviation | src/core/i18n/strings.ts |  | New canonical key added by 01-08: sidepanel.openFailed ('Failed to open the side panel'). The UI-SPEC Copywriting Contract pins no copy for the Focus Side Panel failure path, but the task requires a typed, logged, user-visible failure rather than a silent one. The key is additive, resolves through t(), and is pinned in tests/core/i18n/strings.test.ts; the phase acceptance review should ratify the wording. | open |  | 2026-09-21T21:19:00.150Z |  |
| 15 | 01 | unrun-verify | src/components/common/LegacyCredentialCleanupNotice.tsx |  | D-07 neutral notice not yet observed in a real Chrome session: the suite proves the pinned copy, the pinned Dismiss label as the only exit and the shown-once behaviour in jsdom, but whether the notice actually presents once in the built extension is operator evidence. Seed a legacy apiKey into chrome.storage.local.np_store, reload the extension, confirm the neutral notice appears once and is dismissible, the field is gone and no second reload shows it; owned by the 01-VALIDATION manual row for D-07 (plan 01-13 item 5). | open |  | 2026-09-21T22:28:40.648Z |  |
| 16 | 01 | deviation | src/core/onboarding/onboardingStateStore.ts |  | 01-10 scope addition (Rule 2): the plan's Task 3 acceptance criteria require the neutral notice to render and its shown-state to live on the onboarding record, but neither the record field, the notice component, nor the two surface-root mounts appear in the plan's files_modified list. Added: legacyCleanupNoticeShown on the onboarding record (schema v2 with a v1 upgrader so a defaulted field never re-presents a completed flow), src/components/common/LegacyCredentialCleanupNotice.tsx, and the mounts in both surface roots. The phase acceptance review should ratify the scope and the record-shape change. | open |  | 2026-09-21T22:28:48.126Z |  |
| 17 | 01 | deviation | src/core/storage/legacyCredentialCleanup.ts |  | 01-10 instrument correction: the plan's Task 2 derived-value probe is syntactically invalid as written (its '\\.slice(0,' pattern reaches new RegExp with an unescaped '(' and throws SyntaxError before printing anything), so its fails_when condition can never be satisfied by the literal command. The corrected probe reads substring presence for the same seven tokens and prints ABSENT on the committed module; the verifier should not read the plan's literal command failure as a derived-value path. | open |  | 2026-09-21T22:28:48.171Z |  |
| 18 | 01 | deviation | src/types/index.ts |  | 01-11 scope addition (Rule 2): beyond the plan's enumerated deletions, the prototype's WorkflowId/WorkflowDefinition types and ProviderConfig.selectedWorkflow/workflowModelMapping fields were deleted with their last consumers (WorkflowSelector, ChatComposer) so the persisted provider shape carries no model-identifier mapping. The row's REPLACE classification and target path are unchanged; the phase acceptance review should ratify the wider trim. | open |  | 2026-09-21T23:08:30.367Z |  |
| 19 | 01 | deviation | package.json |  | 01-11 dependency judgement on the plan's conditional: @vitejs/plugin-react is removed (only vite.config.ts imported it; @wxt-dev/module-react supplies it transitively) but the top-level vite devDependency is RETAINED because vite/client is referenced by tsconfig types and src/vite-env.d.ts and vite is a peer of wxt/vitest — removing it would break the typecheck. pnpm-lock.yaml updated with pnpm install --lockfile-only; --frozen-lockfile passes. motion is retained (unreferenced by src/, permitted by the 01-13 gate). | open |  | 2026-09-21T23:08:30.539Z |  |
| 20 | 01 | deviation | src/main.tsx |  | 01-11 instrument/blocking fixes required by the plan's own gates: (a) the doomed dev shell's SidepanelChat import was replaced by the canonical SidePanelShell in Task 2 so npx tsc --noEmit stayed clean while the prototype hosts were deleted; (b) tests/components/pages/options-page.test.tsx and tests/components/LegacyCredentialCleanupNotice.test.tsx had to stop naming the removed export and the deleted suite, because the plan's teardown grep over src/ and tests/ reads those literal names and would otherwise fail on the suites that prove the teardown. | open |  | 2026-09-21T23:08:30.704Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01",
    "file": "src/entrypoints/content/index.ts",
    "line": null,
    "description": "The generated manifest now carries content_scripts (matches <all_urls>, world ISOLATED) because the content script is at a WXT-discoverable path; the threat model (T-1-10) assumed the key stayed absent until 01-03. Injection scope is decided and asserted by plan 01-03 Task 2 (H-1, operator-gated).",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-21T12:13:21.694Z",
    "resolved_at": "2026-09-21T20:48:47.055Z",
    "milestone": "v0.2"
  },
  {
    "id": 2,
    "kind": "stub",
    "phase": "01",
    "file": "src/components/sidepanel/SidePanelShell.tsx",
    "line": null,
    "description": "Both Phase-1 shells resolve every user-visible string through t() for keys that plan 01-04 lands (chat.emptyBody, chat.noProvider, chat.composerPlaceholder, shell.errorTitle/Body/Reload, a11y.*, standalone.minWidth). Until 01-04 lands, t() falls back to the key text. Intentional hand-off: 01-04 owns src/core/i18n/strings.ts and this plan was forbidden from editing it.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-21T12:13:21.841Z",
    "resolved_at": "2026-09-21T12:22:54.120Z",
    "milestone": "v0.2"
  },
  {
    "id": 3,
    "kind": "deviation",
    "phase": "01",
    "file": "src/core/runtime/RuntimeEnvelope.ts",
    "line": null,
    "description": "Verification-instrument deviation: the plan's grep for SIDE_PANEL_OPEN|STANDALONE_OPEN across src/ and tests/ cannot return zero — the canonical §21.6 STANDALONE_OPEN_FAILED code in src/entrypoints/sidepanel/main.tsx contains the substring, 01-07's BroadcastBus union member 'STANDALONE_OPEN' lives in src/core/workspace/{WorkspaceSync,WorkspaceRouter}.ts, and the plan's own behavior case requires the suite to name both prototype spellings as negative assertions. 01-06 applies the production-scoped instrument (src/core/runtime + src/core/messaging) which returns 0. The phase verifier must use the scoped gate; replacing 01-07's transient BroadcastBus union member with the HandoffEnvelope protocol is the clean end state.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T13:08:52.926Z",
    "resolved_at": null,
    "milestone": "v0.2"
  },
  {
    "id": 4,
    "kind": "deviation",
    "phase": "01",
    "file": "src/core/runtime/RuntimeEnvelope.ts",
    "line": null,
    "description": "Spec-conformance question for phase acceptance: RuntimeEnvelope keeps operationId/timestamp (the plan requires the constructor and its assertions verbatim) while PRODUCT_SPEC Appendix C declares id/createdAt and an addon source variant. The divergence is one interface wide; decide whether to realign it before the envelope shape is consumed by later phases.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T13:08:58.822Z",
    "resolved_at": null,
    "milestone": "v0.2"
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "src/components/standalone/StandaloneShell.tsx",
    "line": null,
    "description": "Cross-surface handoff acceptance check not yet run: the suite proves the ready/transfer/ack contracts, store effects and published envelopes in one realm, but the real observation — a cold Standalone tab announcing readiness before the Side Panel publishes, the pinned pending/complete/failed copy, and no MirrorBanner after a successful open — needs two live Chrome surfaces and the UI wiring owned by 01-08/01-12. Run as a manual browser check at phase acceptance (01-07 coverage D8).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T13:41:19.237Z",
    "resolved_at": null,
    "milestone": "v0.2"
  },
  {
    "id": 6,
    "kind": "deviation",
    "phase": "01",
    "file": "src/core/workspace/handoff/protocol.ts",
    "line": null,
    "description": "Literal overlap for the acceptance review: the handoff transfer member uses WORKSPACE_HANDOFF, which 01-06 already declared as an Appendix E MessageType literal for the cross-context runtime envelope (payload {workspaceId}). The two are different domains (BroadcastBus channel payload vs chrome.runtime envelope) and this plan adds nothing to MessageType, but decide at acceptance whether the registry literal should be renamed before later phases consume it (01-07 summary, Deviations 7).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T13:41:19.383Z",
    "resolved_at": null,
    "milestone": "v0.2"
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "src/components/onboarding/OnboardingFlow.tsx",
    "line": null,
    "description": "400 px modal-copy backstop not yet run: the must-have requires the onboarding modal content and step copy to hold at 400 px with no horizontal scroll, the body scrolling inside the modal and no mid-glyph clipping, and the step copy to wrap without clipping or horizontal scrolling across all four steps. The suite asserts the structure and the antd v6 modal max-width rule (calc(100vw - 16px) below the SM breakpoint) but the visual check needs a browser (01-09 must-have backstops).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T14:29:50.042Z",
    "resolved_at": null,
    "milestone": "v0.2"
  },
  {
    "id": 8,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "src/entrypoints/standalone/main.tsx",
    "line": null,
    "description": "Two-live-surface onboarding check not yet run: the store suite proves the completion write propagates through chrome.storage.onChanged without a reload and the flow suite proves the sentinel key stays in component memory, but the real observation — Standalone presenting the same flow when it is opened first, no redirection to the Side Panel, the first surface staying active while the second starts no competing flow, and completion in one surface closing the other's flow — needs two live Chrome surfaces at phase acceptance (01-09 Task 3).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T14:29:50.187Z",
    "resolved_at": null,
    "milestone": "v0.2"
  },
  {
    "id": 9,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "src/components/standalone/StandaloneWritePage.tsx",
    "line": null,
    "description": "Fixture/deferred page visual parity not yet browser-observed: the D-03 step-4 parity record compares the rendered shells against the UI-SPEC surface-contract metrics, but jsdom cannot observe layout, contrast, focus rings, container queries, scroll behaviour or the annotated references under .planning/design/references/. Plan 01-13 item 6 (real Chrome) is the browser-observed owner of every not-observable row.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T15:05:48.830Z",
    "resolved_at": null,
    "milestone": "v0.2"
  },
  {
    "id": 10,
    "kind": "deviation",
    "phase": "01",
    "file": "src/components/standalone/WorkspaceSidebar.tsx",
    "line": null,
    "description": "Inventory change-control C-01-12-A: WorkspaceSidebar.tsx changed ADAPT -> REMOVE. Plan 01-02 had already shipped the canonical Sider inside StandaloneShell.tsx, so the file had zero importers and remounting it would have created the parallel implementation D-02 forbids. Recorded with all six change-control fields in 01-MIGRATION-INVENTORY.md; the phase acceptance review should confirm the deletion rather than a remount.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T15:05:54.819Z",
    "resolved_at": null,
    "milestone": "v0.2"
  },
  {
    "id": 11,
    "kind": "deviation",
    "phase": "01",
    "file": "src/components/common/ModelSelector.tsx",
    "line": null,
    "description": "Inventory change-control C-01-12-B: ModelSelector removal timing corrected. The Write-page import site is replaced (read-only Auto workflow display) but the file itself cannot be deleted in 01-12 - its last importer is src/components/chat/ChatComposer.tsx, a 01-11 REMOVE row, so the deletion must land with that file's removal or the typecheck breaks. 01-11's teardown must take grep -rn 'ModelSelector' src/ to zero.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-21T15:06:01.545Z",
    "resolved_at": "2026-09-21T23:08:30.875Z",
    "milestone": "v0.2"
  },
  {
    "id": 12,
    "kind": "deviation",
    "phase": "01",
    "file": "src/components/options/OptionsPage.tsx",
    "line": null,
    "description": "Declared hand-off for phase acceptance: 01-12 removed the connection test and its provider-service import and disabled every store-writing control (Save, provider Switch), but the preserved Options page still reads useExtensionStore for its non-secret display state and still renders credential input fields. Plan 01-11 Task 1 owns the credential-field strip, the store REPLACE and the model paths on this file; the verifier must confirm that an unreachable disabled control, not a live path, is what remains.",
    "status": "fixed",
    "reason": "",
    "recorded_at": "2026-09-21T15:06:14.006Z",
    "resolved_at": "2026-09-21T23:08:31.024Z",
    "milestone": "v0.2"
  },
  {
    "id": 13,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "src/entrypoints/standalone/main.tsx",
    "line": null,
    "description": "SA-10 real Chrome gesture evidence not yet run: the suite proves the open call is issued synchronously from the chrome.tabs.query callback with no awaited boundary before it, but chrome.sidePanel.open's gesture semantics are runtime-only (jsdom mocks the API). In a real Chrome MV3 build, open Standalone and run Focus Side Panel from the palette, then record the observed result; owned by the phase acceptance plan (01-VALIDATION manual row for SA-10).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T21:18:51.278Z",
    "resolved_at": null,
    "milestone": "v0.2"
  },
  {
    "id": 14,
    "kind": "deviation",
    "phase": "01",
    "file": "src/core/i18n/strings.ts",
    "line": null,
    "description": "New canonical key added by 01-08: sidepanel.openFailed ('Failed to open the side panel'). The UI-SPEC Copywriting Contract pins no copy for the Focus Side Panel failure path, but the task requires a typed, logged, user-visible failure rather than a silent one. The key is additive, resolves through t(), and is pinned in tests/core/i18n/strings.test.ts; the phase acceptance review should ratify the wording.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T21:19:00.150Z",
    "resolved_at": null,
    "milestone": "v0.2"
  },
  {
    "id": 15,
    "kind": "unrun-verify",
    "phase": "01",
    "file": "src/components/common/LegacyCredentialCleanupNotice.tsx",
    "line": null,
    "description": "D-07 neutral notice not yet observed in a real Chrome session: the suite proves the pinned copy, the pinned Dismiss label as the only exit and the shown-once behaviour in jsdom, but whether the notice actually presents once in the built extension is operator evidence. Seed a legacy apiKey into chrome.storage.local.np_store, reload the extension, confirm the neutral notice appears once and is dismissible, the field is gone and no second reload shows it; owned by the 01-VALIDATION manual row for D-07 (plan 01-13 item 5).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T22:28:40.648Z",
    "resolved_at": null,
    "milestone": "v0.2"
  },
  {
    "id": 16,
    "kind": "deviation",
    "phase": "01",
    "file": "src/core/onboarding/onboardingStateStore.ts",
    "line": null,
    "description": "01-10 scope addition (Rule 2): the plan's Task 3 acceptance criteria require the neutral notice to render and its shown-state to live on the onboarding record, but neither the record field, the notice component, nor the two surface-root mounts appear in the plan's files_modified list. Added: legacyCleanupNoticeShown on the onboarding record (schema v2 with a v1 upgrader so a defaulted field never re-presents a completed flow), src/components/common/LegacyCredentialCleanupNotice.tsx, and the mounts in both surface roots. The phase acceptance review should ratify the scope and the record-shape change.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T22:28:48.126Z",
    "resolved_at": null,
    "milestone": "v0.2"
  },
  {
    "id": 17,
    "kind": "deviation",
    "phase": "01",
    "file": "src/core/storage/legacyCredentialCleanup.ts",
    "line": null,
    "description": "01-10 instrument correction: the plan's Task 2 derived-value probe is syntactically invalid as written (its '\\.slice(0,' pattern reaches new RegExp with an unescaped '(' and throws SyntaxError before printing anything), so its fails_when condition can never be satisfied by the literal command. The corrected probe reads substring presence for the same seven tokens and prints ABSENT on the committed module; the verifier should not read the plan's literal command failure as a derived-value path.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T22:28:48.171Z",
    "resolved_at": null,
    "milestone": "v0.2"
  },
  {
    "id": 18,
    "kind": "deviation",
    "phase": "01",
    "file": "src/types/index.ts",
    "line": null,
    "description": "01-11 scope addition (Rule 2): beyond the plan's enumerated deletions, the prototype's WorkflowId/WorkflowDefinition types and ProviderConfig.selectedWorkflow/workflowModelMapping fields were deleted with their last consumers (WorkflowSelector, ChatComposer) so the persisted provider shape carries no model-identifier mapping. The row's REPLACE classification and target path are unchanged; the phase acceptance review should ratify the wider trim.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T23:08:30.367Z",
    "resolved_at": null,
    "milestone": "v0.2"
  },
  {
    "id": 19,
    "kind": "deviation",
    "phase": "01",
    "file": "package.json",
    "line": null,
    "description": "01-11 dependency judgement on the plan's conditional: @vitejs/plugin-react is removed (only vite.config.ts imported it; @wxt-dev/module-react supplies it transitively) but the top-level vite devDependency is RETAINED because vite/client is referenced by tsconfig types and src/vite-env.d.ts and vite is a peer of wxt/vitest — removing it would break the typecheck. pnpm-lock.yaml updated with pnpm install --lockfile-only; --frozen-lockfile passes. motion is retained (unreferenced by src/, permitted by the 01-13 gate).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T23:08:30.539Z",
    "resolved_at": null,
    "milestone": "v0.2"
  },
  {
    "id": 20,
    "kind": "deviation",
    "phase": "01",
    "file": "src/main.tsx",
    "line": null,
    "description": "01-11 instrument/blocking fixes required by the plan's own gates: (a) the doomed dev shell's SidepanelChat import was replaced by the canonical SidePanelShell in Task 2 so npx tsc --noEmit stayed clean while the prototype hosts were deleted; (b) tests/components/pages/options-page.test.tsx and tests/components/LegacyCredentialCleanupNotice.test.tsx had to stop naming the removed export and the deleted suite, because the plan's teardown grep over src/ and tests/ reads those literal names and would otherwise fail on the suites that prove the teardown.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T23:08:30.704Z",
    "resolved_at": null,
    "milestone": "v0.2"
  }
]
````
