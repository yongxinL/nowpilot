# Deferred Items — Phase 03a

Out-of-scope discoveries logged during plan execution (scope boundary rule).

| Item | Found in | Description | Status |
|------|----------|-------------|--------|
| `pnpm lint` baseline failures | 03a-01 (pre-existing) | 9 tsc errors in `src/core/storage/` (`ApiKeyStore.ts`, `CryptoService.ts`, `MigrationRunner.ts`, `WriteJournal.ts`) — caused by newer `@types/node` generics (`Uint8Array<ArrayBufferLike>`, `IDBPTransaction` vs `IDBTransaction`). **Resolved in 03a-05 (`11d18f6`):** the `verify:phase-3a` green-gate acceptance criterion required `tsc --noEmit` to exit 0, so the baseline was repaired with type-level changes only (base64 helper accepts Uint8Array; explicit ArrayBuffer casts in CryptoService; `IDBPTransaction<unknown, string[], 'versionchange'>` in MigrationRunner; explicit `WriteJournalEntry` annotations). Zero runtime behavior change — all 43 storage tests still pass; `pnpm lint` is now clean repo-wide. | resolved |
| StreamAdapter.test.ts failures | 03a-01 (pre-existing) | 2 failing tests at HEAD baseline (stream error handling); unrelated to Phase 3a files. | open |
| ProviderAdapter.test.ts failures | 03a-01 (pre-existing) | 4 failing tests at HEAD baseline (createLanguageModel contract); unrelated to Phase 3a files. | open |
| PlannerService passes `signal` to `generateText` | 03a-04 (pre-existing) | `PlannerService.plan()` spreads `{ signal }` into the `generateText` options (PlannerService.ts:137/146). ai SDK v7 reads `abortSignal` only — `signal` is silently dropped by the runtime, so a mid-call abort would NOT cancel the planner LLM request (the orchestrator's post-await `signal.aborted` check still catches it, so outcomes remain correct). Fix (rename to `abortSignal`) belongs to a future plan touching PlannerService; Phase 3a file-scope rules exclude it here. | open |
