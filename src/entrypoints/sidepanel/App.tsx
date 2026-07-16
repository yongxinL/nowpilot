import React, { useEffect, useMemo, useState } from 'react';
import { ConfigProvider, App } from 'antd';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { useTheme } from '../../hooks/useTheme';
import { getAntdConfig } from '../../core/theme/antdConfig';
import { CommandPalette } from '../../core/commands/commandPalette';
import { sidepanelPageRegistry } from '../../core/registries/SidepanelPageRegistry';
import { openStandalone } from '../../core/routing/workspaceRouter';
import { SidepanelRoot } from '../../components/sidepanel/SidepanelRoot';
import { findNavItem } from '../../core/navigation/navigationSelectors';
import { OnboardingGate } from '../../core/onboarding/OnboardingGate';
import '../../core/registries/registerNowPilotCorePages';

const modeCycle: Record<ThemeMode, ThemeMode> = {
  auto: 'light',
  light: 'dark',
  dark: 'auto',
};

const commands = [
  {
    id: 'open-standalone',
    label: 'Open Standalone',
    action: () => openStandalone(),
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

export function SidePanelApp() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { isDark } = useTheme();
  const antdConfig = useMemo(() => getAntdConfig({ mode: isDark ? 'dark' : 'light', compact: true }), [isDark]);

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

  const pages = useMemo(() => sidepanelPageRegistry.getAll(), []);
  const renderActivePage = (item: ReturnType<typeof findNavItem>) => {
    if (!item) return null;
    const match = pages.find((p) => p.id === item.id);
    const PageComponent = match?.component;
    if (!PageComponent) {
      return (
        <div style={{ padding: 16 }} aria-label={`${item.label} placeholder`}>
          <strong>{item.label}</strong>
          <p style={{ marginTop: 8 }}>This page is a placeholder.</p>
        </div>
      );
    }
    return <PageComponent />;
  };

  return (
    <ConfigProvider theme={antdConfig}>
      <App style={{ width: '100%', height: '100%' }}>
        <ErrorBoundary>
          <OnboardingGate>
            <SidepanelRoot renderActivePage={renderActivePage} />
            <CommandPalette
              open={paletteOpen}
              onClose={() => setPaletteOpen(false)}
              commands={commands}
            />
          </OnboardingGate>
        </ErrorBoundary>
      </App>
    </ConfigProvider>
  );
}
