---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 05
subsystem: storage
tags: [chrome-storage, permission-table, serialized-writes, migrate-on-read, np_schema_version, session-keys]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: 02-01 canonical codes (STORE_READ/WRITE/SYNC), fakeBrowser harness, per-domain types precedent; 02-03 EncryptedStorage vault envelope shape
provides:
  - Setting.ts per-key permission table (STORAGE_KEY_REGISTRY: 16 keys → local/sync/session areas, encrypted + writeAllowed policy per §15.1)
  - Serialized write queue (promise-chain mutex) enforcing §13 "never two Setting<T> keys concurrently"
  - Encrypted-only contract on np_providers (raw values refused, vault envelope required — A-11/T-2-05-01)
  - runMigrateOnRead with np_schema_version stamping + DEFAULT_MIGRATE_SANITIZERS (generalized T-1-13: WorkspaceStore.sanitizeStored + AddonSettingsStore shape guard)
  - Declared-only session keys (np_jsessionid, np_sysparm_ck, np_token_ttl, np_active_stream, np_workspace_primary) — no accessors (D-11)
affects: [02-06 write-journal, 02-08 sync-shadow (ThemeStore rewire consumer), 02-11 verification wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise-chain mutex for serialized chrome.storage writes (§13 line 1791) — module-level writeChain, refusals resolve (never throw)"
    - "Per-key permission table (key → { area, encrypted?, writeAllowed }) as the single enforce-point for storage policy (D-09)"
    - "Migrate-on-read: np_schema_version + per-key sanitizer registry, additive/normalizing never destructive (D-10/A-12)"
    - "Declared-only keys via writeAllowed: false — no accessors shipped for future consumers (D-11)"

key-files:
  created:
    - src/core/storage/Setting.ts
    - tests/core/storage/Setting.test.ts
  modified:
    - src/core/registry/AddonSettingsStore.ts

key-decisions:
  - "Session keys declared with writeAllowed: false so the generic settingRead/settingWrite paths refuse them too — D-11 enforced mechanically, not just by convention (test 5)"
  - "np_providers value must already be the vault envelope (salt+iv+ciphertext shape check) — Setting never encrypts itself; encryption stays in EncryptedStorage (A-11)"
  - "np_theme/np_theme_pack/np_language registered as sync per §15.1; D-15 sync-shadow machinery deferred to 02-08 per plan"
  - "DEFAULT_MIGRATE_SANITIZERS reuses WorkspaceStore.sanitizeStored + AddonSettingsStore.sanitizeStored (exported) — one guard per inbound path, no duplicated shape logic"

requirements-completed: [STORAGE-02]

coverage:
  - id: D1
    description: "Setting.ts per-key permission table — 16 §15.1 keys mapped to local/sync/session with encrypted/writeAllowed policy; unknown keys refused, np_theme→sync, np_workspace→local routing"
    requirement: STORAGE-02
    verification:
      - kind: unit
        ref: "tests/core/storage/Setting.test.ts#refuses writes to an unknown key (writeAllowed false default) without throwing"
        status: pass
      - kind: unit
        ref: "tests/core/storage/Setting.test.ts#routes np_theme writes to the sync area and np_workspace writes to local"
        status: pass
    human_judgment: false
  - id: D2
    description: "Serialized write queue — two concurrent settingWrite calls never interleave; the second starts only after the first settles (promise-chain mutex)"
    requirement: STORAGE-02
    verification:
      - kind: unit
        ref: "tests/core/storage/Setting.test.ts#starts the second concurrent write only after the first settles (no interleaved set)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Encrypted-only contract — raw non-envelope np_providers write refused, envelope-shaped value passes (ciphertext-only, T-2-05-01)"
    requirement: STORAGE-02
    verification:
      - kind: unit
        ref: "tests/core/storage/Setting.test.ts#refuses a raw (non-envelope) np_providers write and passes an envelope-shaped value"
        status: pass
    human_judgment: false
  - id: D4
    description: "Migrate-on-read — old np_workspace shape normalized via per-key sanitizers, np_schema_version stamped; fresh install is a no-op that sets the version"
    requirement: STORAGE-02
    verification:
      - kind: unit
        ref: "tests/core/storage/Setting.test.ts#normalizes an old np_workspace shape to the current shape and stamps the schema version"
        status: pass
      - kind: unit
        ref: "tests/core/storage/Setting.test.ts#is a no-op on a fresh install except stamping the schema version"
        status: pass
    human_judgment: false
  - id: D5
    description: "Session keys declared-only — five session keys in the registry, no exported accessor names reference them, generic read/write paths refuse them (D-11)"
    requirement: STORAGE-02
    verification:
      - kind: unit
        ref: "tests/core/storage/Setting.test.ts#declares the five session keys in the registry with no accessor functions"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-08-09
status: complete
---

# Phase 2 Plan 5: Setting Layer Summary

**Per-key permissioned chrome.storage wrapper with a 16-key permission table, promise-chain-mutex serialized writes, an encrypted-only contract on np_providers, and np_schema_version migrate-on-read — session tokens declared-only with no accessors (D-09/D-10/D-11)**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-09T04:10:14Z
- **Completed:** 2026-08-09T04:19:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `STORAGE_KEY_REGISTRY` — the D-09 per-key permission table mapping all 16 §15.1 keys Phase 2 touches: 8 local (np_providers encrypted: true, np_install_secret, np_workspace, np_addon_settings, np_flags, np_persona, np_schema_version, np_debug_mode), 3 sync (np_theme/np_theme_pack/np_language), 5 session declared-only (writeAllowed: false)
- `settingWrite`/`settingRead` — permission-checked paths: unknown keys refused with STORE_WRITE/STORE_READ logs, declared-only keys refused, raw values to encrypted keys refused; every write chained on a module-level promise-chain mutex so no two Setting<T> writes ever run concurrently (§13 line 1791, T-2-05-02)
- Encrypted-only contract (A-11, T-2-05-01) — np_providers accepts only a salt+iv+ciphertext vault envelope; a raw `{ apiKey }` write is refused at the Setting boundary, so a secret can never bypass encryption
- `runMigrateOnRead` + `DEFAULT_MIGRATE_SANITIZERS` (D-10) — np_schema_version stamping and the generalized T-1-13 sanitizer pattern: np_workspace reuses WorkspaceStore.sanitizeStored, np_addon_settings reuses AddonSettingsStore's shape guard, np_providers gets a light envelope guard (ProviderConfig shape lands Phase 3); old shapes normalized, never destructively wiped (A-12)
- D-11 session keys declared-only — the five session tokens are in the registry but neither generic read nor write reaches them; consumers arrive Phase 3/8
- TDD discipline: RED test commit (7 cases) → GREEN implementation commit, full suite 201/201 green

## Task Commits

Each task was committed atomically (TDD RED → GREEN order):

1. **Task 2: Setting.test.ts — permission table, serialization, migrate-on-read** - `5b0c637` (test, RED gate)
2. **Task 1: Setting.ts — permission table + serialized writes + migrate-on-read** - `12f81fe` (feat, GREEN gate)

**Plan metadata:** pending (docs commit after SUMMARY)

_Note: TDD discipline inverts task order — the test file (Task 2) was authored first as the RED gate, then the implementation (Task 1) as GREEN._

## Files Created/Modified

- `src/core/storage/Setting.ts` - Created. D-09 per-key permissioned wrapper: StorageArea/KeyPermission types, STORAGE_KEY_REGISTRY (16 keys), settingWrite/settingRead, NP_SCHEMA_VERSION_KEY/CURRENT_SCHEMA_VERSION, DEFAULT_MIGRATE_SANITIZERS, runMigrateOnRead
- `tests/core/storage/Setting.test.ts` - Created. 7 tests across 5 case groups (permission enforcement, serialized writes, encrypted-only, migrate-on-read, session declared-only)
- `src/core/registry/AddonSettingsStore.ts` - Modified. Exported the existing `sanitizeStored` shape guard (was module-private) so Setting.ts reuses it as the np_addon_settings migrate-on-read sanitizer — the plan's "import existing sanitizers" instruction required it

## Decisions Made

- **Session keys gated at both paths:** writeAllowed: false on all five session keys makes settingRead AND settingWrite refuse them — D-11 is enforced mechanically rather than relying on "no one calls it". When Phase 3/8 consumers arrive they flip the flag deliberately.
- **np_providers envelope shape check:** a structural `'salt' in v && 'iv' in v && 'ciphertext' in v` guard is the encrypted-only enforce-point — Setting never encrypts/decrypts (that stays in EncryptedStorage/KeyVault), it only refuses non-envelope values.
- **AddonSettingsStore.sanitizeStored export:** the plan instructs importing AddonSettingsStore's shape guard, which was module-private. Exported it (no behavior change) so migrate-on-read reuses the exact same guard every inbound path already uses.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Exported AddonSettingsStore.sanitizeStored to satisfy the plan's import-existing-sanitizers instruction**
- **Found during:** Task 1 (Setting.ts migrate-on-read registration)
- **Issue:** The plan's Task 1 action says "Register the np_workspace/np_providers/np_addon_settings sanitizers by importing their existing sanitizers (WorkspaceStore.sanitizeStored + AddonSettingsStore's shape guard)" — but AddonSettingsStore's `sanitizeStored` was module-private and could not be imported.
- **Fix:** Added `export` to the existing function (one-token change, no behavior change); Setting.ts imports it aliased as `sanitizeAddonSettingsStored`.
- **Files modified:** src/core/registry/AddonSettingsStore.ts
- **Verification:** `pnpm typecheck` clean; AddonSettingsStore's own suite still green (40/40 registry+theme tests); full suite 201/201
- **Committed in:** `12f81fe` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minimal enabling change required by the plan's own instruction; no scope creep, no behavior change to AddonSettingsStore.

## Issues Encountered

- **Pre-existing EncryptedStorage.test.ts LSP type diagnostics:** `Uint8Array<ArrayBufferLike>` vs `Uint8Array<ArrayBuffer>` errors surfaced in the editor but are from 02-03's test file and unrelated to this plan's changes; `pnpm typecheck` passes clean. Out of scope per scope-boundary rule — noted, not fixed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 02-06 (WriteJournal) and 02-08 (sync-shadow):** 02-08's ThemeStore rewire will route np_theme/np_theme_pack writes through `settingWrite` (sync area already registered); 02-06's journaled np_workspace write can reuse the same serialized path
- **02-11 wiring:** entrypoints call `runMigrateOnRead(DEFAULT_MIGRATE_SANITIZERS)` at surface init — the function and default sanitizer set are exported and ready
- **No blockers** — all acceptance criteria met: every grep fixture passes, typecheck clean, eslint/prettier clean, full suite 201/201

---
*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-09*

## Self-Check: PASSED

- Created files verified on disk: `src/core/storage/Setting.ts`, `tests/core/storage/Setting.test.ts`, `02-05-SUMMARY.md`
- Commits verified in git log: `5b0c637` (Task 2 RED test), `12f81fe` (Task 1 GREEN feat) — TDD gate order test→feat confirmed
- Plan verification: `pnpm vitest run tests/core/storage/Setting.test.ts` 7/7 green; `pnpm vitest run tests/core/registry tests/core/theme` 40/40 green; `pnpm typecheck` clean; eslint clean; prettier clean; full suite 201/201 green
- Acceptance criteria: all Task 1 greps pass (STORAGE_KEY_REGISTRY=3, np_schema_version=5, CURRENT_SCHEMA_VERSION=4, session-keys=7, settingWrite/Read=3, StorageLayer/StorageSession=0); all Task 2 greps pass (runMigrateOnRead=4, np_theme=4)

