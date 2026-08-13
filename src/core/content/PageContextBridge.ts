// src/core/content/PageContextBridge.ts — the content-side messaging bridge
// (D-16/D-17). It is the ONLY message path content code uses: every outbound
// message is a RuntimeEnvelope with a canonical MessageType (Pitfall 5 — no
// throwaway contracts) published through MessageBusBridge (01-03), and every
// reply is a ResponseEnvelope (Appendix C) — never a mutated request envelope.
// The transport envelope carries NO kind/trust/instructionAuthority fields —
// those are Phase 4b ContextItem concerns (§C.1), not transport concerns.
// Dependency-free core (Pitfall 4): imports only messaging/runtime/error
// siblings + the type-only RawNode from apcLite.types (R-1 home — erased at
// compile, zero runtime import) — no React, no antd, no zustand.
//
// 04a-07 (D-4a-08/12): the single canonical PAGE_CONTENT_EXTRACTED addition
// (Pitfall 5 — EXTRACT_PAGE_CONTENT above is the request) + the ExtractionPayload
// {html, baseUrl, truncated} contract + the requestExtraction/replyExtracted
// roundtrip. ExtractionPayload is the interface contract PageContentService
// (04a-08) compiles against.
import { MessageBusBridge } from '@/core/messaging/MessageBusBridge';
import type { BridgeMessageListener } from '@/core/messaging/MessageBusBridge';
import { MessageType } from '@/core/runtime/MessageType';
import type { MessageTypeValue } from '@/core/runtime/MessageType';
import type { RuntimeEnvelope, ResponseEnvelope } from '@/core/runtime/RuntimeEnvelope';
import { createOperationId } from '@/core/runtime/OperationId';
import { debugLog } from '@/core/error/debugLog';
import { ERROR_CODES } from '@/core/error/errorCodes';
import type { PageContext } from './PageContext';
import type { RawNode } from '@/core/extraction/apcLite.types';

/** D-17 content capabilities handshake payload (phase-owned shape). */
export interface ContentCapabilities {
  extraction: boolean;
  domAccess: 'isolated';
}

/**
 * D-4a-08 extraction reply payload — the interface contract PageContentService
 * (04a-08) compiles against. The payload carries the baseUrl as a SIBLING field
 * (the content bundle stays pure string manipulation); the panel injects the
 * `<base>` into its detached DOMParser doc (D-4a-08).
 */
export interface ExtractionPayload {
  html: string;
  baseUrl: string;
  truncated: boolean;
}

/** EXTRACT_PAGE_CONTENT request payload — the mode discriminator (D-4a-14). */
export interface ExtractionRequest {
  tabId: number;
  mode: 'default' | 'actionable';
}

/**
 * PAGE_CONTENT_EXTRACTED reply data — discriminated by the request mode
 * (D-4a-12): 'default' carries the serialized ExtractionPayload; 'actionable'
 * carries the walked RawNode[] tree (AxDomWalker output — password values
 * omitted at capture, D-4a-20).
 */
export type ExtractionReplyData = ExtractionPayload | RawNode[];

/**
 * The typed CONTENT_EXTRACT_FAILED carrier (D-4a-03/19/22) — requestExtraction
 * rejects with this on timeout or a malformed reply (the canonical §C.2 code,
 * never the O.12 non-canonical string, never an unhandled rejection). Modeled
 * on the TimeoutError / ContextTooLargeError typed-error precedents.
 */
export interface ContentExtractFailedError extends Error {
  code: 'CONTENT_EXTRACT_FAILED';
}

const DEFAULT_CAPABILITIES: ContentCapabilities = { extraction: true, domAccess: 'isolated' };

/** Bounded capabilities wait (T-1-14: always cleared on resolve). */
const CAPABILITIES_TIMEOUT_MS = 3000;

/** Bounded extraction wait (T-4a-19 / T-1-14: always cleared on settle). */
const EXTRACTION_TIMEOUT_MS = 5000;

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

  /**
   * Extraction request/reply roundtrip (04a-07): publishes an EXTRACT_PAGE_CONTENT
   * envelope with `{tabId, mode}` and resolves on the matching PAGE_CONTENT_EXTRACTED
   * reply (opId correlation — the getCapabilities L57-58 precedent). On timeout
   * (default 5000ms — the §22.1 hard cap) or a malformed reply it REJECTS with the
   * typed CONTENT_EXTRACT_FAILED carrier (D-4a-03/19/22) — never a silent default,
   * never an unhandled rejection. The bounded-wait timer is ALWAYS cleared
   * (T-1-14). `TData` defaults to ExtractionPayload (the 'default' mode contract);
   * actionable callers opt into the walked RawNode[] shape.
   */
  requestExtraction<TData = ExtractionPayload>(
    tabId: number,
    mode: 'default' | 'actionable',
    options: { timeoutMs?: number } = {},
  ): Promise<TData> {
    return new Promise<TData>((resolve, reject) => {
      const opId = createOperationId();
      const timeoutMs = options.timeoutMs ?? EXTRACTION_TIMEOUT_MS;
      const unsubscribe = this.bridge.subscribe((message) => {
        if (message.type !== MessageType.PAGE_CONTENT_EXTRACTED) return;
        if (message.id !== opId) return;
        clearTimeout(timer);
        unsubscribe();
        const data = sanitizeExtractionReply(message.payload, mode);
        if (data === null) {
          reject(contentExtractFailedError('malformed PAGE_CONTENT_EXTRACTED reply payload'));
          return;
        }
        resolve(data as TData);
      });
      const timer = setTimeout(() => {
        unsubscribe();
        debugLog(ERROR_CODES.CONTENT_EXTRACT_FAILED, 'extraction request timed out', {
          module: 'PageContextBridge',
        });
        reject(contentExtractFailedError(`extraction timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.bridge.publish(
        this.envelope(
          MessageType.EXTRACT_PAGE_CONTENT,
          { tabId, mode } satisfies ExtractionRequest,
          opId,
        ),
      );
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

  /**
   * Reply to an inbound EXTRACT_PAGE_CONTENT — a PAGE_CONTENT_EXTRACTED
   * ResponseEnvelope carrying the mode-discriminated payload (default →
   * ExtractionPayload, actionable → RawNode[]; D-4a-12). The reply envelope
   * id is the REQUEST's opId (replyCapabilities precedent) so the requester's
   * correlation matches; the reply envelope is never a mutated request
   * (replyPong shape).
   */
  replyExtracted(requestId: string, payload: ExtractionReplyData): void {
    this.bridge.publish(
      this.envelope(
        MessageType.PAGE_CONTENT_EXTRACTED,
        {
          id: requestId,
          ok: true,
          data: payload,
        } satisfies ResponseEnvelope<ExtractionReplyData>,
        requestId,
      ),
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

/** Factory for the typed CONTENT_EXTRACT_FAILED carrier (D-4a-22 canonical code). */
function contentExtractFailedError(message: string): ContentExtractFailedError {
  const err = new Error(message) as ContentExtractFailedError;
  err.name = 'ContentExtractFailedError';
  err.code = ERROR_CODES.CONTENT_EXTRACT_FAILED;
  return err;
}

/**
 * T-4a-19: the PAGE_CONTENT_EXTRACTED reply is shape-validated before resolve
 * (the sanitizeCapabilities precedent) — it must be a ResponseEnvelope with
 * ok:true whose data matches the mode-discriminated payload shape. Malformed
 * replies reject typed with CONTENT_EXTRACT_FAILED. 'actionable' data is
 * validated structurally as an array (deep RawNode validation is the 04a-04
 * panel-boundary ApcLiteStrategy zod gate); 'default' data is validated field
 * by field against ExtractionPayload.
 */
function sanitizeExtractionReply(
  payload: unknown,
  mode: 'default' | 'actionable',
): ExtractionReplyData | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const reply = payload as Partial<ResponseEnvelope<unknown>>;
  if (reply.ok !== true) return null;
  const data = reply.data;
  if (mode === 'actionable') {
    return Array.isArray(data) ? (data as RawNode[]) : null;
  }
  if (typeof data === 'object' && data !== null) {
    const candidate = data as Partial<ExtractionPayload>;
    if (
      typeof candidate.html === 'string' &&
      typeof candidate.baseUrl === 'string' &&
      typeof candidate.truncated === 'boolean'
    ) {
      return { html: candidate.html, baseUrl: candidate.baseUrl, truncated: candidate.truncated };
    }
  }
  return null;
}
