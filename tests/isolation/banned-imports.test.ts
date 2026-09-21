import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Repo-level banned-import and dependency gate (plan `01-13`, Task 1) — the
 * three pattern groups Phase 1 success criterion 5 names, one case per group:
 *
 *   1. unsafe HTML injection — `innerHTML` / `dangerouslySetInnerHTML`
 *   2. banned styling and primitive libraries — `tailwind` / `shadcn` / `@radix-ui`
 *   3. the banned motion package — `framer-motion`
 *
 * Groups 2 and 3 also read `package.json`: a declared-but-unimported banned
 * package is a violation the source scan cannot see, so the dependency manifest
 * is inspected independently of the source (T-1-SC).
 *
 * `motion` v12 is explicitly permitted (`DESIGN_SYSTEM` §11, PATTERNS A9: only
 * `framer-motion` is banned, because Phase 15's motion contract needs the
 * approved package). Case 4 asserts the matcher does not flag it, so the gate
 * cannot widen into rejecting an approved dependency by accident.
 *
 * Two properties make the gate non-vacuous (T-1-66):
 *   - every scan case asserts a **non-zero** count of scanned files, so a gate
 *     whose target path stops resolving fails instead of passing silently; and
 *   - comments are stripped before matching (the repo's source-scan idiom,
 *     plan `01-09`'s correction), so prose that *describes* a banned construct
 *     cannot trip the gate and a real usage cannot hide behind a comment.
 *
 * Read-only by construction: it scans and asserts; it writes nothing.
 */

const SOURCE_ROOT = join(process.cwd(), 'src');
const PACKAGE_JSON_PATH = join(process.cwd(), 'package.json');

/**
 * The extensions the gate scans. TypeScript sources are the import surface;
 * `index.css` is included because a CSS `@import` of a banned styling framework
 * is the same violation as a TypeScript import of it, and the class-string half
 * of the Tailwind rule is `scripts/verify-no-tailwind.sh`'s job.
 */
const SCANNED_EXTENSIONS = /\.(tsx?|css)$/;

/** Group 1 tokens, most specific first so a row names the precise construct. */
const UNSAFE_HTML_TOKENS = ['dangerouslySetInnerHTML', 'innerHTML'] as const;

/** Group 2 tokens — the banned styling framework, component-copy layer and primitive namespace. */
const BANNED_STYLING_TOKENS = ['tailwind', 'shadcn', '@radix-ui'] as const;

/** Group 3 token — the banned motion package. */
const BANNED_MOTION_TOKEN = 'framer-motion';

/** The approved motion package the design system permits (A9) — never banned. */
const APPROVED_MOTION_PACKAGE = 'motion';

/**
 * Strip block and line comments before scanning. Prose that *describes* a
 * banned construct must not be able to trip the gate — `src/index.css`'s own
 * "Tailwind removed per D-18" note is the live example — and a construct quoted
 * inside a comment is not a construct.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function walkScannedFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walkScannedFiles(full));
    else if (SCANNED_EXTENSIONS.test(entry.name)) found.push(full);
  }
  return found;
}

const relativePath = (full: string) => full.slice(process.cwd().length + 1);

/**
 * The single predicate every group uses — also exercised by case 4's
 * self-test, so a refactor that quietly widens or narrows the match trips
 * there rather than silently changing what the gate covers.
 */
function matchesBannedToken(specifier: string, tokens: readonly string[]): boolean {
  return tokens.some((token) => specifier.includes(token));
}

/** One row per offending line, naming the matched token. */
function offencesInSource(files: string[], tokens: readonly string[]): string[] {
  const offences: string[] = [];
  for (const file of files) {
    const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
    lines.forEach((line, index) => {
      const token = tokens.find((candidate) => matchesBannedToken(line, [candidate]));
      if (token) offences.push(`${relativePath(file)}:${index + 1}: [${token}] ${line.trim()}`);
    });
  }
  return offences;
}

type DependencyRow = { name: string; section: 'dependencies' | 'devDependencies' };

/** Every declared package name, from both manifest sections. */
function declaredDependencies(): DependencyRow[] {
  const manifest = JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8')) as Record<
    string,
    Record<string, string> | undefined
  >;
  const rows: DependencyRow[] = [];
  for (const section of ['dependencies', 'devDependencies'] as const) {
    for (const name of Object.keys(manifest[section] ?? {})) {
      rows.push({ name, section });
    }
  }
  return rows;
}

function offencesInManifest(
  deps: DependencyRow[],
  tokens: readonly string[],
): string[] {
  return deps
    .filter(({ name }) => matchesBannedToken(name, tokens))
    .map(({ name, section }) => `package.json ${section}: ${name}`);
}

describe('banned-import gate — Phase 1 success criterion 5, three pattern groups', () => {
  it('1. unsafe HTML injection: zero innerHTML / dangerouslySetInnerHTML under src/', () => {
    const files = walkScannedFiles(SOURCE_ROOT);
    expect(
      files.length,
      'unsafe-HTML group: the scan read no source files under src/ — it would pass vacuously',
    ).toBeGreaterThan(0);

    const offences = offencesInSource(files, UNSAFE_HTML_TOKENS);
    expect(
      offences,
      `unsafe-HTML group: ${files.length} files scanned, ${offences.length} offence(s)`,
    ).toEqual([]);
  });

  it('2. banned styling and primitive libraries: absent from src/ and from package.json', () => {
    const files = walkScannedFiles(SOURCE_ROOT);
    expect(
      files.length,
      'banned-styling group: the scan read no source files under src/ — it would pass vacuously',
    ).toBeGreaterThan(0);

    const sourceOffences = offencesInSource(files, BANNED_STYLING_TOKENS);
    expect(
      sourceOffences,
      `banned-styling group: ${files.length} files scanned, ${sourceOffences.length} offence(s)`,
    ).toEqual([]);

    const deps = declaredDependencies();
    expect(
      deps.length,
      'banned-styling group: package.json declares no dependencies — the manifest half would pass vacuously',
    ).toBeGreaterThan(0);

    const manifestOffences = offencesInManifest(deps, BANNED_STYLING_TOKENS);
    expect(
      manifestOffences,
      `banned-styling group: ${deps.length} declared packages checked, ${manifestOffences.length} offence(s)`,
    ).toEqual([]);
  });

  it('3. banned motion package: framer-motion absent from src/ and from package.json', () => {
    const files = walkScannedFiles(SOURCE_ROOT);
    expect(
      files.length,
      'banned-motion group: the scan read no source files under src/ — it would pass vacuously',
    ).toBeGreaterThan(0);

    const sourceOffences = offencesInSource(files, [BANNED_MOTION_TOKEN]);
    expect(
      sourceOffences,
      `banned-motion group: ${files.length} files scanned, ${sourceOffences.length} offence(s)`,
    ).toEqual([]);

    const deps = declaredDependencies();
    expect(
      deps.length,
      'banned-motion group: package.json declares no dependencies — the manifest half would pass vacuously',
    ).toBeGreaterThan(0);

    const manifestOffences = offencesInManifest(deps, [BANNED_MOTION_TOKEN]);
    expect(
      manifestOffences,
      `banned-motion group: ${deps.length} declared packages checked, ${manifestOffences.length} offence(s)`,
    ).toEqual([]);
  });

  it('4. permits the approved motion library — the gate cannot widen into rejecting it', () => {
    // The predicate itself: the approved package is not matched, the banned one
    // is. Without this, a future widening (a bare `motion` token) would reject
    // the library the design system permits (A9) and only surface in Phase 15.
    expect(matchesBannedToken(APPROVED_MOTION_PACKAGE, [BANNED_MOTION_TOKEN])).toBe(false);
    expect(matchesBannedToken(BANNED_MOTION_TOKEN, [BANNED_MOTION_TOKEN])).toBe(true);

    // And the non-match is real, not vacuous: the approved package is declared
    // and the manifest scan passes over it.
    const deps = declaredDependencies();
    expect(deps.map(({ name }) => name)).toContain(APPROVED_MOTION_PACKAGE);
    expect(offencesInManifest(deps, [BANNED_MOTION_TOKEN])).toEqual([]);
  });
});
