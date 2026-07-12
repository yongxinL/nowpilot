import { debugLog } from '../../utils/debugLog';
import type { ToolRegistry } from '../tools/ToolRegistry';
import type { PermissionService } from '../tools/PermissionService';
import type { ToolExecutionResult } from './pipelineTypes';

export class ExecutorService {
  constructor(
    private toolRegistry: ToolRegistry,
    private permissionService: PermissionService,
  ) {}

  async execute(
    toolName: string,
    toolInput: Record<string, unknown>,
    abortSignal: AbortSignal,
  ): Promise<ToolExecutionResult> {
    // 1. Closed-enum validation
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      debugLog('error', '[ExecutorService] Unknown tool', { toolName });
      return { success: false, error: `Unknown tool: ${toolName}` };
    }

    // 2. Permission check (default-deny)
    const canExecute = await this.permissionService.canExecute(toolName, toolInput);
    if (!canExecute) {
      debugLog('error', '[ExecutorService] Permission denied', { toolName });
      return { success: false, error: `Permission denied for tool: ${toolName}` };
    }

    // 3. Input schema validation (Zod v4)
    const inputResult = tool.inputSchema.safeParse(toolInput);
    if (!inputResult.success) {
      debugLog('error', '[ExecutorService] Invalid input', { toolName, error: inputResult.error });
      return { success: false, error: `Invalid input: ${inputResult.error.message}` };
    }

    // 4. Execute with timeout
    try {
      const output = await tool.execute(inputResult.data, { abortSignal });
      // 5. Output schema validation
      const outputResult = tool.outputSchema.safeParse(output);
      if (!outputResult.success) {
        debugLog('error', '[ExecutorService] Invalid output', { toolName, error: outputResult.error });
        return { success: false, error: `Invalid output: ${outputResult.error.message}` };
      }
      return { success: true, output: outputResult.data };
    } catch (err) {
      if (err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
        debugLog('error', '[ExecutorService] Tool execution timed out', { toolName });
        return { success: false, error: 'Tool execution timed out' };
      }
      const message = err instanceof Error ? err.message : 'Tool execution failed';
      debugLog('error', '[ExecutorService] Tool execution failed', { toolName, error: err });
      return { success: false, error: message };
    }
  }
}
