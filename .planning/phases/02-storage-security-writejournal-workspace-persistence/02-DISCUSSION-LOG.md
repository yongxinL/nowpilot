# Phase 2: Storage, Security, WriteJournal, Workspace Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-23
**Phase:** 2-Storage, Security, WriteJournal, Workspace Persistence
**Areas discussed:** Election scope, Encryption wiring + key migration, WriteJournal real-path wiring, Requester role + RateLimiter, Storage error-surfacing contract, unlimitedStorage permission, IndexedDB migrator scope, Coalescing confirmation

---

## Election scope (isPrimaryWriter swap)

| Option | Description | Selected |
|--------|-------------|----------|
| Full election now (spec §20.11) | WorkspaceCoordinationState, CAS on np_workspace_primary, 3s heartbeat, 2-miss re-election, Standalone tie-break | ✓ |
| Defer election to Phase 8 | Keep isPrimaryWriter()=true stub, defer to when MemoryEngine gates | |

**User's choice:** Full election now (spec §20.11)
**Notes:** Then chose a hybrid for placement — new `WorkspaceElection.ts` module but single lifecycle. Verified the scaffold's `WorkspaceSync.ts` has NO heartbeat timer today (pure pub/sub, 32 lines); user approved the timer living in WorkspaceElection with `WORKSPACE_HEARTBEAT` added to WorkspaceSyncMessage. Also chose to gate np_workspace persist on `isPrimaryWriter()` now so the predicate is production-exercised.

## Encryption wiring + key migration

| Option | Description | Selected |
|--------|-------------|----------|
| Wire live + migrate plaintext now | EncryptedStorage/KeyVault wired into live np_providers; one-time migrate strips plaintext from np_store | ✓ |
| Primitives only, wire in Phase 3 | Round-trip test only; CONCERNS finding stays open one phase | |

**User's choice:** Wire live + migrate plaintext now

Follow-up choices: Spec §15.2 exact scheme (no recovery, no export/import); split np_providers key (spec §15.1) with one-time migrate; keep current ProviderConfig shape, encrypt fields (array normalization deferred to Phase 3 with ProviderRegistry).

## WriteJournal real-path wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Wire np_workspace + startup recovery | update-workspace op through runJournaled, WriteJournalDB, recoverJournal on boot | ✓ |
| Primitives + simulated test only | No production path journaled in Phase 2 | |

**User's choice:** Wire np_workspace + startup recovery

Follow-up choices: declare all 11 §20.3 ops, implement update-workspace only; journal entries in a dedicated WriteJournalDB idb store (not chrome.storage.session); compose election-gate + journal + debounced step (journal-entry write bypasses debounce, np_workspace data write stays debounced).

## Requester role + RateLimiter

| Option | Description | Selected |
|--------|-------------|----------|
| UI-side fetch wrapper for aiProvider | AbortController + 25s timeout + error codes, UI contexts only, aiProvider consumes Phase 3 | ✓ |
| PROXY_FETCH client awaiting Phase 17 | Envelope dispatcher to background CORSProxy, no live consumer | |

**User's choice:** UI-side fetch wrapper for aiProvider

Follow-up choices: token-bucket per-instance RateLimiter (per §13); optional injected limiter, no default inside Requester.

## Storage error-surfacing contract

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: 2 new codes only | Exactly STORAGE_QUOTA + STORAGE_RATE_LIMIT added to registry; reuse existing spec codes | ✓ |
| Add more (encryption/migration/unavailable) | Invented codes, violates closed-set rule | |

**User's choice:** Minimal: 2 new codes only
**Notes:** User's own note asked to reconcile against the spec and keep the set minimal — confirmed the spec already has STORAGE_READ_FAILED, IDB_BLOCKED, IDB_MIGRATION_FAILED, TIMEOUT, NETWORK, RATE_LIMITED, WORKSPACE_* codes. Follow-up: adapter surfaces errors (fixes CONCERNS unhandled lastError gap) + ErrorStore (idb, FIFO 100) records typed errors.

## unlimitedStorage permission

| Option | Description | Selected |
|--------|-------------|----------|
| Add to manifest (ADR-STACK-02) | 'unlimitedStorage' added; Phase-2 set = sidePanel, storage, tabs, unlimitedStorage | ✓ |
| Hold, rely on persist() | navigator.storage.persist() substitute — rejected in ADR-STACK-02 | |

**User's choice:** Add to manifest (ADR-STACK-02)
**Notes:** Applies to IndexedDB bodies (ChatHistoryDB/MemoryDB/NotesDB/WriteJournalDB/ErrorStore); session's 10 MB hard cap NOT lifted.

## IndexedDB migrator scope

| Option | Description | Selected |
|--------|-------------|----------|
| Framework + bootstrap all 5 DBs | Migrator framework + schema/version bootstrap for all 5 DBs, v1→v2 fixture | ✓ |
| Framework only, bootstrap per-phase | DBs as thin openDB stubs until owning phases | |

**User's choice:** Framework + bootstrap all 5 DBs

Follow-up: all DBs start at v1; the v1→v2 fixture is a framework proof (fixture DB / in-test migration pair), not a production data migration.

## Coalescing confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Confirm: no re-open, verify interplay | D-22 debounce stays as-is; verify election-heartbeat/WriteJournal interplay | ✓ |
| Re-tune debounce in Phase 2 | Re-open settled D-22 | |

**User's choice:** Confirm: no re-open, verify interplay
**Notes:** Election heartbeats → chrome.storage.session (not debounced); journal entries → immediate; np_workspace persists → debounced path. Write-rate assertion (≤30 writes/min) stays green.

---

## the agent's Discretion

- **Setting.ts** — API shape + Phase-2 usage (declare-now utility vs live settings).
- **redactSensitive.ts** — relationship to full TraceRedactor (Phase 11); where invoked at persist boundaries.
- **ChatHistoryDB/MemoryDB/NotesDB schema detail** — field-level fidelity to §15.1 / Appendix C.
- **Test infra for IndexedDB** — idb@^8 install + IndexedDB test harness (fake-indexeddb or fixture).

## Deferred Ideas

- API-key export/import or install-secret backup → v0.2+.
- np_providers array-form normalization → Phase 3 (ProviderRegistry).
- Production data migrations (notes/memory fields, notes_backup_config v4) → owning phases (Phase 9).
- CORSProxy / PROXY_FETCH client → Phase 17.
- Full TraceRedactor + AITransactionLog → Phase 11.
- Master-password / OS-keychain flow → v0.2.