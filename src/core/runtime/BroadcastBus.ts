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
  const listeners = new Map<RawMessageListener, Map<MessageType, Set<EnvelopeHandler>>>();

  function dispatch(message: unknown, sender: unknown): void {
    const validated = validateInboundEnvelope(message, sender as SenderIdentity, deps.extensionId);
    if (!validated.ok) return;
    for (const byType of listeners.values()) {
      const handlers = byType.get(validated.envelope.type);
      if (!handlers) continue;
      for (const handler of handlers) handler(validated.envelope, sender);
    }
  }

  return {
    async send(envelope) {
      await deps.sendMessage(envelope);
    },
    on(type, handler) {
      let raw = [...listeners.keys()].find((candidate) => listeners.get(candidate)?.has(type));
      if (!raw) {
        raw = (message, sender) => dispatch(message, sender);
        listeners.set(raw, new Map());
        deps.addMessageListener(raw);
      }
      const byType = listeners.get(raw)!;
      const handlers = byType.get(type) ?? new Set<EnvelopeHandler>();
      handlers.add(handler);
      byType.set(type, handlers);
      return () => {
        const current = listeners.get(raw!);
        current?.get(type)?.delete(handler);
        if (current && [...current.values()].every((set) => set.size === 0)) {
          deps.removeMessageListener(raw!);
          listeners.delete(raw!);
        }
      };
    },
  };
}
