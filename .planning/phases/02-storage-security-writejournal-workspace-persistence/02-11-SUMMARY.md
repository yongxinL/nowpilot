---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 11
subsystem: testing
tags: [two-surface-harness, loopback-transport, handoff, d2-30, d2-31, windows-5, deterministic-clock, fake-timers, writer-election, chat-history-db, sentinel-absence, traceability, wave-6]

# Dependency graph
requires:
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: "the Phase-1 handoff protocol (`createHandoffInitiator`/`createHandoffTarget` with the injectable `HandoffTransport` seam, `buildHandoffUrl`/`parseHandoffUrl`, the strict envelope validators), the frozen `WorkspaceState` contract and the `WorkspaceStore` projection shape"
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-02's `np_db` spine — the `sessions`/`messages`/`entries`/`errors` stores, `ChatHistoryDB`'s read-back-verified write, `WriteJournal` and the `__resetIndexedDB` test contract"
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-05's `ErrorStore` (`recordError`/`listErrors`, redaction before persistence) and the seven-stage migration vocabulary"
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-06's `WorkspacePersistence` (`np_workspace` journaled read/write) and `WriterElection` (read-back-verified CAS, heartbeat, `assertStillPrimary`, the §20.11 projection)"
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-07's `projectWriterSignal` and the frozen six-state writer vocabulary — the pure projection the harness applies per surface"
provides:
  - "tests/harness/twoSurface.ts — `createTwoSurfaceHarness()`, `createLoopbackTransport()`, `createSyntheticCredentialStore()`, `flush()`, `publishedOf()`, `SYNTHETIC_CREDENTIAL_SENTINEL`, `WORKSPACE_STATE_ONLY_FIELDS`, the clock seam (`now`, `advanceMs`, `advanceHeartbeat`, `advanceDebounce`), the `HarnessTabs` registry, `openTarget`/`bringUpStandalone`, `restartSurface`, `crashDuring`, the Phase 2 database adapters and `dispose()`"
  - "tests/integration/workspaceHandoff.integration.test.ts — Suite A, 22 clause-named cases plus the D2-33 chat-identity case"
affects: [02-12, 02-13, phase-15-workspace-experience, phase-19-release-gate]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 16028
  tasks: 2
  commits: 2
  plan_head_before: bc6d06cfa016e527998849b5bc05b98c121de4b4

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The transport delivers on a queued microtask, never synchronously: the initiator publishes the transfer *before* it opens its acknowledgement window, so a synchronous delivery would drop every ack (the real `BroadcastChannel` delivery is a queued task). The loopback transport records the envelope in its outbox at publish time and delivers a clone per listener on a microtask"
    - "Two documents, two projections, one durable store: each simulated surface owns an in-memory workspace/writer projection updated through the real pure `projectWriterSignal`, while `chrome.storage` and `np_db` stay shared — the shape two real documents have. The module-level zustand singleton is deliberately not faked into two instances"
    - "The clock is the fake timers: `advanceHeartbeat(n)` is `n × HEARTBEAT_MS` and `advanceDebounce()` is `STORAGE_DEBOUNCE_MS`, so no case hard-codes a duration and no case sleeps"
    - "A crash is a dropped message, not a thrown exception: `crashDuring('ack', …)` drops the next acknowledgement, which leaves the durable state written and the source waiting — the only shape in which 'crash between handoff stages' is observable without breaking the controller's own error contract"
    - "Absence asserted next to presence: the sentinel-absence scan runs beside the stand-in still holding the sentinel, beside a non-synthetic value being refused, and beside a planted occurrence the scan finds — so a vacuous scan cannot pass"
    - "Traceability is mechanical, not prose: clause 22 reads this suite's own source, extracts every `it('…')` title and proves all 22 clauses have exactly one named case whose literal name exists in the file"

key-files:
  created:
    - tests/harness/twoSurface.ts
    - tests/integration/workspaceHandoff.integration.test.ts
  modified: []

key-decisions:
  - "The loopback transport delivers asynchronously (queued microtask). A synchronous delivery closes the acknowledgement window before `waitForAck()` opens it — observed as a 5 s test timeout in the first smoke run — so the microtask is the production-faithful shape, not a convenience."
  - "The harness's navigation adapter reproduces `planStandaloneTarget`'s environment interaction (query → focus and re-point vs create) because `openStandalone` binds the shipped `handoffTransport` with no injection point; the handoff *decisions* stay production. The tabs registry is the D2-30-sanctioned Chrome-tabs mock, and the URL is built by the real `buildHandoffUrl` and parsed by the real `parseHandoffUrl`."
  - "The tabs registry seeds its first tab with the Standalone surface's identity, so the document's tab id and the election's `tabId` are the same number — otherwise the record and the registry disagree and a 'reuse' assertion compares two unrelated integers."
  - "`restartSurface` is a **graceful** reload: the previous election instance is stopped (releasing the record when it owns it) and a fresh instance is created with the same identity. The non-graceful path — a surface that stops heartbeating while its record stays behind — is exercised by simply not starting the heartbeat and advancing three intervals (clause 21), which is the staleness takeover."
  - "`dropNext(type, count)` rather than a single drop: the timeout and bounded-retry clauses need a whole acknowledgement budget dropped, and a `Set`-of-types could only drop once. The extension is committed with Suite A because Suite A is what needed it."
  - "The per-surface workspace projection is a local object updated by the real pure `projectWriterSignal`, not a second zustand instance: `vi.resetModules()` per surface would give the two stores module graphs disjoint from the harness's own production imports, which is a test-order hazard for no gain. The harness header states the boundary explicitly."
  - "Clause 12 scans six surfaces (URL, every published envelope, the journal entries, the error records, the `debugLog` ring buffer and both storage areas) and asserts the sentinel is still in the synthetic stand-in — the plan's list plus the storage areas, with the positive control that makes the absence real."
  - "The suite claims automated contract coverage only. It asserts no observed UI behaviour and closes no window; WINDOW #5 stays `open` for the Phase 15 consolidated Real-Chrome cycle (recorded in 02-12)."

patterns-established:
  - "One shared harness, two independent suites: `tests/harness/twoSurface.ts` matches no Vitest glob, is importable by both integration suites, and is the only place a simulated surface is constructed."
  - "Every case builds its own harness in `beforeEach` and disposes it in `afterEach`; `dispose()` stops both elections, disposes both target controllers, closes the database handle, clears both storage maps, the draft slot and the log ring buffer, and restores real timers."
  - "Clause-named cases (`D2-31.<n> <clause> — <assertion>`), so the D2-35 traceability mapping and the phase gate can cite a case name that provably exists."

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "The D2-30 shared harness exists as a non-test module: two simulated surface runtimes with independent projections and stable identities, a deterministic loopback transport, a deterministic clock/heartbeat seam, deterministic tab/focus/reload/lifecycle adapters, restart and crash simulation, Phase 2 database adapters and synthetic-only credential-store support — composing the real handoff controllers, election, persistence, chat and error repositories"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "npx tsc --noEmit (clean) && npx vitest run tests/harness/twoSurface.ts → 'No test files found' (not collected as a suite)"
        status: pass
      - kind: integration
        ref: "the harness is exercised end to end by all 23 Suite A cases (cross-surface delivery, election, journaled persistence, IndexedDB, restart, crash)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Suite A covers D2-31 clauses 1–21 as one named case each: cold target initialisation, ready-before-transfer, ready/transfer/ack ordering, ack-gated success, warm reuse and focus, duplicate-tab prevention, stable identifiers, idempotent duplicates, the safe projection allowlist, draft transfer, no whole-state broadcast, timeout behaviour, bounded retry, invalid source/target rejection, unsupported schema rejection, journaled persistence with authoritative read-back, crash between stages, reload and recovery, failure preserving the writer, and stale-writer rejection"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "npx vitest run tests/integration/workspaceHandoff.integration.test.ts (23 passed; the 21 contract cases plus the traceability and chat-identity cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The handoff payload provably cannot carry a credential: a synthetic sentinel is planted in the credential stand-in and asserted absent from the built URL, every published envelope, the journal entries, the error-store records, the `debugLog` ring buffer and both storage areas, with the stand-in still holding it and refusing a non-synthetic value"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "tests/integration/workspaceHandoff.integration.test.ts — 'D2-31.12 no credential or secret in URL, envelope, message, journal or log — the sentinel never crosses'"
        status: pass
    human_judgment: false
  - id: D4
    description: "The D2-31 clause list is traceable: clause 22 reads the suite's own source and proves all 22 clauses have exactly one named case, that no case name is duplicated, and that every clause-map row cites a case name that literally exists in the file"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "tests/integration/workspaceHandoff.integration.test.ts — 'D2-31.22 traceability — the suite declares exactly one named case per D2-31 clause'"
        status: pass
    human_judgment: false
  - id: D5
    description: "Chat identity is proved through the real ChatHistoryDB contract with minimal synthetic records: a conversation and two messages write and read back by the authoritative path, survive a surface restart, are referenced (never carried) by the handoff envelope, and are read from the database with no legacy `np_store` copy present"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "tests/integration/workspaceHandoff.integration.test.ts — 'chat identity — minimal synthetic records persist across a restart, resolve by reference and never ride the handoff envelope'"
        status: pass
    human_judgment: false
  - id: D6
    description: "Plan verification gate: `tsc --noEmit` clean, the Phase-1 real-bus suite still green (`tests/core/workspace/WorkspaceHandoff.test.ts`), the integration directory green, and the full suite green with no regression"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "npx tsc --noEmit (clean) && npx vitest run tests/core/workspace/WorkspaceHandoff.test.ts (31 passed) && npx vitest run tests/integration (23 passed) && npx vitest run (55 files / 842 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Cross-plan contract: 02-12's Suite B consumes this harness (surfaces, shared storage stream, clock seam, restart, synthetic credential stand-in, `dispose`) rather than building a second one, and 02-13's corrected gate enumerates both integration suites with the path preflight"
    requirement: "CORE-02"
    verification: []
    human_judgment: true
    rationale: "A consumer contract cannot be asserted from this plan's own suites. A verifier should confirm Suite B imports `tests/harness/twoSurface.ts` (no second harness), that its 'exactly one flow presented' case counts presentations across both surfaces (Pitfall 10), and that `verify:phase-2` names both integration suite paths and keeps the self-derived preflight."
  - id: D8
    description: "WINDOW #5 remains `open`: this plan records Phase 2 automated contract coverage only and claims no Real-Chrome observation; the deferred final observation stays with the Phase 15 consolidated cycle and the Phase 19 release gate"
    requirement: "CORE-02"
    verification: []
    human_judgment: true
    rationale: "A deferral is a judgement call, not a test result. The suite asserts in-process contract behaviour only; whether the built extension focuses the existing Standalone tab and shows the pinned pending/complete/failed copy in a real Chrome session is Phase 15's observation (02-12 records the outcome note)."

duration: 11 min
completed: 2026-09-24
status: complete
---

# Phase 2 Plan 11: The Two-Surface Harness and the WINDOWS #5 Handoff Contract Summary

**The deferred WINDOWS #5 handoff contract now has deterministic automated coverage: one shared harness composes the real handoff controllers, writer election, journaled persistence and chat repositories across two simulated surfaces over a microtask loopback transport, and 22 clause-named cases — including a sentinel-absence scan over the URL, every envelope, the journal, the error store, the log ring buffer and both storage areas — prove the contract clause by clause while leaving the Real-Chrome observation formally open.**

## Performance

- **Duration:** 11 min
- **Started:** 2026-09-24T01:46:33Z
- **Completed:** 2026-09-24T01:56:16Z
- **Tasks:** 2
- **Files modified:** 2 (2 created, 0 modified outside the harness's own Task-2 extension)

## Accomplishments

- **One harness, real logic, environmental fakes only.** `tests/harness/twoSurface.ts` builds two simulated surface runtimes — independent workspace and writer projections, stable surface and tab identities, the shared `chrome.storage` maps and `onChanged` dispatcher, a Phase 2 database adapter set and a synthetic-only credential stand-in — and composes the **real** `createHandoffInitiator`/`createHandoffTarget`, `validateHandoffEnvelope`, `buildHandoffUrl`/`parseHandoffUrl`, `WriterElection`, `readWorkspaceState`/`writeWorkspaceState`, `ChatHistoryDB`, `ErrorStore` and `projectWriterSignal`. The only boundaries faked are D2-30's exhaustive list: Chrome tabs/focus, the browser lifecycle, the `BroadcastChannel` transport, `chrome.storage`, the IndexedDB reset, time and the credential store — all named in the file header.
- **The transport had to be asynchronous, and that is the finding.** The first smoke run hung: the initiator publishes the transfer *before* it opens its acknowledgement window, so a synchronous loopback delivery drops every ack (the real `BroadcastChannel` delivers on a queued task). The transport now records the envelope in its outbox at publish time and delivers a clone per listener on a microtask — deterministic, no timers, production-faithful.
- **Every D2-31 clause is a named case, and the mapping is mechanical.** 22 clause-named cases plus the D2-33 chat-identity case: cold-target initialisation, ready-before-transfer, ordering, ack-gated success, warm reuse/focus, duplicate-tab prevention, stable identifiers across retries, idempotent duplicates, the allowlist projection, draft transfer with consume-once, no whole-state broadcast, the sentinel scan, timeout, bounded retry, invalid source/target, unsupported schema, journaled persistence with read-back, a crash between stages, reload/recovery, failure preserving the writer and stale-writer rejection. Clause 22 reads the suite's own source and proves exactly one named case per clause.
- **Authority transitions are asserted, not flags.** The writer clauses run the real election across both surfaces: a failed handoff leaves the Side Panel passing `assertStillPrimary()` and the Standalone failing it (the durable record still names the source), and after the Side Panel's record goes stale the Standalone takes authority and the superseded surface is rejected with `WORKSPACE_WRITER_REJECTED` and demoted to `mirror`.
- **A crash is a dropped message, and the durable state survives it.** `crashDuring('ack', …)` drops the acknowledgement: the target has already applied the projection, the source is still waiting, and the retry completes with the duplicate applied exactly once — the only shape in which "crash between handoff stages" is observable without breaking the controller's own error contract.
- **The sentinel scan cannot pass vacuously.** The credential stand-in still holds the sentinel after the scan, refuses a non-synthetic value, and the scan is shown to find a planted occurrence; the sentinel is absent from the URL, every published envelope, the journal entries, the redacted error record, the log ring buffer and both storage areas.
- **No regression.** `tsc --noEmit` clean; the Phase-1 real-bus suite at 31 passed; the integration directory at 23 passed; the full suite at 55 files / 842 tests (was 54 / 819).

## Task Commits

Each task was committed atomically:

1. **Task 1: `tests/harness/twoSurface.ts` — the shared two-surface harness** — `043c8d12` (feat)
2. **Task 2: Suite A — the WINDOWS #5 handoff contract, one named case per clause** — `a60e3135` (test)

**Plan metadata:** see the final `docs(02-11)` commit below

## Files Created/Modified

- `tests/harness/twoSurface.ts` — the non-test module: `createLoopbackTransport()` (outbox + microtask delivery + `dropNext(type, count)`), `createTwoSurfaceHarness()` (two surface runtimes, the clock seam, the tabs registry, `openTarget`/`bringUpStandalone`, `restartSurface`, `crashDuring`, the DB adapters, `dispose()`), `createSyntheticCredentialStore()`, `flush()`, `publishedOf()`, `SYNTHETIC_CREDENTIAL_SENTINEL` and `WORKSPACE_STATE_ONLY_FIELDS`.
- `tests/integration/workspaceHandoff.integration.test.ts` — Suite A: the `CLAUSE_MAP` (22 rows), the 22 clause cases, the D2-33 chat-identity case, and the local helpers (`request`, `newSource`, `projectionFor`, `transfersOf`, `acksOf`, `isSettled`).

## Decisions Made

- **The transport delivers on a queued microtask.** Recorded above; it is the difference between a passing suite and a 5 s timeout, and it is what the real bus does.
- **The navigation adapter mirrors `planStandaloneTarget`'s environment interaction.** `openStandalone` binds the shipped transport with no injection point, so the harness queries/focuses/re-points or creates its own registry tab while the URL is built and parsed by the real functions. The handoff decisions stay production; only the Chrome-tabs boundary is faked (D2-30 sanctions exactly that).
- **The tabs registry's first tab carries the Standalone surface's identity.** Otherwise the registry's tab id and the election's `tabId` are unrelated numbers and "reuse" asserts nothing.
- **`restartSurface` is a graceful reload.** A real unmount stops its election; the non-graceful path (a record left behind to go stale) is exercised by not starting the heartbeat and advancing three intervals, which is exactly clause 21's takeover.
- **`dropNext(type, count)` instead of a single drop.** The timeout and bounded-retry clauses need an entire acknowledgement budget dropped; a type-set could only drop once. Committed with Suite A because Suite A is what needed it.
- **The per-surface store is a projection object updated by the real pure `projectWriterSignal`.** `vi.resetModules()` per surface would give the two stores module graphs disjoint from the harness's own production imports — a test-order hazard for no gain. The harness header states the boundary.

## Deviations from Plan

### Plan-text resolutions

**A. `crashDuring` needed a multi-drop capability.** The plan names `crashDuring(stageName, fn)` as a helper that simulates a crash between stages. Dropping a *single* envelope only produces a crash the retry recovers from; the timeout and bounded-retry clauses need every acknowledgement in a budget dropped. `dropNext` therefore takes a `count`, and `crashDuring` arms one. The extension lives in the Task 1 artifact but is committed in Task 2 (`a60e3135`) because Task 2 is what required it.

**B. `restartSurface` is graceful, and staleness is the non-graceful path.** The plan lists both `restartSurface(surface)` and crash simulation without stating which release semantics a restart has. The harness releases the election record on restart (what a real unmount does) and clause 21 covers the left-behind record by not heartbeating.

---

**Total deviations:** 0 auto-fixed; 2 plan-text resolutions.
**Impact on plan:** No scope creep — both resolutions are places the plan names a capability without fixing its shape, and both are asserted in the suite. No production file was touched: the only two files changed are the plan's own `files_modified`.

## Issues Encountered

- **The synchronous transport hang (the one real bug of this plan).** The first smoke run timed out at 5 s because a synchronous delivery of the acknowledgement preceded the initiator's `waitForAck()` window. Fixed by delivering on a microtask; the smoke file was deleted before the Task 1 commit and the behaviour is now asserted by clause 4 (success withheld until the ack lands).
- **The tab-identity mismatch.** The smoke run's first pass asserted the focused tab's id against the Standalone surface's identity and found `901 ≠ 202` — the registry and the election disagreed about the same document. Fixed by seeding the registry from the surface's tab id.
- **`vi.useFakeTimers` is called with an explicit `toFake` list** (`setTimeout`, `clearTimeout`, `setInterval`, `clearInterval`, `Date`) so microtasks and `queueMicrotask` stay real — `flush()` cannot hang behind a faked scheduler, and the transport's delivery is unaffected.
- Pre-existing untracked planning artifacts (`.gsd/`, `.planning/milestone.lock`) were left untouched — outside this plan's scope.

## Known Stubs

None. Both files are exercised by the runs recorded above: the harness by all 23 Suite A cases (plus its own compile gate), and every clause case by the suite's own run. No placeholder values, no TODO/FIXME markers, no skipped or todo tests, and no unrun `<verify>`.

## Threat Flags

None — both files are test-only (`tests/harness/twoSurface.ts`, `tests/integration/workspaceHandoff.integration.test.ts`). No production module, endpoint, permission, storage key or trust boundary is introduced by this plan. The plan's register is closed by the suite: T-02-57 (forged envelopes — the real validators reject the invalid source/target and unsupported-version cases), T-02-58 (vacuous harness — the mock-only-environmental rule is stated in the header and the real implementations run), T-02-59 (sentinel leakage — clause 12's scan with its positive controls), T-02-60 (stale writer — clause 21's real takeover), T-02-61 (flaky timing — the harness clock, no sleeps, `dispose()` clears every timer) and T-02-62 (test-order dependence — one harness per case, disposed; the suite passes alone and in the full run).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **02-12 consumes the harness, not a second one.** Suite B should import `createTwoSurfaceHarness()` (surfaces, the shared storage maps + `onChanged` stream, the clock seam, `restartSurface`, the synthetic credential stand-in, `dispose()`), and its "exactly one authoritative onboarding attempt" case must count presentations across both surfaces (Pitfall 10) rather than asserting completion alone.
- **02-13's corrected gate** must enumerate `tests/integration/workspaceHandoff.integration.test.ts` (and Suite B) with the self-derived path preflight, and keep `tests/harness/twoSurface.ts` out of the collected paths.
- **WINDOW #5 stays `open`.** This suite is Phase 2 automated contract coverage only; 02-12 records the outcome note ("Phase 2 automated contract coverage = PASS", "Phase 15 Real-Chrome acceptance = still deferred") without changing the window's status.
- **Phase 15** owns the Real-Chrome observation: a cold Standalone tab announcing readiness before the Side Panel publishes, the pinned pending/complete/failed copy, focus behaviour and no unexpected duplicate surface.
- **Phase 19** must fail while any of WINDOWS #5/#7/#8 remains open.

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-09-24*

## Self-Check: PASSED

- Both created files exist on disk: `tests/harness/twoSurface.ts` and `tests/integration/workspaceHandoff.integration.test.ts` (no other file changed).
- Both plan commits exist in history: `043c8d12` (Task 1), `a60e3135` (Task 2).
- Measured commit count at SUMMARY write time (`git rev-list --count bc6d06cf..HEAD`): 2, base recorded as `plan_head_before`.
- `npx tsc --noEmit` clean; the full suite green at 55 files / 842 tests; the Phase-1 real-bus suite green at 31 passed; the harness not collected as a suite.
