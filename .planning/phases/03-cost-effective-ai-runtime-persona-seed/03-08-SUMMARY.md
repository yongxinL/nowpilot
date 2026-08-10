---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 08
subsystem: ai-runtime-ui
tags: [streaming-chat, bubble, sender, chunk-buffer, use-streaming-llm, provider-gate, golden-rule-3, ant-design-x, typescript]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime-persona-seed
    provides: 03-05 ProviderRouter createStageInvocation StageInvocation bundle (F-5 messages[]+providerOptions call shape), 03-06 runAgentTurn + onStreamDelta + StageResolver seam + capsForTier + RENDERER_MAX_TOKENS, 03-07 contextHelper buildOptimizedContext (D-02 §2.3 builder) + PersonaInjector byte-stable block + readPersonaPrefs (D-09/D-10), 03-01 canonical types (ChatStreamState is this plan's own in-memory surface state)
provides:
  - src/components/pages/useStreamingLLM.ts (new, +1 documented — Phase-7 promotion target to src/hooks/): ChatStreamState 5-state machine (idle/streaming/completed/failed/offline) + the co-located streaming hook — send() = contextHelper (03-07) → createStageInvocation (03-05, StageResolver per-stage planner haiku 256 / renderer flash 512) → runAgentTurn (03-06, onStreamDelta → ChunkBuffer); abort() cancels generation (no orphaned billing); retry() re-sends the last input with a NEW operationId; NETWORK-class (D-17) → offline else failed (C.2 code → debugLog only, R-10); NO session-key write (D-11, in-memory per surface D-03/D-14)
  - src/components/pages/ChatPage.tsx (rewritten): Ant Design X Bubble/Bubble.List + Sender minimal streaming surface — user bubble right (filled, colorPrimaryBg light / colorPrimary @18% dark, radius 12), assistant bubble left (colorBgContainer, 1px colorBorder, name 'NowPilot' — never the persona name), streaming caret (colorPrimary @60%) + ChunkBuffer-growing text (no spinner, no motion reveals §12.6), failed = partial text + 'Provider error.' (colorError) + Retry (colorPrimary, STR.chat.retry), offline = STR.chat.offline muted 12px notice above the Sender; plain text only (no HTML-string injection, T-03-08-02); RICH fenced (D-03)
  - src/components/sidepanel/SidePanelShell.tsx (modified): D-01 single-composer — ChatPage's Sender REPLACES the Phase-1 disabled Input footer when a provider is active (no double composer); unconfigured keeps Alert (STR.chat.noProvider) + disabled footer
  - src/components/standalone/StandaloneShell.tsx (modified): Chat page gated behind hasActiveProvider (D-21, E4) — unconfigured renders the noProvider Alert; other pages unaffected; no disabled-input footer (Sender lives in ChatPage)
  - strings.ts (modified): STR.chat.send = 'Send', STR.chat.retry = 'Retry' (verbatim UI-SPEC Copywriting Contract)
  - tests: useStreamingLLM.test (10), ChatPage.test (9), StandaloneShell.test updated (7), SidePanelShell.test updated (7) — 446 full-suite green
affects: [03-09 wiring (§18 addendum documents the co-located hook + the D-02 Phase-4 deletion target), Phase 7 (promotes the hook to src/hooks/, DOMPurify pipeline, RICH layer, ChatHistoryDB persistence, stop control), Phase 3a (runAgentTurn rewiring — the hook consumes the D-20 verbatim output struct), Phase 4 (ContextOptimizer replaces contextHelper)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Co-located hook seam (D-01): src/components/pages/useStreamingLLM.ts until Phase 7 promotes it to src/hooks/ — the hook is the ONLY React-side owner of the send path, and it imports contextHelper (Golden Rule 3), never assembles prompts"
    - "StageResolver over the 03-05 Router seam: per-stage createStageInvocation — planner tier 'haiku' maxTokens 256, renderer tier 'flash' maxTokens 512 (§1.2), privacyMode from prefs (D-13), configuredProviders from the registry snapshot"
    - "Per-surface in-memory stream state (D-03/D-14): the 5-state machine lives in the hook, no chrome.storage.session persistence — the D-11 session key stays writeAllowed:false (Setting.ts line 78, declared-only)"
    - "Honest failed/offline terminals: NETWORK-class after the Router retry layer (D-17) → offline muted notice; every other failure → failed bubble retaining partial text + Retry (never renders a truncated stream as complete, T-03-08-01); the C.2 code goes to debugLog (R-10), never raw into the UI"

key-files:
  created:
    - src/components/pages/useStreamingLLM.ts
    - tests/components/pages/useStreamingLLM.test.tsx
    - tests/components/pages/ChatPage.test.tsx
  modified:
    - src/core/i18n/strings.ts
    - src/components/pages/ChatPage.tsx
    - src/components/sidepanel/SidePanelShell.tsx
    - src/components/standalone/StandaloneShell.tsx
    - tests/components/standalone/StandaloneShell.test.tsx
    - tests/components/sidepanel/SidePanelShell.test.tsx

key-decisions:
  - "FAILED_PREFIX derives 'Provider error.' as the verbatim prefix of STR.chat.errorRetry (split on ' [') — the canonical errorRetry string stays untouched (Golden Rule 2), the [Retry]/[Switch Provider] tokens are actions/Phase-7, never rendered as text"
  - "The streaming caret is rendered as a static colorPrimary @60% indicator appended to the growing text via Bubble contentRender — Bubble's own typing animation is motion-driven (forbidden §12.6); ChunkBuffer rAF is the ONLY text animation, the caret marks the streaming state (present while streaming, removed on completed/failed/offline)"
  - "The hook sets the streaming state synchronously BEFORE the first await (persona prefs read), so the assistant bubble appears immediately per the UI-SPEC streaming row — one stream per session (§17.5): a new send aborts the previous AbortController"
  - "BubbleList's role config vs aria: BubbleList consumes `role` as its RoleType item-mapping config (library API), so role='log' + aria-live='polite' (spec §17.6) are placed on the message-list wrapper div — the streaming content lives in the polite live region exactly per §17.6"
  - "provider_unconfigured reasonCode surfaced defensively maps to the failed terminal (the shells' D-21 gate is the primary guard; an honest failed bubble beats an empty 'completed' render)"
  - "AI-03 checkbox marked complete (this plan IS the React-UI end of 'Streaming works end-to-end — SSE + text via ChunkBuffer + React UI'); AI-06 stays pending — its full text names Prompts/Welcome/etc which are fenced to Phase 7 (D-03); the minimal Bubble/Sender subset ships here"

patterns-established:
  - "Grep-asserted source invariants as tests: plain-text/no-HTML-string-injection (T-03-08-02) and the D-03 RICH-fence list are readFileSync assertions in the component suite, matching the 03-07 source-invariant precedent"
  - "Test seams for the hook: the hook module is real, its I/O boundaries (AgentOrchestrator runAgentTurn, ProviderRouter, personaConfig readPersonaPrefs) are vi.hoisted-mocked so each state is driven deterministically — the StageResolver is invoked by the runAgentTurn mock to prove the 03-05 seam wiring"

requirements-completed: [AI-03, AI-06]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "useStreamingLLM hook — send() threads a contextHelper-built OptimizedContext (Golden Rule 3) through the 03-05 createStageInvocation StageResolver (planner haiku 256 / renderer flash 512 per §1.2) into 03-06 runAgentTurn with onStreamDelta → ChunkBuffer; abort() cancels generation; retry() re-sends the last input with a NEW operationId"
    requirement: AI-03
    verification:
      - kind: unit
        ref: "tests/components/pages/useStreamingLLM.test.tsx#send path (3 tests: context shape, deltas→text, StageResolver seam)"
        status: pass
      - kind: unit
        ref: "tests/components/pages/useStreamingLLM.test.tsx#abort + retry (2 tests: signal aborted, NEW operationId)"
        status: pass
    human_judgment: false
  - id: D2
    description: "5-state machine (idle/streaming/completed/failed/offline) — streaming set synchronously before any await; NETWORK-class (D-17) → offline; other failures → failed retaining partial text; no D-11 session-key write (in-memory per surface)"
    requirement: AI-03
    verification:
      - kind: unit
        ref: "tests/components/pages/useStreamingLLM.test.tsx#5-state machine (5 tests: idle, streaming→completed, offline, failed, no-session-key)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ChatPage minimal streaming surface — Bubble/Bubble.List + Sender with the 5-state rendering (idle cue, streaming caret + growing text, completed final text, failed partial + 'Provider error.' + Retry, offline notice above the Sender), ONE composer per surface (D-01), Retry re-send path"
    requirement: AI-03
    verification:
      - kind: unit
        ref: "tests/components/pages/ChatPage.test.tsx#5-state stream machine (6 tests: idle, send, completed, failed, retry, offline)"
        status: pass
    human_judgment: false
  - id: D4
    description: "RICH fencing (D-03) + plain-text bubbles (T-03-08-02) — source invariants: no HTML-string injection, no RICH-layer tokens in the surface"
    requirement: AI-06
    verification:
      - kind: unit
        ref: "tests/components/pages/ChatPage.test.tsx#plain text + RICH fencing (2 source-invariant tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Shell provider gates (D-21) — SidePanelShell and StandaloneShell both gate ChatPage behind hasActiveProvider; unconfigured renders the STR.chat.noProvider Alert; SidePanelShell single-composer (ChatPage Sender replaces the disabled footer, no double composer); other Standalone pages unaffected"
    requirement: AI-03
    verification:
      - kind: unit
        ref: "tests/components/standalone/StandaloneShell.test.tsx#gate (2 tests) + non-chat page (1 test)"
        status: pass
      - kind: unit
        ref: "tests/components/sidepanel/SidePanelShell.test.tsx#single composer + gate (2 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual streaming experience — caret colorPrimary @60%, bubble fills (colorPrimaryBg light / colorPrimary @18% dark user, colorBgContainer + 1px colorBorder assistant), radius 12, focus ring — the UI-SPEC styling rows"
    verification: []
    human_judgment: true
    rationale: "Color/fill/focus-ring adequacy is a visual judgment (DESIGN_SYSTEM §8.1d/§12) — no automated assertion can certify the rendered appearance; the state machine and copy are unit-proven, the styling needs a human look at the running surface"

# Metrics
duration: 34min
completed: 2026-08-10
status: complete
---

# Phase 3 Plan 8: Streaming Chat Surface — useStreamingLLM Hook + ChatPage Summary

**The co-located useStreamingLLM hook (Golden Rule 3: contextHelper-built OptimizedContext → 03-05 StageResolver → 03-06 runAgentTurn with onStreamDelta → ChunkBuffer, abort-cancels-generation, retry-with-new-operationId) and the rewritten ChatPage (Ant Design X Bubble/Bubble.List + Sender, the full 5-state machine with honest failed/offline terminals, plain-text bubbles, RICH fenced) — plus both shells reconciled to the D-21 provider gate with a single composer per surface. All 33 new/updated component tests green; full suite 446/446.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-08-10T21:09:40Z
- **Completed:** 2026-08-10T21:43:50Z
- **Tasks:** 8 (5 source tasks, 1 fence verify, 1 test task, 1 verify gate)
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments

- **`src/components/pages/useStreamingLLM.ts` (new, +1 documented — Phase-7 promotion target)** — `ChatStreamState` (idle/streaming/completed/failed/offline, each carrying the turn's operationId) + `useStreamingLLM()`. `send(userInput)`: aborts any previous controller (§17.5 one stream per session), creates a fresh AbortController + operationId, **sets streaming synchronously before any await** (the assistant bubble appears immediately), reads the D-09 persona prefs, builds the byte-stable persona block (03-07), calls `buildOptimizedContext` (**Golden Rule 3 — the hook imports contextHelper, never PROMPTS**), then runs `runAgentTurn({ operationId, userInput, context, abortSignal, tier: capsForTier(context.tier), onStreamDelta, invocation })` where `invocation` is the **StageResolver over `getProviderRouter().createStageInvocation`** (03-05 seam: planner `haiku` maxTokens 256 / renderer `flash` maxTokens 512 per §1.2, privacyMode from prefs per D-13, configuredProviders from the registry snapshot). Deltas enqueue into the Appendix J.1 ChunkBuffer whose rAF flush grows the text state. On resolve: `flushNow()` + completed. On throw: **NETWORK-class (D-17, via the Router's classifyProviderError) → offline; everything else → failed** (partial text retained via flushNow in the catch); the canonical C.2 code goes to **debugLog only (R-10)** — never raw into the UI. `abort()` cancels the generation (no orphaned request bills tokens); `retry()` re-sends the last input with a **NEW operationId**. **No session-stream-key write (D-11)** — Phase-3 stream state is in-memory per surface (D-03/D-14). A defensively-surfaced `provider_unconfigured` reasonCode maps to the failed terminal (the shells' D-21 gate is the primary guard).
- **`src/components/pages/ChatPage.tsx` (rewritten)** — Ant Design X `Bubble`/`Bubble.List` + `Sender` minimal streaming surface. User bubble `placement="end"` variant filled with **colorPrimaryBg light / colorPrimary @18% dark** (mode-aware) radius 12; assistant bubble `placement="start"` filled with **colorBgContainer, 1px colorBorder, header 'NowPilot'** — never the persona name (D-03). The message-list wrapper carries **role='log' aria-live='polite'** (spec §17.6 — BubbleList's `role` prop is its item-mapping config, so the live region lands on the list wrapper). The 5-state machine: idle-empty → centered STR.chat.empty one-liner; streaming → assistant bubble appended immediately with the **streaming caret (colorPrimary @60%)** and ChunkBuffer-growing text (no spinner, no motion reveals §12.6); completed → final text, caret gone; failed → **partial text retained + 'Provider error.' (colorError, derived as the verbatim errorRetry prefix — the canonical string untouched, Golden Rule 2) + Retry (colorPrimary text action STR.chat.retry)**; offline → the muted 12px STR.chat.offline notice above the Sender. **Retry re-sends the last user input with a NEW operationId (hook.retry) and replaces the failed bubble's partial text.** The Sender is controlled (value/onChange), placeholder STR.chat.askPlaceholder, circular SendOutlined button with aria-label+tooltip 'Send' (colorPrimary when input non-empty AND idle, disabled during the stream), and **one stream per session with no stop control this phase**. Plain text only (T-03-08-02), RICH fenced (D-03).
- **Shell reconciliation (D-21 + D-01):** `SidePanelShell` renders ChatPage when a provider is active and **removes the Phase-1 disabled Input footer entirely** — ChatPage's Sender is the ONE composer per surface (no double composer); unconfigured keeps the STR.chat.noProvider Alert + disabled footer. `StandaloneShell` gates the **Chat page** behind `hasActiveProvider()` (E4) rendering the same Alert when unconfigured (PROVIDER_KEY_UNREADABLE-disabled providers collapse into the same gate); other pages unaffected; no disabled-input footer there (the Sender lives in ChatPage).
- **strings.ts** — `STR.chat.send = 'Send'` + `STR.chat.retry = 'Retry'` verbatim from the UI-SPEC Copywriting Contract; empty/askPlaceholder/offline/noProvider confirmed present; errorRetry untouched.
- **Tests (33 new/updated):** `useStreamingLLM.test.tsx` (10 — context shape, deltas→ChunkBuffer growth, StageResolver 03-05 seam with per-stage tier/maxTokens, 5-state machine incl. NETWORK→offline and no-session-key, abort-cancels-signal, retry-new-operationId) and `ChatPage.test.tsx` (9 — the 5-state surface contract incl. one-composer and Retry re-send, plus source-invariant greps for plain-text/no-HTML-string-injection and the D-03 RICH fence), with `StandaloneShell.test` (7) and `SidePanelShell.test` (7) updated for the gates. Full suite **446/446 (56 files)**, tsc/eslint/prettier clean.

## Task Commits

Each task was committed atomically:

1. **Task 1: strings.ts — STR.chat.send/retry copy contract** - `498bd5b` (feat)
2. **Task 2: useStreamingLLM.ts co-located hook** - `ce67c65` (feat)
3. **Task 3: ChatPage.tsx minimal streaming surface** - `26032be` (feat)
4. **Task 4: SidePanelShell single-composer + gate** - `7bc938d` (feat)
5. **Task 5: StandaloneShell gate** - `9d8c55a` (feat)
6. **Task 6: RICH fencing** - no code (grep-verified absent)
7. **Task 7: hook + ChatPage + shell-gate test suites** - `ddf1b0a` (test)
8. **Task 8: Verify** - no commit (verification only)

Formatting fix (prettier):

- `69fd6b1` (style): prettier formatting of ChatPage/shell/test files

**Plan metadata:** docs commit follows this SUMMARY.

## Files Created/Modified

- `src/components/pages/useStreamingLLM.ts` - ChatStreamState + the co-located streaming hook (contextHelper → StageResolver → runAgentTurn → ChunkBuffer; abort/retry; offline/failed classification; D-11 clean)
- `src/components/pages/ChatPage.tsx` - Bubble/Bubble.List + Sender 5-state streaming surface (plain text, RICH fenced, NowPilot identity, Retry re-send)
- `src/components/sidepanel/SidePanelShell.tsx` - D-21 gate + D-01 single-composer (footer removed when provider active)
- `src/components/standalone/StandaloneShell.tsx` - Chat-page provider gate (E4 Alert), other pages unaffected
- `src/core/i18n/strings.ts` - STR.chat.send + STR.chat.retry (verbatim)
- `tests/components/pages/useStreamingLLM.test.tsx` - 10 hook contract tests
- `tests/components/pages/ChatPage.test.tsx` - 9 surface + source-invariant tests
- `tests/components/standalone/StandaloneShell.test.tsx` - 7 gate tests (updated)
- `tests/components/sidepanel/SidePanelShell.test.tsx` - 7 shell tests incl. single-composer (updated)

## Decisions Made

- **FAILED_PREFIX derives 'Provider error.' as the verbatim prefix of STR.chat.errorRetry** (`split(' [')[0]`) — the canonical string stays untouched (Golden Rule 2); the [Retry]/[Switch Provider] tokens are actions/Phase-7, never rendered as text (T-03-08-03 accepted).
- **The streaming caret is a static colorPrimary @60% indicator** appended via Bubble contentRender — Bubble's own typing animation is motion-driven (forbidden §12.6); ChunkBuffer rAF is the only text animation; the caret marks the streaming state (present while streaming, removed on completion/failure/offline).
- **Streaming state is set synchronously before the first await** — the persona-prefs read happens after the state flip, so the assistant bubble appears immediately per the UI-SPEC streaming row.
- **BubbleList's `role` prop is its RoleType item-mapping config** (library API) — role='log' + aria-live='polite' (spec §17.6) land on the message-list wrapper div, keeping the streaming content in the polite live region.
- **AI-03 marked complete** (this plan is the React-UI end of "Streaming works end-to-end — SSE + text via ChunkBuffer + React UI"); **AI-06 stays pending** — its full text names Prompts/Welcome/etc. which are fenced to Phase 7 (D-03); the minimal Bubble/Sender subset ships here (flagged_assumption: manual review).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Verify gate] Source-invariant grep tripped on comment literals**
- **Found during:** Task 7/8 (ChatPage.test source-invariant suite)
- **Issue:** The "no HTML-string injection" and "no RICH tokens" greps are readFileSync assertions over ChatPage.tsx — my own header comments contained the literal words (e.g. "dangerouslySetInnerHTML", "persona"), so the invariant greps matched comments rather than code.
- **Fix:** Reworded the ChatPage header comments to avoid the grep tokens entirely (T-03-08-02 wording → "no HTML-string injection"; persona → "name overrides are prompt-side only"); the code itself was always clean.
- **Files modified:** src/components/pages/ChatPage.tsx (comments only)
- **Verification:** both source-invariant tests pass; full suite green
- **Committed in:** ddf1b0a (part of the test commit) + 69fd6b1 (prettier)

**2. [Rule 3 - Test environment] jsdom lacks IntersectionObserver/ResizeObserver**
- **Found during:** Task 7 (ChatPage/SidePanelShell/StandaloneShell suites)
- **Issue:** BubbleList (scroll-locking) and the Sender's TextArea (auto-size) construct IntersectionObserver/ResizeObserver on mount — jsdom has neither, so the real components threw inside ErrorBoundary and the shells rendered the fallback card instead of ChatPage.
- **Fix:** Added minimal no-op observer stubs (vi.stubGlobal in beforeEach, unstubAllGlobals afterEach) to the three suites that mount the real surface components.
- **Files modified:** tests/components/pages/ChatPage.test.tsx, tests/components/standalone/StandaloneShell.test.tsx, tests/components/sidepanel/SidePanelShell.test.tsx
- **Verification:** all shell tests now render the real ChatPage (STR.chat.empty visible, gate assertions pass)
- **Committed in:** ddf1b0a

**3. [Rule 1 - Test bug] Hook state mutation did not re-render the mocked surface**
- **Found during:** Task 7 (ChatPage.test state-machine suite)
- **Issue:** The mocked hook returns a stable object; mutating `hookMock.state`/`text` in-place does not trigger a React re-render, so the state-machine transitions never surfaced.
- **Fix:** Added a `renderSurface()` helper exposing `forceUpdate()` (rerender with the same element) — tests mutate the mock then force a re-render so the surface re-reads the new state.
- **Files modified:** tests/components/pages/ChatPage.test.tsx
- **Verification:** all 6 state-machine tests pass
- **Committed in:** ddf1b0a

**4. [Rule 1 - Test bug] streaming-state assertion raced the persona-read microtask**
- **Found during:** Task 7 (useStreamingLLM.test "goes streaming immediately")
- **Issue:** `act(async ...)` flushed the resolved persona-read microtask before the streaming state could be observed, so the intermediate streaming assertion was flaky (saw completed instead).
- **Fix:** Gated the mocked `readPersonaPrefs` behind a manually-released promise — the test observes the synchronous streaming flip before releasing the persona read, then releases it to complete the turn.
- **Files modified:** tests/components/pages/useStreamingLLM.test.tsx
- **Verification:** the streaming-then-completed test is deterministic green
- **Committed in:** ddf1b0a

---

**Total deviations:** 4 auto-fixed (2 Rule 1, 2 Rule 3)
**Impact on plan:** All four are test/code hygiene alignments with zero behavior change — the hook, the surface, the gates, and the copy are exactly as planned. No scope creep.

## Issues Encountered

- **Bubble's built-in `streaming` caret is motion-driven**: the Ant Design X Bubble only renders its typing caret when the `typing` animation is enabled — which §12.6 forbids. Resolved by rendering a static colorPrimary @60% caret indicator via contentRender (the caret marks the streaming state; ChunkBuffer rAF remains the only text animation). Documented in Decisions.
- **AI-06 mark-complete deliberately NOT run** — the requirement's full text names Prompts/Welcome/etc. (fenced to Phase 7, D-03); the minimal Bubble/Sender subset is this plan's deliverable and the plan itself flags AI-06 as manual-review. AI-03 — whose full text ("Streaming works end-to-end — SSE + text via ChunkBuffer + React UI") this plan completes — IS marked complete. requirements-completed frontmatter records the plan's stated linkage (AI-03, AI-06) per the 03-01 precedent.
- README.md carries the same pre-existing uncommitted documentation edit noted in 03-01/03-03/03-04/03-05/03-06/03-07 — left untouched (out of this plan's scope).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **03-09 (wiring + §18 addendum):** `getProviderRouter().configure()` precedes any send; the addendum records useStreamingLLM.ts as the +1 co-located hook (Phase-7 promotion target), contextHelper + personaConfig as the existing +1 files, and the D-02 Phase-4 deletion target; the AI-05 checkbox completes with this plan + 03-08 + 03-09 jointly proving "all AI calls consume an OptimizedContext".
- **Phase 7:** promotes the hook to `src/hooks/useStreamingLLM.ts` (J.2), adds the DOMPurify pipeline, the RICH layer (Prompts/Welcome — closing AI-06), ChatHistoryDB persistence, and the stop/abort control; the hook's in-memory state machine is the seam.
- **Phase 3a:** rewires runAgentTurn by replacing the D-20 output struct — the hook consumes the verbatim `AgentTurnOutput`, so the rewiring is invisible to the surface.
- **Phase 4:** ContextOptimizer replaces contextHelper in place — the hook's import site is the single seam.
- **Threat model honored:** T-03-08-01 (failed state retains partial text + Provider error + Retry — never a truncated 'complete'), T-03-08-02 (plain text only, source-invariant grep), T-03-08-03 (failed-bubble copy is the errorRetry prefix; the full string untouched; no raw codes — debugLog), T-03-08-04 (RICH-fence grep), T-03-08-05 (both shells gate behind hasActiveProvider, test-asserted), T-03-08-SC (zero new packages — Bubble/Sender from the already-installed @ant-design/x ^2.9.0).

---

*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-10*

## Self-Check: PASSED

- All 5 key files (2 source created, 2 test created, SUMMARY) exist on disk (verified via `[ -f ]`)
- All 7 execution commits present in git log: 498bd5b, ce67c65, 26032be, 7bc938d, 9d8c55a, ddf1b0a, 69fd6b1
- tsc --noEmit exit 0 · eslint . clean · prettier --check . clean · full suite 446/446 (56 files, +21 vs the 425 baseline)
- Grep gates (Task 8 verify): no PROMPTS import in the hook (0 matches); no np_active_stream anywhere in src/components/pages|sidepanel|standalone (0 matches); no RICH tokens in ChatPage (0 matches); no dangerouslySetInnerHTML/innerHTML in ChatPage (0 matches)
- Golden Rule 3 proven: useStreamingLLM imports contextHelper (buildOptimizedContext) and never assembles prompts — asserted in the hook test (context is a §2.3 OptimizedContext shape)
- 03-05 seam proven: the runAgentTurn mock invokes the StageResolver — createStageInvocation called twice with planner haiku/maxTokens 256 and renderer flash/maxTokens 512
- 5-state machine proven: idle → synchronous streaming → completed; NETWORK-class (fetch failed: ECONNREFUSED) → offline; other error → failed (partial text retained); abort → signal aborted + idle; retry → NEW operationId re-send
- D-11 proven: the hook writes nothing to chrome.storage.session (in-memory per surface, D-03/D-14)
- T-03-08-02 proven: plain-text/no-HTML-string-injection source-invariant test passes
- D-03 proven: RICH-fence source-invariant test passes (0 RICH tokens in ChatPage.tsx)
- D-21 proven: StandaloneShell + SidePanelShell both gate ChatPage behind hasActiveProvider (noProvider Alert when unconfigured; ChatPage renders with a provider); SidePanelShell single-composer asserted (exactly one askPlaceholder input, not disabled, when a provider is active)
- T-03-08-01/03 proven: failed bubble retains partial text + 'Provider error.' (errorRetry prefix, canonical string untouched) + Retry; offline shows the STR.chat.offline muted notice above the Sender; no raw C.2 codes in the UI (debugLog only, in the hook)

