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
import { buildOutcome, guardMissingEvidence, VerifierRegistry, type Verifier } from './OutcomeVerifier';

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
   * is NOT invoked. The boundary catch (04-04) converts that caller-signal
   * AbortError into the returned 'aborted' outcome at the runAgentTurn edge;
   * the throw here is the mechanism the catch consumes, never a leak past it.
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
    } else if (trajectory.phase === 'replanning') {
      // AGT-04 (04-03): the loop-top cap check can fire while the machine is
      // parked in 'replanning' — a first failure just scheduled the replan
      // (policy continue), and the replan's planner call never happened
      // because the §1.4 plannerCap check fires first. 'replanning' →
      // 'planning' is the only legal forward edge into the render (closed
      // table, AGT-01); the cap outcome (partial/cap_exhausted) is still
      // built below.
      trajectory.enter('planning');
    }

    // AGT-02/03/04: the honest status/evidence are computed by buildOutcome
    // over the turn's tool results + the effective verifier set. The loop's
    // Phase-3 cap literals ('planner_cap_reached'/'tool_cap_reached') are
    // unified to the O.2 reasonCode 'cap_exhausted' here (AGT-03; the
    // 04-01/04-02 preservation comment is now moot — case (b) re-scripts to
    // 'cap_exhausted' in 04-03), while the computed status ('partial' on
    // capHit) and the evidence array are taken from buildOutcome verbatim.
    // AGT-04 policy terminals ('repeated_failure'/'replan_exhausted') are
    // FORCED to 'failed' below — never a silent success even though
    // buildOutcome (zero registered verifiers, D-64) would compute
    // 'completed'; capHit stays the ONLY path to 'partial'.
    const capHit = reasonCode === 'planner_cap_reached' || reasonCode === 'tool_cap_reached';
    const policyTerminal = reasonCode === 'repeated_failure' || reasonCode === 'replan_exhausted';
    const built = await buildOutcome(input.operationId, toolResults, effectiveVerifiers, {
      plannerCalls,
      toolCalls,
      capHit,
    });

    // D-65 (AGT-02 / risk R-8): the renderer completion guard — a
    // side-effecting tool result (ok === true with a registered verifier)
    // carrying NO CompletionEvidence must never produce a clean 'completed'
    // outcome ("never silently claims success", golden rule 8). The override
    // is UNCONDITIONAL after buildOutcome (research A5 ordering): it wins over
    // buildOutcome's 'completed'/'failed' status even when the registered
    // verifier itself passed (D-65) — the executor skipped the postcondition
    // verification the verifier implies. With zero verifiers registered
    // (D-64) the guard is vacuous in production; it fires only for injected
    // fixtures (D-67).
    const guardMissing = guardMissingEvidence(toolResults, effectiveVerifiers);
    if (guardMissing) {
      debugLog(
        'ORCHESTRATOR_GUARD_MISSING_EVIDENCE',
        'side-effecting tool result without CompletionEvidence — outcome downgraded to partial',
        {
          operationId: input.operationId,
          toolNames: toolResults
            .filter(
              (r) => r.ok === true && effectiveVerifiers[r.toolName] !== undefined && r.evidence === undefined,
            )
            .map((r) => r.toolName),
          reasonCode: 'missing_evidence',
        },
      );
    }

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

    // AGT-04 (04-03): the effective outcome status — the policy terminals
    // ('repeated_failure'/'replan_exhausted') are FORCED 'failed' (never a
    // silent success, T-4-09); capHit stays the ONLY path to 'partial'
    // (AGT-03); otherwise buildOutcome's honest status stands. The D-65
    // guard downgrade remains the unconditional final word (04-02 ordering).
    const effectiveStatus: AgentTurnOutcome['status'] = guardMissing
      ? 'partial'
      : policyTerminal
        ? 'failed'
        : built.status;
    // The cap literals unify to the O.2 reasonCode 'cap_exhausted' (AGT-03).
    const effectiveReasonCode = guardMissing ? 'missing_evidence' : capHit ? 'cap_exhausted' : reasonCode;

    // D-61: the terminal trajectory phase matches the outcome status — the
    // legal edges out of 'rendering' are exactly completed/failed/aborted.
    trajectory.enter(effectiveStatus === 'failed' ? 'failed' : 'completed');

    const output: AgentTurnOutcome = {
      operationId: input.operationId,
      // AGT-04/03: the effective status above IS the final word — the policy
      // terminals force 'failed', the cap forces 'partial'/'cap_exhausted',
      // the guard downgrade wins when it fires (D-65 ordering).
      status: effectiveStatus,
      reasonCode: effectiveReasonCode,
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

  // AGT-04 (04-03): per-turn replan policy state — failureIdentities keys
  // toolName → the stable failure identity already seen for that tool;
  // replannedTools tracks which tools already consumed their single replan
  // budget (≤1 replan per failed tool, T-4-07). Loop-scoped: one turn's
  // replan budget never leaks into the next turn.
  const failureIdentities = new Map<string, string>();
  const replannedTools = new Set<string>();

  // Q1/A4 (04-04): the boundary AbortError conversion — the caller-signal
  // abort (Stop button) is caught HERE, at the runAgentTurn edge, and returned
  // as the 'aborted' AgentTurnOutcome instead of being thrown past the
  // boundary (AGT-03/AGT-04 DONE-when: "abort produces aborted"). D-45: the
  // partial is dropped — persistTurn is NEVER invoked on this path (the persist
  // seam lives inside finish(), which an aborted turn never reaches). Only
  // DOMException('aborted','AbortError') converts (T-4-11); ProviderError
  // (CR-06) and routed errors rethrow unchanged.
  try {
    while (true) {
      if (input.abortSignal.aborted) throw new DOMException('aborted', 'AbortError');
      if (plannerCalls >= input.tier.plannerCap) return await finish('planner_cap_reached');
      // D-63: after a tool execution the machine cycles through 'replanning' —
      // executing → replanning is the ONLY forward edge out of 'executing' in
      // the closed table, and the next planner call re-plans with the tool
      // result in context. AGT-04 (04-03): the policy enters 'replanning'
      // itself on a first failure (and continues), so this loop-top hook only
      // fires for successful tool results — never a double entry
      // ('replanning' → 'replanning' is illegal, AGT-01).
      if (toolResults.length > 0 && trajectory.phase !== 'replanning') trajectory.enter('replanning');
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
      // AGT-04 (04-03): deterministic replan/terminal policy — at most one
      // replan per failed tool. Stable failure identity = §21.6 code when
      // present (e.g. TOOL_REJECTED), the error string ONLY as fallback
      // (Pitfall 7 — never key on the raw message alone when a code exists;
      // T-4-08: a provider rewording the message cannot reset the identity).
      const identity = result.code ?? (result.error ?? 'ERROR');
      if (!result.ok) {
        if (failureIdentities.get(result.toolName) === identity) {
          // REPEATED IDENTICAL FAILURE → terminal 'failed' (AGT-04; T-4-09 —
          // never a silent retry loop).
          debugLog('ORCHESTRATOR_TERMINAL_REPEATED_FAILURE', `repeated identical failure for ${result.toolName} — terminal failed`, {
            operationId: input.operationId,
            toolName: result.toolName,
            identity,
            plannerCalls,
            toolCalls,
          });
          return await finish('repeated_failure');
        }
        if (replannedTools.has(result.toolName)) {
          // REPLAN BUDGET CONSUMED (≤1 per tool) → terminal 'failed' (AGT-04).
          debugLog('ORCHESTRATOR_TERMINAL_REPLAN_EXHAUSTED', `replan budget consumed for ${result.toolName} — terminal failed`, {
            operationId: input.operationId,
            toolName: result.toolName,
            identity,
            plannerCalls,
            toolCalls,
          });
          return await finish('replan_exhausted');
        }
        // FIRST failure for this tool: record the stable identity, consume the
        // tool's single replan budget, enter the 'replanning' trajectory phase
        // (validated against the closed table, AGT-01) — the NEXT planner call
        // IS the single replan (§1.6.1 layer 2 of 3; the loop-top plannerCap
        // check stays authoritative).
        failureIdentities.set(result.toolName, identity);
        replannedTools.add(result.toolName);
        trajectory.enter('replanning');
        debugLog('ORCHESTRATOR_REPLAN', `tool ${result.toolName} failed — one replan scheduled`, {
          operationId: input.operationId,
          toolName: result.toolName,
          identity,
          plannerCalls,
          toolCalls,
        });
        continue;
      }
      debugLog('ORCHESTRATOR_TOOL', `tool ${decision.toolName} → ${result.ok ? 'ok' : (result.code ?? 'failed')}`, {
        operationId: input.operationId,
        sessionId: input.sessionId,
        toolCall: toolCalls,
        trajectoryPhase: trajectory.phase,
      });
    }
  } catch (err) {
    // Q1/A4 (04-04): the single conversion point — only the caller-signal
    // abort converts to the returned outcome. Every other error (ProviderError
    // from the CR-06 renderer path, routed provider errors, internal failures)
    // rethrows unchanged — an internal failure can never masquerade as a user
    // abort (T-4-11).
    if (err instanceof DOMException && err.name === 'AbortError') {
      debugLog('ORCHESTRATOR_ABORTED', 'caller abort — returning aborted outcome; partial dropped (D-45)', {
        operationId: input.operationId,
        plannerCalls,
        toolCalls,
      });
      // D-63: the terminal 'aborted' phase — legal from every non-terminal row
      // of the closed table (AGT-01): a pre-aborted signal exits
      // 'assembling-context' (the amended [planning, aborted] row), a
      // renderer abort exits 'rendering' ([completed, failed, aborted]), and
      // the mid-loop aborts exit 'planning'/'executing'/'replanning'/'verifying'.
      trajectory.enter('aborted');
      return {
        operationId: input.operationId,
        // C.1 status 'aborted' — the status value doubles as the descriptive
        // reasonCode (D-38: no invented §21.6 code; 'aborted' is the C.1
        // status, not an error code).
        status: 'aborted',
        reasonCode: 'aborted',
        evidence: [],
        plannerCalls,
        toolCalls,
        // D-45: the partial assistant message is dropped — streamedText is
        // never carried out of an aborted turn.
        streamedText: '',
        toolResults,
        trajectory: trajectory.snapshot(plannerCalls, toolCalls),
      };
    }
    throw err;
  }
}