import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp, Layout, Segmented, Typography, theme } from 'antd';
import { AppstoreOutlined, MessageOutlined, SettingOutlined } from '@ant-design/icons';
import { StandaloneShell } from './components/standalone/StandaloneShell';
import { SidepanelChat } from './components/chat/SidepanelChat';
import { OptionsPage } from './components/options/OptionsPage';
import { CommandPalette } from './components/common/CommandPalette';
import { ThemeToggle } from './components/common/ThemeToggle';
import { CommandRegistry } from './core/commands/CommandRegistry';
import { useThemeStore, type ThemeMode } from './core/theme/ThemeStore';
import { ThemeProvider } from './components/ThemeProvider';
import { NowPilotAvatar } from './components/common/NowPilotAvatar';
import './index.css';

// Suppress benign ResizeObserver loop completed notifications
if (typeof window !== 'undefined') {
  const isResizeObserverError = (msg?: string) =>
    msg?.includes('ResizeObserver loop completed with undelivered notifications') ||
    msg?.includes('ResizeObserver loop limit exceeded');

  window.addEventListener('error', (e: ErrorEvent) => {
    if (isResizeObserverError(e.message)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });

  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    if (isResizeObserverError(e.reason?.message)) {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  });
}

const { Header, Content } = Layout;
const { Text } = Typography;

const MODE_CYCLE: ThemeMode[] = ['light', 'dark', 'auto'];

const AppShell: React.FC = () => {
  const [activeView, setActiveView] = useState<'workspace' | 'sidepanel' | 'options'>('workspace');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { token } = theme.useToken();

  useEffect(() => {
    CommandRegistry.register({
      id: 'toggle-theme',
      name: 'Toggle Theme',
      description: 'Cycle between light, dark, and auto theme modes',
      category: 'Appearance',
      action: () => {
        const cur = useThemeStore.getState().mode;
        const next = MODE_CYCLE[(MODE_CYCLE.indexOf(cur) + 1) % MODE_CYCLE.length];
        useThemeStore.getState().setMode(next);
        setPaletteOpen(false);
      },
    });
    CommandRegistry.register({
      id: 'switch-view-workspace',
      name: 'Switch to Standalone Workspace',
      description: 'Open the main workspace view',
      category: 'Navigation',
      action: () => {
        setActiveView('workspace');
        setPaletteOpen(false);
      },
    });
    CommandRegistry.register({
      id: 'switch-view-sidepanel',
      name: 'Switch to Sidepanel Chat',
      description: 'Open compact sidepanel chat view',
      category: 'Navigation',
      action: () => {
        setActiveView('sidepanel');
        setPaletteOpen(false);
      },
    });
    CommandRegistry.register({
      id: 'switch-view-options',
      name: 'Switch to Settings & Options',
      description: 'Open options page',
      category: 'Navigation',
      action: () => {
        setActiveView('options');
        setPaletteOpen(false);
      },
    });
    return () => {
      CommandRegistry.unregister('toggle-theme');
      CommandRegistry.unregister('switch-view-workspace');
      CommandRegistry.unregister('switch-view-sidepanel');
      CommandRegistry.unregister('switch-view-options');
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Layout style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Header
        style={{
          padding: '0 16px',
          height: 48,
          lineHeight: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <NowPilotAvatar size={24} />
          </div>
          <Text strong style={{ fontSize: 14, color: token.colorText }}>
            NowPilot
          </Text>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemeToggle />
          <Segmented
            value={activeView}
            onChange={(val) => setActiveView(val as 'workspace' | 'sidepanel' | 'options')}
            options={[
              {
                label: 'Workspace',
                value: 'workspace',
                icon: <AppstoreOutlined />,
              },
              {
                label: 'Sidepanel Chat',
                value: 'sidepanel',
                icon: <MessageOutlined />,
              },
              {
                label: 'Options',
                value: 'options',
                icon: <SettingOutlined />,
              },
            ]}
          />
        </div>
      </Header>

      <Content style={{ height: 'calc(100vh - 48px)', overflow: 'hidden', position: 'relative' }}>
        {activeView === 'workspace' && (
          <StandaloneShell
            onOpenOptions={() => setActiveView('options')}
            onOpenSidepanel={() => setActiveView('sidepanel')}
          />
        )}
        {activeView === 'sidepanel' && (
          <div
            style={{
              height: '100%',
              maxWidth: 480,
              margin: '0 auto',
              borderLeft: `1px solid ${token.colorBorderSecondary}`,
              borderRight: `1px solid ${token.colorBorderSecondary}`,
              backgroundColor: token.colorBgContainer,
            }}
          >
            <SidepanelChat
              onOpenStandalone={() => setActiveView('workspace')}
              onOpenOptions={() => setActiveView('options')}
            />
          </div>
        )}
        {activeView === 'options' && <OptionsPage />}
      </Content>

      <CommandPalette
        commands={CommandRegistry.getAll()}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </Layout>
  );
};

const MainApp = () => {
  return (
    <ThemeProvider>
      <AntdApp style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <AppShell />
      </AntdApp>
    </ThemeProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<MainApp />);
}
