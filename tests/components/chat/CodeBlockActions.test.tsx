import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ConfigProvider, App } from 'antd';
import { CodeBlockActions } from '../../../src/components/chat/CodeBlockActions';

function withApp(ui: React.ReactElement) {
  return <App><ConfigProvider>{ui}</ConfigProvider></App>;
}

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

describe('CodeBlockActions', () => {
  const mockOnSaveAsMacro = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  // Test 5: Renders Copy button; clicking copies code to clipboard
  it('renders Copy button and copies code to clipboard on click', async () => {
    render(withApp(
      <CodeBlockActions
        code="console.log('hello')"
        language="javascript"
        onSaveAsMacro={mockOnSaveAsMacro}
        canInsert={false}
      />,
    ));

    // The Copy button should be present (usually CopyOutlined icon)
    const copyButton = screen.getByTitle('Copy');
    expect(copyButton).toBeTruthy();

    await act(async () => {
      fireEvent.click(copyButton);
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("console.log('hello')");
  });

  // Test 6: Copy button shows checkmark for 2s after success, reverts to copy icon
  it('shows checkmark icon after copying and reverts after 2s', async () => {
    vi.useFakeTimers();

    render(withApp(
      <CodeBlockActions
        code="test code"
        language="javascript"
        onSaveAsMacro={mockOnSaveAsMacro}
        canInsert={false}
      />,
    ));

    await act(async () => {
      fireEvent.click(screen.getByTitle('Copy'));
    });

    // Should show checkmark (title/icon changes)
    expect(screen.getByTitle('Copied')).toBeTruthy();

    // Advance 2 seconds
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // Should revert to copy
    expect(screen.getByTitle('Copy')).toBeTruthy();

    vi.useRealTimers();
  });

  // Test 7: Insert button disabled with tooltip when no ServiceNow textarea
  it('renders Insert button disabled with tooltip when canInsert is false', () => {
    render(withApp(
      <CodeBlockActions
        code="test code"
        language="javascript"
        onSaveAsMacro={mockOnSaveAsMacro}
        canInsert={false}
      />,
    ));

    const insertButton = screen.getByTitle('Insert into page');
    expect(insertButton).toBeTruthy();
    // Button should be disabled
    expect(insertButton).toHaveProperty('disabled', true);
  });

  // Test 8: Save as macro button renders and calls onSaveAsMacro
  it('renders Save as macro button and calls onSaveAsMacro on click', () => {
    render(withApp(
      <CodeBlockActions
        code="const x = 1;"
        language="javascript"
        onSaveAsMacro={mockOnSaveAsMacro}
        canInsert={false}
      />,
    ));

    const saveButton = screen.getByTitle('Save as macro');
    expect(saveButton).toBeTruthy();

    fireEvent.click(saveButton);
    expect(mockOnSaveAsMacro).toHaveBeenCalledWith('const x = 1;');
  });
});
