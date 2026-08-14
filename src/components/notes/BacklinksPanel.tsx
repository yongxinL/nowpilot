// src/components/notes/BacklinksPanel.tsx — Phase 5 (§18 create-list path,
// D-05-17 / KNW-02, UI-SPEC BacklinksPanel contract): lists the current note's
// in-links — the notes whose links[] contain this note's id — DERIVED on
// demand via NoteGraph.backlinkIndex (never a graph store, never
// parse-at-render). Rows: note title (14px/600) + 1-line snippet (content
// first line, 2-line clamp); row click → onOpenNote(note.id). Collapsible
// section below the body; empty → STR.notes.backlinksEmpty; section title
// STR.notes.backlinks (16px/600); the backlink count badges the header (accent
// colorPrimary). Icon-only collapse chevron carries aria-label + Tooltip and
// meets the ≥36px (Standalone) touch-target rule (UI-SPEC Icon-only control
// accessibility).
import { useState } from 'react';
import { Badge, Button, Tooltip, Typography, theme } from 'antd';
import { CaretDownOutlined, CaretRightOutlined } from '@ant-design/icons';
import { backlinkIndex } from '@/core/notes/NoteGraph';
import type { Note } from '@/core/storage/NotesDB';
import { STR } from '@/core/i18n/strings';

export interface BacklinksPanelProps {
  /** The note whose in-links are listed. */
  noteId: string;
  /** All notes (in-memory list — derived on demand, D-05-17). */
  notes: readonly Pick<Note, 'id' | 'title' | 'content' | 'links'>[];
  /** Row click → open that note (single navigation contract, D-05-17). */
  onOpenNote: (noteId: string) => void;
}

export function BacklinksPanel({ noteId, notes, onOpenNote }: BacklinksPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const { token } = theme.useToken();
  const inLinks = backlinkIndex(notes).get(noteId) ?? [];

  const snippetOf = (content: string): string => {
    const firstLine = content.split('\n')[0] ?? '';
    return firstLine.trim();
  };

  return (
    <section data-np-backlinks-panel="1" aria-label={STR.notes.backlinks}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Typography.Text strong style={{ fontSize: 16 }}>
          {STR.notes.backlinks}
        </Typography.Text>
        {inLinks.length > 0 && (
          <Badge
            count={inLinks.length}
            showZero={false}
            style={{ backgroundColor: token.colorPrimary }}
          />
        )}
        <Tooltip title={expanded ? STR.notes.backlinksCollapse : STR.notes.backlinksExpand}>
          <Button
            type="text"
            size="small"
            aria-label={expanded ? STR.notes.backlinksCollapse : STR.notes.backlinksExpand}
            aria-expanded={expanded}
            icon={expanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
            onClick={() => setExpanded((e) => !e)}
            style={{ minWidth: 36, minHeight: 36, color: token.colorTextSecondary }}
          />
        </Tooltip>
      </div>
      {expanded &&
        (inLinks.length === 0 ? (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {STR.notes.backlinksEmpty}
          </Typography.Text>
        ) : (
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: '4px 0 0',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}
          >
            {inLinks.map((id) => {
              const note = notes.find((n) => n.id === id);
              if (!note) return null;
              return (
                <li key={id}>
                  <button
                    type="button"
                    data-np-backlink-row="1"
                    onClick={() => onOpenNote(note.id)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '6px 8px',
                      borderRadius: 6,
                    }}
                  >
                    <Typography.Text strong style={{ fontSize: 14, display: 'block' }} ellipsis>
                      {note.title}
                    </Typography.Text>
                    <Typography.Text
                      type="secondary"
                      style={{
                        fontSize: 13,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {snippetOf(note.content)}
                    </Typography.Text>
                  </button>
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}
