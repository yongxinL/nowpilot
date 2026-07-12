import { z } from 'zod';
import type {
  SectionProvenanceEntry,
  ContextProvenanceManifest,
  SectionProvenanceOutcomeType,
  DegradationReasonType,
  ModelContextTier,
  PromptSectionKindType,
  CompressionMethodType,
} from './contextTypes';

export type {
  SectionProvenanceEntry,
  ContextProvenanceManifest,
  SectionProvenanceOutcomeType,
  DegradationReasonType,
};

export interface CreateManifestParams {
  operationId: string;
  tier: ModelContextTier;
  inputBudget: number;
  outputBudget: number;
  safetyMargin: number;
}

export function createManifest(params: CreateManifestParams): ContextProvenanceManifest {
  return {
    operationId: params.operationId,
    tier: params.tier,
    inputBudget: params.inputBudget,
    outputBudget: params.outputBudget,
    safetyMargin: params.safetyMargin,
    sections: [],
    degradationSteps: [],
    minimalMode: false,
    createdAt: Date.now(),
  };
}

export function recordSection(
  manifest: ContextProvenanceManifest,
  entry: SectionProvenanceEntry,
): ContextProvenanceManifest {
  return {
    ...manifest,
    sections: [...manifest.sections, entry],
  };
}

export function recordDegradationStep(
  manifest: ContextProvenanceManifest,
  step: DegradationReasonType,
): ContextProvenanceManifest {
  return {
    ...manifest,
    degradationSteps: [...manifest.degradationSteps, step],
  };
}

export function setMinimalMode(manifest: ContextProvenanceManifest): ContextProvenanceManifest {
  return {
    ...manifest,
    minimalMode: true,
  };
}

export interface CreateSectionEntryParams {
  kind: PromptSectionKindType;
  sourceId: string;
  originalTokens: number;
  finalTokens?: number;
  outcome: SectionProvenanceOutcomeType;
  compressionMethod?: CompressionMethodType;
  reason?: DegradationReasonType;
}

export function createSectionEntry(params: CreateSectionEntryParams): SectionProvenanceEntry {
  const entry: SectionProvenanceEntry = {
    kind: params.kind,
    sourceId: params.sourceId,
    originalTokens: params.originalTokens,
    finalTokens: params.finalTokens ?? (params.outcome === 'dropped' ? 0 : params.originalTokens),
    outcome: params.outcome,
  };
  if (params.compressionMethod) {
    entry.compressionMethod = params.compressionMethod;
  }
  if (params.reason) {
    entry.reason = params.reason;
  }
  return entry;
}

export const sectionProvenanceEntrySchema = z.object({
  kind: z.string(),
  sourceId: z.string(),
  originalTokens: z.number().int().min(0),
  finalTokens: z.number().int().min(0),
  outcome: z.enum(['kept', 'truncated', 'compressed', 'dropped']),
  compressionMethod: z.enum(['summarise', 'structural', 'topk']).optional(),
  reason: z.string().optional(),
});

export const contextProvenanceManifestSchema = z.object({
  operationId: z.string().min(1),
  tier: z.enum(['tiny', 'small', 'medium', 'large']),
  inputBudget: z.number().int().min(0),
  outputBudget: z.number().int().min(0),
  safetyMargin: z.number().int().min(0),
  sections: z.array(sectionProvenanceEntrySchema),
  degradationSteps: z.array(z.string()),
  minimalMode: z.boolean(),
  createdAt: z.number().int().positive(),
});
