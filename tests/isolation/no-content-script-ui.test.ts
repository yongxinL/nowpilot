import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * D-92 / §24 rev 2026-08-12: real (non-vacuous) no-content-script-ui isolation gate.
 *
 * The content script (ISOLATED world, entrypoints/content/** + src/core/content/**)
 * must never import the panel-side UI/extraction stack. §24 rev 2026-08-12 forbids
 * the React family (react, react-dom, antd), the panel-only extraction engine
 * (defuddle — including its transitive Markdown/math deps mathml-to-latex, temml,
 * turndown), yaml, AND any File System Access API usage in the content bundle.
 *
 * This file is the hard enforcement of the Pitfall-8 import boundary that the
 * 06-02/06-04 content-shell modules were built against. Mechanics (RESEARCH Open
 * Question 2 recommendation): fast source-import grep over the content modules +
 * a built-bundle grep + <50 KB size assertion (§22.1) when a build artifact is
 * present — the gate must NOT depend on a build.
 *
 * Non-vacuous (Pitfall 6 / #1479): the self-test block below proves FORBIDDEN_RE
 * catches planted violations. A gate that cannot fail measures nothing.
 */

// The §24 rev 2026-08-12 forbidden set, as import-statement targets. `defuddle/full`
// is pinned by §7.6/§26.4; `react-dom/client` is part of the React family.
const FORBIDDEN_PACKAGES = [
  'react',
  'react-dom',
  'react-dom/client',
  'antd',
  'defuddle',
  'defuddle/full',
  'mathml-to-latex',
  'temml',
  'turndown',
  'yaml',
];

// Shared alternation source of truth for the JS regex AND the shell grep pattern
// (GNU grep -E supports the same `\s` / `(...)` alternation forms).
const PKG_ALT = FORBIDDEN_PACKAGES.join('|');

/**
 * Import-statement + File System Access API regex used by the source greps.
 * Matches `from 'pkg'`, bare `import 'pkg'`, `require('pkg')`, and the two
 * File System Access API pickers. The quoted package name must match exactly
 * (no substring matches — `'./react-ish'` cannot trip the gate).
 */
const FORBIDDEN_RE = new RegExp(
  `(?:from\\s+|import\\s+|require\\(\\s*)['"](${PKG_ALT})['"]|show(?:Directory|OpenFile)Picker\\s*\\(`,
);

/**
 * Built-bundle regex: bundlers transform import statements, so the built chunk
 * is searched for the forbidden module ids as quoted strings (rollup/webpack
 * module registries) plus the File System Access API identifiers (Pitfall 7:
 * transitive deps only resolve at build time).
 */
const BUNDLE_FORBIDDEN_RE = new RegExp(`['"](${PKG_ALT})['"]|show(?:Directory|OpenFile)Picker\\s*\\(`);

/** The content-script source trees the isolation grep guards (Pitfall 8). */
const CONTENT_SOURCE_DIRS = `entrypoints/content/ src/core/content/`;

/** §22.1: "Content script bundle | < 50 KB (extraction-only)". */
const CONTENT_BUNDLE_SIZE_LIMIT = 50 * 1024;

/**
 * Run a grep against a directory and return the non-comment, non-blank
 * matching lines as an array. `grep -n` prefixes each hit with
 * `path:line:`, so the comment-strip has to come AFTER stripping that
 * prefix — otherwise an indented `//` comment is misread as code and
 * slips through (same discipline as cross-entrypoint-imports.test.ts).
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

/**
 * Locate the built content-script bundles, when a build artifact exists.
 * WXT 0.20.x writes the built extension to `.output/chrome-mv3/`; the
 * manifest's `content_scripts[].js` entries are the authoritative list.
 * Falls back to a `content-scripts/*.js` glob for other layouts. Returns
 * [] when no build artifact is present — the gate then skips gracefully
 * (it must not depend on a build — RESEARCH Open Question 2).
 */
function findContentScriptBundles(): string[] {
  const roots = ['.output', '.wxt'];
  const found: string[] = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    const buildDir = join(root, 'chrome-mv3');
    if (!existsSync(buildDir)) continue;

    // 1. Manifest-declared content scripts (authoritative).
    const manifestPath = join(buildDir, 'manifest.json');
    if (existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
          content_scripts?: Array<{ js?: string[] }>;
        };
        for (const entry of manifest.content_scripts ?? []) {
          for (const js of entry.js ?? []) {
            const p = join(buildDir, js);
            if (existsSync(p)) found.push(p);
          }
        }
      } catch {
        // Malformed manifest — fall through to the glob.
      }
    }

    // 2. Fallback glob: content-scripts/ subdirectory.
    const contentScriptsDir = join(buildDir, 'content-scripts');
    if (existsSync(contentScriptsDir)) {
      for (const f of readdirSync(contentScriptsDir)) {
        if (f.endsWith('.js')) found.push(join(contentScriptsDir, f));
      }
    }
  }
  return [...new Set(found)];
}

describe('no-content-script-ui isolation (D-92 / §24 rev 2026-08-12)', () => {
  it('content-script source contains zero forbidden imports / FS API usage', () => {
    // grep -E command mirrors FORBIDDEN_RE (same PKG_ALT alternation). The
    // prefix alternatives MUST be grouped: without the outer parens, ERE binds
    // `from\s+` / `import\s+` as top-level alternatives and matches ANY import.
    const lines = grepForViolations(
      `grep -rEn "(from\\s+|import\\s+|require\\(\\s*)['\\"](${PKG_ALT})['\\"]" ` +
        `--include='*.ts' ${CONTENT_SOURCE_DIRS} 2>/dev/null || true`,
    );
    expect(lines).toEqual([]);
  });

  it('content-script source contains zero File System Access API usage', () => {
    const lines = grepForViolations(
      `grep -rEn "show(Directory|OpenFile)Picker\\s*\\(" ` +
        `--include='*.ts' ${CONTENT_SOURCE_DIRS} 2>/dev/null || true`,
    );
    expect(lines).toEqual([]);
  });
});

const builtBundles = findContentScriptBundles();

// The built-bundle check runs only when a build artifact exists — the gate must
// stay fast and green without a build (RESEARCH Open Question 2). The 06-05
// executor materializes `.output/chrome-mv3` via `pnpm build:ext` to exercise it.
describe.skipIf(builtBundles.length === 0)(
  'built content-script bundle isolation (Pitfall 7 / §24)',
  () => {
    it('built content-script bundles contain zero forbidden module ids', () => {
      for (const file of builtBundles) {
        const content = readFileSync(file, 'utf8');
        const match = content.match(BUNDLE_FORBIDDEN_RE);
        expect(match, `forbidden module id in built content bundle: ${file}`).toBeNull();
      }
    });

    it(`built content-script bundle stays under the 50 KB target (§22.1, ${CONTENT_BUNDLE_SIZE_LIMIT} bytes)`, () => {
      for (const file of builtBundles) {
        const bytes = statSync(file).size;
        expect(bytes, `${file} exceeds the 50 KB extraction-bundle target`).toBeLessThan(
          CONTENT_BUNDLE_SIZE_LIMIT,
        );
      }
    });
  },
);

describe('no-content-script-ui self-test (proves the gate is not vacuous)', () => {
  // This block exercises FORBIDDEN_RE directly so a future refactor that quietly
  // weakens the regex trips the self-test rather than the file-scan, which would
  // otherwise silently regress to a vacuous pass (Pitfall 6 / #1479).

  it('catches a react import', () => {
    expect(FORBIDDEN_RE.test(`import React from 'react';`)).toBe(true);
  });

  it('catches a react-dom import', () => {
    expect(FORBIDDEN_RE.test(`import { createRoot } from 'react-dom';`)).toBe(true);
  });

  it('catches a react-dom/client import', () => {
    expect(FORBIDDEN_RE.test(`import { createRoot } from 'react-dom/client';`)).toBe(true);
  });

  it('catches an antd import', () => {
    expect(FORBIDDEN_RE.test(`import { Button } from 'antd';`)).toBe(true);
  });

  it('catches a defuddle/full import', () => {
    expect(FORBIDDEN_RE.test(`import Defuddle from 'defuddle/full';`)).toBe(true);
  });

  it('catches a plain defuddle import', () => {
    expect(FORBIDDEN_RE.test(`import Defuddle from 'defuddle';`)).toBe(true);
  });

  it('catches a mathml-to-latex import (transitive math dep)', () => {
    expect(FORBIDDEN_RE.test(`import { convert } from 'mathml-to-latex';`)).toBe(true);
  });

  it('catches a temml import (transitive math dep)', () => {
    expect(FORBIDDEN_RE.test(`import temml from 'temml';`)).toBe(true);
  });

  it('catches a turndown import (HTML→MD dep)', () => {
    expect(FORBIDDEN_RE.test(`import TurndownService from 'turndown';`)).toBe(true);
  });

  it('catches a yaml import', () => {
    expect(FORBIDDEN_RE.test(`import { parse } from 'yaml';`)).toBe(true);
  });

  it('catches a bare import of a forbidden package', () => {
    expect(FORBIDDEN_RE.test(`import 'react';`)).toBe(true);
  });

  it('catches a require() of a forbidden package', () => {
    expect(FORBIDDEN_RE.test(`const d = require('defuddle');`)).toBe(true);
  });

  it('catches the File System Access API (showDirectoryPicker)', () => {
    expect(FORBIDDEN_RE.test(`const dir = await showDirectoryPicker();`)).toBe(true);
  });

  it('catches the File System Access API (showOpenFilePicker)', () => {
    expect(FORBIDDEN_RE.test(`showOpenFilePicker({ multiple: true });`)).toBe(true);
  });

  it('does NOT flag the legit RuntimeEnvelope import (shared infra)', () => {
    const code = `import { createEnvelope, type PageHtmlPayload } from '../runtime/RuntimeEnvelope';`;
    expect(FORBIDDEN_RE.test(code)).toBe(false);
  });

  it('does NOT flag the WXT defineContentScript import', () => {
    const code = `import { defineContentScript } from 'wxt/utils/define-content-script';`;
    expect(FORBIDDEN_RE.test(code)).toBe(false);
  });

  it('does NOT flag a comment line mentioning a forbidden package (comment-strip discipline)', () => {
    // grepForViolations strips leading `//` lines before evaluating; the regex
    // itself would match the quoted package inside this comment, so the strip
    // discipline — not the regex — is what keeps instructional comments quiet.
    const cmd = `printf '%s\\n' "// instructional: never import from 'react' here" | grep -EHn --label=scratch "(from\\s+|import\\s+|require\\(\\s*)['\\"](${PKG_ALT})['\\"]" || true`;
    expect(grepForViolations(cmd)).toEqual([]);
  });

  it('does NOT flag a substring of a longer module path', () => {
    const code = `import { x } from './react-ish/helpers';`;
    expect(FORBIDDEN_RE.test(code)).toBe(false);
  });

  it('BUNDLE_FORBIDDEN_RE catches a quoted module id in built output', () => {
    const code = `const e = require("defuddle/full");`;
    expect(BUNDLE_FORBIDDEN_RE.test(code)).toBe(true);
  });

  it('BUNDLE_FORBIDDEN_RE catches the FS API in built output', () => {
    const code = `window.showDirectoryPicker();`;
    expect(BUNDLE_FORBIDDEN_RE.test(code)).toBe(true);
  });

  it('BUNDLE_FORBIDDEN_RE does NOT flag a benign quoted string', () => {
    const code = `const url = "https://example.com/defuddle-notes";`;
    expect(BUNDLE_FORBIDDEN_RE.test(code)).toBe(false);
  });
});