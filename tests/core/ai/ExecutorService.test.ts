import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { ExecutorService } from '../../../src/core/ai/ExecutorService';
import { PipelineError } from '../../../src/core/ai/PipelineError';
import type { CompletionEvidence } from '../../../src/core/ai/types';

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

function createRequiredIdempotentTool(execute: ReturnType<typeof vi.fn>) {
  return {
    name: 'writeNote',
    description: 'Write a note (idempotent)',
    inputSchema: { type: 'object', properties: { title: { type: 'string' } } },
    execute,
    sideEffect: 'write',
    idempotency: 'required',
  };
}

function makeEvidence(operationId: string, toolName: string, toolCallId: string): CompletionEvidence {
  return {
    id: `ev-${toolCallId}`,
    operationId,
    toolCallId,
    toolName,
    verified: true,
    verifierType: 'read-after-write',
    checks: [{ checkId: 'c1', name: 'exists', passed: true }],
    verifiedAt: Date.now(),
    durationMs: 5,
  };
}

describe('ExecutorService tool-call identity', () => {
  let executor: ExecutorService;
  let tools: TestTool[];

  beforeEach(() => {
    executor = new ExecutorService();
    tools = createMockTools();
  });

  it('issues a distinct toolCallId for each logical call', async () => {
    const r1 = await executor.execute('getWeather', { city: 'Tokyo' }, tools as any);
    const r2 = await executor.execute('getWeather', { city: 'Paris' }, tools as any);
    expect(r1.toolCallId).toBeDefined();
    expect(r1.toolCallId).not.toBe(r2.toolCallId);
  });
});

describe('ExecutorService idempotency ledger (D-17)', () => {
  let executor: ExecutorService;

  beforeEach(() => {
    executor = new ExecutorService();
  });

  it('requires a non-empty operationId for required-idempotency tools', async () => {
    const execute = vi.fn(async () => ({ saved: true }));
    const tool = createRequiredIdempotentTool(execute);
    await expect(executor.execute('writeNote', { title: 'a' }, [tool] as any)).rejects.toMatchObject({
      code: 'INVALID_TOOL_INPUT',
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it('serves a completed duplicate from the ledger without re-executing, with a new toolCallId', async () => {
    const execute = vi.fn(async () => ({ saved: true }));
    const tool = createRequiredIdempotentTool(execute);
    const first = await executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1');
    const second = await executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(second.output).toEqual(first.output);
    expect(second.toolCallId).not.toBe(first.toolCallId);
    expect(second.durationMs).toBe(0);
  });

  it('uses canonical key ordering — key-shuffled inputs are the same logical call', async () => {
    const execute = vi.fn(async () => ({ saved: true }));
    const tool = createRequiredIdempotentTool(execute);
    await executor.execute('writeNote', { title: 'a', meta: { x: 1, y: 2 } }, [tool] as any, undefined, 30_000, 'op-2');
    await executor.execute('writeNote', { meta: { y: 2, x: 1 }, title: 'a' }, [tool] as any, undefined, 30_000, 'op-2');
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('does not deduplicate across different operationIds', async () => {
    const execute = vi.fn(async () => ({ saved: true }));
    const tool = createRequiredIdempotentTool(execute);
    await executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-a');
    await executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-b');
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('a fresh ExecutorService has no prior ledger state', async () => {
    const execute = vi.fn(async () => ({ saved: true }));
    const tool = createRequiredIdempotentTool(execute);
    await executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1');
    const fresh = new ExecutorService();
    await fresh.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1');
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('permits exactly one failed-before-effect recovery then serves completed', async () => {
    const execute = vi
      .fn()
      .mockRejectedValueOnce(new PipelineError('UNKNOWN', 'effect did not start', { effectStarted: false }))
      .mockResolvedValueOnce({ saved: true });
    const tool = createRequiredIdempotentTool(execute);
    await expect(
      executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1'),
    ).rejects.toThrow();
    const recovered = await executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1');
    expect(execute).toHaveBeenCalledTimes(2);
    expect(recovered.output).toEqual({ saved: true });
    const third = await executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1');
    expect(execute).toHaveBeenCalledTimes(2);
    expect(third.output).toEqual({ saved: true });
  });

  it('treats repeated failure of a failed-before-effect recovery as unresolved', async () => {
    const execute = vi.fn().mockRejectedValue(new PipelineError('UNKNOWN', 'still failing', { effectStarted: false }));
    const tool = createRequiredIdempotentTool(execute);
    await expect(
      executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1'),
    ).rejects.toThrow();
    await expect(
      executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1'),
    ).rejects.toThrow();
    await expect(
      executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1'),
    ).rejects.toMatchObject({ code: 'TOOL_IDEMPOTENCY_CONFLICT' });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('never re-executes an unknown-state duplicate', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('boom after effect'));
    const tool = createRequiredIdempotentTool(execute);
    await expect(
      executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1'),
    ).rejects.toThrow();
    await expect(
      executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1'),
    ).rejects.toMatchObject({ code: 'TOOL_IDEMPOTENCY_CONFLICT' });
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('never re-executes an in-flight (started) duplicate', async () => {
    let release!: (v: unknown) => void;
    const gate = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    const execute = vi.fn(() => gate);
    const tool = createRequiredIdempotentTool(execute);
    const first = executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1');
    await new Promise((r) => setTimeout(r, 10));
    await expect(
      executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1'),
    ).rejects.toMatchObject({ code: 'TOOL_IDEMPOTENCY_CONFLICT' });
    release({ saved: true });
    await first;
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it('attachEvidence accepts matching evidence and completed duplicates reuse it', async () => {
    const execute = vi.fn(async () => ({ saved: true }));
    const tool = createRequiredIdempotentTool(execute);
    const first = await executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1');
    const evidence = makeEvidence('op-1', 'writeNote', first.toolCallId);
    executor.attachEvidence(first.toolCallId, evidence);
    const second = await executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1');
    expect(execute).toHaveBeenCalledTimes(1);
    expect(second.evidence).toBeDefined();
    expect(second.evidence?.id).toBe(evidence.id);
    expect(() => executor.attachEvidence(second.toolCallId, { ...evidence, toolCallId: second.toolCallId })).not.toThrow();
  });

  it('rejects attachEvidence for an unknown toolCallId', () => {
    expect(() => executor.attachEvidence('no-such-call', makeEvidence('op-1', 'writeNote', 'no-such-call'))).toThrowError(
      /TOOL_POSTCONDITION_FAILED|no executed tool call/i,
    );
  });

  it('rejects spoofed evidence and cannot overwrite the cached ledger evidence', async () => {
    const execute = vi.fn(async () => ({ saved: true }));
    const tool = createRequiredIdempotentTool(execute);
    const first = await executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1');
    const evidence = makeEvidence('op-1', 'writeNote', first.toolCallId);
    executor.attachEvidence(first.toolCallId, evidence);

    const spoofedOp = makeEvidence('op-evil', 'writeNote', first.toolCallId);
    expect(() => executor.attachEvidence(first.toolCallId, spoofedOp)).toThrow(PipelineError);
    const spoofedName = makeEvidence('op-1', 'evilTool', first.toolCallId);
    expect(() => executor.attachEvidence(first.toolCallId, spoofedName)).toThrow(PipelineError);

    const second = await executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1');
    expect(second.evidence?.id).toBe(evidence.id);
  });

  it('never exposes the logical key in results or conflict diagnostics', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('boom'));
    const tool = createRequiredIdempotentTool(execute);
    await expect(executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1')).rejects.toThrow();
    try {
      await executor.execute('writeNote', { title: 'a' }, [tool] as any, undefined, 30_000, 'op-1');
      expect.unreachable('duplicate of an unknown state must throw');
    } catch (err) {
      const serialized = JSON.stringify(err);
      expect(serialized).not.toContain(';tool:');
      expect(serialized).not.toContain(';input:');
    }
  });

  it('propagates operationId through executeBatch with ledger enforcement', async () => {
    const execute = vi.fn(async () => ({ saved: true }));
    const tool = createRequiredIdempotentTool(execute);
    const results = await executor.executeBatch(
      [
        { toolName: 'writeNote', input: { title: 'a' } },
        { toolName: 'writeNote', input: { title: 'a' } },
      ],
      [tool] as any,
      undefined,
      'op-batch',
    );
    expect(execute).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(2);
    expect(results[1].output).toEqual({ saved: true });
  });

  it('executeBatch does not execute a required-idempotency tool without operationId', async () => {
    const execute = vi.fn(async () => ({ saved: true }));
    const tool = createRequiredIdempotentTool(execute);
    const results = await executor.executeBatch([{ toolName: 'writeNote', input: { title: 'a' } }], [tool] as any);
    expect(execute).not.toHaveBeenCalled();
    expect(results).toHaveLength(0);
  });
});
