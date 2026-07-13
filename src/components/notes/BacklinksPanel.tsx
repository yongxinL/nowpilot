import React from 'react';
import { Card, List, Typography, Empty } from 'antd';
import type { BacklinkEntry } from '../../core/notes/LinkParser';

const { Text } = Typography;

export interface BacklinksPanelProps {
  backlinks: BacklinkEntry[];
  onNavigateNote: (id: string) => void;
}

export function BacklinksPanel({ backlinks, onNavigateNote }: BacklinksPanelProps) {
  if (backlinks.length === 0) {
    return (
      <div style={{ padding: '16px 8px' }}>
        <Text type="secondary" strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>
          Backlinks
        </Text>
        <Empty
          description="No notes link here"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ margin: 0 }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '8px' }}>
      <Text type="secondary" strong style={{ fontSize: 12, display: 'block', marginBottom: 8, paddingLeft: 4 }}>
        Backlinks ({backlinks.length})
      </Text>
      <List
        dataSource={backlinks}
        size="small"
        renderItem={(entry) => (
          <List.Item
            key={entry.noteId}
            onClick={() => onNavigateNote(entry.noteId)}
            style={{
              cursor: 'pointer',
              padding: '6px 8px',
              borderRadius: 4,
            }}
          >
            <div>
              <Text strong style={{ fontSize: 13 }}>
                {entry.title}
              </Text>
              <div>
                <Text type="secondary" style={{ fontSize: 11, lineHeight: 1.4 }} ellipsis={{ tooltip: entry.snippet }}>
                  {entry.snippet}
                </Text>
              </div>
            </div>
          </List.Item>
        )}
      />
    </div>
  );
}
