---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 03
subsystem: security
tags: [webcrypto, aes-gcm, pbkdf2, keyvault, credential-vault, redaction, zod, chrome-storage, wave-2]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: Wave 0 seams (tests/setup.ts Map-backed storage areas, shared onChanged dispatcher, __resetIndexedDB), the 02-02 typed-result/redacted-reason conventions
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: legacyCredentialCleanup's field-names-only redaction discipline, WorkspaceState's strict-Zod envelope + never-throwing parse shape, debugLog's SCREAMING_SNAKE convention, the canonical ProviderId union
provides:
  - "src/core/security/EncryptedStorage.ts — CredentialEnvelopeV1, credentialEnvelopeSchema, parseCredentialEnvelope(), deriveKeyFromMaterial(), buildKdfMaterialInput(), KDF_CONCATENATION_SEPARATOR, encryptCredential(), decryptCredential(), bytesToBase64()/base64ToBytes(), parseProviderId(), EncryptedStorageErrorCode"
  - "src/core/security/KeyVault.ts — createKeyVault(), KeyVault/KeyVaultDeps/StorageAreaLike, CREDENTIAL_KEY_PREFIX + credentialStorageKey(), KeyVaultErrorCode, InstallSecretReadResult"
  - "src/core/security/redactSensitive.ts — redactSensitive(), redactErrorContext(), isSensitiveFieldName(), SENSITIVE_FIELD_NAMES (one frozen list), REDACTED_PLACEHOLDER"
  - "tests/core/security/ — EncryptedStorage.test.ts (12), KeyVault.test.ts (16), redactSensitive.test.ts (15) — the directory and its three suites, all enumerated by 02-13's corrected verify:phase-2"
affects: [02-04, 02-05, 02-06, 02-08, 02-10, 02-11, 02-13, phase-03-provider-runtime, phase-11-observability]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 17260
  tasks: 3
  commits: 3
plan_head_before: 045a8d71062bc5d32692e3b271ae0ddced93398c

tech-stack:
  added: []
  patterns:
    - "WebCrypto-only credential crypto: PBKDF2(utf8(installSecretBase64 + extensionId), fresh 16-byte salt, 100000, SHA-256) -> non-extractable AES-GCM-256; no dependency added"
    - "AAD-bound envelope metadata: additionalData = canonical JSON of { v, providerId, alg, kdf } in a pinned literal key order, so a tampered version/provider/algorithm/iteration count fails the GCM tag check"
    - "One indistinguishable redacted decode code for malformed/tampered/foreign/wrong-key input — the caller never sees a DOMException"
    - "Injected dependencies with per-call production defaults (chrome.runtime.id, chrome.storage.local) resolved inside the call, never at module scope, so the module imports in every context and fails closed"
    - "Redaction by field name at one choke point: a frozen pattern list, substring match on a normalised key, placeholder substitution at any depth, total/throw-free/cycle-safe/deterministic"

key-files:
  created:
    - src/core/security/EncryptedStorage.ts
    - src/core/security/KeyVault.ts
    - src/core/security/redactSensitive.ts
    - tests/core/security/EncryptedStorage.test.ts
    - tests/core/security/KeyVault.test.ts
    - tests/core/security/redactSensitive.test.ts
  modified: []

key-decisions:
  - "`store` is create-only: storing over an existing credential returns the typed conflict KEY_VAULT_ALREADY_CONFIGURED instead of silently rotating a working credential; `replace` is the explicit supersede and returns KEY_VAULT_NOT_CONFIGURED when nothing exists. A caller flows `isConfigured ? replace : store` — the choice the plan left open, documented in the module comment and asserted by the suite."
  - "`isConfigured` reports presence, not validity: a corrupt stored value still reads as 'something is stored', and recovery is `replace` or `delete` — never a silent `store` overwrite, which is what makes the corruption path explicit."
  - "`inspectEnvelopeVersion` and `delete` need a storage area but no derived key, so they work in a context that cannot supply an extension id; `store`/`replace`/`retrieve` fail closed with KEY_VAULT_UNAVAILABLE instead of fabricating a key. Asserted in the suite."
  - "The credential key is `np_credential_<validated ProviderId>` from one CREDENTIAL_KEY_PREFIX constant. §15.1 lists np_providers (encrypted apiKey fields) but names no standalone credential key, so this is recorded as a naming follow-up inside the module comment (the D2-29 'record the follow-up, do not edit the spec' pattern); PRODUCT_SPEC.md is not edited."
  - "The derivation concatenation is pinned as `installSecretBase64 + KDF_CONCATENATION_SEPARATOR + extensionId` with the separator deliberately the empty string (RESEARCH A11): the spec's `+` is a direct juxtaposition, and the named constant exists so a later 'tidy' into a delimiter fails the golden byte assertion rather than orphaning every stored envelope."
  - "`redactErrorContext` reads an error name structurally (DOMException is not `instanceof Error` here — the exact defect 02-02 recorded) and accepts only an identifier-shaped name, so an arbitrary tagged object cannot smuggle a secret through the `name` field. The plan's literal `instanceof Error` expression would have reported 'object' for every crypto failure."
  - "`redactSensitive` over-redacts by design (substring match on a normalised key, so `apiKey`/`api_key`/`X-Api-Key` all match): the safe direction for a choke point. It is deliberately not a content scanner — the §4.4 value-shape patterns belong to Phase 11's TraceRedactor, and the Phase-1 LEGACY_SECRET_FIELDS deletion surface is not restated here."

patterns-established:
  - "Vault failures are one redacted code where the plan demands indistinguishability (CREDENTIAL_DECRYPT_FAILED) and typed SCREAMING_SNAKE codes everywhere else — never a message, never a stack."
  - "A caught value's `reason` is its shape-checked error NAME; a rejected input's value is never logged (only that it was rejected), so a credential passed where a provider id belongs cannot leak."
  - "Absence assertions are exact-output pinned: the redaction suite asserts the full serialised result, so a length, prefix, suffix, mask or digest could never hide behind a negative assertion."

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "EncryptedStorage: §15.2 derivation with the concatenation pinned by a golden byte assertion, AES-GCM envelope codec with AAD-bound version/provider/algorithm/KDF metadata, fresh salt+IV per operation, and one indistinguishable redacted code for every malformed/tampered/foreign/wrong-key decode"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/security/EncryptedStorage.test.ts (12 passed)"
        status: pass
      - kind: integration
        ref: "npx vitest run tests/core/security (3 files / 43 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "KeyVault: the D2-03 surface (store/replace/retrieve/isConfigured/delete/inspectEnvelopeVersion) with injected extensionId/storage/readInstallSecret, per-call production defaults, per-provider np_credential_ keys, replace/delete semantics, and fail-closed handling of an unavailable secret, a wrong key, a malformed envelope and a storage failure — with the sentinel absent from storage and logs"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/security/KeyVault.test.ts (16 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "redactSensitive: one frozen sensitive-name list, a total/throw-free/deterministic walk that redacts at any depth including arrays and cycles, reports field names only and never computes a derived value, plus redactErrorContext's name-only reason"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/security/redactSensitive.test.ts (15 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Plan verification gate: the three suites green together with tsc --noEmit clean, and no Phase 1/2 regression (the full repository suite grew by exactly this plan's three files and 43 tests)"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "npx tsc --noEmit (clean) && npx vitest run tests/core/security/EncryptedStorage.test.ts tests/core/security/KeyVault.test.ts tests/core/security/redactSensitive.test.ts (43 passed) && npx vitest run (48 files / 641 tests)"
        status: pass
      - kind: integration
        ref: "npx vitest run tests/core/storage tests/core/workspace tests/isolation tests/core/security (17 files / 257 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "KeyVault's injected install-secret provider is a structural match for 02-04's Setting.readInstallSecret() export, so production wiring is a direct pass-through with no adapter module between the two plans"
    requirement: "CORE-02"
    verification: []
    human_judgment: true
    rationale: "A cross-plan structural type match cannot be asserted by a unit test; 02-04's Task 3 wires the pass-through and its own suite proves the composed behaviour. A verifier should confirm the union signature and that no adapter module was introduced."

duration: 6 min
completed: 2026-09-24
status: complete
---

# Phase 2 Plan 03: Credential Vault Crypto Core Summary

**`EncryptedStorage` (PBKDF2 100000/SHA-256 → AES-GCM-256 with an AAD-bound versioned envelope), `KeyVault` (the D2-03 encrypted-credential contract over injected dependencies) and `redactSensitive` (one field-name-only redaction choke point) — 43 cases proving the round trip, the pinned derivation bytes, fresh salt/IV, 21 tamper shapes, replace/delete semantics and sentinel absence from storage and logs.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-09-23T23:17:12Z
- **Completed:** 2026-09-23T23:22:58Z
- **Tasks:** 3
- **Files modified:** 6 (all created)

## Accomplishments

- **The §15.2 crypto is real and pinned.** PBKDF2 over `utf8(installSecretBase64 + '' + extensionId)` with 100000 iterations and SHA-256 derives a **non-extractable** AES-GCM-256 key usable only for encrypt/decrypt; the concatenation is pinned by a byte-exact golden assertion, so a later "tidy" into a delimiter fails the test instead of silently orphaning every stored envelope (A11).
- **Tamper behaviour is one code, and it is proved against 21 shapes.** A bumped version, a changed provider, algorithm, hash or iteration count, a wrong-length or truncated salt/IV, a flipped or truncated ciphertext, a wrong key (extension id and install secret), a non-canonical base64 field, an unknown extra field and five non-envelope values all return the same `CREDENTIAL_DECRYPT_FAILED`, and no `DOMException` ever reaches the caller. The version/provider/algorithm/KDF metadata is bound through `additionalData`, so the tag check is what rejects a value that still passes the schema.
- **The vault's contract is the D2-03 one, with the open choice made explicit.** `store` is create-only (typed conflict, never a silent rotation), `replace` supersedes and re-mints salt/IV, `delete` is idempotent, `isConfigured` is presence, and `inspectEnvelopeVersion` can only ever return `{ present, version, providerId }`. `retrieve` is the single method whose result can carry plaintext, and a stored envelope under the wrong provider's key is rejected rather than handed back.
- **Injection is honest.** `chrome.runtime.id` and `chrome.storage.local` are resolved **per call** — never at module scope — so the module imports in a test environment that has neither and fails closed with `KEY_VAULT_UNAVAILABLE`; the suite asserts that path and that nothing was written.
- **The redaction choke point exists before the modules that persist error context.** `redactSensitive` is total, throw-free, deterministic and cycle-safe, redacts at any depth including inside arrays, reports **field names only**, and the suite pins the exact serialised output so no length, prefix, suffix, mask or digest could hide. `redactErrorContext` returns an error name only and refuses a secret smuggled through a `name` field.
- **No regression.** `tsc --noEmit` clean; the three suites green together at 43 tests; the wave slice (`tests/core/storage`, `tests/core/workspace`, `tests/isolation`, `tests/core/security`) green at 17 files / 257 tests; the full repository suite green at 48 files / 641 tests — exactly 02-02's 45/598 plus this plan's three files and 43 tests.

## Task Commits

Each task was committed atomically (Task 3 before Task 2 — see Deviations):

1. **Task 1: `EncryptedStorage.ts` — §15.2 derivation, AES-GCM envelope codec, fail-closed decode** — `dbde9e23` (feat)
2. **Task 3: `redactSensitive.ts` — one redaction choke point reporting field names only** — `5a5692f6` (feat)
3. **Task 2: `KeyVault.ts` — versioned encrypted credential store with injected dependencies** — `57b6f1db` (feat)

**Plan metadata:** see the final `docs(02-03)` commit below

## Files Created/Modified

- `src/core/security/EncryptedStorage.ts` — `CredentialEnvelopeV1` (strict Zod: `v` literal 1, `providerId` from the canonical union, pinned `kdf`, `alg`, base64 `salt`/`iv`/`ciphertext`), `parseCredentialEnvelope()`, `deriveKeyFromMaterial()`, `buildKdfMaterialInput()` + `KDF_CONCATENATION_SEPARATOR`, `encryptCredential()`, `decryptCredential()`, `parseProviderId()`, base64 boundary helpers.
- `src/core/security/KeyVault.ts` — `createKeyVault(deps)` returning the six-operation `KeyVault`; `StorageAreaLike`, `KeyVaultDeps`, `InstallSecretReadResult`, `KeyVaultErrorCode`, `CREDENTIAL_KEY_PREFIX`/`credentialStorageKey()`; per-call default resolution, envelope-only persistence, redacted logging.
- `src/core/security/redactSensitive.ts` — `SENSITIVE_FIELD_NAMES` (one frozen list), `isSensitiveFieldName()`, `redactSensitive()`, `redactErrorContext()`, `REDACTED_PLACEHOLDER`/`CIRCULAR_PLACEHOLDER`/`UNSERIALISABLE_PLACEHOLDER`.
- `tests/core/security/EncryptedStorage.test.ts` — round trip, freshness, golden bytes, non-extractability, determinism, 21 tamper shapes, strict schema, junk-input totality.
- `tests/core/security/KeyVault.test.ts` — round trip and persisted shape, store conflict, replace-not-first-store, replace unrecoverability, idempotent delete, absent-provider not-configured, malformed/wrong-key/unavailable-secret/unavailable-context/invalid-input/storage-failure fail-closed paths, log-ring-buffer sentinel absence.
- `tests/core/security/redactSensitive.test.ts` — frozen single list, matcher behaviour, three-level nesting, exact-output absence, arrays, cycles, totality for primitives/Date/function/symbol, determinism, error-context name-only cases.

## Decisions Made

- **`store` create-only, `replace` explicit** (the plan's open choice): an accidental overwrite cannot orphan a working credential, and the corruption recovery path is explicit (`replace`/`delete`), never a silent `store`.
- **Presence is presence.** `isConfigured` reports that a value is stored, not that it decrypts — so a corrupt envelope cannot make the vault look unconfigured and invite a `store` that would then conflict.
- **`np_credential_<providerId>` locked as a naming follow-up** inside the module comment; `PRODUCT_SPEC.md` untouched (D2-29 pattern).
- **Structural error-name reading with a shape guard** in `redactErrorContext` (see Deviations).
- **Additive helpers exported** where a later plan or the suite needs the boundary pinned: `parseCredentialEnvelope`, `parseProviderId`, `buildKdfMaterialInput`, base64 helpers, `credentialStorageKey`, `isSensitiveFieldName`. No surface beyond the plan's artifact list was added to `KeyVault` itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 3 (`redactSensitive`) executed and committed before Task 2 (`KeyVault`)**
- **Found during:** planning the task sequence, before Task 2's first edit
- **Issue:** Task 2's action requires KeyVault to `Call redactSensitive for any error context before logging` (and the plan's key_links record the import). `redactSensitive.ts` is Task 3's deliverable, so executing in the literal 1 → 2 → 3 order would have made Task 2's module fail to resolve its import — its suite could not run, so the commit-after-verification rule could not be satisfied. The plan's own success criterion also states the redaction choke point must exist *before* any module that persists error context is written.
- **Fix:** executed 1 → 3 → 2. Task 1 has no dependency on either; Task 3 has none; Task 2 then imports the choke point that exists. Each task still committed atomically after its own verification passed.
- **Files modified:** none beyond the plan's six.
- **Verification:** the three suites green together after Task 2 landed (43 passed) and `tsc --noEmit` clean.
- **Committed in:** `5a5692f6` (Task 3) precedes `57b6f1db` (Task 2)

**2. [Rule 1 - Bug] `redactErrorContext` reads the error name structurally instead of `instanceof Error`**
- **Found during:** Task 3 (designing against 02-02's recorded deviation)
- **Issue:** the plan's literal shape `error instanceof Error ? error.name : typeof error` degrades every `DOMException` to `'object'`, because a thrown `DOMException` is not `instanceof Error` in this environment — the exact defect 02-02 recorded when four modules' typed open failures silently collapsed to a generic code. Applying it verbatim here would have made every crypto failure log `reason: 'object'`.
- **Fix:** the name is read structurally from a non-null object and accepted only when it matches `^[A-Za-z][A-Za-z0-9_]{0,31}$` — still never a message and never a stack, and an arbitrary tagged object cannot smuggle a secret through `name`. The suite asserts `{ name: 'OperationError' }` → `'OperationError'` and `{ name: SENTINEL }` → `'object'`.
- **Files modified:** `src/core/security/redactSensitive.ts`, `tests/core/security/redactSensitive.test.ts`
- **Verification:** `npx vitest run tests/core/security/redactSensitive.test.ts` → 15 passed; `tsc --noEmit` clean.
- **Committed in:** `5a5692f6` (part of Task 3's commit)

**3. [Rule 2 - Missing Critical] KeyVault rejects an empty, whitespace-only or non-string credential before any crypto or storage call**
- **Found during:** Task 2 (the vault write boundary)
- **Issue:** the plan names no input validation at the vault's own boundary (02-04's port validates its inputs, but the vault is a public module and the trust boundary "arbitrary values -> persistence" is in the plan's threat model). Without a guard, an empty credential would be encrypted and persisted as a valid-looking envelope.
- **Fix:** `KEY_VAULT_INVALID_CREDENTIAL` for a non-string, empty or whitespace-only value, asserted for both `store` and `replace`, with nothing written and no value logged.
- **Files modified:** `src/core/security/KeyVault.ts`, `tests/core/security/KeyVault.test.ts`
- **Verification:** `npx vitest run tests/core/security/KeyVault.test.ts` → 16 passed.
- **Committed in:** `57b6f1db` (part of Task 2's commit)

---

**Total deviations:** 3 auto-fixed (1 blocking ordering, 1 bug, 1 missing critical)
**Impact on plan:** The ordering change is what keeps every task's commit green; the other two close real defects the plan's literal text would have shipped (a degraded redaction reason and an unvalidated write boundary). No scope creep: no file outside the plan's `files_modified` was touched.

## Issues Encountered

- **The plan's module path for `EncryptedStorage` conflicts with the research documents.** 02-RESEARCH.md, 02-PATTERNS.md and 02-VALIDATION.md place it at `src/core/storage/EncryptedStorage.ts`, while the plan's `files_modified`, artifact table and task `<files>` (and 02-13's corrected `verify:phase-2` suite list) pin `src/core/security/EncryptedStorage.ts` and `tests/core/security/EncryptedStorage.test.ts`. The plan was followed — it is the execution contract and 02-13's gate enumerates the security path — and the divergence is recorded here for the phase acceptance review.
- **Two test expectations in Task 2 were corrected against the design rather than the other way round.** A stored `null` is indistinguishable from absence in `chrome.storage`, so it reads as `KEY_VAULT_NOT_CONFIGURED` (asserted explicitly); and `delete`/`inspectEnvelopeVersion` legitimately need no extension id (they resolve against the shared storage mock), which the "unavailable context" case now states instead of asserting a spurious failure.
- Pre-existing untracked planning artifacts (`.gsd/`, `.planning/milestone.lock`) were left untouched — outside this plan's scope.

## Known Stubs

None. Every module this plan created is exercised by its own suite; no placeholder values, no TODO/FIXME markers, no empty-collection defaults flow anywhere. `redactSensitive`'s documented limitation (it redacts by field name and is deliberately not a free-text scanner) is a scoped design boundary owned by Phase 11's `TraceRedactor`, not a stub.

## Threat Flags

None. Every surface this plan introduced was already in the plan's `<threat_model>` (T-02-12 credential persistence, T-02-13 envelope integrity, T-02-14 wrong-key decrypt, T-02-15 error contexts, T-02-16 replace semantics, T-02-17 malformed stored envelope) and each has a passing assertion. No new network endpoint, auth path, file access pattern or trust-boundary schema change was added; no package was installed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **02-04** can pass `Setting.readInstallSecret` straight into `createKeyVault({ readInstallSecret })` — the union signature matches structurally and no adapter module exists. The port's `CredentialVaultLike` must cover exactly the six-operation surface this plan ships; the source-level `src/components/**` scan it adds is the D2-03 boundary this vault was built behind.
- **02-05** imports `redactSensitive` / `redactErrorContext` for the journal and migration paths; the choke point is total, so any context shape it passes is safe.
- **02-06 / 02-08 / 02-10 / 02-11** have the vault and the redaction boundary available; nothing here touches the UI, a network request or a browser-version-dependent value.
- **02-13**'s corrected `verify:phase-2` already enumerates the three suites created here, so the gate's path preflight will resolve them.
- **Open item recorded for the phase (not a blocker):** the `src/core/storage/EncryptedStorage.ts` vs `src/core/security/EncryptedStorage.ts` path divergence in the research documents (see Issues Encountered) should be reconciled in the phase acceptance review so a later reader does not look for the module in the wrong directory.

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 6 created files exist on disk: the three `src/core/security/` modules and their three suites.
- All 3 task commits exist in history: `dbde9e23` (Task 1), `5a5692f6` (Task 3), `57b6f1db` (Task 2).
- Measured commit count at SUMMARY write time (`git rev-list --count 045a8d71..HEAD`): 3 task commits, base recorded as `plan_head_before`.
