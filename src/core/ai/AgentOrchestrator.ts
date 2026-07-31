import { providerRouter } from './ProviderRouter';
import { plannerService } from './PlannerService';
import { executorService } from './ExecutorService';
import { rendererService } from './RendererService';
import { PipelineError } from './PipelineError';
import { TierCapForTier } from './TierResolver';
import { contextOptimizer } from '../context/ContextOptimizer';
import { promptCacheManager } from '../context/PromptCacheManager';
import { KNOWN_MODEL_WINDOWS } from '../context/ModelContextTier';
import type {
  ContextOptimizerInput,
  OptimizedContext,
  PipelineProviderId,
  PlannerDecision,
  RegisteredTool,
} from './types';
import type { AgentTurnInput } from './AgentTurnInput';
import type { CacheResponseMetadata } from './providers/ProviderAdapter';

interface ToolCallRecord {
  toolName: string;
  input: unknown;
  output: unknown;
  timestamp: number;
}

const DEFAULT_MODEL_CONTEXT_WINDOW = 128000;

function dispatchError(error: unknown): string {
  if (error instanceof PipelineError) {
    return error.userFacingMessage;
  }
  return 'An unexpected error occurred. Please try again.';
}

function buildOptimizerInput(input: AgentTurnInput): ContextOptimizerInput {
  return {
    operationId: input.operationId,
    model: input.model,
    modelContextWindow: KNOWN_MODEL_WINDOWS[input.model] ?? DEFAULT_MODEL_CONTEXT_WINDOW,
    userInput: input.userInput,
    conversationId: input.conversationId,
    workspaceId: input.workspaceId,
    activeSurface: input.activeSurface,
    pageContext: undefined,
    selectedToolSchemas: input.selectedToolSchemas,
    memoryHints: input.memoryHints,
    preferences: input.preferences,
  };
}

function buildRegisteredTools(input: AgentTurnInput): RegisteredTool[] {
  return input.selectedToolSchemas.map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: (t.jsonSchema ?? {}) as Record<string, unknown>,
    execute: async () => null,
  }));
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
    const cacheMetadata: CacheResponseMetadata = {
      providerId,
      cacheHit: false,
      cacheWrite: false,
    };
    promptCacheManager.recordResponse(cacheMetadata);
  }

  /**
   * Runs one agent turn (D-01): ContextOptimizer.optimize() executes once
   * before the planner loop, and the resulting OptimizedContext is reused by
   * PlannerService and RendererService throughout the turn (D-02).
   */
  async runTurn(input: AgentTurnInput): Promise<string> {
    const { providerId, tier } = input;
    const caps = TierCapForTier(tier);

    const optimized = await contextOptimizer.optimize(buildOptimizerInput(input));

    const selectedProvider = await providerRouter.selectProvider(providerId);
    let { adapter } = selectedProvider;

    // Prepare per-provider prompt cache hints (D-13). The provider is known
    // only after selection, so the per-provider cache hint transformation
    // (PromptCacheAdapter.applyCacheHints per Appendix K) runs here — the
    // ContextOptimizer's cacheMetadata is the provider-agnostic hash.
    const cacheResult = promptCacheManager.prepareCacheHints(
      selectedProvider.providerId,
      optimized.sections,
    );

    // Cache-annotated copy of OptimizedContext: cache-adapted sections carry
    // provider-specific cache annotations (Anthropic ephemeral breakpoints,
    // Gemini cachedContent ordering, etc.) while the original `optimized`
    // context is preserved for provenance. When the cache is disabled,
    // prepareCacheHints() returns the sections unchanged with
    // strategy='disabled' — the provider request path is identical either
    // way, with no conditional branching.
    const cacheOptimized: OptimizedContext = {
      ...optimized,
      sections: cacheResult.sections,
    };

    // Turn-scoped cache metadata (D-13): feeds Phase 6's AITransactionLog
    // PromptTrace.promptCache fields; logged here for debugging availability.
    console.debug('[AgentOrchestrator] prompt cache prepared', {
      providerId: selectedProvider.providerId,
      cacheKeyHash: cacheResult.cacheKeyHash,
      strategy: cacheResult.strategy,
    });

    let stepCount = 0;
    const toolCallHistory: ToolCallRecord[] = [];
    const tools = buildRegisteredTools(input);

    while (stepCount < caps.planner) {
      stepCount++;

      let decision: PlannerDecision;
      try {
        decision = await plannerService.plan(adapter, tier, cacheOptimized);
        this.recordCacheResponse(selectedProvider.providerId);
      } catch (error) {
        return dispatchError(error);
      }

      switch (decision.action) {
        case 'answer':
          try {
            const answer = await rendererService.synthesize(
              adapter,
              tier,
              decision,
              cacheOptimized,
            );
            this.recordCacheResponse(selectedProvider.providerId);
            return answer;
          } catch (error) {
            return dispatchError(error);
          }

        case 'ask_clarification':
          return decision.question;

        case 'run_tool': {
          try {
            if (stepCount >= caps.planner) {
              const answer = await rendererService.synthesize(adapter, tier, {
                action: 'answer',
                reasonCode: 'tier_cap_reached',
              }, cacheOptimized);
              this.recordCacheResponse(selectedProvider.providerId);
              return answer;
            }

            let toolCount = 0;
            while (toolCount < caps.tool) {
              toolCount++;
              const result = await executorService.execute(
                decision.toolName,
                decision.input,
                tools,
                input.abortSignal,
              );
              toolCallHistory.push({
                toolName: decision.toolName,
                input: decision.input,
                output: result.output,
                timestamp: Date.now(),
              });
              break;
            }
          } catch (error) {
            return dispatchError(error);
          }
          break;
        }
      }
    }

    const finalAnswer = await rendererService.synthesize(adapter, tier, {
      action: 'answer',
      reasonCode: 'tier_cap_reached',
    }, cacheOptimized);
    this.recordCacheResponse(selectedProvider.providerId);
    return finalAnswer;
  }
}

export const agentOrchestrator = new AgentOrchestrator();
