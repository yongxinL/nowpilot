// tests/core/content/PageContextBridge.test.ts — the extraction request/reply
// contract (04a-07, Pitfall 5): requestExtraction publishes EXTRACT_PAGE_CONTENT
// {tabId, mode} and resolves on the matching PAGE_CONTENT_EXTRACTED reply (opId
// correlation — the getCapabilities L57-58 precedent), rejects TYPED on timeout
// (code === ERROR_CODES.CONTENT_EXTRACT_FAILED — D-4a-03/19/22, never an
// unhandled rejection), and ignores id-mismatched replies. fakeBrowser +
// flushRuntime pattern (ContentScriptHost.test.ts L27-30 precedent) — both
// bridge ends share the fakeBrowser runtime channel.
import { describe, expect, it } from 'vitest';
import { PageContextBridge, type ExtractionPayload } from '@/core/content/PageContextBridge';
import { MessageType } from '@/core/runtime/MessageType';
import { ERROR_CODES } from '@/core/error/errorCodes';

/** Flush the fakeBrowser runtime promise chain (async trigger). */
async function flushRuntime(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

const PAYLOAD: ExtractionPayload = {
  html: '<html><head></head><body><article><h1>Bridge</h1></article></body></html>',
  baseUrl: 'https://example.com/readme',
  truncated: false,
};

describe('PageContextBridge requestExtraction (04a-07)', () => {
  it('roundtrips: publishes EXTRACT_PAGE_CONTENT and resolves on the matching reply', async () => {
    const requester = new PageContextBridge();
    const replier = new PageContextBridge();

    // The content side replies to the inbound EXTRACT_PAGE_CONTENT request.
    let requestEnvelopeId: string | undefined;
    replier.onMessage((message) => {
      if (message.type !== MessageType.EXTRACT_PAGE_CONTENT) return;
      requestEnvelopeId = message.id;
      replier.replyExtracted(message.id, PAYLOAD);
    });

    const promise = requester.requestExtraction(42, 'default');
    await flushRuntime();

    await expect(promise).resolves.toEqual(PAYLOAD);
    expect(requestEnvelopeId).toBeTypeOf('string');
  });

  it('rejects with a typed CONTENT_EXTRACT_FAILED carrier on timeout (D-4a-03/19)', async () => {
    const requester = new PageContextBridge();
    // No replier — the bounded wait expires and rejects TYPED with the
    // canonical D-4a-22 code, never the non-canonical string, never an
    // unhandled rejection.
    const reason = await requester.requestExtraction(42, 'default', { timeoutMs: 5 }).then(
      () => {
        throw new Error('expected the extraction request to reject on timeout');
      },
      (err: unknown) => err,
    );
    expect(reason).toBeInstanceOf(Error);
    expect((reason as { code?: string }).code).toBe(ERROR_CODES.CONTENT_EXTRACT_FAILED);
  });

  it('ignores an id-mismatched PAGE_CONTENT_EXTRACTED reply (opId correlation)', async () => {
    const requester = new PageContextBridge();
    const replier = new PageContextBridge();

    let requestId: string | undefined;
    replier.onMessage((message) => {
      if (message.type !== MessageType.EXTRACT_PAGE_CONTENT) return;
      requestId = message.id;
      // A forged/stale reply carrying a DIFFERENT opId must be ignored.
      replier.replyExtracted('stale-op-id', PAYLOAD);
    });

    const promise = requester.requestExtraction(7, 'default', { timeoutMs: 250 });
    await flushRuntime();
    expect(requestId).toBeTypeOf('string');

    // After the mismatched reply has been delivered, the pending promise must
    // still be pending — it only settles on the matching opId.
    let settled = false;
    promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await flushRuntime();
    expect(settled).toBe(false);

    // The matching reply settles it.
    replier.replyExtracted(requestId!, PAYLOAD);
    await expect(promise).resolves.toEqual(PAYLOAD);
  });
});
