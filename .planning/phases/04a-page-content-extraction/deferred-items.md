# Deferred Items — Phase 04a

Out-of-scope discoveries logged during execution (per executor scope boundary: do
not fix pre-existing issues in unrelated files; record here instead).

| # | Found during | Item | Status |
|---|--------------|------|--------|
| 1 | Plan 04a-02, Task 1 | Pre-existing `tsc --noEmit` errors in `src/core/storage/ApiKeyStore.ts` (lines 68–69) and `src/core/storage/CryptoService.ts` (lines 88, 96): Uint8Array<ArrayBufferLike>/ArrayBuffer/SharedArrayBuffer generics drift (TypeScript lib version mismatch). Files last modified in Phase 02-03 (commit 77d88ac). Not related to extraction work; `tsc` otherwise clean on all 04a files. | open |
| 2 | Plan 04a-02, Task 2 | Pre-existing test failures in `tests/core/ai/StreamAdapter.test.ts` (2) and `tests/core/ai/providers/ProviderAdapter.test.ts` (4): `client.chat is not a function` / `google.chat is not a function` — Phase 03 `@ai-sdk` provider SDK API drift (the mocked client no longer exposes `.chat()`). Files import only `src/core/ai/*` — zero overlap with 04a changes. Verified failing independently of extraction work. | open |
