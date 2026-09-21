import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { SidePanelShell } from '../../src/components/sidepanel/SidePanelShell';
import { ErrorBoundary } from '../../src/core/components/ErrorBoundary';
import { t } from '../../src/core/i18n/strings';

/**
 * Side Panel shell suite (plan `01-02`, Task 2).
 *
 * Pins **wiring and structure**, not copy: every expected string is resolved
 * through `t('…')`, so the suite is correct whether or not the canonical
 * string map has landed (copy exactness is pinned by
 * `tests/core/i18n/strings.test.ts` in plan `01-04`).
 */

function renderWithAntd(ui: React.ReactElement) {
  return render(<ConfigProvider>{ui}</ConfigProvider>);
}

const renderShell = (props?: Partial<React.ComponentProps<typeof SidePanelShell>>) =>
  renderWithAntd(
    <SidePanelShell
      onOpenStandalone={props?.onOpenStandalone ?? vi.fn()}
      onOpenOptions={props?.onOpenOptions ?? vi.fn()}
    />,
  );

describe('SidePanelShell — geometry and contract (UI-SPEC § Side Panel)', () => {
  it('has no Layout and no navigation rail', () => {
    const { container } = renderShell();

    // The Side Panel contract is explicit: the surface does **not** use AntD
    // `Layout` and carries no Sider/nav rail.
    expect(container.querySelector('.ant-layout')).toBeNull();
    expect(container.querySelector('.ant-layout-sider')).toBeNull();
    expect(container.querySelector('nav')).toBeNull();
  });

  it('exposes exactly two trailing header controls: Options and Switch to Full chat', () => {
    renderShell();

    const header = document.querySelector('header');
    expect(header).not.toBeNull();
    expect(header!.querySelectorAll('button')).toHaveLength(2);

    expect(screen.getByRole('button', { name: t('a11y.options') })).toBeTruthy();
    expect(screen.getByRole('button', { name: t('a11y.switchToFullChat') })).toBeTruthy();

    // No provider chip and no theme control in the header.
    expect(screen.queryByRole('button', { name: t('theme.toggle') })).toBeNull();
  });

  it('calls the surface callbacks from the two header controls', () => {
    const onOpenOptions = vi.fn();
    const onOpenStandalone = vi.fn();
    renderShell({ onOpenOptions, onOpenStandalone });

    fireEvent.click(screen.getByRole('button', { name: t('a11y.options') }));
    fireEvent.click(screen.getByRole('button', { name: t('a11y.switchToFullChat') }));

    expect(onOpenOptions).toHaveBeenCalledTimes(1);
    expect(onOpenStandalone).toHaveBeenCalledTimes(1);
  });

  it('renders the empty conversation state with zero fabricated messages', () => {
    renderShell();

    expect(screen.getByText(t('chat.empty'))).toBeTruthy();
    expect(screen.getByText(t('chat.emptyBody'))).toBeTruthy();
    // No message bubble / no streaming skeleton in Phase 1.
    expect(document.querySelectorAll('.ant-bubble').length).toBe(0);
    expect(document.querySelectorAll('.ant-skeleton').length).toBe(0);
  });
});

describe('SidePanelShell — composer contract', () => {
  it('renders Attach, Chat history and New chat as disabled deferred controls', () => {
    renderShell();

    for (const label of [t('a11y.attach'), t('a11y.chatHistory'), t('a11y.newChat')]) {
      const control = screen.getByRole('button', { name: label }) as HTMLButtonElement;
      expect(control.disabled, `${label} must be disabled`).toBe(true);
      expect(control.getAttribute('data-np-backing'), `${label} must be marked`).toBe('deferred');
    }
  });

  it('gives each disabled composer control a tooltip carrying the same label', async () => {
    renderShell();

    for (const label of [t('a11y.attach'), t('a11y.chatHistory'), t('a11y.newChat')]) {
      // The label is tooltip-only before hover (the controls are icon-only).
      expect(screen.queryAllByText(label)).toHaveLength(0);

      const control = screen.getByRole('button', { name: label });
      // A disabled button fires no mouse events, so the tooltip trigger is the
      // wrapping element.
      fireEvent.mouseOver(control.parentElement as HTMLElement);

      await waitFor(
        () => {
          expect(screen.queryAllByText(label).length).toBeGreaterThan(0);
        },
        { timeout: 3000 },
      );
    }
  });

  it('renders the send control disabled and marked as deferred', () => {
    const send = renderShell().container.querySelector(
      '[data-testid="np-composer-send"]',
    ) as HTMLButtonElement;

    expect(send).not.toBeNull();
    expect(send.disabled).toBe(true);
    expect(send.getAttribute('data-np-backing')).toBe('deferred');
    expect(send.getAttribute('aria-label')).toBe(t('a11y.send'));
  });

  it('keeps the composer draft live and never sends on Enter (Shift+Enter keeps the newline)', () => {
    renderShell();

    const input = screen.getByTestId('np-composer-input') as HTMLTextAreaElement;
    expect(input.disabled).toBe(false);

    fireEvent.change(input, { target: { value: 'a handoff draft' } });
    expect(input.value).toBe('a handoff draft');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input.value).toBe('a handoff draft');

    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
    expect(input.value).toBe('a handoff draft');
  });
});

describe('SidePanelShell — workflow and status bar', () => {
  it('renders the workflow control as the read-only literal Auto and never a model id', () => {
    renderShell();

    const control = screen.getByTestId('np-workflow-control');
    expect(control.textContent).toBe('Auto');

    const modelIdentifiers =
      /\b(gpt|claude|gemini|gemma|llama|mistral|sonnet|opus|haiku|deepseek|o[1-9])\b/i;
    expect(document.body.textContent ?? '').not.toMatch(modelIdentifiers);
  });

  it('renders Auto + a neutral decorative dot + the no-provider caption in the status bar', () => {
    renderShell();

    expect(screen.getByTestId('np-status-workflow').textContent).toBe('Auto');
    expect(screen.getByTestId('np-status-caption').textContent).toBe(t('chat.noProvider'));

    const statusBar = screen.getByTestId('np-status-bar');
    const decorativeDots = Array.from(statusBar.querySelectorAll('[aria-hidden="true"]')).filter(
      (el) => (el.getAttribute('style') ?? '').includes('border-radius: 50%'),
    );
    expect(decorativeDots).toHaveLength(1);
    expect(screen.queryByText(/ready|healthy|connected/i)).toBeNull();
  });

  it('renders Help and Feedback as disabled deferred controls', () => {
    renderShell();

    for (const label of [t('a11y.help'), t('a11y.feedback')]) {
      const control = screen.getByRole('button', { name: label }) as HTMLButtonElement;
      expect(control.disabled).toBe(true);
      expect(control.getAttribute('data-np-backing')).toBe('deferred');
    }
  });
});

describe('SidePanelShell — marking discipline', () => {
  it('marks every inert control and no live region', () => {
    const { container } = renderShell();

    // A false marker is as much a defect as a missing one: the marked set is
    // exactly the six inert controls (3 composer actions + send + help +
    // feedback).
    const marked = Array.from(container.querySelectorAll('[data-np-backing]'));
    expect(marked).toHaveLength(6);
    for (const el of marked) {
      expect(el.getAttribute('data-np-backing')).toBe('deferred');
      expect((el as HTMLButtonElement).disabled).toBe(true);
    }

    // Live regions carry no marker.
    for (const testId of ['np-sidepanel-conversation', 'np-composer-input', 'np-workflow-control']) {
      expect(
        screen.getByTestId(testId).hasAttribute('data-np-backing'),
        `${testId} is live and must not be marked`,
      ).toBe(false);
    }
  });
});

describe('ErrorBoundary — pinned shell error strings', () => {
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

    // AntD's own Result copy and locale defaults are unreachable.
    expect(screen.queryByText('Sorry, something went wrong.')).toBeNull();
    expect(screen.queryByText('OK')).toBeNull();
    expect(screen.queryByText('Cancel')).toBeNull();

    consoleError.mockRestore();
  });
});
