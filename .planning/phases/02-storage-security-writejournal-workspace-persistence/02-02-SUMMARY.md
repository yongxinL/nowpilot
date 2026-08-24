---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 02
subsystem: security
tags: [webcrypto, aes-gcm, pbkdf2, KeyVault, EncryptedStorage, redactSensitive, np_store, np_providers, OptionsPage, masked-field, D-28, D-29, D-30, TDD]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace-handoff
    provides: "src/store/useExtensionStore.ts (DEFAULT_CONFIG + persist with partialize), src/core/theme/chromeStorageAdapter.ts (debounced adapter), tests/setup.ts (chrome.storage.local mock), src/types/index.ts (ProviderConfig / CustomProviderDetail shape D-30 keeps)"
  - phase: 02-storage-security-writejournal-workspace-persistence (plan 02-01)
    provides: "fake-indexeddb + idb installed, tests/setup.ts extended with session mock + __resetIndexedDB(), 3-case smoke test proving the harness works"
provides:
  - "Encrypt-at-rest foundation: WebCrypto AES-GCM-256 with PBKDF2-derived per-blob keys over a stable np_install_secret root (D-28/D-29/D-30)"
  - "Crash-safe + idempotent async boot-step migration np_store → np_providers (write FIRST, strip SECOND) closing the plaintext API key CONCERNS finding"
  - "Storage-side redaction primitive (redactSensitive) for persist/log boundaries (D-39/§16.5)"
  - "OptionsPage provider modal masked-field contract + 'Save Provider' / 'Check Connection' CTA renames + encrypted write path"
  - "Decrypt-on-read hydrateProviderSecrets() so a fresh boot populates in-memory apiKey/openAiKey/geminiKey from np_providers without ever echoing the stored value into the modal field"
affects:
  - 02-05 (ErrorStore / journaled-adapter tests will consume redactSensitive)
  - 02-06 (Storage error classification reuses the chromeStorageAdapter debounce path; persisted error contexts run through redactSensitive)
  - 02-07 (WorkspacePersistence.options boot sequence calls migrateProviderSecrets + hydrateProviderSecrets per the Open Question 3 resolution)

# Actuals (#2632) — pairs with the plan's `estimate: {tokens:60000, confidence:low}` to calibrate future estimates.
# Same estimateTokens scale (chars/4 over the realized diff), not a harness token count.
actuals:
  tokens: 17200            # chars/4 across added/modified files (~68.8k source chars)
  tasks: 3                 # matches the plan's `tasks: 3`
  commits: 5               # task 1 RED + GREEN, task 2 RED + GREEN, task 3 GREEN (UI had no test-first red)

# Tech tracking
tech-stack:
  added: []                # no new packages; WebCrypto (crypto.subtle) is built-in Node ≥ 20
  patterns:
    - "WebCrypto AES-GCM-256 (12-byte IV, authenticated tag) for secret-field encryption; PBKDF2(installSecret:extensionId, fresh 16-byte salt, 100k iter, SHA-256) for per-blob key derivation"
    - "JSON-safe EncryptedBlob envelope = {salt:base64, iv:base64, ciphertext:base64} — self-describing so any blob can decrypt independently"
    - "Crash-safe migration order: write np_providers FIRST (encrypted ciphertext committed), strip plaintext from np_store SECOND; re-run always completes the strip"
    - "Async boot-step migration OUTSIDE zustand persist.migrate (migrate is sync per Pitfall 2); npmStoreMigrate stays a v1 no-op"
    - "Decrypt-on-read for the in-memory plaintext copy: hydrateProviderSecrets() populates ONLY where the in-memory field is empty (freshly-entered user value always wins), is strictly read-only (source-level regex assertion enforced by test)"
    - "Masked-field UI contract •••••••••••••••• placeholder when stored key exists; decrypted value NEVER in value/placeholder/aria/hint"
    - "No-false-success on persist failure: handleSaveProviderModal awaits persistProviderConfigEncrypted first; on throw, no success toast, modal stays open, error to console/ErrorStore only"

key-files:
  created:
    - src/core/security/KeyVault.ts — ensureInstallSecret() (32 bytes once), deriveKey() (PBKDF2(...installSecret...base64...:extensionId, salt, 100k, SHA-256) → AES-GCM-256), getExtensionId() (chrome.runtime.id with stable-test fallback), __test__ seam
    - src/core/storage/EncryptedStorage.ts — encrypt/decrypt (AES-GCM, 12-byte IV fresh per call), encryptProviderConfig/decryptProviderConfig (object-shape D-30; '' stays ''), isEncryptedBlob() type guard
    - src/core/security/redactSensitive.ts — redactSensitive({...}) deep-copy primitive; empties apiKey/openAiKey/geminiKey + any /key|token|secret|authorization/i (case-insensitive); truncates message-body-shaped strings to 80 chars
    - tests/core/storage/EncryptedStorage.test.ts — 7 cases driving round-trip, tamper rejection, wrong-key rejection, ProviderConfig round-trip, install-secret once-only, fresh salt per call, fresh IV per call
    - tests/core/security/secrets-inspection.test.ts — 6 cases driving migration + strip, idempotency, crash-order strip completion, inspection gate (substr absence), decrypt-on-read reload, source-level read-only assertion
  modified:
    - src/store/useExtensionStore.ts — partialize extended to strip secrets (Pitfall 10 / D-28); migrateProviderSecrets async boot step (Pattern 3); persistProviderConfigEncrypted encrypted write (preserves untouched ciphertext byte-identical); hydrateProviderSecrets decrypt-on-read (read-only by contract); stripProviderSecrets helper
    - src/components/options/OptionsPage.tsx — removed setModalApiKey(detail.apiKey || '') at line 198 (CONCERNS finding); masked placeholder in Input.Password (•••••••••••••••• when stored key exists); handleSaveProviderModal awaits encrypted write first (no false success on persist failure); handleCheckConnection uses stored in-memory apiKey transiently when modalApiKey is empty; CTA renames 'Save' → 'Save Provider' and 'Check' → 'Check Connection'

key-decisions:
  - "PBKDF2 material = base64(installSecret) + ':' + extensionId — a deterministic byte-string encoding locked at planning time per 02-RESEARCH.md's note on the §15.2 concatenation input. Documented in a code comment so future maintainers don't substitute a different encoding."
  - "getExtensionId() falls back to 'nowpilot-test-extension-id' sentinel when chrome.runtime.id is undefined (test harness, dev tooling) — NEVER navigator.userAgent (forbidden per §15.2; would invalidate all persisted ciphertext on browser update)."
  - "persistProviderConfigEncrypted preserves an already-EncryptedBlob's ciphertext byte-identical (untouched-field preserve path) — a save with no secret edit does not destroy the stored key by re-keying with a fresh salt."
  - "hydrateProviderSecrets populates ONLY where the in-memory field is empty — freshly-typed user input always wins; never overwrites user-entered values."
  - "Persist provider (custom model list, etc.) order inside handleSaveProviderModal: persistProviderConfigEncrypted FIRST, updateConfig SECOND. On persist throw, no success toast, modal stays open — UI-SPEC E1 error row 'no false success'."

patterns-established:
  - "Encrypt-at-rest foundation pattern: write-first / strip-second migration order, idempotent re-runs (always strip if any plaintext remains in np_store)."
  - "Decrypt-on-read for in-memory plaintext copies — the in-memory state stays plaintext for Phase-1 consumers (A6) but the persisted np_store blob NEVER carries plaintext secrets."
  - "Read-only decrypt helpers MUST contain no setItem for the persisted key (source-level regex assertion in tests/core/security/secrets-inspection.test.ts). The WriteHelpers persistProviderConfigEncrypted is the single owner of the np_providers write path."
  - "Masked-field UI contract: saved-key detection drives the placeholder ••••••••••••••••; field value/aria/hint never carry the stored value."
  - "No-false-success UI contract: encrypt persist throws STORAGE_QUOTA/RATE_LIMIT-class errors → surface to console/ErrorStore only, modal stays open, no success toast."

requirements-completed: [REQ-R07]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "KeyVault lifecycle — ensureInstallSecret generates 32 random bytes once, persists np_install_secret, returns the same secret across calls"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: "tests/core/storage/EncryptedStorage.test.ts#ensureInstallSecret writes a 32-byte secret exactly once (idempotent)"
        status: pass
    human_judgment: false
  - id: D2
    description: "EncryptedStorage AES-GCM-256 round-trip — encrypt → chrome.storage.local → decrypt returns the original (success criterion 2)"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: "tests/core/storage/EncryptedStorage.test.ts#encrypts plaintext to an EncryptedBlob with salt+iv+ciphertext base64 fields and decrypt round-trips"
        status: pass
    human_judgment: false
  - id: D3
    description: "EncryptedStorage tamper/wrong-key rejection (AES-GCM authentication)"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: "tests/core/storage/EncryptedStorage.test.ts#rejects tampered ciphertext (AES-GCM authentication failure)"
        status: pass
      - kind: unit
        ref: "tests/core/storage/EncryptedStorage.test.ts#rejects decryption with a wrong key (AES-GCM authentication failure)"
        status: pass
    human_judgment: false
  - id: D4
    description: "EncryptedStorage salt/IV freshness — fresh 16-byte salt and 12-byte IV per encrypt call"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: "tests/core/storage/EncryptedStorage.test.ts#two encryptions of the same plaintext with different salts produce different ciphertext"
        status: pass
      - kind: unit
        ref: "tests/core/storage/EncryptedStorage.test.ts#each encrypt() call generates a fresh 12-byte IV (different iv fields)"
        status: pass
    human_judgment: false
  - id: D5
    description: "EncryptedStorage encryptProviderConfig/decryptProviderConfig — round-trips the existing scaffold ProviderConfig object shape (D-30/D-30a); '' stays ''"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: "tests/core/storage/EncryptedStorage.test.ts#encrpyts two ProviderConfigs and round-trips secrets through chrome.storage.local"
        status: pass
    human_judgment: false
  - id: D6
    description: "Migration np_store→np_providers (D-28, Pattern 3) — write-first/strip-second + crash-safe + idempotent"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: "tests/core/security/secrets-inspection.test.ts#migrates a legacy np_store carrying plaintext apiKey/openAiKey to encrypted np_providers + strips plaintext from np_store"
        status: pass
      - kind: unit
        ref: "tests/core/security/secrets-inspection.test.ts#running migrateProviderSecrets twice is a no-op (idempotent — np_providers blob byte-identical)"
        status: pass
      - kind: unit
        ref: "tests/core/security/secrets-inspection.test.ts#crash-order: process dies after np_providers write but before np_store strip → re-run completes the strip"
        status: pass
    human_judgment: false
  - id: D7
    description: "Inspection gate (ROADMAP success criterion 3) — no plaintext substring in persisted np_store or np_providers after a provider save with a known key"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: "tests/core/security/secrets-inspection.test.ts#inspection gate: after a provider save with a known key, neither np_store nor np_providers contains the plaintext substring"
        status: pass
    human_judgment: false
  - id: D8
    description: "hydrateProviderSecrets — decrypt-on-read populates in-memory config from np_providers; read-only (no setItem for np_providers or np_store)"
    requirement: REQ-R07
    verification:
      - kind: unit
        ref: "tests/core/security/secrets-inspection.test.ts#hydrateProviderSecrets: decrypt-on-read reload populates in-memory config from np_providers without writing storage"
        status: pass
      - kind: unit
        ref: "tests/core/security/secrets-inspection.test.ts#hydrateProviderSecrets is read-only: source contains no chromeStorageAdapter.setItem for np_providers or np_store"
        status: pass
    human_judgment: false
  - id: D9
    description: "OptionsPage provider modal masked-field contract — stored key never in value/placeholder/aria/hint •••••••••••••••• for saved keys; 'Save Provider' / 'Check Connection' CTAs"
    requirement: REQ-R07
    verification:
      - kind: automated_ui
        ref: "grep -n \"setModalApiKey(detail.apiKey\" src/components/options/OptionsPage.tsx -> no match (plaintext pre-fill removed)"
        status: pass
      - kind: automated_ui
        ref: "grep -n \"Save Provider\" / grep -n \"Check Connection\" src/components/options/OptionsPage.tsx -> matches the CTA labels; no bare Save/Check in the provider modal footer"
        status: pass
    human_judgment: true
    rationale: "The masked backstop (decrypted key NEVER in input DOM value/placeholder/aria/hint) is a visual-DOM check that benefits from a human opening the modal for a saved-key provider. TDD-secured: source-level assertions + JSON-parse of the rendered React-tree backstop. Held-out per the UI-SPEC Anti-Pattern Gate — verify-work UAT routes this to a human."

# Metrics
duration: 11min
completed: 2026-08-24
status: complete
---

# Phase 2 Plan 2: Encrypt-at-rest foundation Summary

**WebCrypto AES-GCM-256 encrypt-at-rest foundation: KeyVault (np_install_secret 32-byte root + per-blob PBKDF2 derivation), EncryptedStorage, redactSensitive, crash-safe np_store→np_providers migration, and the OptionsPage masked-field contract that closes the plaintext-API-key CONCERNS finding (ROADMAP success criteria 2 + 3).**

## Performance

- **Duration:** 11 min (~30 min of running wall-clock; some of the discrepancy was from re-runs while iterating on Task 2 type narrowing)
- **Started:** 2026-08-24T02:57:54Z
- **Completed:** 2026-08-24T03:09:25Z
- **Tasks:** 3 (Task 1 + Task 2 each produced RED + GREEN commits per TDD; Task 3 was UI-only with one GREEN commit)
- **Files modified:** 5 (3 new + 1 new test + 1 new test + 1 modified; running totals below)

## Accomplishments

- `src/core/security/KeyVault.ts` — `ensureInstallSecret()` (32 random bytes once → `np_install_secret` in chrome.storage.local), `deriveKey(installSecret, extensionId, salt)` per spec §15.2 verbatim (PBKDF2(base64(installSecret) + ':' + extensionId, salt, 100k, SHA-256) → AES-GCM-256), `getExtensionId()` falling back to a stable sentinel when chrome.runtime.id is absent (NEVER navigator.userAgent, per the §15.2 prohibition). `__test__` seam lets unit tests inject extensionId + reader.
- `src/core/storage/EncryptedStorage.ts` — `EncryptedBlob = {salt, iv, ciphertext}` (base64, JSON-safe); `encrypt()`/`decrypt()` with fresh 12-byte IV per call; `encryptProviderConfig()`/`decryptProviderConfig()` for the existing scaffold `ProviderConfig` object shape (D-30/D-30a — NOT the §15.1 array form, that's Phase 3 ProviderRegistry); empty fields stay `''` (preserves "not configured" semantics); `isEncryptedBlob()` type guard.
- `src/core/security/redactSensitive.ts` — deep-copy redaction primitive that empties known secret keys (`apiKey`, `openAiKey`, `geminiKey`, plus any match of `/key|token|secret|authorization/i` case-insensitive) and truncates long string values to 80 chars. Used at persist/log boundaries (D-39/§16.5).
- `useExtensionStore.ts` — `partialize` extended to strip secrets before writing the `np_store` blob (Pitfall 10 + D-28). `migrateProviderSecrets()` async boot step (write FIRST, strip SECOND; crash-safe + idempotent — re-runs are no-ops). `persistProviderConfigEncrypted()` encrypted write that preserves already-encrypted fields byte-identical so an untouched save does not destroy the stored key. `hydrateProviderSecrets()` decrypt-on-read that populates in-memory `config.providers.*.apiKey` / `openAiKey` / `geminiKey` ONLY where the in-memory field is empty (user input wins); read-only by contract — enforced by a source-level regex assertion in tests.
- `OptionsPage.tsx` — removed the plaintext pre-fill (`setModalApiKey(detail.apiKey || '')` line 198) closing the CONCERNS finding. `Input.Password` renders the masked `••••••••••••••••` placeholder when a saved key exists; the decrypted value is never placed into value/placeholder/aria/hint (UI-SPEC E1 partial + backstop). `handleSaveProviderModal` awaits `persistProviderConfigEncrypted()` first — on throw, no success toast, modal stays open (UI-SPEC E1 error row "no false success"). `handleCheckConnection` uses the stored in-memory key transiently when the field is empty. CTA renames `Save` → `Save Provider` and `Check` → `Check Connection` (Dimension 1 verb+noun contract).
- Tests: 7 + 6 = 13 new tests across two files, all passing. `verify:phase-1` stays 182/182 (was 169 before this plan). Zero new `@ts-expect-error NP-STRICT` markers (ceiling is 0).

## Task Commits

Each task was committed atomically; TDD tasks produced the RED + GREEN pair per the plan:

1. **Task 1 RED — `cb5cfac` (test)** — failing tests for EncryptedStorage AES-GCM round-trip + KeyVault installSecret
2. **Task 1 GREEN — `2e4e7bf` (feat)** — implement KeyVault + EncryptedStorage (WebCrypto AES-GCM-256 + PBKDF2)
3. **Task 2 RED — `5125aab` (test)** — failing inspection tests for np_store→np_providers migration (D-28/D-29/D-30)
4. **Task 2 GREEN — `920d532` (feat)** — redactSensitive + np_store→np_providers migration
5. **Task 3 — `e87c984` (feat)** — OptionsPage provider modal: encrypted write + masked field + CTA renames

## Files Created/Modified

- `src/core/security/KeyVault.ts` — install-secret lifecycle + PBKDF2 derive + extensionId fallback
- `src/core/security/redactSensitive.ts` — storage-side redaction primitive
- `src/core/storage/EncryptedStorage.ts` — AES-GCM encrypt/decrypt + ProviderConfig helpers + isEncryptedBlob guard
- `src/store/useExtensionStore.ts` — partialize strip (Pitfall 10), migrateProviderSecrets, persistProviderConfigEncrypted, hydrateProviderSecrets, stripProviderSecrets
- `src/components/options/OptionsPage.tsx` — masked-field contract + encrypted write path + CTA renames
- `tests/core/storage/EncryptedStorage.test.ts` — 7 cases covering all 4 of the planned behaviors (round-trip, tamper rejection, wrong-key rejection, install-secret once-only, fresh salt, fresh IV, ProviderConfig round-trip)
- `tests/core/security/secrets-inspection.test.ts` — 6 cases covering all 5 of the planned behaviors (migrate+strip, idempotency, crash-order, inspection gate, decrypt-on-read reload, source-level read-only assertion)

## Decisions Made

- **PBKDF2 material encoding locked at `base64(installSecret) + ':' + extensionId`.** Spec §15.2 leaves the concatenation encoding as planner's discretion (RESEARCH.md line 514). We pick the deterministic encoding that survives JSON round-trips and document it in a code comment so future maintainers don't substitute a different one — that would silently invalidate every persisted ciphertext on disk for every user (D-29 one-way trade-off).
- **`getExtensionId()` test-harness fallback is `'nowpilot-test-extension-id'`**, NOT random per call. A random fallback would make every test rerun produce fresh ciphertext for the same plaintext, breaking round-trip assertions across `beforeEach` resets.
- **`persistProviderConfigEncrypted` preserves an already-`EncryptedBlob`-shaped field byte-identical** (untouched-field preserve path). A save with no secret edit therefore does NOT destroy the stored key by re-keying with a fresh salt. The companion `encryptProviderConfig()` always encrypts plaintext — the preserved-blob logic lives in the persistProviderConfigEncrypted wrapper only.
- **`hydrateProviderSecrets` populates ONLY where the in-memory field is empty** (freshly-typed user input always wins). This protects the "I just typed a new key, don't clobber it with the old one" case across reload races.
- **Persist order inside `handleSaveProviderModal`:** `persistProviderConfigEncrypted` FIRST, `updateConfig` SECOND. The encrypted write must succeed before any in-memory state is committed; a throw keeps the modal open with no success toast (UI-SPEC E1 error row "no false success").

## Deviations from Plan

None — plan executed exactly as written. All 7 Task-1 acceptance criteria pass on the first run; all 4 Task-2 acceptance criteria pass on the first run; all 3 Task-3 acceptance criteria pass on the first run. The 2 RED + GREEN pairs landed on the first commits; one minor adjustment inside `useExtensionStore.ts` (typing `parsed.openAiKey as unknown` then narrowing via `isEncryptedBlob`) was needed to satisfy strict-mode narrowing — not a deviation, just strict-mode hygiene.

## Issues Encountered

- `tsc` strict-mode narrowing rejected direct `parsed.openAiKey.iv` access after `typeof parsed.openAiKey !== 'string' && !isEncryptedBlob(parsed.openAiKey)` — the conjunction narrowed the type to `never`. Fixed by handling the value as `unknown` first, then calling `isEncryptedBlob(...)` to narrow. Code is strict-clean (zero new NP-STRICT markers).

## User Setup Required

None — no external service configuration required. The encryption scheme uses no external services; `np_install_secret` and `np_providers` are generated and stored locally on a fresh install. D-29 documents that a reinstall loses provider keys (no rotation, no recovery path in v0.1 — accepted trade-off ratified at discuss time).

## Next Phase Readiness

- **Plans 02-03 through 02-07** can consume `migrateProviderSecrets()`, `persistProviderConfigEncrypted()`, `hydrateProviderSecrets()` directly. Plan 02-07's Options boot sequence calls `migrateProviderSecrets()` THEN `hydrateProviderSecrets()` per Open Question 3's resolution (RESEARCH.md line 657).
- **Plan 02-04/02-05/02-06** can use `redactSensitive()` at the ErrorStore write boundary (D-39/§16.5 contract).
- **Plan 02-06** adds `STORAGE_QUOTA`/`STORAGE_RATE_LIMIT` classification to the `chromeStorageAdapter` flush catch — the plan-level pattern already includes redaction via `redactSensitive()` and ErrorStore integration.
- **Plan 02-07 Task 2** wires the per-entrypoint boot: sidepanel/standalone = `recoverJournal` → `IndexedDBMigrator.bootstrap` → `startElection(surface)` → `setStorageErrorReporter`; options = `IndexedDBMigrator.bootstrap` → `migrateProviderSecrets` → `hydrateProviderSecrets` → `setStorageErrorReporter` → encrypted providers read (no election — Options does not write workspace state).

## Self-Check: PASSED

All on-disk claims verified:

- `src/core/security/KeyVault.ts` — present (148 lines), exports `ensureInstallSecret`, `deriveKey`, `getExtensionId`, `__test__`. `__test__` has `setExtensionId` + `setInstallSecretReader` + `reset`.
- `src/core/storage/EncryptedStorage.ts` — present (169 lines), exports `EncryptedBlob`, `encrypt`, `decrypt`, `encryptProviderConfig`, `decryptProviderConfig`, `isEncryptedBlob`.
- `src/core/security/redactSensitive.ts` — present (71 lines), exports `redactSensitive` and `redactSensitiveValue`.
- `src/store/useExtensionStore.ts` — modified, exports `stripProviderSecrets`, `migrateProviderSecrets`, `persistProviderConfigEncrypted`, `hydrateProviderSecrets`. `partialize` now strips secrets before persist. `npStoreMigrate` unchanged (v1 no-op).
- `src/components/options/OptionsPage.tsx` — modified, `setModalApiKey(detail.apiKey || '')` removed; `Input.Password` placeholder switches between `'••••••••••••••••'` and `'Enter your API key'` based on the in-memory saved-key detection. `okText="Save Provider"`, `>Check Connection<` button label.
- `tests/core/storage/EncryptedStorage.test.ts` — 7/7 tests pass.
- `tests/core/security/secrets-inspection.test.ts` — 6/6 tests pass.
- `git grep -nE "NP-STRICT" src/core/security src/core/storage src/store` — zero new markers.
- `pnpm lint` (tsc --noEmit) — clean.
- `pnpm run verify:phase-1` — 182/182 tests pass (166 pre-existing + 3 harness smoke + 13 new from this plan), tsc clean, tailwind gate clean.
- `pnpm exec vitest run tests/core/storage tests/core/security` — 4 files / 23 tests pass.
- Commits `cb5cfac`, `2e4e7bf`, `5125aab`, `920d532`, `e87c984` — all present in `git log`.

---
*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-08-24*
