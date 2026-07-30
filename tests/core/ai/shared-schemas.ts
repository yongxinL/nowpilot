import { z } from 'zod';

export const PlannerDecisionSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('answer'), reasonCode: z.string().max(64) }),
  z.strictObject({ action: z.literal('run_tool'), toolName: z.string().max(64), input: z.unknown() }),
  z.strictObject({ action: z.literal('ask_clarification'), question: z.string().max(200) }),
]);
