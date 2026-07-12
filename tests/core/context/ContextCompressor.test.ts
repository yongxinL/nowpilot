import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContextCompressor } from '../../../src/core/context/ContextCompressor';

const mockGenerateText = vi.hoisted(() => vi.fn());

vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

describe('ContextCompressor', () => {
  let compressor: ContextCompressor;

  beforeEach(() => {
    vi.clearAllMocks();
    const mockModelAccessor = vi.fn().mockResolvedValue({ providerId: 'test', modelId: 'test-model' });
    compressor = new ContextCompressor(mockModelAccessor);
  });

  describe('compressHistory — heuristic (tiny/small)', () => {
    it('tiny tier does NOT call generateText', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await compressor.compressHistory(messages, 'tiny', 'test', 'test');
      expect(mockGenerateText).not.toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('small tier does NOT call generateText', async () => {
      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await compressor.compressHistory(messages, 'small', 'test', 'test');
      expect(mockGenerateText).not.toHaveBeenCalled();
      expect(result).toBeTruthy();
    });

    it('long conversation is truncated to ~500 token limit', async () => {
      const messages = Array.from({ length: 50 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'This is a test message with enough content to trigger truncation when we have many messages in the conversation history. '.repeat(10),
      }));
      const result = await compressor.compressHistory(messages, 'tiny', 'test', 'test');
      expect(result).toContain('[truncated]');
    });
  });

  describe('compressHistory — LLM (medium/large)', () => {
    it('medium tier calls generateText with correct params', async () => {
      mockGenerateText.mockResolvedValue({ text: 'Key decision: test. Action item: verify.' });
      const messages = [{ role: 'user', content: 'We decided to use TypeScript' }];
      const result = await compressor.compressHistory(messages, 'medium', 'test', 'test');
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(mockGenerateText).toHaveBeenCalledWith(
        expect.objectContaining({ maxTokens: 200, temperature: 0 }),
      );
      expect(result).toBe('Key decision: test. Action item: verify.');
    });

    it('large tier calls generateText', async () => {
      mockGenerateText.mockResolvedValue({ text: 'Summary of long conversation.' });
      const messages = [{ role: 'user', content: 'Tell me about AI' }];
      const result = await compressor.compressHistory(messages, 'large', 'test', 'test');
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(result).toBe('Summary of long conversation.');
    });

    it('summary prompt contains the conversation text', async () => {
      mockGenerateText.mockResolvedValue({ text: 'summary' });
      const messages = [{ role: 'user', content: 'Hello world' }];
      await compressor.compressHistory(messages, 'medium', 'test', 'test');
      const prompt = mockGenerateText.mock.calls[0][0].prompt;
      expect(prompt).toContain('Hello world');
    });
  });

  describe('compressHistory — LLM failure fallback', () => {
    it('falls back to heuristic when generateText throws', async () => {
      mockGenerateText.mockRejectedValue(new Error('API error'));
      const messages = Array.from({ length: 30 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: 'Repeating message content for testing purposes in this scenario.',
      }));
      const result = await compressor.compressHistory(messages, 'medium', 'test', 'test');
      expect(result).toBeTruthy();
    });
  });

  describe('compressContext — object input', () => {
    it('extracts title and url from object', () => {
      const result = compressor.compressContext({ title: 'Test Page', url: 'https://example.com', summary: 'A test page' });
      expect(result).toContain('Title: Test Page');
      expect(result).toContain('URL: https://example.com');
      expect(result).toContain('Summary: A test page');
    });

    it('handles object without known fields', () => {
      const result = compressor.compressContext({ customField: 'value' });
      expect(result).toBeTruthy();
      expect(result).toContain('customField');
    });
  });

  describe('compressContext — string input', () => {
    it('long string is truncated', () => {
      const longStr = 'a'.repeat(5000);
      const result = compressor.compressContext(longStr);
      expect(result.length).toBeLessThan(5000);
    });

    it('short string is returned mostly intact', () => {
      const result = compressor.compressContext('Hello world');
      expect(result).toContain('Hello world');
    });

    it('empty string returns empty-ish result', () => {
      const result = compressor.compressContext('');
      expect(typeof result).toBe('string');
    });
  });

  describe('singleton', () => {
    it('singleton is exported', async () => {
      const mod = await import('../../../src/core/context/ContextCompressor');
      expect(mod.contextCompressor).toBeInstanceOf(ContextCompressor);
    });
  });
});
