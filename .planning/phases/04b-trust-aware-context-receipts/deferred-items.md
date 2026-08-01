# Deferred Items — Phase 04b

Out-of-scope discoveries logged during execution (per executor scope boundary: do
not fix pre-existing issues in unrelated files; record here instead).

| # | Found during | Item | Status |
|---|--------------|------|--------|
| 1 | Plan 04b-01, final verification | Pre-existing test failures in `tests/core/ai/StreamAdapter.test.ts` (2) and `tests/core/ai/providers/ProviderAdapter.test.ts` (4): `capturedOnChunk is not a function` / `client.chat is not a function` / `google.chat is not a function` — Phase 03 `@ai-sdk` provider SDK API drift (the mocked client no longer exposes `.chat()`). Reproduced identically on pristine HEAD baseline (commit 1b7725a) in an isolated worktree. Zero overlap with 04b files (import only `src/core/ai/*`). Already tracked in WINDOWS.md entries 1–2 and prior phase deferred-items (03a/04/04a). | open |
