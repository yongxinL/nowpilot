import React, { useState } from 'react';
import { Input, Button, Tag, Tooltip, App, Dropdown, MenuProps, Typography } from 'antd';

const { Title } = Typography;
import {
  SearchOutlined,
  PlusOutlined,
  ImportOutlined,
  CloudUploadOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  FileTextOutlined,
  StarOutlined,
  StarFilled,
  ClockCircleOutlined,
  TagOutlined,
  EditOutlined,
  ShareAltOutlined,
  MoreOutlined,
  UndoOutlined,
  RedoOutlined,
  BoldOutlined,
  ItalicOutlined,
  CodeOutlined,
  UnorderedListOutlined,
  OrderedListOutlined,
  TableOutlined,
  CheckSquareOutlined,
  LinkOutlined,
  PictureOutlined,
  FilterOutlined,
  SortAscendingOutlined,
  AppstoreOutlined,
  CopyOutlined,
  FileMarkdownOutlined,
  FilePdfOutlined,
  FolderAddOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  BulbOutlined,
  DownOutlined,
  RightOutlined,
  DoubleLeftOutlined,
  DoubleRightOutlined,
  BarsOutlined,
  LayoutOutlined,
} from '@ant-design/icons';
import { NowPilotAvatar } from '../common/NowPilotAvatar';

export interface NoteItem {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  folderPath: string;
  tags: string[];
  updatedAt: string;
  createdAt: string;
  isFavorite: boolean;
  content: {
    summary: string;
    flowchart?: boolean;
    notice?: string;
    sections: {
      title: string;
      text?: string;
      tableData?: {
        status: string;
        desc: string;
        trigger: string;
        action: string;
      }[];
    }[];
  };
  wordCount: number;
  readTime: string;
  linkCount: number;
  backlinkCount: number;
}

const INITIAL_NOTES: NoteItem[] = [
  {
    id: 'n1',
    title: 'INC Lifecycle Flow & Workflow Deep Dive',
    excerpt: 'Detailed documentation of ServiceNow Incident lifecycle flow diagram from New to Resolved with best practices...',
    category: 'Incident',
    folderPath: 'ServiceNow / Incident',
    tags: ['ServiceNow', 'Incident', 'Workflow'],
    updatedAt: '10 mins ago',
    createdAt: '2024-01-15 14:30',
    isFavorite: true,
    wordCount: 1234,
    readTime: '5 mins',
    linkCount: 8,
    backlinkCount: 12,
    content: {
      summary: 'This document provides a comprehensive overview of ServiceNow Incident lifecycle states, state definitions, trigger conditions, and operational best practices.',
      flowchart: true,
      notice: 'Note: Dashed lines represent possible rollback paths; actual state transitions are strictly governed by workflows and business rules.',
      sections: [
        {
          title: '1. Incident State Transition Diagram',
          text: 'Incidents in ServiceNow traverse 6 standard lifecycle states: from initial submission (New), assignment to a support team (Assigned), active technician investigation (In Progress), temporary suspension when pending external input (On Hold), resolution verification (Resolved), and finally archived closure (Closed).',
        },
        {
          title: '2. State Definitions & Triggers',
          tableData: [
            { status: 'New', desc: 'Incident created, pending assignment to group or individual', trigger: 'User submission or API integration', action: 'Assign, categorize, set priority' },
            { status: 'Assigned', desc: 'Assigned to a specific support team or individual agent', trigger: 'Manual assignment or auto-dispatch rule', action: 'Communicate, investigate, update notes' },
            { status: 'In Progress', desc: 'Support engineers actively investigating and resolving issue', trigger: 'Agent accepts or begins work on ticket', action: 'Add work notes, update progress' },
            { status: 'On Hold', desc: 'Suspended pending customer response, vendor, or change window', trigger: 'Waiting on third party or user response', action: 'Set hold reason, schedule follow-up' },
            { status: 'Resolved', desc: 'Fix applied, pending user verification or auto-close timer', trigger: 'Resolution complete, awaiting sign-off', action: 'Validate solution, confirm closure' },
            { status: 'Closed', desc: 'Incident fully archived, re-opening restricted by system', trigger: 'User confirmation or auto-close SLA rule', action: 'Archive record, generate KB article' },
          ],
        },
      ],
    },
  },
  {
    id: 'n2',
    title: 'Script Optimization: Batch Update Incident Status',
    excerpt: 'Using Background Scripts to optimize batch Incident updates, reducing DB queries and lock wait times...',
    category: 'Incident',
    folderPath: 'ServiceNow / Incident',
    tags: ['Script', 'Performance', 'ServiceNow'],
    updatedAt: '2 hours ago',
    createdAt: '2024-01-15 11:20',
    isFavorite: false,
    wordCount: 890,
    readTime: '3 mins',
    linkCount: 4,
    backlinkCount: 6,
    content: {
      summary: 'Explains performance optimization techniques in ServiceNow using GlideRecord update methods or Background Scripts for bulk data updates.',
      sections: [
        {
          title: '1. Background & Challenge',
          text: 'Updating thousands of historical Incident records using traditional while(gr.next()) { gr.update(); } causes frequent table locking and severe network overhead.',
        },
        {
          title: '2. Optimization Strategy',
          text: 'Using setWorkflow(false) disables unnecessary business engines and setAutoFields(false) prevents system field overhead, improving batch update speed by 5-10x.',
        },
      ],
    },
  },
  {
    id: 'n3',
    title: 'Common Incident Troubleshooting & Solutions',
    excerpt: 'Summary of common issues encountered during daily Incident resolution, including error codes and fixes...',
    category: 'Incident',
    folderPath: 'ServiceNow / Incident',
    tags: ['Incident', 'Troubleshooting'],
    updatedAt: 'Yesterday',
    createdAt: '2024-01-14 16:00',
    isFavorite: true,
    wordCount: 1560,
    readTime: '7 mins',
    linkCount: 11,
    backlinkCount: 18,
    content: {
      summary: 'Consolidates common ticket blockers like missing permissions, unexpected SLA triggers, and undelivered notifications with troubleshooting guides.',
      sections: [
        {
          title: '1. SLA Countdown Stopped Unexpectedly',
          text: 'Check the Pause Condition in the SLA Condition setup to verify whether state transitions triggered the hold policy.',
        },
      ],
    },
  },
  {
    id: 'n4',
    title: 'ServiceNow Business Rule Best Practices',
    excerpt: 'Best practices for writing Business Rules including performance tuning, loop prevention, and Scratchpad usage...',
    category: 'ServiceNow',
    folderPath: 'ServiceNow / Incident',
    tags: ['ServiceNow', 'Best Practice', 'BR'],
    updatedAt: '2 days ago',
    createdAt: '2024-01-13 09:15',
    isFavorite: false,
    wordCount: 2100,
    readTime: '9 mins',
    linkCount: 15,
    backlinkCount: 22,
    content: {
      summary: 'A comprehensive guide on Business Rules covering Before, After, Async, and Display rule definitions and best practices.',
      sections: [
        {
          title: '1. Prevent Recursive Executions',
          text: 'When invoking current.update() inside After Business Rules, handle execution conditions carefully to prevent infinite loops.',
        },
      ],
    },
  },
  {
    id: 'n5',
    title: 'IntegrationHub Usage Guide',
    excerpt: 'Comprehensive guide to configuring ServiceNow IntegrationHub, including triggers, actions, and REST Spoke APIs...',
    category: 'ServiceNow',
    folderPath: 'ServiceNow / Incident',
    tags: ['Integration', 'ServiceNow'],
    updatedAt: '3 days ago',
    createdAt: '2024-01-12 18:40',
    isFavorite: false,
    wordCount: 1150,
    readTime: '4 mins',
    linkCount: 6,
    backlinkCount: 9,
    content: {
      summary: 'Covers third-party API integration and steps for configuring IntegrationHub Spokes within Flow Designer workflows.',
      sections: [
        {
          title: '1. Custom Spoke Creation Steps',
          text: 'Navigate to IntegrationHub > Action Designer to configure Action Inputs, REST Steps, and authentication payloads.',
        },
      ],
    },
  },
];

export const NotesWorkspace: React.FC = () => {
  const { message: antMessage } = App.useApp();
  const [notes, setNotes] = useState<NoteItem[]>(INITIAL_NOTES);
  const [selectedNoteId, setSelectedNoteId] = useState<string>('n1');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedFolder, setSelectedFolder] = useState<string>('ServiceNow / Incident');
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedFolder, setExpandedFolder] = useState<boolean>(true);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Column visibility states for responsive layout
  const [showLeftCol, setShowLeftCol] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );
  const [showListCol, setShowListCol] = useState<boolean>(true);
  const [showRightCol, setShowRightCol] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 1280 : true
  );

  const selectedNote = notes.find(n => n.id === selectedNoteId) || notes[0];

  // Filter notes
  const filteredNotes = notes.filter(n => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        n.title.toLowerCase().includes(q) ||
        n.excerpt.toLowerCase().includes(q) ||
        n.tags.some(t => t.toLowerCase().includes(q));
      if (!match) return false;
    }
    if (activeCategory === 'favorites') return n.isFavorite;
    if (selectedTagFilter) return n.tags.includes(selectedTagFilter);
    return true;
  });

  const handleCreateNewNote = () => {
    const newId = `n_${Date.now()}`;
    const newNote: NoteItem = {
      id: newId,
      title: 'Untitled Note',
      excerpt: 'Type note summary here or use AI assistant to generate content automatically...',
      category: 'Uncategorized',
      folderPath: selectedFolder,
      tags: ['NewNote'],
      updatedAt: 'Just now',
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      isFavorite: false,
      wordCount: 12,
      readTime: '1 min',
      linkCount: 0,
      backlinkCount: 0,
      content: {
        summary: 'AI summary for this new note will appear here automatically.',
        sections: [
          {
            title: '1. Note Content',
            text: 'Start drafting your technical ideas, solution architecture, or incident logs here...',
          },
        ],
      },
    };
    setNotes([newNote, ...notes]);
    setSelectedNoteId(newId);
    antMessage.success('Created new note');
  };

  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotes(prev =>
      prev.map(n => (n.id === id ? { ...n, isFavorite: !n.isFavorite } : n))
    );
    antMessage.info(selectedNote?.isFavorite ? 'Removed from favorites' : 'Added to favorites');
  };

  const handleRegenerateSummary = () => {
    antMessage.loading({ content: 'AI analyzing note content and generating summary...', key: 'ai_sum' });
    setTimeout(() => {
      antMessage.success({ content: 'AI summary updated!', key: 'ai_sum' });
    }, 1200);
  };

  const moreMenuProps: MenuProps = {
    items: [
      { key: 'copy', label: 'Copy Note Content', icon: <CopyOutlined /> },
      { key: 'export_md', label: 'Export as Markdown', icon: <FileMarkdownOutlined /> },
      { key: 'export_pdf', label: 'Export as PDF', icon: <FilePdfOutlined /> },
      { type: 'divider' },
      { key: 'delete', label: 'Delete Note', danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'copy') {
        navigator.clipboard.writeText(selectedNote.title + '\n\n' + selectedNote.content.summary);
        antMessage.success('Copied to clipboard');
      } else {
        antMessage.info(`Action executed: ${key}`);
      }
    },
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#f8f9fc] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 font-sans overflow-hidden">
      {/* Top Header Bar */}
      <div className="h-14 px-5 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md flex items-center justify-between flex-shrink-0 z-10 gap-4">
        {/* Left Search Input */}
        <div className="relative w-72 sm:w-80 flex-shrink-0">
          <Input
            prefix={<SearchOutlined className="text-zinc-400 mr-1" />}
            placeholder="Search notes, tags, or content..."
            suffix={
              <span className="text-[10px] font-semibold text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded px-1.5 py-0.5">
                ⌘ K
              </span>
            }
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="rounded-full bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200 dark:border-zinc-700 text-xs py-1.5"
          />
        </div>

        {/* Center Column Toggle Controls */}
        <div className="flex items-center gap-1 bg-zinc-100/80 dark:bg-zinc-800/80 p-1 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80">
          <Tooltip title={showLeftCol ? "Hide Directory Sidebar" : "Show Directory Sidebar"}>
            <button
              onClick={() => setShowLeftCol(!showLeftCol)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                showLeftCol
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <FolderOutlined />
              <span className="hidden md:inline">Directory</span>
            </button>
          </Tooltip>

          <Tooltip title={showListCol ? "Hide Notes Stream" : "Show Notes Stream"}>
            <button
              onClick={() => setShowListCol(!showListCol)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                showListCol
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <BarsOutlined />
              <span className="hidden md:inline">Notes</span>
            </button>
          </Tooltip>

          <Tooltip title={showRightCol ? "Hide Inspector" : "Show Inspector"}>
            <button
              onClick={() => setShowRightCol(!showRightCol)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                showRightCol
                  ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-2xs font-semibold'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <InfoCircleOutlined />
              <span className="hidden md:inline">Inspector</span>
            </button>
          </Tooltip>
        </div>

        {/* Right Header Buttons */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateNewNote}
            className="bg-blue-600 hover:bg-blue-500 font-medium text-xs rounded-lg px-3 sm:px-4 h-9 border-none shadow-xs"
          >
            <span className="hidden sm:inline">New Note</span>
          </Button>

          <Button
            icon={<ImportOutlined />}
            onClick={() => antMessage.info('Opened Import Dialog')}
            className="text-xs rounded-lg border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 h-9 hidden sm:inline-flex"
          >
            Import
          </Button>

          <Button
            icon={<CloudUploadOutlined />}
            onClick={() => antMessage.success('Knowledge Base Backup Complete')}
            className="text-xs rounded-lg border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 h-9 hidden md:inline-flex"
          >
            Backup
          </Button>

          <div className="ml-1 w-8 h-8 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700 flex items-center justify-center bg-violet-100 dark:bg-violet-950">
            <NowPilotAvatar className="w-full h-full object-cover" />
          </div>
        </div>
      </div>

      {/* Main 4-Panel Content Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* PANEL 1: Navigation / Category Tree & Tags (Left Column) */}
        {showLeftCol && (
          <div className="w-60 border-r border-zinc-200/80 dark:border-zinc-800 bg-[#f8f9fc] dark:bg-zinc-900/50 flex flex-col justify-between flex-shrink-0 p-3 overflow-y-auto select-none transition-all">
            <div>
              {/* Navigation Header */}
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-2 py-1.5 mb-1 flex items-center justify-between">
                <span>Directory</span>
                <Tooltip title="Collapse Directory">
                  <button
                    onClick={() => setShowLeftCol(false)}
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-0.5 rounded transition-colors cursor-pointer"
                  >
                    <DoubleLeftOutlined className="text-xs" />
                  </button>
                </Tooltip>
              </div>

            {/* Main Category List */}
            <div className="space-y-0.5 text-xs text-zinc-700 dark:text-zinc-300">
              <div
                onClick={() => { setActiveCategory('all'); setSelectedTagFilter(null); }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  activeCategory === 'all' && !selectedTagFilter
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileTextOutlined className="text-zinc-400" />
                  <span>All Notes</span>
                </span>
                <span className="text-[11px] text-zinc-400">128</span>
              </div>

              <div
                onClick={() => { setActiveCategory('recent'); setSelectedTagFilter(null); }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  activeCategory === 'recent'
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
                }`}
              >
                <span className="flex items-center gap-2">
                  <ClockCircleOutlined className="text-zinc-400" />
                  <span>Recently Updated</span>
                </span>
                <span className="text-[11px] text-zinc-400">12</span>
              </div>

              <div
                onClick={() => { setActiveCategory('favorites'); setSelectedTagFilter(null); }}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  activeCategory === 'favorites'
                    ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
                }`}
              >
                <span className="flex items-center gap-2">
                  <StarOutlined className="text-zinc-400" />
                  <span>Favorites</span>
                </span>
                <span className="text-[11px] text-zinc-400">8</span>
              </div>

              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors">
                <span className="flex items-center gap-2">
                  <FolderOutlined className="text-zinc-400" />
                  <span>Uncategorized</span>
                </span>
                <span className="text-[11px] text-zinc-400">4</span>
              </div>

              {/* Expandable Work KB Tree */}
              <div>
                <div
                  onClick={() => setExpandedFolder(!expandedFolder)}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors"
                >
                  <span className="flex items-center gap-2 font-medium">
                    {expandedFolder ? <DownOutlined className="text-[10px] text-zinc-400" /> : <RightOutlined className="text-[10px] text-zinc-400" />}
                    <span>Work Knowledge Base</span>
                  </span>
                  <span className="text-[11px] text-zinc-400">3</span>
                </div>

                {expandedFolder && (
                  <div className="ml-4 pl-2 border-l border-zinc-200 dark:border-zinc-800 space-y-0.5 mt-0.5">
                    <div className="flex items-center justify-between px-2 py-1 rounded-md bg-blue-50/80 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-semibold cursor-pointer">
                      <span className="flex items-center gap-1.5">
                        <FolderOpenOutlined className="text-blue-500" />
                        <span>ServiceNow</span>
                      </span>
                      <span className="text-[10px]">24</span>
                    </div>

                    <div className="ml-3 space-y-0.5 text-[11px]">
                      <div
                        onClick={() => setSelectedFolder('ServiceNow / Incident')}
                        className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-blue-600 dark:text-blue-400 font-medium"
                      >
                        <span className="flex items-center gap-1.5">
                          <FolderOutlined className="text-zinc-400" />
                          <span>Incident</span>
                        </span>
                        <span className="text-zinc-400">12</span>
                      </div>

                      <div className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <FolderOutlined className="text-zinc-400" />
                          <span>Problem</span>
                        </span>
                        <span className="text-zinc-400">6</span>
                      </div>

                      <div className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400">
                        <span className="flex items-center gap-1.5">
                          <FolderOutlined className="text-zinc-400" />
                          <span>Change</span>
                        </span>
                        <span className="text-zinc-400">6</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors">
                <span className="flex items-center gap-2">
                  <FolderOutlined className="text-zinc-400" />
                  <span>Technical Docs</span>
                </span>
                <span className="text-[11px] text-zinc-400">32</span>
              </div>

              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors">
                <span className="flex items-center gap-2">
                  <FolderOutlined className="text-zinc-400" />
                  <span>Project Docs</span>
                </span>
                <span className="text-[11px] text-zinc-400">18</span>
              </div>

              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors">
                <span className="flex items-center gap-2">
                  <FolderOutlined className="text-zinc-400" />
                  <span>Personal KB</span>
                </span>
                <span className="text-[11px] text-zinc-400">16</span>
              </div>

              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60 transition-colors">
                <span className="flex items-center gap-2">
                  <FolderOutlined className="text-zinc-400" />
                  <span>Study Notes</span>
                </span>
                <span className="text-[11px] text-zinc-400">10</span>
              </div>
            </div>

            {/* Profile Card (moved below nav items) */}
            <div className="p-2 bg-white dark:bg-zinc-800/80 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 shadow-2xs flex items-center gap-3 my-3">
              <div className="relative flex-shrink-0">
                <div className="w-9 h-9 rounded-full overflow-hidden border border-zinc-200 dark:border-zinc-700">
                  <NowPilotAvatar className="w-full h-full object-cover" />
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-800" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                  G Assistant
                </div>
                <div className="text-[10px] text-zinc-400 truncate">Always here to help you</div>
              </div>
            </div>

            {/* Tags Header */}
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 px-2 py-1.5 mt-4 mb-1">
              <span>Tags</span>
            </div>

            <div className="space-y-0.5 text-xs text-zinc-700 dark:text-zinc-300">
              {[
                { name: 'ServiceNow', count: 36, color: 'text-emerald-500' },
                { name: 'Incident', count: 22, color: 'text-blue-500' },
                { name: 'Script', count: 18, color: 'text-red-500' },
                { name: 'API', count: 14, color: 'text-sky-500' },
                { name: 'Performance', count: 12, color: 'text-indigo-500' },
                { name: 'Automation', count: 10, color: 'text-cyan-500' },
              ].map(tag => (
                <div
                  key={tag.name}
                  onClick={() =>
                    setSelectedTagFilter(selectedTagFilter === tag.name ? null : tag.name)
                  }
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                    selectedTagFilter === tag.name
                      ? 'bg-blue-50 dark:bg-blue-950/60 font-semibold text-blue-600'
                      : 'hover:bg-zinc-200/60 dark:hover:bg-zinc-800/60'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <TagOutlined className={tag.color} />
                    <span>{tag.name}</span>
                  </span>
                  <span className="text-[11px] text-zinc-400">{tag.count}</span>
                </div>
              ))}
              <div className="px-2.5 py-1 text-[11px] text-zinc-400 hover:text-zinc-600 cursor-pointer">
                More tags...
              </div>
            </div>
          </div>
        </div>
      )}

        {/* PANEL 2: Note Cards Stream (Middle Column) */}
        {showListCol && (
          <div className="w-80 border-r border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col flex-shrink-0 overflow-hidden transition-all">
            {/* Header of Note List */}
            <div className="p-3.5 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between">
              <Dropdown
                menu={{
                  items: [
                    { key: 'sn_inc', label: 'ServiceNow / Incident' },
                    { key: 'sn_prob', label: 'ServiceNow / Problem' },
                    { key: 'sn_chg', label: 'ServiceNow / Change' },
                  ],
                  onClick: ({ key }) => {
                    const map: Record<string, string> = {
                      sn_inc: 'ServiceNow / Incident',
                      sn_prob: 'ServiceNow / Problem',
                      sn_chg: 'ServiceNow / Change',
                    };
                    setSelectedFolder(map[key] || selectedFolder);
                  },
                }}
              >
                <div className="flex items-center gap-1.5 font-bold text-sm text-blue-600 dark:text-blue-400 cursor-pointer">
                  <span>{selectedFolder}</span>
                  <DownOutlined className="text-xs" />
                </div>
              </Dropdown>

              <div className="flex items-center gap-1 text-zinc-400">
                <Tooltip title="Filter">
                  <button className="p-1 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer">
                    <FilterOutlined />
                  </button>
                </Tooltip>
                <Tooltip title="Sort">
                  <button className="p-1 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer">
                    <SortAscendingOutlined />
                  </button>
                </Tooltip>
                <Tooltip title="Switch View">
                  <button className="p-1 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer">
                    <AppstoreOutlined />
                  </button>
                </Tooltip>
                <Tooltip title="Collapse Note List">
                  <button
                    onClick={() => setShowListCol(false)}
                    className="p-1 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    <DoubleLeftOutlined />
                  </button>
                </Tooltip>
              </div>
            </div>

          {/* Cards List Stream */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {filteredNotes.map(note => {
              const isSelected = note.id === selectedNoteId;
              return (
                <div
                  key={note.id}
                  onClick={() => setSelectedNoteId(note.id)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 dark:border-blue-500 shadow-2xs'
                      : 'bg-white hover:bg-zinc-50 dark:bg-zinc-800/40 dark:hover:bg-zinc-800 border-zinc-200/80 dark:border-zinc-700/80'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 line-clamp-1 flex-1 m-0">
                      {note.title}
                    </h4>
                    <button
                      onClick={e => toggleFavorite(note.id, e)}
                      className="text-zinc-400 hover:text-amber-500 transition-colors flex-shrink-0"
                    >
                      {note.isFavorite ? (
                        <StarFilled className="text-amber-400 text-xs" />
                      ) : (
                        <StarOutlined className="text-xs" />
                      )}
                    </button>
                  </div>

                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed mb-2.5 m-0">
                    {note.excerpt}
                  </p>

                  <div className="flex items-center justify-between gap-1 text-[10px]">
                    <div className="flex items-center gap-1 flex-wrap max-w-[190px]">
                      {note.tags.map(t => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 rounded bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-medium"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <span className="text-zinc-400 flex-shrink-0">{note.updatedAt}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer note count */}
          <div className="px-4 py-2 border-t border-zinc-200/80 dark:border-zinc-800 text-xs text-zinc-400">
            Total {filteredNotes.length} notes
          </div>
        </div>
        )}

        {/* PANEL 3: Detailed Note Viewer/Editor + AI Meta Panel (Main Area) */}
        <div className="flex-1 flex overflow-hidden bg-[#f8f9fc] dark:bg-zinc-950 p-4 gap-4">
          {/* Main Note Canvas Panel */}
          <div className="flex-1 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col overflow-hidden">
            {/* Note Detail Header */}
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                {!showLeftCol && (
                  <Tooltip title="Expand Directory Sidebar">
                    <Button
                      size="small"
                      icon={<FolderOutlined />}
                      onClick={() => setShowLeftCol(true)}
                      className="text-xs rounded-lg border-zinc-200 dark:border-zinc-700"
                    >
                      Directory
                    </Button>
                  </Tooltip>
                )}
                {!showListCol && (
                  <Tooltip title="Expand Notes List">
                    <Button
                      size="small"
                      icon={<BarsOutlined />}
                      onClick={() => setShowListCol(true)}
                      className="text-xs rounded-lg border-zinc-200 dark:border-zinc-700"
                    >
                      Notes
                    </Button>
                  </Tooltip>
                )}
                <Title level={4} className="!mb-0 font-extrabold text-zinc-900 dark:text-zinc-100 tracking-tight">
                  {selectedNote.title}
                </Title>
                <button onClick={e => toggleFavorite(selectedNote.id, e)}>
                  {selectedNote.isFavorite ? (
                    <StarFilled className="text-amber-400 text-base" />
                  ) : (
                    <StarOutlined className="text-zinc-400 hover:text-amber-400 text-base transition-colors" />
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                {!showRightCol && (
                  <Tooltip title="Expand AI & Details Inspector">
                    <Button
                      size="small"
                      icon={<InfoCircleOutlined />}
                      onClick={() => setShowRightCol(true)}
                      className="text-xs rounded-lg border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400"
                    >
                      Inspector
                    </Button>
                  </Tooltip>
                )}
                <Button
                  icon={<EditOutlined />}
                  onClick={() => setIsEditing(!isEditing)}
                  className={`text-xs rounded-lg ${
                    isEditing ? 'bg-blue-600 text-white' : ''
                  }`}
                >
                  {isEditing ? 'Save' : 'Edit'}
                </Button>
                <Button
                  icon={<ShareAltOutlined />}
                  onClick={() => antMessage.success('Share link generated')}
                  className="text-xs rounded-lg"
                >
                  Share
                </Button>
                <Dropdown menu={moreMenuProps} trigger={['click']}>
                  <Button icon={<MoreOutlined />} className="text-xs rounded-lg" />
                </Dropdown>
              </div>
            </div>

            {/* Note Sub-meta bar */}
            <div className="px-5 py-2.5 bg-zinc-50/60 dark:bg-zinc-800/40 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full overflow-hidden border border-zinc-200">
                    <NowPilotAvatar className="w-full h-full object-cover" />
                  </div>
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">G Assistant</span>
                </div>
                <span>Created {selectedNote.createdAt}</span>
                <span>Updated {selectedNote.createdAt}</span>
              </div>

              <div className="flex items-center gap-1.5">
                {selectedNote.tags.map(t => (
                  <span
                    key={t}
                    className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 text-[11px] font-medium"
                  >
                    {t}
                  </span>
                ))}
                <button className="px-1.5 py-0.5 rounded-full border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 hover:text-zinc-600 text-[11px]">
                  +
                </button>
              </div>
            </div>

            {/* Formatting Editor Toolbar */}
            <div className="px-5 py-2 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center gap-1 text-zinc-500 overflow-x-auto text-sm">
              <span className="text-xs font-semibold px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded flex items-center gap-1 cursor-pointer">
                Body <DownOutlined className="text-[10px]" />
              </span>
              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />
              <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">
                <UndoOutlined />
              </button>
              <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">
                <RedoOutlined />
              </button>
              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />
              <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded font-bold text-zinc-600 dark:text-zinc-300">
                <BoldOutlined />
              </button>
              <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded italic text-zinc-600 dark:text-zinc-300">
                <ItalicOutlined />
              </button>

              <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">
                <CodeOutlined />
              </button>
              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700 mx-1" />
              <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">
                <UnorderedListOutlined />
              </button>
              <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">
                <OrderedListOutlined />
              </button>
              <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">
                <TableOutlined />
              </button>
              <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">
                <CheckSquareOutlined />
              </button>
              <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">
                <LinkOutlined />
              </button>
              <button className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded text-zinc-600 dark:text-zinc-300">
                <PictureOutlined />
              </button>
            </div>

            {/* Note Document Render Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              {selectedNote.content.flowchart && (
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 mb-4">
                    1. Incident State Transition Diagram
                  </h3>

                  {/* Flowchart Visual Component */}
                  <div className="p-5 bg-zinc-50/80 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200/80 dark:border-zinc-700/80 flex flex-col items-center justify-center gap-4 relative overflow-x-auto">
                    <div className="flex items-center gap-3 min-w-max py-2">
                      {/* Step 1: New */}
                      <div className="px-3.5 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-center shadow-2xs">
                        <div className="text-xs font-bold text-emerald-800 dark:text-emerald-200">New</div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400">(New)</div>
                      </div>

                      <div className="w-6 h-0.5 bg-zinc-300 dark:bg-zinc-600 relative">
                        <span className="absolute -right-1 -top-1 border-t-4 border-b-4 border-l-6 border-transparent border-l-zinc-400 dark:border-l-zinc-500" />
                      </div>

                      {/* Step 2: Assigned */}
                      <div className="px-3.5 py-2 rounded-xl bg-blue-100 dark:bg-blue-950/80 border border-blue-300 dark:border-blue-700 text-center shadow-2xs">
                        <div className="text-xs font-bold text-blue-800 dark:text-blue-200">Assigned</div>
                        <div className="text-[10px] text-blue-600 dark:text-blue-400">(Assigned)</div>
                      </div>

                      <div className="w-6 h-0.5 bg-zinc-300 dark:bg-zinc-600 relative">
                        <span className="absolute -right-1 -top-1 border-t-4 border-b-4 border-l-6 border-transparent border-l-zinc-400 dark:border-l-zinc-500" />
                      </div>

                      {/* Step 3: In Progress */}
                      <div className="px-3.5 py-2 rounded-xl bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 text-center shadow-2xs">
                        <div className="text-xs font-bold text-amber-800 dark:text-amber-200">In Progress</div>
                        <div className="text-[10px] text-amber-600 dark:text-amber-400">(In Progress)</div>
                      </div>

                      <div className="w-6 h-0.5 bg-zinc-300 dark:bg-zinc-600 relative">
                        <span className="absolute -right-1 -top-1 border-t-4 border-b-4 border-l-6 border-transparent border-l-zinc-400 dark:border-l-zinc-500" />
                      </div>

                      {/* Step 4: On Hold */}
                      <div className="px-3.5 py-2 rounded-xl bg-purple-100 dark:bg-purple-950/80 border border-purple-300 dark:border-purple-700 text-center shadow-2xs">
                        <div className="text-xs font-bold text-purple-800 dark:text-purple-200">On Hold</div>
                        <div className="text-[10px] text-purple-600 dark:text-purple-400">(On Hold)</div>
                      </div>

                      <div className="w-6 h-0.5 bg-zinc-300 dark:bg-zinc-600 relative">
                        <span className="absolute -right-1 -top-1 border-t-4 border-b-4 border-l-6 border-transparent border-l-zinc-400 dark:border-l-zinc-500" />
                      </div>

                      {/* Step 5: Resolved */}
                      <div className="px-3.5 py-2 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-700 text-center shadow-2xs">
                        <div className="text-xs font-bold text-emerald-800 dark:text-emerald-200">Resolved</div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400">(Resolved)</div>
                      </div>
                    </div>

                    {/* Step 6 Closed Box positioned below */}
                    <div className="flex justify-end w-full max-w-xl pr-2">
                      <div className="px-3.5 py-2 rounded-xl bg-rose-100 dark:bg-rose-950/80 border border-rose-300 dark:border-rose-700 text-center shadow-2xs">
                        <div className="text-xs font-bold text-rose-800 dark:text-rose-200">Closed</div>
                        <div className="text-[10px] text-rose-600 dark:text-rose-400">(Closed)</div>
                      </div>
                    </div>
                  </div>

                  {/* Notice Banner */}
                  {selectedNote.content.notice && (
                    <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                      <BulbOutlined className="text-amber-500 text-sm flex-shrink-0" />
                      <span>{selectedNote.content.notice}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Sections rendering */}
              {selectedNote.content.sections.map((sec, idx) => (
                <div key={idx} className="space-y-3">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {sec.title}
                  </h3>

                  {sec.text && (
                    <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 m-0">
                      {sec.text}
                    </p>
                  )}

                  {/* Table Data if exists */}
                  {sec.tableData && (
                    <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-zinc-100/80 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-b border-zinc-200 dark:border-zinc-700 font-semibold">
                            <th className="p-3">State</th>
                            <th className="p-3">Description</th>
                            <th className="p-3">Trigger Condition</th>
                            <th className="p-3">Common Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                          {sec.tableData.map((row, rIdx) => (
                            <tr
                              key={rIdx}
                              className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/40 text-zinc-700 dark:text-zinc-300"
                            >
                              <td className="p-3 font-semibold text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                                {row.status}
                              </td>
                              <td className="p-3">{row.desc}</td>
                              <td className="p-3">{row.trigger}</td>
                              <td className="p-3">{row.action}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}

              {/* Related Notes Section */}
              <div className="pt-6 border-t border-zinc-200/80 dark:border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 m-0">
                    Related Notes (12)
                  </h4>
                  <button className="text-xs text-blue-600 hover:underline">View All</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { title: 'Workflow Design Best Practices', date: 'Updated 2024-01-14', color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' },
                    { title: 'INC Auto-Assignment Rules', date: 'Updated 2024-01-13', color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600' },
                    { title: 'ServiceNow Script Debugging Tips', date: 'Updated 2024-01-12', color: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600' },
                  ].map((rel, i) => (
                    <div
                      key={i}
                      className="p-3 bg-zinc-50 hover:bg-white dark:bg-zinc-800/50 dark:hover:bg-zinc-800 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 transition-all cursor-pointer flex items-center gap-2.5"
                    >
                      <div className={`p-2 rounded-lg ${rel.color} flex-shrink-0 text-sm`}>
                        <FileTextOutlined />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 truncate">
                          {rel.title}
                        </div>
                        <div className="text-[10px] text-zinc-400">{rel.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right AI & Metadata Sidebar */}
          {showRightCol && (
            <div className="w-64 flex flex-col gap-4 flex-shrink-0 overflow-y-auto transition-all">
              {/* Header with collapse button */}
              <div className="flex items-center justify-between px-1 -mb-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                  Inspector
                </span>
                <Tooltip title="Collapse Inspector">
                  <button
                    onClick={() => setShowRightCol(false)}
                    className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-0.5 rounded transition-colors cursor-pointer"
                  >
                    <DoubleRightOutlined className="text-xs" />
                  </button>
                </Tooltip>
              </div>
            {/* AI Summary Card */}
            <div className="p-4 bg-gradient-to-br from-blue-50/80 to-purple-50/80 dark:from-zinc-900 dark:to-zinc-800/80 rounded-2xl border border-blue-100 dark:border-zinc-700/80 shadow-2xs">
              <div className="flex items-center gap-1.5 font-bold text-xs text-blue-700 dark:text-blue-300 mb-2">
                <span className="text-sm">🪄</span>
                <span>AI Summary</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mb-3 m-0">
                {selectedNote.content.summary}
              </p>
              <Button
                size="small"
                icon={<ReloadOutlined />}
                onClick={handleRegenerateSummary}
                className="w-full text-xs rounded-lg border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-300 hover:bg-blue-100/50"
              >
                Regenerate
              </Button>
            </div>

            {/* Note Info Panel */}
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
              <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-1.5">
                <InfoCircleOutlined className="text-zinc-400" />
                <span>Note Details</span>
              </div>

              <div className="space-y-2 text-xs text-zinc-600 dark:text-zinc-400">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Word Count</span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {selectedNote.wordCount.toLocaleString()} words
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Est. Read Time</span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {selectedNote.readTime}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Created Date</span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {selectedNote.createdAt.split(' ')[0]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Last Modified</span>
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {selectedNote.createdAt.split(' ')[0]}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Links Count</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {selectedNote.linkCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Backlinks</span>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {selectedNote.backlinkCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="p-4 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
              <div className="font-bold text-xs text-zinc-900 dark:text-zinc-100 mb-3">
                Quick Actions
              </div>

              <div className="space-y-1 text-xs">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    antMessage.success('Note link copied');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <CopyOutlined className="text-zinc-400" />
                  <span>Copy Link</span>
                </button>

                <button
                  onClick={() => antMessage.info('Exporting Markdown file...')}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <FileMarkdownOutlined className="text-zinc-400" />
                  <span>Export as Markdown</span>
                </button>

                <button
                  onClick={() => antMessage.info('Generating PDF file...')}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <FilePdfOutlined className="text-zinc-400" />
                  <span>Export as PDF</span>
                </button>

                <button
                  onClick={() => antMessage.info('Select target folder to move')}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <FolderAddOutlined className="text-zinc-400" />
                  <span>Move to...</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
};
