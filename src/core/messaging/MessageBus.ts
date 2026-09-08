import type { ResponseEnvelope, RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';

type MessageHandler = (
  msg: RuntimeEnvelope<unknown>,
) => ResponseEnvelope<unknown> | Promise<ResponseEnvelope<unknown>> | void;

export const MessageBus = {
  async send<T>(env: RuntimeEnvelope<T>): Promise<ResponseEnvelope<T>> {
    return (await chrome.runtime.sendMessage(env)) as ResponseEnvelope<T>;
  },
  on(handler: MessageHandler): void {
    chrome.runtime.onMessage.addListener(
      (msg: RuntimeEnvelope<unknown>, _sender, sendResponse) => {
        const result = handler(msg);
        if (result && typeof (result as Promise<ResponseEnvelope<unknown>>).then === 'function') {
          (result as Promise<ResponseEnvelope<unknown>>).then(sendResponse);
          return true;
        }
        if (result !== undefined) {
          sendResponse(result);
          return true;
        }
        return false;
      },
    );
  },
};
