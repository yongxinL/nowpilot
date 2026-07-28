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

  // Onboarding
  'onboarding.welcome': 'Welcome to NowPilot',
  'onboarding.step1': 'Meet NowPilot',
  'onboarding.step2': 'Choose a provider',
  'onboarding.step3': 'Enter your API key',
  'onboarding.step4': 'Start chatting',
  'onboarding.testing': 'Testing connection...',
  'onboarding.connected': 'Connected!',

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
