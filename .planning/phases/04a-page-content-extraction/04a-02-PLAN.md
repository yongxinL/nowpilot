---
phase: 04a-page-content-extraction
plan: 02
type: execute
wave: 2
depends_on: [04a-01]
files_modified:
  - src/core/extraction/strategies/ReadabilityFallback.ts
  - src/core/extraction/strategies/ApcLiteStrategy.ts
  - src/core/extraction/PageContentService.ts
  - tests/core/extraction/strategies/ReadabilityFallback.test.ts
  - tests/core/extraction/ApcLiteStrategy.test.ts
autonomous: true
requirements: [PAGE-01]
must_haves:
  truths:
    - "ReadabilityFallback parses HTML via DOMParser (cloned document to prevent DOM mutation) and returns StrategyResult with textContent when article content >= 500 chars"
    - "DefuddleStrategy low-confidence check (<500 chars of markdown content) in PageContentService.doExtract() triggers automatic fallback to ReadabilityFallback without user intervention"
    - "ApcLiteStrategy walks DOMParser-constructed DOM, builds APCLiteNode tree validated against Zod schemas from apcLite.types.ts, and returns StrategyResult with root APCLiteNode for mode='actionable'"
    - "PageContentService constructor accepts full strategy registry [DefuddleStrategy, ReadabilityFallback, ApcLiteStrategy]; strategy selection by mode: 'default' → Defuddle→Readability fallback chain; 'actionable' → ApcLiteStrategy only"
    - "ExtractionResult.source field records which strategy succeeded ('defuddle' | 'readability' | 'apc-lite'); strategiesAttempted records all tried strategies in order"
    - "PageContext mode='actionable' variant carries apcLiteTree with role, geometry, interaction metadata per Appendix C schema — no automation logic in v0.1, schema is v2-ready"
  artifacts:
    - src/core/extraction/strategies/ReadabilityFallback.ts
    - src/core/extraction/strategies/ApcLiteStrategy.ts
    - tests/core/extraction/strategies/ReadabilityFallback.test.ts
    - tests/core/extraction/ApcLiteStrategy.test.ts
  key_links:
    - "PageContentService.doExtract() → filter strategies by canHandle() → DefuddleStrategy.run() → confidence check (<500 chars) → ReadabilityFallback.run() → StrategyResult.source tracked"
    - "ApcLiteStrategy.run() → DOMParser → DOM+ARIA walk → APCLiteNode tree → Zod validation (APCLiteDocumentSchema.safeParse) before returning StrategyResult"
    - "PageContentService.buildMetadata() maps strategy meta → BaseMetadata optional enrichment fields (author, publishDate, language, description, siteName)"
---

<objective>
Expand the extraction strategy registry from the single DefuddleStrategy tracer to the full layered fallback chain: ReadabilityFallback for degraded-confidence pages and ApcLiteStrategy for mode='actionable' structural extraction. Complete mode-discriminated PageContext output for both 'default' (with fallback provenance) and 'actionable' variants.

Purpose: The tracer proved the single-strategy architecture works. This plan fills in the full strategy surface so extraction handles real-world edge cases (low-quality pages, pages needing structural parse for automation-readiness).

Output: Two new strategy implementations with full test coverage; modified PageContentService with three-strategy registry, mode-based strategy selection, and confidence-driven fallback logic for 'default' mode.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/04a-page-content-extraction/04a-CONTEXT.md (D-07 fallback, D-08 ApcLite, D-12 PageContext mode union)
@.planning/phases/04a-page-content-extraction/04a-RESEARCH.md (lines 386–495: ReadabilityFallback + ApcLite patterns, Pitfall 3: DOM mutation)
@.planning/phases/04a-page-content-extraction/04a-PATTERNS.md (lines 226–243: ReadabilityFallback + ApcLiteStrategy analogs)
@src/core/extraction/types.ts (from Plan 04a-01 — ExtractionResult, PageContext, StrategyInput, StrategyResult)
@src/core/extraction/apcLite.types.ts (from Plan 04a-01 — APCLiteNode, RawNode, APCLiteDocument Zod schemas)
@src/core/extraction/strategies/IExtractionStrategy.ts (from Plan 04a-01)
@src/core/extraction/strategies/DefuddleStrategy.ts (from Plan 04a-01 — reference implementation)
@src/core/extraction/PageContentService.ts (from Plan 04a-01 — doExtract with single strategy; needs expansion)
@src/core/extraction/PageContentSerializer.ts (from Plan 04a-01 — buildPageContext needs mode='actionable' branch)
</context>

<tasks>

<task type="auto">
  <name>Task 1: ReadabilityFallback Strategy — Mozilla Reader View fallback with DOM-clone guard</name>
  <files>
    src/core/extraction/strategies/ReadabilityFallback.ts,
    tests/core/extraction/strategies/ReadabilityFallback.test.ts
  </files>
  <action>
    **Create ReadabilityFallback** in `src/core/extraction/strategies/ReadabilityFallback.ts` (per D-07; analog: `src/core/ai/providers/openai.ts` — class-implements-interface pattern):

    - Import `Readability` from `@mozilla/readability` (extension-page bundle only — NOT in content script)
    - Implement `IExtractionStrategy`
    - `id = 'readability' as const`
    - `static LOW_CONFIDENCE_CHAR_THRESHOLD = 500` (D-07 threshold — tuned for the agent's discretion per CONTEXT.md)
    - `canHandle(input)`: returns `input.mode === 'default'` — only handles default mode
    - `run(input)`:
      - Construct `new DOMParser().parseFromString(input.html!, 'text/html')`
      - **CRITICAL (Pitfall 3):** Clone document before passing to Readability: `const clone = doc.cloneNode(true) as Document; new Readability(clone)` — Readability mutates the DOM in place during scoring; cloning prevents corruption of the original
      - Call `reader.parse()` with `{ charThreshold: ReadabilityFallback.LOW_CONFIDENCE_CHAR_THRESHOLD }` option if supported, or check `article.textContent.length < LOW_CONFIDENCE_CHAR_THRESHOLD` post-parse and throw `'Readability low confidence'` if below threshold
      - Return `StrategyResult`:
        - `source: 'readability'`
        - `markdown: article.textContent` (plain text; markdown conversion not needed — AI context consumes text)
        - `meta`: extract `title`, `byline` (→ author), `excerpt` (→ description), `siteName`, `lang` (→ language), `publishedTime` (→ publishDate) from Readability article object
        - `approxTokens`: estimate from `article.textContent.length`
        - `truncated: false`

    **Write ReadabilityFallback tests** in `tests/core/extraction/strategies/ReadabilityFallback.test.ts` (analog: `tests/core/ai/PlannerService.test.ts` — dynamic import + mock fixture pattern):

    - Test: `canHandle('default')` → true; `canHandle('actionable')` → false
    - Test: fixture HTML with substantial article content → `run()` returns StrategyResult with source='readability', markdown populated, metadata extracted
    - Test: fixture HTML with < 500 chars of content → `run()` throws 'Readability low confidence' (fallback signal)
    - Test: fixture HTML with no article content (Readability returns null) → throws
    - Test: DOM clone verification — check that original document is not mutated after Readability parse (compare `doc.body.children.length` before/after)
    - Test: metadata extraction — verify byline→author, excerpt→description, lang→language, publishedTime→publishDate mapping

    Use `vi.mock('@mozilla/readability')` to stub Readability class. Use jsdom for DOM fixture creation: `new DOMParser().parseFromString(fixtureHtml, 'text/html')`.
  </action>
  <read_first>
    - src/core/extraction/strategies/DefuddleStrategy.ts (reference implementation — class shape, imports pattern)
    - src/core/extraction/types.ts (StrategyResult, StrategyInput shapes)
    - src/core/extraction/strategies/IExtractionStrategy.ts (interface contract)
    - tests/core/ai/PlannerService.test.ts (dynamic import + vi.mock pattern for strategy tests)
    - .planning/phases/04a-page-content-extraction/04a-RESEARCH.md lines 386–428 (Readability pattern example)
  </read_first>
  <verify>
    <automated>pnpm exec vitest run tests/core/extraction/strategies/ReadabilityFallback.test.ts</automated>
  </verify>
  <done>
    ReadabilityFallback implements IExtractionStrategy with id='readability'.
    canHandle('default') returns true; canHandle('actionable') returns false.
    run() clones document before Readability.parse() — original document unchanged.
    Content < 500 chars throws 'Readability low confidence'.
    Metadata mapped: byline→author, excerpt→description, lang→language, publishedTime→publishDate.
    All tests pass with jsdom fixture HTML + vi.mock(@mozilla/readability).
  </done>
</task>

<task type="auto">
  <name>Task 2: ApcLiteStrategy + PageContentService Strategy Registry Expansion</name>
  <files>
    src/core/extraction/strategies/ApcLiteStrategy.ts,
    src/core/extraction/PageContentService.ts,
    src/core/extraction/PageContentSerializer.ts,
    tests/core/extraction/ApcLiteStrategy.test.ts
  </files>
  <action>
    **2a. Create ApcLiteStrategy** in `src/core/extraction/strategies/ApcLiteStrategy.ts` (per D-08; analog: same as DefuddleStrategy):

    - Import Zod schemas from `../apcLite.types`: `APCLiteDocumentSchema`
    - Implement `IExtractionStrategy`
    - `id = 'apc-lite' as const`
    - `canHandle(input)`: returns `input.mode === 'actionable'` — only handles actionable mode
    - `run(input)`:
      - Construct `new DOMParser().parseFromString(input.html!, 'text/html')`
      - Walk DOM tree building `APCLiteNode` objects per Appendix C / `apcLite.types.ts` schemas:
        - For each DOM node with semantic role: create APCLiteNode with `role`, `name`, `id`, `children` (recursive)
        - Extract `geometry` (getBoundingClientRect → `{x, y, width, height}`)
        - Extract `interaction` info (clickable? tabIndex, role-based heuristics)
        - Extract `attributes`: aria-* attributes, data-* attributes, relevant native attributes
      - Wrap in `APCLiteDocument` (root container with url, title, timestamp)
      - Validate output with `APCLiteDocumentSchema.safeParse()` — if validation fails, throw with Zod error details
      - Return `StrategyResult`:
        - `source: 'apc-lite'`
        - `root: validated APCLiteDocument.root` (the top-level APCLiteNode)
        - `meta`: `{ title: input.title }` (minimal — structural parse, not content)
        - `approxTokens`: estimate from node count × avg tokens per node
        - `truncated: false`
      - NOTE: No automation logic in v0.1 — the schema is v2-ready (D-08 deferred idea). The strategy ONLY builds the tree.

    **2b. Expand PageContentService strategy registry** (modify `src/core/extraction/PageContentService.ts`):

    - Update constructor default strategies array from `[new DefuddleStrategy()]` to `[new DefuddleStrategy(), new ReadabilityFallback(), new ApcLiteStrategy()]`
    - In `doExtract()`:
      - Filter applicable strategies: `this.strategies.filter(s => s.canHandle({ url, mode }))`
      - For mode='default': iterate [Defuddle, Readability] — after Defuddle returns, check confidence: `if (mode === 'default' && result.source === 'defuddle' && (result.markdown || '').length < 500)` → continue to fallback
      - For mode='actionable': iterate [ApcLite] only (single strategy, no fallback chain needed)
      - Record `strategiesAttempted` for EACH strategy attempt (including ones that fail) — this is the audit trail
      - On strategy throw/timeout: catch, push strategy ID to strategiesAttempted, `continue` to next

    **2c. Expand PageContentSerializer for mode='actionable'** (modify `src/core/extraction/PageContentSerializer.ts`):

    - Add `mode='actionable'` branch in `buildPageContext()`: when mode is 'actionable', build the `{ mode: 'actionable', apcLiteTree: result.root!, ...metadata }` variant
    - Validate the APCLiteNode tree against Zod schemas before returning (safeParse guard at boundary)

    **Write ApcLiteStrategy tests** in `tests/core/extraction/ApcLiteStrategy.test.ts`:

    - Test: `canHandle('actionable')` → true; `canHandle('default')` → false
    - Test: fixture HTML with buttons, links, inputs → walk DOM → verify APCLiteNode tree has correct roles, geometry (x/y/width/height present), interaction info
    - Test: fixture HTML with nested elements → verify recursive children structure
    - Test: fixture HTML with ARIA attributes → verify `attributes` contains aria-label, aria-expanded, etc.
    - Test: Zod validation — verify `APCLiteDocumentSchema.safeParse(tree)` passes for valid tree, fails for malformed
    - Test: empty document → returns minimal tree (document node only)
    - Test: PageContentService mode='actionable' → extracts via ApcLiteStrategy only, returns PageContext with apcLiteTree

    Use jsdom for fixture creation. No mocks needed for DOMParser (jsdom provides it). Use dynamic `import()` for module under test.
  </action>
  <read_first>
    - src/core/extraction/apcLite.types.ts (from Plan 04a-01 — APCLiteNode, RawNode, APCLiteDocument schemas)
    - src/core/extraction/types.ts (StrategyResult, StrategyInput, PageContext mode union)
    - src/core/extraction/PageContentService.ts (from Plan 04a-01 — doExtract loop; needs strategy list expansion)
    - src/core/extraction/PageContentSerializer.ts (from Plan 04a-01 — buildPageContext; needs actionable branch)
    - .planning/phases/04a-page-content-extraction/04a-RESEARCH.md lines 430–495 (MiniSearch/APC patterns)
    - PRODUCT_SPEC_v0_1.md Appendix C (if accessible — APCLiteNode field definitions)
  </read_first>
  <verify>
    <automated>pnpm exec vitest run tests/core/extraction/ApcLiteStrategy.test.ts tests/core/extraction/strategies/ReadabilityFallback.test.ts</automated>
  </verify>
  <done>
    ApcLiteStrategy implements IExtractionStrategy with id='apc-lite'.
    canHandle('actionable') returns true; canHandle('default') returns false.
    run() walks DOMParser DOM → builds APCLiteNode tree → validates with Zod → returns StrategyResult with root node.
    APCLiteNode tree includes role, geometry (getBoundingClientRect), interaction info, ARIA attributes.
    PageContentService constructor defaults to three-strategy registry: [DefuddleStrategy, ReadabilityFallback, ApcLiteStrategy].
    mode='default': Defuddle runs first → if markdown < 500 chars → ReadabilityFallback runs → source recorded.
    mode='actionable': ApcLiteStrategy runs only.
    strategiesAttempted records ALL attempted strategy IDs including failures.
    PageContentSerializer.buildPageContext() correctly builds mode='actionable' variant.
    All ApcLiteStrategy tests pass.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Untrusted HTML → DOMParser (Readability) | Readability.parse() mutates DOM — document must be cloned first to prevent corruption of the original DOM tree |
| Untrusted HTML → DOMParser (ApcLite) | DOM walk traverses untrusted HTML — malicious pages could craft deeply nested trees; recursion depth should be bounded |
| APCLiteNode tree → Zod validation boundary | Untrusted DOM data enters typed system — Zod schema validation is the trust gate before any consumer reads the tree |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-04a-06 | Tampering | ReadabilityFallback (DOM mutation) | low | mitigate | Document cloned via `doc.cloneNode(true)` before Readability.parse() per Mozilla docs recommendation; tests verify original document unchanged after parse |
| T-04a-07 | Information Disclosure | ReadabilityFallback (article.textContent) | low | accept | Readability extracts textContent only (no HTML markup) — cross-site script content is stripped during text extraction; redactSensitive runs downstream in PageContentService |
| T-04a-08 | Denial of Service | ApcLiteStrategy (deep DOM nesting) | low | mitigate | Impose a sane recursion depth limit (~100 levels) during DOM walk; if exceeded, truncate children array and set `truncated: true` in result; tests verify deep-nesting fixture doesn't OOM |
| T-04a-09 | Tampering | ApcLiteStrategy (Zod validation bypass) | medium | mitigate | APCLiteDocumentSchema.safeParse() validates the entire tree at the strategy boundary; Zod strictObject mode rejects extra fields; malformed trees throw before reaching consumers |

Note: T-04a-01 through T-04a-05 and T-04a-SC are addressed in Plan 04a-01's threat model. This plan's threats are additive to the base extraction pipeline.
</threat_model>

<verification>
- `vitest run tests/core/extraction/strategies/ReadabilityFallback.test.ts tests/core/extraction/ApcLiteStrategy.test.ts` — all pass
- `tsc --noEmit` passes on all modified files
- PageContentService has three strategies in default constructor
- mode='default' fallback chain: Defuddle → Readability
- mode='actionable' path: ApcLite only
</verification>

<success_criteria>
1. ReadabilityFallback clones document before parse; handles < 500 chars as low-confidence throw
2. ApcLiteStrategy builds APCLiteNode tree with role/geometry/interaction/attributes; Zod-validated
3. PageContentService strategy registry expanded to three strategies with mode-based selection
4. Confidence-driven fallback works: Defuddle < 500 chars → Readability runs automatically
5. strategiesAttempted records complete audit trail including failed strategies
6. PageContentSerializer builds mode='actionable' PageContext variant with apcLiteTree
</success_criteria>

<output>
Create `.planning/phases/04a-page-content-extraction/04a-02-SUMMARY.md` when done
</output>
