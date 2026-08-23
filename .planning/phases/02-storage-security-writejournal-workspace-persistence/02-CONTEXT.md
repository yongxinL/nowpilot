# Phase 2: Storage, Security, WriteJournal, Workspace Persistence - Context

**Gathered:** 2026-08-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the persistence + security foundation every later phase builds on: **encrypt-at-rest** (KeyVault + EncryptedStorage, AES-GCM-256), **IndexedDB bodies** (ChatHistoryDB / MemoryDB / NotesDB / WriteJournalDB / ErrorStore + versioned migrator), **crash-safe multi-store writes** (WriteJournal), **error-surfacing storage adapter** (STORAGE_QUOTA / STORAGE_RATE_LIMIT), **primary-writer election** (the D-16 swap point), and **cross-surface workspace persistence** verified by the WorkspacePersistence test.

**Scope is per spec §18 Phase 2.** Create list (12 files): `src/core/storage/{Setting,EncryptedStorage,WriteJournal,IndexedDBMigrator,ChatHistoryDB,MemoryDB,NotesDB,ErrorStore}.ts`, `src/core/security/{KeyVault,redactSensitive}.ts`, `src/core/utils/RateLimiter.ts`, `src/core/http/Requester.ts`. Required tests: `WriteJournal.test.ts`, `EncryptedStorage.test.ts`, `IndexedDBMigrator.test.ts`, `RateLimiter.test.ts`, `WorkspacePersistence.test.ts`. DONE-when checklist: WriteJournal recovery test passes; API key AES-GCM round-trip passes; no message body/raw secret in chrome.storage.local; v1→v2 migration fixture passes (idempotent, backward-compatible); workspace persists across reload + cross-surface handoff.

**Out of scope (verified in spec §18 / PROJECT.md / REQUIREMENTS.md):** AI runtime + persona (Phase 3), memory/notes data migrations (owning phases), dual-LLM quarantine (ADR-SEC-01 → v0.2), defuddle/extraction (Phase 6), filesystem sync (Phase 9), diagnostics panel (Phase 11), add-on tooling (Phase 17/18).

**Research-driven requirements landing here (from `.planning/RESEARCH-RECONCILIATION.md` §D):** REQ-R06 `unlimitedStorage` (ADR-STACK-02), REQ-R07 storage adapter error codes, REQ-R03 `np_workspace` write coalescing (already landed in Phase 1 via D-22; Phase 2 verifies interplay, does NOT re-open).

</domain>

<decisions>
## Implementation Decisions

### Workspace election — the D-16 swap point (spec §20.11, §13)

- **D-24 (Full election now — spec §20.11):** Phase 2 implements the complete primary-writer election: startup CAS on `np_workspace_primary` in `chrome.storage.session`, 3 s heartbeat, 2-miss → re-election, Standalone view tie-break priority, secondary surfaces mirror. `WorkspaceStore.isPrimaryWriter()` stops returning a stub `true` and becomes a **pure read** of the in-memory election result. This is the Phase-1 D-16 documented swap point. — **Reversibility:** `costly` — rationale: replaces the frozen Phase-1 predicate contract; every later phase's write gating (MemoryEngine, notes) reads through this one symbol.
- **D-25 (Election lives in `src/core/workspace/WorkspaceElection.ts`):** New dedicated module owns `WorkspaceCoordinationState` (§20.11) and all CAS/heartbeat/re-election logic against `np_workspace_primary`. Deliberate separation from the persist store and from WorkspaceSync so the state machine is isolated and unit-testable. — **Reversibility:** `reversible` — rationale: additive module; no public contract change beyond `isPrimaryWriter()` behavior.   Lifecycle ownership: each surface creates exactly one WorkspaceElection instance during WorkspaceStore bootstrap and disposes it on surface unload. Multiple election instances per surface are prohibited.
- **D-26 (Single heartbeat lifecycle — no second timer):** The scaffold's `WorkspaceSync.ts` is a 32-line pure pub/sub layer over `np_workspace` — it does **NOT** own a heartbeat timer today (spec Appendix M.3's timer never shipped). Therefore WorkspaceElection owns the **only** 3 s tick; WorkspaceSync stays timer-free and just adds `WORKSPACE_HEARTBEAT` to its `WorkspaceSyncMessage` union so the election heartbeat rides the existing `np_workspace` BroadcastChannel. No second timer, no second channel; D-22 debounce untouched. — **Reversibility:** `reversible` — rationale: additive message type + one timer owner.
- **D-27 (Gate `np_workspace` persist on the election now):** `isPrimaryWriter()` gates a real Phase-2 write path so the predicate is exercised in production, not just tests — secondary surfaces skip persist (mirror only), primary runs the journaled persist. MemoryEngine/note-write gating still lands in Phase 8+. — **Reversibility:** `reversible` — rationale: one write path gated; ungating is a predicate change.

### Encryption wiring + key migration (spec §15.1, §15.2; CONCERNS "API keys stored plaintext")

- **D-28 (Wire live + migrate plaintext now):** EncryptedStorage + KeyVault are wired into live provider storage in Phase 2 (not primitives-only). Provider config moves out of `np_store` into a dedicated `np_providers` key in `chrome.storage.local` with `apiKey` fields encrypted (§15.1). A one-time migrate on hydrate: if legacy `np_store` still carries plaintext `apiKey` / `openAiKey` / `geminiKey` and no `np_providers` exists, encrypt + move then strip them from `np_store`. This closes the CONCERNS plaintext-secret finding in Phase 2. — **Reversibility:** `costly` — rationale: changes where provider config lives; the np_store→np_providers migration is one-way once keys are stripped from the old blob.
- **D-29 (KeyVault lifecycle — spec §15.2 exact, no recovery):** `installSecret` = 32 random bytes generated once → `np_install_secret` in chrome.storage.local. Per-key encryption: random 16-byte salt + 12-byte IV; `derivedKey = PBKDF2(installSecret + extensionId, salt, 100000, SHA-256)` → AES-GCM-256. No rotation, no master password, no recovery/export path (that's a v0.2+ option); reinstall loses provider keys — a documented, accepted trade-off. — **Reversibility:** `one-way` — rationale: install secret + derived keys are the encryption root; changing the derivation scheme invalidates all persisted ciphertext.
- **D-30 (Keep current ProviderConfig shape, encrypt fields):** Spec §15.1 describes `np_providers` as `ProviderConfig[]` (array), but the scaffold persists a single `ProviderConfig` object with nested `providers: Record<CustomProviderId, CustomProviderDetail>` (each carrying `apiKey`) plus top-level `openAiKey`/`geminiKey` duplicates. Phase 2 **keeps the scaffold shape** and encrypts every secret-bearing field before writing `np_providers`, including `CustomProviderDetail.apiKey`, `openAiKey`, `geminiKey`, and any future provider credential field persisted by the current scaffold shape. Normalization to the spec's array form is deferred to Phase 3 with ProviderRegistry. — **Reversibility:** reversible — rationale: no consumer refactor in Phase 2; Phase 3 shape change touches Options page anyway.
- **D-30a (Temporary spec-deviation contract):** For Phase 2 only, all code writing or reading np_providers MUST use the existing scaffold object shape. No new consumer may implement the §15.1 array contract during Phase 2. Phase 3 ProviderRegistry owns the object→ProviderConfig[] migration. Until that migration lands, the object shape is the temporary runtime source of truth despite the §15.1 target model.


### WriteJournal real-path wiring (spec §20.3, Appendix O.11)

- **D-31 (Wire `np_workspace` update + startup recovery):** The `np_workspace` update goes through `runJournaled` for real (the `update-workspace` operation, §20.3 ordering: create entry `pending` → write `chrome.storage.local.np_workspace` → emit `WORKSPACE_UPDATED` → mark `completed`). `recoverJournal()` runs on surface boot to finish or undo any entry left mid-flight (crash recovery). Proves crash-safety on a production path and satisfies success criterion 1. — **Reversibility:** `reversible` — rationale: additive wrapping of the existing persist call.
- **D-32 (Declare all 11 ops, implement `update-workspace` only):** The full `WriteJournalOperation` union from §20.3 (`append-memory-message`, `evict-conversation`, `archive-conversation`, `compact-conversation`, `save-note-with-links`, `update-user-memory`, `export-data`, `update-workspace`, `sync-note-file`, `delete-note-file`, `restore-notes-batch`) is declared as the type surface now; only `update-workspace` gets a registered `JournalStep` implementation in Phase 2. Later phases register step impls against the same enum — declare-now/populate-later. — **Reversibility:** `reversible` — rationale: type-only additions; no data contract churn. Replay contract: during Phase 2, recoverJournal() MAY replay only update-workspace entries. Encountering any other operation type MUST be treated as unsupported and skipped with debugLog instrumentation. No placeholder handlers are registered for the remaining 10 operations.
- **D-33 (Journal entries in a dedicated WriteJournalDB idb store):** Entries persist in IndexedDB (`entries` store) per §15.1 `WriteJournalDB` — NOT chrome.storage.session — so recovery survives SW restarts. The store's schema/version is owned by IndexedDBMigrator. Entries are metadata-only (no message bodies), so no redaction required in the journal. — **Reversibility:** `costly` — rationale: persistence backend choice; moving it later orphans any in-flight journal rows.
- **D-34 (Election-gate + journal + debounced step compose):** np_workspace persist flow = (1) secondary surfaces skip entirely (mirror only); (2) primary checks `isPrimaryWriter()` → creates `WriteJournalEntry(status='pending')` → `runJournaled` applies steps `[write np_workspace via the debounced chromeStorageAdapter, emit WORKSPACE_UPDATED]` → marks `completed`. The journal-entry write itself bypasses the debounce (immediate, single write) so recovery ordering is exact; the np_workspace data write stays on the D-22 300 ms trailing debounce. — **Reversibility:** `reversible` — rationale: compositional; each mechanism independently revertable.

### Requester role + RateLimiter (spec §10.7, §13)

- **D-35 (Requester = UI-side fetch wrapper for aiProvider):** `src/core/http/Requester.ts` is the UI-context HTTP client: fetch wrapper with AbortController threading, 25 s default timeout (matching PROXY_FETCH's `Promise.race`), RateLimiter integration, and structured error codes (`NETWORK`, `TIMEOUT`, etc.). Runs only in side panel / standalone (never the background SW — §0.2 boundary). `aiProvider` consumes it in Phase 3. It is NOT the PROXY_FETCH client — CORSProxy/PROXY_FETCH stays a background-SW concern (Phase 17). — **Reversibility:** `reversible` — rationale: new module; Phase 3 wires a consumer.
- **D-36 (RateLimiter = token bucket, per-instance):** `{ capacity, refillPerSecond }`; `acquire()` returns boolean or throws `RATE_LIMITED`. Per-instance by design per §13 ("each add-on owns its limiter; never shared"). Proven by `RateLimiter.test.ts` unit tests in Phase 2. — **Reversibility:** `reversible` — rationale: standalone util.
- **D-37 (Optional injected limiter, no default):** Requester accepts an optional RateLimiter instance; none passed → no throttling. Keeps aiProvider's streaming path uninstrumented until Phase 3 wiring, avoids silently throttling legitimate stream traffic. — **Reversibility:** `reversible` — rationale: constructor param; default-free.

### Storage error-surfacing contract (REQ-R07, spec §21.6 / Appendix C.2)

- **D-38 (Minimal set — exactly 2 new codes):** The spec's canonical registry already defines `STORAGE_READ_FAILED`, `IDB_BLOCKED`, `IDB_MIGRATION_FAILED`, `TIMEOUT`, `NETWORK`, `RATE_LIMITED`, `WORKSPACE_ELECTION_TIMEOUT`, `WORKSPACE_STORAGE_UNAVAILABLE`, `WORKSPACE_HANDOFF_FAILED`. REQ-R07 adds **exactly `STORAGE_QUOTA` and `STORAGE_RATE_LIMIT`**. All storage/IDB/KeyVault/WriteJournal catch paths reuse existing spec codes; NO invented codes (the closed-set rule in §0.3/§21.6 is absolute). `WRITE_JOURNAL_FAILED` / `WRITE_JOURNAL_ROLLBACK_FAILED` are spec-internal debugLog codes from O.11 (kept as-is, not added to the registry). — **Reversibility:** `reversible` — rationale: additive registry entries; code-set audit is a grep.
- **D-39 (Adapter surfaces + ErrorStore records):** `chromeStorageAdapter` stops swallowing quota/rate-limit failures into `debugLog` — it surfaces `STORAGE_QUOTA` / `STORAGE_RATE_LIMIT` (fixes the CONCERNS unhandled `lastError` gap). `ErrorStore` (new idb store, FIFO max 100, debug only per spec §15.1) records typed errors, including `IDB_MIGRATION_FAILED` on migration failure. WriteJournal uses `WRITE_JOURNAL_FAILED` via `debugLog` per O.11. — **Reversibility:** `reversible` — rationale: error paths only. Ownership rule: chromeStorageAdapter MUST NOT write directly into ErrorStore. It emits typed errors only. The caller that catches the classified error is responsible for recording exactly one ErrorStore entry. This prevents duplicate persistence of identical failures.

### unlimitedStorage permission (ADR-STACK-02 / REQ-R06)

- **D-40 (Add `unlimitedStorage` to the Phase-2 manifest):** D-19a's Phase-2 permission set becomes `['sidePanel', 'storage', 'tabs', 'unlimitedStorage']` in `wxt.config.ts`. It exempts the extension origin — IndexedDB bodies (ChatHistoryDB/MemoryDB/NotesDB/WriteJournalDB/ErrorStore) — from quota/eviction. `navigator.storage.persist()` is NOT a substitute (per ADR-STACK-02). Phase 19 CWS review must justify it in the store listing. `chrome.storage.session`'s 10 MB hard cap is NOT lifted by this permission (per PITFALLS P2). — **Reversibility:** `reversible` — rationale: declarative permission; remove is a one-line manifest edit.

### IndexedDB migrator scope (spec §20.4)

- **D-41 (Framework + bootstrap all 5 DBs):** `IndexedDBMigrator.ts` is the shared versioning framework: `IndexedDBMigration` registry (`fromVersion`/`toVersion`/`description`/`migrate` per §20.4), deterministic + idempotent migrations where practical, numeric `DB_VERSION` per database, a forward-migration contract later phases extend, and failures → `IDB_MIGRATION_FAILED` → ErrorStore + degraded mode. Phase 2 bootstraps schema + version for **all five** DBs (ChatHistoryDB, MemoryDB, NotesDB, WriteJournalDB, ErrorStore). Data migrations (notes fields, memory, etc.) land in owning phases. — **Reversibility:** `costly` — rationale: DB_VERSION and store schemas are persisted contract; renumbering later requires migration churn. Degraded mode contract: if an IndexedDB database fails migration/open, that database is disabled for the session, IDB_MIGRATION_FAILED is recorded, and the extension continues operating for unaffected stores. Do not block workspace persistence or provider configuration solely because a different database failed migration.
- **D-42 (All DBs start at v1; v1→v2 fixture proves the framework):** Each production DB ships at `DB_VERSION = 1` (initial schema). The required v1→v2 fixture (success criterion 4) uses a fixture DB / in-test migration pair to prove the framework is idempotent + backward-compatible — it is a framework proof, not a production data migration. Production DBs stay at v1 until owning phases bump them (e.g. the `notes_backup_config` v4 migration lands at Phase 9 per §20.4). — **Reversibility:** `reversible` — rationale: test fixture + version baseline; no production data moved.

### Coalescing confirmation (D-22 / REQ-R03)

- **D-43 (No re-open of D-22; verify interplay):** D-22 coalescing (`STORAGE_DEBOUNCE_MS = 300` ms trailing debounce + `beforeunload`/`visibilitychange` flush in `chromeStorageAdapter`) landed in Phase 1 and is NOT re-opened. Phase 2 verifies the interplay: election heartbeats write `np_workspace_primary` to chrome.storage.session (NOT debounced — small/frequent), WriteJournal entry writes are immediate (bypass debounce), np_workspace persists stay on the debounced path. The write-rate assertion (≤30 writes/min steady-state, per PITFALLS P2's ~120/min boundary) stays green. — **Reversibility:** `reversible` — rationale: verification only; no production change to the debounce.

### the agent's Discretion
- **Setting.ts (`src/core/storage/Setting.ts`):** The `Setting<T>` generic + serialized-write rule (§13 "Settings writes serialized — never write two Setting<T> keys concurrently") is implementation-detail; exact API shape and which settings use it in Phase 2 (if any — it may be a declare-now/populate-later utility) is the planner's call.
- **redactSensitive.ts (`src/core/security/redactSensitive.ts`):** Relationship to the full TraceRedactor (Phase 11, AITransactionLog) — Phase 2 ships the storage-side redaction primitive; where it's invoked at persist boundaries (vs. only at log boundaries) is the planner's call. Success criterion 3 ("no message body or raw secret in chrome.storage.local, proven by inspection") is the acceptance bar.
- **ChatHistoryDB / MemoryDB / NotesDB schema detail:** The stores are bootstrapped at v1 with their §15.1 store lists (sessions/messages, userFacts/conversationSummaries, notes/concepts); exact index/keyPath detail (e.g. MemoryDB messages keyPath `[conversationId, seq]`) follows §15.1 / Appendix C — planner confirms field-level fidelity, no invention.
- **Test infra for IndexedDB:** Phase 2 needs idb@^8 installed (STACK.md) and an IndexedDB test environment (e.g. `fake-indexeddb` or a fixture harness) — the current `tests/setup.ts` has no IndexedDB mock. Harness choice is the planner's call.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Spec / scoping
- `.planning/PRODUCT_SPEC_v0_1.md` §18 (Phase 2 block — Create list, Required tests, DONE-when checklist) — sole authority on the Phase-2 file inventory and gates.
- `.planning/PRODUCT_SPEC_v0_1.md` §15.1 / §15.2 — storage backends (np_providers encrypted apiKey, np_install_secret) + API-key encryption scheme (installSecret → PBKDF2 100k → AES-GCM-256).
- `.planning/PRODUCT_SPEC_v0_1.md` §20.3 / §20.4 / §20.11 — WriteJournal operations + ordering, IndexedDB migration policy (DB_VERSION, v4 notes_backup_config at Phase 9), Workspace Coordination State + election rules (CAS, 3 s heartbeat, 2-miss, Standalone tie-break).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix O.11 — WriteJournal runJournaled/recoverJournal reference implementation (authoritative shape for `JournalStep`).
- `.planning/PRODUCT_SPEC_v0_1.md` §13 — concurrency rules: single-writer memory, per-instance RateLimiter, serialized Setting<T> writes, cross-surface election.
- `.planning/PRODUCT_SPEC_v0_1.md` §10.7 — CORSProxy/PROXY_FETCH contract (Requester's timeout + code context; the proxy itself is Phase 17).
- `.planning/PRODUCT_SPEC_v0_1.md` §21.6 + Appendix C.2 — canonical error code registry (the closed set REQ-R07 extends by exactly two codes).
- `.planning/PRODUCT_SPEC_v0_1.md` §16.4 — manifest permissions baseline (unlimitedStorage comment / ADR-STACK-02).
- `.planning/PRODUCT_SPEC_v0_1.md` §0.2 / §5.2 — MV3 boundaries: no AI/IndexedDB in the background SW; UI contexts only.

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 2: Storage, Security, WriteJournal, Workspace Persistence" — goal + success criteria + verification gate.
- `.planning/RESEARCH-RECONCILIATION.md` §D — REQ-R03 (coalescing), REQ-R06 (unlimitedStorage), REQ-R07 (STORAGE_QUOTA/STORAGE_RATE_LIMIT) rows + §F decision log.
- `.planning/STATE.md` — decision 15 (D-19a permissions), 17 (D-21 strict-mode); watch items VAI-04 (idb version re-query at install).
- `.planning/adr/ADR-STACK-02-unlimitedstorage-phase2.md` — `unlimitedStorage` added at Phase 2 (the manifest + CWS-justification contract).
- `.planning/adr/ADR-STACK-01-wxt-hold-0.20.md` — WXT 0.20.27 held (stack context for adding idb).
- `.planning/research/STACK.md` §"Phase 2 (IndexedDB): idb@^8" — `pnpm add idb@^8` and the idb-vs-Dexie reasoning.

### Research / pitfalls
- `.planning/research/PITFALLS.md` P2 — chrome.storage write-rate limits (~120 writes/min silently drops) and quotas (10 MB local; 10 MB session hard cap NOT lifted by unlimitedStorage) — the canonical silent-data-loss vector REQ-R07/R03 address.
- `.planning/research/SUMMARY.md` — Phase 2 notes: unlimitedStorage timing, adapter surfacing STORAGE_QUOTA/STORAGE_RATE_LIMIT, idb ^8.

### Codebase maps (refreshed 2026-08-18)
- `.planning/codebase/CONCERNS.md` — "API keys stored plaintext" (provider secrets), "unhandled QUOTA_BYTES in the adapter", "np_store full-blob re-serialization" — the concrete defects Phase 2 fixes.
- `.planning/codebase/ARCHITECTURE.md` — chromeStorageAdapter / BroadcastBus / per-surface singleton patterns.
- `.planning/codebase/STACK.md` — exact version table; idb ^8 → 8.0.3 pinned for Phase 2.
- `.planning/codebase/TESTING.md` — test conventions; the missing IndexedDB mock is a Phase-2 gap.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/theme/chromeStorageAdapter.ts` (247 lines) — the D-22 debounced zustand `StateStorage` (300 ms trailing debounce, per-target local/sync routing, `beforeunload`/`visibilitychange` flush, `flushPendingWrites()`, `__test__` seams). Phase 2 adds STORAGE_QUOTA/STORAGE_RATE_LIMIT surfacing (D-39) and keeps the debounce intact (D-43); the journal's np_workspace step writes through it (D-34).
- `src/core/workspace/WorkspaceStore.ts` (173 lines) — zustand + immer + persist; `isPrimaryWriter()` (currently returns `true` — the D-16 swap point D-24 replaces); `workspaceMigrate` no-op v1; persisted under `np_workspace_store` via chromeStorageAdapter. D-24/D-27 make the predicate a real election read that gates persist.
- `src/core/workspace/WorkspaceSync.ts` (32 lines) — pure pub/sub over `np_workspace` (`onWorkspaceSync`, `notifyWorkspaceUpdate`, `notifyWorkspaceHandoff`). D-26 adds `WORKSPACE_HEARTBEAT` to the message union; no timer exists here.
- `src/core/workspace/WorkspaceRouter.ts` — Flow 11 openStandalone/dedupe; handoff persists via WorkspaceStore (works with D-27 gating).
- `src/core/runtime/BroadcastBus.ts` — `subscribe`/`publish` with `INSTANCE_ID` self-message suppression; the channel plumbing D-26 rides.
- `src/core/log/debugLog.ts` — in-memory `debugLog(code, message, context?)` (MAX 200 entries); Phase 2 ErrorStore is the persistent/typed sibling (D-39).
- `src/store/useExtensionStore.ts` — the god-store holding `np_store` with plaintext `apiKey`/`openAiKey`/`geminiKey` (lines 20-87 DEFAULT_CONFIG, persisted via chromeStorageAdapter); Phase 2's migrate strips these into encrypted `np_providers` (D-28). Its `version:1`/`migrate`/`merge` pattern is the template for the np_store→np_providers one-time migration.
- `src/types/index.ts` — `ProviderConfig` (lines 114-137: `providers: Record<CustomProviderId, CustomProviderDetail>`, `openAiKey`, `geminiKey`) — the shape D-30 keeps and encrypts; `CustomProviderDetail.apiKey` (line 108).

### Established Patterns
- **Zustand `persist(immer(...), { name, storage, partialize, version, migrate })`** — the store pattern; `chromeStorageAdapter` is the shared choke point all persisted stores write through (D-27/D-34 compose against it).
- **Debounced persistence with flush hooks + `__test__` seams** — D-22's pattern; Phase 2 verifies it doesn't fight election heartbeats/journal entries.
- **Typed message unions over BroadcastBus** — WorkspaceSync's message pattern; WORKSPACE_HEARTBEAT (D-26) follows it.
- **Declare-now/populate-later** — Phase 1 used it for `isPrimaryWriter()` and `Note.type`; D-32 (all 11 WriteJournal ops) and D-30 (ProviderConfig shape) extend the pattern.
- **`@ts-expect-error NP-STRICT-<n>`** — the D-21 strict-mode ceiling; Phase 2-3 must reduce the NP-STRICT ceiling toward 0 (recorded in STATE.md).

### Integration Points
- `WorkspaceStore.isPrimaryWriter()` ← WorkspaceElection (in-memory election result, D-24) ← heartbeat/`WORKSPACE_HEARTBEAT` on `np_workspace` channel (D-26) → gates the journaled np_workspace persist (D-27/D-34).
- `np_store` → (migrate) → `np_providers` (encrypted) — useExtensionStore hydrate path + Options page provider reads move to the new key (D-28/D-30).
- `chromeStorageAdapter` → surfaces STORAGE_QUOTA/STORAGE_RATE_LIMIT → ErrorStore (idb FIFO 100) — the error pipeline (D-39).
- `IndexedDBMigrator` → owns DB_VERSION + migration registry → ChatHistoryDB/MemoryDB/NotesDB/WriteJournalDB/ErrorStore openDB calls (D-41/D-42).
- `Requester` ← injected RateLimiter ← aiProvider (Phase 3 consumer) (D-35/D-37).
- `wxt.config.ts` permissions → `['sidePanel','storage','tabs','unlimitedStorage']` (D-40).

</code_context>

<specifics>
## Specific Ideas

- **"No second timer anywhere"** — the user's explicit constraint for election/sync lifecycle: one 3 s tick, owned by WorkspaceElection, riding the existing `np_workspace` channel (D-26).
- **Error codes "do NOT invent any not already defined"** — the user's explicit instruction; the registry stays closed, REQ-R07 adds exactly two (D-38).
- **np_workspace persist composition** — user explicitly approved gating the real persist path on election in Phase 2 ("Gate np_workspace persist on it now"), so the predicate is production-exercised, not test-only (D-27).
- **§15.2 "NEVER use navigator.userAgent or any value that changes on browser update"** — the KeyVault derivation must use stable inputs (installSecret + extensionId only); user ratified spec §15.2 exact (D-29).
- **idb@^8 is the pinned IndexedDB wrapper** (STACK.md, spec-pinned) — not Dexie, not raw IDB. Test harness for IndexedDB is a Phase-2 gap to fill (discretion).
- **NP-STRICT ceiling reduction** — Phase 2-3 task per STATE.md decision 17: new Phase-2 code should be strict-clean from the start (no new `@ts-expect-error NP-STRICT` markers).

</specifics>

<deferred>
## Deferred Ideas

- **API-key export/import or install-secret backup** — user chose spec §15.2 exact (no recovery); a backup/export path is a v0.2+ option (D-29 note).
- **`np_providers` normalization to spec §15.1 `ProviderConfig[]` array form** — deferred to Phase 3 with `ProviderRegistry` (D-30 note).
- **Real production data migrations (notes/memory fields, notes_backup_config)** — owning phases; the v4 `notes_backup_config` migration lands at Phase 9 per §20.4 (D-42 note).
- **CORSProxy / PROXY_FETCH client** — Phase 17 background-SW concern; Requester is NOT it in Phase 2 (D-35 note).
- **Full TraceRedactor + AITransactionLog** — Phase 11; Phase 2 ships `redactSensitive` as the storage-side primitive (discretion).
- **Master-password / OS-keychain flow** — CONCERNS "consider a master-password/OS-keychain flow for v0.2" — explicitly deferred beyond v0.1.

None of these belong in Phase 2 — discussion stayed within phase scope otherwise.

</deferred>

---
*Phase: 2-Storage, Security, WriteJournal, Workspace Persistence*
*Context gathered: 2026-08-23*