import { generateText } from 'ai';
import type { ProviderAdapter } from './providers/ProviderAdapter';
import type { PlannerContext, ModelTier } from './types';
import { resolveTierModel } from './TierResolver';
import { PipelineError } from './PipelineError';

export class RendererService {
  async synthesize(
    adapter: ProviderAdapter,
    tier: ModelTier,
    decision: { action: 'answer'; reasonCode: string },
    context: PlannerContext,
  ): Promise<string> {
    const { modelId } = resolveTierModel(adapter, tier);
    const model = adapter.createLanguageModel(modelId);

    const systemPrompt = [
      'You are a helpful assistant. Provide clear, concise responses.',
      `Reason for answering: ${decision.reasonCode}`,
    ].join('\n');

    try {
      const { text } = await generateText({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...context.conversationHistory,
          { role: 'user', content: context.userMessage },
        ],
        abortSignal: context.abortSignal,
      });
      return text;
    } catch (err) {
      if (err instanceof PipelineError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new PipelineError('ABORTED', 'Response generation was aborted.', {});
      }
      throw new PipelineError('UNKNOWN', 'Failed to generate response.', { originalError: String(err) });
    }
  }
}

export const rendererService = new RendererService();
