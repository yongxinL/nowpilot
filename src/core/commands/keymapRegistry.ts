import { debugLog } from '../utils/debugLog';

export type CommandHandler = () => void | Promise<void>;

export interface CommandDefinition {
  id: string;
  label: string;
  handler: CommandHandler;
  shortcut?: string;
}

export class KeymapRegistry {
  private commands = new Map<string, CommandDefinition>();

  register(command: CommandDefinition): void {
    if (this.commands.has(command.id)) {
      throw new Error(`Command "${command.id}" is already registered`);
    }
    this.commands.set(command.id, command);
  }

  unregister(id: string): void {
    this.commands.delete(id);
  }

  getCommand(id: string): CommandDefinition | undefined {
    return this.commands.get(id);
  }

  getAllCommands(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  handleCommand(id: string): void {
    const command = this.commands.get(id);
    if (command) {
      command.handler();
    } else {
      debugLog('warn', 'Unknown command', { id });
    }
  }
}

export const keymapRegistry = new KeymapRegistry();
