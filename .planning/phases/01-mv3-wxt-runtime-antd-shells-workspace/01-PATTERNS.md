# Phase 1: MV3/WXT Runtime + AntD Shells + Workspace - Pattern Map

**Mapped:** 2026-07-10
**Files analyzed:** 46 new / 0 modified
**Analogs found:** 0 / 46 (greenfield — no existing codebase)
**Pattern source:** RESEARCH.md code examples + official library docs

## File Classification

### Config & Infrastructure (6 files)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `package.json` | config | n/a | None (greenfield) | n/a |
| `wxt.config.ts` | config | n/a | None (greenfield) | n/a |
| `tsconfig.json` | config | n/a | None (greenfield) | n/a |
| `vitest.config.ts` | config | n/a | None (greenfield) | n/a |
| ESLint config | config | n/a | None (greenfield) | n/a |
| Prettier config | config | n/a | None (greenfield) | n/a |

### Entry Points — Background (1 file)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/entrypoints/background.ts` | background-sw | event-driven | RESEARCH.md lines 342-367 | research-pattern |

### Entry Points — Side Panel (3 files)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/entrypoints/sidepanel.html` | entry-html | n/a | None (greenfield) | n/a |
| `src/entrypoints/sidepanel/main.tsx` | mount-point | request-response (render) | None (greenfield) | n/a |
| `src/entrypoints/sidepanel/App.tsx` | component | request-response (render) | RESEARCH.md lines 253-278 | research-pattern |

### Entry Points — Full App (3 files)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/entrypoints/app.html` | entry-html | n/a | None (greenfield) | n/a |
| `src/entrypoints/app/main.tsx` | mount-point | request-response (render) | None (greenfield) | n/a |
| `src/entrypoints/app/App.tsx` | component | request-response (render) | RESEARCH.md lines 253-278 | research-pattern |

### Entry Points — Popup (3 files)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/entrypoints/popup.html` | entry-html | n/a | None (greenfield) | n/a |
| `src/entrypoints/popup/main.tsx` | mount-point | request-response (render) | None (greenfield) | n/a |
| `src/entrypoints/popup/App.tsx` | component | request-response (render) | RESEARCH.md lines 253-278 | research-pattern |

### Core — Stores (2 files)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/core/stores/themeStore.ts` | store | CRUD (chrome.storage.sync) | RESEARCH.md lines 208-248 | research-pattern |
| `src/core/stores/workspaceStore.ts` | store | CRUD (chrome.storage.session) | RESEARCH.md lines 208-248 | research-pattern |

### Core — Messaging (2 files)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/core/messaging/broadcastBus.ts` | utility | event-driven (storage onChanged) | RESEARCH.md lines 285-307 | research-pattern |
| `src/core/messaging/runtimeEnvelope.ts` | utility | event-driven (runtime messaging) | None (greenfield) | n/a |

### Core — Routing (1 file)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/core/routing/workspaceRouter.ts` | utility | request-response (chrome.tabs API) | RESEARCH.md lines 314-335 | research-pattern |

### Core — Commands (2 files)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/core/commands/commandPalette.tsx` | component | event-driven (keyboard events) | RESEARCH.md lines 538-638 | research-pattern |
| `src/core/commands/keymapRegistry.ts` | utility | event-driven (chrome.commands) | None (greenfield) | n/a |

### Core — Onboarding (1 file)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/core/onboarding/OnboardingModal.tsx` | component | request-response (form wizard) | RESEARCH.md lines 641-672 | research-pattern |

### Core — Registries (2 files)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/core/registries/SidePanelPageRegistry.ts` | utility | transform (registration) | None (greenfield) | n/a |
| `src/core/registries/FullAppPageRegistry.ts` | utility | transform (registration) | None (greenfield) | n/a |

### Core — Components (1 file)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/core/components/ErrorBoundary.tsx` | component | request-response (error fallback) | RESEARCH.md lines 489-536 | research-pattern |

### Core — Utils (1 file)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/core/utils/debugLog.ts` | utility | transform (logging) | None (greenfield) | n/a |

### Core — Pages (4 files)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/core/pages/ChatPage.tsx` | component | request-response (skeleton) | None (greenfield) | n/a |
| `src/core/pages/AgentPage.tsx` | component | request-response (skeleton) | None (greenfield) | n/a |
| `src/core/pages/NotesPage.tsx` | component | request-response (skeleton) | None (greenfield) | n/a |
| `src/core/pages/OptionsPage.tsx` | component | request-response (skeleton) | None (greenfield) | n/a |

### Addons (1 file)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/addons/.gitkeep` | placeholder | n/a | None (greenfield) | n/a |

### Public Assets (3 files)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `public/icon-16.png` | asset | n/a | None (greenfield) | n/a |
| `public/icon-48.png` | asset | n/a | None (greenfield) | n/a |
| `public/icon-128.png` | asset | n/a | None (greenfield) | n/a |

### Test Files (9 files)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `tests/setup.ts` | test-infra | n/a | None (greenfield) | n/a |
| `tests/core/themeStore.test.ts` | test | n/a | None (greenfield) | n/a |
| `tests/core/workspaceStore.test.ts` | test | n/a | None (greenfield) | n/a |
| `tests/core/workspaceRouter.test.ts` | test | n/a | None (greenfield) | n/a |
| `tests/core/runtimeEnvelope.test.ts` | test | n/a | None (greenfield) | n/a |
| `tests/core/ErrorBoundary.test.tsx` | test | n/a | None (greenfield) | n/a |
| `tests/core/background.test.ts` | test | n/a | None (greenfield) | n/a |
| `tests/shell/theme.test.tsx` | test | n/a | None (greenfield) | n/a |
| `tests/shell/onboarding.test.tsx` | test | n/a | None (greenfield) | n/a |
| `tests/shell/commandPalette.test.tsx` | test | n/a | None (greenfield) | n/a |

---

## Pattern Assignments

> **Critical note:** This is a greenfield project. No existing source code exists. All patterns below are extracted from `01-RESEARCH.md` code examples, which were verified against official library documentation (WXT v0.20.27, Ant Design v6.5.0, @ant-design/x v2.8.0, Zustand v5.0.14).

---

### `src/core/theme/antdConfig.ts` (utility, pure function — theme config factory)

**Pattern source:** PRODUCT_SPEC §5.5, 01-RESEARCH.md Pattern 2

**Core pattern — centralised theme config consumed by ConfigProvider:**
```typescript
// Source: PRODUCT_SPEC §5.5 — getAntdConfig produces ConfigProvider theme props
import { type ThemeConfig, theme } from 'antd';
import type { ThemeMode } from '../stores/themeStore';

const { defaultAlgorithm, darkAlgorithm, compactAlgorithm } = theme;

export interface AntdConfigOptions {
  mode: ThemeMode;
  compact: boolean;
}

export function getAntdConfig(options: AntdConfigOptions): ThemeConfig {
  const { mode, compact } = options;
  const algorithm = mode === 'dark' ? [darkAlgorithm] : [defaultAlgorithm];
  if (compact) {
    algorithm.push(compactAlgorithm);
  }
  return { algorithm };
}
```

**Rationale:** Centralises theme algorithm logic so both surfaces share the same config. In later phases, `getAntdConfig` can be extended to pass theme tokens to `XProvider` for AntD X subtrees (Chat/Agent) without duplicating algorithm selection.

---

### `src/core/stores/themeStore.ts` (store, CRUD — chrome.storage.sync)

**Pattern source:** RESEARCH.md lines 208-248

**Core pattern — Zustand persist with chrome.storage adapter:**
```typescript
// Source: RESEARCH.md lines 208-248
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'light' | 'dark' | 'auto';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

// Custom storage adapter for chrome.storage
const chromeSyncStorage = {
  getItem: async (name: string) => {
    const result = await chrome.storage.sync.get(name);
    return result[name] ?? null;
  },
  setItem: async (name: string, value: string) => {
    await chrome.storage.sync.set({ [name]: value });
  },
  removeItem: async (name: string) => {
    await chrome.storage.sync.remove(name);
  },
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'auto',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'nowpilot-theme',
      storage: chromeSyncStorage,
    },
  ),
);
```

---

### `src/core/stores/workspaceStore.ts` (store, CRUD — chrome.storage.session)

**Pattern source:** RESEARCH.md lines 208-248 (same Zustand persist pattern, different storage area)

**Key difference from themeStore:**
- Uses `chrome.storage.session` instead of `chrome.storage.sync`
- Storage key: `nowpilot-workspace`
- State shape: `{ workspaceId, conversationId, activeProvider, activeSurface }` (lightweight metadata only)
- **Do NOT store large objects (message bodies, conversation trees) here** — chrome.storage.session has 10MB limit (RESEARCH.md lines 437-442)

```typescript
// Same pattern as themeStore, substituting chrome.storage.session
const chromeSessionStorage = {
  getItem: async (name: string) => {
    const result = await chrome.storage.session.get(name);
    return result[name] ?? null;
  },
  setItem: async (name: string, value: string) => {
    await chrome.storage.session.set({ [name]: value });
  },
  removeItem: async (name: string) => {
    await chrome.storage.session.remove(name);
  },
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaceId: null,
      conversationId: null,
      activeProvider: null,
      activeSurface: 'sidepanel',
      // ... setters
    }),
    {
      name: 'nowpilot-workspace',
      storage: chromeSessionStorage,
    },
  ),
);
```

---

### `src/core/theme/antdConfig.ts` (utility, pure function — theme config factory)

**Pattern source:** PRODUCT_SPEC §5.5, 01-RESEARCH.md Pattern 2

See the antdConfig.ts entry under `src/core/stores/themeStore.ts` section above.

---

### `src/entrypoints/sidepanel/App.tsx`, `src/entrypoints/app/App.tsx`, `src/entrypoints/popup/App.tsx` (component, request-response — React render)

**Pattern source:** PRODUCT_SPEC §5.5, 01-RESEARCH.md Pattern 3

**Imports pattern:**
```typescript
import { ConfigProvider, App } from 'antd';  // AntD ConfigProvider at root
import { getAntdConfig } from '@/core/theme/antdConfig';
import { useThemeStore } from '@/core/stores/themeStore';
```

**Core pattern — ConfigProvider wrapping with antdConfig:**
```typescript
export function SidePanelApp() {
  const mode = useThemeStore((s) => s.mode);
  const antdConfig = getAntdConfig({ mode, compact: true });

  return (
    <ConfigProvider {...antdConfig}>
      <App>
        <SidePanelLayout />
      </App>
    </ConfigProvider>
  );
}
```

**Key rules:**
- Surface root uses `ConfigProvider` — NOT `XProvider` (XProvider is deferred to Phase 7 for Chat/Agent subtrees)
- Side Panel passes `compact: true`; Full App passes `compact: false`
- `App` MUST be nested inside `ConfigProvider` for `useApp()` to work
- Never import `sidepanel/App.tsx` from `app/App.tsx` or vice versa
- NEVER use `message.success()` statically — always use `App.useApp()` hook

---

### `src/entrypoints/background.ts` (background-sw, event-driven)

**Pattern source:** RESEARCH.md lines 342-367, 413-430

**Core pattern — Synchronous listener registration in `main()`:**
```typescript
// Source: RESEARCH.md lines 342-367
export default defineBackground(() => {
  // ✅ CORRECT: Listeners registered synchronously in main()
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
      chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
        .catch(console.error);
    }
  });

  chrome.commands.onCommand.addListener((command) => {
    // Handle keyboard shortcuts
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Message routing
    return true; // Keep channel open for async response
  });
});
```

**CRITICAL rule (RESEARCH.md lines 405-430):**
- `main()` callback MUST NOT be `async`
- All `chrome.*.addListener()` calls MUST happen synchronously at module load
- If a handler needs async data, use `.then()` chains or pre-load with `chrome.storage.*.get()` and cache the result
- NEVER put listener registration inside `setTimeout` or after `await`

```typescript
// ❌ BAD:
export default defineBackground(async () => {
  const config = await chrome.storage.sync.get('config');
  chrome.runtime.onInstalled.addListener(() => { /* MISSED */ });
});

// ✅ GOOD:
export default defineBackground(() => {
  let config: Config | null = null;
  chrome.storage.sync.get('config').then((result) => { config = result.config; });
  chrome.runtime.onInstalled.addListener(() => {
    if (config) { /* ... */ }
  });
});
```

---

### `src/core/messaging/broadcastBus.ts` (utility, event-driven — storage.onChanged)

**Pattern source:** RESEARCH.md lines 285-308

```typescript
type BroadcastHandler = (changes: Record<string, chrome.storage.StorageChange>) => void;

const handlers = new Set<BroadcastHandler>();

export function onBroadcastMessage(handler: BroadcastHandler): () => void {
  handlers.add(handler);
  return () => handlers.delete(handler);
}

export function initBroadcastBus(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'session') {
      for (const handler of handlers) {
        handler(changes);
      }
    }
  });
}
```

---

### `src/core/routing/workspaceRouter.ts` (utility, request-response — chrome.tabs API)

**Pattern source:** RESEARCH.md lines 314-335

```typescript
const FULL_APP_URL = chrome.runtime.getURL('/app.html');

export async function openFullApp(): Promise<void> {
  const existingTabs = await chrome.tabs.query({ url: FULL_APP_URL });

  if (existingTabs.length > 0) {
    const tab = existingTabs[0];
    if (tab.id) {
      await chrome.tabs.update(tab.id, { active: true });
      await chrome.windows.update(tab.windowId, { focused: true });
    }
  } else {
    await chrome.tabs.create({ url: FULL_APP_URL });
  }
}
```

---

### `src/core/components/ErrorBoundary.tsx` (component, request-response — error fallback)

**Pattern source:** RESEARCH.md lines 489-536

```typescript
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Result } from 'antd';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    debugLog('ErrorBoundary caught error', { error: error.message, componentStack: info.componentStack });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="Something went wrong"
          subTitle={this.state.error?.message}
          extra={[
            <Button key="retry" type="primary" onClick={this.handleReset}>Try Again</Button>,
            <Button key="reload" onClick={() => window.location.reload()}>Reload Page</Button>,
          ]}
        />
      );
    }
    return this.props.children;
  }
}
```

**Key rule:** Must be a class component — Error Boundaries cannot be function components in React.

---

### `src/core/commands/commandPalette.tsx` (component, event-driven — keyboard events)

**Pattern source:** RESEARCH.md lines 538-638

```typescript
import { Modal, Input, List } from 'antd';
import { useCallback, useEffect, useState } from 'react';

interface Command {
  id: string;
  label: string;
  action: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

export function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase()),
  );

  const handleSelect = useCallback((cmd: Command) => {
    cmd.action();
    onClose();
    setQuery('');
  }, [onClose]);

  // Reset on open
  useEffect(() => {
    setSelectedIndex(0);
    setQuery('');
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && filtered[selectedIndex]) {
        e.preventDefault();
        handleSelect(filtered[selectedIndex]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, filtered, selectedIndex, handleSelect]);

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      styles={{ body: { padding: 0 } }}
      width={560}
    >
      <Input
        size="large"
        placeholder="Type a command..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
        autoFocus
        bordered={false}
        style={{ padding: '12px 16px' }}
      />
      <List
        dataSource={filtered}
        renderItem={(item, index) => (
          <List.Item
            key={item.id}
            onClick={() => handleSelect(item)}
            style={{
              padding: '8px 16px',
              cursor: 'pointer',
              background: index === selectedIndex ? 'var(--ant-color-bg-text-hover)' : undefined,
            }}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span style={{ color: 'var(--ant-color-text-tertiary)', fontSize: 12 }}>
                {item.shortcut}
              </span>
            )}
          </List.Item>
        )}
      />
    </Modal>
  );
}
```

---

### `src/core/onboarding/OnboardingModal.tsx` (component, request-response — form wizard)

**Pattern source:** RESEARCH.md lines 641-672

```typescript
import { Modal, Steps, Button, Input, Select, message } from 'antd';
import { useState } from 'react';

export function OnboardingModal({ open }: { open: boolean }) {
  const [step, setStep] = useState(0);

  const steps = [
    { title: 'Welcome' },
    { title: 'Provider' },
    { title: 'API Key' },
    { title: 'Done' },
  ];

  return (
    <Modal
      open={open}
      closable={false}
      maskClosable={false}
      footer={null}
      title="Welcome to NowPilot"
    >
      <Steps current={step} items={steps} style={{ marginBottom: 24 }} />
      {/* Step content based on current step */}
    </Modal>
  );
}
```

---

## Shared Patterns (Cross-Cutting)

### Pattern 1: React Mount Point (to copy for all `main.tsx` files)

**Applies to:** `src/entrypoints/sidepanel/main.tsx`, `src/entrypoints/app/main.tsx`, `src/entrypoints/popup/main.tsx`

```
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Pattern 2: HTML Entry Point (to copy for all `.html` files)

**Applies to:** `src/entrypoints/sidepanel.html`, `src/entrypoints/app.html`, `src/entrypoints/popup.html`

Each is a standard WXT unlisted page HTML file. WXT auto-generates the manifest entries. Minimal HTML:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NowPilot</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./main.tsx"></script>
</body>
</html>
```

### Pattern 3: Page Skeleton (to copy for all skeleton pages)

**Applies to:** `src/core/pages/ChatPage.tsx`, `src/core/pages/AgentPage.tsx`, `src/core/pages/NotesPage.tsx`, `src/core/pages/OptionsPage.tsx`

```typescript
import { Card, Typography } from 'antd';

const { Title } = Typography;

interface PageProps {
  title: string;
}

export function ChatPage() {
  return (
    <Card>
      <Title level={3}>Chat</Title>
      <Typography.Text type="secondary">Coming soon</Typography.Text>
    </Card>
  );
}
```

### Pattern 4: Vitest Test Structure

**Applies to:** All test files in `tests/`

Given there is no existing test infrastructure, establish a consistent pattern:

```typescript
// tests/core/themeStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Chrome API mocks (from tests/setup.ts)
// Note: chrome.storage mock must be set up in tests/setup.ts

describe('useThemeStore', () => {
  beforeEach(() => {
    // Reset store state between tests
    vi.clearAllMocks();
  });

  it('defaults to auto mode', () => {
    // ...
  });

  it('persists mode changes', () => {
    // ...
  });
});
```

### Pattern 5: Registry Pattern

**Applies to:** `src/core/registries/SidePanelPageRegistry.ts`, `src/core/registries/FullAppPageRegistry.ts`

```typescript
// Registry pattern for add-on page registration
interface PageDefinition {
  id: string;
  label: string;
  icon?: React.ComponentType;
  component: React.ComponentType;
  order?: number;
}

class PageRegistry {
  private pages = new Map<string, PageDefinition>();

  register(page: PageDefinition): void {
    this.pages.set(page.id, page);
  }

  getAll(): PageDefinition[] {
    return Array.from(this.pages.values())
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
}

export const SidePanelPageRegistry = new PageRegistry();
```

### Pattern 6: debugLog Utility

**Applies to:** `src/core/utils/debugLog.ts`

```typescript
// Structured debug logging (HARD-09)
// All catch blocks must call debugLog — no empty catches
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function debugLog(level: LogLevel, message: string, data?: unknown): void {
  if (__DEV__) {
    const timestamp = new Date().toISOString();
    console[level](`[NowPilot ${timestamp}] ${message}`, data ?? '');
  }
}
```

---

## Anti-Patterns: Do NOT Copy

These patterns are explicitly prohibited and must NOT appear in any file:

| Anti-Pattern | Source | Why Forbidden |
|--------------|--------|---------------|
| `async` `main()` in `defineBackground` | RESEARCH.md lines 371, 413-416 | Listeners must be registered synchronously — async main creates event gaps |
| XProvider at surface root in Phase 1 | PRODUCT_SPEC §5.5, RESEARCH.md line 375 | In v0.1 Phase 1, surface root uses ConfigProvider (via antdConfig.ts). XProvider is only needed around Chat/Agent subtrees in Phase 7+ when AntD X components are used. |
| Nesting `ConfigProvider` + `XProvider` at same level | RESEARCH.md lines 375, 450-453 | XProvider extends ConfigProvider; nesting both at same level causes conflicts — since surface root is ConfigProvider and XProvider wraps subtrees, this is naturally avoided |
| `dangerouslySetInnerHTML` or `innerHTML` | RESEARCH.md lines 373, 801 | HARD-10 — XSS prevention; use AntD Typography instead |
| Static `message.success()` / `Modal.confirm()` | RESEARCH.md lines 374 | Must use `App.useApp()` hook for imperative APIs in AntD v6 |
| CSS class manipulation for theming | RESEARCH.md lines 375 | Use ConfigProvider `theme.algorithm` instead |
| Importing from `@ant-design/x-sdk` or `@ant-design/x-card` | RESEARCH.md lines 376 | Explicitly out of scope per PROJECT.md |
| Core imports from `addons/` | RESEARCH.md lines 376, RESEARCH.md lines 808 | ADDON-10 — enforced by directory structure + ESLint |
| Empty catch blocks | RESEARCH.md lines 806 | HARD-09 — all catches must call debugLog |
| `import { motion } from "framer-motion"` | RESEARCH.md lines 688 | Use `import { motion } from "motion/react"` instead |

---

## No Analog Found

These files have no close match in the codebase (greenfield) and no explicit code pattern in RESEARCH.md. Planner should derive patterns from library docs or the shared patterns above:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/core/messaging/runtimeEnvelope.ts` | utility | event-driven | No explicit code example in RESEARCH.md — cross-context message validation with Zod schemas (RESEARCH.md lines 794) |
| `src/core/commands/keymapRegistry.ts` | utility | event-driven | No explicit code example — chrome.commands API wrapper |
| `src/entrypoints/sidepanel/main.tsx` | mount-point | render | Standard ReactDOM.createRoot — see Shared Pattern 1 |
| `src/entrypoints/app/main.tsx` | mount-point | render | Standard ReactDOM.createRoot — see Shared Pattern 1 |
| `src/entrypoints/popup/main.tsx` | mount-point | render | Standard ReactDOM.createRoot — see Shared Pattern 1 |
| `src/entrypoints/sidepanel.html` | entry-html | n/a | Standard HTML — see Shared Pattern 2 |
| `src/entrypoints/app.html` | entry-html | n/a | Standard HTML — see Shared Pattern 2 |
| `src/entrypoints/popup.html` | entry-html | n/a | Standard HTML — see Shared Pattern 2 |
| `src/core/pages/ChatPage.tsx` | component | skeleton | See Shared Pattern 3 |
| `src/core/pages/AgentPage.tsx` | component | skeleton | See Shared Pattern 3 |
| `src/core/pages/NotesPage.tsx` | component | skeleton | See Shared Pattern 3 |
| `src/core/pages/OptionsPage.tsx` | component | skeleton | See Shared Pattern 3 |
| `src/core/registries/SidePanelPageRegistry.ts` | utility | registration | See Shared Pattern 5 |
| `src/core/registries/FullAppPageRegistry.ts` | utility | registration | See Shared Pattern 5 |
| `src/core/utils/debugLog.ts` | utility | logging | See Shared Pattern 6 |
| All 9 test files | test | n/a | See Shared Pattern 4 + VALIDATION.md per-task verification map |
| `package.json` | config | n/a | Use `pnpm init` + add deps from RESEARCH.md lines 66-68 |
| `wxt.config.ts` | config | n/a | WXT init generates — use WXT v0.20.27 defaults |
| `tsconfig.json` | config | n/a | TypeScript strict mode — standard React+Vite config |
| `vitest.config.ts` | config | n/a | Vitest with jsdom environment |
| ESLint config | config | n/a | Standard TypeScript ESLint + WXT preset if available |
| Prettier config | config | n/a | Standard Prettier config |
| `src/addons/.gitkeep` | placeholder | n/a | Empty file |
| `public/icon-*.png` | asset | n/a | Placeholder icon images |

---

## Metadata

**Analog search scope:** Entire workspace (no `src/` — greenfield)
**Files scanned:** 0 source files (project has zero source files)
**Pattern extraction date:** 2026-07-10
**Pattern source:** `01-RESEARCH.md` code examples + official WXT/AntD/Zustand/chrome.* API documentation

**Greenfield strategy:** All patterns derived from RESEARCH.md (which itself was verified against official library docs and npm registry). The RESEARCH.md code examples serve as the de facto "analogs" for a project that has no prior implementation. Planner should use the code excerpts above as templates, adapting variable names and types to the specific file context.
