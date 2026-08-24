import React, { useState } from 'react';
import { App, Tooltip, theme, Popconfirm } from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FileTextOutlined,
  InboxOutlined,
  HolderOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { PromptItem, PromptCategory } from '../../types';
import { useExtensionStore } from '../../store/useExtensionStore';
import { PromptIcon } from './PromptIcon';
import { PromptModal } from './PromptModal';
import { DEFAULT_PROMPTS_LIST } from './defaultPromptsData';

const CATEGORIES: { key: PromptCategory; label: string; description: string }[] = [
  {
    key: 'Chat/Ask',
    label: 'Chat/Ask',
    description: "Prompts in 'Show in list' appear in the Chat/Ask feature.",
  },
  {
    key: 'Reading',
    label: 'Reading',
    description: "Prompts in 'Show in list' appear in the context menu for page text.",
  },
  {
    key: 'Writing',
    label: 'Writing',
    description: "Prompts in 'Show in list' appear in the context menu for input boxes.",
  },
];

// Bookmark hide / show icons matching mockup
const BookmarkHideIcon: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const BookmarkShowIcon: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    <line x1="12" y1="8" x2="12" y2="14" />
    <line x1="9" y1="11" x2="15" y2="11" />
  </svg>
);

export const PromptsOptionsTab: React.FC = () => {
  const { message: antMessage } = App.useApp();
  const { token } = theme.useToken();
  const { prompts, addPrompt, updatePrompt, deletePrompt } = useExtensionStore();

  const [activeCategory, setActiveCategory] = useState<PromptCategory>('Chat/Ask');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptItem | null>(null);
  const [hoveredPromptId, setHoveredPromptId] = useState<string | null>(null);

  // Drag and drop state
  const [draggedPromptId, setDraggedPromptId] = useState<string | null>(null);
  const [dragOverPromptId, setDragOverPromptId] = useState<string | null>(null);

  // Helper to test if prompt belongs to category
  const isPromptInCategory = (p: PromptItem, cat: PromptCategory) => {
    if (p.usedIn && p.usedIn.length > 0) {
      return p.usedIn.includes(cat);
    }
    return p.category === cat;
  };

  // Helper to test if prompt is shown in category
  const isPromptShownInCategory = (p: PromptItem, cat: PromptCategory) => {
    if (p.categoryVisibility && p.categoryVisibility[cat] !== undefined) {
      return !!p.categoryVisibility[cat];
    }
    return p.showInList;
  };

  // Build the list of prompts for current active category
  const currentCategoryPrompts = prompts.filter((p) => isPromptInCategory(p, activeCategory));

  const showList = currentCategoryPrompts.filter((p) => isPromptShownInCategory(p, activeCategory));
  const hideList = currentCategoryPrompts.filter((p) => !isPromptShownInCategory(p, activeCategory));

  const handleTogglePromptVisibility = (prompt: PromptItem, category: PromptCategory) => {
    const isCurrentlyShown = isPromptShownInCategory(prompt, category);
    const newCatVis = {
      ...(prompt.categoryVisibility || {
        'Chat/Ask': prompt.showInList,
        'Reading': prompt.showInList,
        'Writing': prompt.showInList,
      }),
      [category]: !isCurrentlyShown,
    };

    updatePrompt(prompt.id, {
      categoryVisibility: newCatVis,
      showInList: !isCurrentlyShown,
    });

    antMessage.success(
      isCurrentlyShown
        ? `Moved "${prompt.title}" to Hidden list`
        : `Moved "${prompt.title}" to Active list`
    );
  };

  const handleOpenNewPrompt = () => {
    setEditingPrompt(null);
    setModalOpen(true);
  };

  const handleOpenEditPrompt = (prompt: PromptItem) => {
    setEditingPrompt(prompt);
    setModalOpen(true);
  };

  const handleSavePrompt = (data: {
    title: string;
    content: string;
    usedIn: PromptCategory[];
    icon: string;
  }) => {
    if (editingPrompt) {
      const isDefault = !editingPrompt.isCustom;
      if (isDefault) {
        const newCatVis = { ...(editingPrompt.categoryVisibility || {}) };
        ['Chat/Ask', 'Reading', 'Writing'].forEach((c) => {
          const cat = c as PromptCategory;
          if (data.usedIn.includes(cat)) {
            if (newCatVis[cat] === undefined) newCatVis[cat] = true;
          } else {
            newCatVis[cat] = false;
          }
        });
        updatePrompt(editingPrompt.id, {
          title: data.title,
          content: data.content,
          icon: data.icon,
          usedIn: data.usedIn,
          categoryVisibility: newCatVis,
        });
      } else {
        updatePrompt(editingPrompt.id, {
          title: data.title,
          content: data.content,
          usedIn: data.usedIn,
          icon: data.icon,
          categoryVisibility: {
            'Chat/Ask': data.usedIn.includes('Chat/Ask'),
            'Reading': data.usedIn.includes('Reading'),
            'Writing': data.usedIn.includes('Writing'),
          },
        });
      }
      antMessage.success('Prompt updated successfully');
    } else {
      const newPrompt: PromptItem = {
        id: 'p_custom_' + Date.now(),
        title: data.title,
        content: data.content,
        category: data.usedIn[0] || activeCategory,
        usedIn: data.usedIn,
        icon: data.icon,
        showInList: true,
        categoryVisibility: {
          'Chat/Ask': data.usedIn.includes('Chat/Ask'),
          'Reading': data.usedIn.includes('Reading'),
          'Writing': data.usedIn.includes('Writing'),
        },
        isCustom: true,
        order: Date.now(),
      };
      addPrompt(newPrompt);
      antMessage.success('New prompt created successfully');
    }
  };

  const handleDeletePrompt = (prompt: PromptItem) => {
    deletePrompt(prompt.id);
    antMessage.success(`"${prompt.title}" deleted`);
  };

  const handleResetPrompts = () => {
    useExtensionStore.setState({
      prompts: DEFAULT_PROMPTS_LIST,
    });
    antMessage.success('Prompts reset to standard defaults');
  };

  // Reorder prompt handlers
  const handleMovePrompt = (list: PromptItem[], index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const updatedPrompts = [...prompts];
    const itemA = list[index];
    const itemB = list[targetIndex];

    const idxA = updatedPrompts.findIndex((p) => p.id === itemA.id);
    const idxB = updatedPrompts.findIndex((p) => p.id === itemB.id);

    if (idxA !== -1 && idxB !== -1) {
      const temp = updatedPrompts[idxA];
      updatedPrompts[idxA] = updatedPrompts[idxB];
      updatedPrompts[idxB] = temp;
      useExtensionStore.setState({ prompts: updatedPrompts });
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedPromptId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragOverPromptId !== id) {
      setDragOverPromptId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggedPromptId;
    if (!sourceId || sourceId === targetId) {
      setDraggedPromptId(null);
      setDragOverPromptId(null);
      return;
    }

    const updatedPrompts = [...prompts];
    const sourceIndex = updatedPrompts.findIndex((p) => p.id === sourceId);
    const targetIndex = updatedPrompts.findIndex((p) => p.id === targetId);

    if (sourceIndex !== -1 && targetIndex !== -1) {
      const [removed] = updatedPrompts.splice(sourceIndex, 1);
      updatedPrompts.splice(targetIndex, 0, removed);
      useExtensionStore.setState({ prompts: updatedPrompts });
    }

    setDraggedPromptId(null);
    setDragOverPromptId(null);
  };

  const currentCategoryMeta = CATEGORIES.find((c) => c.key === activeCategory) || CATEGORIES[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', maxWidth: 1000 }}>
      {/* Top Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: 'var(--foreground)' }}>
          Prompts
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Circular Reset Button */}
          <Tooltip title="Reset to default prompts">
            <button
              type="button"
              onClick={handleResetPrompts}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#2563eb',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                boxShadow: '0 1px 3px rgba(37,99,235,0.2)',
              }}
            >
              <ReloadOutlined style={{ fontSize: 14 }} />
            </button>
          </Tooltip>

          {/* New Prompt Button */}
          <button
            type="button"
            onClick={handleOpenNewPrompt}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 18px',
              background: '#2563eb',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: 13,
              borderRadius: 9999,
              boxShadow: '0 1px 3px rgba(37,99,235,0.2)',
              transition: 'all 150ms ease',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            <PlusOutlined style={{ fontSize: 13 }} />
            <span>New Prompt</span>
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              style={{
                padding: '6px 18px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 600,
                transition: 'all 150ms ease',
                cursor: 'pointer',
                userSelect: 'none',
                background: isActive ? '#0f172a' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--muted-foreground)',
                border: 'none',
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Category Subtitle Description */}
      <p style={{ fontSize: 13, color: 'var(--muted-foreground)', marginBottom: 20, marginTop: 0 }}>
        {currentCategoryMeta.description}
      </p>

      {/* Two Columns Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* LEFT COLUMN: Show in list */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12, padding: '0 4px' }}>
            <FileTextOutlined style={{ fontSize: 14, color: 'var(--muted-foreground)' }} />
            <span>Show in list</span>
            <span style={{ color: 'var(--muted-foreground)', fontWeight: 400, marginLeft: 'auto', fontSize: 12 }}>
              ({showList.length})
            </span>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minHeight: 480,
          }}>
            {showList.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: 'var(--muted-foreground)', fontSize: 13, textAlign: 'center', background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)' }}>
                <InboxOutlined style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }} />
                <span>No active prompts for this category</span>
                <span style={{ fontSize: 12, marginTop: 4, color: 'var(--muted-foreground)' }}>
                  Click show button on any item in the right list to add it here
                </span>
              </div>
            ) : (
              showList.map((prompt, index) => {
                const isDragging = draggedPromptId === prompt.id;
                const isDragOver = dragOverPromptId === prompt.id;
                const isHovered = hoveredPromptId === prompt.id;

                return (
                  <div
                    key={prompt.id}
                    className={`np-reveal-on-hover ${isHovered ? 'force-hover' : ''}`}
                    draggable
                    onMouseEnter={() => setHoveredPromptId(prompt.id)}
                    onMouseLeave={() => setHoveredPromptId(null)}
                    onDragStart={(e) => handleDragStart(e, prompt.id)}
                    onDragOver={(e) => handleDragOver(e, prompt.id)}
                    onDrop={(e) => handleDrop(e, prompt.id)}
                    onDragEnd={() => {
                      setDraggedPromptId(null);
                      setDragOverPromptId(null);
                    }}
                    style={{
                      background: 'var(--card)',
                      borderRadius: 14,
                      padding: '12px 16px',
                      border: `1px solid ${isDragging ? '#2563eb' : isDragOver ? '#2563eb' : 'var(--border)'}`,
                      borderStyle: isDragging ? 'dashed' : 'solid',
                      transition: 'all 150ms ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: isDragging ? 0.4 : 1,
                      boxShadow: isDragOver ? '0 0 0 2px rgba(37,99,235,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
                      userSelect: 'none',
                      height: 48,
                    }}
                  >
                    {/* Left: Drag handle, Icon, Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, paddingRight: 8, flex: 1 }}>
                      <span style={{ color: '#9ca3af', cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <HolderOutlined style={{ fontSize: 13 }} />
                      </span>

                      <span style={{ color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <PromptIcon name={prompt.icon} size={16} />
                      </span>

                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {prompt.title}
                      </span>
                    </div>

                    {/* Right: Actions (Up, Down, Edit, Delete, Hide) */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexShrink: 0,
                        opacity: isHovered ? 1 : 0,
                        visibility: isHovered ? 'visible' : 'hidden',
                        transition: 'opacity 150ms ease',
                      }}
                      className="np-prompt-actions"
                    >
                      {/* Move Up */}
                      <Tooltip title="Move Up">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMovePrompt(showList, index, 'up')}
                          style={{
                            padding: '4px 2px',
                            cursor: index === 0 ? 'not-allowed' : 'pointer',
                            opacity: index === 0 ? 0.25 : 1,
                            background: 'transparent',
                            border: 'none',
                            color: '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <ArrowUpOutlined style={{ fontSize: 11 }} />
                        </button>
                      </Tooltip>

                      {/* Move Down */}
                      <Tooltip title="Move Down">
                        <button
                          type="button"
                          disabled={index === showList.length - 1}
                          onClick={() => handleMovePrompt(showList, index, 'down')}
                          style={{
                            padding: '4px 2px',
                            cursor: index === showList.length - 1 ? 'not-allowed' : 'pointer',
                            opacity: index === showList.length - 1 ? 0.25 : 1,
                            background: 'transparent',
                            border: 'none',
                            color: '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <ArrowDownOutlined style={{ fontSize: 11 }} />
                        </button>
                      </Tooltip>

                      {/* Edit Button */}
                      <Tooltip title="Edit">
                        <button
                          type="button"
                          onClick={() => handleOpenEditPrompt(prompt)}
                          style={{
                            padding: 4,
                            color: '#6b7280',
                            cursor: 'pointer',
                            background: 'transparent',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <EditOutlined style={{ fontSize: 13 }} />
                        </button>
                      </Tooltip>

                      {/* Delete Button */}
                      <Tooltip title="Delete">
                        <Popconfirm
                          title="Delete prompt?"
                          description="Are you sure you want to delete this prompt?"
                          onConfirm={() => handleDeletePrompt(prompt)}
                          okText="Delete"
                          cancelText="Cancel"
                          okButtonProps={{ danger: true }}
                        >
                          <button
                            type="button"
                            style={{
                              padding: 4,
                              color: '#6b7280',
                              cursor: 'pointer',
                              background: 'transparent',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <DeleteOutlined style={{ fontSize: 13 }} />
                          </button>
                        </Popconfirm>
                      </Tooltip>

                      {/* Hide from list Button */}
                      <Tooltip title="Hide from list">
                        <button
                          type="button"
                          onClick={() => handleTogglePromptVisibility(prompt, activeCategory)}
                          style={{
                            padding: 4,
                            color: '#6b7280',
                            cursor: 'pointer',
                            background: 'transparent',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <BookmarkHideIcon size={14} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Hide from list */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: 'var(--foreground)', marginBottom: 12, padding: '0 4px' }}>
            <InboxOutlined style={{ fontSize: 14, color: 'var(--muted-foreground)' }} />
            <span>Hide from list</span>
            <span style={{ color: 'var(--muted-foreground)', fontWeight: 400, marginLeft: 'auto', fontSize: 12 }}>
              ({hideList.length})
            </span>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minHeight: 480,
          }}>
            {hideList.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: 'var(--muted-foreground)', fontSize: 13, textAlign: 'center', background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)' }}>
                <InboxOutlined style={{ fontSize: 28, marginBottom: 8, opacity: 0.5 }} />
                <span>No hidden prompts for this category</span>
              </div>
            ) : (
              hideList.map((prompt, index) => {
                const isDragging = draggedPromptId === prompt.id;
                const isDragOver = dragOverPromptId === prompt.id;
                const isHovered = hoveredPromptId === prompt.id;

                return (
                  <div
                    key={prompt.id}
                    className={`np-reveal-on-hover ${isHovered ? 'force-hover' : ''}`}
                    draggable
                    onMouseEnter={() => setHoveredPromptId(prompt.id)}
                    onMouseLeave={() => setHoveredPromptId(null)}
                    onDragStart={(e) => handleDragStart(e, prompt.id)}
                    onDragOver={(e) => handleDragOver(e, prompt.id)}
                    onDrop={(e) => handleDrop(e, prompt.id)}
                    onDragEnd={() => {
                      setDraggedPromptId(null);
                      setDragOverPromptId(null);
                    }}
                    style={{
                      background: 'var(--card)',
                      borderRadius: 14,
                      padding: '12px 16px',
                      border: `1px solid ${isDragging ? '#2563eb' : isDragOver ? '#2563eb' : 'var(--border)'}`,
                      borderStyle: isDragging ? 'dashed' : 'solid',
                      transition: 'all 150ms ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: isDragging ? 0.4 : 1,
                      boxShadow: isDragOver ? '0 0 0 2px rgba(37,99,235,0.2)' : '0 1px 2px rgba(0,0,0,0.03)',
                      userSelect: 'none',
                      height: 48,
                    }}
                  >
                    {/* Left: Drag handle, Icon, Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, paddingRight: 8, flex: 1 }}>
                      <span style={{ color: '#9ca3af', cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <HolderOutlined style={{ fontSize: 13 }} />
                      </span>

                      <span style={{ color: 'var(--foreground)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <PromptIcon name={prompt.icon} size={16} />
                      </span>

                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {prompt.title}
                      </span>
                    </div>

                    {/* Right: Actions (Up, Down, Edit, Delete, Show) */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexShrink: 0,
                        opacity: isHovered ? 1 : 0,
                        visibility: isHovered ? 'visible' : 'hidden',
                        transition: 'opacity 150ms ease',
                      }}
                      className="np-prompt-actions"
                    >
                      {/* Move Up */}
                      <Tooltip title="Move Up">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMovePrompt(hideList, index, 'up')}
                          style={{
                            padding: '4px 2px',
                            cursor: index === 0 ? 'not-allowed' : 'pointer',
                            opacity: index === 0 ? 0.25 : 1,
                            background: 'transparent',
                            border: 'none',
                            color: '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <ArrowUpOutlined style={{ fontSize: 11 }} />
                        </button>
                      </Tooltip>

                      {/* Move Down */}
                      <Tooltip title="Move Down">
                        <button
                          type="button"
                          disabled={index === hideList.length - 1}
                          onClick={() => handleMovePrompt(hideList, index, 'down')}
                          style={{
                            padding: '4px 2px',
                            cursor: index === hideList.length - 1 ? 'not-allowed' : 'pointer',
                            opacity: index === hideList.length - 1 ? 0.25 : 1,
                            background: 'transparent',
                            border: 'none',
                            color: '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <ArrowDownOutlined style={{ fontSize: 11 }} />
                        </button>
                      </Tooltip>

                      {/* Edit Button */}
                      <Tooltip title="Edit">
                        <button
                          type="button"
                          onClick={() => handleOpenEditPrompt(prompt)}
                          style={{
                            padding: 4,
                            color: '#6b7280',
                            cursor: 'pointer',
                            background: 'transparent',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <EditOutlined style={{ fontSize: 13 }} />
                        </button>
                      </Tooltip>

                      {/* Delete Button */}
                      <Tooltip title="Delete">
                        <Popconfirm
                          title="Delete prompt?"
                          description="Are you sure you want to delete this prompt?"
                          onConfirm={() => handleDeletePrompt(prompt)}
                          okText="Delete"
                          cancelText="Cancel"
                          okButtonProps={{ danger: true }}
                        >
                          <button
                            type="button"
                            style={{
                              padding: 4,
                              color: '#6b7280',
                              cursor: 'pointer',
                              background: 'transparent',
                              border: 'none',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <DeleteOutlined style={{ fontSize: 13 }} />
                          </button>
                        </Popconfirm>
                      </Tooltip>

                      {/* Show in list Button */}
                      <Tooltip title="Show in list">
                        <button
                          type="button"
                          onClick={() => handleTogglePromptVisibility(prompt, activeCategory)}
                          style={{
                            padding: 4,
                            color: '#6b7280',
                            cursor: 'pointer',
                            background: 'transparent',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <BookmarkShowIcon size={14} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Prompt Modal (Create & Edit) */}
      <PromptModal
        open={modalOpen}
        prompt={editingPrompt}
        onClose={() => {
          setModalOpen(false);
          setEditingPrompt(null);
        }}
        onSave={handleSavePrompt}
      />
    </div>
  );
};
