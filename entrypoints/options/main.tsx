import React from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp } from 'antd';
import { OptionsPage } from '../../src/components/options/OptionsPage';
import { ThemeProvider } from '../../src/components/ThemeProvider';
import '../../src/index.css';

const OptionsApp = () => {
  return (
    <ThemeProvider>
      <AntdApp className="h-screen w-screen overflow-hidden">
        <OptionsPage />
      </AntdApp>
    </ThemeProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<OptionsApp />);
}
