---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 04
subsystem: i18n
tags: [i18n, strings, copywriting-contract, ui-spec, appendix-b, antd-locale-overrides, deferred-namespace, interpolation]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-MIGRATION-INVENTORY.md (the frozen D-04 conversion map and the `src/core/i18n/strings.ts` row this plan implements)
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-02's shells + suites, which resolve every expectation through `t('…')` and were the standing consumers of the keys this plan lands
provides:
  - The canonical Phase-1 string map — every user-visible Phase-1 string resolves through one key in `src/core/i18n/strings.ts`
  - `format(key, params)` — total `{token}` interpolation, so `Step {n} of 4`, `Connection failed: {error}` and `This page arrives in Phase {phase}.` render from the map
  - The `deferred.*` namespace (`tag`, `fixtureTag`, `reasonDeferred`, `reasonFixture`, `phaseBody`) that `DeferredNotice` (01-12) consumes with no new copy
  - The four typed `provider.error.*` failure labels — the `{error}` slot values the onboarding validation matrix (01-09) interpolates
  - A frozen, side-effect-free module: two importers share one immutable table
  - `tests/core/i18n/strings.test.ts` — a 16-case copy-exactness, key-coverage and credential-shape gate proven non-vacuous
affects: [01-05, 01-07, 01-08, 01-09, 01-10, 01-11, 01-12, 01-13]

actuals:
  tokens: 7260    # chars/4 over the realized diff (git diff -U0 42846d3..HEAD -- src tests = 29,040 chars)
  tasks: 2
  commits: 2      # measured: git rev-list --count 42846d3..HEAD
  plan_head_before: 42846d3457152b84936beda2bdc7ed51765c32a8

tech-stack:
  added: []
  patterns:
    - "Copy is a contract: pinned values live in one frozen map, and exactness is a test rather than a review habit"
    - "`t()` degrades to the key name and `format()` degrades to a visible `{token}` — a missing key or param is loud, never `undefined` or an empty region"
    - "A string map carries its own credential-shape absence check (key prefix, assignment shape, 32+ character run) over every value, not a sample"
    - "Locale defaults are overridden explicitly at the map, so no framework default is reachable through a missing key"

key-files:
  created:
    - tests/core/i18n/strings.test.ts
  modified:
    - src/core/i18n/strings.ts
    - .planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-MIGRATION-INVENTORY.md (own row status only)

key-decisions:
  - "The `// LEGACY` block carries exactly the five prototype keys that still have a live `t()` consumer. Verified by grep, the files the plan names as consumers (`OnboardingModal.tsx`, `chat/**`, `options/**`, `standalone/**`) resolve no key through this module — they render inline literals — so conserving their namespace entries would have kept unreachable copy that claims capabilities the phase does not deliver (`chat.loading` = `Connecting to provider...`). Every prototype-only key without a consumer was dropped."
  - "`strings` is exported as `Object.freeze(...)` rather than staying module-private. The plan's own credential-shape and mutation-safety cases need the whole value set; enumerating only the required-key list would leave a future unreviewed key unchecked, which is exactly the gap T-1-16's gate exists to close. Freezing also makes the 'immutable table' claim literal instead of conventional."
  - "`onboarding.failed` is authored as `Connection failed: {error}` (planner assumption P2) and `deferred.phaseBody` as `This page arrives in Phase {phase}.` (P4). The UI-SPEC's bracket convention defines `[…]` as an action label, so the error slot could not use the bracketed form the UI-SPEC's table shows."
  - "`chat.error` is one key (`Provider error. [Retry] [Switch Provider]`) and `chat.retry` / `chat.switchProvider` were deleted. The UI-SPEC fixes the key shape now even though the consumer is Phase 15; a parallel second spelling is what its divergence table forbids. The suite proves the deletion by asserting both retired keys resolve to their own names."
  - "The suite asserts `a11y.closeDialog === 'Close'` (equality), not inequality, against AntD's default. The UI-SPEC pins `Close` — the same word AntD's `enUS` locale ships — so 'differs from the default' is unassertable; what makes it safe is that the key is explicitly present, which `t(key) !== key` proves."
  - "`app.name` and `common.back` sit in the LEGACY block even though the canonical shells consume them: `common.back` ('Back') has the same value as the canonical `onboarding.back`, but deleting it while `StandaloneShell` consumes it would render the literal `common.back` on screen. Their remount-or-remove disposition belongs to 01-12."

patterns-established:
  - "A pinned-copy table in the suite IS the required-key list: cases 1, 2 and 4 all enumerate it, so a sample can never stand in for the full set"
  - "Gate teeth are proved by deliberate-violation probes before the gate is trusted (here: `Connected!`, a `sk-…` value and a restored `chat.retry` each fail the suite)"
  - "Interpolation carriers are an explicit allow-list, and the no-unrendered-`{` scan runs over every key in the map rather than the required subset"

requirements-completed: [CORE-01]

coverage:
  - id: D1
    description: "The canonical Phase-1 string map: every UI-SPEC-pinned key resolves to its pinned value verbatim (shells, states, errors, onboarding titles/bodies/actions, typed validation labels, accessible names, palette chrome, `deferred.*`, common, destructive confirmation)."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "tests/core/i18n/strings.test.ts#resolves every canonical Phase-1 key to its pinned UI-SPEC value (+ 'pins the shell/state/error copy and the onboarding action labels verbatim')"
        status: pass
      - kind: other
        ref: "node -e required-key presence probe over src/core/i18n/strings.ts → ALL_PRESENT (35 keys)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`format(key, params)` — total `{token}` interpolation that leaves an unsupplied token visible and never throws, plus the frozen-table purity guarantee."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "tests/core/i18n/strings.test.ts#substitutes every {token} occurrence / #leaves an unsupplied token visible … / #is total … / #shares one immutable table across two concurrent imports / #cannot be mutated …"
        status: pass
    human_judgment: false
  - id: D3
    description: "The copy-exactness and coverage gate itself: a non-vacuous 16-case suite that fails on a divergent value, a self-resolving key, an unrendered `{`, a reachable locale default or a credential-shaped value."
    requirement: "CORE-01"
    verification:
      - kind: unit
        ref: "tests/core/i18n/strings.test.ts (16 passed); deliberate-violation probes: `Connected!` → 4 failed, a `sk-…` map value → 1 failed, restored `chat.retry` → 1 failed, clean tree → 16 passed"
        status: pass
      - kind: integration
        ref: "npx vitest run tests/components tests/core → 18 files / 181 tests passed (165 baseline + 16 new, no consumer regressed)"
        status: pass
      - kind: other
        ref: "npx tsc --noEmit → exit 0, zero `error TS`"
        status: pass
    human_judgment: false
  - id: D4
    description: "The copy the UI-SPEC does not pin and the planner authored: the four onboarding step bodies (P1), the `{error}` token form of `onboarding.failed` (P2), the four typed `provider.error.*` human labels (P3), and `deferred.phaseBody` (P4)."
    requirement: "CORE-01"
    verification: []
    human_judgment: true
    rationale: "These eight strings are planner-authored because the UI-SPEC pins step titles but not step bodies, the typed validation codes but not their human text, and four `deferred.*` keys but not the phase-naming panel body. No automated check can confirm the operator accepts the wording — the plan flags all four as operator-visible assumptions, and the operator is the only authority for copy the contract leaves open."

# Metrics
duration: 5min
completed: 2026-09-21
status: complete
---

# Phase 1 Plan 04: Canonical Phase-1 String Map Summary

**The canonical Phase-1 copy contract landed as one frozen string map with total `{token}` interpolation, a 16-case copy-exactness gate, and the shells' key-fallback stubs resolved**

## Performance

- **Duration:** 5 min
- **Started:** 2026-09-21T12:18:57Z
- **Completed:** 2026-09-21T12:23:00Z
- **Tasks:** 2
- **Files modified:** 2 source files (535 insertions / 78 deletions across 2 commits), plus the plan's own inventory-row status

## Accomplishments

- **Every pinned Phase-1 string now has exactly one home.** The map carries 75 keys: the 68 canonical keys the UI-SPEC pins across its four tables plus seven legacy entries, five of which still have a live consumer. `t('onboarding.connected')` is `Connected` (no exclamation), `t('onboarding.testing')` carries three ASCII periods and no ellipsis glyph, and `t('onboarding.validate')` is `Check connection` rather than the prototype's `Connect Provider`.
- **Interpolation exists and is total.** `format(key, params)` replaces every `{token}` occurrence, leaves an unsupplied token visible rather than rendering `undefined`, and never throws on a missing key or an empty params object. `Step {n} of 4`, `Connection failed: {error}` and `This page arrives in Phase {phase}.` are now renderable from the map — they were not before.
- **The map is frozen and side-effect-free.** No Chrome access, no `fetch`, no storage read, no environment read; `Object.freeze` makes the immutability literal, so two concurrent importers share one table and a failed mutation attempt cannot change what the next resolve returns.
- **Copy exactness is a gate, not a habit.** The 16-case suite's value table *is* the required-key list (cases 1, 2 and 4 all enumerate it), and it was proved non-vacuous by three deliberate violations: `Connected!` fails 4 cases, a `sk-…`-shaped map value fails 1, and a restored `chat.retry` fails 1. The clean tree passes 16/16.
- **The map carries its own credential-shape absence check** (T-1-16): every value is scanned for a key-style prefix, an explicit credential assignment and a 32-or-more character unbroken alphanumeric run. The four `provider.error.*` labels describe the failure — `the provider rejected this key` — and never the credential.
- **The 01-02 hand-off stub is closed.** `chat.emptyBody`, `chat.noProvider`, `chat.composerPlaceholder`, `shell.errorTitle`/`Body`/`Reload`, all `a11y.*` and `standalone.minWidth` now resolve to canonical copy instead of their own key names; broken-windows entry 2 was marked fixed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the canonical Phase-1 string map and the `format()` helper** — `ec17b8c` (feat)
2. **Task 2: Copy-exactness and coverage gate** — `3a81a1c` (test)

**Plan metadata:** committed separately as `docs(01-04): complete … plan`.

## Files Created/Modified

- `src/core/i18n/strings.ts` — the canonical Phase-1 map (75 keys across eleven commented sections), the exported frozen `strings` record, `t()` with the `strings[key] ?? key` fallback retained, and the new total `format(key, params)`. Every divergence value the UI-SPEC corrections table names was replaced, not kept alongside: `Connected!`→`Connected`, `Skip Onboarding`→`Skip`, `Open in Full Tab`→`a11y.switchToFullChat`, `Something went wrong. Please reload the extension.`→`shell.errorTitle`/`Body`/`Reload`, `Failed to open Standalone view tab`→`standalone.openFailed`, and the two deprecated chat spellings deleted.
- `tests/core/i18n/strings.test.ts` — 16 cases in eight properties: value exactness (table-driven over all 68 canonical keys), shell/state/error + onboarding-action verbatim pins, copy hygiene (no trailing `!`, three ASCII periods), full required-key coverage plus the explicit-absence probe, interpolation (substitution, unsupplied token, totality), no unrendered `{` outside the three carriers, retired-spelling proof, divergence-value absence, locale-override pins, credential-shape absence, and module purity.
- `.planning/phases/01-…/01-MIGRATION-INVENTORY.md` — the `src/core/i18n/strings.ts` row's `Implementation status` set to `implemented`, with a status note recording that its "prune legacy keys in `01-11`" step now has nothing left to prune.

## Decisions Made

- **The `// LEGACY` block is exactly the five keys with a live `t()` consumer** (`app.name`, `common.back`, `agent.empty`, `options.loading`, `notes.empty`). Grep-verified: the files the plan names as consumers resolve nothing through this module — `OnboardingModal.tsx` and `CommandPalette.tsx` render inline literals — so conserving their namespace entries would have kept unreachable copy that makes claims the phase does not deliver (`chat.loading` = `Connecting to provider...`) and second spellings of canonical strings (`onboarding.step1` = `Meet NowPilot`, `onboarding.step3` = `Enter your API key`).
- **`strings` is exported and frozen.** The plan's credential-shape case asserts on "no value in the map"; without the record a future unreviewed key escapes the gate — the exact gap T-1-16 closes. `Object.freeze` also turns "nothing mutates `strings` after definition" from a convention into a property the suite asserts.
- **`chat.error` is one key, and the retired spellings are provably gone.** The suite asserts `t('chat.retry') === 'chat.retry'` and the same for `chat.switchProvider` — a deleted key's fallback is the proof of deletion, which is stronger than asserting absence from a private record.
- **`a11y.closeDialog` is asserted by equality, not inequality.** The UI-SPEC pins `Close`, the same word AntD's `enUS` locale ships, so "differs from the default it overrides" is unassertable for that key; explicit presence (`t(key) !== key`, which only holds when the key is in the map) is what carries the guarantee. The three overrides that genuinely differ (`OK`, `Cancel`, `Please select`) are asserted as inequalities.
- **`app.name` / `common.back` stay in LEGACY despite live consumers.** `common.back` duplicates the canonical `onboarding.back` *value*, but `StandaloneShell` resolves it today and a deleted key renders `common.back` on screen. Its disposition (and `app.name`'s) belongs to 01-12 with the shell.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] `strings` stayed private, so the plan's own credential-shape and mutation-safety cases could not be total**
- **Found during:** Task 2 (Copy-exactness and coverage gate)
- **Issue:** Task 2's case 6 asserts "no **value in the map**" carries a provider-key shape and case 7 asserts "nothing in the module mutates `strings`", but Task 1 kept `strings` module-private (only `t` exported). A test could only have checked the keys it enumerated — so any key added later would silently escape T-1-16's gate, which is precisely the failure mode the gate exists to prevent.
- **Fix:** `strings` is exported as `Object.freeze({...})` typed `Readonly<Record<string, string>>`; `t()` and `format()` read it. Both the credential-shape scan and the mutation attempt now run over the whole record.
- **Files modified:** `src/core/i18n/strings.ts`
- **Verification:** probe — inserting `'sk-probe-DO-NOT-LEAK-XYZ1234567890'` into the map fails `must not contain a key-shaped prefix`; `Object.isFrozen(strings)` is `true`; `Reflect.set(strings, 'chat.empty', 'tampered')` returns `false` and `t('chat.empty')` is unchanged.
- **Committed in:** `ec17b8c` (Task 1) and `3a81a1c` (Task 2)

**2. [Rule 1 - Bug] Task 2 case 4 counts "two interpolation carriers"; the map the plan mandates carries three**
- **Found during:** Task 2, authoring case 4
- **Issue:** The plan instructs "no Phase-1 key other than the **two** interpolation carriers contains a `{`", but Task 1's own required-key list pins three brace-carrying keys — `onboarding.stepIndicator` (`{n}`), `onboarding.failed` (`{error}`) and `deferred.phaseBody` (`{phase}`, added by planner assumption P4). A literal two-carrier assertion would have failed on a correct map.
- **Fix:** `INTERPOLATION_CARRIERS` enumerates all three, each carrier's token is asserted individually, and the "no unrendered `{`" scan runs over **every** key in the frozen record rather than the required subset — so a legacy key cannot hide a slot either.
- **Files modified:** `tests/core/i18n/strings.test.ts`
- **Verification:** probe — inserting a `{` into a non-carrier value fails the case; the clean tree passes with all three carriers allowed.
- **Committed in:** `3a81a1c` (Task 2)

**3. [Rule 1 - Bug] Task 2 case 5 requires `a11y.closeDialog` to differ from the AntD default, but the UI-SPEC pins that key to the default's own word**
- **Found during:** Task 2, authoring case 5
- **Issue:** The plan says to "assert `t('common.continue')`, `t('common.notNow')`, `t('onboarding.providerPlaceholder')` and `t('a11y.closeDialog')` all differ from the AntD locale defaults they override". The UI-SPEC pins `a11y.closeDialog` = `Close`, which **is** AntD's `enUS` default — deliberately, "so the value is explicit and translatable". The assertion as written is unsatisfiable against the contract the same plan cites.
- **Fix:** the case asserts the pinned value and explicit presence (`t(key) !== key` — only true when the key is in the map, i.e. never a locale fallback) for all four, and asserts *inequality* for the three overrides that genuinely differ (`OK`, `Cancel`, `Please select`). A comment records why `closeDialog` is the deliberate equality case.
- **Files modified:** `tests/core/i18n/strings.test.ts`
- **Verification:** probe — removing `a11y.closeDialog` from the map fails the explicit-presence assertion (`'a11y.closeDialog' === 'a11y.closeDialog'`); the clean tree passes.
- **Committed in:** `3a81a1c` (Task 2)

**4. [Rule 2 - Copy hygiene] The plan's "still consumed by" file list does not match the actual consumers**
- **Found during:** Task 1, before writing the LEGACY block
- **Issue:** The plan says the prototype keys "still consumed by `src/components/OnboardingModal.tsx`, `src/components/chat/**`, `src/components/options/**` and `src/components/standalone/**` must remain resolvable". Grep over `src/` shows **none** of those files resolve through this module — `OnboardingModal.tsx` renders hardcoded literals (`Skip for now`, `Connect Provider`, `Try again`) and so does `CommandPalette.tsx`. The real consumers are the two Phase-1 shells, `ErrorBoundary` and the four `pages/*` stubs, and they resolve canonical keys plus `app.name` / `common.back`.
- **Fix:** the LEGACY block carries exactly the five keys that have a live `t()` consumer. Every prototype-only key without a consumer was dropped, which simultaneously removed every divergence value, every second spelling of a canonical string, and the one remaining string that would claim a capability the phase does not deliver (`chat.loading` = `Connecting to provider...`). The plan's mandated LEGACY comment text is used verbatim.
- **Files modified:** `src/core/i18n/strings.ts`, `01-MIGRATION-INVENTORY.md` (own row status + note)
- **Verification:** `npx tsc --noEmit` exits 0 and `npx vitest run tests/components tests/core` is green at 181 passed — no consumer regressed, so no live key was deleted.
- **Committed in:** `ec17b8c` (Task 1)

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 missing critical functionality)
**Impact on plan:** All four were required for the plan's own gates to be meaningful or for its assertions to hold against the contract it cites. No scope creep: no dependency added or bumped, no key added beyond the pinned set, no other plan's file touched beyond this plan's own inventory row.

## Issues Encountered

- **The `{error}` slot could not use the UI-SPEC's bracketed form.** The UI-SPEC table shows `onboarding.failed` as `Connection failed: [error]`, but its own bracket convention defines `[…]` as an action label (`[Retry]`, `[Switch Provider]`, `[Reload]`, `[Configure]`). Authoring the slot as `[error]` would have made a component render it as a link or button. The plan resolves this as its own assumption P2 and authors `{error}`; the suite pins the resultant value and the substituted form.
- **Two legacy keys hold the same value as canonical keys by design.** `common.back` = `Back` equals `onboarding.back`, and `app.name` = `NowPilot` has no canonical counterpart. Both have live consumers, so neither can be deleted in this plan without rendering a raw key on screen; both are recorded in the LEGACY block and their disposition belongs to 01-12.
- **AntD's `enUS` default for the dialog close control is the word `Close`.** The "no framework default is reachable" property therefore cannot be asserted by inequality for `a11y.closeDialog`; explicit presence is the assertion that carries it (deviation 3).

## Known Stubs

None — the map is complete for every key Phase 1 reaches, the hand-off stub recorded against plan `01-02` (`.planning/WINDOWS.md` id 2) was marked `fixed`, and no placeholder value, empty collection or unwired data source was introduced.

## Next Phase Readiness

- **`01-09` (onboarding)** consumes `onboarding.*`, `provider.error.*` and `provider.credentialsCleared`/`Dismiss` directly; the four typed labels are the `{error}` slot values and `format('onboarding.failed', { error: t('provider.error.PROVIDER_AUTH') })` renders `Connection failed: the provider rejected this key`.
- **`01-12` (pages)** consumes `deferred.tag`, `deferred.fixtureTag`, `deferred.reasonDeferred`, `deferred.reasonFixture` and `deferred.phaseBody` verbatim — `DeferredNotice` needs no new copy — and owns the disposition of `app.name` / `common.back`.
- **`01-08` (palette)** owns command label/description metadata; only palette *chrome* lives here (`commands.placeholder`, `commands.noResults`, the three category labels). The category value `Appearance` for `commands.category.theme` is already canonical.
- **`01-11` (dev shell / dependency sweep)** no longer has legacy keys to prune: the only surviving prototype keys have live consumers owned by 01-12. The inventory row records this.
- **`01-13` (gates)** can extend `tests/core/i18n/strings.test.ts` rather than introduce a second copy gate; the suite's value table is the single source of the required-key list.
- **Every later plan adds copy by adding a key here** and extending the value table — a key that exists only at a call site resolves to its own name and is caught by the no-self-resolving case only if it is in the table, so the table must grow with the call site.

---

*Phase: 01-mv3-wxt-runtime-antd-shells-workspace*
*Completed: 2026-09-21*

## Self-Check: PASSED

- Files created (1 of 1): `tests/core/i18n/strings.test.ts`.
- Files modified (2 of 2 present): `src/core/i18n/strings.ts`, `01-MIGRATION-INVENTORY.md` (own row status).
- Commits present: `ec17b8c`, `3a81a1c` (2 of 2, measured with `git rev-list --count 42846d3..HEAD`).
- Exports verified in source: `strings` (frozen), `t`, `format` — three `export` statements at lines 23, 138, 150.
- Verification re-run on the committed tree: `npx tsc --noEmit` exit 0 with zero `error TS`; `npx vitest run tests/core/i18n/strings.test.ts` 16/16 passed; `npx vitest run tests/components tests/core` 18 files / 181 tests passed; required-key presence probe `ALL_PRESENT`.
