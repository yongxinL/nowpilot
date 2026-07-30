export type PipelineProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama';

export type ModelTier = 'FAST' | 'BALANCED' | 'ADVANCED';

export type PipelineErrorCode =
  | 'PROVIDER_AUTH'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_5XX'
  | 'NETWORK'
  | 'RATE_LIMITED'
  | 'MODEL_UNKNOWN'
  | 'SCHEMA_INVALID'
  | 'NO_SUCH_TOOL'
  | 'INVALID_TOOL_INPUT'
  | 'TIER_CAP_REACHED'
  | 'CIRCUIT_OPEN'
  | 'ABORTED'
  | 'UNKNOWN';

export type PipelineErrorCategory = 'retryable' | 'terminal';

export type PlannerDecision =
  | { action: 'answer'; reasonCode: string }
  | { action: 'run_tool'; toolName: string; input: unknown }
  | { action: 'ask_clarification'; question: string };

export interface PlannerContext {
  version: 1;
  userMessage: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  toolCallHistory: Array<{ toolName: string; input: unknown; output: unknown; timestamp: number }>;
  availableTools: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  personaBehavior: { brevity: string; clarificationStrategy: string; reasoningStyle: string } | null;
  abortSignal?: AbortSignal;
}

export type StreamEvent =
  | { type: 'text-delta'; content: string }
  | { type: 'tool-call'; toolName: string; input: unknown }
  | { type: 'tool-result'; toolName: string; output: unknown }
  | { type: 'error'; error: import('./PipelineError').PipelineError }
  | { type: 'done'; usage?: { promptTokens: number; completionTokens: number } };

export interface RegisteredTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: unknown, signal?: AbortSignal) => Promise<unknown>;
}

export interface ToolExecutionResult {
  toolName: string;
  output: unknown;
  durationMs: number;
}

export const TIER_CAPS: Record<ModelTier, { planner: number; tool: number }> = {
  FAST: { planner: 3, tool: 2 },
  BALANCED: { planner: 5, tool: 3 },
  ADVANCED: { planner: 7, tool: 5 },
};
