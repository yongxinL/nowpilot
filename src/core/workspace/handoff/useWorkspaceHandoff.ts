import {
  createHandoffInitiator,
  createHandoffTarget,
  handoffTransport,
  type HandoffBootstrap,
  type HandoffResult,
  type HandoffSurface,
  type HandoffTransport,
  type Phase1HandoffProjection,
} from './protocol';

/**
 * The surface-independent handoff controllers (D-13, D-06 applied to the
 * handoff).
 *
 * Neither controller calls a Chrome API: the navigation path arrives as the
 * source controller's `openTarget` adapter and the lifecycle path as the target
 * controller's `apply` adapter, so the same module serves the Side Panel, the
 * Standalone surface and a test harness. Both unsubscribe on `dispose()` —
 * which the surface calls on unmount — and both key every decision on the
 * request id so a stale or foreign message can never be applied.
 */

export interface WorkspaceHandoffOpenTargetArgs {
  requestId: string;
  workspaceId: string;
  page: string | null;
}

export interface WorkspaceHandoffSourceDeps {
  /** The navigation adapter — must resolve once the target surface exists. */
  openTarget: (args: WorkspaceHandoffOpenTargetArgs) => Promise<void>;
  sourceSurface?: HandoffSurface;
  targetSurface?: HandoffSurface;
  transport?: HandoffTransport;
  requestId?: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export interface WorkspaceHandoffSourceRequest {
  workspaceId: string;
  conversationId: string | null;
  page: string | null;
  composerDraft?: string;
}

export interface WorkspaceHandoffSource {
  readonly requestId: string;
  /** Resolves success only after a validated acknowledgement. */
  start(request: WorkspaceHandoffSourceRequest): Promise<HandoffResult>;
  /** Unsubscribes the transport and settles any in-flight wait as a failure. */
  dispose(): void;
}

export function createWorkspaceHandoffSource(deps: WorkspaceHandoffSourceDeps): WorkspaceHandoffSource {
  const sourceSurface = deps.sourceSurface ?? 'sidepanel';
  const targetSurface = deps.targetSurface ?? 'standalone';

  const initiator = createHandoffInitiator({
    openTarget: deps.openTarget,
    transport: deps.transport ?? handoffTransport,
    requestId: deps.requestId,
    timeoutMs: deps.timeoutMs,
    maxRetries: deps.maxRetries,
  });

  return {
    requestId: initiator.requestId,
    start: (request) =>
      initiator.start({
        workspaceId: request.workspaceId,
        conversationId: request.conversationId,
        page: request.page,
        composerDraft: request.composerDraft,
        sourceSurface,
        targetSurface,
      }),
    dispose: () => initiator.dispose(),
  };
}

export interface WorkspaceHandoffTargetDeps {
  /** The validated URL bootstrap — the target's own identity. */
  bootstrap: HandoffBootstrap;
  /** The apply adapter — called at most once per request id. */
  apply: (projection: Phase1HandoffProjection) => void;
  transport?: HandoffTransport;
}

export interface WorkspaceHandoffTarget {
  /** Publishes readiness and starts validating inbound transfers. */
  start(): void;
  /** Unsubscribes on unmount. */
  dispose(): void;
  appliedRequestIds(): readonly string[];
}

export function createWorkspaceHandoffTarget(deps: WorkspaceHandoffTargetDeps): WorkspaceHandoffTarget {
  const target = createHandoffTarget({
    bootstrap: deps.bootstrap,
    apply: deps.apply,
    transport: deps.transport ?? handoffTransport,
  });

  return {
    start: () => target.start(),
    dispose: () => target.dispose(),
    appliedRequestIds: () => target.appliedRequestIds(),
  };
}
