import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/react';
import React from 'react';

// Mock antd theme + message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    theme: {
      ...actual.theme,
      useToken: () => ({
        token: {
          marginXS: 8,
        },
      }),
    },
    message: {
      success: vi.fn(),
    },
  };
});

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
});

// Mock URL.createObjectURL / revokeObjectURL
const mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = vi.fn();
URL.createObjectURL = mockCreateObjectURL;
URL.revokeObjectURL = mockRevokeObjectURL;

import { StructuredOutputActions } from '../../../src/components/chat/StructuredOutputActions';

const mockTableContent = `| Name | Age | Role |
| --- | --- | --- |
| Alice | 30 | Developer |
| Bob | 25 | Designer |`;

describe('StructuredOutputActions', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // Test 1: When hasTable=true, renders "Copy as table" and "Export CSV" buttons
  it('renders Copy as table and Export CSV buttons when hasTable=true', () => {
    render(
      <StructuredOutputActions content={mockTableContent} hasTable={true} />
    );

    expect(screen.getByText('Copy as table')).toBeTruthy();
    expect(screen.getByText('Export CSV')).toBeTruthy();
  });

  // Test 2: When hasTable=false, returns null (no render)
  it('returns null when hasTable=false', () => {
    const { container } = render(
      <StructuredOutputActions content="some text without table" hasTable={false} />
    );

    expect(container.innerHTML).toBe('');
  });

  // Test 3: Clicking "Copy as table" copies content to clipboard and shows success message
  it('copy as table copies to clipboard and shows success message', async () => {
    const { message } = await import('antd');
    render(
      <StructuredOutputActions content={mockTableContent} hasTable={true} />
    );

    fireEvent.click(screen.getByText('Copy as table'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockTableContent);

    // Wait for async .then() callback
    await vi.waitFor(() => {
      expect(message.success).toHaveBeenCalledWith('Table copied to clipboard');
    });
  });

  // Test 4: Clicking "Export CSV" downloads CSV file
  it('export CSV creates blob and triggers download', () => {
    render(
      <StructuredOutputActions content={mockTableContent} hasTable={true} />
    );

    // Mock document.createElement for anchor
    const anchorMock = {
      href: '',
      download: '',
      click: vi.fn(),
    };
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchorMock as unknown as HTMLElement);
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockReturnValue(anchorMock as unknown as HTMLElement);
    const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockReturnValue(anchorMock as unknown as HTMLElement);

    fireEvent.click(screen.getByText('Export CSV'));

    expect(mockCreateObjectURL).toHaveBeenCalled();
    expect(anchorMock.download).toBe('export.csv');
    expect(anchorMock.click).toHaveBeenCalled();
    expect(mockRevokeObjectURL).toHaveBeenCalled();

    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });
});
