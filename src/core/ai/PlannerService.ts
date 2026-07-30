import { generateText, Output, isStepCount } from 'ai';
import { z } from 'zod';
import type { ProviderAdapter } from './providers/ProviderAdapter';
import type { PlannerContext, PlannerDecision, ModelTier } from './types';
import { PipelineError } from './PipelineError';
import { resolveTierModel } from './TierResolver';

const PlannerDecisionSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('answer'), reasonCode: z.string().max(64) }),
  z.strictObject({ action: z.literal('run_tool'), toolName: z.string().max(64), input: z.unknown() }),
  z.strictObject({ action: z.literal('ask_clarification'), question: z.string().max(200) }),
]);

export class PlannerService {
  async plan(
    adapter: ProviderAdapter,
    tier: ModelTier,
    context: PlannerContext,
  ): Promise<PlannerDecision> {
    const { modelId } = resolveTierModel(adapter, tier);
    const model = adapter.createLanguageModel(modelId);

    const systemPrompt = [
      'You are a planning agent that decides the next action.',
      'Pick exactly one action based on the user message and conversation history:',
      '- answer: respond directly to the user',
      '- run_tool: execute a tool to gather more information',
      '- ask_clarification: ask the user for more details',
    ].join('\n');

    try {
      const { output } = await generateText({
        model,
        output: Output.object({ schema: PlannerDecisionSchema }),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: context.userMessage },
        ],
        stopWhen: isStepCount(1),
        abortSignal: context.abortSignal,
      });
      return output as PlannerDecision;
    } catch (err) {
      if (err instanceof PipelineError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new PipelineError('ABORTED', 'Request was aborted.', { originalError: err.message });
      }
      throw new PipelineError('UNKNOWN', 'Planner service failed.', { originalError: String(err) });
    }
  }
}

export const plannerService = new PlannerService();
