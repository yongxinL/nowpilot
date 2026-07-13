import React, { useState, useRef, useCallback, useEffect } from 'react';
import { List, Typography } from 'antd';
import { PlusOutlined, FileTextOutlined } from '@ant-design/icons';
import type { LinkParser, SearchResult } from '../../core/notes/LinkParser';

const { Text } = Typography;

export interface WikilinkAutocompleteProps {
  /** Current textarea content */
  content: string;
  /** Cursor position in textarea */
  cursorPosition: number;
  /** LinkParser singleton for search */
  linkParser: LinkParser;
  /** Called when user selects a completion or create option */
  onSelect: (wikilinkText: string) => void;
  /** Called to close the popup */
  onClose: () => void;
}

/**
 * Wikilink autocomplete dropdown that appears when [[ is typed.
 * Shows MiniSearch-ranked note suggestions and a "Create note" option.
 * Controlled component — parent manages visibility based on [[ trigger.
 */
export function WikilinkAutocomplete({
  content,
  cursorPosition,
  linkParser,
  onSelect,
  onClose,
}: WikilinkAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Extract the wikilink query from content at cursor position
  useEffect(() => {
    const beforeCursor = content.slice(0, cursorPosition);
    // Find the last [[ before cursor
    const lastOpen = beforeCursor.lastIndexOf('[[');
    if (lastOpen === -1) {
      setQuery('');
      setResults([]);
      return;
    }
    const afterOpen = beforeCursor.slice(lastOpen + 2);
    // Check if there's a closing ]] already
    if (afterOpen.includes(']]')) {
      setQuery('');
      setResults([]);
      return;
    }
    const typed = afterOpen;
    setQuery(typed);

    if (typed) {
      const searchResults = linkParser.search(typed);
      setResults(searchResults);
      setSelectedIndex(0);
    } else {
      // Empty query — show recent notes (search with empty string)
      setResults([]);
      setSelectedIndex(0);
    }
  }, [content, cursorPosition, linkParser]);

  const handleSelect = useCallback(
    (title: string) => {
      // Replace the partial wikilink with complete [[title]]
      const beforeCursor = content.slice(0, cursorPosition);
      const afterCursor = content.slice(cursorPosition);
      const lastOpen = beforeCursor.lastIndexOf('[[');
      const beforeWikilink = beforeCursor.slice(0, lastOpen);
      const newContent = beforeWikilink + `[[${title}]]` + afterCursor;
      onSelect(newContent);
    },
    [content, cursorPosition, onSelect],
  );

  const handleCreateNote = useCallback(() => {
    // Create a new note with this title
    onSelect(query); // Will be handled as "create note" by parent
  }, [query, onSelect]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, results.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (selectedIndex < results.length) {
          handleSelect(results[selectedIndex].title);
        } else {
          handleCreateNote();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [selectedIndex, results, handleSelect, handleCreateNote, onClose],
  );

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  if (!query && results.length === 0) {
    return null;
  }

  const items = [
    ...results.slice(0, 10).map((r) => ({
      key: r.id,
      type: 'note' as const,
      title: r.title,
    })),
    {
      key: 'create',
      type: 'create' as const,
      title: query || 'New note',
    },
  ];

  return (
    <div
      ref={containerRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        width: 280,
        maxHeight: 300,
        overflowY: 'auto',
        background: 'var(--ant-color-bg-elevated, #fff)',
        border: '1px solid var(--ant-color-border, #d9d9d9)',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        zIndex: 1050,
      }}
    >
      {results.length > 0 && (
        <>
          <div style={{ padding: '4px 8px' }}>
            <Text type="secondary" style={{ fontSize: 11 }}>
              Notes
            </Text>
          </div>
          <List
            dataSource={results.slice(0, 10)}
            size="small"
            renderItem={(item, index) => (
              <List.Item
                key={item.id}
                onClick={() => handleSelect(item.title)}
                style={{
                  cursor: 'pointer',
                  padding: '4px 8px',
                  background: index === selectedIndex ? 'var(--ant-color-primary-1, #e6f4ff)' : undefined,
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <FileTextOutlined style={{ marginRight: 6, fontSize: 12 }} />
                <Text style={{ fontSize: 13 }}>{item.title}</Text>
              </List.Item>
            )}
          />
        </>
      )}
      <div
        onClick={handleCreateNote}
        style={{
          cursor: 'pointer',
          padding: '6px 8px',
          borderTop: results.length > 0 ? '1px solid var(--ant-color-border, #d9d9d9)' : undefined,
          background: selectedIndex >= results.length ? 'var(--ant-color-primary-1, #e6f4ff)' : undefined,
        }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <PlusOutlined style={{ marginRight: 6, fontSize: 12 }} />
        <Text style={{ fontSize: 13 }}>
          Create note{query ? ` "${query}"` : ''}
        </Text>
      </div>
    </div>
  );
}
