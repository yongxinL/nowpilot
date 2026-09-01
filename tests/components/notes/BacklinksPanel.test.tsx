// BacklinksPanel.test.tsx — UI-SPEC Contract 1 (D-111).
// Sorted updated-desc rows, count Tag, empty state, onSelect, XSS gate.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BacklinksPanel, computeBacklinkEntries } from '@/components/notes/BacklinksPanel';
import type { Note } from '@/types/notes';

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: 'n1',
    title: 'Test Note',
    content: 'content',
    created: 1000,
    updated: 1000,
    tags: [],
    links: [],
    unresolvedLinks: [],
    source: { kind: 'manual' },
    aiMeta: { suggestedLinks: [], concepts: [] },
    version: 1,
    ...overrides,
  };
}

describe('BacklinksPanel — UI-SPEC Contract 1 (D-111)', () => {
  it('renders the BACKLINKS header + count Tag for 2 backlinks', () => {
    const notes = [
      makeNote({ id: 'A', title: 'Note A', links: [{ noteId: 'B', source: 'explicit' }], updated: 3000 }),
      makeNote({ id: 'B', title: 'Note B', links: [], updated: 2000 }),
      makeNote({ id: 'C', title: 'Note C', links: [{ noteId: 'B', source: 'explicit' }], updated: 1000 }),
    ];
    render(<BacklinksPanel notes={notes} noteId="B" onSelect={() => {}} />);
    expect(screen.getByText('BACKLINKS')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // count Tag
  });

  it('rows sorted updated desc (newest first)', () => {
    const notes = [
      makeNote({ id: 'A', title: 'Older Backlink', links: [{ noteId: 'B', source: 'explicit' }], updated: 1000 }),
      makeNote({ id: 'B', title: 'Note B', links: [], updated: 2000 }),
      makeNote({ id: 'C', title: 'Newer Backlink', links: [{ noteId: 'B', source: 'explicit' }], updated: 3000 }),
    ];
    render(<BacklinksPanel notes={notes} noteId="B" onSelect={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[0].textContent).toContain('Newer Backlink');
    expect(buttons[1].textContent).toContain('Older Backlink');
  });

  it('dangling-id exclusion: a note whose links reference an absent id → no row', () => {
    const notes = [
      makeNote({ id: 'A', title: 'Note A', links: [{ noteId: 'GONE', source: 'explicit' }], updated: 1000 }),
    ];
    // A links to GONE which is not in the live set → no backlink entries
    render(<BacklinksPanel notes={notes} noteId="GONE" onSelect={() => {}} />);
    expect(screen.getByText('No backlinks yet')).toBeTruthy();
  });

  it('empty state copy when zero backlinks', () => {
    const notes = [
      makeNote({ id: 'A', title: 'Note A', links: [], updated: 1000 }),
      makeNote({ id: 'B', title: 'Note B', links: [], updated: 2000 }),
    ];
    render(<BacklinksPanel notes={notes} noteId="B" onSelect={() => {}} />);
    expect(screen.getByText('No backlinks yet')).toBeTruthy();
    expect(screen.getByText('Notes that link to this one will appear here.')).toBeTruthy();
  });

  it('click row → onSelect called with the noteId', () => {
    const onSelect = vi.fn();
    const notes = [
      makeNote({ id: 'A', title: 'Note A', links: [{ noteId: 'B', source: 'explicit' }], updated: 1000 }),
      makeNote({ id: 'B', title: 'Note B', links: [], updated: 2000 }),
    ];
    render(<BacklinksPanel notes={notes} noteId="B" onSelect={onSelect} />);
    const button = screen.getByRole('button', { name: /Open backlink Note A/ });
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledWith('A');
  });

  it('STRUCTURAL XSS gate: HTML-ish title renders as plain text, no element injected', () => {
    const xssTitle = '<img src=x onerror=alert(1)>';
    const notes = [
      makeNote({ id: 'A', title: xssTitle, links: [{ noteId: 'B', source: 'explicit' }], updated: 1000 }),
      makeNote({ id: 'B', title: 'Note B', links: [], updated: 2000 }),
    ];
    render(<BacklinksPanel notes={notes} noteId="B" onSelect={() => {}} />);
    // The title appears as literal text (React JSX text node)
    expect(screen.getByText(xssTitle)).toBeTruthy();
    // No <img> element was injected
    expect(document.querySelector('img[onerror]')).toBeNull();
    expect(document.querySelector('img')).toBeNull();
  });

  it('computeBacklinkEntries: sorts updated desc', () => {
    const notes = [
      makeNote({ id: 'A', title: 'Older', links: [{ noteId: 'B', source: 'explicit' }], updated: 1000 }),
      makeNote({ id: 'B', title: 'Target', links: [], updated: 2000 }),
      makeNote({ id: 'C', title: 'Newer', links: [{ noteId: 'B', source: 'explicit' }], updated: 3000 }),
    ];
    const entries = computeBacklinkEntries(notes, 'B');
    expect(entries).toHaveLength(2);
    expect(entries[0].noteId).toBe('C');
    expect(entries[1].noteId).toBe('A');
  });

  it('maxItems caps the displayed rows', () => {
    const notes = [
      makeNote({ id: 'A', title: 'A', links: [{ noteId: 'B', source: 'explicit' }], updated: 5000 }),
      makeNote({ id: 'B', title: 'B', links: [], updated: 2000 }),
      makeNote({ id: 'C', title: 'C', links: [{ noteId: 'B', source: 'explicit' }], updated: 4000 }),
      makeNote({ id: 'D', title: 'D', links: [{ noteId: 'B', source: 'explicit' }], updated: 3000 }),
    ];
    render(<BacklinksPanel notes={notes} noteId="B" onSelect={() => {}} maxItems={2} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });
});
