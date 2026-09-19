import { describe, expect, it, vi } from 'vitest';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import type { BroadcastBus, EnvelopeHandler } from '@/core/runtime/BroadcastBus';
import type { MessageType } from '@/core/runtime/MessageType';
import { createOperationId } from '@/core/runtime/OperationId';
import { parseRuntimeEnvelope, type RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import {
  createWorkspaceElection,
  type WorkspaceElection,
} from '@/core/workspace/WorkspaceElection';
import {
  createWorkspaceElectionArbiter,
  type WorkspaceElectionArbiter,
} from '@/core/workspace/WorkspaceElectionArbiter';
import { createWorkspaceHandoff, type WorkspaceHandoff } from '@/core/workspace/WorkspaceHandoff';
import { createWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import {
  ElectionRecordSchema,
  HandoffRecordSchema,
  type ElectionRecord,
} from '@/core/workspace/workspaceTypes';
import {
  applyMirrorEnvelope,
  classifyMirrorEnvelope,
  createHandoffAckEnvelope,
  createHandoffPrepareEnvelope,
  createRehydrateRequestEnvelope,
  createRehydrateResponseEnvelope,
  createWorkspaceCoordinator,
} from '@/core/workspace/WorkspaceSync';

function envelope(overrides: Partial<RuntimeEnvelope> = {}): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.mutation',
    source: 'standalone',
    target: 'sidepanel',
    timestamp: 1,
    electionEpoch: 1,
    workspaceVersion: 2,
    payload: {
      mutationId: '00000000-0000-4000-8000-000000000003',
      writerInstanceId: 'writer',
      epoch: 1,
      baseVersion: 1,
      resultingVersion: 2,
      kind: 'workspace.metadata.set',
      payload: { schemaVersion: 1, committedVersion: 2, updatedAt: 5 },
    },
    ...overrides,
  } as RuntimeEnvelope;
}

function mutationEnvelope(version: number, epoch = 0): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.mutation',
    source: 'standalone',
    target: 'sidepanel',
    timestamp: version,
    electionEpoch: epoch,
    workspaceVersion: version,
    payload: {
      mutationId: createOperationId(),
      writerInstanceId: 'writer',
      epoch,
      baseVersion: version - 1,
      resultingVersion: version,
      kind: 'workspace.metadata.set',
      payload: { schemaVersion: 1, committedVersion: version, updatedAt: version },
    },
  } as RuntimeEnvelope;
}

function relinquishEnvelope(): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.relinquish',
    source: 'standalone',
    target: 'sidepanel',
    timestamp: 1,
    electionEpoch: 0,
    payload: { epoch: 0, committedVersion: 0 },
  } as RuntimeEnvelope;
}

function electionRecord(
  writerType: 'sidepanel' | 'standalone',
  writerInstanceId: string,
  committedVersion = 0,
): ElectionRecord {
  return {
    writerType,
    writerInstanceId,
    epoch: 0,
    committedVersion,
    handoffPhase: 'idle',
    handoffTargetInstanceId: null,
    updatedAt: 1,
    recentCompletedRequests: [],
  };
}

function sidepanelRecord(committedVersion = 0): ElectionRecord {
  return electionRecord('sidepanel', 'sp', committedVersion);
}

function standaloneRecord(committedVersion = 0): ElectionRecord {
  return electionRecord('standalone', 'st', committedVersion);
}

interface TestBus extends Pick<BroadcastBus, 'send' | 'on'> {
  sent: RuntimeEnvelope[];
}

function createTestBus(arbiter: WorkspaceElectionArbiter, now: () => number): TestBus {
  const handlers = new Map<MessageType, Set<EnvelopeHandler>>();
  const sent: RuntimeEnvelope[] = [];

  async function dispatch(envelope: RuntimeEnvelope): Promise<void> {
    for (const handler of handlers.get(envelope.type) ?? []) await handler(envelope, undefined);
  }

  return {
    sent,
    async send(envelope) {
      sent.push(envelope);
      if (envelope.type === 'workspace.election.request') {
        const response = await arbiter.handle(envelope.payload);
        await dispatch({
          envelopeVersion: 1,
          id: createOperationId(),
          type: 'workspace.election.response',
          source: 'background',
          target: envelope.source,
          timestamp: now(),
          correlationId: envelope.id,
          payload: response,
        });
        return;
      }
      await dispatch(envelope);
    },
    on(type, handler) {
      const set = handlers.get(type) ?? new Set<EnvelopeHandler>();
      set.add(handler);
      handlers.set(type, set);
      return () => {
        set.delete(handler);
      };
    },
  };
}

function createRig() {
  const chromeStorage = createChromeStorageMock();
  const storage = createValidatedStorage(chromeStorage);
  const store = createWorkspaceStore(storage);
  const arbiter = createWorkspaceElectionArbiter({ storage, now: () => 1 });
  const bus = createTestBus(arbiter, () => 1);

  function election(surface: 'sidepanel' | 'standalone', instanceId: string): WorkspaceElection {
    return createWorkspaceElection({
      storage,
      store,
      bus,
      writerType: surface,
      instanceId,
      now: () => 1,
    });
  }

  function handoff(surface: 'sidepanel' | 'standalone', instanceId: string): WorkspaceHandoff {
    return createWorkspaceHandoff({
      storage,
      writerType: surface,
      instanceId,
      now: () => 2,
      submitElectionRequest: (payload) => arbiter.handle(payload),
    });
  }

  function coordinator(
    surface: 'sidepanel' | 'standalone',
    instanceId: string,
    electionClient: WorkspaceElection = election(surface, instanceId),
    handoffClient: WorkspaceHandoff = handoff(surface, instanceId),
  ) {
    return createWorkspaceCoordinator({
      bus,
      surface,
      instanceId,
      storage,
      election: electionClient,
      handoff: handoffClient,
      store,
    });
  }

  return { chromeStorage, storage, store, arbiter, bus, election, handoff, coordinator };
}

describe('workspace mirror', () => {
  it('applies the next sequential version', () => {
    expect(classifyMirrorEnvelope({ epoch: 1, committedVersion: 1 }, envelope())).toEqual({
      action: 'apply',
    });
  });

  it('ignores a duplicate version', () => {
    expect(classifyMirrorEnvelope({ epoch: 1, committedVersion: 2 }, envelope())).toEqual({
      action: 'ignore',
      reason: 'duplicate',
    });
  });

  it('ignores a stale version', () => {
    expect(classifyMirrorEnvelope({ epoch: 1, committedVersion: 5 }, envelope())).toEqual({
      action: 'ignore',
      reason: 'stale',
    });
  });

  it('requests rehydration on a version gap', () => {
    expect(classifyMirrorEnvelope({ epoch: 1, committedVersion: 0 }, envelope())).toEqual({
      action: 'rehydrate',
      reason: 'gap',
    });
  });

  it('ignores an envelope from a different epoch', () => {
    expect(
      classifyMirrorEnvelope({ epoch: 1, committedVersion: 1 }, envelope({ electionEpoch: 0 })),
    ).toEqual({ action: 'ignore', reason: 'epoch' });
  });

  it('advances mirror state only when applying', () => {
    const applied = applyMirrorEnvelope({ epoch: 1, committedVersion: 1 }, envelope());
    expect(applied.state).toEqual({ epoch: 1, committedVersion: 2 });
    const gap = applyMirrorEnvelope({ epoch: 1, committedVersion: 0 }, envelope());
    expect(gap.state).toEqual({ epoch: 1, committedVersion: 0 });
    expect(gap.decision.action).toBe('rehydrate');
  });

  it('builds valid rehydrate request and response envelopes', () => {
    const request = createRehydrateRequestEnvelope(
      { sinceVersion: 3, instanceId: 'standalone-instance', writerType: 'standalone' },
      'standalone',
    );
    expect(parseRuntimeEnvelope(request).success).toBe(true);
    expect(request.type).toBe('workspace.rehydrate.request');
    const response = createRehydrateResponseEnvelope(
      {
        committedVersion: 4,
        epoch: 2,
        metadata: { schemaVersion: 1, committedVersion: 4, updatedAt: 9 },
      },
      'sidepanel',
    );
    expect(parseRuntimeEnvelope(response).success).toBe(true);
    expect(response.type).toBe('workspace.rehydrate.response');
    expect(response.workspaceVersion).toBe(4);
    expect(response.electionEpoch).toBe(2);
  });
});

describe('workspace coordinator handshake', () => {
  it('hands writer ownership from sidepanel to standalone through prepare/ack/commit', async () => {
    const rig = createRig();
    const sidepanelElection = rig.election('sidepanel', 'sp');
    await sidepanelElection.claim('initial');
    const sidepanel = rig.coordinator('sidepanel', 'sp', sidepanelElection);
    const standalone = rig.coordinator('standalone', 'st');

    const stopSidepanel = sidepanel.start();
    const stopStandalone = standalone.start();
    await rig.store.writeMetadata({ schemaVersion: 1, committedVersion: 0, updatedAt: 1 });
    await standalone.announce();

    const record = await rig.storage.read('np_workspace_election', ElectionRecordSchema);
    expect(record.status).toBe('valid');
    if (record.status === 'valid') {
      expect(record.value.writerType).toBe('standalone');
      expect(record.value.writerInstanceId).toBe('st');
      expect(record.value.epoch).toBe(1);
    }

    stopSidepanel();
    stopStandalone();
  });

  it('reclaims side panel ownership after the writer election is relinquished', async () => {
    const rig = createRig();
    const sidepanelElection = rig.election('sidepanel', 'sp');
    await sidepanelElection.claim('initial');
    const coordinator = rig.coordinator('sidepanel', 'sp', sidepanelElection);

    const stop = coordinator.start();
    await rig.storage.remove('np_workspace_election');
    rig.chromeStorage.emitStorageChange(
      { np_workspace_election: { newValue: undefined } },
      'session',
    );

    await vi.waitFor(async () => {
      const record = await rig.storage.read('np_workspace_election', ElectionRecordSchema);
      expect(record.status).toBe('valid');
    });

    stop();
  });

  it('routes a missing-record recovery through the election client as a fallback claim', async () => {
    const rig = createRig();
    const electionClient = rig.election('sidepanel', 'sp');
    const claimSpy = vi.spyOn(electionClient, 'claim');
    const coordinator = rig.coordinator('sidepanel', 'sp', electionClient);

    const stop = coordinator.start();
    await rig.storage.remove('np_workspace_election');
    rig.chromeStorage.emitStorageChange(
      { np_workspace_election: { newValue: undefined } },
      'session',
    );

    await vi.waitFor(() => {
      expect(claimSpy).toHaveBeenCalledWith('fallback');
    });

    stop();
  });

  it('routes an invalid-record recovery through the election client as stale recovery', async () => {
    const rig = createRig();
    rig.chromeStorage.session._setRaw('np_workspace_election', { writerType: 'broken' });
    const electionClient = rig.election('sidepanel', 'sp');
    const claimSpy = vi.spyOn(electionClient, 'claim');
    const coordinator = rig.coordinator('sidepanel', 'sp', electionClient);

    const stop = coordinator.start();
    rig.chromeStorage.emitStorageChange(
      { np_workspace_election: { newValue: { writerType: 'broken' } } },
      'session',
    );

    await vi.waitFor(() => {
      expect(claimSpy).toHaveBeenCalledWith('stale-recovery');
    });
    await vi.waitFor(async () => {
      const record = await rig.storage.read('np_workspace_election', ElectionRecordSchema);
      expect(record.status).toBe('valid');
    });

    stop();
  });

  it('mirrors a current-epoch next-version mutation', async () => {
    const rig = createRig();
    await rig.storage.write('np_workspace_election', ElectionRecordSchema, standaloneRecord());
    const coordinator = rig.coordinator('sidepanel', 'sp');

    await expect(coordinator.handleMutation(mutationEnvelope(1, 0))).resolves.toEqual({
      status: 'mirrored',
    });
  });

  it('requests rehydration when a mutation arrives with a version gap', async () => {
    const rig = createRig();
    const coordinator = rig.coordinator('sidepanel', 'sp');
    await rig.store.writeMetadata({ schemaVersion: 1, committedVersion: 0, updatedAt: 1 });

    await expect(coordinator.handleMutation(mutationEnvelope(5, 0))).resolves.toEqual({
      status: 'rehydrated',
    });
    expect(rig.bus.sent.some((envelope) => envelope.type === 'workspace.rehydrate.request')).toBe(
      true,
    );
  });

  it('relinquishes only when the local surface is the current writer', async () => {
    const rig = createRig();
    const sidepanelElection = rig.election('sidepanel', 'sp');
    await sidepanelElection.claim('initial');
    const coordinator = rig.coordinator('sidepanel', 'sp', sidepanelElection);

    await expect(coordinator.handleRelinquish(relinquishEnvelope())).resolves.toEqual({
      status: 'relinquished',
    });
    await expect(rig.storage.read('np_workspace_election', ElectionRecordSchema)).resolves.toEqual({
      status: 'missing',
    });
  });

  it('ignores a relinquish from a non-writer', async () => {
    const rig = createRig();
    await rig.storage.write('np_workspace_election', ElectionRecordSchema, standaloneRecord());
    const coordinator = rig.coordinator('sidepanel', 'sp');

    await expect(coordinator.handleRelinquish(relinquishEnvelope())).resolves.toEqual({
      status: 'noop',
    });
  });

  it('acknowledges the handoff record before sending the handoff ack', async () => {
    const rig = createRig();
    await rig.storage.write('np_workspace_election', ElectionRecordSchema, sidepanelRecord(0));
    await rig.handoff('sidepanel', 'sp').prepare({ instanceId: 'st', writerType: 'standalone' }, 0);
    const standalone = rig.coordinator('standalone', 'st');

    await expect(
      standalone.handleHandoffPrepare(
        createHandoffPrepareEnvelope({ toInstanceId: 'st', epoch: 0, baseVersion: 0 }, 'sidepanel'),
      ),
    ).resolves.toEqual({ status: 'acknowledged' });
    await expect(
      rig.storage.read('np_workspace_handoff', HandoffRecordSchema),
    ).resolves.toMatchObject({ status: 'valid', value: { phase: 'acknowledged' } });
  });

  it('commits ownership through the arbiter on handoff ack', async () => {
    const rig = createRig();
    await rig.storage.write('np_workspace_election', ElectionRecordSchema, sidepanelRecord(0));
    const sidepanelHandoff = rig.handoff('sidepanel', 'sp');
    await sidepanelHandoff.prepare({ instanceId: 'st', writerType: 'standalone' }, 0);
    await sidepanelHandoff.acknowledge(0, 0);
    const sidepanel = rig.coordinator(
      'sidepanel',
      'sp',
      rig.election('sidepanel', 'sp'),
      sidepanelHandoff,
    );

    await expect(
      sidepanel.handleHandoffAck(
        createHandoffAckEnvelope(
          { toInstanceId: 'st', epoch: 0, committedVersion: 0 },
          'standalone',
        ),
      ),
    ).resolves.toEqual({ status: 'committed' });
    await expect(
      rig.storage.read('np_workspace_election', ElectionRecordSchema),
    ).resolves.toMatchObject({
      status: 'valid',
      value: { writerType: 'standalone', writerInstanceId: 'st', epoch: 1 },
    });
    await expect(rig.storage.read('np_workspace_handoff', HandoffRecordSchema)).resolves.toEqual({
      status: 'missing',
    });
  });
});
