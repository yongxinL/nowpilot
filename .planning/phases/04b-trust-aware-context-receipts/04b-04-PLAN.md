---
phase: 04b-trust-aware-context-receipts
plan: 04
type: execute
wave: 3
depends_on: ["04b-01", "04b-02"]
files_modified:
  - src/core/context/ContextProvenanceManifest.ts
  - src/core/context/ContextOptimizer.ts
  - src/core/context/ContextCompressor.ts
  - tests/core/context/ContextProvenanceManifest.test.ts
  - tests/core/context/ContextOptimizer.test.ts
autonomous: true
requirements:
  - CTX-T03
  - CTX-T06  # (structural prep only; telemetry aggregation in Phase 6a per CONTEXT.md)

must_haves:
  truths:
    - "Every ContextProvenanceManifest section is a ContextReceiptEntry with originalTokens, finalTokens, included, omissionReason, and cacheEligible — not just the old ContextProvenanceEntry"
    - "ContextCompressor.compress() return value includes omissionReasons: Map<string, OmissionReason> — each removed/compressed section's sourceId maps to its omission reason (budget/irrelevant/stale/sensitive/policy)"
    - "ContextOptimizer.optimizeFromItems() populates omissionReason on receipt entries based on ContextCompressor omissionReasons — sections not in the final output get included:false and the correct omissionReason"
    - "validateReceiptTotals(receipt, packedSections) returns true when sum(receipt.included.filter(e => e.included).finalTokens) === sum(packedSections.map(s => s.tokens)) — receipt totals must equal packed section totals (CTX-T03 acceptance)"
    - "validateReceiptTotals() returns false when receipt totals and packed totals diverge — any nonzero delta is a bug (RESEARCH Pitfall 4)"
   artifacts:
     - path: "src/core/context/ContextProvenanceManifest.ts"
       provides: "ContextReceiptEntry type, recordSectionWithReceipt(), validateReceiptTotals() — receipt-aware provenance tracking"
     - path: "src/core/context/ContextCompressor.ts"
       provides: "omissionReasons map emitted alongside compressed sections — each dropped/trimmed section gets an omission reason"
     - path: "src/core/context/ContextOptimizer.ts"
       provides: "optimizeFromItems() consumes omissionReasons from compressor, populates receipt entries with omissionReason, included:false for removed sections"
   key_links:
     - "ContextCompressor.compress() → omissionReasons Map → ContextOptimizer.optimizeFromItems() → markOmitted() — each dropped section's omission reason populated in receipt (CTX-T03)"
     - "ContextOptimizer → ContextProvenanceManifest.recordSectionWithReceipt() — included sections get originalTokens/finalTokens/cacheEligible"
     - "ContextOptimizer → ContextProvenanceManifest.markOmitted() — excluded sections get included:false, omissionReason, finalTokens:0"
     - "ContextOptimizer → validateReceiptTotals(receipt, packedSections) — cross-check guarantees receipt = packed totals (RESEARCH Pitfall 4)"
     - "ContextFreshnessPolicy.compute() → ContextOptimizer staleness → markOmitted(manifest, sourceId, 'stale') — stale items tracked pre-compression"
  prohibitions:
    - requirement_id: CTX-T03
      category: privacy
      status: unresolved
      verification: null
      statement: "MUST NOT include sourceId or token counts for secret-level items in context receipt entries — the existence and size of secrets must not be inferable from receipt metadata."
---

<objective>
Extend the context receipt system so every section in the provenance manifest carries full receipt accounting: originalTokens, finalTokens, included status, omissionReason, and cacheEligibility. Integrate omission reasons from the ContextCompressor degradation pipeline into receipt entries. Add totals cross-check validation.

**Purpose:** Context receipts (CTX-T03) are the single source of truth for what was included, omitted, or compressed per turn. They feed Phase 6 diagnostics, Phase 6a telemetry, and developer auditing — without exposing raw sensitive text.

**Output:** 3 modified source files, 2 modified/new test files.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md

<interfaces>
From src/core/context/ContextProvenanceManifest.ts (modified in 04b-01):
```typescript
export function createProvenanceManifest(workspaceId: string, activeSurface: 'sidepanel' | 'full-app'): ContextProvenanceManifest;
export function recordSection(manifest: ContextProvenanceManifest, section: PromptSection): void;
export function recordSectionWithReceipt(manifest: ContextProvenanceManifest, section: PromptSection, originalTokens: number, cacheEligible: boolean): void;
export function markTruncated(manifest: ContextProvenanceManifest, sourceId: string): void;
export function markCompression(manifest: ContextProvenanceManifest, sourceId: string, method: ContextProvenanceEntry['compressionApplied']): void;
export function isValidSourceId(sourceId: string): boolean;
```

From src/core/ai/types.ts (ContextReceiptEntry, added in 04b-01):
```typescript
export type OmissionReason = 'budget' | 'irrelevant' | 'stale' | 'sensitive' | 'policy';

export interface ContextReceiptEntry extends ContextProvenanceEntry {
  originalTokens: number;
  finalTokens: number;
  included: boolean;
  omissionReason?: OmissionReason;
  cacheEligible: boolean;
}
```

From src/core/context/ContextCompressor.ts (existing):
```typescript
export class ContextCompressor {
  async compress(
    sections: PromptSection[],
    budget: number,
    tier: ModelContextTier,
    compressionModelProvider?: (signal?: AbortSignal) => Promise<ProviderAdapter | null>,
    signal?: AbortSignal,
  ): Promise<{ sections: PromptSection[]; stepsApplied: string[] }>;
}
export const contextCompressor = new ContextCompressor();
```

From src/core/context/ContextOptimizer.ts (optimizeFromItems, created in 04b-01):
```typescript
export class ContextOptimizer {
  async optimizeFromItems(items: ContextItem[], input: ContextOptimizerInput): Promise<OptimizedContext>;
  async optimize(input: ContextOptimizerInput): Promise<OptimizedContext>; // existing, unchanged
}

// Dedicated omission-reason mapping per degradation step:
// drop-debug → 'policy' (debug sections excluded by policy)
// drop-secondary → 'policy' (secondary/optional sections excluded)
// summarise-history → null (history is compressed, not omitted — still included)
// compress-page → null (page content compressed, not omitted — still included)
// trim-tools → 'budget' (tools dropped due to token budget)
// reduce-memory → 'budget' (memory entries dropped due to budget)
// minimal-mode → 'budget' (minimal mode caps force omission)
// ai-summarisation → null (content is summarized, not omitted)
// Freshness expiry → 'stale' (expired items omitted per D-10)
// Relevance below threshold → 'irrelevant' (query-irrelevant items omitted per D-08)
// Sensitivity=secret → 'sensitive' (never creates ContextItem, but omission tracked)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend ContextProvenanceManifest with receipt validation + extend ContextCompressor to emit omission reasons</name>
  <files>src/core/context/ContextProvenanceManifest.ts, src/core/context/ContextCompressor.ts, tests/core/context/ContextProvenanceManifest.test.ts</files>
  <behavior>
    - Test 1: recordSectionWithReceipt() creates entry with originalTokens, finalTokens (=== section.tokens), included:true, cacheEligible — all receipt fields populated
    - Test 2: validateReceiptTotals() returns true when sum(included receipt finalTokens) === packed total
    - Test 3: validateReceiptTotals() returns false when receipt reports 500 tokens but packed sections sum to 450 (nonzero delta → bug)
    - Test 4: After recordSectionWithReceipt then markTruncated, entry.truncated is true but receipt fields (originalTokens, finalTokens, included, cacheEligible) are preserved
    - Test 5: ContextCompressor.compress() returns omissionReasons map — when trim-tools step drops tool schemas, the sourceId 'tools.builtin.selected' maps to 'budget'
    - Test 6: ContextCompressor.compress() omissionReasons map is empty when no sections are dropped (budget satisfied without degradation)
  </behavior>
  <action>
    Part A — ContextProvenanceManifest.ts:

    1. The `recordSectionWithReceipt()` from 04b-01 already populates receipt fields. Verify it works correctly and add a `validateReceiptTotals()` export:
    
    ```typescript
    export function validateReceiptTotals(
      receipt: ContextReceiptEntry[],
      packedSections: PromptSection[],
    ): boolean {
      const receiptTotal = receipt
        .filter(e => e.included)
        .reduce((sum, e) => sum + e.finalTokens, 0);
      const packedTotal = packedSections.reduce((sum, s) => sum + s.tokens, 0);
      return receiptTotal === packedTotal;
    }
    ```
    
    2. Add a utility function `markOmitted(manifest, sourceId, reason: OmissionReason, originalTokens: number)`:
       - Creates a receipt entry with `included: false`, `originalTokens`, `finalTokens: 0`, `omissionReason: reason`, `cacheEligible: false`
       - Pushes it into `manifest.sections[]`
       - Does NOT add to `manifest.totalTokens` (the item was omitted)
       - This lets the receipt account for items that were filtered out BEFORE reaching the final PromptSection[]

    Part B — ContextCompressor.ts:

    3. Modify the `compress()` method to return `omissionReasons: Map<string, OmissionReason>` alongside the existing return value:
       - Change return type to `Promise<{ sections: PromptSection[]; stepsApplied: string[]; omissionReasons: Map<string, OmissionReason> }>`
       - Initialize `omissionReasons = new Map<string, OmissionReason>()`
       - After each degradation step, track which sections were dropped by comparing currentSections before-vs-after the step:
         - `drop-debug`: sourceIds starting with 'debug.' → omissionReason: 'policy'
         - `drop-secondary`: sourceIds containing 'secondary' or 'optional' → 'policy'
         - `trim-tools`: if any tool schemas were dropped (kept.length < parsed.length), record sourceId 'tools.builtin.selected' → 'budget'
         - `reduce-memory`: if memory entries were dropped (kept.length < parsed.length), record sourceId → 'budget'
         - `minimal-mode`: sections dropped entirely (page context, excess tools/memories) → 'budget'
       - For sections that were COMPRESSED but still included (summarise-history, compress-page, ai-summarisation) — do NOT add an omissionReason (the item is still in the output, just smaller)
    
    4. Update all test files that call `contextCompressor.compress()` to destructure `omissionReasons` from the result.

    Create `tests/core/context/ContextProvenanceManifest.test.ts` with the receipt-specific behavior tests.
  </action>
  <verify>
    <automated>npx vitest run tests/core/context/ContextProvenanceManifest.test.ts --reporter=verbose</automated>
  </verify>
  <done>ContextProvenanceManifest has recordSectionWithReceipt() and validateReceiptTotals(). ContextCompressor.compress() returns omissionReasons map tracking which sourceIds were dropped and why. All 6 behavior tests pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire receipt generation into ContextOptimizer.optimizeFromItems() — omission reasons from compressor, omitted-item tracking, totals cross-check</name>
  <files>src/core/context/ContextOptimizer.ts, tests/core/context/ContextOptimizer.test.ts</files>
  <behavior>
    - Test 1: optimizeFromItems() with system + data items where data item is dropped by degradation → receipt shows 2 entries: system (included:true) + page (included:false, omissionReason:'budget')
    - Test 2: optimizeFromItems() with 3 items all under budget → receipt shows 3 entries, all included:true, omissionReason:undefined
    - Test 3: optimizeFromItems() receipt totals cross-check — validateReceiptTotals(receipt, packedSections) returns true
    - Test 4: ContextOptimizer calls ContextFreshnessPolicy.compute() for items with createdAt — stale items (freshness=0, expiresAt passed) are omitted with omissionReason:'stale' in receipt
    - Test 5: ContextOptimizer calls ContextTrustPolicy for all items — mismatched trust items are rejected with SCHEMA_INVALID before reaching the receipt stage
    - Test 6: The existing optimize() method continues to work unchanged (backward compatibility)
  </behavior>
  <action>
    Extend `ContextOptimizer.optimizeFromItems()` in `src/core/context/ContextOptimizer.ts`:

    1. **Before degradation**: After trust validation (from 04b-01), also run freshness computation via `contextFreshnessPolicy.compute(item.sourceId, item.kind, item.createdAt, item.expiresAt)`. If freshness === 0 (hard expiry), do NOT include the item in the sections passed to the compressor. Instead, call `markOmitted(manifest, item.sourceId, 'stale', item.tokens)`.

    2. **During receipt generation**: After the compressor returns `{ sections, stepsApplied, omissionReasons }`, build receipt entries:
       - For each section that survived to the final output: `recordSectionWithReceipt(manifest, section, originalTokens, cacheEligible)` where originalTokens comes from the ContextItem's `.tokens` and cacheEligible is `section.stable`
       - For each entry in `omissionReasons` map: find the corresponding ContextItem's originalTokens and call `markOmitted(manifest, sourceId, reason, originalTokens)`
       - For items filtered out pre-compression (freshness=0): already handled by markOmitted

    3. **Receipt totals cross-check**: After all receipt entries are populated, call `validateReceiptTotals(manifest.sections, finalSections)`. If it returns false, log a warning (`console.warn('[ContextOptimizer] Receipt totals do not match packed totals — this is a bug (CTX-T03)')`) but do NOT throw — the prompt is still valid; the receipt is diagnostically inconsistent and will be flagged by Phase 6 telemetry.

    4. **Backward compatibility**: Do NOT change the existing `optimize()` method signature or behavior. `optimizeFromItems()` is the new entry point for the ContextItem[] pipeline. The existing `optimize()` continues to work with raw sections.

    Extend `tests/core/context/ContextOptimizer.test.ts` with the receipt-specific tests above. Use test fixture builders that create ContextItem[] inputs with known token sizes, and mock the compressor's omissionReasons return.
  </action>
  <verify>
    <automated>npx vitest run tests/core/context/ContextOptimizer.test.ts --reporter=verbose 2>&1 | grep -c 'failed'</automated>
  </verify>
  <done>ContextOptimizer.optimizeFromItems() consumes omissionReasons from compressor, populates receipt entries with correct included/omissionReason fields, tracks freshness-expired items as stale, cross-checks receipt totals against packed sections. All 6 behavior tests pass. Existing optimize() unchanged.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| ContextCompressor → ContextOptimizer | omissionReasons map assigns meanings to dropped sections — consumer must not trust these as security decisions |
| ContextOptimizer → ProvenanceManifest | Receipt entries carry sourceId and token counts — must never expose raw sensitive text (D-03) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-04b-13 | Information Disclosure | Receipt sourceId revealing secret existence | medium | mitigate | sensitivity:secret items never become ContextItem instances (Zod gate in 04b-01); if a tool result has no ContextItem, it has no receipt entry — existence is not leaked |
| T-04b-14 | Tampering | Receipt totals not matching packed totals | low | accept | validateReceiptTotals() cross-checks and logs a warning on mismatch; the prompt is still valid — this is a diagnostic inconsistency, not a security breach |
| T-04b-15 | Information Disclosure | OmissionReason = 'sensitive' revealing that sensitive content existed | low | mitigate | The 'sensitive' omission reason is used ONLY when sensitivity === 'secret' and no ContextItem was created — in that case, there is no receipt entry at all (markOmitted is never called because there's no sourceId to reference). The receipt simply has no entry for the secret source. |
</threat_model>

<verification>
```bash
npx vitest run tests/core/context/ContextProvenanceManifest.test.ts tests/core/context/ContextOptimizer.test.ts --reporter=verbose
```
</verification>

<success_criteria>
- [ ] ContextProvenanceManifest has recordSectionWithReceipt(), markOmitted(), validateReceiptTotals()
- [ ] ContextCompressor.compress() returns omissionReasons: Map<string, OmissionReason>
- [ ] optimizeFromItems() populates receipt entries with included/omissionReason from compressor
- [ ] Stale items (freshness=0) are omitted with omissionReason:'stale'
- [ ] validateReceiptTotals() cross-checks receipt totals against packed sections
- [ ] Existing optimize() method unchanged (backward compatibility)
- [ ] All behavior tests pass
</success_criteria>

<output>
Create `.planning/phases/04b-trust-aware-context-receipts/04b-04-SUMMARY.md` when done
</output>
