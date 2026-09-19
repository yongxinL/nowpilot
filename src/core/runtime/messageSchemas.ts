import { z } from 'zod';
import { ErrorCodeSchema } from '../error/errorCodes';
import { StandaloneRouteIdSchema } from '../registry/standaloneRoutes';
import {
  ElectionRecordSchema,
  InstanceIdSchema,
  WorkspaceElectionClaimReasonSchema,
  WorkspaceElectionOperationSchema,
  WorkspaceMetadataSchema,
  WorkspaceMutationSchema,
  WorkspaceWriterTypeSchema,
} from '../workspace/workspaceTypes';
import { MESSAGE_TYPES, type MessageType } from './MessageType';
import { OperationIdSchema } from './OperationId';

export const WorkspaceMutationPayload = WorkspaceMutationSchema;

export const WorkspaceHandoffPreparePayload = z.object({
  toInstanceId: InstanceIdSchema,
  epoch: z.number().int().nonnegative(),
  baseVersion: z.number().int().nonnegative(),
});

export const WorkspaceHandoffAckPayload = z.object({
  toInstanceId: InstanceIdSchema,
  epoch: z.number().int().nonnegative(),
  committedVersion: z.number().int().nonnegative(),
});

export const WorkspaceHandoffCommitPayload = z.object({
  toInstanceId: InstanceIdSchema,
  epoch: z.number().int().nonnegative(),
  committedVersion: z.number().int().nonnegative(),
});

export const WorkspaceRelinquishPayload = z.object({
  epoch: z.number().int().nonnegative(),
  committedVersion: z.number().int().nonnegative(),
});

export const WorkspaceRehydrateRequestPayload = z.object({
  sinceVersion: z.number().int().nonnegative(),
  instanceId: InstanceIdSchema,
  writerType: WorkspaceWriterTypeSchema,
});

export const WorkspaceRehydrateResponsePayload = z.object({
  committedVersion: z.number().int().nonnegative(),
  epoch: z.number().int().nonnegative(),
  metadata: WorkspaceMetadataSchema,
});

export const StandaloneOpenPayload = z.object({
  destination: StandaloneRouteIdSchema,
});

export const StandaloneFocusPayload = z.object({
  destination: StandaloneRouteIdSchema,
});

export const StandaloneClosedPayload = z.object({});

export const RuntimeErrorPayload = z.object({
  code: ErrorCodeSchema,
  message: z.string().max(280).optional(),
});

export const WorkspaceElectionRequestPayload = z.object({
  requestId: OperationIdSchema,
  operation: WorkspaceElectionOperationSchema,
  requesterInstanceId: InstanceIdSchema,
  requesterWriterType: WorkspaceWriterTypeSchema,
  committedVersion: z.number().int().nonnegative(),
  reason: WorkspaceElectionClaimReasonSchema.optional(),
  expectedEpoch: z.number().int().nonnegative().optional(),
  targetInstanceId: InstanceIdSchema.optional(),
  targetWriterType: WorkspaceWriterTypeSchema.optional(),
});
export type WorkspaceElectionRequestPayload = z.infer<typeof WorkspaceElectionRequestPayload>;

export const WorkspaceElectionResponsePayload = z.object({
  requestId: OperationIdSchema,
  accepted: z.boolean(),
  record: ElectionRecordSchema.optional(),
  code: ErrorCodeSchema.optional(),
});
export type WorkspaceElectionResponsePayload = z.infer<typeof WorkspaceElectionResponsePayload>;

export const RUNTIME_PAYLOAD_SCHEMAS: Readonly<Record<MessageType, z.ZodType>> = {
  'workspace.mutation': WorkspaceMutationPayload,
  'workspace.handoff.prepare': WorkspaceHandoffPreparePayload,
  'workspace.handoff.ack': WorkspaceHandoffAckPayload,
  'workspace.handoff.commit': WorkspaceHandoffCommitPayload,
  'workspace.relinquish': WorkspaceRelinquishPayload,
  'workspace.rehydrate.request': WorkspaceRehydrateRequestPayload,
  'workspace.rehydrate.response': WorkspaceRehydrateResponsePayload,
  'standalone.open': StandaloneOpenPayload,
  'standalone.focus': StandaloneFocusPayload,
  'standalone.closed': StandaloneClosedPayload,
  'runtime.error': RuntimeErrorPayload,
  'workspace.election.request': WorkspaceElectionRequestPayload,
  'workspace.election.response': WorkspaceElectionResponsePayload,
};

export const RuntimeMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('workspace.mutation'), payload: WorkspaceMutationPayload }),
  z.object({
    type: z.literal('workspace.handoff.prepare'),
    payload: WorkspaceHandoffPreparePayload,
  }),
  z.object({ type: z.literal('workspace.handoff.ack'), payload: WorkspaceHandoffAckPayload }),
  z.object({ type: z.literal('workspace.handoff.commit'), payload: WorkspaceHandoffCommitPayload }),
  z.object({ type: z.literal('workspace.relinquish'), payload: WorkspaceRelinquishPayload }),
  z.object({
    type: z.literal('workspace.rehydrate.request'),
    payload: WorkspaceRehydrateRequestPayload,
  }),
  z.object({
    type: z.literal('workspace.rehydrate.response'),
    payload: WorkspaceRehydrateResponsePayload,
  }),
  z.object({ type: z.literal('standalone.open'), payload: StandaloneOpenPayload }),
  z.object({ type: z.literal('standalone.focus'), payload: StandaloneFocusPayload }),
  z.object({ type: z.literal('standalone.closed'), payload: StandaloneClosedPayload }),
  z.object({ type: z.literal('runtime.error'), payload: RuntimeErrorPayload }),
  z.object({
    type: z.literal('workspace.election.request'),
    payload: WorkspaceElectionRequestPayload,
  }),
  z.object({
    type: z.literal('workspace.election.response'),
    payload: WorkspaceElectionResponsePayload,
  }),
]);

export { MESSAGE_TYPES };
