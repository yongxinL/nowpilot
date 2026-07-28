import React, { useState } from 'react';
import { Typography, Tag, Modal, Input, Button, App, Tooltip } from 'antd';
import {
  MessageOutlined,
  FileTextOutlined,
  EditOutlined,
  AppstoreOutlined,
  SettingOutlined,
  FireFilled,
  FilePdfOutlined,
  YoutubeOutlined,
  VideoCameraOutlined,
  CompassOutlined,
  ReadOutlined,
  GlobalOutlined,
  TranslationOutlined,
  PictureOutlined,
  ScissorOutlined,
  BgColorsOutlined,
  UserOutlined,
  SendOutlined,
} from '@ant-design/icons';

import { SidepanelChat } from '../chat/SidepanelChat';
import { NotesWorkspace } from '../notes/NotesWorkspace';
import { NowPilotAvatar } from '../common/NowPilotAvatar';
import { ToolItem } from '../../types';

const { Title, Text } = Typography;

const TOOLS_LIST: ToolItem[] = [
  // Reading
  { id: 't1', name: 'ChatPDF', category: 'Reading', iconName: 'pdf', badge: 'hot', description: 'Analyze and ask questions directly to PDF documents' },
  { id: 't2', name: 'YouTube Summarizer', category: 'Reading', iconName: 'youtube', description: 'Extract bullet point summaries and chapter insights from YouTube videos' },
  { id: 't3', name: 'AI Video Shortener', category: 'Reading', iconName: 'video', description: 'Highlight key video moments and generate viral transcript clips' },

  // Agents
  { id: 't4', name: 'Deep Research', category: 'Agents', iconName: 'compass', badge: 'hot', description: 'Conduct multi-source web research with cited syntheses' },
  { id: 't5', name: 'Scholar Research', category: 'Agents', iconName: 'read', badge: 'new', description: 'Search academic papers, citations, and peer-reviewed journals' },
  { id: 't6', name: 'Web Creator', category: 'Agents', iconName: 'global', badge: 'new', description: 'Generate web components, micro-sites, and HTML layouts' },
  { id: 't7', name: 'AI Essay Writer', category: 'Agents', iconName: 'edit', description: 'Draft long-form essays, reports, and structured outlines' },
  { id: 't8', name: 'AI Slides', category: 'Agents', iconName: 'ppt', badge: 'new', description: 'Generate presentation deck outlines and slide content' },

  // Translate
  { id: 't9', name: 'AI Translator', category: 'Translate', iconName: 'translate', description: 'Context-aware multilingual translation across 50+ languages' },
  { id: 't10', name: 'Image Translator', category: 'Translate', iconName: 'picture', description: 'Translate text embedded inside uploaded images' },
  { id: 't11', name: 'PDF Translator', category: 'Translate', iconName: 'pdf', badge: 'hot', description: 'Translate full PDF documents preserving original visual layout' },

  // Image
  { id: 't12', name: 'AI Image Generator', category: 'Image', iconName: 'picture', badge: 'hot', description: 'Generate photorealistic imagery from natural language prompts' },
  { id: 't13', name: 'Background Remover', category: 'Image', iconName: 'bg', description: 'Isolate foreground subjects with clean transparent backgrounds' },
  { id: 't14', name: 'Background Changer', category: 'Image', iconName: 'bg', description: 'Swap image backgrounds with AI custom generated environments' },
  { id: 't15', name: 'Photo Eraser', category: 'Image', iconName: 'scissor', description: 'Remove unwanted objects or watermarks seamlessly' },
  { id: 't16', name: 'Inpaint', category: 'Image', iconName: 'picture', description: 'Edit specific image areas with generative fill' },
  { id: 't17', name: 'Image Upscaler', category: 'Image', iconName: 'picture', description: 'Enhance image resolution up to 4x high definition' },
];

interface StandaloneWorkspaceProps {
  onOpenOptions?: () => void;
  onOpenSidepanel?: () => void;
}

export const StandaloneWorkspace: React.FC<StandaloneWorkspaceProps> = ({
  onOpenOptions,
  onOpenSidepanel,
}) => {
  const { message: antMessage } = App.useApp();
  const [collapsed, setCollapsed] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'Chat' | 'Note' | 'Write' | 'Tools'>('Chat');
  const [selectedTool, setSelectedTool] = useState<ToolItem | null>(null);
  const [toolPromptInput, setToolPromptInput] = useState('');
  const [toolResult, setToolResult] = useState('');

  const renderToolIcon = (iconName: string) => {
    switch (iconName) {
      case 'pdf': return <FilePdfOutlined className="text-red-500 text-lg" />;
      case 'youtube': return <YoutubeOutlined className="text-red-600 text-lg" />;
      case 'video': return <VideoCameraOutlined className="text-indigo-500 text-lg" />;
      case 'compass': return <CompassOutlined className="text-violet-600 text-lg" />;
      case 'read': return <ReadOutlined className="text-blue-600 text-lg" />;
      case 'global': return <GlobalOutlined className="text-emerald-600 text-lg" />;
      case 'translate': return <TranslationOutlined className="text-purple-600 text-lg" />;
      case 'scissor': return <ScissorOutlined className="text-amber-600 text-lg" />;
      case 'bg': return <BgColorsOutlined className="text-teal-600 text-lg" />;
      default: return <PictureOutlined className="text-violet-500 text-lg" />;
    }
  };

  const navItems = [
    { key: 'Chat', label: 'Chat', icon: <MessageOutlined /> },
    { key: 'Note', label: 'Note', icon: <FileTextOutlined /> },
    { key: 'Write', label: 'Write', icon: <EditOutlined /> },
    { key: 'Tools', label: 'Tools', icon: <AppstoreOutlined /> },
  ];

  const handleRunTool = () => {
    if (!toolPromptInput.trim()) return;
    antMessage.loading({ content: `Running ${selectedTool?.name}...`, key: 'tool_run', duration: 1.5 });
    setTimeout(() => {
      setToolResult(`Analysis complete for ${selectedTool?.name}:\n\nKey Insights & Synthesis:\n• ${toolPromptInput}\n• Automated summary processed via AI engine.\n• Exportable to Notes & Workspace.`);
      antMessage.success({ content: 'Done!', key: 'tool_run' });
    }, 1500);
  };

  return (
    <div className="flex h-full w-full bg-zinc-100 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 font-sans overflow-hidden p-[10px] gap-[10px]">
      {/* Switchbar Left Navigation */}
      <div className={`flex flex-col justify-between py-4 bg-[#f6f6f8] dark:bg-zinc-900 rounded-[20px] shadow-2xs transition-all duration-300 z-20 ${collapsed ? 'w-16 px-2' : 'w-56 px-3'}`}>
        <div>
          {/* Brand Header */}
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-2 mb-6`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center border border-zinc-200/80 dark:border-zinc-700/80 shadow-xs">
                <NowPilotAvatar className="w-full h-full object-cover" />
              </div>
              {!collapsed && (
                <span className="font-bold text-base tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                  NowPilot
                </span>
              )}
            </div>

            {!collapsed && (
              <Tooltip title="Switch to sidebar">
                <button
                  onClick={onOpenSidepanel}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer transition-colors flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 14 14"><path fill="currentColor" d="M2.665 3.362a.525.525 0 1 0-.743.743L4.818 7 1.922 9.895a.525.525 0 1 0 .743.743L5.6 7.7a.99.99 0 0 0 0-1.402zm8.67 0a.525.525 0 0 1 .743.743L9.183 7l2.895 2.895a.525.525 0 0 1-.742.743L8.399 7.7a.99.99 0 0 1 0-1.402z"></path></svg>
                </button>
              </Tooltip>
            )}
          </div>

          {/* Nav List */}
          <div className="space-y-1">
            {navItems.map(item => {
              const isActive = activeMenu === item.key;
              const navButton = (
                <button
                  key={item.key}
                  onClick={() => setActiveMenu(item.key as any)}
                  className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 rounded-xl text-base font-semibold cursor-pointer transition-all ${
                    isActive
                      ? 'bg-violet-100/80 dark:bg-violet-950/60 text-violet-700 dark:text-violet-300 shadow-xs'
                      : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.key} title={item.label} placement="right">
                    {navButton}
                  </Tooltip>
                );
              }

              return navButton;
            })}
          </div>
        </div>

        {/* Bottom Switchbar Footer */}
        {!collapsed ? (
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between px-1">
            {/* Avatar + Settings icon */}
            <div className="flex items-center gap-2">
              <div className="relative group cursor-pointer">
                <div className="w-7 h-7 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold shadow-xs overflow-hidden">
                  <UserOutlined />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 border border-white dark:border-zinc-900" />
              </div>

              <Tooltip title="Options">
                <button
                  onClick={onOpenOptions}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer transition-colors flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 60 60"><path fill="currentColor" fillRule="evenodd" d="M24.455 4.367h11.089c2.682 0 4.536-.002 6.236.55a11.25 11.25 0 0 1 4.051 2.34c1.329 1.196 2.255 2.802 3.595 5.125l.18.31 5.185 8.983.18.31c1.342 2.322 2.269 3.927 2.64 5.676a11.25 11.25 0 0 1 0 4.678c-.371 1.749-1.298 3.354-2.64 5.676l-.18.31-5.186 8.983-.179.31c-1.34 2.323-2.266 3.929-3.595 5.125a11.25 11.25 0 0 1-4.05 2.34c-1.701.552-3.555.55-6.236.55h-11.09c-2.682 0-4.535.002-6.235-.55a11.25 11.25 0 0 1-4.052-2.34c-1.328-1.196-2.254-2.802-3.594-5.125l-.18-.31-5.186-8.983-.18-.31c1.341-2.322-2.268-3.927-2.64-5.676a11.25 11.25 0 0 1 0-4.678c.372-1.749 1.299-3.354 2.64-5.676l.18-.31 5.186-8.983.18-.31c1.34-2.323 2.266-3.929 3.594-5.125a11.25 11.25 0 0 1 4.052-2.34c1.7-.552 3.553-.55 6.235-.55m.359 4.5c-3.18 0-4.268.026-5.204.33a6.75 6.75 0 0 0-2.43 1.404c-.732.659-1.298 1.587-2.889 4.341l-5.186 8.983c1.59 2.754-2.11 3.709-2.315 4.672a6.75 6.75 0 0 0 0 2.806c.204.963.725 1.918 2.315 4.672l5.186 8.983c1.59 2.754 2.157 3.682 2.888 4.34a6.75 6.75 0 0 0 2.431 1.404c.936.304 2.023.33 5.204.33h10.372c3.18 0 4.267-.026 5.203-.33A6.75 6.75 0 0 0 42.82 49.4c.732-.659 1.298-1.587 2.888-4.341l5.186-8.983c1.59-2.754 2.111-3.709 2.316-4.672a6.75 6.75 0 0 0 0-2.806c-.205-.963-.725-1.918-2.316-4.672l-5.186-8.983c-1.59-2.754-2.156-3.682-2.888-4.34a6.75 6.75 0 0 0-2.43-1.404c-.937-.305-2.023-.33-5.204-.33zM30 21.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5M17.25 30c0-7.042 5.708-12.75 12.75-12.75S42.75 22.958 42.75 30 37.04 42.75 30 42.75 17.25 37.042 17.25 30" clipRule="evenodd"></path></svg>
                </button>
              </Tooltip>
            </div>

            {/* Collapse icon button |< */}
            <Tooltip title="Collapse">
              <button
                onClick={() => setCollapsed(true)}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 3L6 8l5 5" />
                  <path d="M3 3v10" />
                </svg>
              </button>
            </Tooltip>
          </div>
        ) : (
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col items-center gap-3">
            {/* Settings button */}
            <Tooltip title="Options" placement="right">
              <button
                onClick={onOpenOptions}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer transition-colors flex items-center justify-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" fill="none" viewBox="0 0 60 60"><path fill="currentColor" fillRule="evenodd" d="M24.455 4.367h11.089c2.682 0 4.536-.002 6.236.55a11.25 11.25 0 0 1 4.051 2.34c1.329 1.196 2.255 2.802 3.595 5.125l.18.31 5.185 8.983.18.31c1.342 2.322 2.269 3.927 2.64 5.676a11.25 11.25 0 0 1 0 4.678c-.371 1.749-1.298 3.354-2.64 5.676l-.18.31-5.186 8.983-.179.31c-1.34 2.323-2.266 3.929-3.595 5.125a11.25 11.25 0 0 1-4.05 2.34c-1.701.552-3.555.55-6.236.55h-11.09c-2.682 0-4.535.002-6.235-.55a11.25 11.25 0 0 1-4.052-2.34c-1.328-1.196-2.254-2.802-3.594-5.125l-.18-.31-5.186-8.983-.18-.31c1.341-2.322-2.268-3.927-2.64-5.676a11.25 11.25 0 0 1 0-4.678c.372-1.749 1.299-3.354 2.64-5.676l.18-.31 5.186-8.983.18-.31c1.34-2.323 2.266-3.929 3.594-5.125a11.25 11.25 0 0 1 4.052-2.34c1.7-.552 3.553-.55 6.235-.55m.359 4.5c-3.18 0-4.268.026-5.204.33a6.75 6.75 0 0 0-2.43 1.404c-.732.659-1.298 1.587-2.889 4.341l-5.186 8.983c1.59 2.754-2.11 3.709-2.315 4.672a6.75 6.75 0 0 0 0 2.806c.204.963.725 1.918 2.315 4.672l5.186 8.983c1.59 2.754 2.157 3.682 2.888 4.34a6.75 6.75 0 0 0 2.431 1.404c.936.304 2.023.33 5.204.33h10.372c3.18 0 4.267-.026 5.203-.33A6.75 6.75 0 0 0 42.82 49.4c.732-.659 1.298-1.587 2.888-4.341l5.186-8.983c1.59-2.754 2.111-3.709 2.316-4.672a6.75 6.75 0 0 0 0-2.806c-.205-.963-.725-1.918-2.316-4.672l-5.186-8.983c-1.59-2.754-2.156-3.682-2.888-4.34a6.75 6.75 0 0 0-2.43-1.404c-.937-.305-2.023-.33-5.204-.33zM30 21.75a8.25 8.25 0 1 0 0 16.5 8.25 8.25 0 0 0 0-16.5M17.25 30c0-7.042 5.708-12.75 12.75-12.75S42.75 22.958 42.75 30 37.04 42.75 30 42.75 17.25 37.042 17.25 30" clipRule="evenodd"></path></svg>
              </button>
            </Tooltip>

            {/* Avatar */}
            <div className="relative cursor-pointer">
              <div className="w-7 h-7 rounded-full bg-violet-600 text-white flex items-center justify-center text-xs font-bold shadow-xs overflow-hidden">
                <UserOutlined />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 border border-white dark:border-zinc-900" />
            </div>

            {/* Expand button >| */}
            <Tooltip title="Expand" placement="right">
              <button
                onClick={() => setCollapsed(false)}
                className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 3l5 5-5 5" />
                  <path d="M13 3v10" />
                </svg>
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-zinc-900 rounded-[20px] border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
        {activeMenu === 'Chat' && (
          <div className="h-full w-full max-w-2xl mx-auto">
            <SidepanelChat onOpenOptions={onOpenOptions} isStandalone={true} />
          </div>
        )}

        {activeMenu === 'Tools' && (
          <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full">
            <Title level={2} className="!mb-6 font-bold text-zinc-900 dark:text-zinc-100">
              Tools
            </Title>

            {(['Reading', 'Agents', 'Translate', 'Image'] as const).map(cat => (
              <div key={cat} className="mb-8">
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  {cat}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {TOOLS_LIST.filter(t => t.category === cat).map(tool => (
                    <div
                      key={tool.id}
                      onClick={() => {
                        setSelectedTool(tool);
                        setToolResult('');
                        setToolPromptInput('');
                      }}
                      className="group p-4 bg-zinc-50 hover:bg-white dark:bg-zinc-800/60 dark:hover:bg-zinc-800 rounded-2xl border border-zinc-200/80 hover:border-violet-300 dark:border-zinc-700/80 dark:hover:border-violet-600 transition-all cursor-pointer shadow-2xs hover:shadow-md flex items-start gap-3.5"
                    >
                      <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 shadow-2xs flex-shrink-0">
                        {renderToolIcon(tool.iconName)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-violet-600 transition-colors">
                            {tool.name}
                          </span>
                          {tool.badge === 'hot' && (
                            <FireFilled className="text-amber-500 text-xs" />
                          )}
                          {tool.badge === 'new' && (
                            <Tag color="purple" className="m-0 text-[9px] font-extrabold uppercase px-1 py-0">
                              NEW
                            </Tag>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-snug m-0">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeMenu === 'Note' && (
          <div className="h-full w-full overflow-hidden">
            <NotesWorkspace />
          </div>
        )}

        {activeMenu === 'Write' && (
          <div className="flex-1 p-8 max-w-4xl mx-auto w-full flex flex-col">
            <Title level={2} className="!mb-2 font-bold text-zinc-900 dark:text-zinc-100">
              Write Workspace
            </Title>
            <Text type="secondary" className="mb-6 block text-xs">
              AI-assisted intelligent editor & generator for writing tasks.
            </Text>

            <div className="flex-1 bg-zinc-50 dark:bg-zinc-800/40 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 flex flex-col">
              <Input.TextArea
                rows={12}
                placeholder="Type or paste your content here for writing..."
                className="bg-transparent border-none outline-none font-mono text-sm flex-1"
              />
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <Button type="primary" icon={<SendOutlined />} style={{ backgroundColor: '#7c3aed' }}>
                  Analyze with AI
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Interactive Tool Runner Modal */}
      {selectedTool && (
        <Modal
          open={!!selectedTool}
          onCancel={() => setSelectedTool(null)}
          footer={null}
          width={540}
          title={
            <div className="flex items-center gap-2">
              {renderToolIcon(selectedTool.iconName)}
              <span className="font-bold text-base">{selectedTool.name}</span>
            </div>
          }
        >
          <p className="text-xs text-zinc-500 mb-4">{selectedTool.description}</p>

          <Input.TextArea
            rows={3}
            placeholder="Provide context, URL, document text, or prompt..."
            value={toolPromptInput}
            onChange={e => setToolPromptInput(e.target.value)}
            className="mb-3 text-xs"
          />

          <div className="flex justify-end mb-4">
            <Button
              type="primary"
              onClick={handleRunTool}
              disabled={!toolPromptInput.trim()}
              style={{ backgroundColor: '#7c3aed' }}
            >
              Run Tool
            </Button>
          </div>

          {toolResult && (
            <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-mono whitespace-pre-wrap">
              {toolResult}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
