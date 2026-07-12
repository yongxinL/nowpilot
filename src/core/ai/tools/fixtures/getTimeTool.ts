import { z } from 'zod';
import type { ToolDefinition } from '../ToolDefinition';

export const getTimeTool: ToolDefinition = {
  name: 'getTime',
  description: 'Returns the current time as an ISO 8601 timestamp. Fixture tool for pipeline testing.',
  inputSchema: z.object({}),
  outputSchema: z.object({ time: z.string() }),
  category: 'safe',
  requiresPermission: false,
  execute: async (_input, context) => {
    if (context.abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
    return { time: new Date().toISOString() };
  },
};
