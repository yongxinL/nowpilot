---
phase: 03a-agent-reliability-evidence
plan: 05
type: execute
wave: 5
depends_on:
  - 03a-04
files_modified:
  - tests/security/agent-harness.test.ts
  - package.json
autonomous: true
requirements:
  - AGT-01
  - AGT-02
  - AGT-03
  - AGT-04
  - TOL-03
user_setup: []
must_haves:
  truths:
    - "A dedicated security regression suite proves spoofing, tampering, repudiation, information-disclosure, denial-of-service, and elevation-of-privilege controls across the completed Phase 3a harness."
    - "The phase verification command names every Phase 3a test file explicitly, fails when any expected suite is missing or empty, and runs type checking as well as behavioral tests."
    - "No Phase 3a test or script claims persistent cross-turn replay safety, full ToolCapabilityManifest governance, active discovery, or other Phase 8a scope."
  artifacts:
    - path: "tests/security/agent-harness.test.ts"
      provides: "Phase 3a STRIDE regression fixtures for exact evidence association, immutable records, attribution/redaction, bounded loops, permission boundaries, and irreversible replay protection."
      exports: []
    - path: "package.json"
      provides: "verify:phase-3a script using the repository's pnpm/Vitest/TypeScript commands."
      exports: []
  key_links:
    - from: "tests/security/agent-harness.test.ts"
      to: "src/core/ai/AgentOrchestrator.ts"
      via: "Security fixtures exercise real public outcome, permission, abort, evidence, and rendering policy behavior"
    - from: "package.json"
      to: "tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts"
      via: "verify:phase-3a explicitly lists every expected Phase 3a test path"
---

<objective>
Close the phase with adversarial security regression coverage and a deterministic verification script. This plan owns no production runtime file and does not add new behavior; it proves the already-owned contracts are enforceable together and makes the Phase 3a gate runnable by a fresh executor.

The suite explicitly covers all six STRIDE categories, the mandatory permission/evidence/idempotency boundaries, and the Rev. C scope fence. The script follows the repository's package manager and the canonical spec's tsc-before-tests ordering.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md
@.planning/phases/03a-agent-reliability-evidence/03a-RESEARCH.md
@.planning/phases/03a-agent-reliability-evidence/03a-04-SUMMARY.md
@.planning/PRODUCT_SPEC_v0_1.md
@.planning/PRODUCT_REQUIREMENTS_AGENT_HARNESS.md
@package.json
@src/core/ai/AgentOrchestrator.ts
@src/core/ai/AgentTurnOutcome.ts
@src/core/ai/AgentTrajectoryMachine.ts
@src/core/ai/verifier/OutcomeVerifier.ts
@src/core/ai/ReplanPolicy.ts
@src/core/ai/RenderingOutcomePolicy.ts
@src/core/ai/ExecutorService.ts
@tests/core/ai/AgentOrchestrator.test.ts
@tests/core/ai/integration.test.ts
@tests/core/ai/tracer.test.ts
@tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts
@tests/core/ai/verifier/OutcomeVerifier.test.ts
@tests/core/ai/ReplanPolicy.test.ts
@tests/core/ai/ExecutorService.test.ts
@tests/core/ai/types.test.ts
@tests/core/context/ContextOptimizer.test.ts
@tests/core/context/ContextCompressor.test.ts
</context>

<tasks>
  <task type="auto" tdd="true">
    <name>Add Phase 3a STRIDE regression tests</name>
    <files>tests/security/agent-harness.test.ts</files>
    <behavior>
      - Evidence for one operation/toolCallId cannot validate or render a different operation/toolCallId; an invalid trajectory transition is rejected and returned as invalid_state_transition rather than silently continuing.
      - Trajectory/evidence/outcome snapshots cannot be changed through returned arrays; verifier output is schema-limited; renderer contradiction cannot upgrade terminalState or evidence.
      - Operation/tool-call IDs, timestamps, permission origin, and reason/error records are present while raw verifier output, raw idempotency keys, and secret-like values are absent from public diagnostics and recovery observations.
      - Planner/tool/replan caps, verifier timeout, callback isolation, duplicate suppression, permission denial/cancellation, and irreversible execution prevent unbounded work or privilege escalation.
    </behavior>
    <read_first>
      - tests/security/agent-harness.test.ts — create this file; no existing file is being replaced
      - tests/core/ai/AgentOrchestrator.test.ts — mock and input construction conventions
      - tests/core/ai/integration.test.ts — real orchestrator integration setup
      - src/core/ai/AgentOrchestrator.ts — public runTurn, permission callback, outcome diagnostics
      - src/core/ai/AgentTurnOutcome.ts — schema and readonly outcome contract
      - src/core/ai/AgentTrajectoryMachine.ts — transition and snapshot behavior
      - src/core/ai/verifier/OutcomeVerifier.ts — safe evidence behavior
      - src/core/ai/ReplanPolicy.ts — bounded disposition behavior
      - src/core/ai/RenderingOutcomePolicy.ts — contradiction fallback
      - src/core/ai/ExecutorService.ts — operation-scoped ledger behavior
      - .planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md — D-03, D-06, D-11, D-13, D-15, D-17
    </read_first>
    <action>
      Create a focused security suite using public APIs and deterministic fixtures. Cover each STRIDE category: spoofed evidence IDs and closed registry (Spoofing); frozen/readonly trajectory/evidence snapshots and renderer contradiction fallback (Tampering); operation/tool-call IDs, timestamps, permission origin, redacted diagnostics (Repudiation); absence of raw verifier output, secrets, and raw idempotency keys (Information disclosure); planner/tool/replan caps, verifier timeout, callback failure, duplicate suppression, and abort (Denial of service); executor-side metadata validation, permission-before-execution, denial not bypassed by replan, renderer cannot upgrade, and irreversible/unknown execution cannot replay (Elevation of privilege).

      Add explicit assertions that the phase does not expose a persistent ledger, cross-turn/restart replay claim, full ToolCapabilityManifest, active discovery, or long-running async operation contract. Keep security assertions independent of exact private helper names so later phases can extend the implementation without weakening these boundaries.
    </action>
    <verify>
      <automated>pnpm vitest run tests/security/agent-harness.test.ts</automated>
    </verify>
    <acceptance_criteria>
      - The suite contains at least one passing test for every STRIDE category and every mandatory security control listed in the phase prompt.
      - It executes real public outcome/policy behavior for privilege and false-completion cases rather than only asserting mock calls.
      - It contains no raw secret fixture that could be persisted and no vacuous test-name filter.
      - The named test file exists, executes tests, and exits 0.
    </acceptance_criteria>
    <done>Security regression coverage demonstrates that the completed Phase 3a harness cannot silently upgrade, replay, bypass, disclose, or run without bounds.</done>
  </task>

  <task type="auto">
    <name>Add and run the Phase 3a verification gate</name>
    <files>package.json</files>
    <read_first>
      - package.json — existing verify:phase-* script syntax and ordering
      - .planning/PRODUCT_SPEC_v0_1.md — §31.3 canonical verify:phase-3a requirement
      - .planning/phases/03a-agent-reliability-evidence/03a-VALIDATION.md — validation paths aligned to Plans 01-05
      - all Phase 3a test paths listed in this plan's context — verify every path exists before writing the script
    </read_first>
    <action>
      Add one `verify:phase-3a` package script using the existing pnpm project syntax. It must run `tsc --noEmit` first, then one explicit `vitest run` command listing these exact files: tests/core/ai/types.test.ts, tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts, tests/core/ai/ExecutorService.test.ts, tests/core/ai/verifier/OutcomeVerifier.test.ts, tests/core/ai/ReplanPolicy.test.ts, tests/core/ai/tracer.test.ts, tests/core/ai/AgentOrchestrator.test.ts, tests/core/ai/integration.test.ts, tests/core/context/ContextOptimizer.test.ts, tests/core/context/ContextCompressor.test.ts, and tests/security/agent-harness.test.ts. Do not use a test-name filter, directory glob, ignored fallback, or command that can pass when a listed file is absent.

      Run the script after editing and confirm all eleven suites execute and TypeScript passes. The script must not modify verify:all or claim that the phase implements Phase 8a persistence, manifest governance, discovery, or external permission storage.
    </action>
    <verify>
      <automated>pnpm run verify:phase-3a</automated>
    </verify>
    <acceptance_criteria>
      - package.json contains exactly one verify:phase-3a script with tsc-before-tests and all eleven explicit test paths.
      - `pnpm run verify:phase-3a` exits 0 and its output proves each named suite ran with at least one test.
      - The command fails if any named test path is removed or no test executes; no vacuous filter or suppressed failure is present.
    </acceptance_criteria>
    <done>Phase 3a has a reproducible green gate that validates all required behavior and security suites with the repository's actual scripts.</done>
  </task>
</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Untrusted input or authority | Control |
|---|---|---|
| Security fixture -> public API | Malformed IDs, callbacks, evidence, and permission decisions | Tests exercise schemas, state machine, orchestrator, verifier, policy, and executor together |
| Package script -> test suite | Missing/empty tests or shell fallback | Explicit file list, fail-fast command, tsc first, no filters or suppressed errors |
| Phase 3a -> future Phase 8a | Temptation to claim durable governance | Scope assertions explicitly reject persistence, manifest, discovery, and async-operation claims |

## STRIDE Register

| ID | Category | Threat | Control and automated test |
|---|---|---|---|
| T-03a-31 | Spoofing | Wrong tool or operation claims evidence | Exact ID association security fixture |
| T-03a-32 | Tampering | Mutable snapshots or renderer contradiction changes outcome | Frozen snapshot and fallback fixtures |
| T-03a-33 | Repudiation | Permission or terminal event lacks attribution | ID/timestamp/origin/diagnostic fixture |
| T-03a-34 | Information disclosure | Raw verifier output, secrets, or idempotency key leaks | Negative diagnostic/recovery-observation assertions |
| T-03a-35 | Denial of service | Unbounded callbacks, timeout, replay, or replan | Cap/timeout/abort/duplicate tests and explicit gate |
| T-03a-36 | Elevation of privilege | Denial bypass, false completion, or irreversible replay | Real orchestrator/executor security integration tests |
</threat_model>

<verification>
```bash
test -f tests/core/ai/types.test.ts
test -f tests/core/ai/trajectory/AgentTrajectoryMachine.test.ts
test -f tests/core/ai/ExecutorService.test.ts
test -f tests/core/ai/verifier/OutcomeVerifier.test.ts
test -f tests/core/ai/ReplanPolicy.test.ts
test -f tests/core/ai/tracer.test.ts
test -f tests/core/ai/AgentOrchestrator.test.ts
test -f tests/core/ai/integration.test.ts
test -f tests/core/context/ContextOptimizer.test.ts
test -f tests/core/context/ContextCompressor.test.ts
test -f tests/security/agent-harness.test.ts
pnpm run verify:phase-3a
```
</verification>

<success_criteria>
1. Every Phase 3a requirement has passing unit/integration/security evidence.
2. All STRIDE categories, permission paths, abort paths, cap flags, evidence mappings, rendering contradictions, replanning, and idempotency cases are covered.
3. `pnpm run verify:phase-3a` is explicit, non-vacuous, and green.
4. Phase 3a makes no Phase 8a durability, manifest, active-discovery, or long-running-operation claim.
</success_criteria>

<output>
Create `.planning/phases/03a-agent-reliability-evidence/03a-05-SUMMARY.md` with the phase gate result, test inventory, source coverage, and any residual downstream Phase 8a boundaries.
</output>
