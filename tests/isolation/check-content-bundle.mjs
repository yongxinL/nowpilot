#!/usr/bin/env node
// tests/isolation/check-content-bundle.mjs
// Source: §24 (line 3594) + Appendix G rules (line 5451-5455) + RESEARCH line 570.
//
// Walks the built .output for content-script bundles (plus any chunk named like a
// content entry) and exits non-zero if any forbidden token is found. The Appendix G
// isolation rule set: the content bundle MUST NOT include antd, @ant-design/x,
// @ant-design/x-markdown, react, react-dom, defuddle, or yaml.
//
// If no content bundle exists yet (wave 1 — plan 07 creates the content entrypoint),
// it exits 0: nothing to check yet.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const outDir = join(root, '.output');

// Appendix G forbidden tokens for the content bundle (checked as plain substrings).
const FORBIDDEN_TOKENS = ['antd', 'React', 'react-dom', 'defuddle', 'yaml'];

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

function isContentBundle(filePath) {
  const rel = relative(outDir, filePath).replace(/\\/g, '/');
  return (
    rel.startsWith('content-scripts/') ||
    /content[^/]*\.js$/.test(rel) ||
    (rel.includes('chunks/') && rel.includes('content'))
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
