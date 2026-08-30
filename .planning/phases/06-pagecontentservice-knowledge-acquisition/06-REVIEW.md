---
phase: 06-pagecontentservice-knowledge-acquisition
reviewed: 2026-08-30T00:00:00Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - entrypoints/content/core.content.ts
  - package.json
  - src/core/content/AxDomWalker.ts
  - src/core/content/ContentScriptHost.ts
  - src/core/content/PageContextBridge.ts
  - src/core/content/PageContext.ts
  - src/core/content/SPANavigationWatcher.ts
  - src/core/context/types.ts
  - src/core/extraction/apcLite.types.ts
  - src/core/extraction/PageContentCache.ts
  - src/core/extraction/PageContentSerializer.ts
  - src/core/extraction/PageContentService.ts
  - src/core/extraction/PageIndexBuilder.ts
  - src/core/extraction/strategies/ApcLiteStrategy.ts
  - src/core/extraction/strategies/DefuddleStrategy.ts
  - src/core/extraction/strategies/IExtractionStrategy.ts
  - src/core/runtime/RuntimeEnvelope.ts
  - src/types/turndown.d.ts
  - tests/core/content/AxDomWalker.test.ts
  - tests/core/content/ContentScriptHost.test.ts
  - tests/core/content/PageContextBridge.test.ts
  - tests/core/content/SPANavigationWatcher.test.ts
  - tests/core/extraction/ApcLiteStrategy.test.ts
  - tests/core/extraction/DefuddleStrategy.test.ts
  - tests/core/extraction/PageContentService.test.ts
  - tests/core/extraction/PageIndexBuilder.test.ts
  - tests/isolation/no-content-script-ui.test.ts
  - tests/setup.ts
findings:
  critical: 3
  warning: 5
  info: 3
  total: 11
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-08-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

Reviewed the Phase 6 PageContentService knowledge-acquisition stack: content-side walker/serializer/bridge/watcher shells (AxDomWalker, ContentScriptHost, PageContextBridge, SPANavigationWatcher), the panel-side service/strategy/cache/index layer (PageContentService, DefuddleStrategy, ApcLiteStrategy, PageContentCache, PageIndexBuilder, PageContentSerializer), the shared envelope/types modules, and their tests.

The architecture is well-disciplined — the Pitfall-8 import boundary (no zod/defuddle in the content bundle), the D-86 password-omission invariant, the D-91 no-silent-empty-result contract, and the D-90 redaction seam are all consistently implemented and tested. However, three correctness defects need fixing before this ships: (1) the element-boundary serializer stops mid-fragment and drops serializable siblings, (2) the "2 MB" cap is enforced in UTF-16 code units rather than bytes, silently violating the stated byte budget on multi-byte pages, and (3) the extraction abort/timer race leaves a losing strategy promise whose late rejection is unhandled, with caller-abort misclassified as a timeout. Additional warnings cover a duplicate SPA watcher instance, a textarea secret-leak gap, overly-broad redaction regex, and test-infra storage-mock isolation.

## Critical Issues

### CR-01: Element-boundary truncation stops the whole fragment — later siblings dropped despite remaining budget

**File:** `src/core/content/ContentScriptHost.ts:84-98`
**Issue:** `visit()` returns `false` after descending into an overflowing element's children, and the caller loops `if (!visit(child)) break;` — so once ANY element whose own `outerHTML` exceeds the remaining budget is encountered, the walk serializes that element's children (if they fit) and then **stops entirely**, dropping every subsequent sibling even when budget remains. On a page whose top-level structure is a large wrapper (e.g. `<body><div class="page">…</div><footer>…</footer></body>`), the footer and everything after the overflowing wrapper is silently lost even though it would fit within the 2 MB budget. This contradicts the module's own contract: "serialize children individually … never a mid-element cut" — the fragment should contain *all* complete elements up to the point where budget is genuinely exhausted. The current tests only exercise flat sibling lists (`<p>alpha</p><p>beta</p><p>gamma</p>`), which never triggers the nested-overflow path, so the defect is unguarded.
**Fix:** Distinguish "budget exhausted — stop" from "element dropped, but keep scanning siblings":

```typescript
const visit = (el: Element): boolean => {
  const full = el.outerHTML;
  if (out.length + full.length <= budget) {
    out += full;
    return true; // consumed — continue
  }
  if (el.children.length > 0) {
    for (const child of Array.from(el.children)) {
      if (!visit(child)) return false; // budget truly exhausted inside
    }
    return true; // wrapper dropped, children fit — continue with siblings
  }
  return false; // leaf does not fit — budget exhausted
};
```

### CR-02: `PAGE_HTML_MAX_BYTES` is enforced as UTF-16 code units, not bytes

**File:** `src/core/content/ContentScriptHost.ts:73-105` (and the mirrored constant at `:28`)
**Issue:** The cap is named and documented as bytes (`PAGE_HTML_MAX_BYTES = 2_000_000`, "§26.6 hard size cap (2 MB)"), and `IExtractionStrategy.ts:48` mirrors the value. But the budget comparison is `rootHTML.length <= budget` / `out.length + full.length <= budget` — `String.prototype.length` counts UTF-16 code units. A page with CJK/emoji/accented content can be up to 2× the stated byte budget (each code unit encodes to 2–3 UTF-8 bytes), so a "2 MB" payload can actually be ~4–6 MB over the wire. Conversely, the doc's "never a mid-element cut" guarantee is also violated in the *other* direction: a fragment measured in code units can be far smaller in real bytes than the budget allows. This also risks exceeding `chrome.runtime.sendMessage`'s message-size limit (the `.catch(() => {})` in `sendHtmlPayload`/`core.content.ts` then swallows the failure silently, with no `truncated` flag set).
**Fix:** Measure actual UTF-8 bytes: `new TextEncoder().encode(html).length` (or `new Blob([html]).size`) in `serializeWithinBudget` and in the initial `rootHTML.length <= budget` check.

### CR-03: Extraction abort race — losing strategy promise's late rejection is unhandled; caller abort misreported as timeout

**File:** `src/core/extraction/PageContentService.ts:114-175`
**Issue:** Two defects in the abort/timer wiring:

1. `Promise.race([strategy.run(strategyInput), abortPromise])` — when the timer or caller abort wins the race, the losing `strategy.run()` promise has no rejection handler attached. Any strategy that *rejects* after the race has settled (rather than hanging forever) produces an unhandled promise rejection. Today's strategies catch their own errors, but the contract is `run(): Promise<StrategyResult>` and a future/throwing strategy turns this into an unhandled rejection in the surface context.
2. The abort classification conflates sources: both the internal 5 s timer and a caller `signal.abort()` fire the same `controller.abort()`, and the catch block reports `extraction timed out after 5000ms` for **both** — a caller abort is misreported as a timeout, which is wrong diagnostics for the surface and for `debugLog`.

**Fix:**

```typescript
let abortedByCaller = false;
const onCallerAbort = () => { abortedByCaller = true; controller.abort(); };
// ...
try {
  const result = await Promise.race([
    Promise.resolve(strategy.run(strategyInput)).catch((e) => { throw e; }), // keep for logging
    abortPromise,
  ]);
  // ...
} catch (error) {
  if (controller.signal.aborted) {
    const message = abortedByCaller
      ? 'extraction aborted by caller'
      : `extraction timed out after ${PAGE_EXTRACTION_TIMEOUT_MS}ms`;
    return extractFailed(message, input, error);
  }
  return extractFailed('strategy run failed', input, error);
}
```

If the losing-promise rejection is intentionally ignored, attach an explicit no-op catch: `strategy.run(strategyInput).catch(() => {})` before racing.

## Warnings

### WR-01: `startWatcher` runs twice per page — duplicate WXT listener and MutationObserver

**File:** `entrypoints/content/core.content.ts:28-29` + `src/core/content/PageContextBridge.ts:73`
**Issue:** `core.content.ts` calls `initBridge(ctx, { onNavigate })` **and** `startWatcher(ctx, onNavigate)`; `initBridge` internally calls `startWatcher` again (`PageContextBridge.ts:73`). Two WXT `wxt:locationchange` listeners and two MutationObservers are registered on every page. The entry-point copy's `onNavigate` is a no-op (`:26`), so its emissions are pure waste — but it keeps a MutationObserver alive (the cleanup at `:37` does disconnect it, but the WXT listener is never removable per the module's own note). Double DOM-mutation observation on every page is wasted work in the content script, and the shell seam comment ("the bridge's own watcher sends …") already acknowledges the redundancy.
**Fix:** Either drop `startWatcher` from the entry point (the bridge owns the watcher) or have `initBridge` accept the already-started watcher/`onNavigate` callback and skip its own `startWatcher` call. Keep exactly one watcher per page.

### WR-02: Textarea secret values leak — `isPasswordControl` applies to inputs only

**File:** `src/core/content/AxDomWalker.ts:167-186` (with `isPasswordControl` at `:63-70`)
**Issue:** `formControl()` applies the password hint check only when `tag === 'input'` (`:172`). For a `<textarea name="password">`, `<textarea name="secret">`, or `<textarea placeholder="API key">`, the walker captures the **full textarea value** and emits it in `RawNode.form.control.value` (and `fieldType: 'textarea'`). The module's stated invariant is "password values are omitted AT CAPTURE" (D-86/D-90) — but only `input` controls are protected. The panel-side `FormControlSchema.refine` backstop is also ineffective here because the walker sets `isPassword: false` for textareas, so the refinement never trips.
**Fix:** Apply the same hint check to textareas: `const isPassword = tag === 'input' || tag === 'textarea' ? isPasswordControl(el) : false;` — or at minimum, apply `isPasswordControl` for `tag === 'textarea'` too.

### WR-03: `all_urls` content-script match contradicts the documented ServiceNow-only permission policy

**File:** `entrypoints/content/core.content.ts:7`
**Issue:** `matches: ['<all_urls>']` injects the extraction content script into every page the user visits, while `wxt.config.ts:44-49` states "host_permissions stays limited to ServiceNow domains only — never all_urls" and the CLAUDE.md architecture constraints repeat "Never `all_urls`; only `*://*.service-now.com/*` and `*://support.servicenow.com/*`". The extraction shell runs and the bridge's `onMessage` listener is live on every origin; `EXTRACT_PAGE_CONTENT` requests from the extension's own surfaces can then serialize/walk *any* page the user has open, including banking/email pages. `all_urls` was pre-existing from Phase 1, but Phase 6 built the full extraction machinery on top of it — this is the phase that makes the mismatch consequential (full HTML of arbitrary pages crosses into the panel).
**Fix:** Align `matches` with `host_permissions`: `['*://*.service-now.com/*', '*://support.servicenow.com/*']` (matching the wxt.config entries), or document an explicit ADR if broad matching is intentional for v0.1.

### WR-04: Secret redaction regex is overly broad — non-secret keys emptied

**File:** `src/core/extraction/PageContentService.ts:23, 88-95`
**Issue:** `SECRET_KEY_REGEX = /key|token|secret|authorization/i` matches the substring anywhere in the key: `monkey`, `keyboard`, `tokenizer`, `secretary`, `authorizationNote` — any key containing these letters is emptied (`meta['monkey'] = ''`), silently destroying legitimate page metadata (the same pattern exists at `redactSensitive.ts:25`, but this is the extraction-layer copy that ships Phase 6). Privacy-conservative is defensible, but whole-key matching on `key|token` substrings has high false-positive rates on real ServiceNow pages (`auth_token_sys_id`, `accessKey`, etc.). At minimum the test suite only covers the happy path (`apiKey` redacted, `note` kept) and never asserts the false-positive boundary.
**Fix:** Anchor to token-like shapes: `/^(api[_-]?key|access[_-]?key|auth(?:orization)?|token|secret|password)$/i` — or document and test the substring-match semantics explicitly so the behavior is a decision, not an accident.

### WR-05: Test storage mocks share one backing map — `local`/`sync`/`session` isolation broken

**File:** `tests/setup.ts:56-101, 108-145, 153-195`
**Issue:** `chromeStorageLocal`, `chromeStorageSync`, and `chromeStorageSession` all `get`/`set` against the same `chromeStorage` map; `sessionMap` (`:153`) is populated by nothing and `__chromeSessionMap` is never written. Consequences: a `chrome.storage.session` write is visible to `chrome.storage.local` reads (and vice-versa), so a test asserting "secrets are in session, not local" can pass vacuously; `__chromeSessionMap` stays empty, breaking any test that inspects it. The three storage areas are supposed to be isolated (CLAUDE.md: "Auth tokens (never in local)" / "Secrets in chrome.storage.session"). Pre-existing, but Phase 6's cache/service layer leans on storage semantics and future phases will write security-sensitive tests against these mocks.
**Fix:** Give each area its own map:

```typescript
const localMap = new Map<string, string>();
const syncMap = new Map<string, string>();
const sessionMap = new Map<string, string>();
// get/set/remove/clear bind to their own map; expose __chromeStorageMap,
// __chromeSyncMap, __chromeSessionMap separately.
```

## Info

### IN-01: `PageContentSerializer.apcTreeToMarkdown` has no direct unit test

**File:** `src/core/extraction/PageContentSerializer.ts:47-84`
**Issue:** The structural-markdown renderer (headings/links/forms/tables) is Phase 6's only consumer-facing rendering of the actionable tree, yet no test file exercises it directly — `PageContentService.test.ts` covers `serializeToPageContext` via the service round-trip, and the renderer's branching (heading levels, `(omitted)` password placeholder, table pipe rows, oversized-text splitting) is untested. Bugs in heading-level clamping or link/table emission would ship silently.
**Fix:** Add a small `PageContentSerializer.test.ts` covering: heading levels 1–6 + clamp, link text/href fallback, password `(omitted)` output, table row/cell piping, and text-only nodes.

### IN-02: `getOrExtract` always re-extracts — no serve-if-fresh path

**File:** `src/core/extraction/PageContentCache.ts:163-177`
**Issue:** `getOrExtract` unconditionally calls `PageContentService.extract(input)` even when the entry is already fresh (non-stale with context). Only `get()` serves cached content, and `get()` returns `undefined` for stale entries, so a consumer wanting "cached or extract" must call both. This is documented ("the demand path is getOrExtract, D-89") and internally consistent, but it means every demand-triggered access re-runs the full extraction pipeline (defuddle parse of up to 2 MB HTML) even when nothing changed. Worth a follow-up: `getOrExtract` could short-circuit on `!entry.stale && entry.context !== undefined`.
**Fix:** Consider `if (!entry.stale && entry.context && entry.metrics) { return Promise.resolve({ ok: true, context: entry.context, metrics: entry.metrics }); }` before extracting.

### IN-03: `matchMedia` and `BroadcastChannel` mocks leak between tests

**File:** `tests/setup.ts:41-53, 250-287`
**Issue:** `window.matchMedia` is stubbed once at module load via `Object.defineProperty` — it is never restored between tests, and `vi.stubGlobal('BroadcastChannel', …)` accumulates channel instances across tests (no per-test reset). Phase 6's isolation/`no-content-script-ui` tests don't touch these, but any later test asserting `matchMedia` call counts or channel instance counts will see cross-test contamination. Pre-existing test-infra debt surfaced by the Phase 6 test additions.
**Fix:** Reset `broadcastChannels` and re-stub `matchMedia` in a global `beforeEach` (or export a `__resetMocks()` helper from setup.ts, mirroring `__resetIndexedDB`).

---

_Reviewed: 2026-08-30T00:00:00Z_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_