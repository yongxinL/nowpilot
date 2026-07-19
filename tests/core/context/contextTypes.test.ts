import { describe, it, expect } from 'vitest';
import { ContextTooLargeError, contextOptimizerInputSchema } from '../../../src/core/context/contextTypes';

describe('ContextTooLargeError', () => {
  it('extends Error and has correct properties', () => {
    const error = new ContextTooLargeError(5000, 4000);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ContextTooLargeError);
    expect(error.code).toBe('CONTEXT_TOO_LARGE');
    expect(error.estimatedTokens).toBe(5000);
    expect(error.budget).toBe(4000);
    expect(error.name).toBe('ContextTooLargeError');
    expect(error.message).toContain('5000');
    expect(error.message).toContain('4000');
  });
});

describe('contextOptimizerInputSchema', () => {
  const validInput = {
    operationId: 'op-1',
    providerId: 'test-provider',
    modelId: 'test-model',
    modelContextWindow: 16384,
    userInput: 'Hello',
    systemPrompt: 'You are helpful.',
  };

  it('accepts valid input', () => {
    const result = contextOptimizerInputSchema.parse(validInput);
    expect(result.operationId).toBe('op-1');
    expect(result.userInput).toBe('Hello');
  });

  it('rejects missing userInput', () => {
    expect(() =>
      contextOptimizerInputSchema.parse({ ...validInput, userInput: '' }),
    ).toThrow();
  });

  it('rejects negative modelContextWindow', () => {
    expect(() =>
      contextOptimizerInputSchema.parse({ ...validInput, modelContextWindow: -1 }),
    ).toThrow();
  });

  it('rejects missing operationId', () => {
    expect(() =>
      contextOptimizerInputSchema.parse({ ...validInput, operationId: '' }),
    ).toThrow();
  });

  it('accepts valid input with all optional fields', () => {
    const fullInput = {
      ...validInput,
      taskInstructions: 'Do the thing',
      workspaceContext: 'Working on project X',
      pageContext: 'Page about Y',
      toolSchemas: [{ name: 'echo', schema: {} }],
      selectedToolSchemas: [{ name: 'echo', schema: {} }],
      memory: [{ id: 'm1', content: 'User likes dark mode', score: 0.9 }],
      preferences: { theme: 'dark' },
      conversationHistory: [{ role: 'user', content: 'Hi' }],
      notes: [{ id: 'n1', content: 'Reminder' }],
      debugData: { lastAction: 'click' },
    };
    const result = contextOptimizerInputSchema.parse(fullInput);
    expect(result.conversationHistory).toHaveLength(1);
    expect(result.memory).toHaveLength(1);
  });

  it('accepts input with optional referenceTokens', () => {
    const input = {
      ...validInput,
      referenceTokens: [{ type: 'note', id: '123', title: 'My Note', displayLabel: '@note:My Note' }],
    };
    const result = contextOptimizerInputSchema.parse(input);
    expect(result.referenceTokens).toHaveLength(1);
    expect(result.referenceTokens![0].type).toBe('note');
  });

  it('accepts input with optional attachments', () => {
    const input = {
      ...validInput,
      attachments: [
        { kind: 'image', mimeType: 'image/png', dataUrl: 'data:image/png;base64,abc', fileName: 'test.png', sizeBytes: 1000 },
        { kind: 'clipboard_text', text: 'pasted text' },
      ],
    };
    const result = contextOptimizerInputSchema.parse(input);
    expect(result.attachments).toHaveLength(2);
    expect(result.attachments![0].kind).toBe('image');
    expect(result.attachments![1].kind).toBe('clipboard_text');
  });
});
