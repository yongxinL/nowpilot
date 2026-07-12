import { generateText } from 'ai';
import { debugLog } from '../utils/debugLog';
import { tokenEstimator } from './TokenEstimator';
import type { ModelContextTier } from './contextTypes';

type ModelAccessor = (providerId: string, modelId: string) => Promise<unknown>;

const HISTORY_SUMMARY_PROMPT = `Summarize the following conversation in at most 200 tokens. Focus on: key decisions, action items, and user preferences. Do not include greetings or pleasantries.

Conversation:
{history}

Summary:`;

export class ContextCompressor {
  constructor(private modelAccessor: ModelAccessor) {}

  async compressHistory(
    messages: Array<{ role: string; content: string }>,
    tier: ModelContextTier,
    providerId: string,
    modelId: string,
  ): Promise<string> {
    if (tier === 'tiny' || tier === 'small') {
      return this.heuristicCompressHistory(messages);
    }
    return this.llmCompressHistory(messages, providerId, modelId);
  }

  compressContext(pageContext: string | Record<string, unknown>): string {
    if (typeof pageContext === 'object' && pageContext !== null) {
      return this.structuralExtract(pageContext);
    }
    return this.heuristicTruncate(pageContext, 300);
  }

  private async llmCompressHistory(
    messages: Array<{ role: string; content: string }>,
    providerId: string,
    modelId: string,
  ): Promise<string> {
    try {
      const history = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
      const prompt = HISTORY_SUMMARY_PROMPT.replace('{history}', history);
      const model = await this.modelAccessor(providerId, modelId);
      const { text } = await generateText({
        model: model as Parameters<typeof generateText>[0]['model'],
        system: 'You are a conversation summarizer. Be concise.',
        prompt,
        maxTokens: 200,
        temperature: 0,
      });
      debugLog('info', '[ContextCompressor] LLM summarization completed', {
        inputTokens: tokenEstimator.estimateTokens(history),
        outputTokens: tokenEstimator.estimateTokens(text),
      });
      return text;
    } catch (err) {
      debugLog('error', '[ContextCompressor] LLM summarization failed, falling back to heuristic', {
        error: err,
      });
      return this.heuristicCompressHistory(messages);
    }
  }

  private heuristicCompressHistory(
    messages: Array<{ role: string; content: string }>,
  ): string {
    const text = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
    return this.heuristicTruncate(text, 500);
  }

  private structuralExtract(context: Record<string, unknown>): string {
    const fields: string[] = [];
    if (context.title) fields.push(`Title: ${context.title}`);
    if (context.url) fields.push(`URL: ${context.url}`);
    if (context.summary) fields.push(`Summary: ${context.summary}`);
    if (fields.length === 0) {
      const str = JSON.stringify(context);
      return this.heuristicTruncate(str, 300);
    }
    const result = fields.join('\n');
    const estimated = tokenEstimator.estimateTokens(result);
    if (estimated > 300) {
      return this.heuristicTruncate(result, 300);
    }
    return result;
  }

  private heuristicTruncate(text: string, maxTokens: number): string {
    const estimated = tokenEstimator.estimateTokens(text);
    if (estimated <= maxTokens) return text;
    const targetChars = maxTokens * 4;
    if (targetChars >= text.length) return text;
    return text.slice(0, targetChars) + '\n[truncated]';
  }
}

export const contextCompressor = new ContextCompressor(
  async () => { throw new Error('ContextCompressor singleton not wired — inject via constructor'); },
);
