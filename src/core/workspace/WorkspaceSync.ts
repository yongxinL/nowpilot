import { subscribe, publish } from '../runtime/BroadcastBus';
import type { ActiveSurface } from './WorkspaceStore';

const WORKSPACE_CHANNEL = 'np_workspace';

export type WorkspaceSyncMessage =
  | { type: 'WORKSPACE_UPDATED'; workspaceId: string; conversationId: string | null }
  | { type: 'STANDALONE_OPEN'; workspaceId: string; conversationId?: string; page?: string }
  | { type: 'WORKSPACE_HANDOFF'; workspaceId: string; conversationId: string }
  | { type: 'WORKSPACE_HEARTBEAT'; surface: ActiveSurface; workspaceId: string };

type SyncHandler = (message: WorkspaceSyncMessage) => void;

export function onWorkspaceSync(handler: SyncHandler): () => void {
  return subscribe<WorkspaceSyncMessage>(WORKSPACE_CHANNEL, (msg) => {
    handler(msg);
  });
}

export function notifyWorkspaceUpdate(workspaceId: string, conversationId: string | null): void {
  publish<WorkspaceSyncMessage>(WORKSPACE_CHANNEL, {
    type: 'WORKSPACE_UPDATED',
    workspaceId,
    conversationId,
  });
}

export function notifyWorkspaceHandoff(workspaceId: string, conversationId: string): void {
  publish<WorkspaceSyncMessage>(WORKSPACE_CHANNEL, {
    type: 'WORKSPACE_HANDOFF',
    workspaceId,
    conversationId,
  });
}

/**
 * Publish a primary-writer election heartbeat (D-26, spec §20.11).
 *
 * Rides the existing `np_workspace` BroadcastChannel — no new channel,
 * no second timer. The WorkspaceElection module owns the only 3 s tick
 * in the workspace layer; this function is the channel-side publish
 * primitive the heartbeat loop calls once per interval.
 */
export function notifyWorkspaceHeartbeat(surface: ActiveSurface, workspaceId: string): void {
  publish<WorkspaceSyncMessage>(WORKSPACE_CHANNEL, {
    type: 'WORKSPACE_HEARTBEAT',
    surface,
    workspaceId,
  });
}
