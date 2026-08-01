const strings: Record<string, string> = {
  // Shell
  'app.name': 'NowPilot',
  'app.tagline': 'Your privacy-first AI assistant',

  // Chat
  'chat.empty': 'Start a conversation',
  'chat.loading': 'Connecting to provider...',
  'chat.error': 'Provider error.',
  'chat.retry': 'Retry',
  'chat.switchProvider': 'Switch Provider',
  'chat.stopGenerating': 'Stop generating',
  'chat.generationStopped': 'Generation stopped by user',

  // Agent
  'agent.empty': 'Describe a task and the agent will plan steps',
  'agent.loading': 'Preparing agent...',
  'agent.error': 'Agent error:',

  // Notes
  'notes.empty': "No notes yet. Press + to create one.",
  'notes.loading': 'Loading notes...',
  'notes.error': 'Failed to load notes.',
  'notes.saved': 'Note saved',
  'notes.deleteConfirm': 'Delete this note? This cannot be undone.',
  'notes.deleteAction': 'Delete Note',
  'notes.searchEmpty': 'No notes match your search. Try different keywords.',
  'notes.createNew': 'New Note',
  'notes.save': 'Save Note',
  'notes.search': 'Search notes',

  // Wikilinks
  'wikilink.unresolved': "Note doesn't exist yet — click to create",
  'wikilink.create': 'Create Note "{title}"',
  'wikilink.created': 'Note created — link resolved',
  'wikilink.createAction': 'Create Note',
  'linkparser.error': 'Failed to parse wikilinks in note content',
  'notegraph.error': 'Failed to compute note relationships',

  // Memory
  'memory.retrievalError': 'Memory retrieval failed. Continuing without context.',
  'memory.writeConflict': 'Memory write unavailable — another surface is active. Changes are read-only here.',
  'memory.summaryError': 'Failed to summarize conversation. Full history preserved.',

  // Options
  'options.loading': 'Loading settings...',
  'options.error': 'Failed to load settings',

  // Diagnostics
  'diagnostics.loading': 'Loading diagnostics...',
  'diagnostics.empty': 'No AI transactions yet.',
  'diagnostics.error': 'Failed to load traces',

  // Side Panel
  'sidepanel.openFullApp': 'Open Full App',
  'sidepanel.openingFullApp': 'Opening full app...',
  'sidepanel.fullAppFailed': 'Failed to open Full App tab',

  // Onboarding — OLD keys (keep for old OnboardingModal until Plan 01-05)
  'onboarding.welcome': 'Welcome to NowPilot',
  'onboarding.step1': 'Meet NowPilot',
  'onboarding.step2': 'Choose a provider',
  'onboarding.step3': 'Enter your API key',
  'onboarding.step4': 'Start chatting',
  'onboarding.testing': 'Testing connection...',
  'onboarding.connected': 'Connected!',
  // Onboarding — NEW keys for OnboardingWizard (UI-SPEC copy)
  'onboarding.welcomeHeading': 'Welcome to NowPilot',
  'onboarding.welcomeSubtext': 'Your personal AI assistant and knowledge workspace — right in your browser.',
  'onboarding.step1Title': 'Chat with AI',
  'onboarding.step1Body': 'Ask questions, brainstorm ideas, and get help with any task — powered by your own AI providers.',
  'onboarding.step2Title': 'Capture Knowledge',
  'onboarding.step2Body': 'Save important insights as atomic notes with automatic tagging and organization.',
  'onboarding.step3Title': 'Your Workspace, Your Way',
  'onboarding.step3Body': 'Toggle between light and dark themes. Open the full app for deep work and configuration.',
  'onboarding.startExploring': 'Start Exploring',
  'onboarding.previousStep': 'Previous Step',
  'onboarding.nextStep': 'Next Step',
  'onboarding.skip': 'Skip Onboarding',

  // Theme
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.auto': 'Auto',
  'theme.toggle': 'Toggle theme',
  'theme.switchToDark': 'Switch to dark mode',
  'theme.switchToLight': 'Switch to light mode',

  // Shell
  'shell.loading': 'Loading workspace…',
  'shell.error': 'Something went wrong. Please reload the extension.',

  // Side Panel
  'sidepanel.footer': 'Open in Full Tab',

  // Commands
  'commands.placeholder': 'Search commands…',
  'commands.noResults': 'No matching commands — try a different search term',
  'commands.category.theme': 'Appearance',
  'commands.category.navigation': 'Navigation',
  'commands.category.system': 'System',

  // Common
  'common.retry': 'Retry',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.loading': 'Loading...',
  'common.error': 'An error occurred',
  'common.back': 'Back',
};

export function t(key: string): string {
  return strings[key] ?? key;
}
