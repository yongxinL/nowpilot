import { z } from 'zod';
import type { ToolDefinition } from '../ToolDefinition';

export const echoTool: ToolDefinition = {
  name: 'echo',
  description: 'Returns the input text unchanged. Fixture tool for pipeline testing.',
  inputSchema: z.object({ text: z.string() }),
  outputSchema: z.object({ echoed: z.string() }),
  category: 'safe',
  requiresPermission: false,
  execute: async (input, context) => {
    if (context.abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
    const { text } = input as { text: string };
    return { echoed: text };
  },
};
