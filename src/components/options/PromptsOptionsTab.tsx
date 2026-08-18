import React, { useState } from 'react';
import { App, Tooltip } from 'antd';
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
    <div className="w-full max-w-5xl mx-auto py-2">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 m-0">
          Prompts
        </h1>

        <div className="flex items-center gap-3">
          {/* Refresh / Reset Button */}
          <Tooltip title="Reset prompts to default">
            <button
              type="button"
              onClick={handleResetPrompts}
              className="w-9 h-9 rounded-full bg-[#1677ff] hover:bg-blue-600 text-white flex items-center justify-center shadow-xs transition-colors cursor-pointer"
            >
              <ReloadOutlined className="text-sm" />
            </button>
          </Tooltip>

          {/* New Prompt Button */}
          <button
            type="button"
            onClick={handleOpenNewPrompt}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#1677ff] hover:bg-blue-600 text-white font-semibold text-xs rounded-full shadow-xs transition-colors cursor-pointer"
          >
            <PlusOutlined className="text-xs" />
            <span>New Prompt</span>
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-2 mb-2">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveCategory(cat.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer select-none ${
                isActive
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-2xs'
                  : 'bg-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Category Subtitle Description */}
      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5">
        {currentCategoryMeta.description}
      </p>

      {/* Two Columns Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT COLUMN: Show in list */}
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2.5 px-1">
            <BookOutlined className="text-sm text-zinc-500" />
            <span>Show in list</span>
            <span className="text-zinc-400 font-normal ml-auto">
              ({showList.length})
            </span>
          </div>

          <div className="bg-[#f4f5f7] dark:bg-zinc-900/60 p-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 flex flex-col gap-2 min-h-[500px]">
            {showList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-400 text-xs text-center">
                <InboxOutlined className="text-2xl mb-2 opacity-50" />
                <span>No active prompts for this category</span>
                <span className="text-[11px] mt-1 text-zinc-400">
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
                    draggable
                    onDragStart={(e) => handleDragStart(e, prompt.id)}
                    onDragOver={(e) => handleDragOver(e, prompt.id)}
                    onDrop={(e) => handleDrop(e, prompt.id)}
                    onDragEnd={() => {
                      setDraggedPromptId(null);
                      setDragOverPromptId(null);
                    }}
                    className={`bg-white dark:bg-zinc-800/90 rounded-xl px-3.5 py-3 border transition-all flex items-center justify-between group shadow-2xs hover:shadow-xs select-none ${
                      isDragging ? 'opacity-40 border-dashed border-blue-400' : ''
                    } ${
                      isDragOver ? 'border-[#1677ff] ring-2 ring-[#1677ff]/20' : 'border-zinc-200/70 dark:border-zinc-700/60'
                    }`}
                  >
                    {/* Left: Drag handle, Icon, Title */}
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 cursor-grab active:cursor-grabbing flex items-center justify-center">
                        <HolderOutlined className="text-xs" />
                      </span>

                      <span className="text-zinc-600 dark:text-zinc-300 flex items-center justify-center flex-shrink-0">
                        <PromptIcon name={prompt.icon} size={15} />
                      </span>

                      <span className="text-xs sm:text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                        {prompt.title}
                      </span>
                    </div>

                    {/* Right: Actions (Edit, Delete, Hide, Up/Down) */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5 flex-shrink-0">
                      {/* Reorder Up/Down Helpers */}
                      <div className="flex items-center gap-0.5 mr-1 text-zinc-400">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMovePrompt(showList, index, 'up')}
                          className="p-1 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 disabled:hover:text-zinc-400 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUpOutlined className="text-[10px]" />
                        </button>
                        <button
                          type="button"
                          disabled={index === showList.length - 1}
                          onClick={() => handleMovePrompt(showList, index, 'down')}
                          className="p-1 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 disabled:hover:text-zinc-400 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDownOutlined className="text-[10px]" />
                        </button>
                      </div>

                      {/* Edit Button */}
                      <Tooltip title="Edit">
                        <button
                          type="button"
                          onClick={() => handleOpenEditPrompt(prompt)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        >
                          <EditOutlined className="text-xs" />
                        </button>
                      </Tooltip>

                      {/* Delete Button (Only for custom user prompts) */}
                      {prompt.isCustom && (
                        <Tooltip title="Delete">
                          <button
                            type="button"
                            onClick={() => handleDeletePrompt(prompt)}
                            className="p-1.5 text-zinc-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                          >
                            <DeleteOutlined className="text-xs" />
                          </button>
                        </Tooltip>
                      )}

                      {/* Hide Button */}
                      <Tooltip title="Hide">
                        <button
                          type="button"
                          onClick={() => handleTogglePromptVisibility(prompt, activeCategory)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
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
        <div className="flex flex-col">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2.5 px-1">
            <InboxOutlined className="text-sm text-zinc-500" />
            <span>Hide from list</span>
            <span className="text-zinc-400 font-normal ml-auto">
              ({hideList.length})
            </span>
          </div>

          <div className="bg-[#f4f5f7] dark:bg-zinc-900/60 p-3 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 flex flex-col gap-2 min-h-[500px]">
            {hideList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-400 text-xs text-center">
                <InboxOutlined className="text-2xl mb-2 opacity-50" />
                <span>No hidden prompts for this category</span>
              </div>
            ) : (
              hideList.map((prompt, index) => {
                const isDragging = draggedPromptId === prompt.id;
                const isDragOver = dragOverPromptId === prompt.id;

                return (
                  <div
                    key={prompt.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, prompt.id)}
                    onDragOver={(e) => handleDragOver(e, prompt.id)}
                    onDrop={(e) => handleDrop(e, prompt.id)}
                    onDragEnd={() => {
                      setDraggedPromptId(null);
                      setDragOverPromptId(null);
                    }}
                    className={`bg-white dark:bg-zinc-800/90 rounded-xl px-3.5 py-3 border transition-all flex items-center justify-between group shadow-2xs hover:shadow-xs select-none ${
                      isDragging ? 'opacity-40 border-dashed border-blue-400' : ''
                    } ${
                      isDragOver ? 'border-[#1677ff] ring-2 ring-[#1677ff]/20' : 'border-zinc-200/70 dark:border-zinc-700/60'
                    }`}
                  >
                    {/* Left: Drag handle, Icon, Title */}
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-500 cursor-grab active:cursor-grabbing flex items-center justify-center">
                        <HolderOutlined className="text-xs" />
                      </span>

                      <span className="text-zinc-600 dark:text-zinc-300 flex items-center justify-center flex-shrink-0">
                        <PromptIcon name={prompt.icon} size={15} />
                      </span>

                      <span className="text-xs sm:text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">
                        {prompt.title}
                      </span>
                    </div>

                    {/* Right: Actions (Edit, Delete, Show) */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center gap-1.5 flex-shrink-0">
                      {/* Reorder Up/Down Helpers */}
                      <div className="flex items-center gap-0.5 mr-1 text-zinc-400">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => handleMovePrompt(hideList, index, 'up')}
                          className="p-1 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 disabled:hover:text-zinc-400 cursor-pointer"
                          title="Move Up"
                        >
                          <ArrowUpOutlined className="text-[10px]" />
                        </button>
                        <button
                          type="button"
                          disabled={index === hideList.length - 1}
                          onClick={() => handleMovePrompt(hideList, index, 'down')}
                          className="p-1 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-20 disabled:hover:text-zinc-400 cursor-pointer"
                          title="Move Down"
                        >
                          <ArrowDownOutlined className="text-[10px]" />
                        </button>
                      </div>

                      {/* Edit Button */}
                      <Tooltip title="Edit">
                        <button
                          type="button"
                          onClick={() => handleOpenEditPrompt(prompt)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        >
                          <EditOutlined className="text-xs" />
                        </button>
                      </Tooltip>

                      {/* Delete Button (Only for custom user prompts) */}
                      {prompt.isCustom && (
                        <Tooltip title="Delete">
                          <button
                            type="button"
                            onClick={() => handleDeletePrompt(prompt)}
                            className="p-1.5 text-zinc-400 hover:text-red-500 rounded-md hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                          >
                            <DeleteOutlined className="text-xs" />
                          </button>
                        </Tooltip>
                      )}

                      {/* Show Button */}
                      <Tooltip title="Show">
                        <button
                          type="button"
                          onClick={() => handleTogglePromptVisibility(prompt, activeCategory)}
                          className="p-1.5 text-zinc-400 hover:text-[#1677ff] rounded-md hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors cursor-pointer"
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
