# Phase 02: Storage & Security Foundation - Pattern Map

**Mapped:** 2026-07-29
**Files analyzed:** 14 (11 new, 3 modified)
**Analogs found:** 11 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/storage/chromeStorageAdapter.ts` | adapter | request-response | `src/core/theme/chromeStorageAdapter.ts` (itself, relocated) | exact |
| `src/core/storage/sessionStorageAdapter.ts` | adapter | request-response | `src/core/theme/chromeStorageAdapter.ts` | exact-role |
| `src/core/storage/CryptoService.ts` | service | transform (crypto) | `src/core/runtime/BroadcastBus.ts` (singleton module) | partial (singleton module pattern, not class) |
| `src/core/storage/WriteJournal.ts` | service | event-driven (journal + replay) | `src/core/runtime/BroadcastBus.ts` (pub/sub + async) | partial (module-scoped singleton, async operations) |
| `src/core/storage/MigrationRunner.ts` | service | batch (idb upgrade) | RESEARCH.md §Pattern 1 (idb openDB) | spec-guided (no codebase analog) |
| `src/core/storage/ApiKeyStore.ts` | store | CRUD (Zustand + persist) | `src/core/theme/ThemeStore.ts` | exact |
| `src/core/storage/SessionStore.ts` | store | CRUD (Zustand + persist) | `src/core/theme/ThemeStore.ts` | exact |
| `src/core/storage/MessageStore.ts` | store | CRUD (Zustand + persist) | `src/core/theme/ThemeStore.ts` | exact |
| `src/core/storage/NotesStore.ts` | store | CRUD (Zustand + persist, skeleton) | `src/core/theme/ThemeStore.ts` | exact |
| `src/core/storage/DiagnosticsStore.ts` | store | CRUD (Zustand + persist, skeleton) | `src/core/theme/ThemeStore.ts` | exact |
| `src/core/security/redactSensitive.ts` | utility | transform (string redaction) | `src/core/log/debugLog.ts` (standalone utility module) | partial |
| `src/core/theme/ThemeStore.ts` **(modified)** | store | CRUD (import path change) | itself (`src/core/theme/ThemeStore.ts`) | exact |
| `src/core/theme/chromeStorageAdapter.ts` **(removed)** | — | — | — | relocated |
| `src/core/workspace/WorkspaceStore.ts` **(modified)** | store | CRUD (add storage adapter) | `src/core/theme/ThemeStore.ts` (persist + adapter pattern) | exact-role |

## Pattern Assignments

---

### `src/core/storage/chromeStorageAdapter.ts` (adapter, request-response)

**Analog:** `src/core/theme/chromeStorageAdapter.ts` (lines 1-29) — this is the file being relocated. The existing pattern is to be copied verbatim, with no changes to the implementation.

**Imports pattern** (line 1):
```typescript
import type { StateStorage } from 'zustand/middleware';
```

**Core pattern** (lines 3-29): Full adapter implementing the `StateStorage` interface with `chrome.storage.local` and a `localStorage` fallback. Feature-flag the Chrome API availability at module scope.

```typescript
const hasChromeStorage = typeof chrome !== 'undefined' && Boolean(chrome?.storage?.local);

export const chromeStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (hasChromeStorage) {
      const result = await chrome.storage.local.get(name);
      return (result[name] as string | undefined) ?? null;
    }
    return localStorage.getItem(name);
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (hasChromeStorage) {
      await chrome.storage.local.set({ [name]: value });
    } else {
      localStorage.setItem(name, value);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    if (hasChromeStorage) {
      await chrome.storage.local.remove(name);
    } else {
      localStorage.removeItem(name);
    }
  },
};
```

**Relocation plan:** Move the file from `src/core/theme/chromeStorageAdapter.ts` to `src/core/storage/chromeStorageAdapter.ts`. No code changes needed. The file exports a single named export `chromeStorageAdapter`.

---

### `src/core/storage/sessionStorageAdapter.ts` (adapter, request-response)

**Analog:** `src/core/theme/chromeStorageAdapter.ts` (lines 1-29) — exact role match. Same `StateStorage` interface, swap `chrome.storage.local` for `chrome.storage.session`.

**Imports pattern** (line 1):
```typescript
import type { StateStorage } from 'zustand/middleware';
```

**Core pattern:** Copy the `chromeStorageAdapter` structure verbatim, replacing `chrome.storage.local` → `chrome.storage.session` and `localStorage` → `sessionStorage`.

```typescript
const hasSessionStorage = typeof chrome !== 'undefined' && Boolean(chrome?.storage?.session);

export const sessionStorageAdapter: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (hasSessionStorage) {
      const result = await chrome.storage.session.get(name);
      return (result[name] as string | undefined) ?? null;
    }
    return sessionStorage.getItem(name);
  },

  setItem: async (name: string, value: string): Promise<void> => {
    if (hasSessionStorage) {
      await chrome.storage.session.set({ [name]: value });
    } else {
      sessionStorage.setItem(name, value);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    if (hasSessionStorage) {
      await chrome.storage.session.remove(name);
    } else {
      sessionStorage.removeItem(name);
    }
  },
};
```

**Error handling:** Same as chromeStorageAdapter — no explicit error handling; errors propagate to the caller (Zustand persist middleware handles storage failures).

---

### `src/core/storage/CryptoService.ts` (service, transform)

**Analog:** No direct codebase analog. Two partial patterns combine:
- **Module structure:** `src/core/runtime/BroadcastBus.ts` (lines 1-48) — module-scoped singleton with exported functions, not a class.
- **Implementation reference:** RESEARCH.md §Pattern 3 (lines 549-639) — full AES-GCM encrypt/decrypt with PBKDF2 key derivation.

**Service class pattern** (from RESEARCH.md, lines 555-639):
```typescript
export class CryptoService {
  private readonly INSTALL_SECRET_KEY = 'np_install_secret';
  private readonly SESSION_CACHE_PREFIX = 'np_derived_key_';

  async getInstallSecret(): Promise<Uint8Array> { /* ... */ }
  async deriveKey(salt: Uint8Array): Promise<CryptoKey> { /* ... */ }
  async encrypt(plaintext: string): Promise<{ ciphertext: ArrayBuffer; salt: Uint8Array; iv: Uint8Array }> { /* ... */ }
  async decrypt(ciphertext: ArrayBuffer, salt: Uint8Array, iv: Uint8Array): Promise<string> { /* ... */ }

  private bytesToBase64(bytes: Uint8Array): string { /* ... */ }
  private base64ToBytes(base64: string): Uint8Array { /* ... */ }
}
```

**Error handling pattern:** Use standard try/catch in async methods. Wrap `crypto.subtle` errors with descriptive messages.
```typescript
// Decryption failure example
try {
  const decrypted = await crypto.subtle.decrypt(/* ... */);
  return new TextDecoder().decode(decrypted);
} catch (err) {
  throw new Error(`Decryption failed: ${err instanceof Error ? err.message : 'unknown error'}`);
}
```

**Binary data encoding for chrome.storage.local:** Chrome storage only supports JSON-serializable values. Always base64-encode `ArrayBuffer`/`Uint8Array` before storing. Use the helper methods from RESEARCH.md lines 623-638.

**No analog note:** This is a standalone class/service. There are no existing service classes in `src/core/` — BroadcastBus uses module-scoped functions, not a class. The CryptoService class pattern is the first of its kind in the codebase and establishes the pattern for WriteJournal and MigrationRunner.

---

### `src/core/storage/WriteJournal.ts` (service, event-driven)

**Analog:** `src/core/runtime/BroadcastBus.ts` (lines 1-48) — module-scoped singleton with async operations. Also BroadcastBus for its `publish()` integration after committed writes.

**No exact analog.** WriteJournal is a new service type (IndexedDB-backed journal with startup replay). Partial pattern from BroadcastBus:

**Module singleton pattern** (from BroadcastBus.ts, lines 1-30):
```typescript
// Module-scoped state (maps, caches) initialized at import time
const channels = new Map<string, BroadcastChannelEntry>();

export function getBroadcastChannel(name: string): BroadcastChannelEntry {
  if (!channels.has(name)) { /* create */ }
  return channels.get(name)!;
}
```

WriteJournal should follow the same pattern: module-scoped `IDBPDatabase` reference, exported async functions (`createEntry`, `commitEntry`, `replayJournal`), not a class.

**WriteJournal entry types** (from RESEARCH.md §WriteJournalEntry Schema, lines 646-677):
```typescript
export type WriteJournalOperation =
  | 'update-workspace'
  | 'append-memory-message'
  | 'evict-conversation'
  | 'archive-conversation'
  | 'compact-conversation'
  | 'save-note-with-links'
  | 'update-user-memory'
  | 'export-data';

export type WriteJournalStatus = 'pending' | 'applying' | 'completed' | 'failed' | 'rolled-back';

export interface WriteJournalEntry {
  id: string;
  operation: WriteJournalOperation;
  status: WriteJournalStatus;
  createdAt: number;
  updatedAt: number;
  attempts: number;
  targetIds: Record<string, string>;
  steps: Array<{
    name: string;
    status: 'pending' | 'completed' | 'failed';
    error?: string;
  }>;
}
```

**Startup replay algorithm** (from RESEARCH.md §Pattern 4, lines 340-371):
```typescript
async function replayJournal(): Promise<void> {
  const db = await openDB('WriteJournalDB', 1);
  const allEntries = await db.getAll('entries');
  const pending = allEntries.filter(
    (e) => !['completed', 'failed', 'rolled-back'].includes(e.status)
  );
  for (const entry of pending) {
    entry.status = 'applying';
    entry.attempts++;
    entry.updatedAt = Date.now();
    await db.put('entries', entry);
    try {
      for (const step of entry.steps) {
        if (step.status !== 'completed') {
          await executeStep(step);
          step.status = 'completed';
        }
      }
      entry.status = 'completed';
    } catch (err) {
      entry.status = 'failed';
      const failedStep = entry.steps.find((s) => s.status !== 'completed');
      if (failedStep) failedStep.error = String(err);
    }
    entry.updatedAt = Date.now();
    await db.put('entries', entry);
  }
}
```

**BroadcastBus integration** (from BroadcastBus.ts, line 45-48, and ThemeStore.ts, lines 35-37):
```typescript
import { publish } from '../runtime/BroadcastBus';

// After committing a workspace update in the journal:
publish('np_workspace', { type: 'WORKSPACE_UPDATED', /* ... */ });
```

---

### `src/core/storage/MigrationRunner.ts` (service, batch)

**Analog:** No codebase analog. Pattern from RESEARCH.md §Pattern 1 (idb openDB with versioned upgrade callbacks, lines 224-251) and §MigrationRunner Example (lines 683-721).

**Core idb upgrade pattern** (from RESEARCH.md lines 224-251):
```typescript
import { openDB, type IDBPDatabase, type IDBPTransaction } from 'idb';

const db = await openDB('WriteJournalDB', 4, {
  upgrade(db, oldVersion, newVersion, transaction) {
    if (oldVersion < 1) {
      db.createObjectStore('entries', { keyPath: 'id' });
    }
    if (oldVersion < 2) {
      const entries = transaction.objectStore('entries');
      entries.createIndex('by-status', 'status');
    }
    if (oldVersion < 3) {
      db.createObjectStore('auditLog', { keyPath: 'id', autoIncrement: true });
    }
    if (oldVersion < 4) {
      // Data migration step
      const oldStore = transaction.objectStore('entries');
      const items = await oldStore.getAll();
      // transform and write...
    }
  },
  blocked() {
    // Another connection is holding the old version open
    console.warn('WriteJournalDB upgrade blocked');
  },
  blocking() {
    // This connection is blocking a newer version
    db.close();
  },
});
```

**Class-based orchestrator pattern** (from RESEARCH.md lines 683-721):
```typescript
export class MigrationRunner {
  async migrate(dbName: string, targetVersion: number): Promise<void> {
    const db = await openDB(dbName, targetVersion, {
      upgrade(db, oldVersion, newVersion, transaction) {
        if (oldVersion < 1) this.createV1Schema(db);
        if (oldVersion < 2) this.createV2Indexes(transaction);
        if (oldVersion < 3) this.createV3Stores(db);
        if (oldVersion < 4) this.migrateV4(transaction);
      },
      blocked() { db.close(); },
      blocking() { db.close(); },
    });
  }
}
```

**Idempotency check pattern:** Before creating any store or index, check if it already exists (handles re-run of the same migration version):
```typescript
if (!db.objectStoreNames.contains('entries')) {
  db.createObjectStore('entries', { keyPath: 'id' });
}
if (!store.indexNames.contains('by-status')) {
  store.createIndex('by-status', 'status');
}
```

---

### `src/core/storage/ApiKeyStore.ts` (store, CRUD)

**Analog:** `src/core/theme/ThemeStore.ts` (lines 1-64) — exact role match. Full Zustand store with `persist` + `immer` + custom storage adapter.

**Imports pattern** (ThemeStore.ts, lines 1-6):
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { chromeStorageAdapter } from './chromeStorageAdapter';
```

**Store structure pattern** (ThemeStore.ts, lines 18-63):
```typescript
interface ApiKeyState {
  // ... state fields ...
}

interface ApiKeyActions {
  // ... action methods ...
}

type ApiKeyStore = ApiKeyState & ApiKeyActions;

export const useApiKeyStore = create<ApiKeyStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      // Action methods using set((state) => { state.x = y; })
    })),
    {
      name: 'np_api_keys',                           // persist key in chrome.storage.local
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({
        // Only persist serializable data
        keys: state.keys,
      }),
    },
  ),
);
```

**Encryption integration:** Unlike ThemeStore, ApiKeyStore delegates to `CryptoService` for all key write/read operations:
```typescript
import { CryptoService } from './CryptoService';

const crypto = new CryptoService();

setKey: async (providerId: string, plaintextKey: string) => {
  const { ciphertext, salt, iv } = await crypto.encrypt(plaintextKey);
  set((state) => {
    state.keys[providerId] = {
      ciphertext: bufferToBase64(ciphertext),
      salt: bufferToBase64(salt),
      iv: bufferToBase64(iv),
    };
  });
},
```

**Singleton pattern:** Module-level `create()` call (line 18 of ThemeStore.ts). Not created per-component. The store is a singleton importable anywhere in `src/core/`.

---

### `src/core/storage/SessionStore.ts` (store, CRUD)

**Analog:** `src/core/theme/ThemeStore.ts` (lines 1-64) — exact role match. Same Zustand pattern, but:

- **Storage adapter:** Use `sessionStorageAdapter` instead of `chromeStorageAdapter`
- **Persist key:** `'np_session'` in `chrome.storage.session`
- **No encryption layer** (session tokens are already opaque tokens, not raw secrets)

**Key difference from ApiKeyStore:**
```typescript
import { sessionStorageAdapter } from './sessionStorageAdapter';

// In persist config:
{
  name: 'np_session',
  storage: createJSONStorage(() => sessionStorageAdapter),
  partialize: (state) => ({ tokens: state.tokens }),
}
```

All other store mechanics (immer set/get pattern, module-level singleton, action method structure) are identical to ThemeStore.

---

### `src/core/storage/MessageStore.ts` (store, CRUD)

**Analog:** `src/core/theme/ThemeStore.ts` (lines 1-64) — exact role match for store structure. However, MessageStore persists to IndexedDB (not chrome.storage), so the persist config differs.

**Store skeleton pattern** — same Zustand + immer structure, but:
```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export const useMessageStore = create<MessageState>()(
  immer((set, get) => ({
    // ... state and actions ...
    // No persist middleware — IndexedDB operations are manual
  })),
);
```

**IndexedDB integration:** Message bodies are too large for `chrome.storage.local` (10MB limit). Unlike ThemeStore/ApiKeyStore/SessionStore, this store does NOT use the persist middleware. Instead, it manually reads/writes to IndexedDB via `idb`.

---

### `src/core/storage/NotesStore.ts` (store, CRUD, skeleton)

**Analog:** `src/core/theme/ThemeStore.ts` (lines 1-64) — same Zustand + immer skeleton for Phase 5. 

**Skeleton pattern:** Minimal implementation with placeholder state and a `ready: boolean` flag set to `false`. This is a Phase 2 delivery that Phase 5 fills in.
```typescript
export const useNotesStore = create<NotesState>()(
  immer((set, get) => ({
    ready: false, // Phase 5 will set this to true after init
    notes: [],
  })),
);
```

No persist middleware. No IndexedDB in Phase 2. Just the type contract and empty store for Phase 5 to hydrate.

---

### `src/core/storage/DiagnosticsStore.ts` (store, CRUD, skeleton)

**Analog:** `src/core/theme/ThemeStore.ts` (lines 1-64) — same Zustand + immer skeleton for Phase 6.

Same skeleton pattern as NotesStore:
```typescript
export const useDiagnosticsStore = create<DiagnosticsState>()(
  immer((set, get) => ({
    ready: false, // Phase 6 will set this to true after init
    logs: [],
  })),
);
```

---

### `src/core/security/redactSensitive.ts` (utility, transform)

**Analog:** `src/core/log/debugLog.ts` — standalone utility module exporting pure functions. Also partial analog from `src/core/runtime/BroadcastBus.ts` for module structure.

**No exact analog** for the redaction logic itself, but the module structure follows the established pattern:

**Module structure pattern** (from debugLog.ts and other utility modules):
```typescript
// Pure function export — no class, no state
export function redactSensitive(input: string): string {
  // Redaction logic
}

// Regex-based patterns
const API_KEY_PATTERN = /(?:sk|api[_-]?key)[=:]\s*([a-zA-Z0-9_-]{20,})/gi;
const BEARER_PATTERN = /bearer\s+([a-zA-Z0-9._-]+)/gi;
const JWT_PATTERN = /eyJ[a-zA-Z0-9._-]{20,}/g;

export function redactSensitive(input: string): string {
  return input
    .replace(API_KEY_PATTERN, '$1=***REDACTED***')
    .replace(BEARER_PATTERN, 'Bearer ***REDACTED***')
    .replace(JWT_PATTERN, '***REDACTED_JWT***');
}
```

**Test pattern** (from existing tests, e.g., OperationId.test.ts, lines 1-22):
```typescript
import { describe, it, expect } from 'vitest';
import { redactSensitive } from '../../../src/core/security/redactSensitive';

describe('redactSensitive', () => {
  it('redacts API keys in URLs', () => {
    const result = redactSensitive('https://api.example.com?key=sk-abc123def456');
    expect(result).not.toContain('sk-abc123def456');
    expect(result).toContain('REDACTED');
  });

  it('preserves non-sensitive content', () => {
    const input = 'Hello world, this is a normal message';
    expect(redactSensitive(input)).toBe(input);
  });
});
```

---

### `src/core/theme/ThemeStore.ts` **(modified)** (store, CRUD)

**Analog:** `src/core/theme/ThemeStore.ts` itself — lines 1-64. Only change is the import path.

**Change required** (line 4):
```typescript
// FROM:
import { chromeStorageAdapter } from './chromeStorageAdapter';

// TO:
import { chromeStorageAdapter } from '../storage/chromeStorageAdapter';
```

No other changes needed. The rest of the file (lines 1-3, 5-63) remains unchanged.

---

### `src/core/theme/chromeStorageAdapter.ts` **(removed)**

**Action:** Delete the file from `src/core/theme/`. Its contents are relocated to `src/core/storage/chromeStorageAdapter.ts` unchanged.

---

### `src/core/workspace/WorkspaceStore.ts` **(modified)** (store, CRUD)

**Analog:** `src/core/theme/ThemeStore.ts` (lines 1-64) — exact role match for adding the storage adapter to the existing persist configuration.

**Change required** — add import and storage option to persist config:

**Imports to add** (from ThemeStore.ts, lines 2, 4):
```typescript
import { persist, createJSONStorage } from 'zustand/middleware';  // upgrade from just 'persist'
import { chromeStorageAdapter } from '../storage/chromeStorageAdapter';
```

**Current line 2 of WorkspaceStore.ts:**
```typescript
import { persist } from 'zustand/middleware';
```

**Change to:**
```typescript
import { persist, createJSONStorage } from 'zustand/middleware';
```

**Current persist config** (WorkspaceStore.ts, lines 108-119):
```typescript
{
  name: 'np_workspace_store',
  partialize: (state) => ({
    workspaceId: state.workspaceId,
    conversationId: state.conversationId,
    activeProvider: state.activeProvider,
    selectedModel: state.selectedModel,
    pinnedTabs: state.pinnedTabs,
    activeSurface: state.activeSurface,
    openedFullAppTabId: state.openedFullAppTabId,
    version: state.version,
  }),
},
```

**Change to:**
```typescript
{
  name: 'np_workspace_store',
  storage: createJSONStorage(() => chromeStorageAdapter),
  partialize: (state) => ({
    workspaceId: state.workspaceId,
    conversationId: state.conversationId,
    activeProvider: state.activeProvider,
    selectedModel: state.selectedModel,
    pinnedTabs: state.pinnedTabs,
    activeSurface: state.activeSurface,
    openedFullAppTabId: state.openedFullAppTabId,
    version: state.version,
  }),
},
```

The rest of the file (lines 1, 3-107, 120-121) remains unchanged.

---

## Shared Patterns

### Zustand Store with Persist Middleware
**Source:** `src/core/theme/ThemeStore.ts` (lines 18-63)
**Apply to:** ApiKeyStore, SessionStore, MessageStore, NotesStore, DiagnosticsStore
```typescript
// Pattern contract:
export const useXxxStore = create<XxxStore>()(
  persist(
    immer((set, get) => ({
      // state + actions using set((state) => { state.x = y; })
    })),
    {
      name: 'np_xxx_store',
      storage: createJSONStorage(() => storageAdapter),
      partialize: (state) => ({ /* only serializable fields */ }),
    },
  ),
);
```

### Module-Scoped Singleton
**Source:** `src/core/runtime/BroadcastBus.ts` (lines 1-48)
**Apply to:** CryptoService, WriteJournal, MigrationRunner
```typescript
// Services are module-level singletons — no per-component instantiation.
// Either export a class and instantiate at module scope, or use module-scoped state + exported functions.
const instance = new CryptoService();
export { instance as cryptoService };
```

### Test File Structure
**Source:** `tests/core/theme/ThemeStore.test.ts` (lines 1-100) and `tests/core/runtime/OperationId.test.ts` (lines 1-22)
**Apply to:** All new test files
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { /* SUT */ } from '../../../src/core/storage/Xxx';

describe('Xxx', () => {
  beforeEach(() => {
    // Reset state: use __chromeStorageMap.clear() for storage tests
    // Or store.getState().reset() for Zustand stores
    const map = (globalThis as any).__chromeStorageMap;
    if (map) map.clear();
    vi.clearAllMocks();
  });

  it('behavior description', () => {
    // Arrange → Act → Assert
  });
});
```

### Test Setup Enhancement
**Source:** `tests/setup.ts` (lines 1-152)
**Apply to:** `tests/setup.ts` (modified in this phase)

**Additions required** (from RESEARCH.md §Test Infrastructure Enhancements lines 492-517):
1. Register `fake-indexeddb/auto` at the top of `tests/setup.ts`:
   ```typescript
   import 'fake-indexeddb/auto';
   ```
2. Add `chrome.storage.session` mock mirroring the `.local` mock pattern (lines 46-100):
   ```typescript
   const sessionStorage = new Map<string, string>();
   const chromeStorageSession = {
     get: vi.fn(/* same pattern as chromeStorageLocal.get, lines 49-73 */),
     set: vi.fn(/* same pattern as chromeStorageLocal.set, lines 74-79 */),
     remove: vi.fn(/* same pattern as chromeStorageLocal.remove, lines 80-86 */),
     clear: vi.fn(/* same pattern as chromeStorageLocal.clear, lines 87-90 */),
   };
   (globalThis as any).chrome.storage.session = chromeStorageSession;
   ```

### CSP Configuration
**Source:** `wxt.config.ts` (lines 53-55)
**Apply to:** No changes in Phase 2. The existing CSP is adequate. Phase 3 will need to revise `connect-src`.

### Chrome API Feature Detection
**Source:** `src/core/theme/chromeStorageAdapter.ts` (line 3)
**Apply to:** sessionStorageAdapter, any code that calls Chrome APIs
```typescript
const hasChromeStorage = typeof chrome !== 'undefined' && Boolean(chrome?.storage?.local);
```

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/core/storage/CryptoService.ts` | service | transform (crypto) | No existing service classes in codebase; RESEARCH.md §Pattern 3 provides full implementation |
| `src/core/storage/WriteJournal.ts` | service | event-driven (journal + replay) | No existing journal/recovery pattern; RESEARCH.md §Pattern 4 + §WriteJournalEntry Schema provide the spec |
| `src/core/storage/MigrationRunner.ts` | service | batch (idb upgrade) | No existing idb migration code; RESEARCH.md §Pattern 1 provides the idb openDB+upgrade pattern |

For all three, the RESEARCH.md provides complete, concrete code examples. These files establish new patterns that future phases will copy from.

## Metadata

**Analog search scope:** `src/core/theme/`, `src/core/workspace/`, `src/core/runtime/`, `src/core/log/`, `tests/`, `wxt.config.ts`
**Files scanned:** 10 (5 source, 5 tests/config)
**Pattern extraction date:** 2026-07-29
