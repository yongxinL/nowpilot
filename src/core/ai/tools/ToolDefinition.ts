import type { z } from 'zod';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  execute: (input: unknown, context: { abortSignal: AbortSignal }) => Promise<unknown>;
  requiresPermission?: boolean;
  category?: 'safe' | 'sensitive' | 'dangerous';
}
