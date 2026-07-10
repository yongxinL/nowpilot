import React, { useState, useEffect } from 'react';
import { ConfigProvider, App, Layout, Menu, Button, Space, Typography } from 'antd';
import { ThemeMode, useThemeStore } from '../../core/stores/themeStore';
import { getAntdConfig } from '../../core/theme/antdConfig';
import { useWorkspaceStore } from '../../core/stores/workspaceStore';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { sidePanelPageRegistry } from '../../core/registries/SidePanelPageRegistry';
import { openFullApp } from '../../core/routing/workspaceRouter';
import { CommandPalette } from '../../core/commands/commandPalette';
import { OnboardingModal } from '../../core/onboarding/OnboardingModal';
import { useProviderStore } from '../../core/stores/providerStore';
import { ChatPage } from '../../core/pages/ChatPage';
import { AgentPage } from '../../core/pages/AgentPage';
const { Header, Content, Footer, Sider } = Layout;
const { Text } = Typography;

sidePanelPageRegistry.register({ id: 'chat', label: 'Chat', component: ChatPage, order: 1 });
sidePanelPageRegistry.register({ id: 'agent', label: 'Agent', component: AgentPage, order: 2 });

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

export function SidePanelApp() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const activeProvider = useWorkspaceStore((s) => s.activeProvider);
  const [activePage, setActivePage] = useState('chat');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const antdConfig = getAntdConfig({ mode, compact: true });

  const pages = sidePanelPageRegistry.getAll();
  const activeComponent = pages.find((p) => p.id === activePage);

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

  const handleOpenFullApp = () => {
    openFullApp();
  };

  const handleOnboardingComplete = () => {
    const provider = useProviderStore.getState().selectedProvider;
    if (provider) {
      useWorkspaceStore.getState().setActiveProvider(provider);
    }
    setShowOnboarding(false);
  };

  return (
    <ConfigProvider {...antdConfig}>
      <App>
        <ErrorBoundary>
          <Layout style={{ height: '100vh' }}>
            <Header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
              <Text strong style={{ fontSize: 16 }}>NowPilot</Text>
              <Space>
                <Button size="small" onClick={handleToggleTheme}>
                  {modeLabels[mode]}
                </Button>
                <Button size="small" onClick={handleOpenFullApp}>
                  Open Full App
                </Button>
              </Space>
            </Header>
            <Layout>
              <Sider width={160} style={{ background: 'transparent' }}>
                <Menu
                  mode="inline"
                  selectedKeys={[activePage]}
                  items={pages.map((p) => ({ key: p.id, label: p.label }))}
                  onClick={({ key }) => setActivePage(key)}
                  style={{ borderRight: 0 }}
                />
              </Sider>
              <Content style={{ padding: 16, overflow: 'auto' }}>
                {activeComponent && <activeComponent.component />}
              </Content>
            </Layout>
            <Footer style={{ padding: '8px 16px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
              <Text type="secondary">Type a message...</Text>
            </Footer>
          </Layout>
        </ErrorBoundary>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
        <OnboardingModal open={showOnboarding} onComplete={handleOnboardingComplete} />
      </App>
    </ConfigProvider>
  );
}
