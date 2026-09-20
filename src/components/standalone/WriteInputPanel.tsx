import React from 'react';
import { DeleteOutlined } from '@ant-design/icons';
import { WritePromptList } from './WritePromptList';
import { ModelSelector } from '../common/ModelSelector';
import { WriteFormattingPopover } from './WriteFormattingPopover';

interface WriteInputPanelProps {
  activeTab: 'write' | 'reply';
  prompts: string[];
  selectedPrompt: string;
  onSelectPrompt: (prompt: string) => void;
  onOpenAddPrompt: () => void;
  selectedModelId?: string;
  onSelectModel: (modelId: string) => void;
  tone: string;
  onChangeTone: (val: string) => void;
  length: string;
  onChangeLength: (val: string) => void;
  language: string;
  onChangeLanguage: (val: string) => void;
  writeInput: string;
  onChangeWriteInput: (val: string) => void;
  replyOriginalText: string;
  onChangeReplyOriginalText: (val: string) => void;
  replyIdeaText: string;
  onChangeReplyIdeaText: (val: string) => void;
  isGenerating: boolean;
  onSubmit: () => void;
  onClear: () => void;
}

export const WriteInputPanel: React.FC<WriteInputPanelProps> = ({
  activeTab,
  prompts,
  selectedPrompt,
  onSelectPrompt,
  onOpenAddPrompt,
  selectedModelId,
  onSelectModel,
  tone,
  onChangeTone,
  length,
  onChangeLength,
  language,
  onChangeLanguage,
  writeInput,
  onChangeWriteInput,
  replyOriginalText,
  onChangeReplyOriginalText,
  replyIdeaText,
  onChangeReplyIdeaText,
  isGenerating,
  onSubmit,
  onClear,
}) => {
  const isWriteEmpty = !writeInput.trim();
  const isReplyEmpty = !replyOriginalText.trim() && !replyIdeaText.trim();
  const isSubmitDisabled = activeTab === 'write' ? (isWriteEmpty || isGenerating) : (isReplyEmpty || isGenerating);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        width: '100%',
      }}
    >
      {/* 1. Prompt / Preset Selection Row */}
      <WritePromptList
        prompts={prompts}
        selectedPrompt={selectedPrompt}
        onSelectPrompt={onSelectPrompt}
        onOpenAddPrompt={onOpenAddPrompt}
      />

      {/* 2. Model & Formatting Selector Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          width: '100%',
        }}
      >
        <ModelSelector
          selectedModelId={selectedModelId ?? ''}
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
        <div
          style={{
            position: 'relative',
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid #ebeff2',
            padding: 16,
            minHeight: 320,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 150ms ease',
          }}
        >
          <textarea
            value={writeInput}
            onChange={(e) => onChangeWriteInput(e.target.value)}
            placeholder="Enter the topic you want to write about..."
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              resize: 'none',
              color: '#12171a',
              fontSize: 14,
              lineHeight: 1.6,
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              flex: 1,
              minHeight: 220,
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 8,
            }}
          >
            <button
              type="button"
              onClick={onClear}
              style={{
                color: '#8a99a4',
                padding: 6,
                borderRadius: 8,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#12171a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#8a99a4';
              }}
              title="Clear input"
            >
              <DeleteOutlined style={{ fontSize: 16 }} />
            </button>

            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitDisabled}
              style={{
                height: 36,
                paddingLeft: 20,
                paddingRight: 20,
                borderRadius: 8,
                background: isSubmitDisabled ? '#f3f4f6' : '#5433ff',
                color: isSubmitDisabled ? '#9ca3af' : '#ffffff',
                border: 'none',
                fontSize: 13,
                fontWeight: 500,
                cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                transition: 'all 150ms ease',
                boxShadow: isSubmitDisabled ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
              }}
            >
              {isGenerating ? 'Generating...' : 'Submit'}
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Top Box: Original Text (with lavender/purple border) */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              border: '1.5px solid #8b5cf6',
              padding: 16,
              minHeight: 140,
              display: 'flex',
              flexDirection: 'column',
              transition: 'all 150ms ease',
            }}
          >
            <textarea
              value={replyOriginalText}
              onChange={(e) => onChangeReplyOriginalText(e.target.value)}
              placeholder="Enter the original text you want to reply to"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                color: '#12171a',
                fontSize: 14,
                lineHeight: 1.6,
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                flex: 1,
                minHeight: 100,
              }}
            />
          </div>

          {/* Bottom Box: Response Idea & Submit */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: 16,
              border: '1px solid #ebeff2',
              padding: 16,
              minHeight: 160,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'all 150ms ease',
            }}
          >
            <textarea
              value={replyIdeaText}
              onChange={(e) => onChangeReplyIdeaText(e.target.value)}
              placeholder="Describe the general idea of your response"
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                color: '#12171a',
                fontSize: 14,
                lineHeight: 1.6,
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                flex: 1,
                minHeight: 90,
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 8,
              }}
            >
              <button
                type="button"
                onClick={onClear}
                style={{
                  color: '#8a99a4',
                  padding: 6,
                  borderRadius: 8,
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#12171a';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#8a99a4';
                }}
                title="Clear input"
              >
                <DeleteOutlined style={{ fontSize: 16 }} />
              </button>

              <button
                type="button"
                onClick={onSubmit}
                disabled={isSubmitDisabled}
                style={{
                  height: 36,
                  paddingLeft: 20,
                  paddingRight: 20,
                  borderRadius: 8,
                  background: isSubmitDisabled ? '#f3f4f6' : '#5433ff',
                  color: isSubmitDisabled ? '#9ca3af' : '#ffffff',
                  border: 'none',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
                  transition: 'all 150ms ease',
                  boxShadow: isSubmitDisabled ? 'none' : '0 1px 2px rgba(0,0,0,0.05)',
                }}
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
