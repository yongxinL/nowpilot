import { debugLog } from '@/core/log/debugLog';

type Handler = (payload: unknown) => void;

const listeners = new Map<string, Set<Handler>>();

export const EventBus = {
  on(event: string, handler: Handler): () => void {
    let set = listeners.get(event);
    if (!set) {
      set = new Set();
      listeners.set(event, set);
    }
    set.add(handler);
    return () => {
      set?.delete(handler);
    };
  },
  emit(event: string, payload?: unknown): void {
    const set = listeners.get(event);
    if (!set) return;
    for (const handler of [...set]) {
      try {
        handler(payload);
      } catch (error) {
        debugLog('EVENT_BUS_HANDLER_FAILED', `Event handler failed for ${event}`, error);
      }
    }
  },
  off(event: string, handler: Handler): void {
    listeners.get(event)?.delete(handler);
  },
  clear(): void {
    listeners.clear();
  },
};
