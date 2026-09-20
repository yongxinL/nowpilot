---
last_mapped_commit: fa9f6508dff633ac15be7548c3cde08535e4bab5
last_mapped_at: 2026-09-20
---
# Testing Patterns

**Analysis Date:** 2026-09-20

## Test Framework

**Runner:**

- Vitest `^3.0.0`
- Config: `vitest.config.ts` — `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./tests/setup.ts']`, alias `@` → repo root (unused by tests; they use relative paths)
- Type checking is part of every test gate (`tsc --noEmit` runs first in `verify:*` scripts)

**Assertion Library:**

- Vitest built-ins (`expect`, `vi`) — no `@testing-library/jest-dom`, no custom matchers
- `@testing-library/react` `^16` for DOM rendering; queries via `screen`, events via `fireEvent`, async via `waitFor` / `act`
- Prefer native DOM assertions: `expect(screen.getByText('...')).toBeTruthy()`, `expect(btn.hasAttribute('disabled')).toBe(true)`, `expect(screen.queryByText('...')).toBeNull()`

**Run Commands:**

```bash
pnpm test              # vitest run — all 18 files / 166 tests
pnpm test:watch        # vitest watch mode
pnpm test:isolation    # isolation gates only (tests/isolation)
pnpm test:perf         # tests/perf — directory does not exist yet; currently fails
pnpm verify:all        # tsc --noEmit && vitest run && pnpm run lint
pnpm verify:phase-1    # tsc + focused phase dirs + scripts/verify-no-tailwind.sh
pnpm verify:phase-N    # per-phase acceptance gate (see package.json)
```

Current state verified on 2026-09-20: `npx vitest run` → **18 files, 166 tests, all passing** in ~5.4s. Ant Design portal code logs benign jsdom `window.getComputedStyle` / `ResizeObserver` noise to stderr; tests still pass.

## Test File Organization

**Location:**

- Central `tests/` tree, mirrored by *domain*, not by source path. There are no co-located `*.test.ts` files next to source.
- 18 test files against 90 source files — core/runtime/state is well covered; most UI components are not.

**Naming:**

- `<SourceUnit>.test.ts` (logic) / `<SourceUnit>.test.tsx` (React)
- Shared setup in `tests/setup.ts` (not matched as a test file)
- Global repo-level gates live under `tests/core/strict/` and `tests/isolation/`

**Structure:**

```
tests/
├── setup.ts                                  # jsdom + chrome/BroadcastChannel/localStorage mocks
├── background/
│   ├── background-router.test.ts             # register() idempotency, advisory handlers
│   └── message-bus-cold-start.test.ts        # SW cold-start listener contract
├── components/
│   ├── MirrorBanner.test.tsx                 # render + callback + no-reload contract
│   └── OnboardingModal.test.tsx              # full wizard flow, loading/error/success
├── core/
│   ├── ai/testProviderConnection.test.ts     # → src/services/aiProvider.ts
│   ├── commands/{CommandRegistry,registerWorkspaceCommands}.test.ts
│   ├── events/EventBus.test.ts
│   ├── runtime/{OperationId,RuntimeEnvelope}.test.ts
│   ├── storage/chromeStorageAdapter.test.ts  # → src/core/theme/chromeStorageAdapter.ts
│   ├── store/useExtensionStore.test.ts
│   ├── strict/np-strict-ceiling.test.ts      # repo-level strict-marker gate
│   ├── theme/{ThemeStore,ThemeSync.test.tsx}
│   └── workspace/{WorkspaceRouter,WorkspaceStore}.test.ts
└── isolation/cross-entrypoint-imports.test.ts # shell-grep bundle isolation gate
```

**Source-to-test mapping examples:**

- `src/core/theme/chromeStorageAdapter.ts` → `tests/core/storage/chromeStorageAdapter.test.ts` (domain `storage`)
- `src/services/aiProvider.ts` → `tests/core/ai/testProviderConnection.test.ts`
- `src/core/workspace/WorkspaceRouter.ts` → `tests/core/workspace/WorkspaceRouter.test.ts`

## Test Structure

**Suite Organization:**

- Top-level `describe('<Unit> (<Plan NN-NN — D-XX, REQ-XX>)')` tags the plan/decision IDs the suite pins
- Nested `describe` per method or behavior cluster (`register / get`, `search`, `execute`, `unregister`)
- `it('does X when Y')` behavior sentences; expected literal strings are named in the title

```ts
// tests/core/theme/ThemeSync.test.tsx:47
describe('ThemeToggle (Plan 01-07 — D-10 UI half, REQ-F12)', () => {
  it('selecting "Dark" updates the ThemeStore mode to "dark" (local-first, no remount)', () => {
    renderWithAntd(<ThemeToggle />);
    fireEvent.click(screen.getByText('Dark'));
    expect(useThemeStore.getState().mode).toBe('dark');
  });
});
```

**Patterns:**

- Reset global/module state in `beforeEach`: deregister commands (`tests/core/commands/CommandRegistry.test.ts:15-22`), reset stores (`useWorkspaceStore.getState().reset()`, `useThemeStore.getState().setMode('auto')`), clear the storage maps (`vi.clearAllMocks()` + `__test__.resetPendingState()` — `tests/core/theme/ThemeStore.test.ts:57-64`)
- `afterEach(() => vi.restoreAllMocks())` at file scope when spies are created (`tests/components/OnboardingModal.test.tsx:272`)
- Use `try/finally` around fake timers and console spies to guarantee restore (`tests/components/OnboardingModal.test.tsx:48-67`, `tests/background/background-router.test.ts:58-77`)
- Assert exact call counts, not just truthiness: `toHaveBeenCalledTimes(1)`, `toHaveBeenNthCalledWith(...)`
- Tests pin negative guarantees explicitly ("does NOT", "no leaked listeners", "no leftover registrations")

## Mocking

**Framework:** Vitest `vi` only. No `msw`, no `nock`, no jest.

**Global mocks — `tests/setup.ts`:**

- Map-backed `localStorage` stub
- `ResizeObserver` and `window.matchMedia` stubs (required by AntD in jsdom)
- Map-backed `chrome.storage.local` and `chrome.storage.sync` built from `vi.fn` methods, assigned to `globalThis.chrome.storage`
- `BroadcastChannel` class stub that dispatches to sibling instances
- Test helpers exposed on `globalThis`: `__chromeStorageMap`, `__chromeStorageLocal`, `__chromeStorageSync`, `__broadcast(channelName, data)`

```ts
// tests/core/theme/ThemeSync.test.tsx:29-34 — driving chrome.storage.onChanged
onChangedListeners = [];
if (!chrome.storage.onChanged) {
  (chrome.storage as any).onChanged = {
    addListener: (cb: OnChangedListener) => { onChangedListeners.push(cb); },
    removeListener: (cb: OnChangedListener) => { onChangedListeners = onChangedListeners.filter((l) => l !== cb); },
  };
}
```

**Per-test patterns:**

- `vi.spyOn(chrome.storage.local, 'set')` then drive the adapter and assert the batched payload (`tests/core/storage/chromeStorageAdapter.test.ts:19-32`)
- `vi.spyOn(globalThis, 'fetch')` with `mockResolvedValueOnce({ ok, status, json: async () => ({...}) } as unknown as Response)` for provider tests (`tests/core/ai/testProviderConnection.test.ts:27-39`)
- `vi.stubGlobal('chrome', chromeApi)` with a hand-built callback-style chrome mock for router tests; the mock object is declared before imports and the module under test is imported *after* the stub (`tests/core/workspace/WorkspaceRouter.test.ts:7-25`)
- Partial module mock that preserves the real module and overrides one export:

```ts
// tests/components/OnboardingModal.test.tsx:10-16
vi.mock('../../src/services/aiProvider', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../src/services/aiProvider')>();
  return { ...mod, testProviderConnection: vi.fn() };
});
```

- Module-singleton isolation via `vi.resetModules()` + dynamic `import()` so each test gets fresh module state (`freshModules()` in `tests/background/background-router.test.ts:12-27`, `freshMessageBus()` in `tests/background/message-bus-cold-start.test.ts:13-21`)
- Fake timers only where timing itself is the contract: `vi.useFakeTimers()` + `advanceTimersByTimeAsync(15_000)` (`tests/components/OnboardingModal.test.tsx`). For debounce, prefer the exported flush seam `flushPendingWrites()` over advancing real timers (`tests/core/storage/chromeStorageAdapter.test.ts:28`).

**What to Mock:**

- Chrome APIs (`chrome.storage.*`, `chrome.runtime.*`, `chrome.tabs.*`), `fetch`, `BroadcastChannel`
- Module singletons when a test needs a fresh instance (`vi.resetModules` + dynamic import)
- Non-deterministic time only when the test asserts timer behavior

**What NOT to Mock:**

- Zustand stores — drive them with `useExtensionStore.getState()` and assert with `getState()`; this is the dominant integration style
- Pure helpers (`EventBus`, `RuntimeEnvelope`, `OperationId`, `CommandRegistry`) — call them directly
- Ant Design internals — wrap in real providers instead (`ConfigProvider` / `AntdApp`) so `App.useApp()` works

**Test seams in production code:**

- `src/core/theme/chromeStorageAdapter.ts:231` exports `__test__` (`setTimerFactory`, `setTimerClear`, `resetPendingState`, `getPendingSize`) explicitly documented as test-only. Use this convention instead of reaching into module internals; do not call `__test__` from production code.

## Fixtures and Factories

**Test Data:**

- Inline factory functions with `Partial` overrides, defined inside the suite:

```ts
// tests/core/commands/CommandRegistry.test.ts:6-13
const createCmd = (overrides?: Partial<Command>): Command => ({
  id: 'test-1', name: 'Test Command', description: 'A test command description',
  category: 'System', action: () => {}, ...overrides,
});
```

- Dependency-injection factories that return `{ deps, spies }` so callbacks stay assertable:

```ts
// tests/core/commands/registerWorkspaceCommands.test.ts:25-37
const makeDeps = () => {
  const focusSidePanel = vi.fn(); const openOptions = vi.fn();
  const toggleTheme = vi.fn(); const reloadExtension = vi.fn();
  return { deps: { focusSidePanel, openOptions, toggleTheme, reloadExtension },
           spies: { focusSidePanel, openOptions, toggleTheme, reloadExtension } };
};
```

- AntD render helper is repeated per component suite (this is the established pattern):

```tsx
// tests/components/MirrorBanner.test.tsx:7-9 — minimal form
function renderWithAntd(ui: React.ReactElement) {
  return render(<ConfigProvider>{ui}</ConfigProvider>);
}
// tests/components/OnboardingModal.test.tsx:24-34 — add AntdApp when App.useApp() is used
function renderWithAntd(ui: React.ReactElement) {
  return render(<ConfigProvider><AntdApp>{ui}</AntdApp></ConfigProvider>);
}
```

**Security fixtures:**

- Secret-shaped literals are used to assert *absence*: `const secretKey = 'sk-secret-DO-NOT-LEAK-XYZ123'` then `expect(result.error).not.toContain(secretKey)` (`tests/core/ai/testProviderConnection.test.ts:84-109`); console output is scanned for `sk-test-123` (`tests/components/OnboardingModal.test.tsx:158-179`). Reuse this pattern for credential-handling changes.

**Location:**

- No shared fixtures directory; fixtures are inline. Only cross-suite fixtures live in `tests/setup.ts` (`__chromeStorageMap`, `__broadcast`).

## Coverage

**Requirements:** None enforced. No coverage provider is installed (no `@vitest/coverage-v8`), no `coverage` config in `vitest.config.ts`, and no coverage script in `package.json`.

**View Coverage:**

- Not available. If needed, add `@vitest/coverage-v8` and a `test:coverage` script; do not silently add it without updating this document.

## Test Types

**Unit Tests (majority):**

- Pure modules: `tests/core/events/EventBus.test.ts`, `tests/core/runtime/*`, `tests/core/commands/CommandRegistry.test.ts`
- Adapter/debounce behavior: `tests/core/storage/chromeStorageAdapter.test.ts`
- Store actions + persist migrate functions: `tests/core/theme/ThemeStore.test.ts`, `tests/core/workspace/WorkspaceStore.test.ts`, `tests/core/store/useExtensionStore.test.ts`

**Integration Tests:**

- Service-worker messaging lifecycle: `tests/background/message-bus-cold-start.test.ts` (listener attach, handler isolation, non-envelope rejection)
- Cross-surface sync via chrome.storage.onChanged: `tests/core/theme/ThemeSync.test.tsx`
- Chrome tabs routing with callback-style mocks: `tests/core/workspace/WorkspaceRouter.test.ts`
- Provider connection through mocked `fetch`: `tests/core/ai/testProviderConnection.test.ts`
- UI with mocked service module: `tests/components/OnboardingModal.test.tsx`

**Component Tests:**

- `@testing-library/react` + real AntD providers; assert visible copy, roles, disabled states, callback counts

**E2E Tests:**

- Not used. No Playwright/Puppeteer/WXT e2e setup. Manual Chrome evidence (Side Panel, generated manifest) is required by `.opencode/skills/nowpilot-phase-verification/SKILL.md` and `.opencode/skills/nowpilot-phase-verification` for browser-chrome surfaces.

**Repo-Level Gate Tests (not unit tests, keep them working):**

- `tests/core/strict/np-strict-ceiling.test.ts` — reads `package.json.NP_STRICT_CEILING` and `git grep`s `NP-STRICT-` markers; adding a suppression without raising the ceiling fails the suite
- `tests/isolation/cross-entrypoint-imports.test.ts` — shells out via `execSync('grep -rEn ...')` to prove no `chat`/`standalone`/`options` cross-imports and zero `fetch(` in `entrypoints/content/`; includes a self-test block that proves the regex catches real violations (guards against vacuous passes, Pitfall 6)
- `scripts/verify-no-tailwind.sh` — invoked by `verify:phase-1`, fails on Tailwind `className` leakage

## Common Patterns

**Async Testing:**

```ts
// tests/components/OnboardingModal.test.tsx:184-202
mockedTest.mockResolvedValueOnce({ ok: true, models: [{ id: 'gpt-4o', name: 'gpt-4o', enabled: true }] });
fireEvent.click(screen.getByRole('button', { name: /Connect Provider/i }));
await waitFor(() => { expect(screen.getByText(/^Connected$/i)).toBeTruthy(); });
```

**Error Testing:**

```ts
// sync throw — tests/core/commands/CommandRegistry.test.ts:46
expect(() => CommandRegistry.register(cmd)).toThrow('Command already registered: test-1');
// async resolution contract — tests/background/message-bus-cold-start.test.ts:95
await expect(bus.dispatch(unknown, {} as chrome.runtime.MessageSender)).resolves.toBeUndefined();
// rejected chrome write — tests/core/theme/ThemeSync.test.tsx:189-202
const syncSetSpy = vi.spyOn(chrome.storage.sync, 'set').mockRejectedValueOnce(new Error('quota exceeded'));
const result = await applyThemeToSync('light', 'default');
expect(result.ok).toBe(false);
if (result.ok === false) expect(result.error).toContain('quota exceeded');
```

**Asserting absence / invariants:**

- Listener counts: `expect(onChangedListeners.length).toBe(beforeUnmount - 1)` (`tests/core/theme/ThemeSync.test.tsx:163-172`)
- Single-write coalescing: `expect(setSpy).toHaveBeenCalledTimes(1)` (`tests/core/storage/chromeStorageAdapter.test.ts:30`)
- Source-level invariants via `fs.readFile` + regex on `src/` (e.g. no `DB_VERSION` import, `tests/core/store/useExtensionStore.test.ts:60-77`)

**Test design traits to preserve:**

- No snapshot tests anywhere (0 `toMatchSnapshot`)
- No `toBeInTheDocument`/jest-dom matchers (library not installed) — keep using native assertions
- Deterministic IDs in fixtures (`'s1'`, `'test-1'`), timestamps avoided
- Comments in tests explain *why* a case exists (decision ID, pitfall reference)

## Where to Add New Tests

- New core module: `tests/core/<domain>/<Unit>.test.ts`; add the file to the owning `verify:phase-N` script in `package.json`
- New store or migration: extend `tests/core/<domain>/<Store>.test.ts`; cover the `migrate` no-op and legacy-blob paths
- New component: `tests/components/<Name>.test.tsx` with a local `renderWithAntd` wrapper (`ConfigProvider`, add `AntdApp` if `App.useApp()` is used)
- New Chrome API usage: mock it in `tests/setup.ts` if broadly needed, otherwise `vi.stubGlobal` in the suite before importing the module under test
- Bundle boundaries / banned imports: extend `tests/isolation/`
- Public module boundary: spec §0.3 requires a Zod schema plus at least one fixture test; `zod` is installed but unused so far — introduce it at the boundary you create

## Known Gaps (be deliberate when touching these areas)

- `pnpm test:perf` references `tests/perf/`, which does not exist — the script fails until perf tests land
- `verify:phase-2` … `verify:phase-8` reference test paths that are not yet created (e.g. `tests/core/security`, `tests/core/utils`, `tests/core/context`, `tests/core/notes`, `tests/addons`); they are forward-looking phase gates
- Untested at suite level: `src/services/aiProvider.ts` streaming path (`streamChatResponse`), `src/core/registry/*`, `src/core/prompts/*`, `src/theme/*`, `src/components/**` beyond MirrorBanner/OnboardingModal, all `entrypoints/*`
- No automated accessibility or visual regression tests; those are manual checks per the project skills

---

*Testing analysis: 2026-09-20*
