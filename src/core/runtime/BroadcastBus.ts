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

/**
 * The transport-owned field used to suppress a surface's own echo. It is added
 * by `publish` and removed again before any listener runs: the decoration is
 * the transport's business, so a listener validates the payload the
 * application owns. The workspace-handoff envelopes are `.strict()` schemas, so
 * a leaked `_sender` made every inbound handoff message fail validation and the
 * D-13 handoff could never complete (CR-02).
 */
const TRANSPORT_SENDER_KEY = '_sender';

function isOwnEcho(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as Record<string, unknown>)[TRANSPORT_SENDER_KEY] === INSTANCE_ID
  );
}

function withoutTransportMetadata(data: unknown): unknown {
  if (typeof data !== 'object' || data === null) return data;
  const record = data as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(record, TRANSPORT_SENDER_KEY)) return data;
  const { [TRANSPORT_SENDER_KEY]: _transportField, ...payload } = record;
  return payload;
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
      // Ignore messages emitted by the same window/surface instance
      if (isOwnEcho(event.data)) {
        return;
      }
      const payload = withoutTransportMetadata(event.data);
      entry.listeners.forEach((listener) => {
        try {
          listener(payload);
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

