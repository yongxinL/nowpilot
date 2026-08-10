// src/core/ai/toolSchemas.ts — Source: PRODUCT_SPEC Appendix C lines 4570-4579
// (verbatim) + §10.5 row 8 + D-04/D-05 (03-03). This is the CANONICAL home for
// ToolSchemaRef (the spec's src/core/ai/toolSchemas.ts listing); src/core/ai/types.ts
// imports (never re-declares) it — R-1 single declaration. Phase-4 ContextOptimizer
// and the PlannerDecisionSchema builder (D-04/D-05) consume this same shape.
//
// D-04: Phase 3 ships EXACTLY ONE safe built-in — 'get-provider-info'
// (dangerous: no, depends only on the Phase-3 ProviderRegistry) — proving the
// closed-enum + run_tool + Executor accept/reject paths end-to-end. §10.5 row 8:
// input {}, effect "Active provider + model + limits".
//
// D-05: buildToolNameEnum returns null for an EMPTY tool list — z.enum([]) is
// rejected by Zod, so the PlannerDecisionSchema builder OMITS the run_tool
// branch entirely when zero tools are registered; any stray run_tool decision
// is rejected with TOOL_REJECTED (ExecutorService, 03-04).
import { z } from 'zod';

export interface ToolSchemaRef {
  name: string;
  description: string;
  jsonSchema: unknown;
  dangerous: boolean;
  source: 'builtin' | 'mcp' | 'skill' | 'servicenow';
}

/** §10.5 row 8 — the ONE Phase-3 built-in (D-04). Input {}; reads the registry. */
export const GET_PROVIDER_INFO_TOOL: ToolSchemaRef = {
  name: 'get-provider-info',
  description: 'Active provider + model + limits',
  jsonSchema: { type: 'object', properties: {}, additionalProperties: false },
  dangerous: false,
  source: 'builtin',
};

/** The D-04 closed tool list — exactly the one safe built-in for Phase 3. */
export const BUILTIN_TOOLS: readonly ToolSchemaRef[] = [GET_PROVIDER_INFO_TOOL];

/** Extract the registered tool names in list order (feeds the closed enum + Executor). */
export function registeredToolNames(tools: readonly ToolSchemaRef[]): string[] {
  return tools.map((t) => t.name);
}

/**
 * D-05: closed z.enum over the registered tool names. Returns null when the
 * list is EMPTY (never z.enum([]) — Zod rejects it): the PlannerDecisionSchema
 * builder omits the run_tool branch, and any stray run_tool decision is
 * rejected with TOOL_REJECTED by ExecutorService.
 */
export function buildToolNameEnum(
  tools: readonly ToolSchemaRef[],
): z.ZodEnum<[string, ...string[]]> | null {
  const names = registeredToolNames(tools);
  if (names.length === 0) return null;
  return z.enum(names as [string, ...string[]]);
}
