import { providerRouter } from './ProviderRouter';
import { plannerService } from './PlannerService';
import { executorService } from './ExecutorService';
import { rendererService } from './RendererService';
import { PipelineError } from './PipelineError';
import { TierCapForTier } from './TierResolver';
import type { PipelineProviderId, ModelTier, PlannerContext, PlannerDecision, RegisteredTool } from './types';

interface ToolCallRecord {
  toolName: string;
  input: unknown;
  output: unknown;
  timestamp: number;
}

function dispatchError(error: unknown): string {
  if (error instanceof PipelineError) {
    return error.userFacingMessage;
  }
  return 'An unexpected error occurred. Please try again.';
}

export class AgentOrchestrator {
  async runTurn(
    providerId: PipelineProviderId,
    tier: ModelTier,
    context: PlannerContext,
  ): Promise<string> {
    const caps = TierCapForTier(tier);

    let { adapter } = await providerRouter.selectProvider(providerId);

    let stepCount = 0;
    const toolCallHistory: ToolCallRecord[] = [];

    while (stepCount < caps.planner) {
      stepCount++;

      const stepContext: PlannerContext = {
        ...context,
        toolCallHistory,
      };

      let decision: PlannerDecision;
      try {
        decision = await plannerService.plan(adapter, tier, stepContext);
      } catch (error) {
        return dispatchError(error);
      }

      switch (decision.action) {
        case 'answer':
          try {
            return await rendererService.synthesize(adapter, tier, decision, context);
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
              }, context);
            }

            let toolCount = 0;
            while (toolCount < caps.tool) {
              toolCount++;
              const tools = context.availableTools.map((t) => ({ ...t, execute: async () => null })) as RegisteredTool[];
              const result = await executorService.execute(
                decision.toolName,
                decision.input,
                tools,
                context.abortSignal,
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
    }, context);
  }
}

export const agentOrchestrator = new AgentOrchestrator();
