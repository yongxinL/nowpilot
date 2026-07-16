import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Input, Button, Select, Popconfirm, Typography, Empty } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import type { LinkParser, Note } from '../../core/notes/LinkParser';

const { Text } = Typography;

export interface NoteListProps {
  notes: Note[];
  selectedNoteId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  linkParser: LinkParser;
}

export function NoteList({ notes, selectedNoteId, onSelect, onNew, onDelete, linkParser }: NoteListProps) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<'updated' | 'created' | 'title'>('updated');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchResults, setSearchResults] = useState<Array<{ id: string; title: string; score?: number }> | null>(null);

  // MiniSearch debounced search
  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim()) {
        setSearchResults(null);
        return;
      }
      debounceRef.current = setTimeout(() => {
        const results = linkParser.search(value);
        setSearchResults(results);
      }, 150);
    },
    [linkParser],
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Filter/sort notes
  const displayNotes = useMemo(() => {
    let filtered = notes;
    if (searchResults) {
      const resultIds = new Set(searchResults.map((r) => r.id));
      filtered = notes.filter((n) => resultIds.has(n.id));
    }
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'created') return b.created - a.created;
      return b.updated - a.updated;
    });
    return sorted;
  }, [notes, searchResults, sortBy]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px', width: '100%' }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          block
          onClick={onNew}
        >
          New Note
        </Button>
        <Input.Search
          placeholder="Search notes..."
          allowClear
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onSearch={handleSearch}
        />
        <Select
          value={sortBy}
          onChange={setSortBy}
          style={{ width: '100%' }}
          size="small"
          options={[
            { value: 'updated', label: 'Updated' },
            { value: 'created', label: 'Created' },
            { value: 'title', label: 'Title' },
          ]}
        />
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {displayNotes.length === 0 ? (
          <Empty
            description={query ? 'No matching notes' : 'No notes yet'}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: 24 }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {displayNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => onSelect(note.id)}
                style={{
                  cursor: 'pointer',
                  padding: '8px 12px',
                  background: selectedNoteId === note.id ? 'var(--ant-color-primary-1, #e6f4ff)' : undefined,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderBottom: '1px solid #f0f0f0',
                }}
              >
                <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                    <Text strong style={{ fontSize: 13 }}>
                      {note.title}
                    </Text>
                  </div>
                  <div style={{ marginTop: 2 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {new Date(note.updated).toLocaleDateString()}
                    </Text>
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <Popconfirm
                    title="Delete this note?"
                    description="This action cannot be undone."
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      onDelete(note.id);
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                    okText="Delete"
                    cancelText="Cancel"
                    okButtonProps={{ danger: true, style: { background: '#EF4444', borderColor: '#EF4444' } }}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
