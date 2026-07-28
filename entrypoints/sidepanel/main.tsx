import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App } from 'antd';
import { SidepanelChat } from '../../src/components/chat/SidepanelChat';
import { getAppTheme } from '../../src/styles/theme';
import '../../src/index.css';

const SidepanelApp = () => {
  return (
    <ConfigProvider theme={getAppTheme(false)}>
      <App className="h-screen w-screen overflow-hidden">
        <SidepanelChat />
      </App>
    </ConfigProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<SidepanelApp />);
}
