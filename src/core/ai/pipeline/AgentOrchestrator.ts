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
import type { OptimizedContext, PromptSection, ModelContextTier } from '../../context/contextTypes';
import { ContextTooLargeError } from '../../context/contextTypes';
import type { MemoryEngine } from '../../memory/MemoryEngine';

const TIER_CAP: Record<CostTierType, number> = {
  haiku: 1,
  flash: 2,
  sonnet: 3,
  opus: 5,
};

const MODEL_TIER_TO_COST_TIER: Record<ModelContextTier, CostTierType> = {
  tiny: 'haiku',
  small: 'flash',
  medium: 'sonnet',
  large: 'opus',
};

export class AgentOrchestrator {
  private currentAbortManager: AbortManager | null = null;

  private collectedToolResults: Array<unknown> = [];

  constructor(
    private planner: PlannerService,
    private executor: ExecutorService,
    private renderer: RendererService,
    private router: ProviderRouter,
    private memoryEngine: MemoryEngine,
  ) {}

  async *run(
    userMessage: string,
    systemPrompt: string,
    tier: CostTierType,
    preferredProviders: string[],
  ): AsyncGenerator<OrchestratorEvent> {
    const abortManager = new AbortManager();
    this.currentAbortManager = abortManager;
    const tierCap = TIER_CAP[tier];

    try {
      const toolResults: ToolExecutionResult[] = [];
      yield* this.executePlannerLoop(
        tier, preferredProviders, systemPrompt,
        this.buildPlannerPrompt(userMessage, []),
        abortManager, tierCap, toolResults,
      );

      yield* this.executeRenderer(
        'flash', preferredProviders, systemPrompt,
        userMessage, toolResults, abortManager,
      );
    } catch (err) {
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

  async *runWithContext(
    optimizedContext: OptimizedContext,
    preferredProviders: string[],
  ): AsyncGenerator<OrchestratorEvent> {
    const abortManager = new AbortManager();
    this.currentAbortManager = abortManager;
    const costTier = MODEL_TIER_TO_COST_TIER[optimizedContext.tier];
    const tierCap = TIER_CAP[costTier] || 1;
    this.collectedToolResults = [];

    try {
      yield* this.emitDegradationEvents(optimizedContext);

      const sections = optimizedContext.sections;
      const plannerSystemPrompt = this.joinSections(sections, ['system_prompt', 'task_instructions']);
      const plannerUserMessage = this.joinSections(sections, ['user_input', 'workspace_context', 'page_context', 'conversation_history']);
      const rendererUserMessage = this.joinSections(sections, ['user_input']);

      const toolResults: ToolExecutionResult[] = [];
      yield* this.executePlannerLoop(
        costTier, preferredProviders, plannerSystemPrompt,
        plannerUserMessage, abortManager, tierCap, toolResults,
      );

      yield* this.executeRenderer(
        'flash', preferredProviders, plannerSystemPrompt,
        rendererUserMessage, toolResults, abortManager,
      );
    } catch (err) {
      if (err instanceof ContextTooLargeError) {
        debugLog('info', '[AgentOrchestrator] Context too large', {
          estimatedTokens: err.estimatedTokens,
          budget: err.budget,
        });
        yield {
          type: 'context-error',
          code: 'CONTEXT_TOO_LARGE',
          estimatedTokens: err.estimatedTokens,
          budget: err.budget,
          message: err.message,
        };
      } else if (err instanceof DOMException && err.name === 'AbortError') {
        debugLog('info', '[AgentOrchestrator] Operation cancelled by user');
        yield { type: 'error', message: 'Operation cancelled' };
      } else {
        const message =
          err instanceof Error ? err.message : 'Unknown error in AgentOrchestrator';
        debugLog('error', '[AgentOrchestrator] runWithContext failed', { error: err });
        yield { type: 'error', message };
      }
    } finally {
      // D-02: Memory extraction triggered after renderer completes (post-execution)
      // D-03: Round-trip extraction — one extraction per user→assistant cycle
      // D-04: Fire-and-forget — NOT awaited, extraction failures don't block the user
      const conversationId = optimizedContext.provenance.operationId;
      const messages = this.collectRoundTripMessages(optimizedContext);
      const toolResults = this.collectedToolResults;

      this.memoryEngine.extract(conversationId, messages, toolResults)
        .catch(err => debugLog('error', '[AgentOrchestrator] Memory extraction failed', { error: err }));

      this.currentAbortManager = null;
    }
  }

  private async *emitDegradationEvents(
    optimizedContext: OptimizedContext,
  ): AsyncGenerator<OrchestratorEvent> {
    const steps = optimizedContext.provenance.degradationSteps;
    const tier = optimizedContext.tier;

    const hasMajorDegradation = steps.some((s) =>
      ['degradation_step_3', 'degradation_step_4', 'degradation_step_5', 'degradation_step_6'].includes(s),
    );
    if (hasMajorDegradation) {
      yield {
        type: 'context-degraded',
        level: 'info',
        message: 'Context degraded — history summarization, context compression, or memory reduction applied',
        step: 3,
        tier,
      };
    }

    if (optimizedContext.minimalMode) {
      yield {
        type: 'context-degraded',
        level: 'warning',
        message: 'Minimal mode activated — functionality restricted',
        tier,
      };
    }
  }

  private async *executePlannerLoop(
    tier: CostTierType,
    preferredProviders: string[],
    systemPrompt: string,
    userMessage: string,
    abortManager: AbortManager,
    tierCap: number,
    toolResults: ToolExecutionResult[],
  ): AsyncGenerator<OrchestratorEvent> {
    let plannerCalls = 0;

    while (plannerCalls < tierCap) {
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

      if (decision.action === 'answer' || decision.action === 'ask_clarification') {
        break;
      }

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
        this.collectedToolResults.push(result);
      }
    }
  }

  private async *executeRenderer(
    tier: CostTierType,
    preferredProviders: string[],
    systemPrompt: string,
    userMessage: string,
    toolResults: ToolExecutionResult[],
    abortManager: AbortManager,
  ): AsyncGenerator<OrchestratorEvent> {
    const rendererSignal = abortManager.createStageTimeout(
      DEFAULT_TIMEOUT_CONFIG.renderer,
    );

    const messages: Array<{ role: string; content: string }> = [
      { role: 'user', content: userMessage },
    ];
    if (toolResults.length > 0) {
      messages.push({
        role: 'user',
        content: 'Tool results: ' + JSON.stringify(toolResults),
      });
    }

    yield* this.renderer.render(
      tier,
      preferredProviders,
      systemPrompt,
      messages,
      rendererSignal,
    );
  }

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

  private joinSections(
    sections: PromptSection[],
    kinds: string[],
  ): string {
    return sections
      .filter((s) => kinds.includes(s.kind))
      .map((s) => s.content)
      .join('\n\n');
  }

  cancel(): void {
    this.currentAbortManager?.cancel('User cancelled');
  }

  private collectRoundTripMessages(optimizedContext: OptimizedContext): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = [];
    // Collect user message from sections
    const userInput = optimizedContext.sections.find(s => s.kind === 'user_input');
    if (userInput) {
      messages.push({ role: 'user', content: userInput.content });
    }
    // Collect conversation history from sections
    const history = optimizedContext.sections.find(s => s.kind === 'conversation_history');
    if (history) {
      // Parse history content (assumes newline-separated role:content format from ContextOptimizer)
      const lines = history.content.split('\n');
      for (const line of lines) {
        const match = line.match(/^(user|assistant):\s?(.*)/);
        if (match) {
          messages.push({ role: match[1], content: match[2] });
        }
      }
    }
    // Add tool results as assistant context
    if (this.collectedToolResults.length > 0) {
      messages.push({ role: 'assistant', content: `Tool results: ${JSON.stringify(this.collectedToolResults)}` });
    }
    return messages;
  }
}
