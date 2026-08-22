import React, { useState } from 'react';
import { theme } from 'antd';
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
  const { token } = theme.useToken();
  const [collapsed, setCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState<WorkspaceTab>('Chat');

  // Spacing scale {4,8,16,24,32}; only {4,8,16,24,32} per UI-SPEC.
  // Border-radius token for the rounded left-corner workspace card.
  const SURFACE_BG = token.colorBgLayout; // outer Sider surface
  const CARD_BG = token.colorBgContainer; // inner workspace card surface
  const CARD_BORDER = token.colorBorderSecondary;

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        overflow: 'hidden',
        backgroundColor: SURFACE_BG,
        fontFamily: token.fontFamily,
      }}
    >
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
      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          backgroundColor: CARD_BG,
          borderTopLeftRadius: token.borderRadiusLG * 3,
          borderBottomLeftRadius: token.borderRadiusLG * 3,
          borderLeft: `1px solid ${CARD_BORDER}`,
          borderTop: `1px solid ${CARD_BORDER}`,
          borderBottom: `1px solid ${CARD_BORDER}`,
          position: 'relative',
        }}
      >
        {activeMenu === 'Chat' && (
          <div
            style={{
              height: '100%',
              width: '100%',
              position: 'relative',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <SidepanelChat
              onOpenOptions={onOpenOptions}
              onOpenStandalone={() => {}}
              isStandalone={true}
            />
          </div>
        )}

        {activeMenu === 'Tools' && <ToolsGridPanel />}

        {activeMenu === 'Note' && (
          <div style={{ height: '100%', width: '100%', overflow: 'hidden' }}>
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
