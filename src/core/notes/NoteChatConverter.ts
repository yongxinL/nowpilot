import { generateText } from 'ai';
import { debugLog } from '../utils/debugLog';
import { repairAndValidate } from '../ai/pipeline/StructuredOutput';
import { providerRegistry } from '../ai/providers/ProviderRegistry';
import { converterResultSchema, type ConverterResult } from './noteTypes';
import type { MemoryAssembleResult } from '../memory/memoryTypes';

export const CONVERTER_PROMPT = `You are a note draft generator. Convert conversation messages into a structured note draft.

Output ONLY valid JSON matching this schema:
{
  "title": "string — concise note title",
  "content": "string — markdown-formatted note body synthesizing key knowledge",
  "tags": ["string — up to 5 lowercase keywords"],
  "suggestedWikilinks": ["string — existing note titles relevant to this content"],
  "categoryPath": "string — suggested category or null"
}

Rules:
- Extract and organize key knowledge — don't decide what to include
- Title should be concise and descriptive
- Content should be well-structured markdown
- suggestedWikilinks must come from the provided existing note titles list
- categoryPath should match existing categories if possible
- Output ONLY the JSON, no markdown fences, no prose`;

export class NoteChatConverter {
  async convert(
    messages: Array<{ role: string; content: string }>,
    memoryContext?: MemoryAssembleResult,
    existingNoteTitles?: string[],
  ): Promise<ConverterResult> {
    await providerRegistry.initialize();

    const models = providerRegistry.getModelsForTier('haiku');
    if (models.length === 0) {
      debugLog('warn', '[NoteChatConverter] no Haiku-tier models available');
      return {
        title: 'New Note',
        content: '',
        tags: [],
        suggestedWikilinks: [],
        categoryPath: null,
      };
    }

    const modelEntry = models[0];
    const provider = providerRegistry.getProvider(modelEntry.providerId);
    if (!provider) {
      debugLog('warn', '[NoteChatConverter] provider unavailable for Haiku-tier model');
      return {
        title: 'New Note',
        content: '',
        tags: [],
        suggestedWikilinks: [],
        categoryPath: null,
      };
    }

    const model = (provider.instance as any)(modelEntry.modelId);

    let prompt = 'Conversation messages:\n';
    prompt += messages
      .slice(-20)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    if (memoryContext && memoryContext.memory.length > 0) {
      prompt += `\n\nRelevant user context:\n${memoryContext.memory.map((m) => `- ${m.content}`).join('\n')}`;
    }

    if (existingNoteTitles && existingNoteTitles.length > 0) {
      prompt += `\n\nExisting note titles for wikilink suggestions:\n${existingNoteTitles.join(', ')}`;
    }

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { text } = await generateText({
          model: model as Parameters<typeof generateText>[0]['model'],
          system: CONVERTER_PROMPT,
          prompt,
        });

        const validated = repairAndValidate(text, converterResultSchema, {
          title: 'New Note',
          content: '',
          tags: [],
          suggestedWikilinks: [],
          categoryPath: null,
        });

        if ('result' in validated) {
          return validated.result;
        }
        return {
          title: 'New Note',
          content: '',
          tags: [],
          suggestedWikilinks: [],
          categoryPath: null,
        };
      } catch (err) {
        if (attempt === 1) {
          debugLog('warn', '[NoteChatConverter] retrying after failure', { error: err });
        } else {
          debugLog('error', '[NoteChatConverter] conversion failed after retry', {
            error: err,
          });
          return {
            title: 'New Note',
            content: '',
            tags: [],
            suggestedWikilinks: [],
            categoryPath: null,
          };
        }
      }
    }

    return {
      title: 'New Note',
      content: '',
      tags: [],
      suggestedWikilinks: [],
      categoryPath: null,
    };
  }
}

export const noteChatConverter = new NoteChatConverter();
