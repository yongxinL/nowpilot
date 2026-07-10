import { debugLog } from '../utils/debugLog';

export type BroadcastHandler = (changes: Record<string, chrome.storage.StorageChange>) => void;

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
  });
}
