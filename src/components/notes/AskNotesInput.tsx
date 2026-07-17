import React, { useState, useCallback } from 'react';
import { Input, Tag, Spin, Typography } from 'antd';
import { Bubble } from '@ant-design/x';
import { noteQA } from '../../core/notes/NoteQA';
import { debugLog } from '../../core/utils/debugLog';
import type { LinkParser, Note } from '../../core/notes/LinkParser';
import type { QAResult } from '../../core/notes/noteTypes';

const { Text } = Typography;

export interface AskNotesInputProps {
  linkParser: LinkParser;
  allNotes: Note[];
  onSelectNote?: (noteId: string) => void;
}

/**
 * Renders an Input.Search for asking questions about notes,
 * with inline Bubble display for the RAG Q&A result.
 *
 * State is ephemeral (React state only) per D-15.
 */
export function AskNotesInput({ linkParser, allNotes, onSelectNote }: AskNotesInputProps) {
  const [query, setQuery] = useState('');
  const [qaResult, setQaResult] = useState<QAResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(
    async (value: string) => {
      if (!value.trim()) return;

      setQuery(value);
      setLoading(true);
      setError(null);
      setQaResult(null);

      try {
        const result: QAResult = await noteQA.ask(value, allNotes, linkParser);
        setQaResult(result);
      } catch (err) {
        debugLog('error', '[AskNotesInput] QA failed', { error: err });
        setError('Failed to get answer. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [allNotes, linkParser],
  );

  const handleClear = useCallback(() => {
    setQuery('');
    setQaResult(null);
    setError(null);
  }, []);

  return (
    <div style={{ padding: '8px' }}>
      <Input.Search
        placeholder="Ask your notes..."
        allowClear
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onSearch={handleSearch}
        loading={loading}
        onClear={handleClear}
        enterButton
      />

      {loading && (
        <div style={{ padding: '16px 0', textAlign: 'center' }}>
          <Spin />
          <Text type="secondary" style={{ marginLeft: 8 }}>
            Searching notes...
          </Text>
        </div>
      )}

      {error && (
        <div style={{ padding: '12px 0' }}>
          <Text type="danger">{error}</Text>
        </div>
      )}

      {qaResult && !loading && (
        <div style={{ paddingTop: 12 }}>
          <Bubble
            placement="start"
            content={qaResult.answer}
          />
          {qaResult.citations.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                Sources
              </Text>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {qaResult.citations.map((citation) => (
                  <Tag
                    key={citation.noteId}
                    color="blue"
                    style={{ cursor: onSelectNote ? 'pointer' : undefined }}
                    onClick={() => {
                      if (onSelectNote) {
                        onSelectNote(citation.noteId);
                      }
                    }}
                  >
                    {citation.title}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
