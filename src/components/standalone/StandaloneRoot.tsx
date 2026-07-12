import { useEffect, useState } from 'react';
import { ConfigProvider, theme } from 'antd';
import { getAntdConfig } from '../../core/theme/antdConfig';
import { useThemeStore } from '../../core/stores/themeStore';
import { useWorkspaceStore } from '../../core/stores/workspaceStore';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';
import { WorkspaceStatusBar } from '../common/WorkspaceStatusBar';
import { ApplicationFrame } from '../common/ApplicationFrame';
import { StandaloneSider, STANDALONE_NAVBAR_WIDTH } from './StandaloneSider';
import { StandaloneContent } from './StandaloneContent';

export interface StandaloneRootProps {
  initialActiveId?: string;
  initialCollapsed?: boolean;
  renderActivePage?: (item: NowPilotNavItem) => React.ReactNode;
  statusBar?: Omit<React.ComponentProps<typeof WorkspaceStatusBar>, 'surface'>;
}

export function StandaloneRoot({
  initialActiveId,
  initialCollapsed = false,
  renderActivePage,
  statusBar,
}: StandaloneRootProps) {
  const mode = useThemeStore((s) => s.mode);
  const setActiveSurface = useWorkspaceStore((s) => s.setActiveSurface);
  const activeProvider = useWorkspaceStore((s) => s.activeProvider);
  const [collapsed, setCollapsed] = useState<boolean>(initialCollapsed);
  const [activeId, setActiveId] = useState<string>(initialActiveId ?? 'chat');

  useEffect(() => {
    setActiveSurface('standalone');
  }, [setActiveSurface]);

  const antdConfig = getAntdConfig({ mode, compact: false });
  const density: 'expanded' | 'collapsed' = collapsed ? 'collapsed' : 'expanded';

  const handleSelect = (item: NowPilotNavItem) => {
    setActiveId(item.id);
  };

  const handleSwitchToSidePanel = () => {
    chrome.sidePanel.open({} as never).catch(() => {});
  };

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <ConfigProvider {...antdConfig}>
      <ApplicationFrame surface="standalone">
        <ErrorBoundary>
          <StandaloneSider
            density={density}
            activeId={activeId}
            onSelect={handleSelect}
            onCollapseToggle={() => setCollapsed((v) => !v)}
            onSwitchToSidePanel={handleSwitchToSidePanel}
            onOpenOptions={handleOpenOptions}
          />
          <StandaloneContentWrapper
            activeId={activeId}
            renderActivePage={renderActivePage}
            statusBar={{
              ...(statusBar ?? {}),
              providerName: statusBar?.providerName ?? activeProvider ?? undefined,
            }}
            navbarWidth={collapsed ? 56 : STANDALONE_NAVBAR_WIDTH}
          />
        </ErrorBoundary>
      </ApplicationFrame>
    </ConfigProvider>
  );
}

function StandaloneContentWrapper({
  activeId,
  renderActivePage,
  statusBar,
  navbarWidth: _navbarWidth,
}: {
  activeId: string;
  renderActivePage?: (item: NowPilotNavItem) => React.ReactNode;
  statusBar?: Omit<React.ComponentProps<typeof WorkspaceStatusBar>, 'surface'>;
  navbarWidth: number;
}) {
  const { token } = theme.useToken();
  return (
    <div
      data-standalone-content-shell="true"
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        overflow: 'hidden',
        background: token.colorBgContainer,
        boxShadow: token.boxShadowSecondary,
        margin: '12px 12px 12px 0',
      }}
    >
      <StandaloneContent
        activeNavId={activeId}
        footer={<WorkspaceStatusBar surface="standalone" flush {...(statusBar ?? {})} />}
      >
        {renderActivePage
          ? renderActivePage({
              id: activeId,
              label: '',
              icon: null,
              group: 'core',
              order: 0,
              surfaces: ['standalone'],
            } as NowPilotNavItem)
          : null}
      </StandaloneContent>
    </div>
  );
}