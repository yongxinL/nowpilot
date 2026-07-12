import { debugLog } from '../../core/utils/debugLog';
import { classifyModelContext, CANONICAL_SECTION_ORDER, getSourcePriority } from './ModelContextTier';
import { createManifest, recordSection, recordDegradationStep, setMinimalMode, createSectionEntry } from './ContextProvenanceManifest';
import type { TokenEstimator } from './TokenEstimator';
import type { ContextCompressor } from './ContextCompressor';
import type { ModelEntry } from '../ai/providers/providerTypes';
import type {
  ContextOptimizerInput,
  OptimizedContext,
  PromptSection,
  ModelContextTier,
  ContextProvenanceManifest,
  SectionProvenanceEntry,
  DegradationReasonType,
} from './contextTypes';
import { contextOptimizerInputSchema, ContextTooLargeError } from './contextTypes';

const SECTION_DISTRIBUTION: Record<ModelContextTier, Record<string, number>> = {
  tiny: {
    system_prompt: 0.15,
    task_instructions: 0.05,
    workspace_context: 0.10,
    memory: 0.10,
    tool_schemas: 0.20,
    page_context: 0.10,
    conversation_history: 0.15,
    user_input: 0.15,
  },
  small: {
    system_prompt: 0.12,
    task_instructions: 0.05,
    workspace_context: 0.12,
    memory: 0.10,
    tool_schemas: 0.18,
    page_context: 0.10,
    conversation_history: 0.20,
    user_input: 0.13,
  },
  medium: {
    system_prompt: 0.10,
    task_instructions: 0.05,
    workspace_context: 0.10,
    memory: 0.15,
    tool_schemas: 0.15,
    page_context: 0.10,
    conversation_history: 0.25,
    user_input: 0.10,
  },
  large: {
    system_prompt: 0.08,
    task_instructions: 0.05,
    workspace_context: 0.10,
    memory: 0.15,
    tool_schemas: 0.12,
    page_context: 0.10,
    conversation_history: 0.30,
    user_input: 0.10,
  },
};

export class ContextOptimizer {
  constructor(
    private tokenEstimator: TokenEstimator,
    private compressor: ContextCompressor,
    private getModelEntry: (providerId: string, modelId: string) => ModelEntry | undefined,
  ) {}

  async optimize(input: ContextOptimizerInput): Promise<OptimizedContext> {
    const validated = contextOptimizerInputSchema.parse(input);

    const tier = this.classifyTier(validated.modelContextWindow);
    const budget = this.computeBudget(tier, validated.modelContextWindow);
    let sections = this.assembleSections(validated, tier, budget.inputBudget);
    let totalEstimated = this.estimateTotalTokens(sections);

    const provenance = createManifest({
      operationId: validated.operationId,
      tier,
      inputBudget: budget.inputBudget,
      outputBudget: budget.outputBudget,
      safetyMargin: budget.safetyMargin,
    });

    const degradationSteps: DegradationReasonType[] = [];
    let minimalMode = false;

    if (!this.withinBudget(totalEstimated, budget.inputBudget)) {
      const degradationResult = await this.applyDegradation(sections, validated, tier, budget.inputBudget, provenance);
      sections = degradationResult.sections;
      minimalMode = degradationResult.minimalMode;
      totalEstimated = this.estimateTotalTokens(sections);

      for (const s of degradationResult.provenance) {
        Object.assign(provenance, recordSection(provenance, s));
      }
      for (const step of degradationResult.steps) {
        degradationSteps.push(step);
        Object.assign(provenance, recordDegradationStep(provenance, step));
      }
    } else {
      for (const section of sections) {
        const entry = createSectionEntry({
          kind: section.kind,
          sourceId: section.sourceId,
          originalTokens: this.tokenEstimator.estimateTokens(section.content),
          outcome: 'kept',
        });
        Object.assign(provenance, recordSection(provenance, entry));
      }
    }

    if (tier === 'tiny') {
      minimalMode = true;
      Object.assign(provenance, setMinimalMode(provenance));
      if (!degradationSteps.includes('minimal_mode')) {
        degradationSteps.push('minimal_mode');
        Object.assign(provenance, recordDegradationStep(provenance, 'minimal_mode'));
      }
    }

    if (minimalMode) {
      Object.assign(provenance, setMinimalMode(provenance));
    }

    debugLog('info', '[ContextOptimizer] Optimization complete', {
      operationId: validated.operationId,
      tier,
      sectionCount: sections.length,
      degradationSteps,
      minimalMode,
      totalEstimated,
    });

    return {
      operationId: validated.operationId,
      tier,
      inputBudget: budget.inputBudget,
      outputBudget: budget.outputBudget,
      safetyMargin: budget.safetyMargin,
      sections,
      provenance: {
        ...provenance,
        degradationSteps,
        minimalMode,
      },
      minimalMode,
    };
  }

  private classifyTier(contextWindow: number): ModelContextTier {
    return classifyModelContext(contextWindow);
  }

  private computeBudget(tier: ModelContextTier, contextWindow: number) {
    const inputBudget = Math.floor(contextWindow * 0.70);
    const outputBudget = Math.floor(contextWindow * 0.20);
    const safetyMargin = contextWindow - inputBudget - outputBudget;
    return { inputBudget, outputBudget, safetyMargin };
  }

  private assembleSections(
    input: ContextOptimizerInput,
    tier: ModelContextTier,
    inputBudget: number,
  ): PromptSection[] {
    const sections: PromptSection[] = [];

    const contentMap: Record<string, string | undefined> = {
      system_prompt: input.systemPrompt,
      task_instructions: input.taskInstructions,
      workspace_context: input.workspaceContext,
      memory: input.memory?.map((m) => `${m.id}: ${m.content}`).join('\n'),
      tool_schemas: input.toolSchemas?.map((t) => `${t.name}: ${JSON.stringify(t.schema)}`).join('\n'),
      page_context: input.pageContext,
      conversation_history: input.conversationHistory?.map((m) => `${m.role}: ${m.content}`).join('\n'),
      user_input: input.userInput,
    };

    const sourceIdMap: Record<string, string> = {
      system_prompt: 'builtin',
      task_instructions: 'builtin',
      workspace_context: 'workspace',
      memory: 'memory-store',
      tool_schemas: 'tool-registry',
      page_context: 'workspace',
      conversation_history: 'chat-history',
      user_input: 'user',
    };

    for (const kind of CANONICAL_SECTION_ORDER) {
      const content = contentMap[kind];
      if (!content) continue;

      sections.push({
        kind: kind as any,
        sourceId: sourceIdMap[kind] || 'unknown',
        content,
        priority: getSourcePriority(kind as any),
      });
    }

    return sections;
  }

  private estimateTotalTokens(sections: PromptSection[]): number {
    const raw = sections.reduce(
      (sum, s) => sum + this.tokenEstimator.estimateTokens(s.content),
      0,
    );
    return this.tokenEstimator.applySafetyMargin(raw);
  }

  private withinBudget(totalEstimated: number, inputBudget: number): boolean {
    return totalEstimated <= inputBudget;
  }

  private async applyDegradation(
    sections: PromptSection[],
    input: ContextOptimizerInput,
    tier: ModelContextTier,
    inputBudget: number,
    manifest: ContextProvenanceManifest,
  ): Promise<{
    sections: PromptSection[];
    provenance: SectionProvenanceEntry[];
    steps: DegradationReasonType[];
    minimalMode: boolean;
  }> {
    let currentSections = [...sections];
    const provenanceEntries: SectionProvenanceEntry[] = [];
    const steps: DegradationReasonType[] = [];
    let minimalMode = false;
    let previousTokens = this.estimateTotalTokens(currentSections);

    const tryStep = (
      step: DegradationReasonType,
      transform: () => { sections: PromptSection[]; entries: SectionProvenanceEntry[] },
    ): boolean => {
      const result = transform();
      const newTokens = this.estimateTotalTokens(result.sections);
      if (newTokens >= previousTokens) {
        debugLog('warn', '[ContextOptimizer] Degradation step did not reduce tokens, skipping', {
          step,
          previousTokens,
          newTokens,
        });
        return false;
      }
      currentSections = result.sections;
      provenanceEntries.push(...result.entries);
      steps.push(step);
      previousTokens = newTokens;

      if (this.withinBudget(newTokens, inputBudget)) {
        return true;
      }
      return false;
    };

    // Step 1: Drop debug context
    const step1Done = tryStep('degradation_step_1', () => this.dropDebugContext(currentSections));
    if (step1Done) return this.degradationResult(currentSections, provenanceEntries, steps, minimalMode);

    // Step 2: Drop notes/metadata
    const step2Done = tryStep('degradation_step_2', () => this.dropNotesMetadata(currentSections));
    if (step2Done) return this.degradationResult(currentSections, provenanceEntries, steps, minimalMode);

    // Step 3: Summarise history
    const step3Result = await this.summariseHistory(currentSections, input, tier);
    const step3Done = tryStep('degradation_step_3', () => step3Result);
    if (step3Done) return this.degradationResult(currentSections, provenanceEntries, steps, minimalMode);

    // Step 4: Compress context
    const step4Done = tryStep('degradation_step_4', () => this.compressPageContext(currentSections, input));
    if (step4Done) return this.degradationResult(currentSections, provenanceEntries, steps, minimalMode);

    // Step 5: Trim tool schemas
    const step5Done = tryStep('degradation_step_5', () => this.trimToolSchemas(currentSections, input));
    if (step5Done) return this.degradationResult(currentSections, provenanceEntries, steps, minimalMode);

    // Step 6: Reduce memory
    const step6Done = tryStep('degradation_step_6', () => this.reduceMemory(currentSections));
    if (step6Done) return this.degradationResult(currentSections, provenanceEntries, steps, minimalMode);

    // Step 7: Minimal mode
    minimalMode = true;
    const step7Done = tryStep('degradation_step_7', () => this.activateMinimalMode(currentSections, input));
    if (step7Done) return this.degradationResult(currentSections, provenanceEntries, steps, minimalMode);

    // Step 8: Still over budget → error
    const finalEstimated = this.estimateTotalTokens(currentSections);
    throw new ContextTooLargeError(finalEstimated, inputBudget);
  }

  private degradationResult(
    sections: PromptSection[],
    provenance: SectionProvenanceEntry[],
    steps: DegradationReasonType[],
    minimalMode: boolean,
  ) {
    return { sections, provenance, steps, minimalMode };
  }

  private dropDebugContext(
    sections: PromptSection[],
  ): { sections: PromptSection[]; entries: SectionProvenanceEntry[] } {
    const entries: SectionProvenanceEntry[] = [];
    const kept: PromptSection[] = [];
    for (const s of sections) {
      if (s.kind === 'debug_data') {
        entries.push(
          createSectionEntry({
            kind: s.kind,
            sourceId: s.sourceId,
            originalTokens: this.tokenEstimator.estimateTokens(s.content),
            outcome: 'dropped',
            reason: 'degradation_step_1',
          }),
        );
      } else {
        kept.push(s);
      }
    }
    return { sections: kept, entries };
  }

  private dropNotesMetadata(
    sections: PromptSection[],
  ): { sections: PromptSection[]; entries: SectionProvenanceEntry[] } {
    const entries: SectionProvenanceEntry[] = [];
    const kept: PromptSection[] = [];
    for (const s of sections) {
      if (s.kind === 'notes_metadata') {
        entries.push(
          createSectionEntry({
            kind: s.kind,
            sourceId: s.sourceId,
            originalTokens: this.tokenEstimator.estimateTokens(s.content),
            outcome: 'dropped',
            reason: 'degradation_step_2',
          }),
        );
      } else {
        kept.push(s);
      }
    }
    return { sections: kept, entries };
  }

  private async summariseHistory(
    sections: PromptSection[],
    input: ContextOptimizerInput,
    tier: ModelContextTier,
  ): Promise<{ sections: PromptSection[]; entries: SectionProvenanceEntry[] }> {
    const entries: SectionProvenanceEntry[] = [];
    const updated = await Promise.all(
      sections.map(async (s) => {
        if (s.kind !== 'conversation_history') return s;
        const originalTokens = this.tokenEstimator.estimateTokens(s.content);
        const compressed = await this.compressor.compressHistory(
          input.conversationHistory || [],
          tier,
          input.providerId,
          input.modelId,
        );
        entries.push(
          createSectionEntry({
            kind: s.kind,
            sourceId: s.sourceId,
            originalTokens,
            finalTokens: this.tokenEstimator.estimateTokens(compressed),
            outcome: 'compressed',
            compressionMethod: tier === 'tiny' || tier === 'small' ? undefined : 'summarise',
            reason: 'degradation_step_3',
          }),
        );
        return { ...s, content: compressed };
      }),
    );
    return { sections: updated, entries };
  }

  private compressPageContext(
    sections: PromptSection[],
    input: ContextOptimizerInput,
  ): { sections: PromptSection[]; entries: SectionProvenanceEntry[] } {
    const entries: SectionProvenanceEntry[] = [];
    const updated = sections.map((s) => {
      if (s.kind !== 'page_context') return s;
      const originalTokens = this.tokenEstimator.estimateTokens(s.content);
      const compressed = this.compressor.compressContext(input.pageContext || s.content);
      entries.push(
        createSectionEntry({
          kind: s.kind,
          sourceId: s.sourceId,
          originalTokens,
          finalTokens: this.tokenEstimator.estimateTokens(compressed),
          outcome: 'compressed',
          compressionMethod: 'structural',
          reason: 'degradation_step_4',
        }),
      );
      return { ...s, content: compressed };
    });
    return { sections: updated, entries };
  }

  private trimToolSchemas(
    sections: PromptSection[],
    input: ContextOptimizerInput,
  ): { sections: PromptSection[]; entries: SectionProvenanceEntry[] } {
    if (!input.selectedToolSchemas || input.selectedToolSchemas.length === 0) {
      return { sections, entries: [] };
    }
    const entries: SectionProvenanceEntry[] = [];
    const selectedNames = new Set(input.selectedToolSchemas.map((t) => t.name));
    const updated = sections.map((s) => {
      if (s.kind !== 'tool_schemas') return s;
      const originalTokens = this.tokenEstimator.estimateTokens(s.content);
      const kept = input.selectedToolSchemas!.map((t) => `${t.name}: ${JSON.stringify(t.schema)}`).join('\n');
      entries.push(
        createSectionEntry({
          kind: s.kind,
          sourceId: s.sourceId,
          originalTokens,
          finalTokens: this.tokenEstimator.estimateTokens(kept),
          outcome: 'truncated',
          reason: 'degradation_step_5',
        }),
      );
      return { ...s, content: kept };
    });
    return { sections: updated, entries };
  }

  private reduceMemory(
    sections: PromptSection[],
  ): { sections: PromptSection[]; entries: SectionProvenanceEntry[] } {
    const entries: SectionProvenanceEntry[] = [];
    const updated = sections.map((s) => {
      if (s.kind !== 'memory') return s;
      const originalTokens = this.tokenEstimator.estimateTokens(s.content);
      entries.push(
        createSectionEntry({
          kind: s.kind,
          sourceId: s.sourceId,
          originalTokens,
          finalTokens: originalTokens,
          outcome: 'truncated',
          reason: 'degradation_step_6',
        }),
      );
      return s;
    });
    return { sections: updated, entries };
  }

  private activateMinimalMode(
    sections: PromptSection[],
    input: ContextOptimizerInput,
  ): { sections: PromptSection[]; entries: SectionProvenanceEntry[] } {
    const entries: SectionProvenanceEntry[] = [];
    const updated = sections.map((s) => {
      const originalTokens = this.tokenEstimator.estimateTokens(s.content);

      if (s.kind === 'system_prompt' && this.tokenEstimator.estimateTokens(s.content) > 300) {
        const truncated = s.content.slice(0, 1200);
        entries.push(
          createSectionEntry({
            kind: s.kind,
            sourceId: s.sourceId,
            originalTokens,
            finalTokens: this.tokenEstimator.estimateTokens(truncated),
            outcome: 'truncated',
            reason: 'minimal_mode',
          }),
        );
        return { ...s, content: truncated };
      }

      if (s.kind === 'memory') {
        const truncated = s.content;
        entries.push(
          createSectionEntry({
            kind: s.kind,
            sourceId: s.sourceId,
            originalTokens,
            finalTokens: this.tokenEstimator.estimateTokens(truncated),
            outcome: 'truncated',
            reason: 'minimal_mode',
          }),
        );
        return { ...s, content: truncated };
      }

      if (s.kind === 'conversation_history') {
        const truncated = s.content.slice(0, 800);
        entries.push(
          createSectionEntry({
            kind: s.kind,
            sourceId: s.sourceId,
            originalTokens,
            finalTokens: this.tokenEstimator.estimateTokens(truncated),
            outcome: 'truncated',
            reason: 'minimal_mode',
          }),
        );
        return { ...s, content: truncated };
      }

      if (s.kind === 'tool_schemas' && input.selectedToolSchemas && input.selectedToolSchemas.length > 0) {
        const first = input.selectedToolSchemas[0];
        const kept = `${first.name}: ${JSON.stringify(first.schema)}`;
        entries.push(
          createSectionEntry({
            kind: s.kind,
            sourceId: s.sourceId,
            originalTokens,
            finalTokens: this.tokenEstimator.estimateTokens(kept),
            outcome: 'truncated',
            reason: 'minimal_mode',
          }),
        );
        return { ...s, content: kept };
      }

      if (s.kind === 'notes_metadata' || s.kind === 'debug_data') {
        entries.push(
          createSectionEntry({
            kind: s.kind,
            sourceId: s.sourceId,
            originalTokens,
            finalTokens: 0,
            outcome: 'dropped',
            reason: 'minimal_mode',
          }),
        );
        return null;
      }

      entries.push(
        createSectionEntry({
          kind: s.kind,
          sourceId: s.sourceId,
          originalTokens,
          outcome: 'kept',
        }),
      );
      return s;
    });

    const filtered = updated.filter((s): s is PromptSection => s !== null);
    return { sections: filtered, entries };
  }
}

import { tokenEstimator } from './TokenEstimator';
import { contextCompressor } from './ContextCompressor';

function getModelEntryFromRegistry(
  _providerId: string,
  _modelId: string,
): import('../ai/providers/providerTypes').ModelEntry | undefined {
  debugLog('warn', '[ContextOptimizer] getModelEntryFromRegistry not wired — returning undefined');
  return undefined;
}

export const contextOptimizer = new ContextOptimizer(
  tokenEstimator,
  contextCompressor,
  getModelEntryFromRegistry,
);
