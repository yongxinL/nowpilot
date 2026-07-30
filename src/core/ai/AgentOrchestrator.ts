import { providerRouter } from './ProviderRouter';
import { plannerService } from './PlannerService';
import { executorService } from './ExecutorService';
import { rendererService } from './RendererService';
import { PipelineError } from './PipelineError';
import type { PipelineProviderId, ModelTier, PlannerContext, RegisteredTool } from './types';

export class AgentOrchestrator {
  async runTurn(
    providerId: PipelineProviderId,
    tier: ModelTier,
    context: PlannerContext,
  ): Promise<string> {
    try {
      const adapter = await providerRouter.selectProvider(providerId);
      const decision = await plannerService.plan(adapter, tier, context);

      switch (decision.action) {
        case 'answer':
          return rendererService.synthesize(adapter, tier, decision, context);

        case 'run_tool': {
          const tools: RegisteredTool[] = context.availableTools.map((t) => ({
            ...t,
            execute: async () => null,
          }));
          await executorService.execute(decision.toolName, decision.input, tools, context.abortSignal);
          return 'Tool execution not yet supported. Full tool loop will be available in a future update.';
        }

        case 'ask_clarification':
          return decision.question;

        default:
          throw new PipelineError('UNKNOWN', 'Unexpected planner decision.', { decision });
      }
    } catch (err) {
      if (err instanceof PipelineError) throw err;
      throw new PipelineError('UNKNOWN', 'An unexpected error occurred in the AI pipeline.', {
        originalError: String(err),
      });
    }
  }
}

export const agentOrchestrator = new AgentOrchestrator();
