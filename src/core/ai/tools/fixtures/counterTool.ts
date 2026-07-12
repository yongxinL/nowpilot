import { z } from 'zod';
import type { ToolDefinition } from '../ToolDefinition';

let count = 0;

export const counterTool: ToolDefinition = {
  name: 'counter',
  description: 'Stateful counter fixture tool. Increments, decrements, or resets a session-scoped count.',
  inputSchema: z.object({ action: z.enum(['increment', 'decrement', 'reset']) }),
  outputSchema: z.object({ count: z.number() }),
  category: 'safe',
  requiresPermission: false,
  execute: async (input, context) => {
    if (context.abortSignal.aborted) throw new DOMException('Aborted', 'AbortError');
    const { action } = input as { action: 'increment' | 'decrement' | 'reset' };
    switch (action) {
      case 'increment':
        count += 1;
        break;
      case 'decrement':
        count -= 1;
        break;
      case 'reset':
        count = 0;
        break;
    }
    return { count };
  },
};
