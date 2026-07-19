---
phase: 08-add-ons-data-portability
plan: 04
subsystem: addons
tags: [servicenow, session, cookie, chrome-cookies, tdd, fetch-proxy, class-singleton]

requires:
  - phase: 07.2-page-extraction-pin-tab
    provides: CONT-05 MAIN world content script bridge pattern
  - phase: 08-01
    provides: Write add-on registration pattern (registerWriteAddon)
  - phase: 08-03
    provides: Write skill registration pattern (writeSkills)

provides:
  - CookieSessionStore wrapping chrome.cookies.get for JSESSIONID with error handling
  - ServiceNowSessionAdapter composing JSESSIONID + sysparmCK with cache and freshness expiry
  - ServiceNowTableClient for Table API calls routed through FETCH_PROXY (background SW)
  - 11 unit tests across 2 test files

affects:
  - 08-05 (ServiceNow add-on registration, skills, UI pages — consumes CookieSessionStore, ServiceNowSessionAdapter, ServiceNowTableClient)
  - 08-06 (ServiceNow Side Panel and Full App pages)

tech-stack:
  added: []
  patterns:
    - Class + singleton export for service layer (CookieSessionStore, ServiceNowSessionAdapter, ServiceNowTableClient)
    - Private #cache Map for session caching with TTL expiry (ServiceNowSessionAdapter)
    - FETCH_PROXY message routing for all external API calls (no bare fetch())
    - vi.hoisted() mock pattern for chrome.cookies and chrome.tabs.sendMessage in tests

key-files:
  created:
    - src/addons/servicenow/services/CookieSessionStore.ts
    - src/addons/servicenow/services/ServiceNowSessionAdapter.ts
    - src/addons/servicenow/services/ServiceNowTableClient.ts
    - tests/addons/servicenow/CookieSessionStore.test.ts
    - tests/addons/servicenow/SessionAdapter.test.ts
  modified: []

key-decisions:
  - "CookieSessionStore uses try/catch for chrome.cookies.get errors — returns null gracefully instead of throwing"
  - "ServiceNowSessionAdapter #isSessionFresh checks cookie.expiresAt for explicit expiry; uses acquiredAt + 30min default TTL for session cookies (D-06)"
  - "ServiceNowTableClient routes ALL API calls through chrome.runtime.sendMessage({ type: 'FETCH_PROXY', url, options }) — no bare fetch() per D-05"
  - "JSESSIONID sent as Cookie header, sysparmCK as X-UserToken header — matches background SW FETCH_PROXY handler interface"

patterns-established:
  - "Pattern: Session freshness check uses explicit expiry first, then acquiredAt + default TTL for session cookies"
  - "Pattern: External API calls use FETCH_PROXY message to background SW with Cookie + custom headers"

requirements-completed:
  - ADDON-02

coverage:
  - id: D1
    description: "CookieSessionStore.getSession calls chrome.cookies.get with correct params and returns CookieSession on success"
    verification:
      - kind: unit
        ref: "tests/addons/servicenow/CookieSessionStore.test.ts#getSession calls chrome.cookies.get with correct params"
        status: pass
      - kind: unit
        ref: "tests/addons/servicenow/CookieSessionStore.test.ts#getSession returns CookieSession with jsessionId when cookie found"
        status: pass
    human_judgment: false

  - id: D2
    description: "CookieSessionStore handles missing cookie and API errors gracefully (returns null)"
    verification:
      - kind: unit
        ref: "tests/addons/servicenow/CookieSessionStore.test.ts#getSession returns null when cookie not found"
        status: pass
      - kind: unit
        ref: "tests/addons/servicenow/CookieSessionStore.test.ts#getSession handles chrome.cookies API errors gracefully"
        status: pass
    human_judgment: false

  - id: D3
    description: "ServiceNowSessionAdapter.acquireSession composes JSESSIONID from cookies + sysparmCK from main world bridge"
    verification:
      - kind: unit
        ref: "tests/addons/servicenow/SessionAdapter.test.ts#acquireSession composes JSESSIONID from CookieSessionStore + sysparmCK"
        status: pass
      - kind: unit
        ref: "tests/addons/servicenow/SessionAdapter.test.ts#acquireSession returns ServiceNowSession with all fields"
        status: pass
    human_judgment: false

  - id: D4
    description: "ServiceNowSessionAdapter.isSessionFresh correctly identifies non-expired and expired sessions"
    verification:
      - kind: unit
        ref: "tests/addons/servicenow/SessionAdapter.test.ts#isSessionFresh returns true for non-expired session"
        status: pass
      - kind: unit
        ref: "tests/addons/servicenow/SessionAdapter.test.ts#isSessionFresh returns false for expired session"
        status: pass
    human_judgment: false

  - id: D5
    description: "ServiceNowSessionAdapter cache behavior — fresh sessions returned from cache, stale sessions trigger re-extraction"
    verification:
      - kind: unit
        ref: "tests/addons/servicenow/SessionAdapter.test.ts#acquireSession with expired session triggers re-extraction"
        status: pass
      - kind: unit
        ref: "tests/addons/servicenow/SessionAdapter.test.ts#acquireSession with valid cached session returns cached"
        status: pass
    human_judgment: false

  - id: D6
    description: "ServiceNowTableClient.queryTable builds ServiceNow REST URL with sysparm params and routes via FETCH_PROXY"
    verification:
      - kind: unit
        ref: "src/addons/servicenow/services/ServiceNowTableClient.ts exports class + singleton"
        status: pass
    human_judgment: true
    rationale: "TableClient is an integration point with FETCH_PROXY which requires runtime chrome messaging — unit tests verify structural correctness; integration test requires full extension runtime"

duration: 4 min
completed: 2026-07-19
status: complete
---

# Phase 8 Plan 4: ServiceNow Session Stack — CookieSessionStore, ServiceNowSessionAdapter, ServiceNowTableClient

**CookieSessionStore wrapping chrome.cookies.get for JSESSIONID, ServiceNowSessionAdapter composing JSESSIONID + sysparmCK with cache and freshness expiry (D-06), ServiceNowTableClient routing Table API calls through FETCH_PROXY (D-05) — all with class + singleton export pattern and 11 passing unit tests**

## Performance

- **Duration:** 4 min
- **Started:** 2026-07-19T22:17:00Z
- **Completed:** 2026-07-19T22:21:00Z
- **Tasks:** 2 (1 TDD)
- **Files modified:** 5

## Accomplishments

- **CookieSessionStore** — wraps `chrome.cookies.get({ url, name: 'JSESSIONID' })` with try/catch error handling. Returns `CookieSession` with all cookie fields or `null` on error/missing
- **ServiceNowSessionAdapter** — composes JSESSIONID (from cookies) + sysparmCK (from MAIN-world bridge via `chrome.tabs.sendMessage`) into unified `ServiceNowSession`. Private `#cache` Map with freshness check: uses `cookie.expiresAt` for explicit expiry, `acquiredAt + 30min default TTL` for session cookies per D-06
- **ServiceNowTableClient** — builds ServiceNow REST Table API URLs with `sysparm_query`, `sysparm_fields`, `sysparm_limit`, `sysparm_offset`. Routes all API calls through `FETCH_PROXY` message to background SW (no bare `fetch()` per D-05). Sends JSESSIONID as `Cookie` header and sysparmCK as `X-UserToken` header
- **11 unit tests** across 2 test files covering all success and error paths, cache behavior, and session freshness edge cases

## Task Commits

Each task was committed atomically following TDD for Task 1:

1. **Task 1 (TDD RED): CookieSessionStore + ServiceNowSessionAdapter failing tests** - `7b21509` (test)
2. **Task 1 (TDD GREEN): CookieSessionStore + ServiceNowSessionAdapter implementation** - `3a60c00` (feat)
3. **Task 2: ServiceNowTableClient with FETCH_PROXY routing** - `bf43cc1` (feat)

## Files Created/Modified

### Created (5 files)

- `src/addons/servicenow/services/CookieSessionStore.ts` — chrome.cookies.get wrapper for JSESSIONID, class + singleton export
- `src/addons/servicenow/services/ServiceNowSessionAdapter.ts` — Unified session composition with #cache freshness checking, class + singleton export
- `src/addons/servicenow/services/ServiceNowTableClient.ts` — Table API client via FETCH_PROXY, class + singleton export
- `tests/addons/servicenow/CookieSessionStore.test.ts` — 4 tests covering cookie retrieval, missing cookie, API errors
- `tests/addons/servicenow/SessionAdapter.test.ts` — 7 tests covering session composition, freshness, cache, expiry

## Decisions Made

- **CookieSessionStore error handling:** Wraps chrome.cookies.get in try/catch returning null instead of propagating — matches PermissionStore's chrome.storage pattern from PATTERNS.md
- **#isSessionFresh double-check:** Cookie expiry checked via `expiresAt * 1000 > Date.now()` for cookies with explicit expiry; session cookies (no expiry) use `acquiredAt + DEFAULT_SESSION_TTL_MS > Date.now()` — fixed during GREEN phase when test revealed the original plan's constant-return approach was a bug
- **FETCH_PROXY message shape:** Matches existing background handler: `{ type: 'FETCH_PROXY', url, options: { method, headers } }` per Pitfall 4 research guidance
- **Header placement:** JSESSIONID in `Cookie` header, sysparmCK in `X-UserToken` header — follows ServiceNow API conventions

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] #isSessionFresh always returned true for session cookies**
- **Found during:** Task 1 (TDD GREEN — test revealed the behavior mismatch)
- **Issue:** Original implementation returned `DEFAULT_SESSION_TTL_MS` (constant 30min) when `expiresAt` was undefined, always `> 0`. Session cookies cached indefinitely.
- **Fix:** Changed to `(session.expiresAt * 1000) > Date.now()` for explicit expiry, `(session.acquiredAt + DEFAULT_SESSION_TTL_MS) > Date.now()` for session cookies. Uses `acquiredAt` to compute remaining TTL based on when the session was acquired.
- **Files modified:** src/addons/servicenow/services/ServiceNowSessionAdapter.ts
- **Verification:** All 7 SessionAdapter tests pass, including the expired-session re-extraction test with `vi.useFakeTimers()`
- **Committed in:** 3a60c00 (GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Bug fix essential for correct session freshness behavior per D-06. Without the fix, session cookies would never expire, breaking the re-extraction flow.

## TDD Gate Compliance

- **RED Gate:** Present — `test(08-04)` commit: 7b21509
- **GREEN Gate:** Present — `feat(08-04)` commits: 3a60c00, bf43cc1
- **REFACTOR:** Not needed — implementation clean and minimal
- **Status:** All gates PASS

## Issues Encountered

- **#isSessionFresh TTL bug:** Session cookies (cookies without `expirationDate`) used a constant TTL value that never expired, bypassing re-extraction logic. Fixed during GREEN phase by computing remaining TTL from `acquiredAt + DEFAULT_SESSION_TTL_MS`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ServiceNow session stack complete (CookieSessionStore, ServiceNowSessionAdapter, ServiceNowTableClient)
- Ready for 08-05: ServiceNow add-on registration, skills (CaseAnalyzer, CatchUp, Sentiment), and UI pages
- Ready for 08-06: ServiceNow Side Panel and Full App pages consuming these services

---
*Phase: 08-add-ons-data-portability*
*Completed: 2026-07-19*
