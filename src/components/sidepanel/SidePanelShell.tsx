import React, { useState, useEffect } from 'react';
import { SidepanelChat } from '../chat/SidepanelChat';
import { CommandPalette } from '../common/CommandPalette';
import { CommandRegistry } from '../../core/commands/CommandRegistry';
import { useThemeStore, type ThemeMode } from '../../core/theme/ThemeStore';
import { useThemeSync } from '../../core/theme/ThemeSync';
import { useWorkspaceStore } from '../../core/workspace/WorkspaceStore';
import { openFullApp } from '../../core/workspace/WorkspaceRouter';
import { initializeKnowledgeBase } from '../../core/knowledgeBaseBootstrap';
import type { Command } from '../../core/commands/CommandRegistry';

// Phase-5 startup wiring (WR-01/WR-04): elect this surface as primary
// (MEM-02 single-writer) and restore the persistent search index. Runs in
// the sidepanel's own JS context; the election is broadcast so every other
// surface context converges on the same primary.
void initializeKnowledgeBase('sidepanel');

const MODE_CYCLE: ThemeMode[] = ['light', 'dark', 'auto'];

interface SidePanelShellProps {
  onOpenOptions?: () => void;
}

const handleOpenStandalone = () => {
  const { workspaceId, conversationId } = useWorkspaceStore.getState();
  openFullApp(workspaceId, conversationId ?? undefined);
};

const handleOpenOptions = () => {
  const url = chrome.runtime.getURL('options.html');
  chrome.tabs.create({ url });
};

export const SidePanelShell: React.FC<SidePanelShellProps> = ({ onOpenOptions }) => {
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
    <>
      <SidepanelChat onOpenStandalone={handleOpenStandalone} onOpenOptions={onOpenOptions ?? handleOpenOptions} />
      <CommandPalette
        commands={CommandRegistry.getAll()}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </>
  );
};
