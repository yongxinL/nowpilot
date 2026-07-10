import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');
const CORE_ROOT = join(REPO_ROOT, 'src', 'core');

const ADDON_IMPORT_PATTERN = /from\s+['"][^'"]*addons\/[^'"]*['"]/;

function listFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...listFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      results.push(fullPath);
    }
  }
  return results;
}

function findAddonImportViolations(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf-8');
  const lines = source.split('\n');
  const violations: string[] = [];
  lines.forEach((line, idx) => {
    if (ADDON_IMPORT_PATTERN.test(line)) {
      violations.push(`${filePath.replace(REPO_ROOT + '/', '')}:${idx + 1}: ${line.trim()}`);
    }
  });
  return violations;
}

describe('ADDON-10 — Core never imports from src/addons/', () => {
  it('no file under src/core/ imports from a path containing addons/', () => {
    const files = listFiles(CORE_ROOT);
    const allViolations: string[] = [];
    for (const file of files) {
      allViolations.push(...findAddonImportViolations(file));
    }
    expect(allViolations).toEqual([]);
  });
});
