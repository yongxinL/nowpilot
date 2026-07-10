import React, { useState, useEffect } from 'react';
import { XProvider } from '@ant-design/x';
import { App, theme, Layout, Menu, Button, Space, Typography } from 'antd';
import { ThemeMode, useThemeStore } from '../../core/stores/themeStore';
import { useWorkspaceStore } from '../../core/stores/workspaceStore';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { fullAppPageRegistry } from '../../core/registries/FullAppPageRegistry';
import { openFullApp } from '../../core/routing/workspaceRouter';
import { CommandPalette } from '../../core/commands/commandPalette';
import { OnboardingModal } from '../../core/onboarding/OnboardingModal';
import { useProviderStore } from '../../core/stores/providerStore';
import { ChatPage } from '../../core/pages/ChatPage';
import { AgentPage } from '../../core/pages/AgentPage';
import { NotesPage } from '../../core/pages/NotesPage';
import { OptionsPage } from '../../core/pages/OptionsPage';

const { defaultAlgorithm, darkAlgorithm } = theme;
const { Header, Content, Sider } = Layout;
const { Text } = Typography;

fullAppPageRegistry.register({ id: 'chat', label: 'Chat', component: ChatPage, order: 1 });
fullAppPageRegistry.register({ id: 'agent', label: 'Agent', component: AgentPage, order: 2 });
fullAppPageRegistry.register({ id: 'notes', label: 'Notes', component: NotesPage, order: 3 });
fullAppPageRegistry.register({ id: 'options', label: 'Options', component: OptionsPage, order: 4 });

const modeCycle: Record<ThemeMode, ThemeMode> = {
  auto: 'light',
  light: 'dark',
  dark: 'auto',
};

const modeLabels: Record<ThemeMode, string> = {
  auto: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

const commands = [
  { id: 'open-full-app', label: 'Open Full App', action: () => openFullApp(), shortcut: '⌘⇧F' },
  {
    id: 'focus-side-panel',
    label: 'Focus Side Panel',
    action: () => chrome.sidePanel.open({} as never),
    shortcut: '⌘⇧S',
  },
  {
    id: 'open-options',
    label: 'Open Options',
    action: () => openFullApp(),
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

export function FullAppApp() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const activeSurface = useWorkspaceStore((s) => s.activeSurface);
  const activeProvider = useWorkspaceStore((s) => s.activeProvider);
  const [activePage, setActivePage] = useState('chat');
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const algorithm = [mode === 'dark' ? darkAlgorithm : defaultAlgorithm];

  const pages = fullAppPageRegistry.getAll();
  const activeComponent = pages.find((p) => p.id === activePage);

  useEffect(() => {
    if (activeSurface === 'fullapp') {
      useWorkspaceStore.getState().setActiveSurface('fullapp');
    }
  }, [activeSurface]);

  useEffect(() => {
    if (activeProvider === null) {
      setShowOnboarding(true);
    }
  }, [activeProvider]);

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

  const handleToggleTheme = () => {
    setMode(modeCycle[mode]);
  };

  const handleOnboardingComplete = () => {
    const provider = useProviderStore.getState().selectedProvider;
    if (provider) {
      useWorkspaceStore.getState().setActiveProvider(provider);
    }
    setShowOnboarding(false);
  };

  return (
    <XProvider theme={{ algorithm }}>
      <App>
        <ErrorBoundary>
          <Layout style={{ height: '100vh' }}>
            <Sider
              collapsible
              collapsed={collapsed}
              onCollapse={setCollapsed}
              width={200}
            >
              <Menu
                mode="inline"
                selectedKeys={[activePage]}
                items={pages.map((p) => ({ key: p.id, label: p.label }))}
                onClick={({ key }) => setActivePage(key)}
              />
            </Sider>
            <Layout>
              <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px' }}>
                <Text strong style={{ fontSize: 18 }}>NowPilot</Text>
                <Space>
                  <Text type="secondary">{activeSurface}</Text>
                  <Button size="small" onClick={handleToggleTheme}>
                    {modeLabels[mode]}
                  </Button>
                </Space>
              </Header>
              <Content style={{ padding: 24, overflow: 'auto' }}>
                {activeComponent && <activeComponent.component />}
              </Content>
            </Layout>
          </Layout>
        </ErrorBoundary>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
        <OnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} />
      </App>
    </XProvider>
  );
}
