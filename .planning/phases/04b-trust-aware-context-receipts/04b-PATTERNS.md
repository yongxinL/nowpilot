# Phase 04b: Trust-Aware Context & Receipts - Pattern Map

**Mapped:** 2026-08-01
**Files analyzed:** 16 (9 new, 7 modified)
**Analogs found:** 14 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/context/ContextItem.ts` | model/schema | CRUD (type definition + Zod validation) | `src/core/ai/types.ts` (PromptSection + Zod patterns) | exact |
| `src/core/context/ContextTrustPolicy.ts` | policy service | request-response (pure deterministic mapping) | `src/core/ai/RenderingOutcomePolicy.ts` | exact |
| `src/core/context/ContextFreshnessPolicy.ts` | calculation utility | transform (time-based computation) | `src/core/context/TokenBudget.ts` | exact |
| `src/core/ai/ToolResultShaper.ts` | pipeline transform service | transform (tool result → ContextItem) | `src/core/context/ContextCompressor.ts` + `src/core/ai/ExecutorService.ts` | role-match |
| `src/core/context/ContextOptimizer.ts` (MODIFY) | assembly service | CRUD (context pipeline) | itself (extend existing `optimize()`) | self |
| `src/core/context/ContextProvenanceManifest.ts` (MODIFY) | model/utility | CRUD (provenance tracking) | itself (extend entry interface) | self |
| `src/core/context/ContextCompressor.ts` (MODIFY) | pipeline service | transform (degradation) | itself (add omission reason emission) | self |
| `src/core/ai/types.ts` (MODIFY) | model/types | N/A (type definitions) | itself (add new interfaces + string literal unions) | self |
| `tests/core/context/ContextItem.test.ts` | test | N/A | `tests/core/ai/persona/PersonaInjector.test.ts` | exact |
| `tests/core/context/ContextTrustPolicy.test.ts` | test | N/A | `tests/core/context/ContextOptimizer.test.ts` | exact |
| `tests/core/context/ContextFreshnessPolicy.test.ts` | test | N/A | `tests/core/context/ContextOptimizer.test.ts` (TokenBudget section) | exact |
| `tests/core/context/stable-prefix.test.ts` | test | N/A | `tests/core/ai/persona/PersonaInjector.test.ts` | exact |
| `tests/core/ai/ToolResultShaper.test.ts` | test | N/A | `tests/core/context/ContextCompressor.test.ts` | exact |
| `tests/core/context/ContextOptimizer.test.ts` (MODIFY) | test | N/A | itself (extend existing tests) | self |
| `tests/core/context/ContextProvenanceManifest.test.ts` | test | N/A | `tests/core/context/ContextOptimizer.test.ts` | exact |
| `tests/core/ai/types.test.ts` (MODIFY) | test | N/A | `tests/core/ai/persona/PersonaInjector.test.ts` (schema section) | exact |

---

## Pattern Assignments

### `src/core/context/ContextItem.ts` (model/schema, CRUD)

**Analog:** `src/core/ai/types.ts` lines 53–59 (PromptSection) + `src/core/context/ContextOptimizer.ts` lines 31–49 (Zod schema pattern)

**Imports pattern** (from ContextOptimizer.ts lines 1–17):
```typescript
import { z } from 'zod';
import type { PromptSection } from '../ai/types';
```

**Zod schema pattern** (from ContextOptimizer.ts lines 31–49, 58–75):
```typescript
// Enum schemas first — defined at module scope
const ToolSchemaInfoSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  jsonSchema: z.unknown().optional(),
  dangerous: z.boolean().optional(),
  source: z.string().optional(),
});

// Input validation schema uses .safeParse() for validation
const ContextOptimizerInputSchema = z.object({
  operationId: z.string().min(1),
  model: z.string().min(1),
  modelContextWindow: z.number().int().positive(),
  // ...
});
```

**Core type pattern** (from types.ts lines 53–59, PromptSection interface):
```typescript
// ContextItem wraps PromptSection — carries PromptSection fields + metadata
export const SensitivitySchema = z.enum(['public', 'private', 'confidential', 'secret']);
export type Sensitivity = z.infer<typeof SensitivitySchema>;

export const InstructionAuthoritySchema = z.enum(['system', 'user', 'data']);
export type InstructionAuthority = z.infer<typeof InstructionAuthoritySchema>;

export const ContextItemSchema = z.object({
  // PromptSection fields (D-01: kept as-is)
  kind: z.enum(['system', 'tool_schemas', 'preferences', 'memory', 'context', 'task', 'user_input']),
  text: z.string(),
  tokens: z.number().int().nonnegative(),
  stable: z.boolean(),
  sourceId: z.string().min(1),
  // Metadata fields (D-01)
  relevance: z.number().min(0).max(1),
  freshness: z.number().min(0).max(1),
  trust: z.number().min(0).max(1),
  sensitivity: SensitivitySchema,
  instructionAuthority: InstructionAuthoritySchema,
  createdAt: z.number().optional(),
  expiresAt: z.number().optional(),
});
```

**Unwrap helper pattern** (pure function, no class — same as `buildPersonaBlock` in PersonaInjector.ts):
```typescript
/** Unwrap ContextItem[] → PromptSection[] at the final pipeline step */
export function unwrapToPromptSections(items: ContextItem[]): PromptSection[] {
  return items.map(({ kind, text, tokens, stable, sourceId }) => ({
    kind, text, tokens, stable, sourceId,
  }));
}
```

---

### `src/core/context/ContextTrustPolicy.ts` (policy service, deterministic mapping)

**Analog:** `src/core/ai/RenderingOutcomePolicy.ts` (full file) — policy pattern: static table + `classify*` + pure policy derivation function

**Imports pattern** (from RenderingOutcomePolicy.ts lines 1–2):
```typescript
import type { PromptSection } from '../ai/types';
import type { Sensitivity, InstructionAuthority } from './ContextItem';
```

**Singleton + static table pattern** (from RenderingOutcomePolicy.ts lines 38–44):
```typescript
// Static lookup table — private readonly, never mutated
const FALLBACK_ANSWERS: Readonly<Record<Exclude<RenderBlockedCondition, 'none'>, string>> = {
  'no-evidence': "I was unable to complete that action...",
  unverified: 'The action was submitted, but I could not verify...',
  failed: 'I could not confirm that the action completed...',
};
```

**Core policy class pattern** (from TokenBudget.ts lines 83–112 — module-level singleton export):
```typescript
export class ContextTrustPolicy {
  assess(sourceId: string, kind: PromptSection['kind']): TrustAssessment {
    // Static source-type table per D-07
    if (kind === 'system' || sourceId.startsWith('persona.')) {
      return { trust: 1.0, sensitivity: 'public', instructionAuthority: 'system' };
    }
    // ... per-kind branches
    return { trust: 0.3, sensitivity: 'private', instructionAuthority: 'data' };
  }

  /** Validate that a ContextItem's metadata matches policy (D-06) */
  validate(item: ContextItem, policy: TrustAssessment): boolean {
    return (
      item.trust === policy.trust &&
      item.sensitivity === policy.sensitivity &&
      item.instructionAuthority === policy.instructionAuthority
    );
  }

  /** Upgrade sensitivity if more restrictive (D-09) */
  static upgrade(current: Sensitivity, candidate: Sensitivity): Sensitivity {
    const order: Sensitivity[] = ['public', 'private', 'confidential', 'secret'];
    return order[Math.max(order.indexOf(current), order.indexOf(candidate))];
  }
}

export const contextTrustPolicy = new ContextTrustPolicy();
```

**Export pattern** (from TokenBudget.ts line 113 — module-level singleton instance):
```typescript
export const contextTrustPolicy = new ContextTrustPolicy();
```

---

### `src/core/context/ContextFreshnessPolicy.ts` (calculation utility, time-based transform)

**Analog:** `src/core/context/TokenBudget.ts` — module-level singleton, static allocation table, deterministic calculation

**Imports pattern** (from TokenBudget.ts line 1):
```typescript
import type { PromptSection } from '../ai/types';
```

**Static constant table pattern** (from TokenBudget.ts lines 19–25):
```typescript
// Per-source-kind TTLs (D-10: planner may tune these values)
private static readonly TTLS: Record<string, FreshnessTTL> = {
  'system':           { ttlMs: Infinity },
  'tool_schemas':     { ttlMs: Infinity },
  'preferences':      { ttlMs: Infinity },
  'persona':          { ttlMs: Infinity },
  'user_input':       { ttlMs: 300_000 },       // 5 minutes
  'memory.fact':      { ttlMs: 3_600_000 },     // 1 hour
  'memory.episodic':  { ttlMs: 1_800_000 },     // 30 minutes
  'page.current':     { ttlMs: 120_000 },       // 2 minutes
  'page.cached':      { ttlMs: 600_000 },       // 10 minutes
  'tool_result':      { ttlMs: 60_000 },        // 1 minute
  'default':          { ttlMs: 300_000 },       // 5 minutes
};
```

**Core compute method pattern** (from TokenBudget.ts lines 35–49 — deterministic, uses `Date.now()`):
```typescript
compute(sourceId: string, kind: string, createdAt?: number, expiresAt?: number): number {
  // Hard expiry first (D-10)
  if (expiresAt !== undefined && Date.now() >= expiresAt) return 0;
  
  const ttl = this.getTTL(sourceId, kind);
  if (ttl === Infinity || createdAt === undefined) return 1.0;
  
  const ageMs = Math.max(0, Date.now() - createdAt);
  return Math.exp(-ageMs / ttl);
}
```

**Export pattern** (from TokenBudget.ts line 113):
```typescript
export const contextFreshnessPolicy = new ContextFreshnessPolicy();
```

---

### `src/core/ai/ToolResultShaper.ts` (pipeline transform service, tool result → ContextItem)

**Analog:** `src/core/context/ContextCompressor.ts` (full file) — class-based pipeline service, singleton export, private static data + `src/core/ai/ExecutorService.ts` (tool execution context, imports, pattern)

**Imports pattern** (from ContextCompressor.ts lines 1–5, ExecutorService.ts lines 1–3):
```typescript
import { z } from 'zod';
import type { ContextItem, ToolExecutionResult, PromptSection } from './types';
import { redactSensitive } from '../security/redactSensitive';
import { contextTrustPolicy } from '../context/ContextTrustPolicy';
```

**Service class pattern** (from ContextCompressor.ts lines 42–47 — class with singleton export):
```typescript
// Module-level constants
const MAX_TOOL_RESULT_TOKENS = 8_000;
const MAX_TOOL_RESULT_CHARS = 32_000;

export class ToolResultShaper {
  shape(result: ToolExecutionResult): ContextItem | null {
    // Step 1: Redact secrets (reuse TraceRedactor)
    let text = typeof result.output === 'string'
      ? result.output
      : JSON.stringify(result.output);
    text = redactSensitive(text);
    
    // Step 2: Apply max size
    if (text.length > MAX_TOOL_RESULT_CHARS) {
      text = text.slice(0, MAX_TOOL_RESULT_CHARS) + '\n[truncated]';
    }
    
    // Step 3: Assign provenance and trust
    const sourceId = `tools.builtin.${result.toolName}`;
    const { trust, sensitivity, instructionAuthority } = contextTrustPolicy.assess(sourceId, 'context');
    
    // Never create ContextItem for secret sensitivity (D-09)
    if (sensitivity === 'secret') return null;
    
    return {
      kind: 'context',
      text,
      tokens: Math.ceil(text.length / 4),
      stable: false,
      sourceId,
      relevance: 1.0,
      freshness: 1.0,
      trust,
      sensitivity,
      instructionAuthority,
      createdAt: Date.now(),
    };
  }
}

export const toolResultShaper = new ToolResultShaper();
```

**Error handling pattern** (from redactSensitive.ts lines 27–28 — null-safe input guard):
```typescript
if (typeof input !== 'string' || input.length === 0) return '';
```

---

### `src/core/context/ContextOptimizer.ts` (MODIFY — assembly service, CRUD)

**Analog:** itself — `src/core/context/ContextOptimizer.ts` lines 70–186 (existing `optimize()` method)

The existing `optimize()` method is the exact template for the modified version. Key sections to extend:

1. **Accept `ContextItem[]` instead of raw `ContextOptimizerInput`** — the input schema stays for validation, but the assembly loop now operates on `ContextItem[]`.
2. **Inject `ContextTrustPolicy.validate()`** — between assembly and degradation (after line ~120).
3. **Add structural delimiter wrapping** for `instructionAuthority: 'data'` items — new private method, before final assembly.
4. **Generate `ContextReceiptEntry[]`** — in the provenance manifest recording loop (after line ~148).
5. **Compute stable-prefix FNV-1a hash** — in the final return (after line ~175), reusing `hashStableSections()` from PromptCacheAdapter.

**Key existing patterns to copy from:**

**Abort signal checking** (lines 87–91):
```typescript
const signal = input.abortSignal;
if (signal?.aborted) {
  throw new PipelineError('ABORTED', 'Context optimization was aborted.', {
    stage: 'optimize-entry',
  });
}
```

**Zod validation** (lines 78–84):
```typescript
const validation = ContextOptimizerInputSchema.safeParse(input);
if (!validation.success) {
  throw new PipelineError('SCHEMA_INVALID', 'ContextOptimizer input validation failed.', {
    issues: validation.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  });
}
```

**Provenance recording loop** (lines 148–152):
```typescript
const manifest = createProvenanceManifest(input.workspaceId, input.activeSurface);
for (const section of sections) {
  recordSection(manifest, section);
}
```

**Section builder pattern** (lines 224–302 — each `build*Section()` returns a `PromptSection`):
```typescript
private buildSystemSection(): PromptSection {
  return {
    kind: 'system',
    text: SYSTEM_PROMPT_TEXT,
    tokens: tokenBudget.estimateTokens(SYSTEM_PROMPT_TEXT),
    stable: true,
    sourceId: 'core.instructions.system',
  };
}
```

---

### `src/core/context/ContextProvenanceManifest.ts` (MODIFY — model/utility)

**Analog:** itself — `src/core/context/ContextProvenanceManifest.ts` lines 1–55 (existing provenance functions)

Key extensions:
1. `ContextProvenanceEntry` → add receipt fields (or define `ContextReceiptEntry extends ContextProvenanceEntry`)
2. New `recordSection` variant that accepts receipt fields
3. New `validateReceiptTotals()` function

**Existing pattern to extend** (lines 33–44):
```typescript
export function recordSection(manifest: ContextProvenanceManifest, section: PromptSection): void {
  if (!isValidSourceId(section.sourceId)) {
    throw new Error(`ContextProvenanceManifest: invalid sourceId "${section.sourceId}".`);
  }
  manifest.sections.push({
    kind: section.kind,
    sourceId: section.sourceId,
    tokens: section.tokens,
    truncated: false,
  });
  manifest.totalTokens += section.tokens;
}
```

**New receipt fields to add** (per D-03):
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

---

### `src/core/context/ContextCompressor.ts` (MODIFY — pipeline service, transform)

**Analog:** itself — existing degradation pipeline. The modification is: emit `omissionReason` per section for receipt population.

**Key existing patterns to extend:**
- `ContextCompressor.compress()` return type (line ~70) — add `omissionReasons: Map<string, OmissionReason>`
- Each degradation step function — annotate why items were dropped/trimmed

---

### `src/core/ai/types.ts` (MODIFY — type definitions)

**Analog:** itself — all existing type definitions

**String literal union pattern** (from types.ts lines 248–258):
```typescript
export type AgentTrajectoryState =
  | 'assembling-context'
  | 'planning'
  | 'waiting-for-permission'
  // ...
```

**New types to add following the same pattern:**
```typescript
export type Sensitivity = 'public' | 'private' | 'confidential' | 'secret';
export type InstructionAuthority = 'system' | 'user' | 'data';
export type OmissionReason = 'budget' | 'irrelevant' | 'stale' | 'sensitive' | 'policy';
```

**New interfaces to add** (following PromptSection pattern lines 53–59, ContextProvenanceEntry pattern lines 61–67):
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

export interface ContextReceiptEntry {
  kind: PromptSection['kind'];
  sourceId: string;
  truncated: boolean;
  compressionApplied?: 'summarise' | 'structural' | 'topk';
  originalTokens: number;
  finalTokens: number;
  included: boolean;
  omissionReason?: OmissionReason;
  cacheEligible: boolean;
}
```

**Modify `ContextProvenanceManifest`** (lines 73–79) to use `ContextReceiptEntry[]` instead of `ContextProvenanceEntry[]`.

---

### `tests/core/context/ContextItem.test.ts` (NEW — test)

**Analog:** `tests/core/ai/persona/PersonaInjector.test.ts` — schema validation test pattern

**Import/describe pattern** (from PersonaInjector.test.ts lines 1–4):
```typescript
import { describe, it, expect } from 'vitest';
import { ContextItemSchema } from '../../../../src/core/context/ContextItem';
```

**Schema test pattern** (from PersonaInjector.test.ts lines 78–90):
```typescript
describe('ContextItemSchema', () => {
  it('validates a well-formed ContextItem', () => {
    const result = ContextItemSchema.safeParse(VALID_ITEM);
    expect(result.success).toBe(true);
  });

  it('rejects items with sensitivity: secret', () => {
    const result = ContextItemSchema.safeParse({ ...VALID_ITEM, sensitivity: 'secret' });
    // Secret items should never be created as ContextItem (D-09)
    // Instead, test that the creation boundary rejects them
  });
});
```

**Test fixture builder pattern** (from ContextOptimizer.test.ts lines 60–68):
```typescript
function buildItem(overrides: Partial<ContextItem>): ContextItem {
  return {
    kind: 'system',
    text: '',
    tokens: 0,
    stable: true,
    sourceId: 'core.instructions.system',
    relevance: 1.0,
    freshness: 1.0,
    trust: 1.0,
    sensitivity: 'public',
    instructionAuthority: 'system',
    ...overrides,
  };
}
```

---

### `tests/core/context/ContextTrustPolicy.test.ts` (NEW — test)

**Analog:** `tests/core/context/ContextOptimizer.test.ts` — test structure for deterministic mapping

**Import pattern** (from ContextOptimizer.test.ts lines 1–8):
```typescript
import { describe, it, expect } from 'vitest';
import { contextTrustPolicy } from '../../../src/core/context/ContextTrustPolicy';
```

**Test pattern** (TokenBudget test section lines 90–155 — testing deterministic tables):
```typescript
describe('ContextTrustPolicy', () => {
  it('assigns trust 1.0 for system sections', () => {
    const result = contextTrustPolicy.assess('core.instructions.system', 'system');
    expect(result.trust).toBe(1.0);
    expect(result.sensitivity).toBe('public');
    expect(result.instructionAuthority).toBe('system');
  });

  it('assigns trust 0.9 for user input', () => {
    const result = contextTrustPolicy.assess('interaction.user.current-turn', 'user_input');
    expect(result.trust).toBe(0.9);
  });

  it('assigns instructionAuthority: data for page content', () => {
    const result = contextTrustPolicy.assess('context.page.current-url', 'context');
    expect(result.instructionAuthority).toBe('data');
  });

  it('rejects items with mismatched trust values', () => {
    const policy = contextTrustPolicy.assess('core.instructions.system', 'system');
    // Item with self-assigned trust=0.5 should fail validation
    expect(contextTrustPolicy.validate({ trust: 0.5, ...policy }, policy)).toBe(false);
  });
});
```

---

### `tests/core/context/ContextFreshnessPolicy.test.ts` (NEW — test)

**Analog:** `tests/core/context/ContextOptimizer.test.ts` — TokenBudget test section (lines 90–155)

**Import pattern** (from TokenBudget test section):
```typescript
import { describe, it, expect } from 'vitest';
import { contextFreshnessPolicy } from '../../../src/core/context/ContextFreshnessPolicy';
```

**Test pattern** (deterministic calculation with boundary values):
```typescript
describe('ContextFreshnessPolicy', () => {
  it('returns 1.0 for system sections (no decay)', () => {
    expect(contextFreshnessPolicy.compute('core.instructions.system', 'system', Date.now())).toBe(1.0);
  });

  it('returns 0 when expiresAt has passed (D-10)', () => {
    expect(contextFreshnessPolicy.compute('tools.test', 'tool_result', Date.now(), Date.now() - 1)).toBe(0);
  });

  it('decays exponentially with age', () => {
    const ttlMs = 1000;
    const ageMs = 1000;
    // freshness = Math.exp(-1) ≈ 0.368
    const fresh = contextFreshnessPolicy.compute('tools.test', 'tool_result', Date.now() - ageMs);
    expect(fresh).toBeCloseTo(Math.exp(-1), 2);
  });
});
```

---

### `tests/core/context/stable-prefix.test.ts` (NEW — test)

**Analog:** `tests/core/ai/persona/PersonaInjector.test.ts` — byte-stability tests (lines 49–65)

**Import pattern** (from PersonaInjector.test.ts):
```typescript
import { describe, it, expect } from 'vitest';
import { computeStablePrefix } from '../../../src/core/context/ContextOptimizer';
import { hashStableSections } from '../../../src/core/ai/PromptCacheAdapter';
```

**Snapshot test pattern** (Vitest `toMatchSnapshot()` — first use in this codebase):
```typescript
describe('stable-prefix contract (CTX-T04)', () => {
  it('produces byte-identical combined hash for identical stable sections', () => {
    const sections = [
      { kind: 'system' as const, text: 'You are a helpful AI.', tokens: 5, stable: true, sourceId: 'core.instructions.system' },
      { kind: 'tool_schemas' as const, text: '[{"name":"search"}]', tokens: 3, stable: true, sourceId: 'tools.builtin.selected' },
    ];
    const a = computeStablePrefix(sections);
    const b = computeStablePrefix(sections);
    expect(a.combinedHash).toBe(b.combinedHash);
    expect(a).toMatchSnapshot();
  });

  it('produces per-section hashes for diagnostic drift detection', () => {
    const sections = [
      { kind: 'system' as const, text: 'System instructions', tokens: 3, stable: true, sourceId: 'core.instructions.system' },
      { kind: 'tool_schemas' as const, text: '[{"name":"search"}]', tokens: 3, stable: true, sourceId: 'tools.builtin.selected' },
    ];
    const { perSectionHashes } = computeStablePrefix(sections);
    expect(perSectionHashes).toHaveLength(2);
    expect(perSectionHashes[0].sourceId).toBe('core.instructions.system');
    expect(perSectionHashes[1].sourceId).toBe('tools.builtin.selected');
    expect(perSectionHashes).toMatchSnapshot();
  });

  it('excludes volatile sections (user input, memory, timestamps) from hash', () => {
    const sections = [
      { kind: 'system' as const, text: 'System', tokens: 1, stable: true, sourceId: 'core.instructions.system' },
      { kind: 'user_input' as const, text: 'Hello', tokens: 1, stable: false, sourceId: 'interaction.user.current-turn' },
    ];
    const result = computeStablePrefix(sections);
    // Only stable sections count
    expect(result.stableSectionCount).toBe(1);
  });
});
```

**Byte-stability pattern** (from PersonaInjector.test.ts lines 50–54):
```typescript
it('produces byte-stable output for the same profile', () => {
  const a = buildPersonaBlock(DEFAULT_PERSONA);
  const b = buildPersonaBlock(DEFAULT_PERSONA);
  expect(a).toBe(b);
});
```

---

### `tests/core/ai/ToolResultShaper.test.ts` (NEW — test)

**Analog:** `tests/core/context/ContextCompressor.test.ts` — test structure: mock setup, fixture builders, pipeline test

**Imports pattern** (from ContextCompressor.test.ts lines 1–5):
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ToolExecutionResult, ContextItem } from '../../../src/core/ai/types';
import { toolResultShaper } from '../../../src/core/ai/ToolResultShaper';
```

**Fixture builder pattern** (from ContextOptimizer.test.ts lines 60–68):
```typescript
function buildResult(overrides: Partial<ToolExecutionResult>): ToolExecutionResult {
  return {
    toolName: 'test_tool',
    output: { result: 'ok' },
    durationMs: 10,
    toolCallId: 'tc-001',
    ...overrides,
  };
}
```

**Test pattern**:
```typescript
describe('ToolResultShaper', () => {
  it('returns ContextItem for valid tool result', () => {
    const result = toolResultShaper.shape(buildResult({ output: 'simple text' }));
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('context');
    expect(result!.sourceId).toBe('tools.builtin.test_tool');
    expect(result!.instructionAuthority).toBe('data');
  });

  it('redacts secrets from tool output', () => {
    const secretOutput = 'sk-proj-abc123secretkey';
    const result = toolResultShaper.shape(buildResult({ output: secretOutput }));
    expect(result!.text).not.toContain('sk-proj-abc123secretkey');
    expect(result!.text).toContain('***REDACTED***');
  });

  it('returns null for sensitivity=secret (D-09 — never create ContextItem)', () => {
    // Test that redaction prevents ContextItem creation when output is pure secret
  });

  it('enforces max size and appends truncation marker', () => {
    const largeOutput = 'x'.repeat(50000);
    const result = toolResultShaper.shape(buildResult({ output: largeOutput }));
    expect(result!.text.length).toBeLessThanOrEqual(33000); // 32K + marker
    expect(result!.text).toContain('[truncated]');
  });

  it('does not mutate the original ToolExecutionResult (D-05)', () => {
    const original = buildResult({ output: 'original text' });
    const outputBefore = original.output;
    toolResultShaper.shape(original);
    expect(original.output).toBe(outputBefore); // unchanged
  });
});
```

---

### `tests/core/context/ContextOptimizer.test.ts` (MODIFY — test)

**Analog:** itself — extensions to existing test suites

New test sections to add following the existing pattern (from lines 157–268):
- `ContextItem acceptance` — optimizer now accepts `ContextItem[]`
- `Trust-aware gating` — `ContextTrustPolicy.validate()` rejects mismatched items
- `Delimiter wrapping` — data sections wrapped in `<data-source>`
- `Receipt generation` — `ContextReceiptEntry` populated correctly
- `Receipt totals cross-check` — `validateReceiptTotals()` passes
- `Stable-prefix hash` — combined hash matches golden value

---

### `tests/core/context/ContextProvenanceManifest.test.ts` (NEW — test)

**Analog:** `tests/core/context/ContextOptimizer.test.ts` — provenance test sections (lines 203–225)

**Test pattern** (existing provenance tests):
```typescript
describe('ContextProvenanceManifest with receipts', () => {
  it('records receipt fields per section', () => {
    // verify originalTokens, finalTokens, included, omissionReason, cacheEligible
  });

  it('receipt totals equal packed section totals (CTX-T03)', () => {
    expect(validateReceiptTotals(receipt, packedSections)).toBe(true);
  });

  it('omission reasons match degradation steps applied', () => {
    // budget | irrelevant | stale | sensitive | policy
  });
});
```

---

### `tests/core/ai/types.test.ts` (MODIFY — test)

**Analog:** `tests/core/ai/persona/PersonaInjector.test.ts` — schema validation test pattern (lines 78–90)

**Test pattern:**
```typescript
describe('ContextItem type', () => {
  it('is assignable with all required fields', () => {
    // TypeScript compile-time check + runtime Zod validation
  });
});

describe('ContextReceiptEntry type', () => {
  it('extends ContextProvenanceEntry with receipt fields', () => {
    // Verify receipt entry shape
  });
});
```

---

## Shared Patterns

### Authentication / Authorization — NOT APPLICABLE
This is a core infrastructure phase with no auth layer. Modules in `src/core/context/` and `src/core/ai/` are internal service worker code. No user authentication or authorization is needed.

### Error Handling
**Source:** `src/core/ai/PipelineError.ts` lines 1–55
**Apply to:** All new service files (ContextTrustPolicy, ContextFreshnessPolicy, ToolResultShaper)

```typescript
import { PipelineError } from '../ai/PipelineError';

// Throw pattern
throw new PipelineError(
  'SCHEMA_INVALID',
  'ContextItem validation failed: sensitivity cannot be secret.',
  { sourceId: item.sourceId, actualSensitivity: item.sensitivity },
);
```

**Note:** Policy classes (ContextTrustPolicy, ContextFreshnessPolicy) are pure deterministic functions — they return values, not throw. They only throw on programming errors (invalid input shapes). Pipeline errors are thrown by consumers (ContextOptimizer, ToolResultShaper).

### Module Singleton Pattern
**Source:** `src/core/context/TokenBudget.ts` line 113, `src/core/context/ContextCompressor.ts` line 202, `src/core/context/ContextOptimizer.ts` line 305

```typescript
// Class definition with methods, then:
export const contextTrustPolicy = new ContextTrustPolicy();
export const contextFreshnessPolicy = new ContextFreshnessPolicy();
export const toolResultShaper = new ToolResultShaper();
```

### Zod Validation Pattern
**Source:** `src/core/context/ContextOptimizer.ts` lines 31–75

```typescript
import { z } from 'zod';

const SchemaNameSchema = z.object({
  field: z.string().min(1),
  enumField: z.enum(['a', 'b', 'c']),
  numericField: z.number().min(0).max(1).optional(),
});

// Usage:
const validation = SchemaNameSchema.safeParse(input);
if (!validation.success) {
  throw new PipelineError('SCHEMA_INVALID', 'validation failed', { issues: validation.error.issues });
}
```

### Source ID Validation
**Source:** `src/core/context/ContextProvenanceManifest.ts` lines 7–12

```typescript
import { isValidSourceId } from './ContextProvenanceManifest';

// SourceId format: dot-separated, e.g. 'core.instructions.system', 'tools.builtin.search'
if (!isValidSourceId(sourceId)) {
  throw new Error(`Invalid sourceId "${sourceId}".`);
}
```

### FNV-1a Hash Function
**Source:** `src/core/ai/PromptCacheAdapter.ts` lines 69–75
**Apply to:** Stable-prefix computation in ContextOptimizer

```typescript
import { hashStableSections } from '../ai/PromptCacheAdapter';

// Combined hash: all stable sections with '\0' separators
const combinedHash = hashStableSections(stableSections);

// Per-section hash: individual section (single-element array)
const perSectionHash = hashStableSections([stableSections[i]]);
```

### Secret Redaction
**Source:** `src/core/security/redactSensitive.ts` lines 27–39
**Apply to:** ToolResultShaper, ContextTrustPolicy sensitivity detection

```typescript
import { redactSensitive } from '../security/redactSensitive';

text = redactSensitive(text);
```

### Test Setup
**Source:** `vitest.config.ts` (jsdom environment, globals: true) + `tests/setup.ts` (chrome APIs, BroadcastChannel, IndexedDB mocks)
**Apply to:** All new test files

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
```

### Dynamic Import Pattern (Context Tests)
**Source:** `tests/core/context/ContextOptimizer.test.ts` lines 81–82

```typescript
// Avoid side-effect issues with module-level mocks
const { classifyModelContext } = await import('../../../src/core/context/ModelContextTier');
```

### Test Fixture Builder Pattern
**Source:** `tests/core/context/ContextOptimizer.test.ts` lines 60–68

```typescript
function buildSection(overrides: Partial<PromptSection>): PromptSection {
  return {
    kind: 'system',
    text: '',
    tokens: 0,
    stable: true,
    sourceId: 'core.instructions.system',
    ...overrides,
  };
}
```

---

## No Analog Found

Files with no close match in the codebase:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tests/core/context/stable-prefix.test.ts` | test (snapshot) | N/A | No existing Vitest `toMatchSnapshot()` tests in the codebase — this will be the first. Use RESEARCH.md Pattern 3 + Vitest snapshot docs. |

**Mitigation:** RESEARCH.md §Architecture Patterns → Pattern 3 provides the `computeStablePrefix()` function design and snapshot test template. The PersonaInjector.test.ts byte-stability pattern (lines 49–65) provides the conceptual analog for deterministic output testing — snapshot tests extend this with `.toMatchSnapshot()`.

---

## Metadata

**Analog search scope:** `src/core/context/`, `src/core/ai/`, `src/core/security/`, `tests/core/context/`, `tests/core/ai/`, `tests/core/ai/persona/`
**Files scanned in detail:** 11 (ContextOptimizer.ts, ContextCompressor.ts, ContextProvenanceManifest.ts, TokenBudget.ts, types.ts, RenderingOutcomePolicy.ts, ReplanPolicy.ts, ExecutorService.ts, PromptCacheAdapter.ts, PersonaInjector.ts, redactSensitive.ts)
**Test files scanned:** 3 (ContextOptimizer.test.ts, ContextCompressor.test.ts, PersonaInjector.test.ts)
**Pattern extraction date:** 2026-08-01
