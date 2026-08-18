type BroadcastListener<T = unknown> = (payload: T) => void;

interface BroadcastChannelEntry {
  channel: string;
  listeners: Set<BroadcastListener>;
  bc: BroadcastChannel;
}

const channels = new Map<string, BroadcastChannelEntry>();

// Generate unique ID per window / extension surface instance
const INSTANCE_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2) + Date.now().toString(36);

export function getBroadcastChannel(name: string): BroadcastChannelEntry {
  if (!channels.has(name)) {
    const bc = new BroadcastChannel(name);
    const entry: BroadcastChannelEntry = {
      channel: name,
      listeners: new Set(),
      bc,
    };
    bc.onmessage = (event: MessageEvent) => {
      // Ignore messages emitted by the same window/surface instance
      if (event.data && typeof event.data === 'object' && (event.data as any)._sender === INSTANCE_ID) {
        return;
      }
      entry.listeners.forEach((listener) => {
        try {
          listener(event.data);
        } catch {
          // swallow handler errors
        }
      });
    };
    channels.set(name, entry);
  }
  return channels.get(name)!;
}

export function subscribe<T>(channel: string, listener: BroadcastListener<T>): () => void {
  const entry = getBroadcastChannel(channel);
  entry.listeners.add(listener as BroadcastListener);
  return () => {
    entry.listeners.delete(listener as BroadcastListener);
    if (entry.listeners.size === 0) {
      entry.bc.close();
      channels.delete(channel);
    }
  };
}

export function publish<T>(channel: string, payload: T): void {
  const entry = getBroadcastChannel(channel);
  const envelope =
    payload && typeof payload === 'object'
      ? { ...payload, _sender: INSTANCE_ID }
      : payload;
  entry.bc.postMessage(envelope);
}

