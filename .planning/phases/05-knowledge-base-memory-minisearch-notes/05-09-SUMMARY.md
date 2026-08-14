---
phase: 05-knowledge-base-memory-minisearch-notes
plan: 09
subsystem: memory + workspace persistence
tags: [workspace-store, np-workspace, memory-engine, token-budget, indexeddb, conversation-memory, gap-closure]

# Dependency graph
requires:
  - phase: 05-knowledge-base-memory-minisearch-notes
    provides: MemoryEngine.assemble budget seam (05-04), WorkspaceStore D-18 serialization set (Phase 1/05-07), MemoryDB composite-key message store (Phase 2)
provides:
  - selectedNotes star persistence through the np_workspace D-18 serialization set (CR-01)
  - combined memory-section token budget ≤ 1000 (WMB + fact lines + separators) via the packed buildMemorySectionText estimate (WR-01)
  - single IndexedDB connection held across getMemoryEngine().assemble calls (WR-06)
  - MEMORY_RETRIEVAL_FAILED canonical code emitted at the MemoryEngine retrieval boundary (WR-04)
  - appendTurn seq fallback that cannot overwrite the seq-1 message on index-read failure (WR-05)
affects: [05-10 gap-closure (CR-02, WR-02/03/07/08, IN-01..04), phase verification gate, REQUIREMENTS KNW-04/KNW-05]

# Tech tracking
tech-stack:
  added: []  # gap-closure — no new packages
  patterns:
    - "Budget enforcement measured against the REAL packed section text (buildMemorySectionText + estimateTokens), never per-fact estimates that ignore the working-memory block"
    - "Module-held lazy promise holder for a single IndexedDB connection with rejection self-heal (WR-06)"
    - "vi.mock + importOriginal whole-module mock for ESM live-binding seams (vi.spyOn cannot patch namespace exports)"

key-files:
  created: []
  modified:
    - src/core/workspace/WorkspaceStore.ts
    - src/core/memory/MemoryEngine.ts
    - src/core/memory/ConversationMemoryStore.ts
    - tests/core/workspace/WorkspaceStore.test.ts
    - tests/core/memory/MemoryEngine.test.ts
    - tests/core/memory/ConversationMemoryStore.test.ts

key-decisions:
  - "selectedNotes enters ACTIVE_FIELDS (after openedStandaloneTabId, before version) — pickActive needs no change; sanitizeStored accepts only array-of-strings (T-1-13 drop-and-degrade)"
  - "The ≤1000-token cap is measured against estimateTokens(buildMemorySectionText({memoryHints, workingMemoryBlock})) — the only honest measurement; §3.6 block-truncation-before-facts is honored ONLY as a last resort so an O.10-valid ≤300 block stays byte-identical and facts degrade whole first"
  - "WR-06 db handle is a module-scope promise (not a surface closure field) so the rejection self-heal (.catch → null) survives across surface lifetime"
  - "The appendTurn seq fallback derives from stored meta.messageCount — the composite key [conversationId, seq] can never collide with an existing row on a transient read failure"
  - "ESM live bindings cannot be patched with vi.spyOn on a namespace import — the WR-05 regression uses the vi.mock + importOriginal whole-module pattern (RendererService.test.ts precedent)"

patterns-established:
  - "Rule 1 (deviation): the plan's vi.spyOn(MemoryDBModule, 'getMessagesForConversation') approach cannot intercept a named ESM export binding — replaced with a whole-module vi.mock + importOriginal seam routed through a vi.hoisted holder, preserving real behavior for every other test"

requirements-completed: [KNW-04, KNW-05]

# Coverage metadata — one entry per shipped deliverable
coverage:
  - id: D1
    description: "Star toggles persist through np_workspace — toggleSelectedNote → journaled update → stored payload carries selectedNotes → fresh init hydrates the star set (CR-01)"
    requirement: KNW-04
    verification:
      - kind: unit
        ref: "tests/core/workspace/WorkspaceStore.test.ts#star toggles persist through np_workspace (CR-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Malformed selectedNotes in storage is never merged — 'nope' and [42] degrade to [] without throwing (T-1-13)"
    requirement: KNW-04
    verification:
      - kind: unit
        ref: "tests/core/workspace/WorkspaceStore.test.ts#malformed selectedNotes in storage is never merged (T-1-13)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Combined memory section (working-memory block + fact lines + separators) never exceeds MAX_MEMORY_TOKENS via the packed buildMemorySectionText estimate (WR-01)"
    requirement: KNW-05
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryEngine.test.ts#keeps the packed section (WMB + facts) ≤ MAX_MEMORY_TOKENS with whole facts dropped from the end"
        status: pass
    human_judgment: false
  - id: D4
    description: "An O.10-valid working-memory block is kept byte-identical — facts degrade whole first; block truncation is the last resort only (WR-01, D-04-13)"
    requirement: KNW-05
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryEngine.test.ts#keeps the O.10-valid block byte-identical — facts degrade first, never the block"
        status: pass
    human_judgment: false
  - id: D5
    description: "A corrupt >1000-token working-memory block is truncated as the last resort so the ≤1000-token truth holds unconditionally (WR-01, §3.6)"
    requirement: KNW-05
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryEngine.test.ts#truncates a corrupt oversized block as the LAST resort (facts at 0, block alone over the cap)"
        status: pass
    human_judgment: false
  - id: D6
    description: "getMemoryEngine().assemble reuses one IndexedDB connection — openMemoryDB invoked exactly once across two assembles, rejection self-heals (WR-06)"
    requirement: KNW-04
    verification:
      - kind: unit
        ref: "tests/core/memory/MemoryEngine.test.ts#opens MemoryDB exactly once across two assemble calls"
        status: pass
    human_judgment: false
  - id: D7
    description: "appendTurn never overwrites an existing conversation message — on index-read failure the new turn is written at seq = stored messageCount + 1 and the seq-1 message survives (WR-05)"
    requirement: KNW-04
    verification:
      - kind: unit
        ref: "tests/core/memory/ConversationMemoryStore.test.ts#WR-05: a failed index read must not overwrite the seq-1 message"
        status: pass
    human_judgment: false

# Metrics
duration: 17 min
completed: 2026-08-14
status: complete
---

# Phase [05] Plan [09]: Core Data-Correctness Gap Closure — Star Persistence, Combined Memory Budget, Seq-Overwrite Fix

**selectedNotes star persistence through the np_workspace D-18 serialization set (CR-01), a combined memory-section ≤1000-token budget measured against the real packed section (WR-01), a single reused IndexedDB connection (WR-06), the live MEMORY_RETRIEVAL_FAILED canonical code (WR-04), and an appendTurn seq fallback that can never overwrite the seq-1 message on index-read failure (WR-05)**

## Performance

- **Duration:** 17 min
- **Started:** 2026-08-14T08:58:41Z
- **Completed:** 2026-08-14T09:15:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- **CR-01 (data-loss blocker closed):** `selectedNotes` entered `ACTIVE_FIELDS` between `openedStandaloneTabId` and `version`; `sanitizeStored` now merges it only as an array-of-strings (T-1-13 drop-and-degrade, mirroring the `openedStandaloneTabId` guard). The star set now rides the journaled `update()` path — toggle → stored np_workspace payload → re-init hydrate — proven by a round-trip regression that reloads the store from real storage (VERIFICATION truth #9).
- **WR-01 (KNW-05 unblocked):** `assemble` budgets facts against `estimateTokens(buildMemorySectionText({ memoryHints, workingMemoryBlock }))` — the packed section including the working-memory block, per spec §3.6. Whole-item fact drops from the end retain the `memories.length > 0` guard; a last-resort block truncation (quarter-char steps, `estimateTokens` as the only counter) guarantees the ≤1000-token truth unconditionally against a corrupt >1000-token block, while an O.10-valid block stays byte-identical (VERIFICATION truth #7).
- **WR-06:** `getMemoryEngine()` holds a module-scope `memoryDbPromise` (open once, `.catch` resets to null for self-heal); the surface's assemble awaits `getMemoryDb()` — the IDB connection leak per assemble call is gone, pinned by a fresh-module spy regression (exactly one `openMemoryDB` across two assembles).
- **WR-04:** the retrieval catch at the MemoryEngine orchestration boundary now logs `ERROR_CODES.MEMORY_RETRIEVAL_FAILED` (the idb-level failure stays logged inside the store with STORE_READ) — a live call site for the previously-dead canonical code.
- **WR-05 (data-loss mode closed):** `appendTurn` derives the new seq from `(existing?.messageCount ?? 0) + 1` whenever the index read yields zero messages, so the composite key `[conversationId, seq]` can never collide with an existing row on a transient IDB error. The regression test forces one read rejection and proves both rows survive (seq 1 'hello' byte-intact, seq 2 'second turn').

## Task Commits

Each task was committed atomically:

1. **Task 1: CR-01 — persist selectedNotes through the np_workspace serialization set** - `991586c` (feat)
2. **Task 2: WR-01+WR-06+WR-04 — combined ≤1000 memory budget, one DB connection, MEMORY_RETRIEVAL_FAILED emitted** - `a07c419` (feat)
3. **Task 3: WR-05 — appendTurn seq fallback cannot overwrite the seq-1 message** - `2b0fc14` (fix)

**Plan metadata:** pending (committed with the docs close-out)

## Files Created/Modified

- `src/core/workspace/WorkspaceStore.ts` - `selectedNotes` added to ACTIVE_FIELDS (D-18 set); `sanitizeStored` accepts array-of-strings `selectedNotes` only; module-header durability sentence updated
- `src/core/memory/MemoryEngine.ts` - combined packed-section budget in `assemble` (imports `buildMemorySectionText` from ContextPack — one-directional); module-held `memoryDbPromise` + `getMemoryDb()` helper with rejection self-heal; retrieval catch emits `MEMORY_RETRIEVAL_FAILED`; module header documents both
- `src/core/memory/ConversationMemoryStore.ts` - `appendTurn` seq base falls back to `(existing?.messageCount ?? 0)` when the index read yields zero messages; header comment documents the fallback
- `tests/core/workspace/WorkspaceStore.test.ts` - CR-01 star round-trip (toggle → `vi.waitFor` stored payload → `resetStore()` → re-init → star present) + malformed `selectedNotes` rejection (`'nope'` / `[42]`)
- `tests/core/memory/MemoryEngine.test.ts` - WR-01 combined ≤1000 (populated 300-token WMB + 5×250-token facts), byte-identical block (facts degrade first), corrupt >1000-token block truncated as last resort, WR-06 single-open (`vi.resetModules()` + fresh imports + spy)
- `tests/core/memory/ConversationMemoryStore.test.ts` - WR-05 no-overwrite regression (seed seq-1 → forced read failure → both rows present, meta.messageCount 2)

## Decisions Made

- `selectedNotes` enters the serialization set only as array-of-strings — malformed storage is dropped and degrades to `[]`, never merged (T-1-13 contract preserved).
- The ≤1000-token cap is enforced against the REAL packed section text — per-fact estimates that ignore the working-memory block are the exact WR-01 defect and were removed.
- §3.6's truncate-the-block-first degradation is implemented strictly as a last resort: it can only fire when facts reach 0 AND the block alone exceeds the cap (a corrupt >1000-token block outside the O.10 ≤300 write path); the O.10-valid path keeps facts-first whole-item drops.
- The WR-06 holder is module-scope (not a closure field) so the self-heal reset survives across the lazy surface's lifetime.
- ESM live bindings can't be patched with `vi.spyOn` on a namespace import — the WR-05 regression uses the repo's `vi.mock` + `importOriginal` whole-module pattern with a `vi.hoisted` seam (see deviation below).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] WR-05 test: `vi.spyOn` on the MemoryDB namespace cannot intercept the live ESM binding**
- **Found during:** Task 3 (WR-05 regression test)
- **Issue:** The plan prescribed `vi.spyOn(MemoryDBModule, 'getMessagesForConversation')` with the import "mirroring the source module so the spy replaces the live binding". Vitest cannot patch a named ESM export through a namespace spy — the store kept calling the real function, so the first run of the regression failed (`expected [...] to have a length of 2 but got 1`).
- **Fix:** Replaced with a whole-module `vi.mock('@/core/storage/MemoryDB', importOriginal)` (RendererService.test.ts precedent) that preserves every real export and routes `getMessagesForConversation` through a `vi.hoisted` holder — the test installs a once-failing wrapper (swallowing the rejection to `[]` exactly like the real function's STORE_READ catch) then delegates back to the real read. Two iterations were needed: the first attempt rejected through (breaking the write path) instead of swallowing to `[]`, and the second captured the mock instead of the real function (infinite recursion); the final shape stores the real function inside the factory and exposes it via the hoisted holder.
- **Files modified:** tests/core/memory/ConversationMemoryStore.test.ts
- **Verification:** `pnpm vitest run tests/core/memory/ConversationMemoryStore.test.ts --bail=1` → 14/14 pass, no recursion, `pnpm exec tsc --noEmit` exit 0
- **Committed in:** `2b0fc14` (part of Task 3 commit)

**2. [Rule 3 - Blocking] Prettier formatting + unused import flagged by eslint**
- **Found during:** Task 3 verification
- **Issue:** The new test file failed `prettier --check`; the top-level `getMemoryEngine` import was unused (the WR-06 test imports the fresh module dynamically) — eslint `no-unused-vars` error.
- **Fix:** Ran `prettier --write` on all six touched files (source code was already conformant); removed the unused import.
- **Files modified:** tests/core/memory/MemoryEngine.test.ts, tests/core/memory/ConversationMemoryStore.test.ts
- **Verification:** `prettier --check` clean on all six files; eslint exit 0; full three-suite run 40/40 green; tsc exit 0
- **Committed in:** `2b0fc14` (Task 3 commit) / `a07c419` (Task 2 commit, import removal landed in the Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 Rule 3 — blocking)
**Impact on plan:** Both were test-infrastructure fixes required to make the planned regressions runnable; no production code behavior changed beyond the plan. The WR-05 mock seam is now a reusable pattern for future MemoryDB binding tests.

## Issues Encountered

- Vitest cannot `vi.spyOn` a named export on an ESM namespace import (the live binding is not patchable) — resolved via the whole-module `vi.mock` + `importOriginal` pattern; the first attempt at that pattern rejected through instead of mirroring the real function's swallow-to-`[]` catch, and the second recursed infinitely by capturing the mocked function — both fixed in the final hoisted-holder shape.
- The `vi.waitFor` requirement (flagged assumption (b)) behaved as documented: journaled writes are async (`void journaledUpdateWorkspace`), so the CR-01 test waits on the stored payload before simulating reload.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- KNW-05 is unblocked at the budget level (WR-01 landed); KNW-04 verified with the WR-04/05/06 fixes; the three failed VERIFICATION truths addressed by this plan (truth #7 budget, truth #9 stars, plus WR-01/05/06 warnings) are closed.
- Ready for 05-10 (CR-02 dirty-guard bypass + WR-02/03/07/08, IN-01..04 — the remaining gap-closure work in NotesPage/ContextOptimizer/useStreamingLLM/WikilinkAutocomplete/BacklinksPanel/NoteGraphView).
- Full `verify:phase-5` gate (eslint + prettier + tsc + wxt build + vitest run) is the 05-10 final gate / phase gate task; touched suites, eslint, prettier, and tsc already verified green here (3 suites 40/40, broader context/pages/memory/isolation run 22 files / 282 tests).

---
*Phase: 05-knowledge-base-memory-minisearch-notes*
*Completed: 2026-08-14*

## Self-Check: PASSED

All six modified files exist on disk; all three task commits present in git log (`991586c`, `a07c419`, `2b0fc14`). Plan verification commands re-run green: three touched suites 40/40, broader context/pages/memory/isolation run 22 files / 282 tests, `tsc --noEmit` exit 0, eslint exit 0, prettier clean.
