import React, { useState, useRef } from 'react';
import { Popover, Tooltip } from 'antd';
import {
  FolderAddOutlined,
  CompassOutlined,
  CheckCircleFilled,
  GithubOutlined,
  GlobalOutlined,
  RightOutlined,
  LeftOutlined,
  LinkOutlined,
  PaperClipOutlined,
  PictureOutlined,
  DesktopOutlined,
} from '@ant-design/icons';
import { TabItem, Attachment } from '../../types';

interface TabContextSelectorProps {
  availableTabs: TabItem[];
  onToggleTab: (tabId: string) => void;
  onSelectScreenCut: () => void;
  onAddAttachment: (attachment: Attachment) => void;
  onOpenPromptManager?: () => void;
  hideTabs?: boolean;
}

export const TabContextSelector: React.FC<TabContextSelectorProps> = ({
  availableTabs,
  onToggleTab,
  onSelectScreenCut,
  onAddAttachment,
  onOpenPromptManager,
  hideTabs = false,
}) => {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'main' | 'tabs'>('main');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setView('main');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAddAttachment({
        id: 'doc_' + Date.now(),
        type: 'document',
        title: file.name,
        content: `[Attached Document: ${file.name}]`,
      });
      setOpen(false);
      setView('main');
    }
    if (e.target) e.target.value = '';
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        onAddAttachment({
          id: 'img_' + Date.now(),
          type: 'image',
          title: file.name,
          thumbnail: reader.result as string,
        });
        setOpen(false);
        setView('main');
      };
      reader.readAsDataURL(file);
    }
    if (e.target) e.target.value = '';
  };

  const popoverContent = (
    <div className="w-72 p-1.5 text-xs text-zinc-800 dark:text-zinc-200 select-none">
      {view === 'main' ? (
        <div>
          {/* Header */}
          <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-xs px-2 pt-0.5 pb-2">
            Add context
          </div>

          {/* Add tabs Header / Button */}
          {!hideTabs && (
            <>
              <button
                type="button"
                onClick={() => setView('tabs')}
                className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-left font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <LinkOutlined className="text-zinc-500 text-sm" />
                  <span className="font-medium">Add tabs</span>
                </div>
                <RightOutlined className="text-[10px] text-zinc-400" />
              </button>

              {/* Preview top 3 tabs */}
              {availableTabs.length > 0 && (
                <div className="flex flex-col gap-0.5 my-1 pl-1">
                  {availableTabs.slice(0, 3).map(tab => {
                    const isGithub = tab.url?.includes('github');
                    return (
                      <div
                        key={tab.id}
                        onClick={() => onToggleTab(tab.id)}
                        className="flex items-center justify-between px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          {isGithub ? (
                            <GithubOutlined className="text-sm text-zinc-700 dark:text-zinc-300 shrink-0" />
                          ) : (
                            <GlobalOutlined className="text-sm text-blue-500 shrink-0" />
                          )}
                          <span className="truncate text-zinc-700 dark:text-zinc-300 font-normal">{tab.title}</span>
                          {tab.isCurrent && (
                            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0">• Current tab</span>
                          )}
                        </div>
                        {tab.selected ? (
                          <CheckCircleFilled className="text-blue-500 text-sm shrink-0" />
                        ) : (
                          <div className="w-3.5 h-3.5 rounded-full border border-zinc-300 dark:border-zinc-600 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="h-px bg-zinc-200 dark:bg-zinc-700/60 my-1.5" />
            </>
          )}

          {/* Attach files */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-left font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer transition-colors text-xs"
          >
            <PaperClipOutlined className="text-zinc-500 text-sm" />
            <span>Attach files</span>
          </button>

          {/* Add image */}
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-left font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer transition-colors text-xs"
          >
            <PictureOutlined className="text-zinc-500 text-sm" />
            <span>Add image</span>
          </button>

          {/* Select from screen */}
          <button
            type="button"
            onClick={() => {
              onSelectScreenCut();
              setOpen(false);
            }}
            className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-left font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer transition-colors text-xs"
          >
            <div className="flex items-center gap-2">
              <DesktopOutlined className="text-zinc-500 text-sm" />
              <span>Select from screen</span>
            </div>
            <span className="bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
              NEW
            </span>
          </button>

          <div className="h-px bg-zinc-200 dark:bg-zinc-700/60 my-1.5" />

          {/* Browse skills - Moved to bottom */}
          <button
            type="button"
            onClick={() => {
              if (onOpenPromptManager) {
                onOpenPromptManager();
              }
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-left font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer transition-colors text-xs"
          >
            <CompassOutlined className="text-zinc-500 text-sm" />
            <span>Browse skills</span>
          </button>
        </div>
      ) : (
        /* Tabs Sub-View */
        <div>
          {/* Back Button Header */}
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setView('main')}
              className="flex items-center gap-1.5 px-3 py-1 bg-zinc-200/80 dark:bg-zinc-700/80 hover:bg-zinc-300 dark:hover:bg-zinc-600 rounded-lg text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer transition-colors"
            >
              <LeftOutlined className="text-[10px]" />
              <span>Back</span>
            </button>
          </div>

          {/* List of All Tabs */}
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
            {availableTabs.map(tab => {
              const isGithub = tab.url?.includes('github');
              return (
                <div
                  key={tab.id}
                  onClick={() => onToggleTab(tab.id)}
                  className="flex items-center justify-between px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg cursor-pointer transition-colors text-xs"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    {isGithub ? (
                      <GithubOutlined className="text-sm text-zinc-700 dark:text-zinc-300 shrink-0" />
                    ) : (
                      <GlobalOutlined className="text-sm text-blue-500 shrink-0" />
                    )}
                    <span className="truncate text-zinc-700 dark:text-zinc-300 font-normal">{tab.title}</span>
                    {tab.isCurrent && (
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500 shrink-0">• Current tab</span>
                    )}
                  </div>
                  {tab.selected ? (
                    <CheckCircleFilled className="text-blue-500 text-sm shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-zinc-300 dark:border-zinc-600 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hidden File Inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".doc,.docx,.txt,.md,.pdf,.json,.csv"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageChange}
      />
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      placement="top"
      overlayClassName="tab-context-popover"
    >
      <Tooltip title="Attach">
        <button
          type="button"
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300 cursor-pointer transition-colors text-xs flex items-center justify-center"
        >
          <PaperClipOutlined className="text-base" />
        </button>
      </Tooltip>
    </Popover>
  );
};
