import React, { useState, useEffect } from 'react';
import { Modal, Input, Select, Button, Typography, App } from 'antd';
import { notesDB } from '../../core/storage/stores/NotesDB';
import type { Note } from '../../core/notes/LinkParser';
import { linkParser } from '../../core/notes/LinkParser';

const { Text, Title } = Typography;

export interface SaveToNoteDialogProps {
  /** Content to save (pre-filled) */
  content: string;
  /** Called after save with optional noteId */
  onSave: (noteId?: string) => void;
  /** Called to close dialog without saving */
  onClose: () => void;
}

/**
 * "Save to Note" dialog for saving chat assistant content to notes.
 * Opens from assistant message context menu.
 * Supports: create new note (title input, content pre-filled) or append to existing note.
 */
export function SaveToNoteDialog({ content, onSave, onClose }: SaveToNoteDialogProps) {
  const [mode, setMode] = useState<'create' | 'append'>('create');
  const [title, setTitle] = useState('');
  const [existingNoteId, setExistingNoteId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [saving, setSaving] = useState(false);
  const { message } = App.useApp();

  // Load existing notes for append mode
  useEffect(() => {
    notesDB.getAllNotes().then((all) => setNotes(all)).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === 'create') {
        const newNote: Note = {
          id: crypto.randomUUID(),
          title: title || 'Untitled',
          content,
          created: Date.now(),
          updated: Date.now(),
          tags: [],
        };
        await notesDB.createNote(newNote);
        linkParser.addToIndex(newNote);
        message.success('Note created');
        onSave(newNote.id);
      } else if (existingNoteId) {
        const existing = await notesDB.getNote(existingNoteId);
        if (existing) {
          const updated = {
            ...existing,
            content: existing.content + '\n\n---\n' + content,
            updated: Date.now(),
          };
          await notesDB.updateNote(updated);
          linkParser.addToIndex(updated);
          message.success('Content appended');
          onSave(existingNoteId);
        }
      }
    } catch {
      message.error('Failed to save note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Save to Note"
      onCancel={onClose}
      footer={null}
      width={480}
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
        {/* Mode toggle */}
        <div>
          <Text strong>Mode: </Text>
          <Button
            type={mode === 'create' ? 'primary' : 'default'}
            size="small"
            onClick={() => setMode('create')}
            style={{ marginRight: 8 }}
          >
            Create New
          </Button>
          <Button
            type={mode === 'append' ? 'primary' : 'default'}
            size="small"
            onClick={() => setMode('append')}
          >
            Append to Existing
          </Button>
        </div>

        {/* Create mode */}
        {mode === 'create' && (
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              Title
            </Text>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title"
            />
          </div>
        )}

        {/* Append mode */}
        {mode === 'append' && (
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              Select note to append to
            </Text>
            <Select
              style={{ width: '100%' }}
              placeholder="Select a note..."
              value={existingNoteId}
              onChange={setExistingNoteId}
              options={notes.map((n) => ({
                value: n.id,
                label: n.title,
              }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>
        )}

        {/* Preview */}
        <div>
          <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
            Content to save
          </Text>
          <div
            style={{
              maxHeight: 150,
              overflowY: 'auto',
              padding: 8,
              background: 'var(--ant-color-bg-layout)',
              borderRadius: 4,
              fontSize: 13,
              whiteSpace: 'pre-wrap',
              lineHeight: 1.5,
            }}
          >
            {content}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            onClick={handleSave}
            loading={saving}
            disabled={
              mode === 'create' ? false : mode === 'append' && !existingNoteId
            }
          >
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
