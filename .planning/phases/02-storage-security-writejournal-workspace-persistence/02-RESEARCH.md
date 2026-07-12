# Phase 02: Storage, Security, WriteJournal, Workspace Persistence - Research

**Researched:** 2026-07-12
**Domain:** Chrome extension storage infrastructure — IndexedDB, chrome.storage APIs, Web Crypto AES-GCM, multi-store consistency, Zustand persistence
**Confidence:** HIGH

## Summary

This phase delivers the split-storage backbone for NowPilot: a single `nowpilot` IndexedDB database managed via `idb` v8, AES-GCM-256 encrypted API keys via the Web Crypto API wrapped in an EncryptedStorage adapter, a WriteJournal for multi-store consistency with idempotent recovery, versioned IndexedDB migrations, and durable workspace state persistence via `chrome.storage.local`.

The primary external dependency is `idb` v8.0.3 — a tiny (~1.2KB brotli'd), battle-tested IndexedDB wrapper by Jake Archibald (Google) with 17.5M weekly downloads and 8+ years of maintenance. All encryption uses the built-in `crypto.subtle` API — no external crypto libraries needed. The Zustand persist infrastructure is already in place from Phase 1; the main architectural shift is switching workspace persistence from `chrome.storage.session` to `chrome.storage.local` and routing writes through WriteJournal.

**Primary recommendation:** Use `idb` v8.0.3 for all IndexedDB operations, `crypto.subtle` (built-in) for AES-GCM-256 encryption with PBKDF2 key derivation, and the existing Zustand `createJSONStorage` adapter pattern for EncryptedStorage. The WriteJournal is a hand-rolled coordinator (no library needed) that journals operations to its own IndexedDB object store before committing data writes.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** WriteJournal stores journal entries in a dedicated `write_journal` object store within the single `nowpilot` IndexedDB database.
- **D-02:** Recovery is hybrid — eager on startup (primary) + before first new write (safety guard) + lazy on read inconsistency (fallback/self-healing). Only replay entries with status `pending` or `applying`. `failed` and `rolled-back` entries are kept for diagnostics.
- **D-03:** Idempotency guaranteed via operation UUID per journal entry. On replay, check if the UUID already exists in the target store — skip if already applied.
- **D-04:** Entry status lifecycle: `pending` → `applying` → `completed` | `failed`.
- **D-05:** WriteJournal entries and data writes use separate IndexedDB transactions — journal entry committed first, then data write follows. If data write fails, journal entry is marked `failed`.
- **D-06:** Completed entries auto-pruned after retention window (7–30 days or last 1,000 entries). Pending, applying, failed, and rolled-back entries retained indefinitely.
- **D-07:** Single IndexedDB database named `nowpilot` with separate object stores per domain: `chat_history`, `notes`, `memory`, `errors`, `transaction_log`, `write_journal`.
- **D-08:** Schema migrations use a single version counter with unified upgrades via `onUpgradeNeeded`. All object store schemas checked/created/updated on version increment.
- **D-09:** IndexedDBMigrator supports versioned, idempotent migrations — running the same migration twice produces the same result.
- **D-10:** EncryptedStorage is a transparent wrapper around `chrome.storage.local` — exposes `get`/`set`/`remove` API, encrypting/decrypting transparently. Drop-in replacement.
- **D-11:** Master encryption key derivation: random `np_install_secret` generated once at installation, stored in `chrome.storage.local`. AES-GCM key derived via `PBKDF2(installSecret + extensionId, salt)` using `crypto.subtle.deriveKey`.
- **D-12:** Per-value encryption: each value gets unique 16-byte random salt and 12-byte random IV via `crypto.getRandomValues()`. Stored alongside ciphertext: `{ alg: 'AES-GCM', salt, iv, ciphertext }`.
- **D-13:** Key initialization: `EncryptedStorage.initialize()` called at app startup. Lazy auto-init fallback for edge cases.
- **D-14:** Encryption algorithm: AES-GCM-256 via `crypto.subtle`. Per-key unique salt and IV — no key reuse.
- **D-15:** WorkspaceStore switches from `chrome.storage.session` to `chrome.storage.local` (key: `np_workspace`) for durable persistence.
- **D-16:** Primary writer election and heartbeats remain on `chrome.storage.session` (key: `np_workspace_primary`). Writer election scope unchanged from Phase 1.
- **D-17:** All persistent WorkspaceStore updates route through WriteJournal: `setState()` creates journal entry → writes to `chrome.storage.local` → emits `WORKSPACE_UPDATED` via BroadcastBus → marks journal entry `completed`.
- **D-18:** Cross-surface sync: BroadcastBus primary (`WORKSPACE_UPDATED` events). `chrome.storage.local` for durability + startup hydration. `chrome.storage.onChanged` as fallback.
- **D-19:** WorkspaceState persists full canonical schema including future-facing fields (`pinnedTabs`, `currentPageContext`, `selectedNotes`, `activeAddonContext`, `activeSkillRun`). Consumers arrive in later phases.
- **D-20:** RateLimiter uses token bucket algorithm with configurable capacity and refill rate.
- **D-21:** Rate limit exceeded signaled via structured result `{ allowed, retryAfter, remaining }` — not an exception.
- **D-22:** RateLimiter is a general-purpose core utility (`src/core/utils/RateLimiter.ts`). Any component can instantiate with own config.
- **D-23:** RateLimiter state is in-memory only. Resets on page reload or SW restart. Sufficient for v0.1.

### the agent's Discretion

All implementation details (file structure, test organization, internal method naming, exact IndexedDB transaction boundaries, error handling granularity) are at the planner's and implementer's discretion within the constraints of the locked decisions above and the established project patterns (class + singleton export, Zustand persist adapters, Vitest + jsdom testing, direct path imports, `np_` key prefix, `debugLog` usage per HARD-09).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WRKSP-05 | Workspace state persists across page reload and cross-surface handoff | Zustand persist + chrome.storage.local + BroadcastBus sync. See Architecture Patterns: Workspace Persistence. |
| STOR-01 | Split storage — IndexedDB for message bodies, chrome.storage.local for metadata, chrome.storage.session for tokens | idb v8 for IndexedDB, chrome.storage.local for metadata/encrypted keys, chrome.storage.session for writer election/tokens. See Standard Stack. |
| STOR-02 | AES-GCM encrypted API key storage via EncryptedStorage (PBKDF2 + per-key salt/IV) | crypto.subtle.encrypt/decrypt with AES-GCM-256. PBKDF2 key derivation. See Architecture Patterns: EncryptedStorage. |
| STOR-03 | WriteJournal for multi-store consistency with idempotent operations | Custom coordinator with `write_journal` object store in IndexedDB. UUID-based idempotency. See Architecture Patterns: WriteJournal. |
| STOR-04 | IndexedDBMigrator with versioned, idempotent migrations | idb `openDB` with version increments and `oldVersion` checks. See Architecture Patterns: IndexedDBMigrator. |
| STOR-05 | ChatHistoryDB, NotesDB, MemoryDB, ErrorStore, AITransactionLogDB | All as object stores within single `nowpilot` IndexedDB database via idb. See Standard Stack: Core. |
| STOR-06 | RateLimiter per add-on instance | Token bucket algorithm. See Architecture Patterns: RateLimiter. |
| STOR-07 | No message bodies in chrome.storage.local | Enforced by architecture — messages go to IndexedDB; chrome.storage.local holds only metadata and encrypted payloads. See Architecture Patterns: Storage Split. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| IndexedDB management (openDB, migrations, object stores) | Browser / Client | — | IndexedDB is a browser API; all access happens in side panel and full app surfaces (not background SW per MV3 restrictions) |
| EncryptedStorage (AES-GCM encrypt/decrypt) | Browser / Client | — | `crypto.subtle` is a browser API; key derivation and per-value encryption happen in memory on the UI thread |
| chrome.storage.local persistence | Browser / Client | — | `chrome.storage.*` APIs are available in all extension contexts; read/written directly from store adapters |
| WriteJournal coordination | Browser / Client | — | Journal entries stored in IndexedDB; recovery logic runs in UI context on startup |
| Workspace cross-surface sync | Browser / Client | Frontend Server (SSR) | BroadcastBus uses `chrome.storage.onChanged` which fires across extension contexts; no server tier exists in this architecture |
| Rate limiting (token bucket) | Browser / Client | — | In-memory state only; each surface has its own RateLimiter instance |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `idb` | 8.0.3 | IndexedDB wrapper — openDB, transactions, object stores, indexes | [VERIFIED: npm registry] Created by Jake Archibald (Google Chrome team). 17.5M weekly downloads, 8+ years of maintenance. 1.2KB brotli'd. The de-facto standard for IndexedDB in web apps and Chrome extensions. Locked in PROJECT.md constraints. |
| `zustand` | ^5.0.0 (installed) | State management with persist middleware for chrome.storage adapters | [VERIFIED: npm registry] Already installed from Phase 1. `createJSONStorage` adapter pattern is battle-tested for chrome.storage integration. No additional store library needed. |
| Web Crypto API (`crypto.subtle`) | Built-in (Chrome 37+) | AES-GCM-256 encrypt/decrypt, PBKDF2 key derivation, random salt/IV generation | [VERIFIED: MDN Web Docs] Available in all Chrome extension contexts. No external crypto library needed. Chrome extensions have supported `crypto.subtle` since Chrome 37 (2014). |
| `chrome.storage.local` | Built-in (MV3) | Durable metadata, encrypted API keys, workspace state | [VERIFIED: Chrome Extension API] 10MB limit (expandable to unlimited with `unlimitedStorage` permission). Available in all extension contexts. |
| `chrome.storage.session` | Built-in (MV3) | Writer election, heartbeats, transient tokens | [VERIFIED: Chrome Extension API] Cleared on browser close. 10MB limit. Already in use from Phase 1. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | ^4.4.3 (installed) | Schema validation for migration descriptors, journal entry shapes, storage payloads | Validate WriteJournalEntry structure, IndexedDBMigration descriptors, and EncryptedStorage metadata wrappers at runtime. |
| `vitest` | ^4.1.0 (installed) | Unit and integration tests for storage modules | Storage tests in `tests/core/storage/` with mocked `chrome.*` and indexedDB (see tests/setup.ts pattern). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `idb` v8 | `idb-keyval` | `idb-keyval` is simpler key-value API but lacks transaction support, indexes, and schema versioning needed for multi-store migrations. `idb` v8 provides full IndexedDB API surface with better ergonomics. |
| `idb` v8 | Dexie.js | Dexie is more feature-rich (observable queries, liveQuery) but larger bundle (~25KB) and adds abstraction over standard IndexedDB that complicates migration testing. `idb` is closer to the native API. |
| Web Crypto API | `tweetnacl` or `libsodium` | External crypto libraries add bundle weight (~15-50KB). `crypto.subtle` is built-in, audited by browser vendors, and sufficient for AES-GCM-256 encryption. No need for additional primitives like X25519 in this use case. |
| Custom RateLimiter | `bottleneck` or `p-limit` | `bottleneck` is Node.js-specific. `p-limit` is concurrency control, not rate limiting. A token bucket is ~30 lines of code — simpler to implement than to add a dependency with different semantics. |

**Installation:**
```bash
npm install idb@^8.0.3
```

**Version verification:**
```bash
npm view idb version  # 8.0.3
npm view idb time --json 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('8.0.3','unknown'))"
# Published: 2025-05-07
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `idb` | npm | 8+ yrs | 17.5M/wk | github.com/jakearchibald/idb | OK | Approved |
| `zustand` | npm | 6+ yrs | 9M+/wk | github.com/pmndrs/zustand | OK | Approved (already installed) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*All recommended packages verified against npm registry and official documentation via Context7.*

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                        APPLICATION STARTUP                           │
│                                                                      │
│  1. EncryptedStorage.initialize()                                    │
│     ├── Read/create np_install_secret from chrome.storage.local      │
│     └── Derive master AES-GCM key via PBKDF2                         │
│                                                                      │
│  2. IndexedDBMigrator.boot()                                         │
│     ├── openDB('nowpilot', DB_VERSION, { upgrade })                  │
│     ├── Run pending migrations (oldVersion < N checks)               │
│     └── On migration failure → ErrorStore + degraded mode            │
│                                                                      │
│  3. WriteJournal.recover()                                           │
│     ├── Query write_journal store for status=pending|applying        │
│     ├── For each: check idempotency UUID in target store             │
│     ├── Replay unapplied steps → mark completed or failed            │
│     └── Prune completed entries older than retention window          │
│                                                                      │
│  4. WorkspaceStore (Zustand persist)                                 │
│     └── Hydrate from chrome.storage.local key np_workspace           │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                         DATA WRITE FLOW                              │
│                                                                      │
│  ProviderStore.setApiKey(provider, key)                              │
│    │                                                                 │
│    ▼                                                                 │
│  EncryptedStorage.set('np_providers', encryptedConfigs)              │
│    │                                                                 │
│    ├── 1. Generate unique 16B salt + 12B IV (crypto.getRandomValues) │
│    ├── 2. Encrypt: crypto.subtle.encrypt(AES-GCM, derivedKey, iv,    │
│    │              plaintext)                                         │
│    ├── 3. Wrap: { alg:'AES-GCM', salt, iv, ciphertext }              │
│    └── 4. Persist to chrome.storage.local                            │
│                                                                      │
│  WorkspaceStore.setState(partial)  [WRITES through WriteJournal]     │
│    │                                                                 │
│    ▼                                                                 │
│  WriteJournal.begin('update-workspace', { workspaceId, version })    │
│    │                                                                 │
│    ├── Step 1: INSERT journal entry (status=pending) in IndexedDB    │
│    │           write_journal store [separate transaction]            │
│    │                                                                 │
│    ├── Step 2: chrome.storage.local.set({ np_workspace })            │
│    │           [separate operation]                                  │
│    │                                                                 │
│    ├── Step 3: BroadcastBus.emit('WORKSPACE_UPDATED', state)         │
│    │                                                                 │
│    └── Step 4: UPDATE journal entry (status=completed)               │
│                [separate transaction]                                │
│                                                                      │
│  On any step failure → mark journal entry status=failed              │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                      CROSS-SURFACE SYNC                              │
│                                                                      │
│  Side Panel                    Full App                              │
│      │                             │                                 │
│      │  chrome.storage.onChanged  │                                 │
│      │◄──────────────────────────►│  (fallback mechanism)            │
│      │                             │                                 │
│      │  BroadcastBus              │                                 │
│      │  WORKSPACE_UPDATED event   │  (primary mechanism)             │
│      │◄──────────────────────────►│                                 │
│      │                             │                                 │
│      │  chrome.storage.local      │                                 │
│      │  np_workspace              │  (durability + hydration)        │
│      │◄──────────────────────────►│                                 │
│                                                                      │
│  Writer election (unchanged from Phase 1):                           │
│      chrome.storage.session key np_workspace_primary                 │
│      Heartbeat every 3s. Full App wins tie-break.                    │
└──────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────┐
│                        INDEXEDDB TOPOLOGY                            │
│                                                                      │
│  Database: nowpilot (single DB, versioned)                           │
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                    │
│  │ chat_history        │  │ notes               │                    │
│  │  ├── sessions       │  │  ├── notes          │                    │
│  │  └── messages       │  │  └── concepts       │                    │
│  └─────────────────────┘  └─────────────────────┘                    │
│                                                                      │
│  ┌─────────────────────┐  ┌─────────────────────┐                    │
│  │ memory              │  │ errors              │                    │
│  │  ├── messages       │  │  (FIFO max 100)     │                    │
│  │  ├── userFacts      │  └─────────────────────┘                    │
│  │  └── summaries      │                                             │
│  └─────────────────────┘  ┌─────────────────────┐                    │
│                           │ transaction_log     │                    │
│  ┌─────────────────────┐  │  ├── transactions   │                    │
│  │ write_journal       │  │  ├── promptTraces   │                    │
│  │  └── entries        │  │  ├── toolTraces     │                    │
│  └─────────────────────┘  │  └── providerTraces │                    │
│                           └─────────────────────┘                    │
└──────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/core/
├── storage/
│   ├── IndexedDBManager.ts        # idb openDB, DB_VERSION const, upgrade callback
│   ├── IndexedDBMigrator.ts       # Migration registry, versioned execution, idempotency
│   ├── migrations/
│   │   ├── v1-initial-schema.ts   # Creates all 6+ object stores, indexes
│   │   └── v2-fixture.ts          # Example: adds an index or store
│   ├── EncryptedStorage.ts        # crypto.subtle wrapper, chrome.storage.local adapter
│   ├── WriteJournal.ts            # Journal coordinator, recovery, pruning
│   ├── WriteJournalEntry.ts       # Type definition + zod schema
│   └── stores/
│       ├── ChatHistoryDB.ts       # Sessions + Messages domain logic
│       ├── NotesDB.ts             # Notes + Concepts domain logic
│       ├── MemoryDB.ts            # Messages + Facts + Summaries domain logic
│       ├── ErrorStore.ts          # FIFO debug error log
│       └── AITransactionLogDB.ts  # Transaction/Tool/Provider trace persistence
├── utils/
│   └── RateLimiter.ts             # Token bucket algorithm
├── stores/
│   ├── workspaceStore.ts          # UPDATED: switch to chrome.storage.local + WriteJournal
│   └── providerStore.ts           # UPDATED: replace in-memory with EncryptedStorage
└── messaging/
    └── broadcastBus.ts            # UPDATED: add chrome.storage.local listener, WORKSPACE_UPDATED events

tests/core/
└── storage/
    ├── IndexedDBMigrator.test.ts
    ├── EncryptedStorage.test.ts
    ├── WriteJournal.test.ts
    ├── RateLimiter.test.ts
    ├── workspaceStore.test.ts     # UPDATED: test chrome.storage.local persistence
    └── broadcastBus.test.ts       # UPDATED: test local storage events
```

### Pattern 1: IndexedDB with Versioned Migrations (idb v8)

**What:** Use `idb`'s `openDB()` with `DBSchema` type parameter and versioned `upgrade` callbacks using `oldVersion` checks. This is the exact pattern recommended by the idb documentation and used by the Google Chrome team.

**When to use:** Every IndexedDB open. The `DB_VERSION` constant acts as the single source of truth; incrementing it triggers the migration pipeline.

**Example:**
```typescript
// Source: /jakearchibald/idb Context7 docs — openDB with versioned upgrades
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface NowPilotDB extends DBSchema {
  chat_history_sessions: {
    key: string;
    value: { id: string; title: string; created: number; updated: number; starred: boolean; preview: string };
  };
  chat_history_messages: {
    key: string;
    value: { sessionId: string; role: string; content: string; timestamp: number; metadata?: unknown };
    indexes: { 'by-session': string };
  };
  write_journal_entries: {
    key: string;
    value: WriteJournalEntry;
    indexes: { 'by-status': string };
  };
  // ... other stores
}

let dbInstance: IDBPDatabase<NowPilotDB> | null = null;

export const DB_VERSION = 1;

export async function getDB(): Promise<IDBPDatabase<NowPilotDB>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<NowPilotDB>('nowpilot', DB_VERSION, {
    upgrade(db, oldVersion, newVersion, transaction) {
      // Version 1: create all initial stores
      if (oldVersion < 1) {
        const sessionsStore = db.createObjectStore('chat_history_sessions', { keyPath: 'id' });
        const messagesStore = db.createObjectStore('chat_history_messages', { keyPath: 'id' });
        messagesStore.createIndex('by-session', 'sessionId');

        db.createObjectStore('notes_notes', { keyPath: 'id' });
        db.createObjectStore('notes_concepts', { keyPath: 'slug' });

        db.createObjectStore('memory_messages', { keyPath: ['conversationId', 'seq'] });
        db.createObjectStore('memory_userFacts', { keyPath: 'id' });
        db.createObjectStore('memory_summaries', { keyPath: 'conversationId' });

        db.createObjectStore('errors', { keyPath: 'id' });

        db.createObjectStore('transaction_log_transactions', { keyPath: 'id' });
        db.createObjectStore('transaction_log_promptTraces', { keyPath: 'id' });
        db.createObjectStore('transaction_log_toolTraces', { keyPath: 'id' });
        db.createObjectStore('transaction_log_providerTraces', { keyPath: 'id' });

        const journalStore = db.createObjectStore('write_journal_entries', { keyPath: 'id' });
        journalStore.createIndex('by-status', 'status');
      }
      // Future: if (oldVersion < 2) { ... }
    },
    blocked() {
      debugLog('warn', 'IndexedDB: open blocked by older connection');
    },
    blocking() {
      dbInstance?.close();
      dbInstance = null;
    },
    terminated() {
      dbInstance = null;
      debugLog('error', 'IndexedDB: connection terminated unexpectedly');
    },
  });

  return dbInstance;
}
```

**Key idb v8 specifics:**
- `DBSchema` interface uses store names as keys, each with `key`, `value`, and optional `indexes` types
- `createObjectStore` supports `keyPath` (single key or array for compound keys like `['conversationId', 'seq']`)
- `createIndex` can specify `unique: true` for uniqueness constraints
- `db.transaction(['store1', 'store2'], 'readwrite')` for multi-store operations
- `await tx.done` to ensure transaction completion [VERIFIED: /jakearchibald/idb Context7 docs]

### Pattern 2: EncryptedStorage (Web Crypto + chrome.storage.local)

**What:** A class that wraps `chrome.storage.local` with transparent AES-GCM-256 encryption. Exposes the same `get`/`set`/`remove` API surface as the Zustand `StateStorage` interface. Uses PBKDF2 to derive a master key from the install secret, and generates a unique salt+IV for each encrypted value.

**When to use:** Any time API keys or sensitive data need to be stored persistently. The `providerStore` is the primary consumer in Phase 2.

**Example:**
```typescript
// Source: /mdn/content Context7 docs — Web Crypto AES-GCM + PBKDF2 patterns
export interface EncryptedPayload {
  alg: 'AES-GCM';
  salt: ArrayBuffer;     // 16 bytes — unique per value
  iv: ArrayBuffer;       // 12 bytes — unique per value
  ciphertext: ArrayBuffer;
}

export class EncryptedStorage {
  private masterKey: CryptoKey | null = null;
  private initialized = false;

  async initialize(): Promise<void> {
    const installSecret = await this.getOrCreateInstallSecret();
    const extensionId = chrome.runtime.id;
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(installSecret + extensionId),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    // Use a fixed salt for the master key (derived from extension ID)
    const masterSalt = new TextEncoder().encode(`np-master-${extensionId}`);
    this.masterKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: masterSalt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable
      ['encrypt', 'decrypt'],
    );
    this.initialized = true;
  }

  async set(key: string, value: unknown): Promise<void> {
    await this.ensureInitialized();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.masterKey!,
      plaintext,
    );
    const payload: EncryptedPayload = { alg: 'AES-GCM', salt, iv, ciphertext };
    await chrome.storage.local.set({ [key]: payload });
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    await this.ensureInitialized();
    const result = await chrome.storage.local.get(key);
    const payload = result[key] as EncryptedPayload | undefined;
    if (!payload) return null;
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: payload.iv },
      this.masterKey!,
      payload.ciphertext,
    );
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  }

  async remove(key: string): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  private async getOrCreateInstallSecret(): Promise<string> {
    const result = await chrome.storage.local.get('np_install_secret');
    if (result.np_install_secret) return result.np_install_secret as string;
    const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    await chrome.storage.local.set({ np_install_secret: secret });
    return secret;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) await this.initialize();
  }
}

export const encryptedStorage = new EncryptedStorage();
```

**Key Web Crypto specifics:**
- `crypto.subtle.importKey('raw', ...)` to import the PBKDF2 key material from the install secret
- `crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, ...)` to derive the AES-GCM key [VERIFIED: /mdn/content Context7 docs]
- `crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)` and `decrypt` for per-value encryption [VERIFIED: /mdn/content Context7 docs]
- `crypto.getRandomValues(new Uint8Array(N))` for salt and IV generation
- 100,000 PBKDF2 iterations is the current recommended minimum (OWASP 2023)

### Pattern 3: WriteJournal with Idempotent Recovery

**What:** A coordinator class that journals multi-step write operations before executing them, enabling crash recovery. Each journal entry has a unique operation UUID for idempotency. Recovery replays pending/applying entries by checking if the UUID already exists in the target store.

**When to use:** Any write that spans multiple storage backends (IndexedDB + chrome.storage) or multiple logically related operations that must be atomic.

**Example:**
```typescript
// Source: Derived from CONTEXT.md locked decisions + Product Spec §20.3
export type WriteJournalOperation =
  | 'update-workspace'
  | 'append-memory-message'
  | 'evict-conversation'
  | 'archive-conversation'
  | 'compact-conversation'
  | 'save-note-with-links'
  | 'update-user-memory'
  | 'export-data';

export interface WriteJournalEntry {
  id: string;           // operation UUID
  operation: WriteJournalOperation;
  status: 'pending' | 'applying' | 'completed' | 'failed' | 'rolled-back';
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

// Recovery flow:
// 1. Query write_journal_entries where status IN ('pending', 'applying')
// 2. For each entry:
//    a. Check idempotency: query target store for entry.targetIds
//    b. If target already has matching data → mark entry completed (already applied)
//    c. Otherwise → replay steps from first 'pending' step
//    d. On success → mark completed; on failure after retries → mark failed
```

### Pattern 4: IndexedDBMigrator

**What:** A registry of `IndexedDBMigration` objects keyed by version number. On `boot()`, runs any migration where `fromVersion` <= `oldVersion` < `toVersion`. Each migration receives the `IDBPDatabase` and `IDBPTransaction` for data transformation.

**When to use:** Every IndexedDB open. Called before any application code accesses object stores.

**Example:**
```typescript
// Source: Product Spec §20.4 + idb upgrade callback pattern
export interface IndexedDBMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate(db: IDBPDatabase<NowPilotDB>, tx: IDBPTransaction<...>): Promise<void>;
}

export class IndexedDBMigrator {
  private migrations: IndexedDBMigration[] = [];

  register(migration: IndexedDBMigration): void {
    this.migrations.push(migration);
  }

  async boot(): Promise<void> {
    // Migrations are executed inside the idb upgrade callback
    // via oldVersion checks, making them atomic within the versionchange transaction.
    // On failure → log to ErrorStore and enter degraded mode.
  }
}
```

### Pattern 5: Zustand Store with EncryptedStorage Adapter

**What:** Wrapping EncryptedStorage in a `createJSONStorage` adapter so Zustand's `persist` middleware can transparently encrypt/decrypt store state.

**When to use:** For `providerStore` which holds API keys that must be encrypted at rest.

**Example:**
```typescript
// Source: /pmndrs/zustand Context7 docs — createJSONStorage + custom StateStorage
import { createJSONStorage } from 'zustand/middleware';
import { encryptedStorage } from '../storage/EncryptedStorage';

const encryptedJSONStorage = createJSONStorage<ProviderState>(() => ({
  getItem: async (name: string) => {
    const value = await encryptedStorage.get<string>(name);
    return value ?? null;
  },
  setItem: async (name: string, value: string) => {
    await encryptedStorage.set(name, JSON.parse(value));
  },
  removeItem: async (name: string) => {
    await encryptedStorage.remove(name);
  },
}));
```

### Pattern 6: RateLimiter (Token Bucket)

**What:** A simple token bucket algorithm implementation. Configurable `capacity` (max tokens) and `refillRate` (tokens/second). Returns `{ allowed, retryAfter, remaining }` on each `tryAcquire()` call.

**When to use:** Any component that needs to rate-limit external API calls or operations (add-ons, MCP tools, PROXY_FETCH, ServiceNow clients).

**Example:**
```typescript
// Source: Token bucket algorithm — standard pattern (training knowledge)
export interface RateLimiterConfig {
  capacity: number;       // max tokens (burst capacity)
  refillRate: number;     // tokens per second
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;     // ms until next token available (0 if allowed)
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly capacity: number;
  private readonly refillIntervalMs: number; // ms per token

  constructor(config: RateLimiterConfig) {
    this.capacity = config.capacity;
    this.tokens = config.capacity;
    this.lastRefill = Date.now();
    this.refillIntervalMs = 1000 / config.refillRate;
  }

  tryAcquire(): RateLimitResult {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return { allowed: true, remaining: this.tokens, retryAfter: 0 };
    }
    const deficit = 1 - this.tokens;
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil(deficit * this.refillIntervalMs),
    };
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed / this.refillIntervalMs;
    this.tokens = Math.min(this.capacity, this.tokens + newTokens);
    this.lastRefill = now;
  }
}
```

### Anti-Patterns to Avoid

- **Background SW IndexedDB access:** MV3 service workers cannot use IndexedDB. All IndexedDB code must run in side panel, full app, or other UI contexts. Never import IndexedDB modules in `src/entrypoints/background.ts`. [VERIFIED: Chrome MV3 documentation]
- **Shared IndexedDB transactions across journal and data writes:** Per D-05, WriteJournal entries and data writes use separate IndexedDB transactions. Journal durability comes first; if the data write fails, the journal entry records the failure. This prevents the classic "both succeed or both fail" deadlock with cross-store operations.
- **chrome.storage.quota exceeded without handling:** `chrome.storage.local` has a 10MB limit. Encrypted payloads (base64-encoded ciphertext + salt + IV) are ~30-50% larger than plaintext. Consider `unlimitedStorage` permission if total encrypted data + metadata approaches 10MB.
- **Reusing salt/IV across encryption operations:** Each encrypted value must have unique salt and IV. IV reuse with AES-GCM is catastrophic — it breaks the security model. `crypto.getRandomValues()` must be called per encryption, not cached.
- **Storing encryption key in localStorage/IndexedDB without encryption:** The master key derived from `np_install_secret` must never be persisted in plaintext. The install secret itself is stored in `chrome.storage.local` (which is extension-scoped and not accessible to web pages), which is the accepted pattern for Chrome extension secrets.
- **Direct chrome.storage.session for workspace state:** Per D-15, workspace must use `chrome.storage.local` for durability. `chrome.storage.session` clears on browser close — using it for anything beyond transient state (tokens, writer election) is a data loss bug.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB connection management, transactions, schema upgrades | Raw IndexedDB API (`indexedDB.open`, `IDBDatabase`, `IDBTransaction`) | `idb` v8 (`openDB`, typed transactions) | Raw IndexedDB has a callback-heavy, error-prone API. `idb` provides promises, typed schemas via `DBSchema`, and `await tx.done`. Edge cases: version change blocking, connection termination, transaction abort handling — all handled by `idb` callbacks. |
| AES-GCM encryption/decryption | OpenSSL/WASM crypto libraries, tweetnacl | `crypto.subtle` (built-in Web Crypto API) | `crypto.subtle` is implemented natively in Chrome, audited, constant-time, and available in all extension contexts. External crypto libraries add bundle weight and potential side-channel vulnerabilities. |
| Token bucket rate limiting | Complex distributed rate limiter, Redis-based | Simple in-memory `RateLimiter` class (~30 lines) | In-memory token bucket is sufficient for v0.1 per D-23. No network calls, no persistence needed. The algorithm is well-understood and has few edge cases (clock drift on system suspend is the only notable one — handled by `Date.now()` based refill). |
| JSON serialization for chrome.storage | Custom serialization | `JSON.stringify`/`JSON.parse` in `createJSONStorage` | Zustand's `createJSONStorage` handles this transparently. The existing themeStore and workspaceStore patterns from Phase 1 are proven. |
| Workspace cross-tab sync | Custom BroadcastChannel, postMessage | BroadcastBus (existing Phase 1) + `chrome.storage.onChanged` | The existing infrastructure handles cross-extension-context communication. Only addition needed: listen for `local` area changes (currently only `session` is listened). |

**Key insight:** The biggest "don't hand-roll" trap in this phase is the raw IndexedDB API. Chrome's `indexedDB.open()` returns `IDBOpenDBRequest` with `onsuccess`/`onerror`/`onupgradeneeded` callbacks — mixing promises and callbacks leads to subtle ordering bugs in schema migration. `idb` v8 wraps this in a clean promise-based API with typed schemas, making migrations deterministic and testable.

## Common Pitfalls

### Pitfall 1: IndexedDB Version Change Blocking
**What goes wrong:** If two tabs/surfaces open the same IndexedDB database at different versions, the newer version's `blocked` callback fires and the open hangs until the older tab closes its connection. This manifests as startup hanging indefinitely.
**Why it happens:** Chrome's IndexedDB implementation allows only one version of a database to be open at a time. During extension development, rapid reloads can leave stale connections.
**How to avoid:** 
- Use a singleton `getDB()` with connection caching (as shown in Pattern 1).
- Implement the `blocking` callback to close the connection on version change events.
- In the `terminated` callback, null out the cached instance so the next `getDB()` call reconnects.
- Always close connections in tests to prevent test isolation leaks.
**Warning signs:** "Database is blocked" console messages, `openDB` promises that never resolve, tests that pass in isolation but hang when run as a suite.

### Pitfall 2: AES-GCM IV Reuse
**What goes wrong:** Reusing the same IV with the same key for different plaintexts breaks AES-GCM security. An attacker can recover the authentication key and forge messages.
**Why it happens:** Developers cache IVs for performance or use a counter-based IV that resets on page reload. Copy-paste bugs where a constant IV is used.
**How to avoid:** Always call `crypto.getRandomValues(new Uint8Array(12))` per encryption. Never reuse, never use a counter, never use `new Uint8Array(12)` (zero-filled). The 12-byte random IV provides 96 bits of entropy — collision probability is negligible.
**Warning signs:** Any test where two `encrypt()` calls produce ciphertexts with the same IV bytes. Schema validation on `EncryptedPayload` should reject zero-filled IVs.

### Pitfall 3: chrome.storage.local QUOTA_BYTES exceeded
**What goes wrong:** `chrome.storage.local.set()` silently fails or throws when the 10MB quota is exceeded. Encrypted payloads are larger than plaintext (base64 encoding of ArrayBuffers + salt + IV overhead adds ~35%).
**Why it happens:** chrome.storage.local has a fixed 10MB limit per extension. Encrypted provider configs, conversation metadata, facts, and workspace state all accumulate.
**How to avoid:** 
- Add a `chrome.storage.local.getBytesInUse(null)` check before large writes.
- Consider requesting `unlimitedStorage` permission in the manifest if the storage strategy expects >10MB.
- Monitor size in debug logging. Encrypted metadata payloads are the biggest contributors.
**Warning signs:** `chrome.storage.local.set()` returning no error but data not appearing (silent quota exceed), `QUOTA_BYTES` errors in the console.

### Pitfall 4: WriteJournal Recovery Replaying Already-Applied Operations
**What goes wrong:** On recovery, a journal entry is replayed even though its data write already succeeded (but the journal status wasn't updated before the crash). This causes duplicate data.
**Why it happens:** The journal entry was marked `applying`, data was written, but the crash happened before the entry was marked `completed`. Recovery logic naively replays all `pending`/`applying` entries.
**How to avoid:** Per D-03, idempotency check before replay: for each entry, query the target store for `entry.targetIds` or the operation UUID. If matching data exists, skip the write and mark the entry `completed`. This is the core correctness guarantee.

### Pitfall 5: chrome.storage.local vs chrome.storage.sync Confusion
**What goes wrong:** Workspace state is written to `chrome.storage.sync` instead of `local`, causing data loss (sync has 8KB per-key limit and 100KB total limit).
**Why it happens:** `sync` and `local` have similar APIs. A copy-paste error from the themeStore (which correctly uses `sync` because theme is a small string) to the workspaceStore.
**How to avoid:** Document each storage area's purpose in code comments. Use distinct adapter variable names (`chromeLocalStorage` vs `chromeSyncStorage`). Verify in tests that `chrome.storage.local.set` is called, not `chrome.storage.sync.set`, for workspace operations.
**Warning signs:** Workspace state truncation, `QUOTA_BYTES_PER_ITEM` errors on `chrome.storage.sync`.

## Code Examples

Verified patterns from official sources:

### IndexedDB: Opening with Versioned Schema
```typescript
// Source: /jakearchibald/idb Context7 docs — openDB with upgrade callback
import { openDB, type DBSchema } from 'idb';

interface MyDB extends DBSchema {
  users: {
    key: number;
    value: { id: number; name: string; email: string };
    indexes: { 'by-email': string };
  };
  posts: {
    key: number;
    value: { id: number; userId: number; title: string };
    indexes: { 'by-userId': number };
  };
}

const db = await openDB<MyDB>('app', 2, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      const userStore = db.createObjectStore('users', { keyPath: 'id' });
      userStore.createIndex('by-email', 'email', { unique: true });
    }
    if (oldVersion < 2) {
      const postStore = db.createObjectStore('posts', { keyPath: 'id', autoIncrement: true });
      postStore.createIndex('by-userId', 'userId');
    }
  },
});
```

### Web Crypto: PBKDF2 Derive AES-GCM Key + Encrypt/Decrypt
```typescript
// Source: /mdn/content Context7 docs — SubtleCrypto deriveKey + encrypt/decrypt
async function encrypt(plaintext: string, salt: Uint8Array, iv: Uint8Array): Promise<{ salt: Uint8Array; iv: Uint8Array; ciphertext: ArrayBuffer }> {
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'],
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'],
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext),
  );
  return { salt, iv, ciphertext };
}
```

### Zustand: Custom createJSONStorage for chrome.storage
```typescript
// Source: /pmndrs/zustand Context7 docs — persist with custom storage + Phase 1 themeStore pattern
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const chromeLocalStorage = createJSONStorage<MyState>(() => ({
  getItem: (name: string) =>
    chrome.storage.local.get(name).then((result) => (result[name] as string) ?? null),
  setItem: (name: string, value: string) => chrome.storage.local.set({ [name]: value }),
  removeItem: (name: string) => chrome.storage.local.remove(name),
}));

export const useMyStore = create<MyState>()(
  persist(
    (set) => ({ /* ... */ }),
    { name: 'np_my_key', storage: chromeLocalStorage },
  ),
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw IndexedDB API (callbacks) | `idb` v8 (promises + typed schemas) | idb v1 (2014) | All modern Chrome extension projects use `idb`. Raw API is considered legacy. |
| `crypto.subtle.encrypt` with hardcoded IV | Per-value `crypto.getRandomValues` IV | Web Crypto spec (2014) | AES-GCM IV reuse is catastrophic. Modern best practice is unique random IV per operation. |
| PBKDF2 with 10K iterations | PBKDF2 with 100K iterations | OWASP 2023 | 100K is the current recommended minimum for SHA-256. Chrome can compute 100K iterations in <50ms. |
| Workspace in chrome.storage.session | Workspace in chrome.storage.local | Phase 2 | Session storage clears on browser close — causes data loss for workspace state that should persist across restarts. |

**Deprecated/outdated:**
- `crypto.subtle.generateKey` for AES-GCM in extensions: Use PBKDF2 key derivation from a stored secret instead. Generating a new key per session would break encrypted persistence.
- Storing raw ArrayBuffers in chrome.storage: chrome.storage only stores JSON-serializable values. ArrayBuffers must be converted to arrays or base64 strings before storage. The EncryptedStorage wrapper handles this.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PBKDF2 with 100K iterations and SHA-256 is the recommended parameter set for AES-GCM key derivation in 2026. | Architecture Patterns: EncryptedStorage | Medium — if OWASP or NIST recommends higher iterations (e.g., 600K), key derivation takes longer but security impact is minimal. Chrome's `crypto.subtle` handles any iteration count. |
| A2 | chrome.storage.local 10MB quota is sufficient for Phase 2 (metadata + encrypted provider configs + workspace state). Future phases (conversation metadata, memory facts, templates) may need `unlimitedStorage`. | Common Pitfalls: Pitfall 3 | Low — quota exceeded would be a runtime error caught in testing. Adding `unlimitedStorage` permission is a minor manifest change. |
| A3 | `idb` v8.0.3 is compatible with TypeScript 5.7+ and WXT v0.20 bundler. | Standard Stack | Low — `idb` is a pure JS library with TypeScript types included. No framework/bundler coupling. |

## Open Questions

1. **IndexedDB object store naming convention**
   - What we know: Product spec lists stores like `sessions`, `messages`, `notes` within named databases (ChatHistoryDB, NotesDB). Since D-07 specifies a single `nowpilot` database, these need unique store names.
   - What's unclear: Whether to use flat names (`chat_history_sessions`, `chat_history_messages`) or a namespace prefix convention.
   - Recommendation: Use flat, descriptive names (`chat_history_sessions`, `chat_history_messages`, `notes_notes`, `notes_concepts`, `memory_messages`, `memory_userFacts`, `memory_summaries`, `errors`, `transaction_log_transactions`, `transaction_log_promptTraces`, `transaction_log_toolTraces`, `transaction_log_providerTraces`, `write_journal_entries`). This is unambiguous and maps 1:1 to the DBSchema TypeScript interface keys.

2. **RateLimiter refill granularity**
   - What we know: D-20 specifies token bucket with configurable capacity and refill rate. D-23 states in-memory only.
   - What's unclear: Whether refill should be continuous (per-millisecond) or discrete (per-second ticks).
   - Recommendation: Implement continuous refill (token = min(capacity, tokens + elapsedMs / msPerToken)). This provides smoother rate limiting and avoids burst-at-second-boundary behavior. The token bucket formula is straightforward and well-documented.

3. **EncryptedStorage initialization timing in tests**
   - What we know: `crypto.subtle` is available in jsdom with appropriate polyfills or native Node 19+ support. `chrome.storage.local` is mocked in tests/setup.ts.
   - What's unclear: Whether `crypto.subtle` works in the current vitest+jsdom setup without additional configuration.
   - Recommendation: Write a Wave 0 smoke test that exercises `EncryptedStorage.initialize()` and a round-trip `set→get`. If `crypto.subtle` is unavailable, consider `--experimental-global-webcrypto` Node flag or a `globalThis.crypto.subtle` mock.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vitest test runner, npm install | ✓ | v26.5.0 | — |
| npm | Package installation | ✓ | 11.17.0 | — |
| Chrome (for runtime) | chrome.storage.*, crypto.subtle, IndexedDB | — | N/A (runtime) | All are Chrome built-in APIs; no installation needed |
| `chrome` types | TypeScript compilation | ✓ | @types/chrome ^0.2.0 (installed) | — |
| Vitest | Test execution | ✓ | ^4.1.0 (installed) | — |
| jsdom | Test environment (DOM APIs) | ✓ | ^29.1.1 (installed) | — |
| `idb` package | IndexedDB operations | ✗ | — | Will be installed via `npm install idb@^8.0.3` |

**Missing dependencies with no fallback:**
- `idb` v8.0.3: Core IndexedDB dependency. Must be installed before implementation.

**Missing dependencies with fallback:**
- None — all other dependencies are either built-in browser APIs or already installed.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 |
| Config file | `./vitest.config.ts` (jsdom environment, tests/setup.ts) |
| Quick run command | `npx vitest run tests/core/storage/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STOR-01 | Split storage: message bodies in IndexedDB, metadata in chrome.storage.local | unit | `vitest run tests/core/storage/IndexedDBManager.test.ts` | ❌ Wave 0 |
| STOR-02 | AES-GCM round-trip: encrypt → persist → decrypt produces original key | unit | `vitest run tests/core/storage/EncryptedStorage.test.ts -t "encrypt-decrypt round-trip"` | ❌ Wave 0 |
| STOR-03 | WriteJournal recovery: interrupted multi-store operations replay consistently | unit/integration | `vitest run tests/core/storage/WriteJournal.test.ts -t "recovery"` | ❌ Wave 0 |
| STOR-04 | IndexedDB migration: v1 fixture → v2 fixture passes idempotently | integration | `vitest run tests/core/storage/IndexedDBMigrator.test.ts -t "idempotent"` | ❌ Wave 0 |
| STOR-05 | All DBs open with correct schema versions | integration | `vitest run tests/core/storage/IndexedDBManager.test.ts -t "schema"` | ❌ Wave 0 |
| STOR-06 | RateLimiter token bucket: capacity/refill behavior correct | unit | `vitest run tests/core/storage/RateLimiter.test.ts` | ❌ Wave 0 |
| STOR-07 | No message bodies or raw API keys in chrome.storage.local | unit/architecture | `vitest run tests/core/storage -t "no message bodies in local"` | ❌ Wave 0 |
| WRKSP-05 | Workspace persists across simulated page reload (re-mount) | integration | `vitest run tests/core/storage/workspaceStore.test.ts -t "persist"` | ❌ Wave 0 (existing test needs update) |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/storage/` (target < 5s for focused test)
- **Per wave merge:** `npx vitest run tests/core/` (full core test suite)
- **Phase gate:** `npx vitest run` (all tests green)

### Wave 0 Gaps
- [ ] `tests/core/storage/IndexedDBManager.test.ts` — covers IndexedDB open, schema creation, version upgrade (STOR-01, STOR-04, STOR-05)
- [ ] `tests/core/storage/EncryptedStorage.test.ts` — covers encrypt/decrypt round-trip, salt/IV uniqueness, initialization edge cases (STOR-02)
- [ ] `tests/core/storage/WriteJournal.test.ts` — covers journal entry lifecycle, recovery replay, idempotency check, pruning (STOR-03)
- [ ] `tests/core/storage/RateLimiter.test.ts` — covers token bucket acquire/refill, burst capacity, retryAfter calculation (STOR-06)
- [ ] Update `tests/core/storage/workspaceStore.test.ts` — verify chrome.storage.local persistence (was session), WriteJournal integration (WRKSP-05)
- [ ] Update `tests/core/storage/broadcastBus.test.ts` — verify WORKSPACE_UPDATED events, local area listener (WRKSP-05)
- [ ] `tests/setup.ts` — add `chrome.storage.local.getBytesInUse` mock, IndexedDB mock (or use `fake-indexeddb`)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Partial | API key encryption (STOR-02) — AES-GCM-256 with PBKDF2 key derivation. No user authentication (local extension). |
| V3 Session Management | No | No server-side sessions. Transient tokens in chrome.storage.session which clears on browser close. |
| V4 Access Control | No | Extension-scoped storage; chrome.storage is not accessible to web pages. Cross-extension access blocked by Chrome by default. |
| V5 Input Validation | Yes | Zod schemas for WriteJournalEntry, IndexedDBMigration descriptors, and EncryptedStorage metadata wrappers. Runtime validation before persistence. |
| V6 Cryptography | Yes | AES-GCM-256 via crypto.subtle (STOR-02). Per-key unique salt and IV. PBKDF2 with 100K iterations and SHA-256. No custom crypto. `np_install_secret` stored in chrome.storage.local (extension-scoped). |

### Known Threat Patterns for chrome.storage + IndexedDB + Web Crypto

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IV reuse in AES-GCM across encryption operations | Information Disclosure | `crypto.getRandomValues(new Uint8Array(12))` per encryption — never cache or reuse IVs |
| Malicious web page accessing chrome.storage via content script injection | Elevation of Privilege | chrome.storage is NOT accessible to web pages — only extension contexts. Content scripts use `chrome.runtime.sendMessage` to request data from extension pages. |
| IndexedDB data exposed via browser DevTools | Information Disclosure | Acceptable for v0.1 local-first extension. User controls DevTools access. Encrypted payloads require master key to decrypt. |
| WriteJournal entry tampering (malicious extension or compromised context) | Tampering | Extension contexts are sandboxed per Chrome's extension security model. Journal entry integrity relies on IndexedDB's consistency guarantees, not cryptographic signatures. |
| chrome.storage.local quota DoS (exhausting storage with garbage data) | Denial of Service | `getBytesInUse` monitoring, LRU eviction for metadata stores, pruning old journal entries. Not a critical threat for v0.1. |
| PBKDF2 key derivation timing side-channel | Information Disclosure | `crypto.subtle.deriveKey` is implemented in native code; constant-time for the key derivation step. The iteration count is public (100K). |

## Sources

### Primary (HIGH confidence)
- [/jakearchibald/idb Context7 docs] — `openDB` API, versioned upgrades, `DBSchema` interface, transaction modes, index creation, error handling
- [/mdn/content Context7 docs] — `crypto.subtle.deriveKey` (PBKDF2 → AES-GCM), `crypto.subtle.encrypt`/`decrypt` (AES-GCM with IV), `crypto.subtle.importKey` (raw key material)
- [/pmndrs/zustand Context7 docs] — `persist` middleware, `createJSONStorage` adapter, custom `StateStorage` implementation for IndexedDB/chrome.storage
- [npm registry] — `idb` v8.0.3 verified (17.5M weekly downloads, published 2025-05-07, git://github.com/jakearchibald/idb.git)

### Secondary (MEDIUM confidence)
- [CONTEXT.md Phase 2] — All locked decisions (D-01 through D-23) defining WriteJournal, EncryptedStorage, workspace persistence, and RateLimiter architecture
- [PRODUCT_SPEC_v0_1.md §15, §20] — Storage layout, IndexedDB schemas, WriteJournal operations, migration policy, WriteJournalEntry interface
- [PROJECT.md] — Core constraints: idb v8 requirement, MV3 IndexedDB restrictions, security requirements
- [Existing codebase: workspaceStore.ts, themeStore.ts, broadcastBus.ts] — Established Zustand persist patterns, chrome.storage adapter patterns, BroadcastBus architecture

### Tertiary (LOW confidence)
- [ASSUMED A1] PBKDF2 iteration count recommendation (100K with SHA-256) — based on training knowledge of OWASP 2023 guidance, not verified against current OWASP/NIST documentation in this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — `idb` v8.0.3 is the locked decision from PROJECT.md, verified on npm, documented on Context7. Web Crypto API is built-in and well-documented.
- Architecture: HIGH — All patterns derived from locked decisions in CONTEXT.md and verified against official library documentation. WriteJournal structure, EncryptedStorage design, and migration strategy are fully specified.
- Pitfalls: HIGH — Pitfalls derived from known IndexedDB, Web Crypto, and chrome.storage edge cases documented in official sources and the idb library's API surface.

**Research date:** 2026-07-12
**Valid until:** 2026-08-12 (30 days — stable domain)
