import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import React from 'react';

// Mock workspace store
const mockWorkspaceState: Record<string, any> = {
  currentPageContext: null,
  pinnedTabs: [],
};

vi.mock('../../../src/core/stores/workspaceStore', () => ({
  useWorkspaceStore: (selector: any) => {
    return selector ? selector(mockWorkspaceState) : mockWorkspaceState;
  },
}));

// Mock antd theme
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
          paddingXXS: 4,
          paddingSM: 12,
          colorFillSecondary: '#f5f5f5',
          colorFillTertiary: '#e8e8e8',
          colorPrimaryBg: '#fff0e6',
          colorBorderSecondary: '#f0f0f0',
          colorText: '#000000',
        },
      }),
    },
  };
});

import { QuickActionChips } from '../../../src/components/chat/QuickActionChips';

describe('QuickActionChips', () => {
  beforeEach(() => {
    mockWorkspaceState.currentPageContext = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // Test 8: With hostname='servicenow.com', renders QuickActionChips with correct actions
  it('with currentPageContext.hostname="servicenow.com", renders QuickActionChips with correct actions', () => {
    mockWorkspaceState.currentPageContext = {
      url: 'https://example.service-now.com/nav_to.do',
      hostname: 'servicenow.com',
      title: 'ServiceNow',
    };

    const onSelectAction = vi.fn();
    render(<QuickActionChips onSelectAction={onSelectAction} />);

    // Should render ServiceNow-specific actions
    expect(screen.getByText('Summarize this case')).toBeTruthy();
    expect(screen.getByText('Draft a work note')).toBeTruthy();

    // Clicking an action should call onSelectAction with the prompt text
    fireEvent.click(screen.getByText('Summarize this case'));
    expect(onSelectAction).toHaveBeenCalled();
    expect(onSelectAction.mock.calls[0][0]).toContain('Summarize');
  });

  // Empty state: renders nothing when no hostname
  it('renders nothing when currentPageContext is null', () => {
    const { container } = render(<QuickActionChips onSelectAction={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });

  // Fallback: unknown hostname shows generic fallback actions
  it('with unknown hostname, renders fallback actions', () => {
    mockWorkspaceState.currentPageContext = {
      url: 'https://example.com',
      hostname: 'example.com',
      title: 'Example',
    };
    const { container } = render(<QuickActionChips onSelectAction={vi.fn()} />);
    // Should show fallback actions since unknown hostname maps to fallback
    expect(container.textContent).toContain('Summarize this page');
    expect(container.textContent).toContain('Extract key points');
  });
});
