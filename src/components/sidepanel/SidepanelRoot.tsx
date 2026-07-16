import { useEffect, useMemo, useRef, useState } from 'react';
import { App, ConfigProvider } from 'antd';
import { getAntdConfig } from '../../core/theme/antdConfig';
import { useTheme } from '../../hooks/useTheme';
import { useWorkspaceStore } from '../../core/stores/workspaceStore';
import { openStandalone } from '../../core/routing/workspaceRouter';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { SidepanelContent } from './SidepanelContent';
import { SidepanelSider, SIDEPANEL_NARROW_MAX_WIDTH } from './SidepanelSider';
import { SiderTrigger } from '../sider/SiderTrigger';
import { SiderPopup } from '../sider/SiderPopup';
import { ApplicationFrame } from '../common/ApplicationFrame';

export interface SidepanelRootProps {
  initialActiveId?: string;
  initialCollapsed?: boolean;
  renderActivePage?: (item: NowPilotNavItem) => React.ReactNode;
}

const NARROW_MAX = SIDEPANEL_NARROW_MAX_WIDTH;

export function SidepanelRoot({ initialActiveId, initialCollapsed, renderActivePage }: SidepanelRootProps) {
  const { isDark } = useTheme();
  const setActiveSurface = useWorkspaceStore((s) => s.setActiveSurface);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(800);
  const [userCollapsed, setUserCollapsed] = useState<boolean>(Boolean(initialCollapsed));
  const [activeId, setActiveId] = useState<string>(initialActiveId ?? 'chat');
  const [popupOpen, setPopupOpen] = useState<boolean>(false);

  useEffect(() => {
    setActiveSurface('sidepanel');
  }, [setActiveSurface]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        setMeasuredWidth((prev) => (Math.abs(prev - w) > 0.5 ? w : prev));
      }
    });
    observer.observe(el);
    setMeasuredWidth(el.clientWidth);
    return () => observer.disconnect();
  }, []);

  const density = useMemo<'expanded' | 'narrow' | 'collapsed'>(() => {
    if (userCollapsed) return 'collapsed';
    if (measuredWidth > NARROW_MAX) return 'expanded';
    return 'narrow';
  }, [userCollapsed, measuredWidth]);

  const antdConfig = useMemo(() => getAntdConfig({ mode: isDark ? 'dark' : 'light', compact: true }), [isDark]);

  const handleSelect = (item: NowPilotNavItem) => {
    setActiveId(item.id);
    if (density === 'collapsed') setPopupOpen(false);
  };

  const handleCollapse = () => setUserCollapsed(true);
  const handleExpand = () => {
    setUserCollapsed(false);
    setPopupOpen(false);
  };

  const handleOpenStandalone = async () => {
    await openStandalone();
    try {
      const win = await chrome.windows.getCurrent();
      if (win.id != null) await chrome.sidePanel.close({ windowId: win.id });
    } catch {}
  };

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <ConfigProvider theme={antdConfig}>
      <App style={{ width: '100%', height: '100%' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
          <ApplicationFrame surface="sidepanel">
            <ErrorBoundary>
              <SidepanelContent activeNavId={activeId}>
                {renderActivePage
                  ? renderActivePage({
                      id: activeId,
                      label: '',
                      icon: null,
                      group: 'core',
                      order: 0,
                      surfaces: ['sidepanel'],
                    } as NowPilotNavItem)
                  : null}
              </SidepanelContent>
              {density !== 'collapsed' ? (
                <SidepanelSider
                  density={density === 'narrow' ? 'narrow' : 'expanded'}
                  activeId={activeId}
                  onSelect={handleSelect}
                  onCollapse={handleCollapse}
                  onOpenStandalone={handleOpenStandalone}
                  onOpenOptions={handleOpenOptions}
                />
              ) : null}
              {density === 'collapsed' ? (
                <>
                  <SiderTrigger mode="collapsed-float" onActivate={() => setPopupOpen((v) => !v)} />
                  <SiderPopup
                    open={popupOpen}
                    onOpenChange={setPopupOpen}
                    activeId={activeId}
                    onSelect={handleSelect}
                    onExpand={handleExpand}
                    onOpenStandalone={handleOpenStandalone}
                    onOpenOptions={handleOpenOptions}
                  />
                </>
              ) : null}
            </ErrorBoundary>
          </ApplicationFrame>
        </div>
      </App>
    </ConfigProvider>
  );
}