import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock chrome API
// ---------------------------------------------------------------------------

vi.stubGlobal('chrome', {
  sidePanel: { open: vi.fn() },
  tabs: { getCurrent: vi.fn().mockResolvedValue({ id: 1 }) },
  runtime: { openOptionsPage: vi.fn() },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
    },
  },
});

// ---------------------------------------------------------------------------
// Mock ResizeObserver — configurable default width
// ---------------------------------------------------------------------------

let mockContainerWidth = 1200;
const resizeObserverInstances: { callback: ResizeObserverCallback }[] = [];

vi.stubGlobal('ResizeObserver', class {
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeObserverInstances.push({ callback });
  }
  private callback: ResizeObserverCallback;

  observe(target: Element) {
    const entry = { contentRect: { width: mockContainerWidth } } as ResizeObserverEntry;
    this.callback([entry], this as unknown as ResizeObserver);
  }

  unobserve() {}
  disconnect() {}
});

function setMockContainerWidth(width: number) {
  mockContainerWidth = width;
}

// ---------------------------------------------------------------------------
// Mock stores
// ---------------------------------------------------------------------------

const mockRightPaneState = {
  activeTab: 'context' as const,
  visible: true,
  width: 'compact' as const,
  searchQuery: '',
  selectedNoteId: null as string | null,
  expandedToolId: null as string | null,
  setActiveTab: vi.fn(),
  setVisible: vi.fn(),
  toggleWidth: vi.fn(),
  setSearchQuery: vi.fn(),
  setSelectedNoteId: vi.fn(),
  setExpandedToolId: vi.fn(),
};

vi.mock('../../../src/core/stores/RightPaneStore', () => ({
  useRightPaneStore: (selector: any) => {
    return selector ? selector(mockRightPaneState) : mockRightPaneState;
  },
}));

const mockWorkspaceState = {
  setActiveSurface: vi.fn(),
  activeProvider: 'openai' as string | null,
};

vi.mock('../../../src/core/stores/workspaceStore', () => ({
  useWorkspaceStore: (selector: any) => {
    return selector ? selector(mockWorkspaceState) : mockWorkspaceState;
  },
}));

// ---------------------------------------------------------------------------
// Mock hooks
// ---------------------------------------------------------------------------

vi.mock('../../../src/hooks/useTheme', () => ({
  useTheme: () => ({ isDark: false }),
}));

// ---------------------------------------------------------------------------
// Mock child components
// ---------------------------------------------------------------------------

vi.mock('../../../src/components/standalone/StandaloneSider', () => ({
  StandaloneSider: () => <div data-testid="standalone-sider">Sider</div>,
  STANDALONE_NAVBAR_WIDTH: 240,
}));

vi.mock('../../../src/components/standalone/StandaloneContent', () => ({
  StandaloneContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="standalone-content">{children}</div>
  ),
}));

vi.mock('../../../src/components/standalone/RightPane', () => ({
  RightPane: ({ width }: { width: number }) => (
    <div data-testid="right-pane" data-width={width}>Right Pane</div>
  ),
}));

vi.mock('../../../src/components/standalone/PaneToggle', () => ({
  PaneToggle: () => <div data-testid="pane-toggle">Toggle</div>,
}));

vi.mock('../../../src/core/components/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('../../../src/components/common/ApplicationFrame', () => ({
  ApplicationFrame: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock('../../../src/components/common/WorkspaceStatusBar', () => ({
  WorkspaceStatusBar: () => null,
}));

// ---------------------------------------------------------------------------
// Mock antd theme
// ---------------------------------------------------------------------------

vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    theme: {
      ...actual.theme,
      useToken: () => ({
        token: {
          marginXS: 8,
          marginSM: 12,
          margin: 16,
          paddingXS: 8,
          paddingSM: 12,
          padding: 16,
          paddingXXS: 4,
          colorBorderSecondary: '#f0f0f0',
          colorBgContainer: '#ffffff',
          colorText: '#000000',
          colorTextSecondary: '#666666',
          colorPrimary: '#e0582e',
          borderRadius: 6,
          borderRadiusLG: 8,
          fontSize: 14,
          lineHeight: 1.5715,
          boxShadowSecondary: '0 6px 16px 0 rgba(0,0,0,0.08)',
          colorWarningBorder: '#ffd666',
          colorWarningBg: '#fffbe6',
          colorSuccess: '#52c41a',
          colorError: '#ff4d4f',
        },
      }),
    },
    ConfigProvider: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  };
});

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { StandaloneRoot } from '../../../src/components/standalone/StandaloneRoot';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderStandalone(overrides: {
  initialActiveId?: string;
  renderActivePage?: () => React.ReactNode;
} = {}) {
  return render(
    <StandaloneRoot
      initialActiveId={overrides.initialActiveId ?? 'chat'}
      renderActivePage={overrides.renderActivePage ?? (() => <div>Chat Content</div>)}
    />,
  );
}

function resetMocks() {
  mockContainerWidth = 1200;
  mockRightPaneState.visible = true;
  mockRightPaneState.width = 'compact';
  mockRightPaneState.activeTab = 'context';
  mockRightPaneState.setVisible.mockClear();
  vi.clearAllMocks();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StandaloneRoot — Right Pane Integration', () => {
  beforeEach(() => resetMocks());
  afterEach(() => cleanup());

  it('renders right pane inline when visible=true and width>breakpoint (1200px default)', () => {
    renderStandalone();
    const rightPane = screen.getByTestId('right-pane');
    expect(rightPane).toBeTruthy();
  });

  it('right pane width is 320px when store.width is "compact"', () => {
    renderStandalone();
    const rightPane = screen.getByTestId('right-pane');
    expect(rightPane.getAttribute('data-width')).toBe('320');
  });

  it('right pane width is ~45% of container width when store.width is "expanded"', () => {
    mockRightPaneState.width = 'expanded';
    renderStandalone();
    const rightPane = screen.getByTestId('right-pane');
    const expectedWidth = Math.floor(1200 * 0.45);
    expect(rightPane.getAttribute('data-width')).toBe(String(expectedWidth));
  });

  it('renders PaneToggle between content column and right pane', () => {
    renderStandalone();
    expect(screen.getByTestId('pane-toggle')).toBeTruthy();
  });

  it('hides right pane when activeId is "options" (D-08)', () => {
    renderStandalone({ initialActiveId: 'options' });
    expect(screen.queryByTestId('right-pane')).toBeNull();
  });

  it('hides right pane when activeId is "diagnostics" (D-08)', () => {
    renderStandalone({ initialActiveId: 'diagnostics' });
    expect(screen.queryByTestId('right-pane')).toBeNull();
  });

  it('renders right pane for "chat" page (D-08)', () => {
    renderStandalone({ initialActiveId: 'chat' });
    expect(screen.getByTestId('right-pane')).toBeTruthy();
  });

  it('renders right pane for "agent" page (D-08)', () => {
    renderStandalone({ initialActiveId: 'agent' });
    expect(screen.getByTestId('right-pane')).toBeTruthy();
  });

  it('renders antd Drawer when container width < 720px (Pitfall 5)', () => {
    setMockContainerWidth(600);
    renderStandalone();
    // In Drawer mode, the inline right-pane should NOT be present
    expect(screen.queryByTestId('pane-toggle')).toBeNull();
    // The Drawer contains a RightPane — check it renders via the Drawer portal
    const rightPanes = screen.getAllByTestId('right-pane');
    expect(rightPanes.length).toBe(1);
  });

  it('hides right pane completely when options page on small screen', () => {
    setMockContainerWidth(600);
    renderStandalone({ initialActiveId: 'options' });
    // Neither inline pane nor Drawer should be shown for options page
    expect(screen.queryByTestId('pane-toggle')).toBeNull();
    expect(screen.queryByTestId('right-pane')).toBeNull();
  });
});
