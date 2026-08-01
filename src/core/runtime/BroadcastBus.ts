type BroadcastListener<T = unknown> = (payload: T) => void;

interface BroadcastChannelEntry {
  channel: string;
  listeners: Set<BroadcastListener>;
  bc: BroadcastChannel;
}

const channels = new Map<string, BroadcastChannelEntry>();

// ── Primary surface election (MEM-02 single-writer memory semantics) ────────
// The entrypoint elects one surface as primary via setPrimarySurfaceId().
// Until an election happens (null), every surface is treated as primary so
// pre-election flows are not blocked; once elected, only the elected surface
// may perform memory writes (secondary surfaces are read-only).

let primarySurfaceId: string | null = null;

/** Elect (or clear) the primary surface id. */
export function setPrimarySurfaceId(surfaceId: string | null): void {
  primarySurfaceId = surfaceId;
}

/** The currently elected primary surface id, or null when none is elected. */
export function getPrimarySurfaceId(): string | null {
  return primarySurfaceId;
}

/** True when the given surface is the elected primary (or none is elected yet). */
export function isPrimarySurface(surfaceId: string): boolean {
  return primarySurfaceId === null || primarySurfaceId === surfaceId;
}

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
