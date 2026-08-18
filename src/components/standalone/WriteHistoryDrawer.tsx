import React, { useState, useMemo } from 'react';
import { Drawer, Input, Button, Tag, Empty, Modal, Popconfirm, Tooltip, Dropdown, App } from 'antd';
import {
  SearchOutlined,
  DeleteOutlined,
  EditOutlined,
  DownloadOutlined,
  CopyOutlined,
  FileTextOutlined,
  ClockCircleOutlined,
  CheckOutlined,
  CloseOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useExtensionStore } from '../../store/useExtensionStore';
import { WriteHistoryItem } from '../../types';

interface WriteHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  onSelectRecord: (record: WriteHistoryItem) => void;
}

export const WriteHistoryDrawer: React.FC<WriteHistoryDrawerProps> = ({
  open,
  onClose,
  onSelectRecord,
}) => {
  const { message: antMessage } = App.useApp();
  const { writeHistory, updateWriteHistoryItem, deleteWriteHistoryItem, clearWriteHistory } = useExtensionStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'write' | 'reply'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleInput, setEditTitleInput] = useState('');

  const filteredHistory = useMemo(() => {
    if (!writeHistory) return [];
    return writeHistory.filter((item) => {
      const matchesType = filterType === 'all' || item.type === filterType;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.input.toLowerCase().includes(q) ||
        item.output.toLowerCase().includes(q) ||
        item.format.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [writeHistory, filterType, searchQuery]);

  const handleStartEditTitle = (item: WriteHistoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditTitleInput(item.title);
  };

  const handleSaveTitle = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editTitleInput.trim()) {
      updateWriteHistoryItem(id, { title: editTitleInput.trim() });
      antMessage.success('Title updated');
    }
    setEditingId(null);
  };

  const handleExport = (item: WriteHistoryItem, format: 'md' | 'txt' | 'copy') => {
    const textContent = `# ${item.title}\n\n**Type**: ${item.type.toUpperCase()} (${item.format})\n**Model**: ${item.model}\n**Settings**: ${item.tone} - ${item.length} - ${item.language}\n**Created**: ${new Date(item.createdAt).toLocaleString()}\n\n---\n\n### Input\n${item.type === 'reply' ? `**Original Text**:\n${item.originalText || ''}\n\n**Idea**:\n${item.responseIdea || item.input}` : item.input}\n\n---\n\n### Generated Output\n${item.output}\n`;

    if (format === 'copy') {
      navigator.clipboard.writeText(item.output);
      antMessage.success('Generated text copied to clipboard');
      return;
    }

    const blob = new Blob([format === 'md' ? textContent : `${item.title}\n\n${item.output}`], {
      type: format === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.title.replace(/[^a-z0-9_-]/gi, '_')}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    antMessage.success(`Exported as .${format}`);
  };

  return (
    <Drawer
      title={
        <div className="flex items-center justify-between w-full pr-2">
          <div className="flex items-center gap-2">
            <ClockCircleOutlined className="text-violet-600 dark:text-violet-400" />
            <span className="font-bold text-base text-zinc-900 dark:text-zinc-100">Write History</span>
            <Tag color="purple" variant="filled" className="rounded-full px-2 py-0.5 text-xs font-semibold">
              {filteredHistory.length}
            </Tag>
          </div>
          {writeHistory && writeHistory.length > 0 && (
            <Popconfirm
              title="Clear all history?"
              description="Are you sure you want to delete all write and reply history?"
              onConfirm={() => {
                clearWriteHistory();
                antMessage.success('Write history cleared');
              }}
              okText="Yes, clear"
              cancelText="Cancel"
            >
              <button
                type="button"
                className="text-xs text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
              >
                Clear all
              </button>
            </Popconfirm>
          )}
        </div>
      }
      placement="right"
      size={440}
      open={open}
      onClose={onClose}
      styles={{
        header: {
          padding: '16px 20px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
        },
        body: {
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        },
      }}
    >
      {/* Search and Filters */}
      <div className="space-y-3">
        <Input
          placeholder="Search writing history..."
          prefix={<SearchOutlined className="text-zinc-400" />}
          allowClear
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="rounded-xl"
        />

        {/* Filter Badges */}
        <div className="flex items-center gap-1.5">
          {(['all', 'write', 'reply'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                filterType === t
                  ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300 shadow-2xs font-bold'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/70 dark:hover:bg-zinc-700'
              }`}
            >
              {t === 'all' ? 'All Records' : t === 'write' ? '✍️ Write' : '💬 Reply'}
            </button>
          ))}
        </div>
      </div>

      {/* History Items List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {filteredHistory.length === 0 ? (
          <div className="py-16 text-center">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span className="text-xs text-zinc-400">
                  {searchQuery ? 'No matching history records found' : 'No writing history yet'}
                </span>
              }
            />
          </div>
        ) : (
          filteredHistory.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                onSelectRecord(item);
                onClose();
              }}
              className="p-3.5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-violet-400 dark:hover:border-violet-600/80 hover:shadow-xs transition-all cursor-pointer group flex flex-col gap-2 relative"
            >
              {/* Top Row: Type Tag, Model & Date */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <Tag
                    color={item.type === 'write' ? 'blue' : 'purple'}
                    variant="filled"
                    className="rounded-md font-semibold text-[11px] m-0"
                  >
                    {item.type === 'write' ? 'Write' : 'Reply'} • {item.format}
                  </Tag>
                  <span className="text-[11px] text-zinc-400 flex items-center gap-0.5">
                    <ThunderboltOutlined className="text-[10px]" />
                    {item.model}
                  </span>
                </div>
                <span className="text-[11px] text-zinc-400">
                  {new Date(item.createdAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {/* Title Section (with inline edit) */}
              {editingId === item.id ? (
                <div
                  className="flex items-center gap-1.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Input
                    size="small"
                    value={editTitleInput}
                    onChange={(e) => setEditTitleInput(e.target.value)}
                    onPressEnter={() => handleSaveTitle(item.id)}
                    className="text-xs rounded-md"
                    autoFocus
                  />
                  <Button
                    size="small"
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={(e) => handleSaveTitle(item.id, e)}
                    style={{ backgroundColor: '#7c3aed' }}
                  />
                  <Button
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(null);
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-100 line-clamp-1 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                    {item.title}
                  </h4>
                  <button
                    type="button"
                    onClick={(e) => handleStartEditTitle(item, e)}
                    className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-opacity p-0.5"
                    title="Edit title"
                  >
                    <EditOutlined className="text-xs" />
                  </button>
                </div>
              )}

              {/* Snippet / Preview */}
              <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed bg-zinc-50 dark:bg-zinc-800/50 p-2 rounded-xl border border-zinc-100 dark:border-zinc-800/60 font-sans">
                {item.output}
              </p>

              {/* Card Footer Actions */}
              <div
                className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400"
                onClick={(e) => e.stopPropagation()}
              >
                <span>
                  {item.tone} • {item.length} • {item.language}
                </span>

                <div className="flex items-center gap-1.5">
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'copy',
                          icon: <CopyOutlined />,
                          label: 'Copy Output',
                          onClick: () => handleExport(item, 'copy'),
                        },
                        {
                          key: 'md',
                          icon: <FileTextOutlined />,
                          label: 'Export as Markdown (.md)',
                          onClick: () => handleExport(item, 'md'),
                        },
                        {
                          key: 'txt',
                          icon: <DownloadOutlined />,
                          label: 'Export as Text (.txt)',
                          onClick: () => handleExport(item, 'txt'),
                        },
                      ],
                    }}
                    trigger={['click']}
                  >
                    <button
                      type="button"
                      className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-md transition-colors cursor-pointer flex items-center gap-1"
                      title="Export options"
                    >
                      <DownloadOutlined className="text-xs" />
                      <span>Export</span>
                    </button>
                  </Dropdown>

                  <Popconfirm
                    title="Delete record?"
                    description="Remove this record from history?"
                    onConfirm={() => {
                      deleteWriteHistoryItem(item.id);
                      antMessage.success('Record deleted');
                    }}
                    okText="Delete"
                    cancelText="Cancel"
                  >
                    <button
                      type="button"
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-950/40 text-zinc-400 hover:text-red-500 rounded-md transition-colors cursor-pointer"
                      title="Delete record"
                    >
                      <DeleteOutlined className="text-xs" />
                    </button>
                  </Popconfirm>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Drawer>
  );
};
