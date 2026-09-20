import React from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { OptionsPage } from '../../src/components/options/OptionsPage';
import { ThemeProvider } from '../../src/components/ThemeProvider';
import '../../src/index.css';

const OptionsApp = () => {
  return (
    <ThemeProvider>
      <AntdApp style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <OptionsPage />
      </AntdApp>
    </ThemeProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<OptionsApp />);
}
