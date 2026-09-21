import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ToolsGridPanel } from '@/components/standalone/ToolsGridPanel';
import { format } from '@/core/i18n/strings';

/**
 * Tools route suite (plan `01-12`, Task 2) — the D-16 `fixture-preview`
 * disposition for the preserved tool catalog (owning roadmap phase 18).
 *
 * The prototype reported a fabricated "Done!" success after a timer; the
 * disposition requires a deterministic local catalog with every tool operation
 * disabled and marked.
 */

const SOURCE = join(process.cwd(), 'src', 'components', 'standalone', 'ToolsGridPanel.tsx');

function renderWithAntd(ui: React.ReactElement) {
  return render(
    <ConfigProvider>
      <App>{ui}</App>
    </ConfigProvider>,
  );
}

describe('ToolsGridPanel — fixture-preview (D-16)', () => {
  it('marks the page root fixture and never claims deferred', () => {
    renderWithAntd(<ToolsGridPanel />);

    const root = screen.getByTestId('np-page-tools');
    expect(root.getAttribute('data-np-backing')).toBe('fixture');
    expect(root.getAttribute('data-np-backing')).not.toBe('deferred');
  });

  it('names the owning roadmap phase through the phase-body copy', () => {
    renderWithAntd(<ToolsGridPanel />);

    expect(
      screen.getAllByText(new RegExp(format('deferred.phaseBody', { phase: 18 }))).length,
    ).toBeGreaterThan(0);
  });

  it('renders no skeleton for the fixture catalog', () => {
    const { container } = renderWithAntd(<ToolsGridPanel />);

    expect(container.querySelector('.ant-skeleton')).toBeNull();
  });

  it('disables and marks the tool runner instead of fabricating a result', () => {
    renderWithAntd(<ToolsGridPanel />);

    // Opening a catalog card is presentation only; the run control inside must
    // be inert and marked.
    fireEvent.click(screen.getByText('ChatPDF'));

    const run = screen.getByText('Run Tool').closest('button') as HTMLButtonElement;
    expect(run.disabled).toBe(true);
    expect(run.getAttribute('data-np-backing')).toBe('deferred');

    expect(screen.queryByText('Done!')).toBeNull();
    expect(screen.queryByText(/Analysis complete for/)).toBeNull();
  });

  it('keeps the deterministic local catalog as the populated state', () => {
    const { container } = renderWithAntd(<ToolsGridPanel />);

    expect(screen.getByText('ChatPDF')).toBeTruthy();
    expect(screen.getByText('Deep research')).toBeTruthy();
    expect(container.querySelectorAll('.ant-card').length).toBeGreaterThanOrEqual(5);
  });

  it('simulates no tool operation and starts no timer', () => {
    const source = readFileSync(SOURCE, 'utf8');

    expect(source).not.toMatch(/setTimeout\s*\(/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toContain('useExtensionStore');
    expect(source).not.toContain("'Done!'");
  });
});
