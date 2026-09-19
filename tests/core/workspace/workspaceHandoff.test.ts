import { describe, expect, it } from 'vitest';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage, type ValidatedStorage } from '@/core/storage/chromeStorage';
import { createWorkspaceElectionArbiter } from '@/core/workspace/WorkspaceElectionArbiter';
import { createWorkspaceHandoff } from '@/core/workspace/WorkspaceHandoff';
import {
  ElectionRecordSchema,
  HandoffRecordSchema,
  type ElectionRecord,
} from '@/core/workspace/workspaceTypes';
import type {
  WorkspaceElectionRequestPayload,
  WorkspaceElectionResponsePayload,
} from '@/core/runtime/messageSchemas';

const TARGET = { instanceId: 'standalone-instance', writerType: 'standalone' as const };
const NOW = 900;
const SIDE_PANEL = { writerType: 'sidepanel' as const, instanceId: 'sidepanel-instance' };

type Submit = (
  payload: WorkspaceElectionRequestPayload,
) => Promise<WorkspaceElectionResponsePayload>;

function electionRecord(overrides: Partial<ElectionRecord> = {}): ElectionRecord {
  return {
    writerType: 'sidepanel',
    writerInstanceId: 'sidepanel-instance',
    epoch: 0,
    committedVersion: 0,
    handoffPhase: 'idle',
    handoffTargetInstanceId: null,
    updatedAt: 1,
    recentCompletedRequests: [],
    ...overrides,
  };
}

function makeHandoff(storage: ValidatedStorage, submit?: Submit) {
  const calls: WorkspaceElectionRequestPayload[] = [];
  const handoff = createWorkspaceHandoff({
    storage,
    writerType: SIDE_PANEL.writerType,
    instanceId: SIDE_PANEL.instanceId,
    now: () => NOW,
    submitElectionRequest: async (payload) => {
      calls.push(payload);
      if (submit) return submit(payload);
      return { requestId: payload.requestId, accepted: true };
    },
  });
  return { handoff, calls };
}

function setup(submit?: Submit) {
  const storage = createValidatedStorage(createChromeStorageMock());
  const { handoff, calls } = makeHandoff(storage, submit);
  async function becomeWriter(version = 0) {
    await storage.write(
      'np_workspace_election',
      ElectionRecordSchema,
      electionRecord({ committedVersion: version }),
    );
  }
  return { storage, handoff, calls, becomeWriter };
}

async function readElection(storage: ValidatedStorage) {
  return storage.read('np_workspace_election', ElectionRecordSchema);
}

describe('workspace handoff', () => {
  it('prepares a handoff and leaves the election record untouched', async () => {
    const { handoff, storage, becomeWriter } = setup();
    await becomeWriter(3);
    const before = await readElection(storage);

    await expect(handoff.prepare(TARGET, 3)).resolves.toEqual({ status: 'prepared' });

    await expect(storage.read('np_workspace_handoff', HandoffRecordSchema)).resolves.toEqual({
      status: 'valid',
      value: {
        phase: 'prepared',
        fromInstanceId: SIDE_PANEL.instanceId,
        fromWriterType: SIDE_PANEL.writerType,
        toInstanceId: TARGET.instanceId,
        toWriterType: TARGET.writerType,
        epoch: 0,
        baseVersion: 3,
        preparedAt: NOW,
        acknowledgedAt: null,
      },
    });
    expect(await readElection(storage)).toEqual(before);
    await expect(readElection(storage)).resolves.toMatchObject({
      status: 'valid',
      value: { writerInstanceId: SIDE_PANEL.instanceId, handoffPhase: 'idle' },
    });
  });

  it('rejects a prepare from a non-writer', async () => {
    const { handoff, storage } = setup();
    await expect(handoff.prepare(TARGET, 0)).resolves.toEqual({
      status: 'rejected',
      code: 'WORKSPACE_HANDOFF_FAILED',
    });
    await expect(storage.read('np_workspace_handoff', HandoffRecordSchema)).resolves.toEqual({
      status: 'missing',
    });
  });

  it('acknowledges only the same version and epoch', async () => {
    const { handoff, storage, becomeWriter } = setup();
    await becomeWriter(3);
    await handoff.prepare(TARGET, 3);
    const before = await readElection(storage);

    await expect(handoff.acknowledge(0, 2)).resolves.toEqual({
      status: 'rejected',
      code: 'WORKSPACE_VERSION_CONFLICT',
    });
    await expect(handoff.acknowledge(5, 3)).resolves.toEqual({
      status: 'rejected',
      code: 'WORKSPACE_EPOCH_MISMATCH',
    });
    await expect(handoff.acknowledge(0, 3)).resolves.toEqual({ status: 'acknowledged' });

    await expect(storage.read('np_workspace_handoff', HandoffRecordSchema)).resolves.toMatchObject({
      status: 'valid',
      value: { phase: 'acknowledged', acknowledgedAt: NOW },
    });
    expect(await readElection(storage)).toEqual(before);
  });

  it('rejects a commit before acknowledgement without contacting the arbiter', async () => {
    const { handoff, calls, becomeWriter } = setup();
    await becomeWriter(3);
    await handoff.prepare(TARGET, 3);

    await expect(handoff.commit(0, 3)).resolves.toEqual({
      status: 'rejected',
      code: 'WORKSPACE_HANDOFF_FAILED',
    });
    expect(calls).toHaveLength(0);
  });

  it('commits through the arbiter and removes the handoff record on acceptance', async () => {
    const { handoff, storage, calls, becomeWriter } = setup();
    await becomeWriter(3);
    await handoff.prepare(TARGET, 3);
    await handoff.acknowledge(0, 3);
    const before = await readElection(storage);

    await expect(handoff.commit(0, 3)).resolves.toEqual({ status: 'committed' });

    expect(calls).toHaveLength(1);
    const payload = calls[0];
    expect(payload).toBeDefined();
    expect(payload).toMatchObject({
      operation: 'handoff-commit',
      requesterInstanceId: SIDE_PANEL.instanceId,
      requesterWriterType: SIDE_PANEL.writerType,
      committedVersion: 3,
      expectedEpoch: 0,
      targetInstanceId: TARGET.instanceId,
      targetWriterType: TARGET.writerType,
    });
    expect(payload?.reason).toBeUndefined();
    expect(payload?.requestId).toMatch(/^[0-9a-f-]{36}$/);

    await expect(storage.read('np_workspace_handoff', HandoffRecordSchema)).resolves.toEqual({
      status: 'missing',
    });
    expect(await readElection(storage)).toEqual(before);
  });

  it('commits through the arbiter and leaves exactly one authorised writer', async () => {
    const storage = createValidatedStorage(createChromeStorageMock());
    const arbiter = createWorkspaceElectionArbiter({ storage, now: () => NOW });
    const { handoff } = makeHandoff(storage, (payload) => arbiter.handle(payload));
    await storage.write('np_workspace_election', ElectionRecordSchema, electionRecord());

    await handoff.prepare(TARGET, 0);
    await handoff.acknowledge(0, 0);

    await expect(handoff.commit(0, 0)).resolves.toEqual({ status: 'committed' });

    await expect(readElection(storage)).resolves.toMatchObject({
      status: 'valid',
      value: {
        writerType: TARGET.writerType,
        writerInstanceId: TARGET.instanceId,
        epoch: 1,
        committedVersion: 0,
        handoffPhase: 'idle',
        handoffTargetInstanceId: null,
      },
    });
    await expect(storage.read('np_workspace_handoff', HandoffRecordSchema)).resolves.toEqual({
      status: 'missing',
    });
  });

  it('maps an election rejection and leaves the handoff record in place', async () => {
    const { handoff, storage, becomeWriter } = setup(async (payload) => ({
      requestId: payload.requestId,
      accepted: false,
      code: 'WORKSPACE_ELECTION_REJECTED',
    }));
    await becomeWriter(0);
    await handoff.prepare(TARGET, 0);
    await handoff.acknowledge(0, 0);

    await expect(handoff.commit(0, 0)).resolves.toEqual({
      status: 'rejected',
      code: 'WORKSPACE_ELECTION_REJECTED',
    });
    await expect(storage.read('np_workspace_handoff', HandoffRecordSchema)).resolves.toMatchObject({
      status: 'valid',
      value: { phase: 'acknowledged' },
    });
  });

  it('maps an election failure and leaves the handoff record in place', async () => {
    const { handoff, storage, becomeWriter } = setup(async (payload) => ({
      requestId: payload.requestId,
      accepted: false,
      code: 'WORKSPACE_ELECTION_FAILED',
    }));
    await becomeWriter(0);
    await handoff.prepare(TARGET, 0);
    await handoff.acknowledge(0, 0);

    await expect(handoff.commit(0, 0)).resolves.toEqual({
      status: 'rejected',
      code: 'WORKSPACE_ELECTION_FAILED',
    });
    await expect(storage.read('np_workspace_handoff', HandoffRecordSchema)).resolves.toMatchObject({
      status: 'valid',
    });
  });

  it('fails closed on an unexpected rejection code', async () => {
    const { handoff, storage, becomeWriter } = setup(async (payload) => ({
      requestId: payload.requestId,
      accepted: false,
      code: 'WORKSPACE_EPOCH_MISMATCH',
    }));
    await becomeWriter(0);
    await handoff.prepare(TARGET, 0);
    await handoff.acknowledge(0, 0);

    await expect(handoff.commit(0, 0)).resolves.toEqual({
      status: 'rejected',
      code: 'WORKSPACE_HANDOFF_FAILED',
    });
    await expect(storage.read('np_workspace_handoff', HandoffRecordSchema)).resolves.toMatchObject({
      status: 'valid',
    });
  });

  it('fails closed when the arbiter submission throws', async () => {
    const { handoff, storage, becomeWriter } = setup(async () => {
      throw new Error('transport failure');
    });
    await becomeWriter(0);
    await handoff.prepare(TARGET, 0);
    await handoff.acknowledge(0, 0);

    await expect(handoff.commit(0, 0)).resolves.toEqual({
      status: 'rejected',
      code: 'WORKSPACE_HANDOFF_FAILED',
    });
    await expect(storage.read('np_workspace_handoff', HandoffRecordSchema)).resolves.toMatchObject({
      status: 'valid',
      value: { phase: 'acknowledged' },
    });
  });

  it('rejects commit when the handoff version or epoch differ', async () => {
    const { handoff, storage, becomeWriter } = setup();
    await becomeWriter(3);
    await handoff.prepare(TARGET, 3);
    await handoff.acknowledge(0, 3);

    await expect(handoff.commit(0, 2)).resolves.toEqual({
      status: 'rejected',
      code: 'WORKSPACE_VERSION_CONFLICT',
    });
    await expect(handoff.commit(5, 3)).resolves.toEqual({
      status: 'rejected',
      code: 'WORKSPACE_EPOCH_MISMATCH',
    });
    await expect(storage.read('np_workspace_handoff', HandoffRecordSchema)).resolves.toMatchObject({
      status: 'valid',
      value: { phase: 'acknowledged' },
    });
  });
});
