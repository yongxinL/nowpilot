import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Typography, theme, Skeleton, Tooltip } from 'antd';
import {
  MessageOutlined,
  RobotOutlined,
  FileTextOutlined,
  TeamOutlined,
  SettingOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { ChatPage } from '../pages/ChatPage';
import { AgentPage } from '../pages/AgentPage';
import { NotesPage } from '../pages/NotesPage';
import { OptionsPage } from '../pages/OptionsPage';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { useWorkspaceStore } from '../../core/workspace/WorkspaceStore';
import { useThemeStore, type ThemeMode } from '../../core/theme/ThemeStore';
import { useThemeSync } from '../../core/theme/ThemeSync';
import { ThemeToggle } from '../common/ThemeToggle';
import { CommandPalette } from '../common/CommandPalette';
import { CommandRegistry } from '../../core/commands/CommandRegistry';
import { hydrateFromURL } from '../../core/workspace/WorkspaceRouter';
import { t } from '../../core/i18n/strings';

const { Header, Sider, Content } = Layout;

type FullAppPage = 'chat' | 'agent' | 'notes' | 'teamgqm' | 'options';

const menuItems = [
  { key: 'chat', icon: <MessageOutlined />, label: 'Chat' },
  { key: 'agent', icon: <RobotOutlined />, label: 'Agent' },
  { key: 'notes', icon: <FileTextOutlined />, label: 'Notes' },
  {
    key: 'teamgqm',
    icon: <TeamOutlined />,
    label: (
      <Tooltip title="Available in Phase 7">
        <span>TeamGQM</span>
      </Tooltip>
    ),
    disabled: true,
  },
  { key: 'options', icon: <SettingOutlined />, label: 'Options' },
];

export const AppShell: React.FC = () => {
  useThemeSync();

  const [activePage, setActivePage] = useState<FullAppPage>('chat');
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const hasHydrated = useThemeStore.persist.hasHydrated();
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    hydrateFromURL(params);

    const pageParam = params.get('page');
    if (pageParam && menuItems.some((m) => m.key === pageParam)) {
      setActivePage(pageParam as FullAppPage);
    }
  }, []);

  // Register Full App-specific commands (runs once)
  useEffect(() => {
    CommandRegistry.register({
      id: 'toggle-theme',
      name: 'Toggle Theme',
      description: 'Cycle between light, dark, and auto theme modes',
      category: t('commands.category.theme'),
      action: () => {
        const modes: ThemeMode[] = ['light', 'dark', 'auto'];
        const cur = useThemeStore.getState().mode;
        const next = modes[(modes.indexOf(cur) + 1) % 3];
        useThemeStore.getState().setMode(next);
        setPaletteOpen(false);
      },
    });
    CommandRegistry.register({
      id: 'reload-extension',
      name: 'Reload Extension',
      description: 'Reload the extension to apply changes',
      category: t('commands.category.system'),
      action: () => {
        chrome.runtime.reload();
      },
    });

    return () => {
      CommandRegistry.unregister('toggle-theme');
      CommandRegistry.unregister('reload-extension');
    };
  }, []);

  // Cmd+K / Ctrl+K keydown listener (only when hydrated)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasHydrated) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasHydrated]);

  // Hydration guard: show skeleton while ThemeStore rehydrates from chrome.storage.local
  if (!hasHydrated) {
    return (
      <ErrorBoundary>
        <Layout style={{ height: '100vh' }}>
          <Content
            style={{
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              justifyContent: 'center',
            }}
          >
            <Skeleton active paragraph={{ rows: 4 }} />
            <Typography.Text
              type="secondary"
              style={{ textAlign: 'center', fontSize: 13 }}
            >
              {t('shell.loading')}
            </Typography.Text>
          </Content>
        </Layout>
      </ErrorBoundary>
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case 'chat':
        return <ChatPage />;
      case 'agent':
        return <AgentPage />;
      case 'notes':
        return <NotesPage />;
      case 'options':
        return <OptionsPage />;
      default:
        return <ChatPage />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout style={{ height: '100vh' }}>
        <Sider
          trigger={null}
          collapsible
          collapsed={collapsed}
          width={240}
          style={{ background: colorBgContainer }}
        >
          <div
            style={{
              height: 56,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 16px',
            }}
          >
            <Typography.Title level={5} style={{ margin: 0 }}>
              {collapsed ? 'N' : 'NowPilot'}
            </Typography.Title>
          </div>

          <Menu
            mode="inline"
            selectedKeys={[activePage]}
            onClick={(e) => setActivePage(e.key as FullAppPage)}
            items={menuItems}
          />

          <div
            style={{
              position: 'absolute',
              bottom: 0,
              width: '100%',
              padding: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginBottom: 4,
              }}
            >
              <ThemeToggle />
            </div>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ width: '100%' }}
            />
          </div>
        </Sider>

        <Layout>
          <Content
            style={{
              padding: 24,
              minHeight: 280,
              overflow: 'auto',
            }}
          >
            {renderPage()}
          </Content>
        </Layout>
      </Layout>

      {/* Command palette overlay */}
      <CommandPalette
        commands={CommandRegistry.getAll()}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </ErrorBoundary>
  );
};
