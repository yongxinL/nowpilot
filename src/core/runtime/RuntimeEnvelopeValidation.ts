import { z } from 'zod';
import { isOperationId } from './OperationId';
import { ENVELOPE_SOURCES } from './RuntimeEnvelope';
import type {
  EnvelopeType,
  MessageTypeValue,
  RuntimeEnvelope,
  ScaffoldMessageTypeValue,
} from './RuntimeEnvelope';

/**
 * Payload schemas and envelope validation — split out of RuntimeEnvelope.ts so
 * the zod runtime never enters the content-script bundle.
 *
 * The content script imports `createEnvelope` from the zod-free registry
 * module; the schemas are a one-way dependency of this module and are reached
 * through the registry's re-export, so Rollup drops the whole zod graph from
 * any entrypoint that does not validate envelopes. Measured: with the schemas
 * declared in the registry module the content bundle grew from 4.1 kB to
 * 73.8 kB; after the split it returns to the registry-only size.
 *
 * Payload bounds: a string field is bounded so an oversized payload is
 * rejected rather than accepted and truncated (T-1-26).
 * `MAX_LARGE_TEXT_CHARS` matches the spec's §26.6 `PAGE_HTML_MAX_BYTES`
 * (2 MB) — the largest legitimate payload string this runtime ever carries,
 * and the extraction pipeline's own hard cap.
 */
const MAX_ID_CHARS = 128;
const MAX_URL_CHARS = 2048;
const MAX_LARGE_TEXT_CHARS = 2_000_000;

/**
 * One strict payload schema per canonical type (Appendix E / §20.1).
 *
 * `.strict()` means an unknown extra payload field is a rejection, so a
 * handler can never receive data the schema did not approve. Shapes that the
 * spec fixes (PROXY_FETCH §10.7; the PORT_STREAM_* protocol Appendix E) are
 * declared to that shape; types no Phase-1 code constructs yet carry the
 * minimal bounded shape their producer will extend.
 */
const payloadSchemas = {
  PROXY_FETCH: z
    .object({
      addonId: z.string().min(1).max(MAX_ID_CHARS),
      url: z.string().min(1).max(MAX_URL_CHARS),
      method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
      headers: z
        .record(z.string().max(MAX_ID_CHARS), z.string().max(MAX_URL_CHARS))
        .optional(),
      body: z.string().max(MAX_LARGE_TEXT_CHARS).optional(),
      credentials: z.enum(['include', 'omit']).optional(),
    })
    .strict(),
  EXTRACT_PAGE_CONTENT: z
    .object({
      url: z.string().max(MAX_URL_CHARS).optional(),
      tabId: z.number().int().optional(),
    })
    .strict(),
  OPEN_SIDE_PANEL: z
    .object({
      workspaceId: z.string().max(MAX_ID_CHARS).optional(),
    })
    .strict(),
  OPEN_STANDALONE: z
    .object({
      workspaceId: z.string().max(MAX_ID_CHARS).optional(),
      conversationId: z.string().max(MAX_ID_CHARS).optional(),
      page: z.string().max(MAX_ID_CHARS).optional(),
    })
    .strict(),
  SESSION_TOKEN_UPDATE: z
    .object({
      token: z.string().max(MAX_LARGE_TEXT_CHARS),
    })
    .strict(),
  BACKGROUND_STATE: z
    .object({
      state: z.string().min(1).max(MAX_ID_CHARS),
    })
    .strict(),
  KEEPALIVE_PING: z.object({}).strict(),
  PORT_STREAM_START: z
    .object({
      operationId: z.string().min(1).max(MAX_ID_CHARS),
      kind: z.enum(['session-tokens', 'workspace-mirror']),
    })
    .strict(),
  PORT_STREAM_CHUNK: z
    .object({
      operationId: z.string().min(1).max(MAX_ID_CHARS),
      data: z.unknown(),
    })
    .strict(),
  PORT_STREAM_END: z
    .object({
      operationId: z.string().min(1).max(MAX_ID_CHARS),
      ok: z.boolean(),
      error: z.string().max(MAX_LARGE_TEXT_CHARS).optional(),
    })
    .strict(),
  PORT_STREAM_ABORT: z
    .object({
      operationId: z.string().min(1).max(MAX_ID_CHARS),
    })
    .strict(),
  ADDON_EVENT: z
    .object({
      addonId: z.string().min(1).max(MAX_ID_CHARS),
      event: z.string().min(1).max(MAX_ID_CHARS),
    })
    .strict(),
  WORKSPACE_HANDOFF: z
    .object({
      workspaceId: z.string().min(1).max(MAX_ID_CHARS),
      conversationId: z.string().max(MAX_ID_CHARS).optional(),
    })
    .strict(),
  WORKSPACE_UPDATED: z
    .object({
      workspaceId: z.string().min(1).max(MAX_ID_CHARS),
      conversationId: z.string().max(MAX_ID_CHARS).nullable().optional(),
    })
    .strict(),
  WORKSPACE_HEARTBEAT: z
    .object({
      workspaceId: z.string().min(1).max(MAX_ID_CHARS),
    })
    .strict(),
} satisfies Record<MessageTypeValue, z.ZodType>;

/**
 * Scaffold-local payload schemas — bounded and strict for the same reason as
 * the canonical ones, so a scaffold envelope is validated rather than trusted.
 */
const scaffoldPayloadSchemas = {
  CONTENT_SCRIPT_READY: z
    .object({
      url: z.string().max(MAX_URL_CHARS),
    })
    .strict(),
  SPA_NAVIGATION: z
    .object({
      url: z.string().max(MAX_URL_CHARS),
    })
    .strict(),
  PAGE_LIVE_CONTEXT: z
    .object({
      url: z.string().max(MAX_URL_CHARS),
    })
    .strict(),
  PAGE_EXTRACTION_REQUESTED: z
    .object({
      tabId: z.number().int(),
      url: z.string().max(MAX_URL_CHARS),
    })
    .strict(),
  PAGE_HTML_PAYLOAD: z
    .object({
      html: z.string().max(MAX_LARGE_TEXT_CHARS),
      baseUrl: z.string().max(MAX_URL_CHARS),
      truncated: z.boolean(),
      strategyId: z.string().max(MAX_ID_CHARS).optional(),
    })
    .strict(),
} satisfies Record<ScaffoldMessageTypeValue, z.ZodType>;

/** Structural fields every envelope carries — an unknown one is a rejection. */
const ENVELOPE_KEYS: readonly string[] = ['type', 'operationId', 'timestamp', 'source', 'payload'];

const envelopeSourceSet = new Set<string>(ENVELOPE_SOURCES);

export type RuntimeEnvelopeValidation =
  | { ok: true; envelope: RuntimeEnvelope }
  | { ok: false; error: string };

function schemaForType(type: EnvelopeType): z.ZodType {
  if (type in payloadSchemas) return payloadSchemas[type as MessageTypeValue];
  return scaffoldPayloadSchemas[type as ScaffoldMessageTypeValue];
}

function isKnownEnvelopeType(type: unknown): type is EnvelopeType {
  return (
    typeof type === 'string' &&
    (type in payloadSchemas || type in scaffoldPayloadSchemas)
  );
}

/**
 * Validate an unknown value as a `RuntimeEnvelope`: structural fields AND the
 * payload against its type's strict schema. A failure is a typed result — the
 * caller decides how to fail closed; nothing is half-applied.
 */
export function validateEnvelope(value: unknown): RuntimeEnvelopeValidation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, error: 'ENVELOPE_NOT_AN_OBJECT' };
  }

  const candidate = value as Record<string, unknown>;

  if (Object.keys(candidate).some((key) => !ENVELOPE_KEYS.includes(key))) {
    return { ok: false, error: 'ENVELOPE_UNKNOWN_FIELD' };
  }

  const type = candidate.type;
  if (!isKnownEnvelopeType(type)) {
    return { ok: false, error: 'ENVELOPE_UNKNOWN_TYPE' };
  }

  if (!isOperationId(candidate.operationId)) {
    return { ok: false, error: 'ENVELOPE_INVALID_OPERATION_ID' };
  }

  if (
    typeof candidate.timestamp !== 'number' ||
    !Number.isFinite(candidate.timestamp) ||
    candidate.timestamp < 0
  ) {
    return { ok: false, error: 'ENVELOPE_INVALID_TIMESTAMP' };
  }

  if (typeof candidate.source !== 'string' || !envelopeSourceSet.has(candidate.source)) {
    return { ok: false, error: 'ENVELOPE_INVALID_SOURCE' };
  }

  if (!Object.prototype.hasOwnProperty.call(candidate, 'payload')) {
    return { ok: false, error: 'ENVELOPE_MISSING_PAYLOAD' };
  }

  const parsedPayload = schemaForType(type).safeParse(candidate.payload);
  if (!parsedPayload.success) {
    return { ok: false, error: `ENVELOPE_PAYLOAD_INVALID:${type}` };
  }

  return { ok: true, envelope: candidate as unknown as RuntimeEnvelope };
}

export function isEnvelope(value: unknown): value is RuntimeEnvelope {
  return validateEnvelope(value).ok;
}
