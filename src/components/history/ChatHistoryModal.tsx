import React, { useState } from 'react';
import { Drawer, Input, Dropdown, theme } from 'antd';
import {
  SearchOutlined,
  ExportOutlined,
  EditOutlined,
  DeleteOutlined,
  MessageOutlined,
  EllipsisOutlined,
  StarOutlined,
  StarFilled,
} from '@ant-design/icons';
import { ChatSession, HistoryGroup } from '../../types';

interface ChatHistoryModalProps {
  open: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onToggleStar: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onUpdateTitle: (id: string, newTitle: string) => void;
  onClearAll: (includeStarred?: boolean) => void;
  onStartExport?: (sessionId: string) => void;
  isStandalone?: boolean;
}

export const ChatHistoryModal: React.FC<ChatHistoryModalProps> = ({
  open,
  onClose,
  sessions,
  activeSessionId,
  onSelectSession,
  onToggleStar,
  onDeleteSession,
  onUpdateTitle,
  onClearAll,
  onStartExport,
  isStandalone = false,
}) => {
  const { token } = theme.useToken();
  const [activeTab, setActiveTab] = useState<'All' | 'Starred'>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [includeStarred, setIncludeStarred] = useState(false);

  const [editingSession, setEditingSession] = useState<{ id: string; title: string } | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const filteredSessions = sessions.filter(s => {
    if (s.messages.length === 0) return false;
    if (activeTab === 'Starred' && !s.isStarred) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return s.title.toLowerCase().includes(q) || s.preview.toLowerCase().includes(q);
    }
    return true;
  });

  const grouped: Record<HistoryGroup, ChatSession[]> = {
    'Today': filteredSessions.filter(s => s.group === 'Today'),
    'Yesterday': filteredSessions.filter(s => s.group === 'Yesterday'),
    'This Week': filteredSessions.filter(s => s.group === 'This Week'),
    'This Month': filteredSessions.filter(s => s.group === 'This Month'),
    'Older': filteredSessions.filter(s => s.group === 'Older'),
  };

  const openEditTitleModal = (session: ChatSession) => {
    setEditingSession({ id: session.id, title: session.title });
    setEditingTitle(session.title.slice(0, 200));
  };

  const handleSessionClick = (session: ChatSession) => {
    onSelectSession(session.id);
    onClose();
  };

  const formatSessionTime = (timestamp?: number) => {
    if (!timestamp) return '11:20 AM';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        placement={isStandalone ? 'right' : 'bottom'}
        size={isStandalone ? 380 : '72%'}
        getContainer={false}
        closeIcon={null}
        styles={{
          wrapper: {
            borderTopLeftRadius: isStandalone ? '0px' : '20px',
            borderTopRightRadius: isStandalone ? '0px' : '20px',
            borderBottomLeftRadius: isStandalone ? '16px' : '0px',
            borderBottomRightRadius: '0px',
            overflow: 'hidden',
            boxShadow: isStandalone
              ? '-4px 0 20px rgba(0, 0, 0, 0.08)'
              : '0 -4px 20px rgba(0, 0, 0, 0.08)',
            borderTop: isStandalone ? 'none' : '1px solid var(--border)',
            borderLeft: isStandalone ? '1px solid var(--border)' : 'none',
            background: token.colorBgContainer,
            height: isStandalone ? '100%' : '72%',
            maxHeight: isStandalone ? '100%' : '72%',
            top: isStandalone ? 0 : undefined,
            bottom: 0,
            right: 0,
          },
          section: {
            borderTopLeftRadius: isStandalone ? '0px' : '20px',
            borderTopRightRadius: isStandalone ? '0px' : '20px',
            borderBottomLeftRadius: isStandalone ? '16px' : '0px',
            borderBottomRightRadius: '0px',
            background: token.colorBgContainer,
            overflow: 'hidden',
            height: '100%',
          },
          body: {
            padding: isStandalone ? '20px 20px 24px' : '10px 18px 20px',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
            background: token.colorBgContainer,
          },
          mask: {
            backgroundColor: isStandalone ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.25)',
          },
        }}
        className={isStandalone ? 'chat-history-drawer-standalone' : 'chat-history-drawer-sidepanel'}
      >
        {/* Top Handle Bar for Bottom Sheet (Side Panel only) */}
        {!isStandalone && (
          <div
            style={{
              width: 36,
              height: 4,
              background: 'var(--border)',
              borderRadius: 9999,
              marginLeft: 'auto',
              marginRight: 'auto',
              marginTop: 0,
              marginBottom: 10,
              flexShrink: 0,
              cursor: 'pointer',
            }}
            onClick={onClose}
          />
        )}

        {/* Drawer Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 10,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: token.colorText,
                margin: 0,
              }}
            >
              Chat history
            </h3>
            <span
              style={{
                fontSize: 12,
                color: token.colorTextTertiary,
                fontWeight: 400,
              }}
            >
              ({filteredSessions.length})
            </span>
          </div>
          <button
            onClick={() => setShowDeleteAllModal(true)}
            style={{
              padding: 6,
              borderRadius: 8,
              color: token.colorTextTertiary,
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
            }}
            title="Delete all conversations"
          >
            <DeleteOutlined style={{ fontSize: 14 }} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: 12,
            fontWeight: 600,
            marginBottom: 10,
            borderBottom: '1px solid var(--border)',
            paddingBottom: 8,
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setActiveTab('All')}
            style={{
              paddingBottom: 4,
              position: 'relative',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              ...(activeTab === 'All'
                ? {
                    color: token.colorInfo,
                    fontWeight: 700,
                    borderBottom: `2px solid ${token.colorInfo}`,
                  }
                : {
                    color: token.colorTextTertiary,
                  }),
            }}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('Starred')}
            style={{
              paddingBottom: 4,
              position: 'relative',
              cursor: 'pointer',
              background: 'transparent',
              border: 'none',
              ...(activeTab === 'Starred'
                ? {
                    color: token.colorInfo,
                    fontWeight: 700,
                    borderBottom: `2px solid ${token.colorInfo}`,
                  }
                : {
                    color: token.colorTextTertiary,
                  }),
            }}
          >
            Starred
          </button>
        </div>

        {/* Search Input */}
        <div style={{ marginBottom: 12, flexShrink: 0 }}>
          <Input
            prefix={<SearchOutlined style={{ color: 'var(--muted-foreground)', marginRight: 6 }} />}
            placeholder="Search conversations"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            allowClear
          />
        </div>

        {/* History List Grouped by Time */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            paddingRight: 4,
            minHeight: 0,
          }}
        >
          {(['Today', 'Yesterday', 'This Week', 'This Month', 'Older'] as HistoryGroup[]).map(groupKey => {
            const groupSessions = grouped[groupKey];
            if (!groupSessions || groupSessions.length === 0) return null;

            return (
              <div key={groupKey}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: token.colorTextTertiary,
                    marginBottom: 4,
                    paddingLeft: 4,
                    paddingRight: 4,
                  }}
                >
                  {groupKey}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {groupSessions.map(session => {
                    const isActive = session.id === activeSessionId;

                    const menuItems = [
                      {
                        key: 'export',
                        icon: <ExportOutlined />,
                        label: 'Export',
                        onClick: (info: any) => {
                          info?.domEvent?.stopPropagation();
                          if (onStartExport) {
                            onStartExport(session.id);
                            onClose();
                          }
                        },
                      },
                      {
                        key: 'edit',
                        icon: <EditOutlined />,
                        label: 'Edit title',
                        onClick: (info: any) => {
                          info?.domEvent?.stopPropagation();
                          openEditTitleModal(session);
                        },
                      },
                      {
                        key: 'delete',
                        icon: <DeleteOutlined style={{ color: token.colorError }} />,
                        label: <span style={{ color: token.colorError }}>Delete</span>,
                        onClick: (info: any) => {
                          info?.domEvent?.stopPropagation();
                          setDeletingSessionId(session.id);
                        },
                      },
                    ];

                    return (
                      <div
                        key={session.id}
                        onClick={() => handleSessionClick(session)}
                        style={{
                          position: 'relative',
                          padding: 8,
                          borderRadius: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          ...(isActive
                            ? {
                                background: 'var(--muted)',
                                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                              }
                            : {}),
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            flex: 1,
                            minWidth: 0,
                            paddingRight: 8,
                          }}
                        >
                          <MessageOutlined
                            style={{
                              color: 'var(--muted-foreground)',
                              fontSize: 12,
                              flexShrink: 0,
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 500,
                                color: token.colorText,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {session.title}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            flexShrink: 0,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              color: 'var(--muted-foreground)',
                            }}
                          >
                            {formatSessionTime(session.updatedAt)}
                          </span>

                          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                            <button
                              type="button"
                              onClick={e => e.stopPropagation()}
                              style={{
                                padding: 4,
                                color: token.colorTextTertiary,
                                borderRadius: 6,
                                cursor: 'pointer',
                                background: 'transparent',
                                border: 'none',
                              }}
                              title="More options"
                            >
                              <EllipsisOutlined />
                            </button>
                          </Dropdown>

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              onToggleStar(session.id);
                            }}
                            style={{
                              padding: 4,
                              cursor: 'pointer',
                              color: token.colorTextTertiary,
                              background: 'transparent',
                              border: 'none',
                            }}
                            title={session.isStarred ? "Starred" : "Star"}
                          >
                            {session.isStarred ? (
                              <StarFilled style={{ color: '#f59e0b' }} />
                            ) : (
                              <StarOutlined />
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filteredSessions.length === 0 && (
            <div
              style={{
                textAlign: 'center',
                paddingTop: 32,
                paddingBottom: 32,
                color: token.colorTextTertiary,
                fontSize: 12,
              }}
            >
              No history found
            </div>
          )}
        </div>
      </Drawer>

      {/* 1. Delete single conversation confirmation modal */}

      {deletingSessionId && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            className="np-zoom-fade-in"
            style={{
              background: token.colorBgContainer,
              borderRadius: 16,
              padding: 24,
              maxWidth: 320,
              width: '100%',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              border: '1px solid var(--border)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 9999,
                background: token.colorError,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 'auto',
                marginRight: 'auto',
                marginBottom: 12,
                fontSize: 20,
                fontWeight: 700,
                boxShadow: '0 4px 8px rgba(0,0,0,0.12)',
              }}
            >
              !
            </div>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: token.colorText,
                marginBottom: 4,
              }}
            >
              Delete this conversation?
            </h3>
            <p
              style={{
                fontSize: 12,
                color: token.colorTextTertiary,
                marginBottom: 20,
              }}
            >
              This action cannot be undone.
            </p>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setDeletingSessionId(null)}
                style={{
                  flex: 1,
                  height: 36,
                  paddingLeft: 12,
                  paddingRight: 12,
                  background: 'var(--card)',
                  color: token.colorTextSecondary,
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  transition: 'all 150ms ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSession(deletingSessionId);
                  setDeletingSessionId(null);
                }}
                style={{
                  flex: 1,
                  height: 36,
                  paddingLeft: 12,
                  paddingRight: 12,
                  background: token.colorError,
                  color: '#ffffff',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 150ms ease',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Delete all conversations confirmation modal */}
      {showDeleteAllModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            className="np-zoom-fade-in"
            style={{
              background: token.colorBgContainer,
              borderRadius: 16,
              padding: 24,
              maxWidth: 320,
              width: '100%',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              border: '1px solid var(--border)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 9999,
                background: token.colorError,
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginLeft: 'auto',
                marginRight: 'auto',
                marginBottom: 12,
                fontSize: 20,
                fontWeight: 700,
                boxShadow: '0 4px 8px rgba(0,0,0,0.12)',
              }}
            >
              !
            </div>
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: token.colorText,
                marginBottom: 4,
              }}
            >
              Delete all
            </h3>
            <p
              style={{
                fontSize: 12,
                color: token.colorTextTertiary,
                marginBottom: 16,
              }}
            >
              This action cannot be undone.
            </p>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontSize: 12,
                color: token.colorTextSecondary,
                marginBottom: 20,
                cursor: 'pointer',
                userSelect: 'none',
              }}
            >
              <input
                type="checkbox"
                checked={includeStarred}
                onChange={e => setIncludeStarred(e.target.checked)}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: '1px solid #d4d4d8',
                  color: '#7c3aed',
                  cursor: 'pointer',
                }}
              />
              <span>Include Starred</span>
            </label>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                style={{
                  flex: 1,
                  height: 36,
                  paddingLeft: 12,
                  paddingRight: 12,
                  background: 'var(--card)',
                  color: token.colorTextSecondary,
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  transition: 'all 150ms ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearAll(includeStarred);
                  setShowDeleteAllModal(false);
                }}
                style={{
                  flex: 1,
                  height: 36,
                  paddingLeft: 12,
                  paddingRight: 12,
                  background: token.colorError,
                  color: '#ffffff',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 150ms ease',
                }}
              >
                Delete all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Edit title modal with 200 char limit */}
      {editingSession && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            zIndex: 2000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            className="np-zoom-fade-in"
            style={{
              background: token.colorBgContainer,
              borderRadius: 16,
              padding: 20,
              maxWidth: 384,
              width: '100%',
              boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
              border: '1px solid var(--border)',
            }}
          >
            <h3
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: token.colorText,
                marginBottom: 12,
              }}
            >
              Edit title
            </h3>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                border: '1px solid #a78bfa',
                borderRadius: 12,
                paddingLeft: 12,
                paddingRight: 12,
                paddingTop: 8,
                paddingBottom: 8,
                background: token.colorBgContainer,
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                marginBottom: 20,
              }}
            >
              <input
                type="text"
                maxLength={200}
                value={editingTitle}
                onChange={e => setEditingTitle(e.target.value)}
                autoFocus
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    if (editingTitle.trim()) {
                      onUpdateTitle(editingSession.id, editingTitle.trim());
                    }
                    setEditingSession(null);
                  }
                }}
                style={{
                  width: '100%',
                  fontSize: 12,
                  color: token.colorText,
                  background: 'transparent',
                  outline: 'none',
                  paddingRight: 56,
                  border: 'none',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  right: 12,
                  fontSize: 12,
                  color: token.colorTextTertiary,
                  fontWeight: 500,
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              >
                {editingTitle.length} / 200
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={() => setEditingSession(null)}
                style={{
                  flex: 1,
                  height: 36,
                  paddingLeft: 12,
                  paddingRight: 12,
                  background: 'var(--card)',
                  color: token.colorTextSecondary,
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  transition: 'all 150ms ease',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (editingTitle.trim()) {
                     onUpdateTitle(editingSession.id, editingTitle.trim());
                  }
                  setEditingSession(null);
                }}
                style={{
                  flex: 1,
                  height: 36,
                  paddingLeft: 12,
                  paddingRight: 12,
                  background: '#7c3aed',
                  color: '#ffffff',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                  transition: 'all 150ms ease',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
