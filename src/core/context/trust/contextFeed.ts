// src/core/context/trust/contextFeed.ts — D-4b-01/04/08 (04b-03 Task 1): the
// page-only 4b feed. pageToContextItems converts a Phase-4a PageContext into
// trust-carrying ContextItem[] — CTX-01 metadata (trust 'retrieved',
// instructionAuthority:false) stamped AT CONVERSION — and enforces the §22.2
// webpage budget (spec L3581/L3794) STRUCTURALLY here: first paragraph + first
// heading, marked truncated (D-04-13 no-slice rule — the cap lives at the feed
// boundary, NEVER inside ContextOptimizer; RESEARCH Pitfall 6). applySourceGates
// runs the D-4b-08 source-type gates at the same boundary against TrustPrefs
// (04b-01 np_trust): a disabled source kind is excluded BEFORE section
// conversion with the structured `{ reason: 'trust_disabled' }` omit decision
// the receipt consumes with no conversion (D-4b-06/08 contract-aligned).
//
// Determinism rule (fixtures precedent): no Date.now, no crypto, no
// Math.random. Freshness follows the Open Question 4 fixed decay curve
// max(0, 1 - ageHours/24) clamped to 0..1, derived from page.extractedAt; the
// caller may inject a clock (nowMs) — absent injection the page is treated as
// freshly extracted (age 0 → freshness 1). capToBudget is exported because the
// truncated marker is not representable on ContextItem (C.1 verbatim — R-1), so
// the §22.2 cap contract is asserted through capToBudget directly.
import type { PageContext } from '@/core/content/PageContext';
import type { TrustPrefs } from '@/core/preferences/trustConfig';
import type { ContextItem, TrustOmitReason } from '@/types/harness';
import { estimateTokens } from '../TokenBudget';

/** §22.2/§26.5 webpage budget (spec L3581/L3794) — capped at conversion (D-04-13). */
export const PAGE_BUDGET_TOKENS = 2_000;

/** Milliseconds per hour — the freshness decay-window denominator. */
const MS_PER_HOUR = 3_600_000;

/** Open Question 4 curve: full freshness decays linearly over 24h. */
const FRESHNESS_WINDOW_HOURS = 24;

/**
 * Open Question 4 fixed decay curve (fixture-pinned): freshness =
 * clamp(1 - ageHours/24, 0..1) with age floored at 0 (a future extractedAt is
 * treated as fresh, never negative). Pure + deterministic — the only clock is
 * the injected nowMs.
 */
function freshnessFrom(extractedAt: number, nowMs: number): number {
  const ageHours = Math.max(0, (nowMs - extractedAt) / MS_PER_HOUR);
  return Math.min(1, Math.max(0, 1 - ageHours / FRESHNESS_WINDOW_HOURS));
}

/** ATX markdown heading — a block starting with 1-6 '#' + whitespace. */
function isHeading(block: string): boolean {
  return /^\s*#{1,6}\s/.test(block);
}

/** Blank-line separated markdown blocks, trimmed, non-empty only (deterministic). */
function splitBlocks(markdown: string): string[] {
  return markdown
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);
}

/**
 * §22.2 structural cap (D-04-13 whole-structure rule): the full markdown when
 * within budget; otherwise the first heading + first paragraph in DOCUMENT
 * order, cut at PARAGRAPH boundaries only — never mid-sentence/mid-token.
 * `truncated: true` marks any reduction. A document whose first block alone
 * exceeds the budget stays honest (whole structures only — a paragraph is
 * never sliced).
 */
export function capToBudget(
  markdown: string,
  budgetTokens: number,
): { text: string; truncated: boolean } {
  if (estimateTokens(markdown) <= budgetTokens) {
    return { text: markdown, truncated: false };
  }
  const blocks = splitBlocks(markdown);
  const headingIdx = blocks.findIndex(isHeading);
  const paragraphIdx = blocks.findIndex((b) => !isHeading(b));
  const selected: string[] = [];
  for (const idx of [headingIdx, paragraphIdx]) {
    if (idx >= 0) selected.push(blocks[idx]);
  }
  // Paragraph-boundary trim: drop trailing blocks until the budget fits.
  while (selected.length > 1 && estimateTokens(selected.join('\n\n')) > budgetTokens) {
    selected.pop();
  }
  return { text: selected.join('\n\n'), truncated: true };
}

/**
 * CTX-01 metadata fill: a single 'context'-kind item per page. Returns [] for a
 * null/undefined page or empty/whitespace markdown (TRUST-01 empty probe — a
 * zero-length context section is never produced). All metadata is deterministic:
 * id `page:<url>`, trust 'retrieved', instructionAuthority false (CTX-01
 * MUST-be-false), relevance 1 (single-item feed — top-k ranking deferred to
 * Phase 5a), sensitivity 'none' (page-sensitivity heuristics out of 4b scope).
 */
export function pageToContextItems(
  page: PageContext | null | undefined,
  nowMs?: number,
): ContextItem[] {
  if (!page) return [];
  const markdown = page.markdown ?? '';
  if (markdown.trim().length === 0) return [];
  const { text } = capToBudget(markdown, PAGE_BUDGET_TOKENS);
  return [
    {
      id: `page:${page.url}`,
      kind: 'context',
      text,
      tokens: estimateTokens(text),
      trust: 'retrieved',
      instructionAuthority: false,
      relevance: 1,
      freshness: freshnessFrom(page.extractedAt, nowMs ?? page.extractedAt),
      sensitivity: 'none',
      sourceId: page.url,
    },
  ];
}

/** D-4b-08: ContextItem kind → np_trust pref key. Kinds without a key are default-included. */
const KIND_TO_PREF_KEY: Partial<Record<ContextItem['kind'], keyof TrustPrefs>> = {
  context: 'page',
  memory: 'memory',
  tool_result: 'tool_result',
};

/**
 * D-4b-08 source-type gates at the feed boundary: a disabled source kind is
 * excluded BEFORE conversion with the structured `{ reason: 'trust_disabled' }`
 * decision (D-4b-06/08 — the SAME map shape buildReceipt consumes, so the gate
 * output feeds the receipt input with no conversion). Unmapped kinds
 * (system/tool_schemas/preferences/task/user_input) and enabled kinds pass
 * through. Input order is preserved (TRUST-02 ordering probe).
 */
export function applySourceGates(
  items: ContextItem[],
  prefs: TrustPrefs,
): { included: ContextItem[]; excluded: Map<string, { reason: TrustOmitReason }> } {
  const included: ContextItem[] = [];
  const excluded = new Map<string, { reason: TrustOmitReason }>();
  for (const item of items) {
    const prefKey = KIND_TO_PREF_KEY[item.kind];
    if (prefKey !== undefined && prefs[prefKey] === false) {
      excluded.set(item.id, { reason: 'trust_disabled' });
    } else {
      included.push(item);
    }
  }
  return { included, excluded };
}
