import { describe, expect, it } from 'vitest';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import {
  applyWorkspaceMutation,
  commitWorkspaceMutation,
  createMutationEngineState,
} from '@/core/workspace/WorkspaceMutations';
import { WorkspaceMutationSchema, type WorkspaceMutation } from '@/core/workspace/workspaceTypes';

function mutation(overrides: Partial<WorkspaceMutation> = {}): WorkspaceMutation {
  return {
    mutationId: '00000000-0000-4000-8000-000000000001',
    writerInstanceId: 'writer',
    epoch: 0,
    baseVersion: 0,
    resultingVersion: 1,
    kind: 'workspace.metadata.set',
    payload: { schemaVersion: 1, committedVersion: 1, updatedAt: 10 },
    ...overrides,
  } as WorkspaceMutation;
}

describe('workspace mutations', () => {
  it('applies a valid next mutation and increments the version', () => {
    const state = createMutationEngineState({ writerInstanceId: 'writer', epoch: 0 });
    const outcome = applyWorkspaceMutation(state, mutation());
    expect(outcome.status).toBe('applied');
    expect(outcome.state.committedVersion).toBe(1);
    expect(outcome.state.appliedMutationIds).toContain(mutation().mutationId);
  });

  it('rejects a mutation from the wrong writer', () => {
    const state = createMutationEngineState({ writerInstanceId: 'writer', epoch: 0 });
    expect(applyWorkspaceMutation(state, mutation({ writerInstanceId: 'other' }))).toMatchObject({
      status: 'rejected',
      code: 'WORKSPACE_OWNERSHIP_AMBIGUOUS',
    });
  });

  it('rejects a mutation from the wrong epoch', () => {
    const state = createMutationEngineState({ writerInstanceId: 'writer', epoch: 2 });
    expect(applyWorkspaceMutation(state, mutation({ epoch: 1 }))).toMatchObject({
      status: 'rejected',
      code: 'WORKSPACE_EPOCH_MISMATCH',
    });
  });

  it('rejects a stale base version', () => {
    const state = createMutationEngineState({ writerInstanceId: 'writer', epoch: 0 });
    const first = applyWorkspaceMutation(state, mutation());
    expect(
      applyWorkspaceMutation(
        first.state,
        mutation({
          mutationId: '00000000-0000-4000-8000-000000000002',
          baseVersion: 0,
          resultingVersion: 1,
        }),
      ),
    ).toMatchObject({ status: 'rejected', code: 'WORKSPACE_STALE_MUTATION' });
  });

  it('rejects a non-monotonic resulting version', () => {
    const state = createMutationEngineState({ writerInstanceId: 'writer', epoch: 0 });
    expect(applyWorkspaceMutation(state, mutation({ resultingVersion: 5 }))).toMatchObject({
      status: 'rejected',
      code: 'WORKSPACE_VERSION_CONFLICT',
    });
  });

  it('treats a repeated mutation id as a duplicate and applies it once', () => {
    const state = createMutationEngineState({ writerInstanceId: 'writer', epoch: 0 });
    const first = applyWorkspaceMutation(state, mutation());
    const second = applyWorkspaceMutation(first.state, mutation());
    expect(second.status).toBe('duplicate');
    expect(second.state.committedVersion).toBe(1);
  });

  it('persists an applied mutation through the workspace store', async () => {
    const chromeStorage = createChromeStorageMock();
    const store = createWorkspaceStore(createValidatedStorage(chromeStorage));
    const state = createMutationEngineState({ writerInstanceId: 'writer', epoch: 0 });
    const outcome = await commitWorkspaceMutation({ store, now: () => 77 }, state, mutation());
    expect(outcome.status).toBe('applied');
    expect(WorkspaceMutationSchema.safeParse(mutation()).success).toBe(true);
    await expect(store.readVersion()).resolves.toBe(1);
    await expect(store.readMetadata()).resolves.toMatchObject({
      status: 'valid',
      metadata: { committedVersion: 1, updatedAt: 77 },
    });
  });
});
