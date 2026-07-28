import React, { useState } from 'react';
import { ConfigProvider, App as AntdApp, Segmented, Button, Tooltip, Tag } from 'antd';
import {
  LayoutOutlined,
  AppstoreOutlined,
  SettingOutlined,
  GithubOutlined,
  GlobalOutlined,
  ExpandOutlined,
  BulbOutlined,
} from '@ant-design/icons';

import { SidepanelChat } from './components/chat/SidepanelChat';
import { StandaloneWorkspace } from './components/standalone/StandaloneWorkspace';
import { OptionsPage } from './components/options/OptionsPage';
import { getAppTheme } from './styles/theme';
import { useExtensionStore } from './store/useExtensionStore';
import { NowPilotAvatar } from './components/common/NowPilotAvatar';

export default function App() {
  const { config } = useExtensionStore();
  const [activeView, setActiveView] = useState<'sidepanel' | 'standalone' | 'options'>('sidepanel');
  const [sidePanelWidth, setSidePanelWidth] = useState<number>(420);
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const isDarkMode = config.themeMode === 'Dark';

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = sidePanelWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const newWidth = Math.min(Math.max(startWidth + deltaX, 320), 800);
      setSidePanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <ConfigProvider theme={getAppTheme(isDarkMode)}>
      <AntdApp className="h-full w-full">
        <div className={`flex flex-col h-screen w-screen bg-zinc-900 text-zinc-100 font-sans overflow-hidden ${isResizing ? 'select-none cursor-col-resize' : 'select-none'}`}>
        {/* Extension Preview Top Bar */}
        <header className="h-11 px-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between text-xs flex-shrink-0 z-30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center border border-amber-500/30">
                <NowPilotAvatar className="w-full h-full object-cover" />
              </div>
              <span className="font-extrabold tracking-tight text-white text-sm">NowPilot</span>
            </div>
            <Tooltip title="Built with WXT framework, Ant Design v6 and Ant Design X">
              <Tag color="purple" className="m-0 text-[10px] uppercase font-bold border-none px-2 py-0.5 cursor-help">
                WXT + AntD v6 + AntD X
              </Tag>
            </Tooltip>
          </div>

          {/* View Mode Segmented Switcher */}
          <div className="flex items-center gap-2">
            <Segmented
              value={activeView}
              onChange={(val) => setActiveView(val as any)}
              options={[
                {
                  value: 'sidepanel',
                  label: (
                    <Tooltip title="View as Chrome Side Panel with web page context">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 font-semibold text-xs">
                        <LayoutOutlined />
                        <span>Side Panel View</span>
                      </div>
                    </Tooltip>
                  ),
                },
                {
                  value: 'standalone',
                  label: (
                    <Tooltip title="View in full-page standalone workspace mode">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 font-semibold text-xs">
                        <AppstoreOutlined />
                        <span>Standalone Workspace</span>
                      </div>
                    </Tooltip>
                  ),
                },
                {
                  value: 'options',
                  label: (
                    <Tooltip title="Open extension configuration & options page">
                      <div className="flex items-center gap-1.5 px-2 py-0.5 font-semibold text-xs">
                        <SettingOutlined />
                        <span>Options Page</span>
                      </div>
                    </Tooltip>
                  ),
                },
              ]}
            />
          </div>

          <div className="flex items-center gap-2">
            <Tooltip title="Active provider in session configuration">
              <span className="text-[11px] text-zinc-400 font-mono cursor-pointer">
                Provider: <span className="text-violet-400 font-bold uppercase">{config.activeProvider}</span>
              </span>
            </Tooltip>
          </div>
        </header>

        {/* View Layout Container */}
        <main className="flex-1 overflow-hidden relative">
          {activeView === 'sidepanel' && (
            <div className="flex h-full w-full bg-zinc-200 dark:bg-zinc-950 relative">
              {/* Simulated Active Web Browser Page on Left */}
              <div className="hidden md:flex flex-1 flex-col bg-white dark:bg-zinc-900 border-r border-zinc-300 dark:border-zinc-800 p-8 overflow-y-auto">
                <div className="max-w-3xl mx-auto w-full space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2 text-zinc-500 text-xs">
                      <GlobalOutlined className="text-blue-500" />
                      <span className="font-mono">https://github.com/google/llm-sidebar</span>
                    </div>
                    <Tooltip title="Context from active browser tab automatically injected">
                      <Tag color="blue" className="m-0 text-xs cursor-pointer">Active Tab Context</Tag>
                    </Tooltip>
                  </div>

                  <article className="prose dark:prose-invert max-w-none text-zinc-800 dark:text-zinc-200">
                    <h1 className="text-2xl font-bold mb-2">Conversational Interfaces Beyond Clicks</h1>
                    <p className="text-xs text-zinc-500 mb-4">
                      Modern AI design in 2026 focuses on modular grid interfaces, rich prompt triggers, and seamless context capture.
                    </p>

                    <div className="p-4 bg-violet-50 dark:bg-violet-950/30 rounded-2xl border border-violet-200 dark:border-violet-800 text-xs space-y-2 mb-6">
                      <h3 className="font-bold text-violet-900 dark:text-violet-200 m-0">Project Highlights</h3>
                      <ul className="list-disc pl-4 space-y-1 text-zinc-700 dark:text-zinc-300 m-0">
                        <li><strong>Bento Box Compartmentalisation</strong>: Modular components for chat history, tools, and options.</li>
                        <li><strong>Progressive Disclosure</strong>: Thought chains and collapsible reasoning process blocks.</li>
                        <li><strong>Multimodal Interaction</strong>: Real-time tab context, quote snippets, and screen capture tools.</li>
                      </ul>
                    </div>

                    <p className="text-xs leading-relaxed">
                      NowPilot is an AI Chrome Extension Assistant powered by WXT and Ant Design X. It bridges the gap between web applications and AI execution through unified provider bridges (OpenAI, Gemini API, WebApp sessions).
                    </p>
                  </article>
                </div>
              </div>

              {/* Drag handle for adjusting Side Panel Width */}
              <div
                onMouseDown={handleMouseDown}
                className="hidden md:flex w-2.5 hover:w-3 bg-transparent hover:bg-violet-500/30 active:bg-violet-600/50 cursor-col-resize z-30 transition-all items-center justify-center group flex-shrink-0 relative -ml-1.5"
                title="Drag to resize side panel width"
              >
                <div className="w-1 h-8 rounded-full bg-zinc-400/40 group-hover:bg-violet-500 transition-colors" />
              </div>

              {/* Chrome SidePanel Column with Dynamic Adjustable Width */}
              <div
                style={{ width: `${sidePanelWidth}px` }}
                className="w-full md:w-auto h-full flex-shrink-0 shadow-2xl z-20 p-[3px] bg-zinc-200 dark:bg-zinc-950 box-border"
              >
                <div className="h-full w-full rounded-[12px] overflow-hidden border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-md">
                  <SidepanelChat
                    onOpenStandalone={() => setActiveView('standalone')}
                    onOpenOptions={() => setActiveView('options')}
                  />
                </div>
              </div>
            </div>
          )}

          {activeView === 'standalone' && (
            <StandaloneWorkspace
              onOpenOptions={() => setActiveView('options')}
              onOpenSidepanel={() => setActiveView('sidepanel')}
            />
          )}

          {activeView === 'options' && (
            <OptionsPage />
          )}
        </main>
      </div>
      </AntdApp>
    </ConfigProvider>
  );
}
