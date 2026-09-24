---
phase: 02-storage-security-writejournal-workspace-persistence
plan: 06
subsystem: database
tags: [workspace, persistence, write-journal, writer-election, chrome-storage-session, cas, heartbeat, broadcastbus, zod, fake-timers, wave-3]

# Dependency graph
requires:
  - phase: 02-storage-security-writejournal-workspace-persistence
    provides: "02-02's `np_db` spine — the `entries` store, `createJournalEntry`/`runJournaled` with the seven-stage convention, and the additive `'update-workspace'` operation this plan journals through"
  - phase: 01-mv3-wxt-runtime-antd-shells-workspace
    provides: "the frozen `WorkspaceState` contract (`parseWorkspaceState`, `migrateWorkspaceState`, the three version axes), the debounced `chromeStorageAdapter` with `flushPendingWrites`, the `BroadcastBus` transport with own-echo suppression, and the documented `WorkspaceStore` swap point (`PHASE1_WRITER_STATE`)"
provides:
  - "src/core/workspace/WorkspacePersistence.ts — `WORKSPACE_STORAGE_KEY`, `WORKSPACE_CHANNEL`, `WORKSPACE_WRITE_STAGE_NAMES`, `WorkspacePersistenceErrorCode`, `WorkspaceUpdateSignal`, `workspaceUpdateSignalSchema`, `WorkspaceStorageArea`, `WorkspacePersistenceDeps`, `readWorkspaceState()`, `writeWorkspaceState()`, `subscribeToWorkspaceChanges()`"
  - "src/core/workspace/WriterElection.ts — `PRIMARY_RECORD_KEY`, `HEARTBEAT_MS`, `STALE_AFTER_MS`, `PrimaryRecord`, `primaryRecordSchema`, `WorkspaceElectionErrorCode`, `WorkspaceCoordinationState`, `ElectionOutcome`, `StillPrimaryResult`, `PrimaryRecordStorageArea`, `WriterElectionDeps`, `WriterElection`, `isStale()`, `createWriterElection()`"
  - "tests/core/workspace/WorkspacePersistence.test.ts (16 cases) and tests/core/workspace/WriterElection.test.ts (22 cases, incl. the no-debounce case)"
affects: [02-07, 02-08, 02-10, 02-11, 02-13, phase-08-memory, phase-09-notes]

# Actuals (#2632) — same estimateTokens scale as the plan's `estimate` (chars/4 over the realized diff)
actuals:
  tokens: 18285
  tasks: 2
  commits: 2
  plan_head_before: 7420922c177603cc12df5eb7d58f9c7b5846a164

tech-stack:
  added: []
  patterns:
    - "One adapter per key, chosen by the concurrency requirement: `np_workspace` goes through the debounced `chromeStorageAdapter` (correct for a store) while `np_workspace_primary` is read/written **directly** in `chrome.storage.session` (the only shape a read-back-verified CAS can take)"
    - "A write is authority only after a read-back: `elect()` claims primary only when the record that actually landed is this write, and an unverifiable read-back resolves the typed `ELECTION_TIMEOUT` error instead of a fabricated owner"
    - "Forward-only journaled writes: both steps' `rollback()` are no-ops and `runJournaled`'s terminal `rolled-back` is overridden to `applying`, so a retry with the same idempotency key resumes the entry instead of deleting a newer stored state"
    - "Two stage names pre-seeded as `pending` on the `update-workspace` entry (`write-np-workspace`, `emit-workspace-updated`) so a restart can tell 'the key was not written' from 'the signal was not emitted'"
    - "Narrow broadcast by construction: the payload is `{ workspaceId, conversationId }` under a `.strict()` schema, and the subscriber re-reads the key and applies last-write-wins by integer version — a whole `WorkspaceState` on the channel fails validation on receipt"
    - "The election's `secondaries` are the surfaces this instance observed live in the record (a fresh contender or an equal-epoch tie it contested), cleared when the record is absent or stale — the pinned record shape has no roster field, so the projection reports what was observed rather than inventing one"

key-files:
  created:
    - src/core/workspace/WorkspacePersistence.ts
    - src/core/workspace/WriterElection.ts
    - tests/core/workspace/WorkspacePersistence.test.ts
    - tests/core/workspace/WriterElection.test.ts
  modified:
    - tests/core/workspace/WorkspaceStore.test.ts

key-decisions:
  - "`np_workspace` is stored as a bare `JSON.stringify(state)` through the adapter, and read back through `migrateWorkspaceState` → `parseWorkspaceState`. The migration runs first because it is throw-free and total (D-11), so a corrupt blob resolves a safe schema-valid state rather than a typed failure — the plan's 'migrates to a schema-valid state rather than throwing' requirement — while an unreadable store and a non-schema-valid write both resolve typed failures."
  - "Version ordering is `incoming.version > stored.version` strictly, and an absent key accepts any version: 'a newer stored state' only exists when something is stored. A tie is resolved by the stored version, so the stored value stays byte-identical on every rejection (the lower-version case asserts the exact string)."
  - "The write path fails closed on an unreadable store (it never writes blind) and returns `WORKSPACE_READ_FAILED`; `readWorkspaceState` maps an absent key to `createInitialWorkspaceState()` while the internal reader keeps the absent/present distinction the version rule needs."
  - "The `update-workspace` journal entry id is `${workspaceId}:${version}` (§20.2's `workspaceId + version` key, with a separator so the two parts stay unambiguous) and its `targetIds` carry the workspace id only — never a state object (D2-21)."
  - "A failed step leaves the entry `applying` with the failing stage marked `failed` — 02-05's forward-only resumability precedent, applied here because the plan's acceptance requires a *non-terminal* entry after a failed storage write. `runJournaled`'s terminal `rolled-back` is deliberately overridden."
  - "`electedAt` doubles as the writer epoch (no extra field, so §15.1's record shape is preserved); `assertStillPrimary()` accepts only this identity with `electedAt <= lastRefresh`, which tolerates this writer's own heartbeat interleaving with an in-flight write (RESEARCH Pattern 6)."
  - "Conflict resolution is the deterministic key `(electedAt, surfacePriority, tabId)`: Standalone over Side Panel, then the lower tab id. An equal-epoch contest is the only way a surface takes the record from a fresh incumbent, and the loser's re-election returns secondary — never a second primary."
  - "The projection's `secondaries` come from the surfaces this instance has observed live (a fresh contender, or an equal-epoch tie it contested), and are cleared when the record is absent or stale. This is the only mechanism the pinned single-record shape allows; the two-surface harness (02-11) is the live-roster owner."
  - "The §C.2 `WORKSPACE_ELECTION_TIMEOUT` / `WORKSPACE_STORAGE_UNAVAILABLE` identifiers are log codes only; the payload vocabulary is §20.11's `ELECTION_TIMEOUT` / `STORAGE_UNAVAILABLE` verbatim, and the suite asserts the log code on the same path."

patterns-established:
  - "A CAS without an atomic primitive: read → validate freshness → write → read-back-verify, with the read-back being what turns a lost race into a typed outcome (T-02-30)."
  - "Staleness is time-bounded and exact: `now - electedAt > STALE_AFTER_MS` (strictly), asserted at the boundary in both directions; a stale record is superseded by any surface, and its identity is dropped from the observed set."
  - "No module-level mutable authority in the election: every piece of state (`outcome`, `lastRefresh`, `observed`, the timer handle) lives in the `createWriterElection` closure, and the durable authority is the session record itself."
  - "Test-side determinism: fake timers + `setSystemTime` for every liveness case, an injected Map-backed session area with a read counter and a `lostWrites` seam, and a source scan proving the module imports no storage adapter."

requirements-completed: [CORE-02]

coverage:
  - id: D1
    description: "WorkspacePersistence: `np_workspace` persists and reloads through the journaled, version-ordered path — §20.3's order (journal entry → key → signal → completed), strictly-greater integer version ordering with a byte-identical stored value on every rejection, tie resolved by the stored version, a schema-invalid stored value migrated without throwing, an unreadable store as a typed failure, and a narrow `{ workspaceId, conversationId }` signal under a strict schema"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/workspace/WorkspacePersistence.test.ts (16 passed)"
        status: pass
      - kind: integration
        ref: "npx vitest run tests/core/workspace (6 files / 125 tests, incl. the Phase-1 suites)"
        status: pass
    human_judgment: false
  - id: D2
    description: "WriterElection: exactly one primary writer per workspace — read-back-verified CAS over `chrome.storage.session`, `electedAt` as the epoch, 3 s heartbeat, two-missed-heartbeat staleness with the exact boundary, stale-writer rejection on a strictly newer `electedAt`, deterministic equal-epoch tie-break in the Standalone's favour, one-surface closure promoting the survivor, and the canonical §20.11 five-state projection"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/workspace/WriterElection.test.ts (22 passed)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The recorded divergence from CONTEXT's 'Reusable Assets' hint is proven, not asserted: no election write goes through the debounced adapter (the record is visible immediately with no timer advanced, and the adapter's pending map stays empty) and the module contains no adapter import"
    requirement: "CORE-02"
    verification:
      - kind: unit
        ref: "tests/core/workspace/WriterElection.test.ts — 'no debounce: the record is visible immediately with no timer advanced' and 'the module writes the session area directly and imports no storage adapter'"
        status: pass
    human_judgment: false
  - id: D4
    description: "Plan verification gate: both suites green together and in the workspace directory, no wave regression, and `tsc --noEmit` clean"
    requirement: "CORE-02"
    verification:
      - kind: integration
        ref: "npx tsc --noEmit (clean) && npx vitest run tests/core/storage tests/core/security tests/core/workspace tests/core/store tests/isolation (24 files / 396 tests) && npx vitest run (54 files / 768 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cross-plan contract: 02-07 feeds `coordinationState()` into the writer-state store and `MirrorBanner`; 02-11 drives both modules across simulated surfaces on the shared harness; 02-08 hydrates `np_workspace` through `readWorkspaceState()`"
    requirement: "CORE-02"
    verification: []
    human_judgment: true
    rationale: "A cross-plan consumer contract cannot be asserted from this plan's suites. A verifier should confirm 02-07 imports `createWriterElection`/`coordinationState` rather than restating the projection, that 02-11's harness uses these modules instead of duplicating election or persistence logic (D2-30), and that no successor plan re-implements the version rule or the CAS."
  - id: D6
    description: "D2-34 scope record: this plan covers the election cases Phase 2 acceptance requires; the complete four-surface matrix (two Side Panels plus two Standalones, every promotion permutation) is deferred as a later integration/release-hardening test requirement"
    requirement: "CORE-02"
    verification: []
    human_judgment: true
    rationale: "A deferral is a judgement call, not a test result. A verifier should confirm ROADMAP.md/REQUIREMENTS.md require no four-surface matrix for Phase 2 and that the deferral is recorded in the phase's deviations section (it is, below) so Phase 15's consolidated cycle or the release gate picks it up."

duration: 8 min
completed: 2026-09-24
status: complete
---

# Phase 2 Plan 06: Workspace Persistence and the Writer Election Summary

**`np_workspace` now persists across reload through a journaled, version-ordered write on the existing debounced adapter, and exactly one surface holds authority per workspace — a read-back-verified CAS on `chrome.storage.session` with a 3 s heartbeat, two-missed-heartbeat staleness, a Standalone tie-break and stale-writer rejection — proved by 38 cases including the no-debounce case that fails if the adapter is ever used for the election.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-09-24T00:21:03Z
- **Completed:** 2026-09-24T00:29:25Z
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified)

## Accomplishments

- **Durability with an order, not just a write.** Every `update-workspace` write creates its journal entry, writes the key, emits the narrow signal and only then marks the entry `completed` (§20.3 verbatim). A failed step leaves the entry `applying` with the failing stage visible, so the retry with the same `${workspaceId}:${version}` key resumes it — and both steps' rollbacks are deliberate no-ops, because deleting a newer stored state to "roll back" would lose data.
- **Ordering is the integer counter, never arrival order.** A write whose `version` is not strictly greater is rejected with the stored value byte-identical (asserted as an exact string comparison), a tie is resolved by the stored version, and two writes at the same `updatedAt` are ordered by `version` alone.
- **The channel carries two identifiers, never a state.** Appendix M.3's whole-state broadcast is superseded: the payload is `{ workspaceId, conversationId }` under a `.strict()` schema (the case asserts the exact key set and that nothing state-shaped is serialised), and the subscriber re-reads the key and applies last-write-wins by version — so a duplicate, stale or forged signal never moves the local copy. Broadcasting a whole `WorkspaceState` is asserted to be rejected.
- **The CAS is verified, not hoped for.** `elect()` reads, validates freshness, writes and reads back; authority is claimed only when the record that landed is this write with the exact epoch written. A lost write resolves `ELECTION_TIMEOUT` (with the §C.2 log code) rather than a fabricated primary or secondary, and a losing race returns secondary **without** overwriting the incumbent.
- **Liveness is exact and time-bounded.** Each heartbeat re-mints `electedAt` (strictly increasing, asserted), a record exactly two intervals old is still fresh and one millisecond more is stale, and a stale incumbent is superseded by any surface. The heartbeat is also the promotion path: a secondary keeps probing and takes over once the record goes stale.
- **Stale writers are rejected at the write gate.** `assertStillPrimary()` re-reads immediately before an authoritative write and rejects on an absent record, another identity, or a strictly newer `electedAt` under the same identity — and demotes to the mirror state instead of retrying. Both handoff clauses in the D2-34 list are driven at the election level: a failed handoff leaves the original writer passing the gate and the target failing it, and a successful handoff moves authority only after the source releases.
- **No regression, and the divergence is proven.** `tsc --noEmit` clean; the workspace directory at 6 files / 125 tests (Phase-1 suites included); the Phase 2 wave slice at 24 files / 396 tests; the full suite at 54 files / 768 tests. The election's no-debounce case reads the session map straight after `elect()` with fake timers installed and none advanced, and the module's source scan asserts no adapter import.

## Task Commits

Each task was committed atomically:

1. **Task 1: `WorkspacePersistence.ts` — journaled, version-ordered `np_workspace` writes** — `53a160bc` (feat)
2. **Task 2: `WriterElection.ts` — read-back-verified CAS, heartbeat, stale-writer rejection** — `dcde9a81` (feat)

**Plan metadata:** see the final `docs(02-06)` commit below

## Files Created/Modified

- `src/core/workspace/WorkspacePersistence.ts` — the key/channel constants, the two pre-seeded stage names, `readWorkspaceState()` (absent → initial state, invalid → migrated, unreadable → typed failure), `writeWorkspaceState()` (§20.3 order, strict version rule, fail-closed read, non-terminal failure override), `subscribeToWorkspaceChanges()` (strict payload, re-read, last-write-wins by version), and the `np_db` `entries` journal default.
- `src/core/workspace/WriterElection.ts` — the pinned constants and record schema, `isStale()`, the deterministic ordering key, `readRecord`/`writeRecord` against the injected session area, and `createWriterElection()` returning `elect()`/`startHeartbeat()`/`stop()`/`assertStillPrimary()`/`coordinationState()`.
- `tests/core/workspace/WorkspacePersistence.test.ts` — 16 cases: round trip through the debounced adapter with a flush and a reload, version monotonicity and the tie, equal-`updatedAt` last-write-wins, the completed and non-terminal journal entries, the production `np_db` journal seam, the exact payload key set, the strict-payload subscriber, and the migrated/unreadable/missing read paths.
- `tests/core/workspace/WriterElection.test.ts` — 22 cases: the pinned constants and the staleness boundary, initial assignment, the two-read CAS, the CAS conflict, the unverifiable read-back, the no-debounce case, unavailable storage, epoch generation, renewal and expiry, stale-writer rejection (newer epoch, changed identity, absent record), mirror-state activation, the Standalone tie-break, closure promotion, both handoff clauses, the five-state projection walk, and the module-hygiene source scan.
- `tests/core/workspace/WorkspaceStore.test.ts` — the Phase-1 workspace-key source guard now admits the two canonical §15.1 key literals (see Deviations).

## Decisions Made

- **Migration-first reads, typed failures only where they belong.** The read path runs the throw-free `migrateWorkspaceState` and re-validates with `parseWorkspaceState`, so a corrupt blob resolves a safe schema-valid state (the plan's requirement) while an unreadable store and an invalid *write* are typed failures. The internal reader keeps the absent/present distinction the version rule needs; the public reader maps absent to the initial state.
- **Strictly-greater version, and an absent key accepts anything.** "Not greater than the stored version" only has meaning when something is stored, so a first write at version 0 can land while a tie against a stored version is rejected. Every rejection leaves the stored string byte-identical.
- **Forward-only journaled write.** The `update-workspace` steps are idempotent upserts with no-op rollbacks, and a failure overrides `runJournaled`'s terminal `rolled-back` to `applying` — the 02-05 precedent, and what makes the plan's "a failed storage write leaves it non-terminal" true.
- **`electedAt` is the epoch, and `assertStillPrimary()` uses `<=`.** No extra record field (§15.1 preserved); the `record.electedAt <= lastRefresh` rule tolerates this writer's own heartbeat interleaving with an in-flight write, which RESEARCH Pattern 6 calls out explicitly.
- **Tie-break is `(electedAt, surfacePriority, tabId)`.** Standalone over Side Panel, then the lower tab id, so an equal-epoch contest has exactly one winner and the loser's next election returns secondary.
- **The projection's `secondaries` are observed, not registered.** The pinned record is a single record with no roster, so a surface reports the other surfaces it has seen live in the record (a fresh contender or an equal-epoch tie it contested) and clears them when the record is absent or stale. §20.11's `solo` is therefore what a genuinely lone survivor reports, and `primary` with secondaries is what a contested winner reports.
- **The §C.2 codes are log-only.** `WORKSPACE_ELECTION_TIMEOUT` / `WORKSPACE_STORAGE_UNAVAILABLE` never appear in a payload; the projection's vocabulary is §20.11's `ELECTION_TIMEOUT` / `STORAGE_UNAVAILABLE` verbatim.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The Phase-1 workspace-key source guard forbade the plan-mandated Phase 2 key literal**
- **Found during:** Task 2 (the WriterElection suite run)
- **Issue:** `tests/core/workspace/WorkspaceStore.test.ts` carries a Phase-1 guard — "no Phase-1 module names a workspace storage key for writing" — that scans every `.ts`/`.tsx` under `src/` for lines containing `np_workspace` and allows a line only when the literal is followed by a quote (`np_workspace'`) or the line matches `/legacy/i`. The plan mandates `PRIMARY_RECORD_KEY = 'np_workspace_primary'` in `src/core/workspace/WriterElection.ts`; `np_workspace_primary'` does not contain `np_workspace'`, so the guard failed on exactly that line. The guard is a Phase-1 artifact outside this plan's `files_modified`; the plan-mandated constant cannot be moved or renamed.
- **Fix:** the guard now accepts the two canonical §15.1 key literals via `/['"]np_workspace(_primary)?['"]/` — a quoted canonical constant — while an unquoted, ad-hoc or misspelled key name (`{ np_workspace: … }`, `np_workspace_state`) is still a violation. Recorded in `.planning/WINDOWS.md` (kind `deviation`) for phase-acceptance ratification, because it loosens a Phase-1 gate.
- **Files modified:** `tests/core/workspace/WorkspaceStore.test.ts` (8 lines: the predicate and its comment)
- **Verification:** `npx vitest run tests/core/workspace` → 6 files / 125 tests green, including the guard case; `npx tsc --noEmit` clean.
- **Committed in:** `dcde9a81` (part of Task 2's commit)

---

**Total deviations:** 1 auto-fixed (1 blocking Phase-1 gate conflict)
**Impact on plan:** Without it, the plan's own mandated constant could not coexist with the Phase-1 gate. The guard keeps its teeth (an ad-hoc or unquoted key name still fails); no other file outside `files_modified` was touched, and no production behaviour changed.

## Scope Deferral (D2-34, recorded per the plan's scope note)

The complete four-surface matrix — two Side Panels plus two Standalones with every promotion permutation — is deliberately **not** built here. `ROADMAP.md` and `REQUIREMENTS.md` require no such matrix for Phase 2, and D2-34 records it as a later integration/release-hardening test requirement. This plan covers the D2-34 case list that Phase 2 acceptance does require, and 02-11's two-surface harness is the integration owner; the four-surface matrix stays a Phase 15 / release-gate item.

## Issues Encountered

- **The storage seam's types had to match `StateStorage` exactly.** The first cut of `WorkspaceStorageArea` declared `getItem(): Promise<string | null>` and `setItem(): Promise<void>`; `chromeStorageAdapter` is a zustand `StateStorage`, whose `getItem` may return synchronously and whose `setItem` returns `unknown`. `tsc` caught both, and the interface now mirrors the contract (the module still `await`s every call). No behaviour change.
- **The `primary`-with-secondaries projection needed a mechanism the spec does not provide.** The pinned record is one record with no roster, so a winner can only name surfaces it has actually observed. The contested equal-epoch race (both surfaces electing at the same `electedAt`) is the case that produces it, and the projection clears observed surfaces when the record is absent or stale so a lone survivor reports `solo`. Documented in the module and the decisions above so 02-11 does not "fix" it into a registry.
- **One test-side bug, not a module bug.** The subscriber case's second write built a fresh `WorkspaceState` with a new random `workspaceId`, so the payload's workspace id no longer matched the re-read state and the delivery was (correctly) ignored; the case now reuses the stored workspace id.
- Pre-existing untracked planning artifacts (`.gsd/`, `.planning/milestone.lock`) were left untouched — outside this plan's scope.

## Known Stubs

None. Both modules are wired into the paths their suites exercise (including the production `np_db` journal default and the real `chrome.storage.session` mock), with no placeholder values, no TODO/FIXME markers, no skipped tests and no unrun verification.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: storage-write | `src/core/workspace/WorkspacePersistence.ts` | `np_workspace` now durably holds `WorkspaceState` in `chrome.storage.local` — §15.1's canonical home for it, and the first time this key is written. The strict `workspaceStateSchema` bounds every field and rejects credential-shaped values by construction, so no secret, message body or note content can reach the key; the journal entry carries the workspace id only. |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **02-07** consumes `createWriterElection({ surface, tabId })` and `coordinationState()` to drive the writer-state store and `MirrorBanner`: `solo`/`primary` → `primary`, `secondary` with `isMirroring` → `mirror`, `election-in-progress` → `election-pending`, `error` → `writer-unavailable`. `assertStillPrimary()` is the pre-write gate for any authoritative workspace write; `WorkspacePersistence.writeWorkspaceState()` is the write it guards.
- **02-08 / 02-10** hydrate and persist through `readWorkspaceState()` / `writeWorkspaceState()` — typed results, no throws, and a journal entry that is already resumable after a failure. `subscribeToWorkspaceChanges()` gives them the cross-surface propagation path with last-write-wins already applied.
- **02-11** drives both modules across the two simulated surfaces on the shared harness (D2-30) — the live-roster/secondaries question and the full handoff + election integration belong there, and no successor should duplicate the CAS, the version rule or the projection.
- **Phase 15 / the release gate** inherit the D2-34 four-surface matrix deferral recorded above.

---

*Phase: 02-storage-security-writejournal-workspace-persistence*
*Completed: 2026-09-24*

## Self-Check: PASSED

- All 4 created files exist on disk: `WorkspacePersistence.ts`, `WriterElection.ts` and their two suites (`WorkspaceStore.test.ts` is the one modified file).
- Both plan commits exist in history: `53a160bc` (Task 1), `dcde9a81` (Task 2).
- Measured commit count at SUMMARY write time (`git rev-list --count 7420922c..HEAD`): 2 task commits, base recorded as `plan_head_before`.
