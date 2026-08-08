// src/core/messaging/MessageBus.ts — cross-context message transport (RUNTIME-04).
// Wraps BOTH transport paths with the SAME code path (no test-only branches):
//   1. runtime events: browser.runtime.onMessage.addListener / sendMessage
//      (tests drive this via wxt/testing fakeBrowser)
//   2. background port broadcasts: chrome.runtime.connect({name:'np-port'}) +
//      port.postMessage + port.onMessage.addListener
// Every message is a RuntimeEnvelope<unknown> (Appendix C); the MessageType
// whitelist rejects unknown types before dispatch (Pitfall 5, T-1-04).
// Dependency-free core (Pitfall 4): imports only sibling runtime modules.
//
// NOTE: `port.enableEmitter` (wxt 0.21+ stream API) does not exist in the pinned
// wxt ^0.19.29 — the base chrome.runtime.Port API below provides the same
// transport (PORT_STREAM_* messages flow through port.postMessage/onMessage).
import * as MessageType from '@/core/runtime/MessageType';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';

export const NP_PORT_NAME = 'np-port';

export type MessageListener = (message: RuntimeEnvelope<unknown>) => void;

export class MessageBus {
  private readonly listeners = new Set<MessageListener>();
  private readonly ports = new Set<chrome.runtime.Port>();
  private runtimeBound: ((message: unknown) => void) | null = null;

  /**
   * Open a long-lived port to the background service worker (default name
   * 'np-port'). Inbound port messages dispatch to subscribers after the
   * whitelist guard; the port is dropped on disconnect.
   */
  connect(portName: string = NP_PORT_NAME): chrome.runtime.Port {
    const port = chrome.runtime.connect({ name: portName });
    this.ports.add(port);
    port.onMessage.addListener((message: unknown) => {
      this.dispatchInbound(message);
    });
    port.onDisconnect.addListener(() => {
      this.ports.delete(port);
    });
    return port;
  }

  /**
   * Fire-and-forget publish over the runtime channel. Unknown message types are
   * rejected BEFORE dispatch (throw MSG_UNKNOWN_TYPE — §C.2, T-1-04).
   */
  publish(message: RuntimeEnvelope<unknown>): void {
    this.assertKnownType(message);
    void browser.runtime.sendMessage(message).catch((err: unknown) => {
      // Fire-and-forget: no receiving end is normal (MV3). Route to debugLog
      // with the canonical MSG_SERIALIZE code (Golden Rule 9).
      debugLog(ERROR_CODES.MSG_SERIALIZE, 'MessageBus.publish: runtime send failed', {
        error: err instanceof Error ? err : undefined,
        context: 'MessageBus.publish',
      });
    });
  }

  /** Register a subscriber for inbound runtime messages; returns an unsubscribe fn. */
  subscribe(callback: MessageListener): () => void {
    this.listeners.add(callback);
    if (!this.runtimeBound) {
      this.runtimeBound = (message: unknown) => {
        this.dispatchInbound(message);
      };
      browser.runtime.onMessage.addListener(this.runtimeBound);
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  /** Remove a previously-registered subscriber by reference. */
  unsubscribeListener(callback: MessageListener): void {
    this.listeners.delete(callback);
  }

  /** Broadcast a validated message to every connected port. */
  broadcastToPorts(message: RuntimeEnvelope<unknown>): void {
    this.assertKnownType(message);
    for (const port of this.ports) {
      port.postMessage(message);
    }
  }

  /** Close all ports, detach the runtime listener, and clear subscribers. */
  disconnect(): void {
    for (const port of this.ports) {
      port.disconnect();
    }
    this.ports.clear();
    if (this.runtimeBound) {
      browser.runtime.onMessage.removeListener(this.runtimeBound);
      this.runtimeBound = null;
    }
    this.listeners.clear();
  }

  /** Whitelist guard (T-1-04): unknown types never reach subscribers. */
  private dispatchInbound(message: unknown): void {
    if (!isRuntimeEnvelopeShape(message)) return;
    if (!this.isKnownType(message.type)) return;
    for (const callback of [...this.listeners]) {
      callback(message);
    }
  }

  private assertKnownType(message: RuntimeEnvelope<unknown>): void {
    if (!this.isKnownType(message.type)) {
      const error = new Error(`MSG_UNKNOWN_TYPE: unknown message type "${message.type}"`);
      (error as Error & { code?: string }).code = 'MSG_UNKNOWN_TYPE';
      throw error;
    }
  }

  /** Single whitelist choke point (Pitfall 5 / T-1-04). */
  private isKnownType(type: string): boolean {
    return MessageType.MessageTypeValues.includes(type as MessageType.MessageTypeValue);
  }
}

/** Minimal structural guard: a RuntimeEnvelope has id/type/createdAt/source. */
function isRuntimeEnvelopeShape(message: unknown): message is RuntimeEnvelope<unknown> {
  if (typeof message !== 'object' || message === null) return false;
  const candidate = message as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.source === 'string'
  );
}
