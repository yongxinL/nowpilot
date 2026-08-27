// ExecutorService — §1.2 ExecutorService (spec 299-311), verbatim semantics.
//
// Deterministic. Rejects unknown tool names (closed z.enum from the registry
// — T-3-10), validates input against the tool's Zod schema, checks permission
// policy, checks model/context-tier capability, runs the tool with timeout,
// validates output against the tool's Zod output schema, and returns
// ToolExecutionResult<T>. "The LLM never executes tools directly."
//
// D-46: Phase 3 registers ZERO tools — every direct or test-injected run_tool
// is rejected with TOOL_REJECTED (§21.6 closed set; no invented codes, D-38).
import type { ProviderId, ToolExecutionResult } from './types';
import { RegisteredToolNameSchema, ToolRegistry } from './toolSchemas';

/** §21.6 canonical code for an unregistered/unknown tool name. */
export const TOOL_REJECTED = 'TOOL_REJECTED';

export interface ExecuteInput {
  /** Phase-1 OperationId correlation (Flag C). */
  operationId: string;
  toolName: string;
  inputData: unknown;
  /** Assembled stage prompt (PromptCacheManager, D-59) — unused while zero tools are registered. */
  systemPrompt?: string;
  provider: ProviderId;
  abortSignal?: AbortSignal;
}

/** Typed rejection — the `code` field distinguishes it from a generic Error. */
export interface ToolRejectedResult {
  toolName: string;
  ok: false;
  data: null;
  error: string;
  code: 'TOOL_REJECTED';
  durationMs: number;
}

export async function execute(input: ExecuteInput): Promise<ToolExecutionResult> {
  const startedAt = Date.now();

  // Narrow toolName against the closed enum generated from the registered
  // tool list at request time (§1.2). Zero tools → z.never() → every
  // toolName fails the schema boundary (D-46 zero-tool specialization).
  const toolNameSchema = RegisteredToolNameSchema(ToolRegistry.getAll());
  const parsed = toolNameSchema.safeParse(input.toolName);
  if (!parsed.success) {
    return {
      toolName: input.toolName,
      ok: false,
      data: null,
      error: `Tool '${input.toolName}' is not registered — Phase 3 registers zero tools (D-46).`,
      code: TOOL_REJECTED,
      durationMs: Date.now() - startedAt,
    } satisfies ToolRejectedResult;
  }

  // Future (tool-owning phases): fetch the ToolDefinition by parsed name →
  // validate inputData against inputSchema → TOL-02 permission check →
  // tier-capability check → run with timeout → validate output → return.
  // Phase 3 never reaches here (the registry is empty).
  return {
    toolName: input.toolName,
    ok: false,
    data: null,
    error: `Tool '${input.toolName}' has no executor implementation in Phase 3 (D-46).`,
    code: TOOL_REJECTED,
    durationMs: Date.now() - startedAt,
  } satisfies ToolRejectedResult;
}

export const ExecutorService = { execute };