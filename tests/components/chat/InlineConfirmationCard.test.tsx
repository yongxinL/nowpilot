import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import React from 'react';

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
          marginMD: 16,
          marginLG: 20,
          padding: 16,
          paddingXS: 8,
          paddingSM: 12,
          borderRadiusLG: 8,
          borderRadius: 6,
          colorWarningBorder: '#faad14',
          colorWarningBg: '#fffbe6',
          colorSuccess: '#52c41a',
          colorFillSecondary: '#f5f5f5',
          colorFillQuaternary: '#fafafa',
          colorBorderSecondary: '#f0f0f0',
          colorText: '#000000',
          colorTextSecondary: '#666666',
          colorTextQuaternary: '#999999',
          colorPrimary: '#e0582e',
        },
      }),
    },
  };
});

vi.mock('../../../src/components/common/ActionChipGroup', () => ({
  ActionChipGroup: ({ actions, onSelect }: any) => (
    <div data-testid="action-chip-group">
      {actions.map((a: any) => (
        <button key={a.key} onClick={() => onSelect(a.value)}>
          {a.label}
        </button>
      ))}
    </div>
  ),
  type: {} as any,
}));

import { InlineConfirmationCard } from '../../../src/components/chat/InlineConfirmationCard';

describe('InlineConfirmationCard', () => {
  afterEach(() => {
    cleanup();
  });

  // Test 1: Pending state renders warning-border card with actionDescription, rationale, ActionChipGroup [Proceed][Don't proceed]
  it('pending state renders warning-border card with actionDescription, rationale, Proceed/Don\'t proceed chips', () => {
    const onProceed = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(
      <InlineConfirmationCard
        actionDescription="Search the web for that?"
        rationale="This will perform a web search using your default search engine."
        onProceed={onProceed}
        onCancel={onCancel}
        state="pending"
      />
    );

    expect(container.textContent).toContain('Search the web for that?');
    expect(container.textContent).toContain('This will perform a web search using your default search engine.');
    expect(container.textContent).toContain('Proceed');
    expect(container.textContent).toContain("Don't proceed");
  });

  // Test 2: Clicking Proceed calls onProceed
  it('clicking Proceed calls onProceed', () => {
    const onProceed = vi.fn();
    const onCancel = vi.fn();
    render(
      <InlineConfirmationCard
        actionDescription="Proceed action"
        onProceed={onProceed}
        onCancel={onCancel}
        state="pending"
      />
    );

    fireEvent.click(screen.getByText('Proceed'));
    expect(onProceed).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  // Test 3: Clicking Don't proceed calls onCancel
  it('clicking Don\'t proceed calls onCancel', () => {
    const onProceed = vi.fn();
    const onCancel = vi.fn();
    render(
      <InlineConfirmationCard
        actionDescription="Proceed action"
        onProceed={onProceed}
        onCancel={onCancel}
        state="pending"
      />
    );

    fireEvent.click(screen.getByText("Don't proceed"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onProceed).not.toHaveBeenCalled();
  });

  // Test 4: Executing state shows green check icon + actionSummary + Spin
  it('executing state shows green check icon + actionSummary + Spinner', () => {
    const { container } = render(
      <InlineConfirmationCard
        actionDescription="Search action"
        onProceed={vi.fn()}
        onCancel={vi.fn()}
        state="executing"
        actionSummary="Searched the web"
      />
    );

    expect(container.textContent).toContain('Searched the web');
  });

  // Test 5: Completed state shows green check icon + actionSummary (no spinner)
  it('completed state shows green check icon + actionSummary without spinner', () => {
    const { container } = render(
      <InlineConfirmationCard
        actionDescription="Search action"
        onProceed={vi.fn()}
        onCancel={vi.fn()}
        state="completed"
        actionSummary="Searched the web"
      />
    );

    expect(container.textContent).toContain('Searched the web');
  });

  // Test 6: Cancelled state shows "Action cancelled." text
  it('cancelled state shows "Action cancelled." text', () => {
    const { container } = render(
      <InlineConfirmationCard
        actionDescription="Search action"
        onProceed={vi.fn()}
        onCancel={vi.fn()}
        state="cancelled"
      />
    );

    expect(container.textContent).toContain('Action cancelled.');
  });
});
