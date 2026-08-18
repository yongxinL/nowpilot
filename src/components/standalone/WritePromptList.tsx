import React, { useState, useMemo } from 'react';
import { DownOutlined, UpOutlined, PlusOutlined } from '@ant-design/icons';

interface WritePromptListProps {
  prompts: string[];
  selectedPrompt: string;
  onSelectPrompt: (prompt: string) => void;
  onOpenAddPrompt: () => void;
}

export const WritePromptList: React.FC<WritePromptListProps> = ({
  prompts,
  selectedPrompt,
  onSelectPrompt,
  onOpenAddPrompt,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // When collapsed: Selected prompt always goes first (index 0), followed by other prompts in original order
  const displayedPrompts = useMemo(() => {
    if (isExpanded) {
      return prompts;
    }
    // Collapsed mode: Put selected prompt first, then rest in original order
    const isSelectedInList = prompts.includes(selectedPrompt);
    if (!isSelectedInList) {
      return [selectedPrompt, ...prompts];
    }
    const otherPrompts = prompts.filter((p) => p !== selectedPrompt);
    return [selectedPrompt, ...otherPrompts];
  }, [prompts, selectedPrompt, isExpanded]);

  if (!isExpanded) {
    return (
      <div className="w-full flex items-center justify-between gap-2 overflow-hidden flex-nowrap">
        {/* Single-row prompt list that cuts off when container width is not enough */}
        <div className="flex items-center gap-2 overflow-hidden flex-1 flex-nowrap">
          {displayedPrompts.map((promptTitle) => {
            const isSelected = promptTitle === selectedPrompt;
            return (
              <button
                key={promptTitle}
                type="button"
                onClick={() => onSelectPrompt(promptTitle)}
                className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs cursor-pointer transition-all shrink-0 select-none ${
                  isSelected
                    ? 'bg-[#ece6f8] text-zinc-900 dark:bg-purple-950/80 dark:text-purple-200 font-semibold shadow-2xs'
                    : 'bg-zinc-100/90 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 font-medium'
                }`}
              >
                {promptTitle}
              </button>
            );
          })}
        </div>

        {/* Expand Down Arrow Button */}
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="px-2 py-1.5 rounded-xl bg-zinc-100/90 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 text-xs flex items-center justify-center shrink-0 cursor-pointer transition-colors"
          title="Expand all prompts"
        >
          <DownOutlined className="text-[10px]" />
        </button>
      </div>
    );
  }

  // Expanded View: all prompts in original position, flex-wrap across multiple lines
  return (
    <div className="w-full flex flex-wrap items-center gap-2">
      {displayedPrompts.map((promptTitle) => {
        const isSelected = promptTitle === selectedPrompt;
        return (
          <button
            key={promptTitle}
            type="button"
            onClick={() => onSelectPrompt(promptTitle)}
            className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs cursor-pointer transition-all select-none ${
              isSelected
                ? 'bg-[#ece6f8] text-zinc-900 dark:bg-purple-950/80 dark:text-purple-200 font-semibold shadow-2xs'
                : 'bg-zinc-100/90 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 font-medium'
            }`}
          >
            {promptTitle}
          </button>
        );
      })}

      {/* Collapse Up Arrow Button */}
      <button
        type="button"
        onClick={() => setIsExpanded(false)}
        className="px-2 py-1.5 rounded-xl bg-zinc-100/90 dark:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 text-xs flex items-center justify-center shrink-0 cursor-pointer transition-colors"
        title="Collapse prompts"
      >
        <UpOutlined className="text-[10px]" />
      </button>

      {/* Add Custom Prompt Button */}
      <button
        type="button"
        onClick={onOpenAddPrompt}
        className="px-2.5 py-1.5 rounded-xl bg-zinc-100/90 dark:bg-zinc-800 text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/80 dark:hover:bg-zinc-700 text-xs font-bold flex items-center justify-center shrink-0 cursor-pointer transition-colors"
        title="Add custom prompt preset"
      >
        <PlusOutlined className="text-[11px]" />
      </button>
    </div>
  );
};
