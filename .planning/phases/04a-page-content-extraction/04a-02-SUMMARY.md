---
phase: 04a-page-content-extraction
plan: 02
subsystem: extraction
tags: [readability, apc-lite, accessibility-tree, dom-walk, zod, fallback-chain, strategy-registry, depth-limit]

# Dependency graph
requires:
  - phase: 04a-01
    provides: ExtractionResult/PageContext unions (D-11/D-12), IExtractionStrategy contract, DefuddleStrategy, PageContentService.doExtract with confidence gate + strategiesAttempted, apcLite.types.ts Zod schemas, PageContentSerializer actionable branch
provides:
  - ReadabilityFallback: Mozilla Reader View fallback for degraded-confidence default-mode pages (DOM-clone guard, 500-char confidence throw)
  - ApcLiteStrategy: depth-limited DOM+ARIA walk building Zod-validated APCLiteNode trees (role/name/id/geometry/interaction/attributes) for mode='actionable'
  - Three-strategy PageContentService registry with mode-based selection: default → [Defuddle, Readability], actionable → [ApcLite]
  - Confidence-driven fallback proven: Defuddle <500 chars → Readability runs automatically, source + strategiesAttempted recorded
  - D-02 extension: password input values never enter the APCLite tree (not just the serialized HTML)
affects: [04a-03, 04a-04, phase-6 diagnostics, v2 automation substrate (§26.7), ContextOptimizer consumers]

# Tech tracking
tech-stack:
  added: [] # @mozilla/readability@0.6.0 already added in 04a-01; no new deps
  patterns:
    - "Pitfall-3 guard: DOMParser document cloned (doc.cloneNode(true)) before handing to a mutating parser — verified by test that mocks the parser's in-place mutation"
    - "Depth-limited DOM walk (100-level cap) with flattening of non-semantic elements — bounded recursion + truncated flag (T-04a-08)"
    - "Zod strictObject safeParse as the trust gate at the strategy boundary — untrusted DOM data becomes typed APCLiteNode only after validation (T-04a-09)"
    - "vi.hoisted + vi.mock('@mozilla/readability') for deterministic strategy tests incl. mutation-simulation"
    - "Node id generation (apc-N) for id-less elements — stable ids are the v2 automation handle (spec §26.7)"

key-files:
  created:
    - src/core/extraction/strategies/ReadabilityFallback.ts
    - src/core/extraction/strategies/ApcLiteStrategy.ts
    - tests/core/extraction/strategies/ReadabilityFallback.test.ts
    - tests/core/extraction/ApcLiteStrategy.test.ts
    - .planning/phases/04a-page-content-extraction/deferred-items.md
  modified:
    - src/core/extraction/PageContentService.ts (three-strategy default registry, defuddle-scoped confidence gate)
    - tests/core/extraction/PageContentService.test.ts (fallback-chain + actionable-selection tests)

key-decisions:
  - "PageContentSerializer actionable branch (plan task 2c) already existed from wave 1 — verified complete, no edit needed; task 2 focused on strategy + registry"
  - "Confidence gate scoped to result.source === 'defuddle': Readability self-throws below the same 500-char threshold, so only defuddle results need the explicit orchestrator gate (plan-mandated shape)"
  - "ApcLite generates stable apc-N node ids for id-less elements — v2 automation resolves APCLiteNode.id → geometry (spec §26.7), and most DOM elements carry no id attribute"
  - "Interactive roleless elements (contenteditable divs, tabindex) get ARIA-correct role 'generic' instead of being dropped — APCLiteNodeSchema requires a role"
  - "Password input values are excluded from ApcLite attributes (D-02 boundary extended from serialized HTML into the tree)"

patterns-established:
  - "Pattern 1: fallback confidence is always the orchestrator's decision (strategy throws/returns; PageContentService gates on source + length)"
  - "Pattern 2: every strategy validates its own output against its Zod schema before returning — strategy boundary is the trust gate, serializer re-validates the PageContext boundary"

requirements-completed: [PAGE-01]

coverage:
  - id: D1
    description: "ReadabilityFallback: Mozilla Reader View extraction for mode='default' — DOMParser document cloned before parse (Pitfall 3), throws 'Readability low confidence' below 500 chars, maps byline/excerpt/lang/siteName/publishedTime into strategy meta"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/strategies/ReadabilityFallback.test.ts#clones the document before parsing — the original DOM is never mutated (Pitfall 3)"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/strategies/ReadabilityFallback.test.ts#throws \"Readability low confidence\" when textContent is below the 500-char threshold"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/strategies/ReadabilityFallback.test.ts#maps Readability article fields into result metadata"
        status: pass
    human_judgment: false
  - id: D2
    description: "ApcLiteStrategy: depth-limited (100) DOM+ARIA walk building APCLiteNode trees with role/name/id/geometry/interaction/ARIA+data attributes, validated via APCLiteDocumentSchema.safeParse before return; password values never captured; deep-nesting fixture bounded"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/ApcLiteStrategy.test.ts#walks buttons, links and inputs into APCLiteNodes with role, geometry and interaction info"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/ApcLiteStrategy.test.ts#validates the built tree with APCLiteDocumentSchema (passes valid, rejects malformed)"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/ApcLiteStrategy.test.ts#bounds recursion depth on deeply nested DOM (T-04a-08) without crashing"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/ApcLiteStrategy.test.ts#never captures password input values (D-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PageContentService three-strategy registry with mode-based selection: default → Defuddle→Readability fallback on <500-char low confidence (source recorded), actionable → ApcLite only; strategiesAttempted audit trail preserved"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#falls back from a low-confidence defuddle result to the readability strategy (D-07)"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#selects only ApcLiteStrategy for mode=actionable and records single attempt"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/ApcLiteStrategy.test.ts#extracts via ApcLiteStrategy only and returns PageContext with apcLiteTree"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-31
status: complete
---

# Phase 04a Plan 02: Strategy Registry Expansion Summary

**Full layered extraction surface: ReadabilityFallback (Mozilla Reader View, DOM-clone guard, 500-char confidence throw) for degraded default-mode pages + ApcLiteStrategy (depth-limited DOM+ARIA walk → Zod-validated APCLiteNode tree) for mode='actionable', wired into a three-strategy PageContentService registry with mode-based selection and confidence-driven Defuddle→Readability fallback**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-31T16:21:00Z
- **Completed:** 2026-07-31T16:31:00Z
- **Tasks:** 2
- **Files modified:** 7 (4 created source/test, 1 modified source, 1 modified test, 1 phase doc)

## Accomplishments

- **ReadabilityFallback** (`id='readability'`, mode='default' only): parses via DOMParser, clones the document before `Readability.parse()` (Pitfall 3 / T-04a-06 — verified by a test that simulates Readability's destructive in-place scoring and asserts the original DOM is untouched), passes `charThreshold: 500` to the constructor, and throws `'Readability low confidence'` when parse returns null or textContent < 500 chars. Metadata mapped: byline→author, excerpt→description, lang→language, siteName, publishedTime→publishDate.
- **ApcLiteStrategy** (`id='apc-lite'`, mode='actionable' only): walks the DOMParser-constructed DOM with a 100-level recursion cap (T-04a-08 — a 2,000-deep nesting fixture returns `truncated: true` without OOM), collecting semantically relevant nodes (interactive elements, landmarks, explicit ARIA roles) into APCLiteNode trees with role, generated-or-DOM id, name, geometry (getBoundingClientRect), interaction (clickable/editable/focusable/disabled/expanded/tabIndex), and aria-/data-/native attributes. The full tree is validated with `APCLiteDocumentSchema.safeParse()` before returning (T-04a-09); password input values never enter the tree (D-02). No automation logic — the schema is the v2 substrate.
- **Three-strategy registry**: `PageContentService` default constructor is now `[DefuddleStrategy, ReadabilityFallback, ApcLiteStrategy]`. `doExtract()` filters by `canHandle()` — default mode iterates Defuddle→Readability with the confidence gate (`source === 'defuddle'` and markdown < 500 chars → fall through), actionable mode runs ApcLite alone. `strategiesAttempted` records every attempt including failures.
- **Proven chains**: new service tests prove the low-confidence fallback (defuddle < 500 chars → readability succeeds, source='readability') and the mode isolation (actionable extraction never touches default-only strategies).
- 41/41 extraction tests pass (7 ReadabilityFallback + 10 ApcLiteStrategy + 21 PageContentService + 3 DefuddleStrategy); `tsc --noEmit` clean on all extraction files; full `wxt build` succeeds; content-bundle isolation test still green (new strategies are extension-page-only, never in the content script).

## Task Commits

1. **Task 1: ReadabilityFallback Strategy** - `c65be4c` (feat: ReadabilityFallback strategy with DOM-clone guard)
2. **Task 2: ApcLiteStrategy + registry expansion** - `2827487` (feat: ApcLiteStrategy + three-strategy PageContentService registry)

**Plan metadata:** `pending` (docs commit, this SUMMARY)

## Files Created/Modified

- `src/core/extraction/strategies/ReadabilityFallback.ts` — Reader View fallback: clone-then-parse, charThreshold wiring, 500-char confidence throw, meta mapping
- `src/core/extraction/strategies/ApcLiteStrategy.ts` — DOM+ARIA walker (DomWalker): role mapping, interaction/geometry/attribute extraction, depth limit, Zod boundary validation
- `src/core/extraction/PageContentService.ts` — default registry [Defuddle, Readability, ApcLite]; confidence gate scoped to defuddle results
- `tests/core/extraction/strategies/ReadabilityFallback.test.ts` — 7 tests incl. vi.mock'd @mozilla/readability, mutation-simulating clone-guard test
- `tests/core/extraction/ApcLiteStrategy.test.ts` — 10 tests incl. service-level actionable extraction, 2,000-deep nesting, D-02 password omission
- `tests/core/extraction/PageContentService.test.ts` — +2 tests: low-confidence fallback chain, actionable-mode selection
- `.planning/phases/04a-page-content-extraction/deferred-items.md` — out-of-scope pre-existing issues ledger

## Decisions Made

- **Task 2c was already done in wave 1** — `buildPageContext()` had the mode='actionable' branch (root required, `APCLiteNodeSchema` boundary validation via `PageContextSchema`) from Plan 04a-01; verified complete, no edit needed. Task 2 concentrated on the strategy + registry.
- **Confidence gate scoped to `result.source === 'defuddle'`** (plan-mandated shape): ReadabilityFallback self-throws below the same threshold, so only defuddle results need the explicit orchestrator gate; a readability result can never silently proceed with garbage content.
- **Generated node ids (`apc-N`)**: most DOM elements carry no id attribute; v2 automation resolves `APCLiteNode.id → geometry → Input.dispatchMouseEvent` (spec §26.7), so deterministic generated ids are the automation handle. Document root uses the stable `document-root` id.
- **`role: 'generic'` for interactive roleless elements**: contenteditable/tabindex elements without any role are still interactive; ARIA's implicit role is 'generic' and `APCLiteNodeSchema` requires a role — dropping them would lose real interactive surface.
- **Password values excluded from ApcLite attributes**: the plan's attribute list (aria-/data-/native) didn't mention `value`; a `type=password` input's value attribute would otherwise leak into the tree. D-02 extended from serialized HTML into the APCLite tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Password input values excluded from ApcLite attributes (D-02 boundary)**
- **Found during:** Task 2 (ApcLiteStrategy attribute extraction)
- **Issue:** The plan's attribute list was "aria-* attributes, data-* attributes, relevant native attributes" — naively including `value` would capture `value="hunter2"` from password inputs into the tree, breaching the D-02 password-never-captured contract established in 04a-01 (spec §16)
- **Fix:** `attributesOf()` collects `value` only for non-password inputs; `input[type=password]` value is skipped; dedicated test asserts no password value in the tree
- **Files modified:** src/core/extraction/strategies/ApcLiteStrategy.ts
- **Verification:** `never captures password input values (D-02)` test passes
- **Committed in:** 2827487 (Task 2 commit)

**2. [Rule 3 - Blocking] Role-nullability type error for interactive roleless elements**
- **Found during:** Task 2 (tsc verification)
- **Issue:** `computeRole()` returns `string | null`; `buildNode` proceeds for interactive elements even when role is null (e.g. `div[contenteditable]`), but `APCLiteNode.role` requires a string — tsc error TS2322, and an invalid tree would also fail Zod
- **Fix:** role falls back to `'generic'` (the ARIA implicit role) for interactive elements without an explicit/implicit role
- **Files modified:** src/core/extraction/strategies/ApcLiteStrategy.ts
- **Verification:** tsc clean on all extraction files; 41/41 tests pass
- **Committed in:** 2827487 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both fixes are correctness requirements (privacy boundary D-02, schema-valid tree construction). No scope creep; all plan deliverables implemented per spec.

## Issues Encountered

- **Pre-existing tsc errors (9)** in `src/core/storage/` (ApiKeyStore, CryptoService, MigrationRunner — Uint8Array<ArrayBufferLike>/ArrayBuffer generics drift) — same set wave-1 reported; unrelated to this plan, untouched, logged in deferred-items.md.
- **Pre-existing test failures (6)** in `tests/core/ai/` (StreamAdapter 2, ProviderAdapter 4 — `client.chat is not a function`, @ai-sdk API drift) — verified imports-only-AI-modules, independent of extraction changes; logged in deferred-items.md.
- **`tests/isolation/no-content-script-ui.test.ts` still absent** (referenced by `verify:phase-4a`) — expected to land with 04a-04 bundle isolation; `cross-entrypoint-imports.test.ts` remains green and the `wxt build` output confirms the content bundle is untouched by the new extension-page strategies.
- **jsdom degrades defuddle's pipeline** (`:has()` selectors) — pre-existing wave-1 finding; service tests tolerate it (fixtures generous enough to clear the 500-char gate), strategy tests use happy-dom/vi.mock as established.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 04a-03** (PageIndexBuilder / MiniSearch heading-aware chunking): extraction now produces both markdown (with provenance + fallback) and validated APCLiteNode trees; the ephemeral per-tab index consumes either
- **Ready for 04a-04** (bundle isolation verification): the `no-content-script-ui` test file referenced by `verify:phase-4a` is still outstanding; isolation contract itself holds (build + cross-entrypoint test green)
- **v2 automation substrate**: APCLiteNode tree with stable ids + geometry + interaction metadata is the documented §26.7 substrate — schema unchanged, no rework needed when automation lands
- **Deferred wiring**: `pageContentService.init()` (tabs.onUpdated invalidation) still not called from the side panel entrypoint — lands with the UI plans
- **Pre-existing items for triage elsewhere**: storage tsc errors + tests/core/ai failures predate this phase (see deferred-items.md)

---
*Phase: 04a-page-content-extraction*
*Completed: 2026-07-31*

## Self-Check: PASSED

- All 4 created source/test files + SUMMARY.md verified on disk (FOUND)
- Commits verified: `c65be4c` (Task 1 ReadabilityFallback), `2827487` (Task 2 ApcLiteStrategy + registry)
- Plan-level verification re-run: 17/17 strategy tests pass, 41/41 extraction tests pass, `tsc --noEmit` clean on all extraction files, full `wxt build` succeeds
- STATE.md / ROADMAP.md intentionally NOT updated — orchestrator owns those writes after the wave completes (per execution objective)
