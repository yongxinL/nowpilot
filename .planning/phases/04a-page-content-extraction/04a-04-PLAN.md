---
phase: 04a-page-content-extraction
plan: 04
type: execute
wave: 3
depends_on: [04a-02]
files_modified:
  - tests/isolation/no-content-script-ui.test.ts
  - tests/core/content/PageContextBridge.test.ts
  - tests/core/extraction/PageContentService.test.ts
autonomous: true
requirements: [PAGE-01]
must_haves:
  truths:
    - "Content script bundle contains no React, AntD, defuddle, yaml, or File System Access API imports — enforced via isolation test (import-graph grep) that fails on any violation"
    - "Content script bundle is under 50KB after WXT build — enforced via bundle-size assertion in isolation test (D-20, §22.1)"
    - "PageContextBridge EXTRACT_PAGE_CONTENT handler returns SerializedPage synchronously via sendResponse — verified via test that simulates chrome.runtime.onMessage dispatch"
    - "Password field values never appear in SerializedPage.html output for input[type=password], [isPassword], autocomplete=current-password, and name-pattern heuristics — verified via DomSerializer edge-case tests"
    - "pnpm run verify:phase-4a exits 0 and all test suites pass including isolation test, extraction tests, and content tests"
  artifacts:
    - tests/isolation/no-content-script-ui.test.ts
    - tests/core/content/PageContextBridge.test.ts
  key_links:
    - "WXT build → .output/chrome-mv3/content-scripts/*.js → isolation test greps for banned imports → bundle size check"
    - "vitest → jsdom → DomSerializer.serializePage() → password field assertions → SerializedPage.html verification"
    - "pnpm run verify:phase-4a → tsc --noEmit && vitest run tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts"
---

<objective>
Verification and isolation enforcement — content script bundle isolation test (<50KB, no banned imports), PageContextBridge messaging contract test, and comprehensive validation that the phase passes `pnpm run verify:phase-4a`.

Purpose: The extraction pipeline is implemented (Plans 01–03). This plan enforces the hard constraints that keep the content script extraction-only (D-20: no React/AntD/defuddle/yaml/FS Access, <50KB) and validates cross-context messaging contracts end-to-end.

Output: Isolation test proving content bundle purity; PageContextBridge test proving EXTRACT_PAGE_CONTENT handler correctness; green `pnpm run verify:phase-4a`.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/04a-page-content-extraction/04a-CONTEXT.md (D-20 bundle cap enforcement)
@.planning/phases/04a-page-content-extraction/04a-RESEARCH.md (lines 532–539: Pitfall 2: content script bundle size creep; lines 658–682: isolation test pattern)
@.planning/phases/04a-page-content-extraction/04a-PATTERNS.md (lines 660–682: no-content-script-ui.test.ts analog; lines 685–711: PageContextBridge test analog)
@.planning/phases/04a-page-content-extraction/04a-UI-SPEC.md (lines 14–23: §5.6 negative contracts; lines 40–41: content-bundle boundary)
@tests/isolation/cross-entrypoint-imports.test.ts (exact analog for isolation test structure)
@src/core/content/DomSerializer.ts (from Plan 04a-01 — serializePage function)
@src/core/content/PageContextBridge.ts (from Plan 04a-01 — EXTRACT_PAGE_CONTENT handler)
@src/core/messaging/MessageBus.ts (register, init patterns for test simulation)
@src/core/runtime/RuntimeEnvelope.ts (createEnvelope for test envelope generation)
@entrypoints/content.core.ts (from Plan 04a-01 — handler registration to verify)
@package.json (verify:phase-4a script already exists: tsc --noEmit && vitest run tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Content Script Bundle Isolation Test — no banned imports + <50KB assertion</name>
  <files>
    tests/isolation/no-content-script-ui.test.ts
  </files>
  <action>
    **Create isolation test** in `tests/isolation/no-content-script-ui.test.ts` (per D-20; exact analog: `tests/isolation/cross-entrypoint-imports.test.ts`):

    Structure the test following the existing isolation test pattern exactly:
    - Import `describe`, `it`, `expect` from `vitest`
    - Import `execSync` from `child_process` (for grep)
    - Import `fs` from `fs` (for bundle size check)

    **Test 1: No banned imports in content-core source files**
    - Grep `src/core/content/` for banned imports: `defuddle`, `@mozilla/readability`, `react`, `antd`, `yaml`, `File System Access API` patterns
    - Banned pattern list: `from ['\"]defuddle['\"]`, `from ['\"]@mozilla/readability['\"]`, `from ['\"]react['\"]`, `from ['\"]antd['\"]`, `from ['\"]yaml['\"]`, `showDirectoryPicker|showOpenFilePicker|showSaveFilePicker|FileSystemFileHandle|FileSystemDirectoryHandle`
    - Also grep `entrypoints/content.core.ts` for same patterns
    - Command: `grep -rn -E "${patterns}" src/core/content/ entrypoints/content.core.ts 2>/dev/null || true`
    - Filter out comment lines (lines starting with `//` or `/*`) and test files
    - Assert result is empty (no matches) — any match is a test failure
    - Include helpful error message listing the violating files+lines if assertion fails

    **Test 2: Content bundle size < 50KB**
    - Find the built content script bundle: glob `.output/chrome-mv3/content-scripts/*.js` (WXT outputs content scripts here)
    - Use `fs.statSync(file).size` to get byte size
    - Assert `size < 50 * 1024` (50KB)
    - If no built output exists: skip with a warning message ("Run `pnpm run build` first to verify bundle size") — don't fail, since CI might not have the build step
    - Alternative: check WXT's build manifest for expected bundle entry (more robust)

    **Test 3: No banned package names in built content bundle** (defense-in-depth)
    - If build output exists: grep the built `.js` file for banned package strings
    - Patterns: `defuddle`, `readability`, `react`, `antd`, `yaml`
    - These strings should not appear in the content script bundle even as string literals
    - Assert no matches

    **Test 4: Runtime check — DomSerializer has no banned API usage** (source-level attestation)
    - Read `src/core/content/DomSerializer.ts` source
    - Assert it does NOT contain: `document.createElement`, `Element.prototype.appendChild`, `innerHTML =`, `insertAdjacentHTML`, `style.` setters (these would indicate host-page mutation — violates §5.6)
    - Assert it DOES contain: `querySelectorAll`, `documentElement.outerHTML`, `instanceof HTMLInputElement` (read-only DOM access)

    Follow the cross-entrypoint-imports.test.ts pattern for `execSync` usage, comment filtering, and assertion messages exactly.
  </action>
  <read_first>
    - tests/isolation/cross-entrypoint-imports.test.ts — exact pattern to replicate: execSync grep, comment filter, split+filter, toHaveLength(0)
    - src/core/content/DomSerializer.ts (from Plan 04a-01) — verify read-only DOM access pattern
    - entrypoints/content.core.ts (from Plan 04a-01) — verify imports list
  </read_first>
  <verify>
    <automated>pnpm exec vitest run tests/isolation/no-content-script-ui.test.ts</automated>
  </verify>
  <done>
    Test 1: No banned imports (defuddle, readability, react, antd, yaml, FS Access) found in src/core/content/ or entrypoints/content.core.ts.
    Test 2: Built content bundle < 50KB (or graceful skip if not built).
    Test 3: No banned package strings in built content bundle.
    Test 4: DomSerializer uses read-only DOM access only (no host-page mutation APIs).
    Isolation test file follows cross-entrypoint-imports.test.ts pattern exactly.
  </done>
</task>

<task type="auto">
  <name>Task 2: PageContextBridge Contract Test + Phase Verification Green</name>
  <files>
    tests/core/content/PageContextBridge.test.ts,
    tests/core/extraction/PageContentService.test.ts
  </files>
  <action>
    **2a. Create PageContextBridge messaging contract test** in `tests/core/content/PageContextBridge.test.ts` (analog: `tests/core/runtime/RuntimeEnvelope.test.ts` — messaging contract test):

    - Import `describe`, `it`, `expect`, `vi` from `vitest`
    - Import `serializePage` from `../../../src/core/content/DomSerializer`
    - Import `createEnvelope` from `../../../src/core/runtime/RuntimeEnvelope`
    - Use jsdom (`@vitest-environment jsdom` if needed — check vitest.config.ts for default environment)

    Tests:
    - **Handler returns SerializedPage synchronously:** Create jsdom document with fixture HTML → call `serializePage(document)` → verify returned object has shape `{ html, url, title, capturedAt, size, truncated }`
    - **Password field redaction in serialized output:**
      - Fixture: `<form><input type="password" name="pass" value="secret123"></form>`
      - After serializePage: verify `html` does NOT contain `"secret123"` (value must be empty string in the serialized HTML attribute)
      - Fixture: `<input type="text" autocomplete="current-password" name="pwd" value="hidden">`
      - After serializePage: verify `html` does NOT contain `"hidden"` — covered by both autocomplete and name-pattern heuristic
      - Fixture: `<div isPassword="true"><input value="hidden2"></div>` — test `[isPassword]` selector (if DomSerializer targets the attribute on parent, verify; if input-level, document the behavior)
    - **Size cap enforcement:**
      - Create a document with very large content (> 2MB) — or mock outerHTML to return a long string
      - Verify `serialized.truncated === true` and `serialized.html.length <= SIZE_CAP`
    - **Non-password fields preserve values:**
      - Fixture: `<input type="text" name="username" value="john">`
      - After serializePage: verify `html` DOES contain `"john"` (regular fields not touched)
    - **Metadata extracted correctly:**
      - Fixture with `<title>Test Page</title>` — verify `serialized.title === 'Test Page'`
      - Verify `serialized.capturedAt` is a number and within a reasonable range (Date.now() ± 1000ms)
      - Verify `serialized.url` matches jsdom's document.URL

    **2b. Expand PageContentService integration tests** (modify `tests/core/extraction/PageContentService.test.ts`):

    - Add test: full pipeline with real fixture HTML (not just mocked MessageBus) — use jsdom to simulate content script returning SerializedPage
    - Add test: redaction verification after extraction — fixture HTML with inline `api_key=sk-abc` → after extract → markdown does not contain `sk-abc`
    - Add test: mode='actionable' extraction → returns PageContext with apcLiteTree (not markdown)
    - Add test: mode='default' with low-quality Defuddle output → fallback to Readability (mock both strategies)
    - Add test: strategiesAttempted records all attempts including failed ones

    **2c. Verify phase-level test suite:**
    - Run `pnpm run verify:phase-4a` (command: `tsc --noEmit && vitest run tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts`)
    - All tests must pass green
    - If any test fails: fix before marking this task done
  </action>
  <read_first>
    - tests/core/runtime/RuntimeEnvelope.test.ts — messaging contract test pattern
    - tests/core/security/redactSensitive.test.ts — pure function test pattern
    - tests/core/extraction/PageContentService.test.ts (from Plans 04a-01/02) — existing tests to extend
    - src/core/content/DomSerializer.ts (from Plan 04a-01) — SERIALIZE_PAGE implementation details (SIZE_CAP constant, selectors)
  </read_first>
  <verify>
    <automated>pnpm run verify:phase-4a</automated>
  </verify>
  <done>
    PageContextBridge.test.ts: SerializedPage has correct shape; password values omitted for all 3 selector patterns + name heuristic; regular fields preserved; size cap enforced; metadata extracted.
    PageContentService.test.ts: full pipeline tests with fixture HTML; redaction verified; mode='actionable' path tested; fallback chain tested; strategiesAttempted audit trail verified.
    `pnpm run verify:phase-4a` exits 0 with all test suites green:
    - tests/core/extraction/* (DefuddleStrategy, ApcLiteStrategy, ReadabilityFallback, PageIndexBuilder, PageContentService)
    - tests/core/content/* (DomSerializer, PageContextBridge)
    - tests/isolation/no-content-script-ui.test.ts
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| WXT build → Content script bundle | Build tooling determines what lands in the content bundle — isolation test is the enforcement gate |
| Test assertions → Production reality | Isolation tests grep source and build artifacts; if WXT changes bundling behavior, tests may pass while production bundles differ |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-04a-13 | Tampering | WXT build (banned dependency in content bundle) | medium | mitigate | `no-content-script-ui.test.ts` greps built bundle for banned package strings as defense-in-depth; source-level grep on `src/core/content/` catches import creep before build; bundle size assertion catches transitive dependency bloat |
| T-04a-14 | Information Disclosure | PageContextBridge (SerializedPage in transit) | low | accept | SerializedPage travels via chrome.runtime.sendMessage within the extension's isolated world; cross-extension message interception is a Chrome platform concern, not an application concern |
| T-04a-15 | Tampering | Test coverage gaps (unexercised extraction paths) | low | accept | Test coverage targets all strategy implementations, both modes, all error codes, all redaction patterns, and both invalidation paths; uncovered paths (e.g., corrupted DOMParser output) are Chrome platform guarantees |

Note: All prior threat IDs (T-04a-01 through T-04a-12, T-04a-SC) are addressed in Plans 04a-01/02/03 threat models.
</threat_model>

<verification>
Phase-level verification gate:
```bash
pnpm run verify:phase-4a
# = tsc --noEmit && vitest run tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts
```
Must exit 0 with all test suites green.
</verification>

<success_criteria>
1. `tests/isolation/no-content-script-ui.test.ts` exists and passes: no banned imports in content source files, content bundle < 50KB
2. `tests/core/content/PageContextBridge.test.ts` exists and passes: EXTRACT_PAGE_CONTENT handler returns correct SerializedPage shape, passwords redacted, size cap enforced
3. All extraction, content, and isolation test suites green (`vitest run tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts`)
4. `tsc --noEmit` passes on entire project
5. `pnpm run verify:phase-4a` exits 0
</success_criteria>

<output>
Create `.planning/phases/04a-page-content-extraction/04a-04-SUMMARY.md` when done
</output>
