---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 04
subsystem: security
tags: [credential-store-port, keyvault, install-secret, chrome-storage, serialised-writes, read-back-verification, presentation-isolation, redaction, source-scan, wave-3]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: 02-03's KeyVault (the six-operation vault this port wraps) and its `InstallSecretReadResult` union signature; 02-02's typed-result and redacted-reason conventions; 02-01's Wave 0 chrome.storage mocks
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: the declaration-only Phase-1 CredentialStorePort, the cross-entrypoint import-scan walker pattern, debugLog's SCREAMING_SNAKE convention, the synthetic-sentinel test idiom
provides:
  - "src/services/ports/credentialStorePort.ts — the frozen D2-03 contract (store/replace/retrieve/isConfigured/delete/inspectEnvelopeVersion), CredentialStoreErrorCode, CredentialStoreResult/RetrieveResult/InspectResult, CredentialVaultLike + the three wide vault result types, CREDENTIAL_MAX_LENGTH, createCredentialStorePort()"
  - "src/core/storage/Setting.ts — SETTING_INSTALL_SECRET_KEY, INSTALL_SECRET_BYTES, SettingErrorCode/SettingResult, writeSettingSerialized(), readInstallSecret(), __test__ (resetPendingWrites/getPendingSize)"
  - "tests/core/security/credentialStorePort.test.ts (27) and tests/core/storage/Setting.test.ts (21) — the port-contract suite including the src/components/** vault-import scan, and the install-secret lifecycle suite"
affects: [02-05, 02-07, 02-12, 02-13, phase-03-provider-runtime]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 13835
  tasks: 2
  commits: 2
plan_head_before: ea221d91e09657b4e5a4edf7376296ad80535326

tech-stack:
  added: []
  patterns:
    - "Port over a parameter, never an import: the port takes a `CredentialVaultLike` so it stays importable without the crypto graph, and a source-level scan — not a convention — is what makes the presentation boundary real"
    - "A closed port vocabulary: vault codes are translated through one table and an unknown code degrades to the generic failure, so no caller ever reads the vault's internals"
    - "Per-key in-flight write chains (`Map<string, Promise<void>>`) chained with `then(write, write)` — ordering without a circuit breaker, and different keys never queue behind each other"
    - "Create-on-first-use re-reads *inside* the serialised section and adopts the winner; the read-back must equal the value written or the read reports a typed failure"
    - "Fail closed on a malformed stored secret: typed code, stored value untouched, never regenerated over (it may already be the KDF input for stored envelopes)"
    - "Source-level absence proof with a positive control and self-tests: walk the import specifiers of `src/components/**` against the vault module set (seeds plus transitive re-exporters)"

key-files:
  created:
    - src/core/storage/Setting.ts
    - tests/core/security/credentialStorePort.test.ts
    - tests/core/storage/Setting.test.ts
  modified:
    - src/services/ports/credentialStorePort.ts

key-decisions:
  - "The port keeps its own code vocabulary (`CredentialStoreErrorCode`) and translates the vault's codes through one table; an unknown code degrades to `CREDENTIAL_STORE_FAILED`. The four semantic codes (already-configured / not-configured / unavailable / decrypt-failed) map one-for-one so Phase 3 can branch, and the read/write/delete vault codes deliberately collapse to the generic failure."
  - "`CREDENTIAL_MAX_LENGTH = 4096` is the one input bound: provider keys are short, and the cap rejects an accidental document paste before it is encrypted and persisted. Blank, whitespace-only and non-string share the same typed rejection."
  - "`writeSettingSerialized` keeps the plan-literal `(key, write: () => Promise<void>): Promise<void>` signature; the create path captures its outcome in a local initialised to a real failure, so no generic parameter was needed and the function can never return an unset result."
  - "The re-read inside the serialised section is the whole concurrency fix: without it two callers each generate and write, so they disagree. Proved by mutation — deleting the re-read turns the concurrent-first-use case red (two different values), restoring it turns it green."
  - "A read-back mismatch reports `SETTING_INSTALL_SECRET_UNVERIFIED` rather than adopting the divergent value: only a non-serialised writer could produce that state, so reporting failure is the conservative answer (and the plan requires that no success be reported)."
  - "The base64 encode/decode helpers are local to `Setting.ts` rather than imported from `EncryptedStorage`: importing the envelope codec would drag zod and the crypto graph into the storage module's import graph, inverting the layering for eight lines of code. The canonical-base64 rule (length % 4, charset, exact 32 bytes) is stated here too."
  - "The composed KeyVault case was added to the Setting suite — `createKeyVault({ extensionId, storage, readInstallSecret })` stores and retrieves a synthetic credential, and fails closed when the secret is unreadable. This converts 02-03's D5 human-judgment coverage item into an automated one and is the only place the consumer loop is exercised end to end."
  - "The presentation-isolation scan includes the transitive re-export closure (any module re-exporting a vault module joins the vault set), because the D2-03 must-have says \"or any module that re-exports them\" and a barrel would otherwise be a hole."

patterns-established:
  - "An absence assertion is paired with a positive control (the scan reads real component files) and two self-tests (it catches a synthetic direct import in both the relative and `@/` spellings; it does not flag the port or the shared leaf modules)."
  - "A security-critical concurrency claim is verified by mutation: temporarily weaken the implementation, observe the named case go red, restore, and record the observation."
  - "A port that wraps a vault owns the translation of the vault's failure vocabulary and logs the translated code with an error NAME only (`redactErrorContext`), never a message and never the rejected value."

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "CredentialStorePort at the frozen D2-03 surface: exactly the six authorised operations, no list-all/export/preview/reveal/generic-setter, the Phase-1 isConfigured/store shapes preserved, and the real KeyVault accepted structurally with no adapter module"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/security/credentialStorePort.test.ts (27 passed)"
        status: pass
      - kind: integration
        ref: "npx vitest run tests/services/providerValidationFixtures.test.ts (the Phase-1 'no call site' assertion still holds)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Blank and malformed credential input never reaches the vault: empty, whitespace-only, non-string and over-long values are rejected on store and replace with a typed redacted error, the fake vault's call count stays zero and the storage map stays empty (T-02-19)"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/security/credentialStorePort.test.ts — blank and malformed input never reaches the vault (10 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Typed redacted failures for every expected runtime error: the vault's semantic codes translate into the port vocabulary, an unknown code degrades to the generic failure, a throwing vault is caught (every operation), isConfigured fails closed to false, and no value reaches the result or the log ring buffer outside retrieve (T-02-20)"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/security/credentialStorePort.test.ts — typed redacted failures (6 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No file under src/components/** imports KeyVault, EncryptedStorage or a module that re-exports them — proved by a source scan with a positive control, self-tests for both import spellings and a non-flagging case for the port (T-02-18)"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/security/credentialStorePort.test.ts — presentation isolation (5 cases)"
        status: pass
      - kind: manual_procedural
        ref: "temporary `import { createKeyVault } from '../../core/security/KeyVault'` in src/components/common/NowPilotAvatar.tsx → scan reported ['src/components/common/NowPilotAvatar.tsx -> ../../core/security/KeyVault'] and the case failed; file restored via git checkout and the suite returned to 27 passed"
        status: pass
    human_judgment: false
  - id: D5
    description: "np_install_secret lifecycle: a fresh install creates exactly one key holding base64 that decodes to exactly 32 bytes, a second read returns it without regenerating, and no second storage key is written (OQ-3/OQ-6)"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/storage/Setting.test.ts — lazy create-on-first-use (3 cases)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Concurrent first use from two surfaces produces one durable value: the per-key write chain serialises, the create re-reads inside the serialised section and adopts the winner, both callers and the stored value agree, and exactly one write happens (T-02-21)"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/storage/Setting.test.ts — concurrent first use resolves to one durable value (4 cases)"
        status: pass
      - kind: manual_procedural
        ref: "mutation probe: removing the in-section re-read turned the concurrent case red (two different values); restoring it returned the suite to 21 passed"
        status: pass
    human_judgment: false
  - id: D7
    description: "A malformed, wrong-length or non-string stored install secret fails closed with a typed code and is never overwritten; a failed read, a failed write and a missing storage area resolve to typed soft results rather than throwing (T-02-22)"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/storage/Setting.test.ts — fail-closed, read-back verification and storage-availability guard (8 cases)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The real Phase 2 consumer loop: Setting.readInstallSecret is passed straight into createKeyVault with no adapter, a synthetic credential round-trips through the vault using the lazily created secret, and the vault fails closed when the secret cannot be read"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/storage/Setting.test.ts — the real Phase 2 consumer (2 cases)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Plan verification gate: both suites green together with tsc --noEmit clean and no Phase 1/2 regression (the full repository suite grew by exactly this plan's two files and 48 tests)"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "npx tsc --noEmit (clean) && npx vitest run tests/core/security/credentialStorePort.test.ts tests/core/storage/Setting.test.ts (46 passed) && npx vitest run (50 files / 689 tests)"
        status: pass
    human_judgment: false

duration: 20 min
completed: 2026-09-24
status: complete
---

# Phase 2 Plan 04: Credential Port Contract and Install-Secret Lifecycle Summary

**The frozen D2-03 credential contract — six authorised operations with a vault taken as a parameter, blank-input rejection at the boundary and a proven `src/components/**` isolation scan — plus `Setting.ts` shipping with its real consumer: `np_install_secret` created once, serialised per key, read-back-verified and fail-closed on malformed stored data, with the KeyVault pass-through proved end to end.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-09-23T23:29:37Z
- **Completed:** 2026-09-23T23:49:45Z
- **Tasks:** 2
- **Files modified:** 4 (3 created, 1 extended)

## Accomplishments

- **The D2-03 contract is frozen and the absences are asserted, not assumed.** `CredentialStorePort` carries `store` / `replace` / `retrieve` / `isConfigured` / `delete` / `inspectEnvelopeVersion` and nothing else: the suite asserts the created object's own keys are exactly those six and that sixteen forbidden spellings (`listAll`, `export`, `preview`, `reveal`, `set`, `get`, `dump`, …) are absent. `retrieve` is the only method whose result type can carry a credential, and the suite proves that at runtime as well as in the types.
- **The port cannot reach the vault, and a scan proves it.** `createCredentialStorePort` takes a `CredentialVaultLike` **parameter** — the module holds no vault import — so it stays importable from a surface without the crypto graph. The isolation scan walks `src/components/**`, resolves each import specifier (relative and `@/`) against the vault module set (the two seeds plus every transitive re-exporter), and has a positive control plus self-tests. **Observed red:** a temporary `KeyVault` import in `NowPilotAvatar.tsx` produced exactly one offender row and failed the case; the file was restored with `git checkout --` and the suite returned to green.
- **A blank field can never create or overwrite a credential.** Empty, whitespace-only, non-string and over-long input are rejected on both `store` and `replace` **before any vault call** — the fake vault's call count is asserted zero and the storage map is asserted empty (T-02-19).
- **The failure surface is redacted and closed.** Vault codes are translated through one table (already-configured / not-configured / unavailable / decrypt-failed map one-for-one; read/write/delete collapse to the generic failure; an unknown code degrades rather than leaking). A throwing vault is caught on every operation, `isConfigured` fails closed to `false`, and the log ring buffer is asserted free of the sentinel while still carrying the error **name** (T-02-20).
- **The install secret has a real consumer and a real lifecycle.** `readInstallSecret()` lazily creates 32 random bytes as base64 in `np_install_secret`, writes through the per-key serialised chain and returns the value **only** when the read-back matches; a malformed, wrong-length or non-string stored value returns a typed code and is left untouched. The suite then proves the consumer loop: `readInstallSecret` is passed straight into `createKeyVault`, a synthetic credential round-trips, and the vault fails closed (`KEY_VAULT_SECRET_UNAVAILABLE`) when the secret is unreadable — closing 02-03's D5 human-judgment item automatically.
- **The concurrency claim is verified by mutation, not by reading.** Two concurrent `readInstallSecret()` calls from an empty store resolve to one durable value with exactly **one** write, because the create re-reads inside the serialised section and adopts the winner. Deleting that re-read turned the case red (two different values); restoring it turned it green (T-02-21).
- **No regression.** `tsc --noEmit` clean; the two new suites green together at 46 tests; the full repository suite green at 50 files / 689 tests — exactly 02-03's 48/641 plus this plan's two files and 48 tests.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend `CredentialStorePort` to the D2-03 contract with a vault-backed implementation** — `789be55b` (feat)
2. **Task 2: `Setting.ts` — serialised single-key writes and the read-back-verified install secret** — `b72024ed` (feat)

**Plan metadata:** see the final `docs(02-04)` commit below

## Files Created/Modified

- `src/services/ports/credentialStorePort.ts` — extended in place: `CredentialStoreErrorCode` (seven codes), `CredentialStoreResult` / `CredentialStoreRetrieveResult` / `CredentialStoreInspectResult`, `CredentialEnvelopeInspection`, `CredentialVaultLike` with the three wide (`code: string`) vault result types that let the real `KeyVault` satisfy it with no adapter, `CREDENTIAL_MAX_LENGTH`, the `VAULT_CODE_MAP` translation table and `createCredentialStorePort(vault)`.
- `src/core/storage/Setting.ts` — `SETTING_INSTALL_SECRET_KEY`, `INSTALL_SECRET_BYTES`, `SettingErrorCode` / `SettingResult`, `writeSettingSerialized()`, `readInstallSecret()`, `createOrAdopt()` (the in-section re-read), local canonical-base64 helpers, per-call storage-area resolution and the `__test__` seams.
- `tests/core/security/credentialStorePort.test.ts` — 27 cases: surface and absences, Phase-1 shape compatibility, the structural `KeyVault` check, delegation, ten blank/malformed-input rejections, six redacted-failure cases, and the five-case presentation-isolation block (scan, positive control, two self-tests, the port's own import scan).
- `tests/core/storage/Setting.test.ts` — 21 cases: constants, three create-on-first-use cases, four serialisation/concurrency cases, five fail-closed cases, three read-back/typed-failure cases, the availability guard, two redaction cases and the two-case composed KeyVault block.

## Decisions Made

- **The port owns its own failure vocabulary.** Translating the vault's codes at the boundary means Phase 3 branches on a stable set, and a future vault code degrades to `CREDENTIAL_STORE_FAILED` instead of leaking. The four semantic codes survive translation; the infrastructure ones collapse, because a caller can act on them identically.
- **One input bound, one rejection code.** `CREDENTIAL_MAX_LENGTH = 4096`; blank, whitespace-only, non-string and over-long all return `CREDENTIAL_STORE_INVALID_CREDENTIAL` with no vault call. The rejected value is never logged — only the reason.
- **`writeSettingSerialized` keeps the plan-literal `() => Promise<void>` signature**; the create path captures its outcome in a local initialised to a real failure. No generic parameter was needed and the function can never return an unset result.
- **The in-section re-read is the concurrency fix, and it is mutation-proved.** Without it, two concurrent callers each generate and write, and disagree.
- **A read-back mismatch is a failure, not an adoption.** Only a writer outside the chain could produce that state, so `SETTING_INSTALL_SECRET_UNVERIFIED` is reported and the divergent value is neither adopted nor overwritten.
- **Base64 helpers stay local to `Setting.ts`** rather than importing `EncryptedStorage`: the envelope codec would drag zod and the crypto graph into the storage module's import graph, inverting the layering for eight lines. The canonical-base64 rule is restated here.
- **The composed KeyVault case was added to the Setting suite** (within the plan's `files_modified`) because must-have #5 and 02-03's D5 both require the consumer loop to be proved, not asserted by convention.
- **The isolation scan includes the transitive re-export closure** — the D2-03 must-have names "any module that re-exports them", and a barrel would otherwise be a hole.

## Deviations from Plan

None — plan executed exactly as written, with two additive widenings recorded under Decisions rather than as deviations:

1. `CREDENTIAL_MAX_LENGTH`, the `CredentialVaultLike`/vault-result types and the `VAULT_CODE_MAP` are exported beyond the plan's named artifact list (the plan's artifact table names the interface, the unions, `CredentialVaultLike` and the factory; the extra exports are what the suite asserts against and what Phase 3 needs to type a fake).
2. The Setting suite carries two composed-KeyVault cases the plan's Task 2 action did not enumerate — the plan's own must-have #5 and 02-03's D5 coverage item require the consumer loop to be proved.

Neither touches a file outside `files_modified`, adds a dependency, or changes a plan-named symbol's contract.

## Issues Encountered

- **The Phase-1 suite `tests/services/providerValidationFixtures.test.ts` is titled "exports CredentialStorePort as a type with no implementation and no call site".** Its assertion is narrower than its title: it walks `src/` for the *string* `CredentialStorePort` outside the port file and expects zero hits — a call-site assertion, not an implementation one. It still passes (the port file is excluded from its own walk, and no other `src/` file names the type), and its continued greenness is exactly D2-01/D2-04's "no Phase 2 UI path calls the port". Recorded for the phase acceptance review: the title is now stale and the plan did not authorise editing that file.
- **Two `tsc` errors were found only by running the whole-repo type check, not by the suite.** Both were test-side: object literals in fake-vault overrides widened `ok: false` to `boolean` (fixed with explicit `as CredentialVaultResult` / `as CredentialVaultRetrieveResult` casts) and the chrome `storage.local.get` generic signature needed a plain-record cast for the read-back stub. Both fixed before the task commit; `tsc --noEmit` is clean.
- **The suite's `set` spy counts a real behavioural claim.** The concurrent case asserts exactly one write for the key — which is what distinguishes "serialised + re-read" from "serialised only". It is the assertion that fails under the mutation probe.
- Pre-existing untracked planning artifacts (`.gsd/`, `.planning/milestone.lock`) were left untouched — outside this plan's scope.

## Known Stubs

None. Both modules are fully wired into the paths their suites exercise: the port delegates to a real `KeyVault` in the composed case, and `readInstallSecret` is the vault's actual injected dependency. No placeholder values, no TODO/FIXME markers, no empty-collection defaults, and no branch that returns a fabricated value.

## Threat Flags

None. Every surface this plan introduced was already in the plan's `<threat_model>` (T-02-18 component→vault import, T-02-19 blank-credential overwrite, T-02-20 port error disclosure, T-02-21 install-secret race, T-02-22 malformed install secret) and each has a passing assertion — T-02-18 and T-02-21 with an observed red. No new network endpoint, auth path, file access pattern or trust-boundary schema change was added, and no package was installed (T-02-SC).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 3 inherits the frozen contract.** `createCredentialStorePort(createKeyVault({ readInstallSecret }))` is the production wiring: the vault's injected secret provider is `Setting.readInstallSecret` as written, with no adapter module. The port's code union is the set Phase 3's re-entry flow branches on.
- **02-12 (Suite B)** can build its synthetic-only `CredentialStorePort` support against `CredentialVaultLike` (wide `code: string` arms) or against the port interface (narrow codes) — both are exported, and a fake vault needs no crypto.
- **02-13's corrected `verify:phase-2`** already enumerates `tests/core/security` and `tests/core/storage`, so both new suites resolve under the gate's path preflight.
- **No Phase 2 UI path calls the port** (D2-01/D2-04): the only call site in the repository is the composed test in `Setting.test.ts`, and the Phase-1 no-call-site assertion in `tests/services/providerValidationFixtures.test.ts` still passes.
- **Open item for the phase acceptance review (not a blocker):** that Phase-1 suite's title ("no implementation") is now stale — its assertion is about call sites and remains true; the file was out of this plan's scope.

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 4 files exist on disk: the extended port, `Setting.ts`, and both suites.
- Both task commits exist in history: `789be55b` (Task 1), `b72024ed` (Task 2).
- Measured commit count at SUMMARY write time (`git rev-list --count ea221d91..HEAD`): 2 task commits, base recorded as `plan_head_before`.
