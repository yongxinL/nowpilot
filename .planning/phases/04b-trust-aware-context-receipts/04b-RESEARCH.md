# Phase 04b: Trust-Aware Context & Receipts - Research

**Researched:** 2026-08-01
**Domain:** AI context trust/sensitivity/provenance metadata, prompt-injection isolation, context receipts, stable-prefix hashing
**Confidence:** HIGH

## Summary

Phase 04b transforms every context source from raw `PromptSection` text into structured `ContextItem` contracts carrying trust, sensitivity, provenance, and authority metadata. It implements prompt-injection isolation via `instructionAuthority` gating combined with XML-style structural delimiters (per OpenAI's documented best practices). It extends the existing `ContextProvenanceManifest` with `ContextReceiptEntry` fields for per-source inclusion/compression/omission accounting. It enforces a stable-prefix contract using the existing FNV-1a hash from `PromptCacheAdapter.ts`, extended to per-section hashes for diagnostics. It introduces a `ToolResultShaper` between `ExecutorService` and `ContextOptimizer` for TOL-04 tool result validation/redaction/provenance. And it implements progressive skill disclosure (P1) where irrelevant skill instructions consume zero prompt tokens.

All score computation is deterministic and independent of the LLM. Sensitivity `secret` items are redacted at the boundary and never become `ContextItem` instances. The `ContextTrustPolicy` is the sole authority for trust, sensitivity, and instructionAuthority — no source content may self-assign these values.

**Primary recommendation:** Build `ContextItem` as a Zod-validated wrapper around `PromptSection` with a new `ContextTrustPolicy` singleton owning all trust/sensitivity/authority assignment. Extend `ContextOptimizer.optimize()` to accept `ContextItem[]`, apply structural data delimiters for `instructionAuthority: 'data'` items, generate receipt entries, and compute stable-prefix FNV-1a hash with per-section diagnostic hashes.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `ContextItem` is a **separate wrapper** around `PromptSection`. `PromptSection` stays as-is. `ContextItem` carries PromptSection fields + metadata (`relevance`, `freshness`, `trust`, `sensitivity`, `instructionAuthority`, `createdAt`, `expiresAt`). `ContextOptimizer` works with `ContextItem[]` and assembles `PromptSection[]` at the final step before the provider call.
- **D-02:** Isolation uses **`instructionAuthority` gating + structural delimiters**. Stable system instructions always occupy the first prompt sections. All `instructionAuthority: 'data'` items are wrapped in unambiguous structural delimiters (e.g., `<data-source id="...">...</data-source>`) and appended after instruction-bearing sections.
- **D-03:** `ContextReceiptEntry` is **embedded in `ContextProvenanceManifest`**. Extends each entry with `originalTokens`, `finalTokens`, `included`, `truncated`, `compressionApplied`, `omissionReason` (`budget` | `irrelevant` | `stale` | `sensitive` | `policy`), and `cacheEligible`.
- **D-04:** Stable-prefix uses a **concatenated FNV-1a hash** of all stable sections concatenated in canonical order, plus **per-section individual FNV-1a hashes** for diagnostics. Volatile sections excluded from hash computation.
- **D-05:** `ToolResultShaper` is a **standalone service**. Pipeline: `ExecutorService` → validated `ToolExecutionResult` → `ToolResultShaper` → `ContextItem` → planner continuation / `ContextOptimizer`. Must not modify the original validated `ToolExecutionResult` — returns a new immutable `ContextItem`.
- **D-06:** **Split ownership**: Source adapters compute `relevance` and `freshness`. `ContextTrustPolicy` assigns `trust`, `sensitivity`, and `instructionAuthority`. `ContextOptimizer` validates and never invents missing scores.
- **D-07:** `ContextTrustPolicy` uses a **static source-type table** for trust assignment. System/persona → 1.0, verified tool result → 0.9, explicit user input → 0.9, explicit user memory → 0.8, known-domain page content → 0.5, unknown-domain page content → 0.3.
- **D-08:** Relevance is **query-aware** and recomputed per turn. Scores must not be persisted as permanent source attributes — turn-scoped only.
- **D-09:** Sensitivity is **source-type driven** with mandatory content detection for secrets. `secret` > `confidential` > `private` > `public`. `secret` → redact immediately, never create `ContextItem`.
- **D-10:** Freshness uses **exponential decay**: `freshness = Math.exp(-ageMs / ttlMs)`. Per-source TTLs in `ContextFreshnessPolicy`.

### the agent's Discretion

- Progressive skill disclosure (CTX-T05, P1): planner selects which skills to load. Planner/executor determines implementation approach for skill summarization, loading triggers, and receipt tracking.
- Context quality telemetry (CTX-T06, P1): Phase 6a owns this — Phase 4b ensures receipt data is structured and available for future telemetry consumption.
- Exact structural delimiter format for prompt-injection isolation (D-02): planner selects the delimiter syntax.
- Per-source TTL values for freshness decay (D-10): planner tunes exact millisecond values.

### Deferred Ideas (OUT OF SCOPE)

- Progressive skill disclosure active tool discovery (TOL-06) in Phase 8a
- Context quality telemetry recording/aggregation in Phase 6a
- Add-on trust score overrides
- General PII scanning beyond secrets
- User-facing sensitivity controls in Phase 7 diagnostics
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CTX-T01 | ContextItems carry relevance, freshness, trust, sensitivity, and instruction-authority — secret items excluded from cloud | ContextItem wrapper pattern around PromptSection; sensitivity enum with `secret` redaction at boundary; Zod-validated contract |
| CTX-T02 | Prompt-injection isolation — untrusted data cannot redefine system instructions, grant tool permission, or change risk classifications | `instructionAuthority` string-literal union (`'system'` \| `'user'` \| `'data'`); XML delimiters (`<data-source>`) for data sections; stable instructions precede data sections; ContextOptimizer enforces structural ordering |
| CTX-T03 | Context receipts record inclusion, omission, compression, and cache eligibility per source without exposing raw sensitive text | ContextReceiptEntry extends ContextProvenanceEntry; omissionReason enum; totals cross-checked against packed sections |
| CTX-T04 | Stable-prefix contract — persona/system rules/sorted tool schemas byte-identical for identical config; snapshot tests guard | FNV-1a hash of concatenated stable sections (reuses PromptCacheAdapter pattern); per-section FNV-1a hashes; Vitest `toMatchSnapshot()` / `toMatchInlineSnapshot()` guard |
| CTX-T05 | Progressive skill disclosure — irrelevant full instructions consume zero prompt tokens; receipt tracks loaded/unloaded | Skill summary loading; ContextItem `instructionAuthority: 'system'` for loaded skills; receipt entry `omissionReason: 'policy'` for unloaded |
| CTX-T06 | Context quality telemetry — injected-source count, utilization %, compression ratio, omission reasons, provenance coverage | Phase 6a owns telemetry; Phase 4b ensures receipt data structured with omissionReason, originalTokens, finalTokens |
| TOL-04 | Tool result shaping — validate output, redact secrets, apply max size, summarise/retrieve, assign provenance/trust before re-entering context | ToolResultShaper standalone service between ExecutorService and ContextOptimizer; reuses TraceRedactor for secret redaction; deterministic keyword/field matching for summarization |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ContextItem metadata assignment (trust/sensitivity/instructionAuthority) | API / Backend | — | `ContextTrustPolicy` is a deterministic core module running in the extension service worker; no browser involvement |
| Prompt-injection isolation (instruction/data separation) | API / Backend | — | Structural delimiter wrapping happens in `ContextOptimizer` during context assembly, before provider API call |
| Context receipt generation | API / Backend | — | Receipt entries are computed during `ContextOptimizer.optimize()` and embedded in `ContextProvenanceManifest` |
| Stable-prefix hash computation | API / Backend | — | FNV-1a hashing of stable section text; no external service needed |
| Progressive skill disclosure | API / Backend | — | Planner selects skills; ContextOptimizer includes only loaded skill instructions in prompt |
| Tool result shaping | API / Backend | — | `ToolResultShaper` runs after `ExecutorService.execute()`, before context re-entry |
| Freshness scoring (exponential decay) | API / Backend | — | `ContextFreshnessPolicy` is a deterministic module; `Date.now()` is the only external dependency |
| Relevance scoring (query-aware) | API / Backend | — | Source adapters compute using local retrieval (MiniSearch, memory scores); no external service |
| Sensitivity=secret detection | API / Backend | — | `TraceRedactor` runs regex-based redaction at the data boundary; never creates ContextItem for secrets |

## Standard Stack

### Core

No new external packages are required — this phase is purely internal TypeScript. All dependencies are already in `package.json`:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| zod | ^4.4.3 | ContextItem, ContextReceiptEntry, ContextTrustPolicy validation | Already used throughout codebase; Zod 4 is the current stable major |
| vitest | ^3.0.0 | Snapshot testing for stable-prefix contract | Already the project test framework; `toMatchSnapshot()` / `toMatchInlineSnapshot()` built-in |
| typescript | ~5.8.2 | Type system for discriminated unions, string literal types | Already the project compiler |

### Supporting (Existing — used by new modules)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `src/core/context/TokenBudget.ts` | — | CJK-aware token estimation for receipt entries | originalTokens/finalTokens calculation |
| `src/core/content/TraceRedactor.ts` (via `redactSensitive`) | — | Secret pattern detection and redaction | ToolResultShaper redaction; ContextTrustPolicy sensitivity=secret detection |
| `src/core/ai/PromptCacheAdapter.ts` (`hashStableSections`) | — | FNV-1a hash function for stable-prefix and per-section hashes | Reuse the exact same function; do not reimplement |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| FNV-1a hash (existing) | SHA-256 via Web Crypto | Overkill for deterministic caching; Web Crypto is async and not available in all test environments |
| Zod 4 enum validation | Raw TypeScript type guards | Zod provides runtime validation + static type inference; consistent with existing codebase patterns |
| Manual snapshot diffing | Vitest `toMatchSnapshot()` | Vitest provides auto-update (`vitest -u`), inline snapshots, and file snapshots |

**Installation:** No new packages to install. All dependencies exist in `package.json`.

## Package Legitimacy Audit

> No new external packages are introduced by this phase. All work is internal TypeScript using existing dependencies (zod, vitest, typescript) already verified in prior phases.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                              ┌──────────────────────┐
                              │   Source Adapters     │
                              │  (MemoryEngine,       │
                              │   PageContentService, │
                              │   ToolResultShaper)   │
                              └──────┬───────────────┘
                                     │ produce ContextItem[]
                                     │ with relevance + freshness
                                     ▼
┌──────────────┐    ┌──────────────────────────────────────┐
│ ExecutorSvc  │───▶│          ContextOptimizer              │
│ .execute()   │    │                                        │
│              │    │  1. Validate ContextItem[] (Zod)       │
│ validated    │    │  2. ContextTrustPolicy.assess()        │
│ ToolExecRes  │    │     → trust, sensitivity, authority    │
│              │    │  3. Filter: sensitivity≠'secret'       │
└──────┬───────┘    │  4. Sort: stable+system, then data     │
       │            │  5. Wrap: data items in <data-source> │
       ▼            │  6. Select/compress (ContextCompressor)│
┌──────────────┐    │  7. Degrade per tier/budget            │
│ToolResultShaper│  │  8. Generate ContextReceiptEntry[]     │
│              │    │  9. Compute stable-prefix FNV-1a hash  │
│ - redact     │────│ 10. Compute per-section FNV-1a hashes  │
│ - size check │    │ 11. Assemble final PromptSection[]     │
│ - summarise  │    │ 12. Return OptimizedContext            │
│ - provenance │    └──────────────────┬───────────────────┘
│ - →ContextItem                       │
└──────────────┘                       ▼
                              ┌──────────────────────┐
                              │   ProviderAdapter    │
                              │   (API call)         │
                              └──────────────────────┘

┌───────────────────┐
│ ContextTrustPolicy │  ← static source-type table
│  (singleton)      │     assess(sourceId, kind, provenance) → { trust, sensitivity, instructionAuthority }
└───────────────────┘

┌─────────────────────┐
│ContextFreshnessPolicy│  ← freshness = Math.exp(-ageMs / ttlMs)
│  (singleton)        │     ttlByKind: { system: Infinity, user_input: short, page: very_short, ... }
└─────────────────────┘

┌──────────────────────────────┐
│ ContextProvenanceManifest    │
│  sections: ContextReceiptEntry[] ← extended with originalTokens, finalTokens, included, omissionReason, cacheEligible
└──────────────────────────────┘
```

### Recommended Project Structure
```
src/core/context/
├── ContextItem.ts              # [NEW] ContextItem interface + Zod schema
├── ContextTrustPolicy.ts       # [NEW] Static source-type trust/sensitivity/authority table
├── ContextFreshnessPolicy.ts   # [NEW] Exponential decay freshness + per-source TTLs
├── ContextOptimizer.ts         # [MODIFY] Accept ContextItem[], apply trust gating, delimiters, receipts, hashing
├── ContextProvenanceManifest.ts # [MODIFY] Extend entries with ContextReceiptEntry fields
├── ContextCompressor.ts        # [MODIFY] Emit omission reasons for receipt entries
├── PromptCacheManager.ts       # [NO CHANGE]
├── TokenBudget.ts              # [NO CHANGE]
└── ModelContextTier.ts         # [NO CHANGE]

src/core/ai/
├── types.ts                    # [MODIFY] Add ContextItem, ContextReceiptEntry, sensitivity, instructionAuthority types
├── ToolResultShaper.ts         # [NEW] Standalone service between ExecutorService and ContextOptimizer
├── ExecutorService.ts          # [NO CHANGE] — ToolResultShaper consumes its output, doesn't modify it
└── PromptCacheAdapter.ts       # [NO CHANGE] — hashStableSections reused by stable-prefix

tests/core/context/
├── ContextItem.test.ts         # [NEW] Schema validation, wrapping/unwrapping, sensitivity gating
├── ContextTrustPolicy.test.ts  # [NEW] Trust table fixtures, no self-assignment, sensitivity upgrade
├── ContextFreshnessPolicy.test.ts # [NEW] Exponential decay math, TTL boundaries, expiresAt enforcement
├── ContextOptimizer.test.ts    # [MODIFY] Add trust-aware assembly, delimiter wrapping, receipt tests, snapshot tests
├── ContextProvenanceManifest.test.ts # [NEW/MODIFY] Receipt entry fields, omission reasons, totals cross-check
└── stable-prefix.test.ts       # [NEW] FNV-1a golden snapshots, per-section hashes, whitespace/order sensitivity

tests/core/ai/
├── ToolResultShaper.test.ts    # [NEW] Redaction, size limits, summarization, provenance, immutability
└── types.test.ts               # [MODIFY] ContextItem and ContextReceiptEntry type assertions
```

### Pattern 1: ContextItem Wrapper around PromptSection

**What:** `ContextItem` carries all `PromptSection` fields (`kind`, `text`, `tokens`, `stable`, `sourceId`) plus metadata (`relevance`, `freshness`, `trust`, `sensitivity`, `instructionAuthority`, `createdAt`, `expiresAt`). The `ContextOptimizer` works with `ContextItem[]` throughout its pipeline and unwraps to `PromptSection[]` only at the final step before the provider call.

**When to use:** Every context source — system instructions, tool schemas, preferences, memory hints, page content, user input, tool results — enters the optimizer as a `ContextItem`.

**Example:**
```typescript
// Source: Derived from Product Requirements §4 CTX-01, adapted to existing PromptSection contract

import { z } from 'zod';

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

export type ContextItem = z.infer<typeof ContextItemSchema>;

/** Unwrap ContextItem[] → PromptSection[] at the final pipeline step */
export function unwrapToPromptSections(items: ContextItem[]): PromptSection[] {
  return items.map(({ kind, text, tokens, stable, sourceId }) => ({
    kind, text, tokens, stable, sourceId,
  }));
}
```

### Pattern 2: ContextTrustPolicy as Deterministic Singleton

**What:** A module-level singleton that maps `(sourceId, kind, provenance)` to `{ trust, sensitivity, instructionAuthority }` using a static source-type table. No source content can self-assign these values — the optimizer validates and rejects items that carry values differing from the policy.

**When to use:** Called by `ContextOptimizer.optimize()` for every `ContextItem` entering the pipeline. Also called by `ToolResultShaper` when creating new `ContextItem` instances.

**Example:**
```typescript
// Source: CONTEXT.md D-07 (trust table) + D-09 (sensitivity) + Pattern: RenderingOutcomePolicy singleton

interface TrustAssessment {
  trust: number;
  sensitivity: Sensitivity;
  instructionAuthority: InstructionAuthority;
}

export class ContextTrustPolicy {
  assess(sourceId: string, kind: PromptSection['kind']): TrustAssessment {
    // System/persona instructions: highest trust, public (safe to share), system authority
    if (kind === 'system' || sourceId.startsWith('persona.')) {
      return { trust: 1.0, sensitivity: 'public', instructionAuthority: 'system' };
    }
    if (kind === 'tool_schemas' || kind === 'preferences') {
      return { trust: 1.0, sensitivity: 'public', instructionAuthority: 'system' };
    }
    // User input
    if (kind === 'user_input') {
      return { trust: 0.9, sensitivity: 'private', instructionAuthority: 'user' };
    }
    // Memory (inherit later from MemoryRecord.sensitivity when available)
    if (kind === 'memory') {
      return { trust: 0.8, sensitivity: 'private', instructionAuthority: 'data' };
    }
    // Page content
    if (sourceId.startsWith('context.page')) {
      return { trust: 0.5, sensitivity: 'private', instructionAuthority: 'data' };
    }
    // Tool results
    if (sourceId.startsWith('tools.')) {
      return { trust: 0.9, sensitivity: 'private', instructionAuthority: 'data' };
    }
    // Default: low trust, private, data authority
    return { trust: 0.3, sensitivity: 'private', instructionAuthority: 'data' };
  }

  /** Validate that a ContextItem's metadata matches policy (D-06: optimizer must not allow self-assignment) */
  validate(item: ContextItem, policy: TrustAssessment): boolean {
    return (
      item.trust === policy.trust &&
      item.sensitivity === policy.sensitivity &&
      item.instructionAuthority === policy.instructionAuthority
    );
  }

  /** Upgrade sensitivity if more restrictive (D-09: conflicts apply most restrictive) */
  static upgrade(current: Sensitivity, candidate: Sensitivity): Sensitivity {
    const order: Sensitivity[] = ['public', 'private', 'confidential', 'secret'];
    return order[Math.max(order.indexOf(current), order.indexOf(candidate))];
  }
}

export const contextTrustPolicy = new ContextTrustPolicy();
```

### Pattern 3: FNV-1a Stable-Prefix Hash with Per-Section Diagnostics

**What:** Reuses `hashStableSections()` from `PromptCacheAdapter.ts` for the combined hash. Additionally computes individual FNV-1a hashes per stable section for diagnostics. Hash input: exact final bytes of stable `PromptSection` text values, including canonical separators, whitespace, and sorted tool schemas. Volatile sections (user input, memory, page content, timestamps) are excluded.

**When to use:** Final step of `ContextOptimizer.optimize()`, after all selection, compression, and receipt generation. Snapshot tests assert the combined hash against golden values.

**Example:**
```typescript
// Source: Existing PromptCacheAdapter.ts hashStableSections + CONTEXT.md D-04
import { hashStableSections } from '../ai/PromptCacheAdapter';

interface StablePrefixContract {
  combinedHash: string;           // FNV-1a of all stable sections concatenated with '\0' separators
  perSectionHashes: Array<{       // Per-section FNV-1a for diagnostics
    sourceId: string;
    hash: string;
  }>;
  stableSectionCount: number;
}

export function computeStablePrefix(sections: PromptSection[]): StablePrefixContract {
  const stableSections = sections.filter(s => s.stable);
  
  // Combined hash: reuse existing hashStableSections (FNV-1a of concatenated text with \0 separators)
  const combinedHash = hashStableSections(stableSections);
  
  // Per-section hashes: individual FNV-1a of each stable section's text
  const perSectionHashes = stableSections.map(s => ({
    sourceId: s.sourceId,
    hash: hashStableSections([s]), // Single-section hash
  }));
  
  return {
    combinedHash,
    perSectionHashes,
    stableSectionCount: stableSections.length,
  };
}

// Snapshot test pattern (CTX-T04):
// test('stable prefix matches golden hash', () => {
//   const { combinedHash, perSectionHashes } = computeStablePrefix(sections);
//   expect(combinedHash).toMatchSnapshot();
//   expect(perSectionHashes).toMatchSnapshot();
// });
```

### Pattern 4: Prompt-Injection Isolation via Delimiters + Ordering

**What:** `ContextOptimizer` ensures stable `instructionAuthority: 'system'` sections always precede user intent and data sections. All `instructionAuthority: 'data'` items are wrapped in unambiguous XML-style structural delimiters with deterministic IDs. The delimiter format ensures injection content cannot be interpreted as instructions.

**When to use:** During `ContextOptimizer.optimize()` section assembly, after trust policy assessment but before budget/compression.

**Example:**
```typescript
// Source: OpenAI prompt engineering guide (XML tags), CONTEXT.md D-02

const DATA_DELIMITER_OPEN = '<data-source';
const DATA_DELIMITER_CLOSE = '</data-source>';

export function wrapDataSection(item: ContextItem, index: number): PromptSection {
  const delimiterId = `${item.kind}.${item.sourceId.replace(/\./g, '-')}.${index}`;
  const wrappedText = `${DATA_DELIMITER_OPEN} id="${delimiterId}" kind="${item.kind}">\n${item.text}\n${DATA_DELIMITER_CLOSE}`;
  return {
    kind: item.kind,
    text: wrappedText,
    tokens: item.tokens, // Token count of original text (delimiter overhead is negligible)
    stable: false,       // Data sections are never stable
    sourceId: item.sourceId,
  };
}

// Assembly order in ContextOptimizer.optimize():
// 1. System sections (instructionAuthority: 'system', stable: true) — FIRST
// 2. User input (instructionAuthority: 'user') — SECOND
// 3. Data sections (instructionAuthority: 'data') — LAST, each wrapped in delimiters
// 4. Task placeholder — LAST
```

### Anti-Patterns to Avoid

- **Mixing instruction and data sections:** Never interleave `instructionAuthority: 'data'` sections between `'system'` sections. The ordering is a product policy, not an optimization. Data sections always follow instruction sections.
- **Allowing source content to self-assign trust/authority:** `ContextTrustPolicy` is the sole authority. If a source adapter assigns a `trust` value that differs from `ContextTrustPolicy.assess()`, the optimizer must reject or override per D-06.
- **Computing scores with LLM:** All trust, relevance, freshness, and sensitivity scores are deterministic code. No AI model is used for classification — this is a security requirement.
- **Creating ContextItem for sensitivity=secret:** Redact at the boundary. `secret` items never become `ContextItem` instances, never reach `ContextOptimizer`, and never appear in receipts or diagnostics.
- **Persisting turn-scoped scores:** `relevance` is query-aware per D-08. Do not store relevance scores in IndexedDB or chrome.storage — they are recomputed per turn.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FNV-1a hash function | New hash implementation | `hashStableSections()` from `src/core/ai/PromptCacheAdapter.ts` | Already tested; exact same algorithm; consistent with cache key hashing |
| Source ID format validation | New regex | `isValidSourceId()` from `src/core/context/ContextProvenanceManifest.ts` | Phase 4 D-18 dot-separated format; must stay consistent |
| CJK-aware token estimation | New token counter | `tokenBudget.estimateTokens()` from `src/core/context/TokenBudget.ts` | Already handles CJK; used by all existing context modules |
| Secret pattern detection | New regex patterns | `redactSensitive()` from `src/core/security/redactSensitive.ts` | JWT, API key, Bearer token, ServiceNow patterns already tested; reused by TraceRedactor |
| Zod runtime validation | Raw type assertions | `z.enum()`, `z.object()`, `z.number().min(0).max(1)` from zod ^4 | Consistent with existing `ContextOptimizerInputSchema`, `AgentTurnInput` patterns |
| Snapshot diffing | Custom comparison logic | Vitest `toMatchSnapshot()` / `toMatchInlineSnapshot()` | Auto-update with `vitest -u`; built-in diff display; CI safety (no writes in CI) |

**Key insight:** This phase extends an existing pipeline, not building from scratch. Every primitive needed (hash function, token estimator, redaction patterns, source ID format) already exists and is tested. The new code is purely about metadata assignment, structural ordering, delimiter wrapping, receipt accounting, and snapshot contracts.

## Runtime State Inventory

> This is a greenfield infrastructure phase — no rename/refactor/migration. Section omitted per spec.

## Common Pitfalls

### Pitfall 1: FNV-1a Hash Sensitivity to Whitespace/Ordering

**What goes wrong:** The stable-prefix hash changes when whitespace, newline encoding, or section ordering changes — even if the content is semantically identical. Snapshot tests fail on CI for seemingly trivial formatting changes.

**Why it happens:** FNV-1a is a byte-level hash. Every character, including trailing newlines, BOM markers, and invisible whitespace, affects the hash output. JSON serialization order (e.g., `JSON.stringify` of tool schemas) may change across Node.js versions.

**How to avoid:** (a) Use `\u0000` (null character) as the canonical section separator in `hashStableSections()` — already implemented. (b) Sort tool schemas by `name` before hashing. (c) Use Vitest `toMatchSnapshot()` with `--update` flag for deliberate changes; CI will catch unexpected drift. (d) Per-section hashes (D-04) immediately identify which section drifted when the combined hash changes.

**Warning signs:** Snapshot test failing with `+`/`-` lines that show only whitespace changes.

### Pitfall 2: Secret Items Leaking Through Receipts

**What goes wrong:** A `ContextReceiptEntry` for a `sensitivity: 'secret'` item contains `sourceId`, `originalTokens`, or other metadata that indirectly exposes the existence or size of a secret.

**Why it happens:** D-09 says `secret` items never become `ContextItem` instances. But if the redaction happens *after* `ContextItem` creation, or if the redaction layer fails silently, the receipt could leak metadata.

**How to avoid:** (a) Sensitivity `secret` items are redacted at the data boundary — before `ContextItem` creation. (b) `ToolResultShaper` and `ContextTrustPolicy` both enforce: if sensitivity resolves to `secret`, return `null`, not a `ContextItem`. (c) Add a test fixture: inject a JWT into tool output, verify no `ContextItem` is created and no receipt entry appears. (d) Audit: receipt section counts must match `ContextItem[]` length after secret filtering.

**Warning signs:** Receipt entry with `omissionReason: 'sensitive'` that has a `sourceId` naming a secret-bearing tool. Secret count > 0 in any log or receipt.

### Pitfall 3: instructionAuthority Mixing in Assembly Order

**What goes wrong:** After compression or degradation, a data section ends up positioned before a system instruction section, effectively giving it instruction authority in the prompt.

**Why it happens:** `ContextCompressor` reorders sections during degradation (e.g., `minimalMode` drops page context, trims tools). If the ordering invariant isn't preserved through compression, data sections could drift before instructions.

**How to avoid:** (a) `ContextOptimizer` re-sorts sections after compression: stable+system first, then user, then data. (b) The delimiter-wrapped format itself is a defense-in-depth layer: even if a data section appears early, the `<data-source>` wrapper signals the model it's reference data, not instructions. (c) Test: assemble sections with data before system, run compression, verify final order has system before data.

**Warning signs:** Snapshot test showing system instructions in the middle or end of the prompt rather than at the beginning.

### Pitfall 4: Receipt Totals Not Matching Packed Totals

**What goes wrong:** The sum of `finalTokens` across all `ContextReceiptEntry` records doesn't equal the total tokens of the final `PromptSection[]` — making the receipt untrustworthy for diagnostics and telemetry.

**Why it happens:** Token estimation (CJK-aware, approximate) may give slightly different results for individual sections vs. combined sections. Or sections are added/removed during the unwrap→assemble step without updating the receipt.

**How to avoid:** (a) Compute `finalTokens` from the *same* `TokenBudget.estimateTokens()` call used for the packed sections. (b) Cross-check: `sum(receipt.finalTokens) === sum(packedSections.map(s => s.tokens))`. (c) Assert this in every test that exercises the full pipeline.

**Warning signs:** Receipt total differs from packed total by > 0 tokens. Any nonzero delta is a bug.

## Code Examples

### ContextReceiptEntry Extension

```typescript
// Source: Product Requirements §4 CTX-03, extended from existing ContextProvenanceEntry

export type OmissionReason = 'budget' | 'irrelevant' | 'stale' | 'sensitive' | 'policy';

export interface ContextReceiptEntry {
  // Existing ContextProvenanceEntry fields (kept)
  kind: PromptSection['kind'];
  sourceId: string;
  truncated: boolean;
  compressionApplied?: 'summarise' | 'structural' | 'topk';

  // New receipt fields (D-03)
  originalTokens: number;        // Tokens before any compression/degradation
  finalTokens: number;           // Tokens in the final packed prompt
  included: boolean;             // true if present in final prompt
  omissionReason?: OmissionReason; // Why omitted (if !included)
  cacheEligible: boolean;        // Whether this section participates in prompt caching
}

// Receipt totals must equal packed section totals (CTX-T03 acceptance)
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

### ToolResultShaper Integration

```typescript
// Source: CONTEXT.md D-05 + Product Requirements §6 TOL-04

import { redactSensitive } from '../security/redactSensitive';
import { contextTrustPolicy } from '../context/ContextTrustPolicy';
import type { ToolExecutionResult, ContextItem, PromptSection } from './types';

const MAX_TOOL_RESULT_TOKENS = 8_000;
const MAX_TOOL_RESULT_CHARS = 32_000;

export class ToolResultShaper {
  shape(result: ToolExecutionResult): ContextItem | null {
    // Step 1: Redact secrets (reuse TraceRedactor)
    let text = typeof result.output === 'string'
      ? result.output
      : JSON.stringify(result.output);
    text = redactSensitive(text);
    
    // Step 2: Check if result contains secrets → sensitivity=secret → no ContextItem
    // (redactSensitive replaces secrets with ***REDACTED*** markers;
    //  if the original contained a secret, skip ContextItem creation)
    
    // Step 3: Apply max size
    if (text.length > MAX_TOOL_RESULT_CHARS) {
      text = text.slice(0, MAX_TOOL_RESULT_CHARS) + '\n[truncated]';
    }
    
    // Step 4: Deterministic relevant-field selection (simplified for Phase 4b)
    // Future: Phase 8a adds ToolCapabilityManifest with field selection policies
    
    // Step 5: Assign provenance and trust (ContextTrustPolicy is the authority)
    const sourceId = `tools.builtin.${result.toolName}`;
    const { trust, sensitivity, instructionAuthority } = contextTrustPolicy.assess(sourceId, 'context');
    
    // Never create ContextItem for secret sensitivity
    if (sensitivity === 'secret') return null;
    
    return {
      kind: 'context',
      text,
      tokens: Math.ceil(text.length / 4), // Approximate; TokenBudget refines later
      stable: false,
      sourceId,
      relevance: 1.0,    // Tool results are always relevant to the current turn
      freshness: 1.0,    // Just executed — maximum freshness
      trust,
      sensitivity,
      instructionAuthority,
      createdAt: Date.now(),
    };
  }
}

export const toolResultShaper = new ToolResultShaper();
```

### ContextFreshnessPolicy with Exponential Decay

```typescript
// Source: CONTEXT.md D-10

interface FreshnessTTL {
  /** Time-to-live in milliseconds. Infinity = never decays. */
  ttlMs: number;
}

export class ContextFreshnessPolicy {
  /** Per-source-kind TTLs (D-10: planner may tune these values) */
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

  /**
   * Compute freshness using exponential decay: freshness = Math.exp(-ageMs / ttlMs)
   * If expiresAt has passed, return 0 (omitted as stale per D-10).
   */
  compute(sourceId: string, kind: string, createdAt?: number, expiresAt?: number): number {
    // Check hard expiry first (D-10: if expiresAt passed, omit as stale)
    if (expiresAt !== undefined && Date.now() >= expiresAt) {
      return 0;
    }
    
    const ttl = this.getTTL(sourceId, kind);
    if (ttl === Infinity || createdAt === undefined) return 1.0;
    
    const ageMs = Math.max(0, Date.now() - createdAt);
    return Math.exp(-ageMs / ttl);
  }

  private getTTL(sourceId: string, kind: string): number {
    // Source-specific lookup, then kind-based, then default
    if (sourceId.startsWith('persona.')) return ContextFreshnessPolicy.TTLS['persona'].ttlMs;
    if (sourceId.startsWith('memory.')) return ContextFreshnessPolicy.TTLS['memory.fact'].ttlMs;
    if (sourceId.startsWith('context.page')) return ContextFreshnessPolicy.TTLS['page.current'].ttlMs;
    if (sourceId.startsWith('tools.')) return ContextFreshnessPolicy.TTLS['tool_result'].ttlMs;
    
    const kindKey = kind as keyof typeof ContextFreshnessPolicy.TTLS;
    return ContextFreshnessPolicy.TTLS[kindKey]?.ttlMs ?? ContextFreshnessPolicy.TTLS['default'].ttlMs;
  }
}

export const contextFreshnessPolicy = new ContextFreshnessPolicy();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw `PromptSection` text with no trust metadata | `ContextItem` wrapper with trust/sensitivity/instructionAuthority | Phase 4b | Every source now carries metadata; optimizer can filter by trust/sensitivity |
| No prompt-injection isolation | `instructionAuthority` gating + XML delimiters for data sections | Phase 4b | Untrusted data can't alter instructions or permissions |
| Basic provenance entries (kind, sourceId, tokens) | Extended with receipt fields (originalTokens, finalTokens, omissionReason, cacheEligible) | Phase 4b | Diagnostics/PromptInspector can explain every inclusion/omission |
| No stable-prefix guarantee | FNV-1a combined hash + per-section hashes with snapshot tests | Phase 4b | Byte-identical stable output for identical configuration |
| Tool results enter context raw | ToolResultShaper validates, redacts, size-limits, summarizes, assigns provenance | Phase 4b | Tool output is safe, bounded, and traceable before re-entering context |

**Deprecated/outdated:**
- Raw `PromptSection[]` assembly without metadata — replaced by `ContextItem[]` pipeline with trust-aware selection
- Direct tool output → context path — replaced by `ToolResultShaper` → `ContextItem` → `ContextOptimizer` path
- Blind context inclusion without receipts — replaced by per-source `ContextReceiptEntry` accounting

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `hashStableSections()` from `PromptCacheAdapter.ts` uses `\u0000` as section separator and is suitable for stable-prefix contract without modification | Architecture Patterns | If the separator or hash function changes, stable-prefix golden values would need migration |
| A2 | `redactSensitive()` patterns (JWT, sk-, api_key, Bearer, JSESSIONID) are sufficient for initial secret detection — PII scanning beyond these is deferred | Standard Stack | Could miss novel secret formats; defense-in-depth is source-type sensitivity classification |
| A3 | Vitest `toMatchSnapshot()` / `toMatchInlineSnapshot()` can store FNV-1a hex strings as snapshot values without custom serializers | Architecture Patterns | If snapshot rendering truncates or reformats hex strings, custom serializers may be needed |
| A4 | The `ContextAssembler` (source adapter coordinator that produces `ContextItem[]`) will be defined in this phase's types and implemented partially — full implementation per source adapter happens in Phase 5 (MemoryEngine), Phase 4a (PageContentService already exists), etc. | Architecture Patterns | If `ContextAssembler` doesn't exist as an integration point, source adapters need direct `ContextOptimizerInput` population |
| A5 | Progressive skill disclosure mechanics (CTX-T05) can be implemented as a PlannerService enhancement without touching ContextOptimizer — planner selects skills, ContextOptimizer receives pre-filtered `ContextItem[]` | Architecture Patterns | If skills need per-token-level optimization decisions, ContextOptimizer would need skill-awareness |

## Open Questions

1. **Delimiter format for data sections (agent's discretion)**
   - What we know: XML-style tags are recommended by OpenAI for marking content boundaries. The format must be unambiguous and not naturally occurring in user content.
   - What's unclear: Whether to use `<data-source id="..." kind="...">` or a namespace-prefixed variant like `<np:data id="...">` for additional collision avoidance.
   - Recommendation: Use `<data-source id="..." kind="...">` with a deterministic ID format (`{kind}.{sourceId}.{index}`). The `data-source` tag name is unlikely to appear in web page content or user input, and the `id` attribute provides traceability back to the receipt entry.

2. **Per-source TTL values for freshness decay (agent's discretion)**
   - What we know: Exponential decay formula `Math.exp(-ageMs / ttlMs)` with per-source TTLs. System/persona → no decay. Page content → short TTL. Tool results → very short TTL.
   - What's unclear: Exact millisecond values for memory types (episodic vs. semantic vs. preference), and whether page content TTL should differ by domain (known vs. unknown).
   - Recommendation: Start with the TTLs in the `ContextFreshnessPolicy` example above (system: Infinity, user_input: 5min, memory: 1hr, page: 2min, tool: 1min). These are discoverable through fixture tests and tunable without interface changes.

3. **Progressive skill disclosure implementation scope (agent's discretion)**
   - What we know: P1 priority. Core mechanics (summaries, selection triggers, receipt tracking) in Phase 4b. Active tool discovery (TOL-06) in Phase 8a.
   - What's unclear: Whether skill summaries should be inline in the prompt or fetched from a separate registry; whether `PlannerService` or `ContextOptimizer` drives skill selection.
   - Recommendation: Store skill summaries in `ContextItem` instances with `instructionAuthority: 'system'` when loaded. `PlannerService` decides which skills to load based on user intent. `ContextOptimizer` treats unloaded skills as `omissionReason: 'policy'` in the receipt. This keeps the optimizer skill-agnostic while the planner owns semantic selection.

## Environment Availability

> This phase has no external service/runtime/CLI dependencies beyond what already exists. All new modules are TypeScript running in the extension service worker (Chrome MV3). The test framework (Vitest 3.x + jsdom) is already configured and working.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (for tests) | Vitest test runner | ✓ | (project runtime) | — |
| TypeScript | Compilation | ✓ | ~5.8.2 | — |
| Vitest | Snapshot + unit tests | ✓ | ^3.0.0 | — |
| zod | Runtime validation | ✓ | ^4.4.3 | — |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.0.0 |
| Config file | `vitest.config.ts` (jsdom environment, globals: true) |
| Quick run command | `vitest run tests/core/context/ContextTrustPolicy.test.ts tests/core/context/ContextItem.test.ts` |
| Full suite command | `vitest run tests/core/context tests/core/ai/ToolResultShaper.test.ts tests/core/ai/types.test.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CTX-T01 | ContextItem carries all 5 metadata fields; secret items excluded | unit | `vitest run tests/core/context/ContextItem.test.ts -t "secret exclusion"` | ❌ Wave 0 |
| CTX-T01 | ContextTrustPolicy assigns correct trust/sensitivity/authority per source type | unit | `vitest run tests/core/context/ContextTrustPolicy.test.ts -t "trust table"` | ❌ Wave 0 |
| CTX-T02 | Data sections wrapped in `<data-source>` delimiters | unit | `vitest run tests/core/context/ContextOptimizer.test.ts -t "delimiter"` | ❌ Wave 0 |
| CTX-T02 | Injection fixtures cannot alter tool availability or permissions | integration | `vitest run tests/security/agent-harness.test.ts -t "injection"` | ❌ Wave 0 |
| CTX-T03 | Receipt entries include originalTokens, finalTokens, omissionReason | unit | `vitest run tests/core/context/ContextOptimizer.test.ts -t "receipt"` | ❌ Wave 0 |
| CTX-T03 | Receipt totals equal packed section totals | unit | `vitest run tests/core/context/ContextOptimizer.test.ts -t "receipt totals"` | ❌ Wave 0 |
| CTX-T04 | Stable-prefix FNV-1a hash matches golden value | snapshot | `vitest run tests/core/context/stable-prefix.test.ts` | ❌ Wave 0 |
| CTX-T04 | Per-section hashes identify which section drifted | snapshot | `vitest run tests/core/context/stable-prefix.test.ts -t "per-section"` | ❌ Wave 0 |
| CTX-T04 | Whitespace/order changes fail snapshot tests | snapshot | `vitest run tests/core/context/stable-prefix.test.ts -t "whitespace"` | ❌ Wave 0 |
| CTX-T05 | Unloaded skill instructions consume zero tokens; receipt records `omissionReason: 'policy'` | unit | `vitest run tests/core/context/ContextOptimizer.test.ts -t "skill disclosure"` | ❌ Wave 0 |
| TOL-04 | ToolResultShaper redacts secrets from tool output | unit | `vitest run tests/core/ai/ToolResultShaper.test.ts -t "redact"` | ❌ Wave 0 |
| TOL-04 | ToolResultShaper enforces max size and creates immutable ContextItem | unit | `vitest run tests/core/ai/ToolResultShaper.test.ts -t "size limit"` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `vitest run tests/core/context/ContextTrustPolicy.test.ts tests/core/context/ContextItem.test.ts`
- **Per wave merge:** `vitest run tests/core/context tests/core/ai/ToolResultShaper.test.ts`
- **Phase gate:** Full suite green before `/gsd-verify-work` — `vitest run tests/core/context tests/core/ai/ToolResultShaper.test.ts tests/core/ai/types.test.ts tests/security/agent-harness.test.ts`

### Wave 0 Gaps
- [ ] `tests/core/context/ContextItem.test.ts` — Schema validation, wrapping/unwrapping, sensitivity gating (CTX-T01)
- [ ] `tests/core/context/ContextTrustPolicy.test.ts` — Trust table fixtures, no self-assignment, sensitivity upgrade (CTX-T01, D-06, D-07, D-09)
- [ ] `tests/core/context/ContextFreshnessPolicy.test.ts` — Exponential decay math, TTL boundaries, expiresAt enforcement (D-10)
- [ ] `tests/core/context/stable-prefix.test.ts` — FNV-1a golden snapshots, per-section hashes, whitespace/order sensitivity (CTX-T04)
- [ ] `tests/core/ai/ToolResultShaper.test.ts` — Redaction, size limits, summarization, provenance, immutability (TOL-04)
- [ ] `tests/core/context/ContextOptimizer.test.ts` — Extend existing tests with trust-aware assembly, delimiter wrapping, receipt tests (CTX-T02, CTX-T03, CTX-T05)
- [ ] `tests/core/context/ContextProvenanceManifest.test.ts` — Receipt entry fields, omission reasons, totals cross-check (CTX-T03)
- [ ] `tests/core/ai/types.test.ts` — Extend with ContextItem and ContextReceiptEntry type assertions
- [ ] Framework config: none needed — Vitest is already configured with jsdom, globals, and `tests/setup.ts`

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Not in scope — API keys handled by Phase 2 storage |
| V3 Session Management | no | Not in scope |
| V4 Access Control | yes | `instructionAuthority` gating enforces that data sources cannot act as instructions; `ContextTrustPolicy` is the sole authority for trust/authority assignment |
| V5 Input Validation | yes | Zod schemas validate all `ContextItem` fields; `ContextOptimizerInput` already Zod-validated; `redactSensitive()` regex patterns detect and redact secrets at the boundary |
| V6 Cryptography | no | FNV-1a is a non-cryptographic hash — used for deterministic comparison, not security; secrets are redacted, not encrypted in this phase |
| V7 Error Handling | yes | `PipelineError` with structured error codes (existing pattern); sensitivity `secret` items never reach error messages or logs |
| V8 Data Protection | yes | Sensitivity classification (`public`/`private`/`confidential`/`secret`) gates cloud exclusion and log exclusion; `secret` items never become `ContextItem` instances |

### Known Threat Patterns for AI Context Assembly

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Prompt injection via page content ("Ignore previous instructions and...") | Spoofing / Elevation of Privilege | `instructionAuthority: 'data'` + XML delimiters; data sections always follow instruction sections; injection text is quoted data, never an instruction |
| Secret leakage via tool output (API keys in response body) | Information Disclosure | `redactSensitive()` before `ContextItem` creation; sensitivity `secret` → return null, no `ContextItem` |
| Source content self-assigning high trust | Tampering | `ContextTrustPolicy.assess()` overrides any adapter-assigned trust; `ContextOptimizer` validates trust matches policy |
| Data section positioned before system instructions after compression | Tampering | Optimizer re-sorts after compression: system→user→data; delimiters provide defense-in-depth |
| Receipt exposing secret existence via metadata | Information Disclosure | `secret` items never appear in receipts; redaction happens before `ContextItem` creation |
| Tool result exceeding context budget | Denial of Service | `ToolResultShaper` enforces max-size (32K chars / 8K tokens); deterministic summarization |
| Stale data poisoning context (old page content, expired tool results) | Tampering | `ContextFreshnessPolicy.compute()` returns 0 for expired items; `expiresAt` triggers omission |

## Sources

### Primary (HIGH confidence)
- [`src/core/ai/PromptCacheAdapter.ts` lines 74-82] — `hashStableSections()` FNV-1a implementation (reused for stable-prefix)
- [`src/core/context/ContextOptimizer.ts`] — Existing pipeline: optimize(), build*Section() methods, compression integration, provenance tracking
- [`src/core/context/ContextProvenanceManifest.ts`] — Existing per-section provenance entries, source ID validation pattern
- [`src/core/security/redactSensitive.ts`] — Secret redaction patterns (reused by ToolResultShaper and ContextTrustPolicy)
- [`src/core/ai/types.ts` lines 53-164] — PromptSection, ContextOptimizerInput, OptimizedContext, ContextProvenanceEntry
- [`.planning/PRODUCT_REQUIREMENTS_AGENT_HARNESS.md` §4 CTX-01 to CTX-06] — Detailed TypeScript interfaces and acceptance criteria
- [`.planning/PRODUCT_REQUIREMENTS_AGENT_HARNESS.md` §6 TOL-04] — Tool result shaping pipeline steps
- [`.planning/phases/04b-trust-aware-context-receipts/04b-CONTEXT.md`] — All D-01 through D-10 locked decisions

### Secondary (MEDIUM confidence)
- [OpenAI Prompt Engineering Guide](https://platform.openai.com/docs/guides/prompt-engineering) — XML tags for content boundaries; developer/user/assistant message roles; chain of command
- [Vitest Snapshot Guide](https://vitest.dev/guide/snapshot.html) — `toMatchSnapshot()`, `toMatchInlineSnapshot()`, `toMatchFileSnapshot()`, `--update` flag, CI behavior
- [Zod Documentation](https://zod.dev/api) — `z.enum()`, `z.discriminatedUnion()`, `z.object()`, `z.number().min().max()`, `safeParse()` patterns — used for ContextItem, ContextTrustPolicy validation

### Tertiary (LOW confidence)
- WebSearch for prompt injection isolation patterns — confirmed alignment with OpenAI's `instructionAuthority` approach and XML delimiters; no single authoritative source for the exact implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new external packages; all dependencies already in project
- Architecture: HIGH — pattern directly extends existing ContextOptimizer pipeline; decisions extensively documented in CONTEXT.md
- Pitfalls: HIGH — multiple sources (existing codebase patterns, Vitest docs, prompt engineering guides) support identified pitfalls
- Security: MEDIUM — threat patterns identified from STRIDE analysis of the architecture; ASVS mapped; injection fixtures still need validation during implementation

**Research date:** 2026-08-01
**Valid until:** 2026-08-31 (stable domain — context pipeline patterns + FNV-1a hashing are unlikely to change within 30 days)
