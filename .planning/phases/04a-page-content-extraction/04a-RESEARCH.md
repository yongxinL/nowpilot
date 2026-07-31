# Phase 4a: Page Content Extraction - Research

**Researched:** 2026-07-31
**Domain:** Browser content extraction, DOM serialization, full-text search indexing, Chrome extension cross-context messaging
**Confidence:** HIGH

## Summary

Phase 4a implements NowPilot's core page content extraction infrastructure — a layered strategy (Defuddle → Readability fallback for `default` mode; APC-lite DOM+ARIA walk for `actionable` mode) with ephemeral per-tab MiniSearch indexing. The content script stays extraction-only (<50KB, no React/AntD/defuddle/yaml/FS Access) — it serializes HTML only; all parsing runs in extension page contexts (side panel / full app) via DOMParser. Cross-context messaging uses the established RuntimeEnvelope + MessageBus pattern. Extracted content feeds `ContextOptimizerInput.pageContext` with sourceId `context.page.current-url`.

All three external packages (defuddle v0.19.2, @mozilla/readability v0.6.0, minisearch v7.2.0) are well-established, zero postinstall-script-risk libraries. None are bundled into the content script — they live exclusively in extension-page bundles (side panel / full app). The content script bundle stays under 50KB by containing only DomSerializer (password-redacting HTML serialization), MessageBus routing, and SPA navigation detection.

**Primary recommendation:** Implement strategies as pure functions accepting an HTML string, constructing their own `DOMParser` document, and returning typed `StrategyResult`. Use the existing `redactSensitive` function from `src/core/security/redactSensitive.ts` for post-extraction TraceRedactor-style redaction. The `ContextOptimizerInput.pageContext` field (currently `unknown`) becomes `PageContext` — a discriminated union keyed on `mode`.

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Content script captures full `document.documentElement.outerHTML` (size-capped ~2MB) with password-field value redaction at capture time via `DomSerializer`.
- **D-02:** `DomSerializer` (in `src/core/content/`) is the content-script-safe serializer: walks DOM, omits `value` for password fields (`input[type=password]`, `isPassword` attribute, `autocomplete=current-password` heuristic), never logs or transmits captured text.
- **D-03:** Full migration to RuntimeEnvelope + MessageBus pattern. Replace all raw `chrome.runtime.sendMessage` calls in `content.core.ts` with `createEnvelope()`. Register incoming message handlers via `MessageBus.register()`. Both `SPA_NAVIGATION` and `EXTRACT_PAGE_CONTENT` use typed `RuntimeEnvelope` contracts. Remove unused `CONTENT_SCRIPT_READY` message.
- **D-04:** `EXTRACT_PAGE_CONTENT` uses request/response semantics via `chrome.runtime.onMessage` `sendResponse` callback. Content script receives envelope, serializes HTML synchronously, returns result through `sendResponse`. `SPA_NAVIGATION` is outbound-only event.
- **D-05:** Defuddle/Readability/APC-lite parsing runs in side panel / full app (extension page contexts with DOMParser), NOT in service worker and NOT in content bundle. Strategies accept HTML string and construct their own `DOMParser` document.
- **D-06:** `PageContextBridge` (in `src/core/content/`) routes `EXTRACT_PAGE_CONTENT` requests via MessageBus.
- **D-07:** `DefuddleStrategy` is PRIMARY for mode `default`. Fallback to Readability when Defuddle yields low-confidence output: no content / content < ~500 chars / parse exception / >5s timeout (global budget).
- **D-08:** `ApcLiteStrategy` runs for mode `actionable` — builds `APCLiteNode` tree per Appendix C (Zod-validated via `apcLite.types.ts`): roles, geometry, interaction info, node ids.
- **D-09:** Strategy contract: `IExtractionStrategy` with `id`, `canHandle({url, mode})`, `run(input) → StrategyResult` (markdown and/or APCLiteNode tree).
- **D-10:** Extraction timeout is a 5s global budget shared across the entire fallback chain. Each strategy executes with remaining available budget. Once global deadline reached, return `ExtractionError` with `TIMEOUT` error code and `strategiesAttempted`.
- **D-11:** `PageContentService.extract()` returns an `ExtractionResult` discriminated union: `{ ok: true, pageContext: PageContext }` | `{ ok: false, error: ExtractionError }`. `ExtractionError` carries `code` (NO_CONTENT, TIMEOUT, PARSE_ERROR, CAPTURE_FAILED) and `strategiesAttempted`.
- **D-12:** `PageContext` is a discriminated union keyed by `mode`: `{ mode: 'default', markdown: string, ...BaseMetadata }` | `{ mode: 'actionable', apcLiteTree: APCLiteNode, ...BaseMetadata }`. Shared `BaseMetadata` includes: `url`, `title`, `capturedAt`, `size`, `source`, `extractionLevel`, `truncated`, `compressionApplied`.
- **D-13:** `PageContentService.reExtract(tabId)` exposes explicit force re-extraction as an API capability.
- **D-14:** `PageIndexBuilder` creates one ephemeral per-tab MiniSearch instance over extracted content. Index survives SPA navigations but destroyed on tab close. Never persisted to IndexedDB or chrome.storage.
- **D-15:** MiniSearch indexes heading-aware chunks with BM25 ranking. Each chunk carries heading breadcrumb (`h1 → h2 → h3` path). `selectRelevant(query)` performs BM25 retrieval with heading-aware score boosting.
- **D-16:** Token budget for page content injection lives in ContextOptimizer, not PageContentService.
- **D-17:** `PageContentCache` is a per-tab in-memory Map (tabId → {url, result, indexedAt}). Invalidation: URL change via `SPA_NAVIGATION` + `tabs.onUpdated`. Re-extraction is lazy.
- **D-18:** Concurrency guard: duplicate extractions per tab coalesce into single in-flight promise; hard 5s global timeout.
- **D-19:** TraceRedactor-style redaction runs before indexing or logging: API keys, bearer tokens, emails in extracted text. Password values never captured at source (D-02).
- **D-20:** Content bundle must contain no React, AntD, defuddle, yaml, or FS Access API usage and stay < 50KB. Enforced by `tests/isolation/no-content-script-ui.test.ts` + `pnpm run verify:phase-4a`.

### the agent's Discretion

- Exact heading-chunking limits, Readability fallback thresholds (char count), and DOM capture size caps are implementation constants — planner may tune within the decision bounds above.
- BM25 boost weight for heading-path matches — planner selects reasonable defaults.

### Deferred Ideas (OUT OF SCOPE)

- v2 host-page automation (click/type/navigate via chrome.debugger + CDP Input) — spec §26.7
- ServiceNow Table-API-first extraction — belongs to Phase 8 add-on
- site-specific extraction strategies — model for future add-on `IContextExtractor`

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAGE-01 | User can extract page content via layered extraction (Defuddle → APC-lite) with ephemeral MiniSearch index and per-tab SPA-nav cache | defuddle v0.19.2 for primary extraction, @mozilla/readability v0.6.0 for fallback, minisearch v7.2.0 for BM25 indexing, DOMParser in extension pages for parsing, RuntimeEnvelope+MessageBus for cross-context messaging |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| DOM serialization (HTML capture) | Browser (content script) | — | Content script has synchronous DOM access; serialization is extraction-only per §5.6 |
| Password field redaction | Browser (content script) | — | Must happen at capture time before any transmission (privacy guarantee D-02) |
| Content parsing (Defuddle/Readability) | Extension Page (side panel/full app) | — | Libraries not bundled in content script per D-20; DOMParser available in extension pages (D-05) |
| APC-lite DOM+ARIA walk | Extension Page (side panel/full app) | — | RawNode tree consumed by ApcLiteStrategy in extension page (D-08); content script only provides serialized HTML |
| MiniSearch indexing | Extension Page (side panel/full app) | — | In-memory, ephemeral; lives in side panel / full app JS context (D-14) |
| Per-tab cache management | Extension Page | Service Worker (invalidation only) | Map lives in extension page JS context; `tabs.onUpdated` invalidation originates from service worker |
| TraceRedactor-style redaction | Extension Page (side panel/full app) | — | Runs before indexing/logging per D-19; uses existing `redactSensitive` |
| Cross-context messaging | All tiers via MessageBus | — | RuntimeEnvelope + MessageBus is the established Phase 1 pattern (D-03) |
| Token budget allocation | Extension Page (ContextOptimizer) | — | D-16: budget policy stays in ContextOptimizer, not PageContentService |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| defuddle | 0.19.2 [CITED: npmjs.com/package/defuddle] | Primary content extraction (mode `default`) | Spec §26.2 designated primary; Obsidian Web Clipper backing; provides clean Markdown with footnotes/math/code standardization; MIT license |
| @mozilla/readability | 0.6.0 [CITED: npmjs.com/package/@mozilla/readability] | Fallback content extraction when Defuddle low-confidence | Firefox Reader View engine; most battle-tested extraction library (2.4M weekly downloads); `charThreshold: 500` option aligns with D-07 fallback threshold; Apache-2.0 license |
| minisearch | 7.2.0 [CITED: npmjs.com/package/minisearch] | Ephemeral BM25 full-text search over extracted content | Zero dependencies; < 15KB; native BM25 ranking; field boosting for heading-path scoring (D-15); 1.6M weekly downloads; MIT license; supports `add`, `remove`, `search`, `autoSuggest` in-memory |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.4.3 (already installed) | Schema validation for APCLiteNode, StrategyResult, PageContext, ExtractionError | All module boundaries per §0.3 |
| DOMParser (Web API) | Built-in Chrome | HTML string → DOM Document for strategies | Available in extension pages (side panel/full app); used by all strategies per D-05; not available in service worker |
| crypto.randomUUID() | Built-in Chrome | Operation ID generation | Already used by `RuntimeEnvelope.createEnvelope`; used for indexing IDs |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| defuddle | only @mozilla/readability | Readability provides HTML content; Defuddle provides standardized Markdown with footnotes/math/callouts — better for AI context |
| @mozilla/readability | mercury-parser | Mercury deprecated; Readability is the Mozilla-maintained drop-in replacement |
| minisearch | lunr.js or fuse.js | MiniSearch has better BM25 implementation, smaller bundle, native TypeScript types, field boosting; no external dependencies |
| DOMParser in extension page | linkedom or happy-dom | Network cost and bundle bloat; DOMParser is a standard Web API available in chrome-extension:// contexts |

**Installation:**
```bash
npm install defuddle@0.19.2 @mozilla/readability@0.6.0 minisearch@7.2.0
```

**Version verification:** [VERIFIED: npm registry]
- `defuddle`: 0.19.2 (published 2026-07-22, ~115K weekly downloads, MIT, no postinstall)
- `@mozilla/readability`: 0.6.0 (published ~1 year ago, ~2.4M weekly downloads, Apache-2.0, no postinstall)
- `minisearch`: 7.2.0 (published ~10 months ago, ~1.6M weekly downloads, MIT, no postinstall)

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| defuddle | npm | ~1.5 yrs (created 2025-02) | ~115K/wk | github.com/kepano/defuddle | OK | Approved — install in extension page bundles only |
| @mozilla/readability | npm | ~5 yrs (created 2020-08) | ~2.4M/wk | github.com/mozilla/readability | OK | Approved — install in extension page bundles only |
| minisearch | npm | ~7 yrs (created 2018-09) | ~1.6M/wk | github.com/lucaong/minisearch | OK | Approved — install in extension page bundles only |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*All packages verified via npm registry lookup + npmjs.com documentation. No postinstall scripts detected on any package. All are well-established with MIT or Apache-2.0 licenses.*

## Architecture Patterns

### System Architecture Diagram

```
User opens a web page
        │
        ▼
┌─────────────────────────────────────┐
│       Content Script (Browser)      │
│  entrypoints/content.core.ts        │
│                                     │
│  ┌───────────────┐  ┌────────────┐  │
│  │ DomSerializer  │  │ SPA Nav    │  │
│  │ (HTML capture  │  │ Detection  │  │
│  │  + password    │  │ (Mutation  │  │
│  │  redaction)    │  │ Observer)  │  │
│  └───────┬───────┘  └─────┬──────┘  │
│          │                │          │
└──────────┼────────────────┼──────────┘
           │                │
           │  EXTRACT_PAGE_ │  SPA_NAVIGATION
           │  CONTENT       │  (outbound)
           │  (req/resp)    │
           ▼                │
┌───────────────────────────┼──────────┐
│   MessageBus / RuntimeEnvelope       │
│   (cross-context messaging)          │
└───────────┬──────────────────────────┘
            │
            ▼
┌─────────────────────────────────────┐
│     Extension Page Context           │
│     (Side Panel / Full App)          │
│                                      │
│  ┌───────────────────────────────┐   │
│  │     PageContentService        │   │
│  │  extract(tabId, mode):        │   │
│  │    ExtractionResult           │   │
│  │                               │   │
│  │  ┌─────────────────────────┐  │   │
│  │  │ PageContentCache        │  │   │
│  │  │ (per-tab Map)           │  │   │
│  │  │ invalidated by:         │  │   │
│  │  │ SPA_NAVIGATION +        │  │   │
│  │  │ tabs.onUpdated          │  │   │
│  │  └─────────┬───────────────┘  │   │
│  │            │                   │   │
│  │            ▼                   │   │
│  │  ┌─────────────────────────┐  │   │
│  │  │ Strategy Selection      │  │   │
│  │  │                         │  │   │
│  │  │ mode='default'          │  │   │
│  │  │  ┌──────────────────┐   │  │   │
│  │  │  │ DefuddleStrategy │───┼──┼──▶ DOMParser → Defuddle.parse()
│  │  │  │   (PRIMARY)       │   │  │   │          → markdown
│  │  │  └──────┬───────────┘   │  │   │
│  │  │         │ low conf?     │  │   │
│  │  │         ▼               │  │   │
│  │  │  ┌──────────────────┐   │  │   │
│  │  │  │ReadabilityFallback│──┼──┼──▶ DOMParser → Readability.parse()
│  │  │  └──────────────────┘   │  │   │          → textContent
│  │  │                         │  │   │
│  │  │ mode='actionable'       │  │   │
│  │  │  ┌──────────────────┐   │  │   │
│  │  │  │ApcLiteStrategy    │──┼──┼──▶ DOMParser → DOM+ARIA walk
│  │  │  │                   │   │  │   │          → APCLiteNode tree
│  │  │  └──────────────────┘   │  │   │
│  │  └─────────────────────────┘  │   │
│  │            │                   │   │
│  │            ▼                   │   │
│  │  ┌─────────────────────────┐  │   │
│  │  │ TraceRedactor           │  │   │
│  │  │ redactSensitive(text)   │  │   │
│  │  └─────────┬───────────────┘  │   │
│  │            │                   │   │
│  │            ▼                   │   │
│  │  ┌─────────────────────────┐  │   │
│  │  │ PageIndexBuilder        │  │   │
│  │  │ MiniSearch (ephemeral)  │  │   │
│  │  │ heading-aware chunks    │  │   │
│  │  │ BM25 + boost            │  │   │
│  │  └─────────┬───────────────┘  │   │
│  │            │                   │   │
│  │            ▼                   │   │
│  │  ┌─────────────────────────┐  │   │
│  │  │ PageContext (typed)     │  │   │
│  │  │ mode discriminated      │  │   │
│  │  └─────────┬───────────────┘  │   │
│  └────────────┼──────────────────┘   │
│               │                       │
│               ▼                       │
│  ┌───────────────────────────┐       │
│  │ ContextOptimizerInput     │       │
│  │ .pageContext              │       │
│  └───────────────────────────┘       │
└───────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── core/
│   ├── extraction/              # NEW — extraction layer
│   │   ├── PageContentService.ts      # orchestrator
│   │   ├── apcLite.types.ts           # RawNode / APCLiteNode / APCLiteDocument (+ Zod) — Appendix C
│   │   ├── PageContentSerializer.ts   # tree → markdown / PageContext
│   │   ├── PageIndexBuilder.ts        # ephemeral MiniSearch index
│   │   ├── PageContentCache.ts        # per-tab cache + invalidation
│   │   ├── types.ts                    # ExtractionResult, ExtractionError, PageContext, etc.
│   │   └── strategies/
│   │       ├── IExtractionStrategy.ts  # strategy contract interface
│   │       ├── DefuddleStrategy.ts     # PRIMARY: defuddle parser → markdown
│   │       ├── ReadabilityFallback.ts  # fallback: readability → textContent
│   │       └── ApcLiteStrategy.ts      # actionable: DOM+ARIA → APCLiteNode tree
│   ├── content/                 # NEW — content-script-safe modules
│   │   ├── DomSerializer.ts            # D-02: DOM walker, password redaction
│   │   └── PageContextBridge.ts        # D-06: EXTRACT_PAGE_CONTENT handler
│   └── security/
│       └── redactSensitive.ts          # EXISTING — reuse for D-19
└── entrypoints/
    └── content.core.ts                 # MODIFY — RuntimeEnvelope migration, DomSerializer integration
```

### Pattern 1: Strategy Pattern with Discriminated Union Results

**What:** `PageContentService.extract()` selects a strategy based on `mode`, executes with timeout budget, returns a typed discriminated union. Each strategy implements `IExtractionStrategy` with `canHandle()` + `run()`. The discriminated union prevents consumers from accessing fields that don't exist for the current result variant.

**When to use:** Every extraction call. This is the core architectural pattern per D-09, D-11, D-12.

**Example:**
```typescript
// Source: PRODUCT_SPEC_v0_1.md Appendix C / §26.3
// src/core/extraction/types.ts

export interface ExtractionError {
  code: 'NO_CONTENT' | 'TIMEOUT' | 'PARSE_ERROR' | 'CAPTURE_FAILED';
  message: string;
  strategiesAttempted: string[];  // ordered list of strategy IDs tried
}

export type ExtractionResult =
  | { ok: true; pageContext: PageContext }
  | { ok: false; error: ExtractionError };

export interface BaseMetadata {
  url: string;
  title: string;
  capturedAt: number;
  size: number;
  source: 'defuddle' | 'readability' | 'apc-lite';
  extractionLevel: 'full' | 'truncated';
  truncated: boolean;
  compressionApplied?: 'topk';
  // Optional enrichment:
  author?: string;
  publishDate?: string;
  language?: string;
  description?: string;
  siteName?: string;
}

export type PageContext =
  | { mode: 'default'; markdown: string } & BaseMetadata
  | { mode: 'actionable'; apcLiteTree: APCLiteNode } & BaseMetadata;

// Strategy contract (from spec §26.3 / Appendix C)
export interface StrategyInput {
  url: string;
  title: string;
  mode: 'default' | 'actionable';
  html?: string;    // for DefuddleStrategy / ReadabilityFallback
  raw?: RawNode;    // for ApcLiteStrategy
}

export interface StrategyResult {
  source: 'defuddle' | 'readability' | 'apc-lite';
  markdown?: string;
  root?: APCLiteNode;
  meta?: Record<string, string>;
  approxTokens: number;
  truncated: boolean;
}

export interface IExtractionStrategy {
  id: StrategyResult['source'];
  canHandle(input: { url: string; mode: 'default' | 'actionable' }): boolean;
  run(input: StrategyInput): Promise<StrategyResult>;
}
```

**Timeout budget pattern** (D-10, D-18):
```typescript
// Source: PRODUCT_SPEC_v0_1.md §26.6 / D-10
const GLOBAL_TIMEOUT_MS = 5000;
const deadline = Date.now() + GLOBAL_TIMEOUT_MS;

for (const strategy of strategies) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    return { ok: false, error: { code: 'TIMEOUT', message: '...', strategiesAttempted } };
  }
  try {
    const result = await Promise.race([
      strategy.run(input),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), remaining)),
    ]);
    // ... check confidence, build ExtractionResult
  } catch (e) {
    strategiesAttempted.push(strategy.id);
    continue; // try next strategy
  }
}
```

### Pattern 2: DOMParser-based Strategy Execution in Extension Pages

**What:** Strategies accept an HTML string, use `new DOMParser().parseFromString(html, 'text/html')` to construct a DOM Document within the extension page context, then pass to the extraction library. This keeps heavy libraries out of the content script bundle (per D-05, D-20).

**When to use:** All three strategies (Defuddle, Readability, APC-lite).

**Example:**
```typescript
// Source: npmjs.com/package/defuddle + npmjs.com/package/@mozilla/readability
// src/core/extraction/strategies/DefuddleStrategy.ts

import Defuddle from 'defuddle';  // browser variant — accepts live Document

export class DefuddleStrategy implements IExtractionStrategy {
  id = 'defuddle' as const;

  canHandle(input: { url: string; mode: string }): boolean {
    return input.mode === 'default';
  }

  async run(input: StrategyInput): Promise<StrategyResult> {
    if (!input.html) throw new Error('html required for DefuddleStrategy');

    // DOMParser available in extension page contexts (side panel / full app)
    const doc = new DOMParser().parseFromString(input.html, 'text/html');
    const defuddle = new Defuddle(doc);
    const result = defuddle.parse(); // → { content (HTML), title, author, ... }

    // For markdown output, pass { markdown: true } option
    const defuddleMd = new Defuddle(doc);
    const mdResult = defuddleMd.parse(); // use with defuddle/full for markdown

    return {
      source: 'defuddle',
      markdown: mdResult.content,  // or convert HTML→markdown separately
      meta: {
        author: result.author,
        description: result.description,
        language: result.language,
        siteName: result.site,
        publishDate: result.published,
      },
      approxTokens: estimateTokens(result.content),
      truncated: false,
    };
  }
}
```

**Readability fallback:**
```typescript
// src/core/extraction/strategies/ReadabilityFallback.ts
import { Readability } from '@mozilla/readability';

export class ReadabilityFallback implements IExtractionStrategy {
  id = 'readability' as const;
  private static readonly LOW_CONFIDENCE_CHAR_THRESHOLD = 500; // D-07

  canHandle(input: { url: string; mode: string }): boolean {
    return input.mode === 'default';
  }

  async run(input: StrategyInput): Promise<StrategyResult> {
    if (!input.html) throw new Error('html required for ReadabilityFallback');

    const doc = new DOMParser().parseFromString(input.html, 'text/html');
    // Clone to avoid DOM mutation
    const clone = doc.cloneNode(true) as Document;
    const reader = new Readability(clone);
    const article = reader.parse();

    if (!article || !article.textContent || 
        article.textContent.length < ReadabilityFallback.LOW_CONFIDENCE_CHAR_THRESHOLD) {
      throw new Error('Readability low confidence');
    }

    return {
      source: 'readability',
      markdown: article.textContent,  // plain text; Markdown conversion separate if needed
      meta: {
        title: article.title,
        byline: article.byline,
        excerpt: article.excerpt,
        siteName: article.siteName,
        language: article.lang,
        publishDate: article.publishedTime,
      },
      approxTokens: estimateTokens(article.textContent),
      truncated: false,
    };
  }
}
```

### Pattern 3: MiniSearch Heading-Aware Chunking

**What:** `PageIndexBuilder` chunks extracted content by headings, creates breadcrumb metadata per chunk, adds to MiniSearch with field boosting on heading paths. BM25 retrieval with heading boost satisfies D-15.

**When to use:** After extraction but before feeding to ContextOptimizer.

**Example:**
```typescript
// Source: npmjs.com/package/minisearch + D-15
// src/core/extraction/PageIndexBuilder.ts
import MiniSearch from 'minisearch';

interface IndexedChunk {
  id: string;
  tabId: number;
  headingPath: string;   // "h1 → h2 → h3"
  chunkText: string;
  headingText: string;   // text content of the nearest heading
}

export class PageIndexBuilder {
  private index: MiniSearch<IndexedChunk>;

  constructor() {
    this.index = new MiniSearch<IndexedChunk>({
      fields: ['chunkText', 'headingText', 'headingPath'],
      storeFields: ['tabId', 'headingPath', 'chunkText', 'headingText'],
      searchOptions: {
        boost: {
          headingText: 2.0,   // D-15: heading-aware boost
          headingPath: 1.5,
        },
        prefix: true,
      },
    });
  }

  buildFromMarkdown(tabId: number, markdown: string): void {
    const chunks = this.chunkByHeadings(markdown);
    this.index.addAll(chunks.map((c, i) => ({
      id: `${tabId}-${i}`,
      tabId,
      headingPath: c.breadcrumb.join(' → '),
      chunkText: c.text,
      headingText: c.breadcrumb.join(' '),
    })));
  }

  selectRelevant(query: string, budget: number): IndexedChunk[] {
    const results = this.index.search(query, {
      // BM25 ranking with heading boost already configured
    });
    // Take top-K within token budget
    return this.fitBudget(results, budget);
  }

  removeTab(tabId: number): void {
    // Find all chunks for tab, remove by id
    const docs = this.index.search('', { filter: (r) => r.tabId === tabId });
    for (const doc of docs) {
      this.index.removeById(doc.id);
    }
  }
}
```

### Anti-Patterns to Avoid

- **Bundle defuddle/readability in content script:** Violates D-20 (<50KB cap) and §5.6 (extraction-only). Content script only serializes HTML — all parsing happens in extension pages via DOMParser.
- **Persist MiniSearch index to IndexedDB:** Violates D-14 (ephemeral requirement) and the privacy boundary §26.5. Index is destroyed on tab close.
- **Block the sendResponse callback:** Content script's `EXTRACT_PAGE_CONTENT` handler must synchronously serialize HTML and call `sendResponse`. Do not use `await` or `return true` for this handler — the serialization is synchronous.
- **Capture password field values:** Per D-02, `DomSerializer` must omit `value` for any input matching `input[type=password]`, `[isPassword]`, or `autocomplete="current-password"`. This is a privacy contract — there is no recovery if violated.
- **Put extraction heuristics in the content bundle:** D-01 specifies full `outerHTML` capture with size cap, keeping the content bundle minimal. Any content selection logic lives in strategies in the extension page context.
- **Skip redaction before indexing:** D-19 requires TraceRedactor-style redaction (using existing `redactSensitive`) before text enters MiniSearch or logs. Raw extracted text must never be persisted or logged.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Content extraction from HTML | Custom heuristic parser | defuddle / @mozilla/readability | Defuddle handles mobile-styles detection, schema.org extraction, footnote/math/code standardization. Readability has 5 years of Mozilla battle-testing. Custom parsers miss edge cases (lazy-loaded content, CSS sidenotes, paywalls). |
| Full-text search over extracted content | Array.filter + String.includes | minisearch | BM25 ranking is non-trivial to implement correctly; minisearch handles term frequency normalization, field boosting, prefix search, and fuzzy matching — all in < 15KB with zero dependencies. |
| Heading-aware chunking | Custom regex heading parser | DOMParser + querySelectorAll('h1,h2,h3,h4,h5,h6') | DOMParser gives standard DOM traversal; heading hierarchy is structural. Regex is fragile for malformed HTML. |
| Cross-context messaging | Raw chrome.runtime.sendMessage | RuntimeEnvelope + MessageBus (existing) | D-03 locks this; RuntimeEnvelope provides typed contracts, operation IDs, and source tracking. MessageBus provides handler registration and error propagation. |
| DOM serialization for cross-context transfer | JSON.stringify(document) | DomSerializer (new) + outerHTML | outerHTML is a standard serialization method; DomSerializer adds password redaction at capture time. JSON.stringify can't handle circular DOM references. |
| Promise deduplication | Custom in-flight tracker | Map-based coalescing | D-18 specifies coalesce pattern; a simple `Map<string, Promise>` is sufficient to deduplicate per-tab extractions. |

**Key insight:** The three external libraries (defuddle, readability, minisearch) collectively handle problems that each have years of dedicated development. A custom solution for any of them would be significantly worse: defuddle alone handles 15+ edge cases (math rendering, footnote standardization, callout conversion, mobile layout detection) that would take weeks to replicate correctly.

## Common Pitfalls

### Pitfall 1: DOMParser in Service Worker

**What goes wrong:** Chrome extension service workers do not have access to `DOMParser`. Attempting `new DOMParser()` from a service worker context will throw `ReferenceError: DOMParser is not defined`.

**Why it happens:** MV3 service workers run in a restricted environment without DOM APIs. DOMParser is a DOM API only available in window contexts (extension pages, content scripts).

**How to avoid:** Per D-05, all parsing MUST run in side panel / full app (extension page contexts). The service worker is never a parsing context. If the extraction API is called from the service worker, route to an extension page and get the result back via MessageBus.

**Warning signs:** `ReferenceError: DOMParser is not defined` in service worker console. Test: check `typeof DOMParser !== 'undefined'` before using.

### Pitfall 2: Content Script Bundle Size Creep

**What goes wrong:** New developers import `defuddle`, `@mozilla/readability`, or utility libraries into `src/core/content/` modules, causing the content script bundle to exceed 50KB.

**Why it happens:** `src/core/content/` modules are imported by `entrypoints/content.core.ts`. WXT bundles all transitive dependencies into the content script entry point. Without isolation tests, import creep goes undetected until `pnpm run verify:phase-4a` fails.

**How to avoid:** D-20 enforcement: `tests/isolation/no-content-script-ui.test.ts` (import-graph grep test, modeled after `tests/isolation/cross-entrypoint-imports.test.ts`) + bundle-size assertion. Never import React, AntD, defuddle, yaml, or File System Access APIs in `src/core/content/`. Only `DomSerializer` (pure DOM walker) and `PageContextBridge` (MessageBus routing) belong in that directory.

**Warning signs:** `grep -r "from ['\"]defuddle['\"]" src/core/content/` returns matches. Content bundle exceeds 50KB in build output.

### Pitfall 3: Readability Mutates the DOM

**What goes wrong:** `new Readability(document).parse()` modifies the passed DOM document in place, removing elements it considers non-content. If you pass the original document, subsequent reads see a mutated tree.

**Why it happens:** Readability's algorithm works by progressively removing navigation, ads, and low-scoring elements from the DOM. This is by design — it uses DOM mutation to identify content boundaries.

**How to avoid:** Always clone the document before passing to Readability: `const clone = document.cloneNode(true) as Document; new Readability(clone).parse()`. The Mozilla docs explicitly recommend this pattern. Defuddle does not have this problem — it reads without mutation.

**Warning signs:** Subsequent DOM reads after Readability.parse() return truncated or missing content. Debugging shows `document.body.children.length` dropping after parse.

### Pitfall 4: Password Field False Negatives

**What goes wrong:** Some login forms use non-standard patterns for password fields — e.g., `<input type="text" autocomplete="current-password">` or custom web components. `DomSerializer` misses these and transmits password values.

**Why it happens:** The `input[type=password]` selector is the only 100% reliable signal. Heuristics like `autocomplete=current-password` cover additional cases but may have false positives/negatives. Custom web components require case-by-case handling.

**How to avoid:** D-02 covers the three primary signals: `input[type=password]`, `[isPassword]` attribute, and `autocomplete=current-password`. For the content script, err on the side of false positives — omitting a value is safer than capturing a password. Add `name` attribute heuristics (`name` matching `/password|passwd|pwd/i`) if the <50KB budget allows. Log (but don't transmit) any non-standard password field patterns for future improvement.

**Warning signs:** Password values appearing in extracted content. Audit with: search for known password patterns in test fixtures.

### Pitfall 5: MiniSearch Index Growing Unbounded

**What goes wrong:** SPA navigation triggers re-extraction and re-indexing without cleaning up old index entries. The index accumulates stale chunks from previous page states, consuming memory and polluting search results.

**Why it happens:** SPA pages (React Router, Vue Router) change URLs without full page reloads. Without explicit index cleanup, old chunks persist in the MiniSearch instance.

**How to avoid:** D-17 specifies cache invalidation on URL change. `PageIndexBuilder.removeTab(tabId)` must be called before re-indexing. The `SPA_NAVIGATION` event triggers: (1) invalidate cache, (2) clear old index entries for the tab, (3) lazy re-extraction on next request. Never append to the index for the same tab without clearing first.

**Warning signs:** Memory usage grows per SPA navigation. Search results contain content from old URLs.

## Code Examples

### DomSerializer (content-script-safe)

```typescript
// Source: CONTEXT.md D-01/D-02, PRODUCT_SPEC_v0_1.md §26.4
// src/core/content/DomSerializer.ts

const SIZE_CAP = 2 * 1024 * 1024; // ~2MB per D-01
const PASSWORD_INPUT_SELECTOR = 'input[type="password"], [isPassword], input[autocomplete="current-password"]';
const PASSWORD_NAME_PATTERN = /^(?:.*pass(?:word|wd)?.*|.*pwd.*)$/i;

export interface SerializedPage {
  html: string;
  url: string;
  title: string;
  capturedAt: number;
  size: number;
  truncated: boolean;
}

export function serializePage(doc: Document): SerializedPage {
  // Redact password field values BEFORE serialization
  const passwordFields = doc.querySelectorAll(PASSWORD_INPUT_SELECTOR);
  const redactedFields: string[] = [];
  
  for (const field of passwordFields) {
    if (field instanceof HTMLInputElement && field.value) {
      field.value = '';  // D-02: never transmit password values
      redactedFields.push(field.name || field.id || '(unnamed)');
    }
  }
  
  // Additionally check by name pattern (D-02 heuristic)
  const allInputs = doc.querySelectorAll('input');
  for (const input of allInputs) {
    if (input instanceof HTMLInputElement && 
        PASSWORD_NAME_PATTERN.test(input.name || '') &&
        input.value) {
      input.value = '';
      redactedFields.push(input.name || '(unnamed)');
    }
  }

  let html = doc.documentElement.outerHTML;
  let truncated = false;

  // Size cap per D-01
  if (html.length > SIZE_CAP) {
    html = html.slice(0, SIZE_CAP);
    truncated = true;
  }

  return {
    html,
    url: doc.URL,
    title: doc.title,
    capturedAt: Date.now(),
    size: html.length,
    truncated,
  };
}
```

### PageContentService Orchestrator

```typescript
// Source: CONTEXT.md D-07/D-10/D-11, PRODUCT_SPEC_v0_1.md §26.2
// src/core/extraction/PageContentService.ts

import { redactSensitive } from '@/core/security/redactSensitive';
import { DefuddleStrategy } from './strategies/DefuddleStrategy';
import { ReadabilityFallback } from './strategies/ReadabilityFallback';
import { ApcLiteStrategy } from './strategies/ApcLiteStrategy';
import { PageContentCache } from './PageContentCache';
import { PageIndexBuilder } from './PageIndexBuilder';

const GLOBAL_TIMEOUT_MS = 5000;

export class PageContentService {
  private cache = new PageContentCache();
  private indexBuilder = new PageIndexBuilder();
  private inFlight = new Map<string, Promise<ExtractionResult>>();

  constructor(
    private strategies: IExtractionStrategy[] = [
      new DefuddleStrategy(),
      new ReadabilityFallback(),
      new ApcLiteStrategy(),
    ],
  ) {}

  async extract(tabId: number, mode: 'default' | 'actionable', url: string): Promise<ExtractionResult> {
    // Check cache first (D-17: lazy extraction)
    const cached = this.cache.get(tabId, url);
    if (cached) return cached;

    // D-18: coalesce in-flight extractions
    const key = `${tabId}:${url}:${mode}`;
    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const promise = this.doExtract(tabId, mode, url);
    this.inFlight.set(key, promise);
    try {
      const result = await promise;
      if (result.ok) {
        this.cache.set(tabId, url, result);
      }
      return result;
    } finally {
      this.inFlight.delete(key);
    }
  }

  reExtract(tabId: number): void {
    this.cache.invalidate(tabId);
    this.indexBuilder.removeTab(tabId);
  }

  private async doExtract(
    tabId: number, mode: 'default' | 'actionable', url: string,
  ): Promise<ExtractionResult> {
    // 1. Request HTML from content script via MessageBus
    const serialized = await this.requestContentFromTab(tabId);
    if (!serialized.ok) {
      return { ok: false, error: { code: 'CAPTURE_FAILED', message: serialized.error, strategiesAttempted: [] } };
    }

    const { html, title } = serialized.data;
    const deadline = Date.now() + GLOBAL_TIMEOUT_MS;
    const strategiesAttempted: string[] = [];
    const applicableStrategies = this.strategies.filter(s => s.canHandle({ url, mode }));

    for (const strategy of applicableStrategies) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return { ok: false, error: { code: 'TIMEOUT', message: 'Global timeout exceeded', strategiesAttempted } };
      }

      try {
        const result = await Promise.race([
          strategy.run({ url, title, mode, html }),
          new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error('TIMEOUT')), remaining)
          ),
        ]);
        strategiesAttempted.push(strategy.id);

        // D-07: confidence check for 'default' mode
        if (mode === 'default' && result.source === 'defuddle') {
          const content = result.markdown || '';
          if (content.length < 500) {
            // Low confidence — continue to fallback (Readability)
            continue;
          }
        }

        // D-19: redact before returning
        if (result.markdown) {
          result.markdown = redactSensitive(result.markdown);
        }

        // Build PageContext (D-12)
        const pageContext: PageContext = mode === 'default'
          ? { mode: 'default', markdown: result.markdown || '', ...this.buildMetadata(serialized.data, result) }
          : { mode: 'actionable', apcLiteTree: result.root!, ...this.buildMetadata(serialized.data, result) };

        return { ok: true, pageContext };

      } catch (e) {
        strategiesAttempted.push(strategy.id);
        // Continue to next strategy in fallback chain
        continue;
      }
    }

    return { ok: false, error: { code: 'NO_CONTENT', message: 'All strategies failed', strategiesAttempted } };
  }

  private async requestContentFromTab(tabId: number): Promise<...> {
    // Uses MessageBus + chrome.tabs.sendMessage
    // Sends EXTRACT_PAGE_CONTENT envelope to content script
    // Content script returns SerializedPage via sendResponse (D-04)
  }

  private buildMetadata(serialized: SerializedPage, result: StrategyResult): BaseMetadata {
    return {
      url: serialized.url,
      title: serialized.title,
      capturedAt: serialized.capturedAt,
      size: serialized.size,
      source: result.source,
      extractionLevel: result.truncated ? 'truncated' : 'full',
      truncated: result.truncated,
      author: result.meta?.author,
      language: result.meta?.language,
      description: result.meta?.description,
      siteName: result.meta?.siteName,
      publishDate: result.meta?.publishDate,
    };
  }
}
```

### MessageBus Integration in Content Script

```typescript
// Source: D-03, D-04, D-06
// entrypoints/content.core.ts (migrated)
import { createEnvelope } from '@/core/runtime/RuntimeEnvelope';
import { register, init } from '@/core/messaging/MessageBus';
import { serializePage } from '@/core/content/DomSerializer';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  world: 'ISOLATED',
  main() {
    if (!document.body) return;

    // Initialize MessageBus for incoming EXTRACT_PAGE_CONTENT
    init();

    // D-04: EXTRACT_PAGE_CONTENT handler — synchronous response
    register('EXTRACT_PAGE_CONTENT', (_envelope, _sender) => {
      // Note: sendResponse handled by MessageBus.init()
      // Return serialized page synchronously
      const serialized = serializePage(document);
      return serialized; // MessageBus.init() passes to sendResponse
    });

    // D-03: SPA navigation detection → outbound event via RuntimeEnvelope
    let lastUrl = location.href;
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        const envelope = createEnvelope('SPA_NAVIGATION', {
          url: location.href,
          timestamp: Date.now(),
        }, 'content');
        chrome.runtime.sendMessage(envelope).catch(() => {});
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    document.addEventListener('wxt:locationchange', () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        const envelope = createEnvelope('SPA_NAVIGATION', {
          url: location.href,
          timestamp: Date.now(),
        }, 'content');
        chrome.runtime.sendMessage(envelope).catch(() => {});
      }
    });

    // D-03: CONTENT_SCRIPT_READY removed — not needed
    return () => {
      observer.disconnect();
    };
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw `chrome.runtime.sendMessage({ type: 'SPA_NAVIGATION', ... })` | `createEnvelope('SPA_NAVIGATION', payload, 'content')` | Phase 4a (D-03) | Type safety, operation IDs for diagnostics, source tracking |
| `CONTENT_SCRIPT_READY` event | Removed entirely | Phase 4a (D-03) | Dead message removed; extraction triggered on-demand |
| No page content in context | `PageContext` discriminated union feeding ContextOptimizerInput | Phase 4a | AI gets page content as structured context |
| No extraction library | defuddle v0.19.2 (primary) + @mozilla/readability v0.6.0 (fallback) | Phase 4a | Layered fallback strategy, standardized output |
| No per-tab content index | MiniSearch v7.2.0 ephemeral per-tab index | Phase 4a | Heading-aware chunked retrieval for token-budgeted injection |

**Deprecated/outdated:**
- `CONTENT_SCRIPT_READY` message type: removed per D-03. Extraction is on-demand, not eagerly signaled.
- Raw `chrome.runtime.sendMessage` in content scripts: replaced by RuntimeEnvelope + MessageBus pattern (D-03).
- `AxDomWalker` naming (spec reference): renamed to `DomSerializer` to avoid accessibility-tree confusion (D-02).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | DOMParser is available in `chrome-extension://` extension page contexts | Standard Stack, Common Pitfalls | If unavailable in side panel / full app contexts, strategies cannot construct documents from HTML strings; would need linkedom or happy-dom fallback, which adds ~200KB |
| A2 | defuddle browser variant (`import Defuddle from 'defuddle'`) works with DOMParser-constructed documents | Standard Stack, Code Examples | If defuddle requires a "live" document (not DOMParser-created), would need to use `defuddle/node` variant with a DOM shim |
| A3 | WXT tree-shakes entrypoints correctly so defuddle/readability only appear in extension page bundles, not content script | Architecture Patterns, Common Pitfalls | If WXT's bundler (Vite) incorrectly includes extraction libraries in content script, bundle exceeds 50KB and violates D-20 |
| A4 | `~500 chars` is a reasonable low-confidence threshold for Readability fallback | Common Pitfalls | Too high → falls back unnecessarily; too low → may pass through empty/low-quality content |
| A5 | MiniSearch `boost` option on `headingText`/`headingPath` fields sufficiently implements D-15 heading-aware scoring | Code Examples | If BM25 field boost alone doesn't provide enough heading weighting, may need custom scoring function |
| A6 | SPA navigation detection via MutationObserver + `wxt:locationchange` catches all navigation events | Architecture Patterns | If some SPA frameworks use History API without triggering MutationObserver or locationchange, cache invalidation may miss navigations |

## Open Questions (RESOLVED)

1. **DOMParser in extension page contexts — availability confirmed?** **RESOLVED:** Treat as confirmed per spec §26.4. Verify in Phase 4a Wave 0: write a test that constructs `new DOMParser().parseFromString('<html></html>', 'text/html')` and check `document.querySelector`. If unavailable, fall back to linkedom (lighter than JSDOM).

2. **defuddle `markdown: true` output quality vs. separate HTML→Markdown conversion?** **RESOLVED:** Start with defuddle core bundle + `markdown: true`. If Markdown quality is insufficient, evaluate `defuddle/full` for `separateMarkdown` or a dedicated HTML→Markdown converter like turndown.

3. **Heading chunking boundary behavior — how to handle non-heading document starts?** **RESOLVED:** Use a "(preamble)" heading path for content before the first heading. Include it in the index with a lower boost weight (1.0 vs. 2.0 for real headings) so heading-matched content still ranks higher.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | vitest, WXT build | ✓ | v22 (project configured) | — |
| pnpm | Package management | ✓ | latest (package.json lock) | — |
| DOMParser (Web API) | All strategies (D-05) | ✓ (in extension pages) | Built-in Chrome | linkedom if unavailable |
| crypto.randomUUID() | Operation IDs | ✓ | Built-in Chrome | — |
| chrome.runtime.sendMessage | Content script → extension pages | ✓ | Built-in Chrome API | — |
| MessageBus + RuntimeEnvelope | Cross-context messaging | ✓ | Already implemented (Phase 1) | — |
| redactSensitive | D-19 redaction | ✓ | Already implemented (Phase 2) | — |
| ContextOptimizer + TokenBudget | Page content injection (D-16) | ✓ | Already implemented (Phase 4) | — |

**Missing dependencies with no fallback:**
- None — all runtime dependencies are either already in the project or provided by the Chrome MV3 platform.

**Missing dependencies with fallback:**
- None requiring a fallback at this time.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest v3.x (configured in vitest.config.ts) |
| Config file | vitest.config.ts (jsdom environment, chrome mocks in tests/setup.ts) |
| Quick run command | `pnpm run verify:phase-4a` |
| Full suite command | `pnpm run test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAGE-01 | Defuddle extracts clean Markdown with footnotes/math/code preserved | unit | `vitest run tests/core/extraction/DefuddleStrategy.test.ts -t "extracts markdown"` | ❌ Wave 0 |
| PAGE-01 | Readability fallback when Defuddle low-confidence (< 500 chars) | unit | `vitest run tests/core/extraction/DefuddleStrategy.test.ts -t "fallback on low confidence"` | ❌ Wave 0 |
| PAGE-01 | APC-lite DOM+ARIA walk produces APCLiteNode tree | unit | `vitest run tests/core/extraction/ApcLiteStrategy.test.ts -t "builds APCLiteNode tree"` | ❌ Wave 0 |
| PAGE-01 | PageIndexBuilder creates ephemeral per-tab MiniSearch index | unit | `vitest run tests/core/extraction/PageIndexBuilder.test.ts -t "creates ephemeral index"` | ❌ Wave 0 |
| PAGE-01 | Per-tab cache invalidates on SPA_NAVIGATION | integration | `vitest run tests/core/extraction/PageContentService.test.ts -t "invalidates on SPA navigation"` | ❌ Wave 0 |
| PAGE-01 | Content bundle < 50KB with no React/AntD/defuddle/yaml | integration | `vitest run tests/isolation/no-content-script-ui.test.ts` | ❌ Wave 0 |
| PAGE-01 | Password fields never captured (isPassword ⇒ value omitted) | unit | `vitest run tests/core/content/DomSerializer.test.ts -t "redacts password values"` | ❌ Wave 0 |
| PAGE-01 | 5s global timeout across fallback chain | unit | `vitest run tests/core/extraction/PageContentService.test.ts -t "respects global timeout"` | ❌ Wave 0 |
| PAGE-01 | TraceRedactor-style redaction before indexing | unit | `vitest run tests/core/extraction/PageContentService.test.ts -t "redacts sensitive content"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm run verify:phase-4a`
- **Per wave merge:** `pnpm run test` (full suite)
- **Phase gate:** `pnpm run verify:phase-4a` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/core/extraction/DefuddleStrategy.test.ts` — covers PAGE-01 Defuddle primary extraction + confidence fallback
- [ ] `tests/core/extraction/ApcLiteStrategy.test.ts` — covers PAGE-01 APC-lite DOM+ARIA tree construction
- [ ] `tests/core/extraction/PageIndexBuilder.test.ts` — covers PAGE-01 MiniSearch index with heading-aware chunks
- [ ] `tests/core/extraction/PageContentService.test.ts` — covers PAGE-01 full integration: cache, fallback, timeout, redaction, concurrency guard
- [ ] `tests/core/content/DomSerializer.test.ts` — covers PAGE-01 password redaction, size cap, truncated flag
- [ ] `tests/isolation/no-content-script-ui.test.ts` — covers PAGE-01 bundle isolation (< 50KB, no React/AntD/defuddle/yaml)
- [ ] `tests/core/content/PageContextBridge.test.ts` — covers PAGE-01 MessageBus EXTRACT_PAGE_CONTENT handler
- [ ] `tests/core/extraction/strategies/ReadabilityFallback.test.ts` — covers PAGE-01 Readability fallback path

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — content extraction does not handle user authentication |
| V3 Session Management | No | N/A — content extraction does not manage user sessions |
| V4 Access Control | No | N/A — content extraction does not enforce access control |
| V5 Input Validation | Yes — HTML input from untrusted web pages | DOMParser (browser-native parser with sandboxing); Zod schema validation at module boundaries (APCLiteNodeSchema, PageContext); size cap on serialized HTML (~2MB) |
| V6 Cryptography | No | N/A — no cryptographic operations in extraction layer |
| V7 Error Handling & Logging | Yes — extraction failures must not leak page content | `redactSensitive()` before logging (D-19); `ExtractionError` discriminated union with structured error codes; `debugLog` pattern from existing codebase; no raw HTML in error messages |
| V8 Client-Side (V8.3 Sensitive Data) | Yes — password field values | DomSerializer redacts password field `value` at capture time (D-02); TraceRedactor-style redaction of API keys, tokens, emails in extracted text (D-19); ephemeral indexes never persisted (D-14) |

### Known Threat Patterns for Chrome Extension Content Extraction

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Password fields with non-standard markup (e.g., `type=text` + `autocomplete=current-password`) not caught by `input[type=password]` | Information Disclosure | D-02 heuristics: check `[isPassword]` attribute, `autocomplete=current-password`, AND name patterns (`/password|passwd|pwd/i`). Err on side of false positives. |
| Cross-site script injection through extracted HTML when rendered in extension UI | Tampering | DOMPurify on rendered output (Phase 7); CSP in extension pages; `@ant-design/x-markdown` sanitizes input. Extraction layer doesn't render — it only produces strings. |
| Leakage of API keys, JWT tokens, or bearer tokens from page content into AI context | Information Disclosure | D-19: `redactSensitive()` from `src/core/security/redactSensitive.ts` runs on all extracted text before it enters MiniSearch index or ContextOptimizer. Patterns: JWT, Bearer, api_key, JSESSIONID. |
| IndexedDB persistence of page content creating discoverable privacy history | Information Disclosure | D-14: MiniSearch indexes are ephemeral (in-memory only). Never written to IndexedDB or chrome.storage. Destroyed on tab close. |
| Large HTML payloads causing OOM in extension page | Denial of Service | D-01 size cap (~2MB) on serialized HTML. Defuddle/Readability timeout (5s D-10). Concurrency guard coalesces duplicate extractions (D-18). |
| Content script sending DOM snapshots without user intent | Information Disclosure | Extraction is on-demand only (EXTRACT_PAGE_CONTENT request); no background polling of page content. SPA_NAVIGATION sends URL only, not content. |

## Sources

### Primary (HIGH confidence)
- [npmjs.com/package/defuddle] — defuddle v0.19.2 API documentation: `new Defuddle(document).parse()`, markdown option, metadata extraction, HTML standardization
- [npmjs.com/package/@mozilla/readability] — @mozilla/readability v0.6.0 API documentation: `new Readability(document).parse()`, DOM cloning recommendation, options (charThreshold, serializer)
- [npmjs.com/package/minisearch] — MiniSearch v7.2.0 API documentation: BM25 ranking, field boosting, prefix/fuzzy search, `addAll`, `search`, `removeById`
- [PRODUCT_SPEC_v0_1.md §26] — PageContentService specification: layered strategy order, strategy contract, content-bundle constraint, MiniSearch integration, reliability & privacy
- [PRODUCT_SPEC_v0_1.md Appendix C] — APCLiteNode, RawNode, APCLiteDocument Zod schemas; IExtractionStrategy, StrategyInput, StrategyResult interfaces
- [CONTEXT.md D-01 through D-20] — Locked implementation decisions from discuss-phase
- [npm registry verification] — All three packages confirmed existing on npm with correct versions, no postinstall scripts, established age and download counts
- [src/core/runtime/RuntimeEnvelope.ts] — Existing envelope pattern: `createEnvelope()`, `isEnvelope()`, `MessageTypeValues` (includes `EXTRACT_PAGE_CONTENT` and `SPA_NAVIGATION`)
- [src/core/messaging/MessageBus.ts] — Existing messaging pattern: `register()`, `init()`, `dispatch()` — used for cross-context communication
- [src/core/security/redactSensitive.ts] — Existing redaction function: `redactSensitive()` with JWT, Bearer, API key, JSESSIONID patterns — reused for D-19
- [src/core/context/ContextOptimizer.ts] — Existing integration point: `buildPageContextSection()` with sourceId `context.page.current`
- [vitest.config.ts + tests/setup.ts] — Existing test infrastructure: jsdom environment, chrome storage mocks, BroadcastChannel mock

### Secondary (MEDIUM confidence)
- [github.com/kepano/defuddle] — Source repository (MIT license) [CITED: npmjs.com/package/defuddle]
- [github.com/mozilla/readability] — Source repository (Apache-2.0 license) [CITED: npmjs.com/package/@mozilla/readability]
- [github.com/lucaong/minisearch] — Source repository (MIT license) [CITED: npmjs.com/package/minisearch]
- [tests/isolation/cross-entrypoint-imports.test.ts] — Existing isolation test pattern to model `no-content-script-ui.test.ts` after

### Tertiary (LOW confidence)
- Bundle sizes (defuddle ~45KB, readability ~40KB, minisearch ~12KB) — based on training knowledge, not verified via bundlephobia in this session [ASSUMED]
- DOMParser guaranteed availability in extension page contexts — treated as confirmed per spec §26.4 but not independently tested [ASSUMED]

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all three packages verified via npm registry + npmjs.com documentation
- Architecture: HIGH — patterns dictated by PRODUCT_SPEC §26, CONTEXT.md D-01 through D-20, and existing codebase patterns (RuntimeEnvelope, MessageBus, ContextOptimizer)
- Pitfalls: HIGH — based on Mozilla Readability docs (DOM mutation), Chrome MV3 service worker limitations, and existing codebase patterns for isolation testing

**Research date:** 2026-07-31
**Valid until:** 2026-08-30 (30 days — extraction libraries are stable; defuddle may update minor version)
