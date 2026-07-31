---
phase: 04a-page-content-extraction
plan: 06
type: execute
wave: 5
depends_on:
  - 04a-01
  - 04a-02
  - 04a-03
  - 04a-04
  - 04a-05
files_modified:
  - src/core/extraction/PageContentCache.ts
  - src/core/extraction/PageContentService.ts
  - src/core/runtime/OperationId.ts
  - src/core/runtime/RuntimeEnvelope.ts
  - src/core/content/DomSerializer.ts
  - src/core/extraction/strategies/ApcLiteStrategy.ts
  - tests/core/extraction/PageContentService.test.ts
  - tests/core/runtime/OperationId.test.ts
  - tests/core/runtime/RuntimeEnvelope.test.ts
  - tests/core/content/DomSerializer.test.ts
  - tests/core/extraction/ApcLiteStrategy.test.ts
autonomous: true
gap_closure: true
requirements:
  - PAGE-01

must_haves:
  truths:
    - "CR-01: extract(1,'default',url) followed by extract(1,'actionable',url) returns pageContext.mode==='actionable' (fresh extraction, sendMessageMock 2×); repeat calls for either mode reuse mode-specific entries (sendMessageMock stays 2×)"
    - "WR-01: with crypto.randomUUID stubbed undefined, generateOperationId() returns a UUID-format unique string and createEnvelope does not throw (SPA_NAVIGATION construction is safe on http:// origins)"
    - "WR-02: after a same-URL SPA_NAVIGATION event the per-tab MiniSearch index still returns chunks via selectRelevant and the cache stays hot (sendMessageMock 1×); a changed-URL event still invalidates both (sendMessageMock 2×)"
    - "WR-03: values of passenger_first_name, passport_number, compass_bearing, bypass_code inputs appear in serialized HTML; values of user_pwd, user_passwd, db_pwd, login_password, confirmPassword, passcode do not"
    - "WR-04: type=hidden inputs (including with tabindex) produce no APCLiteNode and their values appear nowhere in the tree; name-heuristic/autocomplete/isPassword input values are skipped at the strategy boundary"
    - "pnpm run verify:phase-4a vitest portion exits 0; no new tsc errors beyond the 9 pre-existing src/core/storage ones"
  artifacts:
    - "src/core/extraction/PageContentCache.ts — entries Map keyed by `${tabId}:${mode}:${url}`; get/set take mode; invalidate/invalidateIfChanged operate on the `${tabId}:` prefix across modes"
    - "src/core/runtime/OperationId.ts — generateOperationId() with crypto.randomUUID availability guard + UUID-v4-shaped Math.random fallback; RuntimeEnvelope.createEnvelope() calls it"
    - "src/core/extraction/PageContentService.ts — extract() passes mode through to cache get/set; SPA_NAVIGATION handler removes the per-tab index only when invalidateIfChanged returns true"
    - "src/core/content/DomSerializer.ts — NON_PASSWORD_NAME_PATTERN (passenger|passport|passage|compass|bypass) + exported isPasswordFieldName() used by both name-heuristic redaction sites"
    - "src/core/extraction/strategies/ApcLiteStrategy.ts — type=hidden skip in the DOM walker + inputRole; value guard mirrors DomSerializer via imported isPasswordFieldName"
  key_links:
    - "PageContentCache key(tabId, mode, url) ↔ PageContentService.extract mode pass-through (CR-01: in-flight coalescing key and cache key now carry the same mode dimension)"
    - "PageContentCache.invalidateIfChanged(tabId, url) return value ↔ pageIndexBuilder.removeTab conditional call (WR-02: index lifetime follows cache lifetime on SPA navigation)"
    - "DomSerializer.isPasswordFieldName ↔ ApcLiteStrategy.attributesOf value guard (WR-03/WR-04: one shared redaction heuristic at both capture boundaries)"
    - "RuntimeEnvelope.createEnvelope → OperationId.generateOperationId (WR-01: content-script envelope construction cannot throw on insecure origins)"
  prohibitions:
    - flag: "flagged-unverified"
      statement: "The D-02 redaction heuristic MUST NOT be narrowed for secret-bearing field names — the NON_PASSWORD_NAME_PATTERN allowlist (passenger|passport|passage|compass|bypass) must never grow to cover passcode/pin/otp/secret/passphrase-class names; a captured password value entering the AI pipeline is unrecoverable"
      source: "prohibition-probe (privacy) — specless probe, no wired check"
    - flag: "flagged-unverified"
      statement: "No type=hidden input value may reach the APCLite tree — the walker-level skip and the value guard must stay airtight against role/tabindex overrides; CSRF/session tokens in the automation substrate would leak secrets to the pipeline"
      source: "prohibition-probe (privacy) — specless probe, no wired check"
    - flag: "flagged-unverified"
      statement: "The cache MUST NOT serve a PageContext across modes — a wrong-mode result returned silently is worse than a miss; mode must remain part of the cache key"
      source: "prohibition-probe (safety/integrity) — specless probe, no wired check"
  flagged_assumptions:
    - flag: "unresolved (specless probe)"
      statement: "PAGE-01 was classified unclassified→unresolved by the spec-less edge probe (the phase has no SPEC.md). Its edge surface (04a-UI-SPEC.md E1: content-script negative contract) is reviewed manually in this code-review-driven closure (CR-01, WR-01..WR-04) on top of the 30/30 phase verification; no formal spec-probe resolution was possible"
      source: "specless-probe-fallback (PAGE-01 unclassified/unresolved)"
---

<objective>
Close the 5 behavioral defects surfaced by the phase code review (04a-REVIEW.md, status: issues_found — 1 critical CR-01, 4 warnings WR-01..WR-04) that the 30/30 verification could not catch. The verifier proves tests pass; these findings are contracts the tests did not cover: cache mode-blindness (CR-01), SecureContext-only crypto.randomUUID in the content-script path (WR-01), index/cache divergence on same-URL SPA navigation (WR-02), over-redaction by the 04a-05 contains-match password heuristic (WR-03), and type=hidden/name-heuristic value capture in ApcLiteStrategy (WR-04).

Purpose: Make the cache, SPA invalidation, and D-02 redaction contracts match their documented intent, with regression tests locking each fix — without touching entrypoints/ or tests/isolation/ (verified and stable, per scope).

Output: 6 source files + 4 test files. All 5 findings closed with new regression tests; the phase vitest gate stays green (86/86 current) and grows.

Scope note (file budget): this plan touches 2 runtime files (OperationId.ts, RuntimeEnvelope.ts) beyond the 4 named extraction/content files because WR-01's root cause — the unguarded `crypto.randomUUID()` in createEnvelope — lives in the runtime module and entrypoints/content.core.ts is out of scope. Guarding the generator at its source eliminates the content-script throw; the secondary notifyNavigation try/catch hardening is unnecessary once construction cannot throw.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04a-page-content-extraction/04a-CONTEXT.md
@.planning/phases/04a-page-content-extraction/04a-RESEARCH.md
@.planning/phases/04a-page-content-extraction/04a-REVIEW.md
@.planning/phases/04a-page-content-extraction/04a-05-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Make PageContentCache mode-aware — cache key includes mode (CR-01)</name>
  <read_first>
    - src/core/extraction/PageContentCache.ts — current Map<number, CacheEntry> keyed by tabId only (get/set/invalidate/invalidateIfChanged, lines 17-51)
    - src/core/extraction/PageContentService.ts:82-101 — extract() cache read/write sites and the mode-bearing in-flight key
    - tests/core/extraction/PageContentService.test.ts:83-92 — existing same-mode cache-hit test pattern ('returns the cached result on a second extract for the same tab+url')
    - .planning/phases/04a-page-content-extraction/04a-REVIEW.md — CR-01 (lines 54-89): fix prescription + required regression test
  </read_first>
  <files>src/core/extraction/PageContentCache.ts, src/core/extraction/PageContentService.ts, tests/core/extraction/PageContentService.test.ts</files>
  <action>
    Fix the mode-blind cache (04a-REVIEW.md CR-01): extract(tabId,'default',url) and extract(tabId,'actionable',url) currently return each other's PageContext on cache hit because the cache key omits mode while the in-flight key (PageContentService.ts line 86) includes it.

    In src/core/extraction/PageContentCache.ts:
    1. Change the backing store from Map<number, CacheEntry> to Map<string, CacheEntry> keyed by a module-level cacheKey(tabId: number, mode: ExtractionMode, url: string) helper returning the string `${tabId}:${mode}:${url}`. Import ExtractionMode from './types' (already imports ExtractionResult from there).
    2. Change get(tabId, mode, url) to look up cacheKey(tabId, mode, url), returning null when absent or when the stored entry.url !== url, else entry.result. Same for set(tabId, mode, url, result) storing { url, result, indexedAt: Date.now() }.
    3. invalidate(tabId): delete every key that starts with the `${tabId}:` prefix (all modes of the tab).
    4. invalidateIfChanged(tabId, url): return false when no `${tabId}:`-prefixed entry exists or every entry's url equals the given url; otherwise delete all `${tabId}:`-prefixed entries and return true. Update the JSDoc to state that SPA navigation invalidates the tab across all modes.
    5. Update the header comment (D-17): keyed by tabId + mode + url, not tabId alone.

    In src/core/extraction/PageContentService.ts extract() (lines 82-101): pass mode through both cache calls — pageContentCache.get(tabId, mode, url) at line 83 and pageContentCache.set(tabId, mode, url, result) at line 95. Leave the in-flight key `${tabId}:${url}:${mode}` at line 86 unchanged. Do NOT change the SPA handler or other invalidation call sites in this task — Task 3 restores index/cache consistency there. Keep the module-level pageContentCache singleton export unchanged.

    Add a cross-mode regression test to tests/core/extraction/PageContentService.test.ts (in the 'PageContentService (hardening)' describe block), named 'returns mode-specific cached results — actionable extraction after default is a fresh extraction (CR-01)':
    1. sendMessageMock resolves makeSerializedPage(); construct the default PageContentService (full three-strategy registry).
    2. extract(1, 'default', 'https://example.com/article') → ok, pageContext.mode === 'default'.
    3. extract(1, 'actionable', 'https://example.com/article') → ok, pageContext.mode === 'actionable' AND pageContext.source === 'apc-lite', sendMessageMock called 2× (fresh extraction — the default-mode entry must not satisfy the actionable request).
    4. extract(1, 'actionable', 'https://example.com/article') again → sendMessageMock still 2× (actionable entry cached).
    5. extract(1, 'default', 'https://example.com/article') again → sendMessageMock still 2× (default entry intact — no cross-mode eviction).

    Pre-fix this test fails at step 3 (mode === 'default' returned from cache, sendMessageMock stuck at 1×) — it is a true regression test.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/core/extraction/PageContentService.test.ts</automated>
  </verify>
  <done>
    PageContentCache is keyed by tabId+mode+url; extract() passes mode through; the CR-01 cross-mode test passes (actionable after default is a fresh extraction, both mode entries cached independently); all pre-existing PageContentService tests still pass, including same-mode cache hit, coalescing, reExtract, onUpdated/onRemoved, and both SPA_NAVIGATION tests.
  </done>
</task>

<task type="auto">
  <name>Task 2: Guard generateOperationId against insecure origins — fallback for content scripts on http:// (WR-01)</name>
  <read_first>
    - src/core/runtime/OperationId.ts — current unguarded `return crypto.randomUUID();` (line 2)
    - src/core/runtime/RuntimeEnvelope.ts:23-35 — createEnvelope uses crypto.randomUUID() directly at line 30
    - tests/core/runtime/OperationId.test.ts — existing format test (UUID regex) that the fallback must keep passing
    - tests/core/runtime/RuntimeEnvelope.test.ts — existing envelope tests; currently no vi import
    - .planning/phases/04a-page-content-extraction/04a-REVIEW.md — WR-01 (lines 92-117): SecureContext-only hazard on <all_urls> http:// pages
  </read_first>
  <files>src/core/runtime/OperationId.ts, src/core/runtime/RuntimeEnvelope.ts, tests/core/runtime/OperationId.test.ts, tests/core/runtime/RuntimeEnvelope.test.ts</files>
  <action>
    Fix the SecureContext-only throw (04a-REVIEW.md WR-01): crypto.randomUUID is undefined on http:// origins; createEnvelope is called from entrypoints/content.core.ts before its sendMessage .catch() guard, so the throw propagates out of the MutationObserver/wxt:locationchange callback and wedges lastUrl tracking for the whole session. entrypoints/ is out of scope for this plan, so the guard goes at the throw's source.

    In src/core/runtime/OperationId.ts:
    1. Replace the bare `return crypto.randomUUID();` with a guarded version: when `typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'` return crypto.randomUUID(); otherwise fall back to a UUID-v4-shaped string built with Math.random — replace each 'x' in the template 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx' with a random hex nibble and each 'y' with ((randomNibble & 0x3) | 0x8).toString(16), using `Math.random() * 16 | 0` for nibbles.
    2. The fallback MUST keep the RFC-4122 v4 shape because the existing test 'generates valid UUID format' (tests/core/runtime/OperationId.test.ts:16-21) asserts the 8-4-4-4-12 hex regex.
    3. Add a JSDoc note: the fallback is a correlation ID only, NOT cryptographically secure and never to be used as a security token.

    In src/core/runtime/RuntimeEnvelope.ts: add `import { generateOperationId } from './OperationId';` and replace `operationId: crypto.randomUUID()` (line 30) with `operationId: generateOperationId()`. With this change createEnvelope cannot throw on insecure origins, so notifyNavigation in entrypoints/content.core.ts (untouched) can no longer wedge: its existing sendMessage rejection guard now covers the entire SPA_NAVIGATION path.

    Tests:
    1. tests/core/runtime/OperationId.test.ts — add `import { vi } from 'vitest';` and a test 'falls back to a UUID-shaped unique id when crypto.randomUUID is unavailable (WR-01)': vi.stubGlobal('crypto', { ...(globalThis.crypto ?? {}), randomUUID: undefined }) inside try/finally with vi.unstubAllGlobals(); assert the returned id matches the same UUID format regex as the existing test AND that 100 consecutive calls are unique.
    2. tests/core/runtime/RuntimeEnvelope.test.ts — add `import { vi } from 'vitest';` and a test 'createEnvelope does not throw when crypto.randomUUID is unavailable (WR-01)': same stub; call createEnvelope('SPA_NAVIGATION', { url: 'http://example.com', timestamp: 0 }, 'content'); assert operationId is a non-empty string.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/core/runtime/OperationId.test.ts tests/core/runtime/RuntimeEnvelope.test.ts</automated>
  </verify>
  <done>
    generateOperationId() returns a real UUID when crypto.randomUUID exists (existing tests green) and a UUID-format unique fallback when it is undefined (new test green); createEnvelope does not throw in the stubbed insecure context (new test green); all 4 existing RuntimeEnvelope tests still pass. entrypoints/content.core.ts is untouched.
  </done>
</task>

<task type="auto">
  <name>Task 3: Tie per-tab index removal to actual cache invalidation on SPA_NAVIGATION (WR-02)</name>
  <read_first>
    - src/core/extraction/PageContentService.ts:110-131 — registerSpaNavigationHandler: unconditional removeTab followed by conditional invalidateIfChanged
    - tests/core/extraction/PageContentService.test.ts:363-404 — the two existing SPA_NAVIGATION tests (different-URL invalidates / same-URL keeps hot)
    - src/core/extraction/PageIndexBuilder.ts:122-157 — selectRelevant(tabId, query, budget) — the observable probe for index survival; singleton export pageIndexBuilder (line 304)
    - .planning/phases/04a-page-content-extraction/04a-REVIEW.md — WR-02 (lines 119-139): same-URL events destroy the index while the cache stays hot, leaving index-less cache hits (D-14 contract broken)
  </read_first>
  <files>src/core/extraction/PageContentService.ts, tests/core/extraction/PageContentService.test.ts</files>
  <action>
    Fix the index/cache divergence (04a-REVIEW.md WR-02): the SPA_NAVIGATION handler currently calls pageIndexBuilder.removeTab(tabId) unconditionally, then invalidates the cache only when the URL differs — a same-URL event (panel extracted the post-navigation URL before the message arrived) leaves a hot cache entry with no searchable index.

    In src/core/extraction/PageContentService.ts registerSpaNavigationHandler (lines 118-131):
    1. Call this.pageContentCache.invalidateIfChanged(tabId, envelope.payload.url) FIRST and capture its boolean return.
    2. Call pageIndexBuilder.removeTab(tabId) ONLY when that return is true.
    3. Rewrite the comment block: changed-URL events invalidate the cache and THEN remove the index (Pitfall 5 order preserved — old chunks gone before the next extraction builds new ones); same-URL events keep BOTH the cache entries and the per-tab index, so cache hits always have their index (D-14 contract holds).

    Do NOT change tabs.onRemoved (unconditional index + cache removal) or reExtract() — both are already consistent.

    Add a regression test to tests/core/extraction/PageContentService.test.ts named 'keeps the per-tab MiniSearch index when SPA_NAVIGATION announces the same URL (WR-02)':
    1. Import pageIndexBuilder from '../../../src/core/extraction/PageIndexBuilder' at the top of the file.
    2. sendMessageMock resolves makeSerializedPage(); service = new PageContentService(); service.init().
    3. extract(1, 'default', 'https://example.com/article'); assert pageIndexBuilder.selectRelevant(1, 'Extraction Tracer Fixture', 100).length > 0 (index populated).
    4. dispatch the same-URL SPA_NAVIGATION envelope exactly as the existing 'keeps the cache hot' test does (line 392-399 pattern).
    5. Assert pageIndexBuilder.selectRelevant(1, 'Extraction Tracer Fixture', 100).length is STILL > 0 (index survived — pre-fix this is 0 because removeTab ran unconditionally) and sendMessageMock is still called 1× (cache hot).

    The two existing SPA tests need no edits and must stay green: different-URL → invalidateIfChanged true → removeTab runs → re-extraction (sendMessageMock 2×); same-URL → invalidateIfChanged false → no removeTab, cache hot (sendMessageMock 1×).
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/core/extraction/PageContentService.test.ts</automated>
  </verify>
  <done>
    The WR-02 index-survival test passes (selectRelevant returns chunks after a same-URL SPA_NAVIGATION event, sendMessageMock 1×); both pre-existing SPA tests pass (different-URL still invalidates cache + index, same-URL still keeps the cache hot); all other PageContentService tests green.
  </done>
</task>

<task type="auto">
  <name>Task 4: Tighten PASSWORD_NAME_PATTERN false positives via a documented allowlist, keeping D-02 coverage (WR-03)</name>
  <read_first>
    - src/core/content/DomSerializer.ts:16 — current contains-match PASSWORD_NAME_PATTERN; lines 67-93 — the two name-heuristic redaction sites
    - tests/core/content/DomSerializer.test.ts:41-50 — existing name-heuristic test (user_pwd redacted, username retained)
    - tests/core/content/PageContextBridge.test.ts — the two other name-heuristic tests (user_passwd, db_pwd) that must stay green
    - .planning/phases/04a-page-content-extraction/04a-REVIEW.md — WR-03 (lines 141-156): passenger/passport/compass/bypass/passage/passcode false positives
    - .planning/phases/04a-page-content-extraction/04a-RESEARCH.md — Pitfall 4: err on false positives (omitting a value is safer than capturing a password)
  </read_first>
  <files>src/core/content/DomSerializer.ts, tests/core/content/DomSerializer.test.ts</files>
  <action>
    Fix the over-redaction regression (04a-REVIEW.md WR-03): the 04a-05 contains-match `/pass(word|wd)?|pwd/i` strips values from legitimate fields like passenger_first_name, passport_number, compass_bearing, bypass_code, passage_id. Keep contains-match semantics (required by the 04a-05 tests for user_passwd/db_pwd and by the D-02 err-on-false-positive policy) but exclude the documented innocuous substrings.

    In src/core/content/DomSerializer.ts:
    1. Keep `const PASSWORD_NAME_PATTERN = /pass(word|wd)?|pwd/i;` unchanged (D-02 coverage: user_pwd, user_passwd, db_pwd, login_password, confirmPassword, user_pass, passphrase, passcode all still match).
    2. Add next to it: `const NON_PASSWORD_NAME_PATTERN = /passenger|passport|passage|compass|bypass/i;` with a comment listing the field classes each term protects (travel/airline forms, bearings, auth-bypass flows) and citing WR-03.
    3. Add an exported helper `export function isPasswordFieldName(name: string): boolean { return PASSWORD_NAME_PATTERN.test(name) && !NON_PASSWORD_NAME_PATTERN.test(name); }`. Export it so ApcLiteStrategy (Task 5) reuses the identical heuristic — the WR-04 fix in 04a-REVIEW.md requires exporting the pattern; the helper is the single export point and DomSerializer stays content-script-safe (pure module, no imports).
    4. Replace BOTH name-heuristic usages with isPasswordFieldName: the nameMatchedInputs filter (lines 68-71) and the clone-redaction loop (lines 87-92). No other code changes.
    5. Documented D-02 decision (put it in the helper's comment): 'passcode' is deliberately NOT in the allowlist — passcode fields hold PIN-like secrets and D-02 err-on-false-positive (RESEARCH Pitfall 4) says omit rather than capture. This narrows the review's suggested allowlist (which included passage/passcode): passage excluded (ticket/travel fields), passcode kept redacted (privacy).

    Tests in tests/core/content/DomSerializer.test.ts:
    1. New test 'does not redact values for passenger/passport/compass/bypass field names (WR-03)': fixture inputs name=passenger_first_name value=JaneDoe, name=passport_number value=AB1234567, name=compass_bearing value=42, name=bypass_code value=open, PLUS name=user_pwd value=SecretPass — assert the serialized html contains all four FP values AND does not contain SecretPass (proves the clone-redact path no longer over-redacts while real passwords stay redacted).
    2. New test 'still redacts passcode-named values (D-02 err on false positives)': fixture input name=passcode value=123456 — assert html does not contain 123456.
    3. The 3 existing name-heuristic tests (DomSerializer user_pwd, PageContextBridge user_passwd and db_pwd) require no edits — none of those names matches the allowlist — and must stay green.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/core/content/DomSerializer.test.ts tests/core/content/PageContextBridge.test.ts</automated>
  </verify>
  <done>
    passenger/passport/compass/bypass/passage field values are retained in serialized HTML (new FP test green); passcode values stay redacted (new test green); user_pwd/user_passwd/db_pwd redaction tests stay green; DomSerializer exports isPasswordFieldName for Task 5.
  </done>
</task>

<task type="auto">
  <name>Task 5: Exclude type=hidden inputs and mirror the DomSerializer value guard in ApcLiteStrategy (WR-04)</name>
  <read_first>
    - src/core/extraction/strategies/ApcLiteStrategy.ts:129-147 — isHidden/inputRole; 225-256 — attributesOf value case (guards type=password only); 305-322 — collectChildren skip condition
    - src/core/content/DomSerializer.ts — the exported isPasswordFieldName from Task 4 (this task's import target)
    - tests/core/extraction/ApcLiteStrategy.test.ts:14-41 — FIXTURE_HTML (has type=password with value, textbox, checkbox, select, textarea); 158-174 — existing D-02 test the changes must keep green
    - .planning/phases/04a-page-content-extraction/04a-REVIEW.md — WR-04 (lines 158-190): hidden inputs become editable textbox nodes capturing CSRF tokens; value guard narrower than the serializer's; importing from DomSerializer is safe (strategy does not run in the content-script bundle, D-20 unaffected)
  </read_first>
  <files>src/core/extraction/strategies/ApcLiteStrategy.ts, tests/core/extraction/ApcLiteStrategy.test.ts</files>
  <action>
    Fix the two D-02 guard gaps at the strategy boundary (04a-REVIEW.md WR-04): hidden inputs currently fall through inputRole's default to 'textbox', become editable+focusable nodes, and their value attributes flow into the APCLite tree; and the value guard checks only type=password while DomSerializer also redacts by name heuristic, autocomplete, and isPassword.

    In src/core/extraction/strategies/ApcLiteStrategy.ts:
    1. Add at the top: `import { isPasswordFieldName } from '../../content/DomSerializer';` — safe: DomSerializer is a pure content-script-safe module with no imports, and ApcLiteStrategy parses in the extension-page context (D-05), so the D-20 content-bundle isolation contract is unaffected.
    2. Add a helper `function isHiddenInput(el: Element): boolean` returning true when tagName is INPUT and (type attribute || 'text').toLowerCase() === 'hidden'.
    3. In collectChildren (line 316): hoist `const tag = child.tagName.toLowerCase();` and extend the skip condition to `SKIP_TAGS.has(tag) || isHidden(child) || isHiddenInput(child)` — hidden inputs never become nodes. This is the authoritative gate (it also covers the tabindex edge that isInteractive would otherwise catch).
    4. In inputRole (line 133): add `case 'hidden': return null;` — defense in depth: computeRole yields null, so a hidden input reaching buildNode by any other path is dropped by the role-null branch.
    5. In attributesOf, the 'value' case (lines 246-252): skip (break) when the element is an input AND any of: type is password, type is hidden, isPasswordFieldName(name) with name = el.getAttribute('name') || '', autocomplete attribute === 'current-password', or hasAttribute('isPassword'). Keep the existing type=password branch behavior and keep capturing value for non-input elements (e.g. option) and for ordinary text inputs.

    Tests in tests/core/extraction/ApcLiteStrategy.test.ts:
    1. New test 'excludes type=hidden inputs from the tree and never captures their values (WR-04)': html with a form containing type=hidden name=csrf_token value=csrf-token-secret-42, a second type=hidden with tabindex="0" and value=sess-token-abc, and a visible type=text name=query value=hello. Assert JSON.stringify(result.root) does not contain 'csrf-token-secret-42', 'sess-token-abc', or 'csrf_token', and DOES contain 'hello' (visible textbox still captured).
    2. New test 'applies name-heuristic, autocomplete and isPassword guards to input values at the strategy boundary (WR-04)': inputs name=pwd value=pwd-leak-secret, name=login_password value=login-leak-secret, autocomplete=current-password value=auto-leak-secret, isPassword value=ispass-leak-secret, and name=passenger_first_name value=alice. Assert the tree JSON contains 'alice' but none of the four leak strings.
    3. Existing tests stay green without edits: 'never captures password input values (D-02)' (type=password), the walk/geometry/ARIA tests (FIXTURE_HTML has no hidden inputs and no value attributes on textboxes), and the service-level actionable extraction test.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/core/extraction/ApcLiteStrategy.test.ts</automated>
  </verify>
  <done>
    Hidden inputs (including with tabindex) produce no APCLiteNode and their values never appear in the tree JSON (new tests green); name-heuristic/autocomplete/isPassword input values are skipped at the strategy boundary while innocent textbox values are retained; all 10 existing ApcLiteStrategy tests plus the service-level actionable test pass.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Host page DOM → content script | Untrusted page markup and input values flow into DomSerializer serialization (D-02 redaction boundary) |
| Content script → extension page | SerializedPage crosses chrome.runtime.sendMessage into PageContentService |
| Extension page → AI pipeline | PageContext (mode: default\|actionable) feeds ContextOptimizer; APCLite tree is the v2 automation substrate |
| PageContentCache (in-memory) | Mode-scoped entries; a wrong-mode PageContext served silently is an integrity break in the pipeline |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-04a-06-01 | Tampering | PageContentCache mode-blind key (CR-01) | high | mitigate | Task 1: composite key `${tabId}:${mode}:${url}` for get/set, prefix-scoped invalidate/invalidateIfChanged, mode pass-through in PageContentService.extract, and a cross-mode regression test — a wrong-mode PageContext can no longer satisfy a different-mode request |
| T-04a-06-02 | Information Disclosure | DomSerializer name-heuristic allowlist (WR-03) | high | mitigate | Task 4: contains-match retained; only the 5 documented innocuous substrings excluded via NON_PASSWORD_NAME_PATTERN inside exported isPasswordFieldName; 'passcode' deliberately kept redacted (D-02 err-on-false-positive); FP tests assert passenger/passport/compass/bypass values retained while secret-bearing names stay redacted |
| T-04a-06-03 | Information Disclosure | ApcLiteStrategy hidden inputs + value guard (WR-04) | high | mitigate | Task 5: walker-level type=hidden skip (authoritative, covers tabindex), inputRole null case, and a value guard mirroring DomSerializer via the shared isPasswordFieldName plus autocomplete/isPassword checks — CSRF/session tokens never enter the APCLite tree; negative tests assert absence |
| T-04a-06-04 | Denial of Service | createEnvelope on http:// origins (WR-01) | medium | mitigate | Task 2: generateOperationId guards crypto.randomUUID availability and falls back to a UUID-v4-shaped Math.random id; createEnvelope routed through it — envelope construction cannot throw on insecure origins, so SPA_NAVIGATION signal loss / lastUrl wedge cannot occur; fallback test stubs crypto.randomUUID undefined |
| T-04a-06-05 | Denial of Service | SPA_NAVIGATION same-URL index/cache divergence (WR-02) | medium | mitigate | Task 3: removeTab runs only when invalidateIfChanged returns true; index-survival test asserts selectRelevant still returns chunks after a same-URL event while the different-URL path still invalidates both |
| T-04a-06-SC | Tampering | npm/pip/cargo installs | low | accept | No new dependencies in this plan; all packages were installed and audited in Plan 04a-01 (defuddle v0.19.2, @mozilla/readability v0.6.0, minisearch v7.2.0 — all [OK]) |
</threat_model>

<verification>
Run the full phase verification after all five tasks complete:

```bash
pnpm run verify:phase-4a
```

Expected: vitest portion exits 0 — all suites under tests/core/extraction, tests/core/content, and tests/isolation/no-content-script-ui.test.ts pass (86/86 current, plus the new tests added by this plan). The tsc --noEmit prefix still reports the 9 pre-existing src/core/storage errors (documented out of scope, deferred-items.md #1) — this plan must introduce NO new tsc errors; the two new runtime changes (OperationId.ts, RuntimeEnvelope.ts) and the DomSerializer export must compile cleanly.

Note: tests/core/runtime/*.test.ts is outside the phase gate's vitest path, so the Task 2 per-task verify command is the authoritative check for the WR-01 fallback tests.

Per-task gates (each task runs its own verify before the full gate):
- Task 1/3: pnpm exec vitest run tests/core/extraction/PageContentService.test.ts
- Task 2: pnpm exec vitest run tests/core/runtime/OperationId.test.ts tests/core/runtime/RuntimeEnvelope.test.ts
- Task 4: pnpm exec vitest run tests/core/content/DomSerializer.test.ts tests/core/content/PageContextBridge.test.ts
- Task 5: pnpm exec vitest run tests/core/extraction/ApcLiteStrategy.test.ts
</verification>

<success_criteria>
1. CR-01 closed: cross-mode test proves extract(1,'actionable',url) after extract(1,'default',url) is a fresh extraction (sendMessageMock 2×) and both mode-specific entries are reused on repeat calls (stays 2×)
2. WR-01 closed: with crypto.randomUUID stubbed undefined, generateOperationId returns a UUID-format unique string and createEnvelope does not throw; all existing OperationId/RuntimeEnvelope tests stay green
3. WR-02 closed: same-URL SPA_NAVIGATION index-survival test passes (selectRelevant > 0 after the event, sendMessageMock 1×); different-URL test still passes (sendMessageMock 2×)
4. WR-03 closed: passenger/passport/compass/bypass/passage values retained in serialized HTML; user_pwd/user_passwd/db_pwd/login_password/confirmPassword/passcode values still redacted; the 3 existing name-heuristic tests stay green
5. WR-04 closed: type=hidden inputs (incl. tabindex) absent from the APCLite tree with values never in the JSON; name-heuristic/autocomplete/isPassword values skipped at the strategy boundary; all 10 existing ApcLiteStrategy tests stay green
6. pnpm run verify:phase-4a vitest portion exits 0 with no new tsc errors beyond the 9 pre-existing src/core/storage ones
7. Scope discipline: entrypoints/ (including content.core.ts) and tests/isolation/ are untouched — verified by git status showing no changes in those paths
</success_criteria>

<output>
Create `.planning/phases/04a-page-content-extraction/04a-06-SUMMARY.md` when done
</output>
