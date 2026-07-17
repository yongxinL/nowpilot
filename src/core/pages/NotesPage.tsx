import React, { useState, useEffect, useCallback } from 'react';
import { Button, Typography, Tooltip, Tag } from 'antd';
import { ApartmentOutlined, EditOutlined, FolderOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { notesDB } from '../storage/stores/NotesDB';
import { linkParser, linkParser as lp } from '../notes/LinkParser';
import type { Note } from '../notes/LinkParser';
import { noteGraph } from '../notes/NoteGraph';
import { noteFileSync } from '../notes/NoteFileSync';
import { noteQA } from '../notes/NoteQA';
import { noteTagger } from '../notes/NoteTagger';
import { noteMaintenance } from '../notes/NoteMaintenance';
import { AskNotesInput } from '../../components/notes/AskNotesInput';
import { NoteList } from '../../components/notes/NoteList';
import { NoteEditor } from '../../components/notes/NoteEditor';
import { BacklinksPanel } from '../../components/notes/BacklinksPanel';
import { NoteGraphView } from '../../components/notes/NoteGraphView';
import type { BacklinkEntry } from '../notes/LinkParser';
import type { LlmFeatureToggles, Citation, SyncStatus } from '../notes/noteTypes';

const { Text } = Typography;

export function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [backlinks, setBacklinks] = useState<Map<string, BacklinkEntry[]>>(new Map());
  const [isGraphView, setIsGraphView] = useState(false);
  const [ragAnswer, setRagAnswer] = useState<{ text: string; citations: Citation[] } | null>(null);
  const [ragLoading, setRagLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('off');
  const [syncFolderName, setSyncFolderName] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'flat' | 'tree'>('flat');
  const [llmFeatures, setLlmFeatures] = useState<LlmFeatureToggles>({
    autoTag: true,
    autoCategorize: true,
    autoSummary: true,
    aiSearch: false,
  } as LlmFeatureToggles);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);
  const [suggestedSummary, setSuggestedSummary] = useState<string | null>(null);
  const [acceptedTags, setAcceptedTags] = useState<Set<string>>(new Set());
  const [suggestedTagsLoading, setSuggestedTagsLoading] = useState(false);
  const [currentNoteStaleness, setCurrentNoteStaleness] = useState(false);

  const loadNotes = useCallback(async () => {
    try {
      const all = await notesDB.getAllNotes();
      setNotes(all);
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

  useEffect(() => {
    chrome.storage.local.get('np_notes_llm_features').then((result) => {
      if (result['np_notes_llm_features']) {
        setLlmFeatures(result['np_notes_llm_features'] as LlmFeatureToggles);
      }
    }).catch(() => {});
    noteFileSync.getBackupStatus().then((status) => {
      setSyncStatus(status.status);
      setSyncFolderName(status.folderName || null);
      setSyncError(status.error || null);
    }).catch(() => {});
  }, []);

  // Compute staleness when selected note changes
  useEffect(() => {
    if (selectedNote) {
      const stale =
        selectedNote.updated > (selectedNote.tagsGeneratedAt || 0) ||
        selectedNote.updated > (selectedNote.summaryGeneratedAt || 0);
      setCurrentNoteStaleness(stale);
    } else {
      setCurrentNoteStaleness(false);
    }
  }, [selectedNoteId]);

  const selectedNote = notes.find((n) => n.id === selectedNoteId) || null;
  const selectedBacklinks = selectedNoteId ? backlinks.get(selectedNoteId) || [] : [];

  const handleSelect = useCallback((id: string) => {
    setSelectedNoteId(id);
    setIsGraphView(false);
    setSuggestedTags([]);
    setSuggestedCategory(null);
    setSuggestedSummary(null);
    setAcceptedTags(new Set());
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
        const isNew = !notes.find((n) => n.id === updatedNote.id);
        await notesDB.updateNote(updatedNote);
        setNotes((prev) => prev.map((n) => (n.id === updatedNote.id ? updatedNote : n)));
        lp.addToIndex(updatedNote);
        const all = await notesDB.getAllNotes();
        const bl = lp.buildBacklinks(all);
        setBacklinks(bl);

        // Fire-and-forget filesystem sync (SYNC-03, D-09)
        if (syncStatus === 'on') {
          noteFileSync.sync(updatedNote, isNew ? 'create' : 'update').then((result) => {
            if (result?.conflict) {
              // External change detected — SYNC-06
            }
          }).catch(() => {});
        }

        // LLM analysis if features enabled (LLM-WIKI-01)
        if (llmFeatures.autoTag || llmFeatures.autoCategorize || llmFeatures.autoSummary) {
          setSuggestedTagsLoading(true);
          const allCategories = [...new Set(all.map((n) => n.categoryPath).filter(Boolean) as string[])];
          noteTagger
            .analyze({ title: updatedNote.title, content: updatedNote.content }, allCategories)
            .then((result) => {
              setSuggestedTags(result.tags);
              setSuggestedCategory(result.categoryPath);
              setSuggestedSummary(result.summary);
              // MEM-02: memory facts returned by tagger for downstream routing
            })
            .finally(() => setSuggestedTagsLoading(false));
        }
      } catch {
        // Handle gracefully
      }
    },
    [notes, syncStatus, llmFeatures],
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
        const all = await notesDB.getAllNotes();
        const bl = lp.buildBacklinks(all);
        setBacklinks(bl);

        // Fire-and-forget filesystem delete sync
        if (syncStatus === 'on') {
          const deletedNote = notes.find((n) => n.id === id);
          if (deletedNote) {
            noteFileSync.sync(deletedNote, 'delete').catch(() => {});
          }
        }
      } catch {
        // Handle gracefully
      }
    },
    [selectedNoteId, notes, syncStatus],
  );

  const handleNavigateNote = useCallback((noteId: string) => {
    setSelectedNoteId(noteId);
  }, []);

  const graphData = noteGraph.buildGraphData(notes);
  const graphLinks = graphData.links;
  const graphNodes = graphData.nodes;

  return (
    <div style={{ display: 'flex', height: '100%', width: '100%' }}>
      {/* Note List (240px) */}
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
          viewMode={viewMode}
          onToggleViewMode={() => setViewMode((v) => (v === 'flat' ? 'tree' : 'flat'))}
          backlinks={backlinks}
          aiSearchEnabled={llmFeatures.aiSearch}
          onToggleAiSearch={() => setLlmFeatures((prev) => ({ ...prev, aiSearch: !prev.aiSearch }))}
          allNotes={notes}
        />
      </div>

      {/* Main content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* AskNotesInput (RAG Q&A) */}
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--ant-color-border-secondary)' }}>
          <AskNotesInput
            linkParser={lp}
            allNotes={notes}
            onSelectNote={(noteId) => setSelectedNoteId(noteId)}
          />
        </div>

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag
              color={syncStatus === 'on' ? 'green' : syncStatus === 'error' ? 'red' : 'default'}
              style={{ margin: 0 }}
            >
              Backup: {syncStatus === 'on' ? 'On' : syncStatus === 'error' ? 'Error' : 'Off'}
            </Tag>
            <Tooltip title={viewMode === 'flat' ? 'Tree view' : 'List view'}>
              <Button
                type="text"
                size="small"
                icon={viewMode === 'flat' ? <FolderOutlined /> : <UnorderedListOutlined />}
                onClick={() => setViewMode((v) => (v === 'flat' ? 'tree' : 'flat'))}
              />
            </Tooltip>
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

        {/* Content: graph or editor */}
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
              llmFeatures={llmFeatures}
              suggestedTags={suggestedTags}
              suggestedCategory={suggestedCategory ?? undefined}
              suggestedSummary={suggestedSummary ?? undefined}
              suggestedTagsLoading={suggestedTagsLoading}
              onAcceptTag={(tag) => setAcceptedTags((prev) => new Set(prev).add(tag))}
              onRejectTag={(tag) => setSuggestedTags((prev) => prev.filter((t) => t !== tag))}
              acceptedTags={acceptedTags}
              onRegenerateTags={() => {
                if (!selectedNote) return;
                setSuggestedTagsLoading(true);
                const allCategories = [
                  ...new Set(notes.map((n) => n.categoryPath).filter(Boolean) as string[]),
                ];
                noteTagger
                  .analyze({ title: selectedNote.title, content: selectedNote.content }, allCategories)
                  .then((result) => {
                    setSuggestedTags(result.tags);
                    setSuggestedCategory(result.categoryPath);
                    setSuggestedSummary(result.summary);
                  })
                  .finally(() => setSuggestedTagsLoading(false));
              }}
              isContentStale={currentNoteStaleness}
              categoryPath={selectedNote?.categoryPath ?? undefined}
              onCategoryChange={(path: string) => {
                if (selectedNote) {
                  handleSave({ ...selectedNote, categoryPath: path || undefined, updated: Date.now() });
                }
              }}
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
        <BacklinksPanel backlinks={selectedBacklinks} onNavigateNote={handleNavigateNote} />
      </div>
    </div>
  );
}
