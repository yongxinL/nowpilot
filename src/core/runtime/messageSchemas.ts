import { z } from 'zod';
import { ErrorCodeSchema } from '../error/errorCodes';
import { StandaloneRouteIdSchema } from '../registry/standaloneRoutes';
import {
  InstanceIdSchema,
  WorkspaceMetadataSchema,
  WorkspaceMutationSchema,
  WorkspaceWriterTypeSchema,
} from '../workspace/workspaceTypes';
import { MESSAGE_TYPES, type MessageType } from './MessageType';

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
]);

export { MESSAGE_TYPES };
