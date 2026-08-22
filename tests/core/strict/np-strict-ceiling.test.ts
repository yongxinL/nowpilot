/**
 * NP-STRICT ceiling gate (D-21, REQ-R19).
 *
 * Spec §7.8 mandates `strict: true`. Phase 1 enabled strict and swept every
 * trivial cast to a real type. Genuinely-structural residue is suppressed with
 * sequential `// @ts-expect-error NP-STRICT-<n>: <reason>` markers — one of
 * two allowed suppression forms (the only other is `@ts-ignore`, which is
 * forbidden because it does NOT self-destruct when the underlying type is
 * fixed; `@ts-expect-error` does).
 *
 * The single source of truth for the ceiling is `package.json.NP_STRICT_CEILING`
 * (M6 in the plan). This test reads that constant and fails if the live count
 * of NP-STRICT- markers across `src/` + `entrypoints/` exceeds it. Phase 2–3
 * reduce the ceiling to 0 (STATE.md watch-item).
 *
 * Sweep semantics:
 *   - `find` argument is the regex to match.
 *   - We look for `NP-STRICT-` anywhere in `src/` and `entrypoints/` (the
 *     scope the strict sweep targeted).
 *   - Count is computed at test time, not cached, so PRs that add a new
 *     suppression without raising the ceiling fail the gate.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const PKG_PATH = join(REPO_ROOT, 'package.json');

interface PackageJsonShape {
  NP_STRICT_CEILING: number;
}

function readCeiling(): number {
  const raw = JSON.parse(readFileSync(PKG_PATH, 'utf-8')) as PackageJsonShape;
  if (typeof raw.NP_STRICT_CEILING !== 'number') {
    throw new Error(
      'package.json is missing the NP_STRICT_CEILING field — the strict-mode ' +
        'sweep (D-21) requires this single-source-of-truth constant. ' +
        'See 01-CONTEXT.md D-21 for the convention.',
    );
  }
  return raw.NP_STRICT_CEILING;
}

function countMarkers(): number {
  // Use git grep to scope to tracked files (matches the plan's
  // "src/ + entrypoints/" intent); fall back to a directory scan if git is
  // not available.
  let output = '';
  try {
    output = execSync(
      'git grep -nE "NP-STRICT-" -- src entrypoints || true',
      { cwd: REPO_ROOT, encoding: 'utf-8' },
    );
  } catch {
    output = '';
  }
  if (!output) {
    // Fallback: list src + entrypoints and grep each file individually.
    output = execSync(
      'find src entrypoints -type f \\( -name "*.ts" -o -name "*.tsx" \\) ' +
        '| xargs grep -nE "NP-STRICT-" || true',
      { cwd: REPO_ROOT, encoding: 'utf-8' },
    );
  }
  // Each match line is one marker occurrence.
  const lines = output.split('\n').filter((l) => l.length > 0);
  return lines.length;
}

describe('NP-STRICT ceiling (D-21)', () => {
  it('declares NP_STRICT_CEILING in package.json', () => {
    expect(() => readCeiling()).not.toThrow();
  });

  it('live marker count does not exceed NP_STRICT_CEILING', () => {
    const ceiling = readCeiling();
    const live = countMarkers();
    const rel = (p: string) => relative(REPO_ROOT, p);
    const offenders: string[] = [];
    try {
      const output = execSync(
        'git grep -nE "NP-STRICT-" -- src entrypoints || true',
        { cwd: REPO_ROOT, encoding: 'utf-8' },
      );
      for (const line of output.split('\n').filter(Boolean)) {
        offenders.push(line);
      }
    } catch {
      // ignore — already handled in countMarkers
    }
    expect(
      live,
      `Live NP-STRICT- marker count (${live}) exceeds ceiling (${ceiling}). ` +
        'Each marker must be justified with a sequential number and reason; ' +
        'if a new structural gap legitimately needs suppression, raise ' +
        'NP_STRICT_CEILING in package.json AND justify the increase in the ' +
        'PR description (D-21 / spec §7.8). Offenders:\n' +
        offenders.map(rel).join('\n'),
    ).toBeLessThanOrEqual(ceiling);
  });
});
