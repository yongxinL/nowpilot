# Deferred Items — Phase 03a

Out-of-scope discoveries logged during plan execution (scope boundary rule).

| Item | Found in | Description | Status |
|------|----------|-------------|--------|
| `pnpm lint` baseline failures | 03a-01 (pre-existing) | 9 tsc errors in `src/core/storage/` (`ApiKeyStore.ts`, `CryptoService.ts`, `MigrationRunner.ts`, `WriteJournal.ts`) — verified identical at HEAD c15133d via baseline worktree; caused by newer `@types/node` generics (`Uint8Array<ArrayBufferLike>`, `IDBPTransaction` vs `IDBTransaction`), unrelated to Phase 3a. The plan-level `pnpm lint` verification therefore cannot fully pass until storage is migrated to `@types/node`-compatible signatures. | open |
| StreamAdapter.test.ts failures | 03a-01 (pre-existing) | 2 failing tests at HEAD baseline (stream error handling); unrelated to Phase 3a files. | open |
| ProviderAdapter.test.ts failures | 03a-01 (pre-existing) | 4 failing tests at HEAD baseline (createLanguageModel contract); unrelated to Phase 3a files. | open |
