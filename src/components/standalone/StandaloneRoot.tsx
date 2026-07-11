import { useEffect, useState } from 'react';
import { ConfigProvider } from 'antd';
import { getAntdConfig } from '../../core/theme/antdConfig';
import { useThemeStore } from '../../core/stores/themeStore';
import { useWorkspaceStore } from '../../core/stores/workspaceStore';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';
import { WorkspaceStatusBar } from '../common/WorkspaceStatusBar';
import { StandaloneNavbar } from './StandaloneNavbar';
import { StandaloneMainArea } from './StandaloneMainArea';

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
      <div
        role="application"
        aria-label="NowPilot Standalone"
        data-surface="standalone"
        data-density={density}
        style={{
          width: '100%',
          height: '100vh',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
        }}
      >
        <ErrorBoundary>
          <StandaloneNavbar
            density={density}
            activeId={activeId}
            onSelect={handleSelect}
            onCollapseToggle={() => setCollapsed((v) => !v)}
            onSwitchToSidePanel={handleSwitchToSidePanel}
            onOpenOptions={handleOpenOptions}
          />
          <StandaloneMainArea
            activeNavId={activeId}
            footer={<WorkspaceStatusBar surface="standalone" {...(statusBar ?? {})} />}
          >
            {renderActivePage
              ? renderActivePage({ id: activeId, label: '', icon: null, group: 'A', order: 0, surfaces: ['standalone'] } as NowPilotNavItem)
              : null}
          </StandaloneMainArea>
        </ErrorBoundary>
      </div>
    </ConfigProvider>
  );
}
