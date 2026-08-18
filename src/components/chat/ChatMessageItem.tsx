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
      <div className="group flex items-start gap-3 my-3 w-full">
        {isExporting && (
          <div className="pt-2 shrink-0">
            <input
              type="checkbox"
              checked={isExportSelected}
              onChange={(e) => onToggleExportSelect(msg.id, e.target.checked)}
              className="w-4 h-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
            />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col items-end">
          <div className={isEditingThis ? 'w-full' : 'max-w-[90%] w-fit flex flex-col items-end'}>
            {/* Quoted Text Capsule above input / bubble (Screenshots 3 & 4) */}
            {quoteAttachments.length > 0 && (
              <div className="flex flex-col items-end gap-1.5 mb-1.5 w-full">
                {quoteAttachments.map((quote) => (
                  <div
                    key={quote.id}
                    className="border border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 rounded-2xl px-4 py-2 text-xs text-zinc-400 dark:text-zinc-500 max-w-[90%] truncate shadow-2xs select-text"
                    title={quote.content || quote.title}
                  >
                    {quote.content || quote.title}
                  </div>
                ))}
              </div>
            )}

            {/* Attached Images Preview Card (Screenshot 3) */}
            {imageAttachments.length > 0 && (
              <div className="flex flex-col items-end gap-2 mb-2 w-full">
                {imageAttachments.map((img) => (
                  <div
                    key={img.id}
                    className="border border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden max-w-sm shadow-2xs p-1"
                  >
                    <img
                      src={img.thumbnail || img.url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80'}
                      alt={img.title}
                      className="w-full h-auto max-h-60 object-cover rounded-xl"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Other Document / Tab Attachments */}
            {otherAttachments.length > 0 && (
              <div className="flex flex-wrap justify-end gap-1.5 mb-2">
                {otherAttachments.map((att) => (
                  <div
                    key={att.id}
                    className="text-xs px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 truncate flex items-center gap-1.5"
                  >
                    <PaperClipOutlined className="text-zinc-400" />
                    <span>{att.title}</span>
                  </div>
                ))}
              </div>
            )}

            {isEditingThis ? (
              <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-2xl p-3.5 shadow-2xs transition-all flex flex-col justify-between min-h-[90px]">
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
                  className="w-full bg-transparent border-none outline-none resize-none text-zinc-800 dark:text-zinc-100 font-sans text-xs sm:text-sm min-h-[50px] leading-relaxed"
                  rows={2}
                  autoFocus
                />
                <div className="flex items-center justify-end gap-3 mt-1 pt-1">
                  <button
                    type="button"
                    onClick={onCancelEdit}
                    className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer flex items-center justify-center"
                    title="Cancel"
                  >
                    <CloseOutlined className="text-xs" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (editingText.trim()) {
                        onSubmitEdit(editingText.trim());
                      }
                    }}
                    className="p-1 text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer flex items-center justify-center"
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
              <div className={`bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-2xl px-4 py-2.5 font-normal max-w-fit leading-relaxed select-text ${fontSizeClass}`}>
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
        <div className="shrink-0 pt-0.5">
          <UserAvatar size={28} className="border border-zinc-200 dark:border-zinc-700 shadow-2xs" />
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
    <div className="group flex items-start gap-3 my-3 w-full">
      {isExporting && (
        <div className="pt-2 shrink-0">
          <input
            type="checkbox"
            checked={isExportSelected}
            onChange={(e) => onToggleExportSelect(msg.id, e.target.checked)}
            className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col items-start">
        {/* Assistant Header Row with AI Avatar on left of title */}
        <div className="flex items-center justify-between w-full mb-1.5">
          <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 font-medium">
            <NowPilotAvatar size={22} className="shadow-2xs" />
            <span className="font-semibold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100">NowPilot</span>
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-normal truncate max-w-[200px]">({displayModel})</span>
          </div>

          {/* Version Switcher */}
          {versions.length > 1 && (
            <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 rounded-full select-none border border-zinc-200/60 dark:border-zinc-700/60">
              <button
                type="button"
                onClick={() => onSwitchVersion(msg.id, -1)}
                disabled={currentVersionIdx <= 0}
                className="hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold px-0.5 transition-colors"
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
                className="hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold px-0.5 transition-colors"
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
          <div className={`w-full font-normal text-zinc-800 dark:text-zinc-100 leading-relaxed font-sans ${fontSizeClass} my-1`}>
            <PortableMarkdown content={currentContent} />
            {msg.isStreaming && !msg.isThinking && (
              <span className="inline-block w-2 h-2 rounded-full bg-zinc-900 dark:bg-zinc-100 animate-pulse ml-1 align-middle" />
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
