import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { FollowUpAction } from '../../../src/components/chat/FollowUpAction';
import { App } from 'antd';

// Wrap with Ant Design App for message API
function withApp(ui: React.ReactElement) {
  return <App>{ui}</App>;
}

describe('FollowUpAction', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  // Test 1: Renders divider with "Follow up" label and suggestion chips
  it('renders divider with Follow up label and suggestion chips', () => {
    const suggestions = [
      { text: 'Expand on section 3' },
      { text: 'Translate to Chinese' },
    ];
    render(withApp(
      <FollowUpAction suggestions={suggestions} onSelect={mockOnSelect} />,
    ));

    // Divider label should be present
    expect(screen.getByText('Follow up')).toBeTruthy();

    // Suggestion chips should be rendered
    expect(screen.getByText('Expand on section 3')).toBeTruthy();
    expect(screen.getByText('Translate to Chinese')).toBeTruthy();

    // Clicking a chip should call onSelect
    fireEvent.click(screen.getByText('Expand on section 3'));
    expect(mockOnSelect).toHaveBeenCalledWith('Expand on section 3');
  });

  // Test 2: Empty suggestions renders nothing
  it('renders null when suggestions array is empty', () => {
    const { container } = render(withApp(
      <FollowUpAction suggestions={[]} onSelect={mockOnSelect} />,
    ));
    // Component returns null; only antd App wrapper divs remain
    expect(screen.queryByText('Follow up')).toBeNull();
  });

  // Test 3: Single suggestion still renders correctly
  it('renders correctly with a single suggestion', () => {
    const suggestions = [{ text: 'Tell me more' }];
    render(withApp(
      <FollowUpAction suggestions={suggestions} onSelect={mockOnSelect} />,
    ));

    expect(screen.getByText('Follow up')).toBeTruthy();
    expect(screen.getByText('Tell me more')).toBeTruthy();
  });
});
