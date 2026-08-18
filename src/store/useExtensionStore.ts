import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { chromeStorageAdapter } from '../core/theme/chromeStorageAdapter';
import { useThemeStore, type ThemeMode } from '../core/theme/ThemeStore';
import { DEFAULT_PROMPTS_LIST } from '../components/options/defaultPromptsData';
import type {
  ChatSession,
  Message,
  ProviderConfig,
  PromptItem,
  Attachment,
  TabItem,
  WriteHistoryItem,
  NoteItem,
} from '../types';

const INITIAL_PROMPTS: PromptItem[] = DEFAULT_PROMPTS_LIST;

const DEFAULT_CONFIG: ProviderConfig = {
  serviceProvider: 'Custom API Key',
  activeProvider: 'openai',
  providers: {
    openai: {
      id: 'openai',
      name: 'OpenAI',
      isConfigured: false,
      enabled: false,
      apiKey: '',
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
      isConfigured: false,
      enabled: false,
      apiKey: '',
      useCustomProxy: false,
      proxyUrl: 'https://api.anthropic.com',
      models: [],
    },
  },
  openAiKey: '',
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

const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: 's_critical_thinking',
    title: 'please give me a summary for critical thinking',
    preview: 'Summary of Critical Thinking: Analysis, Evaluation, Assumptions...',
    group: 'Today',
    createdAt: Date.now() - 1000 * 60 * 10,
    updatedAt: Date.now() - 1000 * 60 * 2,
    isStarred: false,
    messages: [
      {
        id: 'm_crit_u1',
        role: 'user',
        content: 'please give me a summary for critical thinking',
        attachments: [
          {
            id: 'att_quote_1',
            type: 'quote',
            title: 'Quoted Text',
            content: 'This is a fantastic topic. Critical thinking is not just about being smart; it is about thinking objectively and evaluating evidence.',
          },
        ],
        timestamp: Date.now() - 1000 * 60 * 10,
      },
      {
        id: 'm_crit_a1',
        role: 'assistant',
        model: 'gemma-4-E2B-it-MLX-4bit',
        thoughtProcess: `1. **Deconstruct User Prompt**: Identifying key objectives for critical thinking breakdown.
2. **Define Critical Thinking (The Core Concept)**: What is it?
   • It's not just thinking; it's disciplined thinking.
   • It involves analyzing information objectively and making reasoned judgments.
   • It's about questioning assumptions.
3. **Identify Key Components/Skills (The How-To)**: What does critical thinking entail in practice?
   • Analysis & Credibility Evaluation
   • Identifying Assumptions & Spotting Biases
   • Logical Reasoning & Argument Construction
4. **Formulate Practical Takeaways**: Structure clear takeaways with actionable benefits.
5. **Draft Response & Refine**: Stream final response structured with markdown headers and bullet points.`,
        content: `### Summary of Critical Thinking

**Critical thinking** is the objective analysis and evaluation of an issue in order to form a reasoned, evidence-based judgment.

---

### 1. Analysis (Breaking Down Information)
- **What it is**: Examining complex concepts by decomposing them into fundamental components.
- **Key Question**: *"What are the core facts versus interpretations?"*
- **Example**: Distinguishing raw empirical metrics from opinionated commentary.

### 2. Evaluation (Judging Credibility)
- **What it is**: The ability to judge the quality, relevance, and reliability of a source or argument.
- **Key Question**: *"Is this source biased, objective, or credible?"*
- **Example**: Evaluating whether a source has relevant expertise or if the underlying data is outdated.

### 3. Identifying Assumptions and Biases (Spotting the Flaws)
- **What it is**: Recognizing hidden beliefs, prejudices, or preconceived notions that might be skewing perception.
- **Key Question**: *"What beliefs am I taking for granted?"*
- **Example**: Recognizing that personal familiarity might influence your evaluation of a general scenario.

### 4. Logical Reasoning (Building a Strong Case)
- **What it is**: The ability to construct a sound argument by ensuring that premises logically lead to the conclusion, avoiding common fallacies.
- **Key Question**: *"Does this argument follow sound deductive or inductive logic?"*
- **Example**: Identifying a straw man fallacy where someone misrepresents an opponent's point.

---

### 💡 Why is Critical Thinking Important? (The Takeaway)

Critical thinking is essential because it empowers you to navigate modern environments filled with massive amounts of information, misinformation, and persuasive arguments.

1. **Better Decision Making**: It leads to well-founded, robust choices in complex environments.
2. **Problem Solving**: Pinpoints root causes rather than treating superficial symptoms.
3. **Independent Thought**: Prevents uncritical acceptance of assumptions and bias.`,
        timestamp: Date.now() - 1000 * 60 * 9,
        followups: [
          'How can I practice critical thinking in daily decisions?',
          'What are common cognitive biases to watch out for?',
          'Give me practical exercises for logical reasoning.',
        ],
      },
      {
        id: 'm_crit_u2',
        role: 'user',
        content: 'message with image attached.',
        attachments: [
          {
            id: 'att_img_1',
            type: 'image',
            title: 'Screenshot analysis',
            thumbnail: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80',
          },
        ],
        timestamp: Date.now() - 1000 * 60 * 5,
      },
      {
        id: 'm_crit_a2',
        role: 'assistant',
        model: 'gemma-4-E2B-it-MLX-4bit',
        thoughtProcess: `1. **Inspect Attached Image**: Visual inspection of the dashboard metrics and graphical trends.
2. **Formulate Insights**: Highlighting key performance indicators and anomalies depicted in the visual data.
3. **Draft Response**: Structuring the findings into an executive-ready overview.`,
        content: `I've analyzed the attached screenshot of your dashboard metrics:

1. **Visual Highlights**: The line chart indicates an upward trajectory in user throughput over the last 14-day window.
2. **Metric Summary**: Average response times remain stabilized at **42ms**, with 99.9% uptime compliance.
3. **Observation**: Noticeable traffic spikes coincide with scheduled morning batch synchronization.

Would you like a deeper diagnostic breakdown or an automated report export?`,
        timestamp: Date.now() - 1000 * 60 * 4,
      },
    ],
  },
  {
    id: 's_inc001234',
    title: 'Summarize INC001234 and suggest next steps',
    preview: 'INC001234 is a SEV-2 incident affecting email delivery...',
    group: 'Today',
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
    updatedAt: Date.now() - 1000 * 60 * 30,
    isStarred: false,
    messages: [
      {
        id: 'm_u1',
        role: 'user',
        content: 'Hi, summarize the incident INC001234 and suggest the next best actions.',
        timestamp: Date.now() - 1000 * 60 * 35,
      },
      {
        id: 'm_a1',
        role: 'assistant',
        model: 'gemma-4-E2B-it-MLX-4bit',
        thoughtProcess: `1. **Analyze Incident INC001234**: Review incident record and service dependencies.
2. **Impact Assessment**: ~120 internal users affected by email delivery issues.
3. **Root Cause Identification**: Mail gateway service crash on node-03.
4. **Formulate Next Best Actions**:
   - Restart the mail gateway service on node-03
   - Monitor queue backlog and retry rate
   - Notify affected users via status page
   - Update incident status after validation`,
        content: `INC001234 is a SEV-2 incident affecting email delivery for internal users.

• **Impact**: ~120 users unable to send/receive email
• **Root cause**: Mail gateway service crash
• **Status**: Investigating
• **Created**: 2024-01-15 09:14 AEST
• **Updated**: 2024-01-15 11:18 AEST

**Next best actions**:
1. Restart the mail gateway service on node-03
2. Monitor queue backlog and retry rate
3. Notify affected users via status page
4. Update incident status after validation`,
        timestamp: Date.now() - 1000 * 60 * 30,
        followups: [
          'Explain RCA for email delivery issue',
          'Draft incident update for stakeholders',
          'What are ServiceNow business rules?',
        ],
      },
    ],
  },
  {
    id: 's_rca',
    title: 'Explain RCA for email delivery issue',
    preview: 'Root Cause Analysis details for mail gateway...',
    group: 'Today',
    createdAt: Date.now() - 1000 * 60 * 120,
    updatedAt: Date.now() - 1000 * 60 * 90,
    isStarred: true,
    messages: [
      {
        id: 'm_u2',
        role: 'user',
        content: 'Explain RCA for email delivery issue',
        timestamp: Date.now() - 1000 * 60 * 100,
      },
      {
        id: 'm_a2',
        role: 'assistant',
        model: 'gemma-4-2b-it',
        content: 'The root cause of the email delivery failure was an out-of-memory exception on mail gateway node-03 following a surge in scheduled newsletter dispatches.',
        timestamp: Date.now() - 1000 * 60 * 95,
      },
    ],
  },
  {
    id: 's_stakeholders',
    title: 'Draft incident update for stakeholders',
    preview: 'Executive summary and resolution timeline...',
    group: 'This Week',
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24,
    isStarred: false,
    messages: [
      {
        id: 'm_u3',
        role: 'user',
        content: 'Draft incident update for stakeholders',
        timestamp: Date.now() - 1000 * 60 * 60 * 24,
      },
      {
        id: 'm_a3',
        role: 'assistant',
        model: 'gemma-4-2b-it',
        content: 'Executive Incident Brief:\n\nAll mail routing services have been restored. Systems are operating normally with latency < 50ms.',
        timestamp: Date.now() - 1000 * 60 * 60 * 24,
      },
    ],
  },
  {
    id: 's_bizrules',
    title: 'What are ServiceNow business rules?',
    preview: 'Business rules are server-side scripts...',
    group: 'This Week',
    createdAt: Date.now() - 1000 * 60 * 60 * 36,
    updatedAt: Date.now() - 1000 * 60 * 60 * 36,
    isStarred: false,
    messages: [
      {
        id: 'm_u4',
        role: 'user',
        content: 'What are ServiceNow business rules?',
        timestamp: Date.now() - 1000 * 60 * 60 * 36,
      },
      {
        id: 'm_a4',
        role: 'assistant',
        model: 'gemma-4-2b-it',
        content: 'ServiceNow Business Rules are server-side JavaScript scripts that execute when records are displayed, inserted, updated, deleted, or when a table is queried.',
        timestamp: Date.now() - 1000 * 60 * 60 * 36,
      },
    ],
  },
];

const INITIAL_WRITE_HISTORY: WriteHistoryItem[] = [
  {
    id: 'wh_1',
    type: 'write',
    title: 'create a article for critical thinking',
    format: 'Paragraph',
    input: 'create a article for critical thinking',
    output: 'Critical thinking is the essential cognitive skill involving the objective analysis and evaluation of information. It transcends passive acceptance, requiring individuals to question assumptions, assess the validity of sources, and construct logical arguments. Cultivating this discipline enables sound judgment, allowing for informed decision-making and the discernment between mere opinion and substantiated fact.',
    versions: [
      'Critical thinking is an active process of analyzing ideas, questioning assumptions, and arriving at well-reasoned conclusions through objective evidence.',
      'Critical thinking is the essential cognitive skill involving the objective analysis and evaluation of information. It transcends passive acceptance, requiring individuals to question assumptions, assess the validity of sources, and construct logical arguments. Cultivating this discipline enables sound judgment, allowing for informed decision-making and the discernment between mere opinion and substantiated fact.',
    ],
    currentVersionIndex: 1,
    model: 'gemma-4-e2b-it-4bit',
    tone: 'Formal',
    length: 'Short',
    language: 'English',
    createdAt: Date.now() - 1000 * 60 * 15,
  },
  {
    id: 'wh_2',
    type: 'reply',
    title: 'Reply to customer feedback on slow API latency',
    format: 'Comment',
    originalText: 'The latest release is running noticeably slower on heavy payload requests. Are you guys aware?',
    responseIdea: 'Acknowledge the latency spike, explain that edge cache warming is in progress, and provide link to status dashboard.',
    input: 'Acknowledge latency spike and provide reassurance with status link',
    output: 'Hi there! Thank you for flagging this. We are actively investigating the latency spike on high-payload endpoints and have deployed optimizations to accelerate edge cache warming. You can track real-time operational status and metrics at status.nowpilot.io.',
    versions: [
      'Hi there! Thank you for flagging this. We are actively investigating the latency spike on high-payload endpoints and have deployed optimizations to accelerate edge cache warming. You can track real-time operational status and metrics at status.nowpilot.io.',
    ],
    currentVersionIndex: 0,
    model: 'gemma-4-e2b-it-4bit',
    tone: 'Formal',
    length: 'Short',
    language: 'English',
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
  },
  {
    id: 'wh_3',
    type: 'write',
    title: 'Executive pitch for generative AI sidepanel integration',
    format: 'Essay',
    input: 'Outline the core business value of embedding generative AI sidepanels directly within browser workflows',
    output: 'Integrating contextual AI directly into the browser workflow eliminates task-switching latency and accelerates knowledge synthesis. By maintaining persistent context with active webpages, professionals can compose responses, extract analytical insights, and execute complex workflows without leaving their primary interface.',
    versions: [
      'Integrating contextual AI directly into the browser workflow eliminates task-switching latency and accelerates knowledge synthesis. By maintaining persistent context with active webpages, professionals can compose responses, extract analytical insights, and execute complex workflows without leaving their primary interface.',
    ],
    currentVersionIndex: 0,
    model: 'Qwythos-9B-Claude-Mythos-5-1M-mxfp4-mlx',
    tone: 'Formal',
    length: 'Medium',
    language: 'English',
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
  },
];

const INITIAL_NOTES: NoteItem[] = [
  {
    id: 'n1',
    title: 'INC Lifecycle Flow & Workflow Deep Dive',
    excerpt: 'Detailed documentation of ServiceNow Incident lifecycle flow diagram from New to Resolved with best practices...',
    category: 'Incident',
    folderPath: 'ServiceNow / Incident',
    tags: ['ServiceNow', 'Incident', 'Workflow'],
    updatedAt: '10 mins ago',
    createdAt: '2024-01-15 14:30',
    isFavorite: true,
    wordCount: 1234,
    readTime: '5 mins',
    linkCount: 8,
    backlinkCount: 12,
    content: {
      summary: 'This document provides a comprehensive overview of ServiceNow Incident lifecycle states, state definitions, trigger conditions, and operational best practices.',
      flowchart: true,
      notice: 'Note: Dashed lines represent possible rollback paths; actual state transitions are strictly governed by workflows and business rules.',
      sections: [
        {
          title: '1. Incident State Transition Diagram',
          text: 'Incidents in ServiceNow traverse 6 standard lifecycle states: from initial submission (New), assignment to a support team (Assigned), active technician investigation (In Progress), temporary suspension when pending external input (On Hold), resolution verification (Resolved), and finally archived closure (Closed).',
        },
        {
          title: '2. State Definitions & Triggers',
          tableData: [
            { status: 'New', desc: 'Incident created, pending assignment to group or individual', trigger: 'User submission or API integration', action: 'Assign, categorize, set priority' },
            { status: 'Assigned', desc: 'Assigned to a specific support team or individual agent', trigger: 'Manual assignment or auto-dispatch rule', action: 'Communicate, investigate, update notes' },
            { status: 'In Progress', desc: 'Support engineers actively investigating and resolving issue', trigger: 'Agent accepts or begins work on ticket', action: 'Add work notes, update progress' },
            { status: 'On Hold', desc: 'Suspended pending customer response, vendor, or change window', trigger: 'Waiting on third party or user response', action: 'Set hold reason, schedule follow-up' },
            { status: 'Resolved', desc: 'Fix applied, pending user verification or auto-close timer', trigger: 'Resolution complete, awaiting sign-off', action: 'Validate solution, confirm closure' },
            { status: 'Closed', desc: 'Incident fully archived, re-opening restricted by system', trigger: 'User confirmation or auto-close SLA rule', action: 'Archive record, generate KB article' },
          ],
        },
      ],
    },
  },
  {
    id: 'n2',
    title: 'Script Optimization: Batch Update Incident Status',
    excerpt: 'Using Background Scripts to optimize batch Incident updates, reducing DB queries and lock wait times...',
    category: 'Incident',
    folderPath: 'ServiceNow / Incident',
    tags: ['Script', 'Performance', 'ServiceNow'],
    updatedAt: '2 hours ago',
    createdAt: '2024-01-15 11:20',
    isFavorite: false,
    wordCount: 890,
    readTime: '3 mins',
    linkCount: 4,
    backlinkCount: 6,
    content: {
      summary: 'Explains performance optimization techniques in ServiceNow using GlideRecord update methods or Background Scripts for bulk data updates.',
      sections: [
        {
          title: '1. Background & Challenge',
          text: 'Updating thousands of historical Incident records using traditional while(gr.next()) { gr.update(); } causes frequent table locking and severe network overhead.',
        },
        {
          title: '2. Optimization Strategy',
          text: 'Using setWorkflow(false) disables unnecessary business engines and setAutoFields(false) prevents system field overhead, improving batch update speed by 5-10x.',
        },
      ],
    },
  },
  {
    id: 'n3',
    title: 'Common Incident Troubleshooting & Solutions',
    excerpt: 'Summary of common issues encountered during daily Incident resolution, including error codes and fixes...',
    category: 'Incident',
    folderPath: 'ServiceNow / Incident',
    tags: ['Incident', 'Troubleshooting'],
    updatedAt: 'Yesterday',
    createdAt: '2024-01-14 16:00',
    isFavorite: true,
    wordCount: 1560,
    readTime: '7 mins',
    linkCount: 11,
    backlinkCount: 18,
    content: {
      summary: 'Consolidates common ticket blockers like missing permissions, unexpected SLA triggers, and undelivered notifications with troubleshooting guides.',
      sections: [
        {
          title: '1. SLA Countdown Stopped Unexpectedly',
          text: 'Check the Pause Condition in the SLA Condition setup to verify whether state transitions triggered the hold policy.',
        },
      ],
    },
  },
  {
    id: 'n4',
    title: 'ServiceNow Business Rule Best Practices',
    excerpt: 'Best practices for writing Business Rules including performance tuning, loop prevention, and Scratchpad usage...',
    category: 'ServiceNow',
    folderPath: 'ServiceNow / Incident',
    tags: ['ServiceNow', 'Best Practice', 'BR'],
    updatedAt: '2 days ago',
    createdAt: '2024-01-13 09:15',
    isFavorite: false,
    wordCount: 2100,
    readTime: '9 mins',
    linkCount: 15,
    backlinkCount: 22,
    content: {
      summary: 'A comprehensive guide on Business Rules covering Before, After, Async, and Display rule definitions and best practices.',
      sections: [
        {
          title: '1. Prevent Recursive Executions',
          text: 'When invoking current.update() inside After Business Rules, handle execution conditions carefully to prevent infinite loops.',
        },
      ],
    },
  },
  {
    id: 'n5',
    title: 'IntegrationHub Usage Guide',
    excerpt: 'Comprehensive guide to configuring ServiceNow IntegrationHub, including triggers, actions, and REST Spoke APIs...',
    category: 'ServiceNow',
    folderPath: 'ServiceNow / Incident',
    tags: ['Integration', 'ServiceNow'],
    updatedAt: '3 days ago',
    createdAt: '2024-01-12 18:40',
    isFavorite: false,
    wordCount: 1150,
    readTime: '4 mins',
    linkCount: 6,
    backlinkCount: 9,
    content: {
      summary: 'Covers third-party API integration and steps for configuring IntegrationHub Spokes within Flow Designer workflows.',
      sections: [
        {
          title: '1. Custom Spoke Creation Steps',
          text: 'Navigate to IntegrationHub > Action Designer to configure Action Inputs, REST Steps, and authentication payloads.',
        },
      ],
    },
  },
];

function computeActiveSession(sessions: ChatSession[], activeSessionId: string): ChatSession | null {
  return sessions.find(s => s.id === activeSessionId) || sessions[0] || null;
}

interface ExtensionState {
  config: ProviderConfig;
  sessions: ChatSession[];
  activeSessionId: string;
  prompts: PromptItem[];
  writeHistory: WriteHistoryItem[];
  notes: NoteItem[];
  activeAttachments: Attachment[];
  availableTabs: TabItem[];
  activeSession: ChatSession | null;
  updateConfig: (updates: Partial<ProviderConfig>) => void;
  setActiveSessionId: (id: string) => void;
  createNewSession: () => string;
  addMessageToActiveSession: (msg: Message) => void;
  updateLastAssistantMessage: (contentChunk: string, thoughtChunk?: string, isDone?: boolean) => void;
  regenerateMessageInActiveSession: (msgId: string) => void;
  switchMessageVersion: (msgId: string, delta: number) => void;
  toggleStarSession: (id: string) => void;
  deleteSession: (id: string) => void;
  updateSessionTitle: (id: string, newTitle: string) => void;
  clearAllSessions: (includeStarred?: boolean) => void;
  addAttachment: (attachment: Attachment) => void;
  removeAttachment: (id: string) => void;
  setActiveAttachments: (attachments: Attachment[]) => void;
  addPrompt: (prompt: PromptItem) => void;
  updatePrompt: (id: string, updates: Partial<PromptItem>) => void;
  deletePrompt: (id: string) => void;
  toggleTabSelection: (tabId: string) => void;
  addWriteHistoryItem: (item: WriteHistoryItem) => void;
  updateWriteHistoryItem: (id: string, updates: Partial<WriteHistoryItem>) => void;
  deleteWriteHistoryItem: (id: string) => void;
  clearWriteHistory: () => void;
  addNote: (note: NoteItem) => void;
  updateNote: (id: string, updates: Partial<NoteItem>) => void;
  deleteNote: (id: string) => void;
  toggleFavoriteNote: (id: string) => void;
  saveTextAsNote: (text: string, titleHint?: string) => NoteItem;
}

export const useExtensionStore = create<ExtensionState>()(
  persist(
    immer((set, get) => {
      const recomputeActive = (sessions: ChatSession[], activeSessionId: string) => {
        return computeActiveSession(sessions, activeSessionId);
      };

      return {
        config: DEFAULT_CONFIG,
        sessions: INITIAL_SESSIONS,
        activeSessionId: 's_inc001234',
        prompts: INITIAL_PROMPTS,
        writeHistory: INITIAL_WRITE_HISTORY,
        notes: INITIAL_NOTES,
        activeAttachments: [],
        availableTabs: [],
        activeSession: INITIAL_SESSIONS[0],

        updateConfig: (updates) => {
          set((state) => {
            Object.assign(state.config, updates);
          });
          if (updates.themeMode) {
            const targetMode = updates.themeMode.toLowerCase() as ThemeMode;
            if (useThemeStore.getState().mode !== targetMode) {
              useThemeStore.getState().setMode(targetMode);
            }
          }
        },

        setActiveSessionId: (id) => {
          set((state) => {
            state.activeSessionId = id;
            state.activeSession = computeActiveSession(state.sessions, id);
          });
        },

        createNewSession: () => {
          const currentActive = get().activeSession;
          if (currentActive && currentActive.messages.length === 0) {
            return currentActive.id;
          }
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
          set((state) => {
            state.sessions = state.sessions.filter(s => s.messages.length > 0);
            state.sessions.unshift(newSession);
            state.activeSessionId = newId;
            state.activeSession = newSession;
            state.activeAttachments = [];
          });
          return newId;
        },

        addMessageToActiveSession: (msg) => {
          set((state) => {
            let session = state.sessions.find(s => s.id === state.activeSessionId);
            if (!session) {
              const newId = 's_' + Date.now();
              session = {
                id: newId,
                title: 'New Chat',
                preview: 'Ask anything...',
                createdAt: Date.now(),
                updatedAt: Date.now(),
                isStarred: false,
                group: 'Today',
                messages: [],
              };
              state.sessions.unshift(session);
              state.activeSessionId = newId;
            }
            session.messages.push(msg);
            if (session.messages.length === 1) {
              session.title = msg.content.slice(0, 35) || 'New Chat';
            }
            session.preview = msg.content.slice(0, 50);
            session.updatedAt = Date.now();
            state.activeSession = computeActiveSession(state.sessions, state.activeSessionId);
          });
        },

        updateLastAssistantMessage: (contentChunk, thoughtChunk, isDone) => {
          set((state) => {
            const session = state.sessions.find(s => s.id === state.activeSessionId);
            if (!session || session.messages.length === 0) return;
            const lastMsg = session.messages[session.messages.length - 1];
            if (lastMsg.role !== 'assistant') return;

            if (contentChunk) lastMsg.content += contentChunk;
            if (thoughtChunk) lastMsg.thoughtProcess = (lastMsg.thoughtProcess || '') + thoughtChunk;

            if (!lastMsg.versions || lastMsg.versions.length === 0) {
              lastMsg.versions = [lastMsg.content];
            }
            const curIdx = lastMsg.currentVersionIndex ?? (lastMsg.versions.length - 1);
            lastMsg.versions[curIdx] = lastMsg.content;
            lastMsg.currentVersionIndex = curIdx;
            lastMsg.isThinking = !isDone;
            state.activeSession = computeActiveSession(state.sessions, state.activeSessionId);
          });
        },

        regenerateMessageInActiveSession: (msgId) => {
          set((state) => {
            const session = state.sessions.find(s => s.id === state.activeSessionId);
            if (!session) return;
            const msg = session.messages.find(m => m.id === msgId && m.role === 'assistant');
            if (!msg) return;

            const existingVersions = msg.versions && msg.versions.length > 0 ? [...msg.versions] : [msg.content];
            const vNum = existingVersions.length + 1;
            const newContent = `Here is alternative response variant ${vNum} with a fresh perspective, highlighted key takeaways, and concise action steps tailored to your active query and context.`;
            existingVersions.push(newContent);
            msg.versions = existingVersions;
            msg.currentVersionIndex = existingVersions.length - 1;
            msg.content = newContent;
            state.activeSession = computeActiveSession(state.sessions, state.activeSessionId);
          });
        },

        switchMessageVersion: (msgId, delta) => {
          set((state) => {
            const session = state.sessions.find(s => s.id === state.activeSessionId);
            if (!session) return;
            const msg = session.messages.find(m => m.id === msgId);
            if (!msg || !msg.versions || msg.versions.length === 0) return;

            const currentIdx = msg.currentVersionIndex ?? (msg.versions.length - 1);
            const nextIdx = Math.max(0, Math.min(msg.versions.length - 1, currentIdx + delta));
            msg.currentVersionIndex = nextIdx;
            msg.content = msg.versions[nextIdx];
            state.activeSession = computeActiveSession(state.sessions, state.activeSessionId);
          });
        },

        toggleStarSession: (id) => {
          set((state) => {
            const session = state.sessions.find(s => s.id === id);
            if (session) session.isStarred = !session.isStarred;
          });
        },

        deleteSession: (id) => {
          set((state) => {
            const idx = state.sessions.findIndex(s => s.id === id);
            if (idx === -1) return;
            state.sessions.splice(idx, 1);
            if (state.activeSessionId === id && state.sessions.length > 0) {
              state.activeSessionId = state.sessions[0].id;
              state.activeSession = state.sessions[0];
            } else if (state.sessions.length === 0) {
              state.activeSessionId = '';
              state.activeSession = null;
            }
          });
        },

        updateSessionTitle: (id, newTitle) => {
          set((state) => {
            const session = state.sessions.find(s => s.id === id);
            if (session) session.title = newTitle;
          });
        },

        clearAllSessions: (includeStarred = true) => {
          set((state) => {
            if (includeStarred) {
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
              state.sessions = [newSession];
              state.activeSessionId = newId;
              state.activeSession = newSession;
            } else {
              const remaining = state.sessions.filter(s => s.isStarred);
              if (remaining.length === 0) {
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
                state.sessions = [newSession];
                state.activeSessionId = newId;
                state.activeSession = newSession;
              } else {
                state.sessions = remaining;
                if (!remaining.some(s => s.id === state.activeSessionId)) {
                  state.activeSessionId = remaining[0].id;
                  state.activeSession = computeActiveSession(remaining, remaining[0].id);
                }
              }
            }
            state.activeAttachments = [];
          });
        },

        addAttachment: (attachment) => {
          set((state) => {
            const existing = state.activeAttachments.findIndex(a => a.id === attachment.id);
            if (existing !== -1) state.activeAttachments.splice(existing, 1);
            state.activeAttachments.push(attachment);
          });
        },

        removeAttachment: (id) => {
          set((state) => {
            const idx = state.activeAttachments.findIndex(a => a.id === id);
            if (idx !== -1) state.activeAttachments.splice(idx, 1);
          });
        },

        setActiveAttachments: (attachments) => {
          set((state) => {
            state.activeAttachments = attachments;
          });
        },

        addPrompt: (prompt) => {
          set((state) => {
            state.prompts.unshift(prompt);
          });
        },

        updatePrompt: (id, updates) => {
          set((state) => {
            const prompt = state.prompts.find(p => p.id === id);
            if (prompt) Object.assign(prompt, updates);
          });
        },

        deletePrompt: (id) => {
          set((state) => {
            const idx = state.prompts.findIndex(p => p.id === id);
            if (idx !== -1) state.prompts.splice(idx, 1);
          });
        },

        toggleTabSelection: (tabId) => {
          set((state) => {
            const tab = state.availableTabs.find(t => t.id === tabId);
            if (tab) tab.selected = !tab.selected;
          });
        },

        addWriteHistoryItem: (item) => {
          set((state) => {
            if (!state.writeHistory) state.writeHistory = [];
            state.writeHistory.unshift(item);
          });
        },

        updateWriteHistoryItem: (id, updates) => {
          set((state) => {
            if (!state.writeHistory) return;
            const item = state.writeHistory.find(h => h.id === id);
            if (item) Object.assign(item, updates);
          });
        },

        deleteWriteHistoryItem: (id) => {
          set((state) => {
            if (!state.writeHistory) return;
            const idx = state.writeHistory.findIndex(h => h.id === id);
            if (idx !== -1) state.writeHistory.splice(idx, 1);
          });
        },

        clearWriteHistory: () => {
          set((state) => {
            state.writeHistory = [];
          });
        },

        addNote: (note) => {
          set((state) => {
            if (!state.notes) state.notes = [];
            state.notes.unshift(note);
          });
        },

        updateNote: (id, updates) => {
          set((state) => {
            if (!state.notes) return;
            const note = state.notes.find((n) => n.id === id);
            if (note) Object.assign(note, updates);
          });
        },

        deleteNote: (id) => {
          set((state) => {
            if (!state.notes) return;
            const idx = state.notes.findIndex((n) => n.id === id);
            if (idx !== -1) state.notes.splice(idx, 1);
          });
        },

        toggleFavoriteNote: (id) => {
          set((state) => {
            if (!state.notes) return;
            const note = state.notes.find((n) => n.id === id);
            if (note) note.isFavorite = !note.isFavorite;
          });
        },

        saveTextAsNote: (text, titleHint) => {
          const cleanText = text.trim();
          let title = titleHint?.trim() || '';
          if (!title) {
            const firstLine = cleanText.split('\n')[0].replace(/^[#*\-•\s]+/, '').trim();
            title = firstLine.length > 0 ? (firstLine.length > 50 ? firstLine.slice(0, 50) + '...' : firstLine) : 'AI Note';
          }
          const excerpt = cleanText.slice(0, 140).replace(/\n+/g, ' ') + (cleanText.length > 140 ? '...' : '');
          const wordCount = cleanText.split(/\s+/).filter(Boolean).length;
          const readTime = `${Math.max(1, Math.ceil(wordCount / 200))} min`;
          const now = new Date();
          const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

          const newNote: NoteItem = {
            id: 'n_' + Date.now(),
            title,
            excerpt,
            category: 'AI Insights',
            folderPath: 'My Notes / AI Insights',
            tags: ['AI', 'Generated'],
            updatedAt: 'Just now',
            createdAt: dateStr,
            isFavorite: false,
            content: {
              summary: excerpt,
              sections: [
                {
                  title: '1. Overview & Content',
                  text: cleanText,
                },
              ],
            },
            wordCount,
            readTime,
            linkCount: 0,
            backlinkCount: 0,
          };

          set((state) => {
            if (!state.notes) state.notes = [];
            state.notes.unshift(newNote);
          });

          return newNote;
        },
      };
    }),
    {
      name: 'np_store',
      storage: createJSONStorage(() => chromeStorageAdapter),
      partialize: (state) => {
        const { activeSession, activeAttachments, availableTabs, ...rest } = state;
        return rest;
      },
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as Partial<ExtensionState>) };
        merged.activeSession = computeActiveSession(merged.sessions, merged.activeSessionId);
        merged.activeAttachments = [];
        merged.availableTabs = [];
        return merged;
      },
    },
  ),
);
