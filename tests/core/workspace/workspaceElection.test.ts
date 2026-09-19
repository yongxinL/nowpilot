import { describe, expect, it, vi } from 'vitest';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import { createValidatedStorage } from '@/core/storage/chromeStorage';
import { createWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { createWorkspaceElection } from '@/core/workspace/WorkspaceElection';
import { ElectionRecordSchema, type ElectionRecord } from '@/core/workspace/workspaceTypes';
import { createOperationId } from '@/core/runtime/OperationId';
import type { BroadcastBus } from '@/core/runtime/BroadcastBus';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import type { MessageType } from '@/core/runtime/MessageType';
import type {
  WorkspaceElectionRequestPayload,
  WorkspaceElectionResponsePayload,
} from '@/core/runtime/messageSchemas';

type Handler = (envelope: RuntimeEnvelope, sender?: unknown) => void;

interface FakeBus {
  bus: Pick<BroadcastBus, 'send' | 'on'>;
  sent: RuntimeEnvelope[];
  setResponder(
    responder: (envelope: RuntimeEnvelope) => WorkspaceElectionResponsePayload | undefined,
  ): void;
  emit(envelope: unknown): void;
}

function createFakeBus(): FakeBus {
  const handlers = new Map<MessageType, Set<Handler>>();
  const sent: RuntimeEnvelope[] = [];
  let responder:
    ((envelope: RuntimeEnvelope) => WorkspaceElectionResponsePayload | undefined) | undefined;

  function emitFor(envelope: RuntimeEnvelope): void {
    for (const handler of handlers.get(envelope.type) ?? []) handler(envelope);
  }

  return {
    bus: {
      async send(envelope) {
        sent.push(envelope);
        const payload = responder?.(envelope);
        if (payload) {
          const request = envelope as RuntimeEnvelope & {
            type: 'workspace.election.request';
            payload: WorkspaceElectionRequestPayload;
          };
          emitFor({
            envelopeVersion: 1,
            id: createOperationId(),
            type: 'workspace.election.response',
            source: 'background',
            target: envelope.source,
            timestamp: 1,
            correlationId: envelope.id,
            payload: { ...payload, requestId: request.payload.requestId },
          });
        }
      },
      on(type, handler) {
        const set = handlers.get(type) ?? new Set<Handler>();
        set.add(handler);
        handlers.set(type, set);
        return () => {
          set.delete(handler);
        };
      },
    },
    sent,
    setResponder(next) {
      responder = next;
    },
    emit(envelope) {
      emitFor(envelope as RuntimeEnvelope);
    },
  };
}

function record(
  writerType: 'sidepanel' | 'standalone',
  writerInstanceId: string,
  epoch = 0,
  committedVersion = 0,
): ElectionRecord {
  return {
    writerType,
    writerInstanceId,
    epoch,
    committedVersion,
    handoffPhase: 'idle',
    handoffTargetInstanceId: null,
    updatedAt: 500,
    recentCompletedRequests: [],
  };
}

function setup(writerType: 'sidepanel' | 'standalone' = 'sidepanel') {
  const chromeStorage = createChromeStorageMock();
  const storage = createValidatedStorage(chromeStorage);
  const store = createWorkspaceStore(storage);
  const fake = createFakeBus();
  const election = createWorkspaceElection({
    storage,
    store,
    bus: fake.bus,
    writerType,
    instanceId: `${writerType}-instance`,
    now: () => 500,
  });
  return { chromeStorage, storage, store, fake, election };
}

function requestPayload(envelope: RuntimeEnvelope): WorkspaceElectionRequestPayload {
  return envelope.payload as WorkspaceElectionRequestPayload;
}

function responseEnvelope(
  request: RuntimeEnvelope,
  payload: WorkspaceElectionResponsePayload,
  overrides: Record<string, unknown> = {},
): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.election.response',
    source: 'background',
    target: request.source,
    timestamp: 1,
    correlationId: request.id,
    payload,
    ...overrides,
  } as RuntimeEnvelope;
}

const flushAsync = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('workspace election client', () => {
  it('reads a missing election record', async () => {
    const { election } = setup();
    await expect(election.read()).resolves.toEqual({ status: 'missing' });
  });

  it('reads a valid election record', async () => {
    const { election, storage } = setup();
    const mine = record('sidepanel', 'sidepanel-instance');
    await storage.write('np_workspace_election', ElectionRecordSchema, mine);
    await expect(election.read()).resolves.toEqual({ status: 'valid', record: mine });
  });

  it('reads an invalid election record without throwing', async () => {
    const { election, chromeStorage } = setup();
    chromeStorage.session._setRaw('np_workspace_election', { writerType: 'broken' });
    await expect(election.read()).resolves.toEqual({ status: 'invalid' });
  });

  it('reports whether a record belongs to this instance', () => {
    const { election } = setup();
    const mine = record('sidepanel', 'sidepanel-instance');
    expect(election.isWriter(mine)).toBe(true);
    expect(election.isWriter(undefined)).toBe(false);
    expect(election.isWriter({ ...mine, writerInstanceId: 'other' })).toBe(false);
    expect(election.isWriter({ ...mine, writerType: 'standalone' })).toBe(false);
  });

  it('claims through the canonical bus and returns acquired on acceptance', async () => {
    const { election, fake } = setup();
    const mine = record('sidepanel', 'sidepanel-instance');
    fake.setResponder((envelope) => ({
      requestId: requestPayload(envelope).requestId,
      accepted: true,
      record: mine,
    }));
    const result = await election.claim('initial');
    expect(result).toEqual({ status: 'acquired', record: mine, recovered: false });
    const sent = fake.sent[0];
    expect(sent?.type).toBe('workspace.election.request');
    expect(sent?.source).toBe('sidepanel');
    expect(sent?.target).toBe('background');
    const payload = requestPayload(sent as RuntimeEnvelope);
    expect(payload).toMatchObject({
      operation: 'claim',
      requesterInstanceId: 'sidepanel-instance',
      requesterWriterType: 'sidepanel',
      reason: 'initial',
    });
  });

  it('marks a non-initial claim as recovered', async () => {
    const { election, fake } = setup();
    fake.setResponder((envelope) => ({
      requestId: requestPayload(envelope).requestId,
      accepted: true,
      record: record('sidepanel', 'sidepanel-instance', 1),
    }));
    await expect(election.claim('stale-recovery')).resolves.toMatchObject({
      status: 'acquired',
      recovered: true,
    });
  });

  it('carries the committed workspace version into the claim request', async () => {
    const { election, fake, store } = setup();
    await store.writeVersion(4, 1);
    fake.setResponder((envelope) => ({
      requestId: requestPayload(envelope).requestId,
      accepted: true,
      record: record('sidepanel', 'sidepanel-instance', 0, 4),
    }));
    await election.claim('initial');
    expect(requestPayload(fake.sent[0] as RuntimeEnvelope).committedVersion).toBe(4);
  });

  it('returns held with the existing record when the claim is rejected', async () => {
    const { election, fake, storage } = setup();
    const other = record('standalone', 'standalone-instance', 2, 1);
    await storage.write('np_workspace_election', ElectionRecordSchema, other);
    fake.setResponder((envelope) => ({
      requestId: requestPayload(envelope).requestId,
      accepted: false,
      code: 'WORKSPACE_ELECTION_REJECTED',
    }));
    await expect(election.claim('initial')).resolves.toEqual({ status: 'held', record: other });
  });

  it('returns rejected when the claim is rejected and no record exists', async () => {
    const { election, fake } = setup();
    fake.setResponder((envelope) => ({
      requestId: requestPayload(envelope).requestId,
      accepted: false,
      code: 'WORKSPACE_ELECTION_REJECTED',
    }));
    await expect(election.claim('initial')).resolves.toEqual({
      status: 'rejected',
      code: 'WORKSPACE_ELECTION_REJECTED',
    });
  });

  it('relinquishes through the canonical bus and returns the outcome', async () => {
    const { election, fake } = setup();
    fake.setResponder((envelope) => ({
      requestId: requestPayload(envelope).requestId,
      accepted: true,
    }));
    await expect(election.relinquish()).resolves.toEqual({ accepted: true });
    expect(requestPayload(fake.sent[0] as RuntimeEnvelope).operation).toBe('relinquish');
  });

  it('returns the canonical code when relinquish is rejected', async () => {
    const { election, fake } = setup();
    fake.setResponder((envelope) => ({
      requestId: requestPayload(envelope).requestId,
      accepted: false,
      code: 'WORKSPACE_ELECTION_REJECTED',
    }));
    await expect(election.relinquish()).resolves.toEqual({
      accepted: false,
      code: 'WORKSPACE_ELECTION_REJECTED',
    });
  });

  it('ignores a response with a different correlationId', async () => {
    const { election, fake } = setup();
    const promise = election.claim('initial');
    let settled = false;
    void promise.then(() => {
      settled = true;
    });
    await flushAsync();
    const request = fake.sent[0] as RuntimeEnvelope;
    fake.emit(
      responseEnvelope(
        request,
        { requestId: requestPayload(request).requestId, accepted: true },
        {
          correlationId: createOperationId(),
        },
      ),
    );
    await flushAsync();
    expect(settled).toBe(false);
    fake.emit(
      responseEnvelope(request, {
        requestId: requestPayload(request).requestId,
        accepted: true,
        record: record('sidepanel', 'sidepanel-instance'),
      }),
    );
    await expect(promise).resolves.toMatchObject({ status: 'acquired' });
  });

  it('rejects wildcard and mis-targeted responses', async () => {
    const { election, fake } = setup();
    const promise = election.claim('initial');
    let settled = false;
    void promise.then(() => {
      settled = true;
    });
    await flushAsync();
    const request = fake.sent[0] as RuntimeEnvelope;
    const payload: WorkspaceElectionResponsePayload = {
      requestId: requestPayload(request).requestId,
      accepted: true,
      record: record('sidepanel', 'sidepanel-instance'),
    };
    fake.emit(responseEnvelope(request, payload, { target: '*' }));
    fake.emit(responseEnvelope(request, payload, { target: 'standalone' }));
    await flushAsync();
    expect(settled).toBe(false);
    fake.emit(responseEnvelope(request, payload));
    await expect(promise).resolves.toMatchObject({ status: 'acquired' });
  });

  it('never writes the election record directly', async () => {
    const { election, fake, storage } = setup();
    const writeSpy = vi.spyOn(storage, 'write');
    fake.setResponder((envelope) => ({
      requestId: requestPayload(envelope).requestId,
      accepted: true,
      record: record('sidepanel', 'sidepanel-instance'),
    }));
    await election.claim('initial');
    expect(writeSpy).not.toHaveBeenCalled();
    writeSpy.mockRestore();
  });
});
