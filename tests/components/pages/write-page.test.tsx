import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StandaloneWritePage } from '@/components/standalone/StandaloneWritePage';
import { format, t } from '@/core/i18n/strings';

/**
 * Write route suite (plan `01-12`, Task 2) — the D-16 `fixture-preview`
 * disposition for the preserved Write presentation (owning roadmap phase 17).
 *
 * The decisive assertions are the negative ones: the page must not simulate a
 * successful provider operation, must not invent a model or provider name, and
 * must not write fixture content anywhere persistent.
 */

const SOURCE = join(process.cwd(), 'src', 'components', 'standalone', 'StandaloneWritePage.tsx');

function renderWithAntd(ui: React.ReactElement) {
  return render(
    <ConfigProvider>
      <App>{ui}</App>
    </ConfigProvider>,
  );
}

describe('StandaloneWritePage — fixture-preview (D-16)', () => {
  it('marks the page root fixture and never claims deferred', () => {
    renderWithAntd(<StandaloneWritePage />);

    const root = screen.getByTestId('np-page-write');
    expect(root.getAttribute('data-np-backing')).toBe('fixture');
    expect(root.getAttribute('data-np-backing')).not.toBe('deferred');
  });

  it('names the owning roadmap phase through the phase-body copy', () => {
    renderWithAntd(<StandaloneWritePage />);

    expect(
      screen.getAllByText(new RegExp(format('deferred.phaseBody', { phase: 17 }))).length,
    ).toBeGreaterThan(0);
  });

  it('renders no skeleton and no fabricated generation state', () => {
    const { container } = renderWithAntd(<StandaloneWritePage />);

    expect(container.querySelector('.ant-skeleton')).toBeNull();
    expect(screen.queryByText('Generating...')).toBeNull();
    expect(screen.queryByText(/Generated and saved to history/)).toBeNull();
  });

  it('disables and marks every generation control instead of simulating one', () => {
    renderWithAntd(<StandaloneWritePage />);

    const submit = screen.getByText('Submit').closest('button') as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    expect(submit.getAttribute('data-np-backing')).toBe('deferred');

    // The two output-toolbar controls are icon-only, so they are located by
    // their pinned test ids rather than by visible copy.
    for (const testId of ['np-write-regenerate', 'np-write-rerun']) {
      const control = screen.getByTestId(testId) as HTMLButtonElement;
      expect(control.disabled).toBe(true);
      expect(control.getAttribute('data-np-backing')).toBe('deferred');
    }
  });

  it('renders the read-only workflow display and never a model identifier', () => {
    const { container } = renderWithAntd(<StandaloneWritePage />);

    expect(screen.getByTestId('np-write-workflow-display').textContent).toContain('Auto');
    expect(container.textContent).not.toMatch(/gpt-|claude-|gemini-|llama|gemma/i);
  });

  it('shows the no-provider caption instead of an invented provider name', () => {
    renderWithAntd(<StandaloneWritePage />);

    expect(screen.getByText(t('chat.noProvider'))).toBeTruthy();
  });

  it('keeps fixture state out of every persistent path', () => {
    const source = readFileSync(SOURCE, 'utf8');

    expect(source).not.toContain('useExtensionStore');
    expect(source).not.toMatch(/setTimeout\s*\(/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toContain('saveTextAsNote');
  });

  it('keeps its deterministic output fixture for the populated state', () => {
    const { container } = renderWithAntd(<StandaloneWritePage />);

    expect((container.textContent ?? '').length).toBeGreaterThan(400);
  });
});
