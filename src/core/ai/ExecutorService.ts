import { z } from 'zod';
import type { CompletionEvidence, RegisteredTool, ToolExecutionResult } from './types';
import { PipelineError } from './PipelineError';

const DEFAULT_TIMEOUT_MS = 30_000;

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Tool execution timed out')), ms);
  });
}

function validateToolName(toolName: string, registeredTools: RegisteredTool[]): void {
  const toolNames = registeredTools.map((t) => t.name);
  const schema = z.enum(toolNames as [string, ...string[]]);
  const result = schema.safeParse(toolName);
  if (!result.success) {
    throw new PipelineError(
      'NO_SUCH_TOOL',
      `The AI requested an unavailable tool "${toolName}". Please try again.`,
      { toolName, availableTools: toolNames },
    );
  }
}

function validateToolInput(toolName: string, input: unknown, registeredTools: RegisteredTool[]): RegisteredTool {
  const tool = registeredTools.find((t) => t.name === toolName);
  if (!tool) {
    throw new PipelineError('NO_SUCH_TOOL', `Tool "${toolName}" not found.`, { toolName });
  }

  const inputSchema = tool.inputSchema;
  let zodSchema: z.ZodSchema;

  if (inputSchema instanceof z.ZodType) {
    zodSchema = inputSchema as z.ZodSchema;
  } else {
    zodSchema = z.object({}).passthrough();
  }

  const result = zodSchema.safeParse(input);
  if (!result.success) {
    throw new PipelineError(
      'INVALID_TOOL_INPUT',
      `The AI provided invalid input for the requested tool "${toolName}".`,
      { toolName, input, errors: result.error.issues },
    );
  }

  return tool;
}

/**
 * Deterministic canonical serialization: object keys are sorted
 * recursively, so logically identical inputs (key order swapped) produce
 * the same serialized value. Used only to derive the in-memory logical
 * key — never exposed in public diagnostics.
 */
function canonicalStringify(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `[${value.map(canonicalStringify).join(',')}]`;
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalStringify(record[k])}`).join(',')}}`;
  }
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'bigint') return `${value}n`;
  return String(value);
}

interface IdempotencyLedgerEntry {
  /** started = in-flight; completed = validated result cached; failed-before-effect = one recovery allowed; unknown = unresolved, never re-executed */
  status: 'started' | 'completed' | 'failed-before-effect' | 'unknown';
  operationId: string;
  toolName: string;
  toolCallId: string;
  result?: unknown;
  evidence?: CompletionEvidence;
  recoveryAttempted: boolean;
  executedAt: number;
}

export class ExecutorService {
  /**
   * Operation-scoped, in-memory idempotency ledger (D-17). Keyed by
   * `operationId:toolName:canonical-input`. Resets on service/extension
   * restart — durable cross-turn guarantees are Phase 8a.
   */
  private readonly ledger = new Map<string, IdempotencyLedgerEntry>();
  /** toolCallId -> logical key, so attachEvidence can locate the entry. */
  private readonly toolCallIndex = new Map<string, string>();

  async execute(
    toolName: string,
    input: unknown,
    registeredTools: RegisteredTool[],
    signal?: AbortSignal,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
    operationId?: string,
  ): Promise<ToolExecutionResult> {
    validateToolName(toolName, registeredTools);
    const tool = validateToolInput(toolName, input, registeredTools);

    const requiresLedger = tool.idempotency === 'required';
    if (requiresLedger && !operationId) {
      throw new PipelineError(
        'INVALID_TOOL_INPUT',
        `Tool "${toolName}" requires idempotency protection and a non-empty operationId.`,
        { toolName },
      );
    }

    const toolCallId = crypto.randomUUID();

    let key: string | undefined;
    let existing: IdempotencyLedgerEntry | undefined;
    if (operationId) {
      key = this.deriveOperationKey(operationId, toolName, input);
      existing = this.ledger.get(key);
      if (existing) {
        if (requiresLedger && existing.status === 'completed') {
          // Completed duplicate: serve the prior validated result + evidence
          // without executing, under a fresh toolCallId (D-17).
          const duplicateCallId = crypto.randomUUID();
          existing.toolCallId = duplicateCallId;
          this.toolCallIndex.set(duplicateCallId, key);
          return {
            toolName,
            output: existing.result,
            durationMs: 0,
            toolCallId: duplicateCallId,
            evidence: existing.evidence,
          };
        }
        if (requiresLedger && existing.status === 'failed-before-effect' && !existing.recoveryAttempted) {
          // One bounded recovery attempt for a failed-before-effect entry.
          existing.status = 'started';
          existing.recoveryAttempted = true;
          existing.toolCallId = toolCallId;
          this.toolCallIndex.set(toolCallId, key);
        } else if (requiresLedger) {
          // started (in-flight), unknown, or exhausted recovery — never re-execute.
          throw new PipelineError(
            'TOOL_IDEMPOTENCY_CONFLICT',
            `Tool "${toolName}" has an unresolved prior execution and will not be re-executed.`,
            { toolName, operationId },
          );
        } else {
          // Non-required tool: refresh the entry; duplicates still execute.
          existing.status = 'started';
          existing.toolCallId = toolCallId;
          this.toolCallIndex.set(toolCallId, key);
        }
      } else {
        this.ledger.set(key, {
          status: 'started',
          operationId,
          toolName,
          toolCallId,
          recoveryAttempted: false,
          executedAt: Date.now(),
        });
        this.toolCallIndex.set(toolCallId, key);
      }
    }

    const startTime = performance.now();

    try {
      const output = await Promise.race([
        tool.execute(input, signal),
        timeout(timeoutMs),
      ]);

      const durationMs = performance.now() - startTime;

      if (key) {
        const entry = this.ledger.get(key);
        if (entry) {
          entry.status = 'completed';
          entry.result = output;
          entry.executedAt = Date.now();
        }
      }

      return { toolName, output, durationMs, toolCallId };
    } catch (err) {
      if (key) {
        const entry = this.ledger.get(key);
        if (entry) {
          // A caught error is failed-before-effect only when its
          // diagnostic explicitly says effectStarted is false; everything
          // else (started, aborted, timeout, unknown) is unresolved.
          const failedBeforeEffect =
            err instanceof PipelineError &&
            (err.diagnostic as { effectStarted?: unknown } | undefined)?.effectStarted === false;
          entry.status = failedBeforeEffect && !entry.recoveryAttempted ? 'failed-before-effect' : 'unknown';
          entry.executedAt = Date.now();
        }
      }

      const durationMs = performance.now() - startTime;

      if (err instanceof Error && err.message === 'Tool execution timed out') {
        throw new PipelineError(
          'PROVIDER_TIMEOUT',
          `Tool "${toolName}" execution timed out.`,
          { toolName, timeoutMs },
        );
      }

      if (err instanceof PipelineError) throw err;

      if (err instanceof Error && err.name === 'AbortError') {
        throw new PipelineError('ABORTED', `Tool "${toolName}" execution was aborted.`, { toolName });
      }

      throw new PipelineError(
        'UNKNOWN',
        `Tool "${toolName}" execution failed.`,
        { toolName, originalError: String(err) },
      );
    }
  }

  async executeBatch(
    toolCalls: Array<{ toolName: string; input: unknown }>,
    registeredTools: RegisteredTool[],
    signal?: AbortSignal,
    operationId?: string,
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];
    for (const call of toolCalls) {
      try {
        const result = await this.execute(
          call.toolName,
          call.input,
          registeredTools,
          signal,
          DEFAULT_TIMEOUT_MS,
          operationId,
        );
        results.push(result);
      } catch {
        continue;
      }
    }
    return results;
  }

  /**
   * Validated cache seam for the later orchestrator/OutcomeVerifier:
   * attach CompletionEvidence to the recorded call. Accepted only when
   * evidence.operationId, evidence.toolName AND evidence.toolCallId
   * exactly match the recorded entry — spoofed values throw
   * TOOL_POSTCONDITION_FAILED and never overwrite cached evidence
   * (T-03a-01, WR-07).
   */
  attachEvidence(toolCallId: string, evidence: CompletionEvidence): void {
    const key = this.toolCallIndex.get(toolCallId);
    const entry = key ? this.ledger.get(key) : undefined;
    if (!entry) {
      throw new PipelineError(
        'TOOL_POSTCONDITION_FAILED',
        `No executed tool call matches "${toolCallId}".`,
        { toolCallId },
      );
    }
    if (
      entry.operationId !== evidence.operationId ||
      entry.toolName !== evidence.toolName ||
      entry.toolCallId !== evidence.toolCallId
    ) {
      throw new PipelineError(
        'TOOL_POSTCONDITION_FAILED',
        'Evidence does not match the recorded tool call.',
        { toolCallId },
      );
    }
    entry.evidence = evidence;
  }

  private deriveOperationKey(operationId: string, toolName: string, input: unknown): string {
    return `op:${operationId};tool:${toolName};input:${canonicalStringify(input)}`;
  }
}

export const executorService = new ExecutorService();
