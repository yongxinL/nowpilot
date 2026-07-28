import React, { useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import { SidepanelChat } from '../../src/components/chat/SidepanelChat';
import { getAppTheme } from '../../src/styles/theme';
import { useThemeStore } from '../../src/core/theme/ThemeStore';
import { useThemeSync } from '../../src/core/theme/ThemeSync';
import '../../src/index.css';

const handleOpenStandalone = () => {
  const url = chrome.runtime.getURL('standalone.html');
  chrome.tabs.create({ url });
};

const handleOpenOptions = () => {
  const url = chrome.runtime.getURL('options.html');
  chrome.tabs.create({ url });
};

const SidepanelApp = () => {
  const mode = useThemeStore((s) => s.mode);
  const isDark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = useMemo(() => getAppTheme(isDark), [isDark]);
  useThemeSync();

  return (
    <ConfigProvider theme={theme}>
      <AntdApp className="h-screen w-screen overflow-hidden">
        <SidepanelChat onOpenStandalone={handleOpenStandalone} onOpenOptions={handleOpenOptions} />
      </AntdApp>
    </ConfigProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<SidepanelApp />);
}
