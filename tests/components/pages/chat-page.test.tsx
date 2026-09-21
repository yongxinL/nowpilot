import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ChatPage } from '@/components/pages/ChatPage';
import { format, t } from '@/core/i18n/strings';

/**
 * Chat page shell suite (plan `01-12`, Task 2) **and** the repo-level marking
 * audit (Task 3).
 *
 * The page half pins the D-16 `deferred-shell` disposition: the root marker,
 * the owning roadmap phase, the absence of a skeleton and the absence of an
 * enabled later-phase control.
 *
 * The audit half makes `data-np-backing` the single greppable audit surface: a
 * source scan that fails on a third or ad-hoc backing value, and its inverse
 * that fails when a preserved page carries no marker at all. Both run against
 * the real `src/` tree and report a non-zero scanned-file count, so neither can
 * pass vacuously.
 */

function renderWithAntd(ui: React.ReactElement) {
  return render(
    <ConfigProvider>
      <App>{ui}</App>
    </ConfigProvider>,
  );
}

describe('ChatPage — deferred-shell (D-16)', () => {
  it('marks the page root deferred and marks no live region around it', () => {
    const { container } = renderWithAntd(<ChatPage />);

    const marked = Array.from(container.querySelectorAll('[data-np-backing]'));
    expect(marked).toHaveLength(1);
    expect(marked[0].getAttribute('data-np-backing')).toBe('deferred');
    expect(marked[0].getAttribute('data-testid')).toBe('np-page-chat');
    // The notice itself is never the marked element: the marker belongs to the
    // region root.
    expect((marked[0] as HTMLElement).className).not.toContain('ant-alert');
  });

  it('names the owning roadmap phase through the phase-body copy', () => {
    renderWithAntd(<ChatPage />);

    expect(format('deferred.phaseBody', { phase: 15 })).toContain('15');
    expect(screen.getByText(t('deferred.tag'))).toBeTruthy();
    expect(
      screen.getAllByText(new RegExp(format('deferred.phaseBody', { phase: 15 }))).length,
    ).toBeGreaterThan(0);
  });

  it('renders no skeleton and no loading indicator for deferred functionality', () => {
    const { container } = renderWithAntd(<ChatPage />);

    expect(container.querySelector('.ant-skeleton')).toBeNull();
    expect(container.querySelector('.ant-spin')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('renders no enabled control that would require a later-phase service', () => {
    const { container } = renderWithAntd(<ChatPage />);

    const controls = Array.from(container.querySelectorAll('button, a, input, select'));
    for (const control of controls) {
      const disabled =
        (control as HTMLButtonElement).disabled ||
        control.getAttribute('aria-disabled') === 'true';
      expect(disabled).toBe(true);
    }
  });

  it('holds the empty and long-text states without a bare AntD Empty', () => {
    const { container } = renderWithAntd(<ChatPage />);

    expect(screen.getByText(t('chat.empty'))).toBeTruthy();
    expect(screen.getByText(t('chat.emptyBody'))).toBeTruthy();
    // UI-SPEC: `Empty` is never used bare — the deferred panel replaces it.
    expect(container.querySelector('.ant-empty')).toBeNull();
  });
});

const SOURCE_ROOT = join(process.cwd(), 'src');

/**
 * Strip block and line comments before scanning. Prose that *describes* the
 * convention must not be able to trip the gate, and a marker quoted inside a
 * comment is not a marker (plan `01-09` recorded the same correction).
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function walkSourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...walkSourceFiles(full));
    else if (/\.tsx?$/.test(entry.name)) found.push(full);
  }
  return found;
}

const relativePath = (full: string) => full.slice(process.cwd().length + 1);

/**
 * Every file the inventory dispositions as a preserved page (`fixture-preview`
 * or `deferred-shell`). Each must carry at least one marker; a newly added page
 * cannot silently ship unmarked.
 */
const PRESERVED_PAGE_FILES = [
  'src/components/pages/ChatPage.tsx',
  'src/components/pages/AgentPage.tsx',
  'src/components/notes/NotesWorkspace.tsx',
  'src/components/options/OptionsPage.tsx',
  'src/components/options/PromptsOptionsTab.tsx',
  'src/components/history/ChatHistoryModal.tsx',
  'src/components/standalone/StandaloneWritePage.tsx',
  'src/components/standalone/WriteHistoryDrawer.tsx',
  'src/components/standalone/ToolsGridPanel.tsx',
];

/** Files the inventory removes: neither marker, and no file at all. */
const REMOVED_FILES = [
  'src/components/pages/NotesPage.tsx',
  'src/components/pages/OptionsPage.tsx',
  'src/components/standalone/TeamsPanel.tsx',
  'src/components/standalone/WorkspaceSidebar.tsx',
];

describe('marking audit — data-np-backing is the single audit surface', () => {
  it('uses only the two Phase1Backing literals anywhere under src/', () => {
    const files = walkSourceFiles(SOURCE_ROOT);
    expect(files.length).toBeGreaterThan(0);

    const offences: string[] = [];
    let occurrences = 0;

    for (const file of files) {
      const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
      lines.forEach((line, index) => {
        if (!line.includes('data-np-backing')) return;
        occurrences += 1;
        const isLiteral =
          line.includes('data-np-backing="fixture"') ||
          line.includes('data-np-backing="deferred"');
        if (!isLiteral) offences.push(`${relativePath(file)}:${index + 1}: ${line.trim()}`);
      });
    }

    expect(offences).toEqual([]);
    // The audit is only meaningful if it actually read markers.
    expect(occurrences).toBeGreaterThan(0);
  });

  it('marks every preserved page the inventory dispositions', () => {
    expect(PRESERVED_PAGE_FILES.length).toBeGreaterThan(0);

    for (const file of PRESERVED_PAGE_FILES) {
      const source = stripComments(readFileSync(join(process.cwd(), file), 'utf8'));
      expect(source, `${file} carries no data-np-backing marker`).toContain('data-np-backing=');
    }
  });

  it('leaves every removed file deleted, with neither marker nor residue', () => {
    for (const file of REMOVED_FILES) {
      expect(() => readFileSync(join(process.cwd(), file), 'utf8')).toThrow();
    }
  });

  it('keeps the marker a literal attribute and never a rendered variable', () => {
    const notice = stripComments(
      readFileSync(join(process.cwd(), 'src/components/common/DeferredNotice.tsx'), 'utf8'),
    );
    // The marker component never emits the attribute itself; the region owns it.
    expect(notice).not.toContain('data-np-backing');
  });
});
