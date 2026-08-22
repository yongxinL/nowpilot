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
    <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            width: '100%',
          }}>
      {/* 1. Prompt List in Left Column */}
      <WritePromptList
        prompts={prompts}
        selectedPrompt={selectedFormat}
        onSelectPrompt={onSelectFormat}
        onOpenAddPrompt={onOpenAddPrompt}
      />

      {/* 2. Control Row: Model Selector on Left, Formatting on Right */}
      <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            width: '100%',
          }}>
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
        <div style={{
            position: 'relative',
            background: 'var(--card)',
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            padding: 16,
            minHeight: 300,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            transition: 'all 200ms ease',
          }}>
          <textarea
            value={writeInput}
            onChange={(e) => onChangeWriteInput(e.target.value)}
            placeholder="Enter the topic you want to write about..."
            style={{
            width: '100%',
            background: 'transparent',
            borderStyle: 'none',
            outline: 'none',
            resize: 'none',
            color: 'var(--foreground)',
            fontSize: 14,
            fontFamily: 'var(--font-sans)',
            flex: 1,
            minHeight: 200,
          }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onSubmit();
              }
            }}
          />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 8,
          }}>
            <button
              type="button"
              onClick={onClear}
              style={{
            color: 'var(--muted-foreground)',
            padding: 6,
            borderRadius: 8,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
              title="Clear input"
            >
              <DeleteOutlined style={{
            fontSize: 16,
          }} />
            </button>

            <button
              type="button"
              onClick={onSubmit}
              disabled={!writeInput.trim() || isGenerating}
              style={{
            paddingLeft: 24,
            paddingRight: 24,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 12,
            background: '#5433ff',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 600,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            cursor: 'pointer',
            transition: 'all 200ms ease',
          }}
            >
              {isGenerating ? 'Generating...' : 'Submit'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}>
          {/* Top Box: Original Text */}
          <div style={{
            background: 'var(--card)',
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: '#a78bfa',
            padding: 16,
            minHeight: 140,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'all 200ms ease',
          }}>
            <textarea
              value={replyOriginalText}
              onChange={(e) => onChangeReplyOriginalText(e.target.value)}
              placeholder="Enter the original text you want to reply to"
              style={{
            width: '100%',
            background: 'transparent',
            borderStyle: 'none',
            outline: 'none',
            resize: 'none',
            color: 'var(--foreground)',
            fontSize: 14,
            fontFamily: 'var(--font-sans)',
            flex: 1,
            minHeight: 100,
          }}
            />
          </div>

          {/* Bottom Box: Response Idea & Submit */}
          <div style={{
            background: 'var(--card)',
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            padding: 16,
            minHeight: 160,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 200ms ease',
          }}>
            <textarea
              value={replyIdeaText}
              onChange={(e) => onChangeReplyIdeaText(e.target.value)}
              placeholder="Describe the general idea of your response"
              style={{
            width: '100%',
            background: 'transparent',
            borderStyle: 'none',
            outline: 'none',
            resize: 'none',
            color: 'var(--foreground)',
            fontSize: 14,
            fontFamily: 'var(--font-sans)',
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

            <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 8,
          }}>
              <button
                type="button"
                onClick={onClear}
                style={{
            color: 'var(--muted-foreground)',
            padding: 6,
            borderRadius: 8,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
                title="Clear input"
              >
                <DeleteOutlined style={{
            fontSize: 16,
          }} />
              </button>

              <button
                type="button"
                onClick={onSubmit}
                disabled={(!replyOriginalText.trim() && !replyIdeaText.trim()) || isGenerating}
                style={{
            paddingLeft: 24,
            paddingRight: 24,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 12,
            background: '#5433ff',
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 600,
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            cursor: 'pointer',
            transition: 'all 200ms ease',
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
