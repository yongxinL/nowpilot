import { useState, type CSSProperties } from 'react';
import { Input, Typography, theme } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useRightPaneStore } from '../../../core/stores/RightPaneStore';

const { Text } = Typography;

/**
 * NotesTab — MiniSearch input + inline note preview (D-05, D-06)
 *
 * Provides search over notes via Input.Search, with inline preview on click.
 * No full editor per D-05 — only title + summary excerpt shown.
 * Empty state shown when no notes exist.
 * Uses antd theme.useToken() for consistent typography/spacing.
 */
export function NotesTab() {
  const { token } = theme.useToken();

  const searchQuery = useRightPaneStore((s) => s.searchQuery);
  const setSearchQuery = useRightPaneStore((s) => s.setSearchQuery);
  const selectedNoteId = useRightPaneStore((s) => s.selectedNoteId);
  const setSelectedNoteId = useRightPaneStore((s) => s.setSelectedNoteId);

  const [previewNote, setPreviewNote] = useState<{ title: string; summary: string } | null>(null);

  const containerStyle: CSSProperties = {
    padding: `${token.paddingSM}px`,
    display: 'flex',
    flexDirection: 'column',
    gap: token.marginSM,
  };

  const emptyStateStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: token.marginXS,
    padding: `${token.padding}px 0`,
  };

  // Mock empty state for now — real MiniSearch integration happens in integration
  const hasNotes = false;

  if (!hasNotes && !searchQuery) {
    return (
      <div style={containerStyle}>
        <Input.Search
          placeholder="Search notes..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
        />
        <div style={emptyStateStyle}>
          <Text style={{ fontSize: 16, fontWeight: 600, color: token.colorText }}>
            No notes yet
          </Text>
          <Text style={{ color: token.colorTextSecondary }}>
            Create a note from any chat message using &apos;Save to note&apos;
          </Text>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <Input.Search
        placeholder="Search notes..."
        prefix={<SearchOutlined />}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        allowClear
      />
      {/* Results area — populated by MiniSearch integration */}
      {searchQuery && !previewNote && (
        <Text style={{ color: token.colorTextSecondary }}>Searching notes...</Text>
      )}
      {/* Inline preview */}
      {previewNote && (
        <div
          style={{
            padding: token.paddingSM,
            background: token.colorFillTertiary,
            borderRadius: token.borderRadius,
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: 600, color: token.colorText }}>
            {previewNote.title}
          </Text>
          <Text style={{ color: token.colorTextSecondary, display: 'block', marginTop: 4 }}>
            {previewNote.summary}
          </Text>
        </div>
      )}
    </div>
  );
}
