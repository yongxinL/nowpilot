# Phase 6: PageContentService (Knowledge Acquisition) - Pattern Map

**Mapped:** 2026-08-29
**Files analyzed:** 18 new/modified source files + 5 test files (23 total)
**Analogs found:** 20 / 23 (3 no-analog — AxDomWalker DOM walk, + 2 partial)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/extraction/PageContentService.ts` | service (orchestrator) | request-response | `src/core/ai/ProviderRegistry.ts` | role-match |
| `src/core/extraction/apcLite.types.ts` | types (model) | — | `src/core/ai/types.ts` | exact |
| `src/core/extraction/strategies/IExtractionStrategy.ts` | types (contract) | — | `src/core/ai/ILLMProvider.ts` | exact |
| `src/core/extraction/strategies/DefuddleStrategy.ts` | service (strategy) | transform | `src/core/ai/providers/OpenAIProvider.ts` | role-match |
| `src/core/extraction/strategies/ApcLiteStrategy.ts` | service (strategy) | transform | `src/core/ai/providers/OpenAIProvider.ts` | role-match |
| `src/core/extraction/PageContentSerializer.ts` | utility | transform | `src/core/context/ContextOptimizer.ts` (buildContextText, lines 385-395) | partial |
| `src/core/extraction/PageIndexBuilder.ts` | service (builder) | batch/transform | `src/core/context/ContextProvenanceManifest.ts` (buildManifest) | partial |
| `src/core/extraction/PageContentCache.ts` | store (cache) | event-driven | `src/core/ai/ProviderRegistry.ts` (module Map + singleton) | role-match |
| `src/core/content/AxDomWalker.ts` | utility (walker) | transform | none — spec Appendix C verbatim | none |
| `src/core/content/PageContextBridge.ts` | middleware (bridge) | event-driven | `src/core/messaging/MessageBus.ts` + `entrypoints/content/core.content.ts` sendMessage | role-match |
| `src/core/content/ContentScriptHost.ts` | controller (shell) | request-response | `entrypoints/content/core.content.ts` (current shell) | exact |
| `src/core/content/SPANavigationWatcher.ts` | hook (watcher) | event-driven | `entrypoints/content/core.content.ts` lines 19-43 | exact |
| `src/core/content/PageContext.ts` | types (canonical) | — | `src/core/context/types.ts` lines 17-29 (supersession point) | exact |
| `src/core/context/types.ts` (MODIFY) | types | — | `src/core/context/ContextOptimizer.ts` line 21 (D-72 re-export) | exact |
| `src/core/runtime/RuntimeEnvelope.ts` (MODIFY) | types (envelope) | — | itself — `PageHtmlPayload` pattern lines 40-46 | exact |
| `entrypoints/content/core.content.ts` (MODIFY) | controller | request-response | itself (current shell) | exact |
| `package.json` (MODIFY) | config | — | `verify:phase-5` + stale `verify:phase-4a` scripts (D-92) | exact |
| `tests/core/extraction/PageContentService.test.ts` | test | — | `tests/core/context/ContextOptimizer.test.ts` | exact |
| `tests/core/extraction/DefuddleStrategy.test.ts` | test | — | `tests/core/context/ContextOptimizer.test.ts` (fixture style) | role-match |
| `tests/core/extraction/ApcLiteStrategy.test.ts` | test | — | `tests/core/context/ContextOptimizer.test.ts` | role-match |
| `tests/core/extraction/PageIndexBuilder.test.ts` | test | — | `tests/core/context/TokenBudget.test.ts` (pure fn) | role-match |
| `tests/isolation/no-content-script-ui.test.ts` | test | — | `tests/isolation/cross-entrypoint-imports.test.ts` | exact |

**Layout convention (agent's discretion):** mirror `src/core/ai/` — **no barrel `index.ts`**; §18-named files import each other directly (verified: `src/core/ai/` has no index).

---

## Pattern Assignments

### `src/core/extraction/PageContentService.ts` (service, request-response)

**Analog:** `src/core/ai/ProviderRegistry.ts` (per-surface module singleton + object-namespace export + `__test__` seams)

The agent's discretion (per-surface singleton vs factory) resolves to the **module singleton** pattern — this is the established codebase convention and it makes background-SW instantiation impossible by construction.

**Module-singleton + namespace-export pattern** (ProviderRegistry.ts:141-146, 434-459):
```typescript
// src/core/ai/ProviderRegistry.ts:141-146 — module-level state, no class
const normalized = new Map<ProviderId, NormalizedProvider>();
const registered = new Map<ProviderId, ILLMProvider>();
let hydrated = false;

// :434-446 — object-form namespace export for callers
export const ProviderRegistry = { hydrate, registerProvider, getEnabled, /* ... */ };
// :448-459 — plus named exports for tree-shaking consumers
export { hydrate, registerProvider, getEnabled, /* ... */ };
```

**Test-seam pattern** (ProviderRegistry.ts:412-431) — `__test__` prefix (matches `chromeStorageAdapter` convention); production code must not use these:
```typescript
export const __test__ = {
  reset(): void { /* clear all module Maps + re-register */ },
  seedCachedModels(providerId: ProviderId, models: string[]): void { /* ... */ },
};
```

**"Never a silent empty result" typed-result union** — from `src/core/context/ContextOptimizer.ts:102-112` (the ok:true/ok:false discriminated-union spine). PageContentService.extract() should mirror this shape so a failure is a typed `CONTENT_EXTRACT_FAILED` (D-91), never `undefined`:
```typescript
// src/core/context/ContextOptimizer.ts:102-112
export type AssembleResult =
  | { ok: true; context: OptimizedContext }
  | { ok: false; code: 'CONTENT_TOO_LARGE'; message: string; /* ... */ };
```

**Error discipline** (ContextOptimizer.ts:1-12 header comment): pure function returns typed variants, never a throw; the `CONTENT_EXTRACT_FAILED` code is a §21.6 closed-set member (no invented codes, D-38) — the same discipline as `StreamErrorCodeSchema` in `src/core/ai/types.ts:55-64`.

**Debug logging** — `src/core/log/debugLog.ts:11-27`: `debugLog(code, message, context?)` with a `[CODE]` console prefix; never raw `console.log`. Use codes like `'EXTRACT_FAILED'`, `'EXTRACT_DONE'`.

---

### `src/core/extraction/apcLite.types.ts` (types, —)

**Analog:** `src/core/ai/types.ts` (zod schema-first file) + `src/core/context/ContextProvenanceManifest.ts`

The spec's Appendix C block (spec 4393-4448) is **verbatim** — copy it exactly. The codebase convention this file follows:

**Schema-first + z.infer type export** (ContextProvenanceManifest.ts:9-43):
```typescript
import { z } from 'zod';
export const ManifestKindSchema = z.enum(['system', 'tool_schemas', /* ... */]);
export type ManifestKind = z.infer<typeof ManifestKindSchema>;
export const ContextProvenanceManifestSchema = z.object({ /* ... */ });
export type ContextProvenanceManifest = z.infer<typeof ContextProvenanceManifestSchema>;
```

**Closed-set z.enum + recursive lazy schema** (from spec 4393-4448 — the shapes are fixed; the zod patterns below are the codebase conventions to apply):
- `FormControlSchema.refine(c => !(c.isPassword && c.value !== undefined), 'password value must be omitted')` — **D-86 password invariant** (spec 4415-4418).
- `APCLiteNodeSchema: z.ZodType<APCLiteNode> = z.lazy(() => z.object({ ... children: z.array(APCLiteNodeSchema).optional() }))` — recursive tree schema.
- `APCLiteDocumentSchema.source: z.enum(['dom', 'ax', 'hybrid', 'servicenow-api', 'defuddle', 'readability'])` — provenance closed set (D-80).

**IMPORTANT content-bundle constraint** (Pitfall 8): `RawNode` stays a **plain serializable interface, NO zod in the content bundle**. The zod schemas live in this panel-side file; the content script (`AxDomWalker`) imports only the interface via a type-only import.

---

### `src/core/extraction/strategies/IExtractionStrategy.ts` (types, —)

**Analog:** `src/core/ai/ILLMProvider.ts` (pure contract file, types only)

Copy the contract **verbatim** from spec 4667-4693 (quoted in full in 06-RESEARCH.md lines 245-262). The file-shape convention it follows (ILLMProvider.ts:1-46 — header doc comment + interfaces only, no implementation):
```typescript
// src/core/ai/ILLMProvider.ts:42-46 — interface-only contract file
export interface ILLMProvider {
  readonly providerId: ProviderId;
  stream(request: LLMStreamRequest, signal?: AbortSignal): AsyncIterable<StreamEvent>;
  requestJson(prompt: string, jsonSchema: unknown, signal?: AbortSignal): Promise<string>;
}
```

**Two-enums note (spec 4688-4693, D-80):** `IExtractionStrategy.id: StrategyResult['source']` enumerates installed strategies ONLY (`'defuddle' | 'apc-lite'`); Readability is NOT a strategy (internal fallback, provenance only); `'servicenow-api'` is reserved in `StrategyResult.source` but NOT registered until Phase 17. **Do NOT create ReadabilityStrategy.ts or a ServiceNow strategy file.**

**Tunables exported from this file** (spec 4696-4699 verbatim — same style as `TokenBudget.ts:22-25` exported constants):
```typescript
export const PAGE_CACHE_MAX_TABS = 20;
export const PAGE_HTML_MAX_BYTES = 2_000_000;
export const INDEX_CHUNK_MAX_TOKENS = 500;
export const PAGE_EXTRACTION_TIMEOUT_MS = 5_000;
```

---

### `src/core/extraction/strategies/DefuddleStrategy.ts` (service, transform)

**Analog:** `src/core/ai/providers/OpenAIProvider.ts` (interface implementation, singleton export)

**Interface-implementation + singleton shape** (OpenAIProvider.ts:22-35):
```typescript
export class OpenAIProvider extends OpenAIWireProvider {
  readonly providerId = 'openai' as const;
  constructor(config: OpenAIProviderConfig = {}) { super({ ...config, baseUrl: config.baseUrl ?? OPENAI_DEFAULT_BASE_URL }); }
}
/** Singleton instance registered by ProviderRegistry at module load (D-51). */
export const openaiProvider = new OpenAIProvider();
```

**Detached-doc Defuddle call — CORRECTED import shape** (RESEARCH.md:392-406; `import Defuddle from 'defuddle/full'` — the spec-3721 named import fails TS2305):
```typescript
import Defuddle from 'defuddle/full'; // DEFAULT export — spec 3721's named import fails TS2305

const doc = new DOMParser().parseFromString(payload.html, 'text/html');
if (payload.baseUrl && !doc.querySelector('base')) {
  const base = doc.createElement('base');
  base.setAttribute('href', payload.baseUrl);
  doc.head?.prepend(base);
}
const result = new Defuddle(doc, {
  url: payload.baseUrl,
  markdown: true,
  useAsync: false, // PRIVACY-CRITICAL: default is TRUE in 0.19.x — must be explicit
}).parse();        // synchronous — async extractors never run on parse()
```

**Readability internal fallback** (RESEARCH.md:416-421) — NOT a strategy; records `source: 'readability'`; `parse()` mutates the doc (doc is disposable); `null` below charThreshold 500 → treat as failed fallback that still records source and surfaces the typed error:
```typescript
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
const article = new Readability(doc).parse(); // doc = detached DOMParser doc (base href injected)
if (!article || article.textContent.trim().length === 0) return null;
return { markdown: new TurndownService({ headingStyle: 'atx' }).turndown(article.content) };
```

**Low-confidence heuristic (agent's discretion):** fire fallback when `wordCount < 50 || !content.trim()` (below defuddle's internal 200-word auto-retry).

---

### `src/core/extraction/strategies/ApcLiteStrategy.ts` (service, transform)

**Analog:** `src/core/ai/providers/OpenAIProvider.ts` + `src/core/context/ContextProvenanceManifest.ts` (output schema-validated)

Same interface-implementation shape as DefuddleStrategy; `id: 'apc-lite'`, `canHandle` gates on `mode: 'actionable'` (D-86 — zero AX cost on the read path). The normalization `RawNode → APCLiteNode` then **schema-validates the output** (the `buildManifest` convention — ContextProvenanceManifest.ts:82-93: `return ContextProvenanceManifestSchema.parse({ ... })` — output is schema-parsed, cross-boundary shapes are zod-validated per CLAUDE.md).

---

### `src/core/extraction/PageContentSerializer.ts` (utility, transform)

**Analog:** `src/core/context/ContextOptimizer.ts` lines 383-395 (`buildContextText` + `stripHtml`) — the existing PageContext→text transform

**The exact transform that already consumes PageContext** (ContextOptimizer.ts:383-388) — the serializer's contract target (D-82: Phase-6 PageContext feeds this in Phase 7):
```typescript
// src/core/context/ContextOptimizer.ts:383-388
function buildContextText(page: PageContext): string {
  const body = page.markdown ?? stripHtml(page.html) ?? page.title;
  return `URL: ${page.url}\nTITLE: ${page.title}\n${body}`;
}
// :390-395 — minimal HTML stripping for token estimates
function stripHtml(html: string | undefined): string | undefined {
  if (html === undefined) return undefined;
  const stripped = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped === '' ? undefined : stripped;
}
```
PageContentSerializer produces the canonical `PageContext` (spec 4345-4357) from a `StrategyResult` — pure functions, no side effects, same module style as ContextOptimizer's private helpers.

---

### `src/core/extraction/PageIndexBuilder.ts` (service, batch/transform)

**Analog:** `src/core/context/ContextProvenanceManifest.ts` (builder fn returning schema-validated object) + `TokenBudget.ts` (pure heuristic)

**Token-counting dependency** (D-71 heuristic — TokenBudget.ts:44-52):
```typescript
// src/core/context/TokenBudget.ts:44-52 — reuse countTokensHeuristic for INDEX_CHUNK_MAX_TOKENS splitting + 2,000-token budget
export function countTokensHeuristic(text: string): number {
  const codePoints = Array.from(text);
  if (codePoints.length === 0) return 0;
  const nonWhitespace = codePoints.filter((cp) => !/\s/u.test(cp));
  const cjkCount = nonWhitespace.filter((cp) => isCjkCodePoint(cp.codePointAt(0) ?? 0)).length;
  const density = nonWhitespace.length === 0 ? 0 : cjkCount / nonWhitespace.length;
  if (density >= CJK_DENSITY_THRESHOLD) return Math.ceil(codePoints.length / 3);
  return Math.ceil(codePoints.length / 4);
}
```

**MiniSearch index construction** (RESEARCH.md:445-451 — `id` field is mandatory; synthesized `${headingPath}:${index}`):
```typescript
import MiniSearch from 'minisearch';
const index = new MiniSearch<PageChunk>({
  fields: ['title', 'url', 'headingPath', 'sectionText'],
  storeFields: ['title', 'url', 'headingPath', 'sectionText'],
  searchOptions: { boost: { title: 3, headingPath: 2 }, prefix: true, fuzzy: 0.2 },
});
index.addAll(chunks);  // addAll returns this; chunk docs MUST carry synthesized `id` (Pitfall 5)
```

**`compressionApplied: 'topk'` provenance literal** — the `'topk'` literal is the Phase-5 `CompressionType` (src/core/context/types.ts:50 — `export type CompressionType = 'summarise' | 'structural' | 'topk'`), already schema'd at ContextProvenanceManifest.ts:25 (`CompressionTypeSchema = z.enum(['summarise', 'structural', 'topk'])`). PageIndexBuilder records it into the Phase-5 manifest — import the type from `src/core/context/types`.

---

### `src/core/extraction/PageContentCache.ts` (store, event-driven)

**Analog:** `src/core/ai/ProviderRegistry.ts` (module-level Map state + `__test__` seams) + `src/core/ai/PromptCacheManager.ts` (cache-threshold constants)

**Module Map + per-key lifecycle** — same state container style as ProviderRegistry.ts:141-146, keyed by `tabId` (D-88: separate from PageRegistry):
```typescript
// src/core/ai/ProviderRegistry.ts:141-146 — module-level Map, the cache's shape
const normalized = new Map<ProviderId, NormalizedProvider>();
```

**Threshold constants style** (PromptCacheManager.ts:29-31):
```typescript
// src/core/ai/PromptCacheManager.ts:29-31
export const CACHE_DISABLE_MISS_THRESHOLD = 5;
const CACHE_DISABLE_WINDOW_MS = 60_000;
```
Mirror with `PAGE_CACHE_MAX_TABS = 20` (imported from IExtractionStrategy tunables).

**Subscription signal — `pinnedTabs`** (WorkspaceStore.ts:27-32, 39): D-88's subscription-gated auto re-extract keys on `WorkspaceState.pinnedTabs: TabContext[]` (cap 10):
```typescript
// src/core/workspace/WorkspaceStore.ts:27-32 — the §26.4a subscription signal
export interface TabContext {
  tabId: number;
  title: string;
  url: string;
  pinned: boolean;
}
```

**Invariant rules to implement (§26.4a, D-88):** never LRU-evict in-flight/subscribed tabs; pinned eviction-last; extraction + index always evicted together; coalesce in-flight extractions per tabId (dedup on the promise); reads after invalidation await the in-flight extraction. Subscription API (`subscribe`/`unsubscribe`/`markStale`) declared only — call-sites are Phase 7/15.

---

### `src/core/content/PageContext.ts` (types, —)

**Analog:** `src/core/context/types.ts` lines 17-29 (the supersession point) — replace in place; **verbatim** spec 4345-4391 (quoted in full in the 06-RESEARCH.md context above). Copy `PageContext` (spec 4346-4357), `TabContext`, `SNowCaseData`, `FileContext`, `NoteContext` exactly. Header comment marks the supersession (same style as UserPreferences.ts:1-6):
```typescript
// src/core/ai/UserPreferences.ts:1-6 — the supersession-point header convention
// Phase-3 supply point ... The memory phases (8/10) own the FULL UserPreferences shape;
// this minimal shape is the supersession point those phases replace in place.
```

### `src/core/context/types.ts` (MODIFY — types)

**Analog:** `src/core/context/ContextOptimizer.ts:21` (D-72 re-export precedent) — delete the local `PageContext` interface (lines 17-29) and re-export from the new canonical home:
```typescript
// src/core/context/ContextOptimizer.ts:21 — the exact D-72 re-export pattern
export type { PromptSection } from '../ai/types';
```
Phase 6 applies the same to `src/core/context/types.ts`:
```typescript
export type { PageContext, TabContext, SNowCaseData, FileContext, NoteContext } from '../content/PageContext';
```
Keep `RetrievedMemory`, `ToolSchemaRef`, `CompressionType`, `Summarizer` untouched (Phase 8/18 own those supersession points). `ContextOptimizer`'s `import type { PageContext } from './types'` (ContextOptimizer.ts:36) keeps resolving — **no parallel copy** (D-83).

### `src/core/runtime/RuntimeEnvelope.ts` (MODIFY — types)

**Analog:** itself — the D-15 declarations are already there (lines 1-46). The wiring (D-84) adds the `PAGE_LIVE_CONTEXT` payload shape following the frozen `PageHtmlPayload` pattern (lines 40-46):
```typescript
// src/core/runtime/RuntimeEnvelope.ts:40-46 — the shape convention new payloads follow
export interface PageHtmlPayload {
  html: string;
  baseUrl: string;
  truncated: boolean;
  /** Reserved for Phase 17 ServiceNow strategy registration. */
  strategyId?: string;
}
```
Phase 6 must NOT edit `MessageTypeValues` (lines 1-26 — all four extraction types already declared). `createEnvelope` (lines 56-68) and `isEnvelope` (lines 70-80) are ready as-is.

### `entrypoints/content/core.content.ts` (MODIFY — controller)

**Analog:** itself — D-85 keeps this a thin WXT `defineContentScript` shell. The shell keeps the `defineContentScript` shape (lines 1-8) + `world: 'ISOLATED'` + `runAt: 'document_idle'`, and delegates to the new `src/core/content/` shells. **Two known bugs to fix in the delegation:**
1. Line 49 `document.addEventListener('wxt:locationchange', ...)` is dead code (WXT 0.20.x namespaces the event + dispatches on `window`) → SPANavigationWatcher uses `ctx.addEventListener(window, 'wxt:locationchange', ...)` (RESEARCH.md:454-472).
2. The import path convention (lines 1-2): `import { createEnvelope } from '../../src/core/runtime/RuntimeEnvelope';` — relative path, not `@/` (WXT does not typecheck content scripts through tsconfig). The new shells keep the same import style.

### `src/core/content/ContentScriptHost.ts` (controller, request-response)

**Analog:** `entrypoints/content/core.content.ts` lines 17-43 (current serialize/send + MutationObserver). The serializer uses `chrome.runtime.sendMessage(createEnvelope('PAGE_HTML_PAYLOAD', {...}, 'content'))` — the exact producer shape already in the shell (lines 24-32):
```typescript
// entrypoints/content/core.content.ts:24-32 — the producer round-trip shape
chrome.runtime.sendMessage(
  createEnvelope('SPA_NAVIGATION', { url: location.href }, 'content'),
).catch(() => {});
```
Payload = `PageHtmlPayload` (`html`/`baseUrl`/`truncated`/`strategyId?`). Serializer rules (D-85): pre-stripped clone of `document.documentElement` (remove `script`/`style`/`noscript`/`svg`/cross-origin `iframe` + `form action` attrs), stamp effective base URL, `PAGE_HTML_MAX_BYTES` (2 MB) hard cap, truncate at element boundary + `truncated: true`.

### `src/core/content/PageContextBridge.ts` (middleware, event-driven)

**Analog:** `src/core/messaging/MessageBus.ts` (handler registration + dispatch) + `core.content.ts` (producer). The bridge registers handlers for the D-15 envelope types and responds to `EXTRACT_PAGE_CONTENT`:
```typescript
// src/core/messaging/MessageBus.ts:10-22 — the handler-registration pattern
export function register<T = unknown>(type: string, handler: MessageHandler<T>): () => void {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type)!.add(handler as MessageHandler);
  return () => { /* unregister */ };
}
```
The bridge replies to `chrome.runtime.onMessage` via `sendResponse` (the `init()` pattern at MessageBus.ts:62-75 — `sendResponse(result ?? { ok: true })` / `{ ok: false, error }`).

### `src/core/content/SPANavigationWatcher.ts` (hook, event-driven)

**Analog:** `entrypoints/content/core.content.ts` lines 19-43 (the MutationObserver URL-diff + SPA_NAVIGATION send). The corrected WXT listener (RESEARCH.md:454-472):
```typescript
// RESEARCH.md:459-472 — ctx.addEventListener(window, ...) — translates the namespaced event
// AND starts the LocationWatcher (Navigation API first, 1s polling fallback)
ctx.addEventListener(window, 'wxt:locationchange', ({ newUrl, oldUrl }) => {
  onNavigation(newUrl.href, oldUrl.href); // → PageContentCache.invalidate(tabId) / markStale
});
// Belt-and-braces URL-diff (MutationObserver) kept from the scaffold (core.content.ts:36-43)
```

### `src/core/content/AxDomWalker.ts` (utility, transform)

**NO ANALOG** — no DOM walker exists in the codebase. Use spec Appendix C verbatim (`RawNode` interface, spec 4393-4402). Content-bundle constraints (Pitfall 8): imports ONLY `src/core/runtime/RuntimeEnvelope.ts` (types + `createEnvelope`) and sibling `src/core/content/` modules — never `src/core/extraction/*` or zod. `FormControlSchema.refine` runs where the walker builds the node (password omission enforced at capture, D-86/D-90); `geometry?` stays UNSET. Runs only on `mode: 'actionable'` requests.

---

## Shared Patterns

### Per-surface module singleton (apply to: PageContentService, PageContentCache)
**Source:** `src/core/ai/ProviderRegistry.ts:141-146, 434-459`
Module-level `Map`/state + `const X = { ... }` namespace export + named exports + `__test__` reset seams (lines 412-431). Never a class instance held in the background SW. Both service and cache follow this; cache keyed by `tabId` with `Map<number, ...>`.

### Typed result union — never a silent empty (apply to: PageContentService.extract, DefuddleStrategy.run, ApcLiteStrategy.run)
**Source:** `src/core/context/ContextOptimizer.ts:102-112` + `src/core/ai/types.ts:55-64`
Return `{ ok: true, ... } | { ok: false, code: 'CONTENT_EXTRACT_FAILED', ... }` (D-91). `CONTENT_EXTRACT_FAILED` is a §21.6 closed-set literal — no invented codes (D-38). Strategy failures record `source` provenance before surfacing the typed error.

### zod validation at every cross-boundary (apply to: apcLite.types.ts, PageIndexBuilder, PageContentSerializer, PageContentBridge payloads)
**Source:** `src/core/context/ContextProvenanceManifest.ts:9-43, 82-93`
Schema-first (`z.enum` closed sets + `z.object` + `z.lazy` for recursion + `z.infer` type export); output schema-parsed (`Schema.parse({ ... })`). All cross-boundary shapes (RuntimeEnvelope payloads, APCLiteDocument, PageHtmlPayload) are zod-validated per CLAUDE.md. **Exception:** content-script side never imports zod (Pitfall 8).

### Redaction seam (apply to: PageContentService / PageContentCache write path)
**Source:** `src/core/security/redactSensitive.ts:61-71`
D-90: panel-side redaction before indexing/logging. The primitive: `redactSensitive(context)` deep-clones, empties secret keys, truncates long string values. Research recommends the call-site in `PageContentService.extract()` (redact once, all consumers safe — RESEARCH.md:517-520); the content script performs NO redaction.

### Debug logging (apply to: all new modules)
**Source:** `src/core/log/debugLog.ts:11-27`
`debugLog('CODE', message, context?)` — never raw `console.log`. Codes like `'EXTRACT_DONE'`, `'EXTRACT_FAILED'`, `'CACHE_EVICT'`.

### Content-bundle import boundary (apply to: all `src/core/content/*` + `entrypoints/content/*`)
**Source:** `tests/isolation/cross-entrypoint-imports.test.ts` + RESEARCH.md Pitfall 8
Content-side modules import ONLY `src/core/runtime/RuntimeEnvelope.ts` + each other. `RawNode` is a plain serializable interface. Never `src/core/extraction/*`, zod, React, AntD, defuddle, turndown, yaml, mathml-to-latex, temml (the §24 rev 2026-08-12 isolation list).

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/core/content/AxDomWalker.ts` | utility (walker) | transform | No DOM walker exists in the codebase; use spec Appendix C verbatim (RawNode, spec 4393-4402) + FormControlSchema.refine password invariant |
| `src/core/extraction/PageIndexBuilder.ts` | service (builder) | batch/transform | No existing MiniSearch/heading-chunking code; use RESEARCH.md Pattern 3 + spec §26.5 + MiniSearch docs |
| `src/core/extraction/PageContentSerializer.ts` | utility | transform | No existing PageContext→text producer; closest partial is ContextOptimizer.buildContextText (excerpted above) |

(These three are library-shape-driven — the planner should use RESEARCH.md patterns 1-4 + spec Appendix C verbatim.)

---

## Metadata

**Analog search scope:** `src/core/ai/**`, `src/core/context/**`, `src/core/runtime/**`, `src/core/messaging/**`, `src/core/workspace/**`, `src/core/security/**`, `src/core/log/**`, `entrypoints/content/**`, `tests/core/**`, `tests/isolation/**`, `package.json`, spec Appendix C + extraction contract
**Files scanned:** ~30 (23 classified; 3 partial/no-analog)
**Pattern extraction date:** 2026-08-29

**Key research corrections the planner must embed (from RESEARCH.md):**
1. `import Defuddle from 'defuddle/full'` — DEFAULT export; spec 3721's named import fails TS2305.
2. `ctx.addEventListener(window, 'wxt:locationchange', ...)` — the scaffold's `document.addEventListener` (core.content.ts:49) is dead code.
3. `useAsync: false` is privacy-critical (defaults to TRUE in 0.19.x).
4. `verify:phase-6` (package.json:25) mis-points at Phase-11 dirs; `verify:phase-4a` (package.json:22) already points at the Phase-6 dirs (stale placeholder — reconcile/delete per D-92).
5. New deps to install at Wave 1: `pnpm add defuddle@^0.19 @mozilla/readability@^0.6 turndown@^7 minisearch@^7` (+ `checkpoint:human-verify` on defuddle per SUS flag).