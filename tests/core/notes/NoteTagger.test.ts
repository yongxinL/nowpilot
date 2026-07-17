import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerateText, mockDebugLog } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockDebugLog: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

vi.mock('../../../src/core/utils/debugLog', () => ({
  debugLog: mockDebugLog,
}));

let haikuModels: any[] = [{ providerId: 'test', modelId: 'test-model' }];

vi.mock('../../../src/core/ai/providers/ProviderRegistry', () => ({
  providerRegistry: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getModelsForTier: vi.fn((tier: string) => {
      if (haikuModels.length === 0) return [];
      return haikuModels;
    }),
    getProvider: vi.fn(() => ({
      instance: (() => ({})),
    })),
  },
}));

import { NoteTagger, TAGGER_PROMPT } from '../../../src/core/notes/NoteTagger';
import { taggerResultSchema } from '../../../src/core/notes/noteTypes';

const VALID_RESULT = {
  tags: ['python', 'tutorial'],
  categoryPath: 'Tech/Programming',
  summary: 'A Python tutorial covering basics.',
};

const VALID_RESULT_WITH_MEMORY = {
  tags: ['python', 'tutorial'],
  categoryPath: 'Tech/Programming',
  summary: 'A Python tutorial covering basics.',
  memoryFacts: [
    {
      fact: 'User is learning Python',
      category: 'knowledge' as const,
      confidence: 0.9,
      tags: ['python', 'learning'],
    },
  ],
};

describe('NoteTagger', () => {
  let tagger: NoteTagger;

  beforeEach(() => {
    vi.clearAllMocks();
    haikuModels = [{ providerId: 'test', modelId: 'test-model' }];
    tagger = new NoteTagger();
  });

  it('analyze with valid LLM response returns parsed TaggerResult with tags, categoryPath, summary', async () => {
    mockGenerateText.mockResolvedValue({ text: JSON.stringify(VALID_RESULT) });

    const result = await tagger.analyze(
      { title: 'Test', content: 'Python basics' },
      ['Tech'],
    );

    const parsed = taggerResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.tags).toEqual(['python', 'tutorial']);
    expect(result.categoryPath).toBe('Tech/Programming');
    expect(result.summary).toBe('A Python tutorial covering basics.');
  });

  it('analyze with malformed JSON falls back to empty result', async () => {
    mockGenerateText.mockResolvedValue({ text: 'not json' });

    const result = await tagger.analyze(
      { title: 'Test', content: 'Python basics' },
      ['Tech'],
    );

    expect(result.tags).toEqual([]);
    expect(result.categoryPath).toBeNull();
    expect(result.summary).toBe('');
  });

  it('analyze with no Haiku-tier models returns fallback immediately', async () => {
    haikuModels = [];

    const result = await tagger.analyze(
      { title: 'Test', content: 'Python basics' },
      ['Tech'],
    );

    expect(result.tags).toEqual([]);
    expect(result.categoryPath).toBeNull();
  });

  it('analyze respects max 5 tags via schema enforcement', async () => {
    const resultWith6 = {
      ...VALID_RESULT,
      tags: ['a', 'b', 'c', 'd', 'e', 'f'],
    };

    mockGenerateText.mockResolvedValue({ text: JSON.stringify(resultWith6) });

    const result = await tagger.analyze(
      { title: 'Test', content: 'Python basics' },
      ['Tech'],
    );

    expect(result.tags).toEqual([]);
    expect(result.categoryPath).toBeNull();
  });

  it('analyze includes memoryFacts when LLM returns them', async () => {
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify(VALID_RESULT_WITH_MEMORY),
    });

    const result = await tagger.analyze(
      { title: 'Test', content: 'Python basics' },
      ['Tech'],
    );

    expect(result.memoryFacts).toBeDefined();
    expect(result.memoryFacts!.length).toBe(1);
    expect(result.memoryFacts![0].fact).toBe('User is learning Python');
  });

  it('analyze retries once on generateText failure, returns fallback on second failure', async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'));

    const result = await tagger.analyze(
      { title: 'Test', content: 'Python basics' },
      ['Tech'],
    );

    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(result.tags).toEqual([]);
  });

  it('TAGGER_PROMPT contains JSON instructions', () => {
    expect(TAGGER_PROMPT).toContain('JSON');
    expect(TAGGER_PROMPT).toContain('tags');
    expect(TAGGER_PROMPT).toContain('summary');
  });
});
