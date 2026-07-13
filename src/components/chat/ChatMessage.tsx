import React from 'react';
import { Bubble } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';

export interface ChatMessageProps {
  /** Message content as markdown */
  content: string;
  /** Message sender role */
  role: 'user' | 'assistant';
  /** Whether the message is still being streamed */
  streaming: boolean;
}

/**
 * Renders a chat message bubble with markdown content.
 *
 * - User messages: right-aligned (placement='end')
 * - Assistant messages: left-aligned with XMarkdown streaming renderer
 * - Streaming messages get the animation treatment via hasNextChunk
 */
export function ChatMessage({ content, role, streaming }: ChatMessageProps) {
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
    />
  );
}
