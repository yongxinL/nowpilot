import React from 'react';
import { PaperClipOutlined, CloseOutlined } from '@ant-design/icons';
import { Bubble } from '@ant-design/x';
import { NowPilotAvatar } from '../common/NowPilotAvatar';
import { UserAvatar } from '../common/UserAvatar';
import { ThoughtProcessBlock } from './ThoughtProcessBlock';
import { ActionPanel } from '../common/ActionPanel';
import { FollowupSuggestions } from './FollowupSuggestions';
import { PortableMarkdown } from '../../core/components/PortableMarkdown';
import { Message } from '../../types';

interface ChatMessageItemProps {
  msg: Message;
  isLatestAI: boolean;
  fontSizeClass: string;
  isExporting: boolean;
  isExportSelected: boolean;
  onToggleExportSelect: (msgId: string, selected: boolean) => void;
  // User edit state
  isEditingThis: boolean;
  editingText: string;
  onStartEdit: (msgId: string, content: string) => void;
  onCancelEdit: () => void;
  onChangeEditText: (text: string) => void;
  onSubmitEdit: (text: string) => void;
  // Actions
  onQuoteText: (text: string) => void;
  onRegenerate: (msgId: string) => void;
  onSwitchVersion: (msgId: string, delta: number) => void;
  onSaveToNote?: (text: string) => void;
  onShare: (text: string) => void;
  onSendFollowup: (prompt: string) => void;
}

export const ChatMessageItem: React.FC<ChatMessageItemProps> = ({
  msg,
  isLatestAI,
  fontSizeClass,
  isExporting,
  isExportSelected,
  onToggleExportSelect,
  isEditingThis,
  editingText,
  onStartEdit,
  onCancelEdit,
  onChangeEditText,
  onSubmitEdit,
  onQuoteText,
  onRegenerate,
  onSwitchVersion,
  onSaveToNote,
  onShare,
  onSendFollowup,
}) => {
  if (msg.role === 'user') {
    const quoteAttachments = msg.attachments?.filter((a) => a.type === 'quote') || [];
    const imageAttachments = msg.attachments?.filter((a) => a.type === 'image' || a.type === 'screen_cut') || [];
    const otherAttachments = msg.attachments?.filter((a) => a.type !== 'quote' && a.type !== 'image' && a.type !== 'screen_cut') || [];

    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          marginTop: 12,
          marginBottom: 12,
          width: '100%',
        }}
      >
        {isExporting && (
          <div
            style={{
              paddingTop: 8,
              flexShrink: 0,
            }}
          >
            <input
              type="checkbox"
              checked={isExportSelected}
              onChange={(e) => onToggleExportSelect(msg.id, e.target.checked)}
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                border: '1px solid var(--border)',
                color: '#7c3aed',
                cursor: 'pointer',
              }}
            />
          </div>
        )}

        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
          }}
        >
          <div
            style={
              isEditingThis
                ? { width: '100%' }
                : {
                    maxWidth: '90%',
                    width: 'fit-content',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                  }
            }
          >
            {/* Quoted Text Capsule above input / bubble (Screenshots 3 & 4) */}
            {quoteAttachments.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 6,
                  marginBottom: 6,
                  width: '100%',
                }}
              >
                {quoteAttachments.map((quote) => (
                  <div
                    key={quote.id}
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      borderRadius: 16,
                      paddingLeft: 16,
                      paddingRight: 16,
                      paddingTop: 8,
                      paddingBottom: 8,
                      fontSize: 12,
                      color: 'var(--muted-foreground)',
                      maxWidth: '90%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                      userSelect: 'text',
                    }}
                    title={quote.content || quote.title}
                  >
                    {quote.content || quote.title}
                  </div>
                ))}
              </div>
            )}

            {/* Attached Images Preview Card (Screenshot 3) */}
            {imageAttachments.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 8,
                  marginBottom: 8,
                  width: '100%',
                }}
              >
                {imageAttachments.map((img) => (
                  <div
                    key={img.id}
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      borderRadius: 16,
                      overflow: 'hidden',
                      maxWidth: 384,
                      boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                      padding: 4,
                    }}
                  >
                    <img
                      src={img.thumbnail || img.url || ''}
                      alt={img.title}
                      style={{
                        width: '100%',
                        height: 'auto',
                        maxHeight: 240,
                        objectFit: 'cover',
                        borderRadius: 12,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Other Document / Tab Attachments */}
            {otherAttachments.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                {otherAttachments.map((att) => (
                  <div
                    key={att.id}
                    style={{
                      fontSize: 12,
                      paddingLeft: 10,
                      paddingRight: 10,
                      paddingTop: 4,
                      paddingBottom: 4,
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      color: 'var(--muted-foreground)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <PaperClipOutlined style={{ color: 'var(--muted-foreground)' }} />
                    <span>{att.title}</span>
                  </div>
                ))}
              </div>
            )}

            {isEditingThis ? (
              <div
                style={{
                  width: '100%',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 16,
                  padding: 14,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                  transition: 'all 200ms ease',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: 90,
                }}
              >
                <textarea
                  value={editingText}
                  onChange={(e) => onChangeEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (editingText.trim()) {
                        onSubmitEdit(editingText.trim());
                      }
                    } else if (e.key === 'Escape') {
                      onCancelEdit();
                    }
                  }}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    resize: 'none',
                    color: 'var(--foreground)',
                    fontSize: 12,
                    minHeight: 50,
                    lineHeight: 1.625,
                  }}
                  rows={2}
                  autoFocus
                />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 12,
                    marginTop: 4,
                    paddingTop: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    style={{
                      padding: 4,
                      color: 'var(--muted-foreground)',
                      transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                    }}
                    title="Cancel"
                  >
                    <CloseOutlined style={{ fontSize: 12 }} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (editingText.trim()) {
                        onSubmitEdit(editingText.trim());
                      }
                    }}
                    style={{
                      padding: 4,
                      color: 'var(--muted-foreground)',
                      transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                    }}
                    title="Save & Submit"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"></line>
                      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={fontSizeClass}
                style={{
                  background: 'var(--muted)',
                  color: 'var(--foreground)',
                  borderRadius: 16,
                  paddingLeft: 16,
                  paddingRight: 16,
                  paddingTop: 10,
                  paddingBottom: 10,
                  fontWeight: 400,
                  maxWidth: 'fit-content',
                  lineHeight: 1.625,
                  userSelect: 'text',
                }}
              >
                {msg.content}
              </div>
            )}
          </div>

          {!isEditingThis && (
            <ActionPanel
              type="user"
              content={msg.content}
              onEdit={() => onStartEdit(msg.id, msg.content)}
              onQuote={onQuoteText}
              onShare={onShare}
            />
          )}
        </div>

        {/* User Avatar to the right of message */}
        <div
          style={{
            flexShrink: 0,
            paddingTop: 2,
          }}
        >
          <UserAvatar
            size={28}
            style={{
              border: '1px solid var(--border)',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            }}
          />
        </div>
      </div>
    );
  }

  // Assistant Message
  const versions = msg.versions && msg.versions.length > 0 ? msg.versions : [msg.content];
  const currentVersionIdx = msg.currentVersionIndex ?? versions.length - 1;
  const currentContent = versions[currentVersionIdx] || msg.content;
  const displayModel = msg.model || 'gemma-4-E2B-it-MLX-4bit';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        marginTop: 12,
        marginBottom: 12,
        width: '100%',
      }}
    >
      {isExporting && (
        <div
          style={{
            paddingTop: 8,
            flexShrink: 0,
          }}
        >
          <input
            type="checkbox"
            checked={isExportSelected}
            onChange={(e) => onToggleExportSelect(msg.id, e.target.checked)}
            style={{
              width: 16,
              height: 16,
              borderRadius: 4,
              border: '1px solid var(--border)',
              color: '#3b82f6',
              cursor: 'pointer',
            }}
          />
        </div>
      )}

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        {/* Assistant Header Row with AI Avatar on left of title */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginBottom: 6,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 12,
              color: 'var(--muted-foreground)',
              fontWeight: 500,
            }}
          >
            <NowPilotAvatar
              size={22}
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.06)' }}
            />
            <span
              style={{
                fontWeight: 600,
                fontSize: 12,
                color: 'var(--foreground)',
              }}
            >
              NowPilot
            </span>
            <span
              style={{
                fontSize: 11,
                color: 'var(--muted-foreground)',
                fontWeight: 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 200,
              }}
            >
              ({displayModel})
            </span>
          </div>

          {/* Version Switcher */}
          {versions.length > 1 && (
            <div
              style={{
                fontSize: 10,
                color: 'var(--muted-foreground)',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'var(--muted)',
                paddingLeft: 8,
                paddingRight: 8,
                paddingTop: 2,
                paddingBottom: 2,
                borderRadius: 9999,
                userSelect: 'none',
                border: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                onClick={() => onSwitchVersion(msg.id, -1)}
                disabled={currentVersionIdx <= 0}
                style={{
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  paddingLeft: 2,
                  paddingRight: 2,
                  transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                  background: 'transparent',
                  border: 'none',
                  opacity: currentVersionIdx <= 0 ? 0.3 : 1,
                }}
                title="Previous version"
              >
                &lt;
              </button>
              <span>
                {currentVersionIdx + 1}/{versions.length}
              </span>
              <button
                type="button"
                onClick={() => onSwitchVersion(msg.id, 1)}
                disabled={currentVersionIdx >= versions.length - 1}
                style={{
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  paddingLeft: 2,
                  paddingRight: 2,
                  transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                  background: 'transparent',
                  border: 'none',
                  opacity: currentVersionIdx >= versions.length - 1 ? 0.3 : 1,
                }}
                title="Next version"
              >
                &gt;
              </button>
            </div>
          )}
        </div>

        {/* Reasoning Thought Block */}
        <ThoughtProcessBlock
          thoughtText={
            msg.thoughtProcess ||
            'Thinking Process:\n\n1. **Analyze the Request**: Analyzing user prompt intent and context parameters.\n2. **Determine Identity and Context**: Scanning connected tabs and environment context.\n3. **Recall Core Knowledge**: Synthesizing optimal step-by-step resolution.\n4. **Formulate Response Strategy**:\n   - Structure explanation clearly\n   - Highlight key actionable takeaways\n5. **Draft Response & Refine**: Verifying accuracy before output generation.'
          }
          isThinking={msg.isThinking}
        />

        {/* AI Markdown Response via PortableMarkdown with streaming cursor */}
        {(!msg.isThinking || currentContent) && (
          <div
            className={fontSizeClass}
            style={{
              width: '100%',
              fontWeight: 400,
              color: 'var(--foreground)',
              lineHeight: 1.625,
              marginTop: 4,
              marginBottom: 4,
            }}
          >
            <PortableMarkdown content={currentContent} />
            {msg.isStreaming && !msg.isThinking && (
              <span
                className="np-pulse"
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: 9999,
                  background: 'var(--foreground)',
                  marginLeft: 4,
                  verticalAlign: 'middle',
                }}
              />
            )}
          </div>
        )}

        {/* Action Panel & Followups */}
        {!msg.isThinking && !msg.isStreaming && (
          <>
            <ActionPanel
              type="ai"
              content={currentContent}
              isLatest={isLatestAI}
              onRegenerate={() => onRegenerate(msg.id)}
              onQuote={onQuoteText}
              onSaveToNote={onSaveToNote}
              onShare={onShare}
            />
            {isLatestAI && (
              <FollowupSuggestions
                suggestions={msg.followups}
                onSelectSuggestion={onSendFollowup}
                onDeepResearch={() => onSendFollowup('Go further with deep research')}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};
