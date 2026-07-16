import { generateText } from 'ai';
import { debugLog } from '../utils/debugLog';
import type { ModelContextTier } from '../context/contextTypes';
import type { MemoryExtractionResult } from './memoryTypes';
import { extractionResultSchema } from './memoryTypes';
import { providerRegistry } from '../ai/providers/ProviderRegistry';

// ---------------------------------------------------------------------------
// Extraction prompt template
// ---------------------------------------------------------------------------

export const EXTRACTION_PROMPT = `You are a memory extraction system. Analyze the conversation and extract user facts.

Output ONLY valid JSON matching this schema:
{
  "facts": [
    {
      "fact": "string — concise statement about the user",
      "category": "string — one of: preference, pattern, knowledge, goal, identity",
      "confidence": number (0.0-1.0),
      "tags": ["string array — keywords for retrieval"]
    }
  ],
  "summary": "string — optional conversation summary"
}

Rules:
- Extract only facts about the USER, not the assistant
- Confidence reflects how certain the fact is (0.9 = explicit statement, 0.5 = implied, 0.3 = guess)
- Tags should be lowercase, single-concept keywords for search retrieval
- Do NOT extract transient conversation details (what was said now)
- Do NOT extract facts the user has already told us before (check previous facts context if provided)
- Max 5 facts per extraction`;

// ---------------------------------------------------------------------------
// Model accessor type (resolves a model provider + model instance)
// ---------------------------------------------------------------------------

type ModelAccessorResult = { provider: string; model: unknown };

// ---------------------------------------------------------------------------
// MemoryExtractor class
// ---------------------------------------------------------------------------

export class MemoryExtractor {
  constructor(
    private modelAccessor: (tier: ModelContextTier) => ModelAccessorResult,
  ) {}

  /**
   * Resolve a model provider+instance by modelId from the registry.
   * Returns undefined if the model is not found or the provider is unavailable.
   */
  private resolveModelById(modelId: string): ModelAccessorResult | undefined {
    const allModels = providerRegistry.listModels();
    const entry = allModels.find(m => m.modelId === modelId);
    if (!entry) {
      debugLog('warn', '[MemoryExtractor] preferred model not found in registry — falling back to tier model', { modelId, availableModels: allModels.map(m => m.modelId) });
      return undefined;
    }
    const provider = providerRegistry.getProvider(entry.providerId);
    if (!provider) {
      debugLog('warn', '[MemoryExtractor] provider not available for preferred model — falling back to tier model', { modelId, providerId: entry.providerId });
      return undefined;
    }
    debugLog('info', '[MemoryExtractor] using preferred model for extraction', { modelId, providerId: entry.providerId });
    return {
      provider: entry.providerId,
      model: (provider.instance as any)(entry.modelId),
    };
  }

  /**
   * Extract facts and optional summary from a conversation.
   *
   * Uses Haiku-tier generateText call with low-temperature deterministic output.
   * Validates AI output against extractionResultSchema via safeParse.
   * Retries ONCE on failure per D-04. NEVER throws — always returns a valid
   * MemoryExtractionResult (empty facts on complete failure).
   *
   * @param messages — conversation messages (user + assistant)
   * @param tier — model context tier for model resolution (default: 'small')
   */
  async extract(
    messages: Array<{ role: string; content: string }>,
    tier: ModelContextTier = 'small',
    preferredModelId?: string,
  ): Promise<MemoryExtractionResult> {
    await providerRegistry.initialize();

    // If a specific modelId is provided, try to use it (avoids loading a
    // different model on the backend for post-conversation extraction).
    const resolved = preferredModelId
      ? this.resolveModelById(preferredModelId) ?? this.modelAccessor(tier)
      : this.modelAccessor(tier);
    const conversationText = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    // D-04: Retry once (2 attempts total), then drop on complete failure
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { text } = await generateText({
          model: resolved.model as Parameters<typeof generateText>[0]['model'],
          system: EXTRACTION_PROMPT,
          prompt: conversationText,
          maxTokens: 300,
        });

        // Strip markdown code fences if present (reasoning models often wrap JSON)
        const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
        const parsed = JSON.parse(cleaned);
        const validated = extractionResultSchema.safeParse(parsed);

        if (validated.success) {
          debugLog('info', '[MemoryExtractor] extracted ' + validated.data.facts.length + ' facts', {
            count: validated.data.facts.length,
          });
          return validated.data;
        }

        // T-05-10: Invalid/unexpected output — discard silently
        debugLog('warn', '[MemoryExtractor] invalid output, discarding', {
          error: validated.error,
        });
        return { facts: [], summary: undefined };
      } catch (err) {
        if (attempt === 1) {
          // First failure: retry once (D-04)
          debugLog('warn', '[MemoryExtractor] retrying');
        } else {
          // Second failure: log and return empty (D-04)
          debugLog('error', '[MemoryExtractor] extraction failed after retry', {
            error: err,
          });
          return { facts: [], summary: undefined };
        }
      }
    }

    // Unreachable: loop returns on attempt=2 or successful attempt=1
    return { facts: [], summary: undefined };
  }
}

// ---------------------------------------------------------------------------
// Singleton export with lazy model accessor
// Actual wiring happens in P06 (MemoryEngine integration)
// ---------------------------------------------------------------------------

const modelAccessor = (tier: ModelContextTier): ModelAccessorResult => {
  const costTierMap: Record<ModelContextTier, 'haiku' | 'flash' | 'sonnet' | 'opus'> = {
    tiny: 'haiku',
    small: 'flash',
    medium: 'sonnet',
    large: 'opus',
  };
  const costTier = costTierMap[tier] || 'flash';
  
  const models = providerRegistry.getModelsForTier(costTier);
  if (models.length > 0) {
    const modelEntry = models[0];
    const provider = providerRegistry.getProvider(modelEntry.providerId);
    if (provider) {
      return {
        provider: modelEntry.providerId,
        model: (provider.instance as any)(modelEntry.modelId),
      };
    }
  }

  throw new Error(`No model available in ProviderRegistry for tier ${tier} (${costTier})`);
};

export const memoryExtractor = new MemoryExtractor(modelAccessor);
