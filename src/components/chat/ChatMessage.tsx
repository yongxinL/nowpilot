import React from 'react';
import { Button } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { Bubble } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import { BunnyAvatar } from '../common/BunnyAvatar';
import { StructuredOutputActions } from './StructuredOutputActions';

export interface ChatMessageProps {
  /** Message content as markdown */
  content: string;
  /** Message sender role */
  role: 'user' | 'assistant';
  /** Whether the message is still being streamed */
  streaming: boolean;
  /** Callback to save this message as a note */
  onSaveToNote?: () => void;
  /** D-28: First-message branding — show BunnyAvatar + branded header on first assistant message only */
  isFirstMessage?: boolean;
  /** RICH-H-06: Controls Save-to-note button visibility promotion (unused currently, available for future use) */
  showSaveToNote?: boolean;
}

/**
 * Renders a chat message bubble with markdown content.
 *
 * - User messages: right-aligned (placement='end')
 * - Assistant messages: left-aligned with XMarkdown streaming renderer
 * - First assistant message (D-28): shows BunnyAvatar + "NowPilot" branded header
 * - Streaming messages get the animation treatment via hasNextChunk
 * - Save-to-note button always visible in Bubble footer (RICH-H-06)
 * - StructuredOutputActions integrated in footer when content has tables
 */
export function ChatMessage({
  content, role, streaming, onSaveToNote, isFirstMessage, showSaveToNote,
}: ChatMessageProps) {
  const showBranding = isFirstMessage && role === 'assistant';

  return (
    <Bubble
      placement={role === 'user' ? 'end' : 'start'}
      // D-28: First-message avatar for branding
      avatar={showBranding ? (
        <div style={{ border: '2px solid var(--ant-color-primary)', borderRadius: '50%', width: 32, height: 32 }}>
          <BunnyAvatar />
        </div>
      ) : undefined}
      // D-28: First-message branded header
      header={showBranding ? (
        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ant-color-primary)' }}>NowPilot</div>
      ) : undefined}
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
      // RICH-H-06: Footer always renders for assistant messages when not streaming
      footer={
        role === 'assistant' && !streaming ? (
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {/* Save-to-note always visible when applicable (RICH-H-06) */}
            {onSaveToNote && (
              <Button type="text" size="small" icon={<SaveOutlined />} onClick={onSaveToNote}>
                Save to note
              </Button>
            )}
            {/* Structured output actions when content has tables */}
            <StructuredOutputActions
              content={content}
              hasTable={content.includes('| ---') || content.includes('|---')}
            />
          </div>
        ) : undefined
      }
    />
  );
}
