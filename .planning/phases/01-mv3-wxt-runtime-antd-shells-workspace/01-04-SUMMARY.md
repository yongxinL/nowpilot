---
phase: 01-mv3-wxt-runtime-antd-shells-workspace
plan: 04
subsystem: core, errors, i18n, components, security
tags: [debug-log, error-codes, trace-redactor, i18n, keymap, error-boundary, portable-markdown, focus-trap, dompurify, jsdom]

# Dependency graph
requires:
  - phase: 01-01
    provides: WXT 0.19 scaffold, vitest + WxtVitest, antd pins
  - phase: 01-02
    provides: STR (Appendix B verbatim), canonical §C.2 Phase-1 error-code block, RuntimeEnvelope/MessageType
  - phase: 01-03
    provides: EventBus/MessageBus deferred debugLog hooks (EVT_HANDLER/MSG_SERIALIZE codes), port transport
provides:
  - errorCodes.ts — canonical §C.2 Phase-1 error-code registry (38 codes) as ERROR_CODES + ErrorCode union
  - debugLog — Golden Rule 9 single never-throwing log entry point; every string routed through TraceRedactor.redact (R-10)
  - TraceRedactor.redact pass-through placeholder (R-10 audit point for the security phase)
  - i18n wrapper (getString/formatString/t + locale stubs) over nested STR with dotted-path StringKey type
  - KeymapRegistry (Appendix C type + KEYMAP constants + isCmdK) at canonical §18 path
  - ErrorBoundary, PortableMarkdown, FocusTrap core components + 15 tests
  - jsdom-align custom vitest environment — realm-aligned codecs making jsdom usable for component tests
affects: [01-05 (ThemeStore/BroadcastBus/keymap consumer), 01-08 (CmdKPicker/OnboardingModal use FocusTrap + ErrorBoundary; chat/notes consume PortableMarkdown + STR), 01-09 (LifecycleManager SIDEPANEL_BEHAVIOR catch), later phases (debugLog in every catch; errorCodes.ts extension), security phase (real TraceRedactor)]

# Tech tracking
tech-stack:
  added: [dompurify ^3 (approved stack, plan-mandated)]
  patterns:
    - "Single log entry point: debugLog is the ONLY console.error in the codebase; every catch calls debugLog(code, …) with a canonical §C.2 code (Golden Rule 9)"
    - "R-10 redaction choke point: every string debugLog logs passes TraceRedactor.redact before persist/UI/export — placeholder today, real redactor drops in later without caller changes"
    - "Sanitize-unconditionally: PortableMarkdown sanitizes with DOMPurify regardless of trust; trust is a styling-only data-trust attribute (defense in depth, T-1-07)"
    - "jsdom realm alignment: vitest's jsdom env overrides globalThis.Uint8Array (LIVING_KEYS) but leaves TextEncoder in Node's realm — esbuild 0.25's load-time invariant fails; tests/environments/jsdom-align.ts probes the encoder output realm and pins global.Uint8Array to it"
    - "RTL cleanup explicit: vitest runs with globals:false so @testing-library/react auto-cleanup never registers — afterEach(cleanup) in tests/setup.ts"
    - "threads pool: the forks pool fails to load the custom environment module (-122 write at loadEnvironment); pool: 'threads' loads it correctly"

key-files:
  created:
    - src/core/error/errorCodes.ts
    - src/core/error/debugLog.ts
    - src/core/security/TraceRedactor.ts
    - src/core/i18n/index.ts
    - src/core/input/KeymapRegistry.ts
    - src/core/components/ErrorBoundary.tsx
    - src/core/components/PortableMarkdown.tsx
    - src/core/components/FocusTrap.tsx
    - tests/core/error/debugLog.test.ts
    - tests/components/ErrorBoundary.test.tsx
    - tests/components/PortableMarkdown.test.tsx
    - tests/components/FocusTrap.test.tsx
    - tests/environments/jsdom-align.ts
  modified:
    - tests/setup.ts (RTL cleanup + comment)
    - vitest.config.ts (pool threads + custom environment)
    - package.json / pnpm-lock.yaml (dompurify ^3)

key-decisions:
  - "debugLog homes at src/core/error/debugLog.ts co-located with errorCodes.ts (W-7 path reconciliation, Golden Rule 2): §18's create list names src/core/log/debugLog.ts, but codes + logger are one contract; every plan in this phase imports from @/core/error/. A later phase may relocate to log/ if the spec's split becomes load-bearing — documented in the plan, no invented semantics."
  - "getString uses a dotted-path StringKey type instead of the plan's `keyof typeof STR` — STR is a nested constant (chat.*, notes.*), so `STR[key]` is a section object, not a string; the plan signature would not typecheck (Rule 1 type-level fix)."
  - "@ant-design/x-markdown 2.9.0 exports XMarkdown, not PortableMarkdown, and has no skipHtml prop — the equivalent is escapeRawHtml (raw HTML escaped to plain text). Used escapeRawHtml + DOMPurify.sanitize (defense in depth) (Rule 1 API-drift deviation, same class as 01-03 port.enableEmitter)."
  - "PortableMarkdown is the ONLY markdown renderer in the phase; banned markdown renderer packages are never imported (verify greps src/ for react-markdown == 0)."
  - "TraceRedactor.redact is a thin pass-through placeholder (flagged assumption RUNTIME-02) — debugLog's redaction contract is stable, so the real redactor (security phase) drops in without caller changes."
  - "Component tests run in a custom jsdom-align environment (Rule 3): vitest's jsdom setup leaves globalThis.TextEncoder in Node's realm while globalThis.Uint8Array is overridden to the jsdom realm, breaking esbuild 0.25's load-time invariant `new TextEncoder().encode(\"\") instanceof Uint8Array` whenever esbuild loads after env setup. The wrapper probes the encoder output realm and pins global.Uint8Array to it; pool set to threads (forks fails to load the custom env module with an IPC write error)."
  - "RTL DOM cleanup must be explicit: vitest 4 runs without globals (globals: false), so @testing-library/react cannot auto-register afterEach(cleanup); without it component-test DOM leaks across tests (stale getByText matches)."

patterns-established:
  - "Golden Rule 9 single entry: debugLog(code, message, {error, context, extra, addonId, module, silent}) — never throws, silent flag for sensitive flows, all strings redacted"
  - "Canonical codes as const object + type union (ERROR_CODES + ErrorCode) — later phases extend in place, never re-export elsewhere"
  - "Sanitize-unconditionally + escapeRawHtml for all AI/tool markdown (R-7, T-1-07)"
  - "Focus trap with focus restore (I2): consumed by modal surfaces in 01-08"

requirements-completed: [RUNTIME-01, RUNTIME-02, WSPC-05]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Canonical §C.2 error codes (38-code Phase-1 subset) + debugLog Golden Rule 9 entry point that never throws and routes every string through TraceRedactor.redact (R-10), with silent flag"
    requirement: RUNTIME-02
    verification:
      - kind: unit
        ref: "tests/core/error/debugLog.test.ts#routes the message string through TraceRedactor.redact (R-10)"
        status: pass
      - kind: unit
        ref: "tests/core/error/debugLog.test.ts#respects the silent flag and emits nothing"
        status: pass
      - kind: unit
        ref: "tests/core/error/debugLog.test.ts#never throws, even with odd inputs"
        status: pass
      - kind: other
        ref: "grep -c 'WORKSPACE_INIT|THEME_INIT|REGISTRY_INIT|CMDK_QUERY' src/core/error/errorCodes.ts == 4"
        status: pass
    human_judgment: false
  - id: D2
    description: "i18n wrapper (getString/formatString/t + locale stubs) over nested STR and KeymapRegistry (KEYMAP constants + isCmdK) at the canonical §18 path"
    requirement: RUNTIME-01
    verification:
      - kind: other
        ref: "grep -c 'getString|formatString' src/core/i18n/index.ts == 2"
        status: pass
      - kind: other
        ref: "grep -c 'CMD_K|isCmdK' src/core/input/KeymapRegistry.ts == 2"
        status: pass
      - kind: other
        ref: "pnpm tsc --noEmit exits 0"
        status: pass
    human_judgment: false
  - id: D3
    description: "ErrorBoundary class component: componentDidCatch → debugLog COMPONENT_RENDER; generic STR.chat.errorRetry fallback with Try again reset; never renders raw error text (T-1-08/R-10)"
    verification:
      - kind: unit
        ref: "tests/components/ErrorBoundary.test.tsx#catches a render error and shows the generic STR fallback, never the raw message"
        status: pass
      - kind: unit
        ref: "tests/components/ErrorBoundary.test.tsx#logs the crash through debugLog with the canonical COMPONENT_RENDER code"
        status: pass
      - kind: unit
        ref: "tests/components/ErrorBoundary.test.tsx#resets via the Try again button and re-renders children"
        status: pass
    human_judgment: false
  - id: D4
    description: "PortableMarkdown — the ONLY markdown renderer in the phase; XMarkdown with escapeRawHtml (skipHtml equivalent) + unconditional DOMPurify.sanitize (T-1-07); trust styling-only; null for empty content"
    verification:
      - kind: unit
        ref: "tests/components/PortableMarkdown.test.tsx#sanitizes raw HTML — strips event handlers and scripts (T-1-07)"
        status: pass
      - kind: unit
        ref: "tests/components/PortableMarkdown.test.tsx#sanitizes untrusted content the same as retrieved (sanitize is unconditional)"
        status: pass
      - kind: unit
        ref: "tests/components/PortableMarkdown.test.tsx#sets the data-trust attribute for styling hooks"
        status: pass
      - kind: other
        ref: "grep -rn 'react-markdown' src/ | wc -l == 0 (banned renderers never imported)"
        status: pass
    human_judgment: false
  - id: D5
    description: "FocusTrap: Tab/Shift+Tab cycling over visible focusables, Escape → onEscape, autoFocus first, focus restore on unmount — for CmdKPicker/OnboardingModal (01-08)"
    requirement: WSPC-05
    verification:
      - kind: unit
        ref: "tests/components/FocusTrap.test.tsx#cycles Tab from the last focusable back to the first"
        status: pass
      - kind: unit
        ref: "tests/components/FocusTrap.test.tsx#calls onEscape when Escape is pressed inside the trap"
        status: pass
      - kind: unit
        ref: "tests/components/FocusTrap.test.tsx#restores focus to the previously-focused element on unmount"
        status: pass
    human_judgment: false
    rationale: "Flagged assumption WSPC-05: FocusTrap is verified via testing-library in jsdom; real keyboard-interaction coverage is deferred to browser e2e (plan-flagged)."

# Metrics
duration: 48min
completed: 2026-08-08
status: complete
---

# Phase 1 Plan 4: Diagnostics, i18n, Keymap + Core Components Summary

**Canonical §C.2 error codes (38) + the Golden Rule 9 debugLog entry point with R-10 redaction routing, the i18n wrapper over STR, KEYMAP constants, and the three cross-cutting React components (ErrorBoundary, PortableMarkdown, FocusTrap) — plus the jsdom realm-alignment fix that makes component testing possible on this toolchain**

## Performance

- **Duration:** 48 min
- **Started:** 2026-08-08T08:01:04Z
- **Completed:** 2026-08-08T08:49:00Z
- **Tasks:** 3
- **Files modified:** 18 (13 created + 5 modified incl. package.json/lockfile, tests/setup.ts, vitest.config.ts)

## Accomplishments

- **Golden Rule 9 satisfiable (Task 1):** `errorCodes.ts` ships the canonical §C.2 Phase-1 subset (38 codes — the exact block 01-02 canonicalized into the spec) as `ERROR_CODES` + the `ErrorCode` union; `debugLog(code, message, {error, context, extra, addonId, module, silent})` is the single never-throwing log entry point — the ONLY `console.error` in the codebase. Every string argument routes through `TraceRedactor.redact` (R-10) before persist/UI/export; `silent` suppresses output for sensitive flows. `TraceRedactor.redact` is a documented pass-through placeholder (R-10 audit point) so the real redactor drops in later without caller changes.
- **i18n wrapper + keymap (Task 2):** `src/core/i18n/index.ts` exposes `getString`/`formatString`/`t` over the nested STR constant using a dotted-path `StringKey` type (`'chat.errorRetry'`) plus `getLocale`/`setLocale` 'en' stubs (no i18n framework in Phase 1 per CONTEXT). `src/core/input/KeymapRegistry.ts` at the canonical §18 path exports the Appendix C `KeymapRegistration` type, the `KEYMAP` constants (`mod+k`, `mod+n`, `mod+b`, `Escape`, `mod+Enter`), and `isCmdK` (metaKey on macOS / ctrlKey elsewhere).
- **Three core components (Task 3):** `ErrorBoundary` (class boundary — render errors logged via debugLog `COMPONENT_RENDER`, generic `STR.chat.errorRetry` fallback + "Try again" reset, raw error text NEVER reaches the DOM — T-1-08/R-10); `PortableMarkdown` (the ONLY markdown renderer in the phase — `XMarkdown` from @ant-design/x-markdown with `escapeRawHtml` + unconditional `DOMPurify.sanitize`, `data-trust` styling hook, null for empty content — T-1-07 defense in depth); `FocusTrap` (Tab/Shift+Tab cycle, Escape → onEscape, autoFocus, focus restore on unmount — KEPT per I2 for the 01-08 modal surfaces; MinimalMode deliberately NOT built).
- **jsdom made usable (Rule 3):** the default vitest jsdom environment was unloadable for ANY component test — vitest's `populateGlobal` overrides `globalThis.Uint8Array` (in LIVING_KEYS) with the jsdom-window realm while `globalThis.TextEncoder` stays Node's realm, so esbuild 0.25's load-time invariant `new TextEncoder().encode("") instanceof Uint8Array` throws. Fixed with `tests/environments/jsdom-align.ts` (probes the encoder output realm and pins `global.Uint8Array` to it via the populateGlobal setter), `pool: 'threads'` (forks fails to load the custom env module with an IPC write error), and explicit `afterEach(cleanup)` in tests/setup.ts (vitest runs with `globals: false`, so RTL's auto-cleanup never registers).

## Task Commits

Each task was committed atomically:

1. **Task 1: Error codes + debugLog (Golden Rule 9 entry point)** - `711fc3b` (feat)
2. **Task 2: i18n wrapper + keymap constants** - `25dbbb0` (feat)
3. **Task 3: Core React components (ErrorBoundary, PortableMarkdown, FocusTrap)** - `83c5a5d` (feat)

**Plan metadata:** `(pending)` docs commit

## Files Created/Modified

- `src/core/error/errorCodes.ts` - 38-code Phase-1 §C.2 subset; ERROR_CODES const + ErrorCode union
- `src/core/error/debugLog.ts` - never-throwing single log entry; R-10 redaction; silent flag
- `src/core/security/TraceRedactor.ts` - redact() pass-through placeholder (R-10 audit point)
- `src/core/i18n/index.ts` - getString/formatString/t + StringKey dotted-path type + locale stubs
- `src/core/input/KeymapRegistry.ts` - KeymapRegistration (Appendix C), KEYMAP, isCmdK
- `src/core/components/ErrorBoundary.tsx` - class boundary; COMPONENT_RENDER; STR fallback
- `src/core/components/PortableMarkdown.tsx` - XMarkdown + escapeRawHtml + DOMPurify; data-trust
- `src/core/components/FocusTrap.tsx` - focus trap + restore; jsdom-aware visibility
- `tests/core/error/debugLog.test.ts` - 5 tests (redact routing, silent, canonical code output, never-throws)
- `tests/components/ErrorBoundary.test.tsx` - 4 tests (fallback, no raw text, COMPONENT_RENDER log, reset)
- `tests/components/PortableMarkdown.test.tsx` - 5 tests (render, empty→null, data-trust, XSS strip)
- `tests/components/FocusTrap.test.tsx` - 6 tests (autofocus, no-steal, Tab/Shift+Tab cycle, Escape, restore)
- `tests/environments/jsdom-align.ts` - custom jsdom env with realm-aligned codecs
- `tests/setup.ts` - RTL cleanup per test + alignment fallback (header docs)
- `vitest.config.ts` - pool threads + custom environment
- `package.json` / `pnpm-lock.yaml` - dompurify ^3

## Decisions Made

- **debugLog path reconciliation (W-7, Golden Rule 2):** the §18 create list names `src/core/log/debugLog.ts`; this plan deliberately homes it at `src/core/error/debugLog.ts` co-located with `errorCodes.ts` — codes + logger are a single contract, and every plan in this phase imports from `@/core/error/`. A later phase may relocate to `log/` if the spec's split becomes load-bearing (plan-documented; no invented semantics).
- **StringKey dotted-path type for the i18n wrapper:** the plan's `getString(key: keyof typeof STR)` would not typecheck — STR is nested, so `STR[key]` is a section object. `StringKey<typeof STR>` resolves dotted paths to string leaves (type-level Rule 1 fix).
- **XMarkdown instead of "PortableMarkdown" with escapeRawHtml instead of "skipHtml":** @ant-design/x-markdown 2.9.0 exports `XMarkdown` and has no `skipHtml` prop; `escapeRawHtml` is the package's equivalent (raw HTML in markdown is escaped to plain text). Combined with `DOMPurify.sanitize` the T-1-07 requirement is met with defense in depth.
- **jsdom-align environment + threads pool:** the mechanism, root cause and fix are documented in `tests/environments/jsdom-align.ts` and the vitest.config.ts header — this is the fix that finally makes jsdom usable for the component tests after the 01-01/01-02/01-03 workarounds avoided jsdom entirely.
- **TraceRedactor placeholder is contract-stable:** flagged_assumption RUNTIME-02 resolved — debugLog routes through `redact()` today; the real redactor (security phase) swaps in transparently.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - API drift] @ant-design/x-markdown 2.9.0 has no `PortableMarkdown` export and no `skipHtml` prop**
- **Found during:** Task 3 (PortableMarkdown implementation)
- **Issue:** The plan says "wraps @ant-design/x-markdown's PortableMarkdown with skipHtml: true". Grepping the installed 2.9.0 package: the export is `XMarkdown` (default + named), and the props interface has no `skipHtml` — the equivalent is `escapeRawHtml` ("escape raw HTML in Markdown as plain text, avoiding XSS while preserving content").
- **Fix:** Wrapped `XMarkdown` with `escapeRawHtml` and kept the plan's mandatory unconditional `DOMPurify.sanitize(content)` (defense in depth — T-1-07). The acceptance grep (`DOMPurify|skipHtml >= 1`) is satisfied.
- **Files modified:** src/core/components/PortableMarkdown.tsx
- **Verification:** 5/5 PortableMarkdown tests pass (XSS strip, unconditional sanitize, data-trust); banned-renderer grep == 0
- **Committed in:** 83c5a5d (Task 3 commit)

**2. [Rule 1 - Type fix] Plan's `getString(key: keyof typeof STR): string` does not typecheck — STR is nested**
- **Found during:** Task 2 (first `pnpm tsc --noEmit`)
- **Issue:** `STR` is a nested constant (`chat`, `notes`, `options`, …), so `STR[keyof typeof STR]` is a union of section objects, not `string`. The plan's exact signature fails tsc with TS2322.
- **Fix:** Introduced a recursive `StringKey<T>` dotted-path type (`'chat.errorRetry'` resolves to a string leaf) used by `getString`/`t`. The public surface (getString/formatString/t + locale stubs) matches the plan; only the key type changed.
- **Files modified:** src/core/i18n/index.ts
- **Verification:** `pnpm tsc --noEmit` green; acceptance greps (getString|formatString == 2, CMD_K|isCmdK == 2) pass
- **Committed in:** 25dbbb0 (Task 2 commit)

**3. [Rule 3 - Blocking] Default vitest jsdom environment is unloadable — esbuild 0.25 load-time invariant fails on realm-mismatched TextEncoder/Uint8Array**
- **Found during:** Task 3 (first component test run)
- **Issue:** Vitest's jsdom setup (`populateGlobal`) overrides `globalThis.Uint8Array` with the jsdom-window-realm constructor (it is in LIVING_KEYS) but leaves `globalThis.TextEncoder` in Node's realm (not an own window property, so never overridden). esbuild 0.25's load-time check `new TextEncoder().encode("") instanceof Uint8Array` then fails whenever esbuild loads after the environment is populated (vitest loads it at the tail of the environment phase — after env setup, before setupFiles, so a setup.ts alignment is too late). Every component test — even a trivial one — failed to load.
- **Fix:** Created `tests/environments/jsdom-align.ts` — a custom environment that delegates to the builtin jsdom env, then probes `new win.TextEncoder().encode('')` and pins `global.Uint8Array = probe.constructor` (via populateGlobal's setter) so every later esbuild load passes the invariant; also aligns TextEncoder/TextDecoder to the window realm. Set `test.pool: 'threads'` (the forks pool fails to load the custom environment module with an IPC write error, "Unknown system error -122"). Also added explicit `afterEach(cleanup)` in tests/setup.ts (vitest runs with `globals: false`, so RTL's auto-cleanup never registers and component-test DOM leaks across tests).
- **Files modified:** tests/environments/jsdom-align.ts (created), vitest.config.ts, tests/setup.ts
- **Verification:** full suite 54/54 green; component tests 15/15 green; `verify:phase-1` green (eslint, prettier, tsc, wxt build, vitest, isolation)
- **Committed in:** 83c5a5d (Task 3 commit)

**4. [Rule 2 - Missing Critical] dompurify was not a direct dependency**
- **Found during:** Task 3 (PortableMarkdown — plan mandates `import dompurify — approved stack`)
- **Issue:** `dompurify` is a transitive dependency of @ant-design/x-markdown (present in node_modules) but NOT in package.json — a phantom dependency that would break on a clean install / stricter resolvers.
- **Fix:** `pnpm add dompurify@^3` (approved stack per AGENTS.md §7; plan names it explicitly).
- **Files modified:** package.json, pnpm-lock.yaml
- **Verification:** tsc green; PortableMarkdown sanitize tests pass
- **Committed in:** 83c5a5d (Task 3 commit)

---

**Total deviations:** 4 auto-fixed (2 Rule 1, 1 Rule 2, 1 Rule 3)
**Impact on plan:** All fixes were necessary for the plan's own acceptance criteria (tsc green, component tests green, jsdom usable, approved stack hygiene). No scope creep — no features beyond the plan's contract; the XMarkdown/escapeRawHtml swap is the same sanitization capability via the package's actual API.

## Issues Encountered

- **jsdom 30 + vitest 4 + esbuild 0.25 realm mismatch (deep dive):** the root cause took several rounds of tracing to pin down (see deviation #3). Key diagnostics: `globalU8 is getter?: true`, `globalTE own prop?: true` — vitest's populateGlobal only overrides Uint8Array (in LIVING_KEYS), not TextEncoder (not an own window prop), splitting the realms. A plain-Node + JSDOM reproduction showed aligned realms; the mismatch only manifests under vitest's populateGlobal getter semantics.
- **Deferred debugLog wiring (NOT in this plan's scope):** EventBus/MessageBus (01-03) still use the `typeof debugLog === 'function'`-guarded ambient hook with canonical codes (EVT_HANDLER, MSG_SERIALIZE). This plan's `files_modified` list does NOT include those files, so the real `@/core/error/debugLog` import into EventBus/MessageBus is left to the first later plan that modifies them (01-05+). Until then the guarded hook compiles and runs standalone (runtime logging of those two paths is a no-op). Plan executed exactly as written — noted here for the next plan.
- **`pnpm vitest run --pool=threads` output:** console.log in tests is suppressed by vitest's default reporter (had to use `--disable-console-intercept` during debugging) — no impact on final tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Golden Rule 9 is now satisfiable:** every later plan imports `debugLog` + `ErrorCode` from `@/core/error/` — EventBus/MessageBus should swap their ambient `declare const debugLog` hook for the real import when first modified (01-05+).
- **R-10 redaction wired at the single entry point:** any string debugLog logs already passes `TraceRedactor.redact`; the security phase swaps the placeholder for the real redactor with zero caller changes.
- **01-08 consumers ready:** CmdKPicker + OnboardingModal consume `FocusTrap` (focus trap + restore) and `ErrorBoundary`; chat/notes consume `PortableMarkdown` (sanitized) and `STR` via the i18n wrapper; `isCmdK`/`KEYMAP` feed the Cmd+K palette; `SIDEPANEL_BEHAVIOR` code is ready for 01-09's LifecycleManager catch.
- **Component testing is now viable:** the jsdom-align environment + threads pool + RTL cleanup pattern is the template for every future component test in this phase (01-08/01-09 UI-heavy plans).
- `verify:phase-1` fully green after this plan (eslint, prettier, tsc, wxt build, vitest 54/54, isolation check).

---

*Phase: 01-mv3-wxt-runtime-antd-shells-workspace*
*Completed: 2026-08-08*

## Self-Check: PASSED

- All 13 created files exist on disk (8 source + 4 tests + 1 env)
- All 3 task commits found in git log: 711fc3b (Task 1), 25dbbb0 (Task 2), 83c5a5d (Task 3)
- Plan `<verification>` green: `pnpm vitest run tests/core/error tests/components` → 20/20; `pnpm tsc --noEmit` → exit 0; banned-markdown grep == 0
- Full suite green: `pnpm vitest run` → 10 files / 54/54 passed
- `pnpm run verify:phase-1` green (eslint, prettier, tsc, wxt build, vitest, isolation check)
- All acceptance criteria greps pass:
  - Task 1: vitest exit 0 ✓; WORKSPACE_INIT|THEME_INIT|REGISTRY_INIT|CMDK_QUERY == 4 ✓; redact >= 1 ✓
  - Task 2: tsc exit 0 ✓; CMD_K|isCmdK == 2 ✓; getString|formatString == 2 ✓
  - Task 3: component tests exit 0 ✓; componentDidCatch == 1 ✓; DOMPurify|skipHtml >= 1 ✓; react-markdown in src == 0 ✓; MinimalMode files absent ✓
