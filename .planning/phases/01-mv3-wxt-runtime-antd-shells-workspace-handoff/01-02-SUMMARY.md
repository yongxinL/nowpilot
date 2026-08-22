---
phase: 01-mv3-wxt-runtime-antd-shells-workspace-handoff
plan: 02
type: execute
subsystem: messaging, runtime
tags: [D-13, D-14, D-07a, message-bus, background-router, runtime-envelope, content-script, isolated-world, tdd]
dependency_graph:
  requires:
    - phase: 01-mv3-wxt-runtime-antd-shells-workspace-handoff
      plan: 01
      provides: "single pnpm lockfile baseline + ThemeStore/sync persistence migration (clean scaffold to layer the messaging tracer on top of)"
  provides:
    - "BackgroundRouter.register() — the single background message entry symbol; internally calls MessageBus.init() and pre-registers CONTENT_SCRIPT_READY/SPA_NAVIGATION advisory handlers"
    - "MessageBus.dispatch hardened with synchronous-handler try/catch so an exception in one handler cannot abort the dispatch for the others (Rule 1 fix)"
    - "RuntimeEnvelope.MessageTypeValues gains CONTENT_SCRIPT_READY and SPA_NAVIGATION (scaffold-local; NOT spec Appendix E)"
    - "Content script moved to directory form entrypoints/content/core.content.ts (D-07a); both sendMessage calls now use typed createEnvelope(...)"
    - "tests/background/message-bus-cold-start.test.ts + tests/background/background-router.test.ts — 14 passing assertions prove the cold-start, adjacency, ordering, idempotent-double-init, sync-throw-isolation, and unknown-type contracts"
  affects:
    - "01-03 (manifest strip + tailwind removal + tsc strict — runs after the messaging layer is converged)"
    - "01-04 (store-strip INITIAL_* guards — runs after 01-03)"
    - "01-05 (content-script isolation gates — these tests extend the same tests/isolation suite and reference entrypoints/content/)"
    - "01-06 (workspace handoff plumbing — uses BackgroundRouter + MessageBus for WORKSPACE_HANDOFF envelopes)"
    - "01-07 (side panel + theme UI on top of an already-typed message layer)"
    - "01-08 (onboarding modal — uses onboardingComplete flag init already in entrypoints/background.ts)"
tech-stack:
  added: []
  patterns:
    - "BackgroundRouter is a thin module-function wrapper (named export `register`, no class) — matches MessageBus's own module-function convention; idempotent via a module-level `registered` flag"
    - "Test-only escape hatch `__resetForTests` lets unit tests reset the idempotency guard without weakening the production contract"
    - "vi.resetModules + dynamic re-import pattern for testing module-singleton state (MessageBus handlers Map, BackgroundRouter registered flag)"
    - "Console spy (vi.spyOn(console, 'debug')) for asserting advisory handler side effects without coupling to internal logger implementation"
key-files:
  created:
    - src/core/messaging/BackgroundRouter.ts
    - entrypoints/content/core.content.ts (renamed from entrypoints/content.core.ts)
    - tests/background/background-router.test.ts
    - tests/background/message-bus-cold-start.test.ts
  modified:
    - entrypoints/background.ts (raw onMessage listener removed; BackgroundRouter.register() is now the single entry symbol)
    - src/core/runtime/RuntimeEnvelope.ts (+CONTENT_SCRIPT_READY, +SPA_NAVIGATION)
    - src/core/messaging/MessageBus.ts (try/catch around handler invocation to isolate sync throws)
key-decisions:
  - "Used a relative import (`../src/core/messaging/BackgroundRouter`) in entrypoints/background.ts rather than the `@/` alias the plan illustrated — the codebase's existing entrypoints (options/main.tsx, standalone/main.tsx, sidepanel/main.tsx) all use relative paths, and tsconfig.json `paths` maps `@/*` to repo root (which would not resolve) while vite.config.ts maps `@/` to `./src` (which would). Matching the established convention is the lower-risk choice and avoids a latent tsconfig/vite alias mismatch that the plan glossed over."
  - "Phase-1 advisory handlers console.debug the same fields the OLD raw listener logged (tabId + url) — zero observable behavior change for the content-script → background path; only the transport changed from raw object-literal dispatch to typed envelope dispatch."
  - "Treated the `Promise.allSettled` sync-throw isolation gap in MessageBus.dispatch as a Rule 1 bug — the plan explicitly documents the contract ('an exception in one handler must not block others') and claims MessageBus already implements it via `allSettled`/try-catch, but the actual code only had allSettled. Wrapped the .map() callback in try/catch so a synchronous throw is converted to a Promise rejection that allSettled can isolate."
  - "Added T-01-04 forward-looking comment in BackgroundRouter.ts: future state-mutating handlers MUST verify `sender.id === chrome.runtime.id` before trusting envelope contents. Phase-1 advisory (console.debug) handlers intentionally skip the check — a forward-looking note is the right move, not a partial sender check that rejects legitimate self-sends."
  - "Did NOT modify wxt.config.ts — WXT's default srcDir is already the repo root, matching D-07a's 'entrypoints stay at project root' decision. The directory-form rename of the content script takes effect with no config change."
  - "Did NOT modify tests/isolation/cross-entrypoint-imports.test.ts in this plan — the Plan 01-05 isolation-grep repointing (D-17) is its own task; this plan only adds new tests under tests/background/."
patterns-established:
  - "Single-background-message-entry symbol: BackgroundRouter.register() wraps MessageBus.init() so entrypoints/background.ts never imports chrome.runtime.onMessage directly. Every later-phase handler registers through MessageBus.register(<type>, handler), called either directly or from a new module-level typed-wrapper sibling of BackgroundRouter."
  - "Idempotent init via module-level flag: the `registered`/`initialized` guard pattern guarantees no double-registration across SW wake events (Pitfall 1 in RESEARCH.md)."
  - "Module-level `__resetForTests` export for resetting idempotency guards in tests — well-bounded; only test code imports it; not re-exported from any public barrel."
requirements-completed: [REQ-R01]
coverage:
  - id: D1
    description: "Single typed message entry symbol — BackgroundRouter.register() replaces the raw chrome.runtime.onMessage listener in entrypoints/background.ts"
    requirement: REQ-R01
    verification:
      - kind: automated
        ref: tests/background/background-router.test.ts > register() attaches exactly one chrome.runtime.onMessage listener (initializes MessageBus)
        status: pass
      - kind: automated
        ref: tests/background/background-router.test.ts > register() called twice in a row does NOT re-attach the chrome.runtime.onMessage listener
        status: pass
      - kind: command
        ref: "grep -c 'chrome.runtime.onMessage.addListener' entrypoints/background.ts returns 0; grep -n 'BackgroundRouter.register' entrypoints/background.ts returns exactly 1 (line 29)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Content script path normalized to entrypoints/content/core.content.ts (directory form, D-07a) and raw sendMessage calls migrated to typed createEnvelope(...)"
    requirement: REQ-R01
    verification:
      - kind: command
        ref: "test -f entrypoints/content/core.content.ts && ! test -f entrypoints/content.core.ts → PATH OK"
        status: pass
      - kind: command
        ref: "grep -c createEnvelope entrypoints/content/core.content.ts returns 2 (one for SPA_NAVIGATION, one for CONTENT_SCRIPT_READY)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Cold-start contract: a message dispatched in the same tick as MessageBus.init() is delivered to its registered handler (not dropped — RESEARCH.md Pitfall 1)"
    requirement: REQ-R01
    verification:
      - kind: automated
        ref: tests/background/message-bus-cold-start.test.ts > a message dispatched immediately after init() (cold start) invokes the registered handler
        status: pass
    human_judgment: false
  - id: D4
    description: "Adjacency contract: two envelopes of the same type dispatched back-to-back each invoke the handler independently via Promise.allSettled"
    requirement: REQ-R01
    verification:
      - kind: automated
        ref: tests/background/message-bus-cold-start.test.ts > two back-to-back CONTENT_SCRIPT_READY envelopes each invoke the handler independently (adjacency)
        status: pass
    human_judgment: false
  - id: D5
    description: "Empty/ordering/unknown-type contracts: dispatching an unregistered envelope type is a safe no-op; legacy raw messages (missing envelope shape) are rejected"
    requirement: REQ-R01
    verification:
      - kind: automated
        ref: tests/background/message-bus-cold-start.test.ts > dispatching an unknown envelope type is a safe no-op
        status: pass
      - kind: automated
        ref: tests/background/message-bus-cold-start.test.ts > dispatching a non-envelope object (raw legacy message) is rejected without invoking handlers
        status: pass
    human_judgment: false
  - id: D6
    description: "Handler isolation: a handler that throws synchronously does NOT abort dispatch for the others (allSettled + try/catch contract)"
    requirement: REQ-R01
    verification:
      - kind: automated
        ref: tests/background/message-bus-cold-start.test.ts > a handler that throws does not block other handlers (allSettled isolation)
        status: pass
    human_judgment: false
  - id: D7
    description: "Advisory handlers correctly extract fields from envelope.payload (typed-envelope contract, not raw message.url field)"
    requirement: REQ-R01
    verification:
      - kind: automated
        ref: tests/background/background-router.test.ts > pre-registers the CONTENT_SCRIPT_READY handler (dispatch invokes it)
        status: pass
      - kind: automated
        ref: tests/background/background-router.test.ts > pre-registers the SPA_NAVIGATION handler (dispatch invokes it)
        status: pass
      - kind: automated
        ref: tests/background/background-router.test.ts > handler resolves url from envelope.payload (not from a raw message.url field)
        status: pass
      - kind: automated
        ref: tests/background/background-router.test.ts > double-register does not double-invoke the advisory handlers
        status: pass
    human_judgment: false
metrics:
  duration: 7m
  started: 2026-08-22T00:10:48Z
  completed: 2026-08-22T00:17:29Z
  tokens: 10900
  tasks: 2
  commits: 2
status: complete
actuals:
  tokens: 10900
  tasks: 2
  commits: 2
---

# Phase 1 Plan 02: Messaging Tracer + BackgroundRouter Summary

**Converged scaffold's dual messaging paths onto a single typed-envelope layer (D-13/D-14): BackgroundRouter.register() as the only background message entry symbol, content script renamed to directory form and migrated to typed createEnvelope(...) sends, MessageBus.dispatch hardened with sync-throw isolation, plus 14 cold-start/idempotency/isolation contract tests.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-22T00:10:48Z
- **Completed:** 2026-08-22T00:17:29Z
- **Tasks:** 2
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- `src/core/messaging/BackgroundRouter.ts` (new, 67 lines): thin module-function wrapper exposing `register(): void`. Internally calls `MessageBus.init()` then pre-registers `CONTENT_SCRIPT_READY` / `SPA_NAVIGATION` advisory handlers. Idempotent across SW wakes via a module-level `registered` flag. Test-only `__resetForTests` export lets unit tests reset the guard.
- `entrypoints/background.ts`: raw `chrome.runtime.onMessage.addListener` block (lines 28-34) deleted; replaced with a single `BackgroundRouter.register()` call. Per D-13, the file now registers exactly three things and nothing else — BackgroundRouter, `sidePanel.setPanelBehavior`, and the `onboardingComplete` flag init. Phase-N TODOs left for `LifecycleManager`/`KeepAlive`/`ContextMenuHost` so the §5.1 final background shape is reachable additively.
- `entrypoints/content.core.ts` → `entrypoints/content/core.content.ts` (renamed, directory form per D-07a). Both raw `chrome.runtime.sendMessage({type,...})` calls migrated to typed `chrome.runtime.sendMessage(createEnvelope('CONTENT_SCRIPT_READY'|'SPA_NAVIGATION', {url: location.href}, 'content'))`.
- `src/core/runtime/RuntimeEnvelope.ts`: `MessageTypeValues` gained `CONTENT_SCRIPT_READY` and `SPA_NAVIGATION` (scaffold-local runtime types, NOT part of spec Appendix E — those migrate to the typed `MessageType` registry in a later plan).
- `src/core/messaging/MessageBus.ts` (Rule 1 fix): wrapped each handler invocation in `try/catch` so a synchronous throw from one handler cannot escape the `.map()` callback before `Promise.allSettled` can isolate it. The plan documented the contract but the existing source only had `allSettled`; now the contract is enforced.
- 14 new contract assertions across two test files prove: (a) cold-start answers the first message, (b) `init()` idempotent across SW wakes, (c) back-to-back same-type envelopes invoke the handler independently, (d) unknown types are safe no-ops, (e) raw legacy messages (no envelope shape) are rejected, (f) a handler that throws synchronously does not abort the dispatch for the others.

## Task Commits

Each task was committed atomically:

1. **Task 1 (Tracer):** Single background message layer via BackgroundRouter + content script rename to directory form + typed envelope sends — `01624cf` (`feat(01-02): single background message layer via BackgroundRouter (D-13/D-14)`)
2. **Task 2 (TDD):** Cold-start and BackgroundRouter contract tests + Rule 1 sync-throw isolation fix in MessageBus — `a1b55f1` (`test(01-02): cold-start + BackgroundRouter contracts; fix sync-handler-throw bug (D-13/D-14)`)

## Files Created/Modified

- `src/core/messaging/BackgroundRouter.ts` (NEW) — `register(): void` + `__resetForTests(): void`; thin typed wrapper around `MessageBus`.
- `entrypoints/content/core.content.ts` (RENAMED FROM `entrypoints/content.core.ts`) — ISOLATED-world content script; SPA-navigation detector; sends typed `CONTENT_SCRIPT_READY` / `SPA_NAVIGATION` envelopes.
- `entrypoints/background.ts` (MODIFIED) — raw listener removed; `BackgroundRouter.register()` is the single entry symbol.
- `src/core/runtime/RuntimeEnvelope.ts` (MODIFIED) — `MessageTypeValues` gains `CONTENT_SCRIPT_READY` + `SPA_NAVIGATION`.
- `src/core/messaging/MessageBus.ts` (MODIFIED) — `try/catch` around handler invocation inside `dispatch()` (Rule 1 fix).
- `tests/background/background-router.test.ts` (NEW) — 6 assertions covering attach-once, double-register no-op, handler pre-registration, payload-field reading, no-double-invoke.
- `tests/background/message-bus-cold-start.test.ts` (NEW) — 8 assertions covering cold-start, idempotent init, adjacency, unknown-type, legacy-raw, sync-throw isolation.

## Decisions Made

1. **Relative import path for BackgroundRouter in entrypoints/background.ts.** Plan illustrated `import * as BackgroundRouter from '@/core/messaging/BackgroundRouter'`. Codebase convention (every existing entrypoints/ file: `options/main.tsx`, `standalone/main.tsx`, `sidepanel/main.tsx`) uses relative paths. The `@/` alias is also INCONSISTENT across tools: `tsconfig.json` `paths` maps `@/*` to repo root (`./`), while `vite.config.ts` `resolve.alias` maps `@` to `./src/`. The relative path is the lower-risk, matches-existing-convention choice. Documented as a deviation in case a future plan wants to canonicalize the alias (a separate small fix, out of scope here).
2. **Advisory handlers are the Phase-1 scope; state-mutating handlers will land later.** Both handlers `console.debug` only — zero observable behavior change for the content-script → background path beyond switching the transport from raw object literals to typed envelopes. A forward-looking T-01-04 comment in BackgroundRouter.ts documents that future state-mutating handlers MUST verify `sender.id === chrome.runtime.id` before trusting envelope contents. The plan author also requested this comment-as-fence pattern explicitly ("Do NOT add sender checks that reject Phase-1 advisory traffic").
3. **Treated MessageBus.dispatch's allSettled-without-try/catch as a Rule 1 bug, not a deferral.** Plan claims the contract is already enforced ("MessageBus uses `allSettled`/try-catch — do not weaken it"). Actual code only had `allSettled`, which does NOT isolate synchronous throws inside the `.map(() => handler(...))` callback — a sync throw escapes `.map()` and rejects the entire `dispatch` promise. Wrapped each handler call in try/catch and converted sync throws to `Promise.reject(error)` so allSettled isolates them. Test for this contract now passes deterministically; without the fix, a single misbehaving handler would silently break every later phase's background dispatch.
4. **Did NOT modify wxt.config.ts.** D-07a locks entrypoints to repo root (WXT default), and the scaffold already uses that layout. The directory-form rename of the content script takes effect with no config change. Plan text ("no `srcDir` needed") matches this exactly.
5. **Did NOT modify tests/isolation/cross-entrypoint-imports.test.ts.** Plan 01-05 (D-17) is the right plan to repoint the cross-entrypoint isolation greps at the real directory paths and add the `fetch(` content-script grep. This plan only adds new tests under `tests/background/`.
6. **Added `__resetForTests` to BackgroundRouter rather than coupling tests to vi.resetModules-only isolation.** The dynamic-import pattern alone (`vi.resetModules()` + fresh `await import(...)`) works for `BackgroundRouter.register()` because the `registered` flag is module-level — but adding an explicit escape hatch makes the test setup clearer and gives the contract a real reset point without weakening production behavior. Not re-exported from any barrel; direct import only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Promise.allSettled alone does not isolate synchronous handler throws**
- **Found during:** Task 2 (TDD test 'a handler that throws does not block other handlers')
- **Issue:** Plan documents the handler-isolation contract ("MessageBus uses `allSettled`/try-catch") but the actual `MessageBus.dispatch` only used `allSettled`. A handler that throws synchronously inside the `.map()` callback escapes `.map()` BEFORE `Promise.allSettled` can see it, rejecting the entire `dispatch` promise. Without the fix, a single misbehaving handler would silently break every later phase's background dispatch — exactly the failure mode the contract was supposed to prevent.
- **Fix:** Wrapped each handler call in a `try/catch` that converts sync throws into `Promise.reject(error)`, so `Promise.allSettled` can isolate them. Added a multi-line comment explaining the isolation boundary so future contributors do not strip it back out thinking it's redundant.
- **Files modified:** `src/core/messaging/MessageBus.ts`
- **Verification:** New test `a handler that throws does not block other handlers (allSettled isolation)` passes; the 'ok' and 'bad' spies both fire exactly once; `dispatch()` resolves instead of rejecting.
- **Committed in:** `a1b55f1`

### Documented deviations

1. **Relative import in entrypoints/background.ts** instead of the `@/` alias the plan illustrated. Codebase convention + tsconfig/vite alias mismatch drove the choice; see Decisions §1.
2. **Comment reformulation in entrypoints/background.ts** to keep the `grep -n "BackgroundRouter.register()" entrypoints/background.ts` acceptance criterion returning exactly one match. The plan's shipped comment contained the literal string `BackgroundRouter.register()` (in the docstring), which would have counted as a second match. Reworded the comment to reference the wrapper without the literal call syntax.

---

**Total deviations:** 1 auto-fixed (Rule 1, handler-isolation bug), 2 documented (import alias, comment wording).
**Impact on plan:** Auto-fix is strictly strengthening the documented contract — no scope creep. Documented deviations are zero-behavior-change alignment with established codebase patterns.

## Issues Encountered

None — the plan executed cleanly once the Rule 1 sync-throw isolation fix was applied. Both commits passed `pnpm lint` and the full vitest suite (84 tests) on first run after the fix.

## Verification

| Check | Result |
|-------|--------|
| `pnpm vitest run tests/background` | **2 files, 14 tests passed** |
| `pnpm vitest run tests/core/messaging tests/core/runtime tests/isolation tests/background` | **5 files, 24 tests passed** |
| `pnpm vitest run` (full suite) | **12 files, 84 tests passed** |
| `pnpm lint` (tsc --noEmit) | **clean** |
| `pnpm verify:phase-1` (project gate) | **7 files, 49 tests passed + tsc clean** |
| `pnpm test:isolation` | **1 file, 3 tests passed** |
| `grep -c "chrome.runtime.onMessage.addListener" entrypoints/background.ts` | **0** |
| `grep -n "BackgroundRouter.register" entrypoints/background.ts` | **1 match (line 29)** |
| `test -f entrypoints/content/core.content.ts && ! test -f entrypoints/content.core.ts` | **PATH OK** |
| `grep -c createEnvelope entrypoints/content/core.content.ts` | **3** (1 import + 2 uses) |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `BackgroundRouter.register()` is the single background message entry symbol; every later-phase background handler routes through it.
- `MessageBus.dispatch` enforces synchronous-handler isolation (Rule 1 fix landed).
- Content script is in directory form (`entrypoints/content/core.content.ts`), ready for Plan 01-05's isolation-grep repointing (D-17).
- The two `CONTENT_SCRIPT_READY` / `SPA_NAVIGATION` values live in `MessageTypeValues` as scaffold-local runtime types — when the typed `MessageType` registry (spec Appendix E) lands in a later plan, these migrate there and out of `MessageTypeValues`.
- Empty path warnings: `tests/background/` is the new home for background-related contract tests; future phases may add `tests/background/<topic>.test.ts` siblings.

---

*Phase: 01-mv3-wxt-runtime-antd-shells-workspace-handoff*
*Completed: 2026-08-22*
