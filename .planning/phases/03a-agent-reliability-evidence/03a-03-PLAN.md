---
phase: 03a-agent-reliability-evidence
plan: 03
type: execute
wave: 2
depends_on:
  - 03a-01
files_modified:
  - src/core/ai/ExecutorService.ts
  - tests/core/ai/verifier/OutcomeVerifier.test.ts
  - tests/core/ai/ReplanPolicy.test.ts
  - tests/core/ai/RenderingOutcomePolicy.test.ts
  - tests/core/ai/ExecutorService.test.ts
  - tests/core/ai/types.test.ts
autonomous: true
requirements:
  - TOL-03

must_haves:
  truths:
    - "TRUTH-12: ExecutorService.execute() for a tool with idempotency: 'required' derives a stable operation key from operationId + toolName + serialized(input) — per D-17"
    - "TRUTH-13: ExecutorService.execute() for a prior completed idempotent call returns the cached result and evidence without re-executing — duplicate detection works in-memory"
    - "TRUTH-14: ExecutorService.execute() for an in-flight or unresolved prior idempotent call throws IDEMPOTENCY_CONFLICT — duplicate execution is blocked"
    - "TRUTH-15: Idempotency ledger is operation-scoped — a fresh ExecutorService instance has an empty ledger (per D-17, in-memory only)"
  artifacts:
    - "Modified: src/core/ai/ExecutorService.ts (idempotency ledger)"
  key_links:
    - "ExecutorService.deriveOperationKey() → Map<string, IdempotencyEntry> — key uniqueness prevents false duplicate detection (RESEARCH.md Pitfall 2)"
---

<objective>
Add an operation-scoped idempotency ledger to ExecutorService and build the comprehensive unit test suite for all Phase 3a new modules. After this plan, tools with `idempotency: 'required'` are protected from duplicate execution within a turn, and every new module has passing unit tests.

Purpose: Prevent duplicate execution of irreversible/side-effecting tools when replanning or recovery might retry them.
Output: Idempotent ExecutorService, and passing unit tests for OutcomeVerifier, ReplanPolicy, RenderingOutcomePolicy, ExecutorService idempotency, and type schemas.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md
@.planning/phases/03a-agent-reliability-evidence/03a-RESEARCH.md
@src/core/ai/ExecutorService.ts
@src/core/ai/types.ts
@src/core/ai/AgentTurnOutcome.ts
@src/core/ai/PipelineError.ts
@tests/core/ai/ExecutorService.test.ts
</context>

<tasks>

<task type="auto">
  <name>Add idempotency ledger to ExecutorService</name>
  <files>src/core/ai/ExecutorService.ts</files>
  <read_first>
    - src/core/ai/ExecutorService.ts — existing `execute()` method (lines 54-97), `executeBatch()` (lines 99-114)
    - src/core/ai/types.ts — `RegisteredTool` with `idempotency?: ToolIdempotency` (from Plan 01), `ToolExecutionResult` with `toolCallId?`, `evidence?` fields
    - src/core/ai/PipelineError.ts — `PipelineError` constructor signature (code, message, diagnostic?)
    - RESEARCH.md Pattern 3 — full implementation code for `IdempotencyEntry`, `deriveOperationKey()`, ledger logic
    - CONTEXT.md D-17 — exact idempotency contract: in-memory, operation-scoped, duplicate completed returns cached result, in-flight/unresolved throws
  </read_first>
  <action>
    Modify `src/core/ai/ExecutorService.ts` to add idempotency support per RESEARCH.md Pattern 3:

    **1. Add `IdempotencyEntry` interface** at the top of the file (after imports, before the class):
    ```typescript
    interface IdempotencyEntry {
      status: 'in-flight' | 'completed' | 'failed';
      result?: unknown;
      evidence?: import('./AgentTurnOutcome').CompletionEvidence;
      executedAt: number;
    }
    ```

    **2. Add `idempotencyLedger` to ExecutorService class** as a private property:
    ```typescript
    private idempotencyLedger: Map<string, IdempotencyEntry> = new Map();
    ```
    - This is a plain `Map` — in-memory, operation-scoped. It resets when the service is re-instantiated (does NOT persist across SW restarts — per D-17).

    **3. Add `deriveOperationKey()` private method:**
    ```typescript
    private deriveOperationKey(operationId: string, toolName: string, input: unknown): string {
      const serialized = JSON.stringify(input, Object.keys(input as object).sort());
      return `${operationId}:${toolName}:${serialized}`;
    }
    ```
    - Sorted keys for deterministic serialization. Simple concatenation — cryptographic hash not needed (in-memory only).

    **4. Modify `execute()` method signature** — add optional `operationId?: string` parameter AFTER `signal` and BEFORE `timeoutMs`:
    ```typescript
    async execute(
      toolName: string,
      input: unknown,
      registeredTools: RegisteredTool[],
      signal?: AbortSignal,
      operationId?: string,        // NEW: for idempotency (per D-17)
      timeoutMs: number = DEFAULT_TIMEOUT_MS,
    ): Promise<ToolExecutionResult>
    ```
    - Keep backward compatibility: `operationId` defaults to undefined; when missing, idempotency is skipped entirely.

    **5. Add idempotency gate** — insert AFTER `validateToolInput()` returns the `tool` but BEFORE the execution try/catch:
    - `if (tool.idempotency === 'required' && operationId)`:
      - Derive key: `const key = this.deriveOperationKey(operationId, toolName, input);`
      - Check ledger: `const existing = this.idempotencyLedger.get(key);`
      - If `existing && existing.status === 'completed'`: return `{ toolName, output: existing.result, durationMs: 0, toolCallId: crypto.randomUUID(), evidence: existing.evidence } as ToolExecutionResult` — WITHOUT re-executing (per D-17)
      - If `existing && (existing.status === 'in-flight' || existing.status === 'failed')`: throw `new PipelineError('IDEMPOTENCY_CONFLICT', 'Tool "${toolName}" has an in-flight or unresolved prior execution.', { toolName, operationId, key })` — per D-17, do NOT re-execute
      - If no existing entry: `this.idempotencyLedger.set(key, { status: 'in-flight', executedAt: Date.now() });` — mark as in-flight before execution

    **6. Update ledger after execution:**
    - Inside the success path (after `const output = await Promise.race([...])`):
      - If `tool.idempotency === 'required' && operationId`: `this.idempotencyLedger.set(key, { status: 'completed', result: output, executedAt: Date.now() });`
    - Inside the catch path (after `const durationMs = performance.now() - startTime;`):
      - If `tool.idempotency === 'required' && operationId`: `this.idempotencyLedger.set(key, { status: 'failed', executedAt: Date.now() });` — mark as failed
    - Evidence can be set on the ledger entry later (Plan 02's orchestrator calls OutcomeVerifier after execute). For now, evidence is `undefined` on the ledger entry.

    **7. Update `executeBatch()`** — pass `operationId` through to each `execute()` call (each call gets the same operationId but different toolName+input → unique keys).

    **8. Add `IDEMPOTENCY_CONFLICT` to `PipelineErrorCode`** type in types.ts if not already present. This is NOT in the original PipelineErrorCode list from types.ts. Either:
    - Add `'IDEMPOTENCY_CONFLICT'` to the `PipelineErrorCode` type union in types.ts (preferred — clean), OR
    - Use an existing code like `'UNKNOWN'` with a diagnostic that includes `idempotencyConflict: true` (fallback)

    The IDEMPOTENCY_CONFLICT code should NOT be retryable — it's a terminal state for this specific tool call within this operation.

    **9. Ensure backward compatibility:**
    - Tools without `idempotency` field (default: `'not-required'`) are NOT affected — the idempotency gate is never entered
    - `operationId` is optional — when absent, idempotency is skipped
    - Existing callers that don't pass `operationId` continue to work unchanged
  </action>
  <verify>
    <automated>npx vitest run tests/core/ai/ExecutorService.test.ts -t "idempotency"</automated>
  </verify>
  <acceptance_criteria>
    - `ExecutorService` has private `idempotencyLedger: Map<string, IdempotencyEntry>` property
    - `execute()` accepts optional `operationId?: string` parameter (after `signal`, before `timeoutMs`)
    - `deriveOperationKey('op-1', 'save', { a: 1, b: 2 })` produces the same key as `deriveOperationKey('op-1', 'save', { b: 2, a: 1 })` (sorted keys are deterministic)
    - Tool with `idempotency: 'required'` and prior completed entry returns cached result WITHOUT calling `tool.execute()` — durationMs is 0
    - Tool with `idempotency: 'required'` and in-flight entry throws `PipelineError` with `IDEMPOTENCY_CONFLICT` code
    - Tool with `idempotency: 'not-required'` (or missing idempotency) executes normally with no ledger check
    - Tool without `operationId` parameter executes normally with no ledger check
    - Ledger entry transitions: in-flight (before execution) → completed/failed (after execution)
    - `executeBatch()` propagates `operationId` to each tool call
    - Existing ExecutorService tests still pass (backward compatibility)
    - `tsc --noEmit` passes
  </acceptance_criteria>
  <done>ExecutorService enforces idempotency for required tools: duplicate completed returns cached result, in-flight throws IDEMPOTENCY_CONFLICT, derivation key uses sorted deterministic serialization</done>
  <reversibility rating="costly">D-17 — adding persistence to the in-memory idempotency ledger changes the durability guarantee; until then, SW restart resets the ledger; the interface (operationId parameter) is an additive extension</reversibility>
</task>

<task type="auto">
  <name>Comprehensive unit test suite for all Phase 3a new modules</name>
  <files>tests/core/ai/verifier/OutcomeVerifier.test.ts, tests/core/ai/ReplanPolicy.test.ts, tests/core/ai/RenderingOutcomePolicy.test.ts, tests/core/ai/ExecutorService.test.ts, tests/core/ai/types.test.ts</files>
  <read_first>
    - tests/core/ai/ExecutorService.test.ts — existing test patterns, mock creation, describe/it/beforeEach structure
    - tests/core/ai/AgentOrchestrator.test.ts — existing mock patterns for services (vi.mock with module-level mocks)
    - src/core/ai/OutcomeVerifier.ts — `OutcomeVerifier` class and `outcomeVerifier` singleton
    - src/core/ai/ReplanPolicy.ts — `evaluateReplan()` function
    - src/core/ai/RenderingOutcomePolicy.ts — `buildRenderingOutcomePolicy()` function
    - src/core/ai/types.ts — all new types from Plan 01
    - src/core/ai/AgentTurnOutcome.ts — `AgentTurnOutcomeSchema`, `createAgentTurnOutcome`, `CompletionEvidence`
    - RESEARCH.md "Validation Architecture" section — test map for AGT-01 through TOL-03
    - vitest.config.ts — jsdom environment, globals enabled
  </read_first>
  <action>
    <!-- scope note: 5 test files are created together because test files are structurally uniform (same vitest patterns, same import structure, same mock conventions); grouping maximizes context reuse — the executor reads existing test patterns once and applies them consistently across all files -->
    Create/update the following test files. Each test file follows the existing vitest patterns: `describe/it/expect/vi` with `beforeEach(vi.clearAllMocks)`. Test files import from `../../../src/core/ai/...`.

    **1. Create `tests/core/ai/verifier/OutcomeVerifier.test.ts`:**
    - Test: "returns VerifiedCompletionEvidence for tool without evidence policy" — `tool.evidence` is undefined, verify evidence.verified === true
    - Test: "returns VerifiedCompletionEvidence for tool with evidence.required: false" — verify skips checks, returns verified:true
    - Test: "calls schema verifier for tool with evidence.required: true and verifier: 'schema'" — verify schemaVerifier was invoked
    - Test: "returns UnverifiedCompletionEvidence on verification timeout" — mock a slow verifier, verify failureReason is 'verification_timeout'
    - Test: "returns UnverifiedCompletionEvidence on AbortSignal" — abort signal during verification
    - Test: "includes operationId and toolName in evidence" — verify evidence fields
    - Test: "generates unique id per call" — call verify twice, compare evidence.id values
    - Test: "defaults verifier type to 'schema' when policy.verifier is undefined"
    - Use `describe` blocks for organization. Create mock `RegisteredTool` objects inline with varying evidence policies. Use `vi.fn()` for mock verifier functions.

    **2. Create `tests/core/ai/ReplanPolicy.test.ts`:**
    - Test: "abort → terminate" — isAborted: true returns 'terminate' regardless of other context
    - Test: "irreversible tool → terminate" — sideEffect: 'irreversible' returns 'terminate' even on success
    - Test: "successful read tool → continue-planning" — sideEffect: 'read', success: true
    - Test: "failed retryable error → replan (first time)" — replanCount: 0, error.retryable: true
    - Test: "failed retryable error → render (second time)" — replanCount: 1, error.retryable: true
    - Test: "terminal error → render" — error.category: 'terminal'
    - Test: "SCHEMA_INVALID error → render" — specific error code check
    - Test: "NO_SUCH_TOOL error → render" — specific error code check
    - Test: "INVALID_TOOL_INPUT error → render" — specific error code check
    - Test: "planner cap reached → render" — caps.plannerCapReached: true
    - Test: "default → render" — no matching rule
    - Test: "pure function — same input produces same output" — call twice, verify identical
    - Create factory function `makeReplanContext(overrides)` that returns a valid `ReplanContext` with sensible defaults, then override specific fields per test.

    **3. Create `tests/core/ai/RenderingOutcomePolicy.test.ts`:**
    - Test: "empty evidence → canClaimWriteSuccess: false"
    - Test: "all verified → canClaimWriteSuccess: true" — verify evidenceSummary mentions "verified"
    - Test: "mixed verified and unverified → canClaimWriteSuccess: false" — verify evidenceSummary includes "could not be verified"
    - Test: "all unverified → canClaimWriteSuccess: false"
    - Test: "evidenceSummary does not claim write success when unverified" — string assertions
    - Import `buildRenderingOutcomePolicy` and create `VerifiedCompletionEvidence`/`UnverifiedCompletionEvidence` test fixtures.

    **4. Update `tests/core/ai/ExecutorService.test.ts`** — add idempotency test block:
    - Test: "idempotency: required — duplicate completed call returns cached result" — execute once, execute again with same operationId/tool/input, verify second call returns cached output without calling tool.execute second time
    - Test: "idempotency: required — in-flight call blocks duplicate" — first call in progress (don't await), attempt second call with same key, verify IDEMPOTENCY_CONFLICT thrown
    - Test: "idempotency: required — failed call can be retried" — first call fails, ledger entry status='failed', second call with same key throws IDEMPOTENCY_CONFLICT (per D-17, failed with unknown final state is blocked)
    - Test: "idempotency: not-required — no ledger check" — execute twice, verify tool.execute() called twice
    - Test: "idempotency: missing operationId — no ledger check" — execute without operationId, verify no conflict
    - Test: "deriveOperationKey deterministic — sorted input keys" — call with {b:2, a:1} and {a:1, b:2}, verify same key
    - Test: "deriveOperationKey unique — different inputs produce different keys" — call with two different inputs, verify keys differ
    - Use existing test patterns. Create mock tools with `idempotency: 'required'` and `idempotency: 'not-required'`. Use separate `ExecutorService` instances per test or per describe block to ensure ledger isolation.

    **5. Create `tests/core/ai/types.test.ts`:**
    - Test: "AgentTurnOutcomeSchema validates a well-formed outcome" — use `createAgentTurnOutcome()` factory
    - Test: "AgentTurnOutcomeSchema rejects outcome with missing required field" — omit `operationId`
    - Test: "AgentTurnOutcomeSchema rejects invalid terminalState" — use 'unknown-state'
    - Test: "CompletionEvidence discriminated union — verified variant" — `CompletionEvidenceSchema.parse({verified: true, verifierType: 'schema', checks: [], ...})`
    - Test: "CompletionEvidence discriminated union — unverified variant" — `CompletionEvidenceSchema.parse({verified: false, failureReason: 'verification_error', retryable: false, ...})`
    - Test: "ALLOWED_TRANSITIONS has correct structure" — check all 10 states are present, terminal states have empty sets
    - Test: "ALLOWED_TRANSITIONS from assembling-context includes planning, failed, aborted" — set membership check
    - Create Zod schemas inline for this test file, or import `AgentTurnOutcomeSchema` from AgentTurnOutcome.ts. Test that existing type exports are correct.

    ALL tests must pass. Use `npx vitest run` for each file individually in development, and the full suite command for verification.
  </action>
  <verify>
    <automated>npx vitest run tests/core/ai/verifier/OutcomeVerifier.test.ts tests/core/ai/ReplanPolicy.test.ts tests/core/ai/RenderingOutcomePolicy.test.ts tests/core/ai/ExecutorService.test.ts tests/core/ai/types.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `tests/core/ai/verifier/OutcomeVerifier.test.ts` — ≥8 test cases, all passing
    - `tests/core/ai/ReplanPolicy.test.ts` — ≥12 test cases covering all disposition outcomes and edge cases, all passing
    - `tests/core/ai/RenderingOutcomePolicy.test.ts` — ≥5 test cases covering empty/verified/mixed/unverified evidence, all passing
    - `tests/core/ai/ExecutorService.test.ts` — existing tests still pass + ≥7 new idempotency tests, all passing
    - `tests/core/ai/types.test.ts` — ≥5 test cases for Zod schema validation and type const correctness, all passing
    - `npx vitest run` on all 5 test files exits 0
    - No test has side effects or leaves shared state (ledger isolated per test)
  </acceptance_criteria>
  <done>All 5 test files pass: OutcomeVerifier (>=8 tests), ReplanPolicy (>=12 tests), RenderingOutcomePolicy (>=5 tests), ExecutorService idempotency (>=7 tests), types Zod validation (>=5 tests)</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Tool input → ExecutorService | Serialized input used as idempotency key component; must be deterministic |
| Idempotency ledger (in-memory) | Operation-scoped Map; ledger resets on SW restart (acceptable per D-17) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-03a-10 | Tampering | ExecutorService idempotency key derivation | medium | mitigate | Key uses `JSON.stringify` with sorted `Object.keys()` for deterministic serialization; `operationId` is `crypto.randomUUID()` per turn guaranteeing uniqueness namespace; key collisions are cryptographically infeasible (RESEARCH.md Pitfall 2 verified) |
| T-03a-11 | Denial of Service | Idempotency ledger growth | low | accept | Ledger entries are operation-scoped (cleared on SW restart); map entries are small strings; growth is bounded by number of tool calls per SW session — not expected to exceed hundreds |
</threat_model>

<verification>
## Plan Verification

```bash
# Full unit test suite for all new Phase 3a modules
npx vitest run tests/core/ai/verifier/OutcomeVerifier.test.ts tests/core/ai/ReplanPolicy.test.ts tests/core/ai/RenderingOutcomePolicy.test.ts tests/core/ai/ExecutorService.test.ts tests/core/ai/types.test.ts

# Existing tests still pass (regression)
npx vitest run tests/core/ai/trajectory/tracer.test.ts tests/core/ai/AgentOrchestrator.test.ts tests/core/ai/integration.test.ts

# Type check
npx tsc --noEmit
```
</verification>

<success_criteria>
1. ExecutorService enforces idempotency for `idempotency: 'required'` tools — duplicate completed returns cached, in-flight throws conflict
2. All 5 new/updated test files pass: `npx vitest run` exits 0 on the full suite
3. Existing tests still pass (no regression from adding `operationId` parameter)
4. `tsc --noEmit` passes with zero errors
5. Test coverage for all new modules: OutcomeVerifier, ReplanPolicy, RenderingOutcomePolicy, idempotency, type schemas
</success_criteria>

<output>
Create `.planning/phases/03a-agent-reliability-evidence/03a-03-SUMMARY.md` when done
</output>
