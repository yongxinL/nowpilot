import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Segmented } from 'antd';
import { AppstoreOutlined, MessageOutlined, SettingOutlined } from '@ant-design/icons';
import { StandaloneWorkspace } from './components/standalone/StandaloneWorkspace';
import { SidepanelChat } from './components/chat/SidepanelChat';
import { OptionsPage } from './components/options/OptionsPage';
import { CommandPalette } from './components/common/CommandPalette';
import { ThemeToggle } from './components/common/ThemeToggle';
import { AppThemeProvider } from './components/common/AppThemeProvider';
import { CommandRegistry } from './core/commands/CommandRegistry';
import { useThemeStore, type ThemeMode } from './core/theme/ThemeStore';
import { initializeKnowledgeBase } from './core/knowledgeBaseBootstrap';
import './index.css';

// Phase-5 startup wiring (WR-01/WR-04): the sidepanel is the primary
// conversational surface — elect it so the MEM-02 single-writer gate is
// effective, and restore the persistent search index before any query.
void initializeKnowledgeBase('sidepanel');

const MODE_CYCLE: ThemeMode[] = ['light', 'dark', 'auto'];

const MainAppContent = () => {
  const [activeView, setActiveView] = useState<'workspace' | 'sidepanel' | 'options'>('workspace');
  const [paletteOpen, setPaletteOpen] = useState(false);

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
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--np-bg)] text-[var(--np-fg)]">
      <header className="flex-none h-12 px-4 border-b border-[var(--np-border)] flex items-center justify-between bg-[var(--np-card)]/80 backdrop-blur z-20">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-[var(--np-ring)] flex items-center justify-center text-white text-xs font-bold shadow-2xs">
            N
          </div>
          <span className="font-semibold text-sm tracking-tight text-[var(--np-fg)]">
            NowPilot
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--np-accent)] text-[var(--np-accent-fg)] font-medium border border-[var(--np-border)]">
            Web Preview
          </span>
        </div>

        <div className="flex items-center gap-3">
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
      </header>

      <main className="flex-1 overflow-hidden relative">
        {activeView === 'workspace' && (
          <StandaloneWorkspace
            onOpenOptions={() => setActiveView('options')}
            onOpenSidepanel={() => setActiveView('sidepanel')}
          />
        )}
        {activeView === 'sidepanel' && (
          <div className="h-full max-w-lg mx-auto border-x border-[var(--np-border)] bg-[var(--np-card)]">
            <SidepanelChat
              onOpenStandalone={() => setActiveView('workspace')}
              onOpenOptions={() => setActiveView('options')}
            />
          </div>
        )}
        {activeView === 'options' && <OptionsPage />}
      </main>

      <CommandPalette
        commands={CommandRegistry.getAll()}
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
};

const MainApp = () => (
  <AppThemeProvider>
    <MainAppContent />
  </AppThemeProvider>
);


const container = document.getElementById('root');
if (container) {
  createRoot(container).render(<MainApp />);
}
