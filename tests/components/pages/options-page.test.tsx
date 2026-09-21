import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OptionsPage } from '@/components/options/OptionsPage';
import { format } from '@/core/i18n/strings';

/**
 * Options route suite (plan `01-12`, Task 2) — the D-16 `fixture-preview`
 * disposition for the preserved `options/OptionsPage` presentation (owning
 * roadmap phase 15).
 *
 * The credential strip and the store REPLACE on this file are plan `01-11`'s
 * declared work; this suite pins the disposition `01-12` applies: the marker
 * pair, the owning phase, no skeleton, and no reachable later-phase operation.
 */

const SOURCE = join(process.cwd(), 'src', 'components', 'options', 'OptionsPage.tsx');

function renderWithAntd(ui: React.ReactElement) {
  return render(
    <ConfigProvider>
      <App>{ui}</App>
    </ConfigProvider>,
  );
}

describe('options/OptionsPage — fixture-preview (D-16)', () => {
  it('marks the page root fixture and never claims deferred', () => {
    renderWithAntd(<OptionsPage />);

    const root = screen.getByTestId('np-page-options');
    expect(root.getAttribute('data-np-backing')).toBe('fixture');
    expect(root.getAttribute('data-np-backing')).not.toBe('deferred');
  });

  it('names the owning roadmap phase through the phase-body copy', () => {
    renderWithAntd(<OptionsPage />);

    expect(
      screen.getAllByText(new RegExp(format('deferred.phaseBody', { phase: 15 }))).length,
    ).toBeGreaterThan(0);
  });

  it('renders no skeleton for a fixture-backed presentation', () => {
    const { container } = renderWithAntd(<OptionsPage />);

    expect(container.querySelector('.ant-skeleton')).toBeNull();
  });

  it('reaches no provider service: the connection test is gone from the source', () => {
    const source = readFileSync(SOURCE, 'utf8');

    expect(source).not.toContain('testProviderConnection');
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toContain('createFixtureValidationPort');
  });

  it('disables and marks the provider connection test inside the modal', () => {
    renderWithAntd(<OptionsPage />);

    // Open a provider's configuration modal, which is where the later-phase
    // provider operations live.
    fireEvent.click(screen.getAllByText('Set up')[0]);

    const check = screen.getByText('Check').closest('button') as HTMLButtonElement;
    expect(check.disabled).toBe(true);
    expect(check.getAttribute('data-np-backing')).toBe('deferred');

    // The modal's Save control is disabled too: saving provider configuration
    // is a later-phase operation, not a Phase-1 behaviour.
    const save = screen.getByText('Save').closest('button') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
  });

  it('renders no fabricated health signal and no invented model list', () => {
    const { container } = renderWithAntd(<OptionsPage />);
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/Connected|Healthy|valid key/i);
    expect(container.querySelector('.ant-badge-status-success')).toBeNull();
  });
});
