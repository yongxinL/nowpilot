import React, { useState } from 'react';
import { Popover, Tooltip, theme } from 'antd';
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
  const { token } = theme.useToken();

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
    if (title.toLowerCase().includes('youtube')) return <YoutubeOutlined style={{ color: token.colorError, fontSize: 14 }} />;
    if (title.toLowerCase().includes('explain')) return <ReadOutlined style={{ color: '#10b981', fontSize: 14 }} />;
    if (title.toLowerCase().includes('translate')) return <TranslationOutlined style={{ color: '#6366f1', fontSize: 14 }} />;
    if (title.toLowerCase().includes('improve')) return <EditOutlined style={{ color: '#f59e0b', fontSize: 14 }} />;
    if (title.toLowerCase().includes('summarize')) {
      return index === 1 ? <MailOutlined style={{ color: '#3b82f6', fontSize: 14 }} /> : <TagOutlined style={{ color: '#8b5cf6', fontSize: 14 }} />;
    }
    return <CheckCircleOutlined style={{ color: 'var(--muted-foreground)', fontSize: 14 }} />;
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
    <div
      style={{
        width: 256,
        padding: 8,
        position: 'relative',
        fontSize: 12,
        background: 'var(--card)',
        borderRadius: 16,
        userSelect: 'none',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingLeft: 8,
          paddingRight: 8,
          paddingTop: 2,
          paddingBottom: 8,
          marginBottom: 4,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--muted-foreground)' }}>Select prompt</span>
        <Tooltip title="Manage prompts" placement="top">
          <button
            type="button"
            onClick={() => {
              handleOpenChange(false);
              onOpenPromptManager();
            }}
            style={{
              padding: 4,
              borderRadius: 6,
              color: 'var(--muted-foreground)',
              cursor: 'pointer',
              transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
              fontSize: 12,
              background: 'transparent',
              border: 'none',
            }}
          >
            <SettingOutlined />
          </button>
        </Tooltip>
      </div>

      {/* Prompts List */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
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
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingLeft: 10,
                paddingRight: 10,
                paddingTop: 8,
                paddingBottom: 8,
                borderRadius: 12,
                cursor: 'pointer',
                transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                background: isTranslate && hoveredTranslate ? 'var(--muted)' : 'transparent',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  overflow: 'hidden',
                  paddingRight: 4,
                }}
              >
                <span style={{ flexShrink: 0 }}>{getPromptIcon(prompt.title, idx)}</span>
                {isTranslate ? (
                  <div
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 500,
                      color: 'var(--foreground)',
                    }}
                  >
                    <span>Translate into: </span>
                    <span style={{ color: 'var(--muted-foreground)', fontWeight: 400 }}>{prompt.targetLang}</span>
                  </div>
                ) : (
                  <span
                    style={{
                      fontWeight: 500,
                      color: 'var(--foreground)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {prompt.title}
                  </span>
                )}
              </div>
              {isTranslate && <RightOutlined style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0, marginLeft: 4 }} />}
            </div>
          );
        })}
      </div>

      {/* Language flyout menu if hovered translate */}
      {hoveredTranslate && (
        <div
          onMouseEnter={() => setHoveredTranslate(true)}
          onMouseLeave={() => setHoveredTranslate(false)}
          className="np-fade-in"
          style={{
            position: 'absolute',
            left: '100%',
            top: 0,
            marginLeft: 8,
            width: 240,
            padding: 8,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 16,
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            zIndex: 50,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
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
                style={{
                  paddingLeft: 12,
                  paddingRight: 12,
                  paddingTop: 8,
                  paddingBottom: 8,
                  borderRadius: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                  background: isSelected || lang.name === 'English (India)' ? 'var(--muted)' : 'transparent',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--foreground)', fontSize: 12 }}>{lang.name}</span>
                <span style={{ fontSize: 10, color: 'var(--muted-foreground)', fontWeight: 400 }}>{lang.detail}</span>
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
          style={{
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 4,
            paddingBottom: 4,
            background: 'var(--muted)',
            borderRadius: 8,
            color: 'var(--muted-foreground)',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            flexShrink: 0,
            border: 'none',
          }}
          title="More prompts"
        >
          <EllipsisOutlined style={{ fontSize: 16, lineHeight: 1 }} />
        </button>
      )}
    </Popover>
  );
};
