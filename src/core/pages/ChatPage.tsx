import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Bubble, Sender, Think } from '@ant-design/x';
import { XMarkdown } from '@ant-design/x-markdown';
import {
  Alert,
  Button,
  Drawer,
  Typography,
  Select,
  Modal,
  Input,
  Checkbox,
  Dropdown,
  App,
  Tooltip,
  Spin,
  theme,
} from 'antd';
import {
  MenuOutlined,
  ClockCircleOutlined,
  FolderAddOutlined,
  ScissorOutlined,
  PlusSquareFilled,
  StarOutlined,
  StarFilled,
  MoreOutlined,
  DeleteOutlined,
  EditOutlined,
  ShareAltOutlined,
  ExclamationCircleFilled,
  DownOutlined,
  CloseOutlined,
  SearchOutlined,
  CopyOutlined,
  AudioOutlined,
  SyncOutlined,
  FileTextOutlined,
  SoundOutlined,
  SettingOutlined,
  BookOutlined,
  MessageOutlined,
  CheckSquareOutlined,
  TranslationOutlined,
  LineHeightOutlined,
  SmileOutlined,
  UnorderedListOutlined,
  BulbOutlined,
  FontColorsOutlined,
  FormOutlined,
  MailOutlined,
  CalendarOutlined,
  GlobalOutlined,
  HighlightOutlined,
  CommentOutlined,
  ThunderboltOutlined,
  PushpinOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import { useChat } from '../../hooks/useChat';
import { useWorkspaceStore } from '../../core/stores/workspaceStore';
import type { PageContext, TabContext } from '../../core/content/PageContext';
import { useProviderStore } from '../../core/stores/providerStore';
import { providerRegistry } from '../../core/ai/providers/ProviderRegistry';
import { slashCommandRegistry } from '../../core/slash/SlashCommandRegistry';
import { promptManager } from '../../core/prompts/PromptManager';
import { templateEngine } from '../../core/prompts/TemplateEngine';
import type { PromptTemplate } from '../../core/prompts/PromptManager';
// Unused ConversationSidebar removed for standalone drawer integration
import { SaveToNoteDialog } from '../../components/notes/SaveToNoteDialog';
import { PinTabBar } from '../../components/sidepanel/PinTabBar';
import { WorkspaceStatusBar } from '../../components/common/WorkspaceStatusBar';
import { WelcomeCards } from '../../components/chat/WelcomeCards';
import { BrandedHeader } from '../../components/chat/BrandedHeader';
import { InlineConfirmationCard } from '../../components/chat/InlineConfirmationCard';
import { ConversationClosure } from '../../components/chat/ConversationClosure';
import { QuickActionChips } from '../../components/chat/QuickActionChips';
import { ClarificationAction } from '../../components/chat/ClarificationAction';
import { FollowUpAction } from '../../components/chat/FollowUpAction';
import { StageIndicator } from '../../components/chat/StageIndicator';
import { CodeBlockActions } from '../../components/chat/CodeBlockActions';
import type { FollowUpSuggestion } from '../../core/ai/followUp/FollowUpService';
import { useGreeting } from '../../hooks/useGreeting';
import { useConversationClosure } from '../../hooks/useConversationClosure';
import { BunnyAvatar } from '../../components/common/BunnyAvatar';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  message: MessageOutlined,
  fileText: FileTextOutlined,
  edit: EditOutlined,
  checkSquare: CheckSquareOutlined,
  translation: TranslationOutlined,
  lineHeight: LineHeightOutlined,
  smile: SmileOutlined,
  unorderedList: UnorderedListOutlined,
  bulb: BulbOutlined,
  book: BookOutlined,
  fontColors: FontColorsOutlined,
  form: FormOutlined,
  mail: MailOutlined,
  calendar: CalendarOutlined,
  global: GlobalOutlined,
  highlight: HighlightOutlined,
  comment: CommentOutlined,
  thunderbolt: ThunderboltOutlined,
  star: StarOutlined,
  setting: SettingOutlined,
};

const renderPromptIcon = (name?: string, style?: React.CSSProperties) => {
  const IconComponent = ICON_MAP[name || 'fileText'] || FileTextOutlined;
  return <IconComponent style={style} />;
};

const getPromptSelectionText = (template: string) => {
  if (template.includes('{{userInput}}')) {
    return template.replace('{{userInput}}', '');
  }
  return template.replace(/\{\{(\w+)\}\}/g, '');
};

const { Text } = Typography;

const QuoteIcon = (props?: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 60 60" style={{ display: 'inline-block', verticalAlign: 'middle', ...props?.style }} {...props}>
    <path fill="currentColor" d="M46.967 32.397c-.926-.076-2.054-.076-3.378-.076h-.178c-1.324 0-2.452 0-3.378.076-.777.063-1.536.187-2.272.469.098-6.499.82-10.02 2.175-12.433 1.437-2.555 3.746-4.177 8.038-6.727a2.25 2.25 0 0 0-2.298-3.869c-4.208 2.5-7.561 4.654-9.662 8.392-2.076 3.692-2.764 8.614-2.764 16.218v8.213c0 1.324 0 2.452.076 3.378.08.973.253 1.92.714 2.825a7.25 7.25 0 0 0 3.169 3.168c.904.461 1.85.635 2.824.715.926.075 2.054.075 3.378.075h.178c1.324 0 2.452 0 3.378-.075.973-.08 1.92-.254 2.824-.715a7.25 7.25 0 0 0 3.169-3.168c.46-.905.635-1.852.714-2.825.076-.926.076-2.054.076-3.378v-.177c0-1.325 0-2.453-.076-3.38-.08-.972-.253-1.919-.714-2.823a7.25 7.25 0 0 0-3.169-3.169c-.904-.46-1.85-.635-2.824-.714m-25.999 0c-.926-.076-2.054-.076-3.378-.076h-.177c-1.325 0-2.453 0-3.38.076-.776.063-1.535.187-2.27.469.097-6.499.818-10.02 2.174-12.433 1.437-2.555 3.746-4.177 8.038-6.727a2.25 2.25 0 0 0-2.298-3.869c-4.208 2.5-7.561 4.654-9.662 8.392C7.939 21.92 7.25 26.843 7.25 34.447v8.213c0 1.324 0 2.452.076 3.378.08.973.253 1.92.714 2.825a7.25 7.25 0 0 0 3.168 3.168c.905.461 1.852.635 2.825.715.926.075 2.054.075 3.378.075h.178c1.324 0 2.452 0 3.378-.075.973-.08 1.92-.254 2.824-.715a7.25 7.25 0 0 0 3.169-3.168c.46-.905.635-1.852.714-2.825.076-.926.076-2.054.076-3.378v-.177c0-1.325 0-2.453-.076-3.38-.08-.972-.253-1.919-.714-2.823a7.25 7.25 0 0 0-3.169-3.169c-.904-.46-1.85-.635-2.824-.714z" />
  </svg>
);

const CopyIcon = (props?: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 16 16" style={{ display: 'inline-block', verticalAlign: 'middle', ...props?.style }} {...props}>
    <path fill="currentColor" fillRule="evenodd" d="M7.386 1H5.414c-.65 0-1.174 0-1.6.035-.436.035-.82.11-1.176.292a3 3 0 0 0-1.311 1.311c-.181.355-.257.74-.292 1.177C1 4.24 1 4.764 1 5.415v1.97c0 .65 0 1.175.035 1.6.035.437.11.822.292 1.177a3 3 0 0 0 1.311 1.311c.355.181.74.257 1.177.292q.18.015.385.022V12a3 3 0 0 0 3 3h3.386c.65 0 1.175 0 1.6-.035.437-.035.82-.11 1.176-.292a3 3 0 0 0 1.311-1.311c.181-.355.257-.74.292-1.177.035-.425.035-.949.035-1.6V7.2a3 3 0 0 0-3-3h-.213a9 9 0 0 0-.022-.385c-.035-.437-.11-.822-.292-1.177a3 3 0 0 0-1.311-1.311c-.355-.181-.74-.257-1.177-.292C8.56 1 8.036 1 7.385 1zM11.8 5.4v1.986c0 .65 0 1.174-.035 1.6-.035.436-.11.82-.292 1.176a3 3 0 0 1-1.311 1.311c-.355.181-.74.257-1.177.292-.425.035-.949.035-1.6.035H5.4v.2a1.8 1.8 0 0 0 1.8 1.8h3.36c.682 0 1.157 0 1.527-.03.364-.03.572-.086.73-.166a1.8 1.8 0 0 0 .787-.787c.08-.158.136-.366.165-.73.03-.37.031-.845.031-1.527V7.2A1.8 1.8 0 0 0 12 5.4zM3.183 2.396c.158-.08.366-.136.73-.165.37-.03.845-.031 1.527-.031h1.92c.682 0 1.157 0 1.527.03.364.03.572.086.73.166a1.8 1.8 0 0 1 .787.787c.08.158.136.366.165.73.03.37.031.845.031 1.527v1.92c0 .682 0 1.157-.03 1.527-.03.364-.086.572-.166.73a1.8 1.8 0 0 1-.787.787c-.158.08-.366.136-.73.165-.37.03-.845.031-1.527.031H5.44c-.682 0-1.157 0-1.527-.03-.364-.03-.572-.086-.73-.166a1.8 1.8 0 0 1-.787-.787c-.08-.158-.136-.366-.165-.73-.03-.37-.031-.845-.031-1.527V5.44c0-.682 0-1.157.03-1.527.03-.364.086-.572.166-.73a1.8 1.8 0 0 1 .787-.787" clip-rule="evenodd" />
  </svg>
);

const SaveNoteIcon = (props?: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 14 14" style={{ display: 'inline-block', verticalAlign: 'middle', ...props?.style }} {...props}>
    <path fill="currentColor" fillRule="evenodd" d="M10.675 4.2a.525.525 0 0 0 1.05 0V3.092h1.108a.525.525 0 1 0 0-1.05h-1.108V.933a.525.525 0 1 0-1.05 0v1.109H9.567a.525.525 0 1 0 0 1.05h1.108zM4.783 1.108H4.74c-.283 0-.482 0-.658.026A2.39 2.39 0 0 0 2.068 3.15c-.026.175-.026.374-.026.657v.044a.525.525 0 1 0 1.05 0c0-.344.001-.459.014-.547a1.34 1.34 0 0 1 1.13-1.13c.089-.013.203-.015.547-.015h2.573a.525.525 0 1 0 0-1.05H4.783Zm7.409 5.425a.525.525 0 0 0-1.05 0v3.314c0 .53 0 .898-.024 1.183-.023.279-.065.432-.123.546a1.34 1.34 0 0 1-.586.586c-.113.058-.267.1-.546.122-.285.024-.652.024-1.183.024H4.783c-.344 0-.458-.001-.547-.014a1.34 1.34 0 0 1-1.13-1.13c-.013-.089-.014-.204-.014-.547a.525.525 0 0 0-1.05 0v.043c0 .283 0 .482.026.658a2.39 2.39 0 0 0 2.014 2.014c.176.026.375.026.658.026h3.962c.504 0 .914 0 1.247-.027.344-.028.65-.088.937-.233.45-.23.816-.596 1.045-1.046.146-.286.205-.593.234-.937.027-.332.027-.742.027-1.246zM1.108 6.067c0-.29.235-.525.525-.525H3.5a.525.525 0 1 1 0 1.05H1.633a.525.525 0 0 1-.525-.525m.525 1.808a.525.525 0 1 0 0 1.05H3.5a.525.525 0 1 0 0-1.05z" clip-rule="evenodd" />
  </svg>
);

const RegenerateIcon = (props?: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 16 16" style={{ display: 'inline-block', verticalAlign: 'middle', ...props?.style }} {...props}>
    <path fill="currentColor" d="M8.433.88a.6.6 0 0 1 .846.058L11.2 3.145a.598.598 0 0 1-.102.892L8.86 5.67a.6.6 0 1 1-.707-.969l1.17-.854A6 6 0 0 0 8 3.7a5.18 5.18 0 0 0-5.18 5.18 5.18 5.18 0 0 1 10.36.007.6.6 0 1 1 1.2 0A6.38 6.38 0 1 1 1.62 8.88 6.38 6.38 0 0 1 8 2.5q.59.002 1.124.089l-.75-.862A.6.6 0 0 1 8.433.88" />
  </svg>
);

const ShareIcon = (props?: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 14 14" style={{ display: 'inline-block', verticalAlign: 'middle', ...props?.style }} {...props}>
    <path fill="currentColor" fillRule="evenodd" d="M7.642 3.033a2.392 2.392 0 1 1 .443 1.387l-2.85 1.645a2.38 2.38 0 0 1 0 1.87l2.85 1.645a2.392 2.392 0 1 1-.408.977L4.619 8.79a2.392 2.392 0 1 1 0-3.582l3.058-1.766a2.4 2.4 0 0 1-.035-.41zm2.391-1.341a1.342 1.342 0 1 0 0 2.683 1.342 1.342 0 0 0 0-2.683M1.692 7a1.342 1.342 0 1 1 2.683 0 1.342 1.342 0 0 1-2.683 0m7 3.967a1.342 1.342 0 1 1 2.683 0 1.342 1.342 0 0 1-2.683 0" clip-rule="evenodd" />
  </svg>
);

const ReadAloudIcon = (props?: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 14 14" className="speaker-icon shrink-0" style={{ display: 'inline-block', verticalAlign: 'middle', ...props?.style }} {...props}>
    <path fill="currentColor" fillRule="evenodd" d="M8.484 1.672a1.93 1.93 0 0 0-1.56-.698c-.421.017-.805.242-1.177.519-.378.28-.836.69-1.41 1.205l-.508.454-.049.043-.014.013h-.381c-.373 0-.686 0-.94.021a2 2 0 0 0-.752.19 1.93 1.93 0 0 0-.841.84c-.12.236-.168.486-.19.752-.02.255-.02.567-.02.941v2.096c0 .374 0 .686.02.941.022.266.07.516.19.752.184.362.479.656.84.84.237.121.487.168.752.19.255.02.568.02.941.02h.296l.085.001.014.013.05.043.507.454c.574.514 1.032.924 1.41 1.206.372.276.756.5 1.177.518.6.024 1.178-.235 1.56-.698.269-.325.357-.761.399-1.223.042-.469.042-1.083.042-1.854V4.749c0-.77 0-1.385-.042-1.854-.042-.462-.13-.898-.399-1.223m-1.519.352a.88.88 0 0 1 .71.317c.052.063.123.218.162.648.038.416.038.983.038 1.788v4.446c0 .805 0 1.372-.038 1.788-.038.43-.11.585-.162.648a.88.88 0 0 1-.71.317c-.082-.003-.245-.053-.59-.31-.336-.25-.759-.628-1.359-1.165l-.487-.435-.016-.015a1.4 1.4 0 0 0-.24-.183 1 1 0 0 0-.27-.103 1.4 1.4 0 0 0-.3-.023h-.295c-.401 0-.67 0-.877-.018-.201-.016-.297-.045-.36-.078a.9.9 0 0 1-.383-.382c-.032-.063-.062-.16-.078-.36a12 12 0 0 1-.017-.877V5.973c0-.4 0-.67.017-.876.016-.201.046-.298.078-.36a.9.9 0 0 1 .382-.383c.064-.033.16-.062.361-.078.207-.017.476-.018.877-.018h.296c.08 0 .19.001.3-.023a1 1 0 0 0 .27-.103 1.3 1.3 0 0 0 .239-.183l.016-.015.487-.435c.6-.537 1.023-.915 1.358-1.164.346-.258.51-.308.591-.311" clip-rule="evenodd" />
    <path fill="currentColor" d="M9.759 3.986a.525.525 0 0 1 .722.173c1.036 1.689 1.036 3.993 0 5.682a.525.525 0 0 1-.895-.549c.83-1.352.83-3.232 0-4.584a.525.525 0 0 1 .173-.722" className="wave1" />
    <path fill="currentColor" d="M11.388 2.355a.525.525 0 0 1 .724.167c1.662 2.658 1.662 6.298 0 8.956a.525.525 0 1 1-.89-.556c1.449-2.318 1.449-5.526 0-7.844a.525.525 0 0 1 .166-.723" className="wave2" />
  </svg>
);

const ThinkingIcon = (props?: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 12 12" style={{ display: 'inline-block', verticalAlign: 'middle', ...props?.style }} {...props}>
    <g fill="currentColor" fillRule="evenodd" clipRule="evenodd">
      <path d="M6 1.45a4.15 4.15 0 0 0-2.832 7.185c.209.2.357.343.436.448.084.111.12.17.179.297.056.12.097.263.15.45l.01.035.04.141a.75.75 0 0 0 .721.544h2.59a.75.75 0 0 0 .721-.544l.04-.141.01-.036c.054-.186.095-.33.15-.449.06-.126.095-.186.18-.297a5 5 0 0 1 .48-.491A4.15 4.15 0 0 0 6 1.45M.95 5.6A5.05 5.05 0 1 1 9.5 9.24a7 7 0 0 0-.388.385l-.045.065-.036.07a3 3 0 0 0-.11.352l-.04.141a1.65 1.65 0 0 1-1.587 1.197h-2.59a1.65 1.65 0 0 1-1.586-1.197l-.04-.141a3 3 0 0 0-.11-.352l-.036-.07-.046-.065a6 6 0 0 0-.387-.385A5.04 5.04 0 0 1 .95 5.6" />
      <path d="M5.9 3.45A2.05 2.05 0 0 0 3.85 5.5a.45.45 0 1 1-.9 0A2.95 2.95 0 0 1 5.9 2.55a.45.45 0 1 1 0 .9" />
    </g>
  </svg>
);

const getModelInfo = (modelId: string) => {
  return { label: modelId, provider: 'AI', desc: 'Configured API provider', icon: '⚙️' };
};

// Helper to group conversations by updated time
const getGroupLabel = (timestamp: number): string => {
  const now = new Date();
  const date = new Date(timestamp);
  
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0 && now.getDate() === date.getDate()) {
    return 'Today';
  }
  if (diffDays < 7) {
    return 'This Week';
  }
  if (now.getMonth() === date.getMonth() && now.getFullYear() === date.getFullYear()) {
    return 'This Month';
  }
  
  const prevMonth = new Date();
  prevMonth.setMonth(now.getMonth() - 1);
  if (prevMonth.getMonth() === date.getMonth() && prevMonth.getFullYear() === date.getFullYear()) {
    return 'Previous Month';
  }
  
  return 'Older';
};

export function ChatPage() {
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const {
    messages,
    bubbleItems,
    send,
    abort,
    isStreaming,
    error,
    conversations,
    activeConversationId,
    switchConversation,
    deleteConversation,
    toggleStarConversation,
    updateConversationTitle,
    deleteAllConversations,
    newConversation,
    draft,
    setDraft,
    editMessage,
    regenerateResponse,
    followUpSuggestions,
  } = useChat();

  const greeting = useGreeting();
  const closureState = useConversationClosure(
    messages.length,
    isStreaming,
    false, // hasActiveClarifications — simplified for now
  );

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [quotedMessage, setQuotedMessage] = useState<any | null>(null);
  const [savingNoteContent, setSavingNoteContent] = useState<string | null>(null);
  const [activeReadAloudId, setActiveReadAloudId] = useState<string | null>(null);
  const [welcomeCardsDismissed, setWelcomeCardsDismissed] = useState(false);
  const [conversationLoading, setConversationLoading] = useState(false);

  const [hoveredMessageId, setHoveredMessageId] = useState<string | null>(null);
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);

  const loadPrompts = async () => {
    const all = await promptManager.getAllTemplates();
    setPrompts(all.filter((p) => !p.hidden));
  };

  useEffect(() => {
    loadPrompts();

    const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName === 'local' && changes['np_prompt_templates']) {
        loadPrompts();
      }
    };
    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, []);

  // Read WelcomeCards dismissal state on mount
  useEffect(() => {
    chrome.storage.local.get('np_welcome_cards_dismissed').then((result) => {
      if (result.np_welcome_cards_dismissed) setWelcomeCardsDismissed(true);
    }).catch(() => {});
  }, []);

  // Wrap switchConversation with conversationLoading guard (Pitfall 3 prevention)
  const switchConvWithLoading = useCallback(async (convId: string) => {
    setConversationLoading(true);
    try {
      await switchConversation(convId);
    } finally {
      setConversationLoading(false);
    }
  }, [switchConversation]);

  // Parse draft to detect slash command state
  const slashState = useMemo(() => {
    if (!draft) return { active: false, step: 'commands' as const, query: '' };
    
    // Find the last slash in the input
    const lastSlashIndex = draft.lastIndexOf('/');
    if (lastSlashIndex === -1) return { active: false, step: 'commands' as const, query: '' };
    
    // Verify slash is at the start or preceded by a space
    const isPrecededBySpace = lastSlashIndex === 0 || draft[lastSlashIndex - 1] === ' ';
    if (!isPrecededBySpace) return { active: false, step: 'commands' as const, query: '' };
    
    const sliceAfterSlash = draft.slice(lastSlashIndex + 1);
    
    // Check if there is a space after the slash. If so, check if it's "/translate " or "/translate into "
    if (sliceAfterSlash.includes(' ')) {
      const parts = sliceAfterSlash.split(' ');
      if (parts[0] === 'translate' && parts.length <= 2) {
        // Show languages step!
        const query = parts[1] || '';
        return { active: true, step: 'languages' as const, query, slashIndex: lastSlashIndex };
      }
      return { active: false, step: 'commands' as const, query: '' };
    }
    
    if (sliceAfterSlash === 'translate') {
      return { active: true, step: 'languages' as const, query: '', slashIndex: lastSlashIndex };
    }
    
    return { active: true, step: 'commands' as const, query: sliceAfterSlash, slashIndex: lastSlashIndex };
  }, [draft]);

  const filteredPrompts = useMemo(() => {
    if (slashState.step !== 'commands') return [];
    const q = slashState.query.toLowerCase();
    return prompts.filter(p => p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q)));
  }, [slashState.step, slashState.query, prompts]);

  const filteredLanguages = useMemo(() => {
    if (slashState.step !== 'languages') return [];
    const q = slashState.query.toLowerCase();
    return [
      { label: 'English', native: 'English', flag: '🇺🇸' },
      { label: 'Chinese', native: '中文', flag: '🇨🇳' },
      { label: 'Japanese', native: '日本語', flag: '🇯🇵' },
      { label: 'Spanish', native: 'Español', flag: '🇪🇸' },
      { label: 'French', native: 'Français', flag: '🇫🇷' },
      { label: 'German', native: 'Deutsch', flag: '🇩🇪' },
      { label: 'Korean', native: '한국어', flag: '🇰🇷' },
    ].filter(lang => lang.label.toLowerCase().includes(q) || lang.native.toLowerCase().includes(q));
  }, [slashState.step, slashState.query]);

  const totalFilteredCount = slashState.step === 'commands' ? filteredPrompts.length : filteredLanguages.length;

  useEffect(() => {
    setSlashSelectedIndex(0);
  }, [totalFilteredCount]);

  const handleSelectSlashItem = () => {
    const lastSlash = draft.lastIndexOf('/');
    if (lastSlash === -1) return;

    if (slashState.step === 'commands') {
      const selected = filteredPrompts[slashSelectedIndex];
      if (!selected) return;

      const promptText = getPromptSelectionText(selected.template);
      setDraft(draft.slice(0, lastSlash) + promptText);
    } else {
      const selected = filteredLanguages[slashSelectedIndex];
      if (!selected) return;

      setDraft(draft.slice(0, lastSlash) + `/translate into ${selected.label} `);
    }
  };

  const surface = useWorkspaceStore((s) => s.activeSurface);
  const currentPageContext = useWorkspaceStore((s) => s.currentPageContext);
  const pinnedTabs = useWorkspaceStore((s) => s.pinnedTabs);
  const activeModel = useWorkspaceStore((s) => s.activeModel);
  const setActiveModel = useWorkspaceStore((s) => s.setActiveModel);
  const setActiveProvider = useWorkspaceStore((s) => s.setActiveProvider);
  const setInputTokens = useWorkspaceStore((s) => s.setInputTokens);
  const setSessionTokens = useWorkspaceStore((s) => s.setSessionTokens);

  const modelEntries = useProviderStore((s) => s.modelEntries) || [];
  
  const isStandalone = surface === 'standalone';

  // State for Drawer and Modals
  const [chatHistoryOpen, setChatHistoryOpen] = useState(false);
  const [historyTab, setHistoryTab] = useState<'all' | 'starred'>('all');
  const [historySearch, setHistorySearch] = useState('');

  // Modals
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingConv, setDeletingConv] = useState<any>(null);

  const [deleteAllModalOpen, setDeleteAllModalOpen] = useState(false);
  const [includeStarred, setIncludeStarred] = useState(false);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingConv, setEditingConv] = useState<any>(null);
  const [newTitle, setNewTitle] = useState('');

  // Export Mode State
  const [isExportMode, setIsExportMode] = useState(false);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());

  // File attach ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File attachments state (multi-file support)
  const [attachedFiles, setAttachedFiles] = useState<{ id: string; name: string; url: string; type: string; file: File }[]>([]);

  // Helper to safely set attachments and manage Object URLs (prevent memory leak)
  const clearAttachedFiles = () => {
    attachedFiles.forEach((f) => {
      if (f.url) URL.revokeObjectURL(f.url);
    });
    setAttachedFiles([]);
  };

  const removeAttachedFile = (id: string) => {
    setAttachedFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target?.url) {
        URL.revokeObjectURL(target.url);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  // State for Pinned Context Drawer
  const [pinnedContextOpen, setPinnedContextOpen] = useState(false);
  const [availableTabs, setAvailableTabs] = useState<any[]>([]);
  const [tabSearchQuery, setTabSearchQuery] = useState('');

  const loadAvailableTabs = () => {
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ currentWindow: true }, (tabs) => {
        const filtered = (tabs || []).filter(
          (t) => t.url && !t.url.startsWith('chrome-extension://') && !t.url.startsWith('chrome://')
        );
        setAvailableTabs(filtered);
      });
    }
  };

  const handlePinTab = (tab: any) => {
    if (!tab.id) return;
    const store = useWorkspaceStore.getState();
    const isAlreadyPinned = store.pinnedTabs.some((t) => t.tabId === tab.id);
    if (isAlreadyPinned) {
      message.warning('Tab is already pinned.');
      return;
    }
    if (store.pinnedTabs.length >= 10) {
      message.error('Maximum 10 pinned tabs reached. Unpin a tab before pinning a new one.');
      return;
    }

    // D-31: prefer this tab's own cached extraction over a live request —
    // the per-tab cache is keyed by tabId, so it can't return another tab's
    // content the way the single-slot currentPageContext global used to.
    const cachedForTab = store.pageContextByTab[tab.id]?.page;

    const finishPin = (pageContext: PageContext) => {
      const tabContext: TabContext = {
        tabId: tab.id!,
        windowId: tab.windowId,
        page: pageContext,
        pinnedAt: Date.now(),
        active: true,
        url: tab.url,
        title: tab.title,
      };

      store.addPinnedTab(tabContext);
      message.success(`Pinned tab: ${tab.title || 'Tab'}`);
      // Refresh available tabs list
      loadAvailableTabs();
    };

    if (cachedForTab) {
      finishPin(cachedForTab);
      return;
    }

    chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT_REQUEST' }, (response) => {
      let extractedPage = null;
      if (response && response.success && response.page) {
        extractedPage = response.page;
      }

      finishPin(
        extractedPage || {
          url: tab.url || '',
          origin: '',
          hostname: '',
          title: tab.title || '',
          meta: {},
          extractedAt: Date.now(),
          extractionType: 'metadata-only' as const,
          extractionQuality: 'minimal' as const,
        },
      );
    });
  };

  const handleUnpinTab = (tabId: number) => {
    const store = useWorkspaceStore.getState();
    store.removePinnedTab(tabId);
    message.success('Unpinned tab.');
    loadAvailableTabs();
  };

  // Automatically pin the current active tab where side panel is opened
  useEffect(() => {
    if (isStandalone) return;
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, async ([tab]) => {
        if (tab?.id) {
          const store = useWorkspaceStore.getState();
          const isAlreadyPinned = store.pinnedTabs.some((t) => t.tabId === tab.id);
          if (!isAlreadyPinned) {
            const finishAutoPin = (currentPage: PageContext) => {
              const tabContext: TabContext = {
                tabId: tab.id!,
                windowId: tab.windowId,
                page: currentPage,
                pinnedAt: Date.now(),
                active: true,
                url: tab.url,
                title: tab.title,
              };

              store.addPinnedTab(tabContext);
            };

            // D-31: this tab's own cached extraction, not the single-slot
            // currentPageContext global (which reflects whichever tab last
            // pushed an update, not necessarily this one).
            const cachedForTab = store.pageContextByTab[tab.id]?.page;
            if (cachedForTab) {
              finishAutoPin(cachedForTab);
            } else {
              chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT_REQUEST' }, (response) => {
                let extractedPage = null;
                if (response && response.success && response.page) {
                  extractedPage = response.page;
                }

                finishAutoPin(
                  extractedPage || {
                    url: tab.url || '',
                    origin: '',
                    hostname: '',
                    title: tab.title || '',
                    meta: {},
                    extractedAt: Date.now(),
                    extractionType: 'metadata-only' as const,
                    extractionQuality: 'minimal' as const,
                  },
                );
              });
            }
          }
        }
      });
    }
  }, [isStandalone]);

  // Eagerly populate model entries from provider configs if empty (bypasses encrypted store)
  useEffect(() => {
    if (modelEntries.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        await providerRegistry.initialize(true);
        if (cancelled) return;
        // Sync discovered models to store
        const discoveredModels = providerRegistry.listModels();
        if (discoveredModels.length > 0) {
          useProviderStore.getState().setModelEntries(discoveredModels);
          return;
        }
        // Direct fallback: read from plain-text per-provider configs directly
        const allConfigsResult = await chrome.storage.local.get('np_provider_configs');
        const configs = allConfigsResult.np_provider_configs as Array<{ id?: string; name?: string; enabled?: boolean }> | undefined;
        if (!Array.isArray(configs)) return;
        const result: Array<{ providerId: string; modelId: string; costTier: string; contextWindow: number; modalities: { text: boolean; image: boolean; toolUse: boolean; structuredOutput: boolean } }> = [];
        for (const cfg of configs) {
          if (!cfg.enabled) continue;
          const pId = (cfg.id || cfg.name || '').toLowerCase();
          const ppKey = `np_provider_config_${pId}`;
          const ppResult = await chrome.storage.local.get(ppKey);
          const ppConfig = ppResult[ppKey] as { enabledModels?: string[] } | undefined;
          if (ppConfig?.enabledModels && Array.isArray(ppConfig.enabledModels)) {
            for (const mId of ppConfig.enabledModels) {
              result.push({ providerId: pId, modelId: mId, costTier: 'haiku', contextWindow: 4096, modalities: { text: true, image: true, toolUse: true, structuredOutput: true } });
            }
          }
        }
        if (!cancelled && result.length > 0) {
          useProviderStore.getState().setModelEntries(result);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [modelEntries.length]);

  // Set default model on mount if none selected
  useEffect(() => {
    if (!activeModel && modelEntries.length > 0) {
      setActiveModel(modelEntries[0].modelId);
    }
  }, [activeModel, setActiveModel, modelEntries]);

  // Compute available models from configured provider entries only
  const modelOptions = useMemo(() => {
    return modelEntries.map((m) => m.modelId);
  }, [modelEntries]);

  // Update token counts in useWorkspaceStore reactively
  useEffect(() => {
    if (bubbleItems.length === 0) {
      setInputTokens(null);
      setSessionTokens(null);
      return;
    }

    const userChars = bubbleItems
      .filter((item) => item.role === 'user')
      .reduce((sum, item) => sum + (typeof item.content === 'string' ? item.content.length : String(item.content).length), 0);
    const calculatedInput = Math.max(12, Math.round(userChars * 0.25 + 10));

    const totalChars = bubbleItems.reduce((sum, item) => sum + (typeof item.content === 'string' ? item.content.length : String(item.content).length), 0);
    const calculatedSession = Math.max(24, Math.round(totalChars * 0.25 + 20));

    setInputTokens(calculatedInput);
    setSessionTokens(calculatedSession);
  }, [bubbleItems, setInputTokens, setSessionTokens]);

  // Handle Export Mode selection initialization
  useEffect(() => {
    if (isExportMode) {
      setSelectedMessageIds(new Set(bubbleItems.map((item) => item.key)));
    } else {
      setSelectedMessageIds(new Set());
    }
  }, [isExportMode, bubbleItems]);

  const slashItems = slashCommandRegistry.list().map((cmd) => ({
    label: cmd.label,
    value: cmd.name,
    description: cmd.description,
  }));

  const isEmpty = bubbleItems.length === 0 && !isStreaming && !error;

  const handleScreenCut = () => {
    message.success('Screen cut captured successfully!');
  };

  const handleAttachFiles = (filesList: File[]) => {
    filesList.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const img = new Image();
          img.onload = () => {
            const maxDim = 800;
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
              if (width > height) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              } else {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            const resizedBase64 = canvas.toDataURL('image/jpeg', 0.85);

            const newAttachment = {
              id: Math.random().toString(36).substring(7),
              name: file.name,
              url: URL.createObjectURL(file),
              base64: resizedBase64,
              type: 'image/jpeg',
            };
            setAttachedFiles((prev) => [...prev, newAttachment]);
          };
          img.src = reader.result as string;
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          const newAttachment = {
            id: Math.random().toString(36).substring(7),
            name: file.name,
            url: '',
            base64: reader.result as string,
            type: file.type,
          };
          setAttachedFiles((prev) => [...prev, newAttachment]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const handleNewChat = () => {
    newConversation();
    message.info('Started a new conversation.');
  };

  const handleReadAloud = (text: string, msgId: string) => {
    if (activeReadAloudId === msgId) {
      window.speechSynthesis.cancel();
      setActiveReadAloudId(null);
      return;
    }
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[#*`_]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => {
      setActiveReadAloudId(null);
    };
    utterance.onerror = () => {
      setActiveReadAloudId(null);
    };
    setActiveReadAloudId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleShare = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied shareable text to clipboard!');
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard!');
  };

  // CodeBlockActions integration — Insert code into page (stub, requires ServiceNow integration)
  const handleInsert = (_code: string) => {
    message.info('Insert into page requires ServiceNow active textarea (deferred to v0.2+)');
  };

  // CodeBlockActions integration — Save as macro (stub, requires ServiceNow macro system)
  const handleSaveMacro = (_code: string) => {
    message.info('Save as macro requires ServiceNow macro system (deferred to v0.2+)');
  };

  const handleRegenerate = async (msgId: string) => {
    try {
      message.loading({ content: 'Regenerating response...', key: 'regenerate' });
      await regenerateResponse(msgId);
      message.success({ content: 'Response regenerated!', key: 'regenerate', duration: 2 });
    } catch (err) {
      message.error({ content: 'Regeneration failed', key: 'regenerate' });
    }
  };

  const handleEditSave = async (msgId: string) => {
    if (!editContent.trim()) {
      message.warning('Message content cannot be empty.');
      return;
    }
    await editMessage(msgId, editContent);
    setEditingMessageId(null);
    message.success('Message updated.');
  };

  // WelcomeCards dismiss handler — persists to chrome.storage.local
  const handleDismissWelcomeCards = useCallback(() => {
    setWelcomeCardsDismissed(true);
    chrome.storage.local.set({ np_welcome_cards_dismissed: true }).catch(() => {});
  }, []);

  // WelcomeCards card select — populates Sender with prompt text
  const handleWelcomeCardSelect = useCallback((_templateId: string, promptText: string) => {
    setDraft(promptText);
  }, [setDraft]);

  // First assistant message index for first-message branding (D-28)
  const firstAssistantIndex = useMemo(() => {
    return bubbleItems.findIndex((item) => item.role === 'assistant');
  }, [bubbleItems]);

  const handleConfirmDelete = () => {
    if (deletingConv) {
      deleteConversation(deletingConv.id);
      setDeleteModalOpen(false);
      setDeletingConv(null);
      message.success('Conversation deleted.');
    }
  };

  const handleConfirmDeleteAll = () => {
    deleteAllConversations(includeStarred);
    setDeleteAllModalOpen(false);
    message.success('All matching conversations deleted.');
  };

  const handleConfirmEditTitle = () => {
    if (editingConv && newTitle.trim()) {
      updateConversationTitle(editingConv.id, newTitle.trim());
      setEditModalOpen(false);
      setEditingConv(null);
      message.success('Conversation title updated.');
    }
  };

  // Export Actions
  const handleExportConversation = (conv: any) => {
    switchConvWithLoading(conv.id);
    setChatHistoryOpen(false);
    setIsExportMode(true);
  };

  const getSelectedMessages = () => {
    return messages.filter((m) => selectedMessageIds.has(m.id));
  };

  const handleExportAsTxt = () => {
    const selected = getSelectedMessages();
    if (selected.length === 0) {
      message.warning('Please select at least one message.');
      return;
    }
    const textContent = selected
      .map((m) => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}:\n${m.content}\n\n-------------------\n`)
      .join('\n');
    
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `nowpilot-conversation-export.txt`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    setIsExportMode(false);
    message.success('Conversation exported as TXT.');
  };

  const handleExportAsImage = () => {
    const selected = getSelectedMessages();
    if (selected.length === 0) {
      message.warning('Please select at least one message.');
      return;
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 800;
    const padding = 40;
    const bubblePadding = 16;
    const messageGap = 24;
    
    ctx.font = '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    
    const wrapText = (text: string, maxWidth: number) => {
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';
      
      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine ? currentLine + ' ' + words[i] : words[i];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth) {
          lines.push(currentLine);
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
      return lines;
    };

    let totalHeight = padding * 2;
    const maxWidth = width - padding * 2;
    const bubbleWidth = maxWidth * 0.75;
    
    const formattedMessages = selected.map((msg) => {
      const lines = wrapText(msg.content, bubbleWidth - bubblePadding * 2);
      const bubbleHeight = lines.length * 22 + bubblePadding * 2;
      const itemHeight = bubbleHeight + 30;
      return { msg, lines, bubbleHeight, itemHeight };
    });
    
    formattedMessages.forEach((item) => {
      totalHeight += item.itemHeight + messageGap;
    });
    
    canvas.width = width;
    canvas.height = Math.max(400, totalHeight);
    
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#e0582e';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('NowPilot Exported Conversation', padding, padding + 10);
    
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding + 30);
    ctx.lineTo(width - padding, padding + 30);
    ctx.stroke();
    
    let currentY = padding + 60;
    
    formattedMessages.forEach((item) => {
      const isUser = item.msg.role === 'user';
      const bubbleX = isUser ? width - padding - bubbleWidth : padding;
      const labelX = isUser ? width - padding - 10 : padding + 10;
      
      ctx.fillStyle = '#64748b';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = isUser ? 'right' : 'left';
      ctx.fillText(isUser ? 'User' : 'Assistant', labelX, currentY + 12);
      
      ctx.fillStyle = isUser ? '#1677ff' : '#ffffff';
      ctx.strokeStyle = '#e2e8f0';
      
      const rx = bubbleX;
      const ry = currentY + 20;
      const rw = bubbleWidth;
      const rh = item.bubbleHeight;
      const radius = 12;
      
      ctx.beginPath();
      ctx.moveTo(rx + radius, ry);
      ctx.lineTo(rx + rw - radius, ry);
      ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + radius);
      ctx.lineTo(rx + rw, ry + rh - radius);
      ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - radius, ry + rh);
      ctx.lineTo(rx + radius, ry + rh);
      ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - radius);
      ctx.lineTo(rx, ry + radius);
      ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
      ctx.closePath();
      ctx.fill();
      if (!isUser) {
        ctx.stroke();
      }
      
      ctx.fillStyle = isUser ? '#ffffff' : '#1e293b';
      ctx.font = '15px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      
      item.lines.forEach((line, idx) => {
        ctx.fillText(line, bubbleX + bubblePadding, ry + bubblePadding + 15 + idx * 22);
      });
      
      currentY += item.itemHeight + messageGap;
    });
    
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `nowpilot-conversation-export.png`;
    link.href = dataUrl;
    link.click();
    setIsExportMode(false);
    message.success('Conversation exported as PNG image.');
  };

  // Chat History filtered & grouped
  const filteredConversations = useMemo(() => {
    let result = conversations;
    if (historyTab === 'starred') {
      result = result.filter((c) => c.starred);
    }
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      result = result.filter(
        (c) =>
          c.title?.toLowerCase().includes(q) ||
          c.preview?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [conversations, historyTab, historySearch]);

  const groupedConversations = useMemo(() => {
    const groups: Record<string, typeof conversations> = {};
    filteredConversations.forEach((c) => {
      const label = getGroupLabel(c.updated || c.created || Date.now());
      if (!groups[label]) groups[label] = [];
      groups[label].push(c);
    });
    return groups;
  }, [filteredConversations]);

  // Dropdown menu for conversation action
  const getActionMenu = (conv: any) => ({
    items: [
      {
        key: 'export',
        label: 'Export',
        icon: <ShareAltOutlined />,
        onClick: (e: any) => {
          e.domEvent.stopPropagation();
          handleExportConversation(conv);
        },
      },
      {
        key: 'edit',
        label: 'Edit title',
        icon: <EditOutlined />,
        onClick: (e: any) => {
          e.domEvent.stopPropagation();
          setEditingConv(conv);
          setNewTitle(conv.title || '');
          setEditModalOpen(true);
        },
      },
      {
        key: 'delete',
        label: 'Delete',
        danger: true,
        icon: <DeleteOutlined />,
        onClick: (e: any) => {
          e.domEvent.stopPropagation();
          setDeletingConv(conv);
          setDeleteModalOpen(true);
        },
      },
    ],
  });

  const attachmentHeader = (attachedFiles.length > 0 || quotedMessage) ? (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '12px 16px 8px',
        background: 'transparent',
        borderTopLeftRadius: '12px',
        borderTopRightRadius: '12px',
      }}
    >
      {/* 1. Attached Files Thumbnails */}
      {attachedFiles.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
          {attachedFiles.map((file) => (
            <div
              key={file.id}
              style={{
                position: 'relative',
                width: '60px',
                height: '60px',
                borderRadius: '8px',
                border: '1px solid var(--ant-color-border)',
                overflow: 'hidden',
                background: 'var(--ant-color-bg-container)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {file.url || file.base64 ? (
                <img
                  src={file.url || file.base64}
                  alt={file.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '4px' }}>
                  <FileTextOutlined style={{ fontSize: '20px', color: 'var(--ant-color-text-secondary)' }} />
                  <span style={{ fontSize: '9px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '50px', textAlign: 'center' }}>
                    {file.name.split('.').pop()?.toUpperCase()}
                  </span>
                </div>
              )}
              {/* Delete button */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  removeAttachedFile(file.id);
                }}
                style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '10px',
                  zIndex: 10,
                }}
              >
                <CloseOutlined style={{ fontSize: '8px' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 2. Quoted Text Block */}
      {quotedMessage && (
        <div
          style={{
            padding: '12px',
            background: 'var(--ant-color-bg-container)',
            borderLeft: '4px solid #e0582e',
            borderRadius: '8px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            border: '1px solid var(--ant-color-border-secondary)',
          }}
        >
          {/* Header with Close icon */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ant-color-text-description)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quote text
            </span>
            <Tooltip title="Remove quote">
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined style={{ fontSize: '10px' }} />}
                onClick={() => setQuotedMessage(null)}
                style={{ height: '20px', width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              />
            </Tooltip>
          </div>

          {/* Quoted Content Preview */}
          <div
            style={{
              fontSize: '13px',
              color: 'var(--ant-color-text)',
              maxHeight: '60px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              paddingLeft: '4px',
              fontStyle: 'italic',
            }}
          >
            "{quotedMessage.content}"
          </div>
        </div>
      )}

      {/* 3. Prompt List shown between quoted text and input box */}
      {quotedMessage && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            padding: '4px 0 0',
          }}
        >
          {prompts.slice(0, 5).map((p) => (
            <Button
              key={p.id}
              size="small"
              icon={renderPromptIcon(p.icon, { fontSize: 11 })}
              style={{
                fontSize: '11px',
                borderRadius: '12px',
                borderColor: 'var(--ant-color-border-secondary)',
                color: 'var(--ant-color-text-secondary)',
                background: 'var(--ant-color-bg-container)',
                display: 'inline-flex',
                alignItems: 'center',
              }}
              onClick={() => {
                let textToSend = p.template;
                if (p.variables.includes('userInput')) {
                  textToSend = templateEngine.render(p.template, { userInput: quotedMessage.content });
                } else {
                  textToSend = `${p.template}\n\nQuote:\n> ${quotedMessage.content}`;
                }
                send(textToSend);
                setQuotedMessage(null);
              }}
            >
              {p.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
      }}
      {...(isEmpty ? { 'data-page-empty-state': 'chat' } : {})}
    >
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        multiple
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleAttachFiles(Array.from(e.target.files));
          }
        }}
      />

      {/* Standalone chat window shows as full page. Inline sidebar removed. History is accessed via the drawer on the right. */}

      {/* Messages + Composer Column */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          position: 'relative',
          paddingBottom: isExportMode ? 60 : 0, // Make space for export sticky footer
          background: '#ffffff', // White background for the contents page
          border: '1px solid var(--ant-color-border-secondary)', // Elegant frame border
          borderRadius: '12px', // Rounded frame corners
          margin: isStandalone ? '6px' : '8px', // Outer offset spacing
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)', // Soft ambient shadow
          overflow: 'hidden',
        }}
      >
        {/* Error state */}
        {error && (
          <div style={{ padding: '8px 16px', zIndex: 10 }}>
            <Alert
              type="error"
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Text>{error}</Text>
                  <Button size="small" onClick={() => send(draft || 'Retry')}>
                    Retry
                  </Button>
                </div>
              }
              showIcon
              closable
            />
          </div>
        )}

        {/* Messages list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 16px' }}>
          {isEmpty && !conversationLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Branded header at top with personalized greeting (D-23) — always visible in empty state */}
              <BrandedHeader
                userGreeting={greeting.greeting}
                contextualMessage={greeting.contextualLine}
                onClose={handleDismissWelcomeCards}
              />
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: token.marginLG,
                  padding: token.paddingLG,
                }}
              >
                {!welcomeCardsDismissed ? (
                  <WelcomeCards onSelectCard={handleWelcomeCardSelect} onDismiss={handleDismissWelcomeCards} />
                ) : null}
              </div>
            </div>
          ) : conversationLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              <Spin />
            </div>
          ) : (
            isExportMode ? (
              <div style={{ padding: '16px 0' }}>
                {bubbleItems.map((item) => {
                  const isUser = item.role === 'user';
                  return (
                    <div
                      key={item.key}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                        marginBottom: 16,
                      }}
                    >
                      <Checkbox
                        checked={selectedMessageIds.has(item.key)}
                        onChange={(e) => {
                          const next = new Set(selectedMessageIds);
                          if (e.target.checked) {
                            next.add(item.key);
                          } else {
                            next.delete(item.key);
                          }
                          setSelectedMessageIds(next);
                        }}
                        style={{ marginTop: 12 }}
                      />
                      <div style={{ flex: 1 }}>
                        <Bubble
                          placement={isUser ? 'end' : 'start'}
                          loading={item.loading}
                          content={
                            isUser ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {item.metadata?.attachments && item.metadata.attachments.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                                    {item.metadata.attachments.map((file: any) => (
                                      <div
                                        key={file.id}
                                        style={{
                                          width: '120px',
                                          height: '120px',
                                          borderRadius: '8px',
                                          overflow: 'hidden',
                                          border: '1px solid var(--ant-color-border-secondary)',
                                          background: '#f9f9f9',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                        }}
                                      >
                                        {file.url || file.base64 ? (
                                          <img
                                            src={file.url || file.base64}
                                            alt={file.name}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                          />
                                        ) : (
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                            <FileTextOutlined style={{ fontSize: '24px', color: 'var(--ant-color-text-secondary)' }} />
                                            <span style={{ fontSize: '10px', textAlign: 'center', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', width: '110px', whiteSpace: 'nowrap' }}>
                                              {file.name}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                <div style={{ whiteSpace: 'pre-wrap', color: 'inherit' }}>
                                  {typeof item.content === 'string'
                                    ? item.content.replace(/<attachment\s+name="([^"]+)"\s+type="[^"]+">[^<]+<\/attachment>/g, '')
                                    : String(item.content)}
                                </div>
                              </div>
                            ) : (
                              <XMarkdown
                                content={typeof item.content === 'string' ? item.content : String(item.content)}
                                streaming={{
                                  hasNextChunk: false,
                                  enableAnimation: true,
                                }}
                                openLinksInNewTab={true}
                              />
                            )
                          }
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                {bubbleItems.map((item, index) => {
                  const isUser = item.role === 'user';
                  const isEditing = editingMessageId === item.key;
                  const isFirstAssistant = item.role === 'assistant' && index === firstAssistantIndex;
                  
                  return (
                    <div
                      key={item.key}
                      className="group animate-fade-in"
                      onMouseEnter={() => setHoveredMessageId(item.key)}
                      onMouseLeave={() => setHoveredMessageId(null)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isUser ? 'flex-end' : 'flex-start',
                        marginBottom: '16px',
                        padding: '0 8px',
                      }}
                    >
                      {/* Model header for Assistant message */}
                      {!isUser && !isEditing && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '6px',
                            padding: '0 4px',
                            userSelect: 'none',
                          }}
                        >
                          <div
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              background: '#1e293b',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              fontWeight: 'bold',
                            }}
                          >
                            ✦
                          </div>
                          <span
                            style={{
                              fontSize: '13px',
                              fontWeight: 500,
                              color: 'var(--ant-color-text-secondary)',
                            }}
                          >
                            {activeModel}
                          </span>
                        </div>
                      )}

                      {/* Message Content: Bubble or Editing Input Box */}
                      {isEditing ? (
                        <div
                          style={{
                            width: '100%',
                            maxWidth: '400px',
                            background: 'var(--ant-color-bg-container)',
                            border: '1px solid var(--ant-color-border-secondary)',
                            borderRadius: '12px',
                            padding: '12px',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                            marginTop: '8px',
                          }}
                        >
                          <Input.TextArea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            autoSize={{ minRows: 2, maxRows: 6 }}
                            style={{ marginBottom: '8px', borderRadius: '6px' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <Button size="small" onClick={() => setEditingMessageId(null)}>
                              Cancel
                            </Button>
                            <Button
                              type="primary"
                              size="small"
                              onClick={() => handleEditSave(item.key)}
                              style={{ background: '#e0582e', borderColor: '#e0582e' }}
                            >
                              Save
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div
                          style={{
                            maxWidth: '85%',
                            position: 'relative',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: isUser ? 'flex-end' : 'flex-start',
                          }}
                        >
                          <Bubble
                            placement={isUser ? 'end' : 'start'}
                            // D-28: First-message branding — BunnyAvatar + branded header on first assistant message only
                            avatar={isFirstAssistant ? (
                              <div style={{ border: '2px solid var(--ant-color-primary)', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                                <BunnyAvatar />
                              </div>
                            ) : undefined}
                            header={isFirstAssistant ? (
                              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ant-color-primary)' }}>NowPilot</div>
                            ) : undefined}
                            content={
                              isUser ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {item.metadata?.attachments && item.metadata.attachments.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '4px' }}>
                                      {item.metadata.attachments.map((file: any) => (
                                        <div
                                          key={file.id}
                                          style={{
                                            width: '120px',
                                            height: '120px',
                                            borderRadius: '8px',
                                            overflow: 'hidden',
                                            border: '1px solid var(--ant-color-border-secondary)',
                                            background: '#f9f9f9',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                          }}
                                        >
                                          {file.url || file.base64 ? (
                                            <img
                                              src={file.url || file.base64}
                                              alt={file.name}
                                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                            />
                                          ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                              <FileTextOutlined style={{ fontSize: '24px', color: 'var(--ant-color-text-secondary)' }} />
                                              <span style={{ fontSize: '10px', textAlign: 'center', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', width: '110px', whiteSpace: 'nowrap' }}>
                                                {file.name}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div style={{ whiteSpace: 'pre-wrap', color: 'inherit' }}>
                                    {typeof item.content === 'string'
                                      ? item.content.replace(/<attachment\s+name="([^"]+)"\s+type="[^"]+">[^<]+<\/attachment>/g, '')
                                      : String(item.content)}
                                  </div>
                                </div>
                              ) : item.stage && item.stage !== 'idle' && !item.content ? (
                                <StageIndicator
                                  stage={item.stage}
                                  hasPinnedTabs={(pinnedTabs?.length ?? 0) > 0}
                                  lastTokenTime={item.metadata?.lastTokenTime}
                                  currentTool={item.currentTool}
                                  reasoning={item.reasoning}
                                />
                              ) : item.clarification ? (
                                <ClarificationAction
                                  question={item.clarification.question}
                                  options={item.clarification.options}
                                  onSelect={(value) => setDraft(value)}
                                />
                              ) : item.content ? (
                                <>
                                  {item.reasoning ? (
                                    <Think
                                      icon={<ThinkingIcon />}
                                      title="Thinking ..."
                                      defaultExpanded
                                    >
                                      <XMarkdown
                                        content={item.reasoning}
                                      />
                                    </Think>
                                  ) : null}
                                  <XMarkdown
                                    content={typeof item.content === 'string' ? item.content : String(item.content)}
                                    streaming={{
                                      hasNextChunk: item.streaming,
                                      enableAnimation: true,
                                    }}
                                    openLinksInNewTab={true}
                                    components={{
                                      code: ({ children, className, ...props }: any) => {
                                        const isFence = className?.startsWith('language-');
                                        if (!isFence) {
                                          return <code className={className} {...props}>{children}</code>;
                                        }
                                        const codeText = typeof children === 'string' ? children : String(children ?? '');
                                        const lang = className?.replace('language-', '');
                                        return (
                                          <CodeBlockActions
                                            code={codeText}
                                            language={lang}
                                            onInsert={handleInsert}
                                            onSaveAsMacro={handleSaveMacro}
                                            canInsert={!!currentPageContext?.hostname?.includes('servicenow')}
                                          />
                                        );
                                      },
                                    }}
                                  />
                                  {!isUser && !item.streaming && item.role === 'assistant' && item.followUpSuggestions && item.followUpSuggestions.length > 0 ? (
                                    <FollowUpAction
                                      suggestions={item.followUpSuggestions}
                                      onSelect={(text) => send(text)}
                                    />
                                  ) : null}
                                  {/* D-17: InlineConfirmationCard renders in Bubble when tool confirmation is present */}
                                  {!isUser && item.role === 'assistant' && item.metadata?.confirmation ? (
                                    <InlineConfirmationCard
                                      actionDescription={item.metadata.confirmation.description}
                                      rationale={item.metadata.confirmation.rationale}
                                      onProceed={() => {
                                        console.log('[ChatPage] InlineConfirmation: Proceed', item.metadata.confirmation);
                                      }}
                                      onCancel={() => {
                                        console.log('[ChatPage] InlineConfirmation: Cancelled', item.metadata.confirmation);
                                      }}
                                      state={item.metadata.confirmation.state || 'pending'}
                                      actionSummary={item.metadata.confirmation.summary}
                                    />
                                  ) : null}
                                </>
                              ) : null
                            }
                          />

                          {/* Action Panel: Always rendered to reserve space — visibility toggled to avoid layout shift */}
                          <div
                            style={{
                              marginTop: '6px',
                              height: '32px',
                              visibility: hoveredMessageId === item.key && !isEditing && !item.loading ? 'visible' : 'hidden',
                              opacity: hoveredMessageId === item.key && !isEditing && !item.loading ? 1 : 0,
                              transition: 'opacity 0.15s ease, visibility 0.15s ease',
                              pointerEvents: hoveredMessageId === item.key && !isEditing && !item.loading ? 'auto' : 'none',
                              alignSelf: isUser ? 'flex-end' : 'flex-start',
                            }}
                          >
                            <div
                              style={{
                                background: 'var(--ant-color-bg-elevated)',
                                border: '1px solid var(--ant-color-border-secondary)',
                                borderRadius: '16px',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                                padding: '0px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                                height: '32px',
                                overflow: 'hidden',
                              }}
                            >
                              {isUser ? (
                                // User Message Action Buttons: Edit, Copy, Quote, Share, Speak loud
                                <>
                                  <Tooltip title="Edit">
                                    <Button
                                      type="text"
                                      icon={<EditOutlined style={{ fontSize: 18 }} />}
                                      onClick={() => {
                                        setEditingMessageId(item.key);
                                        setEditContent(item.content);
                                      }}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0 }}
                                      title="Edit"
                                    />
                                  </Tooltip>
                                  <Tooltip title="Copy">
                                    <Button
                                      type="text"
                                      icon={<CopyIcon />}
                                      onClick={() => handleCopy(item.content)}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0 }}
                                      title="Copy"
                                    />
                                  </Tooltip>
                                  <Tooltip title="Quote">
                                    <Button
                                      type="text"
                                      icon={<QuoteIcon />}
                                      onClick={() => {
                                        setQuotedMessage(item);
                                        message.info('Message quoted.');
                                      }}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0 }}
                                      title="Quote"
                                    />
                                  </Tooltip>
                                  <Tooltip title="Share">
                                    <Button
                                      type="text"
                                      icon={<ShareIcon />}
                                      onClick={() => handleShare(item.content)}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0 }}
                                      title="Share"
                                    />
                                  </Tooltip>
                                  <Tooltip title={activeReadAloudId === item.key ? "Stop speaking" : "Speak loud"}>
                                    <Button
                                      type="text"
                                      icon={<ReadAloudIcon style={{ color: activeReadAloudId === item.key ? '#e0582e' : undefined }} />}
                                      onClick={() => handleReadAloud(item.content, item.key)}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0 }}
                                      title="Speak loud"
                                    />
                                  </Tooltip>
                                </>
                              ) : (
                                // Response Message Action Buttons: Copy, Save as a note, Regenerate, Quote, Share, Speak loud
                                <>
                                  <Tooltip title="Copy">
                                    <Button
                                      type="text"
                                      icon={<CopyIcon />}
                                      onClick={() => handleCopy(item.content)}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0 }}
                                      title="Copy"
                                    />
                                  </Tooltip>
                                  <Tooltip title="Save as a note">
                                    <Button
                                      type="text"
                                      icon={<SaveNoteIcon />}
                                      onClick={() => setSavingNoteContent(item.content)}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0 }}
                                      title="Save as a note"
                                    />
                                  </Tooltip>
                                  <Tooltip title="Regenerate response">
                                    <Button
                                      type="text"
                                      icon={<RegenerateIcon />}
                                      onClick={() => handleRegenerate(item.key)}
                                      disabled={isStreaming}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0 }}
                                      title="Regenerate response"
                                    />
                                  </Tooltip>
                                  <Tooltip title="Quote">
                                    <Button
                                      type="text"
                                      icon={<QuoteIcon />}
                                      onClick={() => {
                                        setQuotedMessage(item);
                                        message.info('Message quoted.');
                                      }}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0 }}
                                      title="Quote"
                                    />
                                  </Tooltip>
                                  <Tooltip title="Share">
                                    <Button
                                      type="text"
                                      icon={<ShareIcon />}
                                      onClick={() => handleShare(item.content)}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0 }}
                                      title="Share"
                                    />
                                  </Tooltip>
                                  <Tooltip title={activeReadAloudId === item.key ? "Stop speaking" : "Speak loud"}>
                                    <Button
                                      type="text"
                                      icon={<ReadAloudIcon style={{ color: activeReadAloudId === item.key ? '#e0582e' : undefined }} />}
                                      onClick={() => handleReadAloud(item.content, item.key)}
                                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', padding: 0 }}
                                      title="Speak loud"
                                    />
                                  </Tooltip>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )
          )}
          {/* D-25: ConversationClosure appears after idle */}
          {closureState.showPrompt && (
            <ConversationClosure
              onFeedback={(helpful) => {
                console.log('[ChatPage] Conversation feedback:', helpful ? 'helpful' : 'not helpful');
                closureState.dismiss();
              }}
            />
          )}
        </div>

        {/* Action Controls Bar above Input box */}
        {!isExportMode && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 16px',
              background: 'transparent',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Model Selector Dropdown */}
              <Select
                value={activeModel}
                onChange={(val) => {
                  setActiveModel(val);
                  const matched = modelEntries.find((m) => m.modelId === val);
                  if (matched) {
                    setActiveProvider(matched.providerId);
                  }
                }}
                style={{
                  minWidth: 190,
                  height: 32,
                  background: '#f1f5f9',
                  borderRadius: '16px',
                  paddingLeft: '4px',
                  paddingRight: '4px',
                }}
                variant="borderless"
                classNames={{ popup: { root: "model-select-dropdown" } }}
                styles={{ popup: { root: { minWidth: 260 } } }}
                optionRender={(option) => {
                  const info = getModelInfo(option.value as string);
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                        <span style={{ color: '#e0582e' }}>{info.icon}</span>
                        <span>{info.label}</span>
                        <span style={{ fontSize: 10, opacity: 0.6, background: 'var(--ant-color-bg-layout)', padding: '1px 6px', borderRadius: 4, fontWeight: 'normal' }}>
                          {info.provider}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ant-color-text-description)', marginTop: 2 }}>
                        {info.desc}
                      </div>
                    </div>
                  );
                }}
                options={modelOptions.map((m) => {
                  const info = getModelInfo(m);
                  return {
                    label: (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                        <span style={{ color: '#e0582e' }}>{info.icon}</span>
                        <span>{info.label}</span>
                      </span>
                    ),
                    value: m,
                  };
                })}
              />

              <Tooltip title="Screen cut">
                <Button
                  type="text"
                  icon={<ScissorOutlined style={{ fontSize: 16 }} />}
                  onClick={handleScreenCut}
                  title="Screen cut"
                />
              </Tooltip>
              <Tooltip title="Attach file">
                <Button
                  type="text"
                  icon={<FolderAddOutlined style={{ fontSize: 16 }} />}
                  onClick={() => fileInputRef.current?.click()}
                  title="Attach image/File"
                />
              </Tooltip>
              {!isStandalone && (
                <Tooltip title="Pinned context">
                  <Button
                    type="text"
                    icon={<PushpinOutlined style={{ fontSize: 16 }} />}
                    onClick={() => {
                      loadAvailableTabs();
                      setPinnedContextOpen(true);
                    }}
                    title="Pinned context"
                  />
                </Tooltip>
              )}
            </div>

            {/* Icons Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Tooltip title="Chat history">
                <Button
                  type="text"
                  icon={<ClockCircleOutlined style={{ fontSize: 16 }} />}
                  onClick={() => setChatHistoryOpen(true)}
                  title="Chat history"
                />
              </Tooltip>
              <Tooltip title="New chat">
                <Button
                  type="text"
                  icon={<PlusSquareFilled style={{ fontSize: 18, color: '#e0582e' }} />}
                  onClick={handleNewChat}
                  title="New chat"
                />
              </Tooltip>
            </div>
          </div>
        )}

        {/* Quick action chips — context-aware action strip above Sender (D-34) */}
        {!isExportMode && <QuickActionChips onSelectAction={(promptText) => { setDraft(promptText); }} />}

        {/* PinTabBar — always visible above composer (D-11) */}
        {!isExportMode && <PinTabBar />}

        {/* Sender Component */}
        {!isExportMode && (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                const filesArray = Array.from(e.dataTransfer.files);
                const newAttachments = filesArray.map((file) => {
                  const url = file.type.startsWith('image/')
                    ? URL.createObjectURL(file)
                    : '';
                  return {
                    id: Math.random().toString(36).substring(7),
                    name: file.name,
                    url,
                    type: file.type,
                    file,
                  };
                });
                setAttachedFiles((prev) => [...prev, ...newAttachments]);
                message.success(`Attached ${filesArray.length} file(s) via drag and drop.`);
              }
            }}
            style={{
              padding: '8px 16px 16px',
              minHeight: '120px',
              position: 'relative',
            }}
          >
            {/* Floating Slash Command / Language Selection Popover */}
            {slashState.active && totalFilteredCount > 0 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: '16px',
                  right: '16px',
                  marginBottom: '8px',
                  background: 'var(--ant-color-bg-elevated)',
                  border: '1px solid var(--ant-color-border-secondary)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  maxHeight: '220px',
                  overflowY: 'auto',
                  padding: '6px',
                }}
              >
                <div style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 600, color: 'var(--ant-color-text-description)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--ant-color-border-secondary)', marginBottom: '4px' }}>
                  {slashState.step === 'commands' ? 'Prompts' : 'Select Language'}
                </div>
                {slashState.step === 'commands' ? (
                  filteredPrompts.map((p, idx) => {
                    const isSelected = idx === slashSelectedIndex;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSlashSelectedIndex(idx);
                          setTimeout(() => {
                            const lastSlash = draft.lastIndexOf('/');
                            if (lastSlash !== -1) {
                              const promptText = getPromptSelectionText(p.template);
                              setDraft(draft.slice(0, lastSlash) + promptText);
                            }
                          }, 0);
                        }}
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--ant-color-primary-bg)' : 'transparent',
                          color: isSelected ? '#e0582e' : 'inherit',
                          transition: 'background 0.2s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '6px', background: isSelected ? '#ffffff' : 'var(--ant-color-bg-layout)', color: isSelected ? '#e0582e' : 'var(--ant-color-text-secondary)', fontSize: '14px' }}>
                          {renderPromptIcon(p.icon)}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p.name}
                          </div>
                          {p.description && (
                            <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.description}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  filteredLanguages.map((lang, idx) => {
                    const isSelected = idx === slashSelectedIndex;
                    return (
                      <div
                        key={lang.label}
                        onClick={() => {
                          setSlashSelectedIndex(idx);
                          setTimeout(() => {
                            const lastSlash = draft.lastIndexOf('/');
                            if (lastSlash !== -1) {
                              setDraft(draft.slice(0, lastSlash) + `/translate into ${lang.label} `);
                            }
                          }, 0);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--ant-color-primary-bg)' : 'transparent',
                          color: isSelected ? '#e0582e' : 'inherit',
                          transition: 'background 0.2s',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 500, fontSize: '13px' }}>
                          <span>{lang.flag}</span>
                          <span>{lang.label}</span>
                        </div>
                        <div style={{ fontSize: '11px', opacity: 0.6 }}>
                          {lang.native}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <Sender
              value={draft}
              loading={isStreaming}
              onChange={(v) => {
                setDraft(v);
              }}
              onKeyDown={(e) => {
                if (slashState.active && totalFilteredCount > 0) {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSlashSelectedIndex((prev) => (prev + 1) % totalFilteredCount);
                    return;
                  }
                  if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSlashSelectedIndex((prev) => (prev - 1 + totalFilteredCount) % totalFilteredCount);
                    return;
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSelectSlashItem();
                    return;
                  }
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    const lastSlash = draft.lastIndexOf('/');
                    setDraft(draft.slice(0, lastSlash));
                    return;
                  }
                }
              }}
              onSubmit={(msg) => {
                let finalMsg = msg;
                const attachmentsData = attachedFiles.map((f) => ({
                  id: f.id,
                  name: f.name,
                  url: f.url,
                  base64: f.base64,
                  type: f.type,
                }));
                if (attachmentsData.length > 0) {
                  const attachmentsInfo = attachmentsData
                    .map((f) => `<attachment name="${f.name}" type="${f.type}">${f.base64}</attachment>`)
                    .join('\n');
                  finalMsg = `${finalMsg}\n\n${attachmentsInfo}`;
                }
                send(finalMsg, { attachments: attachmentsData });
                clearAttachedFiles();
              }}
              onCancel={abort}
              placeholder="Ask anything, @ models, / prompts... (type / for commands)"
              autoSize={{ minRows: 4, maxRows: 8 }}
              style={{ minHeight: '120px' }}
              header={attachmentHeader}
              // RICH-H-16: Image paste handler — appends clipboard images to attachment strip
              onPasteFile={(files: FileList) => {
                const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
                if (imageFiles.length === 0) return;
                // Enforce existing 5-file limit (D-31)
                const remaining = 5 - attachedFiles.length;
                const toAdd = imageFiles.slice(0, remaining);
                if (toAdd.length < imageFiles.length) {
                  console.log('[ChatPage] Image paste: some files dropped (max 5)');
                }
                const newAttachments = toAdd.map((file) => ({
                  id: crypto.randomUUID(),
                  name: file.name || `Pasted-${Date.now()}.png`,
                  url: URL.createObjectURL(file),
                  type: file.type,
                  file,
                }));
                setAttachedFiles((prev) => [...prev, ...newAttachments]);
              }}
            />

            {/* Bottom Brand & Action Footer */}
            <div
              style={{
                borderTop: '1px solid var(--ant-color-border-secondary)',
                marginTop: '12px',
                paddingTop: '4px',
              }}
            >
              <WorkspaceStatusBar
                surface={isStandalone ? 'standalone' : 'sidepanel'}
                flush
                height={32}
                onHelp={() => {
                  message.info('Help Center opened.');
                }}
                onFeedback={() => {
                  message.info('Feedback opened.');
                }}
              />
            </div>
          </div>
        )}

        {/* Export Mode Sticky Footer */}
        {isExportMode && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderTop: '1px solid var(--ant-color-border-secondary)',
              background: 'var(--ant-color-bg-container)',
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 100,
            }}
          >
            <Checkbox
              checked={selectedMessageIds.size === bubbleItems.length && bubbleItems.length > 0}
              indeterminate={selectedMessageIds.size > 0 && selectedMessageIds.size < bubbleItems.length}
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedMessageIds(new Set(bubbleItems.map((item) => item.key)));
                } else {
                  setSelectedMessageIds(new Set());
                }
              }}
            >
              Select all
            </Checkbox>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'txt',
                      label: 'Export as TXT',
                      onClick: handleExportAsTxt,
                    },
                    {
                      key: 'image',
                      label: 'Export as Image',
                      onClick: handleExportAsImage,
                    }
                  ]
                }}
                trigger={['click']}
              >
                <Button type="primary">
                  Export as <DownOutlined />
                </Button>
              </Dropdown>
              
              <Button
                type="text"
                icon={<CloseOutlined />}
                onClick={() => setIsExportMode(false)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom sliding Drawer for Chat History in sidepanel / compact view */}
      <Drawer
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ fontWeight: 600, fontSize: 16 }}>
              Chat history ({conversations.length})
            </span>
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => setDeleteAllModalOpen(true)}
              title="Delete all"
              style={{ marginRight: 24 }}
            />
          </div>
        }
        placement={isStandalone ? "right" : "bottom"}
        open={chatHistoryOpen}
        onClose={() => setChatHistoryOpen(false)}
        styles={{
          wrapper: {
            width: isStandalone ? 380 : '100%',
            height: isStandalone ? '100%' : '70%',
          },
          body: {
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            overflow: 'hidden',
          },
        }}
      >
        {/* All / Starred Tabs & Search */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              type={historyTab === 'all' ? 'primary' : 'default'}
              size="small"
              onClick={() => setHistoryTab('all')}
              style={{ borderRadius: 12 }}
            >
              All
            </Button>
            <Button
              type={historyTab === 'starred' ? 'primary' : 'default'}
              size="small"
              onClick={() => setHistoryTab('starred')}
              style={{ borderRadius: 12 }}
            >
              Starred
            </Button>
          </div>
          <Input
            placeholder="Search conversations..."
            prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-quaternary)' }} />}
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value)}
            style={{ borderRadius: 8 }}
          />
        </div>

        {/* History Lists Grouped by Time */}
        <div style={{ flex: 1, overflowY: 'auto', marginTop: 8 }}>
          {Object.keys(groupedConversations).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--ant-color-text-description)' }}>
              No history found.
            </div>
          ) : (
            ['Today', 'This Week', 'This Month', 'Previous Month', 'Older'].map((group) => {
              const items = groupedConversations[group];
              if (!items || items.length === 0) return null;
              return (
                <div key={group} style={{ marginBottom: 16 }}>
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--ant-color-text-quaternary)',
                      padding: '4px 8px',
                      textTransform: 'uppercase',
                    }}
                  >
                    {group}
                  </div>
                  {items.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => {
                        switchConversation(conv.id);
                        setChatHistoryOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: 8,
                        cursor: 'pointer',
                        background: activeConversationId === conv.id ? 'var(--ant-color-primary-bg-hover)' : 'transparent',
                        transition: 'background 0.2s',
                        marginBottom: 4,
                      }}
                      className="chat-history-item"
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <div style={{ fontWeight: 500, fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {conv.title || 'New Conversation'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ant-color-text-description)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {conv.preview || 'No preview'}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <Button
                          type="text"
                          size="small"
                          icon={conv.starred ? <StarFilled style={{ color: '#fadb14' }} /> : <StarOutlined />}
                          onClick={() => toggleStarConversation(conv.id)}
                        />
                        <Dropdown menu={getActionMenu(conv)} trigger={['click']}>
                          <Button
                            type="text"
                            size="small"
                            icon={<MoreOutlined />}
                          />
                        </Dropdown>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </Drawer>

      {/* Confirmation Modal: Delete Single Conversation */}
      <Modal
        open={deleteModalOpen}
        onCancel={() => setDeleteModalOpen(false)}
        footer={null}
        centered
        width={320}
        styles={{ body: { padding: '24px 16px 16px', textAlign: 'center' } }}
      >
        <div style={{ color: '#ff4d4f', fontSize: 40, marginBottom: 16 }}>
          <ExclamationCircleFilled />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Delete this conversation?
        </h3>
        <p style={{ color: 'var(--ant-color-text-description)', marginBottom: 24 }}>
          This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button style={{ flex: 1 }} onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>
          <Button
            type="primary"
            danger
            style={{ flex: 1 }}
            onClick={handleConfirmDelete}
          >
            Delete
          </Button>
        </div>
      </Modal>

      {/* Confirmation Modal: Delete All Conversations */}
      <Modal
        open={deleteAllModalOpen}
        onCancel={() => setDeleteAllModalOpen(false)}
        footer={null}
        centered
        width={320}
        styles={{ body: { padding: '24px 16px 16px', textAlign: 'center' } }}
      >
        <div style={{ color: '#ff4d4f', fontSize: 40, marginBottom: 16 }}>
          <ExclamationCircleFilled />
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
          Delete all
        </h3>
        <p style={{ color: 'var(--ant-color-text-description)', marginBottom: 16 }}>
          This action cannot be undone.
        </p>
        <div style={{ marginBottom: 24, display: 'inline-block', textAlign: 'left' }}>
          <Checkbox
            checked={includeStarred}
            onChange={(e) => setIncludeStarred(e.target.checked)}
          >
            Include Starred
          </Checkbox>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <Button style={{ flex: 1 }} onClick={() => setDeleteAllModalOpen(false)}>
            Cancel
          </Button>
          <Button
            type="primary"
            danger
            style={{ flex: 1 }}
            onClick={handleConfirmDeleteAll}
          >
            Delete all
          </Button>
        </div>
      </Modal>

      {/* Modal: Edit Conversation Title */}
      <Modal
        title="Edit title"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        onOk={handleConfirmEditTitle}
        okText="Save"
        cancelText="Cancel"
        centered
        width={340}
      >
        <div style={{ marginTop: 16, position: 'relative' }}>
          <Input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value.slice(0, 200))}
            placeholder="Enter conversation title..."
            maxLength={200}
            suffix={
              <span style={{ color: 'var(--ant-color-text-quaternary)', fontSize: 11 }}>
                {newTitle.length} / 200
              </span>
            }
          />
        </div>
      </Modal>

      {savingNoteContent && (
        <SaveToNoteDialog
          content={savingNoteContent}
          onSave={() => setSavingNoteContent(null)}
          onClose={() => setSavingNoteContent(null)}
        />
      )}

      {/* Bottom sliding Drawer for Pinned Context (Sidepanel-only) */}
      <Drawer
        placement="bottom"
        closable={false}
        open={pinnedContextOpen}
        onClose={() => setPinnedContextOpen(false)}
        styles={{
          wrapper: {
            height: '80%',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
            overflow: 'hidden',
          },
          body: {
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            overflow: 'hidden',
          },
        }}
      >
        {/* Pull bar capsule */}
        <div style={{ width: 36, height: 4, backgroundColor: 'var(--ant-color-border-secondary)', borderRadius: 2, margin: '0 auto 8px', flexShrink: 0 }} />

        {/* Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: 8, flexShrink: 0 }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: 'var(--ant-color-text)' }}>
            Pinned context
          </span>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={() => setPinnedContextOpen(false)}
          />
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Section: Currently Pinned */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ant-color-text-description)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              Currently pinned ({pinnedTabs.length})
            </div>
            {pinnedTabs.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 16px', border: '1px dashed var(--ant-color-border-secondary)', borderRadius: 12, backgroundColor: 'var(--ant-color-fill-alter)' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: 'var(--ant-color-fill-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                  <PushpinOutlined style={{ fontSize: 20, color: 'var(--ant-color-text-description)' }} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4, color: 'var(--ant-color-text)' }}>No pinned context yet</div>
                <div style={{ fontSize: 12, color: 'var(--ant-color-text-description)', textAlign: 'center' }}>
                  Pin browser tabs to inject their content into the next AI request.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pinnedTabs.map((tab) => (
                  <div key={tab.tabId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--ant-color-border-secondary)', borderRadius: 12, backgroundColor: 'var(--ant-color-bg-container)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, paddingRight: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: 'var(--ant-color-fill-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <GlobalOutlined style={{ fontSize: 16, color: 'var(--ant-color-text-secondary)' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--ant-color-text)' }}>{tab.title || tab.page?.title || 'Untitled Tab'}</div>
                        <div style={{ fontSize: 11, color: 'var(--ant-color-text-description)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{tab.url || tab.page?.url}</div>
                      </div>
                    </div>
                    <Button
                      size="small"
                      icon={<PushpinOutlined />}
                      onClick={() => handleUnpinTab(tab.tabId)}
                      style={{ borderRadius: 6 }}
                    >
                      Unpin
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section: Available Tabs */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ant-color-text-description)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              Available tabs ({availableTabs.length})
            </div>
            
            <Input
              placeholder="Search open tabs..."
              prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-quaternary)' }} />}
              value={tabSearchQuery}
              onChange={(e) => setTabSearchQuery(e.target.value)}
              style={{ borderRadius: 8, marginBottom: 12 }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {availableTabs
                .filter((tab) => {
                  if (!tabSearchQuery) return true;
                  const query = tabSearchQuery.toLowerCase();
                  return (
                    (tab.title && tab.title.toLowerCase().includes(query)) ||
                    (tab.url && tab.url.toLowerCase().includes(query))
                  );
                })
                .slice(0, 15) // Limit to top 15 results for clean performance
                .map((tab) => {
                  const isPinned = pinnedTabs.some((t) => t.tabId === tab.id);
                  return (
                    <div key={tab.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--ant-color-border-secondary)', borderRadius: 12, backgroundColor: 'var(--ant-color-bg-container)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, paddingRight: 8 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 6, backgroundColor: 'var(--ant-color-fill-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <GlobalOutlined style={{ fontSize: 16, color: 'var(--ant-color-text-secondary)' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 500, fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: 'var(--ant-color-text)' }}>{tab.title || 'Untitled Tab'}</div>
                          <div style={{ fontSize: 11, color: 'var(--ant-color-text-description)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{tab.url}</div>
                        </div>
                      </div>
                      {isPinned ? (
                        <Button
                          size="small"
                          icon={<PushpinOutlined />}
                          onClick={() => handleUnpinTab(tab.id)}
                          style={{ borderRadius: 6 }}
                        >
                          Unpin
                        </Button>
                      ) : (
                        <Button
                          type="primary"
                          size="small"
                          icon={<PushpinOutlined />}
                          onClick={() => handlePinTab(tab)}
                          style={{ borderRadius: 6, backgroundColor: '#0066cc', borderColor: '#0066cc' }}
                        >
                          Pin
                        </Button>
                      )}
                    </div>
                  );
                })}
              {availableTabs.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ant-color-text-description)', fontSize: 12 }}>
                  No open browser tabs found.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer done button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--ant-color-border-secondary)', paddingTop: 12, marginTop: 'auto', flexShrink: 0 }}>
          <Button
            type="primary"
            onClick={() => setPinnedContextOpen(false)}
            style={{ minWidth: 80, borderRadius: 6, backgroundColor: '#0066cc', borderColor: '#0066cc' }}
          >
            Done
          </Button>
        </div>
      </Drawer>
    </div>
  );
}
