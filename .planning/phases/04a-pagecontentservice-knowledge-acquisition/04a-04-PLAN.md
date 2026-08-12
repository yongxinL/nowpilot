---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 04
type: execute
wave: 3
depends_on: ["04a-01", "04a-03"]
files_modified:
  - src/core/extraction/strategies/DefuddleStrategy.ts
  - src/core/extraction/strategies/ApcLiteStrategy.ts
  - tests/core/extraction/DefuddleStrategy.test.ts
  - tests/core/extraction/ApcLiteStrategy.test.ts
autonomous: true
requirements: [CAT-01, CAT-03]
must_haves:
  truths:
    - "`src/core/extraction/strategies/DefuddleStrategy.ts` (NEW) implements IExtractionStrategy with `id = 'defuddle'`, `canHandle` returning true only for `mode === 'default'` (D-4a-14 mode gating), and `run()` that: parses the serialized HTML in a detached DOMParser doc, stamps the base-URL (`<base href>` prepended to head — D-4a-08 closes the relative-link/image gap), runs `new Defuddle(doc, { url: input.url }).parse()`, evaluates the D-4a-18 fallback threshold (min extracted-text char floor + content/boilerplate density ratio, exported constants MIN_EXTRACTED_CHARS / MIN_CONTENT_DENSITY), falls back to `new Readability(document.cloneNode(true), { charThreshold: 500 }).parse()` on a FRESH CLONE (Pitfall 2 — parse() mutates), and returns a StrategyResult with `source: 'defuddle' | 'readability'` (source union already permits it — PATTERNS L162), `markdown` via PageContentSerializer.htmlToMarkdown (RESEARCH Pitfall 1 — defuddle's markdown option is a no-op), `approxTokens` via estimateTokens, and `meta` carrying defuddleHtml/title/wordCount."
    - "`src/core/extraction/strategies/ApcLiteStrategy.ts` (NEW) implements IExtractionStrategy with `id = 'apc-lite'`, `canHandle` true only for `mode === 'actionable'` (D-4a-14), and `run()` that validates the RawNode input against APCLiteDocumentSchema (zod boundary gate, GR-4), normalizes RawNode → APCLiteNode (geometry stays UNSET — D-4a-13), computes stats (nodeCount/approxTokens/durationMs/truncated — D-4a-21 provenance metrics only), and returns a StrategyResult with `source: 'apc-lite'` and `root` — re-validating the password invariant via FormControlSchema.refine (D-4a-20 defense-in-depth at the panel boundary)."
    - "DefuddleStrategy's fallback threshold constants are EXPORTED and vitest-pinned (Phase-4 precedent: DEFAULT_CONTEXT_TIER) — `MIN_EXTRACTED_CHARS = 500` (Readability charThreshold parity) and `MIN_CONTENT_DENSITY = 0.2` (textLength/htmlLength ratio), evaluated AFTER Defuddle, below-threshold → Readability fallback with `source: 'readability'` recorded (D-4a-18 never a bare-length heuristic)."
    - "`tests/core/extraction/DefuddleStrategy.test.ts` (NEW, §18 required) drives the SHARED golden fixtures (D-4a-24): buildArticleFixture → source 'defuddle' + markdown contains the article title + a heading; buildBoilerplateFixture → source 'readability' (threshold fallback fires); relative-link fixture asserts absolute hrefs post base-URL stamp (A2 gate)."
    - "`tests/core/extraction/ApcLiteStrategy.test.ts` (NEW, §18 required) drives buildRawNodeFixture → schema-validated APCLiteDocument (stats populated); password control with a value is REJECTED by FormControlSchema.refine (D-4a-20 invariant); geometry is unset on every emitted node (D-4a-13)."
  artifacts:
    - "src/core/extraction/strategies/DefuddleStrategy.ts"
    - "src/core/extraction/strategies/ApcLiteStrategy.ts"
    - "tests/core/extraction/DefuddleStrategy.test.ts"
    - "tests/core/extraction/ApcLiteStrategy.test.ts"
  key_links:
    - "DefuddleStrategy.run() reads input.html (present only in 'default' mode from the content-script serialization) — the bridge payload contract (04a-07) must supply {html, baseUrl}; canHandle gates the mode so extractLayered (04a-08) skips it for 'actionable'."
    - "The Readability fallback is INSIDE DefuddleStrategy (no §18 ReadabilityStrategy.ts file — PATTERNS L162) — the fallback records source 'readability' via the existing source union."
    - "Both strategies import estimateTokens from '@/core/context/TokenBudget' (the ONLY counter, PATTERNS L213) and FormControlSchema/APCLiteDocumentSchema from '../apcLite.types'."
  flagged_assumptions:
    - "A2 [research, ASSUMED — user confirmation gate]: `document.baseURI` from a stamped `<base href>` drives Readability's relative-URL resolution — the fixture test asserts absolute hrefs in the fallback path; if Readability uses document.URL instead, the base-URL stamp task (04a-07) re-verifies at test time (mitigation named in research)."
    - "A3 [research, ASSUMED]: PAGE_HTML_MAX_BYTES (~2 MB) truncation at element boundary keeps enough content for Defuddle to extract — if a huge page truncates mid-article the fallback chain still runs on the truncated doc (never silent empty)."
    - "A4 [research, ASSUMED]: estimateTokens ~4-char/token heuristic (CJK ratio) is the canonical counter — the §22.2 2,000-token webpage budget in 4b consumes it; no second counter invented."
    - "A5 [research, ASSUMED]: defuddle@0.6.6 site-specific extractors make zero network calls (no useAsync) — if a future upgrade adds useAsync, third-party fetches could exfiltrate page content; pin ^0.6 and document `useAsync: false` for any future upgrade (comment in DefuddleStrategy)."
    - "D-4a-18 constants [discretion]: MIN_EXTRACTED_CHARS=500 (Readability parity) + MIN_CONTENT_DENSITY=0.2 (textLength/htmlLength) are the planner pins — exported + vitest-pinned so a later calibration is a one-line test change."
    - "CAT-01 [unresolved — spec-less probe, empty]: a page whose Defuddle output is empty and whose Readability parse returns null → the strategy returns an unusable result (empty markdown, no root) → extractLayered tries the next strategy and eventually throws typed CONTENT_EXTRACT_FAILED (D-4a-19) — the service plan (04a-08) pins this with an empty fixture."
  prohibitions:
    - "No Readability on the SAME document after Defuddle — parse() mutates; always `document.cloneNode(true)` per call (Pitfall 2, D-4a-08)."
    - "No reliance on defuddle's `markdown: true` — it is a no-op in the browser bundle (Pitfall 1); markdown ALWAYS comes from PageContentSerializer.htmlToMarkdown."
    - "No geometry read anywhere (D-4a-13) — no getBoundingClientRect in v0.1; the field stays optional + unset."
    - "No implementation of 'servicenow-api' (D-4a-17 reserved only)."
    - "No passing the SAME doc to both strategies — each strategy gets its own detached doc / clone (Pitfall 2)."
    - "No silent empty result — a strategy that yields nothing returns the (empty) result; the layered loop (04a-08) decides fallback vs CONTENT_EXTRACT_FAILED (D-4a-19)."
---

<!-- 04a-04 (2026-08-12): Wave-3 extraction strategies — Defuddle primary (+ Readability
     fallback INSIDE DefuddleStrategy per PATTERNS L162) and ApcLite structural. The
     D-4a-18 threshold (exported, vitest-pinned), D-4a-08 base-URL stamp, D-4a-13
     geometry-unset rule, and D-4a-20 password invariant re-validation are the locked
     behaviors. Assumption-delta decision (no-change, from plan_pre_contributions):
     the layered Defuddle→Readability→APC-lite strategy union with recorded
     sourceUsed/fallbacksTried IS the locked primary model (D-4a-17) — no singular
     abstraction is being generalized; 'servicenow-api' is a reserved Phase-8 seam. -->

<objective>
Implement the two extraction strategies: `DefuddleStrategy` (primary read path with the D-4a-18 threshold and the Readability fallback INSIDE it — PATTERNS L162) and `ApcLiteStrategy` (structural/actionable path validating RawNode → APCLiteDocument), plus their §18-required tests driven by the shared golden fixtures (D-4a-24).

Purpose: CAT-01's "extract {title,url,text,metadata} via defuddle (readability fallback, turndown APC-lite)" lives in these two classes. The fallback threshold is concrete (D-4a-18: char floor + density ratio — never a bare-length heuristic), the base-URL stamp closes the detached-DOMParser relative-link gap (D-4a-08), and the password refine is re-validated at the ApcLite boundary (D-4a-20).

Output: two strategies + two §18-required test files.
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
@src/core/extraction/apcLite.types.ts
@src/core/extraction/strategies/IExtractionStrategy.ts
@src/core/extraction/PageContentSerializer.ts
@tests/fixtures/pageContent.ts
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: DefuddleStrategy — primary + Readability fallback (D-4a-14/18/08)</name>
  <files>src/core/extraction/strategies/DefuddleStrategy.ts, tests/core/extraction/DefuddleStrategy.test.ts</files>
  <read_first>
    - src/core/extraction/strategies/IExtractionStrategy.ts (the contract to implement)
    - .planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-RESEARCH.md (Pattern 3 parseDetached, Common Op 1+2, Pitfall 2 clone rule)
    - src/core/context/TokenBudget.ts L36 (estimateTokens — the ONLY counter)
    - tests/fixtures/pageContent.ts (buildArticleFixture/buildBoilerplateFixture)
  </read_first>
  <behavior>
    - Test 1: run({url, title, mode:'default', html: buildArticleFixture()}) → result.source === 'defuddle', result.markdown contains the article title text, result.approxTokens > 0, result.truncated === false.
    - Test 2: run({... html: buildBoilerplateFixture()}) → result.source === 'readability' (D-4a-18 threshold fires; the fallback ran on a clone).
    - Test 3: run({... html: article with relative links}) → the markdown/defuddleHtml resolves relative hrefs to absolute against the stamped base URL (A2 gate).
    - Test 4: run({mode:'actionable'}) → canHandle returns false (D-4a-14 gating).
  </behavior>
  <action>
    Implement `DefuddleStrategy` per the must_haves truth: export the pinned threshold constants `MIN_EXTRACTED_CHARS = 500` and `MIN_CONTENT_DENSITY = 0.2` at module top (Phase-4 RateLimiter precedent — named exports, never magic numbers inline); `parseDetached(html, baseUrl)` helper that DOMParser-parses and prepends `<base href="${baseUrl}">` to doc.head (D-4a-08); `run(input)` that throws a clear error when `input.html` is absent (canHandle gates mode, but defensive check per PATTERNS L189), runs Defuddle with `{ url: input.url }`, evaluates the threshold (extracted text length >= MIN_EXTRACTED_CHARS AND textLength/htmlLength ratio >= MIN_CONTENT_DENSITY); below threshold → Readability on `document.cloneNode(true)` (Pitfall 2 — NEVER the same doc) with `{ charThreshold: 500 }`, source becomes 'readability' and markdown from the article content; above → source 'defuddle'. markdown ALWAYS via `PageContentSerializer.htmlToMarkdown` (Pitfall 1). approxTokens via estimateTokens. meta: { defuddleHtml, title, wordCount } (D-4a-21 metrics). Add a comment documenting A5: pinned ^0.6 has no useAsync — future upgrades MUST pass useAsync:false.
    Then write the test file per the behavior block using the shared fixtures (import from the fixtures module — NEVER re-declare HTML, D-4a-24).
  </action>
  <acceptance_criteria>
    - MIN_EXTRACTED_CHARS and MIN_CONTENT_DENSITY exported from DefuddleStrategy.ts.
    - All four behavior tests pass via `pnpm vitest run tests/core/extraction/DefuddleStrategy.test.ts -x`.
    - The Readability call passes `document.cloneNode(true)` — no shared-doc mutation (grep the source for cloneNode usage).
    - markdown is produced through PageContentSerializer.htmlToMarkdown (no direct defuddle markdown option).
  </acceptance_criteria>
  <verify>
    <automated>pnpm vitest run tests/core/extraction/DefuddleStrategy.test.ts -x</automated>
  </verify>
  <done>DefuddleStrategy implements the contract with threshold fallback + base-URL stamp; all tests green; constants exported.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: ApcLiteStrategy — structural path + password re-validation (D-4a-11/13/14/20/21)</name>
  <files>src/core/extraction/strategies/ApcLiteStrategy.ts, tests/core/extraction/ApcLiteStrategy.test.ts</files>
  <read_first>
    - src/core/extraction/strategies/IExtractionStrategy.ts
    - src/core/extraction/apcLite.types.ts (APCLiteDocumentSchema, FormControlSchema, RawNode)
    - .planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-PATTERNS.md (ApcLiteStrategy section L215-238)
    - tests/fixtures/pageContent.ts (buildRawNodeFixture)
  </read_first>
  <behavior>
    - Test 1: run({url, title, mode:'actionable', raw: buildRawNodeFixture()}) → result.source === 'apc-lite', result.root defined, doc validates against APCLiteDocumentSchema (schema-validated boundary), stats {nodeCount, approxTokens, durationMs, truncated} populated.
    - Test 2: a RawNode whose form.control has isPassword:true AND a value → APCLiteDocumentSchema.parse throws (FormControlSchema.refine rejects — D-4a-20 invariant at the panel boundary).
    - Test 3: every emitted APCLiteNode has geometry === undefined (D-4a-13 geometry omitted in v0.1).
    - Test 4: run({mode:'default'}) → canHandle false (D-4a-14 gating).
  </behavior>
  <action>
    Implement `ApcLiteStrategy` per the must_haves truth: `canHandle` true only for mode 'actionable'; `run(input)` requires `input.raw` (defensive throw otherwise), normalizes RawNode → APCLiteNode (keep roles/text/hierarchy/interaction/link/image/form/iframe/children; geometry field NOT populated — D-4a-13), builds the APCLiteDocument (url/title/extractedAt/source:'dom'/root/stats with nodeCount/approxTokens/durationMs/truncated — D-4a-21 provenance metrics only), and validates via `APCLiteDocumentSchema.parse(...)` as the zod boundary gate (GR-4 — parse, never silent cast; the FormControlSchema.refine inside rejects password-with-value, D-4a-20). Return `{ source: 'apc-lite', root: doc.root, approxTokens: doc.stats.approxTokens, truncated: doc.stats.truncated }`.
    Then write the test file per the behavior block using buildRawNodeFixture from the shared fixtures module.
  </action>
  <acceptance_criteria>
    - All four behavior tests pass via `pnpm vitest run tests/core/extraction/ApcLiteStrategy.test.ts -x`.
    - The password-with-value raw input is REJECTED by the schema (D-4a-20 defense-in-depth at the boundary).
    - No geometry assignment anywhere in the strategy source (grep `geometry` — only the verbatim type declaration references it, unset).
  </acceptance_criteria>
  <verify>
    <automated>pnpm vitest run tests/core/extraction/ApcLiteStrategy.test.ts -x</automated>
  </verify>
  <done>ApcLiteStrategy validates RawNode → APCLiteDocument with stats; password invariant + geometry-unset proven; tests green.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| content-script HTML → DefuddleStrategy | untrusted host-page HTML is parsed panel-side |
| RawNode → ApcLiteStrategy | untrusted content-script walk output crosses the zod boundary |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-4a-01 | Information Disclosure | password/sensitive-input capture | high | mitigate | FormControlSchema.refine re-validates at the ApcLiteStrategy boundary (D-4a-20) — a password-bearing RawNode FAILS the schema parse; capture-time omission is enforced content-side by AxDomWalker (04a-06); never merely redacted later |
| T-4a-05 | Information Disclosure | defuddle network exfiltration | high | mitigate | Pinned ^0.6.6 has NO useAsync (zero fetches — verified); comment in DefuddleStrategy mandates `useAsync: false` for any future upgrade (A5) |
| T-4a-11 | Tampering | Readability doc mutation → double-parse corruption | medium | mitigate | Every Readability call receives `document.cloneNode(true)` (Pitfall 2) — the source clones per call and the test pins the clone usage |
| T-4a-04 | Tampering | host-page XSS via extracted HTML | medium | mitigate | Strategies parse in detached DOMParser docs only (never innerHTML into a live page); DOMPurify gates any future render (4b/7) |
| T-4a-12 | Information Disclosure | DOM-embedded secrets (JSESSIONID etc.) in strategy output | medium | mitigate | Strategy output is redacted by TraceRedactor BEFORE any index/log/persist at the PageContentService boundary (D-4a-10, CAT-03 — 04a-08) |
</threat_model>

<verification>
- `pnpm vitest run tests/core/extraction -x` — both strategy suites green.
- tsc --noEmit green (strategies implement the contract).
- MIN_EXTRACTED_CHARS/MIN_CONTENT_DENSITY exported (D-4a-18 pins).
- No geometry assignment in either strategy (D-4a-13).
</verification>

<success_criteria>
- Defuddle primary + Readability fallback with recorded source (D-4a-18/19) proven by fixture tests.
- ApcLite structural path schema-validated, password invariant re-checked, geometry unset.
- Both §18-required test files exist and are green.
</success_criteria>

<output>
Create `.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-04-SUMMARY.md` when done.
</output>

## Artifacts this phase produces

- src/core/extraction/strategies/DefuddleStrategy.ts — `DefuddleStrategy` class, `MIN_EXTRACTED_CHARS` (500), `MIN_CONTENT_DENSITY` (0.2), `parseDetached` helper
- src/core/extraction/strategies/ApcLiteStrategy.ts — `ApcLiteStrategy` class (RawNode → APCLiteDocument)
- tests/core/extraction/DefuddleStrategy.test.ts — 4 fixture-driven tests (source defuddle/readability, base-URL stamp, mode gating)
- tests/core/extraction/ApcLiteStrategy.test.ts — 4 tests (schema validation, password refine, geometry unset, mode gating)
