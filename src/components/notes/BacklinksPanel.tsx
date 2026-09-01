// BacklinksPanel.tsx — D-111 backlink listing core + thin list (UI-SPEC Contract 1).
//
// Core logic: reverse index over links[] via NoteGraph.computeBacklinks, rows
// { noteId, title, updated } sorted updated desc. Dangling IDs excluded
// (WIKI-ID-04). Renders through React JSX text nodes only — no raw HTML
// rendering (CTX-02; grep-assertable).
//
// Phase-15 NotesWorkspace integration is a caller edit (scope fence).

import React, { useMemo } from 'react';
import { Tag, Typography } from 'antd';

import type { Note } from '../../types/notes';
import { computeBacklinks } from '../../core/notes/NoteGraph';

const { Text } = Typography;

/** Backlink entry — reverse index over links[] (UI-SPEC Contract 1). */
export interface BacklinkEntry {
  noteId: string;
  title: string;
  updated: number;
}

/**
 * Compute backlink entries for `noteId` over the LIVE note set (pure helper).
 * Reverse index via computeBacklinks, rows { noteId, title, updated } sorted
 * updated desc. Dangling IDs excluded — WIKI-ID-04.
 */
export function computeBacklinkEntries(notes: Note[], noteId: string): BacklinkEntry[] {
  const backlinks = computeBacklinks(notes);
  const referencingIds = backlinks.get(noteId) ?? [];
  const noteById = new Map(notes.map((n) => [n.id, n]));
  const entries: BacklinkEntry[] = [];
  for (const refId of referencingIds) {
    const note = noteById.get(refId);
    if (note) {
      entries.push({ noteId: note.id, title: note.title, updated: note.updated });
    }
  }
  entries.sort((a, b) => b.updated - a.updated);
  return entries;
}

/** Relative time formatter (minutes/hours/days ago). */
function relativeTime(updated: number): string {
  const diff = Date.now() - updated;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** BacklinksPanel props (UI-SPEC Contract 1). */
interface BacklinksPanelProps {
  notes: Note[];
  noteId: string;
  onSelect: (noteId: string) => void;
  maxItems?: number;
}

/**
 * BacklinksPanel — D-111 core logic + thin list. Header 'BACKLINKS' + count
 * Tag; scrollable list of keyboard-focusable rows (title + relative time); empty
 * state 'No backlinks yet' + body copy. React JSX only.
 */
export const BacklinksPanel: React.FC<BacklinksPanelProps> = ({
  notes,
  noteId,
  onSelect,
  maxItems,
}) => {
  const entries = useMemo(() => computeBacklinkEntries(notes, noteId), [notes, noteId]);
  const displayed = maxItems != null ? entries.slice(0, maxItems) : entries;

  if (entries.length === 0) {
    return (
      <div style={{ padding: 16, background: 'var(--card, #fff)', borderRadius: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)', marginBottom: 8 }}>
          BACKLINKS
        </div>
        <Text strong style={{ fontSize: 14, display: 'block', marginBottom: 4 }}>
          No backlinks yet
        </Text>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Notes that link to this one will appear here.
        </Text>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--card, #fff)', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border, #f0f0f0)' }}>
        <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted-foreground)' }}>
          BACKLINKS
        </div>
        <Tag color="blue">{entries.length}</Tag>
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto' }}>
        {displayed.map((entry) => (
          <button
            key={entry.noteId}
            onClick={() => onSelect(entry.noteId)}
            aria-label={`Open backlink ${entry.title}`}
            title={entry.title}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              minHeight: 32,
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              borderBottom: '1px solid var(--border, #f0f0f0)',
            }}
          >
            <span style={{
              color: '#3b82f6',
              fontSize: 13,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              marginRight: 8,
            }}>
              {entry.title}
            </span>
            <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
              {relativeTime(entry.updated)}
            </Text>
          </button>
        ))}
      </div>
    </div>
  );
};
