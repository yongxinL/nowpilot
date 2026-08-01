import { z } from 'zod';
import type { ContextItem as ContextItemContract, PromptSection } from '../ai/types';

/**
 * Data-sensitivity classification (D-09). The Zod enum accepts 'secret' so
 * type inference covers the full union — the ContextItemSchema-level
 * .refine() below rejects items with sensitivity === 'secret' (D-09: secret
 * items are never ContextItem instances).
 */
export const SensitivitySchema = z.enum(['public', 'private', 'confidential', 'secret']);
export type Sensitivity = z.infer<typeof SensitivitySchema>;

/**
 * Who authored a context source (D-06/D-07). Never self-assigned — the
 * ContextTrustPolicy is the authority.
 */
export const InstructionAuthoritySchema = z.enum(['system', 'user', 'data']);
export type InstructionAuthority = z.infer<typeof InstructionAuthoritySchema>;

/**
 * Trust-aware context item (D-01): PromptSection fields plus trust metadata.
 * The .refine() gate enforces D-09 — an item carrying sensitivity 'secret'
 * is a boundary violation and must never enter the context pipeline.
 */
export const ContextItemSchema = z
  .object({
    kind: z.enum(['system', 'tool_schemas', 'preferences', 'memory', 'context', 'task', 'user_input']),
    text: z.string(),
    tokens: z.number().int().nonnegative(),
    stable: z.boolean(),
    sourceId: z.string().min(1),
    relevance: z.number().min(0).max(1),
    freshness: z.number().min(0).max(1),
    trust: z.number().min(0).max(1),
    sensitivity: SensitivitySchema,
    instructionAuthority: InstructionAuthoritySchema,
    createdAt: z.number().int().nonnegative().optional(),
    expiresAt: z.number().int().nonnegative().optional(),
  })
  .refine((item) => item.sensitivity !== 'secret', {
    message: 'secret items must not become ContextItem instances — redact at boundary per D-09',
  });

export type ContextItem = z.infer<typeof ContextItemSchema>;

// Compile-time drift guard: the schema-inferred shape must always satisfy the
// canonical ContextItem contract from src/core/ai/types.ts (D-01). Fails to
// compile if the schema and the interface drift apart.
type _SchemaMatchesContract = ContextItem extends ContextItemContract ? true : never;
const _schemaMatchesContract: _SchemaMatchesContract = true;

/**
 * Strip ContextItem metadata and return only the PromptSection fields
 * (D-01): the final assembly contract. Prompt text reaching providers never
 * carries sensitivity/trust/authority metadata.
 */
export function unwrapToPromptSections(items: readonly ContextItem[]): PromptSection[] {
  return items.map((item) => ({
    kind: item.kind,
    text: item.text,
    tokens: item.tokens,
    stable: item.stable,
    sourceId: item.sourceId,
  }));
}
