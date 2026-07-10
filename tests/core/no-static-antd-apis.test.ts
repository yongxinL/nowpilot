import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(__dirname, '..', '..');
const SCAN_ROOTS = [join(REPO_ROOT, 'src', 'entrypoints'), join(REPO_ROOT, 'src', 'core', 'onboarding')];

const STATIC_MESSAGE_IMPORT = /import\s+\{[^}]*\bmessage\b[^}]*\}\s+from\s+['"]antd['"]/;
const STATIC_NOTIFICATION_IMPORT = /import\s+\{[^}]*\bnotification\b[^}]*\}\s+from\s+['"]antd['"]/;
const STATIC_MODAL_METHOD_CALL = /\bModal\.(?:confirm|info|warning|error)\s*\(/;

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

function findStaticApiViolations(filePath: string): string[] {
  const source = readFileSync(filePath, 'utf-8');
  const lines = source.split('\n');
  const violations: string[] = [];
  lines.forEach((line, idx) => {
    if (STATIC_MESSAGE_IMPORT.test(line)) {
      violations.push(`${filePath.replace(REPO_ROOT + '/', '')}:${idx + 1}: static message import — ${line.trim()}`);
    } else if (STATIC_NOTIFICATION_IMPORT.test(line)) {
      violations.push(`${filePath.replace(REPO_ROOT + '/', '')}:${idx + 1}: static notification import — ${line.trim()}`);
    } else if (STATIC_MODAL_METHOD_CALL.test(line)) {
      violations.push(`${filePath.replace(REPO_ROOT + '/', '')}:${idx + 1}: static Modal.* method — ${line.trim()}`);
    }
  });
  return violations;
}

describe('THEME-06 — No static imperative AntD API usage', () => {
  it('no file under src/entrypoints/ or src/core/onboarding/ imports message/notification statically OR calls Modal.confirm/info/warning/error statically', () => {
    const allViolations: string[] = [];
    for (const root of SCAN_ROOTS) {
      try {
        const files = listFiles(root);
        for (const file of files) {
          allViolations.push(...findStaticApiViolations(file));
        }
      } catch {
        // root missing is fine
      }
    }
    expect(allViolations).toEqual([]);
  });
});
