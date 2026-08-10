// src/core/ai/toolSchemas.ts — Source: PRODUCT_SPEC Appendix C lines 4570-4579
// (verbatim). This is the CANONICAL home for ToolSchemaRef (the spec's
// src/core/ai/toolSchemas.ts listing); src/core/ai/types.ts imports (never
// re-declares) it — R-1 single declaration. Phase-4 ContextOptimizer and the
// PlannerDecisionSchema builder (D-04/D-05) consume this same shape.

export interface ToolSchemaRef {
  name: string;
  description: string;
  jsonSchema: unknown;
  dangerous: boolean;
  source: 'builtin' | 'mcp' | 'skill' | 'servicenow';
}
