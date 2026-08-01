---
phase: 05-knowledge-base
plan: 03
subsystem: memory
tags: [memory, integration, summarization, broadcastbus, verify-gate, tdd, ai-pipeline]

# Dependency graph
requires:
  - phase: 05-knowledge-base (plan 01)
    provides: NotesDB/MiniSearchNoteIndex/NoteGraph notes layer, MigrationRunner v4 stores, WriteJournal save-note-with-links
  - phase: 05-knowledge-base (plan 02)
    provides: MemoryEngine singleton (retrieve/write/LRU), ConversationMemoryStore with 12-message compact signal, UserMemoryStore, PreferenceMemoryStore np_persona, MemoryScorer D-08/D-09
  - phase: 04-context-optimization-pipeline
    provides: ContextItem contract, ProviderRouter.getCompressionModel, ContextCompressor AI-summarization pattern (FAST/haiku-class tier)
  - phase: 02-storage-security-foundation
    provides: BroadcastBus pub/sub, WriteJournal operation union
provides:
  - ConversationMemoryStore.compactConversation — LLM summarization at the 12-message boundary (head 2 + summary + tail 4 assembly, haiku-class tier, EMPTY_SUMMARY/PROVIDER_ERROR resilience, messages never deleted) + explicit shouldCompact()
  - BroadcastBus primary surface election (setPrimarySurfaceId/getPrimarySurfaceId/isPrimarySurface) — MEM-02 production-wired into MemoryEngine.isPrimarySurface()
  - createAgentTurnInputWithMemory — memory-aware turn factory pre-populating memoryHints/preferences/personaBehavior from MemoryEngine
  - loadPersonaFromMemory — PersonaInjector reads np_persona through MemoryEngine (single intermediary)
  - verify:phase-5 gate — tsc --noEmit + 10 explicit test suites (9 plan-listed + NotesDB.test.ts)
  - tests/core/integration/phase05.test.ts — end-to-end notes + memory integration suite
affects: [05a-llm-wiki, 05b-memory-governance, 07-workspace-experience, phase-5a, phase-5b, phase-7]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AI SDK generateText direct call from a core store (ContextCompressor pattern) with vi.mock('ai') in tests — no real provider contact in unit/integration tests"
    - "BroadcastBus module-level election state + isPrimarySurface(surfaceId) helper — MemoryEngine delegates, never holds election state"
    - "Discriminated-result compaction API (code: EMPTY_SUMMARY | PROVIDER_ERROR) — never thrown operational errors, no data loss on failure"
    - "<data-source> delimiter wrapping of untrusted conversation text inside the summarization prompt (CTX-T02/T-05-10)"
    - "TDD per task: RED (test commit) → GREEN (feat commit) — 4 commits for 2 tasks"

key-files:
  created:
    - tests/core/integration/phase05.test.ts
  modified:
    - src/core/memory/ConversationMemoryStore.ts
    - src/core/memory/MemoryEngine.ts
    - src/core/runtime/BroadcastBus.ts
    - src/core/ai/AgentTurnInput.ts
    - src/core/ai/persona/PersonaInjector.ts
    - package.json
    - tests/core/memory/ConversationMemoryStore.test.ts
    - tests/core/memory/MemoryEngine.test.ts

key-decisions:
  - "BroadcastBus had NO primary-election API (the plan assumed one) — added setPrimarySurfaceId/getPrimarySurfaceId/isPrimarySurface; null election (pre-election) treats every surface as primary so existing flows are not blocked"
  - "compactConversation() has no tier parameter — uses the FAST (haiku-class) tier model via getDefaultModelForTier('FAST') and a conservative tail of 4 messages (RECENT_MESSAGE_LIMITS.tiny) so the summary captures the largest middle portion (D-10 head+summary+tail, agent discretion)"
  - "verify:phase-5 lists 10 suites: the plan's 9 files PLUS NotesDB.test.ts — the must_have truth requires 'all test suites for src/core/notes/ and src/core/memory/', and the plan's literal list omitted the NotesDB suite"
  - "shouldCompact() guards count > 0 — 0 % 12 === 0 would otherwise flag an empty conversation for compaction (caught by the RED test)"
  - "MemoryEngine surfaceId resolution: explicit constructor param → globalThis.__NOWPILOT_SURFACE_ID__ → descriptive throw; entrypoints set the global at startup (Phase 7 UI scope)"
  - "Summarization prompt wraps messages in <data-source> delimiters — message content is untrusted (T-05-10 prompt-injection isolation)"

patterns-established:
  - "Pattern 1: core stores may call the AI SDK directly for deterministic background tasks (summarization) — AgentOrchestrator reserved for interactive turns (RESEARCH Open Question #2)"
  - "Pattern 2: module-level election state in BroadcastBus with MemoryEngine delegating — single-writer enforcement is shared infrastructure, not memory-layer logic"
  - "Pattern 3: verify gate scripts enumerate every test file explicitly (Nyquist non-vacuous) — missing files fail the gate"

requirements-completed: [NOTE-01, MEM-01, MEM-02]

# Coverage metadata — one entry per shipped deliverable
coverage:
  - id: D1
    description: "Conversation summarization (D-10): shouldCompact() at the 12-message boundary; compactConversation() assembles head(2)+middle+tail(4), summarizes the middle via AI SDK generateText on the FAST haiku-class tier, stores a ≤500-char ConversationSummary artifact with messageRange, and NEVER deletes original messages; empty LLM output → EMPTY_SUMMARY, provider errors → PROVIDER_ERROR"
    requirement: MEM-01
    verification:
      - kind: unit
        ref: "tests/core/memory/ConversationMemoryStore.test.ts#compactConversation boundary, haiku-class model, EMPTY_SUMMARY/PROVIDER_ERROR resilience, 500-char trim"
        status: pass
    human_judgment: false
  - id: D2
    description: "MemoryEngine → AI pipeline feed: createAgentTurnInputWithMemory() populates memoryHints (retrieve), preferences (getPreferences), personaBehavior (getPersona); loadPersonaFromMemory() reads np_persona via MemoryEngine with DEFAULT_PERSONA fallback — MemoryEngine is the single intermediary for all memory access"
    requirement: MEM-01
    verification:
      - kind: integration
        ref: "tests/core/integration/phase05.test.ts#createAgentTurnInputWithMemory memory feed + persona-integration"
        status: pass
    human_judgment: false
  - id: D3
    description: "MEM-02 production-wired: BroadcastBus primary surface election API; MemoryEngine.isPrimarySurface() compares its surfaceId (constructor param or entrypoint global) against the elected primary — the Plan 02 TODO stub is replaced; non-elected surfaces rejected with NOT_PRIMARY_SURFACE before any journal entry"
    requirement: MEM-02
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryEngine.test.ts#real BroadcastBus election test"
        status: pass
    human_judgment: false
  - id: D4
    description: "verify:phase-5 gate — tsc --noEmit first, then 10 explicitly-listed test suites (4 notes + NotesStore + 4 memory + phase05 integration); exit 0 only when all pass"
    requirement: NOTE-01
    verification:
      - kind: other
        ref: "command: pnpm run verify:phase-5 (exit 0, 130 tests, 10 suites)"
        status: pass
    human_judgment: false
  - id: D5
    description: "End-to-end integration suite (tests/core/integration/phase05.test.ts): full notes lifecycle (save [[wikilink]] → MiniSearch finds → NoteGraph backlinks → retrieve with resolved links), full memory lifecycle (write → retrieve ContextItem[] → scored ≥0.30 → tier-gated), tier-gating tiny≤3/small≤5, write-journal save-note-with-links steps, persona flow"
    requirement: NOTE-01
    verification:
      - kind: integration
        ref: "tests/core/integration/phase05.test.ts#6 integration tests"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-08-02
status: complete
---

# Phase 05 Plan 3: Integration + Verification Summary

**Memory subsystem wired into the AI pipeline end-to-end: LLM conversation summarization at the 12-message boundary (haiku-class tier, zero data loss on failure), MemoryEngine feeding memoryHints/preferences/persona into every agent turn, BroadcastBus primary-election MEM-02 enforcement replacing the Plan 02 stub, and a non-vacuous verify:phase-5 gate with a 6-test integration suite proving the full notes and memory cycles.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-08-02T06:18:00Z (local)
- **Completed:** 2026-08-02T06:30:00Z (local)
- **Tasks:** 2 (all TDD — 4 commits)
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments

- **compactConversation (D-10)** — ConversationMemoryStore now generates LLM summaries at the 12-message boundary: head (first 2) + middle + tail (last 4) assembly, `User:/Assistant:/Tool:` formatted excerpt wrapped in `<data-source>` delimiters (T-05-10 prompt-injection isolation), AI SDK `generateText` on the FAST (haiku-class) tier — never the conversation tier; summary trimmed to ≤500 chars, stored as a ConversationSummary artifact with messageRange; original messages NEVER deleted (resilience: EMPTY_SUMMARY / PROVIDER_ERROR discriminated results, never thrown)
- **shouldCompact()** — explicit D-10 boundary check (`count > 0 && count % 12 === 0`) alongside the appendMessage signal; the RED test caught the `0 % 12 === 0` empty-conversation edge
- **BroadcastBus primary election (MEM-02 production-wired)** — `setPrimarySurfaceId`/`getPrimarySurfaceId`/`isPrimarySurface` added (the plan assumed this API existed; it did not — Rule 3); MemoryEngine constructor takes `surfaceId` or reads `globalThis.__NOWPILOT_SURFACE_ID__` (descriptive throw when neither); `isPrimarySurface()` compares against the BroadcastBus election; the Plan 02 `// TODO` stub is gone; a new test proves a non-elected surface is rejected with NOT_PRIMARY_SURFACE through the real election path
- **createAgentTurnInputWithMemory** — new exported factory pre-populating `memoryHints` (MemoryEngine.retrieve → ContextItem[]), `preferences` (getPreferences), and `personaBehavior` (getPersona) — memory context flows into every AI turn; plain `createAgentTurnInput` unchanged (additive, opt-in)
- **loadPersonaFromMemory** — PersonaInjector convenience export reading np_persona via MemoryEngine (single intermediary per Phase 4b contract) with DEFAULT_PERSONA fallback
- **verify:phase-5 gate** — `tsc --noEmit && npx vitest run` over 10 explicitly-listed suites (4 notes + NotesStore + 4 memory + phase05 integration); missing files fail the gate (non-vacuous); exit 0 confirmed
- **tests/core/integration/phase05.test.ts** — real-module integration suite (only IndexedDB faked): full notes lifecycle (save→index→search→backlinks→retrieve), full memory lifecycle (write→ContextItem[]→score≥0.30→tier-gate), tier-gating (tiny≤3/small≤5), write-journal (save-note-with-links with write-note + update-index steps), persona flow (np_persona → loadPersonaFromMemory → inject), and the memory turn factory

## Task Commits

Each task was committed atomically with RED/GREEN TDD gates:

1. **Task 1: Conversation summarization — LLM call at 12-message boundary (D-10)** — RED `d3541e2` (test), GREEN `4523730` (feat)
2. **Task 2: MemoryEngine → AI pipeline wiring + verify:phase-5 gate + integration tests** — RED `a8e66cd` (test), GREEN `8d5fcc6` (feat)

**Plan metadata:** pending (committed after SUMMARY)

## Files Created/Modified

- `src/core/memory/ConversationMemoryStore.ts` - shouldCompact + compactConversation (D-10 LLM summarization, haiku-class tier, resilience)
- `src/core/memory/MemoryEngine.ts` - surfaceId constructor param, isPrimarySurface via BroadcastBus election, getMemoryEngine(surfaceId)
- `src/core/runtime/BroadcastBus.ts` - primary surface election API (setPrimarySurfaceId/getPrimarySurfaceId/isPrimarySurface)
- `src/core/ai/AgentTurnInput.ts` - createAgentTurnInputWithMemory (memory context feed)
- `src/core/ai/persona/PersonaInjector.ts` - loadPersonaFromMemory (np_persona via MemoryEngine)
- `package.json` - verify:phase-5 script (tsc + 10 explicit suites)
- `tests/core/memory/ConversationMemoryStore.test.ts` - 6 new summarization tests (12 total)
- `tests/core/memory/MemoryEngine.test.ts` - real BroadcastBus election test + surface-global setup (17 total)
- `tests/core/integration/phase05.test.ts` - 6 end-to-end integration tests (created)

## Decisions Made

- **BroadcastBus election semantics:** null (pre-election) → every surface is primary; once elected, only the elected surface writes. Preserves pre-election flows while making MEM-02 enforcement real. The plan said "use whatever the module exports" — the module exported nothing, so the API was added (documented Rule 3 deviation).
- **compactConversation tail:** no tier parameter exists on the signature, so the tail uses RECENT_MESSAGE_LIMITS.tiny (4 messages) — the summary captures the largest middle portion at any boundary (D-10 agent discretion within the head+summary+tail formula).
- **verify:phase-5 = 10 suites:** the plan's literal 9-file list omitted `NotesDB.test.ts`; the must_have truth ("all test suites for src/core/notes/ and src/core/memory/") requires it. Superset — all 9 plan-listed suites pass.
- **MemoryEngine surface resolution:** explicit param → entrypoint global → descriptive throw. Extension entrypoints set `globalThis.__NOWPILOT_SURFACE_ID__` at startup (Phase 7 UI scope); tests set it in beforeEach.
- **AI SDK `generateText` from a core store:** direct call for deterministic background summarization (RESEARCH Open Question #2 — not through AgentOrchestrator), same pattern as ContextCompressor.
- **Prompt injection isolation:** conversation excerpt wrapped in `<data-source>` delimiters per CTX-T02, addressing T-05-10 at the summarization boundary.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] BroadcastBus had no primary-surface election API**
- **Found during:** Task 2 (GREEN)
- **Issue:** The plan's Task 2E instructs "use whatever the module exports" for `BroadcastBus.getPrimarySurfaceId()`-style election — but src/core/runtime/BroadcastBus.ts exports only subscribe/publish/getBroadcastChannel. The MEM-02 production wiring had no election primitive to delegate to.
- **Fix:** Added module-level election state + `setPrimarySurfaceId(surfaceId | null)` / `getPrimarySurfaceId()` / `isPrimarySurface(surfaceId)` to BroadcastBus; MemoryEngine.isPrimarySurface() delegates to it. Null election → all surfaces primary (pre-election flows unblocked).
- **Files modified:** src/core/runtime/BroadcastBus.ts, src/core/memory/MemoryEngine.ts
- **Verification:** New MemoryEngine test drives the REAL election path (non-elected surface → NOT_PRIMARY_SURFACE, zero journal entries); full suite green.
- **Committed in:** 8d5fcc6 (Task 2 GREEN)

**2. [Rule 2 - Missing Critical] verify:phase-5 script omitted NotesDB.test.ts**
- **Found during:** Task 2 (package.json authoring)
- **Issue:** The plan's literal script lists 9 test files but the must_have truth requires "all test suites for src/core/notes/ and src/core/memory/" — `tests/core/notes/NotesDB.test.ts` (the core notes CRUD suite from Plan 01) was missing, which would make the gate vacuous for note persistence.
- **Fix:** Added `tests/core/notes/NotesDB.test.ts` to the script (10 suites). All plan-listed 9 suites still run and pass.
- **Files modified:** package.json
- **Verification:** `pnpm run verify:phase-5` exits 0 — 130 tests across 10 suites.
- **Committed in:** 8d5fcc6 (Task 2 GREEN)

**3. [Rule 1 - Bug] shouldCompact(empty conversation) returned true**
- **Found during:** Task 1 (GREEN verification)
- **Issue:** `0 % 12 === 0` is true — `shouldCompact()` on a conversation with zero messages signaled compaction. Caught by the RED test's `conv-empty` assertion.
- **Fix:** Guard `count > 0 && count % 12 === 0`.
- **Files modified:** src/core/memory/ConversationMemoryStore.ts
- **Verification:** 12/12 ConversationMemoryStore tests pass; boundary test covers 11/12/13 + empty.
- **Committed in:** 4523730 (Task 1 GREEN)

**4. [Rule 3 - Blocking] `declare global` GlobalThis augmentation rejected by tsconfig**
- **Found during:** Task 2 (verify:phase-5 tsc)
- **Issue:** The first GREEN attempt used `declare global { interface GlobalThis { __NOWPILOT_SURFACE_ID__?: string } }` — tsc errored "Element implicitly has an 'any' type because type 'typeof globalThis' has no index signature" (TS7017), breaking the gate.
- **Fix:** Replaced with a module-local `entrypointSurfaceId()` helper using an explicit cast — same contract, no ambient augmentation.
- **Files modified:** src/core/memory/MemoryEngine.ts
- **Verification:** `pnpm run verify:phase-5` tsc clean, exit 0.
- **Committed in:** 8d5fcc6 (Task 2 GREEN)

---

**Total deviations:** 4 auto-fixed (2 bug, 1 missing-critical, 1 blocking — the third was a test-typing fix folded into Task 1 GREEN)
**Impact on plan:** All auto-fixes were gate-completeness and correctness fixes surfaced by the TDD/tsc gates. The BroadcastBus election API is additive infrastructure the plan assumed existed. No scope creep, no architectural changes beyond the plan's stated intent.

## Issues Encountered

- **Pre-existing AI provider test failures (out of scope, unchanged):** the same 6 failures documented in the 05-02 SUMMARY (StreamAdapter 2 + ProviderAdapter contract 4 — `capturedOnChunk is not a function`). Verified identical after this plan's changes (748 passed + 6 failed + 1 skipped). Still logged in `.planning/phases/05-knowledge-base/deferred-items.md`; not fixed per executor scope boundary.
- **Task 2 plan-behavior Test 6** ("verify:phase-5 script exits 0") is not a unit test — it IS the gate; verified by running `pnpm run verify:phase-5` (exit 0).
- **The plan's Task 2B narrative** ("AgentOrchestrator.runTurn → PersonaInjector.inject('planner', input.personaBehavior)") does not match the actual PersonaInjector API (`inject(stage, baseSystemPrompt, opts?)`) — the plan itself concluded no PersonaInjector signature change is needed ("step A ensures personaBehavior is populated before runTurn"); confirmed and implemented exactly that way (additive `loadPersonaFromMemory` only).

## TDD Gate Compliance

Both tasks followed RED → GREEN with committed gates:

| Task | RED commit | GREEN commit | Status |
|------|-----------|--------------|--------|
| 1 (summarization) | `d3541e2` | `4523730` | Pass |
| 2 (integration + verify) | `a8e66cd` | `8d5fcc6` | Pass |

REFACTOR gates: none needed — GREEN implementations were already minimal and clean.

## Known Stubs

None — no placeholder values or unwired data paths shipped. The previous plan's `isPrimarySurface()` TODO stub is now production-wired via BroadcastBus election (its documented replacement target). The only pre-existing gap is the entrypoint global (`__NOWPILOT_SURFACE_ID__`) which extension entrypoints set at startup — Phase 7 UI scope, not a stub in this plan's deliverable surface.

## Next Phase Readiness

- **Phase 5 complete:** NOTE-01 / MEM-01 / MEM-02 all satisfied — notes layer (05-01), memory layer (05-02), integration + gate (05-03). `verify:phase-5` is the phase gate.
- **Phase 5a (LLM-Wiki):** ConversationMemoryStore.compactConversation is the canonical AI-summarization entry; UserMemoryStore + D-05 write boundary ready for governed note→memory extraction; NOTESDB save→index→graph cycle proven end-to-end.
- **Phase 7 (Notes UI):** entrypoints set `globalThis.__NOWPILOT_SURFACE_ID__` before first getMemoryEngine() call; `createAgentTurnInputWithMemory` is the turn factory for the conversation workspace; `loadPersonaFromMemory` feeds the persona settings UI.
- **Phase 6 diagnostics:** MemoryEngine surface identity + BroadcastBus election state are inspectable via the exported accessors.

---

*Phase: 05-knowledge-base*
*Completed: 2026-08-02*

## Self-Check: PASSED

- All 9 created/modified source + test files verified on disk (FOUND)
- All 4 task commits verified in git log (d3541e2, 4523730, a8e66cd, 8d5fcc6)
- Final verification run: `pnpm run verify:phase-5` exit 0 — tsc clean, 130 tests across 10 suites; full repo: 748 passed + 6 pre-existing AI-suite failures (deferred, unchanged) + 1 skipped
