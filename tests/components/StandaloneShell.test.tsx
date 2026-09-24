import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { ConfigProvider } from 'antd';
import {
  StandaloneShell,
  type StandaloneShellProps,
} from '../../src/components/standalone/StandaloneShell';
import { ErrorBoundary } from '../../src/core/components/ErrorBoundary';
import { AddonRegistry } from '../../src/core/registry/Registry';
import { t } from '../../src/core/i18n/strings';
import {
  useWorkspaceStore,
  WORKSPACE_WRITER_STATES,
  type WorkspaceWriterState,
} from '../../src/core/workspace/WorkspaceStore';
import {
  setActiveWriterElection,
  subscribeToElectionFailure,
  type ElectionOutcome,
  type WriterElection,
} from '../../src/core/workspace/WriterElection';

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

/**
 * A structurally-real election whose promotion path is a spy: this file pins
 * the shell-to-registry wiring, not the election mechanism.
 */
function fakeElection(elect: () => Promise<ElectionOutcome>): WriterElection {
  return {
    surface: 'standalone',
    tabId: 11,
    elect,
    startHeartbeat: vi.fn(),
    stop: vi.fn(),
    assertStillPrimary: async () => ({ ok: true }),
    coordinationState: () => ({ state: 'election-in-progress', startedAt: 0 }),
  };
}

function setWriterState(state: WorkspaceWriterState): void {
  act(() => {
    useWorkspaceStore.setState({ writerState: state });
  });
}

beforeEach(() => {
  window.innerWidth = 1024;
  setWriterState('election-pending');
});

afterEach(() => {
  setActiveWriterElection(null);
  setWriterState('election-pending');
  window.innerWidth = originalInnerWidth;
  // The add-on registry is process-global: leave no fixture registration behind.
  for (const addon of AddonRegistry.getAll()) AddonRegistry.unregister(addon.id);
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
    // absent, not empty — and an absent element carries no marker.
    expect(screen.queryByText(/add-ons/i)).toBeNull();
    expect(screen.queryByTestId('np-sider-addons-group')).toBeNull();
    expect(screen.queryByTestId('np-sider-addons-separator')).toBeNull();
    expect(document.querySelectorAll('.ant-divider').length).toBe(0);
  });

  it('renders the Add-ons group at one registered add-on (positive control)', () => {
    // The positive control that proves the absence assertion above is not
    // vacuous: with one add-on registered the label and its separator appear.
    AddonRegistry.register({ id: 'fixture-addon', name: 'Fixture Add-on' });
    renderShell();

    expect(screen.getByTestId('np-sider-addons-group').textContent).toContain('Add-ons');
    expect(screen.getByTestId('np-sider-addons-separator')).toBeTruthy();
    expect(document.querySelectorAll('.ant-divider').length).toBe(1);
  });

  it('renders no add-on page as a live route in Phase 1', () => {
    AddonRegistry.register({ id: 'fixture-addon-2', name: 'Another Add-on' });
    renderShell();

    const item = screen.getByTestId('np-sider-addon-fixture-addon-2') as HTMLButtonElement;
    expect(item.getAttribute('aria-label')).toBe('Another Add-on');
    // No add-on page exists in Phase 1, so the entry is inert and marked.
    expect(item.disabled).toBe(true);
    expect(item.getAttribute('data-np-backing')).toBe('deferred');
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
  it('disables and marks the inert top-bar back chevron (hard rule 1)', () => {
    renderShell();

    const back = screen.getByTestId('np-topbar-back') as HTMLButtonElement;
    expect(back.getAttribute('aria-label')).toBe(t('common.back'));
    // Phase 1 has no in-app history: the control is present because the 56 px
    // top bar composition pins it, so it must be disabled and marked rather
    // than appear enabled and functional.
    expect(back.disabled).toBe(true);
    expect(back.getAttribute('data-np-backing')).toBe('deferred');
  });

  it('marks the disabled global search field and the routed page root, and no live shell region', () => {
    const { container } = renderShell();

    const marked = Array.from(container.querySelectorAll('[data-np-backing]'));

    // Three marked regions: the shell's own inert back chevron and disabled
    // global search field, and the deferred page shell the router renders into
    // the content area.
    expect(marked.map((el) => el.getAttribute('data-np-backing'))).toEqual([
      'deferred',
      'deferred',
      'deferred',
    ]);
    expect(marked.map((el) => el.getAttribute('data-testid'))).toEqual([
      'np-topbar-back',
      'np-global-search',
      'np-page-chat',
    ]);

    const search = screen.getByTestId('np-global-search');
    expect(search.getAttribute('data-np-backing')).toBe('deferred');
    expect((search as HTMLInputElement).disabled).toBe(true);

    const pageRoot = screen.getByTestId('np-page-chat');
    expect(pageRoot.getAttribute('data-np-backing')).toBe('deferred');
    expect(pageRoot.hasAttribute('data-testid')).toBe(true);

    // A false marker is as much a defect as a missing one: the live Sider and
    // the live top bar carry none.
    for (const testId of ['np-sider', 'np-standalone-content']) {
      expect(screen.getByTestId(testId).hasAttribute('data-np-backing')).toBe(false);
    }
    for (const label of MAIN_ITEMS) {
      expect(screen.getByTestId(`np-sider-item-${label}`).hasAttribute('data-np-backing')).toBe(
        false,
      );
    }
  });

  it('leaves the Sider group absent and unmarked at zero registrations', () => {
    renderShell();

    expect(screen.queryByTestId('np-sider-addons-group')).toBeNull();
    expect(screen.queryByTestId('np-sider-addons-separator')).toBeNull();
    expect(screen.queryByText(/user account/i)).toBeNull();
  });
});

describe('StandaloneShell — MirrorBanner activation and the refocus path (D-12, D2-34)', () => {
  it('mounts the banner for `mirror` only, exactly once per surface', () => {
    for (const state of WORKSPACE_WRITER_STATES) {
      setWriterState(state);
      const view = renderShell();

      const banners = view.container.querySelectorAll('[data-testid="mirror-banner"]');
      expect(banners.length, `${state}: banner count`).toBe(state === 'mirror' ? 1 : 0);

      view.unmount();
    }
  });

  it('renders the banner inside the content region, above the routed content', () => {
    setWriterState('mirror');
    renderShell();

    const banner = screen.getByTestId('mirror-banner');
    expect(banner.parentElement).toBe(screen.getByTestId('np-standalone-content'));

    const routedContent = screen.getByTestId('np-page-chat');
    expect(
      banner.compareDocumentPosition(routedContent) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('asks the registry to refocus and leaves the banner mounted, claiming nothing', async () => {
    const elect = vi.fn(async (): Promise<ElectionOutcome> => ({ kind: 'primary', epoch: 1 }));
    setActiveWriterElection(fakeElection(elect));
    setWriterState('mirror');

    renderShell();

    await act(async () => {
      fireEvent.click(screen.getByText(t('workspace.mirrorRefocus')));
    });

    expect(elect).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('mirror-banner')).toBeTruthy();
    expect(screen.getByText(t('workspace.mirroringNotice'))).toBeTruthy();
    expect(useWorkspaceStore.getState().writerState).toBe('mirror');
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

    renderShell();
    await act(async () => {
      fireEvent.click(screen.getByText(t('workspace.mirrorRefocus')));
    });

    expect(failures).toEqual(['STORAGE_UNAVAILABLE']);
    // No optimistic hide and no second error surface on the banner.
    const banner = screen.getByTestId('mirror-banner');
    expect(banner).toBeTruthy();
    expect(banner.querySelector('[role="alert"]')).toBeNull();

    unsubscribe();
  });
});

describe('StandaloneShell — UI-SPEC surface metric parity (D-03 step 4)', () => {
  it('renders the Sider at 240 px expanded and 72 px collapsed', () => {
    renderShell();

    const sider = screen.getByTestId('np-sider');
    expect(sider.style.width).toBe('240px');

    fireEvent.click(screen.getByRole('button', { name: t('a11y.collapseSidebar') }));
    expect(screen.getByTestId('np-sider').style.width).toBe('72px');
  });

  it('renders the 56 px top bar and the 40 px Sider item geometry', () => {
    const { container } = renderShell();

    const header = container.querySelector('.ant-layout-header') as HTMLElement;
    expect(header.style.height).toBe('56px');
    expect(header.style.minHeight).toBe('56px');

    const item = screen.getByTestId('np-sider-item-Chat');
    expect(item.style.height).toBe('40px');
  });

  it('keeps the neutral no-provider caption in the content area, never a health signal', () => {
    const { container } = renderShell();

    const content = screen.getByTestId('np-standalone-content');
    expect(content).toBeTruthy();
    // jsdom cannot compute layout, so the metric asserted here is the absence of
    // a fabricated signal — the visual parity of the content area is observed in
    // the browser (plan `01-13`, item 6).
    expect(container.querySelector('.ant-badge-status-success')).toBeNull();
    expect(container.textContent).not.toMatch(/Connected to|provider healthy/i);
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
