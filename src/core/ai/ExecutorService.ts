// src/core/ai/ExecutorService.ts — Source: PRODUCT_SPEC §1.2 ExecutorService
// (lines 289-301) + D-04/D-05 (03-03) + T-03-04-03 (mitigate). DETERMINISTIC
// (R-4): no SDK tool()/tools/maxSteps machinery, no LLM calls. The closed
// z.enum derived from the registered tools (buildToolNameEnum, 03-03) is the
// gate: any toolName outside it is rejected with TOOL_REJECTED before anything
// runs; a registered tool's dangerous flag and input shape are validated before
// the run. The ONLY Phase-3 tool — get-provider-info (dangerous: no, §10.5
// row 8) — reads the vault-safe ProviderRegistry snapshot (03-02, R-10: apiKey
// never retained), so the LLM can never execute tools directly (R-4).
//
// Golden Rule 9: the rejection path logs via debugLog with the canonical
// TOOL_REJECTED code (module + toolName only — never tool input bodies, R-10).
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import { getProviderRegistry } from '@/core/ai/ProviderRegistry';
import { BUILTIN_TOOLS, buildToolNameEnum } from '@/core/ai/toolSchemas';
import type { ToolSchemaRef } from '@/core/ai/toolSchemas';
import type { ToolExecutionResult } from '@/core/ai/types';

export interface ExecuteInput {
  operationId: string;
  toolName: string;
  input: unknown;
  abortSignal: AbortSignal;
}

export const ExecutorService = {
  execute,
};

export async function execute(input: ExecuteInput): Promise<ToolExecutionResult> {
  const startedAt = Date.now();
  const durationMs = (): number => Date.now() - startedAt;
  const reject = (message: string): ToolExecutionResult => {
    debugLog(ERROR_CODES.TOOL_REJECTED, message, {
      module: 'ExecutorService',
      extra: { operationId: input.operationId, toolName: input.toolName },
    });
    return {
      toolName: input.toolName,
      ok: false,
      error: { code: ERROR_CODES.TOOL_REJECTED, message, retryable: false },
      durationMs: durationMs(),
    };
  };

  // D-05 closed-enum gate (T-03-04-03). BUILTIN_TOOLS is non-empty in Phase 3,
  // but a null enum (empty toolset) rejects EVERY tool — a stray run_tool
  // decision can never reach a run.
  const toolEnum = buildToolNameEnum(BUILTIN_TOOLS);
  if (toolEnum === null || !toolEnum.safeParse(input.toolName).success) {
    return reject(`unknown tool rejected: ${input.toolName}`);
  }
  const tool = BUILTIN_TOOLS.find((t) => t.name === input.toolName);
  // Dangerous-flag gate: nothing dangerous ships in Phase 3 (D-04), but the
  // check is part of the deterministic accept/reject boundary.
  if (!tool || tool.dangerous) {
    return reject(`tool not permitted: ${input.toolName}`);
  }
  // Input-schema gate before any run (T-03-04-03): the one tool's schema is
  // { type:'object', properties:{}, additionalProperties:false } — any payload
  // other than "no input / empty object" is rejected.
  if (isToolInputInvalid(input.input, tool)) {
    return reject(`invalid input for tool: ${input.toolName}`);
  }

  if (tool.name === 'get-provider-info') {
    // §10.5 row 8: active provider + model + limits — the vault-safe registry
    // snapshot (apiKey stripped at registration, R-10).
    const output = getProviderRegistry().getProviderInfos();
    return { toolName: input.toolName, ok: true, output, durationMs: durationMs() };
  }
  // Unreachable with the closed enum — every registered tool has a handler above.
  return reject(`no executor registered for tool: ${input.toolName}`);
}

/**
 * Minimal structural input validation against the tool's jsonSchema. Phase 3's
 * ONLY tool (get-provider-info) declares `{ type:'object', properties:{},
 * additionalProperties:false }` — a valid input is an object with zero keys
 * (or no input). Richer per-tool Zod validation ships with the Phase-8 tool
 * suite (ToolCapabilityManifest, §28.5); this keeps the deterministic Executor
 * honest (T-03-04-03 input-schema gate) without inventing a JSON-schema engine.
 */
function isToolInputInvalid(input: unknown, tool: ToolSchemaRef): boolean {
  if (input === undefined || input === null) return false;
  if (typeof input !== 'object' || Array.isArray(input)) return true;
  const schema = tool.jsonSchema as { type?: unknown; additionalProperties?: unknown } | undefined;
  if (schema && schema.type === 'object' && schema.additionalProperties === false) {
    return Object.keys(input).length > 0;
  }
  return false;
}
