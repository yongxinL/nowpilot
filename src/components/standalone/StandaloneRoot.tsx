import { useEffect, useRef, useState } from 'react';
import { App, ConfigProvider, Drawer, theme } from 'antd';
import { getAntdConfig } from '../../core/theme/antdConfig';
import { useTheme } from '../../hooks/useTheme';
import { useWorkspaceStore } from '../../core/stores/workspaceStore';
import { useRightPaneStore } from '../../core/stores/RightPaneStore';
import { debugLog } from '../../core/utils/debugLog';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';
import { WorkspaceStatusBar } from '../common/WorkspaceStatusBar';
import { ApplicationFrame } from '../common/ApplicationFrame';
import { StandaloneSider, STANDALONE_NAVBAR_WIDTH } from './StandaloneSider';
import { StandaloneContent } from './StandaloneContent';
import { RightPane } from './RightPane';
import { PaneToggle } from './PaneToggle';

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
  const { isDark } = useTheme();
  const setActiveSurface = useWorkspaceStore((s) => s.setActiveSurface);
  const activeProvider = useWorkspaceStore((s) => s.activeProvider);
  const [collapsed, setCollapsed] = useState<boolean>(initialCollapsed);
  const [activeId, setActiveId] = useState<string>(initialActiveId ?? 'chat');

  useEffect(() => {
    setActiveSurface('standalone');
  }, [setActiveSurface]);

  const antdConfig = getAntdConfig({ mode: isDark ? 'dark' : 'light', compact: false });
  const density: 'expanded' | 'collapsed' = collapsed ? 'collapsed' : 'expanded';

  const handleSelect = (item: NowPilotNavItem) => {
    setActiveId(item.id);
  };

  const handleSwitchToSidePanel = async () => {
    try {
      await chrome.sidePanel.open({} as never);
      const tab = await chrome.tabs.getCurrent();
      if (tab?.id) await chrome.tabs.remove(tab.id);
    } catch {}
  };

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <ConfigProvider theme={antdConfig}>
      <App style={{ width: '100%', height: '100%' }}>
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
      </App>
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const { visible, width, setVisible } = useRightPaneStore();

  // D-08: Page availability — right pane visible on Chat/Agent, hidden on Options/Diagnostics
  const isPaneAvailable = ['chat', 'agent'].includes(activeId);

  // RESARCH.md Pitfall 5: Track container width via ResizeObserver (not window.innerWidth)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let prevWidth = 0;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = Math.floor(entry.contentRect.width);
        setContainerWidth(newWidth);

        // Debug: log breakpoint crossing
        if (prevWidth > 0 && ((prevWidth < 720 && newWidth >= 720) || (prevWidth >= 720 && newWidth < 720))) {
          debugLog('info', `[StandaloneRoot] Breakpoint cross: ${prevWidth}px → ${newWidth}px ${newWidth < 720 ? '(Drawer mode)' : '(inline mode)'}`);
        }
        prevWidth = newWidth;
      }
    });
    observer.observe(el);

    return () => {
      observer.disconnect();
      debugLog('info', '[StandaloneRoot] ResizeObserver disconnected');
    };
  }, []);

  // Sync visibility with page availability (D-08): hide pane on non-Chat/Agent pages
  useEffect(() => {
    if (!isPaneAvailable) {
      if (visible) {
        debugLog('info', `[StandaloneRoot] Hiding right pane for page: ${activeId} (D-08)`);
      }
      setVisible(false);
    }
  }, [isPaneAvailable, visible, activeId, setVisible]);

  // Responsive breakpoint (Pitfall 5): containerWidth < 720px = Drawer overlay
  // 720 = 320px (compact right pane) + 400px (minimum chat area)
  const rightPaneWidth = width === 'compact' ? 320 : Math.floor(containerWidth * 0.45);
  const isSmallScreen = containerWidth > 0 && containerWidth < 720;
  const showRightPane = visible && isPaneAvailable && containerWidth > 0;

  // Debug: log pane transitions via useEffect (avoids render-time variable ordering issues)
  const prevModeRef = useRef<'hidden' | 'inline' | 'drawer'>('hidden');
  useEffect(() => {
    const paneMode: 'hidden' | 'inline' | 'drawer' =
      !showRightPane ? 'hidden' : isSmallScreen ? 'drawer' : 'inline';
    if (prevModeRef.current !== paneMode) {
      debugLog('info', `[StandaloneRoot] Pane mode: ${prevModeRef.current} → ${paneMode} (width=${containerWidth}px, visible=${visible}, available=${isPaneAvailable})`);
      prevModeRef.current = paneMode;
    }
  }, [showRightPane, isSmallScreen, containerWidth, visible, isPaneAvailable]);

  // Remove right margin from chat content column when pane is visible inline
  const contentMargin =
    showRightPane && !isSmallScreen ? '12px 0 12px 0' : '12px 12px 12px 0';

  return (
    <div ref={containerRef} style={{ flex: 1, minWidth: 0, display: 'flex' }}>
      {/* Left column — Chat/Agent content */}
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
          margin: contentMargin,
        }}
      >
        <StandaloneContent
          activeNavId={activeId}
          footer={activeId === 'chat' ? null : <WorkspaceStatusBar surface="standalone" flush {...(statusBar ?? {})} />}
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

      {/* PaneToggle divider + RightPane — only when inline (>= 720px) */}
      {showRightPane && !isSmallScreen && (
        <>
          <PaneToggle />
          <RightPane width={rightPaneWidth} />
        </>
      )}

      {/* Drawer overlay — for small containers (< 720px) */}
      <Drawer
        placement="right"
        size={320}
        open={showRightPane && isSmallScreen}
        onClose={() => setVisible(false)}
        destroyOnClose
        styles={{ body: { padding: 0 } }}
      >
        <RightPane width={320} />
      </Drawer>
    </div>
  );
}