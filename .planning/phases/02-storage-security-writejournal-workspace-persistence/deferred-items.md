# Deferred Items — Phase 2

Out-of-scope findings recorded during execution (SCOPE BOUNDARY: not caused by the
current task's changes, so not fixed here). Each entry names the owning plan or
phase where it should be picked up.

---

**1. [pre-existing, Phase 1 code] `StandaloneShell`'s minimum-viewport `Alert` uses the AntD v5 `message` prop**

- **Found during:** 02-09, Task 2 (`npx vitest run tests/components/StandaloneShell.test.tsx`)
- **Observation:** `src/components/standalone/StandaloneShell.tsx:329` renders `<Alert message={t('standalone.minWidth')} … />`. AntD v6 emits `Warning: [antd: Alert] 'message' is deprecated. Please use 'title' instead.` on every render. The value still renders (the suite's `alert.textContent` assertion passes), so this is a warning, not a break.
- **Why not fixed here:** the `<Alert>` is Phase-1 shipped markup and is not part of 02-09's change; the 02-UI-SPEC pins the element as the existing approved presentation. 02-10's own plan already pins the v6 prop names (`title`/`description`/`actions`) for the **new** notice component, so the convention exists — the Phase-1 call site was simply not swept.
- **Suggested owner:** the next plan that edits `StandaloneShell.tsx` for a presentation reason, or 02-13's `verify:phase-2` sweep if it is widened to assert a warning-free render. Two other `<Alert>` call sites exist (`src/components/onboarding/OnboardingFlow.tsx`, `src/components/common/DeferredNotice.tsx`) and should be checked for the same prop in the same pass.

---

**2. [cross-plan contract, deliberately not closed] The 400 px `MirrorBanner` observation**

- **Found during:** 02-09 plan-level verification.
- **Observation:** the mechanism (`min-height: 32px`, no fixed `height`) is asserted, but whether the bar actually grows, the caption wraps to at most two lines and the action never clips at a 400 px Side Panel width cannot be observed in jsdom.
- **Owner:** Phase 15's consolidated Real-Chrome acceptance cycle — recorded in `02-VALIDATION.md` § Manual-Only Verifications and as coverage entry **D7** of `02-09-SUMMARY.md`. Phase 2 must not claim it closed.
