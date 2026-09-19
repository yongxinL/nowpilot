import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const STATIC_IMPORT_PATTERN = /(?:from\s*|import\s*\(?\s*)["']\.\/([^"']+\.js)["']/g;

export function collectModuleGraph(entryFile: string, _outDir: string): Map<string, string> {
  const graph = new Map<string, string>();
  const visited = new Set<string>();
  const queue = [resolve(entryFile)];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (visited.has(file) || !existsSync(file)) continue;
    visited.add(file);
    const source = readFileSync(file, 'utf8');
    graph.set(basename(file), source);
    for (const match of source.matchAll(STATIC_IMPORT_PATTERN)) {
      queue.push(resolve(dirname(file), match[1]!));
    }
  }
  return graph;
}

export function scanForbiddenMarkers(graph: Map<string, string>, markers: string[]): string[] {
  const found: string[] = [];
  for (const source of graph.values()) {
    for (const marker of markers) {
      if (source.includes(marker)) found.push(marker);
    }
  }
  return found;
}

export interface IsolationCheckResult {
  ok: boolean;
  failures: string[];
}

const BACKGROUND_FORBIDDEN_MARKERS = [
  'react.element',
  'ant-',
  'indexedDB',
  'IDBDatabase',
  'IDBKeyRange',
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  '@ai-sdk',
  'modelcontextprotocol',
];

const SIDEPANEL_FORBIDDEN_MARKERS = ['standalone-page-'];

function listJsFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listJsFiles(full));
    else if (entry.name.endsWith('.js')) files.push(full);
  }
  return files;
}

function entryFileNamed(dir: string, stem: string): string | undefined {
  const candidates = listJsFiles(dir).filter((file) => basename(file).startsWith(stem));
  return candidates[0];
}

export function checkBundleIsolation(outDir: string): IsolationCheckResult {
  const failures: string[] = [];

  const background = entryFileNamed(outDir, 'background');
  if (background) {
    const graph = collectModuleGraph(background, outDir);
    for (const hit of scanForbiddenMarkers(graph, BACKGROUND_FORBIDDEN_MARKERS)) {
      failures.push(`background bundle contains forbidden marker ${hit}`);
    }
  } else {
    failures.push('background bundle was not found in the build output');
  }

  const sidepanel = entryFileNamed(outDir, 'sidepanel');
  if (sidepanel) {
    const graph = collectModuleGraph(sidepanel, outDir);
    for (const hit of scanForbiddenMarkers(graph, SIDEPANEL_FORBIDDEN_MARKERS)) {
      failures.push(`sidepanel bundle contains standalone marker ${hit}`);
    }
  } else {
    failures.push('sidepanel bundle was not found in the build output');
  }

  const contentScripts = listJsFiles(outDir).filter((file) => basename(file).startsWith('content'));
  if (contentScripts.length > 0) {
    failures.push(`content-script bundle must not exist: ${contentScripts.join(',')}`);
  }

  return { ok: failures.length === 0, failures };
}
