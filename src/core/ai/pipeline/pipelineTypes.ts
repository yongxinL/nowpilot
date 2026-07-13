import { z } from 'zod';
import type { ModelContextTier } from '../../context/contextTypes';

export const PlannerAction = z.enum(['answer', 'run_tool', 'ask_clarification']);

export const PlannerDecision = z.object({
  action: PlannerAction,
  toolName: z.string().optional(),
  toolInput: z.record(z.string(), z.unknown()).optional(),
  reasoning: z.string(),
});

export type PlannerDecisionType = z.infer<typeof PlannerDecision>;

export interface ToolExecutionResult {
  success: boolean;
  output?: unknown;
  error?: string;
}

export type OrchestratorEvent =
  | { type: 'plan-created'; decision: PlannerDecisionType }
  | { type: 'tool-called'; toolName: string; input: unknown }
  | { type: 'tool-result'; toolName: string; result: ToolExecutionResult }
  | { type: 'text-delta'; text: string }
  | { type: 'text-complete'; fullText: string }
  | { type: 'error'; message: string }
  | { type: 'context-degraded'; level: 'info' | 'warning'; message: string; step?: number; tier?: ModelContextTier }
  | { type: 'context-error'; code: 'CONTEXT_TOO_LARGE'; estimatedTokens: number; budget: number; message: string }
  | { type: 'waiting-permission'; toolName: string; toolInput: unknown };
