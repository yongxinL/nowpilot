import { generateText } from 'ai';
import type { ProviderAdapter } from './providers/ProviderAdapter';
import type { OptimizedContext, ModelTier, StreamEvent } from './types';
import { resolveTierModel } from './TierResolver';
import { PipelineError } from './PipelineError';
import { streamToAsyncIterable } from './StreamAdapter';
import { inject } from './persona/PersonaInjector';
import type { RenderingOutcomePolicy } from './RenderingOutcomePolicy';

const BASE_SYSTEM_PROMPT = 'You are a helpful assistant. Provide clear, concise responses.';

function buildMessages(
  decision: { action: 'answer'; reasonCode: string },
  optimized: OptimizedContext,
  systemPrompt?: string,
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  const prompt = systemPrompt ?? BASE_SYSTEM_PROMPT;

  // Conversation history assembly (kind: 'history') is future work in this
  // phase — no history sections are produced yet (Plan 04-02/04-03).
  const history: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  const userSection = optimized.sections.find((s) => s.kind === 'user_input');
  return [
    { role: 'system' as const, content: prompt },
    ...history,
    { role: 'user' as const, content: userSection?.text ?? '' },
  ];
}

function buildSystemPrompt(
  optimized: OptimizedContext,
  decision: { action: 'answer'; reasonCode: string },
  policy?: RenderingOutcomePolicy,
): string {
  const systemSection = optimized.sections.find((s) => s.kind === 'system');
  const parts: string[] = [
    systemSection?.text ?? BASE_SYSTEM_PROMPT,
    `Response strategy: ${decision.reasonCode}`,
  ];
  // D-11: the renderer includes only the policy's bounded evidence
  // instruction — it never inspects CompletionEvidence or decides
  // evidence sufficiency itself.
  if (policy?.evidenceSummary) {
    parts.push(`Evidence guidance: ${policy.evidenceSummary}`);
  }
  return inject('renderer', parts.join('\n'));
}

export class RendererService {
  /**
   * Synthesize the final answer from the orchestrator-supplied
   * RenderingOutcomePolicy (D-11). The policy is required at every
   * orchestrator call site; omitted-policy handling below is a defensive
   * fallback only — the renderer never upgrades evidence or outcome state.
   */
  async synthesize(
    adapter: ProviderAdapter,
    tier: ModelTier,
    decision: { action: 'answer'; reasonCode: string },
    optimized: OptimizedContext,
    policy?: RenderingOutcomePolicy,
    signal?: AbortSignal,
  ): Promise<string> {
    const { modelId } = resolveTierModel(adapter, tier);
    const model = adapter.createLanguageModel(modelId);

    const systemPrompt = buildSystemPrompt(optimized, decision, policy);

    try {
      const { text } = await generateText({
        model,
        messages: buildMessages(decision, optimized, systemPrompt),
        ...(signal ? { signal } : {}),
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
    optimized: OptimizedContext,
    policy?: RenderingOutcomePolicy,
    signal?: AbortSignal,
  ): Promise<AsyncIterable<StreamEvent>> {
    const { modelId } = resolveTierModel(adapter, tier);
    const model = adapter.createLanguageModel(modelId);

    const systemPrompt = buildSystemPrompt(optimized, decision, policy);

    return streamToAsyncIterable({
      model,
      messages: buildMessages(decision, optimized, systemPrompt),
      ...(signal ? { abortSignal: signal } : {}),
    });
  }
}

export const rendererService = new RendererService();
