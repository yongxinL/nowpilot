import { createErrorRecord, debugLog } from '../error/debugLog';
import type { ErrorCode } from '../error/errorCodes';
import type { BroadcastBus } from '../runtime/BroadcastBus';
import { createOperationId, type OperationId } from '../runtime/OperationId';
import type {
  WorkspaceElectionRequestPayload,
  WorkspaceElectionResponsePayload,
} from '../runtime/messageSchemas';
import type { ValidatedStorage } from '../storage/chromeStorage';
import type { WorkspaceStore } from './WorkspaceStore';
import {
  ElectionRecordSchema,
  type ElectionRecord,
  type InstanceId,
  type WorkspaceElectionClaimReason,
  type WorkspaceWriterType,
} from './workspaceTypes';

export interface WorkspaceElectionDependencies {
  storage: ValidatedStorage;
  store: WorkspaceStore;
  bus: Pick<BroadcastBus, 'send' | 'on'>;
  writerType: WorkspaceWriterType;
  instanceId: InstanceId;
  now(): number;
}

export type ElectionReadResult =
  { status: 'missing' } | { status: 'valid'; record: ElectionRecord } | { status: 'invalid' };

export type ElectionClaimResult =
  | { status: 'acquired'; record: ElectionRecord; recovered: boolean }
  | { status: 'held'; record: ElectionRecord }
  | { status: 'rejected'; code: ErrorCode };

export interface ElectionRelinquishResult {
  accepted: boolean;
  code?: ErrorCode;
}

export interface WorkspaceElection {
  read(): Promise<ElectionReadResult>;
  claim(reason: WorkspaceElectionClaimReason): Promise<ElectionClaimResult>;
  relinquish(): Promise<ElectionRelinquishResult>;
  isWriter(record: ElectionRecord | undefined): boolean;
}

export function createWorkspaceElection(deps: WorkspaceElectionDependencies): WorkspaceElection {
  let retainedClaimRequestId: OperationId | undefined;
  let retainedRelinquishRequestId: OperationId | undefined;

  async function read(): Promise<ElectionReadResult> {
    const result = await deps.storage.read('np_workspace_election', ElectionRecordSchema);
    if (result.status === 'valid') return { status: 'valid', record: result.value };
    if (result.status === 'invalid') {
      debugLog(createErrorRecord('WORKSPACE_INVALID_METADATA', { key: 'np_workspace_election' }));
      return { status: 'invalid' };
    }
    return { status: 'missing' };
  }

  function request(
    payload: WorkspaceElectionRequestPayload,
  ): Promise<WorkspaceElectionResponsePayload> {
    const envelopeId = createOperationId();
    return new Promise((resolve) => {
      const unsubscribe = deps.bus.on('workspace.election.response', (envelope) => {
        if (envelope.type !== 'workspace.election.response') return;
        if (envelope.correlationId !== envelopeId) return;
        if (envelope.target !== deps.writerType) return;
        unsubscribe();
        resolve(envelope.payload);
      });
      void deps.bus
        .send({
          envelopeVersion: 1,
          id: envelopeId,
          type: 'workspace.election.request',
          source: deps.writerType,
          target: 'background',
          timestamp: deps.now(),
          payload,
        })
        .catch(() => {
          unsubscribe();
          resolve({
            requestId: payload.requestId,
            accepted: false,
            code: 'WORKSPACE_ELECTION_FAILED',
          });
        });
    });
  }

  return {
    read,
    isWriter(record) {
      return record?.writerInstanceId === deps.instanceId && record.writerType === deps.writerType;
    },
    async claim(reason) {
      const requestId = retainedClaimRequestId ?? createOperationId();
      retainedClaimRequestId = requestId;
      const response = await request({
        requestId,
        operation: 'claim',
        requesterInstanceId: deps.instanceId,
        requesterWriterType: deps.writerType,
        committedVersion: await deps.store.readVersion(),
        reason,
      });
      retainedClaimRequestId = undefined;
      if (response.accepted && response.record) {
        return { status: 'acquired', record: response.record, recovered: reason !== 'initial' };
      }
      const current = await read();
      if (current.status === 'valid') return { status: 'held', record: current.record };
      return {
        status: 'rejected',
        code: response.code ?? 'WORKSPACE_ELECTION_REJECTED',
      };
    },
    async relinquish() {
      const requestId = retainedRelinquishRequestId ?? createOperationId();
      retainedRelinquishRequestId = requestId;
      const response = await request({
        requestId,
        operation: 'relinquish',
        requesterInstanceId: deps.instanceId,
        requesterWriterType: deps.writerType,
        committedVersion: await deps.store.readVersion(),
      });
      retainedRelinquishRequestId = undefined;
      if (response.accepted) return { accepted: true };
      return { accepted: false, code: response.code ?? 'WORKSPACE_ELECTION_REJECTED' };
    },
  };
}
