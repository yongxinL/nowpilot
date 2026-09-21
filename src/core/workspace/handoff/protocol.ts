import { z } from 'zod';

/**
 * RED stub for Task 2 (01-07). The protocol implementation lands in the GREEN
 * commit; this exists only so the suite collects and fails on its own
 * assertions rather than on a module-load error. The declared constants are
 * already the real values because they are declarations, not protocol logic.
 */

export const HANDOFF_CHANNEL = 'np_workspace';
export const HANDOFF_SCHEMA_VERSION = 1;
export const HANDOFF_TIMEOUT_MS = 3000;
export const HANDOFF_MAX_RETRIES = 2;
export const HANDOFF_MAX_VALUE_CHARS = 256;
export const HANDOFF_DRAFT_MAX_CHARS = 4000;
export const HANDOFF_TARGET_PAGE = 'standalone.html';

export type HandoffSurface = 'sidepanel' | 'standalone';
export type WorkspaceHandoffErrorCode = 'WORKSPACE_HANDOFF_FAILED' | 'STANDALONE_OPEN_FAILED';
export type HandoffFailure = { ok: false; code: WorkspaceHandoffErrorCode; error: string };
export type HandoffResult = { ok: true } | HandoffFailure;

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

export const phase1HandoffProjectionSchema = z.object({}).strict();

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
  requestId: string;
  conversationId?: string | null;
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

export interface HandoffTransport {
  publish(envelope: HandoffEnvelope): void;
  subscribe(listener: (value: unknown) => void): () => void;
}

export interface HandoffOpenTargetArgs {
  requestId: string;
  workspaceId: string;
  page: string | null;
}

export interface HandoffInitiatorRequest {
  workspaceId: string;
  conversationId: string | null;
  page: string | null;
  composerDraft?: string;
  sourceSurface: HandoffSurface;
  targetSurface: HandoffSurface;
}

export interface HandoffInitiatorDeps {
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

export interface HandoffTargetDeps {
  bootstrap: HandoffBootstrap;
  apply: (projection: Phase1HandoffProjection) => void;
  transport?: HandoffTransport;
}

export interface HandoffTarget {
  start(): void;
  dispose(): void;
  appliedRequestIds(): readonly string[];
}

export function buildHandoffUrl(_input: HandoffUrlInput): string {
  return '';
}

export function parseHandoffUrl(_search: URLSearchParams | string): HandoffUrlParseResult {
  return { ok: false, code: 'malformed_parameter' };
}

export function validateHandoffEnvelope(_value: unknown): HandoffEnvelopeValidation {
  return { ok: false, code: 'invalid_shape' };
}

export function createHandoffInitiator(deps: HandoffInitiatorDeps): HandoffInitiator {
  return {
    requestId: deps.requestId ?? 'stub-request-id',
    async start() {
      return { ok: false, code: 'WORKSPACE_HANDOFF_FAILED', error: 'not implemented' };
    },
    dispose() {},
  };
}

export function createHandoffTarget(_deps: HandoffTargetDeps): HandoffTarget {
  return {
    start() {},
    dispose() {},
    appliedRequestIds: () => [],
  };
}
