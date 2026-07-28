import React, { useState } from 'react';
import { Layout, Tabs, Button, Tooltip, Skeleton, Typography, Empty, App } from 'antd';
import {
  MessageOutlined,
  RobotOutlined,
  EditOutlined,
  TeamOutlined,
  ExpandOutlined,
} from '@ant-design/icons';
import { ChatPage } from '../pages/ChatPage';
import { AgentPage } from '../pages/AgentPage';
import { ThemeToggle } from '../common/ThemeToggle';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { openFullApp } from '../../core/workspace/WorkspaceRouter';
import { useWorkspaceStore } from '../../core/workspace/WorkspaceStore';
import { useThemeStore } from '../../core/theme/ThemeStore';
import { t } from '../../core/i18n/strings';

type SidePanelPage = 'chat' | 'agent' | 'write' | 'teamgqm';

const { Header, Content, Footer } = Layout;

export const SidePanelShell: React.FC = () => {
  const [activePage, setActivePage] = useState<SidePanelPage>('chat');
  const { message } = App.useApp();
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const conversationId = useWorkspaceStore((s) => s.conversationId);
  const hasHydrated = useThemeStore.persist.hasHydrated();

  const handleOpenFullApp = () => {
    try {
      openFullApp(workspaceId, conversationId ?? undefined);
    } catch {
      message.error(t('sidepanel.fullAppFailed'));
    }
  };

  // Loading state: show Skeleton while ThemeStore rehydrates from chrome.storage.local
  if (!hasHydrated) {
    return (
      <ErrorBoundary>
        <Layout style={{ height: '100vh', overflow: 'hidden' }}>
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
      case 'write':
      case 'teamgqm':
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <Empty description="Coming in Phase 7" />
          </div>
        );
      default:
        return <ChatPage />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout style={{ height: '100vh', overflow: 'hidden' }}>
        {/* Header bar: app name + ThemeToggle */}
        <Header
          style={{
            height: 44,
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'transparent',
            borderBottom: '1px solid var(--ant-color-border-secondary)',
          }}
        >
          <Typography.Text strong style={{ fontSize: 14 }}>
            NowPilot
          </Typography.Text>

          <ThemeToggle />
        </Header>

        {/* Tab navigation */}
        <Tabs
          activeKey={activePage}
          onChange={(key) => setActivePage(key as SidePanelPage)}
          style={{ margin: 0, padding: '0 8px' }}
          items={[
            {
              key: 'chat',
              label: 'Chat',
              icon: <MessageOutlined />,
            },
            {
              key: 'agent',
              label: 'Agent',
              icon: <RobotOutlined />,
            },
            {
              key: 'write',
              label: (
                <Tooltip title="Available in Phase 7">
                  <span>Write</span>
                </Tooltip>
              ),
              icon: <EditOutlined />,
              disabled: true,
            },
            {
              key: 'teamgqm',
              label: (
                <Tooltip title="Available in Phase 7">
                  <span>TeamGQM</span>
                </Tooltip>
              ),
              icon: <TeamOutlined />,
              disabled: true,
            },
          ]}
        />

        {/* Content area */}
        <Content style={{ flex: 1, overflow: 'auto' }}>
          {renderPage()}
        </Content>

        {/* Footer: Open Full App */}
        <Footer
          style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--ant-color-border-secondary)',
            textAlign: 'center',
          }}
        >
          <Button
            type="default"
            icon={<ExpandOutlined />}
            onClick={handleOpenFullApp}
            block
          >
            {t('sidepanel.footer')}
          </Button>
        </Footer>
      </Layout>
    </ErrorBoundary>
  );
};
