---
phase: 04-agent-reliability-and-evidence
plan: 04
subsystem: ai
tags: [agent-orchestrator, abort, aborted-outcome, q1, agt-04, agt-03, d-45, trajectory]

# Dependency graph
requires:
  - phase: 04-03
    provides: "AGT-04 deterministic replan/terminal policy + finish() effective status/reasonCode mapping (the choke point the aborted outcome joins)"
  - phase: 04-01
    provides: "canonical C.1 types + trajectory tracker (closed TRAJECTORY_TRANSITIONS table incl. amended [planning, aborted] row) + OutcomeVerifier"
provides:
  - "Q1 boundary AbortError conversion: runAgentTurn RESOLVES with status 'aborted' AgentTurnOutcome instead of throwing past the boundary (AGT-04 DONE-when)"
  - "Aborted outcome contract: status 'aborted', reasonCode 'aborted' (C.1 status doubles as reason, D-38), streamedText '' (D-45 partial dropped), operationId re-threaded, evidence [], trajectory terminal 'aborted' via enter('aborted') validated against the closed table"
  - "useChatStreaming consumer branch on output.status === 'aborted' — clears generating state, no failure toast, no partial text; defensive AbortError catch retained for non-caller aborts"
  - "Reworked case (e): abort tests now assert RESOLUTION (was rejects.toThrow); chat-integration case (c) journalSpy-never-fires stays green"
  - "fix(04-03) history repair: the finish() 'replanning' → 'planning' normalization documented in 04-03's SUMMARY was never actually committed — landed as bdb64bb so HEAD passes the gate"
affects: [phase-05 (context assembly), phase-11 (trajectory persistence — aborted terminal must be persistable), phase-18 (verifier registration), chat-integration contract]

# Actuals (#2632) — pairs with the plan's `estimate` (20000 tokens) to calibrate future estimates.
actuals:
  tokens: 5426    # chars/4 over the realized 04-04 diff (21705 chars across AgentOrchestrator.ts + useChatStreaming.ts + test)
  tasks: 2        # tasks completed
  commits: 3      # 2 production commits (3aa2132, 77dc30b) + 1 history-repair commit (bdb64bb)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Boundary conversion pattern (Q1/A4): a central try/catch at the runAgentTurn edge converts ONLY DOMException('aborted','AbortError') into a returned outcome; every other error rethrows unchanged (T-4-11 — an internal failure cannot masquerade as a user abort)"
    - "Aborted-terminal trajectory entry: enter('aborted') is legal from every non-terminal closed-table row (assembling-context via amended [planning, aborted]; rendering via [completed, failed, aborted]; mid-loop states) — asserted by AGT-01"
    - "Consumer contract: the hook branches on output.status BEFORE reasonCode branching; the defensive catch stays for renderer-internal aborts that never reach the boundary"

key-files:
  created: []
  modified:
    - src/core/ai/AgentOrchestrator.ts
    - src/components/chat/useChatStreaming.ts
    - tests/core/ai/AgentOrchestrator.test.ts

key-decisions:
  - "Q1 (A4): convert abort to a RETURNED 'aborted' outcome at the boundary — the three existing throw sites stay in place inside the try; the boundary catch is the single conversion point (no per-site returns, loop structure intact)"
  - "reasonCode 'aborted' reuses the C.1 status value as the descriptive reason (D-38 — no invented §21.6 error code)"
  - "persistTurn is NEVER invoked on the aborted path (D-45): the seam lives inside finish(), which an aborted turn never reaches"
  - "The hook's AbortError catch is retained as a DEFENSIVE fallback for non-caller aborts (renderer-internal 'aborted' terminations that never reach the boundary catch) — not removed"
  - "History repair: 04-03's documented normalization deviation was never staged into 6d09d98; committed separately as bdb64bb to restore a green HEAD (Rule 3 auto-fix)"

patterns-established:
  - "Abort lifecycle end-to-end: caller Stop → AbortSignal → boundary catch → returned 'aborted' outcome → hook branch (clear generating, no toast) → finally clears np_active_stream; the stopped note is owned by handleStopGenerating"

requirements-completed: [AGT-03, AGT-04]

# Coverage metadata (#1602) — one entry per shipped deliverable.
coverage:
  - id: D1
    description: "Q1 boundary AbortError conversion in AgentOrchestrator.ts — runAgentTurn resolves with status 'aborted' (streamedText '', reasonCode 'aborted', operationId re-threaded, evidence [], trajectory terminal 'aborted') instead of throwing; persistTurn never invoked on abort (D-45); non-abort errors rethrow unchanged (T-4-11)"
    requirement: AGT-04
    verification:
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(e) abort — pre-aborted signal → resolves the aborted outcome; nothing persisted"
        status: pass
      - kind: unit
        ref: "tests/core/ai/AgentOrchestrator.test.ts#(e) abort — mid-stream during the renderer → resolves the aborted outcome; partial dropped"
        status: pass
      - kind: unit
        ref: "tests/core/ai/chat-integration.test.ts#(c) abort drops the partial — journalSpy never fires"
        status: pass
    human_judgment: false
  - id: D2
    description: "useChatStreaming consumer branch on output.status === 'aborted' (before configuration_required) — clears generating state, no failure toast, no partial text; defensive DOMException AbortError catch retained for non-caller aborts"
    requirement: AGT-04
    verification:
      - kind: unit
        ref: "tests/core/ai/chat-integration.test.ts#(c) abort drops the partial"
        status: pass
      - kind: automated_ui
        ref: "grep status === 'aborted' in useChatStreaming.ts line 230 (branch precedes configuration_required at 235); defensive catch at 273 retained"
        status: pass
    human_judgment: false

# Metrics
duration: 4min
completed: 2026-08-29
status: complete
---

# Phase 04 Plan 04: Q1 Boundary Abort → Returned 'aborted' Outcome Summary

**Q1's most invasive behavioral change: runAgentTurn now RESOLVES with a returned `status: 'aborted'` AgentTurnOutcome instead of throwing AbortError past the boundary — the sole consumer (useChatStreaming) branches on the returned status, case (e) is reworked from throw-assertion to resolve-assertion, and the full phase-4 gate stays green (183 tests)**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-29T00:32:46Z
- **Completed:** 2026-08-29T00:36:41Z
- **Tasks:** 2 (2 auto)
- **Files modified:** 3 (+1 history-repair commit)

## Accomplishments
- **Boundary conversion (Q1/A4) in `AgentOrchestrator.ts`:** the entire bounded loop is wrapped in a try/catch; the catch converts ONLY `DOMException('aborted','AbortError')` — the caller-signal abort — into the returned `AgentTurnOutcome`: `status 'aborted'`, `reasonCode 'aborted'` (the C.1 status value doubles as the descriptive reason — D-38, no invented §21.6 code), `streamedText ''` (D-45 partial dropped), `operationId input.operationId` (Pitfall 8), `evidence []`, the loop's live `plannerCalls`/`toolCalls`, accumulated `toolResults`, and the trajectory snapshot with the tracker having entered the terminal `'aborted'` phase (validated against the closed table — legal from every non-terminal row, AGT-01).
- **D-45 honored:** `persistTurn` is NEVER invoked on the aborted path — the seam lives inside `finish()`, which an aborted turn never reaches. The persist call remains exclusively on the completed-turn path (grep-asserted).
- **T-4-11 honored:** only the caller-signal AbortError converts; `ProviderError` (CR-06 renderer mid-stream error) and routed errors rethrow unchanged — case (i) stays green. The three existing throw sites stay in place inside the try; the boundary catch is the single conversion point.
- **Consumer branch in `useChatStreaming.ts`:** after `runAgentTurn`, `if (output.status === 'aborted') { setIsGenerating(false); return; }` sits BEFORE the `configuration_required` branch — the stopped turn produces no 'Generation failed' toast and no partial text (handleStopGenerating owns the stopped note); the `finally` still clears np_active_stream. The existing DOMException AbortError catch is retained as a defensive fallback for non-caller aborts.
- **Case (e) reworked (Q1):** both abort tests now assert RESOLUTION — `status 'aborted'`, `streamedText ''`, `reasonCode 'aborted'`, `trajectory.phase 'aborted'`, `operationId 'op-orchestrator'`, `evidence []`, and `persistTurn` NOT called. chat-integration case (c) (journalSpy never fires) stays green.
- **History repair (Rule 3):** the finish() 'replanning' → 'planning' normalization documented in 04-03's SUMMARY as committed in `6d09d98` was actually never staged — HEAD alone failed case (b) with `illegal trajectory transition: replanning -> rendering` (verified in a scratch worktree: 1/19 files red, 1 test failed). Committed the working-tree hunk as `bdb64bb` so the committed state alone passes the phase-4 gate.
- **Full gate green:** `pnpm run verify:phase-4` — 19 test files / 183 tests, `tsc --noEmit` clean, zero new NP-STRICT markers, defensive catch retained (grep-asserted).

## Task Commits

Each task was committed atomically:

1. **Task 1: Boundary AbortError conversion — runAgentTurn resolves 'aborted' outcome** - `3aa2132` (feat)
2. **Task 2: Consumer 'aborted' branch + reworked case (e)** - `77dc30b` (feat)

**History repair:** `bdb64bb` (fix(04-03) — the orphaned 'replanning' normalization; see Deviations)

**Plan metadata:** `04-04-SUMMARY.md` (docs, committed after this file)

## Files Created/Modified
- `src/core/ai/AgentOrchestrator.ts` - try/catch boundary conversion wrapping the whole loop; aborted outcome assembly (status/reasonCode/evidence/counters/streamedText ''/toolResults/trajectory with `enter('aborted')`); ORCHESTRATOR_ABORTED debugLog; finish() doc comment updated to reference the boundary conversion
- `src/components/chat/useChatStreaming.ts` - `output.status === 'aborted'` branch before the configuration_required check; defensive AbortError catch re-commented (non-caller fallback)
- `tests/core/ai/AgentOrchestrator.test.ts` - case (e) reworked to resolve-assertions (both tests); header comment updated

## Decisions Made
- **Q1 resolution (A4):** return the aborted outcome at the boundary rather than per-site returns — keeps the Appendix I loop structure intact and gives the phase a single conversion point (RESEARCH A4 recommendation followed verbatim).
- **reasonCode reuses the status value:** `'aborted'` is the C.1 closed status set member doubling as the descriptive reason — NO new §21.6 error code was invented (D-38).
- **Defensive catch retained:** the hook's DOMException AbortError catch is NOT removed — it backstops renderer-internal 'aborted' terminations that never surface through the boundary catch (non-caller aborts still surface through the error path, per the plan's must-have truth 4).
- **History repair attribution:** the orphaned normalization was committed as `fix(04-03)` (not folded into 04-04's commits) so the fix stays attributed to the plan that documented it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 04-03's documented 'replanning' normalization was never committed — HEAD failed the phase-4 gate**
- **Found during:** Plan start (pre-task verification, before Task 1)
- **Issue:** 04-03's SUMMARY records deviation 1 (the finish() 'replanning' → 'planning' normalization) as "Committed in: 6d09d98 (Task 1 commit)" — but `git show 6d09d98` lacks the hunk. A scratch-worktree check at HEAD proved the committed state alone fails: case (b) throws `illegal trajectory transition: replanning -> rendering` (1/19 test files red). The working tree carried the fix (the coherent state), which is why 04-03's gate looked green.
- **Fix:** Landed the working-tree hunk as a standalone `fix(04-03)` commit (`bdb64bb`) before starting Task 1 — restoring a green HEAD and matching 04-03's documented intent.
- **Files modified:** src/core/ai/AgentOrchestrator.ts (9-line hunk, already in working tree)
- **Verification:** scratch worktree at HEAD now passes case (b) and the full phase-4 gate (183 tests); the 04-04 production commits apply cleanly on top.
- **Committed in:** bdb64bb (standalone fix commit, not folded into 04-04's task commits)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The history repair was required for the committed state to be coherent (HEAD alone now passes the gate). It was NOT caused by this plan's changes — it is a pre-existing 04-03 close-out gap surfaced by pre-task verification. No scope creep; the 04-04 work itself followed the plan exactly.

## Issues Encountered
- None during planned work — the abort conversion, consumer branch, and case (e) rework all passed on first implementation. The only unplanned item was the pre-existing history gap documented above (not an issue with this plan's code).
- **Pre-existing dirty files note (consistent with 04-01/04-02/04-03):** 20 files of Phase-03 WIP (provider modernization: `src/services/aiProvider.ts` legacy `streamChatResponse`/`AVAILABLE_MODELS` removal, ProviderRegistry/ProviderRouter/RendererService/PlannerService changes, UI components, stores, and their tests) remain uncommitted in the working tree — deliberately out of scope for this plan, exactly as 04-02's SUMMARY documented. The phase-4 gate runs green WITH them present (183 tests includes the dirty test files). They are untouched by the 04-04 commits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- **Ready for phase verification:** `pnpm run verify:phase-4` green — 19 files / 183 tests; `pnpm run lint` clean; zero new NP-STRICT markers; D-45 (persistTurn never on abort), T-4-11 (only caller-signal AbortError converts), and AGT-04 DONE-when ("abort produces aborted") all asserted by tests.
- **Ready for phase-05:** the aborted terminal now resolves as a structured outcome — consumers and the trajectory machine both carry the 'aborted' phase; phase-11 trajectory persistence will need to persist the aborted terminal (the closed table already allows it).
- **Threat register:** T-4-10 (aborted-turn persistence) mitigated — persistTurn never fires on the aborted path, asserted by reworked case (e) + chat-integration (c); T-4-11 (aborted outcome mislabeling) mitigated — only DOMException AbortError converts, ProviderError rethrows (case (i) green); T-4-12 (consumer error-toast storm) mitigated — the hook branches on status 'aborted' before any error toast; T-4-SC (package legitimacy) N/A — zero new dependencies.

## Self-Check: PASSED

- [x] `.planning/phases/04-agent-reliability-and-evidence/04-04-SUMMARY.md` exists on disk
- [x] Task 1 commit `3aa2132` exists (`feat(04-04): boundary AbortError conversion — runAgentTurn resolves 'aborted' outcome instead of throwing`)
- [x] Task 2 commit `77dc30b` exists (`feat(04-04): consumer 'aborted' branch in useChatStreaming + reworked case (e)`)
- [x] History-repair commit `bdb64bb` exists (`fix(04-03): ... normalization documented in the 04-03 SUMMARY but never staged`)
- [x] `pnpm run lint` green (final state)
- [x] `pnpm run verify:phase-4` green — 19 test files / 183 tests
- [x] Grep guard: `status === 'aborted'` at useChatStreaming.ts:230 (before configuration_required at 235); defensive AbortError catch at 273 retained; persistTurn only in finish() completed path; zero `@ts-expect-error` in all three modified files
- [x] Case (e) asserts resolution (not rejection) with status 'aborted' + persistTurn not called

---
*Phase: 04-agent-reliability-and-evidence*
*Completed: 2026-08-29*