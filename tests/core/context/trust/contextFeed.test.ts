// tests/core/context/trust/contextFeed.test.ts — 04b-03 Task 1: the page-feed
// conversion contract. Contract under test:
//   1. pageToContextItems stamps the CTX-01 metadata deterministically (trust
//      'retrieved', instructionAuthority false, relevance 1, sensitivity
//      'none', sourceId = page.url, kind 'context', id `page:<url>`).
//   2. §22.2 structural cap (D-04-13 — cap at conversion, never in the
//      optimizer): an over-budget markdown comes back within PAGE_BUDGET_TOKENS
//      with the truncated marker; a small markdown passes through full +
//      untruncated.
//   3. TRUST-01 empty probe: null/undefined page and empty/whitespace markdown
//      both yield [].
//   4. Determinism: identical page → deep-equal ContextItem[].
//   5. applySourceGates (D-4b-08): disabled kind → excluded map with
//      { reason: 'trust_disabled' }; enabled → included; unmapped kind →
//      default-included.
//   6. Freshness pins the Open Question 4 decay curve for fixed timestamps.
//
// Determinism rule (fixtures precedent): no Date.now, no crypto, no
// Math.random — FIXED_TIMESTAMP/FIXED_URL come from tests/fixtures/pageContent.
import { describe, expect, it } from 'vitest';

import type { PageContext } from '@/core/content/PageContext';
import { estimateTokens } from '@/core/context/TokenBudget';
import {
  PAGE_BUDGET_TOKENS,
  applySourceGates,
  capToBudget,
  pageToContextItems,
} from '@/core/context/trust/contextFeed';
import type { TrustPrefs } from '@/core/preferences/trustConfig';
import type { ContextItem } from '@/types/harness';
import { FIXED_TIMESTAMP, FIXED_TITLE, FIXED_URL } from '../../../fixtures/pageContent';

// ---------------------------------------------------------------------------
// Fixed fixtures (deterministic — no dynamic values anywhere in this module)
// ---------------------------------------------------------------------------

const ALL_TRUE_PREFS: TrustPrefs = { page: true, notes: true, memory: true, tool_result: true };
const PAGE_DISABLED_PREFS: TrustPrefs = { page: false, notes: true, memory: true, tool_result: true };

const SMALL_MARKDOWN = `# ${FIXED_TITLE}

The extraction pipeline runs entirely inside the side panel. Layered strategies keep the content script dependency-free.`;

/** Distinct first paragraph (kept by the §22.2 structural cap). */
const FIRST_PARAGRAPH =
  'The extraction pipeline runs entirely inside the side panel, never inside the content bundle, so the content script stays dependency-free and well under the fifty kilobyte payload budget while every heavy parsing library lives on the panel side of the boundary.';

/** Filler paragraph repeated to push the fixture over the §22.2 budget. */
const FILLER_PARAGRAPH =
  'Layered fallback records which extraction strategy won, retries with Readability on a fresh document clone when confidence is low, and surfaces a typed failure with the strategies tried rather than silently returning an empty result for the page being processed.';

/** ~9,800 chars → ~2,450 tokens at the 4-char/token heuristic — over PAGE_BUDGET_TOKENS. */
const LARGE_MARKDOWN = `# ${FIXED_TITLE}

${FIRST_PARAGRAPH}

${Array.from({ length: 36 }, () => FILLER_PARAGRAPH).join('\n\n')}`;

function makePage(markdown: string, overrides: Partial<PageContext> = {}): PageContext {
  return {
    url: FIXED_URL,
    origin: 'https://docs.example.com',
    hostname: 'docs.example.com',
    title: FIXED_TITLE,
    markdown,
    meta: {},
    extractedAt: FIXED_TIMESTAMP,
    ...overrides,
  };
}

/** A 'system'-kind item with no np_trust pref key (D-4b-08 default-include path). */
const SYSTEM_ITEM: ContextItem = {
  id: 'sys-1',
  kind: 'system',
  text: 'Fixed system fixture.',
  tokens: 4,
  trust: 'system',
  instructionAuthority: true,
  relevance: 1,
  freshness: 1,
  sensitivity: 'none',
  sourceId: 'system',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pageToContextItems — CTX-01 metadata fill (04b-03 Task 1, D-4b-01)', () => {
  it('stamps trust retrieved + instructionAuthority false + fixed metadata', () => {
    const [item] = pageToContextItems(makePage(SMALL_MARKDOWN));
    expect(item.kind).toBe('context');
    expect(item.id).toBe(`page:${FIXED_URL}`);
    expect(item.trust).toBe('retrieved');
    expect(item.instructionAuthority).toBe(false);
    expect(item.relevance).toBe(1);
    expect(item.sensitivity).toBe('none');
    expect(item.sourceId).toBe(FIXED_URL);
    expect(item.tokens).toBe(estimateTokens(item.text));
  });

  it('emits instructionAuthority:false + trust retrieved for every item (CTX-01)', () => {
    const items = pageToContextItems(makePage(LARGE_MARKDOWN));
    expect(items.length).toBe(1);
    for (const it of items) {
      expect(it.trust).toBe('retrieved');
      expect(it.instructionAuthority).toBe(false);
    }
  });
});

describe('§22.2 structural budget cap (D-04-13 — cap at conversion, never in the optimizer)', () => {
  it('caps an over-budget markdown at a paragraph boundary with the truncated marker', () => {
    expect(estimateTokens(LARGE_MARKDOWN)).toBeGreaterThan(PAGE_BUDGET_TOKENS); // fixture sanity
    const capped = capToBudget(LARGE_MARKDOWN, PAGE_BUDGET_TOKENS);
    expect(capped.truncated).toBe(true);
    expect(estimateTokens(capped.text)).toBeLessThanOrEqual(PAGE_BUDGET_TOKENS);
    expect(capped.text).toContain(`# ${FIXED_TITLE}`); // first heading kept
    expect(capped.text).toContain(FIRST_PARAGRAPH); // first paragraph kept
    expect(capped.text).not.toContain(FILLER_PARAGRAPH); // later blocks dropped whole
  });

  it('passes a small markdown through full + untruncated', () => {
    const capped = capToBudget(SMALL_MARKDOWN, PAGE_BUDGET_TOKENS);
    expect(capped).toEqual({ text: SMALL_MARKDOWN, truncated: false });
    const [item] = pageToContextItems(makePage(SMALL_MARKDOWN));
    expect(item.text).toBe(SMALL_MARKDOWN);
  });
});

describe('TRUST-01 empty probe (spec-less, resolved)', () => {
  it('returns [] for a null/undefined page', () => {
    expect(pageToContextItems(null)).toEqual([]);
    expect(pageToContextItems(undefined)).toEqual([]);
  });

  it('returns [] for empty/whitespace markdown', () => {
    expect(pageToContextItems(makePage(''))).toEqual([]);
    expect(pageToContextItems(makePage('   \n\n  '))).toEqual([]);
  });
});

describe('determinism (fixtures precedent — no Date.now)', () => {
  it('same page twice → deep-equal ContextItem[]', () => {
    const page = makePage(LARGE_MARKDOWN);
    expect(pageToContextItems(page)).toEqual(pageToContextItems(page));
  });

  it('same page + explicit nowMs twice → deep-equal freshness', () => {
    const page = makePage(SMALL_MARKDOWN);
    expect(pageToContextItems(page, FIXED_TIMESTAMP + 12 * 3_600_000)).toEqual(
      pageToContextItems(page, FIXED_TIMESTAMP + 12 * 3_600_000),
    );
  });
});

describe('applySourceGates (D-4b-08 — gates at the feed boundary)', () => {
  it('a disabled page pref excludes the context item with reason trust_disabled', () => {
    const items = pageToContextItems(makePage(SMALL_MARKDOWN));
    const { included, excluded } = applySourceGates(items, PAGE_DISABLED_PREFS);
    expect(included).toEqual([]);
    expect([...excluded.entries()]).toEqual([[items[0].id, { reason: 'trust_disabled' }]]);
  });

  it('an enabled page pref keeps the item included with an empty excluded map', () => {
    const items = pageToContextItems(makePage(SMALL_MARKDOWN));
    const { included, excluded } = applySourceGates(items, ALL_TRUE_PREFS);
    expect(included).toEqual(items);
    expect(excluded.size).toBe(0);
  });

  it('a kind with no prefs key is default-included even when page is disabled', () => {
    const { included, excluded } = applySourceGates([SYSTEM_ITEM], PAGE_DISABLED_PREFS);
    expect(included).toEqual([SYSTEM_ITEM]);
    expect(excluded.size).toBe(0);
  });
});

describe('freshness — Open Question 4 deterministic decay curve', () => {
  it('fresh (1) at age 0 and when no clock is injected (derived fresh default)', () => {
    const page = makePage(SMALL_MARKDOWN, { extractedAt: FIXED_TIMESTAMP });
    expect(pageToContextItems(page)[0].freshness).toBe(1);
    expect(pageToContextItems(page, FIXED_TIMESTAMP)[0].freshness).toBe(1);
  });

  it('pins the fixed curve: age 12h → 0.5, age 24h → 0, age 48h → 0 (clamped)', () => {
    const page = makePage(SMALL_MARKDOWN, { extractedAt: FIXED_TIMESTAMP });
    expect(pageToContextItems(page, FIXED_TIMESTAMP + 12 * 3_600_000)[0].freshness).toBe(0.5);
    expect(pageToContextItems(page, FIXED_TIMESTAMP + 24 * 3_600_000)[0].freshness).toBe(0);
    expect(pageToContextItems(page, FIXED_TIMESTAMP + 48 * 3_600_000)[0].freshness).toBe(0);
  });

  it('clamps a future extractedAt to fresh (age floored at 0)', () => {
    const page = makePage(SMALL_MARKDOWN, { extractedAt: FIXED_TIMESTAMP + 3_600_000 });
    expect(pageToContextItems(page, FIXED_TIMESTAMP)[0].freshness).toBe(1);
  });
});
