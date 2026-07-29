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
  followups?: string[];
  versions?: string[];
  currentVersionIndex?: number;
}

export type HistoryGroup = 'Today' | 'This Week' | 'This Month' | 'Older';

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

export type PromptCategory = 'Chat/Ask' | 'Reading' | 'Writing';

export interface PromptItem {
  id: string;
  title: string;
  content: string;
  category: PromptCategory;
  icon?: string;
  showInList: boolean;
  shortcut?: string;
  targetLang?: string;
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
  appTheme?: string;
  themeMode: string;
  displayMode?: 'auto' | 'light' | 'dark';
  themeId?: 'system' | 'ant-design-blue' | 'liquid-glass' | 'claude';
  accentColor?: string;
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
