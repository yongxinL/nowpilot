export type ProviderType = 'openai' | 'gemini' | 'webapp' | 'claude';

export interface ModelOption {
  id: string;
  name: string;
  provider: ProviderType;
  group?: string;
  description?: string;
}

export interface Attachment {
  id: string;
  type: 'image' | 'tab' | 'quote' | 'screen_cut' | 'document';
  title: string;
  content?: string;
  url?: string;
  thumbnail?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  thoughtProcess?: string;
  timestamp: number;
  attachments?: Attachment[];
  model?: string;
  isThinking?: boolean;
  isStreaming?: boolean;
  followups?: string[];
  versions?: string[];
  currentVersionIndex?: number;
}

export type HistoryGroup = 'Today' | 'Yesterday' | 'This Week' | 'This Month' | 'Older';

export interface ChatSession {
  id: string;
  title: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
  isStarred?: boolean;
  group: HistoryGroup;
  messages: Message[];
}

export type PromptCategory = 'Chat/Ask' | 'Reading' | 'Writing' | 'Reply';

export interface PromptItem {
  id: string;
  title: string;
  content: string;
  category: PromptCategory;
  usedIn?: PromptCategory[];
  icon?: string;
  showInList: boolean;
  categoryVisibility?: Partial<Record<PromptCategory, boolean>>;
  categoryOrder?: Partial<Record<PromptCategory, number>>;
  isCustom?: boolean;
  order?: number;
  shortcut?: string;
  targetLang?: string;
  formatType?: string; // Optional format tag like 'Essay', 'Paragraph', 'Email', etc.
}

export interface WriteHistoryItem {
  id: string;
  type: 'write' | 'reply';
  title: string;
  format: string;
  input: string;
  originalText?: string;
  responseIdea?: string;
  output: string;
  versions?: string[];
  currentVersionIndex?: number;
  model: string;
  tone: string;
  length: string;
  language: string;
  createdAt: number;
}

export interface TabItem {
  id: string;
  title: string;
  url: string;
  iconUrl?: string;
  isCurrent?: boolean;
  selected?: boolean;
}

export type CustomProviderId = 'openai' | 'gemini' | 'ollama' | 'claude';

export interface CustomModelItem {
  id: string;
  name: string;
  enabled: boolean;
  isCustom?: boolean;
}

export interface CustomProviderDetail {
  id: CustomProviderId;
  name: string;
  isConfigured: boolean;
  enabled: boolean;
  apiKey: string;
  useCustomProxy: boolean;
  proxyUrl: string;
  models: CustomModelItem[];
}

export interface ProviderConfig {
  serviceProvider: string;
  activeProvider: 'openai' | 'gemini' | 'webapp' | 'ollama' | 'claude';
  providers: Record<CustomProviderId, CustomProviderDetail>;
  openAiKey: string;
  openAiBaseUrl: string;
  geminiKey: string;
  selectedModel: string;
  fontSize: 'Small' | 'Regular' | 'Large' | 'Auto';
  themeMode: 'Auto' | 'Light' | 'Dark';
  colorTheme?: string;
  language: string;
  sidepanelPosition: 'Right' | 'Left';
  chatGptWebappEnabled: boolean;
  translateService?: string;
  translateTargetLang?: 'English' | 'Simplified Chinese' | 'Traditional Chinese' | 'Japanese';
  translateDisplayMode?: 'Bilingual' | 'Translation only';
  translateDisplayStyle?: 'None' | 'Underline' | 'Weaken';
}

export type ToolCategory = 'Reading' | 'Agents' | 'Translate' | 'Image';

export interface ToolItem {
  id: string;
  name: string;
  category: ToolCategory;
  iconName: string;
  badge?: 'hot' | 'new';
  description: string;
}

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
