import { useEffect, useState } from 'react';
import { Alert, Layout, Menu, Typography } from 'antd';
import {
  FileTextOutlined,
  MessageOutlined,
  RobotOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { CommandPalette } from '@/components/CommandPalette';
import { OnboardingModal } from '@/components/OnboardingModal';
import { STR } from '@/core/i18n/strings';
import { startWorkspaceSync } from '@/core/workspace/WorkspaceSync';
import { StandaloneRouter } from './StandaloneRouter';

const MENU_ITEMS = [
  { key: 'chat', icon: <MessageOutlined />, label: 'Chat' },
  { key: 'agent', icon: <RobotOutlined />, label: 'Agent' },
  { key: 'notes', icon: <FileTextOutlined />, label: 'Notes' },
  { key: 'options', icon: <SettingOutlined />, label: 'Options' },
];

export function StandaloneShell() {
  const [page, setPage] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('page') ?? 'chat';
    }
    return 'chat';
  });
  const [collapsed, setCollapsed] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(true);

  useEffect(() => startWorkspaceSync('standalone'), []);

  useEffect(() => {
    const check = () => setNarrow(window.innerWidth < 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={240}
      >
        <div style={{ padding: 12 }}>
          <Typography.Text strong>NowPilot</Typography.Text>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[page]}
          items={MENU_ITEMS}
          onClick={({ key }) => setPage(key)}
        />
      </Layout.Sider>
      <Layout>
        <Layout.Header style={{ display: 'flex', alignItems: 'center', paddingInline: 24 }}>
          <Typography.Text strong>Workspace</Typography.Text>
        </Layout.Header>
        <Layout.Content style={{ padding: 24 }}>
          {narrow ? (
            <Alert type="warning" showIcon message={STR.standalone.minWidth} style={{ marginBottom: 16 }} />
          ) : null}
          <StandaloneRouter page={page} />
        </Layout.Content>
      </Layout>
      <CommandPalette />
      <OnboardingModal open={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </Layout>
  );
}
