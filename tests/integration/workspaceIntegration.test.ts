import { describe, expect, it, vi } from 'vitest';
import { createChromeStorageMock, type ChromeStorageMock } from '../helpers/chromeMock';
import { createValidatedStorage, type ValidatedStorage } from '@/core/storage/chromeStorage';
import type { BroadcastBus, EnvelopeHandler } from '@/core/runtime/BroadcastBus';
import type { MessageType } from '@/core/runtime/MessageType';
import { createOperationId } from '@/core/runtime/OperationId';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import type {
  WorkspaceElectionRequestPayload,
  WorkspaceElectionResponsePayload,
} from '@/core/runtime/messageSchemas';
import { createThemeStore } from '@/core/theme/ThemeStore';
import {
  createWorkspaceElection,
  type ElectionClaimResult,
  type WorkspaceElection,
} from '@/core/workspace/WorkspaceElection';
import {
  createWorkspaceElectionArbiter,
  type WorkspaceElectionArbiter,
} from '@/core/workspace/WorkspaceElectionArbiter';
import { createWorkspaceHandoff } from '@/core/workspace/WorkspaceHandoff';
import { createWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import {
  applyMirrorEnvelope,
  classifyMirrorEnvelope,
  createWorkspaceCoordinator,
  type CoordinatorStep,
  type WorkspaceCoordinator,
} from '@/core/workspace/WorkspaceSync';
import { ElectionRecordSchema } from '@/core/workspace/workspaceTypes';

const NOW = 1;

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

interface TestBus extends Pick<BroadcastBus, 'send' | 'on'> {
  sent: RuntimeEnvelope[];
  electionRequests: RuntimeEnvelope[];
}

function createInMemoryBus(arbiter: WorkspaceElectionArbiter): TestBus {
  const handlers = new Map<MessageType, Set<EnvelopeHandler>>();
  const sent: RuntimeEnvelope[] = [];
  const electionRequests: RuntimeEnvelope[] = [];

  async function dispatch(envelope: RuntimeEnvelope): Promise<void> {
    for (const handler of handlers.get(envelope.type) ?? []) await handler(envelope, undefined);
  }

  return {
    sent,
    electionRequests,
    async send(envelope) {
      sent.push(envelope);
      if (envelope.type === 'workspace.election.request') {
        electionRequests.push(envelope);
        const response = await arbiter.handle(envelope.payload);
        await dispatch({
          envelopeVersion: 1,
          id: createOperationId(),
          type: 'workspace.election.response',
          source: 'background',
          target: envelope.source,
          timestamp: NOW,
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

interface IntegrationRig {
  chromeStorage: ChromeStorageMock;
  storage: ValidatedStorage;
  store: ReturnType<typeof createWorkspaceStore>;
  arbiterHandle: ReturnType<typeof vi.fn>;
  bus: TestBus;
  election(surface: 'sidepanel' | 'standalone', instanceId: string): WorkspaceElection;
  coordinator(
    surface: 'sidepanel' | 'standalone',
    instanceId: string,
    electionClient?: WorkspaceElection,
  ): WorkspaceCoordinator;
}

function createRig(existing?: ChromeStorageMock): IntegrationRig {
  const chromeStorage = existing ?? createChromeStorageMock();
  const storage = createValidatedStorage(chromeStorage);
  const store = createWorkspaceStore(storage);
  const realArbiter = createWorkspaceElectionArbiter({ storage, now: () => NOW });
  const arbiterHandle = vi.fn((request: WorkspaceElectionRequestPayload) =>
    realArbiter.handle(request),
  );
  const arbiter: WorkspaceElectionArbiter = { handle: arbiterHandle };
  const bus = createInMemoryBus(arbiter);

  function election(surface: 'sidepanel' | 'standalone', instanceId: string): WorkspaceElection {
    return createWorkspaceElection({
      storage,
      store,
      bus,
      writerType: surface,
      instanceId,
      now: () => NOW,
    });
  }

  function coordinator(
    surface: 'sidepanel' | 'standalone',
    instanceId: string,
    electionClient: WorkspaceElection = election(surface, instanceId),
  ): WorkspaceCoordinator {
    return createWorkspaceCoordinator({
      bus,
      surface,
      instanceId,
      storage,
      election: electionClient,
      handoff: createWorkspaceHandoff({
        storage,
        writerType: surface,
        instanceId,
        now: () => NOW,
        submitElectionRequest: (payload) => arbiter.handle(payload),
      }),
      store,
    });
  }

  return { chromeStorage, storage, store, arbiterHandle, bus, election, coordinator };
}

function handoffCommitRequest(
  expectedEpoch: number,
  committedVersion = 0,
): WorkspaceElectionRequestPayload {
  return {
    requestId: createOperationId(),
    operation: 'handoff-commit',
    requesterInstanceId: 'sp-1',
    requesterWriterType: 'sidepanel',
    committedVersion,
    expectedEpoch,
    targetInstanceId: 'st',
    targetWriterType: 'standalone',
  };
}

function recoveryClaimRequest(
  instanceId: string,
  expectedEpoch: number,
  committedVersion = 0,
): WorkspaceElectionRequestPayload {
  return {
    requestId: createOperationId(),
    operation: 'claim',
    requesterInstanceId: instanceId,
    requesterWriterType: 'sidepanel',
    committedVersion,
    reason: 'stale-recovery',
    expectedEpoch,
  };
}

describe('workspace integration', () => {
  it('converges on exactly one writer across two surfaces through the background arbiter', async () => {
    const rig = createRig();
    const sidepanel = rig.election('sidepanel', 'sp');
    const standalone = rig.election('standalone', 'st');

    const [spResult, stResult] = await Promise.all([
      sidepanel.claim('initial'),
      standalone.claim('initial'),
    ]);

    const results = [spResult, stResult];
    const acquired = results.filter(
      (result): result is Extract<ElectionClaimResult, { status: 'acquired' }> =>
        result.status === 'acquired',
    );
    const held = results.filter(
      (result): result is Extract<ElectionClaimResult, { status: 'held' }> =>
        result.status === 'held',
    );

    expect(acquired).toHaveLength(1);
    expect(held).toHaveLength(1);
    expect(held[0]!.record.writerInstanceId).toBe(acquired[0]!.record.writerInstanceId);
    expect(held[0]!.record.writerType).toBe(acquired[0]!.record.writerType);
    expect(held[0]!.record.epoch).toBe(acquired[0]!.record.epoch);

    const persisted = await rig.storage.read('np_workspace_election', ElectionRecordSchema);
    expect(persisted.status).toBe('valid');
    if (persisted.status === 'valid') {
      expect(persisted.value.writerInstanceId).toBe(acquired[0]!.record.writerInstanceId);
      expect(persisted.value.writerType).toBe(acquired[0]!.record.writerType);
    }
  });

  it('increases the epoch monotonically across claim, handoff-commit, and recovery', async () => {
    const rig = createRig();
    const sidepanel = rig.election('sidepanel', 'sp-1');
    const standalone = rig.election('standalone', 'st');

    const claim = await sidepanel.claim('initial');
    expect(claim.status).toBe('acquired');
    const claimRecord = claim.status === 'acquired' ? claim.record : undefined;
    expect(claimRecord?.epoch).toBe(0);
    expect(claimRecord?.writerInstanceId).toBe('sp-1');

    const commit = await sidepanel.request(handoffCommitRequest(claimRecord!.epoch));
    expect(commit.accepted).toBe(true);
    expect(commit.record?.writerInstanceId).toBe('st');
    expect(commit.record?.writerType).toBe('standalone');

    const recovery = await sidepanel.request(recoveryClaimRequest('sp-1', commit.record!.epoch));
    expect(recovery.accepted).toBe(true);
    expect(recovery.record?.writerInstanceId).toBe('sp-1');

    const epochs = [claimRecord!.epoch, commit.record!.epoch, recovery.record!.epoch];
    expect(epochs).toEqual([0, 1, 2]);
    expect(new Set(epochs).size).toBe(epochs.length);
    for (let index = 1; index < epochs.length; index += 1) {
      expect(epochs[index]!).toBeGreaterThan(epochs[index - 1]!);
    }

    const persisted = await rig.storage.read('np_workspace_election', ElectionRecordSchema);
    expect(persisted.status).toBe('valid');
    if (persisted.status === 'valid') {
      expect(persisted.value.epoch).toBe(2);
      expect(persisted.value.writerInstanceId).toBe('sp-1');
    }
    // standalone remains a read-only surface and never gained a second live writer.
    await expect(standalone.read()).resolves.toMatchObject({
      status: 'valid',
      record: { writerInstanceId: 'sp-1', epoch: 2 },
    });
  });

  it('serialises a handoff-commit and a fallback claim so exactly one new epoch results', async () => {
    const rig = createRig();
    const writer = rig.election('sidepanel', 'sp-1');
    const other = rig.election('sidepanel', 'sp-2');

    const initial = await writer.claim('initial');
    expect(initial.status).toBe('acquired');
    const startEpoch = initial.status === 'acquired' ? initial.record.epoch : -1;
    expect(startEpoch).toBe(0);

    const [commit, fallback] = await Promise.all([
      writer.request(handoffCommitRequest(startEpoch)),
      other.request({
        requestId: createOperationId(),
        operation: 'claim',
        requesterInstanceId: 'sp-2',
        requesterWriterType: 'sidepanel',
        committedVersion: 0,
        reason: 'fallback',
        expectedEpoch: startEpoch,
      }),
    ]);

    const responses: WorkspaceElectionResponsePayload[] = [commit, fallback];
    const accepted = responses.filter((response) => response.accepted);
    const rejected = responses.filter((response) => !response.accepted);
    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.code).toBe('WORKSPACE_ELECTION_REJECTED');
    expect(accepted[0]!.record?.epoch).toBe(startEpoch + 1);

    const persisted = await rig.storage.read('np_workspace_election', ElectionRecordSchema);
    expect(persisted).toMatchObject({
      status: 'valid',
      value: { epoch: startEpoch + 1 },
    });
    const onlyWinner = accepted[0]!.record;
    if (persisted.status === 'valid') {
      expect(persisted.value.writerInstanceId).toBe(onlyWinner?.writerInstanceId);
      expect(persisted.value.epoch).toBe(onlyWinner?.epoch);
    }
  });

  it('reconstructs the same decision from persisted session state after a service-worker restart', async () => {
    const chromeStorage = createChromeStorageMock();
    const firstRig = createRig(chromeStorage);
    const request: WorkspaceElectionRequestPayload = {
      requestId: createOperationId(),
      operation: 'claim',
      requesterInstanceId: 'sp',
      requesterWriterType: 'sidepanel',
      committedVersion: 0,
      reason: 'initial',
    };

    const first = await firstRig.election('sidepanel', 'sp').request(request);
    expect(first.accepted).toBe(true);
    expect(first.record?.epoch).toBe(0);
    const persisted = await firstRig.storage.read('np_workspace_election', ElectionRecordSchema);
    expect(persisted.status).toBe('valid');
    const before = persisted.status === 'valid' ? persisted.value : undefined;
    expect(before?.writerInstanceId).toBe('sp');

    const restartedRig = createRig(chromeStorage);
    const read = await restartedRig.election('sidepanel', 'sp').read();
    expect(read.status).toBe('valid');
    if (read.status === 'valid') {
      expect(read.record.writerInstanceId).toBe('sp');
      expect(read.record.epoch).toBe(0);
    }

    const duplicate = await restartedRig.election('sidepanel', 'sp').request(request);
    expect(duplicate.accepted).toBe(true);
    expect(duplicate.record?.epoch).toBe(before?.epoch);
    expect(duplicate.record).toEqual(before);
    await expect(
      restartedRig.storage.read('np_workspace_election', ElectionRecordSchema),
    ).resolves.toEqual(persisted);
    expect(restartedRig.arbiterHandle).toHaveBeenCalledTimes(1);
  });

  it('never routes an ordinary workspace.mutation through the arbiter or changes the election record', async () => {
    const rig = createRig();
    const sidepanel = rig.election('sidepanel', 'sp');
    const claimed = await sidepanel.claim('initial');
    expect(claimed.status).toBe('acquired');
    await rig.store.writeMetadata({ schemaVersion: 1, committedVersion: 0, updatedAt: NOW });

    const arbiterCallsAfterClaim = rig.arbiterHandle.mock.calls.length;
    const rawBefore = rig.chromeStorage.session._data.get('np_workspace_election');
    const recordBefore = await rig.storage.read('np_workspace_election', ElectionRecordSchema);
    expect(recordBefore.status).toBe('valid');
    expect(rig.bus.electionRequests).toHaveLength(1);

    const coordinator = rig.coordinator('sidepanel', 'sp', sidepanel);
    let step: CoordinatorStep | undefined;
    const off = rig.bus.on('workspace.mutation', async (envelope) => {
      step = await coordinator.handleMutation(envelope);
    });
    await rig.bus.send(mutationEnvelope(1, 0));
    off();

    expect(step).toEqual({ status: 'mirrored' });
    expect(rig.arbiterHandle.mock.calls.length).toBe(arbiterCallsAfterClaim);
    expect(rig.bus.electionRequests).toHaveLength(1);
    expect(rig.chromeStorage.session._data.get('np_workspace_election')).toBe(rawBefore);
    await expect(rig.storage.read('np_workspace_election', ElectionRecordSchema)).resolves.toEqual(
      recordBefore,
    );
  });

  it('applies ordered mirror versions, ignores duplicates, and rehydrates a gap', () => {
    let state = { epoch: 0, committedVersion: 0 };
    state = applyMirrorEnvelope(state, mutationEnvelope(1)).state;
    state = applyMirrorEnvelope(state, mutationEnvelope(2)).state;
    expect(state.committedVersion).toBe(2);
    expect(applyMirrorEnvelope(state, mutationEnvelope(2)).decision).toEqual({
      action: 'ignore',
      reason: 'duplicate',
    });
    expect(classifyMirrorEnvelope(state, mutationEnvelope(5))).toEqual({
      action: 'rehydrate',
      reason: 'gap',
    });
  });

  it('survives a service-worker-style restart without losing workspace state', async () => {
    const chromeStorage = createChromeStorageMock();
    const first = createWorkspaceStore(createValidatedStorage(chromeStorage));
    await first.writeMetadata({ schemaVersion: 1, committedVersion: 6, updatedAt: 10 });
    const afterRestart = createWorkspaceStore(createValidatedStorage(chromeStorage));
    await expect(afterRestart.readMetadata()).resolves.toEqual({
      status: 'valid',
      metadata: { schemaVersion: 1, committedVersion: 6, updatedAt: 10 },
    });
    await expect(afterRestart.readVersion()).resolves.toBe(6);
  });

  it('propagates theme changes to a second surface independently of election', async () => {
    const chromeStorage = createChromeStorageMock();
    const surfaceA = createThemeStore(createValidatedStorage(chromeStorage));
    const surfaceB = createThemeStore(createValidatedStorage(chromeStorage));
    const listener = vi.fn();
    const unsubscribe = surfaceB.subscribe(listener);
    await surfaceA.writePack('claude-warm');
    chromeStorage.emitStorageChange({ np_theme_pack: { newValue: 'claude-warm' } }, 'sync');
    await vi.waitFor(() =>
      expect(listener).toHaveBeenCalledWith({ mode: 'auto', pack: 'claude-warm' }),
    );
    unsubscribe();

    await expect(
      createValidatedStorage(chromeStorage).read('np_workspace_election', ElectionRecordSchema),
    ).resolves.toEqual({ status: 'missing' });
  });
});
