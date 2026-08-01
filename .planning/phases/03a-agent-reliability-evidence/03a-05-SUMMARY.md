---
phase: 03a-agent-reliability-evidence
plan: 05
subsystem: testing
tags: [security, stride, regression, vitest, phase-gate, typescript, idb]

# Dependency graph
requires:
  - phase: 03a-agent-reliability-evidence
    provides: Plans 01–04 contracts now under adversarial regression — trajectory state machine, immutable AgentTurnOutcome, OutcomeVerifier evidence, ReplanPolicy dispositions, permission gate, abort propagation through ContextCompressor
provides:
  - Phase 3a STRIDE security regression suite (34 tests) proving the completed harness cannot silently upgrade, replay, bypass, disclose, or run without bounds
  - Deterministic `verify:phase-3a` gate: tsc-first, eleven explicit test paths, non-vacuous (a removed/missing path fails the command), currently green (11 suites, 209 tests, exit 0)
  - Repaired repo-wide `tsc --noEmit` baseline (9 pre-existing src/core/storage errors fixed type-level) — `pnpm lint` and every `verify:phase-*` script now reach their test stage
  - Explicit Phase 8a scope fence assertions (no manifest/discovery/persistence/async-operation surface; ledger in-memory and operation-scoped)
affects: [06-telemetry, 07-rich-ux, 08a-tool-governance, ship/verification]

# Tech tracking
tech-stack:
  added: [] # no new dependencies
  patterns:
    - "Security regression discipline: STRIDE-category describe blocks asserting public contracts (outcomes, policies, errors) — never private helper names — so later phases can extend implementations without weakening the bounds"
    - "Non-vacuous phase gate: tsc --noEmit before one explicit vitest run naming every expected suite; no directory globs, no test-name filters, no suppressed failures"

key-files:
  created:
    - tests/security/agent-harness.test.ts
  modified:
    - package.json
    - src/core/storage/ApiKeyStore.ts
    - src/core/storage/CryptoService.ts
    - src/core/storage/MigrationRunner.ts
    - src/core/storage/WriteJournal.ts
    - .planning/phases/03a-agent-reliability-evidence/deferred-items.md

key-decisions:
  - "verify:phase-3a lists all eleven Phase 3a test paths explicitly with tsc first; vitest exits 1 on a missing path, so the gate cannot pass vacuously (verified experimentally)"
  - "Rule 3 deviation: the plan's acceptance criterion 'pnpm run verify:phase-3a exits 0' is unattainable while tsc fails repo-wide on the 9 pre-existing src/core/storage errors, and the plan forbids tolerating tsc failures; repaired the baseline with type-level changes only (zero runtime behavior change, 43/43 storage tests still green)"
  - "Task 1's tdd marker is satisfied by the adversarial regression role of the suite: it verifies behavior already shipped by Plans 01–04, so no RED→GREEN production cycle applies (plan owns no production file; tdd_mode false) — committed as one test commit"

patterns-established:
  - "STRIDE register → test fixture traceability: each threat ID (T-03a-31..36) has a named describe block with at least one real-behavior test (real AgentTrajectoryMachine, RenderingOutcomePolicy, OutcomeVerifier, ExecutorService, ReplanPolicy; orchestrator behind mocked provider/planner/renderer)"
  - "Phase 8a fence as test assertions: absence of manifest/discovery/persistence exports, restart and cross-operation re-execution, no persistence API on the executor surface"

requirements-completed: [AGT-01, AGT-02, AGT-03, AGT-04, TOL-03]

coverage:
  - id: D1
    description: "Phase 3a STRIDE regression suite — spoofing (exact operationId/toolCallId evidence association, closed registry, AGENT_STATE_INVALID rejection, spoofed attachEvidence), tampering (immutable snapshots, terminal protection, schema-limited verifier output, renderer contradiction cannot upgrade outcome/evidence, aborted-answer schema), repudiation (attributable IDs/timestamps/origin, redacted recovery observations, code-only diagnostics), information disclosure (secrets/raw output/ledger keys absent from evidence, diagnostics, observations), denial of service (cap-bounded loop, verifier timeout, observer isolation, duplicate suppression, abort), elevation of privilege (closed-registry validation, permission-before-execution, denial-without-replan, irreversible/unknown replay refusal), and the Phase 8a scope fence"
    requirement: AGT-01
    verification:
      - kind: unit
        ref: "tests/security/agent-harness.test.ts (34 tests, all STRIDE describe blocks + Phase 8a fence)"
        status: pass
    human_judgment: false
  - id: D2
    description: "verify:phase-3a gate — tsc --noEmit first, then one explicit vitest run over all eleven Phase 3a test paths; fails on a missing path; currently green with all eleven suites executing at least one test"
    requirement: AGT-02
    verification:
      - kind: manual_procedural
        ref: "pnpm run verify:phase-3a → 11 suites, 209 tests passed, exit 0 (tsc clean)"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-08-01
status: complete
---

# Phase 03a Plan 05: Security Regression & Phase Gate Summary

**Adversarial STRIDE regression suite (34 tests across all six threat categories plus the Phase 8a scope fence) proving the completed Phase 3a harness cannot silently upgrade, replay, bypass, disclose, or run without bounds, together with a deterministic `verify:phase-3a` gate — tsc-first, eleven explicit test paths, non-vacuous, and green (11 suites, 209 tests, exit 0) after a type-level repair of the pre-existing `src/core/storage` tsc baseline that blocked every `tsc --noEmit` in the repository.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-01T00:39:51Z
- **Completed:** 2026-08-01T00:47:01Z
- **Tasks:** 2
- **Files modified:** 7 (1 test suite created, 5 source/config modified, 1 planning log updated)

## Accomplishments

- **STRIDE regression suite** (`tests/security/agent-harness.test.ts`, 34 tests): every mandatory security control has at least one passing fixture against real public behavior. Spoofing: evidence for a foreign operationId/toolCallId can never validate or render a write (policy-level `verifiedCompletionAllowed: false` + orchestrator contradiction fallback), spoofed `attachEvidence` throws `TOOL_POSTCONDITION_FAILED` without overwriting cached evidence, invalid trajectory transitions throw `AGENT_STATE_INVALID` without silently continuing, and the closed registry rejects tool schemas missing reliability metadata with `SCHEMA_INVALID` before any execution. Tampering: trajectory history snapshots are immutable (mutation cannot corrupt machine state), terminal states reject further transitions, verifier output is schema-limited (unrestricted raw fields → `verification_error`), a renderer contradiction is replaced by the policy fallback and can never upgrade terminalState or evidence, and the outcome schema rejects an aborted outcome carrying a rendered answer. Repudiation: outcomes carry attributable operationId, timestamps, reason codes, and permission origins (`user_aborted`/`caller_aborted`), recovery observations are allowlisted to `{toolName, executionStatus, errorCode}` with no input/output/ledger-key material, and diagnostics carry closed error codes only. Information disclosure: secret-like check fields and raw tool output are discarded from every evidence variant, conflict errors never expose the logical key. Denial of service: the planner/tool caps bound the loop (`toolCapReached` partial, plannerCalls ≤ plannerCap), verifier timeout yields `verification_timeout` with retry permission, observer callback explosions are isolated, completed idempotent duplicates never re-execute, and aborts stop the turn before/at the permission gate. Elevation of privilege: executor-side name/input validation (`NO_SUCH_TOOL`/`INVALID_TOOL_INPUT`), permission enforced before execution with denial never bypassed by replan, irreversible failures terminate in both the pure `evaluateReplan` and the real orchestrator, and unknown-state executions are never re-executed.
- **Phase 8a scope fence** (must-have truth 3): the suite asserts the phase exposes no `ToolCapabilityManifest`/discovery/persistence/async-operation surface, the executor has no persistence API, and the idempotency ledger is operation-scoped and in-memory — a fresh service and a new operation both re-execute (no durable cross-turn replay claim).
- **`verify:phase-3a` gate** (`package.json`): `tsc --noEmit && vitest run <eleven explicit paths>` — tsc first per the canonical spec's ordering, one fail-fast vitest command, no filters/globs/fallbacks. A missing path makes vitest exit 1 ("No test files found") — verified experimentally, so the gate cannot pass vacuously. Runs green: 11 suites, 209 tests, exit 0.
- **Repo-wide tsc repair** (Rule 3 deviation): the 9 pre-existing `src/core/storage` tsc errors that made `tsc --noEmit` fail for every `verify:phase-*` script and `pnpm lint` were repaired type-level so the gate's exit-0 criterion is honest. `pnpm lint` is now clean; all 43 storage tests still pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Phase 3a STRIDE regression tests** - `572090e` (test)
2. **Task 2: Add and run the Phase 3a verification gate** - `11d18f6` (fix, includes the Rule 3 tsc-baseline repair and gate-surfaced test-file type fixes)

**Plan metadata:** pending (docs commit follows this summary)

**TDD gate note:** Task 1 carries `tdd="true"`, but the plan owns no production file and the suite verifies behavior already shipped by Plans 01–04 — there is no RED→GREEN production cycle to run (the plan frontmatter is `type: execute`, `workflow.tdd_mode` is false, and the acceptance criteria demand a passing suite, not a failing-first cycle). The suite's first run was 32/34 green; the 2 failures were test-authoring mismatches (zod `parse` identity vs deep equality; a required-idempotency call missing its operationId), corrected to match the verified contracts. The suite is committed as a single `test(...)` commit; a `test-only` plan produces no GREEN commit by design.

## Self-Check: PASSED

- All key files exist on disk: `tests/security/agent-harness.test.ts`, `package.json` (verified with `[ -f ]`).
- Task commits present in git log: `572090e`, `11d18f6`.
- Plan `<verification>` re-run: all 11 listed test paths exist and `pnpm run verify:phase-3a` → tsc clean, 11 suites, 209 tests, exit 0.
- Behavioral regression on the touched storage files: `pnpm vitest run tests/core/storage` → 5 suites, 43 tests, exit 0.
- Acceptance criteria: Task 1 — one passing test per STRIDE category and mandatory control ✓, real public outcome/policy behavior for privilege and false-completion cases ✓ (real machine/policies/verifier/executor + orchestrator with real verifier and real `enforceRenderingOutcomePolicy`), no raw secret fixture persisted, no vacuous filter, file executes and exits 0 ✓. Task 2 — exactly one `verify:phase-3a` script with tsc-before-tests and all eleven explicit paths ✓, exits 0 with per-suite test proof ✓, fails on removed path (verified: exit 1) ✓.

## Files Created/Modified

- `tests/security/agent-harness.test.ts` (created) - 34-test STRIDE regression suite: Spoofing (5), Tampering (6), Repudiation (6), Information disclosure (3), Denial of service (6), Elevation of privilege (5), Phase 8a scope fence (3); module mocks preserve the real `ExecutorService` class via `vi.importActual` while mocking the orchestrator's singletons
- `package.json` (modified) - `verify:phase-3a` script (tsc-first, eleven explicit paths)
- `src/core/storage/ApiKeyStore.ts` (modified) - `arrayBufferToBase64` accepts `ArrayBuffer | Uint8Array<ArrayBufferLike>` (fixes the salt/iv Uint8Array tsc errors; runtime behavior identical)
- `src/core/storage/CryptoService.ts` (modified) - explicit `ArrayBuffer` casts in the cross-realm ciphertext normalization (fixes TS2352/TS2345; runtime behavior identical)
- `src/core/storage/MigrationRunner.ts` (modified) - upgrade-callback helpers typed with `IDBPTransaction<unknown, string[], 'versionchange'>` so `createIndex`/`put` resolve as callable and `getAll()` returns an iterable; replaces an `as any` cast (runtime behavior identical)
- `src/core/storage/WriteJournal.ts` (modified) - fetched entries annotated `WriteJournalEntry` (fixes implicit-any `.find` params; runtime behavior identical)
- `.planning/phases/03a-agent-reliability-evidence/deferred-items.md` (modified) - tsc baseline item marked resolved

## Decisions Made

- **Explicit-path gate over directory globs**: `verify:phase-3a` names every suite (mirroring `verify:phase-1`/`phase-2` style but fully enumerating Phase 3a's files); vitest's "No test files found" failure on any missing path keeps the gate honest, matching the plan's threat-model requirement (fail-fast, no filters, no suppressed errors).
- **Repair the tsc baseline rather than weaken the script**: the plan forbids a command that can pass with tsc failing, so the only route to a green gate was fixing the 9 pre-existing errors. All fixes are type-level with zero runtime behavior change (43/43 storage tests green), and the deferred item is now marked resolved.
- **Security fixtures prefer real services**: privilege and false-completion cases run the real `ExecutorService`, `OutcomeVerifier`, `AgentTrajectoryMachine`, `RenderingOutcomePolicy`, and `ReplanPolicy`; the orchestrator cases mock only the LLM-facing singletons (provider router, planner, renderer, executor module) and still exercise the real verifier, the real `enforceRenderingOutcomePolicy`, and the real permission gate.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Repaired the pre-existing `src/core/storage` tsc baseline**
- **Found during:** Task 2 (verify:phase-3a gate run)
- **Issue:** The plan's acceptance criterion requires `pnpm run verify:phase-3a` to exit 0, but `tsc --noEmit` failed repo-wide on the 9 documented pre-existing errors in `ApiKeyStore.ts`, `CryptoService.ts`, `MigrationRunner.ts`, and `WriteJournal.ts` (newer `@types/node` generics: `Uint8Array<ArrayBufferLike>`, `IDBPTransaction` vs `IDBTransaction`). The plan's own threat model forbids tolerating or suppressing the tsc failure, so no script-only workaround was legal.
- **Fix:** Type-level repairs only, zero runtime behavior change: base64 helper accepts `Uint8Array`; explicit `ArrayBuffer` casts in CryptoService; `IDBPTransaction<unknown, string[], 'versionchange'>` parameter types in MigrationRunner (making `createIndex`/`put` resolve and `getAll()` iterable, replacing an `as any` cast); explicit `WriteJournalEntry` annotations on fetched entries in WriteJournal.
- **Files modified:** src/core/storage/ApiKeyStore.ts, src/core/storage/CryptoService.ts, src/core/storage/MigrationRunner.ts, src/core/storage/WriteJournal.ts
- **Verification:** `tsc --noEmit` clean; `pnpm vitest run tests/core/storage` → 43 tests pass; `pnpm run verify:phase-3a` → exit 0; deferred-items.md updated to `resolved`.
- **Committed in:** 11d18f6 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed three tsc type errors in the new security suite**
- **Found during:** Task 2 (gate run surfaced them — the suite itself passed at runtime in Task 1)
- **Issue:** `WRITE_TOOL.evidence` possibly-undefined (optional field on `ToolSchemaInfo`) used to build `IRREVERSIBLE_TOOL` and the disclosure fixture; `realTool`'s zod `inputSchema` not assignable to `Record<string, unknown>`; an unused `z` import after the schema change.
- **Fix:** Extracted a standalone `WRITE_VERIFIER` fixture shared by `WRITE_TOOL` and `IRREVERSIBLE_TOOL`; `realTool` now uses a plain JSON schema (which `ExecutorService` wraps in `z.object({}).passthrough()`, preserving the INVALID_TOOL_INPUT behavior for non-object input); removed the unused import.
- **Files modified:** tests/security/agent-harness.test.ts
- **Verification:** 34/34 tests pass; tsc clean.
- **Committed in:** 11d18f6 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were required for the plan's core deliverable — a green, non-vacuous phase gate. The storage repair was out of the plan's nominal file scope but is the only legal route to the exit-0 criterion; it is strictly type-level and behavior-preserving. No scope creep beyond that.

## Issues Encountered

- **Pre-existing tsc baseline vs. green-gate criterion** (see Deviation 1): the single structural obstacle of the plan. Resolved by type-level repair; the deferred item is now `resolved`.
- **TDD marker on a test-only task** (see TDD gate note under Task Commits): no RED→GREEN cycle exists for a suite that verifies already-shipped behavior; documented rather than faked (no artificial failing commit was created).
- **Out-of-scope, still open (pre-existing, logged in deferred-items.md, not part of the gate):** 2 failing `StreamAdapter.test.ts` tests, 4 failing `ProviderAdapter.test.ts` tests, and `PlannerService` passing `signal` (not `abortSignal`) to `generateText` — none of these files are in the `verify:phase-3a` path list.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Phase 3a gate is reproducible and green**: any fresh executor can run `pnpm run verify:phase-3a` and get the full evidence set — contracts (types), state machine + executor, verifier, replan policy, tracer, orchestrator, integration, context optimizer, context compressor, and the STRIDE security suite — 209 tests, tsc-clean.
- **Repo-wide tsc is now clean**: `pnpm lint` and every other `verify:phase-*` script reach their test stage, which removes a latent blocker for later phases and the ship gate.
- **Residual Phase 8a boundaries** (documented and asserted, not implemented): durable cross-turn/restart idempotency, full `ToolCapabilityManifest` governance, active discovery, and long-running async operation contracts remain Phase 8a; the security suite fences them explicitly so a future phase cannot claim them silently.
- The three still-open deferred items (StreamAdapter, ProviderAdapter, PlannerService `signal`) should be addressed by the phases that own those files.

---
*Phase: 03a-agent-reliability-evidence*
*Completed: 2026-08-01*
