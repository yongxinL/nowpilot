---
phase: 04-context-adaptive-execution
plan: 02
type: feat
status: complete
completed: 2026-07-13
tasks: 2/2
test_count: 25
---

# Phase 04 Plan 02: TokenEstimator

**Duration:** ~2 min
**Tasks:** 2/2 complete

## Accomplishments

- Task 1: Created `src/core/context/TokenEstimator.ts` — stateless class+singleton with `estimateTokens` (char-based Latin/CJK estimation), `estimateTokensBatch`, `applySafetyMargin` (ceil * 1.1 with integer-safe math), and `isCJK` (detects Chinese, Hiragana, Katakana, Hangul)
- Task 2: Created `tests/core/context/TokenEstimator.test.ts` — 25 tests covering Latin, CJK, mixed text, batch, safety margin, CJK detection, and singleton

## Files Created

- `src/core/context/TokenEstimator.ts` — TokenEstimator class + tokenEstimator singleton
- `tests/core/context/TokenEstimator.test.ts` — 25 tests across 7 describe blocks

## Self-Check: PASSED

- [x] All 25 tests pass
- [x] TypeScript compiles cleanly
- [x] estimateTokens handles Latin, CJK, mixed, empty, whitespace
- [x] applySafetyMargin: 100→110, 1→2, 0→0, 1000→1100
- [x] isCJK detects all 4 CJK Unicode ranges
- [x] All methods are synchronous, no AI SDK imports
- [x] Singleton export is instanceof TokenEstimator
