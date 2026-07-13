---
phase: 07-full-chat-agent-notes-options-pages
plan: 02
subsystem: hooks
tags: [useStreamingLLM, useWorkspace, useTheme, async-generator, chunk-buffer, abort-controller, streaming, react-hooks]

# Dependency graph
requires:
  - phase: 03-cost-effective-ai-runtime
    provides: AgentOrchestrator.runWithContext() API, ChunkBuffer class, OrchestratorEvent types
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: useWorkspaceStore with selectors, useThemeStore with selectors, WorkspaceState.drafts field
provides:
  - useStreamingLLM hook — shared AsyncGenerator iteration, ChunkBuffer batching, AbortController lifecycle
  - useWorkspace convenience hook — individual Zustand selectors for workspace state
  - useTheme convenience hook — individual Zustand selectors for theme mode
affects:
  - 07-03 (useChat/useAgent consume useStreamingLLM for streaming orchestration)
  - 07-04 (useAgent consumes useStreamingLLM for agent streaming)
  - All hook consumers across phase 7

# Tech tracking
tech-stack:
  added: []
  patterns:
    - React hook with useRef for AbortController/ChunkBuffer instance management
    - for await...of consumption of AsyncGenerator<OrchestratorEvent> inside React
    - Individual Zustand selectors (not destructure) for render optimization
    - useEffect cleanup abort pattern (Pitfall 2 mitigation)
    - Ref-based callbacks for stale closure prevention

key-files:
  created:
    - src/hooks/useStreamingLLM.ts (216 lines)
    - src/hooks/useWorkspace.ts (40 lines)
    - src/hooks/useTheme.ts (22 lines)
    - tests/hooks/useStreamingLLM.test.ts (596 lines, 10 tests)
    - tests/hooks/useWorkspace.test.ts (115 lines, 6 tests)
  modified: []

key-decisions:
  - "useStreamingLLM uses useRef for callbacks (onDeltaRef, onCompleteRef, etc.) to prevent stale closure issues in the for-await loop"
  - "AbortError is swallowed silently on abort/unmount — matches Pitfall 2 guidance from RESEARCH.md"
  - "ContextOptimizer.optimize() and MemoryEngine.assemble() are NOT called inside useStreamingLLM — context assembly is the consumer hook's responsibility (D-04)"
  - "useStreamingLLM accepts a pre-built OptimizedContext — consumer hooks (useChat/useAgent) own context assembly"
  - "useWorkspace and useTheme use individual Zustand selectors per PATTERNS.md Pattern 4/5 — prevents re-renders from unrelated store changes"

patterns-established:
  - "Pattern: Ref-based callback forwarding in streaming hooks to avoid stale closures across async iteration"

requirements-completed:
  - CHAT-01
  - CHAT-08

coverage:
  - id: D1
    description: "useStreamingLLM iterates AgentOrchestrator.runWithContext() AsyncGenerator and yields unified StreamEvent objects per D-01/D-02"
    requirement: CHAT-01
    verification:
      - kind: unit
        ref: "tests/hooks/useStreamingLLM.test.ts#calling startStream with mock AsyncGenerator yielding text-delta"
        status: pass
      - kind: unit
        ref: "tests/hooks/useStreamingLLM.test.ts#text-complete event flushes remaining buffer and fires onComplete callback"
        status: pass
    human_judgment: false
  - id: D2
    description: "Text-delta events flow through ChunkBuffer for rAF-batched flushing to onDelta callback"
    requirement: CHAT-01
    verification:
      - kind: unit
        ref: "tests/hooks/useStreamingLLM.test.ts#multiple text-delta events get batched via rAF into single onDelta call"
        status: pass
    human_judgment: false
  - id: D3
    description: "AbortController created on stream start, checked before each state update, cleaned up on unmount per Pitfall 2"
    requirement: CHAT-08
    verification:
      - kind: unit
        ref: "tests/hooks/useStreamingLLM.test.ts#calling abort() terminates the stream and sets isStreaming=false"
        status: pass
      - kind: unit
        ref: "tests/hooks/useStreamingLLM.test.ts#component unmount during streaming aborts the stream"
        status: pass
    human_judgment: false
  - id: D4
    description: "Calling startStream() while isStreaming === true first aborts the previous stream (one-stream-per-session, CHAT-08)"
    requirement: CHAT-08
    verification:
      - kind: unit
        ref: "tests/hooks/useStreamingLLM.test.ts#calling startStream while already streaming first aborts previous stream"
        status: pass
    human_judgment: false
  - id: D5
    description: "useWorkspace returns workspaceId, conversationId, activeProvider, activeSurface, drafts, and all setters"
    verification:
      - kind: unit
        ref: "tests/hooks/useWorkspace.test.ts#useWorkspace"
        status: pass
    human_judgment: false
  - id: D6
    description: "useTheme returns mode and setMode from useThemeStore selectors"
    verification:
      - kind: unit
        ref: "tests/hooks/useWorkspace.test.ts#useTheme"
        status: pass
    human_judgment: false

# Metrics
duration: 3 min
completed: 2026-07-13
status: complete
---

# Phase 7: Full Chat, Agent, Notes, Options Pages — Plan 02 Summary

**Shared useStreamingLLM hook with AsyncGenerator iteration, ChunkBuffer batching, AbortController lifecycle management, plus useWorkspace and useTheme convenience hooks with individual Zustand selectors**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-13T11:34:25Z
- **Completed:** 2026-07-13T11:37:56Z
- **Tasks:** 2 (both TDD)
- **Files created:** 5

## Accomplishments

- **useStreamingLLM** (216 lines, 10 tests) — Centralized streaming hook that owns the `for await` loop over `AgentOrchestrator.runWithContext()`, routes text-delta events through ChunkBuffer for rAF-batched rendering, manages AbortController lifecycle (creation per stream, abort on unmount), and handles all OrchestratorEvent types. Implements one-stream-per-session (CHAT-08): calling `startStream()` while already streaming first aborts the previous stream. AbortError swallowed silently on unmount (Pitfall 2 mitigation).
- **useWorkspace** (40 lines) — Convenience hook that uses individual Zustand selectors to extract workspaceId, conversationId, activeProvider, activeSurface, drafts, setDraft, clearDraft, setActiveProvider, setConversationId from useWorkspaceStore. Individual selectors prevent unnecessary re-renders from unrelated store changes. Re-exports Surface type.
- **useTheme** (22 lines) — Convenience hook that uses individual Zustand selectors for mode and setMode from useThemeStore. Re-exports ThemeMode type.
- **All 16 new tests pass** — 10 for useStreamingLLM (streaming, abort, error, tool events, permission events, degradation events, unmount cleanup) + 6 for useWorkspace/useTheme (selectors, setters, drafts). Existing 589 tests and 2 pre-existing failures unchanged.

## Task Commits

Each task was committed atomically following RED→GREEN TDD cycle:

1. **Task 1 TDD (RED): useStreamingLLM failing test** - `04c159a` (test)
2. **Task 1 TDD (GREEN): useStreamingLLM implementation** - `ad9a6b9` (feat)
3. **Task 2 TDD (RED): useWorkspace + useTheme failing tests** - `5a1c8cb` (test)
4. **Task 2 TDD (GREEN): useWorkspace + useTheme implementation** - `5290902` (feat)

**Plan metadata:** (committed after SUMMARY)

## Files Created

- `src/hooks/useStreamingLLM.ts` — Shared AsyncGenerator iteration + ChunkBuffer + AbortController lifecycle
- `src/hooks/useWorkspace.ts` — Individual-selector workspace state convenience hook
- `src/hooks/useTheme.ts` — Individual-selector theme mode convenience hook
- `tests/hooks/useStreamingLLM.test.ts` — 10 tests covering all event types, abort, and cleanup
- `tests/hooks/useWorkspace.test.ts` — 6 tests covering selectors, setters, drafts, and theme

## Decisions Made

- **Ref-based callbacks:** useStreamingLLM stores all callbacks (onDelta, onComplete, etc.) in refs (`onDeltaRef`, `onCompleteRef`, etc.) to prevent stale closure issues. The `startStream` callback captures refs, not the latest closure of each prop. This is essential because `startStream` is async and the `for await` loop spans multiple renders.
- **AbortError swallowed:** When abort is called or component unmounts, the `for await` loop catches `DOMException` with `name === 'AbortError'` and swallows it silently — no `onError` callback, no error state. This matches Pitfall 2 guidance from RESEARCH.md.
- **ContextOptimizer NOT called inside useStreamingLLM:** Per D-04, context assembly (ContextOptimizer.optimize(), MemoryEngine.assemble()) is the consumer hook's responsibility. useStreamingLLM receives a pre-built OptimizedContext.
- **Individual Zustand selectors:** Both useWorkspace and useTheme use `useWorkspaceStore((s) => s.field)` instead of destructuring the store result. This is the idiomatic Zustand pattern to prevent re-renders from unrelated state changes — the component only re-renders when the selected field changes.

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- **Task 1 (RED):** Present — `test(07-02)` commit `04c159a` (test only)
- **Task 1 (GREEN):** Present — `feat(07-02)` commit `ad9a6b9` (implementation)
- **Task 2 (RED):** Present — `test(07-02)` commit `5a1c8cb` (test only)
- **Task 2 (GREEN):** Present — `feat(07-02)` commit `5290902` (implementation)
- **REFACTOR:** Not needed — implementation clean and minimal for both tasks
- **Status:** All gates PASS

## Issues Encountered

- **Test 5 abort test needed promise-based gate:** The initial abort test used `await new Promise(() => {})` which blocked the generator indefinitely — abort couldn't unblock it. Fixed by using a promise-based gate where `cancel()` resolves the hang promise, allowing the generator to throw AbortError. This more accurately simulates how AgentOrchestrator.cancel() works in production (via AbortManager).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- useStreamingLLM ready for useChat (07-03) and useAgent (07-04) consumption
- useWorkspace and useTheme ready for all page-level components
- All 3 hook files export clean types for consumer convenience
- 605 passing tests (589 existing + 16 new), 2 pre-existing failures unchanged
- Next: Plan 07-03 and Plan 07-04 (Wave 2 — parallel Chat & Agent hooks)

## Self-Check: PASSED

- [x] `src/hooks/useStreamingLLM.ts` exists (216 lines) — exports `useStreamingLLM`
- [x] `src/hooks/useWorkspace.ts` exists (40 lines) — exports `useWorkspace`
- [x] `src/hooks/useTheme.ts` exists (22 lines) — exports `useTheme`
- [x] `tests/hooks/useStreamingLLM.test.ts` exists (596 lines, 10 tests) — all pass
- [x] `tests/hooks/useWorkspace.test.ts` exists (115 lines, 6 tests) — all pass
- [x] `for await` in useStreamingLLM.ts: 1 match
- [x] `ChunkBuffer` in useStreamingLLM.ts: 4 matches
- [x] `useEffect` in useStreamingLLM.ts: 2 matches
- [x] `AbortController` in useStreamingLLM.ts: 2 matches
- [x] `useWorkspaceStore` in useWorkspace.ts: 11 matches
- [x] `useThemeStore` in useTheme.ts: 4 matches
- [x] `drafts` in useWorkspace.ts: 3 matches
- [x] All 4 commits verified in git log

---

*Phase: 07-full-chat-agent-notes-options-pages*
*Completed: 2026-07-13*
