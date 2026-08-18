import React from 'react';
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
      <div className="flex flex-col items-center justify-center min-h-[320px] pt-10 sm:pt-20 px-4 w-full">
        <div className="text-left w-full max-w-2xl mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 mb-1">
            Hi,
          </h1>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            How can I assist you today?
          </h2>
        </div>

        <div className="flex flex-wrap items-center justify-start gap-2.5 sm:gap-3 w-full max-w-2xl">
          <button
            type="button"
            onClick={() => {
              if (onOpenStandalone) {
                onOpenStandalone();
              } else {
                onCreateNewSession();
              }
            }}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 text-xs font-medium shadow-2xs cursor-pointer transition-all hover:scale-[1.02]"
          >
            <span className="text-zinc-500 dark:text-zinc-400">📖</span>
            <span>Full Screen Chat</span>
          </button>

          <button
            type="button"
            onClick={() => onSend('Perform deep research and comprehensive synthesis on this topic.')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 text-xs font-medium shadow-2xs cursor-pointer transition-all hover:scale-[1.02]"
          >
            <span className="text-purple-500">🕸️</span>
            <span>Deep Research</span>
          </button>

          <button
            type="button"
            onClick={() => onSend('Extract key highlights, takeaways, and structured insights.')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 text-xs font-medium shadow-2xs cursor-pointer transition-all hover:scale-[1.02]"
          >
            <span className="text-amber-500">📑</span>
            <span>My Highlights</span>
          </button>

          <button
            type="button"
            onClick={() => onSend('Generate presentation slides structure and key points for this topic.')}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-zinc-200/90 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700/80 text-zinc-700 dark:text-zinc-200 text-xs font-medium shadow-2xs cursor-pointer transition-all hover:scale-[1.02]"
          >
            <span className="text-blue-500">🖥️</span>
            <span>AI Slides</span>
          </button>
        </div>
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
