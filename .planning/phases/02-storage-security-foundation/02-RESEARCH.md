# Phase 2: Storage & Security Foundation - Research

**Researched:** 2026-07-29
**Domain:** Chrome Extension Storage Architecture, Web Cryptography, IndexedDB Migration, CSP
**Confidence:** HIGH

## Summary

Phase 2 is an infrastructure phase with no UI surface. It delivers four core services (`CryptoService`, `WriteJournal`, `MigrationRunner`) and five domain-specific Zustand stores (`ApiKeyStore`, `SessionStore`, `MessageStore`, `NotesStore`, `DiagnosticsStore`) that all downstream phases depend on. The encryption is transparent AES-GCM-256 derived from an install-scoped secret via PBKDF2 — no user passphrase in v0.1. Multi-store write consistency uses a WriteJournal with startup replay and lazy repair, following the spec's `pending → applying → completed/failed/rolled-back` lifecycle. IndexedDB migrations use idb ^8's native `upgrade()` callbacks v1→v4, with idempotency guaranteed by checking existing stores/indexes before creating.

The primary risks are: (a) `chrome.storage.session` availability in test environments (needs mock), (b) `crypto.subtle` not available in all jsdom configurations (needs polyfill or conditional skip), and (c) IndexedDB testing requires `fake-indexeddb` as a devDependency. The existing Chrome storage mock in `tests/setup.ts` covers `chrome.storage.local` but needs augmentation for `chrome.storage.session`. The existing BroadcastChannel mock covers inter-instance messaging for workspace updates.

**Primary recommendation:** Build CryptoService first (isolated, testable), then WriteJournal (depends on IndexedDB), then MigrationRunner, then wire all stores. Test AES-GCM round-trip with `crypto.subtle` in Vitest before integrating with Zustand stores.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| API key encryption/decryption | Extension Page (Side Panel/Full App) | — | Web Crypto (`crypto.subtle`) runs only in page contexts; background SW limited to messaging |
| Encrypted key persistence | chrome.storage.local | — | Spec-locked (§15.1): `chrome.storage.local` for config/keys; persists until extension removal |
| Session token storage | chrome.storage.session | — | Spec-locked: cleared on browser close; session-only sensitive data |
| Message body storage | IndexedDB (extension pages) | — | MV3 rule: NO IndexedDB in background SW; bodies too large for chrome.storage (10MB limit) |
| Workspace state | chrome.storage.local | BroadcastBus | Zustand persist + cross-surface sync via BroadcastBus; `np_workspace` key |
| Write consistency | IndexedDB (WriteJournalDB) | BroadcastBus | Journal entries in IndexedDB; workspace notifications via BroadcastBus |
| Schema migrations | IndexedDB (in-app, on openDB) | — | idb's `upgrade()` runs in page context; version bumps are deterministic |
| CSP enforcement | WXT manifest (wxt.config.ts) | Browser | Manifest-declared; enforced by Chrome at install time |

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Persist encrypted API keys in `chrome.storage.local` — one-way
- **D-02:** 32-byte install secret → PBKDF2(installSecret + extensionId, per-key-salt, 100000 iterations, SHA-256) → AES-GCM-256 key; cache derived key in `chrome.storage.session`
- **D-03:** No user passphrase in v0.1 — transparent encryption
- **D-04:** Domain-specific Zustand stores (ApiKeyStore, SessionStore, MessageStore, NotesStore, DiagnosticsStore)
- **D-05:** Shared services: CryptoService, MigrationRunner, WriteJournal
- **D-06:** WriteJournal: startup replay + lazy repair
- **D-07:** Journal lifecycle: pending → applying → completed (or failed/rolled-back)
- **D-08:** idb's native versioned upgrade handlers v1→v4
- **D-09:** No declarative migration framework — idb ^8 upgrade() callback is sufficient

### the agent's Discretion
No areas were deferred to the agent — all decisions were explicit.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STORAGE-01 | User's API keys are encrypted (AES-GCM), multi-store writes are consistent (WriteJournal), IndexedDB is migrated (v1→v4) | §CryptoService, §WriteJournal, §MigrationRunner |
| STORAGE-02 | User's session tokens are in chrome.storage.session, message bodies in IndexedDB, workspace state in chrome.storage.local | §Storage Store Topology, §3. chrome.storage.session |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `idb` | ^8.0.3 [VERIFIED: npm registry] | IndexedDB promise wrapper with typed upgrade callbacks | Author (Jake Archibald) is the IndexedDB spec editor; 22M weekly downloads; native `upgrade()` callback per version is exactly what D-08/D-09 require |
| `zustand` | ^5.0.14 [VERIFIED: npm registry] | State management with `persist` middleware | Already in Phase 1; persist middleware with custom `StateStorage` adapter is the pattern for all domain stores |
| `immer` | ^10.1.1 [VERIFIED: npm registry] | Immutable state updates within Zustand | Already in Phase 1; used by ThemeStore and WorkspaceStore; all new stores follow same pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `fake-indexeddb` | ^6.2.5 [VERIFIED: npm registry] | In-memory IndexedDB for test environments | Dev-only; needed because jsdom has no IndexedDB; install as devDependency; register in `tests/setup.ts` before idb tests run |

### NOT Using
| Library | Why Not |
|---------|---------|
| `idb-keyval` | Too simple — key-value only, no transactions, no versioning; idb provides full IndexedDB API |
| `dexie` | Declarative schema with version() chaining violates D-09 (no declarative framework); heavier than idb; idb is the spec-vetted minimal option |
| `localforage` | Abstracted storage backend; we need per-store type control (local vs session vs IndexedDB); adds abstraction layer we don't need |
| `crypto-js` / `sjcl` | JavaScript-based crypto libraries; Web Crypto API (`crypto.subtle`) is native, hardware-accelerated, and available in all Chrome extension contexts |

**Installation:**
```bash
npm install idb@^8.0.3
npm install --save-dev fake-indexeddb@^6.2.5
```

**Version verification:**
```bash
npm view idb version           # 8.0.3
npm view fake-indexeddb version # 6.2.5
npm view zustand version        # 5.0.14
```

**Note on WXT version:** The constraints document states WXT `^0.19`, but `package.json` specifies `^0.20.27` (verified). Research below uses 0.20.27 APIs.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| idb | npm | 11 yrs | 22M/wk | github.com/jakearchibald/idb | OK | Approved |
| fake-indexeddb | npm | 8 yrs | 1.7M/wk | github.com/dumbmatter/fakeIndexedDB | OK | Approved |
| zustand | npm | 6 yrs | 11M/wk | github.com/pmndrs/zustand | OK | Already installed (Phase 1) |

**Packages removed due to SLOP verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────┐
│                    Extension Pages                          │
│  (Side Panel HTML / Full App Tab HTML)                     │
│                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │ApiKeyStore│  │SessionSt.│  │MessageSt.│  │WorkspaceSt.│ │
│  │(zustand)  │  │(zustand) │  │(zustand)  │  │(zustand)   │ │
│  │persist:   │  │persist:  │  │persist:   │  │persist:    │ │
│  │local      │  │session   │  │idb        │  │local       │ │
│  └────┬──────┘  └────┬─────┘  └────┬──────┘  └─────┬──────┘ │
│       │              │             │                │       │
│       ▼              ▼             ▼                ▼       │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Service Layer (D-05)                   │    │
│  │  ┌─────────────┐ ┌────────────┐ ┌───────────────┐ │    │
│  │  │CryptoService│ │WriteJournal│ │MigrationRunner│ │    │
│  │  │ enc/dec     │ │ replay     │ │ idb upgrade() │ │    │
│  │  │ PBKDF2 key  │ │ lazy repair│ │ v1→v2→v3→v4   │ │    │
│  │  └──────┬──────┘ └─────┬──────┘ └───────┬───────┘ │    │
│  └─────────┼──────────────┼────────────────┼─────────┘    │
│            │              │                │              │
└────────────┼──────────────┼────────────────┼──────────────┘
             │              │                │
             ▼              ▼                ▼
┌────────────────────────────────────────────────────────┐
│                  Chrome Storage APIs                     │
│  ┌──────────────────┐  ┌──────────────────────┐        │
│  │chrome.storage.   │  │chrome.storage.       │        │
│  │local (10MB)      │  │session (10MB)        │        │
│  │np_install_secret │  │derived key cache     │        │
│  │np_workspace      │  │np_jsessionid         │        │
│  │np_providers (enc)│  │np_sysparm_ck         │        │
│  └──────────────────┘  └──────────────────────┘        │
│                                                        │
│  ┌──────────────────────────────────────┐              │
│  │         IndexedDB (extension pages)   │              │
│  │  ChatHistoryDB  MessagesDB            │              │
│  │  NotesDB         MemoryDB             │              │
│  │  WriteJournalDB  AITransactionLogDB   │              │
│  └──────────────────────────────────────┘              │
└────────────────────────────────────────────────────────┘
             │
             ▼
┌────────────────────────────────────────────────────────┐
│               Cross-Surface Communication                │
│  ┌──────────────────────────────────────────────┐       │
│  │  BroadcastBus (BroadcastChannel)              │       │
│  │  WORKSPACE_UPDATED after WriteJournal commit  │       │
│  └──────────────────────────────────────────────┘       │
└────────────────────────────────────────────────────────┘
```

### Data Flow: Encrypted API Key Write

```
User enters API key in Options (Phase 7)
  → ApiKeyStore.setKey(providerId, plaintextKey)
    → CryptoService.encrypt(plaintextKey)
      1. Get/install np_install_secret (32 random bytes in chrome.storage.local)
      2. Generate per-key random 16-byte salt + 12-byte IV
      3. Derive AES-256 key: PBKDF2(installSecret + extensionId, salt, 100000, SHA-256)
      4. Encrypt: crypto.subtle.encrypt({name:"AES-GCM", iv}, derivedKey, plaintextBuffer)
      5. Cache derived key in chrome.storage.session
    → Store in chrome.storage.local { [providerId]: { ciphertext, salt, iv } }
    → Return "stored"
```

### Data Flow: WriteJournal Multi-Store Commit

```
Operation: "update-workspace"
  1. Create WriteJournalEntry { status: 'pending', steps: [...] }
     → IndexedDB WriteJournalDB.entries.put(entry)
  2. Execute steps sequentially:
     a. Write chrome.storage.local.np_workspace
     b. (mark step 'completed')
  3. Emit BroadcastBus WORKSPACE_UPDATED
  4. Mark WriteJournalEntry { status: 'completed' }
     → IndexedDB WriteJournalDB.entries.put(entry)

Recovery on next init:
  1. getAll entries WHERE status NOT IN ('completed','failed','rolled-back')
  2. For each: replay remaining steps
  3. Mark completed or failed
```

### Recommended Project Structure

```
src/core/
├── storage/                    # NEW — Phase 2
│   ├── chromeStorageAdapter.ts # RELOCATED from src/core/theme/
│   ├── sessionStorageAdapter.ts# NEW — chrome.storage.session adapter
│   ├── CryptoService.ts        # NEW — AES-GCM encrypt/decrypt
│   ├── WriteJournal.ts         # NEW — multi-store consistency
│   ├── MigrationRunner.ts      # NEW — idb upgrade orchestrator
│   ├── ApiKeyStore.ts          # NEW — encrypted provider keys
│   ├── SessionStore.ts         # NEW — session tokens
│   ├── MessageStore.ts         # NEW — chat message bodies
│   ├── NotesStore.ts           # NEW — skeleton for Phase 5
│   └── DiagnosticsStore.ts     # NEW — skeleton for Phase 6
├── security/                   # NEW — Phase 2
│   └── redactSensitive.ts      # NEW — secret redaction patterns
├── theme/                      # MODIFIED — chromeStorageAdapter import path updated
│   ├── chromeStorageAdapter.ts # REMOVED (relocated)
│   └── ThemeStore.ts           # Modified import
└── workspace/
    └── WorkspaceStore.ts       # MODIFIED — switch from localStorage to chrome.storage.local
```

### Pattern 1: idb openDB with Versioned Upgrade Callbacks (D-08, D-09)

**What:** Each database version declares its own `upgrade()` step via idb's `openDB(name, version, { upgrade(db, oldVersion, newVersion, transaction) })`. The `oldVersion` parameter tells you the previous version — check `if (oldVersion < N)` to conditionally apply only the changes for version N.

**When to use:** All IndexedDB databases that need schema evolution (WriteJournalDB, ChatHistoryDB, NotesDB, MemoryDB, AITransactionLogDB).

**Example from idb official docs:**
```typescript
// Source: /jakearchibald/idb — openDB upgrade callback pattern [VERIFIED: Context7]
import { openDB, type IDBPDatabase } from 'idb';

const db = await openDB('WriteJournalDB', 1, {
  upgrade(db, oldVersion, newVersion, transaction) {
    // v1: Create initial stores
    if (oldVersion < 1) {
      db.createObjectStore('entries', { keyPath: 'id' });
    }
    // v2: Add an index
    if (oldVersion < 2) {
      const entries = transaction.objectStore('entries');
      entries.createIndex('by-status', 'status');
    }
    // v3: Add a new store
    if (oldVersion < 3) {
      db.createObjectStore('auditLog', { keyPath: 'id', autoIncrement: true });
    }
    // v4: Data migration — read from old store, write to new
    if (oldVersion < 4) {
      const oldStore = transaction.objectStore('entries');
      const items = await oldStore.getAll();
      // ...transform and write to new structure...
    }
  },
});
```

### Pattern 2: Zustand Store with Persist Middleware + Custom Storage Adapter

**What:** Domain store using `zustand/middleware.persist()` with `createJSONStorage()` wrapping a custom `StateStorage` adapter that implements `getItem`, `setItem`, `removeItem`. This is the established Phase 1 pattern from ThemeStore.

**When to use:** All domain-specific Zustand stores that persist state (ApiKeyStore, SessionStore, WorkspaceStore).

**Example (based on existing ThemeStore pattern):**
```typescript
// Pattern from src/core/theme/ThemeStore.ts [VERIFIED: codebase grep]
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { chromeStorageAdapter } from '../storage/chromeStorageAdapter';

export const useApiKeyStore = create<ApiKeyState>()(
  persist(
    immer((set, get) => ({
      // ... state and actions ...
    })),
    {
      name: 'np_api_keys',
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => ({
        // Only persist serializable data
        keys: state.keys,
      }),
    },
  ),
);
```

### Pattern 3: AES-GCM Encrypt/Decrypt with Web Crypto API

**What:** Use `crypto.subtle` to import a raw PBKDF2-derived key, then encrypt with `{name: "AES-GCM", iv: random12Bytes}`. The 12-byte IV must be stored alongside the ciphertext for decryption.

**When to use:** CryptoService.encrypt() and CryptoService.decrypt().

**Example (from MDN Web Crypto docs):**
```typescript
// Source: MDN SubtleCrypto.encrypt and SubtleCrypto.deriveKey [VERIFIED: MDN Web Docs]
// PBKDF2 key derivation
const keyMaterial = await crypto.subtle.importKey(
  'raw',
  new TextEncoder().encode(installSecret + extensionId),
  'PBKDF2',
  false,
  ['deriveKey'],
);

const derivedKey = await crypto.subtle.deriveKey(
  {
    name: 'PBKDF2',
    salt: perKeySalt,        // 16 random bytes
    iterations: 100000,
    hash: 'SHA-256',
  },
  keyMaterial,
  { name: 'AES-GCM', length: 256 },
  false,                     // non-extractable
  ['encrypt', 'decrypt'],
);

// Encryption
const iv = crypto.getRandomValues(new Uint8Array(12));
const ciphertext = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  derivedKey,
  plaintextBuffer,
);

// Decryption
const plaintext = await crypto.subtle.decrypt(
  { name: 'AES-GCM', iv },  // same IV used for encryption
  derivedKey,
  ciphertext,
);
```

### Pattern 4: WriteJournal Startup Replay Algorithm

**What:** On application init, open WriteJournalDB, scan for non-terminal entries, replay their steps sequentially, and mark them completed or failed.

**When to use:** Every app startup (side panel + full app). Implement as an init function called before any store reads.

**Pseudocode:**
```typescript
// Based on spec §20.3 + D-06 [CITED: PRODUCT_SPEC_v0_1.md §20.3]
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
      // Replay each step that is not yet 'completed'
      for (const step of entry.steps) {
        if (step.status !== 'completed') {
          await executeStep(step);  // operation-specific logic
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

### Anti-Patterns to Avoid

- **Declarative schema with Dexie:** Violates D-09; idb's `upgrade()` is the spec-mandated approach
- **Inlining crypto in stores:** CryptoService must be a standalone service (D-05); stores delegate, never import `crypto.subtle` directly
- **chrome.storage.local for large binary data:** 10MB limit; IndexedDB is the correct backend for message bodies
- **Background SW IndexedDB:** MV3 services workers cannot open IndexedDB; all idb operations must be in extension pages (side panel / full app)
- **Skipping IV storage:** AES-GCM requires the same IV for decryption; always store `{ ciphertext, iv, salt }` as a tuple
- **Using navigator.userAgent in key derivation:** User agent changes on browser update; use `chrome.runtime.id` (extensionId) as spec requires (D-02)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB Promise wrapper | Custom IDB wrapper | `idb` ^8 (jakearchibald/idb) | Native `upgrade()` callbacks, typed transactions, handles `blocked`/`terminated` edge cases; 22M weekly downloads |
| AES-GCM encryption | Custom crypto implementation | Web Crypto API (`crypto.subtle`) | Hardware-accelerated, battle-tested, available in all Chrome contexts; custom crypto is a security liability |
| PBKDF2 key derivation | Manual HMAC iteration | `crypto.subtle.deriveKey({name:"PBKDF2", ...})` | Correct salt handling, constant-time comparison, side-channel resistant; Web Crypto is the standard |
| Random bytes generation | `Math.random()` | `crypto.getRandomValues()` | Cryptographically secure PRNG required for IV and salt; `Math.random()` is not suitable for crypto |
| Write-ahead log | Build from scratch | IndexedDB + WriteJournal pattern | IndexedDB provides ACID transactions; WriteJournal adds the recovery layer on top |
| Cross-surface state sync | Custom postMessage | BroadcastBus + BroadcastChannel | Phase 1 established pattern; WriteJournal integrates with WORKSPACE_UPDATED events |
| String → ArrayBuffer conversion | Manual byte manipulation | `TextEncoder().encode()` / `TextDecoder().decode()` | UTF-8 safe, handles multi-byte characters correctly |

**Key insight:** Every problem in this phase has a well-established standard solution. The security risks of hand-rolling crypto (AES-GCM, PBKDF2) are existential — a single mistake in IV reuse or key derivation invalidates the entire security model. Use the platform APIs.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + test | ✓ | v26.5.0 | — |
| npm | Package management | ✓ | 11.17.0 | — |
| WXT | Extension build | ✓ | 0.20.27 | — |
| Vitest | Test runner | ✓ | ^3.0.0 | — |
| idb (npm) | IndexedDB operations | ✗ | — | Must install: `npm install idb@^8.0.3` |
| fake-indexeddb (npm) | IndexedDB testing | ✗ | — | Must install: `npm install --save-dev fake-indexeddb@^6.2.5` |
| Chrome (for extension testing) | Runtime verification | — | — | Manual loading of unpacked extension; no automated E2E required in Phase 2 |
| crypto.subtle (in jsdom) | Encryption tests | ⚠ | — | jsdom may not expose `crypto.subtle` in all configurations; use vitest environment config or conditional skip with `it.skipIf(!globalThis.crypto?.subtle)` |

**Missing dependencies with no fallback:**
- `idb` — blocks all IndexedDB work (WriteJournal, MigrationRunner, MessageStore, NotesStore, DiagnosticsStore)

**Missing dependencies with fallback:**
- `fake-indexeddb` — test-only; IndexedDB tests can be skipped in CI if unavailable, but strongly recommended for local dev

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Phase 2 has no user auth — API keys are config, not authentication |
| V3 Session Management | Yes (partial) | Session tokens in `chrome.storage.session` (cleared on browser close); CSP restricts script sources |
| V4 Access Control | No | No multi-user or role-based access in v0.1 |
| V5 Input Validation | Yes | Validation of API key format, WriteJournal entry schema, migration state via zod (if used) or type guards |
| V6 Cryptography | Yes | AES-GCM-256 via Web Crypto API; PBKDF2 key derivation with 100,000 iterations; 16-byte random salt per key; 12-byte random IV per encryption |

### Known Threat Patterns for Chrome Extension Storage

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exposure via `chrome.storage.local` inspection by other extensions | Information Disclosure | AES-GCM-256 encryption at rest; install-scoped secret unique per extension instance; other extensions cannot read `chrome.storage.local` of different extension IDs |
| Session token theft from disk persistence | Information Disclosure | `chrome.storage.session` clears on browser close; never persists to disk |
| Replay of stale journal entries | Tampering | WriteJournal replay validates entry timestamps; failed entries marked and not replayed infinitely (attempt counter) |
| CSP bypass for data exfiltration | Information Disclosure | CSP `connect-src` restricts outbound connections; `script-src 'self'` prevents inline script injection |
| Weak randomness in crypto | Elevation of Privilege | `crypto.getRandomValues()` for salt/IV generation; never `Math.random()` |
| Key derivation brute force | Elevation of Privilege | 100,000 PBKDF2 iterations; 32-byte install secret (256 bits of entropy); per-key salt prevents rainbow table attacks |

### Encryption Contract (Locked by D-01, D-02)

The following are published interfaces — changing them breaks existing installations:

```
STORED IN chrome.storage.local:
  np_install_secret  → Uint8Array(32)   // generated once, never changes
  np_providers       → Array<{          // encrypted per provider
    providerId: string,
    ciphertext: ArrayBuffer,           // AES-GCM output
    salt: Uint8Array(16),              // per-key PBKDF2 salt
    iv: Uint8Array(12),                // per-encryption IV
  }>

KEY CACHE IN chrome.storage.session:
  np_derived_key_{providerId}  → CryptoKey (non-extractable)
```

### CSP Configuration (wxt.config.ts)

**Current CSP** (from existing `wxt.config.ts`):
```json
{
  "extension_pages": "script-src 'self'; object-src 'self'; connect-src http://localhost:* https://generativelanguage.googleapis.com https://api.anthropic.com https://api.openai.com"
}
```

**Required minimum CSP for MV3 extensions** [VERIFIED: Chrome Extensions docs]:
```
script-src 'self' 'wasm-unsafe-eval'; object-src 'self'
```

**Phase 2 CSP recommendations:**
- The current CSP is adequate for Phase 2 (no AI providers called yet)
- Phase 3 will need to add connect-src entries for Ollama (localhost), OpenAI-compatible endpoints (user-configured URLs)
- Phase 3 may need `connect-src *` for arbitrary OpenAI-compatible endpoints (as spec §16.3 suggests)
- **Phase 2 action:** Document that CSP is configured in `wxt.config.ts` → `manifest.content_security_policy.extension_pages` and should be revised in Phase 3. No CSP changes needed in Phase 2 beyond what already exists.

**CSP reporting:** Not implemented in v0.1 — `report-uri` directive requires a report endpoint which NowPilot does not have. CSP violations will log to the extension's console only.

## Testing Strategy

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.0 |
| Environment | jsdom |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/core/storage` |
| Full suite command | `pnpm run test` |

### Test Infrastructure Enhancements Needed

1. **fake-indexeddb registration** in `tests/setup.ts`:
```typescript
// Add to tests/setup.ts before any idb-dependent tests
import 'fake-indexeddb/auto';
```

2. **chrome.storage.session mock** in `tests/setup.ts` (currently only `.local` is mocked):
```typescript
// Mirror the existing chrome.storage.local mock pattern
const sessionStorage = new Map<string, string>();
const chromeStorageSession = {
  get: vi.fn(/* same pattern as local mock */),
  set: vi.fn(/* same pattern as local mock */),
  remove: vi.fn(/* same pattern as local mock */),
};
(globalThis as any).chrome.storage.session = chromeStorageSession;
```

3. **crypto.subtle availability**: jsdom may not expose `crypto.subtle`. For CryptoService tests, use:
```typescript
// In vitest config or setup
if (!globalThis.crypto?.subtle) {
  // Skip crypto tests or use native Node.js crypto
  // Node 26+ has globalThis.crypto.subtle available
}
```

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STORAGE-01 | API key AES-GCM encrypt/decrypt round-trip | unit | `vitest run tests/core/storage/CryptoService.test.ts` | ❌ Wave 0 |
| STORAGE-01 | WriteJournal replay recovers crashed writes | integration | `vitest run tests/core/storage/WriteJournal.test.ts` | ❌ Wave 0 |
| STORAGE-01 | IndexedDB migrates v1→v4 idempotently | integration | `vitest run tests/core/storage/MigrationRunner.test.ts` | ❌ Wave 0 |
| STORAGE-02 | Session tokens only in chrome.storage.session | unit | `vitest run tests/core/storage/SessionStore.test.ts` | ❌ Wave 0 |
| — | WorkspaceStore persists via chrome.storage.local | unit | `vitest run tests/core/workspace/WorkspaceStore.test.ts` | ✅ P1 (needs update) |
| — | Workspace state survives page reload | integration | `vitest run tests/core/workspace/WorkspacePersistence.test.ts` | ❌ Wave 0 |
| — | CSP does not block extension loading | smoke | Manual: `wxt build && load unpacked in Chrome` | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/storage --reporter=verbose`
- **Per wave merge:** `pnpm run verify:phase-2`
- **Phase gate:** Full verify:phase-2 green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/storage/CryptoService.test.ts` — covers AES-GCM round-trip, PBKDF2 derivation, error handling
- [ ] `tests/core/storage/WriteJournal.test.ts` — covers startup replay, lazy repair, crash recovery
- [ ] `tests/core/storage/MigrationRunner.test.ts` — covers v1→v4 migration, idempotency, fixture databases
- [ ] `tests/core/storage/SessionStore.test.ts` — covers session storage lifecycle
- [ ] `tests/core/storage/ApiKeyStore.test.ts` — covers encrypted store + decrypt integration
- [ ] `tests/core/workspace/WorkspacePersistence.test.ts` — covers cross-reload workspace state
- [ ] `tests/core/security/redactSensitive.test.ts` — covers TraceRedactor patterns
- [ ] `tests/setup.ts` — add `chrome.storage.session` mock, register `fake-indexeddb/auto`
- [ ] Framework install: `npm install --save-dev fake-indexeddb@^6.2.5`

## Code Examples

### CryptoService: Full Encrypt/Decrypt Implementation

```typescript
// Based on MDN SubtleCrypto docs [VERIFIED: MDN Web Docs]
// and PRODUCT_SPEC_v0_1.md §15.2 [CITED: spec §15.2]

export class CryptoService {
  private readonly INSTALL_SECRET_KEY = 'np_install_secret';
  private readonly SESSION_CACHE_PREFIX = 'np_derived_key_';

  /** Get or create the install secret (generated once, persisted forever) */
  async getInstallSecret(): Promise<Uint8Array> {
    const result = await chrome.storage.local.get(this.INSTALL_SECRET_KEY);
    if (result[this.INSTALL_SECRET_KEY]) {
      // stored as base64 in chrome.storage (only supports JSON-serializable values)
      return this.base64ToBytes(result[this.INSTALL_SECRET_KEY] as string);
    }
    const secret = crypto.getRandomValues(new Uint8Array(32));
    await chrome.storage.local.set({
      [this.INSTALL_SECRET_KEY]: this.bytesToBase64(secret),
    });
    return secret;
  }

  /** Derive AES-256 key from install secret + extensionId + per-key salt */
  async deriveKey(salt: Uint8Array): Promise<CryptoKey> {
    const installSecret = await this.getInstallSecret();
    const extensionId = chrome.runtime.id;
    const combined = new TextEncoder().encode(
      this.bytesToBase64(installSecret) + extensionId
    );

    const keyMaterial = await crypto.subtle.importKey(
      'raw', combined, 'PBKDF2', false, ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable
      ['encrypt', 'decrypt'],
    );
  }

  /** Encrypt plaintext with a per-key random salt and IV */
  async encrypt(plaintext: string): Promise<{
    ciphertext: ArrayBuffer;
    salt: Uint8Array;
    iv: Uint8Array;
  }> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(salt);
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv }, key, encoded
    );
    return { ciphertext, salt, iv };
  }

  /** Decrypt ciphertext using stored salt and IV */
  async decrypt(
    ciphertext: ArrayBuffer,
    salt: Uint8Array,
    iv: Uint8Array,
  ): Promise<string> {
    const key = await this.deriveKey(salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv }, key, ciphertext
    );
    return new TextDecoder().decode(decrypted);
  }

  private bytesToBase64(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
```

### WriteJournalEntry Schema

```typescript
// Source: PRODUCT_SPEC_v0_1.md §20.3 + data models [CITED: spec]
export type WriteJournalOperation =
  | 'append-memory-message'
  | 'evict-conversation'
  | 'archive-conversation'
  | 'compact-conversation'
  | 'save-note-with-links'
  | 'update-user-memory'
  | 'export-data'
  | 'update-workspace';

export type WriteJournalStatus =
  | 'pending'
  | 'applying'
  | 'completed'
  | 'failed'
  | 'rolled-back';

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

### MigrationRunner: Version Step Isolation

```typescript
// Based on idb official docs [VERIFIED: Context7 /jakearchibald/idb]
export class MigrationRunner {
  async migrate(dbName: string, targetVersion: number): Promise<void> {
    const db = await openDB(dbName, targetVersion, {
      upgrade(db, oldVersion, newVersion, transaction) {
        // v1: initial schema
        if (oldVersion < 1) {
          this.createV1Schema(db);
        }
        // v2: add indexes
        if (oldVersion < 2) {
          this.createV2Indexes(transaction);
        }
        // v3: add new store
        if (oldVersion < 3) {
          this.createV3Stores(db);
        }
        // v4: data migration + new store
        if (oldVersion < 4) {
          this.migrateV4(transaction);
        }
      },
    });
  }

  private createV1Schema(db: IDBPDatabase): void {
    if (!db.objectStoreNames.contains('entries')) {
      db.createObjectStore('entries', { keyPath: 'id' });
    }
  }

  private createV2Indexes(tx: IDBPTransaction): void {
    const store = tx.objectStore('entries');
    if (!store.indexNames.contains('by-status')) {
      store.createIndex('by-status', 'status');
    }
  }
  // ... etc
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `localStorage` for extension state | `chrome.storage.local` with storage adapter | Phase 1 | WorkspaceStore migration in this phase |
| `dexie` for IndexedDB | `idb` ^8 with native `upgrade()` callbacks | Now | D-09 prohibits declarative frameworks; idb is lighter |
| Manual crypto implementation | Web Crypto API (`crypto.subtle`) | Now | Hardware-accelerated, side-channel resistant |
| No write consistency for multi-store ops | WriteJournal with startup replay + lazy repair | Now | Crash recovery for cross-store operations |
| No versioned migrations | idb `upgrade()` per version | Now | Schema evolution without data loss |

**Deprecated/outdated:**
- `localStorage` for workspace state: being migrated to `chrome.storage.local` in this phase
- `Math.random()` for any security-sensitive operation: use `crypto.getRandomValues()`

## Common Pitfalls

### Pitfall 1: chrome.storage.local JSON Serialization for Binary Data
**What goes wrong:** `chrome.storage.local` only stores JSON-serializable values. `ArrayBuffer` and `Uint8Array` cannot be stored directly — they must be base64-encoded to strings. Forgetting this causes silent data loss (values become `{}` or `null`).
**Why it happens:** Developers assume `chrome.storage.local` supports the same types as `localStorage`, but it uses `JSON.stringify` internally.
**How to avoid:** Always encode binary data (ciphertext, salt, IV) as base64 strings before calling `chrome.storage.local.set()`. Decode on retrieval. Use `btoa`/`atob` with binary-safe conversion (see `bytesToBase64`/`base64ToBytes` in Code Examples).
**Warning signs:** Decryption returns `OperationError` or garbled output; stored values appear as `"{}"` in DevTools storage inspector.

### Pitfall 2: IndexedDB in Background Service Worker
**What goes wrong:** Attempting to open an IndexedDB database from the background service worker fails silently or throws. MV3 service workers have no IndexedDB access.
**Why it happens:** MV3 replaces persistent background pages with ephemeral service workers that lack many DOM APIs, including IndexedDB.
**How to avoid:** All IndexedDB operations (WriteJournal, MigrationRunner, MessageStore) must run in extension page contexts (side panel HTML, full app tab HTML). The background SW communicates via messaging only. The codebase must never import `idb` or call `openDB()` in `src/entrypoints/background.ts`.
**Warning signs:** Build succeeds but IndexedDB calls in background SW produce no data; `'indexedDB' in self` returns `false` in SW context.

### Pitfall 3: crypto.subtle Unavailable in jsdom/Vitest
**What goes wrong:** Tests that call `crypto.subtle.encrypt()` or `crypto.subtle.deriveKey()` fail with `TypeError: Cannot read properties of undefined` because jsdom does not provide Web Crypto.
**Why it happens:** jsdom simulates a browser DOM but does not include the full Web Crypto API. Some Node.js versions expose `globalThis.crypto.subtle`, but others do not.
**How to avoid:** Node.js 19+ exposes `globalThis.crypto.subtle`. For Node 26 (confirmed in environment), this should work. If not, use vitest's `pool: 'forks'` or add a conditional skip: `it.skipIf(!globalThis.crypto?.subtle, 'crypto.subtle not available')`.
**Warning signs:** `TypeError: globalThis.crypto.subtle is undefined` in test output.

### Pitfall 4: WriteJournal Step Ordering vs. Atomicity
**What goes wrong:** A crash between writing to chrome.storage.local and emitting the BroadcastBus event leaves stores inconsistent — data exists in storage but no other surface knows about it.
**Why it happens:** chrome.storage.local writes are atomic per-key, but multi-step WriteJournal operations are not automatically atomic across stores.
**How to avoid:** The WriteJournal replay algorithm handles this on next startup. The steps array records which steps completed. On replay, only incomplete steps are re-executed. For `update-workspace`, the BroadcastBus event is step 3 — if it wasn't emitted, replay emits it.
**Warning signs:** Workspace state differs between side panel and full app after page reload; `WORKSPACE_UPDATED` events missing.

### Pitfall 5: idb upgrade() Blocked by Open Connections
**What goes wrong:** `openDB()` with a higher version number hangs indefinitely if another tab has the same database open at an older version.
**Why it happens:** IndexedDB locks the schema version. A new version cannot open until all connections to the old version are closed.
**How to avoid:** Use the `blocked` and `blocking` callbacks in idb's `openDB()`. The `blocked` callback fires when this connection is waiting; the `blocking` callback fires on the old connection when a new version wants to open. In the `blocking` callback, close the database to allow the upgrade. This is an edge case in Chrome extensions (typically one page context at a time), but should be handled for correctness.
**Warning signs:** `openDB()` never resolves; DevTools shows "pending" connections in Application → IndexedDB.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `globalThis.crypto.subtle` is available in Node.js 26's jsdom environment for Vitest | Testing Strategy | Crypto tests fail in CI; need to add explicit polyfill or skip |
| A2 | `chrome.storage.session` is available in Chrome 102+ (released May 2022) and is safe to use as the sole session backend | Standard Stack, Storage Store Topology | Older Chrome versions won't have session storage; fallback to `chrome.storage.local` with TTL would be needed |
| A3 | `idb` ^8.0.3 is API-compatible with the `openDB()` patterns shown in documentation and will be the version installed | Standard Stack | Minor API changes between 8.0.x patches could cause type issues; pin to exact version |
| A4 | `chrome.runtime.id` is stable across extension reloads during development | CryptoService (D-02) | Key derivation would produce different keys after reload, making existing encrypted data unreadable; verify this before implementation |
| A5 | `localStorage` fallback in current `chromeStorageAdapter` is acceptable to keep for non-Chrome dev environments | Storage Store Topology | If localStorage fallback is removed, dev mode without Chrome APIs breaks; keep the fallback |
| A6 | The existing `chrome.storage.local` mock in `tests/setup.ts` is sufficient for all chrome.storage.local tests with Zustand persist | Testing Strategy | Some edge cases (quota exceeded, storage corruption) won't be testable without a more complete mock |

## Open Questions

1. **chrome.runtime.id stability across development reloads**
   - What we know: D-02 specifies `extensionId` as part of the PBKDF2 input. `chrome.runtime.id` is deterministic in production (based on extension key) but changes on every unpacked load in development unless a `key` is specified in manifest.json.
   - What's unclear: Whether WXT handles this automatically or if we need to pin the extension ID in `wxt.config.ts`.
   - Recommendation: Test with `wxt build` → load unpacked → reload → verify `chrome.runtime.id` is stable. If not, add a fixed `key` field in manifest. Document this as a development setup requirement.

2. **crypto.subtle availability in all Vitest environments**
   - What we know: Node 26+ exposes `globalThis.crypto.subtle`. The test environment is jsdom via vitest.
   - What's unclear: Whether vitest's jsdom integration preserves `globalThis.crypto.subtle` from Node.js or overrides it.
   - Recommendation: Write a quick smoke test first: `expect(globalThis.crypto?.subtle).toBeDefined()`. If it fails, install `@peculiar/webcrypto` or use vitest's `globalSetup` to polyfill.

3. **IndexedDB quota limits in Chrome extensions**
   - What we know: Chrome extensions can use `"unlimitedStorage"` permission for unlimited IndexedDB. The current manifest does not include this.
   - What's unclear: Whether the default quota (~60% of disk or ~2GB) is sufficient for ChatHistoryDB + NotesDB + MemoryDB.
   - Recommendation: Add `"unlimitedStorage"` to manifest permissions now to avoid quota issues in Phase 5+.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.0 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run tests/core/storage tests/core/security tests/core/workspace/WorkspacePersistence.test.ts` |
| Full suite command | `pnpm run verify:phase-2` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STORAGE-01 | AES-GCM encrypt/decrypt round-trip | unit | `npx vitest run tests/core/storage/CryptoService.test.ts -t "round-trip"` | ❌ Wave 0 |
| STORAGE-01 | WriteJournal replay recovers crashed writes | integration | `npx vitest run tests/core/storage/WriteJournal.test.ts -t "replay"` | ❌ Wave 0 |
| STORAGE-01 | WriteJournal lazy repair on record access | integration | `npx vitest run tests/core/storage/WriteJournal.test.ts -t "lazy repair"` | ❌ Wave 0 |
| STORAGE-01 | IndexedDB migrates v1→v4 idempotently | integration | `npx vitest run tests/core/storage/MigrationRunner.test.ts -t "idempotent"` | ❌ Wave 0 |
| STORAGE-01 | ApiKeyStore encrypts on set, decrypts on get | integration | `npx vitest run tests/core/storage/ApiKeyStore.test.ts -t "encrypted"` | ❌ Wave 0 |
| STORAGE-02 | SessionStore persists only to chrome.storage.session | unit | `npx vitest run tests/core/storage/SessionStore.test.ts -t "session"` | ❌ Wave 0 |
| STORAGE-02 | WorkspaceStore persists via chrome.storage.local | integration | `npx vitest run tests/core/workspace/WorkspaceStore.test.ts -t "persist"` | ✅ P1 (needs update to use adapter) |
| STORAGE-02 | Workspace state survives page reload | integration | `npx vitest run tests/core/workspace/WorkspacePersistence.test.ts -t "reload"` | ❌ Wave 0 |
| SEC (implied) | CSP blocks inline scripts | smoke | Manual: Inspect extension in `chrome://extensions`, verify CSP header | N/A |
| SEC (implied) | No plaintext API keys in chrome.storage.local | unit | `npx vitest run tests/core/storage/ApiKeyStore.test.ts -t "no plaintext"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/core/storage --reporter=verbose`
- **Per wave merge:** `pnpm run verify:phase-2`
- **Phase gate:** Full verify:phase-2 green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/storage/CryptoService.test.ts` — AES-GCM round-trip, PBKDF2 derivation, error handling
- [ ] `tests/core/storage/WriteJournal.test.ts` — startup replay, lazy repair, crash recovery, multi-step atomicity
- [ ] `tests/core/storage/MigrationRunner.test.ts` — v1→v4 migration, idempotency (run twice), fixture database setup
- [ ] `tests/core/storage/ApiKeyStore.test.ts` — encrypted store integration, decrypt-on-read
- [ ] `tests/core/storage/SessionStore.test.ts` — session storage lifecycle
- [ ] `tests/core/workspace/WorkspacePersistence.test.ts` — cross-reload state, chrome.storage.local adapter
- [ ] `tests/core/security/redactSensitive.test.ts` — secret redaction patterns
- [ ] `tests/setup.ts` — add `chrome.storage.session` mock, register `fake-indexeddb/auto`
- [ ] `tests/core/storage/chromeStorageAdapter.test.ts` — existing adapter tests (currently in ThemeStore test, should be separate)
- [ ] Framework install: `npm install --save-dev fake-indexeddb@^6.2.5`

## Sources

### Primary (HIGH confidence)
- [Context7 /jakearchibald/idb] — openDB API, upgrade callbacks, versioned schema, transactions, getAll, deleteDB
- [MDN SubtleCrypto.encrypt()] — AES-GCM encrypt/decrypt with 12-byte IV, Web Crypto API
- [MDN SubtleCrypto.deriveKey()] — PBKDF2 key derivation with salt, iterations, hash
- [MDN SubtleCrypto.importKey()] — Raw key import for PBKDF2 key material
- [Context7 /websites/developer_chrome_extensions] — chrome.storage.local, chrome.storage.session, CSP manifest configuration
- [Context7 /pmndrs/zustand] — persist middleware, StateStorage interface, createJSONStorage
- [PRODUCT_SPEC_v0_1.md §15.1, §15.2, §16, §20.3, §20.4] — Storage topology, encryption algorithm, CSP, WriteJournal schema, migration policy
- [Existing codebase: src/core/theme/chromeStorageAdapter.ts, ThemeStore.ts, BroadcastBus.ts, WorkspaceStore.ts] — Established patterns

### Secondary (MEDIUM confidence)
- [npm registry: idb v8.0.3, fake-indexeddb v6.2.5, zustand v5.0.14] — Version verification
- [package.json] — WXT 0.20.27 (not 0.19 as stated in constraints), existing dependencies

### Tertiary (LOW confidence)
- [ASSUMED] `chrome.runtime.id` is stable across development reloads in WXT — needs verification
- [ASSUMED] Node 26's jsdom exposes `crypto.subtle` — needs smoke test

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — All libraries verified on npm registry with official docs; idb is a mature package (11 yrs, 22M/wk)
- Architecture: HIGH — Patterns directly from Context7 docs (idb, Zustand), MDN (Web Crypto), and Chrome Extensions docs
- Pitfalls: HIGH — Based on documented MV3 constraints, Chrome storage limitations, and crypto best practices
- Testing: MEDIUM — crypto.subtle availability in jsdom needs verification; IndexedDB mock setup needs validation

**Research date:** 2026-07-29
**Valid until:** 2026-08-29 (stable domain — storage APIs and crypto standards change slowly)




