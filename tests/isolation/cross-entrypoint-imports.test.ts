import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * D-17 / REQ-R02: real (non-vacuous) isolation gate.
 *
 * The previous scaffold greps targeted non-existent component directories
 * and therefore passed vacuously (Pitfall 6, RESEARCH.md). This rewrite
 * greps the real surface directories for cross-imports, plus asserts zero
 * `fetch(` calls under `src/entrypoints/content/**`.
 *
 * Pattern scope note: a shared import from `src/core/*`, `src/types/*`,
 * `src/services/*`, or `src/components/common/*` is shared infra and is
 * NOT flagged. Only a from-statement that points into another SURFACE
 * directory counts as a violation. This keeps the test honest — it
 * punishes real cross-bundle leaks, not legitimate shared-infra imports.
 *
 * One authorised exception, pinned by §5.4 / §8.6 (UI-SPEC "Options
 * routing"): the Options workspace is not a surface bundle of its own — it
 * renders **inside** the Standalone shell at `standalone.html?page=options`,
 * and Phase 1 removes the `options.html` entrypoint entirely. The
 * Standalone shell must therefore render the Options *page*, while the
 * Options page must never import a surface. The asymmetry is asserted
 * explicitly below rather than left implicit.
 */

/**
 * The prefix shared by the shell grep and the in-process self-test, so the
 * two can never drift apart.
 *
 * It matches BOTH spellings of a cross-surface import:
 *   - a path containing a `components/` segment
 *     (`'../components/standalone/Foo'`, `'@/components/chat/Bar'`)
 *   - a bare relative sibling hop (`'../standalone/Foo'`, `'../../options/Bar'`)
 *
 * The second form is the one the previous predicate missed: the prototype
 * and the relocated tree both import siblings relatively, so a
 * `components/`-only pattern silently passed on the very violation it
 * existed to catch (proved by the `bare relative hop` self-test cases).
 *
 * Evaluates to `from\s+['"][^'"]*(components/|\.\./)` in both the JS RegExp
 * and the shell ERE.
 */
const SURFACE_IMPORT_PREFIX = `from\\s+['\\"][^'\\"]*(components/|\\.\\./)`;

const CROSS_IMPORT_RE = new RegExp(`${SURFACE_IMPORT_PREFIX}(chat|standalone|options)/`);

/** Build the shell grep for `sourceDir` importing any of `forbidden`. */
function grepCrossImports(sourceDir: string, forbidden: string): string {
  return `grep -rEn "${SURFACE_IMPORT_PREFIX}(${forbidden})/" ${sourceDir} 2>/dev/null || true`;
}

/**
 * Run a grep against a directory and return the non-comment, non-blank
 * matching lines as an array. `grep -n` prefixes each hit with
 * `path:line:`, so the comment-strip has to come AFTER stripping that
 * prefix — otherwise an indented `//` comment is misread as code and
 * slips through. This avoids the false-positive on the
 * `src/entrypoints/content/index.ts` instruction comment ("Do NOT
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
    const lines = grepForViolations(grepCrossImports('src/components/chat/', 'standalone|options'));
    expect(lines).toEqual([]);
  });

  it('standalone/ contains no imports into chat/', () => {
    // `options/` is deliberately absent from the forbidden set: §5.4 / §8.6
    // require the Standalone shell to render the Options workspace at
    // `standalone.html?page=options`. The reverse direction (options/ must
    // not import a surface) is asserted separately below.
    const lines = grepForViolations(grepCrossImports('src/components/standalone/', 'chat'));
    expect(lines).toEqual([]);
  });

  it('options/ contains no imports into chat/ or standalone/', () => {
    const lines = grepForViolations(grepCrossImports('src/components/options/', 'chat|standalone'));
    expect(lines).toEqual([]);
  });

  it('content-script entrypoint contains zero fetch() calls (Pitfall P3)', () => {
    // Filter comment lines so the instructional comment "Do NOT add a
    // fetch(.)" in src/entrypoints/content/index.ts does not produce a
    // false positive.
    const lines = grepForViolations(
      `grep -rEn "fetch\\(" src/entrypoints/content/ 2>/dev/null || true`,
    );
    expect(lines).toEqual([]);
  });
});

describe('isolation-gate self-test (proves the gate is not vacuous)', () => {
  // This block exercises the same pattern the file-scan uses, so a future
  // refactor that quietly weakens the regex trips the self-test rather than
  // the file-scan, which would otherwise silently regress to a vacuous pass
  // (Pitfall 6).

  it('gate target directories exist (a missing target would pass vacuously)', () => {
    // A grep against a path that does not exist returns zero matches, so
    // every file-scan above would "pass" without ever reading a file. These
    // positive controls pin the real target paths: the `srcDir: 'src'`
    // relocation must move them, and a future move that forgets to re-point
    // the gate fails here instead of silently covering nothing.
    const targets = [
      'src/components/chat',
      'src/components/standalone',
      'src/components/options',
      'src/entrypoints/content',
    ];
    for (const target of targets) {
      expect(existsSync(join(process.cwd(), target)), `missing gate target: ${target}`).toBe(true);
    }
  });

  it('catches a chat -> standalone import (components/ path spelling)', () => {
    const code = `import { Foo } from '../components/standalone/Foo';`;
    expect(CROSS_IMPORT_RE.test(code)).toBe(true);
  });

  it('catches a chat -> standalone import (bare relative hop)', () => {
    const code = `import { Foo } from '../standalone/StandaloneShell';`;
    expect(CROSS_IMPORT_RE.test(code)).toBe(true);
  });

  it('catches a standalone -> chat import', () => {
    const code = `import { Bar } from '../../components/chat/Bar';`;
    expect(CROSS_IMPORT_RE.test(code)).toBe(true);
  });

  it('catches a standalone -> options import (the spelling that must stay visible)', () => {
    const code = `import { OptionsPage } from '../options/OptionsPage';`;
    expect(CROSS_IMPORT_RE.test(code)).toBe(true);
  });

  it('catches an options -> chat import', () => {
    const code = `import { Baz } from '../components/chat/Baz';`;
    expect(CROSS_IMPORT_RE.test(code)).toBe(true);
  });

  it('catches an aliased cross-surface import', () => {
    const code = `import { Foo } from '@/components/standalone/Foo';`;
    expect(CROSS_IMPORT_RE.test(code)).toBe(true);
  });

  it('does NOT flag a shared-infra import (core/components/...)', () => {
    const code = `import { PortableMarkdown } from '../../core/components/PortableMarkdown';`;
    expect(CROSS_IMPORT_RE.test(code)).toBe(false);
  });

  it('does NOT flag a shared-infra import (core/...)', () => {
    const code = `import { t } from '../../core/i18n/strings';`;
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

  it('does NOT flag a page-tree import (pages/, notes/)', () => {
    const code = `import { ChatPage } from '../pages/ChatPage';\nimport { NotesWorkspace } from '../notes/NotesWorkspace';`;
    expect(CROSS_IMPORT_RE.test(code)).toBe(false);
  });

  it('does NOT flag a non-relative import to a shared module', () => {
    const code = `import { z } from 'zod';`;
    expect(CROSS_IMPORT_RE.test(code)).toBe(false);
  });
});
