import React, { useState } from 'react';
import { WorkspaceSidebar, WorkspaceTab } from './WorkspaceSidebar';
import { SidepanelChat } from '../chat/SidepanelChat';
import { NotesWorkspace } from '../notes/NotesWorkspace';
import { StandaloneWritePage } from './StandaloneWritePage';
import { ToolsGridPanel } from './ToolsGridPanel';
import { TeamsPanel } from './TeamsPanel';

interface StandaloneWorkspaceProps {
  onOpenOptions?: () => void;
  onOpenSidepanel?: () => void;
}

export const StandaloneWorkspace: React.FC<StandaloneWorkspaceProps> = ({
  onOpenOptions,
  onOpenSidepanel,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState<WorkspaceTab>('Chat');

  return (
    <div className="h-full w-full flex overflow-hidden bg-[#eceef0] dark:bg-zinc-950 font-sans">
      {/* NowPilot Navigation */}
      <WorkspaceSidebar
        activeMenu={activeMenu}
        onSelectMenu={setActiveMenu}
        collapsed={collapsed}
        onToggleCollapsed={setCollapsed}
        onOpenSidepanel={onOpenSidepanel}
        onOpenOptions={onOpenOptions}
      />

      {/* Main Content Workspace Card with Rounded Left Corner */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-zinc-900 rounded-tl-3xl rounded-bl-3xl shadow-xs border-l border-t border-b border-zinc-200/60 dark:border-zinc-800/80 relative">
        {activeMenu === 'Chat' && (
          <div className="h-full w-full relative overflow-hidden flex flex-col">
            <SidepanelChat
              onOpenOptions={onOpenOptions}
              onOpenStandalone={() => {}}
              isStandalone={true}
            />
          </div>
        )}

        {activeMenu === 'Tools' && <ToolsGridPanel />}

        {activeMenu === 'Note' && (
          <div className="h-full w-full overflow-hidden">
            <NotesWorkspace />
          </div>
        )}

        {activeMenu === 'Write' && (
          <StandaloneWritePage onOpenOptions={onOpenOptions} />
        )}

        {activeMenu === 'Teams' && <TeamsPanel />}
      </main>
    </div>
  );
};
