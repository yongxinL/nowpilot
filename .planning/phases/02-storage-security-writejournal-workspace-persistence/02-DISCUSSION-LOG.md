# Phase 2: Storage, Security, WriteJournal, Workspace Persistence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-09
**Phase:** 2-Storage, Security, WriteJournal, Workspace Persistence
**Areas discussed:** Vault security model (backup/restore survival, installSecret lifecycle, decrypt-failure posture) · Persistence concurrency (journal scope, election timing, workspace rewire) · STORAGE-02 mapping · KV schema versioning · Session-token shape · IndexedDB migration strategy & failure mode · chrome.storage.sync quota discipline · Redaction-before-persist wiring · Test-fixture strategy · Import/export contract

---

## Vault — Backup/Restore Survival

| Option | Description | Selected |
|--------|-------------|----------|
| Secrets never exported | No secret material in exports; re-enter keys after reinstall. Matches §15.2 + export-data contract | ✓ |
| Passphrase-wrapped portable vault | Re-wrap ciphertext under user passphrase for cross-install restore | |
| Export ciphertext as-is | Include encrypted apiKey as-is; only same-install restore works | |

**User's choice:** Secrets never exported.
**Notes:** No passphrase (new security surface, unjustified for BYO keys; addable v0.2 with no schema change since salt/IV stored). No ciphertext-as-is (worst of both). Required to complete: decrypt failure on old-install ciphertext is a FIRST-CLASS state (`PROVIDER_KEY_UNREADABLE` → "Key required — re-enter", enabled=false, treated as unconfigured, routes to onboarding "configure later" gate); never throw uncaught, never wipe np_providers. Fixtures (WR-13): round-trip under one secret; cross-install (encrypt A/decrypt B) asserts the "key required" state, not throw/garbage/wipe.

## Vault — installSecret Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Plaintext secret in storage | 32 random bytes base64 in np_install_secret (chrome.storage.local); at-rest obfuscation key, not a user secret | ✓ |
| Encrypt the install secret too | Protect under a derived user passphrase | |

**User's choice:** Plaintext installSecret in chrome.storage.local.
**Notes:** Generate exactly once on first init via crypto.getRandomValues(new Uint8Array(32)) → base64. Single-path race-safe generation (read-then-write-if-absent; "already present" authoritative). Immutable once set; never regenerate/overwrite. Missing-after-existing → same "key required — re-enter" state, do NOT silently regenerate. chrome.storage.local ONLY; never sync, never in exports. Security framing: at-rest obfuscation, install-bound, never leaves machine; protects against casual inspection, NOT a process with storage access. Fixtures: first-init generates+persists; second-init reuses; concurrent-init yields one stable secret; absent from sync + exports.

## Vault — Decrypt-Failure Posture

| Option | Description | Selected |
|--------|-------------|----------|
| Throw typed error, never wipe | VAULT_DECRYPT_FAILED caught by callers; value unreadable, never auto-wiped | ✓ (mechanism) |
| Define recovery UX for secret loss | Re-prompt path, no auto-wipe | ✓ (added) |

**User's choice:** Typed throw + explicit recovery UX, with a correction to installSecret-loss handling.
**Notes:** AES-GCM fails closed (authTag mismatch → throw); no separate corruption branch. CORRECTION: do NOT auto-regenerate installSecret on loss — generate only on true first-run (no secret AND no ciphertext). Missing secret + existing ciphertext → PROVIDER_KEY_UNREADABLE; re-entry re-establishes secret + fresh ciphertext. Wipe is USER-INITIATED only ("Remove provider"), never automatic. Unify three roads to unreadable (restore-new-install / secret-cleared / tampered ciphertext) onto ONE state + one code + one recovery path. Fixtures: wrong-secret decrypt asserts typed throw; missing-secret-with-ciphertext asserts "key required" (no regen, no wipe); first-run-no-ciphertext asserts normal generation; tampered authTag asserts typed throw.

## WriteJournal — Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Framework + workspace only | runJournaled/recoverJournal + wire only update-workspace | ✓ |
| All ops with live stores | Implement append-memory-message / save-note-with-links etc. now | |

**User's choice:** Framework + update-workspace only.
**Notes:** A journaled flow whose only caller is a test is not "proven" — real constraints arrive with Phase 3/5 stores. Lock FULL 11-value WriteJournalOperation union at type level now; other 10 ops declared-but-unwired. Idempotency key = workspaceId + version; recovery workspace-scoped (WR-10). Unknown-op replay = skip-and-log, never throw. Fixtures: crash after pending/before completed → replay exactly once; crash after completed → no-op; pending op for different workspaceId doesn't leak.

## WriteJournal — Election Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Defer election to Phase 3/5 | np_workspace_primary CAS + 3s heartbeat deferred; journal + LWW + WR-10 sufficient now | ✓ |
| Implement election now | Full primary-writer election now | |

**User's choice:** Defer election to Phase 3/5.

## WriteJournal — Workspace Rewire

| Option | Description | Selected |
|--------|-------------|----------|
| Route through journal | WorkspaceStore.update() via runJournaled update-workspace op | ✓ |
| Keep direct, journal later | Leave Phase 1 direct writeStorage | |

**User's choice:** Route through journal.
**Notes:** Without rewiring, journal has no live consumer and recovery is untestable.

## STORAGE-02 Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into Setting/EncryptedStorage | Setting.ts = per-key permissioned typed wrapper; EncryptedStorage = AES-GCM primitive; KeyVault = secret/state | ✓ |
| Separate StorageLayer/Session files | New files not in §18 create-list | |

**User's choice:** Fold into Setting/EncryptedStorage.

## KV Schema Versioning

| Option | Description | Selected |
|--------|-------------|----------|
| np_schema_version + migrate-on-read | Normalize old KV shapes via per-key sanitizers at init | ✓ |
| IndexedDB-only migrations | No KV version key | |

**User's choice:** np_schema_version + migrate-on-read.

## Session-Token Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Declare keys only, no accessors | np_jsessionid etc. declared in key registry; consumers arrive Phase 3/8 | ✓ |
| Full session accessors now | | |

**User's choice:** Declare keys only, no accessors.

## IndexedDB Migration — Degraded Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only + banner | IDB_MIGRATION_FAILED → ErrorStore + read-only affected DB + persistent UI banner | ✓ |
| Full block until manual recovery | | |
| In-memory fallback | Silent shadow-write → split-brain, rejected | |

**User's choice:** Read-only + banner.

## IndexedDB Migration — v1→v2 Fixture

| Option | Description | Selected |
|--------|-------------|----------|
| Synthetic v1→v2 fixture | Test-only v1 DB (DB_VERSION=1) → migrate adds store + index, data survives | ✓ |
| Real historical v1 shape | No real v1 exists | |

**User's choice:** Synthetic v1→v2 fixture.

## IndexedDB Migration — Framework Seeding

| Option | Description | Selected |
|--------|-------------|----------|
| Framework now, real migrations later | Migrator runner + interface + degraded mode + v1→v2 proof | ✓ |
| Interface only | No runner until first real migration | |

**User's choice:** Framework now, real migrations later.

## chrome.storage.sync Quota Discipline

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to local | Cosmetic sync keys (np_theme/np_theme_pack/np_language) → local shadow; sync-first reads; reconcile back | ✓ |
| Surface as error | | |

**User's choice:** Fall back to local.
**Notes:** debugLog SYNC_QUOTA_EXCEEDED (reusing THEME_STORAGE_UNAVAILABLE intent). Read precedence: sync-first then local; local shadow wins on read + triggers re-attempt to sync; on successful sync write delete the shadow. Catch both size and rate errors; small debounce on cosmetic writes. One-line APPR-03 reword: "sync is the CANONICAL/preferred store; local is a transient fallback shadow reconciled back when possible." Fixtures: sync throws → local write + code logged + read returns it; sync recovers → shadow promoted/cleared, no divergence; rapid toggles keep final value.

## Redaction-Before-Persist Wiring

| Option | Description | Selected |
|--------|-------------|----------|
| Wire hook in Phase 2 | Real redactSensitive + TraceRedactor body now; every write boundary routes through it | ✓ |
| Defer real redaction to Phase 6 | Stores born in Phase 2 leak until Phase 6 | |

**User's choice:** Wire hook in Phase 2.
**Notes:** Password-like values DROPPED not masked (fixture).

## Test-Fixture Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Named fixture module | tests/fixtures/ typed builders, deterministic, shared by unit + integration | ✓ |
| Inline per-test | Duplicates scenarios, WR-13 drift | |

**User's choice:** Named fixture module.
**Notes:** vault-roundtrip, cross-install, journal-recovery, migration, quota-shadow, redaction fixtures. Deterministic (seeded randomness, fixed IDs/timestamps). Typed, parameterized on edges. Edge/failure variants first-class. tests/ only, never imported from src/. WorkspacePersistence integration test imports the same builders.

## Import/Export — Export Shape

| Option | Description | Selected |
|--------|-------------|----------|
| JSON + ZIP, scoped groups | JSON canonical + ZIP (fflate); scopes: chat-history, notes, memory, workspace, settings; manifest | ✓ |
| JSON only | | |

**User's choice:** JSON + ZIP, scoped groups.

## Import/Export — Restore Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Merge/upsert, journaled | Per-group additive merge by id, existing wins + "restore overwrites" toggle; journaled full-vault restore | ✓ |
| Replace-on-import | Clear-then-load, destructive | |

**User's choice:** Merge/upsert, journaled.

## Import/Export — UI Surface

| Option | Description | Selected |
|--------|-------------|----------|
| Core-only, UI in Phase 7 | Module + tests; ImportExportPanel is Phase 7 | ✓ |
| Minimal UI now | | |

**User's choice:** Core-only, UI in Phase 7.

---

## the agent's Discretion

- RateLimiter / Requester internals (token-bucket params, timeout/retry defaults) — consumers arrive Phase 8.
- ErrorStore internal shape beyond FIFO max 100 + redaction requirement.
- IDB store keyPaths/indexes — follow §15.1 + Appendix C/§21 verbatim.
- WORKSPACE_UPDATED emission mechanics within journaled update-workspace (reuse WorkspaceSync).

## Deferred Ideas

- Primary-writer election (np_workspace_primary CAS + heartbeat) — Phase 3/5.
- Other WriteJournal ops (memory/note/evict/compact/restore) — declared-but-unwired, consumers Phase 3/5.
- Session-token accessors (ServiceNow) — Phase 8.
- Passphrase-wrapped portable vault — possible v0.2, no schema change.
- Import/ExportPanel UI — Phase 7.
- AITransactionLogDB telemetry — Phase 6 (Phase 2 wires the redaction hook it consumes).
