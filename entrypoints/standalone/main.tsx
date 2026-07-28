import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App } from 'antd';
import { StandaloneWorkspace } from '../../src/components/standalone/StandaloneWorkspace';
import { getAppTheme } from '../../src/styles/theme';
import '../../src/index.css';

const StandaloneApp = () => {
  return (
    <ConfigProvider theme={getAppTheme(false)}>
      <App className="h-screen w-screen overflow-hidden">
        <StandaloneWorkspace />
      </App>
    </ConfigProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<StandaloneApp />);
}
