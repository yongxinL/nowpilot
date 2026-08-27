// AgentOrchestrator — Appendix I (PRODUCT_SPEC_v0_1.md:5567-5615), verbatim
// semantics: the bounded Planner → (run_tool → Executor) → Renderer loop that
// every AI call in the phase flows through (chat re-points at it in 03-07,
// D-44). This is the ONLY module that enforces the §1.4 tier caps
// (plannerCap/toolCap) and the only caller of the planner stage — Appendix I
// rule: "No component or hook may call PlannerService directly" (grep-asserted).
//
// Per-stage tier (D-55): the planner uses fast (§1.2), the renderer uses fast
// for the final answer stream, executor tool calls default to the turn's
// modelTier. Each stage resolves its tier through TierResolver FIRST — an
// unresolved tier (D-54a) yields the configuration-required outcome and NO
// provider request starts (no inference, no substitution, no guessing).
//
// Every stage system prompt is assembled by PromptCacheManager.buildSystemPrompt
// (D-59 single choke-point) — persona-consistent across planner/executor/
// renderer (RICH-R-09: chat and agent share the persona by construction).
//
// PERSIST SEAM (D-45): input.persistTurn fires exactly once after a completed
// turn (user message + assistant streamedText), never inside the delta path;
// an abort mid-stream drops the partial assistant message and the seam is NOT
// invoked.
import type { ILLMProvider } from './ILLMProvider';
import type { ModelTier, PlannerDecision, ToolExecutionResult } from './types';
import type { UserPreferences } from './UserPreferences';
import { PlannerService } from './PlannerService';
import { ExecutorService } from './ExecutorService';
import { RendererService } from './RendererService';
import { buildSystemPrompt } from './PromptCacheManager';
import { resolveTier } from './TierResolver';
import { route } from './ProviderRouter';
import { ProviderRegistry } from './ProviderRegistry';
import { ToolRegistry } from './toolSchemas';
import type { PipelineStage } from './persona/PersonaInjector';
import { debugLog } from '../log/debugLog';

/**
 * §1.4 Agent Step Limits — the tier-caps payload carried into the loop.
 *
 * The §1.4 table (tiny 1/1 · small 2/1 · medium 3/2 · large 5/3) is consumed
 * at the caller boundary; `modelTier` is the D-55 turn tier executor tool
 * calls default to. The loop enforces plannerCap + toolCap — no other module
 * may enforce caps (Appendix I).
 */
export interface AgentTier {
  /** §1.4 max planner calls per turn. */
  plannerCap: number;
  /** §1.4 max tool calls per turn. */
  toolCap: number;
  /** D-55: the turn's model tier — executor tool calls default to it. */
  modelTier: ModelTier;
}

/** D-45 turn-end persist payload — the completed user/assistant pair. */
export interface PersistTurnInput {
  userMessage: string;
  assistantMessage: string;
}

/** runAgentTurn input contract. */
export interface AgentTurnInput {
  /** The current user turn. */
  userInput: string;
  /** Phase-1 session correlation (03-07 np_active_stream + persist wiring). */
  sessionId: string;
  /** Phase-1 OperationId correlation (Flag C). */
  operationId: string;
  /** §1.4 tier caps + D-55 turn tier. */
  tier: AgentTier;
  /** Persona overrides + tier prefs (np_preferences) — feeds the D-59 choke-point. */
  prefs?: UserPreferences;
  /** Caller abort — the first check in the loop (Appendix I). */
  abortSignal: AbortSignal;
  /**
   * D-45 turn-end persist seam. Invoked exactly once after a completed turn
   * (user message + assistant streamedText); NEVER inside the delta path; an
   * abort mid-stream drops the partial and this is NOT invoked.
   */
  persistTurn?: (turn: PersistTurnInput) => void | Promise<void>;
}

/** runAgentTurn output contract. */
export interface AgentTurnOutput {
  /** The renderer's streamed answer ('' for the configuration-required outcome). */
  streamedText: string;
  /** Tool executions accumulated this turn (TOOL_REJECTED rejections included, D-46). */
  toolResults: ToolExecutionResult<unknown>[];
  /**
   * Terminal reason: the planner's answer reasonCode, 'ask_clarification',
   * 'planner_cap_reached', 'tool_cap_reached', or — when a stage tier is
   * unresolved (D-54a) — 'configuration_required'.
   */
  reasonCode: string;
}

/**
 * Run one agent turn — the Appendix I bounded loop (verbatim spec 5567-5615):
 *
 *   while (true) {
 *     check abort → throw AbortError
 *     check plannerCap → finish('planner_cap_reached')
 *     decision = the planner stage call (PlannerService, the ONLY call site)
 *     if answer | ask_clarification → finish(reasonCode)
 *     check toolCap → finish('tool_cap_reached')
 *     result = ExecutorService.execute(...)        // zero tools → TOOL_REJECTED (D-46)
 *     toolResults.push(result)
 *   }
 *   finish(reasonCode) → RendererService.render(...) → AgentTurnOutput (+ persist seam)
 *
 * Every stage resolves its tier via TierResolver first (D-55 mapping: planner
 * fast, renderer fast, executor → turn tier). An unresolved tier returns the
 * configuration-required outcome and starts NO provider request (D-54a).
 */
export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutput> {
  const toolResults: ToolExecutionResult<unknown>[] = [];
  let plannerCalls = 0;
  let toolCalls = 0;

  /**
   * D-59: assemble one stage's system prompt through the single choke-point.
   * The planner prompt carries the [USER INPUT] section (its request text has
   * no separate slot in PlannerInput); the renderer receives userInput via
   * its own message slot; the executor prompt is reserved (deterministic
   * stage, never sent to a model in Phase 3).
   */
  function stagePrompt(stage: PipelineStage, opts?: { withUserInput?: boolean }): string {
    return buildSystemPrompt(stage, {
      prefs: input.prefs,
      ...(opts?.withUserInput ? { userInput: input.userInput } : {}),
    })
      .sections.map((s) => s.text)
      .join('\n\n');
  }

  /**
   * D-54a/D-55: resolve one stage's tier and route to a live provider.
   * Returns null when the tier is unresolved — the caller surfaces the
   * configuration-required outcome and NO provider request has started.
   */
  async function resolveStageProvider(
    stageTier: ModelTier,
    systemPrompt: string,
  ): Promise<{ provider: ILLMProvider; model: string } | null> {
    const resolution = resolveTier(stageTier);
    if (resolution === null) {
      debugLog('TIER_UNRESOLVED', `configuration-required — ${stageTier} tier unresolved`, {
        operationId: input.operationId,
        sessionId: input.sessionId,
        tier: stageTier,
      });
      return null;
    }

    const candidates = ProviderRegistry.getEnabled();
    const routed = await route({
      operationId: input.operationId,
      tier: stageTier,
      systemPrompt,
      providerCandidates: candidates,
      // D-54a: only the resolved (providerId, model) pair is offered — a
      // candidate without a resolved model is skipped, never guessed.
      modelForProvider: (providerId) =>
        providerId === resolution.providerId ? resolution.model : undefined,
      abortSignal: input.abortSignal,
      allowCloudFallbackFromLocal: true,
    });
    if (!routed.ok) {
      if (input.abortSignal.aborted) throw new DOMException('aborted', 'AbortError');
      throw routed.error;
    }
    const provider = candidates.find((p) => p.providerId === routed.providerId);
    if (provider === undefined) {
      throw new Error(`routed provider ${routed.providerId} not found in enabled candidates`);
    }
    return { provider, model: resolution.model };
  }

  /**
   * finish — the Appendix I render + persist seam. Renders the final answer on
   * the fast tier, assembles the AgentTurnOutput, and (D-45) invokes the
   * persist seam exactly once for the completed turn. An abort mid-stream
   * throws AbortError — the partial is dropped and persistTurn is NOT invoked.
   */
  async function finish(
    reasonCode: string,
    clarification?: Extract<PlannerDecision, { action: 'ask_clarification' }>,
  ): Promise<AgentTurnOutput> {
    const rendererPrompt = stagePrompt('renderer');
    const stage = await resolveStageProvider('fast', rendererPrompt);
    if (stage === null) return configurationRequiredOutcome();

    const rendered = await RendererService.render({
      operationId: input.operationId,
      provider: stage.provider,
      model: stage.model,
      tier: 'fast',
      systemPrompt: rendererPrompt,
      // ask_clarification: the RICH-C-01 substrate — the focused question +
      // options surface as the user-side content the renderer answers.
      userInput: clarification
        ? `${clarification.question}\nOptions: ${clarification.options.join(', ')}`
        : input.userInput,
      abortSignal: input.abortSignal,
    });

    if (rendered.terminatedBy === 'aborted') {
      // D-45: abort mid-stream → the partial assistant message is dropped —
      // persistTurn is NOT invoked.
      throw new DOMException('aborted', 'AbortError');
    }

    const output: AgentTurnOutput = {
      streamedText: rendered.streamedText,
      toolResults,
      reasonCode,
    };
    if (input.persistTurn) {
      await input.persistTurn({
        userMessage: input.userInput,
        assistantMessage: output.streamedText,
      });
    }
    return output;
  }

  /**
   * D-54a outcome: a typed non-error AgentTurnOutput — no provider request
   * started. Identifier discovery rule: "configuration-required" is an
   * orchestrator OUTCOME, not an approved §21.6 error code — the spec and
   * repository expose no configuration-required identifier to reuse, so the
   * condition is represented with only the already-approved output fields and
   * this documented literal reasonCode. NO invented error-code constant is
   * exported (D-38); 03-07 matches the literal 'configuration_required'.
   */
  function configurationRequiredOutcome(): AgentTurnOutput {
    return {
      streamedText: '',
      toolResults,
      reasonCode: 'configuration_required',
    };
  }

  while (true) {
    if (input.abortSignal.aborted) throw new DOMException('aborted', 'AbortError');
    if (plannerCalls >= input.tier.plannerCap) return await finish('planner_cap_reached');
    plannerCalls += 1;

    // Planner stage — fast tier (D-55, §1.2). The ONLY planner call site in
    // the codebase (Appendix I rule; grep-asserted).
    const plannerPrompt = stagePrompt('planner', { withUserInput: true });
    const plannerStage = await resolveStageProvider('fast', plannerPrompt);
    if (plannerStage === null) return configurationRequiredOutcome();
    const decision = await PlannerService.plan({
      operationId: input.operationId,
      providerId: plannerStage.provider.providerId,
      model: plannerStage.model,
      prompt: plannerPrompt,
      toolNames: ToolRegistry.getAll().map((t) => t.name),
      callProviderJsonMode: (prompt, jsonSchema, signal) =>
        plannerStage.provider.requestJson(prompt, jsonSchema, signal),
      abortSignal: input.abortSignal,
    });
    debugLog('ORCHESTRATOR_PLAN', `planner decided ${decision.action}`, {
      operationId: input.operationId,
      sessionId: input.sessionId,
      plannerCall: plannerCalls,
    });

    if (decision.action === 'answer' || decision.action === 'ask_clarification') {
      return await finish(
        decision.action === 'answer' ? decision.reasonCode : 'ask_clarification',
        decision.action === 'ask_clarification' ? decision : undefined,
      );
    }
    if (toolCalls >= input.tier.toolCap) return await finish('tool_cap_reached');
    toolCalls += 1;

    // Executor stage — tool calls default to the turn's modelTier (D-55).
    // Phase 3 registers zero tools → every run_tool surfaces a typed
    // TOOL_REJECTED result and the loop continues (D-46).
    const executorPrompt = stagePrompt('executor');
    const executorStage = await resolveStageProvider(input.tier.modelTier, executorPrompt);
    if (executorStage === null) return configurationRequiredOutcome();
    const result = await ExecutorService.execute({
      operationId: input.operationId,
      toolName: decision.toolName,
      inputData: decision.input,
      systemPrompt: executorPrompt,
      provider: executorStage.provider.providerId,
      abortSignal: input.abortSignal,
    });
    toolResults.push(result);
    debugLog('ORCHESTRATOR_TOOL', `tool ${decision.toolName} → ${result.ok ? 'ok' : (result.code ?? 'failed')}`, {
      operationId: input.operationId,
      sessionId: input.sessionId,
      toolCall: toolCalls,
    });
  }
}