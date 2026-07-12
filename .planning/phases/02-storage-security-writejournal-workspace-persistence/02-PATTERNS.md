# Phase 02: Storage, Security, WriteJournal, Workspace Persistence - Pattern Map

**Mapped:** 2026-07-12
**Files analyzed:** 22 new/modified files
**Analogs found:** 22 / 22

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/storage/IndexedDBManager.ts` | utility | CRUD | `src/core/registries/SidepanelPageRegistry.ts` | role-match (class + singleton) |
| `src/core/storage/IndexedDBMigrator.ts` | service | batch | `src/core/commands/keymapRegistry.ts` | role-match (class + register + singleton) |
| `src/core/storage/migrations/v1-initial-schema.ts` | config | N/A | `src/core/navigation/navConfig.ts` | role-match (exported config data) |
| `src/core/storage/EncryptedStorage.ts` | service | CRUD | `src/core/registries/SidepanelPageRegistry.ts` | role-match (class + singleton) |
| `src/core/storage/WriteJournal.ts` | service | event-driven/CRUD | `src/core/registries/SidepanelPageRegistry.ts` | role-match (class + singleton + debugLog) |
| `src/core/storage/WriteJournalEntry.ts` | model | N/A | `src/core/messaging/runtimeEnvelope.ts` | exact (types + zod schema) |
| `src/core/storage/stores/ChatHistoryDB.ts` | service | CRUD | `src/core/registries/SidepanelPageRegistry.ts` | role-match (class + singleton) |
| `src/core/storage/stores/NotesDB.ts` | service | CRUD | `src/core/registries/SidepanelPageRegistry.ts` | role-match (class + singleton) |
| `src/core/storage/stores/MemoryDB.ts` | service | CRUD | `src/core/registries/SidepanelPageRegistry.ts` | role-match (class + singleton) |
| `src/core/storage/stores/ErrorStore.ts` | service | CRUD | `src/core/registries/SidepanelPageRegistry.ts` | role-match (class + singleton) |
| `src/core/storage/stores/AITransactionLogDB.ts` | service | CRUD | `src/core/registries/SidepanelPageRegistry.ts` | role-match (class + singleton) |
| `src/core/utils/RateLimiter.ts` | utility | N/A | `src/core/utils/debugLog.ts` | role-match (standalone utility) |
| `src/core/stores/workspaceStore.ts` (MODIFIED) | store | CRUD | `src/core/stores/themeStore.ts` | exact (Zustand persist) |
| `src/core/stores/providerStore.ts` (MODIFIED) | store | CRUD | `src/core/stores/themeStore.ts` | exact (Zustand persist) |
| `src/core/messaging/broadcastBus.ts` (MODIFIED) | middleware | event-driven | `src/core/messaging/broadcastBus.ts` | exact (self) |
| `tests/core/storage/IndexedDBMigrator.test.ts` | test | N/A | `tests/core/keymapRegistry.test.ts` | exact (class-based test) |
| `tests/core/storage/EncryptedStorage.test.ts` | test | N/A | `tests/core/themeStore.test.ts` | role-match (store/infra test) |
| `tests/core/storage/WriteJournal.test.ts` | test | N/A | `tests/core/keymapRegistry.test.ts` | exact (class-based test) |
| `tests/core/storage/RateLimiter.test.ts` | test | N/A | `tests/core/debugLog.test.ts` | role-match (utility test) |
| `tests/core/storage/workspaceStore.test.ts` (MODIFIED) | test | N/A | `tests/core/workspaceStore.test.ts` | exact (self) |
| `tests/core/storage/broadcastBus.test.ts` (MODIFIED) | test | N/A | `tests/core/broadcastBus.test.ts` | exact (self) |
| `tests/setup.ts` (MODIFIED) | test config | N/A | `tests/setup.ts` | exact (self) |

## Pattern Assignments

### 1. `src/core/storage/IndexedDBManager.ts` (utility, CRUD)

**Analog:** `src/core/registries/SidepanelPageRegistry.ts`

**Class + singleton export pattern** (lines 11-35):

```typescript
import type { ComponentType } from 'react';

export interface PageDefinition {
  id: string;
  label: string;
  icon?: ComponentType;
  component: ComponentType;
  order?: number;
}

export class SidepanelPageRegistry {
  private pages = new Map<string, PageDefinition>();

  register(page: PageDefinition): void {
    if (this.pages.has(page.id)) {
      throw new Error(`Page "${page.id}" is already registered`);
    }
    this.pages.set(page.id, page);
  }

  unregister(id: string): void {
    this.pages.delete(id);
  }

  getAll(): PageDefinition[] {
    return Array.from(this.pages.values()).sort((a, b) => {
      if (a.order == null && b.order == null) return 0;
      if (a.order == null) return 1;
      if (b.order == null) return -1;
      return a.order - b.order;
    });
  }
}

export const sidepanelPageRegistry = new SidepanelPageRegistry();
```

**Key patterns to apply to IndexedDBManager:**
- `export class` with private state (`private pages = new Map<...>()`) → `private db: IDBPDatabase<NowPilotDB> | null = null`
- `export const singletonName = new ClassName()` — singleton export at bottom of file
- The class manages a long-lived connection (like `pages` map), lazy-initialized on first access
- No external framework imports — pure class + Map, equivalent to idb's `IDBPDatabase` handle

**IndexedDB-specific patterns** (from RESEARCH.md — verified /jakearchibald/idb Context7 docs):

```typescript
// Canonical idb v8 open pattern with DBSchema type parameter
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

let dbInstance: IDBPDatabase<NowPilotDB> | null = null;

export async function getDB(): Promise<IDBPDatabase<NowPilotDB>> {
  if (dbInstance) return dbInstance;
  dbInstance = await openDB<NowPilotDB>('nowpilot', DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) { /* ... */ },
    blocked() { debugLog('warn', 'IndexedDB: open blocked by older connection'); },
    blocking() { dbInstance?.close(); dbInstance = null; },
    terminated() { dbInstance = null; debugLog('error', 'IndexedDB: connection terminated unexpectedly'); },
  });
  return dbInstance;
}
```

---

### 2. `src/core/storage/IndexedDBMigrator.ts` (service, batch)

**Analog:** `src/core/commands/keymapRegistry.ts` — class with register/unregister/get + debugLog + singleton export

**Register/unregister pattern** (lines 1-44):

```typescript
import { debugLog } from '../utils/debugLog';

export type CommandHandler = () => void | Promise<void>;

export interface CommandDefinition {
  id: string;
  label: string;
  handler: CommandHandler;
  shortcut?: string;
}

export class KeymapRegistry {
  private commands = new Map<string, CommandDefinition>();

  register(command: CommandDefinition): void {
    if (this.commands.has(command.id)) {
      throw new Error(`Command "${command.id}" is already registered`);
    }
    this.commands.set(command.id, command);
  }

  unregister(id: string): void {
    this.commands.delete(id);
  }

  getCommand(id: string): CommandDefinition | undefined {
    return this.commands.get(id);
  }

  getAllCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  handleCommand(id: string): void {
    const command = this.commands.get(id);
    if (command) {
      command.handler();
    } else {
      debugLog('warn', 'Unknown command', { id });
    }
  }
}

export const keymapRegistry = new KeymapRegistry();
```

**Key patterns to apply to IndexedDBMigrator:**
- `import { debugLog }` as first import — all Phase 2 modules must use `debugLog` (HARD-09)
- `export interface` for the registration type (migration descriptor) before the class
- `private items = new Map<string, T>()` for the internal registry
- `register(item): void` with duplicate-id check throwing `Error`
- `export const singletonName = new ClassName()` — singleton export at file end
- `debugLog('warn', ...)` for non-exceptional failure cases

---

### 3. `src/core/storage/migrations/v1-initial-schema.ts` (config)

**Analog:** `src/core/navigation/navConfig.ts` — exports static configuration data

Pattern: This file exports a migration configuration object (or an array of IndexedDBMigration objects) with no runtime logic. It is purely declarative.

---

### 4. `src/core/storage/EncryptedStorage.ts` (service, CRUD)

**Analogs (multiple cross-referenced):**

- **Class + singleton:** `src/core/registries/SidepanelPageRegistry.ts` (lines 11-35) — see pattern in §1
- **Chrome storage adapter (getItem/setItem/removeItem):** `src/core/stores/workspaceStore.ts` (lines 18-23)

```typescript
const chromeSessionStorage = createJSONStorage<WorkspaceState>(() => ({
  getItem: (name: string) =>
    chrome.storage.session.get(name).then((result: Record<string, unknown>) => (result[name] as string) ?? null),
  setItem: (name: string, value: string) => chrome.storage.session.set({ [name]: value }),
  removeItem: (name: string) => chrome.storage.session.remove(name),
}));
```

**Key patterns to apply:**
- Class with private `initialized` flag (`private initialized = false`, lazy init via `ensureInitialized()`)
- Matches the `{ getItem, setItem, removeItem }` shape for drop-in replacement of `createJSONStorage`
- `chrome.storage.local.get(name)` to read, `chrome.storage.local.set({ [name]: value })` to write
- `chrome.storage.local.remove(name)` to delete

---

### 5. `src/core/storage/WriteJournal.ts` (service, event-driven/CRUD)

**Analog:** `src/core/registries/SidepanelPageRegistry.ts` — class + singleton + private Map

**Error handling + debugLog pattern:** `src/core/commands/keymapRegistry.ts` (lines 34-41)

```typescript
handleCommand(id: string): void {
  const command = this.commands.get(id);
  if (command) {
    command.handler();
  } else {
    debugLog('warn', 'Unknown command', { id });
  }
}
```

**Key patterns to apply:**
- Import `debugLog` for all error/warning paths
- Private state maps for tracking pending journal entries
- Async methods returning `Promise<void>` with try/catch blocks
- Exception-safe: failures log via `debugLog('error', ...)` and return structured results, never throw to callers

---

### 6. `src/core/storage/WriteJournalEntry.ts` (model, zod schema + TypeScript types)

**Analog:** `src/core/messaging/runtimeEnvelope.ts` (lines 1-27) — exact match: define TypeScript interface, then zod schema, then validation function

```typescript
import { z } from 'zod';
import { debugLog } from '../utils/debugLog';

export type MessageSource = 'background' | 'sidepanel' | 'standalone' | 'popup';

export interface Envelope<T = unknown> {
  type: string;
  source: MessageSource;
  payload: T;
  timestamp?: number;
}

const envelopeSchema = z.object({
  type: z.string(),
  source: z.enum(['background', 'sidepanel', 'standalone', 'popup']),
  payload: z.unknown(),
  timestamp: z.number().optional(),
});

export function validateEnvelope<T>(message: unknown): Envelope<T> {
  const result = envelopeSchema.safeParse(message);
  if (!result.success) {
    debugLog('warn', 'Invalid message envelope', { errors: result.error.flatten() });
    throw new Error('Invalid message envelope');
  }
  return result.data as Envelope<T>;
}
```

**Key patterns to apply to WriteJournalEntry:**
- `export type` / `export interface` for the type shape
- `z.object({...})` for the runtime schema
- `z.enum([...])` for status values (`'pending' | 'applying' | 'completed' | 'failed' | 'rolled-back'`)
- `export function validate*(data: unknown): Type` with `safeParse` + debugLog on failure
- `debugLog` for validation warnings without throwing for non-critical cases

---

### 7-11. Domain DB Stores: `ChatHistoryDB.ts`, `NotesDB.ts`, `MemoryDB.ts`, `ErrorStore.ts`, `AITransactionLogDB.ts`

**Analog:** `src/core/registries/SidepanelPageRegistry.ts` — class + singleton export

All five domain stores follow the same class + singleton pattern. Each store:
- Wraps idb object store operations (get, put, delete, getAll, getByIndex)
- Exports a class with domain-specific methods (`addMessage`, `getSession`, etc.)
- Exports a singleton instance at the bottom of the file
- Uses `debugLog` for error reporting via try/catch blocks

**Template pattern (from SidepanelPageRegistry, lines 11-35):**

```typescript
export class NotesDB {
  // private state goes here (no idb DB handle — use IndexedDBManager.getDB() instead)

  async createNote(note: Note): Promise<void> {
    // Use idb transaction for CRUD
  }

  async getNotes(): Promise<Note[]> {
    // Read operations
  }
}

export const notesDB = new NotesDB();
```

---

### 12. `src/core/utils/RateLimiter.ts` (utility, token bucket)

**Analog:** `src/core/utils/debugLog.ts` — standalone utility, no class dependencies, pure function + types

```typescript
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function debugLog(level: LogLevel, message: string, data?: unknown): void {
  if (typeof __DEV__ === 'undefined' || __DEV__) {
    const timestamp = new Date().toISOString();
    const prefix = `[NowPilot ${timestamp}] ${message}`;
    switch (level) {
      case 'debug':
        console.debug(prefix, data ?? '');
        break;
      case 'info':
        console.info(prefix, data ?? '');
        break;
      case 'warn':
        console.warn(prefix, data ?? '');
        break;
      case 'error':
        console.error(prefix, data ?? '');
        break;
    }
  }
}
```

**Key patterns to apply to RateLimiter:**
- `export type` for config interface (`RateLimiterConfig`) and return type (`RateLimitResult`)
- `export class RateLimiter` with `constructor(config)` taking a config object
- Pure computation — no external dependencies, no `debugLog` needed (not a source of errors)
- In-memory state only (per D-23): `private tokens`, `private lastRefill`

---

### 13. `src/core/stores/workspaceStore.ts` (MODIFIED — store, CRUD)

**Analog:** Current `src/core/stores/workspaceStore.ts` + `src/core/stores/themeStore.ts`

**Current pattern to change — chrome.storage.session → chrome.storage.local** (lines 18-42):

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Surface } from '../navigation/navigationTypes';

// CHANGE: Replace chromeSessionStorage with chromeLocalStorage
const chromeSessionStorage = createJSONStorage<WorkspaceState>(() => ({
  getItem: (name: string) =>
    chrome.storage.session.get(name).then((result: Record<string, unknown>) => (result[name] as string) ?? null),
  setItem: (name: string, value: string) => chrome.storage.session.set({ [name]: value }),
  removeItem: (name: string) => chrome.storage.session.remove(name),
}));
// NEW: chrome.storage.local adapter
const chromeLocalStorage = createJSONStorage<WorkspaceState>(() => ({
  getItem: (name: string) =>
    chrome.storage.local.get(name).then((result: Record<string, unknown>) => (result[name] as string) ?? null),
  setItem: (name: string, value: string) => chrome.storage.local.set({ [name]: value }),
  removeItem: (name: string) => chrome.storage.local.remove(name),
}));

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      workspaceId: null,
      conversationId: null,
      activeProvider: null,
      activeSurface: 'sidepanel',
      setWorkspaceId: (workspaceId: string) => set({ workspaceId }),
      setConversationId: (conversationId: string) => set({ conversationId }),
      setActiveProvider: (activeProvider: string) => set({ activeProvider }),
      setActiveSurface: (activeSurface: Surface) => set({ activeSurface }),
    }),
    {
      name: 'nowpilot-workspace', // CHANGE to 'np_workspace' per D-15
      storage: chromeLocalStorage, // CHANGE: was chromeSessionStorage
    },
  ),
);
```

**Modifications summary:**
- Change storage adapter from `chrome.storage.session` to `chrome.storage.local`
- Change key from `'nowpilot-workspace'` to `'np_workspace'`
- Extend `WorkspaceState` with future-facing fields: `pinnedTabs`, `currentPageContext`, `selectedNotes`, `activeAddonContext`, `activeSkillRun`
- Route mutable writes through WriteJournal (`update-workspace` operation type)

---

### 14. `src/core/stores/providerStore.ts` (MODIFIED — store, CRUD)

**Analog:** `src/core/stores/themeStore.ts` — Zustand persist with custom `createJSONStorage`

**Current state (lines 1-28):** In-memory-only store (no persistence). Must become a persist store with EncryptedStorage.

**Target pattern from themeStore.ts (lines 1-29):**

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const chromeSyncStorage = createJSONStorage<ThemeState>(() => ({
  getItem: (name: string) =>
    chrome.storage.sync.get(name).then((result: Record<string, unknown>) => (result[name] as string) ?? null),
  setItem: (name: string, value: string) => chrome.storage.sync.set({ [name]: value }),
  removeItem: (name: string) => chrome.storage.sync.remove(name),
}));

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'auto',
      setMode: (mode: ThemeMode) => set({ mode }),
    }),
    {
      name: 'nowpilot-theme',
      storage: chromeSyncStorage,
    },
  ),
);
```

**Modifications summary:**
- Wrap `create()` with `persist(...)` middleware
- Create a `createJSONStorage` adapter using `EncryptedStorage` (not raw `chrome.storage.local`)
- Move `apiKeys` from in-memory to EncryptedStorage persistence
- Key: `'np_providers'`

---

### 15. `src/core/messaging/broadcastBus.ts` (MODIFIED — middleware, event-driven)

**Analog:** Self — add `'local'` area listener alongside existing `'session'` listener

**Current pattern (lines 1-23):**

```typescript
import { debugLog } from '../utils/debugLog';

export type BroadcastHandler = (changes: Record<string, chrome.storage.StorageChange>) => void;

const handlers = new Set<BroadcastHandler>();

export function onBroadcastMessage(handler: BroadcastHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function initBroadcastBus(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'session') {
      debugLog('debug', 'BroadcastBus: session storage changed', { changes });
      for (const handler of handlers) {
        handler(changes);
      }
    }
  });
}
```

**Modifications summary:**
- Add `areaName === 'local'` check alongside existing `'session'` check
- When `areaName === 'local'` and changes contain `np_workspace`, emit `WORKSPACE_UPDATED` event
- Keep subscription pattern (`onBroadcastMessage` returns unsubscribe function)
- Keep `debugLog` calls for each area trigger

---

### 16-21. Test Files

**Analog patterns (all use vitest + jsdom + setup.ts mocks):**

**Class-based test pattern — `tests/core/keymapRegistry.test.ts` (lines 1-63):**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeymapRegistry } from '../../src/core/commands/keymapRegistry';

describe('KeymapRegistry', () => {
  let registry: KeymapRegistry;

  beforeEach(() => {
    registry = new KeymapRegistry();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('register adds a command with id, label, and handler', () => {
    const handler = vi.fn();
    registry.register({ id: 'test', label: 'Test Command', handler });
    expect(registry.getCommand('test')).toBeDefined();
  });

  it('register with duplicate id throws an error', () => {
    registry.register({ id: 'dup', label: 'First', handler: vi.fn() });
    expect(() => {
      registry.register({ id: 'dup', label: 'Second', handler: vi.fn() });
    }).toThrow('dup');
  });

  it('getCommand returns the registered command or undefined', () => {
    expect(registry.getCommand('nonexistent')).toBeUndefined();
    // ...
  });

  it('getAllCommands returns all commands in registration order', () => {
    // ...
  });

  it('unregisterCommand removes the command', () => {
    // ...
  });

  it('handleCommand invokes the handler', () => {
    // ...
  });
});
```

**Key test patterns for all new test files:**
- `import { describe, it, expect, vi, beforeEach } from 'vitest'`
- `let instance: ClassName` with `beforeEach(() => { instance = new ClassName(); })`
- Import path: `../../src/core/storage/ClassName` (relative from `tests/core/storage/`)
- `vi.fn()` for mock handlers, `vi.spyOn(console, ...)` to suppress debugLog output
- `expect().toThrow()` for error cases (matching error message substring)
- All `chrome.*` APIs are auto-mocked via `tests/setup.ts` (global `chrome` stub)

**Store test pattern — `tests/core/workspaceStore.test.ts` (lines 1-51):**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkspaceStore } from '../../src/core/stores/workspaceStore';

describe('WorkspaceStore', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      workspaceId: null,
      conversationId: null,
      activeProvider: null,
      activeSurface: 'sidepanel',
    });
    vi.clearAllMocks();
  });

  it('default state has all nullable fields as null and activeSurface as sidepanel', () => {
    const state = useWorkspaceStore.getState();
    expect(state.workspaceId).toBeNull();
    expect(state.conversationId).toBeNull();
    expect(state.activeProvider).toBeNull();
    expect(state.activeSurface).toBe('sidepanel');
  });

  it('setActiveProvider persists to chrome.storage.session', () => {
    useWorkspaceStore.getState().setActiveProvider('openai');
    expect(useWorkspaceStore.getState().activeProvider).toBe('openai');
    expect(chrome.storage.session.set).toHaveBeenCalled();
  });
});
```

**Key store test patterns:**
- Reset state in `beforeEach` using `store.setState({ ...defaults })`
- Test default state first
- Test write operations: `getState().setXxx(...)` then `expect(getState().xxx).toBe(...)`
- Verify persistence: `expect(chrome.storage.local.set).toHaveBeenCalled()` (for modified workspaceStore) or `expect(chrome.storage.session.set)` (for existing tests)
- `vi.clearAllMocks()` in beforeEach

---

### 22. `tests/setup.ts` (MODIFIED — test config)

**Analog:** Self — extend existing `chrome` stub

**Current pattern (lines 26-69):**

```typescript
vi.stubGlobal('chrome', {
  storage: {
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    session: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
  // ... rest of chrome API stubs
});
```

**Modifications summary:**
- Add `storage.local` entry: `{ get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined), remove: vi.fn().mockResolvedValue(undefined), getBytesInUse: vi.fn().mockResolvedValue(0) }`
- Add `crypto.subtle` polyfill/mock for EncryptedStorage tests: `{ encrypt: vi.fn(), decrypt: vi.fn(), deriveKey: vi.fn(), importKey: vi.fn(), generateKey: vi.fn() }` (only if native `crypto.subtle` is unavailable in jsdom — test with a Wave 0 smoke test per RESEARCH.md Open Question 3)
- Add `crypto.getRandomValues` polyfill if not available: `(arr: Uint8Array) => crypto.getRandomValues ? crypto.getRandomValues(arr) : arr`

---

## Shared Patterns

### Debug Logging (HARD-09)
**Source:** `src/core/utils/debugLog.ts`
**Apply to:** ALL new and modified source files (not test files)

```typescript
import { debugLog } from '../utils/debugLog';
// Usage:
debugLog('warn', 'Descriptive message', { contextKey: value });
debugLog('error', 'Operation failed', { error: err });
```

All catch blocks must call `debugLog`. All non-fatal operational issues use `debugLog('warn', ...)` instead of throwing.

### Class + Singleton Export
**Source:** `src/core/registries/SidepanelPageRegistry.ts` (lines 35)
**Apply to:** IndexedDBManager, IndexedDBMigrator, EncryptedStorage, WriteJournal, ChatHistoryDB, NotesDB, MemoryDB, ErrorStore, AITransactionLogDB

```typescript
export class ClassName {
  // private state
  // public methods
}

export const className = new ClassName();
```

### Zustand Persist with createJSONStorage
**Source:** `src/core/stores/themeStore.ts` (lines 1-29)
**Apply to:** workspaceStore (modified), providerStore (modified)

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const customStorage = createJSONStorage<StateType>(() => ({
  getItem: (name: string) => chrome.storage.local.get(name).then(...),
  setItem: (name: string, value: string) => chrome.storage.local.set({ [name]: value }),
  removeItem: (name: string) => chrome.storage.local.remove(name),
}));

export const useStore = create<StateType>()(
  persist(
    (set) => ({ /* default state + setters */ }),
    { name: 'np_key', storage: customStorage },
  ),
);
```

### Zod Schema + TypeScript Type Pairing
**Source:** `src/core/messaging/runtimeEnvelope.ts` (lines 1-27)
**Apply to:** WriteJournalEntry, EncryptedPayload types, migration descriptors

```typescript
import { z } from 'zod';

export interface MyType { field: string; }
const mySchema = z.object({ field: z.string() });
export function validateMyType(data: unknown): MyType { /* safeParse + throw */ }
```

### Vitest Test Structure
**Source:** `tests/core/keymapRegistry.test.ts` + `tests/core/workspaceStore.test.ts`
**Apply to:** ALL test files

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Relative import from tests/core/storage/ to src/core/storage/
import { ClassName } from '../../src/core/storage/ClassName';

describe('ClassName', () => {
  beforeEach(() => { /* reset state */ vi.clearAllMocks(); });
  it('should ...', () => { /* arrange, act, assert */ });
});
```

### `np_` Key Prefix Convention
**Source:** `src/core/stores/workspaceStore.ts` (key: `'nowpilot-workspace'`, migrating to `'np_workspace'`) and `src/core/stores/themeStore.ts` (key: `'nowpilot-theme'`)
**Apply to:** All chrome.storage keys in new code

New keys for Phase 2: `'np_workspace'`, `'np_install_secret'`, `'np_providers'`.

### Direct Path Imports (No Barrel Files)
**Source:** Entire codebase — all imports use relative paths directly to the module file
**Apply to:** ALL new files

```typescript
// Correct:
import { debugLog } from '../utils/debugLog';
import { IndexedDBManager } from '../storage/IndexedDBManager';
// NOT:
import { debugLog, IndexedDBManager } from '../utils'; // No barrel files
```

---

## No Analog Found

All 22 files have adequate analogs in the existing codebase. No file lacks a pattern match.

## Metadata

**Analog search scope:** `src/core/` (all subdirectories), `tests/core/`, `tests/setup.ts`
**Files scanned:** 15 source files + 15 test files + setup.ts = 31 files examined
**Pattern extraction date:** 2026-07-12
