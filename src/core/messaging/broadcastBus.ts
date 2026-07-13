import { debugLog } from '../utils/debugLog';
import type { MemoryWriteRequest } from '../memory/memoryTypes';

export type BroadcastHandler = (changes: Record<string, chrome.storage.StorageChange>) => void;

export const WORKSPACE_UPDATED = 'np_workspace' as const;
export const MEMORY_WRITE_REQUEST = 'np_memory_write_request' as const;

const handlers = new Set<BroadcastHandler>();

export function onBroadcastMessage(handler: BroadcastHandler): () => void {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

// ---------------------------------------------------------------------------
// Memory write request routing (D-06, D-07)
// ---------------------------------------------------------------------------

type MemoryWriteHandler = (request: MemoryWriteRequest) => Promise<void>;
const memoryWriteHandlers = new Set<MemoryWriteHandler>();

export function onMemoryWrite(handler: MemoryWriteHandler): () => void {
  memoryWriteHandlers.add(handler);
  return () => { memoryWriteHandlers.delete(handler); };
}

export async function emitMemoryWrite(request: MemoryWriteRequest): Promise<void> {
  try {
    await chrome.storage.session.set({ [MEMORY_WRITE_REQUEST]: request });
    debugLog('debug', 'BroadcastBus: memory write request emitted', { type: request.type, idempotencyKey: request.idempotencyKey });
  } catch (err) {
    debugLog('error', 'BroadcastBus: failed to emit memory write request', { error: err });
  }
}

export function initBroadcastBus(): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'session') {
      debugLog('debug', 'BroadcastBus: session storage changed', { changes });
      for (const handler of handlers) {
        handler(changes);
      }

      // D-06/D-07: Route memory write requests to registered handlers
      if (changes[MEMORY_WRITE_REQUEST] && changes[MEMORY_WRITE_REQUEST].newValue) {
        const request = changes[MEMORY_WRITE_REQUEST].newValue as MemoryWriteRequest;
        debugLog('debug', 'BroadcastBus: memory write request received', { type: request.type });
        for (const handler of memoryWriteHandlers) {
          handler(request).catch(err =>
            debugLog('error', 'BroadcastBus: memory write handler failed', { error: err })
          );
        }
        // Clear the key after processing to allow next write
        chrome.storage.session.remove(MEMORY_WRITE_REQUEST).catch(() => {});
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
