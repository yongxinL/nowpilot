---
phase: 03-cost-effective-ai-runtime-persona-seed
plan: 07
subsystem: ai-runtime
tags: [chat-wiring, agent-orchestrator, write-journal, append-chat-turn, endpoint-overrides, tier-assignment, d-44, d-45, d-50, d-54, rich-r-09]

# Dependency graph
requires:
  - phase: 03
    plan: 06
    provides: AgentOrchestrator.runAgentTurn (Appendix I loop), the D-54a configuration-required typed outcome, and the D-45 persistTurn seam (consumed here)
  - phase: 03
    plan: 05
    provides: ProviderRegistry.getEndpointFor/getCachedModels + np_endpoint_overrides merge-at-hydrate (D-50 read surface), TierResolver, ProviderRouter
  - phase: 03
    plan: 02
    provides: UserPreferences (np_preferences) setFastModel/setBalancedModel store actions (D-54 write target)
  - phase: 02
    provides: WriteJournal runJournaled + registerJournalSteps + isSupportedOperation (CR-01 boot wiring), ChatHistoryDB v1 schema (fits the pair write, D-45a)
provides:
  - 'append-chat-turn' as the 12th member of the WriteJournalOperation union (type + zod schema) — additive, backward-compatible
  - createChatTurnSteps factory + registered JournalStep at boot (runJournaled-replayable turn-end persist to ChatHistoryDB)
  - useChatStreaming re-pointed at AgentOrchestrator.runAgentTurn (D-44) — the production chat path runs Planner → Executor → Renderer; streamChatResponse retired to DEMO_MODE+DEV only
  - OptionsPage D-50 per-provider endpoint overrides (np_endpoint_overrides) + D-54 fast/balanced tier assignment (np_preferences) with UI-only first-setup pre-fill (D-54a)
  - tests/core/ai/chat-integration.test.ts (4 case groups) + tests/components/OptionsPage.test.tsx (2 case groups)
affects: [Phase 5 ContextOptimizer (sections), Phase 11 AITransactionLog, Phase 15 Options redesign (D-54 fields additive to the existing General section), RICH-C-01 clarification chips (ask_clarification surfacing in chat)]

actuals:
  tokens: 12889     # chars/4 over the realized diff (51,556 chars across the 6 files, base 1de8baf..f78e754)
  tasks: 4          # 3 auto tasks + 1 human-verify checkpoint (approved)
  commits: 3        # task commits; SUMMARY commit follows

# Tech tracking
tech-stack:
  added: []        # no new dependencies (user_setup: none required)
  patterns:
    - "Additive literal-union extension: 'append-chat-turn' appended to the 11-member WriteJournalOperation union (type + zod schema) without reordering/removing members (D-45/Open Q1 option (a))"
    - "Curried step factory (deps) => steps registered at boot via registerJournalSteps alongside update-workspace (CR-01 pattern) — runJournaled replay-safe turn-end persist"
    - "D-33 metadata-only journal discipline: WriteJournalEntry carries only metadata; message bodies live in ChatHistoryDB"
    - "D-44 in-place hook adaptation: useChatStreaming re-pointed via AbortController threading into runAgentTurn; Appendix J.2 np_active_stream lifecycle (session write on start, clear in finally, boot-recovery for stale operationId)"
    - "D-54a UI-only pre-fill: suggestions render but never call setFastModel/setBalancedModel until the operator confirms Save"

key-files:
  created:
    - tests/core/ai/chat-integration.test.ts
    - tests/components/OptionsPage.test.tsx
  modified:
    - src/types/storage.ts
    - src/core/storage/WriteJournal.ts
    - src/components/chat/useChatStreaming.ts
    - src/components/options/OptionsPage.tsx

key-decisions:
  - "append-chat-turn is the exact repository-approved identifier (validated against §20.3 + 03-RESEARCH Open Q1 option (a)) — a backward-compatible additive extension; the union is 11→12 members with existing members untouched"
  - "Turn-end persist runs through the journaled append (D-45) at the D-45a boundary: ChatHistoryDB v1 schema fits the pair write, so NO schema change and the D-45a stop-condition does not trigger"
  - "Mid-stream chunks live in memory + ChunkBuffer only; the per-chunk store-update path is REMOVED from useChatStreaming (P2 write-rate, T-3-22 closed structurally); abort drops the partial — nothing persisted"
  - "streamChatResponse is NOT deleted — retained only behind the DEMO_MODE+DEV gate (D-12/D-44); production chat has no fallback to the proxy-coupled legacy path (T-3-25 accepted)"
  - "D-50 endpoint overrides zod-validated (http/https only) at the Options write; runtime endpoint = np_endpoint_overrides[providerId] ?? §10.6 default; localhost:12380 is never a canonical default (D-12)"
  - "D-54 tier assignment writes through to np_preferences via setFastModel/setBalancedModel; pre-fill suggestions are UI-only until confirmed Save (D-54a) — grep-asserted no set* call in the pre-fill path"

patterns-established:
  - "Chat is the pipeline's production exercise: every ordinary chat turn fires Planner → Executor → Renderer via the single runAgentTurn call site (03-06 owns the Appendix I loop)"
  - "Persistence honors the D-45 write-rate contract: turn-end journaled append, never per chunk, never on abort"
  - "Options config surfaces write zod-validated values to chrome.storage.local keys owned by their phase (np_endpoint_overrides / np_preferences) — no in-memory-only proxy mutations"

requirements-completed: [RICH-R-09]

coverage:
  - id: D1
    description: "'append-chat-turn' wired end-to-end — the 12th union member in WriteJournalOperation + WriteJournalOperationSchema (additive, backward-compatible), createChatTurnSteps factory registered at boot, runJournaled replay-safe persist of the completed user/assistant pair into ChatHistoryDB's messages store; D-45a boundary respected (no ChatHistoryDB schema change)"
    requirement: "RICH-R-09"
    verification:
      - kind: unit
        ref: "tests/core/ai/chat-integration.test.ts#(b) persistTurn runs the journaled append-chat-turn ONCE at turn end — the pair lands in ChatHistoryDB and the entry completes"
        status: pass
      - kind: other
        ref: "pnpm run verify:phase-3 — 17 files / 142 tests green at checkpoint time"
        status: pass
    human_judgment: false
  - id: D2
    description: "useChatStreaming re-pointed at AgentOrchestrator.runAgentTurn (D-44) — handleSend routes through the pipeline, chunks render via ChunkBuffer with zero per-chunk storage writes, abort mid-stream drops the partial with nothing persisted, np_active_stream lifecycle applied (J.2)"
    requirement: "RICH-R-09"
    verification:
      - kind: unit
        ref: "tests/core/ai/chat-integration.test.ts#(a) handleSend routes through runAgentTurn — the legacy streaming path is NOT invoked, the answer renders from the pipeline"
        status: pass
      - kind: unit
        ref: "tests/core/ai/chat-integration.test.ts#(c) abort mid-stream drops the partial — nothing persisted"
        status: pass
      - kind: unit
        ref: "tests/core/ai/chat-integration.test.ts#(d) zero per-chunk storage writes — the stream performs no chrome.storage.local writes (P2/D-45)"
        status: pass
      - kind: other
        ref: "grep (comment-filtered): per-chunk store-update call absent from useChatStreaming.ts; legacy streamChatResponse call-site absent from the production chat path"
        status: pass
    human_judgment: false
  - id: D3
    description: "OptionsPage surfaces — D-50 per-provider endpoint overrides persist to np_endpoint_overrides (zod-validated http/https), D-54 fast/balanced tier assignment writes through to np_preferences, first-setup pre-fill is UI-only until confirmed Save (D-54a, grep-asserted no set* call in the pre-fill path)"
    verification:
      - kind: unit
        ref: "tests/components/OptionsPage.test.tsx#saving a provider proxy writes np_endpoint_overrides (openai) into chrome.storage.local"
        status: pass
      - kind: unit
        ref: "tests/components/OptionsPage.test.tsx#saving tier assignments writes fastModel/balancedModel through to np_preferences"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live-provider smoke — real streaming against a provider wire format, persona-consistent behavior across a second turn, endpoint-override + tier fields persisting across reload, completed turn surviving reload (ChatHistoryDB turn-end persist), abort dropping the partial"
    verification:
      - kind: manual_procedural
        ref: "Human smoke checkpoint (task 4) — extension loaded with a live provider, Options fields set, side-panel chat exercised"
        status: pass
    human_judgment: true
    rationale: "Requires a human with a configured live AI provider (OpenAI/Anthropic/Gemini/Ollama) to exercise the real wire format in a loaded extension — not assertable by the jsdom test suite; approved by the user at checkpoint."

# Metrics
duration: 30min
completed: 2026-08-28
status: complete
---

# Phase 3 Plan 7: Chat Pipeline Wiring — useChatStreaming → AgentOrchestrator, Journaled Turn Persistence, and Options Config Surfaces Summary

**Production chat now runs the full Planner → Executor → Renderer pipeline: `useChatStreaming.handleSend` routes through `AgentOrchestrator.runAgentTurn` (D-44), completed turns persist to ChatHistoryDB via the journaled `append-chat-turn` operation (D-45, replay-safe, turn-end only), and Options exposes D-50 endpoint overrides + D-54 tier assignment with UI-only first-setup pre-fill (D-54a) — human smoke checkpoint approved against a live provider**

## Performance

- **Duration:** 30 min
- **Started:** 2026-08-28
- **Completed:** 2026-08-28
- **Tasks:** 4 (3 auto + 1 human-verify checkpoint)
- **Files modified:** 6 (2 created, 4 modified)

## Accomplishments

- **`append-chat-turn` journal operation (D-45 / Open Q1 option (a)):** the 11-member `WriteJournalOperation` union (src/types/storage.ts:46-57) grew additively to 12 — the literal in both the type and the zod schema, existing members untouched. `WriteJournal.ts` gained the `createChatTurnSteps` curried factory (mirroring `createWorkspaceWriteSteps`) registered at boot via `registerJournalSteps`, so `isSupportedOperation('append-chat-turn')` returns true for replay (CR-01 pattern). The completed user/assistant pair persists into ChatHistoryDB's messages store via `openChatHistoryDB()` (idb put, role 'user'/'assistant', timestamp, metadata) — the v1 schema fits, so the D-45a stop-condition did **not** trigger: **no ChatHistoryDB change**. D-33 metadata-only discipline holds (bodies never inside the journal entry).
- **useChatStreaming re-point at AgentOrchestrator (D-44/D-45/D-47):** the `streamChatResponse` call site is gone from the production path — `handleSend` now calls `runAgentTurn({ userInput, sessionId, operationId, tier, prefs, abortSignal, persistTurn })` with `abortControllerRef` threaded through. Mid-stream chunks are consumed via ChunkBuffer (Appendix J.2) and update the assistant message from the buffer — **no per-chunk store-persist** (the per-chunk store-update path is removed; P2 write-rate, T-3-22 closed structurally, asserted by test (d) with a zero-write storage counter). At turn end `persistTurn` fires the journaled append exactly once; on abort the partial is dropped, nothing enqueued. The `np_active_stream` session lifecycle (J.2) writes chrome.storage.session on stream start and clears in `finally`, with boot-recovery for a stale operationId on the same conversationId. Legacy `streamChatResponse` is retained **only** behind the DEMO_MODE+DEV gate (D-12/D-44, T-3-25 accepted) — production chat has no fallback to the proxy-coupled path.
- **OptionsPage D-50 + D-54:** the provider-modal proxy fields now write the per-provider endpoint override to `np_endpoint_overrides` (chrome.storage.local, zod-validated http/https only — T-3-24 mitigated at write AND at registry hydrate from 03-05) instead of mutating only the in-memory ProviderConfig; runtime endpoint = `np_endpoint_overrides[providerId] ?? §10.6 default` (localhost:12380 never canonical, D-12). The General section gained fast/balanced tier-assignment selectors rendered from live-discovered models (`fetchProviderModels` semantics, D-52) that write through to `useUserPreferencesStore.setFastModel`/`setBalancedModel` → `np_preferences`. First-setup pre-fill suggestions render but never persist without an explicit Save (D-54a — grep-asserted: no `setFastModel`/`setBalancedModel` call inside the pre-fill path).
- **Test coverage:** `tests/core/ai/chat-integration.test.ts` (4 case groups: pipeline path with legacy path grep-asserted absent, persist-once-at-turn-end landing in ChatHistoryDB, abort-drops-partial, zero per-chunk writes) + `tests/components/OptionsPage.test.tsx` (2 case groups: np_endpoint_overrides write, np_preferences tier write-through).
- **Human smoke checkpoint (task 4): APPROVED** — live-provider streaming, Options fields persisting across reload, persona-consistent second turn, abort-drops-partial, and turn persistence across reload all confirmed.
- **Gates green at checkpoint time:** `pnpm run verify:phase-3` (17 files / 142 tests), `verify:phase-1` (46/381), `verify:phase-2` (14/109), `pnpm build:ext` succeeds.

## Task Commits

Each task was committed atomically:

1. **Task 1: append-chat-turn — additive union extension + zod schema + JournalStep registration** - `12a2945` (feat)
2. **Task 2: useChatStreaming re-point at AgentOrchestrator (D-44/D-45/D-47) + chat-integration test** - `7882091` (feat)
3. **Task 3: OptionsPage — D-50 endpoint overrides + D-54 tier assignment with first-setup pre-fill** - `f78e754` (feat)
4. **Task 4: Human verify: live chat streaming through the pipeline + Options fields + persist across reload** - approved (checkpoint, no commit)

**Plan metadata:** `pending` (committed with this SUMMARY)

## Files Created/Modified

- `src/types/storage.ts` - 'append-chat-turn' added to the `WriteJournalOperation` union (46-57) and `WriteJournalOperationSchema` (89-101) — additive 11→12, existing members untouched
- `src/core/storage/WriteJournal.ts` - `createChatTurnSteps(deps)` curried factory mirroring `createWorkspaceWriteSteps`; boot registration of the 'append-chat-turn' JournalStep alongside update-workspace; journaled persist of the pair into ChatHistoryDB (metadata-only entries, D-33)
- `src/components/chat/useChatStreaming.ts` - `streamChatResponse` call site replaced by `AgentOrchestrator.runAgentTurn(...)`; abortControllerRef threading; ChunkBuffer consumption with the per-chunk store-update path removed; `persistTurn` at turn end via the journaled append; np_active_stream session lifecycle (J.2) with boot-recovery
- `src/components/options/OptionsPage.tsx` - D-50 per-provider endpoint-override fields writing `np_endpoint_overrides`; D-54 fast/balanced tier selectors writing through to `np_preferences`; UI-only first-setup pre-fill (D-54a)
- `tests/core/ai/chat-integration.test.ts` - created: 4 case groups driving handleSend with a fixture provider (pipeline path, persist-once, abort-drops, zero per-chunk writes)
- `tests/components/OptionsPage.test.tsx` - created: endpoint-override persistence + tier-assignment write-through asserted via the mock storage map

## Decisions Made

- **`append-chat-turn` as the exact repository-approved identifier:** validated against §20.3 and the 03-RESEARCH Open Q1 resolution (option (a)) before coding (the mandatory storage-contract check) — the additive extension is authorized and the ChatHistoryDB v1 schema fits the pair write, so the D-45a stop-condition does not trigger.
- **Persist seam semantics carried from 03-06:** `persistTurn` is invoked only from the finish path, once per completed turn, with the user message + streamedText; abort never invokes it (tests (c) persists the contract in chat).
- **Retirement vs. deletion of streamChatResponse:** the legacy function remains behind the DEMO_MODE+DEV gate (D-12) — production chat has no fallback path to it (T-3-25 accepted; grep-asserted absent from the production path).
- **D-54a pre-fill contract:** the discovery populates the FAST/BALANCED selectors but does not classify, preselect, or persist either value; a future deterministic classifier may add UI-only suggestions without changing the runtime null contract.
- **SidepanelChat.tsx needed no signature adjustment** — the hook's return shape (isGenerating/handleSend/handleStopGenerating) was preserved by the in-place adaptation.

## Deviations from Plan

None - plan executed exactly as written. All 4 tasks completed per spec (3 auto + 1 checkpoint, approved).

## Issues Encountered

- None. The D-45a storage-contract pre-check passed (schema fit confirmed, no second store invented, no unjournaled write substituted); the human smoke checkpoint passed on the first review.

## User Setup Required

- **Live AI providers (OpenAI/Anthropic/Gemini/Ollama):** a provider must be configured at runtime in Options (provider key + fast/balanced tier assignment) for the live smoke path — keys are user-configured at runtime, never in the repo. This was satisfied by the human during the approved checkpoint (task 4).
- **npm registry:** none — no new dependencies this plan.

## Next Phase Readiness

- **Phase 3 DONE-when loop closes:** DONE-when 3 (live provider streaming) is now green via the approved human smoke checkpoint; DONE-when 1, 2, 4 were already green from 03-05/03-06.
- **RICH-R-09 (unclassified probe) resolved:** chat shares the persona with the agent because useChatStreaming routes through the same AgentOrchestrator — no second prompt path exists; the 03-06 persona-consistency proof (persona block as string prefix of all three stage prompts) now applies to production chat.
- **Carried watch items:** route-per-stage performs a stream probe per stage call in production — acceptable for Phase 3; a future phase may route once per turn and share the locked stream. `pnpm run verify:phase-3` covers `tests/core/ai` + `tests/core/ai/persona` + component tests under `tests/components` — new test dirs must stay within those paths. `allowCloudFallbackFromLocal` defaults true in the orchestrator — 03-07 did not thread a privacy-mode preference (no field in the Phase 3 contract); a later phase may.
- **Ready for:** Phase 3 verification (7/7 plans), then Phase 4 planning (per spec §18 order).

---

*Phase: 03-cost-effective-ai-runtime-persona-seed*
*Completed: 2026-08-28*

## Self-Check: PASSED

- All 6 source/test files + SUMMARY.md exist on disk (verified via `[ -f ]`)
- All 3 task commits found in git log via `git log --oneline --grep="03-07"`: 12a2945 (Task 1), 7882091 (Task 2), f78e754 (Task 3)
- Task 4 (human-verify checkpoint) recorded as **approved** by the user
- Gates green at checkpoint time: `pnpm run verify:phase-3` (17 files / 142 tests), `verify:phase-1` (46/381), `verify:phase-2` (14/109), `pnpm build:ext` succeeds
- No STATE.md / ROADMAP.md updates made — orchestrator owns those writes after the wave completes