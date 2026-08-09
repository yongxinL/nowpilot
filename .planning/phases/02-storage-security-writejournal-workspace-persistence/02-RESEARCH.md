# Phase 2: Storage, Security, WriteJournal, Workspace Persistence - Research

**Researched:** 2026-08-09
**Domain:** Chrome MV3 durable storage (chrome.storage + IndexedDB via idb), AES-GCM at-rest encryption, crash-safe write journaling, KV migrations, redaction, import/export
**Confidence:** HIGH (key unknowns empirically verified against this project's exact test stack)

## Summary

Phase 2 builds the durable storage layer under Phase 1's runtime shells. The vault (KeyVault + EncryptedStorage) delivers AES-GCM at-rest obfuscation per §15.2 / D-01..D-04; the WriteJournal (Appendix O.11) makes the np_workspace write crash-recoverable via replay (D-05..D-07); four IndexedDB stores (ChatHistoryDB, NotesDB, MemoryDB, ErrorStore) plus WriteJournalDB and an IndexedDBMigrator with a synthetic v1→v2 proof land via idb ^8 (D-12..D-14); Setting.ts provides serialized per-key-permissioned chrome.storage access with sync-quota fallback (D-09, D-15); redactSensitive + the real TraceRedactor body wire redaction at every write boundary (D-16); import/export core ships JSON+ZIP via fflate (D-17..D-19); RateLimiter and Requester ship as functional primitives.

**The single most important research outcome** (verified empirically, not assumed): the project's vitest test stack (vitest 4.1.10 + jsdom 30 + custom `jsdom-align` env + threads pool) **supports IndexedDB testing via `fake-indexeddb` (`import 'fake-indexeddb/auto'`) with zero additional polyfills** — `crypto.subtle` (AES-GCM, PBKDF2) and `globalThis.structuredClone` are already available in the jsdom-align env. One hard landmine was found and solved: **idb's `openDB` + a throwing upgrade function leaks an unhandled rejection from fake-indexeddb's internal double-settle, which makes `vitest run` exit non-zero — so the IndexedDBMigrator's version-change open must use the raw `indexedDB.open` + `wrap()` pattern (sync dispatch), which is verified clean for both happy and failure paths.**

**Primary recommendation:** Install `idb@8`, `fflate@0.8` (approved stack §7) and dev-dependency `fake-indexeddb@6`; add `import 'fake-indexeddb/auto'` to `tests/setup.ts`; build the migrator on raw `indexedDB.open` + idb `wrap()`; keep §20.4's `IndexedDBMigration` interface verbatim with request-chained (not awaited) migrations.

## User Constraints (from CONTEXT.md)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Vault & Secret Encryption (§15.2)
- **D-01 [vault survival]:** Secrets are **never exported**. `np_providers` apiKey ciphertext and all secret material are excluded from every export (export-data tool contract: "no API keys"). **No passphrase-wrapped portable vault** (new security surface, unjustified for BYO keys; addable in v0.2 with no schema change since salt/IV are already stored). **No ciphertext-as-is export** (ships secret material yet undecryptable cross-install).
- **D-02 [installSecret]:** Plaintext 32 random bytes via `crypto.getRandomValues(new Uint8Array(32))`, base64-encoded, stored in **chrome.storage.local only** as `np_install_secret`. **Generate exactly once** on first init via a read-then-write-if-absent (race-safe; "already present" is authoritative; two contexts must never both generate/clobber). **Immutable once set — never regenerate or overwrite.** Never written to chrome.storage.sync and never included in exports. Security framing: API-key encryption is **AT-REST obfuscation**, install-bound, never leaves the machine; it protects against casual disk/backup/sync inspection, NOT against a process with the extension's storage access. Derived key: PBKDF2(installSecret + extensionId, salt, 100000, SHA-256) → AES-GCM-256, per-key 16-byte salt + 12-byte IV.
- **D-03 [decrypt failure]:** `decrypt()` throws a typed **VAULT_DECRYPT_FAILED**; callers catch it; the value is treated as unreadable and **NEVER auto-wiped**. AES-GCM fails closed (authTag mismatch → throw), so wrong-plaintext is impossible; tampered/garbage ciphertext and wrong-key are indistinguishable and both surface as the same typed throw — **no separate "corruption" branch**.
- **D-04 [recovery UX — the three roads to unreadable]:** (a) restore on a new install, (b) installSecret cleared, (c) tampered ciphertext — all unify onto **ONE shared state + one code (`PROVIDER_KEY_UNREADABLE`)** with one recovery path: the provider surfaces as **"Key required — re-enter"**, enabled=false, treated as unconfigured (routes to the onboarding "configure later" gate). **Do NOT auto-regenerate installSecret on loss** (would orphan all existing keys on a transient storage glitch). **Do NOT auto-wipe** — nothing deleted; re-entry overwrites stale ciphertext. Wipe is **USER-INITIATED only** (a "Remove provider" action), never an automatic consequence of decrypt failure. If installSecret is missing but ciphertext exists → the same `PROVIDER_KEY_UNREADABLE` state.

#### WriteJournal & Crash Recovery (§20.3, Appendix O.11)
- **D-05 [journal scope]:** Build the journal **framework** now (`runJournaled` / `recoverJournal` per Appendix O.11, idempotent steps, keying machinery), but wire **ONLY `update-workspace`** — the sole live consumer in Phase 2 — through it, per §20.3 order: pending → write np_workspace → BroadcastBus WORKSPACE_UPDATED → completed. The other 10 op values are declared in the locked `WriteJournalOperation` union (Golden Rule 2 vocabulary) but **declared-but-unwired** — Phase 3/5 extend by adding a consumer, never by editing the vocabulary.
- **D-06 [rewire]:** WorkspaceStore's current **direct** np_workspace write is **redirected through the journal** (without this the journal has no live consumer and recovery is untestable). WorkspaceStore.update() routes through runJournaled with the update-workspace op; journal entry persistence lives in WriteJournalDB (IndexedDB) per §15.1.
- **D-07 [recovery guarantees]:** Idempotency key for update-workspace = **workspaceId + version**; recovery/replay is **workspace-scoped** (WR-10 lesson) — a recovered write cannot contaminate another workspaceId. **Unknown-op replay = skip-and-log** (debugLog), never throw, so a forward-compat entry can't brick startup.
- **D-08 [election deferred]:** The BroadcastBus primary-writer election (`np_workspace_primary` in chrome.storage.session, 3s heartbeat, Standalone tie-break) is **deferred to Phase 3/5** — its real consumers (memory/notes/chat bodies) don't exist yet. Phase 2 relies on the journal + existing version-LWW merge + WR-10 workspaceId scope gate.

#### Storage Layer & Permissions (STORAGE-02)
- **D-09 [STORAGE-02 mapping]:** The §18 create-list is authoritative — **no separate StorageLayer.ts / StorageSession.ts files**. The layer concepts fold into the existing files: `Setting.ts` = per-key permissioned typed wrapper over chrome.storage.local/sync with a permission table (key → { area, encrypted?, writeAllowed }) and serialized writes (§ "Settings writes serialized — never two Setting<T> keys concurrently"); `EncryptedStorage.ts` = AES-GCM primitive; `KeyVault.ts` (security/) = installSecret + derived keys + the PROVIDER_KEY_UNREADABLE state machine.

#### KV Schema Versioning & Session Tokens
- **D-10 [KV versioning]:** Add **`np_schema_version`** + **migrate-on-read**: at init, read the key and normalize old shapes to current via the per-key sanitizers (the sanitizeStored T-1-13 pattern generalizes to all KV keys). IndexedDB keeps its own §20.4 migrations; migrate-on-read covers chrome.storage.local shape evolution (np_workspace, np_providers, np_addon_settings, and future keys).
- **D-11 [session tokens]:** chrome.storage.session keys (`np_jsessionid`, `np_sysparm_ck`, `np_token_ttl`, `np_active_stream`, `np_workspace_primary`) are **declared in the storage layer's key registry only — no accessors shipped**. Their consumers arrive Phase 3/8. Area is chrome.storage.session (cleared on browser close), never encrypted (session-scoped).

#### IndexedDB Migrations (§20.4)
- **D-12 [degraded mode]:** Migration failure records **IDB_MIGRATION_FAILED** in ErrorStore and enters degraded mode = **read-only for the affected DB + persistent UI banner** ("Storage failed to upgrade — data is read-only. Use Import/Export to back up."). Writes are blocked with a typed error surfaced to the UI. **In-memory fallback rejected** (silent shadow-write → split-brain with on-disk state, violates crash-safety). Reads still work from the v(n-1) data.
- **D-13 [v1→v2 fixture]:** The v1→v2 fixture is a **SYNTHETIC schema transition** proving the migrator end-to-end: create a v1 DB (DB_VERSION=1) with an initial store set, run IndexedDBMigrator with a v1→v2 migration that **adds a store + adds an index + carries data**, assert data survives and the new schema exists. The real stores start at their own current version; the fixture demonstrates the framework exactly as DONE-when "migration from v1 → v2 fixture passes" demands.
- **D-14 [migrator seeding]:** Ship the migration **framework now** — IndexedDBMigration interface, DB_VERSION per store, deterministic/idempotent runner, onUpgradeNeeded dispatch, IDB_MIGRATION_FAILED → ErrorStore + degraded mode — seeded with the synthetic v1→v2 proof. Real store migrations (e.g. v4 notes_backup_config in Phase 5a) extend the registry later — same pattern as WriteJournal ops.

#### chrome.storage.sync Quota Discipline
- **D-15 [sync fallback]:** A failed chrome.storage.sync write to **cosmetic keys** (`np_theme` / `np_theme_pack` / `np_language`; quota or write-rate) → catch, debugLog canonical code (**SYNC_QUOTA_EXCEEDED**, reusing the THEME_STORAGE_UNAVAILABLE intent), and write the **same key to chrome.storage.local**. Reads check **sync-first, then local**; if a local shadow exists it wins on read AND triggers a re-attempt to write sync; on a successful sync write, **delete the local shadow** — sync/local never silently diverge. UI never surfaces it (value is durable locally; only cross-device propagation is lost). Catch BOTH size and rate errors; small debounce on theme/pack/language writes to avoid tripping the rate limit. Spec touch (one line, not a redesign): reword APPR-03's single-source invariant from "sync is the ONLY store" to "sync is the CANONICAL/preferred store; local is a transient fallback shadow reconciled back to sync when possible."

#### Redaction Before Persist (R-10 / §16.5)
- **D-16 [redaction hook wired in Phase 2]:** Real redaction ships **NOW** because ErrorStore, WriteJournalDB, and vault ciphertext are born here. `redactSensitive.ts` (field-level, for storage-bound values) is implemented; `TraceRedactor` gets its **real body** (replacing the Phase-1 pass-through placeholder). Every ErrorStore.write / journal persist / debugLog call routes through it at the write boundary. Phase 6 only ADDS telemetry DBs that consume the hook, not the hook itself. Password-like values are **DROPPED, not masked**.

#### Import/Export & Backup/Restore (STORAGE-05)
- **D-17 [export contract]:** **JSON as the canonical format** (inspectable, diffable, sanitizable) + **ZIP via fflate** for full-vault exports with multiple store groups. Scopes mirror export-data's `{ scopes: string[] }`: chat-history, notes, memory, workspace, settings — each group sanitized (redactSensitive before serialization), no secret material, plus a **manifest** `{ exportedAt, appVersion, schemaVersion }`.
- **D-18 [restore semantics]:** Import is **per-group MERGE/upsert** (by id; existing records win on conflict by default, with a "restore overwrites" toggle) — **never** full wipe-and-replace, so a partial restore can't destroy data. Full-vault ZIP restore runs **journaled** (restore-batch-style op) so a mid-restore crash leaves a consistent state. Matches Phase 5a's additive restore-from-folder philosophy.
- **D-19 [UI surface]:** Phase 2 ships **core-only** — the import/export module (sanitize, serialize, manifest, merge logic, ZIP via fflate) + tests. The Options → Advanced → Import/ExportPanel UI is a **Phase 7** deliverable (§18 Phase 7 create-list; §9.3). DONE-when "user can import/export" is satisfied by the verified core + export-data plumbing.

#### Test Fixtures (WR-13 lesson)
- **D-20 [centralized fixture module]:** Phase 2 fixtures live in **`tests/fixtures/`** as named **typed builders**, each mapping to a ratified decision:
  - `vault-roundtrip` (encrypt→decrypt under one secret) — decrypt posture
  - `cross-install` (encrypt A / decrypt B → PROVIDER_KEY_UNREADABLE, asserts NO wipe) — vault survival + installSecret
  - `journal-recovery` (crash mid-write → replay-once idempotent, workspace-scoped) — journal scope + rewire (WR-10)
  - `migration` (synthetic v1→v2: add-store + add-index + data-carry + idempotency + throws→degraded) — migration framework
  - `quota-shadow` (sync fail → local shadow → promote/clear, no divergence) — sync fallback
  - `redaction` (error with sk-…/Bearer …/JSESSIONID= → redacted before ErrorStore/journal; password DROPPED not masked) — R-10 hook
- **D-21 [fixture requirements]:** Deterministic builders (seeded randomness, fixed IDs/timestamps — no real getRandomValues/Date.now in fixtures); **typed** builders parameterized on edges (workspaceId, version, secret), not static blobs; edge/failure variants first-class (crash-before/after-completed, different-workspaceId, migration-throws→degraded, cross-install no-wipe); fixtures under **tests/ only**, never imported from src/; the **WorkspacePersistence integration test imports the SAME builders** as the unit tests so unit + integration prove one deterministic scenario.

### the agent's Discretion
- RateLimiter (per-instance, keyed by addonId — §) and Requester internals: exact token-bucket params, timeout/retry defaults. Ship as functional primitives per §18; add-on consumers land Phase 8.
- ErrorStore internal shape beyond FIFO max 100 (debug only) and the redaction-before-write requirement.
- The four IDB store (ChatHistoryDB, NotesDB, MemoryDB, ErrorStore) internal keyPaths/indexes — follow §15.1 and Appendix C/§21 data models verbatim.
- WORKSPACE_UPDATED emission mechanics within the journaled update-workspace flow (reuse existing WorkspaceSync broadcast).

### Deferred Ideas (OUT OF SCOPE)
- **Primary-writer election (`np_workspace_primary` CAS + 3s heartbeat + promotion)** — deferred to Phase 3/5 when memory/notes/chat-body writers exist (D-08).
- **Other WriteJournal ops** (append-memory-message, save-note-with-links, evict/archive/compact-conversation, update-user-memory, sync/delete-note-file, restore-notes-batch) — declared-but-unwired; consumers arrive Phase 3/5 (D-05).
- **Session-token accessors** (np_jsessionid, np_sysparm_ck, np_token_ttl, np_active_stream) — Phase 8 ServiceNow add-on surface; Phase 2 declares keys only (D-11).
- **Passphrase-wrapped portable vault** — possible v0.2 addition with no schema change since salt/IV are already stored; rejected for v0.1 (D-01).
- **Import/ExportPanel UI** (Options → Advanced) — Phase 7 deliverable; Phase 2 ships core-only (D-19).
- **Telemetry DBs (AITransactionLogDB)** — Phase 6; Phase 2 wires the redaction hook they will consume, not the DBs (D-16).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STORAGE-01 | IndexedDB stores (ChatHistoryDB, NotesDB, MemoryDB, ErrorStore) work via idb with strict typing | fake-indexeddb test harness verified; DBSchema typing pattern verified; migrator raw-open pattern verified (Section: Architecture Patterns P1/P2) |
| STORAGE-02 | StorageLayer, StorageSession, and per-key permissions implemented | D-09 folds into Setting.ts (per-key permission table + serialized writes); Chrome quota facts verified (Setting.ts section) |
| STORAGE-03 | Encrypted vault (AES-GCM crypto.subtle) protects secrets/sensitive values | crypto.subtle verified in jsdom-align AND in MV3 contexts; PBKDF2/AES-GCM roundtrip verified empirically (KeyVault section) |
| STORAGE-04 | WriteJournal + WriteTransaction enable crash-safe, conflict-safe writes | Appendix O.11 reference read in full; adaptation needed documented (WriteJournal section); idempotency keys per §20.2 |
| STORAGE-05 | Import/export (sanitized JSON/ZIP) and backup/restore function | fflate zipSync/unzipSync roundtrip verified empirically; scopes/manifest/merge contract from D-17/18 (Import/Export section) |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| AES-GCM vault / crypto.subtle / derived keys | Side Panel/Standalone (panels) | — | R-3: vault lives in panels only; background SW never touches it. crypto.subtle IS available in the SW technically, but the design forbids it [VERIFIED: CONTEXT.md D-02 + R-3] |
| IndexedDB stores + WriteJournalDB | Side Panel/Standalone (panels) | — | R-3 + spec §0.2 "DO NOT open IndexedDB from the background service worker" (line 78). Real Chrome abort behavior identical in both panels |
| chrome.storage.local (np_workspace, np_providers, np_install_secret…) | Shared cross-context KV | Panels + background SW | All extension contexts access chrome.storage [CITED: developer.chrome.com]; the WRITE path is journaled from panels (D-06) |
| chrome.storage.sync cosmetic keys | Shared cross-context KV | — | np_theme/np_theme_pack/np_language sync-first + local shadow (D-15); Setting.ts owns the fallback machinery |
| chrome.storage.session tokens | Declared-only key registry | — | D-11: no accessors; consumers Phase 3/8 |
| Redaction before persist | Write-boundary hook | All sinks | R-10: ErrorStore.write / journal persist / debugLog / export all route through TraceRedactor + redactSensitive (D-16) |
| Import/export core | Panels (standalone-centric) | — | Export is a tool (export-data) executed in panels; UI is Phase 7 |
| RateLimiter / Requester | Panels (functional primitives) | — | Per-addon limiter (§13 line 1794); PROXY_FETCH goes through the background SW, but the Requester client lives in panels |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| idb | ^8.0.3 (installed: 8.0.3) | Promise wrapper for IndexedDB; DBSchema strict typing | Approved stack §7 ("Chat storage: IndexedDB via idb"); spec §15.1 stores; fully typed `IDBPDatabase<T>`; async-upgrade support |
| fflate | ^0.8.3 (installed: 0.8.3) | ZIP export/import (zipSync/unzipSync/strToU8/strFromU8) | Approved stack §7; zero-dependency, browser-native Uint8Array API (verified empirically) |
| fake-indexeddb (devDep) | ^6.2.5 (installed: 6.2.5) | In-memory IndexedDB for vitest | THE standard IndexedDB test harness; `import 'fake-indexeddb/auto'`; WPT pass rate 82.8% [CITED: fakeIndexedDB README]; zero deps; no postinstall [VERIFIED: npm registry] |

**Installation:**
```bash
pnpm add idb@^8 fflate@^0.8
pnpm add -D fake-indexeddb@^6
```

**Version verification (run this session):**
```bash
npm view idb version            # 8.0.3 (2025-05-07)
npm view fflate version         # 0.8.3 (2026-07-20)
npm view fake-indexeddb version # 6.2.5 (2025-11-07)
```

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zustand ^5 + immer ^10 (existing) | installed | Store + immutable updates | WorkspaceStore rewrite (D-06); no new dependency |
| crypto.subtle (WebCrypto, built-in) | Node 24 / Chrome ≥ 120 | AES-GCM-256 + PBKDF2 | KeyVault/EncryptedStorage — NO library (never hand-roll crypto; but also never add a crypto dep — the platform API is the standard) |
| @webext-core/fake-browser (via wxt/testing, existing) | 1.5.2 | chrome.* mock incl. storage.local/sync/session + runtime.sendMessage | All storage/workspace tests (existing pattern) |

### Alternatives Considered
| Instead of | Could Use | Why Standard Wins |
|------------|-----------|-------------------|
| fake-indexeddb | `fake-indexeddb` in jest-style global, or jsdom's (nonexistent) IndexedDB, or `idb` in a real browser e2e | fake-indexeddb is the de-facto standard; jsdom has NO IndexedDB (verified: `indexedDB: undefined` in jsdom-align env); e2e alone can't give unit-level coverage |
| fflate | jszip, yazl/yauzl, archiver | fflate is the approved §7 choice; jszip is heavier + extra dep; fflate's zipSync is synchronous & tiny |
| Raw WebCrypto | crypto-js, node-forge, tweetnacl | crypto.subtle is native, async, constant-time, and the §15.2 spec verbatim; no postinstall risk |
| raw indexedDB.open for migrator | idb openDB for everything | fake-indexeddb double-settle bug makes idb openDB failure-path tests exit non-zero (verified) — raw open + wrap() is the clean pattern |

## Package Legitimacy Audit

> Run via `gsd-tools query package-legitimacy check` + npm registry + postinstall scan (2026-08-09).

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| idb | npm | ~10 yrs (8.0.3 pub 2025-05-07) | 22.7M/wk | github.com/jakearchibald/idb | OK | Approved (approved stack §7) |
| fflate | npm | ~5 yrs (0.8.3 pub 2026-07-20) | 65.5M/wk | github.com/101arrowz/fflate | OK | Approved (approved stack §7) |
| fake-indexeddb | npm | ~10 yrs (6.2.5 pub 2025-11-07) | 5.1M/wk | github.com/dumbmatter/fakeIndexedDB | OK | Approved (devDep, test-only) |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none — all three have no postinstall script (verified via `npm view <pkg> scripts.postinstall` → empty), real source repos, and multi-year history.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌────────────────────────── Side Panel / Standalone (panels) ──────────────────────────┐
                     │                                                                                        │
  surface init       │  KeyVault (security/) ── PBKDF2(installSecret+extId, salt, 100k, SHA-256) ──┐          │
  (sidepanel/        │        │  np_install_secret (chrome.storage.local, write-if-absent, immutable)│          │
   standalone)       │        └──────────────────────────────────────────► EncryptedStorage (AES-GCM-256)     │
                     │                                                           │ encrypt/decrypt               │
                     │  Setting.ts (per-key permission table + serialized      │ np_providers apiKey            │
                     │   write queue + migrate-on-read np_schema_version)      ▼                               │
                     │        │                                          chrome.storage.local / sync / session │
                     │        ▼                                                     │                          │
                     │  WorkspaceStore.update() ──► runJournaled(update-workspace)   │                          │
                     │        │  pending → write np_workspace → WORKSPACE_UPDATED    │                          │
                     │        │  → completed            (BroadcastBus emit)          │                          │
                     │        ▼                                                      ▼                          │
                     │  WriteJournal.ts ── persist entries ──► WriteJournalDB ◄── recoverJournal() on init     │
                     │        (IndexedDB: entries[WriteJournalEntry])                     ▲ crash replay         │
                     │                                                                   │ workspace-scoped     │
                     │  IndexedDBMigrator (raw indexedDB.open + wrap, per-store        (workspaceId+version)    │
                     │   DB_VERSION, degraded-mode on failure, IDB_MIGRATION_FAILED)                          │
                     │        │                                                                                │
                     │        ▼                                                                                │
                     │  ChatHistoryDB │ NotesDB │ MemoryDB │ ErrorStore (FIFO 100)                            │
                     │        ▲                                                                                │
                     │        └── every write boundary: TraceRedactor.redact() + redactSensitive (R-10)        │
                     │                                                                                         │
                     │  Import/Export core: sanitize → groups{chat-history,notes,memory,workspace,settings}    │
                     │   → manifest{exportedAt,appVersion,schemaVersion} → JSON | ZIP (fflate)                 │
                     │                                                                                         │
                     └───────────────▲───────────────────────────────▲────────────────────────────────────────┘
                                     │                               │
                   chrome.runtime.sendMessage(PROXY_FETCH)        (background SW: proxy only —
                                     │                               │   NEVER IndexedDB/vault, R-3)
                            Requester (http/) ── RateLimiter (utils/, per-addonId token bucket)
```

### Recommended Project Structure (from spec §18 create-list — create exactly these 12)

```
src/core/storage/Setting.ts            # D-09: per-key permissioned KV wrapper + serialized writes + sync shadow
src/core/storage/EncryptedStorage.ts   # D-02: AES-GCM-256 encrypt/decrypt primitive (salt+IV envelope)
src/core/storage/WriteJournal.ts       # D-05/06/07 + Appendix O.11: runJournaled/recoverJournal + WriteJournalDB access
src/core/storage/IndexedDBMigrator.ts  # D-12/13/14 + §20.4: raw-open + wrap + per-store migrations + degraded mode
src/core/security/KeyVault.ts          # D-02/04: installSecret lifecycle + derived key + PROVIDER_KEY_UNREADABLE
src/core/security/redactSensitive.ts   # D-16: field-level redaction for storage-bound values (DROP password-like)
src/core/storage/ChatHistoryDB.ts      # §15.1/§21.1: sessions + messages stores, typed CRUD
src/core/storage/MemoryDB.ts           # §15.1/§21.3/§21.4: messages keyPath[conversationId,seq] + userFacts + conversationSummaries
src/core/storage/NotesDB.ts            # §15.1/§21.2: notes + concepts stores (incl. LLM-Wiki optional fields)
src/core/storage/ErrorStore.ts         # §15.1: FIFO max 100, redaction-before-write (R-10), IDB_MIGRATION_FAILED sink
src/core/utils/RateLimiter.ts          # §10.7/§13: per-instance token bucket keyed by addonId
src/core/http/Requester.ts             # §10.7: PROXY_FETCH message wrapper, 25s timeout, retry defaults (discretion)
```

**One planning decision needed (flagged, see Open Questions Q2):** the §18 create-list has NO file for the import/export core (D-17..D-19 deliver it). Recommend one new file `src/core/storage/ImportExport.ts` (documented deviation, consistent with D-09's folding rule which only forbids *StorageLayer/StorageSession* names). Do NOT fold into Setting.ts.

### Pattern 1: idb + fake-indexeddb in vitest (the definitive test approach)

**What:** `import 'fake-indexeddb/auto'` registers global `indexedDB`, `IDBKeyRange`, `IDBCursor` etc. in the test env. Add it to `tests/setup.ts` (all tests) — verified working with the existing jsdom-align env + threads pool, exit 0.

**Empirically verified facts (this session, vitest 4.1.10 + jsdom 30 + jsdom-align env + threads pool):**
- `globalThis.indexedDB` / `IDBKeyRange` are `undefined` in jsdom-align **without** fake-indexeddb → fake-indexeddb is REQUIRED [VERIFIED: probe]
- `crypto.subtle` (AES-GCM keygen/encrypt/decrypt + PBKDF2 deriveKey) IS available in jsdom-align **without any polyfill** → EncryptedStorage/KeyVault tests need nothing extra [VERIFIED: probe]
- fake-indexeddb 6.2.5 uses `globalThis.structuredClone` internally; Node 24 provides it (jsdom doesn't, but vitest's global retains Node's) → the README's jsdom structuredClone caveat does NOT apply to this stack; Date/Uint8Array values roundtrip correctly [VERIFIED: probe + fakeIndexedDB README]
- Per-test isolation: `fakeBrowser.reset()` already runs in `tests/setup.ts`; IndexedDB state must be isolated separately — create a fresh DB name per test or `indexedDB = new IDBFactory()` before each test (fake-indexeddb's documented reset) [CITED: fakeIndexedDB README]

**Setup:**
```ts
// tests/setup.ts — ADD to existing setup (mock: plain unit tests unaffected)
import 'fake-indexeddb/auto';
```

**Type pattern (DBSchema):**
```typescript
// Verified against idb 8.0.3 README + empirical probe
import { openDB, type DBSchema } from 'idb';
interface ChatDB extends DBSchema {
  sessions: { key: string; value: ChatSession };
  messages: { key: string; value: ChatMessage; indexes: { 'by-session': string } };
}
const db = await openDB<ChatDB>('ChatHistoryDB', 1, { upgrade(db) { … } });
```

### Pattern 2: IndexedDBMigrator — raw open + idb wrap() (THE critical pattern)

**What:** Migrations in idb's `openDB` that throw (or `tx.abort()`) leak an **unhandled rejection** from fake-indexeddb's internal double-settle (the upgrade aborts twice: once via the error event idb consumes, once via an internal `cb(new AbortError())` nobody listens to) — `vitest run` then exits **1**, failing CI. Verified three ways (throw / explicit tx.abort() / .then-abort — all leak; sync-throw in raw `indexedDB.open` — clean).

**Verified-clean migrator open (exit 0, both paths, atomic rollback):**
```typescript
// Source: empirical probe (tests/core/migrator2.test.ts) — 2/2 pass, no unhandled errors
import { wrap, type IDBPDatabase } from 'idb';
type Migration = (db: IDBDatabase, tx: IDBTransaction, oldV: number, newV: number) => void;

function migratorOpen<T>(name: string, targetVersion: number, migrations: Migration[]): Promise<IDBPDatabase<T>> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, targetVersion);
    req.onupgradeneeded = (ev) => {
      const db = req.result, tx = req.transaction!, oldV = ev.oldVersion, newV = ev.newVersion;
      for (const m of migrations) m(db, tx, oldV, newV); // SYNC dispatch; a throw aborts atomically
    };
    req.onsuccess = () => resolve(wrap(req.result));
    req.onerror = () => reject(req.error);
    req.onblocked = () => {};
  });
}
```
- **Failure path:** migration throws synchronously → openDB rejects with `AbortError` (the ORIGINAL error message is swallowed — verified) → migrator catches → IDB_MIGRATION_FAILED → ErrorStore → degraded. **Reads still work**: `openDB(name)` (no version) resolves at v(n-1); data intact; NO partial schema (verified: version stays 1, `objectStoreNames` unchanged).
- **Data-carry (v1→v2 fixture):** use **IDBRequest chaining** inside the sync dispatch (getAll().onsuccess → put into the new store) — keeps the upgrade transaction alive; `await` inside a raw upgrade closes the tx. Verified: 2 rows carried, index created, version 2.
- **§20.4 interface note:** keep `IndexedDBMigration { fromVersion, toVersion, description, migrate(db, tx): Promise<void> }` verbatim; the runner dispatches `migrate(wrap(db), wrap(tx))` synchronously and relies on request-chaining for async work. Do NOT await the returned promise inside the upgrade callback.
- **Alternative (happy-path only):** idb `openDB` with `async upgrade` (verified clean, supports real awaits — the idb README pattern) — acceptable IF the throws→degraded scenario is tested via a stubbed `openDB` rejection + one raw-API rollback proof instead of a real abort.

### Pattern 3: KeyVault — installSecret lifecycle + derived key

**What:** D-02/04. InstallSecret generation is read-then-write-if-absent (race-safe). Derived key per §15.2: PBKDF2(installSecret + extensionId, salt, 100000, SHA-256) → AES-GCM-256 with per-key 16-byte salt + 12-byte IV. `crypto.subtle` is async-only → KeyVault/EncryptedStorage are fully async; the PROVIDER_KEY_UNREADABLE state machine drives synchronous UI state.

**Verified facts:**
- PBKDF2 deriveKey → AES-GCM encrypt/decrypt roundtrip works in jsdom-align [VERIFIED: probe] and in Node 24 webcrypto [VERIFIED: env probe]
- `chrome.runtime.id` in the fakeBrowser mock is the deterministic string `"test-extension-id"` → KeyVault tests derive keys deterministically [VERIFIED: probe]
- 100,000 PBKDF2 iterations is the LOCKED spec decision (§15.2, D-02). Informational: OWASP 2023 guidance recommends ≥ 600k for PBKDF2-HMAC-SHA256 [ASSUMED]; do not relitigate — flag only as a v0.2 hardening candidate
- Wrong-key/tampered ciphertext → AES-GCM auth-tag mismatch → `decrypt()` throws → single typed `VAULT_DECRYPT_FAILED` (no corruption branch) — matches D-03 exactly (AES-GCM fails closed)
- Never derive from `navigator.userAgent` or anything that changes on browser update (spec §15.2, line 1983) — extensionId + installSecret are both stable

### Pattern 4: Serialized per-key writes (Setting.ts)

**What:** D-09 + spec §13 line 1791 ("Settings writes serialized — never two Setting<T> keys concurrently; await sequentially"). A promise-chain mutex serializes writes; the permission table maps key → { area: 'local'|'sync'|'session', encrypted?: boolean, writeAllowed?: boolean }.

**Verified facts:**
- chrome.storage.local QUOTA_BYTES = 10,485,760 (10MB); sync QUOTA_BYTES ≈ 102,400 total / QUOTA_BYTES_PER_ITEM = 8,192 / MAX_ITEMS = 512 / MAX_WRITE_OPERATIONS_PER_MINUTE = 120 / MAX_WRITE_OPERATIONS_PER_HOUR = 1,800; session QUOTA_BYTES = 10,485,760 (in-memory, cleared on browser close). Quota/rate violations reject the set() promise immediately [CITED: developer.chrome.com/docs/extensions/reference/api/storage — fetched 2026-08-09]
- All extension contexts (panels + SW + content scripts) access chrome.storage [CITED: same]
- fakeBrowser mocks all areas incl. `session` and `sync` → sync-shadow tests are mockable; the quota failure itself must be mocked (fakeBrowser does NOT enforce quotas) [VERIFIED: probe]
- The local-write rate limit is NOT documented on the official page (only sync has documented per-minute/per-hour constants) → do not hard-code a local rate limit [ASSUMED: Chrome throttles storage.local writes in MV3, but no official constant to cite]

### Pattern 5: Sync-quota local shadow (D-15)

**What:** sync write fails (quota or rate) → `SYNC_QUOTA_EXCEEDED` debugLog → same key to chrome.storage.local. Reads: sync-first, then local; if the local shadow wins, re-attempt sync and delete the shadow on success. Debounce cosmetic writes.

**Verified facts:**
- Sync quota/rate failure surfaces as a rejected promise (or runtime.lastError) [CITED: Chrome storage docs]
- **Landmine:** Phase 1's ThemeStore writes `np_theme`/`np_theme_pack` to chrome.storage.**local** (D-13, ThemeStore.ts lines 72-74), but spec §15.1 (line 1947-1949) says these live in chrome.storage.**sync**. D-15 requires sync-first semantics. The planner must rewire ThemeStore's persistence through Setting.ts in Phase 2 (small Phase-1 file edit — same precedent as D-06 rewiring WorkspaceStore) OR declare the theme keys local-only and implement the sync shadow machinery for future consumers. **Recommend the rewire** — otherwise D-15 has no live consumer (same logic as D-05's "wire at least one consumer" rule).
- The one-line spec touch (APPR-03 wording) is a documentation edit in PRODUCT_SPEC §17.1a — low risk, include in the plan.

### Pattern 6: Redaction at every write boundary (D-16 / §16.5 / O.13)

**What:** TraceRedactor gets its real body (regex list from Appendix O.13: `sk-…`, `key-…`, `Bearer …`, `JSESSIONID=…`, `sysparm_ck=…`, `g_ck=…` → `[REDACTED]`); `redactSensitive.ts` does field-level redaction for storage-bound objects, **DROPPING password-like fields** (never masked). Every ErrorStore.write / journal persist / debugLog string routes through redact (existing debugLog already routes strings through TraceRedactor — the pass-through placeholder swap is caller-invisible).

**Design note:** the vault ciphertext itself must NOT be re-redacted (it's already encrypted) — redactSensitive operates on plaintext-before-encryption at write boundaries and on non-secret metadata.

### Pattern 7: Import/Export core (D-17/18 + fflate)

**Verified:** `zipSync`/`unzipSync`/`strToU8`/`strFromU8` roundtrip works in the jsdom-align env (isolated test passed); the earlier "Maximum call stack size exceeded" was a cascade artifact of the leaked fake-indexeddb rejection in the same file — fflate itself is clean (verified in isolation and alongside passing idb tests) [VERIFIED: probes].

**Contract:** JSON canonical; ZIP via fflate for full exports; groups `chat-history | notes | memory | workspace | settings` (mirrors export-data `{ scopes: string[] }`, spec line 1598); manifest `{ exportedAt, appVersion, schemaVersion }`; per-group merge/upsert by id (existing wins; "restore overwrites" toggle); full-vault restore runs journaled (restore-batch-style op). No secret material ever (D-01).

### Anti-Patterns to Avoid
- **idb `openDB` with a throwing upgrade in tests** — fake-indexeddb double-settle → vitest exit 1. Use the raw-open migrator pattern (Pattern 2). If a raw abort MUST be tested, keep it in its own file and expect the vitest unhandled-error flag (it still fails CI — verified exit 1).
- **`await` inside a raw upgrade callback** — the transaction auto-closes (idb README transaction-lifetime rule; verified with raw API). Use request-chaining.
- **Fire-and-forget async IIFEs inside `onupgradeneeded`** — unhandled rejections + tx closes (my first probe failed exactly this way).
- **zustand storage middleware** for workspace durability — writes localStorage, does not cross surfaces (Phase 1 Pitfall 7, already avoided).
- **Storing message bodies in chrome.storage.local** — 10MB quota + spec §0.2 line 86 forbids; bodies live in IndexedDB (STORAGE-01/§15.1).
- **Auto-wiping ciphertext on decrypt failure** — D-03/D-04 forbid; all three unreadable roads converge on PROVIDER_KEY_UNREADABLE.
- **Regenerating installSecret** — D-02 forbids (would orphan all keys); immutable-once-set.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB promise wrapping | Promise-wrapping IDBRequest | idb ^8 | Battle-tested, fully typed, async-upgrade support; ~1.2kB |
| AES-GCM encryption / key derivation | Custom crypto | `crypto.subtle` (WebCrypto) | Native constant-time primitives; spec §15.2 verbatim; never hand-roll crypto |
| ZIP packaging | zip implementation | fflate ^0.8 | Approved stack; sync API; zero deps |
| IndexedDB test harness | Hand-rolled fake IDB | fake-indexeddb ^6 | WPT-validated (82.8%); the ecosystem standard |
| chrome.* mocks | Manual mocks | wxt/testing fakeBrowser | Existing Phase 1 pattern; covers local/sync/session |
| Write serialization mutex | Ad-hoc flags | Promise-chain queue in Setting.ts | Simple, await-safe, testable |
| Crash-recoverable writes | Manual retry logic | WriteJournal (Appendix O.11) | Atomic-on-recovery semantics per §20.3 |

**Key insight:** every "deceptively complex" problem in this phase (IndexedDB migrations, crypto, ZIP, crash recovery) has a standard, verified solution. The one thing you CANNOT hand-roll around is fake-indexeddb's abort-path bug — hence the migrator's raw-open pattern, which is the single non-obvious architectural decision in this phase.

## Common Pitfalls

### Pitfall 1: fake-indexeddb + idb openDB upgrade-abort → CI failure (VERIFIED — the phase's biggest landmine)
**What goes wrong:** a test that makes an upgrade migration throw (or abort the versionchange tx) passes its assertions but `vitest run` reports an unhandled rejection and exits 1 — `verify:phase-2` fails.
**Why it happens:** fake-indexeddb 6.2.5 double-settles upgrade failures: the error event (which idb consumes → openDB rejects AbortError) AND an internal `cb(new AbortError())` on a macrotask that nobody listens to (FDBFactory.js `transaction._prioritizedListeners.set('abort', …)` → `queueTask(cb)`). Verified: throw / explicit `tx.abort()` / `.then(() => tx.abort())` all leak; listeners on tx/db do NOT suppress it.
**How to avoid:** migrator uses raw `indexedDB.open` + sync dispatch + `wrap()` (Pattern 2) — verified clean (exit 0). Never trigger a real upgrade abort through idb `openDB` in tests.
**Warning signs:** vitest output "Unhandled Rejection … ABORT_ERR … Test Files 1 passed (1) … exit code 1".

### Pitfall 2: Async migrations close the upgrade transaction
**What goes wrong:** data-carry or multi-step migrations that `await` non-IDB promises (fetch, crypto) inside the upgrade callback lose the transaction — subsequent puts throw `TransactionInactiveError`; with raw open the DB bumps version with partial schema.
**Why it happens:** IDB transactions auto-close when no requests are pending (idb README transaction-lifetime rule).
**How to avoid:** keep all migration work inside the upgrade callback as IDBRequest chains; if crypto/fetch is needed, precompute outside the version-change open. Use idb `openDB`'s async upgrade ONLY when the awaits are idb operations.
**Warning signs:** "TransactionInactiveError" or silently missing rows after migration.

### Pitfall 3: Migration error message swallowed → misdiagnosis
**What goes wrong:** a throwing migration surfaces to `openDB` as a generic "A request was aborted, for example through a call to IDBTransaction.abort" (AbortError) — the original error is lost.
**Why it happens:** the upgrade transaction abort replaces the error (spec behavior; verified with fake-indexeddb).
**How to avoid:** the migrator wraps each migration call so the ORIGINAL error is captured inside the upgrade callback (record `IDB_MIGRATION_FAILED` + message to ErrorStore) before the abort propagates; the degraded path keys off the AbortError rejection.
**Warning signs:** ErrorStore shows AbortError with no original cause.

### Pitfall 4: chrome.storage.local 10MB quota vs message bodies
**What goes wrong:** conversation bodies or large page extracts written to chrome.storage.local fail with quota rejection; spec §0.2 forbids bodies in local.
**Why it happens:** 10MB QUOTA_BYTES measured as JSON-stringified values + key lengths [CITED: Chrome docs].
**How to avoid:** bodies always → IndexedDB stores; chrome.storage.local holds metadata only (§15.1 split); treat set() rejections as STORE_WRITE with quota context.
**Warning signs:** rejected set() with `QuotaExceededError`.

### Pitfall 5: Sync quota/rate writes failing silently
**What goes wrong:** chrome.storage.sync writes fail for values > 8KB per key, > ~100KB total, or > 120 writes/min (documented constants) — without D-15 handling, cosmetic settings silently stop syncing.
**How to avoid:** Setting.ts sync-shadow fallback (D-15); debounce theme/pack/language writes; catch BOTH quota and rate rejections under SYNC_QUOTA_EXCEEDED.
**Warning signs:** sync writes never appearing cross-device; console quota errors.

### Pitfall 6: crypto.subtle unavailable in a context
**What goes wrong:** KeyVault/EncryptedStorage imported into a content script on an http:// page → `crypto.subtle` undefined.
**Why it happens:** SubtleCrypto is available only in secure contexts (HTTPS) [CITED: MDN SubtleCrypto]; extension pages + SW are secure, content scripts follow the HOST page.
**How to avoid:** R-3 already confines the vault to panels — enforce via import boundaries + the content-bundle isolation check (add `KeyVault`/`EncryptedStorage` awareness if needed). The background SW DOES have crypto.subtle (worker context) but must not touch the vault by design (R-3).
**Warning signs:** "crypto.subtle is undefined" in a content bundle.

### Pitfall 7: InstallSecret regeneration / clobbering
**What goes wrong:** two contexts race to generate np_install_secret and overwrite each other; or a recovery path regenerates it and orphans every stored key.
**How to avoid:** read-then-write-if-absent (D-02), immutable-once-set; never regenerate on decrypt failure (D-04).
**Warning signs:** keys that were readable suddenly unreadable after an init path ran.

## Code Examples

Verified patterns from this session's empirical probes (same vitest/jsdom stack as the project) and official docs:

### idb + fake-indexeddb: openDB with typed schema + index (STORAGE-01)
```typescript
// Source: empirical probe + idb README (github.com/jakearchibald/idb)
import 'fake-indexeddb/auto'; // in tests/setup.ts (global) or per test file
import { openDB, type DBSchema } from 'idb';

interface ChatDB extends DBSchema {
  sessions: { key: string; value: ChatSession };
  messages: {
    key: string; value: ChatMessage;
    indexes: { 'by-session': string; 'by-timestamp': number };
  };
}
const db = await openDB<ChatDB>('ChatHistoryDB', 1, {
  upgrade(db) {
    db.createObjectStore('sessions', { keyPath: 'id' });
    const msgs = db.createObjectStore('messages', { keyPath: 'id' });
    msgs.createIndex('by-session', 'sessionId');
    msgs.createIndex('by-timestamp', 'timestamp');
  },
});
await db.put('messages', { id: 'm1', sessionId: 's1', role: 'user', content: 'hi', timestamp: 1 });
const rows = await db.getAllFromIndex('messages', 'by-session', 's1');
```

### Async upgrade with data-carry (idb openDB — happy path only)
```typescript
// Source: empirical probe (datacarry2.test.ts — 1/1 pass, clean)
const db2 = await openDB<DB2>('notes-db', 2, {
  async upgrade(db, oldVersion, _newVersion, tx) {
    if (oldVersion < 2) {
      const legacy = tx.objectStore('legacy');
      const rows = await legacy.getAll();                 // idb wraps: await OK inside idb openDB upgrade
      db.createObjectStore('new', { keyPath: 'id' });
      const ns = tx.objectStore('new');
      for (const row of rows) await ns.put(row);
      tx.objectStore('legacy').createIndex('by_title', 'title');
    }
  },
});
```

### Migrator failure path — degraded-mode reads (D-12)
```typescript
// Source: empirical probe (migrator2/migrator3 tests) — raw open for migrations
let rejection: unknown = null;
try { await migratorOpen('notes-db', 2, [() => { throw new Error('boom'); }]); }
catch (e) { rejection = e; }
expect((rejection as DOMException).name).toBe('AbortError');  // original 'boom' swallowed
const db = await openDB('notes-db');                          // degraded reads at v(n-1)
expect(db.version).toBe(1);                                   // atomic rollback
expect((await db.get('legacy', 'r1')).title).toBe('survivor');
```

### EncryptedStorage round-trip (crypto.subtle, verified in jsdom-align)
```typescript
// Source: empirical probe — AES-GCM + PBKDF2 in the project's test env
const subtle = crypto.subtle;
const baseKey = await subtle.importKey('raw', new TextEncoder().encode(installSecret + extensionId),
  'PBKDF2', false, ['deriveKey']);
const derived = await subtle.deriveKey(
  { name: 'PBKDF2', salt: new Uint8Array(16), iterations: 100_000, hash: 'SHA-256' },
  baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
const iv = crypto.getRandomValues(new Uint8Array(12));
const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, derived, new TextEncoder().encode('sk-abc'));
const pt = await subtle.decrypt({ name: 'AES-GCM', iv }, derived, ct);   // auth-tag mismatch → throws (D-03)
```

### fflate ZIP export (D-17)
```typescript
// Source: empirical probe — zipSync/unzipSync/strToU8/strFromU8 roundtrip, clean in jsdom-align
import { zipSync, unzipSync, strFromU8, strToU8 } from 'fflate';
const zip = zipSync({
  manifest: strToU8(JSON.stringify({ exportedAt: 1723, appVersion: '0.1.0', schemaVersion: 2 })),
  'groups/workspace.json': strToU8(JSON.stringify({ workspaceId: 'w1' })),
}, { level: 6 });
const restored = unzipSync(zip);
JSON.parse(strFromU8(restored['groups/workspace.json'])); // { workspaceId: 'w1' }
```

### TraceRedactor real body (Appendix O.13, verbatim)
```typescript
// Source: PRODUCT_SPEC Appendix O.13 (lines 6686-6694)
const REDACTION_PATTERNS: RegExp[] = [
  /sk-[A-Za-z0-9_-]+/g, /key-[A-Za-z0-9_-]+/g, /Bearer\s+[A-Za-z0-9._-]+/gi,
  /JSESSIONID=[^;\s]+/gi, /sysparm_ck[=:]\s*[^&\s]+/gi, /g_ck[=:]\s*[^&\s]+/gi,
];
export function redact(value: string): string {
  return REDACTION_PATTERNS.reduce((s, re) => s.replace(re, '[REDACTED]'), value);
}
```

### runJournaled / recoverJournal (Appendix O.11, verbatim — feasibility confirmed)
```typescript
// Source: PRODUCT_SPEC Appendix O.11 (lines 6601-6634) — usable as-is with adaptations below
export async function runJournaled(entry: WriteJournalEntry, steps: JournalStep[], persist: (e: WriteJournalEntry) => Promise<void>): Promise<void> {
  entry.status = 'applying'; entry.attempts++; await persist(entry);
  const done: JournalStep[] = [];
  try {
    for (const s of steps) {
      await s.apply(); entry.steps.push({ name: s.name, status: 'completed' }); done.push(s); await persist(entry);
    }
    entry.status = 'completed'; await persist(entry);
  } catch (e: any) {
    debugLog(ERROR_CODES.WRITE_JOURNAL_FAILED, 'rolling back', { id: entry.id, step: done.at(-1)?.name });
    for (const s of done.reverse()) { try { await s.rollback(); } catch (r: any) { debugLog(ERROR_CODES.WRITE_JOURNAL_ROLLBACK_FAILED, r?.message ?? 'rollback', { id: entry.id }); } }
    entry.status = 'rolled-back'; await persist(entry);
    throw e;
  }
}
export async function recoverJournal(load: () => Promise<WriteJournalEntry[]>, replay: (e: WriteJournalEntry) => Promise<void>): Promise<void> {
  for (const e of await load()) { if (e.status === 'applying' || e.status === 'pending') await replay(e); }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| chrome.storage.local for everything | Metadata in local / bodies in IndexedDB (idb) | v0.1 spec §0.2/§15.1 | 10MB quota no longer a ceiling for chat/memory |
| Plaintext API keys in storage | AES-GCM-256 at-rest obfuscation (installSecret + PBKDF2) | v0.1 spec §15.2 | Casual disk/sync inspection no longer reveals keys |
| Write-and-pray persistence | WriteJournal atomic-on-recovery (replay/rollback) | v0.1 spec §20.3/O.11 | Mid-write crash leaves consistent state |
| Manual schema patching | IndexedDB versioned migrations + degraded mode | v0.1 spec §20.4 | Deterministic upgrade path, read-only fallback on failure |
| Sync-only settings | Sync canonical + local shadow fallback | D-15 (Phase 2) | Cosmetic settings never silently lost on quota/rate limits |
| Pass-through TraceRedactor | Real regex redaction + field-level redactSensitive | D-16 (Phase 2) | R-10 enforced from the moment telemetry stores are born |

**Deprecated/outdated:**
- `fake-indexeddb`'s bundled structuredClone polyfill: removed in v5+; relies on global `structuredClone` — present in Node 24, so this project is unaffected [CITED: fakeIndexedDB README].
- `MAX_SUSTAINED_WRITE_OPERATIONS_PER_MINUTE` on storage.sync: deprecated (no longer a quota) [CITED: Chrome storage docs].

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Chrome throttles storage.local writes in MV3 (rate limit exists but is undocumented) | Common Pitfalls 5 / Setting.ts | Only affects the debounce aggressiveness for theme writes — low risk; sync constants ARE documented and are the real constraint |
| A2 | OWASP 2023 recommends ≥ 600k PBKDF2 iterations (vs the locked 100k) | KeyVault | Informational only — the 100k decision is LOCKED (D-02); if the user later wants OWASP parity it's a one-line constant change |
| A3 | `chrome.runtime.id` is stable per install (it is per Chrome install for unpacked/extensions) and never changes on browser update | KeyVault derivation | If it ever changed, all keys would be unreadable → PROVIDER_KEY_UNREADABLE (the designed recovery path); spec §15.2 requires stability — the derivation is correct as designed |
| A4 | The import/export core file (`src/core/storage/ImportExport.ts`) is an acceptable +1 to the §18 create-list | Open Questions Q2 | If the planner enforces a strict create-list, the module has no home — must be resolved in planning (recommend the +1 with a documented Rule-3 deviation note, same as Phase 1 did) |
| A5 | fflate's ZIP output needs no compression options beyond `{ level: 6 }` | Import/Export | Cosmetic; any valid deflate level roundtrips (verified level 6) |

## Open Questions (RESOLVED)

> All four questions were resolved during plan-phase authoring; each is answered below and its resolution is adopted in the 02-01..02-11 plan set.

1. **Where does the import/export core module live?** (D-17..D-19 require it; §18 create-list omits it) — **RESOLVED:**
   - What we know: D-09's folding rule forbids *StorageLayer/StorageSession* names specifically; no spec path exists for import/export core (only Phase 7 UI paths: `ImportExportSection.tsx` line 2791, `ImportExportPanel.tsx` line 2905).
   - What's unclear: whether to add `src/core/storage/ImportExport.ts` (+1 file, documented deviation) or fold the functions into Setting.ts (bad fit).
   - Recommendation: **add `src/core/storage/ImportExport.ts`** with a Rule-3 deviation note (Phase 1 precedent: documented deviations in plan comments).
   - **Resolution:** adopted — plan 02-09 Task 1 creates `src/core/storage/ImportExport.ts` with the header Rule-3 deviation note.
2. **Phase 1 ThemeStore writes np_theme to chrome.storage.local (D-13); D-15 requires sync-first for np_theme/np_theme_pack/np_language.** Does Phase 2 rewire ThemeStore through Setting.ts? — **RESOLVED:**
   - What we know: D-06 already rewires WorkspaceStore (Phase-1 file edit precedent); D-15 needs a live consumer; spec §15.1 places these keys in sync.
   - Recommendation: **rewire ThemeStore's persistence to Setting.ts** (sync-first + local shadow), keeping ThemeStore's read-validate pattern. Include the one-line APPR-03 spec touch.
   - **Resolution:** adopted — plan 02-08 Task 2 rewires ThemeStore init/setMode/setPack/onChanged through Setting.ts sync-first; plan 02-08 Task 3 applies the APPR-03 one-line spec touch.
3. **Degraded-mode UI banner surfacing** — D-12 requires "persistent UI banner", but the Import/ExportPanel UI is Phase 7. Where does the banner state live in Phase 2? — **RESOLVED:**
   - Recommendation: ship a `degraded: { db: string; reason }[]` state (module-level, e.g. from the migrator) + the canonical banner string in Appendix B / i18n strings.ts; the actual banner component renders in Phase 7 (same core-only split as import/export, D-19).
   - **Resolution:** adopted — plan 02-06 Task 1 exports `getDegradedDbs()`/`isDbDegraded()`; the banner string ships in plan 02-01 Task 2 (`STR.storage.degradedBanner`); the component renders in Phase 7.
4. **ErrorStore migration-failure recording during init ordering** — ErrorStore is itself an IndexedDB store; if a migration of ANOTHER DB fails before ErrorStore is open, can IDB_MIGRATION_FAILED still be recorded? — **RESOLVED:**
   - Recommendation: ErrorStore opens first (or with `readonly` open fallback); on IDB_MIGRATION_FAILED for any DB, open ErrorStore at its current version and record. Edge: if ErrorStore itself fails to migrate → log via debugLog (console sink, redacted) + degraded state in-memory.
   - **Resolution:** adopted — plan 02-06 Task 2 ships `recordMigrationFailure(dbName, cause)` as the IDB_MIGRATION_FAILED sink with the debugLog + in-memory degraded fallback when ErrorStore itself cannot open.

## Environment Availability

> Phase 2 adds external dependencies (idb, fflate, fake-indexeddb) and depends on WebCrypto + IndexedDB — audited this session.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vitest, webcrypto, structuredClone | ✓ | 24.18.1 (webcrypto + structuredClone native) | — |
| pnpm | installs | ✓ | 11.18.0 | — |
| vitest | test suite | ✓ | 4.1.10 (installed) | — |
| jsdom | DOM env | ✓ | 30.0.1 (installed) | — |
| wxt/testing fakeBrowser | chrome.* mocks (local/sync/session + runtime.sendMessage) | ✓ | via wxt 0.19.29 | — |
| crypto.subtle | KeyVault/EncryptedStorage | ✓ | Node 24 webcrypto + jsdom-align env (verified) | — |
| indexedDB in tests | IDB store tests | ✗ (jsdom lacks it) | — | **fake-indexeddb ^6** (verified working) |
| idb | IDB access | ✗ | — | install `idb@^8` (approved stack; latest 8.0.3) |
| fflate | ZIP import/export | ✗ | — | install `fflate@^0.8` (approved stack; latest 0.8.3) |
| fake-indexeddb | test harness | ✗ | — | install devDep `fake-indexeddb@^6` (6.2.5) |
| Real Chrome ≥ 120 | manual DONE-when checks (storage inspect, cross-surface handoff) | ✗ (not probed this session) | — | `pnpm wxt build` + e2e smoke (`verify:e2e-phase-1` pattern) at end of phase |

**Missing dependencies with no fallback:** none — all gaps have concrete installs/fallbacks above.

## Validation Architecture

> `.planning/config.json`: `workflow.nyquist_validation: true`, `security_enforcement: true` → both sections required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.10 (custom `jsdom-align` env, threads pool) + WxtVitest plugin + fakeBrowser |
| Config file | `vitest.config.ts` + `tests/setup.ts` (add `import 'fake-indexeddb/auto'` for IDB tests) |
| Quick run command | `pnpm vitest run tests/core/storage tests/core/utils` |
| Full suite command | `pnpm vitest run` |
| Phase gate | `verify:phase-2` — follow Phase 1's extended template: `eslint . && prettier --check . && tsc --noEmit && wxt build && vitest run && node tests/isolation/check-content-bundle.mjs` (spec §24 line 3666 minimum: `tsc --noEmit && vitest run tests/core/storage tests/core/security tests/core/utils tests/core/workspace/WorkspacePersistence.test.ts`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STORAGE-01 | Four IDB stores open via idb with typed schema; CRUD roundtrip | unit (fake-indexeddb) | `pnpm vitest run tests/core/storage/ChatHistoryDB.test.ts tests/core/storage/NotesDB.test.ts tests/core/storage/MemoryDB.test.ts` | ❌ new |
| STORAGE-01 | ErrorStore FIFO max 100 + redaction-before-write | unit | `pnpm vitest run tests/core/storage/ErrorStore.test.ts` | ❌ new |
| STORAGE-02 | Setting.ts permission table: per-key area/encrypted/writeAllowed + serialized writes (no concurrent Setting<T> writes) | unit | `pnpm vitest run tests/core/storage/Setting.test.ts` | ❌ new |
| STORAGE-02 | np_schema_version migrate-on-read normalizes old KV shapes | unit | `pnpm vitest run tests/core/storage/Setting.test.ts` | ❌ new |
| STORAGE-03 | AES-GCM roundtrip under one secret (fixture `vault-roundtrip`) | unit | `pnpm vitest run tests/core/storage/EncryptedStorage.test.ts` | ❌ new |
| STORAGE-03 | Cross-install decrypt → PROVIDER_KEY_UNREADABLE, NO wipe (fixture `cross-install`) | unit | `pnpm vitest run tests/core/security/KeyVault.test.ts` | ❌ new |
| STORAGE-04 | runJournaled happy/rollback/unknown-op-skip; recoverJournal replay-once idempotent + workspace-scoped (fixture `journal-recovery`) | unit | `pnpm vitest run tests/core/storage/WriteJournal.test.ts` | ❌ new |
| STORAGE-04 | WorkspaceStore.update() routes through journal; crash-mid-write recovery (integration, same builders) | integration | `pnpm vitest run tests/core/workspace/WorkspacePersistence.test.ts` | ❌ new |
| STORAGE-05 | JSON + ZIP export sanitized (no secrets); per-group merge/upsert restore; journaled full restore | unit | `pnpm vitest run tests/core/storage/ImportExport.test.ts` | ❌ new |
| D-13 | v1→v2 migration: add-store + add-index + data-carry + idempotency + throws→degraded (fixture `migration`) | unit | `pnpm vitest run tests/core/storage/IndexedDBMigrator.test.ts` | ❌ new |
| D-15 | Sync fail → local shadow → promote/clear (fixture `quota-shadow`) | unit | `pnpm vitest run tests/core/storage/Setting.test.ts` | ❌ new |
| D-16 | TraceRedactor regex + redactSensitive DROP-password (fixture `redaction`) | unit | `pnpm vitest run tests/core/security/redactSensitive.test.ts` | ❌ new |
| §18 | RateLimiter per-instance token bucket | unit | `pnpm vitest run tests/core/utils/RateLimiter.test.ts` | ❌ new |
| §18 | Requester wraps PROXY_FETCH with 25s timeout (fakeBrowser sendMessage) | unit | `pnpm vitest run tests/core/http/Requester.test.ts` | ❌ new |
| §18 required | Workspace persists across reload + handoff (integration, same builders as unit) | integration | `pnpm vitest run tests/core/workspace/WorkspacePersistence.test.ts` | ❌ new |
| Privacy | No message body in chrome.storage.local (grep/test on write boundaries) | unit+static | `pnpm vitest run tests/core/storage` + grep | ❌ new |
| §24 isolation | Content bundle stays clean (idb/fflate/vault not bundled into content scripts) | build+grep | `node tests/isolation/check-content-bundle.mjs` (extend FORBIDDEN_TOKENS if needed) | ✅ exists |

**Test check-categories required by the phase gate (source + behavior + CLI + security-sensitive):**
- **Source assertions:** grep `'innerHTML|dangerouslySetInnerHTML' src/` → zero (Phase 1 gate, keep); grep banned packages in package.json → zero; no `console.error` outside debugLog (existing verify pattern).
- **Behavior assertions:** the §18 required-tests files above all green; fixture-driven (D-20/21: same builders in unit + integration).
- **CLI outputs:** `pnpm wxt build` succeeds; `check-content-bundle.mjs` reports clean; `tsc --noEmit` clean; `prettier --check` clean; `eslint .` clean.
- **Security-sensitive checks (MUST be automated):** encryption round-trip (vault-roundtrip); **no-secrets-in-storage** (assert chrome.storage.local never contains plaintext apiKey / sk-… / Bearer / JSESSIONID= — a test that writes via EncryptedStorage then dumps storage.local and asserts redaction); redaction-before-persist (ErrorStore/journal entries contain `[REDACTED]`, never the raw secret); sync-quota-fallback (quota-shadow fixture with mocked set() rejection); cross-install unreadable (no wipe assertion).

### Sampling Rate
- **Per task commit:** `pnpm vitest run tests/core/storage tests/core/utils` (fast)
- **Per wave merge:** `pnpm vitest run` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `pnpm add idb@^8 fflate@^0.8 && pnpm add -D fake-indexeddb@^6`
- [ ] `tests/setup.ts` — add `import 'fake-indexeddb/auto'` (+ per-test `indexedDB = new IDBFactory()` reset if DB-name isolation is insufficient)
- [ ] `tests/fixtures/` — typed builders: vault-roundtrip, cross-install, journal-recovery, migration, quota-shadow, redaction (D-20/21)
- [ ] `errorCodes.ts` — extend IN PLACE with VAULT_DECRYPT_FAILED, PROVIDER_KEY_UNREADABLE, IDB_MIGRATION_FAILED, SYNC_QUOTA_EXCEEDED, WRITE_JOURNAL_FAILED, WRITE_JOURNAL_ROLLBACK_FAILED (+ canonicalize into spec Appendix C.2 — CONTEXT line 84 requires both)
- [ ] `package.json` — add `verify:phase-2` script (Phase 1 extended template)

## Security Domain

> `.planning/config.json` does not set `security_enforcement: false` → enabled. Phase 2 is the FIRST phase with real secret handling, crypto, and durable telemetry — the security surface is the vault, the write boundaries, and the import/export path.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Provider key *storage* is Phase 2; provider auth flows are Phase 3 |
| V3 Session Management | partial | Session tokens declared in key registry only (D-11), never encrypted (session-scoped, cleared on browser close) |
| V4 Access Control | yes | R-3 boundary (vault/IndexedDB panels-only, background SW never touches them) + Setting.ts per-key permission table (`writeAllowed`) |
| V5 Input Validation | yes | sanitizeStored/T-1-13 pattern generalized to all KV keys (migrate-on-read, D-10); stored values never merged raw |
| V6 Cryptography | yes | AES-GCM-256 + PBKDF2(100k, SHA-256) via crypto.subtle — **never hand-rolled**; decrypt fails closed (VAULT_DECRYPT_FAILED) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| API key exfiltration via chrome.storage plaintext | Information disclosure | EncryptedStorage envelope {salt, iv, ciphertext} only; installSecret separate key; D-01 never export |
| Secret leakage into logs/telemetry (sk-…, Bearer …, JSESSIONID=) | Information disclosure | TraceRedactor real body + redactSensitive at EVERY write boundary (D-16); password-like fields DROPPED |
| Secret leakage via import/export bundle | Information disclosure | Export groups sanitized before serialization; secrets + ciphertext excluded (D-01/D-17) |
| Cross-install ciphertext restore (undecryptable) | Availability | PROVIDER_KEY_UNREADABLE state → "Key required — re-enter" (D-04); never auto-wipe |
| Quota/rate DoS on sync writes | Availability | SYNC_QUOTA_EXCEEDED → local shadow (D-15); debounce |
| Migration failure → data loss | Availability | Atomic rollback (version stays v(n-1), verified) + degraded read-only + IDB_MIGRATION_FAILED record |
| Upgrade-abort crash in tests masking failures | Integrity (of the test suite) | Raw-open migrator pattern; failure-path tests clean (exit 0, verified) |

## Sources

### Primary (HIGH confidence)
- [PRODUCT_SPEC_v0_1.md §15/§16/§18 Phase-2 block/§20/§21/§24/Appendices C/C.2/E/G/O.11/§0.2] — read in full this session (lines 78-117, 1918-2062, 2568-2604, 3145-3464, 3590-3700, 4059-5100, 5158-5242, 5441-5498, 5868-6007, 6586-6719)
- [02-CONTEXT.md] — D-01..D-21 (user-locked decisions; validated for feasibility, not relitigated)
- [01-CONTEXT.md] — Phase 1 precedents (D-13 theme persistence, D-18 WorkspaceStore field set, verify hygiene)
- [empirical vitest probes — /tmp/opencode/idbprobe, this session] — fake-indexeddb 6.2.5 + idb 8.0.3 + fflate 0.8.3 under vitest 4.1.10 + jsdom 30 + the project's jsdom-align env: crypto.subtle availability, IDB CRUD, async-upgrade data-carry, migrator raw-open happy/failure paths (exit 0), upgrade-abort unhandled-rejection leak (exit 1), fflate isolation, degraded-mode rollback
- [npm registry] — idb 8.0.3 / fflate 0.8.3 / fake-indexeddb 6.2.5 versions + no-postinstall (verified 2026-08-09)
- [gsd-tools package-legitimacy check] — idb/fflate/fake-indexeddb all OK
- [developer.chrome.com/docs/extensions/reference/api/storage] — quota constants (local 10MB, sync 8KB/item + 120/min + 1800/hr + 512 items + ~100KB, session 10MB), access levels (fetched 2026-08-09)

### Secondary (MEDIUM confidence)
- [MDN SubtleCrypto] — secure-context requirement, AES-GCM + PBKDF2 algorithm support, worker availability (fetched 2026-08-09)
- [github.com/jakearchibald/idb README] — openDB/deleteDB/wrap/unwrap, DBSchema typing, async upgrade, transaction-lifetime rule (fetched 2026-08-09)
- [github.com/dumbmatter/fakeIndexedDB README] — `fake-indexeddb/auto` usage, structuredClone caveat (v5+), IDBFactory reset, WPT pass rate (fetched 2026-08-09)

### Tertiary (LOW confidence)
- [Assumptions Log A1-A5] — flagged `[ASSUMED]`; planner should confirm A2 (PBKDF2 iterations) is accepted as locked and A4 (ImportExport.ts +1 file) during planning

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — idb/fflate/fake-indexeddb versions + legitimacy verified against npm this session; crypto via built-in WebCrypto (no new dep)
- Architecture: HIGH — every pattern empirically verified in the project's exact test stack (the migrator raw-open pattern and the fake-indexeddb landmine are the phase's key findings); all decisions traced to locked CONTEXT D-01..D-21
- Pitfalls: HIGH for the fake-indexeddb/migration cluster (empirically reproduced); MEDIUM for Chrome-behavior claims (quota constants cited from official docs; local write-rate from training knowledge — A1)

**Research date:** 2026-08-09
**Valid until:** 2026-09-08 (30 days; versions pinned via npm registry this session; fast-moving item is fake-indexeddb's abort behavior — re-verify if upgrading past 6.2.5)
