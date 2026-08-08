// src/core/runtime/BroadcastBus.ts — Source: Appendix M.3 (lines 5961-5996) +
// RESEARCH Pitfall 5, canonical home §18 line 2432 (NOT src/core/events/).
// The live cross-surface event bus: WORKSPACE_UPDATED (version-LWW adoption) and
// WORKSPACE_HEARTBEAT (every 3000ms — M.3, NOT 30s) flow between the side panel and
// standalone surface over chrome.runtime.sendMessage/onMessage, every payload
// wrapped in the canonical RuntimeEnvelope (Pitfall 5). Inbound messages are
// envelope-shaped AND whitelist-validated before dispatch — unknown types are
// ignored (T-1-04/T-1-12). Dependency-free core (Pitfall 4): the heartbeat state
// provider is INJECTED by the workspace consumer rather than imported (no zustand
// in the content bundle). Never instantiated in the background SW (R-3): runtime
// buses live in Side Panel/Standalone only.
import { MessageType, MessageTypeValues } from './MessageType';
import type { MessageTypeValue } from './MessageType';
import type { RuntimeEnvelope } from './RuntimeEnvelope';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';

const HEARTBEAT_MS = 3000;

export type HeartbeatStateProvider = () => { workspaceId: string; version: number };
export type BroadcastPayloadHandler = (payload: unknown) => void;

export class BroadcastBus {
  private readonly source: RuntimeEnvelope['source'];
  private readonly handlers = new Map<MessageTypeValue, Set<BroadcastPayloadHandler>>();
  private runtimeBound: ((message: unknown) => void) | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor(source: RuntimeEnvelope['source'] = 'sidepanel') {
    this.source = source;
  }

  /**
   * Subscribe to a message type; the handler receives the envelope payload.
   * Returns an unsubscribe function. Inbound messages are envelope-shaped AND
   * whitelist-validated before dispatch (unknown types ignored — Pitfall 5).
   */
  on(type: MessageTypeValue, handler: BroadcastPayloadHandler): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
    // remove-then-add keeps exactly ONE active chrome listener (T-1-11) while
    // surviving a chrome mock swap (fakeBrowser.reset() clears listeners).
    if (this.runtimeBound !== null) {
      browser.runtime.onMessage.removeListener(this.runtimeBound);
    }
    this.runtimeBound = (message: unknown) => {
      this.dispatchInbound(message);
    };
    browser.runtime.onMessage.addListener(this.runtimeBound);
    return () => {
      set.delete(handler);
    };
  }

  /**
   * Publish a payload wrapped in the canonical RuntimeEnvelope (Pitfall 5).
   * Unknown outbound types are rejected before send (MSG_UNKNOWN_TYPE, §C.2).
   */
  emit(type: MessageTypeValue, payload: unknown): void {
    this.assertKnownType(type);
    const envelope: RuntimeEnvelope = {
      id: crypto.randomUUID(),
      type,
      createdAt: Date.now(),
      source: this.source,
      payload,
    };
    void browser.runtime.sendMessage(envelope).catch((err: unknown) => {
      // Fire-and-forget, MV3: no receiving end is normal. Route to debugLog with
      // the canonical MSG_SERIALIZE code (Golden Rule 9).
      debugLog(ERROR_CODES.MSG_SERIALIZE, 'BroadcastBus.emit: runtime send failed', {
        error: err instanceof Error ? err : undefined,
        context: 'BroadcastBus.emit',
      });
    });
  }

  /**
   * Publish WORKSPACE_HEARTBEAT every 3000ms (M.3). The state provider is injected
   * (Pitfall 4 — the bus never imports the workspace store); when omitted the
   * heartbeat carries empty identifiers.
   */
  startHeartbeat(getState?: HeartbeatStateProvider): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      const { workspaceId, version } = getState ? getState() : { workspaceId: '', version: 0 };
      this.emit(MessageType.WORKSPACE_HEARTBEAT, {
        surface: this.source,
        workspaceId,
        version,
        at: Date.now(),
      });
    }, HEARTBEAT_MS);
  }

  /** Clear the heartbeat timer. */
  stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /** Whitelist guard + payload extraction for inbound runtime messages. */
  private dispatchInbound(message: unknown): void {
    if (!isEnvelopeShape(message)) return;
    if (!MessageTypeValues.includes(message.type)) return; // Pitfall 5: ignored
    const set = this.handlers.get(message.type);
    if (!set) return;
    for (const handler of [...set]) {
      handler(message.payload);
    }
  }

  private assertKnownType(type: MessageTypeValue): void {
    if (!MessageTypeValues.includes(type)) {
      throw new Error(`MSG_UNKNOWN_TYPE: unknown message type "${type}"`);
    }
  }
}

/** Shared cross-surface bus (singleton) — imported by WorkspaceSync (W-5). */
export const broadcastBus = new BroadcastBus();

/** Minimal structural guard: a RuntimeEnvelope has id/type/createdAt/source. */
function isEnvelopeShape(message: unknown): message is RuntimeEnvelope {
  if (typeof message !== 'object' || message === null) return false;
  const candidate = message as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.source === 'string'
  );
}
