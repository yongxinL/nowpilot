/**
 * schemas.test.ts — LLM-Wiki Zod schemas + gateSuggestions (LLM-WIKI-11,
 * CAT-01/05, Appendix C.1 spec 4764-4786).
 *
 * Validates:
 *   - NoteTagResultSchema shape enforcement
 *   - NoteQAResultSchema shape enforcement
 *   - NoteDraftSchema shape enforcement
 *   - gateSuggestions: threshold gating (drop < 0.60)
 *   - gateSuggestions: cap enforcement (max 5 tags / 3 facts)
 *   - gateSuggestions: descending confidence sort
 *   - normalizeCategoryPath: strip/collapse/trim/reject
 */

import { describe, it, expect } from 'vitest';
import {
  NoteTagResultSchema,
  NoteQAResultSchema,
  NoteDraftSchema,
  gateSuggestions,
  normalizeCategoryPath,
} from '../../../src/core/notes/schemas';
import {
  NOTE_SUGGESTION_DISPLAY_THRESHOLD,
  NOTE_SUGGESTION_MAX_TAGS_PER_SAVE,
  NOTE_SUGGESTION_MAX_FACTS_PER_SAVE,
} from '../../../src/types/notes';

describe('NoteTagResultSchema (LLM-WIKI-01)', () => {
  it('accepts valid structured output', () => {
    const result = NoteTagResultSchema.safeParse({
      tags: [
        { value: 'svc', confidence: 0.95 },
        { value: 'incident', confidence: 0.80 },
      ],
      categoryPath: 'ServiceNow/Incidents',
      summary: 'A note about incident handling.',
      memoryFacts: [
        { content: 'User prefers concise answers', confidence: 0.70 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects confidence outside [0,1]', () => {
    const result = NoteTagResultSchema.safeParse({
      tags: [{ value: 'svc', confidence: 1.5 }],
      categoryPath: null,
      summary: '',
      memoryFacts: [],
    });
    expect(result.success).toBe(false);
  });

  it('defaults memoryFacts to [] when omitted', () => {
    const result = NoteTagResultSchema.safeParse({
      tags: [],
      categoryPath: null,
      summary: 'No facts.',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memoryFacts).toEqual([]);
    }
  });

  it('rejects more than 10 tags', () => {
    const tags = Array.from({ length: 11 }, (_, i) => ({ value: `t${i}`, confidence: 0.9 }));
    const result = NoteTagResultSchema.safeParse({
      tags,
      categoryPath: null,
      summary: '',
      memoryFacts: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('NoteQAResultSchema (LLM-WIKI-06)', () => {
  it('accepts valid QA output with citations', () => {
    const result = NoteQAResultSchema.safeParse({
      answer: 'The answer is 42.',
      citations: [
        { noteId: 'n1', title: 'Note One', snippet: 'relevant excerpt' },
      ],
      confidence: 0.85,
    });
    expect(result.success).toBe(true);
  });

  it('rejects more than 5 citations', () => {
    const citations = Array.from({ length: 6 }, (_, i) => ({
      noteId: `n${i}`,
      title: `Note ${i}`,
      snippet: 'snippet',
    }));
    const result = NoteQAResultSchema.safeParse({
      answer: 'Answer',
      citations,
      confidence: 0.5,
    });
    expect(result.success).toBe(false);
  });
});

describe('NoteDraftSchema (LLM-WIKI-07)', () => {
  it('accepts valid draft output', () => {
    const result = NoteDraftSchema.safeParse({
      title: 'Draft Title',
      content: 'Draft content with [[wikilink]].',
      tags: ['draft'],
      wikilinks: ['wikilink'],
      categoryPath: 'Projects',
      summary: 'A draft.',
    });
    expect(result.success).toBe(true);
  });

  it('defaults tags and wikilinks to [] when omitted', () => {
    const result = NoteDraftSchema.safeParse({
      title: 'Title',
      content: 'Content',
      categoryPath: null,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tags).toEqual([]);
      expect(result.data.wikilinks).toEqual([]);
    }
  });
});

describe('gateSuggestions (LLM-WIKI-11)', () => {
  const baseResult = {
    tags: [
      { value: 'high', confidence: 0.95 },
      { value: 'medium', confidence: 0.75 },
      { value: 'low', confidence: 0.05 },
      { value: 'borderline', confidence: 0.60 },
      { value: 'just-under', confidence: 0.59 },
      { value: 'zero', confidence: 0.0 },
    ],
    categoryPath: null,
    summary: '',
    memoryFacts: [
      { content: 'fact-high', confidence: 0.90 },
      { content: 'fact-medium', confidence: 0.70 },
      { content: 'fact-low', confidence: 0.50 },
      { content: 'fact-borderline', confidence: 0.60 },
    ],
  };

  it('discards items below NOTE_SUGGESTION_DISPLAY_THRESHOLD (0.60)', () => {
    const gated = gateSuggestions(baseResult);
    // Tags: 0.95, 0.75, 0.60 pass (>= 0.60); 0.59, 0.05, 0.0 fail.
    expect(gated.tags).toContain('high');
    expect(gated.tags).toContain('medium');
    expect(gated.tags).toContain('borderline');
    expect(gated.tags).not.toContain('just-under');
    expect(gated.tags).not.toContain('low');
    expect(gated.tags).not.toContain('zero');
  });

  it('enforces max 5 tags per save', () => {
    const manyTags = Array.from({ length: 10 }, (_, i) => ({
      value: `tag-${i}`,
      confidence: 0.9 - i * 0.01, // all above 0.60
    }));
    const gated = gateSuggestions({ ...baseResult, tags: manyTags });
    expect(gated.tags.length).toBeLessThanOrEqual(NOTE_SUGGESTION_MAX_TAGS_PER_SAVE);
    expect(gated.tags.length).toBe(5);
  });

  it('enforces max 3 facts per save', () => {
    const manyFacts = Array.from({ length: 8 }, (_, i) => ({
      content: `fact-${i}`,
      confidence: 0.95 - i * 0.01, // all above 0.60
    }));
    const gated = gateSuggestions({ ...baseResult, memoryFacts: manyFacts });
    expect(gated.memoryFacts.length).toBeLessThanOrEqual(NOTE_SUGGESTION_MAX_FACTS_PER_SAVE);
    expect(gated.memoryFacts.length).toBe(3);
  });

  it('sorts descending confidence', () => {
    const gated = gateSuggestions(baseResult);
    // Tags should be in descending confidence order.
    expect(gated.tags[0]).toBe('high'); // 0.95
    expect(gated.tags[1]).toBe('medium'); // 0.75
    expect(gated.tags[2]).toBe('borderline'); // 0.60
  });

  it('exports correct threshold constant', () => {
    expect(NOTE_SUGGESTION_DISPLAY_THRESHOLD).toBe(0.60);
  });
});

describe('normalizeCategoryPath (CAT-01/05)', () => {
  it('strips leading/trailing slashes', () => {
    expect(normalizeCategoryPath('/foo/bar/')).toBe('foo/bar');
  });

  it('collapses duplicate slashes', () => {
    expect(normalizeCategoryPath('foo//bar///baz')).toBe('foo/bar/baz');
  });

  it('trims segments', () => {
    expect(normalizeCategoryPath(' foo / bar ')).toBe('foo/bar');
  });

  it('returns null for null input', () => {
    expect(normalizeCategoryPath(null)).toBeNull();
  });

  it('returns null for empty/whitespace input', () => {
    expect(normalizeCategoryPath('')).toBeNull();
    expect(normalizeCategoryPath('   ')).toBeNull();
  });

  it('drops empty segments from leading/trailing slashes', () => {
    expect(normalizeCategoryPath('/')).toBeNull();
    expect(normalizeCategoryPath('///')).toBeNull();
  });

  it('rejects "." and ".." segments', () => {
    expect(normalizeCategoryPath('foo/./bar')).toBe('foo/bar');
    expect(normalizeCategoryPath('foo/../bar')).toBe('foo/bar');
  });

  it('handles single segment', () => {
    expect(normalizeCategoryPath('Projects')).toBe('Projects');
  });
});
