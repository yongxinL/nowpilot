import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import {
  StandaloneShell,
  type StandaloneShellProps,
} from '../../src/components/standalone/StandaloneShell';
import { ErrorBoundary } from '../../src/core/components/ErrorBoundary';
import { t } from '../../src/core/i18n/strings';

/**
 * Standalone shell suite (plan `01-02`, Task 2).
 *
 * Pins **wiring and structure**, not copy: every expected string is resolved
 * through `t('…')`, so the suite is correct whether or not the canonical
 * string map has landed (copy exactness is pinned by
 * `tests/core/i18n/strings.test.ts` in plan `01-04`).
 */

/** The fixed canonical Sider Main group (DEC-OP-03) — registry data, not copy. */
const MAIN_ITEMS = ['Chat', 'Agent', 'Note', 'Write', 'Tools'];

function renderWithAntd(ui: React.ReactElement) {
  return render(<ConfigProvider>{ui}</ConfigProvider>);
}

const renderShell = (props?: Partial<StandaloneShellProps>) =>
  renderWithAntd(<StandaloneShell onOpenOptions={props?.onOpenOptions ?? vi.fn()} />);

const originalInnerWidth = window.innerWidth;

beforeEach(() => {
  window.innerWidth = 1024;
});

afterEach(() => {
  window.innerWidth = originalInnerWidth;
});

describe('StandaloneShell — canonical Sider', () => {
  it('renders exactly the canonical Main set, in order', () => {
    renderShell();

    const items = screen.getAllByTestId(/^np-sider-item-/);
    expect(items.map((el) => el.getAttribute('aria-label'))).toEqual(MAIN_ITEMS);
  });

  it('omits the Teams entry entirely', () => {
    renderShell();

    expect(screen.queryByTestId('np-sider-item-Teams')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Teams' })).toBeNull();
    expect(screen.queryByText('Teams')).toBeNull();
  });

  it('renders no Add-ons group label and no group separator at zero registrations', () => {
    renderShell();

    // An empty group header is never shown: the label AND its separator are
    // absent, not empty.
    expect(screen.queryByText(/add-ons/i)).toBeNull();
    expect(document.querySelectorAll('.ant-divider').length).toBe(0);
  });

  it('renders no account block and keeps the Settings entry', () => {
    renderShell();

    const sider = screen.getByTestId('np-sider');
    // Five Main items + the Settings/Options entry, and nothing else.
    expect(sider.querySelectorAll('button')).toHaveLength(MAIN_ITEMS.length + 1);
    // No identity exists in Phase 1, so no avatar/name/dropdown block renders.
    expect(sider.querySelectorAll('img').length).toBe(0);
    expect(sider.querySelectorAll('.ant-avatar').length).toBe(0);
    expect(sider.querySelectorAll('.ant-dropdown').length).toBe(0);
    expect(screen.queryByText(/user account/i)).toBeNull();
    expect(screen.getByTestId('np-sider-options')).toBeTruthy();
  });

  it('switches the content route when a Main item is selected', () => {
    renderShell();

    fireEvent.click(screen.getByTestId('np-sider-item-Write'));
    expect(screen.getByTestId('np-standalone-content')).toBeTruthy();

    fireEvent.click(screen.getByTestId('np-sider-item-Chat'));
    expect(screen.getByTestId('np-standalone-content')).toBeTruthy();
  });
});

describe('StandaloneShell — collapsed Sider accessibility', () => {
  it('keeps aria-label on icon-only items and hides only the visible labels', () => {
    renderShell();

    // Expanded: the labels are visible text.
    expect(screen.getByText('Chat')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: t('a11y.collapseSidebar') }));

    for (const label of MAIN_ITEMS) {
      expect(screen.getByRole('button', { name: label })).toBeTruthy();
      expect(screen.queryByText(label)).toBeNull();
    }
    expect(screen.getByRole('button', { name: t('a11y.expandSidebar') })).toBeTruthy();
  });

  it('keeps the active state visible through fill and weight, never colour alone', () => {
    renderShell();

    fireEvent.click(screen.getByRole('button', { name: t('a11y.collapseSidebar') }));

    const active = screen.getByTestId('np-sider-item-Chat');
    const inactive = screen.getByTestId('np-sider-item-Agent');

    expect(active.getAttribute('aria-current')).toBe('page');
    expect(active.style.fontWeight).toBe('600');
    expect(active.style.backgroundColor).not.toBe('transparent');
    expect(active.style.backgroundColor).not.toBe('');

    expect(inactive.getAttribute('aria-current')).toBeNull();
    expect(inactive.style.fontWeight).toBe('400');
    expect(inactive.style.backgroundColor).toBe('transparent');
  });
});

describe('StandaloneShell — minimum viewport', () => {
  it('renders the standalone.minWidth Alert below 1024 px without hiding content', () => {
    window.innerWidth = 900;
    renderShell();

    const alert = screen.getByTestId('np-min-width-alert');
    expect(alert.textContent).toContain(t('standalone.minWidth'));
    // Nothing is hidden destructively: the shell and its content stay mounted.
    expect(screen.getByTestId('np-sider')).toBeTruthy();
    expect(screen.getByTestId('np-standalone-content')).toBeTruthy();
  });

  it('does not render the Alert at 1024 px or wider (positive control)', () => {
    window.innerWidth = 1024;
    renderShell();

    expect(screen.queryByTestId('np-min-width-alert')).toBeNull();
  });
});

describe('StandaloneShell — marking discipline', () => {
  it('marks only the disabled global search field and no live region', () => {
    const { container } = renderShell();

    const marked = Array.from(container.querySelectorAll('[data-np-backing]'));
    expect(marked).toHaveLength(1);
    expect(marked[0].getAttribute('data-testid')).toBe('np-global-search');
    expect(marked[0].getAttribute('data-np-backing')).toBe('deferred');
    expect((marked[0] as HTMLInputElement).disabled).toBe(true);

    // A false marker is as much a defect as a missing one: the live Sider and
    // top bar carry none.
    for (const testId of ['np-sider', 'np-standalone-content']) {
      expect(screen.getByTestId(testId).hasAttribute('data-np-backing')).toBe(false);
    }
    for (const label of MAIN_ITEMS) {
      expect(screen.getByTestId(`np-sider-item-${label}`).hasAttribute('data-np-backing')).toBe(
        false,
      );
    }
  });
});

describe('ErrorBoundary — pinned shell error strings on the Standalone surface', () => {
  const Boom: React.FC = () => {
    throw new Error('render failure probe');
  };

  it('renders Result status 500 with the pinned shell strings, not AntD locale defaults', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = renderWithAntd(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(container.querySelector('.ant-result-500')).not.toBeNull();
    expect(screen.getByText(t('shell.errorTitle'))).toBeTruthy();
    expect(screen.getByText(t('shell.errorBody'))).toBeTruthy();
    expect(screen.getByRole('button', { name: t('shell.errorReload') })).toBeTruthy();
    expect(screen.queryByText('Sorry, something went wrong.')).toBeNull();

    consoleError.mockRestore();
  });
});
