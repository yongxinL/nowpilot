import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { App, ConfigProvider } from 'antd';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NotesWorkspace } from '@/components/notes/NotesWorkspace';
import { ErrorBoundary } from '@/core/components/ErrorBoundary';
import { format, t } from '@/core/i18n/strings';

/**
 * Notes route suite (plan `01-12`, Task 2) — the D-16 `fixture-preview`
 * disposition for the preserved `notes/NotesWorkspace` presentation (owning
 * roadmap phase 8).
 *
 * The suite asserts the three things the disposition actually requires: the
 * marker pair, the owning phase, and the absence of any store or network
 * coupling (fixture state stays in the component — hard rule 4).
 */

const SOURCE = join(process.cwd(), 'src', 'components', 'notes', 'NotesWorkspace.tsx');

function renderWithAntd(ui: React.ReactElement) {
  return render(
    <ConfigProvider>
      <App>{ui}</App>
    </ConfigProvider>,
  );
}

// The workspace reveals its Inspector column (which holds the deferred
// AI-summary control) only at the widest breakpoint.
const originalInnerWidth = window.innerWidth;

beforeEach(() => {
  window.innerWidth = 1600;
});

afterEach(() => {
  window.innerWidth = originalInnerWidth;
});

describe('NotesWorkspace — fixture-preview (D-16)', () => {
  it('marks the page root fixture and carries no deferred marker of its own', () => {
    const { container } = renderWithAntd(<NotesWorkspace />);

    const root = screen.getByTestId('np-page-notes');
    expect(root.getAttribute('data-np-backing')).toBe('fixture');

    // Controls inside the page carry their own `deferred` markers; the page root
    // never claims `deferred`.
    expect(root.getAttribute('data-np-backing')).not.toBe('deferred');
    expect(container.querySelectorAll('[data-np-backing="fixture"]').length).toBe(1);
  });

  it('names the owning roadmap phase through the phase-body copy', () => {
    renderWithAntd(<NotesWorkspace />);

    expect(screen.getAllByText(new RegExp(format('deferred.phaseBody', { phase: 8 }))).length)
      .toBeGreaterThan(0);
  });

  it('renders no skeleton for a fixture-backed presentation', () => {
    const { container } = renderWithAntd(<NotesWorkspace />);

    expect(container.querySelector('.ant-skeleton')).toBeNull();
  });

  it('disables and marks every later-phase operation instead of simulating it', () => {
    renderWithAntd(<NotesWorkspace />);

    for (const label of ['Regenerate', 'Import', 'Export as Markdown', 'Export as PDF', 'Move to...']) {
      const control = screen.getByText(label).closest('button') as HTMLButtonElement | null;
      expect(control, `${label} is not rendered as a control`).not.toBeNull();
      expect(control?.disabled, `${label} is present but not disabled`).toBe(true);
      expect(
        (control as HTMLElement).getAttribute('data-np-backing'),
        `${label} is disabled but unmarked`,
      ).toBe('deferred');
    }
  });

  it('keeps the populated and long-text states standing on deterministic local fixtures', () => {
    const { container } = renderWithAntd(<NotesWorkspace />);

    // The fixture set renders a populated state (not a perpetual empty shell).
    expect(container.textContent).toContain('ServiceNow');
    expect(container.textContent?.length ?? 0).toBeGreaterThan(500);
  });

  it('couples to no store and starts no timer-driven success', () => {
    const source = readFileSync(SOURCE, 'utf8');

    // Hard rule 4: fixture content must not reach a persistent store.
    expect(source).not.toContain('useExtensionStore');
    // Hard rule 3: no timer-driven success.
    expect(source).not.toMatch(/setTimeout\s*\(/);
    // No network from a fixture page.
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });

  it('never claims a provider or health signal', () => {
    const { container } = renderWithAntd(<NotesWorkspace />);
    const text = container.textContent ?? '';

    expect(text).not.toMatch(/Connected|Healthy|API key valid/i);
    expect(container.querySelector('.ant-badge-status-success')).toBeNull();
  });
});

describe('NotesWorkspace — deleting the last note (CR-03)', () => {
  it('renders the explicit empty state instead of the shell error fallback', async () => {
    renderWithAntd(
      <ErrorBoundary>
        <NotesWorkspace />
      </ErrorBoundary>,
    );

    const cards = (): HTMLElement[] =>
      Array.from(document.querySelectorAll('[data-testid^="np-note-card-"]')) as HTMLElement[];

    // The five-note fixture is the populated state.
    expect(cards().length).toBe(5);

    // Delete every note through the card hover `Popconfirm` (the delete
    // affordance is hover-only, and the confirmation is required).
    for (let guard = 0; guard < 10 && cards().length > 0; guard += 1) {
      const card = cards()[0];
      const before = cards().length;

      fireEvent.mouseOver(card);
      const deleteButton = card.querySelector('.anticon-delete')?.closest('button');
      expect(deleteButton, 'the hover delete affordance is not rendered').not.toBeNull();
      fireEvent.click(deleteButton as HTMLButtonElement);

      const popover = Array.from(document.querySelectorAll('.ant-popover')).pop();
      expect(popover, 'the delete confirmation did not open').toBeDefined();
      fireEvent.click(within(popover as HTMLElement).getByText('Delete'));

      await waitFor(() => expect(cards().length).toBe(before - 1));
    }

    // The empty list renders the explicit empty state — never the boundary.
    expect(cards().length).toBe(0);
    expect(screen.getByTestId('np-page-notes-empty')).toBeTruthy();
    expect(screen.queryByText(t('shell.errorTitle'))).toBeNull();
  });
});
