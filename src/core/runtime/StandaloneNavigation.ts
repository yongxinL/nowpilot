import { StandaloneRouteIdSchema, type StandaloneRouteId } from '../registry/standaloneRoutes';
import type { BroadcastBus } from './BroadcastBus';
import { createOperationId } from './OperationId';
import type { RuntimeEnvelope } from './RuntimeEnvelope';
import type { WorkspaceWriterSurface } from './RuntimeSurface';

export interface StandaloneNavigationOpenRequest {
  kind: 'open';
  destination: StandaloneRouteId;
}

export interface StandaloneNavigationFocusRequest {
  kind: 'focus';
  destination: StandaloneRouteId;
}

export type StandaloneNavigationRequest =
  StandaloneNavigationOpenRequest | StandaloneNavigationFocusRequest;

function createNavigationEnvelope(
  type: 'standalone.open' | 'standalone.focus',
  destination: StandaloneRouteId,
  source: WorkspaceWriterSurface | 'background',
): RuntimeEnvelope {
  const parsedDestination = StandaloneRouteIdSchema.parse(destination);
  return {
    envelopeVersion: 1,
    id: createOperationId(),
    type,
    source,
    target: type === 'standalone.open' ? 'background' : 'standalone',
    timestamp: Date.now(),
    payload: { destination: parsedDestination },
  };
}

export function createStandaloneOpenEnvelope(
  destination: StandaloneRouteId,
  source: WorkspaceWriterSurface,
): RuntimeEnvelope {
  return createNavigationEnvelope('standalone.open', destination, source);
}

export function createStandaloneFocusEnvelope(
  destination: StandaloneRouteId,
  source: WorkspaceWriterSurface | 'background',
): RuntimeEnvelope {
  return createNavigationEnvelope('standalone.focus', destination, source);
}

export function readStandaloneNavigationRequest(
  envelope: RuntimeEnvelope,
): StandaloneNavigationRequest | undefined {
  if (envelope.type === 'standalone.open') {
    return { kind: 'open', destination: envelope.payload.destination };
  }
  if (envelope.type === 'standalone.focus') {
    return { kind: 'focus', destination: envelope.payload.destination };
  }
  return undefined;
}

export async function openStandalone(
  destination: StandaloneRouteId,
  surface: WorkspaceWriterSurface,
  bus: Pick<BroadcastBus, 'send'>,
): Promise<void> {
  await bus.send(createStandaloneOpenEnvelope(destination, surface));
}

export async function focusStandalone(
  destination: StandaloneRouteId,
  surface: WorkspaceWriterSurface | 'background',
  bus: Pick<BroadcastBus, 'send'>,
): Promise<void> {
  await bus.send(createStandaloneFocusEnvelope(destination, surface));
}
