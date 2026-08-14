// tests/components/notes/BacklinksPanel.test.tsx — Phase 5 (05-07, D-05-17,
// KNW-02): BacklinksPanel derives in-links via NoteGraph.backlinkIndex on the
// current note list (rows = title + snippet, click → onOpenNote, empty →
// STR.notes.backlinksEmpty) AND the PortableMarkdown wikilink extension
// (Open Q4 / T-05-24): resolved [[Title]] renders as a link (data-np-wikilink
// marker), unresolved renders muted/dashed + 'Create note' affordance; without
// the wikilinks prop the render path is byte-identical (no marker elements)
// and DOMPurify still sanitizes unconditionally.
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BacklinksPanel } from '@/components/notes/BacklinksPanel';
import { PortableMarkdown } from '@/core/components/PortableMarkdown';
import { STR } from '@/core/i18n/strings';
import type { Note } from '@/core/storage/NotesDB';

// jsdom lacks ResizeObserver — antd Badge (backlink count) relies on
// rc-resize-observer; a minimal no-op stub keeps the real component alive
// (ChatPage.test.tsx precedent).
class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', NoopResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeNote(id: string, title: string, overrides: Partial<Note> = {}): Note {
  return {
    id,
    title,
    content: `content of ${title}`,
    created: 1,
    updated: 2,
    tags: [],
    links: [],
    unresolvedLinks: [],
    source: { kind: 'manual' },
    aiMeta: { suggestedLinks: [], concepts: [] },
    version: 1,
    ...overrides,
  };
}

// Fixture: three notes — Alpha links to the current note 'cur'; Beta and Gamma
// do not. Exactly one backlink row is expected.
const FIXTURE: Note[] = [
  makeNote('cur', 'Current'),
  makeNote('alpha', 'Alpha', { links: ['cur'], content: 'Alpha snippet line one\nline two' }),
  makeNote('beta', 'Beta'),
  makeNote('gamma', 'Gamma'),
];

describe('BacklinksPanel — derived in-links (D-05-17)', () => {
  it('renders exactly the rows for notes whose links[] contain the current id (title + snippet)', () => {
    const onOpen = vi.fn();
    render(<BacklinksPanel noteId="cur" notes={FIXTURE} onOpenNote={onOpen} />);
    expect(screen.getByText(STR.notes.backlinks)).toBeTruthy();
    // Exactly one backlink row (Alpha) with title + first-line snippet.
    const rows = document.querySelectorAll('[data-np-backlink-row]');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Alpha');
    expect(rows[0].textContent).toContain('Alpha snippet line one');
    expect(screen.queryByText('Beta')).toBeNull();
  });

  it('empty: current note with no in-links → STR.notes.backlinksEmpty', () => {
    const onOpen = vi.fn();
    render(<BacklinksPanel noteId="beta" notes={FIXTURE} onOpenNote={onOpen} />);
    expect(screen.getByText(STR.notes.backlinksEmpty)).toBeTruthy();
    expect(document.querySelectorAll('[data-np-backlink-row]')).toHaveLength(0);
  });

  it('row click → onOpenNote with the backlink note id', () => {
    const onOpen = vi.fn();
    render(<BacklinksPanel noteId="cur" notes={FIXTURE} onOpenNote={onOpen} />);
    const row = document.querySelector('[data-np-backlink-row]');
    expect(row).not.toBeNull();
    fireEvent.click(row!);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith('alpha');
  });

  it('collapse tooltip distinguishes state (IN-01): expanded → Collapse, collapsed → Expand', () => {
    const onOpen = vi.fn();
    const view = render(<BacklinksPanel noteId="cur" notes={FIXTURE} onOpenNote={onOpen} />);
    // Expanded by default: the collapse control announces collapse.
    const button = screen.getByRole('button', { name: STR.notes.backlinksCollapse });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    // The section's own label stays STR.notes.backlinks (unchanged contract).
    expect(screen.getByLabelText(STR.notes.backlinks)).toBeTruthy();
    // Click to collapse → the control now announces expand, and the rows vanish.
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: STR.notes.backlinksExpand })).toBeTruthy();
    expect(document.querySelectorAll('[data-np-backlink-row]')).toHaveLength(0);
    // Collapse is not a removal — re-expanding restores the rows.
    fireEvent.click(screen.getByRole('button', { name: STR.notes.backlinksExpand }));
    expect(document.querySelectorAll('[data-np-backlink-row]')).toHaveLength(1);
    expect(view.container.textContent).toContain('Alpha');
  });
});

describe('PortableMarkdown — wikilinks prop (Open Q4 / T-05-24)', () => {
  it('resolved [[Title]] renders as a data-np-wikilink link; click → onOpen', () => {
    const onOpen = vi.fn();
    const onCreate = vi.fn();
    const { container } = render(
      <PortableMarkdown
        content="See [[Alpha]] and [[Ghost]]"
        wikilinks={{
          resolve: (title) => (title === 'Alpha' ? { id: 'note-alpha' } : null),
          onOpen,
          onCreate,
        }}
      />,
    );
    // Resolved → a link element with the marker + href + title.
    const link = container.querySelector('[data-np-wikilink="1"]');
    expect(link).not.toBeNull();
    expect(link?.getAttribute('href')).toBe('#note-note-alpha');
    expect(link?.getAttribute('data-title')).toBe('Alpha');
    expect(link?.textContent).toBe('Alpha');
    // Unresolved → muted/dashed span with the data-create-note marker.
    const unresolved = container.querySelector('[data-np-wikilink-unresolved="1"]');
    expect(unresolved).not.toBeNull();
    expect(unresolved?.getAttribute('data-create-note')).toBe('1');
    expect(unresolved?.textContent).toContain('[[Ghost]]');
    expect(container.textContent).toContain(STR.notes.createNote);
    // Click resolved link → onOpen(noteId); click Create note → onCreate(title).
    fireEvent.click(link!);
    expect(onOpen).toHaveBeenCalledWith('note-alpha');
    fireEvent.click(container.querySelector('[data-np-wikilink-create-note="1"]')!);
    expect(onCreate).toHaveBeenCalledWith('Ghost');
  });

  it('without the wikilinks prop → no marker elements (byte-identical) and DOMPurify still strips script', () => {
    const { container } = render(
      <PortableMarkdown content="See [[Alpha]] and <script>bad()</script>" />,
    );
    // Marker data attributes are ABSENT — byte-identical to pre-Phase-5.
    expect(container.querySelector('[data-np-wikilink]')).toBeNull();
    expect(container.querySelector('[data-np-wikilink-unresolved]')).toBeNull();
    expect(container.querySelector('[data-create-note]')).toBeNull();
    // The literal wikilink text renders as-is.
    expect(container.textContent).toContain('[[Alpha]]');
    // Unconditional sanitization: the injected script is stripped.
    expect(container.innerHTML).not.toContain('<script');
    expect(screen.queryByText(/bad\(\)/)).toBeNull();
  });
});
