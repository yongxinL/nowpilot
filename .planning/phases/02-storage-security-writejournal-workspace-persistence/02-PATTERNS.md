# Phase 2: Storage, Security, WriteJournal, Workspace Persistence - Pattern Map

**Mapped:** 2026-08-23
**Files analyzed:** 30 (12 Create + 1 new workspace module + 2 new type/test-infra files + 6 modified + 9 test files)
**Analogs found:** 24 / 30 (6 no-analog → use RESEARCH.md spec excerpts)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/storage/Setting.ts` | utility | serialized request-response | `src/core/log/debugLog.ts` | partial (module shape) |
| `src/core/storage/EncryptedStorage.ts` | service | transform (crypto) | `src/services/aiProvider.ts` | role-match (async svc + structured errors) |
| `src/core/storage/WriteJournal.ts` | service | event-driven (journaling) | spec Appendix O.11 (no repo analog) | no-analog (spec reference) |
| `src/core/storage/IndexedDBMigrator.ts` | config/framework | batch/transform (migrations) | `src/core/registry/Registry.ts` | role-match (Map registry pattern) |
| `src/core/storage/ChatHistoryDB.ts` | model | CRUD (IndexedDB) | RESEARCH idb openDB example | no-analog (idb reference) |
| `src/core/storage/MemoryDB.ts` | model | CRUD (IndexedDB) | RESEARCH idb openDB example | no-analog (idb reference) |
| `src/core/storage/NotesDB.ts` | model | CRUD (IndexedDB) | RESEARCH idb openDB example | no-analog (idb reference) |
| `src/core/storage/WriteJournalDB.ts` | model | CRUD (IndexedDB) | RESEARCH idb example (lines 516-542) | no-analog (idb reference) |
| `src/core/storage/ErrorStore.ts` | model + error sink | event-driven (append FIFO-100) | `src/core/log/debugLog.ts` | **exact** (persistent sibling) |
| `src/core/security/KeyVault.ts` | service | transform (crypto) | `src/services/aiProvider.ts` | role-match |
| `src/core/security/redactSensitive.ts` | utility | transform | `src/core/log/debugLog.ts` | partial (module shape) |
| `src/core/utils/RateLimiter.ts` | utility | request-response (token bucket) | — (no class-based util in repo) | no-analog (RESEARCH reference) |
| `src/core/http/Requester.ts` | service | request-response (fetch wrapper) | `src/services/aiProvider.ts` | role-match (fetch + error codes) |
| `src/core/workspace/WorkspaceElection.ts` | service/state machine | event-driven (CAS + heartbeat) | `chromeStorageAdapter.ts` (timer seam) + `WorkspaceSync.ts` (msg union) + `BroadcastBus.ts` | composite |
| `src/core/workspace/WorkspaceSync.ts` (modify) | service | pub-sub | itself | exact |
| `src/core/workspace/WorkspaceStore.ts` (modify) | store | CRUD | itself | exact |
| `src/core/theme/chromeStorageAdapter.ts` (modify) | adapter | request-response | itself | exact |
| `src/store/useExtensionStore.ts` (modify) | store | CRUD | itself | exact |
| `wxt.config.ts` (modify) | config | — | itself | exact |
| `tests/setup.ts` (modify) | test infra | — | itself | exact |
| `src/types/storage.ts` (new, implied) | types | — | `src/types/index.ts` | role-match (type barrel) |
| `tests/core/storage/WriteJournal.test.ts` | test | — | `tests/core/storage/chromeStorageAdapter.test.ts` | role-match |
| `tests/core/storage/EncryptedStorage.test.ts` | test | — | `tests/core/storage/chromeStorageAdapter.test.ts` | role-match |
| `tests/core/storage/IndexedDBMigrator.test.ts` | test | — | `tests/core/storage/chromeStorageAdapter.test.ts` | role-match |
| `tests/core/utils/RateLimiter.test.ts` | test | — | `tests/core/storage/chromeStorageAdapter.test.ts` | role-match |
| `tests/core/workspace/WorkspacePersistence.test.ts` | test | — | `tests/core/workspace/WorkspaceStore.test.ts` | role-match |
| `tests/core/workspace/WorkspaceElection.test.ts` (implied) | test | — | WorkspaceStore.test.ts + chromeStorageAdapter.test.ts (fake timers) | composite |
| `tests/core/security/KeyVault.test.ts` (implied) | test | — | chromeStorageAdapter.test.ts conventions | role-match |
| `tests/core/storage/ErrorStore.test.ts` (implied) | test | — | chromeStorageAdapter.test.ts conventions | role-match |
| `tests/core/storage/chromeStorageAdapter.test.ts` (modify) | test | — | itself | exact |

---

## Pattern Assignments

### `src/core/storage/WriteJournal.ts` (service, event-driven)

**Analog:** None in repo — spec Appendix O.11 is the authoritative reference (quoted verbatim in 02-RESEARCH.md lines 262-303). Copy the O.11 shape exactly.

**WriteJournalOperation union** (from spec §20.3, quoted in RESEARCH.md lines 305-319):
```typescript
type WriteJournalOperation =
  | 'append-memory-message'
  | 'evict-conversation'
  | 'archive-conversation'
  | 'compact-conversation'
  | 'save-note-with-links'
  | 'update-user-memory'
  | 'export-data'
  | 'update-workspace'
  | 'sync-note-file'
  | 'delete-note-file'
  | 'restore-notes-batch';
```

**JournalStep + runJournaled + recoverJournal** (O.11 verbatim, RESEARCH.md lines 262-303):
```typescript
export interface JournalStep {
  name: string;
  apply(): Promise<void>;      // MUST be idempotent (safe to run twice on replay)
  rollback(): Promise<void>;
}

export async function runJournaled(
  entry: WriteJournalEntry,
  steps: JournalStep[],
  persist: (e: WriteJournalEntry) => Promise<void>,
): Promise<void> {
  entry.status = 'applying'; entry.attempts++; await persist(entry);
  const done: JournalStep[] = [];
  try {
    for (const s of steps) {
      await s.apply();
      entry.steps.push({ name: s.name, status: 'completed' });
      done.push(s);
      await persist(entry);
    }
    entry.status = 'completed'; await persist(entry);
  } catch (e: any) {
    debugLog('WRITE_JOURNAL_FAILED', 'rolling back', { id: entry.id, step: done.at(-1)?.name });
    for (const s of done.reverse()) {
      try { await s.rollback(); } catch (r: any) { debugLog('WRITE_JOURNAL_ROLLBACK_FAILED', r?.message ?? 'rollback', { id: entry.id }); }
    }
    entry.status = 'rolled-back'; await persist(entry);
    throw e;
  }
}

export async function recoverJournal(
  load: () => Promise<WriteJournalEntry[]>,
  replay: (e: WriteJournalEntry) => Promise<void>,
): Promise<void> {
  for (const e of await load()) {
    if (e.status === 'applying' || e.status === 'pending') await replay(e);
  }
}
```

**Error handling pattern** — `debugLog` from `src/core/log/debugLog.ts` lines 11-27 (WRITE_JOURNAL_FAILED / WRITE_JOURNAL_ROLLBACK_FAILED are spec-internal codes, NOT added to the canonical registry):
```typescript
debugLog('WRITE_JOURNAL_FAILED', 'rolling back', { id: entry.id, step: done.at(-1)?.name });
```

**Imports pattern** (repo convention — relative imports within `src/core/`, `@/` alias from tests):
```typescript
import { debugLog } from '../log/debugLog';
import type { WriteJournalEntry } from '@/types/storage';   // new type home (A4)
```

**`update-workspace` ordering** (spec §20.3 verbatim, RESEARCH.md lines 321-328): create entry `pending` → write `chrome.storage.local.np_workspace` (spec §8.4 / Appendix M.1 canonical key) → emit `WORKSPACE_UPDATED` → mark completed.

**Workspace key migration rule (Phase 2):**
If legacy np_workspace_store exists and np_workspace does not, perform a one-time migration during hydrate:
1. Read np_workspace_store
2. Write the same payload to np_workspace
3. Verify write succeeds
4. Delete np_workspace_store

After migration, np_workspace is the sole source of truth. All new code, WriteJournal operations, tests, recovery logic, verification commands, and future phases MUST target np_workspace only.

---

### `src/core/storage/ErrorStore.ts` (model + error sink, event-driven)

**Analog:** `src/core/log/debugLog.ts` (35 lines) — the in-memory FIFO-200 log that ErrorStore is the persistent/typed IDB sibling of (CONTEXT line 119).

**Imports pattern** (`src/core/log/debugLog.ts` lines 1-9 — module shape + entry type):
```typescript
interface LogEntry {
  code: string;
  message: string;
  context?: Record<string, unknown>;
  timestamp: number;
}

const MAX_LOG_ENTRIES = 200;
const logEntries: LogEntry[] = [];
```

**Core FIFO-append pattern** (debugLog.ts lines 11-27 — ErrorStore mirrors this with IDB + `autoIncrement` key + cursor delete of oldest beyond 100):
```typescript
export function debugLog(code: string, message: string, context?: Record<string, unknown>): void {
  const entry: LogEntry = { code, message, context, timestamp: Date.now() };
  logEntries.push(entry);
  if (logEntries.length > MAX_LOG_ENTRIES) {
    logEntries.shift();
  }
}
```

**ErrorStore write** (RESEARCH.md lines 593-610 — idb FIFO-100 + redaction at write boundary):
```typescript
import { redactSensitive } from '../security/redactSensitive';
export interface NowPilotErrorRecord { code: string; message: string; context?: Record<string, unknown>; timestamp: number }

export async function recordError(err: { code: string; message: string; context?: Record<string, unknown> }): Promise<void> {
  const tx = (await openErrorStore()).transaction('errors', 'readwrite');
  const store = tx.objectStore('errors');
  await store.add({ ...err, context: redactSensitive(err.context), timestamp: Date.now() }); // autoIncrement key
  const count = await store.count();
  if (count > 100) {
    const cursor = await store.openCursor(); // oldest first (autoIncrement)
    if (cursor) await cursor.delete();
  }
  await tx.done; // never swallow into user UI — debug-only store
}
```

**Best-effort failure semantics** (RESEARCH Open Question 4): `record` wraps IDB write in internal try/catch → `debugLog` fallback; NEVER rethrows into the zustand persist path.

---

### `src/core/storage/EncryptedStorage.ts` + `src/core/security/KeyVault.ts` (service, transform/crypto)

**Analog:** `src/services/aiProvider.ts` for async-service module shape (typed params interfaces, discriminated-union results, never-log-secrets discipline). No crypto analog in repo — the AES-GCM/PBKDF2 scheme is locked by spec §15.2 and quoted in RESEARCH.md lines 487-513:

**Crypto core** (RESEARCH.md lines 488-513 — copy verbatim, parameters per spec §15.2):
```typescript
// Encrypt: 12-byte IV (MDN canonical), AES-GCM-256, authenticated.
async function encryptAesGcm(key: CryptoKey, plaintext: Uint8Array, iv: Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
}
async function decryptAesGcm(key: CryptoKey, ciphertext: ArrayBuffer, iv: Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext); // rejects on tamper
}
// Derive the per-key AES-256 key: PBKDF2(installSecret + extensionId, salt, 100000, SHA-256)
async function deriveKey(installSecret: Uint8Array, extensionId: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = new TextEncoder().encode(
    new TextDecoder().decode(installSecret) + extensionId, // installSecret + extensionId per §15.2
  );
  const baseKey = await crypto.subtle.importKey('raw', material, { name: 'PBKDF2' }, false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}
```

**KeyVault lifecycle** (D-29): `installSecret` = `crypto.getRandomValues(new Uint8Array(32))` generated once → persisted as `np_install_secret` in `chrome.storage.local`. Per-key: fresh 16-byte salt + 12-byte IV. **Stable inputs only** — `chrome.runtime.id` for extensionId, NEVER `navigator.userAgent` (spec §15.2). No rotation/recovery/export (one-way, D-29).

**Error handling:** catch paths reuse existing canonical codes (`STORAGE_READ_FAILED` etc.) — no invented codes (D-38). `redactSensitive` before any log/ErrorStore context.

---

### `src/core/storage/IndexedDBMigrator.ts` (config/framework, batch/transform)

**Analog:** `src/core/registry/Registry.ts` (Map-based registry: register/unregister/get/getAll) and `src/core/commands/CommandRegistry.ts` lines 9-29 for the Map-registry shape.

**Registry pattern** (CommandRegistry.ts lines 9-29 — the migration-registry analog):
```typescript
const commands = new Map<string, Command>();

export const CommandRegistry = {
  register(cmd: Command): void {
    if (commands.has(cmd.id)) {
      throw new Error(`Command already registered: ${cmd.id}`);
    }
    commands.set(cmd.id, cmd);
  },
  get(id: string): Command | undefined { return commands.get(id); },
  getAll(): Command[] { return Array.from(commands.values()); },
};
```

**IndexedDBMigration interface** (spec §20.4 verbatim, RESEARCH.md lines 355-363):
```typescript
export interface IndexedDBMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate(db: IDBPDatabase, tx: IDBPTransaction): Promise<void>;
}
```

**idb openDB mechanics** (RESEARCH.md lines 516-542 — conditional `if (oldVersion < N)` blocks, `blocked()` → `IDB_BLOCKED`, migration failure → `IDB_MIGRATION_FAILED` → ErrorStore + degraded mode):
```typescript
export async function openWriteJournalDB(): Promise<IDBPDatabase<WriteJournalDBV1>> {
  return openDB<WriteJournalDBV1>(WRITE_JOURNAL_DB, WRITE_JOURNAL_DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('entries', { keyPath: 'id' });
      }
      // Future: if (oldVersion < 2) { ... } — the forward-migration contract (D-41)
    },
    blocked() {
      void ErrorStore.record({ code: 'IDB_BLOCKED', message: 'WriteJournalDB upgrade blocked by open connection', timestamp: Date.now() });
    },
  });
}
```

**Anti-pattern to enforce (Pitfall 3):** never await non-IDB work (fetch/crypto) inside a transaction — derive keys/read network BEFORE `db.transaction(...)`; `await tx.done` as the commit signal.

---

### `src/core/storage/{ChatHistoryDB,MemoryDB,NotesDB,WriteJournalDB}.ts` (model, CRUD)

**Analog:** None in repo (no IDB ships before Phase 2 — verified `src/core/` listing). Use RESEARCH.md lines 516-542 openDB example as the template for ALL five DBs. Bootstrap at `DB_VERSION = 1` with §15.1 store lists (D-41/D-42):

- `ChatHistoryDB`: stores `sessions` (`keyPath 'id'`), `messages`
- `MemoryDB`: `messages` with keyPath `[conversationId, seq]` (spec-explicit), `userFacts`, `conversationSummaries`
- `NotesDB`: `notes` (`keyPath 'id'`), `concepts` (`keyPath 'slug'`)
- `WriteJournalDB`: `entries` (`keyPath 'id'`, value `WriteJournalEntry`)
- v1→v2 fixture (D-42) uses a fixture DB name + in-test migration pair — production DBs stay at v1

Each file exports: `DB_NAME` const, `DB_VERSION = 1` const, typed `DBSchema` interface, `open*DB()` async function. idb patterns: `import { openDB, type DBSchema, type IDBPDatabase } from 'idb'`.

---

### `src/core/security/redactSensitive.ts` (utility, transform)

**Analog:** none (TraceRedactor is Phase 11 — not yet in repo; verified `src/core/log/` has only `debugLog.ts`). Module shape follows `src/core/log/debugLog.ts` (small, typed, exported functions). Contract per D-39/§16.5: called at persist boundaries and before ErrorStore writes. Signature suggestion (planner's call): `redactSensitive(context?: Record<string, unknown>): Record<string, unknown>` — strips known secret keys (`apiKey`, `openAiKey`, `geminiKey`, tokens) and message-body-shaped values. Success criterion 3 is the acceptance bar.

---

### `src/core/utils/RateLimiter.ts` (utility, request-response)

**Analog:** none in repo (no class-based util exists). RESEARCH.md lines 565-572 is the authoritative shape (spec §13 per-instance):

```typescript
export interface RateLimiterOptions { capacity: number; refillPerSecond: number }
export class RateLimiter {
  constructor(private opts: RateLimiterOptions) { /* tokens = capacity; refill via elapsed-time math */ }
  acquire(): boolean { /* token available → consume, true; else false (caller maps to RATE_LIMITED) */ }
}
```

Per-instance by design — never shared (§13). No timers needed (elapsed-time math; keep it testable with injected `Date.now` if needed). Strict-clean (Pitfall 9): no `@ts-expect-error` markers.

---

### `src/core/http/Requester.ts` (service, request-response)

**Analog:** `src/services/aiProvider.ts` — fetch + AbortSignal threading + structured error classification.

**Imports pattern** (aiProvider.ts line 1 — type-only import from `../types`):
```typescript
import { Message, ProviderConfig, Attachment, CustomProviderId, CustomModelItem } from '../types';
```

**Core fetch + error-classification pattern** (aiProvider.ts lines 344-382 + RESEARCH.md lines 573-591 — Requester wraps this with AbortController + timeout + injected RateLimiter):
```typescript
export interface RequesterOptions { timeoutMs?: number; rateLimiter?: RateLimiter }
export async function request(url: string, init: RequestInit, opts: RequesterOptions = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 25_000);
  try {
    if (opts.rateLimiter && !opts.rateLimiter.acquire()) {
      throw Object.assign(new Error('rate limited'), { code: 'RATE_LIMITED' });
    }
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw Object.assign(new Error('timeout'), { code: 'TIMEOUT' });
    throw Object.assign(e instanceof Error ? e : new Error(String(e)), { code: 'NETWORK' });
  } finally {
    clearTimeout(timeout);
  }
}
```

**AbortError discrimination** (aiProvider.ts lines 449-455 — the `DOMException` AbortError check pattern):
```typescript
} catch (err: unknown) {
  if (err instanceof DOMException && err.name === 'AbortError') {
    return;
  }
  console.error('AI Stream Error:', err);
  onError(err instanceof Error ? err : new Error(String(err)));
}
```

Codes `TIMEOUT` / `NETWORK` / `RATE_LIMITED` are all existing canonical §21.6 codes (D-38: no new codes).

---

### `src/core/workspace/WorkspaceElection.ts` (NEW — service/state machine, event-driven)

**Analog:** composite — `chromeStorageAdapter.ts` for the timer + `__test__` seam, `WorkspaceSync.ts` for the message-union style, `BroadcastBus.ts` for channel plumbing.

**State union** (spec §20.11 verbatim, RESEARCH.md lines 226-233):
```typescript
export type WorkspaceCoordinationState =
  | { state: 'solo'; primarySurface: ActiveSurface }
  | { state: 'primary'; surface: ActiveSurface; secondaries: ActiveSurface[] }
  | { state: 'secondary'; primarySurface: ActiveSurface; isMirroring: boolean }
  | { state: 'election-in-progress'; startedAt: number }
  | { state: 'error'; code: 'ELECTION_TIMEOUT' | 'STORAGE_UNAVAILABLE'; message: string };
```

**Timer + test-seam pattern** (chromeStorageAdapter.ts lines 33-42 + 231-247 — the ONLY 3 s tick, D-26; mirror the `timerFactory`/`timerClear` seam so tests use `vi.useFakeTimers()`):
```typescript
/** Test seam: lets unit tests inject the timer used by the debounce. */
let timerFactory: (cb: () => void, ms: number) => ReturnType<typeof setTimeout> =
  (cb, ms) => setTimeout(cb, ms);

/** Test seam: lets unit tests cancel the timer used by the debounce. */
let timerClear: (handle: ReturnType<typeof setTimeout>) => void =
  (handle) => clearTimeout(handle);

export const __test__ = {
  setTimerFactory(factory: typeof timerFactory): void { timerFactory = factory; },
  setTimerClear(clear: typeof timerClear): void { timerClear = clear; },
  resetPendingState(): void { /* ... */ },
};
```

**Heartbeat publish** (WorkspaceSync.ts lines 18-24 + BroadcastBus.ts lines 55-62 — heartbeat rides the `np_workspace` channel):
```typescript
export function notifyWorkspaceUpdate(workspaceId: string, conversationId: string | null): void {
  publish<WorkspaceSyncMessage>(WORKSPACE_CHANNEL, {
    type: 'WORKSPACE_UPDATED',
    workspaceId,
    conversationId,
  });
}
```

**Lone-surface trap (Pitfall 4):** BroadcastBus suppresses self-messages (BroadcastBus.ts line 27: `if (event.data && ... (event.data as any)._sender === INSTANCE_ID) { return; }`). A single surface never sees its own heartbeat → "no heartbeat received for 2 intervals AND `np_workspace_primary.electedAt` is mine/fresh" ⇒ solo/primary; only stale session record or foreign heartbeat ⇒ re-election.

**Election record** (RESEARCH.md lines 553-563 — session storage, tiny writes, NOT debounced):
```typescript
const record = { tabId: 0, surface: 'sidepanel' as const, electedAt: Date.now() };
await chrome.storage.session.set({ np_workspace_primary: record });
const read = await chrome.storage.session.get('np_workspace_primary');
// CAS = read → freshness check (electedAt within 2 heartbeat windows) → set own record if empty/stale;
// tie-break: standalone surface wins when both attempt concurrently (§20.11)
```

**Error codes:** `WORKSPACE_ELECTION_TIMEOUT` / `WORKSPACE_STORAGE_UNAVAILABLE` exist in the closed set — use verbatim (D-38); never invent.

---

### `src/core/workspace/WorkspaceSync.ts` (MODIFY — add WORKSPACE_HEARTBEAT)

**Analog:** itself. The union (lines 5-8) gains one variant — D-26 keeps the file timer-free (32 lines today, stays pub/sub only):
```typescript
export type WorkspaceSyncMessage =
  | { type: 'WORKSPACE_UPDATED'; workspaceId: string; conversationId: string | null }
  | { type: 'STANDALONE_OPEN'; workspaceId: string; conversationId?: string; page?: string }
  | { type: 'WORKSPACE_HANDOFF'; workspaceId: string; conversationId: string }
  | { type: 'WORKSPACE_HEARTBEAT'; surface: ActiveSurface; workspaceId: string };   // D-26 ADD
```
Export a `notifyWorkspaceHeartbeat(...)` mirroring `notifyWorkspaceUpdate` (lines 18-24). No timer, no channel change — rides the existing `np_workspace` BroadcastBus.

---

### `src/core/workspace/WorkspaceStore.ts` (MODIFY — isPrimaryWriter pure read + gated persist)

**Analog:** itself. Two edits:

**1. `isPrimaryWriter()` swap (D-24)** — lines 18-20 replace the `return true` stub with a pure read of the in-memory election result (import from `./WorkspaceElection`):
```typescript
export function isPrimaryWriter(): boolean {
  return true;   // Phase-1 stub — REPLACED in Phase 2 by: electionState.state === 'primary' | 'solo'
}
```

**2. Persist storage swap (D-27/D-34)** — line 155 replaces `storage: createJSONStorage(() => chromeStorageAdapter)` with a `journalingAdapter` wrapper. The wrapper (RESEARCH Pattern 2): `setItem(name, value)` → `!isPrimaryWriter()` ⇒ NO-OP (secondary mirror); else parse JSON → extract workspaceId/conversationId → WriteJournalDB put `{status:'pending', operation:'update-workspace'}` (immediate, bypasses debounce) → `runJournaled` applies `[inner.setItem (debounced), notifyWorkspaceUpdate(...)]`. `getItem`/`removeItem` pass through.

**Persist config to preserve** (lines 148-170 — name `np_workspace_store`, partialize, `version: 1`, `migrate: workspaceMigrate` at lines 77-82):
```typescript
{
  name: 'np_workspace_store',
  storage: createJSONStorage(() => chromeStorageAdapter),   // ← swap to journalingAdapter
  partialize: (state) => ({ /* workspaceId, conversationId, ... version */ }),
  version: 1,
  migrate: workspaceMigrate,
}
```

---

### `src/core/theme/chromeStorageAdapter.ts` (MODIFY — surface STORAGE_QUOTA / STORAGE_RATE_LIMIT)

**Analog:** itself. D-39: the flush catch (lines 154-156) currently swallows into `debugLog('STORAGE_DEBOUNCE_FLUSH_FAILED', ...)`. Replace with classification → ErrorStore + debugLog (never swallowed). Both `setItem` (lines 149-157) and `syncStorageAdapter.setItem` (lines 208-213) flush-catches change:

```typescript
performFlush().catch((err) => {
  // D-39: classify quota/rate-limit rejections (chrome.storage rejects with
  // message-text lastError, not typed codes — Pitfall 6). Never swallowed.
  const msg = err?.message ?? String(err);
  const code = /QUOTA|QUOTA_BYTES/i.test(msg) ? 'STORAGE_QUOTA'
    : /MAX_WRITE_OPERATIONS/i.test(msg) ? 'STORAGE_RATE_LIMIT'
    : 'STORAGE_DEBOUNCE_FLUSH_FAILED';
  void ErrorStore.record({ code, message: msg, context: redactSensitive({ key: /* safe context */ }) });
  debugLog(code, msg);
});
```

Keep `STORAGE_DEBOUNCE_MS = 300` (line 14), the `__test__` seam (lines 231-247), and D-22 debounce behavior fully intact (D-43 — no re-open).

---

### `src/store/useExtensionStore.ts` (MODIFY — np_store → np_providers migration)

**Analog:** itself. Two edits:

**1. `partialize` extension (Pitfall 10)** — lines 525-528 currently exclude only `activeSession`/`activeAttachments`/`availableTabs`. Add secret fields so the persisted `np_store` blob NEVER carries plaintext:
```typescript
partialize: (state) => {
  const { activeSession, activeAttachments, availableTabs, config, ...rest } = state;
  return { ...rest, config: stripSecrets(config) };   // providers.*.apiKey, openAiKey, geminiKey → '' (criterion 3)
},
```

**2. Async boot-step migration (D-28, Pattern 3)** — NEVER inside `persist.migrate` (Pitfall 2: migrate is sync; PBKDF2 is async). The migrate fn (lines 555-562) stays a no-op; a new exported `migrateProviderSecrets()` async boot step runs at surface boot (Options authoritative; sidepanel/standalone defensive). Order (crash-safe, idempotent): read `np_store` → skip if no legacy plaintext OR `np_providers` exists → `KeyVault.ensureInstallSecret()` → derive+encrypt fields → **write `np_providers` first** → **strip plaintext from `np_store` second**.

**Persist config to keep** (lines 523-534): `name: 'np_store'`, `storage: createJSONStorage(() => chromeStorageAdapter)`, `merge` at lines 535-541.

---

### `wxt.config.ts` (MODIFY — unlimitedStorage)

**Analog:** itself. Line 36: `permissions: ['sidePanel', 'storage', 'tabs']` → `permissions: ['sidePanel', 'storage', 'tabs', 'unlimitedStorage']` (D-40 / ADR-STACK-02 / REQ-R06). Update the D-19a comment block (lines 29-35) to note Phase-2 addition. Note: does NOT lift `chrome.storage.session`'s 10 MB cap (Pitfall 7).

---

### `tests/setup.ts` (MODIFY — fake-indexeddb + session mock)

**Analog:** itself. Two additions (RESEARCH Wave 0 Gaps):

**1. `import 'fake-indexeddb/auto'`** at top — installs global `indexedDB`; per-test reset `indexedDB = new IDBFactory()` in `beforeEach` (RESEARCH lines 544-551).

**2. `chrome.storage.session` mock** — mirror the local mock (lines 45-95), expose `__chromeStorageSession` + `__chromeSessionMap`, wire at lines 142-145:
```typescript
(globalThis as any).chrome.storage = {
  local: chromeStorageLocal as any,
  sync: chromeStorageSync as any,
  session: chromeStorageSession as any,   // ADD (Pitfall 5)
};
```

---

### `src/types/storage.ts` (NEW, implied)

**Analog:** `src/types/index.ts` (type barrel; `ProviderConfig` at lines 114-137, `CustomProviderDetail.apiKey` at line 108 — the shape D-30 keeps). New home for `WriteJournalEntry` (per RESEARCH Pattern 2 / A4: O.11 imports from `@/types/storage`):

```typescript
export type WriteJournalEntryStatus = 'pending' | 'applying' | 'completed' | 'rolled-back';

export interface WriteJournalStepRecord {
  name: string;
  status: 'completed' | 'rolled-back';
}

export interface WriteJournalEntry {
  id: string;
  operation: WriteJournalOperation;   // import union from src/core/storage/WriteJournal
  status: WriteJournalEntryStatus;
  attempts: number;
  steps: WriteJournalStepRecord[];
  createdAt: number;
}
```
Field fidelity per Appendix C — no invention (discretion). Zod schema for cross-boundary validation (CLAUDE.md convention).

---

### Test files (5 required + implied)

**Test conventions** — all new tests copy `tests/core/storage/chromeStorageAdapter.test.ts` (lines 1-16): vitest `describe/it/expect/beforeEach/vi`, import from `../../../src/...`, `beforeEach` clears `__chromeStorageMap` + `vi.clearAllMocks()` + `__test__.resetPendingState()`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeStorageAdapter, flushPendingWrites, __test__, STORAGE_DEBOUNCE_MS } from '../../../src/core/theme/chromeStorageAdapter';

describe('chromeStorageAdapter — D-22 trailing debounce', () => {
  beforeEach(() => {
    const map = (globalThis as any).__chromeStorageMap;
    if (map) map.clear();
    vi.clearAllMocks();
    __test__.resetPendingState();
  });
```

- **`WriteJournal.test.ts`** (success criterion 1): simulated SW kill mid-write → replay restores state; idempotent replay; rollback on step failure. Uses fake-indexeddb harness; asserts `debugLog('WRITE_JOURNAL_FAILED', ...)` on failure path.
- **`EncryptedStorage.test.ts`** (criterion 2): AES-GCM round-trip encrypt→local→decrypt; wrong-key/tamper rejection (`crypto.subtle` verified available in this env — no polyfill, Pitfall 1).
- **`IndexedDBMigrator.test.ts`** (criterion 4): v1→v2 fixture DB pair — idempotent (run twice = no-op), backward-compatible (v2 open migrates v1 data), fresh-open-at-v2 applies both steps (Pitfall 8: conditional blocks).
- **`RateLimiter.test.ts`** (D-36): burst consumption, refill, `RATE_LIMITED` on empty.
- **`WorkspacePersistence.test.ts`** (criterion 5): workspace persists across reload (mock storage map) + cross-surface handoff; election-gated persist (primary writes, secondary skips) — extends `tests/core/workspace/WorkspaceStore.test.ts` conventions (lines 8-11 `beforeEach` reset via store actions).
- **`WorkspaceElection.test.ts`** (implied, D-24..D-27): CAS, 3 s heartbeat, 2-miss re-election, Standalone tie-break, solo case — `vi.useFakeTimers()` + `__test__`-style timer seams; needs the session mock (Pitfall 5).
- **`chromeStorageAdapter.test.ts`** (modify, REQ-R07): quota/rate-limit surfacing — mock `set` must reject (`mockRejectedValue` with message text `QUOTA_BYTES` / `MAX_WRITE_OPERATIONS_PER_MINUTE`) → assert `STORAGE_QUOTA` / `STORAGE_RATE_LIMIT` recorded (Pitfall 6).
- **Criterion-3 inspection test** (in `tests/core/security`): round-trip a known key value through a provider save, then grep the Map-backed storage mock (`(globalThis as any).__chromeStorageMap`) for the plaintext substring — must NOT be present (RESEARCH Pattern 3).

---

## Shared Patterns

### Error-code discipline (D-38 — applies to every new/modified file)
**Source:** spec §21.6 / Appendix C.2 closed registry
**Apply to:** All storage/IDB/KeyVault/WriteJournal/Requester/Election catch paths
**Rule:** Add EXACTLY two codes — `STORAGE_QUOTA`, `STORAGE_RATE_LIMIT`. Reuse existing: `STORAGE_READ_FAILED`, `IDB_BLOCKED`, `IDB_MIGRATION_FAILED`, `TIMEOUT`, `NETWORK`, `RATE_LIMITED`, `WORKSPACE_ELECTION_TIMEOUT`, `WORKSPACE_STORAGE_UNAVAILABLE`, `WORKSPACE_HANDOFF_FAILED`. `WRITE_JOURNAL_FAILED`/`WRITE_JOURNAL_ROLLBACK_FAILED` stay spec-internal `debugLog` codes. A grep audit must pass — no invented codes.

### debugLog(code, message, context) (all new service/utility files)
**Source:** `src/core/log/debugLog.ts` lines 11-27
**Apply to:** WriteJournal, ErrorStore, WorkspaceElection, chromeStorageAdapter, KeyVault
```typescript
debugLog('AI_STREAM_ERROR', { providerId, error: err.message });
```
Never raw `console.log` (CLAUDE.md). Redact first — TraceRedactor discipline via `redactSensitive` (D-39/§16.5).

### Zustand persist config shape (WorkspaceStore + useExtensionStore modifications)
**Source:** `src/core/workspace/WorkspaceStore.ts` lines 84-172 / `src/store/useExtensionStore.ts` lines 522-544
**Apply to:** WorkspaceStore (journaling adapter swap), useExtensionStore (partialize + boot migration)
```typescript
create<Store>()(
  persist(
    immer((set) => ({ ... })),
    {
      name: 'np_...',
      storage: createJSONStorage(() => chromeStorageAdapter),  // the shared choke point
      partialize: (state) => ({ /* persisted subset */ }),
      version: 1,
      migrate: noopMigrate,
    },
  ),
);
```

### Typed message unions over BroadcastBus (WorkspaceSync + WorkspaceElection heartbeat)
**Source:** `src/core/workspace/WorkspaceSync.ts` lines 5-8 + `src/core/runtime/BroadcastBus.ts` lines 55-62
**Apply to:** WORKSPACE_HEARTBEAT addition (D-26); election heartbeat publish
Union-style discriminated variants; `publish<T>(channel, payload)` with `_sender` envelope; self-messages suppressed (line 27).

### Timer + `__test__` seam (WorkspaceElection 3 s tick)
**Source:** `src/core/theme/chromeStorageAdapter.ts` lines 33-42, 231-247
**Apply to:** WorkspaceElection's only timer (D-26)
Export `__test__` with `setTimerFactory`/`setTimerClear`/reset so tests drive `vi.useFakeTimers()` + `vi.advanceTimersByTime(3000)` without real 3 s waits. Production code must not use `__test__`.

### Zod validation at boundaries (all new persisted/typed shapes)
**Source:** CLAUDE.md convention ("All cross-boundary data uses Zod validation") + RESEARCH V5
**Apply to:** `np_providers` blob, `WriteJournalEntry`, `WorkspaceCoordinationState`, journal entries read from IDB. Schema-validate on hydrate/read, never trust persisted blobs.

### NP-STRICT cleanliness (Pitfall 9 — all new code)
**Source:** `tests/core/strict/np-strict-ceiling.test.ts` + package.json `NP_STRICT_CEILING`
**Apply to:** Every new Phase-2 file. `strict: true`; real types for WorkspaceElection states, journal entries, encrypted blobs; NO new `@ts-expect-error NP-STRICT-<n>` markers (ceiling is 0 in Phase 2-3). `@ts-ignore` is forbidden (doesn't self-destruct).

### chrome.storage write-rate budget (D-43 — verification constraint)
**Source:** PITFALLS P2 (~120 writes/min boundary)
**Apply to:** Heartbeat session writes (1/3 s = 20/min, NOT debounced), journal-entry writes (immediate, bypass debounce), np_workspace persists (D-22 300 ms debounced). Steady-state ≤30 writes/min assertion stays green.

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md spec excerpts / idb library patterns):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/core/storage/WriteJournal.ts` | service | event-driven | No journaling exists; spec O.11 is the authoritative reference (quoted in RESEARCH.md) |
| `src/core/storage/IndexedDBMigrator.ts` | config/framework | batch/transform | No IDB in repo; registry shape borrowed from CommandRegistry; openDB mechanics from idb |
| `src/core/storage/{ChatHistoryDB,MemoryDB,NotesDB,WriteJournalDB}.ts` | model | CRUD | No IndexedDB code ships before Phase 2 (verified `src/core/` listing); idb README + RESEARCH examples are the template |
| `src/core/security/KeyVault.ts` | service | transform (crypto) | No crypto in repo; spec §15.2 scheme + RESEARCH code examples are locked |
| `src/core/security/redactSensitive.ts` | utility | transform | TraceRedactor is Phase 11 (not in repo); shape follows debugLog.ts module conventions |
| `src/core/utils/RateLimiter.ts` | utility | request-response | No class-based util in repo; spec §13 + RESEARCH example are authoritative |

---

## Metadata

**Analog search scope:** `src/core/` (theme, workspace, runtime, log, registry, commands), `src/store/`, `src/services/`, `src/types/`, `tests/` (setup + core/storage + core/workspace + core/strict), `wxt.config.ts`
**Files scanned:** 14 source files + 3 test/infra files (chromeStorageAdapter, WorkspaceStore, WorkspaceSync, WorkspaceRouter, BroadcastBus, debugLog, useExtensionStore, Registry, CommandRegistry, ThemeStore, aiProvider, types/index, wxt.config, tests/setup, chromeStorageAdapter.test, WorkspaceStore.test, np-strict-ceiling.test)
**Pattern extraction date:** 2026-08-23
**Key sources:** 02-CONTEXT.md (D-24..D-43), 02-RESEARCH.md (Patterns 1-4, Code Examples, Pitfalls 1-10), spec §15.1/§15.2/§20.3/§20.4/§20.11/Appendix O.11 (via RESEARCH verbatim quotes)