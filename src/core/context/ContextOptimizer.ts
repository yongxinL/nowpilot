import { z } from 'zod';
import type { ContextOptimizerInput, OptimizedContext, PromptSection } from '../ai/types';
import { PipelineError } from '../ai/PipelineError';
import { classifyModelContext } from './ModelContextTier';
import { tokenBudget } from './TokenBudget';
import {
  createProvenanceManifest,
  markTruncated,
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
 * allocation, section assembly, provenance tracking, and the initial
 * budget check. Runs once per turn (D-02). Compression/degradation and
 * cache preparation arrive in Plans 04-02/04-03.
 */
export class ContextOptimizer {
  async optimize(input: ContextOptimizerInput): Promise<OptimizedContext> {
    const validation = ContextOptimizerInputSchema.safeParse(input);
    if (!validation.success) {
      throw new PipelineError('SCHEMA_INVALID', 'ContextOptimizer input validation failed.', {
        issues: validation.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }

    const tier = classifyModelContext(input.modelContextWindow);
    const budget = tokenBudget.allocateBudget(tier, input.modelContextWindow);
    const { inputBudget, outputBudget } = budget;

    const sections: PromptSection[] = [
      this.buildSystemSection(),
      this.buildToolSchemasSection(input.selectedToolSchemas),
      this.buildPreferencesSection(input.preferences),
      this.buildMemorySection(input.memoryHints),
      this.buildPageContextSection(input.pageContext),
      this.buildTaskSection(),
      this.buildUserInputSection(input.userInput),
    ];

    let sectionTotal = sections.reduce((sum, s) => sum + s.tokens, 0);
    let truncatedUserInput = false;

    // Budget check. Degradation (Plan 04-02) is not implemented yet — small
    // over-budget scenarios are handled by trimming the USER_INPUT section
    // from the start (keeping the most recent content); anything else that
    // still cannot fit raises the terminal CONTEXT_TOO_LARGE error.
    if (sectionTotal > inputBudget) {
      const userSection = sections.find((s) => s.kind === 'user_input');
      let guard = 0;
      while (
        sectionTotal > inputBudget &&
        userSection &&
        userSection.text.length > 0 &&
        guard < 64
      ) {
        const overflow = sectionTotal - inputBudget;
        // Dropping 4× the overflow in characters removes at least the
        // overflow in estimated tokens for both /4 and /3 estimation rates.
        const dropChars = Math.max(1, Math.ceil(overflow * 4));
        userSection.text = userSection.text.slice(Math.min(dropChars, userSection.text.length));
        userSection.tokens = tokenBudget.estimateTokens(userSection.text);
        sectionTotal = sections.reduce((sum, s) => sum + s.tokens, 0);
        guard++;
      }
      const userInputEmptied =
        userSection !== undefined && userSection.text.length === 0 && input.userInput.length > 0;
      if (sectionTotal > inputBudget || userInputEmptied) {
        throw new PipelineError('CONTEXT_TOO_LARGE', 'Context exceeds available token budget.', {
          tier,
          inputBudget,
          totalTokens: sectionTotal,
        });
      }
      truncatedUserInput = true;
    }

    const minimalMode = tier === 'tiny';

    const manifest = createProvenanceManifest(input.workspaceId, input.activeSurface);
    for (const section of sections) {
      recordSection(manifest, section);
    }
    manifest.minimalMode = minimalMode;
    if (truncatedUserInput) {
      markTruncated(manifest, 'interaction.user.current-turn');
    }

    return {
      tier,
      inputBudget,
      outputBudget,
      sections,
      provenance: manifest,
      minimalMode,
    };
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
