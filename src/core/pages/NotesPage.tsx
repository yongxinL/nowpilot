import React, { useState, useEffect, useCallback } from 'react';
import { Button, Typography, Tooltip } from 'antd';
import { ApartmentOutlined, EditOutlined } from '@ant-design/icons';
import { notesDB } from '../storage/stores/NotesDB';
import { linkParser, linkParser as lp } from '../notes/LinkParser';
import type { Note } from '../notes/LinkParser';
import { noteGraph } from '../notes/NoteGraph';
import { NoteList } from '../../components/notes/NoteList';
import { NoteEditor } from '../../components/notes/NoteEditor';
import { BacklinksPanel } from '../../components/notes/BacklinksPanel';
import { NoteGraphView } from '../../components/notes/NoteGraphView';
import type { BacklinkEntry } from '../notes/LinkParser';

const { Text } = Typography;

export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [backlinks, setBacklinks] = useState<Map<string, BacklinkEntry[]>>(new Map());
  const [isGraphView, setIsGraphView] = useState(false);

  // Load notes on mount
  const loadNotes = useCallback(async () => {
    try {
      const all = await notesDB.getAllNotes();
      setNotes(all);
      // Rebuild index & backlinks
      lp.rebuildIndex(all);
      const bl = lp.buildBacklinks(all);
      setBacklinks(bl);
    } catch {
      // Handle gracefully
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const selectedNote = notes.find((n) => n.id === selectedNoteId) || null;
  const selectedBacklinks = selectedNoteId ? backlinks.get(selectedNoteId) || [] : [];

  const handleSelect = useCallback((id: string) => {
    setSelectedNoteId(id);
    setIsGraphView(false);
  }, []);

  const handleNew = useCallback(async () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'Untitled',
      content: '',
      created: Date.now(),
      updated: Date.now(),
      tags: [],
    };
    try {
      await notesDB.createNote(newNote);
      setNotes((prev) => [...prev, newNote]);
      lp.addToIndex(newNote);
      setSelectedNoteId(newNote.id);
    } catch {
      // Handle gracefully
    }
  }, []);

  const handleSave = useCallback(
    async (updatedNote: Note) => {
      try {
        await notesDB.updateNote(updatedNote);
        setNotes((prev) => prev.map((n) => (n.id === updatedNote.id ? updatedNote : n)));
        lp.addToIndex(updatedNote);
        // Recompute backlinks
        const all = await notesDB.getAllNotes();
        const bl = lp.buildBacklinks(all);
        setBacklinks(bl);
      } catch {
        // Handle gracefully
      }
    },
    [],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await notesDB.deleteNote(id);
        lp.removeFromIndex(id);
        setNotes((prev) => prev.filter((n) => n.id !== id));
        if (selectedNoteId === id) {
          setSelectedNoteId(null);
        }
        // Recompute backlinks
        const all = await notesDB.getAllNotes();
        const bl = lp.buildBacklinks(all);
        setBacklinks(bl);
      } catch {
        // Handle gracefully
      }
    },
    [selectedNoteId],
  );

  const handleNavigateNote = useCallback(
    (noteId: string) => {
      setSelectedNoteId(noteId);
    },
    [],
  );

  // Build graph data from notes
  const graphData = noteGraph.buildGraphData(notes);
  // Only process links that have resolved targets
  const graphLinks = graphData.links;
  const graphNodes = graphData.nodes;

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      {/* Note List (240px, collapsible) */}
      <div
        style={{
          width: 240,
          minWidth: 240,
          borderRight: '1px solid var(--ant-color-border-secondary)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--ant-color-bg-container)',
        }}
      >
        <NoteList
          notes={notes}
          selectedNoteId={selectedNoteId}
          onSelect={handleSelect}
          onNew={handleNew}
          onDelete={handleDelete}
          linkParser={lp}
        />
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 12px',
            borderBottom: '1px solid var(--ant-color-border-secondary)',
            background: 'var(--ant-color-bg-container)',
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            {selectedNote ? selectedNote.title : 'Notes'}
          </Text>
          <div>
            <Tooltip title={isGraphView ? 'Edit view' : 'Graph view'}>
              <Button
                type="text"
                size="small"
                icon={isGraphView ? <EditOutlined /> : <ApartmentOutlined />}
                onClick={() => setIsGraphView(!isGraphView)}
              />
            </Tooltip>
          </div>
        </div>

        {/* Content: either graph or editor */}
        {isGraphView ? (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <NoteGraphView
              notes={graphNodes}
              links={graphLinks}
              onNavigateNote={handleNavigateNote}
            />
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            <NoteEditor
              note={selectedNote}
              onSave={handleSave}
              linkParser={lp}
              allNotes={notes}
            />
          </div>
        )}
      </div>

      {/* Backlinks Panel (260px) */}
      <div
        style={{
          width: 260,
          minWidth: 260,
          borderLeft: '1px solid var(--ant-color-border-secondary)',
          overflowY: 'auto',
          background: 'var(--ant-color-bg-container)',
        }}
      >
        <BacklinksPanel
          backlinks={selectedBacklinks}
          onNavigateNote={handleNavigateNote}
        />
      </div>
    </div>
  );
}
