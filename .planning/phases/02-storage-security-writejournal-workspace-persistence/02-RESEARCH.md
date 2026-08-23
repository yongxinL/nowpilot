# Phase 2: Storage, Security, WriteJournal, Workspace Persistence - Research

**Researched:** 2026-08-23
**Domain:** Extension storage architecture (chrome.storage + IndexedDB), WebCrypto encrypt-at-rest, crash-safe write journaling, primary-writer election, storage error surfacing
**Confidence:** HIGH

## Summary

Phase 2 is the persistence + security foundation. It builds **six** interacting mechanisms that every later phase depends on: (1) encrypt-at-rest for provider secrets via KeyVault (PBKDF2 100k → AES-GCM-256) with a one-time `np_store` → `np_providers` migration; (2) a real primary-writer election (`WorkspaceElection.ts`) that replaces the Phase-1 `isPrimaryWriter()` stub and gates the `np_workspace` persist path; (3) a WriteJournal (spec Appendix O.11 shape) journaling real `np_workspace` updates into a dedicated IndexedDB store with boot-time recovery; (4) an IndexedDBMigrator framework bootstrapping all five DBs at v1 with an idempotent v1→v2 fixture; (5) storage error surfacing (`STORAGE_QUOTA` / `STORAGE_RATE_LIMIT` — exactly two new codes) into an ErrorStore (IDB FIFO 100); and (6) the `unlimitedStorage` manifest permission.

The three environment-critical facts were **empirically verified this session**: `crypto.subtle` AND `structuredClone` both work in this repo's vitest 3.2.7 + jsdom 25 + Node 24 environment (AES-GCM round-trip passed), so `EncryptedStorage` needs no WebCrypto polyfill; `indexedDB` is **undefined** in the test env (fake-indexeddb is required); and `tests/setup.ts` mocks `chrome.storage.local` + `sync` but **not `session`** (WorkspaceElection tests need a session mock). The two packages Phase 2 installs — `idb@8.0.3` (spec-pinned) and `fake-indexeddb@6.2.5` (devDep test harness) — both pass the legitimacy gate (OK verdict, no postinstall, both from well-known repos).

One design wrinkle dominates the planner's task: **zustand's `persist.migrate` hook is synchronous**, so the `np_store` → `np_providers` secret migration (PBKDF2 is async) cannot run inside it — it must be an explicit async boot-step migration with a strict order (write encrypted `np_providers` first, strip plaintext from `np_store` second) to be crash-safe and idempotent. Similarly, `WorkspaceElection` owns the **only** 3s timer (D-26); `BroadcastBus` suppresses self-messages, so a lone surface never sees its own heartbeat — the election state machine must treat "no other surface seen" as solo/primary.

**Primary recommendation:** Follow spec Appendix O.11's `runJournaled`/`recoverJournal` shape verbatim for the journal; wire it into WorkspaceStore via a **journaling storage-adapter wrapper** around `chromeStorageAdapter` (preserves the D-22 debounce, gates on `isPrimaryWriter()`, parses workspaceId/conversationId from the serialized state); add `import 'fake-indexeddb/auto'` to `tests/setup.ts` and extend it with a `chrome.storage.session` mock; install `idb@^8` + `fake-indexeddb@^6`; and implement the secret migration as an async boot step, never inside `persist.migrate`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-24 (Full election now — spec §20.11):** Phase 2 implements the complete primary-writer election: startup CAS on `np_workspace_primary` in `chrome.storage.session`, 3 s heartbeat, 2-miss → re-election, Standalone view tie-break priority, secondary surfaces mirror. `WorkspaceStore.isPrimaryWriter()` stops returning a stub `true` and becomes a **pure read** of the in-memory election result. This is the Phase-1 D-16 documented swap point. — **Reversibility:** `costly` — rationale: replaces the frozen Phase-1 predicate contract; every later phase's write gating (MemoryEngine, notes) reads through this one symbol.
- **D-25 (Election lives in `src/core/workspace/WorkspaceElection.ts`):** New dedicated module owns `WorkspaceCoordinationState` (§20.11) and all CAS/heartbeat/re-election logic against `np_workspace_primary`. Deliberate separation from the persist store and from WorkspaceSync so the state machine is isolated and unit-testable. — **Reversibility:** `reversible` — rationale: additive module; no public contract change beyond `isPrimaryWriter()` behavior.
- **D-26 (Single heartbeat lifecycle — no second timer):** The scaffold's `WorkspaceSync.ts` is a 32-line pure pub/sub layer over `np_workspace` — it does **NOT** own a heartbeat timer today (spec Appendix M.3's timer never shipped). Therefore WorkspaceElection owns the **only** 3 s tick; WorkspaceSync stays timer-free and just adds `WORKSPACE_HEARTBEAT` to its `WorkspaceSyncMessage` union so the election heartbeat rides the existing `np_workspace` BroadcastChannel. No second timer, no second channel; D-22 debounce untouched. — **Reversibility:** `reversible` — rationale: additive message type + one timer owner.
- **D-27 (Gate `np_workspace` persist on the election now):** `isPrimaryWriter()` gates a real Phase-2 write path so the predicate is exercised in production, not just tests — secondary surfaces skip persist (mirror only), primary runs the journaled persist. MemoryEngine/note-write gating still lands in Phase 8+. — **Reversibility:** `reversible` — rationale: one write path gated; ungating is a predicate change.
- **D-28 (Wire live + migrate plaintext now):** EncryptedStorage + KeyVault are wired into live provider storage in Phase 2 (not primitives-only). Provider config moves out of `np_store` into a dedicated `np_providers` key in `chrome.storage.local` with `apiKey` fields encrypted (§15.1). A one-time migrate on hydrate: if legacy `np_store` still carries plaintext `apiKey` / `openAiKey` / `geminiKey` and no `np_providers` exists, encrypt + move then strip them from `np_store`. This closes the CONCERNS plaintext-secret finding in Phase 2. — **Reversibility:** `costly` — rationale: changes where provider config lives; the np_store→np_providers migration is one-way once keys are stripped from the old blob.
- **D-29 (KeyVault lifecycle — spec §15.2 exact, no recovery):** `installSecret` = 32 random bytes generated once → `np_install_secret` in chrome.storage.local. Per-key encryption: random 16-byte salt + 12-byte IV; `derivedKey = PBKDF2(installSecret + extensionId, salt, 100000, SHA-256)` → AES-GCM-256. No rotation, no master password, no recovery/export path (that's a v0.2+ option); reinstall loses provider keys — a documented, accepted trade-off. — **Reversibility:** `one-way` — rationale: install secret + derived keys are the encryption root; changing the derivation scheme invalidates all persisted ciphertext.
- **D-30 (Keep current ProviderConfig shape, encrypt fields):** Spec §15.1 describes `np_providers` as `ProviderConfig[]` (array), but the scaffold persists a single `ProviderConfig` object with nested `providers: Record<CustomProviderId, CustomProviderDetail>` (each carrying `apiKey`) plus top-level `openAiKey`/`geminiKey` duplicates. Phase 2 **keeps the scaffold shape** and encrypts the apiKey fields before writing `np_providers`; normalization to the spec's array form is deferred to Phase 3 with `ProviderRegistry`. — **Reversibility:** `reversible` — rationale: no consumer refactor in Phase 2; Phase 3 shape change touches Options page anyway.
- **D-31 (Wire `np_workspace` update + startup recovery):** The `np_workspace` update goes through `runJournaled` for real (the `update-workspace` operation, §20.3 ordering: create entry `pending` → write `chrome.storage.local.np_workspace` → emit `WORKSPACE_UPDATED` → mark `completed`). `recoverJournal()` runs on surface boot to finish or undo any entry left mid-flight (crash recovery). Proves crash-safety on a production path and satisfies success criterion 1. — **Reversibility:** `reversible` — rationale: additive wrapping of the existing persist call.
- **D-32 (Declare all 11 ops, implement `update-workspace` only):** The full `WriteJournalOperation` union from §20.3 (`append-memory-message`, `evict-conversation`, `archive-conversation`, `compact-conversation`, `save-note-with-links`, `update-user-memory`, `export-data`, `update-workspace`, `sync-note-file`, `delete-note-file`, `restore-notes-batch`) is declared as the type surface now; only `update-workspace` gets a registered `JournalStep` implementation in Phase 2. Later phases register step impls against the same enum — declare-now/populate-later. — **Reversibility:** `reversible` — rationale: type-only additions; no data contract churn.
- **D-33 (Journal entries in a dedicated WriteJournalDB idb store):** Entries persist in IndexedDB (`entries` store) per §15.1 `WriteJournalDB` — NOT chrome.storage.session — so recovery survives SW restarts. The store's schema/version is owned by IndexedDBMigrator. Entries are metadata-only (no message bodies), so no redaction required in the journal. — **Reversibility:** `costly` — rationale: persistence backend choice; moving it later orphans any in-flight journal rows.
- **D-34 (Election-gate + journal + debounced step compose):** np_workspace persist flow = (1) secondary surfaces skip entirely (mirror only); (2) primary checks `isPrimaryWriter()` → creates `WriteJournalEntry(status='pending')` → `runJournaled` applies steps `[write np_workspace via the debounced chromeStorageAdapter, emit WORKSPACE_UPDATED]` → marks `completed`. The journal-entry write itself bypasses the debounce (immediate, single write) so recovery ordering is exact; the np_workspace data write stays on the D-22 300 ms trailing debounce. — **Reversibility:** `reversible` — rationale: compositional; each mechanism independently revertable.
- **D-35 (Requester = UI-side fetch wrapper for aiProvider):** `src/core/http/Requester.ts` is the UI-context HTTP client: fetch wrapper with AbortController threading, 25 s default timeout (matching PROXY_FETCH's `Promise.race`), RateLimiter integration, and structured error codes (`NETWORK`, `TIMEOUT`, etc.). Runs only in side panel / standalone (never the background SW — §0.2 boundary). `aiProvider` consumes it in Phase 3. It is NOT the PROXY_FETCH client — CORSProxy/PROXY_FETCH stays a background-SW concern (Phase 17). — **Reversibility:** `reversible` — rationale: new module; Phase 3 wires a consumer.
- **D-36 (RateLimiter = token bucket, per-instance):** `{ capacity, refillPerSecond }`; `acquire()` returns boolean or throws `RATE_LIMITED`. Per-instance by design per §13 ("each add-on owns its limiter; never shared"). Proven by `RateLimiter.test.ts` unit tests in Phase 2. — **Reversibility:** `reversible` — rationale: standalone util.
- **D-37 (Optional injected limiter, no default):** Requester accepts an optional RateLimiter instance; none passed → no throttling. Keeps aiProvider's streaming path uninstrumented until Phase 3 wiring, avoids silently throttling legitimate stream traffic. — **Reversibility:** `reversible` — rationale: constructor param; default-free.
- **D-38 (Minimal set — exactly 2 new codes):** The spec's canonical registry already defines `STORAGE_READ_FAILED`, `IDB_BLOCKED`, `IDB_MIGRATION_FAILED`, `TIMEOUT`, `NETWORK`, `RATE_LIMITED`, `WORKSPACE_ELECTION_TIMEOUT`, `WORKSPACE_STORAGE_UNAVAILABLE`, `WORKSPACE_HANDOFF_FAILED`. REQ-R07 adds **exactly `STORAGE_QUOTA` and `STORAGE_RATE_LIMIT`**. All storage/IDB/KeyVault/WriteJournal catch paths reuse existing spec codes; NO invented codes (the closed-set rule in §0.3/§21.6 is absolute). `WRITE_JOURNAL_FAILED` / `WRITE_JOURNAL_ROLLBACK_FAILED` are spec-internal debugLog codes from O.11 (kept as-is, not added to the registry). — **Reversibility:** `reversible` — rationale: additive registry entries; code-set audit is a grep.
- **D-39 (Adapter surfaces + ErrorStore records):** `chromeStorageAdapter` stops swallowing quota/rate-limit failures into `debugLog` — it surfaces `STORAGE_QUOTA` / `STORAGE_RATE_LIMIT` (fixes the CONCERNS unhandled `lastError` gap). `ErrorStore` (new idb store, FIFO max 100, debug only per spec §15.1) records typed errors, including `IDB_MIGRATION_FAILED` on migration failure. WriteJournal uses `WRITE_JOURNAL_FAILED` via `debugLog` per O.11. — **Reversibility:** `reversible` — rationale: error paths only.
- **D-40 (Add `unlimitedStorage` to the Phase-2 manifest):** D-19a's Phase-2 permission set becomes `['sidePanel', 'storage', 'tabs', 'unlimitedStorage']` in `wxt.config.ts`. It exempts the extension origin — IndexedDB bodies (ChatHistoryDB/MemoryDB/NotesDB/WriteJournalDB/ErrorStore) — from quota/eviction. `navigator.storage.persist()` is NOT a substitute (per ADR-STACK-02). Phase 19 CWS review must justify it in the store listing. `chrome.storage.session`'s 10 MB hard cap is NOT lifted by this permission (per PITFALLS P2). — **Reversibility:** `reversible` — rationale: declarative permission; remove is a one-line manifest edit.
- **D-41 (Framework + bootstrap all 5 DBs):** `IndexedDBMigrator.ts` is the shared versioning framework: `IndexedDBMigration` registry (`fromVersion`/`toVersion`/`description`/`migrate` per §20.4), deterministic + idempotent migrations where practical, numeric `DB_VERSION` per database, a forward-migration contract later phases extend, and failures → `IDB_MIGRATION_FAILED` → ErrorStore + degraded mode. Phase 2 bootstraps schema + version for **all five** DBs (ChatHistoryDB, MemoryDB, NotesDB, WriteJournalDB, ErrorStore). Data migrations (notes fields, memory, etc.) land in owning phases. — **Reversibility:** `costly` — rationale: DB_VERSION and store schemas are persisted contract; renumbering later requires migration churn.
- **D-42 (All DBs start at v1; v1→v2 fixture proves the framework):** Each production DB ships at `DB_VERSION = 1` (initial schema). The required v1→v2 fixture (success criterion 4) uses a fixture DB / in-test migration pair to prove the framework is idempotent + backward-compatible — it is a framework proof, not a production data migration. Production DBs stay at v1 until owning phases bump them (e.g. the `notes_backup_config` v4 migration lands at Phase 9 per §20.4). — **Reversibility:** `reversible` — rationale: test fixture + version baseline; no production data moved.
- **D-43 (No re-open of D-22; verify interplay):** D-22 coalescing (`STORAGE_DEBOUNCE_MS = 300` ms trailing debounce + `beforeunload`/`visibilitychange` flush in `chromeStorageAdapter`) landed in Phase 1 and is NOT re-opened. Phase 2 verifies the interplay: election heartbeats write `np_workspace_primary` to chrome.storage.session (NOT debounced — small/frequent), WriteJournal entry writes are immediate (bypass debounce), np_workspace persists stay on the debounced path. The write-rate assertion (≤30 writes/min steady-state, per PITFALLS P2's ~120/min boundary) stays green. — **Reversibility:** `reversible` — rationale: verification only; no production change to the debounce.

### the agent's Discretion
- **Setting.ts (`src/core/storage/Setting.ts`):** The `Setting<T>` generic + serialized-write rule (§13 "Settings writes serialized — never write two Setting<T> keys concurrently") is implementation-detail; exact API shape and which settings use it in Phase 2 (if any — it may be a declare-now/populate-later utility) is the planner's call.
- **redactSensitive.ts (`src/core/security/redactSensitive.ts`):** Relationship to the full TraceRedactor (Phase 11, AITransactionLog) — Phase 2 ships the storage-side redaction primitive; where it's invoked at persist boundaries (vs. only at log boundaries) is the planner's call. Success criterion 3 ("no message body or raw secret in chrome.storage.local, proven by inspection") is the acceptance bar.
- **ChatHistoryDB / MemoryDB / NotesDB schema detail:** The stores are bootstrapped at v1 with their §15.1 store lists (sessions/messages, userFacts/conversationSummaries, notes/concepts); exact index/keyPath detail (e.g. MemoryDB messages keyPath `[conversationId, seq]`) follows §15.1 / Appendix C — planner confirms field-level fidelity, no invention.
- **Test infra for IndexedDB:** Phase 2 needs idb@^8 installed (STACK.md) and an IndexedDB test environment (e.g. `fake-indexeddb` or a fixture harness) — the current `tests/setup.ts` has no IndexedDB mock. Harness choice is the planner's call.

### Deferred Ideas (OUT OF SCOPE)
- **API-key export/import or install-secret backup** — user chose spec §15.2 exact (no recovery); a backup/export path is a v0.2+ option (D-29 note).
- **`np_providers` normalization to spec §15.1 `ProviderConfig[]` array form** — deferred to Phase 3 with `ProviderRegistry` (D-30 note).
- **Real production data migrations (notes/memory fields, notes_backup_config)** — owning phases; the v4 `notes_backup_config` migration lands at Phase 9 per §20.4 (D-42 note).
- **CORSProxy / PROXY_FETCH client** — Phase 17 background-SW concern; Requester is NOT it in Phase 2 (D-35 note).
- **Full TraceRedactor + AITransactionLog** — Phase 11; Phase 2 ships `redactSensitive` as the storage-side primitive (discretion).
- **Master-password / OS-keychain flow** — CONCERNS "consider a master-password/OS-keychain flow for v0.2" — explicitly deferred beyond v0.1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-R06 | `unlimitedStorage` permission per ADR-STACK-02 | D-40; official Chrome docs confirm it lifts ONLY `storage.local`'s 10 MB quota — IndexedDB origin quota/eviction exemption — and does NOT lift `chrome.storage.session`'s 10 MB cap [CITED: developer.chrome.com/docs/extensions/reference/api/storage]. wxt.config.ts `permissions` array currently `['sidePanel','storage','tabs']` [VERIFIED: wxt.config.ts:36]. |
| REQ-R07 | Storage adapter error codes `STORAGE_QUOTA` / `STORAGE_RATE_LIMIT` | D-38/D-39; both codes are absent from spec §21.6 + Appendix C.2 registries [VERIFIED: PRODUCT_SPEC_v0_1.md:3424-3469, 5075-5116] — exactly two additions. Adapter flush currently swallows rejections into `debugLog('STORAGE_DEBOUNCE_FLUSH_FAILED', ...)` [VERIFIED: src/core/theme/chromeStorageAdapter.ts:154-156]; Chrome rejects quota-exceeding writes with `runtime.lastError` / rejected Promise [CITED: developer.chrome.com]. |
| REQ-R03 | `np_workspace` write coalescing (D-22) — verify interplay, do NOT re-open | D-43; `STORAGE_DEBOUNCE_MS = 300` [VERIFIED: src/core/theme/chromeStorageAdapter.ts:14]; heartbeat session writes (20/min) + immediate journal-entry writes + debounced np_workspace persists compose under the ~120/min boundary [CITED: PITFALLS P2]. |

Additional phase requirements (from spec §18 Phase 2 Create/Required-tests/DONE-when — all verified verbatim below in Code Examples / Validation Architecture): the 12-file Create list, the 5 required test files, and the 5 DONE-when criteria.
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Encrypt-at-rest (KeyVault + EncryptedStorage) | Client (extension pages — Options/sidepanel/standalone) | — | WebCrypto `crypto.subtle` runs in UI contexts; secrets never enter the background SW (§0.2/§5.2 boundary) [VERIFIED: PRODUCT_SPEC_v0_1.md:914-923] |
| Primary-writer election (CAS/heartbeat) | Client (cross-surface, in-memory state machine) | Storage (`chrome.storage.session.np_workspace_primary`) | Election key is the session-storage record [VERIFIED: PRODUCT_SPEC_v0_1.md:1964]; heartbeat rides the `np_workspace` BroadcastChannel (client pub/sub) |
| `np_workspace` persistence | Client (WorkspaceStore zustand persist) | Storage (`chrome.storage.local` via `chromeStorageAdapter`) | Write path is election-gated + journaled (D-27/D-34); adapter is the shared choke point |
| IndexedDB schema + migrations | Client (extension-origin IndexedDB) | — | IDB is extension-origin storage shared across SW/pages/sidepanel; `unlimitedStorage` exempts it from quota/eviction [CITED: STACK.md + ADR-STACK-02] |
| WriteJournal crash recovery | Client (boot-time recovery) | Storage (WriteJournalDB `entries` store in IDB) | Journal persists in IDB so recovery survives SW restarts (D-33) |
| Provider-config secrets | Client (Options page) | Storage (`np_providers` in `chrome.storage.local`, encrypted) | Only UI decrypts on demand; persisted blob carries ciphertext only (§15.1) |
| Storage error surfacing | Storage adapter (classify + emit) | Client (ErrorStore IDB FIFO 100) | Adapter converts rejection → typed code → ErrorStore + debugLog (D-39) |
| HTTP fetch (Requester) | Client (sidepanel/standalone only) | — | §0.2: no `fetch` in background SW; Phase 3 `aiProvider` consumes it (D-35) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| idb | ^8 → 8.0.3 (verified current 2026-08-23) | Typed IndexedDB wrapper (openDB/upgrade, DBSchema typing, tx.done) | Spec-pinned per STACK.md §"Phase 2 (IndexedDB): idb@^8"; tiny (~1.19 kB brotli), promise-based, zero magic — right size for extension code; NOT Dexie [CITED: github.com/jakearchibald/idb] |
| fake-indexeddb | ^6 → 6.2.5 (verified current 2026-08-23) | In-memory IndexedDB for vitest (devDependency) | `import 'fake-indexeddb/auto'` installs global `indexedDB`; works with idb; reset via `new IDBFactory()`; TS types built-in [CITED: github.com/dumbmatter/fakeIndexedDB] |
| WebCrypto `crypto.subtle` | built-in (Chrome extension pages are secure contexts) | AES-GCM-256 encrypt/decrypt + PBKDF2 deriveBits | Never hand-roll crypto; spec §15.2 pins the exact scheme; empirically verified working in this repo's vitest jsdom env (Node 24) |
| zustand `persist` (existing) | 5.0.x (installed) | migrate/partialize/merge mechanics for np_store + np_workspace_store | Existing store pattern; `migrate(persisted, version)` is synchronous — drives the async-boot-migration design (see Pitfall 2) [CITED: github.com/pmndrs/zustand docs/reference/middlewares/persist.md] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/chrome (existing) | ^0.2.2 | `chrome.storage.session` types | Election + session writes |
| zod (existing) | ^4.4.3 | Schema-validate persisted blobs (np_providers, journal entries) at boundary | Cross-boundary data per CLAUDE.md convention; zustand docs recommend validating persisted state [CITED: zustand persist docs] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| idb | Raw IndexedDB | Raw IDB is boilerplate-heavy (request/onsuccess/onerror ceremony); idb is the spec's choice [CITED: STACK.md:79] |
| idb | Dexie | Dexie is a large dependency with liveQuery machinery the extension doesn't need [CITED: STACK.md:79] |
| fake-indexeddb | Hand-rolled IDB mock | A hand-rolled mock misses upgrade/transaction/key-range semantics; fake-indexeddb passes 82.8% of the WPT IndexedDB suite [CITED: github.com/dumbmatter/fakeIndexedDB] |
| crypto.subtle | node-webcrypto / sjcl / forge in tests | Unnecessary — `crypto.subtle` verified available in the vitest jsdom env; adding a lib risks algorithm drift vs. production |

**Installation:**
```bash
pnpm add idb@^8
pnpm add -D fake-indexeddb@^6
```

**Version verification (run at install):**
```bash
npm view idb version          # → 8.0.3 (verified 2026-08-23)
npm view fake-indexeddb version  # → 6.2.5 (verified 2026-08-23)
```
Matches STATE.md watch item VAI-04 (re-query at each phase install — done this session).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| idb | npm | 9 yrs (8.0.3 published 2025-05-07) | ~24M/wk | github.com/jakearchibald/idb | OK | Approved |
| fake-indexeddb | npm | 10 yrs (6.2.5 published 2025-11-07) | ~5.2M/wk | github.com/dumbmatter/fakeIndexedDB | OK | Approved (devDependency) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

Both packages: no `postinstall` script (verified `npm view <pkg> scripts.postinstall` → empty), Apache-2.0/ISC licenses, maintainers of record are the libraries' authors. No package was discovered via WebSearch/training data alone — both confirmed via registry + official READMEs this session.

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────── Surface boot (sidepanel / standalone / options) ──────────────────────────┐
│                                                                                                      │
│  1. recoverJournal()          load pending|applying entries from WriteJournalDB (IDB)                │
│      └─ replay via registered JournalStep for the entry's operation (update-workspace →              │
│         write np_workspace_store + emit WORKSPACE_UPDATED)  [idempotent; O.11]                       │
│  2. IndexedDBMigrator.bootstrap()  openDB(name, DB_VERSION, { upgrade, blocked }) for all 5 DBs      │
│      └─ blocked → IDB_BLOCKED → ErrorStore;  migration failure → IDB_MIGRATION_FAILED → degraded    │
│  3. WorkspaceElection.start(surface)  ──► CAS on chrome.storage.session.np_workspace_primary         │
│      {tabId, surface, electedAt}   tie-break: standalone > sidepanel                                │
│      ├─ wins → state 'primary' (or 'solo' if no other surface) → isPrimaryWriter() === true         │
│      └─ loses → state 'secondary' (isMirroring) → isPrimaryWriter() === false                       │
│  4. migrateProviderSecrets()  [async boot step — NOT persist.migrate]                               │
│      legacy np_store has plaintext apiKey/openAiKey/geminiKey AND np_providers absent?              │
│      ├─ yes → KeyVault.ensureInstallSecret() → EncryptedStorage.encrypt fields →                    │
│      │        write np_providers → strip plaintext from np_store → persist np_store                 │
│      └─ no  → skip (idempotent)                                                                     │
└──────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─ np_workspace persist path (D-34) ───────────────────────────────────────────────────────────────┐
│  WorkspaceStore setState → zustand persist → journalingAdapter.setItem('np_workspace_store', v)  │
│    ├─ !isPrimaryWriter() → NO-OP (secondary mirror only)                                          │
│    └─ isPrimaryWriter() → WriteJournalDB: insert {status:'pending', op:'update-workspace'}        │
│         → runJournaled(entry, steps, persistEntry)  [O.11 shape]                                  │
│              steps: [ chromeStorageAdapter.setItem (D-22 300ms debounced),                        │
│                       notifyWorkspaceUpdate(workspaceId, conversationId) ]                        │
│              status: applying → (steps) → completed;  on throw → rollback reverse → rolled-back   │
│  journal entry writes are IMMEDIATE (direct IDB put, bypass debounce); data write stays debounced │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─ Heartbeat loop (D-26 — the ONLY 3s timer) ────────────────────────────────────────────────────┐
│  WorkspaceElection.setInterval(3000):                                                           │
│    publish WORKSPACE_HEARTBEAT on 'np_workspace' channel  (BroadcastBus)                        │
│    + chrome.storage.session.set({ np_workspace_primary: {tabId, surface, electedAt: now} })     │
│  Inbound WORKSPACE_HEARTBEAT (only from OTHER surfaces — BroadcastBus suppresses self-messages) │
│    → mark primary alive → state 'secondary' if we were primary                                  │
│  2 missed heartbeats (≥6s no heartbeat, no other surface seen) → re-election CAS                │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─ Storage error pipeline (D-39) ──────────────────────────────────────────────────────────────────┐
│  chrome.storage.local/sync set() rejects → performFlush catch → classify message text:           │
│    QUOTA / QUOTA_BYTES* → STORAGE_QUOTA ; MAX_WRITE_OPERATIONS* / rate → STORAGE_RATE_LIMIT      │
│    → redactSensitive(context) → ErrorStore.record({code, message, context, timestamp}) (IDB FIFO 100) │
│      + debugLog(code, ...)   [never swallowed, never user-facing per UI-SPEC]                     │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─ Provider key save (Options page, D-28/D-30) ───────────────────────────────────────────────────┐
│  handleSaveProviderModal → field empty? preserve stored key : EncryptedStorage.encrypt(apiKey)   │
│    → write np_providers (ProviderConfig shape, apiKey fields = {salt,iv,ciphertext} base64)      │
│    → update in-memory config (non-secret fields + isConfigured/enabled)                           │
│    → np_store partialize EXCLUDES secret fields → persisted blob has no plaintext (criterion 3)  │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── core/storage/            # Phase 2 Create list (§18)
│   ├── Setting.ts           #   Setting<T> + serialized-write rule (§13) — declare-now/populate-later (discretion)
│   ├── EncryptedStorage.ts  #   AES-GCM-256 encrypt/decrypt + PBKDF2 derive; encryptProviderConfig helpers
│   ├── WriteJournal.ts      #   WriteJournalOperation union (11 ops), JournalStep, runJournaled, recoverJournal (O.11)
│   ├── IndexedDBMigrator.ts #   IndexedDBMigration registry + openDB bootstrap + DB_VERSION per DB
│   ├── ChatHistoryDB.ts     #   v1: sessions + messages stores (§15.1)
│   ├── MemoryDB.ts          #   v1: messages [conversationId,seq] + userFacts + conversationSummaries (§15.1)
│   ├── NotesDB.ts           #   v1: notes + concepts stores (§15.1)
│   ├── WriteJournalDB.ts    #   v1: entries store (WriteJournalEntry[])
│   └── ErrorStore.ts        #   IDB FIFO 100, debug-only, redactSensitive at boundary
├── core/security/
│   ├── KeyVault.ts          #   installSecret lifecycle → np_install_secret; per-key PBKDF2 derivation
│   └── redactSensitive.ts   #   storage-side redaction primitive (Phase-11 TraceRedactor is separate)
├── core/utils/
│   └── RateLimiter.ts       #   token bucket {capacity, refillPerSecond}; acquire() → RATE_LIMITED
├── core/http/
│   └── Requester.ts         #   UI-side fetch wrapper: AbortController, 25s timeout, optional RateLimiter
├── core/workspace/
│   ├── WorkspaceElection.ts #   NEW: WorkspaceCoordinationState machine, CAS, the ONLY 3s timer
│   └── WorkspaceSync.ts     #   ADD WORKSPACE_HEARTBEAT to WorkspaceSyncMessage union (stays timer-free)
└── core/theme/
    └── chromeStorageAdapter.ts  #   ADD STORAGE_QUOTA/STORAGE_RATE_LIMIT surfacing → ErrorStore
```

### Pattern 1: Primary-writer election state machine (D-24/D-25/D-26)

**What:** `WorkspaceElection.ts` owns the `WorkspaceCoordinationState` machine and the single 3 s heartbeat timer. Election key `np_workspace_primary` in `chrome.storage.session` (shape per spec §15.1 — verbatim: `np_workspace_primary  { tabId, surface, electedAt }` [VERIFIED: PRODUCT_SPEC_v0_1.md:1964]). `isPrimaryWriter()` becomes a pure read of the in-memory state; `WorkspaceStore` imports it from the election module.

**When to use:** on every surface boot; the heartbeat loop is the only `setInterval` in the workspace layer.

**Key mechanics verified this session:**
- The spec state union (verbatim) [VERIFIED: PRODUCT_SPEC_v0_1.md:3233-3238]:
```ts
export type WorkspaceCoordinationState =
  | { state: 'solo'; primarySurface: ActiveSurface }
  | { state: 'primary'; surface: ActiveSurface; secondaries: ActiveSurface[] }
  | { state: 'secondary'; primarySurface: ActiveSurface; isMirroring: boolean }
  | { state: 'election-in-progress'; startedAt: number }
  | { state: 'error'; code: 'ELECTION_TIMEOUT' | 'STORAGE_UNAVAILABLE'; message: string };
```
- Election rules (verbatim) [VERIFIED: PRODUCT_SPEC_v0_1.md:3241]: `Election rules: startup compare-and-set to np_workspace_primary; heartbeat every 3 s; missed 2 heartbeats → re-election; Standalone view has tie-break priority.`
- `chrome.storage.session` is available in all extension contexts (UI pages + SW); content scripts need `setAccessLevel` — not our case (election runs in UI contexts) [CITED: developer.chrome.com/docs/extensions/reference/api/storage].
- **Lone-surface trap:** BroadcastBus suppresses self-messages — verbatim [VERIFIED: src/core/runtime/BroadcastBus.ts:27]: `if (event.data && typeof event.data === 'object' && (event.data as any)._sender === INSTANCE_ID) { return; }`. A single surface never receives its own heartbeat, so "no heartbeat received for 2 intervals" is ambiguous — the machine must distinguish "no other surface exists" (→ solo/primary) from "primary is dead" (→ re-election) using the `electedAt` freshness check on `np_workspace_primary` in session storage.
- Heartbeat writes to session (not debounced — D-43): 1 write/3s = 20/min, well under the ~120/min boundary [CITED: PITFALLS P2 + developer.chrome.com sync MAX_WRITE_OPERATIONS_PER_MINUTE=120].
- Timeout codes already exist in the closed set: `WORKSPACE_ELECTION_TIMEOUT`, `WORKSPACE_STORAGE_UNAVAILABLE` [VERIFIED: PRODUCT_SPEC_v0_1.md:3458-3459] — use them, do not invent.
- Error-state `code: 'ELECTION_TIMEOUT' | 'STORAGE_UNAVAILABLE'` in the union are the *state-machine* codes; the canonical registry codes `WORKSPACE_ELECTION_TIMEOUT`/`WORKSPACE_STORAGE_UNAVAILABLE` are what `debugLog`/ErrorStore receive.

**Integration with Phase-1 handoff (must not break):** `WorkspaceRouter.openStandalone` + `hydrateFromURL` publish `WORKSPACE_HANDOFF` [VERIFIED: src/core/workspace/WorkspaceSync.ts:26-32]; `SidepanelChat` demotes on `WORKSPACE_HANDOFF` for the same workspaceId [VERIFIED: src/components/chat/SidepanelChat.tsx:208-217]. In Phase 2 the standalone boots → election (tie-break wins) → sidepanel receives heartbeats → demotes via election (broadening the MirrorBanner trigger per UI-SPEC §Component Inventory — banner visuals unchanged).

**Testing:** needs a `chrome.storage.session` mock — `tests/setup.ts` currently mocks only local + sync [VERIFIED: tests/setup.ts:142-145]:
```ts
(globalThis as any).chrome.storage = {
  local: chromeStorageLocal as any,
  sync: chromeStorageSync as any,
};
```
Recommend extending setup.ts with a Map-backed session area mirroring the local mock (expose `__chromeStorageSession` + `__chromeSessionMap`). Use `vi.useFakeTimers()` for the 3 s interval; follow the `__test__` timer-seam convention from `chromeStorageAdapter` [VERIFIED: src/core/theme/chromeStorageAdapter.ts:231-247].

### Pattern 2: Journaled storage-adapter wrapper (D-31/D-34 composition)

**What:** a `journalingAdapter` wraps `chromeStorageAdapter` and is installed as WorkspaceStore's `storage:` (replacing the direct `chromeStorageAdapter` reference). It is the single seam where election-gating + journaling + debounce compose without touching zustand internals or WorkspaceSync.

**When to use:** exactly one consumer in Phase 2 — `useWorkspaceStore` persist config (`name: 'np_workspace_store'` [VERIFIED: src/core/workspace/WorkspaceStore.ts:148]).

**Flow per D-34** (primary only): `setItem(name, value)` → parse `value` JSON → extract workspaceId/conversationId → WriteJournalDB put `{status:'pending', operation:'update-workspace'}` (immediate) → `runJournaled` applies `[inner.setItem(name, value) — debounced; notifyWorkspaceUpdate(workspaceId, conversationId)]` → `completed`. Secondary surfaces: `setItem` no-ops when `!isPrimaryWriter()` (mirror-only, D-27). `getItem`/`removeItem` pass through transparently.

**Why the wrapper (not a store-level hook):** zustand `persist` has no onWrite hook; intercepting at the adapter is the existing choke point every persisted store already flows through (per CONTEXT "Established Patterns"). The journal entry write goes straight to IDB (bypasses the debounce naturally — it never touches `chromeStorageAdapter`), satisfying D-34's "journal-entry write bypasses the debounce".

**Journal shape (O.11 — verbatim reference) [VERIFIED: PRODUCT_SPEC_v0_1.md:6633-6672]:**
```ts
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

**Declared-now op union (verbatim) [VERIFIED: PRODUCT_SPEC_v0_1.md:3118-3130]:**
```ts
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

**`update-workspace` ordering (verbatim) [VERIFIED: PRODUCT_SPEC_v0_1.md:3132-3139]:**
```
1. Create WriteJournalEntry(status='pending')
2. Write chrome.storage.local.np_workspace
3. Emit BroadcastBus WORKSPACE_UPDATED
4. Mark WriteJournalEntry(status='completed')
```

⚠️ **Key-name discrepancy to resolve (see Open Question 2):** the spec step says `chrome.storage.local.np_workspace`, but the scaffold's WorkspaceStore persists under `np_workspace_store` [VERIFIED: src/core/workspace/WorkspaceStore.ts:148]. Recommendation: the journaled step writes the key the store actually uses (`np_workspace_store`) — renaming the persisted key is a separate data migration that should be explicitly decided, not slipped in.

**Entry type home:** O.11 imports `WriteJournalEntry` from `@/types/storage` (Appendix C). The repo currently has only `src/types/index.ts` — add `src/types/storage.ts` for `WriteJournalEntry` (status `'pending'|'applying'|'completed'|'rolled-back'`, `id`, `operation`, `attempts`, `steps[]`, `createdAt`) per the declare-now convention. Planner confirms field fidelity — no invention.

### Pattern 3: Async boot-step secret migration (D-28) — never inside `persist.migrate`

**What:** the `np_store` → `np_providers` one-time migration runs as an explicit async routine invoked at surface boot (Options page is the authoritative trigger; sidepanel/standalone may also run it defensively).

**Why not `persist.migrate`:** zustand's migrate is a synchronous function — `migrate: (persisted: any, version) => ...` returns the migrated state [CITED: github.com/pmndrs/zustand docs/reference/middlewares/persist.md:592-601]. PBKDF2 (100 000 iterations) is async; you cannot `await` inside migrate. A sync migrate would have to strip keys *before* encryption succeeds — a crash between strip and encrypt loses keys permanently (violates the one-way D-28 reversibility contract).

**Order (crash-safe + idempotent):**
1. Read `np_store` (via `chromeStorageAdapter.getItem`).
2. If no legacy plaintext (`apiKey`/`openAiKey`/`geminiKey` non-empty) OR `np_providers` already exists with content → skip (idempotent; no re-encryption — preserves D-29 one-way semantics).
3. `KeyVault.ensureInstallSecret()` — generate 32 random bytes once → persist `np_install_secret` (spec §15.1 verbatim key: `np_install_secret     string                               (32 random bytes)` [VERIFIED: PRODUCT_SPEC_v0_1.md:1951]).
4. Derive key per secret field (PBKDF2(installSecret + extensionId, fresh 16-byte salt, 100000, SHA-256) → AES-GCM-256) — scheme verbatim [VERIFIED: PRODUCT_SPEC_v0_1.md:1998-2002]: `installSecret: 32 random bytes, generated once → np_install_secret` / `per-key: random 16-byte salt + 12-byte IV` / `derivedKey: PBKDF2(installSecret + extensionId, salt, 100000, SHA-256) → AES-GCM-256` / `NEVER use navigator.userAgent or any value that changes on browser update.`
5. Write encrypted `np_providers` (whole ProviderConfig shape, apiKey fields replaced by ciphertext blobs) — **commit the new key first**.
6. Strip the three plaintext fields from `np_store` and re-persist `np_store` — **strip second**. Crash between 5 and 6 → next boot re-runs step 6 (idempotent).

**extensionId:** `chrome.runtime.id` — stable per install, does not change on browser update (spec §15.2 forbids userAgent as input). [ASSUMED: chrome.runtime.id stability — well-established Chrome behavior, not re-fetched this session; low risk.]

**Read path (post-migration):** hydrate np_providers → decrypt secret fields on demand (connection check, Phase 3 aiProvider). The masked field contract (UI-SPEC §Visual Anchors) means the Options modal renders `••••••••••••••••` for a saved key and never the decrypted value; the save path preserves the stored ciphertext when the field is untouched.

**Criterion-3 inspection (acceptance bar):** after a provider save, assert the raw `chrome.storage.local` serialized blobs (`np_store`, `np_providers`) do NOT contain the plaintext key as a substring — implement as a test that round-trips a known key value and greps the Map-backed storage mock (`(globalThis as any).__chromeStorageMap`).

### Pattern 4: IndexedDBMigrator — registry + versioned openDB (D-41/D-42)

**What:** per-DB migration registry driving `idb.openDB(name, DB_VERSION, { upgrade })`. Migration interface (verbatim) [VERIFIED: PRODUCT_SPEC_v0_1.md:3144-3149]:
```ts
export interface IndexedDBMigration {
  fromVersion: number;
  toVersion: number;
  description: string;
  migrate(db: IDBPDatabase, tx: IDBPTransaction): Promise<void>;
}
```
**Policy (verbatim) [VERIFIED: PRODUCT_SPEC_v0_1.md:3152-3156]:** every DB declares numeric `DB_VERSION`; every bump includes a migration; migrations deterministic + idempotent where practical; failures → `IDB_MIGRATION_FAILED` in ErrorStore + degraded mode; v4 `notes_backup_config` lands at Phase 9.

**idb mechanics (from the library's own README [CITED: github.com/jakearchibald/idb]):** `upgrade(db, oldVersion, newVersion, transaction, event)` fires only when that version has never been opened — write migrations as `if (oldVersion < N)` conditional blocks so a fresh DB gets all steps. `blocked` callback → surface `IDB_BLOCKED` (existing canonical code) [VERIFIED: PRODUCT_SPEC_v0_1.md:3442]. Typed via `DBSchema`; store shortcuts `db.get/put/add/delete/getAll`; `tx.done` is the commit signal — **never await non-IDB work inside a transaction** (transaction auto-closes; the idb README's canonical failure example is awaiting `fetch` mid-transaction).

**Bootstrap schemas at v1 (from §15.1, verbatim store lists [VERIFIED: PRODUCT_SPEC_v0_1.md:1969-1990]):**
- `ChatHistoryDB`: `sessions  { id, title, created, updated, starred, preview }`, `messages  { sessionId, role, content, timestamp, metadata }`
- `NotesDB`: `notes { id, title, content, created, updated, tags[], links[], source, aiMeta, version, ... }`, `concepts { slug, label, summary, noteIds[], aliases[], updatedAt }` (+ `getNoteByTitle()`)
- `MemoryDB`: `messages { conversationId, seq, role, content, timestamp }   keyPath [conversationId, seq]`, `userFacts UserMemoryFact[]`, `conversationSummaries { conversationId, summary, updatedAt }`
- `ErrorStore (debug only, FIFO max 100)`
- `WriteJournalDB`: `entries   WriteJournalEntry[]`
- `notes_backup_config { dirHandle }` — NOT Phase 2 (v4, Phase 9)

Planner confirms exact index/keyPath detail against §15.1/Appendix C (discretion) — the keyPath `[conversationId, seq]` for MemoryDB messages is explicitly given in the spec.

**v1→v2 fixture (success criterion 4):** use a *fixture* DB name + in-test migration pair (e.g. add a store in v2), prove: (a) v2 open migrates v1 data intact (backward-compatible), (b) running the migration twice is a no-op (idempotent), (c) a fresh open at v2 applies both v1 and v2 steps (conditional-block correctness). Production DBs stay at v1.

**Test harness (recommended — discretion):** `import 'fake-indexeddb/auto'` in `tests/setup.ts` (one line, global); per-test reset `indexedDB = new IDBFactory()` in `beforeEach`. structuredClone is already global in this env (verified). WriteJournalDB/ErrorStore tests reuse the same harness.

### Anti-Patterns to Avoid
- **Async work inside `persist.migrate`:** impossible and dangerous — migrate is sync; secret migration must be a boot step (Pattern 3).
- **A second heartbeat timer:** D-26 is explicit — WorkspaceElection owns the only 3 s tick; WorkspaceSync stays timer-free and only grows the message union.
- **Awaiting non-IDB work inside an idb transaction:** the transaction auto-closes; `tx.done` rejects. Do key derivation/network before opening the write transaction.
- **Inventing error codes:** the closed-set rule is absolute (§0.3/§21.6). Exactly two codes are added (D-38). Every catch must use an existing code or one of the two.
- **Decrypting the stored key into the Options field:** violates the UI-SPEC masked-field contract + criterion 3. `setModalApiKey(detail.apiKey || '')` at OptionsPage.tsx:198 is the scaffold line to remove/replace [VERIFIED: src/components/options/OptionsPage.tsx:198].
- **`np_workspace_primary` in `chrome.storage.local`:** the election record must live in session (spec §15.1) — it is transient coordination state, wiped on browser close by design.
- **Writing journal entries through the debounced adapter:** journal persistence must be immediate (direct IDB) so recovery ordering is exact (D-34).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB boilerplate (requests, transactions, upgrade) | Raw IDB ceremony | idb@8 (`openDB`, typed `DBSchema`, `tx.done`) | Raw IDB is boilerplate-heavy; idb is spec-pinned and ~1.19 kB [CITED: STACK.md:79 + idb README] |
| IndexedDB in unit tests | A custom in-memory IDB mock | fake-indexeddb (`/auto` + `IDBFactory` reset) | A hand-rolled mock misses upgrade/transaction/key-range semantics; fake-indexeddb passes 82.8% of the WPT IDB suite [CITED: fake-indexeddb README] |
| Symmetric encryption / key derivation | A JS crypto library or "simple" XOR/base64 obfuscation | WebCrypto `crypto.subtle` (AES-GCM + PBKDF2) | Never hand-roll crypto; GCM gives authenticated encryption + tamper detection for free [CITED: MDN encrypt] |
| WriteJournal mechanics | A bespoke crash-recovery design | Spec Appendix O.11 `runJournaled`/`recoverJournal` verbatim | The spec's shape is the authoritative reference — idempotent steps + status machine already solve replay/rollback [VERIFIED: PRODUCT_SPEC_v0_1.md:6633-6672] |
| Error code taxonomy | A local ad-hoc error-string set | The closed §21.6/C.2 registry + exactly 2 additions | Closed-set rule is absolute (§0.3/§21.6); a grep audit must pass |
| workspace persist debounce | Re-debouncing or removing D-22 | Keep `chromeStorageAdapter` debounce; wrap with the journaling adapter | D-43: D-22 is frozen; the write-rate assertion must stay green |

**Key insight:** this phase's "hard" problems (encryption, IDB versioning, crash recovery) all have a canonical answer already — the spec's §15.2 scheme, §20.4 policy, and O.11 reference implementation. The planner's job is composition (adapter wrapper, boot-step migration, election state machine), not invention. Custom crypto or a custom IDB mock are the two classic rewrite-causing traps.

## Runtime State Inventory

> This phase performs a **data migration** (`np_store` plaintext secrets → encrypted `np_providers`), so runtime state beyond the repo is in scope.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `chrome.storage.local.np_store` blobs on **existing dev installs** carry plaintext `apiKey` / `openAiKey` / `geminiKey` (the CONCERNS finding — verified in `DEFAULT_CONFIG` and the persist path [VERIFIED: src/store/useExtensionStore.ts:20-87, 523-534]; `CustomProviderDetail.apiKey` at [VERIFIED: src/types/index.ts:108]) | **Data migration:** encrypt → write `np_providers` → strip plaintext → re-persist `np_store` (Pattern 3 — boot-step, idempotent, crash-safe order). Code edit for new installs (partialize excludes secret fields from the `np_store` blob). |
| Stored data | `chrome.storage.local.np_workspace_store` (scaffold key) vs spec `np_workspace` — name discrepancy | **Code edit only** — Phase 2 journals whatever key the store persists (`np_workspace_store`); renaming the persisted key is an explicit decision (Open Question 2). |
| Stored data | New keys created by Phase 2: `np_install_secret`, `np_providers` (both local), `np_workspace_primary` (session) | Code edit — creation paths, no existing records to migrate. |
| Stored data | IndexedDB: none exists yet in production (no IDB code ships before Phase 2 — verified `src/` has no IDB usage) | Code edit — bootstrap 5 DBs at v1 (D-41/D-42). |
| Live service config | None — no external services configured this phase (Requester has no consumers until Phase 3; no CORSProxy) | — |
| OS-registered state | None — no OS registrations involved | — |
| Secrets / env vars | Plaintext keys in the persisted `np_store` (dev profiles); no env files or CI vars involved | Data migration (above). `np_install_secret` is new. |
| Build artifacts | None — `src/core/storage|security|utils|http` dirs do not exist yet (verified `src/core/` listing); no package renames | Code edit — new files only. |

**Canonical question answered:** after every file is updated, the only runtime system holding the old plaintext shape is `chrome.storage.local.np_store` on existing installs — handled by the idempotent boot migration; everything else is new-key creation.

## Common Pitfalls

### Pitfall 1: WebCrypto unavailable in the test environment
**What goes wrong:** `crypto.subtle` is undefined; EncryptedStorage tests fail with "crypto.subtle is not a function".
**Why it happens:** jsdom does not implement WebCrypto; older Node (< 18) has no global `crypto.subtle`.
**How to avoid:** verified this session — this repo (Node 24 + vitest 3.2.7 + jsdom 25) has `crypto.subtle` on both `globalThis` and `window`, and an AES-GCM round-trip passes. No polyfill needed. Document the Node ≥ 20 requirement in the test plan; if a CI image ever uses older Node, add `import { webcrypto } from 'node:crypto'; (globalThis as any).crypto ??= webcrypto;` to `tests/setup.ts`.
**Warning signs:** `typeof crypto.subtle === 'undefined'` in a test run.

### Pitfall 2: Async work smuggled into zustand `persist.migrate`
**What goes wrong:** the np_store→np_providers migration silently skips or corrupts keys; keys stripped before encryption → permanent loss.
**Why it happens:** migrate is synchronous by contract; PBKDF2/AES-GCM are async.
**How to avoid:** Pattern 3 — explicit async boot-step migration; never call `crypto.subtle` inside migrate; keep `npStoreMigrate` a no-op for version 1.
**Warning signs:** a `migrate` callback containing `await` or `.then(`.

### Pitfall 3: IDB transaction auto-close
**What goes wrong:** `tx.done` rejects with "transaction inactive"; writes silently lost; migration appears to succeed but data missing.
**Why it happens:** an IndexedDB transaction closes when the microtask queue drains; awaiting `fetch`/crypto between statements kills it (idb README's canonical warning).
**How to avoid:** derive keys / read network data BEFORE `db.transaction(...)`; do all store operations inside the transaction; `await tx.done` as the commit signal.
**Warning signs:** "TransactionInactiveError", flaky migration tests.

### Pitfall 4: Election heartbeat self-suppression (lone surface)
**What goes wrong:** a single surface never becomes primary (or flip-flops) because it never sees its own heartbeat.
**Why it happens:** BroadcastBus filters `_sender === INSTANCE_ID` self-messages [VERIFIED: src/core/runtime/BroadcastBus.ts:27].
**How to avoid:** treat "no heartbeat received from another surface for 2 intervals AND `np_workspace_primary.electedAt` is mine/fresh" as solo/primary; only enter re-election when the session record is stale or a foreign heartbeat proves another surface exists. Unit-test both the 1-surface and 2-surface cases.
**Warning signs:** `WORKSPACE_ELECTION_TIMEOUT` storms in debugLog on a single-open install.

### Pitfall 5: `chrome.storage.session` missing from tests/setup.ts
**What goes wrong:** WorkspaceElection tests throw "chrome.storage.session is not a function".
**Why it happens:** setup.ts mocks local + sync only [VERIFIED: tests/setup.ts:142-145].
**How to avoid:** extend setup.ts with a Map-backed session area + `__chromeSessionMap` helper (mirror the local mock); reset in `beforeEach`.
**Warning signs:** election test file fails at module import.

### Pitfall 6: Quota errors arrive as message text, not typed codes
**What goes wrong:** the adapter fails to classify STORAGE_QUOTA/STORAGE_RATE_LIMIT and swallows or mislabels.
**Why it happens:** chrome.storage rejects with `runtime.lastError` message text ("QUOTA_BYTES", "QUOTA_BYTES_PER_ITEM", "MAX_WRITE_OPERATIONS_PER_MINUTE") — no typed error object [CITED: developer.chrome.com — quota-exceeding writes fail immediately and set runtime.lastError / reject the Promise].
**How to avoid:** classify by matching the message (QUOTA* → STORAGE_QUOTA; MAX_WRITE_OPERATIONS* → STORAGE_RATE_LIMIT) in the flush catch, then `redactSensitive` + ErrorStore + debugLog. Keep `flushPendingWrites()` behavior stable for the beforeunload path.
**Warning signs:** tests asserting error codes against a mock that never rejects (setup.ts's set() always resolves — make it reject via `mockRejectedValue` for these tests).

### Pitfall 7: `unlimitedStorage` expected to lift the session cap
**What goes wrong:** large election/heartbeat payloads or token blobs overflow session storage; silent write drops.
**Why it happens:** `unlimitedStorage` exempts **only** `storage.local` quota/eviction; session QUOTA_BYTES = 10 MB stays [CITED: developer.chrome.com — "This value will be ignored if the extension has the unlimitedStorage permission" appears only on the local area].
**How to avoid:** keep `np_workspace_primary` writes tiny ({tabId, surface, electedAt}); never route bodies or journals through session (D-33 already mandates IDB for journal entries).
**Warning signs:** QUOTA_BYTES rejections on session writes.

### Pitfall 8: Migration written as unconditional schema changes (v1→v2)
**What goes wrong:** a fresh DB opened at v2 skips v1 steps, or an upgrade replays steps it already applied.
**Why it happens:** idb's `upgrade` fires only when that version was never opened; unconditional `createObjectStore` calls throw "already exists" on replay.
**How to avoid:** conditional blocks (`if (oldVersion < N) { ... }`), skip-if-present guards for store/field creation (the spec's v4 note: "Idempotent: skip if store/fields already present" [VERIFIED: PRODUCT_SPEC_v0_1.md:3156]); prove with the v1→v2 fixture.
**Warning signs:** "ConstraintError: ... already exists" in migration tests.

### Pitfall 9: NP-STRICT ceiling regression
**What goes wrong:** `verify:phase-2` fails the strict-mode gate if new code adds `@ts-expect-error NP-STRICT` markers.
**Why it happens:** `NP_STRICT_CEILING: 0` in package.json [VERIFIED: package.json:7]; the gate counts live markers via git grep [VERIFIED: tests/core/strict/np-strict-ceiling.test.ts:78-103]. Phase 2–3 must reduce the ceiling to 0 — new Phase-2 code must be strict-clean from the start.
**How to avoid:** write strict-clean code; use real types for `WorkspaceElection`, journal entries, and encrypted blobs; no new markers.
**Warning signs:** gate failure message listing offenders.

### Pitfall 10: Persisted `np_store` still leaking secrets via partialize omission
**What goes wrong:** criterion 3 fails — the raw key appears in the `np_store` blob even though `np_providers` is encrypted.
**Why it happens:** `useExtensionStore`'s `partialize` currently excludes only `activeSession`/`activeAttachments`/`availableTabs` [VERIFIED: src/store/useExtensionStore.ts:525-528]; the config object (with plaintext keys in memory) is still serialized wholesale.
**How to avoid:** extend partialize to exclude/empty the secret fields (`providers.*.apiKey`, `openAiKey`, `geminiKey`) so the persisted blob never carries them; read secrets exclusively from decrypted `np_providers`; add the substring-inspection test.
**Warning signs:** inspection test greps the mock storage map and finds the key.

## Code Examples

Verified patterns from official sources:

### EncryptedStorage core — AES-GCM + PBKDF2 (matches spec §15.2 exactly)
```typescript
// Source: MDN SubtleCrypto.encrypt + deriveBits examples; parameters per spec §15.2
// Encrypt: 12-byte IV (MDN canonical), AES-GCM-256, authenticated.
async function encryptAesGcm(key: CryptoKey, plaintext: Uint8Array, iv: Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
}
async function decryptAesGcm(key: CryptoKey, ciphertext: ArrayBuffer, iv: Uint8Array): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext); // rejects on tamper
}
// Derive the per-key AES-256 key: PBKDF2(installSecret + extensionId, salt, 100000, SHA-256)
// Source: MDN SubtleCrypto.deriveBits — the canonical PBKDF2 example uses exactly
// salt = getRandomValues(new Uint8Array(16)), iterations 100000, hash 'SHA-256', length 256.
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
Note: spec §15.2 says `PBKDF2(installSecret + extensionId, salt, ...)` — the concatenation input is the exact locked scheme; implement it as one byte-string (e.g. base64(installSecret) + extensionId, or raw bytes + utf8 id — planner/executor picks one deterministic encoding and documents it in a code comment).

### idb openDB with conditional migrations (spec §20.4 policy + idb README pattern)
```typescript
// Source: idb README (jakearchibald/idb) + spec §20.4 IndexedDBMigration
import { openDB, type DBSchema, type IDBPDatabase, type IDBPTransaction } from 'idb';

export interface WriteJournalDBV1 extends DBSchema {
  entries: { key: string; value: WriteJournalEntry };
}
export const WRITE_JOURNAL_DB = 'WriteJournalDB';
export const WRITE_JOURNAL_DB_VERSION = 1;

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
// Migration failure path: wrap bootstrap in try/catch → debugLog('IDB_MIGRATION_FAILED', ...) +
// ErrorStore.record({ code: 'IDB_MIGRATION_FAILED', ... }) → degraded mode (spec §20.4)
```

### fake-indexeddb test harness (works with idb; Node 24 has structuredClone)
```typescript
// Source: fake-indexeddb README — auto-import + IDBFactory reset
import 'fake-indexeddb/auto'; // installs global indexedDB — recommended in tests/setup.ts
import { IDBFactory } from 'fake-indexeddb';
// beforeEach: indexedDB = new IDBFactory(); // fresh state per test
```
Verified this session: `structuredClone` is a global function in this repo's vitest jsdom env (Node 24), so the fake-indexeddb v5+ requirement is satisfied without a polyfill.

### chrome.storage.session election record (spec §15.1 + §20.11)
```typescript
// Source: developer.chrome.com storage API + spec §15.1/§20.11
// np_workspace_primary  { tabId, surface, electedAt }  (session area — transient)
const record = { tabId: 0, surface: 'sidepanel' as const, electedAt: Date.now() };
await chrome.storage.session.set({ np_workspace_primary: record });
const read = await chrome.storage.session.get('np_workspace_primary');
// CAS = read → freshness check (electedAt within 2 heartbeat windows) → set own record if empty/stale;
// tie-break: standalone surface wins when both attempt concurrently (§20.11)
```
Election error codes (already in the closed set — use verbatim): `WORKSPACE_ELECTION_TIMEOUT`, `WORKSPACE_STORAGE_UNAVAILABLE` [VERIFIED: PRODUCT_SPEC_v0_1.md:3458-3459].

### RateLimiter token bucket + Requester (D-35..D-37; Phase 3 consumer)
```typescript
// Source: spec §13 "RateLimiter is per-instance" + §10.7 25s Promise.race
export interface RateLimiterOptions { capacity: number; refillPerSecond: number }
export class RateLimiter {
  constructor(private opts: RateLimiterOptions) { /* tokens = capacity; refill via elapsed-time math */ }
  acquire(): boolean { /* token available → consume, true; else false (caller maps to RATE_LIMITED) */ }
}
// Requester: UI-context fetch wrapper — AbortController threaded, 25s timeout, optional injected limiter
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
// Error codes TIMEOUT / NETWORK / RATE_LIMITED are all existing canonical codes (§21.6)
```

### ErrorStore FIFO-100 write (spec §15.1 + §16.5 redaction)
```typescript
// Source: spec §15.1 "ErrorStore (debug only, FIFO max 100)" + §16.5 redact-before-write
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

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Provider keys plaintext in the `np_store` blob (CONCERNS finding) | Encrypted `np_providers` key (AES-GCM-256, PBKDF2-derived per-key) | Phase 2 (D-28) | Closes the plaintext-secret CONCERNS finding; reinstall loses keys (documented one-way, D-29) |
| `isPrimaryWriter()` always `true` (Phase-1 stub) | Real election: CAS on `np_workspace_primary`, 3 s heartbeat, 2-miss re-election, Standalone tie-break | Phase 2 (D-24) | Every later phase's write gating reads through this one symbol |
| Adapter swallows quota/rate failures into `debugLog` | `STORAGE_QUOTA` / `STORAGE_RATE_LIMIT` surfaced → ErrorStore | Phase 2 (D-38/D-39) | Fixes the unhandled-QUOTA_BYTES CONCERNS gap; silent data loss becomes diagnosable |
| No IndexedDB (scaffold persisted everything to `np_store`) | 5 IDB DBs bootstrapped at v1 + versioned migrator | Phase 2 (D-41/D-42) | Message/note/memory bodies move to IDB; unlimitedStorage exempts origin from quota/eviction |
| No crash-safety for multi-store writes | WriteJournal with boot-time recovery (O.11) | Phase 2 (D-31..D-34) | SW suspension mid-write no longer loses state |

**Deprecated/outdated:**
- **`navigator.storage.persist()` as a quota/eviction substitute:** explicitly rejected (ADR-STACK-02) — not reliable in extensions; use the `unlimitedStorage` permission.
- **`chrome.storage.session` as durable storage:** wiped on reload/update/restart [CITED: developer.chrome.com]; the election record is transient by design, journals/keys live in IDB/local.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `chrome.runtime.id` is stable across sessions and does not change on browser update (valid PBKDF2 input; spec §15.2 forbids userAgent) | Architecture Patterns — Pattern 3 | Low: it is the documented stable-per-install identifier; if wrong, decryption fails deterministically on all persisted ciphertext (detected by round-trip test) |
| A2 | The journaled write targets the scaffold's actual persisted key `np_workspace_store` (not the spec's `np_workspace`) until a rename decision is made | Open Question 2 | Medium: if the planner renames to `np_workspace`, an additional key-rename migration is required; journal entries would replay to the wrong key |
| A3 | WorkspaceStore persist is the only journaled path in Phase 2; the journaling adapter wrapper is the recommended (not locked) composition point | Architecture Patterns — Pattern 2 | Medium: an alternative store-level intercept is equally valid; planner's call per discretion |
| A4 | `WriteJournalEntry` type home is a new `src/types/storage.ts` (O.11 imports from `@/types/storage`) | Architecture Patterns — Pattern 2 | Low: file-location choice only; typecheck-localized |
| A5 | Session write rate for heartbeats (1/3 s = 20/min) is safely under the ~120/min boundary | Pattern 1 | Low: even with np_workspace persists (debounced), combined steady-state stays ≤30/min per D-43 |
| A6 | The `np_store` config keeps plaintext keys in *memory* for Phase-3 runtime use; only persisted blobs are stripped/encrypted | Pattern 3 | Medium: if a later phase reads persisted config expecting decrypted keys, the read path must decrypt from np_providers (already planned) |
| A7 | PBKDF2/deriveKey mechanics (`importKey('raw', ..., 'PBKDF2', false, ['deriveKey'])` + `deriveKey(Pbkdf2Params, ..., AesKeyGenParams)`): parameters verified via MDN deriveBits example; `deriveKey` composition is standard WebCrypto | Code Examples | Low: MDN states `deriveKey()` = `deriveBits()` + `importKey()` |
| A8 | `unlimitedStorage` in wxt.config permissions is sufficient to exempt the extension origin from IndexedDB quota/eviction in Chrome | Pattern 4 / D-40 | Low: documented Chrome behavior (local quota ignored with the permission; IDB origin quota lifted) |

## Open Questions (RESOLVED — all four resolved at planning time 2026-08-24; see inline outcomes)

1. **Persisted workspace key name: `np_workspace_store` (scaffold) vs `np_workspace` (spec §15.1)** — **(RESOLVED: the rename WAS decided, overriding this section's original recommendation)**
   - What we know: WorkspaceStore persists under `name: 'np_workspace_store'` [VERIFIED: src/core/workspace/WorkspaceStore.ts:148]; the spec's storage layout and §20.3 ordering reference `np_workspace` [VERIFIED: PRODUCT_SPEC_v0_1.md:1955, 3136]; the BroadcastChannel is named `np_workspace` [VERIFIED: src/core/workspace/WorkspaceSync.ts:3].
   - What's unclear: whether Phase 2 should rename the persisted key (requires a data migration of existing blobs + `np_workspace_primary`/channel naming consistency) or keep the scaffold key and treat `np_workspace` as the spec's logical name.
   - Recommendation: keep `np_workspace_store` in Phase 2 (no re-open; journal writes that key); flag the rename for the discuss-phase if the user wants spec-exact key naming. Journal entries would replay to the wrong key if the rename is decided later — decide before implementing the journal adapter.
   - **Outcome:** Phase 2 renames the persisted key to `np_workspace` (plan 02-07 Task 1 persist `name` change) with a one-time idempotent lift (read → write → verify → delete) inside the journalingAdapter's `getItem` (plan 02-05 Task 2; PATTERNS Workspace-key migration rule, 02-PATTERNS.md:123). The lift makes the rename crash-safe: journal entries target the single canonical `np_workspace` key from day one and the replay-to-wrong-key hazard is eliminated. All Phase-2 journal/recovery code, tests, and plan 02-07's persist config target `np_workspace` only.

2. **Heartbeat record refresh frequency in session storage** — **(RESOLVED)**
   - What we know: D-43 says heartbeats write `np_workspace_primary` to session, not debounced; D-26 says the heartbeat message rides the `np_workspace` channel.
   - What's unclear: whether `electedAt` is refreshed on *every* 3 s tick (20 session writes/min) or only on startup/re-election (heartbeat = channel message only).
   - Recommendation: refresh on every tick (simplest, matches "heartbeat" semantics; 20/min is safe). The freshness check that drives 2-miss detection then uses the session record's `electedAt`.
   - **Outcome:** adopted — plan 02-06 Task 1's heartbeat loop refreshes `electedAt` on every 3 s tick (20 session writes/min, NOT debounced per D-43); 2-miss detection reads the session record's freshness.

3. **Where `recoverJournal()` and `WorkspaceElection.start()` mount in the entrypoints** — **(RESOLVED)**
   - What we know: `recoverJournal` must run on surface boot [D-31]; election on surface boot [D-24]; the entrypoints are `entrypoints/sidepanel/main.tsx`, `entrypoints/standalone/main.tsx`, `entrypoints/options/main.tsx` (WXT directory form).
   - What's unclear: a shared boot module vs per-entrypoint calls; whether Options needs the full election (it does not write workspace state — likely election-free, but must read `np_providers` and run the secret migration).
   - Recommendation: a small `bootstrap()` per surface (sidepanel/standalone: recoverJournal → migrator → election; options: migrator → secret migration → providers read); planner wires per entrypoint.
   - **Outcome:** adopted — per-entrypoint boot in plan 02-07 Task 2: sidepanel/standalone = recoverJournal → IndexedDBMigrator.bootstrap → startElection(surface) → setStorageErrorReporter; options = IndexedDBMigrator.bootstrap → migrateProviderSecrets → hydrateProviderSecrets (decrypt-on-read) → setStorageErrorReporter → encrypted providers read (no election — Options does not write workspace state).

4. **ErrorStore failure semantics when IDB itself is unavailable** — **(RESOLVED)**
   - What we know: ErrorStore writes can fail (IDB blocked/degraded); §20.4 mandates degraded mode on migration failure.
   - What's unclear: whether a failed ErrorStore write cascades (e.g. adapter flush must not throw into the zustand persist path).
   - Recommendation: ErrorStore.record is best-effort — internal try/catch + `debugLog` fallback (in-memory sibling); never rethrow into the caller.
   - **Outcome:** adopted — plan 02-04 Task 3 wraps `record` in an internal try/catch with a `debugLog(code, message)` fallback and never rethrows into the caller (best-effort contract).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (≥ 20 for global WebCrypto) | EncryptedStorage tests | ✓ | 24.19.0 | — |
| pnpm | installs idb + fake-indexeddb | ✓ | 11.22.0 | npm (lockfile ambiguity — CONCERNS dual-lockfile note; use pnpm per package.json `packageManager`) |
| vitest | all Phase-2 tests | ✓ | 3.2.7 installed (package.json `^3.0.0`) | — |
| jsdom | vitest env | ✓ | 25.0.0 | — |
| `crypto.subtle` in test env | EncryptedStorage.test.ts | ✓ (empirically verified) | Node 24 webcrypto | `import { webcrypto } from 'node:crypto'` stub in tests/setup.ts (only needed on older Node) |
| `structuredClone` in test env | fake-indexeddb v5+ | ✓ (empirically verified) | Node 24 global | core-js polyfill (not needed here) |
| fake-indexeddb | IDB test harness | ✗ (not installed) | 6.2.5 available | custom harness (not recommended — Pitfall/Don't-Hand-Roll) |
| idb | IndexedDB wrapper | ✗ (not installed) | 8.0.3 available | raw IDB (not recommended — spec pins idb) |
| `chrome.storage.session` mock | WorkspaceElection tests | ✗ (missing from tests/setup.ts) | — | per-file inline stub (acceptable, but setup.ts extension is cleaner) |

**Missing dependencies with no fallback:** none — all gaps are installs (idb, fake-indexeddb) or test-infra additions (session mock, fake-indexeddb/auto import), both in the planner's control.

**Missing dependencies with fallback:** `chrome.storage.session` mock (per-file stub fallback); WebCrypto/structuredClone (polyfill stubs, only needed on Node < 20).

## Validation Architecture

> `workflow.nyquist_validation: true` in `.planning/config.json` — section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 3.2.7 (installed; package.json `^3.0.0`) |
| Config file | `vitest.config.ts` (jsdom, globals, setupFiles `./tests/setup.ts`, `@` alias) |
| Quick run command | `pnpm exec vitest run tests/core/storage tests/core/security tests/core/utils tests/core/workspace/WorkspacePersistence.test.ts` |
| Full suite command | `pnpm run verify:phase-2` (= `tsc --noEmit && vitest run tests/core/storage tests/core/security tests/core/utils tests/core/workspace/WorkspacePersistence.test.ts` — [VERIFIED: package.json:19]) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| §18/DONE 1 | WriteJournal recovery: simulated SW kill mid-write → replay restores state; idempotent replay; rollback on step failure | unit | `vitest run tests/core/storage/WriteJournal.test.ts` | ❌ Wave 0 |
| §18/DONE 2 | API key AES-GCM round-trip (encrypt → local → decrypt); wrong-key/tamper rejection | unit | `vitest run tests/core/storage/EncryptedStorage.test.ts` | ❌ Wave 0 |
| §18/DONE 3 | No message body / raw secret in chrome.storage.local (substring-inspection of mock storage map after provider save) | unit | `vitest run tests/core/security` (inspection test) | ❌ Wave 0 |
| §18/DONE 4 | v1→v2 migration fixture: idempotent + backward-compatible (fixture DB pair) | unit | `vitest run tests/core/storage/IndexedDBMigrator.test.ts` | ❌ Wave 0 |
| §18/DONE 5 | Workspace persists across reload + cross-surface handoff; election-gated persist; mirror skip | integration | `vitest run tests/core/workspace/WorkspacePersistence.test.ts` | ❌ Wave 0 |
| REQ-R07/D-39 | Adapter surfaces STORAGE_QUOTA / STORAGE_RATE_LIMIT (mock rejects) → ErrorStore + debugLog; no swallow | unit | extend `tests/core/storage/chromeStorageAdapter.test.ts` | ✅ (file exists; error tests to add) |
| D-36 | RateLimiter token bucket: burst consumption, refill, RATE_LIMITED on empty | unit | `vitest run tests/core/utils/RateLimiter.test.ts` | ❌ Wave 0 |
| D-24..D-27 | WorkspaceElection: CAS, 3s heartbeat, 2-miss re-election, Standalone tie-break, solo case | unit | `vitest run tests/core/workspace` (new WorkspaceElection.test.ts) | ❌ Wave 0 |
| D-28..D-30 | KeyVault: installSecret once-only, per-key derivation, np_store→np_providers migration idempotent + crash-order | unit | `vitest run tests/core/security` (KeyVault + migration tests) | ❌ Wave 0 |
| D-39 | ErrorStore FIFO-100 eviction, redaction at write boundary | unit | `vitest run tests/core/storage/ErrorStore.test.ts` (implied) | ❌ Wave 0 |
| D-40 | wxt.config permissions = `['sidePanel','storage','tabs','unlimitedStorage']` | smoke | `verify:phase-2` tsc + manifest assert | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm exec vitest run <task's test file> -t <behavior>` (single-file)
- **Per wave merge:** `pnpm exec vitest run tests/core/storage tests/core/security tests/core/utils tests/core/workspace/WorkspacePersistence.test.ts`
- **Phase gate:** full `pnpm run verify:phase-2` green (tsc + all Phase-2 tests) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Install `idb@^8` (spec-pinned) + `fake-indexeddb@^6` (devDep) — `pnpm add idb@^8 && pnpm add -D fake-indexeddb@^6`
- [ ] `tests/setup.ts` — add `import 'fake-indexeddb/auto'` + Map-backed `chrome.storage.session` mock (`__chromeSessionMap`); verify it does not break the existing 9 Phase-1 test files
- [ ] `tests/core/security/` and `tests/core/utils/` directories — do not exist (verified this session); required by the verify:phase-2 vitest path args
- [ ] `tests/core/workspace/WorkspacePersistence.test.ts` — required by verify:phase-2; does not exist
- [ ] `tests/core/storage/WriteJournal.test.ts`, `EncryptedStorage.test.ts`, `IndexedDBMigrator.test.ts`, `tests/core/utils/RateLimiter.test.ts` — the four spec-required test files (all absent)
- [ ] Extend `tests/core/storage/chromeStorageAdapter.test.ts` — quota/rate-limit surfacing tests (mock `set` must be able to reject)

## Security Domain

> `workflow.security_enforcement: true` in `.planning/config.json` — section required.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no auth flows in Phase 2; provider auth is Phase 3's concern) |
| V3 Session Management | no | — (session tokens `np_jsessionid`/`np_sysparm_ck` are Phase 17; session storage policy already set by §15.1) |
| V4 Access Control | no | — (no permission boundaries introduced; `unlimitedStorage` is a manifest permission, not access control) |
| V5 Input Validation | yes | zod schemas for persisted cross-boundary shapes: `np_providers` blob, `WriteJournalEntry`, `WorkspaceCoordinationState` (CLAUDE.md convention: "All cross-boundary data uses Zod validation") |
| V6 Cryptography | yes | WebCrypto `crypto.subtle` only — AES-GCM-256 (authenticated) + PBKDF2 (100k, SHA-256); never hand-roll; key derivation inputs stable per §15.2 (never `navigator.userAgent`) |

### Known Threat Patterns for {stack}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Plaintext API keys at rest in chrome.storage.local (CONCERNS finding) | Information Disclosure | D-28 encrypt-at-rest: secrets → `np_providers` AES-GCM-256; `np_store` partialize strips secret fields; inspection test asserts no plaintext substring |
| Secret leakage into logs / ErrorStore | Information Disclosure | §16.5 rule — `redactSensitive()` runs before ErrorStore writes and at persist boundaries; never log key values |
| Storage quota/rate-limit silent data loss | Denial of Service | D-39 adapter surfacing (`STORAGE_QUOTA` / `STORAGE_RATE_LIMIT`) → ErrorStore + debugLog; D-22 debounce keeps steady-state ≤30 writes/min |
| Ciphertext tampering / forgery | Tampering | AES-GCM built-in authentication (decrypt rejects on any modification) [CITED: MDN] |
| Key loss on reinstall (availability) | Availability | Documented, accepted one-way trade-off (D-29) — no recovery/export in v0.1; `np_install_secret` never duplicated |
| Election record spoofing / stale primary | Spoofing | `electedAt` freshness check + 2-miss re-election (§20.11); election key lives in session (transient, cleared on browser close) |

## Sources

### Primary (HIGH confidence)
- [PRODUCT_SPEC_v0_1.md] — §15.1/§15.2, §18 Phase 2 block, §20.3/§20.4/§20.11, §13, §21.5/§21.6, §10.7, §16.4, §0.3, Appendix O.11, Appendix C.2 (all read this session, verbatim quotes inline)
- [developer.chrome.com/docs/extensions/reference/api/storage] — local/session/sync quotas, unlimitedStorage semantics, rate limits (updated 2026-05-05)
- [github.com/jakearchibald/idb README] — openDB/upgrade/blocked API, DBSchema typing, transaction lifetime
- [github.com/dumbmatter/fakeIndexedDB README] — auto-import, IDBFactory reset, structuredClone note, WPT pass rate
- [developer.mozilla.org SubtleCrypto.encrypt + deriveBits] — AES-GCM 12-byte IV, PBKDF2 params (16-byte salt, 100000, SHA-256, 256 bits)
- [github.com/pmndrs/zustand docs/reference/middlewares/persist.md] — migrate/partialize/merge semantics (sync migrate)
- In-repo source reads (this session): chromeStorageAdapter.ts, WorkspaceStore.ts, WorkspaceSync.ts, WorkspaceRouter.ts, BroadcastBus.ts, debugLog.ts, useExtensionStore.ts, src/types/index.ts, OptionsPage.tsx (160-279), MirrorBanner.tsx, wxt.config.ts, tests/setup.ts, package.json, vitest.config.ts, np-strict-ceiling.test.ts, SidepanelChat.tsx (195-244)
- Empirical probes (this session): `crypto.subtle` + `structuredClone` available in vitest jsdom env; AES-GCM round-trip passed; `indexedDB` undefined; npm registry: idb 8.0.3, fake-indexeddb 6.2.5; both legitimacy-checked OK

### Secondary (MEDIUM confidence)
- [.planning/research/PITFALLS.md P2] — ~120 writes/min silent drop, session 10 MB cap NOT lifted by unlimitedStorage (cross-checked against developer.chrome.com this session)
- [.planning/research/STACK.md] — idb ^8 pin + Phase-2 install line; VAI-04 version watch (re-queried this session: versions match)
- [.planning/codebase/CONCERNS.md] — plaintext API keys, unhandled QUOTA_BYTES, np_store full-blob re-serialization (all verified against source this session)
- [.planning/codebase/TESTING.md] — test conventions, missing-IDB-mock gap (confirmed), verify:phase-N stale-path analysis
- [.planning/adr/ADR-STACK-02] — unlimitedStorage decision + verification contract

### Tertiary (LOW confidence)
- none marked for validation — every external claim was fetched from an official source or empirically probed this session. Remaining `[ASSUMED]` items are in the Assumptions Log (A1–A8).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — idb/fake-indexeddb versions verified on registry + official READMEs; legitimacy gate OK; spec-pinned
- Architecture: HIGH — every pattern grounded in spec sections read verbatim this session + in-repo source files read this session; composition points (adapter wrapper, boot migration) flagged where planner discretion applies
- Pitfalls: HIGH — all 10 verified against either this session's source reads or official docs; the two environment risks (crypto.subtle, structuredClone) were empirically disproven rather than assumed

**Research date:** 2026-08-23
**Valid until:** 2026-09-22 (30 days — stack stable; re-verify idb/fake-indexeddb versions at install per VAI-04)