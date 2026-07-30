import { generateText } from 'ai';
import type { z } from 'zod';
import { PipelineError } from './PipelineError';
import type { ProviderAdapter } from './providers/ProviderAdapter';
import type { ModelTier } from './types';
import { resolveTierModel } from './TierResolver';

function isSchemaError(err: unknown): err is Error {
  return err instanceof Error;
}

export function repairJSON<T>(rawText: string, schema: z.ZodSchema<T>): T {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new PipelineError('SCHEMA_INVALID', 'Empty response from AI.', { rawText: '' });
  }

  let cleaned = trimmed;

  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, '');
  cleaned = cleaned.replace(/\n?```\s*$/i, '');

  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  const jsonStart = firstBrace >= 0 && (firstBracket < 0 || firstBrace < firstBracket)
    ? firstBrace
    : firstBracket;

  if (jsonStart < 0) {
    throw new PipelineError('SCHEMA_INVALID', 'No JSON found in AI response.', { rawText: trimmed.slice(0, 200) });
  }

  cleaned = cleaned.slice(jsonStart);

  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  const openBraces = (cleaned.match(/\{/g) ?? []).length;
  const closeBraces = (cleaned.match(/\}/g) ?? []).length;
  if (openBraces > closeBraces) {
    cleaned += '}'.repeat(openBraces - closeBraces);
  }

  const openBrackets = (cleaned.match(/\[/g) ?? []).length;
  const closeBrackets = (cleaned.match(/\]/g) ?? []).length;
  if (openBrackets > closeBrackets) {
    cleaned += ']'.repeat(openBrackets - closeBrackets);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new PipelineError('SCHEMA_INVALID', 'Failed to parse AI response as JSON after repair.', {
      rawText: trimmed.slice(0, 500),
      repairedText: cleaned.slice(0, 500),
    });
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new PipelineError('SCHEMA_INVALID', 'AI response did not match expected schema.', {
      rawText: trimmed.slice(0, 500),
      errors: (result.error.issues as Array<{ path: (string | number)[]; message: string }>).map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
    });
  }

  return result.data;
}

export async function generateWithRepair<T>(
  adapter: ProviderAdapter,
  tier: ModelTier,
  prompt: string,
  schema: z.ZodSchema<T>,
  abortSignal?: AbortSignal,
): Promise<T> {
  const { modelId } = resolveTierModel(adapter, tier);
  const model = adapter.createLanguageModel(modelId);

  const systemPrompt = [
    'You are a JSON response generator. Respond ONLY with a valid JSON object.',
    'Do not include markdown fences, explanations, or any text outside the JSON.',
    prompt,
  ].join('\n');

  try {
    const { text } = await generateText({
      model,
      messages: [{ role: 'system', content: systemPrompt }],
      abortSignal,
    });

    return repairJSON(text, schema);
  } catch (err) {
    if (err instanceof PipelineError) throw err;
    if (isSchemaError(err) && err.name === 'AbortError') {
      throw new PipelineError('ABORTED', 'Request was aborted.', {});
    }
    throw new PipelineError('UNKNOWN', 'Structured output generation failed.', { originalError: String(err) });
  }
}
