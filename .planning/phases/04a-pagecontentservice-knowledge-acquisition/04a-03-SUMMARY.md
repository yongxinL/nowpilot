---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 03
subsystem: extraction
tags: [apc-lite, zod, turndown, extraction-strategy, spec-verbatim, r-1, types]

# Dependency graph
requires:
  - phase: 04a-pagecontentservice-knowledge-acquisition
    provides: 04a-01 installed turndown@7.2.4 + @types/turndown@5.0.6 (A1 typecheck proof), verify:phase-4a gate script; 04a-02 canonical CONTENT_EXTRACT_FAILED code + shared golden fixtures (RawNode fixture shape)
provides:
  - src/core/extraction/apcLite.types.ts — Appendix C.1 verbatim canonical home (R-1, D-4a-11): RawNode / GeometrySchema / InteractionSchema / FormControlSchema (password refine, D-4a-20) / APCLiteNode / APCLiteNodeSchema (z.lazy recursion) / APCLiteDocumentSchema / APCLiteDocument with full source enum incl. reserved 'servicenow-api' (D-4a-17)
  - src/core/extraction/strategies/IExtractionStrategy.ts — C.1 + §26.3 verbatim strategy contract (StrategyInput/StrategyResult/IExtractionStrategy) with the reserved 'servicenow-api' union seam
  - src/core/extraction/PageContentSerializer.ts — the single turndown HTML→markdown converter (RESEARCH Pitfall 1: defuddle browser-bundle markdown is a no-op) with exported TURNDOWN_OPTIONS parity constant (A6)
affects: [04a-04 ApcLiteStrategy + DefuddleStrategy plans, 04a-05 PageIndexBuilder plan, 04a-06 AxDomWalker plan, 04a-07 PageContextBridge plan, 04a-08 PageContentService plan, 04a-10 verify:phase-4a]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "R-1 spec-verbatim type homes: line-anchored header ('Source: Appendix C.1 (verbatim, lines …)') + full schema now (D-4a-11) — consumers import, never re-declare"
    - "Zod boundary schemas co-located with the types they validate (ContextProvenanceManifest precedent, GR-4); FormControlSchema.refine is the D-4a-20 password-omission gate — never loosened"
    - "Module-level singleton + exported pure function for the markdown converter (TraceRedactor.ts precedent); single converter rule — htmlToMarkdown is the ONLY turndown path"

key-files:
  created:
    - src/core/extraction/apcLite.types.ts
    - src/core/extraction/strategies/IExtractionStrategy.ts
    - src/core/extraction/PageContentSerializer.ts
    - tests/core/extraction/PageContentSerializer.test.ts
  modified: []

key-decisions:
  - "apcLite.types.ts + IExtractionStrategy.ts are R-1 canonical homes per Appendix C.1 verbatim (D-4a-11 full-schema-now; zero rework when 4b/5/8 or v2 automation lands) — prettier-normalized (phase gate) with zero semantic drift"
  - "PageContentSerializer locks the RESEARCH-critical pipeline correction: defuddle@0.6.6's browser-bundle markdown option is a NO-OP — turndown (approved stack) is the ONE HTML→markdown converter every prose path routes through (Pitfall 1)"
  - "The 'servicenow-api' strategy id is reserved in the source union but NOT implemented (D-4a-17) — the ServiceNow add-on registers it in Phase 8"

patterns-established:
  - "Pattern 1: R-1 verbatim contract files pass the phase gate — spec-verbatim formatting is prettier-normalized (whitespace/arrow-parens only, never schema fields) so `prettier --check .` stays green (Golden Rule 10)"
  - "Pattern 2: TDD on library-boundary utilities — the behavior pin (htmlToMarkdown '<h1>'→'# ') doubles as the A1 @types/turndown↔v7 compat gate"

requirements-completed: [CAT-01]

coverage:
  - id: D1
    description: "apcLite.types.ts — Appendix C.1 verbatim (L4411-4464): RawNode, GeometrySchema, InteractionSchema, FormControlSchema with the D-4a-20 password-omission refine, APCLiteNode(+Schema, z.lazy recursion), APCLiteDocumentSchema/APCLiteDocument with full source enum incl. 'servicenow-api'"
    requirement: CAT-01
    verification:
      - kind: other
        ref: "pnpm tsc --noEmit → exit 0; grep 'isPassword' → 41: .refine((c) => !(c.isPassword && c.value !== undefined), 'password value must be omitted'); grep -c 'servicenow-api' → 1"
        status: pass
    human_judgment: false
  - id: D2
    description: "strategies/IExtractionStrategy.ts — C.1 L4680-4700 + §26.3 L3772-3778 verbatim: StrategyInput/StrategyResult/IExtractionStrategy with the reserved 'servicenow-api' union member (D-4a-17); Rule-3 RawNode type-import fix"
    requirement: CAT-01
    verification:
      - kind: other
        ref: "pnpm tsc --noEmit → exit 0; grep -n 'servicenow-api' → 14: source: 'defuddle' | 'readability' | 'apc-lite' | 'servicenow-api'; grep -c 'canHandle' → 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "PageContentSerializer.ts — module-level TurndownService singleton + exported htmlToMarkdown + TURNDOWN_OPTIONS parity constant (A6); the single turndown converter (RESEARCH Pitfall 1)"
    requirement: CAT-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentSerializer.test.ts#converts '<h1>Hello</h1>' to '# Hello' (atx heading)"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-12
status: complete
---

# Phase 4a Plan 3: Extraction Contract Layer (Spec-Verbatim Types + Single Turndown Converter) Summary

**The three R-1 canonical contract homes of the extraction layer: `apcLite.types.ts` (Appendix C.1 verbatim — RawNode/APCLiteNode/APCLiteDocument + Zod schemas with the D-4a-20 password refine), `strategies/IExtractionStrategy.ts` (C.1 + §26.3 verbatim with the reserved 'servicenow-api' seam), and `PageContentSerializer.ts` (the single turndown HTML→markdown converter with verified defuddle markdown.js config parity) — plus the behavior-pinning unit test that doubles as the @types/turndown↔v7 compat gate**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-12T20:08:30Z
- **Completed:** 2026-08-12T20:16:30Z
- **Tasks:** 3 (1 + 1 + TDD pair)
- **Files modified:** 4

## Accomplishments

- `src/core/extraction/apcLite.types.ts` — Appendix C.1 (L4411-4464) verbatim: all 8 exports (RawNode, GeometrySchema, InteractionSchema, FormControlSchema, APCLiteNode, APCLiteNodeSchema, APCLiteDocumentSchema, APCLiteDocument); the D-4a-20 password-omission refine is intact and enforced; the full 6-member source enum (incl. reserved 'servicenow-api') ships now — zero schema rework when 4b/5/8 or v2 automation lands (D-4a-11)
- `src/core/extraction/strategies/IExtractionStrategy.ts` — C.1 (L4680-4700) + §26.3 (L3772-3778) verbatim contract: StrategyInput/StrategyResult/IExtractionStrategy; the 'servicenow-api' id is reserved in the union but NOT implemented (D-4a-17, add-on registers it in Phase 8)
- `src/core/extraction/PageContentSerializer.ts` — locks in the RESEARCH-critical finding: defuddle's browser-bundle `markdown:true` is a no-op, so the module-level TurndownService singleton with the byte-identical `TURNDOWN_OPTIONS` (A6) is the ONLY HTML→markdown path every prose layer (Defuddle/Readability/APC-lite) routes through
- `tests/core/extraction/PageContentSerializer.test.ts` — TDD behavior pin: `htmlToMarkdown('<h1>Hello</h1>') === '# Hello'` + TURNDOWN_OPTIONS parity keys; the typecheck on the serializer import proves @types/turndown@5.0.6 ↔ turndown@7.2.4 API compat (A1 gate)
- All three contract files carry the R-1 line-anchored header convention (mirroring PageContext.ts / ContextProvenanceManifest.ts)

## Task Commits

Each task was committed atomically:

1. **Task 1: apcLite.types.ts — Appendix C.1 verbatim (D-4a-11, D-4a-20)** - `c3c7da5` (feat)
2. **Task 2: strategies/IExtractionStrategy.ts — C.1 + §26.3 verbatim (D-4a-17)** - `9cbd2d9` (feat)
3. **Task 3 RED: PageContentSerializer test (behavior pin)** - `f895ff4` (test)
4. **Task 3 GREEN: PageContentSerializer — single turndown converter** - `6aa1ab9` (feat)
5. **Prettier normalization of spec-verbatim type files (phase-gate fix)** - `5cf6127` (style)

**Plan metadata:** `pending` (docs: complete plan — this commit)

## Files Created/Modified

- `src/core/extraction/apcLite.types.ts` - Appendix C.1 verbatim canonical home: RawNode / Zod schemas / APCLiteNode / APCLiteDocument (+ full source enum, D-4a-20 refine)
- `src/core/extraction/strategies/IExtractionStrategy.ts` - StrategyInput / StrategyResult / IExtractionStrategy contract (reserved 'servicenow-api')
- `src/core/extraction/PageContentSerializer.ts` - TURNDOWN_OPTIONS + htmlToMarkdown — the single turndown converter
- `tests/core/extraction/PageContentSerializer.test.ts` - pins '<h1>'→'# ' conversion + TURNDOWN_OPTIONS parity (A6/A1)

## Decisions Made

- **Prettier-normalized spec-verbatim files** (Rule 3): the compact spec excerpt formatting fails the phase gate `prettier --check .` (Golden Rule 10). Formatting is not part of the schema contract — every field, enum value, and the refine predicate/message are byte-identical after normalization (verified via git diff). The D-4a-20 refine reads `.refine((c) => !(c.isPassword && c.value !== undefined), 'password value must be omitted')` — never loosened.
- **RawNode type-import added to IExtractionStrategy** (Rule 3, in-plan documented): the spec block imports only `APCLiteNode` but `StrategyInput.raw` references `RawNode` (same canonical home) — a compile-blocking omission in the spec excerpt; fixed via `import type { APCLiteNode, RawNode } from '../apcLite.types'` per PATTERNS L161. Documented in the file header.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest 4 CLI rejects the plan's `-x` bail flag**
- **Found during:** Task 3 RED verification
- **Issue:** The plan's verify command `pnpm vitest run tests/core/extraction/PageContentSerializer.test.ts -x` fails with `CACError: Unknown option '-x'` — vitest@4 removed the short flag.
- **Fix:** Use `--bail=1` (identical stop-on-first-failure semantics).
- **Files modified:** none (command invocation only)
- **Verification:** `pnpm vitest run tests/core/extraction/PageContentSerializer.test.ts --bail=1` → 2 passed
- **Committed in:** n/a (runtime invocation)

**2. [Rule 3 - Phase gate] Prettier normalization of the two spec-verbatim type files**
- **Found during:** Plan-level verification (phase gate `prettier --check .` is part of `verify:phase-4a`, Golden Rule 10)
- **Issue:** The compact spec-excerpt formatting (single-line members, `c =>` arrow) fails prettier; also prettier's default `arrowParens: always` rewrites `refine(c => …)` → `.refine((c) => …)`.
- **Fix:** `prettier --write` both files. Zero semantic drift — verified via git diff filtered to non-comment lines: every field, optionality marker, enum value, and the refine predicate + error message are identical. The Task-1 acceptance grep literal `refine(c => !(c.isPassword` no longer byte-matches (parens added) — the refine is present, semantically verbatim, and enforced; verified with `grep -n "isPassword"` → line 41.
- **Files modified:** src/core/extraction/apcLite.types.ts, src/core/extraction/strategies/IExtractionStrategy.ts
- **Verification:** `npx prettier --check .` → all green; `pnpm tsc --noEmit` → exit 0; eslint → exit 0
- **Committed in:** 5cf6127 (style)

**3. [Rule 3 - Compile-blocking] RawNode type-import on IExtractionStrategy**
- **Found during:** Task 2
- **Issue:** Spec C.1 block (L4680-4700) imports only `APCLiteNode` but `StrategyInput.raw?: RawNode` references `RawNode` — strict tsc would fail with TS2304.
- **Fix:** Added `RawNode` to the type-only import from `../apcLite.types` (the documented Rule-3 adjustment — PATTERNS L161 flags this exact resolution; noted in the file header comment).
- **Files modified:** src/core/extraction/strategies/IExtractionStrategy.ts
- **Verification:** `pnpm tsc --noEmit` → exit 0
- **Committed in:** 9cbd2d9 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 Rule 3: 1 CLI compat, 1 phase-gate formatting, 1 compile-blocking import)
**Impact on plan:** All three fixes preserve the plan's contract semantics exactly (verbatim types, reserved seam, D-4a-20 refine) while keeping the phase gate green. No scope creep.

## Issues Encountered

- **CAT-01 NOT marked complete** (deviation from mechanical `requirements mark-complete`, same precedent as 04a-01/04a-02): the plan frontmatter lists `requirements: [CAT-01]`, but this plan delivers only the type/contract layer — CAT-01's full text ("content scripts extract `{title, url, text, metadata}` via defuddle (readability fallback, turndown APC-lite)") is realized by the strategy/service/content plans (04a-04, 04a-06, 04a-07, 04a-08) and sealed by the phase gate (04a-10). Marking it now would repeat the documented 03-01 mark-complete mistake (AI-01/AI-03 precedent). REQUIREMENTS.md checkbox stays `[ ]`; traceability row stays `Pending`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The compile-time contract layer is in place — every later plan (DefuddleStrategy, ApcLiteStrategy, PageIndexBuilder, AxDomWalker, PageContentService) imports these three homes instead of re-declaring types (R-1).
- 04a-04 (ApcLiteStrategy/DefuddleStrategy) can now consume `APCLiteDocumentSchema` as the zod boundary gate and `htmlToMarkdown` for the prose path; `tests/fixtures/pageContent.ts` (04a-02) is structurally compatible with the real `RawNode` type (R-1 verified — the fixture's inline shape matches apcLite.types.ts; the 04a-04 plan may re-point it to a type-only import).
- The A1 assumption (turndown@7.2.4 ↔ @types/turndown@5.0.6 API compat) is now proven by tsc — no runtime risk in the serializer.

---
*Phase: 04a-pagecontentservice-knowledge-acquisition*
*Completed: 2026-08-12*

## Self-Check: PASSED

- All 4 key-files exist on disk (verified with `[ -f ]`).
- All 6 commits exist in git history (c3c7da5, 9cbd2d9, f895ff4, 6aa1ab9, 5cf6127, f51bc09).
- `pnpm tsc --noEmit` → exit 0 · `pnpm vitest run tests/core/extraction/PageContentSerializer.test.ts --bail=1` → 2 passed · `npx prettier --check .` → all green · eslint on the 4 new files → exit 0.
