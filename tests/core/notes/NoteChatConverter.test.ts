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
      instance: () => ({}),
    })),
  },
}));

import {
  NoteChatConverter,
  CONVERTER_PROMPT,
} from '../../../src/core/notes/NoteChatConverter';
import { converterResultSchema } from '../../../src/core/notes/noteTypes';
import type { MemoryAssembleResult } from '../../../src/core/memory/memoryTypes';

const VALID_RESULT = {
  title: 'Python Summary',
  content: 'Python is a versatile language.',
  tags: ['python', 'programming'],
  suggestedWikilinks: ['Python Basics'],
  categoryPath: 'Tech/Programming',
};

const MOCK_MESSAGES = [
  { role: 'user', content: 'Tell me about Python' },
  { role: 'assistant', content: 'Python is great for beginners.' },
];

const MOCK_MEMORY_CONTEXT: MemoryAssembleResult = {
  memory: [{ id: '1', content: 'User prefers Python', score: 0.9 }],
  conversationContext: { recentTurns: [] },
  preferences: {
    responseStyle: 'concise',
    preferredLanguage: 'auto',
    preferStructuredOutput: false,
    allowCloudFallbackFromLocal: false,
    defaultProviderId: '',
    toolAutonomy: 'manual',
  },
};

describe('NoteChatConverter', () => {
  let converter: NoteChatConverter;

  beforeEach(() => {
    vi.clearAllMocks();
    haikuModels = [{ providerId: 'test', modelId: 'test-model' }];
    converter = new NoteChatConverter();
  });

  it('convert with conversation messages returns ConverterResult', async () => {
    mockGenerateText.mockResolvedValue({ text: JSON.stringify(VALID_RESULT) });

    const result = await converter.convert(MOCK_MESSAGES);

    const parsed = converterResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.title).toBe('Python Summary');
    expect(result.content).toBe('Python is a versatile language.');
    expect(result.tags).toEqual(['python', 'programming']);
  });

  it('convert includes memory context in LLM prompt when provided (MEM-03)', async () => {
    mockGenerateText.mockResolvedValue({ text: JSON.stringify(VALID_RESULT) });

    await converter.convert(MOCK_MESSAGES, MOCK_MEMORY_CONTEXT);

    expect(mockGenerateText).toHaveBeenCalled();
    const promptArg = mockGenerateText.mock.calls[0][0].prompt;
    expect(promptArg).toContain('User prefers Python');
  });

  it('convert suggests wikilinks to existing notes', async () => {
    mockGenerateText.mockResolvedValue({ text: JSON.stringify(VALID_RESULT) });

    const result = await converter.convert(MOCK_MESSAGES, undefined, [
      'Python Basics',
      'JavaScript Guide',
    ]);

    expect(result.suggestedWikilinks).toContain('Python Basics');
  });

  it('convert returns empty fallback when no Haiku models available', async () => {
    haikuModels = [];

    const result = await converter.convert(MOCK_MESSAGES);

    expect(result.title).toBe('New Note');
    expect(result.content).toBe('');
    expect(result.tags).toEqual([]);
  });

  it('convert never throws — returns fallback on failure', async () => {
    mockGenerateText.mockRejectedValue(new Error('API error'));

    const result = await converter.convert(MOCK_MESSAGES);

    expect(result.title).toBe('New Note');
    expect(result.content).toBe('');
  });

  it('CONVERTER_PROMPT contains JSON and note draft instructions', () => {
    expect(CONVERTER_PROMPT).toContain('JSON');
    expect(CONVERTER_PROMPT).toContain('title');
    expect(CONVERTER_PROMPT).toContain('content');
  });
});
