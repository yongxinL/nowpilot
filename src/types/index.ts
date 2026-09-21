/**
 * The four canonical provider identifiers (UI-SPEC § Onboarding; Appendix C).
 *
 * The `const` tuple is the runtime membership list and `ProviderId` is derived
 * from it, so the union and the `Select` options cannot drift apart. Plan
 * `01-11` deleted the prototype's two legacy provider identifier unions
 * (`ProviderType`, `CustomProviderId`) together with their last consumers, so
 * this is the only provider identifier union in the repository.
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
 * recognised **persisted**-credential field names that plans `01-10`/`01-11`
 * delete and scan for were deliberately not reused here, so a compliant
 * in-memory type is distinguishable from a forbidden persisted field by name
 * alone. (Do not restate those spellings in this file: plan `01-11`'s teardown
 * scan reads this directory for them.)
 */
export interface TransientCredentialInput {
  providerId: ProviderId;
  credential: string;
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

export interface CustomModelItem {
  id: string;
  name: string;
  enabled: boolean;
  isCustom?: boolean;
}

// LEGACY — the prototype per-provider detail. Plan `01-11` removed its
// credential-bearing field and moved it onto the canonical `ProviderId`; the
// surviving non-secret metadata shape is preserved until Phase 15 replaces the
// prototype Options presentation with `PersistedProviderConfig`.
export interface CustomProviderDetail {
  id: ProviderId;
  name: string;
  isConfigured: boolean;
  enabled: boolean;
  useCustomProxy: boolean;
  proxyUrl: string;
  models: CustomModelItem[];
}

// LEGACY — the prototype persisted `np_store` provider configuration. Plan
// `01-11` stripped every credential-bearing and model-identifier field from it
// (the store migration drops them from an existing blob); the remaining
// non-secret preferences are preserved for the fixture-backed Options
// presentation. `PersistedProviderConfig` is the canonical persisted provider
// shape for later phases.
export interface ProviderConfig {
  serviceProvider: string;
  activeProvider: ProviderId;
  providers: Record<ProviderId, CustomProviderDetail>;
  openAiBaseUrl: string;
  fontSize: 'Small' | 'Regular' | 'Large' | 'Auto';
  colorTheme?: string;
  language: string;
  sidepanelPosition: 'Right' | 'Left';
  chatGptWebappEnabled: boolean;
  // D-12: explicit flag controlling whether a demo response is reachable. The
  // flag is gated by `import.meta.env.DEV` at the call sites — neither flag
  // alone is sufficient. Default: false (no demo).
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
