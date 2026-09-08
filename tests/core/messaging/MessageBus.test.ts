import { describe, expect, it, type Mock, vi } from 'vitest';
import { MessageType } from '@/core/runtime/MessageType';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import { MessageBus } from '@/core/messaging/MessageBus';

describe('MessageBus', () => {
  it('sends an envelope and receives a response', async () => {
    const sendMessage = chrome.runtime.sendMessage as unknown as Mock;
    sendMessage.mockResolvedValue({ id: 'x', ok: true, data: 'ok' });
    const env: RuntimeEnvelope<unknown> = {
      id: 'x',
      type: MessageType.KEEPALIVE_PING,
      createdAt: 1,
      source: 'sidepanel',
      payload: {},
    };
    const resp = await MessageBus.send(env);
    expect(resp.ok).toBe(true);
  });

  it('registers an onMessage listener', () => {
    const handler = vi.fn();
    MessageBus.on(handler);
    expect(chrome.runtime.onMessage.hasListeners()).toBe(true);
  });
});
