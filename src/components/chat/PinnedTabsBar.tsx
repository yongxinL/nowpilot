import React, { useState } from 'react';
import {
  UpOutlined,
  DownOutlined,
  CloseOutlined,
  GithubOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { TabItem } from '../../types';

interface PinnedTabsBarProps {
  pinnedTabs: TabItem[];
  onUnpinTab: (tabId: string) => void;
}

export const PinnedTabsBar: React.FC<PinnedTabsBarProps> = ({
  pinnedTabs,
  onUnpinTab,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!pinnedTabs || pinnedTabs.length === 0) return null;

  const count = pinnedTabs.length;

  if (count === 1) {
    const tab = pinnedTabs[0];
    const isGithub = tab.url?.includes('github');
    return (
      <div className="flex items-center justify-between p-2 bg-zinc-100/90 dark:bg-zinc-800/90 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 text-xs mb-2">
        <div className="flex items-center gap-2 truncate pr-2">
          {isGithub ? (
            <GithubOutlined className="text-zinc-700 dark:text-zinc-300 text-sm shrink-0" />
          ) : (
            <GlobalOutlined className="text-blue-500 text-sm shrink-0" />
          )}
          <span className="truncate text-zinc-800 dark:text-zinc-200 font-medium">{tab.title}</span>
          {tab.isCurrent && (
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500 shrink-0">• Current tab</span>
          )}
        </div>
        <button
          onClick={() => onUnpinTab(tab.id)}
          className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer transition-colors"
          title="Unpin tab"
        >
          <CloseOutlined className="text-[10px]" />
        </button>
      </div>
    );
  }

  // Count > 1: Collapsed or Expanded
  if (!isExpanded) {
    return (
      <div
        onClick={() => setIsExpanded(true)}
        className="flex items-center justify-between p-2.5 bg-zinc-100/90 dark:bg-zinc-800/90 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 text-xs mb-2 cursor-pointer transition-colors select-none"
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center -space-x-1.5">
            {pinnedTabs.slice(0, 3).map(t => (
              <div
                key={t.id}
                className="w-5 h-5 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-[10px] text-zinc-600 dark:text-zinc-300 shadow-2xs shrink-0"
              >
                {t.url?.includes('github') ? (
                  <GithubOutlined />
                ) : (
                  <GlobalOutlined className="text-blue-500" />
                )}
              </div>
            ))}
          </div>
          <span className="text-zinc-800 dark:text-zinc-200 font-semibold ml-0.5">
            Sharing {count} tabs
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
          className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
          title="Expand tabs list"
        >
          <UpOutlined className="text-xs" />
        </button>
      </div>
    );
  }

  return (
    <div className="p-2.5 bg-zinc-100/90 dark:bg-zinc-800/90 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 text-xs mb-2 select-none">
      {/* Expanded Header */}
      <div
        onClick={() => setIsExpanded(false)}
        className="flex items-center justify-between font-semibold text-zinc-800 dark:text-zinc-200 mb-2 cursor-pointer hover:opacity-80 transition-opacity"
      >
        <span>Sharing {count} tabs</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(false);
          }}
          className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
          title="Collapse tabs list"
        >
          <DownOutlined className="text-xs" />
        </button>
      </div>

      {/* Expanded Tabs List */}
      <div className="flex flex-col gap-1.5">
        {pinnedTabs.map(tab => {
          const isGithub = tab.url?.includes('github');
          return (
            <div
              key={tab.id}
              className="flex items-center justify-between p-1.5 bg-white dark:bg-zinc-900/90 rounded-lg border border-zinc-200/60 dark:border-zinc-700/60 text-xs"
            >
              <div className="flex items-center gap-2 truncate pr-2">
                {isGithub ? (
                  <GithubOutlined className="text-zinc-700 dark:text-zinc-300 text-sm shrink-0" />
                ) : (
                  <GlobalOutlined className="text-blue-500 text-sm shrink-0" />
                )}
                <span className="truncate text-zinc-800 dark:text-zinc-200 font-normal">{tab.title}</span>
                {tab.isCurrent && (
                  <span className="text-[11px] text-zinc-400 dark:text-zinc-500 shrink-0">• Current tab</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onUnpinTab(tab.id)}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer transition-colors"
                title="Unpin tab"
              >
                <CloseOutlined className="text-[10px]" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
