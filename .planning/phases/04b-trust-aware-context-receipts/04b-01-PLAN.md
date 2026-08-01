---
phase: 04b-trust-aware-context-receipts
plan: 01
type: tracer
wave: 1
depends_on: []
files_modified:
  - src/core/ai/types.ts
  - src/core/context/ContextItem.ts
  - src/core/context/ContextTrustPolicy.ts
  - src/core/context/ContextOptimizer.ts
  - src/core/context/ContextProvenanceManifest.ts
  - tests/core/context/tracer-pipeline.test.ts
autonomous: true
requirements:
  - CTX-T01
  - CTX-T02
  - CTX-T03

must_haves:
  truths:
    - "System instruction ContextItem enters pipeline → ContextTrustPolicy assesses it → optimizer validates trust → assembles PromptSection with correct sourceId, tokens, kind, stable flag"
    - "Data-source ContextItem (instructionAuthority: data) is wrapped in <data-source id=\"...\"> delimiters and positioned AFTER system sections in the final PromptSection[]"
    - "ContextProvenanceManifest sections carry ContextReceiptEntry fields: originalTokens, finalTokens, included, cacheEligible — populated for every section"
    - "ContextItemSchema rejects items with sensitivity: secret (Zod .refine() or .superRefine()) — secret items must never be created as ContextItem per D-09"
    - "unwrapToPromptSections() strips ContextItem metadata, returns only the PromptSection fields (kind, text, tokens, stable, sourceId) — the assembly contract is preserved"
    - statement: "Empty ContextItem[] input to optimizeFromItems() produces empty OptimizedContext with zero sections and empty receipt — no crash, no null return"
      verification: backstop
    - statement: "When multiple data ContextItems have equal trust (0.5), output ordering within data sections is stable and deterministic — sourceId alphabetical within kind groups"
      verification: backstop
    - statement: "ContextReceiptEntry originalTokens/finalTokens use CJK-aware TokenBudget.estimateTokens() — byte-length is NOT used; CJK chars count as ~0.33 tokens each per the existing estimateTokens contract"
      verification: backstop
    - statement: "ContextItem with instructionAuthority mismatched from ContextTrustPolicy.assess() is rejected before reaching the prompt — no silent downgrade from system to data authority"
      verification: backstop
    - statement: "ContextTrustPolicy.assess() returns the same result for identical (sourceId, kind) inputs on every call — deterministic, LLM-independent, no caching side-effects"
    - statement: "ContextItem.relevance is a turn-scoped field populated by source adapters per D-08; ContextOptimizer validates presence but does NOT recompute relevance — if a required source has no relevance score, the item fails validation with a PipelineError (D-08 contract)"
      verification: backstop
      verification: backstop
    - statement: "ContextOptimizer.optimizeFromItems() returns within 50ms for <20 ContextItems with no degradation — performance regression is detectable"
      verification: backstop
  artifacts:
    - path: "src/core/context/ContextItem.ts"
      provides: "ContextItem interface + Zod schema + Sensitivity/InstructionAuthority enums + unwrapToPromptSections()"
      exports: ["ContextItem", "ContextItemSchema", "SensitivitySchema", "InstructionAuthoritySchema", "unwrapToPromptSections", "Sensitivity", "InstructionAuthority"]
    - path: "src/core/context/ContextTrustPolicy.ts"
      provides: "Module-level singleton — assess() for system/user/data source types + validate() for trust-policy enforcement"
      exports: ["contextTrustPolicy", "ContextTrustPolicy", "TrustAssessment"]
    - path: "src/core/context/ContextOptimizer.ts"
      provides: "Extended optimize() to accept ContextItem[] input with trust validation, data-section delimiter wrapping, basic receipt generation"
    - path: "tests/core/context/tracer-pipeline.test.ts"
      provides: "End-to-end tracer test — system instruction + data section through the full pipeline"

  prohibitions:
    - requirement_id: CTX-T01
      category: privacy
      status: unresolved
      verification: null
      statement: "MUST NOT silently downgrade a secret sensitivity classification to private or public through partial redaction failure, allowing sensitive data to reach cloud prompts."
    - requirement_id: CTX-T01
      category: privacy
      status: unresolved
      verification: null
      statement: "MUST NOT send items with sensitivity: confidential to cloud providers — the cloud-exclusion gate must be enforced at the data boundary, not after provider selection."
    - requirement_id: CTX-T02
      category: safety
      status: unresolved
      verification: null
      statement: "MUST NOT allow adversarial text inside data-section delimiters to escape the delimiter and be interpreted as system instructions."
    - requirement_id: CTX-T03
      category: privacy
      status: unresolved
      verification: null
      statement: "MUST NOT include sourceId or token counts for secret-level items in context receipt entries — the existence and size of secrets must not be inferable from receipt metadata."
    - requirement_id: CTX-T02
      category: safety
      status: unresolved
      verification: null
      statement: "MUST NOT permit machine-generated tool output or memory text that contains 'ignore previous instructions' or similar command language to alter system behavior, tool availability, or permission outcomes."
    - requirement_id: CTX-T05
      category: safety
      status: unresolved
      verification: null
      statement: "MUST NOT silently omit safety-critical system instructions (persona guardrails, tool restrictions, permission policies) during progressive skill disclosure selection."
    - requirement_id: TOL-04
      category: privacy
      status: unresolved
      verification: null
      statement: "MUST NOT allow raw unredacted tool output containing API keys, Bearer tokens, JWTs, or ServiceNow session tokens to enter the context pipeline."
  key_links:
    - "ContextTrustPolicy.assess() → ContextOptimizer.optimizeFromItems() — trust is validated, never self-assigned (D-06)"
    - "ContextItem → unwrapToPromptSections() → PromptSection[] — metadata stripped at final step (D-01)"
    - "ContextOptimizer → ContextProvenanceManifest.recordSectionWithReceipt() — receipt fields populated per section (D-03)"
    - "contextOptimizer.optimizeFromItems() → contextCompressor.compress() — degradation pipeline unchanged, receives post-wrap PromptSection[]"
---

<objective>
Prove the trust-aware context pipeline works end-to-end for a single source type — the thinnest path that touches every layer this phase modifies.

**Purpose:** Establish the ContextItem wrapper contract, ContextTrustPolicy enforcement, data-section delimiter isolation, and receipt extension in a production-quality skeleton that every subsequent plan builds on. After this plan, a system instruction entering as ContextItem flows through trust assessment → validation → optimizer assembly → receipt-populated ProvenanceManifest → unwrapped PromptSection — and a tracer test proves it.

**Output:** 5 source files (1 new, 4 modified), 1 new test file with tracer end-to-end test.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

<interfaces>
<!-- Key types and contracts the executor needs. Extracted from codebase. -->

From src/core/ai/types.ts (existing PromptSection, lines 53-59):
```typescript
export interface PromptSection {
  kind: 'system' | 'tool_schemas' | 'preferences' | 'memory' | 'context' | 'task' | 'user_input';
  text: string;
  tokens: number;
  stable: boolean;
  sourceId: string;
}
```

From src/core/ai/types.ts (existing ContextProvenanceEntry, lines 61-67):
```typescript
export interface ContextProvenanceEntry {
  kind: PromptSection['kind'];
  sourceId: string;
  tokens: number;
  truncated: boolean;
  compressionApplied?: 'summarise' | 'structural' | 'topk';
}
```

From src/core/ai/types.ts (existing OptimizedContext, lines 85-102):
```typescript
export interface OptimizedContext {
  tier: ModelContextTier;
  inputBudget: number;
  outputBudget: number;
  sections: PromptSection[];
  provenance: ContextProvenanceManifest;
  minimalMode: boolean;
  cacheMetadata?: { cacheKeyHash: string; stableSectionCount: number; };
}
```

From src/core/ai/types.ts (existing ContextProvenanceManifest, lines 73-79):
```typescript
export interface ContextProvenanceManifest {
  sections: ContextProvenanceEntry[];
  totalTokens: number;
  minimalMode: boolean;
  workspaceId: string;
  activeSurface: 'sidepanel' | 'full-app';
}
```

From src/core/context/ContextOptimizer.ts (existing optimize() method, lines 70-186): accepts `ContextOptimizerInput`, assembles `PromptSection[]`, runs degradation via `contextCompressor.compress()`, records provenance, returns `OptimizedContext`.

**Phase 4b extends this pipeline to accept `ContextItem[]`:** the input schema stays, but the assembly loop operates on `ContextItem[]` produced by upstream adapters, applying trust validation, delimiter wrapping, and receipt generation before unwrapping to `PromptSection[]`.

From src/core/ai/PromptCacheAdapter.ts (hashStableSections, lines 74-81):
```typescript
export function hashStableSections(sections: Array<Pick<PromptSection, 'text' | 'stable'>>): string {
  const stable = sections.filter((s) => s.stable).map((s) => s.text).join('\u0000');
  let h = 2166136261;
  for (let i = 0; i < stable.length; i++) {
    h ^= stable.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}
```

From src/core/context/ContextProvenanceManifest.ts (existing exports):
```typescript
export function isValidSourceId(sourceId: string): boolean;
export function createProvenanceManifest(workspaceId: string, activeSurface: 'sidepanel' | 'full-app'): ContextProvenanceManifest;
export function recordSection(manifest: ContextProvenanceManifest, section: PromptSection): void;
export function markTruncated(manifest: ContextProvenanceManifest, sourceId: string): void;
export function markCompression(manifest: ContextProvenanceManifest, sourceId: string, method: ContextProvenanceEntry['compressionApplied']): void;
```

From src/core/context/ContextOptimizer.ts (build*Section methods, lines 224-302):
```typescript
private buildSystemSection(): PromptSection { /* returns system instruction PromptSection */ }
private buildToolSchemasSection(selectedToolSchemas): PromptSection { /* returns tool schemas PromptSection */ }
// ... similar for preferences, memory, pageContext, task, userInput
```
</interfaces>
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Define ContextItem + ContextReceiptEntry types + Zod schemas (D-01, D-03)</name>
  <files>src/core/ai/types.ts, src/core/context/ContextItem.ts</files>
  <behavior>
    - Test 1: ContextItemSchema.safeParse(validItem) returns success with all PromptSection fields + metadata fields present
    - Test 2: ContextItemSchema.safeParse({...validItem, trust: 1.5}) returns failure (trust out of [0,1] range)
    - Test 3: ContextItemSchema rejects items with sensitivity: 'secret' — the ContextItemSchema must include a .refine() or .superRefine() check that fails when sensitivity === 'secret' (D-09: secret items are never ContextItem instances)
    - Test 4: unwrapToPromptSections() with 2 ContextItems returns exactly 2 PromptSections with only kind/text/tokens/stable/sourceId — metadata fields absent
    - Test 5: ContextItem type is assignable with all fields (compile-time TypeScript check)
  </behavior>
  <action>
    1. In `src/core/ai/types.ts`, add these new types after the existing `ContextProvenanceManifest` interface (around line 79):
       - `Sensitivity` type: `'public' | 'private' | 'confidential' | 'secret'`
       - `InstructionAuthority` type: `'system' | 'user' | 'data'`
       - `OmissionReason` type: `'budget' | 'irrelevant' | 'stale' | 'sensitive' | 'policy'`
       - `ContextItem` interface: extends PromptSection shape (kind, text, tokens, stable, sourceId) plus metadata (relevance, freshness, trust: all `number` 0-1, sensitivity: Sensitivity, instructionAuthority: InstructionAuthority, createdAt?: number, expiresAt?: number)
       - `ContextReceiptEntry` interface: extends ContextProvenanceEntry (kind, sourceId, truncated, compressionApplied) plus receipt fields (originalTokens: number, finalTokens: number, included: boolean, omissionReason?: OmissionReason, cacheEligible: boolean)
       - Update `ContextProvenanceManifest.sections` type from `ContextProvenanceEntry[]` to `ContextReceiptEntry[]` (D-03: receipt entries ARE provenance entries, just extended)

    2. Create `src/core/context/ContextItem.ts`:
       - Import `z` from 'zod', `PromptSection` from '../ai/types'
       - Define `SensitivitySchema = z.enum(['public', 'private', 'confidential', 'secret'])` — a Zod schema that ACCEPTS 'secret' as a valid enum value (so type inference works), but adds a `.refine()` or `.superRefine()` at the ContextItemSchema level that rejects items with sensitivity === 'secret'
       - Define `InstructionAuthoritySchema = z.enum(['system', 'user', 'data'])`
       - Define `ContextItemSchema = z.object({...})` with all PromptSection fields + metadata fields. Include the sensitivity rejection: `.refine(item => item.sensitivity !== 'secret', { message: 'secret items must not become ContextItem instances — redact at boundary per D-09' })` OR use `.superRefine()`
       - Export `ContextItem` type as `z.infer<typeof ContextItemSchema>`
       - Export `unwrapToPromptSections(items: ContextItem[]): PromptSection[]` — maps over items, returns only `{ kind, text, tokens, stable, sourceId }`
       - Export `Sensitivity` and `InstructionAuthority` types
       - Re-export from `src/core/ai/types.ts` so consumers import from one place

    Per D-01: ContextItem is a SEPARATE wrapper — PromptSection stays untouched. ContextItem carries PromptSection fields + metadata. The schema applies Zod validation with `.refine()` for the secret gate (D-09).
  </action>
  <verify>
    <automated>npx vitest run tests/core/context/tracer-pipeline.test.ts --reporter=verbose 2>&1 | grep -E '(passed|failed|PASS|FAIL|✓|✗)'</automated>
  </verify>
  <done>ContextItem type and Zod schema exist in types.ts and ContextItem.ts. Schema validates well-formed items, rejects out-of-range trust (0-1), rejects sensitivity:secret. unwrapToPromptSections() preserves only PromptSection fields. Tests pass.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create ContextTrustPolicy singleton with basic assessment (D-06, D-07)</name>
  <files>src/core/context/ContextTrustPolicy.ts, tests/core/context/tracer-pipeline.test.ts</files>
  <behavior>
    - Test 1: contextTrustPolicy.assess('core.instructions.system', 'system') returns { trust: 1.0, sensitivity: 'public', instructionAuthority: 'system' }
    - Test 2: contextTrustPolicy.assess('context.page.current-url', 'context') returns { trust: 0.5, sensitivity: 'private', instructionAuthority: 'data' }
    - Test 3: contextTrustPolicy.assess('interaction.user.current-turn', 'user_input') returns { trust: 0.9, sensitivity: 'private', instructionAuthority: 'user' }
    - Test 4: contextTrustPolicy.validate({trust:0.5,...policy}, policy) returns false (mismatched trust — D-06: optimizer must not allow self-assignment)
    - Test 5: ContextTrustPolicy.upgrade('public', 'secret') returns 'secret' (most restrictive wins per D-09)
    - Test 6: ContextTrustPolicy.upgrade('private', 'public') returns 'private' (existing sensitivity is preserved if more restrictive)
  </behavior>
  <action>
    Create `src/core/context/ContextTrustPolicy.ts` as a module-level singleton:
    
    1. Define `TrustAssessment` interface: `{ trust: number; sensitivity: Sensitivity; instructionAuthority: InstructionAuthority }`
    2. Define `ContextTrustPolicy` class with:
       - `assess(sourceId: string, kind: PromptSection['kind']): TrustAssessment` — static source-type table per D-07:
         - system/tool_schemas/preferences/persona.* → trust: 1.0, sensitivity: 'public', instructionAuthority: 'system'
         - user_input → trust: 0.9, sensitivity: 'private', instructionAuthority: 'user'
         - memory → trust: 0.8, sensitivity: 'private', instructionAuthority: 'data'
         - context.page.* → trust: 0.5, sensitivity: 'private', instructionAuthority: 'data'
         - tools.* → trust: 0.9, sensitivity: 'private', instructionAuthority: 'data'
         - default (unknown source) → trust: 0.3, sensitivity: 'private', instructionAuthority: 'data'
       - `validate(item: ContextItem, policy: TrustAssessment): boolean` — returns true only when item.trust === policy.trust AND item.sensitivity === policy.sensitivity AND item.instructionAuthority === policy.instructionAuthority (D-06: optimizer must validate, never invent)
       - `static upgrade(current: Sensitivity, candidate: Sensitivity): Sensitivity` — returns the more restrictive per D-09 order: ['public', 'private', 'confidential', 'secret']
    3. Export `contextTrustPolicy = new ContextTrustPolicy()` as the singleton instance

    This is the tracer version — covers system, user, and data authority types. Full source-type table (all 8 types from D-07, D-09, D-10) lands in Plan 04b-02.
  </action>
  <verify>
    <automated>npx vitest run tests/core/context/tracer-pipeline.test.ts --reporter=verbose 2>&1 | grep -E '(passed|failed|PASS|FAIL|✓|✗)'</automated>
  </verify>
  <done>ContextTrustPolicy singleton with assess/validate/upgrade methods. Trust table covers system/user/data categories. Tests prove correct trust values, validation rejects mismatches, upgrade always returns most restrictive sensitivity.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Wire ContextOptimizer to accept ContextItem[] — trust gating, delimiter wrapping, receipt generation, tracer test</name>
  <files>src/core/context/ContextOptimizer.ts, src/core/context/ContextProvenanceManifest.ts, tests/core/context/tracer-pipeline.test.ts</files>
  <behavior>
    - Test 1 (tracer): System instruction ContextItem (trust:1.0, sensitivity:public, instructionAuthority:system) → optimize() → output contains system PromptSection first, receipt entry with correct originalTokens/finalTokens/included:true/cacheEligible:true
    - Test 2 (trust gating): ContextItem with trust mismatched from policy → optimize() rejects with PipelineError('SCHEMA_INVALID') or validation failure — optimizer must not accept items with self-assigned trust values
    - Test 3 (delimiter wrapping): Data ContextItem (instructionAuthority:data) → optimize() → its PromptSection text is wrapped in <data-source id="context.page.current-url.0" kind="context">...</data-source>
    - Test 4 (ordering): After optimize(), system sections appear before data sections in PromptSection[] — the ordering policy is enforced (D-02)
    - Test 5 (receipt): ContextProvenanceManifest.sections[0] is a ContextReceiptEntry with originalTokens, finalTokens, included, cacheEligible — not just ContextProvenanceEntry
    - Test 6: Passing sensitivity:secret ContextItem through ContextItemSchema.parse() or optimizer input validation must fail — the gate is at schema level, not just the policy
  </behavior>
  <action>
    Part A — Extend ContextProvenanceManifest.ts (D-03):
    
    1. The `recordSection()` function currently creates `ContextProvenanceEntry` objects. Modify it so when called during optimize() with receipt context available, it creates entries that satisfy `ContextReceiptEntry` (extended interface):
       - Add a new function `recordSectionWithReceipt(manifest, section, originalTokens: number, cacheEligible: boolean): void` that pushes entries with `originalTokens`, `finalTokens: section.tokens`, `included: true`, `omissionReason: undefined`, `cacheEligible`
       - Keep the existing `recordSection()` for backward compatibility — it can call `recordSectionWithReceipt` with default cacheEligible: false and originalTokens === section.tokens
       - Export `recordSectionWithReceipt`

    Part B — Extend ContextOptimizer.ts optimize() (D-01, D-02, D-06):
    
    1. Add a new method `optimizeFromItems(items: ContextItem[], input: ContextOptimizerInput): Promise<OptimizedContext>`:
       - For each ContextItem, call `contextTrustPolicy.assess(item.sourceId, item.kind)` to get the policy `TrustAssessment`
       - Validate: `contextTrustPolicy.validate(item, policy)` — if false, throw `PipelineError('SCHEMA_INVALID', 'ContextItem trust metadata does not match ContextTrustPolicy.', { sourceId: item.sourceId, itemTrust: item.trust, policyTrust: policy.trust })`
       - Override metadata: set `item.trust = policy.trust`, `item.sensitivity = policy.sensitivity`, `item.instructionAuthority = policy.instructionAuthority` (the policy is always the authority per D-06)
       - For items with `instructionAuthority: 'data'`: wrap their text in structural delimiters BEFORE token estimation — text becomes `<data-source id="{kind}.{sourceId}.{index}" kind="{kind}">\n{item.text}\n</data-source>` using a deterministic index. The wrapped text gets a new token estimate. The delimiter uses XML-style tags: `<data-source id="..." kind="...">` / `</data-source>`. Set `stable: false` on the wrapped section regardless of original.
       - **Re-sort after all processing**: system sections (instructionAuthority: 'system') FIRST, then user sections (instructionAuthority: 'user'), then data sections (instructionAuthority: 'data'). This is a product policy — never interleave data between instructions (D-02, RESEARCH Pitfall 3).
       - Convert all processed ContextItems to PromptSection[] via `unwrapToPromptSections()`
       - Pass the PromptSection[] through the existing `contextCompressor.compress()` degradation pipeline (unchanged)
       - Generate receipt entries: for each original ContextItem, call `recordSectionWithReceipt(manifest, finalSection, originalTokens: item.tokens, cacheEligible: finalSection.stable)` — originalTokens from the ContextItem, finalTokens from the post-compression PromptSection
       - Continue with existing cacheMetadata hashing, return OptimizedContext

    2. Do NOT change the existing `optimize()` signature — `optimizeFromItems()` is the new entry point. The existing `optimize()` continues to work with raw `ContextOptimizerInput` until all source adapters migrate to `ContextItem[]` (Phase 5 and beyond).
    
    3. Export `optimizeFromItems` as a public method on the ContextOptimizer class.

    Part C — Create tracer test:
    
    `tests/core/context/tracer-pipeline.test.ts`: Write a single end-to-end test that:
    - Creates 2 ContextItems: system instruction + data page context
    - Calls `contextOptimizer.optimizeFromItems(items, minimalInput)` where minimalInput is a valid ContextOptimizerInput
    - Asserts: output sections[0] is the system prompt (unwrapped), output sections[1] is wrapped in <data-source id="context.page.current-url.0" kind="context">...</data-source>
    - Asserts: provenance manifest sections have receipt fields (originalTokens, finalTokens, included, cacheEligible)
    - Asserts: no data section appears before any system section in the final output
  </action>
  <verify>
    <automated>npx vitest run tests/core/context/tracer-pipeline.test.ts --reporter=verbose</automated>
  </verify>
  <done>ContextOptimizer.optimizeFromItems() accepts ContextItem[], validates trust against ContextTrustPolicy, wraps data sections in XML delimiters, re-sorts system→user→data, generates receipt entries in provenance manifest, and returns a valid OptimizedContext. Tracer end-to-end test passes — system instruction + data section flow through the full pipeline and produce correct receipt entries.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Source adapter → ContextItem | Source adapters produce ContextItem with self-assigned relevance/freshness — trust/sensitivity/authority must be policy-enforced, not self-assigned (D-06) |
| ContextItem → ContextOptimizer | Untrusted text enters via data-kind ContextItems — delimiter wrapping + ordering policy prevents injection (D-02) |
| ContextOptimizer → ProviderAdapter | The final PromptSection[] must never carry sensitivity metadata in text — only PromptSection fields survive unwrapping |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-04b-01 | Spoofing | ContextItem.sourceId | medium | mitigate | ContextTrustPolicy.assess() derives authority from kind + sourceId prefix, not from the sourceId alone; validate() rejects mismatched trust/sensitivity/authority |
| T-04b-02 | Tampering | ContextOptimizer data-section ordering | high | mitigate | After delimiter wrapping, re-sort sections (system→user→data); test proves data sections never appear before system sections after compression |
| T-04b-03 | Information Disclosure | ContextReceiptEntry fields | medium | mitigate | Receipt entries never carry raw text — only sourceId, token counts, omissionReason; sensitivity:secret items never become ContextItem instances (Zod gate) |
| T-04b-04 | Elevation of Privilege | Data content posing as instructions | high | mitigate | instructionAuthority:data items are wrapped in <data-source> delimiters + always sorted after system instructions (D-02); exhaustive injection fixtures in Plan 04b-06 |
| T-04b-05 | Spoofing | Source adapter self-assigning trust=1.0 | medium | mitigate | ContextTrustPolicy.validate() hard-rejects items where trust/sensitivity/authority differs from policy (D-06); ContextOptimizer enforces at validation time |
| T-04b-SC | Tampering | npm installs | high | mitigate | No new packages introduced — all work uses existing dependencies (zod, vitest, typescript) already verified in prior phases |
</threat_model>

<verification>
```bash
npx vitest run tests/core/context/tracer-pipeline.test.ts --reporter=verbose
```

Pipeline end-to-end: ContextItem[] → ContextTrustPolicy → delimiter wrapping → receipt → OptimizedContext.
</verification>

<success_criteria>
- [ ] `src/core/context/ContextItem.ts` exists with Zod schema, unwrapToPromptSections(), sensitivity:secret rejection
- [ ] `src/core/context/ContextTrustPolicy.ts` exists with assess/validate/upgrade for system/user/data types
- [ ] `ContextOptimizer.optimizeFromItems()` accepts ContextItem[], validates trust, wraps data sections, re-sorts, generates receipts
- [ ] `ContextProvenanceManifest.recordSectionWithReceipt()` populates receipt fields on manifest entries
- [ ] Tracer test passes: system + data ContextItems flow through pipeline, output has correct ordering and receipt entries
- [ ] All 6 tracer behavior tests pass
</success_criteria>

<output>
Create `.planning/phases/04b-trust-aware-context-receipts/04b-01-SUMMARY.md` when done
</output>
