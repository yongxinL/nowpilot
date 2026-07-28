import React, { useState } from 'react';
import { Layout, Menu, Button, Tooltip, App, Typography } from 'antd';
import {
  MessageOutlined,
  RobotOutlined,
  EditOutlined,
  TeamOutlined,
  ExpandOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { ChatPage } from '../pages/ChatPage';
import { AgentPage } from '../pages/AgentPage';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { openFullApp } from '../../core/workspace/WorkspaceRouter';
import { useWorkspaceStore } from '../../core/workspace/WorkspaceStore';
import { t } from '../../core/i18n/strings';

type SidePanelPage = 'chat' | 'agent';

const { Header, Content, Footer } = Layout;

export const SidePanelShell: React.FC = () => {
  const [activePage, setActivePage] = useState<SidePanelPage>('chat');
  const { message } = App.useApp();
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const conversationId = useWorkspaceStore((s) => s.conversationId);

  const handleOpenFullApp = () => {
    try {
      openFullApp(workspaceId, conversationId ?? undefined);
    } catch {
      message.error(t('sidepanel.fullAppFailed'));
    }
  };

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage?.();
  };

  return (
    <ErrorBoundary>
      <Layout style={{ height: '100vh', overflow: 'hidden' }}>
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

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <Tooltip title={t('common.back')}>
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                onClick={handleOpenOptions}
              />
            </Tooltip>
            <Tooltip title={t('sidepanel.openFullApp')}>
              <Button
                type="text"
                size="small"
                icon={<ExpandOutlined />}
                onClick={handleOpenFullApp}
              />
            </Tooltip>
          </div>
        </Header>

        <Content style={{ flex: 1, overflow: 'auto' }}>
          {activePage === 'chat' && <ChatPage />}
          {activePage === 'agent' && <AgentPage />}
        </Content>

        <Footer
          style={{
            padding: 0,
            borderTop: '1px solid var(--ant-color-border-secondary)',
          }}
        >
          <Menu
            mode="horizontal"
            selectedKeys={[activePage]}
            onClick={(e) => setActivePage(e.key as SidePanelPage)}
            items={[
              { key: 'chat', icon: <MessageOutlined />, label: 'Chat' },
              { key: 'agent', icon: <RobotOutlined />, label: 'Agent' },
            ]}
            style={{
              justifyContent: 'center',
              borderBottom: 'none',
            }}
          />
        </Footer>
      </Layout>
    </ErrorBoundary>
  );
};
