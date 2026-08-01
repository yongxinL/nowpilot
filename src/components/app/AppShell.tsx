import React, { useState, useEffect } from 'react';
import { Skeleton } from 'antd';
import { StandaloneWorkspace } from '../standalone/StandaloneWorkspace';
import { CommandPalette } from '../common/CommandPalette';
import { CommandRegistry } from '../../core/commands/CommandRegistry';
import { useThemeStore, type ThemeMode } from '../../core/theme/ThemeStore';
import { useThemeSync } from '../../core/theme/ThemeSync';
import { hydrateFromURL } from '../../core/workspace/WorkspaceRouter';
import { initializeKnowledgeBase } from '../../core/knowledgeBaseBootstrap';

// Phase-5 startup wiring (WR-01/WR-04): elect this surface as primary
// (MEM-02 single-writer) and restore the persistent search index. Runs in
// the full-app tab's own JS context; the election is broadcast so every
// other surface context converges on the same primary.
void initializeKnowledgeBase('full-app');

const MODE_CYCLE: ThemeMode[] = ['light', 'dark', 'auto'];

interface AppShellProps {
  onOpenOptions?: () => void;
  onOpenSidepanel?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({ onOpenOptions, onOpenSidepanel }) => {
  const [hydrated, setHydrated] = useState(useThemeStore.persist.hasHydrated());
  const [paletteOpen, setPaletteOpen] = useState(false);
  useThemeSync();

  useEffect(() => {
    hydrateFromURL(new URLSearchParams(window.location.search));
  }, []);

  useEffect(() => {
    const unsub = useThemeStore.persist.onFinishHydration(() => setHydrated(true));
    if (useThemeStore.persist.hasHydrated()) setHydrated(true);
    return () => unsub();
  }, []);

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

  if (!hydrated) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white dark:bg-zinc-900">
        <div className="text-center">
          <Skeleton active paragraph={{ rows: 3 }} />
          <p className="text-zinc-400 text-sm mt-4">Loading workspace…</p>
        </div>
      </div>
    );
  }

  const handleOptions = onOpenOptions ?? (() => {
    const url = chrome.runtime.getURL('options.html');
    chrome.tabs.create({ url });
  });

  const handleSidepanel = onOpenSidepanel ?? (async () => {
    try {
      const win = await chrome.windows.getCurrent();
      if (win?.id !== undefined) {
        await chrome.sidePanel.open({ windowId: win.id });
      }
    } catch {
      // side panel may not be available
    }
  });

  return (
    <>
      <StandaloneWorkspace onOpenOptions={handleOptions} onOpenSidepanel={handleSidepanel} />
      <CommandPalette
        commands={CommandRegistry.getAll()}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </>
  );
};
