import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Typography, theme, Skeleton, Tooltip } from 'antd';
import {
  MessageOutlined,
  RobotOutlined,
  FileTextOutlined,
  TeamOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { ChatPage } from '../pages/ChatPage';
import { AgentPage } from '../pages/AgentPage';
import { NotesPage } from '../pages/NotesPage';
import { OptionsPage } from '../pages/OptionsPage';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { useWorkspaceStore } from '../../core/workspace/WorkspaceStore';
import { useThemeStore } from '../../core/theme/ThemeStore';
import { useThemeSync } from '../../core/theme/ThemeSync';
import { ThemeToggle } from '../common/ThemeToggle';
import { hydrateFromURL } from '../../core/workspace/WorkspaceRouter';
import { t } from '../../core/i18n/strings';

const { Header, Sider, Content } = Layout;

type FullAppPage = 'chat' | 'agent' | 'notes' | 'teamgqm' | 'options';

const menuItems = [
  { key: 'chat', icon: <MessageOutlined />, label: 'Chat' },
  { key: 'agent', icon: <RobotOutlined />, label: 'Agent' },
  { key: 'notes', icon: <FileTextOutlined />, label: 'Notes' },
  {
    key: 'teamgqm',
    icon: <TeamOutlined />,
    label: (
      <Tooltip title="Available in Phase 7">
        <span>TeamGQM</span>
      </Tooltip>
    ),
    disabled: true,
  },
  { key: 'options', icon: <SettingOutlined />, label: 'Options' },
];

export const AppShell: React.FC = () => {
  useThemeSync();

  const [activePage, setActivePage] = useState<FullAppPage>('chat');
  const [collapsed, setCollapsed] = useState(false);
  const hasHydrated = useThemeStore.persist.hasHydrated();
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    hydrateFromURL(params);

    const pageParam = params.get('page');
    if (pageParam && menuItems.some((m) => m.key === pageParam)) {
      setActivePage(pageParam as FullAppPage);
    }
  }, []);

  // Hydration guard: show skeleton while ThemeStore rehydrates from chrome.storage.local
  if (!hasHydrated) {
    return (
      <ErrorBoundary>
        <Layout style={{ height: '100vh' }}>
          <Content
            style={{
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              justifyContent: 'center',
            }}
          >
            <Skeleton active paragraph={{ rows: 4 }} />
            <Typography.Text
              type="secondary"
              style={{ textAlign: 'center', fontSize: 13 }}
            >
              {t('shell.loading')}
            </Typography.Text>
          </Content>
        </Layout>
      </ErrorBoundary>
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case 'chat':
        return <ChatPage />;
      case 'agent':
        return <AgentPage />;
      case 'notes':
        return <NotesPage />;
      case 'options':
        return <OptionsPage />;
      default:
        return <ChatPage />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout style={{ height: '100vh' }}>
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={240}
          style={{ background: colorBgContainer }}
        >
          <div
            style={{
              height: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 16px',
            }}
          >
            <Typography.Title level={5} style={{ margin: 0 }}>
              {collapsed ? 'N' : 'NowPilot'}
            </Typography.Title>
          </div>

          <Menu
            mode="inline"
            selectedKeys={[activePage]}
            onClick={(e) => setActivePage(e.key as FullAppPage)}
            items={menuItems}
          />

          <div
            style={{
              position: 'absolute',
              bottom: 0,
              width: '100%',
              padding: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: 4,
              }}
            >
              <ThemeToggle />
            </div>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ width: '100%' }}
            />
          </div>
        </Sider>

        <Layout>
          <Content
            style={{
              padding: 24,
              minHeight: 280,
              overflow: 'auto',
            }}
          >
            {renderPage()}
          </Content>
        </Layout>
      </Layout>
    </ErrorBoundary>
  );
};
