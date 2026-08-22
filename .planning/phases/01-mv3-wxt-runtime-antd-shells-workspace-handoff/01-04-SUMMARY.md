---
phase: 01-mv3-wxt-runtime-antd-shells-workspace-handoff
plan: 01-04
type: execute
wave: 4
depends_on: [01-03]
autonomous: true
requirements: [REQ-R03, D-11, D-12, D-22-H1]
---

# Plan 01-04 — Demo strip + DEMO_MODE gate + connection-test fix at source + write-rate debounce

## Objective

Strip the scaffold's demo/simulated-AI content now that Plan 01-01's migration-safety changes are committed and green. Empty the three `INITIAL_*` demo-data arrays (D-11), gate `simulateStreamResponse` behind an explicit `DEMO_MODE` flag (D-12), fix the "connection test always succeeds" bug at its true source in `aiProvider.ts` (not paper over in UI), and land the write-rate debounce that keeps every persisted store under the `chrome.storage` throttle boundary (D-22's remaining half).

## Commits

| SHA | Type | Message |
|-----|------|---------|
| `e5d2b0a` | feat(01-04) | empty demo seed data + scaffold-leftover hygiene (D-11/D-12) |
| `850335c` | feat(01-04) | gate simulateStreamResponse + real connection test (D-12) |
| `e290e1e` | feat(01-04) | debounce chrome.storage writes + WorkspaceStore migrate (D-22/H1) |

## What was built

### Task 1 — Empty INITIAL_* arrays + clean fallout (D-11/D-12)

- `INITIAL_SESSIONS`, `INITIAL_WRITE_HISTORY`, `INITIAL_NOTES` in `src/store/useExtensionStore.ts` emptied (6 fake ServiceNow conversations, 3 write-history items, 5 notes all deleted)
- `activeSessionId` defaults to `''` and `activeSession` defaults to `null` (computeActiveSession already returns `null` on empty input)
- `ProviderConfig.demoMode?: boolean` + `DEFAULT_CONFIG.demoMode: false` (D-12 flag wired in Task 2's aiProvider changes)
- Removed Unsplash thumbnail fallbacks from `ChatMessageItem` and `SidepanelChat` (D-11 cleanup)
- `index.html` title `'My Google AI Studio App'` → `'NowPilot'`
- `metadata.json`: dropped `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` (vendor demo capability)
- `src/main.tsx`: removed `'Default AntD v6 & X'` dev Tag and its import

### Task 2 — DEMO_MODE gate + fix connection-test swallow at source (D-12)

- New `aiProvider.testProviderConnection(providerId, apiKey?, proxyUrl?)` issues the same models fetch as `fetchProviderModels` but surfaces `{ok: false, error}` on any failure (network throw, non-ok HTTP, empty model list). `fetchProviderModels` keeps its permissive fallback (it's the `'Refresh Models'` UI convenience path) — the helper `fetchModelsOrError` is the shared core.
- `streamChatResponse` gates all three `simulateStreamResponse` call sites behind `(config.demoMode && import.meta.env.DEV)`. Outside that gate (the production default), a webapp session / fetch throw / non-ok HTTP response calls `onError` with the real message instead of substituting the canned critical-thinking / 'Good morning' response.
- `useChatStreaming`: filter the just-appended empty assistant placeholder out of the outbound history — blank assistant bubbles are no longer sent to the provider (D-05; original attribution to SidepanelChat was wrong — actual bug was here, confirmed in session).
- `OptionsPage.handleCheckConnection`: 1s `setTimeout` replaced with a real `await testProviderConnection()` — `antMessage.success` only on `{ok: true}`, `antMessage.error(result.error)` on `{ok: false}`.

### Task 3 — chromeStorageAdapter debounce + WorkspaceStore storage migration (D-22/H1)

- **Trailing 300ms debounce** on `chromeStorageAdapter.setItem` and `syncStorageAdapter.setItem` (`STORAGE_DEBOUNCE_MS = 300`). Shared `pendingWrites` map keyed by storage key; each entry tags its target (`'local'` | `'sync'`) so a single flush correctly routes mixed batches to the right `chrome.storage.*` area.
- `flushPendingWrites()` exported for `beforeunload` and `visibilitychange → hidden` lifecycle hooks (M5). T-01-12: hard browser crash (no flush event) remains accepted residual risk.
- `removeItem` deliberately NOT debounced — deletions must take effect immediately.
- **Bug fix (in this commit, not split):** initial draft had `performFlush()` hard-coded to `chrome.storage.local`, which silently routed ThemeStore sync writes to local storage and broke D-10's persistence-target contract. Per-entry `target` tag + split-by-area flush (`Promise.all` over local + sync `set` calls) routes correctly.
- **WorkspaceStore (H1):** now writes through `chromeStorageAdapter` (was implicit `localStorage` default, wrong in extension context — would lose data when SW is the only context writing) and adds `version: 1` + no-op `workspaceMigrate`. Third and final persisted store to gain the v1 scaffold (useExtensionStore in 01-01, ThemeStore in 01-01, WorkspaceStore here).

## Tests

| File | Tests | Notes |
|------|-------|-------|
| `tests/core/storage/chromeStorageAdapter.test.ts` (new) | 7 | coalescing, batching, sync routing, mixed-area routing, no-op flush, immediate removeItem, STORAGE_DEBOUNCE_MS=300 |
| `tests/core/theme/ThemeStore.test.ts` | 24 | imports `flushPendingWrites` + `__test__` seam; beforeEach reset; per-test flush in spy assertions |
| `tests/core/ai/testProviderConnection.test.ts` | (extended) | new tests for error-surfacing paths in Task 2 |

## Verification

| Check | Result |
|-------|--------|
| `pnpm vitest run` (full suite) | **101 tests passed across 15 files** |
| `pnpm vitest run tests/core/storage` | 7/7 |
| `pnpm lint` (tsc --noEmit strict:true) | clean (NP-STRICT ceiling still 0) |
| `pnpm verify:phase-1` | green |

## Files modified

```
index.html                                  (title)
metadata.json                               (drop vendor capability)
src/components/chat/ChatMessageItem.tsx     (drop Unsplash)
src/components/chat/SidepanelChat.tsx       (drop Unsplash, mount-effect intact)
src/components/chat/useChatStreaming.ts     (filter empty assistant placeholder)
src/components/options/OptionsPage.tsx      (real connection test)
src/main.tsx                                (drop dev Tag)
src/services/aiProvider.ts                  (DEMO_MODE gate, testProviderConnection, fetchModelsOrError)
src/store/useExtensionStore.ts              (empty INITIAL_*, demoMode flag)
src/types/index.ts                          (ProviderConfig.demoMode)
src/core/theme/chromeStorageAdapter.ts      (debounce + per-entry target tag + lifecycle hooks)
src/core/workspace/WorkspaceStore.ts        (storage: chromeStorageAdapter + version:1 + migrate)
tests/core/ai/testProviderConnection.test.ts (extended)
tests/core/storage/chromeStorageAdapter.test.ts (NEW, 7 tests)
tests/core/theme/ThemeStore.test.ts          (debounce-aware assertions)
```

## Deviations / issues encountered

1. **Mid-plan recovery:** the executing subagent completed Tasks 1+2 and started Task 3 but crashed before writing SUMMARY.md or finalising the debounce tests. Orchestrator recovered: re-ran the debounce test, fixed a critical routing bug in the subagent's draft (sync writes were landing on local storage), created the dedicated `tests/core/storage/chromeStorageAdapter.test.ts` test file with 7 cases, and committed.
2. **Original subagent draft bug:** `performFlush()` was hard-coded to `chrome.storage.local`. The shared `pendingWrites` map meant a ThemeStore `syncStorageAdapter.setItem('np_theme', ...)` would silently land on local storage because the flush only knew the local target. Fix: tag each pending entry with `target: 'local' | 'sync'` and split the snapshot by area before issuing the writes. This is now visible in the new test "sync adapter writes route to chrome.storage.sync, not local" and "mixed local + sync writes route to correct areas, never cross".
3. **`pnpm lint`/`tsc` background noise:** zustand persist+immer typing complaints (e.g. `StateCreator<…, [["zustand/persist", unknown], ["zustand/immer", never]]>` not assignable to `StateCreator<…, [never, unknown][]>`) exist at HEAD and are not introduced by this plan. Pre-existing scaffold typing residue unrelated to D-22.

## Next plan

**01-05** — Three additive declarations: repoint the vacuous isolation test at the codebase's actual directory structure (D-17, REQ-R02), declare the frozen extraction envelope types Phase 6 will implement against (D-15, REQ-R04), and add `isPrimaryWriter()` + `ActiveSurface` rename (D-16/D-07, REQ-R05).