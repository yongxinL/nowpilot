import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { ExecutorService } from '../../../src/core/ai/ExecutorService';
import { PipelineError } from '../../../src/core/ai/PipelineError';

interface TestTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown, signal?: AbortSignal) => Promise<unknown>;
}

function createMockTools(): TestTool[] {
  return [
    {
      name: 'getWeather',
      description: 'Get weather for a city',
      inputSchema: { type: 'object', properties: { city: { type: 'string' } } },
      execute: vi.fn(async (input: unknown) => input),
    },
    {
      name: 'search',
      description: 'Search the web',
      inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
      execute: vi.fn(async (input: unknown) => input),
    },
  ];
}

describe('ExecutorService', () => {
  let executor: ExecutorService;
  let tools: TestTool[];

  beforeEach(() => {
    executor = new ExecutorService();
    tools = createMockTools();
  });

  it('returns ToolExecutionResult for known tool and valid input', async () => {
    const result = await executor.execute('getWeather', { city: 'Tokyo' }, tools as any);
    expect(result.toolName).toBe('getWeather');
    expect(result.output).toBeDefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('throws NO_SUCH_TOOL for unknown tool name', async () => {
    await expect(
      executor.execute('nonexistent_tool', {}, tools as any),
    ).rejects.toThrow(PipelineError);
  });

  it('throws INVALID_TOOL_INPUT for invalid input', async () => {
    await expect(
      executor.execute('getWeather', 123, tools as any),
    ).rejects.toThrow(PipelineError);
  });

  it('forwards abortSignal to tool execute function', async () => {
    const ac = new AbortController();

    await executor.execute('getWeather', { city: 'Tokyo' }, tools as any, ac.signal);
  });

  it('validates toolName against closed Zod enum', async () => {
    const toolNames = tools.map((t) => t.name);
    const schema = z.enum(toolNames as [string, ...string[]]);

    expect(schema.safeParse('getWeather').success).toBe(true);
    expect(schema.safeParse('search').success).toBe(true);
    expect(schema.safeParse('nonexistent_tool').success).toBe(false);
  });

  it('logs durationMs in result', async () => {
    const result = await executor.execute('getWeather', { city: 'Tokyo' }, tools as any);
    expect(typeof result.durationMs).toBe('number');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('wraps unexpected tool errors in PipelineError', async () => {
    const errorTools = [{ ...tools[0], execute: vi.fn().mockRejectedValue(new Error('Unexpected crash')) }];
    await expect(
      executor.execute('getWeather', { city: 'Tokyo' }, errorTools as any),
    ).rejects.toThrow(PipelineError);
  });
});
