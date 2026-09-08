import { BroadcastBus } from '@/core/runtime/BroadcastBus';
import { MessageType } from '@/core/runtime/MessageType';
import { useWorkspaceStore, type ActiveSurface, type WorkspaceState } from './WorkspaceStore';

const HEARTBEAT_MS = 3000;

export function startWorkspaceSync(surface: ActiveSurface): () => void {
  useWorkspaceStore.setState((s) => ({ state: { ...s.state, activeSurface: surface } }));
  BroadcastBus.setSource(surface);
  BroadcastBus.on(MessageType.WORKSPACE_UPDATED, (payload) => {
    const remote = payload as { state: WorkspaceState; from: string };
    const local = useWorkspaceStore.getState().state;
    if (remote.state.version > local.version) {
      useWorkspaceStore.setState({ state: remote.state });
    }
  });
  const timer = setInterval(() => {
    BroadcastBus.emit(MessageType.WORKSPACE_HEARTBEAT, {
      surface,
      workspaceId: useWorkspaceStore.getState().state.workspaceId,
      at: Date.now(),
    });
  }, HEARTBEAT_MS);
  const unsub = useWorkspaceStore.subscribe(
    (s) => s.state,
    (state) => {
      BroadcastBus.emit(MessageType.WORKSPACE_UPDATED, { state, from: surface });
    },
  );
  return () => {
    clearInterval(timer);
    unsub();
  };
}
