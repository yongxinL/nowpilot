import { generateText } from 'ai';
import type { ProviderAdapter } from './providers/ProviderAdapter';
import type { PlannerContext, ModelTier, StreamEvent } from './types';
import { resolveTierModel } from './TierResolver';
import { PipelineError } from './PipelineError';
import { streamToAsyncIterable } from './StreamAdapter';
import { inject } from './persona/PersonaInjector';

const BASE_SYSTEM_PROMPT = 'You are a helpful assistant. Provide clear, concise responses.';

function buildMessages(
  decision: { action: 'answer'; reasonCode: string },
  context: PlannerContext,
  systemPrompt?: string,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const prompt = systemPrompt ?? BASE_SYSTEM_PROMPT;
  return [
    { role: 'system' as const, content: prompt },
    ...context.conversationHistory,
    { role: 'user' as const, content: context.userMessage },
  ];
}

export class RendererService {
  async synthesize(
    adapter: ProviderAdapter,
    tier: ModelTier,
    decision: { action: 'answer'; reasonCode: string },
    context: PlannerContext,
  ): Promise<string> {
    const { modelId } = resolveTierModel(adapter, tier);
    const model = adapter.createLanguageModel(modelId);

    const systemPrompt = inject('renderer', [
      BASE_SYSTEM_PROMPT,
      `Response strategy: ${decision.reasonCode}`,
    ].join('\n'));

    try {
      const { text } = await generateText({
        model,
        messages: buildMessages(decision, context, systemPrompt),
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

  async stream(
    adapter: ProviderAdapter,
    tier: ModelTier,
    decision: { action: 'answer'; reasonCode: string },
    context: PlannerContext,
  ): Promise<AsyncIterable<StreamEvent>> {
    const { modelId } = resolveTierModel(adapter, tier);
    const model = adapter.createLanguageModel(modelId);

    const systemPrompt = inject('renderer', [
      BASE_SYSTEM_PROMPT,
      `Response strategy: ${decision.reasonCode}`,
    ].join('\n'));

    return streamToAsyncIterable({
      model,
      messages: buildMessages(decision, context, systemPrompt),
      abortSignal: context.abortSignal,
    });
  }
}

export const rendererService = new RendererService();
