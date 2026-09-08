import { WorkspaceRouter } from '@/core/workspace/WorkspaceRouter';

export type CommandWhen = 'always' | 'in-composer' | 'in-note' | 'in-side-panel' | 'in-standalone';
export type CommandEnv = 'sidepanel' | 'standalone' | 'composer' | 'note';

export interface Command {
  id: string;
  label: string;
  description?: string;
  when?: CommandWhen;
  handler: () => void | Promise<void>;
}

function matchesWhen(when: CommandWhen | undefined, env: CommandEnv | undefined): boolean {
  if (!when || when === 'always') return true;
  if (!env) return false;
  switch (when) {
    case 'in-composer':
      return env === 'composer';
    case 'in-note':
      return env === 'note';
    case 'in-side-panel':
      return env === 'sidepanel';
    case 'in-standalone':
      return env === 'standalone';
    default:
      return false;
  }
}

class CommandRegistryClass {
  private commands = new Map<string, Command>();

  register(command: Command): void {
    if (this.commands.has(command.id)) return;
    this.commands.set(command.id, command);
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  list(): Command[] {
    return [...this.commands.values()];
  }

  getVisible(env?: CommandEnv): Command[] {
    return this.list().filter((c) => matchesWhen(c.when, env));
  }

  async execute(id: string): Promise<void> {
    const command = this.commands.get(id);
    if (!command) return;
    await command.handler();
  }

  clear(): void {
    this.commands.clear();
  }
}

export const CommandRegistry = new CommandRegistryClass();

export function registerDefaultCommands(): void {
  CommandRegistry.register({
    id: 'open-standalone',
    label: 'Open Standalone view',
    description: 'Open the full workspace in a standalone tab',
    when: 'always',
    handler: () => WorkspaceRouter.openStandalone(),
  });
  CommandRegistry.register({
    id: 'focus-side-panel',
    label: 'Focus Side Panel',
    description: 'Open the side panel for the current tab',
    when: 'always',
    handler: () => WorkspaceRouter.focusSidePanel(),
  });
  CommandRegistry.register({
    id: 'open-options',
    label: 'Open Options',
    description: 'Open the Options page in the standalone view',
    when: 'always',
    handler: () => WorkspaceRouter.openStandalone({ page: 'options' }),
  });
}
