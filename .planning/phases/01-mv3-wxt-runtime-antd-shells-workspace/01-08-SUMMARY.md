---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 08
subsystem: command-palette-keyboard
tags: [keymap-registry, keymap-conflict, platform-primary-modifier, macos-chord, command-registry, command-palette, d-09, d-10, dev-only-destructive, bundle-elimination, token-discipline, 12px-floor, user-gesture, sa-10, tdd]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-04's canonical string map — `commands.placeholder`, `commands.noResults`, the three `commands.category.*` labels and `a11y.closeDialog`
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-05's `cycleThemeMode` (the single theme write path the `Toggle theme` command resolves through)
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: 01-02's relocated `src/entrypoints/{sidepanel,standalone}/main.tsx` roots and 01-12's shell/page dispositions (the surfaces this plan binds)
provides:
  - "`KeymapRegistry` repaired and tested: `PRIMARY_TOKENS`, `matchesKeymap`, `KeymapConflictError` (`KEYMAP_CONFLICT`), one `document` keydown listener attached on first register and detached on last unregister"
  - "`tests/core/input/KeymapRegistry.test.ts` — 15 cases: the macOS meta-key chord, the Windows/Linux control chord, strict Shift/Alt, the typed conflict code, the single-listener lifecycle, the swallow-and-continue handler rule and a `src/entrypoints` source scan with a negative control"
  - "The D-09 command set emitted from one module: Side Panel (`open-standalone-view`, `open-options`, `toggle-theme`) and Standalone (`focus-side-panel` plus the shared set), with the UI-SPEC labels/descriptions and resolved categories"
  - "The dev-only destructive `reload-extension`: inline `import.meta.env.DEV === true` gate, `destructive: true`, pinned confirmation copy — and zero occurrences in the built production bundle"
  - "`CommandPalette` token-clean and 12 px-floored: `token.colorPrimaryBg` selected row, `colorTextTertiary` category, held list height in the zero-result state, `t()`-resolved copy, `a11y.closeDialog` close name, `scrollIntoView`-kept selection, single-line/2-line clamping"
  - "The only global keyboard path: both surface roots bind `open-command-palette` (`Cmd+K`) through `KeymapRegistry.register`, returning both cleanups; no `addEventListener('keydown')` remains under `src/entrypoints`"
  - "`openSidePanelForCurrentTab` — the gesture-safe SA-10 opener (tabId variant from the `chrome.tabs.query` callback, no awaited window lookup, typed + logged failure, `sidepanel.openFailed` user-visible copy)"
affects: [01-11, 01-13, 02, 15]

actuals:
  tokens: 22774    # chars/4 over the realized diff (git diff -U0 c001070d..HEAD -- src tests = 91,095 chars)
  tasks: 3
  commits: 5      # measured: git rev-list --count c001070d..HEAD (RED, GREEN, Task 2, Task 3, bundle-fold fix)
  plan_head_before: c001070dc2d87e26695a730e9c779a5dfa90d698

tech-stack:
  added: []
  patterns:
    - "A chord token names the platform-primary modifier, never a physical key: `PRIMARY_TOKENS` resolves `Cmd`/`Command`/`Control`/`Meta` to one comparison against `metaKey || ctrlKey`"
    - "A duplicate binding is a typed refusal: `KeymapConflictError.code === 'KEYMAP_CONFLICT'` (§21.6), asserted on the error's code, its id-bearing message and the registry's unchanged single binding"
    - "One listener for the whole extension: attach on first register, detach on last unregister, and a source scan over `src/entrypoints` that fails if a keyboard listener returns — proven non-vacuous by a positive file-count control and a matcher self-test"
    - "A dev-only command is folded, not merely unreachable: the gate is written inline (`if (import.meta.env.DEV === true)`) so a production build drops the branch and the definition — verified by grepping the built bundle for zero occurrences"
    - "Destructive reachability is a UI contract, not a convention: `Command.destructive` routes the row through a pinned confirmation (`command.reloadExtension.confirm` + `common.continue`/`common.notNow`) so no match — partial or exact — can auto-run it"
    - "A gesture-gated Chrome call is issued from an API callback, never after an `await`: the tab id arrives in the `chrome.tabs.query` callback and the open call happens inside it"
    - "Typed failure at a Chrome boundary: every failure path (unavailable API, no active tab, rejected promise) logs a SCREAMING_SNAKE code and reports a `{ code, error }` union member to the surface"

key-files:
  created:
    - tests/core/input/KeymapRegistry.test.ts
    - tests/components/CommandPalette.test.tsx
  modified:
    - src/core/input/KeymapRegistry.ts
    - src/core/commands/registerWorkspaceCommands.ts
    - src/core/commands/CommandRegistry.ts
    - src/components/common/CommandPalette.tsx
    - src/entrypoints/sidepanel/main.tsx
    - src/entrypoints/standalone/main.tsx
    - src/core/i18n/strings.ts (+1 additive key)
    - tests/core/commands/registerWorkspaceCommands.test.ts
    - tests/core/commands/CommandRegistry.test.ts
    - tests/core/i18n/strings.test.ts (+1 pinned value)
    - .planning/phases/01-mv3-wxt-runtime-antd-shells-workspace/01-MIGRATION-INVENTORY.md (9 rows reconciled)
    - .planning/WINDOWS.md (two entries appended)

key-decisions:
  - "The command's `category` is a canonical id (`navigation` | `theme` | `system`), and the palette resolves it through `t(\`commands.category.${category}\`)`. Storing a display label would have put an untranslated string in the DOM; storing a `t()` key in the registry would have made the registry own presentation. The palette stays category-agnostic, so a later phase adds a command (and a `commands.category.*` key) with no palette change."
  - "The deps-injection shape is retained verbatim: `toggle-theme`'s action ends at `deps.toggleTheme`, and each surface wires that dep to `cycleThemeMode()` — the single theme write path. The cycle is asserted against the real store (`auto → light → dark → auto`), and a second case proves the command itself never touches the store."
  - "The destructive command's gate is the confirmation, not the query: any selection of a `destructive` row opens the pinned confirmation and only `Continue` invokes the action, so a partial match cannot auto-run it and neither can an exact one."
  - "On the Standalone surface, `Open Standalone view` focuses *this* surface (`chrome.tabs.getCurrent` → activate → focus window) instead of calling the router's handoff. The router would have re-pointed this very tab at a fresh bootstrap, disposed the source on unload and then reported `standalone.openFailed` after the handshake timeout — a false failure for a command whose contract is the idempotent focus path."
  - "The dev gate is inline rather than a helper function. With a helper the production bundle retained the `RELOAD_EXTENSION` definition (one dead `reload-extension` occurrence); inlined, esbuild folds `false === true`, drops the branch and the definition, and the bundle reads zero. A source-scan case pins the inline shape."
  - "`openSidePanelForCurrentTab` is exported from `src/entrypoints/standalone/main.tsx` so the SA-10 ordering case can drive the real handler with mocked Chrome APIs. The plan put that case in the commands suite (`tests/components/StandaloneShell.test.tsx` is 01-12's file in the same wave), and exporting the handler was the only way to reach it without inventing a module the plan does not list."
  - "The listener's control flow changed from `return` to `continue`-on-throw: a throwing handler is still swallowed (the plan's unchanged behaviour) but no longer prevents later matching registrations from being evaluated (the plan's behaviour case). The first *successful* handler still owns the event."

patterns-established:
  - "A matcher defect is pinned by the platform that exposes it: the macOS case (meta key held) is a named case, not an inference from the Windows/Linux case"
  - "A source scan ships with its own negative control (a file-count positive control plus a matcher self-test on the reintroduction spellings), so a refactor that weakens it trips the self-test rather than passing vacuously"
  - "A build-level claim is verified against the artifact, not the source: `grep -ro reload-extension .output/chrome-mv3/` must read 0 after `pnpm run build:ext`"
  - "A jsdom key dispatch that changes React state is wrapped in `act()`; the palette's token assertion normalises the colour through the DOM so hex-vs-rgb normalisation cannot make it vacuous"

requirements-completed: [SP-09, SA-09, FLOW-8, FLOW-10, SA-10]

coverage:
  - id: D1
    description: "The chord opens the palette on macOS and Windows/Linux through one matcher: the registration token names the platform-primary modifier, `preventDefault` runs before the handler, and Shift/Alt stay strict exact matches."
    requirement: "FLOW-8"
    verification:
      - kind: unit
        ref: "tests/core/input/KeymapRegistry.test.ts (15 cases: meta-key chord with ordering assertion, control-key chord, no-modifier, Shift-held, Cmd+Shift+K, the four primary tokens, bare key, wrong key, conflict, lifecycle, 5-cycle listener count, throw-and-continue, getAll, source scan, scan self-test)"
        status: pass
      - kind: other
        ref: "RED evidence: the same suite ran 5 failed / 10 passed before the repair (macOS chord, Cmd+Shift+K, PRIMARY_TOKENS, KEYMAP_CONFLICT, throw-and-continue)"
        status: pass
    human_judgment: false
  - id: D2
    description: "`KeymapRegistry` is the only global keyboard owner: one `document` keydown listener attached on first register and detached on last unregister, no ad-hoc listener under `src/entrypoints`, and a duplicate id is a typed `KEYMAP_CONFLICT`."
    requirement: "FLOW-8"
    verification:
      - kind: unit
        ref: "tests/core/input/KeymapRegistry.test.ts#throws a typed KEYMAP_CONFLICT … / #unregisters a binding and detaches the single document listener … / #holds exactly one document keydown listener across repeated register/unregister cycles / #finds zero global keyboard-listener registrations under src/entrypoints"
        status: pass
      - kind: other
        ref: "grep -n \"addEventListener\" src/entrypoints (only the content script's non-keyboard `wxt:locationchange` listener remains); both roots bind through KeymapRegistry.register and return both cleanups"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Phase-1 command set is exactly the D-09 shell/navigation commands per surface plus the dev-only destructive reload: exact ids and order, UI-SPEC labels/descriptions, resolved categories, and absence from a production registry, palette and bundle."
    requirement: "SP-09"
    verification:
      - kind: unit
        ref: "tests/core/commands/registerWorkspaceCommands.test.ts (20 cases: per-surface sets, production-mode absence, inline-gate source pin, metadata, cleanup, duplicate-id throw, the cycle) + tests/components/CommandPalette.test.tsx#renders exactly the … set / #omits the dev-only destructive command from a production build"
        status: pass
      - kind: integration
        ref: "pnpm run build:ext → grep -ro reload-extension .output/chrome-mv3/ reads 0 (was 1 dead constant before the inline gate); manifest keys unchanged"
        status: pass
    human_judgment: false
  - id: D4
    description: "The palette meets the token, typography and copy contract: token-derived selected row and category colours, no sub-12 px text, `t()`-resolved chrome, a held list height in the zero-result state, and the destructive confirmation pinned to `common.continue` / `common.notNow`."
    requirement: "SA-09"
    verification:
      - kind: unit
        ref: "tests/components/CommandPalette.test.tsx (14 cases) + grep -rEn '#[0-9a-fA-F]{3,6}|var\\(--' src/components/common/CommandPalette.tsx = 0 + grep -n 'fontSize: 11' = 0"
        status: pass
      - kind: other
        ref: "tests/core/i18n/strings.test.ts pins `sidepanel.openFailed`; `npx vitest run tests/core/i18n` green"
        status: pass
    human_judgment: false
  - id: D5
    description: "The global chord toggles the palette closed while it is open, through one binding: a second press closes it, and re-registering the same id is a typed conflict rather than a second listener."
    requirement: "FLOW-10"
    verification:
      - kind: unit
        ref: "tests/components/CommandPalette.test.tsx#opens on the chord and closes on the next press — one binding, no re-registration (registry-bound harness, dispatch on `document`, `waitFor` for the close, duplicate register throws)"
        status: pass
    human_judgment: false
  - id: D6
    description: "`Focus Side Panel` issues its `chrome.sidePanel.open({ tabId })` call inside the user-gesture stack — no awaited window lookup before it — and degrades to a typed, logged, user-visible failure instead of an unhandled rejection."
    requirement: "SA-10"
    verification:
      - kind: unit
        ref: "tests/core/commands/registerWorkspaceCommands.test.ts#issues the tabId-variant open synchronously … / #degrades an unavailable side-panel API … / #reports a missing active tab … / #turns a rejected sidePanel.open promise … / #carries no await between the handler body and the open call (source scan)"
        status: pass
      - kind: other
        ref: "grep -n 'await' src/entrypoints/standalone/main.tsx → only the two doc-comment mentions; no awaited window lookup in the file"
        status: pass
    human_judgment: true
    rationale: "The unit case proves ordering only. `chrome.sidePanel.open()`'s gesture semantics are runtime-only and jsdom mocks the API, so the real observation — running Focus Side Panel from the palette in a real Chrome MV3 build — is operator evidence owned by the phase acceptance plan (01-VALIDATION manual row; WINDOWS.md ledger entry appended)."

# Metrics
duration: 21min
completed: 2026-09-21
status: complete
---

# Phase 1 Plan 08: Keymap Repair, the D-09 Command Set and the Token-Clean Palette Summary

**`Cmd+K` opens the palette on macOS and Windows/Linux through one repaired registry matcher, both surfaces bind it as the extension's only global keyboard path, the D-09 set renders from the registry with a dev-only destructive command that is folded out of the production bundle, and `Focus Side Panel` issues its gesture-gated open without an awaited window lookup**

## Performance

- **Duration:** 21 min
- **Started:** 2026-09-21T20:58:36Z
- **Completed:** 2026-09-21T21:20:06Z
- **Tasks:** 3
- **Files modified:** 12 tracked paths across 5 commits (1,586 insertions / 407 deletions), plus the inventory and the windows ledger

## Accomplishments

- **The matcher works on the primary development platform.** `PRIMARY_TOKENS` plus `matchesKeymap` resolve `Cmd`/`Command`/`Control`/`Meta` to one platform-primary comparison (`metaKey || ctrlKey`) and keep `Shift`/`Alt` as strict exact matches. The defect it replaces is named in the module's doc comment: the old predicate compared `meta === e.metaKey` where `meta` was true only for the literal token `Meta`, so a `Cmd+K` registration could never match on macOS (RESEARCH Pitfall 2). RED evidence: the suite failed 5 of 15 cases before the repair — the macOS chord, `Cmd+Shift+K`, the missing exports, the conflict code and the throw-and-continue rule.
- **A duplicate binding is a typed refusal.** `KeymapConflictError` carries `code: 'KEYMAP_CONFLICT'` (§21.6) and an id-bearing message; the case asserts the error type, the code, the message and that the registry still holds exactly one binding (first-wins is not the behaviour).
- **One listener, for the whole extension.** Attach on first register, detach on last unregister, the same function identity added and removed, and one net `keydown` listener after five register/unregister cycles. A source scan over `src/entrypoints/**` fails if a keyboard listener is reintroduced there, with a positive file-count control and a matcher self-test on the reintroduction spellings so it cannot pass vacuously (T-1-39).
- **The D-09 set renders from the registry on both surfaces.** Side Panel registers `open-standalone-view`, `open-options`, `toggle-theme`; Standalone registers `focus-side-panel` plus the same three — with the UI-SPEC labels, descriptions and resolved categories (`Navigation`/`Appearance`/`System`, never the prototype `Theme`/`Extension` literals). The cleanup closure unregisters every id it added.
- **The destructive command is absent from production, not merely unreachable.** `reload-extension` is marked `destructive`, registered only behind an inline `import.meta.env.DEV === true` gate, and never auto-runs — a partial match opens the pinned confirmation (`command.reloadExtension.confirm` with `common.continue` / `common.notNow`) and only `Continue` invokes the action. `pnpm run build:ext` now emits a bundle with **zero** occurrences of `reload-extension` (the gate folds to `false`, esbuild drops the branch and the definition), where a helper-function gate had shipped one dead constant (T-1-37).
- **Both surface roots bind the palette through `KeymapRegistry`.** `KeymapRegistry.register({ id: 'open-command-palette', keys: 'Cmd+K', handler: () => setPaletteOpen(open => !open) })` sits in the same effect that registers the commands, and the effect returns both cleanups. The palette's own Escape/arrow/Enter handling stays where it was — intra-overlay handling, not a global binding — and the chord is proven to toggle an open palette closed through a registry-bound harness.
- **The palette meets the token, typography and copy contract.** `token.colorPrimaryBg` on the selected row (no CSS-variable fallback), `token.colorTextTertiary` at the 12 px floor for the category, `t('commands.placeholder')` / `t('commands.noResults')` / `commands.category.*` for its chrome, `a11y.closeDialog` on the close control, the zero-result branch holding the list's height, the selection kept scrolled into view, and single-line/2-line clamping on the label/description.
- **`Focus Side Panel` respects the user-gesture requirement.** The Standalone handler calls the `tabId`-variant `chrome.sidePanel.open` from inside the `chrome.tabs.query` callback — no `await` sits between the gesture and the call — and every failure path (unavailable API, no active tab, rejected promise) logs a SCREAMING_SNAKE code and reports a typed `{ code, error }` failure that the surface shows as `sidepanel.openFailed`. The source scan fails if an awaited window lookup returns (Pitfall 4, SA-10).

## Task Commits

Each task was committed atomically; the TDD task carries its RED then GREEN commit:

1. **Task 1 RED: failing KeymapRegistry suite** — `25192735` (test)
2. **Task 1 GREEN: repaired matcher + typed KEYMAP_CONFLICT** — `b51055ef` (feat)
3. **Task 2: D-09 command set, registry binding, token-clean palette** — `32152e5c` (feat)
4. **Task 3: gesture-correct Focus Side Panel** — `92210adf` (fix)
5. **Production-bundle fold fix for the dev gate** — `49feb85a` (fix)

**Plan metadata:** committed separately as `docs(01-08): complete … plan`.

## Files Created/Modified

- `src/core/input/KeymapRegistry.ts` — `PRIMARY_TOKENS`, `matchesKeymap`, `KeymapConflictError`; the listener swallows a throwing handler and continues evaluating later registrations; lifecycle and `getAll()` unchanged.
- `src/core/commands/registerWorkspaceCommands.ts` — both D-09 variants from one module, the five command definitions with UI-SPEC metadata, and the inline dev gate.
- `src/core/commands/CommandRegistry.ts` — `COMMAND_CATEGORIES` + `CommandCategory` and the optional `Command.destructive` marker; `search`/`execute`/`getAll` untouched.
- `src/components/common/CommandPalette.tsx` — token-derived rows, 12 px floor, held list height, `t()`-resolved chrome, `scrollIntoView` selection tracking, and the destructive confirmation modal.
- `src/entrypoints/sidepanel/main.tsx` — registry-bound palette keymap; the handoff-failure toast now resolves `standalone.openFailed` instead of an inline literal.
- `src/entrypoints/standalone/main.tsx` — registry-bound palette keymap, the D-09 Standalone set (including the new `openStandalone` dep wired to `focusStandaloneSurface`), and the exported gesture-safe `openSidePanelForCurrentTab`.
- `src/core/i18n/strings.ts` — one additive key, `sidepanel.openFailed`.
- `tests/core/input/KeymapRegistry.test.ts` — **new**, 15 cases.
- `tests/components/CommandPalette.test.tsx` — **new**, 14 cases.
- `tests/core/commands/registerWorkspaceCommands.test.ts` — rewritten for the D-09 sets, 12 → 20 cases (plus the 5 SA-10 gesture cases).
- `tests/core/commands/CommandRegistry.test.ts` — 14 → 17 cases (palette-renders-registry contract, `destructive` round-trip).
- `tests/core/i18n/strings.test.ts` — the new key added to the pinned value table.
- `01-MIGRATION-INVENTORY.md` — nine rows reconciled (four 01-08 rows flipped to `implemented`/`verified`, the two command suites, both entrypoints, and the additive strings key).
- `.planning/WINDOWS.md` — two entries appended.

## Decisions Made

- **The category is a canonical id resolved by the palette.** `category: 'theme'` renders as `t('commands.category.theme')` = `Appearance`. Storing the display label would put an untranslated string in the DOM; storing a `t()` key in the registry would make the registry own presentation. The palette stays category-agnostic for later phases.
- **The deps-injection shape is retained and the theme path is singular.** `toggle-theme`'s action ends at `deps.toggleTheme`; each surface wires that dep to `cycleThemeMode()`. The cycle is asserted against the real store and a second case proves the command itself never touches it.
- **The destructive gate is the confirmation, not the query.** Any selection of a `destructive` row opens the pinned confirmation; only `Continue` invokes the action. This is stronger than a query-shape rule — no match, partial or exact, can auto-run the command.
- **The Standalone's `Open Standalone view` focuses this surface.** Calling the router's handoff would re-point this very tab at a fresh bootstrap, dispose the source on unload, and then report `standalone.openFailed` after the handshake timeout. `chrome.tabs.getCurrent` → activate → focus window is the idempotent focus path D-09 names.
- **The dev gate is inline so it folds.** A helper function defeated esbuild's constant folding and shipped the command definition; the inline `if (import.meta.env.DEV === true)` drops it, verified against the built bundle. A source-scan case pins the shape.
- **The opener is exported from the entrypoint.** The SA-10 ordering case lives in the commands suite (the plan's file), so the real handler had to be reachable from it; exporting it avoided inventing a module the plan does not list.
- **A throwing handler no longer blocks its siblings.** The swallow is unchanged, but the listener continues to later registrations on a throw and returns on the first successful handler (the plan's behaviour case).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bundle] The dev gate shipped the destructive command's definition into the production bundle**
- **Found during:** Task 2 verification, grepping the built artifact after `pnpm run build:ext`
- **Issue:** the gate was written as a helper (`function isDevelopmentBuild(): boolean`). Vite replaced `import.meta.env.DEV` with `false` inside the helper, but esbuild does not inline function calls, so the `if (isDevelopmentBuild())` branch survived at runtime and the `RELOAD_EXTENSION` definition (including the `reload-extension` id) stayed in the bundle. The command was unreachable — the gate returned false — but "excluded from a production build" is stronger than "unreachable", and a bundle grep read 1.
- **Fix:** the gate is now written inline in both register functions; esbuild folds `false === true`, drops the branch and the definition. `grep -ro reload-extension .output/chrome-mv3/` reads 0.
- **Files modified:** `src/core/commands/registerWorkspaceCommands.ts`, `tests/core/commands/registerWorkspaceCommands.test.ts`
- **Verification:** `pnpm run build:ext` then the grep (0 occurrences, was 1); a source-scan case pins the inline shape and fails if the gate returns to a helper.
- **Committed in:** `49feb85a`

**2. [Rule 2 - Missing critical functionality] The `Focus Side Panel` failure path had no canonical copy**
- **Found during:** Task 3, wiring the user-visible failure the plan requires
- **Issue:** the plan requires the side-panel path to degrade to a "typed, logged, user-visible failure", but the UI-SPEC Copywriting Contract pins no string for it and every user-visible string must resolve through `t()`.
- **Fix:** one additive key — `sidepanel.openFailed` = `Failed to open the side panel` — added to `src/core/i18n/strings.ts` and to the pinned value table in `tests/core/i18n/strings.test.ts` (the suite that owns copy exactness). No canonical value changed.
- **Files modified:** `src/core/i18n/strings.ts`, `tests/core/i18n/strings.test.ts`
- **Verification:** `npx vitest run tests/core/i18n` green; the Standalone surface renders the key on failure.
- **Committed in:** `92210adf` (source) / `32152e5c` (key + pinned table)
- **Ledger:** appended as `deviation` for phase-acceptance ratification.

**3. [Rule 2 - Copy discipline] The Side Panel's handoff-failure toast was an inline prototype literal**
- **Found during:** Task 2, editing the same effect
- **Issue:** `sidepanel/main.tsx` showed `"Couldn't open Standalone view"` — a prototype literal, while the pinned canonical key `standalone.openFailed` = `Failed to open Standalone view` already existed (01-04's map, 01-07's note that the copy belonged to the UI plans).
- **Fix:** the toast content now resolves `t('standalone.openFailed')`.
- **Files modified:** `src/entrypoints/sidepanel/main.tsx`
- **Verification:** `npx vitest run tests/core/i18n tests/components` green; the literal no longer exists in `src/`.
- **Committed in:** `32152e5c`

**4. [Rule 3 - Instrument] The plan's Task 3 test home could not reach the handler it must drive**
- **Found during:** Task 3, placing the ordering case
- **Issue:** the plan puts the SA-10 ordering case in `tests/core/commands/registerWorkspaceCommands.test.ts` (because `tests/components/StandaloneShell.test.tsx` is 01-12's file in the same wave) but the handler it must drive lives in `src/entrypoints/standalone/main.tsx`, which exported nothing.
- **Fix:** `openSidePanelForCurrentTab` (and its `SidePanelOpenFailure` type) is exported from the entrypoint; the case imports it and drives it with mocked Chrome APIs. No new module was invented and no file another plan owns was touched.
- **Files modified:** `src/entrypoints/standalone/main.tsx`, `tests/core/commands/registerWorkspaceCommands.test.ts`
- **Verification:** the five SA-10 cases run against the real handler; the suite's source scan asserts no `await` sits before the open call.
- **Committed in:** `92210adf`

**5. [Rule 1 - Behaviour] The plan's own behaviour case required a listener control-flow change**
- **Found during:** Task 1, writing the throw case
- **Issue:** the plan says to keep the "swallow-on-throw handler behaviour unchanged" and also lists the case "a handler that throws is swallowed and does not prevent later matching registrations from being evaluated". The prototype `return`ed after the first match, so a throwing handler blocked its siblings — the two instructions cannot both hold under `return`.
- **Fix:** the swallow is unchanged; the loop now continues to later registrations after a throw and returns on the first successful handler. The first *successful* handler still owns the event.
- **Files modified:** `src/core/input/KeymapRegistry.ts`
- **Verification:** `tests/core/input/KeymapRegistry.test.ts#swallows a throwing handler and still evaluates later matching registrations` (RED before, GREEN after).
- **Committed in:** `b51055ef`

---

**Total deviations:** 5 auto-fixed (1 bundle elimination, 1 missing copy, 1 copy-discipline fix, 1 instrument/export, 1 behaviour clarification)
**Impact on plan:** No dependency was added or bumped (`package.json` untouched), no later-phase capability was implemented, and no file another plan owns was changed beyond the one additive string key and its pinned assertion (deviations 2). The plan's file list was honoured exactly; the only exports added are the handler Task 3's own case must drive.

## Issues Encountered

- **jsdom needs `act()` around a dispatched key event that changes React state.** The palette's ArrowDown/Enter handling and the registry chord both update state outside React's render, so the assertions read the pre-update DOM until the dispatches were wrapped in `act()`. The suite's `pressKey`/`pressPaletteChord` helpers now wrap the dispatch.
- **A colour assertion can pass vacuously.** jsdom normalises `#e6f4ff` to `rgb(230, 244, 255)`, so the selected-row case normalises both sides through a DOM probe before comparing — otherwise `'' === ''` would have passed for the wrong reason.
- **antd v6 emits `Warning: [antd: List] The List component is deprecated and will be removed in next major version`.** The palette keeps `List` (the UI-SPEC pins it for Phase 1), but a later phase that touches the palette should migrate to the replacement component.
- **`window.getComputedStyle(elt, pseudoElt)` is not implemented in jsdom**, so antd's scroll locker logs `Not implemented` errors during modal mounts. They are noise, not failures — the suite is green.

## Known Stubs

None — no placeholder value, empty collection or unwired data source was introduced. The palette renders the registry; the destructive command is either registered (dev) or absent (production), never a disabled placeholder.

**Broken-windows ledger:** two entries appended — `unrun-verify` (SA-10's real Chrome gesture evidence, coverage D6) and `deviation` (the additive `sidepanel.openFailed` key, deviation 2). `open_count` 10 → 12; no entry was closed by this plan.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: second_listener | `src/components/common/CommandPalette.tsx` | The palette's intra-overlay `window` keydown listener is the only keyboard listener outside `KeymapRegistry` in the extension. It is explicitly authorised by the plan (Escape/arrows/Enter are overlay-scoped, not a global binding), it is scoped to `open === true`, and the source scan covers `src/entrypoints` only — a future refactor that moves the chord into this listener would not be caught by the scan. Recorded for the phase's security review. |
| threat_flag: dev_gate_residue | `src/core/commands/registerWorkspaceCommands.ts` | The dev gate is a build-time constant in production but a runtime check in `vitest`, so the "absent from production" claim rests on the artifact grep (`grep -ro reload-extension .output/chrome-mv3/` = 0), not on the unit suite alone. A future bundler/config change could reinstate the dead constant without failing the unit tests; the source-scan case pins the inline shape as the guard. |

## User Setup Required

None — no external service configuration, no dependency installed or bumped, no version change.

## Next Phase Readiness

- **`01-11` (prototype hosts)**: the last ad-hoc keyboard listener in the repo is `src/main.tsx:118` (`window.addEventListener('keydown', …)`, with a prototype command set whose categories are still `'Appearance'`/`'Navigation'` literals). D-03's teardown removes that file; until then it is the one place outside `src/entrypoints` that violates the single-listener rule, and the source scan is deliberately scoped to `src/entrypoints`.
- **`01-13` (gates)**: the instruments to extend are (a) `grep -ro reload-extension .output/chrome-mv3/` = 0 after `pnpm run build:ext`, (b) the `src/entrypoints` keyboard-listener source scan (with its self-test), (c) `grep -rEn "#[0-9a-fA-F]{3,6}|var\(--" src/components/common/CommandPalette.tsx` = 0, (d) the SA-10 ordering source scan, and (e) the `commands.category.*` resolution cases.
- **Phase acceptance review**: two items are recorded for ratification — the additive `sidepanel.openFailed` key (WINDOWS.md) and the SA-10 real Chrome evidence (WINDOWS.md `unrun-verify`), which the plan explicitly assigns to the phase acceptance plan rather than to this suite.
- **Later phases (15/18)**: the palette is provably registry-driven — a new command appears with no palette change (case in `tests/components/CommandPalette.test.tsx`), and a new category needs only a `commands.category.*` key plus a registry value. The `List` deprecation warning is the one thing to revisit when the palette is next touched.
- **Phase 2**: nothing here persists, and no workspace path was touched — the palette's query is transient by construction (`destroyOnHidden` plus the close-time reset), and the command set carries no credentials.

---

*Phase: 01-mv3-wxt-runtime-antd-shells-workspace*
*Completed: 2026-09-21*

## Self-Check: PASSED

- Files created (2 of 2): `tests/core/input/KeymapRegistry.test.ts`, `tests/components/CommandPalette.test.tsx`.
- Files modified present (10 of 10): `src/core/input/KeymapRegistry.ts`, `src/core/commands/{registerWorkspaceCommands,CommandRegistry}.ts`, `src/components/common/CommandPalette.tsx`, `src/entrypoints/{sidepanel,standalone}/main.tsx`, `src/core/i18n/strings.ts`, `tests/core/commands/{registerWorkspaceCommands,CommandRegistry}.test.ts`, `tests/core/i18n/strings.test.ts`.
- Commits present: `25192735`, `b51055ef`, `32152e5c`, `92210adf`, `49feb85a` (5 of 5, measured with `git rev-list --count c001070d..HEAD`).
- Fresh verification on the committed tree: `npx tsc --noEmit` exit 0; `npx vitest run` 38 files / 493 tests passed; `npx vitest run tests/core/input` 15 passed; `npx vitest run tests/components/CommandPalette.test.tsx tests/core/commands` 52 passed; `npx vitest run tests/isolation tests/core/strict` 34 passed; `bash scripts/verify-no-tailwind.sh` exit 0; palette hex/var grep 0 and `fontSize: 11` grep 0; `pnpm run build:ext` succeeds with `grep -ro reload-extension .output/chrome-mv3/` = 0 and the manifest keys unchanged.
