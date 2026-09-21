import { z } from 'zod';
import { publish, subscribe } from '../../runtime/BroadcastBus';
import { generateOperationId } from '../../runtime/OperationId';

/**
 * The Phase-1 workspace handoff protocol (D-13 / OQ6).
 *
 * Three correlated messages ride `BroadcastBus`, never `MessageType`:
 * `HANDOFF_READY` (the target announces it is listening), `WORKSPACE_HANDOFF`
 * (the source publishes the projection) and `HANDOFF_ACK` (the target reports
 * what it applied). The payload is published **only** after a matching ready
 * arrives — never immediately after the tab is created — because
 * `BroadcastBus.publish` has no delivery receipt and no replay.
 *
 * The URL is an identifier/bootstrap channel, not a workspace-state transport.
 * `buildHandoffUrl` constructs its parameter set from explicitly allowlisted
 * fields (never by spreading its input), and `parseHandoffUrl` normalises then
 * validates before any parameter is used. A draft, a message body, a page
 * body, a note body, an attachment, a credential, tool/MCP state, memory state
 * or the complete `WorkspaceState` must never appear in the URL, in the
 * broadcast projection or in a log line.
 */

/** The `BroadcastBus` channel. Not a `MessageType` — this is not runtime traffic. */
export const HANDOFF_CHANNEL = 'np_workspace';

/** Version of the handoff envelope + projection shape. */
export const HANDOFF_SCHEMA_VERSION = 1;

/** Bounded wait for readiness and for each acknowledgement attempt. */
export const HANDOFF_TIMEOUT_MS = 3000;

/** Bounded retries after the first attempt: total attempts = 1 + this value. */
export const HANDOFF_MAX_RETRIES = 2;

/** Bound on any URL bootstrap value. A longer value is rejected, never truncated. */
export const HANDOFF_MAX_VALUE_CHARS = 256;

/** Bound on the ephemeral composer draft carried by the projection. */
export const HANDOFF_DRAFT_MAX_CHARS = 4000;

/** Bound on the human-readable failure message carried by an acknowledgement. */
export const HANDOFF_ERROR_MAX_CHARS = 256;

/** The Standalone surface the handoff targets. */
export const HANDOFF_TARGET_PAGE = 'standalone.html';

export type HandoffSurface = 'sidepanel' | 'standalone';

/** Canonical §21.6 failure codes for the handoff and open paths. */
export type WorkspaceHandoffErrorCode = 'WORKSPACE_HANDOFF_FAILED' | 'STANDALONE_OPEN_FAILED';

export type HandoffFailure = {
  ok: false;
  code: WorkspaceHandoffErrorCode;
  error: string;
};

export type HandoffResult = { ok: true } | HandoffFailure;

/**
 * The Phase-1 broadcast projection — the exact allowlist. Nothing else may be
 * added without a decision: the complete `WorkspaceState`, message history,
 * attachments, extracted page bodies, note contents, credentials, tool/MCP
 * state, memory state and later-phase fields are all forbidden here (D-13).
 */
export interface Phase1HandoffProjection {
  workspaceId: string;
  conversationId: string | null;
  sourceSurface: HandoffSurface;
  targetSurface: HandoffSurface;
  activeRoute: string | null;
  composerDraft: string;
  requestId: string;
  schemaVersion: number;
}

export type HandoffEnvelope =
  | {
      type: 'HANDOFF_READY';
      requestId: string;
      workspaceId: string;
      sourceSurface: HandoffSurface;
      targetSurface: HandoffSurface;
      supportedSchemaVersion: number;
    }
  | {
      type: 'WORKSPACE_HANDOFF';
      requestId: string;
      schemaVersion: number;
      projection: Phase1HandoffProjection;
    }
  | {
      type: 'HANDOFF_ACK';
      requestId: string;
      appliedSchemaVersion: number;
      result: HandoffResult;
    };

export type HandoffValidationErrorCode =
  | 'not_an_object'
  | 'unknown_type'
  | 'invalid_shape'
  | 'unsupported_schema_version';

export type HandoffEnvelopeValidation =
  | { ok: true; value: HandoffEnvelope }
  | { ok: false; code: HandoffValidationErrorCode };

const surfaceSchema = z.enum(['sidepanel', 'standalone']);
const boundedValueSchema = z.string().min(1).max(HANDOFF_MAX_VALUE_CHARS);
const routeSchema = boundedValueSchema.nullable();
const conversationIdSchema = z.string().min(1).max(HANDOFF_MAX_VALUE_CHARS).nullable();

/** The strict projection allowlist schema — exported for later-phase reuse. */
export const phase1HandoffProjectionSchema = z
  .object({
    workspaceId: boundedValueSchema,
    conversationId: conversationIdSchema,
    sourceSurface: surfaceSchema,
    targetSurface: surfaceSchema,
    activeRoute: routeSchema,
    composerDraft: z.string().max(HANDOFF_DRAFT_MAX_CHARS),
    requestId: boundedValueSchema,
    schemaVersion: z.literal(HANDOFF_SCHEMA_VERSION),
  })
  .strict();

const readySchema = z
  .object({
    type: z.literal('HANDOFF_READY'),
    requestId: boundedValueSchema,
    workspaceId: boundedValueSchema,
    sourceSurface: surfaceSchema,
    targetSurface: surfaceSchema,
    supportedSchemaVersion: z.literal(HANDOFF_SCHEMA_VERSION),
  })
  .strict();

const transferSchema = z
  .object({
    type: z.literal('WORKSPACE_HANDOFF'),
    requestId: boundedValueSchema,
    schemaVersion: z.literal(HANDOFF_SCHEMA_VERSION),
    projection: phase1HandoffProjectionSchema,
  })
  .strict();

const ackResultSchema = z.union([
  z.object({ ok: z.literal(true) }).strict(),
  z
    .object({
      ok: z.literal(false),
      code: z.enum(['WORKSPACE_HANDOFF_FAILED', 'STANDALONE_OPEN_FAILED']),
      error: z.string().max(HANDOFF_ERROR_MAX_CHARS),
    })
    .strict(),
]);

const ackSchema = z
  .object({
    type: z.literal('HANDOFF_ACK'),
    requestId: boundedValueSchema,
    appliedSchemaVersion: z.literal(HANDOFF_SCHEMA_VERSION),
    result: ackResultSchema,
  })
  .strict();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function classifyEnvelopeError(error: z.ZodError): HandoffValidationErrorCode {
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') return 'invalid_shape';
  }
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === 'schemaVersion' || field === 'supportedSchemaVersion' || field === 'appliedSchemaVersion') {
      return 'unsupported_schema_version';
    }
  }
  return 'invalid_shape';
}

function isHandoffSurface(value: string): value is HandoffSurface {
  return value === 'sidepanel' || value === 'standalone';
}

/**
 * Validate an unknown value as a handoff envelope. Structural fields and the
 * projection are both strict, so an envelope carrying the complete workspace
 * state (or any other unknown field) is rejected rather than partly applied.
 */
export function validateHandoffEnvelope(value: unknown): HandoffEnvelopeValidation {
  if (!isPlainObject(value)) {
    return { ok: false, code: 'not_an_object' };
  }

  const type = value.type;
  if (type !== 'HANDOFF_READY' && type !== 'WORKSPACE_HANDOFF' && type !== 'HANDOFF_ACK') {
    return { ok: false, code: 'unknown_type' };
  }

  const schema = type === 'HANDOFF_READY' ? readySchema : type === 'WORKSPACE_HANDOFF' ? transferSchema : ackSchema;
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    return { ok: true, value: parsed.data as HandoffEnvelope };
  }
  return { ok: false, code: classifyEnvelopeError(parsed.error) };
}

export interface HandoffTransport {
  publish(envelope: HandoffEnvelope): void;
  subscribe(listener: (value: unknown) => void): () => void;
}

/** The `BroadcastBus`-backed transport the surface controllers use. */
export const handoffTransport: HandoffTransport = {
  publish(envelope) {
    publish(HANDOFF_CHANNEL, envelope);
  },
  subscribe(listener) {
    return subscribe(HANDOFF_CHANNEL, (payload) => listener(payload));
  },
};

/* -------------------------------------------------------------------------- */
/* URL bootstrap                                                              */
/* -------------------------------------------------------------------------- */

/** The URL allowlist: nothing else may be read from or written to the URL. */
const ALLOWED_PARAMETERS = [
  'workspaceId',
  'conversationId',
  'page',
  'requestId',
  'schemaVersion',
  'source',
  'target',
] as const;

export interface HandoffBootstrap {
  workspaceId: string;
  conversationId: string | null;
  page: string | null;
  requestId: string | null;
  schemaVersion: number;
  sourceSurface: HandoffSurface | null;
  targetSurface: HandoffSurface | null;
}

export interface HandoffUrlInput {
  workspaceId: string;
  /** The handoff request id is generated by the source controller. */
  requestId: string;
  conversationId?: string | null;
  /** The target route/page (emitted as the canonical `page` parameter). */
  route?: string | null;
  sourceSurface?: HandoffSurface;
  targetSurface?: HandoffSurface;
  schemaVersion?: number;
}

export type HandoffUrlErrorCode =
  | 'unknown_parameter'
  | 'missing_parameter'
  | 'malformed_parameter'
  | 'oversized_parameter'
  | 'unsupported_schema_version'
  | 'invalid_surface';

export type HandoffUrlParseResult =
  | { ok: true; value: HandoffBootstrap | null }
  | { ok: false; code: HandoffUrlErrorCode; parameter?: string };

/**
 * Build the Standalone bootstrap URL. Every parameter is set explicitly from an
 * allowlisted field — the input is never spread, so an over-wide caller object
 * cannot leak a draft, a credential or any other field into the URL.
 */
export function buildHandoffUrl(input: HandoffUrlInput): string {
  const params = new URLSearchParams();
  params.set('workspaceId', input.workspaceId);
  params.set('requestId', input.requestId);
  params.set('schemaVersion', String(input.schemaVersion ?? HANDOFF_SCHEMA_VERSION));
  if (input.conversationId) params.set('conversationId', input.conversationId);
  if (input.route) params.set('page', input.route);
  if (input.sourceSurface) params.set('source', input.sourceSurface);
  if (input.targetSurface) params.set('target', input.targetSurface);
  return `${HANDOFF_TARGET_PAGE}?${params.toString()}`;
}

function toSearchParams(search: URLSearchParams | string): URLSearchParams {
  if (search instanceof URLSearchParams) return search;

  const withoutHash = search.split('#')[0] ?? '';
  const queryIndex = withoutHash.indexOf('?');
  if (queryIndex >= 0) return new URLSearchParams(withoutHash.slice(queryIndex + 1));
  if (!withoutHash.includes('=')) return new URLSearchParams('');
  return new URLSearchParams(withoutHash);
}

/**
 * Normalise then validate a URL bootstrap. Never throws. Every rejection has
 * its own typed code, an oversized value is rejected rather than truncated, and
 * no parameter is used before it has been validated (T-1-31).
 */
export function parseHandoffUrl(search: URLSearchParams | string): HandoffUrlParseResult {
  const params = toSearchParams(search);

  for (const key of params.keys()) {
    if (!(ALLOWED_PARAMETERS as readonly string[]).includes(key)) {
      return { ok: false, code: 'unknown_parameter', parameter: key };
    }
  }

  const workspaceId = params.get('workspaceId');
  const conversationIdRaw = params.get('conversationId');
  const page = params.get('page');
  const requestId = params.get('requestId');
  const schemaVersionRaw = params.get('schemaVersion');
  const source = params.get('source');
  const target = params.get('target');

  for (const [parameter, value] of [
    ['workspaceId', workspaceId],
    ['conversationId', conversationIdRaw],
    ['page', page],
    ['requestId', requestId],
  ] as const) {
    if (value !== null && value.length > HANDOFF_MAX_VALUE_CHARS) {
      return { ok: false, code: 'oversized_parameter', parameter };
    }
  }

  if (source !== null && !isHandoffSurface(source)) {
    return { ok: false, code: 'invalid_surface', parameter: 'source' };
  }
  if (target !== null && !isHandoffSurface(target)) {
    return { ok: false, code: 'invalid_surface', parameter: 'target' };
  }

  // An empty conversationId is a valid handoff: it normalises to `null`.
  const conversationId = conversationIdRaw === null || conversationIdRaw.length === 0 ? null : conversationIdRaw;

  if (workspaceId === null) {
    const isDirectOpen =
      conversationId === null && requestId === null && schemaVersionRaw === null && source === null && target === null;
    if (isDirectOpen) return { ok: true, value: null };
    return { ok: false, code: 'missing_parameter', parameter: 'workspaceId' };
  }

  for (const [parameter, value] of [
    ['workspaceId', workspaceId],
    ['page', page],
    ['requestId', requestId],
  ] as const) {
    if (value !== null && (value.length === 0 || value !== value.trim())) {
      return { ok: false, code: 'malformed_parameter', parameter };
    }
  }
  if (conversationId !== null && conversationId !== conversationId.trim()) {
    return { ok: false, code: 'malformed_parameter', parameter: 'conversationId' };
  }

  let schemaVersion = HANDOFF_SCHEMA_VERSION;
  if (requestId !== null) {
    if (schemaVersionRaw === null) {
      return { ok: false, code: 'missing_parameter', parameter: 'schemaVersion' };
    }
    const parsedVersion = Number(schemaVersionRaw);
    if (!Number.isInteger(parsedVersion) || String(parsedVersion) !== schemaVersionRaw) {
      return { ok: false, code: 'malformed_parameter', parameter: 'schemaVersion' };
    }
    if (parsedVersion !== HANDOFF_SCHEMA_VERSION) {
      return { ok: false, code: 'unsupported_schema_version', parameter: 'schemaVersion' };
    }
    schemaVersion = parsedVersion;
  } else if (schemaVersionRaw !== null) {
    // A declared version without a request id is a malformed bootstrap.
    return { ok: false, code: 'missing_parameter', parameter: 'requestId' };
  }

  return {
    ok: true,
    value: {
      workspaceId,
      conversationId,
      page,
      requestId,
      schemaVersion,
      sourceSurface: source,
      targetSurface: target,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Initiator (source side)                                                    */
/* -------------------------------------------------------------------------- */

export interface HandoffOpenTargetArgs {
  requestId: string;
  workspaceId: string;
  page: string | null;
}

export interface HandoffInitiatorRequest {
  workspaceId: string;
  conversationId: string | null;
  page: string | null;
  /** Absent is treated as an empty draft — never `undefined` downstream. */
  composerDraft?: string;
  sourceSurface: HandoffSurface;
  targetSurface: HandoffSurface;
}

export interface HandoffInitiatorDeps {
  /** The navigation adapter — resolves once the target surface exists/focused. */
  openTarget: (args: HandoffOpenTargetArgs) => Promise<void>;
  transport?: HandoffTransport;
  requestId?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface HandoffInitiator {
  readonly requestId: string;
  start(request: HandoffInitiatorRequest): Promise<HandoffResult>;
  dispose(): void;
}

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

/**
 * The source-side protocol machine. It subscribes **before** opening the
 * target, waits for a correlated ready, publishes the projection, and only
 * resolves success on a validated acknowledgement. Missing readiness or a
 * missing acknowledgement resolves a typed recoverable failure — never a
 * success claim (T-1-34).
 */
export function createHandoffInitiator(deps: HandoffInitiatorDeps): HandoffInitiator {
  const transport = deps.transport ?? handoffTransport;
  const requestId = deps.requestId ?? generateOperationId();
  const timeoutMs = deps.timeoutMs ?? HANDOFF_TIMEOUT_MS;
  const maxRetries = Math.max(0, deps.maxRetries ?? HANDOFF_MAX_RETRIES);

  let unsubscribe: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  let started: Promise<HandoffResult> | null = null;
  let expected: { workspaceId: string; targetSurface: HandoffSurface } | null = null;
  let bufferedReady = false;
  let phase: 'idle' | 'ready' | 'ack' = 'idle';
  let readyResolver: ((ready: boolean) => void) | null = null;
  let ackResolver: ((result: HandoffResult | null) => void) | null = null;

  function clearTimer(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function armTimer(onTimeout: () => void): void {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      onTimeout();
    }, timeoutMs);
  }

  function finish(): void {
    disposed = true;
    clearTimer();
    const resolveReady = readyResolver;
    readyResolver = null;
    const resolveAck = ackResolver;
    ackResolver = null;
    phase = 'idle';
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    resolveReady?.(false);
    resolveAck?.(null);
  }

  function listener(value: unknown): void {
    const validated = validateHandoffEnvelope(value);
    if (!validated.ok) return;
    const envelope = validated.value;
    if (envelope.requestId !== requestId) return; // unmatched correlation is discarded
    if (expected === null) return;

    if (envelope.type === 'HANDOFF_READY') {
      if (envelope.workspaceId !== expected.workspaceId) return;
      if (envelope.targetSurface !== expected.targetSurface) return;
      if (phase === 'ready') {
        const resolve = readyResolver;
        readyResolver = null;
        clearTimer();
        resolve?.(true);
      } else if (phase === 'idle') {
        // A cold tab can announce readiness before the open callback returns.
        bufferedReady = true;
      }
      return;
    }

    if (envelope.type === 'HANDOFF_ACK') {
      if (phase !== 'ack' || ackResolver === null) return; // out of order or already settled
      const resolve = ackResolver;
      ackResolver = null;
      clearTimer();
      resolve(envelope.result);
    }
  }

  function waitForReady(): Promise<boolean> {
    if (bufferedReady) {
      bufferedReady = false;
      return Promise.resolve(true);
    }
    phase = 'ready';
    return new Promise<boolean>((resolve) => {
      readyResolver = resolve;
      armTimer(() => {
        const pending = readyResolver;
        readyResolver = null;
        phase = 'idle';
        pending?.(false);
      });
    });
  }

  function waitForAck(): Promise<HandoffResult | null> {
    phase = 'ack';
    return new Promise<HandoffResult | null>((resolve) => {
      ackResolver = resolve;
      armTimer(() => {
        const pending = ackResolver;
        ackResolver = null;
        phase = 'idle';
        pending?.(null);
      });
    });
  }

  function buildProjection(request: HandoffInitiatorRequest): Phase1HandoffProjection {
    return {
      workspaceId: request.workspaceId,
      conversationId: request.conversationId,
      sourceSurface: request.sourceSurface,
      targetSurface: request.targetSurface,
      activeRoute: request.page,
      composerDraft: request.composerDraft ?? '',
      requestId,
      schemaVersion: HANDOFF_SCHEMA_VERSION,
    };
  }

  async function run(request: HandoffInitiatorRequest): Promise<HandoffResult> {
    expected = { workspaceId: request.workspaceId, targetSurface: request.targetSurface };
    unsubscribe = transport.subscribe(listener); // subscribe BEFORE opening the target

    try {
      await deps.openTarget({ requestId, workspaceId: request.workspaceId, page: request.page });
    } catch (error) {
      finish();
      return { ok: false, code: 'STANDALONE_OPEN_FAILED', error: messageOf(error) };
    }

    const ready = await waitForReady();
    if (disposed || !ready) {
      finish();
      return {
        ok: false,
        code: 'WORKSPACE_HANDOFF_FAILED',
        error: 'The standalone view did not announce readiness.',
      };
    }

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (disposed) break;
      transport.publish({
        type: 'WORKSPACE_HANDOFF',
        requestId,
        schemaVersion: HANDOFF_SCHEMA_VERSION,
        projection: buildProjection(request),
      });

      const result = await waitForAck();
      if (result) {
        finish();
        return result;
      }
    }

    finish();
    return {
      ok: false,
      code: 'WORKSPACE_HANDOFF_FAILED',
      error: 'The standalone view did not acknowledge the workspace.',
    };
  }

  return {
    requestId,
    start(request) {
      if (started === null) started = run(request);
      return started;
    },
    dispose() {
      started = null;
      finish();
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Target (Standalone side)                                                   */
/* -------------------------------------------------------------------------- */

export interface HandoffTargetDeps {
  /** The validated URL bootstrap: the target's own identity. */
  bootstrap: HandoffBootstrap;
  /** The apply adapter — called at most once per request id. */
  apply: (projection: Phase1HandoffProjection) => void;
  transport?: HandoffTransport;
}

export interface HandoffTarget {
  start(): void;
  dispose(): void;
  appliedRequestIds(): readonly string[];
}

/**
 * The target-side protocol machine. It announces readiness, validates every
 * inbound message against its own bootstrap identity, applies at most once per
 * request id, and acknowledges what it applied. A duplicate transfer is
 * acknowledged again without being applied twice, so a source retry can
 * complete (T-1-30).
 */
export function createHandoffTarget(deps: HandoffTargetDeps): HandoffTarget {
  const transport = deps.transport ?? handoffTransport;
  const targetSurface: HandoffSurface = deps.bootstrap.targetSurface ?? 'standalone';
  const appliedRequestIds = new Set<string>();
  let unsubscribe: (() => void) | null = null;

  function listener(value: unknown): void {
    const validated = validateHandoffEnvelope(value);
    if (!validated.ok) return;
    const envelope = validated.value;
    if (envelope.type !== 'WORKSPACE_HANDOFF') return;

    if (envelope.requestId !== deps.bootstrap.requestId) return;
    const { projection } = envelope;
    if (projection.workspaceId !== deps.bootstrap.workspaceId) return;
    if (projection.targetSurface !== targetSurface) return;

    if (appliedRequestIds.has(envelope.requestId)) {
      // Idempotent duplicate: acknowledge again, never apply twice.
      transport.publish({
        type: 'HANDOFF_ACK',
        requestId: envelope.requestId,
        appliedSchemaVersion: HANDOFF_SCHEMA_VERSION,
        result: { ok: true },
      });
      return;
    }

    let result: HandoffResult;
    try {
      deps.apply(projection);
      result = { ok: true };
    } catch (error) {
      result = { ok: false, code: 'WORKSPACE_HANDOFF_FAILED', error: messageOf(error) };
    }
    if (result.ok) appliedRequestIds.add(envelope.requestId);

    transport.publish({
      type: 'HANDOFF_ACK',
      requestId: envelope.requestId,
      appliedSchemaVersion: HANDOFF_SCHEMA_VERSION,
      result,
    });
  }

  return {
    start() {
      if (deps.bootstrap.requestId === null) return;
      unsubscribe = transport.subscribe(listener);
      transport.publish({
        type: 'HANDOFF_READY',
        requestId: deps.bootstrap.requestId,
        workspaceId: deps.bootstrap.workspaceId,
        sourceSurface: deps.bootstrap.sourceSurface ?? 'sidepanel',
        targetSurface,
        supportedSchemaVersion: HANDOFF_SCHEMA_VERSION,
      });
    },
    dispose() {
      unsubscribe?.();
      unsubscribe = null;
    },
    appliedRequestIds: () => Array.from(appliedRequestIds),
  };
}
