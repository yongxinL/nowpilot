import React, { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import { SidePanelShell } from '../../src/components/sidepanel/SidePanelShell';
import { getAppTheme } from '../../src/styles/theme';
import { useThemeStore } from '../../src/core/theme/ThemeStore';
import { pageContentService } from '../../src/core/extraction/PageContentService';
import '../../src/index.css';

// Initialize page content service listeners (SPA_NAVIGATION, tabs.onUpdated,
// tabs.onRemoved) for per-tab cache invalidation and MiniSearch index
// lifecycle. Safe to call multiple times — subsequent calls are no-ops
// (init() has idempotent guard).
pageContentService.init();

const SidepanelApp = () => {
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = useMemo(() => getAppTheme(isDark), [isDark]);

  return (
    <ConfigProvider theme={theme}>
      <AntdApp className="h-screen w-screen overflow-hidden">
        <SidePanelShell />
      </AntdApp>
    </ConfigProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<SidepanelApp />);
}
