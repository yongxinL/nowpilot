// src/core/i18n/strings.ts — Source: Appendix B (verbatim) + UI-SPEC Copywriting
// Contract (canonical additions). No i18n framework in Phase 1 — plain exported
// constants (CONTEXT the agent's Discretion). Do NOT paraphrase any string
// (Golden Rule 2; UI copy locked by the Copywriting Contract).
// NOT seeded: chat.minimalMode (I2 — MinimalMode deferred to its owning phase).
export const STR = {
  chat: {
    loading: 'Connecting to provider...',
    empty: 'Start a conversation',
    errorRetry: 'Provider error. [Retry] [Switch Provider]',
    offline: 'No network. Retrying when back online.',
    contextReduced: 'Some context was compressed to fit the selected model.',
    // Phase-4 canonical addition (D-04-15 honest CONTEXT_TOO_LARGE surface,
    // verbatim draft — the W-1 gate mirrors it into spec Appendix B in 04-07):
    messageTooLong: 'This message is too long for the selected model.',
    noProvider: 'Configure an AI provider in Settings first.',
    maxPinnedTabs: 'Maximum 10 pinned tabs. Remove one first.',
    cannotPin: 'Cannot pin this page. Try a regular web page.',
    // Phase-1 canonical addition (UI-SPEC Copywriting Contract: Chat history empty state)
    historyEmpty: 'No conversations yet — say hello below.',
    // Phase-1 canonical addition (UI-SPEC §17.1 composer input placeholder, verbatim)
    askPlaceholder: 'Ask anything, @ models, / prompts',
    // Phase-3 canonical additions (UI-SPEC Copywriting Contract, verbatim):
    // Primary CTA + failed-bubble Retry action.
    send: 'Send',
    retry: 'Retry',
  },
  diagnostics: {
    title: 'Diagnostics',
    copyOperationId: 'Copy operation ID',
    exportDebugBundle: 'Export debug bundle',
    noTransactions: 'No AI transactions yet.',
    loading: 'Loading diagnostics...',
  },
  tools: {
    rejected: 'Tool is not available or input schema is invalid.',
    permissionDenied: 'Tool permission denied.',
    researchNoTool: 'Research failed: no web-search tool connected. [Open Settings]',
  },
  memory: {
    updated: 'Memory updated.',
    disabled: 'Memory is disabled in Settings.',
  },
  onboarding: {
    testing: 'Testing connection...',
    connected: 'Connected',
    failed: 'Connection failed: [error]',
    // Phase-1 canonical additions (UI-SPEC Copywriting Contract + Flow 9 RICH-R-03)
    heading: 'Meet your co-pilot',
    body: "I'm ready when you are. Configure a provider in Options to start chatting.",
    configureProvider: 'Configure provider',
    configureLater: 'Configure later',
  },
  notes: {
    loading: 'Loading notes...',
    empty: 'No notes yet. Press + to create one.',
    loadFailed: 'Failed to load notes. [Retry]',
    // --- LLM-Wiki (§27) ---
    askPlaceholder: 'Ask a question about your notes',
    askLoading: 'Searching your notes...',
    askEmpty: 'No relevant notes found. Try rephrasing.',
    askError: "Couldn't answer from notes. [Retry]",
    backupOn: 'Backup: On',
    backupOff: 'Backup: Off',
    backupError: 'Backup: Error',
    backupConfigure: 'Configure',
    backupBannerLost: 'Backup folder not accessible. [Re-select folder] [Dismiss]',
    restorePreview:
      'Found [n] notes ([new] new, [updated] updated, [unchanged] unchanged). Proceed?',
    externalChange:
      'This file was modified externally. Overwrite with app version? [Overwrite] [Skip]',
    stale: 'Content has changed — [Regenerate tags/summary]',
    orphan: 'Orphan',
    taggerFailed: "Couldn't analyze — [Retry]",
    reanalyzeAll: 'Re-analyze all notes',
    // Phase-1 canonical addition (UI-SPEC Copywriting Contract: Notes empty-state CTA)
    newNote: 'New note',
    // --- Phase-5 canonical additions (05-UI-SPEC Copywriting Contract L126-153,
    // verbatim — Golden Rule 2). Existing keys above (newNote/loading/empty/
    // loadFailed) are reused, not re-added.
    newNoteFromPage: 'New note from page',
    searchPlaceholder: 'Search notes, tags, or content…',
    searchEmpty: 'No notes match your search.',
    resultsCount: '[n] notes',
    loadingNote: 'Loading note...',
    saveFailed: 'Failed to save note. [Retry]',
    selectNote: 'Select a note or create a new one.',
    save: 'Save Note',
    unsaved: 'Unsaved changes',
    discard: 'Discard unsaved changes?',
    deleteConfirm: 'Delete "[title]"? This cannot be undone.',
    deleteFailed: "Couldn't delete the note. [Retry]",
    backlinks: 'Backlinks',
    backlinksEmpty: 'No backlinks yet.',
    // 05-10 (IN-01): state-distinct collapse/expand tooltip + aria-label copy —
    // the collapse control must announce WHAT it will do (expanded vs collapsed).
    backlinksCollapse: 'Collapse backlinks',
    backlinksExpand: 'Expand backlinks',
    graphLoading: 'Building graph...',
    graphEmpty: 'Create at least 3 notes to see the graph',
    graphFailed: 'Failed to render graph. [Retry]',
    viewNotes: 'Notes',
    viewGraph: 'Graph',
    createNote: 'Create note',
    addTag: 'Add tag',
    star: 'Star',
    unstar: 'Unstar',
  },
  agent: {
    loading: 'Preparing agent...',
    empty: 'Describe a task and the agent will plan steps',
    error: 'Agent error: [message]. [Retry]',
    working: 'NowPilot is working...', // RICH-H-03
  },
  standalone: {
    openTitle: 'Open Standalone view',
    opening: 'Opening standalone view...',
    openFailed: 'Failed to open Standalone view',
    minWidth: 'This view is optimized for wider screens; open the side panel for narrow layouts.',
  },
  workspace: {
    handoffPending: 'Opening workspace in standalone view...',
    handoffComplete: 'Workspace opened in standalone view.',
    mirroringNotice: 'Standalone view is now the primary surface for this workspace.',
    electionFailed: 'Could not coordinate between surfaces. Reload to retry.',
    // Phase-1 canonical addition (UI-SPEC Copywriting Contract: workspace handoff error, Flow 11)
    handoffFailed: "Couldn't open the standalone view. Open it from the Chrome menu.",
  },
  cmdk: {
    // Phase-1 canonical addition (UI-SPEC Copywriting Contract: Cmd+K palette placeholder, Flow 10)
    placeholder: 'Type a command…',
  },
  options: {
    providers: 'Providers',
    models: 'Models',
    mcp: 'MCP Servers',
    prompts: 'Prompt Templates',
    slash: 'Slash Commands',
    memory: 'Memory',
    diagnostics: 'Diagnostics',
    importExport: 'Import / Export',
    featureFlags: 'Feature Flags',
    addonSettings: 'Add-on Settings',
    persona: 'Persona', //
    notes: 'Notes', //
    about: 'About',
    // Phase-1 canonical addition (UI-SPEC Copywriting Contract: Options empty state)
    noProvider: 'No provider connected. Set up a provider to start.',
    // Phase-4b canonical additions (04b-UI-SPEC Copywriting Contract —
    // content-trust card, verbatim; D-4b-07)
    contentTrust: 'Content trust',
    trustHelper: 'Choose which content sources can feed the model.',
    trustStructuralNote:
      'Pages is the only active source in this version. Notes, memory, and tool results arrive in later phases.',
    trustSources: {
      pages: 'Pages',
      notes: 'Notes',
      memory: 'Memory',
      toolResults: 'Tool results',
    },
    trustSaveFailed: "Couldn't save your content trust settings. We'll retry on the next change.",
  },
  theme: {
    // Phase-1 canonical addition (UI-SPEC Copywriting Contract: theme persistence error)
    saveFailed: "Couldn't save your display mode. We'll retry on the next change.",
  },
  // Phase-2 canonical additions (Appendix B + CONTEXT D-12/D-04 wording, verbatim)
  storage: {
    // D-12 degraded-mode persistent banner (component renders in Phase 7)
    degradedBanner: 'Storage failed to upgrade — data is read-only. Use Import/Export to back up.',
    // D-04 PROVIDER_KEY_UNREADABLE recovery path: provider surfaces as "Key required — re-enter"
    providerKeyRequired: 'Key required — re-enter',
  },
  // --- RICH (§17.7) ---
  rich: {
    personaTagline: 'NowPilot — Your ServiceNow support co-pilot',
    welcomeTitle: 'What can I help you with?',
    clarifyPrefix: 'Quick question:',
    followUpLabel: 'Follow up',
    closureAsk: 'Did this help?',
    closureMore: 'Anything else?',
    stageReading: 'Reading page context...',
    stagePlanning: 'Planning response...',
    stageGenerating: 'Generating...',
    stageSlow: 'Still working...',
    insertCopiedToClipboard: 'Copied to clipboard (in-page insert available in a future version).',
  },
} as const;
