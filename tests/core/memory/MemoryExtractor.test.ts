import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock generateText from the 'ai' SDK
const mockGenerateText = vi.fn();

vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

vi.mock('../../../src/core/utils/debugLog', () => ({
  debugLog: vi.fn(),
}));

import { MemoryExtractor, EXTRACTION_PROMPT } from '../../../src/core/memory/MemoryExtractor';
import { extractionResultSchema } from '../../../src/core/memory/memoryTypes';
import { generateText } from 'ai';
import { debugLog } from '../../../src/core/utils/debugLog';

// ---------------------------------------------------------------------------
// Test messages fixture
// ---------------------------------------------------------------------------

const TEST_MESSAGES = [
  { role: 'user', content: 'Hi, my name is Alice and I prefer Python' },
  { role: 'assistant', content: 'Nice to meet you Alice! Python is a great language.' },
];

const VALID_EXTRACTION_JSON = {
  facts: [
    { fact: 'User prefers Python', category: 'preference', confidence: 0.9, tags: ['python', 'language'] },
    { fact: 'User name is Alice', category: 'identity', confidence: 0.95, tags: ['name', 'alice'] },
  ],
  summary: 'Alice introduced herself and mentioned preferring Python.',
};

// ---------------------------------------------------------------------------
// Model accessor mock
// ---------------------------------------------------------------------------

function createModelAccessor() {
  return vi.fn().mockReturnValue({ provider: 'test', model: {} });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MemoryExtractor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extract with valid messages returns MemoryExtractionResult with facts array validated by extractionResultSchema', async () => {
    mockGenerateText.mockResolvedValue({ text: JSON.stringify(VALID_EXTRACTION_JSON) });
    const accessor = createModelAccessor();
    const extractor = new MemoryExtractor(accessor);

    const result = await extractor.extract(TEST_MESSAGES, 'small');

    const parsed = extractionResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.facts.length).toBeGreaterThan(0);
    expect(result.facts[0].fact).toBe('User prefers Python');
  });

  it('returns empty facts array when generateText throws an error (no facts, no throw per D-04)', async () => {
    mockGenerateText.mockRejectedValue(new Error('API error'));
    const accessor = createModelAccessor();
    const extractor = new MemoryExtractor(accessor);

    let result;
    let threw = false;
    try {
      result = await extractor.extract(TEST_MESSAGES, 'small');
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(result!).toBeDefined();
    expect(result!.facts).toEqual([]);
  });

  it('retries once on first failure — if retry succeeds, returns facts from retry', async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValueOnce({ text: JSON.stringify(VALID_EXTRACTION_JSON) });

    const accessor = createModelAccessor();
    const extractor = new MemoryExtractor(accessor);

    const result = await extractor.extract(TEST_MESSAGES, 'small');

    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(result.facts).toHaveLength(2);
    expect(result.facts[0].fact).toBe('User prefers Python');
  });

  it('validates AI output against extractionResultSchema and discards invalid results silently', async () => {
    // Invalid — missing required fields (no category field)
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify({ facts: [{ fact: 'test', confidence: 0.5 }] }),
    });
    const accessor = createModelAccessor();
    const extractor = new MemoryExtractor(accessor);

    const result = await extractor.extract(TEST_MESSAGES, 'small');

    expect(result.facts).toEqual([]);
    expect(result.summary).toBeUndefined();
  });

  it('logs success with debugLog("info", ...)', async () => {
    mockGenerateText.mockResolvedValue({ text: JSON.stringify(VALID_EXTRACTION_JSON) });
    const accessor = createModelAccessor();
    const extractor = new MemoryExtractor(accessor);

    await extractor.extract(TEST_MESSAGES, 'small');

    expect(debugLog).toHaveBeenCalledWith('info', expect.stringContaining('[MemoryExtractor]'), expect.anything());
  });

  it('logs failure with debugLog("error", ...)', async () => {
    mockGenerateText.mockRejectedValue(new Error('API error'));
    const accessor = createModelAccessor();
    const extractor = new MemoryExtractor(accessor);

    await extractor.extract(TEST_MESSAGES, 'small');

    expect(debugLog).toHaveBeenCalledWith('error', expect.stringContaining('[MemoryExtractor]'), expect.anything());
  });

  it('EXTRACTION_PROMPT instructs the LLM to output JSON matching the extraction schema', () => {
    // Check that the prompt template contains JSON-related instructions
    expect(EXTRACTION_PROMPT).toContain('JSON');
    expect(EXTRACTION_PROMPT).toContain('fact');
    expect(EXTRACTION_PROMPT).toContain('category');
  });
});
