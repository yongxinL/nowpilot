import { debugLog } from '../../utils/debugLog';
import { AbortManager } from '../streaming/AbortManager';
import { DEFAULT_TIMEOUT_CONFIG } from '../streaming/TimeoutConfig';
import type { PlannerService } from './PlannerService';
import type { ExecutorService } from './ExecutorService';
import type { RendererService } from './RendererService';
import type { ProviderRouter } from '../router/ProviderRouter';
import type { OrchestratorEvent, ToolExecutionResult } from './pipelineTypes';
import type { PlannerDecisionType } from './pipelineTypes';
import type { CostTierType } from '../providers/providerTypes';

/**
 * Maps a CostTierType to the maximum number of Planner calls allowed.
 *
 * haiku → 1  (cheapest/fastest — minimal iterations)
 * flash → 2
 * sonnet → 3
 * opus → 5   (most capable — more iterations to extract value)
 */
const TIER_CAP: Record<CostTierType, number> = {
  haiku: 1,
  flash: 2,
  sonnet: 3,
  opus: 5,
};

/**
 * Top-level pipeline coordinator.
 *
 * Loops Planner→Executor until the Planner returns 'answer' (or the tier cap
 * is reached), then delegates to the Renderer for streaming the final response.
 *
 * @see D-05 Sequential stages
 * @see D-06 Unified event stream
 * @see D-17 Parent + child AbortSignal model
 */
export class AgentOrchestrator {
  /**
   * Tracks the active AbortManager for the current `run()` invocation.
   * Used by `cancel()` to abort an in-flight operation.
   */
  private currentAbortManager: AbortManager | null = null;

  constructor(
    private planner: PlannerService,
    private executor: ExecutorService,
    private renderer: RendererService,
    private router: ProviderRouter,
  ) {}

  /**
   * Run a full Planner→Executor→Renderer pipeline for a single user message.
   *
   * Yields a typed event stream that consumers (Chat UI, Agent page) iterate
   * over via `for await`.
   *
   * @param userMessage - The user's input text
   * @param systemPrompt - The system instruction for the AI
   * @param tier - Which cost tier to use (determines model selection + cap)
   * @param preferredProviders - Ordered list of provider IDs to prefer
   */
  async *run(
    userMessage: string,
    systemPrompt: string,
    tier: CostTierType,
    preferredProviders: string[],
  ): AsyncGenerator<OrchestratorEvent> {
    // 1. Create operation-scoped AbortManager (D-17)
    const abortManager = new AbortManager();
    this.currentAbortManager = abortManager;
    const tierCap = TIER_CAP[tier];
    let plannerCalls = 0;
    const toolResults: ToolExecutionResult[] = [];

    try {
      // 2. Planner→Executor loop (D-05)
      while (plannerCalls < tierCap) {
        // Planner stage timeout (D-19: 3s)
        const plannerSignal = abortManager.createStageTimeout(
          DEFAULT_TIMEOUT_CONFIG.planner,
        );

        const decision: PlannerDecisionType = await this.planner.plan(
          tier,
          preferredProviders,
          systemPrompt,
          this.buildPlannerPrompt(userMessage, toolResults),
          plannerSignal,
        );

        plannerCalls++;
        yield { type: 'plan-created', decision };

        // Handle terminal decisions
        if (decision.action === 'answer' || decision.action === 'ask_clarification') {
          break;
        }

        // Handle tool execution (D-05: Executor is deterministic, no LLM)
        if (decision.action === 'run_tool' && decision.toolName) {
          const toolSignal = abortManager.createStageTimeout(
            DEFAULT_TIMEOUT_CONFIG.executorTool,
          );

          yield {
            type: 'tool-called',
            toolName: decision.toolName,
            input: decision.toolInput,
          };

          const result = await this.executor.execute(
            decision.toolName,
            decision.toolInput ?? {},
            toolSignal,
          );

          yield {
            type: 'tool-result',
            toolName: decision.toolName,
            result,
          };

          toolResults.push(result);
        }
      }

      // 3. Renderer phase — stream final response (D-06)
      const rendererSignal = abortManager.createStageTimeout(
        DEFAULT_TIMEOUT_CONFIG.renderer,
      );

      // Build messages array for the renderer
      const messages: Array<{ role: string; content: string }> = [
        { role: 'user', content: userMessage },
      ];
      if (toolResults.length > 0) {
        messages.push({
          role: 'user',
          content: 'Tool results: ' + JSON.stringify(toolResults),
        });
      }

      for await (const event of this.renderer.render(
        'flash',
        preferredProviders,
        systemPrompt,
        messages,
        rendererSignal,
      )) {
        yield event;
      }
    } catch (err) {
      // 4. Error handling (D-18 staged recovery)
      if (err instanceof DOMException && err.name === 'AbortError') {
        debugLog('info', '[AgentOrchestrator] Operation cancelled by user');
        yield { type: 'error', message: 'Operation cancelled' };
      } else {
        const message =
          err instanceof Error ? err.message : 'Unknown error in AgentOrchestrator';
        debugLog('error', '[AgentOrchestrator] Operation failed', { error: err });
        yield { type: 'error', message };
      }
    } finally {
      this.currentAbortManager = null;
    }
  }

  /**
   * Build the prompt sent to the Planner, optionally including tool results
   * from previous loop iterations.
   */
  private buildPlannerPrompt(
    userMessage: string,
    toolResults: ToolExecutionResult[],
  ): string {
    if (toolResults.length === 0) {
      return userMessage;
    }
    return (
      userMessage +
      '\n\nPrevious tool results:\n' +
      JSON.stringify(toolResults)
    );
  }

  /**
   * Cancel the current operation (if any).
   * Safe to call when no operation is running — it is a no-op.
   */
  cancel(): void {
    this.currentAbortManager?.cancel('User cancelled');
  }
}
