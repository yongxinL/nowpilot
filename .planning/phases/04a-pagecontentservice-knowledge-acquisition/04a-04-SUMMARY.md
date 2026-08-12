---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 04
subsystem: extraction
tags: [defuddle, readability, extraction-strategy, d-4a-18, useasync, apc-lite, zod]

# Dependency graph
requires:
  - phase: 04a-pagecontentservice-knowledge-acquisition
    provides: 04a-01 installed defuddle@0.19.2 (USER DEVIATION from ^0.6 pin) + @mozilla/readability@0.5.0; 04a-03 apcLite.types.ts (APCLiteDocumentSchema + FormControlSchema password refine), IExtractionStrategy contract, PageContentSerializer.htmlToMarkdown single turndown converter
provides:
  - src/core/extraction/strategies/DefuddleStrategy.ts — primary read path: parseDetached base-URL stamp (D-4a-08), Defuddle with useAsync:false (A5 — 0.19.2 defaults true), D-4a-18 threshold (MIN_EXTRACTED_CHARS=500 + MIN_CONTENT_DENSITY=0.2 exported), Readability fallback on a fresh clone (Pitfall 2), markdown via htmlToMarkdown (Pitfall 1)
  - src/core/extraction/strategies/ApcLiteStrategy.ts — structural path: RawNode → APCLiteNode normalization (geometry never emitted, D-4a-13), APCLiteDocumentSchema.parse boundary gate (GR-4) re-validating the D-4a-20 password invariant, D-4a-21 stats
  - tests/core/extraction/DefuddleStrategy.test.ts — 5 fixture-driven tests (source routing, threshold fallback, base-URL stamp A2, mode gating, constants pinned)
  - tests/core/extraction/ApcLiteStrategy.test.ts — 4 tests (schema boundary, password-with-value rejection, geometry-unset walk, mode gating)
affects: [04a-06 AxDomWalker plan, 04a-07 PageContextBridge plan, 04a-08 PageContentService plan (extractLayered consumes these strategies), 04a-10 verify:phase-4a]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Strategy classes implement IExtractionStrategy with id field + canHandle mode gate + async run (OpenAIProvider interface-impl shape)"
    - "D-4a-18 threshold constants exported at module top + vitest-pinned (Phase-4 RateLimiter precedent) — a later calibration is a one-line test change"
    - "Pitfall 2 discipline: every Readability call receives document.cloneNode(true); each strategy owns its detached doc"
    - "A5 guard comment travels with the Defuddle constructor — useAsync:false is a privacy invariant, not an option"

key-files:
  created:
    - src/core/extraction/strategies/DefuddleStrategy.ts
    - src/core/extraction/strategies/ApcLiteStrategy.ts
    - tests/core/extraction/DefuddleStrategy.test.ts
    - tests/core/extraction/ApcLiteStrategy.test.ts
  modified:
    - .planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-04-PLAN.md (A5 threat-model + flagged_assumptions record)

key-decisions:
  - "A5 now ACTIVE (user deviation): defuddle installed at 0.19.2 where useAsync EXISTS and DEFAULTS TO TRUE — DefuddleStrategy constructs with useAsync: false explicitly and uses the sync parse() only; verified in dist source that parse() performs zero network calls and markdown conversion is still wired ONLY in dist/node.js (browser bundle ignores markdown/separateMarkdown — Pitfall 1 holds; turndown stays the single converter)"
  - "Base-URL stamp source is input.url: the R-1 verbatim StrategyInput (Appendix C.1 L4680) has NO baseUrl field — PATTERNS' input.baseUrl ?? input.url sketch referenced a nonexistent property; root-relative fixture hrefs resolve identically against the page URL (proven by the A2 test); 04a-07 supplies the effective base via the url field"
  - "Defuddle 0.19.2 standardize dedups an h1 equal to <title> into result.title — the plan's Test 1 literal 'markdown contains the article title text' is not satisfiable; retargeted to heading + body prose in markdown with the title asserted via meta.title (D-4a-21 provenance) — documented in the test header"
  - "CAT-01/CAT-03 NOT marked complete by this plan (04a-03 precedent): CAT-01's full text needs the content/service plans (04a-06/07/08); CAT-03 (TraceRedactor) is the 04a-08 service boundary per T-4a-12/D-4a-10"

patterns-established:
  - "Pattern 1: strategy run() returns an unusable (empty markdown, no root) result when the whole chain yields nothing — extractLayered (04a-08) decides fallback vs CONTENT_EXTRACT_FAILED (D-4a-19), never a silent success at the strategy layer"
  - "Pattern 2: D-4a-13 layout-field discipline — the strategy source contains NO assignment and (after phase-gate grep) NO token; the schema declares the optional field, this layer never populates it"
  - "Pattern 3: zod boundary gate = parse (never safeParse/cast) at the strategy boundary — the D-4a-20 refine throws inside the parse, defense-in-depth over the AxDomWalker capture-time omission"

requirements-completed: [CAT-01, CAT-03]

coverage:
  - id: D1
    description: "DefuddleStrategy — primary read path: parseDetached base-URL stamp (D-4a-08), Defuddle(doc, {url, useAsync:false}) (A5), D-4a-18 threshold (MIN_EXTRACTED_CHARS=500 + MIN_CONTENT_DENSITY=0.2 exported + pinned), Readability fallback on document.cloneNode(true) with charThreshold 500 (Pitfall 2), markdown ALWAYS via htmlToMarkdown (Pitfall 1), source: 'readability' recorded when the fallback wins, meta defuddleHtml/title/wordCount"
    requirement: CAT-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/DefuddleStrategy.test.ts#extracts the article via defuddle with heading structure + provenance meta (Test 1)"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/DefuddleStrategy.test.ts#falls back to Readability on a clone when the D-4a-18 threshold fires (Test 2)"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/DefuddleStrategy.test.ts#resolves relative links against the stamped base URL (A2 gate, D-4a-08) (Test 3)"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/DefuddleStrategy.test.ts#exports the D-4a-18 pinned threshold constants (vitest-pinned, Phase-4 precedent)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ApcLiteStrategy — structural path: RawNode → APCLiteNode normalization with geometry never emitted (D-4a-13), APCLiteDocumentSchema.parse boundary gate (GR-4) re-validating the D-4a-20 password-omission refine (a password-with-value RawNode THROWS), D-4a-21 stats (nodeCount/approxTokens/durationMs/truncated), canHandle 'actionable' only (D-4a-14)"
    requirement: CAT-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/ApcLiteStrategy.test.ts#produces a schema-validated APCLiteDocument with populated stats (Test 1)"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/ApcLiteStrategy.test.ts#rejects a password control carrying a value (D-4a-20 invariant) (Test 2)"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/ApcLiteStrategy.test.ts#emits every node with geometry unset (D-4a-13) (Test 3)"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-08-12
status: complete
---

# Phase 4a Plan 4: Extraction Strategies — Defuddle Primary (+ Readability Fallback, A5 useAsync:false) and ApcLite Structural Summary

**DefuddleStrategy with the D-4a-18 char-floor + density threshold, Readability fallback on a fresh clone, and an explicit `useAsync: false` privacy guard (A5 ACTIVE at the user-pinned defuddle 0.19.2), plus ApcLiteStrategy's zod-gated RawNode → APCLiteDocument path with the re-validated password invariant — both §18-required test suites green against the shared golden fixtures (D-4a-24)**

## Performance

- **Duration:** 9 min
- **Started:** 2026-08-12T21:05:32Z
- **Completed:** 2026-08-12T21:13:54Z
- **Tasks:** 2 (both TDD — 4 commits + 1 style + 1 docs)
- **Files modified:** 5 (4 created, 1 plan-file record)

## Accomplishments

- `src/core/extraction/strategies/DefuddleStrategy.ts` — the primary prose path: `parseDetached` stamps an absolute `<base href>` (D-4a-08 — closes the detached-DOMParser relative-link/image gap, proven by the A2 fixture test asserting absolute hrefs); `new Defuddle(doc, { url, useAsync: false })` with the A5 guard comment (0.19.2 defaults `useAsync` to TRUE — the sync `parse()` performs zero network calls, verified in dist source); the D-4a-18 threshold (`MIN_EXTRACTED_CHARS = 500` + `MIN_CONTENT_DENSITY = 0.2`, exported + vitest-pinned — never a bare-length heuristic) fires on the boilerplate fixture and routes to `new Readability(document.cloneNode(true), { charThreshold: 500 })` with `source: 'readability'` recorded; markdown ALWAYS via `PageContentSerializer.htmlToMarkdown` (Pitfall 1 — 0.19.2's browser bundle still ignores `markdown`/`separateMarkdown`, wired only in `dist/node.js`); meta carries defuddleHtml/title/wordCount (D-4a-21); a fully-empty result (Readability also yields nothing) returns the unusable empty result for `extractLayered` to decide (CAT-01, D-4a-19)
- `src/core/extraction/strategies/ApcLiteStrategy.ts` — the structural path: RawNode → APCLiteNode normalization (roles/text/hierarchy/interaction/link/image/form/iframe/children; layout field NEVER emitted — D-4a-13, no `getBoundingClientRect`); `APCLiteDocumentSchema.parse(...)` as the GR-4 zod boundary gate where `FormControlSchema.refine` re-throws on a password-with-value control (D-4a-20 defense-in-depth over the capture-time AxDomWalker omission); D-4a-21 stats (nodeCount/approxTokens via `estimateTokens`/durationMs/truncated); canHandle gates 'actionable' only (D-4a-14)
- `tests/core/extraction/DefuddleStrategy.test.ts` — 5 tests from the shared fixtures: article → 'defuddle' + heading structure + `meta.title === FIXED_TITLE` (0.19.2 dedups the h1 into result.title — see deviation 3), boilerplate → 'readability' fallback, relative-link fixture asserts absolute hrefs (A2), mode gating, threshold constants pinned
- `tests/core/extraction/ApcLiteStrategy.test.ts` — 4 tests: schema-validated boundary (emitted result re-parses), password-with-value REJECTED with the exact refine message, geometry undefined on every node of the walked tree, mode gating
- Plan verification green: both suites (25 tests in `tests/core/extraction`), `tsc --noEmit` exit 0, `eslint` exit 0, `prettier --check .` all green

## Task Commits

Each task was committed atomically (TDD — RED then GREEN):

1. **Task 1 RED: DefuddleStrategy tests** - `9e54c8f` (test)
2. **Task 1 GREEN: DefuddleStrategy implementation** - `9d96058` (feat)
3. **Task 2 RED: ApcLiteStrategy tests** - `168aa34` (test)
4. **Task 2 GREEN: ApcLiteStrategy implementation** - `f37aaab` (feat, amended from `c9177b9`)
5. **Phase-gate prettier normalization** - `1e1667a` (style)
6. **A5 threat-model/flagged-assumptions record (user-mandated)** - `c35a684` (docs)

**Plan metadata:** pending (this docs commit)

## Files Created/Modified

- `src/core/extraction/strategies/DefuddleStrategy.ts` - Primary read path: parseDetached + Defuddle(useAsync:false) + D-4a-18 threshold + Readability fallback on clone + htmlToMarkdown (Pitfall 1/2, A5)
- `src/core/extraction/strategies/ApcLiteStrategy.ts` - Structural path: RawNode → APCLiteDocument via APCLiteDocumentSchema.parse (D-4a-13/20/21)
- `tests/core/extraction/DefuddleStrategy.test.ts` - 5 fixture-driven tests (source defuddle/readability, base-URL stamp A2, mode gating, constants)
- `tests/core/extraction/ApcLiteStrategy.test.ts` - 4 tests (schema boundary, password refine, geometry-unset, mode gating)
- `.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-04-PLAN.md` - A5 + T-4a-05 updated to the 0.19.2 reality (user-mandated record)

## Decisions Made

- **A5 ACTIVE (user deviation, mandated record):** defuddle is installed at 0.19.2 (not the plan's ^0.6 pin). At 0.19.2 `useAsync` exists and DEFAULTS TO TRUE — the README documents a third-party fetch fallback. DefuddleStrategy MUST construct with `useAsync: false` explicitly to preserve the R-10 zero-network-call privacy guarantee; the strategy uses the sync `parse()` exclusively. Recorded in the plan's flagged_assumptions A5 + threat register T-4a-05 (committed `c35a684`).
- **0.19.2 markdown surface:** verified at runtime — the browser bundle (`dist/index.js`) contains NO `toMarkdown`/`contentMarkdown` wiring (only `dist/node.js` has it), so Pitfall 1 holds unchanged: turndown stays the single converter, and D-4a-16 heading chunking keeps its consistent markdown shape.
- **Base-URL stamp source = input.url:** the R-1 verbatim `StrategyInput` has no `baseUrl` field (Appendix C.1 L4680-4700). PATTERNS' `input.baseUrl ?? input.url` sketch referenced a nonexistent property. Using `input.url` resolves the fixture's root-relative hrefs identically (proven by Test 3); 04a-07 supplies the effective base URL through the `url` field.
- **Test 1 title assertion retargeted:** defuddle 0.19.2's `standardize` step dedups an `<h1>` whose text equals `<title>` into `result.title`. "markdown contains the article title text" is not satisfiable; the test now asserts heading structure + body prose in markdown (the D-4a-16 chunker contract) and the title via `meta.title` (D-4a-21 provenance).
- **CAT-01/CAT-03 left unmarked** (04a-03 precedent): CAT-01 is already `[x]` from the 04a-05 wave; its full text ("content scripts extract {title, url, text, metadata}…") still needs 04a-06/07/08. CAT-03 (TraceRedactor at the service boundary) is 04a-08's deliverable per T-4a-12/D-4a-10. See Issues Encountered.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - CLI compat] Plan verify commands use `-x`, unknown in vitest 4.1.10**
- **Found during:** Task 1/2 RED verification
- **Issue:** `pnpm vitest run tests/core/extraction/<file>.test.ts -x` hard-fails with `CACError: Unknown option '-x'` (vitest 4.1.10 dropped the short bail flag).
- **Fix:** Executed with `--bail=1` (identical stop-on-first-failure semantics) — same precedent as 04a-03/04a-05.
- **Files modified:** none (command invocation only)
- **Verification:** All 25 extraction tests + full suite green
- **Committed in:** n/a (runtime invocation)

**2. [Rule 3 - Design adaptation] Base-URL stamp uses input.url, not a nonexistent input.baseUrl**
- **Found during:** Task 1 implementation
- **Issue:** PATTERNS L190 (`parseDetached(input.html, input.baseUrl ?? input.url)`) references `StrategyInput.baseUrl`, which the R-1 verbatim contract (Appendix C.1 L4680) does not declare — tsc would fail on the property access.
- **Fix:** Stamped `<base href="${input.url}">`. The page URL is the effective base in the common case; the fixture's root-relative `/guide/quickstart` + `/assets/pipeline.png` resolve identically (Test 3 proves absolute hrefs post-stamp). 04a-07 passes the effective base via the `url` field.
- **Files modified:** src/core/extraction/strategies/DefuddleStrategy.ts (header note)
- **Verification:** Test 3 green (absolute hrefs asserted in meta.defuddleHtml)
- **Committed in:** 9d96058 (Task 1 GREEN)

**3. [Rule 1 - Behavior delta at 0.19.2] h1 title dedup → Test 1 assertion retargeted**
- **Found during:** Task 1 RED run
- **Issue:** The plan's Test 1 asserted `result.markdown contains the article title text`; at 0.19.2 defuddle's standardize step dedups an `<h1>` equal to `<title>` into `result.title`, so the literal title string never reaches the markdown. Verified exhaustively (option matrix: defaults/noPatterns/noLowScoring all strip it; only `standardize: false` keeps it — not a defensible production tradeoff).
- **Fix:** Test asserts the provable intent: markdown contains the article's heading structure (`## Architecture`) + body prose (D-4a-16 chunker input), and the title via `result.meta.title === FIXED_TITLE` (D-4a-21 provenance). Readability's fallback path shows the same dedup (probe-verified) — consistent across layers.
- **Files modified:** tests/core/extraction/DefuddleStrategy.test.ts (header comment + assertions)
- **Verification:** Test 1 green; `meta.title` == FIXED_TITLE
- **Committed in:** 9e54c8f (Task 1 RED)

**4. [Rule 3 - Phase gate] Prettier normalization of 3 files**
- **Found during:** Plan-level verification (`prettier --check .` is part of verify:phase-4a, Golden Rule 10)
- **Issue:** prettier wanted formatting changes in the two strategy sources + the DefuddleStrategy test.
- **Fix:** `prettier --write` on the 3 files — zero semantic change (formatting only).
- **Files modified:** DefuddleStrategy.ts, ApcLiteStrategy.ts, DefuddleStrategy.test.ts
- **Verification:** `npx prettier --check .` → all green; 25 extraction tests still green
- **Committed in:** 1e1667a (style)

---

**Total deviations:** 4 auto-fixed (3 Rule 3: 1 CLI compat, 1 design adaptation, 1 phase-gate formatting; 1 Rule 1 behavior delta)
**Impact on plan:** All fixes preserve the plan's locked behaviors (D-4a-18 threshold, D-4a-08 stamp, D-4a-13 unset, D-4a-20 refine, Pitfall 1/2) while adapting to the user-approved defuddle 0.19.2 and keeping the phase gate green. No scope creep.

## Issues Encountered

- **CAT-01/CAT-03 checkboxes not touched by this plan** (deviation from mechanical `requirements mark-complete`, same precedent as 04a-03): the frontmatter lists `[CAT-01, CAT-03]`, but CAT-01 was already marked `[x]` by the 04a-05 wave and its full text is realized only by the content/service plans (04a-06/07/08); CAT-03 ("TraceRedactor applied to DOM-embedded sensitive values") is explicitly the 04a-08 PageContentService boundary (D-4a-10, T-4a-12). Marking either now would repeat the documented 03-01 mark-complete mistake (AI-01/AI-03 precedent). The REQUIREMENTS.md checkbox + traceability row stay as-is until 04a-08/04a-10.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both §18-required strategy suites are green and consumed by `extractLayered` (04a-08): the DefuddleStrategy fallback threshold is concrete + pinned, the ApcLiteStrategy boundary re-validates the password invariant, and both implement the C.1 contract exactly.
- 04a-06 (AxDomWalker) and 04a-07 (PageContextBridge) can now rely on: content-side omission (never capture) being re-checked panel-side by `FormControlSchema.refine` (D-4a-20, two-layer defense), the base-URL stamp contract (`url` field carries the effective base — 04a-07 must supply it), and the strategy `source`/`meta` provenance shapes the service will thread into `PageContentCache`/`PageIndexBuilder` (04a-05 already shipped).
- A5 is now ACTIVE and recorded in the plan's threat register — any future defuddle upgrade MUST keep `useAsync: false` (the guard comment travels with the constructor).

---
*Phase: 04a-pagecontentservice-knowledge-acquisition*
*Completed: 2026-08-12*

## Self-Check: PASSED

- All 4 key-files exist on disk (verified with `[ -f ]`).
- All 6 commits exist in git history (9e54c8f, 9d96058, 168aa34, f37aaab, 1e1667a, c35a684).
- `pnpm vitest run tests/core/extraction --bail=1` → 25 passed · `pnpm tsc --noEmit` → exit 0 · `npx eslint <4 files>` → exit 0 · `npx prettier --check .` → all green · `rg geometry src/core/extraction/strategies/ApcLiteStrategy.ts` → no match (D-4a-13 gate).
