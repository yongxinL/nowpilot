import { describe, it, expect, vi } from 'vitest';
import {
  compressStructural,
  reduceTopK,
  trimToolSchemas,
  summarizeHistory,
  STRUCTURAL_COMPRESS_RATIO,
} from '@/core/context/ContextCompressor';
import { CompressionTypeSchema } from '@/core/context/ContextProvenanceManifest';
import { PromptSectionSchema, type PromptSection } from '@/core/ai/types';
import type { CompressionType, Summarizer } from '@/core/context/types';
import { countTokensHeuristic } from '@/core/context/TokenBudget';

/**
 * ContextCompressor contract tests (plan 05-02, Task 2) — §18-required
 * tests/core/context/ContextCompressor.test.ts (spec 2597). Pure module tests,
 * no chrome mocks (TrajectoryTracker.test.ts style): the D-75 proofs — the
 * structural / top-k / tool-trim strategies and the summarizer-seam
 * drop-not-silence fallback, on crafted A8 PromptSection fixtures following the
 * LOCKED section text conventions ([MEMORY] '<id>\t<content>', [TOOL SCHEMAS]
 * '<name>\t<description>' name-sorted, [CONTEXT] 'URL: <url>\nTITLE:
 * <title>\n<body>' + 'TURN <ts>: <text>' history lines).
 */

/** A8 fixture builder — every field overridable, defaults harmless (kind MEMORY, empty). */
function section(overrides: Partial<PromptSection> = {}): PromptSection {
  return { kind: 'MEMORY', text: '', stable: false, tokens: 0, ...overrides };
}

describe('compressStructural — §2.4 rung 4 structural page/case compression (D-75)', () => {
  it('keeps the URL/TITLE header plus the first 40% of body chars, tokens recomputed (Pitfall 5)', () => {
    expect(STRUCTURAL_COMPRESS_RATIO).toBe(0.4);
    const longBody = 'x'.repeat(1000);
    const input = section({
      kind: 'CONTEXT',
      text: `URL: https://example.com\nTITLE: Example Page\n${longBody}`,
    });

    const out = compressStructural(input);

    expect(out.kind).toBe('CONTEXT');
    expect(out.text).toContain('URL: https://example.com');
    expect(out.text).toContain('TITLE: Example Page');
    // keep = ceil(1000 * 0.4) = 400 body chars — the tail is gone.
    expect(out.text).toContain('x'.repeat(400));
    expect(out.text).not.toContain('x'.repeat(401));
    // tokens recomputed from the compressed text, an integer >= 0.
    expect(out.tokens).toBe(countTokensHeuristic(out.text));
    expect(Number.isInteger(out.tokens)).toBe(true);
    expect(out.tokens).toBeGreaterThanOrEqual(0);
  });
});

describe('reduceTopK — §2.4 rung 6 memory top-k (D-75)', () => {
  const memory5 = section({
    kind: 'MEMORY',
    text: ['m1\ta', 'm2\tb', 'm3\tc', 'm4\td', 'm5\te'].join('\n'),
  });

  it('k=2 keeps exactly the first 2 lines', () => {
    const [out] = reduceTopK([memory5], 2);
    expect(out.text.split('\n')).toEqual(['m1\ta', 'm2\tb']);
    expect(out.tokens).toBe(countTokensHeuristic('m1\ta\nm2\tb'));
  });

  it('k=0 yields an empty-text section with 0 tokens', () => {
    const [out] = reduceTopK([memory5], 0);
    expect(out.text).toBe('');
    expect(out.tokens).toBe(0);
  });
});

describe('trimToolSchemas — §2.4 rung 5 in-scope tool filter (D-75)', () => {
  it('keeps only the in-scope tool line and preserves name order', () => {
    const tools = section({
      kind: 'TOOL SCHEMAS',
      text: ['toolA\tdesc a', 'toolB\tdesc b', 'toolC\tdesc c'].join('\n'),
    });

    const [out] = trimToolSchemas([tools], ['toolB']);

    expect(out.text.split('\n')).toEqual(['toolB\tdesc b']);
  });
});

describe('summarizeHistory — §2.4 rung 3 summarizer seam (D-75)', () => {
  const contextWithTurns = section({
    kind: 'CONTEXT',
    text: [
      'URL: https://example.com',
      'TITLE: Example',
      'TURN 1: first turn',
      'TURN 2: second turn',
      'TURN 3: third turn',
      'TURN 4: fourth turn',
      'trailing note',
    ].join('\n'),
  });

  it('with a Summarizer: replaces the history turns with { text, tokens } and reports truncated', () => {
    const summarizer: Summarizer = {
      summarize: vi.fn().mockReturnValue({ text: 'HISTORY SUMMARY', tokens: 9 }),
    };

    const result = summarizeHistory([contextWithTurns], summarizer);

    expect(result.truncated).toBe(true);
    const out = result.sections[0];
    expect(out.kind).toBe('CONTEXT');
    expect(out.text).toContain('HISTORY SUMMARY');
    expect(out.text).not.toContain('TURN 1: first turn');
    expect(out.text).not.toContain('TURN 4: fourth turn');
    expect(out.tokens).toBe(9);
    expect(summarizer.summarize).toHaveBeenCalledTimes(1);
  });

  it('without a Summarizer: DROPS older turns (keeps the last 2) and reports truncated — drop-not-silence', () => {
    const result = summarizeHistory([contextWithTurns]);

    expect(result.truncated).toBe(true); // never a silent drop
    const out = result.sections[0];
    const lines = out.text.split('\n');
    expect(lines[0]).toBe('URL: https://example.com');
    expect(lines).toContain('TURN 3: third turn');
    expect(lines).toContain('TURN 4: fourth turn');
    expect(lines).not.toContain('TURN 1: first turn');
    expect(lines).not.toContain('TURN 2: second turn');
    expect(lines[lines.length - 1]).toBe('trailing note'); // non-history tail preserved
  });
});

describe('CompressionType — §2.6 closed union (no fourth value can be added silently)', () => {
  const compressionTypeValues = ['summarise', 'structural', 'topk'] as const;

  // Bidirectional compile-time closure: if a 4th literal is added to either the
  // type or the const array alone, one of these consts stops type-checking and
  // the gate's tsc --noEmit goes red.
  type AssertForward = CompressionType extends (typeof compressionTypeValues)[number] ? true : false;
  const assertForward: AssertForward = true;
  type AssertReverse = (typeof compressionTypeValues)[number] extends CompressionType ? true : false;
  const assertReverse: AssertReverse = true;

  it('the manifest CompressionTypeSchema accepts exactly the three §2.6 literals', () => {
    expect(assertForward).toBe(true);
    expect(assertReverse).toBe(true);
    expect(CompressionTypeSchema.safeParse('summarise').success).toBe(true);
    expect(CompressionTypeSchema.safeParse('structural').success).toBe(true);
    expect(CompressionTypeSchema.safeParse('topk').success).toBe(true);
    expect(CompressionTypeSchema.safeParse('compress-everything').success).toBe(false);
  });
});

describe('A8 shape validity — every strategy output is a schema-valid PromptSection (Pitfall 5)', () => {
  const longBody = 'x'.repeat(1000);
  const contextSection = section({
    kind: 'CONTEXT',
    text: `URL: https://example.com\nTITLE: Example Page\n${longBody}`,
  });
  const memory5 = section({
    kind: 'MEMORY',
    text: ['m1\ta', 'm2\tb', 'm3\tc', 'm4\td', 'm5\te'].join('\n'),
  });
  const tools = section({
    kind: 'TOOL SCHEMAS',
    text: ['toolA\tdesc a', 'toolB\tdesc b', 'toolC\tdesc c'].join('\n'),
  });
  const contextWithTurns = section({
    kind: 'CONTEXT',
    text: [
      'URL: https://example.com',
      'TITLE: Example',
      'TURN 1: first turn',
      'TURN 2: second turn',
      'TURN 3: third turn',
      'TURN 4: fourth turn',
    ].join('\n'),
  });

  it('structural output validates (tokens non-negative integers)', () => {
    expect(PromptSectionSchema.safeParse(compressStructural(contextSection)).success).toBe(true);
  });

  it('top-k outputs validate, including the k=0 empty section', () => {
    for (const out of reduceTopK([memory5], 2)) {
      expect(PromptSectionSchema.safeParse(out).success).toBe(true);
    }
    for (const out of reduceTopK([memory5], 0)) {
      expect(PromptSectionSchema.safeParse(out).success).toBe(true);
    }
  });

  it('tool-trim output validates', () => {
    for (const out of trimToolSchemas([tools], ['toolB'])) {
      expect(PromptSectionSchema.safeParse(out).success).toBe(true);
    }
  });

  it('summarizer-seam outputs validate in both branches', () => {
    const summarizer: Summarizer = {
      summarize: () => ({ text: 'SUMMARY', tokens: 5 }),
    };
    for (const out of summarizeHistory([contextWithTurns], summarizer).sections) {
      expect(PromptSectionSchema.safeParse(out).success).toBe(true);
    }
    for (const out of summarizeHistory([contextWithTurns]).sections) {
      expect(PromptSectionSchema.safeParse(out).success).toBe(true);
    }
  });
});