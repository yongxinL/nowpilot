import { generateText } from 'ai';
import { debugLog } from '../../utils/debugLog';
import type { ProviderRouter } from '../router/ProviderRouter';
import type { CostTierType } from '../providers/providerTypes';
import type { PlannerDecisionType } from './pipelineTypes';
import { PlannerDecision } from './pipelineTypes';
import { repairAndValidate } from './StructuredOutput';

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
  ): Promise<PlannerDecisionType> {
    try {
      const model = await this.router.selectModel(tier, preferredProviders);
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
        temperature: 0.1,
      });

      const validated = repairAndValidate(result.text, PlannerDecision, PLANNER_FALLBACK);

      if ('result' in validated) {
        return validated.result;
      }

      debugLog('warn', '[PlannerService] Using fallback decision');
      return validated.fallback;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      debugLog('error', '[PlannerService] plan failed', { error: err });
      return { action: 'answer', reasoning: 'Planner output was unparseable' };
    }
  }
}
