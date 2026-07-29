# Phase 2: Storage & Security Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-29
**Phase:** 02-storage-security-foundation
**Areas discussed:** API Key Encryption, Storage Store Topology, WriteJournal Recovery, IndexedDB Migrations

---

## API Key Encryption

| Option | Description | Selected |
|--------|-------------|----------|
| chrome.storage.session | Auto-generated key scoped to browser session; lost on restart | |
| User passphrase-derived key | PBKDF2 from user passphrase; requires passphrase UI | |
| chrome.storage.local persisted | Key stored alongside data; existing extension attack surface | ✓ |

**User's choice:** Hybrid approach — persist random 32-byte install secret (`np_install_secret`) in `chrome.storage.local`, derive AES-GCM key via PBKDF2(installSecret + extensionId, salt, 100000, SHA-256), cache derived key in `chrome.storage.session` at runtime. No user passphrase for v0.1. This avoids the friction of key re-entry after browser restart while providing reasonable protection against casual local storage inspection.

**Notes:** User referenced the existing product spec approach in PRODUCT_SPEC_v0_1.md §15.2. Per-key random salt + IV. Never use navigator.userAgent for derivation.

---

## Storage Store Topology

| Option | Description | Selected |
|--------|-------------|----------|
| Domain stores | Separate Zustand stores per domain with shared services | ✓ |
| Unified SecureStorage | One monolith store for all encrypted+persistent data | |
| Service-layer abstraction | Thin Zustand wrappers + shared service layer | |

**User's choice:** Domain-specific Zustand stores (ApiKeyStore, SessionStore, MessageStore, NotesStore, DiagnosticsStore) with centralized services for encryption (CryptoService), migrations (MigrationRunner), and write consistency (WriteJournal). Preserves Phase 1 Zustand pattern, keeps feature ownership clear, avoids monolithic storage.

**Notes:** This gives Phase 3-8 each a clean contract for their storage needs without coupling them to each other's schemas.

---

## WriteJournal Recovery

| Option | Description | Selected |
|--------|-------------|----------|
| Startup replay + lazy repair | Replay on init + validate on access | ✓ |
| Startup replay only | Check and replay once on init | |
| Optimistic write + periodic sync | Write optimistically, sync in background | |

**User's choice:** Startup replay + lazy repair. Replay incomplete transactions during application startup and also validate journal state on record access. Covers both cold-start failures and crashes after initialization.

**Notes:** Aligns with the product spec's `WriteJournalEntry` lifecycle: `pending → applying → completed` (or `failed`/`rolled-back`). The `update-workspace` operation in §20.3 demonstrates the ordered steps: journal entry → write storage → broadcast → mark completed.

---

## IndexedDB Migrations

| Option | Description | Selected |
|--------|-------------|----------|
| Versioned upgrade handlers | idb's native upgrade per version | ✓ |
| Declarative migration scripts | Separate migration files with up/down | |
| Schema snapshots | Wipe and recreate on version bump | |

**User's choice:** Versioned upgrade handlers using idb's native mechanism (v1→v2→v3→v4). Each version step handles only the schema changes introduced in that release. Idempotent, testable with fixtures.

**Notes:** A declarative migration framework adds unnecessary complexity when migrations are schema-only with no existing production data. The product spec defines the `IndexedDBMigration` interface in §20.4.

---

## the agent's Discretion

No areas were deferred to the agent — all 4 gray areas had explicit decisions from the user.

## Deferred Ideas

None — discussion stayed within phase scope.
