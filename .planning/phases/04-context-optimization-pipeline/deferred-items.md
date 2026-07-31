# Deferred Items — Phase 04

Out-of-scope discoveries logged per the executor scope boundary rule (do not fix;
do not re-run builds hoping they resolve). Reviewed at phase end.

## Pre-existing TypeScript errors in src/core/storage/ (9)

Discovered during Plan 04-01 verification (`pnpm exec tsc --noEmit`). All errors
are in Phase 2 files untouched by Phase 4, caused by TS 5.8 lib/type incompatibilities
with `@types/node` / `idb` typings:

- `src/core/storage/ApiKeyStore.ts(68,39)`, `(69,37)` — TS2345: `Uint8Array<ArrayBufferLike>`
  not assignable to `ArrayBuffer` (crypto.subtle.importKey usage)
- `src/core/storage/CryptoService.ts(88,10)` — TS2352: `ArrayBuffer` → `Uint8Array` cast
  flagged as non-overlapping under newer TS lib types
- `src/core/storage/CryptoService.ts(96,39)` — TS2345: `ArrayBufferLike` not assignable
  to `BufferSource`
- `src/core/storage/MigrationRunner.ts(24,31)`, `(27,32)`, `(78,25)` — TS2345/TS2488:
  `IDBPTransaction` / `IDBRequest` typing mismatches between idb and DOM lib
- `src/core/storage/WriteJournal.ts(188,44)`, `(237,42)` — TS7006: implicit any params

All 9 errors predate Plan 04-01 (verified against untouched Phase 2 files). These
block `tsc --noEmit` from being fully green project-wide; Phase 3 verify scripts
must have had the same condition. Suggested fix target: Phase 5 storage/migrations
wave or a dedicated hardening task.

## Pre-existing test failures in tests/core/ai/ (6)

Discovered during Plan 04-01 baseline run. Failures reproduce without any Phase 4
changes:

- `tests/core/ai/StreamAdapter.test.ts` — 2 failed: stream mock returns no
  async-iterable (`Cannot read properties of undefined (reading Symbol(Symbol.asyncIterator))`);
  mock shape needs `fullStream` on the mocked streamText result
- `tests/core/ai/providers/ProviderAdapter.test.ts` — 4 failed: "createLanguageModel
  returns a LanguageModel instance" — the AI SDK v7 `LanguageModel` shape check
  (promptFormat/version etc.) no longer matches the adapters' returned objects

All 6 failures are in test files untouched by Phase 4 and unrelated to the context
optimization pipeline. Suggested fix: update the two test files to the current
AI SDK v7 mock shape expectations.

## Intentional placeholders (not defects)

- `kind: 'task'` section is an empty placeholder (`core.task.placeholder`) — per
  Plan 04-01 §Part 6; task context assembly arrives in later plans.
- Renderer history assembly (`kind: 'history'`) skipped in Plan 04-01 — future work.
- `pageContext`/`memoryHints` wiring from Phase 4a/5 data sources — deferred by
  design (D-05 graceful no-ops).
