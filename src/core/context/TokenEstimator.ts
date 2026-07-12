import { debugLog } from '../utils/debugLog';

const CJK_REGEX = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/;

export class TokenEstimator {
  estimateTokens(text: string): number {
    if (text.length === 0) return 0;
    let cjkCount = 0;
    for (let i = 0; i < text.length; i++) {
      if (CJK_REGEX.test(text[i])) cjkCount++;
    }
    const nonCjkCount = text.length - cjkCount;
    return Math.ceil(nonCjkCount / 4) + Math.ceil(cjkCount / 3);
  }

  estimateTokensBatch(texts: string[]): number {
    if (texts.length > 1000) {
      debugLog('warn', '[TokenEstimator] estimateTokensBatch called with >1000 items', {
        count: texts.length,
      });
    }
    return texts.reduce((sum, t) => sum + this.estimateTokens(t), 0);
  }

  applySafetyMargin(estimatedTokens: number): number {
    return Math.ceil(estimatedTokens * 110 / 100);
  }

  isCJK(text: string): boolean {
    if (text.length === 0) return false;
    for (let i = 0; i < text.length; i++) {
      if (CJK_REGEX.test(text[i])) return true;
    }
    return false;
  }
}

export const tokenEstimator = new TokenEstimator();
