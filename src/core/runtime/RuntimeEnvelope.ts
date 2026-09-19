import { z } from 'zod';
import {
  RuntimeErrorPayload,
  StandaloneClosedPayload,
  StandaloneFocusPayload,
  StandaloneOpenPayload,
  WorkspaceHandoffAckPayload,
  WorkspaceHandoffCommitPayload,
  WorkspaceHandoffPreparePayload,
  WorkspaceMutationPayload,
  WorkspaceRehydrateRequestPayload,
  WorkspaceRehydrateResponsePayload,
  WorkspaceRelinquishPayload,
} from './messageSchemas';
import { OperationIdSchema } from './OperationId';
import { RuntimeSurfaceSchema, RuntimeTargetSchema } from './RuntimeSurface';

const envelopeBaseFields = {
  envelopeVersion: z.literal(1),
  id: OperationIdSchema,
  source: RuntimeSurfaceSchema,
  target: RuntimeTargetSchema,
  timestamp: z.number().int().nonnegative(),
  correlationId: z.string().optional(),
  electionEpoch: z.number().int().nonnegative().optional(),
  workspaceVersion: z.number().int().nonnegative().optional(),
};

export const RuntimeEnvelopeSchema = z.discriminatedUnion('type', [
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.mutation'),
    payload: WorkspaceMutationPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.handoff.prepare'),
    payload: WorkspaceHandoffPreparePayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.handoff.ack'),
    payload: WorkspaceHandoffAckPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.handoff.commit'),
    payload: WorkspaceHandoffCommitPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.relinquish'),
    payload: WorkspaceRelinquishPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.rehydrate.request'),
    payload: WorkspaceRehydrateRequestPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.rehydrate.response'),
    payload: WorkspaceRehydrateResponsePayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('standalone.open'),
    payload: StandaloneOpenPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('standalone.focus'),
    payload: StandaloneFocusPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('standalone.closed'),
    payload: StandaloneClosedPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('runtime.error'),
    payload: RuntimeErrorPayload,
  }),
]);

export type RuntimeEnvelope = z.infer<typeof RuntimeEnvelopeSchema>;

export function parseRuntimeEnvelope(input: unknown) {
  return RuntimeEnvelopeSchema.safeParse(input);
}
