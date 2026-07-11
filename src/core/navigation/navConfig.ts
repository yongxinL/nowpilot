import React from 'react';
import {
  BulbOutlined,
  CodeOutlined,
  CommentOutlined,
  ExperimentOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  HighlightOutlined,
  QuestionCircleOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { ComponentType } from 'react';
import type { NowPilotNavItem } from './navigationTypes';

export interface CorePageSpec {
  id: string;
  label: string;
  shortLabel?: string;
  icon: ComponentType;
  component: ComponentType;
  order: number;
  tooltip?: string;
  placeholder?: boolean;
}

const corePages: CorePageSpec[] = [
  { id: 'chat', label: 'Chat', icon: CommentOutlined, component: ChatPageStub, order: 1, tooltip: 'Chat with AI' },
  { id: 'agent', label: 'Agent', icon: RobotOutlined, component: AgentPageStub, order: 2, tooltip: 'Agent workflows' },
  { id: 'write', label: 'Write', icon: HighlightOutlined, component: WritePageStub, order: 3, tooltip: 'Draft and reply', placeholder: true },
  { id: 'notes', label: 'Notes', shortLabel: 'Note', icon: FileTextOutlined, component: NotesPageStub, order: 4, tooltip: 'Personal notes', placeholder: true },
  { id: 'tools', label: 'Tools', icon: ToolOutlined, component: ToolsPageStub, order: 5, tooltip: 'Workspace tools' },
  { id: 'tasks', label: 'Tasks', icon: ThunderboltOutlined, component: PlaceholderPage, order: 6, placeholder: true, tooltip: 'Tasks' },
  { id: 'teamgqm', label: 'TeamGQM', icon: TeamOutlined, component: PlaceholderPage, order: 7, placeholder: true, tooltip: 'TeamGQM' },
  { id: 'code', label: 'Code', icon: CodeOutlined, component: PlaceholderPage, order: 8, placeholder: true, tooltip: 'Code assistant' },
  { id: 'ask', label: 'Ask', icon: QuestionCircleOutlined, component: PlaceholderPage, order: 9, placeholder: true, tooltip: 'Ask questions' },
  { id: 'search', label: 'Search', icon: SearchOutlined, component: PlaceholderPage, order: 10, placeholder: true, tooltip: 'Search' },
  { id: 'chatpdf', label: 'ChatPDF', icon: FilePdfOutlined, component: PlaceholderPage, order: 11, placeholder: true, tooltip: 'Chat with PDFs' },
  { id: 'ocr', label: 'OCR', icon: ExperimentOutlined, component: PlaceholderPage, order: 12, placeholder: true, tooltip: 'OCR (image → text)' },
];

const groupOverrides: Record<string, { group: 'A' | 'B' | 'footer'; surfaces: ('sidepanel' | 'standalone')[] }> = {
  chat: { group: 'A', surfaces: ['sidepanel', 'standalone'] },
  agent: { group: 'A', surfaces: ['sidepanel', 'standalone'] },
  write: { group: 'A', surfaces: ['sidepanel', 'standalone'] },
  notes: { group: 'A', surfaces: ['standalone'] },
  tools: { group: 'A', surfaces: ['sidepanel', 'standalone'] },
  tasks: { group: 'B', surfaces: ['sidepanel', 'standalone'] },
  teamgqm: { group: 'B', surfaces: ['sidepanel', 'standalone'] },
  code: { group: 'B', surfaces: ['sidepanel', 'standalone'] },
  ask: { group: 'B', surfaces: ['sidepanel', 'standalone'] },
  search: { group: 'B', surfaces: ['sidepanel', 'standalone'] },
  chatpdf: { group: 'B', surfaces: ['sidepanel', 'standalone'] },
  ocr: { group: 'B', surfaces: ['sidepanel'] },
};

export function buildNavConfig(): NowPilotNavItem[] {
  return corePages.map<NowPilotNavItem>((page) => {
    const override = groupOverrides[page.id] ?? { group: 'B' as const, surfaces: ['sidepanel', 'standalone'] as ('sidepanel' | 'standalone')[] };
    return {
      id: page.id,
      label: page.label,
      shortLabel: page.shortLabel,
      icon: React.createElement(page.icon),
      group: override.group,
      order: page.order,
      surfaces: override.surfaces,
      routeId: page.id,
      tooltip: page.tooltip ?? page.label,
      placeholder: page.placeholder,
      showArrowInStandaloneExpanded: override.group === 'B',
    };
  });
}

export const navConfig: ReadonlyArray<NowPilotNavItem> = buildNavConfig();

export const pageComponentRegistry: Map<string, ComponentType> = new Map(
  corePages.map((page) => [page.id, page.component]),
);

function PlaceholderPage() {
  return null;
}

function ChatPageStub() {
  return null;
}

function AgentPageStub() {
  return null;
}

function WritePageStub() {
  return null;
}

function NotesPageStub() {
  return null;
}

function ToolsPageStub() {
  return null;
}
