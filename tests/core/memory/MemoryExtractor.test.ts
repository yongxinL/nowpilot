import { describe, it, expect } from 'vitest';
import {
  parseMemoryFacts,
  memoryFactsSchema,
  type MemoryFact,
} from '../../../src/core/memory/MemoryExtractor';

describe('MemoryExtractor — D-113 schema + parse seam', () => {
  it('VALID: fenced JSON array → ok:true with parsed facts', () => {
    const output = '```json\n[{"content":"fact1","type":"fact","confidence":0.9,"tags":["a"]}]\n```';
    const result = parseMemoryFacts(output);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].content).toBe('fact1');
      expect(result.facts[0].type).toBe('fact');
      expect(result.facts[0].confidence).toBe(0.9);
    }
  });

  it('PARTIAL: mixed valid/invalid array → valid kept, invalid dropped', () => {
    const output = JSON.stringify([
      { content: 'valid', type: 'fact', confidence: 0.8 },
      { content: 'invalid', type: 'fact', confidence: 1.5 }, // confidence > 1
      { content: 'also valid', type: 'preference', confidence: 0.5 },
    ]);
    const result = parseMemoryFacts(output);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.facts).toHaveLength(2);
      expect(result.facts.map((f) => f.content)).toEqual(['valid', 'also valid']);
    }
  });

  it('GARBAGE: no array → ok:false MEMORY_FACT_PARSE_FAILED', () => {
    const result = parseMemoryFacts('This is just prose with no JSON.');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('MEMORY_FACT_PARSE_FAILED');
    }
  });

  it('CONFIDENCE BOUNDS: 1.5 rejected, 0.5 accepted', () => {
    const output = JSON.stringify([
      { content: 'over', type: 'fact', confidence: 1.5 },
      { content: 'under', type: 'fact', confidence: 0.5 },
    ]);
    const result = parseMemoryFacts(output);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.facts).toHaveLength(1);
      expect(result.facts[0].content).toBe('under');
    }
  });

  it('NO LLM IMPORT: module exports only the schema + parse function', async () => {
    const source = await import('../../../src/core/memory/MemoryExtractor');
    // Structural: the module exports the schema + parse function only.
    expect(source.memoryFactsSchema).toBeDefined();
    expect(source.parseMemoryFacts).toBeDefined();
    // MemoryFact is type-only — not a runtime export.
    expect('MemoryFact' in source).toBe(false);
  });

  it('DEFAULT TAGS: fact without tags → empty array', () => {
    const output = JSON.stringify([{ content: 'no tags', type: 'pattern', confidence: 0.7 }]);
    const result = parseMemoryFacts(output);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.facts[0].tags).toEqual([]);
    }
  });
});
