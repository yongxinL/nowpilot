---
phase: 04a-page-content-extraction
plan: 01
subsystem: extraction
tags: [defuddle, dom-serialization, password-redaction, messagebus, page-context, cache, timeout, zod]

# Dependency graph
requires:
  - phase: 04
    provides: ContextOptimizer (buildPageContextSection, sourceId 'context.page.current'), RuntimeEnvelope, MessageBus, redactSensitive
provides:
  - End-to-end extraction tracer: content script capture (DomSerializer) → MessageBus → PageContentService → DefuddleStrategy → typed PageContext (mode='default')
  - ExtractionResult discriminated union (D-11) and PageContext mode-discriminated union (D-12) as the API contract for all downstream consumers
  - Per-tab PageContentCache with lazy re-extraction, SPA_NAVIGATION/tabs.onUpdated invalidation, concurrency coalescing, 5s global timeout
  - Password redaction at capture time (D-02) and redactSensitive on extracted markdown (D-19)
affects: [04a-02, 04a-03, 04a-04, phase-6 diagnostics, phase-8 MCP tools, ContextOptimizer consumers]

# Tech tracking
tech-stack:
  added: [defuddle@0.19.2 (via 'defuddle/full' subpath), @mozilla/readability@0.6.0, minisearch@7.2.0, happy-dom@20.11.1 (test env), @types/jsdom@21.1.7]
  patterns:
    - "Strategy pattern with readonly id discriminator + canHandle() predicate (IExtractionStrategy), orchestrator-driven fallback chain"
    - "Discriminated unions for operational results: { ok: true, pageContext } | { ok: false, error } — never throw (D-11)"
    - "Zod boundary validation with z.strictObject + z.discriminatedUnion (PlannerService pattern); recursive schemas via z.ZodType<T> + base-schema inference"
    - "Map-based per-tab cache with invalidateIfChanged + module-level singleton"
    - "Per-file test environment override for jsdom-incompatible pipelines (happy-dom for defuddle's :has() selectors)"

key-files:
  created:
    - src/core/extraction/types.ts
    - src/core/extraction/apcLite.types.ts
    - src/core/extraction/strategies/IExtractionStrategy.ts
    - src/core/extraction/strategies/DefuddleStrategy.ts
    - src/core/extraction/PageContentService.ts
    - src/core/extraction/PageContentSerializer.ts
    - src/core/extraction/PageContentCache.ts
    - src/core/content/DomSerializer.ts
    - src/core/content/PageContextBridge.ts
    - tests/core/content/DomSerializer.test.ts
    - tests/core/extraction/DefuddleStrategy.test.ts
    - tests/core/extraction/PageContentService.test.ts
  modified:
    - src/core/runtime/RuntimeEnvelope.ts (SPA_NAVIGATION added to MessageTypeValues)
    - src/core/messaging/MessageBus.ts (single-handler return-value unwrap for sendResponse)
    - entrypoints/content.core.ts (MessageBus migration, SPA_NAVIGATION via createEnvelope, CONTENT_SCRIPT_READY removed)
    - package.json, pnpm-lock.yaml (deps)

key-decisions:
  - "User-approved D-11 (ExtractionResult union), D-12 (PageContext mode union), D-02 (password redaction contract) — Task 1 checkpoint ratified"
  - "Import Defuddle from 'defuddle/full': the main entry's `markdown: true` option is inert (no conversion); /full wraps parse() with toMarkdown"
  - "DomSerializer redacts on an in-memory document clone, never the live page — plan's field.value='' approach would wipe the user's typed password"
  - "Redaction uses removeAttribute('value') + IDL clear — the value IDL property and content attribute are decoupled; outerHTML serializes the attribute"
  - "DefuddleStrategy tests run in a per-file happy-dom environment (jsdom's nwsapi cannot compile defuddle's :has() selectors)"
  - "useAsync: false for Defuddle — extraction must never make network calls from the extension page"

patterns-established:
  - "Pattern 1: strategy implementations never decide confidence/fallback — the orchestrator checks content.length < 500 (D-07)"
  - "Pattern 2: redaction happens twice, at both boundaries — DomSerializer at capture (D-02) and redactSensitive before PageContext construction (D-19)"
  - "Pattern 3: operational extraction failures return typed ExtractionError results; schema violations throw (programming errors)"

requirements-completed: [PAGE-01]

coverage:
  - id: D1
    description: "DomSerializer captures documentElement.outerHTML with ~2MB size cap and password values omitted (type=password, [isPassword], autocomplete=current-password, name-pattern heuristic) without mutating the live document"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/content/DomSerializer.test.ts#omits value for input[type=password] set via the value property"
        status: pass
      - kind: unit
        ref: "tests/core/content/DomSerializer.test.ts#enforces the ~2MB size cap and flags truncation"
        status: pass
      - kind: unit
        ref: "tests/core/content/DomSerializer.test.ts#never mutates the live document (redaction happens on an in-memory clone)"
        status: pass
    human_judgment: false
  - id: D2
    description: "DefuddleStrategy produces markdown plus author/language/siteName/description metadata from fixture HTML (mode='default' only)"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/DefuddleStrategy.test.ts#extracts markdown and metadata from a fixture HTML document"
        status: pass
    human_judgment: false
  - id: D3
    description: "PageContentService.extract() returns the ExtractionResult discriminated union: ok+PageContext from a mocked content script, cache hit, reExtract invalidation, concurrency coalescing, 5s timeout, CAPTURE_FAILED/NO_CONTENT/PARSE_ERROR/TIMEOUT error codes"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#returns a typed PageContext with mode=default from a mocked content script response"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#enforces the 5s global timeout budget with strategiesAttempted populated"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#returns NO_CONTENT when all strategies produce low-confidence content"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#returns PARSE_ERROR when a strategy throws"
        status: pass
    human_judgment: false
  - id: D4
    description: "Content script migrated to MessageBus: EXTRACT_PAGE_CONTENT returns SerializedPage via sendResponse, SPA_NAVIGATION sent via createEnvelope, CONTENT_SCRIPT_READY removed, bundle free of React/AntD/defuddle/yaml/FS-Access imports"
    requirement: PAGE-01
    verification:
      - kind: other
        ref: "wxt build; grep .output/chrome-mv3/content.js for react|antd|defuddle|readability|minisearch|yaml|showDirectoryPicker → 0 matches; bundle 2,986 bytes"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cache invalidation on SPA_NAVIGATION (URL change only) and tabs.onUpdated (complete+URL), keeping same-URL navigations cache-hot"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#invalidates the cache when SPA_NAVIGATION announces a different URL"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#keeps the cache hot when SPA_NAVIGATION announces the same URL"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#invalidates the cache when tabs.onUpdated fires with a complete navigation"
        status: pass
    human_judgment: false
  - id: D6
    description: "Secrets (sk- API keys, Bearer JWTs, JSESSIONID) redacted from extracted markdown before PageContext construction; output compatible with ContextOptimizer.buildPageContextSection serialization contract"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#redacts secrets from extracted markdown (script + visible text) leaving placeholders"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#produces the data shape consumed by ContextOptimizer.buildPageContextSection"
        status: pass
    human_judgment: false

# Metrics
duration: 22min
completed: 2026-07-31
status: complete
---

# Phase 04a Plan 01: End-to-End Extraction Tracer Summary

**End-to-end extraction tracer: content-script DOM capture with password redaction → MessageBus envelope round-trip → DefuddleStrategy markdown extraction → typed PageContext (mode='default') with per-tab cache, 5s timeout budget, concurrency coalescing, and dual-boundary secret redaction**

## Performance

- **Duration:** 22 min
- **Started:** 2026-07-31T04:23:15Z
- **Completed:** 2026-07-31T04:45:12Z
- **Tasks:** 3 (Task 1 = user-approved decision checkpoint, Task 2 = tracer, Task 3 = hardening)
- **Files modified:** 18 (9 created, 4 modified source, 2 config/lock, 3 test files)

## Accomplishments

- Full layered extraction pipeline proven end-to-end: `content script → MessageBus → PageContentService → DefuddleStrategy → PageContext` with the ContextOptimizer feed contract (`sourceId: 'context.page.current'`) verified
- Content script migrated off raw `chrome.runtime.sendMessage`: `EXTRACT_PAGE_CONTENT` handled via `MessageBus.init()` (synchronous SerializedPage → sendResponse), `SPA_NAVIGATION` emitted via `createEnvelope`, `CONTENT_SCRIPT_READY` removed — built bundle is 2,986 bytes with zero forbidden imports (React/AntD/defuddle/yaml/FS Access)
- DomSerializer: ~2MB size cap and D-02 password redaction (three selector patterns + name heuristic) performed on an in-memory clone — the live page is never mutated; attribute-set values removed via `removeAttribute('value')` (property+attribute decoupling fix)
- PageContentService: cache-first extraction with lazy re-extraction, SPA_NAVIGATION + tabs.onUpdated invalidation (URL-change only), in-flight coalescing, 5s global timeout budget with per-strategy `Promise.race`, all four error codes (CAPTURE_FAILED/NO_CONTENT/PARSE_ERROR/TIMEOUT) with `strategiesAttempted` lists
- 30 tests passing across three test files (DomSerializer 8, DefuddleStrategy 3, PageContentService 19); `tsc --noEmit` clean for all new/modified files; full `wxt build` succeeds

## Task Commits

1. **Task 1: Architecture decisions (D-11/D-12/D-02)** — approved by user via checkpoint ("proceed"); no commit (decision only)
2. **Task 2: Tracer** — `6ee55a8` (feat: end-to-end extraction tracer — types, DomSerializer, DefuddleStrategy, PageContentService)
3. **Task 3: Hardening** — `93c9d75` (test: harden PageContentService — error codes, SPA/tabs invalidation, redaction integration)

**Plan metadata:** pending (docs commit, this SUMMARY)

## Files Created/Modified

- `src/core/extraction/types.ts` — ExtractionError/ExtractionResult/PageContext/StrategyInput/StrategyResult unions (D-11/D-12)
- `src/core/extraction/apcLite.types.ts` — RawNode/APCLiteNode/APCLiteDocument Zod schemas (D-08, recursive via z.ZodType<T>)
- `src/core/extraction/strategies/IExtractionStrategy.ts` — strategy contract (id discriminator, canHandle, run)
- `src/core/extraction/strategies/DefuddleStrategy.ts` — defuddle/full markdown pipeline with metadata mapping, useAsync: false
- `src/core/extraction/PageContentService.ts` — orchestrator: extract/reExtract/init, cache, coalescing, timeout, redaction, SPA_NAVIGATION handler
- `src/core/extraction/PageContentSerializer.ts` — buildMetadata/buildPageContext with Zod boundary validation
- `src/core/extraction/PageContentCache.ts` — per-tab Map cache with invalidateIfChanged + singleton
- `src/core/content/DomSerializer.ts` — serializePage with clone-based password redaction + SIZE_CAP
- `src/core/content/PageContextBridge.ts` — typed EXTRACT_PAGE_CONTENT handler (content-script side)
- `entrypoints/content.core.ts` — migrated: init() → register(EXTRACT_PAGE_CONTENT) → createEnvelope(SPA_NAVIGATION)
- `src/core/runtime/RuntimeEnvelope.ts` — SPA_NAVIGATION added to MessageTypeValues
- `src/core/messaging/MessageBus.ts` — single-fulfilled-handler return-value unwrap so sendResponse carries handler results (D-04); handler return type widened to `unknown`
- `tests/core/content/DomSerializer.test.ts` — 8 tests (selectors, heuristic, clone no-mutation, size cap, metadata)
- `tests/core/extraction/DefuddleStrategy.test.ts` — 3 tests (happy-dom env; canHandle, markdown+metadata, no-HTML throw)
- `tests/core/extraction/PageContentService.test.ts` — 19 tests (tracer + hardening)
- `package.json` / `pnpm-lock.yaml` — defuddle@0.19.2, @mozilla/readability@0.6.0, minisearch@7.2.0, happy-dom, @types/jsdom

## Decisions Made

- **User checkpoint ratified (Task 1):** D-11 ExtractionResult discriminated union, D-12 PageContext mode-discriminated union, D-02 password redaction contract — all three locked as the API contract for downstream consumers
- **`defuddle/full` subpath import:** the main `defuddle` entry's `markdown: true` option is inert (no conversion code in the main parse path — verified in dist source); `/full` wraps `parse()` with `toMarkdown`, delivering the markdown output the plan requires
- **Clone-based redaction:** `serializePage` never touches the live document — the plan's `field.value = ''` mechanism would visibly wipe the user's typed password, violating the plan's own negative contract; redaction runs on `doc.cloneNode(true)`
- **removeAttribute('value') + IDL clear:** the value IDL property and the value content attribute are decoupled; `outerHTML` serializes the attribute, so clearing only the property still leaks attribute-set (server-rendered) passwords — the plan's stated mechanism was a genuine D-02 gap
- **happy-dom per-file test environment:** jsdom's nwsapi cannot compile defuddle's `:has(source)` selectors, degrading extraction and breaking markdown conversion in tests; `// @vitest-environment happy-dom` on DefuddleStrategy.test.ts exercises the real production pipeline (Chrome supports `:has()`)
- **useAsync: false** on Defuddle: extraction must never trigger network fetches from the extension page (on-demand local extraction only)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pnpm instead of npm for dependency installation**
- **Found during:** Task 2 (step 0)
- **Issue:** Plan says `npm install defuddle@0.19.2 ...` but `node_modules` is a pnpm layout (`.pnpm` dir, pnpm-lock.yaml newer) — running npm would have destroyed the install tree
- **Fix:** `pnpm add defuddle@0.19.2 @mozilla/readability@0.6.0 minisearch@7.2.0` (exact same packages/versions; package.json + pnpm-lock.yaml updated)
- **Files modified:** package.json, pnpm-lock.yaml
- **Verification:** packages resolve at exact versions; all tests + wxt build pass
- **Committed in:** 6ee55a8 (Task 2 commit)

**2. [Rule 2 - Missing Critical] Clone-based redaction instead of mutating live password fields**
- **Found during:** Task 2 (DomSerializer)
- **Issue:** Plan mechanism (`field.value = ''` on the live document) is a visible host-page mutation — it wipes the user's typed password from the page — contradicting the plan's own prohibition ("no host-page DOM mutation beyond non-visible read operations (e.g., cloning into memory)")
- **Fix:** `serializePage` redacts on `doc.cloneNode(true)`; the live document is untouched (asserted by test)
- **Files modified:** src/core/content/DomSerializer.ts
- **Verification:** `never mutates the live document` test passes
- **Committed in:** 6ee55a8 (Task 2 commit)

**3. [Rule 1 - Bug] Attribute-set password values leaked after `field.value = ''`**
- **Found during:** Task 2 (DomSerializer redaction tests)
- **Issue:** The value IDL property and the value content attribute are decoupled — `outerHTML` serializes the attribute, so clearing the property alone leaves `value="secret"` in the captured HTML (a real D-02 privacy-boundary gap in the plan's stated mechanism, in real browsers too)
- **Fix:** `removeAttribute('value')` + `field.value = ''` on the clone
- **Files modified:** src/core/content/DomSerializer.ts
- **Verification:** attribute-set value tests pass (`AttrSecret`, `PwdHeuristic` absent from output)
- **Committed in:** 6ee55a8 (Task 2 commit)

**4. [Rule 3 - Blocking] defuddle's `markdown: true` option is inert in the main entry**
- **Found during:** Task 2 (strategy smoke test)
- **Issue:** The `markdown`/`separateMarkdown` options only take effect in the `defuddle/full` subpath export (its wrapped parse() applies toMarkdown); the main `defuddle` entry returns HTML regardless
- **Fix:** `import Defuddle from 'defuddle/full'` — real markdown output per plan intent
- **Files modified:** src/core/extraction/strategies/DefuddleStrategy.ts
- **Verification:** markdown conversion assertions pass in happy-dom environment
- **Committed in:** 6ee55a8 (Task 2 commit)

**5. [Rule 3 - Blocking] jsdom cannot run defuddle's pipeline (`:has()` selectors)**
- **Found during:** Task 2 (strategy tests)
- **Issue:** defuddle's EXACT_SELECTORS use `:has(source)` — jsdom's nwsapi cannot compile `:has()`, so extraction degrades (unstyled HTML, no markdown) in the jsdom test environment; in real Chrome browsers `:has()` works
- **Fix:** added `happy-dom` devDependency; DefuddleStrategy.test.ts runs under `// @vitest-environment happy-dom`; DomSerializer + PageContentService tests stay in jsdom (their fixtures don't need `:has()`); service tests tolerate jsdom's degraded-but-working defuddle output (confidence gate still passes with generous fixtures)
- **Files modified:** package.json, pnpm-lock.yaml, tests/core/extraction/DefuddleStrategy.test.ts
- **Verification:** 30/30 tests pass
- **Committed in:** 6ee55a8 (Task 2 commit)

**6. [Rule 1 - Bug] `instanceof HTMLInputElement` fails across jsdom realms**
- **Found during:** Task 2 (DomSerializer redaction not firing in tests)
- **Issue:** Elements from a test-created `new JSDOM(...)` document belong to that window's realm — `instanceof` against the environment-global `HTMLInputElement` is false, silently skipping redaction (the production content script uses the page's own realm so it worked there — the bug was test-environment-specific but made redaction untestable)
- **Fix:** realm-safe `el.tagName === 'INPUT'` guard (selectors already restrict to input elements)
- **Files modified:** src/core/content/DomSerializer.ts
- **Verification:** all redaction tests pass
- **Committed in:** 6ee55a8 (Task 2 commit)

**7. [Rule 1 - Bug] MessageBus dispatch discarded handler return values**
- **Found during:** Task 2 (content script migration design)
- **Issue:** `MessageBus.init()` sent `Promise.allSettled([...])` results to `sendResponse` — the D-04 contract (synchronous handler return → sendResponse) would never deliver the SerializedPage to the extension page
- **Fix:** dispatch unwraps a single fulfilled handler's value; handler type widened from `void | Promise<void>` to `unknown` (return values are the point of sendResponse forwarding)
- **Files modified:** src/core/messaging/MessageBus.ts
- **Verification:** full pipeline tests + existing runtime/context suites pass (61 tests regression-checked)
- **Committed in:** 6ee55a8 (Task 2 commit)

**8. [Rule 3 - Blocking] vitest `@` alias broken + missing jsdom types**
- **Found during:** Task 2 (test import resolution)
- **Issue:** `vitest.config.ts` aliases `@` to `path.resolve(__dirname, '.')` but the config is ESM (`"type": "module"`) where `__dirname` is undefined — the alias resolves nowhere; `@types/jsdom` was also absent
- **Fix:** tests use relative imports per the established codebase convention (zero existing tests use `@`); added `@types/jsdom@21.1.7` (the only published @types major covering jsdom 25's stable JSDOM API)
- **Files modified:** test files, package.json, pnpm-lock.yaml
- **Verification:** tsc clean for all test files
- **Committed in:** 6ee55a8 (Task 2 commit)

**9. [Rule 1 - Bug] Zod recursive schemas failed tsc (TS2502/TS2456)**
- **Found during:** Task 2 (tsc verification)
- **Issue:** `export const RawNodeSchema = z.strictObject({... z.lazy(() => RawNodeSchema)})` with `type RawNode = z.infer<typeof RawNodeSchema>` is circular
- **Fix:** infer the node type from the non-recursive base schema (`z.strictObject(baseRawNodeFields)`) intersected with the recursive children field; annotate the schema `z.ZodType<RawNode>`
- **Files modified:** src/core/extraction/apcLite.types.ts
- **Verification:** tsc clean; tests pass
- **Committed in:** 6ee55a8 (Task 2 commit)

**10. [Rule 1 - Bug] `@` alias in content.core.ts unresolved by tsc**
- **Found during:** Task 2 (tsc verification)
- **Issue:** WXT's `@` alias maps to the project ROOT (`@/*` → `../*` from `.wxt/`), so `@/core/...` resolves to `<root>/core/...` — not `src/core/...`
- **Fix:** relative imports (`../src/core/...`) in the entrypoint, matching the codebase-wide convention
- **Files modified:** entrypoints/content.core.ts
- **Verification:** tsc clean; wxt build succeeds
- **Committed in:** 6ee55a8 (Task 2 commit)

---

**Total deviations:** 10 auto-fixed (2 missing critical, 4 blocking, 4 bugs)
**Impact on plan:** All auto-fixes were required for correctness (D-02 boundary), environment compatibility (pnpm/jsdom/happy-dom), or contract fidelity (defuddle/full, MessageBus sendResponse). No scope creep; all plan deliverables implemented per spec.

## Issues Encountered

- **Pre-existing tsc errors in src/core/storage (9)** — ApiKeyStore, CryptoService, MigrationRunner fail `tsc --noEmit` under the current @types/node (Uint8Array<ArrayBufferLike>/ArrayBuffer/IDBTransaction drift). Unrelated to this plan; files untouched. Out of scope per scope boundary — logged to deferred items.
- **Pre-existing test failures in tests/core/ai (6)** — StreamAdapter (2: `capturedOnChunk is not a function`) and ProviderAdapter (4: `createLanguageModel` returns non-LanguageModel). **Verified pre-existing**: identical failures reproduced on pristine HEAD (7a4c686) with the original lockfile in a clean worktree. Not caused by this plan's dependency additions (package.json diff shows no existing dep changed).
- **pnpm-lock side effect:** running any `pnpm add` re-resolves peer dependencies — the `@tailwindcss/vite` peer moved from vite@6.4.3 to the newly-added vite@8.1.5 (inert: vitest/wxt still build on vite@6.4.3, verified in lock + passing build).
- **vitest.config.ts `@` alias is broken** for any future test that uses it (ESM `__dirname`); deferred — codebase convention is relative imports.
- **`tests/isolation/no-content-script-ui.test.ts` referenced in package.json `verify:phase-4a` does not exist** — presumably created by a later plan in this phase (04a-04 bundle isolation); noted so the phase verify script is complete once that plan lands.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Ready for 04a-02** (Readability fallback + PageIndexBuilder): the IExtractionStrategy interface and orchestrator fallback chain are in place — ReadabilityFallback slots in as a second strategy; the confidence gate (<500 chars) is implemented at orchestrator level and currently falls through to NO_CONTENT when only one strategy exists
- **Ready for 04a-03** (APCLite actionable mode): apcLite.types.ts schemas + PageContext actionable variant + serializer dispatch exist; ApcLiteStrategy implements the same interface
- **Ready for 04a-04** (PageIndexBuilder/bundle isolation): PageContentCache and the 5s timeout budget are in place; the `no-content-script-ui` isolation test file referenced by `verify:phase-4a` is expected to land there
- **Deferred wiring:** `pageContentService.init()` (tabs.onUpdated invalidation) is implemented and tested but not yet called from the side panel entrypoint — the side panel's PageContentService integration lands with the UI plans; the plan's file scope excluded entrypoints for Task 3
- **Blocker:** the pre-existing tests/core/ai failures and src/core/storage tsc errors predate this phase and should be triaged separately (verified not caused by this plan)

---
*Phase: 04a-page-content-extraction*
*Completed: 2026-07-31*

## Self-Check: PASSED

- All 12 created files + SUMMARY.md verified on disk (FOUND)
- Commits verified: `6ee55a8` (Task 2 tracer), `93c9d75` (Task 3 hardening)
- Task 1 (decision checkpoint) ratified by user response "proceed" — no commit (decision only)
