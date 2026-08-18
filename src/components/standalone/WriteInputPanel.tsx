import React from 'react';
import { DeleteOutlined } from '@ant-design/icons';
import { WritePromptList } from './WritePromptList';
import { ModelSelector } from '../common/ModelSelector';
import { WriteFormattingPopover } from './WriteFormattingPopover';

interface WriteInputPanelProps {
  activeTab: 'write' | 'reply';
  writeInput: string;
  onChangeWriteInput: (val: string) => void;
  replyOriginalText: string;
  onChangeReplyOriginalText: (val: string) => void;
  replyIdeaText: string;
  onChangeReplyIdeaText: (val: string) => void;
  onClear: () => void;
  onSubmit: () => void;
  isGenerating: boolean;
  // Prompt list
  prompts: string[];
  selectedFormat: string;
  onSelectFormat: (format: string) => void;
  onOpenAddPrompt: () => void;
  // Model selector
  selectedModelId?: string;
  onSelectModel: (modelId: string) => void;
  // Formatting
  tone: string;
  onChangeTone: (val: string) => void;
  length: string;
  onChangeLength: (val: string) => void;
  language: string;
  onChangeLanguage: (val: string) => void;
}

export const WriteInputPanel: React.FC<WriteInputPanelProps> = ({
  activeTab,
  writeInput,
  onChangeWriteInput,
  replyOriginalText,
  onChangeReplyOriginalText,
  replyIdeaText,
  onChangeReplyIdeaText,
  onClear,
  onSubmit,
  isGenerating,
  prompts,
  selectedFormat,
  onSelectFormat,
  onOpenAddPrompt,
  selectedModelId,
  onSelectModel,
  tone,
  onChangeTone,
  length,
  onChangeLength,
  language,
  onChangeLanguage,
}) => {
  return (
    <div className="flex flex-col gap-3.5 w-full">
      {/* 1. Prompt List in Left Column */}
      <WritePromptList
        prompts={prompts}
        selectedPrompt={selectedFormat}
        onSelectPrompt={onSelectFormat}
        onOpenAddPrompt={onOpenAddPrompt}
      />

      {/* 2. Control Row: Model Selector on Left, Formatting on Right */}
      <div className="flex items-center justify-between gap-3 w-full">
        <ModelSelector
          selectedModelId={selectedModelId}
          onSelectModel={onSelectModel}
          variant="pill"
        />

        <WriteFormattingPopover
          styleValue={tone}
          onChangeStyle={onChangeTone}
          lengthValue={length}
          onChangeLength={onChangeLength}
          languageValue={language}
          onChangeLanguage={onChangeLanguage}
        />
      </div>

      {/* 3. Input Box */}
      {activeTab === 'write' ? (
        <div className="relative bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-700/80 p-4 min-h-[300px] flex flex-col justify-between shadow-2xs focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/15 transition-all">
          <textarea
            value={writeInput}
            onChange={(e) => onChangeWriteInput(e.target.value)}
            placeholder="Enter the topic you want to write about..."
            className="w-full bg-transparent border-none outline-none resize-none text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 text-sm font-sans flex-1 min-h-[200px]"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onClear}
              className="text-zinc-400 hover:text-red-500 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
              title="Clear input"
            >
              <DeleteOutlined className="text-base" />
            </button>

            <button
              type="button"
              onClick={onSubmit}
              disabled={!writeInput.trim() || isGenerating}
              className="px-6 py-2 rounded-xl bg-[#5433ff] hover:bg-[#4323e0] disabled:opacity-40 disabled:hover:bg-[#5433ff] text-white text-xs font-semibold shadow-2xs cursor-pointer disabled:cursor-not-allowed transition-all"
            >
              {isGenerating ? 'Generating...' : 'Submit'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {/* Top Box: Original Text */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-violet-400 dark:border-violet-600/80 p-4 min-h-[140px] shadow-2xs flex flex-col transition-all">
            <textarea
              value={replyOriginalText}
              onChange={(e) => onChangeReplyOriginalText(e.target.value)}
              placeholder="Enter the original text you want to reply to"
              className="w-full bg-transparent border-none outline-none resize-none text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 text-sm font-sans flex-1 min-h-[100px]"
            />
          </div>

          {/* Bottom Box: Response Idea & Submit */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/90 dark:border-zinc-700/80 p-4 min-h-[160px] shadow-2xs flex flex-col justify-between focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/15 transition-all">
            <textarea
              value={replyIdeaText}
              onChange={(e) => onChangeReplyIdeaText(e.target.value)}
              placeholder="Describe the general idea of your response"
              className="w-full bg-transparent border-none outline-none resize-none text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 text-sm font-sans flex-1 min-h-[90px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
            />

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={onClear}
                className="text-zinc-400 hover:text-red-500 p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                title="Clear input"
              >
                <DeleteOutlined className="text-base" />
              </button>

              <button
                type="button"
                onClick={onSubmit}
                disabled={(!replyOriginalText.trim() && !replyIdeaText.trim()) || isGenerating}
                className="px-6 py-2 rounded-xl bg-[#5433ff] hover:bg-[#4323e0] disabled:bg-zinc-200 dark:disabled:bg-zinc-800 disabled:text-zinc-400 text-white text-xs font-semibold shadow-2xs cursor-pointer disabled:cursor-not-allowed transition-all"
              >
                {isGenerating ? 'Generating...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
