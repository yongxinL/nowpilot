import React, { useState, useEffect } from 'react';
import { Tooltip, Popover, theme } from 'antd';
import { QuestionCircleOutlined, CloseOutlined, CheckOutlined } from '@ant-design/icons';
import { PromptItem, PromptCategory } from '../../types';
import { PromptIcon, PROMPT_ICON_NAMES } from './PromptIcon';

interface PromptModalProps {
  open: boolean;
  prompt?: PromptItem | null;
  onClose: () => void;
  onSave: (data: {
    title: string;
    content: string;
    usedIn: PromptCategory[];
    icon: string;
  }) => void;
}

const CATEGORY_OPTIONS: { key: PromptCategory; label: string }[] = [
  { key: 'Chat/Ask', label: 'Chat/Ask' },
  { key: 'Reading', label: 'Reading' },
  { key: 'Writing', label: 'Writing' },
];

export const PromptModal: React.FC<PromptModalProps> = ({
  open,
  prompt,
  onClose,
  onSave,
}) => {
  const { token } = theme.useToken();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [usedIn, setUsedIn] = useState<PromptCategory[]>(['Chat/Ask', 'Reading', 'Writing']);
  const [icon, setIcon] = useState<string>('Sparkles');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState('');
  const [error, setError] = useState<{ title?: string; content?: string }>({});

  const isSystemPrompt = Boolean(prompt && !prompt.isCustom);

  useEffect(() => {
    if (open) {
      if (prompt) {
        setTitle(prompt.title || '');
        setContent(prompt.content || '');
        setIcon(prompt.icon || 'Sparkles');
        if (prompt.usedIn && prompt.usedIn.length > 0) {
          setUsedIn(prompt.usedIn);
        } else {
          setUsedIn([prompt.category || 'Chat/Ask']);
        }
      } else {
        setTitle('');
        setContent('');
        setUsedIn(['Chat/Ask', 'Reading', 'Writing']);
        setIcon('Sparkles');
      }
      setError({});
      setIconPickerOpen(false);
      setIconSearch('');
    }
  }, [open, prompt]);

  if (!open) return null;

  const isAllSelected = CATEGORY_OPTIONS.every((c) => usedIn.includes(c.key));

  const handleToggleAll = () => {
    if (isAllSelected) {
      setUsedIn([]);
    } else {
      setUsedIn(CATEGORY_OPTIONS.map((c) => c.key));
    }
  };

  const handleToggleCategory = (cat: PromptCategory) => {
    if (usedIn.includes(cat)) {
      setUsedIn(usedIn.filter((c) => c !== cat));
    } else {
      setUsedIn([...usedIn, cat]);
    }
  };

  const handleSave = () => {
    if (!isSystemPrompt) {
      const newErrors: { title?: string; content?: string } = {};
      if (!title.trim()) {
        newErrors.title = 'Prompt name is required';
      }
      if (!content.trim()) {
        newErrors.content = 'Prompt content is required';
      }

      if (Object.keys(newErrors).length > 0) {
        setError(newErrors);
        return;
      }
    }

    onSave({
      title: title.trim(),
      content: content.trim(),
      usedIn: usedIn.length > 0 ? usedIn : ['Chat/Ask'],
      icon,
    });
    onClose();
  };

  const filteredIcons = PROMPT_ICON_NAMES.filter((name) =>
    name.toLowerCase().includes(iconSearch.toLowerCase())
  );

  return (
    <div
      className="np-fade-in"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        className="np-scale-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: token.colorBgContainer,
          borderRadius: 24,
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          border: `1px solid ${token.colorBorderSecondary}`,
          width: '100%',
          maxWidth: 490,
          overflow: 'hidden',
          transition: 'all 200ms ease',
          transform: 'translate(0,0)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 28px 8px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: token.colorText, margin: 0 }}>
            {prompt ? 'Edit Prompt' : 'New Prompt'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: token.colorFillQuaternary,
              color: token.colorTextTertiary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            <CloseOutlined style={{ fontSize: 12 }} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px 28px', display: 'flex', flexDirection: 'column', gap: 20, maxHeight: '78vh', overflowY: 'auto' }}>
          {/* Prompt Name */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: token.colorText, marginBottom: 6 }}>
              {!isSystemPrompt && <span style={{ color: token.colorError, marginRight: 4 }}>*</span>}
              Prompt Name
            </label>
            {isSystemPrompt ? (
              <div style={{ fontSize: 14, color: token.colorTextTertiary, userSelect: 'text', padding: '2px 0', fontWeight: 400 }}>
                {title}
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Name your prompt"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error.title) setError((prev) => ({ ...prev, title: undefined }));
                  }}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: `1px solid ${error.title ? token.colorError : token.colorBorderSecondary}`,
                    fontSize: 14,
                    color: token.colorText,
                    background: token.colorBgContainer,
                    outline: 'none',
                    transition: 'all 150ms ease',
                  }}
                />
                {error.title && <p style={{ color: token.colorError, fontSize: 12, marginTop: 4 }}>{error.title}</p>}
              </>
            )}
          </div>

          {/* Prompt Content */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <label style={{ fontSize: 14, fontWeight: 700, color: token.colorText }}>
                {!isSystemPrompt && <span style={{ color: token.colorError, marginRight: 4 }}>*</span>}
                Prompt Content
              </label>
              <Tooltip title="Prompt templates can include context or instructions for AI response generation.">
                <QuestionCircleOutlined style={{ color: token.colorTextTertiary, fontSize: 12, cursor: 'help' }} />
              </Tooltip>
            </div>
            {isSystemPrompt ? (
              <div style={{ fontSize: 14, color: token.colorTextTertiary, userSelect: 'text', lineHeight: 1.625, whiteSpace: 'pre-wrap', padding: '2px 0', fontWeight: 400 }}>
                {content}
              </div>
            ) : (
              <>
                <textarea
                  placeholder="Paste or input content here"
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    if (error.content) setError((prev) => ({ ...prev, content: undefined }));
                  }}
                  rows={6}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: `1px solid ${error.content ? token.colorError : token.colorBorderSecondary}`,
                    fontSize: 14,
                    color: token.colorText,
                    background: token.colorBgContainer,
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'var(--font-sans)',
                    lineHeight: 1.625,
                    transition: 'all 150ms ease',
                  }}
                />
                {error.content && <p style={{ color: token.colorError, fontSize: 12, marginTop: 4 }}>{error.content}</p>}
              </>
            )}
          </div>

          {/* Used in */}
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: token.colorText, marginBottom: 12 }}>
              Used in
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
              {/* All Checkbox */}
              <button
                type="button"
                onClick={handleToggleAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  color: token.colorTextSecondary,
                  cursor: 'pointer',
                  userSelect: 'none',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                }}
              >
                <div
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 150ms ease',
                    background: isAllSelected ? '#6035f5' : token.colorBgContainer,
                    color: isAllSelected ? '#ffffff' : token.colorText,
                    border: isAllSelected ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                    boxShadow: isAllSelected ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  }}
                >
                  {isAllSelected && <CheckOutlined style={{ fontSize: 10 }} />}
                </div>
                <span style={{ fontWeight: 500 }}>All</span>
              </button>

              {/* Individual Categories */}
              {CATEGORY_OPTIONS.map((cat) => {
                const checked = usedIn.includes(cat.key);
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleToggleCategory(cat.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 14,
                      color: token.colorTextSecondary,
                      cursor: 'pointer',
                      userSelect: 'none',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 150ms ease',
                        background: checked ? '#6035f5' : token.colorBgContainer,
                        color: checked ? '#ffffff' : token.colorText,
                        border: checked ? 'none' : `1px solid ${token.colorBorderSecondary}`,
                        boxShadow: checked ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                      }}
                    >
                      {checked && <CheckOutlined style={{ fontSize: 10 }} />}
                    </div>
                    <span style={{ fontWeight: 500 }}>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Icon Selection (Only for custom/new prompts) */}
          {!isSystemPrompt && (
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 700, color: token.colorText, marginBottom: 8 }}>
                Icon
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  background: token.colorFillQuaternary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: token.colorTextSecondary,
                  boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                }}>
                  <PromptIcon name={icon} size={18} />
                </div>

                <Popover
                  open={iconPickerOpen}
                  onOpenChange={setIconPickerOpen}
                  trigger="click"
                  placement="bottomLeft"
                  content={
                    <div style={{ width: 256, padding: 8 }}>
                      <input
                        type="text"
                        placeholder="Search icon..."
                        value={iconSearch}
                        onChange={(e) => setIconSearch(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '6px 10px',
                          marginBottom: 8,
                          borderRadius: 8,
                          border: `1px solid ${token.colorBorderSecondary}`,
                          fontSize: 12,
                          background: token.colorFillQuaternary,
                          color: token.colorText,
                          outline: 'none',
                        }}
                        autoFocus
                      />
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(6, 1fr)',
                        gap: 6,
                        maxHeight: 192,
                        overflowY: 'auto',
                        padding: 4,
                      }}>
                        {filteredIcons.map((iconName) => {
                          const isActive = icon.toLowerCase() === iconName.toLowerCase();
                          return (
                            <button
                              key={iconName}
                              type="button"
                              onClick={() => {
                                setIcon(iconName);
                                setIconPickerOpen(false);
                              }}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 8,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 150ms ease',
                                cursor: 'pointer',
                                background: isActive ? '#6035f5' : 'transparent',
                                color: isActive ? '#ffffff' : token.colorTextSecondary,
                                border: 'none',
                              }}
                              title={iconName}
                            >
                              <PromptIcon name={iconName} size={16} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  }
                >
                  <button
                    type="button"
                    style={{
                      padding: '8px 16px',
                      background: token.colorFillQuaternary,
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      color: token.colorTextSecondary,
                      transition: 'all 150ms ease',
                      cursor: 'pointer',
                      border: 'none',
                    }}
                  >
                    Change
                  </button>
                </Popover>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 12,
          padding: '18px 28px',
          background: token.colorFillQuaternary,
          borderTop: `1px solid ${token.colorBorderSecondary}`,
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: 12,
              background: token.colorFillQuaternary,
              color: token.colorTextSecondary,
              fontSize: 14,
              fontWeight: 500,
              transition: 'all 150ms ease',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              padding: '8px 24px',
              borderRadius: 12,
              background: '#6035f5',
              color: '#ffffff',
              fontSize: 14,
              fontWeight: 500,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 150ms ease',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

