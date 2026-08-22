import React from 'react';
import { Typography } from 'antd';
import { ChatMessageItem } from './ChatMessageItem';
import { Message, ChatSession } from '../../types';

interface ChatMessageListProps {
  activeSession: ChatSession | null;
  isStandalone: boolean;
  fontSizeClass: string;
  isExporting: boolean;
  exportSelectedMsgIds: string[];
  onToggleExportSelect: (msgId: string, selected: boolean) => void;
  // User edit state
  editingMsgId: string | null;
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
  onSend: (prompt?: string) => void;
  onCreateNewSession: () => void;
  onOpenStandalone?: () => void;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  activeSession,
  isStandalone,
  fontSizeClass,
  isExporting,
  exportSelectedMsgIds,
  onToggleExportSelect,
  editingMsgId,
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
  onSend,
  onCreateNewSession,
  onOpenStandalone,
}) => {
  if (!activeSession || activeSession.messages.length === 0) {
    return (
      // RICH-I-01 Welcome cards are explicitly deferred to Phase 15 per
      // 01-UI-SPEC.md. The Phase-1 post-onboarding empty Side Panel state
      // is a single centered caption with no chips / no mascot art — the
      // composer remains enabled (the user can type a first message).
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 320,
          paddingTop: 40,
          paddingLeft: 16,
          paddingRight: 16,
          width: '100%',
        }}
      >
        <Typography.Text
          type="secondary"
          style={{ fontSize: 12 }}
          data-testid="empty-state-caption"
        >
          Start a conversation by asking NowPilot a question.
        </Typography.Text>
      </div>
    );
  }

  const lastAiMessageId = [...activeSession.messages].reverse().find((m) => m.role === 'assistant')?.id;

  return (
    <>
      {activeSession.messages.map((msg) => (
        <ChatMessageItem
          key={msg.id}
          msg={msg}
          isLatestAI={msg.id === lastAiMessageId}
          fontSizeClass={fontSizeClass}
          isExporting={isExporting}
          isExportSelected={exportSelectedMsgIds.includes(msg.id)}
          onToggleExportSelect={onToggleExportSelect}
          isEditingThis={editingMsgId === msg.id}
          editingText={editingText}
          onStartEdit={onStartEdit}
          onCancelEdit={onCancelEdit}
          onChangeEditText={onChangeEditText}
          onSubmitEdit={onSubmitEdit}
          onQuoteText={onQuoteText}
          onRegenerate={onRegenerate}
          onSwitchVersion={onSwitchVersion}
          onSaveToNote={onSaveToNote}
          onShare={onShare}
          onSendFollowup={onSend}
        />
      ))}
    </>
  );
};
