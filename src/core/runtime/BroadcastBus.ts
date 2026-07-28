type BroadcastListener<T = unknown> = (payload: T) => void;

interface BroadcastChannelEntry {
  channel: string;
  listeners: Set<BroadcastListener>;
  bc: BroadcastChannel;
}

const channels = new Map<string, BroadcastChannelEntry>();

export function getBroadcastChannel(name: string): BroadcastChannelEntry {
  if (!channels.has(name)) {
    const bc = new BroadcastChannel(name);
    const entry: BroadcastChannelEntry = {
      channel: name,
      listeners: new Set(),
      bc,
    };
    bc.onmessage = (event: MessageEvent) => {
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
  entry.bc.postMessage(payload);
}
