# Phase 2: Storage, Security, WriteJournal, Workspace Persistence - Context

**Gathered:** 2026-07-12
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the split-storage infrastructure for NowPilot: a single IndexedDB database (`nowpilot`) with object stores for all data domains (chat history, notes, memory, errors, transaction log, write journal), chrome.storage.local for metadata and encrypted API keys, chrome.storage.session for transient tokens and writer election, AES-GCM encrypted API key storage via EncryptedStorage, WriteJournal for multi-store consistency with idempotent recovery, IndexedDBMigrator for versioned schema migrations, and workspace state persistence across page reloads and cross-surface handoffs.
</domain>

<decisions>
## Implementation Decisions

### WriteJournal Architecture
- **D-01:** WriteJournal stores journal entries in a dedicated `write_journal` object store within the single `nowpilot` IndexedDB database.
- **D-02:** Recovery is hybrid — eager on startup (primary mechanism) + before first new write (safety guard) + lazy on read inconsistency (fallback/self-healing path). Only replay entries with status `pending` or `applying`. `failed` and `rolled-back` entries are kept for diagnostics.
- **D-03:** Idempotency is guaranteed via operation UUID per journal entry. On replay, check if the UUID already exists in the target store — skip if already applied.
- **D-04:** Entry status lifecycle: `pending` → `applying` → `completed` | `failed`.
- **D-05:** WriteJournal entries and data writes use separate IndexedDB transactions — journal entry committed first, then data write follows. If data write fails, journal entry is marked `failed`.
- **D-06:** Completed entries are auto-pruned after a retention window (7–30 days or last 1,000 entries). Pending, applying, failed, and rolled-back entries are retained indefinitely.

### IndexedDB Database Topology
- **D-07:** Single IndexedDB database named `nowpilot` containing separate object stores per domain: `chat_history`, `notes`, `memory`, `errors`, `transaction_log`, `write_journal`.
- **D-08:** Schema migrations use a single version counter with unified upgrades via `onUpgradeNeeded`. All object store schemas are checked/created/updated on version increment.
- **D-09:** IndexedDBMigrator supports versioned, idempotent migrations — running the same migration twice produces the same result.

### EncryptedStorage API Design
- **D-10:** EncryptedStorage is a transparent wrapper around `chrome.storage.local` — exposes the same `get`/`set`/`remove` API surface, encrypting and decrypting transparently. Works as a drop-in replacement.
- **D-11:** Master encryption key derivation: a random `np_install_secret` is generated once at installation and stored in `chrome.storage.local`. The AES-GCM key is derived via `PBKDF2(installSecret + extensionId, salt)` using `crypto.subtle.deriveKey`.
- **D-12:** Per-value encryption: each value gets a unique 16-byte random salt and 12-byte random IV via `crypto.getRandomValues()`. Both are stored alongside the ciphertext in a metadata wrapper object: `{ alg: 'AES-GCM', salt, iv, ciphertext }`.
- **D-13:** Key initialization: `EncryptedStorage.initialize()` is called at application startup to derive and cache the master key. A lazy auto-init fallback handles edge cases where `get`/`set` is called before init completes.
- **D-14:** Encryption algorithm: AES-GCM-256 via `crypto.subtle`. Per-key unique salt and IV — no key reuse across values.

### Workspace State Persistence
- **D-15:** WorkspaceStore switches from `chrome.storage.session` to `chrome.storage.local` (key: `np_workspace`) for durable persistence across reloads, browser restarts, and cross-surface handoffs.
- **D-16:** Primary writer election and heartbeats remain on `chrome.storage.session` (key: `np_workspace_primary`). Writer election scope does not change from Phase 1.
- **D-17:** All persistent WorkspaceStore updates route through WriteJournal: `setState()` creates a journal entry first → writes to `chrome.storage.local` → emits `WORKSPACE_UPDATED` via BroadcastBus → marks journal entry `completed`.
- **D-18:** Cross-surface sync: BroadcastBus is the primary mechanism (`WORKSPACE_UPDATED` events). `chrome.storage.local` provides durability and startup hydration. `chrome.storage.onChanged` serves as a fallback recovery mechanism for missed broadcasts or post-reload rehydration.
- **D-19:** WorkspaceState persists the full canonical schema now — including future-facing fields (`pinnedTabs`, `currentPageContext`, `selectedNotes`, `activeAddonContext`, `activeSkillRun`). Persistence is implemented in Phase 2; consumers arrive in later phases.

### RateLimiter Design & Scope
- **D-20:** RateLimiter uses the token bucket algorithm with configurable capacity and refill rate.
- **D-21:** Rate limit exceeded is signaled via a structured result object `{ allowed: boolean, retryAfter: number, remaining: number }`. Rate limiting is a normal operational outcome, not an exception. Callers decide whether to queue, retry, or notify.
- **D-22:** RateLimiter is a general-purpose core utility (`src/core/utils/RateLimiter.ts`). Any component (add-ons, MCP tools, PROXY_FETCH, ServiceNow clients, research tools) can instantiate a RateLimiter with its own config.
- **D-23:** RateLimiter state is in-memory only. Token bucket state resets on page reload or service worker restart. Sufficient for v0.1.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Scope
- `.planning/REQUIREMENTS.md` — WRKSP-05, STOR-01 through STOR-07 (lines 47–54). Full requirement traceability including storage split, encryption, WriteJournal, migrations.
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, dependency on Phase 1 (lines 90–104).

### Product Specification
- `.planning/PRODUCT_SPEC_v0_1.md` §15 — Full storage layout, IndexedDB schemas for ChatHistoryDB, NotesDB, MemoryDB, ErrorStore, WriteJournalDB, AITransactionLogDB (lines 1730–1771).
- `.planning/PRODUCT_SPEC_v0_1.md` §15.2 — EncryptedStorage design: PBKDF2 + AES-GCM-256 with per-key salt/IV (lines 1775–1783).
- `.planning/PRODUCT_SPEC_v0_1.md` §20.3 — WriteJournal operations list and `update-workspace` order (lines 2430–2451).
- `.planning/PRODUCT_SPEC_v0_1.md` §20.4 — IndexedDB migration policy and `IndexedDBMigration` interface (lines 2453–2467).
- `.planning/PRODUCT_SPEC_v0_1.md` — WriteJournalEntry interface with full type shape (lines 3401–3416).

### Architecture & Patterns
- `.planning/ARCHITECTURE.md` §15–16 — Workspace coordination, primary writer election protocol (lines 190–240).

### Project Context
- `.planning/PROJECT.md` — Core constraints: MV3 restrictions (no IndexedDB from background SW), security requirements (AES-GCM, TraceRedactor), package hygiene (idb v8, no direct provider SDKs).
- `.planning/STATE.md` — Session continuity, Phase 1 decisions carried forward.
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **WorkspaceStore** (`src/core/stores/workspaceStore.ts`): Current Zustand store with `persist` middleware + `createJSONStorage` adapter for `chrome.storage.session`. Phase 2 must switch to `chrome.storage.local` and route writes through WriteJournal.
- **ThemeStore** (`src/core/stores/themeStore.ts`): Reference implementation of Zustand persist to `chrome.storage.sync` — the `createJSONStorage` adapter pattern is reusable for EncryptedStorage.
- **providerStore** (`src/core/stores/providerStore.ts`): In-memory-only placeholder. API keys held in memory. Has a doc comment referencing Phase 2 EncryptedStorage — this store is the primary consumer of EncryptedStorage.
- **BroadcastBus** (`src/core/messaging/broadcastBus.ts`): Currently listens only to `chrome.storage.onChanged` for `areaName === 'session'`. Phase 2 must add `local` area listener for workspace sync fallback and emit `WORKSPACE_UPDATED` events.
- **debugLog** (`src/core/utils/debugLog.ts`): All Phase 2 modules must use this for logging. All catch blocks must call debugLog (HARD-09).

### Established Patterns
- **Zustand v5 stores**: `create()` + `persist()` with custom `createJSONStorage`. All stores accessed via `useXxxStore` hooks and `getState()`/`setState()` imperatively.
- **Class + singleton export**: Registry classes (`KeymapRegistry`, `SidePanelPageRegistry`, `StandalonePageRegistry`) follow this pattern — applicable to WriteJournal, EncryptedStorage, IndexedDBMigrator.
- **Chrome storage adapter**: `createJSONStorage(() => ({ getItem, setItem, removeItem }))` wrapping `chrome.storage.*` — the EncryptedStorage wrapper follows the same shape.
- **Direct path imports**: No barrel/index files. Modules import directly via relative paths.
- **Test patterns**: Vitest + jsdom, tests in `tests/core/`, `chrome.*` APIs mocked in `tests/setup.ts`. Storage tests will use `tests/core/storage/`.

### Integration Points
- **Background service worker** (`src/entrypoints/background.ts`): MV3 restrictions apply — no IndexedDB from background SW. Storage operations must happen in sidepanel/standalone contexts.
- **WorkspaceStore shape**: Current interface exports `WorkspaceState`. Phase 2 must extend it with `pinnedTabs`, `currentPageContext`, `selectedNotes`, `activeAddonContext`, `activeSkillRun`.
- **`np_` key prefix**: All chrome.storage keys use this convention. New keys for Phase 2: `np_workspace`, `np_install_secret`.
- **Chrome storage layout**: `chrome.storage.sync` has `np_theme`. `chrome.storage.session` has `nowpilot-workspace` (current). `chrome.storage.local` is unused — Phase 2 adds `np_workspace`, `np_install_secret`, and EncryptedStorage-managed keys.
</code_context>

<specifics>
## Specific Ideas

- WriteJournal entry status lifecycle: `pending` → `applying` → `completed` (or `failed`). Only `pending` and `applying` are replayed on recovery. `failed` and `rolled-back` are diagnostic-only.
- EncryptedStorage wrapper metadata shape: `{ alg: 'AES-GCM', salt: ArrayBuffer(16), iv: ArrayBuffer(12), ciphertext: ArrayBuffer }`.
- RateLimiter token bucket: configurable `capacity` (max tokens), `refillRate` (tokens per second), `refillInterval` (ms). Result object: `{ allowed, retryAfter, remaining }`.
- WorkspaceStore writes go through WriteJournal with operation type `update-workspace`.
- IndexedDB schema: single `nowpilot` DB, version starts at 1, increment on each migration.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.
</deferred>

---

*Phase: 2-Storage, Security, WriteJournal, Workspace Persistence*
*Context gathered: 2026-07-12*
