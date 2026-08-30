import { describe, it, expect } from 'vitest';

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
 *
 * RED stage (TDD): FORBIDDEN_RE is a deliberately weak stub that matches nothing —
 * the self-tests below must FAIL against it, proving they exercise the real
 * forbidden set. The GREEN stage replaces the stub with the full §24 regex and
 * adds the real source/built-bundle greps.
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

// STUB (RED): matches nothing — replaced by the real §24 regex at GREEN.
const FORBIDDEN_RE = /(?!)/;

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

  it('catches a require() of a forbidden package', () => {
    expect(FORBIDDEN_RE.test(`const d = require('defuddle');`)).toBe(true);
  });

  it('catches the File System Access API (showDirectoryPicker)', () => {
    expect(FORBIDDEN_RE.test(`const dir = await showDirectoryPicker();`)).toBe(true);
  });

  it('catches the File System Access API (showOpenFilePicker)', () => {
    expect(FORBIDDEN_RE.test(`showOpenFilePicker({ multiple: true });`)).toBe(true);
  });
});