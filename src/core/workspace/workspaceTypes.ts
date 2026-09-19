import { z } from 'zod';

export const WORKSPACE_SCHEMA_VERSION = 1 as const;

export const WorkspaceWriterTypeSchema = z.enum(['sidepanel', 'standalone']);
export type WorkspaceWriterType = z.infer<typeof WorkspaceWriterTypeSchema>;

export const HandoffPhaseSchema = z.enum(['idle', 'prepared', 'acknowledged', 'committed']);
export type HandoffPhase = z.infer<typeof HandoffPhaseSchema>;

export const InstanceIdSchema = z.string().min(1);
export type InstanceId = z.infer<typeof InstanceIdSchema>;

export function createInstanceId(): InstanceId {
  return crypto.randomUUID();
}

export const WorkspaceMetadataSchema = z.object({
  schemaVersion: z.literal(WORKSPACE_SCHEMA_VERSION),
  committedVersion: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type WorkspaceMetadata = z.infer<typeof WorkspaceMetadataSchema>;

export const WorkspaceVersionRecordSchema = z.object({
  committedVersion: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});
export type WorkspaceVersionRecord = z.infer<typeof WorkspaceVersionRecordSchema>;

export const ElectionRecordSchema = z.object({
  writerType: WorkspaceWriterTypeSchema,
  writerInstanceId: InstanceIdSchema,
  epoch: z.number().int().nonnegative(),
  committedVersion: z.number().int().nonnegative(),
  handoffPhase: HandoffPhaseSchema,
  handoffTargetInstanceId: InstanceIdSchema.nullable(),
  updatedAt: z.number().int().nonnegative(),
});
export type ElectionRecord = z.infer<typeof ElectionRecordSchema>;

export const HandoffRecordSchema = z.object({
  phase: z.enum(['prepared', 'acknowledged']),
  fromInstanceId: InstanceIdSchema,
  fromWriterType: WorkspaceWriterTypeSchema,
  toInstanceId: InstanceIdSchema,
  toWriterType: WorkspaceWriterTypeSchema,
  epoch: z.number().int().nonnegative(),
  baseVersion: z.number().int().nonnegative(),
  preparedAt: z.number().int().nonnegative(),
  acknowledgedAt: z.number().int().nonnegative().nullable(),
});
export type HandoffRecord = z.infer<typeof HandoffRecordSchema>;

export const StandaloneTabRecordSchema = z.object({
  tabId: z.number().int().nonnegative(),
  openedAt: z.number().int().nonnegative(),
});
export type StandaloneTabRecord = z.infer<typeof StandaloneTabRecordSchema>;

export const WorkspaceMutationKindSchema = z.literal('workspace.metadata.set');
export type WorkspaceMutationKind = z.infer<typeof WorkspaceMutationKindSchema>;

export const WorkspaceMutationSchema = z.object({
  mutationId: z.string().uuid(),
  writerInstanceId: InstanceIdSchema,
  epoch: z.number().int().nonnegative(),
  baseVersion: z.number().int().nonnegative(),
  resultingVersion: z.number().int().nonnegative(),
  kind: WorkspaceMutationKindSchema,
  payload: WorkspaceMetadataSchema,
});
export type WorkspaceMutation = z.infer<typeof WorkspaceMutationSchema>;

export function createEmptyWorkspaceMetadata(now: number): WorkspaceMetadata {
  return {
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    committedVersion: 0,
    updatedAt: now,
  };
}
