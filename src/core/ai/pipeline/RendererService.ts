import { streamText } from 'ai';
import { debugLog } from '../../utils/debugLog';
import type { ProviderRouter } from '../router/ProviderRouter';
import type { CostTierType } from '../providers/providerTypes';
import type { OrchestratorEvent } from './pipelineTypes';

export class RendererService {
  constructor(private router: ProviderRouter) {}

  async *render(
    tier: CostTierType,
    preferredProviders: string[],
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    abortSignal: AbortSignal,
  ): AsyncGenerator<OrchestratorEvent> {
    // 1. Get flash-tier model per AIRN-03
    const model = await this.router.selectModel('flash', preferredProviders);
    if (!model) {
      debugLog('error', '[RendererService] No flash-tier model available');
      yield { type: 'error', message: 'No flash-tier model available for rendering' };
      return;
    }

    // 2. Call streamText
    let fullText = '';
    try {
      const result = streamText({
        model: model.instance as Parameters<typeof streamText>[0]['model'],
        system: systemPrompt,
        messages: messages as any,
        maxTokens: 512,
        abortSignal,
      });

      // 3. Iterate textStream
      for await (const chunk of result.textStream) {
        fullText += chunk;
        yield { type: 'text-delta', text: chunk };
      }

      // 4. Stream completed
      yield { type: 'text-complete', fullText };
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        // D-18 recovery: return partial text if any tokens were received
        if (fullText.length > 0) {
          debugLog('warn', '[RendererService] Stream interrupted — returning partial text', { received: fullText.length });
          yield { type: 'text-complete', fullText };
        }
      }
      const message = err instanceof Error ? err.message : 'Renderer stream failed';
      debugLog('error', '[RendererService] Stream error', { error: err });
      yield { type: 'error', message };
    }
  }
}
