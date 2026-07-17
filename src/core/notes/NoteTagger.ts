import { generateText } from 'ai';
import { debugLog } from '../utils/debugLog';
import { repairAndValidate } from '../ai/pipeline/StructuredOutput';
import { providerRegistry } from '../ai/providers/ProviderRegistry';
import { taggerResultSchema, type TaggerResult } from './noteTypes';

export const TAGGER_PROMPT = `You are a note analysis system. Analyze the given note and return structured JSON.

Output ONLY valid JSON matching this schema:
{
  "tags": ["string — up to 5 lowercase keyword strings"],
  "categoryPath": "string — hierarchical category like "InfoTech/Database" or null if none fits",
  "summary": "string — 1-2 sentence summary of the note",
  "memoryFacts": [
    {
      "fact": "string — concise statement about the user",
      "category": "string — one of: preference, pattern, knowledge, goal, identity",
      "confidence": number (0.0-1.0),
      "tags": ["string array — lowercase keywords"]
    }
  ]
}

Rules:
- Tags: max 5, lowercase, single-concept keywords
- categoryPath: use existing categories when possible, or null
- summary: 1-2 sentences capturing the note's key point
- memoryFacts is optional — only include if the note reveals user preferences, patterns, or knowledge
- Max 5 memory facts
- Output ONLY the JSON, no markdown fences, no prose`;

export class NoteTagger {
  async analyze(
    note: { title: string; content: string },
    allCategories: string[],
  ): Promise<TaggerResult> {
    await providerRegistry.initialize();

    const models = providerRegistry.getModelsForTier('haiku');
    if (models.length === 0) {
      debugLog('warn', '[NoteTagger] no Haiku-tier models available');
      return { tags: [], categoryPath: null, summary: '', memoryFacts: [] };
    }

    const modelEntry = models[0];
    const provider = providerRegistry.getProvider(modelEntry.providerId);
    if (!provider) {
      debugLog('warn', '[NoteTagger] provider unavailable for Haiku-tier model', {
        modelId: modelEntry.modelId,
      });
      return { tags: [], categoryPath: null, summary: '', memoryFacts: [] };
    }

    const model = (provider.instance as any)(modelEntry.modelId);
    const prompt = `Title: ${note.title}\nContent: ${note.content}\nExisting categories: ${allCategories.join(', ')}`;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { text } = await generateText({
          model: model as Parameters<typeof generateText>[0]['model'],
          system: TAGGER_PROMPT,
          prompt,
        });

        const validated = repairAndValidate(text, taggerResultSchema, {
          tags: [],
          categoryPath: null,
          summary: '',
          memoryFacts: [],
        });

        if ('result' in validated) {
          return validated.result;
        }
        return { tags: [], categoryPath: null, summary: '', memoryFacts: [] };
      } catch (err) {
        if (attempt === 1) {
          debugLog('warn', '[NoteTagger] retrying after failure', { error: err });
        } else {
          debugLog('error', '[NoteTagger] analysis failed after retry', { error: err });
          return { tags: [], categoryPath: null, summary: '', memoryFacts: [] };
        }
      }
    }

    return { tags: [], categoryPath: null, summary: '', memoryFacts: [] };
  }
}

export const noteTagger = new NoteTagger();
