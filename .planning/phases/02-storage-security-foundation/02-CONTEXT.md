# Phase 2: Storage & Security Foundation - Context

**Gathered:** 2026-07-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver encrypted API key storage (AES-GCM with install-scoped secrets), consistent multi-store writes via WriteJournal with startup replay + lazy repair recovery, idempotent IndexedDB migrations (v1→v4), and CSP enforcement. This is an infrastructure phase — no UI surface, no user-facing features. All decisions are about data architecture and security patterns that Phase 3 (AI Pipeline), Phase 5 (Notes), and Phase 6 (Diagnostics) will build on.
</domain>

<decisions>
## Implementation Decisions

### API Key Encryption
- **D-01:** Persist encrypted API keys in `chrome.storage.local` — **Reversibility:** one-way — changing the encryption format after Phase 3+ consumes it requires re-encrypting all stored keys for every user; the `np_install_secret` key name and the derived-key algorithm are published contracts.
- **D-02:** Generate one random 32-byte install secret (`np_install_secret`) in `chrome.storage.local` on first run; derive the AES-GCM-256 key via `PBKDF2(installSecret + extensionId, per-key-salt, 100000 iterations, SHA-256)` for each API key independently; cache the derived key at runtime in `chrome.storage.session` — **Reversibility:** costly — changing the derivation parameters (iteration count, hash) would require a re-derivation pass over all stored keys.
- **D-03:** No user passphrase required in v0.1. Encryption is transparent to the user — keys are protected against casual `localStorage` inspection by other extensions without adding UX friction.

### Storage Store Topology
- **D-04:** Domain-specific Zustand stores (`ApiKeyStore`, `SessionStore`, `MessageStore`, `NotesStore`, `DiagnosticsStore`) each owning their own persist configuration — **Reversibility:** costly — every downstream phase will create its store following this pattern; changing to a unified monolith would require refactoring every store and all consumers.
- **D-05:** Shared service layer beneath the stores: `CryptoService` (encrypt/decrypt), `MigrationRunner` (IndexedDB version upgrades), `WriteJournal` (multi-store consistency). Zustand stores delegate to services rather than duplicating logic.

### WriteJournal Recovery
- **D-06:** Use startup replay + lazy repair strategy: replay incomplete transactions on app init to detect and recover crashed writes, then validate journal state on record access as a secondary safety net — **Reversibility:** one-way — the `WriteJournalEntry` schema (id, operation, status, steps, timestamps) is the persistence contract for multi-store consistency; every future storage operation that spans stores must comply with this protocol.
- **D-07:** Journal entries follow the product spec lifecycle: `pending` → `applying` → `completed` (or `failed`/`rolled-back`). Recovery replays any entry not in a terminal state.

### IndexedDB Migrations
- **D-08:** Use idb's native versioned upgrade handlers (v1→v2→v3→v4), each handler responsible only for the schema changes introduced in that version — **Reversibility:** one-way — the DB schema version numbers are a contract; skipping or reordering versions would break the idb upgrade path for existing installations.
- **D-09:** No declarative migration framework — `idb ^8`'s built-in `upgrade()` callback per version is sufficient for schema-only migrations with no existing production data. Test each version step with fixture databases.

### the agent's Discretion
No areas were deferred to the agent — all 4 gray areas had explicit decisions from the user.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product Specification
- `.planning/PRODUCT_SPEC_v0_1.md` §15.1 — Storage topology (chrome.storage.local/session/sync + IndexedDB databases)
- `.planning/PRODUCT_SPEC_v0_1.md` §15.2 — API key encryption algorithm (install secret → PBKDF2 → AES-GCM-256)
- `.planning/PRODUCT_SPEC_v0_1.md` §15.3 — LRU eviction policy (conversations, archives, compaction)
- `.planning/PRODUCT_SPEC_v0_1.md` §16 — Security (XSS prevention, CSP, message security, secret redaction)
- `.planning/PRODUCT_SPEC_v0_1.md` §20.3 — WriteJournal operations schema and lifecycle
- `.planning/PRODUCT_SPEC_v0_1.md` §20.4 — IndexedDB migration policy and `IndexedDBMigration` interface
- `.planning/PRODUCT_SPEC_v0_1.md` Phase 2 file list — exact files to create and required tests

### Project & Roadmap
- `.planning/PROJECT.md` — Constraints (tech stack, MV3 rules, two surfaces), Key Decisions (encrypted storage, WriteJournal)
- `.planning/ROADMAP.md` Phase 2 — Goal, success criteria (5 items), depends on Phase 1
- `.planning/REQUIREMENTS.md` — STORAGE-01 (encrypted keys + WriteJournal + migrations), STORAGE-02 (storage topology per store type)

### Existing Code
- `src/core/theme/chromeStorageAdapter.ts` — Existing `chrome.storage.local` Zustand persist adapter (getItem/setItem/removeItem with localStorage fallback)
- `src/core/runtime/BroadcastBus.ts` — Cross-surface message bus (used for workspace handoff, SHELL-03)
- `src/core/theme/ThemeStore.ts` — Example Zustand store with persist middleware (pattern reference for new domain stores)
- `src/core/workspace/WorkspaceStore.ts` — Existing workspace state store (will be migrated from localStorage to chrome.storage.local in this phase)
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **chromeStorageAdapter** (`src/core/theme/chromeStorageAdapter.ts`): Existing Zustand `StateStorage` adapter wrapping `chrome.storage.local` with `localStorage` fallback. The new stores should use or extend this adapter rather than creating a second wrapper. Currently lives in `src/core/theme/` — consider relocating to `src/core/storage/` in this phase.
- **BroadcastBus** (`src/core/runtime/BroadcastBus.ts`): Singleton publish/subscribe over BroadcastChannel. WriteJournal uses this for workspace update notifications after committed writes.
- **ThemeStore/WorkspaceStore** (`src/core/theme/ThemeStore.ts`, `src/core/workspace/WorkspaceStore.ts`): Existing Zustand stores with persist middleware. New stores (ApiKeyStore, etc.) follow this same pattern but add encryption layer.

### Established Patterns
- **Zustand + persist middleware**: All persistent state uses `zustand/middleware.persist()` with a storage adapter. Phase 1 established this for ThemeStore and WorkspaceStore.
- **Core module isolation**: `src/core/` modules do not import from `src/components/`. New storage/security services must follow this boundary.
- **Singleton stores**: Stores are module-level singletons via `create()`. Not created per-component.

### Integration Points
- **WorkspaceStore** is currently persisted via localStorage. Phase 2 migrates it to `chrome.storage.local` via the storage adapter.
- **WriteJournal** must integrate with `BroadcastBus` for `WORKSPACE_UPDATED` events after committed writes.
- **CSP** is defined in `wxt.config.ts` (WXT manifest generation) or via `<meta>` tags in entrypoint HTML. Not yet configured.
- **Future consumers**: Phase 3 (ProviderRouter reads ApiKeyStore), Phase 5 (NotesDB, MemoryDB), Phase 6 (AITransactionLogDB).
</code_context>

<specifics>
## Specific Ideas

- User explicitly referenced the install-secret + PBKDF2 + AES-GCM approach already specified in PRODUCT_SPEC_v0_1.md §15.2 — the encryption algorithm is locked by the spec, not a new decision.
- Storage topology maps directly to PRODUCT_SPEC_v0_1.md §15.1: `chrome.storage.local` for config/keys/workspace, `chrome.storage.session` for tokens, `chrome.storage.sync` for theme/language, `IndexedDB` for chat/notes/memory/diagnostics data.
- The core storage module should be organized under `src/core/storage/` and `src/core/security/` as defined in the Phase 2 file list in the product spec.
</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. No scope creep was raised.
</deferred>

---

*Phase: 2-Storage & Security Foundation*
*Context gathered: 2026-07-29*
