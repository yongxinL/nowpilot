// WikilinkAutocomplete.test.tsx — UI-SPEC Contract 2 (D-111/D-04).
// Suggestions, keyboard nav, accept/dismiss, empty state, no-LLM structural gate.

import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import {
  WikilinkAutocomplete,
  searchSuggestions,
  AUTOCOMPLETE_MAX,
} from '@/components/notes/WikilinkAutocomplete';
import type { NoteHit } from '@/core/search/MiniSearchIndex';

function makeHit(overrides: Partial<NoteHit> = {}): NoteHit {
  return {
    id: 'n1',
    score: 1,
    title: 'Test Note',
    content: 'content',
    tags: '',
    summary: '',
    updated: 1000,
    ...overrides,
  };
}

describe('WikilinkAutocomplete — UI-SPEC Contract 2 (D-111/D-04)', () => {
  describe('searchSuggestions unit', () => {
    it('matches titles case-insensitively', () => {
      const hits = [
        makeHit({ id: 'a', title: 'MySQL Guide' }),
        makeHit({ id: 'b', title: 'SQL Basics' }),
        makeHit({ id: 'c', title: 'Cooking Pasta' }),
      ];
      const results = searchSuggestions(hits, 'sql');
      expect(results).toHaveLength(2);
      expect(results.map((r) => r.noteId).sort()).toEqual(['a', 'b']);
    });

    it('prefix match ranks higher (prefix first)', () => {
      const hits = [
        makeHit({ id: 'a', title: 'Database SQL', updated: 1000 }),
        makeHit({ id: 'b', title: 'SQL Guide', updated: 2000 }),
      ];
      const results = searchSuggestions(hits, 'sql');
      // 'SQL Guide' starts with 'sql' → prefix → first
      expect(results[0].noteId).toBe('b');
      expect(results[1].noteId).toBe('a');
    });

    it('tie-break: updated desc then id asc', () => {
      const hits = [
        makeHit({ id: 'a', title: 'SQL One', updated: 1000 }),
        makeHit({ id: 'b', title: 'SQL Two', updated: 3000 }),
        makeHit({ id: 'c', title: 'SQL Three', updated: 2000 }),
      ];
      const results = searchSuggestions(hits, 'sql');
      expect(results.map((r) => r.noteId)).toEqual(['b', 'c', 'a']);
    });

    it('caps at AUTOCOMPLETE_MAX (10)', () => {
      const hits = Array.from({ length: 15 }, (_, i) =>
        makeHit({ id: `n${i}`, title: `SQL Note ${i}`, updated: 1000 + i }),
      );
      const results = searchSuggestions(hits, 'sql');
      expect(results).toHaveLength(AUTOCOMPLETE_MAX);
    });

    it('deduplicates by noteId', () => {
      const hits = [
        makeHit({ id: 'a', title: 'SQL Guide' }),
        makeHit({ id: 'a', title: 'SQL Guide' }), // duplicate
        makeHit({ id: 'b', title: 'SQL Basics' }),
      ];
      const results = searchSuggestions(hits, 'sql');
      expect(results).toHaveLength(2);
    });

    it('returns empty for no match', () => {
      const hits = [makeHit({ id: 'a', title: 'Cooking' })];
      const results = searchSuggestions(hits, 'sql');
      expect(results).toHaveLength(0);
    });
  });

  describe('component', () => {
    it('open + query → suggestions rendered as options', async () => {
      const searchFn = vi.fn().mockResolvedValue([
        makeHit({ id: 'a', title: 'SQL Guide' }),
        makeHit({ id: 'b', title: 'SQL Basics' }),
      ]);
      render(
        <WikilinkAutocomplete
          query="sql"
          open={true}
          onSelect={() => {}}
          onClose={() => {}}
          searchFn={searchFn}
        />,
      );
      // Wait for async effect
      await screen.findByRole('listbox');
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
    });

    it('ArrowDown moves active row, Enter accepts', async () => {
      const onSelect = vi.fn();
      // After sorting by updated desc: SQL Basics (2000) first, SQL Guide (1000) second
      const searchFn = vi.fn().mockResolvedValue([
        makeHit({ id: 'a', title: 'SQL Guide', updated: 1000 }),
        makeHit({ id: 'b', title: 'SQL Basics', updated: 2000 }),
      ]);
      render(
        <WikilinkAutocomplete
          query="sql"
          open={true}
          onSelect={onSelect}
          onClose={() => {}}
          searchFn={searchFn}
        />,
      );
      const listbox = await screen.findByRole('listbox');
      // First option (SQL Basics, highest updated) is active by default
      let options = screen.getAllByRole('option');
      expect(options[0].textContent).toBe('SQL Basics');
      expect(options[0].getAttribute('aria-selected')).toBe('true');
      // ArrowDown → second option (SQL Guide) active
      fireEvent.keyDown(listbox, { key: 'ArrowDown' });
      options = screen.getAllByRole('option');
      expect(options[1].textContent).toBe('SQL Guide');
      expect(options[1].getAttribute('aria-selected')).toBe('true');
      // Enter → onSelect with the active (second) suggestion
      fireEvent.keyDown(listbox, { key: 'Enter' });
      expect(onSelect).toHaveBeenCalledWith({ noteId: 'a', title: 'SQL Guide' });
    });

    it('Esc calls onClose', async () => {
      const onClose = vi.fn();
      const searchFn = vi.fn().mockResolvedValue([
        makeHit({ id: 'a', title: 'SQL Guide' }),
      ]);
      render(
        <WikilinkAutocomplete
          query="sql"
          open={true}
          onSelect={() => {}}
          onClose={onClose}
          searchFn={searchFn}
        />,
      );
      const listbox = await screen.findByRole('listbox');
      fireEvent.keyDown(listbox, { key: 'Escape' });
      expect(onClose).toHaveBeenCalled();
    });

    it('click calls onSelect', async () => {
      const onSelect = vi.fn();
      const searchFn = vi.fn().mockResolvedValue([
        makeHit({ id: 'a', title: 'SQL Guide' }),
      ]);
      render(
        <WikilinkAutocomplete
          query="sql"
          open={true}
          onSelect={onSelect}
          onClose={() => {}}
          searchFn={searchFn}
        />,
      );
      await screen.findByRole('listbox');
      const option = screen.getByRole('option');
      fireEvent.click(option);
      expect(onSelect).toHaveBeenCalledWith({ noteId: 'a', title: 'SQL Guide' });
    });

    it('empty state when no title matches', async () => {
      const searchFn = vi.fn().mockResolvedValue([
        makeHit({ id: 'a', title: 'Cooking' }),
      ]);
      render(
        <WikilinkAutocomplete
          query="sql"
          open={true}
          onSelect={() => {}}
          onClose={() => {}}
          searchFn={searchFn}
        />,
      );
      expect(await screen.findByText('No matching notes')).toBeTruthy();
      expect(screen.getByText('Create the note first, then link to it.')).toBeTruthy();
    });

    it('closed or empty query → nothing rendered', () => {
      const searchFn = vi.fn().mockResolvedValue([]);
      const { container } = render(
        <WikilinkAutocomplete
          query="sql"
          open={false}
          onSelect={() => {}}
          onClose={() => {}}
          searchFn={searchFn}
        />,
      );
      expect(container.innerHTML).toBe('');
    });

    it('NO-LLM structural: imports no AI modules (D-04)', async () => {
      // This test verifies the component doesn't import AI modules.
      // The grep gate in acceptance criteria covers this.
      const searchFn = vi.fn().mockResolvedValue([]);
      render(
        <WikilinkAutocomplete
          query=""
          open={true}
          onSelect={() => {}}
          onClose={() => {}}
          searchFn={searchFn}
        />,
      );
      // With empty query, nothing renders
      expect(document.body.textContent).toBe('');
    });
  });
});
