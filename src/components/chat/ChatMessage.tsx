import React from 'react';
import { Button } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { Bubble } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';

export interface ChatMessageProps {
  /** Message content as markdown */
  content: string;
  /** Message sender role */
  role: 'user' | 'assistant';
  /** Whether the message is still being streamed */
  streaming: boolean;
  /** Callback to save this message as a note */
  onSaveToNote?: () => void;
}

/**
 * Renders a chat message bubble with markdown content.
 *
 * - User messages: right-aligned (placement='end')
 * - Assistant messages: left-aligned with XMarkdown streaming renderer
 * - Streaming messages get the animation treatment via hasNextChunk
 * - Assistant messages show "Save to note" button when not streaming
 */
export function ChatMessage({ content, role, streaming, onSaveToNote }: ChatMessageProps) {
  return (
    <Bubble
      placement={role === 'user' ? 'end' : 'start'}
      content={
        role === 'assistant' ? (
          <XMarkdown
            content={content}
            streaming={{ hasNextChunk: streaming, enableAnimation: true }}
            openLinksInNewTab={true}
          />
        ) : (
          content
        )
      }
      footer={
        role === 'assistant' && !streaming && onSaveToNote ? (
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <Button type="text" size="small" icon={<SaveOutlined />} onClick={onSaveToNote}>
              Save to note
            </Button>
          </div>
        ) : undefined
      }
    />
  );
}
