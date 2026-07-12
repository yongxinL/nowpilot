import { describe, it, expect } from 'vitest';
import { echoTool } from '../../../../src/core/ai/tools/fixtures/echoTool';
import { counterTool } from '../../../../src/core/ai/tools/fixtures/counterTool';
import { getTimeTool } from '../../../../src/core/ai/tools/fixtures/getTimeTool';

describe('echoTool', () => {
  it('executes and echoes input text unchanged', async () => {
    const result = await echoTool.execute({ text: 'hello' }, { abortSignal: new AbortController().signal });
    expect(result).toEqual({ echoed: 'hello' });
  });

  it('inputSchema validates correct input', () => {
    const result = echoTool.inputSchema.safeParse({ text: 'hi' });
    expect(result.success).toBe(true);
  });

  it('inputSchema rejects invalid input', () => {
    const result = echoTool.inputSchema.safeParse({ wrong: 'key' });
    expect(result.success).toBe(false);
  });

  it('requiresPermission is false', () => {
    expect(echoTool.requiresPermission).toBe(false);
  });

  it('category is safe', () => {
    expect(echoTool.category).toBe('safe');
  });

  it('respects abortSignal — rejects with AbortError when already aborted', async () => {
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      echoTool.execute({ text: 'hello' }, { abortSignal: aborted.signal })
    ).rejects.toThrow('Aborted');
  });
});

describe('counterTool', () => {
  it('increments count on each call', async () => {
    const signal = new AbortController().signal;
    // Reset first
    await counterTool.execute({ action: 'reset' }, { abortSignal: signal });
    const r1 = await counterTool.execute({ action: 'increment' }, { abortSignal: signal });
    expect(r1).toEqual({ count: 1 });
    const r2 = await counterTool.execute({ action: 'increment' }, { abortSignal: signal });
    expect(r2).toEqual({ count: 2 });
  });

  it('decrements count', async () => {
    const signal = new AbortController().signal;
    await counterTool.execute({ action: 'reset' }, { abortSignal: signal });
    await counterTool.execute({ action: 'increment' }, { abortSignal: signal });
    await counterTool.execute({ action: 'increment' }, { abortSignal: signal });
    const r1 = await counterTool.execute({ action: 'decrement' }, { abortSignal: signal });
    expect(r1).toEqual({ count: 1 });
  });

  it('resets count to zero', async () => {
    const signal = new AbortController().signal;
    await counterTool.execute({ action: 'increment' }, { abortSignal: signal });
    await counterTool.execute({ action: 'increment' }, { abortSignal: signal });
    const r = await counterTool.execute({ action: 'reset' }, { abortSignal: signal });
    expect(r).toEqual({ count: 0 });
  });

  it('requiresPermission is false', () => {
    expect(counterTool.requiresPermission).toBe(false);
  });

  it('category is safe', () => {
    expect(counterTool.category).toBe('safe');
  });
});

describe('getTimeTool', () => {
  it('returns current time in ISO 8601 format', async () => {
    const result = await getTimeTool.execute({}, { abortSignal: new AbortController().signal });
    expect(result).toHaveProperty('time');
    expect(typeof (result as { time: string }).time).toBe('string');
    // ISO 8601 format check
    const isoRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    expect(isoRegex.test((result as { time: string }).time)).toBe(true);
  });

  it('requiresPermission is false', () => {
    expect(getTimeTool.requiresPermission).toBe(false);
  });

  it('category is safe', () => {
    expect(getTimeTool.category).toBe('safe');
  });
});
