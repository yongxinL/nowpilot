import React, { useState, useEffect, useMemo, useRef } from 'react';
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
} from '@ant-design/icons';
import { useChat } from '../../hooks/useChat';
import { useWorkspaceStore } from '../../core/stores/workspaceStore';
import { useProviderStore } from '../../core/stores/providerStore';
import { providerRegistry } from '../../core/ai/providers/ProviderRegistry';
import { slashCommandRegistry } from '../../core/slash/SlashCommandRegistry';
import { promptManager } from '../../core/prompts/PromptManager';
import { templateEngine } from '../../core/prompts/TemplateEngine';
import type { PromptTemplate } from '../../core/prompts/PromptManager';
// Unused ConversationSidebar removed for standalone drawer integration
import { SaveToNoteDialog } from '../../components/notes/SaveToNoteDialog';

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

const QuoteIcon = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
    <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/>
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
  } = useChat();

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [quotedMessage, setQuotedMessage] = useState<any | null>(null);
  const [savingNoteContent, setSavingNoteContent] = useState<string | null>(null);
  const [activeReadAloudId, setActiveReadAloudId] = useState<string | null>(null);

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
    switchConversation(conv.id);
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
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            message.success(`Attached file: ${e.target.files[0].name}`);
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
          {isEmpty ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: 8,
              }}
            >
              <Text type="secondary" style={{ fontSize: 16, fontWeight: 500 }}>
                Hi, How can I assist you today?
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Select a model and start a conversation.
              </Text>
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
                              item.content
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
                {bubbleItems.map((item) => {
                  const isUser = item.role === 'user';
                  const isEditing = editingMessageId === item.key;
                  
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
                            content={
                              isUser ? (
                                item.content
                              ) : item.stage && item.stage !== 'idle' && !item.content ? (
                                <Think
                                  title={(() => {
                                    switch (item.stage) {
                                      case 'retrieving': return 'Retrieving context ...';
                                      case 'planning':   return 'Planning ...';
                                      case 'thinking':   return 'Thinking ...';
                                      case 'tool':       return item.currentTool ? `Running tool: ${item.currentTool}` : 'Running tool ...';
                                      case 'generating': return 'Generating ...';
                                      default:           return '';
                                    }
                                  })()}
                                  loading
                                  blink
                                  defaultExpanded={!!(item.stage === 'thinking' && item.reasoning)}
                                >
                                  {item.stage === 'thinking' && item.reasoning
                                    ? item.reasoning
                                    : item.stage === 'tool' && item.currentTool
                                    ? `Executing ${item.currentTool} ...`
                                    : item.stage === 'retrieving'
                                    ? 'Searching memory and notes for relevant context ...'
                                    : item.stage === 'planning'
                                    ? 'Determining the best approach ...'
                                    : item.stage === 'generating'
                                    ? 'Writing the final response ...'
                                    : null}
                                </Think>
                              ) : item.content ? (
                                <>
                                  {item.reasoning ? (
                                    <Think
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
                                  />
                                </>
                              ) : null
                            }
                          />

                          {/* Action Panel: Always rendered to reserve space — visibility toggled to avoid layout shift */}
                          <div
                            style={{
                              marginTop: '6px',
                              height: '28px',
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
                                padding: '2px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                height: '28px',
                              }}
                            >
                              {isUser ? (
                                // User Message Action Buttons: Edit, Copy, Quote, Share, Speak loud
                                <>
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<EditOutlined style={{ fontSize: 12 }} />}
                                    onClick={() => {
                                      setEditingMessageId(item.key);
                                      setEditContent(item.content);
                                    }}
                                    title="Edit"
                                  />
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<CopyOutlined style={{ fontSize: 12 }} />}
                                    onClick={() => handleCopy(item.content)}
                                    title="Copy"
                                  />
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<QuoteIcon />}
                                    onClick={() => {
                                      setQuotedMessage(item);
                                      message.info('Message quoted.');
                                    }}
                                    title="Quote"
                                  />
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<ShareAltOutlined style={{ fontSize: 12 }} />}
                                    onClick={() => handleShare(item.content)}
                                    title="Share"
                                  />
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<SoundOutlined style={{ fontSize: 12, color: activeReadAloudId === item.key ? '#e0582e' : undefined }} />}
                                    onClick={() => handleReadAloud(item.content, item.key)}
                                    title="Speak loud"
                                  />
                                </>
                              ) : (
                                // Response Message Action Buttons: Copy, Save as a note, Regenerate, Quote, Share, Speak loud
                                <>
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<CopyOutlined style={{ fontSize: 12 }} />}
                                    onClick={() => handleCopy(item.content)}
                                    title="Copy"
                                  />
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<FileTextOutlined style={{ fontSize: 12 }} />}
                                    onClick={() => setSavingNoteContent(item.content)}
                                    title="Save as a note"
                                  />
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<SyncOutlined style={{ fontSize: 12 }} />}
                                    onClick={() => handleRegenerate(item.key)}
                                    title="Regenerate response"
                                    disabled={isStreaming}
                                  />
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<QuoteIcon />}
                                    onClick={() => {
                                      setQuotedMessage(item);
                                      message.info('Message quoted.');
                                    }}
                                    title="Quote"
                                  />
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<ShareAltOutlined style={{ fontSize: 12 }} />}
                                    onClick={() => handleShare(item.content)}
                                    title="Share"
                                  />
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<SoundOutlined style={{ fontSize: 12, color: activeReadAloudId === item.key ? '#e0582e' : undefined }} />}
                                    onClick={() => handleReadAloud(item.content, item.key)}
                                    title="Speak loud"
                                  />
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
        </div>

        {/* Action Controls Bar above Input box */}
        {!isExportMode && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 16px',
              borderTop: '1px solid var(--ant-color-border-secondary)',
              background: 'var(--ant-color-bg-container)',
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
                  borderRadius: '16px',
                  background: 'var(--ant-color-bg-container)',
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

              <Button
                type="text"
                icon={<ScissorOutlined style={{ fontSize: 16 }} />}
                onClick={handleScreenCut}
                title="Screen cut"
              />
              <Button
                type="text"
                icon={<FolderAddOutlined style={{ fontSize: 16 }} />}
                onClick={() => fileInputRef.current?.click()}
                title="Attach image/File"
              />
            </div>

            {/* Icons Group */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Button
                type="text"
                icon={<ClockCircleOutlined style={{ fontSize: 16 }} />}
                onClick={() => setChatHistoryOpen(true)}
                title="Chat history"
              />
              <Button
                type="text"
                icon={<PlusSquareFilled style={{ fontSize: 18, color: '#e0582e' }} />}
                onClick={handleNewChat}
                title="New chat"
              />
            </div>
          </div>
        )}

        {/* Sender Component */}
        {!isExportMode && (
          <div
            style={{
              padding: '8px 16px 16px',
              borderTop: '1px solid var(--ant-color-border-secondary)',
              minHeight: '120px',
              position: 'relative',
            }}
          >
            {quotedMessage && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '12px',
                  background: 'var(--ant-color-bg-layout)',
                  borderLeft: '4px solid #e0582e',
                  borderRadius: '8px',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                {/* Header with Close icon */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--ant-color-text-description)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Quoted {quotedMessage.role === 'user' ? 'User' : 'Assistant'} Message
                  </span>
                  <Button
                    type="text"
                    size="small"
                    icon={<CloseOutlined style={{ fontSize: '10px' }} />}
                    onClick={() => setQuotedMessage(null)}
                    style={{ height: '20px', width: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  />
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

            {/* Prompt list shown between quoted text and input box */}
            {quotedMessage && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  marginBottom: '12px',
                  padding: '0 4px',
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
              onSubmit={(msg) => send(msg)}
              onCancel={abort}
              placeholder="Ask anything, @ models, / prompts... (type / for commands)"
              autoSize={{ minRows: 4, maxRows: 8 }}
              style={{ minHeight: '120px' }}
            />
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
    </div>
  );
}
