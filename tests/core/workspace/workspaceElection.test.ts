import { describe, expect, it } from 'vitest';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { createWorkspaceElection } from '@/core/workspace/WorkspaceElection';
import { ElectionRecordSchema, type ElectionRecord } from '@/core/workspace/workspaceTypes';

function setup(writerType: 'sidepanel' | 'standalone' = 'sidepanel') {
  const chromeStorage = createChromeStorageMock();
  const storage = createValidatedStorage(chromeStorage);
  const store = createWorkspaceStore(storage);
  const election = createWorkspaceElection({
    storage,
    store,
    writerType,
    instanceId: `${writerType}-instance`,
    now: () => 500,
  });
  return { chromeStorage, storage, store, election };
}

describe('workspace election', () => {
  it('acquires the writer role when no valid writer exists', async () => {
    const { election, storage } = setup();
    const result = await election.claim();
    expect(result.status).toBe('acquired');
    await expect(storage.read('np_workspace_election', ElectionRecordSchema)).resolves.toEqual({
      status: 'valid',
      value: {
        writerType: 'sidepanel',
        writerInstanceId: 'sidepanel-instance',
        epoch: 0,
        committedVersion: 0,
        handoffPhase: 'idle',
        handoffTargetInstanceId: null,
        updatedAt: 500,
      },
    });
  });

  it('preserves the committed version when acquiring', async () => {
    const { election, store } = setup();
    await store.writeMetadata({ schemaVersion: 1, committedVersion: 4, updatedAt: 1 });
    const result = await election.claim();
    expect(result.status).toBe('acquired');
    if (result.status === 'acquired') expect(result.record.committedVersion).toBe(4);
  });

  it('does not displace a valid writer held by another instance', async () => {
    const { election, storage } = setup();
    const other: ElectionRecord = {
      writerType: 'standalone',
      writerInstanceId: 'standalone-instance',
      epoch: 2,
      committedVersion: 1,
      handoffPhase: 'idle',
      handoffTargetInstanceId: null,
      updatedAt: 1,
    };
    await storage.write('np_workspace_election', ElectionRecordSchema, other);
    const result = await election.claim();
    expect(result).toEqual({ status: 'held', record: other });
    await expect(storage.read('np_workspace_election', ElectionRecordSchema)).resolves.toEqual({
      status: 'valid',
      value: other,
    });
  });

  it('treats a repeated claim by the same instance as held', async () => {
    const { election } = setup();
    await election.claim();
    const second = await election.claim();
    expect(second.status).toBe('held');
  });

  it('recovers from invalid election metadata by claiming a fresh epoch', async () => {
    const { election, chromeStorage, storage } = setup();
    chromeStorage.session._setRaw('np_workspace_election', { writerType: 'broken' });
    const result = await election.claim();
    expect(result.status).toBe('acquired');
    if (result.status === 'acquired') expect(result.recovered).toBe(true);
    await expect(
      storage.read('np_workspace_election', ElectionRecordSchema),
    ).resolves.toMatchObject({
      status: 'valid',
    });
  });

  it('relinquishes both election and handoff records', async () => {
    const { election, storage } = setup();
    await election.claim();
    await election.relinquish();
    await expect(storage.read('np_workspace_election', ElectionRecordSchema)).resolves.toEqual({
      status: 'missing',
    });
  });

  it('reports whether a record belongs to this instance', async () => {
    const { election } = setup();
    const mine: ElectionRecord = {
      writerType: 'sidepanel',
      writerInstanceId: 'sidepanel-instance',
      epoch: 0,
      committedVersion: 0,
      handoffPhase: 'idle',
      handoffTargetInstanceId: null,
      updatedAt: 1,
    };
    expect(election.isWriter(mine)).toBe(true);
    expect(election.isWriter(undefined)).toBe(false);
    expect(election.isWriter({ ...mine, writerInstanceId: 'other' })).toBe(false);
  });
});
