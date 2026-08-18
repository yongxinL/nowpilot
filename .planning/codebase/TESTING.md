# Testing Patterns

**Analysis Date:** 2026-08-18

## Test Framework

**Runner:**
- Vitest 3.2.7 (installed 3.2.7 per `package-lock.json`)
- Config: `vitest.config.ts` — `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./tests/setup.ts']`, alias `@` → repo root
- Environment: jsdom 25.0.0; `@testing-library/react` 16.0.0 for component/hook tests

**Assertion Library:**
- Vitest built-in `expect` (jest-compatible API)

**Run Commands:**
```bash
npm test                 # Run all tests (vitest run)
npm run test:watch       # Watch mode (vitest)
npm run verify:phase-1   # Phase-scoped: tsc + targeted test dirs
npm run verify:all       # tsc --noEmit && vitest run && pnpm run lint
npm run test:isolation   # vitest run tests/isolation
npm run test:perf        # vitest run tests/perf (tests/perf does not exist yet)
```
- Full script set in `package.json:14-29`. `verify:phase-N` scripts chain `tsc --noEmit` then a scoped `vitest run <paths>`.

## Test File Organization

**Location:**
- Separate top-level `tests/` directory mirroring `src/` structure (NOT co-located with source)
- `tests/core/<module>/<File>.test.ts` corresponds to `src/core/<module>/<File>.ts` — e.g. `tests/core/events/EventBus.test.ts` → `src/core/events/EventBus.ts`
- `tests/isolation/` holds cross-entrypoint import-boundary tests
- `tests/setup.ts` is the global setup file (not a test)

**Naming:**
- `<SourceFileName>.test.ts` for logic; `.test.tsx` when JSX/render is involved (`tests/core/theme/ThemeSync.test.tsx`)
- Matches the exact source module name — `OperationId.test.ts`, `WorkspaceStore.test.ts`, `RuntimeEnvelope.test.ts`

**Structure:**
```
tests/
├── setup.ts                        # Global mocks (chrome, BroadcastChannel, matchMedia, ResizeObserver)
├── core/
│   ├── commands/CommandRegistry.test.ts
│   ├── events/EventBus.test.ts
│   ├── runtime/OperationId.test.ts
│   ├── runtime/RuntimeEnvelope.test.ts
│   ├── theme/ThemeStore.test.ts
│   ├── theme/ThemeSync.test.tsx
│   ├── workspace/WorkspaceRouter.test.ts
│   └── workspace/WorkspaceStore.test.ts
└── isolation/
    └── cross-entrypoint-imports.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
// tests/core/commands/CommandRegistry.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRegistry } from '../../../src/core/commands/CommandRegistry';
import type { Command } from '../../../src/core/commands/CommandRegistry';

describe('CommandRegistry', () => {
  const createCmd = (overrides?: Partial<Command>): Command => ({
    id: 'test-1',
    name: 'Test Command',
    description: 'A test command description',
    category: 'System',
    action: () => {},
    ...overrides,
  });

  beforeEach(() => {
    const all = CommandRegistry.getAll();
    for (const cmd of all) {
      CommandRegistry.unregister(cmd.id);
    }
  });

  describe('register / get', () => {
    it('register(cmd) adds command, get("id") returns it', () => { ... });
  });
});
```

**Patterns:**
- One top-level `describe('<ModuleName>', ...)`; nested `describe('<behavior group>', ...)` for feature areas (register/search/execute/getAll in `CommandRegistry.test.ts:24-139`)
- Plain `it('does thing', ...)` for behavior; no `test()` used
- `beforeEach` resets shared state — `off('test:event')` (`tests/core/events/EventBus.test.ts:6`), `useWorkspaceStore.getState().reset()` (`tests/core/workspace/WorkspaceStore.test.ts:6`), `useThemeStore.getState().setMode('auto')` (`tests/core/theme/ThemeStore.test.ts:7`), `vi.clearAllMocks()` (`tests/core/workspace/WorkspaceRouter.test.ts:28`)
- Assertions use `expect(x).toBe(...)` / `.toEqual(...)` / `.toHaveBeenCalledWith(...)` / `.toThrow(...)` / `.toMatch(/.../)` / `.toBeTruthy()` / `.toBeNull()` / `.toBeUndefined()`
- Stores are exercised imperatively via `useXxxStore.getState()` — no React wrapper needed for store logic (`tests/core/workspace/WorkspaceStore.test.ts:21-23`)
- Multiple top-level `describe` blocks allowed per file when testing the module + a collaborator (`ThemeStore` then `chromeStorageAdapter` in `tests/core/theme/ThemeStore.test.ts:44`)

## Mocking

**Framework:** Vitest built-in `vi` — `vi.fn()`, `vi.spyOn()`, `vi.stubGlobal()`, `vi.clearAllMocks()`

**Patterns:**
```typescript
// Global chrome storage mock lives in tests/setup.ts — Map-backed, with test helpers
(globalThis as any).__chromeStorageLocal = chromeStorageLocal;
(globalThis as any).__chromeStorageMap = chromeStorage;
(globalThis as any).chrome.storage = { local: chromeStorageLocal as any };

// Inline chrome stub per test file:
vi.stubGlobal('chrome', {
  runtime: { getURL: vi.fn((path: string) => `chrome-extension://test-id/${path}`), sendMessage: vi.fn() },
  tabs: { query: vi.fn(), create: vi.fn(), update: vi.fn() },
  storage: { local: { get: vi.fn(), set: vi.fn() }, session: { get: vi.fn(), set: vi.fn() } },
});
// tests/core/workspace/WorkspaceRouter.test.ts:4-24

// Method spying:
const setSpy = vi.spyOn(chrome.storage.local, 'set');
// tests/core/theme/ThemeStore.test.ts:84

const publishSpy = vi.spyOn(BroadcastBus, 'publish');
// tests/core/theme/ThemeSync.test.tsx:34

// Hook tests: render a wrapper component + simulate broadcast:
function Wrapper() { useThemeSync(); return null; }
render(<Wrapper />);
act(() => { (globalThis as any).__broadcast('np_theme', { type: 'THEME_CHANGED', mode: 'dark' }); });
// tests/core/theme/ThemeSync.test.tsx:16-30
```

**What to Mock:**
- Chrome extension APIs (`chrome.runtime`, `chrome.storage`, `chrome.tabs`, `chrome.sidePanel`) — never available in jsdom
- Browser globals the UI depends on: `localStorage`, `ResizeObserver`, `window.matchMedia`, `BroadcastChannel` — all stubbed centrally in `tests/setup.ts`
- Module functions under test via `vi.spyOn(module, 'exportedFn')` (e.g. `BroadcastBus.publish`)
- `window.matchMedia` mocked to `matches: false` so `prefers-color-scheme: dark` is off by default (`tests/setup.ts:31-43`)

**What NOT to Mock:**
- The module under test itself — stores are tested through their real zustand implementation with real `persist`/`immer` middleware (chrome storage adapter is real; storage is stubbed, adapter is not)
- Pure helpers/validators (e.g. `isEnvelope`) — tested directly against real inputs

## Fixtures and Factories

**Test Data:**
```typescript
// Factory function pattern with partial overrides:
const createCmd = (overrides?: Partial<Command>): Command => ({
  id: 'test-1',
  name: 'Test Command',
  description: 'A test command description',
  category: 'System',
  action: () => {},
  ...overrides,
});
// tests/core/commands/CommandRegistry.test.ts:6-13

// Inline object literals for payloads:
const envelope = createEnvelope('GET_ACTIVE_TAB_CONTEXT', { tabId: 1 }, 'background');
// tests/core/runtime/RuntimeEnvelope.test.ts:6
```

**Location:**
- No shared fixtures directory — factories are defined inline at the top of the test file (`createCmd`) or as inline literals
- Real seed data lives in source, not tests: `INITIAL_SESSIONS`/`INITIAL_PROMPTS` etc. in `src/store/useExtensionStore.ts`, `DEFAULT_PROMPTS_LIST` in `src/components/options/defaultPromptsData.ts` (imported by the store, not duplicated in tests)

## Coverage

**Requirements:** None enforced — no `coverage` script, no `@vitest/coverage-*` provider installed, no thresholds in `vitest.config.ts`

**View Coverage:**
```bash
# Not configured. To enable, add e.g.:
#   coverage: { provider: 'v8', reporter: ['text', 'html'] }  to vitest.config.ts
```

## Test Types

**Unit Tests:**
- Dominant approach. Pure modules (`RuntimeEnvelope`, `OperationId`, `EventBus`, `CommandRegistry`), zustand stores (`WorkspaceStore`, `ThemeStore`), and adapters (`chromeStorageAdapter`) tested in jsdom
- Stores tested through their public state API; chrome storage round-trips verified against the Map-backed mock (`tests/core/theme/ThemeStore.test.ts:75-81`)

**Integration Tests:**
- Light integration flavor: zustand stores with real `persist` + real `chromeStorageAdapter` against the stubbed `chrome.storage.local`, and React hooks (`useThemeSync`) rendered with `@testing-library/react` while receiving simulated `BroadcastChannel` messages (`tests/core/theme/ThemeSync.test.tsx`)
- `tests/setup.ts` cross-cutting mock for `BroadcastChannel` provides the `__broadcast(channel, data)` helper to inject inbound messages (`tests/setup.ts:144-152`)

**E2E Tests:**
- Not used. No Playwright/Cypress/WebdriverIO configured
- Closest analog: `tests/isolation/cross-entrypoint-imports.test.ts` — shell-based boundary checks that grep `src/` for forbidden cross-surface imports (`tests/isolation/cross-entrypoint-imports.test.ts:6-22`)

## Common Patterns

**Async Testing:**
```typescript
// Async storage adapter tests use async/await on real promise-based APIs:
it('round-trips complex data', async () => {
  const data = { mode: 'auto', version: 2, nested: { a: 1 } };
  await chromeStorageAdapter.setItem('complex', JSON.stringify(data));
  const raw = await chromeStorageAdapter.getItem('complex');
  expect(raw).toBe(JSON.stringify(data));
  expect(JSON.parse(raw!)).toEqual(data);
});
// tests/core/theme/ThemeStore.test.ts:75-81

// Hook/component tests wrap state-affecting calls in act():
act(() => { (globalThis as any).__broadcast('np_theme', { type: 'THEME_CHANGED', mode: 'dark' }); });
```

**Error Testing:**
```typescript
// Throw assertions (exact message + regex):
expect(() => CommandRegistry.register(cmd)).toThrow('Command already registered: test-1');
expect(() => CommandRegistry.register(cmd)).toThrow(/test-1/);
// tests/core/commands/CommandRegistry.test.ts:46-48

// No-throw assertions for no-op/edge cases:
expect(() => CommandRegistry.unregister('non-existent')).not.toThrow();
// tests/core/commands/CommandRegistry.test.ts:63

// Handlers must not throw (swallow behavior):
expect(() => emit('test:event', {})).not.toThrow();
// tests/core/events/EventBus.test.ts:49
```

## Current State & Known Gaps

- **9 test files, 56 tests, all passing** (verified 2026-08-18, ~1.4s): `tests/core/{commands,events,runtime,theme,workspace}` + `tests/isolation`
- **No component tests exist yet** for `src/components/` (no `tests/components/`)
- **`verify:phase-N` scripts reference test paths that do not exist yet** — `tests/core/storage`, `tests/core/security`, `tests/core/utils`, `tests/core/ai`, `tests/core/context`, `tests/core/extraction`, `tests/core/content`, `tests/core/memory`, `tests/core/search`, `tests/core/notes`, `tests/core/telemetry`, `tests/hooks`, `tests/components`, `tests/components/rich`, `tests/core/intent`, `tests/addons`, `tests/perf`. Running those scripts fails with `No test files found` (verified for `tests/core/storage`). Only `verify:phase-1`, `verify:phase-8` (partial), `verify:phase-9`, and `verify:all` currently resolve real test files.
- **`tests/isolation/cross-entrypoint-imports.test.ts` greps directories that no longer exist** (`src/components/sidepanel/`, `src/components/app/`) — the `src/components/chat/` and `src/components/standalone/` split superseded them, so the test passes vacuously and should be updated to the current layout
- **`test:perf`** points at `tests/perf/` which does not exist yet
- MSW is listed in the product spec (`references/PRODUCT_SPEC_v0_1.md`, §7.8) but is not installed; API-level tests currently rely on manual `fetch` stubs or in-memory mocks

---

*Testing analysis: 2026-08-18*