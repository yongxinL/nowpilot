import React, { useState } from 'react';
import { Drawer, Input, Dropdown } from 'antd';
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
        size={isStandalone ? 380 : '70%'}
        getContainer={false}
        closeIcon={null}
        styles={{
          wrapper: {
            borderTopLeftRadius: '24px',
            borderBottomLeftRadius: isStandalone ? '24px' : '0px',
            borderTopRightRadius: isStandalone ? '0px' : '24px',
            borderBottomRightRadius: '0px',
            overflow: 'hidden',
            boxShadow: isStandalone
              ? '-10px 0 25px -5px rgba(0, 0, 0, 0.1), -8px 0 10px -6px rgba(0, 0, 0, 0.1)'
              : '0 -10px 25px -5px rgba(0, 0, 0, 0.1), 0 -8px 10px -6px rgba(0, 0, 0, 0.1)',
          },
          section: {
            borderTopLeftRadius: '24px',
            borderBottomLeftRadius: isStandalone ? '24px' : '0px',
            borderTopRightRadius: isStandalone ? '0px' : '24px',
            borderBottomRightRadius: '0px',
            overflow: 'hidden',
          },
          body: {
            padding: '12px 18px 20px',
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
          },
          mask: {
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            backdropFilter: 'blur(2px)',
          },
        }}
        className="chat-history-drawer bg-white dark:bg-zinc-900"
      >
        {/* Top Handle Bar for Bottom Sheet */}
        {!isStandalone && (
          <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-full mx-auto mb-2 shrink-0 cursor-pointer" onClick={onClose} />
        )}

        {/* Drawer Header */}
        <div className="flex items-center justify-between pb-2.5 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 m-0">
              Chat history
            </h3>
            <span className="text-xs text-zinc-400 font-normal">
              ({filteredSessions.length})
            </span>
          </div>
          <button
            onClick={() => setShowDeleteAllModal(true)}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
            title="Delete all conversations"
          >
            <DeleteOutlined className="text-sm" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-4 text-xs font-semibold mb-2.5 border-b border-zinc-100 dark:border-zinc-800 pb-2 flex-shrink-0">
          <button
            onClick={() => setActiveTab('All')}
            className={`pb-1 relative cursor-pointer transition-colors ${
              activeTab === 'All'
                ? 'text-blue-600 dark:text-blue-400 font-bold border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('Starred')}
            className={`pb-1 relative cursor-pointer transition-colors ${
              activeTab === 'Starred'
                ? 'text-blue-600 dark:text-blue-400 font-bold border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            Starred
          </button>
        </div>

        {/* Search Input */}
        <div className="mb-3 flex-shrink-0">
          <Input
            prefix={<SearchOutlined className="text-zinc-400 mr-1.5" />}
            placeholder="Search conversations"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            allowClear
            className="bg-zinc-100/80 dark:bg-zinc-800/60 border-none rounded-xl py-1.5 text-xs focus:bg-white dark:focus:bg-zinc-800"
          />
        </div>

        {/* History List Grouped by Time */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
          {(['Today', 'Yesterday', 'This Week', 'This Month', 'Older'] as HistoryGroup[]).map(groupKey => {
            const groupSessions = grouped[groupKey];
            if (!groupSessions || groupSessions.length === 0) return null;

            return (
              <div key={groupKey}>
                <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 mb-1 px-1">
                  {groupKey}
                </div>
                <div className="space-y-1">
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
                        icon: <DeleteOutlined className="text-red-500" />,
                        label: <span className="text-red-500">Delete</span>,
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
                        className={`group relative p-2 rounded-xl cursor-pointer transition-all flex items-center justify-between ${
                          isActive
                            ? 'bg-zinc-100 dark:bg-zinc-800/90 shadow-xs'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0 pr-2">
                          <MessageOutlined className="text-zinc-400 text-xs shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                              {session.title}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-zinc-400">
                            {formatSessionTime(session.updatedAt)}
                          </span>

                          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                            <button
                              type="button"
                              onClick={e => e.stopPropagation()}
                              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 cursor-pointer transition-colors"
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
                            className="p-1 cursor-pointer transition-colors text-zinc-400 hover:text-amber-500"
                            title={session.isStarred ? "Starred" : "Star"}
                          >
                            {session.isStarred ? (
                              <StarFilled className="text-amber-500" />
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
            <div className="text-center py-8 text-zinc-400 text-xs">
              No history found
            </div>
          )}
        </div>
      </Drawer>

      {/* 1. Delete single conversation confirmation modal */}

      {deletingSessionId && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-xs w-full shadow-2xl border border-zinc-200/80 dark:border-zinc-800 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-11 h-11 rounded-full bg-red-500 text-white flex items-center justify-center mx-auto mb-3 text-xl font-bold shadow-md shadow-red-500/20">
              !
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              Delete this conversation?
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">
              This action cannot be undone.
            </p>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setDeletingSessionId(null)}
                className="flex-1 py-2.5 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSession(deletingSessionId);
                  setDeletingSessionId(null);
                }}
                className="flex-1 py-2.5 px-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Delete all conversations confirmation modal */}
      {showDeleteAllModal && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 max-w-xs w-full shadow-2xl border border-zinc-200/80 dark:border-zinc-800 text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="w-11 h-11 rounded-full bg-red-500 text-white flex items-center justify-center mx-auto mb-3 text-xl font-bold shadow-md shadow-red-500/20">
              !
            </div>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
              Delete all
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
              This action cannot be undone.
            </p>
            <label className="flex items-center justify-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 mb-5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeStarred}
                onChange={e => setIncludeStarred(e.target.checked)}
                className="w-4 h-4 rounded border-zinc-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
              />
              <span>Include Starred</span>
            </label>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteAllModal(false)}
                className="flex-1 py-2.5 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearAll(includeStarred);
                  setShowDeleteAllModal(false);
                }}
                className="flex-1 py-2.5 px-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
              >
                Delete all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Edit title modal with 200 char limit */}
      {editingSession && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-zinc-200/80 dark:border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3">
              Edit title
            </h3>
            <div className="relative flex items-center border border-violet-400 dark:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20 rounded-xl px-3 py-2 bg-white dark:bg-zinc-800 shadow-xs mb-5">
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
                className="w-full text-xs text-zinc-800 dark:text-zinc-100 bg-transparent outline-none pr-14"
              />
              <span className="absolute right-3 text-xs text-zinc-400 font-medium select-none pointer-events-none">
                {editingTitle.length} / 200
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setEditingSession(null)}
                className="flex-1 py-2.5 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
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
                className="flex-1 py-2.5 px-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
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
