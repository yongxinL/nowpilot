---
phase: 06-pagecontentservice-knowledge-acquisition
plan: 02
subsystem: extraction
tags: [axdomwalker, apc-lite, rawnode, actionable, zod, password-omission, content-script]

# Dependency graph
requires:
  - phase: 06-pagecontentservice-knowledge-acquisition (plan 06-01)
    provides: apcLite.types.ts (RawNode/APCLiteNode/APCLiteDocument zod schemas + FormControlSchema password refine), IExtractionStrategy contract (StrategyInput.raw/StrategyResult.root), PageContentService registerStrategy seam, PageContext supersession
provides:
  - AxDomWalker — content-script-side structural DOM+ARIA walker producing RawNode trees (roles/text/hierarchy/interaction flags/links/tables); password values omitted at capture; geometry? unset; bounded walk (maxDepth 32 / 5,000 nodes); zero imports (content-bundle clean, Pitfall 8)
  - ApcLiteStrategy — panel-side actionable-path strategy: normalizeRawNode (RawNode → APCLiteNode) + APCLiteDocumentSchema validation (source 'ax') + mode:'actionable' gating + singleton registered into PageContentService at module load
  - Both §18 required test files: tests/core/content/AxDomWalker.test.ts + tests/core/extraction/ApcLiteStrategy.test.ts
affects: [06-03 (PageContentCache consumes the service incl. actionable mode), 06-04 (PageContextBridge invokes walkDom for mode:'actionable' EXTRACT_PAGE_CONTENT — the D-86 call-site), 06-05 (isolation grep validates the built content bundle stays clean), Phase 7 (APCLiteNode root feeds context receipts), Phase 11 (Diagnostics consumes extraction metrics)]

actuals:
  tokens: 7925      # chars/4 over the realized diff (31,703 diff chars across the 5 plan commits)
  tasks: 2
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Two-tier APC-lite split (§26.6 Architectural Responsibility Map): RawNode capture content-script-side (AxDomWalker, pure function, zero imports) → normalization + zod validation panel-side (ApcLiteStrategy, APCLiteDocumentSchema.parse on the OUTPUT — buildManifest convention)"
    - "Password omission enforced at capture + refine backstop: walker never emits form.control.value for password controls (isPasswordControl heuristic); FormControlSchema.refine rejects any leaky fixture panel-side — invariant proven at BOTH layers"
    - "Bounded walk: maxDepth 32 + 5,000-node cap with onTruncated callback (T-P6-10) — pathological pages truncate instead of hanging"
    - "Local plain-interface RawNode declared content-side, structurally identical to the panel-side zod-backed interface — no zod/defuddle/panel imports in the content bundle (Pitfall 8)"
    - "Strategy registration via service seam: module-load registerStrategy(apcLiteStrategy) into PageContentService (D-51); PageContentService.ts itself untouched"

key-files:
  created:
    - src/core/content/AxDomWalker.ts
    - src/core/extraction/strategies/ApcLiteStrategy.ts
    - tests/core/content/AxDomWalker.test.ts
    - tests/core/extraction/ApcLiteStrategy.test.ts
  modified: []

key-decisions:
  - "AxDomWalker is a zero-import module: RawNode is declared locally as a plain serializable interface structurally identical to apcLite.types.ts RawNode — the strongest form of the Pitfall 8 content-bundle boundary (no zod, no defuddle, no panel-side extraction imports; the bridge in 06-04 wires envelope traffic)"
  - "form.control.isPassword is emitted as a deterministic boolean for EVERY control (not only when true) — the panel-side normalizer never guesses whether a control is a password"
  - "form.control.value is emitted only when non-empty for non-password controls (empty values carry no information; keeps trees lean)"
  - "ApcLiteStrategy propagates input.truncated into stats.truncated (falling back to false) — consistent with DefuddleStrategy's additive truncated? semantics (06-01), so the bridge's walker-truncation flag reaches the result"

patterns-established:
  - "Two-tier extraction split: content captures, panel normalizes+validates (Architectural Responsibility Map rows 3-4)"
  - "Failed-fallback shape { source, root: undefined, truncated: true } so the service surfaces CONTENT_EXTRACT_FAILED — never a silent empty result (D-91)"
  - "Module-load strategy registration into the service's register seam (PageContentService untouched)"

requirements-completed: []   # infra phase — no spec-native v1 IDs (ROADMAP Phase 6 note)

coverage:
  - id: D1
    description: "AxDomWalker walks a live jsdom document into RawNode trees — roles/text/interaction flags/link hrefs/tables with deterministic DFS ids; password values omitted at capture; geometry never populated; bounded walk with onTruncated"
    verification:
      - kind: unit
        ref: "tests/core/content/AxDomWalker.test.ts#walks a structural fixture into a RawNode tree with roles/text/interaction/links/tables"
        status: pass
      - kind: unit
        ref: "tests/core/content/AxDomWalker.test.ts#omits the value of a password control at capture"
        status: pass
      - kind: unit
        ref: "tests/core/content/AxDomWalker.test.ts#never populates geometry on any RawNode"
        status: pass
      - kind: unit
        ref: "tests/core/content/AxDomWalker.test.ts#keeps the bounded-walk guard"
        status: pass
    human_judgment: false
  - id: D2
    description: "ApcLiteStrategy normalizes RawNode → APCLiteNode (heading textStyle.level from type), schema-validates the APCLiteDocument (source 'ax') with stats, gates on mode:'actionable', returns the StrategyResult contract, and registers into PageContentService so the actionable path surfaces typed errors"
    verification:
      - kind: unit
        ref: "tests/core/extraction/ApcLiteStrategy.test.ts#normalizes RawNode → APCLiteNode with the same hierarchy and schema-validates as source ax"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/ApcLiteStrategy.test.ts#canHandle only mode:actionable"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/ApcLiteStrategy.test.ts#run() returns the StrategyResult"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/ApcLiteStrategy.test.ts#registers into PageContentService so the actionable path surfaces CONTENT_EXTRACT_FAILED"
        status: pass
    human_judgment: false
  - id: D3
    description: "Password invariant proven at BOTH layers — capture omission (walker never emits the value key) and validation backstop (FormControlSchema.refine rejects a password-carrying fixture)"
    verification:
      - kind: unit
        ref: "tests/core/content/AxDomWalker.test.ts#omits the value of a password control at capture"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/ApcLiteStrategy.test.ts#rejects a password-carrying form control — FormControlSchema.refine backstop"
        status: pass
    human_judgment: false

# Metrics
duration: 6min
completed: 2026-08-29
status: complete
---

# Phase 6 Plan 2: AxDomWalker + ApcLiteStrategy — the actionable path (AX→DOM layered fallback)

**Content-script RawNode walker (password values omitted at capture, geometry unset, zero-import bundle-clean) feeding the panel-side ApcLiteStrategy that normalizes to APCLiteNode, validates the APCLiteDocument (source 'ax') with the FormControlSchema.refine backstop, gates on mode:'actionable', and registers into PageContentService**

## Performance

- **Duration:** 6 min
- **Started:** 2026-08-29T21:46:23Z
- **Completed:** 2026-08-29T21:52:56Z
- **Tasks:** 2 (both TDD — RED/GREEN pairs)
- **Files modified:** 4 (2 source + 2 test)

## Accomplishments

- **AxDomWalker** (src/core/content/AxDomWalker.ts): content-script-safe structural DOM+ARIA walker producing RawNode trees — semantic/ARIA roles, text capture, interaction flags (clickable/editable/focusable/disabled/expanded), resolved link hrefs, images (data: URIs skipped), form controls, iframe origin/crossOrigin, tables; deterministic DFS ids (n1, n1.1, …); password values omitted AT CAPTURE (D-86/D-90); `geometry?` declared-but-unset (v0.1 §26.6); bounded walk (maxDepth 32 + 5,000-node cap) with `onTruncated` callback (T-P6-10); **zero imports** — the strongest Pitfall 8 content-bundle boundary.
- **ApcLiteStrategy** (src/core/extraction/strategies/ApcLiteStrategy.ts): panel-side actionable strategy — `normalizeRawNode` (RawNode → APCLiteNode, heading `textStyle.level` derived from type h1-h6, interaction/link/image/form/iframe mapped verbatim, children recursive); output schema-validated with `APCLiteDocumentSchema.parse` (source 'ax', buildManifest convention); `canHandle` gates on `mode:'actionable'` only (D-86 — zero AX cost on the read path); failed-fallback shape for missing raw OR validation failure — never a silent empty result (D-91); singleton registered into PageContentService at module load (register seam; PageContentService.ts itself untouched).
- **Password invariant proven at both layers:** walker test asserts the `value` key is never emitted for password controls; strategy test asserts a password-carrying fixture trips the `FormControlSchema.refine` and run() catches it into the failed shape (ROADMAP SC-6).
- **Register-seam integration proof:** `PageContentService.extract({ mode:'actionable' })` without a raw payload surfaces the typed `CONTENT_EXTRACT_FAILED` — the actionable path is live and never silent.

## Task Commits

Each task was committed atomically with TDD discipline:

1. **Task 1: AxDomWalker — content-script structural walker with password omission**
   - `d4744d8` (test): add failing test for AxDomWalker content-script walker
   - `7b55aad` (feat): implement AxDomWalker content-script RawNode walker
   - `b687b4d` (test): resolve walker source via cwd for vitest transform (RED-test env fix)
2. **Task 2: ApcLiteStrategy — RawNode → APCLiteNode normalization + schema validation**
   - `842f9e0` (test): add failing test for ApcLiteStrategy actionable path
   - `ce574ec` (feat): implement ApcLiteStrategy actionable-path strategy

**Plan metadata:** pending (docs commit after SUMMARY)

## Files Created/Modified

- `src/core/content/AxDomWalker.ts` — content-side RawNode walker (created; zero imports)
- `src/core/extraction/strategies/ApcLiteStrategy.ts` — panel-side actionable strategy + module-load registration (created)
- `tests/core/content/AxDomWalker.test.ts` — 7 tests: structure, password omission, non-password capture, geometry unset, bounded walk, isPasswordControl, import boundary (created)
- `tests/core/extraction/ApcLiteStrategy.test.ts` — 6 tests: normalization+schema, refine backstop, canHandle gating, run() contract, failed shape, register seam (created)

## Decisions Made

- **Zero-import walker:** AxDomWalker declares `RawNode` locally (plain serializable interface, structurally identical to the panel-side apcLite.types.ts interface) — the strongest form of the Pitfall 8 boundary; the 06-04 bridge wires the envelope round-trip.
- **Deterministic isPassword:** the walker emits `form.control.isPassword` as a boolean for every control (not only when true) — the normalizer never guesses.
- **Value emitted when non-empty:** non-password control values are captured only when non-empty (empty values carry no information).
- **truncated propagation:** ApcLiteStrategy propagates `input.truncated` into `stats.truncated` (fallback false), matching DefuddleStrategy's additive-field semantics — the bridge's walker-truncation flag reaches the StrategyResult.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Import-boundary test could not read the walker source under the vitest jsdom transform**
- **Found during:** Task 1 GREEN verification (test 5 of 7 failed)
- **Issue:** `new URL('...', import.meta.url)` threw "The URL must be of scheme file" — vitest's jsdom transform rewrites `import.meta.url` to a non-file scheme, so the Pitfall 8 grep test crashed.
- **Fix:** Resolve the source path against `process.cwd()` (vitest runs with project root as cwd) via `node:path` `resolve()`.
- **Files modified:** tests/core/content/AxDomWalker.test.ts
- **Verification:** All 7 walker tests pass; import-boundary grep test green.
- **Committed in:** b687b4d (test commit after RED)

**2. [Rule 3 - Blocking] `isContentEditable` is not on `Element` — strict-mode lint error**
- **Found during:** Task 1 acceptance gate (`pnpm run lint`)
- **Issue:** TS2339 — `Property 'isContentEditable' does not exist on type 'Element'` (it lives on `HTMLElement`).
- **Fix:** Cast to `HTMLElement` at the read site (`(el as HTMLElement).isContentEditable`).
- **Files modified:** src/core/content/AxDomWalker.ts
- **Verification:** `pnpm run lint` strict-clean; all tests green.
- **Committed in:** 7b55aad (Task 1 feat commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes were environment/strictness corrections required for the plan's own gates; no scope creep, no architectural change.

## Issues Encountered

- Non-password `isPassword` assertion: the RED test asserted `isPassword === false` for a text control; the first GREEN pass omitted the key. Resolved by making the walker emit `isPassword` deterministically for all controls (decision above) — behavior matched the test as written.

## Known Stubs

None — both modules are fully implemented; no placeholder values, no unwired data sources.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-03 (PageContentService/PageContentCache wave): the service now has both strategies registered (defuddle 'default', apc-lite 'actionable'); actionable-mode extraction surfaces typed errors through the existing test seams.
- 06-04 (content shells + PageContextBridge): the bridge's `EXTRACT_PAGE_CONTENT` handler for `mode:'actionable'` calls `walkDom` (exports: `walkDom`, `isPasswordControl`, `RawNode`, `AX_WALK_MAX_DEPTH`, `AX_WALK_MAX_NODES`) and passes the RawNode tree over the envelope; `onTruncated` is the walker-truncation flag the bridge records.
- 06-05 (isolation grep): the built content bundle must stay free of zod/defuddle/panel modules — AxDomWalker's zero-import design keeps the walker-side clean by construction.

## Self-Check: PASSED

- [x] `src/core/content/AxDomWalker.ts` exists
- [x] `src/core/extraction/strategies/ApcLiteStrategy.ts` exists
- [x] `tests/core/content/AxDomWalker.test.ts` exists
- [x] `tests/core/extraction/ApcLiteStrategy.test.ts` exists
- [x] Commits d4744d8, 7b55aad, b687b4d, 842f9e0, ce574ec all present in `git log`
- [x] `npx vitest run tests/core/extraction/ApcLiteStrategy.test.ts tests/core/content/AxDomWalker.test.ts` → 13/13 pass
- [x] `pnpm run lint` strict-clean; zero NP-STRICT in src/core/content + src/core/extraction
- [x] Grep guards: no extraction import in AxDomWalker; geometry declared-but-unset; 06-01 modules untouched

---
*Phase: 06-pagecontentservice-knowledge-acquisition*
*Completed: 2026-08-29*