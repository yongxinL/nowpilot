import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NotesPage } from '../../src/core/pages/NotesPage';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock NotesDB
vi.mock('../../src/core/storage/stores/NotesDB', () => ({
  notesDB: {
    getAllNotes: vi.fn().mockResolvedValue([
      { id: 'n1', title: 'Note One', content: 'Content one', created: 1000, updated: 1000, tags: [] },
      { id: 'n2', title: 'Note Two', content: 'Content two', created: 1001, updated: 1001, tags: [] },
    ]),
    createNote: vi.fn().mockResolvedValue(undefined),
    updateNote: vi.fn().mockResolvedValue(undefined),
    deleteNote: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('NotesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render without crashing', async () => {
    const { container } = render(<NotesPage />);
    await new Promise((r) => setTimeout(r, 50));
    expect(container).toBeTruthy();
  });

  it('should render the "New Note" button', async () => {
    render(<NotesPage />);
    // "New Note" button renders in NoteList
    const buttons = await screen.findAllByText('New Note');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('should handle empty notes state gracefully', async () => {
    const { notesDB } = await import('../../src/core/storage/stores/NotesDB');
    (notesDB.getAllNotes as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);

    render(<NotesPage />);
    const buttons = await screen.findAllByText('New Note');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });
});
