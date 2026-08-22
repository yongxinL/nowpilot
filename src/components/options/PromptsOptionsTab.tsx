import React, { useState } from 'react';
import { App, Tooltip, theme } from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BookOutlined,
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

// SVG Icons matching screenshots
const HideIcon: React.FC = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    <line x1="8" y1="10" x2="16" y2="10" />
  </svg>
);

const ShowIcon: React.FC = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    <line x1="12" y1="7" x2="12" y2="13" />
    <line x1="9" y1="10" x2="15" y2="10" />
  </svg>
);

export const PromptsOptionsTab: React.FC = () => {
  const { message: antMessage } = App.useApp();
  const { token } = theme.useToken();
  const { prompts, addPrompt, updatePrompt, deletePrompt } = useExtensionStore();

  const [activeCategory, setActiveCategory] = useState<PromptCategory>('Chat/Ask');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptItem | null>(null);

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

  // Filter and sort prompts for the active category
  const activePrompts = prompts.filter((p) => isPromptInCategory(p, activeCategory));

  const showList = activePrompts.filter((p) => isPromptShownInCategory(p, activeCategory));
  const hideList = activePrompts.filter((p) => !isPromptShownInCategory(p, activeCategory));

  const currentCategoryMeta = CATEGORIES.find((c) => c.key === activeCategory) || CATEGORIES[0];

  const handleTogglePromptVisibility = (prompt: PromptItem, cat: PromptCategory) => {
    const currentShown = isPromptShownInCategory(prompt, cat);
    const newVisibility = {
      ...(prompt.categoryVisibility || {}),
      [cat]: !currentShown,
    };
    updatePrompt(prompt.id, {
      categoryVisibility: newVisibility,
      showInList: cat === prompt.category ? !currentShown : prompt.showInList,
    });
    antMessage.success(
      currentShown ? `Moved to 'Hide from list'` : `Moved to 'Show in list'`
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
      if (!editingPrompt.isCustom) {
        // System prompt: update usedIn and sync categoryVisibility
        const newCatVis = { ...(editingPrompt.categoryVisibility || {}) };
        (['Chat/Ask', 'Reading', 'Writing'] as PromptCategory[]).forEach((cat) => {
          if (data.usedIn.includes(cat)) {
            if (newCatVis[cat] === undefined) newCatVis[cat] = true;
          } else {
            newCatVis[cat] = false;
          }
        });
        updatePrompt(editingPrompt.id, {
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
    antMessage.success('Prompt deleted');
  };

  const handleResetPrompts = () => {
    // Reset or ensure all default prompts are active
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
      antMessage.success('Prompt reordered');
    }

    setDraggedPromptId(null);
    setDragOverPromptId(null);
  };

  return (
    <div style={{ width: '100%', maxWidth: 1024, margin: '0 auto', padding: '8px 0' }}>
      {/* Header Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: token.colorText, margin: 0 }}>
          Prompts
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Refresh / Reset Button */}
          <Tooltip title="Reset prompts to default">
            <button
              type="button"
              onClick={handleResetPrompts}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#1677ff',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 150ms ease',
                cursor: 'pointer',
                border: 'none',
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
              padding: '8px 16px',
              background: '#1677ff',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: 12,
              borderRadius: 9999,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'all 150ms ease',
              cursor: 'pointer',
              border: 'none',
            }}
          >
            <PlusOutlined style={{ fontSize: 12 }} />
            <span>New Prompt</span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              style={{
                padding: '6px 16px',
                borderRadius: 9999,
                fontSize: 12,
                fontWeight: 600,
                transition: 'all 150ms ease',
                cursor: 'pointer',
                userSelect: 'none',
                background: isActive ? token.colorText : 'transparent',
                color: isActive ? token.colorBgContainer : token.colorTextSecondary,
                boxShadow: isActive ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                border: 'none',
              }}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Category Subtitle Description */}
      <p style={{ fontSize: 12, color: token.colorTextTertiary, marginBottom: 20, marginTop: 0 }}>
        {currentCategoryMeta.description}
      </p>

      {/* Two Columns Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* LEFT COLUMN: Show in list */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: token.colorTextSecondary, marginBottom: 10, padding: '0 4px' }}>
            <BookOutlined style={{ fontSize: 14, color: token.colorTextTertiary }} />
            <span>Show in list</span>
            <span style={{ color: token.colorTextTertiary, fontWeight: 400, marginLeft: 'auto' }}>
              ({showList.length})
            </span>
          </div>

          <div style={{
            background: '#f4f5f7',
            padding: 12,
            borderRadius: 16,
            border: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minHeight: 500,
          }}>
            {showList.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: token.colorTextTertiary, fontSize: 12, textAlign: 'center' }}>
                <InboxOutlined style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }} />
                <span>No active prompts for this category</span>
                <span style={{ fontSize: 11, marginTop: 4, color: token.colorTextTertiary }}>
                  Click 'Show' on any item in the right list to add it here
                </span>
              </div>
            ) : (
              showList.map((prompt, index) => {
                const isDragging = draggedPromptId === prompt.id;
                const isDragOver = dragOverPromptId === prompt.id;

                return (
                  <div
                    key={prompt.id}
                    className="np-reveal-on-hover"
                    draggable
                    onDragStart={(e) => handleDragStart(e, prompt.id)}
                    onDragOver={(e) => handleDragOver(e, prompt.id)}
                    onDrop={(e) => handleDrop(e, prompt.id)}
                    onDragEnd={() => {
                      setDraggedPromptId(null);
                      setDragOverPromptId(null);
                    }}
                    style={{
                      background: token.colorBgContainer,
                      borderRadius: 12,
                      padding: '12px 14px',
                      border: `1px solid ${isDragging ? token.colorInfo : isDragOver ? '#1677ff' : token.colorBorderSecondary}`,
                      borderStyle: isDragging ? 'dashed' : 'solid',
                      transition: 'all 150ms ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: isDragging ? 0.4 : 1,
                      boxShadow: isDragOver ? '0 0 0 2px rgba(22,119,255,0.2)' : '0 1px 2px rgba(0,0,0,0.06)',
                      userSelect: 'none',
                    }}
                  >
                    {/* Left: Drag handle, Icon, Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, paddingRight: 8 }}>
                      <span style={{ color: token.colorTextTertiary, cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <HolderOutlined style={{ fontSize: 12 }} />
                      </span>

                      <span style={{ color: token.colorTextSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <PromptIcon name={prompt.icon} size={15} />
                      </span>

                      <span style={{ fontSize: 14, fontWeight: 500, color: token.colorTextSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {prompt.title}
                      </span>
                    </div>

                    {/* Right: Actions (Edit, Delete, Hide, Up/Down) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, opacity: 0, transition: 'opacity 150ms ease' }} className="np-prompt-actions">
                      {/* Reorder Up/Down Helpers */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginRight: 4, color: token.colorTextTertiary }}>
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMovePrompt(showList, index, 'up')}
                          style={{
                            padding: 4,
                            cursor: 'pointer',
                            opacity: index === 0 ? 0.2 : 1,
                            background: 'transparent',
                            border: 'none',
                            color: 'inherit',
                          }}
                          title="Move Up"
                        >
                          <ArrowUpOutlined style={{ fontSize: 10 }} />
                        </button>
                        <button
                          type="button"
                          disabled={index === showList.length - 1}
                          onClick={() => handleMovePrompt(showList, index, 'down')}
                          style={{
                            padding: 4,
                            cursor: 'pointer',
                            opacity: index === showList.length - 1 ? 0.2 : 1,
                            background: 'transparent',
                            border: 'none',
                            color: 'inherit',
                          }}
                          title="Move Down"
                        >
                          <ArrowDownOutlined style={{ fontSize: 10 }} />
                        </button>
                      </div>

                      {/* Edit Button */}
                      <Tooltip title="Edit">
                        <button
                          type="button"
                          onClick={() => handleOpenEditPrompt(prompt)}
                          style={{
                            padding: 6,
                            color: token.colorTextTertiary,
                            borderRadius: 6,
                            transition: 'all 150ms ease',
                            cursor: 'pointer',
                            background: 'transparent',
                            border: 'none',
                          }}
                        >
                          <EditOutlined style={{ fontSize: 12 }} />
                        </button>
                      </Tooltip>

                      {/* Delete Button (Only for custom user prompts) */}
                      {prompt.isCustom && (
                        <Tooltip title="Delete">
                          <button
                            type="button"
                            onClick={() => handleDeletePrompt(prompt)}
                            style={{
                              padding: 6,
                              color: token.colorTextTertiary,
                              borderRadius: 6,
                              transition: 'all 150ms ease',
                              cursor: 'pointer',
                              background: 'transparent',
                              border: 'none',
                            }}
                          >
                            <DeleteOutlined style={{ fontSize: 12 }} />
                          </button>
                        </Tooltip>
                      )}

                      {/* Hide Button */}
                      <Tooltip title="Hide">
                        <button
                          type="button"
                          onClick={() => handleTogglePromptVisibility(prompt, activeCategory)}
                          style={{
                            padding: 6,
                            color: token.colorTextTertiary,
                            borderRadius: 6,
                            transition: 'all 150ms ease',
                            cursor: 'pointer',
                            background: 'transparent',
                            border: 'none',
                          }}
                        >
                          <HideIcon />
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: token.colorTextSecondary, marginBottom: 10, padding: '0 4px' }}>
            <InboxOutlined style={{ fontSize: 14, color: token.colorTextTertiary }} />
            <span>Hide from list</span>
            <span style={{ color: token.colorTextTertiary, fontWeight: 400, marginLeft: 'auto' }}>
              ({hideList.length})
            </span>
          </div>

          <div style={{
            background: '#f4f5f7',
            padding: 12,
            borderRadius: 16,
            border: `1px solid ${token.colorBorderSecondary}`,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minHeight: 500,
          }}>
            {hideList.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: token.colorTextTertiary, fontSize: 12, textAlign: 'center' }}>
                <InboxOutlined style={{ fontSize: 24, marginBottom: 8, opacity: 0.5 }} />
                <span>No hidden prompts for this category</span>
              </div>
            ) : (
              hideList.map((prompt, index) => {
                const isDragging = draggedPromptId === prompt.id;
                const isDragOver = dragOverPromptId === prompt.id;

                return (
                  <div
                    key={prompt.id}
                    className="np-reveal-on-hover"
                    draggable
                    onDragStart={(e) => handleDragStart(e, prompt.id)}
                    onDragOver={(e) => handleDragOver(e, prompt.id)}
                    onDrop={(e) => handleDrop(e, prompt.id)}
                    onDragEnd={() => {
                      setDraggedPromptId(null);
                      setDragOverPromptId(null);
                    }}
                    style={{
                      background: token.colorBgContainer,
                      borderRadius: 12,
                      padding: '12px 14px',
                      border: `1px solid ${isDragging ? token.colorInfo : isDragOver ? '#1677ff' : token.colorBorderSecondary}`,
                      borderStyle: isDragging ? 'dashed' : 'solid',
                      transition: 'all 150ms ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: isDragging ? 0.4 : 1,
                      boxShadow: isDragOver ? '0 0 0 2px rgba(22,119,255,0.2)' : '0 1px 2px rgba(0,0,0,0.06)',
                      userSelect: 'none',
                    }}
                  >
                    {/* Left: Drag handle, Icon, Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, paddingRight: 8 }}>
                      <span style={{ color: token.colorTextTertiary, cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <HolderOutlined style={{ fontSize: 12 }} />
                      </span>

                      <span style={{ color: token.colorTextSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <PromptIcon name={prompt.icon} size={15} />
                      </span>

                      <span style={{ fontSize: 14, fontWeight: 500, color: token.colorTextSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {prompt.title}
                      </span>
                    </div>

                    {/* Right: Actions (Edit, Delete, Show) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, opacity: 0, transition: 'opacity 150ms ease' }} className="np-prompt-actions">
                      {/* Reorder Up/Down Helpers */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginRight: 4, color: token.colorTextTertiary }}>
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMovePrompt(hideList, index, 'up')}
                          style={{
                            padding: 4,
                            cursor: 'pointer',
                            opacity: index === 0 ? 0.2 : 1,
                            background: 'transparent',
                            border: 'none',
                            color: 'inherit',
                          }}
                          title="Move Up"
                        >
                          <ArrowUpOutlined style={{ fontSize: 10 }} />
                        </button>
                        <button
                          type="button"
                          disabled={index === hideList.length - 1}
                          onClick={() => handleMovePrompt(hideList, index, 'down')}
                          style={{
                            padding: 4,
                            cursor: 'pointer',
                            opacity: index === hideList.length - 1 ? 0.2 : 1,
                            background: 'transparent',
                            border: 'none',
                            color: 'inherit',
                          }}
                          title="Move Down"
                        >
                          <ArrowDownOutlined style={{ fontSize: 10 }} />
                        </button>
                      </div>

                      {/* Edit Button */}
                      <Tooltip title="Edit">
                        <button
                          type="button"
                          onClick={() => handleOpenEditPrompt(prompt)}
                          style={{
                            padding: 6,
                            color: token.colorTextTertiary,
                            borderRadius: 6,
                            transition: 'all 150ms ease',
                            cursor: 'pointer',
                            background: 'transparent',
                            border: 'none',
                          }}
                        >
                          <EditOutlined style={{ fontSize: 12 }} />
                        </button>
                      </Tooltip>

                      {/* Delete Button (Only for custom user prompts) */}
                      {prompt.isCustom && (
                        <Tooltip title="Delete">
                          <button
                            type="button"
                            onClick={() => handleDeletePrompt(prompt)}
                            style={{
                              padding: 6,
                              color: token.colorTextTertiary,
                              borderRadius: 6,
                              transition: 'all 150ms ease',
                              cursor: 'pointer',
                              background: 'transparent',
                              border: 'none',
                            }}
                          >
                            <DeleteOutlined style={{ fontSize: 12 }} />
                          </button>
                        </Tooltip>
                      )}

                      {/* Show Button */}
                      <Tooltip title="Show">
                        <button
                          type="button"
                          onClick={() => handleTogglePromptVisibility(prompt, activeCategory)}
                          style={{
                            padding: 6,
                            color: token.colorTextTertiary,
                            borderRadius: 6,
                            transition: 'all 150ms ease',
                            cursor: 'pointer',
                            background: 'transparent',
                            border: 'none',
                          }}
                        >
                          <ShowIcon />
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
