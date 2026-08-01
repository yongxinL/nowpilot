import { generateText, Output, isStepCount } from 'ai';
import { z } from 'zod';
import type { ProviderAdapter } from './providers/ProviderAdapter';
import type { OptimizedContext, PlannerDecision, ModelTier } from './types';
import { PipelineError } from './PipelineError';
import { resolveTierModel } from './TierResolver';
import { repairJSON } from './StructuredOutput';
import { inject } from './persona/PersonaInjector';

const AnswerSchema = z.strictObject({
  action: z.literal('answer'),
  reasonCode: z.string().max(64),
});

const RunToolSchema = z.strictObject({
  action: z.literal('run_tool'),
  toolName: z.string().max(64),
  input: z.record(z.string(), z.unknown()),
});

const AskClarificationSchema = z.strictObject({
  action: z.literal('ask_clarification'),
  question: z.string().max(200),
});

export const PlannerDecisionSchema = z.discriminatedUnion('action', [
  AnswerSchema,
  RunToolSchema,
  AskClarificationSchema,
]);

/**
 * Bounded redacted recovery observation (D-15/T-03a-16). Handed to the
 * planner on the single recovery replan call. Carries only the tool name,
 * a closed execution/evidence status, a safe PipelineError code, and a
 * bounded evidence summary — never raw tool output, PipelineError
 * diagnostics, secrets, or idempotency keys.
 */
export interface RecoveryObservation {
  toolName: string;
  executionStatus: 'failed' | 'verified' | 'unverified';
  errorCode?: string;
  evidenceSummary?: string;
}

function appendRecoveryObservation(userMessage: string, observation?: RecoveryObservation): string {
  if (!observation) return userMessage;
  const parts = [
    userMessage,
    '',
    '[Recovery context] A previous action could not be completed with verified success.',
    `Tool: ${observation.toolName}. Status: ${observation.executionStatus}.`,
  ];
  if (observation.errorCode) {
    parts.push(`Error code: ${observation.errorCode}.`);
  }
  if (observation.evidenceSummary) {
    parts.push(`Evidence: ${observation.evidenceSummary}.`);
  }
  parts.push('Choose a different action or answer directly; do not repeat the failed action.');
  return parts.join('\n');
}

function buildPlannerSystemPrompt(optimized: OptimizedContext): string {
  const systemSection = optimized.sections.find((s) => s.kind === 'system');
  const parts: string[] = [
    systemSection?.text ?? 'You are a helpful AI assistant.',
    'You are a planning agent that decides the next action based on the user message and conversation history.',
    'Pick exactly ONE action:',
    '- answer: respond directly to the user (you have sufficient information)',
    '- run_tool: execute a tool to gather more information',
    '- ask_clarification: ask the user for more details',
  ];

  // OptimizedContext does not carry availableTools directly — the tool list
  // is reconstructed from the tool_schemas section text.
  const toolSection = optimized.sections.find((s) => s.kind === 'tool_schemas');
  if (toolSection?.text) {
    try {
      const tools = JSON.parse(toolSection.text) as Array<{ name: string; description: string }>;
      if (tools.length > 0) {
        parts.push('', 'Available tools:');
        for (const tool of tools) {
          parts.push(`- ${tool.name}: ${tool.description}`);
        }
      }
    } catch {
      // Malformed tool schemas text — proceed without a tool list.
    }
  }

  return inject('planner', parts.join('\n'));
}

function buildPlannerMessagesWithJSONInstructions(
  optimized: OptimizedContext,
  recoveryObservation?: RecoveryObservation,
): Array<{ role: 'system' | 'user'; content: string }> {
  const baseSystem = buildPlannerSystemPrompt(optimized);
  return [
    {
      role: 'system',
      content: `${baseSystem}\n\nRespond ONLY with a JSON object. Do not include markdown fences, explanations, or any text outside the JSON.`,
    },
    { role: 'user', content: appendRecoveryObservation(extractUserMessage(optimized), recoveryObservation) },
  ];
}

function buildPlannerMessages(
  optimized: OptimizedContext,
  recoveryObservation?: RecoveryObservation,
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: buildPlannerSystemPrompt(optimized) },
    { role: 'user', content: appendRecoveryObservation(extractUserMessage(optimized), recoveryObservation) },
  ];
}

function extractUserMessage(optimized: OptimizedContext): string {
  const userSection = optimized.sections.find((s) => s.kind === 'user_input');
  return userSection?.text ?? '';
}

export class PlannerService {
  async plan(
    adapter: ProviderAdapter,
    tier: ModelTier,
    optimized: OptimizedContext,
    signal?: AbortSignal,
    recoveryObservation?: RecoveryObservation,
  ): Promise<PlannerDecision> {
    const { modelId } = resolveTierModel(adapter, tier);
    const model = adapter.createLanguageModel(modelId);

    try {
      if (adapter.supportsStructuredOutput) {
        const { output } = await generateText({
          model,
          output: Output.object({ schema: PlannerDecisionSchema }),
          messages: buildPlannerMessages(optimized, recoveryObservation),
          stopWhen: isStepCount(1),
          ...(signal ? { signal } : {}),
        });
        return output as PlannerDecision;
      } else {
        const { text } = await generateText({
          model,
          messages: buildPlannerMessagesWithJSONInstructions(optimized, recoveryObservation),
          ...(signal ? { signal } : {}),
        });
        return repairJSON(text, PlannerDecisionSchema);
      }
    } catch (err) {
      if (err instanceof PipelineError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new PipelineError('ABORTED', 'Request was aborted.', { originalError: err.message });
      }
      throw new PipelineError('UNKNOWN', 'Planner service failed.', { originalError: String(err) });
    }
  }
}

export const plannerService = new PlannerService();
