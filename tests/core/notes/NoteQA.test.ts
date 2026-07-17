import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockGenerateText, mockDebugLog, mockAssemble } = vi.hoisted(() => ({
  mockGenerateText: vi.fn(),
  mockDebugLog: vi.fn(),
  mockAssemble: vi.fn().mockResolvedValue({
    memory: [],
    conversationContext: { recentTurns: [] },
    preferences: {
      responseStyle: 'concise',
      preferredLanguage: 'auto',
      preferStructuredOutput: false,
      allowCloudFallbackFromLocal: false,
      defaultProviderId: '',
      toolAutonomy: 'manual',
    },
  }),
}));

vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

vi.mock('../../../src/core/utils/debugLog', () => ({
  debugLog: mockDebugLog,
}));

vi.mock('../../../src/core/ai/providers/ProviderRegistry', () => ({
  providerRegistry: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getModelsForTier: vi.fn(() => [
      { providerId: 'test', modelId: 'test-model' },
    ]),
    getProvider: vi.fn(() => ({
      instance: () => ({}),
    })),
  },
}));

vi.mock('../../../src/core/memory/MemoryEngine', () => ({
  memoryEngine: {
    assemble: mockAssemble,
  },
}));

import { NoteQA, QA_PROMPT } from '../../../src/core/notes/NoteQA';
import { LinkParser } from '../../../src/core/notes/LinkParser';

const MOCK_NOTE = {
  id: '1',
  title: 'Python',
  content: 'Python is a programming language.',
  created: 100,
  updated: 100,
  tags: ['python'],
};

const MOCK_NOTES = [MOCK_NOTE];

describe('NoteQA', () => {
  let qa: NoteQA;
  let linkParser: LinkParser;

  beforeEach(() => {
    vi.clearAllMocks();
    qa = new NoteQA();
    linkParser = new LinkParser();
  });

  it('ask returns QAResult with answer string and citations array', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Python is great. [Source: Python]',
    });

    linkParser.addToIndex(MOCK_NOTE);
    const result = await qa.ask('What is Python?', MOCK_NOTES, linkParser);

    expect(result.answer).toBeTruthy();
    expect(Array.isArray(result.citations)).toBe(true);
  });

  it('ask calls LinkParser.search() for retrieval', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Python is great. [Source: Python]',
    });

    const searchSpy = vi.spyOn(linkParser, 'search');
    linkParser.addToIndex(MOCK_NOTE);

    await qa.ask('What is Python?', MOCK_NOTES, linkParser);

    expect(searchSpy).toHaveBeenCalledWith('What is Python?');
  });

  it('ask calls MemoryEngine.assemble() for MEM-01', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Python is great. [Source: Python]',
    });

    linkParser.addToIndex(MOCK_NOTE);
    await qa.ask('What is Python?', MOCK_NOTES, linkParser);

    expect(mockAssemble).toHaveBeenCalled();
  });

  it('ask uses Flash-tier LLM (getModelsForTier("flash"))', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Python is great. [Source: Python]',
    });

    linkParser.addToIndex(MOCK_NOTE);
    await qa.ask('What is Python?', MOCK_NOTES, linkParser);

    const { providerRegistry } = await import(
      '../../../src/core/ai/providers/ProviderRegistry'
    );
    expect(providerRegistry.getModelsForTier).toHaveBeenCalledWith('flash');
  });

  it('ask returns citations parsed from LLM output', async () => {
    mockGenerateText.mockResolvedValue({
      text: 'Python is a language. [Source: Python] It is used widely.',
    });

    linkParser.addToIndex(MOCK_NOTE);
    const result = await qa.ask('What is Python?', MOCK_NOTES, linkParser);

    expect(result.citations.length).toBeGreaterThanOrEqual(1);
    expect(result.citations[0].title).toBe('Python');
    expect(result.citations[0].noteId).toBe('1');
  });

  it('ask gracefully degrades when MemoryEngine unavailable — continues with notes only', async () => {
    mockAssemble.mockRejectedValue(new Error('MemoryEngine down'));

    mockGenerateText.mockResolvedValue({
      text: 'Python is great. [Source: Python]',
    });

    linkParser.addToIndex(MOCK_NOTE);
    const result = await qa.ask('What is Python?', MOCK_NOTES, linkParser);

    expect(result.answer).toBeTruthy();
  });

  it('ask never throws — returns fallback on LLM failure', async () => {
    mockGenerateText.mockRejectedValue(new Error('API error'));

    linkParser.addToIndex(MOCK_NOTE);
    const result = await qa.ask('What is Python?', MOCK_NOTES, linkParser);

    expect(result.answer).toBe('Unable to answer.');
    expect(result.citations).toEqual([]);
  });

  it('QA_PROMPT contains source citation instructions', () => {
    expect(QA_PROMPT).toContain('Source');
    expect(QA_PROMPT).toContain('notes');
  });
});
