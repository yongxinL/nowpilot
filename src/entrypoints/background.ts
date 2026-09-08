import { defineBackground } from 'wxt/utils/define-background';
import { MessageType, MessageTypeValues } from '@/core/runtime/MessageType';
import type { ResponseEnvelope, RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import { useWorkspaceStore } from '@/core/workspace/WorkspaceStore';
import { WorkspaceRouter } from '@/core/workspace/WorkspaceRouter';

async function dispatch(msg: RuntimeEnvelope<unknown>): Promise<ResponseEnvelope<unknown>> {
  switch (msg.type) {
    case MessageType.OPEN_STANDALONE: {
      await useWorkspaceStore.getState().hydrateFromStorage();
      await WorkspaceRouter.openStandalone({ page: (msg.payload as { page?: string } | undefined)?.page });
      return { id: msg.id, ok: true, data: undefined };
    }
    case MessageType.WORKSPACE_HANDOFF:
    case MessageType.WORKSPACE_UPDATED:
      return { id: msg.id, ok: true, data: undefined };
    default:
      return {
        id: msg.id,
        ok: false,
        error: { code: 'UNHANDLED_MESSAGE', message: `Unhandled message type: ${msg.type}`, retryable: false },
      };
  }
}

export const BackgroundRouter = {
  register(): void {
    chrome.runtime.onMessage.addListener(
      (msg: RuntimeEnvelope<unknown>, sender, sendResponse) => {
        if (sender.id !== chrome.runtime.id) return false;
        if (!MessageTypeValues.includes(msg.type)) return false;
        void dispatch(msg).then((resp) => sendResponse(resp));
        return true;
      },
    );
  },
};

export default defineBackground({
  type: 'module',
  persistent: false,
  main() {
    BackgroundRouter.register();
  },
});
