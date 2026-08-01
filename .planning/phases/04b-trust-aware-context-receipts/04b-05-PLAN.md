---
phase: 04b-trust-aware-context-receipts
plan: 05
type: execute
wave: 4
depends_on: ["04b-01"]
files_modified:
  - src/core/context/ContextOptimizer.ts
  - tests/core/context/stable-prefix.test.ts
autonomous: true
requirements:
  - CTX-T04

must_haves:
  truths:
    - "computeStablePrefix(sections) returns combinedHash (FNV-1a of all stable sections concatenated with '\u0000' separators) — identical sections always produce identical hashes"
    - "computeStablePrefix() returns perSectionHashes: Array<{sourceId: string, hash: string}> — one FNV-1a hash per stable section for diagnostic drift detection (D-04)"
    - "computeStablePrefix() excludes volatile sections (user_input, memory, context, task, timestamps, scores, lifecycle fields) from hash computation — only stable:true sections are included"
    - "Vitest snapshot tests guard the stable-prefix contract — snapshot test fails on any whitespace, ordering, or content change in stable sections (CTX-T04)"
    - "Per-section hashes immediately identify which section drifted when the combined hash changes — diagnostics for stable-prefix breakage"
    - "Persona and system rules produce byte-identical output for identical configuration — snapshot tests fail on unexpected drift"
   artifacts:
     - path: "src/core/context/ContextOptimizer.ts"
       provides: "computeStablePrefix() method added to ContextOptimizer — called as the final step of optimizeFromItems() to compute stable-prefix contract"
     - path: "tests/core/context/stable-prefix.test.ts"
       provides: "Snapshot tests (Vitest toMatchSnapshot) for combined hash + per-section hashes; byte-stability guards for persona/system/tool schema text"
   key_links:
     - "PromptSection[] (stable:true only) → hashStableSections() from PromptCacheAdapter → combinedHash — FNV-1a reused, not reimplemented"
     - "stableSections.map(s => hashStableSections([s])) → perSectionHashes[] — individual FNV-1a per stable section for drift diagnostics (D-04)"
     - "computeStablePrefix() → cacheMetadata.perSectionHashes — optimizeFromItems() populates perSectionHashes in final return (CTX-T04)"
     - "persona/system/tool_schemas PromptSection.text → snapshot tests (toMatchSnapshot) — byte-stability guarded against accidental drift"
     - "volatile sections (user_input, memory, context page, timestamps) → EXCLUDED from hash computation — only stable:true sections participate"
---

<objective>
Enforce the stable-prefix contract (CTX-T04): persona, system rules, and sorted tool schemas must produce byte-identical output for identical configuration. FNV-1a hash guards the contract; per-section hashes enable diagnostic drift detection; Vitest snapshot tests catch unexpected changes.

**Purpose:** The stable-prefix guarantees that deterministic prompt components (system instructions, persona, tool schemas) are byte-identical across turns and configurations. This is load-bearing for prompt caching (Phase 4 cacheKeyHash reuse) and for predictable LLM behavior. Any drift is caught by snapshot tests.

**Output:** 1 modified source file, 1 new test file with Vitest snapshot tests.
</objective>

<execution_context>
@/Users/george.li/.config/opencode/gsd-core/workflows/execute-plan.md
@/Users/george.li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md

<interfaces>
From src/core/ai/PromptCacheAdapter.ts (existing hashStableSections, lines 74-81):
```typescript
/** FNV-1a hash of stable section text joined with '\u0000' separators. Returns 8-char lowercase hex. */
export function hashStableSections(sections: Array<Pick<PromptSection, 'text' | 'stable'>>): string;
```

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

From src/core/context/ContextOptimizer.ts (optimizeFromItems, created in 04b-01):
```typescript
export class ContextOptimizer {
  async optimizeFromItems(items: ContextItem[], input: ContextOptimizerInput): Promise<OptimizedContext>;
}
```

**Stable prefix contract (D-04):**
- Combined FNV-1a hash of ALL stable sections concatenated with `'\u0000'` separators → the authoritative hash
- Per-section individual FNV-1a hashes → diagnostic metadata identifying which section drifted
- Volatile sections EXCLUDED from hash: user input (kind:'user_input'), memory text (kind:'memory', stable:false), page content (kind:'context', stable:false), tool results (kind:'context', stable:false), timestamps, operation IDs, relevance scores, freshness scores, lifecycle fields (createdAt, expiresAt)
- Hash input uses exact final bytes of stable PromptSection.text — including canonical separators, whitespace, and sorted tool schemas
- Reuses `hashStableSections()` from PromptCacheAdapter — do NOT reimplement FNV-1a
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add computeStablePrefix() to ContextOptimizer + snapshot tests (CTX-T04, D-04)</name>
  <files>src/core/context/ContextOptimizer.ts, tests/core/context/stable-prefix.test.ts</files>
  <behavior>
    - Test 1: computeStablePrefix() with 2 stable sections (same text) returns identical combinedHash on two calls — deterministic
    - Test 2: computeStablePrefix() with 2 stable sections + 2 volatile sections returns stableSectionCount: 2 — only stable sections counted
    - Test 3: Changing stable section text produces different combinedHash
    - Test 4: Changing whitespace in stable section text produces different combinedHash (FNV-1a is byte-level)
    - Test 5: Reordering stable sections produces different combinedHash (order affects concatenation)
    - Test 6: perSectionHashes array length === stable section count; each entry has sourceId and hash
    - Test 7: Snapshot — combinedHash.toMatchSnapshot() guards against accidental drift
    - Test 8: Snapshot — perSectionHashes.toMatchSnapshot() provides diagnostic per-section hashes
    - Test 9: Persona text and system instructions produce byte-identical hashes for identical config — two calls with same text produce same hash
    - Test 10: Adding volatile data (user input change) does NOT change combinedHash — volatile sections excluded
  </behavior>
  <action>
    Add `computeStablePrefix()` to the ContextOptimizer class in `src/core/context/ContextOptimizer.ts`:

    1. Define the `StablePrefixContract` interface (local to ContextOptimizer.ts or in types.ts):
    ```typescript
    interface StablePrefixContract {
      combinedHash: string;
      perSectionHashes: Array<{ sourceId: string; hash: string }>;
      stableSectionCount: number;
    }
    ```

    2. Add a public method `computeStablePrefix(sections: PromptSection[]): StablePrefixContract`:
       - Filter: `const stableSections = sections.filter(s => s.stable)`
       - Combined hash: `const combinedHash = hashStableSections(stableSections)` — reuses existing FNV-1a from PromptCacheAdapter (RESEARCH: "do not reimplement")
       - Per-section hashes: `stableSections.map(s => ({ sourceId: s.sourceId, hash: hashStableSections([s]) }))` — single-section hash for diagnostics
       - Return: `{ combinedHash, perSectionHashes, stableSectionCount: stableSections.length }`
    
    3. Call `computeStablePrefix()` in `optimizeFromItems()` as the final step, after receipt generation and before the return. Add the result to the returned `OptimizedContext` as an additional optional field `stablePrefix?: StablePrefixContract` — or integrate the combinedHash into the existing `cacheMetadata`. 

    **Integration decision (agent discretion):** Since `cacheMetadata` already carries `cacheKeyHash` (the FNV-1a hash of stable sections for prompt caching), the stable-prefix contract's `combinedHash` is the SAME value. Rather than duplicate it, add `perSectionHashes` to `cacheMetadata`:
    
    Modify the `cacheMetadata` type (in types.ts or inline) to include:
    ```typescript
    cacheMetadata?: {
      cacheKeyHash: string;
      stableSectionCount: number;
      perSectionHashes?: Array<{ sourceId: string; hash: string }>;
    }
    ```
    
    Populate `perSectionHashes` from `computeStablePrefix().perSectionHashes` in the final return of `optimizeFromItems()`.

    Create `tests/core/context/stable-prefix.test.ts`:
    - Import `describe, it, expect` from vitest
    - Import ContextOptimizer (or computeStablePrefix if exported separately)
    - Create test fixture helper: `function buildSection(overrides): PromptSection`
    - Write all 10 behavior tests above
    - For snapshot tests: use `expect(combinedHash).toMatchSnapshot()` and `expect(perSectionHashes).toMatchSnapshot()` — these are the first snapshot tests in the codebase; Vitest will create `__snapshots__/` directory automatically
    - Use `toMatchInlineSnapshot()` as a fallback if file-based snapshots are not preferred
  </action>
  <verify>
    <automated>npx vitest run tests/core/context/stable-prefix.test.ts --reporter=verbose</automated>
  </verify>
  <done>computeStablePrefix() produces combined FNV-1a hash + per-section hashes for diagnostics. Volatile sections excluded. Snapshot tests guard against unexpected drift. optimizeFromItems() populates perSectionHashes in cacheMetadata. All 10 behavior tests pass including snapshot guards.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Stable section text → FNV-1a hash | The hash is deterministic — but text encoding differences (BOM, CRLF vs LF) can produce different hashes |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-04b-16 | Tampering | Stable section text encoding drift | low | accept | FNV-1a is byte-level — text encoding changes (CRLF, BOM, invisible whitespace) will change the hash; snapshot tests catch this immediately; the fix is a deliberate text update + snapshot regeneration |
| T-04b-17 | Information Disclosure | Per-section hashes leaking section content | low | accept | Per-section hashes are FNV-1a hex strings — they are irreversible and carry no content information; they are diagnostic metadata, not security-sensitive |
</threat_model>

<verification>
```bash
npx vitest run tests/core/context/stable-prefix.test.ts --reporter=verbose
```
</verification>

<success_criteria>
- [ ] computeStablePrefix() produces deterministic combined FNV-1a hash for identical stable sections
- [ ] Volatile sections (user input, memory, page, timestamps) excluded from hash
- [ ] Per-section hashes provide diagnostic drift detection
- [ ] Snapshot tests guard against unexpected stable-section changes
- [ ] cacheMetadata carries perSectionHashes from optimizeFromItems()
- [ ] Reuses hashStableSections() from PromptCacheAdapter — no reimplementation
- [ ] All 10 behavior tests pass including snapshots
</success_criteria>

<output>
Create `.planning/phases/04b-trust-aware-context-receipts/04b-05-SUMMARY.md` when done
</output>
