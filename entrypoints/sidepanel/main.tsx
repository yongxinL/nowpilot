import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { SidepanelChat } from '../../src/components/chat/SidepanelChat';
import { CommandPalette } from '../../src/components/common/CommandPalette';
import { CommandRegistry } from '../../src/core/commands/CommandRegistry';
import { useThemeStore, type ThemeMode } from '../../src/core/theme/ThemeStore';
import { ThemeProvider } from '../../src/components/ThemeProvider';
import { openStandalone, openOptions } from '../../src/core/workspace/WorkspaceRouter';
import { useWorkspaceStore } from '../../src/core/workspace/WorkspaceStore';
import { registerSidepanelCommands } from '../../src/core/commands/registerWorkspaceCommands';
import { applyThemeToSync } from '../../src/core/theme/ThemeSync';
import { debugLog } from '../../src/core/log/debugLog';
import '../../src/index.css';

const handleOpenOptions = () => {
  openOptions();
};

const MODE_CYCLE: ThemeMode[] = ['auto', 'light', 'dark'];

const SidepanelApp = () => {
  const { message: antMessage } = AntdApp.useApp();
  const [paletteOpen, setPaletteOpen] = useState(false);

  /**
   * D-04 / D-05 / REQ-F05: Side Panel post-handoff = read-only mirror,
   * NOT a window close. This handler:
   *  - shows the keyed "Opening standalone view…" loading toast immediately
   *  - delegates the entire tabs.query → tabs.update/create dance to
   *    `WorkspaceRouter.openStandalone` (no local duplicate dedup impl)
   *  - resolves the loading toast on `onSettled` — destroy on success
   *    (mirror banner IS the success signal), error toast with retry on failure
   *
   * The Side Panel stays primary on failure (we do NOT demote to mirror) —
   * mirror mode is driven exclusively by the WORKSPACE_HANDOFF broadcast
   * that hydrateFromURL publishes inside openStandalone's callback path
   * (T-01-19).
   */
  const openStandaloneWithToasts = () => {
    antMessage.loading({ content: 'Opening standalone view…', key: 'open-standalone', duration: 0 });

    const { workspaceId, conversationId } = useWorkspaceStore.getState();
    openStandalone(workspaceId, conversationId ?? undefined, undefined, {
      onSettled: (result) => {
        if (result.ok) {
          antMessage.destroy('open-standalone');
          // Success: do NOT additionally toast — the MirrorBanner arriving
          // via WORKSPACE_HANDOFF IS the success signal (T-01-19).
          return;
        }
        debugLog('SIDEPANEL_STANDALONE_OPEN_FAILED', result.error);
        antMessage.destroy('open-standalone');
        antMessage.error({
          content: "Couldn't open Standalone view",
          key: 'open-standalone',
          duration: 4,
          onClick: () => openStandaloneWithToasts(),
        });
      },
    });
  };

  useEffect(() => {
    const cleanup = registerSidepanelCommands({
      openStandalone: () => {
        openStandaloneWithToasts();
        setPaletteOpen(false);
      },
      openOptions: () => {
        handleOpenOptions();
        setPaletteOpen(false);
      },
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
        // Explicit-only destructive action (REQ-F12 prohibition) — the
        // command palette never auto-runs reload-extension on partial
        // match, only on full Enter/click selection.
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
        <SidepanelChat
          onOpenStandalone={openStandaloneWithToasts}
          onOpenOptions={handleOpenOptions}
        />
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
