import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkBundleIsolation } from './isolationChecks';

const outputDir = resolve(process.cwd(), '.output/chrome-mv3');

describe('built bundle isolation', () => {
  it('keeps the background lean, the side panel free of standalone pages, and ships no content script', () => {
    expect(existsSync(outputDir), `missing ${outputDir}; run pnpm run build first`).toBe(true);
    const result = checkBundleIsolation(outputDir);
    expect(result.failures).toEqual([]);
    expect(result.ok).toBe(true);
  });
});
