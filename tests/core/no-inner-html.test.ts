import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');
const SRC_ROOT = join(REPO_ROOT, 'src');

const INNER_HTML_PATTERN = /\b(?:innerHTML|dangerouslySetInnerHTML)\b/;

function listFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...listFiles(fullPath));
    } else if (/\.(ts|tsx|html)$/.test(entry)) {
      results.push(fullPath);
    }
  }
  return results;
}

function findInnerHtmlViolations(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf-8');
  const lines = source.split('\n');
  const violations: string[] = [];
  lines.forEach((line, idx) => {
    if (INNER_HTML_PATTERN.test(line)) {
      violations.push(`${filePath.replace(REPO_ROOT + '/', '')}:${idx + 1}: ${line.trim()}`);
    }
  });
  return violations;
}

describe('HARD-10 — No innerHTML / dangerouslySetInnerHTML anywhere in src/', () => {
  it('no file under src/ uses innerHTML or dangerouslySetInnerHTML', () => {
    const files = listFiles(SRC_ROOT);
    const allViolations: string[] = [];
    for (const file of files) {
      allViolations.push(...findInnerHtmlViolations(file));
    }
    expect(allViolations).toEqual([]);
  });
});
