---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 02
subsystem: testing
tags: [error-codes, fixtures, defuddle, readability, apc-lite, page-index, golden-html, determinism]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: src/core/error/errorCodes.ts (Phase-1 C.2 subset incl. CONTENT_EXTRACT), tests/fixtures index.ts D-20/D-21 determinism convention
provides:
  - Canonical CONTENT_EXTRACT_FAILED error code in errorCodes.ts + spec Appendix C.2 (D-4a-22 W-1 gate) — every 4a strategy/service plan's debugLog sites the canonical key from day one (GR-9)
  - tests/fixtures/pageContent.ts shared golden HTML fixture module (D-4a-24) — single regression guard for DefuddleStrategy / ApcLiteStrategy / PageIndexBuilder tests
  - Spec-verbatim RawNode tree fixture with the isPassword-true / no-value capture invariant (D-4a-20)
affects: [04a strategies plans (DefuddleStrategy/ApcLiteStrategy), PageIndexBuilder plan, PageContentService plan, verify:phase-4a, 04a-10 W-1 gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "D-21 fixtures: golden HTML lives in tests/fixtures only, never imported from src/ (type-only exception); RawNode type inlined spec-verbatim until apcLite.types.ts lands"
    - "W-1 reconciliation: error-code rename lands in source + spec C.2 mirror in ONE atomic commit; grep asserts zero stale references"

key-files:
  created:
    - tests/fixtures/pageContent.ts
  modified:
    - src/core/error/errorCodes.ts
    - .planning/PRODUCT_SPEC_v0_1.md
    - tests/fixtures/fixtures.test.ts

key-decisions:
  - "CONTENT_EXTRACT_FAILED is the single canonical extraction code (D-4a-22): errorCodes.ts L18 + spec C.2 Phase-1 block L5108 renamed in one atomic commit; O.12's EXTRACTION_FAILED never added; TIMEOUT stays a registered key; UNSUPPORTED_URL is TabExtractionState state-code vocabulary, not a registry key"
  - "RawNode fixture type inlined in tests/fixtures/pageContent.ts (spec Appendix C L4414-4425 verbatim) — src/core/extraction/apcLite.types.ts does not exist yet, so no type-only src import is possible; structural typing verifies compatibility when the real type lands"

patterns-established:
  - "Pattern 1: W-1 gate mechanics — source + spec C.2 line-anchored replace in one commit, canonical L3510 entry untouched"
  - "Pattern 2: shared golden fixture module with fixed constants (FIXED_URL/FIXED_TITLE/FIXED_TIMESTAMP/FIXED_BASE_URL) + typed builders with overrides — determinism smoke block in fixtures.test.ts"

requirements-completed: [CAT-03, CAT-01]

coverage:
  - id: D1
    description: "Canonical CONTENT_EXTRACT_FAILED error code reconciled in errorCodes.ts + spec Appendix C.2 Phase-1 block (D-4a-22 W-1 gate); zero stale CONTENT_EXTRACT references"
    requirement: CAT-03
    verification:
      - kind: other
        ref: "grep -rn 'CONTENT_EXTRACT:' src/ tests/ → ZERO; grep -rc \"CONTENT_EXTRACT'\" src/ tests/ → ZERO; pnpm tsc --noEmit → exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Shared golden HTML fixture module tests/fixtures/pageContent.ts with five deterministic builders (article/boilerplate/no-heading/large-article/raw-node) + pageContent determinism smoke block"
    requirement: CAT-01
    verification:
      - kind: unit
        ref: "tests/fixtures/fixtures.test.ts#tests/fixtures/pageContent — shared golden HTML fixtures (D-4a-24)"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-08-12
status: complete
---

# Phase 4a Plan 2: Error-Code Reconciliation + Shared Golden Fixtures Summary

**Canonical `CONTENT_EXTRACT_FAILED` reconciled into errorCodes.ts and spec Appendix C.2 in one atomic commit (D-4a-22 W-1 gate, GR-9), plus the shared golden HTML fixture module (D-4a-24) with five deterministic builders covering Defuddle success / Readability fallback / paragraph-chunk / sub-chunking / password-omission paths**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-12T13:03:18Z
- **Completed:** 2026-08-12T13:09:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- `ERROR_CODES.CONTENT_EXTRACT_FAILED: 'CONTENT_EXTRACT_FAILED'` replaces the stale `CONTENT_EXTRACT` key in `src/core/error/errorCodes.ts` (L18) with a header comment noting the 4a W-1 reconciliation — grep asserts zero remaining `CONTENT_EXTRACT'` literals in src/ and tests/ (no consumer breaks).
- `.planning/PRODUCT_SPEC_v0_1.md` Appendix C.2 Phase-1 block (L5108) reconciled in place via scoped line-anchored edit; the canonical L3510 entry and L3270 TabExtractionState vocabulary were untouched. O.12's `EXTRACTION_FAILED` was never added (D-4a-22).
- `tests/fixtures/pageContent.ts` (NEW) — the D-4a-24 shared golden fixture module: `buildArticleFixture` (password-omission + relative/absolute links + img + ul + form), `buildBoilerplateFixture` (D-4a-18 fallback trigger), `buildNoHeadingFixture` (paragraph-chunk fallback), `buildLargeArticleFixture` (sections > ~500-token budget), `buildRawNodeFixture` (spec-verbatim RawNode tree with `isPassword: true` / no `value` key). Fixed constants only — no Date.now/crypto/randomness (D-20/D-21).
- `tests/fixtures/fixtures.test.ts` extended with a pageContent determinism smoke block — 16 tests green; deep-equal on repeat calls, password invariant shape asserted.

## Task Commits

Each task was committed atomically:

1. **Task 1: Reconcile CONTENT_EXTRACT → CONTENT_EXTRACT_FAILED (D-4a-22 W-1 gate)** - `5e84ce1` (fix)
2. **Task 2: Shared golden HTML fixtures (D-4a-24)** - `9cd81f4` (feat)

**Plan metadata:** pending (docs commit follows)

## Files Created/Modified
- `src/core/error/errorCodes.ts` - `CONTENT_EXTRACT` key renamed to `CONTENT_EXTRACT_FAILED` in place + 4a W-1 reconciliation header comment
- `.planning/PRODUCT_SPEC_v0_1.md` - Appendix C.2 Phase-1 block L5108: bare `CONTENT_EXTRACT` → `CONTENT_EXTRACT_FAILED` (scoped edit)
- `tests/fixtures/pageContent.ts` - NEW shared golden HTML fixtures (5 builders + FIXED_URL/FIXED_TITLE/FIXED_TIMESTAMP/FIXED_BASE_URL + inlined spec-verbatim RawNode type)
- `tests/fixtures/fixtures.test.ts` - pageContent determinism smoke block (7 new tests + helper)

## Decisions Made
- **D-4a-22 applied:** `CONTENT_EXTRACT_FAILED` is the single canonical extraction code in source AND spec C.2, landed in one atomic commit so every later 4a debugLog call sites the canonical key (GR-9). `TIMEOUT` was not re-added (already registered, errorCodes.ts L80); `UNSUPPORTED_URL` is TabExtractionState state-code vocabulary (spec L3262-3270), not a registry key.
- **RawNode fixture type inlined** (spec Appendix C L4414-4425 verbatim) because `src/core/extraction/apcLite.types.ts` doesn't exist yet — no type-only src import possible; structural typing verifies compatibility automatically when the ApcLiteStrategy plan creates the real type (R-1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Vitest 4.1.10 rejects the plan's `-x` flag**
- **Found during:** Task 2 (fixtures test run)
- **Issue:** `pnpm vitest run tests/fixtures -x` fails with `CACError: Unknown option '-x'` — the short fail-fast flag was removed in the installed vitest 4.1.10.
- **Fix:** Ran the equivalent `pnpm vitest run tests/fixtures --bail=1` (same fail-fast semantics).
- **Files modified:** none (command-line adaptation only)
- **Verification:** 16/16 tests pass with `--bail=1`
- **Committed in:** 9cd81f4 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Large-article fixture initially below the ~500-token sub-chunking budget**
- **Found during:** Task 2 (fixtures.test.ts acceptance gate)
- **Issue:** `buildLargeArticleFixture` section bodies measured 1,152 chars (~288 tokens at the 4-char/token heuristic) — under the `INDEX_CHUNK_MAX_TOKENS` ~500-token budget, so PageIndexBuilder sub-chunking tests would never actually exercise the split path.
- **Fix:** Lengthened `LARGE_SECTION_BODY` to 8 paragraphs × ~300 chars ≈ 2,600 chars per section (> 2,000-char / ~500-token threshold); the smoke test asserts the section body exceeds 2,000 chars.
- **Files modified:** tests/fixtures/pageContent.ts, tests/fixtures/fixtures.test.ts
- **Verification:** large-article smoke test passes; full fixtures suite green
- **Committed in:** 9cd81f4 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** Both fixes keep the delivered fixtures and verification commands functionally correct on the installed toolchain. No scope creep.

## Issues Encountered
- None beyond the two auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `ERROR_CODES.CONTENT_EXTRACT_FAILED` is canonical in source + spec — every 4a strategy/service plan can import it for debugLog (GR-9) from day one.
- `tests/fixtures/pageContent.ts` is the shared regression guard the DefuddleStrategy / ApcLiteStrategy / PageIndexBuilder plans' tests import — they must NOT re-declare HTML (D-4a-24).
- Ready for 04a-03 (and subsequent strategy/service plans in the phase).

---
*Phase: 04a-pagecontentservice-knowledge-acquisition*
*Completed: 2026-08-12*
