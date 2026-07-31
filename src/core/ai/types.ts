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
  | 'CONTEXT_TOO_LARGE'
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

/**
 * Context window tier classification per spec §2.1.
 * tiny ≤4K, small ≤16K, medium ≤128K, large >128K.
 */
export type ModelContextTier = 'tiny' | 'small' | 'medium' | 'large';

/**
 * A single assembled prompt section (spec §2.3). `stable` is read-only
 * metadata set during assembly (D-14) — never mutated by degradation or
 * cache preparation.
 */
export interface PromptSection {
  kind: 'system' | 'tool_schemas' | 'preferences' | 'memory' | 'context' | 'task' | 'user_input';
  text: string;
  tokens: number;
  stable: boolean;
  sourceId: string;
}

export interface ContextProvenanceEntry {
  kind: PromptSection['kind'];
  sourceId: string;
  tokens: number;
  truncated: boolean;
  compressionApplied?: 'summarise' | 'structural' | 'topk';
}

/**
 * Source-level provenance manifest (spec §2.6, D-17): one entry per distinct
 * data source, keyed by hierarchical dot-separated sourceId (D-18).
 */
export interface ContextProvenanceManifest {
  sections: ContextProvenanceEntry[];
  totalTokens: number;
  minimalMode: boolean;
  workspaceId: string;
  activeSurface: 'sidepanel' | 'full-app';
}

/**
 * The context produced by ContextOptimizer.optimize() — the single contract
 * consumed by PlannerService and RendererService (D-01, D-04).
 */
export interface OptimizedContext {
  tier: ModelContextTier;
  inputBudget: number;
  outputBudget: number;
  sections: PromptSection[];
  provenance: ContextProvenanceManifest;
  minimalMode: boolean;
}

export interface ToolSchemaInfo {
  name: string;
  description: string;
  jsonSchema?: unknown;
  dangerous?: boolean;
  source?: string;
}

/**
 * Raw input to ContextOptimizer.optimize(). Optional sources (pageContext,
 * memoryHints, preferences) are skipped with graceful no-ops when absent
 * (D-05).
 */
export interface ContextOptimizerInput {
  operationId: string;
  model: string;
  modelContextWindow: number;
  userInput: string;
  conversationId: string;
  workspaceId: string;
  activeSurface: 'sidepanel' | 'full-app';
  pageContext?: unknown;
  selectedToolSchemas: ToolSchemaInfo[];
  memoryHints: unknown[];
  preferences: {
    responseStyle?: string;
    preferredLanguage?: string;
    preferStructuredOutput?: boolean;
    allowCloudFallbackFromLocal?: boolean;
    defaultProviderId?: string;
    toolAutonomy?: string;
    defaultSurface?: 'sidepanel' | 'full-app';
    themeMode?: string;
    personaId?: string;
    personaOverrides?: unknown;
  };
}

/**
 * Raw conversational input for a turn (D-03) — replaces PlannerContext as
 * the agent entry contract. AgentOrchestrator.runTurn() accepts this type.
 */
export interface AgentTurnInput {
  operationId: string;
  model: string;
  modelContextWindow: number;
  userInput: string;
  conversationId: string;
  workspaceId: string;
  activeSurface: 'sidepanel' | 'full-app';
  providerId: PipelineProviderId;
  tier: ModelTier;
  selectedToolSchemas: ToolSchemaInfo[];
  memoryHints: unknown[];
  preferences: ContextOptimizerInput['preferences'];
  personaBehavior: PlannerContext['personaBehavior'];
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
