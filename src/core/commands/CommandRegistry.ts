/**
 * The canonical Phase-1 palette categories. The palette resolves each value
 * through `t('commands.category.<value>')`, so the registry — not the palette —
 * is the single place a command (and its category) is added.
 */
export const COMMAND_CATEGORIES = ['navigation', 'theme', 'system'] as const;

export type CommandCategory = (typeof COMMAND_CATEGORIES)[number];

export interface Command {
  id: string;
  name: string;
  description: string;
  category: string;
  /**
   * A destructive command never runs on selection: the palette requires an
   * explicit confirmation before its action is invoked (D-10).
   */
  destructive?: boolean;
  action: () => void;
}

const commands = new Map<string, Command>();

export const CommandRegistry = {
  register(cmd: Command): void {
    if (commands.has(cmd.id)) {
      throw new Error(`Command already registered: ${cmd.id}`);
    }
    commands.set(cmd.id, cmd);
  },

  unregister(id: string): void {
    commands.delete(id);
  },

  get(id: string): Command | undefined {
    return commands.get(id);
  },

  getAll(): Command[] {
    return Array.from(commands.values());
  },

  search(query: string): Command[] {
    if (query === '') {
      return Array.from(commands.values());
    }
    const lower = query.toLowerCase();
    return Array.from(commands.values()).filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lower) ||
        cmd.description.toLowerCase().includes(lower),
    );
  },

  execute(id: string): void {
    const cmd = commands.get(id);
    if (!cmd) {
      throw new Error(`Command not found: ${id}`);
    }
    cmd.action();
  },
};
