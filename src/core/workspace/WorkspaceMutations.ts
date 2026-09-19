import { createErrorRecord, debugLog } from '../error/debugLog';
import type { WorkspaceStore } from './WorkspaceStore';
import { WorkspaceMetadataSchema, type InstanceId, type WorkspaceMutation } from './workspaceTypes';

export interface MutationEngineState {
  committedVersion: number;
  epoch: number;
  writerInstanceId: InstanceId;
  appliedMutationIds: readonly string[];
}

export type MutationRejectionCode =
  | 'WORKSPACE_OWNERSHIP_AMBIGUOUS'
  | 'WORKSPACE_EPOCH_MISMATCH'
  | 'WORKSPACE_STALE_MUTATION'
  | 'WORKSPACE_VERSION_CONFLICT';

export type MutationOutcome =
  | { status: 'applied'; mutation: WorkspaceMutation; state: MutationEngineState }
  | { status: 'duplicate'; state: MutationEngineState }
  | { status: 'rejected'; code: MutationRejectionCode; state: MutationEngineState };

export function createMutationEngineState(input: {
  writerInstanceId: InstanceId;
  epoch: number;
  committedVersion?: number;
  appliedMutationIds?: readonly string[];
}): MutationEngineState {
  return {
    committedVersion: input.committedVersion ?? 0,
    epoch: input.epoch,
    writerInstanceId: input.writerInstanceId,
    appliedMutationIds: input.appliedMutationIds ?? [],
  };
}

function rejected(state: MutationEngineState, code: MutationRejectionCode): MutationOutcome {
  debugLog(createErrorRecord(code, { reason: 'mutation' }));
  return { status: 'rejected', code, state };
}

export function applyWorkspaceMutation(
  state: MutationEngineState,
  mutation: WorkspaceMutation,
): MutationOutcome {
  if (state.appliedMutationIds.includes(mutation.mutationId)) {
    return { status: 'duplicate', state };
  }
  if (mutation.writerInstanceId !== state.writerInstanceId) {
    return rejected(state, 'WORKSPACE_OWNERSHIP_AMBIGUOUS');
  }
  if (mutation.epoch !== state.epoch) {
    return rejected(state, 'WORKSPACE_EPOCH_MISMATCH');
  }
  if (mutation.baseVersion !== state.committedVersion) {
    return rejected(state, 'WORKSPACE_STALE_MUTATION');
  }
  if (mutation.resultingVersion !== mutation.baseVersion + 1) {
    return rejected(state, 'WORKSPACE_VERSION_CONFLICT');
  }
  const nextState: MutationEngineState = {
    ...state,
    committedVersion: mutation.resultingVersion,
    appliedMutationIds: [...state.appliedMutationIds, mutation.mutationId],
  };
  return { status: 'applied', mutation, state: nextState };
}

export interface CommitWorkspaceMutationDependencies {
  store: WorkspaceStore;
  now(): number;
}

export async function commitWorkspaceMutation(
  deps: CommitWorkspaceMutationDependencies,
  state: MutationEngineState,
  mutation: WorkspaceMutation,
): Promise<MutationOutcome> {
  const outcome = applyWorkspaceMutation(state, mutation);
  if (outcome.status !== 'applied') return outcome;
  const metadata = WorkspaceMetadataSchema.parse({
    ...mutation.payload,
    committedVersion: mutation.resultingVersion,
    updatedAt: deps.now(),
  });
  await deps.store.writeMetadata(metadata);
  return outcome;
}
