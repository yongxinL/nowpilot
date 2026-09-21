import React from 'react';
import {
  HighlightOutlined,
  MailOutlined,
  FileTextOutlined,
  FileDoneOutlined,
  TranslationOutlined,
  EditOutlined,
  FormOutlined,
  CheckSquareOutlined,
  QuestionCircleOutlined,
  CodeOutlined,
  CarryOutOutlined,
  CompressOutlined,
  ExpandOutlined,
  FontSizeOutlined,
  SmileOutlined,
  BulbOutlined,
  UnorderedListOutlined,
  FileAddOutlined,
  AlignLeftOutlined,
  MessageOutlined,
  ReadOutlined,
  BookOutlined,
  CalendarOutlined,
  EyeOutlined,
  PaperClipOutlined,
  BarChartOutlined,
  KeyOutlined,
  BellOutlined,
  SunOutlined,
  PlayCircleOutlined,
  PlaySquareOutlined,
  ThunderboltOutlined,
  StarOutlined,
  TagsOutlined,
  TrophyOutlined,
  SafetyOutlined,
  SearchOutlined,
  BlockOutlined,
  FileOutlined,
} from '@ant-design/icons';

/**
 * Prompt icon resolver — the single icon system is the approved AntD set
 * (UI-SPEC § Design System). Plan `01-11` replaced the banned second icon
 * library that used to back this module: the resolver keeps the same stored
 * icon **names** (so the preserved prompt fixtures and the icon picker are
 * unchanged) but every name now resolves to an `@ant-design/icons` glyph.
 */

interface PromptIconProps {
  name?: string;
  className?: string;
  size?: number;
}

export const PROMPT_ICON_NAMES = [
  'Sparkles',
  'Mail',
  'FileText',
  'FileCheck',
  'Languages',
  'Edit3',
  'Edit',
  'CheckSquare',
  'HelpCircle',
  'Code',
  'ListCheck',
  'Minimize2',
  'Maximize2',
  'Type',
  'Smile',
  'Lightbulb',
  'List',
  'FilePlus',
  'AlignLeft',
  'MessageSquare',
  'MessageCircle',
  'Newspaper',
  'BookOpen',
  'Calendar',
  'Eye',
  'Paperclip',
  'BarChart2',
  'Key',
  'Bell',
  'Sun',
  'Youtube',
  'Zap',
  'Star',
  'Bookmark',
  'Award',
  'Shield',
  'Search',
  'File',
];

export const PromptIcon: React.FC<PromptIconProps> = ({ name = 'Sparkles', className = '', size = 16 }) => {
  const iconProps = { className, style: { fontSize: size } };

  switch (name?.toLowerCase()) {
    case 'sparkles':
    case 'sparkle':
    case '✦':
      return <HighlightOutlined {...iconProps} />;
    case 'mail':
    case 'envelope':
    case 'sales email...':
      return <MailOutlined {...iconProps} />;
    case 'filetext':
    case 'document':
    case 'explain':
      return <FileTextOutlined {...iconProps} />;
    case 'filecheck':
    case 'summarize':
      return <FileDoneOutlined {...iconProps} />;
    case 'languages':
    case 'translate':
      return <TranslationOutlined {...iconProps} />;
    case 'edit3':
    case 'improve writing':
      return <EditOutlined {...iconProps} />;
    case 'edit':
    case 'continue writing':
      return <FormOutlined {...iconProps} />;
    case 'checksquare':
    case 'checkcircle':
    case 'fix spelling & grammar':
    case 'to-do list...':
      return <CheckSquareOutlined {...iconProps} />;
    case 'helpcircle':
    case 'answer this question':
      return <QuestionCircleOutlined {...iconProps} />;
    case 'code':
    case 'explain codes':
      return <CodeOutlined {...iconProps} />;
    case 'listcheck':
    case 'find action items':
      return <CarryOutOutlined {...iconProps} />;
    case 'minimize2':
    case 'make shorter':
      return <CompressOutlined {...iconProps} />;
    case 'maximize2':
    case 'make longer':
      return <ExpandOutlined {...iconProps} />;
    case 'type':
    case 'simplify language':
      return <FontSizeOutlined {...iconProps} />;
    case 'smile':
    case 'change tone':
      return <SmileOutlined {...iconProps} />;
    case 'lightbulb':
    case 'brainstorm about...':
      return <BulbOutlined {...iconProps} />;
    case 'list':
    case 'outline...':
      return <UnorderedListOutlined {...iconProps} />;
    case 'fileplus':
    case 'blog post...':
      return <FileAddOutlined {...iconProps} />;
    case 'alignleft':
    case 'paragraph about...':
      return <AlignLeftOutlined {...iconProps} />;
    case 'messagesquare':
    case 'messagecircle':
    case 'social media post...':
      return <MessageOutlined {...iconProps} />;
    case 'newspaper':
    case 'press release':
      return <ReadOutlined {...iconProps} />;
    case 'bookopen':
    case 'creative story':
      return <BookOutlined {...iconProps} />;
    case 'calendar':
    case 'meeting agenda...':
      return <CalendarOutlined {...iconProps} />;
    case 'eye':
    case 'glasses':
    case 'more persuasive':
      return <EyeOutlined {...iconProps} />;
    case 'paperclip':
    case 'add details':
      return <PaperClipOutlined {...iconProps} />;
    case 'barchart2':
    case 'add statistics':
      return <BarChartOutlined {...iconProps} />;
    case 'key':
    case 'add humor':
      return <KeyOutlined {...iconProps} />;
    case 'bell':
    case 'more apologetic':
      return <BellOutlined {...iconProps} />;
    case 'sun':
    case 'more engaging':
      return <SunOutlined {...iconProps} />;
    case 'youtube':
    case 'for youtube':
      return <PlayCircleOutlined {...iconProps} />;
    case 'playsquare':
      return <PlaySquareOutlined {...iconProps} />;
    case 'zap':
      return <ThunderboltOutlined {...iconProps} />;
    case 'star':
      return <StarOutlined {...iconProps} />;
    case 'bookmark':
      return <TagsOutlined {...iconProps} />;
    case 'award':
      return <TrophyOutlined {...iconProps} />;
    case 'shield':
      return <SafetyOutlined {...iconProps} />;
    case 'search':
      return <SearchOutlined {...iconProps} />;
    case 'layers':
      return <BlockOutlined {...iconProps} />;
    case 'file':
      return <FileOutlined {...iconProps} />;
    default:
      return <HighlightOutlined {...iconProps} />;
  }
};
