import { useState, useEffect } from 'react';
import {
  ChatSession,
  Message,
  ProviderConfig,
  PromptItem,
  Attachment,
  TabItem,
} from '../types';

const INITIAL_PROMPTS: PromptItem[] = [
  { id: '1', title: 'Summarize', content: 'Provide a concise summary of the following text with key bullet points:', category: 'Reading', showInList: true, icon: 'FileText' },
  { id: '2', title: 'Translate into: British English', content: 'Translate the following text into natural, idiomatic British English:', category: 'Writing', showInList: true, targetLang: 'British English', icon: 'Languages' },
  { id: '3', title: 'Improve writing', content: 'Polishing and enhance the clarity, tone, and flow of the following text:', category: 'Writing', showInList: true, icon: 'Edit3' },
  { id: '4', title: 'Fix spelling & grammar', content: 'Correct all spelling and grammatical errors while preserving original tone:', category: 'Writing', showInList: true, icon: 'CheckCircle' },
  { id: '5', title: 'Answer this question', content: 'Answer the question directly based on context and facts:', category: 'Chat/Ask', showInList: true, icon: 'HelpCircle' },
  { id: '6', title: 'Explain codes', content: 'Explain this code snippet line by line with clear examples:', category: 'Reading', showInList: true, icon: 'Code' },
  { id: '7', title: 'Find action items', content: 'Extract all actionable tasks, assignments, and follow-ups:', category: 'Reading', showInList: true, icon: 'ListCheck' },
  { id: '8', title: 'Make shorter', content: 'Condense this message into half its current length without losing key facts:', category: 'Writing', showInList: true, icon: 'Minimize2' },
  { id: '9', title: 'For YouTube', content: 'Generate YouTube video titles, description, and key chapter timestamps:', category: 'Chat/Ask', showInList: false, icon: 'Youtube' },
  { id: '10', title: 'Paragraph about...', content: 'Write a compelling paragraph explaining:', category: 'Writing', showInList: false },
  { id: '11', title: 'Social media post...', content: 'Create an engaging social media post with hashtags:', category: 'Writing', showInList: false },
  { id: '12', title: 'Press release', content: 'Draft a professional press release announcement:', category: 'Writing', showInList: false },
  { id: '13', title: 'Creative story', content: 'Write a creative short story based on these themes:', category: 'Writing', showInList: false },
  { id: '14', title: 'To-do list...', content: 'Turn this description into a categorized to-do list:', category: 'Writing', showInList: false },
  { id: '15', title: 'Meeting agenda...', content: 'Create a structured meeting agenda with time blocks:', category: 'Writing', showInList: false },
];

const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: 's1',
    title: 'could you please remove "done" button from pinned...',
    preview: 'Please provide the context, code, or screenshot you are referring to...',
    createdAt: Date.now() - 3600000,
    updatedAt: Date.now() - 3600000,
    isStarred: false,
    group: 'Today',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'could you please remove "done" button from pinned context model?',
        timestamp: Date.now() - 3600000,
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'To apply the requested UI/UX changes (removing the "done" button, using an "x" icon to close, moving the "clear all" icon, and applying style changes), I need the actual component, code, or screenshot you are referring to.\n\nPlease provide the following so I can make the changes:\n1. The relevant code snippet\n2. A screenshot or mockup of the current UI element.',
        timestamp: Date.now() - 3500000,
        model: 'gemma-4-e2b-it-4bit',
      }
    ]
  },
  {
    id: 's2',
    title: 'are you able to scan the captured HTML for all clas...',
    preview: 'Yes—if you paste the HTML (or a captured snippet), I can scan...',
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 7200000,
    isStarred: false,
    group: 'Today',
    messages: [
      {
        id: 'm3',
        role: 'user',
        content: 'are you able to scan the captured HTML for all classes?',
        timestamp: Date.now() - 7200000,
      },
      {
        id: 'm4',
        role: 'assistant',
        content: 'Yes—if you paste the HTML (or a captured snippet), I can scan all classes and extract a clean list or CSS breakdown for you!',
        timestamp: Date.now() - 7100000,
        model: 'gemma-4-e2b-it-4bit',
      }
    ]
  },
  {
    id: 's3',
    title: 'hello',
    preview: 'Hello! How can I help you today?',
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2,
    isStarred: true,
    group: 'This Week',
    messages: [
      { id: 'm5', role: 'user', content: 'hello', timestamp: Date.now() - 86400000 * 2 },
      { id: 'm6', role: 'assistant', content: 'Hello! How can I help you today?', timestamp: Date.now() - 86400000 * 2 + 1000, model: 'gemma-4-e2b-it-4bit' }
    ]
  },
  {
    id: 's4',
    title: 'Hi',
    preview: 'Hello! How can I help you today?',
    createdAt: Date.now() - 86400000 * 15,
    updatedAt: Date.now() - 86400000 * 15,
    isStarred: true,
    group: 'This Month',
    messages: [
      { id: 'm7', role: 'user', content: 'Hi', timestamp: Date.now() - 86400000 * 15 },
      { id: 'm8', role: 'assistant', content: 'Hello! How can I help you today?', timestamp: Date.now() - 86400000 * 15 + 1000, model: 'gemma-4-e2b-it-4bit' }
    ]
  },
  {
    id: 's5',
    title: 'hi',
    preview: 'Hi. What can I help you with?',
    createdAt: Date.now() - 86400000 * 18,
    updatedAt: Date.now() - 86400000 * 18,
    isStarred: false,
    group: 'This Month',
    messages: [
      { id: 'm9', role: 'user', content: 'hi', timestamp: Date.now() - 86400000 * 18 },
      { id: 'm10', role: 'assistant', content: 'Hi. What can I help you with?', timestamp: Date.now() - 86400000 * 18 + 1000, model: 'gemma-4-e2b-it-4bit' }
    ]
  }
];

const DEFAULT_CONFIG: ProviderConfig = {
  serviceProvider: 'Custom API Key',
  activeProvider: 'openai',
  providers: {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      isConfigured: true,
      enabled: false,
      apiKey: 'sk-proj-openai-sample-key',
      useCustomProxy: true,
      proxyUrl: 'http://localhost:12380/v1',
      models: [
        { id: 'Qwen3.5-9B-OptiQ-4bit', name: 'Qwen3.5-9B-OptiQ-4bit', enabled: false },
        { id: 'Qwythos-9B-Claude-Mythos-5-1M-mxfp4-mlx', name: 'Qwythos-9B-Claude-Mythos-5-1M-mxfp4-mlx', enabled: true },
        { id: 'gemma-4-e2b-it-4bit', name: 'gemma-4-e2b-it-4bit', enabled: false },
      ],
    },
    gemini: {
      id: 'gemini',
      name: 'Google (Gemini)',
      isConfigured: false,
      enabled: false,
      apiKey: '',
      useCustomProxy: false,
      proxyUrl: 'https://generativelanguage.googleapis.com',
      models: [],
    },
    ollama: {
      id: 'ollama',
      name: 'Ollama',
      isConfigured: false,
      enabled: false,
      apiKey: '',
      useCustomProxy: true,
      proxyUrl: 'http://localhost:11434',
      models: [],
    },
    claude: {
      id: 'claude',
      name: 'Anthropic (Claude)',
      isConfigured: true,
      enabled: true,
      apiKey: 'sk-ant-sample-key',
      useCustomProxy: false,
      proxyUrl: 'https://api.anthropic.com',
      models: [
        { id: 'claude-3-5-sonnet-20241022', name: 'claude-3-5-sonnet', enabled: true },
        { id: 'claude-3-5-haiku-20241022', name: 'claude-3-5-haiku', enabled: true },
      ],
    },
  },
  openAiKey: 'sk-proj-openai-sample-key',
  openAiBaseUrl: 'http://localhost:12380/v1',
  geminiKey: '',
  selectedModel: 'Qwythos-9B-Claude-Mythos-5-1M-mxfp4-mlx',
  fontSize: 'Auto',
  themeMode: 'Auto',
  language: 'English',
  sidepanelPosition: 'Right',
  chatGptWebappEnabled: true,
  translateService: 'MiniCPM5-1B-OptiQ-4bit',
  translateTargetLang: 'English',
  translateDisplayMode: 'Bilingual',
  translateDisplayStyle: 'Underline',
};

const INITIAL_TABS: TabItem[] = [
  { id: 't1', title: 'GitHub - google/llm-sidebar... • Current tab', url: 'https://github.com/google/llm-sidebar', selected: true, isCurrent: true },
  { id: 't2', title: 'GitHub - kepano/defuddle: Get the main ...', url: 'https://github.com/kepano/defuddle', selected: true },
  { id: 't3', title: 'Privacy: Notebook Clipper — Web Clippe...', url: 'https://chrome.google.com/webstore', selected: true },
];

export function useExtensionStore() {
  const [config, setConfig] = useState<ProviderConfig>(() => {
    const saved = localStorage.getItem('nowpilot_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          ...DEFAULT_CONFIG,
          ...parsed,
          providers: {
            ...DEFAULT_CONFIG.providers,
            ...(parsed.providers || {}),
          },
        };
      } catch {
        return DEFAULT_CONFIG;
      }
    }
    return DEFAULT_CONFIG;
  });

  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('nowpilot_sessions');
    return saved ? JSON.parse(saved) : INITIAL_SESSIONS;
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    return sessions[0]?.id || 's1';
  });

  const [prompts, setPrompts] = useState<PromptItem[]>(() => {
    const saved = localStorage.getItem('nowpilot_prompts');
    return saved ? JSON.parse(saved) : INITIAL_PROMPTS;
  });

  const [activeAttachments, setActiveAttachments] = useState<Attachment[]>([]);
  const [availableTabs, setAvailableTabs] = useState<TabItem[]>(INITIAL_TABS);

  useEffect(() => {
    localStorage.setItem('nowpilot_config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('nowpilot_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('nowpilot_prompts', JSON.stringify(prompts));
  }, [prompts]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

  const updateConfig = (updates: Partial<ProviderConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const createNewSession = () => {
    const newId = 's_' + Date.now();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat',
      preview: 'Ask anything...',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isStarred: false,
      group: 'Today',
      messages: [],
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newId);
    setActiveAttachments([]);
    return newId;
  };

  const addMessageToActiveSession = (msg: Message) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const updatedMsgs = [...s.messages, msg];
        const title = s.messages.length === 0 ? (msg.content.slice(0, 35) || 'New Chat') : s.title;
        const preview = msg.content.slice(0, 50);
        return {
          ...s,
          title,
          preview,
          updatedAt: Date.now(),
          messages: updatedMsgs,
        };
      }
      return s;
    }));
  };

  const updateLastAssistantMessage = (contentChunk: string, thoughtChunk?: string, isDone?: boolean) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const msgs = [...s.messages];
        if (msgs.length === 0) return s;
        const lastIdx = msgs.length - 1;
        const lastMsg = msgs[lastIdx];
        if (lastMsg.role === 'assistant') {
          const updatedContent = lastMsg.content + contentChunk;
          const updatedThought = (lastMsg.thoughtProcess || '') + (thoughtChunk || '');
          const existingVersions = lastMsg.versions && lastMsg.versions.length > 0 ? [...lastMsg.versions] : [updatedContent];
          const curIdx = lastMsg.currentVersionIndex ?? (existingVersions.length - 1);
          existingVersions[curIdx] = updatedContent;

          msgs[lastIdx] = {
            ...lastMsg,
            content: updatedContent,
            thoughtProcess: updatedThought,
            isThinking: !isDone,
            versions: existingVersions,
            currentVersionIndex: curIdx,
          };
        }
        return { ...s, messages: msgs };
      }
      return s;
    }));
  };

  const regenerateMessageInActiveSession = (msgId: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const msgs = s.messages.map(m => {
          if (m.id === msgId && m.role === 'assistant') {
            const existingVersions = m.versions && m.versions.length > 0 ? m.versions : [m.content];
            const vNum = existingVersions.length + 1;
            const newStandaloneContent = `Here is alternative response variant ${vNum} with a fresh perspective, highlighted key takeaways, and concise action steps tailored to your active query and context.`;
            const updatedVersions = [...existingVersions, newStandaloneContent];
            const newIndex = updatedVersions.length - 1;
            return {
              ...m,
              versions: updatedVersions,
              currentVersionIndex: newIndex,
              content: newStandaloneContent,
            };
          }
          return m;
        });
        return { ...s, messages: msgs };
      }
      return s;
    }));
  };

  const switchMessageVersion = (msgId: string, delta: number) => {
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const msgs = s.messages.map(m => {
          if (m.id === msgId && m.versions && m.versions.length > 0) {
            const currentIdx = m.currentVersionIndex ?? (m.versions.length - 1);
            const nextIdx = Math.max(0, Math.min(m.versions.length - 1, currentIdx + delta));
            return {
              ...m,
              currentVersionIndex: nextIdx,
              content: m.versions[nextIdx],
            };
          }
          return m;
        });
        return { ...s, messages: msgs };
      }
      return s;
    }));
  };

  const toggleStarSession = (id: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, isStarred: !s.isStarred } : s));
  };

  const deleteSession = (id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (activeSessionId === id && filtered.length > 0) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const updateSessionTitle = (id: string, newTitle: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  };

  const clearAllSessions = () => {
    setSessions([]);
    createNewSession();
  };

  const addAttachment = (attachment: Attachment) => {
    setActiveAttachments(prev => [...prev.filter(a => a.id !== attachment.id), attachment]);
  };

  const removeAttachment = (id: string) => {
    setActiveAttachments(prev => prev.filter(a => a.id !== id));
  };

  const addPrompt = (prompt: PromptItem) => {
    setPrompts(prev => [prompt, ...prev]);
  };

  const updatePrompt = (id: string, updates: Partial<PromptItem>) => {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const deletePrompt = (id: string) => {
    setPrompts(prev => prev.filter(p => p.id !== id));
  };

  const toggleTabSelection = (tabId: string) => {
    setAvailableTabs(prev => prev.map(t => t.id === tabId ? { ...t, selected: !t.selected } : t));
  };

  return {
    config,
    updateConfig,
    sessions,
    activeSession,
    activeSessionId,
    setActiveSessionId,
    createNewSession,
    addMessageToActiveSession,
    updateLastAssistantMessage,
    regenerateMessageInActiveSession,
    switchMessageVersion,
    toggleStarSession,
    deleteSession,
    updateSessionTitle,
    clearAllSessions,
    prompts,
    addPrompt,
    updatePrompt,
    deletePrompt,
    activeAttachments,
    setActiveAttachments,
    addAttachment,
    removeAttachment,
    availableTabs,
    toggleTabSelection,
  };
}
