import { z } from 'zod';

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
  | { type: 'error'; message: string };
