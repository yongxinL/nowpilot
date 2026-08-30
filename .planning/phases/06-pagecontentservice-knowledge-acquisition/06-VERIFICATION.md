---
phase: 06-pagecontentservice-knowledge-acquisition
verified: 2026-08-30T11:05:00Z
status: passed
score: 14/14 must-haves verified
behavior_unverified: 0
overrides_applied: 0
resolution:
  - item: "Content-script entrypoint defect (entrypoints/content/core.content.ts invalid WXT shape)"
    resolved: "RESOLVED 2026-08-30 commit 45250b5 — added entrypoints/content/index.ts re-export; pnpm build:ext now registers content-scripts/content.js (9.51 kB, world ISOLATED) in the manifest; built-bundle isolation checks run green (verify:phase-6 94/94, full suite 559/559)."
---

# Phase 6: PageContentService (Knowledge Acquisition) — Verification Report

**Phase Goal:** PageContentService (Knowledge Acquisition) — layered page extraction (Defuddle + APC-lite actionable path), §26.4a extraction lifecycle cache, heading-chunked MiniSearch page index, content-script producer shells, and a green §18/§24 verification gate.
**Verified:** 2026-08-30T11:05:00Z
**Status:** passed
**Re-verification:** Yes — human verification item RESOLVED 2026-08-30 (entrypoint fix commit 45250b5)

## Goal Achievement

### Observable Truths

Consolidated from ROADMAP Phase 6 Success Criteria (5 SCs) + PLAN frontmatter must_haves (06-01..06-05; all `requirements: []` — infra phase, no spec-native IDs, confirmed absent from REQUIREMENTS.md).

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Defuddle runs panel-side; the content bundle never imports it (SC-1a, D-81, Pitfall 8) | ✓ VERIFIED | `DefuddleStrategy.ts` lives under `src/core/extraction/strategies/`; `defuddle` imports appear nowhere in `src/core/content/` or `entrypoints/content/` (0 matches); isolation gate's source grep passes |
| 2 | Content script serializes a pre-stripped HTML clone with baseUrl + truncated, never defuddle (SC-1b, D-85) | ✓ VERIFIED | `ContentScriptHost.ts` — `stripForSerialization` (script/style/noscript/svg/cross-origin iframe + form action), `document.baseURI` stamp, 2 MB element-boundary truncation (`serializeWithinBudget`), `truncated` flag; 4 tests green in gate |
| 3 | Layered fallback (Defuddle → Readability, AX → DOM) records the source used; Readability is provenance-only; servicenow-api reserved-unregistered (SC-3, D-80) | ✓ VERIFIED | `StrategyResult.source` union incl. 'defuddle'/'readability'/'apc-lite'/'servicenow-api' + two-enums note (IExtractionStrategy.ts:39-44); strategies dir = exactly IExtractionStrategy/DefuddleStrategy/ApcLiteStrategy (the 2 `ReadabilityStrategy` grep hits are the verbatim note comments, not files); tests assert `metrics.source === 'defuddle'` and source 'readability'/'apc-lite' paths |
| 4 | Actionable path runs only on request; passwords never captured (isPassword → value omitted) (SC-5b, D-86) | ✓ VERIFIED | `canHandle(mode==='actionable')` gating test; AxDomWalker omits `value` for password controls at capture (`formControl` D-86) + `FormControlSchema.refine` backstop rejects a password-carrying fixture (both tests green); `geometry` declared but never populated |
| 5 | PageIndexBuilder builds a lazy, memoized, per-tab MiniSearch index chunked by heading; never persisted (SC-4, D-87/§26.5) | ✓ VERIFIED | `PageIndexBuilder.ts` — `chunkMarkdown` (preamble/heading breadcrumb/paragraph/oversized split), `buildIndex`, `getIndex` memoized; zero `chrome.storage`/`indexedDB` imports (grep = 0); 8 test groups green incl. id synthesis (Pitfall 5), lazy-build-once spy |
| 6 | selectRelevant(query) returns top-k chunks and records compressionApplied 'topk' over the 2,000-token budget (D-87/§22.2) | ✓ VERIFIED | `WEBPAGE_TOKEN_BUDGET = 2000` + `selectRelevant` with `compressionApplied: 'topk'` (CompressionType literal from context/types); test 6 green |
| 7 | SPA-nav (`wxt:locationchange`) + `tabs.onUpdated` invalidation works (SC-5a, D-84/D-88, RESEARCH correction 2) | ✓ VERIFIED | `SPANavigationWatcher.ts` uses corrected `ctx.addEventListener(window, 'wxt:locationchange', …)` + MutationObserver fallback (tests green); cache `init()` listens `tabs.onUpdated` (status complete → invalidate) + `tabs.onRemoved` (evict) + `SPA_NAVIGATION` envelope → invalidate; lifecycle tests 7/8/9 + watcher/bridge tests green |
| 8 | §26.4a cache lifecycle: keyed by tabId, ephemeral, LRU cap 20, pinned eviction-last, in-flight/subscribed never evicted, coalescing, read-after-invalidation awaits in-flight, subscription API (SC-4/SC-5, D-88/D-89) | ✓ VERIFIED | `PageContentCache.ts` (351 lines) — full lifecycle incl. `getOrExtract` coalescing, `get` await-not-stale, `markStale`, `invalidate`, `evict`, `subscribe/unsubscribe`, `init`, `onIndexEvicted` hook, `__test__` seam; 10+ lifecycle test groups in PageContentService.test.ts all green in gate (LRU cap, recency bump, pinned-last, in-flight, coalescing spy, await-not-stale, onUpdated, SPA_NAVIGATION, onRemoved, subscription gating, eviction-together hook) |
| 9 | extract() returns a typed discriminated union — ok:false CONTENT_EXTRACT_FAILED on every failure path, never a silent empty result (D-91, D-38) | ✓ VERIFIED | `ExtractResult` union; tests green for: malformed html, no-handler mode, strategy throw, internal 5 s timeout (fake timers), caller-signal abort, fallback-exhaustion — all ok:false; `CONTENT_EXTRACT_FAILED` used as closed-set literal |
| 10 | Defuddle call is privacy-explicit: useAsync:false + synchronous parse() (T-P6-05, spec 3740) | ✓ VERIFIED | `useAsync: false` explicit at DefuddleStrategy.ts:65 with PRIVACY-CRITICAL comment; default import `import Defuddle from 'defuddle/full'` (RESEARCH correction 1); real-engine tests run under the detached-doc describe |
| 11 | PageContext is canonical at src/core/content/PageContext.ts (spec 4345-4391); src/core/context/types.ts re-exports it, no parallel copy (D-83) | ✓ VERIFIED | types.ts:23 `export type { PageContext, … } from '../content/PageContext'`; `grep -c "interface PageContext" types.ts` = 0; ContextOptimizer import resolves (tsc green) |
| 12 | Content bundle stays dependency-free: content modules import only the envelope module (types) and siblings — no zod, no panel-side layer (Pitfall 8/§24) | ✓ VERIFIED | 0 matches for `@/core/extraction|zod` imports in `src/core/content/`; AxDomWalker is a zero-import module; isolation gate source greps pass |
| 13 | verify:phase-6 re-pointed to §18 test dirs; stale phase-4a placeholder deleted; ADR-P6-01 flipped to Accepted with SPIKE-P6-01 outcome (D-92, D-79) | ✓ VERIFIED | package.json:24 = `"verify:phase-6": "tsc --noEmit && vitest run tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts"`; phase-4a count = 0; ADR status = "Accepted (2026-08-29 — SPIKE-P6-01 resolved by the Phase-6 tracer tests; no measurement pass)" + Spike Outcome section citing DefuddleStrategy.test.ts |
| 14 | pnpm verify:phase-6 passes end-to-end — the §18/§24 phase gate is GREEN (SC-7/§24) | ✓ VERIFIED | Ran `pnpm verify:phase-6` in this verification: `tsc --noEmit` clean + 9 test files, **92 passed | 2 skipped** (built-bundle checks in documented skip mode), exit 0 |

**Score:** 14/14 truths verified (0 present-but-behavior-unverified)

### Deferred Items

Items not yet met but explicitly addressed in later milestone phases.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Content-script entrypoint shape defect — `entrypoints/content/core.content.ts` matches none of WXT 0.20.27's content-script globs; content script never built/registered in manifest; built-bundle isolation check skips permanently | Phase 7 planner / Phase-1 entrypoint owner (D-07a area) | `deferred-items.md` (2026-08-30 row): verified with picomatch against `node_modules/wxt/dist/core/utils/building/find-entrypoints.mjs:259` PATH_GLOB_TO_TYPE_MAP; executor's scratch `content/index.ts` entrypoint built the Phase-6 modules cleanly at 9.51 kB with zero forbidden ids — proving the ONLY defect is the entrypoint shape. NOT a Phase-6-introduced regression (D-07a shape chosen in Phase 1); 06-05 plan prohibited module edits. **RESOLVED 2026-08-30 (commit 45250b5)** — `entrypoints/content/index.ts` re-export; manifest now registers `content-scripts/content.js`; built-bundle checks green. Not a roadmap-text-deferred item; surfaced as a WARNING + human decision (see Human Verification) — now closed. |

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/core/content/PageContext.ts` | Canonical PageContext family (spec 4345-4391) | ✓ VERIFIED | 61 lines, 5 interfaces, supersession header, TabContext distinction note |
| `src/core/context/types.ts` | D-83 re-export, no parallel copy | ✓ VERIFIED | line 23 re-export; 0 `interface PageContext`; tsc green |
| `src/core/extraction/apcLite.types.ts` | RawNode + schemas + source enum + password refine | ✓ VERIFIED | 56 lines; `z.enum(['dom','ax','hybrid','servicenow-api','defuddle','readability'])`; refine `!(c.isPassword && c.value !== undefined)` |
| `src/core/extraction/strategies/IExtractionStrategy.ts` | Contract + additive baseUrl?/truncated? + 4 tunables + two-enums note | ✓ VERIFIED | 49 lines; tunables at spec values (20 / 2_000_000 / 500 / 5_000) |
| `src/core/extraction/strategies/DefuddleStrategy.ts` | Default import, useAsync:false, Readability fallback, singleton | ✓ VERIFIED | 103 lines; `defuddleStrategy` exported; low-confidence threshold 50 |
| `src/core/extraction/strategies/ApcLiteStrategy.ts` | normalizeRawNode + APCLiteDocumentSchema.parse (source 'ax') + register | ✓ VERIFIED | 114 lines; imports + calls `registerStrategy(apcLiteStrategy)` at module load |
| `src/core/extraction/PageContentSerializer.ts` | serializeToPageContext + apcTreeToMarkdown | ✓ VERIFIED | 83 lines, pure functions |
| `src/core/extraction/PageContentService.ts` | extract() + ExtractResult union + 5 s AbortController + redaction + metrics | ✓ VERIFIED | 197 lines; `redactExtractedContent` (D-90), `__test__` seam |
| `src/core/extraction/PageContentCache.ts` | §26.4a lifecycle cache | ✓ VERIFIED | 351 lines; full lifecycle + subscription API + eviction hook |
| `src/core/extraction/PageIndexBuilder.ts` | chunkMarkdown/buildIndex/selectRelevant/evict + hook wiring | ✓ VERIFIED | 262 lines; `wireEvictionHook()` at module load |
| `src/core/content/AxDomWalker.ts` | walkDom + isPasswordControl; password omission; geometry unset; zero imports | ✓ VERIFIED | 268 lines; `AX_WALK_MAX_DEPTH=32`, `AX_WALK_MAX_NODES=5_000` |
| `src/core/content/ContentScriptHost.ts` | serializePage/stripForSerialization/sendHtmlPayload | ✓ VERIFIED | 120 lines; envelope-only import |
| `src/core/content/SPANavigationWatcher.ts` | startWatcher corrected WXT event + MutationObserver fallback | ✓ VERIFIED | 81 lines; `ctx.addEventListener(window, 'wxt:locationchange', …)` |
| `src/core/content/PageContextBridge.ts` | initBridge EXTRACT_PAGE_CONTENT handler + live context + SPA_NAVIGATION | ✓ VERIFIED | 91 lines; default → serializePage, actionable → walkDom |
| `src/core/runtime/RuntimeEnvelope.ts` | + PageLiveContextPayload (D-89) | ✓ VERIFIED | line 54; MessageTypeValues untouched (additive only) |
| `entrypoints/content/core.content.ts` | thin delegation; dead listener removed | ✓ VERIFIED (with WARNING) | 41 lines; delegates to startWatcher + initBridge; 0 `document.addEventListener('wxt:locationchange'`; **but entrypoint shape not buildable — see Human Verification** |
| `tests/core/extraction/DefuddleStrategy.test.ts` | §18 real-engine + fallback + truncation | ✓ VERIFIED | 178 lines, 9 tests green (SPIKE-P6-01 host) |
| `tests/core/extraction/PageContentService.test.ts` | §18 extract/error/redaction + cache lifecycle | ✓ VERIFIED | 548 lines, 27 tests green |
| `tests/core/extraction/ApcLiteStrategy.test.ts` | §18 normalization/refine/gating | ✓ VERIFIED | 178 lines, 6 tests green |
| `tests/core/extraction/PageIndexBuilder.test.ts` | §18 chunking/selectRelevant/evict | ✓ VERIFIED | 212 lines, 10 tests green |
| `tests/core/content/{AxDomWalker,ContentScriptHost,SPANavigationWatcher,PageContextBridge}.test.ts` | content-shell proofs | ✓ VERIFIED | 4 files, 18 tests green |
| `tests/isolation/no-content-script-ui.test.ts` | §18/§24 non-vacuous isolation gate | ✓ VERIFIED | 277 lines; 21 self-test assertions + source greps green; built-bundle describe skips (see warning) |
| `tests/setup.ts` | chrome.tabs onUpdated/onRemoved mock + __fireTabEvent | ✓ VERIFIED | listener-capture Sets + `__fireTabEvent` helper present |
| `package.json` | 4 deps at pinned ranges; verify:phase-6 re-pointed | ✓ VERIFIED | defuddle ^0.19.3, @mozilla/readability ^0.6.0, turndown ^7.2.4, minisearch ^7.2.0; gate target = §18 dirs |
| `.planning/adr/ADR-P6-01-defuddle-panel-side.md` | Status Accepted + Spike Outcome record | ✓ VERIFIED | Status line 3 Accepted; Spike Outcome section cites DefuddleStrategy.test.ts evidence |
| `src/types/turndown.d.ts` | local ambient turndown types | ✓ VERIFIED | exists |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| PageContentService | DefuddleStrategy | `selectStrategy` → `canHandle({url,mode})` | ✓ WIRED | service registers defuddleStrategy at module load; mode 'default' → defuddle |
| DefuddleStrategy | PageContentSerializer | `serializeToPageContext` | ✓ WIRED | service calls serializer with strategyResult; PageContext round-trip test proves chain |
| context/types.ts | content/PageContext.ts | `export type { PageContext … }` | ✓ WIRED | ContextOptimizer import resolves (tsc) |
| DefuddleStrategy | defuddle/full | default import + `useAsync: false` | ✓ WIRED | both grep-verified + real-engine tests |
| ApcLiteStrategy | apcLite.types | `APCLiteDocumentSchema.parse` | ✓ WIRED | line 82; refine rejection test proves validation |
| AxDomWalker | PageContextBridge | `walkDom` on actionable | ✓ WIRED | bridge line 63; bridge test asserts RawNode response |
| SPANavigationWatcher | PageContentCache | `SPA_NAVIGATION` envelope → init() listener | ✓ WIRED | bridge emits SPA_NAVIGATION; cache init() invalidates; lifecycle test 8 |
| PageContentCache | PageContentService | `getOrExtract` wraps `extract()` | ✓ WIRED | coalescing spy test proves single invocation |
| PageContentCache | chrome.tabs | `init()` onUpdated/onRemoved | ✓ WIRED | tests 7/9 via `__fireTabEvent` |
| PageIndexBuilder | PageContentCache | `onIndexEvicted(evict)` at module load | ✓ WIRED | `wireEvictionHook()`; hook-fire test green |
| PageIndexBuilder | TokenBudget | `countTokensHeuristic` | ✓ WIRED | chunk sizing + budget ceiling |
| PageIndexBuilder | minisearch | `new MiniSearch<PageChunk>` | ✓ WIRED | fields/storeFields/boost/prefix/fuzzy 0.2; addAll no-throw test |
| isolation test | content source dirs | execSync grep | ✓ WIRED | source greps run + pass |
| package.json | §18 test dirs | `verify:phase-6` script | ✓ WIRED | gate runs the dirs (verified by running it) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| DefuddleStrategy | markdown | real defuddle engine on detached DOMParser doc + base-href | ✓ FLOWING | real-engine tests assert non-empty markdown + resolved links |
| PageContentSerializer | PageContext.markdown | StrategyResult.markdown from strategy chain | ✓ FLOWING | round-trip test asserts markdown non-empty |
| PageContentService | ExtractResult | strategy chain under AbortController | ✓ FLOWING | all paths exercised by tests (ok:true and ok:false) |
| PageContentCache | CacheEntry.context | PageContentService.extract via getOrExtract | ✓ FLOWING | lifecycle tests assert served context from real extract |
| PageIndexBuilder | PageChunk.sectionText | chunkMarkdown over extracted markdown | ✓ FLOWING | chunking tests assert real splits; query hits assert stored fields |
| ContentScriptHost | PageHtmlPayload.html | pre-stripped clone of document.documentElement | ✓ FLOWING | serializer tests assert strip list + truncation on real jsdom DOM |
| AxDomWalker | RawNode | live DOM walk | ✓ FLOWING | walker tests assert structure from jsdom document |
| PageContextBridge | ExtractResponse | serializePage / walkDom | ✓ FLOWING | bridge tests assert payload/raw shapes |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase gate GREEN (tsc + §18 dirs + isolation) | `pnpm verify:phase-6` | tsc clean; 9 files, 92 passed | 2 skipped; exit 0 | ✓ PASS |
| Defuddle real engine detached-doc (SPIKE-P6-01) | within gate — DefuddleStrategy.test.ts | 9/9 green | ✓ PASS |
| Cache lifecycle invariants (10 groups) | within gate — PageContentService.test.ts | green | ✓ PASS |
| Password invariant (capture + refine backstop) | within gate — AxDomWalker/ApcLiteStrategy tests | green | ✓ PASS |
| Isolation gate non-vacuous self-tests | within gate — no-content-script-ui.test.ts | 21 self-tests green | ✓ PASS |
| Built-bundle isolation + <50 KB | within gate — describe.skipIf | ✓ PASS (post-fix) — `content-scripts/content.js` 9.51 kB registered in manifest (commit 45250b5); 25/25 tests incl. built-bundle checks | ✓ PASS |

### Probe Execution

No probe scripts (`scripts/*/tests/probe-*.sh`) are declared by any Phase 6 plan or referenced in SUMMARYs; the phase's verification surface is the vitest gate, which was run directly. Step 7c: N/A.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| — | 06-01..06-05 | All five plans declare `requirements: []` (infra phase — ROADMAP Phase 6 note: no spec-native v1 IDs; ServiceNow-api strategy id reserved, not registered — Phase 17 owns it) | ✓ SATISFIED | REQUIREMENTS.md contains no Phase 6 entries (grep confirmed); all requirement IDs claimed by plans = 0, all accounted for; acceptance = §18 DONE-when + D-79..D-92, verified above |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | No TBD/FIXME/XXX markers in any Phase-6 file (grep clean) | — | — |
| — | — | No stub patterns (placeholder/return-null/empty-data) in src/core/extraction or src/core/content (the `return null` at AxDomWalker.ts:221 is the bounded-walk truncation guard, not a stub) | — | — |
| `entrypoints/content/core.content.ts` | 1-41 | Content-script entrypoint shape not recognized by WXT 0.20.27 (pre-existing Phase-1 D-07a defect, discovered during 06-05; logged in deferred-items.md) | ⚠️ Warning | Content script never built/registered in manifest → extension ships without content script; built-bundle isolation checks (Pitfall 7) permanently skipped; ROADMAP SC-1/SC-2 compromised at build level until fixed. Executor proved modules clean via scratch entrypoint (9.51 kB). **RESOLVED 2026-08-30 (commit 45250b5):** `entrypoints/content/index.ts` re-export registers `content-scripts/content.js` (9.51 kB, ISOLATED) in the manifest; built-bundle checks green (verify:phase-6 94/94, full suite 559/559) |

### Human Verification Required

### 1. Content-script entrypoint defect — decision and fix timing

**Test:** Decide whether to fix the WXT entrypoint shape now (rename `entrypoints/content/core.content.ts` → `entrypoints/content/index.ts` re-export, or `entrypoints/content.core.content.ts`) and re-run `pnpm build:ext` to confirm `content_scripts` appears in `.output/chrome-mv3/manifest.json` and the isolation test's built-bundle checks execute green.
**Expected:** Either a fix commit lands (manifest registers the content script; built-bundle grep + <50 KB assertion run green — executor's scratch build measured 9.51 kB) or an explicit decision defers the fix to Phase 7 with the deferred-items.md owner routing acknowledged in STATE.md.
**Why human:** Cross-phase scope call. The defect is pre-existing (Phase-1 D-07a mandated the directory-form path), not introduced by Phase 6; the 06-05 plan explicitly prohibited module/entrypoint edits. All Phase-6 planned deliverables (extraction spine, cache, index, producer shells, isolation gate) exist, are wired, and are test-proven. But until the entrypoint is fixed, the extension ships without the content script — ROADMAP SC-1's runtime serialization and SC-2's built-bundle enforcement are not exercised in the shipped artifact. This is a build-infrastructure decision the verifier cannot unilaterally make.
**RESULT: RESOLVED 2026-08-30 —** user chose the immediate-fix path. `entrypoints/content/index.ts` (re-export of `core.content.ts`) committed as `45250b5`; `pnpm build:ext` now produces `content-scripts/content.js` at **9.51 kB** registered in the manifest (`world: ISOLATED`); the isolation test's built-bundle checks run and pass (**25/25**); `pnpm verify:phase-6` = **94/94**; full suite = **559/559**. ROADMAP SC-1 (runtime serialization) and SC-2 (built-bundle <50 KB) are now exercised in the shipped artifact.

### Gaps Summary

No gaps_found items: all 14 consolidated truths are VERIFIED with codebase + test evidence, the §18/§24 phase gate is GREEN (94/94, exit 0 after the entrypoint fix), and no requirement IDs are orphaned (infra phase — `requirements: []` in all five plans, confirmed against REQUIREMENTS.md).

The single material concern — the **content-script entrypoint defect** (Warning): `entrypoints/content/core.content.ts` is not a valid WXT 0.20.27 entrypoint, so the content script was never built into the extension manifest and the built-bundle isolation checks skipped permanently. This defect predates Phase 6 (Phase-1 D-07a shape decision), was discovered and documented by the 06-05 executor with owner + fix path in `deferred-items.md`, and the executor's scratch-build proof demonstrates the Phase-6 modules themselves are clean (9.51 kB, zero forbidden ids). **RESOLVED 2026-08-30 (commit 45250b5):** the `entrypoints/content/index.ts` re-export makes `pnpm build:ext` register `content-scripts/content.js` (9.51 kB, ISOLATED) in the manifest, and the built-bundle isolation checks now run and pass. Status is therefore **`passed`** — ROADMAP SC-1 and SC-2 are runtime-truthful in the shipped artifact.

---

_Verified: 2026-08-30T11:05:00Z_
_Re-verified: 2026-08-30 (entrypoint fix resolved — status passed)_
_Verifier: the agent (gsd-verifier)_