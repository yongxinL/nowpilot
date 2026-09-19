import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { checkBundleIsolation, collectModuleGraph, scanForbiddenMarkers } from './isolationChecks';

const tempDirs: string[] = [];

function makeOutDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'np-isolation-'));
  tempDirs.push(dir);
  for (const [name, contents] of Object.entries(files)) {
    const full = join(dir, name);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, contents);
  }
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('collectModuleGraph', () => {
  it('follows static relative chunk imports', () => {
    const dir = makeOutDir({
      'background.js': 'import "./chunk-a.js";',
      'chunk-a.js': 'import "./chunk-b.js"; console.log("a");',
      'chunk-b.js': 'console.log("b");',
    });
    const graph = collectModuleGraph(join(dir, 'background.js'), dir);
    expect([...graph.keys()].sort()).toEqual(['background.js', 'chunk-a.js', 'chunk-b.js']);
  });

  it('follows relative imports inside a nested chunk directory', () => {
    const dir = makeOutDir({
      'chunks/sidepanel.js': 'import "./sidepanel-chunk.js";',
      'chunks/sidepanel-chunk.js': 'import "./sidepanel-leaf.js"; console.log("chunk");',
      'chunks/sidepanel-leaf.js': 'console.log("leaf");',
    });
    const graph = collectModuleGraph(join(dir, 'chunks/sidepanel.js'), dir);
    expect([...graph.keys()].sort()).toEqual([
      'sidepanel-chunk.js',
      'sidepanel-leaf.js',
      'sidepanel.js',
    ]);
  });

  it('does not conflate same-named files in different directories', () => {
    const dir = makeOutDir({
      'background.js': 'import "./chunks/entry.js"; import "./shared.js";',
      'chunks/entry.js': 'import "./shared.js"; console.log("entry");',
      'shared.js': 'console.log("root-shared");',
      'chunks/shared.js': 'console.log("chunks-shared");',
    });
    const graph = collectModuleGraph(join(dir, 'background.js'), dir);
    expect(graph.get('shared.js')).toContain('chunks-shared');
  });
});

describe('scanForbiddenMarkers', () => {
  it('reports markers found in the graph', () => {
    const graph = new Map([['background.js', 'const x = "indexedDB";']]);
    expect(scanForbiddenMarkers(graph, ['indexedDB', 'ant-'])).toEqual(['indexedDB']);
  });
});

describe('checkBundleIsolation', () => {
  it('passes a clean build output', () => {
    const dir = makeOutDir({
      'background.js': 'console.log("background");',
      'sidepanel.js': 'console.log("sidepanel");',
      'standalone.js': 'const id = "standalone-page-chat";',
    });
    expect(checkBundleIsolation(dir).ok).toBe(true);
  });

  it('fails when the background graph imports React', () => {
    const dir = makeOutDir({
      'background.js': 'import "./chunk-react.js";',
      'chunk-react.js': 'var e = Symbol.for("react.element");',
      'sidepanel.js': 'console.log("sidepanel");',
      'standalone.js': 'const id = "standalone-page-chat";',
    });
    const result = checkBundleIsolation(dir);
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('background');
  });

  it('fails when the side panel graph contains standalone page markers', () => {
    const dir = makeOutDir({
      'background.js': 'console.log("background");',
      'sidepanel.js': 'import "./chunk-standalone.js";',
      'chunk-standalone.js': 'const id = "standalone-page-agent";',
      'standalone.js': 'const id = "standalone-page-chat";',
    });
    const result = checkBundleIsolation(dir);
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('sidepanel');
  });

  it('fails when a nested background chunk contains a forbidden marker', () => {
    const dir = makeOutDir({
      'chunks/background.js': 'import "./vendor-react.js";',
      'chunks/vendor-react.js': 'var e = Symbol.for("react.element");',
      'sidepanel.js': 'console.log("sidepanel");',
      'standalone.js': 'const id = "standalone-page-chat";',
    });
    const result = checkBundleIsolation(dir);
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('background');
  });

  it('fails when a nested side panel chunk contains standalone page markers', () => {
    const dir = makeOutDir({
      'background.js': 'console.log("background");',
      'chunks/sidepanel.js': 'import "./vendor-standalone.js";',
      'chunks/vendor-standalone.js': 'const id = "standalone-page-agent";',
      'standalone.js': 'const id = "standalone-page-chat";',
    });
    const result = checkBundleIsolation(dir);
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('sidepanel');
  });

  it('fails when a content-script bundle exists', () => {
    const dir = makeOutDir({
      'background.js': 'console.log("background");',
      'sidepanel.js': 'console.log("sidepanel");',
      'standalone.js': 'const id = "standalone-page-chat";',
      'content-scripts/content.js': 'console.log("content");',
    });
    const result = checkBundleIsolation(dir);
    expect(result.ok).toBe(false);
    expect(result.failures.join(' ')).toContain('content');
  });
});
