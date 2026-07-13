import { describe, it, expect, beforeEach } from 'vitest';
import { LinkParser } from '../../../src/core/notes/LinkParser';
import type { Note } from '../../../src/core/notes/LinkParser';

// MiniSearch works in Node.js (pure JS, no DOM needed)
// These tests run in vitest/jsdom environment

function makeNote(overrides: Partial<Note> = {}): Note {
  const now = Date.now();
  return {
    id: `note-${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Note',
    content: 'Test content',
    created: now,
    updated: now,
    tags: [],
    ...overrides,
  };
}

describe('LinkParser', () => {
  let parser: LinkParser;

  beforeEach(() => {
    parser = new LinkParser();
  });

  describe('parseLinks', () => {
    it('should parse [[hello]] as single wikilink', () => {
      const result = parser.parseLinks('[[hello]]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        title: 'hello',
        alias: 'hello',
        raw: '[[hello]]',
      });
    });

    it('should parse [[hello|world]] with alias', () => {
      const result = parser.parseLinks('[[hello|world]]');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        title: 'hello',
        alias: 'world',
        raw: '[[hello|world]]',
      });
    });

    it('should parse multiple wikilinks in one string', () => {
      const result = parser.parseLinks('[[a]] and [[b|c]]');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ title: 'a', alias: 'a', raw: '[[a]]' });
      expect(result[1]).toEqual({ title: 'b', alias: 'c', raw: '[[b|c]]' });
    });

    it('should return empty array when no wikilinks present', () => {
      const result = parser.parseLinks('no wikilinks here');
      expect(result).toEqual([]);
    });

    it('should handle edge cases: empty brackets, malformed input', () => {
      // Empty brackets — no match inside
      expect(parser.parseLinks('[[]]')).toEqual([]);
      // Nested brackets
      expect(parser.parseLinks('[[outer [[inner]]]]')).toHaveLength(1);
      // Just opening bracket
      expect(parser.parseLinks('no closing [[ bracket')).toEqual([]);
      // Triple brackets
      expect(parser.parseLinks('[[[test]]]')).toHaveLength(1);
    });
  });

  describe('resolve', () => {
    it('should find exact title match', async () => {
      const notes = [
        makeNote({ id: 'n1', title: 'My Note' }),
        makeNote({ id: 'n2', title: 'Other Note' }),
      ];
      const result = await parser.resolve('My Note', notes);
      expect(result).toEqual({ found: true, noteId: 'n1' });
    });

    it('should find case-insensitive match when exact fails', async () => {
      const notes = [
        makeNote({ id: 'n1', title: 'My Note' }),
        makeNote({ id: 'n2', title: 'OTHER' }),
      ];
      const result = await parser.resolve('my note', notes);
      expect(result).toEqual({ found: true, noteId: 'n1' });
    });

    it('should return ambiguous with candidates for multiple fuzzy matches', async () => {
      const notes = [
        makeNote({ id: 'n1', title: 'JavaScript Guide', content: 'JS programming' }),
        makeNote({ id: 'n2', title: 'Java Basics', content: 'Java programming' }),
        makeNote({ id: 'n3', title: 'TypeScript Handbook', content: 'TS programming' }),
      ];
      // Rebuild index so MiniSearch has data
      parser.rebuildIndex(notes);
      const result = await parser.resolve('Java', notes);
      // "Java" should fuzzy match both "JavaScript Guide" and "Java Basics"
      expect(result.found).toBe(false);
      expect(result.ambiguous).toBe(true);
      expect(result.candidates).toBeDefined();
      expect(result.candidates!.length).toBeGreaterThan(1);
    });

    it('should return not found when no match exists', async () => {
      const notes = [
        makeNote({ id: 'n1', title: 'TypeScript' }),
        makeNote({ id: 'n2', title: 'Rust' }),
      ];
      parser.rebuildIndex(notes);
      const result = await parser.resolve('Python', notes);
      expect(result).toEqual({ found: false, ambiguous: false });
    });
  });

  describe('buildBacklinks', () => {
    it('should compute correct backlinks between notes', () => {
      const notes = [
        makeNote({ id: 'n1', title: 'Alpha', content: 'See [[Beta]] and [[Gamma|G]]' }),
        makeNote({ id: 'n2', title: 'Beta', content: 'Related to [[Alpha]]' }),
        makeNote({ id: 'n3', title: 'Gamma', content: 'No links here' }),
      ];
      const backlinks = parser.buildBacklinks(notes);
      // Beta should have backlink from Alpha and Gamma from Alpha
      expect(backlinks.has('n2')).toBe(true);
      expect(backlinks.has('n3')).toBe(true);
      // Alpha should have backlink from Beta
      expect(backlinks.has('n1')).toBe(true);
      const alphaBacklinks = backlinks.get('n1')!;
      expect(alphaBacklinks.some((b) => b.noteId === 'n2')).toBe(true);
    });

    it('should return empty map when no wikilinks exist', () => {
      const notes = [
        makeNote({ id: 'n1', title: 'Alpha', content: 'Plain text' }),
        makeNote({ id: 'n2', title: 'Beta', content: 'More text' }),
      ];
      const backlinks = parser.buildBacklinks(notes);
      expect(backlinks.size).toBe(0);
    });
  });

  describe('rebuildIndex and search', () => {
    it('should populate MiniSearch and return ranked results', () => {
      const notes = [
        makeNote({ id: 'n1', title: 'TypeScript Tips', content: 'TypeScript is great for type safety' }),
        makeNote({ id: 'n2', title: 'JavaScript', content: 'JS is flexible' }),
        makeNote({ id: 'n3', title: 'React Components', content: 'Using React with TypeScript' }),
      ];
      parser.rebuildIndex(notes);
      const results = parser.search('TypeScript');
      expect(results.length).toBeGreaterThanOrEqual(1);
      // n1 has "TypeScript" in title (boosted) and content — should rank higher
      expect(results.some((r) => r.id === 'n1')).toBe(true);
    });

    it('should update index with addToIndex and removeFromIndex', () => {
      const note = makeNote({ id: 'idx-1', title: 'Unique Title', content: 'Unique content here' });
      parser.rebuildIndex([]);
      parser.addToIndex(note);
      let results = parser.search('Unique');
      expect(results.some((r) => r.id === 'idx-1')).toBe(true);

      parser.removeFromIndex('idx-1');
      results = parser.search('Unique');
      expect(results.some((r) => r.id === 'idx-1')).toBe(false);
    });
  });
});
