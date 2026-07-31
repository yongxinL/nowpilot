import { providerRouter } from './ProviderRouter';
import { plannerService } from './PlannerService';
import { executorService } from './ExecutorService';
import { rendererService } from './RendererService';
import { PipelineError } from './PipelineError';
import { TierCapForTier } from './TierResolver';
import { contextOptimizer } from '../context/ContextOptimizer';
import { KNOWN_MODEL_WINDOWS } from '../context/ModelContextTier';
import type {
  ContextOptimizerInput,
  PlannerDecision,
  RegisteredTool,
} from './types';
import type { AgentTurnInput } from './AgentTurnInput';

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
   * Runs one agent turn (D-01): ContextOptimizer.optimize() executes once
   * before the planner loop, and the resulting OptimizedContext is reused by
   * PlannerService and RendererService throughout the turn (D-02).
   */
  async runTurn(input: AgentTurnInput): Promise<string> {
    const { providerId, tier } = input;
    const caps = TierCapForTier(tier);

    const optimized = await contextOptimizer.optimize(buildOptimizerInput(input));

    let { adapter } = await providerRouter.selectProvider(providerId);

    let stepCount = 0;
    const toolCallHistory: ToolCallRecord[] = [];
    const tools = buildRegisteredTools(input);

    while (stepCount < caps.planner) {
      stepCount++;

      let decision: PlannerDecision;
      try {
        decision = await plannerService.plan(adapter, tier, optimized);
      } catch (error) {
        return dispatchError(error);
      }

      switch (decision.action) {
        case 'answer':
          try {
            return await rendererService.synthesize(adapter, tier, decision, optimized);
          } catch (error) {
            return dispatchError(error);
          }

        case 'ask_clarification':
          return decision.question;

        case 'run_tool': {
          try {
            if (stepCount >= caps.planner) {
              return await rendererService.synthesize(adapter, tier, {
                action: 'answer',
                reasonCode: 'tier_cap_reached',
              }, optimized);
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

    return await rendererService.synthesize(adapter, tier, {
      action: 'answer',
      reasonCode: 'tier_cap_reached',
    }, optimized);
  }
}

export const agentOrchestrator = new AgentOrchestrator();
