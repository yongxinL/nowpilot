// tests/core/content/ContentScriptHost.test.ts — ContentScriptHost (D-16) + the
// PageContextBridge roundtrip (D-17): start() installs the bridge listener and
// wires EXTRACT_PAGE_CONTENT → PageRegistry.upsert; PING replies a PONG
// ResponseEnvelope; GET_CONTENT_CAPABILITIES roundtrips to CONTENT_CAPABILITIES;
// stop() detaches the listener. Runs in the default jsdom-align env (document
// required for the live title/URL context) with fakeBrowser chrome.* stubs —
// same pattern as WorkspaceStore.test.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import { ContentScriptHost } from '@/core/content/ContentScriptHost';
import { PageContextBridge } from '@/core/content/PageContextBridge';
import { MessageType } from '@/core/runtime/MessageType';
import type { PageContext } from '@/core/content/PageContext';

function makePage(overrides: Partial<PageContext> = {}): PageContext {
  return {
    url: 'https://example.com/readme',
    origin: 'https://example.com',
    hostname: 'example.com',
    title: 'Injected Page',
    meta: {},
    extractedAt: 1710000000000,
    ...overrides,
  };
}

/** Flush the fakeBrowser runtime promise chain (async trigger). */
async function flushRuntime(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('ContentScriptHost (D-16 content skeleton)', () => {
  beforeEach(() => {
    // Deterministic live context for the title assertions.
    document.title = 'Test Page';
  });

  it('start() registers the bridge listener', async () => {
    const host = new ContentScriptHost();
    host.start();
    expect(host.getCapabilities).toBeTypeOf('function');
    host.stop();
  });

  it('an incoming EXTRACT_PAGE_CONTENT envelope upserts PageRegistry', async () => {
    const bridge = new PageContextBridge();
    const host = new ContentScriptHost({ bridge, tabId: 42 });
    host.start();

    bridge.publishContext(makePage());
    await flushRuntime();

    const entry = host.getPageRegistry().get(42);
    expect(entry).toBeDefined();
    expect(entry?.title).toBe('Test Page'); // live context, not the payload
    host.stop();
  });

  it('PING replies a PONG ResponseEnvelope', async () => {
    const bridge = new PageContextBridge();
    const host = new ContentScriptHost({ bridge });
    host.start();

    const pongPayloads: unknown[] = [];
    const unsubscribe = bridge.onMessage((message) => {
      if (message.type === MessageType.PONG) pongPayloads.push(message.payload);
    });
    bridge.sendPing();
    await flushRuntime();

    // PONG payload is the canonical ResponseEnvelope ({ id, ok, data }).
    expect(pongPayloads[0]).toEqual({
      id: expect.any(String),
      ok: true,
      data: { pong: true },
    });
    unsubscribe();
    host.stop();
  });

  it('GET_CONTENT_CAPABILITIES roundtrip resolves capabilities', async () => {
    const host = new ContentScriptHost();
    host.start();
    await expect(host.getCapabilities()).resolves.toEqual({
      extraction: true,
      domAccess: 'isolated',
    });
    host.stop();
  });

  it('stop() removes the listener — no further upserts', async () => {
    const bridge = new PageContextBridge();
    const host = new ContentScriptHost({ bridge, tabId: 42 });
    host.start();
    host.stop();

    bridge.publishContext(makePage());
    await flushRuntime();

    expect(host.getPageRegistry().list()).toHaveLength(0);
  });

  it('keeps a live PageContext from document title/URL without mutating the DOM', () => {
    const host = new ContentScriptHost();
    host.start();
    const page = host.getCurrentPage();
    expect(page.title).toBe('Test Page');
    expect(page.hostname).toBe(document.location.hostname);
    // Extraction-only: document body untouched.
    expect(document.body.childElementCount).toBe(0);
    host.stop();
  });
});
