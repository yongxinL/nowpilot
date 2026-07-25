import type { ToolDefinition } from './ToolDefinition';
import { getPageContentTool } from './builtin/getPageContentTool';
import { pinTabTool } from './builtin/pinTabTool';
import { searchTabsTool } from './builtin/searchTabsTool';

export class ToolRegistry {
  #tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.#tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.#tools.set(tool.name, tool);
  }

  unregister(name: string): void {
    this.#tools.delete(name);
  }

  get(name: string): ToolDefinition | undefined {
    return this.#tools.get(name);
  }

  has(name: string): boolean {
    return this.#tools.has(name);
  }

  list(): ToolDefinition[] {
    return Array.from(this.#tools.values());
  }
}

export const toolRegistry = new ToolRegistry();

// Register built-in tools at import time (PATTERNS.md §14)
// Per RESEARCH.md anti-pattern: tools must be registered at import time,
// not lazily. ToolRegistry initialization happens in module scope.
toolRegistry.register(getPageContentTool);
toolRegistry.register(pinTabTool);
toolRegistry.register(searchTabsTool);
