import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

import { ActionChipGroup } from '../../../src/components/common/ActionChipGroup';

describe('ActionChipGroup', () => {
  const defaultActions = [
    { key: 'action-1', label: 'Action 1', value: 'value-1' },
    { key: 'action-2', label: 'Action 2', value: 'value-2' },
    { key: 'action-3', label: 'Action 3', value: 'value-3' },
  ];

  afterEach(() => {
    cleanup();
  });

  // Test 1: Renders chip buttons in a horizontal Flex
  it('renders 3 chip buttons in a horizontal Flex; clicking chip 2 calls onSelect with chip 2 value', () => {
    const onSelect = vi.fn();
    const { container } = render(<ActionChipGroup actions={defaultActions} onSelect={onSelect} />);

    // All 3 buttons should be rendered
    expect(container.textContent).toContain('Action 1');
    expect(container.textContent).toContain('Action 2');
    expect(container.textContent).toContain('Action 3');

    // Click chip 2 — find the actual button element by its text
    fireEvent.click(screen.getAllByText('Action 2')[0]);
    expect(onSelect).toHaveBeenCalledWith('value-2');
  });

  // Test 2: maxVisible limits visible chips; scroll overflow visible
  it('with maxVisible=2, renders first 2 chips; scroll overflow visible', () => {
    const onSelect = vi.fn();
    const { container } = render(
      <ActionChipGroup actions={defaultActions} onSelect={onSelect} maxVisible={2} />
    );

    // First 2 chips should be visible
    expect(container.textContent).toContain('Action 1');
    expect(container.textContent).toContain('Action 2');

    // Action 3 should not be rendered (beyond maxVisible)
    expect(container.textContent).not.toContain('Action 3');

    // Container should have overflowX: auto
    const flexContainer = container.querySelector('[style*="overflow-x"]');
    expect(flexContainer).toBeTruthy();
  });

  // Test 3: Empty actions renders nothing
  it('empty actions array renders nothing (returns null)', () => {
    const { container } = render(<ActionChipGroup actions={[]} onSelect={vi.fn()} />);
    expect(container.innerHTML).toBe('');
  });
});
