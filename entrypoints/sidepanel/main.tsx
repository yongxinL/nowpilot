import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { SidepanelChat } from '../../src/components/chat/SidepanelChat';
import { CommandPalette } from '../../src/components/common/CommandPalette';
import { CommandRegistry } from '../../src/core/commands/CommandRegistry';
import { useThemeStore, type ThemeMode } from '../../src/core/theme/ThemeStore';
import { ThemeProvider } from '../../src/components/ThemeProvider';
import '../../src/index.css';

const handleOpenStandalone = async () => {
  const url = chrome.runtime.getURL('standalone.html');
  try {
    // 1. Check if a standalone tab is already open
    const tabs = await chrome.tabs.query({});
    const existingTab = tabs.find(
      (t) => t.url && (t.url === url || t.url.includes('standalone.html'))
    );

    if (existingTab && existingTab.id !== undefined) {
      // Focus existing tab instead of opening duplicate
      await chrome.tabs.update(existingTab.id, { active: true });
      if (existingTab.windowId !== undefined) {
        await chrome.windows.update(existingTab.windowId, { focused: true });
      }
    } else {
      // Open new tab
      await chrome.tabs.create({ url });
    }
  } catch {
    window.open(url, '_blank');
  }

  // 2. Close side panel when standalone view is opened
  try {
    window.close();
  } catch {
    // ignore
  }
};

const handleOpenOptions = async () => {
  try {
    const url = chrome.runtime.getURL('options.html');
    const tabs = await chrome.tabs.query({});
    const existingTab = tabs.find(
      (t) => t.url && (t.url === url || t.url.includes('options.html'))
    );
    if (existingTab && existingTab.id !== undefined) {
      await chrome.tabs.update(existingTab.id, { active: true });
      if (existingTab.windowId !== undefined) {
        await chrome.windows.update(existingTab.windowId, { focused: true });
      }
    } else {
      await chrome.tabs.create({ url });
    }
  } catch {
    const fallbackUrl = typeof chrome !== 'undefined' && chrome?.runtime?.getURL
      ? chrome.runtime.getURL('options.html')
      : 'options.html';
    window.open(fallbackUrl, '_blank');
  }
};

const MODE_CYCLE: ThemeMode[] = ['auto', 'light', 'dark'];

const SidepanelApp = () => {
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
    <ThemeProvider>
      <AntdApp className="h-screen w-screen overflow-hidden">
        <SidepanelChat onOpenStandalone={handleOpenStandalone} onOpenOptions={handleOpenOptions} />
        <CommandPalette
          commands={CommandRegistry.getAll()}
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
        />
      </AntdApp>
    </ThemeProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<SidepanelApp />);
}
