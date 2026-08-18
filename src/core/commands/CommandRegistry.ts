export interface Command {
  id: string;
  name: string;
  description: string;
  category: string;
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
