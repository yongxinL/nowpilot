---
phase: 04a-pagecontentservice-knowledge-acquisition
plan: 03
type: execute
wave: 2
depends_on: ["04a-01"]
files_modified:
  - src/core/extraction/apcLite.types.ts
  - src/core/extraction/strategies/IExtractionStrategy.ts
  - src/core/extraction/PageContentSerializer.ts
  - tests/core/extraction/PageContentSerializer.test.ts
autonomous: true
requirements: [CAT-01]
must_haves:
  truths:
    - "`src/core/extraction/apcLite.types.ts` (NEW, R-1 canonical home) declares the Appendix C.1 types VERBATIM (spec L4411-4464): `RawNode`, `GeometrySchema`, `InteractionSchema`, `FormControlSchema` (with the `isPassword ⇒ value omitted` refine — D-4a-20), `APCLiteNode`, `APCLiteNodeSchema` (z.lazy recursion), `APCLiteDocumentSchema` (source enum incl. 'defuddle'/'readability'/'servicenow-api'), `APCLiteDocument` — zero schema rework when 4b/5/8 or v2 automation lands (D-4a-11)."
    - "`src/core/extraction/strategies/IExtractionStrategy.ts` (NEW) declares the strategy contract VERBATIM per Appendix C.1 (L4680-4700) + §26.3 (L3772-3778): `StrategyInput {url, title, mode: 'default'|'actionable', html?, raw?}`, `StrategyResult {source: 'defuddle'|'readability'|'apc-lite'|'servicenow-api', markdown?, root?, meta?, approxTokens, truncated}`, `IExtractionStrategy {id, canHandle, run}` — the `'servicenow-api'` id is RESERVED in the union but NOT implemented (D-4a-17 ordered + reserved seam)."
    - "`src/core/extraction/PageContentSerializer.ts` (NEW) exports the turndown singleton with the verified config parity (`TURNDOWN_OPTIONS`: headingStyle atx, hr ---, bulletListMarker -, codeBlockStyle fenced, emDelimiter *, preformattedCode true — byte-identical to defuddle's own markdown.js) and `htmlToMarkdown(html): string` — the ONLY HTML→markdown converter for the Defuddle and APC-lite prose paths (RESEARCH finding: defuddle's browser-bundle `markdown:true` is a NO-OP — turndown is the real converter)."
    - "`tests/core/extraction/PageContentSerializer.test.ts` (NEW) pins the serializer behavior at runtime: `htmlToMarkdown('<h1>Hello</h1>') === '# Hello'` and the `TURNDOWN_OPTIONS` constant is exported (A6 parity + A1 @types/turndown compat gate)."
    - "All three files carry the R-1 spec-verbatim header convention (`// Source: PRODUCT_SPEC Appendix C.1 (verbatim, lines …). R-1 canonical home — consumers import, never re-declare.`) mirroring src/core/content/PageContext.ts L1-3 and ContextProvenanceManifest.ts L1-18."
    - "FormControlSchema's password refine (D-4a-20) is intact verbatim: `z.object({...}).refine(c => !(c.isPassword && c.value !== undefined), 'password value must be omitted')` — never loosened; it is the boundary re-validation gate the content-side AxDomWalker (04a-06) and the panel-side ApcLiteStrategy (04a-04) both honor."
  artifacts:
    - "src/core/extraction/apcLite.types.ts"
    - "src/core/extraction/strategies/IExtractionStrategy.ts"
    - "src/core/extraction/PageContentSerializer.ts"
    - "tests/core/extraction/PageContentSerializer.test.ts"
  key_links:
    - "StrategyInput.raw references RawNode from apcLite.types.ts (same-package import) — the IExtractionStrategy import path is `./apcLite.types` relative (PATTERNS L161)."
    - "PageContentSerializer's TURNDOWN_OPTIONS parity is the A6 guard: consistent markdown across Defuddle/Readability/APC-lite paths keeps the heading chunker (04a-05) reliable on every path."
    - "estimateTokens (src/core/context/TokenBudget.ts L36) is the ONLY token counter — strategies import it, never hand-roll (PATTERNS L213)."
  flagged_assumptions:
    - "A1 [research, ASSUMED]: turndown@7.2.4 API matches @types/turndown@5.0.6 types — this plan's tsc gate is the proof point (verify the typecheck after the serializer import)."
    - "A6 [research, ASSUMED]: TURNDOWN_OPTIONS config parity with defuddle's internal markdown.js — the 04a-05 golden-fixture heading-boundary test catches divergence (never silently assumed)."
    - "CAT-01 [unresolved — spec-less probe, encoding]: PageContext.html/markdown string fields are populated by the serializer per the spec's `html?`/`markdown?` optional fields (L4368-4369); PageContentService (04a-08) decides which to populate — the serializer only provides the markdown conversion + a `toPageContext` helper shape."
  prohibitions:
    - "No re-declaration of PageContext/TabContext — src/core/content/PageContext.ts is the R-1 home; serializer imports it, never re-creates (R-1)."
    - "No hand-rolled token counter — import estimateTokens from '@/core/context/TokenBudget' (only counter, PATTERNS L213)."
    - "No second markdown converter — htmlToMarkdown is the single turndown path (RESEARCH Pitfall 1: defuddle's markdown option is a no-op in the browser bundle)."
    - "No schema drift from Appendix C.1 — apcLite.types.ts is verbatim (D-4a-11), including the z.lazy recursion in APCLiteNodeSchema and the exact source-enum values."
    - "No implementation of the 'servicenow-api' strategy — the union is reserved only (D-4a-17); the ServiceNow add-on registers it in Phase 8."
---

<!-- 04a-03 (2026-08-12): Wave-2 spec-verbatim type layer. The three pure contract files
     (apcLite.types.ts, strategies/IExtractionStrategy.ts, PageContentSerializer.ts) are
     the R-1 canonical homes every strategy/service plan imports. The serializer carries
     the RESEARCH-critical finding: defuddle's browser-bundle markdown option is a no-op,
     so turndown (approved stack) is the single HTML→markdown converter. -->

<objective>
Create the three spec-verbatim contract files of the extraction layer: `apcLite.types.ts` (Appendix C.1 verbatim — RawNode/APCLiteNode/APCLiteDocument + Zod schemas incl. the FormControlSchema password refine), `strategies/IExtractionStrategy.ts` (C.1 + §26.3 verbatim — the layered-strategy contract with the reserved 'servicenow-api' seam), and `PageContentSerializer.ts` (the single turndown HTML→markdown converter with verified config parity).

Purpose: R-1 (never invent types) + D-4a-11 (full APC-lite schema now, zero rework later) + the RESEARCH-critical pipeline correction — defuddle's browser bundle cannot convert to markdown, so turndown is the one converter every prose path routes through. These three files are the compile-time contract every later plan (strategies, service, index) imports.

Output: the three R-1 type/contract homes.
</objective>

<execution_context>
@/home/yongxin.Li/.config/opencode/gsd-core/workflows/execute-plan.md
@/home/yongxin.Li/.config/opencode/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/PRODUCT_SPEC_v0_1.md
@.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-RESEARCH.md
@.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-PATTERNS.md
@src/core/content/PageContext.ts
@src/core/context/ContextProvenanceManifest.ts
@src/core/context/TokenBudget.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: apcLite.types.ts — Appendix C.1 verbatim (D-4a-11, D-4a-20)</name>
  <files>src/core/extraction/apcLite.types.ts</files>
  <read_first>
    - .planning/PRODUCT_SPEC_v0_1.md Appendix C.1 L4410-4465 (the verbatim block to copy)
    - src/core/context/ContextProvenanceManifest.ts L1-18 (R-1 header + zod co-location convention)
  </read_first>
  <action>
    Create `src/core/extraction/apcLite.types.ts` copying the Appendix C.1 block (spec L4411-4464) VERBATIM: `import { z } from 'zod'`, the `RawNode` interface (id/role/type/text/geometry?/interaction?/link?/image?/form?/iframe?/children?), `GeometrySchema`, `InteractionSchema`, `FormControlSchema` (z.object with fieldName/fieldType/value/isPassword optional fields + `.refine(c => !(c.isPassword && c.value !== undefined), 'password value must be omitted')` — the D-4a-20 invariant, verbatim and never loosened), the `APCLiteNode` type, `APCLiteNodeSchema` (z.lazy recursion), `APCLiteDocumentSchema` (url/title/extractedAt/source enum ['dom','ax','hybrid','servicenow-api','defuddle','readability']/root/stats{nodeCount,approxTokens,durationMs,truncated}), and the exported `APCLiteDocument` type.

    Header comment: `// src/core/extraction/apcLite.types.ts — Source: Appendix C.1 (verbatim, lines 4411-4464). R-1 canonical home — consumers import (never re-declare) it.` Do NOT add fields, do NOT drop fields, do NOT rename the source-enum values (D-4a-11 full-schema-now; zero schema rework later).
  </action>
  <acceptance_criteria>
    - File exists with all exports: RawNode, GeometrySchema, InteractionSchema, FormControlSchema, APCLiteNode, APCLiteNodeSchema, APCLiteDocumentSchema, APCLiteDocument.
    - `grep -n "refine(c => !(c.isPassword" src/core/extraction/apcLite.types.ts` matches — the password-omission refine is present verbatim (D-4a-20).
    - `grep -c "servicenow-api" src/core/extraction/apcLite.types.ts` >= 1 (source enum reserves the seam, D-4a-17).
    - `pnpm tsc --noEmit` passes.
  </acceptance_criteria>
  <verify>
    <automated>pnpm tsc --noEmit && grep -c "APCLiteDocumentSchema" src/core/extraction/apcLite.types.ts</automated>
  </verify>
  <done>All C.1 types verbatim, password refine intact, tsc green.</done>
</task>

<task type="auto">
  <name>Task 2: strategies/IExtractionStrategy.ts — C.1 + §26.3 verbatim (D-4a-17)</name>
  <files>src/core/extraction/strategies/IExtractionStrategy.ts</files>
  <read_first>
    - .planning/PRODUCT_SPEC_v0_1.md Appendix C.1 L4680-4701 (StrategyInput/StrategyResult/IExtractionStrategy verbatim) + §26.3 L3772-3778 (the id union)
  </read_first>
  <action>
    Create `src/core/extraction/strategies/IExtractionStrategy.ts` VERBATIM from Appendix C.1 L4680-4700: `import type { APCLiteNode } from '../apcLite.types'` (relative — PATTERNS L161; note the spec writes `'./apcLite.types'` — use the `../` path since this file lives in strategies/, fixing the relative path is the documented Rule-3 adjustment), then `StrategyInput { url, title, mode: 'default' | 'actionable', html?, raw? }`, `StrategyResult { source: 'defuddle' | 'readability' | 'apc-lite' | 'servicenow-api', markdown?, root?, meta?, approxTokens, truncated }`, and `IExtractionStrategy { id: StrategyResult['source'], canHandle(i: {url, mode}), run(i: StrategyInput): Promise<StrategyResult> }`.

    Header comment: `// src/core/extraction/strategies/IExtractionStrategy.ts — Source: Appendix C.1 (verbatim, lines 4680-4700) + §26.3 (L3772-3778). The 'servicenow-api' id is RESERVED (D-4a-17) — the core stays add-on-agnostic; the ServiceNow add-on registers its strategy in Phase 8.` Do NOT implement anything — contract only.
  </action>
  <acceptance_criteria>
    - File exists with StrategyInput, StrategyResult, IExtractionStrategy exports.
    - `grep -n "servicenow-api" src/core/extraction/strategies/IExtractionStrategy.ts` matches the source union (reserved seam).
    - The import path from the strategies/ dir resolves (`../apcLite.types`); `pnpm tsc --noEmit` passes.
  </acceptance_criteria>
  <verify>
    <automated>pnpm tsc --noEmit && grep -c "canHandle" src/core/extraction/strategies/IExtractionStrategy.ts</automated>
  </verify>
  <done>Strategy contract verbatim with the reserved servicenow-api seam; tsc green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: PageContentSerializer.ts — the single turndown converter (RESEARCH Pitfall 1)</name>
  <files>src/core/extraction/PageContentSerializer.ts, tests/core/extraction/PageContentSerializer.test.ts</files>
  <read_first>
    - .planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-RESEARCH.md (Pattern 4 — TURNDOWN_OPTIONS verified against defuddle's markdown.js) + Pitfall 1 (defuddle markdown no-op)
    - src/core/security/TraceRedactor.ts L10-29 (module-level singleton + exported pure function pattern)
  </read_first>
  <behavior>
    - Test 1: htmlToMarkdown('<h1>Hello</h1>') === '# Hello' (atx heading conversion works at the pinned TURNDOWN_OPTIONS).
    - Test 2: TURNDOWN_OPTIONS is exported and carries the verified parity keys (headingStyle atx, hr '---', bulletListMarker '-', codeBlockStyle 'fenced', emDelimiter '*', preformattedCode true — A6).
  </behavior>
  <action>
    Create `src/core/extraction/PageContentSerializer.ts`: a module-level turndown singleton created once with the verified `TURNDOWN_OPTIONS` (headingStyle 'atx', hr '---', bulletListMarker '-', codeBlockStyle 'fenced', emDelimiter '*', preformattedCode true — byte-identical to defuddle's own markdown.js config, RESEARCH Pattern 4) and an exported pure `htmlToMarkdown(html: string): string` that calls `turndownService.turndown(html)`.

    Also export `TURNDOWN_OPTIONS` (testable parity constant). Header comment: `// src/core/extraction/PageContentSerializer.ts — the single HTML→markdown converter (RESEARCH: defuddle@0.6.6 browser-bundle markdown:true is a NO-OP — turndown is the approved-stack converter every prose path routes through). TURNDOWN_OPTIONS verified byte-identical to defuddle's own markdown.js (A6).` Do NOT import defuddle here — the serializer converts, defuddle extracts (04a-04).

    Write `tests/core/extraction/PageContentSerializer.test.ts` per the behavior block — a real unit test pinning `htmlToMarkdown('<h1>Hello</h1>') === '# Hello'` and the TURNDOWN_OPTIONS parity keys (replaces the previous always-passing inline node-import sanity check).
  </action>
  <acceptance_criteria>
    - File exists exporting `htmlToMarkdown` and `TURNDOWN_OPTIONS`.
    - `grep -c "TurndownService" src/core/extraction/PageContentSerializer.ts` >= 1.
    - The unit test asserts `htmlToMarkdown('<h1>Hello</h1>') === '# Hello'` and the TURNDOWN_OPTIONS parity keys (A6) via `pnpm vitest run tests/core/extraction/PageContentSerializer.test.ts -x`.
    - `pnpm tsc --noEmit` passes (proves @types/turndown@5 matches v7 API — A1 gate).
  </acceptance_criteria>
  <verify>
    <automated>pnpm tsc --noEmit && pnpm vitest run tests/core/extraction/PageContentSerializer.test.ts -x</automated>
  </verify>
  <done>Turndown singleton + htmlToMarkdown exported; the behavior unit test pins the '<h1>'→'# ' conversion and TURNDOWN_OPTIONS parity; typecheck proves the @types/turndown@5↔v7 API compat (A1).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| extracted HTML → markdown conversion | untrusted page HTML is transformed here (panel-side) |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-4a-09 | Tampering | FormControlSchema password refine (D-4a-20) | high | mitigate | The refine gate is VERBATIM in apcLite.types.ts (never loosened); enforced at capture by AxDomWalker (04a-06) AND re-validated at the ApcLiteStrategy zod boundary (04a-04) — defense-in-depth per D-4a-20 |
| T-4a-10 | Information Disclosure | markdown conversion of DOM-embedded secrets | high | mitigate | Serializer converts HTML only — TraceRedactor runs panel-side BEFORE any index/log/persist (D-4a-10, CAT-03) at the PageContentService boundary (04a-08), never inside the content script |
| T-4a-04 | Tampering | host-page XSS via extracted HTML | medium | mitigate | Extracted HTML is only ever parsed in the panel's isolated DOMParser doc (04a-04/04a-08) — never innerHTML into a live page; content script never mounts UI (R-5) |
</threat_model>

<verification>
- tsc --noEmit green (all three files typecheck — the A1 @types/turndown compat gate).
- apcLite.types.ts contains the FormControlSchema password refine + the full source enum.
- IExtractionStrategy carries the reserved 'servicenow-api' union member.
- htmlToMarkdown('<h1>Hello</h1>') === '# Hello' pinned by the PageContentSerializer.test.ts unit test.
</verification>

<success_criteria>
- All three R-1 contract homes exist and typecheck.
- The password-omission refine is verbatim in apcLite.types.ts (D-4a-20).
- The strategy union reserves 'servicenow-api' without implementing it (D-4a-17).
- The single-turndown-converter decision (RESEARCH Pitfall 1) is locked in PageContentSerializer.
</success_criteria>

<output>
Create `.planning/phases/04a-pagecontentservice-knowledge-acquisition/04a-03-SUMMARY.md` when done.
</output>

## Artifacts this phase produces

- src/core/extraction/apcLite.types.ts — `RawNode`, `GeometrySchema`, `InteractionSchema`, `FormControlSchema` (password refine), `APCLiteNode`, `APCLiteNodeSchema`, `APCLiteDocumentSchema`, `APCLiteDocument`
- src/core/extraction/strategies/IExtractionStrategy.ts — `StrategyInput`, `StrategyResult`, `IExtractionStrategy` (source union incl. reserved 'servicenow-api')
- src/core/extraction/PageContentSerializer.ts — `TURNDOWN_OPTIONS`, `htmlToMarkdown(html)`
- tests/core/extraction/PageContentSerializer.test.ts — `htmlToMarkdown('<h1>Hello</h1>') === '# Hello'` + TURNDOWN_OPTIONS parity pin
