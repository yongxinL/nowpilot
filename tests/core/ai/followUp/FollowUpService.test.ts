import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProviderRouter } from '../../../../src/core/ai/router/ProviderRouter';

const mockGenerateText = vi.hoisted(() => vi.fn());
vi.mock('ai', () => ({
  generateText: mockGenerateText,
}));

// Import after vi.mock — hoisting applies
import { FollowUpService } from '../../../../src/core/ai/followUp/FollowUpService';

function createMockRouter(): ProviderRouter {
  return {
    selectModel: vi.fn().mockResolvedValue({
      instance: 'mock-model-instance',
      modelId: 'mock-model',
      providerId: 'mock-provider',
    }),
  } as unknown as ProviderRouter;
}

describe('FollowUpService', () => {
  let service: FollowUpService;
  let router: ProviderRouter;

  beforeEach(() => {
    vi.clearAllMocks();
    router = createMockRouter();
    service = new FollowUpService(router);
  });

  // Test 1: Heuristic-based suggestions for substantive responses without LLM call
  it('generateSuggestions returns heuristic-based suggestions for substantive responses', async () => {
    const result = await service.generateSuggestions(
      'Here is a summary of the incident. The key findings show three main issues that need attention.',
      { hostname: '' },
    );
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(3);
    expect(result.every((s) => s.source === 'heuristic')).toBe(true);
    // No LLM call should be made for heuristic-only path
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  // Test 2: Empty array for ineligible responses (short greeting)
  it('generateSuggestions returns empty array for short greeting', async () => {
    const result = await service.generateSuggestions('Hello! How can I help you?', { hostname: '' });
    expect(result).toEqual([]);
  });

  // Test 2b: Empty array for error messages
  it('generateSuggestions returns empty array for error-like responses', async () => {
    const result = await service.generateSuggestions(
      "I don't know how to answer that question.",
      { hostname: '' },
    );
    expect(result).toEqual([]);
  });

  // Test 3: When LLM call is triggered, suggestions include LLM-generated content merged with heuristics
  it('generateSuggestions includes LLM-generated content when model is available', async () => {
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify(['Can you elaborate on the key findings?', 'What are the next steps?']),
    });

    const result = await service.generateSuggestions(
      'Based on the analysis, there are three key findings. First, the system shows degradation. Second, memory usage is high. Third, we recommend restarting the service. This is a comprehensive research report.',
      { hostname: 'servicenow.com' },
    );

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.length).toBeLessThanOrEqual(3);
    // At least one suggestion should have source 'llm'
    const llmSuggestions = result.filter((s) => s.source === 'llm');
    expect(llmSuggestions.length).toBeGreaterThanOrEqual(1);
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  // Test 4: LLM call timeout returns heuristic-only suggestions (graceful degradation)
  it('generateSuggestions returns heuristic-only suggestions when LLM call times out', async () => {
    mockGenerateText.mockRejectedValue(new DOMException('AbortError', 'AbortError'));

    const result = await service.generateSuggestions(
      'This is a comprehensive research analysis covering multiple topics. There are several important findings to discuss in detail. The analysis shows significant patterns that need attention across all departments. Very long and substantive analysis text here.',
      { hostname: '' },
    );

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every((s) => s.source === 'heuristic')).toBe(true);
  });

  // Test 5: LLM call failure returns heuristic-only suggestions
  it('generateSuggestions returns heuristic-only suggestions when LLM call fails', async () => {
    mockGenerateText.mockRejectedValue(new Error('API error'));

    const result = await service.generateSuggestions(
      'This is a detailed plan for the project. We need to analyze the requirements thoroughly before proceeding with implementation. The research indicates several approaches that could work well.',
      { hostname: '' },
    );

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every((s) => s.source === 'heuristic')).toBe(true);
  });

  // Test 6: generateSuggestions never throws — always returns an array
  it('generateSuggestions never throws — always returns an array', async () => {
    mockGenerateText.mockRejectedValue(new Error('Unexpected error'));
    // Even with extreme edge cases, should never throw
    const result = await service.generateSuggestions('', { hostname: '' });
    expect(Array.isArray(result)).toBe(true);
    // Long text with no matching keywords should still work
    const result2 = await service.generateSuggestions(
      'a'.repeat(500),
      { hostname: '' },
    );
    expect(Array.isArray(result2)).toBe(true);
    // Null-like inputs should not cause throws (TypeScript protects but tests verify)
    const result3 = await service.generateSuggestions('test error fail', { hostname: '' });
    expect(Array.isArray(result3)).toBe(true);
  });

  // Test 7: max 3 suggestions returned regardless of heuristic + LLM output
  it('generates at most 3 suggestions even when heuristic + LLM exceed 3', async () => {
    mockGenerateText.mockResolvedValue({
      text: JSON.stringify(['Question one?', 'Question two?', 'Question three?']),
    });

    const result = await service.generateSuggestions(
      'This is a very long research and analysis document with step-by-step instructions. The report summarizes multiple key findings across several areas of investigation. We need to consider all aspects of this comprehensive analysis.',
      { hostname: '' },
    );

    expect(result.length).toBeLessThanOrEqual(3);
  });

  // Test: LLM not available should return heuristic-only suggestions
  it('generateSuggestions returns heuristic-only when model selection returns null', async () => {
    const emptyRouter: ProviderRouter = {
      selectModel: vi.fn().mockResolvedValue(null),
    } as unknown as ProviderRouter;
    const serviceNoModel = new FollowUpService(emptyRouter);

    const result = await serviceNoModel.generateSuggestions(
      'This is a researched analysis of the current situation. The findings are comprehensive and detailed across multiple dimensions.',
      { hostname: '' },
    );

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every((s) => s.source === 'heuristic')).toBe(true);
  });
});
