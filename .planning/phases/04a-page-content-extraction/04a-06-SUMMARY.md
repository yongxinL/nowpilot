---
phase: 04a-page-content-extraction
plan: 06
subsystem: content-extraction
tags: code-review-closure, cache-keying, crypto-randomuuid, spa-navigation, minisearch, password-redaction, hidden-inputs, apclite, vitest

# Dependency graph
requires:
  - phase: 04a-page-content-extraction
    provides: Defuddle→Readability→ApcLite pipeline, typed PageContext, per-tab cache, MiniSearch index, D-02 contains-match heuristic (plans 04a-01..05)
provides:
  - Mode-aware PageContentCache keyed by tabId+mode+url (CR-01) — wrong-mode PageContexts can no longer be served from cache
  - SecureContext-proof operation IDs — generateOperationId guards crypto.randomUUID, createEnvelope cannot throw on http:// origins (WR-01)
  - Index/cache consistency on SPA_NAVIGATION — per-tab MiniSearch index removed only when the cache actually invalidates (WR-02)
  - WR-03 innocuous-name allowlist (passenger|passport|compass|bypass) via shared exported isPasswordFieldName — travel/bearing/bypass field values retained, passcode/passage values stay redacted
  - WR-04 strategy-boundary guard parity — type=hidden inputs (incl. tabindex) never enter the APCLite tree; name-heuristic/autocomplete/isPassword values skipped at source
affects: phase verification (verify:phase-4a), PAGE-01 requirement closure, 05-sidepanel-ui, v2 automation substrate (APCLite tree consumers)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composite cache key (tabId:mode:url) with prefix-scoped invalidation — mode is part of the cache identity, never a filter applied after a hit"
    - "Single shared sensitive-name predicate (isPasswordFieldName) exported from the content-script-safe module and imported by extension-page strategies — one heuristic at both capture boundaries"
    - "RegExp without /g flag for reusable .test() predicates — stateless across calls"
    - "vi.stubGlobal + try/finally vi.unstubAllGlobals for SecureContext-only API absence tests"

key-files:
  created: []
  modified:
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

key-decisions:
  - "Cache key order standardized to tabId:mode:url across both the cache Map and the in-flight coalescing Map (CR-01) — identical components, identical ordering"
  - "crypto.randomUUID guard lives at the generator source (OperationId.ts), not in entrypoints (out of scope) — construction-time throw eliminated, notifyNavigation's existing rejection guard now covers the whole SPA_NAVIGATION path"
  - "Passage/passcode deliberately excluded from the WR-03 allowlist: passcode fields hold PIN-like secrets (D-02 err-on-false-positive), passage names stay in the accepted false-negative space — the plan's literal test expectation (isPasswordFieldName('passage_number') === false) was self-contradictory with its own prohibition and success criteria, resolved in favor of the prohibition"
  - "Hidden-input exclusion is walker-level (authoritative, covers tabindex) with an inputRole null case as defense in depth"

patterns-established:
  - "Pattern: sensitive-value guards at capture boundaries share one predicate imported from the content-script-safe module (isPasswordFieldName) — prevents heuristic drift between DomSerializer and ApcLiteStrategy"
  - "Pattern: index lifetime follows cache lifetime — destructive index cleanup (removeTab) runs only when the cache invalidation decision says the content actually changed"

requirements-completed: [PAGE-01]

# Coverage metadata (#1602)
coverage:
  - id: D1
    description: "Mode-aware PageContentCache — extract(1,'actionable',url) after extract(1,'default',url) is a fresh extraction; both mode entries cached independently (CR-01)"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#returns mode-specific cached results — actionable extraction after default is a fresh extraction (CR-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "generateOperationId falls back to a UUID-v4-shaped unique id when crypto.randomUUID is unavailable; createEnvelope does not throw on insecure origins (WR-01)"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/runtime/OperationId.test.ts#falls back to a UUID-shaped unique id when crypto.randomUUID is unavailable (WR-01)"
        status: pass
      - kind: unit
        ref: "tests/core/runtime/RuntimeEnvelope.test.ts#createEnvelope does not throw when crypto.randomUUID is unavailable (WR-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Per-tab MiniSearch index survives same-URL SPA_NAVIGATION events (cache stays hot, index stays searchable); different-URL events still invalidate both (WR-02)"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/PageContentService.test.ts#keeps the per-tab MiniSearch index when SPA_NAVIGATION announces the same URL (WR-02)"
        status: pass
    human_judgment: false
  - id: D4
    description: "WR-03 allowlist — passenger/passport/compass/bypass values retained in serialized HTML while user_pwd and passcode values stay redacted; passage-prefixed names deliberately not allowlisted"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/content/DomSerializer.test.ts#does not redact values for passenger/passport/compass/bypass field names (WR-03)"
        status: pass
      - kind: unit
        ref: "tests/core/content/DomSerializer.test.ts#still redacts passcode-named values (D-02 err on false positives)"
        status: pass
      - kind: unit
        ref: "tests/core/content/DomSerializer.test.ts#keeps passage-prefixed names out of the innocuous allowlist — values stay redacted (D-02, WR-03)"
        status: pass
    human_judgment: false
  - id: D5
    description: "WR-04 strategy boundary — type=hidden inputs (incl. tabindex) produce no APCLiteNode and their values never appear in the tree; name-heuristic/autocomplete/isPassword input values skipped while allowlisted values retained"
    requirement: PAGE-01
    verification:
      - kind: unit
        ref: "tests/core/extraction/ApcLiteStrategy.test.ts#excludes type=hidden inputs from the tree and never captures their values (WR-04)"
        status: pass
      - kind: unit
        ref: "tests/core/extraction/ApcLiteStrategy.test.ts#applies name-heuristic, autocomplete and isPassword guards to input values at the strategy boundary (WR-04)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Phase vitest gate green with no new tsc errors — 93/93 pass across tests/core/extraction, tests/core/content, tests/isolation (up from 86/86); only the 9 pre-existing src/core/storage tsc errors remain"
    requirement: PAGE-01
    verification:
      - kind: other
        ref: "pnpm exec vitest run tests/core/extraction tests/core/content tests/isolation/no-content-script-ui.test.ts — 93 passed, 0 failed"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-07-31
status: complete
---

# Phase 04a Plan 06: Code-Review Closure Summary

**Closed all 5 code-review findings (CR-01, WR-01..WR-04): mode-aware page cache, SecureContext-proof operation IDs, SPA-nav index/cache consistency, WR-03 innocuous-name allowlist, and hidden-input/name-heuristic guards at the APCLite strategy boundary — phase vitest gate green at 93/93 with zero new tsc errors.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-31T20:01:40Z
- **Completed:** 2026-07-31T20:10:10Z
- **Tasks:** 5
- **Files modified:** 11 (6 source, 4 test, 0 created)

## Accomplishments

- **CR-01 (critical) — mode-blind cache fixed:** `PageContentCache` is now keyed by `${tabId}:${mode}:${url}` with prefix-scoped `invalidate`/`invalidateIfChanged` across all modes. `extract()` passes mode through both cache calls; the in-flight coalescing key was reordered to match (`tabId:mode:url`). New cross-mode test proves `extract(1,'actionable',url)` after `extract(1,'default',url)` is a fresh extraction (sendMessageMock 2×) with both mode entries cached independently.
- **WR-01 — SecureContext-only crypto.randomUUID guarded:** `generateOperationId()` now falls back to a UUID-v4-shaped Math.random id when `crypto.randomUUID` is undefined (content scripts on http:// origins); `createEnvelope` routes through it, so SPA_NAVIGATION construction can no longer throw and wedge `lastUrl` tracking. Fallback is documented as a correlation ID only — never a security token.
- **WR-02 — index/cache divergence fixed:** the SPA_NAVIGATION handler now calls `invalidateIfChanged` first and removes the per-tab MiniSearch index **only when it returns true**. Same-URL events keep both cache and index (D-14 contract holds); different-URL events still invalidate both. The new index-survival test was verified to fail against the pre-fix handler (removeTab unconditional).
- **WR-03 — over-redaction fixed:** contains-match `PASSWORD_NAME_PATTERN` retained for D-02 coverage, with a documented 4-term innocuous allowlist (`passenger|passport|compass|bypass`) applied through a new exported `isPasswordFieldName()` used at both redaction sites. Passenger/passport/compass/bypass values are retained; `user_pwd`/`user_passwd`/`db_pwd`/`login_password`/`confirmPassword`/`passcode` values stay redacted; `passage` and `passcode` are deliberately **not** allowlisted (prohibition-compliant, see deviations).
- **WR-04 — strategy-boundary guard parity:** hidden inputs never become APCLiteNodes (walker-level skip is authoritative and covers the tabindex edge; `inputRole` returns null as defense in depth), and the `attributesOf` value guard now skips type=password, type=hidden, name-heuristic (shared `isPasswordFieldName`), `autocomplete=current-password`, and `isPassword` — CSRF/session tokens can no longer flow into the automation substrate.

## Task Commits

Each task was committed atomically:

1. **Task 1: Make PageContentCache mode-aware — cache key includes mode (CR-01)** - `855d032` (fix)
2. **Task 2: Guard generateOperationId against insecure origins (WR-01)** - `4cd692b` (fix)
3. **Task 3: Tie per-tab index removal to actual cache invalidation on SPA_NAVIGATION (WR-02)** - `cf3b5cf` (fix)
4. **Task 4: Tighten PASSWORD_NAME_PATTERN false positives via documented allowlist (WR-03)** - `f4ec719` (fix)
5. **Task 5: Exclude type=hidden inputs and mirror the DomSerializer value guard in ApcLiteStrategy (WR-04)** - `d4dd16c` (fix)

**Plan metadata:** `(docs commit follows this summary)`

## Files Created/Modified

- `src/core/extraction/PageContentCache.ts` - `Map<string, CacheEntry>` keyed by module-level `cacheKey(tabId, mode, url)`; `get`/`set` take mode; `invalidate`/`invalidateIfChanged` delete every key under the `${tabId}:` prefix (all modes)
- `src/core/extraction/PageContentService.ts` - `extract()` passes mode to cache get/set; in-flight key reordered to `tabId:mode:url`; SPA handler removes the per-tab index only when `invalidateIfChanged` returns true; comment block rewritten for the new order
- `src/core/runtime/OperationId.ts` - guarded `generateOperationId()` with Math.random UUID-v4-shaped fallback + JSDoc warning (correlation ID only)
- `src/core/runtime/RuntimeEnvelope.ts` - `createEnvelope` uses `generateOperationId()` instead of bare `crypto.randomUUID()`
- `src/core/content/DomSerializer.ts` - `NON_PASSWORD_NAME_PATTERN` allowlist + exported `isPasswordFieldName()`; both name-heuristic sites (filter + clone-redact loop) now use the helper
- `src/core/extraction/strategies/ApcLiteStrategy.ts` - `isHiddenInput()` + walker skip; `inputRole` `hidden` → null; value guard extended to password/hidden/name/autocomplete/isPassword
- `tests/core/extraction/PageContentService.test.ts` - CR-01 cross-mode test + WR-02 index-survival test (+ `pageIndexBuilder` import)
- `tests/core/runtime/OperationId.test.ts` - WR-01 fallback test (vi.stubGlobal crypto)
- `tests/core/runtime/RuntimeEnvelope.test.ts` - WR-01 no-throw envelope test
- `tests/core/content/DomSerializer.test.ts` - WR-03 FP-retention, passcode-redaction, and passage-guard tests
- `tests/core/extraction/ApcLiteStrategy.test.ts` - WR-04 hidden-input and name-heuristic/autocomplete/isPassword guard tests

## Decisions Made

- **Cache key ordering standardized** (`tabId:mode:url`) across both the cache Map and the in-flight coalescing Map — identical components, identical order for readability (plan directive).
- **WR-01 guard at the source, not the call site:** entrypoints/ is out of scope for this plan, so the guard lives in `OperationId.ts`; once construction cannot throw, the content script's existing sendMessage rejection guard covers the whole SPA_NAVIGATION path.
- **Allowlist narrowed to 4 terms** (passenger|passport|compass|bypass): `passage` and `passcode` excluded — passcode fields hold PIN-like secrets (D-02 err-on-false-positive, RESEARCH Pitfall 4); passage fields are the accepted false-negative space. The review's suggested 6-term allowlist was rejected per the plan's prohibition.
- **Hidden-input exclusion is walker-level** (covers the tabindex edge that `isInteractive` would otherwise catch) with `inputRole` null as a second layer.
- **Single shared redaction predicate:** `isPasswordFieldName` is the one export point, reused by ApcLiteStrategy (safe — the strategy runs in the extension page, D-20 content-bundle isolation unaffected).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Privacy/Correctness] Plan's literal passage test spec contradicted its own prohibition — resolved in favor of the prohibition**
- **Found during:** Task 4 (WR-03 allowlist tests)
- **Issue:** The plan's test 3 spec asserted `isPasswordFieldName('passage_number') === false` and `isPasswordFieldName('boarding_passage') === false`. That outcome is only achievable by adding `passage` to `NON_PASSWORD_NAME_PATTERN` — which the plan's own flagged prohibition forbids ("the allowlist ... must never grow to cover passcode/pin/otp/secret/passphrase/**passage**-class names") and which contradicts the plan's success criterion "passage-prefixed values still redacted". The plan self-contradicts; the prohibition (privacy hard constraint) wins.
- **Fix:** `passage` stays out of the allowlist; `isPasswordFieldName('passage_number')` returns `true` (value remains redacted). The test asserts `true` for passage names and additionally proves redaction end-to-end (`GATE-7`/`B-12` absent from serialized HTML), serving the plan's documented purpose — a regression guard ensuring refactoring never re-introduces `passage` into the allowlist.
- **Files modified:** tests/core/content/DomSerializer.test.ts
- **Verification:** all 11 DomSerializer tests pass, including the 3 existing name-heuristic tests (user_pwd etc.) and the new passcode/passage/FP tests
- **Committed in:** f4ec719 (Task 4 commit)

---

**Total deviations:** 1 auto-fixed (1 privacy/correctness — plan-internal contradiction)
**Impact on plan:** No scope creep. The deviation enforces the plan's stated D-02 privacy policy where the literal test text conflicted with it; all other plan directives (4-term allowlist, contains-match retention, shared helper export) executed exactly as written.

## Issues Encountered

- **Transient edit mishap in DomSerializer.test.ts** (Task 4): a botched Edit collapsed the 'never mutates the live document' test into the following test's body; detected immediately via Read, both tests restored verbatim, full file verified green (11/11). No trace in history.
- The full `pnpm run verify:phase-4a` chain still short-circuits at `tsc --noEmit` (exit 2) on the 9 pre-existing `src/core/storage` errors (documented out-of-scope in VERIFICATION.md / deferred-items.md #1). Verified separately: tsc reports **zero** errors outside `src/core/storage`, and the vitest gate passes 93/93 when run directly.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 code-review findings (CR-01, WR-01..WR-04) closed with regression tests; 04a-REVIEW.md status can be flipped to resolved at phase verification.
- Phase vitest gate: **93/93 pass, 0 failures** (86 pre-existing + 7 new). Runtime suites (tests/core/runtime) also green: 9/9.
- No new tsc errors: only the 9 pre-existing `src/core/storage` errors remain (out of scope, deferred-items.md #1).
- Scope discipline verified: `entrypoints/` (incl. content.core.ts) and `tests/isolation/` untouched.
- PAGE-01 stays complete; phase ready for final verification and the side-panel/UI follow-up phase.

---

*Phase: 04a-page-content-extraction*
*Completed: 2026-07-31*

## Self-Check: PASSED

- All 6 modified source files exist on disk ✓
- SUMMARY.md exists at `.planning/phases/04a-page-content-extraction/04a-06-SUMMARY.md` ✓
- All 6 commits present in git log: `855d032` (T1 CR-01), `4cd692b` (T2 WR-01), `cf3b5cf` (T3 WR-02), `f4ec719` (T4 WR-03), `d4dd16c` (T5 WR-04), `6ffaeb5` (docs) ✓
- Phase vitest gate: 93/93 pass, 0 failures (86 pre-existing + 7 new) ✓
- tsc: zero new errors beyond the 9 pre-existing src/core/storage ones ✓
- Scope discipline: entrypoints/ and tests/isolation/ untouched ✓
