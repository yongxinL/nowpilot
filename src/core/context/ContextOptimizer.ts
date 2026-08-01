import { z } from 'zod';
import type {
  ContextOptimizerInput,
  ContextProvenanceEntry,
  OptimizedContext,
  PromptSection,
} from '../ai/types';
import { PipelineError } from '../ai/PipelineError';
import { providerRouter } from '../ai/ProviderRouter';
import { hashStableSections } from '../ai/PromptCacheAdapter';
import { classifyModelContext } from './ModelContextTier';
import { tokenBudget } from './TokenBudget';
import { contextCompressor } from './ContextCompressor';
import {
  createProvenanceManifest,
  markCompression,
  recordSection,
} from './ContextProvenanceManifest';

const ToolSchemaInfoSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  jsonSchema: z.unknown().optional(),
  dangerous: z.boolean().optional(),
  source: z.string().optional(),
});

/**
 * Input validation per T-04-02/T-04-04: modelContextWindow must be a
 * positive integer, userInput is capped at 100K chars (~25K tokens) to
 * prevent memory exhaustion, and identity fields must be non-empty.
 */
const ContextOptimizerInputSchema = z.object({
  operationId: z.string().min(1),
  model: z.string().min(1),
  modelContextWindow: z.number().int().positive(),
  userInput: z.string().max(100000),
  conversationId: z.string().min(1),
  workspaceId: z.string().min(1),
  activeSurface: z.enum(['sidepanel', 'full-app']),
  pageContext: z.unknown().optional(),
  selectedToolSchemas: z.array(ToolSchemaInfoSchema),
  memoryHints: z.array(z.unknown()),
  preferences: z
    .object({
      responseStyle: z.string().optional(),
      preferredLanguage: z.string().optional(),
      preferStructuredOutput: z.boolean().optional(),
      allowCloudFallbackFromLocal: z.boolean().optional(),
      defaultProviderId: z.string().optional(),
      toolAutonomy: z.string().optional(),
      defaultSurface: z.enum(['sidepanel', 'full-app']).optional(),
      themeMode: z.string().optional(),
      personaId: z.string().optional(),
      personaOverrides: z.unknown().optional(),
    })
    .passthrough(),
});

const SYSTEM_PROMPT_TEXT =
  'You are a helpful AI assistant. You have access to tools and context to help the user.';

/**
 * First-class pipeline stage (D-01): owns tier classification, budget
 * allocation, section assembly, provenance tracking, the initial budget
 * check, degradation (04-02), and prompt cache metadata (04-03). Runs
 * once per turn (D-02).
 */
export class ContextOptimizer {
  async optimize(input: ContextOptimizerInput): Promise<OptimizedContext> {
    const validation = ContextOptimizerInputSchema.safeParse(input);
    if (!validation.success) {
      throw new PipelineError('SCHEMA_INVALID', 'ContextOptimizer input validation failed.', {
        issues: validation.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const signal = input.abortSignal;
    if (signal?.aborted) {
      throw new PipelineError('ABORTED', 'Context optimization was aborted.', {
        stage: 'optimize-entry',
      });
    }

    const tier = classifyModelContext(input.modelContextWindow);
    const budget = tokenBudget.allocateBudget(tier, input.modelContextWindow);
    const { inputBudget, outputBudget } = budget;

    const assembledSections: PromptSection[] = [
      this.buildSystemSection(),
      this.buildToolSchemasSection(input.selectedToolSchemas),
      this.buildPreferencesSection(input.preferences),
      this.buildMemorySection(input.memoryHints),
      this.buildPageContextSection(input.pageContext),
      this.buildTaskSection(),
      this.buildUserInputSection(input.userInput),
    ];

    // Step 3.5: degradation pipeline (D-06, D-07) — when the assembled
    // context exceeds the input budget, ContextCompressor applies the 7
    // ordered degradation steps (plus AI summarization overflow via
    // ProviderRouter.getCompressionModel per D-08), then the budget is
    // re-checked. This replaces the Plan 04-01 placeholder user-input
    // trim: degradation is the canonical over-budget path.
    let sections: PromptSection[] = assembledSections;
    let stepsApplied: string[] = [];
    const totalBeforeDegradation = sections.reduce((sum, s) => sum + s.tokens, 0);

    if (totalBeforeDegradation > inputBudget) {
      if (signal?.aborted) {
        throw new PipelineError('ABORTED', 'Context optimization was aborted.', {
          stage: 'before-compression',
        });
      }
      const result = await contextCompressor.compress(
        sections,
        inputBudget,
        tier,
        () => providerRouter.getCompressionModel(),
        signal,
      );
      if (signal?.aborted) {
        throw new PipelineError('ABORTED', 'Context optimization was aborted.', {
          stage: 'after-compression',
        });
      }
      sections = result.sections;
      stepsApplied = result.stepsApplied;

      // CONTEXT_TOO_LARGE is thrown only after ALL degradation steps
      // (and AI summarization, if available) fail to satisfy the budget.
      const totalAfterDegradation = sections.reduce((sum, s) => sum + s.tokens, 0);
      if (totalAfterDegradation > inputBudget) {
        throw new PipelineError(
          'CONTEXT_TOO_LARGE',
          `Context exceeds the available token budget (${inputBudget} tokens) after all degradation steps. ` +
            `Current context: ${totalAfterDegradation} tokens. Try simplifying your request or reducing context.`,
          { tier, inputBudget, totalTokens: totalAfterDegradation, stepsApplied },
        );
      }
    }

    // Minimal mode is mandatory for tiny models (§2.5) and also activates
    // when the 'minimal-mode' degradation step runs on any tier.
    const minimalMode = tier === 'tiny' || stepsApplied.includes('minimal-mode');

    const manifest = createProvenanceManifest(input.workspaceId, input.activeSurface);
    for (const section of sections) {
      recordSection(manifest, section);
    }
    manifest.minimalMode = minimalMode;

    // Record degradation decisions in provenance (D-07): each section that
    // changed during compression carries a compressionApplied value derived
    // from the steps that ran. Sections dropped entirely (e.g. debug or
    // page context) are simply absent from the manifest.
    if (stepsApplied.length > 0) {
      for (const section of sections) {
        const method = this.deriveCompressionMethod(section, stepsApplied, assembledSections);
        if (method) markCompression(manifest, section.sourceId, method);
      }
    }

    // Step 6: prepare prompt cache metadata (final stage, D-13). The
    // provider is not known here (selection happens later in
    // AgentOrchestrator), so optimize() computes the provider-agnostic
    // cache metadata: the FNV-1a cache key hash of the stable sections
    // (D-16) and the stable section count. The per-provider cache hint
    // transformation runs via PromptCacheManager.prepareCacheHints() after
    // provider selection; cacheKeyHash is stable across providers so
    // cross-turn cache-hit detection is preserved (D-16).
    const cacheMetadata = {
      cacheKeyHash: hashStableSections(sections),
      stableSectionCount: sections.filter((s) => s.stable).length,
    };

    return {
      tier,
      inputBudget,
      outputBudget,
      sections,
      provenance: manifest,
      minimalMode,
      cacheMetadata,
    };
  }

  /**
   * Map a degraded section to its provenance compression method. The
   * method is derived from the steps that ran (D-07): 'summarise-history'
   * → 'summarise', 'compress-page' → 'structural', 'reduce-memory' →
   * 'topk'. Minimal mode applies the §2.5 caps across kinds.
   */
  private deriveCompressionMethod(
    section: PromptSection,
    stepsApplied: string[],
    assembledSections: PromptSection[],
  ): ContextProvenanceEntry['compressionApplied'] | undefined {
    const original = assembledSections.find((s) => s.sourceId === section.sourceId);
    const unchanged =
      original !== undefined && original.text === section.text && original.tokens === section.tokens;
    if (unchanged) return undefined;

    const minimal = stepsApplied.includes('minimal-mode');
    if (section.kind === 'system') return minimal ? 'summarise' : undefined;
    if (section.kind === 'tool_schemas') {
      return stepsApplied.includes('trim-tools') || minimal ? 'structural' : undefined;
    }
    if (section.kind === 'memory') {
      return stepsApplied.includes('reduce-memory') || minimal ? 'topk' : undefined;
    }
    if (section.kind === 'context') {
      if (
        section.sourceId.startsWith('history.') &&
        (stepsApplied.includes('summarise-history') || minimal)
      ) {
        return 'summarise';
      }
      if (stepsApplied.includes('compress-page') || minimal) return 'structural';
    }
    return undefined;
  }

  private buildSystemSection(): PromptSection {
    return {
      kind: 'system',
      text: SYSTEM_PROMPT_TEXT,
      tokens: tokenBudget.estimateTokens(SYSTEM_PROMPT_TEXT),
      stable: true,
      sourceId: 'core.instructions.system',
    };
  }

  private buildToolSchemasSection(
    selectedToolSchemas: ContextOptimizerInput['selectedToolSchemas'],
  ): PromptSection {
    const text = JSON.stringify(
      selectedToolSchemas.map(({ name, description }) => ({ name, description })),
    );
    return {
      kind: 'tool_schemas',
      text,
      tokens: tokenBudget.estimateTokens(text),
      stable: true,
      sourceId: 'tools.builtin.selected',
    };
  }

  private buildPreferencesSection(
    preferences: ContextOptimizerInput['preferences'],
  ): PromptSection {
    const text = JSON.stringify(preferences);
    return {
      kind: 'preferences',
      text,
      tokens: tokenBudget.estimateTokens(text),
      stable: true,
      sourceId: 'core.preferences.user',
    };
  }

  private buildMemorySection(memoryHints: ContextOptimizerInput['memoryHints']): PromptSection {
    const text = memoryHints.length > 0 ? JSON.stringify(memoryHints) : '';
    return {
      kind: 'memory',
      text,
      tokens: tokenBudget.estimateTokens(text),
      stable: false,
      sourceId: 'memory.user.facts',
    };
  }

  private buildPageContextSection(pageContext: ContextOptimizerInput['pageContext']): PromptSection {
    const text = pageContext !== undefined ? JSON.stringify(pageContext) : '';
    return {
      kind: 'context',
      text,
      tokens: tokenBudget.estimateTokens(text),
      stable: false,
      sourceId: 'context.page.current',
    };
  }

  private buildTaskSection(): PromptSection {
    return {
      kind: 'task',
      text: '',
      tokens: 0,
      stable: false,
      sourceId: 'core.task.placeholder',
    };
  }

  private buildUserInputSection(userInput: string): PromptSection {
    return {
      kind: 'user_input',
      text: userInput,
      tokens: tokenBudget.estimateTokens(userInput),
      stable: false,
      sourceId: 'interaction.user.current-turn',
    };
  }
}

export const contextOptimizer = new ContextOptimizer();
