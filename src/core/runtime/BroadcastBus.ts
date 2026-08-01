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
//
// Each extension surface (SidePanel, Full App Tab) runs its own JS context
// and therefore its own module instance. Elections are broadcast on
// PRIMARY_SURFACE_ELECTED so every context converges on the same primary —
// without this sync the election would be module-local and the MEM-02 gate
// would be a no-op across surfaces (WR-04).

let primarySurfaceId: string | null = null;

const PRIMARY_SURFACE_CHANNEL = 'PRIMARY_SURFACE_ELECTED';
let electionSyncSubscribed = false;

/** Subscribe once so elections from other JS contexts propagate locally. */
function ensureElectionSync(): void {
  if (electionSyncSubscribed) return;
  electionSyncSubscribed = true;
  subscribe<{ surfaceId: string | null }>(PRIMARY_SURFACE_CHANNEL, (payload) => {
    // Remote election (published by another surface context): apply it so
    // all contexts agree on the single memory writer (MEM-02).
    primarySurfaceId = payload?.surfaceId ?? null;
  });
}

/** Elect (or clear) the primary surface id — broadcast to every context. */
export function setPrimarySurfaceId(surfaceId: string | null): void {
  primarySurfaceId = surfaceId;
  ensureElectionSync();
  publish(PRIMARY_SURFACE_CHANNEL, { surfaceId });
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
