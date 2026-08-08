#!/usr/bin/env node
// tests/isolation/check-content-bundle.mjs
// Source: §24 (line 3594) + Appendix G rules (line 5451-5455) + RESEARCH line 570
// + 01-07 plan Task 4 (W-16 token set).
//
// Walks the built .output for content-script bundles (content-scripts/** plus any
// chunk whose name matches the content entry) and exits non-zero if any forbidden
// token is found. The Appendix G isolation rule set: the content bundle MUST NOT
// include @ant-design/x, @ant-design/x-markdown, antd, React, react (catches
// minified lowercase), react-dom, defuddle, or yaml (W-16).
//
// If no content bundle exists yet, it exits 0 with a note: nothing to check
// (meaningful enforcement starts once a build produces content bundles).
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const outDir = join(root, '.output');

// W-16 forbidden tokens for the content bundle (checked as plain substrings).
// One token per line — keep the count >= 6 for the plan's acceptance grep.
const FORBIDDEN_TOKENS = [
  '@ant-design/x',
  '@ant-design/x-markdown',
  'antd',
  'React',
  'react',
  'react-dom',
  'defuddle',
  'yaml',
];

async function walk(dir) {
  const entries = [];
  let items;
  try {
    items = await readdir(dir);
  } catch {
    return entries; // dir does not exist
  }
  for (const name of items) {
    const full = join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) {
      entries.push(...(await walk(full)));
    } else {
      entries.push(full);
    }
  }
  return entries;
}

/**
 * A file is a content bundle when it lives under a content-scripts/** directory
 * (the content entry's output dir — wxt nests it under .output/<browser>/) or is
 * a shared chunk whose name matches the content entry ('core.content.ts' →
 * 'core'; chunks are emitted alongside content bundles).
 */
function isContentBundle(filePath) {
  const rel = relative(outDir, filePath).replace(/\\/g, '/');
  // .output/<browser>/content-scripts/** — strip the per-browser prefix segment.
  const withoutBrowser = rel.split('/').slice(1).join('/');
  return (
    rel.startsWith('content-scripts/') ||
    withoutBrowser.startsWith('content-scripts/') ||
    /content[^/]*\.js$/.test(rel) ||
    (rel.includes('chunks/') && /core|content/.test(rel))
  );
}

const allFiles = await walk(outDir);
const contentBundles = allFiles.filter(isContentBundle);

if (contentBundles.length === 0) {
  console.log('check-content-bundle: no content bundle found — nothing to check yet');
  process.exit(0);
}

const violations = [];
for (const file of contentBundles) {
  const content = await readFile(file, 'utf8');
  for (const token of FORBIDDEN_TOKENS) {
    if (content.includes(token)) {
      violations.push(`${relative(outDir, file)} contains forbidden token: ${token}`);
    }
  }
}

if (violations.length > 0) {
  console.error('check-content-bundle: CONTENT BUNDLE ISOLATION VIOLATIONS');
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}

console.log(`check-content-bundle: ${contentBundles.length} content bundle(s) clean`);
process.exit(0);
