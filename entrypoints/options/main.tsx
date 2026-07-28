import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App } from 'antd';
import { OptionsPage } from '../../src/components/options/OptionsPage';
import { getAppTheme } from '../../src/styles/theme';
import '../../src/index.css';

const OptionsApp = () => {
  return (
    <ConfigProvider theme={getAppTheme(false)}>
      <App className="h-screen w-screen overflow-hidden">
        <OptionsPage />
      </App>
    </ConfigProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<OptionsApp />);
}
