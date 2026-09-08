import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const BANNED_IMPORTS = [
  'antd',
  '@ant-design/x',
  '@ant-design/x-markdown',
  'react',
  'react-dom',
  'defuddle',
  'yaml',
  'mathml-to-latex',
  'temml',
  'turndown',
];

describe('content script isolation', () => {
  it('does not import banned UI or extraction dependencies', () => {
    const file = readFileSync(
      resolve(__dirname, '../../src/entrypoints/core.content.ts'),
      'utf8',
    );
    for (const banned of BANNED_IMPORTS) {
      const importPattern = new RegExp(`import[^;]*['"]${banned}['"]`);
      const requirePattern = new RegExp(`require\\(['"]${banned}['"]\\)`);
      expect(file).not.toMatch(importPattern);
      expect(file).not.toMatch(requirePattern);
    }
  });
});
