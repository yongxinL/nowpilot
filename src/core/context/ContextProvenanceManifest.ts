// ContextProvenanceManifest — §2.6 verbatim (PRODUCT_SPEC_v0_1.md:526-544).
//
// Every OptimizedContext carries one (DONE-when 4) so PromptInspector can
// display provenance without the raw body (spec 528). The manifest kind union
// ('system'|'tool_schemas'|...) is a SEPARATE closed set from the A8 uppercase-
// spaced section kind ('SYSTEM'|'TOOL SCHEMAS'|...) — MANIFEST_KIND_MAP is the
// explicit 7-entry casing table (Pitfall 3). Do NOT add sourceId to the A8
// PromptSection (that would edit the Phase-3 file, D-72).
import { z } from 'zod';
import type { CompressionType } from './types';

/** §2.6 manifest kind union (spec 533) — closed set. */
export const ManifestKindSchema = z.enum([
  'system',
  'tool_schemas',
  'preferences',
  'memory',
  'context',
  'task',
  'user_input',
]);
export type ManifestKind = z.infer<typeof ManifestKindSchema>;

/** §2.6 compressionApplied union (spec 537) — local zod enum for the schema. */
export const CompressionTypeSchema = z.enum(['summarise', 'structural', 'topk']);

/** §2.6 verbatim manifest schema (spec 530-544) — workspaceId/activeSurface REQUIRED (Q6). */
export const ContextProvenanceManifestSchema = z.object({
  sections: z.array(
    z.object({
      kind: ManifestKindSchema,
      sourceId: z.string(),
      tokens: z.number().int().nonnegative(),
      truncated: z.boolean(),
      compressionApplied: CompressionTypeSchema.optional(),
    }),
  ),
  totalTokens: z.number().int().nonnegative(),
  minimalMode: z.boolean(),
  workspaceId: z.string(),
  activeSurface: z.enum(['sidepanel', 'standalone']),
});
export type ContextProvenanceManifest = z.infer<typeof ContextProvenanceManifestSchema>;

/** Per-section provenance record fed to buildManifest by ContextOptimizer. */
export interface ManifestSectionRecord {
  kind: ManifestKind;
  sourceId: string;
  tokens: number;
  truncated: boolean;
  compressionApplied?: CompressionType;
}

/** LOCKED 7-entry casing table (Pitfall 3): uppercase-spaced A8 kind → lowercase manifest kind. */
export const MANIFEST_KIND_MAP: Record<string, ManifestKind> = {
  SYSTEM: 'system',
  'TOOL SCHEMAS': 'tool_schemas',
  'USER PREFERENCES': 'preferences',
  MEMORY: 'memory',
  CONTEXT: 'context',
  TASK: 'task',
  'USER INPUT': 'user_input',
};

export interface BuildManifestInput {
  sectionRecords: ManifestSectionRecord[];
  totalTokens: number;
  minimalMode: boolean;
  workspaceId: string;
  activeSurface: 'sidepanel' | 'standalone';
}

/**
 * Builds the §2.6 manifest from the shipped-section records and ALWAYS appends
 * the two by-design omission records for 'system' and 'task' (truncated: true,
 * tokens: 0, sourceId 'system'/'task') so the manifest is the complete 7-kind
 * receipt (Q3 LOCKED: assemble emits only the sourced five kinds; system/task
 * have no input source in the §2.3 verbatim contract — Phase-7 CTX-03
 * 'inclusion/omission' semantics). Output is schema-parsed — cross-boundary
 * shapes are zod-validated (CLAUDE.md convention).
 */
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