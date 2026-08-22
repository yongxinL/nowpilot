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
      <div style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            overflow: 'hidden',
            flexWrap: 'nowrap',
          }}>
        {/* Single-row prompt list that cuts off when container width is not enough */}
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflow: 'hidden',
            flex: 1,
            flexWrap: 'nowrap',
          }}>
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
          style={{
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 12,
            background: 'var(--muted)',
            color: 'var(--muted-foreground)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
          }}
          title="Expand all prompts"
        >
          <DownOutlined style={{
            fontSize: '10px',
          }} />
        </button>
      </div>
    );
  }

  // Expanded View: all prompts in original position, flex-wrap across multiple lines
  return (
    <div style={{
            width: '100%',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
          }}>
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
        style={{
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 12,
            background: 'var(--muted)',
            color: 'var(--muted-foreground)',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
          }}
        title="Collapse prompts"
      >
        <UpOutlined style={{
            fontSize: '10px',
          }} />
      </button>

      {/* Add Custom Prompt Button */}
      <button
        type="button"
        onClick={onOpenAddPrompt}
        style={{
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 12,
            background: 'var(--muted)',
            color: 'var(--muted-foreground)',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
          }}
        title="Add custom prompt preset"
      >
        <PlusOutlined style={{
            fontSize: '11px',
          }} />
      </button>
    </div>
  );
};
