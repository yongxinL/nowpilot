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

          {/* Screenshot */}
          <button
            type="button"
            onClick={() => {
              onSelectScreenCut();
              setOpen(false);
            }}
            className="w-full flex items-center justify-between px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-left font-medium text-zinc-800 dark:text-zinc-200 cursor-pointer transition-colors text-xs"
          >
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16">
                <path fill="currentColor" fillRule="evenodd" d="M3.09 1.717a.6.6 0 0 0-.848.849L7.22 7.544 6.2 8.566a3.267 3.267 0 1 0 .821.876l1.049-1.05.84.84a.6.6 0 0 0 .14.105 3.267 3.267 0 1 0 .812-.814.6.6 0 0 0-.103-.139l-.84-.84 4.977-4.978a.6.6 0 1 0-.848-.849L8.069 6.695zM2.2 11.2a2.067 2.067 0 1 1 4.133 0 2.067 2.067 0 0 1-4.133 0m7.467 0a2.067 2.067 0 1 1 4.133 0 2.067 2.067 0 0 1-4.133 0" clipRule="evenodd"></path>
              </svg>
              <span>Screenshot</span>
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
          className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-600 dark:text-zinc-300 cursor-pointer transition-colors text-xs flex items-center justify-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path fillRule="evenodd" clipRule="evenodd" d="M2.66669 2.66671C2.48988 2.66671 2.32031 2.73695 2.19528 2.86197C2.07026 2.98699 2.00002 3.15656 2.00002 3.33337V12.6667C2.00002 12.8435 2.07026 13.0131 2.19528 13.1381C2.32031 13.2631 2.48988 13.3334 2.66669 13.3334H13.3334C13.5102 13.3334 13.6797 13.2631 13.8048 13.1381C13.9298 13.0131 14 12.8435 14 12.6667V5.33337C14 5.15656 13.9298 4.98699 13.8048 4.86197C13.6797 4.73694 13.5102 4.66671 13.3334 4.66671H7.33335C7.11045 4.66671 6.9023 4.55531 6.77865 4.36984L5.64323 2.66671H2.66669ZM1.25247 1.91916C1.62755 1.54409 2.13625 1.33337 2.66669 1.33337H6.00002C6.22292 1.33337 6.43108 1.44477 6.55472 1.63024L7.69014 3.33337H13.3334C13.8638 3.33337 14.3725 3.54409 14.7476 3.91916C15.1226 4.29423 15.3334 4.80294 15.3334 5.33337V12.6667C15.3334 13.1971 15.1226 13.7058 14.7476 14.0809C14.3725 14.456 13.8638 14.6667 13.3334 14.6667H2.66669C2.13625 14.6667 1.62755 14.456 1.25247 14.0809C0.877401 13.7058 0.666687 13.1971 0.666687 12.6667V3.33337C0.666687 2.80294 0.877401 2.29423 1.25247 1.91916ZM8.00002 6.66671C8.36821 6.66671 8.66669 6.96518 8.66669 7.33337V8.66671H10C10.3682 8.66671 10.6667 8.96518 10.6667 9.33337C10.6667 9.70156 10.3682 10 10 10H8.66669V11.3334C8.66669 11.7016 8.36821 12 8.00002 12C7.63183 12 7.33335 11.7016 7.33335 11.3334V10H6.00002C5.63183 10 5.33335 9.70156 5.33335 9.33337C5.33335 8.96518 5.63183 8.66671 6.00002 8.66671H7.33335V7.33337C7.33335 6.96518 7.63183 6.66671 8.00002 6.66671Z" fill="currentColor" />
          </svg>
        </button>
      </Tooltip>
    </Popover>
  );
};
