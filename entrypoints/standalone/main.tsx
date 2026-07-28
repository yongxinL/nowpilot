import React, { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import { StandaloneWorkspace } from '../../src/components/standalone/StandaloneWorkspace';
import { getAppTheme } from '../../src/styles/theme';
import { useThemeStore } from '../../src/core/theme/ThemeStore';
import { useThemeSync } from '../../src/core/theme/ThemeSync';
import '../../src/index.css';

const handleOpenOptions = () => {
  const url = chrome.runtime.getURL('options.html');
  chrome.tabs.create({ url });
};

const handleOpenSidepanel = async () => {
  try {
    const win = await chrome.windows.getCurrent();
    if (win?.id !== undefined) {
      await chrome.sidePanel.open({ windowId: win.id });
    }
  } catch {
    // side panel may not be available
  }
};

const StandaloneApp = () => {
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = useMemo(() => getAppTheme(isDark), [isDark]);
  useThemeSync();

  return (
    <ConfigProvider theme={theme}>
      <AntdApp className="h-screen w-screen overflow-hidden">
        <StandaloneWorkspace onOpenOptions={handleOpenOptions} onOpenSidepanel={handleOpenSidepanel} />
      </AntdApp>
    </ConfigProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<StandaloneApp />);
}
