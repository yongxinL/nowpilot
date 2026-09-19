import type { ValidatedStorage } from '../storage/chromeStorage';
import type { MessageType } from '../runtime/MessageType';
import { createOperationId } from '../runtime/OperationId';
import type { RuntimeEnvelope } from '../runtime/RuntimeEnvelope';
import type { WorkspaceWriterSurface } from '../runtime/RuntimeSurface';
import type { WorkspaceElection } from './WorkspaceElection';
import type { WorkspaceHandoff } from './WorkspaceHandoff';
import type { WorkspaceStore } from './WorkspaceStore';
import {
  ElectionRecordSchema,
  type InstanceId,
  type WorkspaceMetadata,
  type WorkspaceWriterType,
} from './workspaceTypes';

export interface MirrorState {
  epoch: number;
  committedVersion: number;
}

export type MirrorDecision =
  | { action: 'apply' }
  | { action: 'ignore'; reason: 'duplicate' | 'stale' | 'epoch' }
  | { action: 'rehydrate'; reason: 'gap' };

export function classifyMirrorEnvelope(
  state: MirrorState,
  envelope: RuntimeEnvelope,
): MirrorDecision {
  const epoch = envelope.electionEpoch;
  const version = envelope.workspaceVersion;
  if (epoch === undefined || version === undefined) {
    return { action: 'ignore', reason: 'stale' };
  }
  if (epoch !== state.epoch) return { action: 'ignore', reason: 'epoch' };
  if (version === state.committedVersion) return { action: 'ignore', reason: 'duplicate' };
  if (version < state.committedVersion) return { action: 'ignore', reason: 'stale' };
  if (version === state.committedVersion + 1) return { action: 'apply' };
  return { action: 'rehydrate', reason: 'gap' };
}

export function applyMirrorEnvelope(
  state: MirrorState,
  envelope: RuntimeEnvelope,
): { state: MirrorState; decision: MirrorDecision } {
  const decision = classifyMirrorEnvelope(state, envelope);
  if (decision.action !== 'apply') return { state, decision };
  return {
    state: { epoch: state.epoch, committedVersion: envelope.workspaceVersion as number },
    decision,
  };
}

export function createRehydrateRequestEnvelope(
  input: { sinceVersion: number; instanceId: InstanceId; writerType: WorkspaceWriterType },
  source: WorkspaceWriterSurface,
): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.rehydrate.request',
    source,
    target: source === 'sidepanel' ? 'standalone' : 'sidepanel',
    timestamp: Date.now(),
    workspaceVersion: input.sinceVersion,
    payload: input,
  };
}

export function createRehydrateResponseEnvelope(
  input: { committedVersion: number; epoch: number; metadata: WorkspaceMetadata },
  source: WorkspaceWriterSurface,
): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.rehydrate.response',
    source,
    target: source === 'sidepanel' ? 'standalone' : 'sidepanel',
    timestamp: Date.now(),
    electionEpoch: input.epoch,
    workspaceVersion: input.committedVersion,
    payload: {
      committedVersion: input.committedVersion,
      epoch: input.epoch,
      metadata: input.metadata,
    },
  };
}

export function createHandoffPrepareEnvelope(
  input: { toInstanceId: InstanceId; epoch: number; baseVersion: number },
  source: WorkspaceWriterSurface,
): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.handoff.prepare',
    source,
    target: source === 'sidepanel' ? 'standalone' : 'sidepanel',
    timestamp: Date.now(),
    electionEpoch: input.epoch,
    payload: input,
  };
}

export function createHandoffAckEnvelope(
  input: { toInstanceId: InstanceId; epoch: number; committedVersion: number },
  source: WorkspaceWriterSurface,
): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.handoff.ack',
    source,
    target: source === 'sidepanel' ? 'standalone' : 'sidepanel',
    timestamp: Date.now(),
    electionEpoch: input.epoch,
    workspaceVersion: input.committedVersion,
    payload: input,
  };
}

export function createHandoffCommitEnvelope(
  input: { toInstanceId: InstanceId; epoch: number; committedVersion: number },
  source: WorkspaceWriterSurface,
): RuntimeEnvelope {
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type: 'workspace.handoff.commit',
    source,
    target: source === 'sidepanel' ? 'standalone' : 'sidepanel',
    timestamp: Date.now(),
    electionEpoch: input.epoch,
    workspaceVersion: input.committedVersion,
    payload: input,
  };
}

export interface CoordinatorBus {
  send(envelope: RuntimeEnvelope): Promise<void>;
  on(type: MessageType, handler: (envelope: RuntimeEnvelope) => unknown): () => void;
}

export interface WorkspaceCoordinatorDependencies {
  bus: CoordinatorBus;
  surface: WorkspaceWriterSurface;
  instanceId: InstanceId;
  storage: ValidatedStorage;
  election: WorkspaceElection;
  handoff: WorkspaceHandoff;
  store: WorkspaceStore;
}

export type CoordinatorStep =
  | { status: 'noop' }
  | { status: 'rehydrated' }
  | { status: 'prepared' }
  | { status: 'acknowledged' }
  | { status: 'committed' }
  | { status: 'mirrored' }
  | { status: 'relinquished' }
  | {
      status: 'failed';
      code: 'WORKSPACE_HANDOFF_FAILED' | 'WORKSPACE_INVALID_METADATA';
    };

export interface WorkspaceCoordinator {
  start(): () => void;
  announce(): Promise<void>;
  handleRehydrateRequest(envelope: RuntimeEnvelope): Promise<CoordinatorStep>;
  handleHandoffPrepare(envelope: RuntimeEnvelope): Promise<CoordinatorStep>;
  handleHandoffAck(envelope: RuntimeEnvelope): Promise<CoordinatorStep>;
  handleMutation(envelope: RuntimeEnvelope): Promise<CoordinatorStep>;
  handleRelinquish(envelope: RuntimeEnvelope): Promise<CoordinatorStep>;
}

export function createWorkspaceCoordinator(
  deps: WorkspaceCoordinatorDependencies,
): WorkspaceCoordinator {
  async function handleRehydrateRequest(envelope: RuntimeEnvelope): Promise<CoordinatorStep> {
    if (envelope.type !== 'workspace.rehydrate.request') return { status: 'noop' };
    const election = await deps.election.read();
    if (election.status !== 'valid' || !deps.election.isWriter(election.record)) {
      return { status: 'noop' };
    }
    const metadata = await deps.store.readMetadata();
    if (metadata.status !== 'valid') {
      return { status: 'failed', code: 'WORKSPACE_INVALID_METADATA' };
    }
    await deps.bus.send(
      createRehydrateResponseEnvelope(
        {
          committedVersion: metadata.metadata.committedVersion,
          epoch: election.record.epoch,
          metadata: metadata.metadata,
        },
        deps.surface,
      ),
    );
    if (deps.surface === 'sidepanel' && envelope.payload.writerType === 'standalone') {
      const prepared = await deps.handoff.prepare(
        { instanceId: envelope.payload.instanceId, writerType: 'standalone' },
        metadata.metadata.committedVersion,
      );
      if (prepared.status !== 'prepared') {
        return { status: 'failed', code: 'WORKSPACE_HANDOFF_FAILED' };
      }
      await deps.bus.send(
        createHandoffPrepareEnvelope(
          {
            toInstanceId: envelope.payload.instanceId,
            epoch: election.record.epoch,
            baseVersion: metadata.metadata.committedVersion,
          },
          deps.surface,
        ),
      );
      return { status: 'prepared' };
    }
    return { status: 'rehydrated' };
  }

  async function handleHandoffPrepare(envelope: RuntimeEnvelope): Promise<CoordinatorStep> {
    if (envelope.type !== 'workspace.handoff.prepare') return { status: 'noop' };
    if (envelope.payload.toInstanceId !== deps.instanceId) return { status: 'noop' };
    const acknowledged = await deps.handoff.acknowledge(
      envelope.payload.epoch,
      envelope.payload.baseVersion,
    );
    if (acknowledged.status !== 'acknowledged') {
      return { status: 'failed', code: 'WORKSPACE_HANDOFF_FAILED' };
    }
    await deps.bus.send(
      createHandoffAckEnvelope(
        {
          toInstanceId: deps.instanceId,
          epoch: envelope.payload.epoch,
          committedVersion: envelope.payload.baseVersion,
        },
        deps.surface,
      ),
    );
    return { status: 'acknowledged' };
  }

  async function handleHandoffAck(envelope: RuntimeEnvelope): Promise<CoordinatorStep> {
    if (envelope.type !== 'workspace.handoff.ack') return { status: 'noop' };
    const election = await deps.election.read();
    if (election.status !== 'valid' || !deps.election.isWriter(election.record)) {
      return { status: 'noop' };
    }
    const committed = await deps.handoff.commit(
      envelope.payload.epoch,
      envelope.payload.committedVersion,
    );
    if (committed.status !== 'committed') {
      return { status: 'failed', code: 'WORKSPACE_HANDOFF_FAILED' };
    }
    await deps.bus.send(
      createHandoffCommitEnvelope(
        {
          toInstanceId: envelope.payload.toInstanceId,
          epoch: envelope.payload.epoch,
          committedVersion: envelope.payload.committedVersion,
        },
        deps.surface,
      ),
    );
    return { status: 'committed' };
  }

  async function handleMutation(envelope: RuntimeEnvelope): Promise<CoordinatorStep> {
    if (envelope.type !== 'workspace.mutation') return { status: 'noop' };
    const election = await deps.election.read();
    const committedVersion = await deps.store.readVersion();
    const state: MirrorState = {
      epoch: election.status === 'valid' ? election.record.epoch : 0,
      committedVersion,
    };
    const result = applyMirrorEnvelope(state, envelope);
    if (result.decision.action === 'apply') return { status: 'mirrored' };
    if (result.decision.action === 'rehydrate') {
      await deps.bus.send(
        createRehydrateRequestEnvelope(
          { sinceVersion: committedVersion, instanceId: deps.instanceId, writerType: deps.surface },
          deps.surface,
        ),
      );
      return { status: 'rehydrated' };
    }
    return { status: 'noop' };
  }

  async function handleRelinquish(envelope: RuntimeEnvelope): Promise<CoordinatorStep> {
    if (envelope.type !== 'workspace.relinquish') return { status: 'noop' };
    const election = await deps.election.read();
    if (election.status === 'valid' && deps.election.isWriter(election.record)) {
      const result = await deps.election.relinquish();
      if (result.accepted) return { status: 'relinquished' };
    }
    return { status: 'noop' };
  }

  return {
    async announce() {
      const sinceVersion = await deps.store.readVersion();
      await deps.bus.send(
        createRehydrateRequestEnvelope(
          { sinceVersion, instanceId: deps.instanceId, writerType: deps.surface },
          deps.surface,
        ),
      );
    },
    handleRehydrateRequest,
    handleHandoffPrepare,
    handleHandoffAck,
    handleMutation,
    handleRelinquish,
    start() {
      const unsubscribe = [
        deps.bus.on('workspace.rehydrate.request', (envelope) => handleRehydrateRequest(envelope)),
        deps.bus.on('workspace.handoff.prepare', (envelope) => handleHandoffPrepare(envelope)),
        deps.bus.on('workspace.handoff.ack', (envelope) => handleHandoffAck(envelope)),
        deps.bus.on('workspace.mutation', (envelope) => handleMutation(envelope)),
        deps.bus.on('workspace.relinquish', (envelope) => handleRelinquish(envelope)),
        deps.storage.subscribe('np_workspace_election', ElectionRecordSchema, (result) => {
          if (deps.surface !== 'sidepanel') return;
          if (result.status === 'valid') return;
          if (result.status === 'invalid') {
            void deps.election.claim('stale-recovery');
            return;
          }
          void deps.election.claim('fallback');
        }),
      ];
      return () => {
        for (const off of unsubscribe) off();
      };
    },
  };
}
