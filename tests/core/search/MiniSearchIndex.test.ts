import { describe, it, expect, beforeEach } from 'vitest';
import type { UserMemoryFact } from '../../../src/core/memory/memoryTypes';
import { MiniSearchIndex } from '../../../src/core/search/MiniSearchIndex';

function makeFact(overrides: Partial<UserMemoryFact> = {}): UserMemoryFact {
  const now = Date.now();
  return {
    id: `fact-${Math.random().toString(36).slice(2, 8)}`,
    fact: 'test fact content',
    category: 'general',
    confidence: 0.8,
    created: now,
    updated: now,
    source: 'test',
    status: 'active',
    tags: ['test'],
    useCount: 0,
    lastUsedAt: now,
    ...overrides,
  };
}

describe('MiniSearchIndex', () => {
  let index: MiniSearchIndex;

  beforeEach(() => {
    index = new MiniSearchIndex();
  });

  describe('search', () => {
    it('should return ranked results with prefix matching — TypeScript fact scores higher than scripting', () => {
      const tsFact = makeFact({
        id: 'ts-1',
        fact: 'I love TypeScript',
        category: 'programming',
        tags: ['typescript', 'language'],
      });
      const scriptFact = makeFact({
        id: 'script-1',
        fact: 'Basic scripting with shell',
        category: 'programming',
        tags: ['shell', 'scripting'],
      });
      index.addFact(tsFact);
      index.addFact(scriptFact);

      const results = index.search('typescript');
      expect(results.length).toBeGreaterThanOrEqual(1);
      // The TypeScript fact should be ranked first (higher keyword score)
      expect(results[0].id).toBe('ts-1');
    });

    it('should return results with fuzzy matching — TypeScrpit finds TypeScript facts', () => {
      const tsFact = makeFact({
        id: 'ts-2',
        fact: 'I love TypeScript',
        category: 'programming',
        tags: ['typescript'],
      });
      index.addFact(tsFact);

      // Fuzzy match: "TypeScrpit" is a typo of "TypeScript"
      const results = index.search('TypeScrpit');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((r) => r.id === 'ts-2')).toBe(true);
    });

    it('should respect the limit parameter — search(query, 10) returns at most 10 results', () => {
      for (let i = 0; i < 25; i++) {
        index.addFact(
          makeFact({
            id: `lim-${i}`,
            fact: `This is fact number ${i} about programming concepts`,
            category: 'programming',
            tags: ['programming'],
          }),
        );
      }

      const results = index.search('programming', 10);
      expect(results.length).toBeLessThanOrEqual(10);
    });
  });

  describe('addFact', () => {
    it('should store a fact and make it searchable immediately', () => {
      const fact = makeFact({
        id: 'add-1',
        fact: 'JavaScript is dynamically typed',
        category: 'programming',
        tags: ['javascript'],
      });
      index.addFact(fact);

      const results = index.search('JavaScript');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results.some((r) => r.id === 'add-1')).toBe(true);
    });
  });

  describe('replaceFact', () => {
    it('should update an existing fact — old content no longer searchable, new content is', () => {
      const fact = makeFact({
        id: 'replace-1',
        fact: 'Old content about Python',
        category: 'programming',
        tags: ['python'],
      });
      index.addFact(fact);

      // Search for old content
      const beforeResults = index.search('Python');
      expect(beforeResults.some((r) => r.id === 'replace-1')).toBe(true);

      // Replace with new content
      const updatedFact = { ...fact, fact: 'New content about Rust', tags: ['rust'] };
      index.replaceFact(updatedFact);

      // Old content should no longer match
      const afterOldResults = index.search('Python');
      expect(afterOldResults.some((r) => r.id === 'replace-1')).toBe(false);

      // New content should match
      const afterNewResults = index.search('Rust');
      expect(afterNewResults.some((r) => r.id === 'replace-1')).toBe(true);
    });
  });

  describe('removeFact', () => {
    it('should remove a fact — subsequent search does not return it', () => {
      const fact = makeFact({
        id: 'remove-1',
        fact: 'React is a UI library',
        category: 'programming',
        tags: ['react', 'frontend'],
      });
      index.addFact(fact);

      // Verify it's searchable
      const beforeResults = index.search('React');
      expect(beforeResults.some((r) => r.id === 'remove-1')).toBe(true);

      // Remove it
      index.removeFact('remove-1');

      // Should no longer be searchable
      const afterResults = index.search('React');
      expect(afterResults.some((r) => r.id === 'remove-1')).toBe(false);
    });
  });

  describe('rebuild', () => {
    it('should clear all existing facts and re-add from array — old facts gone, only new facts present', () => {
      // Add some initial facts
      index.addFact(
        makeFact({ id: 'old-1', fact: 'Old fact about Vue', category: 'frontend', tags: ['vue'] }),
      );
      index.addFact(
        makeFact({
          id: 'old-2',
          fact: 'Another old fact about Angular',
          category: 'frontend',
          tags: ['angular'],
        }),
      );

      // Rebuild with new facts
      const newFacts = [
        makeFact({
          id: 'new-1',
          fact: 'New fact about Svelte',
          category: 'frontend',
          tags: ['svelte'],
        }),
        makeFact({
          id: 'new-2',
          fact: 'New fact about Solid',
          category: 'frontend',
          tags: ['solid'],
        }),
      ];
      index.rebuild(newFacts);

      // Old facts should be gone
      const vueResults = index.search('Vue');
      expect(vueResults.some((r) => r.id === 'old-1')).toBe(false);

      // New facts should be searchable
      const svelteResults = index.search('Svelte');
      expect(svelteResults.some((r) => r.id === 'new-1')).toBe(true);
      const solidResults = index.search('Solid');
      expect(solidResults.some((r) => r.id === 'new-2')).toBe(true);
    });
  });
});
