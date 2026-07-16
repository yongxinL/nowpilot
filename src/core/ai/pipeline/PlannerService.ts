import { generateText } from 'ai';
import { debugLog } from '../../utils/debugLog';
import type { ProviderRouter } from '../router/ProviderRouter';
import type { CostTierType } from '../providers/providerTypes';
import type { PlannerDecisionType } from './pipelineTypes';
import { PlannerDecision } from './pipelineTypes';
import { repairAndValidate } from './StructuredOutput';
import type { ExecutionContext } from '../../telemetry/types';

const PLANNER_FALLBACK: PlannerDecisionType = {
  action: 'answer',
  reasoning: 'Planner output was unparseable',
};

const SYSTEM_PROMPT_SUFFIX =
  'Respond with a JSON object containing: action (answer|run_tool|ask_clarification), reasoning (string), toolName (string, optional), toolInput (object, optional). Do not include any text outside the JSON.';

export class PlannerService {
  constructor(private router: ProviderRouter) {}

  async plan(
    tier: CostTierType,
    preferredProviders: string[],
    systemPrompt: string,
    userMessage: string,
    abortSignal: AbortSignal,
    execCtx?: ExecutionContext,
    modelId?: string,
  ): Promise<PlannerDecisionType> {
    try {
      const model = await this.router.selectModel(tier, preferredProviders, execCtx, modelId);
      if (!model) {
        debugLog('warn', '[PlannerService] No model available — returning fallback');
        return { action: 'answer', reasoning: 'No model available for planning' };
      }

      const fullSystemPrompt = `${systemPrompt}\n\n${SYSTEM_PROMPT_SUFFIX}`;

      const result = await generateText({
        model: model.instance as Parameters<typeof generateText>[0]['model'],
        system: fullSystemPrompt,
        prompt: userMessage,
        abortSignal,
      });

      // Emit planner call trace event (D-05)
      execCtx?.traceCollector.onPlannerCall({
        promptHash: simpleHash(systemPrompt + userMessage),
        tokenBreakdown: {
          system: Math.ceil(fullSystemPrompt.length / 4),
          memory: 0,
          tools: 0,
          context: 0,
          history: 0,
          user: Math.ceil(userMessage.length / 4),
          output: result.usage ? Math.ceil(result.usage.completionTokens ?? 0) : 0,
          total: result.usage ? Math.ceil(result.usage.totalTokens ?? 0) : Math.ceil((fullSystemPrompt.length + userMessage.length) / 4),
        },
        contextTier: tier as any,
        truncated: false,
        minimalMode: false,
        cacheStats: { sectionsMarked: 0, estimatedSavings: 0 },
        timestamp: Date.now(),
        source: 'planner' as const,
      });

      const validated = repairAndValidate(result.text, PlannerDecision, PLANNER_FALLBACK);

      if ('result' in validated) {
        return validated.result;
      }

      debugLog('warn', '[PlannerService] Using fallback decision');
      return validated.fallback;
    } catch (err) {
      const isTimeout = err instanceof DOMException && (err.name === 'AbortError' || err.name === 'TimeoutError');
      if (isTimeout) {
        debugLog('warn', '[PlannerService] plan timed out — returning fallback');
        return { action: 'answer', reasoning: 'Planning timed out, answering directly' };
      }
      const errorMsg = err instanceof Error ? err.message : JSON.stringify(err);
      debugLog('error', '[PlannerService] plan failed', { error: errorMsg });
      return { action: 'answer', reasoning: 'Planner output was unparseable' };
    }
  }
}

/**
 * Simple hash function for prompt hashing (DJB2-like).
 * Non-cryptographic — used only for trace correlation.
 */
function simpleHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) + input.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
