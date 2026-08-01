---
phase: 04b-trust-aware-context-receipts
plan: 02
type: execute
wave: 2
depends_on: ["04b-01"]
files_modified:
  - src/core/context/ContextTrustPolicy.ts
  - src/core/context/ContextFreshnessPolicy.ts
  - tests/core/context/ContextTrustPolicy.test.ts
  - tests/core/context/ContextFreshnessPolicy.test.ts
autonomous: true
requirements:
  - CTX-T01

must_haves:
  truths:
    - "ContextTrustPolicy.assess() returns correct trust/sensitivity/authority for all 8 source types: system (1.0/public/system), persona (1.0/public/system), tool_schemas (1.0/public/system), preferences (1.0/public/system), user_input (0.9/private/user), memory (0.8/private/data), context.page (0.5/private/data), tools (0.9/private/data), unknown (0.3/private/data)"
    - "ContextTrustPolicy.validate() returns false for items with self-assigned trust that differs from policy — the optimizer must reject, not silently accept"
    - "ContextTrustPolicy.upgrade('public', 'secret') → 'secret'; upgrade('private', 'confidential') → 'confidential'; upgrade('confidential', 'private') → 'confidential' (most restrictive always wins per D-09)"
    - "ContextFreshnessPolicy.compute('context.page.current', 'context', createdAt, expiresAt) returns 0 when expiresAt has passed (hard expiry before decay per D-10)"
    - "ContextFreshnessPolicy.compute() returns 1.0 for system/persona types (Infinity TTL — no decay)"
    - "ContextFreshnessPolicy.compute() returns ~0.368 for a tool_result with ageMs === ttlMs (Math.exp(-1) ≈ 0.368 — exponential decay working correctly)"
   artifacts:
     - path: "src/core/context/ContextTrustPolicy.ts"
       provides: "Full static source-type table covering all 8 source types from D-07, validate() enforcement, upgrade() sensitivity escalation"
     - path: "src/core/context/ContextFreshnessPolicy.ts"
       provides: "Exponential decay freshness computation with per-source TTLs and hard expiry enforcement per D-10"
       exports: ["contextFreshnessPolicy", "ContextFreshnessPolicy"]
     - path: "tests/core/context/ContextTrustPolicy.test.ts"
       provides: "Fixture tests for every source type, no-self-assignment guard, sensitivity upgrade ordering"
     - path: "tests/core/context/ContextFreshnessPolicy.test.ts"
       provides: "Exponential decay math verification, TTL boundaries, expiresAt enforcement, Date.now() mocking"
   key_links:
     - "ContextTrustPolicy.assess() → ContextOptimizer.optimizeFromItems() — every ContextItem validated against static trust table (D-06, D-07)"
     - "ContextTrustPolicy.validate() → ContextOptimizer trust gating — mismatches rejected before prompt assembly"
     - "ContextFreshnessPolicy.compute() → ContextOptimizer staleness check — expired items (freshness=0) omitted before compression (D-10)"
     - "ContextFreshnessPolicy.getTTL() → per-source TTL constants — sourceId prefix matching → kind fallback → default"
  prohibitions: []
---

<objective>
Expand the tracer-basic ContextTrustPolicy to the full static source-type table per D-07, and create the ContextFreshnessPolicy with exponential decay per D-10. Both policies are deterministic, auditable, and LLM-independent.

**Purpose:** ContextTrustPolicy becomes the sole authority for trust/sensitivity/instructionAuthority assignment across all context sources. ContextFreshnessPolicy provides turn-scoped freshness scores via exponential decay with per-source TTLs and hard expiry enforcement.

**Output:** 2 modified/new source files, 2 new test files with comprehensive fixture coverage.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md

<interfaces>
From src/core/context/ContextTrustPolicy.ts (created in 04b-01):
```typescript
export interface TrustAssessment {
  trust: number;
  sensitivity: Sensitivity;
  instructionAuthority: InstructionAuthority;
}
export class ContextTrustPolicy {
  assess(sourceId: string, kind: PromptSection['kind']): TrustAssessment;
  validate(item: ContextItem, policy: TrustAssessment): boolean;
  static upgrade(current: Sensitivity, candidate: Sensitivity): Sensitivity;
}
export const contextTrustPolicy = new ContextTrustPolicy();
```

From src/core/context/ContextItem.ts (created in 04b-01):
```typescript
export type Sensitivity = 'public' | 'private' | 'confidential' | 'secret';
export type InstructionAuthority = 'system' | 'user' | 'data';
export const ContextItemSchema: z.ZodObject<...>;
export type ContextItem = z.infer<typeof ContextItemSchema>;
```

From src/core/ai/types.ts (existing PromptSection):
```typescript
export interface PromptSection {
  kind: 'system' | 'tool_schemas' | 'preferences' | 'memory' | 'context' | 'task' | 'user_input';
  text: string;
  tokens: number;
  stable: boolean;
  sourceId: string;
}
```

**Planner-configurable TTLs (D-10, agent discretion):** The following TTL values are the initial defaults — deterministically applied, fixture-tested, tunable without interface changes:
- system/tool_schemas/preferences/persona: Infinity (never decays)
- user_input: 300_000ms (5 minutes)
- memory (memory.user.facts): 3_600_000ms (1 hour)
- memory.episodic (memory.episodic.*): 1_800_000ms (30 minutes)
- page.current (context.page.*): 120_000ms (2 minutes)
- page.cached: 600_000ms (10 minutes)
- tool_result (tools.*): 60_000ms (1 minute)
- default: 300_000ms (5 minutes)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Expand ContextTrustPolicy to full static source-type table (D-07, D-09)</name>
  <files>src/core/context/ContextTrustPolicy.ts, tests/core/context/ContextTrustPolicy.test.ts</files>
  <behavior>
    - Test 1: system kind → {trust:1.0, sensitivity:'public', instructionAuthority:'system'}
    - Test 2: persona source (sourceId starts with 'persona.') → {trust:1.0, sensitivity:'public', instructionAuthority:'system'}
    - Test 3: tool_schemas kind → {trust:1.0, sensitivity:'public', instructionAuthority:'system'}
    - Test 4: preferences kind → {trust:1.0, sensitivity:'public', instructionAuthority:'system'}
    - Test 5: user_input kind → {trust:0.9, sensitivity:'private', instructionAuthority:'user'}
    - Test 6: memory kind → {trust:0.8, sensitivity:'private', instructionAuthority:'data'}
    - Test 7: context kind with sourceId='context.page.current-url' → {trust:0.5, sensitivity:'private', instructionAuthority:'data'}
    - Test 8: context kind with sourceId='context.page.unknown-domain.com' → {trust:0.3, sensitivity:'private', instructionAuthority:'data'} (unknown domain defaults to 0.3 per D-07)
    - Test 9: context kind with sourceId='tools.builtin.search' → {trust:0.9, sensitivity:'private', instructionAuthority:'data'} (D-07: verified tool result)
    - Test 10: completely unknown sourceId and kind → {trust:0.3, sensitivity:'private', instructionAuthority:'data'} (conservative default)
    - Test 11: validate() returns true when item trust/sensitivity/authority exactly match policy
    - Test 12: validate() returns false when item.trust is 0.5 but policy says 1.0
    - Test 13: upgrade('public', 'secret') → 'secret' (max escalation)
    - Test 14: upgrade('private', 'public') → 'private' (existing is more restrictive)
    - Test 15: upgrade('confidential', 'private') → 'confidential' (candidate wins only if more restrictive)
  </behavior>
  <action>
    Expand `src/core/context/ContextTrustPolicy.ts` from the tracer-basic version (system/user/data) to the full static table per D-07:

    1. The `assess()` method already covers system, user_input, memory, context (page), tools, and default. Expand the specificity:
       - `sourceId.startsWith('persona.')` — even if kind is not 'system', persona items get system-level trust (1.0/public/system)
       - `sourceId.startsWith('context.page.')` — known-domain logic: if the sourceId includes a domain suffix that matches a known list, trust 0.5; otherwise trust 0.3 (unknown-domain per D-07). The known-vs-unknown distinction can be a simple heuristic: if the sourceId is exactly 'context.page.current' or 'context.page.current-url' (the standard sourceIds from ContextOptimizer), trust 0.5. For any other 'context.page.*' with an unknown-looking domain, trust 0.3. This is a programmatic policy, not user-configurable.
       - `sourceId.startsWith('tools.')` — trust 0.9, sensitivity 'private', authority 'data'
       - `kind === 'memory'` — trust 0.8, sensitivity 'private', authority 'data'
       - `kind === 'preferences'` — trust 1.0, sensitivity 'public', authority 'system'
       - `kind === 'tool_schemas'` — trust 1.0, sensitivity 'public', authority 'system'

    2. Keep the `validate()` method from 04b-01 — no changes needed (it checks all three fields).

    3. Keep the `static upgrade()` method — no changes needed.

    4. The policy class is deterministic, LLM-independent, and fixture-tested. No source content can self-assign trust or authority.

    Create `tests/core/context/ContextTrustPolicy.test.ts` with all behavior tests above. Use a test fixture builder pattern consistent with the existing codebase (see ContextOptimizer.test.ts).
  </action>
  <verify>
    <automated>npx vitest run tests/core/context/ContextTrustPolicy.test.ts --reporter=verbose</automated>
  </verify>
  <done>ContextTrustPolicy.assess() returns correct metadata for all 8 source types per D-07. validate() correctly rejects self-assigned trust. upgrade() always returns the most restrictive sensitivity. All 15 behavior tests pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create ContextFreshnessPolicy with exponential decay + per-source TTLs (D-10)</name>
  <files>src/core/context/ContextFreshnessPolicy.ts, tests/core/context/ContextFreshnessPolicy.test.ts</files>
  <behavior>
    - Test 1: compute('core.instructions.system', 'system', Date.now()) returns 1.0 (Infinity TTL — no decay)
    - Test 2: compute('persona.injector.default', 'system', Date.now()) returns 1.0 (persona TTL is Infinity)
    - Test 3: compute('tools.builtin.search', 'tool_result', Date.now() - 60000) returns Math.exp(-1) ≈ 0.3679 (ageMs 60s, ttlMs 60s)
    - Test 4: compute('tools.builtin.search', 'tool_result', Date.now() - 30000) returns Math.exp(-0.5) ≈ 0.6065 (ageMs 30s, ttlMs 60s)
    - Test 5: compute('tools.builtin.search', 'tool_result', Date.now(), Date.now() - 1) returns 0 (expiresAt already passed — hard expiry before decay per D-10)
    - Test 6: compute() with undefined createdAt returns 1.0 (no creation timestamp → assume fresh)
    - Test 7: compute() with createdAt = 0 and ageMs large returns very small but non-negative value (asymptotic decay, never negative)
    - Test 8: compute('context.page.current-url', 'context', Date.now()) returns 1.0 (0 age, maximum freshness)
    - Test 9: compute('memory.user.facts', 'memory_fact', Date.now() - 1800000) returns Math.exp(-0.5) (ageMs 30min, ttlMs 60min)
  </behavior>
  <action>
    Create `src/core/context/ContextFreshnessPolicy.ts`:

    1. Define the `ContextFreshnessPolicy` class with:
       - A private static readonly `TTLS` table mapping source-type keys to `{ ttlMs: number }` (TTL table provided in the interfaces context above — use these exact values)
       - `compute(sourceId: string, kind: string, createdAt?: number, expiresAt?: number): number`:
         a. Hard expiry first (D-10): if `expiresAt !== undefined && Date.now() >= expiresAt`, return 0
         b. Look up TTL via private `getTTL(sourceId, kind)` — sourceId prefix matching first, then kind fallback, then default
         c. If TTL is Infinity or createdAt is undefined, return 1.0
         d. `ageMs = Math.max(0, Date.now() - createdAt)`
         e. `return Math.exp(-ageMs / ttlMs)` — exponential decay per D-10
       - `getTTL(sourceId: string, kind: string): number` — private method with prefix matching:
         - `sourceId.startsWith('persona.')` → persona TTL (Infinity)
         - `sourceId.startsWith('memory.episodic')` → episodic TTL
         - `sourceId.startsWith('memory.')` → fact TTL
         - `sourceId.startsWith('context.page')` → page.current TTL
         - `sourceId.startsWith('tools.')` → tool_result TTL
         - Otherwise, match by kind string (e.g., 'system', 'user_input', 'tool_schemas', 'preferences', 'memory', 'context')
         - Fallback: default TTL

    2. Export `contextFreshnessPolicy = new ContextFreshnessPolicy()` as the singleton instance.

    3. The TTL values are initial defaults (planner-configured per Research section — agent discretion). They are deterministically applied, fixture-tested, and tunable without interface changes.

    Create `tests/core/context/ContextFreshnessPolicy.test.ts`:
    - Use `vi.useFakeTimers()` or explicit `Date.now()` calls with known timestamps to get deterministic test results
    - Test all behavior cases above
    - Use `expect(freshness).toBeCloseTo(expected, 2)` for floating-point assertions (exponential decay produces repeating decimals)
  </action>
  <verify>
    <automated>npx vitest run tests/core/context/ContextFreshnessPolicy.test.ts --reporter=verbose</automated>
  </verify>
  <done>ContextFreshnessPolicy.compute() correctly applies exponential decay per D-10. Hard expiry returns 0. Infinity TTL returns 1.0. ageMs === ttlMs returns ~0.368. All 9 behavior tests pass with fixture-controlled timestamps.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Source adapter → ContextTrustPolicy | SourceId is user-controlled for page content domains — assess() must not trust sourceId content beyond prefix matching |
| Date.now() → FreshnessPolicy | System clock skew could make freshness scores incorrect — the policy is advisory (deterministic filter), not a security gate |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-04b-06 | Spoofing | ContextTrustPolicy sourceId prefix matching | low | accept | sourceId is an internal constant (dot-separated, validated by isValidSourceId), not raw user input — source adapters own the prefix convention; spoofed sourceId would fail isValidSourceId |
| T-04b-07 | Tampering | FreshnessPolicy TTL constant table | low | accept | TTLs are module-level readonly constants — no runtime mutation path; future tuning requires code change + test fixture update |
| T-04b-08 | Information Disclosure | Sensitivity downgrade bypass | medium | mitigate | ContextTrustPolicy.upgrade() is the ONLY sensitivity escalation path — ContextOptimizer must call it; test proves upgrade('public','secret') → 'secret' and the reverse is impossible |
</threat_model>

<verification>
```bash
npx vitest run tests/core/context/ContextTrustPolicy.test.ts tests/core/context/ContextFreshnessPolicy.test.ts --reporter=verbose
```
</verification>

<success_criteria>
- [ ] ContextTrustPolicy covers all 8 source types from D-07 with correct trust/sensitivity/authority values
- [ ] ContextTrustPolicy.validate() correctly rejects items with self-assigned trust differing from policy
- [ ] ContextTrustPolicy.upgrade() always returns the most restrictive sensitivity
- [ ] ContextFreshnessPolicy.compute() applies exponential decay formula correctly
- [ ] Hard expiry (expiresAt passed) returns 0 before decay check
- [ ] Infinity TTL sources return 1.0 regardless of age
- [ ] All 24 behavior tests pass (15 trust policy + 9 freshness policy)
</success_criteria>

<output>
Create `.planning/phases/04b-trust-aware-context-receipts/04b-02-SUMMARY.md` when done
</output>
