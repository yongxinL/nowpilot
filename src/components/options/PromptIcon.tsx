import React from 'react';
import {
  Sparkles,
  Mail,
  FileText,
  FileCheck,
  Languages,
  Edit3,
  CheckSquare,
  HelpCircle,
  Code,
  ListCheck,
  Minimize2,
  Maximize2,
  Type,
  Smile,
  Lightbulb,
  List,
  FilePlus,
  AlignLeft,
  MessageSquare,
  Newspaper,
  BookOpen,
  Calendar,
  Eye,
  Paperclip,
  BarChart2,
  Key,
  Bell,
  Sun,
  Edit,
  PlaySquare,
  Zap,
  Star,
  Bookmark,
  Award,
  Shield,
  Layers,
  Search,
  MessageCircle,
  File,
  CheckCircle,
} from 'lucide-react';

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
  const iconProps = { size, className };

  switch (name?.toLowerCase()) {
    case 'sparkles':
    case 'sparkle':
    case '✦':
      return <Sparkles {...iconProps} />;
    case 'mail':
    case 'envelope':
    case 'sales email...':
      return <Mail {...iconProps} />;
    case 'filetext':
    case 'document':
    case 'explain':
      return <FileText {...iconProps} />;
    case 'filecheck':
    case 'summarize':
      return <FileCheck {...iconProps} />;
    case 'languages':
    case 'translate':
      return <Languages {...iconProps} />;
    case 'edit3':
    case 'improve writing':
      return <Edit3 {...iconProps} />;
    case 'edit':
    case 'continue writing':
      return <Edit {...iconProps} />;
    case 'checksquare':
    case 'checkcircle':
    case 'fix spelling & grammar':
    case 'to-do list...':
      return <CheckSquare {...iconProps} />;
    case 'helpcircle':
    case 'answer this question':
      return <HelpCircle {...iconProps} />;
    case 'code':
    case 'explain codes':
      return <Code {...iconProps} />;
    case 'listcheck':
    case 'find action items':
      return <ListCheck {...iconProps} />;
    case 'minimize2':
    case 'make shorter':
      return <Minimize2 {...iconProps} />;
    case 'maximize2':
    case 'make longer':
      return <Maximize2 {...iconProps} />;
    case 'type':
    case 'simplify language':
      return <Type {...iconProps} />;
    case 'smile':
    case 'change tone':
      return <Smile {...iconProps} />;
    case 'lightbulb':
    case 'brainstorm about...':
      return <Lightbulb {...iconProps} />;
    case 'list':
    case 'outline...':
      return <List {...iconProps} />;
    case 'fileplus':
    case 'blog post...':
      return <FilePlus {...iconProps} />;
    case 'alignleft':
    case 'paragraph about...':
      return <AlignLeft {...iconProps} />;
    case 'messagesquare':
    case 'messagecircle':
    case 'social media post...':
      return <MessageSquare {...iconProps} />;
    case 'newspaper':
    case 'press release':
      return <Newspaper {...iconProps} />;
    case 'bookopen':
    case 'creative story':
      return <BookOpen {...iconProps} />;
    case 'calendar':
    case 'meeting agenda...':
      return <Calendar {...iconProps} />;
    case 'eye':
    case 'glasses':
    case 'more persuasive':
      return <Eye {...iconProps} />;
    case 'paperclip':
    case 'add details':
      return <Paperclip {...iconProps} />;
    case 'barchart2':
    case 'add statistics':
      return <BarChart2 {...iconProps} />;
    case 'key':
    case 'add humor':
      return <Key {...iconProps} />;
    case 'bell':
    case 'more apologetic':
      return <Bell {...iconProps} />;
    case 'sun':
    case 'more engaging':
      return <Sun {...iconProps} />;
    case 'youtube':
    case 'for youtube':
    case 'playsquare':
      return <PlaySquare {...iconProps} />;
    case 'zap':
      return <Zap {...iconProps} />;
    case 'star':
      return <Star {...iconProps} />;
    case 'bookmark':
      return <Bookmark {...iconProps} />;
    case 'award':
      return <Award {...iconProps} />;
    case 'shield':
      return <Shield {...iconProps} />;
    case 'search':
      return <Search {...iconProps} />;
    case 'layers':
      return <Layers {...iconProps} />;
    case 'file':
      return <File {...iconProps} />;
    default:
      return <Sparkles {...iconProps} />;
  }
};
