// ContentScriptHost tests — serializer proof (06-04, Task 3).
//
// Four behavior groups from Task 2's block: (1) §26.6 pre-strip — script/
// style/noscript/svg/cross-origin iframe markup removed + form action stripped
// while text/headings/links/inputs (and same-origin iframes, D-85 wording)
// are kept; (2) the effective base URL stamp (document.baseURI); (3)
// element-boundary truncation under a parameterized budget with truncated:true
// — never a mid-element cut; (4) the PAGE_HTML_PAYLOAD envelope producer
// shape (D-84). Test-local chrome.runtime mock — setup.ts is NOT edited.
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { serializePage, sendHtmlPayload } from '@/core/content/ContentScriptHost';
import type { RuntimeEnvelope } from '@/core/runtime/RuntimeEnvelope';
import type { PageHtmlPayload } from '@/core/runtime/RuntimeEnvelope';

// Test-local chrome.runtime mock (the shells are the only consumers of
// chrome.runtime in these tests — do NOT edit tests/setup.ts).
const sendMessageSpy = vi.fn((_envelope: unknown) => Promise.resolve());
if (!(globalThis as any).chrome.runtime) {
  (globalThis as any).chrome.runtime = {};
}
(globalThis as any).chrome.runtime.sendMessage = sendMessageSpy;

describe('ContentScriptHost', () => {
  beforeEach(() => {
    sendMessageSpy.mockClear();
    document.head.innerHTML = '';
    document.body.innerHTML = '';
  });

  it('(1) pre-strips script/style/noscript/svg/cross-origin iframe + form action; keeps text/headings/links/inputs', () => {
    const ORIGIN = window.location.origin;
    document.body.innerHTML = `
      <script>const x = 1;</script>
      <style>.hidden { display: none; }</style>
      <noscript>No JS</noscript>
      <svg><circle r="5"></circle></svg>
      <iframe src="https://evil.example/x"></iframe>
      <iframe src="${ORIGIN}/same"></iframe>
      <form action="/submit" method="post">
        <h1>Heading kept</h1>
        <p>Paragraph kept.</p>
        <a href="/kb/1">Link kept</a>
        <input type="text" name="q" value="query">
      </form>
    `;

    const payload = serializePage();

    // Strip list removed.
    expect(payload.html).not.toContain('<script');
    expect(payload.html).not.toContain('<style');
    expect(payload.html).not.toContain('noscript');
    expect(payload.html).not.toContain('<svg');
    expect(payload.html).not.toContain('evil.example');
    expect(payload.html).not.toContain('action="/submit"');
    // Keep list retained.
    expect(payload.html).toContain('Heading kept');
    expect(payload.html).toContain('Paragraph kept.');
    expect(payload.html).toContain('Link kept');
    expect(payload.html).toContain('type="text"');
    // Same-origin iframe markup is kept (D-85 wording — cross-origin only).
    expect(payload.html).toContain('iframe');
  });

  it('(2) stamps the effective base URL — payload.baseUrl equals document.baseURI', () => {
    document.head.innerHTML = '<base href="https://support.servicenow.com/kb/">';
    document.body.innerHTML = '<p>content</p>';

    const payload = serializePage();

    expect(payload.baseUrl).toBe('https://support.servicenow.com/kb/');
    expect(payload.baseUrl).toBe(document.baseURI);
  });

  it('(3) truncates at an element boundary under a parameterized budget and sets truncated:true — never mid-element', () => {
    document.body.innerHTML = '<p>alpha</p><p>beta</p><p>gamma</p>';
    const budget = '<head></head>'.length + '<p>alpha</p>'.length + '<p>beta</p>'.length;

    const payload = serializePage(budget);

    expect(payload.truncated).toBe(true);
    expect(payload.html.length).toBeLessThanOrEqual(budget);
    // Complete elements up to the boundary are retained; the overflowing leaf
    // (and everything after) is dropped — never a mid-element cut.
    expect(payload.html).toContain('<p>alpha</p>');
    expect(payload.html).toContain('<p>beta</p>');
    expect(payload.html).not.toContain('gamma');
    // The truncated output parses without a lossy mid-element repair.
    const parsed = new DOMParser().parseFromString(payload.html, 'text/html');
    expect(parsed.querySelector('parsererror')).toBeNull();
  });

  it('(4) sendHtmlPayload sends a PAGE_HTML_PAYLOAD envelope with the frozen PageHtmlPayload shape', () => {
    document.body.innerHTML = '<p>envelope</p>';

    sendHtmlPayload();

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);
    const envelope = sendMessageSpy.mock.calls[0][0] as RuntimeEnvelope;
    expect(envelope.type).toBe('PAGE_HTML_PAYLOAD');
    expect(envelope.source).toBe('content');
    const payload = envelope.payload as PageHtmlPayload;
    expect(typeof payload.html).toBe('string');
    expect(typeof payload.baseUrl).toBe('string');
    expect(typeof payload.truncated).toBe('boolean');
  });
});