import { z } from 'zod';

export const CostTier = z.enum(['haiku', 'flash', 'sonnet', 'opus']);
export type CostTierType = z.infer<typeof CostTier>;

export interface ModelCapabilities {
  text: boolean;
  image: boolean;
  toolUse: boolean;
  structuredOutput: boolean;
}

export interface ModelEntry {
  providerId: string;
  modelId: string;
  costTier: CostTierType;
  contextWindow: number;
  modalities: ModelCapabilities;
  rateLimit?: {
    requestsPerMinute: number;
    tokensPerMinute: number;
  };
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: 'openai' | 'anthropic' | 'google' | 'ollama' | 'openai-compatible';
  apiKey?: string;
  baseURL?: string;
  models: ModelEntry[];
  priority: number;
  enabled: boolean;
}

export const modelEntrySchema = z.object({
  providerId: z.string().min(1),
  modelId: z.string().min(1),
  costTier: CostTier,
  contextWindow: z.number().int().positive(),
  modalities: z.object({
    text: z.boolean(),
    image: z.boolean(),
    toolUse: z.boolean(),
    structuredOutput: z.boolean(),
  }),
  rateLimit: z
    .object({
      requestsPerMinute: z.number().int().positive(),
      tokensPerMinute: z.number().int().positive(),
    })
    .optional(),
});

export const providerConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['openai', 'anthropic', 'google', 'ollama', 'openai-compatible']),
  apiKey: z.string().optional(),
  baseURL: z.string().optional(),
  models: z.array(modelEntrySchema),
  priority: z.number().int().min(0),
  enabled: z.boolean(),
});
