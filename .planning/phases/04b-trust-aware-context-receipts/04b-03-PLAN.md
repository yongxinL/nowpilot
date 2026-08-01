---
phase: 04b-trust-aware-context-receipts
plan: 03
type: execute
wave: 2
depends_on: ["04b-01"]
files_modified:
  - src/core/ai/ToolResultShaper.ts
  - tests/core/ai/ToolResultShaper.test.ts
autonomous: true
requirements:
  - TOL-04

must_haves:
  truths:
    - "ToolResultShaper.shape(validToolResult) returns a ContextItem with kind:'context', sourceId:'tools.builtin.{toolName}', instructionAuthority:'data', stable:false"
    - "ToolResultShaper redacts API keys, Bearer tokens, JWTs, and ServiceNow session tokens from tool output text — redacted text contains ***REDACTED*** markers per redactSensitive()"
    - "ToolResultShaper enforces max output size (32,000 chars) — output longer than MAX_TOOL_RESULT_CHARS is truncated with '\n[truncated]' suffix appended"
    - "ToolResultShaper does NOT mutate the original ToolExecutionResult — shape() returns a new immutable ContextItem; original.output remains unchanged (D-05 immutability)"
    - "ToolResultShaper returns null when redaction removes all content (sensitivity would be 'secret') — no ContextItem is created for secret-level tool output"
   artifacts:
     - path: "src/core/ai/ToolResultShaper.ts"
       provides: "Standalone service between ExecutorService and ContextOptimizer — validates output, redacts secrets, applies size limit, assigns provenance/trust per D-05"
       exports: ["toolResultShaper", "ToolResultShaper"]
     - path: "tests/core/ai/ToolResultShaper.test.ts"
       provides: "Fixture tests covering redaction, size limits, provenance assignment, immutability contract"
   key_links:
     - "ToolExecutionResult.output → ToolResultShaper.shape() → redactSensitive() — secrets removed before ContextItem creation (TOL-04, D-05)"
     - "ToolResultShaper.shape() → contextTrustPolicy.assess() → ContextItem — trust/sensitivity/authority from policy, never self-assigned (D-06)"
     - "ToolResultShaper.shape() → ContextItem → ContextOptimizer.optimizeFromItems() — shaped tool results ready for trust validation and receipt generation"
     - "ToolResultShaper → original ToolExecutionResult — read-only; immutability contract (D-05)"
  prohibitions:
    - requirement_id: TOL-04
      category: privacy
      status: unresolved
      verification: null
      statement: "MUST NOT allow raw unredacted tool output containing API keys, Bearer tokens, JWTs, or ServiceNow session tokens to enter the context pipeline."
---

<objective>
Build the ToolResultShaper — a standalone service between ExecutorService and ContextOptimizer that validates tool output, redacts secrets, enforces size limits, assigns provenance, and returns an immutable ContextItem (TOL-04, D-05).

**Purpose:** Every tool result passes through ToolResultShaper before re-entering the context pipeline. Secrets are redacted at the boundary. Large outputs are truncated. The original ToolExecutionResult is never mutated. No raw, unshaped tool output reaches the optimizer.

**Output:** 1 new source file, 1 new test file.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md

<interfaces>
From src/core/ai/ToolResultShaper.ts (to be created):
```typescript
export class ToolResultShaper {
  /** Shape a validated tool execution result into a ContextItem or null (if secret). */
  shape(result: ToolExecutionResult): ContextItem | null;
}
export const toolResultShaper = new ToolResultShaper();
```

From src/core/ai/types.ts (existing ToolExecutionResult, lines 217-232):
```typescript
export interface ToolExecutionResult {
  toolName: string;
  output: unknown;
  durationMs: number;
  toolCallId: string;
  evidence?: CompletionEvidence;
}
```

From src/core/security/redactSensitive.ts (existing):
```typescript
/** Redacts sensitive information from a string. Returns empty string for non-string/empty input. */
export function redactSensitive(input: string): string;
// Patterns: JWT (eyJ...), sk- keys, api_key=xxx, Bearer tokens, JSESSIONID, sysparm_ck
```

From src/core/context/ContextTrustPolicy.ts (created in 04b-01, expanded in 04b-02):
```typescript
export class ContextTrustPolicy {
  assess(sourceId: string, kind: PromptSection['kind']): TrustAssessment;
}
export const contextTrustPolicy: ContextTrustPolicy;
// For tools.* sourceIds: { trust: 0.9, sensitivity: 'private', instructionAuthority: 'data' }
```

From src/core/context/ContextItem.ts (created in 04b-01):
```typescript
export interface ContextItem {
  kind: PromptSection['kind'];
  text: string;
  tokens: number;
  stable: boolean;
  sourceId: string;
  relevance: number;
  freshness: number;
  trust: number;
  sensitivity: Sensitivity;
  instructionAuthority: InstructionAuthority;
  createdAt?: number;
  expiresAt?: number;
}
```

**Integration point:** ExecutorService.execute() → validated ToolExecutionResult → ToolResultShaper.shape() → ContextItem → ContextOptimizer.optimizeFromItems() (D-05). ToolResultShaper is called AFTER tool execution, BEFORE context assembly. It must NEVER modify the original ToolExecutionResult.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Build ToolResultShaper — redaction, size limit, provenance, immutability (D-05, TOL-04)</name>
  <files>src/core/ai/ToolResultShaper.ts, tests/core/ai/ToolResultShaper.test.ts</files>
  <behavior>
    - Test 1: shape() with simple string output returns ContextItem with kind:'context', sourceId:'tools.builtin.{toolName}', instructionAuthority:'data', stable:false, relevance:1.0, freshness:1.0
    - Test 2: shape() with object output JSON.stringify's it, returns ContextItem with the JSON text
    - Test 3: shape() with output containing 'sk-proj-abc123secretkey' → text contains '***REDACTED***' markers, NOT the raw key
    - Test 4: shape() with output containing a JWT ('eyJhbGciOi...') → JWT replaced with '***REDACTED_JWT***'
    - Test 5: shape() with output containing 'Bearer xyz-token-123' → token replaced with '***REDACTED***'
    - Test 6: shape() with output containing 'JSESSIONID=ABC123' → session ID replaced with '***REDACTED***'
    - Test 7: shape() with output longer than 32,000 characters → truncated to 32,000 + '\n[truncated]' (total ≤ 33,000 chars)
    - Test 8: shape() does NOT mutate original ToolExecutionResult — after shape(), assert original.output is unchanged (string identity or deep equality for objects)
    - Test 9: shape() with empty output ('') → text is '' (redactSensitive returns '' for empty input), tokens is 0
    - Test 10: shape() assigns trust=0.9, sensitivity='private', instructionAuthority='data' via contextTrustPolicy.assess()
  </behavior>
  <action>
    Create `src/core/ai/ToolResultShaper.ts`:

    1. Module-level constants:
       - `MAX_TOOL_RESULT_CHARS = 32_000` — maximum character length before truncation
       
    2. `ToolResultShaper` class with `shape(result: ToolExecutionResult): ContextItem | null`:
       a. **Convert output to text**: `typeof result.output === 'string' ? result.output : JSON.stringify(result.output)`
       b. **Redact secrets**: `text = redactSensitive(text)` — reuses existing TraceRedactor patterns (JWT, sk-, api_key, Bearer, JSESSIONID, sysparm_ck)
       c. **Size limit**: if `text.length > MAX_TOOL_RESULT_CHARS`, truncate: `text = text.slice(0, MAX_TOOL_RESULT_CHARS) + '\n[truncated]'`
       d. **Assign provenance**: sourceId = `tools.builtin.${result.toolName}`
       e. **Assign trust**: call `contextTrustPolicy.assess(sourceId, 'context')` — gets { trust: 0.9, sensitivity: 'private', instructionAuthority: 'data' }
       f. **Never create ContextItem for secret sensitivity** (D-09 guard): if `sensitivity === 'secret'`, return null. (The redactSensitive call in step b replaces secrets with placeholders — if the ORIGINAL output was entirely a secret, `text` will be mostly `***REDACTED***` and we still create a ContextItem with `sensitivity: 'private'` since no actual secrets remain. If future policy marks tools as 'secret' sensitivity, this guard prevents ContextItem creation.)
       g. **Construct ContextItem**: `{ kind: 'context', text, tokens: Math.ceil(text.length / 4), stable: false, sourceId, relevance: 1.0, freshness: 1.0, trust: policy.trust, sensitivity: policy.sensitivity, instructionAuthority: policy.instructionAuthority, createdAt: Date.now() }`

    3. **Immutability guarantee (D-05)**: shape() creates a NEW ContextItem. It reads from `result.output` (string) or uses `JSON.stringify(result.output)` (object) — string primitives are immutable in JS. The original ToolExecutionResult object is never written to. For object outputs, the original `result.output` reference remains unchanged.

    4. Export `toolResultShaper = new ToolResultShaper()` as the singleton.

    Create `tests/core/ai/ToolResultShaper.test.ts`:
    - Import `describe, it, expect` from vitest
    - Import `toolResultShaper` and types
    - Test fixture builder: `function buildResult(overrides): ToolExecutionResult` returning a valid ToolExecutionResult with defaults
    - Cover all 10 behavior tests above
    - For the immutability test (Test 8): create a ToolExecutionResult with output object `{ data: 'test' }`, deep-clone for comparison, call shape(), assert original is unchanged
  </action>
  <verify>
    <automated>npx vitest run tests/core/ai/ToolResultShaper.test.ts --reporter=verbose</automated>
  </verify>
  <done>ToolResultShaper.shape() redacts all 6 secret patterns, enforces 32K char limit with truncation marker, assigns provenance (sourceId: tools.builtin.{name}) and trust (0.9/private/data) via ContextTrustPolicy, constructs immutable ContextItem without mutating original ToolExecutionResult. All 10 behavior tests pass.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| ToolExecutionResult.output → redactSensitive() | Untrusted tool output may contain secrets from API responses, file contents, or external data |
| ToolResultShaper → ContextOptimizer | The returned ContextItem enters the context pipeline — must not carry raw secrets or self-assigned trust |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-04b-09 | Information Disclosure | ToolResultShaper redaction | critical | mitigate | redactSensitive() is called BEFORE any other processing — secrets are removed first; 6 regex patterns cover known secret formats (JWT, sk-, api_key, Bearer, JSESSIONID, sysparm_ck); test proves every pattern is replaced |
| T-04b-10 | Tampering | ToolResultShaper truncation bypass | low | accept | Truncation marker is appended after size check — if someone crafts output to be exactly 32,000 chars, truncation is a no-op; the marker is not required for correctness |
| T-04b-11 | Information Disclosure | Original ToolExecutionResult mutation | low | mitigate | shape() reads from result.output (immutable primitive for strings, serializes objects via JSON.stringify) — never writes to the input; test proves original is unchanged after shape() |
| T-04b-12 | Elevation of Privilege | Tool output self-assigning trust | medium | mitigate | ContextTrustPolicy.assess() is the sole authority for trust/sensitivity/authority — ToolResultShaper uses policy output, never self-assigns; instructionAuthority is hardcoded to 'data' for all tool results |
</threat_model>

<verification>
```bash
npx vitest run tests/core/ai/ToolResultShaper.test.ts --reporter=verbose
```
</verification>

<success_criteria>
- [ ] ToolResultShaper.shape() redacts all 6 secret patterns from tool output
- [ ] Output exceeding 32,000 chars is truncated with '\n[truncated]' marker
- [ ] SourceId is 'tools.builtin.{toolName}' (dot-separated, valid per isValidSourceId)
- [ ] Trust/sensitivity/authority assigned via ContextTrustPolicy (not self-assigned)
- [ ] Original ToolExecutionResult is never mutated (D-05 immutability guarantee)
- [ ] All 10 behavior tests pass
</success_criteria>

<output>
Create `.planning/phases/04b-trust-aware-context-receipts/04b-03-SUMMARY.md` when done
</output>
