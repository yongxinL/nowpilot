---
phase: 04a-page-content-extraction
verified: 2026-07-31T18:45:00Z
status: human_needed
score: 30/30 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 25/30
  gaps_closed:
    - "SPA_NAVIGATION invalidation test passes; same-URL test non-vacuous; init() wired into side panel (truth 22 + Gap-1-wiring)"
    - "Name-heuristic password redaction restored — user_pwd/user_passwd/db_pwd redacted (truth 27)"
    - "Isolation bundle-size + banned-string assertions run against .output/chrome-mv3/content.js (truth 25)"
    - "Phase vitest gate green 86/86 (truth 28)"
    - "Tab-close index destruction behaviorally tested via tabs.onRemoved listener fire (truth 23, was PRESENT_BEHAVIOR_UNVERIFIED)"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Load the built extension in a Chrome instance, open the side panel, and navigate a real page; confirm the side panel boots without errors (pageContentService.init() at module scope registers SPA_NAVIGATION + tabs.onUpdated + tabs.onRemoved listeners), then trigger an extraction and confirm page content returns with password values redacted"
    expected: "Side panel renders; no init()/listener-registration exceptions in the service-worker/extension console; extraction returns SerializedPage with password field values absent; SPA navigation on a real site invalidates the per-tab cache (next extraction is fresh)"
    why_human: "Listener registration is verified in source (entrypoints/sidepanel/main.tsx:14) and in the built artifact (.output/chrome-mv3/chunks/sidepanel-C3naO_Nr.js contains onUpdated/onRemoved.addListener + SPA_NAVIGATION registration), and unit tests fire the registered callbacks — but a live extension boot exercising real chrome.tabs APIs and a real browser tab lifecycle cannot be executed in this verification environment. 04a-05-SUMMARY D5 flags human_judgment: true for this same item."
---

# Phase 4a: Page Content Extraction Verification Report (Re-verification)

**Phase Goal:** User can extract page content via layered Defuddle → APC-lite DOM walk with an ephemeral MiniSearch index; content script bundle stays <50KB with no React/AntD
**Verified:** 2026-07-31T18:45:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap closure (plan 04a-05)

## Goal Achievement

All 4 gaps from the initial verification (25/30) are closed by plan 04a-05 (commits `53674f6`, `e26566f`, `6235d6d` — each verified against the working tree). The phase vitest gate is green at **86/86** (was 81/85 with 4 failures). The one behavior-unverified item (tab-close index destruction) now has a real behavioral test. One live-extension confirmation remains, flagged human_judgment by the executor's own coverage metadata (D5).

### Observable Truths

| #   | Truth   | Status     | Evidence |
| --- | ------- | ---------- | -------- |
| 1   | SC1: Defuddle extracts main content as clean Markdown with metadata (author, language, siteName) preserved | ✓ VERIFIED | `DefuddleStrategy.ts` (defuddle/full, useAsync:false); DefuddleStrategy.test.ts 3/3 in the 86/86 run |
| 2   | 04a-01: Typed PageContext with mode='default', source='defuddle' via discriminated unions | ✓ VERIFIED | `types.ts` unions; Zod boundary; PageContentService.test.ts passes in run |
| 3   | SC2/04a-02: Readability fallback on low-confidence Defuddle output (<500 chars) without user intervention | ✓ VERIFIED | `ReadabilityFallback.ts` charThreshold 500; fallback test passes in run |
| 4   | 04a-02: ReadabilityFallback parses via DOMParser on cloned doc; metadata mapped | ✓ VERIFIED | 7/7 ReadabilityFallback tests pass in run |
| 5   | 04a-02: ApcLiteStrategy walks DOM+ARIA → APCLiteNode tree validated via Zod (mode='actionable') | ✓ VERIFIED | 10/10 ApcLite tests pass in run incl. deep-nesting bound + D-02 password omission |
| 6   | 04a-02: PageContentService constructor accepts 3 strategies; mode-based selection | ✓ VERIFIED | Registry + canHandle filter; mode-isolation tests pass in run |
| 7   | 04a-02: ExtractionResult.source + strategiesAttempted audit trail | ✓ VERIFIED | Error-path audit test passes in run |
| 8   | 04a-02: PageContext mode='actionable' carries apcLiteTree, no automation logic | ✓ VERIFIED | Actionable-mode test passes in run |
| 9   | 04a-01: DomSerializer captures outerHTML (2MB cap, code-point-safe) with password values omitted | ✓ VERIFIED | `DomSerializer.ts` full read: SIZE_CAP, truncateAtCodePoint, selector redaction intact (lines 13-14, 67, 79-92); selector/size-cap/live-doc tests pass |
| 10  | 04a-01: EXTRACT_PAGE_CONTENT via RuntimeEnvelope+MessageBus; synchronous SerializedPage via sendResponse | ✓ VERIFIED | content.core.ts init()→register; MessageBus unwrap; bridge shape test passes |
| 11  | 04a-01: SPA_NAVIGATION via createEnvelope(); CONTENT_SCRIPT_READY removed | ✓ VERIFIED | content.core.ts:29 SPA_NAVIGATION; no CONTENT_SCRIPT_READY anywhere (grep) |
| 12  | 04a-01: extract() returns union — operational failures never throw | ✓ VERIFIED | CAPTURE_FAILED/NO_CONTENT/PARSE_ERROR tests pass in run |
| 13  | 04a-01: 5s global timeout budget shared across fallback chain; per-strategy remaining budget | ✓ VERIFIED | Deadline + Promise.race; timeout test passes in run |
| 14  | 04a-01: Duplicate per-tab extractions coalesce into single in-flight promise | ✓ VERIFIED | inFlight map; coalescing test passes in run |
| 15  | 04a-01: Per-tab PageContentCache; reExtract invalidates | ✓ VERIFIED | Cache-hit/reExtract/onUpdated tests pass in run (25/25 service file) |
| 16  | 04a-01: redactSensitive on markdown before PageContext (JWT, Bearer, API keys, JSESSIONID) | ✓ VERIFIED | Secret-stripping tests pass in run |
| 17  | 04a-01: SPA_NAVIGATION in MessageTypeValues | ✓ VERIFIED | RuntimeEnvelope.ts:6 |
| 18  | SC3/04a-03: Ephemeral per-tab MiniSearch index; never persisted | ✓ VERIFIED | PageIndexBuilder in-memory only; 19 tests pass in run |
| 19  | 04a-03: Markdown chunked by heading hierarchy with breadcrumbs; '(preamble)' path | ✓ VERIFIED | chunkMarkdown tests pass in run |
| 20  | 04a-03: selectRelevant BM25 with heading-aware boost, top-K within token budget | ✓ VERIFIED | Budget/boost tests pass in run |
| 21  | 04a-03: Index auto-built after extraction, before cache storage | ✓ VERIFIED | Ordering in code + tests pass |
| 22  | SC4/04a-03: SPA navigation → index cleanup BEFORE cache invalidation; invalidate and re-extract | ✓ VERIFIED | **Gap closed.** Test now calls `service.init()` (PageContentService.test.ts:366); named run: 'invalidates the cache when SPA_NAVIGATION announces a different URL' PASSES (2× sendMessage). Same-URL test non-vacuous (init() at :387; 1× sendMessage proves handler ran and kept cache hot). Production wiring: `pageContentService.init()` at module scope in entrypoints/sidepanel/main.tsx:14; PageContentService.init() (lines 56-74) registers SPA handler + onUpdated + onRemoved; **built artifact** `.output/chrome-mv3/chunks/sidepanel-C3naO_Nr.js` contains onUpdated.addListener, onRemoved.addListener, SPA_NAVIGATION, registerSpaNavigationHandler |
| 23  | 04a-03: Tab close destroys per-tab MiniSearch index — memory released, never persisted | ✓ VERIFIED | **Behavior-unverified item closed.** New test 'removes tab index and invalidates cache when tabs.onRemoved fires' (PageContentService.test.ts:446-464) captures the listener registered by init(), fires the callback with tabId, asserts 2× sendMessage (cache-miss re-extraction proving removeTab + invalidate). PASSES in named run. Production wiring at PageContentService.ts:70-73 |
| 24  | 04a-04: Content script bundle contains no React/AntD/defuddle/yaml/FS Access — isolation test fails on violation | ✓ VERIFIED | Isolation Test 1 passes; independent grep of `.output/chrome-mv3/content.js` → 0 banned matches; 3,320 bytes |
| 25  | 04a-04: Bundle <50KB enforced via bundle-size assertion | ✓ VERIFIED | **Gap closed.** Isolation Tests 2+3 now target `.output/chrome-mv3/content.js` (test file lines 66-67, 83-84); build output exists (3,320 B < 50KB); no skip warnings in run output; 4/4 isolation tests pass — assertions execute for real |
| 26  | 04a-04: PageContextBridge EXTRACT_PAGE_CONTENT handler returns SerializedPage synchronously | ✓ VERIFIED | Bridge one-liner; shape test passes in run |
| 27  | 04a-04: Password values never appear in SerializedPage.html for all 4 mechanisms incl. name heuristics | ✓ VERIFIED | **Gap closed.** `PASSWORD_NAME_PATTERN` restored to contains-match `/pass(word\|wd)?\|pwd/i` (DomSerializer.ts:16); named run: 'omits values for inputs matching the password name heuristic' (DomSerializer, user_pwd) + '…name heuristic' (PageContextBridge, user_passwd) + '…name containing pwd' (db_pwd) — all 3 PASS |
| 28  | 04a-04: verify:phase-4a gate green — all test suites pass | ✓ VERIFIED | **Gap closed (phase-caused portion).** Vitest gate `tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts` → **86/86 pass, 0 failures** (was 81/85 with 4 failures). Caveat: the `tsc --noEmit &&` prefix of the script still exits 2 on 9 errors, all in `src/core/storage/*` (ApiKeyStore, CryptoService, MigrationRunner, WriteJournal) — pre-existing (files last touched Phase 02-03, commit 77d88ac), documented in deferred-items.md #1, explicitly declared out of gap-closure scope by 04a-05-PLAN §verification. Zero tsc errors in any phase-04a file |
| 29  | P1 (prohibition): Content script MUST NOT render UI/inject CSS/shadow DOM/mutate host page | ✓ VERIFIED (not violated) | content.core.ts zero UI code; DomSerializer redacts on in-memory clone; isolation Test 4 passes |
| 30  | P2 (prohibition): No extraction without explicit intent; no background polling; SPA_NAVIGATION sends URL only | ✓ VERIFIED (not violated) | No polling; extraction only via explicit request; SPA_NAVIGATION payload {url, timestamp} |

**Score:** 30/30 truths verified (0 present-but-behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | ----------- | ------ | ------- |
| `src/core/extraction/types.ts` | D-11/D-12 typed unions | ✓ VERIFIED | Exists; unchanged since prior pass |
| `src/core/extraction/apcLite.types.ts` | Zod schemas | ✓ VERIFIED | Exists; unchanged |
| `src/core/extraction/strategies/IExtractionStrategy.ts` | Strategy contract | ✓ VERIFIED | Exists; unchanged |
| `src/core/extraction/strategies/DefuddleStrategy.ts` | Defuddle markdown+metadata | ✓ VERIFIED | Tests 3/3 in run |
| `src/core/extraction/strategies/ReadabilityFallback.ts` | Reader-View fallback | ✓ VERIFIED | Tests 7/7 in run |
| `src/core/extraction/strategies/ApcLiteStrategy.ts` | DOM+ARIA walk → Zod tree | ✓ VERIFIED | Tests 10/10 in run |
| `src/core/extraction/PageContentService.ts` | Orchestrator incl. init() | ✓ VERIFIED | init() (56-74): SPA handler + onUpdated + onRemoved, idempotent guard; SPA handler (118-131): index-cleanup-before-invalidation order, invalidateIfChanged |
| `src/core/extraction/PageContentSerializer.ts` | buildMetadata/buildPageContext | ✓ VERIFIED | Unchanged; tests pass |
| `src/core/extraction/PageContentCache.ts` | Per-tab Map cache | ✓ VERIFIED | Unchanged; tests pass |
| `src/core/extraction/PageIndexBuilder.ts` | MiniSearch index | ✓ VERIFIED | Unchanged; 19 tests pass |
| `src/core/content/DomSerializer.ts` | serializePage with redaction + cap | ✓ VERIFIED | PASSWORD_NAME_PATTERN restored (line 16); selector redaction intact; all 8 tests pass |
| `src/core/content/PageContextBridge.ts` | Typed EXTRACT_PAGE_CONTENT handler | ✓ VERIFIED | All 10 tests pass |
| `entrypoints/content.core.ts` | Migrated content script | ✓ VERIFIED | SPA_NAVIGATION notify intact; no UI; no CONTENT_SCRIPT_READY |
| `src/core/runtime/RuntimeEnvelope.ts` | SPA_NAVIGATION added | ✓ VERIFIED | Line 6 |
| `src/core/messaging/MessageBus.ts` | sendResponse forwarding | ✓ VERIFIED | Unchanged |
| `entrypoints/sidepanel/main.tsx` | init() wired at startup | ✓ VERIFIED | Import (line 7) + `pageContentService.init()` at module scope (line 14) before createRoot render (line 32); built chunk sidepanel-C3naO_Nr.js contains listener registrations |
| `tests/isolation/no-content-script-ui.test.ts` | Isolation enforcement | ✓ VERIFIED | Tests 2+3 target `.output/chrome-mv3/content.js`; run for real; 4/4 pass |
| `tests/core/content/PageContextBridge.test.ts` | Messaging contract tests | ✓ VERIFIED | 10/10 pass incl. both name-heuristic tests |
| `tests/core/extraction/PageContentService.test.ts` | Service integration tests | ✓ VERIFIED | 25/25 pass incl. SPA init()-fixed tests + new onRemoved test |
| `tests/core/extraction/PageIndexBuilder.test.ts` | Index tests | ✓ VERIFIED | 19/19 pass |
| `tests/core/extraction/strategies/ReadabilityFallback.test.ts` | Fallback tests | ✓ VERIFIED | 7/7 pass |
| `tests/core/extraction/ApcLiteStrategy.test.ts` | ApcLite tests | ✓ VERIFIED | 10/10 pass |
| `tests/core/content/DomSerializer.test.ts` | Redaction tests | ✓ VERIFIED | 8/8 pass incl. name-heuristic test |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| content.core.ts | MessageBus.dispatch | init() + register(EXTRACT_PAGE_CONTENT) | ✓ WIRED | Sync return → sendResponse |
| PageContentService.requestContentFromTab | content script | chrome.tabs.sendMessage envelope | ✓ WIRED | CAPTURE_FAILED on error |
| PageContentService.doExtract | DefuddleStrategy → ReadabilityFallback | canHandle + <500-char gate | ✓ WIRED | Fallback test passes |
| PageContentService.doExtract | ApcLiteStrategy | canHandle (actionable) | ✓ WIRED | Mode-isolation test passes |
| PageContentService | redactSensitive | markdown before buildPageContext | ✓ WIRED | Secret-stripping tests pass |
| PageContentService | PageIndexBuilder | buildFromText/buildFromTree | ✓ WIRED | Ordering in code + tests |
| PageContentService | PageContentCache | extract() cache-first; reExtract invalidate | ✓ WIRED | Cache tests pass |
| SPA_NAVIGATION event | PageIndexBuilder.removeTab + cache.invalidate | handler registered via init() → sidepanel/main.tsx:14 | ✓ WIRED | **Previously NOT_WIRED.** Named test passes (2× sendMessage); built sidepanel chunk contains registration |
| tabs.onUpdated/onRemoved | reExtract / removeTab+invalidate | chrome.tabs listeners in init() | ✓ WIRED | onUpdated tests + new onRemoved test fire the real registered callbacks; both pass |
| PageContext | ContextOptimizer contract | buildPageContextSection shape | ✓ WIRED | Shape test passes |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| DomSerializer | html | doc.documentElement.outerHTML (live document) | Yes | ✓ FLOWING |
| PageContentService | serialized | sendMessage → content script handler → serializePage(document) | Yes (mocked in unit tests; live capture covered by human item) | ✓ FLOWING (unit) |
| PageIndexBuilder | chunks | redacted markdown / APCLite tree | Yes | ✓ FLOWING |
| PageContentCache | result | successful doExtract result | Yes | ✓ FLOWING |
| Sidepanel entrypoint | listeners | init() at module scope → built artifact | Yes (present in shipped bundle) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase vitest gate (was 4 failing) | `pnpm exec vitest run tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts` | **86 passed / 0 failed** (8 files) | ✓ PASS |
| SPA invalidation (behavioral, named) | vitest `-t "invalidates the cache when SPA_NAVIGATION announces a different URL"` | Pass (2× sendMessage after init()) | ✓ PASS |
| SPA same-URL non-vacuous (behavioral, named) | vitest `-t "keeps the cache hot when SPA_NAVIGATION announces the same URL"` | Pass (1× sendMessage, handler registered) | ✓ PASS |
| Tab-close index destruction (behavioral, named) | vitest `-t "removes tab index and invalidates cache when tabs.onRemoved fires"` | Pass (2× sendMessage after listener fire) | ✓ PASS |
| Name-heuristic redaction (behavioral, named) | vitest `-t "password name heuristic\|name containing"` (3 tests) | Pass (user_pwd, user_passwd, db_pwd redacted) | ✓ PASS |
| Isolation enforcement runs for real | vitest isolation file; no 'No build output' warnings | 4/4 pass; content.js 3,320 B; 0 banned strings | ✓ PASS |
| Bundle purity (independent) | `grep -c -E "defuddle\|readability\|minisearch\|react\|antd\|yaml\|createElement\|shadowRoot" .output/chrome-mv3/content.js` | 0 matches; 3,320 bytes < 50KB | ✓ PASS |
| Built side panel wiring | grep built chunk for listener registration | onUpdated.addListener ×1, onRemoved.addListener ×1, SPA_NAVIGATION ×1 in sidepanel-C3naO_Nr.js | ✓ PASS |
| tsc on phase files | `pnpm exec tsc --noEmit` (script prefix) | 9 errors — ALL in src/core/storage (pre-existing, deferred-items.md #1); 0 in phase files | ✓ PASS (phase files) |

### Probe Execution

Step 7c: SKIPPED — no probe scripts exist (`find scripts -path '*/tests/probe-*.sh'` → none) and neither 04a-04 nor the 04a-05 gap-closure plan declares probes. The phase's verification gates are the vitest suite and `verify:phase-4a`, executed above.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| PAGE-01 | 04a-01..05 (all 5 plans declare `requirements: [PAGE-01]`) | User can extract page content via layered extraction (Defuddle → APC-lite) with ephemeral MiniSearch index and per-tab SPA-nav cache | ✓ SATISFIED | Layered extraction VERIFIED; ephemeral MiniSearch VERIFIED; per-tab SPA-nav cache invalidation now behaviorally tested and production-wired (truths 22, 23); redaction contract restored (truth 27); gate green (truth 28). Marked `Complete` in REQUIREMENTS.md line 113 |

No orphaned requirements: PAGE-01 is the only requirement mapped to Phase 4a and all 5 plans claim it.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| — | — | None found | — | No TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers in any of the 4 modified files (grep clean, exit 1). Isolation Tests 2+3 retain a graceful `return` on missing build output — acceptable: the path is now correct and the build exists in CI/dev |

### Human Verification Required

**1. Live extension boot + extraction flow**

**Test:** Load the built extension (`.output/chrome-mv3`) in a Chrome/Chromium instance. Open the side panel, navigate to a real article page, and trigger page-content extraction. Watch the extension console for errors during startup (pageContentService.init() runs at module scope in the side panel) and during extraction.
**Expected:** Side panel boots and renders without exceptions; SPA_NAVIGATION + tabs.onUpdated/onRemoved listeners register silently (no chrome.runtime.lastError spam beyond the known benign content-script-not-ready case); extraction returns page content with password field values absent from the serialized HTML.
**Why human:** Listener registration is proven in source (sidepanel/main.tsx:14), in the built artifact (chunk contains the addListener calls), and behaviorally (unit tests fire the registered callbacks) — but a live extension run exercising real chrome.tabs APIs, a real browser tab lifecycle, and the actual side panel boot cannot be executed in this verification environment. 04a-05-SUMMARY coverage item D5 flags `human_judgment: true` for the same check.

### Gaps Summary

**No gaps remain.** All 4 initial gaps are closed and verified in the working tree and built artifacts:

1. **SPA-nav cache invalidation (truth 22)** — tests call `service.init()`; different-URL test passes with 2× sendMessage; same-URL test is non-vacuous; `pageContentService.init()` is called at module scope in `entrypoints/sidepanel/main.tsx` and the listener registrations are present in the built sidepanel chunk.
2. **Password name-heuristic (truth 27)** — `PASSWORD_NAME_PATTERN` restored to `/pass(word|wd)?|pwd/i`; all 3 previously-leaking fixtures (user_pwd, user_passwd, db_pwd) redacted; tests pass by name.
3. **Isolation enforcement (truth 25)** — Tests 2+3 assert on the real WXT output `.output/chrome-mv3/content.js`; 3,320-byte bundle with 0 banned strings; assertions ran, not skipped.
4. **Verification gate (truth 28)** — phase vitest gate 86/86 green. The `verify:phase-4a` script's tsc prefix still exits 2 on 9 pre-existing `src/core/storage` errors — pre-existing (Phase 02-03, commit 77d88ac), documented in deferred-items.md #1, explicitly excluded from gap-closure scope by 04a-05-PLAN §verification, zero errors in phase files. If a strict script-level exit-0 is required, an override can be recorded: *"verify:phase-4a vitest portion green 86/86; tsc prefix fails only on pre-existing out-of-scope src/core/storage errors tracked in deferred-items.md #1"*.
5. **Behavior-unverified item (truth 23)** — tab-close index destruction now covered by a passing test that fires the real onRemoved listener callback.

**Score:** 30/30 truths verified, 0 behavior-unverified, 0 gaps. Status `human_needed` solely for the live-extension confirmation (flagged human_judgment by the executor's own coverage metadata D5).

---

_Verified: 2026-07-31T18:45:00Z_
_Verifier: the agent (gsd-verifier)_
