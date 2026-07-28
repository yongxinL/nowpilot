import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import { getAntdConfig } from '../../src/core/theme/antdConfig';
import { AppShell } from '../../src/components/app/AppShell';

function Root() {
  return (
    <ConfigProvider {...getAntdConfig({ compact: false })}>
      <AntdApp>
        <XProvider>
          <AppShell />
        </XProvider>
      </AntdApp>
    </ConfigProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<Root />);
}
