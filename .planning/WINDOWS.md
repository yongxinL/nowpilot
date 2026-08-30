---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-08-30T00:35:59.206Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 6 | deviation | entrypoints/content/core.content.ts |  | Content-script entrypoint not detected by WXT 0.20.27 (matches no content-script glob) — content script never built/registered; built-bundle isolation check permanently skips until fixed; deferred to Phase 7 / D-07a owner (deferred-items.md) | open |  | 2026-08-30T00:35:59.206Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "6",
    "file": "entrypoints/content/core.content.ts",
    "line": null,
    "description": "Content-script entrypoint not detected by WXT 0.20.27 (matches no content-script glob) — content script never built/registered; built-bundle isolation check permanently skips until fixed; deferred to Phase 7 / D-07a owner (deferred-items.md)",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-30T00:35:59.206Z",
    "resolved_at": null
  }
]
````
