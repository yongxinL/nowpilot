---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 03
subsystem: security
tags: [vault, aes-gcm, pbkdf2, crypto-subtle, keyvault, install-secret, encrypted-storage, storage-03]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: 02-01 storage foundation — vault-roundtrip + cross-install fixture builders, VAULT_DECRYPT_FAILED/PROVIDER_KEY_UNREADABLE error codes, fake-indexeddb harness, fakeBrowser runtime.id determinism
provides:
  - EncryptedStorage (src/core/storage/EncryptedStorage.ts): AES-GCM-256 at-rest vault primitive — VaultEnvelope {salt 16B, iv 12B, ciphertext}, PBKDF2_ITERATIONS=100_000, deriveKey/encrypt/decrypt, typed VAULT_DECRYPT_FAILED (D-03), createVaultDecryptFailedError factory + isVaultDecryptFailed guard
  - KeyVault (src/core/security/KeyVault.ts): installSecret lifecycle (np_install_secret, read-then-write-if-absent, immutable once set — D-02) + PROVIDER_KEY_UNREADABLE state machine converging all three unreadable roads on ONE shared state (D-04); encryptSecret/decryptSecret convenience wrappers; user-initiated wipeProviderKey only
  - 9 unit tests (EncryptedStorage 3 + KeyVault 6) proving §15.2 derivation roundtrip, fail-closed typed decrypt, cross-install no-wipe, three-roads convergence, and no-auto-regenerate — all via the shared 02-01 fixture builders (D-21)
affects: [02-04 WriteJournalDB, 02-05 keyvault/provider wiring, 02-09 import/export (np_install_secret + ciphertext exclusion), 02-11 verification (R-3 isolation check), ProviderRegistry onboarding 'configure later' gate]

# Tech tracking
tech-stack:
  added: [] # no new dependencies — crypto.subtle (WebCrypto, platform) only, per §15.2
  patterns:
    - "Lazy singleton + listener Set (ProviderRegistry shape) for the vault state machine — getKeyVault()/KeyVault class, per-instance state, subscribe returns unsubscribe"
    - "Read-then-write-if-absent race-safe installSecret (D-02): re-read immediately before set — 'already present' is authoritative; non-generating readInstallSecretOnly for decrypt paths (D-04 no auto-regenerate)"
    - "Typed decrypt failure (D-03): Error.code = ERROR_CODES.VAULT_DECRYPT_FAILED + isVaultDecryptFailed narrowing guard — callers match the code, never a free-form message; no corruption branch"
    - "Uint8Array<ArrayBuffer> annotations at WebCrypto boundaries — TS 5.9 lib.dom BufferSource requires ArrayBuffer-backed views"

key-files:
  created:
    - src/core/storage/EncryptedStorage.ts
    - src/core/security/KeyVault.ts
    - tests/core/storage/EncryptedStorage.test.ts
    - tests/core/security/KeyVault.test.ts
  modified:
    - tests/fixtures/index.ts

key-decisions:
  - "encrypt() carries a 3rd salt param — the §15.2 envelope MUST carry the salt the key was derived with so a later decrypt re-derives the identical key; KeyVault owns per-key salt generation (plan's artifact-table shorthand lacked it; plan Task 1 text itself says 'salt+IV are passed in')"
  - "decryptSecret converts VAULT_DECRYPT_FAILED into PROVIDER_KEY_UNREADABLE AND rethrows the typed error — state drives UI routing while the throw keeps the read failure observable to callers"
  - "Reason field is diagnostics-only: roads (a) restore-on-new-install and (c) tampered-ciphertext are cryptographically indistinguishable (D-03), so decryptSecret assigns 'tampered-ciphertext'; the provider layer sets 'restore-on-new-install' explicitly via the public setProviderKeyUnreadable"
  - "No in-memory secret cache — chrome.storage.local is authoritative every call (write-if-absent race safety, cross-context convergence)"
  - "STORE_WRITE is the catch code for storage-write failures (Phase-1 write-through adapter precedent); decrypt flows log PROVIDER_KEY_UNREADABLE per the plan"

patterns-established:
  - "Pattern 1: single typed error object with a code property + narrowing guard — the D-03 'no corruption branch' contract as testable API"
  - "Pattern 2: read-then-write-if-absent as an explicit two-read sequence — race-safe generation that never clobbers a concurrent writer"
  - "Pattern 3: state machine with public setter + subscribe/notify (listener try/catch debugLog EVT_HANDLER) — synchronous state over async crypto"

requirements-completed: [STORAGE-03]

coverage:
  - id: D1
    description: "EncryptedStorage AES-GCM-256 primitive — §15.2 derivation (PBKDF2(installSecret+extensionId, salt, 100000, SHA-256) → AES-GCM-256), VaultEnvelope {salt 16B, iv 12B, ciphertext}, typed VAULT_DECRYPT_FAILED on any decrypt failure (D-03, fail closed, no corruption branch)"
    requirement: STORAGE-03
    verification:
      - kind: unit
        ref: "tests/core/storage/EncryptedStorage.test.ts#derives the §15.2 key and round-trips the fixture plaintext under one installSecret"
        status: pass
      - kind: unit
        ref: "tests/core/storage/EncryptedStorage.test.ts#rejects decrypt with a WRONG derived key using the typed VAULT_DECRYPT_FAILED code"
        status: pass
      - kind: unit
        ref: "tests/core/storage/EncryptedStorage.test.ts#rejects a tampered ciphertext byte with the SAME typed code"
        status: pass
    human_judgment: false
  - id: D2
    description: "KeyVault installSecret lifecycle (read-then-write-if-absent into chrome.storage.local np_install_secret, immutable once set — D-02) + PROVIDER_KEY_UNREADABLE state machine converging all three unreadable roads on ONE shared state with no auto-wipe and no auto-regenerate (D-04); user-initiated wipeProviderKey is the only deletion path"
    requirement: STORAGE-03
    verification:
      - kind: unit
        ref: "tests/core/security/KeyVault.test.ts#generates np_install_secret once, persists it to chrome.storage.local, and never regenerates"
        status: pass
      - kind: unit
        ref: "tests/core/security/KeyVault.test.ts#cross-install: encrypt with secret A, decrypt with secret B → PROVIDER_KEY_UNREADABLE, ciphertext NOT wiped"
        status: pass
      - kind: unit
        ref: "tests/core/security/KeyVault.test.ts#tampered ciphertext (road c) and installSecret-cleared (road b) both converge on PROVIDER_KEY_UNREADABLE"
        status: pass
      - kind: unit
        ref: "tests/core/security/KeyVault.test.ts#wipeProviderKey removes the ciphertext — no decrypt-failure path deletes it"
        status: pass
    human_judgment: false
  - id: D3
    description: "Vault-roundtrip + cross-install fixture scenarios proven via the shared 02-01 builders (D-20/21) — deterministic under fakeBrowser runtime.id 'test-extension-id' (RESEARCH Pattern 3); both test files import tests/fixtures"
    requirement: STORAGE-03
    verification:
      - kind: unit
        ref: "pnpm vitest run tests/core/storage/EncryptedStorage.test.ts tests/core/security/KeyVault.test.ts — 9/9 pass; full suite 194/194 green"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-08-09
status: complete
---

# Phase 2 Plan 3: AES-GCM At-Rest Vault Summary

**The AES-GCM-256 at-rest vault ships (STORAGE-03): EncryptedStorage as the §15.2 crypto primitive (PBKDF2 100k SHA-256 → AES-GCM-256, per-key 16-byte salt + 12-byte IV envelope, single typed VAULT_DECRYPT_FAILED on any decrypt failure) and KeyVault as the installSecret lifecycle (np_install_secret generated once via read-then-write-if-absent, immutable) plus the PROVIDER_KEY_UNREADABLE state machine that converges all three unreadable roads (restore-on-new-install / installSecret-cleared / tampered ciphertext) on ONE shared state with no auto-wipe and no auto-regenerate — proven by 9 tests built on the shared 02-01 vault-roundtrip and cross-install fixtures**

## Performance

- **Duration:** 10 min
- **Started:** 2026-08-09T03:42:40Z
- **Completed:** 2026-08-09T03:52:42Z
- **Tasks:** 3
- **Files modified:** 5 (1 modified, 4 created) + this SUMMARY

## Accomplishments

- **EncryptedStorage.ts (Task 1):** the AES-GCM primitive per §15.2 verbatim — `deriveKey(installSecret, extensionId, salt)` imports the raw PBKDF2 base key and derives AES-GCM-256 with `PBKDF2_ITERATIONS = 100_000`/SHA-256; `encrypt` generates a fresh 12-byte IV per call and returns the `{salt, iv, ciphertext}` envelope; `decrypt` throws the typed `VAULT_DECRYPT_FAILED` (Error.code) on auth-tag mismatch or malformed envelope — one code, no corruption branch (D-03). Header comment pins the §15.2 derivation scheme and the "NEVER derive from navigator.userAgent" invariant; framed as at-rest obfuscation, install-bound, never exported (D-01/D-02).
- **KeyVault.ts (Task 2):** installSecret lifecycle — `getInstallSecret()` reads chrome.storage.local[np_install_secret] and, if absent, generates 32 random bytes (base64) and writes it via an explicit read-then-write-if-absent re-read so a concurrent context's value always wins (D-02 race-safety; immutable once set, never regenerated). `decryptSecret()` uses a NON-generating secret read, so a cleared installSecret converges on `PROVIDER_KEY_UNREADABLE` instead of auto-regenerating (D-04). `setProviderKeyUnreadable(reason)` + `getProviderKeyState()` + `subscribe()` form the ProviderRegistry-shaped state machine with a diagnostics reason field; `wipeProviderKey()` is the ONLY deletion path (user-initiated, future 'Remove provider' action). Every catch calls debugLog (Golden Rule 9).
- **Tests (Task 3):** 9 tests across the two files — §15.2 derivation + roundtrip under one installSecret, wrong-key decrypt → typed code, tampered-byte decrypt → same typed code, installSecret immutable-once-set + persisted, cross-install (encrypt A / decrypt B) → PROVIDER_KEY_UNREADABLE with ciphertext STILL PRESENT (no wipe), roads (b)/(c) converging on the one state value, no-auto-regenerate on cleared secret, wipeProviderKey as the sole deletion path, singleton identity + subscribe/notify. All built on the shared 02-01 fixture builders (D-21); deterministic via fakeBrowser's 'test-extension-id'.
- **Full suite green:** 194 tests (185 baseline + 9 new); typecheck, eslint, and prettier clean. Only `np_install_secret` is written to chrome.storage.local by this plan's code (ciphertext + installSecret are the only np_* values; verified by grep).

## Task Commits

Each task was committed atomically:

1. **Task 1: EncryptedStorage.ts — AES-GCM-256 primitive with envelope** - `db641ec` (feat)
2. **Task 2: KeyVault.ts — installSecret lifecycle + PROVIDER_KEY_UNREADABLE state machine** - `bec8a93` (feat)
3. **Task 3: EncryptedStorage.test.ts + KeyVault.test.ts — vault-roundtrip and cross-install fixtures** - `3de4456` (test)

## Files Created/Modified

- `src/core/storage/EncryptedStorage.ts` - Created. `VaultEnvelope`, `PBKDF2_ITERATIONS = 100_000`, `deriveKey`/`encrypt`/`decrypt`, `VaultDecryptFailedError` + `isVaultDecryptFailed` + `createVaultDecryptFailedError`; §15.2 verbatim derivation, typed D-03 failure, userAgent-ban header comment
- `src/core/security/KeyVault.ts` - Created. `NP_INSTALL_SECRET_KEY`, `KeyVault` class (getInstallSecret / getDerivedKey / encryptSecret / decryptSecret / getProviderKeyState / getProviderKeyUnreadableReason / subscribe / setProviderKeyUnreadable / wipeProviderKey), `getKeyVault()` lazy singleton, `PROVIDER_KEY_STATE` + `ProviderKeyUnreadableReason` types
- `tests/core/storage/EncryptedStorage.test.ts` - Created. 3 tests: roundtrip, wrong-key typed reject, tampered-byte typed reject
- `tests/core/security/KeyVault.test.ts` - Created. 6 tests: immutable-once-set, cross-install no-wipe, roads b/c convergence + no-auto-regenerate, wipe-only deletion, singleton identity, subscribe/notify
- `tests/fixtures/index.ts` - Modified. salt/iv/ciphertext annotations widened to `Uint8Array<ArrayBuffer>` (type-only — WebCrypto `BufferSource` compatibility under TS 5.9 lib.dom; runtime values identical, determinism smoke test still green)

## Decisions Made

- **Salt flows through encrypt():** the §15.2 envelope must carry the exact salt the key was derived with, so `encrypt(derivedKey, plaintext, salt)` takes it as a 3rd parameter; KeyVault's `encryptSecret` generates the per-key 16-byte salt and passes it through. The plan's artifact-table signature `encrypt(derivedKey, plaintext)` was incomplete shorthand — its own Task 1 note says "the salt+IV are passed in (KeyVault owns per-key storage)".
- **Convert AND rethrow:** `decryptSecret` sets `PROVIDER_KEY_UNREADABLE` on any decrypt failure and rethrows the typed `VAULT_DECRYPT_FAILED` — the state drives the 'Key required — re-enter' UI routing while the throw keeps the read failure observable to callers (tests assert `rejects.toMatchObject({ code })` plus the state).
- **Reasons are diagnostics:** roads (a) and (c) are cryptographically indistinguishable (D-03) — `decryptSecret` assigns `'tampered-ciphertext'` on auth failures and `'install-secret-cleared'` on a missing secret; `'restore-on-new-install'` is available to the provider layer via the public `setProviderKeyUnreadable` when it detects a restored vault.
- **Storage-authoritative secret:** no in-memory cache of np_install_secret — every call reads chrome.storage.local, so cross-context races and cross-install restore converge on the same observable behavior (T-2-03-05: no per-context divergent state).
- **KeyVault is a class + lazy singleton** (ProviderRegistry shape) with per-instance state; tests construct fresh instances for isolation, and the singleton's own identity/subscribe behavior is tested without mutating shared state.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Type] Fixture byte types widened to Uint8Array<ArrayBuffer>**
- **Found during:** Task 3 (test authoring)
- **Issue:** The 02-01 fixture builders declare salt/iv/ciphertext as bare `Uint8Array`, which TS 5.9 lib.dom types as `Uint8Array<ArrayBufferLike>` — not assignable to WebCrypto's `BufferSource` (needs `ArrayBufferView<ArrayBuffer>`), so `deriveKey(fixture.salt)` would not compile
- **Fix:** Changed the annotations in tests/fixtures/index.ts (`fixedSalt`/`fixedIv` return types + `VaultRoundtripFixture`/`CrossInstallEnvelope` field types) to `Uint8Array<ArrayBuffer>` — type-only, runtime values byte-identical; the 02-01 fixtures determinism smoke test still passes 8/8
- **Files modified:** tests/fixtures/index.ts
- **Verification:** `pnpm typecheck` clean; `pnpm vitest run tests/fixtures/fixtures.test.ts` 8/8 green; full suite 194/194
- **Committed in:** `3de4456` (Task 3 commit)

**2. [Rule 1 - Missing Critical Parameter] encrypt() takes the derivation salt**
- **Found during:** Task 1 (implementation)
- **Issue:** The plan's `encrypt(derivedKey, plaintext)` signature cannot produce a correct §15.2 envelope — the envelope must carry the salt the key was derived with, or a later `decryptSecret` re-derives a different key and every read fails
- **Fix:** Added the `salt: Uint8Array<ArrayBuffer>` 3rd parameter; KeyVault's `encryptSecret` generates the per-key salt and passes it through. Consistent with the plan's own note ("the salt+IV are passed in — KeyVault owns per-key storage")
- **Files modified:** src/core/storage/EncryptedStorage.ts
- **Verification:** roundtrip + wrong-key + tampered tests pass (9/9); typecheck clean
- **Committed in:** `db641ec` (Task 1 commit)

**3. [Rule 1 - API Completion] createVaultDecryptFailedError factory exported**
- **Found during:** Task 2 (KeyVault implementation)
- **Issue:** KeyVault's road-(b) path (installSecret missing) must throw the same typed D-03 code so callers see one failure shape, but the error factory was module-private in EncryptedStorage
- **Fix:** Exported `createVaultDecryptFailedError()` (renamed from the private `vaultDecryptFailed`) — small additive export, no behavior change to the primitive
- **Files modified:** src/core/storage/EncryptedStorage.ts
- **Verification:** road-(b) test asserts the typed code; typecheck/eslint/prettier clean
- **Committed in:** `bec8a93` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (1 type, 1 missing critical parameter, 1 API completion)
**Impact on plan:** All three are correctness requirements — without them the envelope could not re-derive keys (salt), WebCrypto calls would not compile (types), and road-(b) callers would see an untyped throw. No scope creep; the state machine, wipe-only guarantee, and three-roads convergence all follow the plan exactly.

## Issues Encountered

- **Scratch-file write failed** (`/tmp/opencode` disk-quota exceeded — same shared tmpfs issue 02-01 hit): a scratch probe test file could not be written to /tmp/opencode; worked around by writing the probe into the workspace tree, running it, and deleting it. Non-blocking; working-tree and /home disk unaffected.
- **Stale LSP diagnostics** after the fixture type edit: the language server reported errors in EncryptedStorage.test.ts that a fresh `pnpm typecheck` proved resolved (tsc exited 0). No code impact.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **The vault is install-bound and test-proven:** `np_install_secret` lifecycle (D-02), PROVIDER_KEY_UNREADABLE convergence (D-04), and the no-wipe/no-regenerate guarantees are locked by 9 tests; later plans can import `getKeyVault()`/`VaultEnvelope` and the `PROVIDER_KEY_STATE` vocabulary without re-deriving them.
- **Ready for 02-04+:** WriteJournalDB persist, provider wiring (02-05), import/export exclusion (02-09 — np_install_secret + np_providers ciphertext never exported, D-01), and the 02-11 R-3 isolation check (background SW must not import KeyVault/EncryptedStorage) all consume or guard this plan's surface.
- **No blockers.** Full suite 194/194 green; typecheck/eslint/prettier clean.

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-09*

## Self-Check: PASSED

- Created/modified files verified on disk: `src/core/storage/EncryptedStorage.ts`, `src/core/security/KeyVault.ts`, `tests/core/storage/EncryptedStorage.test.ts`, `tests/core/security/KeyVault.test.ts`, `tests/fixtures/index.ts`, `02-03-SUMMARY.md`
- Commits verified in git log: `db641ec` (Task 1), `bec8a93` (Task 2), `3de4456` (Task 3)
- Full verification: `pnpm typecheck` clean (exit 0), eslint clean, prettier clean, vault suite 9/9 green, fixtures determinism 8/8 green, full vitest suite 194/194 green
- No plaintext secret written to chrome.storage.local by this plan's code (grep: only np_install_secret is written; only wipeProviderKey removes)
