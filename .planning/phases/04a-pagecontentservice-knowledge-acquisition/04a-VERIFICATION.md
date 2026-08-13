---
phase: 04a-pagecontentservice-knowledge-acquisition
verified: 2026-08-13T07:57:38Z
status: human_needed
score: 5/5 must-haves verified
behavior_unverified: 0 # Count of ⚠️ PRESENT_BEHAVIOR_UNVERIFIED truths (present + wired, behavior not exercised); each is detailed in behavior_unverified_items below
overrides_applied: 0
human_verification:
  - test: "Load a real SPA (e.g. a GitHub repo page or Gmail) in the extension's dev build and trigger an in-app navigation (click a link that does NOT reload the page). Confirm the extracted content in the side panel/standalone reflects the NEW page after navigation (cache invalidation + re-extraction for a subscribed tab)."
    expected: "wxt's location-watcher dispatches the namespaced wxt:locationchange event in a real SPA; the watcher fires, the host rebuilds the live context, and the panel cache is invalidated — a subscribed surface re-extracts the new page."
    why_human: "Automated tests dispatch synthetic namespaced events on jsdom and cover the logic chain (watcher → host → bridge → service invalidation), plus a URL-instance normalization regression test. What no test exercises is wxt's real location-watcher integration in a live browser SPA — a runtime/library-integration fact only a manual wxt dev smoke can prove. The phase's own 04a-10 plan recorded this smoke as 'recommended but non-blocking (verify:e2e-phase-1 pattern)'; listed here for completeness per the phase seal."
---

# Phase 4a: PageContentService (Knowledge Acquisition) Verification Report

**Phase Goal:** "Content extraction is fast, safe, and searchable: (1) layered extraction via defuddle + Readability fallback + APCLite structural path; (2) passwords are never captured (isPassword ⇒ value omitted); (3) content-script bundle stays under 50 KB with no React/AntD/defuddle/yaml and no UI code, extraction non-blocking; (4) SPA navigation and tab updates trigger cache invalidation and re-extraction; (5) extracted content is searchable via ephemeral per-tab MiniSearch index (never persisted)."

**Verified:** 2026-08-13T07:57:38Z
**Status:** human_needed (all 5 roadmap truths behaviorally VERIFIED; 1 non-blocking real-browser smoke recommended by the phase's own 04a-10 plan)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

Must-haves derived from ROADMAP.md Success Criteria (5) — each cross-checked against PLAN frontmatter truths (04a-01..10) and the actual codebase.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | **SC1 — Layered extraction + delivery**: main content extracted via Defuddle primary, Readability fallback, APC-lite structural walk and delivered to side panel/standalone | ✓ VERIFIED | `DefuddleStrategy.ts` (useAsync:false, D-4a-18 thresholds MIN_EXTRACTED_CHARS=500/MIN_CONTENT_DENSITY=0.2, Readability fallback on clone), `ApcLiteStrategy.ts` (APCLiteDocumentSchema.parse boundary), `PageContentService.extractLayered` (O.12 verbatim, canonical code), `ContentScriptHost.serializeForExtraction` + `PageContextBridge.requestExtraction` roundtrip, delivery via `WorkspaceStore.update(draft → currentPageContext)` consumed by existing `WorkspacePageSkeleton.tsx`. Behavioral: DefuddleStrategy/ApcLiteStrategy/PageContentService/ContentScriptHost suites green (61 tests targeted run; 677 full suite via verify:phase-4a). |
| 2 | **SC2 — Passwords never captured**: isPassword ⇒ value omitted | ✓ VERIFIED | `AxDomWalker.resolveFormControl` emits `isPassword:true` and never writes the value key for `type=password`/`autocomplete` credential fields (capture-time omission, not redaction); `FormControlSchema.refine((c) => !(c.isPassword && c.value !== undefined), 'password value must be omitted')` verbatim in `apcLite.types.ts`; re-validated at ApcLiteStrategy boundary. Behavioral: AxDomWalker test asserts `'value' in control === false`; ApcLiteStrategy test asserts password-with-value REJECTED; isolation test asserts `safeParse({isPassword:true, value:'x'}).success === false`. All green. |
| 3 | **SC3 — Bundle < 50 KB, dependency-free, non-blocking**: no React/AntD/defuddle/yaml, no UI code, non-blocking extraction | ✓ VERIFIED | `tests/isolation/no-content-script-ui.test.ts`: FORBIDDEN_TOKENS includes React/antd/defuddle/yaml + turndown/minisearch/readability (Pitfall 6); sourcemap-stripped < 50 KB payload assertion (Pitfall 3) — passed against the real built bundle (`core.js` 227,328 bytes raw → payload well under 51,200); background SW R-3 scan. Non-blocking: `core.content.ts` `runAt: 'document_idle'`, `world: 'ISOLATED'`. Behavioral: isolation suite green in my run + inside verify:phase-4a. |
| 4 | **SC4 — SPA nav + tab updates → invalidation + re-extraction** | ✓ VERIFIED | `SPANavigationWatcher.ts` (ctx.addEventListener, namespaced event, URL-instance normalization), `ContentScriptHost.handleNavigate` (rebuild live context + registry upsert + publish), `PageContentService.invalidate/subscribe` + `chrome.tabs.onUpdated/onRemoved` panel-side wiring (R-3). Behavioral: SPANavigationWatcher tests (namespaced dispatch fires, plain event ignored, stop() cleanup, URL-instance normalization), ContentScriptHost nav test, PageContentService Test 10 wiring test. All green. |
| 5 | **SC5 — Ephemeral per-tab MiniSearch index, never persisted** | ✓ VERIFIED | `PageIndexBuilder.ts`: `chunkMarkdown` (heading boundaries, (preamble), headingPath breadcrumbs, 500-token sub-chunks via INDEX_CHUNK_MAX_TOKENS) + `buildPageIndex` (MiniSearch v7 fields+storeFields). `PageContentService.queryIndex`: lazy memoized build from REDACTED markdown; `PageContentCache` holds indexHandle inside the entry — cache+index evicted together. Never persisted: zero `chrome.storage`/`indexedDB`/`localStorage` imports in cache/index/service (grep-verified). Behavioral: PageIndexBuilder tests (breadcrumbs, sub-chunking, no-heading fallback, search returns matching doc) green. |

**Score:** 5/5 truths verified (0 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `package.json` | deps + verify:phase-4a script | ✓ VERIFIED | defuddle ^0.19.2 (user deviation), readability ^0.5.0, turndown ^7.2.4, minisearch ^7.2.0, @types/turndown ^5.0.6; `verify:phase-4a` = eslint + prettier --check + tsc --noEmit + wxt build + vitest run (`.mjs` retired 04a-09). Full chain runs green. |
| `src/core/error/errorCodes.ts` | `CONTENT_EXTRACT_FAILED` canonical | ✓ VERIFIED | L18; spec C.2 count=3; zero stale `CONTENT_EXTRACT'` refs. |
| `tests/fixtures/pageContent.ts` | D-4a-24 shared golden fixtures | ✓ VERIFIED | 7 builders: article (password fixture), boilerplate, no-heading, large-article, empty-page, secret-page, raw-node. |
| `src/core/extraction/apcLite.types.ts` | Appendix C.1 verbatim + password refine | ✓ VERIFIED | All 8 exports; refine intact (L41); source enum incl. reserved 'servicenow-api'; z.lazy recursion. |
| `src/core/extraction/strategies/IExtractionStrategy.ts` | C.1 + §26.3 contract | ✓ VERIFIED | StrategyInput/StrategyResult/IExtractionStrategy; servicenow-api reserved, not implemented. |
| `src/core/extraction/PageContentSerializer.ts` | single turndown converter | ✓ VERIFIED | TURNDOWN_OPTIONS parity exported + htmlToMarkdown; behavior-pinned test. |
| `src/core/extraction/strategies/DefuddleStrategy.ts` | primary + Readability fallback | ✓ VERIFIED | useAsync:false (A5 ACTIVE), thresholds exported, cloneNode fallback, markdown via htmlToMarkdown. |
| `src/core/extraction/strategies/ApcLiteStrategy.ts` | structural path | ✓ VERIFIED | schema boundary gate, geometry unset, D-4a-21 stats. |
| `src/core/extraction/PageContentCache.ts` | per-tab LRU-20 cache | ✓ VERIFIED | PAGE_CACHE_MAX_TABS=20; pin/in-flight/subscribed protection; indexHandle co-evicted. |
| `src/core/extraction/PageIndexBuilder.ts` | ephemeral MiniSearch | ✓ VERIFIED | INDEX_CHUNK_MAX_TOKENS=500; heading chunking; no persistence imports. |
| `src/core/content/AxDomWalker.ts` | dependency-free DOM walker | ✓ VERIFIED | password omitted at capture; no getBoundingClientRect; type-only RawNode import. |
| `src/core/content/SPANavigationWatcher.ts` | SPA-nav detector | ✓ VERIFIED | ctx.addEventListener; namespaced event seam; stop(); zero imports; no polling. |
| `src/core/runtime/MessageType.ts` | PAGE_CONTENT_EXTRACTED | ✓ VERIFIED | Single canonical 4a addition (Pitfall 5); EXTRACT_PAGE_CONTENT reused. |
| `src/core/content/PageContextBridge.ts` | extraction roundtrip | ✓ VERIFIED | ExtractionPayload {html, baseUrl, truncated}; requestExtraction opId correlation + typed CONTENT_EXTRACT_FAILED timeout; replyExtracted; shape validation. |
| `src/core/content/ContentScriptHost.ts` | serialize + mode reply + watcher wiring | ✓ VERIFIED | PAGE_HTML_MAX_BYTES=2_097_152; clone/strip/stamp/truncate; actionable → RawNode reply; handleNavigate. |
| `src/entrypoints/core.content.ts` | ctx threaded, ISOLATED | ✓ VERIFIED | `matches: ['<all_urls>']`, `runAt: 'document_idle'`, `world: 'ISOLATED'`, ctx → watcherDeps. |
| `src/core/extraction/PageContentService.ts` | orchestrator | ✓ VERIFIED | EXTRACTION_TIMEOUT_MS=5000; extractLayered; coalescing; stale-safe getContent; TraceRedactor before cache/index; currentPageContext delivery; tabs wiring; no ai/ or storage imports. |
| `tests/isolation/no-content-script-ui.test.ts` | isolation gate | ✓ VERIFIED | tokens + sourcemap-stripped < 50 KB + password invariant + background R-3 scan (4 tests, all green on real build). |
| `tests/isolation/check-content-bundle.mjs` | retired | ✓ VERIFIED | Deleted; `grep -rn check-content-bundle package.json` → nothing; all six verify chains end at vitest run. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| PageContentService | PageContextBridge | `requestExtraction(tabId, mode)` returns `ExtractionPayload {html, baseUrl, truncated}` | WIRED | Compiled interface contract both sides (tsc green); roundtrip test green. |
| PageContentService | DefuddleStrategy/ApcLiteStrategy | `extractLayered(input, strategies)` ordered chain | WIRED | Default strategies `[new DefuddleStrategy(), new ApcLiteStrategy()]`; fallback provenance recorded (sourceUsed/fallbacksTried). |
| ContentScriptHost | PageContextBridge | `replyExtracted(id, payload)` mode-discriminated reply | WIRED | default → ExtractionPayload; actionable → RawNode[] (password values omitted). |
| SPANavigationWatcher → host → service | cache invalidation | `handleNavigate` → publishContext → `handleBridgeMessage` → `invalidate` | WIRED | SPA-nav signal chain covered by tests (ContentScriptHost nav test + service wiring test). |
| TraceRedactor | cache/index | `redact()` before cache.set / queryIndex build | WIRED | redaction-before-index confirmed in processPayload; CAT-03 test asserts secret absent. |
| PageContentService | WorkspaceStore | `useWorkspaceStore.getState().update(draft => draft.currentPageContext = ctx)` | WIRED | inert-field draft write; existing WorkspacePageSkeleton renders it (display-only, binary presence). |
| errorCodes.ts | strategies/service/bridge | `ERROR_CODES.CONTENT_EXTRACT_FAILED` canonical code | WIRED | Used in extractLayered throw/debugLog, bridge timeout carrier, isContentExtractFailed guard. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| ContentScriptHost.serializeForExtraction | html | live `document.documentElement` clone + strip set + baseURI stamp | Yes — real DOM serialized | ✓ FLOWING |
| PageContextBridge.requestExtraction | ExtractionPayload | matching PAGE_CONTENT_EXTRACTED reply (opId-correlated, shape-validated) | Yes — real roundtrip | ✓ FLOWING |
| DefuddleStrategy.run | markdown/meta | defuddle parse → htmlToMarkdown (turndown) + estimateTokens | Yes — real fixture-driven output | ✓ FLOWING |
| PageContentService.processPayload | pageContext | bridge payload → extractLayered → redact → cache.set | Yes — secret-shaped fixture absent post-redaction (test-pinned) | ✓ FLOWING |
| PageContentService.queryIndex | indexHandle | lazy buildPageIndex(chunkMarkdown(redacted markdown)) memoized in cache entry | Yes — search returns matching section doc (test-pinned) | ✓ FLOWING |
| WorkspacePageSkeleton | currentPageContext | WorkspaceStore inert-field draft write from service | Yes — binary presence, title rendered | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full phase gate (SC1-5 aggregate) | `pnpm run verify:phase-4a` | exit 0 — eslint, prettier, tsc, wxt build, vitest 78 files / 677 tests | ✓ PASS |
| Extraction + content + isolation suites (61 tests) | `pnpm vitest run tests/core/extraction tests/core/content tests/isolation --bail=1` | 11 files / 61 tests passed | ✓ PASS |
| Bundle < 50 KB + forbidden tokens + password invariant vs real build | isolation suite (included above) | passed — core.js 227,328 B raw, payload stripped < 51,200 B | ✓ PASS |
| useAsync:false privacy guard | grep `new Defuddle(doc, { url: input.url, useAsync: false })` | present (L94) + A5 guard comment | ✓ PASS |
| No persistence imports | grep `chrome.storage|indexedDB|localStorage` in cache/index/service | NONE | ✓ PASS |
| No AI/model feed (D-4a-06 unplugged) | grep `core/ai|ContextOptimizer` in service | only comment references, no import | ✓ PASS |
| No geometry reads | grep `getBoundingClientRect` in AxDomWalker | 0 | ✓ PASS |
| .mjs retirement | `grep -rn check-content-bundle package.json` | nothing | ✓ PASS |

### Probe Execution

No probe scripts were declared by this phase's plans (no `scripts/*/tests/probe-*.sh`); the phase's gate is the `verify:phase-4a` §24 chain, executed above. Step 7c: SKIPPED (no declared probes — verify chain run in its place).

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| CAT-01 | 04a-01,02,03,04,05,07,08,10 | Extract {title,url,text,metadata} via defuddle (readability fallback, turndown APC-lite) | ✓ SATISFIED | Strategy chain + serializer + service proven by tests; REQUIREMENTS.md L71 `[x]` + re-map note. |
| CAT-02 | 04a-06,07,08,10 | SPANavigationWatcher + PageContextBridge deliver page context | ✓ SATISFIED | Watcher + bridge + tabs.onUpdated wiring; REQUIREMENTS.md L72 `[x]`. |
| CAT-03 | 04a-02,04,06,08,09,10 | TraceRedactor applied to DOM-embedded sensitive values | ✓ SATISFIED | Panel-side redaction before index/cache/log + capture-time password omission; REQUIREMENTS.md L73 `[x]`. |
| CAT-04 | 04a-07,09,10 | ISOLATED world default; MAIN only for domain-specific globals | ✓ SATISFIED | ISOLATED entrypoint + isolation scan; REQUIREMENTS.md L74 `[x]`. |
| CAT-05 | 04a-05,08,09,10 | Content bundle < 50 KB; extraction non-blocking | ✓ SATISFIED | Sourcemap-stripped size gate + document_idle + 5 s cap; REQUIREMENTS.md L75 `[x]`. |

No orphaned requirements — all five phase requirement IDs (CAT-01..05) appear in plan frontmatter `requirements:` fields and are cross-referenced in REQUIREMENTS.md (traceability row `Done`, L199).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| (none) | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers in any phase-modified source file | — | — |

The `return null` occurrences in AxDomWalker (L57, L70) and PageContextBridge (L252-269) are legitimate control flow (skip-tag filtering, payload validation), not stubs. `EXTRACTION_FAILED` string appears only in comments documenting that it was never added — no code usage.

### Human Verification Required

1. **Real-browser SPA navigation smoke**
   - **Test:** Load a real SPA (e.g. a GitHub repo page or Gmail) in the extension's dev build and trigger an in-app navigation (a link that does NOT reload the page). Confirm the extracted content in the side panel/standalone reflects the NEW page after navigation.
   - **Expected:** wxt's location-watcher dispatches the namespaced `wxt:locationchange` event in a real SPA; the watcher fires, the host rebuilds the live context, and the panel cache is invalidated — a subscribed surface re-extracts the new page.
   - **Why human:** Automated tests dispatch synthetic namespaced events on jsdom and cover the full logic chain (watcher → host → bridge → service invalidation), plus a URL-instance normalization regression test (04a-07 deviation 1). What no test exercises is wxt's real location-watcher integration in a live browser SPA — a runtime/library-integration fact only a manual `wxt dev` smoke can prove. The phase's own 04a-10 plan recorded this smoke as "recommended but non-blocking (verify:e2e-phase-1 pattern)"; listed here for completeness of the phase seal.

### Gaps Summary

No gaps. All five roadmap success criteria are verified against the codebase with passing behavioral tests, all 19+ artifacts exist, are substantive, and are wired with real data flow, all five CAT requirements are satisfied and sealed in REQUIREMENTS.md, and the full `verify:phase-4a` §24 chain passes green (677 tests). The single human-verification item is the real-browser SPA-nav smoke recommended by the phase's own plan (non-blocking, no automated coverage for wxt's live location-watcher dispatch).

One informational note (not a gap): `.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-PATTERNS.md` is untracked in git — logged in the phase's `deferred-items.md` for a plan-phase cleanup commit; zero code impact.

---

_Verified: 2026-08-13T07:57:38Z_
_Verifier: the agent (gsd-verifier)_
