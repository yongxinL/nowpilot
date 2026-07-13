import { debugLog } from '../utils/debugLog';

const SLASH_COMMANDS_KEY = 'np_slash_commands';

export interface SlashCommand {
  name: string;
  label: string;
  description?: string;
  templateId?: string;
  handler?: (input: string) => void;
}

export class SlashCommandRegistry {
  #commands = new Map<string, SlashCommand>();

  constructor() {
    this.#loadPersisted().catch(() => {});
    this.#registerBuiltins();
  }

  register(command: SlashCommand): void {
    if (this.#commands.has(command.name)) {
      throw new Error(`Slash command "${command.name}" is already registered`);
    }
    this.#commands.set(command.name, command);
    this.#persist().catch(() => {});
  }

  unregister(name: string): void {
    this.#commands.delete(name);
    this.#persist().catch(() => {});
  }

  get(name: string): SlashCommand | undefined {
    return this.#commands.get(name);
  }

  has(name: string): boolean {
    return this.#commands.has(name);
  }

  list(): SlashCommand[] {
    return Array.from(this.#commands.values());
  }

  parseCommand(input: string): { command: SlashCommand; rest: string } | null {
    const match = input.match(/^\/(\w+)\s*(.*)?/);
    if (!match) return null;
    const cmd = this.#commands.get(match[1]);
    return cmd ? { command: cmd, rest: match[2] ?? '' } : null;
  }

  async #loadPersisted(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(SLASH_COMMANDS_KEY);
      const persisted = (result[SLASH_COMMANDS_KEY] ?? []) as SlashCommand[];
      for (const cmd of persisted) {
        this.#commands.set(cmd.name, cmd);
      }
    } catch (err) {
      debugLog('error', '[SlashCommandRegistry] loadPersisted failed', { error: err });
    }
  }

  async #persist(): Promise<void> {
    try {
      const commands = Array.from(this.#commands.values());
      await chrome.storage.local.set({ [SLASH_COMMANDS_KEY]: commands });
    } catch (err) {
      debugLog('error', '[SlashCommandRegistry] persist failed', { error: err });
    }
  }

  #registerBuiltins(): void {
    const builtins: SlashCommand[] = [
      { name: 'write', label: 'Write', description: 'Draft a response or document', templateId: 'write' },
      { name: 'ask', label: 'Ask', description: 'Ask a general question', templateId: 'ask' },
      { name: 'research', label: 'Research', description: 'Research a topic', templateId: 'research' },
    ];
    for (const cmd of builtins) {
      if (!this.#commands.has(cmd.name)) {
        this.#commands.set(cmd.name, cmd);
      }
    }
  }
}

export const slashCommandRegistry = new SlashCommandRegistry();
