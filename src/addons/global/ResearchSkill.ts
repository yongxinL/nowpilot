import { debugLog } from '../../core/utils/debugLog';

// Per D-12: MCP-connected only. Flexible regex matching per RESEARCH.md.
// Patterns match search-related tool names and descriptions case-insensitively.
export const SEARCH_TOOL_PATTERNS = [
  /search/i,
  /brave/i,
  /tavily/i,
  /web_search/i,
  /google/i,
] as const;

export interface ResearchSkillConfig {
  mcpClient?: {
    listTools: () => Promise<{ tools: Array<{ name: string; description?: string }> }>;
    callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  };
}

export interface ResearchResult {
  type: 'unavailable' | 'results' | 'error';
  message?: string;
  data?: unknown;
}

/**
 * ResearchSkill — global add-on that provides web-search capability
 * through connected MCP servers only (no built-in search, per D-12).
 *
 * Detects search-capable MCP tools via flexible regex matching on tool
 * names and descriptions. Gracefully degrades with configuration instructions
 * when no search MCP is available (D-13).
 *
 * Follows QuickActionService class+singleton pattern.
 */
export class ResearchSkill {
  #config: ResearchSkillConfig = {};

  configure(config: ResearchSkillConfig): void {
    this.#config = config;
  }

  /**
   * Returns true when the connected MCP client has at least one tool whose
   * name or description matches a search-related pattern. Catches all errors
   * and returns false for graceful degradation per D-13.
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.#config.mcpClient) return false;
      const { tools } = await this.#config.mcpClient.listTools();
      return tools.some((tool) =>
        SEARCH_TOOL_PATTERNS.some(
          (pattern) => pattern.test(tool.name) || pattern.test(tool.description ?? ''),
        ),
      );
    } catch (err) {
      debugLog('error', '[ResearchSkill] isAvailable failed', { error: err });
      return false; // graceful per D-13
    }
  }

  /**
   * Executes a search query via the first matching MCP search tool.
   * Returns an unavailable result when no search MCP is configured (D-13),
   * or an error result when the MCP call fails.
   */
  async execute(query: string): Promise<ResearchResult> {
    if (!this.#config.mcpClient) {
      return {
        type: 'unavailable',
        message: 'Configure a web search tool in Options → MCP Servers to enable research.',
      };
    }

    try {
      const { tools } = await this.#config.mcpClient.listTools();
      const searchTool = tools.find((t) =>
        SEARCH_TOOL_PATTERNS.some(
          (p) => p.test(t.name) || p.test(t.description ?? ''),
        ),
      );

      if (!searchTool) {
        return { type: 'unavailable', message: 'No search tool found.' };
      }

      const results = await this.#config.mcpClient.callTool(searchTool.name, {
        query,
      });
      return { type: 'results', data: results };
    } catch (err) {
      debugLog('error', '[ResearchSkill] execute failed', { error: err });
      return {
        type: 'error',
        message: 'Research search failed. Please try again.',
      };
    }
  }
}

export const researchSkill = new ResearchSkill();
