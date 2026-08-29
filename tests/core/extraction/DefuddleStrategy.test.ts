// DefuddleStrategy tests — §18 required test + SPIKE-P6-01 host.
//
// Real-engine detached-doc fidelity: defuddle/full runs on a DOMParser doc in
// jsdom (Assumptions A1/A2 gate — RESEARCH.md:492-493). jsdom provides
// DOMParser; the detached doc exercises the defaultView?.getComputedStyle
// guard (A1) and proves the UMD bundle executes end-to-end (A2). If the
// defuddle/full bundle cannot LOAD under jsdom at module import time, the
// real-engine describe below is gated behind a load-probe skip (documented) —
// the spike then moves to a `pnpm build:ext` + node-harness fallback. Never
// silently weakened.
//
// Fixtures are synthesized inline (RESEARCH Open Q1): a KB-article shape and a
// portal-record shape, plus low-confidence / thin / relative-link shapes for
// the fallback paths.
import { describe, it, expect } from 'vitest';

import { defuddleStrategy, DEFUDDLE_LOW_CONFIDENCE_WORD_COUNT } from '@/core/extraction/strategies/DefuddleStrategy';
import type { StrategyInput } from '@/core/extraction/strategies/IExtractionStrategy';

// --- Inline synthesized fixtures (RESEARCH Open Q1) ---

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
<p>Related articles: <a href="/kb/incident-management/123">Incident Management overview</a> and <a href="/kb/user-administration/456">Locking and unlocking user accounts</a>.</p>
</article>
</body>
</html>`;

const PORTAL_RECORD_HTML = `<!doctype html>
<html>
<head><title>INC0012345 — Email not being received</title></head>
<body>
<div class="portal-record">
<h1>INC0012345 — Email not being received</h1>
<dl>
<dt>State</dt><dd>In Progress</dd>
<dt>Priority</dt><dd>2 - High</dd>
<dt>Category</dt><dd>Email</dd>
<dt>Assigned to</dt><dd>John Smith</dd>
</dl>
<p>The customer reports that email notifications are not being received after the recent email server migration. The issue started on Monday and affects all outbound notifications.</p>
<p>Preliminary investigation suggests the SMTP relay configuration may be pointing to the legacy server. The team is verifying the outbound mail settings, the notification templates, and the certificate bindings on the new mail host.</p>
</div>
</body>
</html>`;

const LOW_CONFIDENCE_HTML = `<!doctype html>
<html>
<head><title>Portal record</title></head>
<body>
<div class="container">
<div class="row"><div class="cell">INCIDENT INC0012345 opened at 09:14</div></div>
<div class="row"><div class="cell">Category: Email</div></div>
<div class="row"><div class="cell">Priority: High</div></div>
<div class="row"><div class="cell">State: In Progress</div></div>
<div class="row"><div class="cell">Assigned to: Tier 2 Support Queue</div></div>
<div class="row"><div class="cell">Short description: Email delivery failed</div></div>
<div class="row"><div class="cell">Work notes: Investigating SMTP relay config</div></div>
</div>
</body>
</html>`;

// Fallback-exhaustion fixture: no text at all — defuddle yields 0 words and
// Readability.parse() returns null on an empty body.
const THIN_HTML = `<!doctype html>
<html>
<head><title>Empty page</title></head>
<body></body>
</html>`;

const RELATIVE_LINK_HTML = `<!doctype html>
<html>
<head><title>Relative link resolution</title></head>
<body>
<article>
<h1>Relative link resolution</h1>
<p>This page contains a relative link that must resolve against the injected base href when the strategy runs on the detached document.</p>
<p>See <a href="/kb/incident-management/123">Incident Management overview</a> for the related article.</p>
</article>
</body>
</html>`;

function kbInput(overrides: Partial<StrategyInput> = {}): StrategyInput {
  return {
    url: 'https://support.servicenow.com/kb/article/123',
    title: 'How to reset a user password in ServiceNow',
    mode: 'default',
    html: KB_ARTICLE_HTML,
    baseUrl: 'https://support.servicenow.com',
    ...overrides,
  };
}

// --- A2 load probe: gate the real-engine describe behind the defuddle/full
// bundle's ability to load under jsdom. ---
let realEngineAvailable = true;
try {
  await import('defuddle/full');
} catch {
  realEngineAvailable = false;
}
const realEngineDescribe = realEngineAvailable ? describe : describe.skip;

describe('DefuddleStrategy', () => {
  it('canHandle only the default/read mode', () => {
    expect(defuddleStrategy.canHandle({ url: 'https://x.example/', mode: 'default' })).toBe(true);
    expect(defuddleStrategy.canHandle({ url: 'https://x.example/', mode: 'actionable' })).toBe(false);
  });

  it('exposes the low-confidence word-count threshold', () => {
    expect(DEFUDDLE_LOW_CONFIDENCE_WORD_COUNT).toBe(50);
  });

  realEngineDescribe('real defuddle engine on a detached doc (SPIKE-P6-01 host)', () => {
    it('(a) does not throw on a detached DOMParser doc with base-href (A1/A2)', async () => {
      const result = await defuddleStrategy.run(kbInput());
      expect(result.markdown).toBeDefined();
    });

    it('(b) extracts non-empty markdown + title for the KB fixture', async () => {
      const result = await defuddleStrategy.run(kbInput());
      expect(result.source).toBe('defuddle');
      expect(result.markdown?.trim().length).toBeGreaterThan(0);
      expect(result.meta?.title).toContain('reset a user password');
      expect(result.approxTokens).toBeGreaterThan(0);
    });

    it('extracts the portal-record-shaped fixture too', async () => {
      const result = await defuddleStrategy.run(
        kbInput({ html: PORTAL_RECORD_HTML, title: 'INC0012345 — Email not being received' }),
      );
      expect(result.source).toBe('defuddle');
      // The record body (dl values + description paragraphs) is extracted;
      // the h1 headline itself is dropped by defuddle's main-content pass.
      expect(result.markdown).toContain('customer reports that email notifications');
    });

    it('(c) resolves relative links against the injected base href', async () => {
      const result = await defuddleStrategy.run(kbInput({ html: RELATIVE_LINK_HTML, title: 'Relative link resolution' }));
      expect(result.markdown).toContain('https://support.servicenow.com/kb/incident-management/123');
    });

    it('(d) falls back to Readability on low-confidence output (source provenance)', async () => {
      const result = await defuddleStrategy.run(kbInput({ html: LOW_CONFIDENCE_HTML, title: 'Portal record' }));
      expect(result.source).toBe('readability');
      expect(result.markdown?.trim().length).toBeGreaterThan(0);
    });

    it('(e) fallback-exhaustion: thin content → failed-fallback shape, never silent', async () => {
      const result = await defuddleStrategy.run(kbInput({ html: THIN_HTML, title: 'Empty page' }));
      expect(result.source).toBe('readability');
      expect(result.markdown).toBeUndefined();
      expect(result.approxTokens).toBe(0);
      expect(result.truncated).toBe(true);
    });

    it('(f) propagates input.truncated on the confident path', async () => {
      const truncated = await defuddleStrategy.run(kbInput({ truncated: true }));
      expect(truncated.truncated).toBe(true);
      const full = await defuddleStrategy.run(kbInput({ truncated: false }));
      expect(full.truncated).toBe(false);
    });
  });
});