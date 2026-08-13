# Phase 4a: PageContentService (Knowledge Acquisition) - Pattern Map

**Mapped:** 2026-08-12
**Files analyzed:** 19 (11 new §18 create-list + 2 extend + 5 tests + 1 fixture)
**Analogs found:** 14 / 19 (2 greenfield: PageIndexBuilder + its test; 3 spec-verbatim type files reference spec excerpts instead of codebase files)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/extraction/PageContentService.ts` | service | request-response + event-driven (coalescing, invalidation) | `src/core/ai/StructuredOutput.ts` (timeout/abort), `src/core/context/ContextOptimizer.ts` (typed error terminal) | role-match |
| `src/core/extraction/apcLite.types.ts` | model | — (types + Zod, spec verbatim) | `src/core/context/ContextProvenanceManifest.ts` (zod co-location) + **Appendix C.1 verbatim** | exact (zod pattern) |
| `src/core/extraction/strategies/IExtractionStrategy.ts` | model | — (interface, spec verbatim) | **Appendix C.1 L4680-4700 + §26.3 L3772-3778 verbatim** (no codebase analog — spec-only contract) | spec-verbatim |
| `src/core/extraction/strategies/DefuddleStrategy.ts` | service | transform (HTML→clean HTML→markdown) | `src/core/ai/providers/OpenAIProvider.ts` (interface impl shape) + RESEARCH Pattern 3 | partial |
| `src/core/extraction/strategies/ApcLiteStrategy.ts` | service | transform (RawNode→APCLiteDocument) | `src/core/ai/providers/*Provider.ts` (interface impl shape) + zod boundary gate | partial |
| `src/core/extraction/PageContentSerializer.ts` | utility | transform (HTML→markdown) | `src/core/security/TraceRedactor.ts` (pure module-level singleton fn) | partial |
| `src/core/extraction/PageIndexBuilder.ts` | service | batch (chunk + index) | **none — greenfield** (MiniSearch not yet installed) | no analog |
| `src/core/extraction/PageContentCache.ts` | store | CRUD + LRU eviction | `src/core/registry/PageRegistry.ts` (tab-keyed Map) + `src/core/utils/RateLimiter.ts` (pinned constants) | role-match |
| `src/core/content/AxDomWalker.ts` | utility | transform (DOM walk, content-side) | `ContentScriptHost.buildLiveContext()` L91-102 (content-side DOM read) | partial |
| `src/core/content/PageContextBridge.ts` (EXTEND) | bridge | request-response (messaging) | itself (Phase-1 file, L1-113) | exact (self-extend) |
| `src/core/content/ContentScriptHost.ts` (EXTEND) | content host | request-response | itself (Phase-1 file, L1-103) | exact (self-extend) |
| `src/core/content/SPANavigationWatcher.ts` | hook | event-driven | `src/core/background/BackgroundRouter.ts` (register pattern) + RESEARCH Common Op 5 | partial |
| `src/core/error/errorCodes.ts` (MODIFY) | config | — (D-4a-22 rename) | itself (in-place registry extension) | exact |
| `tests/core/extraction/PageContentService.test.ts` | test | — (coalescing, timeout, typed failure) | `tests/core/ai/StructuredOutput.timeoutRetry.test.ts` + `tests/core/content/ContentScriptHost.test.ts` | role-match |
| `tests/core/extraction/DefuddleStrategy.test.ts` | test | — (fixture-driven extraction) | `tests/core/context/ContextProvenanceManifest.test.ts` (zod validation) | partial |
| `tests/core/extraction/ApcLiteStrategy.test.ts` | test | — (fixture-driven + password invariant) | `tests/core/context/ContextProvenanceManifest.test.ts` + `tests/core/security/redactSensitive.test.ts` | partial |
| `tests/core/extraction/PageIndexBuilder.test.ts` | test | — (chunking) | **none — greenfield** | no analog |
| `tests/isolation/no-content-script-ui.test.ts` (EXTEND) | test | — (bundle gate) | itself + `tests/isolation/check-content-bundle.mjs` (fold-in, D-4a-23) | exact |
| `tests/fixtures/pageContent.ts` (NEW) | fixture | — (golden HTML, D-4a-24) | `tests/fixtures/index.ts` (deterministic typed builders) | exact |

## Pattern Assignments

### `src/core/extraction/PageContentService.ts` (service, request-response + coalescing)

**Analog:** `src/core/ai/StructuredOutput.ts` (typed-error carrier + AbortController), `src/core/context/ContextOptimizer.ts` (typed terminal), spec **Appendix O.12 L6736-6768** (extractLayered verbatim, adapted per D-4a-22).

**Core extractLayered pattern — O.12 VERBATIM with D-4a-22 adaptation** (spec L6747-6768; `EXTRACTION_FAILED` → `CONTENT_EXTRACT_FAILED`, `debugLog` import path `@/core/error/debugLog` not `@/core/log/debugLog`):
```typescript
export interface ExtractionOutcome {
  result: StrategyResult;
  sourceUsed: StrategyResult['source'];   // provenance — which layer won
  fallbacksTried: string[];
}

export async function extractLayered(
  input: StrategyInput,
  strategies: IExtractionStrategy[],      // ordered: Defuddle → Readability → APC-lite → ServiceNow API
): Promise<ExtractionOutcome> {
  const tried: string[] = [];
  for (const s of strategies) {
    if (!s.canHandle({ url: input.url, mode: input.mode })) continue;
    try {
      const result = await s.run(input);
      // Accept the first strategy that returns usable content.
      if ((result.markdown && result.markdown.length > 0) || result.root) {
        return { result, sourceUsed: result.source, fallbacksTried: tried };
      }
      tried.push(s.id);
    } catch (e: unknown) {
      tried.push(s.id);
      debugLog(ERROR_CODES.CONTENT_EXTRACT_FAILED, e instanceof Error ? e.message : 'strategy error', {
        module: 'PageContentService', extra: { strategy: s.id, url: input.url },
      });
    }
  }
  const err = new Error('no strategy produced content') as Error & { code: string; fallbacksTried: string[] };
  err.code = ERROR_CODES.CONTENT_EXTRACT_FAILED;   // D-4a-22: canonical §16 code, NOT 'EXTRACTION_FAILED'
  err.fallbacksTried = tried;
  throw err;
}
```
*Note: O.12 is a pure function. The Phase-4a `PageContentService` class wraps it with the D-4a-03 coalescing + 5 s timeout + invalidation — keep `extractLayered` as the exported core and add the per-tab in-flight promise map around it.*

**Typed error carrier pattern** (for `CONTENT_EXTRACT_FAILED` — copy the StructuredOutput precedent shape, `src/core/ai/StructuredOutput.ts` L79-90):
```typescript
export interface StructuredOutputFailedError extends Error {
  code: 'STRUCTURED_OUTPUT_FAILED';
  retryable: false;
  raw: { first: string; second: string };
}
/** Guard: distinguishes the canonical failure from other errors. */
export function isStructuredOutputFailed(err: unknown): err is StructuredOutputFailedError {
  return err instanceof Error && (err as StructuredOutputFailedError).code === 'STRUCTURED_OUTPUT_FAILED';
}
```
→ 4a: `isContentExtractFailed(err)` guard with `code: 'CONTENT_EXTRACT_FAILED'`, `fallbacksTried: string[]` carrier.

**Timeout/AbortController pattern** — `src/core/ai/StructuredOutput.ts` L107-118 (single AbortController threaded through, timeout classified distinctly):
```typescript
const attempt = async (secs: PromptSection[]): Promise<string> => {
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  ctx.abortSignal.addEventListener('abort', onAbort);
  let timedOut = false;
  const to = setTimeout(() => {
    timedOut = true;
    ac.abort(timeoutError(ctx.timeoutMs));
  }, ctx.timeoutMs);
  try {
    return await ctx.callProviderJsonMode(secs, jsonSchema, ac.signal);
  } finally {
    clearTimeout(to);
    ctx.abortSignal.removeEventListener('abort', onAbort);
  }
};
```
→ 4a: `EXTRACTION_TIMEOUT_MS = 5000` (spec §22.1 line 3564), single AbortController per extraction round-trip (D-4a-03).

**Error logging pattern** (GR-9, every catch) — `src/core/error/debugLog.ts` L26-44, always with canonical code:
```typescript
debugLog(ERROR_CODES.CONTENT_EXTRACT_FAILED, 'no strategy produced content', {
  error: err instanceof Error ? err : undefined,
  module: 'PageContentService',
});
```

### `src/core/extraction/apcLite.types.ts` (model — spec VERBATIM, R-1)

**Source:** Appendix C.1 spec **L4411-4464** — copy verbatim (`RawNode`, `GeometrySchema`, `InteractionSchema`, `FormControlSchema` with the password `.refine` invariant, `APCLiteNode`, `APCLiteNodeSchema` with `z.lazy` recursion, `APCLiteDocumentSchema`, `APCLiteDocument`). Do NOT re-derive.

**Imports + header convention** — copy from `src/core/context/ContextProvenanceManifest.ts` L1-18 (R-1 header + zod co-location):
```typescript
// src/core/context/ContextProvenanceManifest.ts — Source: PRODUCT_SPEC §2.6 ... (lines 516-534, verbatim)
// R-1: single declaration — consumers import (never re-declare) it.
import { z } from 'zod';
```
→ 4a header: `// src/core/extraction/apcLite.types.ts — Source: Appendix C.1 (verbatim, lines 4411-4464). R-1 canonical home.` + `import { z } from 'zod';`

**Password invariant (D-4a-20)** — the `.refine` gate is already in the spec excerpt (L4432-4435) — never loosened:
```typescript
export const FormControlSchema = z.object({
  fieldName: z.string().optional(), fieldType: z.string().optional(),
  value: z.string().optional(), isPassword: z.boolean().optional(),
}).refine(c => !(c.isPassword && c.value !== undefined), 'password value must be omitted');
```

### `src/core/extraction/strategies/IExtractionStrategy.ts` (model — spec VERBATIM)

**Source:** Appendix C.1 spec **L4680-4700** + §26.3 **L3772-3778**. The §26.3 `id` union (`'defuddle' | 'apc-lite' | 'servicenow-api'`) and the C.1 `StrategyResult['source']` union (`'defuddle' | 'readability' | 'apc-lite' | 'servicenow-api'`) both appear — **declare both verbatim; D-4a-17 reserves `'servicenow-api'` in the union, NOT implemented**:
```typescript
import type { APCLiteNode } from './apcLite.types';
export interface StrategyInput {
  url: string; title: string; mode: 'default' | 'actionable';
  html?: string;   // present for DefuddleStrategy (default/read mode)
  raw?: RawNode;   // present for ApcLiteStrategy (actionable mode)
}
export interface StrategyResult {
  source: 'defuddle' | 'readability' | 'apc-lite' | 'servicenow-api';
  markdown?: string;      // prose path (Defuddle/Readability)
  root?: APCLiteNode;     // structural path (APC-lite)
  meta?: Record<string, string>;
  approxTokens: number;
  truncated: boolean;
}
export interface IExtractionStrategy {
  id: StrategyResult['source'];
  canHandle(i: { url: string; mode: 'default' | 'actionable' }): boolean;
  run(i: StrategyInput): Promise<StrategyResult>;
}
```
*Note: `RawNode` is declared in `apcLite.types.ts` (same dir), import from `../apcLite.types`.*
*Design point for planner: §26.2 places the Readability fallback INSIDE the Defuddle path ("DefuddleStrategy → low confidence? → Readability fallback"). Since §18 names no `ReadabilityStrategy.ts` file, implement the fallback inside `DefuddleStrategy.run()` — return `source: 'readability'` when the fallback wins (source union already permits it).*

### `src/core/extraction/strategies/DefuddleStrategy.ts` (service, transform)

**Analog (shape):** `src/core/ai/providers/OpenAIProvider.ts` (implements `ILLMProvider` — same interface-impl pattern: `id` field + `canHandle` gate + `run` method).

**Class skeleton — copy the IExtractionStrategy impl shape** (RESEARCH Pattern 3):
```typescript
import Defuddle from 'defuddle';
import type { IExtractionStrategy, StrategyInput, StrategyResult } from './IExtractionStrategy';

function parseDetached(html: string, baseUrl: string): Document {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // D-4a-08: DOMParser docs have baseURI === 'about:blank'; Readability resolves
  // relative URLs via document.baseURI, so inject the real base.
  const base = doc.createElement('base');
  base.href = baseUrl;
  doc.head.prepend(base);
  return doc;
}

export class DefuddleStrategy implements IExtractionStrategy {
  id = 'defuddle' as const;
  canHandle({ mode }: { url: string; mode: 'default' | 'actionable' }): boolean {
    return mode === 'default'; // D-4a-14 mode gating
  }
  async run(input: StrategyInput): Promise<StrategyResult> {
    if (!input.html) throw new Error('DefuddleStrategy requires html');
    const doc = parseDetached(input.html, input.baseUrl ?? input.url);
    const defuddle = new Defuddle(doc, { url: input.url });
    const result = defuddle.parse(); // content = clean HTML string (NOT markdown — verified)
    // D-4a-18 threshold → Readability fallback on a FRESH CLONE (Pitfall 2) → return source: 'readability'
    return {
      source: 'defuddle',
      markdown: '', // PageContentSerializer converts (turndown) — see PageContentSerializer
      meta: { defuddleHtml: result.content, title: result.title, wordCount: String(result.wordCount) },
      approxTokens: estimateTokens(result.content),   // from '@/core/context/TokenBudget' L36
      truncated: false,
    };
  }
}
```
**Readability fallback (Pitfall 2 — parse() mutates, ALWAYS clone)** — RESEARCH Common Operation 2:
```typescript
import { Readability } from '@mozilla/readability';
const documentClone = doc.cloneNode(true) as Document; // parse() mutates — ALWAYS clone
const article = new Readability(documentClone, { charThreshold: 500 }).parse();
if (article) {
  // article.content = HTML string → turndown → markdown; record source: 'readability'
}
```
**Token estimation** — `src/core/context/TokenBudget.ts` L36 `export function estimateTokens(text: string): number` (the ONLY token counter in the codebase — StructuredOutput.ts L43 precedent; do not hand-roll a second counter).

### `src/core/extraction/strategies/ApcLiteStrategy.ts` (service, transform)

**Analog (shape):** same interface-impl pattern as DefuddleStrategy + zod boundary gate from `src/core/context/ContextProvenanceManifest.ts` L17-18.

**Core pattern — RawNode → zod-validated APCLiteDocument** (D-4a-11 full schema, D-4a-12 walk on actionable only, D-4a-19 fallback record):
```typescript
import { APCLiteDocumentSchema, type APCLiteDocument } from '../apcLite.types';
import type { IExtractionStrategy, StrategyInput, StrategyResult } from './IExtractionStrategy';

export class ApcLiteStrategy implements IExtractionStrategy {
  id = 'apc-lite' as const;
  canHandle({ mode }: { url: string; mode: 'default' | 'actionable' }): boolean {
    return mode === 'actionable';   // D-4a-14: gated, not default
  }
  async run(input: StrategyInput): Promise<StrategyResult> {
    if (!input.raw) throw new Error('ApcLiteStrategy requires raw');
    // RawNode (from content-side AxDomWalker) → normalized APCLiteDocument
    // geometry stays UNSET in v0.1 (D-4a-13); stats = duration, node/char count, source, truncated (D-4a-21)
    const doc = APCLiteDocumentSchema.parse({ url: input.url, title: input.title, extractedAt: Date.now(), source: 'dom', root: normalize(input.raw), stats: { ... } });
    return { source: 'apc-lite', root: doc.root, approxTokens: doc.stats.approxTokens, truncated: doc.stats.truncated };
  }
}
```
**Invariant:** `isPassword ⇒ value omitted` is enforced AT CAPTURE by the content-side AxDomWalker + re-validated at this boundary by `FormControlSchema.refine` (D-4a-20, defense-in-depth).

### `src/core/extraction/PageContentSerializer.ts` (utility, transform)

**Analog:** `src/core/security/TraceRedactor.ts` L10-29 (module-level singleton + exported pure function — the whole file is the pattern).

**Core pattern** (RESEARCH Pattern 4 — config verified against defuddle's own markdown.js):
```typescript
// src/core/extraction/PageContentSerializer.ts
import TurndownService from 'turndown';

const TURNDOWN_OPTIONS = {
  headingStyle: 'atx',
  hr: '---',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  preformattedCode: true,
} as const;

const turndown = new TurndownService(TURNDOWN_OPTIONS);

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}
```
**Also produces `PageContext`** (populates `PageContext.html`/`PageContext.markdown` — the R-1 home `src/core/content/PageContext.ts` L4-15 whose fields are populated by 4a).

### `src/core/extraction/PageIndexBuilder.ts` (service, batch — GREENFIELD)

**No codebase analog.** Use RESEARCH Pattern 5 (MiniSearch v7 API verified) — chunking is D-4a-16 heading-boundary logic (new, no precedent):
```typescript
import MiniSearch from 'minisearch';

// D-4a-16 doc shape: fields indexed + stored; idField defaults to 'id'
export interface PageChunk {
  id: string;               // `${tabId}:${sectionPath}:${chunkIndex}`
  title: string;
  url: string;
  headingPath: string;      // breadcrumb e.g. 'Work KB > ServiceNow > Incident'
  sectionText: string;
}

export function buildPageIndex(chunks: PageChunk[]): MiniSearch {
  const mini = new MiniSearch({
    fields: ['title', 'url', 'headingPath', 'sectionText'],
    storeFields: ['title', 'url', 'headingPath', 'sectionText'],
  });
  mini.addAll(chunks);
  return mini;
}
// query: mini.search(query, { prefix: true, boost: { title: 2, headingPath: 1.5 } })
```
**Lazy build + eviction discipline (D-4a-15):** build memoized per tab on first `query()`, never persisted (§26.5) — same in-memory-only posture as `PageContentCache`.

### `src/core/extraction/PageContentCache.ts` (store, CRUD + LRU)

**Analog:** `src/core/registry/PageRegistry.ts` L10-33 (tab-keyed Map with synchronous idempotent ops — the D-4a-02 distinction is that PageRegistry keeps live title/URL context, PageContentCache holds extracted content + index):

**Imports pattern** — `src/core/registry/PageRegistry.ts` L1-8:
```typescript
import type { PageContext } from '@/core/content/PageContext';
```

**Core CRUD skeleton — copy from PageRegistry** (extend with LRU + in-flight map + eviction):
```typescript
export class PageRegistry {
  private pages = new Map<number, PageContext>();
  /** Idempotent — upserting the same tab replaces atomically. */
  upsert(tabId: number, page: PageContext): void { this.pages.set(tabId, page); }
  get(tabId: number): PageContext | undefined { return this.pages.get(tabId); }
  remove(tabId: number): void { this.pages.delete(tabId); }
  clear(): void { this.pages.clear(); }
}
```
**Pinned-constant pattern (D-4a-04 / Appendix C constant)** — `src/core/utils/RateLimiter.ts` L19-23 (named constants, never magic numbers):
```typescript
export const DEFAULT_CAPACITY = 10;
export const DEFAULT_REFILL_PER_SECOND = 2;
```
→ 4a: `export const PAGE_CACHE_MAX_TABS = 20;` + `EXTRACTION_TIMEOUT_MS = 5000;` (D-4a-03/04; planner pins + documents in Appendix C).
**D-4a-03 stale-safe coalescing (no existing in-flight map in codebase — new pattern):** per-tab `Map<number, Promise<...>>`; reads after invalidation `await` the in-flight promise; single `AbortController` per round-trip; eviction drops cache + index together (`tabs.onRemoved` / invalidation / LRU), never LRU-evict in-flight or subscribed; pinned eviction-last (D-4a-04). Recency bumped on every read/serve.

### `src/core/content/AxDomWalker.ts` (utility, content-side DOM walk)

**Analog:** `ContentScriptHost.buildLiveContext()` (`src/core/content/ContentScriptHost.ts` L91-102) — content-side DOM reading precedent.

**Content-side dependency-free header (CRITICAL — copy the ContentScriptHost header convention, L1-6):**
```typescript
// src/core/content/ContentScriptHost.ts — Dependency-free core (Pitfall 4): no React, no antd, no zustand.
```
→ 4a header: dependency-free (Appendix G), imports ONLY: `FormControlSchema`/`RawNode`/`APCLiteNode` types from `@/core/extraction/apcLite.types` (type-only — check import cost; if the zod runtime import threatens the 50 KB bundle, keep type-only and construct plain objects; zod schemas are used content-side for `FormControlSchema.refine` per D-4a-20 — planner verifies bundle impact).

**Core pattern (D-4a-12/13/20):** walk `document.documentElement` → `RawNode[]`; emit roles/text/hierarchy + interaction flags (clickable/editable/focusable/disabled) + links + tables; `isPassword ⇒ value omitted` at capture; **geometry NEVER read in v0.1** (D-4a-13 — no `getBoundingClientRect`).

### `src/core/content/PageContextBridge.ts` (EXTEND — messaging bridge)

**Analog: itself** (Phase-1 file, L1-113). Extend with the canonical extraction request/reply flow.

**Existing envelope factory — keep (L95-101):**
```typescript
private envelope(
  type: MessageTypeValue,
  payload: unknown,
  id: string = createOperationId(),
): RuntimeEnvelope<unknown> {
  return { id, type, createdAt: Date.now(), source: 'content', payload };
}
```
**Request/reply pattern — copy `getCapabilities()` L53-72** (bounded wait, always cleared, resolves default on timeout — the T-1-14 precedent for the extraction round-trip):
```typescript
const timer = setTimeout(() => {
  unsubscribe();
  debugLog(ERROR_CODES.CONTENT_CAPABILITIES, 'capabilities handshake timed out', {
    module: 'PageContextBridge',
  });
  resolve(DEFAULT_CAPABILITIES);
}, CAPABILITIES_TIMEOUT_MS);
this.bridge.publish(this.envelope(MessageType.GET_CONTENT_CAPABILITIES, {}, opId));
```
**Reply pattern — copy `replyPong` L75-83 / `replyCapabilities` L86-88** (ResponseEnvelope, never a mutated request):
```typescript
this.bridge.publish(
  this.envelope(MessageType.PONG, {
    id: requestId, ok: true, data: { pong: true },
  } satisfies ResponseEnvelope<{ pong: true }>),
);
```
**Payload validation — copy `sanitizeCapabilities` L105-113** (validate the extraction reply payload against the shape before accepting).

**MessageType additions (Pitfall 5 — canonical, NOT throwaway):** extend `src/core/runtime/MessageType.ts` in place (Phase-1 D-17 precedent at L25-30) for the extraction request/reply types. `EXTRACT_PAGE_CONTENT` already exists (L11).

### `src/core/content/ContentScriptHost.ts` (EXTEND — content host)

**Analog: itself** (L1-103). Add: `serializeForExtraction()` (D-4a-07/08/09), wire `SPANavigationWatcher` (D-4a-01), reply to the extraction request.

**Existing handleMessage switch — extend (L68-83):**
```typescript
private handleMessage(message: RuntimeEnvelope<unknown>): void {
  switch (message.type) {
    case MessageType.EXTRACT_PAGE_CONTENT:
      this.registry.upsert(this.tabId, this.currentPage);
      break;
    ...
  }
}
```
→ 4a: `EXTRACT_PAGE_CONTENT` case now serializes + replies (per D-4a-07), keeping the live-context upsert.

**Serialization pattern (D-4a-07/08/09)** — RESEARCH Pattern 2 (dependency-free, `document_idle`, inside the 5 s AbortController budget):
```typescript
function serializeForExtraction(): { html: string; baseUrl: string; truncated: boolean } {
  const clone = document.documentElement.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script, style, noscript, svg').forEach((n) => n.remove());
  clone.querySelectorAll('iframe').forEach((n) => {
    try { if (n.contentWindow?.location.origin !== location.origin) n.remove(); }
    catch { n.remove(); } // cross-origin access throws — treat as cross-origin
  });
  clone.querySelectorAll('[formaction]').forEach((n) => n.removeAttribute('formaction'));
  const html = clone.outerHTML;
  return {
    html: html.length > PAGE_HTML_MAX_BYTES ? truncateAtElementBoundary(html, PAGE_HTML_MAX_BYTES) : html,
    baseUrl: document.baseURI, // D-4a-08 stamp
    truncated: html.length > PAGE_HTML_MAX_BYTES,
  };
}
```

### `src/core/content/SPANavigationWatcher.ts` (hook, event-driven)

**Analog (shape):** `src/core/background/BackgroundRouter.ts` `register()` pattern (background managers) — but this one runs content-side. RESEARCH Common Operation 5 (wxt 0.19.29 verified):

**Core pattern** (wxt namespaced event, `ctx.addEventListener` auto-cleans — NEVER bare `window.addEventListener`):
```typescript
// inside the content-script main (or a watcher class receiving ctx)
ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl }) => {
  // newUrl is the post-navigation URL — mark cache stale / re-extract if subscribed (D-4a-01)
});
```
**Test pitfall (RESEARCH Pitfall 4):** tests MUST dispatch the namespaced name `${runtime.id}:${entrypoint}:wxt:locationchange` — use `FIXED_EXTENSION_ID` from `tests/fixtures/index.ts` L18 + entrypoint 'core', or share a tiny namespacing helper between watcher and tests.

### `src/core/error/errorCodes.ts` (MODIFY — D-4a-22 W-1 gate)

**Analog: itself** (in-place registry extension precedent — Phase-3 L63-67, Phase-4 L87-93 headers). Rename `CONTENT_EXTRACT` (L15) → `CONTENT_EXTRACT_FAILED` **in place** with the same header-comment convention (W-1 gate re-verifies the spec mirror line-anchored):
```typescript
// --- Runtime / messaging ---
...
CONTENT_EXTRACT_FAILED: 'CONTENT_EXTRACT_FAILED',
CONTENT_CAPABILITIES: 'CONTENT_CAPABILITIES',
```
*Every existing reference to `ERROR_CODES.CONTENT_EXTRACT` (e.g. PageContextBridge L65 area, check with grep during planning) must be updated atomically.*

### Tests

#### `tests/core/extraction/PageContentService.test.ts`
**Analog:** `tests/core/ai/StructuredOutput.timeoutRetry.test.ts` (timeout/abort/retry behavior) + `tests/core/content/ContentScriptHost.test.ts` (fakeBrowser + `flushRuntime()` L27-30 pattern). Covers: coalescing (concurrent same-tab extraction deduped), stale-safe read (invalidate → read awaits in-flight, D-4a-03), 5 s timeout → `CONTENT_EXTRACT_FAILED` typed carrier, eviction order + `PAGE_CACHE_MAX_TABS` cap (P4a-1, D-4a-04).

#### `tests/core/extraction/DefuddleStrategy.test.ts` + `ApcLiteStrategy.test.ts`
**Analog:** `tests/core/context/ContextProvenanceManifest.test.ts` (zod schema validation) + `tests/core/security/redactSensitive.test.ts` (sensitive-field assertions). Both consume the SHARED golden fixtures (D-4a-24) from `tests/fixtures/pageContent.ts`. ApcLite test asserts the password-omission invariant via `FormControlSchema.refine`.

#### `tests/core/extraction/PageIndexBuilder.test.ts` (GREENFIELD)
No analog. Asserts D-4a-16: heading chunking, "(preamble)" synthetic chunk, `headingPath` breadcrumb, paragraph-block fallback for no-heading pages, sub-chunking over `INDEX_CHUNK_MAX_TOKENS` (~500).

#### `tests/isolation/no-content-script-ui.test.ts` (EXTEND — D-4a-23)
**Analog: itself** (L1-15) + `tests/isolation/check-content-bundle.mjs` (L1-168, fold its logic in). Current test is a thin `execFileSync` wrapper over the `.mjs` (L9-15); 4a retires the `.mjs` name and inlines the walker + `FORBIDDEN_TOKENS` (L36-62) + **the < 50 KB assertion with the inline-sourcemap stripped** (RESEARCH Pitfall 3 — strip the `//# sourceMappingURL` comment before measuring; wxt.config.ts L63 sets `sourcemap: 'inline'`). Token set already forbids `defuddle` (L43) + `minisearch`/`turndown` must NOT appear (bundle stays dependency-free — add tokens if the new content-side code pulls them).

#### `tests/fixtures/pageContent.ts` (NEW — D-4a-24 shared golden fixtures)
**Analog:** `tests/fixtures/index.ts` L1-54 (deterministic typed builders with `overrides` — fixed constants only, no real `Date.now`/`crypto`). One shared module consumed by DefuddleStrategy/ApcLiteStrategy/PageIndexBuilder tests + a determinism smoke test in the `fixtures.test.ts` style.

## Shared Patterns

### Error Handling (GR-9) — every catch
**Source:** `src/core/error/debugLog.ts` L26-44 + `src/core/error/errorCodes.ts`
**Apply to:** PageContentService, PageContentCache, PageContextBridge, ContentScriptHost, SPANavigationWatcher, all strategy run()s.
```typescript
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
debugLog(ERROR_CODES.CONTENT_EXTRACT_FAILED, 'message', {
  error: err instanceof Error ? err : undefined,
  module: 'PageContentService',
});
```
Rules: canonical code only (D-4a-22), never bare strings, never empty catch, never throw from debugLog.

### Typed Error Terminal (D-4a-22)
**Source:** `src/core/ai/StructuredOutput.ts` L79-90 + `src/core/context/ContextOptimizer.ts` L64-74 (`ContextTooLargeError` + `isContextTooLargeError` guard)
**Apply to:** PageContentService (the `CONTENT_EXTRACT_FAILED` carrier). `code: 'CONTENT_EXTRACT_FAILED'` + `fallbacksTried: string[]` + a type guard. Never bare `new Error` without the code.

### Zod Boundary Schemas (GR-4)
**Source:** `src/core/context/ContextProvenanceManifest.ts` L17-18 (schema co-located with the types it validates)
**Apply to:** `apcLite.types.ts` (spec verbatim) + boundary validation in ApcLiteStrategy + PageContextBridge reply sanitization (`sanitizeCapabilities` L105-113 precedent).

### R-1 Spec-Verbatim Type Homes
**Source:** `src/core/content/PageContext.ts` L1-3 (header: "Source: Appendix C (verbatim, lines …). Canonical home per R-1")
**Apply to:** `apcLite.types.ts`, `strategies/IExtractionStrategy.ts` — spec-verbatim with the line-anchored header; consumers import, never re-declare.

### Content-Bundle Isolation (Appendix G / R-5 / R-3)
**Source:** `src/core/content/ContentScriptHost.ts` L1-6 + `src/core/content/PageContextBridge.ts` L1-9 (dependency-free headers) + `tests/isolation/check-content-bundle.mjs` L36-62 (token set)
**Apply to:** AxDomWalker, serializer-in-host, SPANavigationWatcher, ContentScriptHost. Never import React/AntD/defuddle/yaml/turndown/minisearch/TraceRedactor content-side (D-4a-10). Defuddle/Readability/MiniSearch/turndown live panel-side only. Isolation test enforces; keep < 50 KB payload (strip inline sourcemap when measuring).

### Messaging Contracts (Pitfall 5)
**Source:** `src/core/runtime/MessageType.ts` L25-30 (D-17 additions precedent — canonical enum extensions) + `src/core/runtime/RuntimeEnvelope.ts` L8-20 (envelope + ResponseEnvelope)
**Apply to:** PageContextBridge extraction request/reply. New MessageTypes are canonical additions to MessageType.ts — never phase-local throwaway contracts. Replies use ResponseEnvelope; `chrome.runtime` transport via MessageBusBridge.

### Deterministic Test Fixtures (D-20/D-21)
**Source:** `tests/fixtures/index.ts` L1-28 (fixed constants, seeded or fixed IDs/timestamps — never real randomness/Date.now)
**Apply to:** `tests/fixtures/pageContent.ts` (golden HTML per D-4a-24). Direction rule (L5-6): fixtures under tests/ only, never imported from src/; type-only imports from src/ are the sole exception.

### fakeBrowser + jsdom-align Test Env
**Source:** `tests/setup.ts` L82-84 (`fakeBrowser.reset()` per test) + `tests/environments/jsdom-align.ts` + `tests/core/content/ContentScriptHost.test.ts` L27-30 (`flushRuntime()`)
**Apply to:** all extraction tests requiring chrome.* or document. Pure-Map tests (PageContentCache eviction) may use `@vitest-environment node` (PageRegistry.test.ts L8 precedent).

### verify:phase-4a Script Chain (§24)
**Source:** `package.json` L19-23 (`verify:phase-N` precedent — eslint + prettier + tsc + wxt build + vitest run + isolation check)
**Apply to:** package.json — `verify:phase-4a` per the CONTEXT discretion: target `tests/core/extraction/**` + the isolation suite; keep the same chain shape; the isolation step folds the `.mjs` into the named test (D-4a-23).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/core/extraction/PageIndexBuilder.ts` | service | batch | MiniSearch not yet installed (first phase to install it — R-9); no existing indexing/chunking code. Use RESEARCH Pattern 5 + D-4a-16 (spec). |
| `tests/core/extraction/PageIndexBuilder.test.ts` | test | — | No chunking test precedent. Use fixtures/pageContent.ts golden HTML + fixtures.test.ts determinism style. |
| `src/core/extraction/strategies/IExtractionStrategy.ts` | model | — | Spec-only contract (Appendix C.1 L4680-4700 + §26.3) — no existing interface to copy from; copy spec verbatim. |
| `src/core/extraction/apcLite.types.ts` | model | — | Types are spec-verbatim (C.1 L4411-4464); zod co-location pattern copied from ContextProvenanceManifest. |
| `src/core/extraction/PageContentService.ts` (coalescing half) | service | — | No in-flight promise-map precedent exists in the codebase (grep confirmed). Pattern is D-4a-03 design; timeout/abort precedent from StructuredOutput. |

## Metadata

**Analog search scope:** `src/core/**` (content/, extraction/, registry/, workspace/, security/, error/, runtime/, context/, ai/, messaging/, utils/), `src/entrypoints/`, `tests/**`, `.planning/PRODUCT_SPEC_v0_1.md` (Appendices C.1, O.12, §18/§26/§22), 04a-RESEARCH.md patterns.
**Files scanned:** ~30 (existing analogs read in full: ContentScriptHost, PageContextBridge, PageContext, PageRegistry, core.content.ts, errorCodes, debugLog, TraceRedactor, workspace.ts, WorkspaceStore, WorkspaceSync, BroadcastBus, MessageType, RuntimeEnvelope, MessageBusBridge, Setting.ts, ContextOptimizer, ContextCompressor, StructuredOutput, TokenBudget, OperationId, RateLimiter, wxt.config, package.json, tests: ContentScriptHost.test, PageRegistry.test, fixtures/index, fixtures.test, setup.ts, jsdom-align, isolation tests, background.ts)
**Pattern extraction date:** 2026-08-12
