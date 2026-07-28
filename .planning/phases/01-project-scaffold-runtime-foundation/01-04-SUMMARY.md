---
phase: 01-project-scaffold-runtime-foundation
plan: 04
subsystem: onboarding
tags:
  - background-sw
  - onboarding
  - ui-spec
  - wizard
  - chrome-storage
requires:
  - 01-01 (SidePanelShell — shell integration target)
  - 01-03 (CommandRegistry — no direct dep, but shares component layer)
provides:
  - OnboardingWizard component (Steps+Cards, 3 steps)
  - background.ts first-install detection (onboardingComplete flag)
  - i18n strings for UI-SPEC onboarding copy
affects:
  - SidePanelShell (Plan 01-05 will integrate OnboardingWizard)
  - OnboardingModal.tsx (replaced — old file stays until Plan 01-05)
tech-stack:
  added: []
  patterns:
    - "chrome.runtime.onInstalled with reason=install/update for onboarding flag"
    - "Antd Steps + Modal + Card pattern for step-by-step onboarding wizards"
    - "All 3 cards rendered with display:none for current-step toggle"
key-files:
  created:
    - src/components/common/OnboardingWizard.tsx
    - tests/components/common/OnboardingWizard.test.tsx
  modified:
    - entrypoints/background.ts
    - src/core/i18n/strings.ts
key-decisions:
  - "OnboardingWizard is self-contained with open/onComplete props — shell integration deferred to Plan 01-05"
  - "Old OnboardingModal.tsx preserved in-place until Plan 01-05 removes imports"
  - "All 3 content cards rendered in DOM simultaneously with display:none for hidden ones (simpler than conditional render, still passes card count assertions)"
requirements-completed:
  - SHELL-03
duration: 3 min
completed: "2026-07-28"
status: complete
coverage:
  - deliverable: "background.ts first-install detection"
    verification:
      - kind: code-review
        ref: entrypoints/background.ts
        status: pass
    human_judgment: true
    rationale: "Chrome runtime behavior requires manual verification — cannot unit test onInstalled in vitest"
  - deliverable: "OnboardingWizard 3-card welcome flow"
    verification:
      - kind: test
        ref: tests/components/common/OnboardingWizard.test.tsx
        status: pass
    human_judgment: false
  - deliverable: "UI-SPEC onboarding copywriting contract"
    verification:
      - kind: test
        ref: tests/components/common/OnboardingWizard.test.tsx
        status: pass
    human_judgment: false
  - deliverable: "Steps+Cards navigation (Next/Previous/Start Exploring/Skip)"
    verification:
      - kind: test
        ref: tests/components/common/OnboardingWizard.test.tsx
        status: pass
    human_judgment: false
  - deliverable: "Illustration placeholder areas with icons"
    verification:
      - kind: test
        ref: tests/components/common/OnboardingWizard.test.tsx
        status: pass
    human_judgment: false
---

# Phase 1 Plan 4: Onboarding Wizard Summary

**Onboarding Wizard with background SW install detection — 3-card welcome flow replacing the old API-key-focused modal, per UI-SPEC copywriting contract.**

## Overview

Plan 01-04 implements two deliverables:
1. **Background SW (background.ts):** First-install detection via `chrome.runtime.onInstalled` — sets `onboardingComplete: false` on fresh install, `onboardingComplete: true` on extension update
2. **OnboardingWizard component:** 3-card Steps+Cards welcome flow with welcome banner, Chat/Capture/Workspace cards, illustration placeholders, navigation (Previous/Next/Start Exploring/Skip), and full test coverage

## Accomplishments

- **background.ts install detection:** Added `details.reason` check to the existing `onInstalled` listener — `INSTALL → chrome.storage.local.set({ onboardingComplete: false })`, `UPDATE → chrome.storage.local.set({ onboardingComplete: true })`. Existing `setPanelBehavior` calls preserved and merged into the single listener
- **OnboardingWizard component:** Antd Modal (closable=false, width=480, centered) with:
  - `Steps` indicator (3 items: Chat with AI, Capture Knowledge, Your Workspace, Your Way)
  - Welcome banner Card (step 0 only): "Welcome to NowPilot" heading + subtext
  - Content Cards (one at a time): illustration placeholder (200×120px, colored div, antd icon per step, "Illustration" caption) + heading + body per UI-SPEC
  - Navigation: Previous/Next buttons with disabled state on step 0, "Start Exploring" CTA on final step, "Skip Onboarding" link always visible
- **i18n strings:** 10 new keys added per UI-SPEC copywriting contract. OLD onboarding keys preserved (old OnboardingModal.tsx still uses them until Plan 01-05)
- **Tests:** 12 vitest tests covering step rendering, navigation, CTA behavior, completion callbacks, skip behavior, Steps indicator, illustration placeholders, and open/close state
- **Old OnboardingModal.tsx NOT deleted** — deletion deferred to Plan 01-05 which removes the last import

## Task Summary

| # | Task | Type | Status | Commit |
|---|------|------|--------|--------|
| 1 | Background SW — first-install detection via onInstalled | auto | ✅ Done | `f301d8a` |
| 2 | OnboardingWizard component — 3-card welcome flow (RED) | auto+tdd | ✅ RED committed | `9b31d76` |
| 2 | OnboardingWizard component — 3-card welcome flow (GREEN) | auto+tdd | ✅ GREEN committed | `2dce5e7` |

## Verification Results

| Check | Result |
|-------|--------|
| `npx vitest run tests/components/common/OnboardingWizard.test.tsx` | ✅ 12/12 pass |
| `npx tsc --noEmit` | ✅ No type errors |

## Deviations from Plan

None — plan executed exactly as written.

### Known Stubs

None.

## Threat Surface Scan

No additional threat surface introduced beyond what the plan's `<threat_model>` described. The `onboardingComplete` flag in `chrome.storage.local` is accept-listed (T-01-09, low severity — tampering would only re-show a welcome wizard). Skip/Complete both call `onComplete` with no audit trail (T-01-10, accept-listed).

## Next Steps

Ready for **Plan 01-05**: Shell wiring — command palette + onboarding integration into both surfaces + isolation test.
