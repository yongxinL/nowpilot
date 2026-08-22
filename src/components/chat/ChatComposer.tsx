import React from 'react';
import { Tooltip } from 'antd';
import {
  HistoryOutlined,
  PlusSquareOutlined,
  QuestionCircleOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { ModelSelector } from '../common/ModelSelector';
import { TabContextSelector } from './TabContextSelector';
import { PinnedTabsBar } from './PinnedTabsBar';
import { AttachmentBar } from './AttachmentBar';
import { SlashCommandModal } from './SlashCommandModal';
import { AVAILABLE_MODELS } from '../../services/aiProvider';
import { ProviderConfig, Attachment, TabItem, PromptItem } from '../../types';

interface ChatComposerProps {
  config: ProviderConfig;
  onUpdateConfig: (partial: Partial<ProviderConfig>) => void;
  isStandalone: boolean;
  // D-05 / REQ-F05: when true the composer is a read-only mirror of the
  // Standalone view — input + send are disabled, placeholder reads
  // "Standalone view is active" (M12). The disabled state must NEVER
  // silently accept + drop input.
  disabled?: boolean;
  inputPrompt: string;
  onChangeInputPrompt: (val: string) => void;
  onSend: (overridePrompt?: string) => void;
  // Slash modal
  slashOpen: boolean;
  onOpenSlashChange: (open: boolean) => void;
  prompts: PromptItem[];
  onSelectPrompt: (p: PromptItem) => void;
  // Tabs & Attachments
  availableTabs: TabItem[];
  onToggleTabSelection: (tabId: string) => void;
  activeAttachments: Attachment[];
  onRemoveAttachment: (id: string) => void;
  onAddAttachment: (att: Attachment) => void;
  onScreenCut: () => void;
  // Modals & Navigation
  onOpenPromptManager: () => void;
  onOpenHistory: () => void;
  onCreateNewSession: () => void;
  onOpenOnboarding: () => void;
  onOpenFeedback: () => void;
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  config,
  onUpdateConfig,
  isStandalone,
  disabled = false,
  inputPrompt,
  onChangeInputPrompt,
  onSend,
  slashOpen,
  onOpenSlashChange,
  prompts,
  onSelectPrompt,
  availableTabs,
  onToggleTabSelection,
  activeAttachments,
  onRemoveAttachment,
  onAddAttachment,
  onScreenCut,
  onOpenPromptManager,
  onOpenHistory,
  onCreateNewSession,
  onOpenOnboarding,
  onOpenFeedback,
}) => {
  return (
    <div className="bg-transparent p-0 flex flex-col gap-1.5">
      {/* Sidepanel-only Top Toolbar (32px) */}
      {!isStandalone && (
        <div className="flex items-center justify-between px-0.5 h-8">
          {/* Left: Model Selector & Attach */}
          <div className="flex items-center gap-1.5">
            <ModelSelector
              selectedModelId={config.selectedModel}
              onSelectModel={(m) => onUpdateConfig({ selectedModel: m })}
            />
            <TabContextSelector
              availableTabs={availableTabs}
              onToggleTab={onToggleTabSelection}
              onSelectScreenCut={onScreenCut}
              onAddAttachment={onAddAttachment}
              onOpenPromptManager={onOpenPromptManager}
              hideTabs={isStandalone}
            />
          </div>

          {/* Right: Icon-only actions (Chat history, New chat) */}
          <div className="flex items-center gap-1">
            <Tooltip title="Chat history">
              <button
                type="button"
                onClick={onOpenHistory}
                className="p-1.5 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer flex items-center justify-center"
              >
                <HistoryOutlined className="text-base" />
              </button>
            </Tooltip>

            <Tooltip title="New chat">
              <button
                type="button"
                onClick={onCreateNewSession}
                className="p-1.5 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300 transition-colors cursor-pointer flex items-center justify-center"
              >
                <PlusSquareOutlined className="text-base" />
              </button>
            </Tooltip>
          </div>
        </div>
      )}

      {/* Input Area inside SlashCommandModal */}
      <SlashCommandModal
        prompts={prompts}
        onSelectPrompt={onSelectPrompt}
        onOpenPromptManager={onOpenPromptManager}
        open={slashOpen}
        onOpenChange={onOpenSlashChange}
      >
        <div className="relative bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-700/80 p-3.5 min-h-[120px] flex flex-col justify-between shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15 transition-all">
          {/* Standalone Top Toolbar inside Card */}
          {isStandalone && (
            <div className="flex items-center justify-between pb-2 mb-1 border-b border-zinc-100 dark:border-zinc-800/80">
              {/* Left: Pill Model Selector & Add Attachment */}
              <div className="flex items-center gap-2">
                <ModelSelector
                  selectedModelId={config.selectedModel}
                  onSelectModel={(m) => onUpdateConfig({ selectedModel: m })}
                  variant="pill"
                />
                <TabContextSelector
                  availableTabs={availableTabs}
                  onToggleTab={onToggleTabSelection}
                  onSelectScreenCut={onScreenCut}
                  onAddAttachment={onAddAttachment}
                  onOpenPromptManager={onOpenPromptManager}
                  hideTabs={true}
                />
              </div>

              {/* Right: History & New chat */}
              <div className="flex items-center gap-1.5">
                <Tooltip title="Chat history">
                  <button
                    type="button"
                    onClick={onOpenHistory}
                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                  >
                    <HistoryOutlined className="text-sm" />
                  </button>
                </Tooltip>

                <Tooltip title="New chat">
                  <button
                    type="button"
                    onClick={onCreateNewSession}
                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                  >
                    <PlusSquareOutlined className="text-sm" />
                  </button>
                </Tooltip>
              </div>
            </div>
          )}

          {/* Top Section inside Input Area */}
          <div className="flex-1 flex flex-col">
            {/* Pinned Tabs Bar */}
            {!isStandalone && (
              <PinnedTabsBar
                pinnedTabs={availableTabs.filter((t) => t.selected)}
                onUnpinTab={onToggleTabSelection}
              />
            )}

            {/* Active Attachments Bar */}
            <AttachmentBar
              attachments={activeAttachments}
              onRemove={onRemoveAttachment}
            />

            {/* Multiline Textarea */}
            <textarea
              value={inputPrompt}
              onChange={(e) => {
                const val = e.target.value;
                onChangeInputPrompt(val);
                if (val.includes('/')) {
                  onOpenSlashChange(true);
                } else {
                  onOpenSlashChange(false);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!disabled) onSend();
                }
              }}
              placeholder={disabled ? 'Standalone view is active' : 'Ask anything, @ models, / prompts'}
              disabled={disabled}
              className="w-full bg-transparent border-none outline-none resize-none text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 text-xs sm:text-sm font-sans flex-1 min-h-[64px] disabled:cursor-not-allowed disabled:opacity-50"
              rows={3}
            />
          </div>

          {/* Bottom Actions Row inside Input Area */}
          <div className="flex items-center justify-between pt-1">
            {/* Left: Quick chips if pinned context exists */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              {((!isStandalone && availableTabs.some((t) => t.selected)) || activeAttachments.length > 0) &&
                ['For YouTube', 'Summarize', 'Explain'].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onChangeInputPrompt(inputPrompt + (inputPrompt ? ' ' : '') + chip)}
                    className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-[11px] font-medium text-zinc-600 dark:text-zinc-300 transition-colors"
                  >
                    {chip}
                  </button>
                ))}
            </div>

            {/* Right: Circular Send Button with Paper Plane Icon */}
            <button
              type="button"
              disabled={disabled || (!inputPrompt.trim() && activeAttachments.length === 0)}
              onClick={() => onSend()}
              className="w-8 h-8 rounded-full text-white flex items-center justify-center shadow-xs cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 transition-all shrink-0 ml-auto"
              style={{ backgroundColor: 'var(--np-primary, #1677ff)' }}
              title="Send message (Enter)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </SlashCommandModal>

      {/* 5. Status Bar (28px) */}
      <div className="flex items-center justify-between px-1 text-xs text-zinc-500 dark:text-zinc-400 h-7 select-none">
        {/* Left: Active Provider with Green Status Indicator */}
        <div className="flex items-center gap-1.5 font-medium text-xs text-zinc-700 dark:text-zinc-300">
          <span>
            {(() => {
              const selectedModelObj = AVAILABLE_MODELS.find((m) => m.id === config.selectedModel) || AVAILABLE_MODELS[0];
              if (selectedModelObj) {
                if (selectedModelObj.group === 'Google Gemini' || selectedModelObj.provider === 'gemini') return 'Google (Gemini)';
                if (selectedModelObj.group === 'Anthropic' || selectedModelObj.provider === 'claude') return 'Anthropic (Claude)';
                if (selectedModelObj.group) return selectedModelObj.group;
              }
              return 'OpenAI';
            })()}
          </span>
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shadow-2xs"></span>
        </div>

        {/* Right: Help & Feedback Icons */}
        <div className="flex items-center gap-2 text-zinc-400">
          <Tooltip title="Help center">
            <button
              type="button"
              onClick={onOpenOnboarding}
              className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors p-1 rounded-md cursor-pointer flex items-center justify-center"
            >
              <QuestionCircleOutlined className="text-sm" />
            </button>
          </Tooltip>
          <Tooltip title="Feedback">
            <button
              type="button"
              onClick={onOpenFeedback}
              className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors p-1 rounded-md cursor-pointer flex items-center justify-center"
            >
              <MailOutlined className="text-sm" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
