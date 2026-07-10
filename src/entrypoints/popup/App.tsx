import React from 'react';
import { XProvider } from '@ant-design/x';
import { App, theme, Button, Space, Typography } from 'antd';
import { openFullApp } from '../../core/routing/workspaceRouter';

const { defaultAlgorithm, darkAlgorithm, compactAlgorithm } = theme;
const { Text, Title } = Typography;

export function PopupApp() {
  const algorithm = [defaultAlgorithm, compactAlgorithm];

  const handleOpenSidePanel = () => {
    chrome.sidePanel.open({} as never);
  };

  const handleOpenFullApp = () => {
    openFullApp();
  };

  return (
    <XProvider theme={{ algorithm }}>
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
    </XProvider>
  );
}
