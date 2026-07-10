import React from 'react';
import { ConfigProvider, App, Button, Space, Typography } from 'antd';
import { getAntdConfig } from '../../core/theme/antdConfig';
import { openFullApp } from '../../core/routing/workspaceRouter';

const { Text, Title } = Typography;

export function PopupApp() {
  const antdConfig = getAntdConfig({ mode: 'auto', compact: true });

  const handleOpenSidePanel = () => {
    chrome.sidePanel.open({} as never);
  };

  const handleOpenFullApp = () => {
    openFullApp();
  };

  return (
    <ConfigProvider {...antdConfig}>
      <App>
        <div style={{ width: 250, padding: 16 }}>
          <Title level={4}>NowPilot</Title>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Button type="primary" block onClick={handleOpenSidePanel}>
              Open Side Panel
            </Button>
            <Button block onClick={handleOpenFullApp}>
              Open Full App
            </Button>
          </Space>
        </div>
      </App>
    </ConfigProvider>
  );
}
