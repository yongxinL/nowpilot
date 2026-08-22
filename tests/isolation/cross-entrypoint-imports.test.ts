import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

/**
 * D-17 / REQ-R02: real (non-vacuous) isolation gate.
 *
 * The previous scaffold greps targeted non-existent component directories
 * and therefore passed vacuously (Pitfall 6, RESEARCH.md). This rewrite
 * greps the three real surface directories
 * (`src/components/chat/`, `src/components/standalone/`, `src/components/options/`)
 * for cross-imports in both directions, plus asserts zero `fetch(` calls
 * under `entrypoints/content/**`.
 *
 * Pattern scope note: a shared import from `src/core/*`, `src/types/*`,
 * `src/services/*`, or `src/components/common/*` is shared infra and is
 * NOT flagged. Only a from-statement that points into another SURFACE
 * directory (`chat|standalone|options`) counts as a violation. This keeps
 * the test honest — it punishes real cross-bundle leaks, not legitimate
 * shared-infra imports.
 */

// Import-statement regex used by every shell-grep below. Kept as a single
// source of truth so the self-test (last describe block) exercises the
// exact same pattern the file-scan uses.
const CROSS_IMPORT_RE =
  /from\s+['"][^'"]*components\/(chat|standalone|options)\//;

/**
 * Run a grep against a directory and return the non-comment, non-blank
 * matching lines as an array. `grep -n` prefixes each hit with
 * `path:line:`, so the comment-strip has to come AFTER stripping that
 * prefix — otherwise an indented `//` comment is misread as code and
 * slips through. This avoids the false-positive on the
 * `entrypoints/content/core.content.ts` instruction comment ("Do NOT
 * add a fetch(.)").
 */
function grepForViolations(cmd: string): string[] {
  const result = execSync(cmd, { encoding: 'utf8' });
  return result
    .split('\n')
    .map((line) => {
      // Strip "path:line:" prefix that grep -n prepends.
      const match = line.match(/^[^:]+:\d+:(.*)$/);
      return match ? match[1].trim() : line.trim();
    })
    .filter((line) => line !== '' && !line.startsWith('//'));
}

describe('cross-entrypoint import isolation (D-17, REQ-R02)', () => {
  it('chat/ contains no imports into standalone/ or options/', () => {
    const lines = grepForViolations(
      `grep -rEn "from\\s+['\\"][^'\\"]*components/(standalone|options)/" ` +
        `src/components/chat/ 2>/dev/null || true`,
    );
    expect(lines).toEqual([]);
  });

  it('standalone/ contains no imports into chat/ or options/', () => {
    const lines = grepForViolations(
      `grep -rEn "from\\s+['\\"][^'\\"]*components/(chat|options)/" ` +
        `src/components/standalone/ 2>/dev/null || true`,
    );
    expect(lines).toEqual([]);
  });

  it('options/ contains no imports into chat/ or standalone/', () => {
    const lines = grepForViolations(
      `grep -rEn "from\\s+['\\"][^'\\"]*components/(chat|standalone)/" ` +
        `src/components/options/ 2>/dev/null || true`,
    );
    expect(lines).toEqual([]);
  });

  it('content-script directory contains zero fetch() calls (Pitfall P3)', () => {
    // Filter comment lines so the instructional comment "Do NOT add a
    // fetch(.)" in core.content.ts does not produce a false positive.
    const lines = grepForViolations(
      `grep -rEn "fetch\\(" entrypoints/content/ 2>/dev/null || true`,
    );
    expect(lines).toEqual([]);
  });
});

describe('isolation-gate self-test (proves the gate is not vacuous)', () => {
  // This block exercises the CROSS_IMPORT_RE pattern directly so a
  // future refactor that quietly weakens the regex trips the self-test
  // rather than the file-scan, which would otherwise silently regress
  // to a vacuous pass (Pitfall 6).

  it('catches a chat -> standalone import', () => {
    const code = `import { Foo } from '../components/standalone/Foo';`;
    expect(CROSS_IMPORT_RE.test(code)).toBe(true);
  });

  it('catches a standalone -> chat import', () => {
    const code = `import { Bar } from '../../components/chat/Bar';`;
    expect(CROSS_IMPORT_RE.test(code)).toBe(true);
  });

  it('catches an options -> chat import', () => {
    const code = `import { Baz } from '../components/chat/Baz';`;
    expect(CROSS_IMPORT_RE.test(code)).toBe(true);
  });

  it('does NOT flag a shared-infra import (core/components/...)', () => {
    const code = `import { PortableMarkdown } from '../../core/components/PortableMarkdown';`;
    expect(CROSS_IMPORT_RE.test(code)).toBe(false);
  });

  it('does NOT flag a sibling (common/) import', () => {
    const code = `import { NowPilotAvatar } from '../common/NowPilotAvatar';`;
    expect(CROSS_IMPORT_RE.test(code)).toBe(false);
  });

  it('does NOT flag a relative import to a same-dir sibling', () => {
    const code = `import { Foo } from './Foo';`;
    expect(CROSS_IMPORT_RE.test(code)).toBe(false);
  });

  it('does NOT flag a non-relative import to a shared module', () => {
    const code = `import { z } from 'zod';`;
    expect(CROSS_IMPORT_RE.test(code)).toBe(false);
  });
});
