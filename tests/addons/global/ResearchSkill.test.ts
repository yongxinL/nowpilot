import { describe, it, expect, vi } from 'vitest';
import { ResearchSkill, SEARCH_TOOL_PATTERNS } from '../../../src/addons/global/ResearchSkill';
import type { ResearchSkillConfig } from '../../../src/addons/global/ResearchSkill';

function mockClient(tools: Array<{ name: string; description?: string }>) {
  return {
    listTools: vi.fn().mockResolvedValue({ tools }),
    callTool: vi.fn().mockResolvedValue({ content: [{ text: 'mock results' }] }),
  };
}

describe('SEARCH_TOOL_PATTERNS', () => {
  it('includes /search/i', () => {
    expect(SEARCH_TOOL_PATTERNS.some((p) => p.source === 'search' && p.flags === 'i')).toBe(true);
  });

  it('includes /brave/i', () => {
    expect(SEARCH_TOOL_PATTERNS.some((p) => p.source === 'brave' && p.flags === 'i')).toBe(true);
  });

  it('includes /tavily/i', () => {
    expect(SEARCH_TOOL_PATTERNS.some((p) => p.source === 'tavily' && p.flags === 'i')).toBe(true);
  });

  it('includes /web_search/i', () => {
    expect(SEARCH_TOOL_PATTERNS.some((p) => p.source === 'web_search' && p.flags === 'i')).toBe(true);
  });

  it('includes /google/i', () => {
    expect(SEARCH_TOOL_PATTERNS.some((p) => p.source === 'google' && p.flags === 'i')).toBe(true);
  });

  it('all patterns are case-insensitive RegExp', () => {
    for (const pattern of SEARCH_TOOL_PATTERNS) {
      expect(pattern).toBeInstanceOf(RegExp);
      expect(pattern.flags).toContain('i');
    }
  });
});

describe('ResearchSkill', () => {
  it('isAvailable() returns true when MCP client has a tool named brave_search', async () => {
    const skill = new ResearchSkill();
    const client = mockClient([{ name: 'brave_search', description: 'Search the web via Brave' }]);
    skill.configure({ mcpClient: client });

    const result = await skill.isAvailable();
    expect(result).toBe(true);
    expect(client.listTools).toHaveBeenCalledOnce();
  });

  it('isAvailable() returns true when MCP client has a tool with "search" in description', async () => {
    const skill = new ResearchSkill();
    const client = mockClient([{ name: 'custom-tool', description: 'This tool does a search across documents' }]);
    skill.configure({ mcpClient: client });

    const result = await skill.isAvailable();
    expect(result).toBe(true);
  });

  it('isAvailable() returns false when MCP client has no search-related tools', async () => {
    const skill = new ResearchSkill();
    const client = mockClient([
      { name: 'get_weather', description: 'Get current weather' },
      { name: 'calculator', description: 'Perform math calculations' },
    ]);
    skill.configure({ mcpClient: client });

    const result = await skill.isAvailable();
    expect(result).toBe(false);
  });

  it('isAvailable() returns false when MCP client.listTools() throws (graceful)', async () => {
    const skill = new ResearchSkill();
    const client = {
      listTools: vi.fn().mockRejectedValue(new Error('Connection refused')),
      callTool: vi.fn(),
    };
    skill.configure({ mcpClient: client });

    const result = await skill.isAvailable();
    expect(result).toBe(false);
  });

  it('execute() returns unavailable message when no MCP client configured', async () => {
    const skill = new ResearchSkill();
    // No configure() call — mcpClient is undefined

    const result = await skill.execute('test query');
    expect(result.type).toBe('unavailable');
    expect(result.message).toContain('Configure');
    expect(result.message).toContain('MCP Servers');
  });

  it('execute() with available search tool calls MCP tool and returns results', async () => {
    const skill = new ResearchSkill();
    const client = mockClient([{ name: 'brave_search', description: 'Search the web' }]);
    skill.configure({ mcpClient: client });

    const result = await skill.execute('Latest AI news');
    expect(client.callTool).toHaveBeenCalledWith('brave_search', { query: 'Latest AI news' });
    expect(result.type).toBe('results');
    expect(result.data).toBeDefined();
  });

  it('execute() returns error when MCP callTool throws', async () => {
    const skill = new ResearchSkill();
    const client = {
      listTools: vi.fn().mockResolvedValue({ tools: [{ name: 'brave_search', description: 'Search' }] }),
      callTool: vi.fn().mockRejectedValue(new Error('API error')),
    };
    skill.configure({ mcpClient: client });

    const result = await skill.execute('test');
    expect(result.type).toBe('error');
    expect(result.message).toContain('failed');
  });
});
