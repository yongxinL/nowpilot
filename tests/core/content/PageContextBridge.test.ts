// PageContextBridge tests — bridge proof (06-04, Task 3).
//
// Five behavior groups: (1) EXTRACT_PAGE_CONTENT mode 'default' → the handler
// responds { ok:true, payload } with the frozen PageHtmlPayload shape; (2)
// mode 'actionable' → { ok:true, raw } with a RawNode tree produced by walkDom
// on the live document (password values absent — D-86); (3) non-extraction
// messages are ignored (pass through, no response, no crash); (4) on
// navigation the bridge sends PAGE_LIVE_CONTEXT { url, title, meta } (D-89)
// + SPA_NAVIGATION (the 06-03 invalidation feed); (5) the entry shell
// delegates to the content shells and no longer registers the dead
// document-level listener, while CONTENT_SCRIPT_READY is still sent.
//
// Test-local chrome.runtime mocks (listener capture + sendMessage spy) — do
// NOT edit tests/setup.ts again.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { initBridge } from '@/core/content/PageContextBridge';
import type { RawNode } from '@/core/content/AxDomWalker';
import { createEnvelope } from '@/core/runtime/RuntimeEnvelope';
import type { ContentScriptContextLike } from '@/core/content/SPANavigationWatcher';

type OnMessageListener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void,
) => unknown;

const runtimeListeners = new Set<OnMessageListener>();
const sendMessageSpy = vi.fn((_envelope: unknown) => Promise.resolve());
if (!(globalThis as any).chrome.runtime) {
  (globalThis as any).chrome.runtime = {};
}
(globalThis as any).chrome.runtime.onMessage = {
  addListener: (listener: OnMessageListener) => {
    runtimeListeners.add(listener);
  },
  removeListener: (listener: OnMessageListener) => {
    runtimeListeners.delete(listener);
  },
};
(globalThis as any).chrome.runtime.sendMessage = sendMessageSpy;

/** Fire the captured onMessage listeners; returns the sendResponse payload
 * when a listener responded (responds are synchronous in the bridge). */
function fireOnMessage(message: unknown, sender: unknown = {}): unknown {
  let response: unknown;
  const sendResponse = (r?: unknown) => {
    response = r;
  };
  for (const listener of runtimeListeners) {
    listener(message, sender, sendResponse);
  }
  return response;
}

/** Stub WXT context capturing addEventListener registrations. */
function makeStubCtx(): { ctx: ContentScriptContextLike; handlers: Map<string, (e: unknown) => void> } {
  const handlers = new Map<string, (e: unknown) => void>();
  const ctx: ContentScriptContextLike = {
    addEventListener: vi.fn((_target: Window, type: string, handler: (e: unknown) => void) => {
      handlers.set(type, handler);
    }),
  };
  return { ctx, handlers };
}

/** Depth-first collect of every node in a RawNode tree. */
function collect(node: RawNode): RawNode[] {
  return [node, ...(node.children ?? []).flatMap(collect)];
}

describe('PageContextBridge', () => {
  beforeEach(() => {
    runtimeListeners.clear();
    sendMessageSpy.mockClear();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('(1) handles EXTRACT_PAGE_CONTENT mode "default" — responds { ok:true, payload } with the PageHtmlPayload shape', () => {
    document.body.innerHTML = '<p>bridge default</p>';
    const { ctx } = makeStubCtx();
    const cleanup = initBridge(ctx, { onNavigate: () => {} });

    const envelope = createEnvelope(
      'EXTRACT_PAGE_CONTENT',
      { tabId: 1, url: 'https://x.example/', mode: 'default' },
      'sidepanel',
    );
    const response = fireOnMessage(envelope, { tab: { id: 1 } }) as { ok: true; payload?: { html: string; baseUrl: string; truncated: boolean } };

    expect(response.ok).toBe(true);
    expect(response.payload?.html).toContain('<p>bridge default</p>');
    expect(typeof response.payload?.baseUrl).toBe('string');
    expect(typeof response.payload?.truncated).toBe('boolean');

    cleanup();
  });

  it('(2) handles mode "actionable" — responds { ok:true, raw } with a RawNode tree from walkDom; password values absent (D-86)', () => {
    document.body.innerHTML = `
      <h2>Actionable section</h2>
      <input type="password" name="user_password" value="hunter2">
      <button type="button">Apply</button>
    `;
    const { ctx } = makeStubCtx();
    const cleanup = initBridge(ctx, { onNavigate: () => {} });

    const envelope = createEnvelope(
      'EXTRACT_PAGE_CONTENT',
      { tabId: 2, url: 'https://x.example/', mode: 'actionable' },
      'sidepanel',
    );
    const response = fireOnMessage(envelope, {}) as { ok: true; raw?: RawNode };

    expect(response.ok).toBe(true);
    expect(response.raw?.role).toBe('region');
    // walkDom walked the live document — the password control is present but
    // its value key is never emitted (D-86/D-90).
    const controlNode = collect(response.raw!).find((n) => n.form?.control?.isPassword === true);
    expect(controlNode?.form?.control?.fieldName).toBe('user_password');
    expect('value' in (controlNode?.form?.control ?? {})).toBe(false);

    cleanup();
  });

  it('(3) ignores non-extraction messages — no response, no crash', () => {
    const { ctx } = makeStubCtx();
    const cleanup = initBridge(ctx, { onNavigate: () => {} });

    const envelope = createEnvelope('CONTENT_SCRIPT_READY', { url: 'https://x.example/' }, 'content');
    expect(() => fireOnMessage(envelope, {})).not.toThrow();
    expect(fireOnMessage(envelope, {})).toBeUndefined();

    cleanup();
  });

  it('(4) on navigation the bridge sends PAGE_LIVE_CONTEXT { url, title, meta } (D-89) + SPA_NAVIGATION', () => {
    document.title = 'Bridge Navigation Title';
    const { ctx, handlers } = makeStubCtx();
    const onNavigate = vi.fn();
    const cleanup = initBridge(ctx, { onNavigate });

    const navHandler = handlers.get('wxt:locationchange')!;
    expect(navHandler).toBeDefined();
    const newUrl = new URL('https://support.servicenow.com/kb/456');
    const oldUrl = new URL('https://support.servicenow.com/kb/');
    navHandler({ newUrl, oldUrl });

    expect(onNavigate).toHaveBeenCalledWith(newUrl.href, oldUrl.href);
    const calls = sendMessageSpy.mock.calls.map(([envelope]) => (envelope as unknown) as { type: string; payload: unknown });

    const live = calls.find((e) => e.type === 'PAGE_LIVE_CONTEXT');
    expect(live).toBeDefined();
    expect(live!.payload).toEqual({ url: newUrl.href, title: 'Bridge Navigation Title', meta: {} });

    const spa = calls.find((e) => e.type === 'SPA_NAVIGATION');
    expect(spa).toBeDefined();
    expect(spa!.payload).toEqual({ url: newUrl.href });

    cleanup();
  });

  it('(5) entry shell delegates to the content shells; dead document-level listener removed; CONTENT_SCRIPT_READY still sent', () => {
    const source = readFileSync(resolve(process.cwd(), 'entrypoints/content/core.content.ts'), 'utf8');

    expect(source).toContain('startWatcher(ctx');
    expect(source).toContain('initBridge(ctx');
    expect(source).not.toContain("document.addEventListener('wxt:locationchange'");
    expect(source).toContain('CONTENT_SCRIPT_READY');
  });
});