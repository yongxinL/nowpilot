import type { RegisteredTool, ToolExecutionResult } from './types';
import { PipelineError } from './PipelineError';

export class ExecutorService {
  async execute(
    toolName: string,
    input: unknown,
    availableTools: RegisteredTool[],
    signal?: AbortSignal,
  ): Promise<ToolExecutionResult> {
    const tool = availableTools.find((t) => t.name === toolName);
    if (!tool) {
      throw new PipelineError(
        'NO_SUCH_TOOL',
        `Tool "${toolName}" is not registered.`,
        { toolName },
      );
    }

    if (typeof input !== 'object' || input === null) {
      throw new PipelineError(
        'INVALID_TOOL_INPUT',
        `Invalid input for tool "${toolName}": expected an object.`,
        { toolName, receivedType: typeof input },
      );
    }

    const startTime = Date.now();
    try {
      const output = await tool.execute(input, signal);
      return {
        toolName,
        output,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      if (err instanceof PipelineError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new PipelineError('ABORTED', 'Tool execution was aborted.', { toolName });
      }
      throw new PipelineError('UNKNOWN', `Tool "${toolName}" execution failed.`, {
        toolName,
        originalError: String(err),
      });
    }
  }
}

export const executorService = new ExecutorService();
