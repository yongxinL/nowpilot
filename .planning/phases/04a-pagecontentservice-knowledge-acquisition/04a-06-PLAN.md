---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 06
type: execute
wave: 3
depends_on: ["04a-03"]
files_modified:
  - src/core/content/AxDomWalker.ts
  - src/core/content/SPANavigationWatcher.ts
  - tests/core/content/AxDomWalker.test.ts
  - tests/core/content/SPANavigationWatcher.test.ts
autonomous: true
requirements: [CAT-02, CAT-03, CAT-04]
must_haves:
  truths:
    - "`src/core/content/AxDomWalker.ts` (NEW) is a dependency-free content-script DOM+ARIA walker (Appendix G — no React/AntD/defuddle/yaml/zustand; type-only imports from apcLite.types) that runs ONLY when `mode: 'actionable'` is requested (D-4a-12): emits RawNode[] with roles + text + hierarchy + interaction flags (clickable/editable/focusable/disabled) + links + tables; geometry is OMITTED in v0.1 (D-4a-13 — never read, no getBoundingClientRect forced-layout cost)."
    - "AxDomWalker enforces `isPassword ⇒ value omitted` AT CAPTURE (D-4a-20): a form control whose input is a password field gets `isPassword: true` and NO `value` field in the emitted RawNode — never captured, not merely redacted later; the emitted control object satisfies FormControlSchema.refine by construction (re-validated panel-side in 04a-04)."
    - "`src/core/content/SPANavigationWatcher.ts` (NEW) detects SPA navigation via the wxt namespaced `wxt:locationchange` window event using `ctx.addEventListener(window, 'wxt:locationchange', ({newUrl}) => …)` (wxt 0.19.29 verified — RESEARCH Common Op 5) — NEVER bare window.addEventListener (auto-cleans on context invalidation); the callback marks the cache stale / triggers re-extraction when a surface is subscribed (D-4a-01)."
    - "The watcher's event name is NAMESPACED — `${runtime.id}:${entrypoint}:wxt:locationchange` (RESEARCH Pitfall 4) — tests dispatch the SAME namespaced name (FIXED_EXTENSION_ID + entrypoint 'core'), never a plain `new Event('wxt:locationchange')`."
    - "`tests/core/content/AxDomWalker.test.ts` (NEW) proves: password input → emitted control has isPassword:true + NO value key (D-4a-20 invariant at capture); links/tables/interaction flags emitted; geometry never populated; mode-gating lives in the host wiring (04a-07)."
    - "`tests/core/content/SPANavigationWatcher.test.ts` (NEW) proves: dispatching the namespaced event fires the callback with the newUrl; unsubscribed tabs only mark stale (no extraction); the listener is removed on stop()/context invalidation."
  artifacts:
    - "src/core/content/AxDomWalker.ts"
    - "src/core/content/SPANavigationWatcher.ts"
    - "tests/core/content/AxDomWalker.test.ts"
    - "tests/core/content/SPANavigationWatcher.test.ts"
  key_links:
    - "AxDomWalker's RawNode output feeds ApcLiteStrategy (04a-04) via the bridge request/reply (04a-07) — the walker runs content-side against the LIVE DOM (D-4a-13: geometry, if ever read, must be live-DOM — in v0.1 it is not read at all)."
    - "SPANavigationWatcher's onNavigate callback is wired in ContentScriptHost (04a-07) — it rebuilds the live context + marks the panel cache stale via the bridge (D-4a-01 hybrid trigger: subscribed tabs re-extract, unsubscribed mark-stale only)."
    - "Both files are content-side (bundle) — the isolation scan (04a-09) must not see any forbidden token; type-only apcLite.types import keeps the bundle dependency-free."
  flagged_assumptions:
    - "D-4a-20 [locked]: 'enforced at capture in the content-script AxDomWalker via FormControlSchema.refine (Appendix C)' — the walker enforces the invariant BY CONSTRUCTION (password fields never get a value field); FormControlSchema.refine re-validates panel-side (04a-04). The content bundle does NOT import zod runtime — the PATTERNS note (L329) is resolved: type-only imports + plain-object construction keep the bundle under budget; the refine gate lives where zod already exists (panel)."
    - "D-4a-12 [locked]: AxDomWalker runs only when mode 'actionable' is requested — the bridge request payload (04a-07) carries the mode; the walker itself is not invoked on the default path."
    - "CAT-04 [unresolved — spec-less probe, unclassified]: ISOLATED world is already the entrypoint default (core.content.ts L18) — MAIN world is never used in 4a (no domain-specific globals needed; ServiceNow globals are Phase 8). The watcher runs in the ISOLATED world content script."
    - "CAT-02 [unresolved — spec-less probe, unclassified]: the watcher signals invalidation; the actual re-extraction trigger for subscribed tabs is the service-side subscription check (04a-08) — the watcher only observes and reports (extraction-only, R-5)."
  prohibitions:
    - "No UI mount / style injection / host-DOM writes — AxDomWalker READS the DOM only (R-5, §5.6); no MutationObserver polling (wxt:locationchange is event-driven, §5.6 'never polling')."
    - "No geometry read in v0.1 (D-4a-13 — no getBoundingClientRect; forced-layout cost + no consumer)."
    - "No bare `window.addEventListener` in the watcher — ctx.addEventListener only (leak + invalidated-context, RESEARCH Common Op 5)."
    - "No zod runtime import content-side (bundle budget + dependency-free convention) — type-only apcLite.types imports."
    - "No password VALUE capture under any path (D-4a-20) — the walker omits it structurally; a regression test pins the invariant."
---

<!-- 04a-06 (2026-08-12): Wave-3 content-side primitives. AxDomWalker (D-4a-12/13/20 —
     actionable-mode live-DOM walk, password omitted at capture, geometry never read)
     and SPANavigationWatcher (D-4a-01 — wxt:locationchange via ctx.addEventListener,
     namespaced event, invalidation signal). Both live in the content bundle and must
     stay dependency-free (Appendix G). -->

<objective>
Create the two content-side primitives: `AxDomWalker` (the actionable-mode DOM+ARIA walker that emits RawNode trees with interaction flags, omits password values at capture — D-4a-20 — and never reads geometry — D-4a-13) and `SPANavigationWatcher` (the wxt:locationchange SPA-nav detector that signals invalidation per D-4a-01), plus their tests.

Purpose: CAT-02 (SPA-nav detection + bridge delivery) and CAT-03 (passwords never captured — at capture, not redacted later) require these content-side pieces; both must stay dependency-free and tiny to keep the < 50 KB bundle (CAT-05).

Output: two content-side files + two test files.
</objective>

<execution_context>
@/home/yongxin.Li/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/yongxin.Li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/PRODUCT_SPEC_v0_1.md
@.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-RESEARCH.md
@.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-PATTERNS.md
@src/core/content/ContentScriptHost.ts
@src/core/extraction/apcLite.types.ts
@tests/fixtures/index.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: AxDomWalker — actionable walk, password omitted at capture (D-4a-12/13/20)</name>
  <files>src/core/content/AxDomWalker.ts, tests/core/content/AxDomWalker.test.ts</files>
  <read_first>
    - src/core/content/ContentScriptHost.ts L91-102 (content-side DOM read precedent — buildLiveContext)
    - src/core/extraction/apcLite.types.ts (RawNode type-only import target; FormControlSchema is the PANEL-side re-validation gate — NOT imported here)
    - .planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-PATTERNS.md (AxDomWalker section L321-331)
  </read_first>
  <behavior>
    - Test 1 (jsdom): a document with a form containing `<input type="password" value="secret">` and `<input type="text" value="visible">` → the emitted RawNode form.control for the password input has isPassword:true and NO value key; the text input's control HAS its value (D-4a-20 capture-time invariant).
    - Test 2: clickable elements (a[href], button) get interaction.clickable === true; disabled inputs get disabled === true; editable inputs get editable === true.
    - Test 3: NO emitted node has a geometry field (D-4a-13 — never read).
    - Test 4: links/tables are captured (RawNode.link.href, table structure) — D-4a-12 roles + text + hierarchy + links + tables.
  </behavior>
  <action>
    Implement `AxDomWalker` per the must_haves truth: export a `walkAxDom(root: Document | HTMLElement): RawNode[]` (or a small class — signature at executor discretion, keep it dependency-free) that recursively walks the live DOM emitting RawNode objects: role from element semantics/ARIA (heading→heading, link, button, input, table, etc.), text content (clamped to a sane length), interaction flags (clickable for a/button/role=button; editable for input/textarea/contenteditable; focusable; disabled), link {href}, image {alt, src}, form.control {fieldName, fieldType, value?, isPassword} — for password-detected inputs (`type=password` OR `autocomplete` matching current-password/new-password) set isPassword:true and NEVER emit a value (D-4a-20). geometry NOT populated (D-4a-13). Header comment: dependency-free content-side core (Appendix G — no React/antd/zod runtime; type-only RawNode import from '@/core/extraction/apcLite.types').
    Write the test file per the behavior block (default jsdom-align env — document required).
  </action>
  <acceptance_criteria>
    - All four behavior tests pass via `pnpm vitest run tests/core/content/AxDomWalker.test.ts -x`.
    - The password input test asserts `control.isPassword === true` AND `'value' in control === false` (capture-time omission — never captured, not redacted).
    - `grep -c "getBoundingClientRect" src/core/content/AxDomWalker.ts` == 0 (D-4a-13 geometry never read).
    - No zod/defuddle/turndown/minisearch import in the file (grep) — type-only apcLite.types.
  </acceptance_criteria>
  <verify>
    <automated>pnpm vitest run tests/core/content/AxDomWalker.test.ts -x</automated>
  </verify>
  <done>AxDomWalker emits RawNode trees with interaction flags, omits password values at capture, never reads geometry; tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: SPANavigationWatcher — namespaced wxt:locationchange (D-4a-01)</name>
  <files>src/core/content/SPANavigationWatcher.ts, tests/core/content/SPANavigationWatcher.test.ts</files>
  <read_first>
    - .planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-RESEARCH.md (Common Op 5 — ctx.addEventListener + namespaced event name) + Pitfall 4 (namespacing in tests)
    - tests/fixtures/index.ts L17-18 (FIXED_EXTENSION_ID = 'test-extension-id')
    - node_modules/wxt/dist/client/content-scripts/custom-events.mjs (namespacing source: `${runtime.id}:${entrypoint}:wxt:locationchange`)
  </read_first>
  <behavior>
    - Test 1: dispatching `new Event('test-extension-id:core:wxt:locationchange', { detail-ish via the wxt event shape })` on window fires the watcher callback with the new URL (namespaced name — Pitfall 4; never the plain 'wxt:locationchange').
    - Test 2: the watcher's stop() removes the listener — a second dispatch does NOT fire the callback.
    - Test 3: the callback receives `newUrl` (post-navigation URL) — the D-4a-01 signal the host uses to mark-stale/re-extract.
  </behavior>
  <action>
    Implement `SPANavigationWatcher` per the must_haves truth: a class/factory taking the wxt content-script `ctx` (or an addEventListener-compatible window + a namespaced event-name provider) and an `onNavigate(newUrl: string)` callback; registers via `ctx.addEventListener(window, 'wxt:locationchange', handler)` — the wxt-typed event carries {newUrl, oldUrl}; expose `stop()` that removes the listener (or rely on ctx auto-clean — expose both). Document the namespacing (RESEARCH Pitfall 4) in the header: production uses the wxt-provided event; tests dispatch `FIXED_EXTENSION_ID:core:wxt:locationchange`.
    Write the test file per the behavior block: build the namespaced event name from FIXED_EXTENSION_ID + 'core' (the entrypoint name) + dispatch on window (jsdom-align env).
  </action>
  <acceptance_criteria>
    - All three behavior tests pass via `pnpm vitest run tests/core/content/SPANavigationWatcher.test.ts -x`.
    - The test dispatches the NAMESPACED name (`${FIXED_EXTENSION_ID}:core:wxt:locationchange`) — a plain 'wxt:locationchange' event never triggers the watcher (Pitfall 4 pin).
    - stop()/cleanup removes the listener (second dispatch no-ops).
    - No polling/MutationObserver in the source (§5.6 'never polling').
  </acceptance_criteria>
  <verify>
    <automated>pnpm vitest run tests/core/content/SPANavigationWatcher.test.ts -x</automated>
  </verify>
  <done>SPANavigationWatcher fires on the namespaced event with newUrl, cleans up on stop, never polls; tests green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| host-page DOM → AxDomWalker | untrusted live DOM is walked (content-side, read-only) |
| host-page navigation → SPANavigationWatcher | SPA-nav events cross into the content script |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-4a-01 | Information Disclosure | password value capture | critical | mitigate | AxDomWalker omits password values AT CAPTURE (D-4a-20 — isPassword:true, value key never emitted); capture-time invariant test pins it; FormControlSchema.refine re-validates panel-side (04a-04) — never merely redacted later |
| T-4a-16 | Tampering | DOM clobbering via hostile page (walks untrusted DOM) | medium | mitigate | The walker READS only (R-5 extraction-only); it emits plain-data RawNodes validated by the panel zod boundary; no host-DOM writes, no UI mount |
| T-4a-17 | Spoofing | forged wxt:locationchange event (SPA-nav spoof) | low | accept | Event is window-scoped in the ISOLATED world; worst case = a spurious mark-stale + (if subscribed) a re-extraction — no security impact, only cost; accepted per ASVS L1 |
| T-4a-18 | Information Disclosure | geometry read → forced layout + screen-scrape potential | low | mitigate | geometry NEVER read in v0.1 (D-4a-13) — no getBoundingClientRect in the bundle (grep-pinned) |
</threat_model>

<verification>
- `pnpm vitest run tests/core/content -x` — both suites green.
- Password invariant pinned (capture-time omission test).
- Namespaced-event test pins the wxt namespacing (Pitfall 4).
- tsc --noEmit green; no forbidden imports in either content-side file.
</verification>

<success_criteria>
- AxDomWalker captures structure + interaction without password values or geometry (D-4a-12/13/20).
- SPANavigationWatcher detects SPA nav via the namespaced event and signals invalidation (D-4a-01, CAT-02).
- Both files stay dependency-free and bundle-safe (Appendix G).
</success_criteria>

<output>
Create `.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-06-SUMMARY.md` when done.
</output>

## Artifacts this phase produces

- src/core/content/AxDomWalker.ts — `walkAxDom(root)` (RawNode[] emitter; interaction flags; password-value omission; geometry unset)
- src/core/content/SPANavigationWatcher.ts — watcher class/factory (ctx.addEventListener 'wxt:locationchange', onNavigate(newUrl), stop())
- tests/core/content/AxDomWalker.test.ts — 4 tests (password invariant, interaction flags, geometry unset, links/tables)
- tests/core/content/SPANavigationWatcher.test.ts — 3 tests (namespaced dispatch, cleanup, newUrl delivery)
