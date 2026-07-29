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
    {
      key: 'Chat',
      label: 'Chat',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 20 20">
          <path fill="currentColor" d="M12.899 1.417H7.1c-.813 0-1.468 0-2 .043-.546.045-1.026.139-1.47.365a3.75 3.75 0 0 0-1.639 1.64c-.226.443-.32.924-.365 1.47-.044.531-.044 1.187-.044 2v10.167c0 .258 0 .5.018.697.02.205.064.475.236.722.221.319.563.532.946.592.297.046.56-.032.752-.105.186-.07.403-.177.634-.29l1.499-.73c.513-.25.708-.343.907-.409q.281-.092.574-.132c.208-.029.424-.03.995-.03h4.755c.813 0 1.468 0 2-.044.546-.044 1.026-.139 1.47-.365a3.75 3.75 0 0 0 1.639-1.639c.226-.444.32-.924.365-1.47.044-.532.044-1.187.044-2V6.935c0-.813 0-1.469-.044-2-.044-.546-.139-1.027-.365-1.47a3.75 3.75 0 0 0-1.639-1.64c-.444-.226-.924-.32-1.47-.365-.532-.043-1.187-.043-2-.043z">
          </path>
          <path fill="#fff" fillRule="evenodd" d="M5.25 7.113a.75.75 0 0 1 .75-.75h8a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75m0 4.667a.75.75 0 0 1 .75-.75h6a.75.75 0 0 1 0 1.5H6a.75.75 0 0 1-.75-.75" clipRule="evenodd"></path>
        </svg>
      ),
    },
    {
      key: 'Note',
      label: 'Note',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="20" height="20" preserveAspectRatio="xMidYMid meet" style={{ width: 20, height: 20 }}>
          <defs>
            <clipPath id="nav_note_clip_308">
              <rect width="60" height="60" x="0" y="0"></rect>
            </clipPath>
            <clipPath id="nav_note_clip_319">
              <path d="M0,0 L60,0 L60,60 L0,60z"></path>
            </clipPath>
          </defs>
          <g clipPath="url(#nav_note_clip_308)">
            <g clipPath="url(#nav_note_clip_319)" transform="matrix(1,0,0,1,0,0)" opacity="1">
              <g transform="matrix(1,0,0,1,0,0)" opacity="1">
                <path strokeLinecap="round" strokeLinejoin="miter" fillOpacity="0" strokeMiterlimit="4" className="stroke-current" stroke="currentColor" strokeOpacity="1" strokeWidth="4.5" d=" M30,47.75 C30.850000381469727,49.220001220703125 31.950000762939453,50.529998779296875 33.2400016784668,51.61000061035156 C35.7599983215332,53.72999954223633 39.0099983215332,55 42.560001373291016,55 C46.11000061035156,55 49.369998931884766,53.72999954223633 51.88999938964844,51.61000061035156 C53.18000030517578,50.529998779296875 54.279998779296875,49.220001220703125 55.130001068115234,47.75">
                </path>
              </g>
              <g transform="matrix(1,0,0,1,0,0)" opacity="1">
                <path strokeLinecap="butt" strokeLinejoin="miter" fillOpacity="0" strokeMiterlimit="4" className="stroke-current" stroke="currentColor" strokeOpacity="1" strokeWidth="4.5" d=" M42.5,28 C42.5,28 42.5,28 42.5,28 C46.09000015258789,28 49,30.90999984741211 49,34.5 C49,34.5 49,40.5 49,40.5 C49,44.09000015258789 46.09000015258789,47 42.5,47 C38.90999984741211,47 36,44.09000015258789 36,40.5 C36,40.5 36,34.5 36,34.5 C36,30.90999984741211 38.90999984741211,28 42.5,28z">
                </path>
              </g>
            </g>
            <g transform="matrix(1,0,0,1,0,0)" opacity="1">
              <path strokeLinecap="round" strokeLinejoin="miter" fillOpacity="0" strokeMiterlimit="4" className="stroke-current" stroke="currentColor" strokeOpacity="1" strokeWidth="4.5" d=" M24,30 C24,30 17,30 17,30"></path>
            </g>
            <g transform="matrix(1,0,0,1,0,0)" opacity="1">
              <path strokeLinecap="round" strokeLinejoin="miter" fillOpacity="0" strokeMiterlimit="4" className="stroke-current" stroke="currentColor" strokeOpacity="1" strokeWidth="4.5" d=" M34,18 C34,18 17,18 17,18"></path>
            </g>
            <g transform="matrix(1,0,0,1,0,0)" opacity="1">
              <path strokeLinecap="round" strokeLinejoin="miter" fillOpacity="0" strokeMiterlimit="4" className="stroke-current" stroke="currentColor" strokeOpacity="1" strokeWidth="4.5" d=" M51,21.34000015258789 C51,21.34000015258789 51,19.399999618530273 51,19.399999618530273 C51,14.359999656677246 51,11.84000015258789 50.02000045776367,9.90999984741211 C49.15999984741211,8.220000267028809 47.779998779296875,6.840000152587891 46.09000015258789,5.980000019073486 C44.16999816894531,5 41.63999938964844,5 36.599998474121094,5 C36.599998474121094,5 20.399999618530273,5 20.399999618530273,5 C15.359999656677246,5 12.84000015258789,5 10.90999984741211,5.980000019073486 C9.220000267028809,6.840000152587891 7.840000152587891,8.220000267028809 6.980000019073486,9.90999984741211 C6,11.84000015258789 6,14.359999656677246 6,19.399999618530273 C6,19.399999618530273 6,35.599998474121094 6,35.599998474121094 C6,40.63999938964844 6,43.16999816894531 6.980000019073486,45.09000015258789 C7.840000152587891,46.779998779296875 9.220000267028809,48.15999984741211 10.90999984741211,49.02000045776367 C12.84000015258789,50 15.359999656677246,50 20.399999618530273,50 C20.399999618530273,50 21.31999969482422,50 21.31999969482422,50">
              </path>
            </g>
          </g>
        </svg>
      ),
    },
    {
      key: 'Write',
      label: 'Write',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="20" height="20" preserveAspectRatio="xMidYMid meet" style={{ width: 20, height: 20 }}>
          <defs>
            <clipPath id="nav_write_clip_358">
              <rect width="120" height="120" x="0" y="0"></rect>
            </clipPath>
          </defs>
          <g clipPath="url(#nav_write_clip_358)">
            <g transform="matrix(1,0,0,1,27.68,92.66)" opacity="1">
              <g opacity="1" transform="matrix(1,0,0,1,0,0)">
                <path strokeLinecap="round" strokeLinejoin="round" fillOpacity="0" className="stroke-current" stroke="currentColor" strokeOpacity="1" strokeWidth="9" d=" M-8.24,8.26 C-8.24,8.26 8.24,-8.26 8.24,-8.26">
                </path>
              </g>
            </g>
            <g transform="matrix(1,0,0,1,82.11,38.13)" opacity="1">
              <g opacity="1" transform="matrix(1,0,0,1,0,0)">
                <path strokeLinecap="butt" strokeLinejoin="miter" fillOpacity="0" strokeMiterlimit="4" className="stroke-current" stroke="currentColor" strokeOpacity="1" strokeWidth="9" d=" M6.84,25.89 C6.84,25.89 -25.89,-6.84 -25.89,-6.84 C-25.89,-6.84 -23.37,-11.38 -23.37,-11.38 C-19.17,-18.93 -17.08,-22.7 -14.1,-24.37 C-11.49,-25.83 -8.42,-26.26 -5.51,-25.58 C-2.18,-24.8 0.88,-21.74 6.99,-15.63 C6.99,-15.63 15.63,-6.98 15.63,-6.98 C21.74,-0.87 24.8,2.18 25.58,5.51 C26.26,8.42 25.83,11.49 24.37,14.1 C22.71,17.08 18.93,19.18 11.38,23.38 C11.38,23.38 6.84,25.89 6.84,25.89z">
                </path>
              </g>
            </g>
            <g transform="matrix(1,0,0,1,52.55,67.81)" opacity="1">
              <g opacity="1" transform="matrix(1,0,0,1,0,0)">
                <path strokeLinecap="butt" strokeLinejoin="miter" fillOpacity="0" strokeMiterlimit="4" className="stroke-current" stroke="currentColor" strokeOpacity="1" strokeWidth="9" d=" M35.96,-3.1 C35.96,-3.1 35.96,12.25 35.96,12.25 C35.96,18.43 35.96,21.52 34.8,23.96 C33.78,26.11 32.14,27.91 30.09,29.13 C27.76,30.51 24.68,30.8 18.53,31.37 C18.53,31.37 -28.78,35.74 -28.78,35.74 C-31.41,35.98 -32.73,36.1 -33.71,35.65 C-34.57,35.25 -35.25,34.57 -35.65,33.71 C-36.1,32.73 -35.98,31.41 -35.74,28.78 C-35.74,28.78 -31.37,-18.53 -31.37,-18.53 C-30.8,-24.68 -30.51,-27.76 -29.13,-30.09 C-27.91,-32.14 -26.11,-33.78 -23.96,-34.8 C-21.52,-35.96 -18.43,-35.96 -12.25,-35.96 C-12.25,-35.96 3.1,-35.96 3.1,-35.96">
                </path>
              </g>
            </g>
          </g>
        </svg>
      ),
    },
    {
      key: 'Tools',
      label: 'Tools',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="20" height="20" preserveAspectRatio="xMidYMid meet" style={{ width: 20, height: 20 }}>
          <defs>
            <clipPath id="nav_tools_clip_395">
              <rect width="120" height="120" x="0" y="0"></rect>
            </clipPath>
          </defs>
          <g clipPath="url(#nav_tools_clip_395)">
            <g transform="matrix(1,0,0,1,60,60)" opacity="1">
              <g opacity="1" transform="matrix(1,0,0,1,0,0)">
                <path className="fill-current" fill="currentColor" fillOpacity="1" d=" M54.24,-13.39 C53.97,-16.67 53.41,-19.54 52.05,-22.21 C49.89,-26.44 46.45,-29.89 42.22,-32.05 C39.55,-33.41 36.67,-33.97 33.39,-34.24 C31.92,-34.36 30.28,-34.42 28.47,-34.46 C28.45,-35.33 28.43,-36.13 28.38,-36.87 C28.25,-38.77 27.96,-40.57 27.24,-42.31 C25.57,-46.35 22.35,-49.56 18.31,-51.24 C16.57,-51.96 14.77,-52.24 12.87,-52.37 C11.04,-52.49 8.82,-52.5 6.15,-52.5 C6.15,-52.5 -6.15,-52.5 -6.15,-52.5 C-8.82,-52.5 -11.04,-52.49 -12.87,-52.37 C-14.77,-52.24 -16.57,-51.96 -18.31,-51.24 C-22.35,-49.56 -25.56,-46.35 -27.24,-42.31 C-27.96,-40.57 -28.24,-38.77 -28.37,-36.87 C-28.42,-36.13 -28.45,-35.33 -28.47,-34.46 C-30.28,-34.42 -31.92,-34.36 -33.39,-34.24 C-36.67,-33.97 -39.54,-33.41 -42.21,-32.05 C-46.44,-29.89 -49.89,-26.44 -52.05,-22.21 C-53.41,-19.54 -53.97,-16.67 -54.24,-13.39 C-54.5,-10.2 -54.5,-6.27 -54.5,-1.39 C-54.5,-1.39 -54.5,13.39 -54.5,13.39 C-54.5,18.27 -54.5,22.21 -54.24,25.39 C-53.97,28.67 -53.41,31.56 -52.05,34.22 C-49.89,38.45 -46.44,41.89 -42.21,44.05 C-39.54,45.41 -36.67,45.97 -33.39,46.24 C-30.2,46.5 -26.27,46.5 -21.39,46.5 C-21.39,46.5 21.39,46.5 21.39,46.5 C26.27,46.5 30.21,46.5 33.39,46.24 C36.67,45.97 39.55,45.41 42.22,44.05 C46.45,41.89 49.89,38.45 52.05,34.22 C53.41,31.56 53.97,28.67 54.24,25.39 C54.5,22.21 54.5,18.27 54.5,13.39 C54.5,13.39 54.5,-1.39 54.5,-1.39 C54.5,-6.27 54.5,-10.2 54.24,-13.39z M-19.4,-36.26 C-19.3,-37.7 -19.12,-38.41 -18.93,-38.87 C-18.17,-40.71 -16.71,-42.17 -14.87,-42.93 C-14.41,-43.12 -13.7,-43.3 -12.26,-43.4 C-10.77,-43.5 -8.86,-43.5 -6,-43.5 C-6,-43.5 6,-43.5 6,-43.5 C8.86,-43.5 10.78,-43.5 12.26,-43.4 C13.7,-43.3 14.41,-43.12 14.87,-42.93 C16.71,-42.17 18.17,-40.71 18.93,-38.87 C19.12,-38.41 19.3,-37.7 19.4,-36.26 C19.44,-35.73 19.46,-35.16 19.47,-34.5 C19.47,-34.5 -19.47,-34.5 -19.47,-34.5 C-19.45,-35.16 -19.44,-35.73 -19.4,-36.26z M-45.27,-12.66 C-45.05,-15.38 -44.63,-16.94 -44.03,-18.13 C-42.74,-20.67 -40.67,-22.74 -38.13,-24.03 C-36.94,-24.63 -35.38,-25.05 -32.66,-25.27 C-29.92,-25.49 -26.4,-25.5 -21.38,-25.5 C-21.38,-25.5 21.38,-25.5 21.38,-25.5 C26.4,-25.5 29.92,-25.49 32.66,-25.27 C35.38,-25.05 36.95,-24.63 38.13,-24.03 C40.67,-22.74 42.74,-20.67 44.03,-18.13 C44.63,-16.94 45.05,-15.38 45.27,-12.66 C45.44,-10.52 45.49,-7.92 45.5,-4.5 C45.5,-4.5 17.95,-4.5 17.95,-4.5 C15.94,-12.54 8.66,-18.5 0,-18.5 C-8.66,-18.5 -15.94,-12.54 -17.95,-4.5 C-17.95,-4.5 -45.5,-4.5 -45.5,-4.5 C-45.49,-7.92 -45.44,-10.52 -45.27,-12.66z M9.5,0 C9.5,5.25 5.25,9.5 0,9.5 C-5.25,9.5 -9.5,5.25 -9.5,0 C-9.5,-5.25 -5.25,-9.5 0,-9.5 C5.25,-9.5 9.5,-5.25 9.5,0z M45.5,13.2 C45.5,18.32 45.5,21.88 45.27,24.66 C45.05,27.38 44.63,28.95 44.03,30.13 C42.74,32.67 40.67,34.74 38.13,36.03 C36.95,36.63 35.38,37.05 32.66,37.27 C29.88,37.5 26.32,37.5 21.2,37.5 C21.2,37.5 -21.2,37.5 -21.2,37.5 C-26.31,37.5 -29.88,37.5 -32.66,37.27 C-35.38,37.05 -36.94,36.63 -38.13,36.03 C-40.67,34.74 -42.74,32.67 -44.03,30.13 C-44.63,28.95 -45.05,27.38 -45.27,24.66 C-45.5,21.88 -45.5,18.32 -45.5,13.2 C-45.5,13.2 -45.5,4.5 -45.5,4.5 C-45.5,4.5 -17.95,4.5 -17.95,4.5 C-15.94,12.54 -8.66,18.5 0,18.5 C8.66,18.5 15.94,12.54 17.95,4.5 C17.95,4.5 45.5,4.5 45.5,4.5 C45.5,4.5 45.5,13.2 45.5,13.2z">
                </path>
              </g>
            </g>
          </g>
        </svg>
      ),
    },
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
    <div className="flex h-full w-full bg-[var(--np-bg)] text-[var(--np-fg)] font-sans overflow-hidden p-[10px] gap-[10px]">
      {/* Switchbar Left Navigation */}
      <div className={`flex flex-col justify-between py-4 bg-transparent text-[var(--np-fg)] rounded-[20px] border-none transition-all duration-300 z-20 ${collapsed ? 'w-16 px-2' : 'w-56 px-3'}`}>
        <div>
          {/* Brand Header */}
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-2 mb-6`}>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center border border-[var(--np-border)] shadow-xs">
                <NowPilotAvatar className="w-full h-full object-cover" />
              </div>
              {!collapsed && (
                <span className="font-bold text-base tracking-tight text-[var(--np-fg)] truncate">
                  NowPilot
                </span>
              )}
            </div>

            {!collapsed && (
              <Tooltip title="Switch to sidebar">
                <button
                  onClick={onOpenSidepanel}
                  className="p-1.5 hover:bg-[var(--np-muted)] rounded-lg text-[var(--np-muted-fg)] hover:text-[var(--np-fg)] cursor-pointer transition-colors flex items-center justify-center"
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
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--np-card)] rounded-[20px] border border-[var(--np-border)] shadow-2xs">
        {activeMenu === 'Chat' && (
          <div className="h-full w-full relative overflow-hidden">
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
