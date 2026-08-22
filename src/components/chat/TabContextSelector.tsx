import React, { useState, useRef } from 'react';
import { Popover, Tooltip } from 'antd';
import {
  FolderAddOutlined,
  CompassOutlined,
  CheckCircleFilled,
  GithubOutlined,
  GlobalOutlined,
  RightOutlined,
  LeftOutlined,
  LinkOutlined,
  PaperClipOutlined,
  PictureOutlined,
  DesktopOutlined,
} from '@ant-design/icons';
import { TabItem, Attachment } from '../../types';

interface TabContextSelectorProps {
  availableTabs: TabItem[];
  onToggleTab: (tabId: string) => void;
  onSelectScreenCut: () => void;
  onAddAttachment: (attachment: Attachment) => void;
  onOpenPromptManager?: () => void;
  hideTabs?: boolean;
}

export const TabContextSelector: React.FC<TabContextSelectorProps> = ({
  availableTabs,
  onToggleTab,
  onSelectScreenCut,
  onAddAttachment,
  onOpenPromptManager,
  hideTabs = false,
}) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'main' | 'tabs'>('main');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setView('main');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddAttachment({
        id: 'doc_' + Date.now(),
        type: 'document',
        title: file.name,
        content: `[Attached Document: ${file.name}]`,
      });
      setOpen(false);
      setView('main');
    }
    if (e.target) e.target.value = '';
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        onAddAttachment({
          id: 'img_' + Date.now(),
          type: 'image',
          title: file.name,
          thumbnail: reader.result as string,
        });
        setOpen(false);
        setView('main');
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  const popoverContent = (
    <div
      style={{
        width: 288,
        padding: 6,
        fontSize: 12,
        color: 'var(--foreground)',
        userSelect: 'none',
      }}
    >
      {view === 'main' ? (
        <div>
          {/* Header */}
          <div
            style={{
              fontWeight: 600,
              color: 'var(--foreground)',
              fontSize: 12,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 2,
              paddingBottom: 8,
            }}
          >
            Add context
          </div>

          {/* Add tabs Header / Button */}
          {!hideTabs && (
            <>
              <button
                type="button"
                onClick={() => setView('tabs')}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingLeft: 8,
                  paddingRight: 8,
                  paddingTop: 6,
                  paddingBottom: 6,
                  borderRadius: 8,
                  textAlign: 'left',
                  fontWeight: 500,
                  color: 'var(--foreground)',
                  cursor: 'pointer',
                  transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                  background: 'transparent',
                  border: 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <LinkOutlined style={{ color: 'var(--muted-foreground)', fontSize: 14 }} />
                  <span style={{ fontWeight: 500 }}>Add tabs</span>
                </div>
                <RightOutlined style={{ fontSize: 10, color: 'var(--muted-foreground)' }} />
              </button>

              {/* Preview top 3 tabs */}
              {availableTabs.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    marginTop: 4,
                    marginBottom: 4,
                    paddingLeft: 4,
                  }}
                >
                  {availableTabs.slice(0, 3).map(tab => {
                    const isGithub = tab.url?.includes('github');
                    return (
                      <div
                        key={tab.id}
                        onClick={() => onToggleTab(tab.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingLeft: 8,
                          paddingRight: 8,
                          paddingTop: 6,
                          paddingBottom: 6,
                          borderRadius: 8,
                          cursor: 'pointer',
                          transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                          fontSize: 12,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            paddingRight: 8,
                          }}
                        >
                          {isGithub ? (
                            <GithubOutlined style={{ fontSize: 14, color: 'var(--muted-foreground)', flexShrink: 0 }} />
                          ) : (
                            <GlobalOutlined style={{ fontSize: 14, color: '#3b82f6', flexShrink: 0 }} />
                          )}
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: 'var(--muted-foreground)',
                              fontWeight: 400,
                            }}
                          >
                            {tab.title}
                          </span>
                          {tab.isCurrent && (
                            <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>• Current tab</span>
                          )}
                        </div>
                        {tab.selected ? (
                          <CheckCircleFilled style={{ color: '#3b82f6', fontSize: 14, flexShrink: 0 }} />
                        ) : (
                          <div
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: 9999,
                              border: '1px solid var(--border)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div
                style={{
                  height: 1,
                  background: 'var(--border)',
                  marginTop: 6,
                  marginBottom: 6,
                }}
              />
            </>
          )}

          {/* Attach files */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 6,
              paddingBottom: 6,
              borderRadius: 8,
              textAlign: 'left',
              fontWeight: 500,
              color: 'var(--foreground)',
              cursor: 'pointer',
              transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
              fontSize: 12,
              background: 'transparent',
              border: 'none',
            }}
          >
            <PaperClipOutlined style={{ color: 'var(--muted-foreground)', fontSize: 14 }} />
            <span>Attach files</span>
          </button>

          {/* Add image */}
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 6,
              paddingBottom: 6,
              borderRadius: 8,
              textAlign: 'left',
              fontWeight: 500,
              color: 'var(--foreground)',
              cursor: 'pointer',
              transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
              fontSize: 12,
              background: 'transparent',
              border: 'none',
            }}
          >
            <PictureOutlined style={{ color: 'var(--muted-foreground)', fontSize: 14 }} />
            <span>Add image</span>
          </button>

          {/* Select from screen */}
          <button
            type="button"
            onClick={() => {
              onSelectScreenCut();
              setOpen(false);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 6,
              paddingBottom: 6,
              borderRadius: 8,
              textAlign: 'left',
              fontWeight: 500,
              color: 'var(--foreground)',
              cursor: 'pointer',
              transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
              fontSize: 12,
              background: 'transparent',
              border: 'none',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <DesktopOutlined style={{ color: 'var(--muted-foreground)', fontSize: 14 }} />
              <span>Select from screen</span>
            </div>
            <span
              style={{
                background: '#2563eb',
                color: '#ffffff',
                fontSize: 9,
                fontWeight: 700,
                paddingLeft: 6,
                paddingRight: 6,
                paddingTop: 2,
                paddingBottom: 2,
                borderRadius: 2,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              NEW
            </span>
          </button>

          <div
            style={{
              height: 1,
              background: 'var(--border)',
              marginTop: 6,
              marginBottom: 6,
            }}
          />

          {/* Browse skills - Moved to bottom */}
          <button
            type="button"
            onClick={() => {
              if (onOpenPromptManager) {
                onOpenPromptManager();
              }
              setOpen(false);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              paddingLeft: 8,
              paddingRight: 8,
              paddingTop: 6,
              paddingBottom: 6,
              borderRadius: 8,
              textAlign: 'left',
              fontWeight: 500,
              color: 'var(--foreground)',
              cursor: 'pointer',
              transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
              fontSize: 12,
              background: 'transparent',
              border: 'none',
            }}
          >
            <CompassOutlined style={{ color: 'var(--muted-foreground)', fontSize: 14 }} />
            <span>Browse skills</span>
          </button>
        </div>
      ) : (
        /* Tabs Sub-View */
        <div>
          {/* Back Button Header */}
          <div style={{ marginBottom: 8 }}>
            <button
              type="button"
              onClick={() => setView('main')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 4,
                paddingBottom: 4,
                background: 'var(--muted)',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--foreground)',
                cursor: 'pointer',
                transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                border: 'none',
              }}
            >
              <LeftOutlined style={{ fontSize: 10 }} />
              <span>Back</span>
            </button>
          </div>

          {/* List of All Tabs */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              maxHeight: 256,
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            {availableTabs.map(tab => {
              const isGithub = tab.url?.includes('github');
              return (
                <div
                  key={tab.id}
                  onClick={() => onToggleTab(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingLeft: 8,
                    paddingRight: 8,
                    paddingTop: 6,
                    paddingBottom: 6,
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      paddingRight: 8,
                    }}
                  >
                    {isGithub ? (
                      <GithubOutlined style={{ fontSize: 14, color: 'var(--muted-foreground)', flexShrink: 0 }} />
                    ) : (
                      <GlobalOutlined style={{ fontSize: 14, color: '#3b82f6', flexShrink: 0 }} />
                    )}
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: 'var(--muted-foreground)',
                        fontWeight: 400,
                      }}
                    >
                      {tab.title}
                    </span>
                    {tab.isCurrent && (
                      <span style={{ fontSize: 10, color: 'var(--muted-foreground)', flexShrink: 0 }}>• Current tab</span>
                    )}
                  </div>
                  {tab.selected ? (
                    <CheckCircleFilled style={{ color: '#3b82f6', fontSize: 14, flexShrink: 0 }} />
                  ) : (
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 9999,
                        border: '1px solid var(--border)',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".doc,.docx,.txt,.md,.pdf,.json,.csv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageChange}
      />
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      placement="top"
      overlayClassName="tab-context-popover"
    >
      <Tooltip title="Attach">
        <button
          type="button"
          style={{
            padding: 6,
            borderRadius: 8,
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'transparent',
            border: 'none',
          }}
        >
          <PaperClipOutlined style={{ fontSize: 16 }} />
        </button>
      </Tooltip>
    </Popover>
  );
};
