import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Input, Button, Space, Typography, Alert } from 'antd';
import { SaveOutlined, UndoOutlined } from '@ant-design/icons';
import type { Note } from '../../core/notes/LinkParser';
import { normalizeCategoryPath } from '../../core/notes/LinkParser';
import type { LinkParser } from '../../core/notes/LinkParser';
import type { LlmFeatureToggles } from '../../core/notes/noteTypes';
import { NotePreview } from './NotePreview';
import { TagSuggestions } from './TagSuggestions';

const { Text } = Typography;

const VERSIONS_KEY = 'np_note_versions';
const MAX_VERSIONS = 10;

interface VersionEntry {
  content: string;
  timestamp: number;
}

// ── NoteVersioner helper ──

class NoteVersioner {
  async saveVersion(noteId: string, content: string): Promise<void> {
    try {
      const data = await chrome.storage.local.get(VERSIONS_KEY);
      const versions: Record<string, VersionEntry[]> = (data[VERSIONS_KEY] as Record<string, VersionEntry[]> | undefined) || {};
      if (!versions[noteId]) {
        versions[noteId] = [];
      }
      versions[noteId].push({ content, timestamp: Date.now() });
      if (versions[noteId].length > MAX_VERSIONS) {
        versions[noteId] = versions[noteId].slice(-MAX_VERSIONS);
      }
      await chrome.storage.local.set({ [VERSIONS_KEY]: versions });
    } catch {
      // chrome.storage may not be available in test environments
    }
  }

  async getLastVersion(noteId: string): Promise<VersionEntry | null> {
    try {
      const data = await chrome.storage.local.get(VERSIONS_KEY);
      const versions: Record<string, VersionEntry[]> = (data[VERSIONS_KEY] as Record<string, VersionEntry[]> | undefined) || {};
      const entries = versions[noteId];
      if (!entries || entries.length === 0) return null;
      return entries[entries.length - 1];
    } catch {
      return null;
    }
  }

  async undo(noteId: string, currentContent: string): Promise<string | null> {
    const last = await this.getLastVersion(noteId);
    if (!last) return null;
    // Save current as version before restoring old one
    await this.saveVersion(noteId, currentContent);
    return last.content;
  }
}

const noteVersioner = new NoteVersioner();

// ── NoteEditor Component ──

export interface NoteEditorProps {
  note: Note | null;
  onSave: (note: Note) => void;
  linkParser: LinkParser;
  allNotes: Note[];
  onRegenerateTags?: () => void;
  llmFeatures?: LlmFeatureToggles;
  suggestedTags?: string[];
  suggestedCategory?: string;
  suggestedSummary?: string;
  suggestedTagsLoading?: boolean;
  onAcceptTag?: (tag: string) => void;
  onRejectTag?: (tag: string) => void;
  acceptedTags?: Set<string>;
  categoryPath?: string;
  onCategoryChange?: (path: string) => void;
  categoryError?: string | null;
  isContentStale?: boolean;
}

export function NoteEditor({ note, onSave, linkParser, allNotes, onRegenerateTags, llmFeatures, suggestedTags, suggestedCategory, suggestedSummary, suggestedTagsLoading, onAcceptTag, onRejectTag, acceptedTags, categoryPath, onCategoryChange, categoryError, isContentStale }: NoteEditorProps) {
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [categoryInput, setCategoryInput] = useState('');
  const [categoryValidationError, setCategoryValidationError] = useState<string | null>(null);
  const titleRef = useRef(title);
  const contentRef = useRef(content);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local state when selected note changes
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      titleRef.current = note.title;
      contentRef.current = note.content;
      setCategoryInput(note.categoryPath || categoryPath || '');
    } else {
      setTitle('');
      setContent('');
      titleRef.current = '';
      contentRef.current = '';
      setCategoryInput('');
    }
  }, [note?.id]);

  const handleContentChange = useCallback(
    (value: string) => {
      setContent(value);
      contentRef.current = value;

      // Auto-save debounced (2s) with versioning
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (!note) return;
      autoSaveTimer.current = setTimeout(async () => {
        // Save version of previous content
        const prevContent = contentRef.current;
        if (prevContent !== value) {
          await noteVersioner.saveVersion(note.id, prevContent);
        }
        onSave({ ...note, content: value, title: titleRef.current, updated: Date.now() });
      }, 2000);
    },
    [note, onSave],
  );

  const handleTitleChange = useCallback((value: string) => {
    setTitle(value);
    titleRef.current = value;
  }, []);

  const handleSave = useCallback(() => {
    if (!note) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    onSave({ ...note, content, title, updated: Date.now() });
  }, [note, content, title, onSave]);

  const handleUndo = useCallback(async () => {
    if (!note) return;
    const restored = await noteVersioner.undo(note.id, content);
    if (restored !== null) {
      setContent(restored);
      contentRef.current = restored;
    }
  }, [note, content]);

  if (!note) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'var(--ant-color-text-tertiary)',
        }}
      >
        <Text type="secondary">Select a note to edit, or create a new one</Text>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: '1px solid var(--ant-color-border-secondary)',
        }}
      >
        <Input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          variant="borderless"
          placeholder="Note title..."
          style={{ fontSize: 16, fontWeight: 600, flex: 1 }}
        />
        <Space size="small">
          <Button
            size="small"
            icon={<UndoOutlined />}
            onClick={handleUndo}
            disabled={!note}
          >
            Undo
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<SaveOutlined />}
            onClick={handleSave}
          >
            Save
          </Button>
        </Space>
      </div>

      {/* Category input */}
      <div style={{ padding: '4px 12px', borderBottom: '1px solid var(--ant-color-border-secondary)' }}>
        <Text type="secondary" style={{ fontSize: 11 }}>Category:</Text>
        <Input
          value={categoryInput}
          onChange={(e) => { setCategoryInput(e.target.value); setCategoryValidationError(null); }}
          onBlur={() => {
            if (!categoryInput.trim()) {
              setCategoryValidationError(null);
              setCategoryInput('');
              onCategoryChange?.('');
              return;
            }
            const result = normalizeCategoryPath(categoryInput);
            if (typeof result === 'object' && 'error' in result) {
              setCategoryValidationError(result.error);
            } else {
              setCategoryValidationError(null);
              setCategoryInput(result);
              onCategoryChange?.(result);
            }
          }}
          variant="borderless"
          placeholder="Category path (e.g. InfoTech/Database/MySQL)"
          style={{
            fontSize: 13,
            border: categoryValidationError ? '1px solid var(--ant-color-error)' : undefined,
            borderRadius: 4,
          }}
        />
        {categoryValidationError && (
          <Text type="danger" style={{ fontSize: 11, display: 'block' }}>{categoryValidationError}</Text>
        )}
      </div>

      {/* Tag suggestions */}
      {suggestedTags && suggestedTags.length > 0 && (
        <div style={{ padding: '4px 12px', borderBottom: '1px solid var(--ant-color-border-secondary)' }}>
          <Text type="secondary" style={{ fontSize: 11 }}>Suggested tags:</Text>
          <TagSuggestions
            suggestedTags={suggestedTags}
            acceptedTags={acceptedTags || new Set()}
            onAccept={onAcceptTag!}
            onReject={onRejectTag!}
            loading={suggestedTagsLoading}
          />
        </div>
      )}

      {/* Summary display */}
      {note?.summary && (
        <div style={{ padding: '4px 12px', borderBottom: '1px solid var(--ant-color-border-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>{note.summary}</Text>
          <Button type="link" size="small" onClick={onRegenerateTags}>Regenerate</Button>
        </div>
      )}

      {/* Staleness alert */}
      {isContentStale && (
        <Alert
          type="warning"
          message="Content has changed"
          description={<Button type="link" size="small" onClick={onRegenerateTags}>Regenerate tags/summary</Button>}
          style={{ margin: 8 }}
          banner
          closable
        />
      )}

      {/* Split pane: editor left, preview right */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Text editor */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid var(--ant-color-border-secondary)' }}>
          <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--ant-color-border-secondary)' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Markdown</Text>
          </div>
          <Input.TextArea
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              borderRadius: 0,
              resize: 'none',
              fontFamily: 'monospace',
              fontSize: 13,
              lineHeight: 1.6,
            }}
            placeholder="Write your note in markdown... Use [[wikilinks]] to link to other notes."
          />
        </div>

        {/* Right: Preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--ant-color-border-secondary)' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>Preview</Text>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>
            <NotePreview content={content} notes={allNotes} linkParser={linkParser} />
          </div>
        </div>
      </div>
    </div>
  );
}
