import { z } from 'zod';

/**
 * APCLite node schemas (D-08, PRODUCT_SPEC Appendix C).
 *
 * APCLite ("actionable page content lite") is the DOM+ARIA-derived tree used
 * for actionable-mode extraction: a hierarchical representation of the page's
 * interactive elements with semantic enrichment. RawNode is the base shape;
 * APCLiteNode extends it with semantic enrichment fields; APCLiteDocument is
 * the root document container.
 *
 * All schemas use z.strictObject() per the established Zod pattern in
 * PlannerService — unknown fields fail validation instead of being stripped.
 *
 * Recursive schemas follow the zod v4 pattern: the node TYPE is inferred from
 * the non-recursive base schema intersected with the recursive children
 * field, and the schema itself is annotated `z.ZodType<T>` so the lazy
 * self-reference resolves without TS2502/TS2456 circularity.
 */

const GeometrySchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

const baseRawNodeFields = {
  role: z.string(),
  name: z.string().optional(),
  id: z.string().optional(),
  attributes: z.record(z.string(), z.string()).optional(),
  geometry: GeometrySchema.optional(),
  interaction: z.record(z.string(), z.unknown()).optional(),
} as const;

const baseRawNodeSchema = z.strictObject(baseRawNodeFields);

export type RawNode = z.infer<typeof baseRawNodeSchema> & { children?: RawNode[] };

export const RawNodeSchema: z.ZodType<RawNode> = z.strictObject({
  ...baseRawNodeFields,
  children: z.array(z.lazy(() => RawNodeSchema)).optional(),
});

export type APCLiteNode = z.infer<typeof baseRawNodeSchema> & {
  children?: APCLiteNode[];
  text?: string;
  semanticLabel?: string;
  importance?: 'primary' | 'secondary' | 'supplemental';
  state?: Record<string, unknown>;
};

export const APCLiteNodeSchema: z.ZodType<APCLiteNode> = z.strictObject({
  ...baseRawNodeFields,
  children: z.array(z.lazy(() => APCLiteNodeSchema)).optional(),
  text: z.string().optional(),
  semanticLabel: z.string().optional(),
  importance: z.enum(['primary', 'secondary', 'supplemental']).optional(),
  state: z.record(z.string(), z.unknown()).optional(),
});

export const APCLiteDocumentSchema = z.strictObject({
  type: z.literal('document'),
  url: z.string(),
  capturedAt: z.number(),
  children: z.array(APCLiteNodeSchema),
});

export type APCLiteDocument = z.infer<typeof APCLiteDocumentSchema>;
