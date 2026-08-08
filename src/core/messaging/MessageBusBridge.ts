// src/core/messaging/MessageBusBridge.ts — the PHASE-OWNED bridge contract (W3:
// not in the spec — defined here, consumed by 01-06/01-07). It is the single
// choke point every surface (sidepanel, standalone, content host) imports:
// surfaces NEVER import MessageBus directly (Rule R-4 — enforced at module level
// by this boundary).
//
// The bridge accepts ONLY RuntimeEnvelope-shaped messages: type-checked at
// compile time (RuntimeEnvelope<unknown>) AND whitelist-guarded at runtime
// (MessageBus throws MSG_UNKNOWN_TYPE before dispatch — Pitfall 5, T-1-04).
import { MessageBus, NP_PORT_NAME } from '@/core/messaging/MessageBus';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';

export type BridgeMessageListener = (message: RuntimeEnvelope<unknown>) => void;

export class MessageBusBridge {
  private readonly bus: MessageBus;

  constructor(bus?: MessageBus) {
    this.bus = bus ?? new MessageBus();
  }

  /** Open the named background port. */
  connect(): void {
    this.bus.connect(NP_PORT_NAME);
  }

  /** Close ports, detach runtime listener, clear subscribers. */
  disconnect(): void {
    this.bus.disconnect();
  }

  /** Fire-and-forget publish; unknown types throw MSG_UNKNOWN_TYPE. */
  publish(message: RuntimeEnvelope<unknown>): void {
    this.bus.publish(message);
  }

  /** Subscribe to inbound messages; returns an unsubscribe fn. */
  subscribe(callback: BridgeMessageListener): () => void {
    return this.bus.subscribe(callback);
  }

  /** Register a persistent message listener. */
  addMessageListener(listener: BridgeMessageListener): void {
    this.bus.subscribe(listener);
  }

  /** Remove a previously-added message listener. */
  removeMessageListener(listener: BridgeMessageListener): void {
    this.bus.unsubscribeListener(listener);
  }

  /** Resolve current network connectivity (navigator.onLine). */
  async getNetworkStatus(): Promise<boolean> {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }
}
