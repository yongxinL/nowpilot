---
phase: 04a-page-content-extraction
plan: 05
type: execute
wave: 4
depends_on:
  - 04a-01
  - 04a-02
  - 04a-03
  - 04a-04
files_modified:
  - src/core/content/DomSerializer.ts
  - tests/core/extraction/PageContentService.test.ts
  - tests/isolation/no-content-script-ui.test.ts
  - entrypoints/sidepanel/main.tsx
autonomous: true
gap_closure: true
requirements:
  - PAGE-01

must_haves:
  truths:
    - "Gap-1-SPA: SPA_NAVIGATION invalidation test passes ('invalidates the cache when SPA_NAVIGATION announces a different URL' — sendMessage called 2× after init())"
    - "Gap-1-SPA: SPA_NAVIGATION same-URL test is non-vacuous ('keeps the cache hot when SPA_NAVIGATION announces the same URL' — with handler registered via init())"
    - "Gap-1-bv: tabs.onRemoved listener destroys per-tab MiniSearch index and invalidates cache — tested by firing the listener callback"
    - "Gap-1-wiring: pageContentService.init() is called from entrypoints/sidepanel/main.tsx at startup (tabs.onUpdated, tabs.onRemoved, SPA_NAVIGATION handler registered)"
    - "Gap-2-pwd: Name-heuristic password redaction covers compound/suffix forms: user_pwd, user_passwd, db_pwd values omitted from SerializedPage.html"
    - "Gap-3-iso: Isolation bundle-size test (Test 2) and banned-string test (Test 3) target .output/chrome-mv3/content.js (not content-scripts/) — assertions run for real"
    - "Gap-3-verify: pnpm run verify:phase-4a exits 0 — all vitest tests pass (0 failures)"
  artifacts:
    - "src/core/content/DomSerializer.ts:16 — PASSWORD_NAME_PATTERN restored to contains-match regex"
    - "tests/core/extraction/PageContentService.test.ts — SPA tests call service.init(); onRemoved test added"
    - "tests/isolation/no-content-script-ui.test.ts — Tests 2+3 target .output/chrome-mv3/content.js"
    - "entrypoints/sidepanel/main.tsx — pageContentService.init() called before React render"
  key_links:
    - "DomSerializer PASSWORD_NAME_PATTERN → D-02 privacy contract restored (Gap 2 root cause: WR-04 narrowing)"
    - "PageContentService.init() → MessageBus.register(SPA_NAVIGATION, handler) (Gap 1 root cause: WR-02 registration move)"
    - "sidepanel/main.tsx → pageContentService.init() → tabs.onUpdated + tabs.onRemoved + SPA_NAVIGATION listeners active (Gap 1 root cause: no production init() call)"
    - "tests/isolation/no-content-script-ui.test.ts → .output/chrome-mv3/content.js (Gap 3 root cause: wrong WXT output path)"
---

<objective>
Close the 4 verification gaps identified in 04a-VERIFICATION.md (score 25/30) by fixing three root causes:

1. **Gap 1 (truth 22):** SPA-nav cache invalidation regression — restore test coverage + wire init() into production entrypoint.
2. **Gap 2 (truth 27):** Password name-heuristic regression — restore the D-02 contains-match regex contract.
3. **Gap 3 (truths 25+28):** Verification gate red + enforcement not operational — fix isolation test path + confirm all 4 test failures resolved.

This plan also closes the 1 behavior-unverified item (tab-close index destruction) by adding an explicit tabs.onRemoved listener test.

Purpose: Return the phase verification gate to green (`pnpm run verify:phase-4a` exits 0, all 85 vitest tests passing) and restore the operational SPA-cache-invalidation and password-redaction contracts.
Output: 4 files modified; all 4 failing tests become passing; isolation Test 2+3 assertions actually run; side panel calls pageContentService.init().
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04a-page-content-extraction/04a-VERIFICATION.md
@.planning/phases/04a-page-content-extraction/04a-CONTEXT.md
@.planning/phases/04a-page-content-extraction/04a-RESEARCH.md
@.planning/phases/04a-page-content-extraction/04a-01-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restore PASSWORD_NAME_PATTERN to contains-match regex (Gap 2)</name>
  <read_first>
    - src/core/content/DomSerializer.ts:16 — current PASSWORD_NAME_PATTERN to replace (exact-match list)
    - .planning/phases/04a-page-content-extraction/04a-CONTEXT.md — D-02 privacy contract (err on false positives)
    - .planning/phases/04a-page-content-extraction/04a-RESEARCH.md — Pitfall 4: password field false negatives policy
  </read_first>
  <files>src/core/content/DomSerializer.ts</files>
  <action>
    Fix the password name-heuristic regression caused by WR-04 (commit 7f1fb50).

    In src/core/content/DomSerializer.ts line 16, replace the current exact-match list:

    ```
    const PASSWORD_NAME_PATTERN = /^(?:password|passwd|pwd|user_pass|login_password|userPassword|currentPassword|newPassword|confirmPassword|secret|passphrase)$/i;
    ```

    with a contains-match regex that covers suffix/compound password names per the D-02 heuristic contract:

    ```
    const PASSWORD_NAME_PATTERN = /pass(word|wd)?|pwd/i;
    ```

    This regex matches `password`, `passwd`, `pwd`, and any field name containing these tokens (e.g., `user_pwd`, `user_passwd`, `db_pwd`, `user_pass`, `login_password`, `confirmPassword`, `passphrase`). The `/i` flag handles case-insensitive matching. Err-on-false-positive is the stated D-02 policy (RESEARCH.md Pitfall 4: omitting a value is safer than capturing a password).

    Do NOT change any other code in DomSerializer.ts. The selector-based redaction (input[type=password], [isPassword], autocomplete=current-password) is already correct — only the name-heuristic pattern is affected.

    This single-line change automatically fixes the 3 failing tests:
    - tests/core/content/DomSerializer.test.ts: 'omits values for inputs matching the password name heuristic' (fixture name=user_pwd)
    - tests/core/content/PageContextBridge.test.ts: 'omits values for inputs matching the password name heuristic' (fixture name=user_passwd)
    - tests/core/content/PageContextBridge.test.ts: 'omits values for inputs with name containing "pwd"' (fixture name=db_pwd)
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/core/content/DomSerializer.test.ts tests/core/content/PageContextBridge.test.ts</automated>
  </verify>
  <done>
    All DomSerializer and PageContextBridge tests pass (15/15). The name-heuristic tests for user_pwd, user_passwd, and db_pwd pass — these previously-leaked values are now redacted.
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix SPA-nav cache invalidation test regression + add tabs.onRemoved test (Gap 1 + behavior-unverified)</name>
  <read_first>
    - tests/core/extraction/PageContentService.test.ts — existing test structure, beforeEach mocks (line 53), tabs.onUpdated test pattern (lines 404-418)
    - src/core/extraction/PageContentService.ts:56-74 — init() method + idempotent guard
  </read_first>
  <files>tests/core/extraction/PageContentService.test.ts</files>
  <action>
    Fix the SPA_NAVIGATION cache-invalidation test regression (WR-02, commit 2eb883d) and cover the tabs.onRemoved behavior-unverified item.

    **Fix 1 — SPA invalidation test (line ~363-381):**
    In the test 'invalidates the cache when SPA_NAVIGATION announces a different URL', add `service.init()` immediately after `const service = new PageContentService();` (before the first `extract` call). This registers the SPA_NAVIGATION handler so the dispatch at line 370 actually triggers the handler. The test expects `sendMessageMock` to be called 2× (initial extract + cache-miss re-extraction); without init(), dispatch no-ops and sendMessage stays at 1×.

    **Fix 2 — SPA same-URL test (line ~383-402):**
    In the test 'keeps the cache hot when SPA_NAVIGATION announces the same URL', add `service.init()` immediately after `const service = new PageContentService();`. This makes the test non-vacuous — with the handler registered, the same-URL dispatch fires `invalidateIfChanged`, which correctly keeps the cache hot for matching URLs. Without init(), the handler never registered and dispatch no-oped (the test passed vacuously).

    **New test — tabs.onRemoved listener (behavior-unverified):**
    Add a new test named 'removes tab index and invalidates cache when tabs.onRemoved fires' in the 'PageContentService (hardening)' describe block. This test:
    1. Creates a PageContentService, calls `service.init()`.
    2. Captures the `tabs.onRemoved.addListener` mock (same pattern as the existing tabs.onUpdated tests — see lines 406-408).
    3. Extracts content for tabId=1 (populates cache + MiniSearch index).
    4. Fires the onRemoved listener callback with tabId=1.
    5. Extracts again for tabId=1 — expects `sendMessageMock` to have been called 2× (cache miss → fresh extraction, proving the old cache entry was invalidated).

    Use the same mock setup as in the tabs.onUpdated tests: `(globalThis as any).chrome.tabs.onRemoved.addListener` is already mocked in `beforeEach` (line 53). The test casts it the same way: `const addListenerMock = (globalThis as any).chrome.tabs.onRemoved.addListener as ReturnType<typeof vi.fn>;`.

    Reference the existing tabs.onUpdated invalidation test (line 404-418) for the pattern — extract → get listener → fire listener → extract again → expect sendMessage 2×.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/core/extraction/PageContentService.test.ts</automated>
  </verify>
  <done>
    All PageContentService tests pass (25/25):
    - 'invalidates the cache when SPA_NAVIGATION announces a different URL' passes — sendMessage called 2× after init().
    - 'keeps the cache hot when SPA_NAVIGATION announces the same URL' passes non-vacuously — handler registered, same URL stays cached.
    - 'removes tab index and invalidates cache when tabs.onRemoved fires' passes — onRemoved callback triggers removeTab + invalidate, proven by cache-miss re-extraction.
  </done>
</task>

<task type="auto">
  <name>Task 3: Fix isolation test output path + wire pageContentService.init() into side panel entrypoint (Gap 1 + Gap 3)</name>
  <read_first>
    - tests/isolation/no-content-script-ui.test.ts — current path references to fix
    - tests/isolation/cross-entrypoint-imports.test.ts — WXT output path pattern reference
    - entrypoints/sidepanel/main.tsx — current structure for init() insertion point
    - src/core/extraction/PageContentService.ts:57 — init() idempotent guard
  </read_first>
  <files>tests/isolation/no-content-script-ui.test.ts, entrypoints/sidepanel/main.tsx</files>
  <action>
    **Fix A — Isolation test output path (Gap 3, tests/isolation/no-content-script-ui.test.ts):**

    WXT emits the content script bundle at `.output/chrome-mv3/content.js` (single file), not `.output/chrome-mv3/content-scripts/` (directory). Tests 2 and 3 currently target the non-existent directory and silently skip (print warning, pass without checking).

    For Test 2 (bundle size <50KB, line ~64-89) and Test 3 (no banned strings, line ~91-125):

    1. Replace the directory path `path.resolve('.output/chrome-mv3/content-scripts')` with `path.resolve('.output/chrome-mv3')` in both tests.
    2. Replace the multi-file iteration (readdir + filter + for-loop) with a single-file check: verify `content.js` exists via `fs.existsSync(path.join(outputDir, 'content.js'))`, then operate on that file directly.
    3. In Test 2: `const filePath = path.join(outputDir, 'content.js'); const size = fs.statSync(filePath).size; expect(size).toBeLessThan(50 * 1024);` — remove the for-loop.
    4. In Test 3: read `content.js` content directly, check for banned strings. Remove the for-loop.
    5. Update the skip/not-found messages: "No build output at .output/chrome-mv3/content.js — run `pnpm run build` first."

    Do NOT change Tests 1 (banned imports in source) or 4 (DomSerializer read-only DOM) — those are correct and passing.

    **Fix B — Wire pageContentService.init() to side panel entrypoint (Gap 1, entrypoints/sidepanel/main.tsx):**

    Add a top-level import and init() call in entrypoints/sidepanel/main.tsx, BEFORE the React render. Place it after the existing CSS import and before the `SidepanelApp` component definition:

    ```typescript
    import { pageContentService } from '../../src/core/extraction/PageContentService';
    ```

    Then add the init() call at module scope before the component:

    ```typescript
    // Initialize page content service listeners (SPA_NAVIGATION, tabs.onUpdated, tabs.onRemoved)
    // for per-tab cache invalidation and MiniSearch index lifecycle. Safe to call multiple
    // times — subsequent calls are no-ops (init() has idempotent guard).
    pageContentService.init();
    ```

    This call is safe: init() has `if (this._initialized) return;` (line 57 of PageContentService.ts), and SPA_NAVIGATION registration has a static idempotent guard (line 120).

    Place the `pageContentService.init()` call in the module scope (top-level, outside any React component), after all imports and before `const SidepanelApp = ...`. This ensures listeners are registered before any user interaction.
  </action>
  <verify>
    <automated>pnpm exec vitest run tests/isolation/no-content-script-ui.test.ts</automated>
  </verify>
  <done>
    - Isolation Test 2 (bundle size) actually reads .output/chrome-mv3/content.js and asserts size <50KB (no longer silently skips).
    - Isolation Test 3 (banned strings) actually reads .output/chrome-mv3/content.js and asserts no banned package names (no longer silently skips).
    - Isolation Tests 1 and 4 continue to pass as before.
    - entrypoints/sidepanel/main.tsx imports and calls pageContentService.init() at module scope before React render.
    - TypeScript compiles cleanly for main.tsx (tsc --noEmit on entrypoints/sidepanel/ passes).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Host page DOM → content script | Untrusted page content flows into DomSerializer for HTML serialization |
| Content script → Extension page | Serialized HTML crosses the chrome.runtime.sendMessage boundary |
| Extension page → AI pipeline | Extracted/redacted markdown feeds ContextOptimizerInput.pageContext |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-04a-05-01 | Information Disclosure | DomSerializer PASSWORD_NAME_PATTERN | high | mitigate | This plan restores the contains-match regex `/pass(word\|wd)?\|pwd/i` (D-02 original contract) so that compound/suffix password names (user_pwd, user_passwd, db_pwd) are redacted at capture time. The three selector-based mechanisms (input[type=password], [isPassword], autocomplete=current-password) were never broken — only the name-heuristic defense-in-depth layer was narrowed by WR-04. |
| T-04a-05-02 | Tampering | sidepanel/main.tsx init() wiring | low | accept | Adding `pageContentService.init()` at module scope in the side panel entrypoint registers SPA_NAVIGATION + tabs.onUpdated/onRemoved listeners. The init() call is additive and idempotent; removing or duplicating it has no side effect. The service worker is never a parsing context per D-05 — extraction is always user-initiated from an extension page. |
| T-04a-05-SC | Tampering | npm/pip/cargo installs | low | accept | No new dependencies added in this gap-closure plan. All packages were already installed and audited in Plan 04a-01 (defuddle v0.19.2, @mozilla/readability v0.6.0, minisearch v7.2.0 — all [OK] with no postinstall scripts). |
</threat_model>

<verification>
Run the full phase verification after all three tasks complete:

```bash
pnpm run verify:phase-4a
```

Expected: exits 0. All vitest suites pass: `tests/core/extraction`, `tests/core/content`, `tests/isolation/no-content-script-ui.test.ts` (all assertions run for real).

The tsc portion may still report pre-existing src/core/storage errors (9 — documented, out of phase scope per VERIFICATION.md line 36). These are not part of the gap closure.
</verification>

<success_criteria>
1. `pnpm run verify:phase-4a` exits 0 (vitest: all tests passing)
2. SPA_NAVIGATION invalidation test passes with `service.init()` before dispatch
3. Same-URL SPA test is non-vacuous (handler registered, cache stays hot)
4. tabs.onRemoved test verifies index cleanup on tab close (behavior-unverified resolved)
5. Name-heuristic password redaction covers user_pwd, user_passwd, db_pwd (3 previously-failing tests pass)
6. Isolation Test 2 reads content.js and asserts <50KB (no silent skip)
7. Isolation Test 3 reads content.js and asserts no banned strings (no silent skip)
8. pageContentService.init() called in entrypoints/sidepanel/main.tsx at startup
</success_criteria>

<output>
Create `.planning/phases/04a-page-content-extraction/04a-05-SUMMARY.md` when done
</output>
