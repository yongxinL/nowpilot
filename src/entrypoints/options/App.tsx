import React from 'react';
import { ConfigProvider, App, Typography } from 'antd';
import { ThemeMode, useThemeStore } from '../../core/stores/themeStore';
import { getAntdConfig } from '../../core/theme/antdConfig';
import { OptionsPage } from '../../core/pages/OptionsPage';

const { Title } = Typography;

export function OptionsApp() {
  const mode = useThemeStore((s) => s.mode);
  const antdConfig = getAntdConfig({ mode, compact: false });

  return (
    <ConfigProvider {...antdConfig}>
      <App>
        <div style={{ padding: 32, maxWidth: 640 }}>
          <Title level={2}>NowPilot Options</Title>
          <OptionsPage />
        </div>
      </App>
    </ConfigProvider>
  );
}
