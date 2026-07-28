import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntdApp } from 'antd';
import { XProvider } from '@ant-design/x';
import { getAntdConfig } from '../../src/core/theme/antdConfig';
import { SidePanelShell } from '../../src/components/sidepanel/SidePanelShell';

function Root() {
  return (
    <ConfigProvider {...getAntdConfig({ compact: true })}>
      <AntdApp>
        <XProvider>
          <SidePanelShell />
        </XProvider>
      </AntdApp>
    </ConfigProvider>
  );
}

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<Root />);
}
