---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 1
total_count: 4
last_updated: 2026-09-21T13:08:58.822Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 01 | deviation | src/entrypoints/content/index.ts |  | The generated manifest now carries content_scripts (matches <all_urls>, world ISOLATED) because the content script is at a WXT-discoverable path; the threat model (T-1-10) assumed the key stayed absent until 01-03. Injection scope is decided and asserted by plan 01-03 Task 2 (H-1, operator-gated). | open |  | 2026-09-21T12:13:21.694Z |  |
| 2 | 01 | stub | src/components/sidepanel/SidePanelShell.tsx |  | Both Phase-1 shells resolve every user-visible string through t() for keys that plan 01-04 lands (chat.emptyBody, chat.noProvider, chat.composerPlaceholder, shell.errorTitle/Body/Reload, a11y.*, standalone.minWidth). Until 01-04 lands, t() falls back to the key text. Intentional hand-off: 01-04 owns src/core/i18n/strings.ts and this plan was forbidden from editing it. | fixed |  | 2026-09-21T12:13:21.841Z | 2026-09-21T12:22:54.120Z |
| 3 | 01 | deviation | src/core/runtime/RuntimeEnvelope.ts |  | Verification-instrument deviation: the plan's grep for SIDE_PANEL_OPEN\|STANDALONE_OPEN across src/ and tests/ cannot return zero — the canonical §21.6 STANDALONE_OPEN_FAILED code in src/entrypoints/sidepanel/main.tsx contains the substring, 01-07's BroadcastBus union member 'STANDALONE_OPEN' lives in src/core/workspace/{WorkspaceSync,WorkspaceRouter}.ts, and the plan's own behavior case requires the suite to name both prototype spellings as negative assertions. 01-06 applies the production-scoped instrument (src/core/runtime + src/core/messaging) which returns 0. The phase verifier must use the scoped gate; replacing 01-07's transient BroadcastBus union member with the HandoffEnvelope protocol is the clean end state. | open |  | 2026-09-21T13:08:52.926Z |  |
| 4 | 01 | deviation | src/core/runtime/RuntimeEnvelope.ts |  | Spec-conformance question for phase acceptance: RuntimeEnvelope keeps operationId/timestamp (the plan requires the constructor and its assertions verbatim) while PRODUCT_SPEC Appendix C declares id/createdAt and an addon source variant. The divergence is one interface wide; decide whether to realign it before the envelope shape is consumed by later phases. | open |  | 2026-09-21T13:08:58.822Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "01",
    "file": "src/entrypoints/content/index.ts",
    "line": null,
    "description": "The generated manifest now carries content_scripts (matches <all_urls>, world ISOLATED) because the content script is at a WXT-discoverable path; the threat model (T-1-10) assumed the key stayed absent until 01-03. Injection scope is decided and asserted by plan 01-03 Task 2 (H-1, operator-gated).",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-21T12:13:21.694Z",
    "resolved_at": null,
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
  }
]
````
