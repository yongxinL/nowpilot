import { Flex, Button, Dropdown, Typography, theme, App } from 'antd';
import { LikeOutlined, DislikeOutlined, BookmarkOutlined, DownloadOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { SaveToNoteFromChat } from './SaveToNoteFromChat';

const { Text } = Typography;

export interface ConversationClosureProps {
  onFeedback: (helpful: boolean) => void;
  conversationId?: string;
  exchangeCount?: number;
  conversationTitle?: string;
  messages?: Array<{ role: string; content: string }>;
  onSave?: () => void;
}

export function ConversationClosure({
  onFeedback,
  conversationId,
  exchangeCount = 0,
  conversationTitle,
  messages,
  onSave,
}: ConversationClosureProps) {
  const { token } = theme.useToken();
  const { message: appMessage } = App.useApp();

  const handleFeedback = async (helpful: boolean) => {
    try {
      const { memoryDB } = await import('../../core/storage/stores/MemoryDB');
      await memoryDB.put('conversation_feedback', {
        id: crypto.randomUUID(),
        conversationId: conversationId ?? '',
        helpful,
        timestamp: Date.now(),
      });
    } catch {
      // Silently handle feedback persistence errors
    }
    onFeedback(helpful);
  };

  const handleExport = async (format: 'md' | 'json') => {
    if (!messages || messages.length === 0) {
      appMessage.warning('No messages to export');
      return;
    }

    let content: string;
    let mimeType: string;
    let extension: string;

    if (format === 'md') {
      content = messages.map((m) => `## ${m.role}\n\n${m.content}`).join('\n\n---\n\n');
      mimeType = 'text/markdown';
      extension = 'md';
    } else {
      content = JSON.stringify(messages, null, 2);
      mimeType = 'application/json';
      extension = 'json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-${Date.now()}.${extension}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportItems: MenuProps['items'] = [
    { key: 'md', label: 'Markdown (.md)', onClick: () => handleExport('md') },
    { key: 'json', label: 'JSON (.json)', onClick: () => handleExport('json') },
  ];

  return (
    <Flex
      align="center"
      gap={token.marginXS}
      style={{
        padding: `${token.paddingXS}px ${token.paddingSM}px`,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      <Text style={{ fontSize: 13, color: token.colorTextSecondary }}>
        Did this help?
      </Text>
      <Button
        type="text"
        size="small"
        icon={<LikeOutlined />}
        aria-label="This was helpful"
        onClick={() => handleFeedback(true)}
      />
      <Button
        type="text"
        size="small"
        icon={<DislikeOutlined />}
        aria-label="This was not helpful"
        onClick={() => handleFeedback(false)}
      />

      {exchangeCount >= 3 && conversationId && (
        <>
          <SaveToNoteFromChat
            conversationId={conversationId}
            conversationTitle={conversationTitle}
            messages={messages}
          />
          <Dropdown menu={{ items: exportItems }} trigger={['click']}>
            <Button type="default" size="small" icon={<DownloadOutlined />}>
              Export
            </Button>
          </Dropdown>
        </>
      )}
    </Flex>
  );
}
