import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../../../../src/core/ai/tools/ToolRegistry';
import type { PermissionService } from '../../../../src/core/ai/tools/PermissionService';
import { echoTool } from '../../../../src/core/ai/tools/fixtures/echoTool';

// Must import before vi.mock to avoid hoisting issues
import { ExecutorService } from '../../../../src/core/ai/pipeline/ExecutorService';

describe('ExecutorService', () => {
  let toolRegistry: ToolRegistry;
  let mockPermission: PermissionService;
  let executor: ExecutorService;
  let abortController: AbortController;

  beforeEach(() => {
    toolRegistry = new ToolRegistry();
    toolRegistry.register(echoTool);
    mockPermission = {
      canExecute: vi.fn().mockResolvedValue(true),
    };
    executor = new ExecutorService(toolRegistry, mockPermission);
    abortController = new AbortController();
  });

  it('executes a known tool with valid input and returns success', async () => {
    const result = await executor.execute('echo', { text: 'hello' }, abortController.signal);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output).toEqual({ echoed: 'hello' });
    }
  });

  it('returns structured error for unknown tool name (closed-enum validation)', async () => {
    const result = await executor.execute('nonexistent', {}, abortController.signal);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Unknown tool: nonexistent');
    }
  });

  it('returns structured error for invalid tool input (Zod input validation)', async () => {
    const result = await executor.execute('echo', { wrong: 'input' }, abortController.signal);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid input');
    }
  });

  it('returns permission denied error when PermissionService returns false', async () => {
    mockPermission.canExecute = vi.fn().mockResolvedValue(false);
    const result = await executor.execute('echo', { text: 'hello' }, abortController.signal);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Permission denied for tool: echo');
    }
  });

  it('returns timeout error when abortSignal is already aborted', async () => {
    const abortedController = new AbortController();
    abortedController.abort();
    const result = await executor.execute('echo', { text: 'hi' }, abortedController.signal);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Tool execution timed out');
    }
  });

  it('returns structured error when tool execute throws non-AbortError', async () => {
    const throwingTool = {
      name: 'thrower',
      description: 'Always throws',
      inputSchema: echoTool.inputSchema,
      outputSchema: echoTool.outputSchema,
      category: 'safe' as const,
      requiresPermission: false,
      execute: async () => { throw new Error('Something went wrong'); },
    };
    toolRegistry.register(throwingTool);

    const result = await executor.execute('thrower', { text: 'x' }, abortController.signal);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Something went wrong');
    }
  });

  it('returns structured error when tool output fails outputSchema validation', async () => {
    const badOutputTool = {
      name: 'bad-output',
      description: 'Returns invalid output',
      inputSchema: echoTool.inputSchema,
      outputSchema: echoTool.outputSchema,
      category: 'safe' as const,
      requiresPermission: false,
      execute: async () => ({ notEchoed: 'oops' }),
    };
    toolRegistry.register(badOutputTool);

    const result = await executor.execute('bad-output', { text: 'x' }, abortController.signal);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Invalid output');
    }
  });

  it('calls permissionService.canExecute with toolName and input', async () => {
    await executor.execute('echo', { text: 'test' }, abortController.signal);
    expect(mockPermission.canExecute).toHaveBeenCalledWith('echo', { text: 'test' });
  });

  it('never throws — always returns structured ToolExecutionResult', async () => {
    // Test various failure modes
    const results = await Promise.all([
      executor.execute('echo', { text: 'ok' }, abortController.signal),
      executor.execute('nonexistent', {}, abortController.signal),
      executor.execute('echo', { wrong: 'input' }, abortController.signal),
    ]);

    expect(results).toHaveLength(3);
    // Success result: success=true, output defined, error absent
    expect(results[0].success).toBe(true);
    if (results[0].success) expect(results[0].output).toBeDefined();
    // Error results: success=false, error defined, output absent
    expect(results[1].success).toBe(false);
    if (!results[1].success) expect(results[1].error).toBeDefined();
    expect(results[2].success).toBe(false);
    if (!results[2].success) expect(results[2].error).toBeDefined();
  });
});
