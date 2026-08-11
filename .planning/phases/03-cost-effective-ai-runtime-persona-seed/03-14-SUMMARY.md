---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 14
subsystem: ui
tags: [chat, retry, ant-design-x, react, vitest, wr-04]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: ChatPage streaming surface (03-08) — Bubble/Bubble.List + Sender, 5-state machine, useStreamingLLM.retry contract
provides:
  - Latest-bubble-only Retry footer gate (`m.id === messages[messages.length - 1]?.id`) — recovery for the current turn, never a history control
  - WR-04 regression tests pinning stale-bubble inertness and latest-bubble recovery
affects: [phase 7 RICH polish — the Phase-3 Bubble/Sender surface retry semantics stay fenced; later chat-history/action surfaces must keep recovery scoped to the current turn]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Latest-bubble gate for turn-scoped recovery actions: a destructive UI action renders only when the target is the current turn's message, and its handler targets the last message — the gate makes last-message semantics sound"

key-files:
  created: []
  modified:
    - src/components/pages/ChatPage.tsx — Retry footer gated to the latest failed/offline assistant bubble; handleRetry comment documents why last-message targeting is now sound
    - tests/components/pages/ChatPage.test.tsx — 3 WR-04 regression tests

key-decisions:
  - "WR-04 fixed via the footer gate (m.id === messages[messages.length - 1]?.id) rather than a per-bubble retry target — matches UI-SPEC failed-row semantics (Retry = recovery for the current turn, not a history control) and keeps handleRetry's existing last-message logic"

patterns-established:
  - "Pattern 1: recovery actions on message lists are gated to the latest message (id equality against the list tail) so a stale-bubble click can never destroy newer content"

requirements-completed: [AI-03, AI-05, AI-06]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Retry footer gated to the latest failed/offline assistant bubble — stale bubbles no longer expose the destructive action"
    requirement: AI-03
    verification:
      - kind: unit
        ref: "tests/components/pages/ChatPage.test.tsx#Retry is NOT offered on a stale failed bubble after a newer completed send"
        status: pass
      - kind: unit
        ref: "tests/components/pages/ChatPage.test.tsx#clicking Retry on the latest failed bubble still works"
        status: pass
      - kind: unit
        ref: "tests/components/pages/ChatPage.test.tsx#Retry on the latest bubble replaces only the latest content"
        status: pass
      - kind: unit
        ref: "tests/components/pages/ChatPage.test.tsx#failed: partial text retained + Provider error. + Retry action (existing single-failed-bubble test — lone failed bubble IS the latest)"
        status: pass
    human_judgment: false
  - id: D2
    description: "handleRetry re-sends the latest user input with a NEW operationId — hook retry contract unchanged (useStreamingLLM.ts L197-200)"
    requirement: AI-03
    verification:
      - kind: unit
        ref: "tests/components/pages/useStreamingLLM.test.tsx (10 tests — retry/send contract unchanged)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-08-11
status: complete
---

# Phase [3] Plan [14]: WR-04 Retry Targeting Summary

**Retry footer gated to the latest failed/offline assistant bubble (`m.id === messages[messages.length - 1]?.id`) so a stale-bubble click can never wipe the newest answer or re-run a stale input, pinned by 3 regression tests**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-11T01:41:30Z
- **Completed:** 2026-08-11T01:46:47Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- ChatPage.tsx Retry footer now renders only on the latest assistant bubble: `m.id === messages[messages.length - 1]?.id && (m.status === 'failed' || m.status === 'offline')` — closes VERIFICATION.md gap 5 (WR-04) where every failed/offline bubble exposed a Retry that targeted the newest message
- handleRetry's existing last-message targeting (`prev[prev.length - 1]` + `role !== 'assistant'` guard) is now sound and documented as such — Retry always re-sends the correct latest input via `useStreamingLLM.retry()` (NEW operationId inside send, useStreamingLLM.ts L197-200)
- 3 new regression tests: stale-bubble no-retry after a newer completed send (0 `STR.chat.retry` buttons, newest answer intact), latest-bubble retry still works (`hookMock.retry` called once), latest-replaces-only-latest (exactly one Retry footer across two failed turns; first answer never wiped)
- Full `verify:phase-3` gate green: eslint + prettier --check + tsc --noEmit + wxt build + 461 vitest tests + content-bundle isolation check

## Task Commits

Each task was committed atomically:

1. **Task 1: WR-04 — scope the Retry footer to the latest assistant bubble** - `188273e` (fix)
2. **Task 2: WR-04 — regression tests (stale-bubble retry cannot wipe the newest message)** - `e512630` (test)

**Plan metadata:** (committed by orchestrator)

## Files Created/Modified
- `src/components/pages/ChatPage.tsx` - Retry footer condition gained the latest-bubble gate (L138-139); handleRetry comment (L76-81) documents why last-message semantics are now sound; footer JSX itself unchanged
- `tests/components/pages/ChatPage.test.tsx` - new `WR-04 retry targeting regression` describe block with 3 tests (85 lines added)

## Decisions Made
- Chose the footer gate (`m.id === messages[messages.length - 1]?.id`) over a per-bubble retry target — the plan's two options (03-REVIEW.md WR-04 sketch / 03-PATTERNS.md planner note). The gate matches UI-SPEC failed-row semantics (Retry = recovery for the current turn, not a history control) and requires no state tracking beyond the existing `messages` dependency.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## Next Phase Readiness
- ChatPage retry semantics are now deterministic: recovery is scoped to the current turn, the newest answer can never be destroyed by a stale click, and the hook retry contract is unchanged
- Phase 7 RICH polish (Welcome/Prompts/clarification chips/action panels) remains fenced (D-03) — the Phase-3 Bubble/Sender surface is untouched beyond the retry gate

---
*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-11*

## Self-Check: PASSED
- 03-14-SUMMARY.md exists on disk
- Commit 188273e (fix) present in git log
- Commit e512630 (test) present in git log
- All task acceptance criteria verified: footer gate grep match, Retry Button inside gated branch, ChatPage.test.tsx exits 0 (12 tests), useStreamingLLM.test.tsx exits 0 (10 tests), full verify:phase-3 green (57 files / 461 tests)

