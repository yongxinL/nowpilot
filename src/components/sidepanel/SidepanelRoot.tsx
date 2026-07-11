import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfigProvider } from 'antd';
import { getAntdConfig } from '../../core/theme/antdConfig';
import { useThemeStore } from '../../core/stores/themeStore';
import { useWorkspaceStore } from '../../core/stores/workspaceStore';
import { openStandalone } from '../../core/routing/workspaceRouter';
import type { NowPilotNavItem } from '../../core/navigation/navigationTypes';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { SidepanelInteractionArea } from './SidepanelInteractionArea';
import { SidepanelSwitchbar } from './SidepanelSwitchbar';
import { SidepanelCollapsedTrigger } from './SidepanelCollapsedTrigger';
import { SidepanelCollapsedPopup } from './SidepanelCollapsedPopup';

export interface SidepanelRootProps {
  initialActiveId?: string;
  initialCollapsed?: boolean;
  renderActivePage?: (item: NowPilotNavItem) => React.ReactNode;
}

const NARROW_MAX = 400;

export function SidepanelRoot({ initialActiveId, initialCollapsed, renderActivePage }: SidepanelRootProps) {
  const mode = useThemeStore((s) => s.mode);
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

  const antdConfig = useMemo(() => getAntdConfig({ mode, compact: true }), [mode]);

  const handleSelect = (item: NowPilotNavItem) => {
    setActiveId(item.id);
    if (density === 'collapsed') setPopupOpen(false);
  };

  const handleCollapse = () => setUserCollapsed(true);
  const handleExpand = () => {
    setUserCollapsed(false);
    setPopupOpen(false);
  };

  const handleOpenStandalone = () => {
    openStandalone();
  };

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <ConfigProvider {...antdConfig}>
      <div
        ref={containerRef}
        role="application"
        aria-label="NowPilot Side Panel"
        data-surface="sidepanel"
        data-density={density}
        data-measured-width={Math.round(measuredWidth)}
        style={{
          width: '100%',
          height: '100vh',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          background: 'var(--ant-color-bg-layout, transparent)',
        }}
      >
        <ErrorBoundary>
          <SidepanelInteractionArea activeNavId={activeId}>
            {renderActivePage ? renderActivePage({ id: activeId, label: '', icon: null, group: 'A', order: 0, surfaces: ['sidepanel'] } as NowPilotNavItem) : null}
          </SidepanelInteractionArea>
          {density !== 'collapsed' ? (
            <SidepanelSwitchbar
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
              <SidepanelCollapsedTrigger onActivate={() => setPopupOpen((v) => !v)} />
              <SidepanelCollapsedPopup
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
      </div>
    </ConfigProvider>
  );
}
