> **⚠ PRECEDENCE NOTICE (added 2026-08-19).** This doc recommends **holding** three packages at versions BELOW the spec's §7 pins (WXT, Immer, Zod) and originally mis-stated Defuddle's execution context. Those are now flagged inline. **The spec's §7 pins are authoritative until an ADR records the deviation** — see **`RESEARCH-RECONCILIATION.md` §A** for the decision table. All version *numbers* dated 2026-08-19 (TS 7.0.2, Vitest 4.1.11, antd 6.6.1, CWS API shutdown date, etc.) are `VERIFY-AT-IMPLEMENTATION` — re-check at each phase, do not hard-code as fact.

# Stack Research

**Domain:** Privacy-first Chrome MV3 AI assistant + personal knowledge platform (ServiceNow Support Engineers)
**Researched:** 2026-08-19
**Confidence:** MEDIUM (web-verified); HIGH where pinned by spec §7 + npm registry + official docs agree

> **Scope note.** The stack is **LOCKED by spec §7** (WXT + React 19 + TypeScript + Ant Design v6 + Ant Design X 2.x + Zustand/immer + vitest; no tailwind/shadcn/@radix-ui/framer-motion). This document does not re-litigate the choice. It verifies **currency** of every pinned version against npm/official docs, and catalogs the **version gotchas and MV3 constraint traps** that phases 1–19 will hit. Version numbers below were verified against `package.json`, `pnpm-lock.yaml`, and the npm registry on 2026-08-19.

## Recommended Stack

### Core Technologies

| Technology | Installed | Latest (2026-08-19) | Purpose | Recommendation & Rationale |
|------------|-----------|---------------------|---------|----------------------------|
| WXT | 0.20.27 | 0.21.4 | Extension framework (MV3 build, entrypoints, auto-imports) | **HOLD 0.20.27 for v0.1.** WXT is pre-1.0: a `0.x` minor bump is a breaking major. v0.20 is positioned as the v1.0 release candidate. v0.21.4 is current but ships a long breaking-change list (see Version Compatibility) that would churn every phase's verify gates. Upgrade as a dedicated chore post-v0.1. `^0.20.27` correctly does NOT auto-jump to 0.21 — intentional, keep it. **✅ RESOLVED 2026-08-19: HOLD `wxt@^0.20.27` for v0.1 accepted — deviation recorded in ADR-STACK-01 (0.21 is a dedicated post-v0.1 chore). See RESEARCH-RECONCILIATION.md §F. Authoritative v0.1 version: `wxt@^0.20.27`.** |
| React / React-DOM | 19.2.8 | 19.2.8 | UI runtime | Current. antd v6 requires React ≥ 18 and supports 19 natively — the `@ant-design/v5-patch-for-react-19` package must NOT be added (it is a v5-era workaround; none present ✓). |
| Ant Design (antd) | 6.5.2 | 6.6.1 | Component library (Layout, Modal, Select, Tabs…) | Bump to `^6.6.1` during a routine maintenance pass — same major, patch-level differences. v6 defaults to **pure CSS-variable mode** (cssinjs v6): themes switch by replacing CSS vars, no runtime style serialization per theme. |
| @ant-design/x | 2.9.0 | 2.9.0 | AI chat/markdown components | Current — equals latest. Peer dep `antd ^6.1.1` satisfied by 6.5.2/6.6.x. Do **not** downgrade to 1.x (1.x uses antd-internal APIs and does not support antd v6). |
| @ant-design/x-markdown | 2.9.0 | 2.9.0 | Markdown rendering (vendored katex/prism per vite.config.ts) | Current. Keep vendored katex/prism chunks as configured — do not switch to default CDN paths (CSP + offline). |
| Zustand | 5.0.14 | 5.0.15 | State management (persist + immer) | Trivial bump to 5.0.15 is safe. Pattern in use (vanilla store + `persist` + `immer`) is the correct extension pattern; see MV3 Patterns §6. |
| Immer | 10.2.0 | 11.1.17 | Immutable updates | HOLD 10.2.0. Zustand peer is `immer >=9.0.6` — satisfied. Immer 11 is a new major. **✅ RESOLVED 2026-08-19: this "hold" is OVERRULED — ADOPT `immer@^11` per spec §7.3 (rationale is prototype-pollution hardening, a security fix; `produce`/draft API is unchanged). See RESEARCH-RECONCILIATION.md §F. Authoritative version: `immer@^11`.** |
| Vitest | 3.2.7 | 4.1.11 | Test runner | **HOLD `^3.2.7` for v0.1.** Vitest 4 (needs Vite ≥ 6, Node ≥ 20) is current, but compatibility with WXT 0.20.x's testing plugin is unverified. Revisit only with the WXT 0.21 upgrade. |
| Vite | 8.2.1 | 8.2.1 | Bundler/dev server | Current. Note WXT 0.21 requires `^6.3.4 \|\| ^7 \|\| ^8` — already satisfied, one less upgrade blocker. |
| TypeScript | 5.8.3 | **7.0.2** | Type checking | **HOLD `~5.8`.** TS 7.0 is the Go-native rewrite — a major migration, absolutely not mid-milestone. WXT 0.21 needs ≥ 5.4 (satisfied). |
| Tailwind CSS | 4.3.3 | 4.3.3 | Utility CSS (`@tailwindcss/vite` plugin in wxt.config.ts + `src/index.css`) | **⚠ SPEC CONFLICT:** spec §0.2 forbids tailwind in the product stack, but the scaffold wires `tailwindcss()` into `wxt.config.ts` and `src/index.css`. Treat as scaffold leftover: remove the plugin + CSS before release (or record an explicit ADR exemption if mockup work depends on it). Flag for Phase 1. |
| Zod | ^3.24.0 | (3.x/4.x line) | Runtime validation (envelopes, boundaries) | Keep for validation at boundaries. Also use for zustand-persist rehydration validation (createJSONStorage performs zero runtime checks). **✅ RESOLVED 2026-08-19: this "keep 3.24" is OVERRULED — ADOPT `zod@^4` per spec §7.4 (aligns with MCP SDK + AI SDK 5 which target zod/v4; `3.24.0` was below the spec's own `3.25+` floor). Appendix L keeps `zod-to-json-schema` regardless. See RESEARCH-RECONCILIATION.md §F. Authoritative version: `zod@^4`.** |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @ant-design/icons | 6.3.2 | Icon set | Already installed. antd v6 requires icons ≥ 6.0.0 ✓. |
| motion | ^12.23.24 | Animations (onboarding, panels) | Installed. Successor of framer-motion — fine, spec's "no framer-motion" refers to the old package name; keep the `motion` import. |
| lucide-react | ^1.31.0 | Secondary icon set | Installed. Keep as complement, not replacement, for icons. |
| **idb** (new, spec-pinned §Appendix) | `^8` → 8.0.3 current | Typed IndexedDB wrapper (MemoryDB, WriteJournal, AITransactionLogDB, notes_backup_config) | Phase 2+ (IndexedDBMigrator, MemoryDB). Tiny, promise-based, zero magic — right size for extension code. **Not** Dexie (heavy, liveQuery overkill) — spec pins idb. |
| **defuddle** (new, spec-pinned) | `^0.19` → 0.19.2 current | Primary main-content extraction → clean Markdown | Phase 6/17 (PageContentService DefuddleStrategy). Use the **`defuddle/full`** bundle (adds `mathml-to-latex` + `temml` for reliable math/Markdown). Call `parse()` **synchronously** with `{ markdown: true, url, useAsync: false }` — `useAsync: false` is **mandatory** (disables third-party API extractors like FxTwitter; privacy posture §0.2). **⚠ CORRECTION (reconciled 2026-08-19):** Defuddle runs **PANEL-SIDE (side panel / standalone)**, NOT in the content script — the content script only serializes stripped HTML + stamps the base URL, and the panel parses a detached `DOMParser` doc (spec §26.4, ARCHITECTURE.md §3.3/Pattern 6). Bundling Defuddle in the content script would blow the <50 KB extraction bundle and fail the `no-content-script-ui` isolation grep (§24). The detached-doc/`getComputedStyle` viability is a **Phase 6 research spike** — see RESEARCH-RECONCILIATION.md §B. |
| @mozilla/readability (new, spec-pinned) | `^0.6` → 0.6.0 current | Fallback extraction when Defuddle yields low-confidence output | Phase 6. Readability is `0.x`: `^0.5` would NOT auto-jump to 0.6 — the spec's `^0.6` pin matters. API unchanged (`new Readability(doc).parse()`). |
| turndown (new, spec-pinned) | `^7` → 7.2.4 current | HTML → Markdown for the APC-lite path (non-Defuddle output) | Phase 6. |
| **minisearch** (new, spec-pinned) | `^7` → 7.2.0 current | In-memory full-text search (notes index + ephemeral page index) | Phase 5/8 (MiniSearchIndex, PageIndexBuilder, NoteQA top-5 snippets). Zero deps, ~2M weekly downloads. Serialize with `JSON.stringify(ms)` / `MiniSearch.loadJSON(json, SAME options)`; `loadJSONAsync` + `addAllAsync` to avoid main-thread stalls. |
| @webext-core/fake-browser | 2.0.1 | In-memory `browser` polyfill for tests | Dev-only. Use via `wxt/testing/fake-browser` when tests touch extension APIs. v2 dropped promise-returning `onMessage` mocks — use `sendResponse`. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| pnpm 11.22 | Package manager | Keep pnpm as primary (workspace + lockfile). npm 12 also present; don't mix lockfiles — delete `package-lock.json` or keep it in sync deliberately. |
| vitest 3.2.7 + jsdom 25 + @testing-library/react 16.0.0 | Unit/component tests | Current plain config (vitest.config.ts, jsdom, setup file) works for store/component/runtime tests. **Do not adopt `WxtVitest()` yet** unless tests need real extension API mocks — it historically broke under jsdom (esbuild invariant, wxt#1575; fixed only by the submodule split in later WXT). When adopting, import from `wxt/testing/vitest-plugin` submodule (barrel export is removed in 0.21). |
| `verify:phase-N` scripts | Phase gates | Already defined in package.json. Keep `tsc --noEmit` as the type gate — note the project runs `strict: false`; WXT 0.21's generated tsconfig flips `strict: true` + `verbatimModuleSyntax` + `noUncheckedIndexedAccess` (biggest 0.21 migration cost for this codebase). |
| wxt CLI (`wxt` / `wxt build`) | Extension dev/build | `webExt.disabled: true` — fine; v0.21 makes `web-ext` an optional peer you simply don't install. |

## Installation

```bash
# Current v0.1 stack (already installed — no changes)
pnpm install

# Routine maintenance bumps (same majors, safe)
pnpm add antd@^6.6.1 zustand@^5.0.15

# Later phases — spec-pinned, verified current (install at the phase, not now)
# Phase 2 (IndexedDB): idb@^8
# Phase 6 (extraction): defuddle@^0.19 @mozilla/readability@^0.6 turndown@^7
# Phase 5/8 (search): minisearch@^7
pnpm add idb@^8 defuddle@^0.19 @mozilla/readability@^0.6 turndown@^7 minisearch@^7

# WXT 0.21 upgrade (POST-v0.1, dedicated chore — see migration checklist below)
pnpm add -D wxt@^0.21.4   # vite + typescript already present; web-ext optional, skip
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| WXT 0.20.27 (held) | WXT 0.21.4 | Only as a dedicated post-v0.1 chore with the migration checklist below. Not mid-milestone. |
| fetch + ReadableStream SSE parser | Native `EventSource` in AI service | EventSource **works** in side panel/standalone (DOM contexts) but has unreliable auto-reconnect in extension contexts and no unified AbortController story. Use fetch-stream + line-buffer parser (already the scaffold's approach) — deterministic cancellation, `[DONE]` handling, and one parser for all providers. |
| defuddle primary / Readability fallback (two-tier) | Readability-only | defuddle standardizes output (footnotes/code/math), extracts schema.org metadata, is more forgiving, and is actively maintained (built for Obsidian Web Clipper). Readability is conservative and slower to improve; keep as fallback only — the spec's layered strategy. |
| idb ^8 (spec-pinned) | Raw IndexedDB / Dexie | Raw IDB is boilerplate-heavy; Dexie is a large dependency with liveQuery machinery the extension doesn't need. idb is the spec's choice and the right size. |
| MiniSearch 7.2.0 | Lunr / Fuse.js / Orama | MiniSearch: zero deps, tiny, prefix+fuzzy+boosting+autosuggest, serializable index. Fuse.js has no real inverted index (slow at scale); Orama is newer/less proven. Spec pins minisearch. |
| chrome.storage.local for bodies | IndexedDB for bodies | storage.local has a 10 MB default quota and LevelDB corruption risk with huge single keys (well-documented MetaMask 75 MB key anecdote). Bodies/index blobs → IndexedDB; small config + secrets → storage.local. Spec already mandates this split. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `EventSource` in the background service worker | Not available in Chrome SWs; also banned by spec §0.2. | AI streaming lives in side panel/standalone only: `fetch` + `ReadableStream.getReader()` + `TextDecoder({stream:true})` + SSE line-buffer parser + `AbortController`. |
| `setInterval` / `setTimeout` keepalive in SW | Dies with the worker (SW is terminated after ~30 s idle); banned by spec. | `chrome.alarms` (min period ~30 s, throttled to ~1/min after the first 5) — for the SW's actual duties (PROXY_FETCH, alarms, badge). |
| `chrome.storage.session` as a database | 10 MB hard cap, **silent** write failures past quota, in-memory only (wiped on update/reload/restart), `unlimitedStorage` does NOT apply. | session = short-lived tokens + transient UI state only (spec: tokens in session). Everything durable → storage.local (small) / IndexedDB (large). |
| IndexedDB in the background SW | Banned by spec §0.2; SW IndexedDB was buggy pre-Chrome 102 anyway. | MemoryDB/WriteJournal live in side panel/standalone contexts (full DOM pages, same extension origin — storage is shared across SW/pages/sidepanel automatically). |
| `webextension-polyfill` | Removed from WXT in v0.20; types now come from `@types/chrome`-based `@wxt-dev/browser`. Re-adding it fights the framework. | Use WXT's `browser`/`chrome` objects and `wxt/browser` types as the scaffold already does. |
| @antv/gpt-vis | Only supports antd 5.x — cannot coexist with @ant-design/x 2.x / antd 6. | Nothing — spec has no gpt-vis requirement. |
| @ant-design/x 1.x | Uses antd-internal APIs (`antd/es/theme/useToken`, `_internalContext`) — incompatible with antd v6 even if peer-deps are forced. | @ant-design/x 2.9.0 (already installed). |
| Tailwind CSS in the product build | Spec §0.2 explicitly forbids tailwind; it is a scaffold leftover wired into `wxt.config.ts` + `src/index.css`. | Remove plugin + CSS in Phase 1 or record an ADR exemption. |
| `cssVar: { key: '_,:root' }` hack to expose antd tokens globally | Unsupported; breaks component styles via CSS cascade (antd#57325, 2026-03). | `theme={{ cssVar: true, hashed: false }}` (global vars, acceptable single-theme risk) or manually sync needed tokens to `:root` via `theme.useToken()` in an effect. |
| Overriding `window.fetch` in MAIN-world content scripts to intercept page SSE | Page-level interception is out of scope for v0.1 (spec §0.2/§25 — extraction-only content scripts) and a fragile, CWS-review-sensitive pattern. | PageContentService layered extraction + tool-based `get-page-content` per spec. |
| Vitest 4.1.11 / TypeScript 7.0.2 / WXT 0.21 mid-milestone | Each is a major with unverified interaction with the pinned 0.20/3.2/5.8 trio; TS 7 is the Go rewrite. | Hold current pins; batch upgrades after v0.1 with verify:all as the gate. |

## Stack Patterns by Variant

**If a content script must return a value (e.g. `chrome.scripting.executeScript` → `InjectionResult.result`):**
- Set `globalName: true` on the entrypoint. WXT 0.21 changed the default to `false` (anonymous IIFE) — code written against 0.20 behavior must add the flag explicitly on upgrade.

**If user-configured AI endpoints (custom OpenAI-compatible base URLs, remote Ollama) are added in Options:**
- Two failure points today: (1) manifest `host_permissions` lists only `service-now.com` hosts — cross-origin fetches to unpermitted hosts from extension pages are CORS-blocked unless the server sends `Access-Control-Allow-Origin: *`; (2) `content_security_policy.extension_pages.connect-src` hard-codes only `localhost:*`, `generativelanguage.googleapis.com`, `api.anthropic.com`, `api.openai.com` — any other endpoint is CSP-blocked. Use `optional_host_permissions` + `chrome.permissions.request()` on provider-add (user gesture), and decide per-provider whether to widen `connect-src` (CWS review is sensitive to overly broad CSP).

**If long-lived connections ever need to live in the SW (architecture change — currently spec says never):**
- Offscreen document (`chrome.offscreen`, reason `WORKERS`) hosting `EventSource`; only ONE offscreen doc per extension; it dies with the SW — keep-alive via alarms. Not needed for v0.1.

**If IndexedDB ships (Phase 2+):**
- Add `"unlimitedStorage"` permission to the manifest at that phase: it exempts the extension origin (IndexedDB included) from quota and eviction. The project does not declare it today. `navigator.storage.persist()` is NOT a reliable substitute in extensions.

**If adopting WXT's vitest plugin:**
- Import from `wxt/testing/vitest-plugin` (not the `wxt/testing` barrel — removed in 0.21); mock `#imports` by mocking the real submodule paths (e.g. `wxt/utils/inject-script`); `fakeBrowser.reset()` in `beforeEach`.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| wxt 0.20.27 | vite ^8.2.1, TS ~5.8, Node ≥ 20 | Currently building ✓. `^0.20.27` will not jump to 0.21 (pre-1.0 caret semantics) — intentional. |
| wxt 0.21.4 | vite ^6.3.4\|\|^7\|\|^8 (required peer), TS ≥ 5.4, Node ≥ 22 | Project already satisfies all three — the ONLY blockers are behavioral (see checklist). |
| antd 6.5.2 → 6.6.1 | React 19.2.8, @ant-design/icons ≥ 6.0.0 (6.3.2 ✓) | Same major; safe bump. v6.0.0–6.2.x had mask blur ON by default; **6.3.0+ defaults blur OFF** — do not write styles assuming blur. `dropdownMatchSelectWidth` → `popupMatchSelectWidth`. Tag trailing margin removed. |
| @ant-design/x 2.9.0 | antd ^6.1.1 (6.5.2 ✓), React ≥ 18 | Latest. Earlier 2.x had style-loss bugs with antd 6.0.1 (fixed #1441/#1446) and a forced `es`-path Node build error (fixed #1645) — 2.9.0 is past both. |
| zustand 5.0.14/15 | immer ≥ 9.0.6 (10.2.0 ✓) | Async storage (chrome.storage) → **async hydration**; gate UI on `hasHydrated` (see Patterns). |
| vitest 3.2.7 | vite 8.2.1 (as installed) | Works today. Vitest 4.1.11 requires Vite ≥ 6 / Node ≥ 20 but WXT 0.20-compat unverified — hold. |
| jsdom 25 + @testing-library/react 16.0.0 | React 19.2.8 | jsdom 30 is latest — no need to chase. |
| defuddle ^0.19 (0.19.2) | Any DOM env; `defuddle/full` bundle | `^0.19` on a 0.x package locks the 0.19.x line (npm caret does NOT auto-jump pre-1.0 minors) — exactly what the spec wants. 0.19.x includes CVE-2026-30830 XSS fix, `data:`/`blob:` URL rejection, iframe-`sandbox` retention, SVG `<style>` stripping. DOMPurify still runs on output (defense-in-depth). |
| minisearch ^7 (7.2.0) | Any modern browser (ES6+); zero deps | v7 dropped IE11 + added `loadJSONAsync`. Serialization format is versioned (changed at v4) — **major bumps require re-indexing**; keep a schema version + re-index path in IndexedDBMigrator. |

### WXT 0.21 migration checklist (post-v0.1 chore)

1. `pnpm i wxt@latest --ignore-scripts`, fix breakages, then `pnpm wxt prepare`.
2. `vite` becomes a required peer (already present); `web-ext` optional — skip (webExt.disabled stays).
3. Generated `.wxt/tsconfig.json` flips to `strict: true`, `verbatimModuleSyntax`, `noUncheckedIndexedAccess` — this codebase runs `strict: false`; expect a large type-fix pass (either fix strictness or revert via `prepare:tsconfig` hook — **prefer fixing**).
4. Content/unlisted scripts: add `globalName: true` wherever a return value is read.
5. `wxt/testing` barrel removed → submodule imports (`wxt/testing/fake-browser`, `wxt/testing/vitest-plugin`).
6. `url:` imports removed (none used).
7. fake-browser v2: promise-returning `onMessage` mocks no longer work → `sendResponse` (affects MessageBus tests if they mock listeners).
8. `createShadowRootUi` DOM simplified (v1→v3 isolated-element) — verify shadow-root UI styling.
9. CWS: v1 publish API shuts down **2026-10-15** — when shipping, use `wxt submit init` with the v2 service-account flow.
10. Zip templates changed (`{{version}}` → `{{versionName}}` semantics) — only affects release tooling.

### MV3 constraint patterns where teams commonly break (verified 2026)

| Constraint | The trap | The rule |
|------------|----------|----------|
| SW lifetime (~30 s idle; >5 min single event) | Long SSE fetch, bulk migration, or `await` chain gets silently killed; DevTools-open hides it in dev | AI/IndexedDB out of SW (spec already enforces); alarms for periodic work; register listeners synchronously at top level; every wake is a cold start — persist to storage; test with DevTools closed |
| Content-script bundle isolation | Shared-import assumptions: content scripts are **individual IIFEs with no shared chunks**; importing extension-API-only modules at top level throws in content contexts | Each content script is self-contained (WXT builds per-entrypoint); keep extraction code isolated; CSS goes to `content-scripts/`; use messaging (RuntimeEnvelope/MessageBus) for data flow back to pages |
| chrome.storage.session | 10 MB silent cap; content scripts can't read it (TRUSTED_CONTEXTS); `onChanged` leaks values to content scripts regardless of access level (Chromium 1342046); wiped on update | session = tokens + ephemeral UI state; check `runtime.lastError`/rejected promise on writes; never put secrets in storage.local unencrypted (AES-GCM per spec) |
| IndexedDB placement | Content scripts access the **host page's** storage, not the extension's | Extraction data must be messaged back to the side panel/standalone (extension origin) where MemoryDB lives; add `unlimitedStorage` when MemoryDB ships |
| CSP `connect-src` vs user-configured providers | Hard-coded CSP whitelist silently blocks new endpoints; host_permissions CORS gap | optional_host_permissions on provider-add; widen CSP deliberately per provider (CWS review) |
| SSE parsing | Multi-byte chars split across chunks corrupt output; `\n\n` boundaries split mid-event | `TextDecoder({ stream: true })` always; buffer + split on event boundary; keep partial chunk; handle `[DONE]` |

## Sources

- **WXT** — official changelog + releases (github.com/wxt-dev/wxt), official Upgrading guide (wxt.dev/guide/resources/upgrading, v0.21.4), content-scripts/entrypoints/unit-testing docs, build-process deep-dive (deepwiki.com/wxt-dev/wxt), discussion #1352 (per-content-script IIFE bundling) — HIGH (official docs), MEDIUM (community discussions)
- **antd v6** — official migration-v6 guide (ant.design/docs/react/migration-v6), customize-theme + css-variables docs, antd#57325 (cssVar `:root` hack breaks components) — HIGH (official docs), MEDIUM (issue thread)
- **@ant-design/x** — official migration-v2 (x.ant.design), npm registry peers (antd ^6.1.1), issues #1607/#1564/#1411 (1.x vs antd 6), changelog (#1441/#1446/#1645) — HIGH
- **defuddle / Readability** — npm registry (defuddle 0.19.2, @mozilla/readability 0.6.0), github.com/kepano/defuddle (bundles, usage), HN thread 44067409 (no SW support), content-extractor-benchmark (Readability F-score 0.875) — HIGH (registry/docs), MEDIUM (community)
- **MiniSearch** — npm registry (7.2.0, 2M weekly downloads), lucaong.github.io/minisearch (API, loadJSON/loadJSONAsync, addAllAsync), CHANGELOG (v7 breaking, serialization format) — HIGH
- **MV3 service worker lifecycle** — developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle, developer.chrome.com/blog/longer-esw-lifetimes, MV3 Extension Dev Hub keepalive guide (2026-06), Crxlytics (2026-05) — HIGH (official docs), MEDIUM (blogs)
- **chrome.storage.session / storage** — developer.chrome.com storage reference (2026-05-05), w3c/webextensions#350 (10 MB consensus), errorfirst.com session-storage analysis (2026-01), Chromium 1342046 onChanged leak — HIGH (official docs), MEDIUM (analyses)
- **IndexedDB in extensions** — developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies, chromium-extensions groups (unlimitedStorage semantics, MetaMask corruption anecdote), codemyextension.com MV3 storage guide — HIGH (official docs), MEDIUM (community)
- **SSE in MV3** — bestchromeextensions.com streaming-sse-patterns, dev.to MV3 SSE interception guide (2026-03), bugzilla 1681218 (EventSource in SWs, Firefox 133) — MEDIUM
- **Zustand persist** — zustand.docs.pmnd.rs persist docs (async hydration, createJSONStorage no-validation warning), drewalth.com zustand-chrome-storage pattern, zustand#2020 (cross-context sync) — HIGH (official docs), MEDIUM (community)
- **Versions** — npm registry queries 2026-08-19 (wxt 0.21.4, antd 6.6.1, @ant-design/x 2.9.0, react 19.2.8, zustand 5.0.15, immer 11.1.17, vitest 4.1.11, minisearch 7.2.0, defuddle 0.19.2, idb 8.0.3, turndown 7.2.4, readability 0.6.0, typescript 7.0.2) — HIGH
- **Authoritative spec** — `.planning/PRODUCT_SPEC_v0_1.md` §0.2/§7/§Appendix (locked stack, idb ^8, defuddle ^0.19 full bundle + `useAsync:false`, readability ^0.6, turndown ^7, minisearch ^7, IndexedDB/SW bans, session-token policy) — HIGH (ground truth)

---
*Stack research for: NowPilot (privacy-first Chrome MV3 AI assistant + personal knowledge platform)*
*Researched: 2026-08-19*