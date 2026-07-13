import type { ModelContextTier } from '../context/contextTypes';

// Stub — will cause assertion failures in RED phase

type ModelAccessorResult = { provider: string; model: unknown };

const modelAccessor = (_tier: ModelContextTier): ModelAccessorResult => {
  throw new Error('MemoryExtractor singleton not wired — inject via constructor');
};

export const EXTRACTION_PROMPT = `You are a memory extraction system.`;

export class MemoryExtractor {
  constructor(private _modelAccessor: (tier: ModelContextTier) => ModelAccessorResult) {}

  async extract(
    _messages: Array<{ role: string; content: string }>,
    _tier: ModelContextTier = 'small',
  ) {
    // Stub: returns empty results — tests expecting facts will fail
    return { facts: [], summary: undefined };
  }
}

export const memoryExtractor = new MemoryExtractor(modelAccessor);
