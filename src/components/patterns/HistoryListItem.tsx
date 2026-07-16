import React from 'react';
import { Typography, Popconfirm, Button } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import type { ConversationMeta } from '../../hooks/useChat';

const { Text } = Typography;

export interface HistoryListItemProps {
  /** Conversation metadata to display */
  conversation: ConversationMeta;
  /** Whether this conversation is currently active */
  isActive: boolean;
  /** Called when this conversation is selected */
  onSelect: (id: string) => void;
  /** Called when this conversation should be deleted */
  onDelete: (id: string) => void;
}

/**
 * Formats a timestamp as a relative time string.
 */
function relativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Renders a conversation history list item with:
 * - Title (or "New Conversation" if untitled)
 * - Preview snippet (truncated to 80 chars)
 * - Relative timestamp
 * - Active state highlight via AntD theme token
 * - Delete action via Popconfirm
 */
export function HistoryListItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: HistoryListItemProps) {
  return (
    <div
      style={{
        cursor: 'pointer',
        padding: '8px 12px',
        borderRadius: 6,
        background: isActive ? 'var(--ant-color-primary-bg)' : undefined,
        transition: 'background 0.2s',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
      onClick={() => onSelect(conversation.id)}
    >
      <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
        <div>
          <Text
            strong
            style={{ fontSize: 13 }}
            ellipsis
          >
            {conversation.title || 'New Conversation'}
          </Text>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Text
            type="secondary"
            style={{ fontSize: 11 }}
            ellipsis
          >
            {conversation.preview?.slice(0, 80) || ''}
          </Text>
          <Text type="secondary" style={{ fontSize: 10 }}>
            {relativeTime(conversation.updated)}
          </Text>
        </div>
      </div>
      <div onClick={(e) => e.stopPropagation()}>
        <Popconfirm
          title="Delete conversation?"
          description="This action cannot be undone."
          onConfirm={(e) => {
            e?.stopPropagation();
            onDelete(conversation.id);
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
  );
}
