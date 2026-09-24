import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import { SidePanelShell } from '../../src/components/sidepanel/SidePanelShell';
import { ErrorBoundary } from '../../src/core/components/ErrorBoundary';
import { t } from '../../src/core/i18n/strings';
import {
  useWorkspaceStore,
  WORKSPACE_WRITER_STATES,
} from '../../src/core/workspace/WorkspaceStore';
import {
  isWriterElectionRegistered,
  requestRefocus,
  setActiveWriterElection,
  subscribeToElectionFailure,
  type ElectionOutcome,
  type WriterElection,
} from '../../src/core/workspace/WriterElection';
import {
  useExtensionStore,
  type HydrationStatus,
} from '../../src/store/useExtensionStore';

/**
 * Side Panel shell suite (plan `01-02`, Task 2; the Phase-2 hydration contract
 * added by plan `02-09`, Task 1).
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
      onDraftChange={props?.onDraftChange}
    />,
  );

/** The six frozen D2-18 states, in their canonical order. */
const HYDRATION_STATUSES: HydrationStatus[] = [
  'idle',
  'hydrating',
  'ready',
  'empty',
  'failed',
  'recovery required',
];

function setHydrationStatus(status: HydrationStatus): void {
  // A store update that a mounted shell observes must be wrapped, exactly like
  // a user-driven change would be.
  act(() => {
    useExtensionStore.setState({ hydrationStatus: status, hydrationError: null });
  });
}

/** Render the shell with the store's hydration status pinned to `status`. */
function renderShellAt(status: HydrationStatus) {
  setHydrationStatus(status);
  return renderShell();
}

/**
 * The store's own retry action, captured once so a case that replaces it with
 * a spy cannot leak into the next case.
 */
const INITIAL_RETRY_HYDRATION = useExtensionStore.getState().retryHydration;

/**
 * A structurally-real election whose one interesting method — `elect()`, the
 * promotion path a refocus request delegates to — is a spy. `createWriterElection`
 * is exercised by its own suite; what this file pins is the shell-to-registry
 * wiring.
 */
function fakeElection(elect: () => Promise<ElectionOutcome>): WriterElection {
  return {
    surface: 'sidepanel',
    tabId: 7,
    elect,
    startHeartbeat: vi.fn(),
    stop: vi.fn(),
    assertStillPrimary: async () => ({ ok: true }),
    coordinationState: () => ({ state: 'election-in-progress', startedAt: 0 }),
  };
}

function setWriterState(state: (typeof WORKSPACE_WRITER_STATES)[number]): void {
  act(() => {
    useWorkspaceStore.setState({ writerState: state });
  });
}

afterEach(() => {
  act(() => {
    useExtensionStore.setState({
      hydrationStatus: 'idle',
      hydrationError: null,
      retryHydration: INITIAL_RETRY_HYDRATION,
    });
    useWorkspaceStore.setState({ writerState: 'election-pending' });
  });
  setActiveWriterElection(null);
});

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
    // D2-18: the empty presentation is reachable only from a successful read
    // that found nothing — never before hydration completes.
    renderShellAt('empty');

    expect(screen.getByText(t('chat.empty'))).toBeTruthy();
    expect(screen.getByText(t('chat.emptyBody'))).toBeTruthy();
    // No message bubble / no loading placeholder in the empty state.
    expect(document.querySelectorAll('.ant-bubble').length).toBe(0);
    expect(document.querySelectorAll('.ant-skeleton').length).toBe(0);
  });
});

describe('SidePanelShell — conversation-region hydration states (D2-18)', () => {
  /**
   * What each frozen status may render. `emptyCopy` is the approved empty
   * presentation, `skeleton` the content-area loading state and `retry` the
   * failure action; anything not in the row must be absent.
   */
  const TREATMENTS: Record<
    HydrationStatus,
    { emptyCopy: boolean; skeleton: boolean; retry: boolean }
  > = {
    idle: { emptyCopy: false, skeleton: false, retry: false },
    hydrating: { emptyCopy: false, skeleton: true, retry: false },
    ready: { emptyCopy: false, skeleton: false, retry: false },
    empty: { emptyCopy: true, skeleton: false, retry: false },
    failed: { emptyCopy: false, skeleton: false, retry: true },
    'recovery required': { emptyCopy: false, skeleton: false, retry: true },
  };

  it('renders exactly its own treatment for each of the six statuses', () => {
    for (const status of HYDRATION_STATUSES) {
      const expected = TREATMENTS[status];
      const view = renderShellAt(status);

      // The region itself is always present and always live.
      const region = view.container.querySelector('[data-testid="np-sidepanel-conversation"]');
      expect(region, `${status}: the conversation region is always present`).not.toBeNull();

      expect(
        screen.queryAllByText(t('chat.empty')).length > 0,
        `${status}: chat.empty`,
      ).toBe(expected.emptyCopy);
      expect(
        screen.queryAllByText(t('chat.emptyBody')).length > 0,
        `${status}: chat.emptyBody`,
      ).toBe(expected.emptyCopy);
      expect(
        view.container.querySelectorAll('.ant-skeleton').length > 0,
        `${status}: skeleton`,
      ).toBe(expected.skeleton);
      expect(
        screen.queryAllByRole('button', { name: t('common.retry') }).length > 0,
        `${status}: retry action`,
      ).toBe(expected.retry);

      // The region is live behaviour: a marker here would declare a deferred
      // capability this surface actually has (Phase-1 hard rule 5).
      expect(
        (region as HTMLElement).hasAttribute('data-np-backing'),
        `${status}: the region carries no marker`,
      ).toBe(false);

      view.unmount();
    }
  });

  it('claims nothing about stored history while `idle` or `hydrating`', () => {
    for (const status of ['idle', 'hydrating'] as const) {
      const view = renderShellAt(status);
      const region = screen.getByTestId('np-sidepanel-conversation');

      // No empty presentation, no ready claim: the region renders no text at
      // all, so it cannot assert a history it has not read.
      expect(region.textContent, `${status} must claim nothing`).toBe('');
      expect(screen.queryByText(t('chat.empty'))).toBeNull();
      expect(screen.queryByText(t('chat.emptyBody'))).toBeNull();
      expect(region.textContent ?? '').not.toMatch(/ready|loaded|restored/i);

      view.unmount();
    }
  });

  it('uses the AntD Skeleton for `hydrating`, never an inline spinner', () => {
    const view = renderShellAt('hydrating');

    // The skeleton fills the conversation region and carries no fabricated
    // content (it is shapes, not words).
    const skeletons = view.container.querySelectorAll('.ant-skeleton');
    expect(skeletons.length).toBe(1);
    expect(screen.getByTestId('np-sidepanel-conversation').textContent).toBe('');
    expect(view.container.querySelectorAll('.ant-spin').length).toBe(0);

    // The component's own source is the durable pin: the content-area loading
    // component is imported, and the inline spinner the design system reserves
    // for in-button use appears nowhere. Comments are stripped first, so the
    // provenance notes cannot trip the scan.
    const raw = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/sidepanel/SidePanelShell.tsx'),
      'utf8',
    );
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(source).toContain('Skeleton');
    expect(source).not.toMatch(/\bSpin\b/);
  });

  it('renders the pinned failure presentation and retries through the store', () => {
    for (const status of ['failed', 'recovery required'] as const) {
      const retry = vi.fn();
      act(() => {
        useExtensionStore.setState({ retryHydration: retry });
      });
      // The typed error is present in the store and must never reach the DOM:
      // no record id, storage key, journal stage or error code is rendered.
      act(() => {
        useExtensionStore.setState({
          hydrationStatus: status,
          hydrationError: { code: 'IDB_MIGRATION_FAILED' },
        });
      });
      const view = renderShell();

      const region = screen.getByTestId('np-sidepanel-conversation');
      expect(
        screen.getByRole('heading', { level: 4, name: t('storage.hydrationFailed') }),
        `${status}: the pinned failure line`,
      ).toBeTruthy();
      // A failure never presents as an empty history and never shows a load
      // placeholder: no legacy fallback, no silent empty.
      expect(screen.queryByText(t('chat.empty'))).toBeNull();
      expect(screen.queryByText(t('chat.emptyBody'))).toBeNull();
      expect(view.container.querySelectorAll('.ant-skeleton').length).toBe(0);

      // The region is exactly the problem line and its action — nothing else.
      expect(region.textContent).toBe(`${t('storage.hydrationFailed')}${t('common.retry')}`);
      expect(useExtensionStore.getState().hydrationError?.code).toBe('IDB_MIGRATION_FAILED');
      expect(view.container.textContent ?? '').not.toContain('IDB_MIGRATION_FAILED');

      // The action re-drives the store's own retry — the shell holds no
      // recovery logic of its own.
      fireEvent.click(screen.getByRole('button', { name: t('common.retry') }));
      expect(retry, `${status}: retry action`).toHaveBeenCalledTimes(1);

      view.unmount();
      act(() => {
        useExtensionStore.setState({ retryHydration: INITIAL_RETRY_HYDRATION });
      });
    }
  });

  it('leaves the header, composer, toolbar and status bar unchanged across every status', () => {
    const shapes = HYDRATION_STATUSES.map((status) => {
      const view = renderShellAt(status);
      const header = view.container.querySelector('header')?.outerHTML ?? '';
      const composer =
        view.container
          .querySelector('[data-testid="np-composer-toolbar"]')
          ?.closest('section')?.outerHTML ?? '';
      view.unmount();
      return { status, header, composer };
    });

    for (const shape of shapes.slice(1)) {
      expect(shape.header, `${shape.status}: header`).toBe(shapes[0].header);
      expect(shape.composer, `${shape.status}: composer block`).toBe(shapes[0].composer);
    }
  });
});

describe('SidePanelShell — MirrorBanner activation and the refocus path (D-12, D2-34)', () => {
  it('mounts the banner for `mirror` only, exactly once per surface', () => {
    for (const state of WORKSPACE_WRITER_STATES) {
      setWriterState(state);
      const view = renderShellAt('ready');

      const banners = view.container.querySelectorAll('[data-testid="mirror-banner"]');
      expect(banners.length, `${state}: banner count`).toBe(state === 'mirror' ? 1 : 0);

      view.unmount();
    }
  });

  it('renders the banner immediately above the conversation region', () => {
    setWriterState('mirror');
    renderShellAt('ready');

    const banner = screen.getByTestId('mirror-banner');
    const region = screen.getByTestId('np-sidepanel-conversation');
    expect(banner.parentElement).toBe(screen.getByTestId('np-sidepanel-shell'));
    expect(region.previousElementSibling).toBe(banner);
  });

  it('asks the registry to refocus and leaves the banner mounted, claiming nothing', async () => {
    const elect = vi.fn(async (): Promise<ElectionOutcome> => ({ kind: 'primary', epoch: 1 }));
    setActiveWriterElection(fakeElection(elect));
    setWriterState('mirror');

    const view = renderShellAt('ready');
    expect(screen.getByTestId('mirror-banner')).toBeTruthy();

    await act(async () => {
      fireEvent.click(screen.getByText(t('workspace.mirrorRefocus')));
    });

    // The click reached the election's own promotion path...
    expect(elect).toHaveBeenCalledTimes(1);
    // ...and changed nothing locally: the banner is still mounted, its caption
    // unchanged, the store still reports `mirror`, and no promotion or success
    // is claimed anywhere on the surface.
    expect(screen.getByTestId('mirror-banner')).toBeTruthy();
    expect(screen.getByText(t('workspace.mirroringNotice'))).toBeTruthy();
    expect(useWorkspaceStore.getState().writerState).toBe('mirror');
    expect(view.container.textContent ?? '').not.toMatch(/success|now primary|promoted/i);
  });

  it('keeps the banner mounted and reports through the channel when the refocus fails', async () => {
    const elect = vi.fn(
      async (): Promise<ElectionOutcome> => ({
        kind: 'error',
        code: 'STORAGE_UNAVAILABLE',
        message: 'probe',
      }),
    );
    setActiveWriterElection(fakeElection(elect));
    const failures: string[] = [];
    const unsubscribe = subscribeToElectionFailure((code) => failures.push(code));
    setWriterState('mirror');

    renderShellAt('ready');
    await act(async () => {
      fireEvent.click(screen.getByText(t('workspace.mirrorRefocus')));
    });

    expect(elect).toHaveBeenCalledTimes(1);
    expect(failures).toEqual(['STORAGE_UNAVAILABLE']);
    // A failed refocus is not an optimistic hide, and the banner never becomes
    // a second error surface.
    const banner = screen.getByTestId('mirror-banner');
    expect(banner).toBeTruthy();
    expect(banner.querySelector('[role="alert"]')).toBeNull();

    unsubscribe();
  });

  it('reports ELECTION_TIMEOUT when the refocus settles as secondary', async () => {
    const elect = vi.fn(
      async (): Promise<ElectionOutcome> => ({
        kind: 'secondary',
        current: { tabId: 1, surface: 'standalone', electedAt: 1 },
      }),
    );
    setActiveWriterElection(fakeElection(elect));
    const failures: string[] = [];
    const unsubscribe = subscribeToElectionFailure((code) => failures.push(code));
    setWriterState('mirror');

    renderShellAt('ready');
    await act(async () => {
      fireEvent.click(screen.getByText(t('workspace.mirrorRefocus')));
    });

    // A refocus that does not reach primary is reported, never silently
    // swallowed, and the banner stays mounted.
    expect(failures).toEqual(['ELECTION_TIMEOUT']);
    expect(screen.getByTestId('mirror-banner')).toBeTruthy();

    unsubscribe();
  });

  it('resolves a typed unavailable outcome when no election is registered', async () => {
    setActiveWriterElection(null);
    expect(isWriterElectionRegistered()).toBe(false);

    const failures: string[] = [];
    const unsubscribe = subscribeToElectionFailure((code) => failures.push(code));

    const outcome = await requestRefocus();

    // Never a fabricated success.
    expect(outcome.kind).toBe('error');
    expect(outcome.kind === 'error' && outcome.code).toBe('STORAGE_UNAVAILABLE');
    expect(failures).toEqual(['STORAGE_UNAVAILABLE']);

    unsubscribe();
    expect(isWriterElectionRegistered()).toBe(false);
  });

  it('makes the banner action keyboard-reachable with its canonical accessible name', async () => {
    const elect = vi.fn(async (): Promise<ElectionOutcome> => ({ kind: 'primary', epoch: 1 }));
    setActiveWriterElection(fakeElection(elect));
    setWriterState('mirror');
    renderShellAt('ready');

    const action = screen.getByLabelText(t('workspace.mirrorRefocusA11y'));
    expect(action.getAttribute('role')).toBe('button');
    expect(action.getAttribute('tabindex')).toBe('0');

    action.focus();
    expect(document.activeElement).toBe(action);

    await act(async () => {
      fireEvent.keyDown(action, { key: 'Enter' });
    });
    expect(elect).toHaveBeenCalledTimes(1);
  });

  it('renders the full canonical caption as text content, never as a title-only affordance', () => {
    setWriterState('mirror');
    renderShellAt('ready');

    const caption = screen.getByText(t('workspace.mirroringNotice'));
    expect(caption.textContent).toBe(t('workspace.mirroringNotice'));
    // The full sentence is the element's text; no truncating `title` stand-in
    // carries it instead.
    expect(caption.hasAttribute('title')).toBe(false);
    expect(screen.getByTestId('mirror-banner').getAttribute('role')).toBe('status');
    expect(screen.getByTestId('mirror-banner').getAttribute('aria-live')).toBe('polite');
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

  it('reports the live composer draft to the surface root for the handoff (WR-07)', () => {
    const onDraftChange = vi.fn();
    renderShell({ onDraftChange });

    const input = screen.getByTestId('np-composer-input') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'a handoff draft' } });

    // The draft travels to `openStandalone` through this callback only — never
    // through the URL, storage or a log (D-13 / hard rule 4).
    expect(onDraftChange).toHaveBeenCalledTimes(1);
    expect(onDraftChange).toHaveBeenCalledWith('a handoff draft');
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
