# Phase 2: Storage, Security, WriteJournal, Workspace Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-12
**Phase:** 02-storage-security-writejournal-workspace-persistence
**Areas discussed:** WriteJournal Architecture, IndexedDB Database Topology, EncryptedStorage API Design, Workspace State Persistence, RateLimiter Design & Scope

---

## WriteJournal Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated IndexedDB journal store | WriteJournal entries stored in a dedicated object store. Most robust. | ✓ |
| Hybrid: chrome.storage.local + IndexedDB | Journal metadata in chrome.storage.local, data in IndexedDB. | |
| In-memory queue with periodic flush | Volatile in-memory queue. Loses entries on crash. | |

**User's choice:** Dedicated IndexedDB journal store.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Eager: on startup + on read detect | Recovery at startup and when inconsistency detected at read. | ✓ |
| Lazy: only on read inconsistency | Recovery only when stale data is read. | |

**User's choice:** Hybrid recovery — eager on startup (primary), before first new write (safety guard), lazy on read inconsistency (fallback). Only replay entries with status `pending` or `applying`. Failed and rolled-back entries kept for diagnostics.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Operation UUID per entry | Each entry gets a UUID. On replay, check if UUID already applied. | ✓ |
| Content hash | Hash the operation payload to detect duplicates. | |
| Per-store version counter | Each store has a version. Entries reference their target version. | |

**User's choice:** Operation UUID per entry.

---

| Option | Description | Selected |
|--------|-------------|----------|
| pending → applying → completed/failed | Entry cycles through statuses. Recovery replays pending/applying. | ✓ |
| pending → committed → applied (two-phase) | Two-phase: commit all entries, then apply each. | |

**User's choice:** pending → applying → completed/failed.

---

## IndexedDB Database Topology

| Option | Description | Selected |
|--------|-------------|----------|
| Single DB with multiple object stores | One 'nowpilot' DB, stores per domain. Shared version/migration. | ✓ |
| Separate DBs per domain | 6 separate openDB() calls. Independent schemas. | |
| 2 databases: data + system | Group related stores into two databases. | |

**User's choice:** Single DB 'nowpilot' with multiple object stores.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Single version counter, unified upgrade | DB version counter. onUpgradeNeeded handles all stores. | ✓ |
| Per-store schema versions via _meta store | Each store tracks its own version in a meta table. | |
| Version in database name | Version encoded in DB name (nowpilot_v1). | |

**User's choice:** Single version counter, unified upgrade via onUpgradeNeeded.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Same transaction | Journal entry and data write in one IndexedDB transaction. | |
| Separate transactions | Journal entry first, then data write in separate transactions. | ✓ |

**User's choice:** Separate transactions — journal entry first, then data write.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Append-only, manual/time-based purge | Completed entries retained for diagnostic window, then auto-pruned. | ✓ |
| Auto-purge completed after apply | Completed entries deleted immediately. | |

**User's choice:** Keep pending/applying/failed/rolled-back indefinitely. Auto-prune completed entries after retention window (7–30 days or last 1000 entries).

---

## EncryptedStorage API Design

| Option | Description | Selected |
|--------|-------------|----------|
| Transparent chrome.storage.local wrapper | Same get/set/remove API. Drop-in replacement. | ✓ |
| Standalone EncryptedStorage service | Domain-specific API (storeApiKey, getApiKey, etc.). | |

**User's choice:** Transparent chrome.storage.local wrapper.

---

| Option | Description | Selected |
|--------|-------------|----------|
| PBKDF2 from extension ID | Derive key from extension's unique ID. Stable across sessions. | |
| PBKDF2 from user-set master password | User sets a master password on first run. | |
| Session-only key | chrome.storage.session holds session key. Lost on restart. | |

**User's choice:** Random `np_install_secret` generated once at installation, stored locally. PBKDF2(installSecret + extensionId, salt) derives AES-GCM key. Per-value unique salt + IV from crypto.getRandomValues(). No user password required.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit initialize() before first use | Key derived at startup. Fails fast if secret is missing. | ✓ |
| Lazy init on first get/set | Key derived transparently on first use. | |

**User's choice:** Explicit EncryptedStorage.initialize() at startup, plus lazy auto-init as safety fallback.

---

| Option | Description | Selected |
|--------|-------------|----------|
| GUID salt prefix + random IV per value | GUID-derived salt + random IV stored alongside ciphertext. | |
| Derive IV from key name | Deterministic IV from key name. Simpler but weaker. | |

**User's choice:** crypto.getRandomValues() for both 16-byte salt and 12-byte IV per value. Stored in metadata wrapper: { alg: 'AES-GCM', salt, iv, ciphertext }.

---

## Workspace State Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Switch to chrome.storage.local | WorkspaceStore persists to local. Writer election stays on session. | ✓ |
| Hybrid: session + local | Session for live state, local as secondary persistence. | |

**User's choice:** Persist to chrome.storage.local (np_workspace). Writer election stays on chrome.storage.session (np_workspace_primary). All persistent updates route through WriteJournal.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Route through WriteJournal automatically | setState() creates journal entry, writes, syncs, marks complete. | ✓ |
| Direct persist; reconcile on startup | Zustand persist writes directly. Journal reconciles on startup. | |

**User's choice:** All persistent WorkspaceStore updates route through WriteJournal automatically.

---

| Option | Description | Selected |
|--------|-------------|----------|
| chrome.storage.onChanged (local) for sync | Listen on local area changes for cross-surface sync. | |
| Separate listener channel | New channel for workspace-local changes. | |
| Primary-writer authoritative | Only primary surface's state is authoritative. | |

**User's choice:** BroadcastBus as primary sync mechanism (WORKSPACE_UPDATED events). chrome.storage.local for durability. chrome.storage.onChanged as fallback.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Add future fields, persistence only | Full canonical schema now, consumers later. | ✓ |
| Current shape only; add fields later | Persist only current fields, migrate later. | |

**User's choice:** Full canonical WorkspaceState schema now including future-facing fields.

---

## RateLimiter Design & Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed window | Reset at window boundary. Simple and predictable. | |
| Sliding window log | Tracks individual timestamps. More accurate. | |
| Token bucket | Burst up to bucket size, then throttled to refill rate. | ✓ |

**User's choice:** Token bucket.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Return result object | { allowed, retryAfter, remaining }. Caller decides handling. | ✓ |
| Throw RateLimitExceededError | Exception-based error handling. | |
| Callback-based denial | onDenied callback per instance. | |

**User's choice:** Structured result object. Rate limiting is a normal outcome, not an exception.

---

| Option | Description | Selected |
|--------|-------------|----------|
| General-purpose utility | Any component can instantiate with its own config. | ✓ |
| Add-on only | Tied to add-on system. Lighter scope. | |

**User's choice:** General-purpose core utility. Available to add-ons, MCP tools, PROXY_FETCH, ServiceNow, etc.

---

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory only | State resets on reload. Sufficient for v0.1. | ✓ |
| Persisted to chrome.storage.session | Survives worker restarts and cross-surface context. | |

**User's choice:** In-memory only.

---

## the agent's Discretion

No areas were deferred to the agent — all decisions made by the user.

## Deferred Ideas

None — discussion stayed within phase scope.
