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
          paddingXS: 8,
          paddingSM: 12,
          colorBorderSecondary: '#f0f0f0',
          colorTextSecondary: '#666666',
          colorText: '#000000',
        },
      }),
    },
  };
});

import { ConversationClosure } from '../../../src/components/chat/ConversationClosure';

describe('ConversationClosure', () => {
  afterEach(() => {
    cleanup();
  });

  // Test 1: Renders "Did this help?" + thumbs up/down buttons with correct aria-labels
  it('renders "Did this help?" text with thumbs up/down buttons with correct aria-labels', () => {
    const onFeedback = vi.fn();
    const { container } = render(
      <ConversationClosure onFeedback={onFeedback} />
    );

    expect(container.textContent).toContain('Did this help?');

    const thumbsUp = screen.getByRole('button', { name: 'This was helpful' });
    expect(thumbsUp).toBeTruthy();

    const thumbsDown = screen.getByRole('button', { name: 'This was not helpful' });
    expect(thumbsDown).toBeTruthy();
  });

  // Test 2: Clicking thumbs up calls onFeedback with true
  it('clicking thumbs up calls onFeedback(true)', () => {
    const onFeedback = vi.fn();
    render(<ConversationClosure onFeedback={onFeedback} />);

    const thumbsUp = screen.getByRole('button', { name: 'This was helpful' });
    fireEvent.click(thumbsUp);
    expect(onFeedback).toHaveBeenCalledWith(true);
  });

  // Test 3: Clicking thumbs down calls onFeedback with false
  it('clicking thumbs down calls onFeedback(false)', () => {
    const onFeedback = vi.fn();
    render(<ConversationClosure onFeedback={onFeedback} />);

    const thumbsDown = screen.getByRole('button', { name: 'This was not helpful' });
    fireEvent.click(thumbsDown);
    expect(onFeedback).toHaveBeenCalledWith(false);
  });
});
