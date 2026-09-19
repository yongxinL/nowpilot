import { Button, Empty, Layout, Space, Typography } from 'antd';
import { ExpandAltOutlined, SettingOutlined } from '@ant-design/icons';
import type { StandaloneRouteId } from '@/core/registry/standaloneRoutes';

export interface SidePanelShellProps {
  onNavigate(destination: StandaloneRouteId): void | Promise<void>;
}

export function SidePanelShell({ onNavigate }: SidePanelShellProps) {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingInline: 12,
        }}
      >
        <Typography.Text strong>NowPilot</Typography.Text>
        <Space>
          <Button
            type="text"
            aria-label="Options"
            icon={<SettingOutlined />}
            onClick={() => void onNavigate('options')}
          />
          <Button
            type="text"
            aria-label="Switch to Full Chat"
            icon={<ExpandAltOutlined />}
            onClick={() => void onNavigate('chat')}
          />
        </Space>
      </Layout.Header>
      <Layout.Content>
        <section aria-label="Chat" role="region">
          <Empty description="Start a conversation from a later phase." />
        </section>
        <div aria-hidden="true" data-testid="composer-placeholder" />
      </Layout.Content>
    </Layout>
  );
}
