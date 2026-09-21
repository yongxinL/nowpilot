/**
 * The four canonical provider identifiers (UI-SPEC § Onboarding; Appendix C).
 *
 * The `const` tuple is the runtime membership list and `ProviderId` is derived
 * from it, so the union and the `Select` options cannot drift apart. The
 * prototype's non-canonical `'claude'` spelling is **not** a member and must not
 * be reintroduced as an alias — plan `01-11` removes its last consumer.
 */
export const PROVIDER_IDS = ['openai', 'anthropic', 'gemini', 'ollama'] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

/**
 * The non-secret persisted provider configuration (D-07).
 *
 * Phase 1 may persist provider **metadata** only: identifier, display name,
 * enabled/configured state, a non-secret proxy URL and the model list. There is
 * deliberately no field that can carry a credential, a masked fragment, a
 * fingerprint or a derived value — the persisted schema has nowhere to put one.
 */
export interface PersistedProviderConfig {
  id: ProviderId;
  name: string;
  enabled: boolean;
  isConfigured: boolean;
  useCustomProxy: boolean;
  proxyUrl: string;
  models: CustomModelItem[];
}

/**
 * The in-memory onboarding credential input (D-08).
 *
 * This value exists only in component memory: it is never persisted, logged,
 * broadcast or rendered. The field is named `credential` deliberately — the
 * recognised **persisted**-credential field names (`apiKey`, `token`,
 * `accessToken`, `secret`) are exactly what plans `01-10`/`01-11` delete and
 * scan for, so reusing one here would make a compliant in-memory type
 * indistinguishable from a forbidden persisted field.
 */
export interface TransientCredentialInput {
  providerId: ProviderId;
  credential: string;
}

// LEGACY — prototype provider types with live importers; removed with their last consumer in plan 01-11.
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

// LEGACY — prototype provider id set (`'claude'`, no `'anthropic'`); removed with its last consumer in plan 01-11.
export type CustomProviderId = 'openai' | 'gemini' | 'ollama' | 'claude';

export interface CustomModelItem {
  id: string;
  name: string;
  enabled: boolean;
  isCustom?: boolean;
}

// LEGACY — credential-bearing prototype provider detail; its `apiKey` field is stripped in plan 01-11.
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

export type WorkflowId = 'general' | 'coding' | 'writing' | 'research' | 'speed';

export interface WorkflowDefinition {
  id: WorkflowId;
  name: string;
  tagline: string;
  description: string;
  defaultModelId?: string;
}

// LEGACY — the credential-bearing persisted provider config (`openAiKey`, `geminiKey`, `providers[*].apiKey`); replaced by the non-secret types in plan 01-11.
export interface ProviderConfig {
  serviceProvider: string;
  activeProvider: 'openai' | 'gemini' | 'webapp' | 'ollama' | 'claude';
  providers: Record<CustomProviderId, CustomProviderDetail>;
  openAiKey: string;
  openAiBaseUrl: string;
  geminiKey: string;
  selectedModel: string;
  selectedWorkflow?: WorkflowId;
  workflowModelMapping?: Partial<Record<WorkflowId, string>>;
  fontSize: 'Small' | 'Regular' | 'Large' | 'Auto';
  themeMode: 'Auto' | 'Light' | 'Dark';
  colorTheme?: string;
  language: string;
  sidepanelPosition: 'Right' | 'Left';
  chatGptWebappEnabled: boolean;
  // D-12: explicit flag controlling whether `simulateStreamResponse` (the
  // canned critical-thinking / "Good morning" response) is reachable.
  // The flag is gated by `import.meta.env.DEV` at the simulator call
  // sites — neither flag alone is sufficient. Default: false (no demo).
  demoMode?: boolean;
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
