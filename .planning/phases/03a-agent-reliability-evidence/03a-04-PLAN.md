---
phase: 03a-agent-reliability-evidence
plan: 04
type: execute
wave: 4
depends_on:
  - 03a-03
files_modified:
  - src/core/context/ContextCompressor.ts
  - tests/core/context/ContextCompressor.test.ts
autonomous: true
requirements:
  - AGT-03
user_setup: []
must_haves:
  truths:
    - "ContextOptimizer's nested compression operation receives the same AbortSignal, passes it to the optional AI summarization request, and does not swallow an abort as an ordinary compression failure."
    - "Abort during local degradation or AI summarization stops further pipeline work and is observable by the orchestrator as an abort rather than CONTEXT_TOO_LARGE or a successful optimization."
    - "Compression behavior, step ordering, and graceful non-abort failure handling remain unchanged when the signal is not aborted."
  artifacts:
    - path: "src/core/context/ContextCompressor.ts"
      provides: "Abort-aware compress and tryAiSummarization signatures with signal propagation to provider selection and generateText."
      exports: ["ContextCompressor", "contextCompressor"]
    - path: "tests/core/context/ContextCompressor.test.ts"
      provides: "Abort and regression fixtures for nested context compression."
      exports: []
  key_links:
    - from: "src/core/context/ContextOptimizer.ts"
      to: "src/core/context/ContextCompressor.ts"
      via: "optimize passes its ContextOptimizerInput.abortSignal into compress and checks it before and after the await"
     - from: "src/core/context/ContextCompressor.ts"
       to: "ai generateText"
       via: "tryAiSummarization passes the same AbortSignal and rethrows AbortError instead of converting cancellation to an ordinary compression miss"
---

<objective>
Complete abort propagation through the only nested asynchronous context stage that remains after Plan 03. This plan owns the existing ContextCompressor and its focused unit test so the central orchestrator plan remains within the cost-effective file limit.

This is still AGT-03 bounded cancellation, not a second optimization feature: preserve the existing seven-step degradation policy and one summarization call while ensuring cancellation is explicit and cannot be misreported as a normal failed compression.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md
@.planning/phases/03a-agent-reliability-evidence/03a-03-SUMMARY.md
@src/core/context/ContextOptimizer.ts
@src/core/context/ContextCompressor.ts
@src/core/ai/types.ts
@tests/core/context/ContextOptimizer.test.ts
</context>

<tasks>
  <task type="auto" tdd="true">
    <name>Propagate AbortSignal through context compression</name>
    <files>src/core/context/ContextCompressor.ts, tests/core/context/ContextCompressor.test.ts</files>
    <behavior>
      - `compress(..., signal)` checks the signal before every degradation step and before/after AI summarization; an abort rejects with the original abort error.
      - The compression-model provider callback and `generateText` receive the same signal; an abort is not converted into a swallowed warning or CONTEXT_TOO_LARGE result.
      - Non-aborted local degradation and summarization failure retain the existing output and step-order behavior.
    </behavior>
    <read_first>
      - src/core/context/ContextCompressor.ts — current compress, tryAiSummarization, seven-step loop, and catch blocks
      - src/core/context/ContextOptimizer.ts — Plan 03 signal handoff and outer abort checks
      - src/core/ai/types.ts — ContextOptimizerInput.abortSignal
      - tests/core/context/ContextOptimizer.test.ts — existing compression fixtures and fake provider patterns
      - .planning/phases/03a-agent-reliability-evidence/03a-CONTEXT.md — D-06 and AGT-03 abort rules
    </read_first>
    <action>
      Add an optional AbortSignal parameter to ContextCompressor.compress and its internal AI summarization path. Check the signal before each local step, before provider selection, before generateText, and after each awaited operation. Pass the signal to the compression-model provider callback and to the AI SDK generation request. In the error handler, identify AbortError or an aborted signal and rethrow it; continue to the existing graceful fallback only for non-abort failures.

      Consume the ContextOptimizer call-site signal handoff from Plan 03 by adding the matching optional signal parameter to ContextCompressor.compress and its internal AI summarization path. Create a dedicated ContextCompressor test file covering abort during local steps, provider selection, and summarization; no-abort regression; and non-abort summarization failure. Do not modify ContextOptimizer.ts in this plan, and do not change the seven-step order, token budgets, summary count, or provider selection policy.
    </action>
    <verify>
      <automated>pnpm vitest run tests/core/context/ContextCompressor.test.ts tests/core/context/ContextOptimizer.test.ts</automated>
    </verify>
    <acceptance_criteria>
      - The nested compressor and AI summarization receive the same signal used by AgentOrchestrator.runTurn.
      - Abort is distinguishable from ordinary compression failure at the ContextOptimizer boundary.
      - Both named test files execute tests and exit 0; existing ContextOptimizer behavior remains green.
    </acceptance_criteria>
    <done>Abort propagation is complete through ContextOptimizer's nested asynchronous compression path.</done>
  </task>
</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Untrusted input or authority | Control |
|---|---|---|
| Optimizer -> compressor | User context, budget, and cancellation | Signal checks before/after every nested await; no input data becomes control policy |
| Compression provider -> optimizer | External model response/error | Abort distinction and existing bounded fallback behavior |

## STRIDE Register

| ID | Category | Threat | Control and automated test |
|---|---|---|---|
| T-03a-25 | Spoofing | A compression error is mistaken for caller abort or vice versa | AbortError/signal-specific fixtures |
| T-03a-26 | Tampering | Cancellation is swallowed and the optimizer returns altered output | Rethrow-on-abort and unchanged non-abort regression tests |
| T-03a-27 | Repudiation | Nested cancellation lacks stage evidence | Outer optimizer/orchestrator stage and test assertions |
| T-03a-28 | Information disclosure | Raw model error enters compression diagnostics | Existing bounded warning behavior plus no raw output assertions |
| T-03a-29 | Denial of service | Summarization continues after cancellation | Signal passed to provider/generateText and abort tests |
| T-03a-30 | Elevation of privilege | Untrusted compressed text changes execution policy | Compressor remains data transformation only; no tool/permission mutation |
</threat_model>

<verification>
```bash
pnpm vitest run tests/core/context/ContextCompressor.test.ts tests/core/context/ContextOptimizer.test.ts
pnpm lint
```
</verification>

<success_criteria>
1. The shared AbortSignal reaches and controls nested context compression.
2. Abort is not swallowed or converted into a normal compression result.
3. Existing compression behavior and tests remain green.
</success_criteria>

<output>
Create `.planning/phases/03a-agent-reliability-evidence/03a-04-SUMMARY.md` documenting nested signal propagation and the preserved compression boundary.
</output>
