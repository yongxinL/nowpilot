import React, { useState, useEffect } from 'react';
import { Modal, Input, Select, Button, Typography, Spin, Tag, App } from 'antd';
import { notesDB } from '../../core/storage/stores/NotesDB';
import type { Note } from '../../core/notes/LinkParser';
import { linkParser } from '../../core/notes/LinkParser';
import { noteChatConverter } from '../../core/notes/NoteChatConverter';
import type { MemoryAssembleResult } from '../../core/memory/memoryTypes';
import { NotePreview } from './NotePreview';

const { Text } = Typography;

export interface SaveToNoteDialogProps {
  content: string;
  onSave: (noteId?: string) => void;
  onClose: () => void;
  conversationMessages?: Array<{ role: string; content: string }>;
  memoryContext?: MemoryAssembleResult;
  existingNoteTitles?: string[];
}

export function SaveToNoteDialog({
  content,
  onSave,
  onClose,
  conversationMessages,
  memoryContext,
  existingNoteTitles,
}: SaveToNoteDialogProps) {
  const [mode, setMode] = useState<'create' | 'append'>('create');
  const [title, setTitle] = useState('');
  const [existingNoteId, setExistingNoteId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [saving, setSaving] = useState(false);
  const [llmDrafting, setLlmDrafting] = useState(false);
  const [suggestedTagsFromLLM, setSuggestedTagsFromLLM] = useState<string[]>([]);
  const { message } = App.useApp();

  useEffect(() => {
    notesDB.getAllNotes().then((all) => setNotes(all)).catch(() => {});
  }, []);

  useEffect(() => {
    if (conversationMessages && conversationMessages.length > 0) {
      setLlmDrafting(true);
      noteChatConverter
        .convert(conversationMessages, memoryContext, existingNoteTitles)
        .then((draft) => {
          if (mode === 'create') {
            setTitle(draft.title || '');
          }
          setSuggestedTagsFromLLM(draft.tags || []);
        })
        .catch(() => {})
        .finally(() => setLlmDrafting(false));
    }
  }, [conversationMessages]);

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
      width={580}
      destroyOnClose
    >
      <Spin spinning={llmDrafting} tip="Drafting from conversation...">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
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

          {suggestedTagsFromLLM.length > 0 && (
            <div>
              <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
                Suggested tags
              </Text>
              <div>
                {suggestedTagsFromLLM.map((tag) => (
                  <Tag key={tag} style={{ marginBottom: 4 }}>
                    {tag}
                  </Tag>
                ))}
              </div>
            </div>
          )}

          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              Content to save
            </Text>
            <div
              style={{
                maxHeight: 200,
                overflowY: 'auto',
                padding: 8,
                background: 'var(--ant-color-bg-layout)',
                borderRadius: 4,
              }}
            >
              <NotePreview content={content} notes={[]} linkParser={linkParser} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              onClick={handleSave}
              loading={saving}
              disabled={mode === 'create' ? false : mode === 'append' && !existingNoteId}
            >
              Save
            </Button>
          </div>
        </div>
      </Spin>
    </Modal>
  );
}
