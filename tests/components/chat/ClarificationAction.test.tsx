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

import { ClarificationAction } from '../../../src/components/chat/ClarificationAction';

describe('ClarificationAction', () => {
  afterEach(() => {
    cleanup();
  });

  // Test 1: Renders question text and 3 option chips; clicking chip 2 calls onSelect with chip 2's value
  it('renders question text and 3 option chips; clicking chip 2 calls onSelect with chip 2 value', () => {
    const onSelect = vi.fn();
    const options = [
      { label: 'Option A', value: 'opt-a' },
      { label: 'Option B', value: 'opt-b' },
      { label: 'Option C', value: 'opt-c' },
    ];

    const { container } = render(
      <ClarificationAction
        question="Which option do you prefer?"
        options={options}
        onSelect={onSelect}
      />
    );

    // Question text should be rendered
    expect(container.textContent).toContain('Which option do you prefer?');

    // Options should be rendered as chips
    expect(container.textContent).toContain('Option A');
    expect(container.textContent).toContain('Option B');
    expect(container.textContent).toContain('Option C');

    // Click chip 2
    fireEvent.click(screen.getAllByText('Option B')[0]);
    expect(onSelect).toHaveBeenCalledWith('opt-b');
  });

  // Test 2: Renders 4 options correctly (max per D-24)
  it('renders 4 options correctly (max per D-24)', () => {
    const options = [
      { label: 'Option 1', value: 'opt-1' },
      { label: 'Option 2', value: 'opt-2' },
      { label: 'Option 3', value: 'opt-3' },
      { label: 'Option 4', value: 'opt-4' },
    ];

    const { container } = render(
      <ClarificationAction
        question="Pick one:"
        options={options}
        onSelect={vi.fn()}
      />
    );

    expect(container.textContent).toContain('Option 1');
    expect(container.textContent).toContain('Option 2');
    expect(container.textContent).toContain('Option 3');
    expect(container.textContent).toContain('Option 4');
  });
});
