# Phase 7: Trust-Aware Context and Receipts - Pattern Map

**Mapped:** 2026-08-30
**Files analyzed:** 10 (5 new modules, 1 new type append, 2 modified sources, 2 test dirs + package.json)
**Analogs found:** 9 / 10 (1 partial — the vitest file-snapshot mechanism has no repo precedent)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/core/context/trust/TrustPolicy.ts` (NEW) | service (pure policy) | transform | `src/core/context/ContextCompressor.ts` | exact (same dir, same flow, same conventions) |
| `src/core/context/trust/contextItems.ts` (NEW) | service (pipeline builder) | transform | `src/core/context/ContextOptimizer.ts` (`buildSourcedSections` + `sourceIdFor`) | exact |
| `src/core/context/trust/ContextReceipt.ts` (NEW) | service (derivation) | transform | `src/core/context/ContextProvenanceManifest.ts` + `ContextOptimizer.ts:441-445` (D-77 trace) | role-match |
| `src/core/context/trust/ContextQualityMetrics.ts` (NEW) | service (derivation) | transform | `ContextOptimizer.ts:441-445` (`manifestTruncatedSources` derived-aggregate) | role-match |
| `src/core/context/trust/SkillDisclosure.ts` (NEW) | service (renderer) | transform | `src/core/context/ContextCompressor.ts` (`summarizeHistory` return shape) | role-match |
| `src/types/harness.ts` (MOD, additive append) | model | CRUD | itself (existing C.1 Phase-4 type block, lines 1-60) | exact |
| `src/core/context/ContextOptimizer.ts` (MOD, additive) | service | transform | itself (WorkingSection, assemble walk, sourceIdFor, D-77 surface) | exact |
| `tests/core/context/trust/**` (NEW, incl. `*.snapshot.*` + `fixtures/`) | test | — | `tests/core/context/ContextOptimizer.test.ts` | exact |
| `tests/security/prompt-injection/**` (NEW) | test | — | `tests/core/security/secrets-inspection.test.ts` + `tests/isolation/cross-entrypoint-imports.test.ts` | role-match |
| `package.json` (MOD — `verify:phase-7` re-point) | config | — | itself (`verify:phase-5`/`verify:phase-6` script strings) | exact |

## Pattern Assignments

### `src/core/context/trust/TrustPolicy.ts` (service, transform) — O.3 verbatim

**Analog:** `src/core/context/ContextCompressor.ts` (120 lines — same directory, same pure-function-over-pipeline style)

**Imports pattern** (ContextCompressor.ts:15-17 — type-only relative imports, no barrel):
```typescript
import type { PromptSection } from '../ai/types';
import type { Summarizer } from './types';
import { countTokensHeuristic } from './TokenBudget';
```
For TrustPolicy: `import type { ContextItem, TrustLevel } from '@/types/harness';` (O.3 spec 6369 — the ONLY `@/` import inside src/core; spec-mandated because harness.ts is the canonical C.1 home).

**Header-comment convention** (ContextCompressor.ts:1-14 — every src/core module opens with a `//` block citing spec lines + decision IDs + locked conventions):
```typescript
// ContextCompressor — D-75 pure compression strategies operating on the A8
// sections ContextOptimizer passes them (§2.4 rungs 3/4/5/6).
// ...
// Section text conventions (LOCKED, shared with ContextOptimizer):
//   [MEMORY]        one '<id>\t<content>' line per memory hint
//   [TOOL SCHEMAS]  one '<name>\t<description>' line per tool, name-sorted (§1.3)
//   [CONTEXT]       'URL: <url>\nTITLE: <title>\n<body>' + history turns as
//                   'TURN <ts>: <text>' lines (Phase 7 supplies the turns)
```

**Core pattern — pure map over input, spread-return, token recount** (ContextCompressor.ts:28-41 — `compressStructural`):
```typescript
export function compressStructural(section: PromptSection): PromptSection {
  if (section.kind !== 'CONTEXT') return section;
  const lines = section.text.split('\n');
  // ... transform text ...
  const text = [...header, bodyText.slice(0, keep)].join('\n');
  return { ...section, text, tokens: countTokensHeuristic(text) };  // RECOUNT after transform
}
```
The O.3 policy is the same shape — `applyTrustPolicy(items: ContextItem[]): ContextItem[]` returns `{ ...it, instructionAuthority: false, text: `<untrusted_data source="${it.sourceId}">\n${it.text}\n</untrusted_data>` }`. **Recount tokens after wrapping** (research Pattern 1: "Token counts must reflect post-wrap text … recount after wrapping so `finalTokens` stays accurate") — the `countTokensHeuristic` import from `./TokenBudget` (ContextCompressor.ts:17) is the shipped accounting unit.

**Error-handling/guard seam — throwing variant lives OUTSIDE the pure path.** The repo's never-throw discipline: `assemble` returns the `AssembleResult` union (ContextOptimizer.ts:100-112) and `ContextPack.pack` throws only on closed-set violations (ContextPack.ts:39-42). O.3's throwing guard (research Code Example 4) follows the `CONTEXT_TOO_LARGE` literal precedent (ContextOptimizer.ts:465) — `Object.assign(new Error('blocked'), { code: 'CONTEXT_INSTRUCTION_INJECTION_BLOCKED' })`, no registry edit (D-38).

### `src/core/context/trust/contextItems.ts` (service, transform) — item pipeline (D-93/D-94)

**Analog:** `src/core/context/ContextOptimizer.ts` — `buildSourcedSections` (271-339) and `sourceIdFor` (349-360).

**Source-identity function — reuse the LOCKED switch** (ContextOptimizer.ts:349-360; the item pipeline reuses it for `ContextItem.sourceId`):
```typescript
function sourceIdFor(kind: string, input: ContextOptimizerInput): string {
  switch (kind) {
    case 'CONTEXT':
      return input.pageContext ? input.pageContext.url : 'context';
    case 'MEMORY':
      return input.memoryHints.map((hint) => hint.id).join(',');
    case 'TOOL SCHEMAS':
      return toolNamesSorted(input.selectedToolSchemas).join(',');
    default:
      return MANIFEST_KIND_MAP[kind];
  }
}
```

**Section-construction conventions to mirror** (ContextOptimizer.ts:276-321): per-source text builders (`buildToolSchemasText` 363-369, `prefsCompact` 372-381, `buildContextText` 385-388) each produce a `PromptSection` with `tokens: heuristicTokenCounter.count(text)`. The item pipeline builds a parallel `ContextItem[]` — same per-source construction, tagged with the D-94 trust map (`[SYSTEM]`/`[TOOL SCHEMAS]` → `trust:'system'`; `[USER PREFERENCES]`/`[USER INPUT]` → `'user'`; `[MEMORY]` → `'retrieved'`; `[CONTEXT]` → `'untrusted'`).

**D-72 re-export precedent** (ContextOptimizer.ts:21 + types.ts:23): `contextItems.ts` should import types from `@/types/harness` (mandated) — do NOT create a local `trust/types.ts` (Pitfall 6).

### `src/core/context/trust/ContextReceipt.ts` (service, transform) — derived receipt (D-95)

**Analog:** `src/core/context/ContextProvenanceManifest.ts` (record mapping + schema-parse discipline) + `ContextOptimizer.ts:441-445` (D-77 derived-view precedent).

**Record-mapping + schema-parse pattern** (ContextProvenanceManifest.ts:82-93 — `buildManifest` maps records then validates at the boundary):
```typescript
export function buildManifest(input: BuildManifestInput): ContextProvenanceManifest {
  const omissionRecords: ManifestSectionRecord[] = [
    { kind: 'system', sourceId: 'system', tokens: 0, truncated: true },
    { kind: 'task', sourceId: 'task', tokens: 0, truncated: true },
  ];
  return ContextProvenanceManifestSchema.parse({
    sections: [...input.sectionRecords, ...omissionRecords],
    totalTokens: input.totalTokens,
    minimalMode: input.minimalMode,
    workspaceId: input.workspaceId,
    activeSurface: input.activeSurface,
  });
}
```
The receipt derives from these same records — `included:false` + `omitReason:'no-input-source'` come from the by-design omission records (sourceId `'system'`/`'task'`, lines 83-86). `finalTokens` = `record.tokens`; `compression` = `record.compressionApplied` (the union `'summarise'|'structural'|'topk'` matches C.1 verbatim). `cacheEligible` = the A8 `stable` flag — the manifest does NOT carry it, so `deriveContextReceipt(manifest, originalTokens, sections)` takes sections in (research Pattern 2 table).

**Derived-view precedent** (ContextOptimizer.ts:441-445 — `manifestTruncatedSources`, sourceIds only, never bodies):
```typescript
function manifestTruncatedSources(manifest: ContextProvenanceManifest): string[] {
  return manifest.sections
    .filter((s) => s.truncated && s.sourceId !== 'system' && s.sourceId !== 'task')
    .map((s) => s.sourceId);
}
```
The receipt + `untrustedDataPresent` (Contract A) + metrics attach to `OptimizedContext` as **additive fields** — the exact D-77 precedent (ContextOptimizer.ts:67-71 where `contextTier`/`truncated`/`truncatedSources` were added without breaking callers).

### `src/core/context/trust/ContextQualityMetrics.ts` (service, transform) — CTX-06 aggregates

**Analog:** `ContextOptimizer.ts:441-445` (derived aggregate from manifest) + `ContextProvenanceManifest.ts` (record iteration).

**Aggregate-only discipline (hard boundary):** same filter/map/reduce over `manifest.sections` as `manifestTruncatedSources` — counts per `TrustLevel`, truncation/omission counts, compression counts, `minimalMode` flag, token-utilization ratio from the receipt's `originalTokens`/`finalTokens`. **Never section bodies** (Contract B; mirrors the D-77 trace surface). Imports: `import type { ContextProvenanceManifest } from '../ContextProvenanceManifest';` (relative, ContextProvenanceManifest.ts:10 precedent).

### `src/core/context/trust/SkillDisclosure.ts` (service, transform) — CTX-05 mechanism

**Analog:** `src/core/context/ContextCompressor.ts` (`summarizeHistory` return shape) + `src/core/context/ContextPack.ts` (`pack()` return shape).

**Return-shape precedent** — `{ text, tokens }` is the repo's renderer contract (ContextPack.ts:36-51 and ContextCompressor.ts:87-119):
```typescript
export function pack(sections: PromptSection[]): { prompt: string; totalTokens: number } {
  // ...
  const prompt = ordered.map((section) => section.text).join('\n\n');
  const totalTokens = ordered.reduce((sum, section) => sum + section.tokens, 0);
  return { prompt, totalTokens };
}
```
`renderSkillDisclosure(candidates): { text: string; tokens: number }` (research Code Example 5) follows the same shape; tokens via `countTokensHeuristic` (ContextCompressor.ts:17 import). Shape aligned to `ISkill` (spec 1826-1856) — the `SkillDisclosureCandidate` interface with `trigger`/`description`/`fullInstructions`/`active` is a declare-now seam (Phase 15 owns real impls), mirroring the `Summarizer` declare-now/populate-later interface (types.ts:46-53).

### `src/types/harness.ts` (model, CRUD) — append trust types verbatim

**Analog:** itself — the existing C.1 block is the exact style to replicate.

**Header-comment + verbatim C.1 style** (harness.ts:1-17):
```typescript
/**
 * Canonical Phase-4 agent-reliability type home — Appendix C.1
 * (PRODUCT_SPEC_v0_1.md:4849-4876), verbatim.
 *
 * This file is the SINGLE canonical declaration site for the reliability
 * types (D-60): ...
 * C.1 shapes are TS interfaces (no Zod mandated — Appendix O.2 does not
 * require schemas; these are compile-time contracts inside the AI core). The
 * closed literal unions are the "make illegal states unrepresentable"
 * discipline (D-38 / §21.6: no invented statuses).
 */
```

**Append pattern** (harness.ts:19-60 — plain TS interfaces, closed literal unions, doc comments per field):
```typescript
/** C.1 — closed 10-value trajectory phase union (§28.2 AGT-01). */
export type AgentTrajectoryPhase = 'assembling-context' | 'planning' | ... ;
```
Phase-7 appends (spec 4879-4900 verbatim, research Code Example 2): `export type TrustLevel = 'system' | 'user' | 'tool' | 'retrieved' | 'untrusted';`, `export interface ContextItem { id; kind: PromptSection['kind']; text; tokens; trust; instructionAuthority; relevance; freshness; sensitivity; sourceId }`, `export interface ContextReceiptEntry { sourceId; included; originalTokens; finalTokens; compression?; cacheEligible; omitReason? }`. Note `ContextItem.kind` references `PromptSection['kind']` — import it type-only (harness.ts currently has no imports; add `import type { PromptSection } from '../core/ai/types';` at top — the `ToolExecutionResult` `import('@/types/harness')` seam at ai/types.ts:138 shows the cross-file direction works both ways). Do NOT add zod (C.1 = TS interfaces).

### `src/core/context/ContextOptimizer.ts` (service, transform) — MODIFIED additively

**Analog:** itself (read in full, 472 lines). Modification points are all additive; existing contracts stay:

1. **WorkingSection extension for D-96** (lines 114-118 — add `originalTokens: number`):
```typescript
/** One shipped section + its §2.6 provenance record, kept in lockstep. */
interface WorkingSection {
  section: PromptSection;
  record: ManifestSectionRecord;
  // NEW (D-96): pre-degradation token count, captured in buildSourcedSections
  originalTokens: number;
}
```

2. **Item pipeline insertion** — `buildSourcedSections` (271-339) gains the parallel `ContextItem[]` construction per D-94; `applyTrustPolicy` runs on the items BEFORE `working` is built (assemble's step 5, lines 136-137: `const working = buildSourcedSections(input);` — the item pipeline feeds this). Reuse `sourceIdFor` (349-360) for `ContextItem.sourceId`.

3. **Rungs 1-2 activation (D-97)** — the reserved no-op comments at lines 195-200 become real rungs when optional debug/notes inputs are present (research Open Question 2: additional `CONTEXT`-kind sections with `sourceId` prefixes `debug:`/`notes:`), dropping them with manifest `truncated` records. Rungs stay INSIDE the over-budget ladder scope (never fire unconditionally).

4. **Additive output surface (D-95/D-102)** — the `OptimizedContext` object literal (164-174) gains `receipt` + `untrustedDataPresent` + `metrics` additive fields — the D-77 precedent (67-71) keeps existing callers compiling.

5. **Never-throw lock** — `assemble` (131-176) calls only the NON-throwing `applyTrustPolicy`; the throwing guard stays in the trust module (research Pitfall 2). Do NOT add a try/catch or a new `ok:false` variant.

6. **Closed-set literal precedent** (line 465): `code: 'CONTEXT_TOO_LARGE'` — the guard's `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` follows this pattern, no registry edit.

### `tests/core/context/trust/**` (test) — trust + receipt + metrics + disclosure + snapshots

**Analog:** `tests/core/context/ContextOptimizer.test.ts` (319 lines — pure unit tests, no chrome mocks).

**Fixture-builder pattern** (ContextOptimizer.test.ts:32-51 — `makeInput` with REQUIRED defaults + overrides merge; 53-71 — `manyHints`/`manyTools` generators):
```typescript
function makeInput(overrides: Partial<ContextOptimizerInput> = {}): ContextOptimizerInput {
  return {
    operationId: 'op-test',
    model: 'fixture-model',
    modelContextWindow: 16384,
    userInput: 'Summarize the current incident',
    conversationId: 'conv-1',
    workspaceId: 'ws-1',
    activeSurface: 'sidepanel',
    pageContext: defaultPageContext,
    selectedToolSchemas: [...],
    memoryHints: [...],
    preferences: {},
    ...overrides,
  };
}
```

**Assertion-narrowing pattern** (ContextOptimizer.test.ts:76-77, 102-103 — after `expect(result.ok).toBe(true)` the `if (!result.ok) return;` narrows the union):
```typescript
const result = assemble(makeInput());
expect(result.ok).toBe(true);
if (!result.ok) return;
const context = result.context;
```

**Schema-parse assertion** (ContextOptimizer.test.ts:107 — cross-boundary shapes are zod-validated):
```typescript
expect(ContextProvenanceManifestSchema.safeParse(manifest).success).toBe(true);
```

**Snapshot tests (CTX-04)** — NO repo precedent for `toMatchFileSnapshot` (verified: zero matches in tests/). Use the RESEARCH.md Pattern 6 skeleton verbatim: `expect(prompt).toMatchFileSnapshot('./fixtures/stable-prefix.golden.txt')` (note: vitest's `toMatchFileSnapshot` is async — `await` it) + `hashStableSections` FNV-1a golden cross-check (research reconciliation: snapshot the deterministic packed output, do NOT flip USER PREFERENCES `stable:false`). Golden fixtures committed under `tests/core/context/trust/fixtures/`.

### `tests/security/prompt-injection/**` (test) — adversarial fixtures

**Analog:** `tests/core/security/secrets-inspection.test.ts` (306 lines) + `tests/isolation/cross-entrypoint-imports.test.ts`.

**Security-suite conventions** (secrets-inspection.test.ts): adversarial fixtures with explicit threat constants (lines 114, 144, 162: `const KNOWN_SECRET = 'sk-...'` style), assertions that the threat never survives the boundary (`expect(npStoreRaw).not.toContain(KNOWN_SECRET)` at 246-247), and **code-level structural assertions** (lines 291-305 — reads the source file via `fs` and asserts no forbidden call pattern):
```typescript
it('hydrateProviderSecrets is read-only: source contains no chromeStorageAdapter.setItem ...', async () => {
  const fs = await import('fs');
  const path = await import('path');
  const sourcePath = path.join(__dirname, '..', '..', '..', 'src', 'store', 'useExtensionStore.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const match = source.match(/export\s+async\s+function\s+hydrateProviderSecrets\s*\([^)]*\)\s*:\s*Promise<void>\s*\{([\s\S]*?)\n\}/);
  expect(match).not.toBeNull();
  const body = match![1];
  expect(body).not.toMatch(/setItem\s*\(\s*['"]np_providers['"]/);
});
```
The prompt-injection suite mirrors this: fixtures fabricate `instructionAuthority:true` on retrieved/untrusted items → assert `raiseIfPolicyRedefinitionAttempt` throws the typed code + `applyTrustPolicy` output never carries authority (research Pattern 3; `__dirname` works — vitest CJS-compat, same as the fs pattern above). NOTE: the `fs` + `path` dynamic-import pattern (lines 294-295) and the `grepForViolations` shell-grep pattern (cross-entrypoint-imports.test.ts:37-47) are the two established structural-assertion styles.

### `package.json` (config) — D-103 gate re-point

**Analog:** the `verify:phase-N` script strings (lines 18-28). Current line 25:
```json
"verify:phase-7": "tsc --noEmit && vitest run tests/hooks tests/components tests/components/rich tests/core/intent tests/core/notes",
```
→ re-point verbatim per spec 3611 (D-103):
```json
"verify:phase-7": "tsc --noEmit && vitest run tests/core/context/trust tests/security/prompt-injection",
```
This is the ONLY package.json edit — no dependency changes (research Package Legitimacy Audit: zero new packages). Both new test dirs MUST contain ≥1 test file before the gate runs (research Pitfall 3 — vitest errors on empty dirs).

## Shared Patterns

### Pure synchronous functions; typed never-throw seams
**Source:** `src/core/context/ContextOptimizer.ts:100-112` (AssembleResult union) + `src/core/context/ContextPack.ts:39-42` (throw only on closed-set violations)
**Apply to:** All new `trust/` modules. Pure functions return values or throw only the typed `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` guard error (research Pattern 3). `assemble` never throws — it calls only the non-throwing `applyTrustPolicy`.

### Header-comment blocks citing spec lines + decision IDs
**Source:** every file in `src/core/context/` (e.g., ContextProvenanceManifest.ts:1-8, ContextCompressor.ts:1-14, ContextPack.ts:1-11)
**Apply to:** All new `src/core/context/trust/*.ts` modules. First lines: `// <ModuleName> — <D-ID> <purpose>` + spec line refs + LOCKED conventions + Pitfall warnings. This is the repo's documentation spine.

### Token accounting: `countTokensHeuristic`, recount after every transform
**Source:** `src/core/context/TokenBudget.ts:44-55` (`countTokensHeuristic`/`heuristicTokenCounter`), recount pattern at ContextCompressor.ts:40 (`tokens: countTokensHeuristic(text)` in the spread-return)
**Apply to:** All new modules + ContextOptimizer modifications. Wrap `<untrusted_data>` adds tokens — recount post-wrap (research Pattern 1). No tokenizer library (STACK.md).

### Zod schema-parse at cross-boundary shapes
**Source:** `ContextProvenanceManifestSchema.parse(...)` at ContextProvenanceManifest.ts:87; tests assert `safeParse(...).success` (ContextOptimizer.test.ts:107)
**Apply to:** `ContextReceipt.ts`/`ContextQualityMetrics.ts` if they produce boundary shapes; all tests assert schema validity. The C.1 trust types themselves are plain TS interfaces (no zod — harness.ts:13-17 precedent).

### Closed-set literals — no new error codes
**Source:** `CONTEXT_TOO_LARGE` literal at ContextOptimizer.ts:465; `StreamErrorCodeSchema` closed enum at ai/types.ts:55-64 (D-38)
**Apply to:** `TrustPolicy.ts` guard. `CONTEXT_INSTRUCTION_INJECTION_BLOCKED` already exists in the §21.6 closed set (spec 5093) — use it verbatim, never invent a code.

### Additive output fields, never schema edits
**Source:** D-77 trace surface at ContextOptimizer.ts:67-71 (additive `contextTier`/`truncated`/`truncatedSources`)
**Apply to:** ContextOptimizer modifications (D-95/D-102). The manifest schema (ContextProvenanceManifest.ts:28-42), A8 `PromptSectionSchema` (ai/types.ts:95-100), and `CANONICAL_SECTION_ORDER` (ContextPack.ts:15-23) are READ-ONLY this phase (Pitfall 1).

### Strict-clean TypeScript, zero NP-STRICT markers
**Source:** STATE.md decision 17; package.json `NP_STRICT_CEILING: 0` (line 7)
**Apply to:** All new/modified files. `verify:phase-7` runs `tsc --noEmit` — any `@ts-expect-error NP-STRICT` in new code fails the gate (research Pitfall 7).

### Test conventions: vitest globals, `makeInput` builders, union narrowing
**Source:** `tests/core/context/ContextOptimizer.test.ts` (pure unit, `describe`/`it`/`expect`, `@/` alias imports at line 7, `expect(result.ok).toBe(true); if (!result.ok) return;` narrowing)
**Apply to:** All new tests. Pure unit suites need NO chrome mocks (research Validation Architecture — these suites are fast).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `tests/core/context/trust/stable-prefix.snapshot.test.ts` + `fixtures/stable-prefix.golden.txt` (snapshot mechanism only) | test | — | Zero `toMatchFileSnapshot`/`toMatchSnapshot` usage in the repo today (verified by grep). Use RESEARCH.md Pattern 6 skeleton verbatim + vitest built-in `toMatchFileSnapshot` (async — `await` it); commit the golden fixture under `tests/core/context/trust/fixtures/`. The `hashStableSections` FNV-1a cross-check has a live analog: `src/core/ai/PromptCacheAdapter.ts:83-95`. |
| `src/core/context/trust/SkillDisclosure.ts` (ISkill shape) | service | transform | `ISkill` (spec 1826-1856) is Phase-15 territory — no in-repo analog. Shape the `SkillDisclosureCandidate` interface against the spec's fields (`trigger`/`description`/`fullInstructions`/`active`); the declare-now/populate-later pattern analog is `Summarizer` at `src/core/context/types.ts:46-53`. |

## Metadata

**Analog search scope:** `src/core/context/*`, `src/core/ai/*`, `src/core/content/`, `src/types/`, `tests/core/context/`, `tests/core/security/`, `tests/isolation/`, `package.json`
**Files scanned:** 17 (12 source + 4 test/config + UI-SPEC)
**Pattern extraction date:** 2026-08-30