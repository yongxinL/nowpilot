import { z } from 'zod';
import { createErrorRecord, debugLog, type DebugContext } from '../error/debugLog';
import type { ErrorCode } from '../error/errorCodes';
import { createOperationId, type OperationId } from '../runtime/OperationId';
import {
  validateInboundEnvelope,
  parseRuntimeEnvelope,
  type SenderIdentity,
} from '../runtime/RuntimeEnvelope';
import type { StorageReadResult, ValidatedStorage } from '../storage/chromeStorage';
import type {
  WorkspaceElectionRequestPayload,
  WorkspaceElectionResponsePayload,
} from '../runtime/messageSchemas';
import {
  ElectionIdempotencyRecordSchema,
  ElectionRecordSchema,
  HandoffPhaseSchema,
  InstanceIdSchema,
  WorkspaceWriterTypeSchema,
  type ElectionIdempotencyRecord,
  type ElectionRecord,
  type ElectionRequestFingerprint,
  type WorkspaceElectionClaimReason,
  type WorkspaceElectionOperation,
  type WorkspaceWriterType,
} from './workspaceTypes';

export interface ElectionSerialExecutor {
  runExclusive<T>(operation: () => Promise<T>): Promise<T>;
}

export function createElectionSerialExecutor(): ElectionSerialExecutor {
  let tail: Promise<void> = Promise.resolve();
  return {
    runExclusive<T>(operation: () => Promise<T>): Promise<T> {
      const result = tail.then(operation, operation);
      tail = result.then(
        () => undefined,
        () => undefined,
      );
      return result;
    },
  };
}

export interface WorkspaceElectionArbiterDependencies {
  storage: ValidatedStorage;
  now(): number;
  executor?: ElectionSerialExecutor;
}

export interface WorkspaceElectionArbiter {
  handle(request: WorkspaceElectionRequestPayload): Promise<WorkspaceElectionResponsePayload>;
}

type FingerprintLike = {
  requestId: string;
  operation: WorkspaceElectionOperation;
  requesterInstanceId: string;
  requesterWriterType: WorkspaceWriterType;
  committedVersion: number;
  reason?: WorkspaceElectionClaimReason;
  expectedEpoch?: number;
  targetInstanceId?: string;
  targetWriterType?: WorkspaceWriterType;
};

const PersistedElectionReadSchema = z.object({
  writerType: WorkspaceWriterTypeSchema,
  writerInstanceId: InstanceIdSchema,
  epoch: z.number().int().nonnegative(),
  committedVersion: z.number().int().nonnegative(),
  handoffPhase: HandoffPhaseSchema,
  handoffTargetInstanceId: InstanceIdSchema.nullable(),
  updatedAt: z.number().int().nonnegative(),
  recentCompletedRequests: z.array(z.unknown()).optional(),
});

type PersistedState =
  | { kind: 'missing' }
  | { kind: 'invalid'; priorEpoch: number | null }
  | { kind: 'valid'; record: ElectionRecord };

type LedgerMatch =
  { kind: 'none' } | { kind: 'duplicate'; entry: ElectionIdempotencyRecord } | { kind: 'conflict' };

interface Decision {
  accepted: boolean;
  code?: ErrorCode;
  nextRecord?: ElectionRecord;
  record?: ElectionRecord;
  remove?: boolean;
}

const RETENTION_LIMIT = 32;

function fingerprintsEqual(a: FingerprintLike, b: FingerprintLike): boolean {
  return (
    a.requestId === b.requestId &&
    a.operation === b.operation &&
    a.requesterInstanceId === b.requesterInstanceId &&
    a.requesterWriterType === b.requesterWriterType &&
    a.committedVersion === b.committedVersion &&
    a.reason === b.reason &&
    a.expectedEpoch === b.expectedEpoch &&
    a.targetInstanceId === b.targetInstanceId &&
    a.targetWriterType === b.targetWriterType
  );
}

function ledgerEntriesEqual(a: ElectionIdempotencyRecord, b: ElectionIdempotencyRecord): boolean {
  return (
    a.accepted === b.accepted &&
    a.code === b.code &&
    a.epoch === b.epoch &&
    a.completedAt === b.completedAt &&
    fingerprintsEqual(a.request, b.request)
  );
}

function recordsEqual(a: ElectionRecord, b: ElectionRecord): boolean {
  if (
    a.writerType !== b.writerType ||
    a.writerInstanceId !== b.writerInstanceId ||
    a.epoch !== b.epoch ||
    a.committedVersion !== b.committedVersion ||
    a.handoffPhase !== b.handoffPhase ||
    a.handoffTargetInstanceId !== b.handoffTargetInstanceId ||
    a.updatedAt !== b.updatedAt ||
    a.recentCompletedRequests.length !== b.recentCompletedRequests.length
  ) {
    return false;
  }
  for (let index = 0; index < a.recentCompletedRequests.length; index += 1) {
    if (!ledgerEntriesEqual(a.recentCompletedRequests[index]!, b.recentCompletedRequests[index]!)) {
      return false;
    }
  }
  return true;
}

function extractPriorEpoch(value: unknown): number | null {
  if (typeof value !== 'object' || value === null) return null;
  const epoch = (value as { epoch?: unknown }).epoch;
  if (typeof epoch === 'number' && Number.isFinite(epoch) && epoch >= 0) {
    return Math.floor(epoch);
  }
  return null;
}

function isWriter(record: ElectionRecord, request: WorkspaceElectionRequestPayload): boolean {
  return (
    record.writerInstanceId === request.requesterInstanceId &&
    record.writerType === request.requesterWriterType
  );
}

function isRecoveryReason(reason: WorkspaceElectionRequestPayload['reason']): boolean {
  return reason === 'stale-recovery' || reason === 'fallback';
}

export function createWorkspaceElectionArbiter(
  deps: WorkspaceElectionArbiterDependencies,
): WorkspaceElectionArbiter {
  const executor = deps.executor ?? createElectionSerialExecutor();

  function createFingerprint(request: WorkspaceElectionRequestPayload): ElectionRequestFingerprint {
    return {
      requestId: request.requestId,
      operation: request.operation,
      requesterInstanceId: request.requesterInstanceId,
      requesterWriterType: request.requesterWriterType,
      committedVersion: request.committedVersion,
      reason: request.reason,
      expectedEpoch: request.expectedEpoch,
      targetInstanceId: request.targetInstanceId,
      targetWriterType: request.targetWriterType,
    };
  }

  function ledgerAppend(
    ledger: ElectionIdempotencyRecord[],
    request: WorkspaceElectionRequestPayload,
    accepted: boolean,
    code: ErrorCode | undefined,
    epoch: number,
  ): ElectionIdempotencyRecord[] {
    const next = ledger.filter((entry) => entry.request.requestId !== request.requestId);
    next.push({
      request: createFingerprint(request),
      accepted,
      ...(code ? { code } : {}),
      epoch,
      completedAt: deps.now(),
    });
    return next.slice(-RETENTION_LIMIT);
  }

  async function readPersisted(): Promise<PersistedState> {
    const result = await deps.storage.read('np_workspace_election', PersistedElectionReadSchema);
    if (result.status === 'missing') return { kind: 'missing' };
    if (result.status === 'invalid') {
      debugLog(invalidMetadataRecord('base'));
      const raw = await deps.storage.read('np_workspace_election', z.unknown());
      const priorEpoch = raw.status === 'valid' ? extractPriorEpoch(raw.value) : null;
      return { kind: 'invalid', priorEpoch };
    }
    const value = result.value;
    const ledger: ElectionIdempotencyRecord[] = [];
    for (const candidate of value.recentCompletedRequests ?? []) {
      const parsed = ElectionIdempotencyRecordSchema.safeParse(candidate);
      if (parsed.success) ledger.push(parsed.data);
    }
    const record: ElectionRecord = {
      writerType: value.writerType,
      writerInstanceId: value.writerInstanceId,
      epoch: value.epoch,
      committedVersion: value.committedVersion,
      handoffPhase: value.handoffPhase,
      handoffTargetInstanceId: value.handoffTargetInstanceId,
      updatedAt: value.updatedAt,
      recentCompletedRequests: ledger.slice(-RETENTION_LIMIT),
    };
    return { kind: 'valid', record };
  }

  function invalidMetadataRecord(reason: string): ReturnType<typeof createErrorRecord> {
    const context: DebugContext = { key: 'np_workspace_election', reason };
    return createErrorRecord('WORKSPACE_INVALID_METADATA', context);
  }

  function matchLedger(
    record: ElectionRecord,
    request: WorkspaceElectionRequestPayload,
  ): LedgerMatch {
    const entry = record.recentCompletedRequests.find(
      (candidate) => candidate.request.requestId === request.requestId,
    );
    if (!entry) return { kind: 'none' };
    return fingerprintsEqual(entry.request, request)
      ? { kind: 'duplicate', entry }
      : { kind: 'conflict' };
  }

  function rejected(requestId: OperationId): WorkspaceElectionResponsePayload {
    return { requestId, accepted: false, code: 'WORKSPACE_ELECTION_REJECTED' };
  }

  function failed(requestId: OperationId): WorkspaceElectionResponsePayload {
    return { requestId, accepted: false, code: 'WORKSPACE_ELECTION_FAILED' };
  }

  function appendToRecord(
    record: ElectionRecord,
    request: WorkspaceElectionRequestPayload,
    accepted: boolean,
    code: ErrorCode | undefined,
    epoch: number,
  ): ElectionRecord {
    return {
      ...record,
      recentCompletedRequests: ledgerAppend(
        record.recentCompletedRequests,
        request,
        accepted,
        code,
        epoch,
      ),
    };
  }

  function rejectWithLedger(
    record: ElectionRecord,
    request: WorkspaceElectionRequestPayload,
  ): Decision {
    const code: ErrorCode = 'WORKSPACE_ELECTION_REJECTED';
    return {
      accepted: false,
      code,
      nextRecord: appendToRecord(record, request, false, code, record.epoch),
    };
  }

  function buildFreshRecord(
    request: WorkspaceElectionRequestPayload,
    epoch: number,
    committedVersion: number,
  ): ElectionRecord {
    return {
      writerType: request.requesterWriterType,
      writerInstanceId: request.requesterInstanceId,
      epoch,
      committedVersion,
      handoffPhase: 'idle',
      handoffTargetInstanceId: null,
      updatedAt: deps.now(),
      recentCompletedRequests: ledgerAppend([], request, true, undefined, epoch),
    };
  }

  function takeoverRecord(
    record: ElectionRecord,
    request: WorkspaceElectionRequestPayload,
    epoch: number,
  ): ElectionRecord {
    return {
      writerType: request.requesterWriterType,
      writerInstanceId: request.requesterInstanceId,
      epoch,
      committedVersion: request.committedVersion,
      handoffPhase: 'idle',
      handoffTargetInstanceId: null,
      updatedAt: deps.now(),
      recentCompletedRequests: ledgerAppend(
        record.recentCompletedRequests,
        request,
        true,
        undefined,
        epoch,
      ),
    };
  }

  function decideClaim(state: PersistedState, request: WorkspaceElectionRequestPayload): Decision {
    if (state.kind === 'valid') {
      const record = state.record;
      if (isWriter(record, request)) {
        const next = appendToRecord(record, request, true, undefined, record.epoch);
        return { accepted: true, nextRecord: next, record: next };
      }
      if (isRecoveryReason(request.reason) && request.expectedEpoch === record.epoch) {
        const epoch = record.epoch + 1;
        const next = takeoverRecord(record, request, epoch);
        return { accepted: true, nextRecord: next, record: next };
      }
      return rejectWithLedger(record, request);
    }
    if (state.kind === 'missing') {
      if (request.expectedEpoch !== undefined && !isRecoveryReason(request.reason)) {
        return { accepted: false, code: 'WORKSPACE_ELECTION_REJECTED' };
      }
      const next = buildFreshRecord(request, 0, request.committedVersion);
      return { accepted: true, nextRecord: next, record: next };
    }
    const epoch = (state.priorEpoch ?? 0) + 1;
    const next = buildFreshRecord(request, epoch, request.committedVersion);
    return { accepted: true, nextRecord: next, record: next };
  }

  function decideRelinquish(
    state: PersistedState,
    request: WorkspaceElectionRequestPayload,
  ): Decision {
    if (state.kind !== 'valid') return rejected(request.requestId);
    const record = state.record;
    if (!isWriter(record, request)) return rejected(request.requestId);
    if (request.expectedEpoch !== undefined && request.expectedEpoch !== record.epoch) {
      return rejected(request.requestId);
    }
    return { accepted: true, remove: true };
  }

  function decideHandoffCommit(
    state: PersistedState,
    request: WorkspaceElectionRequestPayload,
  ): Decision {
    if (state.kind !== 'valid') return rejected(request.requestId);
    const record = state.record;
    if (!request.targetInstanceId || !request.targetWriterType) {
      return rejectWithLedger(record, request);
    }
    if (!isWriter(record, request)) {
      return rejectWithLedger(record, request);
    }
    if (request.expectedEpoch !== undefined && request.expectedEpoch !== record.epoch) {
      return rejectWithLedger(record, request);
    }
    const epoch = record.epoch + 1;
    const next: ElectionRecord = {
      writerType: request.targetWriterType,
      writerInstanceId: request.targetInstanceId,
      epoch,
      committedVersion: request.committedVersion,
      handoffPhase: 'idle',
      handoffTargetInstanceId: null,
      updatedAt: deps.now(),
      recentCompletedRequests: ledgerAppend(
        record.recentCompletedRequests,
        request,
        true,
        undefined,
        epoch,
      ),
    };
    return { accepted: true, nextRecord: next, record: next };
  }

  function decide(state: PersistedState, request: WorkspaceElectionRequestPayload): Decision {
    switch (request.operation) {
      case 'claim':
        return decideClaim(state, request);
      case 'relinquish':
        return decideRelinquish(state, request);
      case 'handoff-commit':
        return decideHandoffCommit(state, request);
    }
  }

  function responseFromDecision(
    decision: Decision,
    requestId: OperationId,
  ): WorkspaceElectionResponsePayload {
    if (decision.accepted) {
      return decision.record
        ? { requestId, accepted: true, record: decision.record }
        : { requestId, accepted: true };
    }
    return {
      requestId,
      accepted: false,
      code: decision.code ?? 'WORKSPACE_ELECTION_REJECTED',
    };
  }

  async function persistRecord(
    requestId: OperationId,
    decision: Decision,
  ): Promise<WorkspaceElectionResponsePayload> {
    let canonical: ElectionRecord;
    try {
      canonical = ElectionRecordSchema.parse(decision.nextRecord);
      await deps.storage.write('np_workspace_election', ElectionRecordSchema, canonical);
    } catch {
      debugLog(createErrorRecord('WORKSPACE_ELECTION_FAILED', { reason: 'persist' }));
      return failed(requestId);
    }
    let readBack: StorageReadResult<ElectionRecord>;
    try {
      readBack = await deps.storage.read('np_workspace_election', ElectionRecordSchema);
    } catch {
      debugLog(createErrorRecord('WORKSPACE_ELECTION_FAILED', { reason: 'read-back' }));
      return failed(requestId);
    }
    if (readBack.status !== 'valid' || !recordsEqual(readBack.value, canonical)) {
      debugLog(createErrorRecord('WORKSPACE_ELECTION_FAILED', { reason: 'read-back' }));
      return failed(requestId);
    }
    if (decision.accepted) {
      return { requestId, accepted: true, record: readBack.value };
    }
    return {
      requestId,
      accepted: false,
      code: decision.code ?? 'WORKSPACE_ELECTION_REJECTED',
    };
  }

  async function persistRemoval(requestId: OperationId): Promise<WorkspaceElectionResponsePayload> {
    try {
      await deps.storage.remove('np_workspace_election');
      await deps.storage.remove('np_workspace_handoff');
    } catch {
      debugLog(createErrorRecord('WORKSPACE_ELECTION_FAILED', { reason: 'persist' }));
      return failed(requestId);
    }
    try {
      const electionBack = await deps.storage.read('np_workspace_election', z.unknown());
      const handoffBack = await deps.storage.read('np_workspace_handoff', z.unknown());
      if (electionBack.status !== 'missing' || handoffBack.status !== 'missing') {
        debugLog(createErrorRecord('WORKSPACE_ELECTION_FAILED', { reason: 'read-back' }));
        return failed(requestId);
      }
    } catch {
      debugLog(createErrorRecord('WORKSPACE_ELECTION_FAILED', { reason: 'read-back' }));
      return failed(requestId);
    }
    return { requestId, accepted: true };
  }

  async function evaluate(
    request: WorkspaceElectionRequestPayload,
  ): Promise<WorkspaceElectionResponsePayload> {
    let state: PersistedState;
    try {
      state = await readPersisted();
    } catch {
      debugLog(createErrorRecord('WORKSPACE_ELECTION_FAILED', { reason: 'read' }));
      return failed(request.requestId);
    }
    if (state.kind === 'valid') {
      const match = matchLedger(state.record, request);
      if (match.kind === 'conflict') return rejected(request.requestId);
      if (match.kind === 'duplicate') {
        if (match.entry.accepted) {
          return { requestId: request.requestId, accepted: true, record: state.record };
        }
        return {
          requestId: request.requestId,
          accepted: false,
          ...(match.entry.code ? { code: match.entry.code } : {}),
        };
      }
    }
    const decision = decide(state, request);
    if (decision.remove) return persistRemoval(request.requestId);
    if (!decision.nextRecord) return responseFromDecision(decision, request.requestId);
    return persistRecord(request.requestId, decision);
  }

  return {
    handle(request) {
      return executor.runExclusive(() => evaluate(request));
    },
  };
}

export type BackgroundElectionMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response: unknown) => void,
) => boolean | void;

export interface BackgroundElectionListenerDependencies {
  extensionId: string;
  arbiter: WorkspaceElectionArbiter;
  createEnvelopeId?: () => string;
  now?: () => number;
}

export function createBackgroundElectionMessageListener(
  deps: BackgroundElectionListenerDependencies,
): BackgroundElectionMessageListener {
  const createEnvelopeId = deps.createEnvelopeId ?? createOperationId;
  const now = deps.now ?? Date.now;
  return (message, sender, sendResponse) => {
    const validated = validateInboundEnvelope(message, sender as SenderIdentity, deps.extensionId);
    if (!validated.ok) return undefined;
    const envelope = validated.envelope;
    if (envelope.type !== 'workspace.election.request') return undefined;
    if (envelope.target !== 'background') return undefined;
    const request = envelope.payload;
    let responded = false;
    const respond = (payload: WorkspaceElectionResponsePayload): void => {
      if (responded) return;
      responded = true;
      const parsed = parseRuntimeEnvelope({
        envelopeVersion: 1,
        id: createEnvelopeId(),
        type: 'workspace.election.response',
        source: 'background',
        target: envelope.source,
        timestamp: now(),
        correlationId: envelope.id,
        payload,
      });
      if (!parsed.success) return;
      sendResponse(parsed.data);
    };
    void (async () => {
      try {
        respond(await deps.arbiter.handle(request));
      } catch {
        respond({
          requestId: request.requestId,
          accepted: false,
          code: 'WORKSPACE_ELECTION_FAILED',
        });
      }
    })();
    return true;
  };
}
