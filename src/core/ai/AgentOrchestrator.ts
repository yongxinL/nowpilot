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
import type { ModelTier, PlannerDecision, ProviderId, ToolExecutionResult } from './types';
import type { UserPreferences } from './UserPreferences';
import { PlannerService } from './PlannerService';
import { ExecutorService } from './ExecutorService';
import { RendererService } from './RendererService';
import { buildSystemPrompt } from './PromptCacheManager';
import { resolveTier } from './TierResolver';
import { route } from './ProviderRouter';
import { ProviderRegistry } from './ProviderRegistry';
import { ProviderError } from './providers/base';
import { ToolRegistry } from './toolSchemas';
import type { PipelineStage } from './persona/PersonaInjector';
import { debugLog } from '../log/debugLog';
import type { AgentTurnOutcome as C1AgentTurnOutcome, AgentTrajectoryState } from '@/types/harness';
import { TrajectoryTracker } from './trajectory';
import { buildOutcome, VerifierRegistry, type Verifier } from './OutcomeVerifier';

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
  /**
   * CR-01: decrypted operator keys per provider, supplied by the chat hook
   * (useExtensionStore hydrates them at boot). The registry keeps
   * EncryptedBlobs opaque (V6) — per-route provider instances are built from
   * these keys + the merged endpoint + the resolved model.
   */
  providerSecrets?: Readonly<Partial<Record<ProviderId, string>>>;
  /** Caller abort — the first check in the loop (Appendix I). */
  abortSignal: AbortSignal;
  /**
   * D-45 turn-end persist seam. Invoked exactly once after a completed turn
   * (user message + assistant streamedText); NEVER inside the delta path; an
   * abort mid-stream drops the partial and this is NOT invoked.
   */
  persistTurn?: (turn: PersistTurnInput) => void | Promise<void>;
  /**
   * D-64/D-67 test-injection seam (mirrors providerSecrets): the effective
   * verifier set fed to buildOutcome is `{ ...VerifierRegistry.getAll(),
   * ...input.verifiers }`. Production registers ZERO verifiers in Phase 4
   * (D-64) — the override exists so the AGT-02 guard / postcondition paths
   * are exercised by injected fixtures, never fake tool registrations.
   */
  verifiers?: Record<string, Verifier>;
}

/**
 * runAgentTurn output contract — D-61 additive evolution of the Phase-3
 * AgentTurnOutput: the C.1 AgentTurnOutcome (harness.ts) extended with the
 * Phase-3 consumer fields (streamedText/toolResults) plus the D-63 trajectory
 * snapshot. Consumers keep reading streamedText/reasonCode unchanged
 * (useChatStreaming); status / evidence / counters are the new reliability
 * surface (AGT-03); operationId is re-threaded from input.operationId
 * (Pitfall 8 — the Phase-3 shape dropped it).
 */
export interface AgentTurnOutcome extends C1AgentTurnOutcome {
  /** The renderer's streamed answer ('' for the configuration-required outcome). */
  streamedText: string;
  /** Tool executions accumulated this turn (TOOL_REJECTED rejections included, D-46). */
  toolResults: ToolExecutionResult<unknown>[];
  /** D-63 per-turn trajectory snapshot (in-memory; AITransactionLog is Phase 11). */
  trajectory: AgentTrajectoryState;
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
 *   finish(reasonCode) → buildOutcome (status/evidence) + RendererService.render(...)
 *     → AgentTurnOutcome (+ persist seam)
 *
 * Every stage resolves its tier via TierResolver first (D-55 mapping: planner
 * fast, renderer fast, executor → turn tier). An unresolved tier returns the
 * configuration-required outcome and starts NO provider request (D-54a).
 *
 * D-62/63: a per-turn TrajectoryTracker is instantiated here (before the loop)
 * and snapshotted in finish() — the trajectory spans the whole turn, is
 * asserted against the closed TRAJECTORY_TRANSITIONS table (AGT-01), and is
 * never persisted (AITransactionLog is Phase 11).
 */
export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutcome> {
  const toolResults: ToolExecutionResult<unknown>[] = [];
  let plannerCalls = 0;
  let toolCalls = 0;
  // D-63: the per-turn trajectory tracker — spans the whole turn, snapshotted
  // in finish(), never constructed there. In-memory only (D-63).
  const trajectory = new TrajectoryTracker(input.operationId);
  // D-64: effective verifier set = registry (empty in Phase 4) + the input
  // override — the D-67 test-injection seam (mirrors providerSecrets).
  const effectiveVerifiers: Record<string, Verifier> = {
    ...VerifierRegistry.getAll(),
    ...(input.verifiers ?? {}),
  };

  /**
   * D-59: assemble one stage's system prompt through the single choke-point.
   * The planner prompt carries the [USER INPUT] section (its request text has
   * no separate slot in PlannerInput); the renderer receives userInput via
   * its own message slot; the executor prompt is reserved (deterministic
   * stage, never sent to a model in Phase 3).
   *
   * WR-03 (documented deferral): sections are flattened to the single string
   * the provider request body requires. `applyCacheHints(providerId,
   * sections)` (Anthropic cache_control / Gemini cachedContent) and
   * `recordCacheResult` therefore have no production call site in Phase 3 —
   * per-provider prompt-cache wiring is deferred to the phase that restructures
   * provider request bodies around the section metadata (the flattened string
   * loses the section boundaries the hints require).
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
   * CR-01: the decrypted key for one provider — caller-supplied plaintext
   * first (V6: the registry keeps EncryptedBlobs opaque), legacy plaintext
   * from the normalized map as the fallback.
   */
  function routeApiKey(providerId: ProviderId): string | undefined {
    const supplied = input.providerSecrets?.[providerId];
    if (supplied !== undefined && supplied.length > 0) return supplied;
    const stored = ProviderRegistry.getById(providerId)?.apiKey;
    return typeof stored === 'string' && stored.length > 0 ? stored : undefined;
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

    // CR-01: the module-load singletons carry no apiKey/model — every runtime
    // request flows through a per-route instance built from the merged
    // endpoint (D-50) + decrypted key + resolved model.
    const candidates: ILLMProvider[] = [];
    for (const entry of ProviderRegistry.getAll()) {
      if (!entry.enabled || entry.provider === undefined) continue;
      const instance = ProviderRegistry.buildForRoute(entry.id, {
        model: resolution.model,
        apiKey: routeApiKey(entry.id),
      });
      if (instance !== undefined) candidates.push(instance);
    }
    if (candidates.length === 0) {
      debugLog('TIER_UNRESOLVED', `configuration-required — no enabled provider for ${stageTier} tier`, {
        operationId: input.operationId,
        sessionId: input.sessionId,
        tier: stageTier,
      });
      return null;
    }

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
   * finish — the Appendix I render + persist seam, now producing the honest
   * AgentTurnOutcome. Computes status/evidence via buildOutcome (O.2) with the
   * turn's tier-cap state, renders the final answer on the fast tier, and
   * (D-45) invokes the persist seam exactly once for the completed turn. An
   * abort mid-stream throws AbortError — the partial is dropped and persistTurn
   * is NOT invoked (abort contract unchanged this plan; the returned 'aborted'
   * outcome lands in 04-04).
   *
   * Trajectory (D-63): turns that just executed a tool enter 'verifying'
   * (executing → verifying is the closed table's only edge into it); the
   * cap-0-at-turn-start edge (plannerCap 0) is normalized through 'planning'
   * (the only legal forward edge out of 'assembling-context'); direct-answer /
   * clarification / tool-cap paths enter 'rendering' directly from 'planning'.
   * The terminal phase matches the outcome status ('completed' for completed
   * AND partial turns — the loop completed its rendering; the 'partial'
   * honesty lives on the outcome status — 'failed' for terminal failures).
   */
  async function finish(
    reasonCode: string,
    clarification?: Extract<PlannerDecision, { action: 'ask_clarification' }>,
  ): Promise<AgentTurnOutcome> {
    // D-63: normalize the machine onto a legal forward edge before the
    // outcome is built.
    if (trajectory.phase === 'executing') {
      trajectory.enter('verifying');
    } else if (trajectory.phase === 'assembling-context') {
      trajectory.enter('planning');
    }

    // AGT-02/03: the honest status/evidence are computed by buildOutcome over
    // the turn's tool results + the effective verifier set. The loop's
    // Phase-3 reasonCode literal is PRESERVED on the outcome (AGT-03; the O.2
    // 'cap_exhausted' reasonCode unification is deferred to 04-03's re-script
    // of case (b)), while the computed status ('partial' on capHit) and the
    // evidence array are taken from buildOutcome verbatim.
    const capHit = reasonCode === 'planner_cap_reached' || reasonCode === 'tool_cap_reached';
    const built = await buildOutcome(input.operationId, toolResults, effectiveVerifiers, {
      plannerCalls,
      toolCalls,
      capHit,
    });

    const rendererPrompt = stagePrompt('renderer');
    const stage = await resolveStageProvider('fast', rendererPrompt);
    if (stage === null) return configurationRequiredOutcome();

    trajectory.enter('rendering');
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
    if (rendered.terminatedBy === 'error') {
      // CR-06: a mid-stream STREAM_ERROR (partial answer, no terminator)
      // must NOT be persisted as a completed turn. Surface a typed error so
      // the caller reports the failure; the partial is dropped (D-45).
      throw new ProviderError(
        rendered.error?.code ?? 'NETWORK',
        rendered.error?.message ?? 'renderer stream failed before completion',
      );
    }

    // D-61: the terminal trajectory phase matches the outcome status — the
    // legal edges out of 'rendering' are exactly completed/failed/aborted.
    trajectory.enter(built.status === 'failed' ? 'failed' : 'completed');

    const output: AgentTurnOutcome = {
      operationId: input.operationId,
      status: built.status,
      reasonCode,
      evidence: built.evidence,
      plannerCalls,
      toolCalls,
      streamedText: rendered.streamedText,
      toolResults,
      trajectory: trajectory.snapshot(plannerCalls, toolCalls),
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
   * D-54a outcome: a typed non-error AgentTurnOutcome — no provider request
   * started. Identifier discovery rule: "configuration-required" is an
   * orchestrator OUTCOME, not an approved §21.6 error code — the spec and
   * repository expose no configuration-required identifier to reuse, so the
   * condition is represented with only the already-approved output fields and
   * this documented literal reasonCode. NO invented error-code constant is
   * exported (D-38); 03-07 matches the literal 'configuration_required'.
   *
   * A3 mapping: no output was produced → status 'failed' is the honest
   * terminal; the trajectory enters the matching terminal phase (legal from
   * every phase this helper is reached at — planning / executing / verifying).
   */
  function configurationRequiredOutcome(): AgentTurnOutcome {
    trajectory.enter('failed');
    return {
      operationId: input.operationId,
      status: 'failed',
      reasonCode: 'configuration_required',
      evidence: [],
      plannerCalls,
      toolCalls,
      streamedText: '',
      toolResults,
      trajectory: trajectory.snapshot(plannerCalls, toolCalls),
    };
  }

  while (true) {
    if (input.abortSignal.aborted) throw new DOMException('aborted', 'AbortError');
    if (plannerCalls >= input.tier.plannerCap) return await finish('planner_cap_reached');
    // D-63: after a tool execution the machine cycles through 'replanning' —
    // executing → replanning is the ONLY forward edge out of 'executing' in
    // the closed table, and the next planner call re-plans with the tool
    // result in context (AGT-04's repeated-identity refinement is plan 04-03).
    if (toolResults.length > 0) trajectory.enter('replanning');
    plannerCalls += 1;

    // D-63: the planning phase precedes the planner stage (the planner is
    // resolved and called here — the ONLY planner call site in the codebase).
    trajectory.enter('planning');
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
      trajectoryPhase: trajectory.phase,
    });

    if (decision.action === 'answer' || decision.action === 'ask_clarification') {
      return await finish(
        decision.action === 'answer' ? decision.reasonCode : 'ask_clarification',
        decision.action === 'ask_clarification' ? decision : undefined,
      );
    }
    if (toolCalls >= input.tier.toolCap) return await finish('tool_cap_reached');
    toolCalls += 1;

    // D-63: the executing phase precedes the executor stage — tool calls
    // default to the turn's modelTier (D-55). Phase 3 registers zero tools →
    // every run_tool surfaces a typed TOOL_REJECTED result and the loop
    // continues (D-46).
    trajectory.enter('executing');
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
      trajectoryPhase: trajectory.phase,
    });
  }
}