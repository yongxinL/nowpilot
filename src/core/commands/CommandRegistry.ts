export interface Command {
  id: string;
  name: string;
  description: string;
  category: string;
  action: () => void;
}

// Stub: will be implemented in GREEN phase
const commands = new Map<string, Command>();

export const CommandRegistry = {
  register(_cmd: Command): void {
    throw new Error('Not implemented');
  },
  unregister(_id: string): void {
    throw new Error('Not implemented');
  },
  get(_id: string): Command | undefined {
    throw new Error('Not implemented');
  },
  getAll(): Command[] {
    throw new Error('Not implemented');
  },
  search(_query: string): Command[] {
    throw new Error('Not implemented');
  },
  execute(_id: string): void {
    throw new Error('Not implemented');
  },
};
