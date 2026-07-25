# NowPilot — PageContentService Implementation Guide (Phase 8 tool→core migration)

> **Context:** The project is at **Phase 8**. Page-content extraction **already exists as a tool** (add-on/tool layer) but is **unreliable**. This guide describes **removing the page-content-extraction tool and rebuilding extraction as a core service** — `PageContentService` (`src/core/extraction/`) — modeled on Chromium **Annotated Page Content (APC)**, sourced from a **content-script DOM+ARIA walk**, **working with the core `MiniSearchIndex`** for retrieval-augmented selection, feeding **`ContextOptimizerInput.pageContext`**. ServiceNow cases/incidents remain **API-first**. The old tool is deleted; only a thin built-in `get-page-content` wrapper over core remains.
>
> **Scope note:** v0.1 is **read-only** — extraction only. **Browser automation (acting on the host page: clicking/typing/navigating) is deferred to v2** and requires `chrome.debugger`. See **§11 (chrome.debugger)** and **§11a (Browser Automation Strategy — v2)**.
>
> **Status:** Draft **v0.5** — migration-oriented, spec-aligned, with reference base code + v2 automation boundary.
> **Owner:** George Li (Integrations) · Sydney
> **Audience:** cost-effective AI coding agents (Haiku / Flash / DeepSeek-class) + reviewers
> **Base spec:** `PRODUCT_SPEC_v0_1.md`
> **Companion:** `NowPilot-PageContentService-migration-checklist.md`

---

## 0. Why migrate tool → core (the decision)

### 0.1 Problem with the current (Phase 8) tool-layer implementation
The extractor currently lives at the **tool/add-on level**. Symptoms:
- **Duplication & drift** — each caller (Chat, Agent, Summarize, `/research`) reaches extraction differently; no single contract.
- **No shared cache / concurrency guard** — repeated extractions per tab; races.
- **Inconsistent redaction & metrics** — quality is unobservable and privacy handling varies.
- **Can't be a dependency of other core services** — a tool can't be cleanly consumed by the context pipeline or memory layer.

### 0.2 Why core is correct (spec-backed)
Extraction is **shared infrastructure** consumed by *all* surfaces, so by the spec's own boundary test it belongs in core: *"Core never knows about specific websites. Add-ons never bypass core APIs"* (§8.2). It also mirrors Chrome's own design — one internal engine (APC) feeding many consumers.

**Locked decision:** the **extraction engine is core** (`PageContentService`); the **existing tool becomes a thin wrapper** that calls it (see §1 migration). Add-ons never own extraction; ServiceNow specifics stay in the ServiceNow add-on (§0.2).

### 0.3 Spec-compliance corrections baked into this guide
| Area | Wrong pattern | Spec-aligned fix | Spec ref |
|---|---|---|---|
| Extraction API | `chrome.debugger` primary | **content-script DOM+ARIA walk primary**; debugger optional/flagged (§11/§11a) | §16.4, §5.6, §22.1 |
| File paths | invented `src/core/page-content/` | real dir `src/core/extraction/**` + `src/core/content/**` | §0.2, §8.5 |
| Cache invalidation | `chrome.webNavigation` | `SPANavigationWatcher` + `tabs.onUpdated` | §16.4, §5.6 |
| Error codes | invented | closed set §21.6 (reuse; propose new only if ratified) | §21.6 |
| Cross-context calls | plain calls | `RuntimeEnvelope<T>` + `EXTRACT_PAGE_CONTENT` | §0.2, App. C/E |
| Types | bare interfaces | Zod schemas + proposed Appendix C additions | §0.3 |
| ServiceNow | scrape | **Table API first**, core extraction fallback | §9.7, §10.7 |

**Hard rules honored:** content scripts extraction-only, no UI/React/AntD in the content bundle (<50 KB, §5.6/§22.1); no `innerHTML`/`eval`; every boundary has a Zod schema + fixture test (§0.3); every `catch` calls `debugLog` (§0.3); ServiceNow tokens/selectors only in the add-on; core never imports `src/addons/**` (§0.2).

---

## 1. Migration plan — from Phase 8 tool to core (do this first)

This is an **in-place refactor**, not a rip-and-replace. Keep the tool's public name working so nothing downstream breaks mid-migration. *(A tickable PR decision log for these steps lives in `NowPilot-PageContentService-migration-checklist.md`.)*

### 1.1 Migration steps (ordered, reversible)

| Step | Action | Guardrail |
|---|---|---|
| **M0. Inventory** | Locate the current extraction tool (likely `src/addons/**` or an ad-hoc tool file) and list every caller. Baseline old-tool metrics. | Grep for the current tool name + `get-page-content`. |
| **M1. Create core service** | Add `src/core/extraction/PageContentService.ts` (§5) with the new pipeline. Do **not** wire callers yet. | Fixture tests green (§10). |
| **M2. Move logic, keep names** | Port useful extraction logic from the tool into core transforms; delete duplicated logic from the tool. | No behavior change visible to callers. |
| **M3. Thin-wrapper the tool** | Rewrite the built-in tool `get-page-content` (#1, §10.5) to **delegate** to `PageContentService` (§8.1). | Same `inputSchema`/`outputSchema`. |
| **M4. Repoint callers** | Switch Chat/Agent/Summarize/`/research` to consume `PageContentService` (via the context pipeline `pageContext`, not the tool, where possible). | One caller per PR. |
| **M5. Delete old path** | Remove the old tool-layer extractor module; leave the wrapper tool only. | `no-content-script-ui` + isolation tests pass. |
| **M6. ServiceNow** | Ensure ServiceNow uses **API-first** (§12); its extractor calls core only as fallback. Verify MiniSearch retrieval. | ServiceNow selectors stay in add-on. |

### 1.2 Backward-compatibility contract
- The built-in **tool name `get-page-content` and its Zod schemas are preserved** (§10.5). Only its *implementation* changes (now delegates to core). Planner/Executor enums are unaffected (§1.2).
- Agent tools that previously duplicated extraction become thin wrappers over core (§8.2).

### 1.3 "Done" for the migration
- Grep shows extraction logic exists **only** under `src/core/extraction/**` + `src/core/content/**` (+ ServiceNow API path in the add-on).
- `get-page-content` returns identical shape but is now backed by the core service (cache, concurrency guard, redaction, metrics).
- All Phase-8 verification scripts pass (`verify:phase-8`, isolation, perf — §24).

---

## 2. Architecture at a glance

```
                         ┌───────────────────────────────────────────┐
 Content Script          │  PageContentService  (src/core/extraction) │  Side Panel / Full App
 (extraction-only)       │  normalize → prune → redact → index → select│
 core.content.ts         │           │                     │           │
   AxDomWalker  ─────────┼─▶ (APCLiteNode tree)     (MiniSearchIndex)  │
   SPANavigationWatcher  │           │                     │           │
        │ EXTRACT_PAGE_CONTENT (RuntimeEnvelope)           ▼           │
        └────────────────┼─▶ serialize → PageContext ─▶ ContextOptimizerInput.pageContext
                         └───────────┬─────────────────────┬──────────┘
                                     ▼                     ▼
                   Built-in tool #1 (thin wrapper)     Agent tools (thin wrappers)
                   get-page-content                 getPageContent / searchPageContent /
                   → PageContentService             getInteractiveElements / findElement / getFormSchema

 ServiceNow case/incident:  ServiceNow add-on → SNowTableClient (Table API via PROXY_FETCH)
                                              → SNowCaseData (structured)   [API-FIRST]
                            fallback only ─────→ PageContentService (cross-frame + open-shadow-DOM aware)
```

**Layering:** `PageContentService` is core and never mentions ServiceNow. The ServiceNow **add-on** decides source (API vs fallback) and *calls* core — never the reverse (§0.2, §8.2).

---

## 3. Phase 1 — Study APC (condensed)

Read in full: APC `readme.md`, `ai_page_content_agent.cc` (+ `_unittest.cc`), `ai_page_content.mojom` (`Default*`/`Actionable*` options), `page_content_proto_provider.h`.

Carry over the five APC principles — **Completeness** (incl. out-of-viewport), **Actionability**, **Consistency** (stable ids), **Efficiency**, **Privacy** (no password values, iframe origins, no scripts).

Key insight: APC walks the **layout tree** (rendered-only). MV3 can't reach it, so our substitute is a **DOM + ARIA/role walk** that mimics "rendered + semantic" pruning. (`chrome.debugger` AX tree is a higher-fidelity *optional* substitute — see §11.)

**Deliverable:** `docs/apc-study-notes.md` (mapping table + deferrals + quirks).

---

## 4. Phase 2 — Extractor base code + benchmark

### 4.1 Primary path — content-script DOM + ARIA walk (permission-free, spec-compliant)

Runs inside `core.content.ts` (ISOLATED world, extraction-only, §5.6). Plain TS, no React/AntD — keeps the content bundle < 50 KB (§22.1).

```ts
// src/core/content/AxDomWalker.ts  (content-script safe: no React, no AntD)
import type { RawNode } from '@/core/extraction/apcLite.types';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'META', 'LINK']);
const LANDMARK_ROLE: Record<string, string> = {
  MAIN: 'main', NAV: 'nav', HEADER: 'header', FOOTER: 'contentinfo',
  ARTICLE: 'article', SECTION: 'region', ASIDE: 'complementary',
  H1: 'heading', H2: 'heading', H3: 'heading', H4: 'heading', H5: 'heading', H6: 'heading',
  A: 'link', IMG: 'image', UL: 'list', OL: 'list', LI: 'listitem',
  TABLE: 'table', TR: 'row', TD: 'cell', TH: 'cell',
  FORM: 'form', INPUT: 'textbox', TEXTAREA: 'textbox', SELECT: 'listbox', BUTTON: 'button',
};

let uid = 0;
const nextId = () => `n${(uid++).toString(36)}`;

function isRendered(el: Element): boolean {
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  const he = el as HTMLElement; // APC parity: opacity:0 + hidden=until-found still count as content
  if (he.hidden && he.getAttribute('hidden') !== 'until-found') return false;
  return true;
}
function ariaRole(el: Element): string {
  return el.getAttribute('role') ?? LANDMARK_ROLE[el.tagName] ?? 'generic';
}
function accessibleName(el: Element): string | undefined {
  return el.getAttribute('aria-label')?.trim() || (el as HTMLImageElement).alt?.trim() || undefined;
}

export function walk(root: ParentNode = document.body): RawNode {
  const el = root as Element;
  const node: RawNode = {
    id: nextId(),
    role: el instanceof Element ? ariaRole(el) : 'generic',
    type: el instanceof Element ? el.tagName.toLowerCase() : undefined,
    children: [],
  };
  if (el instanceof Element) {
    const own = ownText(el); if (own) node.text = own;
    const name = accessibleName(el); if (name && !node.text) node.text = name;

    const r = el.getBoundingClientRect();
    if (r.width || r.height) node.geometry = {
      x: r.x, y: r.y, width: r.width, height: r.height,
      inViewport: r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0,
    };
    if (el.tagName === 'A') node.link = { href: (el as HTMLAnchorElement).href, rel: el.getAttribute('rel') ?? undefined };
    if (el.tagName === 'IMG') node.image = { alt: (el as HTMLImageElement).alt, src: (el as HTMLImageElement).currentSrc };
    if (isFormControl(el)) node.form = formInfo(el);
    node.interaction = interactionInfo(el);

    const sr = (el as HTMLElement).shadowRoot; // OPEN shadow roots only; closed is invisible by design
    if (sr) for (const c of sr.children) if (keep(c)) node.children!.push(walk(c));

    if (el.tagName === 'IFRAME') {
      const f = el as HTMLIFrameElement;
      node.iframe = { origin: safeOrigin(f), crossOrigin: isCrossOrigin(f) };
      if (!node.iframe.crossOrigin && f.contentDocument?.body) node.children!.push(walk(f.contentDocument.body));
    }
  }
  for (const c of el.children ?? []) if (keep(c)) node.children!.push(walk(c));
  return node;
}

function keep(el: Element) { return !SKIP_TAGS.has(el.tagName) && isRendered(el); }
function ownText(el: Element) {
  let t = ''; for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE) t += n.textContent ?? '';
  return t.replace(/\s+/g, ' ').trim() || undefined;
}
function isFormControl(el: Element) { return ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName); }
function formInfo(el: Element) {
  const i = el as HTMLInputElement; const isPassword = i.type === 'password';
  return { control: {
    fieldName: i.name || i.id || undefined, fieldType: i.type || el.tagName.toLowerCase(),
    value: isPassword ? undefined : (i.value || undefined),  // PRIVACY: never read password values (§16, §0.2)
    isPassword,
  } };
}
function interactionInfo(el: Element) {
  const he = el as HTMLElement;
  return {
    clickable: (['A','BUTTON'].includes(el.tagName) || el.getAttribute('role')==='button' || !!he.onclick) || undefined,
    editable: (isFormControl(el) || he.isContentEditable) || undefined,
    focusable: (he.tabIndex >= 0) || undefined,
    disabled: (el as HTMLInputElement).disabled || undefined,
    expanded: el.getAttribute('aria-expanded') === 'true' || undefined,
  };
}
function isCrossOrigin(f: HTMLIFrameElement) { try { void f.contentDocument; return f.contentDocument === null; } catch { return true; } }
function safeOrigin(f: HTMLIFrameElement) { try { return new URL(f.src, location.href).origin; } catch { return 'unknown'; } }
```

> **Hard ceiling:** closed Shadow DOM and cross-origin iframes are unreachable from a content script by design. This is *the* reason ServiceNow goes API-first (§12), and the main thing `chrome.debugger` would change (§11).

### 4.2 Content-script entrypoint wiring (extraction-only)

```ts
// src/entrypoints/content/core.content.ts  (spec §5.1 canonical shape)
import { walk } from '@/core/content/AxDomWalker';
import { PageContextBridge } from '@/core/content/PageContextBridge';
import { SPANavigationWatcher } from '@/core/content/SPANavigationWatcher';
import { MessageType } from '@/core/runtime/MessageType';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';

export default defineContentScript({
  matches: ['<all_urls>'], runAt: 'document_idle', world: 'ISOLATED',
  async main() {
    SPANavigationWatcher.start(() => PageContextBridge.notifyNavigation(location.href)); // MutationObserver (§5.6)
    chrome.runtime.onMessage.addListener((env: RuntimeEnvelope<{ tabId?: number }>, sender, sendResponse) => {
      if (sender.id !== chrome.runtime.id) return false;                 // §16.2
      if (env.type !== MessageType.EXTRACT_PAGE_CONTENT) return false;
      try {
        const raw = walk(document.body);
        sendResponse({ id: env.id, ok: true, data: { raw, url: location.href, title: document.title } });
      } catch (e: any) {
        sendResponse({ id: env.id, ok: false, error: { code: 'CONTENT_EXTRACT_FAILED', message: String(e?.message ?? e), retryable: false } }); // §0.3
      }
      return true; // async
    });
  },
});
```

### 4.3 Benchmark: old tool vs new core service

Because you already have a tool implementation, benchmark **old vs new** on the same fixtures — this proves the migration improves quality.

Pin 8–10 fixtures: SPA, infinite scroll, accordion/out-of-viewport, same-origin iframe, **ServiceNow case + incident**, data table, lazy article, consent overlay.

| Metric | Target | Compare |
|---|---|---|
| Text completeness | ≥ 95 % | new ≥ old |
| Noise ratio | ≤ 10 % | new ≤ old |
| Structure fidelity (0–5) | ≥ 4 | new ≥ old |
| Interactive coverage | ≥ 90 % | new ≥ old |
| Token cost | ↓ | new < old |
| Latency | ≤ 5 s hard cap (§13) | — |

**Deliverable:** `docs/extraction-benchmark.md` with an **old-tool vs core-service** column. Migration proceeds only if core wins on completeness + noise on ≥ 70 % of fixtures.

---

## 5. Phase 3 — `APCLiteNode` schema (Zod, proposed Appendix C)

```ts
// src/core/extraction/apcLite.types.ts
import { z } from 'zod';

export interface RawNode {           // content-script output BEFORE normalization
  id: string; role: string; type?: string; text?: string;
  geometry?: { x: number; y: number; width: number; height: number; inViewport: boolean };
  interaction?: Record<string, boolean | undefined>;
  link?: { href: string; rel?: string };
  image?: { alt?: string; src?: string };
  form?: { control?: { fieldName?: string; fieldType?: string; value?: string; isPassword?: boolean } };
  iframe?: { origin: string; crossOrigin: boolean };
  children?: RawNode[];
}

export const GeometrySchema = z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number(), inViewport: z.boolean() });
export const InteractionSchema = z.object({
  clickable: z.boolean().optional(), editable: z.boolean().optional(), focusable: z.boolean().optional(),
  disabled: z.boolean().optional(), expanded: z.boolean().optional(),
});
export const FormControlSchema = z.object({
  fieldName: z.string().optional(), fieldType: z.string().optional(),
  value: z.string().optional(), isPassword: z.boolean().optional(),
}).refine(c => !(c.isPassword && c.value !== undefined), 'password value must be omitted'); // invariant

export type APCLiteNode = {
  id: string; domNodeId?: number; role: string; type?: string; text?: string;
  textStyle?: { level?: number; emphasis?: boolean; size?: number };
  geometry?: z.infer<typeof GeometrySchema>;
  interaction?: z.infer<typeof InteractionSchema>;
  link?: { href: string; rel?: string };
  image?: { alt?: string; src?: string; origin?: string };
  form?: { name?: string; control?: z.infer<typeof FormControlSchema> };
  iframe?: { origin: string; crossOrigin: boolean };
  children?: APCLiteNode[];
};

export const APCLiteNodeSchema: z.ZodType<APCLiteNode> = z.lazy(() => z.object({
  id: z.string(), domNodeId: z.number().optional(), role: z.string(), type: z.string().optional(),
  text: z.string().optional(),
  textStyle: z.object({ level: z.number().optional(), emphasis: z.boolean().optional(), size: z.number().optional() }).optional(),
  geometry: GeometrySchema.optional(), interaction: InteractionSchema.optional(),
  link: z.object({ href: z.string(), rel: z.string().optional() }).optional(),
  image: z.object({ alt: z.string().optional(), src: z.string().optional(), origin: z.string().optional() }).optional(),
  form: z.object({ name: z.string().optional(), control: FormControlSchema.optional() }).optional(),
  iframe: z.object({ origin: z.string(), crossOrigin: z.boolean() }).optional(),
  children: z.array(APCLiteNodeSchema).optional(),
}));

export const APCLiteDocumentSchema = z.object({
  url: z.string(), title: z.string(), extractedAt: z.number(),
  source: z.enum(['dom', 'ax', 'hybrid', 'servicenow-api']),
  root: APCLiteNodeSchema,
  stats: z.object({ nodeCount: z.number(), approxTokens: z.number(), durationMs: z.number(), truncated: z.boolean() }),
});
export type APCLiteDocument = z.infer<typeof APCLiteDocumentSchema>;
```

**Invariants (fixture tests, §0.3):** password value omitted; no `script`/`style` nodes; `inViewport` set when geometry present; cross-origin iframe has no children; single-child wrappers collapsed.

---

## 6. Phase 4 — `PageContentService` (core, base code)

```ts
// src/core/extraction/PageContentService.ts
import { APCLiteDocument, APCLiteNode } from './apcLite.types';
import type { PageContext } from '@/core/content/PageContext';   // Appendix C type
import { estimateTokens } from '@/core/context/TokenBudget';
import { PageContextBridge } from '@/core/content/PageContextBridge';
import { normalize, prune, redact } from './transforms';
import { PageIndexBuilder } from './PageIndexBuilder';
import { PageContentCache } from './PageContentCache';
import { flattenMarkdown, budgetTrim, withAncestorHeadings } from './PageContentSerializer';
import { debugLog } from '@/core/log/debugLog';

const TAB_EXTRACT_TIMEOUT_MS = 5000; // §13 hard cap

export interface ExtractOptions {
  tabId: number; mode: 'default' | 'actionable';
  includeOutOfViewport?: boolean; maxNodes?: number; maxTokens?: number; // default 2000 (§22.2)
}
export interface SelectOptions { topK?: number; maxTokens?: number; expandParents?: boolean; }

export class PageContentService {
  private cache = new PageContentCache();
  private inflight = new Map<number, Promise<APCLiteDocument>>(); // concurrency guard (APC parity)

  async extract(opts: ExtractOptions): Promise<APCLiteDocument> {
    if (this.inflight.has(opts.tabId)) return this.inflight.get(opts.tabId)!; // coalesce dup requests
    const p = this.doExtract(opts).finally(() => this.inflight.delete(opts.tabId));
    this.inflight.set(opts.tabId, p);
    return p;
  }
  private async doExtract(opts: ExtractOptions): Promise<APCLiteDocument> {
    const started = performance.now();
    try {
      const raw = await PageContextBridge.requestExtraction(opts.tabId, TAB_EXTRACT_TIMEOUT_MS);
      let root = normalize(raw.raw);
      root = prune(root, { includeOutOfViewport: opts.includeOutOfViewport ?? true });
      root = redact(root); // redact BEFORE indexing (§4.4, §16)
      const doc: APCLiteDocument = {
        url: raw.url, title: raw.title, extractedAt: Date.now(), source: 'dom', root,
        stats: { nodeCount: count(root), approxTokens: estimateTokens(flattenMarkdown(root)),
                 durationMs: performance.now() - started, truncated: false },
      };
      this.cache.set(opts.tabId, doc);
      return doc;
    } catch (e: any) {
      debugLog('CONTENT_EXTRACT_FAILED', e?.message ?? String(e), { tabId: opts.tabId }); // §0.3
      throw e;
    }
  }
  async getForTab(tabId: number, opts: Partial<ExtractOptions> = {}) {
    return this.cache.get(tabId) ?? this.extract({ tabId, mode: 'default', ...opts });
  }
  selectRelevant(doc: APCLiteDocument, query: string, opts: SelectOptions = {}): APCLiteNode[] {
    const index = PageIndexBuilder.getOrBuild(doc);
    const nodes = index.search(query).map(h => findById(doc.root, String(h.id))).filter(Boolean) as APCLiteNode[];
    const withCtx = opts.expandParents ? withAncestorHeadings(doc.root, nodes) : nodes;
    return budgetTrim(withCtx, opts.maxTokens ?? 2000); // §22.2
  }
  toPageContext(doc: APCLiteDocument): PageContext {
    return { url: doc.url, origin: safeOrigin(doc.url), hostname: safeHostname(doc.url),
             title: doc.title, markdown: flattenMarkdown(doc.root), meta: {}, extractedAt: doc.extractedAt };
  }
  invalidate(tabId: number) { this.cache.delete(tabId); PageIndexBuilder.drop(tabId); }
}

function count(n: APCLiteNode): number { return 1 + (n.children?.reduce((s, c) => s + count(c), 0) ?? 0); }
function findById(n: APCLiteNode, id: string): APCLiteNode | null {
  if (n.id === id) return n; for (const c of n.children ?? []) { const r = findById(c, id); if (r) return r; } return null;
}
function safeOrigin(u: string) { try { return new URL(u).origin; } catch { return ''; } }
function safeHostname(u: string) { try { return new URL(u).hostname; } catch { return ''; } }
```

**Serializer & token estimate** (`PageContentSerializer.ts`, `TokenBudget.ts`): markdown flatten (headings→`#`, listitems→`-`, links→`[t](href)`), `budgetTrim`, `withAncestorHeadings`; token estimate uses the spec §2.2 fallback (`length/4`, CJK `length/3`).

**Reliability (APC parity):** concurrency coalescing (above); navigation invalidation via `SPANavigationWatcher` + `tabs.onUpdated`; 5 s timeout with DOM/Readability fallback (`source:'dom'`); metrics logged to Diagnostics (§4.5).

---

## 7. Phase 4.6 — MiniSearch integration (reuse core engine)

```ts
// src/core/extraction/PageIndexBuilder.ts
import MiniSearch from 'minisearch';                    // spec §7.7 — already core dep
import type { APCLiteDocument, APCLiteNode } from './apcLite.types';

interface PageSearchDoc { id: string; role: string; text: string; path: string; }
const cache = new Map<string, MiniSearch<PageSearchDoc>>(); // key: url@extractedAt — EPHEMERAL

function flattenTextNodes(n: APCLiteNode, path: string[] = []): PageSearchDoc[] {
  const here = n.role === 'heading' && n.text ? [...path, n.text] : path;
  const out: PageSearchDoc[] = [];
  if (n.text) out.push({ id: n.id, role: n.role, text: n.text, path: here.join(' › ') });
  for (const c of n.children ?? []) out.push(...flattenTextNodes(c, here));
  return out;
}
export const PageIndexBuilder = {
  getOrBuild(doc: APCLiteDocument) {
    const key = `${doc.url}@${doc.extractedAt}`;
    if (cache.has(key)) return cache.get(key)!;
    const mini = new MiniSearch<PageSearchDoc>({
      fields: ['text', 'role', 'path'], storeFields: ['id', 'role', 'text', 'path'],
      searchOptions: { boost: { text: 2 }, fuzzy: 0.1, prefix: true },
    });
    mini.addAll(flattenTextNodes(doc.root)); cache.set(key, mini); return mini;
  },
  drop(keyPart: number | string) { for (const k of cache.keys()) if (k.includes(String(keyPart))) cache.delete(k); },
};
```

**Wiring:** if `approxTokens > 2000` (§22.2) → serialize `selectRelevant(doc, userInput)`; mark `compressionApplied:'topk'` in provenance (§2.6). Minimal mode (§2.5) → always `selectRelevant`. Actionable/Agent mode → structured tree stays truth; MiniSearch only ranks for `findElement`. Page indexes are **ephemeral** — never IndexedDB.

---

## 8. Phase 5 — Tools become thin wrappers over core

### 8.1 Built-in `get-page-content` (#1, §10.5) — migrated

```ts
// src/core/mcp/tools/getPageContent.ts
import { z } from 'zod';
import { pageContentService } from '@/core/extraction/singleton';

export const getPageContentTool = {
  name: 'get-page-content', dangerous: false,           // unchanged schema (backward compat, §1.2)
  inputSchema: z.object({ tabId: z.number().optional() }),
  outputSchema: z.object({ markdown: z.string(), truncated: z.boolean() }),
  async run({ tabId }: { tabId?: number }) {
    const id = tabId ?? (await activeTabId());
    const doc = await pageContentService.getForTab(id);  // now backed by CORE
    return { markdown: pageContentService.toPageContext(doc).markdown ?? '', truncated: doc.stats.truncated };
  },
};
```

### 8.2 Scoped Agent tools

| Tool | Backed by | Notes |
|---|---|---|
| `getPageContent` | `getForTab` → `toPageContext` | reasoning/summarize |
| `searchPageContent` | `selectRelevant()` (MiniSearch) | long-page retrieval under 2 000-token budget |
| `getInteractiveElements` | `extract(mode:'actionable')` filter `interaction` | node ids + geometry |
| `findElement` | MiniSearch rank over cached tree | returns `APCLiteNode.id` for action targeting |
| `getFormSchema` | `form` nodes | **no** password values |

Rules: read/query-only; return stable ids; go through core `MiniSearchIndex`; validated by `ExecutorService` closed enum (§1.2).

---

## 9. Messaging base code (`RuntimeEnvelope`, App. C/E)

```ts
// src/core/content/PageContextBridge.ts
import { MessageType } from '@/core/runtime/MessageType';
import type { RuntimeEnvelope, ResponseEnvelope } from '@/core/runtime/RuntimeEnvelope';
import type { RawNode } from '@/core/extraction/apcLite.types';

export const PageContextBridge = {
  async requestExtraction(tabId: number, timeoutMs: number): Promise<{ raw: RawNode; url: string; title: string }> {
    const env: RuntimeEnvelope<{ tabId: number }> = {
      id: crypto.randomUUID(), type: MessageType.EXTRACT_PAGE_CONTENT,
      createdAt: Date.now(), source: 'sidepanel', target: 'content', payload: { tabId },
    };
    const call = chrome.tabs.sendMessage(tabId, env) as Promise<ResponseEnvelope<{ raw: RawNode; url: string; title: string }>>;
    const res = await Promise.race([call, new Promise<never>((_, rej) =>
      setTimeout(() => rej(Object.assign(new Error('TIMEOUT'), { code: 'TIMEOUT' })), timeoutMs))]); // §13
    if (!res.ok) throw Object.assign(new Error(res.error.message), { code: res.error.code });
    return res.data;
  },
  notifyNavigation(_url: string) { /* emit SPA-nav → PageContentService.invalidate(tabId) */ },
};
```

`MessageType.EXTRACT_PAGE_CONTENT` already exists in Appendix E — no new message type needed.

---

## 10. Tests (fixture-first, §0.3 + §24)

```
tests/core/extraction/apcLite.schema.test.ts        # Zod invariants (password omit, no script)
tests/core/extraction/AxDomWalker.test.ts           # jsdom: iframe merge, open shadow root, roles
tests/core/extraction/PageContentService.test.ts    # concurrency coalesce, 5s timeout, cache invalidate
tests/core/extraction/PageIndexBuilder.test.ts      # selectRelevant under 2000 tokens
tests/core/extraction/migration.parity.test.ts      # old tool vs core service parity on fixtures
tests/addons/servicenow/ServiceNowContextExtractor.test.ts  # API-first + fallback
tests/isolation/no-content-script-ui.test.ts        # walker bundle has NO React/AntD (§18 Phase 8)
```

Covered by `verify:phase-8` (`tests/core/content`, `tests/addons`, `tests/isolation`) + perf/isolation scripts (§24).

---

## 11. `chrome.debugger` — feature/changes required & is it worth it?

### 11.1 What it would unlock
`Accessibility.getFullAXTree` is built at the **browser level**, so it flattens **closed Shadow DOM (Web Components)** and **cross-origin content** that the content-script walk (§4.1) cannot reach.

### 11.2 Required features & changes

| Area | Change | Spec/UX impact |
|---|---|---|
| **Manifest (§16.4)** | Add `"debugger"` to `permissions` | Not currently present — visible Hard-Rule change |
| **Consent** | Explicit opt-in flow (privacy-first) | New onboarding step (Flow 9-style) |
| **Lifecycle** | `attach → enable → getFullAXTree → detach`; handle `onDetach`, reattach, single-client conflict | New `DebuggerSession` manager; breaks if DevTools open or another debugger client attached |
| **UX** | Persistent, **non-dismissable** yellow banner: *"NowPilot started debugging this browser"* | Conflicts with lightweight/trust-first feel |
| **Store** | `debugger` triggers heightened Chrome Web Store review + disclosures | Slower/riskier review |
| **Perf** | attach/detach per extraction adds latency | Must stay under 5 s cap (§13) |
| **Fallback** | Must degrade to content-script walk when attach denied/unavailable | Dual code path to maintain |
| **Error codes** | Possibly `CONTENT_UNREACHABLE_DOM` (propose to §21.6) | Requires ratification (§0.2) |

### 11.3 Cost / benefit for NowPilot

**Benefits**
- Pierces **closed** Web Components (e.g. ServiceNow Next Experience / Agent Workspace).
- Reaches cross-origin iframe content.
- Higher semantic fidelity (browser-computed AX tree).

**Costs**
- Persistent debugger banner (poor UX, erodes trust).
- Single-debugger-client conflict with DevTools/other extensions.
- Privacy-first violation → mandatory opt-in + disclosures.
- Chrome Web Store scrutiny.
- Dual extraction paths to build and maintain.

### 11.4 Recommendation — **Not worth it for v0.1**

The decisive factor: your primary pain point is **ServiceNow**, and you're already solving it **API-first** (§12), which returns richer, complete structured data than any AX scrape could. So the debugger's headline benefit (closed-shadow-DOM piercing) is **largely redundant** for your highest-value target, while the banner + conflicts + store + privacy costs are real and immediate.

**Do this instead:**
- Ship core extraction on the **permission-free content-script path** (§4).
- Keep `chrome.debugger` behind a **feature flag** as an *optional, opt-in* prototype (`prototype/ax-extractor.ts`), **not** in the v0.1 content bundle.
- **Adopt `chrome.debugger` in v2** together with **browser automation** — that is the ratified trigger (see §11a). At that point one CDP attachment serves *both* high-fidelity AX extraction *and* trusted input dispatch.

```ts
// prototype/ax-extractor.ts  (NOT shipped; requires manifest "debugger" + opt-in)
await chrome.debugger.attach({ tabId }, '1.3');
await chrome.debugger.sendCommand({ tabId }, 'Accessibility.enable');
const { nodes } = await chrome.debugger.sendCommand({ tabId }, 'Accessibility.getFullAXTree');
await chrome.debugger.detach({ tabId });
```

---

## 11a. Browser Automation Strategy — **deferred to v2**

### 11a.1 v0.1 is read-only by design
NowPilot v0.1 **extracts** pages but does **not act** on them. Per spec, content scripts are **extraction-only** — "MUST NOT modify host page DOM except non-visible read operations" (§5.6) — and page injection/UI is deferred to v0.2+ (§25). The Agent (Planner → Executor → Renderer, §1.2) acts only through the **12 built-in tools + MCP + skills** (§10.5): `create-note`, `search-notes`, `run-skill`, `execute-webhook`, ServiceNow **Table API**, etc. **None of these click or type on the host page.** NowPilot "controls" systems via **structured APIs**, not by driving the browser UI. This is deliberate — safer and more reliable than UI automation.

### 11a.2 Why automation requires `chrome.debugger` (trusted events)
Real automation (click/type/navigate) needs **trusted input events** (`event.isTrusted === true`). Only two methods exist for an extension, and only one is trusted:

| Method | Mechanism | `isTrusted` | Reliable for automation? |
|---|---|---|---|
| Content-script DOM (`el.click()`, `el.value=…`, `dispatchEvent`) | Synthetic JS events | ❌ false | **No** — framework-controlled inputs (React/Angular) ignore raw `value` sets; many security-sensitive actions reject untrusted events |
| **`chrome.debugger` + CDP `Input` domain** (`Input.dispatchMouseEvent` / `dispatchKeyEvent`) | Browser-level synthetic input | ✅ true | **Yes** — indistinguishable from a real user; this is how Puppeteer/Playwright/agentic browsers drive pages |

**Conclusion:** page-level automation is **not achievable** with content-script DOM control on complex apps. It **requires `chrome.debugger`**. Since v0.1 does no host-page automation, v0.1 needs no debugger permission — but **v2 automation makes `chrome.debugger` mandatory.**

### 11a.3 What v2 automation adds (checklist for later)
- **Manifest:** add `"debugger"` to `permissions` (§16.4) + document the persistent banner.
- **Consent:** explicit opt-in flow (privacy-first), per-site or per-session.
- **`DebuggerSession` manager:** attach/detach lifecycle, `onDetach` recovery, single-client conflict handling (DevTools open, other debuggers).
- **Automation tools (new Agent tools):** `clickElement`, `typeText`, `navigate`, `waitFor` — all resolving a **stable `APCLiteNode.id`** first.
- **Shared CDP session:** the same attachment powers `Accessibility.getFullAXTree` (high-fidelity extraction, incl. closed shadow DOM) **and** `Input.*` dispatch — so the debugger cost is amortized across both.
- **Safety:** pre-action verification (APC "Safety" principle) + permission gate per §10.4 (dangerous tools always prompt).
- **Error codes:** propose `AUTOMATION_TARGET_NOT_FOUND`, `DEBUGGER_ATTACH_FAILED` to §21.6 (ratify per §0.2).

### 11a.4 How automation reuses this guide's schema
The `APCLiteNode` schema (§5) is **automation-ready**: it already carries `geometry` (bounding box) and `interaction` (clickable/editable/focusable). The v2 flow:

```
findElement(query)  →  APCLiteNode.id  →  node.geometry  →
   chrome.debugger  Input.dispatchMouseEvent(x + w/2, y + h/2, 'mousePressed'/'mouseReleased')
                    Input.dispatchKeyEvent(...) for typing
```

So building extraction correctly now (with geometry + interaction) means **no schema rework** when automation lands in v2 — you only add the `DebuggerSession` + input-dispatch layer.

### 11a.5 Recommendation
- **v0.1 / v0.2:** stay API/tool-driven. No host-page automation. No `debugger` permission.
- **v2:** introduce browser automation as a first-class feature; adopt `chrome.debugger` for **both** trusted input and high-fidelity AX extraction in one session. Write a short **v2 Automation addendum spec** (analogous to §25's page-injection plan) before implementation.

---

## 12. ServiceNow — API-first, extraction as fallback

**Decision tree (owned by the ServiceNow add-on):**
```
ServiceNow case / incident?
   │ yes → tokens available (JSESSIONID + sysparmCK)?
   │         │ yes → SNowTableClient.getRecord() → SNowCaseData  [PRIMARY]
   │         │ no  → PageContentService fallback (cross-frame + open shadow DOM)
```
- **Why API-first:** Classic renders in the `gsft_main` iframe; Next Experience uses **closed** Web Components — both largely invisible to a content-script walk. The Table API returns complete `SNowCaseData` (number, description, state, priority, comments, work notes — Appendix C).
- **Boundary:** ServiceNow selectors/token names live **only** in `src/addons/servicenow/**` (§0.2). All cross-origin calls via `PROXY_FETCH` (§10.7); tokens attached in the SW.

```ts
// src/addons/servicenow/extract/ServiceNowContextExtractor.ts
import type { IContextExtractor, PageContext } from '@/core/content/PageContext'; // Appendix C
import { SNowTableClient } from './SNowTableClient';
import { toPageContextFromCase } from './snowSerialize';
import { debugLog } from '@/core/log/debugLog';

const SN_HOSTS = /(^|\.)service-now\.com$|(^|\.)servicenow\.com$/; // selectors/tokens live ONLY here (§0.2)

export class ServiceNowContextExtractor implements IContextExtractor {
  id = 'servicenow';
  supports(url: string) { try { return SN_HOSTS.test(new URL(url).hostname); } catch { return false; } }
  async extract(doc: Document): Promise<PageContext> {
    try {
      const { table, sysId } = parseRecordUrl(doc.location.href); // e.g. incident.do?sys_id=...
      if (table && sysId) {
        const record = await SNowTableClient.getRecord(table, sysId); // Table API via PROXY_FETCH
        return toPageContextFromCase(record, doc.location.href);       // structured → PageContext
      }
    } catch (e: any) {
      debugLog('CONTENT_EXTRACT_FAILED', `SN API path failed: ${e?.message}`, { url: doc.location.href }); // §0.3
    }
    throw Object.assign(new Error('SN_FALLBACK_TO_CORE'), { code: 'CONTENT_EXTRACT_FAILED' }); // → core fallback
  }
}
function parseRecordUrl(href: string): { table?: string; sysId?: string } {
  try {
    const u = new URL(href);
    const m = u.pathname.match(/\/([a-z0-9_]+)\.do$/i);
    return { table: m?.[1], sysId: u.searchParams.get('sys_id') ?? undefined };
  } catch { return {}; }
}
```

---

## 13. Deliverables & spec-aligned file paths

| Phase | Files |
|---|---|
| Migration | Delete old tool-layer extractor (M5); keep `get-page-content` wrapper |
| 1 | `docs/apc-study-notes.md` |
| 2 | `src/core/content/AxDomWalker.ts`, `src/entrypoints/content/core.content.ts`, `docs/extraction-benchmark.md` (old-vs-core) |
| 3 | `src/core/extraction/apcLite.types.ts` (+ proposed Appendix C) |
| 4 | `src/core/extraction/{PageContentService,PageContentSerializer,PageContentCache,transforms}.ts`, `src/core/context/TokenBudget.ts` |
| 4.6 | `src/core/extraction/PageIndexBuilder.ts` (uses `src/core/search/MiniSearchIndex.ts`) |
| 5 | `src/core/mcp/tools/getPageContent.ts`, `src/agent/tools/page-content/*` |
| 12 | `src/addons/servicenow/extract/{ServiceNowContextExtractor,SNowTableClient,snowSerialize}.ts` |
| 9 | `src/core/content/PageContextBridge.ts` |
| optional | `prototype/ax-extractor.ts` (flagged, not shipped) |

---

## 14. Proposed spec additions (ratify before code lands, §0.2)

1. **Appendix C:** `RawNode`, `APCLiteNode`, `APCLiteDocument` (+ Zod) under `src/core/extraction/`.
2. **§8.5 file tree:** add `src/core/extraction/{apcLite.types,PageContentService,PageContentSerializer,PageIndexBuilder,PageContentCache,transforms}.ts`.
3. **Error codes (§21.6):** reuse `CONTENT_EXTRACT_FAILED`, `TIMEOUT`, `HOST_NOT_PERMITTED`, `SESSION_TOKEN_MISSING`, `CONTEXT_TOO_LARGE`. *(Propose `CONTENT_UNREACHABLE_DOM` only if the debugger path is adopted; `AUTOMATION_TARGET_NOT_FOUND` / `DEBUGGER_ATTACH_FAILED` for v2 automation.)*
4. **Permission (§16.4):** add `"debugger"` **only** for v2 browser automation (see §11a) — otherwise leave unchanged.

---

## 15. Privacy / security / compliance checklist
- [ ] Password values never read (`isPassword ⇒ value omitted`) — `formInfo` + Zod refine.
- [ ] `script`/`style`/hidden nodes excluded.
- [ ] Cross-origin iframes: origin only, no children.
- [ ] `redact()` runs **before** indexing and before any `debugLog` (§4.4, §16).
- [ ] Page MiniSearch indexes **ephemeral** — never IndexedDB.
- [ ] Content bundle: no React/AntD, < 50 KB (§22.1, isolation test).
- [ ] ServiceNow tokens/selectors only in `src/addons/servicenow/**` (§0.2).
- [ ] Core (`src/core/extraction/**`) never imports `src/addons/**` (§0.2).
- [ ] All cross-origin fetches via `PROXY_FETCH` (§10.7); host checked → `HOST_NOT_PERMITTED`.
- [ ] Every `catch` calls `debugLog(code, …)` (§0.3).
- [ ] `chrome.debugger` **not** added to manifest in v0.1/v0.2 — reserved for **v2 browser automation** (§11a).
- [ ] No host-page automation in v0.1 — content scripts stay extraction-only; Agent acts only via tools/APIs (§5.6, §11a).

---

## Appendix A — Reference sources
- Chromium APC: `readme.md`, `ai_page_content_agent.cc` (+ `_unittest.cc`), `ai_page_content.mojom`, `page_content_proto_provider.h`.
- CDP (optional): `Accessibility.getFullAXTree` / `Accessibility.enable` (1.3); `Input.dispatchMouseEvent` / `dispatchKeyEvent` (v2 automation).
- NowPilot spec `PRODUCT_SPEC_v0_1.md`: §0.2/§0.3 (hard rules), §2.2 (token est.), §2.3 (`ContextOptimizerInput`), §2.5 (minimal mode), §2.6 (provenance), §3.2 & §8.5 (MiniSearch core), §5.1/§5.6 (content scripts), §9.7 (ServiceNow), §10.5 (`get-page-content`), §10.7 (`PROXY_FETCH`), §13 (timeouts), §16.4 (permissions), §21.6 (error codes), §22.1/§22.2 (perf + budgets), §25 (deferred injection), Appendix C/E (types + messaging).

> **Reminder:** APC is Blink-internal and changes often — a *blueprint*, not a dependency. Re-verify Chromium paths against current `main` before implementing.
