import React, { useState } from 'react';
import { XProvider } from '@ant-design/x';
import { App, theme, Layout, Menu, Button, Space, Typography } from 'antd';
import { ThemeMode, useThemeStore } from '../../core/stores/themeStore';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { sidePanelPageRegistry } from '../../core/registries/SidePanelPageRegistry';
import { openFullApp } from '../../core/routing/workspaceRouter';
import { ChatPage } from '../../core/pages/ChatPage';
import { AgentPage } from '../../core/pages/AgentPage';

const { defaultAlgorithm, darkAlgorithm, compactAlgorithm } = theme;
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

export function SidePanelApp() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const [activePage, setActivePage] = useState('chat');

  const algorithm = [mode === 'dark' ? darkAlgorithm : defaultAlgorithm, compactAlgorithm];

  const pages = sidePanelPageRegistry.getAll();
  const activeComponent = pages.find((p) => p.id === activePage);

  const handleToggleTheme = () => {
    setMode(modeCycle[mode]);
  };

  const handleOpenFullApp = () => {
    openFullApp();
  };

  return (
    <XProvider theme={{ algorithm }}>
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
      </App>
    </XProvider>
  );
}
