import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Content script bundle isolation test (D-20).
 *
 * Enforces the hard constraints that keep the content script extraction-only:
 * 1. No React, AntD, defuddle, yaml, or File System Access API imports
 *    anywhere in src/core/content/ or entrypoints/content.core.ts.
 * 2. Built content script bundle < 50KB (WXT build output).
 * 3. Defense-in-depth: no banned package strings in the built bundle.
 * 4. DomSerializer uses read-only DOM access only (no host-page mutation APIs).
 */

const CONTENT_SOURCE_DIRS = 'src/core/content/ entrypoints/content.core.ts';

describe('content script bundle isolation (D-20)', () => {
  // ── Test 1: No banned imports in content-core source files ──────────
  it('contains no banned imports (defuddle, readability, react, antd, yaml, FS Access) in content-core source files', () => {
    const bannedPatterns = [
      "from ['\\\"]defuddle['\\\"]",
      "from ['\\\"]@mozilla/readability['\\\"]",
      "from ['\\\"]react['\\\"]",
      "from ['\\\"]antd['\\\"]",
      "from ['\\\"]yaml['\\\"]",
      'showDirectoryPicker',
      'showOpenFilePicker',
      'showSaveFilePicker',
      'FileSystemFileHandle',
      'FileSystemDirectoryHandle',
    ];
    const pattern = bannedPatterns.join('|');

    const raw = execSync(
      `grep -rn -E "${pattern}" ${CONTENT_SOURCE_DIRS} 2>/dev/null || true`,
    ).toString();

    const lines = raw
      .split('\n')
      .filter((l) => l.trim())
      .filter((l) => !/^\s*\/\//.test(l)) // exclude comment-only lines
      .filter((l) => !/^\s*\/\*/.test(l)) // exclude block comment start
      .filter((l) => !l.includes('__tests__')) // exclude test directories
      .filter((l) => !l.includes('.test.')) // exclude test files
      .filter((l) => !l.includes('.spec.')); // exclude spec files

    // Also filter out lines that are inside /* */ comments
    const filtered: string[] = [];
    for (const line of lines) {
      const contentAfterPath = line.replace(/^[^:]+:\d+:/, '');
      // Skip if the line content (trimmed) is only a comment
      const trimmed = contentAfterPath.trim();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) {
        continue;
      }
      filtered.push(line);
    }

    expect(filtered).toHaveLength(0);
  });

  // ── Test 2: Content bundle size < 50KB ─────────────────────────────
  it('has a built content script bundle under 50KB', () => {
    const outputDir = path.resolve('.output/chrome-mv3/content-scripts');

    if (!fs.existsSync(outputDir)) {
      // No build output yet — graceful skip
      console.warn(
        'No build output at .output/chrome-mv3/content-scripts — run `pnpm run build` first to verify bundle size.',
      );
      return;
    }

    const files = fs.readdirSync(outputDir).filter((f) => f.endsWith('.js'));
    if (files.length === 0) {
      console.warn(
        'No .js files found in .output/chrome-mv3/content-scripts — skipping bundle size check.',
      );
      return;
    }

    for (const file of files) {
      const filePath = path.join(outputDir, file);
      const size = fs.statSync(filePath).size;
      expect(size).toBeLessThan(50 * 1024);
    }
  });

  // ── Test 3: No banned package names in built content bundle ─────────
  it('contains no banned package names (defuddle, readability, react, antd, yaml) in the built content bundle', () => {
    const outputDir = path.resolve('.output/chrome-mv3/content-scripts');

    if (!fs.existsSync(outputDir)) {
      console.warn(
        'No build output at .output/chrome-mv3/content-scripts — skipping built-bundle string check.',
      );
      return;
    }

    const files = fs.readdirSync(outputDir).filter((f) => f.endsWith('.js'));
    if (files.length === 0) {
      console.warn(
        'No .js files found in .output/chrome-mv3/content-scripts — skipping built-bundle string check.',
      );
      return;
    }

    const bannedStrings = ['defuddle', 'readability', 'react', 'antd', 'yaml'];

    for (const file of files) {
      const content = fs.readFileSync(path.join(outputDir, file), 'utf-8');
      for (const banned of bannedStrings) {
        if (content.includes(banned)) {
          throw new Error(
            `Built content bundle "${file}" contains banned string: "${banned}"`,
          );
        }
      }
    }

    // If we got here, no banned strings found
    expect(true).toBe(true);
  });

  // ── Test 4: DomSerializer uses read-only DOM access ─────────────────
  it('confirms DomSerializer uses read-only DOM access only (no host-page mutation APIs)', () => {
    const sourcePath = path.resolve('src/core/content/DomSerializer.ts');
    const source = fs.readFileSync(sourcePath, 'utf-8');

    // Banned mutation APIs that would indicate host-page mutation (§5.6 negative contract).
    // Note: .removeAttribute/.setAttribute on a cloned node (not the live document)
    // is the intentional D-02 password redaction path — NOT a host-page mutation.
    const bannedApis = [
      'document.createElement',
      'Element.prototype.appendChild',
      '.innerHTML =',
      '.innerHTML=',
      'insertAdjacentHTML',
    ];

    for (const api of bannedApis) {
      expect(source).not.toContain(api);
    }

    // Required read-only DOM access (defines the positive contract)
    const requiredApis = ['querySelectorAll', 'documentElement.outerHTML'];
    for (const api of requiredApis) {
      expect(source).toContain(api);
    }

    // Verify clone-based redaction: cloneNode + tagName check (not instanceof)
    expect(source).toContain('cloneNode');
    expect(source).toContain('tagName');

    // Also verify the file-level JSDoc declares the extraction-only contract
    expect(source).toContain('NEVER imports React, AntD');
  });
});
