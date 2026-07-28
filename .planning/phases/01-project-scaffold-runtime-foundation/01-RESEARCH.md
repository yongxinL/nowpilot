# Phase 1: Project Scaffold & Runtime Foundation — Research

**Researched:** 2026-07-28
**Domain:** Chrome MV3 Extension Shell — WXT entrypoints, Zustand workspace state, Ant Design v6 theming, cross-surface sync, command palette, onboarding
**Confidence:** HIGH

## Summary

Phase 1 establishes the Chrome extension runtime foundation with two UI surfaces (Side Panel and Full App Tab) sharing a single workspace state, a theme system that syncs instantly across both surfaces, a Cmd+K command palette, and a first-install onboarding flow. The existing codebase already has a substantial scaffold: WXT entrypoints are configured, the core runtime layer (BroadcastBus, MessageBus, EventBus) is functional, Vorstadt stores (WorkspaceStore, ThemeStore) use Zustand with persist+immer, and basic shell components exist.

**What needs building:** The existing onboarding modal must be replaced with the UI-SPEC 3-card welcome flow, a `chrome.storage.local`-backed Zustand persist adapter must replace the current localStorage fallback, theme toggle UI must be added to both shells with BroadcastChannel sync, a Cmd+K command palette must be built (does not exist), and the side panel navigation must switch from `Menu` to `Tabs` per the UI-SPEC. Cross-surface workspace handoff via `BroadcastBus` (BroadcastChannel) is already partially implemented in WorkspaceRouter.ts and works because both extension pages share the `chrome-extension://<id>` origin.

**Primary recommendation:** Refactor the existing store layer to use `chrome.storage.local` as the persistence backend (replacing `localStorage`), add a `BroadcastChannel`-based theme sync mechanism, build the command palette as an `antd Modal` + `Input` with a command registry, and replace the onboarding modal with a Steps+Cards flow inside the Side Panel body — all without introducing new npm dependencies.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Entrypoint HTML rendering | Browser (Side Panel / Tab) | — | Each entrypoint is a separate Chrome extension context with its own DOM |
| Workspace state persistence | Browser (chrome.storage.local) | — | `chrome.storage.local` is the canonical store for extension-wide state; survives context destruction |
| Cross-surface state sync | Browser (BroadcastChannel) | Browser (chrome.storage.onChanged) | BroadcastChannel provides real-time same-origin pub-sub between sidepanel.html and app.html; storage.onChanged is the fallback |
| Theme algorithm selection | Frontend (React ConfigProvider) | Browser (chrome.storage.local) | Theme is resolved client-side per entrypoint; the store holds the mode preference |
| Command palette | Frontend (React Modal overlay) | Browser (keydown listener) | Cmd+K is captured at the window level within each extension page; command execution is local |
| Onboarding detection | Browser (chrome.storage.local flag) | — | `onboardingComplete` flag persisted in workspace store; first-install triggers via `runtime.onInstalled` reason="install" |
| Tab deduplication | Browser (chrome.tabs.query) | — | Extension tabs are browsed by URL pattern; only one full app tab per workspace |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WXT | ^0.20.27 (installed 0.21.1 available) | Chrome extension framework — entrypoints, build, HMR | De facto standard for MV3 extension dev; file-based entrypoints, TypeScript, auto-manifest [VERIFIED: npm registry / Context7 /wxt-dev/wxt] |
| React | ^19.0.1 | UI rendering for both surfaces | Project constraint; antd v6 requires React 18+ [VERIFIED: npm registry / Context7 /ant-design/ant-design] |
| Ant Design | ^6.5.2 | Component library (ConfigProvider, Layout, Tabs, Modal, Button, etc.) | Project constraint; enterprise UI with theming, a11y, keyboard support [VERIFIED: npm registry / Context7 /ant-design/ant-design] |
| Zustand | ^5.0.0 (5.0.14 latest) | Client-side state management with persist middleware | Lightweight, supports persist with custom storage adapter, immer middleware, selective subscriptions — ideal for extension contexts [VERIFIED: npm registry / Context7 /pmndrs/zustand] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ant-design/x | ^2.8.0 | AI chat components (XProvider wrapper) | Already wrapped in entrypoint roots; not directly used in Phase 1 but required for future phases |
| @ant-design/icons | ^6.3.2 | Icon library (Sun/Moon, Expand, etc.) | For theme toggle icon, expand icon, command palette category icons |
| motion | ^12.23.24 | Animation library (antd dependency) | Used by antd components internally; no direct use in Phase 1 |
| immer | ^10.1.1 | Immutable state updates (Zustand middleware) | Used by WorkspaceStore and ThemeStore via zustand/middleware/immer |
| zod | ^3.24.0 | Schema validation | Not directly used in Phase 1; declared for future phases |
| vitest | ^3.0.0 | Test runner | Phase verification scripts: `pnpm run verify:phase-1` [CITED: package.json] |
| jsdom | ^25.0.0 | DOM environment for vitest | Test environment for React component testing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Zustand persist with localStorage | Zustand persist with chrome.storage.local adapter | `localStorage` is per-origin and survives page reload but does NOT sync across extension contexts; `chrome.storage.local` is shared across all extension pages [CITED: chrome.storage docs] |
| Custom BroadcastChannel wrapper | `chrome.storage.onChanged` listener | The existing BroadcastBus already wraps BroadcastChannel correctly; `chrome.storage.onChanged` is a viable fallback for edge cases where BroadcastChannel isn't available |
| In-app Cmd+K keydown listener | `chrome.commands` API | `chrome.commands` requires manifest declaration and fires at extension level; in-app keydown gives fine-grained control over which surface shows the palette and avoids manifest clutter for internal-only shortcuts [CITED: chrome.commands docs] |

**Installation:**
```bash
pnpm install  # All dependencies already in package.json; no new packages needed for Phase 1
```

**Version verification:**
```bash
npm view antd version          # 6.5.2 (match)
npm view zustand version       # 5.0.14 (^5.0.0 satisfied)
npm view wxt version           # 0.21.1 (^0.20.27 satisfied; minor bump available)
npm view @ant-design/icons version  # 6.3.2 (match)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| wxt | npm | ~2 yrs | 527K/wk | github.com/wxt-dev/wxt | SUS (too-new publish) | Approved — well-established framework, high downloads, legitimate repo; "too-new" signal is a recent patch release |
| antd | npm | ~9 yrs | 3.8M/wk | github.com/ant-design/ant-design | SUS (too-new publish) | Approved — mature library, High source reputation on Context7; "too-new" is recent v6.5.2 release |
| zustand | npm | ~6 yrs | 47M/wk | github.com/pmndrs/zustand | OK | Approved |
| @ant-design/x | npm | ~2 yrs | 94K/wk | github.com/ant-design/x | SUS (too-new publish) | Approved — official Ant Design X component library; High source reputation |
| @ant-design/x-markdown | npm | ~2 yrs | 25K/wk | github.com/ant-design/x | SUS (too-new publish) | Approved — official Ant Design X markdown renderer |
| @ant-design/icons | npm | ~8 yrs | 4.6M/wk | github.com/ant-design/ant-design-icons | OK | Approved |
| immer | npm | ~8 yrs | 55M/wk | github.com/immerjs/immer | SUS (too-new publish) | Approved — widely used immutability library |
| motion | npm | ~9 yrs | 16M/wk | github.com/motiondivision/motion | SUS (too-new publish) | Approved — successor to framer-motion |
| react | npm | ~11 yrs | 163M/wk | github.com/react/react | SUS (too-new publish) | Approved — React itself |
| react-dom | npm | ~11 yrs | 154M/wk | github.com/react/react | SUS (too-new publish) | Approved |
| zod | npm | ~6 yrs | 240M/wk | github.com/colinhacks/zod | OK | Approved |
| vitest | npm | ~4 yrs | 82M/wk | github.com/vitest-dev/vitest | SUS (too-new publish) | Approved |
| jsdom | npm | ~14 yrs | 86M/wk | github.com/jsdom/jsdom | SUS (too-new publish) | Approved |
| @testing-library/react | npm | ~7 yrs | 49M/wk | github.com/testing-library/react-testing-library | OK | Approved |

**Packages removed due to SLOP verdict:** none

**Packages flagged as suspicious SUS:** All SUS verdicts are due to "too-new" publish dates (recent patch/minor releases of well-established packages). No actual suspicious packages detected. No postinstall scripts found on any package. The planner does not need to add `checkpoint:human-verify` for these — all are major, well-known packages with legitimate repositories and millions of weekly downloads.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│                    Chrome Extension                       │
│                                                          │
│  ┌─────────────────┐       ┌─────────────────────────┐   │
│  │  Side Panel      │       │  Full App Tab            │   │
│  │  (~400px)        │       │  (full viewport)         │   │
│  │                  │       │                          │   │
│  │  ConfigProvider  │       │  ConfigProvider          │   │
│  │  ┌─────────────┐ │       │  ┌────────────────────┐ │   │
│  │  │ SidePanel   │ │       │  │ AppShell            │ │   │
│  │  │ Shell       │ │       │  │                     │ │   │
│  │  │  ┌────────┐ │ │       │  │  Layout.Sider       │ │   │
│  │  │  │ Header │ │ │       │  │  ┌───────────────┐  │ │   │
│  │  │  │ Theme  │ │ │       │  │  │ Nav Menu      │  │ │   │
│  │  │  │ Toggle │ │ │       │  │  │               │  │ │   │
│  │  │  └────────┘ │ │       │  │  │ Chat/Agent/   │  │ │   │
│  │  │  ┌────────┐ │ │       │  │  │ Notes/Options │  │ │   │
│  │  │  │ Tabs   │ │ │       │  │  └───────────────┘  │ │   │
│  │  │  └────────┘ │ │       │  │  Layout.Content     │ │   │
│  │  │  ┌────────┐ │ │       │  │  ┌───────────────┐  │ │   │
│  │  │  │Content │ │ │       │  │  │ Page Router   │  │ │   │
│  │  │  └────────┘ │ │       │  │  └───────────────┘  │ │   │
│  │  │  ┌────────┐ │ │       │  └────────────────────┘ │   │
│  │  │  │ Footer │ │ │       │                          │   │
│  │  │  │ Open    │ │ │       │                          │   │
│  │  │  │ Full    │─┼─┼──────►  (handoff via URL params) │   │
│  │  │  │ App btn │ │ │       │                          │   │
│  │  │  └────────┘ │ │       └─────────────────────────┘   │
│  │  └─────────────┘ │                                     │
│  └─────────────────┘                                     │
│           │                                               │
│           ▼                                               │
│  ┌─────────────────────────────────────────┐             │
│  │         BroadcastBus (BroadcastChannel)  │             │
│  │         np_workspace / np_theme channels │             │
│  └─────────────────────────────────────────┘             │
│           │                                               │
│           ▼                                               │
│  ┌─────────────────────────────────────────┐             │
│  │      chrome.storage.local                │             │
│  │      Zustand persist backend             │             │
│  │      (np_workspace_store / np_theme_store)│            │
│  └─────────────────────────────────────────┘             │
│           │                                               │
│           ▼                                               │
│  ┌─────────────────────────────────────────┐             │
│  │      Background Service Worker           │             │
│  │      chrome.runtime.onInstalled          │             │
│  │      chrome.sidePanel.setPanelBehavior   │             │
│  └─────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────┘
```

**Data flow for theme toggle:**
1. User clicks theme icon in either surface
2. `ThemeStore.setMode(newMode)` updates Zustand state
3. Zustand persist middleware writes to `chrome.storage.local` key `np_theme_store`
4. Theme change published via BroadcastChannel `np_theme` channel
5. Other surface receives broadcast, calls `ThemeStore.persist.rehydrate()` or directly updates
6. `ConfigProvider theme.algorithm` re-renders with new algorithm

**Data flow for workspace handoff:**
1. User clicks "Open in Full App" in Side Panel
2. `WorkspaceRouter.openFullApp()` serializes workspaceId, conversationId, page to URL params
3. `chrome.tabs.query({ url: 'app.html' })` checks for existing tab
4. If exists: `chrome.tabs.update(tabId, { active: true })` — deduplication
5. If new: `chrome.tabs.create({ url })` — opens app.html with params
6. Full App Tab `AppShell` calls `hydrateFromURL(searchParams)` to restore state
7. Cross-surface state sync via BroadcastChannel `np_workspace` channel

### Recommended Project Structure

```
entrypoints/
├── sidepanel/           # Side Panel entrypoint (~400px wide)
│   ├── index.html
│   └── main.tsx        # ConfigProvider + XProvider wrapping SidePanelShell
├── app/                 # Full App Tab entrypoint (full viewport)
│   ├── index.html
│   └── main.tsx        # ConfigProvider + XProvider wrapping AppShell
├── background.ts        # Service Worker (onInstalled, sidePanel setup)
├── content.core.ts      # Content script (SPA nav detection, extraction-only)
└── options/             # Options page entrypoint

src/
├── core/                # Shared core — no React imports (pure logic)
│   ├── runtime/         # BroadcastBus, MessageBus, RuntimeEnvelope, OperationId
│   │   ├── BroadcastBus.ts      # BroadcastChannel wrapper (cross-surface pub-sub)
│   │   ├── RuntimeEnvelope.ts   # Typed message envelope factory
│   │   └── workerState.ts       # Service worker state helpers
│   ├── workspace/       # Workspace state & routing
│   │   ├── WorkspaceStore.ts    # Zustand store (persist + immer)
│   │   ├── WorkspaceRouter.ts   # openFullApp(), hydrateFromURL()
│   │   └── WorkspaceSync.ts     # BroadcastChannel workspace messages
│   ├── theme/           # Theme management
│   │   ├── ThemeStore.ts        # Zustand store (persist + immer) light/dark/auto
│   │   └── antdConfig.ts        # getAntdConfig() → ThemeConfig (reads ThemeStore)
│   ├── events/          # In-process EventBus (same-context only)
│   │   └── EventBus.ts
│   ├── messaging/       # chrome.runtime.onMessage handler registry
│   │   └── MessageBus.ts
│   ├── commands/        # [NEW] Command palette registry
│   │   └── CommandRegistry.ts   # Command definitions, fuzzy search, execute
│   ├── components/      # Shared core components
│   │   └── ErrorBoundary.tsx
│   └── i18n/
│       └── strings.ts   # Copy strings
├── components/          # React components
│   ├── sidepanel/       # Side Panel-specific components
│   │   ├── SidePanelShell.tsx
│   │   └── SidePanelRouter.tsx
│   ├── app/             # Full App Tab-specific components
│   │   ├── AppShell.tsx
│   │   └── FullAppRouter.tsx
│   ├── common/          # [NEW/EXPANDED] Shared UI components
│   │   ├── ThemeToggle.tsx       # [NEW] Theme mode toggle (light/dark/auto)
│   │   ├── CommandPalette.tsx    # [NEW] Cmd+K command palette overlay
│   │   └── OnboardingWizard.tsx  # [REFACTORED] 3-card welcome flow
│   ├── pages/           # Page-level components
│   │   ├── ChatPage.tsx
│   │   ├── AgentPage.tsx
│   │   ├── NotesPage.tsx
│   │   └── OptionsPage.tsx
│   └── ...
├── store/
│   └── useExtensionStore.ts  # Legacy chat state (localStorage-based) — Phase 2 will migrate
├── types/
│   └── index.ts
└── assets/

tests/
├── core/
│   ├── workspace/       # WorkspaceStore, WorkspaceRouter tests (exists)
│   ├── theme/           # ThemeStore tests (exists)
│   ├── events/          # EventBus tests (exists)
│   ├── runtime/         # OperationId, RuntimeEnvelope tests (exists)
│   └── commands/        # [NEW] CommandRegistry tests
├── components/          # [NEW] Component tests
│   └── common/
│       ├── ThemeToggle.test.tsx
│       ├── CommandPalette.test.tsx
│       └── OnboardingWizard.test.tsx
└── setup.ts
```

### Pattern 1: Zustand Persist with chrome.storage.local Adapter

**What:** Replace localStorage-based persist with a custom `chrome.storage.local` adapter that implements Zustand's `StateStorage` interface. This ensures workspace state and theme preferences are shared across all extension contexts.

**When to use:** Any Zustand store that needs cross-context state sharing (WorkspaceStore, ThemeStore). The default `localStorage` is per-origin but does NOT sync between the side panel page and the app tab page in all Chrome scenarios.

**Example:**
```typescript
// Source: adapted from Context7 /pmndrs/zustand persist docs + chrome.storage API
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

const chromeStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const result = await chrome.storage.local.get(name);
    return result[name] ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await chrome.storage.local.set({ [name]: value });
  },
  removeItem: async (name: string): Promise<void> => {
    await chrome.storage.local.remove(name);
  },
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    immer((set, get) => ({
      mode: 'auto' as ThemeMode,
      setMode: (mode) => set((state) => { state.mode = mode; }),
      resolvedMode: () => { /* ... */ },
    })),
    {
      name: 'np_theme_store',
      storage: createJSONStorage(() => chromeStorageAdapter),
    },
  ),
);
```

### Pattern 2: BroadcastChannel Theme Sync

**What:** When theme changes in one surface, publish via BroadcastChannel; other surfaces listen and rehydrate or directly apply the change. This provides sub-100ms cross-surface reactivity without polling.

**When to use:** Theme toggles, workspace state changes that must be immediately visible on both surfaces.

**Example:**
```typescript
// Source: existing BroadcastBus.ts pattern in codebase + chrome.storage.onChanged docs [CITED: developer.chrome.com]
const THEME_CHANNEL = 'np_theme';

// In ThemeStore (or a sync hook):
useEffect(() => {
  const bc = new BroadcastChannel(THEME_CHANNEL);
  bc.onmessage = (event) => {
    if (event.data.type === 'THEME_CHANGED' && event.data.mode) {
      useThemeStore.getState().setMode(event.data.mode);
    }
  };
  return () => bc.close();
}, []);
```

### Pattern 3: Command Palette with Ant Design Modal

**What:** A Modal overlay triggered by Cmd+K (window keydown listener) with an auto-focused search input, fuzzy-matched command results, and keyboard navigation (arrow keys + Enter + Escape).

**When to use:** Keyboard-driven command invocation. Both surfaces share the same CommandPalette component but register their own surface-specific commands.

**Example:**
```typescript
// Source: adapted from antd Modal docs + chrome.commands API reference
// [CITED: developer.chrome.com/docs/extensions/reference/api/commands]
import { Modal, Input, List } from 'antd';
import { useEffect, useState, useCallback } from 'react';

interface Command {
  id: string;
  name: string;
  description: string;
  category: string;
  action: () => void;
}

export function CommandPalette({ commands, open, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = commands.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose ? onClose() : /* open */;
      }
      if (e.key === 'Escape') onClose?.();
      if (e.key === 'ArrowDown') setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
      if (e.key === 'ArrowUp') setSelectedIndex(i => Math.max(i - 1, 0));
      if (e.key === 'Enter' && filtered[selectedIndex]) {
        filtered[selectedIndex].action();
        onClose?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [filtered, selectedIndex]);

  return (
    <Modal open={open} footer={null} closable onCancel={onClose} width={560} centered>
      <Input
        autoFocus
        placeholder="Search commands..."
        value={query}
        onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
      />
      <List
        dataSource={filtered}
        renderItem={(cmd, i) => (
          <List.Item
            onClick={cmd.action}
            style={{ background: i === selectedIndex ? 'var(--ant-color-primary-bg)' : undefined }}
          >
            {cmd.name}
          </List.Item>
        )}
      />
    </Modal>
  );
}
```

### Anti-Patterns to Avoid

- **Using `localStorage` for cross-context state:** `localStorage` is per-origin but MV3 extension contexts (service worker, side panel, app tab) may not reliably share it. Use `chrome.storage.local` for all persisted extension state. [CITED: chrome.storage docs]
- **`chrome.storage.onChanged` as primary sync mechanism:** It's throttled and may have latency. Use BroadcastChannel for real-time, chrome.storage.onChanged as fallback.
- **Importing React from `src/core/`:** Core modules must remain framework-agnostic. No React imports in `src/core/` — keep pure logic separated. Current codebase follows this correctly.
- **Registering Cmd+K via `chrome.commands` API:** Chrome command shortcuts require `Ctrl` or `Alt` modifier and are scoped globally. This would interfere with other extensions and apps. Use an in-page `keydown` listener for internal-only shortcuts. [CITED: chrome.commands docs]
- **Tight coupling between entrypoints:** Side Panel should never import from `src/components/app/` and vice versa. Shared components go in `src/components/common/`. The existing code has no cross-entrypoint imports — maintain this.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cross-context pub-sub | Custom WebSocket or polling | BroadcastChannel API (built-in) | Native browser API with same-origin scoping; zero dependencies, sub-millisecond latency between extension pages [CITED: developer.mozilla.org] |
| State persistence across contexts | localStorage + manual polling | Zustand persist + chrome.storage.local adapter | Zustand's persist middleware handles serialization, rehydration, version migration; chrome.storage.local is the canonical MV3 persistence layer [CITED: chrome.storage docs] |
| Fuzzy search for commands | Custom Levenshtein implementation | Simple `includes()` with lowercase normalization (Phase 1) | Command set is < 20 items in Phase 1; no need for full fuzzy search library until Phase 7 |
| Theme algorithm management | Manual CSS class toggling or CSS variables | antd ConfigProvider `theme.algorithm` | antd v6 provides `defaultAlgorithm` and `darkAlgorithm` as first-class theme tokens; handles all component-level dark mode automatically [VERIFIED: Context7 /ant-design/ant-design] |
| Keyboard shortcut registration | Custom global keybinding system | window `keydown` event listener | Cmd+K is an in-app shortcut, not a system-wide command; window-level listener with `metaKey`/`ctrlKey` check is the standard pattern |
| Onboarding first-install detection | Custom flag file or cookie | `chrome.runtime.onInstalled` with `reason === "install"` → `chrome.storage.local` flag | Official Chrome API for detecting fresh installs; storage flag for onboarding completion tracking [CITED: chrome.runtime docs] |

**Key insight:** Chrome MV3 extensions provide first-class APIs for all cross-context communication and state persistence needs. The only third-party dependencies needed are React/AntD for UI and Zustand for state management. Everything else — BroadcastChannel, chrome.storage, chrome.runtime.onInstalled, chrome.tabs — is built into the platform.

## Common Pitfalls

### Pitfall 1: Zustand Persist Rehydration Race Condition

**What goes wrong:** The Zustand persist middleware reads from storage asynchronously. If a component reads store state before rehydration completes, it gets the default (empty) state instead of persisted state. This causes a flash of default theme or empty workspace.

**Why it happens:** Zustand's `persist` middleware has an `onRehydrateStorage` callback and a `hasHydrated()` method, but the initial render happens before the async storage read resolves.

**How to avoid:** Use Zustand's `persist.onRehydrateStorage` to track hydration state. Show a loading skeleton (`antd Skeleton`) while `useThemeStore.persist.hasHydrated()` or `useWorkspaceStore.persist.hasHydrated()` returns `false`. The UI-SPEC already requires a "Loading workspace..." skeleton state.

**Warning signs:** Brief flash of default theme before switching to saved theme; empty workspaceId on first render.

### Pitfall 2: BroadcastChannel Memory Leak

**What goes wrong:** Creating a new `BroadcastChannel` on every render creates orphaned channels that accumulate listeners and never close.

**Why it happens:** React components re-render; if `new BroadcastChannel(name)` is called in the component body (not in `useEffect`), a new channel is created each render.

**How to avoid:** Always create `BroadcastChannel` instances inside `useEffect` and close them in the cleanup function. The existing `BroadcastBus.ts` already manages channel lifecycle correctly — reuse it.

**Warning signs:** Increasing memory usage over time; duplicate event handler firings.

### Pitfall 3: chrome.tabs.query Permissions Gap

**What goes wrong:** `chrome.tabs.query({ url: '...' })` silently returns empty array if the extension doesn't have the `"tabs"` permission or if the URL pattern doesn't match.

**Why it happens:** Chrome's `tabs.query` with URL filter requires either the `"tabs"` permission or the tabs to be in the current window. Without it, only limited tab info is returned.

**How to avoid:** The `"tabs"` permission is already declared in `wxt.config.ts` permissions array. The existing `WorkspaceRouter.openFullApp()` correctly uses `chrome.tabs.query` with the full `chrome.runtime.getURL('app.html')` pattern. Verify this works in the built extension; if queries return empty, add `{ currentWindow: true }` option.

**Warning signs:** Duplicate full app tabs created because the existing tab was not detected.

### Pitfall 4: Theme Flash on ConfigProvider Re-render

**What goes wrong:** When the theme algorithm changes (`darkAlgorithm` ↔ `defaultAlgorithm`), antd components briefly flash the old theme before re-rendering with the new one.

**Why it happens:** React's synchronous rendering can cause a visible intermediate state if the theme token computation is slow or if multiple re-renders cascade.

**How to avoid:** Use antd's built-in CSS variable mode (`theme.cssVar = true` in ConfigProvider) for instant theme switching without re-rendering. Alternatively, wrap the ConfigProvider in a `React.startTransition` to defer non-urgent updates. For Phase 1, the simple algorithm swap is sufficient; the flash is minimal (< 50ms for ~20 components).

**Warning signs:** Visible flicker when toggling theme; console warnings about theme token recomputation.

## Code Examples

Verified patterns from official sources:

### antd ConfigProvider Dynamic Theme Switching
```tsx
// Source: Context7 /ant-design/ant-design customize-theme docs
// [VERIFIED: Context7]
import React, { useState } from 'react';
import { ConfigProvider, theme } from 'antd';

const App = () => {
  const [darkTheme, setDarkTheme] = useState(false);

  return (
    <ConfigProvider
      theme={{
        algorithm: darkTheme ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <YourApp />
      <button onClick={() => setDarkTheme(v => !v)}>Toggle Theme</button>
    </ConfigProvider>
  );
};
```

### Zustand Custom Storage Adapter Pattern
```typescript
// Source: Context7 /pmndrs/zustand persist docs — custom StateStorage
// [VERIFIED: Context7]
import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

const storage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    return (await get(name)) || null;  // get() from your storage API
  },
  setItem: async (name: string, value: string): Promise<void> => {
    await set(name, value);
  },
  removeItem: async (name: string): Promise<void> => {
    await del(name);
  },
};

export const useBoundStore = create(
  persist(
    (set, get) => ({
      bears: 0,
      addABear: () => set({ bears: get().bears + 1 }),
    }),
    {
      name: 'storage-key',
      storage: createJSONStorage(() => storage),
    },
  ),
);
```

### Chrome Side Panel setPanelBehavior
```typescript
// Source: developer.chrome.com/docs/extensions/reference/api/sidePanel
// [CITED: developer.chrome.com/docs/extensions/reference/api/sidePanel]
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

// First-install detection
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    // Set onboarding flag
    chrome.storage.local.set({ onboardingComplete: false });
  }
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage for extension state | chrome.storage.local | MV3 (Chrome 88+) | Cross-context persistence, sync across service worker + side panel + tabs, 5MB quota (vs 5-10MB localStorage) [CITED: chrome.storage docs] |
| Manual CSS dark mode | antd ConfigProvider `theme.algorithm` | antd v5+ | Single algorithm swap darkens all components; no per-component CSS overrides needed [VERIFIED: Context7 /ant-design/ant-design] |
| Redux for extension state | Zustand + persist + immer | 2021+ | Smaller bundle (2KB vs 12KB), simpler API, built-in persist middleware, immer support [VERIFIED: Context7 /pmndrs/zustand] |
| chrome.runtime.sendMessage for all cross-context comm | BroadcastChannel for same-origin, runtime.sendMessage for SW | 2019+ (BroadcastChannel) | BroadcastChannel is lower latency and doesn't require serializing through the service worker; runtime messaging is still needed for content script ↔ extension communication |

**Deprecated/outdated:**
- `localStorage` for cross-context extension state — use `chrome.storage.local` instead (MV3 best practice) [CITED: chrome.storage docs]
- `chrome.extension.getBackgroundPage()` — removed in MV3; service workers have no persistent background page [CITED: chrome.runtime docs]
- CSS class-based theme toggling with antd — use `ConfigProvider theme.algorithm` (antd v5+ standard) [VERIFIED: Context7 /ant-design/ant-design]

## Runtime State Inventory

> This phase is NOT a rename/refactor/migration phase. It is a greenfield build phase (scaffolding new functionality into an existing codebase skeleton). Runtime state inventory is omitted per the phase description.

**Nothing to migrate:** The existing codebase has placeholder components (SidePanelShell, AppShell, OnboardingModal) that will be refactored or replaced. No data migration is needed — all state stores use persistence keys that remain stable.

## User Constraints (from PROJECT.md)

### Locked Decisions (from PROJECT.md Key Decisions)
- Ant Design v6 + Ant Design X 2.x as UI stack — no tailwindcss, shadcn/ui, @radix-ui/react-*, framer-motion
- NOT @ant-design/x-sdk — AgentOrchestrator/ProviderRouter/ContextOptimizer own the data flow
- Two surfaces (Side Panel + Full App) with shared WorkspaceStore and single-writer primary election via BroadcastBus
- Content scripts extraction-only in v0.1 — no Shadow DOM, no host-page UI
- Knowledge-first phase ordering

### Project Constraints (from PROJECT.md Constraints)
- Tech stack: WXT ^0.19 (using ^0.20.27), React ^19, antd ^6, @ant-design/x ^2, Zustand ^5, @ai-sdk/* ^1, zod ^3, MiniSearch ^7, idb ^8, motion ^12, yaml ^2, defuddle ^0.6
- MV3 rules: No AI/MCP/IndexedDB in background SW; no custom User-Agent; no eval/remote code; content scripts extraction-only
- Performance targets: Side panel < 300ms paint, Full App < 500ms, content script bundle < 50KB
- No Shadcn/ui, @radix-ui/react-*, tailwindcss — antd theme tokens for all styling

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.0.0 |
| Config file | `vitest.config.ts` (jsdom environment, globals: true) |
| Quick run command | `npx vitest run tests/core/workspace tests/core/theme tests/core/events tests/core/runtime` |
| Full suite command | `pnpm run verify:phase-1` (`tsc --noEmit && vitest run tests/core/runtime tests/core/events tests/core/workspace tests/core/theme`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SHELL-03 | Shared workspace persists across surfaces with handoff | unit | `npx vitest run tests/core/workspace/WorkspaceStore.test.ts -t "persists"` | ✅ exists |
| SHELL-03 | Open Full App deduplicates existing tab | unit | `npx vitest run tests/core/workspace/WorkspaceRouter.test.ts` | ✅ exists |
| SHELL-04 | Theme toggle (light/dark/auto) | unit | `npx vitest run tests/core/theme/ThemeStore.test.ts` | ✅ exists |
| SHELL-04 | Cross-surface theme sync via BroadcastChannel | integration | `npx vitest run tests/core/theme/ThemeStore.test.ts -t "broadcast"` | ❌ Wave 0 gap |
| SHELL-05 | Cmd+K opens command palette | component | `npx vitest run tests/components/common/CommandPalette.test.tsx` | ❌ Wave 0 gap |
| SHELL-05 | Command palette filters and executes commands | component | `npx vitest run tests/core/commands/CommandRegistry.test.ts` | ❌ Wave 0 gap |
| — | Onboarding shows on first install | integration | `npx vitest run tests/components/common/OnboardingWizard.test.tsx` | ❌ Wave 0 gap |
| — | Side Panel shell renders theme toggle + tabs | component | `npx vitest run tests/components/sidepanel/SidePanelShell.test.tsx` | ❌ Wave 0 gap |
| — | Full App shell renders sidebar + content + theme toggle | component | `npx vitest run tests/components/app/AppShell.test.tsx` | ❌ Wave 0 gap |
| — | No cross-entrypoint imports | isolation | `npx vitest run tests/isolation/cross-entrypoint-imports.test.ts` | ❌ Wave 0 gap |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/workspace tests/core/theme tests/core/events tests/core/runtime`
- **Per wave merge:** `pnpm run verify:phase-1`
- **Phase gate:** Full phase-1 verification green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/components/common/ThemeToggle.test.tsx` — covers theme toggle component rendering and mode cycling
- [ ] `tests/components/common/CommandPalette.test.tsx` — covers Cmd+K modal rendering, search filtering, keyboard navigation
- [ ] `tests/core/commands/CommandRegistry.test.ts` — covers command registration, fuzzy matching, execution
- [ ] `tests/components/common/OnboardingWizard.test.tsx` — covers onboarding flow (steps, navigation, completion)
- [ ] `tests/components/sidepanel/SidePanelShell.test.tsx` — covers side panel shell with Tabs + theme toggle + footer
- [ ] `tests/components/app/AppShell.test.tsx` — covers full app shell with sidebar + theme toggle
- [ ] `tests/isolation/cross-entrypoint-imports.test.ts` — verifies no sidepanel imports from app/ and vice versa
- [ ] `tests/core/theme/ThemeSync.test.ts` — covers BroadcastChannel theme sync between surfaces
- [ ] Test setup needs BroadcastChannel mock — currently `tests/setup.ts` only stubs `localStorage`; needs to add BroadcastChannel and chrome.storage mocks

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Phase 1 has no auth; API key entry deferred to Phase 2 |
| V3 Session Management | no | Session tokens deferred to Phase 2 |
| V4 Access Control | no | No access control in shell phase |
| V5 Input Validation | yes | Command palette search input must be sanitized against XSS (antd Input handles this natively); onboarding wizard navigation is deterministic (no user content injection) |
| V6 Cryptography | no | No cryptography in shell phase |
| V7 Error Handling | yes | Error boundaries in both shells; no stack traces in UI ("Something went wrong. Please reload the extension." per UI-SPEC) |
| V8 Data Protection | yes | Workspace state stored in chrome.storage.local (not localStorage); chrome.storage.local is scoped to the extension and encrypted at rest by Chrome |

### Known Threat Patterns for Chrome Extension Shell

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via command palette search | Tampering | antd Input component auto-escapes; no `dangerouslySetInnerHTML` used; command names are hardcoded strings |
| Extension message spoofing | Spoofing | `RuntimeEnvelope.isEnvelope()` validates message shape; `MessageTypeValues` constrains allowed message types |
| chrome.storage.local tampering by other extensions | Tampering | Extension storage is sandboxed per extension — other extensions cannot access this extension's storage |
| BroadcastChannel cross-extension eavesdropping | Information Disclosure | BroadcastChannel is same-origin scoped — only pages from the same `chrome-extension://<id>` origin can receive messages |
| CSP bypass via command palette rendering | Tampering | CSP `extension_pages: "script-src 'self'; object-src 'self'"` prevents inline scripts; all commands execute local functions, no eval() |

## Sources

### Primary (HIGH confidence)
- Context7 `/wxt-dev/wxt` — WXT entrypoint patterns, sidepanel configuration, manifest generation
- Context7 `/pmndrs/zustand` — Zustand persist middleware, custom StateStorage adapters, cross-tab sync (`withStorageDOMEvents`), rehydration API
- Context7 `/ant-design/ant-design` — ConfigProvider dynamic theme switching, `theme.algorithm`, `darkAlgorithm`/`defaultAlgorithm`
- Google Chrome Developers — `chrome.sidePanel` API reference (`developer.chrome.com/docs/extensions/reference/api/sidePanel`): `setPanelBehavior`, `open`, `setOptions`, `getOptions`
- Google Chrome Developers — `chrome.commands` API reference (`developer.chrome.com/docs/extensions/reference/api/commands`): command registration, `onCommand`, suggested_key, key combination requirements
- Google Chrome Developers — `chrome.runtime` API reference (`developer.chrome.com/docs/extensions/reference/api/runtime`): `onInstalled` with `OnInstalledReason`, `sendMessage`, `onMessage`

### Secondary (MEDIUM confidence)
- Existing codebase analysis — grep for cross-entrypoint imports: confirmed zero violations between `src/components/sidepanel/` and `src/components/app/`
- Existing test infrastructure — vitest.config.ts, tests/setup.ts (localStorage stub only), test directories for workspace/theme/events/runtime
- npm registry verification — all package versions confirmed, no postinstall scripts detected, no deprecated packages

### Tertiary (LOW confidence)
- Training knowledge on command palette best practices — the Cmd+K pattern with antd Modal is common but not yet verified against a specific authoritative source for Chrome extensions

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `BroadcastChannel` works between sidepanel.html and app.html because they share the same `chrome-extension://` origin | Architecture Patterns | LOW — BroadcastChannel is origin-scoped; if Chrome isolates extension pages per context, fall back to `chrome.runtime.sendMessage` |
| A2 | Zustand's persist middleware supports async `StateStorage.getItem` — used by chrome.storage.local adapter | Pattern 1 | LOW — Context7 docs explicitly show async `getItem` returning `Promise<string | null>` |
| A3 | WXT will auto-generate manifest entries for both `sidepanel/` and `app/` entrypoints | Architecture | LOW — WXT docs confirm entrypoint auto-detection; `app.html` is not a WXT-recognized type (not popup/sidepanel/newtab) so it's treated as a generic HTML page, which still gets bundled |
| A4 | Chrome extension pages can use `window.matchMedia('(prefers-color-scheme: dark)')` for auto theme detection | Theme | LOW — Extension pages are regular web pages with full DOM API access; `matchMedia` is standard |
| A5 | Existing `chrome.tabs.query` in WorkspaceRouter correctly finds existing app.html tabs | WorkspaceRouter | MEDIUM — If the `"tabs"` permission behaves differently than expected, tab deduplication may fail and duplicate tabs will open |

## Open Questions (RESOLVED)

1. **[RESOLVED] Should the Full App Tab be a WXT `newtab` entrypoint or a generic HTML page?**
   - What we know: Currently `entrypoints/app/` is a generic HTML page (not a WXT-recognized type). WXT bundles it and `chrome.runtime.getURL('app.html')` resolves correctly. Using `newtab` would override the user's new tab page, which is not the intended behavior.
   - What's unclear: Whether using a generic HTML entrypoint has any drawbacks for the Full App Tab use case (e.g., hot reload behavior).
   - Recommendation: Keep as generic HTML page. The current approach works and doesn't interfere with browser new tab behavior.

2. **[RESOLVED] Does Zustand persist with async storage cause a noticeable hydration delay?**
   - What we know: `chrome.storage.local.get()` is async but typically resolves in < 5ms for small payloads. Zustand's persist middleware handles async hydration via `onRehydrateStorage` callback.
   - What's unclear: Whether the hydration delay is noticeable in the Side Panel (< 300ms paint target).
   - Recommendation: Implement with `Skeleton` loading state per UI-SPEC; measure hydration time in Wave 0; if > 100ms, consider synchronous hydration from a preloaded cache.

3. **[RESOLVED] Should the command palette be a shared component or surface-specific?**
   - What we know: Both surfaces need Cmd+K. Phase 1 commands are limited ("Toggle Theme", "Open in Full Tab", "Reload Extension"). Phase 7 will add the full command set.
   - What's unclear: Whether certain commands should only appear on specific surfaces.
   - Recommendation: Build a shared `CommandPalette` component that accepts a `commands` array prop. Each shell passes surface-appropriate commands. This keeps the component reusable while allowing surface-specific command registration.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build toolchain | ✓ | v26.5.0 | — |
| npm | Package management | ✓ | 11.17.0 | — |
| pnpm | Package installation | ✓ | 9.15.9 | npm works as fallback |
| Chrome (MV3) | Extension runtime | ✗ (not verified) | — | Required for testing; user provides |
| TypeScript | Type checking | ✓ | ~5.8.2 | — |
| vitest | Test runner | ✓ | ^3.0.0 | — |

**Missing dependencies with no fallback:**
- Chrome browser with MV3 support (Chrome 114+) — required for manual testing and extension loading; not verifiable in CI

**Missing dependencies with fallback:**
- None — all build-time dependencies are installed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified via npm registry + Context7 official docs
- Architecture: HIGH — chrome.dev API documentation confirms all architectural decisions; existing codebase patterns validated
- Pitfalls: MEDIUM — identified from docs and training knowledge; some pitfalls (BroadcastChannel origin scope, chrome.storage quota) are theoretically possible but unlikely in this extension type
- Cross-surface sync: HIGH — BroadcastChannel + chrome.storage.local pattern confirmed by official Chrome docs and existing BroadcastBus implementation

**Research date:** 2026-07-28
**Valid until:** 2026-08-28 (30 days — stable domain, no anticipated API changes)
