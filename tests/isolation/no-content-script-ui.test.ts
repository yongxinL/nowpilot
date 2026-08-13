// tests/isolation/no-content-script-ui.test.ts
// Source: §24 (line 3594) + Appendix G rule (line 5455) + RESEARCH Pitfall 4.
// §24/§18-named canonical isolation gate (D-4a-23): the retired
// tests/isolation/check-content-bundle.mjs walker folds INTO this file — the
// .mjs name no longer exists. All six verify chains (verify:phase-1..4 +
// verify:phase-4a) end at `vitest run`; this suite is the single enforcement
// point for:
//   1. forbidden-token scan over built content bundles (Appendix G isolation
//      rule) — Phase-1/2/3 sets + turndown/minisearch/readability (Pitfall 6)
//   2. payload size gate: sourcemap-STRIPPED bundle < 50 KB (Pitfall 3 / §22.1)
//   3. background SW scanned with the narrower R-3 set
//   4. D-4a-20 password-omission invariant at the schema boundary (P4a-4)
// @vitest-environment node
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { it, expect } from 'vitest';
import { FormControlSchema } from '@/core/extraction/apcLite.types';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const outDir = join(root, '.output');

// W-16 forbidden tokens for the content bundle (checked as plain substrings).
// One token per line — keep the count >= 6 for the plan's acceptance grep.
// The Phase-1/2/3 sets stay intact; 04a-09 ADDS turndown/minisearch/readability
// (RESEARCH Pitfall 6 — new content-side code must stay dependency-free).
const FORBIDDEN_TOKENS = [
  '@ant-design/x',
  '@ant-design/x-markdown',
  'antd',
  'React',
  'react',
  'react-dom',
  'defuddle',
  'yaml',
  // 02-11 (R-3): vault/IDB/network stack — the content bundle must never
  // include the storage layer or its test harness.
  'idb',
  'fflate',
  'KeyVault',
  'EncryptedStorage',
  'fake-indexeddb',
  // 03-09 (R-3, Pitfall 6): the AI runtime + @ai-sdk — content scripts are
  // extraction-only; the AI layer lives in Side Panel/Standalone exclusively.
  'ProviderRouter',
  'PlannerService',
  'ExecutorService',
  'RendererService',
  'AgentOrchestrator',
  'streamText',
  'generateText',
  'generateObject',
  // 04a-09 (Pitfall 6): the extraction libs run panel-side only — the content
  // bundle stays dependency-free.
  'turndown',
  'minisearch',
  'readability',
];

// R-3 forbidden tokens for the BACKGROUND SW (checked as plain substrings).
// The background is PROXY_FETCH / alarms / context menus / CORS proxy ONLY —
// it must never import the AI runtime (@ai-sdk + the Phase-3 orchestrator
// services) or touch the vault (KeyVault/EncryptedStorage). This set is
// intentionally NARROWER than FORBIDDEN_TOKENS: wxt's shared
// _virtual_wxt-plugins chunk legitimately pulls the react/antd chunk into the
// background entry (a build-system artifact, not a source import), so UI tokens
// are NOT asserted here — only the R-3 AI/vault boundary (Pitfall 6).
const BACKGROUND_FORBIDDEN_TOKENS = [
  'ProviderRouter',
  'PlannerService',
  'ExecutorService',
  'RendererService',
  'AgentOrchestrator',
  'streamText',
  'generateText',
  'generateObject',
  'KeyVault',
  'EncryptedStorage',
  'idb',
  'fflate',
];

async function walk(dir: string): Promise<string[]> {
  const entries: string[] = [];
  let items: string[];
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
 * (the content entry's output dir — wxt nests it under .output/<browser>/) or
 * is a shared chunk whose name matches the content entry ('core.content.ts' →
 * 'core'; chunks are emitted alongside content bundles).
 */
function isContentBundle(filePath: string): boolean {
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

it('content-script bundle contains no UI/antd/React (Appendix G isolation rule)', async () => {
  const allFiles = await walk(outDir);
  const contentBundles = allFiles.filter(isContentBundle);
  // Meaningful enforcement starts once a build produces content bundles — if
  // none exist yet there is nothing to check (§24).
  if (contentBundles.length === 0) return;

  const violations: string[] = [];
  for (const file of contentBundles) {
    const content = await readFile(file, 'utf8');
    for (const token of FORBIDDEN_TOKENS) {
      if (content.includes(token)) {
        violations.push(`${relative(outDir, file)} contains forbidden token: ${token}`);
      }
    }
  }
  expect(violations).toEqual([]);
});

/**
 * Strip the trailing inline sourcemap comment before measuring payload bytes.
 * RESEARCH Pitfall 3: wxt.config.ts sets sourcemap:'inline' for all builds — a
 * 21 KB payload reads 174 KB raw; the < 50 KB assertion measures the PAYLOAD
 * (sourcemap-stripped), never the raw file (§22.1 / ROADMAP criterion 3).
 *
 * Implemented via lastIndexOf + slice (not a `$`-anchored regex): the inline
 * base64 sourcemap ends with a trailing newline, and a JS `.*$` pattern cannot
 * cross that final newline (the `$` anchor only matches at end-of-input without
 * the `m` flag) — so regex-based stripping silently matches nothing.
 */
function stripInlineSourcemap(text: string): string {
  const idx = text.lastIndexOf('//# sourceMappingURL=');
  if (idx === -1) return text;
  return text.slice(0, idx);
}

it('content bundle payload stays under 50 KB (sourcemap-stripped, Pitfall 3)', async () => {
  const allFiles = await walk(outDir);
  const contentBundles = allFiles.filter(isContentBundle);
  if (contentBundles.length === 0) return;

  for (const file of contentBundles) {
    const content = await readFile(file, 'utf8');
    const payload = stripInlineSourcemap(content);
    expect(
      Buffer.byteLength(payload),
      `${relative(outDir, file)} payload exceeds 50 KB (sourcemap-stripped)`,
    ).toBeLessThan(50 * 1024);
  }
});

it('background SW contains no AI runtime or vault (R-3, Pitfall 6)', async () => {
  const allFiles = await walk(outDir);
  const backgroundBundles = allFiles.filter((f) => /background\.js$/.test(f));
  const violations: string[] = [];
  for (const file of backgroundBundles) {
    const content = await readFile(file, 'utf8');
    for (const token of BACKGROUND_FORBIDDEN_TOKENS) {
      if (content.includes(token)) {
        violations.push(
          `${relative(outDir, file)} (background SW) contains forbidden token: ${token}`,
        );
      }
    }
  }
  expect(violations).toEqual([]);
});

it('FormControlSchema omits password values at the schema boundary (D-4a-20, P4a-4)', () => {
  expect(FormControlSchema.safeParse({ isPassword: true, value: 'x' }).success).toBe(false);
  expect(FormControlSchema.safeParse({ isPassword: true, value: undefined }).success).toBe(true);
  expect(FormControlSchema.safeParse({ isPassword: true }).success).toBe(true);
});
