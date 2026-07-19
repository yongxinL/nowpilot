import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockTemplates = [
  { id: 'summarize', name: 'Summarize', template: 'Summarize the following:', category: 'Writing', variables: ['text'], isBuiltin: true },
  { id: 'rewrite', name: 'Rewrite', template: 'Rewrite this:', category: 'Writing', variables: ['text'], isBuiltin: true },
  { id: 'research', name: 'Research', template: 'Research topic:', category: 'Research', variables: ['topic'], isBuiltin: true },
];

vi.mock('../../../../src/core/prompts/PromptManager', () => ({
  promptManager: {
    getAllTemplates: vi.fn(async () => mockTemplates),
    getTemplate: vi.fn(async (id: string) => {
      if (id === 'deleted-prompt') return undefined;
      return mockTemplates.find((t) => t.id === id);
    }),
  },
}));

import { promptResolver } from '../../../../src/core/references/resolvers/PromptResolver';

describe('PromptResolver', () => {
  it('getType returns "prompt"', () => {
    expect(promptResolver.getType()).toBe('prompt');
  });

  it('search returns matching templates', async () => {
    const results = await promptResolver.search('summarize');
    expect(results).toHaveLength(1);
    expect(results[0].token.type).toBe('prompt');
    expect(results[0].token.title).toBe('Summarize');
    expect(results[0].icon).toBe('MessageOutlined');
  });

  it('search is case-insensitive', async () => {
    const results = await promptResolver.search('SUMMARIZE');
    expect(results).toHaveLength(1);
  });

  it('search returns empty array for no matches', async () => {
    const results = await promptResolver.search('nonexistent');
    expect(results).toHaveLength(0);
  });

  it('validate returns { valid: false } for missing template', async () => {
    const result = await promptResolver.validate({ type: 'prompt', id: 'deleted-prompt', title: 'Gone', displayLabel: '@prompt:Gone' });
    expect(result.valid).toBe(false);
  });

  it('validate returns { valid: true } for existing template', async () => {
    const result = await promptResolver.validate({ type: 'prompt', id: 'summarize', title: 'Summarize', displayLabel: '@prompt:Summarize' });
    expect(result.valid).toBe(true);
  });

  it('resolve returns template name + body text', async () => {
    const result = await promptResolver.resolve({ type: 'prompt', id: 'summarize', title: 'Summarize', displayLabel: '@prompt:Summarize' });
    expect(result).toEqual({ title: 'Summarize', content: 'Summarize the following:' });
  });

  it('resolve returns null for missing template', async () => {
    const result = await promptResolver.resolve({ type: 'prompt', id: 'missing-prompt', title: 'Missing', displayLabel: '@prompt:Missing' });
    expect(result).toBeNull();
  });
});
