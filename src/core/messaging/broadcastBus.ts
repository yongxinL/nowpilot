import { debugLog } from '../utils/debugLog';

export type BroadcastHandler = (changes: Record<string, chrome.storage.StorageChange>) => void;

export const WORKSPACE_UPDATED = 'np_workspace' as const;

const handlers = new Set<BroadcastHandler>();

export function onBroadcastMessage(handler: BroadcastHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

export function initBroadcastBus(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'session') {
      debugLog('debug', 'BroadcastBus: session storage changed', { changes });
      for (const handler of handlers) {
        handler(changes);
      }
    }
    if (areaName === 'local') {
      // Per D-18: chrome.storage.onChanged as fallback recovery mechanism
      // Only notify handlers when np_workspace key changes
      if (changes.np_workspace) {
        debugLog('debug', 'BroadcastBus: workspace changed in local storage');
        for (const handler of handlers) {
          handler({ np_workspace: changes.np_workspace });
        }
      }
    }
  });
}
