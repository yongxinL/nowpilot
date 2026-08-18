import React, { useState } from 'react';
import { Popover, Tooltip } from 'antd';
import {
  SettingOutlined,
  RightOutlined,
  YoutubeOutlined,
  FileTextOutlined,
  ReadOutlined,
  TranslationOutlined,
  EditOutlined,
  CheckCircleOutlined,
  MailOutlined,
  TagOutlined,
  EllipsisOutlined,
} from '@ant-design/icons';
import { PromptItem } from '../../types';

interface SlashCommandModalProps {
  prompts: PromptItem[];
  onSelectPrompt: (prompt: PromptItem) => void;
  onOpenPromptManager: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

const LANGUAGES = [
  { name: 'British English', detail: 'English (UK)' },
  { name: 'English', detail: 'English' },
  { name: 'Australian English', detail: 'English (Australia)' },
  { name: 'Canadian English', detail: 'English (Canada)' },
  { name: 'English (India)', detail: 'English (India)' },
  { name: 'American English', detail: 'English (US)' },
];

export const SlashCommandModal: React.FC<SlashCommandModalProps> = ({
  prompts,
  onSelectPrompt,
  onOpenPromptManager,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  children,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [hoveredTranslate, setHoveredTranslate] = useState(false);
  const [selectedLangName, setSelectedLangName] = useState('British English');

  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen);
    }
    if (controlledOnOpenChange) {
      controlledOnOpenChange(nextOpen);
    }
    if (!nextOpen) {
      setHoveredTranslate(false);
    }
  };

  const getPromptIcon = (title: string, index: number) => {
    if (title.toLowerCase().includes('youtube')) return <YoutubeOutlined className="text-red-500 text-sm" />;
    if (title.toLowerCase().includes('explain')) return <ReadOutlined className="text-emerald-500 text-sm" />;
    if (title.toLowerCase().includes('translate')) return <TranslationOutlined className="text-indigo-500 text-sm" />;
    if (title.toLowerCase().includes('improve')) return <EditOutlined className="text-amber-500 text-sm" />;
    if (title.toLowerCase().includes('summarize')) {
      return index === 1 ? <MailOutlined className="text-blue-500 text-sm" /> : <TagOutlined className="text-violet-500 text-sm" />;
    }
    return <CheckCircleOutlined className="text-zinc-400 text-sm" />;
  };

  // Default active list matching screenshot 01-sidepanel-chatPage-slash-modal.png
  const activePromptItems = [
    { id: 'yt', title: 'For YouTube', content: 'Generate YouTube video titles, description, and key chapter timestamps:' },
    { id: 'sum1', title: 'Summarize', content: 'Provide a concise summary of the following text with key bullet points:' },
    { id: 'exp', title: 'Explain', content: 'Explain this concept clearly with examples:' },
    { id: 'sum2', title: 'Summarize', content: 'Summarize key takeaways in bullet points:' },
    { id: 'trans', title: 'Translate into', targetLang: selectedLangName, content: `Translate the following text into natural, idiomatic ${selectedLangName}:` },
    { id: 'imp', title: 'Improve writing', content: 'Polishing and enhance the clarity, tone, and flow of the following text:' },
  ];

  const menuContent = (
    <div className="w-64 p-2 relative text-xs bg-white dark:bg-zinc-900 rounded-2xl select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-2 pt-0.5 pb-2 mb-1">
        <span className="text-[12px] font-medium text-zinc-400 dark:text-zinc-500">Select prompt</span>
        <Tooltip title="Manage prompts" placement="top">
          <button
            type="button"
            onClick={() => {
              handleOpenChange(false);
              onOpenPromptManager();
            }}
            className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer transition-colors text-xs"
          >
            <SettingOutlined />
          </button>
        </Tooltip>
      </div>

      {/* Prompts List */}
      <div className="flex flex-col gap-0.5">
        {activePromptItems.map((prompt, idx) => {
          const isTranslate = prompt.id === 'trans';

          return (
            <div
              key={prompt.id + '_' + idx}
              onMouseEnter={() => {
                if (isTranslate) setHoveredTranslate(true);
              }}
              onClick={() => {
                if (!isTranslate) {
                  onSelectPrompt({
                    id: prompt.id,
                    title: prompt.title,
                    content: prompt.content,
                    category: 'Chat/Ask',
                    showInList: true,
                  });
                  handleOpenChange(false);
                }
              }}
              className={`flex items-center justify-between px-2.5 py-2 hover:bg-zinc-100/90 dark:hover:bg-zinc-800/90 rounded-xl cursor-pointer transition-colors ${
                isTranslate && hoveredTranslate ? 'bg-zinc-100 dark:bg-zinc-800' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 overflow-hidden pr-1">
                <span className="shrink-0">{getPromptIcon(prompt.title, idx)}</span>
                {isTranslate ? (
                  <div className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                    <span>Translate into: </span>
                    <span className="text-zinc-400 dark:text-zinc-500 font-normal">{prompt.targetLang}</span>
                  </div>
                ) : (
                  <span className="font-medium text-zinc-800 dark:text-zinc-200 truncate">{prompt.title}</span>
                )}
              </div>
              {isTranslate && <RightOutlined className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0 ml-1" />}
            </div>
          );
        })}
      </div>

      {/* Language flyout menu if hovered translate */}
      {hoveredTranslate && (
        <div
          onMouseEnter={() => setHoveredTranslate(true)}
          onMouseLeave={() => setHoveredTranslate(false)}
          className="absolute left-full top-0 ml-2 w-60 p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl z-50 flex flex-col gap-1 animate-in fade-in duration-150"
        >
          {LANGUAGES.map(lang => {
            const isSelected = selectedLangName === lang.name;
            return (
              <div
                key={lang.name}
                onClick={() => {
                  setSelectedLangName(lang.name);
                  onSelectPrompt({
                    id: 'trans_' + lang.name,
                    title: `Translate into: ${lang.name}`,
                    content: `Translate the following text into natural, idiomatic ${lang.name}:`,
                    category: 'Writing',
                    showInList: true,
                    targetLang: lang.name,
                  });
                  setHoveredTranslate(false);
                  handleOpenChange(false);
                }}
                className={`px-3 py-2 rounded-xl cursor-pointer flex flex-col transition-colors ${
                  isSelected || lang.name === 'English (India)'
                    ? 'bg-zinc-100 dark:bg-zinc-800'
                    : 'hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80'
                }`}
              >
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 text-xs">{lang.name}</span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal">{lang.detail}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <Popover
      content={menuContent}
      trigger={isControlled ? [] : 'click'}
      open={isOpen}
      onOpenChange={handleOpenChange}
      placement="top"
      overlayClassName="slash-command-popover"
    >
      {children || (
        <button
          type="button"
          className="px-2.5 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-700/70 dark:hover:bg-zinc-700 rounded-lg text-zinc-700 dark:text-zinc-200 font-medium cursor-pointer transition-colors text-[11px] flex items-center justify-center gap-1 shrink-0"
          title="More prompts"
        >
          <EllipsisOutlined className="text-base leading-none" />
        </button>
      )}
    </Popover>
  );
};
