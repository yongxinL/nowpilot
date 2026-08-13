---
phase: 04b-trust-aware-context-and-receipts
plan: 05
subsystem: ui
tags: [trust, np_trust, options, zustand, antd-switch, chrome-storage, page-context, golden-rule-3]

requires:
  - phase: 04b-trust-aware-context-and-receipts
    provides: 04b-01 TrustPrefs/TrustPrefsSchema/DEFAULT_TRUST_PREFS/NP_TRUST_KEY (trustConfig.ts)
  - phase: 04b-trust-aware-context-and-receipts
    provides: 04b-04 trust-wired ContextOptimizer (buildTrustedContext + trustPrefs input seam)
  - phase: 04a-pagecontentservice-knowledge-acquisition
    provides: WorkspaceStore.currentPageContext (written by PageContentService.deliverContext)
provides:
  - Hook-side D-4b-09 wiring: useStreamingLLM.send() resolves page + trustPrefs at the chrome boundary and passes them as data into the pure optimizer
  - TrustSettingsStore (np_trust persistence: all-true initial + Zod-gated hydrate + write-through + rollback + onChanged sync, never throws)
  - OptionsPage content-trust Card (4 Switch rows, verbatim UI-SPEC copy, auto-save, E5-style rollback toast)
  - Six canonical STR keys (options.contentTrust / trustHelper / trustStructuralNote / trustSources.* / trustSaveFailed)
  - Component tests: useStreamingLLM page-feed cases + new OptionsPage suite
affects: [04b-06, phase 5 (notes/memory feeds), phase 6 (Prompt Inspector), phase 7 (RICH chat-embedded controls)]

tech-stack:
  added: []
  patterns:
    - AddonSettingsStore precedent applied to a preference store (plain zustand + chrome.storage.local write-through + onChanged remove-then-add T-1-11 + schema-gated hydrate)
    - Optimistic-set-then-rollback toggle (async setSource; call-site store-state comparison drives the E5-style toast)
    - Hook as the ONLY chrome-boundary input resolver (Pitfall 5) — the optimizer stays pure

key-files:
  created:
    - src/core/registry/TrustSettingsStore.ts
    - tests/components/pages/OptionsPage.test.tsx
  modified:
    - src/components/pages/useStreamingLLM.ts
    - src/core/i18n/strings.ts
    - src/components/pages/OptionsPage.tsx
    - tests/components/pages/useStreamingLLM.test.tsx
    - tests/components/standalone/StandaloneShell.test.tsx

key-decisions:
  - "Hook page read uses useWorkspaceStore.getState() inside send() — the plan's literal useWorkspaceStore(selector) hook call in a non-render callback would throw 'Invalid hook call' (Rule 1)"
  - "setSource is async Promise<void> (plan interface said void + fire-and-forget) so the Task-3 rollback-detection contract (store-state != requested → toast) can observe the rollback after await (Rule 1)"
  - "TrustSettingsStore.init() is called from OptionsPage's useEffect (plan lists no entrypoints; Options is Standalone-only) to satisfy the UI-SPEC hydrating row"

requirements-completed: [TRUST-03]

coverage:
  - id: D1
    description: "useStreamingLLM.send() resolves trustPrefs (readTrustPrefs) + currentPage (WorkspaceStore.currentPageContext) and passes pageContext: currentPage + trustPrefs into the trust-wired optimizer (D-4b-09); no-page path stays byte-identical pre-4b"
    requirement: TRUST-03
    verification:
      - kind: unit
        ref: "tests/components/pages/useStreamingLLM.test.tsx#a seeded currentPageContext + all-true np_trust → a wrapped context section in BOTH stage contexts"
        status: pass
      - kind: unit
        ref: "tests/components/pages/useStreamingLLM.test.tsx#no currentPageContext → NO context section (pre-4b drop-in, D-4a-06)"
        status: pass
      - kind: unit
        ref: "tests/components/pages/useStreamingLLM.test.tsx#np_trust page:false → NO context section (trust_disabled gate through the REAL optimizer)"
        status: pass
    human_judgment: false
  - id: D2
    description: "TrustSettingsStore persists np_trust (all-true initial, TrustPrefsSchema-gated hydrate with all-true fallback, write-through + rollback, onChanged remove-then-add sync, never throws)"
    verification:
      - kind: unit
        ref: "tests/components/pages/OptionsPage.test.tsx#toggling the Pages switch flips store state and writes np_trust through"
        status: pass
      - kind: unit
        ref: "tests/components/pages/OptionsPage.test.tsx#invalid np_trust storage → all-true fallback"
        status: pass
      - kind: unit
        ref: "tests/components/pages/OptionsPage.test.tsx#write failure → optimistic set rolled back + STR.options.trustSaveFailed toast"
        status: pass
    human_judgment: false
  - id: D3
    description: "OptionsPage content-trust Card — 4 Switch rows in fixed order Pages → Notes → Memory → Tool results, helper caption, structural note, auto-save, no Save button/icons"
    verification:
      - kind: unit
        ref: "tests/components/pages/OptionsPage.test.tsx#renders the content-trust card after Appearance with helper + structural note + 4 ON switches by default"
        status: pass
    human_judgment: true
    rationale: "Card layout and visual hierarchy (spacing, hairline divider, muted caption styling per 04b-UI-SPEC Visual Hierarchy) are not assertable in jsdom — visual adequacy needs a human check"
  - id: D4
    description: "Six verbatim STR keys from the 04b-UI-SPEC Copywriting Contract (contentTrust, trustHelper, trustStructuralNote, trustSources.pages/notes/memory/toolResults, trustSaveFailed) — Golden Rule 2 canonical additions"
    verification:
      - kind: other
        ref: "grep byte-exact literals in src/core/i18n/strings.ts + render assertions in tests/components/pages/OptionsPage.test.tsx"
        status: pass
    human_judgment: false

duration: 17min
completed: 2026-08-13
status: complete
---

# Phase 04b Plan 05: Trust-aware hook wiring + content-trust Options Card Summary

**D-4b-09 hook wiring live (pageContext + trustPrefs into the trust-wired optimizer), TrustSettingsStore persisting np_trust (AddonSettingsStore precedent), and the OptionsPage content-trust Card with the verbatim 04b-UI-SPEC copy — the only user-facing 4b surface (TRUST-03).**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-13T16:05:00Z
- **Completed:** 2026-08-13T16:22:00Z
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments

- `useStreamingLLM.send()` now resolves the trust-aware page feed at the chrome boundary (`readTrustPrefs()` + `WorkspaceStore.currentPageContext`) and passes `pageContext: currentPage` + `trustPrefs` as **data** into the pure optimizer (Pitfall 5; Golden Rule 3 — no prompt assembly). The no-page path stays byte-identical to pre-4b (no context section), and the `np_trust page:false` gate routes through the real trust stage.
- `TrustSettingsStore` ships: all-true initial state (switches render at default-ON immediately), `TrustPrefsSchema`-gated hydrate from `np_trust` with all-true fallback (T-4b-06: tampered key degrades to safe defaults, never a crash/bypass), write-through with optimistic-set rollback on failure, and the `onChanged` remove-then-add listener (T-1-11) for cross-surface sync — never throws (Golden Rule 9).
- `OptionsPage` gains the content-trust Card after Appearance (UI-SPEC Visual Hierarchy): helper caption, hairline divider, four Switch rows in fixed order Pages → Notes → Memory → Tool results, structural-note caption, auto-save with no Save button/icons, and the E5-style rollback toast (`STR.options.trustSaveFailed`) when a toggle write fails.
- Six canonical STR keys added verbatim from the 04b-UI-SPEC Copywriting Contract (Golden Rule 2).

## Task Commits

Each task was committed atomically:

1. **Task 1: Trust-aware pageContext wiring in useStreamingLLM.ts (D-4b-09)** - `c57cae2` (feat) — hook resolves page + prefs, optimizerBase threads `pageContext: currentPage` + `trustPrefs`; test extended with 3 page-feed cases
2. **Task 2: TrustSettingsStore — np_trust persistence store** - `39a1cfd` (feat) — new store (all-true initial + Zod-gated hydrate + write-through + rollback + onChanged sync)
3. **Task 3: OptionsPage content-trust Card + STR keys + component test** - `f42f23c` (feat) — 6 verbatim STR keys, content-trust Card, new OptionsPage.test.tsx (6 tests), StandaloneShell test-infra fix

**Plan metadata:** pending (docs commit follows)

## Files Created/Modified

- `src/core/registry/TrustSettingsStore.ts` (NEW) - np_trust preference store: `TrustSettingsState` interface, `useTrustSettingsStore` (zustand), `init()` (hydrate + onChanged listener), `setSource(kind, on)` (optimistic set + write-through + rollback), internal `writeStorage`/`parseTrustPrefs`
- `src/components/pages/useStreamingLLM.ts` - send() resolves `trustPrefs` + `currentPage`; optimizerBase passes `pageContext: currentPage` + `trustPrefs`
- `src/core/i18n/strings.ts` - six canonical keys under `options`: `contentTrust`, `trustHelper`, `trustStructuralNote`, `trustSources.{pages,notes,memory,toolResults}`, `trustSaveFailed` (verbatim)
- `src/components/pages/OptionsPage.tsx` - content-trust Card (title/helper/4 Switch rows/structural note), `handleTrustToggle(kind, on)`, `init()` on mount via useEffect
- `tests/components/pages/useStreamingLLM.test.tsx` - extended: seeded-page → wrapped context section in both stages; no-page → no context section; `page:false` → trust_disabled gate through the real optimizer; beforeEach resets `currentPageContext`
- `tests/components/pages/OptionsPage.test.tsx` (NEW) - 6 tests covering populated/partial/empty(defaults)/invalid-storage fallback/toggle write-through/failure-rollback rows + Account/Appearance ordering
- `tests/components/standalone/StandaloneShell.test.tsx` - afterEach re-stubs `chrome` after `unstubAllGlobals` (Rule 3 fix)

## Decisions Made

- Hook page read uses `useWorkspaceStore.getState().workspace.currentPageContext` inside `send()` — the plan's literal `useWorkspaceStore((s) => ...)` hook call in a non-render callback would throw "Invalid hook call" (React hooks rules); `getState()` is the same store read live at call time (Rule 1).
- `setSource` is `Promise<void>` (plan interface declared `void` + fire-and-forget) — required so the Task-3 rollback-detection contract (`getState().prefs[kind] !== on` → E5 toast) observes the rollback after `await setSource(...)`. Optimistic set → awaited write → rollback on failure (UI-SPEC failure row).
- `TrustSettingsStore.init()` is called from OptionsPage's `useEffect` — the plan lists no entrypoints in `files_modified`, and Options is Standalone-only (UI-SPEC §2), so the page mount is the plan-scoped hydration point satisfying the UI-SPEC hydrating row.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Invalid hook call in send()**
- **Found during:** Task 1 (hook wiring)
- **Issue:** The plan's literal `useWorkspaceStore((s) => s.workspace.currentPageContext)` inside `send()` — a non-render callback — would throw "Invalid hook call" at runtime (zustand v5 `useStore` invokes `useSyncExternalStore`).
- **Fix:** `useWorkspaceStore.getState().workspace.currentPageContext` — same store, read live at call time (the plan's own "store subscription precedent" only holds at the component top-level, L115-116).
- **Files modified:** src/components/pages/useStreamingLLM.ts
- **Verification:** 23 hook tests green (incl. the 3 new page-feed cases that would have crashed on the literal call).
- **Committed in:** c57cae2

**2. [Rule 1 - Bug] setSource could never satisfy the rollback-detection contract**
- **Found during:** Task 2 (store) / Task 3 (call site)
- **Issue:** The plan's Task-2 interface (`setSource(...): void` + fire-and-forget `void writeStorage(next)`) combined with its Task-3 call site (`await setSource(...)` then compare `getState().prefs[kind] !== on`) can never fire the rollback toast — the optimistic set stays, so the comparison is always false.
- **Fix:** `setSource` is `Promise<void>`; it awaits the write and rolls the optimistic set back to the last persisted value on failure — the call-site comparison then detects the failure and surfaces `STR.options.trustSaveFailed` (UI-SPEC failure row; E5 precedent).
- **Files modified:** src/core/registry/TrustSettingsStore.ts
- **Verification:** OptionsPage.test.tsx "write failure → rolled back + toast" passes (spy rejects the storage write; switch reverts; toast appears).
- **Committed in:** 39a1cfd

**3. [Rule 3 - Blocking] StandaloneShell.test.tsx chrome global torn down**
- **Found during:** Task 3 (full-suite run after OptionsPage shipped)
- **Issue:** The file's `vi.unstubAllGlobals()` afterEach also tears down the WXT vitest plugin's `chrome` stub (installed once at file setup); the next test in the file mounting OptionsPage hit "chrome is not defined" inside the new `TrustSettingsStore.init()` onChanged wiring → unhandled rejection.
- **Fix:** Re-stub `chrome` (fakeBrowser) in the afterEach after unstubAllGlobals — restores the plugin's environment guarantee; the test's own IO stubs are still cleared.
- **Files modified:** tests/components/standalone/StandaloneShell.test.tsx
- **Verification:** Full suite 87 files / 788 tests pass with zero unhandled errors.
- **Committed in:** f42f23c

**4. [Rule 2 - Missing Critical] init() hydration wiring**
- **Found during:** Task 3 (OptionsPage)
- **Issue:** The plan requires the UI-SPEC hydrating row (mount renders switches at default-true, init() hydrates from storage) but lists no entrypoint in `files_modified` — nothing would ever call `init()`.
- **Fix:** `useEffect(() => { void useTrustSettingsStore.getState().init(); }, [])` in OptionsPage — the plan-scoped surface (Options is Standalone-only).
- **Files modified:** src/components/pages/OptionsPage.tsx
- **Verification:** OptionsPage.test.tsx persisted-hydration + invalid-fallback tests pass.
- **Committed in:** f42f23c

---

**Total deviations:** 4 auto-fixed (3 Rule 1, 1 Rule 3, 1 Rule 2)
**Impact on plan:** All fixes were required for the plan's own contracts to hold (rollback detection, hydration, hook-safety, test-env stability). No scope creep — no new packages, no quarantine/trust UI beyond the card (Invisible-by-contract holds).

## Issues Encountered

- None — the deviation list above covers the unplanned work; all planned verification passed on the first full-suite run after the Rule 3 fix.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 04b-06 (receipt/CTX-06 verification plan) can build on the live feed — the hook now supplies the page + prefs end-to-end.
- The `page:false` gate and no-page drop-in paths are pinned by tests, so the 04b-06 receipt assertions can rely on the produced `OptimizedContext.provenance` (receipt rows + CTX-06 counters) without re-testing the feed wiring.
- Deferred per D-4b-07: per-source-ID controls, chat-embedded controls, Prompt Inspector UI (Phase 5+/6/7).

---

*Phase: 04b-trust-aware-context-and-receipts*
*Completed: 2026-08-13*

## Self-Check: PASSED

- Created files verified on disk: `src/core/registry/TrustSettingsStore.ts`, `tests/components/pages/OptionsPage.test.tsx`, `04b-05-SUMMARY.md`
- Commits verified in git log: `c57cae2` (Task 1), `39a1cfd` (Task 2), `f42f23c` (Task 3)
- Plan-level verification: `useStreamingLLM.test.tsx` 23/23, `OptionsPage.test.tsx` 6/6, `ContextOptimizer.test.ts` 22/22, `tsc --noEmit` clean, full suite 87 files / 788 tests green, eslint + prettier clean
