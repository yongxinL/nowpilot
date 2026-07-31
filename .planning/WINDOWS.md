---
schema_version: 1
open_count: 3
waived_count: 0
fixed_count: 0
total_count: 3
last_updated: 2026-07-31T04:46:25.526Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 04a | deviation | tests/core/ai/StreamAdapter.test.ts |  | Pre-existing: 2 StreamAdapter failures (capturedOnChunk is not a function) — reproduced on pristine HEAD, not caused by 04a-01 | open |  | 2026-07-31T04:46:25.284Z |  |
| 2 | 04a | deviation | tests/core/ai/providers/ProviderAdapter.test.ts |  | Pre-existing: 4 ProviderAdapter failures (createLanguageModel returns non-LanguageModel) — reproduced on pristine HEAD, not caused by 04a-01 | open |  | 2026-07-31T04:46:25.404Z |  |
| 3 | 04a | lint-warning | src/core/storage/ApiKeyStore.ts |  | Pre-existing: 9 tsc errors in src/core/storage (ApiKeyStore, CryptoService, MigrationRunner) — @types/node ArrayBuffer/Uint8Array drift | open |  | 2026-07-31T04:46:25.526Z |  |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "04a",
    "file": "tests/core/ai/StreamAdapter.test.ts",
    "line": null,
    "description": "Pre-existing: 2 StreamAdapter failures (capturedOnChunk is not a function) — reproduced on pristine HEAD, not caused by 04a-01",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-31T04:46:25.284Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "04a",
    "file": "tests/core/ai/providers/ProviderAdapter.test.ts",
    "line": null,
    "description": "Pre-existing: 4 ProviderAdapter failures (createLanguageModel returns non-LanguageModel) — reproduced on pristine HEAD, not caused by 04a-01",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-31T04:46:25.404Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "lint-warning",
    "phase": "04a",
    "file": "src/core/storage/ApiKeyStore.ts",
    "line": null,
    "description": "Pre-existing: 9 tsc errors in src/core/storage (ApiKeyStore, CryptoService, MigrationRunner) — @types/node ArrayBuffer/Uint8Array drift",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-31T04:46:25.526Z",
    "resolved_at": null
  }
]
````
