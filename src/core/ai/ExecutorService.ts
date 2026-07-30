import { z } from 'zod';
import type { RegisteredTool, ToolExecutionResult } from './types';
import { PipelineError } from './PipelineError';

const DEFAULT_TIMEOUT_MS = 30_000;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Tool execution timed out')), ms);
  });
}

function validateToolName(toolName: string, registeredTools: RegisteredTool[]): void {
  const toolNames = registeredTools.map((t) => t.name);
  const schema = z.enum(toolNames as [string, ...string[]]);
  const result = schema.safeParse(toolName);
  if (!result.success) {
    throw new PipelineError(
      'NO_SUCH_TOOL',
      `The AI requested an unavailable tool "${toolName}". Please try again.`,
      { toolName, availableTools: toolNames },
    );
  }
}

function validateToolInput(toolName: string, input: unknown, registeredTools: RegisteredTool[]): RegisteredTool {
  const tool = registeredTools.find((t) => t.name === toolName);
  if (!tool) {
    throw new PipelineError('NO_SUCH_TOOL', `Tool "${toolName}" not found.`, { toolName });
  }

  const inputSchema = tool.inputSchema;
  let zodSchema: z.ZodSchema;

  if (inputSchema instanceof z.ZodType) {
    zodSchema = inputSchema as z.ZodSchema;
  } else {
    zodSchema = z.object({}).passthrough();
  }

  const result = zodSchema.safeParse(input);
  if (!result.success) {
    throw new PipelineError(
      'INVALID_TOOL_INPUT',
      `The AI provided invalid input for the requested tool "${toolName}".`,
      { toolName, input, errors: result.error.issues },
    );
  }

  return tool;
}

export class ExecutorService {
  async execute(
    toolName: string,
    input: unknown,
    registeredTools: RegisteredTool[],
    signal?: AbortSignal,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<ToolExecutionResult> {
    validateToolName(toolName, registeredTools);
    const tool = validateToolInput(toolName, input, registeredTools);

    const startTime = performance.now();

    try {
      const output = await Promise.race([
        tool.execute(input, signal),
        timeout(timeoutMs),
      ]);

      const durationMs = performance.now() - startTime;
      return { toolName, output, durationMs };
    } catch (err) {
      const durationMs = performance.now() - startTime;

      if (err instanceof Error && err.message === 'Tool execution timed out') {
        throw new PipelineError(
          'PROVIDER_TIMEOUT',
          `Tool "${toolName}" execution timed out.`,
          { toolName, timeoutMs },
        );
      }

      if (err instanceof PipelineError) throw err;

      if (err instanceof Error && err.name === 'AbortError') {
        throw new PipelineError('ABORTED', `Tool "${toolName}" execution was aborted.`, { toolName });
      }

      throw new PipelineError(
        'UNKNOWN',
        `Tool "${toolName}" execution failed.`,
        { toolName, originalError: String(err) },
      );
    }
  }

  async executeBatch(
    toolCalls: Array<{ toolName: string; input: unknown }>,
    registeredTools: RegisteredTool[],
    signal?: AbortSignal,
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];
    for (const call of toolCalls) {
      try {
        const result = await this.execute(call.toolName, call.input, registeredTools, signal);
        results.push(result);
      } catch {
        continue;
      }
    }
    return results;
  }
}

export const executorService = new ExecutorService();
