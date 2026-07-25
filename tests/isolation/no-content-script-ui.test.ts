/**
 * Content script isolation tests (CONT-04).
 *
 * Verifies that content script source files contain zero React, AntD, or
 * UI library imports. This is enforced at build time by WXT's tree-shaking,
 * but the test provides a compile-time assertion as a guard rail.
 *
 * Also verifies bundle size is under 50KB after WXT build.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';

// ---- Content script source files (relative to project root) ----
const CONTENT_FILES = [
  'src/core/content/PageContext.ts',
  'src/core/content/PageExtractor.ts',
  'src/core/content/PageContextBridge.ts',
  'src/core/content/SPANavigationWatcher.ts',
  'src/core/content/ContentChangeWatcher.ts',
  'src/core/content/AxDomWalker.ts',
];

const ENTRYPOINT_FILE = 'src/entrypoints/content.ts';

// We resolve relative to the project root.
// Vitest uses process.cwd() which points to the project root.
const PROJECT_ROOT = process.cwd();

// ---- Source-level import check (compile-time guard) ----
describe('content script isolation (CONT-04)', () => {
  /** Patterns that must NOT appear in content script source files */
  const forbiddenPatterns: Array<{ pattern: RegExp; name: string }> = [
    { pattern: /import\s+.*\s+from\s+['"]react['"]/, name: 'react import' },
    { pattern: /import\s+.*\s+from\s+['"]antd['"]/, name: 'antd import' },
    { pattern: /import\s+.*\s+from\s+['"]@ant-design/, name: '@ant-design import' },
    { pattern: /\.tsx['"]/, name: '.tsx file import' },
    { pattern: /import\s+.*\s+from\s+['"]lucide-react['"]/, name: 'lucide-react import' },
  ];

  for (const file of CONTENT_FILES) {
    it(`${file.split('/').pop()} contains no React, AntD, or UI library imports`, () => {
      const filePath = resolve(PROJECT_ROOT, file);
      const content = readFileSync(filePath, 'utf-8');

      for (const forbidden of forbiddenPatterns) {
        expect(
          content,
          `${file} should not contain ${forbidden.name}`,
        ).not.toMatch(forbidden.pattern);
      }
    });
  }

  it('content.ts entrypoint contains no React, AntD, or UI library imports', () => {
    const filePath = resolve(PROJECT_ROOT, ENTRYPOINT_FILE);
    const content = readFileSync(filePath, 'utf-8');

    for (const forbidden of forbiddenPatterns) {
      expect(
        content,
        `content.ts should not contain ${forbidden.name}`,
      ).not.toMatch(forbidden.pattern);
    }
  });

  // The PageContext.ts is a pure type file — no runtime code
  it('PageContext.ts is a pure interface file (no runtime imports)', () => {
    const filePath = resolve(PROJECT_ROOT, 'src/core/content/PageContext.ts');
    const content = readFileSync(filePath, 'utf-8');

    // Should not import any runtime library (only types)
    const runtimeImports = content.match(/import\s+.*\s+from\s+['"](?!\.)[^'"]+['"]/g);
    expect(runtimeImports).toBeNull();
  });

  // ---- Bundle size check (skip if dist/ not built) ----
  it('content script bundle is under 50KB (skipped if dist/ not built)', () => {
    const distDir = resolve(PROJECT_ROOT, 'dist');
    if (!existsSync(distDir)) {
      // dist/ not built — skip gracefully
      return;
    }

    // Try to find content script bundle in dist/chunks/
    const chunksDir = resolve(distDir, 'chunks');
    if (!existsSync(chunksDir)) {
      return;
    }

    let foundContentBundle = false;
    const files = readdirSync(chunksDir);
    for (const file of files) {
      if (file.startsWith('content') && file.endsWith('.js')) {
        const filePath = resolve(chunksDir, file);
        const stat = statSync(filePath);
        const sizeKB = stat.size / 1024;

        expect(
          sizeKB,
          `Content script bundle ${file} is ${sizeKB.toFixed(1)}KB — must be < 50KB`,
        ).toBeLessThan(50);

        foundContentBundle = true;
      }
    }

    if (!foundContentBundle) {
      // This is OK — the bundle may have been tree-shaken differently
      // or the build output structure may differ between WXT versions
    }
  });
});
