import React, { useEffect, useState } from 'react';
import { ConfigProvider, App as AntApp, Button, Flex, theme } from 'antd';
import { getAntdConfig } from '../../core/theme/antdConfig';
import { useThemeStore, type ThemeMode } from '../../core/stores/themeStore';
import { openStandalone } from '../../core/routing/workspaceRouter';

const modeLabel: Record<ThemeMode, string> = {
  auto: 'Auto',
  light: 'Light',
  dark: 'Dark',
};

export function PopupApp() {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const [sidePanelSupported, setSidePanelSupported] = useState<boolean>(true);

  useEffect(() => {
    setSidePanelSupported(typeof chrome?.sidePanel?.open === 'function');
  }, []);

  const antdConfig = getAntdConfig({ mode: 'auto', compact: true });

  return (
    <ConfigProvider {...antdConfig}>
      <AntApp>
        <div style={{ width: 280, padding: 16 }} data-surface="popup">
          <h2 style={{ marginTop: 0, marginBottom: 8 }}>NowPilot</h2>
          <p style={{ margin: '0 0 12px', fontSize: 12, opacity: 0.7 }}>
            Quick workspace launcher
          </p>
          <Flex vertical gap={8}>
            <Button
              type="primary"
              block
              onClick={() => chrome.sidePanel.open({} as never)}
              disabled={!sidePanelSupported}
            >
              Open Side Panel
            </Button>
            <Button block onClick={openStandalone}>
              Open Standalone
            </Button>
            <Button block onClick={() => chrome.runtime.openOptionsPage()}>
              Open Options
            </Button>
            <Flex align="center" justify="space-between" style={{ marginTop: 4 }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>Theme</span>
              <Button size="small" onClick={() => setMode(mode === 'auto' ? 'light' : mode === 'light' ? 'dark' : 'auto')}>
                {modeLabel[mode]}
              </Button>
            </Flex>
          </Flex>
        </div>
      </AntApp>
    </ConfigProvider>
  );
}
