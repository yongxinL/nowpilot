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
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            paddingRight: 8,
          }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <ClockCircleOutlined style={{
            color: '#7c3aed',
          }} />
            <span style={{
            fontWeight: 700,
            fontSize: 16,
            color: 'var(--foreground)',
          }}>Write History</span>
            <Tag color="purple" variant="filled" style={{
            borderRadius: 9999,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 2,
            paddingBottom: 2,
            fontSize: 12,
            fontWeight: 600,
          }}>
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
                style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
          }}
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
      <div style={{
            rowGap: 12,
            display: 'flex',
            flexDirection: 'column',
          }}>
        <Input
          placeholder="Search writing history..."
          prefix={<SearchOutlined style={{
            color: 'var(--muted-foreground)',
          }} />}
          allowClear
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            borderRadius: 12,
          }}
        />

        {/* Filter Badges */}
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
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
      <div style={{
            flex: 1,
            overflowY: 'auto',
            rowGap: 12,
            display: 'flex',
            flexDirection: 'column',
            paddingRight: 4,
          }}>
        {filteredHistory.length === 0 ? (
          <div style={{
            paddingTop: 64,
            paddingBottom: 64,
            textAlign: 'center',
          }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
          }}>
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
              style={{
            padding: 14,
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            background: 'var(--card)',
            transition: 'all 200ms ease',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            position: 'relative',
          }} className="group"
            >
              {/* Top Row: Type Tag, Model & Date */}
              <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
          }}>
                <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
                  <Tag
                    color={item.type === 'write' ? 'blue' : 'purple'}
                    variant="filled"
                    style={{
            borderRadius: 6,
            fontWeight: 600,
            fontSize: '11px',
            margin: 0,
          }}
                  >
                    {item.type === 'write' ? 'Write' : 'Reply'} • {item.format}
                  </Tag>
                  <span style={{
            fontSize: '11px',
            color: 'var(--muted-foreground)',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}>
                    <ThunderboltOutlined style={{
            fontSize: '10px',
          }} />
                    {item.model}
                  </span>
                </div>
                <span style={{
            fontSize: '11px',
            color: 'var(--muted-foreground)',
          }}>
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
                  style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Input
                    size="small"
                    value={editTitleInput}
                    onChange={(e) => setEditTitleInput(e.target.value)}
                    onPressEnter={() => handleSaveTitle(item.id)}
                    style={{
            fontSize: 12,
            borderRadius: 6,
          }}
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
                <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 8,
          }}>
                  <h4 style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--foreground)',
            display: '-webkit-box',
            WebkitLineClamp: 1,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
          }}>
                    {item.title}
                  </h4>
                  <button
                    type="button"
                    onClick={(e) => handleStartEditTitle(item, e)}
                    style={{
            opacity: 0,
            color: 'var(--muted-foreground)',
            transition: 'opacity 150ms ease',
            padding: 2,
          }}
                    title="Edit title"
                  >
                    <EditOutlined style={{
            fontSize: 12,
          }} />
                  </button>
                </div>
              )}

              {/* Snippet / Preview */}
              <p style={{
            fontSize: 12,
            color: 'var(--muted-foreground)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.625,
            background: 'var(--muted)',
            padding: 8,
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            fontFamily: 'var(--font-sans)',
          }}>
                {item.output}
              </p>

              {/* Card Footer Actions */}
              <div
                style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 4,
            borderTopWidth: 1,
            borderTopStyle: 'solid',
            borderTopColor: 'var(--border)',
            borderColor: 'var(--border)',
            fontSize: '11px',
            color: 'var(--muted-foreground)',
          }}
                onClick={(e) => e.stopPropagation()}
              >
                <span>
                  {item.tone} • {item.length} • {item.language}
                </span>

                <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
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
                      style={{
            padding: 4,
            color: 'var(--muted-foreground)',
            borderRadius: 6,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
                      title="Export options"
                    >
                      <DownloadOutlined style={{
            fontSize: 12,
          }} />
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
                      style={{
            padding: 4,
            color: 'var(--muted-foreground)',
            borderRadius: 6,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
          }}
                      title="Delete record"
                    >
                      <DeleteOutlined style={{
            fontSize: 12,
          }} />
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
