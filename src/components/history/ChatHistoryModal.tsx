import React, { useState } from 'react';
import { Drawer, Input, Dropdown, Typography, App } from 'antd';
import {
  SearchOutlined,
  StarOutlined,
  StarFilled,
  EllipsisOutlined,
  ExportOutlined,
  EditOutlined,
  DeleteOutlined,
  CloseOutlined,
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
  onClearAll: () => void;
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
}) => {
  const { message: antMessage } = App.useApp();
  const [activeTab, setActiveTab] = useState<'All' | 'Starred'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const filteredSessions = sessions.filter(s => {
    if (activeTab === 'Starred' && !s.isStarred) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return s.title.toLowerCase().includes(q) || s.preview.toLowerCase().includes(q);
    }
    return true;
  });

  const grouped: Record<HistoryGroup, ChatSession[]> = {
    'Today': filteredSessions.filter(s => s.group === 'Today'),
    'This Week': filteredSessions.filter(s => s.group === 'This Week'),
    'This Month': filteredSessions.filter(s => s.group === 'This Month'),
    'Older': filteredSessions.filter(s => s.group === 'Older'),
  };

  const handleExport = (session: ChatSession) => {
    const jsonStr = JSON.stringify(session, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nowpilot-chat-${session.id}.json`;
    a.click();
    antMessage.success('Chat history exported');
  };

  const handleSaveTitle = (id: string) => {
    if (editingTitle.trim()) {
      onUpdateTitle(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="bottom"
      size="70%"
      getContainer={false}
      closeIcon={null}
      styles={{
        wrapper: {
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          overflow: 'hidden',
          boxShadow: '0 -10px 25px -5px rgba(0, 0, 0, 0.1), 0 -8px 10px -6px rgba(0, 0, 0, 0.1)',
        },
        section: {
          borderTopLeftRadius: '24px',
          borderTopRightRadius: '24px',
          overflow: 'hidden',
        },
        body: {
          padding: '16px 18px 20px',
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
      {/* Drawer Header */}
      <div className="flex items-center justify-between pb-3 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 m-0">
            Chat history
          </h3>
          <span className="text-xs text-zinc-400 font-normal">
            ({filteredSessions.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <CloseOutlined className="text-sm" />
        </button>
      </div>

      {/* Filter Tabs & Delete All */}
      <div className="flex items-center justify-between mb-3 border-b border-zinc-100 dark:border-zinc-800 pb-2 flex-shrink-0">
        <div className="flex items-center gap-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('All')}
            className={`pb-1 relative cursor-pointer transition-colors ${
              activeTab === 'All'
                ? 'text-zinc-900 dark:text-zinc-100 font-bold border-b-2 border-zinc-900 dark:border-zinc-100'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveTab('Starred')}
            className={`pb-1 relative cursor-pointer transition-colors ${
              activeTab === 'Starred'
                ? 'text-zinc-900 dark:text-zinc-100 font-bold border-b-2 border-zinc-900 dark:border-zinc-100'
                : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
            }`}
          >
            Starred
          </button>
        </div>
        <button
          onClick={onClearAll}
          className="p-1.5 bg-zinc-100/80 dark:bg-zinc-800/80 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
          title="Clear all sessions"
        >
          <DeleteOutlined className="text-xs" />
        </button>
      </div>

      {/* Search Input */}
      <div className="mb-3 flex-shrink-0">
        <Input
          prefix={<SearchOutlined className="text-zinc-400 mr-1.5" />}
          placeholder="Search"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          allowClear
          className="bg-zinc-100/80 dark:bg-zinc-800/60 border-none rounded-xl py-1.5 text-xs focus:bg-white dark:focus:bg-zinc-800"
        />
      </div>

      {/* History List Grouped by Time */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-0">
        {(['Today', 'This Week', 'This Month', 'Older'] as HistoryGroup[]).map(groupKey => {
          const groupSessions = grouped[groupKey];
          if (!groupSessions || groupSessions.length === 0) return null;

          return (
            <div key={groupKey}>
              <div className="text-[11px] font-medium text-zinc-400 mb-1 px-1">
                {groupKey}
              </div>
              <div className="space-y-1">
                {groupSessions.map(session => {
                  const isActive = session.id === activeSessionId;
                  const isEditing = editingId === session.id;

                  const menuItems = [
                    {
                      key: 'export',
                      icon: <ExportOutlined />,
                      label: 'Export',
                      onClick: () => handleExport(session),
                    },
                    {
                      key: 'edit',
                      icon: <EditOutlined />,
                      label: 'Edit title',
                      onClick: () => {
                        setEditingId(session.id);
                        setEditingTitle(session.title);
                      },
                    },
                    {
                      key: 'delete',
                      icon: <DeleteOutlined className="text-red-500" />,
                      label: <span className="text-red-500">Delete</span>,
                      onClick: () => onDeleteSession(session.id),
                    },
                  ];

                  return (
                    <div
                      key={session.id}
                      onClick={() => {
                        if (!isEditing) {
                          onSelectSession(session.id);
                          onClose();
                        }
                      }}
                      className={`group relative p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between ${
                        isActive
                          ? 'bg-zinc-100 dark:bg-zinc-800/90 shadow-xs'
                          : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        {isEditing ? (
                          <Input
                            size="small"
                            value={editingTitle}
                            onChange={e => setEditingTitle(e.target.value)}
                            onPressEnter={() => handleSaveTitle(session.id)}
                            onBlur={() => handleSaveTitle(session.id)}
                            autoFocus
                            className="text-xs"
                          />
                        ) : (
                          <>
                            <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate mb-0.5">
                              {session.title}
                            </div>
                            <div className="text-[11px] text-zinc-400 truncate">
                              {session.preview}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                        <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                          <button
                            onClick={e => e.stopPropagation()}
                            className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 cursor-pointer transition-colors"
                          >
                            <EllipsisOutlined className="text-xs" />
                          </button>
                        </Dropdown>

                        <button
                          onClick={e => {
                            e.stopPropagation();
                            onToggleStar(session.id);
                          }}
                          className="p-1 text-zinc-400 hover:text-amber-500 cursor-pointer transition-colors"
                        >
                          {session.isStarred ? (
                            <StarFilled className="text-amber-400 text-xs" />
                          ) : (
                            <StarOutlined className="text-xs" />
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
  );
};

