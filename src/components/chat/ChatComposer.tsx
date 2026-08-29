import React from 'react';
import { Tooltip, theme } from 'antd';
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
import { ProviderConfig, Attachment, TabItem, PromptItem, CustomProviderId } from '../../types';

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
  const { token } = theme.useToken();
  return (
    <div
      style={{
        background: 'transparent',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* Sidepanel-only Top Toolbar (32px) */}
      {!isStandalone && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 2,
            paddingRight: 2,
            height: 32,
          }}
        >
          {/* Left: Model Selector & Attach */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Tooltip title="Chat history">
              <button
                type="button"
                onClick={onOpenHistory}
                style={{
                  padding: 6,
                  borderRadius: 8,
                  color: 'var(--muted-foreground)',
                  transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                }}
              >
                <HistoryOutlined style={{ fontSize: 16 }} />
              </button>
            </Tooltip>

            <Tooltip title="New chat">
              <button
                type="button"
                onClick={onCreateNewSession}
                style={{
                  padding: 6,
                  borderRadius: 8,
                  color: 'var(--muted-foreground)',
                  transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                }}
              >
                <PlusSquareOutlined style={{ fontSize: 16 }} />
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
        <div
          style={{
            position: 'relative',
            background: 'var(--card)',
            borderRadius: 16,
            border: '1px solid var(--border)',
            padding: 14,
            minHeight: 120,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            transition: 'all 200ms ease',
          }}
        >
          {/* Standalone Top Toolbar inside Card */}
          {isStandalone && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingBottom: 8,
                marginBottom: 4,
                borderBottom: '1px solid var(--border)',
              }}
            >
              {/* Left: Pill Model Selector & Add Attachment */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
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
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Tooltip title="Chat history">
                  <button
                    type="button"
                    onClick={onOpenHistory}
                    style={{
                      padding: 6,
                      color: 'var(--muted-foreground)',
                      borderRadius: 8,
                      transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                    }}
                  >
                    <HistoryOutlined style={{ fontSize: 14 }} />
                  </button>
                </Tooltip>

                <Tooltip title="New chat">
                  <button
                    type="button"
                    onClick={onCreateNewSession}
                    style={{
                      padding: 6,
                      color: 'var(--muted-foreground)',
                      borderRadius: 8,
                      transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                    }}
                  >
                    <PlusSquareOutlined style={{ fontSize: 14 }} />
                  </button>
                </Tooltip>
              </div>
            </div>
          )}

          {/* Top Section inside Input Area */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
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
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                resize: 'none',
                color: 'var(--foreground)',
                fontSize: 12,
                flex: 1,
                minHeight: 64,
                cursor: disabled ? 'not-allowed' : undefined,
                opacity: disabled ? 0.5 : 1,
              }}
              rows={3}
            />
          </div>

          {/* Bottom Actions Row inside Input Area */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 4,
            }}
          >
            {/* Left: Quick chips if pinned context exists */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                overflowX: 'auto',
                fontSize: 12,
              }}
            >
              {((!isStandalone && availableTabs.some((t) => t.selected)) || activeAttachments.length > 0) &&
                ['For YouTube', 'Summarize', 'Explain'].map((chip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => onChangeInputPrompt(inputPrompt + (inputPrompt ? ' ' : '') + chip)}
                    style={{
                      paddingLeft: 8,
                      paddingRight: 8,
                      paddingTop: 2,
                      paddingBottom: 2,
                      background: 'var(--muted)',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 500,
                      color: 'var(--muted-foreground)',
                      transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                      border: 'none',
                      cursor: 'pointer',
                    }}
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
              style={{
                width: 32,
                height: 32,
                borderRadius: 9999,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: token.boxShadow,
                cursor: 'pointer',
                transition: 'all 200ms ease',
                flexShrink: 0,
                marginLeft: 'auto',
                backgroundColor: 'var(--np-primary, #1677ff)',
                border: 'none',
                opacity: disabled || (!inputPrompt.trim() && activeAttachments.length === 0) ? 0.4 : 1,
              }}
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 4,
          paddingRight: 4,
          fontSize: 12,
          color: 'var(--muted-foreground)',
          height: 28,
          userSelect: 'none',
        }}
      >
        {/* Left: Active Provider with Green Status Indicator */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 500,
            fontSize: 12,
            color: 'var(--muted-foreground)',
          }}
        >
          <span>
            {(() => {
              // D-11: derive the provider label from the operator-configured
              // provider that owns the selected model — never from a
              // hardcoded static catalog. Look up the model across all
              // configured providers; if found, use that provider's name.
              // Fall back to the activeProvider when the model is not in any
              // configured list (e.g. tier assignment without modal save).
              const providerKeys = Object.keys(config.providers ?? {}) as CustomProviderId[];
              const owner = providerKeys.find((pId) =>
                config.providers?.[pId]?.models?.some((m) => m.id === config.selectedModel)
              );
              if (owner && config.providers?.[owner]?.name) {
                return config.providers[owner].name;
              }
              return config.providers?.[config.activeProvider as CustomProviderId]?.name
                ?? config.activeProvider;
            })()}
          </span>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 9999,
              background: '#10b981',
              display: 'inline-block',
              boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            }}
          ></span>
        </div>

        {/* Right: Help & Feedback Icons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'var(--muted-foreground)',
          }}
        >
          <Tooltip title="Help center">
            <button
              type="button"
              onClick={onOpenOnboarding}
              style={{
                transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                padding: 4,
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: 'inherit',
              }}
            >
              <QuestionCircleOutlined style={{ fontSize: 14 }} />
            </button>
          </Tooltip>
          <Tooltip title="Feedback">
            <button
              type="button"
              onClick={onOpenFeedback}
              style={{
                transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                padding: 4,
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: 'inherit',
              }}
            >
              <MailOutlined style={{ fontSize: 14 }} />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};
