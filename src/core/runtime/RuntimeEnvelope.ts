import { z } from 'zod';
import {
  RuntimeErrorPayload,
  StandaloneClosedPayload,
  StandaloneFocusPayload,
  StandaloneOpenPayload,
  WorkspaceHandoffAckPayload,
  WorkspaceHandoffCommitPayload,
  WorkspaceHandoffPreparePayload,
  WorkspaceMutationPayload,
  WorkspaceRehydrateRequestPayload,
  WorkspaceRehydrateResponsePayload,
  WorkspaceRelinquishPayload,
} from './messageSchemas';
import { OperationIdSchema } from './OperationId';
import { RuntimeSurfaceSchema, RuntimeTargetSchema } from './RuntimeSurface';

const envelopeBaseFields = {
  envelopeVersion: z.literal(1),
  id: OperationIdSchema,
  source: RuntimeSurfaceSchema,
  target: RuntimeTargetSchema,
  timestamp: z.number().int().nonnegative(),
  correlationId: z.string().optional(),
  electionEpoch: z.number().int().nonnegative().optional(),
  workspaceVersion: z.number().int().nonnegative().optional(),
};

export const RuntimeEnvelopeSchema = z.discriminatedUnion('type', [
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.mutation'),
    payload: WorkspaceMutationPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.handoff.prepare'),
    payload: WorkspaceHandoffPreparePayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.handoff.ack'),
    payload: WorkspaceHandoffAckPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.handoff.commit'),
    payload: WorkspaceHandoffCommitPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.relinquish'),
    payload: WorkspaceRelinquishPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.rehydrate.request'),
    payload: WorkspaceRehydrateRequestPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('workspace.rehydrate.response'),
    payload: WorkspaceRehydrateResponsePayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('standalone.open'),
    payload: StandaloneOpenPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('standalone.focus'),
    payload: StandaloneFocusPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('standalone.closed'),
    payload: StandaloneClosedPayload,
  }),
  z.object({
    ...envelopeBaseFields,
    type: z.literal('runtime.error'),
    payload: RuntimeErrorPayload,
  }),
]);

export type RuntimeEnvelope = z.infer<typeof RuntimeEnvelopeSchema>;

export function parseRuntimeEnvelope(input: unknown) {
  return RuntimeEnvelopeSchema.safeParse(input);
}

import { createErrorRecord, debugLog } from '../error/debugLog';
import { MESSAGE_TYPE_ALLOWED_SOURCES, type MessageType } from './MessageType';
import type { RuntimeSurface } from './RuntimeSurface';

export function getAllowedSources(type: MessageType): readonly RuntimeSurface[] {
  return MESSAGE_TYPE_ALLOWED_SOURCES[type] ?? [];
}

export function isSourceAllowed(type: MessageType, source: RuntimeSurface): boolean {
  return getAllowedSources(type).includes(source);
}

export interface SenderIdentity {
  id?: string;
  url?: string;
}

export function isTrustedExtensionSender(
  sender: SenderIdentity | undefined,
  extensionId: string,
): boolean {
  if (!sender?.id || sender.id !== extensionId) return false;
  if (sender.url && !sender.url.startsWith(`chrome-extension://${extensionId}/`)) return false;
  return true;
}

export type InboundValidationResult =
  | { ok: true; envelope: RuntimeEnvelope }
  | { ok: false; code: 'RUNTIME_ENVELOPE_INVALID' | 'RUNTIME_SENDER_REJECTED' };

export function validateInboundEnvelope(
  input: unknown,
  sender: SenderIdentity | undefined,
  extensionId: string,
): InboundValidationResult {
  const parsed = parseRuntimeEnvelope(input);
  if (!parsed.success) {
    debugLog(createErrorRecord('RUNTIME_ENVELOPE_INVALID', { reason: 'schema' }));
    return { ok: false, code: 'RUNTIME_ENVELOPE_INVALID' };
  }
  if (!isTrustedExtensionSender(sender, extensionId)) {
    debugLog(createErrorRecord('RUNTIME_SENDER_REJECTED', { reason: 'identity' }));
    return { ok: false, code: 'RUNTIME_SENDER_REJECTED' };
  }
  if (!isSourceAllowed(parsed.data.type, parsed.data.source)) {
    // An unregistered type (empty allowed list) or a disallowed source is rejected here.
    debugLog(createErrorRecord('RUNTIME_SENDER_REJECTED', { reason: 'source' }));
    return { ok: false, code: 'RUNTIME_SENDER_REJECTED' };
  }
  return { ok: true, envelope: parsed.data };
}
