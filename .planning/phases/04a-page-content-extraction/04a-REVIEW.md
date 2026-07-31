---
phase: 04a-page-content-extraction
reviewed: 2026-07-31T08:35:30Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - entrypoints/content.core.ts
  - entrypoints/sidepanel/main.tsx
  - src/core/content/DomSerializer.ts
  - src/core/content/PageContextBridge.ts
  - src/core/extraction/PageContentCache.ts
  - src/core/extraction/PageContentSerializer.ts
  - src/core/extraction/PageContentService.ts
  - src/core/extraction/apcLite.types.ts
  - src/core/extraction/strategies/ApcLiteStrategy.ts
  - src/core/extraction/strategies/DefuddleStrategy.ts
  - src/core/extraction/strategies/IExtractionStrategy.ts
  - src/core/extraction/strategies/ReadabilityFallback.ts
  - src/core/extraction/types.ts
  - src/core/messaging/MessageBus.ts
  - src/core/runtime/RuntimeEnvelope.ts
  - tests/core/content/DomSerializer.test.ts
  - tests/core/content/PageContextBridge.test.ts
  - tests/core/extraction/ApcLiteStrategy.test.ts
  - tests/core/extraction/DefuddleStrategy.test.ts
  - tests/core/extraction/PageContentService.test.ts
  - tests/core/extraction/strategies/ReadabilityFallback.test.ts
  - tests/isolation/no-content-script-ui.test.ts
findings:
  critical: 1
  warning: 4
  info: 5
  total: 10
status: issues_found
---

# Phase 04a: Code Review Report

**Reviewed:** 2026-07-31
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Fresh review of all 22 files covering the current state, including the 04a-05 gap-closure changes (contains-match `PASSWORD_NAME_PATTERN` in `DomSerializer.ts`, `pageContentService.init()` wiring in `entrypoints/sidepanel/main.tsx`, and the repointed isolation tests against `.output/chrome-mv3/content.js`).

The gap-closure plan resolved the previous review's critical finding (CR-01 surrogate-splitting truncation — now handled by `truncateAtCodePoint`) and the constructor-side-effect, silent-error-swallowing, and import-time-registration warnings (WR-02/WR-03/WR-05 from the prior review are fixed). The architecture remains sound: discriminated-union error handling, Zod boundary validation, strategy chain with shared 5s budget, D-02 redaction on a DOM clone, and D-20 isolation enforced by source-grep + bundle-size tests.

Remaining issues center on one correctness bug in the cache contract (CR-01), two content-script runtime hazards (WR-01, WR-02), and two redaction-heuristic gaps (WR-03, WR-04). The `sidepanel/main.tsx` init() wiring is correct and idempotent; the isolation tests now assert against real build output, though Test 2/3 silently pass when no build exists.

## Critical Issues

### CR-01: PageContentCache is mode-blind — extract() returns the wrong mode's PageContext on cache hit

**File:** `src/core/extraction/PageContentService.ts:82-84`, `src/core/extraction/PageContentCache.ts:21-30`

**Issue:** `extract(tabId, mode, url)` is mode-parameterized, and the in-flight coalescing key includes mode (`${tabId}:${url}:${mode}`, line 86) — but the cache key does not. `PageContentCache.get(tabId, url)` / `set(tabId, url, result)` store a single entry per tabId+url with no mode discrimination, and `extract()` reads the cache before consulting mode:

```typescript
const cached = this.pageContentCache.get(tabId, url);  // mode ignored
if (cached) return cached;
```

Consequently, after `extract(1, 'default', url)` populates the cache, a subsequent `extract(1, 'actionable', url)` returns the **default-mode** PageContext (no `apcLiteTree`), and vice versa: an actionable cache entry satisfies a default-mode request with a tree and no markdown. Callers branching on the discriminated union will silently receive the wrong content type — the actionable-mode consumer gets markdown instead of a tree. The cache entry also has no mode awareness for `invalidateIfChanged`, so mode-specific invalidation is impossible. This is the primary cache path (cache-first design, D-17), so the bug triggers whenever both modes are used for the same tab — a likely scenario once v2 automation consumes actionable mode on the same tabs the context pipeline extracts in default mode. No test covers cross-mode reuse of one tab.

**Fix:** Make the cache mode-aware:

```typescript
// PageContentCache.ts
get(tabId: number, mode: string, url: string): ExtractionResult | null {
  const entry = this.entries.get(cacheKey(tabId, mode, url));
  return entry ? entry.result : null;
}
set(tabId: number, mode: string, url: string, result: ExtractionResult): void {
  this.entries.set(cacheKey(tabId, mode, url), { url, result, indexedAt: Date.now() });
}
// key: `${tabId}:${mode}:${url}` — or use a nested Map<tabId, Map<mode, CacheEntry>>
```

```typescript
// PageContentService.extract() — pass mode through:
const cached = this.pageContentCache.get(tabId, mode, url);
// ...
this.pageContentCache.set(tabId, mode, url, result);
```

Add a regression test: extract default for a tab, then extract actionable for the same tab+url, and assert the second call performs a fresh extraction with `pageContext.mode === 'actionable'`.

## Warnings

### WR-01: crypto.randomUUID() is SecureContext-only — SPA_NAVIGATION creation can throw in the content script on http:// pages

**File:** `src/core/runtime/RuntimeEnvelope.ts:30`, `entrypoints/content.core.ts:28-32`

**Issue:** `createEnvelope()` uses `crypto.randomUUID()`, which is exposed only in secure contexts. `content.core.ts` runs on `<all_urls>` including plain-http origins, and Chrome content-script isolated worlds inherit the page's security context — on `http://` pages `crypto.randomUUID` is undefined. `notifyNavigation()` calls `createEnvelope(...)` **before** the `.catch()` guard:

```typescript
const envelope = createEnvelope('SPA_NAVIGATION', {...}, 'content');  // may throw
chrome.runtime.sendMessage(envelope).catch(...);
```

The throw propagates out of the MutationObserver/wxt:locationchange callback as an uncaught error, `lastUrl` is never updated, and every subsequent mutation re-throws — SPA navigation signals are silently lost for the entire session on insecure pages (stale cache, missing index invalidation). The sendMessage rejection is carefully guarded, but the envelope construction — the more likely failure — is not.

**Fix:** Guard ID generation in `createEnvelope` (or in the content-script path):

```typescript
function generateOperationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for insecure origins: content scripts on http:// pages.
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
```

Also wrap the `notifyNavigation()` body in try/catch so a single failed event never wedges `lastUrl` tracking.

### WR-02: SPA_NAVIGATION handler destroys the per-tab index while keeping the cache hot on same-URL events

**File:** `src/core/extraction/PageContentService.ts:126-128`

**Issue:** The handler removes the tab's MiniSearch index **unconditionally**, then conditionally invalidates the cache:

```typescript
pageIndexBuilder.removeTab(tabId);          // always
this.pageContentCache.invalidateIfChanged(tabId, envelope.payload.url);  // only if URL differs
```

When the announced URL equals the cached URL (a real race: the panel extracts the post-navigation URL before the SPA_NAVIGATION message arrives), the cache stays hot but the index has been destroyed. The next `extract()` for that tab+url hits the cache and returns the pre-built result **without rebuilding the index** — the tab is left with no searchable index while the cache claims the content is ready (D-14 per-tab index contract silently broken until an explicit `reExtract`). The comment on lines 114-116 ("Index cleanup happens BEFORE cache invalidation") only describes the URL-changed path; the same-URL path contradicts its own "keep the cache hot" intent.

**Fix:** Only remove the index when the cache is actually invalidated:

```typescript
const invalidated = this.pageContentCache.invalidateIfChanged(tabId, envelope.payload.url);
if (invalidated) {
  pageIndexBuilder.removeTab(tabId);  // order preserved for the changed-URL path
}
```

### WR-03: Contains-match PASSWORD_NAME_PATTERN redacts legitimate non-password fields (04a-05 change)

**File:** `src/core/content/DomSerializer.ts:16`, `68-71`, `87-92`

**Issue:** The 04a-05 gap-closure replaced the pattern with a broad contains-match: `/pass(word|wd)?|pwd/i`. `PASSWORD_NAME_PATTERN.test(name)` matches any name containing "pass", "passwd", or "pwd" anywhere — including `passenger_first_name`, `passport_number`, `compass_bearing`, `bypass_code`, `passage`, `passcode`. Values of such legitimate inputs are stripped from the serialized HTML (lines 87-92), silently degrading extraction quality for common form fields (airline check-in, travel, auth-bypass-related forms), and any non-empty match triggers the full clone-and-redact path (lines 76-93) on pages with zero actual password fields. The privacy direction is right (zero password leaks > false positives), but the heuristic is now strictly broader than the previous anchored variant and the false-positive set is large enough to matter.

**Fix:** Keep contains-match semantics (required by the 04a-05 tests for `user_passwd`/`db_pwd`) but exclude known innocuous substrings, e.g.:

```typescript
const PASSWORD_NAME_PATTERN =
  /(?<![a-z])(?:pass(?:word|wd)?|pwd)(?![a-z])/i;  // word-ish boundary
// plus an explicit allowlist for high-frequency false positives:
// /^(?:.*(?:passenger|passport|compass|bypass|passage|passcode).*)$/i → excluded
```

Alternatively, restrict the contains-match to the heuristic list the tests actually require (`pass`, `pwd`, `passwd`, `password`) and accept residual false positives — the exact tradeoff should be a documented D-02 decision rather than an implicit one.

### WR-04: ApcLiteStrategy captures values the serializer redacts — type=hidden misclassified as editable textbox

**File:** `src/core/extraction/strategies/ApcLiteStrategy.ts:133-147` (`inputRole`), `225-256` (`attributesOf`)

**Issue:** Two gaps in the strategy's D-02 guard, which claims "password values are NEVER captured at source":

1. `inputRole()` has no `type="hidden"` case — it falls through to the default `'textbox'`. A hidden input (CSRF tokens, session identifiers, pre-filled user data — e.g. `<input type="hidden" name="csrf_token" value="...">`) becomes a `textbox` node that is `editable: true` (role-based editable check, line 204) and `focusable: true` (INTERACTIVE_ROLES), and `attributesOf` keeps its `value` attribute (the password skip at lines 246-252 checks `type === 'password'` only). Hidden tokens therefore flow into the APCLite tree and into the AI pipeline for actionable mode, and the tree misrepresents them as user-editable fields — wrong both as data and as an automation substrate. `redactSensitive` is only applied to markdown in default mode, so nothing downstream scrubs the tree.
2. `attributesOf` guards only `type="password"`. An input with `name="pwd"`/`autocomplete="current-password"` but no `type` attribute (browsers default to text) leaks its attribute-set value into the tree. The DomSerializer redacts these via the name heuristic and autocomplete selector — the production pipeline happens to protect the strategy, but the strategy's own documented trust gate (verified by tests that feed raw HTML, e.g. `ApcLiteStrategy.test.ts:158-174`) is narrower than the serializer's, so the defense-in-depth claim does not hold at the strategy boundary.

**Fix:** In `inputRole`, return `null`-ish semantics for hidden inputs (skip the node — `SKIP_TAGS`-style, or exclude in `computeRole`), and mirror the serializer's heuristics in `attributesOf`:

```typescript
function inputRole(el: Element): string | null {
  const type = (el.getAttribute('type') || 'text').toLowerCase();
  if (type === 'hidden') return null;   // never captured
  switch (type) { /* ... existing cases ... */ }
}

// attributesOf value case:
case 'value':
  if (el.tagName.toLowerCase() === 'input') {
    const t = (el.getAttribute('type') || '').toLowerCase();
    const name = el.getAttribute('name') || '';
    if (t === 'password' || PASSWORD_NAME_PATTERN.test(name) ||
        el.getAttribute('autocomplete') === 'current-password') {
      break;  // skip
    }
  }
  attributes[name] = attr.value;
  break;
```

Note this requires exporting/duplicating `PASSWORD_NAME_PATTERN` from DomSerializer (which the strategy may import — it does not run in the content script bundle, so D-20 is unaffected).

## Info

### IN-01: Per-strategy timeout timers are never cleared

**File:** `src/core/extraction/PageContentService.ts:169-171`

**Issue:** Each loop iteration creates `setTimeout(() => reject(STRATEGY_TIMEOUT), remaining)` without keeping the handle; when the strategy settles first, the timer still fires later (rejecting an already-settled promise — a harmless no-op, but the timer and closure stay alive for up to 5s per attempt). In a long-lived side panel with frequent extractions this is a small but avoidable resource retention. **Fix:** capture the handle and `clearTimeout` in a `finally` on the race, or race against a single deadline timer created per extraction.

### IN-02: geometryOf() always returns zeros — enrichment is dead data

**File:** `src/core/extraction/strategies/ApcLiteStrategy.ts:166-183`

**Issue:** Per D-05 the strategy parses the serialized HTML in the extension-page context via DOMParser — a detached document with no layout. `getBoundingClientRect()` on such a document returns all-zero rects (the test at `ApcLiteStrategy.test.ts:89` asserts `{x:0,y:0,width:0,height:0}`), so every node's `geometry` field is meaningless. The data will mislead v2 automation if consumed as-is. **Fix:** either drop geometry from the v0.1 tree, or document that geometry requires a follow-up capture pass in the content script (where layout exists) — don't ship zeros as if they were measurements.

### IN-03: PASSWORD_INPUT_SELECTOR covers only `<input>` elements

**File:** `src/core/content/DomSerializer.ts:13-14`

**Issue:** The D-02 selector covers `input[type=password]`, `[isPassword]`, and `input[autocomplete=current-password]` — but not `<textarea>` (rarely used for passwords, but occurs) or `contenteditable` password entry widgets, whose contents serialize as child text. **Fix:** extend the selector with `textarea[autocomplete="current-password"], textarea[isPassword]` and (if cheap) clear textarea text on the clone; at minimum document the boundary.

### IN-04: isHidden() ignores CSS visibility — hidden-by-style interactive content enters the tree

**File:** `src/core/extraction/strategies/ApcLiteStrategy.ts:129-131`

**Issue:** `isHidden` checks only the `hidden` attribute and `aria-hidden="true"`. Interactive elements inside `display:none`/`visibility:hidden` containers (hidden modals, off-screen menus, accordion corpses) are captured as actionable nodes, adding noise and potentially capturing pre-filled values the user never sees. **Fix:** also consult `el.checkVisibility?.()` or a computed-style probe (`getComputedStyle(el).display === 'none'`) in the walker.

### IN-05: Static spaNavUnregister guard binds SPA invalidation to the first instance

**File:** `src/core/extraction/PageContentService.ts:37`, `118-131`

**Issue:** The idempotent static guard means that if a second `PageContentService` instance ever calls `init()` (e.g., a future full-app entry point constructing its own instance), the SPA_NAVIGATION handler remains bound to the **first** instance's `pageContentCache` — the second instance's cache never receives SPA invalidation, silently serving stale data. The module singleton makes this latent today, but the guard's cross-instance capture is a trap for the next consumer. **Fix:** store the cache reference on the registration (e.g., a static handler that routes via a per-instance map), or assert/document that only the singleton may call `init()`.

---

_Reviewed: 2026-07-31_
_Reviewer: the agent (gsd-code-reviewer)_
_Depth: standard_
