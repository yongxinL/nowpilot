---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 06
subsystem: extraction
tags: [content-script, ax-dom-walker, spa-navigation, wxt-locationchange, dependency-free, d-4a-01, d-4a-12, d-4a-13, d-4a-20, tdd]

# Dependency graph
requires:
  - phase: 04a-pagecontentservice-knowledge-acquisition
    provides: 04a-03 shipped apcLite.types.ts — the R-1 canonical RawNode type home both content-side files import type-only from (bundle stays dependency-free, Appendix G)
provides:
  - src/core/content/AxDomWalker.ts — walkAxDom(root): dependency-free live-DOM+ARIA walker emitting RawNode[] with roles/text/hierarchy + interaction flags (clickable/editable/focusable/disabled) + links (href/rel) + images (alt/src) + form.control; password values OMITTED AT CAPTURE (isPassword:true, no value key — D-4a-20); geometry NEVER read (D-4a-13); table structure with ARIA rowgroup/row/columnheader/cell roles
  - src/core/content/SPANavigationWatcher.ts — D-4a-01 SPA-nav detector: registers via deps.addEventListener(window, 'wxt:locationchange', handler) (wxt ctx maps the short name to the namespaced `${runtime.id}:${entrypoint}:wxt:locationchange` and auto-cleans on invalidation — RESEARCH Common Op 5), delivers onNavigate(newUrl), stop() removes eagerly; event-driven, no polling
affects: [04a-07 ContentScriptHost wiring + PageContextBridge (walker mode gate + watcher onNavigate hookup), 04a-08 PageContentService (RawNode consumption path), 04a-09 isolation scan (both files must scan clean), 04a-10 verify:phase-4a]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dependency-free content-side core (Appendix G): type-only imports from @/core/extraction/apcLite.types only — no runtime import graph growth in the content bundle (AxDomWalker imports RawNode type-only; SPANavigationWatcher imports nothing)"
    - "Capture-time privacy invariant (D-4a-20): password controls are emitted with isPassword:true and the value key never written — the emitted object satisfies FormControlSchema.refine by construction; the panel boundary re-validates (04a-04)"
    - "Event-name injection seam (RESEARCH Pitfall 4): production default 'wxt:locationchange' (wxt ctx resolves the namespaced name); tests pass the resolved `${FIXED_EXTENSION_ID}:core:wxt:locationchange` explicitly — the namespacing pin is test-visible"
    - "Direct-text capture: each RawNode.text holds only its direct text-node children (trimmed), descendant text lives in the children hierarchy — no duplicated text in the tree"

key-files:
  created:
    - src/core/content/AxDomWalker.ts
    - src/core/content/SPANavigationWatcher.ts
    - tests/core/content/AxDomWalker.test.ts
    - tests/core/content/SPANavigationWatcher.test.ts
  modified: []

key-decisions:
  - "SPANavigationWatcher accepts a structural ctx deps object (addEventListener/removeEventListener) + an eventName option: production passes the wxt ContentScriptContext (whose ctx.addEventListener auto-cleans on invalidation — never bare window.addEventListener) with the default 'wxt:locationchange'; tests pass the resolved namespaced name `${FIXED_EXTENSION_ID}:core:wxt:locationchange` so the Pitfall 4 pin (plain event never triggers) is test-asserted"
  - "AxDomWalker maps THEAD/TBODY/TFOOT to the ARIA 'rowgroup' role: the HTML parser wraps <tr>s in an implicit <tbody>, so table → rowgroup → rows is the honest hierarchy (a naive table → rows emission would be wrong for parser-generated markup); the test deep-searches rows under the table"
  - "AxDomWalker emits only meaningful nodes (text/links/images/form-controls/interaction flags/children) — empty generic containers are skipped so the tree stays small for the bridge payload"
  - "Node text is direct text-node children only (trimmed, AX_WALKER_MAX_TEXT=2000 clamp); descendant text is carried by the children hierarchy — no duplication"

patterns-established:
  - "Pattern 1: TDD on content-side primitives — RED commits (module-not-found transform failure) precede GREEN commits; the test/feat pairs are the D-4a-20 and Pitfall-4 invariant pins"
  - "Pattern 2: acceptance-grep hygiene — header comments avoid literal greppable tokens (getBoundingClientRect / forbidden-lib names) so the mechanical acceptance pins (grep == 0) stay clean"

requirements-completed: []

coverage:
  - id: D1
    description: "AxDomWalker capture-time password omission (D-4a-20) — password control emitted with isPassword:true and NO value key; text input keeps its value"
    requirement: CAT-03
    verification:
      - kind: unit
        ref: "tests/core/content/AxDomWalker.test.ts#omits password values at capture — isPassword:true and NO value key (D-4a-20)"
        status: pass
    human_judgment: false
  - id: D2
    description: "AxDomWalker interaction flags + geometry never populated (D-4a-12/13) — clickable/editable/disabled flags on links/buttons/inputs; no node carries a geometry field"
    requirement: CAT-03
    verification:
      - kind: unit
        ref: "tests/core/content/AxDomWalker.test.ts#emits interaction flags — clickable links/buttons, editable inputs, disabled controls"
        status: pass
      - kind: unit
        ref: "tests/core/content/AxDomWalker.test.ts#never populates geometry (D-4a-13 — no field, no getBoundingClientRect)"
        status: pass
    human_judgment: false
  - id: D3
    description: "AxDomWalker links + table structure (D-4a-12) — RawNode.link.href/rel captured; table → rowgroup → row → columnheader/cell hierarchy emitted"
    requirement: CAT-02
    verification:
      - kind: unit
        ref: "tests/core/content/AxDomWalker.test.ts#captures links and table structure (D-4a-12)"
        status: pass
    human_judgment: false
  - id: D4
    description: "SPANavigationWatcher namespaced wxt:locationchange detection (D-4a-01) — namespaced dispatch fires onNavigate(newUrl); plain 'wxt:locationchange' ignored (Pitfall 4 pin); stop() removes the listener"
    requirement: CAT-02
    verification:
      - kind: unit
        ref: "tests/core/content/SPANavigationWatcher.test.ts#fires the callback with newUrl on the NAMESPACED event (Pitfall 4)"
        status: pass
      - kind: unit
        ref: "tests/core/content/SPANavigationWatcher.test.ts#ignores a plain \"wxt:locationchange\" event (Pitfall 4 pin)"
        status: pass
      - kind: unit
        ref: "tests/core/content/SPANavigationWatcher.test.ts#stop() removes the listener — a second dispatch does not fire (cleanup)"
        status: pass
      - kind: unit
        ref: "tests/core/content/SPANavigationWatcher.test.ts#delivers the post-navigation newUrl to the callback (D-4a-01 invalidation signal)"
        status: pass
    human_judgment: false

# Metrics
duration: 11min
completed: 2026-08-12
status: complete
---

# Phase 4a Plan 6: Content-Side Primitives — AxDomWalker + SPANavigationWatcher Summary

**The two dependency-free content-bundle primitives: `AxDomWalker` (the actionable-mode live-DOM walker emitting RawNode trees with interaction flags, password values omitted at capture — D-4a-20 — and geometry never read — D-4a-13) and `SPANavigationWatcher` (the D-4a-01 SPA-nav detector on the wxt namespaced `wxt:locationchange` event via ctx.addEventListener, delivering newUrl and cleaning up on stop) — each with TDD-pinned behavior tests**

## Performance

- **Duration:** 11 min
- **Started:** 2026-08-12T21:22:15Z
- **Completed:** 2026-08-12T21:32:52Z
- **Tasks:** 2 (both TDD — 4 commits)
- **Files modified:** 4

## Accomplishments

- `src/core/content/AxDomWalker.ts` — `walkAxDom(root, options)` emits a RawNode forest: semantic/ARIA roles (heading/link/button/input/table/rowgroup/row/columnheader/cell/form/image/list/navigation/…), direct-text capture (trimmed, 2000-char clamp), interaction flags (clickable/editable/focusable/disabled), links `{href, rel}`, images `{alt, src}`, and form controls `{fieldName, fieldType, value?, isPassword}`. Password detection covers `type=password` AND `autocomplete=current-password/new-password`; the value key is **never written** for password fields (D-4a-20 capture-time invariant — the emitted object satisfies `FormControlSchema.refine` by construction). Geometry is never read or emitted (D-4a-13 — zero `getBoundingClientRect` in the file, grep-pinned). The only import is the type-only `RawNode` from `@/core/extraction/apcLite.types` (R-1 home) — bundle stays dependency-free (Appendix G).
- `src/core/content/SPANavigationWatcher.ts` — class over a structural ctx deps object: registers `deps.addEventListener(window, 'wxt:locationchange', handler)` (production passes the wxt `ContentScriptContext`, whose `ctx.addEventListener` maps the short name to the namespaced `${runtime.id}:${entrypoint}:wxt:locationchange` and auto-cleans on context invalidation — never bare `window.addEventListener`, RESEARCH Common Op 5). `onNavigate(newUrl)` delivers the post-navigation URL — the D-4a-01 invalidation signal the host (04a-07) uses to mark the cache stale / trigger re-extraction for subscribed tabs. `stop()` removes the listener eagerly; the file has zero imports and zero polling/MutationObserver (grep-pinned).
- `tests/core/content/AxDomWalker.test.ts` — 4 behavior pins: (1) password control → `isPassword === true` AND `'value' in control === false` (capture-time omission, never redaction), text control keeps its value; (2) clickable links/buttons, editable inputs, disabled controls; (3) no emitted node carries a geometry field; (4) link href/rel + table structure captured (ARIA rowgroup hierarchy).
- `tests/core/content/SPANavigationWatcher.test.ts` — 4 behavior pins: (1) dispatching `${FIXED_EXTENSION_ID}:core:wxt:locationchange` fires the callback with newUrl; (2) a plain `wxt:locationchange` event never triggers the watcher (Pitfall 4 pin); (3) `stop()` removes the listener — second dispatch no-ops; (4) newUrl delivery (the D-4a-01 signal).
- Plan-level verification green: `pnpm vitest run tests/core/content --bail=1` → 3 files / 14 tests passed; `pnpm tsc --noEmit` → exit 0; `prettier --check .` → clean; no forbidden imports in either content-side file.

## Task Commits

Each task was committed atomically (TDD: RED test commit → GREEN feat commit):

1. **Task 1 RED: AxDomWalker failing tests (D-4a-12/13/20)** - `e68136d` (test)
2. **Task 1 GREEN: AxDomWalker — actionable live-DOM walk (D-4a-12/13/20)** - `a9ad503` (feat)
3. **Task 2 RED: SPANavigationWatcher failing tests (D-4a-01, Pitfall 4)** - `600bfdd` (test)
4. **Task 2 GREEN: SPANavigationWatcher — namespaced wxt:locationchange (D-4a-01)** - `370be3e` (feat)

**Plan metadata:** pending (docs: complete plan — this commit)

## Files Created/Modified

- `src/core/content/AxDomWalker.ts` - walkAxDom: dependency-free RawNode[] emitter; roles/text/hierarchy/interaction flags/links/images/form.control; password value omitted at capture (D-4a-20); geometry never read (D-4a-13); type-only RawNode import
- `src/core/content/SPANavigationWatcher.ts` - wxt:locationchange SPA-nav watcher (D-4a-01): structural ctx deps, namespaced-event seam, onNavigate(newUrl), stop(); zero imports, no polling
- `tests/core/content/AxDomWalker.test.ts` - 4 behavior pins (password invariant, interaction flags, geometry unset, links/tables)
- `tests/core/content/SPANavigationWatcher.test.ts` - 4 behavior pins (namespaced dispatch, plain-event ignored, stop cleanup, newUrl delivery)

## Decisions Made

- **Namespaced-event seam in SPANavigationWatcher** (in-plan, PATTERNS L417): the constructor takes an `eventName` option defaulting to `'wxt:locationchange'`. Production passes the wxt ctx whose `ctx.addEventListener` resolves the unique namespaced name at runtime (verified in `node_modules/wxt/dist/client/content-scripts/custom-events.mjs` — `getUniqueEventName`); tests pass the resolved `${FIXED_EXTENSION_ID}:core:wxt:locationchange` explicitly so the Pitfall 4 pin is asserted, not assumed.
- **ARIA rowgroup roles** (Rule 3): the HTML parser wraps `<tr>`s in an implicit `<tbody>`, so the walker emits `table → rowgroup → row → columnheader/cell` — the honest ARIA hierarchy. The test deep-searches rows under the table.
- **Meaningful-node filter**: empty generic containers are skipped; nodes carry text/links/images/form-controls/interaction flags/children only.
- **Direct-text capture**: `RawNode.text` = trimmed direct text-node children (2000-char clamp); descendant text lives in `children` — no duplicate text in the tree.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - CLI compat] vitest 4 rejects the plan's `-x` bail flag**
- **Found during:** Task 1 RED / Task 2 RED verification
- **Issue:** The plan's verify commands use `pnpm vitest run … -x`; vitest@4.1.10 removed the short flag (`CACError: Unknown option '-x'`) — same documented deviation as 04a-03/04/05.
- **Fix:** Use `--bail=1` (identical stop-on-first-failure semantics).
- **Files modified:** none (command invocation only)
- **Verification:** `pnpm vitest run tests/core/content --bail=1` → 3 files / 14 passed
- **Committed in:** n/a (runtime invocation)

**2. [Rule 3 - Test/env] HTML parser wraps table rows in an implicit `<tbody>`**
- **Found during:** Task 1 GREEN (test 4 failed: `rows.length` was 0)
- **Issue:** The fixture `<table><tr>…</tr><tr>…</tr></table>` is parsed by the browser as `table → tbody → tr…` — the walker correctly emitted `table → tbody → rows`, so a shallow `children` filter found no rows.
- **Fix:** Mapped THEAD/TBODY/TFOOT to the ARIA `rowgroup` role (semantically correct) and made the test deep-search rows under the table (`findAll`).
- **Files modified:** src/core/content/AxDomWalker.ts, tests/core/content/AxDomWalker.test.ts
- **Verification:** `pnpm vitest run tests/core/content/AxDomWalker.test.ts --bail=1` → 4 passed
- **Committed in:** a9ad503 (Task 1 GREEN commit)

**3. [Rule 3 - Acceptance-grep hygiene] Header comments tripped the mechanical acceptance greps**
- **Found during:** Task 1 acceptance criteria (getBoundingClientRect grep) + Task 2 acceptance criteria (MutationObserver grep)
- **Issue:** The dependency-free header comments named the prohibited tokens (`getBoundingClientRect`, schema/extraction-lib names, `MutationObserver`) — a literal grep of the source file counts comment mentions, failing the `grep == 0` acceptance pins despite zero code usage.
- **Fix:** Reworded the comments (forced-layout reads / schema-runtime or extraction-lib imports / observer-based watching) — zero code behavior change, the prohibition intent is preserved.
- **Files modified:** src/core/content/AxDomWalker.ts, src/core/content/SPANavigationWatcher.ts
- **Verification:** `grep -c getBoundingClientRect` → 0; `grep -c MutationObserver` → 0; forbidden-import grep → NONE; suites still green
- **Committed in:** a9ad503 / 370be3e (Task GREEN commits)

---

**Total deviations:** 3 auto-fixed (3 Rule 3: 1 CLI compat, 1 test/env table structure, 1 acceptance-grep hygiene)
**Impact on plan:** All three fixes preserve the plan's semantics exactly (password invariant, namespacing pin, geometry prohibition, dependency-free bundle). No scope creep.

## Issues Encountered

- **CAT-02/CAT-03/CAT-04 NOT marked complete** (same documented precedent as 04a-01/02/03's CAT-01): the plan frontmatter lists `requirements: [CAT-02, CAT-03, CAT-04]`, but this plan ships only the two content-side primitives. CAT-02's full text names PageContextBridge delivery (04a-07); CAT-03's full text names TraceRedactor application panel-side (04a-08/10); CAT-04's full text is the ISOLATED-world isolation scan (04a-09, flagged unresolved in the plan). Marking any now would repeat the documented 03-01 mark-complete mistake. REQUIREMENTS.md checkboxes stay `[ ]`; the traceability rows stay `Pending`.
- **TDD gate compliance:** both tasks followed RED→GREEN (4 commits); RED failures were module-not-found transform errors (the only legal failure mode for a new module). No gate violations.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both content-side primitives are ready to be wired: **04a-07** consumes `walkAxDom` (the mode:'actionable' gate lives in the host wiring, per D-4a-12) and constructs `SPANavigationWatcher` with the wxt ctx + an `onNavigate` callback that rebuilds the live context and marks the panel cache stale via the bridge (D-4a-01 hybrid trigger).
- The `RawNode` output contract is already R-1-consistent with `apcLite.types.ts` (type-only import — ApcLiteStrategy in 04a-04 validates the same shape), so the bridge payload needs no adaptation.
- The bundle-safety posture is proven at the source level: both files carry zero runtime imports (one type-only import), so the 04a-09 isolation scan should see no forbidden tokens and the < 50 KB payload headroom is preserved.

---
*Phase: 04a-pagecontentservice-knowledge-acquisition*
*Completed: 2026-08-12*

## Self-Check: PASSED

- All 4 key-files + the SUMMARY exist on disk (verified with `[ -f ]`).
- All 4 commits exist in git history (e68136d, a9ad503, 600bfdd, 370be3e) in RED→GREEN order per task (TDD gate compliance: no gate violations).
- `pnpm vitest run tests/core/content --bail=1` → 3 files / 14 tests passed · `pnpm tsc --noEmit` → exit 0 · `npx prettier --check .` → all green · eslint on the 4 new files → exit 0.
- Acceptance greps: `getBoundingClientRect` count 0 · `MutationObserver` count 0 · forbidden-import grep → NONE · `FIXED_EXTENSION_ID` namespaced dispatch present in the watcher test.
