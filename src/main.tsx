import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { App as AntdApp, Layout, Segmented, Typography, theme } from 'antd';
import { XProvider } from '@ant-design/x';
import { AppstoreOutlined, MessageOutlined, SettingOutlined } from '@ant-design/icons';
import { StandaloneShell } from './components/standalone/StandaloneShell';
import { SidepanelChat } from './components/chat/SidepanelChat';
import { OptionsPage } from './components/options/OptionsPage';
import { CommandPalette } from './components/common/CommandPalette';
import { CommandRegistry } from './core/commands/CommandRegistry';
import { useThemeStore, cycleThemeMode } from './core/theme/ThemeStore';
import { useThemeSync } from './core/theme/ThemeSync';
import { getAntdConfig, resolveThemePack } from './core/theme/antdConfig';
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

const getViewFromUrl = (): 'workspace' | 'sidepanel' | 'options' => {
  if (typeof window === 'undefined') return 'workspace';
  const path = window.location.pathname.toLowerCase();
  const search = window.location.search.toLowerCase();
  if (path.includes('options') || search.includes('options') || search.includes('tab=options')) {
    return 'options';
  }
  if (path.includes('sidepanel') || search.includes('sidepanel') || search.includes('tab=sidepanel')) {
    return 'sidepanel';
  }
  if (path.includes('standalone') || path.includes('workspace') || search.includes('standalone') || search.includes('workspace')) {
    return 'workspace';
  }
  return 'workspace';
};

const AppShell: React.FC = () => {
  const [activeView, setActiveView] = useState<'workspace' | 'sidepanel' | 'options'>(getViewFromUrl);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { token } = theme.useToken();

  useEffect(() => {
    CommandRegistry.register({
      id: 'toggle-theme',
      name: 'Toggle Theme',
      description: 'Cycle between light, dark, and auto theme modes',
      category: 'Appearance',
      action: () => {
        cycleThemeMode();
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
          <StandaloneShell onOpenOptions={() => setActiveView('options')} />
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

/**
 * The dev shell's provider root. The superseded nested AntD provider component
 * is gone: one `XProvider` fed by `getAntdConfig`, exactly like the two
 * extension surfaces (§5.5 / D-02). This shell is retired by plan `01-11`;
 * until then it keeps the same single-provider shape so the typecheck and the
 * theme behaviour stay honest. Theme mode is reachable through the palette's
 * `toggle-theme` command, matching Phase 1's single theme UI surface (D-15).
 */
const MainApp = () => {
  const mode = useThemeStore((state) => state.mode);
  const pack = useThemeStore((state) => state.pack);

  useThemeSync();

  const config = getAntdConfig({ mode, pack: resolveThemePack(pack), compact: false });

  return (
    <XProvider {...config}>
      <AntdApp style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
        <AppShell />
      </AntdApp>
    </XProvider>
  );
};

const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<MainApp />);
}
