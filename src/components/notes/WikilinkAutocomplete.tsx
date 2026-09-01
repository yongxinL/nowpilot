// WikilinkAutocomplete.tsx — D-111/D-04 MiniSearch title-match core + thin
// popover (UI-SPEC Contract 2).
//
// Core logic: query = text after '[['; MiniSearch TITLE matching via
// MiniSearchIndex, top-k <= 10, WIKI-ID-02 tie-break (updated desc -> id asc).
// NO LLM suggestions in v0.1 (D-04) — title matching only.
//
// Renders through React JSX text nodes only — no raw HTML rendering (CTX-02).
// The [[ trigger + caret anchoring is Phase-15 editor integration (commented).

import React, { useState, useEffect, useCallback, useRef } from 'react';

import type { NoteHit } from '../../core/search/MiniSearchIndex';

/** Wikilink suggestion (UI-SPEC Contract 2). */
export interface WikilinkSuggestion {
  noteId: string;
  title: string;
}

/** Top-k cap (UI-SPEC Contract 2). */
export const AUTOCOMPLETE_MAX = 10;

/**
 * Search suggestions from MiniSearch hits by title (pure helper, UI-SPEC Contract 2).
 * Filters hits whose title contains the query (case-insensitive), deduplicates by
 * noteId, sorts by title match quality (exact prefix first, then WIKI-ID-02
 * tie-break: updated desc -> id asc), caps at AUTOCOMPLETE_MAX.
 *
 * @param hits - MiniSearch hits (carry stored fields incl. `updated` per NoteDoc).
 * @param query - The text after '[[' (already trimmed).
 * @param now - Optional current time (for tie-break stability in tests).
 */
export function searchSuggestions(
  hits: NoteHit[],
  query: string,
  now?: number,
): WikilinkSuggestion[] {
  const q = query.toLowerCase();
  const seen = new Set<string>();
  const results: { suggestion: WikilinkSuggestion; updated: number; titleLower: string }[] = [];

  for (const hit of hits) {
    if (seen.has(hit.id)) continue;
    const titleLower = hit.title.toLowerCase();
    if (!titleLower.includes(q)) continue;
    seen.add(hit.id);
    results.push({
      suggestion: { noteId: hit.id, title: hit.title },
      updated: hit.updated,
      titleLower,
    });
  }

  // Sort: exact prefix first, then WIKI-ID-02 tie-break (updated desc -> id asc)
  results.sort((a, b) => {
    const aPrefix = a.titleLower.startsWith(q);
    const bPrefix = b.titleLower.startsWith(q);
    if (aPrefix !== bPrefix) return aPrefix ? -1 : 1;
    if (b.updated !== a.updated) return b.updated - a.updated;
    return a.suggestion.noteId < b.suggestion.noteId ? -1 : a.suggestion.noteId > b.suggestion.noteId ? 1 : 0;
  });

  return results.slice(0, AUTOCOMPLETE_MAX).map((r) => r.suggestion);
}

/** WikilinkAutocomplete props (UI-SPEC Contract 2). */
interface WikilinkAutocompleteProps {
  query: string;
  open: boolean;
  onSelect: (s: WikilinkSuggestion) => void;
  onClose: () => void;
  /** Optional search function (defaults to MiniSearchIndex.query via openNotesDB). */
  searchFn?: (q: string) => Promise<NoteHit[]>;
}

/**
 * WikilinkAutocomplete — D-111/D-04 core logic + thin popover. MiniSearch title
 * matching only (D-04: no LLM suggestions in v0.1). role=listbox/option, arrow-key
 * navigation, Enter accept, Esc dismiss.
 *
 * The [[ trigger + caret anchoring is Phase-15 editor integration (commented).
 * Focus remains in the editor (Phase-15 wiring).
 */
export const WikilinkAutocomplete: React.FC<WikilinkAutocompleteProps> = ({
  query,
  open,
  onSelect,
  onClose,
  searchFn,
}) => {
  const [suggestions, setSuggestions] = useState<WikilinkSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // Ref mirror of activeIndex so handleKeyDown reads the latest value
  // (avoids stale closure over state between key events).
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  // Fetch suggestions when query changes
  useEffect(() => {
    if (!open || !query.trim()) {
      setSuggestions([]);
      setActiveIndex(0);
      return;
    }

    let cancelled = false;
    const doSearch = async () => {
      try {
        let hits: NoteHit[];
        if (searchFn) {
          hits = await searchFn(query);
        } else {
          // Default: use MiniSearchIndex via openNotesDB (lazy import to avoid circular deps)
          const { openNotesDB } = await import('../../core/storage/NotesDB');
          const { query: mQuery } = await import('../../core/search/MiniSearchIndex');
          const db = await openNotesDB();
          hits = await mQuery(db, query);
        }
        if (!cancelled) {
          setSuggestions(searchSuggestions(hits, query));
          setActiveIndex(0);
        }
      } catch {
        if (!cancelled) setSuggestions([]);
      }
    };
    void doSearch();
    return () => { cancelled = true; };
  }, [query, open, searchFn]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open || suggestions.length === 0) {
      if (e.key === 'Escape') onClose();
      return;
    }
    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = (activeIndexRef.current + 1) % suggestions.length;
        activeIndexRef.current = next;
        setActiveIndex(next);
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const next = (activeIndexRef.current - 1 + suggestions.length) % suggestions.length;
        activeIndexRef.current = next;
        setActiveIndex(next);
        break;
      }
      case 'Enter':
        e.preventDefault();
        onSelect(suggestions[activeIndexRef.current]);
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [open, suggestions, onSelect, onClose]);

  if (!open || !query.trim()) return null;

  if (suggestions.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{
          background: 'var(--card, #fff)',
          borderRadius: 12,
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          padding: 16,
          minWidth: 200,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
          No matching notes
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted-foreground, #6b7280)' }}>
          Create the note first, then link to it.
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      role="listbox"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        background: 'var(--card, #fff)',
        borderRadius: 12,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        maxHeight: 240,
        overflowY: 'auto',
        minWidth: 200,
      }}
    >
      {suggestions.map((s, i) => (
        <div
          key={s.noteId}
          role="option"
          aria-selected={i === activeIndex}
          onClick={() => onSelect(s)}
          style={{
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: 13,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            background: i === activeIndex ? 'var(--primary-bg, #eff6ff)' : 'transparent',
            color: i === activeIndex ? 'var(--primary-text, #1d4ed8)' : 'inherit',
          }}
        >
          {s.title}
        </div>
      ))}
    </div>
  );
};
