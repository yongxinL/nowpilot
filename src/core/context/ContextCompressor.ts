// ContextCompressor — D-75 pure compression strategies operating on the A8
// sections ContextOptimizer passes them (§2.4 rungs 3/4/5/6).
//
// Phase 5 never calls the LLM: the summariser is a declare-now/populate-later
// seam (D-46/D-64 precedent) — when no summarizer is supplied, older-history
// truncation falls back to DROPPING older turns, recorded as truncation, never
// silence (D-75). Compression type is recorded per section in the manifest
// ('summarise' | 'structural' | 'topk', §2.6).
//
// Section text conventions (LOCKED, shared with ContextOptimizer):
//   [MEMORY]        one '<id>\t<content>' line per memory hint
//   [TOOL SCHEMAS]  one '<name>\t<description>' line per tool, name-sorted (§1.3)
//   [CONTEXT]       'URL: <url>\nTITLE: <title>\n<body>' + history turns as
//                   'TURN <ts>: <text>' lines (Phase 7 supplies the turns)
import type { PromptSection } from '../ai/types';
import type { Summarizer } from './types';
import { countTokensHeuristic } from './TokenBudget';

/** §2.4 rung 4 constant: keep the first 40% of body chars after the URL/TITLE header. */
export const STRUCTURAL_COMPRESS_RATIO = 0.4;

/**
 * §2.4 rung 4 — structural-compress a [CONTEXT] section to its structured
 * fields: the URL/TITLE header + the first STRUCTURAL_COMPRESS_RATIO of body
 * chars. Recomputes tokens via the heuristic counter; returns a valid A8
 * section (int tokens ≥ 0, Pitfall 5). Non-[CONTEXT] sections pass through.
 */
export function compressStructural(section: PromptSection): PromptSection {
  if (section.kind !== 'CONTEXT') return section;
  const lines = section.text.split('\n');
  const header: string[] = [];
  const body: string[] = [];
  for (const line of lines) {
    if (line.startsWith('URL: ') || line.startsWith('TITLE: ')) header.push(line);
    else body.push(line);
  }
  const bodyText = body.join('\n');
  const keep = Math.ceil(bodyText.length * STRUCTURAL_COMPRESS_RATIO);
  const text = [...header, bodyText.slice(0, keep)].join('\n');
  return { ...section, text, tokens: countTokensHeuristic(text) };
}

/**
 * §2.4 rung 6 — memory top-k: keeps the first k lines of the [MEMORY] section,
 * drops the rest. No-op when the section already has ≤ k lines. Non-[MEMORY]
 * sections pass through.
 */
export function reduceTopK(sections: PromptSection[], k: number): PromptSection[] {
  return sections.map((section) => {
    if (section.kind !== 'MEMORY') return section;
    const kept = section.text.split('\n').slice(0, k);
    const text = kept.join('\n');
    if (text === section.text) return section;
    return { ...section, text, tokens: countTokensHeuristic(text) };
  });
}

/**
 * §2.4 rung 5 — filter the [TOOL SCHEMAS] section to lines whose tab-prefixed
 * name is in inScopeTools. Non-[TOOL SCHEMAS] sections pass through.
 */
export function trimToolSchemas(
  sections: PromptSection[],
  inScopeTools: readonly string[],
): PromptSection[] {
  const inScope = new Set(inScopeTools);
  return sections.map((section) => {
    if (section.kind !== 'TOOL SCHEMAS') return section;
    const kept = section.text
      .split('\n')
      .filter((line) => inScope.has(line.split('\t')[0]));
    const text = kept.join('\n');
    return { ...section, text, tokens: countTokensHeuristic(text) };
  });
}

/**
 * §2.4 rung 3 — history summarisation seam (D-75).
 *
 * Operates on the history portion of [CONTEXT] sections ('TURN <ts>: <text>'
 * lines). With a Summarizer: replaces the history lines with its { text, tokens }
 * (compression type 'summarise'). Without one: DROPS older turns (keeps the
 * last 2) and returns truncated: true — drop-not-silence. Phase-5 assemble has
 * no history turns (the §2.3 input has no history source), so this is a no-op
 * there; the seam + fallback are unit-tested in 05-02.
 */
export function summarizeHistory(
  sections: PromptSection[],
  summarizer?: Summarizer,
): { sections: PromptSection[]; truncated: boolean } {
  let truncated = false;
  const out = sections.map((section) => {
    if (section.kind !== 'CONTEXT') return section;
    const lines = section.text.split('\n');
    const turnIndexes: number[] = [];
    lines.forEach((line, index) => {
      if (line.startsWith('TURN ')) turnIndexes.push(index);
    });
    if (turnIndexes.length === 0) return section;

    const firstTurn = turnIndexes[0];
    const lastTurn = turnIndexes[turnIndexes.length - 1];
    const header = lines.slice(0, firstTurn);
    const turns = lines.slice(firstTurn, lastTurn + 1);
    const tail = lines.slice(lastTurn + 1);
    truncated = true;

    if (summarizer) {
      const summary = summarizer.summarize([{ ...section, text: turns.join('\n') }]);
      const text = [...header, summary.text, ...tail].join('\n');
      return { ...section, text, tokens: summary.tokens };
    }

    // No summarizer — keep the last 2 turns, drop the rest (recorded, not silent).
    const keptTurns = turns.slice(-2);
    const text = [...header, ...keptTurns, ...tail].join('\n');
    return { ...section, text, tokens: countTokensHeuristic(text) };
  });
  return { sections: out, truncated };
}