import React from 'react';
import { Tooltip, Popover, Button } from 'antd';
import { SettingOutlined, RightOutlined, CheckCircleFilled } from '@ant-design/icons';
import { NowPilotAvatar } from '../common/NowPilotAvatar';
import { UserAvatar } from '../common/UserAvatar';

export type WorkspaceTab = 'Chat' | 'Note' | 'Write' | 'Tools' | 'Teams';

interface WorkspaceSidebarProps {
  activeMenu: WorkspaceTab;
  onSelectMenu: (menu: WorkspaceTab) => void;
  collapsed: boolean;
  onToggleCollapsed: (collapsed: boolean) => void;
  onOpenSidepanel?: () => void;
  onOpenOptions?: () => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  activeMenu,
  onSelectMenu,
  collapsed,
  onToggleCollapsed,
  onOpenSidepanel,
  onOpenOptions,
}) => {
  const navMenuItems: { key: WorkspaceTab; label: string; icon: React.ReactNode }[] = [
    {
      key: 'Chat',
      label: 'Chat',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      key: 'Note',
      label: 'Note',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      ),
    },
    {
      key: 'Write',
      label: 'Write',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      ),
    },
    {
      key: 'Tools',
      label: 'Tools',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
        </svg>
      ),
    },
    {
      key: 'Teams',
      label: 'Teams',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
  ];

  const userProfileContent = (
    <div className="w-56 p-2">
      <div className="flex items-center gap-3 pb-3 border-b border-zinc-100 dark:border-zinc-800">
        <UserAvatar size={36} />
        <div>
          <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">User Account</div>
          <div className="text-[11px] text-zinc-400">NowPilot Workspace</div>
        </div>
      </div>
      <div className="py-2 space-y-1.5 text-xs text-zinc-600 dark:text-zinc-300">
        <div className="flex items-center justify-between">
          <span>Plan</span>
          <span className="font-medium text-emerald-600 flex items-center gap-1">
            <CheckCircleFilled className="text-[10px]" /> Pro Active
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Mode</span>
          <span className="font-medium">Standalone Tab</span>
        </div>
      </div>
      {onOpenOptions && (
        <Button
          type="default"
          size="small"
          block
          icon={<SettingOutlined />}
          onClick={onOpenOptions}
          className="mt-1"
        >
          Manage Settings
        </Button>
      )}
    </div>
  );

  return (
    <aside
      className={`flex flex-col justify-between transition-all duration-200 select-none shrink-0 ${
        collapsed ? 'w-16 items-center px-2 py-3' : 'w-[230px] px-3.5 py-3'
      } bg-[#eceef0] dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300`}
    >
      {/* Top Section */}
      <div className="w-full flex flex-col items-center">
        {collapsed ? (
          <div className="mb-6 flex justify-center items-center">
            <div className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center shadow-xs">
              <NowPilotAvatar size={36} />
            </div>
          </div>
        ) : (
          <div className="w-full flex items-center justify-between mb-5 px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shadow-xs shrink-0">
                <NowPilotAvatar size={32} />
              </div>
              <span className="font-bold text-sm tracking-tight text-zinc-800 dark:text-zinc-100 select-none">
                NowPilot
              </span>
            </div>

            {onOpenSidepanel && (
              <Tooltip title="Switch to side panel view" placement="right">
                <button
                  type="button"
                  onClick={onOpenSidepanel}
                  className="w-7 h-7 rounded-lg hover:bg-zinc-200/80 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 14 10 14 10 20" />
                    <polyline points="20 10 14 10 14 4" />
                    <line x1="14" y1="10" x2="21" y2="3" />
                    <line x1="3" y1="21" x2="10" y2="14" />
                  </svg>
                </button>
              </Tooltip>
            )}
          </div>
        )}

        {/* Navigation Menu Items */}
        <nav className="w-full flex flex-col gap-1.5">
          {navMenuItems.map((item) => {
            const isActive = activeMenu === item.key;
            const isTeams = item.key === 'Teams';

            return (
              <React.Fragment key={item.key}>
                {isTeams && (
                  <div className="my-1.5 px-2">
                    <div className="h-[1px] w-full bg-zinc-300/80 dark:bg-zinc-800" />
                  </div>
                )}

                {collapsed ? (
                  <Tooltip title={isTeams ? 'Teams (Add-on)' : item.label} placement="right">
                    <button
                      type="button"
                      onClick={() => onSelectMenu(item.key)}
                      className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center cursor-pointer transition-all relative ${
                        isActive
                          ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-xs'
                          : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/80'
                      }`}
                    >
                      {item.icon}
                      {isTeams && (
                        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-500" />
                      )}
                    </button>
                  </Tooltip>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectMenu(item.key)}
                    className={`w-full px-3.5 py-2.5 rounded-xl flex items-center justify-between text-sm font-medium cursor-pointer transition-all ${
                      isActive
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-xs'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800/80'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={isActive ? 'text-blue-600 dark:text-blue-400' : ''}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {isTeams && (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-semibold">
                          Add-on
                        </span>
                        <RightOutlined className="text-[11px] text-zinc-400" />
                      </div>
                    )}
                  </button>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

      {/* Bottom Section */}
      <div className="w-full pt-3">
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            {onOpenOptions && (
              <Tooltip title="Options" placement="right">
                <button
                  type="button"
                  onClick={onOpenOptions}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <SettingOutlined className="text-base" />
                </button>
              </Tooltip>
            )}

            <Popover content={userProfileContent} trigger="click" placement="rightBottom">
              <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-500/30 transition-all shadow-2xs">
                <UserAvatar size={32} />
              </div>
            </Popover>

            <Tooltip title="Expand side navbar" placement="right">
              <button
                type="button"
                onClick={() => onToggleCollapsed(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer mt-1"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="5" x2="19" y2="19" />
                  <polyline points="7 6 13 12 7 18" />
                </svg>
              </button>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center justify-between px-1 py-1">
            <div className="flex items-center gap-2.5">
              <Popover content={userProfileContent} trigger="click" placement="topLeft">
                <div className="w-7 h-7 rounded-full overflow-hidden flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-blue-500/30 transition-all shadow-2xs">
                  <UserAvatar size={28} />
                </div>
              </Popover>

              {onOpenOptions && (
                <Tooltip title="Options" placement="top">
                  <button
                    type="button"
                    onClick={onOpenOptions}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    <SettingOutlined className="text-sm" />
                  </button>
                </Tooltip>
              )}
            </div>

            <Tooltip title="Collapse side navbar" placement="top">
              <button
                type="button"
                onClick={() => onToggleCollapsed(true)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="5" x2="5" y2="19" />
                  <polyline points="17 6 11 12 17 18" />
                </svg>
              </button>
            </Tooltip>
          </div>
        )}
      </div>
    </aside>
  );
};
