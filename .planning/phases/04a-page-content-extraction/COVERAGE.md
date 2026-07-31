# API Coverage — Phase 04a (Page Content Extraction)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

Phase 04a external API surface: browser extension APIs exercised through the extraction pipeline (`src/core/extraction/`, `src/core/content/`, `entrypoints/content.core.ts`) and third-party parsing/indexing libraries (Defuddle, Readability, MiniSearch). Capabilities below were enumerated from live imports and API calls in `src/` at phase-seal time.

| capability | decision | reason |
|---|---|---|
| chrome.tabs.sendMessage (extract-page-content request) | INTEGRATE | Cross-context extraction request from UI/background to content script via MessageBus envelope round-trip |
| chrome.tabs.onUpdated (SPA navigation events) | INTEGRATE | PageIndexBuilder + PageContentCache invalidation on SPA nav (status 'complete' transitions) |
| chrome.tabs.onRemoved (tab close) | INTEGRATE | Per-tab page cache/index cleanup on tab close |
| chrome.runtime.sendMessage / onMessage | INTEGRATE | EXTRACT_PAGE_CONTENT handled via MessageBus.init() with sendResponse (D-04 single-handler return-value unwrap) |
| chrome.runtime.connect / Port (long-lived) | INTEGRATE | RuntimeEnvelope + PageContextBridge messaging contract (D-18 contract tests) |
| chrome.runtime.lastError | INTEGRATE | Error swallowing guard in SPA_NAVIGATION send diagnostics (WR-03 fix) |
| chrome.storage (read path) | OPT-OUT | Phase 04a does not persist extracted content; cache is ephemeral in-memory (PageContentCache). Storage writes land in a later persistence phase |
| chrome.scripting (programmatic injection) | OPT-OUT | Content script is statically declared in `entrypoints/content.core.ts`; no runtime injection needed |
| defuddle (HTML → markdown extraction) | INTEGRATE | DefuddleStrategy primary extraction (mode='default'), `defuddle/full` import with `:has()` selector support |
| @mozilla/readability (reader-view parsing) | INTEGRATE | ReadabilityFallback for degraded-confidence pages, DOM-clone guarded (charThreshold: 500) |
| minisearch (full-text indexing) | INTEGRATE | PageIndexBuilder BM25 ranking with field boosting; ephemeral per-tab index |
| zod (schema validation) | INTEGRATE | APCLiteDocumentSchema.safeParse validation of ApcLiteStrategy output trees |
| external network services | OPT-OUT | Extraction is fully local/offline; no network calls at capture time |

Note: phase 04a introduces no external service beyond local parsing libraries — all extraction runs inside the content-script sandbox with zero network I/O. The browser API surface is exercised exclusively through the MessageBus/RuntimeEnvelope abstraction (D-04, D-18), keeping consumers decoupled from the chrome.* implementation.
