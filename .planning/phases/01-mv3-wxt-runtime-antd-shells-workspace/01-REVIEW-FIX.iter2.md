---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
fixed_at: 2026-09-22T11:56:27Z
review_path: .planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-09-22T11:56:27Z
**Source review:** `.planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 10 (3 critical + 7 warnings; `fix_scope: critical_warning`)
- Fixed: 10
- Skipped: 0
- Every fix is committed atomically as `fix(01): …` on `aurora`; no source file is left modified or uncommitted.
- No gate was weakened: `NP_STRICT_CEILING` is still `0`, no test path was narrowed or deleted, no isolation/ceiling/banned-import case was relaxed, and no security assertion was softened. No dependency was added.

## Fixed Issues

### CR-01: A prototype-chain key as `type` throws inside envelope validation

**Files modified:** `src/core/runtime/RuntimeEnvelopeValidation.ts`, `tests/core/runtime/RuntimeEnvelope.test.ts`, `tests/background/message-bus-cold-start.test.ts`
**Commit:** 0814c6c6
**Status:** fixed
**Applied fix:** `isKnownEnvelopeType` and `schemaForType` now use own-property checks (`hasOwn`) instead of the `in` operator, and `schemaForType` is total (its unreachable fallback throws a typed `Error` rather than returning an inherited `Object.prototype` function). `'toString'`, `'constructor'`, `'valueOf'`, `'hasOwnProperty'` and `'__proto__'` now return `{ ok: false, error: 'ENVELOPE_UNKNOWN_TYPE' }` without throwing. Regression cases: five prototype keys in `RuntimeEnvelope.test.ts`, and a `MessageBus` listener case asserting the `chrome.runtime.onMessage` listener neither throws nor responds for such a message (fail-closed, no handler run).

### CR-02: The workspace handoff could never complete (`BroadcastBus` adds `_sender`)

**Files modified:** `src/core/runtime/BroadcastBus.ts`, `tests/core/workspace/WorkspaceHandoff.test.ts`
**Commit:** 34df48a8
**Status:** fixed: requires human verification
**Applied fix:** the transport's own echo-suppression field is stripped **before any listener runs** — `publish` still decorates (echo suppression is unchanged) and the receive path (`withoutTransportMetadata` + `isOwnEcho`) removes it, so a strict consumer schema never sees transport metadata. This is the single choke point every handoff caller routes through (`handoffTransport` → `BroadcastBus`), so the source's READY handling and the target's transfer handling are both fixed, not the test path. Regression test drives the **real** `handoffTransport.publish` across two live `BroadcastBus` instances (the two extension documents; no `__broadcast` injection, no publish spy) and asserts the projection is applied **and** acknowledged, plus that the received envelope validates and carries no `_sender`.
**Verified against the pre-fix source:** the new test fails (readiness never validates → `WORKSPACE_HANDOFF_FAILED` after the bounded wait) with `BroadcastBus.ts` reverted, and passes with the fix.
**Why human verification:** the round trip is proven through the real publish→validate path in jsdom (delivery deferred by one microtask to model the real queued `BroadcastChannel` task). The cross-document handshake in real Chrome still needs the acceptance re-observation below.

### CR-03: The Notes page crashes when the last note is deleted

**Files modified:** `src/components/notes/NotesWorkspace.tsx`, `tests/components/pages/notes-page.test.tsx`
**Commit:** c8e00b17
**Status:** fixed
**Applied fix:** the selected note is nullable (`?? notes[0] ?? null`), the more-menu handler returns early when there is no selection, and the main canvas panel (header, meta, sections, inspector) renders only when a note is selected — otherwise an explicit `data-testid="np-page-notes-empty"` empty state. A `data-testid` on each note card makes the delete path drivable in tests. The regression test deletes all five fixture notes through the real hover `Popconfirm` chain and asserts the empty state renders instead of `shell.errorTitle`.
**Verified against the pre-fix source:** with the original `|| notes[0]` restored, the test fails with the reported `TypeError: Cannot read properties of undefined (reading 'title')`.

### WR-01: `verify-no-tailwind.sh` was blind to `className={variable}`; three live Tailwind strings shipped

**Files modified:** `scripts/verify-no-tailwind.sh`, `tests/isolation/no-tailwind-gate.test.ts` (new), `src/core/theme/ThemeConfig.ts`, `src/components/notes/NotesWorkspace.tsx`, `src/components/standalone/WriteHistoryDrawer.tsx`
**Commit:** 8059941e
**Status:** fixed
**Applied fix:** the gate instrument was rebuilt to scan **string values**, not `className=` attributes — every single-quoted, double-quoted and backtick literal in `src/**/*.{ts,tsx}` is matched against a Tailwind-shaped vocabulary with a token boundary (so `var(--font-sans)`, `fixture-wh-1`, `border-color`, `space-between` and `to-do` are not false positives), plus whole-string `group`/`peer`. The three live strings are gone: the notes tag swatch and related-note swatch use inline colours, the inert `className="group"` was removed, and `previewGradient` is now a plain CSS gradient. The gate refuses to report a pass for a missing scan root. A self-test runs the real script against fixture trees and proves it still fails on `className={variable}` whose value is `'text-emerald-500'`, still fails on a bare `group`, and passes a legitimate AntD/CSS-var tree.
**Verified:** the rebuilt gate reported all 11 pre-existing leak occurrences before the string fixes (`EXIT=1`) and reports `0` after (`EXIT=0`); the self-test passes.

### WR-02: A malformed `np_store` blob was silently discarded and overwritten with defaults

**Files modified:** `src/store/useExtensionStore.ts`, `tests/core/store/useExtensionStore.test.ts`
**Commit:** 395ef300, a92060b2
**Status:** fixed
**Applied fix:** the merge path (which every hydration passes through — zustand only runs `migrate` on a version mismatch, so the migration alone could not cover this) normalises `sessions`, `prompts`, `writeHistory`, `notes`, `activeSessionId` and `config`, so a number/string/object where a list belongs no longer reaches `computeActiveSession`. The valid part of the blob survives instead of the whole blob being dropped. A non-record `config.providers` falls back to the default catalogue (never to an empty map), so the provider grid and the model lookups keep the record shape `ProviderConfig` types. `onRehydrateStorage` now logs `NP_STORE_REHYDRATE_FAILED` so a future shape regression is visible.
**Verified against the pre-fix source:** the regression test hydrates a malformed blob through the real persist path and fails pre-fix (`expected 'http://localhost:12380/v1' to be 'https://probe.example/v1'` — the whole blob was discarded and the store stayed at the module defaults), passes post-fix. The provider-map refinement was proven the same way against `395ef300` (`expected 'string' to be 'object'`).

### WR-03: `themeMigrate` injected a non-union `mode`/`pack` from a corrupt blob

**Files modified:** `src/core/theme/ThemeStore.ts`, `tests/core/theme/ThemeStore.test.ts`
**Commit:** da56e7bb
**Status:** fixed
**Applied fix:** the migration narrows instead of casting — `isThemeMode` (the canonical guard every other reader already uses) for `mode`, string checks for `colorTheme`/`pack`, defaults otherwise. A corrupt blob (`mode: 'purple'`, `pack: 7`, numeric values) can no longer reach `getAntdConfig`, `applyThemeDom`, `cycleThemeMode` or the Options select.

### WR-04: The Options page asserted a false credential-storage claim

**Files modified:** `src/components/options/OptionsPage.tsx`, `tests/components/pages/options-page.test.tsx`
**Commit:** 946ee0ef
**Status:** fixed
**Applied fix:** the "stored locally in your browser … never sent elsewhere" sentence is replaced by the pinned fixture disclosure `t('deferred.reasonFixture')`. Phase 1 stores no credential (D-08) and D-07's cleanup destroys the prototype's plaintext keys, so the sentence fabricated a security property on a fixture page (hard rule 3). A regression case asserts neither phrase can return.

### WR-05: The Standalone top-bar Back button was enabled, inert and unmarked

**Files modified:** `src/components/standalone/StandaloneShell.tsx`, `tests/components/StandaloneShell.test.tsx`
**Commit:** c2e03246
**Status:** fixed
**Applied fix:** the chevron is part of the UI-SPEC's pinned 56 px top-bar composition, so it is kept but rendered `disabled` + `data-np-backing="deferred"` with the same pinned deferred disclosure (`deferred.reasonDeferred`) the adjacent global search field uses — hard rule 1 satisfied without inventing an owning-phase attribution the spec does not pin. A rule-1 case asserts `disabled` + marker + `aria-label`, and the marking-discipline case now enumerates all three marked regions by test id instead of asserting an anonymous count.

### WR-06: `openOptions` deduped with a query string inside a `chrome.tabs.query` match pattern

**Files modified:** `src/core/workspace/WorkspaceRouter.ts`, `tests/core/workspace/WorkspaceRouter.test.ts`
**Commit:** 189d8a5c
**Status:** fixed: requires human verification
**Applied fix:** the query is by path (`standalone.html*`, exactly as `planStandaloneTarget` does) and the route is compared in the callback (`new URL(tab.url).searchParams.get('page') === 'options'`), so the focus branch can neither be dead (duplicate tabs, which D-12 forbids) nor focus a Chat/Write tab. Two cases: focus-existing without create, and create when only another route is open.
**Verified against the pre-fix source:** both new cases fail with the old pattern and pass with the fix.
**Why human verification:** `chrome.tabs.query` URL-pattern semantics are stubbed in jsdom; the real behaviour is confirmed by the manual re-observation below.

### WR-07: `composerDraft` was transported but never consumed, and the caller never supplied it

**Files modified:** `src/core/workspace/handoff/composerDraft.ts` (new), `src/core/workspace/WorkspaceRouter.ts`, `src/components/standalone/StandaloneWritePage.tsx`, `src/components/sidepanel/SidePanelShell.tsx`, `src/entrypoints/sidepanel/main.tsx`, `tests/core/workspace/WorkspaceRouter.test.ts`, `tests/components/pages/write-page.test.tsx`, `tests/components/SidePanelShell.test.tsx`
**Commit:** 4aa4d4d1
**Status:** fixed: requires human verification
**Disposition chosen:** **wire it end to end** (the phase's D-13 element is now a live path, not a validated-but-dead field). The producer exists after all — `SidePanelShell` owns a live composer textarea — so the shell reports every draft change to the surface root, which passes it to `openStandalone`; it rides the bounded projection (`.max(HANDOFF_DRAFT_MAX_CHARS)`, re-bounded at the consumption boundary) and the target's `apply` writes it into a new **memory-only** slot that the Standalone write composer consumes, both when the draft arrives after mount and when it is already present at mount. A handoff with no draft leaves the composer's own content untouched, so the Phase-1 "absent draft is an empty draft" rule still holds. The slot is never written to `chrome.storage.*`, the URL, `BroadcastBus`, a log, a diagnostic or an export (hard rule 4).
**Why human verification:** the acceptance record's draft-arrival observation must be re-observed in real Chrome (see below).

## Manual re-observation required (acceptance record)

The review's two record-level notes are flagged here rather than silently carried forward. **Do not treat the existing rows as evidence until re-observed:**

1. `01-VALIDATION.md:112` — the Standalone-handoff row states *"The composer draft typed in the panel arrived in Standalone"*. Before CR-02 the handshake could never complete and before WR-07 the draft was dropped, so that observation was not reproducible from the shipped code and must be **re-observed** in real Chrome (type a draft in the Side Panel composer → `Open Standalone view` → the draft is present in the Standalone Write composer, with a single Standalone tab and no read-only banner).
2. WR-06's Options-route behaviour was never manually observed: re-run *Open Options* twice and confirm the second invocation **focuses** the existing Options route and creates no duplicate tab, and that a Standalone tab sitting on another route is never focused in its place.

## Verification

Verification ran in the **main checkout** (the orchestrator's main-tree execution mode; no isolated worktree was created), on the committed tree, in this order:

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 (after every fix) |
| `npx vitest run` | 41 files / 532 tests passed (baseline: 40 files / 513 tests) |
| `pnpm run verify:phase-1` | exit 0 — declared-path preflight, `tsc`, the full phase test set, and `bash scripts/verify-no-tailwind.sh` |
| `pnpm run build:ext` | `wxt build` succeeded (`chrome-mv3`, manifest 777 B, background 6.89 kB, content chunk unchanged in kind) |
| `NP_STRICT_CEILING` | still `0` (`package.json`) — no `@ts-expect-error NP-STRICT-*` marker was added |

Per-fix evidence (beyond the always-required re-read): each behaviour-changing fix was additionally run against the **pre-fix** source to prove its regression test actually fails there — CR-02, CR-03, WR-02, WR-06 and WR-07 were all proven this way; CR-01 is proven by the prototype-key cases (pre-fix `TypeError`), and WR-01 by the gate reporting 11 occurrences before the string fixes. WR-03/WR-04/WR-05 are assertion-level and covered by their new cases.

Test additions (all inside the phase's declared test paths, none weakening an existing case):

- `tests/core/runtime/RuntimeEnvelope.test.ts`, `tests/background/message-bus-cold-start.test.ts` (CR-01)
- `tests/core/workspace/WorkspaceHandoff.test.ts` (CR-02 real-bus round trip)
- `tests/components/pages/notes-page.test.tsx` (CR-03)
- `tests/isolation/no-tailwind-gate.test.ts` (WR-01 gate self-test)
- `tests/core/store/useExtensionStore.test.ts` (WR-02), `tests/core/theme/ThemeStore.test.ts` (WR-03)
- `tests/components/pages/options-page.test.tsx` (WR-04), `tests/components/StandaloneShell.test.tsx` (WR-05)
- `tests/core/workspace/WorkspaceRouter.test.ts`, `tests/components/pages/write-page.test.tsx`, `tests/components/SidePanelShell.test.tsx` (WR-06/WR-07)

---

_Fixed: 2026-09-22T11:56:27Z_
_Fixer: the agent (gsd-code-fixer)_
_Iteration: 1_
