import { subscribe, publish } from '../runtime/BroadcastBus';

const WORKSPACE_CHANNEL = 'np_workspace';

export type WorkspaceSyncMessage =
  | { type: 'WORKSPACE_UPDATED'; workspaceId: string; conversationId: string | null }
  | { type: 'FULL_APP_OPEN'; workspaceId: string; conversationId?: string; page?: string }
  | { type: 'WORKSPACE_HANDOFF'; workspaceId: string; conversationId: string };

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
