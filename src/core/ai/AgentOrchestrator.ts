import { providerRouter } from './ProviderRouter';
import { plannerService } from './PlannerService';
import type { RecoveryObservation } from './PlannerService';
import { executorService } from './ExecutorService';
import { rendererService } from './RendererService';
import { outcomeVerifier } from './verifier/OutcomeVerifier';
import { evaluateReplan } from './ReplanPolicy';
import { buildRenderingOutcomePolicy, enforceRenderingOutcomePolicy } from './RenderingOutcomePolicy';
import type { RenderingOutcomePolicy } from './RenderingOutcomePolicy';
import { PipelineError, projectPipelineError } from './PipelineError';
import { TierCapForTier } from './TierResolver';
import { contextOptimizer } from '../context/ContextOptimizer';
import { promptCacheManager } from '../context/PromptCacheManager';
import { AgentTrajectoryMachine } from './AgentTrajectoryMachine';
import {
  createAgentTurnOutcome,
  OUTCOME_WARNING_RENDERER_EVIDENCE_CONTRADICTION,
} from './AgentTurnOutcome';
import type {
  AgentTerminalState,
  AgentTurnOutcome,
  AgentTurnReasonCode,
} from './AgentTurnOutcome';
import type {
  AgentTrajectoryState,
  CompletionEvidence,
  ContextOptimizerInput,
  OptimizedContext,
  PermissionOrigin,
  PipelineProviderId,
  PlannerDecision,
  RegisteredTool,
  ToolExecutionResult,
  ToolSideEffect,
} from './types';
import type { AgentTurnInput } from './AgentTurnInput';
import type { ProviderAdapter } from './providers/ProviderAdapter';

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

function isAbortSignalOrError(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || isAbortError(error) ||
    (error instanceof PipelineError && error.code === 'ABORTED');
}

function buildOptimizerInput(input: AgentTurnInput): ContextOptimizerInput {
  return {
    operationId: input.operationId,
    model: input.model,
    // The caller-supplied window is the primary source (D-03): for models
    // outside KNOWN_MODEL_WINDOWS, silently substituting the default would
    // misclassify the context tier and misbudget the prompt (WR-02).
    modelContextWindow: input.modelContextWindow,
    userInput: input.userInput,
    conversationId: input.conversationId,
    workspaceId: input.workspaceId,
    activeSurface: input.activeSurface,
    pageContext: undefined,
    selectedToolSchemas: input.selectedToolSchemas,
    memoryHints: input.memoryHints,
    preferences: input.preferences,
    abortSignal: input.abortSignal,
  };
}

/**
 * Selected-tool adapter (D-08/D-16): the closed registry boundary between
 * ToolSchemaInfo and RegisteredTool. The three Phase 3a reliability fields
 * are forwarded explicitly; a missing field is rejected with SCHEMA_INVALID
 * rather than silently defaulted. No Phase 8a manifest fields are added.
 */
function buildRegisteredTools(input: AgentTurnInput): RegisteredTool[] {
  return input.selectedToolSchemas.map((t) => {
    if (t.sideEffect === undefined || t.idempotency === undefined || t.evidence === undefined) {
      throw new PipelineError(
        'SCHEMA_INVALID',
        `Tool "${t.name}" is missing required reliability metadata.`,
        { toolName: t.name },
      );
    }
    return {
      name: t.name,
      description: t.description,
      inputSchema: (t.jsonSchema ?? {}) as Record<string, unknown>,
      execute: async () => null,
      sideEffect: t.sideEffect,
      idempotency: t.idempotency,
      evidence: t.evidence,
    };
  });
}

/**
 * Bounded safe evidence summary for the recovery observation (D-15): only
 * the tool name, the check count, and the closed failure reason — never
 * raw output, check contents, or logical keys.
 */
function summarizeEvidence(evidence: CompletionEvidence): string {
  if (evidence.verified) {
    return `${evidence.checks.length} check(s) passed for tool '${evidence.toolName}'`;
  }
  return `verification failed (${evidence.failureReason}) for tool '${evidence.toolName}'`;
}

export class AgentOrchestrator {
  /**
   * Record cache response metadata after a successful provider call
   * (D-15). The current provider adapters do not yet expose native cache
   * usage — unknown cache status is treated as a miss, which is correct
   * per §19.13 semantics (recordResponse() only ever sees post-response
   * signals, never errors: caching behavior during failures is not
   * indicative of cache health).
   */
  private recordCacheResponse(providerId: PipelineProviderId): void {
    promptCacheManager.recordResponse({
      providerId,
      cacheHit: false,
      cacheWrite: false,
    });
  }

  /**
   * Runs one agent turn (D-01..D-17). ContextOptimizer.optimize() executes
   * exactly once; a fresh AgentTrajectoryMachine and immutable per-turn
   * accumulators are scoped to this call. Every exit path returns an
   * immutable AgentTurnOutcome — no path returns a bare string or throws a
   * normal pipeline error.
   */
  async runTurn(input: AgentTurnInput): Promise<AgentTurnOutcome> {
    const startedAt = Date.now();
    const machine = new AgentTrajectoryMachine();
    const signal = input.abortSignal;
    const operationId = input.operationId;
    const caps = TierCapForTier(input.tier);

    const evidence: CompletionEvidence[] = [];
    const toolResults: ToolExecutionResult[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    let plannerCalls = 0;
    let toolCalls = 0;
    let replanCount = 0;
    let replanning = false;
    let recoveryObservation: RecoveryObservation | undefined;
    let abortMeta: AgentTurnOutcome['abort'] | undefined;
    let adapter: ProviderAdapter | undefined;
    let providerId: PipelineProviderId = input.providerId;
    let optimized: OptimizedContext | undefined;
    let cacheOptimized: OptimizedContext | undefined;

    const limits = () => ({
      plannerCalls,
      plannerCap: caps.planner,
      plannerCapReached: plannerCalls >= caps.planner,
      toolCalls,
      toolCap: caps.tool,
      toolCapReached: toolCalls >= caps.tool,
    });

    const finish = (
      terminalState: AgentTerminalState,
      reasonCode: AgentTurnReasonCode,
      renderedAnswer: string | null,
    ): AgentTurnOutcome => {
      machine.finalize();
      return createAgentTurnOutcome({
        operationId,
        terminalState,
        reasonCode,
        renderedAnswer,
        trajectory: machine.history,
        evidence,
        toolResults,
        limits: limits(),
        abort: abortMeta,
        diagnostics: { errors, warnings },
        startedAt,
      });
    };

    const abortTurn = (
      stage: AgentTrajectoryState,
      reasonCode: AgentTurnReasonCode,
      origin?: PermissionOrigin,
    ): AgentTurnOutcome => {
      abortMeta = abortMeta ?? { requested: true, requestedAt: Date.now(), stage, origin };
      try {
        machine.transitionTo('aborted', { reasonCode });
      } catch {
        // Already terminal — the abort is recorded, not re-transitioned.
      }
      machine.finalize();
      return createAgentTurnOutcome({
        operationId,
        terminalState: 'aborted',
        reasonCode,
        renderedAnswer: null,
        trajectory: machine.history,
        evidence,
        toolResults,
        limits: limits(),
        abort: { requested: true, requestedAt: abortMeta.requestedAt, stage, origin: abortMeta.origin },
        diagnostics: { errors, warnings },
        startedAt,
      });
    };

    const failTurn = (reasonCode: AgentTurnReasonCode, errorCode?: string): AgentTurnOutcome => {
      if (errorCode) errors.push(errorCode);
      try {
        machine.transitionTo('failed', { reasonCode });
      } catch {
        // Already terminal — the failure is recorded, not re-transitioned.
      }
      return finish('failed', reasonCode, null);
    };

    const buildPolicyForRender = (target?: {
      toolName: string;
      toolCallId: string;
      sideEffect: ToolSideEffect;
    }): RenderingOutcomePolicy => {
      const t = target ?? (() => {
        const last = toolResults[toolResults.length - 1];
        if (!last) {
          return { toolName: '', toolCallId: '', sideEffect: 'none' as const };
        }
        const tool = tools.find((x) => x.name === last.toolName);
        return {
          toolName: last.toolName,
          toolCallId: last.toolCallId,
          sideEffect: tool?.sideEffect ?? 'none',
        };
      })();
      return buildRenderingOutcomePolicy({
        operationId,
        toolCallId: t.toolCallId,
        toolName: t.toolName,
        sideEffect: t.sideEffect,
        evidence,
      });
    };

    const renderAndFinish = async (
      terminalState: AgentTerminalState,
      reasonCode: AgentTurnReasonCode,
      decision: { action: 'answer'; reasonCode: string },
      policy: RenderingOutcomePolicy,
    ): Promise<AgentTurnOutcome> => {
      try {
        if (signal?.aborted) return abortTurn('rendering', 'caller_aborted');
        machine.transitionTo('rendering', { reasonCode });
        const rendered = await rendererService.synthesize(
          adapter!,
          input.tier,
          decision,
          cacheOptimized!,
          policy,
          signal,
          toolResults,
        );
        if (signal?.aborted) return abortTurn('rendering', 'caller_aborted');
        this.recordCacheResponse(providerId);

        const enforced = enforceRenderingOutcomePolicy(rendered, policy);
        if (enforced.contradicted) {
          warnings.push(OUTCOME_WARNING_RENDERER_EVIDENCE_CONTRADICTION);
        }
        machine.transitionTo(terminalState === 'failed' ? 'failed' : 'completed', { reasonCode });
        return finish(terminalState, reasonCode, enforced.text);
      } catch (err) {
        if (isAbortSignalOrError(err, signal)) return abortTurn('rendering', 'caller_aborted');
        errors.push(err instanceof PipelineError ? err.code : 'UNKNOWN');
        try {
          machine.transitionTo('failed', { reasonCode: 'renderer_failed' });
        } catch {
          // Already terminal.
        }
        return finish('failed', 'renderer_failed', null);
      }
    };

    // ── assembling-context ─────────────────────────────────────────────
    let tools: RegisteredTool[];
    try {
      if (signal?.aborted) return abortTurn('assembling-context', 'caller_aborted');
      optimized = await contextOptimizer.optimize(buildOptimizerInput(input));
      if (signal?.aborted) return abortTurn('assembling-context', 'caller_aborted');

      const selected = await providerRouter.selectProvider(input.providerId, signal);
      if (signal?.aborted) return abortTurn('assembling-context', 'caller_aborted');
      adapter = selected.adapter;
      providerId = selected.providerId;

      const cacheResult = promptCacheManager.prepareCacheHints(providerId, optimized.sections);
      cacheOptimized = { ...optimized, sections: cacheResult.sections };

      tools = buildRegisteredTools(input);
    } catch (err) {
      if (isAbortSignalOrError(err, signal)) return abortTurn('assembling-context', 'caller_aborted');
      const code = err instanceof PipelineError ? err.code : 'UNKNOWN';
      return failTurn('pipeline_failed', code);
    }

    machine.transitionTo('planning', { plannerCall: 1 });

    while (true) {
      if (plannerCalls >= caps.planner) {
        return await renderAndFinish(
          'partial',
          'planner_cap_reached',
          { action: 'answer', reasonCode: 'tier_cap_reached' },
          buildPolicyForRender(),
        );
      }

      // The strict allowlist (D-04) has no executing→planning or
      // verifying→planning edge — replanning is the only legal path back
      // to the planner loop after a tool step.
      if (replanning) {
        machine.transitionTo('planning', { plannerCall: plannerCalls + 1 });
        replanning = false;
      } else if (machine.state === 'executing' || machine.state === 'verifying') {
        machine.transitionTo('replanning', { plannerCall: plannerCalls + 1 });
        machine.transitionTo('planning', { plannerCall: plannerCalls + 1 });
      }

      plannerCalls++;

      let decision: PlannerDecision;
      try {
        if (signal?.aborted) return abortTurn('planning', 'caller_aborted');
        const observation = recoveryObservation;
        decision = await plannerService.plan(adapter!, input.tier, cacheOptimized!, signal, observation);
        recoveryObservation = undefined;
        this.recordCacheResponse(providerId);
        if (signal?.aborted) return abortTurn('planning', 'caller_aborted');
      } catch (err) {
        if (isAbortSignalOrError(err, signal)) return abortTurn('planning', 'caller_aborted');
        const code = err instanceof PipelineError ? err.code : 'UNKNOWN';
        return failTurn('planner_failed', code);
      }

      switch (decision.action) {
        case 'answer': {
          return await renderAndFinish(
            'completed',
            'planner_answer',
            decision,
            buildPolicyForRender(),
          );
        }

        case 'ask_clarification': {
          try {
            machine.transitionTo('rendering', { reasonCode: 'planner_clarification' });
            machine.transitionTo('completed', { reasonCode: 'planner_clarification' });
          } catch {
            return failTurn('invalid_state_transition', 'AGENT_STATE_INVALID');
          }
          return finish('completed', 'planner_clarification', decision.question);
        }

        case 'run_tool': {
          const tool = tools.find((t) => t.name === decision.toolName);
          if (!tool) {
            return failTurn('tool_failed', 'NO_SUCH_TOOL');
          }

          if (toolCalls >= caps.tool) {
            return await renderAndFinish(
              'partial',
              'tool_cap_reached',
              { action: 'answer', reasonCode: 'tier_cap_reached' },
              buildPolicyForRender(),
            );
          }

          const isSideEffecting = tool.sideEffect === 'write' || tool.sideEffect === 'irreversible';

          // ── waiting-for-permission ──
          if (isSideEffecting) {
            machine.transitionTo('waiting-for-permission', { toolName: tool.name, toolCall: toolCalls + 1 });
            if (input.requestPermission) {
              try {
                if (signal?.aborted) return abortTurn('waiting-for-permission', 'caller_aborted');
                const permission = await input.requestPermission({
                  toolName: tool.name,
                  operationId,
                  toolCallId: crypto.randomUUID(),
                  sideEffect: tool.sideEffect ?? 'none',
                });
                if (signal?.aborted) return abortTurn('waiting-for-permission', 'caller_aborted');
                if (permission.decision === 'denied') {
                  return failTurn('permission_denied');
                }
                if (permission.decision === 'cancelled') {
                  const origin = permission.origin ?? 'caller';
                  return abortTurn(
                    'waiting-for-permission',
                    origin === 'user' ? 'user_aborted' : 'caller_aborted',
                    origin,
                  );
                }
              } catch (err) {
                if (isAbortSignalOrError(err, signal)) {
                  return abortTurn('waiting-for-permission', 'caller_aborted');
                }
                const code = err instanceof PipelineError ? err.code : 'UNKNOWN';
                return failTurn('pipeline_failed', code);
              }
            }
          }

          // ── executing ──
          let result: ToolExecutionResult;
          try {
            machine.transitionTo('executing', { toolName: tool.name, toolCall: toolCalls + 1 });
            if (signal?.aborted) return abortTurn('executing', 'caller_aborted');
            toolCalls++;
            result = await executorService.execute(
              decision.toolName,
              decision.input,
              tools,
              signal,
              undefined,
              operationId,
            );
            if (signal?.aborted) return abortTurn('executing', 'caller_aborted');
          } catch (err) {
            if (isAbortSignalOrError(err, signal)) return abortTurn('executing', 'caller_aborted');
            const pipelineError =
              err instanceof PipelineError ? err : new PipelineError('UNKNOWN', String(err), {});
            errors.push(pipelineError.code);
            const effectKnownNotStarted =
              (pipelineError.diagnostic as { effectStarted?: unknown } | undefined)?.effectStarted ===
              false;
            const disposition = evaluateReplan({
              operationId,
              replanCount,
              toolName: tool.name,
              priorToolResults: toolResults,
              cause: projectPipelineError(pipelineError),
              sideEffect: tool.sideEffect ?? 'none',
              effectKnownNotStarted,
              caps: limits(),
            });
            if (disposition === 'terminate') {
              return failTurn('tool_failed', pipelineError.code);
            }
            if (disposition === 'replan') {
              replanCount++;
              machine.transitionTo('replanning', { toolName: tool.name, toolCall: toolCalls });
              recoveryObservation = {
                toolName: tool.name,
                executionStatus: 'failed',
                errorCode: pipelineError.code,
              };
              replanning = true;
              continue;
            }
            return await renderAndFinish(
              'partial',
              'tool_failed',
              { action: 'answer', reasonCode: 'tool_failed' },
              buildPolicyForRender({
                toolName: tool.name,
                toolCallId: 'unavailable',
                sideEffect: tool.sideEffect ?? 'none',
              }),
            );
          }

          toolResults.push(result);

          // ── verifying (required side effects only, D-10/D-11) ──
          if (tool.evidence?.required === true) {
            try {
              machine.transitionTo('verifying', { toolName: tool.name, toolCall: toolCalls });
              if (signal?.aborted) return abortTurn('verifying', 'caller_aborted');
              const evidenceRec = await outcomeVerifier.verify(result, tool, operationId, signal);
              if (signal?.aborted) return abortTurn('verifying', 'caller_aborted');
              evidence.push(evidenceRec);
              result.evidence = evidenceRec;
              try {
                executorService.attachEvidence(result.toolCallId, evidenceRec);
              } catch (err) {
                errors.push(err instanceof PipelineError ? err.code : 'UNKNOWN');
              }

              const disposition = evaluateReplan({
                operationId,
                replanCount,
                toolName: tool.name,
                toolCallId: result.toolCallId,
                priorToolResults: toolResults,
                sideEffect: tool.sideEffect ?? 'none',
                caps: limits(),
              });
              switch (disposition) {
                case 'continue-planning':
                  break;
                case 'replan': {
                  replanCount++;
                  machine.transitionTo('replanning', { toolName: tool.name, toolCall: toolCalls });
                  recoveryObservation = {
                    toolName: tool.name,
                    executionStatus: 'unverified',
                    evidenceSummary: summarizeEvidence(evidenceRec),
                  };
                  replanning = true;
                  continue;
                }
                case 'terminate':
                  return failTurn('verification_failed');
                case 'render': {
                  // The `render` disposition is reached both on cap
                  // exhaustion (rule 4 — loop cannot continue regardless of
                  // verification) and on unverified/unsatisfied evidence
                  // paths (rules 6/9). When the last evidence is verified,
                  // the truthful reason is a reached cap — labeling a
                  // verified write as `completion_unverified` would mislead
                  // downstream consumers (UI badges, telemetry, retry logic).
                  const last = toolResults[toolResults.length - 1];
                  const verified = last?.evidence?.verified === true;
                  return await renderAndFinish(
                    'partial',
                    verified ? 'tool_cap_reached' : 'completion_unverified',
                    {
                      action: 'answer',
                      reasonCode: verified ? 'tier_cap_reached' : 'completion_unverified',
                    },
                    buildPolicyForRender({
                      toolName: tool.name,
                      toolCallId: result.toolCallId,
                      sideEffect: tool.sideEffect ?? 'none',
                    }),
                  );
                }
              }
            } catch (err) {
              if (isAbortSignalOrError(err, signal)) return abortTurn('verifying', 'caller_aborted');
              const code = err instanceof PipelineError ? err.code : 'UNKNOWN';
              return failTurn('verification_failed', code);
            }
          }
          break;
        }
      }
    }
  }

  /**
   * @deprecated Compatibility wrapper — consumes the structured
   * AgentTurnOutcome and returns only the rendered answer text. New callers
   * must use runTurn() and inspect the outcome contract directly.
   */
  async runTurnText(input: AgentTurnInput): Promise<string> {
    const outcome = await this.runTurn(input);
    return outcome.renderedAnswer ?? '';
  }
}

export const agentOrchestrator = new AgentOrchestrator();
