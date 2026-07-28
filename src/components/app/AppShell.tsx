import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Typography, theme } from 'antd';
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
import { hydrateFromURL } from '../../core/workspace/WorkspaceRouter';

const { Header, Sider, Content } = Layout;

type FullAppPage = 'chat' | 'agent' | 'notes' | 'teamgqm' | 'options';

const menuItems = [
  { key: 'chat', icon: <MessageOutlined />, label: 'Chat' },
  { key: 'agent', icon: <RobotOutlined />, label: 'Agent' },
  { key: 'notes', icon: <FileTextOutlined />, label: 'Notes' },
  { key: 'options', icon: <SettingOutlined />, label: 'Options' },
];

export const AppShell: React.FC = () => {
  const [activePage, setActivePage] = useState<FullAppPage>('chat');
  const [collapsed, setCollapsed] = useState(false);
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
