# Deferred Items — Phase 05a

Out-of-scope discoveries logged during execution (never auto-fixed per the
executor scope boundary). Revisit after the phase or during maintenance.

| # | Item | Where | Status | Deferred At |
|---|------|-------|--------|-------------|
| 1 | `tests/core/ai/StreamAdapter.test.ts` (2 tests) + `tests/core/ai/providers/ProviderAdapter.test.ts` (4 tests) fail with the current declared dependency set (`ai` 7.0.48, zod 4.4.3): `capturedOnChunk is not a function` / `client.chat is not a function`. Reproduced identically at the pre-05a baseline commit with a fresh `npm install` (both plain and `--legacy-peer-deps`) — pre-existing failures unrelated to 05a-01's diff. The pre-task `package-lock.json` was already out of sync with `package.json` (root zod 3.25.76 vs declared `^4.4.3`) and `@testing-library/dom` was missing from the lockfile entirely; 05a-01's `npm install` normalized the lockfile (zod 4.4.3 at root, ai 7.0.48, `@testing-library/dom@^10` restored) which surfaced these latent failures. | tests/core/ai/ | open | 2026-08-02 |
