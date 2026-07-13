import { streamText } from 'ai';
import { debugLog } from '../../utils/debugLog';
import type { ProviderRouter } from '../router/ProviderRouter';
import type { CostTierType } from '../providers/providerTypes';
import type { OrchestratorEvent } from './pipelineTypes';
import type { ExecutionContext } from '../../telemetry/types';

export class RendererService {
  constructor(private router: ProviderRouter) {}

  async *render(
    tier: CostTierType,
    preferredProviders: string[],
    systemPrompt: string,
    messages: Array<{ role: string; content: string }>,
    abortSignal: AbortSignal,
    execCtx?: ExecutionContext,
  ): AsyncGenerator<OrchestratorEvent> {
    // 1. Get flash-tier model per AIRN-03
    const model = await this.router.selectModel('flash', preferredProviders, execCtx);
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

      // 4. Stream completed — emit renderer call trace
      execCtx?.traceCollector.onRendererCall({
        promptHash: simpleHash(systemPrompt + messages.map(m => m.content).join('')),
        tokenBreakdown: {
          system: Math.ceil(systemPrompt.length / 4),
          memory: 0,
          tools: 0,
          context: 0,
          history: 0,
          user: Math.ceil(messages.reduce((sum, m) => sum + m.content.length, 0) / 4),
          output: Math.ceil(fullText.length / 4),
          total: Math.ceil((systemPrompt.length + messages.reduce((sum, m) => sum + m.content.length, 0) + fullText.length) / 4),
        },
        contextTier: tier as any,
        truncated: false,
        minimalMode: false,
        cacheStats: { sectionsMarked: 0, estimatedSavings: 0 },
        timestamp: Date.now(),
        source: 'renderer' as const,
      });

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

/**
 * Simple hash function for prompt hashing (DJB2-like).
 * Non-cryptographic — used only for trace correlation.
 */
function simpleHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
