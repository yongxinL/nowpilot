import { createErrorRecord, debugLog } from '../error/debugLog';
import type { ValidatedStorage } from '../storage/chromeStorage';
import type { WorkspaceStore } from './WorkspaceStore';
import {
  ElectionRecordSchema,
  type ElectionRecord,
  type InstanceId,
  type WorkspaceWriterType,
} from './workspaceTypes';

export interface WorkspaceElectionDependencies {
  storage: ValidatedStorage;
  store: WorkspaceStore;
  writerType: WorkspaceWriterType;
  instanceId: InstanceId;
  now(): number;
}

export type ElectionReadResult =
  { status: 'missing' } | { status: 'valid'; record: ElectionRecord } | { status: 'invalid' };

export type ElectionClaimResult =
  | { status: 'acquired'; record: ElectionRecord; recovered: boolean }
  | { status: 'held'; record: ElectionRecord };

export interface WorkspaceElection {
  read(): Promise<ElectionReadResult>;
  claim(): Promise<ElectionClaimResult>;
  relinquish(): Promise<void>;
  isWriter(record: ElectionRecord | undefined): boolean;
}

export function createWorkspaceElection(deps: WorkspaceElectionDependencies): WorkspaceElection {
  async function read(): Promise<ElectionReadResult> {
    const result = await deps.storage.read('np_workspace_election', ElectionRecordSchema);
    if (result.status === 'valid') return { status: 'valid', record: result.value };
    if (result.status === 'invalid') {
      debugLog(createErrorRecord('WORKSPACE_INVALID_METADATA', { key: 'np_workspace_election' }));
      return { status: 'invalid' };
    }
    return { status: 'missing' };
  }

  function build(epoch: number, committedVersion: number): ElectionRecord {
    return {
      writerType: deps.writerType,
      writerInstanceId: deps.instanceId,
      epoch,
      committedVersion,
      handoffPhase: 'idle',
      handoffTargetInstanceId: null,
      updatedAt: deps.now(),
    };
  }

  return {
    read,
    isWriter(record) {
      return record?.writerInstanceId === deps.instanceId && record.writerType === deps.writerType;
    },
    async claim() {
      const current = await read();
      if (current.status === 'valid') {
        if (this.isWriter(current.record)) return { status: 'held', record: current.record };
        return { status: 'held', record: current.record };
      }
      const committedVersion = await deps.store.readVersion();
      const recovered = current.status === 'invalid';
      const record = build(0, committedVersion);
      await deps.storage.write('np_workspace_election', ElectionRecordSchema, record);
      return { status: 'acquired', record, recovered };
    },
    async relinquish() {
      await deps.storage.remove('np_workspace_election');
      await deps.storage.remove('np_workspace_handoff');
    },
  };
}
