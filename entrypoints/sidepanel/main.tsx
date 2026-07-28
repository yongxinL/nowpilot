import React, { useMemo, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import { SidepanelChat } from '../../src/components/chat/SidepanelChat';
import { CommandPalette } from '../../src/components/common/CommandPalette';
import { CommandRegistry } from '../../src/core/commands/CommandRegistry';
import { getAppTheme } from '../../src/styles/theme';
import { useThemeStore, type ThemeMode } from '../../src/core/theme/ThemeStore';
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

const MODE_CYCLE: ThemeMode[] = ['light', 'dark', 'auto'];

const SidepanelApp = () => {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const isDark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = useMemo(() => getAppTheme(isDark), [isDark]);
  useThemeSync();

  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    CommandRegistry.register({
      id: 'toggle-theme',
      name: 'Toggle Theme',
      description: 'Cycle between light, dark, and auto theme modes',
      category: 'Appearance',
      action: () => {
        const cur = useThemeStore.getState().mode;
        const next = MODE_CYCLE[(MODE_CYCLE.indexOf(cur) + 1) % MODE_CYCLE.length];
        useThemeStore.getState().setMode(next);
        setPaletteOpen(false);
      },
    });
    CommandRegistry.register({
      id: 'open-full-app',
      name: 'Open in Full Tab',
      description: 'Open the full application in a new tab',
      category: 'Navigation',
      action: () => {
        handleOpenStandalone();
        setPaletteOpen(false);
      },
    });
    CommandRegistry.register({
      id: 'reload-extension',
      name: 'Reload Extension',
      description: 'Reload the extension to apply changes',
      category: 'System',
      action: () => {
        chrome.runtime.reload();
      },
    });
    return () => {
      CommandRegistry.unregister('toggle-theme');
      CommandRegistry.unregister('open-full-app');
      CommandRegistry.unregister('reload-extension');
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <ConfigProvider theme={theme}>
      <AntdApp className="h-screen w-screen overflow-hidden">
        <SidepanelChat onOpenStandalone={handleOpenStandalone} onOpenOptions={handleOpenOptions} />
        <CommandPalette
          commands={CommandRegistry.getAll()}
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
        />
      </AntdApp>
    </ConfigProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<SidepanelApp />);
}
