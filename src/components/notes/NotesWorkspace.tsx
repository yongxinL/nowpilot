import React, { useState } from 'react';
import { Input, Button, Tag, Tooltip, App, Dropdown, MenuProps, Typography, theme } from 'antd';

const { Title } = Typography;
const { useToken } = theme;
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
import { useExtensionStore } from '../../store/useExtensionStore';
import type { NoteItem } from '../../types';

export type { NoteItem };

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
  const { token } = useToken();
  const { notes: storeNotes, addNote, deleteNote, toggleFavoriteNote } = useExtensionStore();
  const notes = storeNotes && storeNotes.length > 0 ? storeNotes : INITIAL_NOTES;
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
    addNote(newNote);
    setSelectedNoteId(newId);
    antMessage.success('Created new note');
  };

  const toggleFavorite = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    toggleFavoriteNote(id);
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
      } else if (key === 'delete') {
        deleteNote(selectedNote.id);
        antMessage.success('Note deleted');
      } else {
        antMessage.info(`Action executed: ${key}`);
      }
    },
  };

  return (
    <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
            background: 'var(--background)',
            color: 'var(--foreground)',
            fontFamily: 'var(--font-sans)',
            overflow: 'hidden',
          }}>
      {/* Top Header Bar */}
      <div style={{
            height: 56,
            paddingLeft: 20,
            paddingRight: 20,
            borderBottomWidth: 1,
            borderBottomStyle: 'solid',
            borderBottomColor: 'var(--border)',
            borderColor: 'var(--border)',
            background: 'var(--card)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            zIndex: 10,
            gap: 16,
          }}>
        {/* Left Search Input */}
        <div style={{
            position: 'relative',
            width: 288,
            flexShrink: 0,
          }}>
          <Input
            prefix={<SearchOutlined style={{
            color: 'var(--muted-foreground)',
            marginRight: 4,
          }} />}
            placeholder="Search notes, tags, or content..."
            suffix={
              <span style={{
            fontSize: '10px',
            fontWeight: 600,
            color: 'var(--muted-foreground)',
            background: 'var(--muted)',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            borderRadius: 4,
            paddingLeft: 6,
            paddingRight: 6,
            paddingTop: 2,
            paddingBottom: 2,
          }}>
                ⌘ K
              </span>
            }
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
            borderRadius: 9999,
            background: 'var(--muted)',
            borderColor: 'var(--border)',
            fontSize: 12,
            paddingTop: 6,
            paddingBottom: 6,
          }}
          />
        </div>

        {/* Center Column Toggle Controls */}
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            background: 'var(--muted)',
            padding: 4,
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
          }}>
          <Tooltip title={showLeftCol ? "Hide Directory Sidebar" : "Show Directory Sidebar"}>
            <button
              onClick={() => setShowLeftCol(!showLeftCol)}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: showLeftCol ? 600 : 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 200ms ease',
                cursor: 'pointer',
                background: showLeftCol ? 'var(--card)' : 'transparent',
                color: showLeftCol ? token.colorInfo : token.colorTextTertiary,
                boxShadow: showLeftCol ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                border: 'none',
              }}
            >
              <FolderOutlined />
              <span>Directory</span>
            </button>
          </Tooltip>

          <Tooltip title={showListCol ? "Hide Notes Stream" : "Show Notes Stream"}>
            <button
              onClick={() => setShowListCol(!showListCol)}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: showListCol ? 600 : 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 200ms ease',
                cursor: 'pointer',
                background: showListCol ? 'var(--card)' : 'transparent',
                color: showListCol ? token.colorInfo : token.colorTextTertiary,
                boxShadow: showListCol ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                border: 'none',
              }}
            >
              <BarsOutlined />
              <span>Notes</span>
            </button>
          </Tooltip>

          <Tooltip title={showRightCol ? "Hide Inspector" : "Show Inspector"}>
            <button
              onClick={() => setShowRightCol(!showRightCol)}
              style={{
                padding: '4px 10px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: showRightCol ? 600 : 500,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 200ms ease',
                cursor: 'pointer',
                background: showRightCol ? 'var(--card)' : 'transparent',
                color: showRightCol ? token.colorInfo : token.colorTextTertiary,
                boxShadow: showRightCol ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                border: 'none',
              }}
            >
              <InfoCircleOutlined />
              <span>Inspector</span>
            </button>
          </Tooltip>
        </div>

        {/* Right Header Buttons */}
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexShrink: 0,
          }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateNewNote}
            style={{
            fontWeight: 500,
            fontSize: 12,
            borderRadius: 8,
            paddingLeft: 12,
            paddingRight: 12,
            height: 36,
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
          }}
          >
            New Note
          </Button>

          <Button
            icon={<ImportOutlined />}
            onClick={() => antMessage.info('Opened Import Dialog')}
            style={{
            fontSize: 12,
            borderRadius: 8,
            borderColor: 'var(--border)',
            background: 'var(--card)',
            color: 'var(--foreground)',
            height: 36,
            display: 'inline-flex',
            alignItems: 'center',
          }}
          >
            Import
          </Button>

          <Button
            icon={<CloudUploadOutlined />}
            onClick={() => antMessage.success('Knowledge Base Backup Complete')}
            style={{
            fontSize: 12,
            borderRadius: 8,
            borderColor: 'var(--border)',
            background: 'var(--card)',
            color: 'var(--foreground)',
            height: 36,
            display: 'inline-flex',
            alignItems: 'center',
          }}
          >
            Backup
          </Button>
        </div>
      </div>

      {/* Main 4-Panel Content Layout */}
      <div style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
          }}>
        {/* PANEL 1: Navigation / Category Tree & Tags (Left Column) */}
        {showLeftCol && (
          <div style={{
            width: 240,
            borderRightWidth: 1,
            borderRightStyle: 'solid',
            borderRightColor: 'var(--border)',
            borderColor: 'var(--border)',
            background: 'var(--sidebar)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            flexShrink: 0,
            padding: 12,
            overflowY: 'auto',
            userSelect: 'none',
            transition: 'all 200ms ease',
          }}>
            <div>
              {/* Navigation Header */}
              <div style={{
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--muted-foreground)',
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 6,
            paddingBottom: 6,
            marginBottom: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
                <span>Directory</span>
                <Tooltip title="Collapse Directory">
                  <button
                    onClick={() => setShowLeftCol(false)}
                    style={{
            color: 'var(--muted-foreground)',
            padding: 2,
            borderRadius: 4,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
          }}
                  >
                    <DoubleLeftOutlined style={{
            fontSize: 12,
          }} />
                  </button>
                </Tooltip>
              </div>

              {/* Main Category List */}
              <div style={{
                rowGap: 2,
                display: 'flex',
                flexDirection: 'column',
                fontSize: 12,
                color: 'var(--muted-foreground)',
              }}>
                <div
                  onClick={() => { setActiveCategory('all'); setSelectedTagFilter(null); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    background: activeCategory === 'all' && !selectedTagFilter ? '#eff6ff' : 'transparent',
                    color: activeCategory === 'all' && !selectedTagFilter ? '#2563eb' : 'inherit',
                    fontWeight: activeCategory === 'all' && !selectedTagFilter ? 600 : 400,
                  }}
                >
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <FileTextOutlined style={{
                      color: activeCategory === 'all' && !selectedTagFilter ? '#2563eb' : 'var(--muted-foreground)',
                    }} />
                    <span>All Notes</span>
                  </span>
                  <span style={{
                    fontSize: '11px',
                    color: activeCategory === 'all' && !selectedTagFilter ? '#2563eb' : 'var(--muted-foreground)',
                  }}>128</span>
                </div>

                <div
                  onClick={() => { setActiveCategory('recent'); setSelectedTagFilter(null); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    background: activeCategory === 'recent' ? '#eff6ff' : 'transparent',
                    color: activeCategory === 'recent' ? '#2563eb' : 'inherit',
                    fontWeight: activeCategory === 'recent' ? 600 : 400,
                  }}
                >
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <ClockCircleOutlined style={{
                      color: activeCategory === 'recent' ? '#2563eb' : 'var(--muted-foreground)',
                    }} />
                    <span>Recently Updated</span>
                  </span>
                  <span style={{
                    fontSize: '11px',
                    color: activeCategory === 'recent' ? '#2563eb' : 'var(--muted-foreground)',
                  }}>12</span>
                </div>

                <div
                  onClick={() => { setActiveCategory('favorites'); setSelectedTagFilter(null); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    background: activeCategory === 'favorites' ? '#eff6ff' : 'transparent',
                    color: activeCategory === 'favorites' ? '#2563eb' : 'inherit',
                    fontWeight: activeCategory === 'favorites' ? 600 : 400,
                  }}
                >
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <StarOutlined style={{
                      color: activeCategory === 'favorites' ? '#2563eb' : 'var(--muted-foreground)',
                    }} />
                    <span>Favorites</span>
                  </span>
                  <span style={{
                    fontSize: '11px',
                    color: activeCategory === 'favorites' ? '#2563eb' : 'var(--muted-foreground)',
                  }}>8</span>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 6,
                  paddingBottom: 6,
                  borderRadius: 8,
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                }}>
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <FolderOutlined style={{
                      color: 'var(--muted-foreground)',
                    }} />
                    <span>Uncategorized</span>
                  </span>
                  <span style={{
                    fontSize: '11px',
                    color: 'var(--muted-foreground)',
                  }}>4</span>
                </div>

                {/* Expandable Work KB Tree */}
                <div>
                  <div
                    onClick={() => setExpandedFolder(!expandedFolder)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingLeft: 10,
                      paddingRight: 10,
                      paddingTop: 6,
                      paddingBottom: 6,
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'all 150ms ease',
                    }}
                  >
                    <span style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontWeight: 500,
                    }}>
                      {expandedFolder ? (
                        <DownOutlined style={{ fontSize: '10px', color: 'var(--muted-foreground)' }} />
                      ) : (
                        <RightOutlined style={{ fontSize: '10px', color: 'var(--muted-foreground)' }} />
                      )}
                      <FolderOutlined style={{ color: 'var(--muted-foreground)' }} />
                      <span>Work Knowledge Base</span>
                    </span>
                    <span style={{
                      fontSize: '11px',
                      color: 'var(--muted-foreground)',
                    }}>3</span>
                  </div>

                  {expandedFolder && (
                    <div style={{
                      marginLeft: 16,
                      paddingLeft: 8,
                      borderLeftWidth: 1,
                      borderLeftStyle: 'solid',
                      borderLeftColor: 'var(--border)',
                      borderColor: 'var(--border)',
                      rowGap: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      marginTop: 2,
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingLeft: 8,
                        paddingRight: 8,
                        paddingTop: 4,
                        paddingBottom: 4,
                        borderRadius: 6,
                        color: '#2563eb',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}>
                        <span style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}>
                          <FolderOpenOutlined style={{ color: '#3b82f6' }} />
                          <span>ServiceNow</span>
                        </span>
                        <span style={{ fontSize: '10px' }}>24</span>
                      </div>

                      <div style={{
                        marginLeft: 12,
                        rowGap: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        fontSize: '11px',
                      }}>
                        <div
                          onClick={() => setSelectedFolder('ServiceNow / Incident')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            paddingLeft: 8,
                            paddingRight: 8,
                            paddingTop: 4,
                            paddingBottom: 4,
                            borderRadius: 4,
                            cursor: 'pointer',
                            background: '#eff6ff',
                            color: '#2563eb',
                            fontWeight: 600,
                          }}
                        >
                          <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}>
                            <FileTextOutlined style={{ color: '#3b82f6' }} />
                            <span>Incident</span>
                          </span>
                          <span style={{ color: '#2563eb' }}>12</span>
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingLeft: 8,
                          paddingRight: 8,
                          paddingTop: 4,
                          paddingBottom: 4,
                          borderRadius: 4,
                          cursor: 'pointer',
                          color: 'var(--muted-foreground)',
                        }}>
                          <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}>
                            <FileTextOutlined style={{ color: 'var(--muted-foreground)' }} />
                            <span>Problem</span>
                          </span>
                          <span style={{ color: 'var(--muted-foreground)' }}>6</span>
                        </div>

                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingLeft: 8,
                          paddingRight: 8,
                          paddingTop: 4,
                          paddingBottom: 4,
                          borderRadius: 4,
                          cursor: 'pointer',
                          color: 'var(--muted-foreground)',
                        }}>
                          <span style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}>
                            <FileTextOutlined style={{ color: 'var(--muted-foreground)' }} />
                            <span>Change</span>
                          </span>
                          <span style={{ color: 'var(--muted-foreground)' }}>6</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

              <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
          }}>
                <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
                  <FolderOutlined style={{
            color: 'var(--muted-foreground)',
          }} />
                  <span>Technical Docs</span>
                </span>
                <span style={{
            fontSize: '11px',
            color: 'var(--muted-foreground)',
          }}>32</span>
              </div>

              <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
          }}>
                <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
                  <FolderOutlined style={{
            color: 'var(--muted-foreground)',
          }} />
                  <span>Project Docs</span>
                </span>
                <span style={{
            fontSize: '11px',
            color: 'var(--muted-foreground)',
          }}>18</span>
              </div>

              <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
          }}>
                <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
                  <FolderOutlined style={{
            color: 'var(--muted-foreground)',
          }} />
                  <span>Personal KB</span>
                </span>
                <span style={{
            fontSize: '11px',
            color: 'var(--muted-foreground)',
          }}>16</span>
              </div>

              <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
          }}>
                <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
                  <FolderOutlined style={{
            color: 'var(--muted-foreground)',
          }} />
                  <span>Study Notes</span>
                </span>
                <span style={{
            fontSize: '11px',
            color: 'var(--muted-foreground)',
          }}>10</span>
              </div>
            </div>

            {/* Tags Header */}
            <div style={{
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--muted-foreground)',
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 6,
            paddingBottom: 6,
            marginTop: 16,
            marginBottom: 4,
          }}>
              <span>Tags</span>
            </div>

            <div style={{
            rowGap: 2,
            display: 'flex',
            flexDirection: 'column',
            fontSize: 12,
            color: 'var(--muted-foreground)',
          }}>
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
                    background: selectedTagFilter === tag.name ? token.colorInfoBg : 'transparent',
                    color: selectedTagFilter === tag.name ? token.colorInfo : 'inherit',
                    fontWeight: selectedTagFilter === tag.name ? 600 : 400,
                  }}
                >
                  <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
                    <TagOutlined className={tag.color} />
                    <span>{tag.name}</span>
                  </span>
                  <span style={{
            fontSize: '11px',
            color: 'var(--muted-foreground)',
          }}>{tag.count}</span>
                </div>
              ))}
              <div style={{
            paddingLeft: 10,
            paddingRight: 10,
            paddingTop: 4,
            paddingBottom: 4,
            fontSize: '11px',
            color: 'var(--muted-foreground)',
            cursor: 'pointer',
          }}>
                More tags...
              </div>
            </div>
          </div>
        </div>
      )}

        {/* PANEL 2: Note Cards Stream (Middle Column) */}
        {showListCol && (
          <div style={{
            width: 320,
            borderRightWidth: 1,
            borderRightStyle: 'solid',
            borderRightColor: 'var(--border)',
            borderColor: 'var(--border)',
            background: 'var(--card)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            overflow: 'hidden',
            transition: 'all 200ms ease',
          }}>
            {/* Header of Note List */}
            <div style={{
            padding: 14,
            borderBottomWidth: 1,
            borderBottomStyle: 'solid',
            borderBottomColor: 'var(--border)',
            borderColor: 'var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
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
                <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 700,
            fontSize: 14,
            color: '#2563eb',
            cursor: 'pointer',
          }}>
                  <span>{selectedFolder}</span>
                  <DownOutlined style={{
            fontSize: 12,
          }} />
                </div>
              </Dropdown>

              <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: 'var(--muted-foreground)',
          }}>
                <Tooltip title="Filter">
                  <button style={{
            padding: 4,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
          }}>
                    <FilterOutlined />
                  </button>
                </Tooltip>
                <Tooltip title="Sort">
                  <button style={{
            padding: 4,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
          }}>
                    <SortAscendingOutlined />
                  </button>
                </Tooltip>
                <Tooltip title="Switch View">
                  <button style={{
            padding: 4,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
          }}>
                    <AppstoreOutlined />
                  </button>
                </Tooltip>
                <Tooltip title="Collapse Note List">
                  <button
                    onClick={() => setShowListCol(false)}
                    style={{
            padding: 4,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
          }}
                  >
                    <DoubleLeftOutlined />
                  </button>
                </Tooltip>
              </div>
            </div>

          {/* Cards List Stream */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: 10,
            rowGap: 8,
            display: 'flex',
            flexDirection: 'column',
          }}>
            {filteredNotes.map(note => {
              const isSelected = note.id === selectedNoteId;
              return (
                <div
                  key={note.id}
                  onClick={() => setSelectedNoteId(note.id)}
                  style={{
                    padding: '12px 14px',
                    borderRadius: 12,
                    border: isSelected ? '1.5px solid #2563eb' : '1px solid var(--border)',
                    transition: 'all 150ms ease',
                    cursor: 'pointer',
                    position: 'relative',
                    background: isSelected ? '#ffffff' : 'var(--card)',
                    boxShadow: isSelected ? '0 1px 3px rgba(37,99,235,0.08)' : 'none',
                  }}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 8,
                    marginBottom: 4,
                  }}>
                    <h4 style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: 'var(--foreground)',
                      display: '-webkit-box',
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      flex: 1,
                      margin: 0,
                    }}>
                      {note.title}
                    </h4>
                    <button
                      onClick={e => toggleFavorite(note.id, e)}
                      style={{
                        color: 'var(--muted-foreground)',
                        transition: 'all 150ms ease',
                        flexShrink: 0,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      {note.isFavorite ? (
                        <StarFilled style={{ color: '#fbbf24', fontSize: 13 }} />
                      ) : (
                        <StarOutlined style={{ fontSize: 13, color: 'var(--muted-foreground)' }} />
                      )}
                    </button>
                  </div>

                  <p style={{
                    fontSize: '11px',
                    color: 'var(--muted-foreground)',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: 1.5,
                    marginBottom: 8,
                    margin: '0 0 8px 0',
                  }}>
                    {note.excerpt}
                  </p>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 4,
                    fontSize: '10px',
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      flexWrap: 'wrap',
                      maxWidth: 190,
                    }}>
                      {note.tags.map(t => (
                        <span
                          key={t}
                          style={{
                            paddingLeft: 6,
                            paddingRight: 6,
                            paddingTop: 2,
                            paddingBottom: 2,
                            borderRadius: 4,
                            background: '#eff6ff',
                            color: '#2563eb',
                            fontWeight: 500,
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                    <span style={{
                      color: 'var(--muted-foreground)',
                      flexShrink: 0,
                    }}>{note.updatedAt}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer note count */}
          <div style={{
            paddingLeft: 16,
            paddingRight: 16,
            paddingTop: 8,
            paddingBottom: 8,
            borderTopWidth: 1,
            borderTopStyle: 'solid',
            borderTopColor: 'var(--border)',
            borderColor: 'var(--border)',
            fontSize: 12,
            color: 'var(--muted-foreground)',
          }}>
            Total {filteredNotes.length} notes
          </div>
        </div>
        )}

        {/* PANEL 3: Detailed Note Viewer/Editor + AI Meta Panel (Main Area) */}
        <div style={{
            flex: 1,
            display: 'flex',
            overflow: 'hidden',
            background: '#f8f9fc',
            padding: 16,
            gap: 16,
          }}>
          {/* Main Note Canvas Panel */}
          <div style={{
            flex: 1,
            background: 'var(--card)',
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Note Detail Header */}
            <div style={{
            padding: 20,
            borderBottomWidth: 1,
            borderBottomStyle: 'solid',
            borderBottomColor: 'var(--border)',
            borderColor: 'var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
          }}>
              <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
          }}>
                {!showLeftCol && (
                  <Tooltip title="Expand Directory Sidebar">
                    <Button
                      size="small"
                      icon={<FolderOutlined />}
                      onClick={() => setShowLeftCol(true)}
                      style={{
            fontSize: 12,
            borderRadius: 8,
            borderColor: 'var(--border)',
          }}
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
                      style={{
            fontSize: 12,
            borderRadius: 8,
            borderColor: 'var(--border)',
          }}
                    >
                      Notes
                    </Button>
                  </Tooltip>
                )}
                <Title level={4} style={{
            marginBottom: 0,
            fontWeight: 800,
            color: 'var(--foreground)',
            letterSpacing: '-0.01em',
          }}>
                  {selectedNote.title}
                </Title>
                <Tooltip title={selectedNote.isFavorite ? 'Remove from favorites' : 'Add to favorites'}>
                  <Button
                    type="text"
                    shape="circle"
                    size="small"
                    onClick={e => toggleFavorite(selectedNote.id, e)}
                    icon={
                      selectedNote.isFavorite ? (
                        <StarFilled style={{ color: '#fbbf24', fontSize: 16 }} />
                      ) : (
                        <StarOutlined style={{ color: 'var(--muted-foreground)', fontSize: 16 }} />
                      )
                    }
                  />
                </Tooltip>
              </div>

              <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
                {!showRightCol && (
                  <Tooltip title="Expand AI & Details Inspector">
                    <Button
                      size="small"
                      icon={<InfoCircleOutlined />}
                      onClick={() => setShowRightCol(true)}
                      style={{
            fontSize: 12,
            borderRadius: 8,
            borderColor: '#bfdbfe',
            color: '#2563eb',
          }}
                    >
                      Inspector
                    </Button>
                  </Tooltip>
                )}
                <Button
                  type={isEditing ? 'primary' : 'default'}
                  icon={<EditOutlined />}
                  onClick={() => setIsEditing(!isEditing)}
                  style={{
                    fontSize: 12,
                    borderRadius: 8,
                  }}
                >
                  {isEditing ? 'Save' : 'Edit'}
                </Button>
                <Button
                  icon={<ShareAltOutlined />}
                  onClick={() => antMessage.success('Share link generated')}
                  style={{
            fontSize: 12,
            borderRadius: 8,
          }}
                >
                  Share
                </Button>
                <Dropdown menu={moreMenuProps} trigger={['click']}>
                  <Button icon={<MoreOutlined />} style={{
            fontSize: 12,
            borderRadius: 8,
          }} />
                </Dropdown>
              </div>
            </div>

            {/* Note Sub-meta bar */}
            <div style={{
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 10,
            paddingBottom: 10,
            background: 'var(--muted)',
            borderBottomWidth: 1,
            borderBottomStyle: 'solid',
            borderBottomColor: 'var(--border)',
            borderColor: 'var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 12,
            color: 'var(--muted-foreground)',
          }}>
              <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}>
                <span>Created {selectedNote.createdAt}</span>
                <span>Updated {selectedNote.createdAt}</span>
              </div>

              <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
                {selectedNote.tags.map(t => (
                  <Tag
                    key={t}
                    color="blue"
                    style={{
                      borderRadius: 12,
                      fontSize: 11,
                      margin: 0,
                    }}
                  >
                    {t}
                  </Tag>
                ))}
                <Tooltip title="Add tag">
                  <Button
                    type="dashed"
                    size="small"
                    shape="circle"
                    icon={<PlusOutlined style={{ fontSize: 10 }} />}
                    style={{
                      width: 20,
                      height: 20,
                      minWidth: 20,
                      fontSize: 10,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 0,
                    }}
                  />
                </Tooltip>
              </div>
            </div>

            {/* Formatting Editor Toolbar */}
            <div style={{
            paddingLeft: 20,
            paddingRight: 20,
            paddingTop: 6,
            paddingBottom: 6,
            borderBottomWidth: 1,
            borderBottomStyle: 'solid',
            borderBottomColor: 'var(--border)',
            borderColor: 'var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            color: 'var(--muted-foreground)',
            overflowX: 'auto',
            fontSize: 14,
          }}>
              <Button
                type="text"
                size="small"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '0 8px',
                  height: 28,
                  borderRadius: 6,
                  background: 'var(--muted)',
                }}
              >
                Body <DownOutlined style={{ fontSize: 10 }} />
              </Button>
              <div style={{
            height: 16,
            width: 1,
            background: 'var(--border)',
            marginLeft: 4,
            marginRight: 4,
          }} />
              <Tooltip title="Undo">
                <Button type="text" size="small" icon={<UndoOutlined />} style={{ width: 28, height: 28, minWidth: 28, padding: 0 }} />
              </Tooltip>
              <Tooltip title="Redo">
                <Button type="text" size="small" icon={<RedoOutlined />} style={{ width: 28, height: 28, minWidth: 28, padding: 0 }} />
              </Tooltip>
              <div style={{
            height: 16,
            width: 1,
            background: 'var(--border)',
            marginLeft: 4,
            marginRight: 4,
          }} />
              <Tooltip title="Bold">
                <Button type="text" size="small" icon={<BoldOutlined />} style={{ width: 28, height: 28, minWidth: 28, padding: 0 }} />
              </Tooltip>
              <Tooltip title="Italic">
                <Button type="text" size="small" icon={<ItalicOutlined />} style={{ width: 28, height: 28, minWidth: 28, padding: 0 }} />
              </Tooltip>
              <Tooltip title="Code">
                <Button type="text" size="small" icon={<CodeOutlined />} style={{ width: 28, height: 28, minWidth: 28, padding: 0 }} />
              </Tooltip>
              <div style={{
            height: 16,
            width: 1,
            background: 'var(--border)',
            marginLeft: 4,
            marginRight: 4,
          }} />
              <Tooltip title="Bullet List">
                <Button type="text" size="small" icon={<UnorderedListOutlined />} style={{ width: 28, height: 28, minWidth: 28, padding: 0 }} />
              </Tooltip>
              <Tooltip title="Numbered List">
                <Button type="text" size="small" icon={<OrderedListOutlined />} style={{ width: 28, height: 28, minWidth: 28, padding: 0 }} />
              </Tooltip>
              <Tooltip title="Table">
                <Button type="text" size="small" icon={<TableOutlined />} style={{ width: 28, height: 28, minWidth: 28, padding: 0 }} />
              </Tooltip>
              <Tooltip title="Task Checkbox">
                <Button type="text" size="small" icon={<CheckSquareOutlined />} style={{ width: 28, height: 28, minWidth: 28, padding: 0 }} />
              </Tooltip>
              <Tooltip title="Insert Link">
                <Button type="text" size="small" icon={<LinkOutlined />} style={{ width: 28, height: 28, minWidth: 28, padding: 0 }} />
              </Tooltip>
              <Tooltip title="Insert Image">
                <Button type="text" size="small" icon={<PictureOutlined />} style={{ width: 28, height: 28, minWidth: 28, padding: 0 }} />
              </Tooltip>
            </div>

            {/* Note Document Render Area */}
            <div style={{
            flex: 1,
            padding: 24,
            overflowY: 'auto',
            rowGap: 24,
            display: 'flex',
            flexDirection: 'column',
          }}>
              {selectedNote.content.flowchart && (
                <div>
                  <h3 style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--foreground)',
            marginBottom: 16,
          }}>
                    1. Incident State Transition Diagram
                  </h3>

                  {/* Flowchart Visual Component */}
                  <div style={{
            padding: 20,
            background: 'var(--muted)',
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 16,
            position: 'relative',
            overflowX: 'auto',
          }}>
                    <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            minWidth: 'max-content',
            paddingTop: 8,
            paddingBottom: 8,
          }}>
                      {/* Step 1: New */}
                      <div style={{
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 12,
            background: '#d1fae5',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: '#6ee7b7',
            textAlign: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
                        <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#065f46',
          }}>New</div>
                        <div style={{
            fontSize: '10px',
            color: '#059669',
          }}>(New)</div>
                      </div>

                      <div style={{
            width: 24,
            height: 2,
            background: 'var(--muted)',
            position: 'relative',
          }}>
                        <span style={{
            position: 'absolute',
            right: -4,
            top: -4,
            borderTopWidth: 4,
            borderTopStyle: 'solid',
            borderTopColor: 'var(--border)',
            borderBottomWidth: 4,
            borderBottomStyle: 'solid',
            borderBottomColor: 'var(--border)',
            borderLeftWidth: 6,
            borderLeftStyle: 'solid',
            borderLeftColor: '#a1a1aa',
            borderColor: 'transparent',
          }} />
                      </div>

                      {/* Step 2: Assigned */}
                      <div style={{
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 12,
            background: '#dbeafe',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: '#93c5fd',
            textAlign: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
                        <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#1e40af',
          }}>Assigned</div>
                        <div style={{
            fontSize: '10px',
            color: '#2563eb',
          }}>(Assigned)</div>
                      </div>

                      <div style={{
            width: 24,
            height: 2,
            background: 'var(--muted)',
            position: 'relative',
          }}>
                        <span style={{
            position: 'absolute',
            right: -4,
            top: -4,
            borderTopWidth: 4,
            borderTopStyle: 'solid',
            borderTopColor: 'var(--border)',
            borderBottomWidth: 4,
            borderBottomStyle: 'solid',
            borderBottomColor: 'var(--border)',
            borderLeftWidth: 6,
            borderLeftStyle: 'solid',
            borderLeftColor: '#a1a1aa',
            borderColor: 'transparent',
          }} />
                      </div>

                      {/* Step 3: In Progress */}
                      <div style={{
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 12,
            background: '#fef3c7',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: '#fcd34d',
            textAlign: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
                        <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#92400e',
          }}>In Progress</div>
                        <div style={{
            fontSize: '10px',
            color: '#d97706',
          }}>(In Progress)</div>
                      </div>

                      <div style={{
            width: 24,
            height: 2,
            background: 'var(--muted)',
            position: 'relative',
          }}>
                        <span style={{
            position: 'absolute',
            right: -4,
            top: -4,
            borderTopWidth: 4,
            borderTopStyle: 'solid',
            borderTopColor: 'var(--border)',
            borderBottomWidth: 4,
            borderBottomStyle: 'solid',
            borderBottomColor: 'var(--border)',
            borderLeftWidth: 6,
            borderLeftStyle: 'solid',
            borderLeftColor: '#a1a1aa',
            borderColor: 'transparent',
          }} />
                      </div>

                      {/* Step 4: On Hold */}
                      <div style={{
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 12,
            background: '#f3e8ff',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: '#d8b4fe',
            textAlign: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
                        <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#6b21a8',
          }}>On Hold</div>
                        <div style={{
            fontSize: '10px',
            color: '#9333ea',
          }}>(On Hold)</div>
                      </div>

                      <div style={{
            width: 24,
            height: 2,
            background: 'var(--muted)',
            position: 'relative',
          }}>
                        <span style={{
            position: 'absolute',
            right: -4,
            top: -4,
            borderTopWidth: 4,
            borderTopStyle: 'solid',
            borderTopColor: 'var(--border)',
            borderBottomWidth: 4,
            borderBottomStyle: 'solid',
            borderBottomColor: 'var(--border)',
            borderLeftWidth: 6,
            borderLeftStyle: 'solid',
            borderLeftColor: '#a1a1aa',
            borderColor: 'transparent',
          }} />
                      </div>

                      {/* Step 5: Resolved */}
                      <div style={{
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 12,
            background: '#d1fae5',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: '#6ee7b7',
            textAlign: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
                        <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#065f46',
          }}>Resolved</div>
                        <div style={{
            fontSize: '10px',
            color: '#059669',
          }}>(Resolved)</div>
                      </div>
                    </div>

                    {/* Step 6 Closed Box positioned below */}
                    <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            width: '100%',
            maxWidth: 576,
            paddingRight: 8,
          }}>
                      <div style={{
            paddingLeft: 14,
            paddingRight: 14,
            paddingTop: 8,
            paddingBottom: 8,
            borderRadius: 12,
            background: '#ffe4e6',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: '#fda4af',
            textAlign: 'center',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
                        <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#9f1239',
          }}>Closed</div>
                        <div style={{
            fontSize: '10px',
            color: '#e11d48',
          }}>(Closed)</div>
                      </div>
                    </div>
                  </div>

                  {/* Notice Banner */}
                  {selectedNote.content.notice && (
                    <div style={{
            marginTop: 12,
            padding: 12,
            background: '#fffbeb',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: '#fde68a',
            borderRadius: 12,
            fontSize: 12,
            color: '#92400e',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
                      <BulbOutlined style={{
            color: '#f59e0b',
            fontSize: 14,
            flexShrink: 0,
          }} />
                      <span>{selectedNote.content.notice}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Sections rendering */}
              {selectedNote.content.sections.map((sec, idx) => (
                <div key={idx} style={{
            rowGap: 12,
            display: 'flex',
            flexDirection: 'column',
          }}>
                  <h3 style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'var(--foreground)',
          }}>
                    {sec.title}
                  </h3>

                  {sec.text && (
                    <p style={{
            fontSize: 12,
            lineHeight: 1.625,
            color: 'var(--muted-foreground)',
            margin: 0,
          }}>
                      {sec.text}
                    </p>
                  )}

                  {/* Table Data if exists */}
                  {sec.tableData && (
                    <div style={{
            overflowX: 'auto',
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
          }}>
                      <table style={{
            width: '100%',
            fontSize: 12,
            textAlign: 'left',
            borderCollapse: 'collapse',
          }}>
                        <thead>
                          <tr style={{
            background: 'var(--muted)',
            color: 'var(--muted-foreground)',
            borderBottomWidth: 1,
            borderBottomStyle: 'solid',
            borderBottomColor: 'var(--border)',
            borderColor: 'var(--border)',
            fontWeight: 600,
          }}>
                            <th style={{
            padding: 12,
          }}>State</th>
                            <th style={{
            padding: 12,
          }}>Description</th>
                            <th style={{
            padding: 12,
          }}>Trigger Condition</th>
                            <th style={{
            padding: 12,
          }}>Common Actions</th>
                          </tr>
                        </thead>
                        <tbody style={{
            borderTop: '1px solid var(--border)',
          }}>
                          {sec.tableData.map((row, rIdx) => (
                            <tr
                              key={rIdx}
                              style={{
            color: 'var(--muted-foreground)',
          }}
                            >
                              <td style={{
            padding: 12,
            fontWeight: 600,
            color: 'var(--foreground)',
            whiteSpace: 'nowrap',
          }}>
                                {row.status}
                              </td>
                              <td style={{
            padding: 12,
          }}>{row.desc}</td>
                              <td style={{
            padding: 12,
          }}>{row.trigger}</td>
                              <td style={{
            padding: 12,
          }}>{row.action}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}

              {/* Related Notes Section */}
              <div style={{
            paddingTop: 24,
            borderTopWidth: 1,
            borderTopStyle: 'solid',
            borderTopColor: 'var(--border)',
            borderColor: 'var(--border)',
          }}>
                <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}>
                  <h4 style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--foreground)',
            margin: 0,
          }}>
                    Related Notes (12)
                  </h4>
                  <button style={{
            fontSize: 12,
            color: '#2563eb',
          }}>View All</button>
                </div>

                <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 12,
          }}>
                  {[
                    { title: 'Workflow Design Best Practices', date: 'Updated 2024-01-14', color: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600' },
                    { title: 'INC Auto-Assignment Rules', date: 'Updated 2024-01-13', color: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600' },
                    { title: 'ServiceNow Script Debugging Tips', date: 'Updated 2024-01-12', color: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600' },
                  ].map((rel, i) => (
                    <div
                      key={i}
                      style={{
            padding: 12,
            background: 'var(--muted)',
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            transition: 'all 200ms ease',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
                    >
                      <div
                        className={rel.color}
                        style={{
                          padding: 8,
                          borderRadius: 8,
                          flexShrink: 0,
                          fontSize: 14,
                        }}
                      >
                        <FileTextOutlined />
                      </div>
                      <div style={{
            minWidth: 0,
            flex: 1,
          }}>
                        <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--foreground)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
                          {rel.title}
                        </div>
                        <div style={{
            fontSize: '10px',
            color: 'var(--muted-foreground)',
          }}>{rel.date}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right AI & Metadata Sidebar */}
          {showRightCol && (
            <div style={{
            width: 256,
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            flexShrink: 0,
            overflowY: 'auto',
            transition: 'all 200ms ease',
          }}>
              {/* Header with collapse button */}
              <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingLeft: 4,
            paddingRight: 4,
            marginBottom: -4,
          }}>
                <span style={{
            fontSize: '11px',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--muted-foreground)',
          }}>
                  Inspector
                </span>
                <Tooltip title="Collapse Inspector">
                  <button
                    onClick={() => setShowRightCol(false)}
                    style={{
            color: 'var(--muted-foreground)',
            padding: 2,
            borderRadius: 4,
            transition: 'color 150ms ease, background 150ms ease, border-color 150ms ease',
            cursor: 'pointer',
          }}
                  >
                    <DoubleRightOutlined style={{
            fontSize: 12,
          }} />
                  </button>
                </Tooltip>
              </div>
            {/* AI Summary Card */}
            <div style={{
              padding: 16,
              background: 'var(--card)',
              borderRadius: 16,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: '#dbeafe',
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontWeight: 700,
                fontSize: 13,
                color: '#2563eb',
                marginBottom: 8,
              }}>
                <span style={{ fontSize: 14 }}>✨</span>
                <span>AI Summary</span>
              </div>
              <p style={{
                fontSize: 12,
                color: 'var(--muted-foreground)',
                lineHeight: 1.6,
                marginBottom: 12,
                margin: '0 0 12px 0',
              }}>
                {selectedNote.content.summary}
              </p>
              <Button
                size="small"
                icon={<ReloadOutlined style={{ fontSize: 11 }} />}
                onClick={handleRegenerateSummary}
                style={{
                  width: '100%',
                  fontSize: 12,
                  borderRadius: 8,
                  borderColor: '#bfdbfe',
                  color: '#2563eb',
                  background: '#ffffff',
                  fontWeight: 500,
                  height: 30,
                }}
              >
                Regenerate
              </Button>
            </div>

            {/* Note Info Panel */}
            <div style={{
            padding: 16,
            background: 'var(--card)',
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
              <div style={{
            fontWeight: 700,
            fontSize: 12,
            color: 'var(--foreground)',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
                <InfoCircleOutlined style={{
            color: 'var(--muted-foreground)',
          }} />
                <span>Note Details</span>
              </div>

              <div style={{
            rowGap: 8,
            display: 'flex',
            flexDirection: 'column',
            fontSize: 12,
            color: 'var(--muted-foreground)',
          }}>
                <div style={{
            display: 'flex',
            justifyContent: 'space-between',
          }}>
                  <span style={{
            color: 'var(--muted-foreground)',
          }}>Word Count</span>
                  <span style={{
            fontWeight: 500,
            color: 'var(--foreground)',
          }}>
                    {selectedNote.wordCount.toLocaleString()} words
                  </span>
                </div>
                <div style={{
            display: 'flex',
            justifyContent: 'space-between',
          }}>
                  <span style={{
            color: 'var(--muted-foreground)',
          }}>Est. Read Time</span>
                  <span style={{
            fontWeight: 500,
            color: 'var(--foreground)',
          }}>
                    {selectedNote.readTime}
                  </span>
                </div>
                <div style={{
            display: 'flex',
            justifyContent: 'space-between',
          }}>
                  <span style={{
            color: 'var(--muted-foreground)',
          }}>Created Date</span>
                  <span style={{
            fontWeight: 500,
            color: 'var(--foreground)',
          }}>
                    {selectedNote.createdAt.split(' ')[0]}
                  </span>
                </div>
                <div style={{
            display: 'flex',
            justifyContent: 'space-between',
          }}>
                  <span style={{
            color: 'var(--muted-foreground)',
          }}>Last Modified</span>
                  <span style={{
            fontWeight: 500,
            color: 'var(--foreground)',
          }}>
                    {selectedNote.createdAt.split(' ')[0]}
                  </span>
                </div>
                <div style={{
            display: 'flex',
            justifyContent: 'space-between',
          }}>
                  <span style={{
            color: 'var(--muted-foreground)',
          }}>Links Count</span>
                  <span style={{
            fontWeight: 500,
            color: '#2563eb',
          }}>
                    {selectedNote.linkCount}
                  </span>
                </div>
                <div style={{
            display: 'flex',
            justifyContent: 'space-between',
          }}>
                  <span style={{
            color: 'var(--muted-foreground)',
          }}>Backlinks</span>
                  <span style={{
            fontWeight: 500,
            color: '#2563eb',
          }}>
                    {selectedNote.backlinkCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div style={{
            padding: 16,
            background: 'var(--card)',
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: 'var(--border)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
          }}>
              <div style={{
            fontWeight: 700,
            fontSize: 12,
            color: 'var(--foreground)',
            marginBottom: 12,
          }}>
                Quick Actions
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}>
                <Button
                  type="text"
                  block
                  icon={<CopyOutlined style={{ color: 'var(--muted-foreground)' }} />}
                  onClick={() => {
                    navigator.clipboard.writeText(window.location.href);
                    antMessage.success('Note link copied');
                  }}
                  style={{
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    display: 'flex',
                    alignItems: 'center',
                    height: 34,
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--foreground)',
                  }}
                >
                  Copy Link
                </Button>

                <Button
                  type="text"
                  block
                  icon={<FileMarkdownOutlined style={{ color: 'var(--muted-foreground)' }} />}
                  onClick={() => antMessage.info('Exporting Markdown file...')}
                  style={{
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    display: 'flex',
                    alignItems: 'center',
                    height: 34,
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--foreground)',
                  }}
                >
                  Export as Markdown
                </Button>

                <Button
                  type="text"
                  block
                  icon={<FilePdfOutlined style={{ color: 'var(--muted-foreground)' }} />}
                  onClick={() => antMessage.info('Generating PDF file...')}
                  style={{
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    display: 'flex',
                    alignItems: 'center',
                    height: 34,
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--foreground)',
                  }}
                >
                  Export as PDF
                </Button>

                <Button
                  type="text"
                  block
                  icon={<FolderAddOutlined style={{ color: 'var(--muted-foreground)' }} />}
                  onClick={() => antMessage.info('Select target folder to move')}
                  style={{
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    display: 'flex',
                    alignItems: 'center',
                    height: 34,
                    borderRadius: 8,
                    fontSize: 12,
                    color: 'var(--foreground)',
                  }}
                >
                  Move to...
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
);
};
