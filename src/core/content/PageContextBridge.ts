// src/core/content/PageContextBridge.ts — the content-side messaging bridge
// (D-16/D-17). It is the ONLY message path content code uses: every outbound
// message is a RuntimeEnvelope with a canonical MessageType (Pitfall 5 — no
// throwaway contracts) published through MessageBusBridge (01-03), and every
// reply is a ResponseEnvelope (Appendix C) — never a mutated request envelope.
// The transport envelope carries NO kind/trust/instructionAuthority fields —
// those are Phase 4b ContextItem concerns (§C.1), not transport concerns.
// Dependency-free core (Pitfall 4): imports only messaging/runtime/error
// siblings — no React, no antd, no zustand.
import { MessageBusBridge } from '@/core/messaging/MessageBusBridge';
import type { BridgeMessageListener } from '@/core/messaging/MessageBusBridge';
import { MessageType } from '@/core/runtime/MessageType';
import type { MessageTypeValue } from '@/core/runtime/MessageType';
import type { RuntimeEnvelope, ResponseEnvelope } from '@/core/runtime/RuntimeEnvelope';
import { createOperationId } from '@/core/runtime/OperationId';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import type { PageContext } from './PageContext';

/** D-17 content capabilities handshake payload (phase-owned shape). */
export interface ContentCapabilities {
  extraction: boolean;
  domAccess: 'isolated';
}

const DEFAULT_CAPABILITIES: ContentCapabilities = { extraction: true, domAccess: 'isolated' };

/** Bounded capabilities wait (T-1-14: always cleared on resolve). */
const CAPABILITIES_TIMEOUT_MS = 3000;

export class PageContextBridge {
  private readonly bridge: MessageBusBridge;

  constructor(bridge?: MessageBusBridge) {
    this.bridge = bridge ?? new MessageBusBridge();
  }

  /** Publish the extracted page context (EXTRACT_PAGE_CONTENT, D-17). */
  publishContext(page: PageContext): void {
    this.bridge.publish(this.envelope(MessageType.EXTRACT_PAGE_CONTENT, { page }));
  }

  /** Fire-and-forget PING (D-17 keepalive / presence). */
  sendPing(): void {
    this.bridge.publish(this.envelope(MessageType.PING, {}));
  }

  /**
   * D-17 capabilities handshake: publishes GET_CONTENT_CAPABILITIES and resolves
   * on the matching CONTENT_CAPABILITIES reply. On timeout (3000ms) logs
   * CONTENT_CAPABILITIES and resolves the default — never rejects.
   */
  getCapabilities(): Promise<ContentCapabilities> {
    return new Promise((resolve) => {
      const opId = createOperationId();
      const unsubscribe = this.bridge.subscribe((message) => {
        if (message.type !== MessageType.CONTENT_CAPABILITIES) return;
        if (message.id !== opId) return;
        clearTimeout(timer);
        unsubscribe();
        resolve(sanitizeCapabilities(message.payload));
      });
      const timer = setTimeout(() => {
        unsubscribe();
        debugLog(ERROR_CODES.CONTENT_CAPABILITIES, 'capabilities handshake timed out', {
          module: 'PageContextBridge',
        });
        resolve(DEFAULT_CAPABILITIES);
      }, CAPABILITIES_TIMEOUT_MS);
      this.bridge.publish(this.envelope(MessageType.GET_CONTENT_CAPABILITIES, {}, opId));
    });
  }

  /** Reply to an inbound PING — a PONG ResponseEnvelope, never a mutated request. */
  replyPong(requestId: string): void {
    this.bridge.publish(
      this.envelope(MessageType.PONG, {
        id: requestId,
        ok: true,
        data: { pong: true },
      } satisfies ResponseEnvelope<{ pong: true }>),
    );
  }

  /** Reply to an inbound GET_CONTENT_CAPABILITIES with the capability flags. */
  replyCapabilities(requestId: string, capabilities: ContentCapabilities): void {
    this.bridge.publish(this.envelope(MessageType.CONTENT_CAPABILITIES, capabilities, requestId));
  }

  /** Subscribe to inbound messages; returns an unsubscribe fn. */
  onMessage(cb: BridgeMessageListener): () => void {
    return this.bridge.subscribe(cb);
  }

  private envelope(
    type: MessageTypeValue,
    payload: unknown,
    id: string = createOperationId(),
  ): RuntimeEnvelope<unknown> {
    return { id, type, createdAt: Date.now(), source: 'content', payload };
  }
}

/** T-1-16: the CONTENT_CAPABILITIES reply is validated against the shape. */
function sanitizeCapabilities(payload: unknown): ContentCapabilities {
  if (typeof payload === 'object' && payload !== null) {
    const caps = payload as Partial<ContentCapabilities>;
    if (typeof caps.extraction === 'boolean' && caps.domAccess === 'isolated') {
      return { extraction: caps.extraction, domAccess: caps.domAccess };
    }
  }
  return DEFAULT_CAPABILITIES;
}
