// NoteGraphView.test.tsx — UI-SPEC Contract 3 (D-111).
// Node kinds, edge types, empty state, onSelect, buildGraphAdjacency unit.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteGraphView, buildGraphAdjacency } from '@/components/notes/NoteGraphView';
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

describe('NoteGraphView — UI-SPEC Contract 3 (D-111)', () => {
  it('current node rendered (kind current)', () => {
    const notes = [
      makeNote({ id: 'A', title: 'Current Note', content: 'sql database' }),
      makeNote({ id: 'B', title: 'Other Note', content: 'sql database tuning' }),
    ];
    render(<NoteGraphView notes={notes} noteId="A" onSelect={() => {}} />);
    // The current node title appears in the SVG (may be truncated)
    expect(screen.getByText(/Current Note/)).toBeTruthy();
  });

  it('similar nodes from topKSimilar (k=5) + similar edges', () => {
    const notes = [
      makeNote({ id: 'A', title: 'SQL Guide', content: 'sql database indexing' }),
      makeNote({ id: 'B', title: 'SQL Tuning', content: 'sql database performance' }),
      makeNote({ id: 'C', title: 'Cooking', content: 'recipes pasta italian' }),
    ];
    render(<NoteGraphView notes={notes} noteId="A" onSelect={() => {}} />);
    // B is similar (shares sql database)
    expect(screen.getByText(/SQL Tuning/)).toBeTruthy();
    // C appears as a similar node with score 0 (topKSimilar returns all notes up to k)
    expect(screen.queryByText(/Cooking/)).toBeTruthy();
  });

  it('backlink nodes + backlink edges', () => {
    const notes = [
      makeNote({ id: 'A', title: 'Target Note', content: 'sql database' }),
      makeNote({ id: 'B', title: 'Linking Note', content: 'cooking recipes', links: [{ noteId: 'A', source: 'explicit' }] }),
    ];
    render(<NoteGraphView notes={notes} noteId="A" onSelect={() => {}} />);
    expect(screen.getByText(/Linking Note/)).toBeTruthy();
  });

  it('empty state when the note has no similar/backlinks', () => {
    const notes = [
      makeNote({ id: 'A', title: 'Lonely Note', content: 'xyz unique content' }),
    ];
    render(<NoteGraphView notes={notes} noteId="A" onSelect={() => {}} />);
    expect(screen.getByText('No connections yet')).toBeTruthy();
    expect(screen.getByText('Related and linking notes appear here as you add wikilinks.')).toBeTruthy();
  });

  it('node click → onSelect(noteId)', () => {
    const onSelect = vi.fn();
    const notes = [
      makeNote({ id: 'A', title: 'SQL Guide', content: 'sql database indexing' }),
      makeNote({ id: 'B', title: 'SQL Tuning', content: 'sql database performance' }),
    ];
    render(<NoteGraphView notes={notes} noteId="A" onSelect={onSelect} />);
    // Click on the "SQL Tuning" node
    const node = screen.getByLabelText('Open note SQL Tuning');
    fireEvent.click(node);
    expect(onSelect).toHaveBeenCalledWith('B');
  });

  it('buildGraphAdjacency unit: node kinds + edge types + no self-edges', () => {
    const notes = [
      makeNote({ id: 'A', title: 'SQL Guide', content: 'sql database indexing', updated: 1000 }),
      makeNote({ id: 'B', title: 'SQL Tuning', content: 'sql database performance', updated: 2000 }),
      makeNote({ id: 'C', title: 'Cooking', content: 'recipes pasta italian', links: [{ noteId: 'A', source: 'explicit' }], updated: 3000 }),
    ];
    const adjacency = buildGraphAdjacency(notes, 'A');
    // Current node
    const current = adjacency.nodes.find((n) => n.kind === 'current');
    expect(current?.id).toBe('A');
    // B is similar (shares 'sql', 'database' with A)
    const similar = adjacency.nodes.filter((n) => n.kind === 'similar');
    expect(similar.some((n) => n.id === 'B')).toBe(true);
    // C is in the graph (topKSimilar returns all notes up to k, C has score 0)
    // AND it has a backlink edge because C.links includes 'A'
    expect(adjacency.nodes.some((n) => n.id === 'C')).toBe(true);
    // No self-edges
    const selfEdges = adjacency.edges.filter((e) => e.source === e.target);
    expect(selfEdges).toHaveLength(0);
    // Edge types: similar edge A→B, backlink edge C→A
    const similarEdges = adjacency.edges.filter((e) => e.type === 'similar');
    const backlinkEdges = adjacency.edges.filter((e) => e.type === 'backlink');
    expect(similarEdges.length).toBeGreaterThanOrEqual(1);
    expect(backlinkEdges.length).toBeGreaterThanOrEqual(1);
    // The backlink edge is from C to A
    expect(backlinkEdges.some((e) => e.source === 'C' && e.target === 'A')).toBe(true);
  });

  it('buildGraphAdjacency: empty for unknown noteId', () => {
    const adjacency = buildGraphAdjacency([], 'MISSING');
    expect(adjacency.nodes).toHaveLength(0);
    expect(adjacency.edges).toHaveLength(0);
  });
});
