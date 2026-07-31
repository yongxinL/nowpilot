---
phase: 04a-page-content-extraction
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/core/extraction/types.ts
  - src/core/extraction/apcLite.types.ts
  - src/core/extraction/strategies/IExtractionStrategy.ts
  - src/core/extraction/strategies/DefuddleStrategy.ts
  - src/core/extraction/PageContentService.ts
  - src/core/extraction/PageContentSerializer.ts
  - src/core/extraction/PageContentCache.ts
  - src/core/content/DomSerializer.ts
  - src/core/content/PageContextBridge.ts
  - src/core/runtime/RuntimeEnvelope.ts
  - entrypoints/content.core.ts
  - tests/core/content/DomSerializer.test.ts
  - tests/core/extraction/DefuddleStrategy.test.ts
  - tests/core/extraction/PageContentService.test.ts
  - package.json
autonomous: false
requirements: [PAGE-01]
must_haves:
  truths:
    - "Defuddle extracts a web page's HTML as clean Markdown with metadata (title, author, language, siteName) preserved and returned as a typed PageContext with mode='default' and source='defuddle'"
    - "DomSerializer captures full document.documentElement.outerHTML (size-capped ~2MB) with password field values omitted for input[type=password], [isPassword], and autocomplete=current-password fields"
    - "EXTRACT_PAGE_CONTENT request via RuntimeEnvelope+MessageBus reaches content script, triggers synchronous DOM serialization, and returns SerializedPage via sendResponse"
    - "Content script sends SPA_NAVIGATION events via createEnvelope() instead of raw chrome.runtime.sendMessage; CONTENT_SCRIPT_READY message is removed"
    - "PageContentService.extract(tabId, mode, url) returns ExtractionResult discriminated union: {ok: true, pageContext: PageContext} | {ok: false, error: ExtractionError} — operational failures never throw"
    - "Extraction timeout is a 5s global budget shared across the fallback chain; each strategy executes with remaining budget; exceeding deadline returns TIMEOUT error with strategiesAttempted list"
    - "Duplicate per-tab extractions coalesce into a single in-flight promise (concurrency guard); on cache miss next request triggers lazy re-extraction"
    - "Per-tab PageContentCache (Map<tabId, {url, result, indexedAt}>) returns cached result on URL match; reExtract(tabId) invalidates and forces fresh extraction"
    - "Extracted content is redacted via redactSensitive from src/core/security/redactSensitive.ts before PageContext construction (strips JWT, Bearer tokens, API keys, JSESSIONID, emails)"
    - "SPA_NAVIGATION added to MessageTypeValues in RuntimeEnvelope.ts; content script uses createEnvelope('SPA_NAVIGATION', {url, timestamp}, 'content') for outbound events"
  artifacts:
    - src/core/extraction/types.ts
    - src/core/extraction/apcLite.types.ts
    - src/core/extraction/strategies/IExtractionStrategy.ts
    - src/core/extraction/strategies/DefuddleStrategy.ts
    - src/core/extraction/PageContentService.ts
    - src/core/extraction/PageContentSerializer.ts
    - src/core/extraction/PageContentCache.ts
    - src/core/content/DomSerializer.ts
    - src/core/content/PageContextBridge.ts
    - entrypoints/content.core.ts (modified)
    - src/core/runtime/RuntimeEnvelope.ts (modified — SPA_NAVIGATION)
  key_links:
    - "content script → chrome.runtime.onMessage → MessageBus.dispatch → EXTRACT_PAGE_CONTENT handler → DomSerializer.serializePage(document) → sendResponse → PageContentService"
    - "PageContentService.extract() → PageContext → ContextOptimizerInput.pageContext (sourceId: context.page.current)"
    - "DefuddleStrategy.run(input) → DOMParser().parseFromString(input.html) → new Defuddle(doc).parse() → StrategyResult with markdown+metadata"
    - "redactSensitive called before PageContext construction; DomSerializer redacts password values at capture time before transmission"
  prohibitions:
    - flag: "unverified"
      statement: "Content script MUST NOT render any UI elements on host pages — no Shadow DOM roots, no CSS injection, no <style> tags, no host-page DOM mutation beyond non-visible read operations (e.g., cloning into memory); extraction-only per PRODUCT_SPEC §5.6"
      source: "specless-probe-fallback (planner adversarial scan)"
    - flag: "unverified"
      statement: "Page extraction MUST NOT happen without explicit user intent — no background polling of page content; extraction is on-demand via EXTRACT_PAGE_CONTENT request/response from an extension page context only; SPA_NAVIGATION sends URL only, not content"
      source: "specless-probe-fallback (planner adversarial scan)"
  flagged_assumptions:
    - flag: "unresolved (from UI-SPEC edge coverage E1)"
      statement: "The content script bundle negative contract (no rendering, no Shadow DOM, no CSS injection, no host-page write-back, <50KB, no React/AntD/defuddle/yaml/FS Access) is enforced via isolation tests and build assertions — the bundle-isolation contract is assumed trusted once tests pass; a runtime violator detection mechanism does not exist in v0.1"
      source: "04a-UI-SPEC.md §UI Considerations (E1 — unclassified/unresolved)"

assumption_delta_decision:
  noun: "IExtractionStrategy (generalized extraction strategy interface)"
  decision: "promote"
  rationale: "Phase 4a introduces a second strategy (Readability fallback) where previously only Defuddle existed implicitly. The IExtractionStrategy interface is promoted to the primary abstraction, with DefuddleStrategy and ReadabilityFallback as two implementations. PageContentService operates on a list of strategies, not a hardcoded single path. The source field in PageContext records which strategy was used. This prevents the 'add-alongside' anti-pattern where Defuddle remains the hardcoded primary with Readability bolted on — future strategies (ApcLiteStrategy, Phase 8 ServiceNow table-API) are first-class citizens from the start."
---

<objective>
End-to-end extraction tracer — prove the full layered architecture from content script HTML capture through Defuddle parsing and typed PageContext output, with all cross-context messaging, cache, timeout, redaction, and concurrency contracts in place.

Purpose: Wire the thinnest complete path that touches every layer this phase will modify (content script → MessageBus → extraction service → strategy → serialized output → ContextOptimizer feed) as a production-quality tracer. This one path proves the architecture works before any expansion.

Output: Working end-to-end extraction for mode='default' via DefuddleStrategy; content script fully migrated to RuntimeEnvelope+MessageBus; PageContentService with full extract/reExtract/cache/timeout/concurrency/redaction pipeline; tracer integration test passing.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md (Phase 4a section)
@.planning/REQUIREMENTS.md (PAGE-01)
@.planning/phases/04a-page-content-extraction/04a-CONTEXT.md (D-01 through D-20)
@.planning/phases/04a-page-content-extraction/04a-RESEARCH.md (architecture patterns, code examples)
@.planning/phases/04a-page-content-extraction/04a-PATTERNS.md (analog files)
@.planning/phases/04a-page-content-extraction/04a-UI-SPEC.md (§5.6 negative contracts, data-shape states)
@src/core/runtime/RuntimeEnvelope.ts (MessageTypeValues, createEnvelope, isEnvelope)
@src/core/messaging/MessageBus.ts (register, init, dispatch)
@src/core/security/redactSensitive.ts (redactSensitive function)
@src/core/context/ContextOptimizer.ts (buildPageContextSection — existing integration point)
@entrypoints/content.core.ts (current state — raw sendMessage, needs migration)
@tests/isolation/cross-entrypoint-imports.test.ts (pattern for isolation tests)
</context>

<tasks>

<task type="checkpoint:decision" gate="blocking">
  <decision>Confirm one-way extraction architecture decisions before implementation</decision>
  <context>
    Phase 4a implements three one-way architectural decisions that all downstream consumers (ContextOptimizer, Phase 8 MCP tools, Phase 6 diagnostics) will depend on:

    1. **ExtractionResult discriminated union** (D-11): `{ok: true, pageContext: PageContext} | {ok: false, error: ExtractionError}` — operational failures return typed error results instead of throwing. This becomes the API contract for every consumer.

    2. **PageContext mode-discriminated union** (D-12): `{mode: 'default', markdown: string} | {mode: 'actionable', apcLiteTree: APCLiteNode}` — type narrowing forces every consumer to handle both modes explicitly.

    3. **Password redaction privacy contract** (D-02): DomSerializer must omit `value` for `input[type=password]`, `[isPassword]`, `autocomplete=current-password`, and `name` patterns at capture time — redaction correctness is a security boundary with no recovery if violated.
  </context>
  <options>
    <option id="proceed">
      <name>Proceed with locked decisions</name>
      <pros>All decisions were ratified in CONTEXT.md; implementations follow spec §26 exactly; all downstream contracts are well-defined</pros>
      <cons>None visible — decisions are well-documented and cross-referenced</cons>
    </option>
    <option id="revise">
      <name>Revise one or more decisions</name>
      <pros>Can adjust based on implementation discoveries</pros>
      <cons>Would require re-run of /gsd-discuss-phase to update CONTEXT.md; blocks all dependent plans</cons>
    </option>
  </options>
  <resume-signal>Type "proceed" to continue, or describe which decision to revise and why</resume-signal>
</task>

<task type="tracer">
  <name>Tracer: Dependencies → Types → DomSerializer → Content Script → DefuddleStrategy → PageContentService → End-to-End Test</name>
  <files>
    package.json (deps),
    src/core/runtime/RuntimeEnvelope.ts (add SPA_NAVIGATION),
    src/core/extraction/types.ts,
    src/core/extraction/apcLite.types.ts,
    src/core/extraction/strategies/IExtractionStrategy.ts,
    src/core/extraction/strategies/DefuddleStrategy.ts,
    src/core/extraction/PageContentService.ts,
    src/core/extraction/PageContentSerializer.ts,
    src/core/extraction/PageContentCache.ts,
    src/core/content/DomSerializer.ts,
    src/core/content/PageContextBridge.ts,
    entrypoints/content.core.ts
  </files>
  <action>
    **0. Install npm dependencies** (per RESEARCH.md Standard Stack): `npm install defuddle@0.19.2 @mozilla/readability@0.6.0 minisearch@7.2.0`. All packages are verified legitimate (no postinstall, no [SLOP]/[SUS]). These live in extension-page bundles only (side panel / full app) — never in the content script.

    **1. Add SPA_NAVIGATION to MessageTypeValues** in `src/core/runtime/RuntimeEnvelope.ts`:
    - Add `'SPA_NAVIGATION'` to the `MessageTypeValues` const array (between existing entries, keep alphabetical). This enables `createEnvelope('SPA_NAVIGATION', ...)` with full type safety. No other RuntimeEnvelope changes needed.

    **2. Create all core types** in `src/core/extraction/types.ts` (per D-11, D-12; analog: `src/core/ai/types.ts` patterns):
    - `ExtractionError` interface: `{ code: 'NO_CONTENT' | 'TIMEOUT' | 'PARSE_ERROR' | 'CAPTURE_FAILED'; message: string; strategiesAttempted: string[] }`
    - `ExtractionResult` discriminated union: `{ ok: true; pageContext: PageContext } | { ok: false; error: ExtractionError }`
    - `BaseMetadata`: `{ url: string; title: string; capturedAt: number; size: number; source: 'defuddle' | 'readability' | 'apc-lite'; extractionLevel: 'full' | 'truncated'; truncated: boolean; compressionApplied?: 'topk'; author?: string; publishDate?: string; language?: string; description?: string; siteName?: string }`
    - `PageContext` as discriminated union keyed on `mode`: `({ mode: 'default'; markdown: string } & BaseMetadata) | ({ mode: 'actionable'; apcLiteTree: APCLiteNode } & BaseMetadata)`. Import `APCLiteNode` from `./apcLite.types`.
    - `StrategyInput`: `{ url: string; title: string; mode: 'default' | 'actionable'; html?: string; raw?: RawNode }`
    - `StrategyResult`: `{ source: StrategyResult['source']; markdown?: string; root?: APCLiteNode; meta?: Record<string, string>; approxTokens: number; truncated: boolean }`
    - `ExtractionMode`: `'default' | 'actionable'` (exported convenience type)

    **3. Create APCLiteNode Zod schemas** in `src/core/extraction/apcLite.types.ts` (per D-08, RESEARCH.md Appendix C; analog: `src/core/ai/PlannerService.ts` Zod patterns):
    - `RawNodeSchema` (Zod): base node with `role`, `name`, `id`, `children`, `attributes` record, `geometry` (optional `{x,y,width,height}`), `interaction` optional
    - `APCLiteNodeSchema` extends RawNode with semantic enrichment fields
    - `APCLiteDocumentSchema`: root document container
    - Export inferred TypeScript types: `RawNode`, `APCLiteNode`, `APCLiteDocument`
    - Use `z.strictObject()` for all schemas (per established Zod pattern in PlannerService)

    **4. Create IExtractionStrategy interface** in `src/core/extraction/strategies/IExtractionStrategy.ts` (per D-09; analog: `src/core/ai/providers/ProviderAdapter.ts`):
    - `id: 'defuddle' | 'readability' | 'apc-lite'` (readonly discriminator)
    - `canHandle(input: { url: string; mode: ExtractionMode }): boolean`
    - `run(input: StrategyInput): Promise<StrategyResult>`

    **5. Create DomSerializer** in `src/core/content/DomSerializer.ts` (per D-01, D-02; analog: `src/core/security/redactSensitive.ts` — pure utility pattern):
    - `SIZE_CAP = 2 * 1024 * 1024` (~2MB)
    - `PASSWORD_INPUT_SELECTOR = 'input[type="password"], [isPassword], input[autocomplete="current-password"]'`
    - `PASSWORD_NAME_PATTERN = /^(?:.*pass(?:word|wd)?.*|.*pwd.*)$/i`
    - Export `serializePage(doc: Document): SerializedPage` — pure function:
      - QuerySelectorAll password fields → set `field.value = ''` (D-02: never transmit)
      - Additionally check all `input` elements by name pattern
      - Capture `doc.documentElement.outerHTML`
      - If HTML length > SIZE_CAP: slice to SIZE_CAP, set `truncated: true`
      - Return `{ html, url: doc.URL, title: doc.title, capturedAt: Date.now(), size: html.length, truncated }`
    - Export `SerializedPage` interface: `{ html: string; url: string; title: string; capturedAt: number; size: number; truncated: boolean }`
    - NEVER import React, AntD, defuddle, yaml, or File System Access APIs (D-20)

    **6. Migrate content.core.ts** (modify `entrypoints/content.core.ts`; based on RESEARCH.md code example):
    - Import `createEnvelope` from `@/core/runtime/RuntimeEnvelope`
    - Import `register`, `init` from `@/core/messaging/MessageBus`
    - Import `serializePage` from `@/core/content/DomSerializer`
    - In `main()`: call `init()` before `register()`
    - Register `EXTRACT_PAGE_CONTENT` handler: `register('EXTRACT_PAGE_CONTENT', (_envelope, _sender) => serializePage(document))` — synchronous return goes to `sendResponse` via MessageBus.init() (D-04)
    - Replace raw `chrome.runtime.sendMessage({ type: 'SPA_NAVIGATION', ... })` with `createEnvelope('SPA_NAVIGATION', { url: location.href, timestamp: Date.now() }, 'content')` in both MutationObserver and `wxt:locationchange` handler (D-03)
    - Remove `CONTENT_SCRIPT_READY` sendMessage block entirely (D-03)
    - Remove `onLocationChange` standalone function — inline into `wxt:locationchange` listener for DRY
    - Keep MutationObserver + `wxt:locationchange` detection logic; keep `observer.disconnect()` in cleanup

    **7. Create DefuddleStrategy** in `src/core/extraction/strategies/DefuddleStrategy.ts` (per D-07; analog: `src/core/ai/providers/openai.ts` — strategy implementation pattern):
    - Implement `IExtractionStrategy`
    - `id = 'defuddle' as const`
    - `canHandle()`: returns `input.mode === 'default'`
    - `run(input)`: constructs `new DOMParser().parseFromString(input.html!, 'text/html')` (per D-05 — parsing in extension page context, NOT content script), creates `new Defuddle(doc)`, calls `.parse()` with `{ markdown: true }` option, returns `StrategyResult` with source='defuddle', markdown, metadata (author, description, language, siteName from defuddle), and approxTokens estimate
    - Confidence check: NOT in the strategy itself — the orchestrator (PageContentService) checks `content.length < 500` to decide fallback (D-07 places confidence check at orchestrator level)

    **8. Create PageContentCache** in `src/core/extraction/PageContentCache.ts` (per D-17; analog: `src/core/context/PromptCacheManager.ts` — Map-based cache pattern):
    - Internal `Map<number, { url: string; result: ExtractionResult; indexedAt: number }>` keyed by `tabId`
    - `get(tabId: number, url: string): ExtractionResult | null` — returns cached result if URL matches, null otherwise (cache miss triggers lazy re-extraction)
    - `set(tabId: number, url: string, result: ExtractionResult): void` — updates cache entry
    - `invalidate(tabId: number): void` — deletes entry; used by reExtract and SPA_NAVIGATION handler
    - Export as `PageContentCache` class + module-level singleton: `export const pageContentCache = new PageContentCache()`

    **9. Create PageContentService** in `src/core/extraction/PageContentService.ts` (per D-07/D-10/D-11/D-13/D-16/D-18; analog: `src/core/context/ContextOptimizer.ts` — orchestrator pattern):
    - `GLOBAL_TIMEOUT_MS = 5000` (D-10)
    - Constructor accepts `strategies: IExtractionStrategy[]` (default: `[new DefuddleStrategy()]` — only ONE strategy for the tracer; other strategies added in later plans)
    - Internal `inFlight: Map<string, Promise<ExtractionResult>>` for concurrency coalescing (D-18)
    - Internal `pageContentCache` instance (from PageContentCache singleton)
    - `extract(tabId: number, mode: ExtractionMode, url: string): Promise<ExtractionResult>`:
      - Check cache: `pageContentCache.get(tabId, url)` — return if hit
      - Coalesce: check `inFlight` for key `${tabId}:${url}:${mode}`, return existing promise if found
      - Call `doExtract(tabId, mode, url)`, store in inFlight, cache result on success, cleanup inFlight in finally
    - `reExtract(tabId: number): void` (D-13): calls `pageContentCache.invalidate(tabId)` — explicit invalidation API
    - `doExtract()` private method:
      - Request HTML from content script via MessageBus+chrome.tabs.sendMessage (EXTRACT_PAGE_CONTENT envelope → SerializedPage)
      - Filter applicable strategies (mode check)
      - Timeout budget loop (D-10): `deadline = Date.now() + 5000`; for each strategy, `remaining = deadline - Date.now()`, `Promise.race([strategy.run(), timeout])`
      - Confidence check for 'default' mode after Defuddle: if content < 500 chars → continue to next strategy (fallback — only runs if multiple strategies registered, which happens in Plan 04a-02)
      - On success: call `redactSensitive()` on markdown (D-19), build `PageContext` via `PageContentSerializer`, return `{ ok: true, pageContext }`
      - On all failures: return `{ ok: false, error: { code: 'NO_CONTENT'|'TIMEOUT'|..., message, strategiesAttempted } }`
    - `requestContentFromTab()` private method: sends EXTRACT_PAGE_CONTENT via `chrome.tabs.sendMessage(tabId, createEnvelope('EXTRACT_PAGE_CONTENT', {}, 'sidepanel'))` — content script handler returns SerializedPage via sendResponse (D-04)
    - Export as class + module-level singleton: `export const pageContentService = new PageContentService()`

    **10. Create PageContentSerializer** in `src/core/extraction/PageContentSerializer.ts` (per D-12; analog: Pattern 1 from RESEARCH.md):
    - `buildMetadata(serialized, result): BaseMetadata` — populates url, title, capturedAt, size, source, extractionLevel, truncated, and optional enrichments
    - `buildPageContext(mode, serialized, result): PageContext` — dispatches on mode to build correct union variant
    - Validate against Zod schemas at boundary (src/core/ai/PlannerService.ts pattern)

    **11. Create PageContextBridge** in `src/core/content/PageContextBridge.ts` (per D-06; analog: MessageBus registration pattern):
    - Thin glue layer — exports nothing by default (side-effect module)
    - Registers `EXTRACT_PAGE_CONTENT` handler via `MessageBus.register()` that calls `DomSerializer.serializePage(document)` synchronously
    - This is the content-script-side handler; the extension-page-side consumer calls `chrome.tabs.sendMessage()` to trigger it
    - NOTE: The actual handler registration happens in `entrypoints/content.core.ts` main() — PageContextBridge.ts provides the typed handler function that content.core.ts imports and registers. This keeps the content script DRY and testable.

    **12. Run tracer verification:**
    - Write/run `tests/core/extraction/DefuddleStrategy.test.ts`: jsdom fixture HTML → strategy → verify markdown output, metadata extraction, approxTokens
    - Write/run `tests/core/content/DomSerializer.test.ts`: jsdom fixture with password fields → verify type=password value omitted, isPassword omitted, autocomplete=current-password omitted, name-pattern heuristic, size cap, truncated flag
    - Write/run `tests/core/extraction/PageContentService.test.ts`: mock MessageBus to return fixture SerializedPage → call extract() → verify PageContext shape, cache hit (second call returns cached), reExtract invalidates cache, concurrency coalescing (two concurrent calls → one extraction), timeout enforcement
    - End-to-end tracer test: simulate full pipeline from fixture HTML → DomSerializer → DefuddleStrategy → PageContentSerializer → PageContext with mode='default', verify sourceId contract shape for ContextOptimizer
  </action>
  <read_first>
    - src/core/runtime/RuntimeEnvelope.ts — MessageTypeValues array, createEnvelope signature
    - src/core/messaging/MessageBus.ts — register signature (handler receives envelope+sender), init() sets up chrome.runtime.onMessage listener with sendResponse wrapping
    - src/core/ai/types.ts — discriminated union pattern for PlannerDecision, interface pattern for PipelineError
    - src/core/ai/providers/ProviderAdapter.ts — ProviderAdapter interface pattern (readonly id, canHandle-style predicates)
    - src/core/context/ContextOptimizer.ts — buildPageContextSection (existing integration point: sourceId 'context.page.current')
    - src/core/security/redactSensitive.ts — function signature and pattern constants
    - entrypoints/content.core.ts — current WXT defineContentScript shell, MutationObserver+locationchange pattern to extend
    - .planning/phases/04a-page-content-extraction/04a-RESEARCH.md lines 575–834 — DomSerializer, PageContentService, content script code examples
    - .planning/phases/04a-page-content-extraction/04a-PATTERNS.md lines 44–423 — all pattern assignments for types, strategies, service, cache, serializer
  </read_first>
  <verify>
    <automated>pnpm exec vitest run tests/core/extraction/DefuddleStrategy.test.ts tests/core/content/DomSerializer.test.ts tests/core/extraction/PageContentService.test.ts</automated>
  </verify>
  <done>
    `npm install` installs defuddle@0.19.2, @mozilla/readability@0.6.0, minisearch@7.2.0 into package.json.
    `SPA_NAVIGATION` appears in RuntimeEnvelope.ts MessageTypeValues.
    All type files exist and compile (`tsc --noEmit` passes on src/core/extraction/ and src/core/content/).
    DomSerializer redacts password values for all three selector patterns + name heuristic; size cap enforced at ~2MB.
    Content script main() calls MessageBus.init() → registers EXTRACT_PAGE_CONTENT handler → sends SPA_NAVIGATION via createEnvelope; CONTENT_SCRIPT_READY removed.
    DefuddleStrategy.canHandle('default') returns true; .run() returns StrategyResult with markdown and metadata from a fixture HTML document.
    PageContentService.extract() returns ExtractionResult with ok:true and PageContext.mode='default' from a mocked content script response.
    Cache: second extract() call with same tabId+url returns cached result (verified via test: no second MessageBus send).
    reExtract() invalidates cache; next extract() triggers fresh extraction.
    Concurrency: two concurrent extract() calls coalesce into one extraction (verified via spy on doExtract call count).
    Timeout: 5s global budget enforced; Promise.race with remaining budget per strategy.
    redactSensitive called on extracted markdown before PageContext construction.
    Tracer integration test: complete pipeline from fixture HTML → PageContext → expected shape matches ContextOptimizer.buildPageContextSection expectations.
  </done>
</task>

<task type="auto">
  <name>Task: Extraction Pipeline Hardening — full cache/SPA-nav invalidation + reExtract + PageContentService integration test coverage</name>
  <files>
    src/core/extraction/PageContentService.ts,
    src/core/extraction/PageContentCache.ts,
    tests/core/extraction/PageContentService.test.ts
  </files>
  <action>
    Hardens the PageContentService pipeline created in the tracer task with full test coverage for all operational modes:

    **1. SPA_NAVIGATION invalidation wiring:**
    - In PageContentService constructor or init(), register a MessageBus handler for `SPA_NAVIGATION` events that calls `pageContentCache.invalidate(tabId)` when the URL changes.
    - Extract `tabId` from the sender info in the MessageBus handler (the event comes from content script; need to identify which tabId it maps to). Use the `sender.tab?.id` from chrome.runtime.onMessage callback.
    - On `tabs.onUpdated` (status === 'complete' + URL change): also invalidate cache for that tabId. Register this listener in the extension page context where PageContentService is used (the side panel / full app) — NOT in the service worker. Use `chrome.tabs.onUpdated.addListener` in the initialization of the side panel/app entry point, delegating to `pageContentService.reExtract(tabId)`.

    **2. Error code propagation tests:**
    - Test `CAPTURE_FAILED`: mock MessageBus to return error → verify ExtractionResult { ok: false, error: { code: 'CAPTURE_FAILED', strategiesAttempted: [] } }
    - Test `TIMEOUT`: use vi.useFakeTimers() + advance time past 5s → verify timeout error with strategiesAttempted populated
    - Test `NO_CONTENT`: all strategies fail/return empty → verify error with all strategy IDs in strategiesAttempted
    - Test `PARSE_ERROR`: strategy throws during run → verify fallback chain continues, error captured

    **3. Cache invalidation tests:**
    - Test: extract succeeds → cache populated → send SPA_NAVIGATION with different URL → next extract triggers fresh extraction (cache miss)
    - Test: extract succeeds → send SPA_NAVIGATION with same URL → next extract returns cached (no re-extraction)
    - Test: tabs.onUpdated fires with new URL → cache invalidated for that tabId
    - Test: reExtract(tabId) → cache deleted → next extract is fresh

    **4. Redaction integration test:**
    - Test fixture HTML contains inline script with `api_key=sk-abc123` and `Bearer eyJ...` → after extraction, redactSensitive is called → verify markdown does NOT contain the secrets, DOES contain `***REDACTED***` placeholders

    **5. ContextOptimizer Integration verification:**
    - Verify that PageContext serialized via JSON.stringify produces the shape expected by `buildPageContextSection` in ContextOptimizer: contains `sourceId`-compatible fields (url, title, capturedAt, size, source, mode, markdown)
    - Never call ContextOptimizer directly — just verify the data shape contract
  </action>
  <read_first>
    - src/core/extraction/PageContentService.ts (from tracer task) — existing extract/reExtract/doExtract methods
    - src/core/extraction/PageContentCache.ts (from tracer task) — invalidate method signature
    - src/core/context/ContextOptimizer.ts lines 255–264 — buildPageContextSection (sourceId 'context.page.current')
  </read_first>
  <verify>
    <automated>pnpm exec vitest run tests/core/extraction/PageContentService.test.ts</automated>
  </verify>
  <done>
    SPA_NAVIGATION MessageBus handler in PageContentService calls cache.invalidate on URL change.
    tabs.onUpdated listener invalidates cache on tab navigation.
    All error codes (CAPTURE_FAILED, TIMEOUT, NO_CONTENT, PARSE_ERROR) tested with correct strategiesAttempted lists.
    Cache miss after SPA_NAVIGATION → fresh extraction triggered.
    reExtract(tabId) invalidates and forces fresh extraction.
    redactSensitive called on markdown before PageContext construction; secrets stripped.
    PageContext shapes verified compatible with ContextOptimizer.buildPageContextSection expectations.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Untrusted web page HTML → content script (DomSerializer) | HTML from arbitrary web pages enters the content script; password fields must be redacted before any transmission |
| Content script → Extension Page (MessageBus) | Serialized HTML crosses the chrome.runtime messaging boundary — validated via RuntimeEnvelope isEnvelope() |
| Extension Page → DOMParser → Defuddle | HTML string parsed in extension page context; DOMParser provides browser-native sandboxing |
| Extracted text → ContextOptimizer / AI context | Redacted text enters the AI pipeline via pageContext field; must be free of secrets |
| Extracted text → MiniSearch (ephemeral in-memory) | In-memory index never persisted; destroyed on tab close — no IndexedDB/chrome.storage writes |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-04a-01 | Tampering | MessageBus (cross-context messaging) | medium | mitigate | RuntimeEnvelope.isEnvelope() validates message shape; extraneous fields ignored; MessageBus.init() wraps dispatch in try/catch with structured error sendResponse |
| T-04a-02 | Information Disclosure | DomSerializer (password field capture) | high | mitigate | DomSerializer.serializePage() redacts `value` for `input[type=password]`, `[isPassword]`, `autocomplete=current-password`, AND name-pattern heuristics BEFORE serialization; tests verify all three selector patterns + name-pattern coverage |
| T-04a-03 | Information Disclosure | PageContentService (secret leakage to AI context) | medium | mitigate | redactSensitive() from src/core/security/redactSensitive.ts called on all extracted markdown before PageContext construction; strips JWT, Bearer, API keys, JSESSIONID, sysparm_ck; tests verify secrets absent from output |
| T-04a-04 | Information Disclosure | PageContentService (index persistence) | medium | mitigate | PageIndexBuilder uses in-memory MiniSearch only; never writes to IndexedDB or chrome.storage; destroyed on tab close; per D-14/D-19 contract |
| T-04a-05 | Denial of Service | DomSerializer (large HTML payload) | low | mitigate | ~2MB size cap on serialized HTML (D-01); PageContentService enforces 5s global timeout per extraction (D-10); concurrency guard coalesces duplicate extractions (D-18); `Promise.race` with per-strategy remaining budget |
| T-04a-SC | Tampering | npm install (defuddle, readability, minisearch) | low | accept | All three packages verified legitimate per RESEARCH.md Package Legitimacy Audit: established age (1.5–7 yrs), MIT/Apache-2.0, zero postinstall scripts, no [SLOP]/[SUS] verdicts; installed only in extension-page bundles (not content script) |
</threat_model>

<verification>
Phase-level checks for this plan:
- `tsc --noEmit` passes on all new/modified source files
- `vitest run tests/core/extraction/DefuddleStrategy.test.ts tests/core/content/DomSerializer.test.ts tests/core/extraction/PageContentService.test.ts` — all pass
- Content script builds without React, AntD, defuddle, yaml, or FS Access imports (manual check: grep the built content bundle)
</verification>

<success_criteria>
1. `npm install` completes successfully with all three packages
2. `SPA_NAVIGATION` is a valid MessageType in RuntimeEnvelope
3. Content script responds to EXTRACT_PAGE_CONTENT with SerializedPage; sends SPA_NAVIGATION via createEnvelope; no CONTENT_SCRIPT_READY
4. DomSerializer redacts password values for all selectors + name heuristic; size cap enforced
5. DefuddleStrategy produces markdown + metadata from HTML fixture
6. PageContentService.extract() returns ExtractionResult { ok: true, pageContext } from mocked content script
7. Cache hit returns cached result; reExtract invalidates; concurrency coalesces
8. 5s global timeout enforced; error codes propagated correctly
9. redactSensitive strips secrets from extracted markdown
10. PageContext shape compatible with ContextOptimizer.buildPageContextSection contract
</success_criteria>

<output>
Create `.planning/phases/04a-page-content-extraction/04a-01-SUMMARY.md` when done
</output>
