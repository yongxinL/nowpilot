---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 10
subsystem: storage-security
tags: [d-07, legacy-plaintext-credentials, in-place-deletion, idempotent-migration, redacted-report, sentinel-absence, throw-free-totality, schema-version-stamp, cycle-safe, background-wiring, neutral-notice, onboarding-record-field, operation-decision, one-way, tdd]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-09's `np_onboarding` completion record and its total throw-free migration (the notice's shown-state is a field on that record, and the v1 upgrader follows its migration idiom)
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-04's canonical string map — `provider.credentialsCleared` and `provider.credentialsClearedDismiss` (already pinned, no key added here)
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-07's removal-only startup-helper pattern in the background (install/startup handlers exist and are documented)
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-06's D-13 registration contract (the three registrations the cleanup extends rather than adding a fourth)
provides:
  - "`LEGACY_SECRET_FIELDS` — the six recognised legacy plaintext credential names (`apiKey`, `token`, `accessToken`, `secret`, `openAiKey`, `geminiKey`); the complete deletion surface"
  - "`CLEANUP_SCHEMA_VERSION` — the plaintext-cleanup schema version, stamped as `plaintextCleanupSchemaVersion` on a sanitised record"
  - "`sanitizeLegacyProviderConfig(raw)` — rebuilds a provider record without ever reading a matched key's value; names-only sorted/deduplicated report; short-circuits a stamped record; cycle-safe and total"
  - "`runLegacyCredentialCleanup()` — destroys the stored legacy credentials in place, writes back only when a removal occurred, logs field names only, guards chrome at call time and never throws"
  - "The background wiring: the cleanup runs first inside the existing onStartup and onInstalled handlers (no fourth registration)"
  - "`legacyCleanupNoticeShown` on the onboarding record (schema v2 with a v1 upgrader) — D-07's notice shown-state as a record field, never a second key"
  - "`LegacyCredentialCleanupNotice` — the single dismissible neutral notice, mounted by both surface roots"
  - "The operator decision record `D-01-10-1` and the change-control record `C-01-10-A` in `01-MIGRATION-INVENTORY.md` § Change control"
affects: [01-11, 01-13, 02]

actuals:
  tokens: 11914   # chars/4 over the realized diff (git diff -U0 a98df514..HEAD -- src tests = 47,655 chars)
  tasks: 3
  commits: 6      # MEASURED: git rev-list --count a98df514..HEAD (decision, RED, GREEN, background, notice, inventory reconciliation)
  plan_head_before: a98df51459d7e43c86f63b1fc0dfdab851b3d6f3

tech-stack:
  added: []
  patterns:
    - "Destroy, never derive: a matched key's **value is never read** — the sanitised record is rebuilt around it, so no hash, fingerprint, mask, length, prefix or suffix can exist to leak"
    - "Idempotence by stamp, not by convention: a sanitised record carries the cleanup schema version and a second run returns it unchanged with an empty removal list"
    - "One deletion surface: `LEGACY_SECRET_FIELDS` is the complete set of names the migration may delete, so an unrecognised field is structurally safe"
    - "A migration that never throws: non-records return untouched, cyclic nodes are dropped rather than re-linked, and the runner's whole body is wrapped so a rejected storage write is a typed `{ ok: false, code }` rather than a rejection"
    - "Write-back only on a removal: a clean record is never rewritten, so the migration cannot churn storage on every service-worker wake"
    - "A one-time notice discloses nothing: the pinned neutral copy is shown once per record regardless of what the cleanup found, so its appearance carries no found/not-found signal"
    - "A UI 'shown' flag lives on an existing record, never on a second key — and an added, safely defaulted record field ships with an upgrader from the previous schema version so it cannot re-present a completed flow"

key-files:
  created:
    - src/core/storage/legacyCredentialCleanup.ts
    - src/components/common/LegacyCredentialCleanupNotice.tsx
    - tests/core/storage/legacyCredentialCleanup.test.ts
    - tests/background/legacy-credential-cleanup-wiring.test.ts
    - tests/components/LegacyCredentialCleanupNotice.test.tsx
  modified:
    - src/entrypoints/background.ts
    - src/core/onboarding/onboardingStateStore.ts
    - src/entrypoints/sidepanel/main.tsx
    - src/entrypoints/standalone/main.tsx
    - tests/core/onboarding/onboardingStateStore.test.ts
    - .planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-MIGRATION-INVENTORY.md
    - .planning/WINDOWS.md

key-decisions:
  - "The operator's Option A was recorded before the first write: `D-01-10-1` in the inventory's change-control section carries the chosen option, the date, the affected requirements (`SA-08`, `CORE-01`), D-07, the two rejected options, the authorisation scope, and the explicit statement that deletion is one-way because no server-side, repository or env copy of a legacy key exists."
  - "The report is names-only by construction, deduplicated and sorted: one entry per recognised **name**, never one per occurrence, so a count of credentials cannot be inferred from the report either."
  - "The sanitiser rebuilds rather than mutates, and never reads a matched value: `clone[key]` is only assigned for keys that are not recognised, so the plaintext never enters the returned record, the report or a log."
  - "Idempotence comes from the stamp: a record already carrying `plaintextCleanupSchemaVersion === CLEANUP_SCHEMA_VERSION` short-circuits the walk, which is also the T-1-53 mitigation that keeps a service-worker wake cheap and side-effect-free."
  - "Cyclic inputs are dropped rather than re-linked (`undefined` for a revisited node), so the sanitised value and the report are always serialisable — a cycle would otherwise make `JSON.stringify` throw in the runner and abort the cleanup with the secret still stored."
  - "The `np_store` blob is sanitised whole (the deep walk reaches `state.config.providers[*].apiKey`, `state.config.openAiKey` and `state.config.geminiKey`) and written back as the same JSON string shape the adapter stores."
  - "The notice is shown once **unconditionally** (unless the record says already shown), never conditioned on `found`: a notice that appeared only when a credential was deleted would disclose that a credential existed, which D-07 forbids. The notice path consequently reads no cleanup result at all — `runLegacyCredentialCleanup` returns only `{ ok: true }`."
  - "The notice's shown-state is a field on the existing `np_onboarding` record (`legacyCleanupNoticeShown`) — one key, one writer — and the record's version moved to 2 with an explicit v1 upgrader, because rejecting v1 for an additive defaulted field would re-present the onboarding flow to a user who had just completed it."
  - "The notice is a non-stacking Modal: an inline banner in either surface root would have pushed a fixed-height shell past its 100 vh container, so the notice renders over the surface instead, and both roots mount it only after the onboarding gate has settled so the two modals can never stack."
  - "`Dismiss` is the only exit (no close button, no Escape, no mask click), so the shown-state can never be skipped without being recorded."

patterns-established:
  - "A destructive migration is authorised in writing before it runs: the operator decision record precedes the first write and states its one-way character and its blast radius"
  - "A security suite asserts absence with the repository's synthetic sentinel across every storage area, the serialised report, the sanitised output and the log buffer — and pairs each absence with a presence assertion so it cannot pass vacuously"
  - "A source-level probe checks for derived-value primitives (hashing, digests, prefix extraction) because the property 'no derived value exists' cannot be proven from runtime behaviour alone"

requirements-completed: [SA-08, CORE-01]

coverage:
  - id: D1
    description: "The in-place deletion of the prototype's plaintext provider credentials is authorised in writing, with the chosen option, the date, the affected requirements, the rejected alternatives and the explicit one-way statement recorded in the inventory's change-control section."
    requirement: "SA-08"
    verification:
      - kind: other
        ref: "01-MIGRATION-INVENTORY.md § Change control → decision record `D-01-10-1` (chosen option A, date 2026-09-21, `SA-08`/`CORE-01`, D-07, Option B/C rejected, one-way rationale, authorisation scope)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`sanitizeLegacyProviderConfig` deletes only the six recognised credential names, preserves every authorised non-secret field, returns a names-only report, stamps the cleanup schema version, is idempotent and is total for non-records and cycles."
    requirement: "SA-08"
    verification:
      - kind: unit
        ref: "tests/core/storage/legacyCredentialCleanup.test.ts (15 cases: field set, removal + preservation, nested and top-level removal, names-only report with the report's key set pinned, idempotence with deep-equal output, the version stamp, the clean-record no-op, totality for six non-record shapes plus the stamped empty object, cyclic-input serialisability)"
        status: pass
      - kind: other
        ref: "Derived-value probe over the committed module (`createHash`, `crypto.subtle`, `.slice(0,`, `substring(0,`, `btoa(`, `fingerprint`, `maskKey`) prints `ABSENT`"
        status: pass
    human_judgment: false
  - id: D3
    description: "`runLegacyCredentialCleanup` destroys the stored credential in place and relocates it nowhere: it writes back only when a removal occurred, guards chrome at call time, logs field names only and reports a typed failure instead of throwing."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "tests/core/storage/legacyCredentialCleanup.test.ts (sentinel absent from the persisted store, session storage, both per-origin stores, the log buffer and the report after a simulated run; `set` not called for a clean record; soft success with no chrome storage; total for a missing key and unparseable JSON; typed failure on a rejected write)"
        status: pass
      - kind: other
        ref: "`grep -rn \"createObjectURL|sendMessage.*sanit|publish.*cleanup\" src/core/storage src/entrypoints` reads 0 — nothing broadcasts or exports the configuration"
        status: pass
    human_judgment: false
  - id: D4
    description: "The cleanup is part of the background's documented registration contract: it runs first inside the existing install and startup handlers, no fourth registration is added, and the contract comment still describes what is registered."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "tests/background/legacy-credential-cleanup-wiring.test.ts (4 cases: the import, two fire-and-forget invocations and nowhere else, cleanup-before-onboarding in both handlers, exactly two `chrome.runtime.on*` registrations)"
        status: pass
      - kind: other
        ref: "`grep -n \"runLegacyCredentialCleanup\" src/entrypoints/background.ts | wc -l` reads 3; `npx vitest run tests/background tests/core/storage tests/core/onboarding` green"
        status: pass
    human_judgment: false
  - id: D5
    description: "The only user-visible output is one dismissible neutral notice: the pinned `provider.credentialsCleared` copy, the pinned `Dismiss` label as the only exit, the shown-state on the existing onboarding record with no second key, and no reference to any cleanup result or credential field."
    requirement: "SA-08"
    verification:
      - kind: unit
        ref: "tests/components/LegacyCredentialCleanupNotice.test.tsx (5 cases) + tests/core/onboarding/onboardingStateStore.test.ts (19 cases: the field's default, the dismissal write with one key, the v1 upgrade, the record's key set)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The notice is observed once in a real Chrome MV3 build — seeded legacy credential, reload, notice appears once and is dismissible, the stored field is gone, no part of the value is displayed, a second reload shows no notice."
    requirement: "SA-08"
    verification:
      - kind: manual_procedural
        ref: "01-VALIDATION.md manual row for D-07, item 5 of plan 01-13; logged as an unrun verify in .planning/WINDOWS.md (id 15)"
        status: pending
    human_judgment: true
    rationale: "jsdom proves the copy, the exit and the shown-once behaviour against a mocked storage area, but whether the notice actually presents once in the built extension — and that the seeded plaintext field is gone in real `chrome.storage.local` — is operator-observed evidence owned by the phase acceptance plan."

# Metrics
duration: 11min
completed: 2026-09-21
status: complete
---

# Phase 1 Plan 10: In-Place Deletion of the Legacy Plaintext Credentials Summary

**The prototype's plaintext provider credentials are destroyed in place by an idempotent, throw-free, version-stamped migration whose report and logs carry field names only — nothing is relocated, hashed or derived — and the only user-visible output is one dismissible neutral notice whose shown-state lives on the existing onboarding record**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-21T22:19:37Z
- **Completed:** 2026-09-21T22:30:24Z
- **Tasks:** 3 (Task 1 was a checkpoint:decision, resolved by the operator before the first write)
- **Files modified:** 10 tracked source/test paths across 5 plan commits (1,033 insertions / 10 deletions), plus the inventory and the broken-windows ledger

## Accomplishments

- **The destructive step was authorised in writing before anything was deleted.** Task 1's `checkpoint:decision` was rated one-way, and the operator chose **Option A — delete in place now (D-07 as written)**. The resolution is recorded as `D-01-10-1` in `01-MIGRATION-INVENTORY.md` § Change control with the decision, the date, the affected requirements (`SA-08`, `CORE-01`), D-07, both rejected alternatives, the authorisation scope, and an explicit statement of why the decision is one-way: the removed values exist only in the client, and there is no server-side, repository or environment-variable copy to reconstruct them from. Option B (leave them for Phase 2) and Option C (wipe the whole provider configuration, destroying metadata D-07 requires be preserved) are recorded as rejected.
- **Deletion is by construction, not by convention.** `LEGACY_SECRET_FIELDS` is the complete set of recognised names — `apiKey`, `token`, `accessToken`, `secret`, and the two top-level legacy key fields `openAiKey` / `geminiKey` — and `sanitizeLegacyProviderConfig` **rebuilds** the record, assigning a value only for keys that are not recognised. A matched key's value is never read, so no digest, fingerprint, mask, length, prefix or suffix can exist to leak (T-1-48/49/50); the report carries sorted, deduplicated field **names** only.
- **Idempotence is a stamp, not a promise.** A sanitised record carries `plaintextCleanupSchemaVersion`, and a second run short-circuits the walk and returns deep-equal output with `found: false` and `removedFields: []`. The runner writes back **only** when a removal occurred, so a clean record is never rewritten and a repeated service-worker wake stays cheap and side-effect-free (T-1-51/53).
- **The migration is total and cycle-safe.** `null`, `undefined`, `{}`, an array, a string, a number and a cyclic object each return a safe result with an empty removal list and no throw; a revisited node is dropped rather than re-linked, so the sanitised value and the report are always serialisable (a cycle would otherwise make the runner's `JSON.stringify` throw and abort the cleanup with the secret still in storage).
- **Nothing is relocated.** The sentinel-backed suite proves the credential is absent from the serialised report, the sanitised output, the log buffer, the persisted store, session storage and both per-origin stores after a simulated run, and the plan's grep confirms nothing broadcasts or exports the configuration.
- **The cleanup is part of the background's documented contract, not a fourth registration.** It runs fire-and-forget inside the existing `onStartup` and `onInstalled` handlers, **before** the onboarding migration, and exactly two `chrome.runtime.on*` registrations remain. The D-13 comment block now describes install/startup migrations as registration (3) and says the cleanup extends them.
- **One neutral notice, disclosing nothing.** `LegacyCredentialCleanupNotice` renders the pinned `provider.credentialsCleared` copy with the pinned `Dismiss` label as its only exit, reads **no** cleanup result (the runner returns only `{ ok: true }`), and is shown once per record regardless of what the migration found — so its appearance cannot reveal whether a credential existed (T-1-52). Its shown-state is a field on the existing `np_onboarding` record, marked on dismissal; a comment-stripped source scan asserts the component names no credential field and reads no cleanup result.
- **The record change is migration-safe.** `ONBOARDING_SCHEMA_VERSION` moved to 2 and a v1 record is explicitly upgraded by defaulting the new field, because rejecting v1 for an additive field would re-present the onboarding flow to a user who had just completed it.

## Task Commits

Task 2 is `tdd="true"`, so it carries its RED then GREEN commit:

1. **Task 1: the operator decision record (`D-01-10-1`)** — `ae01afae` (docs)
2. **Task 2 RED: the failing 15-case cleanup suite + declaration-only skeleton** — `0dabc825` (test) — 15 collected, 9 failed, 6 passed
3. **Task 2 GREEN: the idempotent, redacted, throw-free cleanup** — `962d0718` (feat) — 15 passed
4. **Task 3a: background wiring (install + startup)** — `76d6e345` (feat)
5. **Task 3b: the neutral notice and the record field** — `c87bcdc8` (feat)
6. **Plan metadata: inventory reconciliation, change control, windows ledger** — `402c76fa` (docs)

**Plan metadata:** the SUMMARY itself is committed separately as `docs(01-10): complete … plan`.

## Files Created/Modified

- `src/core/storage/legacyCredentialCleanup.ts` — **new**: `LEGACY_SECRET_FIELDS`, `CLEANUP_SCHEMA_VERSION`, the cycle-safe total `sanitizeLegacyProviderConfig`, and `runLegacyCredentialCleanup` (guarded chrome access, write-back only on a removal, names-only `debugLog`, typed failure).
- `src/components/common/LegacyCredentialCleanupNotice.tsx` — **new**: the single dismissible neutral notice; pinned copy, pinned `Dismiss` as the only exit, shown-state written to the existing onboarding record.
- `src/entrypoints/background.ts` — the cleanup imported and invoked first in both the `onStartup` and `onInstalled` handlers; the registration-contract comment extended.
- `src/core/onboarding/onboardingStateStore.ts` — `legacyCleanupNoticeShown` added to the record, `ONBOARDING_SCHEMA_VERSION` 1 → 2 with a v1 upgrader, the field mapped in `migrateOnboardingState`.
- `src/entrypoints/sidepanel/main.tsx`, `src/entrypoints/standalone/main.tsx` — the notice mounted once the onboarding gate has settled, so the two modals never stack.
- `tests/core/storage/legacyCredentialCleanup.test.ts` — **new**, 15 cases.
- `tests/background/legacy-credential-cleanup-wiring.test.ts` — **new**, 4 cases (comment-stripped source scan).
- `tests/components/LegacyCredentialCleanupNotice.test.tsx` — **new**, 5 cases.
- `tests/core/onboarding/onboardingStateStore.test.ts` — 16 → 19 cases (the field's default, the dismissal write, the v1 upgrade, the widened key-set assertion).
- `01-MIGRATION-INVENTORY.md` — the `D-01-10-1` decision record, the `C-01-10-A` change-control record, two row status notes and the cleanup row flipped to `implemented`.
- `.planning/WINDOWS.md` — three entries appended (ids 15–17).

## Decisions Made

- **The sanitiser rebuilds around a matched key and never reads its value.** Reading then deleting would be one careless `clone[key] = node[key]` away from retaining the plaintext; not reading it at all makes the prohibition structural. The report is names-only, sorted and deduplicated so not even a credential *count* leaks.
- **Idempotence via the stamp.** `plaintextCleanupSchemaVersion` on the sanitised root is both the D-07 record-of-completion and the skip condition, which is what makes repeated wakes cheap (T-1-53).
- **A cycle is dropped, not re-linked.** Cyclic input would otherwise produce a non-serialisable value; the repo's inputs are JSON, so the only effect of the rule is on malformed input, where "safe and serialisable" beats "faithful and throwing".
- **The whole `np_store` blob is sanitised, not just `state.config`.** The deep walk reaches every recognised name wherever it sits (`state.config.providers[*].apiKey`, `state.config.openAiKey`, `state.config.geminiKey`) without a hand-written path, and the write-back preserves the adapter's string shape.
- **The notice is shown once unconditionally, and reads no cleanup result.** Any conditioning on `found` would disclose whether a credential existed (T-1-52). `runLegacyCredentialCleanup` returns only `{ ok: true }`, so the UI layer has no found/not-found distinction available to leak.
- **The shown-state is a record field, and the record version moved with an upgrader.** `legacyCleanupNoticeShown` lives on `np_onboarding` (one key, one writer); the schema went to 2 with an explicit v1 upgrade because an additive, safely defaulted field must not re-present a completed onboarding flow.
- **The notice is a Modal, not an inline banner.** Both surfaces are fixed-height shells (the Side Panel's header/composer/status bar are pinned at 52/44/28 px and the Standalone is a `Layout` at 100 vh), so a banner in the root would have pushed content past an `overflow: hidden` container. A centered Modal is layout-neutral; both roots mount it only once the onboarding gate has settled.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] The notice's home was outside the plan's declared file list**
- **Found during:** Task 3, reading the task's acceptance criteria against its `<files>` element
- **Issue:** Task 3 requires "the notice is rendered once, is dismissible through the pinned label, and its shown-state lives on the existing onboarding record rather than a new key", and the plan's verification section assigns the manual criterion to `01-13`. But neither the plan's `files_modified` list (`legacyCredentialCleanup.ts`, `background.ts`, the suite) nor the task's `<files>` (only `background.ts`) names a component, a record field or a surface mount — so the acceptance criterion had no implementation home, and `01-13`'s manual check would have had nothing to observe.
- **Fix:** the notice was implemented: `legacyCleanupNoticeShown` on the onboarding record (schema v2 + v1 upgrader), `src/components/common/LegacyCredentialCleanupNotice.tsx`, and a mount in both surface roots gated on the settled onboarding gate. Recorded as the change-control record `C-01-10-A` (six fields) in the inventory and as a `deviation` in the broken-windows ledger (id 16).
- **Files modified:** `src/core/onboarding/onboardingStateStore.ts`, `src/components/common/LegacyCredentialCleanupNotice.tsx`, `src/entrypoints/sidepanel/main.tsx`, `src/entrypoints/standalone/main.tsx`, plus two suites.
- **Verification:** `tests/components/LegacyCredentialCleanupNotice.test.tsx` (5 cases) and the extended `tests/core/onboarding/onboardingStateStore.test.ts` (19 cases).
- **Committed in:** `c87bcdc8`

**2. [Rule 1 - Instrument] The plan's derived-value probe cannot run as written**
- **Found during:** Task 2 verification, running the plan's second `<automated>` command verbatim
- **Issue:** the command builds its patterns with `new RegExp` from `'\\.slice(0,'`; the unescaped `(` makes the expression invalid, so the command dies with `SyntaxError: Invalid regular expression` before printing anything and can never satisfy its own `fails_when` ("anything other than `ABSENT`"). The intent is a substring presence check over the module.
- **Fix:** the same seven tokens are checked with substring presence (escaped, non-regex) — a strict superset of the intent — and the module was additionally reworded so its provenance comment names no probe token, so even a corrected run reads `ABSENT` for the right reason. The comment-strip-first idiom was kept in the suite's own scans. Logged as a `deviation` in the ledger (id 17).
- **Files modified:** `src/core/storage/legacyCredentialCleanup.ts` (comment wording only)
- **Verification:** the corrected probe prints `ABSENT` on the committed module.
- **Committed in:** `962d0718`

**3. [Rule 1 - Test precision] The totality case over-constrained the empty-object result**
- **Found during:** Task 2 GREEN, writing the implementation the RED suite asked for
- **Issue:** the RED case asserted `report.value` was **identical** (`toBe`) to the input for all six shapes. An empty object is a provider record, so it is sanitised and stamped — the correct behaviour is a *safe* value, not the identical reference, and the original assertion would have forced a special case purely to satisfy the test.
- **Fix:** the case now asserts identity for the five non-record shapes (`null`, `undefined`, an array, a string, a number) and pins the empty object's result explicitly (`{ plaintextCleanupSchemaVersion: 1 }`, empty removal list, no throw). The RED evidence commit is unchanged and still shows 9 failing cases.
- **Files modified:** `tests/core/storage/legacyCredentialCleanup.test.ts`
- **Verification:** the suite is 15/15 green.
- **Committed in:** `962d0718`

---

**Total deviations:** 3 auto-fixed (1 missing critical functionality, 2 instrument/test corrections).
**Impact on plan:** no dependency was added or bumped (`package.json` untouched), no Phase-2 capability was implemented (Phase 1 still holds no credential anywhere), and no file another plan owns was changed beyond the four the notice's acceptance criterion required (recorded as `C-01-10-A`). The deletion's scope is exactly what the operator authorised: the six recognised names, and nothing else.

## Issues Encountered

- **`window.getComputedStyle(elt, pseudoElt)` is not implemented in jsdom**, so AntD's scroll locker logs `Not implemented` errors when the notice's Modal mounts. The same known noise appears in the onboarding suite; the suite is green.
- **A `vi.spyOn` return type cannot be named for an overloaded API.** `chrome.storage.local.get` is overloaded, so the suite's `settleRead(getSpy)` helper takes `any` with the same explanatory comment `tests/core/ai/testProviderConnection.test.ts` uses for its `fetch` spy — `npx tsc --noEmit` then passes.
- **The `.output` build's `background.js` grew from ~5.5 kB to 6.8 kB** with the cleanup module in the service-worker graph (a single `debugLog` import; the store/React graph is still unaffected). `pnpm run build:ext` exits 0 and the manifest is unchanged (`sidePanel`/`storage`/`tabs`, no `content_scripts`, `connect-src 'none'`).

## Known Stubs

None — no placeholder value, empty collection or unwired data source was introduced. The notice renders a pinned string and a boolean; the cleanup is fully implemented and runs from the existing handlers.

**Broken-windows ledger:** three entries appended — id 15 (`unrun-verify`: the notice's real-Chrome observation, coverage D6, owned by `01-13` item 5 / `01-VALIDATION.md`), id 16 (`deviation`: the notice's scope addition, `C-01-10-A`), id 17 (`deviation`: the corrected derived-value probe). `open_count` 12 → 15; no entry was closed by this plan.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: stamp_volatility | `src/core/storage/legacyCredentialCleanup.ts` | The cleanup schema version is stamped on the persisted `np_store` blob root. zustand's `persist` rewrites that blob wholesale on the next store write, dropping the stamp — after which a later wake re-walks the record instead of short-circuiting. The re-walk is idempotent and side-effect-free (it writes nothing when nothing is found), so this weakens T-1-53's performance claim only, never its correctness; a later phase that wants a durable skip must stamp inside `state.config` (which survives hydration) rather than at the root. |
| threat_flag: notice_shown_on_record | `src/core/onboarding/onboardingStateStore.ts` | The D-07 notice's shown-state is a boolean on the onboarding record. It deliberately carries no found/not-found information, but it is still a persisted fact about the user's history; a reviewer reconciling D-06's "completion is distinct from credential storage" should note that this field records a *presentation*, not a deletion outcome (T-1-52 stays mitigated). |

## User Setup Required

None — no external service configuration, no dependency installed or bumped (`antd@6.5.2`, `@ant-design/x@2.9.0`, `@ant-design/x-markdown@2.9.0`, `@ant-design/icons@6.3.2` untouched), no environment variable introduced.

## Next Phase Readiness

- **`01-11` (prototype hosts and the credential strip)**: the code-level credential path is now dead-ended at the data layer — the stored blobs are cleaned at install/startup — but `01-11` still owns removing `apiKey` from `src/types/index.ts`, `src/store/useExtensionStore.ts` (the four `DEFAULT_CONFIG` `apiKey: ''` literals plus `openAiKey`/`geminiKey`), `src/components/OnboardingModal.tsx`, `src/components/options/OptionsPage.tsx` and `src/services/aiProvider.ts`, exactly as the inventory's rows assign. `legacyCredentialCleanup.ts` must not be deleted with them: it is the migration that cleans an *installed prototype's* data, and a user who installs this build over an older prototype only gets the cleanup at install/startup.
- **`01-13` (gates)**: four instruments to extend — (a) the derived-value probe (corrected form above) as a source-level gate over `src/core/storage/legacyCredentialCleanup.ts`; (b) the background-wiring scan (`tests/background/legacy-credential-cleanup-wiring.test.ts`) as the "no fourth registration" gate; (c) the notice's real-Chrome run (item 5, `01-VALIDATION.md` manual row, ledger id 15); (d) the sentinel-absence assertion as the pattern for any later migration that touches stored credentials.
- **Phase 2 (KeyVault)**: the deletion's one-way cost lands here — users whose credentials were removed re-enter them once secure storage exists. The `CredentialStorePort` from `01-09` is still a declaration only; this plan added no second holding place, no temporary key and no encryption, so Phase 2 owns the entire write path.
- **Phase acceptance review**: two recorded items — the scope addition `C-01-10-A` (the notice component, the record field and the schema bump to v2), and the corrected probe (ledger id 17, so the plan's literal command failing is not read as a derived-value path).

---

*Phase: 01-mv3-wxt-runtime-antd-shells-workspace*
*Completed: 2026-09-21*

## Self-Check: PASSED

- Files created (5 of 5): `src/core/storage/legacyCredentialCleanup.ts`, `src/components/common/LegacyCredentialCleanupNotice.tsx`, `tests/core/storage/legacyCredentialCleanup.test.ts`, `tests/background/legacy-credential-cleanup-wiring.test.ts`, `tests/components/LegacyCredentialCleanupNotice.test.tsx`.
- Files modified present (5 of 5): `src/entrypoints/background.ts`, `src/core/onboarding/onboardingStateStore.ts`, `src/entrypoints/{sidepanel,standalone}/main.tsx`, `tests/core/onboarding/onboardingStateStore.test.ts`.
- Commits present: `ae01afae`, `0dabc825`, `962d0718`, `76d6e345`, `c87bcdc8`, `402c76fa` (6 of 6, measured with `git rev-list --count a98df514..HEAD`).
- Fresh verification on the committed tree: `npx tsc --noEmit` exit 0; `npx vitest run` 41 files / 520 tests passed; `pnpm run verify:phase-1` green (502 tests + `verify-no-tailwind` exit 0); `pnpm run build:ext` exit 0 with an unchanged manifest; the corrected derived-value probe prints `ABSENT`; `grep -n "runLegacyCredentialCleanup" src/entrypoints/background.ts | wc -l` reads 3; the broadcast/export grep reads 0.
