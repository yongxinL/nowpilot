import { describe, it, expect } from 'vitest';
import {
  WEIGHTS,
  MIN_SCORE,
  USE_COUNT_CAP,
  TIER_LIMITS,
  tokenizeQuery,
  scoreFact,
  getTopFacts,
} from '../../../src/core/memory/MemoryScorer';
import {
  MemoryRecordSchema,
  UserMemoryFactSchema,
  ConversationSummarySchema,
  PreferenceRecordSchema,
  RetrievedMemorySchema,
  ConversationContextSchema,
  ConfidenceSourceSchema,
  CONFIDENCE_MAP,
  type UserMemoryFact,
} from '../../../src/core/memory/MemoryRecord';

const NOW = 1_700_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * DAY_MS;

function makeFact(overrides: Partial<UserMemoryFact> = {}): UserMemoryFact {
  return {
    id: crypto.randomUUID(),
    content: 'keyword match test',
    memoryType: 'semantic',
    tags: ['keyword'],
    confidence: 0.8,
    source: 'verified-state',
    useCount: 0,
    sensitivity: 'private',
    createdAt: NOW - 10 * DAY_MS,
    updatedAt: NOW,
    ...overrides,
  };
}

describe('tokenizeQuery', () => {
  it('lowercases, splits on whitespace, drops empty and single-char terms', () => {
    expect(tokenizeQuery('Hello WORLD  a  bb')).toEqual(['hello', 'world', 'bb']);
  });

  it('returns empty array for empty or whitespace-only query', () => {
    expect(tokenizeQuery('')).toEqual([]);
    expect(tokenizeQuery('   ')).toEqual([]);
  });
});

describe('scoreFact — D-08 weighted formula', () => {
  it('computes keyword + tag + recency + confidence + useCount components (Test 1)', () => {
    const fact = makeFact({ updatedAt: NOW });
    const score = scoreFact(fact, ['keyword', 'match'], NOW);
    // keywordScore=1.0 (2/2 terms in content), tagScore=1.0 (1/1 tag),
    // recency=1.0, confidence=0.8, useCount=0.0
    expect(score).toBeCloseTo(1.0 * 0.35 + 1.0 * 0.25 + 1.0 * 0.2 + 0.8 * 0.1 + 0.0, 6);
  });

  it('empty query terms → keyword=0 and tag=0, composite from recency+confidence+useCount only (Test 2)', () => {
    const fact = makeFact({ updatedAt: NOW, useCount: 10 });
    const score = scoreFact(fact, [], NOW);
    expect(score).toBeCloseTo(0 + 0 + 1.0 * 0.2 + 0.8 * 0.1 + 0.5 * 0.1, 6);
  });

  it('recency is linear decay over 30 days (Test 3)', () => {
    const fresh = makeFact({ updatedAt: NOW });
    const mid = makeFact({ updatedAt: NOW - 15 * DAY_MS });
    const stale = makeFact({ updatedAt: NOW - 31 * DAY_MS });
    const scoreFresh = scoreFact(fresh, [], NOW);
    const scoreMid = scoreFact(mid, [], NOW);
    const scoreStale = scoreFact(stale, [], NOW);
    // recency 1.0 vs ~0.5 vs 0 with everything else identical
    const base = 0.8 * 0.1; // confidence contribution
    expect(scoreFresh).toBeCloseTo(1.0 * 0.2 + base, 6);
    expect(scoreMid).toBeCloseTo(0.5 * 0.2 + base, 6);
    expect(scoreStale).toBeCloseTo(0.0 * 0.2 + base, 6);
  });

  it('useCountScore is capped at USE_COUNT_CAP (Test 4)', () => {
    const base = { ...makeFact(), updatedAt: NOW - 31 * DAY_MS }; // recency 0
    const zero = scoreFact({ ...base, confidence: 0, useCount: 0 }, [], NOW);
    const ten = scoreFact({ ...base, confidence: 0, useCount: 10 }, [], NOW);
    const twenty = scoreFact({ ...base, confidence: 0, useCount: 20 }, [], NOW);
    const huge = scoreFact({ ...base, confidence: 0, useCount: 999 }, [], NOW);
    expect(zero).toBeCloseTo(0, 6);
    expect(ten).toBeCloseTo(0.5 * 0.1, 6);
    expect(twenty).toBeCloseTo(1.0 * 0.1, 6);
    expect(huge).toBeCloseTo(1.0 * 0.1, 6);
  });

  it('all-max inputs return exactly 1.0', () => {
    const fact = makeFact({
      content: 'keyword match test',
      tags: ['keyword', 'match'],
      useCount: 20,
      confidence: 1.0,
      updatedAt: NOW,
    });
    expect(scoreFact(fact, ['keyword', 'match'], NOW)).toBeCloseTo(1.0, 10);
  });

  it('all-zero inputs return 0.0', () => {
    const fact = makeFact({
      confidence: 0,
      useCount: 0,
      updatedAt: NOW - 31 * DAY_MS,
    });
    expect(scoreFact(fact, [], NOW)).toBeCloseTo(0.0, 10);
  });

  it('composite weight: confidence 0.5 → 1.0 changes overall score by exactly 0.05', () => {
    const base = { ...makeFact(), updatedAt: NOW - 31 * DAY_MS, useCount: 0 };
    const low = scoreFact({ ...base, confidence: 0.5 }, [], NOW);
    const high = scoreFact({ ...base, confidence: 1.0 }, [], NOW);
    expect(high - low).toBeCloseTo(0.05, 10);
  });

  it('empty tags → tagScore 0 without division-by-zero', () => {
    const fact = makeFact({ tags: [], updatedAt: NOW });
    const score = scoreFact(fact, ['keyword', 'match'], NOW);
    // keywordScore=1.0, tagScore=0, recency=1.0, confidence=0.8, useCount=0
    expect(score).toBeCloseTo(1.0 * 0.35 + 0 + 1.0 * 0.2 + 0.8 * 0.1, 6);
  });

  it('scoreFact is deterministic — same input, same output', () => {
    const fact = makeFact();
    expect(scoreFact(fact, ['keyword'], NOW)).toBe(scoreFact(fact, ['keyword'], NOW));
  });

  it('exposes the D-08 weights and D-09 constants', () => {
    expect(WEIGHTS).toEqual({ keyword: 0.35, tag: 0.25, recency: 0.2, confidence: 0.1, useCount: 0.1 });
    expect(MIN_SCORE).toBe(0.3);
    expect(USE_COUNT_CAP).toBe(20);
    expect(TIER_LIMITS).toEqual({ tiny: 3, small: 5, medium: 5, large: 5 });
  });
});

describe('getTopFacts — D-09 tier-gating', () => {
  function buildScoredFacts(count: number): UserMemoryFact[] {
    return Array.from({ length: count }, (_, i) =>
      makeFact({ id: crypto.randomUUID(), content: 'theme planning notes', tags: ['preferences'], useCount: 10 }),
    );
  }

  it("tier 'tiny' returns at most 3 facts, 'small' at most 5 (Test 5)", () => {
    const facts = buildScoredFacts(10);
    const tiny = getTopFacts(facts, 'theme', 'tiny');
    const small = getTopFacts(facts, 'theme', 'small');
    expect(tiny.length).toBeLessThanOrEqual(3);
    expect(small.length).toBeLessThanOrEqual(5);
    expect(tiny).toHaveLength(3);
    expect(small).toHaveLength(5);
  });

  it('all returned facts have retrievalScore ≥ MIN_SCORE', () => {
    const facts = buildScoredFacts(10);
    for (const tier of ['tiny', 'small', 'medium', 'large']) {
      const results = getTopFacts(facts, 'theme', tier);
      for (const r of results) {
        expect(r.retrievalScore).toBeGreaterThanOrEqual(MIN_SCORE);
      }
    }
  });

  it('filters facts below the 0.30 threshold even within the top-K limit', () => {
    const high = makeFact({ id: crypto.randomUUID(), content: 'theme planning notes', tags: ['preferences'], useCount: 10 });
    const low = makeFact({
      id: crypto.randomUUID(),
      content: 'zzz unrelated',
      tags: ['x'],
      useCount: 0,
      confidence: 0.5,
      updatedAt: NOW - 31 * DAY_MS,
    });
    const results = getTopFacts([low, high], 'theme', 'tiny');
    expect(results).toHaveLength(1);
    expect(results[0].record.id).toBe(high.id);
  });

  it('returns RetrievedMemory entries with retrievalScore and relevanceReasons', () => {
    const facts = buildScoredFacts(1);
    const results = getTopFacts(facts, 'theme', 'tiny');
    expect(results).toHaveLength(1);
    expect(results[0].record.id).toBe(facts[0].id);
    expect(results[0].retrievalScore).toBeGreaterThan(0);
    expect(results[0].relevanceReasons.some((r) => r.includes('theme'))).toBe(true);
  });

  it('is deterministic — same input, same output order', () => {
    const facts = buildScoredFacts(10);
    expect(getTopFacts(facts, 'theme', 'small')).toEqual(getTopFacts(facts, 'theme', 'small'));
  });

  it('empty facts → empty result, not an error', () => {
    expect(getTopFacts([], 'theme', 'tiny')).toEqual([]);
  });
});

describe('MemoryRecordSchema validation', () => {
  it('accepts a valid semantic user fact', () => {
    const fact = makeFact();
    expect(MemoryRecordSchema.parse(fact)).toMatchObject({
      id: fact.id,
      memoryType: 'semantic',
      confidence: 0.8,
      source: 'verified-state',
    });
  });

  it('rejects a record with missing id (Test 6)', () => {
    const { id: _id, ...rest } = makeFact();
    expect(() => MemoryRecordSchema.parse(rest)).toThrow();
  });

  it('rejects empty content (Test 6)', () => {
    expect(() => MemoryRecordSchema.parse(makeFact({ content: '' }))).toThrow();
  });

  it('rejects invalid memoryType (Test 6)', () => {
    expect(() =>
      MemoryRecordSchema.parse(makeFact({ memoryType: 'telepathic' as never })),
    ).toThrow();
  });

  it('rejects confidence outside [0,1] (Test 6)', () => {
    expect(() => MemoryRecordSchema.parse(makeFact({ confidence: 1.5 }))).toThrow();
    expect(() => MemoryRecordSchema.parse(makeFact({ confidence: -0.1 }))).toThrow();
  });

  it('rejects non-integer or negative useCount', () => {
    expect(() => MemoryRecordSchema.parse(makeFact({ useCount: 1.5 }))).toThrow();
    expect(() => MemoryRecordSchema.parse(makeFact({ useCount: -1 }))).toThrow();
  });

  it('defaults useCount to 0 when absent', () => {
    const { useCount: _useCount, ...rest } = makeFact();
    expect(MemoryRecordSchema.parse(rest).useCount).toBe(0);
  });
});

describe('ConfidenceSourceSchema + CONFIDENCE_MAP (D-07)', () => {
  it('maps the four sources to the D-07 values (Test 7)', () => {
    expect(ConfidenceSourceSchema.parse('explicit-user')).toBe('explicit-user');
    expect(ConfidenceSourceSchema.parse('verified-state')).toBe('verified-state');
    expect(ConfidenceSourceSchema.parse('previous-explicit')).toBe('previous-explicit');
    expect(ConfidenceSourceSchema.parse('inferred')).toBe('inferred');
    expect(CONFIDENCE_MAP).toEqual({
      'explicit-user': 1.0,
      'verified-state': 0.8,
      'previous-explicit': 0.7,
      inferred: 0.5,
    });
  });

  it('rejects an unknown source', () => {
    expect(() => ConfidenceSourceSchema.parse('robot') as never).toThrow();
  });
});

describe('UserMemoryFactSchema', () => {
  it('accepts a semantic fact', () => {
    expect(() => UserMemoryFactSchema.parse(makeFact())).not.toThrow();
  });

  it('rejects non-semantic memoryType', () => {
    expect(() => UserMemoryFactSchema.parse(makeFact({ memoryType: 'preference' } as never))).toThrow();
  });
});

describe('ConversationSummarySchema / PreferenceRecordSchema / RetrievedMemorySchema / ConversationContextSchema', () => {
  it('validates a ConversationSummary', () => {
    const summary = {
      id: crypto.randomUUID(),
      conversationId: 'conv-1',
      summary: 'User decided X and set goal Y',
      messageRange: { start: 0, end: 11 },
      createdAt: NOW,
    };
    expect(() => ConversationSummarySchema.parse(summary)).not.toThrow();
  });

  it('validates a PreferenceRecord', () => {
    expect(() =>
      PreferenceRecordSchema.parse({ key: 'np_persona', value: { tone: 'casual' }, updatedAt: NOW }),
    ).not.toThrow();
  });

  it('rejects RetrievedMemory with retrievalScore outside [0,1]', () => {
    const record = makeFact();
    expect(() =>
      RetrievedMemorySchema.parse({ record, retrievalScore: 1.5, relevanceReasons: [] }),
    ).toThrow();
    expect(() =>
      RetrievedMemorySchema.parse({ record, retrievalScore: 0.5, relevanceReasons: ['kw'] }),
    ).not.toThrow();
  });

  it('validates ConversationContext with nullable summary', () => {
    const msg = { role: 'user', content: 'hello', timestamp: NOW };
    expect(() => ConversationContextSchema.parse({ summary: null, recentMessages: [msg] })).not.toThrow();
    expect(() =>
      ConversationContextSchema.parse({
        summary: {
          id: crypto.randomUUID(),
          conversationId: 'conv-1',
          summary: 's',
          messageRange: { start: 0, end: 1 },
          createdAt: NOW,
        },
        recentMessages: [msg],
      }),
    ).not.toThrow();
  });
});
