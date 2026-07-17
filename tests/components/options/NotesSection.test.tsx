import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { ConfigProvider, App as AntApp } from 'antd';

// Mock NoteFileSync before component import
vi.mock('../../../src/core/notes/NoteFileSync', () => ({
  noteFileSync: {
    setBackupFolder: vi.fn(),
    getBackupStatus: vi.fn().mockResolvedValue({ status: 'off' }),
    sync: vi.fn(),
  },
}));

import { NotesSection } from '../../../src/components/options/NotesSection';

function setup(jsx: React.ReactElement) {
  return render(
    <ConfigProvider>
      <AntApp>{jsx}</AntApp>
    </ConfigProvider>,
  );
}

describe('NotesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock chrome.storage.local
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn(),
          getBytesInUse: vi.fn(),
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
      runtime: {
        id: 'test-extension-id',
        getURL: vi.fn(),
      },
    });
  });

  it('renders NotesSection with data-options-section attribute', () => {
    const { container } = setup(<NotesSection />);
    const section = container.querySelector('[data-options-section="notes"]');
    expect(section).toBeTruthy();
  });

  it('renders the Notes title', () => {
    const { container } = setup(<NotesSection />);
    expect(container.textContent).toContain('Notes');
  });

  it('renders 4 LLM feature toggles', () => {
    const { container } = setup(<NotesSection />);
    expect(container.textContent).toContain('Auto-tag on save');
    expect(container.textContent).toContain('Auto-categorize on save');
    expect(container.textContent).toContain('Auto-summarize on save');
    expect(container.textContent).toContain('AI-enhanced search');
  });

  it('renders Backup section', () => {
    const { container } = setup(<NotesSection />);
    expect(container.textContent).toContain('Backup');
    expect(container.textContent).toContain('Change folder');
    expect(container.textContent).toContain('Sync all now');
  });

  it('renders Maintenance section', () => {
    const { container } = setup(<NotesSection />);
    expect(container.textContent).toContain('Maintenance');
    expect(container.textContent).toContain('Re-analyze all notes');
    expect(container.textContent).toContain('may take 30-60s');
  });

  it('shows No folder selected initially', () => {
    const { container } = setup(<NotesSection />);
    expect(container.textContent).toContain('No folder selected');
  });

  it('renders LLM Features card', () => {
    const { container } = setup(<NotesSection />);
    const cards = container.querySelectorAll('.ant-card');
    const llmCard = Array.from(cards).find(c => c.textContent?.includes('LLM Features'));
    expect(llmCard).toBeTruthy();
  });

  it('calls setBackupFolder when Change folder is clicked', async () => {
    const { noteFileSync } = await import('../../../src/core/notes/NoteFileSync');
    (noteFileSync.setBackupFolder as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      folderName: 'MyNotes',
    });

    const { container } = setup(<NotesSection />);

    const changeBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Change folder'),
    );
    expect(changeBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(changeBtn!);
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    expect(noteFileSync.setBackupFolder).toHaveBeenCalled();
  });
});
