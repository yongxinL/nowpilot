// tests/core/content/ContentScriptHost.test.ts — ContentScriptHost (D-16) + the
// PageContextBridge roundtrip (D-17): start() installs the bridge listener and
// wires EXTRACT_PAGE_CONTENT → PageRegistry.upsert; PING replies a PONG
// ResponseEnvelope; GET_CONTENT_CAPABILITIES roundtrips to CONTENT_CAPABILITIES;
// stop() detaches the listener. 04a-07 adds the extraction reply path (D-4a-07/
// 08/09/12): mode 'default' → serialized pre-stripped HTML with baseUrl +
// truncated flag; mode 'actionable' → the walked RawNode tree with password
// values omitted (D-4a-20); plus the SPANavigationWatcher wiring (D-4a-01 —
// nav rebuilds the live context, upserts the registry, publishes the
// lightweight live-context update). Runs in the default jsdom-align env
// (document required for the live title/URL context) with fakeBrowser chrome.*
// stubs — same pattern as WorkspaceStore.test.ts.
import { beforeEach, describe, expect, it } from 'vitest';
import { ContentScriptHost, PAGE_HTML_MAX_BYTES } from '@/core/content/ContentScriptHost';
import { PageContextBridge, type ExtractionPayload } from '@/core/content/PageContextBridge';
import { MessageType } from '@/core/runtime/MessageType';
import type { PageContext } from '@/core/content/PageContext';
import type { RawNode } from '@/core/extraction/apcLite.types';
import { FIXED_EXTENSION_ID } from '../../fixtures';

const ENTRYPOINT = 'core';
const NAMESPACED_EVENT = `${FIXED_EXTENSION_ID}:${ENTRYPOINT}:wxt:locationchange`;

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

  it('EXTRACT_PAGE_CONTENT (default) replies serialized HTML minus the strip set (D-4a-07)', async () => {
    document.body.innerHTML = `
      <article>
        <h1>Article Title</h1>
        <p>Body prose with <a href="/relative">a link</a>.</p>
        <input type="text" name="search" value="query">
        <form action="/submit" formaction="/other"><input type="submit"></form>
      </article>
      <script>window.__secret = 42;</script>
      <style>.secret-css { color: red; }</style>
      <noscript>fallback</noscript>
      <svg><circle r="1"></circle></svg>
    `;
    const bridge = new PageContextBridge();
    const host = new ContentScriptHost({ bridge, tabId: 42 });
    host.start();

    const data = await bridge.requestExtraction(42, 'default', { timeoutMs: 2000 });
    expect(data).toMatchObject({ baseUrl: document.baseURI, truncated: false });
    const payload = data as ExtractionPayload;

    // Kept: article markup, headings, links, inputs (incl. outside forms).
    expect(payload.html).toContain('<article');
    expect(payload.html).toContain('Article Title');
    expect(payload.html).toContain('<a href="/relative"');
    expect(payload.html).toContain('type="text"');
    // Strip set (D-4a-07): script/style/noscript/svg markup removed.
    expect(payload.html).not.toContain('__secret');
    expect(payload.html).not.toContain('secret-css');
    expect(payload.html).not.toContain('<svg');
    expect(payload.html).not.toContain('fallback');
    // form-action attribute removed; inputs kept (D-4a-07).
    expect(payload.html).not.toContain('formaction');
    host.stop();
  });

  it('truncates an oversized serialized doc at an element boundary (D-4a-09)', async () => {
    const unit = '<p>lorem ipsum dolor sit amet consectetur adipiscing elit sed do</p>';
    document.body.innerHTML = `<div id="bulk">${unit.repeat(60000)}</div>`;
    const bridge = new PageContextBridge();
    const host = new ContentScriptHost({ bridge, tabId: 7 });
    host.start();

    const full = document.documentElement.outerHTML;
    const data = await bridge.requestExtraction(7, 'default', { timeoutMs: 2000 });
    const payload = data as ExtractionPayload;

    expect(payload.truncated).toBe(true);
    expect(payload.html.length).toBeLessThanOrEqual(PAGE_HTML_MAX_BYTES);
    // The truncation cut at a COMPLETE tag boundary: the payload is a clean
    // prefix of the full serialization ending at a closing tag — no mid-tag
    // split, no dangling unclosed tag.
    expect(full.startsWith(payload.html)).toBe(true);
    expect(payload.html.endsWith('</p>')).toBe(true);
    host.stop();
  }, 30000);

  it('mode actionable replies with the walked RawNode tree minus password values (D-4a-12/20)', async () => {
    document.body.innerHTML = `
      <h1>Struct</h1>
      <a href="/target" rel="nofollow">Go</a>
      <form>
        <input type="text" name="user" value="alice">
        <input type="password" name="pw" value="s3cret">
      </form>
    `;
    const bridge = new PageContextBridge();
    const host = new ContentScriptHost({ bridge, tabId: 3 });
    host.start();

    const data = await bridge.requestExtraction<RawNode[]>(3, 'actionable', { timeoutMs: 2000 });
    expect(Array.isArray(data)).toBe(true);
    const nodes = data;
    // The walked tree is present (heading/link captured).
    expect(JSON.stringify(nodes)).toContain('Struct');
    expect(JSON.stringify(nodes)).toContain('/target');
    // Password value NEVER enters the payload (D-4a-20 — omitted at capture).
    expect(JSON.stringify(nodes)).not.toContain('s3cret');
    const passwordControl = findFormControl(nodes, 'pw');
    expect(passwordControl?.isPassword).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(passwordControl, 'value')).toBe(false);
    // Non-password controls keep their value.
    expect(findFormControl(nodes, 'user')?.value).toBe('alice');
    host.stop();
  });

  it('SPA-nav watcher callback rebuilds the live context + upserts the registry (D-4a-01)', async () => {
    const bridge = new PageContextBridge();
    const host = new ContentScriptHost({
      bridge,
      tabId: 42,
      watcherDeps: windowDeps(),
      watcherEventName: NAMESPACED_EVENT,
    });
    host.start();

    document.title = 'Page One';
    expect(host.getPageRegistry().get(42)).toBeUndefined();

    // The lightweight live-context update is published on nav (mark-stale).
    let published: { page?: PageContext } | undefined;
    bridge.onMessage((message) => {
      if (message.type === MessageType.EXTRACT_PAGE_CONTENT) {
        published = message.payload as { page?: PageContext };
      }
    });

    document.title = 'Page Two (post-nav)';
    dispatchLocationChange('https://example.com/post-nav');
    await flushRuntime();

    const entry = host.getPageRegistry().get(42);
    expect(entry).toBeDefined();
    expect(entry?.title).toBe('Page Two (post-nav)');
    expect(published?.page?.title).toBe('Page Two (post-nav)');
    host.stop();
  });
});

/** Deep-search the RawNode forest for a form control by fieldName. */
function findFormControl(
  nodes: RawNode[],
  fieldName: string,
): NonNullable<RawNode['form']>['control'] | undefined {
  for (const node of nodes) {
    if (node.form?.control?.fieldName === fieldName) return node.form.control;
    if (node.children) {
      const found = findFormControl(node.children, fieldName);
      if (found) return found;
    }
  }
  return undefined;
}

/** Plain-window deps — registers on the resolved namespaced event name. */
function windowDeps() {
  return {
    addEventListener: (target: Window, name: string, handler: (e: Event) => void) => {
      target.addEventListener(name, handler);
    },
    removeEventListener: (target: Window, name: string, handler: (e: Event) => void) => {
      target.removeEventListener(name, handler);
    },
  };
}

/** Dispatch a wxt-shaped locationchange event on the NAMESPACED name. */
function dispatchLocationChange(newUrl: string): void {
  const event = new Event(NAMESPACED_EVENT) as Event & { newUrl: string };
  event.newUrl = newUrl;
  window.dispatchEvent(event);
}
