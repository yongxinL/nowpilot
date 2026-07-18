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
    modelId?: string,
  ): AsyncGenerator<OrchestratorEvent> {
    const renderTier = modelId ? tier : 'flash';
    const model = await this.router.selectModel(renderTier, preferredProviders, execCtx, modelId);
    if (!model) {
      debugLog('error', '[RendererService] No flash-tier model available');
      yield { type: 'error', message: 'No flash-tier model available for rendering' };
      return;
    }

    let fullText = '';
    let reasoningText = '';
    try {
      // Map messages to Vercel AI SDK parts format if they contain attachments
      const processedMessages = messages.map((msg) => {
        const textContent = msg.content;
        const attachmentRegex = /<attachment\s+name="([^"]+)"\s+type="image\/jpeg">([^<]+)<\/attachment>/g;
        const matches: Array<{ name: string; base64: string }> = [];
        let match;
        
        while ((match = attachmentRegex.exec(textContent)) !== null) {
          matches.push({
            name: match[1],
            base64: match[2].trim(),
          });
        }
        
        if (matches.length > 0) {
          const cleanText = textContent.replace(/<attachment\s+name="([^"]+)"\s+type="image\/jpeg">[^<]+<\/attachment>/g, (m, name) => `[Image: ${name}]`);
          const parts: any[] = [{ type: 'text', text: cleanText }];
          
          matches.forEach((m) => {
            let rawBase64 = m.base64;
            if (rawBase64.includes(';base64,')) {
              rawBase64 = rawBase64.split(';base64,')[1];
            }
            parts.push({
              type: 'image',
              image: rawBase64,
              mimeType: 'image/jpeg',
            });
          });
          
          return {
            role: msg.role,
            content: parts,
          };
        }
        
        return msg;
      });

      const result = streamText({
        model: model.instance as Parameters<typeof streamText>[0]['model'],
        system: systemPrompt,
        messages: processedMessages as any,
        maxTokens: 512,
        abortSignal,
      });

      // Iterate fullStream to capture both text and reasoning deltas.
      // reasoning-delta events are emitted by the AI SDK when the provider
      // returns structured reasoning content (e.g. OpenAI o1/o3 reasoning_content,
      // Anthropic thinking blocks). For models that don't emit this, all content
      // arrives as text-delta and appears directly in the message.
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          const delta = (part as any).text ?? (part as any).delta ?? '';
          fullText += delta;
          yield { type: 'text-delta', text: delta };
        } else if (part.type === 'reasoning-delta') {
          const delta = (part as any).text ?? (part as any).delta ?? '';
          reasoningText += delta;
          yield { type: 'reasoning-delta', text: delta };
        }
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

      yield { type: 'text-complete', fullText, reasoning: reasoningText || undefined };
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        if (fullText.length > 0) {
          debugLog('warn', '[RendererService] Stream interrupted — returning partial text', { received: fullText.length });
          yield { type: 'text-complete', fullText, reasoning: reasoningText || undefined };
        }
      }
      const message = err instanceof Error ? err.message : 'Renderer stream failed';
      debugLog('error', '[RendererService] Stream error', { error: err });
      yield { type: 'error', message };
    }
  }
}

function simpleHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
