import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { StandaloneShell } from '../../src/components/standalone/StandaloneShell';
import { CommandPalette } from '../../src/components/common/CommandPalette';
import { CommandRegistry } from '../../src/core/commands/CommandRegistry';
import { useThemeStore, type ThemeMode } from '../../src/core/theme/ThemeStore';
import { ThemeProvider } from '../../src/components/ThemeProvider';
import { registerStandaloneCommands } from '../../src/core/commands/registerWorkspaceCommands';
import { openOptions } from '../../src/core/workspace/WorkspaceRouter';
import { applyThemeToSync } from '../../src/core/theme/ThemeSync';
import '../../src/index.css';

const handleOpenOptions = () => {
  openOptions();
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

const MODE_CYCLE: ThemeMode[] = ['auto', 'light', 'dark'];

const StandaloneApp = () => {
  const [paletteOpen, setPaletteOpen] = useState(false);

  // D-06 / D-08 / REQ-F20: register the 4-command Flow-10 base set on this
  // surface via the shared, testable registerStandaloneCommands module.
  // The previous inline useEffect registered only 2 commands and left the
  // existing gesture-safe handleOpenSidepanel wired only to a prop that no
  // command called (dead code). Now reachable via the focus-side-panel
  // command (T-01-18 — gesture preserved because deps.focusSidePanel runs
  // synchronously inside the user-gesture stack).
  useEffect(() => {
    const cleanup = registerStandaloneCommands({
      focusSidePanel: handleOpenSidepanel,
      openOptions: handleOpenOptions,
      toggleTheme: () => {
        const cur = useThemeStore.getState().mode;
        const next = MODE_CYCLE[(MODE_CYCLE.indexOf(cur) + 1) % MODE_CYCLE.length];
        useThemeStore.getState().setMode(next);
        // Cross-surface propagation via chrome.storage.onChanged (D-10 UI half).
        // The local BroadcastBus path in `setMode` stays as the auxiliary
        // same-window fast path; this write lights up the other surface's
        // `startThemeOnChangedSync` listener.
        void applyThemeToSync(next, useThemeStore.getState().pack);
        setPaletteOpen(false);
      },
      reloadExtension: () => {
        chrome.runtime.reload();
      },
    });
    return cleanup;
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
        <StandaloneShell onOpenOptions={handleOpenOptions} onOpenSidepanel={handleOpenSidepanel} />
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
  createRoot(container).render(<StandaloneApp />);
}
