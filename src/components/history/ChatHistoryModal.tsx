import React, { useState } from 'react';
import { Drawer, Input, Dropdown } from 'antd';
import {
  SearchOutlined,
  ExportOutlined,
  EditOutlined,
  DeleteOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { ChatSession, HistoryGroup } from '../../types';

const ActionDotsSvgIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 16 16">
    <path fill="currentColor" d="M4 8a1.333 1.333 0 1 1-2.667 0A1.333 1.333 0 0 1 4 8m5.333 0a1.333 1.333 0 1 1-2.666 0 1.333 1.333 0 0 1 2.666 0m4 1.333a1.333 1.333 0 1 0 0-2.666 1.333 1.333 0 0 0 0 2.666">
    </path>
  </svg>
);

const StarSvgIcon: React.FC<{ isStarred?: boolean }> = ({ isStarred }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 14 14" className={isStarred ? "text-violet-600 fill-violet-600" : "text-zinc-400"}>
    <path fill="currentColor" fillRule="evenodd" d="M6.339.897a1.46 1.46 0 0 1 1.322 0c.311.158.506.461.658.751.157.3.327.708.534 1.208l.257.615c.141.34.17.394.202.43a.4.4 0 0 0 .144.104c.043.019.103.03.47.06l.665.053c.539.043.98.078 1.314.135.322.055.67.147.917.393.33.33.481.798.408 1.258-.054.345-.282.623-.51.858-.237.242-.573.53-.984.881l-.506.434c-.28.24-.322.285-.346.325a.4.4 0 0 0-.055.169c-.004.047.003.107.089.466l.155.648c.125.527.228.956.277 1.292.047.324.068.683-.09.994a1.46 1.46 0 0 1-1.07.777c-.345.055-.68-.076-.974-.221-.304-.15-.68-.38-1.142-.663l-.57-.347c-.314-.192-.37-.218-.415-.228a.4.4 0 0 0-.178 0c-.046.01-.1.035-.416.228l-.568.347c-.462.282-.84.512-1.143.663-.293.145-.629.276-.973.221a1.46 1.46 0 0 1-1.07-.777c-.159-.311-.138-.67-.09-.994.049-.336.151-.765.277-1.292l.154-.648c.086-.359.093-.42.089-.466a.4.4 0 0 0-.055-.17c-.024-.04-.065-.084-.346-.324l-.506-.434c-.41-.352-.746-.639-.983-.881-.23-.235-.457-.513-.511-.858a1.46 1.46 0 0 1 .409-1.258c.246-.246.594-.338.917-.393.334-.057.774-.092 1.314-.135l.664-.053c.368-.03.428-.041.47-.06a.4.4 0 0 0 .144-.105c.032-.035.061-.088.203-.429l.256-.615c.207-.5.377-.908.534-1.208.152-.29.347-.593.658-.75m.846.936a.4.4 0 0 0-.37 0c-.005.004-.072.052-.204.302-.133.254-.285.619-.505 1.148l-.246.591-.023.056c-.103.25-.2.482-.361.665a1.5 1.5 0 0 1-.514.373c-.224.098-.474.117-.744.139l-.06.004-.638.051c-.572.046-.965.078-1.248.126-.28.048-.345.097-.35.1a.41.41 0 0 0-.115.353c.002.006.027.084.225.287.2.205.5.462.935.835l.486.416.046.04c.206.175.397.338.521.549.109.184.176.39.196.604.023.243-.035.487-.098.75l-.014.059-.149.622c-.133.559-.224.943-.266 1.226-.04.28-.015.358-.013.364a.41.41 0 0 0 .3.218c.006 0 .089 0 .342-.125.257-.127.594-.332 1.084-.631l.546-.334.051-.032c.231-.141.445-.272.684-.325a1.5 1.5 0 0 1 .634 0c.24.053.453.184.684.325l.051.032.547.334c.49.299.826.504 1.083.631.254.126.336.125.342.125a.41.41 0 0 0 .3-.218c.002-.005.028-.084-.013-.364-.042-.283-.133-.667-.266-1.226l-.148-.622-.014-.059c-.064-.263-.122-.507-.099-.75a1.5 1.5 0 0 1 .196-.604c.125-.21.315-.374.521-.55l.046-.038.486-.417c.436-.373.735-.63.936-.835.197-.203.222-.281.224-.287a.41.41 0 0 0-.114-.352c-.005-.004-.072-.053-.35-.1-.283-.049-.677-.08-1.248-.127l-.639-.05-.06-.005c-.27-.022-.52-.041-.744-.139a1.5 1.5 0 0 1-.513-.373c-.162-.183-.258-.415-.362-.665l-.023-.055-.246-.592c-.22-.53-.372-.894-.505-1.148-.132-.25-.199-.298-.204-.302" clipRule="evenodd"></path>
  </svg>
);

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
            onClick={() => setShowDeleteAllModal(true)}
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
                        className={`group relative p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between ${
                          isActive
                            ? 'bg-zinc-100 dark:bg-zinc-800/90 shadow-xs'
                            : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate mb-0.5">
                            {session.title}
                          </div>
                          <div className="text-[11px] text-zinc-400 truncate">
                            {session.preview}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                          <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                            <button
                              type="button"
                              onClick={e => e.stopPropagation()}
                              className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 cursor-pointer transition-colors"
                            >
                              <ActionDotsSvgIcon />
                            </button>
                          </Dropdown>

                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              onToggleStar(session.id);
                            }}
                            className="p-1 cursor-pointer transition-colors"
                          >
                            <StarSvgIcon isStarred={session.isStarred} />
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
