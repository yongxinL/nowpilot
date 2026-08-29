// PageContentService tests — §18 required test.
//
// Proves the panel-side round-trip end-to-end (D-82): fixture HTML + stamped
// baseUrl → extract() → canonical PageContext (url/origin/hostname/title/
// markdown/meta/extractedAt) with metrics.source === 'defuddle', plus every
// CONTENT_EXTRACT_FAILED path (D-91 — never a silent empty result): no-handler,
// strategy throw, internal 5 s timeout (PAGE_EXTRACTION_TIMEOUT_MS), caller
// abort, fallback exhaustion — and the D-90 redaction seam. The service is
// pure orchestration; no chrome mocks needed (the envelope round-trip is
// 06-04). Fixtures are the same synthesized shapes as DefuddleStrategy.test.ts.
import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
  extract,
  redactExtractedContent,
  registerStrategy,
  __test__,
} from '@/core/extraction/PageContentService';
import type { PageContext } from '@/core/content/PageContext';
import type { IExtractionStrategy } from '@/core/extraction/strategies/IExtractionStrategy';

const KB_ARTICLE_HTML = `<!doctype html>
<html>
<head><title>How to reset a user password in ServiceNow</title></head>
<body>
<article>
<h1>How to reset a user password in ServiceNow</h1>
<p>This article explains the password reset procedure for ServiceNow administrators. It covers impersonation, unlocking locked accounts, and setting temporary passwords for users who cannot authenticate.</p>
<h2>Before you begin</h2>
<p>You need the admin role on the instance, the user's employee number or login, and a temporary password that meets the password policy requirements.</p>
<h2>Steps</h2>
<ol>
<li>Open the User Management module from the application navigator.</li>
<li>Search for the affected user account by name, employee number, or user ID.</li>
<li>Open the user record and select Reset Password from the context menu.</li>
<li>Enter a temporary password and confirm it, then save the record.</li>
<li>Communicate the temporary password to the user through a secure channel.</li>
</ol>
<p>Related articles: <a href="/kb/incident-management/123">Incident Management overview</a>.</p>
</article>
</body>
</html>`;

// Fallback-exhaustion fixture: no text at all — defuddle yields 0 words and
// Readability.parse() returns null on an empty body.
const THIN_HTML = `<!doctype html>
<html>
<head><title>Empty page</title></head>
<body></body>
</html>`;

const URL = 'https://support.servicenow.com/kb/article/123';
const BASE_URL = 'https://support.servicenow.com';
const TITLE = 'How to reset a user password in ServiceNow';

function hangingStrategy(): IExtractionStrategy {
  return {
    id: 'apc-lite',
    canHandle: ({ mode }) => mode === 'actionable',
    run: () => new Promise<never>(() => {}),
  };
}

function throwingStrategy(): IExtractionStrategy {
  return {
    id: 'apc-lite',
    canHandle: ({ mode }) => mode === 'actionable',
    run: async () => {
      throw new Error('boom');
    },
  };
}

function metaStrategy(): IExtractionStrategy {
  return {
    id: 'apc-lite',
    canHandle: ({ mode }) => mode === 'actionable',
    run: async () => ({
      source: 'apc-lite' as const,
      root: { id: 'r1', role: 'root' },
      meta: { apiKey: 'sk-123', title: 'T' },
      approxTokens: 5,
      truncated: false,
    }),
  };
}

describe('PageContentService.extract', () => {
  beforeEach(() => {
    __test__.reset();
  });

  it('(a) round-trips fixture html + baseUrl → PageContext with source defuddle (D-82)', async () => {
    const result = await extract({ tabId: 1, url: URL, title: TITLE, mode: 'default', html: KB_ARTICLE_HTML, baseUrl: BASE_URL });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.url).toBe(URL);
    expect(result.context.origin).toBe(BASE_URL);
    expect(result.context.hostname).toBe('support.servicenow.com');
    expect(result.context.title).toBe(TITLE);
    expect(result.context.markdown?.length).toBeGreaterThan(0);
    expect(result.context.meta.title).toBeDefined();
    expect(result.context.extractedAt).toBeGreaterThan(0);
    expect(result.metrics.source).toBe('defuddle');
    expect(result.metrics.charCount).toBeGreaterThan(0);
    expect(result.metrics.truncated).toBe(false);
  });

  it('(b) malformed/empty html → ok:false CONTENT_EXTRACT_FAILED (never silent-empty)', async () => {
    const result = await extract({ tabId: 1, url: URL, title: TITLE, mode: 'default', html: '' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONTENT_EXTRACT_FAILED');
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('no-handler mode → ok:false CONTENT_EXTRACT_FAILED', async () => {
    const result = await extract({ tabId: 1, url: URL, title: TITLE, mode: 'actionable', html: KB_ARTICLE_HTML });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONTENT_EXTRACT_FAILED');
  });

  it('(c) strategy throw → ok:false CONTENT_EXTRACT_FAILED', async () => {
    registerStrategy(throwingStrategy());
    const result = await extract({ tabId: 1, url: URL, title: TITLE, mode: 'actionable' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONTENT_EXTRACT_FAILED');
  });

  it('(d) never-resolving strategy → internal 5 s timeout → CONTENT_EXTRACT_FAILED', async () => {
    vi.useFakeTimers();
    try {
      registerStrategy(hangingStrategy());
      const pending = extract({ tabId: 1, url: URL, title: TITLE, mode: 'actionable' });
      await vi.advanceTimersByTimeAsync(5_000);
      const result = await pending;
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe('CONTENT_EXTRACT_FAILED');
    } finally {
      vi.useRealTimers();
    }
  });

  it('(d2) caller-signal abort also classifies as CONTENT_EXTRACT_FAILED', async () => {
    registerStrategy(hangingStrategy());
    const controller = new AbortController();
    const pending = extract({ tabId: 1, url: URL, title: TITLE, mode: 'actionable', signal: controller.signal });
    controller.abort();
    const result = await pending;
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONTENT_EXTRACT_FAILED');
  });

  it('(e) redaction seam empties apiKey-shaped meta keys, keeps content through (D-90)', async () => {
    registerStrategy(metaStrategy());
    const result = await extract({ tabId: 1, url: URL, title: TITLE, mode: 'actionable' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.context.meta.apiKey).toBe('');
    expect(result.context.meta.title).toBe('T');
  });

  it('(f) fallback-exhaustion end-to-end → ok:false (never an empty ok:true)', async () => {
    const result = await extract({ tabId: 1, url: URL, title: TITLE, mode: 'default', html: THIN_HTML });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('CONTENT_EXTRACT_FAILED');
  });
});

describe('redactExtractedContent (D-90 seam)', () => {
  it('empties secret-shaped meta/addonFields keys, passes content through unchanged', () => {
    const context: PageContext = {
      url: URL,
      origin: BASE_URL,
      hostname: 'support.servicenow.com',
      title: 'T',
      markdown: '# Hello',
      html: '<p>Hello</p>',
      meta: { apiKey: 'secret', note: 'keep' },
      extractedAt: 1,
      addonFields: { authorization: 'Bearer x', visible: true },
    };
    const redacted = redactExtractedContent(context);
    expect(redacted.meta.apiKey).toBe('');
    expect(redacted.meta.note).toBe('keep');
    expect(redacted.addonFields?.authorization).toBe('');
    expect(redacted.addonFields?.visible).toBe(true);
    expect(redacted.markdown).toBe('# Hello');
    expect(redacted.title).toBe('T');
    expect(redacted).not.toBe(context); // deep-clone, no mutation
  });
});