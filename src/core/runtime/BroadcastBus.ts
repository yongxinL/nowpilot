import type { MessageType } from './MessageType';
import {
  validateInboundEnvelope,
  type RuntimeEnvelope,
  type SenderIdentity,
} from './RuntimeEnvelope';

export type RawMessageListener = (message: unknown, sender: unknown) => void;

export interface BroadcastBusDependencies {
  extensionId: string;
  sendMessage(message: RuntimeEnvelope): Promise<unknown>;
  addMessageListener(listener: RawMessageListener): void;
  removeMessageListener(listener: RawMessageListener): void;
}

export type EnvelopeHandler = (envelope: RuntimeEnvelope, sender: unknown) => void;

export interface BroadcastBus {
  send(envelope: RuntimeEnvelope): Promise<void>;
  on(type: MessageType, handler: EnvelopeHandler): () => void;
}

export function createBroadcastBus(deps: BroadcastBusDependencies): BroadcastBus {
  const handlersByType = new Map<MessageType, Set<EnvelopeHandler>>();
  let rawListener: RawMessageListener | undefined;

  function ensureListener(): RawMessageListener {
    if (!rawListener) {
      rawListener = (message, sender) => {
        const validated = validateInboundEnvelope(
          message,
          sender as SenderIdentity,
          deps.extensionId,
        );
        if (!validated.ok) return;
        const handlers = handlersByType.get(validated.envelope.type);
        if (!handlers) return;
        for (const handler of handlers) handler(validated.envelope, sender);
      };
      deps.addMessageListener(rawListener);
    }
    return rawListener;
  }

  return {
    async send(envelope) {
      await deps.sendMessage(envelope);
    },
    on(type, handler) {
      ensureListener();
      const handlers = handlersByType.get(type) ?? new Set<EnvelopeHandler>();
      handlers.add(handler);
      handlersByType.set(type, handlers);
      return () => {
        const current = handlersByType.get(type);
        current?.delete(handler);
        if (current && current.size === 0) handlersByType.delete(type);
        if (handlersByType.size === 0 && rawListener) {
          deps.removeMessageListener(rawListener);
          rawListener = undefined;
        }
      };
    },
  };
}
