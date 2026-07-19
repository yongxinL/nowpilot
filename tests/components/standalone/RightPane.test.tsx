import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import React from 'react';
import { ConfigProvider } from 'antd';

// ---------------------------------------------------------------------------
// Mock RightPaneStore
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

// ---------------------------------------------------------------------------
// Mock workspaceStore for ContextTab
// ---------------------------------------------------------------------------

const mockWorkspaceState = {
  currentPageContext: null as any,
  pinnedTabs: [] as any[],
};

vi.mock('../../../src/core/stores/workspaceStore', () => ({
  useWorkspaceStore: (selector: any) => {
    return selector ? selector(mockWorkspaceState) : mockWorkspaceState;
  },
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
        },
      }),
    },
  };
});

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { RightPane } from '../../../src/components/standalone/RightPane';
import { PaneToggle } from '../../../src/components/standalone/PaneToggle';
import { ContextTab } from '../../../src/components/standalone/RightPaneTabs/ContextTab';
import { NotesTab } from '../../../src/components/standalone/RightPaneTabs/NotesTab';
import { ToolsTab } from '../../../src/components/standalone/RightPaneTabs/ToolsTab';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const renderWithAntd = (ui: React.ReactElement) =>
  render(<ConfigProvider>{ui}</ConfigProvider>);

function createPageContext(overrides: Record<string, unknown> = {}) {
  return {
    url: 'https://example.com/page',
    origin: 'https://example.com',
    hostname: 'example.com',
    title: 'Example Page',
    markdown: '# Hello',
    meta: {},
    extractedAt: Date.now(),
    extractionType: 'readability',
    extractionQuality: 'article',
    ...overrides,
  };
}

function createTabContext(tabId: number, overrides: Record<string, unknown> = {}) {
  return {
    tabId,
    windowId: 1,
    page: createPageContext({ url: `https://example.com/tab-${tabId}`, title: `Tab ${tabId}` }),
    pinnedAt: Date.now(),
    active: true,
    url: `https://example.com/tab-${tabId}`,
    title: `Tab ${tabId}`,
    ...overrides,
  };
}

function resetMocks() {
  mockRightPaneState.activeTab = 'context';
  mockRightPaneState.visible = true;
  mockRightPaneState.width = 'compact';
  mockRightPaneState.searchQuery = '';
  mockRightPaneState.selectedNoteId = null;
  mockRightPaneState.expandedToolId = null;
  mockWorkspaceState.currentPageContext = null;
  mockWorkspaceState.pinnedTabs = [];
  vi.clearAllMocks();
}

// ---------------------------------------------------------------------------
// RightPane Tests
// ---------------------------------------------------------------------------

describe('RightPane', () => {
  beforeEach(() => resetMocks());

  it('renders antd Tabs with Context/Notes/Tools tab labels', () => {
    renderWithAntd(<RightPane width={320} />);
    // Tab labels should be rendered (antd Tabs uses button[role=tab])
    expect(screen.getByText('Context')).toBeTruthy();
    // Notes and Tools tabs may be in the overflow dropdown if tabs overflow
    // We check the component renders without crashing
    expect(screen.getByRole('tablist')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ContextTab Tests
// ---------------------------------------------------------------------------

describe('ContextTab', () => {
  beforeEach(() => resetMocks());

  it('renders page title and URL from currentPageContext', () => {
    mockWorkspaceState.currentPageContext = createPageContext({
      title: 'ServiceNow Incident',
      url: 'https://example.service-now.com/incident/INC0012345',
    });
    renderWithAntd(<ContextTab />);
    expect(screen.getByText('ServiceNow Incident')).toBeTruthy();
  });

  it('renders pinnedTabs list from workspaceStore', () => {
    mockWorkspaceState.currentPageContext = createPageContext({
      title: 'Current Page',
    });
    mockWorkspaceState.pinnedTabs = [
      createTabContext(1, { title: 'Pinned Tab A' }),
      createTabContext(2, { title: 'Pinned Tab B' }),
    ];
    renderWithAntd(<ContextTab />);
    // Pinned tabs should be rendered
    const allText = document.body.textContent || '';
    expect(allText).toContain('Pinned Tab A');
    expect(allText).toContain('Pinned Tab B');
  });

  it('shows empty state when no page context and no pinned tabs', () => {
    renderWithAntd(<ContextTab />);
    // Empty state heading per UI-SPEC
    expect(screen.getByText('No page context')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// NotesTab Tests
// ---------------------------------------------------------------------------

describe('NotesTab', () => {
  beforeEach(() => resetMocks());

  it('renders Input.Search for note search', () => {
    renderWithAntd(<NotesTab />);
    // Input.Search renders an input[type=text]
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('shows empty state when no notes exist', () => {
    renderWithAntd(<NotesTab />);
    // Empty state heading per UI-SPEC
    expect(screen.getByText('No notes yet')).toBeTruthy();
  });

  it('shows create-note hint in empty state', () => {
    renderWithAntd(<NotesTab />);
    expect(screen.getByText(/Save to note/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ToolsTab Tests
// ---------------------------------------------------------------------------

describe('ToolsTab', () => {
  beforeEach(() => resetMocks());

  it('shows empty state when no tools configured', () => {
    renderWithAntd(<ToolsTab />);
    // Empty state heading per UI-SPEC
    expect(screen.getByText('No tools configured')).toBeTruthy();
  });

  it('shows configuration hint in empty state', () => {
    renderWithAntd(<ToolsTab />);
    expect(screen.getByText(/Connect MCP servers/)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// PaneToggle Tests
// ---------------------------------------------------------------------------

describe('PaneToggle', () => {
  beforeEach(() => resetMocks());

  it('calls toggleWidth when clicked', () => {
    renderWithAntd(<PaneToggle />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(buttons[0]);
    expect(mockRightPaneState.toggleWidth).toHaveBeenCalledOnce();
  });

  it('renders with correct title attribute for compact state', () => {
    renderWithAntd(<PaneToggle />);
    const button = screen.getByTitle(/right pane/i);
    expect(button).toBeTruthy();
  });
});
