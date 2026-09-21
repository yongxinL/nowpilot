import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import { StandaloneShell } from '../../components/standalone/StandaloneShell';
import { CommandPalette } from '../../components/common/CommandPalette';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { CommandRegistry } from '../../core/commands/CommandRegistry';
import { useThemeStore, type ThemeMode } from '../../core/theme/ThemeStore';
import { useThemeSync, applyThemeToSync } from '../../core/theme/ThemeSync';
import { getAntdConfig, resolveThemePack } from '../../core/theme/antdConfig';
import { registerStandaloneCommands } from '../../core/commands/registerWorkspaceCommands';
import { openOptions } from '../../core/workspace/WorkspaceRouter';
import '../../index.css';

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

const StandaloneSurface: React.FC = () => {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const cleanup = registerStandaloneCommands({
      focusSidePanel: handleOpenSidepanel,
      openOptions: handleOpenOptions,
      toggleTheme: () => {
        const cur = useThemeStore.getState().mode;
        const next = MODE_CYCLE[(MODE_CYCLE.indexOf(cur) + 1) % MODE_CYCLE.length];
        useThemeStore.getState().setMode(next);
        void applyThemeToSync(next, useThemeStore.getState().pack);
        setPaletteOpen(false);
      },
      reloadExtension: () => {
        chrome.runtime.reload();
      },
    });
    return cleanup;
  }, []);

  // FLOW-8: no global keyboard listener is registered here. The palette
  // binding moves to `KeymapRegistry` in plan `01-08`; until then the palette
  // is mounted by the surface and has no ad-hoc `window` listener.
  return (
    <>
      <StandaloneShell onOpenOptions={handleOpenOptions} />
      <CommandPalette
        commands={CommandRegistry.getAll()}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </>
  );
};

/**
 * The Standalone surface's single provider chain (§5.5): exactly one
 * `XProvider` fed by `getAntdConfig`, then `AntdApp`, then the mounted
 * `ErrorBoundary`, then the shell. Density is the default (not compact) and
 * is fixed per surface.
 */
const StandaloneRoot: React.FC = () => {
  const mode = useThemeStore((state) => state.mode);
  const pack = useThemeStore((state) => state.pack);

  useThemeSync();

  const config = getAntdConfig({ mode, pack: resolveThemePack(pack), compact: false });

  return (
    <XProvider {...config}>
      <AntdApp style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <ErrorBoundary>
          <StandaloneSurface />
        </ErrorBoundary>
      </AntdApp>
    </XProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<StandaloneRoot />);
}
