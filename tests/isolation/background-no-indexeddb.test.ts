import { describe, it, expect } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Background-service-worker IndexedDB isolation gate (§0.2, WR-03).
 *
 * §0.2 is a project hard rule: the background service worker must never reach
 * IndexedDB — no `src/core/storage/**` module, no `idb` package and no
 * IndexedDB global. `NowPilotDB.ts` claimed the boundary was "asserted by the
 * phase's isolation gate" while no gate inspected the SW's import graph, so a
 * future edit that imported the store or the database from the background would
 * compile, keep every phase suite green, and only surface as a runtime MV3
 * failure. This suite is that gate: it resolves `src/entrypoints/background.ts`'s
 * transitive relative import graph and fails on any IndexedDB capability on it.
 *
 * The resolver and the violation predicate are pure functions, exercised by
 * in-memory self-tests so the gate cannot pass vacuously — the same pattern
 * `tests/isolation/banned-imports.test.ts` and `cross-entrypoint-imports.test.ts`
 * use. Relative specifiers that do not resolve are reported and asserted empty
 * for the real graph, so a new import form cannot silently escape the gate.
 * The `@/` and `~/` aliases (tsconfig `paths` / `vitest.config.ts`) resolve
 * into `src/` here too (IN-07): an aliased storage import compiles, resolves
 * under the project aliases, and would otherwise evade the path check.
 *
 * Read-only by construction: it scans and asserts; it writes nothing.
 */

const SRC_ROOT = join(process.cwd(), 'src');
const STORAGE_ROOT = join(SRC_ROOT, 'core', 'storage');
const BACKGROUND_ENTRY = join(SRC_ROOT, 'entrypoints', 'background.ts');

/** The extensions a relative specifier may resolve to (WXT/Vite/TS resolution). */
const RESOLUTION_SUFFIXES = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx'] as const;

/** The banned bare specifier: `idb` and any future `idb/*` sub-path. */
const BANNED_PACKAGE = 'idb';

/**
 * `src/core/storage/**` modules that are IndexedDB-free by construction and
 * legitimately reachable from the SW: `legacyCredentialCleanup` is an
 * import-free reader/writer of `chrome.storage.local` (D-07). The exception is
 * per-module, never per-directory — and the capability scan below still covers
 * each allow-listed file, so this list only exempts the *path* check.
 */
const STORAGE_MODULES_WITHOUT_INDEXEDDB = ['legacyCredentialCleanup.ts'] as const;

/** Tokens that mean the file touches an IndexedDB capability directly. */
const INDEXEDDB_GLOBAL_RE = /\bindexedDB\b|\bIDBDatabase\b|\bIDBFactory\b|\bIDBObjectStore\b/;

/** Strip comments before scanning: prose that *names* IndexedDB is not usage. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

export interface ImportEdge {
  /** The importing file (absolute). */
  from: string;
  /** The raw specifier as written. */
  spec: string;
  /** The resolved absolute file for a relative specifier; null for a bare one. */
  resolved: string | null;
}

export interface ImportGraph {
  /** Every file reachable from the entry, including the entry itself. */
  files: Set<string>;
  /** Every import edge walked (relative and bare). */
  edges: ImportEdge[];
  /** Relative specifiers that did not resolve to a file — a gate blind spot. */
  unresolved: ImportEdge[];
}

/** Every module specifier in a source file: static, re-export and dynamic. */
export function importSpecifiers(source: string): string[] {
  const stripped = stripComments(source);
  const specs = new Set<string>();

  const patterns = [
    /from\s+['"]([^'"]+)['"]/g, // import/export … from '…'
    /^\s*import\s+['"]([^'"]+)['"]/gm, // side-effect import '…'
    /import\(\s*['"]([^'"]+)['"]\s*\)/g, // dynamic import('…')
  ];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(stripped)) !== null) specs.add(match[1]);
  }
  return [...specs];
}

/** The project aliases that resolve into `src/` (tsconfig `paths`, vitest alias). */
const SRC_ALIASES = ['@/', '~/'] as const;

/** A specifier the gate is expected to resolve: relative or a `src/` alias. */
function isProjectSpecifier(spec: string): boolean {
  return spec.startsWith('.') || SRC_ALIASES.some((prefix) => spec.startsWith(prefix));
}

/** The candidate base path for a relative or aliased specifier, else null. */
function resolveBase(fromFile: string, spec: string): string | null {
  const alias = SRC_ALIASES.find((prefix) => spec.startsWith(prefix));
  if (alias) return join(SRC_ROOT, spec.slice(alias.length));
  if (spec.startsWith('.')) return resolve(dirname(fromFile), spec);
  return null;
}

/** Resolve one specifier against the importing file, or null when it is external. */
export function resolveSpecifier(
  fromFile: string,
  spec: string,
  exists: (path: string) => boolean,
): string | null {
  const base = resolveBase(fromFile, spec);
  if (base === null) return null;
  if (exists(base)) return base;
  for (const suffix of RESOLUTION_SUFFIXES) {
    if (exists(`${base}${suffix}`)) return `${base}${suffix}`;
  }
  return null;
}

/** Walk the transitive relative import graph from `entry`. */
export function resolveImportGraph(
  entry: string,
  read: (path: string) => string | null,
): ImportGraph {
  const files = new Set<string>();
  const edges: ImportEdge[] = [];
  const unresolved: ImportEdge[] = [];
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (files.has(file)) continue;
    const source = read(file);
    if (source === null) continue;
    files.add(file);

    for (const spec of importSpecifiers(source)) {
      const resolved = resolveSpecifier(file, spec, (candidate) => read(candidate) !== null);
      const edge: ImportEdge = { from: file, spec, resolved };
      edges.push(edge);
      if (resolved === null) {
        if (isProjectSpecifier(spec)) unresolved.push(edge);
        continue;
      }
      if (!files.has(resolved)) queue.push(resolved);
    }
  }

  return { files, edges, unresolved };
}

/** Every IndexedDB capability on the graph — one row per violation. */
export function indexedDbViolations(
  graph: ImportGraph,
  read: (path: string) => string | null,
  storageRoot: string = STORAGE_ROOT,
): string[] {
  const violations: string[] = [];

  for (const file of graph.files) {
    const source = read(file);
    if (source === null) continue;
    if (INDEXEDDB_GLOBAL_RE.test(stripComments(source))) {
      violations.push(`${relative(file)}: references an IndexedDB global`);
    }
  }

  for (const edge of graph.edges) {
    if (edge.resolved === null) {
      if (edge.spec === BANNED_PACKAGE || edge.spec.startsWith(`${BANNED_PACKAGE}/`)) {
        violations.push(`${relative(edge.from)}: imports '${edge.spec}'`);
      }
      continue;
    }
    if (!edge.resolved.startsWith(storageRoot)) continue;
    if (
      STORAGE_MODULES_WITHOUT_INDEXEDDB.some(
        (name) => edge.resolved === join(storageRoot, name),
      )
    ) {
      continue;
    }
    violations.push(`${relative(edge.from)}: imports ${relative(edge.resolved)}`);
  }

  return violations;
}

const relative = (file: string): string => file.slice(process.cwd().length + 1);

/** A resolved specifier is a file, never a directory that happens to exist. */
const isFile = (path: string): boolean => {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
};

const realRead = (path: string): string | null =>
  isFile(path) ? readFileSync(path, 'utf8') : null;

describe('background SW IndexedDB isolation — the resolver and the predicate (self-test)', () => {
  it('walks transitive relative imports, including re-exports and dynamic imports', () => {
    const files = new Map<string, string>([
      [`${SRC_ROOT}/entry.ts`, `import { a } from './a';\nexport { b } from './nested/b';\nvoid import('./lazy');`],
      [`${SRC_ROOT}/a.ts`, `import type { C } from './nested/c';`],
      [`${SRC_ROOT}/nested/b.ts`, `export const b = 1;`],
      [`${SRC_ROOT}/nested/c.ts`, `export type C = number;`],
      [`${SRC_ROOT}/lazy.ts`, `export const lazy = 1;`],
    ]);
    const read = (path: string): string | null => files.get(path) ?? null;

    const graph = resolveImportGraph(`${SRC_ROOT}/entry.ts`, read);

    expect([...graph.files].sort()).toEqual(
      [
        `${SRC_ROOT}/a.ts`,
        `${SRC_ROOT}/entry.ts`,
        `${SRC_ROOT}/lazy.ts`,
        `${SRC_ROOT}/nested/b.ts`,
        `${SRC_ROOT}/nested/c.ts`,
      ].sort(),
    );
    expect(graph.unresolved).toEqual([]);
  });

  it('fails the gate on a storage import and on the idb package (never vacuous)', () => {
    const files = new Map<string, string>([
      [`${SRC_ROOT}/entry.ts`, `import { db } from './core/storage/NowPilotDB';`],
      [`${SRC_ROOT}/core/storage/NowPilotDB.ts`, `import { openDB } from 'idb';`],
    ]);
    const read = (path: string): string | null => files.get(path) ?? null;

    const violations = indexedDbViolations(resolveImportGraph(`${SRC_ROOT}/entry.ts`, read), read);

    expect(violations).toEqual([
      expect.stringContaining('core/storage/NowPilotDB.ts'),
      expect.stringContaining("imports 'idb'"),
    ]);
  });

  it('resolves the @/ and ~/ aliases into src and still flags a storage import (IN-07)', () => {
    const files = new Map<string, string>([
      [
        `${SRC_ROOT}/entry.ts`,
        `import { getDb } from '@/core/storage/NowPilotDB';\nexport { x } from '~/core/storage/WriteJournal';`,
      ],
      [`${SRC_ROOT}/core/storage/NowPilotDB.ts`, `import { openDB } from 'idb';`],
      [`${SRC_ROOT}/core/storage/WriteJournal.ts`, `export const x = 1;`],
    ]);
    const read = (path: string): string | null => files.get(path) ?? null;

    const graph = resolveImportGraph(`${SRC_ROOT}/entry.ts`, read);

    expect(graph.unresolved).toEqual([]);
    expect(indexedDbViolations(graph, read)).toEqual([
      expect.stringContaining('src/entry.ts: imports src/core/storage/NowPilotDB.ts'),
      expect.stringContaining('src/entry.ts: imports src/core/storage/WriteJournal.ts'),
      expect.stringContaining("imports 'idb'"),
    ]);
  });

  it('fails the gate on a direct IndexedDB global and passes a clean graph', () => {
    const dirty = new Map<string, string>([
      [`${SRC_ROOT}/entry.ts`, `const request = indexedDB.open('np_db', 1);`],
    ]);
    const clean = new Map<string, string>([
      [`${SRC_ROOT}/entry.ts`, `import { z } from 'zod';\nexport const schema = z.string();`],
    ]);
    const readFrom =
      (files: Map<string, string>) =>
      (path: string): string | null =>
        files.get(path) ?? null;

    expect(
      indexedDbViolations(resolveImportGraph(`${SRC_ROOT}/entry.ts`, readFrom(dirty)), readFrom(dirty)),
    ).toEqual([expect.stringContaining('references an IndexedDB global')]);
    expect(
      indexedDbViolations(resolveImportGraph(`${SRC_ROOT}/entry.ts`, readFrom(clean)), readFrom(clean)),
    ).toEqual([]);
  });

  it('reports a project specifier that does not resolve, rather than ignoring it', () => {
    const files = new Map<string, string>([
      [`${SRC_ROOT}/entry.ts`, `import './missing/module';\nimport '@/missing/alias';`],
    ]);
    const read = (path: string): string | null => files.get(path) ?? null;

    const graph = resolveImportGraph(`${SRC_ROOT}/entry.ts`, read);

    expect(graph.unresolved.map((edge) => edge.spec)).toEqual([
      './missing/module',
      '@/missing/alias',
    ]);
  });
});

describe('background SW IndexedDB isolation — the real import graph (§0.2)', () => {
  it('reaches no src/core/storage module, no idb package and no IndexedDB global', () => {
    const graph = resolveImportGraph(BACKGROUND_ENTRY, realRead);

    // Non-vacuity: the entry resolved and its real neighbours were walked.
    expect(graph.files.has(BACKGROUND_ENTRY)).toBe(true);
    expect(graph.files.size).toBeGreaterThan(3);
    expect(graph.files.has(join(SRC_ROOT, 'core', 'log', 'debugLog.ts'))).toBe(true);
    // Every relative import resolved: an unresolved one is a blind spot, not a pass.
    expect(graph.unresolved.map((edge) => `${relative(edge.from)} -> ${edge.spec}`)).toEqual([]);

    expect(indexedDbViolations(graph, realRead)).toEqual([]);
  });

  it('the phase gate runs this suite (verify:phase-2 includes tests/isolation)', () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(manifest.scripts['verify:phase-2']).toContain('tests/isolation');
  });
});
