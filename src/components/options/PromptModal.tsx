import React, { useState, useEffect } from 'react';
import { Tooltip, Popover } from 'antd';
import { QuestionCircleOutlined, CloseOutlined, CheckOutlined } from '@ant-design/icons';
import { PromptItem, PromptCategory } from '../../types';
import { PromptIcon, PROMPT_ICON_NAMES } from './PromptIcon';

interface PromptModalProps {
  open: boolean;
  prompt?: PromptItem | null;
  onClose: () => void;
  onSave: (data: {
    title: string;
    content: string;
    usedIn: PromptCategory[];
    icon: string;
  }) => void;
}

const CATEGORY_OPTIONS: { key: PromptCategory; label: string }[] = [
  { key: 'Chat/Ask', label: 'Chat/Ask' },
  { key: 'Reading', label: 'Reading' },
  { key: 'Writing', label: 'Writing' },
];

export const PromptModal: React.FC<PromptModalProps> = ({
  open,
  prompt,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [usedIn, setUsedIn] = useState<PromptCategory[]>(['Chat/Ask', 'Reading', 'Writing']);
  const [icon, setIcon] = useState<string>('Sparkles');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState('');
  const [error, setError] = useState<{ title?: string; content?: string }>({});

  const isSystemPrompt = Boolean(prompt && !prompt.isCustom);

  useEffect(() => {
    if (open) {
      if (prompt) {
        setTitle(prompt.title || '');
        setContent(prompt.content || '');
        setIcon(prompt.icon || 'Sparkles');
        if (prompt.usedIn && prompt.usedIn.length > 0) {
          setUsedIn(prompt.usedIn);
        } else {
          setUsedIn([prompt.category || 'Chat/Ask']);
        }
      } else {
        setTitle('');
        setContent('');
        setUsedIn(['Chat/Ask', 'Reading', 'Writing']);
        setIcon('Sparkles');
      }
      setError({});
      setIconPickerOpen(false);
      setIconSearch('');
    }
  }, [open, prompt]);

  if (!open) return null;

  const isAllSelected = CATEGORY_OPTIONS.every((c) => usedIn.includes(c.key));

  const handleToggleAll = () => {
    if (isAllSelected) {
      setUsedIn([]);
    } else {
      setUsedIn(CATEGORY_OPTIONS.map((c) => c.key));
    }
  };

  const handleToggleCategory = (cat: PromptCategory) => {
    if (usedIn.includes(cat)) {
      setUsedIn(usedIn.filter((c) => c !== cat));
    } else {
      setUsedIn([...usedIn, cat]);
    }
  };

  const handleSave = () => {
    if (!isSystemPrompt) {
      const newErrors: { title?: string; content?: string } = {};
      if (!title.trim()) {
        newErrors.title = 'Prompt name is required';
      }
      if (!content.trim()) {
        newErrors.content = 'Prompt content is required';
      }

      if (Object.keys(newErrors).length > 0) {
        setError(newErrors);
        return;
      }
    }

    onSave({
      title: title.trim(),
      content: content.trim(),
      usedIn: usedIn.length > 0 ? usedIn : ['Chat/Ask'],
      icon,
    });
    onClose();
  };

  const filteredIcons = PROMPT_ICON_NAMES.filter((name) =>
    name.toLowerCase().includes(iconSearch.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-fade-in">
      <div
        className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 w-full max-w-[490px] overflow-hidden transition-all transform animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-7 pt-6 pb-2">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 m-0">
            {prompt ? 'Edit Prompt' : 'New Prompt'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <CloseOutlined className="text-xs" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-7 py-4 space-y-5 max-h-[78vh] overflow-y-auto">
          {/* Prompt Name */}
          <div>
            <label className="block text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1.5">
              {!isSystemPrompt && <span className="text-red-500 mr-1">*</span>}
              Prompt Name
            </label>
            {isSystemPrompt ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400 select-text py-0.5 font-normal">
                {title}
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Name your prompt"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (error.title) setError((prev) => ({ ...prev, title: undefined }));
                  }}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800/80 placeholder-zinc-400 outline-none transition-all ${
                    error.title
                      ? 'border-red-500 ring-2 ring-red-500/10'
                      : 'border-zinc-200 dark:border-zinc-700 focus:border-[#6035f5] focus:ring-2 focus:ring-[#6035f5]/10'
                  }`}
                />
                {error.title && <p className="text-red-500 text-xs mt-1">{error.title}</p>}
              </>
            )}
          </div>

          {/* Prompt Content */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {!isSystemPrompt && <span className="text-red-500 mr-1">*</span>}
                Prompt Content
              </label>
              <Tooltip title="Prompt templates can include context or instructions for AI response generation.">
                <QuestionCircleOutlined className="text-zinc-400 text-xs cursor-help hover:text-zinc-600" />
              </Tooltip>
            </div>
            {isSystemPrompt ? (
              <div className="text-sm text-zinc-500 dark:text-zinc-400 select-text leading-relaxed whitespace-pre-wrap py-0.5 font-normal">
                {content}
              </div>
            ) : (
              <>
                <textarea
                  placeholder="Paste or input content here"
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    if (error.content) setError((prev) => ({ ...prev, content: undefined }));
                  }}
                  rows={6}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-800/80 placeholder-zinc-400 outline-none resize-y font-sans leading-relaxed transition-all ${
                    error.content
                      ? 'border-red-500 ring-2 ring-red-500/10'
                      : 'border-zinc-200 dark:border-zinc-700 focus:border-[#6035f5] focus:ring-2 focus:ring-[#6035f5]/10'
                  }`}
                />
                {error.content && <p className="text-red-500 text-xs mt-1">{error.content}</p>}
              </>
            )}
          </div>

          {/* Used in */}
          <div>
            <label className="block text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-3">
              Used in
            </label>
            <div className="flex items-center gap-5 flex-wrap">
              {/* All Checkbox */}
              <button
                type="button"
                onClick={handleToggleAll}
                className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer select-none group"
              >
                <div
                  className={`w-4 h-4 rounded-[4px] flex items-center justify-center transition-all ${
                    isAllSelected
                      ? 'bg-[#6035f5] text-white shadow-2xs'
                      : 'border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'
                  }`}
                >
                  {isAllSelected && <CheckOutlined className="text-[10px] stroke-[3]" />}
                </div>
                <span className="font-medium">All</span>
              </button>

              {/* Individual Categories */}
              {CATEGORY_OPTIONS.map((cat) => {
                const checked = usedIn.includes(cat.key);
                return (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => handleToggleCategory(cat.key)}
                    className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer select-none group"
                  >
                    <div
                      className={`w-4 h-4 rounded-[4px] flex items-center justify-center transition-all ${
                        checked
                          ? 'bg-[#6035f5] text-white shadow-2xs'
                          : 'border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'
                      }`}
                    >
                      {checked && <CheckOutlined className="text-[10px] stroke-[3]" />}
                    </div>
                    <span className="font-medium">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Icon Selection (Only for custom/new prompts) */}
          {!isSystemPrompt && (
            <div>
              <label className="block text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                Icon
              </label>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 flex items-center justify-center text-zinc-700 dark:text-zinc-200 shadow-2xs">
                  <PromptIcon name={icon} size={18} />
                </div>

                <Popover
                  open={iconPickerOpen}
                  onOpenChange={setIconPickerOpen}
                  trigger="click"
                  placement="bottomLeft"
                  content={
                    <div className="w-64 p-2">
                      <input
                        type="text"
                        placeholder="Search icon..."
                        value={iconSearch}
                        onChange={(e) => setIconSearch(e.target.value)}
                        className="w-full px-2.5 py-1.5 mb-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none"
                        autoFocus
                      />
                      <div className="grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto p-1">
                        {filteredIcons.map((iconName) => (
                          <button
                            key={iconName}
                            type="button"
                            onClick={() => {
                              setIcon(iconName);
                              setIconPickerOpen(false);
                            }}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                              icon.toLowerCase() === iconName.toLowerCase()
                                ? 'bg-[#6035f5] text-white'
                                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                            }`}
                            title={iconName}
                          >
                            <PromptIcon name={iconName} size={16} />
                          </button>
                        ))}
                      </div>
                    </div>
                  }
                >
                  <button
                    type="button"
                    className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl text-xs font-semibold text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
                  >
                    Change
                  </button>
                </Popover>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-7 py-4.5 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 rounded-xl bg-[#6035f5] hover:bg-[#522cd9] text-white text-sm font-medium shadow-xs transition-colors cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

