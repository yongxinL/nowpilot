import { z } from 'zod';

export interface RawNode {
  id: string;
  role: string;
  type?: string;
  text?: string;
  geometry?: { x: number; y: number; width: number; height: number; inViewport: boolean };
  interaction?: Record<string, boolean | undefined>;
  link?: { href: string; rel?: string };
  image?: { alt?: string; src?: string };
  form?: { control?: { fieldName?: string; fieldType?: string; value?: string; isPassword?: boolean } };
  iframe?: { origin: string; crossOrigin: boolean };
  children?: RawNode[];
}

export const GeometrySchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  inViewport: z.boolean(),
});

export const InteractionSchema = z.object({
  clickable: z.boolean().optional(),
  editable: z.boolean().optional(),
  focusable: z.boolean().optional(),
  disabled: z.boolean().optional(),
  expanded: z.boolean().optional(),
});

export const FormControlSchema = z
  .object({
    fieldName: z.string().optional(),
    fieldType: z.string().optional(),
    value: z.string().optional(),
    isPassword: z.boolean().optional(),
  })
  .refine((c) => !(c.isPassword && c.value !== undefined), 'password value must be omitted');

export interface APCLiteNode {
  id: string;
  domNodeId?: number;
  role: string;
  type?: string;
  text?: string;
  textStyle?: { level?: number; emphasis?: boolean; size?: number };
  geometry?: z.infer<typeof GeometrySchema>;
  interaction?: z.infer<typeof InteractionSchema>;
  link?: { href: string; rel?: string };
  image?: { alt?: string; src?: string; origin?: string };
  form?: { name?: string; control?: z.infer<typeof FormControlSchema> };
  iframe?: { origin: string; crossOrigin: boolean };
  children?: APCLiteNode[];
}

export const APCLiteNodeSchema: z.ZodType<APCLiteNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    domNodeId: z.number().optional(),
    role: z.string(),
    type: z.string().optional(),
    text: z.string().optional(),
    textStyle: z
      .object({ level: z.number().optional(), emphasis: z.boolean().optional(), size: z.number().optional() })
      .optional(),
    geometry: GeometrySchema.optional(),
    interaction: InteractionSchema.optional(),
    link: z.object({ href: z.string(), rel: z.string().optional() }).optional(),
    image: z
      .object({ alt: z.string().optional(), src: z.string().optional(), origin: z.string().optional() })
      .optional(),
    form: z.object({ name: z.string().optional(), control: FormControlSchema.optional() }).optional(),
    iframe: z.object({ origin: z.string(), crossOrigin: z.boolean() }).optional(),
    children: z.array(APCLiteNodeSchema).optional(),
  }),
);

export const APCLiteDocumentSchema = z.object({
  url: z.string(),
  title: z.string(),
  extractedAt: z.number(),
  source: z.enum(['dom', 'ax', 'hybrid', 'servicenow-api']),
  root: APCLiteNodeSchema,
  stats: z.object({
    nodeCount: z.number(),
    approxTokens: z.number(),
    durationMs: z.number(),
    truncated: z.boolean(),
  }),
});

export type APCLiteDocument = z.infer<typeof APCLiteDocumentSchema>;

export interface ExtractOptions {
  tabId: number;
  mode: 'default' | 'actionable';
  includeOutOfViewport?: boolean;
  maxNodes?: number;
  maxTokens?: number;
}

export interface SelectOptions {
  topK?: number;
  maxTokens?: number;
  expandParents?: boolean;
}

export function countNodes(n: APCLiteNode): number {
  return 1 + (n.children?.reduce((s, c) => s + countNodes(c), 0) ?? 0);
}

export function findNodeById(n: APCLiteNode, id: string): APCLiteNode | null {
  if (n.id === id) return n;
  for (const c of n.children ?? []) {
    const r = findNodeById(c, id);
    if (r) return r;
  }
  return null;
}
