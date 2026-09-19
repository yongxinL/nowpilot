import { createErrorRecord, debugLog } from '../error/debugLog';
import { createOperationId } from '../runtime/OperationId';
import type {
  WorkspaceElectionRequestPayload,
  WorkspaceElectionResponsePayload,
} from '../runtime/messageSchemas';
import type { ValidatedStorage } from '../storage/chromeStorage';
import {
  ElectionRecordSchema,
  HandoffRecordSchema,
  type ElectionRecord,
  type HandoffRecord,
  type InstanceId,
  type WorkspaceWriterType,
} from './workspaceTypes';

export interface WorkspaceHandoffDependencies {
  storage: ValidatedStorage;
  writerType: WorkspaceWriterType;
  instanceId: InstanceId;
  now(): number;
  submitElectionRequest(
    payload: WorkspaceElectionRequestPayload,
  ): Promise<WorkspaceElectionResponsePayload>;
}

export type HandoffReadResult =
  { status: 'missing' } | { status: 'valid'; record: HandoffRecord } | { status: 'invalid' };

export type HandoffRejectionCode =
  | 'WORKSPACE_HANDOFF_FAILED'
  | 'WORKSPACE_EPOCH_MISMATCH'
  | 'WORKSPACE_VERSION_CONFLICT'
  | 'WORKSPACE_ELECTION_REJECTED'
  | 'WORKSPACE_ELECTION_FAILED';

export type HandoffTransitionResult =
  | { status: 'prepared' | 'acknowledged' | 'committed' }
  | { status: 'rejected'; code: HandoffRejectionCode };

export interface WorkspaceHandoff {
  read(): Promise<HandoffReadResult>;
  prepare(
    to: { instanceId: InstanceId; writerType: WorkspaceWriterType },
    baseVersion: number,
  ): Promise<HandoffTransitionResult>;
  acknowledge(epoch: number, committedVersion: number): Promise<HandoffTransitionResult>;
  commit(epoch: number, committedVersion: number): Promise<HandoffTransitionResult>;
}

export function createWorkspaceHandoff(deps: WorkspaceHandoffDependencies): WorkspaceHandoff {
  async function readElection(): Promise<ElectionRecord | undefined> {
    const result = await deps.storage.read('np_workspace_election', ElectionRecordSchema);
    return result.status === 'valid' ? result.value : undefined;
  }

  async function read(): Promise<HandoffReadResult> {
    const result = await deps.storage.read('np_workspace_handoff', HandoffRecordSchema);
    if (result.status === 'valid') return { status: 'valid', record: result.value };
    if (result.status === 'invalid') {
      debugLog(createErrorRecord('WORKSPACE_INVALID_METADATA', { key: 'np_workspace_handoff' }));
      return { status: 'invalid' };
    }
    return { status: 'missing' };
  }

  function reject(code: HandoffRejectionCode): HandoffTransitionResult {
    debugLog(createErrorRecord(code, { phase: 'handoff' }));
    return { status: 'rejected', code };
  }

  return {
    read,
    async prepare(to, baseVersion) {
      const election = await readElection();
      if (
        !election ||
        election.writerInstanceId !== deps.instanceId ||
        election.writerType !== deps.writerType
      ) {
        return reject('WORKSPACE_HANDOFF_FAILED');
      }
      await deps.storage.write('np_workspace_handoff', HandoffRecordSchema, {
        phase: 'prepared',
        fromInstanceId: deps.instanceId,
        fromWriterType: deps.writerType,
        toInstanceId: to.instanceId,
        toWriterType: to.writerType,
        epoch: election.epoch,
        baseVersion,
        preparedAt: deps.now(),
        acknowledgedAt: null,
      });
      return { status: 'prepared' };
    },
    async acknowledge(epoch, committedVersion) {
      const current = await read();
      if (current.status !== 'valid' || current.record.phase !== 'prepared') {
        return reject('WORKSPACE_HANDOFF_FAILED');
      }
      if (current.record.epoch !== epoch) return reject('WORKSPACE_EPOCH_MISMATCH');
      if (current.record.baseVersion !== committedVersion) {
        return reject('WORKSPACE_VERSION_CONFLICT');
      }
      await deps.storage.write('np_workspace_handoff', HandoffRecordSchema, {
        ...current.record,
        phase: 'acknowledged',
        acknowledgedAt: deps.now(),
      });
      return { status: 'acknowledged' };
    },
    async commit(epoch, committedVersion) {
      const current = await read();
      if (current.status !== 'valid' || current.record.phase !== 'acknowledged') {
        return reject('WORKSPACE_HANDOFF_FAILED');
      }
      if (current.record.epoch !== epoch) return reject('WORKSPACE_EPOCH_MISMATCH');
      if (current.record.baseVersion !== committedVersion) {
        return reject('WORKSPACE_VERSION_CONFLICT');
      }

      const payload: WorkspaceElectionRequestPayload = {
        requestId: createOperationId(),
        operation: 'handoff-commit',
        requesterInstanceId: deps.instanceId,
        requesterWriterType: deps.writerType,
        committedVersion,
        expectedEpoch: epoch,
        targetInstanceId: current.record.toInstanceId,
        targetWriterType: current.record.toWriterType,
      };

      let response: WorkspaceElectionResponsePayload;
      try {
        response = await deps.submitElectionRequest(payload);
      } catch {
        return reject('WORKSPACE_HANDOFF_FAILED');
      }

      if (!response.accepted) {
        const code = response.code;
        if (code === 'WORKSPACE_ELECTION_REJECTED' || code === 'WORKSPACE_ELECTION_FAILED') {
          return reject(code);
        }
        return reject('WORKSPACE_HANDOFF_FAILED');
      }

      try {
        await deps.storage.remove('np_workspace_handoff');
      } catch {
        return reject('WORKSPACE_HANDOFF_FAILED');
      }
      return { status: 'committed' };
    },
  };
}
