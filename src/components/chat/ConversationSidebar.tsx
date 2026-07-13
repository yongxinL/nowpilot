import React from 'react';
import { Conversations } from '@ant-design/x';
import { App, Popconfirm } from 'antd';
import type { ConversationMeta } from '../../hooks/useChat';

export interface ConversationSidebarProps {
  /** List of conversations to display */
  conversations: ConversationMeta[];
  /** Currently active conversation ID */
  activeKey: string | null;
  /** Called when a conversation is selected */
  onSelect: (id: string) => void;
  /** Called when a conversation should be deleted */
  onDelete: (id: string) => void;
  /** Called to create a new conversation */
  onNew: () => void;
}

/**
 * Wraps @ant-design/x Conversations component with delete confirmation.
 *
 * Maps ConversationMeta[] to Conversations `items` format with:
 * - Groupable support
 * - Context menu with Popconfirm delete
 * - New Chat creation button
 */
export function ConversationSidebar({
  conversations,
  activeKey,
  onSelect,
  onDelete,
  onNew,
}: ConversationSidebarProps) {
  const { modal } = App.useApp();

  const items = conversations.map((conv) => ({
    key: conv.id,
    label: conv.title || 'New Conversation',
    description: conv.preview?.slice(0, 80) || '',
  }));

  return (
    <Conversations
      style={{ width: 260, height: '100%' }}
      items={items}
      activeKey={activeKey ?? undefined}
      onActiveChange={(key) => onSelect(key as string)}
      groupable={false}
      creation={{
        label: 'New Chat',
        onClick: onNew,
      }}
      menu={(conv) => ({
        items: [
          {
            key: 'delete',
            label: 'Delete',
            danger: true,
            onClick: () => {
              modal.confirm({
                title: 'Delete conversation?',
                content: 'This action cannot be undone.',
                okText: 'Delete',
                okButtonProps: { danger: true },
                onOk: () => onDelete(conv.key as string),
              });
            },
          },
        ],
      })}
    />
  );
}
