import { z } from 'zod';

export type ModelContextTier = 'tiny' | 'small' | 'medium' | 'large';

export const PromptSectionKind = z.enum([
  'system_prompt',
  'task_instructions',
  'workspace_context',
  'memory',
  'tool_schemas',
  'page_context',
  'conversation_history',
  'user_input',
  'tool_results',
  'notes_metadata',
  'debug_data',
  'preferences',
]);
export type PromptSectionKindType = z.infer<typeof PromptSectionKind>;

export interface PromptSection {
  kind: PromptSectionKindType;
  sourceId: string;
  content: string;
  priority?: number;
}

export const SectionProvenanceOutcome = z.enum(['kept', 'truncated', 'compressed', 'dropped']);
export type SectionProvenanceOutcomeType = z.infer<typeof SectionProvenanceOutcome>;

export const CompressionMethod = z.enum(['summarise', 'structural', 'topk']);
export type CompressionMethodType = z.infer<typeof CompressionMethod>;

export const DegradationReason = z.enum([
  'budget',
  'minimal_mode',
  'degradation_step_1',
  'degradation_step_2',
  'degradation_step_3',
  'degradation_step_4',
  'degradation_step_5',
  'degradation_step_6',
  'degradation_step_7',
]);
export type DegradationReasonType = z.infer<typeof DegradationReason>;

export interface SectionProvenanceEntry {
  kind: PromptSectionKindType;
  sourceId: string;
  originalTokens: number;
  finalTokens: number;
  outcome: SectionProvenanceOutcomeType;
  compressionMethod?: CompressionMethodType;
  reason?: DegradationReasonType;
}

export interface ContextProvenanceManifest {
  operationId: string;
  tier: ModelContextTier;
  inputBudget: number;
  outputBudget: number;
  safetyMargin: number;
  sections: SectionProvenanceEntry[];
  degradationSteps: DegradationReasonType[];
  minimalMode: boolean;
  createdAt: number;
}

export interface ContextOptimizerInput {
  operationId: string;
  providerId: string;
  modelId: string;
  modelContextWindow: number;
  userInput: string;
  systemPrompt: string;
  taskInstructions?: string;
  workspaceContext?: string;
  pageContext?: string | Record<string, unknown> | null;
  toolSchemas?: Array<{ name: string; schema: unknown }>;
  selectedToolSchemas?: Array<{ name: string; schema: unknown }>;
  memory?: Array<{ id: string; content: string; score: number }>;
  preferences?: Record<string, unknown>;
  conversationHistory?: Array<{ role: string; content: string }>;
  conversationSummary?: string;
  notes?: Array<{ id: string; content: string }>;
  referenceTokens?: Array<{ type: string; id: string; title: string; displayLabel: string }>;
  attachments?: import('../attachments/AttachmentModel').Attachment[];
  debugData?: Record<string, unknown>;
}

export interface OptimizedContext {
  operationId: string;
  tier: ModelContextTier;
  inputBudget: number;
  outputBudget: number;
  safetyMargin: number;
  sections: PromptSection[];
  provenance: ContextProvenanceManifest;
  minimalMode: boolean;
}

export class ContextTooLargeError extends Error {
  public readonly code = 'CONTEXT_TOO_LARGE' as const;
  public readonly estimatedTokens: number;
  public readonly budget: number;

  constructor(estimatedTokens: number, budget: number) {
    super(
      `Context size (${estimatedTokens} tokens) exceeds available budget (${budget} tokens) after all degradation steps`,
    );
    this.name = 'ContextTooLargeError';
    this.estimatedTokens = estimatedTokens;
    this.budget = budget;
  }
}

export const contextOptimizerInputSchema = z.object({
  operationId: z.string().min(1),
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  modelContextWindow: z.number().int().positive(),
  userInput: z.string().min(1),
  systemPrompt: z.string(),
  taskInstructions: z.string().optional(),
  workspaceContext: z.string().optional(),
  pageContext: z.union([z.string(), z.record(z.unknown())]).nullish(),
  toolSchemas: z
    .array(z.object({ name: z.string(), schema: z.unknown() }))
    .optional(),
  selectedToolSchemas: z
    .array(z.object({ name: z.string(), schema: z.unknown() }))
    .optional(),
  memory: z
    .array(
      z.object({
        id: z.string(),
        content: z.string(),
        score: z.number(),
      }),
    )
    .optional(),
  preferences: z.record(z.string(), z.unknown()).optional(),
  conversationHistory: z
    .array(z.object({ role: z.string(), content: z.string() }))
    .optional(),
  notes: z.array(z.object({ id: z.string(), content: z.string() })).optional(),
  referenceTokens: z
    .array(z.object({ type: z.string(), id: z.string(), title: z.string(), displayLabel: z.string() }))
    .optional(),
  attachments: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal('image'),
          mimeType: z.string(),
          dataUrl: z.string(),
          fileName: z.string(),
          sizeBytes: z.number(),
        }),
        z.object({
          kind: z.literal('file'),
          mimeType: z.string(),
          name: z.string(),
          sizeBytes: z.number(),
        }),
        z.object({
          kind: z.literal('voice_transcript'),
          transcript: z.string(),
          durationSeconds: z.number().optional(),
        }),
        z.object({
          kind: z.literal('clipboard_text'),
          text: z.string(),
          sourceUrl: z.string().optional(),
        }),
        z.object({
          kind: z.literal('suggested_field'),
          selector: z.string(),
          suggestedValue: z.string(),
          label: z.string(),
        }),
      ]),
    )
    .optional(),
  debugData: z.record(z.string(), z.unknown()).optional(),
});
