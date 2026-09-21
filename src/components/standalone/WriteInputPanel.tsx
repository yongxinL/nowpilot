import React from 'react';
import { DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { WritePromptList } from './WritePromptList';
import { WriteFormattingPopover } from './WriteFormattingPopover';

/** The canonical non-interactive workflow display label (UI-SPEC § Composer control). */
const WORKFLOW_DISPLAY_LABEL = 'Auto';

/**
 * The Write page is `fixture-preview` in Phase 1: generation is a later-phase
 * provider operation, so the submit control never becomes enabled.
 */
const GENERATION_DEFERRED = true;

interface WriteInputPanelProps {
  activeTab: 'write' | 'reply';
  prompts: string[];
  selectedPrompt: string;
  onSelectPrompt: (prompt: string) => void;
  onOpenAddPrompt: () => void;
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
  onClear: () => void;
}

export const WriteInputPanel: React.FC<WriteInputPanelProps> = ({
  activeTab,
  prompts,
  selectedPrompt,
  onSelectPrompt,
  onOpenAddPrompt,
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
  onClear,
}) => {
  const isWriteEmpty = !writeInput.trim();
  const isReplyEmpty = !replyOriginalText.trim() && !replyIdeaText.trim();
  // Generation is a later-phase provider operation on this fixture-preview
  // page, so the submit control is always disabled and marked: a fixture page
  // never simulates a successful provider operation, and no control may look
  // enabled while it cannot work.
  const isSubmitDisabled =
    GENERATION_DEFERRED || (activeTab === 'write' ? isWriteEmpty || isGenerating : isReplyEmpty || isGenerating);

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
        {/* DEC-HTML-01: the workflow control is a non-interactive read-only
            display of the canonical default. A raw model selector is forbidden,
            and the workflow registry is a later phase, so this is a label —
            never a model identifier and never a control. */}
        <span
          data-testid="np-write-workflow-display"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 28,
            paddingLeft: 12,
            paddingRight: 12,
            borderRadius: 9999,
            background: 'var(--muted)',
            color: 'var(--muted-foreground)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <ThunderboltOutlined style={{ fontSize: 12 }} />
          {WORKFLOW_DISPLAY_LABEL}
        </span>

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
                // The keyboard shortcut must not reach a deferred operation.
                e.preventDefault();
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
              data-np-backing="deferred"
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
                  // The keyboard shortcut must not reach a deferred operation.
                  e.preventDefault();
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
                data-np-backing="deferred"
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
