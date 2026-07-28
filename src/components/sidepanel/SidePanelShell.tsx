import React, { useState, useEffect } from 'react';
import { Layout, Tabs, Button, Tooltip, Skeleton, Typography, Empty, App } from 'antd';
import {
  MessageOutlined,
  RobotOutlined,
  EditOutlined,
  TeamOutlined,
  ExpandOutlined,
} from '@ant-design/icons';
import { ChatPage } from '../pages/ChatPage';
import { AgentPage } from '../pages/AgentPage';
import { ThemeToggle } from '../common/ThemeToggle';
import { CommandPalette } from '../common/CommandPalette';
import { OnboardingWizard } from '../common/OnboardingWizard';
import { ErrorBoundary } from '../../core/components/ErrorBoundary';
import { openFullApp } from '../../core/workspace/WorkspaceRouter';
import { useWorkspaceStore } from '../../core/workspace/WorkspaceStore';
import { useThemeStore, type ThemeMode } from '../../core/theme/ThemeStore';
import { useThemeSync } from '../../core/theme/ThemeSync';
import { CommandRegistry } from '../../core/commands/CommandRegistry';
import { t } from '../../core/i18n/strings';

type SidePanelPage = 'chat' | 'agent' | 'write' | 'teamgqm';

const { Header, Content, Footer } = Layout;

export const SidePanelShell: React.FC = () => {
  useThemeSync();

  const [activePage, setActivePage] = useState<SidePanelPage>('chat');
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { message } = App.useApp();
  const workspaceId = useWorkspaceStore((s) => s.workspaceId);
  const conversationId = useWorkspaceStore((s) => s.conversationId);
  const hasHydrated = useThemeStore.persist.hasHydrated();

  // Load onboarding completion flag from chrome.storage.local
  useEffect(() => {
    chrome.storage.local.get('onboardingComplete').then((result) => {
      // Default to false (show onboarding) if key is missing or not strictly true
      setOnboardingComplete(result.onboardingComplete === true);
    });
  }, []);

  // Register Side Panel-specific commands (runs once)
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
      id: 'open-full-app',
      name: 'Open in Full Tab',
      description: 'Open the full app workspace in a new tab',
      category: t('commands.category.navigation'),
      action: () => {
        openFullApp(
          useWorkspaceStore.getState().workspaceId,
          useWorkspaceStore.getState().conversationId ?? undefined,
        );
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
      CommandRegistry.unregister('open-full-app');
      CommandRegistry.unregister('reload-extension');
    };
  }, []);

  // Cmd+K / Ctrl+K keydown listener (only when onboarding is complete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (onboardingComplete !== true) return;
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onboardingComplete]);

  const handleOpenFullApp = () => {
    try {
      openFullApp(workspaceId, conversationId ?? undefined);
    } catch {
      message.error(t('sidepanel.fullAppFailed'));
    }
  };

  const handleOnboardingComplete = () => {
    chrome.storage.local.set({ onboardingComplete: true });
    setOnboardingComplete(true);
  };

  // Loading state: show Skeleton while ThemeStore rehydrates or onboarding flag loads
  if (!hasHydrated || onboardingComplete === null) {
    return (
      <ErrorBoundary>
        <Layout style={{ height: '100vh', overflow: 'hidden' }}>
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

  // Onboarding state: show onboarding wizard instead of the shell
  if (onboardingComplete === false) {
    return (
      <ErrorBoundary>
        <OnboardingWizard open={true} onComplete={handleOnboardingComplete} />
      </ErrorBoundary>
    );
  }

  const renderPage = () => {
    switch (activePage) {
      case 'chat':
        return <ChatPage />;
      case 'agent':
        return <AgentPage />;
      case 'write':
      case 'teamgqm':
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <Empty description="Coming in Phase 7" />
          </div>
        );
      default:
        return <ChatPage />;
    }
  };

  return (
    <ErrorBoundary>
      <Layout style={{ height: '100vh', overflow: 'hidden' }}>
        {/* Header bar: app name + ThemeToggle */}
        <Header
          style={{
            height: 44,
            padding: '0 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'transparent',
            borderBottom: '1px solid var(--ant-color-border-secondary)',
          }}
        >
          <Typography.Text strong style={{ fontSize: 14 }}>
            NowPilot
          </Typography.Text>

          <ThemeToggle />
        </Header>

        {/* Tab navigation */}
        <Tabs
          activeKey={activePage}
          onChange={(key) => setActivePage(key as SidePanelPage)}
          style={{ margin: 0, padding: '0 8px' }}
          items={[
            {
              key: 'chat',
              label: 'Chat',
              icon: <MessageOutlined />,
            },
            {
              key: 'agent',
              label: 'Agent',
              icon: <RobotOutlined />,
            },
            {
              key: 'write',
              label: (
                <Tooltip title="Available in Phase 7">
                  <span>Write</span>
                </Tooltip>
              ),
              icon: <EditOutlined />,
              disabled: true,
            },
            {
              key: 'teamgqm',
              label: (
                <Tooltip title="Available in Phase 7">
                  <span>TeamGQM</span>
                </Tooltip>
              ),
              icon: <TeamOutlined />,
              disabled: true,
            },
          ]}
        />

        {/* Content area */}
        <Content style={{ flex: 1, overflow: 'auto' }}>
          {renderPage()}
        </Content>

        {/* Footer: Open Full App */}
        <Footer
          style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--ant-color-border-secondary)',
            textAlign: 'center',
          }}
        >
          <Button
            type="default"
            icon={<ExpandOutlined />}
            onClick={handleOpenFullApp}
            block
          >
            {t('sidepanel.footer')}
          </Button>
        </Footer>
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
