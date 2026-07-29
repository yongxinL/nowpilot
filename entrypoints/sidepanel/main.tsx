import React, { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import { SidePanelShell } from '../../src/components/sidepanel/SidePanelShell';
import { getAppTheme } from '../../src/styles/theme';
import { useThemeStore } from '../../src/core/theme/ThemeStore';
import '../../src/index.css';

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
