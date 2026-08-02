import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resetNotesDb } from '../../../src/core/notes/NotesDB';
import { resetJournalDb } from '../../../src/core/storage/WriteJournal';
import { resetLlmService, getLlmService } from '../../../src/core/ai/LlmService';
import { getMemoryEngine, resetMemoryEngine } from '../../../src/core/memory/MemoryEngine';
import {
  getNoteChatConverter,
  resetNoteChatConverter,
} from '../../../src/core/notes/NoteChatConverter';
import { NoteDraftSchema } from '../../../src/core/notes/NoteSchema';
import type { ContextItem } from '../../../src/core/context/ContextItem';
import type { ProviderAdapter } from '../../../src/core/ai/providers/ProviderAdapter';
import { PipelineError } from '../../../src/core/ai/PipelineError';

function createMockAdapter(): ProviderAdapter {
  return {
    providerId: 'openai',
    createLanguageModel: vi.fn(() => ({}) as any),
    validateConnection: vi.fn(),
    supportsStructuredOutput: true,
    getDefaultModelForTier: vi.fn(() => 'gpt-4o-mini'),
    getCacheStrategy: vi.fn((): 'prefix-only' => 'prefix-only'),
    getTelemetryMetadata: vi.fn(() => ({ provider: 'openai' })),
  };
}

function makeMemoryItem(text: string): ContextItem {
  return {
    kind: 'memory',
    text,
    tokens: text.length,
    stable: false,
    sourceId: 'memory.user.fact.test',
    relevance: 0.9,
    freshness: 0.9,
    trust: 0.8,
    sensitivity: 'private',
    instructionAuthority: 'data',
  };
}

describe('NoteChatConverter', () => {
  beforeEach(async () => {
    await resetNotesDb();
    await resetJournalDb();
    resetLlmService();
    resetMemoryEngine();
    resetNoteChatConverter();
    (globalThis as unknown as { __NOWPILOT_SURFACE_ID__?: string }).__NOWPILOT_SURFACE_ID__ =
      'test-surface';
  });

  afterEach(() => {
    delete (globalThis as unknown as { __NOWPILOT_SURFACE_ID__?: string })
      .__NOWPILOT_SURFACE_ID__;
    vi.restoreAllMocks();
  });

  it('returns NoteDraft with title, content, tags, categoryPath, wikilinks', async () => {
    vi.spyOn(getMemoryEngine(), 'retrieve').mockResolvedValue({
      success: true,
      items: [],
    });
    const draft = {
      title: 'Camping tips',
      content: 'Pack a tent and warm layers.',
      tags: ['camping', 'outdoors'],
      categoryPath: 'Hobbies',
      wikilinks: ['Outdoor Gear'],
    };
    const generateSpy = vi
      .spyOn(getLlmService(), 'generate')
      .mockResolvedValue(draft);

    const result = await getNoteChatConverter().convert(createMockAdapter(), {
      chatMessages: ['Tell me about camping'],
    });
    expect(result).toEqual(draft);
    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tier: 'FAST',
        schema: NoteDraftSchema,
      }),
    );
  });

  it('includes MemoryEngine retrieve() context (MEM-03)', async () => {
    const retrieveSpy = vi
      .spyOn(getMemoryEngine(), 'retrieve')
      .mockResolvedValue({
        success: true,
        items: [makeMemoryItem('User prefers concise answers.')],
      });
    vi.spyOn(getLlmService(), 'generate').mockResolvedValue({
      title: 'T',
      content: 'C',
      tags: [],
      categoryPath: '',
      wikilinks: [],
    });

    await getNoteChatConverter().convert(createMockAdapter(), {
      chatMessages: ['hello'],
    });
    expect(retrieveSpy).toHaveBeenCalled();
  });

  it('formats chat messages with [N] prefixes', async () => {
    vi.spyOn(getMemoryEngine(), 'retrieve').mockResolvedValue({
      success: true,
      items: [],
    });
    const generateSpy = vi
      .spyOn(getLlmService(), 'generate')
      .mockResolvedValue({ title: 'T', content: 'C', tags: [], categoryPath: '', wikilinks: [] });

    await getNoteChatConverter().convert(createMockAdapter(), {
      chatMessages: ['first', 'second'],
      sourceUrl: 'https://example.com/page',
    });
    const userPrompt = generateSpy.mock.calls[0][0].userPrompt;
    expect(userPrompt).toContain('[1] first');
    expect(userPrompt).toContain('[2] second');
    expect(userPrompt).toContain('Source URL: https://example.com/page');
  });

  it('handles LLM failure by throwing PipelineError through convert()', async () => {
    vi.spyOn(getMemoryEngine(), 'retrieve').mockResolvedValue({
      success: true,
      items: [],
    });
    vi.spyOn(getLlmService(), 'generate').mockRejectedValue(
      new PipelineError('PROVIDER_5XX', 'upstream down'),
    );

    await expect(
      getNoteChatConverter().convert(createMockAdapter(), {
        chatMessages: ['hello'],
      }),
    ).rejects.toBeInstanceOf(PipelineError);
  });

  it('handles empty chat messages without erroring', async () => {
    vi.spyOn(getMemoryEngine(), 'retrieve').mockResolvedValue({
      success: true,
      items: [],
    });
    vi.spyOn(getLlmService(), 'generate').mockResolvedValue({
      title: 'Empty draft',
      content: '',
      tags: [],
      categoryPath: '',
      wikilinks: [],
    });

    const result = await getNoteChatConverter().convert(createMockAdapter(), {
      chatMessages: [],
    });
    expect(result.title).toBe('Empty draft');
  });
});
