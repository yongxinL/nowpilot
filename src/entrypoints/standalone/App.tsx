import React, { useEffect, useMemo, useState } from 'react';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { ThemeMode, useThemeStore } from '../../core/stores/themeStore';
import { getAntdConfig } from '../../core/theme/antdConfig';
import { CommandPalette } from '../../core/commands/commandPalette';
import { standalonePageRegistry } from '../../core/registries/StandalonePageRegistry';
import { StandaloneRoot } from '../../components/standalone/StandaloneRoot';
import { findNavItem } from '../../core/navigation/navigationSelectors';
import { useDiagnosticsStore } from '../../core/stores/diagnosticsStore';
import { useWorkspaceStore } from '../../core/stores/workspaceStore';
import '../../core/registries/registerNowPilotCorePages';

const modeCycle: Record<ThemeMode, ThemeMode> = {
  auto: 'light',
  light: 'dark',
  dark: 'auto',
};

const commands = [
  {
    id: 'open-standalone',
    label: 'Focus Standalone',
    action: () => window.focus(),
    shortcut: '⌘⇧F',
  },
  {
    id: 'focus-side-panel',
    label: 'Focus Side Panel',
    action: () => chrome.sidePanel.open({} as never),
    shortcut: '⌘⇧S',
  },
  {
    id: 'open-options',
    label: 'Open Options',
    action: () => chrome.runtime.openOptionsPage(),
  },
  {
    id: 'toggle-theme',
    label: 'Toggle Theme',
    action: () => {
      const current = useThemeStore.getState().mode;
      useThemeStore.getState().setMode(modeCycle[current]);
    },
    shortcut: '⌘⇧T',
  },
];

export function StandaloneApp() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [initialPage, setInitialPage] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Deep-link support: parse query params for page/section/operationId
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page');
    const operationId = params.get('operationId');
    const conversationId = params.get('conversationId');
    const noteId = params.get('noteId');

    if (page) {
      setInitialPage(page);
    }

    if (operationId) {
      useDiagnosticsStore.getState().setPendingOperationId(operationId);
    }

    // Set conversation context for deep links (D-38)
    if (conversationId) {
      useWorkspaceStore.getState().setConversationId(conversationId);
    }

    if (noteId) {
      useWorkspaceStore.getState().setSelectedNotes([noteId]);
    }

    // Clean query params from URL after consuming
    if (page || operationId || conversationId || noteId) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const pages = useMemo(() => standalonePageRegistry.getAll(), []);
  const renderActivePage = (item: ReturnType<typeof findNavItem>) => {
    if (!item) return null;
    const match = pages.find((p) => p.id === item.id);
    const PageComponent = match?.component;
    if (!PageComponent) {
      return (
        <div style={{ padding: 24 }} aria-label={`${item.label} placeholder`}>
          <h1 style={{ marginTop: 0 }}>{item.label}</h1>
          <p>This page is a placeholder.</p>
        </div>
      );
    }
    return <PageComponent />;
  };

  return (
    <ErrorBoundary>
      <StandaloneRoot initialActiveId={initialPage} renderActivePage={renderActivePage} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />
    </ErrorBoundary>
  );
}
