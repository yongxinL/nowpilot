import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  execute,
  TOOL_REJECTED,
  type ExecuteInput,
} from '../../../src/core/ai/ExecutorService';
import { RegisteredToolNameSchema, ToolRegistry, type ToolDefinition } from '../../../src/core/ai/toolSchemas';

/**
 * ExecutorService contract tests (plan 03-04, Task 2):
 *  (a) any run_tool → TOOL_REJECTED while zero tools are registered (D-46);
 *  (b) the rejection is TYPED — a `code` field is present, not a generic Error;
 *  (c) the closed-enum generation contract: empty registry never constructs
 *      z.enum([]) and rejects every name; a non-empty list closes the enum.
 */

function executeInput(overrides: Partial<ExecuteInput> = {}): ExecuteInput {
  return {
    operationId: 'op-executor-test',
    toolName: 'run_tool',
    inputData: { query: 'anything' },
    provider: 'openai',
    ...overrides,
  };
}

function fakeTool(name: string): ToolDefinition {
  return {
    id: `fake-${name}`,
    name,
    description: 'test-only tool (never registered)',
    inputSchema: z.object({ query: z.string() }),
    risk: 'read',
    sideEffects: [],
    requiresPermission: false,
  };
}

describe('ExecutorService — zero-tool TOOL_REJECTED (D-46)', () => {
  it('(a) every run_tool is rejected while zero tools are registered', async () => {
    for (const toolName of ['run_tool', 'search_kb', 'write_note', ''] as const) {
      const result = await execute(executeInput({ toolName }));
      expect(result.ok).toBe(false);
      expect(result.code).toBe(TOOL_REJECTED);
      expect(result.error).toContain('not registered');
    }
  });

  it('(a) rejection is a structured result, not a thrown generic Error', async () => {
    // The call resolves (never rejects with `new Error(...)`)...
    let threw: unknown = null;
    let result: Awaited<ReturnType<typeof execute>> | null = null;
    try {
      result = await execute(executeInput({ toolName: 'run_tool' }));
    } catch (err) {
      threw = err;
    }
    expect(threw).toBeNull();
    // ...and carries the §21.6 canonical code on the result shape.
    expect(result).not.toBeNull();
    expect(result!.code).toBe(TOOL_REJECTED);
    expect(result!.durationMs).toBeGreaterThanOrEqual(0);
    expect(result!.data).toBeNull();
  });

  it('(b) the rejection is typed — ToolRejectedResult with code TOOL_REJECTED', async () => {
    const result = await execute(executeInput({ toolName: 'unknown_tool' }));
    // Compile-time proof of the discriminated shape: a narrowed check sees
    // `code: 'TOOL_REJECTED'` and `data: null`.
    if (result.ok === false) {
      expect(result.code).toBe('TOOL_REJECTED');
      expect(result.data).toBeNull();
      expect(typeof result.error).toBe('string');
    } else {
      throw new Error('expected a rejection result');
    }
  });
});

describe('RegisteredToolNameSchema — closed-enum generation contract', () => {
  it('(c) empty registry → schema that rejects every name (never z.enum([]))', () => {
    const schema = RegisteredToolNameSchema([]);
    // z.never() — the zero-tool specialization from 03-01: no enum variant at all.
    expect(schema.safeParse('run_tool').success).toBe(false);
    expect(schema.safeParse('anything').success).toBe(false);
  });

  it('(c) non-empty registry → closed enum over the registered names', () => {
    const schema = RegisteredToolNameSchema([fakeTool('search_kb'), fakeTool('write_note')]);
    expect(schema.safeParse('search_kb').success).toBe(true);
    expect(schema.safeParse('write_note').success).toBe(true);
    // A tool cannot be spoofed into existence (T-3-10): unregistered names fail.
    expect(schema.safeParse('run_tool').success).toBe(false);
    expect(schema.safeParse('search_notebook').success).toBe(false);
  });

  it('(c) the ToolRegistry starts EMPTY — zero tools registered in Phase 3', () => {
    expect(ToolRegistry.getAll()).toEqual([]);
  });
});