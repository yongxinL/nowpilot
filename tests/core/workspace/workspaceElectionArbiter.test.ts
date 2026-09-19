import { describe, expect, it, vi } from 'vitest';
import { z, type ZodType } from 'zod';
import { createChromeStorageMock } from '../../helpers/chromeMock';
import {
  createValidatedStorage,
  type StorageKey,
  type StorageReadResult,
  type ValidatedStorage,
} from '@/core/storage/chromeStorage';
import { createOperationId } from '@/core/runtime/OperationId';
import {
  createBackgroundElectionMessageListener,
  createElectionSerialExecutor,
  createWorkspaceElectionArbiter,
  type BackgroundElectionMessageListener,
  type WorkspaceElectionArbiter,
} from '@/core/workspace/WorkspaceElectionArbiter';
import {
  ElectionIdempotencyRecordSchema,
  ElectionRecordSchema,
  type ElectionIdempotencyRecord,
  type ElectionRecord,
} from '@/core/workspace/workspaceTypes';
import type {
  WorkspaceElectionRequestPayload,
  WorkspaceElectionResponsePayload,
} from '@/core/runtime/messageSchemas';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';

const NOW = 1000;
const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';

type Requester = {
  requesterInstanceId: string;
  requesterWriterType: 'sidepanel' | 'standalone';
};

const SP1: Requester = { requesterInstanceId: 'sp-1', requesterWriterType: 'sidepanel' };
const SP2: Requester = { requesterInstanceId: 'sp-2', requesterWriterType: 'sidepanel' };
const SA1: Requester = { requesterInstanceId: 'sa-1', requesterWriterType: 'standalone' };

function makeStorage(): ValidatedStorage {
  return createValidatedStorage(createChromeStorageMock());
}

function makeArbiter(storage: ValidatedStorage, now = NOW): WorkspaceElectionArbiter {
  return createWorkspaceElectionArbiter({ storage, now: () => now });
}

function electionRequest(
  overrides: Partial<WorkspaceElectionRequestPayload> = {},
): WorkspaceElectionRequestPayload {
  return {
    requestId: createOperationId(),
    operation: 'claim',
    ...SP1,
    committedVersion: 0,
    reason: 'initial',
    ...overrides,
  };
}

function baseRecord(
  writer = SP1,
  epoch = 0,
  committedVersion = 0,
): Omit<ElectionRecord, 'recentCompletedRequests'> {
  return {
    writerType: writer.requesterWriterType,
    writerInstanceId: writer.requesterInstanceId,
    epoch,
    committedVersion,
    handoffPhase: 'idle',
    handoffTargetInstanceId: null,
    updatedAt: 1,
  };
}

async function readElection(storage: ValidatedStorage): Promise<StorageReadResult<ElectionRecord>> {
  return storage.read('np_workspace_election', ElectionRecordSchema);
}

function acceptedRecord(response: WorkspaceElectionResponsePayload): ElectionRecord {
  expect(response.accepted).toBe(true);
  if (!response.record) throw new Error('expected an accepted response with a record');
  return response.record;
}

function ledgerEntry(requestId: string, epoch: number, accepted = true): ElectionIdempotencyRecord {
  return {
    request: {
      requestId,
      operation: 'claim',
      requesterInstanceId: 'seed',
      requesterWriterType: 'sidepanel',
      committedVersion: 0,
    },
    accepted,
    ...(accepted ? {} : { code: 'WORKSPACE_ELECTION_REJECTED' as const }),
    epoch,
    completedAt: 1,
  };
}

function tamperSecondElectionRead(
  storage: ValidatedStorage,
  replacement: ElectionRecord,
): ValidatedStorage {
  let electionReads = 0;
  return {
    read<T>(key: StorageKey, schema: ZodType<T>): Promise<StorageReadResult<T>> {
      if (key === 'np_workspace_election') {
        electionReads += 1;
        if (electionReads === 2) {
          return Promise.resolve({ status: 'valid', value: replacement as unknown as T });
        }
      }
      return storage.read(key, schema);
    },
    write: storage.write.bind(storage),
    remove: storage.remove.bind(storage),
    subscribe: storage.subscribe.bind(storage),
  };
}

const flushAsync = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('election serial executor', () => {
  it('runs operations strictly in call order and survives a rejection', async () => {
    const executor = createElectionSerialExecutor();
    const order: string[] = [];
    const first = executor.runExclusive(async () => {
      order.push('a');
    });
    const second = executor.runExclusive(async () => {
      order.push('b');
      throw new Error('operation failed');
    });
    const third = executor.runExclusive(async () => {
      order.push('c');
    });
    await expect(second).rejects.toThrow('operation failed');
    await first;
    await third;
    expect(order).toEqual(['a', 'b', 'c']);
  });
});

describe('workspace election arbiter', () => {
  it('elects exactly one writer for two simultaneous initial claims', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    const [first, second] = await Promise.all([
      arbiter.handle(electionRequest({ ...SP1 })),
      arbiter.handle(electionRequest({ ...SP2 })),
    ]);
    const responses = [first, second];
    const winners = responses.filter((response) => response.accepted);
    const losers = responses.filter((response) => !response.accepted);
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(1);
    expect(losers[0]!.code).toBe('WORKSPACE_ELECTION_REJECTED');
    expect(losers[0]!.record).toBeUndefined();
    const persisted = await readElection(storage);
    expect(persisted.status).toBe('valid');
    if (persisted.status === 'valid') {
      expect(persisted.value.writerInstanceId).toBe(acceptedRecord(winners[0]!).writerInstanceId);
    }
  });

  it('persists the winning record before returning accepted', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    const response = await arbiter.handle(electionRequest({ ...SP1 }));
    const record = acceptedRecord(response);
    await expect(readElection(storage)).resolves.toEqual({ status: 'valid', value: record });
  });

  it('never issues the same epoch to two successful ownership changes', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    const claim = await arbiter.handle(electionRequest({ ...SP1 }));
    const commit = await arbiter.handle(
      electionRequest({
        operation: 'handoff-commit',
        expectedEpoch: 0,
        targetInstanceId: SA1.requesterInstanceId,
        targetWriterType: SA1.requesterWriterType,
      }),
    );
    const claimRecord = acceptedRecord(claim);
    const commitRecord = acceptedRecord(commit);
    expect(commitRecord.epoch).not.toBe(claimRecord.epoch);
    expect(commitRecord).toMatchObject({
      writerInstanceId: SA1.requesterInstanceId,
      writerType: SA1.requesterWriterType,
      epoch: claimRecord.epoch + 1,
    });
  });

  it('increases the epoch monotonically across claim, handoff and recovery', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    const claim = acceptedRecord(await arbiter.handle(electionRequest({ ...SP1 })));
    const commit = acceptedRecord(
      await arbiter.handle(
        electionRequest({
          operation: 'handoff-commit',
          expectedEpoch: claim.epoch,
          targetInstanceId: SA1.requesterInstanceId,
          targetWriterType: SA1.requesterWriterType,
        }),
      ),
    );
    const recovery = acceptedRecord(
      await arbiter.handle(
        electionRequest({ ...SP2, reason: 'stale-recovery', expectedEpoch: commit.epoch }),
      ),
    );
    expect([claim.epoch, commit.epoch, recovery.epoch]).toEqual([0, 1, 2]);
  });

  it('rejects a stale claim whose expectedEpoch is behind the persisted epoch', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    const claim = acceptedRecord(await arbiter.handle(electionRequest({ ...SP1 })));
    await arbiter.handle(
      electionRequest({
        operation: 'handoff-commit',
        expectedEpoch: claim.epoch,
        targetInstanceId: SA1.requesterInstanceId,
        targetWriterType: SA1.requesterWriterType,
      }),
    );
    const stale = await arbiter.handle(
      electionRequest({ ...SP2, reason: 'stale-recovery', expectedEpoch: claim.epoch }),
    );
    expect(stale).toMatchObject({ accepted: false, code: 'WORKSPACE_ELECTION_REJECTED' });
    const persisted = await readElection(storage);
    expect(persisted).toMatchObject({
      status: 'valid',
      value: { writerInstanceId: SA1.requesterInstanceId, epoch: 1 },
    });
  });

  it('rejects a non-writer relinquish and leaves the record unchanged', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    await arbiter.handle(electionRequest({ ...SP1 }));
    const before = await readElection(storage);
    const response = await arbiter.handle(electionRequest({ ...SP2, operation: 'relinquish' }));
    expect(response).toMatchObject({ accepted: false, code: 'WORKSPACE_ELECTION_REJECTED' });
    await expect(readElection(storage)).resolves.toEqual(before);
  });

  it('returns the persisted authoritative result for a duplicate claim', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    const request = electionRequest({ ...SP1 });
    const first = acceptedRecord(await arbiter.handle(request));
    const before = await readElection(storage);
    const second = await arbiter.handle(request);
    expect(second.accepted).toBe(true);
    expect(acceptedRecord(second).epoch).toBe(first.epoch);
    await expect(readElection(storage)).resolves.toEqual(before);
  });

  it('does not replay a handoff-commit on a duplicate request', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    await arbiter.handle(electionRequest({ ...SP1 }));
    const commit = electionRequest({
      operation: 'handoff-commit',
      expectedEpoch: 0,
      targetInstanceId: SA1.requesterInstanceId,
      targetWriterType: SA1.requesterWriterType,
    });
    const first = acceptedRecord(await arbiter.handle(commit));
    const before = await readElection(storage);
    const second = await arbiter.handle(commit);
    expect(acceptedRecord(second).epoch).toBe(first.epoch);
    expect(acceptedRecord(second).writerInstanceId).toBe(SA1.requesterInstanceId);
    await expect(readElection(storage)).resolves.toEqual(before);
  });

  it('preserves duplicate-request idempotency across a simulated worker restart', async () => {
    const storage = makeStorage();
    const request = electionRequest({ ...SP1 });
    const first = acceptedRecord(await makeArbiter(storage).handle(request));
    const before = await readElection(storage);
    const restarted = makeArbiter(storage);
    const second = await restarted.handle(request);
    expect(acceptedRecord(second).epoch).toBe(first.epoch);
    await expect(readElection(storage)).resolves.toEqual(before);
  });

  it('fails closed when a requestId is reused with different operation data', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    const requestId = createOperationId();
    await arbiter.handle(electionRequest({ ...SP1, requestId, committedVersion: 0 }));
    const before = await readElection(storage);
    const conflict = await arbiter.handle(
      electionRequest({ ...SP1, requestId, committedVersion: 9 }),
    );
    expect(conflict).toMatchObject({ accepted: false, code: 'WORKSPACE_ELECTION_REJECTED' });
    await expect(readElection(storage)).resolves.toEqual(before);
  });

  it('never lets a handoff-commit and a fallback claim both succeed', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    await arbiter.handle(electionRequest({ ...SP1 }));
    const [commit, fallback] = await Promise.all([
      arbiter.handle(
        electionRequest({
          operation: 'handoff-commit',
          expectedEpoch: 0,
          targetInstanceId: SA1.requesterInstanceId,
          targetWriterType: SA1.requesterWriterType,
        }),
      ),
      arbiter.handle(electionRequest({ ...SP2, reason: 'fallback', expectedEpoch: 0 })),
    ]);
    expect(commit.accepted).toBe(true);
    expect(fallback).toMatchObject({ accepted: false, code: 'WORKSPACE_ELECTION_REJECTED' });
    const persisted = await readElection(storage);
    expect(persisted).toMatchObject({
      status: 'valid',
      value: { writerInstanceId: SA1.requesterInstanceId, epoch: 1 },
    });
  });

  it('serialises a stale recovery behind a live handoff-commit', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    await arbiter.handle(electionRequest({ ...SP1 }));
    const [commit, recovery] = await Promise.all([
      arbiter.handle(
        electionRequest({
          operation: 'handoff-commit',
          expectedEpoch: 0,
          targetInstanceId: SA1.requesterInstanceId,
          targetWriterType: SA1.requesterWriterType,
        }),
      ),
      arbiter.handle(electionRequest({ ...SP2, reason: 'stale-recovery', expectedEpoch: 0 })),
    ]);
    expect(commit.accepted).toBe(true);
    expect(recovery).toMatchObject({ accepted: false, code: 'WORKSPACE_ELECTION_REJECTED' });
    const persisted = await readElection(storage);
    expect(persisted).toMatchObject({
      status: 'valid',
      value: { writerInstanceId: SA1.requesterInstanceId, epoch: 1 },
    });
  });

  it('does not replay relinquish and rejects a duplicate relinquish', async () => {
    const chromeStorage = createChromeStorageMock();
    const storage = createValidatedStorage(chromeStorage);
    const arbiter = makeArbiter(storage);
    await arbiter.handle(electionRequest({ ...SP1 }));
    chromeStorage.session._setRaw('np_workspace_handoff', { phase: 'prepared' });
    const relinquish = electionRequest({ ...SP1, operation: 'relinquish' });
    const first = await arbiter.handle(relinquish);
    expect(first).toEqual({ requestId: relinquish.requestId, accepted: true });
    await expect(readElection(storage)).resolves.toEqual({ status: 'missing' });
    await expect(storage.read('np_workspace_handoff', z.unknown())).resolves.toEqual({
      status: 'missing',
    });
    const second = await arbiter.handle(relinquish);
    expect(second).toMatchObject({ accepted: false, code: 'WORKSPACE_ELECTION_REJECTED' });
    await expect(readElection(storage)).resolves.toEqual({ status: 'missing' });
  });

  it('leaves the existing record unchanged when an ownership change cannot be persisted', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    await arbiter.handle(electionRequest({ ...SP1 }));
    const before = await readElection(storage);
    const writeSpy = vi.spyOn(storage, 'write').mockRejectedValueOnce(new Error('write failed'));
    const response = await arbiter.handle(
      electionRequest({ ...SP2, reason: 'fallback', expectedEpoch: 0 }),
    );
    expect(response).toMatchObject({ accepted: false, code: 'WORKSPACE_ELECTION_FAILED' });
    writeSpy.mockRestore();
    await expect(readElection(storage)).resolves.toEqual(before);
  });

  it('fails closed without a writer when persistence fails', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    const writeSpy = vi.spyOn(storage, 'write').mockRejectedValueOnce(new Error('write failed'));
    const request = electionRequest({ ...SP1 });
    const response = await arbiter.handle(request);
    expect(response).toEqual({
      requestId: request.requestId,
      accepted: false,
      code: 'WORKSPACE_ELECTION_FAILED',
    });
    writeSpy.mockRestore();
    await expect(readElection(storage)).resolves.toEqual({ status: 'missing' });
  });

  it('fails closed when the persisted-record read-back does not match', async () => {
    const storage = makeStorage();
    const replacement: ElectionRecord = {
      ...baseRecord(SA1, 7, 3),
      recentCompletedRequests: [],
    };
    const arbiter = makeArbiter(tamperSecondElectionRead(storage, replacement));
    const request = electionRequest({ ...SP1 });
    const response = await arbiter.handle(request);
    expect(response).toEqual({
      requestId: request.requestId,
      accepted: false,
      code: 'WORKSPACE_ELECTION_FAILED',
    });
  });

  it('fails closed when the persisted record cannot be read', async () => {
    const storage = makeStorage();
    const readSpy = vi.spyOn(storage, 'read').mockRejectedValue(new Error('read failed'));
    const request = electionRequest({ ...SP1 });
    const response = await makeArbiter(storage).handle(request);
    expect(response).toEqual({
      requestId: request.requestId,
      accepted: false,
      code: 'WORKSPACE_ELECTION_FAILED',
    });
    readSpy.mockRestore();
  });

  it('reconstructs a fresh decision from persisted state after restart', async () => {
    const storage = makeStorage();
    await makeArbiter(storage).handle(electionRequest({ ...SP1 }));
    const restarted = makeArbiter(storage);
    const response = await restarted.handle(
      electionRequest({ ...SP2, reason: 'fallback', expectedEpoch: 0 }),
    );
    expect(response.accepted).toBe(true);
    expect(acceptedRecord(response).epoch).toBe(1);
  });

  it('recovers an invalid record to a monotonically higher epoch', async () => {
    const chromeStorage = createChromeStorageMock();
    const storage = createValidatedStorage(chromeStorage);
    const arbiter = makeArbiter(storage);
    chromeStorage.session._setRaw('np_workspace_election', { writerType: 'broken', epoch: 5 });
    const response = await arbiter.handle(electionRequest({ ...SP1 }));
    expect(acceptedRecord(response).epoch).toBe(6);
    expect(acceptedRecord(response).writerInstanceId).toBe(SP1.requesterInstanceId);
  });

  it('recovers an invalid record without a numeric prior epoch at epoch one', async () => {
    const chromeStorage = createChromeStorageMock();
    const storage = createValidatedStorage(chromeStorage);
    const arbiter = makeArbiter(storage);
    chromeStorage.session._setRaw('np_workspace_election', { writerType: 'broken' });
    const response = await arbiter.handle(electionRequest({ ...SP1 }));
    expect(acceptedRecord(response).epoch).toBe(1);
  });

  it('rejects an initial claim carrying expectedEpoch against a missing record', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    const response = await arbiter.handle(
      electionRequest({ ...SP1, reason: 'initial', expectedEpoch: 0 }),
    );
    expect(response).toMatchObject({ accepted: false, code: 'WORKSPACE_ELECTION_REJECTED' });
    await expect(readElection(storage)).resolves.toEqual({ status: 'missing' });
  });

  it('records rejected operations with the canonical rejection code', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    await arbiter.handle(electionRequest({ ...SP1 }));
    const request = electionRequest({ ...SP2, reason: 'initial' });
    const response = await arbiter.handle(request);
    expect(response).toMatchObject({ accepted: false, code: 'WORKSPACE_ELECTION_REJECTED' });
    const persisted = await readElection(storage);
    expect(persisted.status).toBe('valid');
    if (persisted.status === 'valid') {
      const entry = persisted.value.recentCompletedRequests.find(
        (candidate) => candidate.request.requestId === request.requestId,
      );
      expect(entry).toMatchObject({ accepted: false, code: 'WORKSPACE_ELECTION_REJECTED' });
    }
  });
});

describe('election idempotency ledger', () => {
  it('keeps the newest 32 completed requests and evicts the oldest', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    await arbiter.handle(electionRequest({ ...SP1 }));
    const requestIds: string[] = [];
    for (let index = 0; index < 33; index += 1) {
      const requestId = createOperationId();
      requestIds.push(requestId);
      await arbiter.handle(electionRequest({ ...SP2, reason: 'initial', requestId }));
    }
    const persisted = await readElection(storage);
    expect(persisted.status).toBe('valid');
    if (persisted.status !== 'valid') return;
    const ledger = persisted.value.recentCompletedRequests;
    expect(ledger).toHaveLength(32);
    expect(ledger.map((entry) => entry.request.requestId)).toEqual(requestIds.slice(-32));
    expect(ledger.map((entry) => entry.request.requestId)).not.toContain(requestIds[0]);
  });

  it('keeps duplicate request A idempotent after request B completes', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    const requestA = electionRequest({ ...SP1 });
    const firstA = acceptedRecord(await arbiter.handle(requestA));
    await arbiter.handle(electionRequest({ ...SP2, reason: 'fallback', expectedEpoch: 0 }));
    const before = await readElection(storage);
    const replayA = await arbiter.handle(requestA);
    expect(replayA.accepted).toBe(true);
    const replayed = acceptedRecord(replayA);
    expect(replayed.epoch).toBe(1);
    expect(replayed.writerInstanceId).toBe(SP2.requesterInstanceId);
    expect(firstA.epoch).toBe(0);
    await expect(readElection(storage)).resolves.toEqual(before);
  });

  it('does not increment the epoch when replaying within the retained window', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    const request = electionRequest({ ...SP1 });
    await arbiter.handle(request);
    const before = await readElection(storage);
    const replay = await arbiter.handle(request);
    expect(acceptedRecord(replay).epoch).toBe(0);
    await expect(readElection(storage)).resolves.toEqual(before);
  });

  it('orders the ledger oldest to newest with no duplicate requestId', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    const request = electionRequest({ ...SP1 });
    await arbiter.handle(request);
    await arbiter.handle(request);
    await arbiter.handle(electionRequest({ ...SP2, reason: 'initial' }));
    const persisted = await readElection(storage);
    expect(persisted.status).toBe('valid');
    if (persisted.status !== 'valid') return;
    const requestIds = persisted.value.recentCompletedRequests.map(
      (entry) => entry.request.requestId,
    );
    expect(new Set(requestIds).size).toBe(requestIds.length);
    expect(requestIds.filter((candidate) => candidate === request.requestId)).toHaveLength(1);
  });

  it('preserves the 32-entry ledger across a simulated worker restart', async () => {
    const storage = makeStorage();
    const arbiter = makeArbiter(storage);
    await arbiter.handle(electionRequest({ ...SP1 }));
    for (let index = 0; index < 40; index += 1) {
      await arbiter.handle(electionRequest({ ...SP2, reason: 'initial' }));
    }
    const restarted = makeArbiter(storage);
    const response = await restarted.handle(electionRequest({ ...SP2, reason: 'initial' }));
    expect(response.accepted).toBe(false);
    const persisted = await readElection(storage);
    expect(persisted.status).toBe('valid');
    if (persisted.status !== 'valid') return;
    expect(persisted.value.recentCompletedRequests).toHaveLength(32);
  });

  it('normalises a malformed or oversized persisted ledger to the newest 32 valid entries', async () => {
    const chromeStorage = createChromeStorageMock();
    const storage = createValidatedStorage(chromeStorage);
    const arbiter = makeArbiter(storage);
    const ledger: unknown[] = [];
    for (let index = 0; index < 40; index += 1) {
      if (index % 8 === 3) ledger.push({ garbage: true });
      else ledger.push(ledgerEntry(createOperationId(), index));
    }
    chromeStorage.session._setRaw('np_workspace_election', {
      ...baseRecord(SP1, 0, 0),
      recentCompletedRequests: ledger,
    });
    const response = await arbiter.handle(electionRequest({ ...SP2, reason: 'initial' }));
    expect(response).toMatchObject({ accepted: false, code: 'WORKSPACE_ELECTION_REJECTED' });
    const persisted = await readElection(storage);
    expect(persisted.status).toBe('valid');
    if (persisted.status !== 'valid') return;
    const normalised = persisted.value.recentCompletedRequests;
    expect(normalised).toHaveLength(32);
    expect(
      normalised.every((entry) => ElectionIdempotencyRecordSchema.safeParse(entry).success),
    ).toBe(true);
  });

  it('recovers when the persisted ledger field cannot be normalised', async () => {
    const chromeStorage = createChromeStorageMock();
    const storage = createValidatedStorage(chromeStorage);
    const arbiter = makeArbiter(storage);
    chromeStorage.session._setRaw('np_workspace_election', {
      ...baseRecord(SP1, 5, 2),
      recentCompletedRequests: 'not-an-array',
    });
    const response = await arbiter.handle(electionRequest({ ...SP1 }));
    expect(response.accepted).toBe(true);
    expect(acceptedRecord(response).epoch).toBe(6);
    expect(acceptedRecord(response).recentCompletedRequests).toHaveLength(1);
  });
});

function electionRequestEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.election.request',
    source: 'sidepanel',
    target: 'background',
    timestamp: 1,
    payload: electionRequest({ ...SP1 }),
    ...overrides,
  };
}

const TRUSTED_SENDER = {
  id: EXTENSION_ID,
  url: `chrome-extension://${EXTENSION_ID}/sidepanel.html`,
};

function makeListener(arbiter: WorkspaceElectionArbiter): BackgroundElectionMessageListener {
  return createBackgroundElectionMessageListener({ extensionId: EXTENSION_ID, arbiter });
}

describe('background election listener', () => {
  it('returns literal true synchronously for an election request', async () => {
    const arbiter = makeArbiter(makeStorage());
    const listener = makeListener(arbiter);
    const sendResponse = vi.fn();
    const result = listener(electionRequestEnvelope(), TRUSTED_SENDER, sendResponse);
    expect(result).toBe(true);
    await flushAsync();
    expect(sendResponse).toHaveBeenCalledTimes(1);
  });

  it('sends the response only after the queued operation completes', async () => {
    let resolveHandle: (value: WorkspaceElectionResponsePayload) => void = () => {};
    const handle = vi.fn(
      () =>
        new Promise<WorkspaceElectionResponsePayload>((resolve) => {
          resolveHandle = resolve;
        }),
    );
    const listener = createBackgroundElectionMessageListener({
      extensionId: EXTENSION_ID,
      arbiter: { handle } as unknown as WorkspaceElectionArbiter,
    });
    const envelope = electionRequestEnvelope();
    const sendResponse = vi.fn();
    expect(listener(envelope, TRUSTED_SENDER, sendResponse)).toBe(true);
    await flushAsync();
    expect(sendResponse).not.toHaveBeenCalled();
    const payload = envelope.payload as WorkspaceElectionRequestPayload;
    resolveHandle({
      requestId: payload.requestId,
      accepted: false,
      code: 'WORKSPACE_ELECTION_REJECTED',
    });
    await flushAsync();
    expect(sendResponse).toHaveBeenCalledTimes(1);
  });

  it('emits exactly one canonical failure response on a persistence failure', async () => {
    const storage = makeStorage();
    const writeSpy = vi.spyOn(storage, 'write').mockRejectedValue(new Error('write failed'));
    const listener = makeListener(makeArbiter(storage));
    const envelope = electionRequestEnvelope();
    const sendResponse = vi.fn();
    expect(listener(envelope, TRUSTED_SENDER, sendResponse)).toBe(true);
    await flushAsync();
    expect(sendResponse).toHaveBeenCalledTimes(1);
    const response = sendResponse.mock.calls[0]![0] as {
      payload: WorkspaceElectionResponsePayload;
    };
    expect(response.payload.accepted).toBe(false);
    expect(response.payload.code).toBe('WORKSPACE_ELECTION_FAILED');
    writeSpy.mockRestore();
  });

  it('emits exactly one canonical failure response on an unexpected exception', async () => {
    const handle = vi.fn().mockRejectedValue(new Error('unexpected'));
    const listener = createBackgroundElectionMessageListener({
      extensionId: EXTENSION_ID,
      arbiter: { handle } as unknown as WorkspaceElectionArbiter,
    });
    const envelope = electionRequestEnvelope();
    const sendResponse = vi.fn();
    expect(listener(envelope, TRUSTED_SENDER, sendResponse)).toBe(true);
    await flushAsync();
    expect(sendResponse).toHaveBeenCalledTimes(1);
    const response = sendResponse.mock.calls[0]![0] as {
      payload: WorkspaceElectionResponsePayload;
    };
    expect(response.payload.code).toBe('WORKSPACE_ELECTION_FAILED');
    const payload = envelope.payload as WorkspaceElectionRequestPayload;
    expect(response.payload.requestId).toBe(payload.requestId);
  });

  it('never responds twice for one request', async () => {
    const listener = makeListener(makeArbiter(makeStorage()));
    const sendResponse = vi.fn();
    listener(electionRequestEnvelope(), TRUSTED_SENDER, sendResponse);
    await flushAsync();
    await flushAsync();
    expect(sendResponse).toHaveBeenCalledTimes(1);
  });

  it('sends no response for an untrusted sender', async () => {
    const listener = makeListener(makeArbiter(makeStorage()));
    const sendResponse = vi.fn();
    const result = listener(electionRequestEnvelope(), { id: 'someoneelse' }, sendResponse);
    expect(result).toBeUndefined();
    await flushAsync();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('sends no response for a schema-invalid envelope', async () => {
    const listener = makeListener(makeArbiter(makeStorage()));
    const sendResponse = vi.fn();
    const result = listener({ nope: true }, TRUSTED_SENDER, sendResponse);
    expect(result).toBeUndefined();
    await flushAsync();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('returns undefined and no response for a wildcard-target election request', async () => {
    const listener = makeListener(makeArbiter(makeStorage()));
    const sendResponse = vi.fn();
    const result = listener(electionRequestEnvelope({ target: '*' }), TRUSTED_SENDER, sendResponse);
    expect(result).toBeUndefined();
    await flushAsync();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('returns undefined and no response for a background-originated election request', async () => {
    const listener = makeListener(makeArbiter(makeStorage()));
    const sendResponse = vi.fn();
    const result = listener(
      electionRequestEnvelope({ source: 'background' }),
      { id: EXTENSION_ID, url: `chrome-extension://${EXTENSION_ID}/background.js` },
      sendResponse,
    );
    expect(result).toBeUndefined();
    await flushAsync();
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('ignores ordinary workspace.mutation messages and never touches the election record', async () => {
    const storage = makeStorage();
    const listener = makeListener(makeArbiter(storage));
    const sendResponse = vi.fn();
    const mutationEnvelope = {
      envelopeVersion: 1,
      id: createOperationId(),
      type: 'workspace.mutation',
      source: 'sidepanel',
      target: 'background',
      timestamp: 1,
      payload: {
        mutationId: '00000000-0000-4000-8000-000000000000',
        writerInstanceId: 'sp-1',
        epoch: 0,
        baseVersion: 0,
        resultingVersion: 1,
        kind: 'workspace.metadata.set',
        payload: { schemaVersion: 1, committedVersion: 1, updatedAt: 1 },
      },
    };
    const result = listener(mutationEnvelope, TRUSTED_SENDER, sendResponse);
    expect(result).toBeUndefined();
    await flushAsync();
    expect(sendResponse).not.toHaveBeenCalled();
    await expect(readElection(storage)).resolves.toEqual({ status: 'missing' });
  });

  it('correlates the response envelope to the request and targets the requester', async () => {
    const listener = makeListener(makeArbiter(makeStorage()));
    const envelope = electionRequestEnvelope({ source: 'standalone' });
    const sendResponse = vi.fn();
    listener(
      envelope,
      { id: EXTENSION_ID, url: `chrome-extension://${EXTENSION_ID}/standalone.html` },
      sendResponse,
    );
    await flushAsync();
    expect(sendResponse).toHaveBeenCalledTimes(1);
    const response = sendResponse.mock.calls[0]![0] as RuntimeEnvelope;
    expect(response.type).toBe('workspace.election.response');
    expect(response.source).toBe('background');
    expect(response.target).toBe('standalone');
    expect(response.correlationId).toBe(envelope.id);
  });
});
