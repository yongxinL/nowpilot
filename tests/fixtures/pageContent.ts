// tests/fixtures/pageContent.ts — shared golden HTML fixtures (D-4a-24): one
// module consumed by DefuddleStrategy / ApcLiteStrategy / PageIndexBuilder tests
// — the shared extraction regression guard. Follows the index.ts D-20/D-21
// convention: fixed constants ONLY (no Date.now, no crypto, no randomness),
// typed builder functions with optional overrides. Direction (D-21): fixtures
// live under tests/ only, never imported from src/. Type-only imports from src
// are the sole exception — but src/core/extraction/apcLite.types.ts does not
// exist yet (created by the ApcLiteStrategy plan), so the RawNode shape is
// inlined verbatim from PRODUCT_SPEC Appendix C (L4414-4425) and stays
// structurally compatible with the real type when it lands (R-1).
export interface RawNode {
  id: string;
  role: string;
  type?: string;
  text?: string;
  geometry?: { x: number; y: number; width: number; height: number; inViewport: boolean };
  interaction?: Record<string, boolean | undefined>;
  link?: { href: string; rel?: string };
  image?: { alt?: string; src?: string };
  form?: {
    control?: { fieldName?: string; fieldType?: string; value?: string; isPassword?: boolean };
  };
  iframe?: { origin: string; crossOrigin: boolean };
  children?: RawNode[];
}

// ---------------------------------------------------------------------------
// Fixed constants (deterministic — no real randomness anywhere in this module)
// ---------------------------------------------------------------------------

/** Fixed article URL used across all page-content fixtures (D-4a-24). */
export const FIXED_URL = 'https://docs.example.com/article/how-nowpilot-extracts';
/** Fixed article title used across all page-content fixtures (D-4a-24). */
export const FIXED_TITLE = 'How NowPilot Extracts Page Content';
/** Fixed extraction timestamp (ms epoch) — deterministic APCLiteDocument.extractedAt. */
export const FIXED_TIMESTAMP = 1_700_000_000_000;
/** Fixture base URL — the D-4a-08 base-URL stamp value the panel injects. */
export const FIXED_BASE_URL = 'https://docs.example.com';

// ---------------------------------------------------------------------------
// 1. buildArticleFixture — realistic article page (Defuddle-success +
// password-omission + base-URL-stamp fixture). Contains <title>, h1 + h2/h3
// sections with paragraphs, relative + absolute <a> links, an <img>, a <ul>,
// and a <form> with one <input type="password"> (NO value attribute — the
// D-4a-20 capture invariant) and one <input type="text">.
// ---------------------------------------------------------------------------

export interface ArticleHtmlFixture {
  html: string;
  url: string;
  title: string;
}

export function buildArticleFixture(
  overrides: Partial<ArticleHtmlFixture> = {},
): ArticleHtmlFixture {
  return {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${FIXED_TITLE}</title>
  <meta name="description" content="How the NowPilot page content service extracts and indexes pages.">
</head>
<body>
  <header>
    <nav>
      <a href="/">Home</a>
      <a href="/guide">Guide</a>
    </nav>
  </header>
  <main>
    <h1>${FIXED_TITLE}</h1>
    <p>NowPilot extracts pages with a layered strategy: Defuddle first, Readability as fallback, and a structural walk for actionable mode. The panel owns all heavy parsing; the content script only serializes a pre-stripped clone.</p>
    <h2>Architecture</h2>
    <p>The content script runs in an ISOLATED world and clones the document. It strips scripts, styles, and cross-origin iframes, then serializes one HTML string for the panel to parse with DOMParser.</p>
    <h3>Detached parsing</h3>
    <p>The panel stamps the page base URL into the detached document so relative links and images resolve correctly. See the <a href="${FIXED_URL}">full article</a> or the <a href="/guide/quickstart">quickstart guide</a>.</p>
    <img src="/assets/pipeline.png" alt="Extraction pipeline diagram">
    <ul>
      <li>Layered fallback records which source won.</li>
      <li>The ephemeral index is built lazily on first query.</li>
    </ul>
    <h2>Performance</h2>
    <p>Extraction runs inside a five second budget with a single abort controller, and the per-tab cache evicts under LRU pressure.</p>
    <form action="/login" method="post">
      <label>Username <input type="text" name="username" value="alice"></label>
      <label>Password <input type="password" name="password"></label>
      <button type="submit">Sign in</button>
    </form>
  </main>
  <footer>
    <p>Copyright 2026 NowPilot.</p>
  </footer>
</body>
</html>`,
    url: FIXED_URL,
    title: FIXED_TITLE,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 2. buildBoilerplateFixture — nav-bar + footer + minimal-main page (the
// D-4a-18 Readability-fallback fixture). Extracted-text char count is below the
// fallback floor and the content/boilerplate density ratio fails → the layered
// pipeline must fall back to Readability and record the source used.
// ---------------------------------------------------------------------------

export interface BoilerplateHtmlFixture {
  html: string;
  url: string;
  title: string;
}

export function buildBoilerplateFixture(
  overrides: Partial<BoilerplateHtmlFixture> = {},
): BoilerplateHtmlFixture {
  return {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Acme Corporation</title>
</head>
<body>
  <nav>
    <a href="/products">Products</a>
    <a href="/solutions">Solutions</a>
    <a href="/industries">Industries</a>
    <a href="/resources">Resources</a>
    <a href="/pricing">Pricing</a>
    <a href="/about">About</a>
    <a href="/contact">Contact</a>
    <a href="/careers">Careers</a>
    <a href="/news">News</a>
    <a href="/events">Events</a>
  </nav>
  <main>
    <p>Welcome to Acme Corporation.</p>
  </main>
  <footer>
    <a href="/legal/terms">Terms of Service</a>
    <a href="/legal/privacy">Privacy Policy</a>
    <a href="/legal/cookies">Cookie Policy</a>
    <a href="/legal/security">Security</a>
    <a href="/legal/accessibility">Accessibility</a>
    <a href="/legal/sitemap">Sitemap</a>
    <a href="/legal/licenses">Licenses</a>
    <a href="/legal/status">System Status</a>
    <p>Copyright 2026 Acme Corporation. All rights reserved.</p>
  </footer>
</body>
</html>`,
    url: 'https://acme.example.com/',
    title: 'Acme Corporation',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 3. buildNoHeadingFixture — paragraph blocks (blank-line separated) with no
// h1-h6 anywhere (the PageIndexBuilder paragraph-chunk fallback fixture).
// Converts to markdown paragraphs the builder chunks by blank lines under the
// page title (D-4a-16 no-heading fallback).
// ---------------------------------------------------------------------------

export interface NoHeadingHtmlFixture {
  html: string;
  url: string;
  title: string;
}

export function buildNoHeadingFixture(
  overrides: Partial<NoHeadingHtmlFixture> = {},
): NoHeadingHtmlFixture {
  return {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Field Notes</title>
</head>
<body>
  <p>This page has no headings at all, which exercises the paragraph-chunk fallback in the page index builder.</p>
  <p>The first paragraph establishes the incident timeline. The outage began at 09:14 UTC when the primary database became unresponsive.</p>
  <p>The second paragraph records the remediation steps. Engineers restarted the replica pool and replayed the write journal.</p>
  <p>The third paragraph captures the resolution. Service was restored at 10:02 UTC with no data loss reported.</p>
  <p>A fourth paragraph provides follow-up context. A post-incident review is scheduled for the next business day.</p>
</body>
</html>`,
    url: 'https://kb.example.com/incidents/field-notes',
    title: 'Field Notes',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 4. buildLargeArticleFixture — multiple long sections each exceeding the
// ~500-token INDEX_CHUNK_MAX_TOKENS budget (~2,000 chars at the 4-char/token
// heuristic) (the sub-chunking fixture). Each h2 section carries enough
// paragraphs that heading-chunking must split it into paragraph sub-chunks
// inheriting the same headingPath (D-4a-16).
// ---------------------------------------------------------------------------

export interface LargeArticleHtmlFixture {
  html: string;
  url: string;
  title: string;
}

/** One long section body: 8 paragraphs × ~300 chars ≈ 2,600 chars (> ~500 tokens at the 4-char/token heuristic). */
const LARGE_SECTION_BODY = `
    <p>Section narrative paragraph one. The extraction pipeline runs entirely inside the side panel, never inside the content bundle, so the content script stays dependency-free and well under the fifty kilobyte payload budget while every heavy parsing library lives on the panel side of the boundary.</p>
    <p>Section narrative paragraph two. Defuddle produces clean HTML rather than markdown in its browser build, so every prose path routes through the turndown serializer with one fixed configuration that matches the converter defuddle itself uses internally for consistent output across layers.</p>
    <p>Section narrative paragraph three. The fallback threshold combines a minimum extracted-text character floor with a content to boilerplate density ratio evaluated after Defuddle, and when the result falls below the floor the pipeline records the attempt and falls through to the next strategy in the fixed order.</p>
    <p>Section narrative paragraph four. When confidence is low the pipeline retries with Readability on a fresh document clone because the parser mutates the document it is given, which would otherwise strip content that later strategies in the chain still need to read.</p>
    <p>Section narrative paragraph five. The ephemeral index is built lazily on the first query for a tab and evicted together with the per-tab cache entry, so tabs whose content is never searched pay zero indexing cost and nothing is ever persisted to storage.</p>
    <p>Section narrative paragraph six. Citations resolve against the stamped base URL that the content script embeds in the payload, so relative links and images inside detached documents keep their original targets when Defuddle and Readability re-attach them to the page context.</p>
    <p>Section narrative paragraph seven. The per-tab cache coalesces concurrent extraction requests with an in-flight promise map, and a read that arrives after invalidation awaits the running extraction rather than serving a stale snapshot of the previous page.</p>
    <p>Section narrative paragraph eight. Every catch in the pipeline logs through debugLog with the canonical content extraction failure code, and the layered fallback chain surfaces a typed failure with the strategies tried rather than silently returning an empty result.</p>`;

export function buildLargeArticleFixture(
  overrides: Partial<LargeArticleHtmlFixture> = {},
): LargeArticleHtmlFixture {
  return {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Deep Dive: Extraction Internals</title>
</head>
<body>
  <main>
    <h1>Deep Dive: Extraction Internals</h1>
    <h2>Content Script Contract</h2>${LARGE_SECTION_BODY}
    <h2>Layered Strategy Order</h2>${LARGE_SECTION_BODY}
    <h2>Ephemeral Index Lifecycle</h2>${LARGE_SECTION_BODY}
  </main>
</body>
</html>`,
    url: 'https://docs.example.com/deep-dive/extraction-internals',
    title: 'Deep Dive: Extraction Internals',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 5a. buildEmptyPageFixture — a totally-empty page (the CAT-01 empty probe
// fixture, 04a-08). Defuddle yields no text (char floor + density ratio fire)
// and Readability finds no article on the fresh clone → both layers return
// unusable content → extractLayered throws typed CONTENT_EXTRACT_FAILED
// (D-4a-19 — never a silent-empty result).
// ---------------------------------------------------------------------------

export function buildEmptyPageFixture(
  overrides: Partial<ArticleHtmlFixture> = {},
): ArticleHtmlFixture {
  return {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Empty Page</title>
</head>
<body>
  <main>
    <p></p>
  </main>
</body>
</html>`,
    url: 'https://empty.example.com/',
    title: 'Empty Page',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 5b. buildSecretPageFixture — a prose article containing a secret-shaped
// string (JSESSIONID cookie, the D-4a-10/CAT-03 redaction fixture, 04a-08).
// The secret sits in a plain <p> so it survives Defuddle extraction into the
// markdown; TraceRedactor.redact MUST strip it before the cache write / index
// build (the R-10 redaction seam) — the shared-module guard (D-4a-24).
// ---------------------------------------------------------------------------

export function buildSecretPageFixture(
  overrides: Partial<ArticleHtmlFixture> = {},
): ArticleHtmlFixture {
  return {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Session Handling</title>
</head>
<body>
  <main>
    <h1>Session Handling</h1>
    <p>Each browser session is identified by a cookie. The current session cookie is JSESSIONID=abc123def456 and it must never be indexed or logged.</p>
    <h2>Rotation</h2>
    <p>Sessions rotate every hour. Keep the cookie value private — it grants access to the account.</p>
  </main>
</body>
</html>`,
    url: 'https://session.example.com/handling',
    title: 'Session Handling',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 6. buildRawNodeFixture — typed RawNode tree (the ApcLiteStrategy input
// fixture). Roles + text + interaction flags + hierarchy + links; the form
// control carries isPassword: true with NO value field (the D-4a-20 invariant
// fixture shape). Geometry is unset (D-4a-12/13 omit it in v0.1).
// ---------------------------------------------------------------------------

export interface RawNodeFixture {
  root: RawNode;
  url: string;
  title: string;
  extractedAt: number;
}

export function buildRawNodeFixture(overrides: Partial<RawNodeFixture> = {}): RawNodeFixture {
  return {
    root: {
      id: 'rn-root',
      role: 'main',
      children: [
        {
          id: 'rn-h1',
          role: 'heading',
          type: 'h1',
          text: FIXED_TITLE,
          interaction: { focusable: true },
        },
        {
          id: 'rn-p1',
          role: 'paragraph',
          type: 'p',
          text: 'The structural walk emits roles, text, hierarchy, interaction flags, links, and tables when actionable mode is requested.',
          interaction: {},
        },
        {
          id: 'rn-link1',
          role: 'link',
          type: 'a',
          text: 'full article',
          link: { href: `${FIXED_BASE_URL}/deep-dive/extraction-internals`, rel: undefined },
          interaction: { clickable: true, focusable: true },
        },
        {
          id: 'rn-form',
          role: 'form',
          type: 'form',
          interaction: { focusable: false },
          children: [
            {
              id: 'rn-input-user',
              role: 'textbox',
              type: 'input',
              text: '',
              form: {
                control: {
                  fieldName: 'username',
                  fieldType: 'text',
                  value: 'alice',
                  isPassword: false,
                },
              },
              interaction: { editable: true, focusable: true },
            },
            {
              // D-4a-20 invariant: password value is NEVER captured — isPassword
              // true and no `value` key on the control.
              id: 'rn-input-pass',
              role: 'textbox',
              type: 'input',
              text: '',
              form: { control: { fieldName: 'password', fieldType: 'password', isPassword: true } },
              interaction: { editable: true, focusable: true },
            },
          ],
        },
      ],
    },
    url: FIXED_URL,
    title: FIXED_TITLE,
    extractedAt: FIXED_TIMESTAMP,
    ...overrides,
  };
}
