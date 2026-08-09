# Phase 2: Storage, Security, WriteJournal, Workspace Persistence - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers durable, crash-safe, encrypted persistence: an AES-GCM vault (KeyVault + EncryptedStorage) protecting secrets at rest in chrome.storage.local, a WriteJournal that makes the workspace-state write crash-recoverable (atomic-on-recovery via replay/rollback), four IndexedDB stores (ChatHistoryDB, NotesDB, MemoryDB, ErrorStore) via idb, an IndexedDBMigrator with a synthetic v1→v2 proof and degraded mode, serialized per-key-permissioned Setting writes, KV migrate-on-read (np_schema_version), real redaction (redactSensitive + TraceRedactor body) wired at every write boundary, sync-quota fallback for cosmetic keys, the core import/export module (JSON + ZIP via fflate, scoped groups, merge/upsert journaled restore), and durable workspace state that persists across page reload and cross-surface handoff. All file paths and types are locked by spec §18 / §8.5 / §15 / §20 / Appendix C. Storage, AI, and IndexedDB live in Side Panel/Standalone only (R-3); the background SW never touches IndexedDB or the vault.
</domain>

<decisions>
## Implementation Decisions

### Vault & Secret Encryption (§15.2)
- **D-01 [vault survival]:** Secrets are **never exported**. `np_providers` apiKey ciphertext and all secret material are excluded from every export (export-data tool contract: "no API keys"). **No passphrase-wrapped portable vault** (new security surface, unjustified for BYO keys; addable in v0.2 with no schema change since salt/IV are already stored). **No ciphertext-as-is export** (ships secret material yet undecryptable cross-install).
- **D-02 [installSecret]:** Plaintext 32 random bytes via `crypto.getRandomValues(new Uint8Array(32))`, base64-encoded, stored in **chrome.storage.local only** as `np_install_secret`. **Generate exactly once** on first init via a read-then-write-if-absent (race-safe; "already present" is authoritative; two contexts must never both generate/clobber). **Immutable once set — never regenerate or overwrite.** Never written to chrome.storage.sync and never included in exports. Security framing: API-key encryption is **AT-REST obfuscation**, install-bound, never leaves the machine; it protects against casual disk/backup/sync inspection, NOT against a process with the extension's storage access. Derived key: PBKDF2(installSecret + extensionId, salt, 100000, SHA-256) → AES-GCM-256, per-key 16-byte salt + 12-byte IV.
- **D-03 [decrypt failure]:** `decrypt()` throws a typed **VAULT_DECRYPT_FAILED**; callers catch it; the value is treated as unreadable and **NEVER auto-wiped**. AES-GCM fails closed (authTag mismatch → throw), so wrong-plaintext is impossible; tampered/garbage ciphertext and wrong-key are indistinguishable and both surface as the same typed throw — **no separate "corruption" branch**.
- **D-04 [recovery UX — the three roads to unreadable]:** (a) restore on a new install, (b) installSecret cleared, (c) tampered ciphertext — all unify onto **ONE shared state + one code (`PROVIDER_KEY_UNREADABLE`)** with one recovery path: the provider surfaces as **"Key required — re-enter"**, enabled=false, treated as unconfigured (routes to the onboarding "configure later" gate). **Do NOT auto-regenerate installSecret on loss** (would orphan all existing keys on a transient storage glitch). **Do NOT auto-wipe** — nothing deleted; re-entry overwrites stale ciphertext. Wipe is **USER-INITIATED only** (a "Remove provider" action), never an automatic consequence of decrypt failure. If installSecret is missing but ciphertext exists → the same `PROVIDER_KEY_UNREADABLE` state.

### WriteJournal & Crash Recovery (§20.3, Appendix O.11)
- **D-05 [journal scope]:** Build the journal **framework** now (`runJournaled` / `recoverJournal` per Appendix O.11, idempotent steps, keying machinery), but wire **ONLY `update-workspace`** — the sole live consumer in Phase 2 — through it, per §20.3 order: pending → write np_workspace → BroadcastBus WORKSPACE_UPDATED → completed. The other 10 op values are declared in the locked `WriteJournalOperation` union (Golden Rule 2 vocabulary) but **declared-but-unwired** — Phase 3/5 extend by adding a consumer, never by editing the vocabulary.
- **D-06 [rewire]:** WorkspaceStore's current **direct** np_workspace write is **redirected through the journal** (without this the journal has no live consumer and recovery is untestable). WorkspaceStore.update() routes through runJournaled with the update-workspace op; journal entry persistence lives in WriteJournalDB (IndexedDB) per §15.1.
- **D-07 [recovery guarantees]:** Idempotency key for update-workspace = **workspaceId + version**; recovery/replay is **workspace-scoped** (WR-10 lesson) — a recovered write cannot contaminate another workspaceId. **Unknown-op replay = skip-and-log** (debugLog), never throw, so a forward-compat entry can't brick startup.
- **D-08 [election deferred]:** The BroadcastBus primary-writer election (`np_workspace_primary` in chrome.storage.session, 3s heartbeat, Standalone tie-break) is **deferred to Phase 3/5** — its real consumers (memory/notes/chat bodies) don't exist yet. Phase 2 relies on the journal + existing version-LWW merge + WR-10 workspaceId scope gate.

### Storage Layer & Permissions (STORAGE-02)
- **D-09 [STORAGE-02 mapping]:** The §18 create-list is authoritative — **no separate StorageLayer.ts / StorageSession.ts files**. The layer concepts fold into the existing files: `Setting.ts` = per-key permissioned typed wrapper over chrome.storage.local/sync with a permission table (key → { area, encrypted?, writeAllowed }) and serialized writes (§ "Settings writes serialized — never two Setting<T> keys concurrently"); `EncryptedStorage.ts` = AES-GCM primitive; `KeyVault.ts` (security/) = installSecret + derived keys + the PROVIDER_KEY_UNREADABLE state machine.

### KV Schema Versioning & Session Tokens
- **D-10 [KV versioning]:** Add **`np_schema_version`** + **migrate-on-read**: at init, read the key and normalize old shapes to current via the per-key sanitizers (the sanitizeStored T-1-13 pattern generalizes to all KV keys). IndexedDB keeps its own §20.4 migrations; migrate-on-read covers chrome.storage.local shape evolution (np_workspace, np_providers, np_addon_settings, and future keys).
- **D-11 [session tokens]:** chrome.storage.session keys (`np_jsessionid`, `np_sysparm_ck`, `np_token_ttl`, `np_active_stream`, `np_workspace_primary`) are **declared in the storage layer's key registry only — no accessors shipped**. Their consumers arrive Phase 3/8. Area is chrome.storage.session (cleared on browser close), never encrypted (session-scoped).

### IndexedDB Migrations (§20.4)
- **D-12 [degraded mode]:** Migration failure records **IDB_MIGRATION_FAILED** in ErrorStore and enters degraded mode = **read-only for the affected DB + persistent UI banner** ("Storage failed to upgrade — data is read-only. Use Import/Export to back up."). Writes are blocked with a typed error surfaced to the UI. **In-memory fallback rejected** (silent shadow-write → split-brain with on-disk state, violates crash-safety). Reads still work from the v(n-1) data.
- **D-13 [v1→v2 fixture]:** The v1→v2 fixture is a **SYNTHETIC schema transition** proving the migrator end-to-end: create a v1 DB (DB_VERSION=1) with an initial store set, run IndexedDBMigrator with a v1→v2 migration that **adds a store + adds an index + carries data**, assert data survives and the new schema exists. The real stores start at their own current version; the fixture demonstrates the framework exactly as DONE-when "migration from v1 → v2 fixture passes" demands.
- **D-14 [migrator seeding]:** Ship the migration **framework now** — IndexedDBMigration interface, DB_VERSION per store, deterministic/idempotent runner, onUpgradeNeeded dispatch, IDB_MIGRATION_FAILED → ErrorStore + degraded mode — seeded with the synthetic v1→v2 proof. Real store migrations (e.g. v4 notes_backup_config in Phase 5a) extend the registry later — same pattern as WriteJournal ops.

### chrome.storage.sync Quota Discipline
- **D-15 [sync fallback]:** A failed chrome.storage.sync write to **cosmetic keys** (`np_theme` / `np_theme_pack` / `np_language`; quota or write-rate) → catch, debugLog canonical code (**SYNC_QUOTA_EXCEEDED**, reusing the THEME_STORAGE_UNAVAILABLE intent), and write the **same key to chrome.storage.local**. Reads check **sync-first, then local**; if a local shadow exists it wins on read AND triggers a re-attempt to write sync; on a successful sync write, **delete the local shadow** — sync/local never silently diverge. UI never surfaces it (value is durable locally; only cross-device propagation is lost). Catch BOTH size and rate errors; small debounce on theme/pack/language writes to avoid tripping the rate limit. Spec touch (one line, not a redesign): reword APPR-03's single-source invariant from "sync is the ONLY store" to "sync is the CANONICAL/preferred store; local is a transient fallback shadow reconciled back to sync when possible."

### Redaction Before Persist (R-10 / §16.5)
- **D-16 [redaction hook wired in Phase 2]:** Real redaction ships **NOW** because ErrorStore, WriteJournalDB, and vault ciphertext are born here. `redactSensitive.ts` (field-level, for storage-bound values) is implemented; `TraceRedactor` gets its **real body** (replacing the Phase-1 pass-through placeholder). Every ErrorStore.write / journal persist / debugLog call routes through it at the write boundary. Phase 6 only ADDS telemetry DBs that consume the hook, not the hook itself. Password-like values are **DROPPED, not masked**.

### Import/Export & Backup/Restore (STORAGE-05)
- **D-17 [export contract]:** **JSON as the canonical format** (inspectable, diffable, sanitizable) + **ZIP via fflate** for full-vault exports with multiple store groups. Scopes mirror export-data's `{ scopes: string[] }`: chat-history, notes, memory, workspace, settings — each group sanitized (redactSensitive before serialization), no secret material, plus a **manifest** `{ exportedAt, appVersion, schemaVersion }`.
- **D-18 [restore semantics]:** Import is **per-group MERGE/upsert** (by id; existing records win on conflict by default, with a "restore overwrites" toggle) — **never** full wipe-and-replace, so a partial restore can't destroy data. Full-vault ZIP restore runs **journaled** (restore-batch-style op) so a mid-restore crash leaves a consistent state. Matches Phase 5a's additive restore-from-folder philosophy.
- **D-19 [UI surface]:** Phase 2 ships **core-only** — the import/export module (sanitize, serialize, manifest, merge logic, ZIP via fflate) + tests. The Options → Advanced → Import/ExportPanel UI is a **Phase 7** deliverable (§18 Phase 7 create-list; §9.3). DONE-when "user can import/export" is satisfied by the verified core + export-data plumbing.

### Test Fixtures (WR-13 lesson)
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product spec (authoritative)
- `.planning/PRODUCT_SPEC_v0_1.md` §18 "Master Implementation Phases" (Phase 2 at lines ~2568–2604) — authoritative create-list, required tests, DONE-when criteria for Phase 2
- `.planning/PRODUCT_SPEC_v0_1.md` §15 "Storage Architecture" (lines ~1918–1991) — storage backends, API key encryption scheme, LRU eviction policy
- `.planning/PRODUCT_SPEC_v0_1.md` §16 "Security" (lines ~1993–2057) — XSS prevention, message security, CSP, manifest permissions, secret redaction (TraceRedactor MUST run before ErrorStore/journal/disk writes)
- `.planning/PRODUCT_SPEC_v0_1.md` §20 "Runtime State Models" (lines ~3161–3224) — WriteJournal operations (§20.3 incl. update-workspace order), IndexedDB migration policy (§20.4 incl. degraded mode), background worker state, active stream state
- `.planning/PRODUCT_SPEC_v0_1.md` §21 "Data Models" (lines ~3325–3454) — ChatSession, ChatMessage, Note, ConversationMeta, MemoryMessage, Fact, WorkspaceState (§21.5)
- `.planning/PRODUCT_SPEC_v0_1.md` §0.5 "Implementation Guardrails & Risk Register" (lines ~191–226) — 10 golden rules + risk register (R-3 IndexedDB location, R-10 redaction)
- `.planning/PRODUCT_SPEC_v0_1.md` §0.2 (lines ~80–110) — "never derive from anything that changes on browser update" invariant, storage split (metadata chrome.storage.local / bodies IndexedDB), secret handling rules

### Appendices (all in `.planning/PRODUCT_SPEC_v0_1.md`)
- **Appendix O.11** (line ~6586) — WriteJournal reference implementation (`runJournaled` / `recoverJournal`) — MUST-read for the journal framework
- **Appendix C** (line ~4137) — Canonical Type Registry (MANDATORY): `WriteJournalEntry` (line ~4594), `WriteJournalOperation`, ConversationMeta, storage types; **Appendix C.2** (line ~4918) — canonical error codes (VAULT_DECRYPT_FAILED, PROVIDER_KEY_UNREADABLE, IDB_MIGRATION_FAILED, SYNC_QUOTA_EXCEEDED, WRITE_JOURNAL_FAILED, WRITE_JOURNAL_ROLLBACK_FAILED must be canonical before Phase 2 ships)
- **Appendix E** (line ~5019) — MessageType registry (WORKSPACE_UPDATED emission within journaled write)
- **Appendix M** (line ~5729) — WorkspaceStore reference (workspace durability + version-LWW + M.3 scope gate)
- **Appendix G** (line ~5302) — manifest permissions / CSP
- **Appendix B** (line ~4029) — canonical user strings (import/export, degraded-mode banner copy)
- **Appendix A** (line ~3962) — canonical prompt constants

### Flows & Features
- **§9.3 Options Page** (line ~1431) — Advanced → Import/Export (sanitised JSON/ZIP), provider dialog (§15.2 AES-encrypted apiKey, never rendered plaintext)
- **export-data tool** (line ~1598) — `{ scopes: string[] }`, "Export bundle (no API keys)" — the export scopes vocabulary
- **Flow 1a / §3.3** (lines ~575–591) — memory/chat split, IndexedDB-only message bodies
- **§10.7 / ProxyFetch + RateLimiter** (lines ~1507, ~1523, ~1645) — RateLimiter per-instance per-addon semantics

### Project planning artifacts
- `.planning/ROADMAP.md` — Phase 2 goal + success criteria (lines ~78–91)
- `.planning/REQUIREMENTS.md` — STORAGE-01…05 traceability (lines ~26–33)
- `.planning/PROJECT.md` — core value, constraints, key decisions (esp. encrypted vault, WriteJournal CRDT, no banned packages, R-3)
- `AGENTS.md` — project instruction file (10 golden rules, risk register, approved stack, banned list)

### Phase 1 context (precedent)
- `.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-CONTEXT.md` — D-13 theme persistence via chrome.storage.local + onChanged; D-18 WorkspaceStore field set; R-10 TraceRedactor placeholder note; verify:phase-N hygiene

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/core/workspace/WorkspaceStore.ts` — existing np_workspace direct-write adapter (`writeStorage`, `sanitizeStored`, version-LWW onChanged handler). Phase 2 rewires `update()` through the journal while reusing the sanitize/LWW machinery. D-06.
- `src/core/registry/AddonSettingsStore.ts` — the chrome.storage.local + onChanged + sanitizeStored write-through pattern (np_addon_settings); the template Setting.ts generalizes to a per-key permissioned wrapper.
- `src/core/security/TraceRedactor.ts` — Phase-1 pass-through placeholder; Phase 2 replaces its body with real redaction (D-16). Its stable signature means no caller churn.
- `src/core/error/errorCodes.ts` + `src/core/error/debugLog.ts` — canonical code registry + logger. Phase 2 extends ERROR_CODES IN PLACE with the storage/vault/migration/journal codes; every new catch calls debugLog (Golden Rule 9).
- `src/core/workspace/WorkspaceSync.ts` + `src/core/runtime/BroadcastBus.ts` — WORKSPACE_UPDATED emission exists; the journaled update-workspace flow reuses it (agent discretion).
- `src/core/ai/ProviderRegistry.ts` — provider gate primitive; the PROVIDER_KEY_UNREADABLE → onboarding "configure later" routing reuses its activation gate.

### Established Patterns
- **chrome.storage.local + onChanged + sanitizeStored (T-1-13)** — the cross-surface sync pattern from Phase 1; Phase 2 extends it to the vault and migrate-on-read.
- **Version-LWW + M.3 workspace scope gate (WR-10)** — inbound np_workspace values are shape-checked → sanitized → workspaceId-gated → version-LWW. Journal replay must apply the same workspace scoping (D-07).
- **Spec-verbatim file paths (§8.5/§18) + Appendix C types (R-1)** — no invented identifiers; StorageLayer/StorageSession fold into Setting.ts/EncryptedStorage.ts (D-09).
- **Golden Rule 9** — every catch calls debugLog with a canonical §C.2 code; new Phase-2 codes must be canonicalized into the spec Appendix C.2 before shipping.
- **verify:phase-N gate** — eslint + prettier + tsc --noEmit + wxt build + vitest run + isolation check (Phase 1's verify:phase-1 script is the template for verify:phase-2).
- **R-3** — IndexedDB + vault + crypto.subtle live in Side Panel/Standalone only; the background SW never touches them.

### Integration Points
- `src/entrypoints/sidepanel/main.tsx` and `src/entrypoints/standalone/main.tsx` — where WorkspaceStore.init() and (new) storage-layer init (KeyVault first-run, migrate-on-read, IDB migrator) fire on surface mount.
- `src/core/workspace/WorkspaceStore.ts` — the journaled write path plugs in here (D-06); keep `sanitizeStored` shared as the single inbound gate.
- `src/core/error/errorCodes.ts` + spec Appendix C.2 — canonical codes must be added in both places.
- Tests: `tests/core/workspace/WorkspacePersistence.test.ts` (new, per §18) imports the SAME fixture builders as the unit tests (D-20/21). Existing test env: vitest + jsdom-align environment + threads pool (Phase 1 established); idb tests likely need fake-indexeddb or the jsdom-indexeddb setup — researcher should verify the exact mechanism Phase 1 didn't yet need.

</code_context>

<specifics>
## Specific Ideas

- The vault is **at-rest obfuscation, not a user-secret boundary** — frame it that way in comments/docs; never over-claim (D-02).
- Three roads to unreadable (restore-on-new-install / installSecret cleared / tampered ciphertext) = **one shared state + one code + one recovery path** (D-04).
- Fixtures are the WR-13 guard — the scenario that regressed is the one that must be proven (D-20/21).
- Idb tests will need an IndexedDB harness (fake-indexeddb or equivalent) not yet present in Phase 1's test stack — confirm mechanism during research.

</specifics>

<deferred>
## Deferred Ideas

- **Primary-writer election (`np_workspace_primary` CAS + 3s heartbeat + promotion)** — deferred to Phase 3/5 when memory/notes/chat-body writers exist (D-08).
- **Other WriteJournal ops** (append-memory-message, save-note-with-links, evict/archive/compact-conversation, update-user-memory, sync/delete-note-file) — declared-but-unwired; consumers arrive Phase 3/5 (D-05). **Exception (user-confirmed 2026-08-09):** `restore-notes-batch` IS wired as a live Phase-2 journal consumer — locked D-18 ("full-vault ZIP restore runs journaled") supersedes the declared-but-unwired wording for this op.
- **Session-token accessors** (np_jsessionid, np_sysparm_ck, np_token_ttl, np_active_stream) — Phase 8 ServiceNow add-on surface; Phase 2 declares keys only (D-11).
- **Passphrase-wrapped portable vault** — possible v0.2 addition with no schema change since salt/IV are already stored; rejected for v0.1 (D-01).
- **Import/ExportPanel UI** (Options → Advanced) — Phase 7 deliverable; Phase 2 ships core-only (D-19).
- **Telemetry DBs (AITransactionLogDB)** — Phase 6; Phase 2 wires the redaction hook they will consume, not the DBs (D-16).

None — discussion stayed within phase scope; all deferred items are tracked above.

</deferred>

---

*Phase: 2-Storage, Security, WriteJournal, Workspace Persistence*
*Context gathered: 2026-08-09*
