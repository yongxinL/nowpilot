import React, { useMemo, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import { StandaloneWorkspace } from '../../src/components/standalone/StandaloneWorkspace';
import { CommandPalette } from '../../src/components/common/CommandPalette';
import { CommandRegistry } from '../../src/core/commands/CommandRegistry';
import { getAppTheme } from '../../src/styles/theme';
import { useThemeStore, type ThemeMode } from '../../src/core/theme/ThemeStore';
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

const MODE_CYCLE: ThemeMode[] = ['light', 'dark', 'auto'];

const StandaloneApp = () => {
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
        <StandaloneWorkspace onOpenOptions={handleOpenOptions} onOpenSidepanel={handleOpenSidepanel} />
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
  createRoot(container).render(<StandaloneApp />);
}
