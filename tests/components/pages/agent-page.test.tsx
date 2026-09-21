import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import { AgentPage } from '@/components/pages/AgentPage';
import { format, t } from '@/core/i18n/strings';

/**
 * Agent page shell suite (plan `01-12`, Task 2) — the D-16 `deferred-shell`
 * disposition for the owning roadmap phase 15.
 *
 * The presence/absence pair is asserted deliberately: a false marker is as much
 * a defect as a missing one.
 */

function renderWithAntd(ui: React.ReactElement) {
  return render(
    <ConfigProvider>
      <App>{ui}</App>
    </ConfigProvider>,
  );
}

describe('AgentPage — deferred-shell (D-16)', () => {
  it('marks the page root deferred and carries no second marker', () => {
    const { container } = renderWithAntd(<AgentPage />);

    const marked = Array.from(container.querySelectorAll('[data-np-backing]'));
    expect(marked).toHaveLength(1);
    expect(marked[0].getAttribute('data-np-backing')).toBe('deferred');
    expect(marked[0].getAttribute('data-testid')).toBe('np-page-agent');
  });

  it('names the owning roadmap phase through the phase-body copy', () => {
    renderWithAntd(<AgentPage />);

    const phaseSentence = format('deferred.phaseBody', { phase: 15 });
    expect(phaseSentence).toBe('This page arrives in Phase 15.');
    expect(screen.getAllByText(new RegExp(phaseSentence)).length).toBeGreaterThan(0);
  });

  it('renders no skeleton and no spin for deferred functionality', () => {
    const { container } = renderWithAntd(<AgentPage />);

    expect(container.querySelector('.ant-skeleton')).toBeNull();
    expect(container.querySelector('.ant-spin')).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('renders no enabled control that would require a later-phase service', () => {
    const { container } = renderWithAntd(<AgentPage />);

    const controls = Array.from(container.querySelectorAll('button, a, input, select'));
    for (const control of controls) {
      const disabled =
        (control as HTMLButtonElement).disabled ||
        control.getAttribute('aria-disabled') === 'true';
      expect(disabled).toBe(true);
    }
  });

  it('replaces the bare Empty with the intentional deferred panel', () => {
    const { container } = renderWithAntd(<AgentPage />);

    expect(screen.getByText(t('agent.empty'))).toBeTruthy();
    expect(container.querySelector('.ant-empty')).toBeNull();
  });
});
