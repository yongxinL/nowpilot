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
    const isSelectedInList = prompts.includes(selectedPrompt);
    if (!isSelectedInList) {
      return [selectedPrompt, ...prompts];
    }
    const otherPrompts = prompts.filter((p) => p !== selectedPrompt);
    return [selectedPrompt, ...otherPrompts];
  }, [prompts, selectedPrompt, isExpanded]);

  if (!isExpanded) {
    return (
      <div
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          overflow: 'hidden',
          flexWrap: 'nowrap',
        }}
      >
        {/* Single-row prompt list that clips gracefully */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            overflow: 'hidden',
            flex: 1,
            flexWrap: 'nowrap',
          }}
        >
          {displayedPrompts.map((promptTitle) => {
            const isSelected = promptTitle === selectedPrompt;
            return (
              <button
                key={promptTitle}
                type="button"
                onClick={() => onSelectPrompt(promptTitle)}
                style={{
                  whiteSpace: 'nowrap',
                  padding: '6px 14px',
                  borderRadius: 12,
                  fontSize: 13,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  flexShrink: 0,
                  userSelect: 'none',
                  border: isSelected ? '1px solid transparent' : '1px solid #ebeff2',
                  background: isSelected ? '#ece6f8' : '#ffffff',
                  color: isSelected ? '#12171a' : '#12171a',
                  fontWeight: isSelected ? 600 : 500,
                  boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
                }}
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
            padding: '6px 10px',
            borderRadius: 12,
            background: '#ffffff',
            border: '1px solid #ebeff2',
            color: '#8a99a4',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            transition: 'all 150ms ease',
          }}
          title="Expand all prompts"
        >
          <DownOutlined style={{ fontSize: 10 }} />
        </button>
      </div>
    );
  }

  // Expanded View: all prompts in multi-line flow with collapse button and add button
  return (
    <div
      style={{
        width: '100%',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {displayedPrompts.map((promptTitle) => {
        const isSelected = promptTitle === selectedPrompt;
        return (
          <button
            key={promptTitle}
            type="button"
            onClick={() => onSelectPrompt(promptTitle)}
            style={{
              whiteSpace: 'nowrap',
              padding: '6px 14px',
              borderRadius: 12,
              fontSize: 13,
              cursor: 'pointer',
              transition: 'all 150ms ease',
              userSelect: 'none',
              border: isSelected ? '1px solid transparent' : '1px solid #ebeff2',
              background: isSelected ? '#ece6f8' : '#ffffff',
              color: isSelected ? '#12171a' : '#12171a',
              fontWeight: isSelected ? 600 : 500,
              boxShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
            }}
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
          padding: '6px 10px',
          borderRadius: 12,
          background: '#ffffff',
          border: '1px solid #ebeff2',
          color: '#8a99a4',
          fontSize: 11,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
        title="Collapse prompts"
      >
        <UpOutlined style={{ fontSize: 10 }} />
      </button>

      {/* Add Custom Prompt Button */}
      <button
        type="button"
        onClick={onOpenAddPrompt}
        style={{
          padding: '6px 12px',
          borderRadius: 12,
          background: '#ffffff',
          border: '1px solid #ebeff2',
          color: '#8a99a4',
          fontSize: 12,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: 'pointer',
          transition: 'all 150ms ease',
        }}
        title="Add custom prompt preset"
      >
        <PlusOutlined style={{ fontSize: 11 }} />
      </button>
    </div>
  );
};
