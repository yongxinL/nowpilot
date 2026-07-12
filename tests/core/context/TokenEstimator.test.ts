import { describe, it, expect } from 'vitest';
import { TokenEstimator, tokenEstimator } from '../../../src/core/context/TokenEstimator';

describe('estimateTokens — Latin/ASCII text', () => {
  it('4 chars → 1 token', () => {
    expect(tokenEstimator.estimateTokens('test')).toBe(1);
  });

  it('5 chars → 2 tokens (ceiling)', () => {
    expect(tokenEstimator.estimateTokens('hello')).toBe(2);
  });

  it('100 chars → 25 tokens', () => {
    expect(tokenEstimator.estimateTokens('a'.repeat(100))).toBe(25);
  });

  it('empty string → 0', () => {
    expect(tokenEstimator.estimateTokens('')).toBe(0);
  });

  it('whitespace only → ceil(len/4)', () => {
    expect(tokenEstimator.estimateTokens('    ')).toBe(1);
  });
});

describe('estimateTokens — CJK text', () => {
  it('3 CJK chars → 1 token', () => {
    expect(tokenEstimator.estimateTokens('日本語')).toBe(1);
  });

  it('5 CJK chars → 2 tokens (ceiling)', () => {
    expect(tokenEstimator.estimateTokens('あいうえお')).toBe(2);
  });

  it('detects Chinese range (U+4E00-U+9FFF)', () => {
    expect(tokenEstimator.estimateTokens('你好世界')).toBe(2);
  });

  it('detects Hiragana range (U+3040-U+309F)', () => {
    expect(tokenEstimator.estimateTokens('あいう')).toBe(1);
  });

  it('detects Katakana range (U+30A0-U+30FF)', () => {
    expect(tokenEstimator.estimateTokens('アイウ')).toBe(1);
  });

  it('detects Hangul range (U+AC00-U+D7AF)', () => {
    expect(tokenEstimator.estimateTokens('안녕하세요')).toBe(2);
  });
});

describe('estimateTokens — Mixed text', () => {
  it('Hello 世界! — Latin: 7 chars / 4 = ceil(1.75)=2, CJK: 2 chars / 3 = ceil(0.67)=1, total=3', () => {
    // 'Hello 世界!' length: H(1) e(2) l(3) l(4) o(5) space(6) 世(7) 界(8) !(9) = 9 chars
    // CJK: 世, 界 = 2
    // Non-CJK: 9 - 2 = 7
    // Non-CJK: ceil(7/4) = 2, CJK: ceil(2/3) = 1, total = 3
    expect(tokenEstimator.estimateTokens('Hello 世界!')).toBe(3);
  });
});

describe('estimateTokensBatch', () => {
  it('sums individual estimates', () => {
    const result = tokenEstimator.estimateTokensBatch(['hello', 'world']);
    expect(result).toBe(4);
  });

  it('empty array returns 0', () => {
    expect(tokenEstimator.estimateTokensBatch([])).toBe(0);
  });
});

describe('applySafetyMargin', () => {
  it('100 → 110', () => {
    expect(tokenEstimator.applySafetyMargin(100)).toBe(110);
  });

  it('1 → 2 (ceil of 1.1)', () => {
    expect(tokenEstimator.applySafetyMargin(1)).toBe(2);
  });

  it('0 → 0', () => {
    expect(tokenEstimator.applySafetyMargin(0)).toBe(0);
  });

  it('1000 → 1100', () => {
    expect(tokenEstimator.applySafetyMargin(1000)).toBe(1100);
  });
});

describe('isCJK', () => {
  it('pure ASCII returns false', () => {
    expect(tokenEstimator.isCJK('hello')).toBe(false);
  });

  it('Chinese characters returns true', () => {
    expect(tokenEstimator.isCJK('世界')).toBe(true);
  });

  it('Japanese kana returns true', () => {
    expect(tokenEstimator.isCJK('あいう')).toBe(true);
  });

  it('Korean hangul returns true', () => {
    expect(tokenEstimator.isCJK('안녕')).toBe(true);
  });

  it('empty string returns false', () => {
    expect(tokenEstimator.isCJK('')).toBe(false);
  });
});

describe('singleton', () => {
  it('tokenEstimator is instanceof TokenEstimator', async () => {
    const mod = await import('../../../src/core/context/TokenEstimator');
    expect(mod.tokenEstimator).toBeInstanceOf(TokenEstimator);
  });

  it('class also exported for direct instantiation', () => {
    const instance = new TokenEstimator();
    expect(instance).toBeInstanceOf(TokenEstimator);
  });
});
